alter table public.profiles
add column if not exists course text,
add column if not exists year_level text,
add column if not exists section text;