import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TAMANO_PAGINA = 1000;

// Filtros opcionales por querystring (rubro/tier/medio/busqueda) -- si
// BaseTrackingView los manda, se aplican en Supabase ANTES de traer filas,
// para no bajar la base entera (9.500+) solo para que el cliente la filtre
// en memoria. Sin filtros, se comporta como antes (base completa).
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const rubro = searchParams.get("rubro") || "";
  const tier = searchParams.get("tier") || "";
  const medio = searchParams.get("medio") || "";
  const busqueda = searchParams.get("busqueda")?.trim() || "";

  // select("*") a propósito, no una lista fija de columnas: este endpoint lo
  // usan tanto BaseTrackingView (solo lectura, columnas viejas) como el CRM
  // unificado (columnas nuevas de la migración 0005) -- con "*" cada uno
  // sigue funcionando con las columnas que existan en la tabla en cada
  // momento, sin que agregar un campo nuevo rompa al otro consumidor.
  //
  // Supabase/PostgREST corta cada respuesta en 1000 filas por default -- hay
  // que paginar con .range() para traer el resultado completo, si no, lo que
  // queda al final del orden de inserción no llega.
  const filas = [];
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    let query = supabaseAdmin.from("leads_base").select("*").range(desde, desde + TAMANO_PAGINA - 1);
    if (rubro) query = query.eq("rubro", rubro);
    if (tier) query = query.eq("tier", tier);
    if (medio === "telefono") query = query.not("telefono", "is", null);
    if (medio === "email") query = query.not("email", "is", null);
    if (busqueda) query = query.ilike("nombre", `%${busqueda}%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    filas.push(...data);
    if (data.length < TAMANO_PAGINA) break;
  }

  return NextResponse.json(filas, { headers: { "Cache-Control": "no-store" } });
}
