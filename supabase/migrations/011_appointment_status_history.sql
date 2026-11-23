create table if not exists public.appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  status public.appointment_status not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists appointment_status_history_appointment_idx
on public.appointment_status_history(appointment_id, created_at desc);

alter table public.appointment_status_history enable row level security;

drop policy if exists "patients view own status history" on public.appointment_status_history;
create policy "patients view own status history" on public.appointment_status_history
for select using (
  exists (
    select 1 from public.appointments
    where appointments.id = appointment_status_history.appointment_id
      and appointments.patient_id = auth.uid()
  )
);

drop policy if exists "staff manage status history" on public.appointment_status_history;
create policy "staff manage status history" on public.appointment_status_history
for all using (public.current_user_role() in ('staff', 'admin'))
with check (public.current_user_role() in ('staff', 'admin'));

create or replace function public.record_appointment_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.appointment_status_history
      (appointment_id, status, note, changed_by)
    values
      (new.id, new.status, new.staff_notes, coalesce(new.updated_by, new.created_by, auth.uid()));
  end if;
  return new;
end;
$$;

drop trigger if exists appointment_status_history on public.appointments;
create trigger appointment_status_history
after insert or update of status, staff_notes on public.appointments
for each row execute function public.record_appointment_status_history();
