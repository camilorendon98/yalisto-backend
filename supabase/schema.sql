-- Yalisto: esquema de referencia del agente personal.
-- La base productiva se administra mediante migraciones de Supabase.
-- Tesis del producto: memoria + contexto + anticipacion + ejecucion.

create extension if not exists "pgcrypto";

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  celular text,
  ciudad text,
  correo text not null unique,
  permisos jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create table if not exists solicitudes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  texto text not null,
  categoria text not null default 'general',
  icono text not null default '📌',
  estado text not null default 'pendiente',
  titulo text,
  respuesta text,
  prioridad text not null default 'normal',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  solicitud_id uuid references solicitudes(id) on delete set null,
  rol text not null check (rol in ('user','assistant','system')),
  contenido text not null,
  creado_en timestamptz not null default now()
);

create table if not exists memoria_items (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo text not null,
  clave text,
  titulo text,
  valor jsonb not null default '{}'::jsonb,
  fuente text not null default 'usuario',
  confianza numeric(4,3) not null default 1.000,
  confirmado_por_usuario boolean not null default true,
  vigente boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  nombre text not null,
  relacion text,
  telefono text,
  correo text,
  fecha_importante date,
  notas text,
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists vehiculos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  placa text,
  marca text,
  linea text,
  modelo text,
  tipo text,
  soat_vence date,
  tecnomecanica_vence date,
  seguro_vence date,
  notas text,
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists hogares (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  nombre text not null default 'Hogar',
  direccion text,
  ciudad text,
  tipo text,
  notas text,
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists compromisos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null,
  descripcion text,
  categoria text not null default 'general',
  estado text not null default 'pendiente',
  prioridad text not null default 'normal',
  fecha_limite timestamptz,
  persona_id uuid references personas(id) on delete set null,
  vehiculo_id uuid references vehiculos(id) on delete set null,
  hogar_id uuid references hogares(id) on delete set null,
  solicitud_id uuid references solicitudes(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  resuelto_en timestamptz
);

create table if not exists recordatorios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null,
  fecha date not null,
  hora time,
  icono text not null default '🔔',
  notificado boolean not null default false,
  compromiso_id uuid references compromisos(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create table if not exists eventos_agenda (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null,
  descripcion text,
  categoria text not null default 'general',
  inicia_en timestamptz not null,
  termina_en timestamptz,
  todo_el_dia boolean not null default false,
  origen text not null default 'yalisto',
  estado text not null default 'activo',
  compromiso_id uuid references compromisos(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists archivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  nombre text not null,
  mime_type text,
  tamano bigint,
  storage_path text,
  categoria text not null default 'general',
  descripcion text,
  fecha_documento date,
  fecha_vencimiento date,
  solicitud_id uuid references solicitudes(id) on delete set null,
  compromiso_id uuid references compromisos(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  concepto text not null,
  contraparte text,
  valor numeric(16,2),
  moneda text not null default 'COP',
  vence_en date,
  estado text not null default 'pendiente',
  compromiso_id uuid references compromisos(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists acciones_agente (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  solicitud_id uuid references solicitudes(id) on delete set null,
  compromiso_id uuid references compromisos(id) on delete set null,
  tipo text not null,
  titulo text not null,
  descripcion text,
  estado text not null default 'propuesta',
  requiere_autorizacion boolean not null default true,
  autorizado_en timestamptz,
  ejecutado_en timestamptz,
  url text,
  resultado jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists preferencias (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  voz_habilitada boolean not null default true,
  manos_libres boolean not null default false,
  activacion_por_nombre boolean not null default false,
  idioma text not null default 'es-CO',
  anticipacion_dias integer not null default 7,
  resumen_diario boolean not null default true,
  hora_resumen time not null default '08:00',
  zona_horaria text not null default 'America/Bogota',
  actualizado_en timestamptz not null default now()
);
