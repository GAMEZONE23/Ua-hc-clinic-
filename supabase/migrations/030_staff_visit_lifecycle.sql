alter table public.appointments
  add column if not exists room_assignment text,
  add column if not exists checked_in_at timestamptz,
  add column if not exists consultation_started_at timestamptz,
  add column if not exists consultation_ended_at timestamptz,
  add column if not exists checked_out_at timestamptz;

alter table public.appointments
  drop constraint if exists appointments_room_assignment_length_check,
  drop constraint if exists appointments_visit_timestamp_order_check;

alter table public.appointments
  add constraint appointments_room_assignment_length_check
    check (room_assignment is null or length(btrim(room_assignment)) <= 80),
  add constraint appointments_visit_timestamp_order_check
    check (
      (consultation_started_at is null or checked_in_at is null or consultation_started_at >= checked_in_at)
      and (consultation_ended_at is null or consultation_started_at is null or consultation_ended_at >= consultation_started_at)
      and (checked_out_at is null or consultation_ended_at is null or checked_out_at >= consultation_ended_at)
    );

create or replace function public.protect_patient_visit_stage_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.patient_id
    and public.current_user_role() = 'patient'
    and row(
      new.room_assignment,
      new.checked_in_at,
      new.consultation_started_at,
      new.consultation_ended_at,
      new.checked_out_at
    ) is distinct from row(
      old.room_assignment,
      old.checked_in_at,
      old.consultation_started_at,
      old.consultation_ended_at,
      old.checked_out_at
    )
  then
    raise exception 'Only clinic staff may change visit workflow fields';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_patient_visit_stage_fields on public.appointments;
create trigger protect_patient_visit_stage_fields
before update on public.appointments
for each row execute function public.protect_patient_visit_stage_fields();

create or replace function public.stamp_appointment_visit_stages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'checked_in' then
      new.checked_in_at := coalesce(new.checked_in_at, now());
    elsif new.status = 'in_consultation' then
      new.checked_in_at := coalesce(new.checked_in_at, now());
      new.consultation_started_at := coalesce(new.consultation_started_at, now());
    elsif new.status = 'completed' then
      if new.consultation_started_at is not null then
        new.consultation_ended_at := coalesce(new.consultation_ended_at, now());
      end if;
      new.checked_out_at := coalesce(new.checked_out_at, now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_appointment_visit_stages on public.appointments;
create trigger stamp_appointment_visit_stages
before update on public.appointments
for each row execute function public.stamp_appointment_visit_stages();