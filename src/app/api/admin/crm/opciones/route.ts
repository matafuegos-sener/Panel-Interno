import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TAMANO_PAGINA = 1000;

// Facetas livianas para poblar los <select> de CRM/Envío de mails/WhatsApp
// sin bajar las dos tablas completas (contactos + leads_base, 9.500+ filas)
// solo para armar las listas de categoría/rubro/tier. `contactos` usa
// `tipo_perfil` como nombre de columna de rubro, `leads_base` usa `rubro`
// -- ver crmUnificado.ts para el mismo mapeo.
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const categorias = new Set<string>();
  const rubros = new Set<string>();
  const tiers = new Set<string>();

  const { data: filasContactos, error: errContactos } = await supabaseAdmin
    .from("contactos")
    .select("tipo_perfil,tier,categoria");
  if (errContactos) {
    return NextResponse.json({ error: `contactos: ${errContactos.message}` }, { status: 500 });
  }
  for (const fila of filasContactos) {
    if (fila.tipo_perfil) rubros.add(fila.tipo_perfil);
    if (fila.tier) tiers.add(fila.tier);
    if (fila.categoria) categorias.add(fila.categoria);
  }

  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const { data, error } = await supabaseAdmin
      .from("leads_base")
      .select("rubro,tier,categoria")
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) {
      return NextResponse.json({ error: `leads_base: ${error.message}` }, { status: 500 });
    }
    for (const fila of data) {
      if (fila.rubro) rubros.add(fila.rubro);
      if (fila.tier) tiers.add(fila.tier);
      if (fila.categoria) categorias.add(fila.categoria);
    }
    if (data.length < TAMANO_PAGINA) break;
  }

  return NextResponse.json(
    { categorias: [...categorias].sort(), rubros: [...rubros].sort(), tiers: [...tiers].sort() },
    { headers: { "Cache-Control": "private, max-age=30" } }
  );
}
