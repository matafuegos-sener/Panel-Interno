import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TablaOrigen } from "@/data/crm";

// Marca el estado de envío (WhatsApp/mail) de un contacto -- usado por la
// tanda de WhatsApp (marcar "Enviado" / "Sin WhatsApp") y por el envío de
// mail real, para no repetir un contacto ya trabajado en la próxima tanda.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const tabla: TablaOrigen | null = body?.tabla === "contactos" || body?.tabla === "leads_base" ? body.tabla : null;
  if (!body || typeof body !== "object" || !tabla) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const ahora = new Date().toISOString();
  const update: Record<string, boolean | string | null> = {};
  if (typeof body.whatsapp_enviado === "boolean") {
    update.whatsapp_enviado = body.whatsapp_enviado;
    update.whatsapp_enviado_en = body.whatsapp_enviado ? ahora : null;
    if (body.whatsapp_enviado) {
      update.categoria = "contactado_whatsapp";
      update.categoria_actualizada_en = ahora;
    }
  }
  if (typeof body.whatsapp_sin_wa === "boolean") {
    update.whatsapp_sin_wa = body.whatsapp_sin_wa;
  }
  if (typeof body.mail_enviado === "boolean") {
    update.mail_enviado = body.mail_enviado;
    update.mail_enviado_en = body.mail_enviado ? ahora : null;
    if (body.mail_enviado) {
      update.categoria = "contactado_mail";
      update.categoria_actualizada_en = ahora;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from(tabla).update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.tandaId === "string" && body.tandaId) {
    await sincronizarItemTanda(body.tandaId, id, tabla);
  }

  return NextResponse.json({ ok: true });
}

// Refleja el estado real del contacto (whatsapp_enviado/whatsapp_sin_wa) en
// su fila de tandas_envio_items y recalcula los contadores de la tanda --
// esto es lo que le permite a la Agenda mostrar el progreso de una tanda de
// WhatsApp en vivo, marcada a mano item por item desde /whatsapp-tanda.
async function sincronizarItemTanda(tandaId: string, contactoId: string, tabla: TablaOrigen) {
  const { data: fila } = await supabaseAdmin
    .from(tabla)
    .select("whatsapp_enviado, whatsapp_sin_wa")
    .eq("id", contactoId)
    .single();

  const estadoItem = fila?.whatsapp_enviado ? "enviado" : fila?.whatsapp_sin_wa ? "fallido" : "pendiente";
  const motivoItem = estadoItem === "fallido" ? "Sin WhatsApp" : null;

  await supabaseAdmin
    .from("tandas_envio_items")
    .update({ estado: estadoItem, motivo: motivoItem })
    .eq("tanda_id", tandaId)
    .eq("contacto_id", contactoId)
    .eq("tabla_origen", tabla);

  const { data: items } = await supabaseAdmin.from("tandas_envio_items").select("estado").eq("tanda_id", tandaId);
  const enviados = (items ?? []).filter((i) => i.estado === "enviado").length;
  const fallidos = (items ?? []).filter((i) => i.estado === "fallido").length;
  const pendientes = (items ?? []).length - enviados - fallidos;

  await supabaseAdmin
    .from("tandas_envio")
    .update({
      enviados,
      fallidos,
      estado: pendientes === 0 ? "completado" : "en_curso",
      completado_en: pendientes === 0 ? new Date().toISOString() : null,
    })
    .eq("id", tandaId);
}
