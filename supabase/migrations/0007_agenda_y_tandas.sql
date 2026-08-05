-- Agenda + persistencia de tandas de envío (mail/WhatsApp). Ver conversación
-- 2026-08-05: la agenda tiene que mostrar en vivo los envíos que están
-- corriendo, y hoy no existe ningún registro de "esta tanda existe" -- el
-- mail se manda en un loop síncrono sin persistir nada en el camino, y la
-- tanda de WhatsApp viaja entera por querystring. Estas tres tablas son la
-- base para las dos cosas.

-- tandas_envio / tandas_envio_items: una fila por tanda de mail o WhatsApp,
-- con su progreso item por item. El mail actualiza cada item dentro del
-- mismo loop que ya existe (el request sigue siendo síncrono, solo ahora
-- escribe progreso mientras corre, así un poll de otra pestaña lo ve avanzar
-- en vivo). El WhatsApp la persiste al abrir la tanda en vez de solo pasarla
-- por URL, y cada checkbox de "Enviado"/"Sin WhatsApp" en /whatsapp-tanda
-- actualiza su item -- cuando no quedan pendientes, la tanda pasa sola a
-- completada.
create table tandas_envio (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('mail', 'whatsapp')),
  estado text not null default 'en_curso' check (estado in ('en_curso', 'completado')),
  total integer not null,
  enviados integer not null default 0,
  fallidos integer not null default 0,
  asunto text,
  plantilla_id uuid references mensajes_predefinidos(id) on delete set null,
  creado_en timestamptz not null default now(),
  completado_en timestamptz
);

alter table tandas_envio enable row level security;
create index idx_tandas_envio_estado on tandas_envio (estado);

create table tandas_envio_items (
  id uuid primary key default gen_random_uuid(),
  tanda_id uuid not null references tandas_envio(id) on delete cascade,
  contacto_id uuid not null,
  tabla_origen text not null check (tabla_origen in ('contactos', 'leads_base')),
  nombre text not null,
  orden integer not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'fallido')),
  motivo text
);

alter table tandas_envio_items enable row level security;
create index idx_tandas_envio_items_tanda on tandas_envio_items (tanda_id);

-- agenda_eventos: lo que se carga a mano desde el panel de Agenda (llamada
-- suelta, reunión, tarea, recordatorio). Lo automático (seguimientos que ya
-- se generan al registrar una interacción en el CRM) sigue viviendo en
-- `acciones` -- no se duplica acá, la vista de Agenda lee las dos tablas
-- juntas. `contacto_id`/`tabla_origen` son opcionales porque un evento de
-- agenda no siempre está atado a un contacto (ej. una tarea interna).
create table agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid,
  tabla_origen text check (tabla_origen in ('contactos', 'leads_base')),
  tipo text not null check (tipo in ('llamada', 'reunion', 'tarea', 'recordatorio')),
  nota text not null,
  fecha date not null,
  hora time,
  duracion_minutos integer,
  completada boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint agenda_eventos_contacto_consistente check ((contacto_id is null) = (tabla_origen is null))
);

alter table agenda_eventos enable row level security;
create index idx_agenda_eventos_fecha on agenda_eventos (fecha);

-- Mismo problema que 0002_grants.sql / 0004_leads_base_grants.sql: las
-- tablas nuevas no heredan el grant a service_role, así que RLS habilitado +
-- sin policies bloquea incluso al service role a nivel de permisos de tabla.
grant select, insert, update, delete on tandas_envio to service_role;
grant select, insert, update, delete on tandas_envio_items to service_role;
grant select, insert, update, delete on agenda_eventos to service_role;
