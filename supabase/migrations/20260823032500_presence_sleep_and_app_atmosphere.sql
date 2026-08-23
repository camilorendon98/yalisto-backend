alter table preferencias add column if not exists modo_descanso boolean not null default false;
alter table preferencias add column if not exists tema_app text not null default 'crema';
alter table preferencias add column if not exists hora_descanso_inicio time;
alter table preferencias add column if not exists hora_descanso_fin time;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='preferencias_tema_app_check') then
    alter table preferencias add constraint preferencias_tema_app_check
      check (tema_app in ('crema','claro','noche','salvia','cielo'));
  end if;
end $$;
