-- Prevent two active appointments from occupying the same doctor/time slot.
create unique index if not exists appointments_active_doctor_slot_idx
on public.appointments (doctor_id, scheduled_at)
where status not in ('cancelled', 'no_show');

-- Patients may cancel their own appointment, but cannot alter its doctor,
-- schedule, type, notes, or status to an operational staff status.
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
      or new.status <> 'cancelled'
    then
      raise exception 'Patients may only cancel their own appointments';
    end if;
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists protect_patient_appointment_updates on public.appointments;
create trigger protect_patient_appointment_updates
before update on public.appointments
for each row execute function public.prevent_patient_appointment_changes();
