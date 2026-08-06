import { TablaOrigen, Contacto } from "./crm";
import { LeadBase } from "./leadsBase";

export type { TablaOrigen };

// Categoría real de trabajo del contacto: arranca "frio" y las API routes la
// van moviendo sola a medida que se lo toca (ver POST interacciones, PATCH
// estado y mail/enviar) -- nunca se edita a mano. Si aparece una categoría
// nueva que no está acá, se muestra el valor crudo.
export const CATEGORIA_LABEL: Record<string, string> = {
  frio: "Frío",
  contactado_mail: "Contactado por mail",
  contactado_whatsapp: "Contactado por WhatsApp",
  contactado_llamada: "Contactado por llamada",
  contactado_reunion: "Reunión hecha",
};

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
  whatsappEnviado: boolean;
  whatsappSinWa: boolean;
  mailEnviado: boolean;
}

export function unificarDesdeContactos(c: Contacto): ContactoUnificado {
  return {
    id: c.id,
    tabla: "contactos",
    nombre: c.razon_social || c.nombre_comercial || "(sin nombre)",
    rubro: c.tipo_perfil,
    tier: c.tier,
    fuente: c.fuente,
    categoria: c.categoria,
    estadoCrm: c.estado_crm,
    telefono: c.telefono,
    email: c.mail_1,
    personaContacto: c.contacto,
    activo: c.activo,
    whatsappEnviado: c.whatsapp_enviado,
    whatsappSinWa: c.whatsapp_sin_wa,
    mailEnviado: c.mail_enviado,
  };
}

export function unificarDesdeTracking(l: LeadBase): ContactoUnificado {
  return {
    id: l.id,
    tabla: "leads_base",
    nombre: l.nombre || "(sin nombre)",
    rubro: l.rubro,
    tier: l.tier,
    fuente: l.fuente,
    categoria: l.categoria,
    estadoCrm: l.estado_crm,
    telefono: l.telefono,
    email: l.email,
    personaContacto: l.contacto,
    activo: l.activo,
    whatsappEnviado: l.whatsapp_enviado,
    whatsappSinWa: l.whatsapp_sin_wa,
    mailEnviado: l.mail_enviado,
  };
}

export interface FiltroContactosState {
  categoria: string;
  estadoCrm: string;
  rubros: string[];
  tier: string;
  activo: "" | "si" | "no";
  busqueda: string;
}

export const FILTRO_VACIO: FiltroContactosState = { categoria: "", estadoCrm: "", rubros: [], tier: "", activo: "", busqueda: "" };
