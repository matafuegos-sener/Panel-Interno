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
  // Cantidad de items con resend_estado en (rebotado, quejado) -- ver
  // /api/webhooks/resend. Siempre 0 en tandas de WhatsApp (no tienen
  // resend_id). Se calcula en el endpoint de lista, no viene de una
  // columna propia en tandas_envio.
  conProblemas: number;
}

export type ResendEstado = "enviado" | "entregado" | "rebotado" | "quejado";

export interface ItemTandaEnvio {
  id: string;
  contactoId: string;
  tabla: string;
  nombre: string;
  orden: number;
  estado: "pendiente" | "enviado" | "fallido";
  motivo: string | null;
  resendEstado: ResendEstado;
}

export interface DetalleTanda {
  tanda: TandaEnvio;
  items: ItemTandaEnvio[];
}
