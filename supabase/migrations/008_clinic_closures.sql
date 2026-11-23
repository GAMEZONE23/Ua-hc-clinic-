insert into public.clinic_settings (setting_key, setting_value)
values ('clinic_closures', '{"dates":[]}'::jsonb)
on conflict (setting_key) do nothing;
