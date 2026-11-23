# Supabase verification and backend checklist

This checklist covers the remaining production setup required for the clinic app to complete student registration and verified appointment communications.

## 1) Prepare the project environment

1. Copy `.env.example` to `.env`.
2. Replace the values with your actual Supabase project URL and publishable key.
3. Confirm the Vite app reads these values from the browser environment.

## 2) Apply the database migrations in order

Run these in the Supabase SQL editor in this order:

1. `supabase/migrations/001_initial_schema.sql`
2. `002_create_profile_on_signup.sql`
3. `003_repair_profiles.sql`
4. `004_secure_appointment_updates.sql`
5. `005_fix_existing_user_roles.sql`
6. `006_sync_signup_roles.sql`
7. `007_notifications.sql`
8. `008_clinic_closures.sql`
9. `009_validate_appointment_schedule.sql`
10. `010_doctor_appointment_duration.sql`
11. `011_appointment_status_history.sql`
12. `012_medical_record_audit.sql`
13. `013_audit_logs.sql`
14. `014_announcements.sql`
15. `015_security_and_record_fixes.sql`
16. `016_harden_role_and_reschedule_notifications.sql`
17. `017_fix_schedule_timezone_and_json.sql`
18. `018_dedupe_medical_records.sql` if duplicate medical records were found
19. `019_student_registration_requirements.sql`
20. `020_student_profile_details.sql`
21. `021_staff_appointment_reminders.sql`
22. `022_student_academic_catalog.sql`
23. `023_staff_announcement_publish.sql`
24. `024_visit_workflow_statuses.sql`
25. `025_visit_outcomes_and_recommendations.sql`
26. `026_add_reschedule_requested.sql`
27. `027_prevent_overlapping_appointments.sql`
28. `028_patient_intake_and_consent.sql`
29. `029_harden_audit_permissions.sql`
30. `030_staff_visit_lifecycle.sql`

The staff dashboard announcement form requires migration `023_staff_announcement_publish.sql`. Run it after the announcements table migration; otherwise staff publishing will fail with a row-level security error.

The visit workflow requires migrations `024_visit_workflow_statuses.sql` and `025_visit_outcomes_and_recommendations.sql` so staff can check patients in, start consultations, complete visits, and save results and recommendations.

Migration `027_prevent_overlapping_appointments.sql` rejects overlapping active appointments for the same provider, including concurrent booking attempts. Apply it after migration `026`.

Migration `028_patient_intake_and_consent.sql` adds structured pre-visit symptoms, medical history, allergies, emergency contact, insurance, and consent fields. It stamps consent server-side and requires complete intake for new patient appointments before staff can check them in or start a consultation. Existing appointments remain usable without backfilled intake.

Migration `029_harden_audit_permissions.sql` makes appointment and medical-record audit histories read-only to API roles and limits patient notification updates to `read_at`.

Migration `030_staff_visit_lifecycle.sql` adds server-stamped arrival, consultation, and checkout times plus staff room assignment. It prevents patients from changing these staff-managed fields.

Important notes:

- `019_student_registration_requirements.sql` requires a unique `school_id` and an email from the `@antiquespride.edu.ph` domain.
- `020_student_profile_details.sql` adds `course`, `year_level`, and `section` to the student profile.

## 3) Enable email verification in Supabase

In the Supabase dashboard:

1. Go to Authentication > Providers > Email.
2. Enable Confirm email.
3. Confirm the email template is active.
4. If using code-based verification, confirm the template includes a verification code flow.
5. Under Authentication > URL Configuration, add the app's local and production origins to Redirect URLs. Password recovery returns to the current app path with `?reset-password=1`, so the matching origin must be allowed.
6. Configure a production SMTP provider under Authentication > SMTP Settings and verify the sender address. Supabase's default mail service is restricted and rate-limited; a recovery request can fail with `Error sending recovery email` until production email delivery is configured. Check the Supabase Auth logs for the SMTP provider's specific failure.

If Confirm email is disabled, Supabase may return a valid session immediately after signup and the app will not have a proper verification step.

## 4) Configure the app for verified student signup

The frontend code expects:

- student email to end with `@antiquespride.edu.ph`
- a valid school ID value
- a verification code step during sign-up
- a unique student ID check before profile save

If signup still fails, confirm that:

- the database tables include the new `school_id` column
- the unique index exists
- the auth provider is configured for email confirmation
- the app is using the correct Supabase project URL and anon key

## 5) Validate the live flow

After the database and email provider are configured, test these cases:

1. Student signs up using an `@antiquespride.edu.ph` email.
2. Verification email is sent and accepted.
3. School ID is required and unique.
4. Student profile can save course, year, section, and phone data.
5. Staff/admin can see the saved academic information.
6. Notifications are created for approved, rescheduled, and reminder events.
7. A new patient booking requires symptoms, medical history, allergies, emergency contact details, insurance status, treatment consent, and privacy acknowledgment.
8. Data-sharing consent is optional and its choice and timestamp are visible to authorized staff.
9. Staff can view intake details and recent visit notes, and incomplete new intake cannot be checked in.
10. Apply migrations `001`-`029` to an isolated staging project, enable the `pgtap` extension, and run `supabase/tests/database/rls.test.sql` as the database owner. The test runs inside a transaction and rolls its fixtures back; do not run it against production.
11. Complete and record a backup restore drill using [backup-and-recovery.md](backup-and-recovery.md).

## 6) Production notes

- Never commit real Supabase credentials or patient data.
- Keep email confirmation enabled before releasing public signup.
- Review RLS policies after every migration-related change.
- Schedule a final smoke test on mobile and desktop before launch.
- Maintain a separate, tested backup and recovery process; Supabase plan capabilities and retention must be confirmed in the project dashboard.
