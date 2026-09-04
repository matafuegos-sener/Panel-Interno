import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { capacidadRestanteHoy } from "@/lib/mailTope";
import { buscarContactosPorFiltro } from "@/lib/contactosLote";
import { CATEGORIA_PROSPECTO_CERO } from "@/data/crm";

// Separado de /api/admin/mail/campana a propósito: calcular "cuánto falta"
// recorre toda la base filtrada (miles de filas, paginado de a 1000 en
// contactosLote.ts) -- lento, y no cambia con pausar/reanudar. Antes vivía
// en el GET principal y bloqueaba la aparición de la fila y cada pausa/
// reanudación con esta misma cuenta sin necesidad.
export async function GET() {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data: campana, error } = await supabaseAdmin
    .from("campanas_mail")
    .select("id, filtro")
    .in("estado", ["activa", "pausada"])
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!campana) {
    return NextResponse.json({ progreso: null });
  }

  const cupoHoy = await capacidadRestanteHoy(new Date());
  const lote = await buscarContactosPorFiltro(campana.filtro ?? {});
  if ("error" in lote) {
    return NextResponse.json({ error: lote.error }, { status: 500 });
  }

  // Mismo criterio de elegibilidad que aplica el cron (mail-diario/route.ts)
  // antes de mandar -- así "cuánto falta" es el número real, no una
  // estimación aparte que se puede desincronizar del criterio real de envío.
  const elegiblesRestantes = lote.filter(
    (c) => c.email && !c.mailEnviado && !c.mailBloqueado && c.categoria === CATEGORIA_PROSPECTO_CERO
  ).length;
  const diasRestantes = cupoHoy.tope > 0 ? Math.ceil(elegiblesRestantes / cupoHoy.tope) : 0;

  return NextResponse.json({ progreso: { elegiblesRestantes, diasRestantes } }, { headers: { "Cache-Control": "no-store" } });
}
