import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { ejecutarEnvioMail, ItemTanda } from "@/lib/mailEnvioCore";
import { capacidadRestanteHoy, motivoFrenoPorRebotes, ESPACIADO_MINIMO_MINUTOS } from "@/lib/mailTope";

const MAX_TANDA = 25;

// Envío manual disparado desde EnviosMailView -- valida el tope diario y el
// freno por rebotes/quejas (src/lib/mailTope.ts, compartido con el cron
// diario de la campaña automática, ver mail-diario/route.ts) y delega el
// envío en sí a src/lib/mailEnvioCore.ts.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const items: ItemTanda[] = Array.isArray(body?.items) ? body.items : [];
  if (
    !body ||
    typeof body.asunto !== "string" ||
    !body.asunto.trim() ||
    typeof body.cuerpo !== "string" ||
    !body.cuerpo.trim() ||
    items.length === 0
  ) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }
  if (items.length > MAX_TANDA) {
    return NextResponse.json({ error: `La tanda no puede superar ${MAX_TANDA} contactos` }, { status: 400 });
  }

  const ahora = new Date();

  const motivoFreno = await motivoFrenoPorRebotes(ahora);
  if (motivoFreno) {
    return NextResponse.json({ error: motivoFreno }, { status: 429 });
  }

  const capacidad = await capacidadRestanteHoy(ahora);
  if (items.length > capacidad.restante) {
    return NextResponse.json(
      { error: `Tope diario: ${capacidad.yaEnviadosHoy}/${capacidad.tope} ya enviados hoy. Quedan ${capacidad.restante} disponibles.` },
      { status: 429 },
    );
  }

  if (capacidad.minutosDesdeUltimo !== null && capacidad.minutosDesdeUltimo < ESPACIADO_MINIMO_MINUTOS) {
    const faltan = Math.ceil(ESPACIADO_MINIMO_MINUTOS - capacidad.minutosDesdeUltimo);
    return NextResponse.json(
      { error: `Esperá ${faltan} minutos más antes de la próxima tanda (mínimo ${ESPACIADO_MINIMO_MINUTOS} min entre tandas, para no mandar en ráfaga).` },
      { status: 429 },
    );
  }

  const resultado = await ejecutarEnvioMail({ asunto: body.asunto.trim(), cuerpo: body.cuerpo, items });
  return NextResponse.json({ enviados: resultado.enviados.length, fallidos: resultado.fallidos, tandaId: resultado.tandaId });
}
