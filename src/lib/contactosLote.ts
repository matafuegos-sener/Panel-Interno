import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Contacto } from "@/data/crm";
import { LeadBase } from "@/data/leadsBase";
import { ContactoUnificado, unificarDesdeContactos, unificarDesdeTracking } from "@/data/crmUnificado";

const TAMANO_PAGINA = 1000;
// Tope de seguridad, no un límite de producto -- hoy la base real (~9.500
// filas en leads_base) entra cómoda. Filtrar por criterio sigue siendo lo
// rápido (subconjuntos chicos); esto solo evita un loop sin fin si alguna
// vez la base crece de forma descontrolada con el filtro en "Todos".
const MAX_FILAS_POR_TABLA = 15000;

export interface FiltroLote {
  categoria?: string;
  estadoCrm?: string;
  rubros?: string[];
  tier?: string;
  activo?: string;
  mailEnviado?: string;
  whatsappEnviado?: string;
  llamadaRealizada?: string;
  busqueda?: string;
  baseId?: string;
}

// Trae el lote filtrado ya armado en Supabase -- usado por /api/admin/crm/lote
// (filtro manual desde el CRM/Envío de mails/WhatsApp) y por el cron diario
// de la campaña automática (mail-diario/route.ts), que re-evalúa el mismo
// filtro contra la base en cada corrida en vez de guardar una lista de ids
// congelada. `rubro` usa columna distinta según la tabla (`tipo_perfil` en
// contactos, `rubro` en leads_base) -- mismo mapeo que crmUnificado.ts.
export async function buscarContactosPorFiltro(filtro: FiltroLote): Promise<ContactoUnificado[] | { error: string }> {
  const {
    categoria = "",
    estadoCrm = "",
    rubros = [],
    tier = "",
    activo = "",
    mailEnviado = "",
    whatsappEnviado = "",
    llamadaRealizada = "",
    busqueda = "",
    baseId = "",
  } = filtro;
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
    if (mailEnviado) query = query.eq("mail_enviado", mailEnviado === "si");
    if (whatsappEnviado) query = query.eq("whatsapp_enviado", whatsappEnviado === "si");
    if (llamadaRealizada) query = query.eq("llamada_realizada", llamadaRealizada === "si");
    if (busqueda) query = query.or(`razon_social.ilike.%${busqueda}%,nombre_comercial.ilike.%${busqueda}%`);
    if (baseId) query = query.eq("base_id", baseId);

    const { data, error } = await query;
    if (error) return { error: `contactos: ${error.message}` };
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
    if (mailEnviado) query = query.eq("mail_enviado", mailEnviado === "si");
    if (whatsappEnviado) query = query.eq("whatsapp_enviado", whatsappEnviado === "si");
    if (llamadaRealizada) query = query.eq("llamada_realizada", llamadaRealizada === "si");
    if (busqueda) query = query.ilike("nombre", `%${busqueda}%`);
    if (baseId) query = query.eq("base_id", baseId);

    const { data, error } = await query;
    if (error) return { error: `leads_base: ${error.message}` };
    tracking.push(...data);
    if (data.length < TAMANO_PAGINA) break;
  }

  return [...contactos.map(unificarDesdeContactos), ...tracking.map(unificarDesdeTracking)];
}
