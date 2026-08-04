import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("contactos")
    .select(
      "id, razon_social, nombre_comercial, tipo_perfil, provincia, contacto, telefono, mail_1, activo, tier, fuente, categoria, whatsapp_enviado, whatsapp_enviado_en, whatsapp_sin_wa, mail_enviado, mail_enviado_en"
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
