import {
  TablaOrigen,
  Contacto,
  CATEGORIA_PROSPECTO_CERO,
  CATEGORIA_PROSPECTO_INTERES,
  CATEGORIA_CLIENTE_ACTIVO,
  CATEGORIA_CLIENTE_VENCIDO,
} from "./crm";
import { LeadBase } from "./leadsBase";

export type { TablaOrigen };

export const CATEGORIA_LABEL: Record<string, string> = {
  [CATEGORIA_PROSPECTO_CERO]: "Prospecto Cero",
  [CATEGORIA_PROSPECTO_INTERES]: "Prospecto Interés",
  [CATEGORIA_CLIENTE_ACTIVO]: "Cliente activo",
  [CATEGORIA_CLIENTE_VENCIDO]: "Cliente vencido",
};

// Un cliente_activo cuya vigencia ya pasó se muestra como vencido sin
// reescribir la base -- no hay cron en este proyecto (0010_vigencia_activo.sql).
// Comparación de string ISO, no Date -- ver bug de timezone en CrmView.tsx.
export function categoriaVisible(categoria: string, vigenciaHasta: string | null, hoyISO: string): string {
  if (categoria === CATEGORIA_CLIENTE_ACTIVO && vigenciaHasta && vigenciaHasta < hoyISO) {
    return CATEGORIA_CLIENTE_VENCIDO;
  }
  return categoria;
}

// Segundo eje, independiente de `categoria` -- seguimiento comercial del
// CRM. Ver TIPO_A_ESTADO_CRM en crm.ts: nunca lo toca un envío masivo, solo
// se mueve registrando una interacción de este tipo (o cargando una próxima
// acción, para "llamar_luego"). null = sin seguimiento comercial cargado.
export const ESTADO_CRM_LABEL: Record<string, string> = {
  llamar_luego: "Llamar luego",
  presupuesto_pendiente: "Presupuesto pedido",
  presupuesto_enviado: "Presupuesto enviado",
  pedido_entregado: "Pedido entregado",
  problema: "Problema",
};

// Hay una sola base de contactos -- no "Base 1 / Base 2". `contactos` y
// `leads_base` son dos tablas de Supabase por motivos técnicos, pero acá se
// combinan en una sola lista. Todo contacto es "contacto" desde el
// principio, en principio frío -- no se usa la palabra "lead".
export interface ContactoUnificado {
  id: string;
  tabla: TablaOrigen; // plomería interna, nunca se muestra
  nombre: string;
  rubro: string | null;
  tier: string | null;
  fuente: string | null; // de dónde se scrapeó -- informativo, no es un filtro central
  categoria: string; // frio / contactado_mail / contactado_whatsapp / ... -- esto sí es el filtro real
  categoriaFecha: string | null; // cuándo se llegó a esta categoría (todos los caminos la actualizan)
  estadoCrm: string | null; // llamar_luego / presupuesto_pendiente / ... -- eje independiente, ver ESTADO_CRM_LABEL
  estadoCrmFecha: string | null;
  telefono: string | null;
  email: string | null;
  personaContacto: string | null; // persona que atiende -- uniformado en las dos tablas (0006)
  activo: boolean | null; // null = todavía no se cargó este dato para ese contacto
  vigenciaHasta: string | null; // matafuego vendido -- vigencia de 1 año desde `estado_crm_actualizado_en` de "pedido_entregado" (0010)
  whatsappEnviado: boolean;
  whatsappSinWa: boolean;
  mailEnviado: boolean;
  // Solo viene poblado cuando el lote sale de un atajo (ver AtajoCrm más
  // abajo) -- la fecha de la interacción o de la acción que lo trajo, para
  // poder mostrarla en la tabla. En el filtro manual siempre es undefined.
  fechaAtajo?: string | null;
}

export function unificarDesdeContactos(c: Contacto): ContactoUnificado {
  const hoyISO = new Date().toISOString().slice(0, 10);
  return {
    id: c.id,
    tabla: "contactos",
    nombre: c.razon_social || c.nombre_comercial || "(sin nombre)",
    rubro: c.tipo_perfil,
    tier: c.tier,
    fuente: c.fuente,
    categoria: categoriaVisible(c.categoria, c.vigencia_hasta, hoyISO),
    categoriaFecha: c.categoria_actualizada_en,
    estadoCrm: c.estado_crm,
    estadoCrmFecha: c.estado_crm_actualizado_en,
    telefono: c.telefono,
    email: c.mail_1,
    personaContacto: c.contacto,
    activo: c.activo,
    vigenciaHasta: c.vigencia_hasta,
    whatsappEnviado: c.whatsapp_enviado,
    whatsappSinWa: c.whatsapp_sin_wa,
    mailEnviado: c.mail_enviado,
  };
}

export function unificarDesdeTracking(l: LeadBase): ContactoUnificado {
  const hoyISO = new Date().toISOString().slice(0, 10);
  return {
    id: l.id,
    tabla: "leads_base",
    nombre: l.nombre || "(sin nombre)",
    rubro: l.rubro,
    tier: l.tier,
    fuente: l.fuente,
    categoria: categoriaVisible(l.categoria, l.vigencia_hasta, hoyISO),
    categoriaFecha: l.categoria_actualizada_en,
    estadoCrm: l.estado_crm,
    estadoCrmFecha: l.estado_crm_actualizado_en,
    telefono: l.telefono,
    email: l.email,
    personaContacto: l.contacto,
    activo: l.activo,
    vigenciaHasta: l.vigencia_hasta,
    whatsappEnviado: l.whatsapp_enviado,
    whatsappSinWa: l.whatsapp_sin_wa,
    mailEnviado: l.mail_enviado,
  };
}

// Segmento aparte de accesos rápidos en el CRM (ver /api/admin/crm/lote) --
// nunca se combina con FiltroContactosState, uno de los dos manda.
export type AtajoCrm = "tocados_recientes" | "semana" | "acciones_pendientes";

export interface FiltroContactosState {
  categoria: string;
  estadoCrm: string;
  rubros: string[];
  tier: string;
  activo: "" | "si" | "no";
  busqueda: string;
}

export const FILTRO_VACIO: FiltroContactosState = { categoria: "", estadoCrm: "", rubros: [], tier: "", activo: "", busqueda: "" };
