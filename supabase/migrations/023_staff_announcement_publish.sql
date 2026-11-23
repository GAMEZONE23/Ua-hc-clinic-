drop policy if exists "staff publish announcements" on public.announcements;
create policy "staff publish announcements" on public.announcements
for insert to authenticated
with check (public.current_user_role() = 'staff' and created_by = auth.uid());
