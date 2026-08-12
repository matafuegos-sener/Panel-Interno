-- Tracking real de entregabilidad + freno de ritmo. Hasta ahora
-- `tandas_envio_items` marcaba "enviado" apenas Resend aceptaba el POST,
-- sin guardar el id que Resend devuelve ni la hora exacta -- no había forma
-- de saber después si algo rebotó o fue marcado spam (ver build-log
-- 2026-08-12: 60 mails mandados en ráfaga el 2026-08-11 sin ningún dato de
-- entrega). `resend_id` permite reconciliar contra el webhook de Resend;
-- `enviado_en` (por item, no por tanda) es lo que usa el tope diario en
-- enviar/route.ts para contar cuántos se mandaron hoy.
alter table tandas_envio_items
  add column resend_id text,
  add column resend_estado text not null default 'enviado'
    check (resend_estado in ('enviado', 'entregado', 'rebotado', 'quejado')),
  add column enviado_en timestamptz;

create index idx_tandas_envio_items_resend_id on tandas_envio_items (resend_id);
create index idx_tandas_envio_items_enviado_en on tandas_envio_items (enviado_en);
