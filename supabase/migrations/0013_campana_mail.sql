-- Campaña automática de mail: permite iniciar un envío desde EnviosMailView
-- y que se complete solo, día a día, sin depender de tener la pestaña
-- abierta (ver build-log 2026-08-14). El cron diario (/api/cron/mail-diario,
-- una corrida por día -- plan Hobby de Vercel no permite más frecuencia) lee
-- la campaña activa y manda lo que el tope diario le permita ese día,
-- re-evaluando `filtro` contra la base en cada corrida (no una lista de ids
-- congelada) -- así un contacto que se marca a mano en el medio no se manda.
create table campanas_mail (
  id uuid primary key default gen_random_uuid(),
  estado text not null default 'activa' check (estado in ('activa', 'completada', 'cancelada')),
  filtro jsonb not null,
  asunto text not null,
  cuerpo text not null,
  creado_en timestamptz not null default now(),
  ultima_corrida_en timestamptz,
  total_enviados integer not null default 0
);

alter table campanas_mail enable row level security;
create index idx_campanas_mail_estado on campanas_mail (estado);

-- Mismo problema que las tablas de 0007_agenda_y_tandas.sql: sin este
-- grant, RLS habilitado + sin policies bloquea también al service role.
grant select, insert, update, delete on campanas_mail to service_role;
