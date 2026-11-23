create extension if not exists "pgcrypto";

do $$
begin
  create type public.user_role as enum ('patient', 'staff', 'admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.appointment_status as enum ('pending', 'approved', 'rescheduled', 'completed', 'cancelled', 'no_show');
exception
  when duplicate_object then null;
end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'patient',
  full_name text not null,
  email text not null,
  phone text,
  address text,
  blood_type text,
  allergies text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  specialty text not null,
  email text,
  phone text,
  availability jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete restrict,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  appointment_type text not null,
  scheduled_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  reason text,
  staff_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medical_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  visit_date timestamptz not null default now(),
  chief_complaint text,
  diagnosis text,
  treatment text,
  prescriptions text,
  follow_up_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique,
  setting_value jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index appointments_patient_id_idx on public.appointments(patient_id);
create index appointments_doctor_id_idx on public.appointments(doctor_id);
create index appointments_schedule_idx on public.appointments(scheduled_at);
create index appointments_status_idx on public.appointments(status);
create index profiles_name_search_idx on public.profiles using gin (to_tsvector('simple', full_name));
create index profiles_email_idx on public.profiles(lower(email));
create index medical_records_patient_id_idx on public.medical_records(patient_id);
create index medical_records_visit_date_idx on public.medical_records(visit_date desc);

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger doctors_set_updated_at before update on public.doctors
for each row execute function public.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments
for each row execute function public.set_updated_at();
create trigger medical_records_set_updated_at before update on public.medical_records
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.doctors enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.clinic_settings enable row level security;

create policy "users view own profile" on public.profiles
for select using (id = auth.uid());
create policy "staff view patient profiles" on public.profiles
for select using (public.current_user_role() in ('staff', 'admin'));
create policy "users update own profile" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admins manage profiles" on public.profiles
for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "authenticated users view active doctors" on public.doctors
for select to authenticated using (is_active = true or public.current_user_role() in ('staff', 'admin'));
create policy "admins manage doctors" on public.doctors
for all using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

create policy "patients view own appointments" on public.appointments
for select using (patient_id = auth.uid());
create policy "patients create own appointments" on public.appointments
for insert with check (patient_id = auth.uid());
create policy "patients update own pending appointments" on public.appointments
for update using (patient_id = auth.uid() and status in ('pending', 'approved'))
with check (patient_id = auth.uid());
create policy "staff manage appointments" on public.appointments
for all using (public.current_user_role() in ('staff', 'admin'))
with check (public.current_user_role() in ('staff', 'admin'));

create policy "patients view own medical records" on public.medical_records
for select using (patient_id = auth.uid());
create policy "staff manage medical records" on public.medical_records
for all using (public.current_user_role() in ('staff', 'admin'))
with check (public.current_user_role() in ('staff', 'admin'));

create policy "authenticated users view clinic settings" on public.clinic_settings
for select to authenticated using (true);
create policy "admins manage clinic settings" on public.clinic_settings
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

insert into public.clinic_settings (setting_key, setting_value)
values
  ('clinic_profile', '{"name":"University of Antique - Hamtic Campus Clinic","phone":"(033) 555 0142"}'),
  ('clinic_hours', '{"monday":"08:30-16:30","tuesday":"08:30-16:30","wednesday":"08:30-16:30","thursday":"08:30-16:30","friday":"08:30-16:30","saturday":null,"sunday":null}')
on conflict (setting_key) do nothing;
