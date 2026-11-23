alter table public.doctors
add column if not exists appointment_duration_minutes integer not null default 30;

alter table public.doctors
drop constraint if exists doctors_appointment_duration_check;

alter table public.doctors
add constraint doctors_appointment_duration_check
check (appointment_duration_minutes in (15, 30, 45, 60));
