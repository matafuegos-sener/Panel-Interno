import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Contacto } from "@/data/crm";
import { LeadBase } from "@/data/leadsBase";
import { unificarDesdeContactos, unificarDesdeTracking } from "@/data/crmUnificado";

const TAMANO_PAGINA = 1000;
// Tope de seguridad, no un límite de producto -- hoy la base real (~9.500
// filas en leads_base) entra cómoda. Filtrar por criterio sigue siendo lo
// rápido (subconjuntos chicos); esto solo evita un loop sin fin si alguna
// vez la base crece de forma descontrolada con el filtro en "Todos".
const MAX_FILAS_POR_TABLA = 15000;

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
  const categoria = searchParams.get("categoria") || "";
  const estadoCrm = searchParams.get("estado_crm") || "";
  const rubros = searchParams.get("rubros")?.split(",").filter(Boolean) ?? [];
  const tier = searchParams.get("tier") || "";
  const activo = searchParams.get("activo") || "";
  const busqueda = searchParams.get("busqueda")?.trim() || "";

  const contactos: Contacto[] = [];
  for (let desde = 0; desde < MAX_FILAS_POR_TABLA; desde += TAMANO_PAGINA) {
    let query = supabaseAdmin.from("contactos").select("*").range(desde, desde + TAMANO_PAGINA - 1);
    if (categoria) query = query.eq("categoria", categoria);
    if (estadoCrm) query = query.eq("estado_crm", estadoCrm);
    if (rubros.length > 0) query = query.in("tipo_perfil", rubros);
    if (tier) query = query.eq("tier", tier);
    if (activo === "si") query = query.eq("activo", true);
    // "no" incluye NULL además de false: en leads_base (0006_uniformar_base.sql)
    // `activo` arranca sin valor hasta que se marca a mano -- mientras nadie lo
    // haga, esos contactos son inactivos en la práctica, no "sin dato" aparte.
    if (activo === "no") query = query.or("activo.eq.false,activo.is.null");
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
    if (activo === "si") query = query.eq("activo", true);
    if (activo === "no") query = query.or("activo.eq.false,activo.is.null");
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
