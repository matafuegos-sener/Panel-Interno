-- Uniformar el esquema de contactos/leads_base: cada contacto tiene que
-- soportar todos los campos exista o no el dato, sin importar de qué tabla
-- vino (ver conversación 2026-08-05). Todo aditivo y nullable -- ninguna fila
-- existente se toca, `contactos` hoy está vacía (toda la base real vive en
-- `leads_base`, ver comentario de 0005_crm_unificado.sql).

-- Le faltaban a "contactos" (ya las tiene "leads_base"):
alter table contactos add column ciudad text;
alter table contactos add column direccion text;
alter table contactos add column whatsapp text;
alter table contactos add column website text;
alter table contactos add column red_social text;
alter table contactos add column rating numeric;
alter table contactos add column reviews integer;
alter table contactos add column price_level text;
alter table contactos add column business_status text;
alter table contactos add column maps_url text;
alter table contactos add column matricula text;
alter table contactos add column fecha_inscripcion text;
alter table contactos add column oneroso text;
alter table contactos add column sanciones text;
alter table contactos add column notas text;

-- Le faltaban a "leads_base" (ya las tiene "contactos"):
alter table leads_base add column contacto text;
alter table leads_base add column provincia text;
alter table leads_base add column activo boolean;
