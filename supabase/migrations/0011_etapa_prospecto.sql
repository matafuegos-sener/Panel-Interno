-- 0011_etapa_prospecto.sql
-- Unifica "categoria" en una etapa clara del contacto, sin inglés y sin
-- distinguir por canal (acuerdo 2026-08-08): prospecto_cero,
-- prospecto_interes, cliente_activo. "cliente_vencido" NO se guarda acá --
-- se calcula al leer comparando cliente_activo contra vigencia_hasta (no
-- hay cron en este proyecto, ver 0010_vigencia_activo.sql). También se
-- prepara la columna del futuro tilde de pesca por llamada (vacía, sin
-- consumidor todavía).

-- Orden importa: cliente_activo primero (sin importar la categoria vieja
-- que tuviera), y recien despues se renombran frio/contactado_* -- así una
-- fila que ya es cliente activo pero todavía tenía categoria='frio' (podía
-- pasar: nunca se escribía un valor de cliente en categoria hasta ahora)
-- no queda mal migrada a prospecto.
update contactos set categoria = 'cliente_activo' where activo = true;
update contactos set categoria = 'prospecto_cero' where categoria = 'frio';
update contactos set categoria = 'prospecto_interes' where categoria in ('contactado_mail', 'contactado_whatsapp', 'contactado_llamada', 'contactado_reunion');

update leads_base set categoria = 'cliente_activo' where activo = true;
update leads_base set categoria = 'prospecto_cero' where categoria = 'frio';
update leads_base set categoria = 'prospecto_interes' where categoria in ('contactado_mail', 'contactado_whatsapp', 'contactado_llamada', 'contactado_reunion');

alter table contactos add column if not exists llamada_realizada boolean not null default false;
alter table contactos add column if not exists llamada_realizada_en timestamptz;
alter table leads_base add column if not exists llamada_realizada boolean not null default false;
alter table leads_base add column if not exists llamada_realizada_en timestamptz;
