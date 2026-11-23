drop policy if exists "staff manage status history" on public.appointment_status_history;

create policy "staff view status history" on public.appointment_status_history
for select using (public.current_user_role() in ('staff', 'admin'));

revoke insert, update, delete
on public.appointment_status_history
from public, anon, authenticated;

drop policy if exists "staff create medical record audit" on public.medical_record_audit;

revoke insert, update, delete
on public.medical_record_audit
from public, anon, authenticated;

revoke update on public.notifications from public, anon, authenticated;
grant update (read_at) on public.notifications to authenticated;