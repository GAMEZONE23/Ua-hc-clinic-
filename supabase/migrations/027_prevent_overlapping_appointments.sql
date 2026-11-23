create or replace function public.prevent_overlapping_appointments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_duration integer;
begin
  if new.doctor_id is null or new.status in ('cancelled', 'no_show') then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(new.doctor_id::text), 0);

  select coalesce(appointment_duration_minutes, 30)
  into new_duration
  from public.doctors
  where id = new.doctor_id;

  new_duration := coalesce(new_duration, 30);

  if exists (
    select 1
    from public.appointments existing
    left join public.doctors existing_doctor on existing_doctor.id = existing.doctor_id
    where existing.doctor_id = new.doctor_id
      and existing.id is distinct from new.id
      and existing.status not in ('cancelled', 'no_show')
      and existing.scheduled_at < new.scheduled_at + make_interval(mins => new_duration)
      and existing.scheduled_at + make_interval(
        mins => coalesce(existing_doctor.appointment_duration_minutes, 30)
      ) > new.scheduled_at
  ) then
    raise exception 'This time overlaps another appointment for this provider. Please choose another time.'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_overlapping_appointments on public.appointments;
create trigger prevent_overlapping_appointments
before insert or update of doctor_id, scheduled_at, status on public.appointments
for each row execute function public.prevent_overlapping_appointments();