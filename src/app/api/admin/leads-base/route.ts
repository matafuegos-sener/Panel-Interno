import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TAMANO_PAGINA = 1000;

export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // select("*") a propósito, no una lista fija de columnas: este endpoint lo
  // usan tanto BaseTrackingView (solo lectura, columnas viejas) como el CRM
  // unificado (columnas nuevas de la migración 0005) -- con "*" cada uno
  // sigue funcionando con las columnas que existan en la tabla en cada
  // momento, sin que agregar un campo nuevo rompa al otro consumidor.
  //
  // Supabase/PostgREST corta cada respuesta en 1000 filas por default -- hay
  // que paginar con .range() para traer la base completa (9.500+ filas),
  // si no, los rubros que quedan al final del orden de inserción no llegan.
  const filas = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabaseAdmin
      .from("leads_base")
      .select("*")
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    filas.push(...data);
    if (data.length < TAMANO_PAGINA) break;
  }

  return NextResponse.json(filas, { headers: { "Cache-Control": "no-store" } });
}
