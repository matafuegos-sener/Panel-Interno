import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const COLUMNAS =
  "id, nombre, rubro, ciudad, direccion, telefono, whatsapp, website, red_social, rating, reviews, price_level, business_status, maps_url, matricula, fecha_inscripcion, oneroso, sanciones, tier, email, fuente, categoria, notas, whatsapp_enviado, whatsapp_enviado_en, whatsapp_sin_wa, mail_enviado, mail_enviado_en";
const TAMANO_PAGINA = 1000;

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Supabase/PostgREST corta cada respuesta en 1000 filas por default -- hay
  // que paginar con .range() para traer la base completa (9.500+ filas),
  // si no, los rubros que quedan al final del orden de inserción no llegan.
  const filas = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabaseAdmin
      .from("leads_base")
      .select(COLUMNAS)
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    filas.push(...data);
    if (data.length < TAMANO_PAGINA) break;
  }

  return NextResponse.json(filas, { headers: { "Cache-Control": "no-store" } });
}
