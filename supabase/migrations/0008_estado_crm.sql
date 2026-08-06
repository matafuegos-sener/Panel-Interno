-- Separa dos cosas que hoy comparten un solo campo (`categoria`) y se pisan
-- entre sí: (A) por qué canal se contactó al contacto frío -- mail, WhatsApp,
-- llamado -- y (B) en qué está el seguimiento comercial del CRM -- llamar
-- luego, presupuesto pedido/enviado, pedido entregado, problema. Un envío
-- masivo de WhatsApp/mail (que solo debería tocar A) pisaba `categoria`
-- entero, borrando un estado B que ya estuviera cargado (ej: "presupuesto
-- enviado" volvía a "Contactado por WhatsApp"). `categoria` sigue siendo A,
-- sin cambios. `estado_crm` es B, nuevo, columna aparte -- así ninguno de los
-- dos lados puede pisar al otro nunca más.
alter table contactos add column estado_crm text;
alter table leads_base add column estado_crm text;
