// Discriminador puramente técnico -- qué tabla de Supabase guarda una fila
// dada. Nunca se muestra en la UI. Hay una sola base de contactos de
// negocio; esto es plomería interna para saber a qué tabla pegarle en cada
// API route.
export type TablaOrigen = "contactos" | "leads_base";

export interface Contacto {
  id: string;
  razon_social: string | null;
  nombre_comercial: string | null;
  tipo_perfil: string | null;
  provincia: string | null;
  contacto: string | null;
  telefono: string | null;
  mail_1: string | null;
  activo: boolean;
  vigencia_hasta: string | null;
  tier: string | null;
  fuente: string | null;
  categoria: string;
  categoria_actualizada_en: string | null;
  estado_crm: string | null;
  estado_crm_actualizado_en: string | null;
  whatsapp_enviado: boolean;
  whatsapp_enviado_en: string | null;
  whatsapp_sin_wa: boolean;
  llamada_realizada: boolean;
  llamada_realizada_en: string | null;
  mail_enviado: boolean;
  mail_enviado_en: string | null;
  mail_bloqueado: boolean;
  mail_bloqueado_en: string | null;
  created_at: string;
  // Uniformadas con leads_base en 0006_uniformar_base.sql -- mismo campo,
  // exista o no el dato según de dónde vino el contacto.
  ciudad: string | null;
  direccion: string | null;
  whatsapp: string | null;
  website: string | null;
  red_social: string | null;
  rating: number | null;
  reviews: number | null;
  price_level: string | null;
  business_status: string | null;
  maps_url: string | null;
  matricula: string | null;
  fecha_inscripcion: string | null;
  oneroso: string | null;
  sanciones: string | null;
  notas: string | null;
}

// Tipos de interacción que además mueven la categoría del contacto (ver
// CATEGORIA_LABEL en crmUnificado.ts) -- las demás (nota, cotización,
// pedido, problema) son seguimiento comercial (ver TIPO_A_ESTADO_CRM), no un
// canal de contacto nuevo.
export const TIPO_INTERACCION: Record<string, string> = {
  llamada: "Llamada",
  mail: "Mail",
  whatsapp: "WhatsApp",
  reunion: "Reunión",
  nota: "Nota",
  cotizacion_pedida: "Pidió cotización",
  cotizacion_enviada: "Cotización enviada",
  pedido_entregado: "Pedido entregado",
  problema: "Problema",
};

// Opciones fijas para "Acción futura" -- antes era texto libre y cada uno
// escribía lo que quería (ej: "Cotizacion" vs "Cotización"), lo que hacía
// imposible confiar en el valor guardado. `descripcion` en `acciones` sigue
// siendo texto libre (esta lista + el campo "Detalle" se concatenan al
// guardar, ver registrarInteraccion en CrmView.tsx), así que agregar una
// opción acá no pisa datos históricos.
export const ACCION_OPCIONES: string[] = [
  "Llamar",
  "Enviar cotización",
  "Coordinar visita / instalación",
  "Entregar pedido",
  "Recontactar",
];

export const CATEGORIA_PROSPECTO_CERO = "prospecto_cero";
export const CATEGORIA_PROSPECTO_INTERES = "prospecto_interes";
export const CATEGORIA_CLIENTE_ACTIVO = "cliente_activo";
export const CATEGORIA_CLIENTE_VENCIDO = "cliente_vencido";

// Cualquier interacción de CRM es contacto real por un asunto puntual, sin
// importar el canal -- eso es lo único que mueve a un prospecto de Cero a
// Interés (acuerdo 2026-08-08). Los envíos masivos (mail/enviar,
// crm/contactos/[id]/estado) nunca llaman a esta función: solo marcan su
// propio tilde de pesca. Un cliente no retrocede a prospecto por registrar
// una interacción más.
export function categoriaTrasInteraccion(categoriaActual: string): string {
  if (categoriaActual === CATEGORIA_CLIENTE_ACTIVO || categoriaActual === CATEGORIA_CLIENTE_VENCIDO) {
    return categoriaActual;
  }
  return CATEGORIA_PROSPECTO_INTERES;
}

// Segundo eje, independiente del anterior: en qué está el seguimiento
// comercial del CRM (llamar luego, presupuesto pedido/enviado, pedido
// entregado, problema). Vive en `estado_crm` (0008_estado_crm.sql), columna
// aparte de `categoria` a propósito -- así un envío masivo (que no toca
// ninguna de las dos columnas, solo su propio tilde de pesca) nunca puede
// pisar "presupuesto enviado" ni al revés.
// "llamar_luego" no sale de un tipo de interacción sino de cargar una
// próxima acción (ver interacciones/route.ts) -- si no hay un tipo más
// específico en esta tabla, cargar una acción es lo que marca "llamar luego".
export const TIPO_A_ESTADO_CRM: Partial<Record<string, string>> = {
  cotizacion_pedida: "presupuesto_pendiente",
  cotizacion_enviada: "presupuesto_enviado",
  pedido_entregado: "pedido_entregado",
  problema: "problema",
};

export interface Interaccion {
  id: string;
  contacto_id: string;
  tabla_origen: TablaOrigen;
  tipo: string;
  detalle: string;
  registrado_por: string;
  fecha: string;
}

export interface Accion {
  id: string;
  contacto_id: string;
  tabla_origen: TablaOrigen;
  interaccion_id: string | null;
  descripcion: string;
  fecha_ejecucion: string;
  completada: boolean;
  registrado_por: string;
  created_at: string;
}

export interface AccionNueva {
  descripcion: string;
  fecha_ejecucion: string;
}
