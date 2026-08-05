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
  telefono: string | null;
  email: string | null;
  personaContacto: string | null; // solo existe en la tabla "contactos" (persona que atiende)
  activo: boolean | null; // null = la tabla "leads_base" no trackea este concepto
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
    telefono: l.telefono,
    email: l.email,
    personaContacto: null,
    activo: null,
    whatsappEnviado: l.whatsapp_enviado,
    whatsappSinWa: l.whatsapp_sin_wa,
    mailEnviado: l.mail_enviado,
  };
}

export interface FiltroContactosState {
  categoria: string;
  rubros: string[];
  tier: string;
  activo: "" | "si" | "no";
  busqueda: string;
}

export const FILTRO_VACIO: FiltroContactosState = { categoria: "", rubros: [], tier: "", activo: "", busqueda: "" };
