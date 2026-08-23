alter table if exists preferencias
  add column if not exists proveedor_voz text not null default 'natural',
  add column if not exists voz_preset text not null default 'alma',
  add column if not exists voz_velocidad numeric(4,2) not null default 1.00,
  add column if not exists voz_expresividad text not null default 'natural',
  add column if not exists voz_auto_estado boolean not null default true;

alter table if exists preferencias drop constraint if exists preferencias_proveedor_voz_check;
alter table if exists preferencias add constraint preferencias_proveedor_voz_check check (proveedor_voz in ('natural','dispositivo'));
alter table if exists preferencias drop constraint if exists preferencias_voz_expresividad_check;
alter table if exists preferencias add constraint preferencias_voz_expresividad_check check (voz_expresividad in ('suave','natural','expresiva','energico','sereno'));
alter table if exists preferencias drop constraint if exists preferencias_voz_velocidad_check;
alter table if exists preferencias add constraint preferencias_voz_velocidad_check check (voz_velocidad between 0.75 and 1.25);
