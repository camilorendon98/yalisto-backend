alter table public.personas add column if not exists tipo_relacion text;
alter table public.personas add column if not exists es_contacto_emergencia boolean not null default false;
alter table public.personas add column if not exists favorito boolean not null default false;
alter table public.personas add column if not exists apodo text;
alter table public.personas add column if not exists fecha_nacimiento date;
alter table public.personas add column if not exists trato_preferido text;
create index if not exists personas_usuario_tipo_relacion_idx on public.personas(usuario_id, tipo_relacion);
