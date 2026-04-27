/**
 * SupervisorPortal.tsx — Detroit Axle QA System
 * Redesigned with a refined dark-glass aesthetic:
 *  - Geist + Geist Mono typography (inherited from shell)
 *  - CSS custom property theming (light/dark aware)
 *  - Glass-morphism panels with layered depth
 *  - Smooth transitions and micro-interactions
 *  - Compact, information-dense layout (Linear/Vercel-style)
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import MonitoringWidget from "./MonitoringWidget";
import MonitoringDrawer from "./MonitoringDrawer";
import SupervisorRequestsSupabase from "./SupervisorRequestsSupabase";
import RecognitionWall from "./RecognitionWall";
import DigitalTrophyCabinet from "./DigitalTrophyCabinet";
import SupervisorTeamDashboard from "./SupervisorTeamDashboard";

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamName = "Calls" | "Tickets" | "Sales";

type UserProfile = {
  id: string;
  role: "admin" | "qa" | "agent" | "supervisor";
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
  email: string;
};

type AgentProfile = {
  id: string;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
  email: string;
};

type ScoreDetail = {
  metric: string;
  result: string;
  pass: number;
  borderline: number;
  adjustedWeight: number;
  earned: number;
  counts_toward_score?: boolean;
  metric_comment?: string | null;
};

type AuditItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName;
  case_type: string;
  audit_date: string;
  order_number?: string | null;
  phone_number?: string | null;
  ticket_id?: string | null;
  quality_score: number;
  comments: string | null;
  score_details: ScoreDetail[];
  shared_with_agent?: boolean;
  created_by_name?: string | null;
  created_by_email?: string | null;
  shared_at?: string | null;
};

type TeamRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  calls_count?: number;
  tickets_count?: number;
  amount?: number;
  call_date?: string;
  ticket_date?: string;
  sale_date?: string;
  date_to?: string | null;
  notes: string | null;
};

type MonitoringItem = {
  id: string;
  order_number: string;
  comment: string;
  agent_id: string;
  agent_name: string;
  display_name: string | null;
  team: TeamName;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  status: "active" | "resolved";
  acknowledged_by_agent: boolean;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolved_by_email: string | null;
};

type SupervisorPortalTab = "overview" | "team-dashboard" | "requests";

type SupervisorPortalProps = {
  currentUser: UserProfile;
  initialTab?: SupervisorPortalTab;
  hideInternalTabs?: boolean;
};

type AgentFeedback = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName;
  qa_name: string;
  feedback_type: "Coaching" | "Audit Feedback" | "Warning" | "Follow-up";
  subject: string;
  feedback_note: string;
  action_plan?: string | null;
  due_date: string | null;
  status: "Open" | "In Progress" | "Closed";
  created_at: string;
  acknowledged_by_agent?: boolean | null;
};

type ReviewStage =
  | "QA Shared"
  | "Acknowledged"
  | "Agent Responded"
  | "Supervisor Reviewed"
  | "Follow-up"
  | "Closed";
type PlanPriority = "Low" | "Medium" | "High" | "Critical";
type FollowUpOutcome =
  | "Not Set"
  | "Improved"
  | "Partial Improvement"
  | "No Improvement"
  | "Needs Escalation";

// ─── Constants ────────────────────────────────────────────────────────────────

const MONITORING_VIEW_OFFSET = 224;
const MONITORING_VIEW_GAP = 16;

const COACHING_PLAN_SECTION_LABELS = [
  "Priority",
  "Action Plan",
  "Justification",
  "Review Stage",
  "Agent Comment",
  "Supervisor Review",
  "Follow-up Outcome",
  "Resolution Note",
] as const;

// ─── Coaching plan helpers ────────────────────────────────────────────────────

function escapeCoachingRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeReviewStage(value?: string | null): ReviewStage {
  const valid: ReviewStage[] = [
    "QA Shared",
    "Acknowledged",
    "Agent Responded",
    "Supervisor Reviewed",
    "Follow-up",
    "Closed",
  ];
  return valid.includes(value as ReviewStage)
    ? (value as ReviewStage)
    : "QA Shared";
}

function normalizeFeedbackPriority(value?: string | null): PlanPriority {
  const valid: PlanPriority[] = ["Low", "Medium", "High", "Critical"];
  return valid.includes(value as PlanPriority)
    ? (value as PlanPriority)
    : "Medium";
}

function normalizeFeedbackOutcome(value?: string | null): FollowUpOutcome {
  const valid: FollowUpOutcome[] = [
    "Improved",
    "Partial Improvement",
    "No Improvement",
    "Needs Escalation",
  ];
  return valid.includes(value as FollowUpOutcome)
    ? (value as FollowUpOutcome)
    : "Not Set";
}

function parseCoachingPlan(value?: string | null) {
  const raw = String(value || "").trim();
  const labelsPattern = COACHING_PLAN_SECTION_LABELS.map((l) =>
    escapeCoachingRegex(l)
  ).join("|");

  function readSection(label: (typeof COACHING_PLAN_SECTION_LABELS)[number]) {
    const regex = new RegExp(
      `${escapeCoachingRegex(label)}:\n([\\s\\S]*?)(?=\\n(?:${labelsPattern}):\n|$)`
    );
    const match = raw.match(regex);
    return match ? match[1].trim() : "";
  }

  const hasStructuredSections = COACHING_PLAN_SECTION_LABELS.some((l) =>
    raw.includes(`${l}:`)
  );

  return {
    priority: normalizeFeedbackPriority(readSection("Priority")),
    actionPlan: hasStructuredSections ? readSection("Action Plan") : raw,
    justification: readSection("Justification"),
    reviewStage: normalizeReviewStage(readSection("Review Stage")),
    agentComment: readSection("Agent Comment"),
    supervisorReview: readSection("Supervisor Review"),
    followUpOutcome: normalizeFeedbackOutcome(readSection("Follow-up Outcome")),
    resolutionNote: readSection("Resolution Note"),
  };
}

function composeCoachingPlan(fields: {
  priority: PlanPriority;
  actionPlan: string;
  justification: string;
  reviewStage: ReviewStage;
  agentComment: string;
  supervisorReview: string;
  followUpOutcome: FollowUpOutcome;
  resolutionNote: string;
}) {
  const sections = [
    `Priority:\n${fields.priority}`,
    fields.actionPlan.trim() ? `Action Plan:\n${fields.actionPlan.trim()}` : "",
    fields.justification.trim()
      ? `Justification:\n${fields.justification.trim()}`
      : "",
    `Review Stage:\n${fields.reviewStage}`,
    fields.agentComment.trim()
      ? `Agent Comment:\n${fields.agentComment.trim()}`
      : "",
    fields.supervisorReview.trim()
      ? `Supervisor Review:\n${fields.supervisorReview.trim()}`
      : "",
    fields.followUpOutcome !== "Not Set"
      ? `Follow-up Outcome:\n${fields.followUpOutcome}`
      : "",
    fields.resolutionNote.trim()
      ? `Resolution Note:\n${fields.resolutionNote.trim()}`
      : "",
  ].filter(Boolean);
  return sections.join("\n\n").trim();
}

function openNativeDatePicker(target: HTMLInputElement) {
  const input = target as HTMLInputElement & { showPicker?: () => void };
  input.showPicker?.();
}

// ─── Theme hook ───────────────────────────────────────────────────────────────

function useThemeRefresh() {
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refresh = () => setKey((k) => k + 1);
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("storage", refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return key;
}

// ─── Global styles (injected once) ───────────────────────────────────────────

const SP_STYLE_ID = "da-supervisor-portal-v5";
const SP_CSS = `
/* ── Supervisor Portal Styles ── */
.sp-root {
  font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
  color: var(--fg-default, #f1f5f9);
}

/* Stat cards */
.sp-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
  margin: 20px 0;
}
.sp-stat {
  background: var(--bg-elevated, #111118);
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  border-radius: 12px;
  padding: 16px;
  transition: border-color 150ms ease, background 150ms ease;
}
.sp-stat:hover {
  border-color: var(--border-strong, rgba(255,255,255,0.12));
  background: var(--bg-overlay, #16161f);
}
.sp-stat-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted, #64748b);
  margin-bottom: 10px;
}
.sp-stat-value {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--fg-default, #f1f5f9);
  line-height: 1;
}
.sp-stat-sub {
  font-size: 11px;
  color: var(--fg-muted, #64748b);
  margin-top: 5px;
  font-weight: 500;
}
.sp-stat.sp-stat--accent-blue .sp-stat-value { color: var(--accent-blue, #3b82f6); }
.sp-stat.sp-stat--accent-violet .sp-stat-value { color: var(--accent-violet, #8b5cf6); }
.sp-stat.sp-stat--accent-amber .sp-stat-value { color: var(--accent-amber, #f59e0b); }
.sp-stat.sp-stat--accent-rose .sp-stat-value { color: var(--accent-rose, #f43f5e); }
.sp-stat.sp-stat--accent-emerald .sp-stat-value { color: var(--accent-emerald, #10b981); }

/* Section */
.sp-section {
  background: var(--bg-elevated, #111118);
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  border-radius: 16px;
  margin-top: 24px;
  overflow: hidden;
}
.sp-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
  gap: 12px;
}
.sp-section-title-group {}
.sp-section-eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-subtle, #334155);
  margin-bottom: 3px;
}
.sp-section-title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fg-default, #f1f5f9);
  margin: 0;
}
.sp-section-body {
  padding: 16px 20px;
}
.sp-section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Tabs */
.sp-tabs {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--bg-subtle, rgba(255,255,255,0.04));
  border-radius: 10px;
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  margin-bottom: 24px;
  width: fit-content;
}
.sp-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--fg-muted, #64748b);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 140ms ease;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.sp-tab:hover { color: var(--fg-default, #f1f5f9); background: var(--bg-subtle-hover, rgba(255,255,255,0.07)); }
.sp-tab.active {
  background: var(--bg-overlay, #16161f);
  color: var(--fg-default, #f1f5f9);
  border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.sp-tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  background: var(--accent-blue, #3b82f6);
  color: #fff;
  line-height: 1;
}

/* Filter panel */
.sp-filter-panel {
  background: var(--bg-elevated, #111118);
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  border-radius: 16px;
  padding: 16px 20px;
  margin-bottom: 20px;
}
.sp-filter-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.sp-filter-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

/* Form elements */
.sp-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fg-muted, #64748b);
  margin-bottom: 6px;
}
.sp-input, .sp-select, .sp-textarea {
  width: 100%;
  padding: 8px 11px;
  border-radius: 8px;
  border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
  background: var(--bg-base, #0a0a0f);
  color: var(--fg-default, #f1f5f9);
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  outline: none;
  transition: border-color 120ms ease;
  -webkit-appearance: none;
  appearance: none;
}
.sp-input:focus, .sp-select:focus, .sp-textarea:focus {
  border-color: var(--accent-blue, #3b82f6);
}
.sp-input::placeholder { color: var(--fg-subtle, #334155); }
.sp-select option { background: var(--bg-overlay, #16161f); }
.sp-textarea {
  resize: vertical;
  min-height: 90px;
  line-height: 1.6;
}

/* Agent picker */
.sp-picker-btn {
  width: 100%;
  padding: 8px 11px;
  border-radius: 8px;
  border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
  background: var(--bg-base, #0a0a0f);
  color: var(--fg-default, #f1f5f9);
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  text-align: left;
  transition: border-color 120ms ease;
}
.sp-picker-btn:hover { border-color: var(--accent-blue, #3b82f6); }
.sp-picker-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--bg-overlay, #16161f);
  border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
  overflow: hidden;
  animation: sp-dropdown-in 120ms ease both;
}
@keyframes sp-dropdown-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.sp-picker-search { padding: 10px; border-bottom: 1px solid var(--border, rgba(255,255,255,0.07)); }
.sp-picker-list {
  max-height: 260px;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sp-picker-option {
  padding: 9px 11px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-default, #f1f5f9);
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 80ms ease;
}
.sp-picker-option:hover { background: var(--bg-subtle-hover, rgba(255,255,255,0.07)); }
.sp-picker-option.active {
  background: color-mix(in srgb, var(--accent-blue, #3b82f6) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent-blue, #3b82f6) 25%, transparent);
  color: var(--accent-blue, #3b82f6);
}

/* Buttons */
.sp-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: 7px;
  border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
  background: var(--bg-elevated, #111118);
  color: var(--fg-muted, #64748b);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 120ms ease;
  white-space: nowrap;
  letter-spacing: -0.01em;
}
.sp-btn:hover { color: var(--fg-default, #f1f5f9); border-color: var(--border-strong, rgba(255,255,255,0.18)); background: var(--bg-overlay, #16161f); }
.sp-btn.sp-btn--primary {
  background: var(--accent-blue, #3b82f6);
  border-color: var(--accent-blue, #3b82f6);
  color: #fff;
}
.sp-btn.sp-btn--primary:hover { background: color-mix(in srgb, var(--accent-blue, #3b82f6) 85%, #fff 15%); }
.sp-btn.sp-btn--danger { color: var(--accent-rose, #f43f5e); border-color: color-mix(in srgb, var(--accent-rose, #f43f5e) 30%, transparent); }
.sp-btn.sp-btn--danger:hover { background: color-mix(in srgb, var(--accent-rose, #f43f5e) 10%, transparent); color: var(--accent-rose, #f43f5e); }
.sp-btn.sp-btn--sm { height: 26px; padding: 0 9px; font-size: 11px; }

/* Badge / pill */
.sp-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
}
.sp-badge--blue   { background: color-mix(in srgb, var(--accent-blue,#3b82f6) 15%, transparent);   color: var(--accent-blue,#3b82f6);   border: 1px solid color-mix(in srgb, var(--accent-blue,#3b82f6) 25%, transparent); }
.sp-badge--violet { background: color-mix(in srgb, var(--accent-violet,#8b5cf6) 15%, transparent); color: var(--accent-violet,#8b5cf6); border: 1px solid color-mix(in srgb, var(--accent-violet,#8b5cf6) 25%, transparent); }
.sp-badge--amber  { background: color-mix(in srgb, var(--accent-amber,#f59e0b) 15%, transparent);  color: var(--accent-amber,#f59e0b);  border: 1px solid color-mix(in srgb, var(--accent-amber,#f59e0b) 25%, transparent); }
.sp-badge--rose   { background: color-mix(in srgb, var(--accent-rose,#f43f5e) 15%, transparent);   color: var(--accent-rose,#f43f5e);   border: 1px solid color-mix(in srgb, var(--accent-rose,#f43f5e) 25%, transparent); }
.sp-badge--emerald{ background: color-mix(in srgb, var(--accent-emerald,#10b981) 15%, transparent);color: var(--accent-emerald,#10b981);border: 1px solid color-mix(in srgb, var(--accent-emerald,#10b981) 25%, transparent); }
.sp-badge--muted  { background: var(--bg-overlay, #16161f); color: var(--fg-muted, #64748b); border: 1px solid var(--border, rgba(255,255,255,0.07)); }

/* Error / Notice banners */
.sp-error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-rose, #f43f5e) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-rose, #f43f5e) 25%, transparent);
  color: var(--accent-rose, #f43f5e);
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 16px;
}
.sp-notice-banner {
  padding: 10px 14px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-amber, #f59e0b) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-amber, #f59e0b) 20%, transparent);
  color: var(--fg-default, #f1f5f9);
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 14px;
}

/* Table */
.sp-table-wrap {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--border, rgba(255,255,255,0.07));
}
.sp-table { width: 100%; border-collapse: collapse; }
.sp-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--fg-subtle, #334155);
  background: var(--bg-subtle, rgba(255,255,255,0.04));
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
  white-space: nowrap;
}
.sp-table td {
  padding: 11px 14px;
  font-size: 13px;
  color: var(--fg-default, #f1f5f9);
  font-weight: 500;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.04));
  vertical-align: top;
}
.sp-table tr:last-child td { border-bottom: none; }
.sp-table tr { transition: background 80ms ease; }
.sp-table tbody tr:hover { background: var(--bg-subtle, rgba(255,255,255,0.03)); }

/* Coaching cards */
.sp-coaching-card {
  border-radius: 12px;
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  background: var(--bg-base, #0a0a0f);
  overflow: hidden;
  transition: border-color 150ms ease;
}
.sp-coaching-card:hover { border-color: var(--border-strong, rgba(255,255,255,0.12)); }
.sp-coaching-card.sp-coaching-card--urgent { border-color: color-mix(in srgb, var(--accent-amber, #f59e0b) 30%, transparent); }
.sp-coaching-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto auto auto;
  gap: 14px;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 80ms ease;
  min-width: 0;
}
.sp-coaching-row:hover { background: var(--bg-subtle, rgba(255,255,255,0.03)); }
.sp-coaching-type-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.sp-coaching-subject {
  min-width: 0;
}
.sp-coaching-subject-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-default, #f1f5f9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}
.sp-coaching-subject-meta {
  font-size: 11px;
  color: var(--fg-muted, #64748b);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sp-coaching-expanded {
  padding: 16px;
  border-top: 1px solid var(--border, rgba(255,255,255,0.07));
  background: var(--bg-elevated, #111118);
  display: grid;
  gap: 12px;
  animation: sp-expand-in 160ms ease both;
}
@keyframes sp-expand-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* Detail fields */
.sp-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}
.sp-detail-field {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  background: var(--bg-base, #0a0a0f);
}
.sp-detail-field-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--fg-subtle, #334155);
  margin-bottom: 5px;
}
.sp-detail-field-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-default, #f1f5f9);
  line-height: 1.4;
}
.sp-text-block {
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  background: var(--bg-base, #0a0a0f);
}
.sp-text-block-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--fg-subtle, #334155);
  margin-bottom: 7px;
}
.sp-text-block-content {
  font-size: 13px;
  color: var(--fg-default, #f1f5f9);
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Audit cards */
.sp-audit-list { display: grid; gap: 8px; max-height: 440px; overflow-y: auto; padding-right: 2px; }
.sp-audit-card {
  border-radius: 10px;
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  background: var(--bg-base, #0a0a0f);
  overflow: hidden;
  transition: border-color 150ms ease;
}
.sp-audit-card:hover { border-color: var(--border-strong, rgba(255,255,255,0.12)); }
.sp-audit-card.active { border-color: color-mix(in srgb, var(--accent-blue, #3b82f6) 35%, transparent); }
.sp-audit-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
}
.sp-audit-card-header:hover { background: var(--bg-subtle, rgba(255,255,255,0.03)); }
.sp-audit-card-left {}
.sp-audit-card-type {
  font-size: 13px;
  font-weight: 700;
  color: var(--fg-default, #f1f5f9);
  letter-spacing: -0.01em;
}
.sp-audit-card-meta {
  font-size: 11px;
  color: var(--fg-muted, #64748b);
  margin-top: 2px;
  font-weight: 500;
}
.sp-audit-card-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.sp-audit-score {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--fg-default, #f1f5f9);
}
.sp-audit-score.good { color: var(--accent-emerald, #10b981); }
.sp-audit-score.medium { color: var(--accent-amber, #f59e0b); }
.sp-audit-score.poor { color: var(--accent-rose, #f43f5e); }
.sp-audit-expanded {
  padding: 12px 14px;
  border-top: 1px solid var(--border, rgba(255,255,255,0.07));
  background: var(--bg-elevated, #111118);
  display: grid;
  gap: 10px;
  animation: sp-expand-in 160ms ease both;
}
.sp-score-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 11px;
  border-radius: 7px;
  border: 1px solid var(--border, rgba(255,255,255,0.05));
  background: var(--bg-base, #0a0a0f);
  font-size: 12px;
}
.sp-score-row-metric { font-weight: 600; color: var(--fg-default, #f1f5f9); flex: 1; min-width: 0; }
.sp-score-row-meta { font-size: 11px; color: var(--fg-muted, #64748b); margin-top: 2px; }
.sp-metric-note {
  margin-top: 6px;
  padding: 7px 9px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--accent-blue, #3b82f6) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent-blue, #3b82f6) 15%, transparent);
  font-size: 11px;
  color: var(--fg-default, #f1f5f9);
  line-height: 1.5;
}

/* Coaching stats mini grid */
.sp-mini-stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
.sp-mini-stat {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border, rgba(255,255,255,0.07));
  background: var(--bg-base, #0a0a0f);
  text-align: center;
}
.sp-mini-stat-label { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-muted, #64748b); margin-bottom: 6px; }
.sp-mini-stat-value { font-size: 22px; font-weight: 800; letter-spacing: -0.03em; color: var(--fg-default, #f1f5f9); }

/* Divider */
.sp-divider { height: 1px; background: var(--border, rgba(255,255,255,0.07)); margin: 14px 0; }

/* Coaching list */
.sp-coaching-list { display: grid; gap: 6px; }

/* Records table adjustments */
.sp-table--records th:first-child, .sp-table--records td:first-child { min-width: 180px; }

/* Collapsible toggle */
.sp-chevron {
  width: 16px; height: 16px;
  display: inline-block;
  transition: transform 180ms ease;
  color: var(--fg-muted, #64748b);
}
.sp-chevron.open { transform: rotate(180deg); }

/* Page header */
.sp-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.sp-page-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-subtle, #334155);
  margin-bottom: 4px;
}
.sp-page-title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--fg-default, #f1f5f9);
  margin: 0;
}
.sp-page-sub {
  font-size: 13px;
  color: var(--fg-muted, #64748b);
  margin-top: 3px;
  font-weight: 500;
}

/* Empty state */
.sp-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--fg-muted, #64748b);
  font-size: 13px;
}

/* Audit comment preview */
.sp-comment-preview {
  margin: 4px 14px 8px;
  padding: 8px 10px;
  border-radius: 7px;
  background: var(--bg-subtle, rgba(255,255,255,0.04));
  font-size: 12px;
  color: var(--fg-muted, #64748b);
  line-height: 1.55;
  white-space: pre-wrap;
}

/* Audit ref meta */
.sp-audit-ref-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 0 14px 10px;
}

@media (max-width: 800px) {
  .sp-coaching-row {
    grid-template-columns: auto 1fr auto;
    gap: 10px;
  }
  .sp-coaching-row > *:nth-child(4),
  .sp-coaching-row > *:nth-child(5) { display: none; }
  .sp-tabs { width: 100%; }
  .sp-tab { flex: 1; justify-content: center; }
  .sp-mini-stat-grid { grid-template-columns: 1fr; }
}
`;

function injectSPStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SP_STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = SP_STYLE_ID;
  el.textContent = SP_CSS;
  document.head.appendChild(el);
}

// ─── Small helper components ──────────────────────────────────────────────────

function ChevronIcon({ open, size = 14 }: { open: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`sp-chevron${open ? " open" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function RefreshIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function FilterIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "blue" | "violet" | "amber" | "rose" | "emerald";
}) {
  return (
    <div className={`sp-stat${accent ? ` sp-stat--accent-${accent}` : ""}`}>
      <div className="sp-stat-label">{label}</div>
      <div className="sp-stat-value">{value}</div>
      {sub && <div className="sp-stat-sub">{sub}</div>}
    </div>
  );
}

function SectionPanel({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="sp-section">
      <div className="sp-section-header">
        <div className="sp-section-title-group">
          {eyebrow && <div className="sp-section-eyebrow">{eyebrow}</div>}
          <h3 className="sp-section-title">{title}</h3>
        </div>
        {actions && <div className="sp-section-actions">{actions}</div>}
      </div>
      <div className="sp-section-body">{children}</div>
    </div>
  );
}

// ─── Stage / type color helpers ───────────────────────────────────────────────

function getStageClass(stage: ReviewStage): string {
  if (stage === "Closed") return "sp-badge--emerald";
  if (stage === "Supervisor Reviewed") return "sp-badge--amber";
  if (stage === "Agent Responded" || stage === "Acknowledged") return "sp-badge--blue";
  if (stage === "Follow-up") return "sp-badge--violet";
  return "sp-badge--muted";
}

function getFeedbackTypeColor(type: string): string {
  if (type === "Warning") return "#f43f5e";
  if (type === "Audit Feedback") return "#8b5cf6";
  if (type === "Follow-up") return "#f59e0b";
  return "#10b981";
}

function getResultBadgeClass(result: string): string {
  if (result === "Pass" || result === "Yes") return "sp-badge--emerald";
  if (result === "Borderline") return "sp-badge--amber";
  if (result === "Fail" || result === "Auto-Fail" || result === "No") return "sp-badge--rose";
  return "sp-badge--muted";
}

function getScoreClass(score: number): string {
  if (score >= 90) return "good";
  if (score >= 75) return "medium";
  return "poor";
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateOnly(v?: string | null) {
  if (!v) return "—";
  const d = new Date(`${v}T00:00:00`);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Main component ───────────────────────────────────────────────────────────

function SupervisorPortal({
  currentUser,
  initialTab = "overview",
  hideInternalTabs = false,
}: SupervisorPortalProps) {
  injectSPStyles();

  const [teamAgents, setTeamAgents] = useState<AgentProfile[]>([]);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [records, setRecords] = useState<TeamRecord[]>([]);
  const [monitoringItems, setMonitoringItems] = useState<MonitoringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [selectedAgentProfileId, setSelectedAgentProfileId] = useState("");
  const [agentSearch, setAgentSearch] = useState("");
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);

  const [monitoringOpen, setMonitoringOpen] = useState(false);
  const [monitoringAgentFilter, setMonitoringAgentFilter] = useState("");

  const [activeTab, setActiveTab] = useState<SupervisorPortalTab>(initialTab);

  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [auditsVisible, setAuditsVisible] = useState(true);

  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [recordDateFrom, setRecordDateFrom] = useState("");
  const [recordDateTo, setRecordDateTo] = useState("");

  const [feedbackItems, setFeedbackItems] = useState<AgentFeedback[]>([]);
  const [reviewStageDrafts, setReviewStageDrafts] = useState<Record<string, ReviewStage>>({});
  const [supervisorReviewDrafts, setSupervisorReviewDrafts] = useState<Record<string, string>>({});
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

  const agentPickerRef = useRef<HTMLDivElement | null>(null);
  const pageRootRef = useRef<HTMLDivElement | null>(null);
  useThemeRefresh(); // keeps theme vars reactive

  useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
  useEffect(() => { void loadTeamData(false); }, [currentUser.id, currentUser.team]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (agentPickerRef.current && !agentPickerRef.current.contains(e.target as Node)) {
        setIsAgentPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadTeamData(isRefresh: boolean) {
    if (!currentUser.team) {
      setErrorMessage("Your supervisor profile is missing a team assignment.");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage("");

    const [agentsR, auditsR, recordsR, monR, feedR] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, agent_id, agent_name, display_name, team, email")
        .eq("role", "agent")
        .eq("team", currentUser.team)
        .order("agent_name", { ascending: true }),
      supabase
        .from("audits")
        .select("*")
        .eq("team", currentUser.team)
        .order("audit_date", { ascending: false }),
      currentUser.team === "Calls"
        ? supabase.from("calls_records").select("*").order("call_date", { ascending: false })
        : currentUser.team === "Tickets"
        ? supabase.from("tickets_records").select("*").order("ticket_date", { ascending: false })
        : supabase.from("sales_records").select("*").order("sale_date", { ascending: false }),
      supabase
        .from("monitoring_items")
        .select("*")
        .eq("team", currentUser.team)
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      supabase
        .from("agent_feedback")
        .select("*")
        .eq("team", currentUser.team)
        .order("created_at", { ascending: false }),
    ]);

    const errors = [agentsR.error?.message, auditsR.error?.message, recordsR.error?.message, monR.error?.message, feedR.error?.message].filter(Boolean);
    if (errors.length) setErrorMessage(errors.join(" · "));

    setTeamAgents((agentsR.data as AgentProfile[]) || []);
    setAudits((auditsR.data as AuditItem[]) || []);
    setRecords((recordsR.data as TeamRecord[]) || []);
    setMonitoringItems((monR.data as MonitoringItem[]) || []);
    setFeedbackItems((feedR.data as AgentFeedback[]) || []);
    setLoading(false);
    setRefreshing(false);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function getAgentLabel(agentId?: string | null, agentName?: string | null) {
    const match = teamAgents.find(
      (p) => p.agent_id === (agentId || null) && p.agent_name === (agentName || "")
    );
    const display = match?.display_name;
    return display ? `${agentName || "—"} · ${display}` : `${agentName || "—"} · ${agentId || "—"}`;
  }

  function normalizeAgentId(v?: string | null) { return String(v || "").trim().replace(/\.0+$/, ""); }
  function normalizeAgentName(v?: string | null) { return String(v || "").trim().toLowerCase().replace(/\s+/g, " "); }

  function matchesDateRange(start?: string | null, end?: string | null, from?: string, to?: string) {
    const s = String(start || "").slice(0, 10);
    const e = String(end || start || "").slice(0, 10);
    if (!s) return false;
    const ef = from || "0001-01-01";
    const et = to || "9999-12-31";
    return e >= ef && s <= et;
  }

  function getAuditRef(audit: AuditItem) {
    if (audit.team === "Tickets") return audit.ticket_id ? `#${audit.ticket_id}` : "—";
    const parts = [audit.order_number && `Order #${audit.order_number}`, audit.phone_number].filter(Boolean);
    return parts.join(" · ") || "—";
  }

  function getRecordMetricLabel() {
    if (currentUser.team === "Calls") return "Calls";
    if (currentUser.team === "Tickets") return "Tickets";
    return "Amount";
  }

  function getRecordMetricValue(record: TeamRecord) {
    if (currentUser.team === "Calls") return String(record.calls_count ?? 0);
    if (currentUser.team === "Tickets") return String(record.tickets_count ?? 0);
    return `$${Number(record.amount || 0).toFixed(2)}`;
  }

  function getRecordStartDate(record: TeamRecord) {
    return record.call_date || record.ticket_date || record.sale_date || "—";
  }

  function isNoScoreDetail(d: ScoreDetail) {
    return d.counts_toward_score === false || (Number(d.pass) === 0 && Number(d.borderline) === 0 && Number(d.adjustedWeight) === 0);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const visibleAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    if (!q) return teamAgents;
    return teamAgents.filter((p) =>
      p.agent_name.toLowerCase().includes(q) ||
      (p.agent_id || "").toLowerCase().includes(q) ||
      (p.display_name || "").toLowerCase().includes(q)
    );
  }, [teamAgents, agentSearch]);

  const selectedAgent = teamAgents.find((p) => p.id === selectedAgentProfileId) || null;

  const filteredAudits = useMemo(() => audits.filter((a) => {
    const matchAgent = selectedAgent
      ? (normalizeAgentId(a.agent_id) === normalizeAgentId(selectedAgent.agent_id)) ||
        (normalizeAgentName(a.agent_name) === normalizeAgentName(selectedAgent.agent_name))
      : true;
    return matchAgent && matchesDateRange(a.audit_date, a.audit_date, auditDateFrom, auditDateTo);
  }), [audits, selectedAgent, auditDateFrom, auditDateTo]);

  const filteredRecords = useMemo(() => records.filter((r) => {
    const matchAgent = selectedAgent
      ? (normalizeAgentId(r.agent_id) === normalizeAgentId(selectedAgent.agent_id)) ||
        (normalizeAgentName(r.agent_name) === normalizeAgentName(selectedAgent.agent_name))
      : true;
    const start = r.call_date || r.ticket_date || r.sale_date || null;
    return matchAgent && matchesDateRange(start, r.date_to || null, recordDateFrom, recordDateTo);
  }), [records, selectedAgent, recordDateFrom, recordDateTo]);

  const avgQuality = filteredAudits.length
    ? (filteredAudits.reduce((s, a) => s + Number(a.quality_score), 0) / filteredAudits.length).toFixed(1)
    : "0.0";

  const releasedCount = filteredAudits.filter((a) => a.shared_with_agent).length;
  const hiddenCount = filteredAudits.length - releasedCount;
  const totalMetric = filteredRecords.reduce((s, r) => s + Number(r.calls_count || r.tickets_count || r.amount || 0), 0);

  const selectedAgentFeedback = useMemo(() => feedbackItems.filter((f) => {
    if (!selectedAgent) return true;
    return (
      (normalizeAgentId(f.agent_id) === normalizeAgentId(selectedAgent.agent_id) ||
        normalizeAgentName(f.agent_name) === normalizeAgentName(selectedAgent.agent_name)) &&
      f.team === selectedAgent.team
    );
  }), [feedbackItems, selectedAgent]);

  const teamOpenFeedback = useMemo(() => feedbackItems.filter((f) => f.status !== "Closed"), [feedbackItems]);
  const agentOpenFeedback = useMemo(() => selectedAgentFeedback.filter((f) => f.status !== "Closed"), [selectedAgentFeedback]);
  const coachingFallback = Boolean(selectedAgent) && agentOpenFeedback.length === 0 && teamOpenFeedback.length > 0;

  const supervisorInbox = useMemo(() => {
    const src = coachingFallback || !selectedAgent ? teamOpenFeedback : agentOpenFeedback;
    return [...src].sort((a, b) => {
      const ap = parseCoachingPlan(a.action_plan);
      const bp = parseCoachingPlan(b.action_plan);
      const aN = ap.reviewStage === "Agent Responded" ? 1 : 0;
      const bN = bp.reviewStage === "Agent Responded" ? 1 : 0;
      if (aN !== bN) return bN - aN;
      return String(b.created_at).localeCompare(String(a.created_at));
    });
  }, [coachingFallback, selectedAgent, agentOpenFeedback, teamOpenFeedback]);

  const awaitingSupCount = supervisorInbox.filter((f) => {
    const p = parseCoachingPlan(f.action_plan);
    return p.reviewStage === "Agent Responded" || (!!p.agentComment.trim() && !p.supervisorReview.trim());
  }).length;
  const awaitingAgentCount = supervisorInbox.filter((f) => !parseCoachingPlan(f.action_plan).agentComment.trim()).length;

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleSelectAgent(profile: AgentProfile) {
    setSelectedAgentProfileId(profile.id);
    setAgentSearch(getAgentLabel(profile.agent_id, profile.agent_name));
    setIsAgentPickerOpen(false);
  }

  function clearAgentFilter() {
    setSelectedAgentProfileId("");
    setAgentSearch("");
    setIsAgentPickerOpen(false);
  }

  function handleMonitoringClick() {
    setMonitoringAgentFilter(selectedAgent?.agent_id || "");
    if (typeof window !== "undefined") {
      const offset = window.innerWidth < 900 ? 0 : MONITORING_VIEW_OFFSET;
      const top = pageRootRef.current
        ? Math.max(0, window.scrollY + pageRootRef.current.getBoundingClientRect().top - (offset + MONITORING_VIEW_GAP))
        : 0;
      window.scrollTo({ top, behavior: "smooth" });
    }
    setMonitoringOpen(true);
  }

  async function handleSaveSupervisorReview(item: AgentFeedback) {
    setErrorMessage("");
    const parsed = parseCoachingPlan(item.action_plan);
    const nextReview = String(supervisorReviewDrafts[item.id] ?? parsed.supervisorReview).trim();
    const nextStage: ReviewStage = nextReview
      ? "Supervisor Reviewed"
      : reviewStageDrafts[item.id] || parsed.reviewStage;

    const nextPlan = composeCoachingPlan({
      priority: parsed.priority,
      actionPlan: parsed.actionPlan,
      justification: parsed.justification,
      reviewStage: nextStage,
      agentComment: parsed.agentComment,
      supervisorReview: nextReview,
      followUpOutcome: parsed.followUpOutcome,
      resolutionNote: parsed.resolutionNote,
    });

    const { data, error } = await supabase
      .from("agent_feedback")
      .update({ action_plan: nextPlan || null })
      .eq("id", item.id)
      .select("*")
      .single();

    if (error) { setErrorMessage(error.message); return; }

    setFeedbackItems((prev) => prev.map((e) => (e.id === item.id ? (data as AgentFeedback) : e)));
    setSupervisorReviewDrafts((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
    setReviewStageDrafts((prev) => { const n = { ...prev }; delete n[item.id]; return n; });
    void loadTeamData(true);
  }

  // ── Render: loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="sp-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "320px", gap: "16px" }}>
        <div
          style={{
            width: "36px", height: "36px",
            borderRadius: "50%",
            border: "2px solid var(--border-strong, rgba(255,255,255,0.12))",
            borderTopColor: "var(--accent-blue, #3b82f6)",
            borderRightColor: "var(--accent-violet, #8b5cf6)",
            animation: "spin 0.9s linear infinite",
          }}
        />
        <div>
          <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--fg-default, #f1f5f9)" }}>Loading supervisor portal</div>
          <div style={{ fontSize: "12px", color: "var(--fg-muted, #64748b)", marginTop: "3px" }}>Fetching team data…</div>
        </div>
      </div>
    );
  }

  // ── Render: main ──────────────────────────────────────────────────────────

  return (
    <div ref={pageRootRef} className="sp-root" style={{ scrollMarginTop: `${MONITORING_VIEW_OFFSET + MONITORING_VIEW_GAP}px` }}>

      {/* Page header */}
      <div className="sp-page-header">
        <div>
          <div className="sp-page-eyebrow">Supervisor Portal</div>
          <h2 className="sp-page-title">{currentUser.team} Team</h2>
          <div className="sp-page-sub">{teamAgents.length} agents · {audits.length} audits</div>
        </div>
        <button
          type="button"
          className={`sp-btn sp-btn--primary${refreshing ? "" : ""}`}
          onClick={() => void loadTeamData(true)}
          disabled={refreshing}
        >
          <RefreshIcon />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      {!hideInternalTabs && (
        <div className="sp-tabs">
          <button type="button" className={`sp-tab${activeTab === "overview" ? " active" : ""}`} onClick={() => setActiveTab("overview")}>
            Overview
          </button>
          <button type="button" className={`sp-tab${activeTab === "team-dashboard" ? " active" : ""}`} onClick={() => setActiveTab("team-dashboard")}>
            Team Dashboard
          </button>
          <button type="button" className={`sp-tab${activeTab === "requests" ? " active" : ""}`} onClick={() => setActiveTab("requests")}>
            Requests
            {awaitingSupCount > 0 && <span className="sp-tab-badge">{awaitingSupCount}</span>}
          </button>
        </div>
      )}

      {/* ── Requests tab ── */}
      {activeTab === "requests" && (
        <div style={{ marginTop: "4px" }}>
          <SupervisorRequestsSupabase currentUser={currentUser} />
        </div>
      )}

      {/* ── Team Dashboard tab ── */}
      {activeTab === "team-dashboard" && (
        <div style={{ marginTop: "4px" }}>
          <SupervisorTeamDashboard
            currentTeam={currentUser.team as TeamName}
            agents={teamAgents}
            audits={audits}
            feedbackItems={feedbackItems}
            monitoringItems={monitoringItems}
            records={records}
            selectedAgent={selectedAgent}
          />
        </div>
      )}

      {/* ── Overview tab ── */}
      {activeTab === "overview" && (
        <>
          {errorMessage && (
            <div className="sp-error-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {errorMessage}
            </div>
          )}

          {/* ─── Filter Panel ─── */}
          <div className="sp-filter-panel">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
              <FilterIcon />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--fg-default, #f1f5f9)", letterSpacing: "-0.01em" }}>Filters</span>
              {selectedAgent && (
                <span className="sp-badge sp-badge--blue" style={{ marginLeft: "4px" }}>
                  {selectedAgent.display_name || selectedAgent.agent_name}
                </span>
              )}
            </div>

            {/* Agent picker */}
            <div ref={agentPickerRef} style={{ position: "relative", marginTop: "12px" }}>
              <label className="sp-label">Agent</label>
              <button
                type="button"
                className="sp-picker-btn"
                onClick={() => setIsAgentPickerOpen((p) => !p)}
              >
                <span style={{ color: selectedAgent ? "var(--fg-default, #f1f5f9)" : "var(--fg-subtle, #334155)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedAgent
                    ? getAgentLabel(selectedAgent.agent_id, selectedAgent.agent_name)
                    : "All agents"}
                </span>
                <ChevronIcon open={isAgentPickerOpen} />
              </button>

              {isAgentPickerOpen && (
                <div className="sp-picker-menu">
                  <div className="sp-picker-search">
                    <input
                      type="text"
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                      placeholder="Search by name or ID…"
                      className="sp-input"
                      style={{ marginBottom: 0 }}
                      autoFocus
                    />
                  </div>
                  <div className="sp-picker-list">
                    <button type="button" className={`sp-picker-option${!selectedAgent ? " active" : ""}`} onClick={clearAgentFilter}>
                      All agents
                    </button>
                    {visibleAgents.length === 0 ? (
                      <div style={{ padding: "10px 12px", color: "var(--fg-muted, #64748b)", fontSize: "12px" }}>No agents found</div>
                    ) : (
                      visibleAgents.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          className={`sp-picker-option${selectedAgentProfileId === profile.id ? " active" : ""}`}
                          onClick={() => handleSelectAgent(profile)}
                        >
                          {getAgentLabel(profile.agent_id, profile.agent_name)}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Date filters */}
            <div className="sp-filter-grid">
              <div>
                <label className="sp-label">Audit Date From</label>
                <input type="date" value={auditDateFrom} onChange={(e) => setAuditDateFrom(e.target.value)} onClick={(e) => openNativeDatePicker(e.currentTarget)} onFocus={(e) => openNativeDatePicker(e.currentTarget)} className="sp-input" />
              </div>
              <div>
                <label className="sp-label">Audit Date To</label>
                <input type="date" value={auditDateTo} onChange={(e) => setAuditDateTo(e.target.value)} onClick={(e) => openNativeDatePicker(e.currentTarget)} onFocus={(e) => openNativeDatePicker(e.currentTarget)} className="sp-input" />
              </div>
              <div>
                <label className="sp-label">Records Date From</label>
                <input type="date" value={recordDateFrom} onChange={(e) => setRecordDateFrom(e.target.value)} onClick={(e) => openNativeDatePicker(e.currentTarget)} onFocus={(e) => openNativeDatePicker(e.currentTarget)} className="sp-input" />
              </div>
              <div>
                <label className="sp-label">Records Date To</label>
                <input type="date" value={recordDateTo} onChange={(e) => setRecordDateTo(e.target.value)} onClick={(e) => openNativeDatePicker(e.currentTarget)} onFocus={(e) => openNativeDatePicker(e.currentTarget)} className="sp-input" />
              </div>
            </div>

            <div className="sp-filter-actions">
              {selectedAgent && <button type="button" className="sp-btn" onClick={clearAgentFilter}>Clear Agent</button>}
              {(auditDateFrom || auditDateTo) && <button type="button" className="sp-btn" onClick={() => { setAuditDateFrom(""); setAuditDateTo(""); }}>Clear Audit Dates</button>}
              {(recordDateFrom || recordDateTo) && <button type="button" className="sp-btn" onClick={() => { setRecordDateFrom(""); setRecordDateTo(""); }}>Clear Record Dates</button>}
            </div>
          </div>

          {/* ─── Stats ─── */}
          <div className="sp-stat-grid">
            <StatCard label="Team Agents" value={String(teamAgents.length)} accent="blue" />
            <StatCard label={selectedAgent ? "Filtered Audits" : "Total Audits"} value={String(filteredAudits.length)} />
            <StatCard label="Avg Quality" value={`${avgQuality}%`} accent={Number(avgQuality) >= 90 ? "emerald" : Number(avgQuality) >= 75 ? "amber" : "rose"} />
            <StatCard label="Released" value={String(releasedCount)} accent="emerald" sub={`${hiddenCount} hidden`} />
            <StatCard label={currentUser.team === "Sales" ? "Total Sales" : `Total ${currentUser.team}`} value={currentUser.team === "Sales" ? `$${totalMetric.toFixed(0)}` : String(totalMetric)} accent="violet" />
            <StatCard label="Active Alerts" value={String(monitoringItems.length)} accent={monitoringItems.length > 0 ? "rose" : undefined} />
            <StatCard label="Awaiting Review" value={String(awaitingSupCount)} accent={awaitingSupCount > 0 ? "amber" : undefined} />
            <StatCard label="Awaiting Agent" value={String(awaitingAgentCount)} />
          </div>

          {/* ─── Coaching Queue ─── */}
          <SectionPanel
            eyebrow="Coaching"
            title="Review Queue"
            actions={
              <span style={{ fontSize: "12px", color: "var(--fg-muted, #64748b)", fontWeight: "500" }}>
                {supervisorInbox.length} open
              </span>
            }
          >
            <div className="sp-mini-stat-grid">
              <div className="sp-mini-stat">
                <div className="sp-mini-stat-label">Visible</div>
                <div className="sp-mini-stat-value">{supervisorInbox.length}</div>
              </div>
              <div className="sp-mini-stat">
                <div className="sp-mini-stat-label">Awaiting Agent</div>
                <div className="sp-mini-stat-value" style={{ color: awaitingAgentCount > 0 ? "var(--accent-amber, #f59e0b)" : undefined }}>{awaitingAgentCount}</div>
              </div>
              <div className="sp-mini-stat">
                <div className="sp-mini-stat-label">Needs Review</div>
                <div className="sp-mini-stat-value" style={{ color: awaitingSupCount > 0 ? "var(--accent-rose, #f43f5e)" : undefined }}>{awaitingSupCount}</div>
              </div>
            </div>

            {coachingFallback && (
              <div className="sp-notice-banner">
                No open coaching items for the selected agent — showing full team queue instead.
              </div>
            )}

            {supervisorInbox.length === 0 ? (
              <div className="sp-empty">No open coaching items for this filter.</div>
            ) : (
              <div className="sp-coaching-list">
                {supervisorInbox.map((item) => {
                  const parsed = parseCoachingPlan(item.action_plan);
                  const isExpanded = expandedFeedbackId === item.id;
                  const isUrgent = parsed.reviewStage === "Agent Responded" || (!!parsed.agentComment.trim() && !parsed.supervisorReview.trim());

                  return (
                    <div key={item.id} className={`sp-coaching-card${isUrgent ? " sp-coaching-card--urgent" : ""}`}>
                      {/* Row */}
                      <div
                        className="sp-coaching-row"
                        onClick={() => setExpandedFeedbackId(isExpanded ? null : item.id)}
                      >
                        <div
                          className="sp-coaching-type-dot"
                          style={{ background: getFeedbackTypeColor(item.feedback_type) }}
                        />

                        <div className="sp-coaching-subject">
                          <div className="sp-coaching-subject-text">{item.subject}</div>
                          <div className="sp-coaching-subject-meta">
                            {getAgentLabel(item.agent_id, item.agent_name)} · {fmtDateOnly(item.due_date)}
                          </div>
                        </div>

                        <span className={`sp-badge sp-badge--${item.feedback_type === "Warning" ? "rose" : item.feedback_type === "Audit Feedback" ? "violet" : item.feedback_type === "Follow-up" ? "amber" : "emerald"}`}>
                          {item.feedback_type}
                        </span>

                        <span className={`sp-badge ${getStageClass(parsed.reviewStage)}`}>
                          {parsed.reviewStage}
                        </span>

                        <span className={`sp-badge ${item.acknowledged_by_agent ? "sp-badge--emerald" : "sp-badge--amber"}`}>
                          {item.acknowledged_by_agent ? "Acknowledged" : "Pending"}
                        </span>

                        <ChevronIcon open={isExpanded} />
                      </div>

                      {/* Expanded */}
                      {isExpanded && (
                        <div className="sp-coaching-expanded">
                          <div className="sp-detail-grid">
                            <div className="sp-detail-field">
                              <div className="sp-detail-field-label">From QA</div>
                              <div className="sp-detail-field-value">{item.qa_name || "—"}</div>
                            </div>
                            <div className="sp-detail-field">
                              <div className="sp-detail-field-label">Created</div>
                              <div className="sp-detail-field-value">{fmtDate(item.created_at)}</div>
                            </div>
                            <div className="sp-detail-field">
                              <div className="sp-detail-field-label">Priority</div>
                              <div className="sp-detail-field-value">{parsed.priority}</div>
                            </div>
                            <div className="sp-detail-field">
                              <div className="sp-detail-field-label">Status</div>
                              <div className="sp-detail-field-value">{item.status}</div>
                            </div>
                            <div className="sp-detail-field">
                              <div className="sp-detail-field-label">Outcome</div>
                              <div className="sp-detail-field-value">{parsed.followUpOutcome}</div>
                            </div>
                            <div className="sp-detail-field">
                              <div className="sp-detail-field-label">Resolution</div>
                              <div className="sp-detail-field-value">{parsed.resolutionNote || "—"}</div>
                            </div>
                          </div>

                          {[
                            { label: "Coaching Summary", content: item.feedback_note },
                            { label: "Action Plan", content: parsed.actionPlan },
                            { label: "Justification", content: parsed.justification },
                            { label: "Agent Comment", content: parsed.agentComment || "No agent reply yet." },
                          ].map(({ label, content }) => (
                            <div key={label} className="sp-text-block">
                              <div className="sp-text-block-label">{label}</div>
                              <div className="sp-text-block-content">{content || "—"}</div>
                            </div>
                          ))}

                          <div className="sp-divider" />

                          <div style={{ display: "grid", gap: "10px" }}>
                            <div>
                              <label className="sp-label">Review Stage</label>
                              <select
                                value={reviewStageDrafts[item.id] || parsed.reviewStage}
                                onChange={(e) => setReviewStageDrafts((prev) => ({ ...prev, [item.id]: e.target.value as ReviewStage }))}
                                className="sp-select"
                              >
                                {(["QA Shared","Acknowledged","Agent Responded","Supervisor Reviewed","Follow-up","Closed"] as ReviewStage[]).map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="sp-label">Supervisor Review</label>
                              <textarea
                                value={supervisorReviewDrafts[item.id] ?? parsed.supervisorReview}
                                onChange={(e) => setSupervisorReviewDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                className="sp-textarea"
                                placeholder="Leave your review, decision, or escalation guidance…"
                              />
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button type="button" className="sp-btn sp-btn--primary" onClick={() => void handleSaveSupervisorReview(item)}>
                                Save Review
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionPanel>

          {/* ─── Audit History ─── */}
          <SectionPanel
            eyebrow={selectedAgent ? "Filtered" : currentUser.team || "Team"}
            title="Audit History"
            actions={
              <button type="button" className="sp-btn sp-btn--sm" onClick={() => setAuditsVisible((p) => !p)}>
                <ChevronIcon open={auditsVisible} size={12} />
                {auditsVisible ? "Collapse" : "Expand"}
              </button>
            }
          >
            {auditsVisible && (
              <>
                <div className="sp-mini-stat-grid" style={{ marginBottom: "16px" }}>
                  <div className="sp-mini-stat">
                    <div className="sp-mini-stat-label">Audits</div>
                    <div className="sp-mini-stat-value">{filteredAudits.length}</div>
                  </div>
                  <div className="sp-mini-stat">
                    <div className="sp-mini-stat-label">Released</div>
                    <div className="sp-mini-stat-value" style={{ color: "var(--accent-emerald, #10b981)" }}>{releasedCount}</div>
                  </div>
                  <div className="sp-mini-stat">
                    <div className="sp-mini-stat-label">Avg Score</div>
                    <div className="sp-mini-stat-value">{avgQuality}%</div>
                  </div>
                </div>

                {filteredAudits.length === 0 ? (
                  <div className="sp-empty">No audits match the current filter.</div>
                ) : (
                  <div className="sp-audit-list">
                    {filteredAudits.map((audit) => {
                      const isExp = expandedAuditId === audit.id;
                      const score = Number(audit.quality_score);
                      const preview = audit.comments?.trim()
                        ? audit.comments.trim().length > 160
                          ? audit.comments.trim().slice(0, 160) + "…"
                          : audit.comments.trim()
                        : null;

                      return (
                        <div key={audit.id} className={`sp-audit-card${isExp ? " active" : ""}`}>
                          <div className="sp-audit-card-header" onClick={() => setExpandedAuditId(isExp ? null : audit.id)}>
                            <div className="sp-audit-card-left">
                              <div className="sp-audit-card-type">{audit.case_type}</div>
                              <div className="sp-audit-card-meta">
                                {fmtDateOnly(audit.audit_date)} · {getAgentLabel(audit.agent_id, audit.agent_name)}
                              </div>
                            </div>
                            <div className="sp-audit-card-right">
                              <div className={`sp-audit-score ${getScoreClass(score)}`}>
                                {score.toFixed(1)}%
                              </div>
                              <span className={`sp-badge ${audit.shared_with_agent ? "sp-badge--emerald" : "sp-badge--muted"}`}>
                                {audit.shared_with_agent ? "Released" : "Hidden"}
                              </span>
                              <ChevronIcon open={isExp} />
                            </div>
                          </div>

                          {/* Ref + comment preview */}
                          <div className="sp-audit-ref-row">
                            <span className="sp-badge sp-badge--muted">{getAuditRef(audit)}</span>
                            {audit.shared_at && <span className="sp-badge sp-badge--muted">Released {fmtDateOnly(audit.shared_at)}</span>}
                          </div>

                          {preview && <div className="sp-comment-preview">{preview}</div>}

                          {/* Expanded */}
                          {isExp && (
                            <div className="sp-audit-expanded">
                              <div className="sp-text-block">
                                <div className="sp-text-block-label">Audit Comment</div>
                                <div className="sp-text-block-content">{audit.comments?.trim() || "No comment."}</div>
                              </div>

                              <div style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-subtle, #334155)", marginBottom: "6px" }}>
                                Score Details
                              </div>

                              <div style={{ display: "grid", gap: "4px" }}>
                                {(audit.score_details || []).map((d) => (
                                  <div key={d.metric} className="sp-score-row">
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className="sp-score-row-metric">{d.metric}</div>
                                      <div className="sp-score-row-meta">
                                        {isNoScoreDetail(d)
                                          ? "Yes/No · no score"
                                          : `Pass ${d.pass} · Borderline ${d.borderline} · Weight ${Number(d.adjustedWeight || 0).toFixed(2)}`}
                                      </div>
                                      {d.metric_comment && (
                                        <div className="sp-metric-note">
                                          <strong style={{ fontSize: "10px", letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--accent-blue, #3b82f6)", display: "block", marginBottom: "3px" }}>QA Note</strong>
                                          {d.metric_comment}
                                        </div>
                                      )}
                                    </div>
                                    <span className={`sp-badge ${getResultBadgeClass(d.result)}`}>
                                      {d.result}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {!auditsVisible && (
              <div style={{ color: "var(--fg-muted, #64748b)", fontSize: "13px" }}>
                Audit list is collapsed — {filteredAudits.length} audits available.
              </div>
            )}
          </SectionPanel>

          {/* ─── Team Records ─── */}
          <SectionPanel eyebrow={currentUser.team || "Team"} title="Records">
            {filteredRecords.length === 0 ? (
              <div className="sp-empty">No records match the current filter.</div>
            ) : (
              <div className="sp-table-wrap">
                <table className="sp-table sp-table--records">
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Date From</th>
                      <th>Date To</th>
                      <th>{getRecordMetricLabel()}</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <div style={{ fontWeight: "600", color: "var(--fg-default, #f1f5f9)", fontSize: "13px" }}>
                            {getAgentLabel(record.agent_id, record.agent_name)}
                          </div>
                        </td>
                        <td style={{ color: "var(--fg-muted, #64748b)", fontSize: "12px" }}>{getRecordStartDate(record)}</td>
                        <td style={{ color: "var(--fg-muted, #64748b)", fontSize: "12px" }}>{record.date_to || "—"}</td>
                        <td>
                          <span style={{ fontWeight: "700", color: "var(--accent-blue, #3b82f6)", fontSize: "13px" }}>
                            {getRecordMetricValue(record)}
                          </span>
                        </td>
                        <td style={{ color: "var(--fg-muted, #64748b)", fontSize: "12px" }}>{record.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionPanel>

          {/* Recognition + Trophy */}
          <RecognitionWall compact currentUser={currentUser as any} />
          <DigitalTrophyCabinet scope="team" currentUser={currentUser} />

          {/* Monitoring */}
          <MonitoringWidget count={monitoringItems.length} onClick={handleMonitoringClick} />
          <MonitoringDrawer
            open={monitoringOpen}
            onClose={() => setMonitoringOpen(false)}
            items={monitoringItems}
            mode="supervisor"
            topOffset={MONITORING_VIEW_OFFSET}
            selectedAgentId={monitoringAgentFilter}
            onSelectAgentId={setMonitoringAgentFilter}
            agentOptions={teamAgents.map((a) => ({ id: a.id, agent_id: a.agent_id, agent_name: a.agent_name, display_name: a.display_name }))}
            onItemUpdated={() => loadTeamData(true)}
          />
        </>
      )}
    </div>
  );
}

export default SupervisorPortal;
