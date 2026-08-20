-- Esquema de Yalisto para Supabase (Postgres).
-- Se pega y se corre en Supabase → SQL Editor → New query → Run.
-- Refleja exactamente los mismos datos que hoy vive en backend/data/db.json.

create extension if not exists "pgcrypto";

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  celular text,
  ciudad text,
  correo text not null unique,
  permisos jsonb not null default '{
    "notificaciones": true,
    "calendario": true,
    "microfono": true,
    "camara": true,
    "ubicacion": true,
    "contactos": true,
    "llamadas_sms": true
  }'::jsonb,
  creado_en timestamptz not null default now()
);

create table if not exists solicitudes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  texto text not null,
  categoria text not null default 'general',
  icono text not null default '📌',
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_proceso', 'resuelto')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists recordatorios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  titulo text not null,
  fecha date not null,
  icono text not null default '🔔',
  notificado boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists idx_solicitudes_usuario on solicitudes(usuario_id);
create index if not exists idx_recordatorios_usuario on recordatorios(usuario_id);
create index if not exists idx_recordatorios_fecha on recordatorios(fecha);
