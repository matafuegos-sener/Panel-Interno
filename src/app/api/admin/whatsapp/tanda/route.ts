import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TablaOrigen } from "@/data/crm";

interface ItemTanda {
  id: string;
  tabla: TablaOrigen;
}

type FilaContacto = Record<string, string | null>;

const COLUMNAS_NOMBRE: Record<TablaOrigen, string> = { contactos: "razon_social, nombre_comercial", leads_base: "nombre" };

function nombreDeFila(tabla: TablaOrigen, fila: FilaContacto): string {
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
      ? supabaseAdmin.from("contactos").select(`id, categoria, ${COLUMNAS_NOMBRE.contactos}`).in("id", idsContactos)
      : Promise.resolve({ data: [] }),
    idsTracking.length
      ? supabaseAdmin.from("leads_base").select(`id, categoria, ${COLUMNAS_NOMBRE.leads_base}`).in("id", idsTracking)
      : Promise.resolve({ data: [] }),
  ]);

  const mapaFilas = new Map<string, FilaContacto>();
  ((resContactos.data ?? []) as unknown as (FilaContacto & { id: string })[]).forEach((f) => mapaFilas.set(`contactos:${f.id}`, f));
  ((resTracking.data ?? []) as unknown as (FilaContacto & { id: string })[]).forEach((f) => mapaFilas.set(`leads_base:${f.id}`, f));

  // Resguardo del lado del servidor -- nunca persistir en la tanda a un
  // contacto que ya se está trabajando, sin importar lo que haya filtrado el
  // cliente (ver conversación 2026-08-05: nada de mensajes masivos a alguien
  // que ya dejó de ser un contacto frío).
  const itemsFrios = items
    .map((item) => ({ item, fila: mapaFilas.get(`${item.tabla}:${item.id}`) }))
    .filter(({ item, fila }) => (item.tabla === "contactos" || item.tabla === "leads_base") && fila?.categoria === "frio");

  if (itemsFrios.length === 0) {
    return NextResponse.json({ error: "Ningún contacto frío en esta tanda -- ya se están trabajando o no son válidos" }, { status: 400 });
  }

  const { data: tanda, error: errTanda } = await supabaseAdmin
    .from("tandas_envio")
    .insert({ tipo: "whatsapp", total: itemsFrios.length, plantilla_id: plantillaId })
    .select()
    .single();
  if (errTanda || !tanda) {
    return NextResponse.json({ error: "No se pudo crear el registro de la tanda" }, { status: 500 });
  }

  const itemsParaInsertar = itemsFrios.map(({ item, fila }, i) => ({
    tanda_id: tanda.id,
    contacto_id: item.id,
    tabla_origen: item.tabla,
    nombre: (fila && nombreDeFila(item.tabla, fila)) || "(sin nombre)",
    orden: i,
  }));
  await supabaseAdmin.from("tandas_envio_items").insert(itemsParaInsertar);

  return NextResponse.json({ tandaId: tanda.id });
}
