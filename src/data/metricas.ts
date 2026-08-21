// Payload que arma /api/admin/metricas y consume MetricasView -- y los
// prettificadores de los valores crudos que devuelve GA4 (siempre en
// inglés). Mismo criterio que FUENTE_LABEL/CATEGORIA_LABEL en crm.ts: un
// mapa fijo con fallback al valor crudo si aparece uno que no está
// contemplado, nunca "Desconocido" a secas.

export interface SerieDia {
  fecha: string;
  usuarios: number;
}

export interface TopPagina {
  pagina: string;
  vistas: number;
}

export interface Canal {
  canal: string;
  sesiones: number;
}

export interface Ciudad {
  ciudad: string;
  usuarios: number;
}

export interface Dispositivo {
  dispositivo: string;
  sesiones: number;
}

export interface Conversion {
  evento: string;
  cantidad: number;
}

export interface MetricasPayload {
  rango: { dias: number; desde: string; hasta: string };
  enVivo: { usuariosActivos: number };
  kpis: {
    usuarios: number;
    sesiones: number;
    vistas: number;
    duracionMediaSeg: number;
    tasaInteraccionPct: number;
  };
  serieDiaria: SerieDia[];
  topPaginas: TopPagina[];
  canales: Canal[];
  ciudades: Ciudad[];
  dispositivos: Dispositivo[];
  conversiones: Conversion[];
}

export const CANAL_LABEL: Record<string, string> = {
  "Direct": "Directo",
  "Organic Search": "Búsqueda orgánica",
  "Paid Search": "Búsqueda paga",
  "Organic Social": "Redes sociales",
  "Paid Social": "Redes sociales (pago)",
  "Email": "Email",
  "Referral": "Referidos",
  "Affiliates": "Afiliados",
  "Display": "Display",
  "Paid Other": "Otro (pago)",
  "Organic Video": "Video orgánico",
  "Paid Video": "Video (pago)",
  "Cross-network": "Multired",
  "SMS": "SMS",
  "Audio": "Audio",
  "Mobile Push Notifications": "Notificaciones push",
  "Unassigned": "Sin asignar",
};

export const DISPOSITIVO_LABEL: Record<string, string> = {
  desktop: "Escritorio",
  mobile: "Celular",
  tablet: "Tablet",
  "smart tv": "Smart TV",
};

export const EVENTO_LABEL: Record<string, string> = {
  whatsapp_click: "Clic a WhatsApp",
  presupuesto_enviado: "Presupuesto enviado",
};
