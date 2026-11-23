create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  category text not null default 'general' check (category in ('general', 'closure', 'event', 'vaccination', 'deadline')),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_expiry_after_publish check (expires_at is null or expires_at > published_at)
);

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  reader_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, reader_id)
);

create index if not exists announcements_active_idx
on public.announcements(published_at, expires_at, archived_at);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

drop policy if exists "users view active announcements" on public.announcements;
create policy "users view active announcements" on public.announcements
for select to authenticated
using (
  (published_at <= now() and (expires_at is null or expires_at > now()) and archived_at is null)
  or public.current_user_role() = 'admin'
);

drop policy if exists "admins manage announcements" on public.announcements;
create policy "admins manage announcements" on public.announcements
for all using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "users view own announcement reads" on public.announcement_reads;
create policy "users view own announcement reads" on public.announcement_reads
for select using (reader_id = auth.uid());

drop policy if exists "users mark announcements read" on public.announcement_reads;
create policy "users mark announcements read" on public.announcement_reads
for insert with check (reader_id = auth.uid());

create policy "users update own announcement reads" on public.announcement_reads
for update using (reader_id = auth.uid())
with check (reader_id = auth.uid());

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at before update on public.announcements
for each row execute function public.set_updated_at();
