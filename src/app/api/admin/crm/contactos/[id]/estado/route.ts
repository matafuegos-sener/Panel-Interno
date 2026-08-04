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

  const update: Record<string, boolean | string | null> = {};
  if (typeof body.whatsapp_enviado === "boolean") {
    update.whatsapp_enviado = body.whatsapp_enviado;
    update.whatsapp_enviado_en = body.whatsapp_enviado ? new Date().toISOString() : null;
    if (body.whatsapp_enviado) update.categoria = "contactado_whatsapp";
  }
  if (typeof body.whatsapp_sin_wa === "boolean") {
    update.whatsapp_sin_wa = body.whatsapp_sin_wa;
  }
  if (typeof body.mail_enviado === "boolean") {
    update.mail_enviado = body.mail_enviado;
    update.mail_enviado_en = body.mail_enviado ? new Date().toISOString() : null;
    if (body.mail_enviado) update.categoria = "contactado_mail";
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from(tabla).update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
