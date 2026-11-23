drop policy if exists "users create own reminders" on public.notifications;

drop policy if exists "staff create appointment reminders" on public.notifications;
create policy "staff create appointment reminders" on public.notifications
for insert
with check (
  notification_type = 'appointment_reminder'
  and exists (
    select 1
    from public.profiles sender
    join public.appointments appointment
      on appointment.id = notifications.appointment_id
     and appointment.patient_id = notifications.recipient_id
    where sender.id = auth.uid()
      and sender.role in ('staff', 'admin')
      and sender.is_active
  )
);
