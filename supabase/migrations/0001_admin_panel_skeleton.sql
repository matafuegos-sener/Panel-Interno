-- Esqueleto del panel admin (portado de la estructura de Electroning, sin datos).
-- mensajes_predefinidos: catalogo de plantillas de WhatsApp/mail, vacio -- se
-- carga desde el panel con "+ Nuevo mensaje".
create table mensajes_predefinidos (
  id uuid primary key default gen_random_uuid(),
  canal text not null check (canal in ('mail', 'whatsapp')),
  titulo text not null,
  rubro text not null,
  asunto text,
  cuerpo text not null,
  created_at timestamptz not null default now()
);

alter table mensajes_predefinidos enable row level security;
create index idx_mensajes_predefinidos_canal on mensajes_predefinidos (canal);

-- contactos / interacciones / acciones: esqueleto del CRM, vacio -- queda listo
-- para la base propia que se va a cargar despues. Sin RLS con policies porque
-- el acceso es exclusivamente server-side (service role) desde las API routes
-- de Next.js, nunca desde el cliente con la anon key.
create table contactos (
  id uuid primary key default gen_random_uuid(),
  razon_social text,
  nombre_comercial text,
  tipo_perfil text,
  provincia text,
  contacto text,
  telefono text,
  mail_1 text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table contactos enable row level security;
create index idx_contactos_tipo_perfil on contactos (tipo_perfil);
create index idx_contactos_provincia on contactos (provincia);

create table interacciones (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references contactos(id) on delete cascade,
  tipo text not null,
  detalle text not null,
  registrado_por text not null,
  fecha timestamptz not null default now()
);

alter table interacciones enable row level security;
create index idx_interacciones_contacto on interacciones (contacto_id);

create table acciones (
  id uuid primary key default gen_random_uuid(),
  contacto_id uuid not null references contactos(id) on delete cascade,
  interaccion_id uuid references interacciones(id) on delete set null,
  descripcion text not null,
  fecha_ejecucion date not null,
  completada boolean not null default false,
  registrado_por text not null,
  created_at timestamptz not null default now()
);

alter table acciones enable row level security;
create index idx_acciones_contacto on acciones (contacto_id);
create index idx_acciones_pendientes on acciones (contacto_id, completada);
