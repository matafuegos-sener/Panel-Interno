export interface LeadBase {
  id: string;
  nombre: string | null;
  rubro: string | null;
  // Uniformadas con contactos en 0006_uniformar_base.sql -- mismo campo,
  // exista o no el dato según de dónde vino el contacto.
  contacto: string | null;
  provincia: string | null;
  activo: boolean | null;
  vigencia_hasta: string | null;
  ciudad: string | null;
  direccion: string | null;
  telefono: string | null;
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
  tier: string | null;
  email: string | null;
  fuente: string | null;
  categoria: string;
  categoria_actualizada_en: string | null;
  estado_crm: string | null;
  estado_crm_actualizado_en: string | null;
  notas: string | null;
  whatsapp_enviado: boolean;
  whatsapp_enviado_en: string | null;
  llamada_realizada: boolean;
  llamada_realizada_en: string | null;
  whatsapp_sin_wa: boolean;
  mail_enviado: boolean;
  mail_enviado_en: string | null;
  mail_bloqueado: boolean;
  mail_bloqueado_en: string | null;
  created_at: string;
}
