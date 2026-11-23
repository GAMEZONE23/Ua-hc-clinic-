# UAHC Hamtic Campus Clinic

## Confirmed roles

| Role | Description |
| --- | --- |
| `patient` | Student or patient who books visits and views their own information. |
| `staff` | Clinic personnel who manage the appointment queue and patient records. |
| `admin` | Authorized administrator who manages users, doctors, clinic hours, reports, and settings. |

Role membership is stored in `profiles.role`. Authentication is handled by Supabase Auth; the application profile is linked to `auth.users.id`.

## Screen map and permissions

### Shared

- Login and registration: all unauthenticated users.
- Sign out: all authenticated users.
- Account/profile menu: all authenticated users; users can view their own profile.

### Patient/student

- Home dashboard: view personal greeting, clinic hours, contact details, and quick actions.
- Appointments: view own upcoming, past, and all appointments; cancel or request rescheduling for eligible visits.
- Book appointment: create an appointment for self using an available doctor and appointment type.
- Profile: view and update permitted personal details and medical information.

Patients cannot view another patient, edit doctors, approve appointments, change clinic settings, or access reports.

### Clinic staff

- Appointment queue: view and sort appointments by date, status, doctor, and patient; search by patient name or email.
- Appointment details: approve, reschedule, cancel, complete, or mark a visit as no-show according to clinic policy.
- Patient records: search and open patient profiles and medical records.
- Medical record editor: create and update clinical notes, diagnosis, treatment, prescriptions, and follow-up instructions.
- Record actions: save records and print a patient record or visit summary.

Staff can access patient records needed for clinic work but cannot manage admin users, global settings, or system permissions.

### Administrator

- User management: search users, activate/deactivate accounts, and change roles.
- Doctor management: create, update, archive doctors, and manage specialties and availability.
- Clinic hours: configure regular hours, closures, holidays, and contact information.
- Reports: view appointment volume, statuses, doctor workload, and date-filtered summaries.
- Settings: manage clinic-wide settings and administrative configuration.

Admins have staff capabilities plus administrative capabilities. Destructive actions should require confirmation and be recorded in an audit log when that feature is added.

## Appointment workflow

1. Patient submits an appointment with a doctor, type, date, and time.
2. Appointment starts as `pending`.
3. Staff reviews the queue and moves it to `approved`, `rescheduled`, or `cancelled`.
4. After the visit, staff marks it `completed` or `no_show` and may save a medical record.
5. Patients can view the status and their own appointment history.

## Initial database tables

- `profiles`: authenticated user identity, role, contact details, and medical basics.
- `doctors`: doctor directory, specialty, availability, and active status.
- `appointments`: patient bookings, assigned doctor, schedule, status, and staff notes.
- `medical_records`: clinical notes attached to a patient and optionally an appointment.
- `clinic_settings`: singleton key/value settings for clinic identity, contact details, and hours.

The initial migration is in `supabase/migrations/001_initial_schema.sql`.
