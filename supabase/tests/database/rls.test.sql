-- STAGING ONLY. Never execute this fixture suite against production.
begin;
set local search_path = extensions, public;
select no_plan();

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (null, '00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'rls-patient-a@antiquespride.edu.ph', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"RLS Patient A","school_id":"RLS-PAT-101"}', now(), now()),
  (null, '00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'rls-patient-b@antiquespride.edu.ph', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"RLS Patient B","school_id":"RLS-PAT-102"}', now(), now()),
  (null, '00000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'rls-staff@antiquespride.edu.ph', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"RLS Staff","school_id":"RLS-STAFF-103"}', now(), now()),
  (null, '00000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 'rls-admin@antiquespride.edu.ph', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"RLS Admin","school_id":"RLS-ADMIN-104"}', now(), now());

update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-000000000103';
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000104';

insert into public.doctors (id, full_name, specialty, is_active)
values
  ('00000000-0000-0000-0000-000000000201', 'RLS Active Doctor', 'General Medicine', true),
  ('00000000-0000-0000-0000-000000000202', 'RLS Inactive Doctor', 'General Medicine', false);

insert into public.clinic_settings (setting_key, setting_value)
values ('rls_test_setting', '{"test":true}'::jsonb);

alter table public.appointments disable trigger user;
insert into public.appointments (id, patient_id, doctor_id, appointment_type, scheduled_at, status)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000201', 'RLS test visit', now(), 'approved'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000201', 'RLS test visit', now(), 'cancelled');
alter table public.appointments enable trigger user;

insert into public.medical_records (id, patient_id, appointment_id, recorded_by, chief_complaint)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000103', 'RLS test record A'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000103', 'RLS test record B');

insert into public.notifications (id, recipient_id, appointment_id, notification_type, title, message)
values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000301', 'rls_test', 'Patient A notice', 'Original message'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000302', 'rls_test', 'Patient B notice', 'Original message');

insert into public.appointment_status_history (appointment_id, status, changed_by)
values
  ('00000000-0000-0000-0000-000000000301', 'cancelled', '00000000-0000-0000-0000-000000000103'),
  ('00000000-0000-0000-0000-000000000302', 'cancelled', '00000000-0000-0000-0000-000000000103');

insert into public.announcements (id, title, message, created_by, archived_at)
values
  ('00000000-0000-0000-0000-000000000601', 'RLS active announcement', 'Visible to authenticated users', '00000000-0000-0000-0000-000000000104', null),
  ('00000000-0000-0000-0000-000000000602', 'RLS archived announcement', 'Admin only', '00000000-0000-0000-0000-000000000104', now());

insert into public.announcement_reads (announcement_id, reader_id)
values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000102');

alter table public.appointments disable trigger validate_appointment_schedule;

select ok(
  (select count(*) = 11 from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
    and c.relname::text = any(array[
       'profiles', 'doctors', 'appointments', 'medical_records', 'clinic_settings',
       'notifications', 'appointment_status_history', 'medical_record_audit',
       'audit_logs', 'announcements', 'announcement_reads'
     ])
     and c.relrowsecurity),
  'RLS is enabled on every application table'
);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000101"}', true);

select is((select count(*)::int from public.profiles), 1, 'patient sees only their own profile');
select is((select count(*)::int from public.doctors where id = '00000000-0000-0000-0000-000000000201'), 1, 'patient sees an active doctor');
select is((select count(*)::int from public.doctors where id = '00000000-0000-0000-0000-000000000202'), 0, 'patient cannot see an inactive doctor');
select is((select count(*)::int from public.appointments), 1, 'patient sees only their own appointments');
select is((select count(*)::int from public.medical_records), 1, 'patient sees only their own medical records');
select is((select count(*)::int from public.notifications), 1, 'patient sees only their own notifications');
select is((select count(*)::int from public.appointment_status_history), 1, 'patient sees status history for their own appointments');
select is((select count(*)::int from public.medical_record_audit), 0, 'patient cannot read medical-record audit history');
select is((select count(*)::int from public.audit_logs), 0, 'patient cannot read administrative audit logs');
select is((select count(*)::int from public.announcements where id = '00000000-0000-0000-0000-000000000601'), 1, 'patient sees an active announcement');
select is((select count(*)::int from public.announcements where id = '00000000-0000-0000-0000-000000000602'), 0, 'patient cannot see an archived announcement');
select is((select count(*)::int from public.announcement_reads), 1, 'patient sees only their own announcement reads');
select is((select count(*)::int from public.clinic_settings where setting_key = 'rls_test_setting'), 1, 'authenticated patient can read clinic settings');
update public.clinic_settings set setting_value = '{"test":false}' where setting_key = 'rls_test_setting';
select is((select setting_value from public.clinic_settings where setting_key = 'rls_test_setting'), '{"test":true}'::jsonb, 'patient cannot change clinic settings');
select throws_ok($$insert into public.medical_records (patient_id, recorded_by) values ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000101')$$, '42501', null, 'patient cannot create clinical records');
select throws_ok($$insert into public.announcements (title, message, created_by) values ('RLS patient announcement', 'Should be blocked', '00000000-0000-0000-0000-000000000101')$$, '42501', null, 'patient cannot publish announcements');
update public.profiles set full_name = 'RLS Patient A Updated' where id = '00000000-0000-0000-0000-000000000101';
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000101'), 'RLS Patient A Updated', 'patient can update their own permitted profile fields');
update public.profiles set full_name = 'Unauthorized' where id = '00000000-0000-0000-0000-000000000102';
select throws_ok($$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000101'$$, 'P0001', 'Only administrators may change account roles or activation', 'patient cannot grant themselves administrator access');
select throws_ok($$update public.notifications set message = 'forged' where id = '00000000-0000-0000-0000-000000000501'$$, '42501', null, 'patient cannot edit notification content');
select throws_ok($$update public.appointments set room_assignment = 'Unauthorized room' where id = '00000000-0000-0000-0000-000000000301'$$, 'P0001', 'Only clinic staff may change visit workflow fields', 'patient cannot assign a visit room');
select throws_ok($$update public.appointments set checked_in_at = now() where id = '00000000-0000-0000-0000-000000000301'$$, 'P0001', 'Only clinic staff may change visit workflow fields', 'patient cannot forge visit timestamps');
update public.notifications set read_at = now() where id = '00000000-0000-0000-0000-000000000501';
select ok((select read_at is not null from public.notifications where id = '00000000-0000-0000-0000-000000000501'), 'patient can mark their own notification read');
select throws_ok($$delete from public.appointment_status_history where appointment_id = '00000000-0000-0000-0000-000000000301'$$, '42501', null, 'patient cannot delete appointment status history');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000103"}', true);
select ok((select count(*) >= 4 from public.profiles), 'staff can read patient and staff profiles');
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000102'), 'RLS Patient B', 'patient could not update another profile');
select is((select count(*)::int from public.appointments where id in ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000302')), 2, 'staff can read the appointment queue');
select is((select count(*)::int from public.medical_records where id in ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000402')), 2, 'staff can read clinical records');
select is((select count(*)::int from public.doctors where id in ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000202')), 2, 'staff can read inactive doctor records');
select is((select count(*)::int from public.audit_logs), 0, 'staff cannot read administrator audit logs');
select is((select count(*)::int from public.appointment_status_history where appointment_id in ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000302')), 2, 'staff can read appointment status history');
select is((select count(*)::int from public.medical_record_audit where medical_record_id in ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000402')), 2, 'staff can read medical-record audit history');
update public.profiles set full_name = 'Unauthorized by staff' where id = '00000000-0000-0000-0000-000000000101';
select is((select full_name from public.profiles where id = '00000000-0000-0000-0000-000000000101'), 'RLS Patient A Updated', 'staff cannot edit patient account profiles');
update public.doctors set specialty = 'Unauthorized by staff' where id = '00000000-0000-0000-0000-000000000201';
select is((select specialty from public.doctors where id = '00000000-0000-0000-0000-000000000201'), 'General Medicine', 'staff cannot manage doctors');
update public.clinic_settings set setting_value = '{"test":false}' where setting_key = 'rls_test_setting';
select is((select setting_value from public.clinic_settings where setting_key = 'rls_test_setting'), '{"test":true}'::jsonb, 'staff cannot change clinic settings');
update public.appointments set room_assignment = 'Triage Room 1' where id = '00000000-0000-0000-0000-000000000301';
select is((select room_assignment from public.appointments where id = '00000000-0000-0000-0000-000000000301'), 'Triage Room 1', 'staff can assign a visit room');
update public.appointments set status = 'checked_in' where id = '00000000-0000-0000-0000-000000000301';
select ok((select checked_in_at is not null from public.appointments where id = '00000000-0000-0000-0000-000000000301'), 'check-in time is stamped by the database');
update public.appointments set status = 'in_consultation' where id = '00000000-0000-0000-0000-000000000301';
select ok((select consultation_started_at is not null from public.appointments where id = '00000000-0000-0000-0000-000000000301'), 'consultation start time is stamped by the database');
update public.appointments set status = 'completed' where id = '00000000-0000-0000-0000-000000000301';
select ok((select consultation_ended_at is not null and checked_out_at is not null from public.appointments where id = '00000000-0000-0000-0000-000000000301'), 'completion stamps consultation end and checkout times');
select throws_ok($$insert into public.medical_record_audit (medical_record_id, action, patient_id) values ('00000000-0000-0000-0000-000000000401', 'created', '00000000-0000-0000-0000-000000000101')$$, '42501', null, 'staff cannot forge medical-record audit entries');
select throws_ok($$delete from public.appointment_status_history where appointment_id = '00000000-0000-0000-0000-000000000301'$$, '42501', null, 'staff cannot delete appointment status history');
insert into public.announcements (title, message, created_by)
values ('RLS staff announcement', 'Staff publishing is permitted', '00000000-0000-0000-0000-000000000103');
select is((select count(*)::int from public.announcements where title = 'RLS staff announcement'), 1, 'staff can publish an announcement as themselves');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000104', true);
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000104"}', true);
select ok((select count(*) > 0 from public.audit_logs), 'administrator can read audit logs');
update public.doctors set specialty = 'Updated specialty' where id = '00000000-0000-0000-0000-000000000201';
select is((select specialty from public.doctors where id = '00000000-0000-0000-0000-000000000201'), 'Updated specialty', 'administrator can manage doctors');
update public.profiles set role = 'staff' where id = '00000000-0000-0000-0000-000000000102';
select is((select role::text from public.profiles where id = '00000000-0000-0000-0000-000000000102'), 'staff', 'administrator can assign a staff role');
update public.clinic_settings set setting_value = '{"test":false}' where setting_key = 'rls_test_setting';
select is((select setting_value from public.clinic_settings where setting_key = 'rls_test_setting'), '{"test":false}'::jsonb, 'administrator can manage clinic settings');
select is((select count(*)::int from public.announcements where id = '00000000-0000-0000-0000-000000000602'), 1, 'administrator can view archived announcements');
select throws_ok($$insert into public.audit_logs (action, entity_type) values ('forged', 'test')$$, '42501', null, 'administrator cannot forge audit log entries');
select throws_ok($$delete from public.medical_record_audit where medical_record_id = '00000000-0000-0000-0000-000000000401'$$, '42501', null, 'administrator cannot alter medical-record audit history');

reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.profiles), 0, 'anonymous user cannot read profiles');
select is((select count(*)::int from public.doctors), 0, 'anonymous user cannot read doctors');
select is((select count(*)::int from public.clinic_settings), 0, 'anonymous user cannot read clinic settings');

reset role;
alter table public.appointments enable trigger validate_appointment_schedule;
select * from finish();
rollback;