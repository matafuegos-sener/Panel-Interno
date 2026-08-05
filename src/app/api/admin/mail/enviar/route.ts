import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarMail } from "@/lib/resend";
import { reemplazarVariables } from "@/lib/plantillas";
import { TablaOrigen } from "@/data/crm";

interface ItemTanda {
  id: string;
  tabla: TablaOrigen;
}

type FilaContacto = Record<string, string | boolean | null>;

const COLUMNA_MAIL: Record<TablaOrigen, string> = { contactos: "mail_1", leads_base: "email" };
const COLUMNAS_NOMBRE: Record<TablaOrigen, string> = { contactos: "razon_social, nombre_comercial", leads_base: "nombre" };
const MAX_TANDA = 25;

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

  async function marcarItem(item: ItemTanda, estado: "enviado" | "fallido", motivo?: string) {
    await supabaseAdmin
      .from("tandas_envio_items")
      .update({ estado, motivo: motivo ?? null })
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
    if (fila.categoria !== "frio") {
      fallidos.push({ id: item.id, tabla, motivo: "Ya no es un contacto frío" });
      await marcarItem(item, "fallido", "Ya no es un contacto frío");
      continue;
    }

    const nombre = nombreDeFila(tabla, fila);
    const asunto = reemplazarVariables(body.asunto.trim(), nombre);
    const cuerpo = reemplazarVariables(body.cuerpo, nombre);
    const resultado = await enviarMail({ to: email, subject: asunto, text: cuerpo });
    if (!resultado.ok) {
      fallidos.push({ id: item.id, tabla, motivo: resultado.error || "Resend rechazó el envío" });
      await marcarItem(item, "fallido", resultado.error || "Resend rechazó el envío");
      continue;
    }

    await supabaseAdmin
      .from(tabla)
      .update({ mail_enviado: true, mail_enviado_en: new Date().toISOString(), categoria: "contactado_mail" })
      .eq("id", item.id);
    enviados.push({ id: item.id, tabla });
    await marcarItem(item, "enviado");
  }

  await supabaseAdmin
    .from("tandas_envio")
    .update({ estado: "completado", completado_en: new Date().toISOString(), enviados: enviados.length, fallidos: fallidos.length })
    .eq("id", tanda.id);

  return NextResponse.json({ enviados: enviados.length, fallidos, tandaId: tanda.id });
}
