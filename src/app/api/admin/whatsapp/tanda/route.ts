import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TablaOrigen } from "@/data/crm";

interface ItemTanda {
  id: string;
  tabla: TablaOrigen;
}

type FilaNombre = Record<string, string | null>;

const COLUMNAS_NOMBRE: Record<TablaOrigen, string> = { contactos: "razon_social, nombre_comercial", leads_base: "nombre" };

function nombreDeFila(tabla: TablaOrigen, fila: FilaNombre): string {
  if (tabla === "leads_base") return fila.nombre || "";
  return fila.razon_social || fila.nombre_comercial || "";
}

// Persiste la tanda de WhatsApp armada en WhatsappView -- antes viajaba
// entera por querystring y se perdía si se cerraba la pestaña sin marcar
// cada contacto a mano (ver pendientes.md, sección ENVÍOS). /whatsapp-tanda
// ahora solo necesita el id que devuelve esto.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const items: ItemTanda[] = Array.isArray(body?.items) ? body.items : [];
  const plantillaId = typeof body?.plantillaId === "string" ? body.plantillaId : "";
  if (!plantillaId || items.length === 0) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }

  const idsContactos = items.filter((i) => i.tabla === "contactos").map((i) => i.id);
  const idsTracking = items.filter((i) => i.tabla === "leads_base").map((i) => i.id);
  const [resContactos, resTracking] = await Promise.all([
    idsContactos.length
      ? supabaseAdmin.from("contactos").select(`id, ${COLUMNAS_NOMBRE.contactos}`).in("id", idsContactos)
      : Promise.resolve({ data: [] }),
    idsTracking.length
      ? supabaseAdmin.from("leads_base").select(`id, ${COLUMNAS_NOMBRE.leads_base}`).in("id", idsTracking)
      : Promise.resolve({ data: [] }),
  ]);

  const mapaNombres = new Map<string, string>();
  ((resContactos.data ?? []) as unknown as (FilaNombre & { id: string })[]).forEach((f) =>
    mapaNombres.set(`contactos:${f.id}`, nombreDeFila("contactos", f))
  );
  ((resTracking.data ?? []) as unknown as (FilaNombre & { id: string })[]).forEach((f) =>
    mapaNombres.set(`leads_base:${f.id}`, nombreDeFila("leads_base", f))
  );

  const { data: tanda, error: errTanda } = await supabaseAdmin
    .from("tandas_envio")
    .insert({ tipo: "whatsapp", total: items.length, plantilla_id: plantillaId })
    .select()
    .single();
  if (errTanda || !tanda) {
    return NextResponse.json({ error: "No se pudo crear el registro de la tanda" }, { status: 500 });
  }

  const itemsParaInsertar = items
    .map((item, orden) => ({ item, orden }))
    .filter(({ item }) => item.tabla === "contactos" || item.tabla === "leads_base")
    .map(({ item, orden }) => ({
      tanda_id: tanda.id,
      contacto_id: item.id,
      tabla_origen: item.tabla,
      nombre: mapaNombres.get(`${item.tabla}:${item.id}`) || "(sin nombre)",
      orden,
    }));
  await supabaseAdmin.from("tandas_envio_items").insert(itemsParaInsertar);

  return NextResponse.json({ tandaId: tanda.id });
}
