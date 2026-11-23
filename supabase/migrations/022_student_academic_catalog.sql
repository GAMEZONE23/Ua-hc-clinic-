alter table public.profiles
add column if not exists department text,
add column if not exists major text;

update public.profiles
set department = case
  when upper(coalesce(course, '')) like '%BSA%'
    or upper(coalesce(course, '')) like '%BSFT%'
    or upper(coalesce(course, '')) like '%BSF%'
    or upper(coalesce(course, '')) like '%BAT%'
    or upper(coalesce(course, '')) like '%BSAGRIB%' then 'CAFFS'
  when upper(coalesce(course, '')) like '%BSED%'
    or upper(coalesce(course, '')) like '%BTLED%' then 'CTE'
  when upper(coalesce(course, '')) like '%BSCS%' then 'CCIS'
  else department
end
where department is null;
