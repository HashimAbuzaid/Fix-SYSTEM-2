# Database Schema / Table Map Inferred from the Code

## Important Note
This is an application-level schema map inferred from frontend usage. It should be validated against the actual Supabase database before using it as the source of truth.

---

## 1) `profiles`

### Purpose
Core identity and authorization mapping table.

### Fields seen in code
- `id`
- `role`
- `agent_id`
- `agent_name`
- `display_name`
- `team`
- `email`
- `created_at`

### Likely meaning
- `id`: Supabase auth user UUID
- `role`: app role (`admin`, `qa`, `agent`, `supervisor`)
- `agent_id`: business ID for agents
- `agent_name`: operational name
- `display_name`: human-friendly display label
- `team`: `Calls`, `Tickets`, or `Sales`
- `email`: user email

---

## 2) `audits`

### Purpose
Stores QA audits and release visibility to agents.

### Fields seen in code
- `id`
- `agent_id`
- `agent_name`
- `team`
- `case_type`
- `audit_date`
- `order_number`
- `phone_number`
- `ticket_id`
- `quality_score`
- `comments`
- `score_details`
- `shared_with_agent`
- `shared_at`
- `created_by_user_id`
- `created_by_name`
- `created_by_email`
- `created_by_role`

### Notes
- `score_details` appears to be structured data, likely JSON/JSONB
- supports release/hide behavior for agents

---

## 3) `calls_records`

### Purpose
Stores calls production uploads or manual entry.

### Fields seen in code
- `id`
- `agent_id`
- `agent_name`
- `calls_count`
- `call_date`
- `date_to`
- `notes`

### Notes
- appears to support date ranges for uploaded summaries

---

## 4) `tickets_records`

### Purpose
Stores ticket production uploads or manual entry.

### Fields seen in code
- `id`
- `agent_id`
- `agent_name`
- `tickets_count`
- `ticket_date`
- `date_to`
- `notes`

---

## 5) `sales_records`

### Purpose
Stores sales production uploads or manual entry.

### Fields seen in code
- `id`
- `agent_id`
- `agent_name`
- `amount`
- `sale_date`
- `date_to`
- `notes`

---

## 6) `agent_feedback`

### Purpose
Stores coaching and QA feedback for agents.

### Fields seen in code
- `id`
- `agent_id`
- `agent_name`
- `team`
- `qa_name`
- `feedback_type`
- `subject`
- `feedback_note`
- `action_plan`
- `due_date`
- `status`
- `created_at`
- `acknowledged_by_agent`
- `acknowledged_at`

### Notes
Status values seen:
- `Open`
- `In Progress`
- `Closed`

Feedback types seen:
- `Coaching`
- `Audit Feedback`
- `Warning`
- `Follow-up`

---

## 7) `monitoring_items`

### Purpose
Stores live monitoring / operational attention items.

### Fields seen in code
- `id`
- `order_number`
- `comment`
- `agent_id`
- `agent_name`
- `display_name`
- `team`
- `created_by_name`
- `created_by_email`
- `created_by_user_id`
- `created_at`
- `status`
- `acknowledged_by_agent`
- `acknowledged_at`
- `resolved_at`
- `resolved_by_name`
- `resolved_by_email`

### Notes
Status values seen:
- `active`
- `resolved`

---

## 8) `supervisor_requests`

### Purpose
Escalation / request management between supervisors and QA/admin.

### Fields seen in code
- `id`
- `case_reference`
- `agent_id`
- `agent_name`
- `display_name`
- `team`
- `case_type`
- `supervisor_name`
- `priority`
- `request_note`
- `status`
- `created_at`

### Notes
Priority values seen:
- `Low`
- `Medium`
- `High`
- `Urgent`

Status values seen:
- `Open`
- `Under Review`
- `Closed`

---

## 9) `voice_submissions`

### Purpose
Anonymous employee feedback / idea channel.

### Fields seen in code
- `id`
- `message`
- `category`
- `status`
- `created_at`
- `team`
- `is_anonymous`
- `submitted_by_user_id` (insert-side usage)

### Notes
Category values seen:
- `Idea`
- `Blocker`
- `Process`
- `Recognition`
- `Tooling`

Status values seen:
- `Open`
- `Reviewed`
- `Closed`

---

## 10) `qa_academy_lessons`

### Purpose
Lesson content for QA Academy by team or for all teams.

### Fields seen in code
- `id`
- `title`
- `team`
- `content`
- `lesson_type`
- `is_active`
- `created_at` (implied by ordering)

### Notes
Team values seen:
- `Calls`
- `Tickets`
- `Sales`
- `All`

---

## Relationship Map (Logical)

### `profiles`
Acts like the central identity table.

Likely relationships:
- `profiles.id` ↔ auth user id
- `profiles.agent_id` + `profiles.team` are used to match many operational rows

### `audits`
Logical links to:
- `profiles.agent_id`
- `profiles.agent_name`
- `profiles.team`

### `calls_records`, `tickets_records`, `sales_records`
Logical links to:
- `profiles.agent_id`
- `profiles.agent_name`
- `profiles.team`

### `agent_feedback`
Logical links to:
- `profiles.agent_id`
- `profiles.agent_name`
- `profiles.team`

### `monitoring_items`
Logical links to:
- `profiles.agent_id`
- `profiles.agent_name`
- `profiles.team`

### `supervisor_requests`
Logical links to:
- agent identity fields
- supervisor/team workflow, not necessarily strict foreign keys

### `voice_submissions`
Logical links to:
- submitting user id
- optional team scope

---

## Schema Risks Seen from the Frontend
1. Many tables appear to rely on duplicated business identity fields instead of strict foreign keys.
2. Matching is often done by combinations like:
   - `agent_id`
   - `agent_name`
   - `team`
3. This works, but it increases drift risk if names change.

## Recommended Future DB Improvements
- consider stable foreign-key references where possible
- use profile/user IDs more consistently
- keep display data denormalized only when needed for reporting speed
- add views for summary dashboards
- add audit-log tables for sensitive actions

## Bottom Line
The schema supports the product well, but it appears more workflow-driven than normalized. That is common for internal operations apps, but it should be reinforced with stronger constraints, clear RLS, and a validated schema document from Supabase itself.
