alter table public.appointments
add column if not exists reschedule_requested boolean not null default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'patient'::public.user_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.prevent_patient_appointment_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'patient' then
    if old.patient_id <> auth.uid()
      or new.patient_id <> old.patient_id
      or new.doctor_id <> old.doctor_id
      or new.appointment_type <> old.appointment_type
      or new.scheduled_at <> old.scheduled_at
      or new.reason is distinct from old.reason
      or new.staff_notes is distinct from old.staff_notes
      or new.reschedule_requested is distinct from old.reschedule_requested
      or new.status <> old.status
    then
      if new.status = 'cancelled'
        and new.reschedule_requested = old.reschedule_requested
        and new.patient_id = auth.uid()
        and new.doctor_id = old.doctor_id
        and new.scheduled_at = old.scheduled_at
        and new.appointment_type = old.appointment_type
        and new.reason is not distinct from old.reason
        and new.staff_notes is not distinct from old.staff_notes
      then
        new.updated_by = auth.uid();
      elsif new.reschedule_requested is distinct from old.reschedule_requested
        and new.status = old.status
        and new.patient_id = auth.uid()
        and new.doctor_id = old.doctor_id
        and new.scheduled_at = old.scheduled_at
        and new.appointment_type = old.appointment_type
        and new.reason is not distinct from old.reason
        and new.staff_notes is not distinct from old.staff_notes
      then
        new.updated_by = auth.uid();
      else
        raise exception 'Patients may only request rescheduling or cancel their own appointment';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_patient_appointment_updates on public.appointments;
create trigger protect_patient_appointment_updates
before update on public.appointments
for each row execute function public.prevent_patient_appointment_changes();

drop policy if exists "patients update own pending appointments" on public.appointments;
create policy "patients update own pending appointments" on public.appointments
for update using (patient_id = auth.uid() and status in ('pending', 'approved'))
with check (
  patient_id = auth.uid()
  and (status in ('pending', 'approved') or status = 'cancelled')
);

-- Keep the newest clinical record when older duplicate records already exist.
-- Records without an appointment remain untouched.
with ranked_records as (
  select
    id,
    row_number() over (
      partition by appointment_id
      order by updated_at desc, created_at desc, id desc
    ) as record_rank
  from public.medical_records
  where appointment_id is not null
)
delete from public.medical_records
where id in (
  select id from ranked_records where record_rank > 1
);

create unique index if not exists medical_records_appointment_unique_idx
on public.medical_records(appointment_id)
where appointment_id is not null;

create or replace function public.record_appointment_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status or old.staff_notes is distinct from new.staff_notes then
    insert into public.appointment_status_history
      (appointment_id, status, note, changed_by)
    values
      (new.id, new.status, new.staff_notes, coalesce(new.updated_by, new.created_by, auth.uid()));
  end if;
  return new;
end;
$$;
