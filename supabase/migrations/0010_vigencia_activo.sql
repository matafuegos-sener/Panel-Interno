-- Los matafuegos tienen 1 año de vigencia desde la venta. Pedido 2026-08-05:
-- al registrar la interacción "pedido_entregado" el contacto pasa a activo
-- solo (mismo criterio que categoria/estado_crm -- nunca a mano) durante ese
-- año, y se agenda un recontacto automático a los 11 meses para ofrecer la
-- recarga antes de que venza.
--
-- `vigencia_hasta` es la fecha de corte real -- el filtro Activo/Inactivo la
-- usa en vez de depender de un cron que apague `activo` solo (no hay
-- infraestructura de cron en este proyecto): "activo" es verdadero mientras
-- `vigencia_hasta` no haya pasado, evaluado en cada consulta, así que nunca
-- queda vencido en silencio esperando un job que lo actualice.
alter table contactos add column vigencia_hasta date;
alter table leads_base add column vigencia_hasta date;
