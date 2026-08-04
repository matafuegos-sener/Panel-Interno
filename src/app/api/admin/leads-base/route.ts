import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("leads_base")
    .select(
      "id, nombre, rubro, ciudad, direccion, telefono, whatsapp, website, red_social, rating, reviews, price_level, business_status, maps_url, matricula, fecha_inscripcion, oneroso, sanciones, tier, email, fuente, notas"
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
