import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Contacto, TablaOrigen } from "@/data/crm";
import { LeadBase } from "@/data/leadsBase";
import { AtajoCrm, ContactoUnificado, unificarDesdeContactos, unificarDesdeTracking } from "@/data/crmUnificado";

const TAMANO_PAGINA = 1000;
// Tope de seguridad, no un límite de producto -- hoy la base real (~9.500
// filas en leads_base) entra cómoda. Filtrar por criterio sigue siendo lo
// rápido (subconjuntos chicos); esto solo evita un loop sin fin si alguna
// vez la base crece de forma descontrolada con el filtro en "Todos".
const MAX_FILAS_POR_TABLA = 15000;

const LIMITE_ACTIVIDAD_RECIENTE = 10;

// Trae el lote que pide CRM/Envío de mails/WhatsApp ya filtrado en
// Supabase -- reemplaza el patrón viejo de bajar contactos+leads_base
// completas (9.500+ filas) y filtrar en el browser. `rubro` usa columna
// distinta según la tabla (`tipo_perfil` en contactos, `rubro` en
// leads_base) -- mismo mapeo que crmUnificado.ts.
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;

  // Los atajos ("Actividad reciente" / "Contactados esta semana" / "Acciones
  // pendientes") son un segmento aparte, nunca se combinan con los filtros
  // manuales de abajo -- si viene `atajo`, se ignora cualquier otro parámetro.
  const atajo = searchParams.get("atajo");
  if (atajo === "tocados_recientes" || atajo === "semana" || atajo === "acciones_pendientes") {
    return resolverAtajo(atajo);
  }

  const categoria = searchParams.get("categoria") || "";
  const estadoCrm = searchParams.get("estado_crm") || "";
  const rubros = searchParams.get("rubros")?.split(",").filter(Boolean) ?? [];
  const tier = searchParams.get("tier") || "";
  const activo = searchParams.get("activo") || "";
  const busqueda = searchParams.get("busqueda")?.trim() || "";
  // "activo" ya no es solo el flag guardado -- un contacto vendido
  // (0010_vigencia_activo.sql) deja de ser activo solo cuando pasa
  // `vigencia_hasta`, sin que ningún cron lo tenga que apagar.
  const hoy = new Date().toISOString().slice(0, 10);

  const contactos: Contacto[] = [];
  for (let desde = 0; desde < MAX_FILAS_POR_TABLA; desde += TAMANO_PAGINA) {
    let query = supabaseAdmin.from("contactos").select("*").range(desde, desde + TAMANO_PAGINA - 1);
    if (categoria) query = query.eq("categoria", categoria);
    if (estadoCrm) query = query.eq("estado_crm", estadoCrm);
    if (rubros.length > 0) query = query.in("tipo_perfil", rubros);
    if (tier) query = query.eq("tier", tier);
    if (activo === "si") query = query.eq("activo", true).or(`vigencia_hasta.is.null,vigencia_hasta.gte.${hoy}`);
    // "no" incluye NULL/false y también vencido: en leads_base
    // (0006_uniformar_base.sql) `activo` arranca sin valor hasta que se
    // marca solo, y un contacto vendido hace más de un año vuelve a ser
    // inactivo aunque el flag siga en true.
    if (activo === "no") query = query.or(`activo.eq.false,activo.is.null,vigencia_hasta.lt.${hoy}`);
    if (busqueda) query = query.or(`razon_social.ilike.%${busqueda}%,nombre_comercial.ilike.%${busqueda}%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: `contactos: ${error.message}` }, { status: 500 });
    }
    contactos.push(...data);
    if (data.length < TAMANO_PAGINA) break;
  }

  const tracking: LeadBase[] = [];
  for (let desde = 0; desde < MAX_FILAS_POR_TABLA; desde += TAMANO_PAGINA) {
    let query = supabaseAdmin.from("leads_base").select("*").range(desde, desde + TAMANO_PAGINA - 1);
    if (categoria) query = query.eq("categoria", categoria);
    if (estadoCrm) query = query.eq("estado_crm", estadoCrm);
    if (rubros.length > 0) query = query.in("rubro", rubros);
    if (tier) query = query.eq("tier", tier);
    if (activo === "si") query = query.eq("activo", true).or(`vigencia_hasta.is.null,vigencia_hasta.gte.${hoy}`);
    if (activo === "no") query = query.or(`activo.eq.false,activo.is.null,vigencia_hasta.lt.${hoy}`);
    if (busqueda) query = query.ilike("nombre", `%${busqueda}%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: `leads_base: ${error.message}` }, { status: 500 });
    }
    tracking.push(...data);
    if (data.length < TAMANO_PAGINA) break;
  }

  const unificados = [...contactos.map(unificarDesdeContactos), ...tracking.map(unificarDesdeTracking)];
  return NextResponse.json(unificados, { headers: { "Cache-Control": "no-store" } });
}

// "tocados_recientes" y "semana" leen `categoria_actualizada_en`
// (0009_fecha_categoria.sql): se actualiza sola en cada touch real del
// contacto (interacción registrada a mano, mail masivo, WhatsApp marcado
// enviado), así que ya es la señal de "cuándo se tocó por última vez" -- no
// hace falta ir a buscar el historial de `interacciones`.
async function resolverAtajo(atajo: AtajoCrm): Promise<NextResponse> {
  if (atajo === "tocados_recientes" || atajo === "semana") {
    const desde = atajo === "semana" ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() : null;

    let qContactos = supabaseAdmin
      .from("contactos")
      .select("*")
      .not("categoria_actualizada_en", "is", null)
      .order("categoria_actualizada_en", { ascending: false });
    let qTracking = supabaseAdmin
      .from("leads_base")
      .select("*")
      .not("categoria_actualizada_en", "is", null)
      .order("categoria_actualizada_en", { ascending: false });

    if (desde) {
      qContactos = qContactos.gte("categoria_actualizada_en", desde);
      qTracking = qTracking.gte("categoria_actualizada_en", desde);
    } else {
      qContactos = qContactos.limit(LIMITE_ACTIVIDAD_RECIENTE);
      qTracking = qTracking.limit(LIMITE_ACTIVIDAD_RECIENTE);
    }

    const [{ data: contactos, error: e1 }, { data: tracking, error: e2 }] = await Promise.all([qContactos, qTracking]);
    if (e1 || e2) {
      return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });
    }

    let unificados: ContactoUnificado[] = [...(contactos ?? []).map(unificarDesdeContactos), ...(tracking ?? []).map(unificarDesdeTracking)]
      .map((u) => ({ ...u, fechaAtajo: u.categoriaFecha }))
      .sort((a, b) => (b.fechaAtajo ?? "").localeCompare(a.fechaAtajo ?? ""));

    if (atajo === "tocados_recientes") {
      unificados = unificados.slice(0, LIMITE_ACTIVIDAD_RECIENTE);
    }
    return NextResponse.json(unificados, { headers: { "Cache-Control": "no-store" } });
  }

  // "acciones_pendientes": contactos con al menos una acción sin completar
  // cuya fecha_ejecucion todavía no llegó. No hay columna directa para esto
  // en contactos/leads_base -- sale de `acciones`, quedándonos con la más
  // próxima de cada contacto (la consulta ya viene ordenada asc).
  const hoy = new Date().toISOString().slice(0, 10);
  const { data: pendientes, error: errAcciones } = await supabaseAdmin
    .from("acciones")
    .select("contacto_id, tabla_origen, fecha_ejecucion")
    .eq("completada", false)
    .gte("fecha_ejecucion", hoy)
    .order("fecha_ejecucion", { ascending: true });
  if (errAcciones) {
    return NextResponse.json({ error: `acciones: ${errAcciones.message}` }, { status: 500 });
  }

  const proximaPorContacto = new Map<string, { tabla_origen: TablaOrigen; contacto_id: string; fecha: string }>();
  for (const a of pendientes ?? []) {
    const clave = `${a.tabla_origen}:${a.contacto_id}`;
    if (!proximaPorContacto.has(clave)) {
      proximaPorContacto.set(clave, { tabla_origen: a.tabla_origen, contacto_id: a.contacto_id, fecha: a.fecha_ejecucion });
    }
  }

  const referencias = [...proximaPorContacto.values()];
  const idsContactos = referencias.filter((r) => r.tabla_origen === "contactos").map((r) => r.contacto_id);
  const idsTracking = referencias.filter((r) => r.tabla_origen === "leads_base").map((r) => r.contacto_id);

  const [{ data: contactos, error: e1 }, { data: tracking, error: e2 }] = await Promise.all([
    idsContactos.length > 0
      ? supabaseAdmin.from("contactos").select("*").in("id", idsContactos)
      : Promise.resolve({ data: [] as Contacto[], error: null }),
    idsTracking.length > 0
      ? supabaseAdmin.from("leads_base").select("*").in("id", idsTracking)
      : Promise.resolve({ data: [] as LeadBase[], error: null }),
  ]);
  if (e1 || e2) {
    return NextResponse.json({ error: (e1 ?? e2)!.message }, { status: 500 });
  }

  const unificados: ContactoUnificado[] = [...(contactos ?? []).map(unificarDesdeContactos), ...(tracking ?? []).map(unificarDesdeTracking)]
    .map((u) => ({ ...u, fechaAtajo: proximaPorContacto.get(`${u.tabla}:${u.id}`)?.fecha ?? null }))
    .sort((a, b) => (a.fechaAtajo ?? "").localeCompare(b.fechaAtajo ?? ""));

  return NextResponse.json(unificados, { headers: { "Cache-Control": "no-store" } });
}
