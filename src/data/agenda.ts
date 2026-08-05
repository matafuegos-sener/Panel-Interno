import { TablaOrigen } from "./crm";

// "seguimiento" es la etiqueta de lo que viene automático desde `acciones`
// (no tiene tipo propio en esa tabla, es siempre un seguimiento de CRM). Las
// otras cuatro son las que se eligen al cargar una actividad a mano.
export const TIPO_AGENDA_LABEL: Record<string, string> = {
  seguimiento: "Seguimiento CRM",
  llamada: "Llamada",
  reunion: "Reunión",
  tarea: "Tarea",
  recordatorio: "Recordatorio",
};

export type TipoAgendaManual = "llamada" | "reunion" | "tarea" | "recordatorio";

// Vista unificada de lo automático (`acciones`) y lo manual
// (`agenda_eventos`) -- la Agenda lee las dos tablas juntas, nunca por
// separado (ver /api/admin/agenda).
export interface EventoAgenda {
  id: string;
  origen: "accion" | "manual";
  tipo: string;
  nota: string;
  fecha: string; // YYYY-MM-DD
  hora: string | null; // HH:MM:SS, null = todo el día
  duracionMinutos: number | null;
  completada: boolean;
  contactoId: string | null;
  tabla: TablaOrigen | null;
  contactoNombre: string | null;
}
