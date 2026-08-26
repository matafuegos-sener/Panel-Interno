-- Bases: hasta ahora "leads_base" era LA base, hardcodeada, sin registro
-- propio. Esto agrega una tabla `bases` (catálogo: nombre) y una columna
-- `base_id` en `contactos` y `leads_base` -- todo contacto vive en una base
-- sí o sí, ninguno queda flotando sin dónde guardarse. Arranca nullable
-- para poder backfillear los datos existentes contra una base semilla
-- ("Base Tracking", el nombre que ya usa el panel para lo que hoy es
-- leads_base) y recién después se vuelve NOT NULL.
create table bases (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  created_at timestamptz not null default now()
);

alter table bases enable row level security;

insert into bases (nombre) values ('Base Tracking');

alter table contactos add column base_id uuid references bases(id);
alter table leads_base add column base_id uuid references bases(id);

update contactos set base_id = (select id from bases where nombre = 'Base Tracking') where base_id is null;
update leads_base set base_id = (select id from bases where nombre = 'Base Tracking') where base_id is null;

alter table contactos alter column base_id set not null;
alter table leads_base alter column base_id set not null;

create index idx_contactos_base on contactos (base_id);
create index idx_leads_base_base on leads_base (base_id);
