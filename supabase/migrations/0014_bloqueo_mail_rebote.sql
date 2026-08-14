-- Bloqueo automático de casilla por rebote duro o queja de spam (ver
-- conversación 2026-08-14: "que este rebote afecte a la base, que no quede
-- posibilidad de seguir enviando mails a esa casilla"). No guardamos motivo
-- ni categoría de rebote -- alcanza con el booleano, la decisión de si
-- bloquea o no ya la toma el webhook antes de escribir acá (Permanent o
-- queja bloquean, Transient no, porque puede resolverse solo).
alter table contactos
  add column mail_bloqueado boolean not null default false,
  add column mail_bloqueado_en timestamptz;

alter table leads_base
  add column mail_bloqueado boolean not null default false,
  add column mail_bloqueado_en timestamptz;
