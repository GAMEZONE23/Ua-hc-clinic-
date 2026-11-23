alter table public.appointments
  add column if not exists reschedule_requested boolean not null default false;
