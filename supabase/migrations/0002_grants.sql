-- Las tablas nuevas no heredaron el grant a service_role (el acceso server-only
-- de las API routes usa esa key). Sin este grant, RLS habilitado + sin policies
-- bloquea incluso al service role a nivel de permisos de tabla.
grant select, insert, update, delete on mensajes_predefinidos to service_role;
grant select, insert, update, delete on contactos to service_role;
grant select, insert, update, delete on interacciones to service_role;
grant select, insert, update, delete on acciones to service_role;
