# Security and RLS Risk Review

## Executive Summary
This QA system is workable, but it depends heavily on strict Supabase Row Level Security (RLS). The frontend directly reads, inserts, updates, and deletes records from core business tables. That is acceptable only if the database policies enforce the real permissions. The UI must not be treated as the security boundary.

## Highest-Risk Findings

### 1) Direct client-side access to core tables
The browser writes directly to:
- `profiles`
- `audits`
- `agent_feedback`
- `monitoring_items`
- `supervisor_requests`
- `calls_records`
- `tickets_records`
- `sales_records`
- `voice_submissions`

Risk:
- Any user with a valid session could potentially bypass the UI and call Supabase directly unless table policies block them.

### 2) Role checks appear mostly in React
The app clearly checks roles in the UI and routes users by profile role. That is useful for experience, but not enough for security.

Examples from the codebase behavior:
- Accounts management creates/updates/deletes `profiles`
- Audits list supports edit/delete/share behaviors
- Agent feedback supports status changes and delete actions
- Supervisor requests support status updates
- Monitoring supports create/resolve flows

Risk:
- If RLS is weak, a user could perform actions the UI intended to hide.

### 3) Broad reporting/dashboard reads
Dashboard and reports pages pull broad datasets across teams:
- audits
- production uploads
- requests
- feedback
- monitoring

Risk:
- Without strict RLS, these screens can expose cross-team data to the wrong role.

### 4) Sensitive identity metadata is stored and displayed
Several tables include creator/resolver identity fields such as:
- `created_by_email`
- `resolved_by_email`
- `created_by_name`
- `created_by_role`

Risk:
- Operational visibility is useful, but these fields expand the blast radius of a policy mistake.

### 5) Anonymous channel is only anonymous in the UI
Voice submissions are displayed anonymously, but inserts still include `submitted_by_user_id`.

Risk:
- If raw table access is too broad, anonymity may be weakened.

## Medium-Risk Findings

### 6) Publishable Supabase client in the frontend
The frontend includes the Supabase URL and publishable anon key.

Important note:
- This is normal for Supabase.
- It becomes dangerous only when RLS is incomplete.

### 7) Bulk operations need hard permission controls
Bulk share/hide and other batch operations can affect many rows at once.

Risk:
- Mistakes or abuse can scale quickly.

### 8) `profiles` is the access-control backbone
`profiles` maps auth user IDs to app role, team, and business identity.

Risk:
- Any weakness here becomes a weakness everywhere else.

## Table-by-Table RLS Recommendations

### `profiles`
Allow:
- user can read own profile
- admin can create/update/delete profiles
- optionally QA can read a limited subset if needed
- supervisors should not get broad profile access unless explicitly required

Deny:
- ordinary users updating role/team/email/identity mappings

### `audits`
Allow:
- admin and QA insert
- admin update/delete/share
- QA update only approved fields if that is your rule
- agent read only rows where:
  - the row belongs to them
  - team matches
  - `shared_with_agent = true`
- supervisor read only their own team

Deny:
- agents changing score fields, comments, sharing flags, or delete behavior

### `agent_feedback`
Allow:
- QA/admin create
- QA/admin update/delete
- agent read only own rows
- agent update only acknowledgement fields if needed

Deny:
- agents editing feedback content or status beyond what is explicitly allowed

### `monitoring_items`
Allow:
- QA/admin create
- supervisors create for their own team if intended
- agent read only own active items
- resolve/acknowledge operations should be field-specific

Deny:
- cross-team read/write

### `supervisor_requests`
Allow:
- supervisors create for their own team
- QA/admin broader read/update
- supervisors read only own team

Deny:
- supervisors reading other teams

### `calls_records`, `tickets_records`, `sales_records`
Allow:
- admin/QA create and possibly edit
- supervisors read only own team if needed
- agents read only their own records if intended

Deny:
- agents editing production records
- cross-team reads for supervisors

### `voice_submissions`
Recommended pattern:
- keep raw table tightly protected
- expose a sanitized view for anonymous display if needed
- do not let ordinary users read submitter linkage

### `qa_academy_lessons`
Allow:
- broad read for active lessons
- admin/QA create/update/archive
- restrict write access tightly

## Stronger Architecture Recommendations

### Move sensitive mutations behind RPC or Edge Functions
Best candidates:
- create/delete/update profile
- bulk audit release/hide
- delete feedback
- resolve monitoring items
- status changes on request workflows

Why:
- reduces trust in the browser
- gives you one hardened permission layer
- simplifies auditing

### Add immutable audit logging
Create an audit trail for:
- profile changes
- role changes
- deletes
- share/hide actions
- status transitions

### Use database views for safe read models
For dashboards and TV mode, expose sanitized summary views rather than reading full operational tables.

## Immediate P0 Actions
1. Enable and verify RLS on every table
2. Deny-by-default for all tables
3. Lock down `profiles`
4. Lock down audit share/delete/update rules
5. Validate agent-only read scopes
6. Validate supervisor team-only scopes
7. Review anonymous voice submission privacy

## Practical Validation Checklist
- Can an agent directly query all audits?
- Can an agent update `shared_with_agent`?
- Can a supervisor query other teams?
- Can a non-admin write to `profiles`?
- Can an agent update another agent’s feedback?
- Can a user view submitter identity for anonymous voice entries?
- Can a user delete rows from operational tables through direct API calls?

## Bottom Line
The frontend is functional, but the real security lives in Supabase policies. If RLS is strong, this app can be safe. If RLS is weak, the current browser-side data access pattern is the main risk.
