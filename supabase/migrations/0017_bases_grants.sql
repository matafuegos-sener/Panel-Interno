-- Mismo problema que 0002_grants.sql y 0004_leads_base_grants.sql: `bases`
-- no heredó el grant a service_role, así que RLS habilitado + sin policies
-- bloquea incluso al service role a nivel de permisos de tabla.
grant select, insert, update, delete on bases to service_role;
