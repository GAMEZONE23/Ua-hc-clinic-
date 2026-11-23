alter table public.medical_records
  add column if not exists visit_result text,
  add column if not exists recommendations text;

alter table public.medical_record_audit
  add column if not exists visit_result text,
  add column if not exists recommendations text;

create or replace function public.audit_medical_record_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.medical_record_audit
    (medical_record_id, action, patient_id, changed_by, chief_complaint, diagnosis, treatment, prescriptions, follow_up_instructions, visit_result, recommendations)
  values
    (new.id, case when tg_op = 'INSERT' then 'created' else 'updated' end, new.patient_id,
     coalesce(auth.uid(), new.recorded_by), new.chief_complaint, new.diagnosis,
     new.treatment, new.prescriptions, new.follow_up_instructions, new.visit_result,
     new.recommendations);
  return new;
end;
$$;
