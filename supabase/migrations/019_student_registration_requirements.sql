alter table public.profiles
add column if not exists school_id text;

drop index if exists public.profiles_school_id_unique_idx;
create unique index profiles_school_id_unique_idx
on public.profiles (lower(school_id))
where school_id is not null;

create or replace function public.validate_student_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'patient' then
    if new.school_id is null or new.school_id !~ '^[A-Za-z0-9][A-Za-z0-9-]{3,29}$' then
      raise exception 'A valid school ID using 4-30 letters, numbers, or hyphens is required';
    end if;
    if lower(new.email) !~ '@antiquespride\.edu\.ph$' then
      raise exception 'Student registration requires an AntiqueSPrIDE email address';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_student_registration on public.profiles;
create trigger validate_student_registration
before insert on public.profiles
for each row execute function public.validate_student_registration();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, school_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'patient'::public.user_role,
    new.raw_user_meta_data ->> 'school_id'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
