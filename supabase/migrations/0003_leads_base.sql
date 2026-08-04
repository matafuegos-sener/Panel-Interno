-- leads_base: base de prospección trackeada el 2026-08-03 (~9.544 filas,
-- ver docs/informe-base-de-leads-2026-08-03.md en la raíz del proyecto).
-- Unión de tres esquemas de origen distintos (Google Maps, registro oficial
-- de administradores de consorcios GCBA, semilla manual) -- por eso hay
-- columnas que solo aplican a una fuente puntual (matricula/oneroso/sanciones
-- son propias del registro oficial de consorcios). Separada de `contactos`
-- a propósito: `contactos` es la base propia de outreach/CRM del cliente,
-- `leads_base` es el universo crudo de prospección para aislar y trabajar
-- por lote. Sin policies de RLS por el mismo motivo que el resto de las
-- tablas: acceso exclusivamente server-side con service role.
create table leads_base (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  rubro text,
  ciudad text,
  direccion text,
  telefono text,
  whatsapp text,
  website text,
  red_social text,
  rating numeric,
  reviews integer,
  price_level text,
  business_status text,
  maps_url text,
  matricula text,
  fecha_inscripcion text,
  oneroso text,
  sanciones text,
  tier text,
  email text,
  fuente text,
  notas text,
  created_at timestamptz not null default now()
);

alter table leads_base enable row level security;
create index idx_leads_base_rubro on leads_base (rubro);
create index idx_leads_base_tier on leads_base (tier);
create index idx_leads_base_fuente on leads_base (fuente);
