import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Contacto, TablaOrigen } from "@/data/crm";
import { LeadBase } from "@/data/leadsBase";
import { AtajoCrm, ContactoUnificado, unificarDesdeContactos, unificarDesdeTracking } from "@/data/crmUnificado";
import { buscarContactosPorFiltro } from "@/lib/contactosLote";

const LIMITE_ACTIVIDAD_RECIENTE = 10;
// Buffer de interacciones a mirar hacia atrás para armar "Actividad
// reciente" -- no hace falta bajar todo el historial, con las últimas N
// interacciones alcanza de sobra para sacar los 10 contactos más recientes
// sin repetir (un mismo contacto puede tener varias interacciones seguidas).
const BUFFER_ACTIVIDAD_RECIENTE = 200;

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
  const mailEnviado = searchParams.get("mail_enviado") || "";
  const whatsappEnviado = searchParams.get("whatsapp_enviado") || "";
  const llamadaRealizada = searchParams.get("llamada_realizada") || "";
  const busqueda = searchParams.get("busqueda")?.trim() || "";
  const baseId = searchParams.get("base_id") || "";

  const resultado = await buscarContactosPorFiltro({
    categoria,
    estadoCrm,
    rubros,
    tier,
    activo,
    mailEnviado,
    whatsappEnviado,
    llamadaRealizada,
    busqueda,
    baseId,
  });
  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: 500 });
  }
  return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } });
}

interface ReferenciaContacto {
  contacto_id: string;
  tabla_origen: TablaOrigen;
  fecha: string;
}

// Dado un listado de referencias contacto+fecha ya ordenado por relevancia
// (la más relevante primero), se queda con la primera aparición de cada
// contacto, trae las filas completas de contactos/leads_base y les cuelga
// esa fecha en `fechaAtajo` -- preserva el orden de entrada, no hace falta
// volver a ordenar después.
async function armarLoteDesdeReferencias(referencias: ReferenciaContacto[]): Promise<ContactoUnificado[] | { error: string }> {
  const vistos = new Set<string>();
  const unicas: ReferenciaContacto[] = [];
  for (const r of referencias) {
    const clave = `${r.tabla_origen}:${r.contacto_id}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    unicas.push(r);
  }
  if (unicas.length === 0) return [];

  const idsContactos = unicas.filter((r) => r.tabla_origen === "contactos").map((r) => r.contacto_id);
  const idsTracking = unicas.filter((r) => r.tabla_origen === "leads_base").map((r) => r.contacto_id);

  const [{ data: contactos, error: e1 }, { data: tracking, error: e2 }] = await Promise.all([
    idsContactos.length > 0
      ? supabaseAdmin.from("contactos").select("*").in("id", idsContactos)
      : Promise.resolve({ data: [] as Contacto[], error: null }),
    idsTracking.length > 0
      ? supabaseAdmin.from("leads_base").select("*").in("id", idsTracking)
      : Promise.resolve({ data: [] as LeadBase[], error: null }),
  ]);
  if (e1 || e2) return { error: (e1 ?? e2)!.message };

  const fechaPorClave = new Map(unicas.map((r) => [`${r.tabla_origen}:${r.contacto_id}`, r.fecha]));
  const ordenPorClave = new Map(unicas.map((r, i) => [`${r.tabla_origen}:${r.contacto_id}`, i]));

  return [...(contactos ?? []).map(unificarDesdeContactos), ...(tracking ?? []).map(unificarDesdeTracking)]
    .map((u) => ({ ...u, fechaAtajo: fechaPorClave.get(`${u.tabla}:${u.id}`) ?? null }))
    .sort((a, b) => ordenPorClave.get(`${a.tabla}:${a.id}`)! - ordenPorClave.get(`${b.tabla}:${b.id}`)!);
}

// "tocados_recientes" y "semana" leen `interacciones` -- el registro manual
// de "Registrar contacto de hoy" (llamada, mail, whatsapp, reunión, nota,
// cotización, pedido, problema). A propósito NO usan `categoria_actualizada_en`
// (0009): esa fecha también la pisa un envío masivo de mail/WhatsApp
// empresa por empresa, y el pedido explícito era que estos dos atajos
// reflejen acciones comandadas desde el CRM, no el ruido de una tanda.
async function resolverAtajo(atajo: AtajoCrm): Promise<NextResponse> {
  if (atajo === "tocados_recientes" || atajo === "semana") {
    let query = supabaseAdmin.from("interacciones").select("contacto_id, tabla_origen, fecha").order("fecha", { ascending: false });

    if (atajo === "semana") {
      const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("fecha", hace7dias);
    } else {
      query = query.limit(BUFFER_ACTIVIDAD_RECIENTE);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: `interacciones: ${error.message}` }, { status: 500 });
    }

    const resultado = await armarLoteDesdeReferencias(data ?? []);
    if ("error" in resultado) {
      return NextResponse.json({ error: resultado.error }, { status: 500 });
    }

    const unificados = atajo === "tocados_recientes" ? resultado.slice(0, LIMITE_ACTIVIDAD_RECIENTE) : resultado;
    return NextResponse.json(unificados, { headers: { "Cache-Control": "no-store" } });
  }

  // "acciones_pendientes": contactos con al menos una acción sin completar
  // cuya fecha_ejecucion todavía no llegó. Sale de `acciones`, quedándonos
  // con la más próxima de cada contacto (la consulta ya viene ordenada asc).
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

  const referencias: ReferenciaContacto[] = (pendientes ?? []).map((a) => ({
    contacto_id: a.contacto_id,
    tabla_origen: a.tabla_origen,
    fecha: a.fecha_ejecucion,
  }));

  const resultado = await armarLoteDesdeReferencias(referencias);
  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: 500 });
  }
  return NextResponse.json(resultado, { headers: { "Cache-Control": "no-store" } });
}
