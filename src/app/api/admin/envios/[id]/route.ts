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

  const conProblemas = (items ?? []).filter(
    (it) => it.resend_estado === "rebotado" || it.resend_estado === "quejado"
  ).length;

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
    conProblemas,
  };
  const itemsResp: ItemTandaEnvio[] = (items ?? []).map((it) => ({
    id: it.id,
    contactoId: it.contacto_id,
    tabla: it.tabla_origen,
    nombre: it.nombre,
    orden: it.orden,
    estado: it.estado,
    motivo: it.motivo,
    resendEstado: it.resend_estado ?? "enviado",
  }));

  const respuesta: DetalleTanda = { tanda: tandaResp, items: itemsResp };
  return NextResponse.json(respuesta, { headers: { "Cache-Control": "no-store" } });
}

// Borra una tanda (mail o WhatsApp) y sus items -- tandas_envio_items tiene
// "on delete cascade" hacia tandas_envio (ver 0007_agenda_y_tandas.sql), así
// que basta con borrar la tanda.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { error } = await supabaseAdmin.from("tandas_envio").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
