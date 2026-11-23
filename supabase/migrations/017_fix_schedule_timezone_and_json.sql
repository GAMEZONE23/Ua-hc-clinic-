create or replace function public.validate_appointment_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  local_date text;
  day_name text;
  clinic_schedule text;
  doctor_schedule jsonb;
  closure_dates jsonb;
  clinic_open time;
  clinic_close time;
begin
  if new.status in ('cancelled', 'no_show') then
    return new;
  end if;

  local_date := to_char(new.scheduled_at at time zone 'Asia/Manila', 'YYYY-MM-DD');
  day_name := lower(trim(to_char(new.scheduled_at at time zone 'Asia/Manila', 'Day')));
  closure_dates := coalesce(
    (select setting_value -> 'dates' from public.clinic_settings where setting_key = 'clinic_closures'),
    '[]'::jsonb
  );

  if closure_dates ? local_date then
    raise exception 'The clinic is closed on %', local_date;
  end if;

  clinic_schedule := (
    select setting_value ->> day_name
    from public.clinic_settings
    where setting_key = 'clinic_hours'
  );
  select availability -> day_name into doctor_schedule
  from public.doctors where id = new.doctor_id;

  if jsonb_typeof(doctor_schedule) = 'string' then
    clinic_schedule := doctor_schedule #>> '{}';
  elsif jsonb_typeof(doctor_schedule) = 'object' then
    clinic_schedule := concat(doctor_schedule ->> 'open', '-', doctor_schedule ->> 'close');
  end if;

  if clinic_schedule is null or position('-' in clinic_schedule) = 0 then
    raise exception 'No schedule is available for %', day_name;
  end if;

  clinic_open := split_part(clinic_schedule, '-', 1)::time;
  clinic_close := split_part(clinic_schedule, '-', 2)::time;

  if (new.scheduled_at at time zone 'Asia/Manila')::time < clinic_open
    or (new.scheduled_at at time zone 'Asia/Manila')::time >= clinic_close then
    raise exception 'The appointment is outside clinic hours';
  end if;

  return new;
end;
$$;
