-- CRM unificado: hay una sola base de contactos (hoy con 9.541 filas, todas
-- en `leads_base` -- `contactos` está vacía). `contactos` y `leads_base` son
-- dos tablas por motivos técnicos, el panel las trata como una sola cosa.
--
-- Todo contacto arranca "frío" y se va categorizando solo, a medida que se
-- lo toca: `categoria` (default 'frio') la actualizan las API routes cada
-- vez que se registra una interacción o se manda un mail/WhatsApp -- no es
-- un campo que se edite a mano.

alter table contactos add column tier text;
alter table contactos add column fuente text;
alter table contactos add column categoria text not null default 'frio';
create index idx_contactos_tier on contactos (tier);
create index idx_contactos_categoria on contactos (categoria);

alter table leads_base add column categoria text not null default 'frio';
create index idx_leads_base_categoria on leads_base (categoria);

-- tracking de envío -- necesario para la tanda de WhatsApp (no repetir a
-- quien ya se le mandó o ya contestó "no tengo WhatsApp") y para el envío
-- de mail real vía Resend (no reenviar).
alter table contactos add column whatsapp_enviado boolean not null default false;
alter table contactos add column whatsapp_enviado_en timestamptz;
alter table contactos add column whatsapp_sin_wa boolean not null default false;
alter table contactos add column mail_enviado boolean not null default false;
alter table contactos add column mail_enviado_en timestamptz;

alter table leads_base add column whatsapp_enviado boolean not null default false;
alter table leads_base add column whatsapp_enviado_en timestamptz;
alter table leads_base add column whatsapp_sin_wa boolean not null default false;
alter table leads_base add column mail_enviado boolean not null default false;
alter table leads_base add column mail_enviado_en timestamptz;

-- interacciones / acciones: hasta ahora solo podían referenciar a
-- `contactos` (FK estricta). Como el panel abre el mismo historial para una
-- fila que vive en `contactos` o en `leads_base`, el id ya no alcanza para
-- saber en qué tabla buscarla -- se agrega `tabla_origen` (puramente técnico,
-- nunca se muestra en la UI) y se saca la FK (no se puede tener una FK que
-- apunte a dos tablas distintas; la integridad queda a cargo de las API
-- routes, único punto de escritura -- ver src/lib/supabaseAdmin.ts).
alter table interacciones drop constraint if exists interacciones_contacto_id_fkey;
alter table interacciones add column tabla_origen text not null default 'contactos' check (tabla_origen in ('contactos', 'leads_base'));
create index idx_interacciones_tabla_contacto on interacciones (tabla_origen, contacto_id);

alter table acciones drop constraint if exists acciones_contacto_id_fkey;
alter table acciones add column tabla_origen text not null default 'contactos' check (tabla_origen in ('contactos', 'leads_base'));
create index idx_acciones_tabla_contacto on acciones (tabla_origen, contacto_id);
