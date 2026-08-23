alter table public.preferencias add column if not exists chat_fondo text not null default 'crema';
alter table public.preferencias add column if not exists interfaz text not null default 'calida';
alter table public.preferencias add column if not exists densidad text not null default 'comoda';
alter table public.preferencias add column if not exists estilo_respuesta text not null default 'equilibrado';
alter table public.preferencias add column if not exists mostrar_animo_home boolean not null default true;
alter table public.preferencias add column if not exists sombra_movil boolean not null default true;

create table if not exists public.estados_animo (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  estado text not null,
  intensidad smallint not null default 3 check (intensidad between 1 and 5),
  energia smallint not null default 3 check (energia between 1 and 5),
  nota text,
  ayuda_preferida text,
  fecha date not null default current_date,
  creado_en timestamptz not null default now()
);

create index if not exists estados_animo_usuario_fecha_idx
  on public.estados_animo(usuario_id, fecha desc, creado_en desc);

alter table public.estados_animo enable row level security;
