-- Mismo problema que 0002_grants.sql: leads_base no heredó el grant a
-- service_role, así que RLS habilitado + sin policies bloquea incluso al
-- service role a nivel de permisos de tabla.
grant select, insert, update, delete on leads_base to service_role;
