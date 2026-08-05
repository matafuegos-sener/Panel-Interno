// Tandas de envío (mail/WhatsApp) persistidas -- ver
// panel-interno/supabase/migrations/0007_agenda_y_tandas.sql. El mail las
// actualiza dentro de su propio loop síncrono (/api/admin/mail/enviar); el
// WhatsApp las actualiza a mano, item por item, desde /whatsapp-tanda.
export interface TandaEnvio {
  id: string;
  tipo: "mail" | "whatsapp";
  estado: "en_curso" | "completado";
  total: number;
  enviados: number;
  fallidos: number;
  asunto: string | null;
  plantillaTitulo: string | null;
  creadoEn: string;
  completadoEn: string | null;
}

export interface ItemTandaEnvio {
  id: string;
  contactoId: string;
  tabla: string;
  nombre: string;
  orden: number;
  estado: "pendiente" | "enviado" | "fallido";
  motivo: string | null;
}

export interface DetalleTanda {
  tanda: TandaEnvio;
  items: ItemTandaEnvio[];
}
