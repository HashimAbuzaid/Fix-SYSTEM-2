-- Detroit Axle QA System
-- Starter RLS checklist and policy template.
-- Review and adapt before running in production.

alter table public.profiles enable row level security;
alter table public.audits enable row level security;
alter table public.calls_records enable row level security;
alter table public.tickets_records enable row level security;
alter table public.sales_records enable row level security;
alter table public.agent_feedback enable row level security;
alter table public.monitoring_items enable row level security;
alter table public.supervisor_requests enable row level security;
alter table public.voice_submissions enable row level security;
alter table public.qa_academy_lessons enable row level security;

-- Example pattern only: users can read their own profile.
create policy if not exists profiles_select_own
on public.profiles
for select
using (auth.uid() = id);

-- Example pattern only: only admins can manage profile rows.
-- This assumes JWT/app metadata or a helper function can identify admin users.
-- Replace the condition below with your final production-safe implementation.
create policy if not exists profiles_admin_manage
on public.profiles
for all
using (false)
with check (false);

-- Recommended next steps:
-- 1) replace placeholder admin checks with your real auth strategy
-- 2) add team-scoped supervisor read policies
-- 3) add agent self-read only policies on audits / feedback / monitoring
-- 4) add field-restricted mutation flows via RPC or Edge Functions for sensitive writes
