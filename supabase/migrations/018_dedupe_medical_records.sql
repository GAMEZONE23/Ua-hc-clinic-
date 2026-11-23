-- Repair existing duplicate records before enforcing one record per appointment.
with ranked_records as (
  select
    id,
    row_number() over (
      partition by appointment_id
      order by updated_at desc, created_at desc, id desc
    ) as record_rank
  from public.medical_records
  where appointment_id is not null
)
delete from public.medical_records
where id in (
  select id from ranked_records where record_rank > 1
);

create unique index if not exists medical_records_appointment_unique_idx
on public.medical_records(appointment_id)
where appointment_id is not null;