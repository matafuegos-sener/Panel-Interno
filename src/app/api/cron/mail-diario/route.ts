import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CATEGORIA_PROSPECTO_CERO } from "@/data/crm";
import { buscarContactosPorFiltro } from "@/lib/contactosLote";
import { capacidadRestanteHoy, motivoFrenoPorRebotes, ESPACIADO_MINIMO_MINUTOS } from "@/lib/mailTope";
import { ejecutarEnvioMail } from "@/lib/mailEnvioCore";

// Espaciado entre cada mail individual dentro de una corrida automática. En
// Vercel Hobby un cron corre como máximo una vez por día (ver build-log
// 2026-08-14) -- así que una campaña puede completar el tope diario entero
// (hasta 50) en una sola invocación. Nunca se manda de un golpe: cada mail
// sale separado por este intervalo. 50 mails * 3s = 150s de pausas, bien
// adentro de los 300s que dura una función en Hobby (Fluid Compute).
const ESPACIADO_ENTRE_ENVIOS_MS = 3000;

// Hasta 50 mails * 3s de pausa = 150s, más el tiempo real de cada envío --
// el default de Vercel ya es 300s (Fluid Compute, todos los planes), esto
// solo lo deja explícito para no depender de que nadie lo cambie sin darse
// cuenta.
export const maxDuration = 300;

// Dispara Vercel Cron (vercel.json). Lee la campaña automática activa
// (0013_campana_mail.sql) y manda lo que el tope diario del día le permita,
// re-evaluando el filtro guardado contra la base en cada corrida -- no una
// lista de ids congelada, así un contacto que se marca a mano en el medio
// (ej. ya no es Prospecto Cero) no se manda igual.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: campana, error: errCampana } = await supabaseAdmin
    .from("campanas_mail")
    .select("*")
    .eq("estado", "activa")
    .order("creado_en", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (errCampana) {
    return NextResponse.json({ error: errCampana.message }, { status: 500 });
  }
  if (!campana) {
    return NextResponse.json({ motivo: "Sin campaña activa" });
  }

  const ahora = new Date();

  const motivoFreno = await motivoFrenoPorRebotes(ahora);
  if (motivoFreno) {
    return NextResponse.json({ motivo: motivoFreno });
  }

  const capacidad = await capacidadRestanteHoy(ahora);
  if (capacidad.restante <= 0) {
    return NextResponse.json({ motivo: "Tope diario ya alcanzado hoy" });
  }
  if (capacidad.minutosDesdeUltimo !== null && capacidad.minutosDesdeUltimo < ESPACIADO_MINIMO_MINUTOS) {
    return NextResponse.json({ motivo: "Espaciado mínimo entre tandas todavía no cumplido, reintenta en la próxima corrida" });
  }

  const lote = await buscarContactosPorFiltro(campana.filtro ?? {});
  if ("error" in lote) {
    return NextResponse.json({ error: lote.error }, { status: 500 });
  }

  // Misma regla de elegibilidad que EnviosMailView.tsx: frío, con email,
  // todavía sin mail enviado, casilla no bloqueada por rebote/spam -- nunca
  // un envío masivo a alguien que ya se está trabajando o que ya rechazó.
  const elegibles = lote.filter((c) => c.email && !c.mailEnviado && !c.mailBloqueado && c.categoria === CATEGORIA_PROSPECTO_CERO);
  if (elegibles.length === 0) {
    await supabaseAdmin.from("campanas_mail").update({ estado: "completada" }).eq("id", campana.id);
    return NextResponse.json({ motivo: "Campaña completada -- no quedan contactos elegibles" });
  }

  const tanda = elegibles.slice(0, capacidad.restante).map((c) => ({ id: c.id, tabla: c.tabla }));
  const resultado = await ejecutarEnvioMail({
    asunto: campana.asunto,
    cuerpo: campana.cuerpo,
    items: tanda,
    espaciadoMs: ESPACIADO_ENTRE_ENVIOS_MS,
  });

  await supabaseAdmin
    .from("campanas_mail")
    .update({
      ultima_corrida_en: ahora.toISOString(),
      total_enviados: (campana.total_enviados ?? 0) + resultado.enviados.length,
    })
    .eq("id", campana.id);

  return NextResponse.json({ enviados: resultado.enviados.length, fallidos: resultado.fallidos.length });
}
