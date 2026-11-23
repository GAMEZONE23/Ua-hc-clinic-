create table if not exists public.medical_record_audit (
  id uuid primary key default gen_random_uuid(),
  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  action text not null check (action in ('created', 'updated')),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  chief_complaint text,
  diagnosis text,
  treatment text,
  prescriptions text,
  follow_up_instructions text,
  created_at timestamptz not null default now()
);

create index if not exists medical_record_audit_record_idx
on public.medical_record_audit(medical_record_id, created_at desc);

alter table public.medical_record_audit enable row level security;

drop policy if exists "staff view medical record audit" on public.medical_record_audit;
create policy "staff view medical record audit" on public.medical_record_audit
for select using (public.current_user_role() in ('staff', 'admin'));

drop policy if exists "staff create medical record audit" on public.medical_record_audit;
create policy "staff create medical record audit" on public.medical_record_audit
for insert with check (public.current_user_role() in ('staff', 'admin'));

create or replace function public.audit_medical_record_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.medical_record_audit
    (medical_record_id, action, patient_id, changed_by, chief_complaint, diagnosis, treatment, prescriptions, follow_up_instructions)
  values
    (new.id, case when tg_op = 'INSERT' then 'created' else 'updated' end, new.patient_id,
     coalesce(auth.uid(), new.recorded_by), new.chief_complaint, new.diagnosis,
     new.treatment, new.prescriptions, new.follow_up_instructions);
  return new;
end;
$$;

drop trigger if exists medical_record_audit on public.medical_records;
create trigger medical_record_audit
after insert or update on public.medical_records
for each row execute function public.audit_medical_record_changes();
