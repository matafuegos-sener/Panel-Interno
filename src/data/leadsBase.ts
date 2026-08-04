export interface LeadBase {
  id: string;
  nombre: string | null;
  rubro: string | null;
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
  notas: string | null;
  created_at: string;
}
