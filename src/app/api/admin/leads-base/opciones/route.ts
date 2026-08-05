import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TAMANO_PAGINA = 1000;

// Facetas livianas para poblar los <select> de Base Tracking sin bajar la
// base entera (9.500+ filas con todas las columnas) solo para armar dos
// listas de opciones. Trae únicamente rubro/tier, paginado igual que
// /api/admin/leads-base (PostgREST corta en 1000), pero deduplicando en el
// camino -- lo que viaja al cliente son listas de decenas de valores, no
// miles de filas.
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rubros = new Set<string>();
  const tiers = new Set<string>();

  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabaseAdmin
      .from("leads_base")
      .select("rubro,tier")
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    for (const fila of data) {
      if (fila.rubro) rubros.add(fila.rubro);
      if (fila.tier) tiers.add(fila.tier);
    }
    if (data.length < TAMANO_PAGINA) break;
  }

  // Mismo criterio que BaseTrackingView: solo cuentan los contactos con
  // teléfono o email (los que de verdad se pueden trabajar).
  const { count, error: errCount } = await supabaseAdmin
    .from("leads_base")
    .select("*", { count: "exact", head: true })
    .or("telefono.not.is.null,email.not.is.null");
  if (errCount) {
    return NextResponse.json({ error: errCount.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      rubros: [...rubros].sort(),
      tiers: [...tiers].sort(),
      total: count ?? 0,
    },
    { headers: { "Cache-Control": "private, max-age=30" } }
  );
}
