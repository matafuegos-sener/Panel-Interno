import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { TablaOrigen } from "@/data/crm";
import { EventoAgenda, TipoAgendaManual } from "@/data/agenda";

type FilaNombre = Record<string, string | null>;

const COLUMNAS_NOMBRE: Record<TablaOrigen, string> = { contactos: "razon_social, nombre_comercial", leads_base: "nombre" };
const TIPOS_MANUAL: TipoAgendaManual[] = ["llamada", "reunion", "tarea", "recordatorio"];

function nombreDeFila(tabla: TablaOrigen, fila: FilaNombre): string {
  if (tabla === "leads_base") return fila.nombre || "";
  return fila.razon_social || fila.nombre_comercial || "";
}

// Trae, para un rango de fechas, lo automático (`acciones`, generado al
// registrar una interacción en el CRM) y lo manual (`agenda_eventos`,
// cargado desde el botón "+ Nueva actividad") mezclado en una sola lista --
// la vista de Agenda nunca pide las dos tablas por separado.
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (!desde || !hasta) {
    return NextResponse.json({ error: "Faltan desde/hasta" }, { status: 400 });
  }

  const [{ data: acciones, error: errAcc }, { data: manuales, error: errMan }] = await Promise.all([
    supabaseAdmin.from("acciones").select("*").gte("fecha_ejecucion", desde).lte("fecha_ejecucion", hasta),
    supabaseAdmin.from("agenda_eventos").select("*").gte("fecha", desde).lte("fecha", hasta),
  ]);
  if (errAcc || errMan) {
    return NextResponse.json({ error: (errAcc ?? errMan)!.message }, { status: 500 });
  }

  const idsContactos = new Set<string>();
  const idsTracking = new Set<string>();
  (acciones ?? []).forEach((a) => (a.tabla_origen === "leads_base" ? idsTracking : idsContactos).add(a.contacto_id));
  (manuales ?? []).forEach((m) => {
    if (!m.contacto_id) return;
    (m.tabla_origen === "leads_base" ? idsTracking : idsContactos).add(m.contacto_id);
  });

  const [resContactos, resTracking] = await Promise.all([
    idsContactos.size
      ? supabaseAdmin.from("contactos").select(`id, ${COLUMNAS_NOMBRE.contactos}`).in("id", Array.from(idsContactos))
      : Promise.resolve({ data: [] }),
    idsTracking.size
      ? supabaseAdmin.from("leads_base").select(`id, ${COLUMNAS_NOMBRE.leads_base}`).in("id", Array.from(idsTracking))
      : Promise.resolve({ data: [] }),
  ]);
  const mapaNombres = new Map<string, string>();
  ((resContactos.data ?? []) as unknown as (FilaNombre & { id: string })[]).forEach((f) =>
    mapaNombres.set(`contactos:${f.id}`, nombreDeFila("contactos", f))
  );
  ((resTracking.data ?? []) as unknown as (FilaNombre & { id: string })[]).forEach((f) =>
    mapaNombres.set(`leads_base:${f.id}`, nombreDeFila("leads_base", f))
  );

  const eventos: EventoAgenda[] = [
    ...(acciones ?? []).map((a) => ({
      id: a.id as string,
      origen: "accion" as const,
      tipo: "seguimiento",
      nota: a.descripcion as string,
      fecha: a.fecha_ejecucion as string,
      hora: null,
      duracionMinutos: null,
      completada: a.completada as boolean,
      contactoId: a.contacto_id as string,
      tabla: a.tabla_origen as TablaOrigen,
      contactoNombre: mapaNombres.get(`${a.tabla_origen}:${a.contacto_id}`) ?? null,
    })),
    ...(manuales ?? []).map((m) => ({
      id: m.id as string,
      origen: "manual" as const,
      tipo: m.tipo as string,
      nota: m.nota as string,
      fecha: m.fecha as string,
      hora: m.hora as string | null,
      duracionMinutos: m.duracion_minutos as number | null,
      completada: m.completada as boolean,
      contactoId: m.contacto_id as string | null,
      tabla: m.tabla_origen as TablaOrigen | null,
      contactoNombre: m.contacto_id ? mapaNombres.get(`${m.tabla_origen}:${m.contacto_id}`) ?? null : null,
    })),
  ];

  return NextResponse.json(eventos, { headers: { "Cache-Control": "no-store" } });
}

// Crea una actividad manual (lo automático se genera solo desde el CRM, ver
// POST /api/admin/crm/contactos/[id]/interacciones -- acá no se toca).
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (
    !body ||
    !TIPOS_MANUAL.includes(body.tipo) ||
    typeof body.nota !== "string" ||
    !body.nota.trim() ||
    typeof body.fecha !== "string" ||
    !body.fecha
  ) {
    return NextResponse.json({ error: "Formato inválido" }, { status: 400 });
  }
  const tabla: TablaOrigen | null = body.tabla === "contactos" || body.tabla === "leads_base" ? body.tabla : null;
  const contactoId: string | null = typeof body.contactoId === "string" && body.contactoId ? body.contactoId : null;
  if ((contactoId === null) !== (tabla === null)) {
    return NextResponse.json({ error: "contactoId y tabla van juntos" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("agenda_eventos")
    .insert({
      contacto_id: contactoId,
      tabla_origen: tabla,
      tipo: body.tipo,
      nota: body.nota.trim(),
      fecha: body.fecha,
      hora: typeof body.hora === "string" && body.hora ? body.hora : null,
      duracion_minutos: typeof body.duracionMinutos === "number" ? body.duracionMinutos : null,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
