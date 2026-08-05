import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DetalleTanda, ItemTandaEnvio, TandaEnvio } from "@/data/tandas";

// Detalle completo de una tanda (para el click-to-expand del widget de
// Agenda y de la vista "Envíos activos").
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const { data: tanda, error: errTanda } = await supabaseAdmin.from("tandas_envio").select("*").eq("id", id).single();
  if (errTanda || !tanda) {
    return NextResponse.json({ error: "Tanda no encontrada" }, { status: 404 });
  }

  const { data: items, error: errItems } = await supabaseAdmin
    .from("tandas_envio_items")
    .select("*")
    .eq("tanda_id", id)
    .order("orden");
  if (errItems) {
    return NextResponse.json({ error: errItems.message }, { status: 500 });
  }

  let plantillaTitulo: string | null = null;
  if (tanda.plantilla_id) {
    const { data: plantilla } = await supabaseAdmin.from("mensajes_predefinidos").select("titulo").eq("id", tanda.plantilla_id).single();
    plantillaTitulo = plantilla?.titulo ?? null;
  }

  const tandaResp: TandaEnvio = {
    id: tanda.id,
    tipo: tanda.tipo,
    estado: tanda.estado,
    total: tanda.total,
    enviados: tanda.enviados,
    fallidos: tanda.fallidos,
    asunto: tanda.asunto,
    plantillaTitulo,
    creadoEn: tanda.creado_en,
    completadoEn: tanda.completado_en,
  };
  const itemsResp: ItemTandaEnvio[] = (items ?? []).map((it) => ({
    id: it.id,
    contactoId: it.contacto_id,
    tabla: it.tabla_origen,
    nombre: it.nombre,
    orden: it.orden,
    estado: it.estado,
    motivo: it.motivo,
  }));

  const respuesta: DetalleTanda = { tanda: tandaResp, items: itemsResp };
  return NextResponse.json(respuesta, { headers: { "Cache-Control": "no-store" } });
}
