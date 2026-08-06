-- `categoria` y `estado_crm` (0008) cambian de valor en varios lugares
-- (interacción manual, envío masivo de mail, marcar WhatsApp enviado) pero
-- ninguno queda con fecha propia -- solo se puede saber "cuándo" buceando el
-- historial de `interacciones`, que ni siquiera existe para los cambios que
-- vienen de un envío masivo (esos no generan interacción, solo tocan la fila
-- del contacto directo). Pedido explícito 2026-08-05: si un contacto fue
-- contactado por mail, tiene que poder verse en qué fecha, sin adivinar.
alter table contactos add column categoria_actualizada_en timestamptz;
alter table contactos add column estado_crm_actualizado_en timestamptz;
alter table leads_base add column categoria_actualizada_en timestamptz;
alter table leads_base add column estado_crm_actualizado_en timestamptz;
