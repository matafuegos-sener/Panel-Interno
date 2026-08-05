import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Trae la referencia mínima de una tanda persistida (plantilla + items) para
// que /whatsapp-tanda pueda cargarla solo con el id -- los datos en vivo del
// contacto (nombre, teléfono, estado) se piden aparte a /api/admin/crm/tanda,
// que ya existe y no se toca.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const { data: tanda, error: errTanda } = await supabaseAdmin
    .from("tandas_envio")
    .select("id, plantilla_id, estado")
    .eq("id", id)
    .single();
  if (errTanda || !tanda) {
    return NextResponse.json({ error: "Tanda no encontrada" }, { status: 404 });
  }

  const { data: items, error: errItems } = await supabaseAdmin
    .from("tandas_envio_items")
    .select("contacto_id, tabla_origen")
    .eq("tanda_id", id)
    .order("orden");
  if (errItems) {
    return NextResponse.json({ error: errItems.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      plantillaId: tanda.plantilla_id,
      estado: tanda.estado,
      items: (items ?? []).map((i) => ({ id: i.contacto_id, tabla: i.tabla_origen })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
