import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarMail, MAIL_FROM_PROSPECCION } from "@/lib/resend";
import { reemplazarVariables, textoAHtml, textoAPlano } from "@/lib/plantillas";
import { TablaOrigen, CATEGORIA_PROSPECTO_CERO } from "@/data/crm";

interface ItemTanda {
  id: string;
  tabla: TablaOrigen;
}

type FilaContacto = Record<string, string | boolean | null>;

const COLUMNA_MAIL: Record<TablaOrigen, string> = { contactos: "mail_1", leads_base: "email" };
const COLUMNAS_NOMBRE: Record<TablaOrigen, string> = { contactos: "razon_social, nombre_comercial", leads_base: "nombre" };
const MAX_TANDA = 25;

// Rampa de warm-up del dominio (ver build-log 2026-08-12). El 2026-08-11 se
// mandaron 60 mails en 4 tandas pegadas en menos de una hora -- muy por
// encima del tope seguro para un dominio sin historial de envío, y en
// ráfaga en vez de repartido. Estos dos límites existen para que ese
// patrón no se pueda repetir por accidente, no son arbitrarios: se
// recalculan a mano a medida que el dominio acumula historial limpio.
const TOPE_DIARIO: { desde: string; tope: number }[] = [
  { desde: "2026-08-12", tope: 40 },
  { desde: "2026-08-13", tope: 45 },
  { desde: "2026-08-14", tope: 50 },
];
const TOPE_DIARIO_ESTABLE = 50;
const ESPACIADO_MINIMO_MINUTOS = 90;

// El webhook de Resend (src/app/api/webhooks/resend/route.ts) guarda
// rebotado/quejado por item pero nadie lo consultaba antes de esto -- se
// veía como badge en Envíos activos, sin frenar nada (bug reportado
// 2026-08-13, ver build-log). Ventana de 7 días con muestra mínima para no
// frenar por 1 rebote aislado sobre 2 envíos; una queja de spam frena
// siempre, sin importar el tamaño de la muestra.
const VENTANA_REBOTES_DIAS = 7;
const MUESTRA_MINIMA_TASA_REBOTE = 5;
const TASA_REBOTE_MAXIMA = 0.08;

async function motivoFrenoPorRebotes(ahora: Date): Promise<string | null> {
  const desde = new Date(ahora.getTime() - VENTANA_REBOTES_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("tandas_envio_items")
    .select("resend_estado")
    .eq("estado", "enviado")
    .gte("enviado_en", desde)
    .in("resend_estado", ["entregado", "rebotado", "quejado"]);
  const conocidos = data ?? [];

  const quejas = conocidos.filter((f) => f.resend_estado === "quejado").length;
  if (quejas > 0) {
    return `Envío frenado: ${quejas} queja(s) de spam en los últimos ${VENTANA_REBOTES_DIAS} días. Revisar en Envíos activos antes de seguir mandando.`;
  }

  const rebotes = conocidos.filter((f) => f.resend_estado === "rebotado").length;
  if (conocidos.length < MUESTRA_MINIMA_TASA_REBOTE) return null;
  const tasa = rebotes / conocidos.length;
  if (tasa <= TASA_REBOTE_MAXIMA) return null;
  return `Envío frenado: ${rebotes}/${conocidos.length} mails rebotaron en los últimos ${VENTANA_REBOTES_DIAS} días (${Math.round(tasa * 100)}%, máximo ${Math.round(TASA_REBOTE_MAXIMA * 100)}%). Revisar la base antes de seguir mandando.`;
}

function topeDiarioHoy(hoy: string): number {
  const aplicable = [...TOPE_DIARIO].reverse().find((f) => f.desde <= hoy);
  return aplicable ? aplicable.tope : TOPE_DIARIO_ESTABLE;
}

function nombreDeFila(tabla: TablaOrigen, fila: FilaContacto): string {
  if (tabla === "leads_base") return (fila.nombre as string) || "";
  return (fila.razon_social as string) || (fila.nombre_comercial as string) || "";
}

async function traerFilas(tabla: TablaOrigen, ids: string[]): Promise<Map<string, FilaContacto>> {
  const mapa = new Map<string, FilaContacto>();
  if (ids.length === 0) return mapa;
  const { data } = await supabaseAdmin
    .from(tabla)
    .select(`id, mail_enviado, categoria, ${COLUMNA_MAIL[tabla]}, ${COLUMNAS_NOMBRE[tabla]}`)
    .in("id", ids);
  (data ?? []).forEach((fila) => {
    const filaTipada = fila as unknown as FilaContacto;
    mapa.set(filaTipada.id as string, filaTipada);
  });
  return mapa;
}

// Envía uno por uno (nunca CC/BCC, ver reglas de email del CLAUDE.md
// global) y marca mail_enviado=true en la tabla de origen de cada contacto
// para que no se repita en la próxima tanda. Además persiste la tanda en
// tandas_envio/tandas_envio_items y va actualizando el progreso item por
// item mientras el loop corre (el request sigue siendo síncrono, solo ahora
// escribe en la base a medida que avanza) -- así un poll desde la Agenda ve
// la tanda avanzar en vivo sin tener que esperar a que termine todo.
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
  const hoyISO = ahora.toISOString().slice(0, 10);
  const inicioHoy = `${hoyISO}T00:00:00.000Z`;
  const tope = topeDiarioHoy(hoyISO);

  const motivoFreno = await motivoFrenoPorRebotes(ahora);
  if (motivoFreno) {
    return NextResponse.json({ error: motivoFreno }, { status: 429 });
  }

  const [{ count: yaEnviadosHoy }, { data: ultimoItem }] = await Promise.all([
    supabaseAdmin
      .from("tandas_envio_items")
      .select("id", { count: "exact", head: true })
      .eq("estado", "enviado")
      .gte("enviado_en", inicioHoy),
    supabaseAdmin
      .from("tandas_envio_items")
      .select("enviado_en")
      .eq("estado", "enviado")
      .order("enviado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if ((yaEnviadosHoy ?? 0) + items.length > tope) {
    const restante = Math.max(tope - (yaEnviadosHoy ?? 0), 0);
    return NextResponse.json(
      { error: `Tope diario: ${yaEnviadosHoy ?? 0}/${tope} ya enviados hoy. Quedan ${restante} disponibles.` },
      { status: 429 },
    );
  }

  if (ultimoItem?.enviado_en) {
    const minutosDesdeUltimo = (ahora.getTime() - new Date(ultimoItem.enviado_en).getTime()) / 60000;
    if (minutosDesdeUltimo < ESPACIADO_MINIMO_MINUTOS) {
      const faltan = Math.ceil(ESPACIADO_MINIMO_MINUTOS - minutosDesdeUltimo);
      return NextResponse.json(
        { error: `Esperá ${faltan} minutos más antes de la próxima tanda (mínimo ${ESPACIADO_MINIMO_MINUTOS} min entre tandas, para no mandar en ráfaga).` },
        { status: 429 },
      );
    }
  }

  const idsContactos = items.filter((i) => i.tabla === "contactos").map((i) => i.id);
  const idsTracking = items.filter((i) => i.tabla === "leads_base").map((i) => i.id);
  const [filasContactos, filasTracking] = await Promise.all([
    traerFilas("contactos", idsContactos),
    traerFilas("leads_base", idsTracking),
  ]);
  const filasPorTabla: Record<TablaOrigen, Map<string, FilaContacto>> = {
    contactos: filasContactos,
    leads_base: filasTracking,
  };

  const { data: tanda, error: errTanda } = await supabaseAdmin
    .from("tandas_envio")
    .insert({ tipo: "mail", total: items.length, asunto: body.asunto.trim() })
    .select()
    .single();
  if (errTanda || !tanda) {
    return NextResponse.json({ error: "No se pudo crear el registro de la tanda" }, { status: 500 });
  }

  // Filtra tablas inválidas antes de insertar -- tandas_envio_items tiene un
  // check constraint sobre tabla_origen, y un insert masivo con una sola fila
  // fuera del check tira abajo el insert entero.
  const itemsParaInsertar = items
    .map((item, orden) => ({ item, orden }))
    .filter(({ item }) => item.tabla === "contactos" || item.tabla === "leads_base")
    .map(({ item, orden }) => {
      const fila = filasPorTabla[item.tabla]?.get(item.id);
      return {
        tanda_id: tanda.id,
        contacto_id: item.id,
        tabla_origen: item.tabla,
        nombre: (fila && nombreDeFila(item.tabla, fila)) || "(sin nombre)",
        orden,
      };
    });
  await supabaseAdmin.from("tandas_envio_items").insert(itemsParaInsertar);

  const enviados: ItemTanda[] = [];
  const fallidos: { id: string; tabla: TablaOrigen; motivo: string }[] = [];

  async function marcarItem(
    item: ItemTanda,
    estado: "enviado" | "fallido",
    motivo?: string,
    resendId?: string,
  ) {
    await supabaseAdmin
      .from("tandas_envio_items")
      .update({
        estado,
        motivo: motivo ?? null,
        ...(resendId ? { resend_id: resendId, enviado_en: new Date().toISOString() } : {}),
      })
      .eq("tanda_id", tanda.id)
      .eq("contacto_id", item.id)
      .eq("tabla_origen", item.tabla);
    await supabaseAdmin.from("tandas_envio").update({ enviados: enviados.length, fallidos: fallidos.length }).eq("id", tanda.id);
  }

  for (const item of items) {
    const tabla = item.tabla === "contactos" || item.tabla === "leads_base" ? item.tabla : null;
    if (!tabla) {
      fallidos.push({ id: item.id, tabla: item.tabla, motivo: "Tabla inválida" });
      await marcarItem(item, "fallido", "Tabla inválida");
      continue;
    }

    const fila = filasPorTabla[tabla].get(item.id);
    if (!fila) {
      fallidos.push({ id: item.id, tabla, motivo: "No se encontró el contacto" });
      await marcarItem(item, "fallido", "No se encontró el contacto");
      continue;
    }
    const email = fila[COLUMNA_MAIL[tabla]] as string | null;
    if (!email) {
      fallidos.push({ id: item.id, tabla, motivo: "Sin email" });
      await marcarItem(item, "fallido", "Sin email");
      continue;
    }
    if (fila.mail_enviado) {
      fallidos.push({ id: item.id, tabla, motivo: "Ya se le había enviado" });
      await marcarItem(item, "fallido", "Ya se le había enviado");
      continue;
    }
    // Resguardo del lado del servidor -- nunca mandar un mail masivo a un
    // contacto que ya se está trabajando, sin importar lo que haya filtrado
    // el cliente (ver conversación 2026-08-05).
    if (fila.categoria !== CATEGORIA_PROSPECTO_CERO) {
      fallidos.push({ id: item.id, tabla, motivo: "Ya no es un Prospecto Cero" });
      await marcarItem(item, "fallido", "Ya no es un Prospecto Cero");
      continue;
    }

    const nombre = nombreDeFila(tabla, fila);
    const asunto = textoAPlano(reemplazarVariables(body.asunto.trim(), nombre));
    const cuerpo = reemplazarVariables(body.cuerpo, nombre);
    const resultado = await enviarMail({
      to: email,
      subject: asunto,
      text: textoAPlano(cuerpo),
      html: textoAHtml(cuerpo),
      from: MAIL_FROM_PROSPECCION,
    });
    if (!resultado.ok) {
      fallidos.push({ id: item.id, tabla, motivo: resultado.error || "Resend rechazó el envío" });
      await marcarItem(item, "fallido", resultado.error || "Resend rechazó el envío");
      continue;
    }

    const ahoraEnvio = new Date().toISOString();
    await supabaseAdmin
      .from(tabla)
      .update({
        mail_enviado: true,
        mail_enviado_en: ahoraEnvio,
      })
      .eq("id", item.id);
    enviados.push({ id: item.id, tabla });
    await marcarItem(item, "enviado", undefined, resultado.id);
  }

  await supabaseAdmin
    .from("tandas_envio")
    .update({ estado: "completado", completado_en: new Date().toISOString(), enviados: enviados.length, fallidos: fallidos.length })
    .eq("id", tanda.id);

  return NextResponse.json({ enviados: enviados.length, fallidos, tandaId: tanda.id });
}
