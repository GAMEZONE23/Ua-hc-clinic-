create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

alter table public.audit_logs enable row level security;

drop policy if exists "admins view audit logs" on public.audit_logs;
create policy "admins view audit logs" on public.audit_logs
for select using (public.current_user_role() = 'admin');

create or replace function public.record_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_id_value uuid;
  actor_id_value uuid;
  action_value text;
  details_value jsonb;
begin
  entity_id_value := case when tg_op = 'DELETE' then old.id else new.id end;
  actor_id_value := auth.uid();
  action_value := lower(tg_op);
  details_value := jsonb_build_object(
    'table', tg_table_name,
    'operation', tg_op,
    'row', case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, details)
  values (actor_id_value, action_value, tg_table_name, entity_id_value, details_value);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists profiles_audit_log on public.profiles;
create trigger profiles_audit_log after insert or update or delete on public.profiles
for each row execute function public.record_audit_log();

drop trigger if exists doctors_audit_log on public.doctors;
create trigger doctors_audit_log after insert or update or delete on public.doctors
for each row execute function public.record_audit_log();

drop trigger if exists appointments_audit_log on public.appointments;
create trigger appointments_audit_log after insert or update or delete on public.appointments
for each row execute function public.record_audit_log();

drop trigger if exists clinic_settings_audit_log on public.clinic_settings;
create trigger clinic_settings_audit_log after insert or update or delete on public.clinic_settings
for each row execute function public.record_audit_log();
