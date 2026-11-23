alter table public.appointments
  add column if not exists urgency text,
  add column if not exists intake_symptoms text,
  add column if not exists intake_medical_history text,
  add column if not exists intake_allergies text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists insurance_status text,
  add column if not exists insurance_provider text,
  add column if not exists insurance_member_id text,
  add column if not exists treatment_consent boolean not null default false,
  add column if not exists privacy_notice_acknowledged boolean not null default false,
  add column if not exists data_sharing_consent boolean not null default false,
  add column if not exists consent_signed_at timestamptz,
  add column if not exists consent_version text,
  add column if not exists intake_completed_at timestamptz;

alter table public.appointments
  drop constraint if exists appointments_insurance_status_check;

alter table public.appointments
  add constraint appointments_insurance_status_check
  check (insurance_status is null or insurance_status in ('insured', 'none'));

create or replace function public.validate_patient_appointment_intake()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() = new.patient_id and public.current_user_role() = 'patient' then
      if nullif(btrim(new.intake_symptoms), '') is null
        or nullif(btrim(new.intake_medical_history), '') is null
        or nullif(btrim(new.intake_allergies), '') is null
        or nullif(btrim(new.emergency_contact_name), '') is null
        or nullif(btrim(new.emergency_contact_phone), '') is null
      then
        raise exception 'Complete symptoms, medical history, allergies, and emergency contact before booking';
      end if;

      if new.insurance_status not in ('insured', 'none') or new.insurance_status is null then
        raise exception 'Select an insurance status before booking';
      end if;

      if new.insurance_status = 'insured'
        and (nullif(btrim(new.insurance_provider), '') is null or nullif(btrim(new.insurance_member_id), '') is null)
      then
        raise exception 'Complete insurance provider and member details before booking';
      end if;

      if new.treatment_consent is not true or new.privacy_notice_acknowledged is not true then
        raise exception 'Treatment consent and privacy notice acknowledgment are required';
      end if;

      new.urgency := coalesce(nullif(btrim(new.urgency), ''), 'Routine');
      new.consent_signed_at := now();
      new.consent_version := 'uahc-intake-v1';
      new.intake_completed_at := now();
    end if;
    return new;
  end if;

  if auth.uid() = old.patient_id and public.current_user_role() = 'patient'
    and row(
      new.urgency,
      new.intake_symptoms,
      new.intake_medical_history,
      new.intake_allergies,
      new.emergency_contact_name,
      new.emergency_contact_phone,
      new.insurance_status,
      new.insurance_provider,
      new.insurance_member_id,
      new.treatment_consent,
      new.privacy_notice_acknowledged,
      new.data_sharing_consent,
      new.consent_signed_at,
      new.consent_version,
      new.intake_completed_at
    ) is distinct from row(
      old.urgency,
      old.intake_symptoms,
      old.intake_medical_history,
      old.intake_allergies,
      old.emergency_contact_name,
      old.emergency_contact_phone,
      old.insurance_status,
      old.insurance_provider,
      old.insurance_member_id,
      old.treatment_consent,
      old.privacy_notice_acknowledged,
      old.data_sharing_consent,
      old.consent_signed_at,
      old.consent_version,
      old.intake_completed_at
    )
  then
    raise exception 'Patient intake and consent cannot be changed after booking';
  end if;

  if new.status is distinct from old.status
    and new.status in ('checked_in', 'in_consultation', 'completed')
    and new.consent_version is not null
    and (
      new.intake_completed_at is null
      or nullif(btrim(new.intake_symptoms), '') is null
      or nullif(btrim(new.intake_medical_history), '') is null
      or nullif(btrim(new.intake_allergies), '') is null
      or nullif(btrim(new.emergency_contact_name), '') is null
      or nullif(btrim(new.emergency_contact_phone), '') is null
      or new.treatment_consent is not true
      or new.privacy_notice_acknowledged is not true
    )
  then
    raise exception 'Complete patient intake before checking in or starting the consultation';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_patient_appointment_intake on public.appointments;
create trigger validate_patient_appointment_intake
before insert or update on public.appointments
for each row execute function public.validate_patient_appointment_intake();