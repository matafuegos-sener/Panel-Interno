-- Agenda: nuevo tipo automático 'presupuesto_web', generado cuando alguien
-- completa el calculador de presupuesto en casa-sener (POST
-- /api/public/agenda/presupuesto, llamado desde
-- casa-sener/src/app/api/quote/route.ts). No viene atado a un contacto del
-- CRM -- es gente nueva que todavía no está necesariamente en
-- `contactos`/`leads_base` (matchear/crear el contacto automáticamente
-- queda fuera de alcance por ahora, ver CLAUDE.md).
alter table agenda_eventos drop constraint agenda_eventos_tipo_check;
alter table agenda_eventos add constraint agenda_eventos_tipo_check
  check (tipo in ('llamada', 'reunion', 'tarea', 'recordatorio', 'presupuesto_web'));
