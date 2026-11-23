# UAHC Clinic System TODO

Prioritized roadmap for making the clinic system more useful for patients, staff, and administrators.

## Priority 1: Appointment reliability

### 1. Appointment notifications and reminders

- [x] Notify patients when an appointment is submitted.
- [x] Notify patients when staff approve, reschedule, or cancel an appointment.
- [x] Add an in-app 24-hour reminder when a patient opens the system.
- [x] Add an in-app notification center for patients, staff, and admins.
- [x] Record notification delivery status and read state.
- [ ] Add external email or SMS delivery and scheduled server-side reminders.

### 2. Doctor availability and clinic scheduling

- [x] Store working hours and appointment durations for each doctor.
- [x] Show only available appointment slots during booking.
- [x] Prevent double-booking with database constraints and server-side checks.
- [x] Support clinic closures, holidays, and special operating hours.
- [x] Display a clear unavailable or fully booked state to patients.

## Priority 2: Better daily workflows

### 3. Complete patient appointment details

- [x] Show doctor name, specialty, clinic location, appointment type, and visit reason.
- [x] Show appointment status history with timestamps.
- [x] Explain why an appointment was rescheduled or cancelled when clinic notes are provided.
- [x] Allow patients to request a new time without losing the original request.
- [x] Add a printable or downloadable appointment summary.

### 4. Staff patient search and records

- [x] Open a complete patient profile from an appointment.
- [x] Show previous visits and medical records in chronological order.
- [x] Add filters for date, doctor, status, and appointment type.
- [x] Add patient ID, phone number, and email search.
- [x] Show the patient's upcoming and past appointments together.

### 5. Complete medical records

- [x] Add chief complaint to the staff record editor.
- [x] Add prescriptions and medication instructions.
- [x] Add diagnosis, treatment, and follow-up instructions.
- [x] Track who created or edited each record and when.
- [x] Generate a printable visit summary.
- [x] Protect records with role-based access and audit history.

## Priority 3: Administration and communication

### 6. Admin security and accountability

- [x] Remove public Administrator registration from the sign-up form.
- [x] Allow only an existing administrator to grant the `admin` role.
- [x] Add account activation and deactivation controls.
- [x] Require confirmation before destructive actions.
- [x] Add an audit log for role, account, doctor, settings, and appointment changes.
- [x] Add pgTAP tests for RLS coverage across application tables and patient, staff, admin, and anonymous roles.
- [ ] Run the pgTAP suite and migrations 001-029 against an isolated staging project and verify trigger/RLS behavior.

### 7. Clinic announcements

- [x] Allow administrators to publish clinic announcements.
- [x] Support announcements for closures, events, vaccination drives, and deadlines.
- [x] Show active announcements on the patient and staff dashboards.
- [x] Add publish, expiration, and archive dates.
- [x] Allow staff to mark an announcement as read.

### 8. Role-based dashboard improvements

- [x] Patient dashboard: next appointment, pending request, reminders, and announcements.
- [x] Staff dashboard: today's queue, waiting patients, completed visits, and urgent items.
- [x] Admin dashboard: appointment trends, provider workload, and account activity.
- [x] Add loading, empty, and error states to dashboard panels.
- [ ] Add offline states to dashboard panels.
- [x] Add date-range filters to staff and admin reports.
- [x] Export filtered reports as CSV with clear column names.

## Priority 4: Clinical operations and patient experience

### 9. Real patient communication

- [ ] Add email and SMS reminders for confirmed, rescheduled, and upcoming visits.
- [ ] Trigger automated queue updates for no-shows, cancellations, and rebooking events.
- [ ] Send push and in-app notifications to staff when urgent appointments arrive.
- [ ] Build reminder scheduling based on clinic hours and timezone-aware delivery.
- [ ] Record communication delivery status, read state, and retry handling for outbound alerts.

### 10. Patient intake and consent workflow

- [x] Add a pre-visit symptom intake form for patients before consultation.
- [x] Capture separate treatment and privacy acknowledgments plus optional data-sharing consent.
- [x] Collect emergency contact and insurance details during appointment booking.
- [x] Capture medical history and allergies, and show recent visit notes to staff for triage.
- [x] Require complete intake before new patient bookings can be checked in or moved into consultation.

### 11. Triage and queue management

- [x] Prioritize urgent intake in the staff queue.
- [x] Support waiting room status and room assignment.
- [x] Add check-in, consultation, and checkout timestamps for each visit stage.
- [ ] Let staff add arrival notes and consultation start/end times.
- [x] Show live wait time, room assignment, and visit stage in the staff dashboard.

### 12. Reporting and decision support

- [x] Track attendance and no-show rates, cancellations, and monthly visit volume trends.
- [ ] Report doctor workload by specialty, shift, and clinic location.
- [x] Summarize patient volume by month for clinic planning.
- [ ] Monitor appointment conversion and cancellation trends over time.
- [ ] Export filtered reports to PDF and CSV for dean, clinic managers, and administrators.

### 13. Document and lab integration

- [ ] Add upload support for lab results, treatment notes, prescriptions, and referral documents.
- [ ] Attach PDFs and scan uploads to patient visits and medical records.
- [ ] Maintain a secure patient history archive for continuing care and review.
- [ ] Allow staff to retrieve previous documents quickly during follow-up care.
- [ ] Track file ownership, upload timestamps, and access permissions for each record.

### 14. Security and compliance hardening

- [ ] Add rate limiting for signup and appointment booking attempts.
- [ ] Add session timeout and re-authentication for sensitive workflows.
- [ ] Maintain an audit trail for all sensitive actions and record edits.
- [ ] Define a patient data retention policy and archival workflow.
- [ ] Add privacy notices and consent logs for treatment and data-sharing permissions.
- [x] Document a backup, recovery, and restore-drill plan for clinical and patient data.
- [ ] Complete a staging restore drill and record the clinic's recovery objectives.

### 15. Mobile-first operational features

- [ ] Add offline-safe patient and staff dashboard states for weak connectivity.
- [ ] Support quick patient lookup by ID, name, or phone number.
- [ ] Add one-tap check-in for active appointment visits.
- [ ] Add PWA install support for the clinic app on mobile devices.
- [ ] Enable push notifications for appointment reminders and urgent queue events.

## Quality and release checklist

- [ ] Add automated tests for booking conflicts, week boundaries, permissions, and role routing.
- [ ] Test patient, staff, and admin flows on mobile and desktop.
- [ ] Verify keyboard navigation and screen-reader labels.
- [ ] Confirm no real credentials or patient data are committed.
- [ ] Run `npm run lint` and `npm run build` before deployment.
