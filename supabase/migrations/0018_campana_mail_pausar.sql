-- Agrega el estado 'pausada' a campanas_mail. Antes solo existía
-- activa/completada/cancelada -- "cancelada" era terminal (no se podía
-- retomar), así que la única forma de frenarla temporalmente era cancelarla
-- y perder el registro de progreso. Ahora: pausar/reanudar alternan entre
-- 'activa' y 'pausada' sin tocar total_enviados ni el filtro guardado;
-- 'cancelada' (frenar) sigue siendo terminal. El cron (mail-diario/route.ts)
-- ya filtra por estado = 'activa', así que una campaña 'pausada' se salta
-- sola sin que haga falta tocar ese código.
alter table campanas_mail drop constraint campanas_mail_estado_check;
alter table campanas_mail add constraint campanas_mail_estado_check
  check (estado in ('activa', 'pausada', 'completada', 'cancelada'));
