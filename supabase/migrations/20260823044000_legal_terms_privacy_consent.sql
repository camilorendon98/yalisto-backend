create table if not exists legal_documents (
  id uuid primary key default gen_random_uuid(), codigo text not null, version text not null,
  jurisdiccion text not null default 'CO', titulo text not null, resumen text,
  contenido_markdown text not null, obligatorio boolean not null default true,
  sensible boolean not null default false, vigente boolean not null default true,
  vigencia_desde timestamptz not null default now(), creado_en timestamptz not null default now(),
  unique(codigo,version,jurisdiccion)
);

create table if not exists consentimientos_usuario (
  id uuid primary key default gen_random_uuid(), usuario_id uuid not null references usuarios(id) on delete cascade,
  documento_id uuid not null references legal_documents(id) on delete restrict, aceptado boolean not null,
  metodo text not null default 'checkbox_app', version_app text, plataforma text, locale text,
  evidencia jsonb not null default '{}'::jsonb, aceptado_en timestamptz not null default now(),
  revocado_en timestamptz, creado_en timestamptz not null default now()
);

create table if not exists solicitudes_derechos_datos (
  id uuid primary key default gen_random_uuid(), usuario_id uuid references usuarios(id) on delete set null,
  correo text, tipo text not null check (tipo in ('acceso','actualizacion','rectificacion','supresion','revocatoria','consulta_uso','portabilidad','otro')),
  detalle text, estado text not null default 'recibida' check (estado in ('recibida','en_revision','resuelta','rechazada')),
  respuesta text, creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now(), resuelto_en timestamptz
);

create index if not exists consentimientos_usuario_idx on consentimientos_usuario(usuario_id,aceptado_en desc);
create index if not exists legal_documents_vigentes_idx on legal_documents(jurisdiccion,vigente,codigo);
alter table legal_documents enable row level security;
alter table consentimientos_usuario enable row level security;
alter table solicitudes_derechos_datos enable row level security;

-- Los textos legales vigentes se versionan en la base productiva. La versión inicial CO 1.0.0
-- cubre Términos, Privacidad, autorización general y autorización opcional de datos sensibles,
-- con referencias a Constitución art. 15, Ley 1581/2012, Decreto 1074/2015, Ley 527/1999,
-- Ley 1480/2011 y evaluación de Ley 1266/2008 cuando corresponda.
