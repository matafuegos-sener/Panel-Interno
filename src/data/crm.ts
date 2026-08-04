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
  created_at: string;
}

export const TIPO_INTERACCION: Record<string, string> = {
  llamada: "Llamada",
  mail: "Mail",
  reunion: "Reunión",
  nota: "Nota",
  cotizacion_pedida: "Pidió cotización",
  cotizacion_enviada: "Cotización enviada",
  problema: "Problema",
};

export interface Interaccion {
  id: string;
  contacto_id: string;
  tipo: string;
  detalle: string;
  registrado_por: string;
  fecha: string;
}

export interface Accion {
  id: string;
  contacto_id: string;
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
