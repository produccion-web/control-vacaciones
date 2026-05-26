-- Control vacaciones SaaS · Supabase schema
-- Ejecuta este archivo en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  annual_days integer not null default 22,
  created_at timestamptz not null default now()
);

create table public.vacations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  year integer not null,
  consumed_days integer not null,
  workable_days integer not null,
  excluded_dates date[] not null default '{}',
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index employees_org_idx on public.employees(organization_id);
create index vacations_org_year_idx on public.vacations(organization_id, year);
create index vacations_employee_idx on public.vacations(employee_id);

create or replace function public.is_org_member(org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org and m.user_id = auth.uid() and m.role in ('owner','admin')
  );
$$;

create or replace function public.create_organization_with_owner(org_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_org uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.organizations(name) values (org_name) returning id into new_org;
  insert into public.organization_members(organization_id, user_id, role) values (new_org, auth.uid(), 'owner');
  return new_org;
end;
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.employees enable row level security;
alter table public.vacations enable row level security;

create policy "members can read organizations"
on public.organizations for select
using (public.is_org_member(id));

create policy "owners can update organizations"
on public.organizations for update
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

create policy "members can read memberships"
on public.organization_members for select
using (public.is_org_member(organization_id));

create policy "admins can manage memberships"
on public.organization_members for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "members can read employees"
on public.employees for select
using (public.is_org_member(organization_id));

create policy "admins can manage employees"
on public.employees for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "members can read vacations"
on public.vacations for select
using (public.is_org_member(organization_id));

create policy "admins can manage vacations"
on public.vacations for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));
