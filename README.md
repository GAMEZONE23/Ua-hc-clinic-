 # UAHC Hamtic Campus Clinic

 Mobile-first clinic portal prototype for University of Antique, Hamtic Campus.

 ## Run locally

 ```bash
 npm install
 npm run dev
 ```

 The app opens at `http://localhost:5173/`.

The prioritized implementation roadmap is in [TODO.md](TODO.md).

 ## Current frontend

 The prototype includes the patient login flow, home dashboard, appointments, booking form, and profile screens. It currently uses local mock state; authentication and persistent data are not connected yet.

 ## Product scope

 Roles, screen permissions, appointment workflow, and implementation decisions are documented in [docs/clinic-product-spec.md](docs/clinic-product-spec.md).

 ## Database setup

 The initial Supabase/PostgreSQL migration is in [supabase/migrations/001_initial_schema.sql](supabase/migrations/001_initial_schema.sql). It defines:

 - `profiles`
 - `doctors`
 - `appointments`
 - `medical_records`
 - `clinic_settings`

 The migration also adds role and appointment status enums, indexes for staff search and sorting, updated timestamps, seed clinic settings, and row-level security policies.

After the initial schema, run [supabase/migrations/002_create_profile_on_signup.sql](supabase/migrations/002_create_profile_on_signup.sql). It creates a profile automatically whenever a Supabase Auth user is created and backfills the existing test user.

Run [supabase/migrations/003_repair_profiles.sql](supabase/migrations/003_repair_profiles.sql) if any Auth users were created before the signup trigger was installed. Then run [supabase/migrations/004_secure_appointment_updates.sql](supabase/migrations/004_secure_appointment_updates.sql) to prevent double-booked doctor slots and restrict patient appointment updates to cancellation.

Run [supabase/migrations/007_notifications.sql](supabase/migrations/007_notifications.sql) to add in-app appointment notifications, staff alerts, patient reminders, read state, and notification delivery metadata.

Run [supabase/migrations/008_clinic_closures.sql](supabase/migrations/008_clinic_closures.sql) to seed clinic closure and holiday settings. Then run [supabase/migrations/009_validate_appointment_schedule.sql](supabase/migrations/009_validate_appointment_schedule.sql) to enforce clinic and doctor availability at the database level.
Run [supabase/migrations/008_clinic_closures.sql](supabase/migrations/008_clinic_closures.sql) to seed clinic closure and holiday settings. Then run [supabase/migrations/009_validate_appointment_schedule.sql](supabase/migrations/009_validate_appointment_schedule.sql) to enforce clinic and doctor availability at the database level, followed by [supabase/migrations/010_doctor_appointment_duration.sql](supabase/migrations/010_doctor_appointment_duration.sql) for provider-specific appointment lengths.

Run [supabase/migrations/011_appointment_status_history.sql](supabase/migrations/011_appointment_status_history.sql) to record appointment status timelines for patients and staff.

Run [supabase/migrations/012_medical_record_audit.sql](supabase/migrations/012_medical_record_audit.sql) to audit medical-record creation and updates with role-protected access.

Run [supabase/migrations/013_audit_logs.sql](supabase/migrations/013_audit_logs.sql) to record administrative changes to accounts, providers, appointments, and clinic settings. Public registration always creates a patient account; administrators assign staff or admin access from the user registry.

Run [supabase/migrations/014_announcements.sql](supabase/migrations/014_announcements.sql) to add role-protected clinic announcements and per-user read tracking.

Run [supabase/migrations/015_security_and_record_fixes.sql](supabase/migrations/015_security_and_record_fixes.sql), [supabase/migrations/016_harden_role_and_reschedule_notifications.sql](supabase/migrations/016_harden_role_and_reschedule_notifications.sql), and [supabase/migrations/017_fix_schedule_timezone_and_json.sql](supabase/migrations/017_fix_schedule_timezone_and_json.sql) to prevent role self-escalation, support patient reschedule requests, prevent duplicate records, notify staff of reschedule requests, and align schedule validation with the clinic timezone and provider availability format.

Run [supabase/migrations/019_student_registration_requirements.sql](supabase/migrations/019_student_registration_requirements.sql) to require a unique school ID and an `@antiquespride.edu.ph` email for new student accounts. Supabase email confirmation must be enabled, with the confirmation email template configured to send a verification code if code-based verification is required.

Run [supabase/migrations/020_student_profile_details.sql](supabase/migrations/020_student_profile_details.sql) to add course, year level, and section fields to student profiles.

Run [supabase/migrations/021_staff_appointment_reminders.sql](supabase/migrations/021_staff_appointment_reminders.sql) to allow active staff and administrators to send appointment reminders to the booked patient while keeping notification inserts protected by row-level security.

Run [supabase/migrations/022_student_academic_catalog.sql](supabase/migrations/022_student_academic_catalog.sql) to add saved department and major fields and backfill department values from existing student courses. Student profiles use the official department and course dropdown catalog in the app.

The Student ID entered during registration is stored as `profiles.school_id` and appears automatically in Patient Information. Run migrations 019 and 020 before testing new registrations.

Use [.env.example](.env.example) as the local template and copy it to `.env` with your project values before running the app against Supabase. The verification workflow and backend migration checklist are documented in [docs/supabase-verification-checklist.md](docs/supabase-verification-checklist.md).

For the complete ordered migration list, staging RLS tests, and restore procedure, follow the [Supabase verification checklist](docs/supabase-verification-checklist.md). Run the pgTAP suite only against an isolated staging project, never production.

If migration 015 already failed because duplicate medical records exist, run [supabase/migrations/018_dedupe_medical_records.sql](supabase/migrations/018_dedupe_medical_records.sql) first. It keeps the newest record per appointment and removes older duplicates before creating the unique index.

 To use it with Supabase:

 1. Create a Supabase project.
 2. Open the SQL Editor.
 3. Run the migration file.
 4. Add the project URL and publishable key to a local `.env` file when frontend integration begins.

 Do not commit real credentials or patient data.

## Deploy online

The app is ready for a Vercel deployment:

1. Push this project to GitHub.
2. Import the repository into Vercel.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Add these Vercel environment variables:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

6. Deploy and open the generated URL.

The `vercel.json` rewrite keeps the React application routes working after refresh.
