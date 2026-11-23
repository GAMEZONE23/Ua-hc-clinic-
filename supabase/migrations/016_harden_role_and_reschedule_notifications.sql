create or replace function public.prevent_profile_privilege_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id and public.current_user_role() <> 'admin' then
    if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
      raise exception 'Only administrators may change account roles or activation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_profile_privilege_changes on public.profiles;
create trigger prevent_profile_privilege_changes
before update on public.profiles
for each row execute function public.prevent_profile_privilege_changes();

create or replace function public.create_appointment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  doctor_name text;
  patient_name text;
  status_message text;
begin
  select full_name into patient_name from public.profiles where id = new.patient_id;
  select full_name into doctor_name from public.doctors where id = new.doctor_id;

  if tg_op = 'INSERT' then
    insert into public.notifications
      (recipient_id, appointment_id, notification_type, title, message)
    values
      (new.patient_id, new.id, 'appointment_submitted', 'Appointment request submitted',
       format('Your request with %s is waiting for clinic review.', coalesce(doctor_name, 'the clinic')))
    on conflict do nothing;
  elsif old.reschedule_requested is distinct from new.reschedule_requested
    and new.reschedule_requested then
    insert into public.notifications
      (recipient_id, appointment_id, notification_type, title, message)
    select profiles.id, new.id, 'reschedule_requested', 'Reschedule requested',
      format('%s requested a new appointment time.', coalesce(patient_name, 'A patient'))
    from public.profiles
    where profiles.role in ('staff', 'admin') and profiles.is_active
    on conflict do nothing;
  elsif old.status is distinct from new.status then
    status_message := case new.status
      when 'approved' then format('Your appointment with %s has been approved.', coalesce(doctor_name, 'the clinic'))
      when 'rescheduled' then 'The clinic requested a new time for your appointment.'
      when 'cancelled' then 'Your appointment was cancelled.'
      when 'completed' then 'Your clinic visit has been marked completed.'
      when 'no_show' then 'Your appointment was marked no-show.'
      else format('Your appointment status is now %s.', replace(new.status::text, '_', ' '))
    end;
    insert into public.notifications
      (recipient_id, appointment_id, notification_type, title, message)
    values (new.patient_id, new.id, 'appointment_status', 'Appointment updated', status_message)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists appointment_notifications on public.appointments;
create trigger appointment_notifications
after insert or update of status, reschedule_requested on public.appointments
for each row execute function public.create_appointment_notifications();
