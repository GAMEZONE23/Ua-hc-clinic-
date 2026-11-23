# Backup and Recovery

This procedure is for the clinic's Supabase production project. Keep the project reference, database recovery credentials, and any downloaded backup files in approved restricted storage; never commit them to this repository.

## Before release

- Confirm the Supabase subscription and project settings provide an appropriate automated database backup cadence and retention period. Record the actual cadence and retention; do not assume point-in-time recovery is enabled.
- Assign an owner for backup alerts and restore approval.
- Agree on and document the clinic's recovery point objective (maximum acceptable data loss) and recovery time objective (maximum acceptable service downtime).
- Keep a separate recovery copy outside the production project, with access restricted to authorized administrators.

## Restore drill

Run at least quarterly and after major schema changes, using a separate staging Supabase project.

1. Select a recent production backup using the Supabase dashboard's database backup/recovery controls, or use the provider-supported restore workflow for the project's subscription.
2. Restore into a new or isolated staging project. Never test by overwriting production.
3. Confirm the restored schema and migration state, then configure the app to use staging credentials only.
4. Verify representative profiles, appointments, medical records, appointment history, audit history, and announcements. Confirm sensitive data is not exposed to patient or anonymous roles by running `supabase/tests/database/rls.test.sql`.
5. Exercise student sign-in, staff queue access, admin reporting, and a test appointment workflow. Confirm timestamps and clinic-local scheduling are intact.
6. Record the restore start/end time, backup timestamp, validation results, issues, and follow-up owner. Update recovery objectives if the measured restore time or data gap exceeds the agreed targets.
7. Securely remove temporary restore data according to clinic retention policy once the drill is approved.

## Incident recovery

- Declare an incident and assign an authorized recovery lead.
- Preserve evidence and avoid uncoordinated production changes.
- Choose the recovery point with the clinic owner and document the expected data gap.
- Restore to an isolated project first where practical, validate access controls and core records, then follow the approved Supabase production recovery workflow.
- After service is restored, reconcile appointments and notifications created after the recovery point, review audit history, and document the incident.

Supabase database backups do not replace an independently tested recovery process. Recheck the provider's current backup coverage, retention, storage coverage, and restore limitations whenever the subscription or architecture changes.