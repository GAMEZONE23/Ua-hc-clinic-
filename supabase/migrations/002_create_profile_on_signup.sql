create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'patient')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for users created before this trigger was installed.
insert into public.profiles (id, full_name, email, role)
select
  users.id,
  coalesce(users.raw_user_meta_data ->> 'full_name', split_part(users.email, '@', 1)),
  users.email,
  coalesce((users.raw_user_meta_data ->> 'role')::public.user_role, 'patient')
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id
where profiles.id is null;
