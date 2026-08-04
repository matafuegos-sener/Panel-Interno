export type Canal = "mail" | "whatsapp";

export interface MensajePredefinido {
  id: string;
  canal: Canal;
  titulo: string;
  rubro: string;
  asunto: string | null;
  cuerpo: string;
  created_at: string;
}

export interface MensajeInput {
  canal: Canal;
  titulo: string;
  rubro: string;
  asunto: string | null;
  cuerpo: string;
}
