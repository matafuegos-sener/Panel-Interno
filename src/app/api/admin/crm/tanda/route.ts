import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TablaOrigen } from "@/data/crm";

interface ItemTanda {
  id: string;
  tabla: TablaOrigen;
}

// Trae los datos mínimos de una tanda (armada en WhatsappView) para la
// pantalla /whatsapp-tanda, que se abre en pestaña aparte y no tiene acceso
// al estado en memoria de la vista que armó la tanda.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const items: ItemTanda[] = Array.isArray(body?.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Tanda vacía" }, { status: 400 });
  }

  const idsContactos = items.filter((i) => i.tabla === "contactos").map((i) => i.id);
  const idsTracking = items.filter((i) => i.tabla === "leads_base").map((i) => i.id);

  const [{ data: contactos, error: errC }, { data: tracking, error: errT }] = await Promise.all([
    idsContactos.length
      ? supabaseAdmin.from("contactos").select("id, razon_social, nombre_comercial, telefono, whatsapp_enviado, whatsapp_sin_wa").in("id", idsContactos)
      : Promise.resolve({ data: [], error: null }),
    idsTracking.length
      ? supabaseAdmin.from("leads_base").select("id, nombre, telefono, whatsapp_enviado, whatsapp_sin_wa").in("id", idsTracking)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (errC || errT) {
    return NextResponse.json({ error: (errC ?? errT)!.message }, { status: 500 });
  }

  const filas = [
    ...(contactos ?? []).map((c) => ({
      id: c.id,
      tabla: "contactos" as TablaOrigen,
      nombre: c.razon_social || c.nombre_comercial || "(sin nombre)",
      telefono: c.telefono,
      whatsapp_enviado: c.whatsapp_enviado,
      whatsapp_sin_wa: c.whatsapp_sin_wa,
    })),
    ...(tracking ?? []).map((t) => ({
      id: t.id,
      tabla: "leads_base" as TablaOrigen,
      nombre: t.nombre || "(sin nombre)",
      telefono: t.telefono,
      whatsapp_enviado: t.whatsapp_enviado,
      whatsapp_sin_wa: t.whatsapp_sin_wa,
    })),
  ];

  // mantener el orden original de la tanda
  const ordenadas = items.map((it) => filas.find((f) => f.tabla === it.tabla && f.id === it.id)).filter((f): f is NonNullable<typeof f> => !!f);

  return NextResponse.json(ordenadas, { headers: { "Cache-Control": "no-store" } });
}
