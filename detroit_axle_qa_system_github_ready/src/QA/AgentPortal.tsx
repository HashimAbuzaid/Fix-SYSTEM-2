import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import {
  clearCachedValue,
  getCachedValue,
  peekCachedValue,
} from '../lib/viewCache';
import MonitoringWidget from './MonitoringWidget';
import MonitoringDrawer from './MonitoringDrawer';
import RecognitionWall from './RecognitionWall';
import DigitalTrophyCabinet from './DigitalTrophyCabinet';
import VoiceOfEmployeeSupabase from './VoiceOfEmployeeSupabase';
import QaAcademy from './QaAcademy';

// ─────────────────────────────────────────────────────────────
// Types (unchanged)
// ─────────────────────────────────────────────────────────────

type UserProfile = {
  id: string;
  role: 'admin' | 'qa' | 'agent' | 'supervisor';
  agent_id: string | null;
  agent_name: string;
  display_name?: string | null;
  team: 'Calls' | 'Tickets' | 'Sales' | null;
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
  team: string;
  case_type: string;
  audit_date: string;
  order_number?: string | null;
  phone_number?: string | null;
  ticket_id?: string | null;
  quality_score: number;
  comments: string | null;
  score_details: ScoreDetail[];
  shared_with_agent?: boolean;
  shared_at?: string | null;
};

type CallsRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  calls_count: number;
  call_date: string;
  date_to?: string | null;
  notes: string | null;
};

type TicketsRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  tickets_count: number;
  ticket_date: string;
  date_to?: string | null;
  notes: string | null;
};

type SalesRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  amount: number;
  sale_date: string;
  date_to?: string | null;
  notes: string | null;
};

type AgentFeedback = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: 'Calls' | 'Tickets' | 'Sales';
  qa_name: string;
  feedback_type: 'Coaching' | 'Audit Feedback' | 'Warning' | 'Follow-up';
  subject: string;
  feedback_note: string;
  action_plan?: string | null;
  due_date: string | null;
  status: 'Open' | 'In Progress' | 'Closed';
  created_at: string;
  acknowledged_by_agent?: boolean;
  acknowledged_at?: string | null;
};

type MonitoringItem = {
  id: string;
  order_number: string;
  comment: string;
  agent_id: string;
  agent_name: string;
  display_name: string | null;
  team: 'Calls' | 'Tickets' | 'Sales';
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  status: 'active' | 'resolved';
  acknowledged_by_agent: boolean;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolved_by_email: string | null;
};

type AgentPortalProps = { currentUser: UserProfile };

type AgentPortalCachePayload = {
  audits: AuditItem[];
  callsRecords: CallsRecord[];
  ticketsRecords: TicketsRecord[];
  salesRecords: SalesRecord[];
  feedbackItems: AgentFeedback[];
  monitoringItems: MonitoringItem[];
};

const AGENT_PORTAL_CACHE_TTL_MS = 1000 * 60 * 3;
const HIDDEN_AGENT_METRICS = new Set(['Issue was resolved']);

type PlanPriority = 'Low' | 'Medium' | 'High' | 'Critical';
type FollowUpOutcome = 'Not Set' | 'Improved' | 'Partial Improvement' | 'No Improvement' | 'Needs Escalation';
type ReviewStage = 'QA Shared' | 'Acknowledged' | 'Agent Responded' | 'Supervisor Reviewed' | 'Follow-up' | 'Closed';

const STRUCTURED_PLAN_SECTION_LABELS = [
  'Priority', 'Action Plan', 'Justification', 'Review Stage',
  'Agent Comment', 'Supervisor Review', 'Follow-up Outcome', 'Resolution Note',
] as const;

// ─────────────────────────────────────────────────────────────
// Helpers (unchanged logic)
// ─────────────────────────────────────────────────────────────

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function normalizePriority(value?: string | null): PlanPriority {
  if (value === 'Low' || value === 'Medium' || value === 'High' || value === 'Critical') return value;
  return 'Medium';
}
function normalizeFollowUpOutcome(value?: string | null): FollowUpOutcome {
  if (value === 'Improved' || value === 'Partial Improvement' || value === 'No Improvement' || value === 'Needs Escalation') return value;
  return 'Not Set';
}
function normalizeReviewStage(value?: string | null): ReviewStage {
  if (value === 'QA Shared' || value === 'Acknowledged' || value === 'Agent Responded' || value === 'Supervisor Reviewed' || value === 'Follow-up' || value === 'Closed') return value;
  return 'QA Shared';
}
function parseStructuredPlan(value?: string | null) {
  const raw = String(value || '').trim();
  const labelsPattern = STRUCTURED_PLAN_SECTION_LABELS.map((label) => escapeRegex(label)).join('|');
  function readSection(label: (typeof STRUCTURED_PLAN_SECTION_LABELS)[number]) {
    const regex = new RegExp(`${escapeRegex(label)}:\n([\\s\\S]*?)(?=\\n(?:${labelsPattern}):\\n|$)`);
    const match = raw.match(regex);
    return match ? match[1].trim() : '';
  }
  const hasStructuredSections = STRUCTURED_PLAN_SECTION_LABELS.some((label) => raw.includes(`${label}:`));
  return {
    priority: normalizePriority(readSection('Priority')),
    actionPlan: hasStructuredSections ? readSection('Action Plan') : raw,
    justification: readSection('Justification'),
    reviewStage: normalizeReviewStage(readSection('Review Stage')),
    agentComment: readSection('Agent Comment'),
    supervisorReview: readSection('Supervisor Review'),
    followUpOutcome: normalizeFollowUpOutcome(readSection('Follow-up Outcome')),
    resolutionNote: readSection('Resolution Note'),
  };
}
function composeStructuredPlan(fields: {
  priority: PlanPriority; actionPlan: string; justification: string; reviewStage: ReviewStage;
  agentComment: string; supervisorReview: string; followUpOutcome: FollowUpOutcome; resolutionNote: string;
}) {
  const sections = [
    `Priority:\n${fields.priority}`,
    fields.actionPlan.trim() ? `Action Plan:\n${fields.actionPlan.trim()}` : '',
    fields.justification.trim() ? `Justification:\n${fields.justification.trim()}` : '',
    `Review Stage:\n${fields.reviewStage}`,
    fields.agentComment.trim() ? `Agent Comment:\n${fields.agentComment.trim()}` : '',
    fields.supervisorReview.trim() ? `Supervisor Review:\n${fields.supervisorReview.trim()}` : '',
    fields.followUpOutcome !== 'Not Set' ? `Follow-up Outcome:\n${fields.followUpOutcome}` : '',
    fields.resolutionNote.trim() ? `Resolution Note:\n${fields.resolutionNote.trim()}` : '',
  ].filter(Boolean);
  return sections.join('\n\n').trim();
}
function openNativeDatePicker(target: HTMLInputElement) {
  const input = target as HTMLInputElement & { showPicker?: () => void };
  input.showPicker?.();
}
function matchesRecordRange(startDate?: string | null, endDate?: string | null, filterFrom?: string, filterTo?: string) {
  const recordStart = String(startDate || '').slice(0, 10);
  const recordEnd = String(endDate || startDate || '').slice(0, 10);
  if (!recordStart) return false;
  const effectiveFrom = filterFrom || '0001-01-01';
  const effectiveTo = filterTo || '9999-12-31';
  return recordEnd >= effectiveFrom && recordStart <= effectiveTo;
}

// ─────────────────────────────────────────────────────────────
// Component CSS injection
// ─────────────────────────────────────────────────────────────

const PORTAL_STYLE_ID = 'da-agent-portal-v2';
const PORTAL_CSS = `
  .ap-root {
    --ap-blue: #3b82f6;
    --ap-blue-dim: rgba(59,130,246,0.12);
    --ap-blue-glow: rgba(59,130,246,0.25);
    --ap-violet: #8b5cf6;
    --ap-violet-dim: rgba(139,92,246,0.12);
    --ap-emerald: #10b981;
    --ap-emerald-dim: rgba(16,185,129,0.12);
    --ap-rose: #f43f5e;
    --ap-rose-dim: rgba(244,63,94,0.12);
    --ap-amber: #f59e0b;
    --ap-amber-dim: rgba(245,158,11,0.12);
    --ap-cyan: #06b6d4;
    --ap-cyan-dim: rgba(6,182,212,0.12);
    font-family: 'Geist', system-ui, sans-serif;
  }

  /* ── Keyframes ── */
  @keyframes ap-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ap-shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
  @keyframes ap-ping {
    75%, 100% { transform: scale(1.8); opacity: 0; }
  }
  @keyframes ap-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes ap-pulse-ring {
    0%   { box-shadow: 0 0 0 0 var(--ap-blue-glow); }
    70%  { box-shadow: 0 0 0 8px transparent; }
    100% { box-shadow: 0 0 0 0 transparent; }
  }

  /* ── Page layout ── */
  .ap-page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 28px;
    animation: ap-fade-up 300ms ease both;
  }
  .ap-page-eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ap-blue);
    margin-bottom: 6px;
  }
  .ap-page-title {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--fg-default, #f1f5f9);
    margin: 0;
  }
  .ap-page-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* ── Error banner ── */
  .ap-error {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    padding: 12px 16px;
    border-radius: 12px;
    background: rgba(244,63,94,0.08);
    border: 1px solid rgba(244,63,94,0.25);
    color: #fda4af;
    font-size: 13px;
    font-weight: 500;
    animation: ap-fade-up 200ms ease both;
  }
  .ap-error-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--ap-rose);
    flex-shrink: 0;
  }

  /* ── Profile card ── */
  .ap-profile-card {
    position: relative;
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-elevated, #111118);
    padding: 24px;
    margin-bottom: 24px;
    animation: ap-fade-up 250ms ease both;
  }
  .ap-profile-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(59,130,246,0.05) 0%, transparent 60%);
    pointer-events: none;
  }
  .ap-profile-inner {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
  }
  .ap-profile-avatar {
    width: 56px; height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(139,92,246,0.15) 100%);
    border: 1px solid rgba(59,130,246,0.25);
    display: grid;
    place-items: center;
    font-size: 20px;
    font-weight: 800;
    color: #93c5fd;
    flex-shrink: 0;
    letter-spacing: -0.02em;
  }
  .ap-profile-info { flex: 1; min-width: 0; }
  .ap-profile-name {
    font-size: 18px;
    font-weight: 700;
    color: var(--fg-default, #f1f5f9);
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }
  .ap-profile-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ap-profile-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-subtle, rgba(255,255,255,0.04));
    color: var(--fg-muted, #64748b);
  }
  .ap-profile-tag--team {
    background: var(--ap-blue-dim);
    border-color: var(--ap-blue-glow);
    color: #93c5fd;
  }
  .ap-profile-online {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: var(--ap-emerald);
    position: relative;
  }
  .ap-profile-online::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    background: var(--ap-emerald);
    animation: ap-ping 2s ease infinite;
    opacity: 0.4;
  }
  .ap-profile-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1px;
    margin-top: 20px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    border-radius: 14px;
    overflow: hidden;
    background: var(--border, rgba(255,255,255,0.07));
  }
  .ap-profile-field {
    padding: 12px 16px;
    background: var(--bg-elevated, #111118);
  }
  .ap-profile-field-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg-muted, #64748b);
    margin-bottom: 4px;
  }
  .ap-profile-field-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-default, #f1f5f9);
    letter-spacing: -0.01em;
  }

  /* ── Summary grid ── */
  .ap-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 32px;
    animation: ap-fade-up 280ms ease both;
  }
  .ap-stat-card {
    position: relative;
    overflow: hidden;
    border-radius: 16px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-elevated, #111118);
    padding: 20px;
    transition: border-color 160ms ease, transform 160ms ease;
    cursor: default;
  }
  .ap-stat-card:hover {
    border-color: var(--border-strong, rgba(255,255,255,0.12));
    transform: translateY(-1px);
  }
  .ap-stat-card::after {
    content: '';
    position: absolute;
    top: 0; left: 0;
    right: 0; height: 2px;
    border-radius: 16px 16px 0 0;
    background: var(--ap-accent-line, transparent);
    transition: opacity 200ms ease;
  }
  .ap-stat-card--blue { --ap-accent-line: var(--ap-blue); }
  .ap-stat-card--violet { --ap-accent-line: var(--ap-violet); }
  .ap-stat-card--emerald { --ap-accent-line: var(--ap-emerald); }
  .ap-stat-card--amber { --ap-accent-line: var(--ap-amber); }
  .ap-stat-card--rose { --ap-accent-line: var(--ap-rose); }
  .ap-stat-card--cyan { --ap-accent-line: var(--ap-cyan); }
  .ap-stat-icon {
    width: 32px; height: 32px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    margin-bottom: 14px;
    font-size: 14px;
    flex-shrink: 0;
  }
  .ap-stat-value {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--fg-default, #f1f5f9);
    line-height: 1;
    margin-bottom: 6px;
  }
  .ap-stat-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-muted, #64748b);
    letter-spacing: -0.01em;
    margin-bottom: 4px;
  }
  .ap-stat-sub {
    font-size: 11px;
    color: var(--fg-subtle, #334155);
    font-weight: 500;
  }

  /* ── Section wrapper ── */
  .ap-section {
    margin-bottom: 28px;
    animation: ap-fade-up 300ms ease both;
  }
  .ap-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    gap: 12px;
  }
  .ap-section-header-left { display: flex; flex-direction: column; gap: 4px; }
  .ap-section-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ap-blue);
  }
  .ap-section-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--fg-default, #f1f5f9);
    letter-spacing: -0.02em;
    margin: 0;
  }
  .ap-section-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

  /* ── Buttons ── */
  .ap-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 34px;
    padding: 0 14px;
    border-radius: 9px;
    border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
    background: var(--bg-elevated, #111118);
    color: var(--fg-muted, #64748b);
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: color 120ms ease, background 120ms ease, border-color 120ms ease, transform 100ms ease;
    white-space: nowrap;
  }
  .ap-btn:hover:not(:disabled) {
    color: var(--fg-default, #f1f5f9);
    background: var(--bg-overlay, #16161f);
    border-color: var(--border-strong, rgba(255,255,255,0.12));
  }
  .ap-btn:active:not(:disabled) { transform: translateY(1px); }
  .ap-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .ap-btn--sm { height: 28px; padding: 0 10px; font-size: 11px; border-radius: 7px; }
  .ap-btn--primary {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    border-color: rgba(96,165,250,0.3);
    color: #fff;
    box-shadow: 0 4px 12px rgba(37,99,235,0.25);
  }
  .ap-btn--primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    border-color: rgba(96,165,250,0.4);
    color: #fff;
  }
  .ap-btn--ghost {
    border-color: transparent;
    background: transparent;
  }
  .ap-btn--ghost:hover:not(:disabled) {
    background: var(--bg-subtle, rgba(255,255,255,0.04));
    border-color: var(--border, rgba(255,255,255,0.07));
  }
  .ap-btn--ack {
    background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
    border-color: rgba(59,130,246,0.35);
    color: #fff;
    font-weight: 700;
    box-shadow: 0 4px 14px rgba(29,78,216,0.22);
    height: 34px;
    padding: 0 16px;
    border-radius: 9px;
  }
  .ap-btn--ack:hover:not(:disabled) {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  }
  .ap-badge-ack {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 12px;
    height: 28px;
    border-radius: 999px;
    background: rgba(16,185,129,0.1);
    border: 1px solid rgba(16,185,129,0.22);
    color: #6ee7b7;
    font-size: 11px;
    font-weight: 700;
  }

  /* ── Status badges / pills ── */
  .ap-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    white-space: nowrap;
    border: 1px solid transparent;
  }
  .ap-pill--blue   { background: var(--ap-blue-dim);   color: #93c5fd; border-color: rgba(59,130,246,0.2); }
  .ap-pill--violet { background: var(--ap-violet-dim); color: #c4b5fd; border-color: rgba(139,92,246,0.2); }
  .ap-pill--emerald{ background: var(--ap-emerald-dim);color: #6ee7b7; border-color: rgba(16,185,129,0.2); }
  .ap-pill--rose   { background: var(--ap-rose-dim);   color: #fda4af; border-color: rgba(244,63,94,0.2); }
  .ap-pill--amber  { background: var(--ap-amber-dim);  color: #fcd34d; border-color: rgba(245,158,11,0.2); }
  .ap-pill--slate  { background: rgba(100,116,139,0.1);color: #94a3b8; border-color: rgba(100,116,139,0.2); }

  /* ── Score pill ── */
  .ap-score-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 72px;
    padding: 6px 10px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--fg-default, #f1f5f9);
    background: var(--bg-overlay, #16161f);
    border: 1px solid var(--border, rgba(255,255,255,0.07));
  }
  .ap-score-pill--high  { background: rgba(16,185,129,0.1);  border-color: rgba(16,185,129,0.2);  color: #6ee7b7; }
  .ap-score-pill--mid   { background: rgba(245,158,11,0.1);  border-color: rgba(245,158,11,0.2);  color: #fcd34d; }
  .ap-score-pill--low   { background: rgba(244,63,94,0.1);   border-color: rgba(244,63,94,0.2);   color: #fda4af; }

  /* ── Result pill ── */
  .ap-result-pass       { background: rgba(16,185,129,0.1);  border-color: rgba(16,185,129,0.2);  color: #6ee7b7; }
  .ap-result-borderline { background: rgba(245,158,11,0.1);  border-color: rgba(245,158,11,0.2);  color: #fcd34d; }
  .ap-result-fail       { background: rgba(244,63,94,0.1);   border-color: rgba(244,63,94,0.2);   color: #fda4af; }
  .ap-result-na         { background: rgba(100,116,139,0.1); border-color: rgba(100,116,139,0.2); color: #94a3b8; }

  /* ── Tables (shared) ── */
  .ap-table-wrap {
    border-radius: 16px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    overflow: hidden;
    overflow-x: auto;
    background: var(--bg-elevated, #111118);
  }
  .ap-table { min-width: 100%; }
  .ap-table-head {
    display: grid;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-overlay, #16161f);
    border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg-subtle, #334155);
    position: sticky;
    top: 0;
    z-index: 2;
  }
  .ap-table-row {
    display: grid;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
    align-items: center;
    transition: background 100ms ease;
  }
  .ap-table-row:last-child { border-bottom: none; }
  .ap-table-row:hover { background: var(--bg-subtle, rgba(255,255,255,0.04)); }
  .ap-table-entry { }
  .ap-cell-primary {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-default, #f1f5f9);
    letter-spacing: -0.01em;
    line-height: 1.4;
  }
  .ap-cell-secondary {
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-top: 3px;
  }

  /* ── Audit table cols ── */
  .ap-audits-table { min-width: 1020px; }
  .ap-audits-cols {
    grid-template-columns: 130px 160px minmax(220px, 1.4fr) 100px 180px minmax(200px, 1.8fr) 90px;
  }

  /* ── Feedback table cols ── */
  .ap-feedback-table { min-width: 940px; }
  .ap-feedback-cols {
    grid-template-columns: 130px minmax(200px, 1.4fr) 150px 130px 110px 160px 90px;
  }

  /* ── Records table cols ── */
  .ap-records-table { min-width: 600px; }
  .ap-records-cols {
    grid-template-columns: 160px 160px 140px minmax(180px, 1fr);
  }

  /* ── Expanded panel ── */
  .ap-expanded {
    padding: 0 12px 12px;
  }
  .ap-expanded-inner {
    border-radius: 14px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-base, #0a0a0f);
    padding: 18px;
    display: grid;
    gap: 16px;
  }
  .ap-detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 8px;
  }
  .ap-detail-card {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-elevated, #111118);
  }
  .ap-detail-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--fg-muted, #64748b);
    margin-bottom: 5px;
  }
  .ap-detail-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-default, #f1f5f9);
    letter-spacing: -0.01em;
    line-height: 1.4;
  }
  .ap-comment-card {
    padding: 14px 16px;
    border-radius: 10px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-elevated, #111118);
  }
  .ap-comment-text {
    font-size: 13px;
    color: var(--fg-default, #f1f5f9);
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .ap-score-details-list { display: grid; gap: 8px; }
  .ap-score-detail-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-elevated, #111118);
  }
  .ap-metric-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-default, #f1f5f9);
    letter-spacing: -0.01em;
    margin-bottom: 3px;
  }
  .ap-metric-meta {
    font-size: 11px;
    color: var(--fg-muted, #64748b);
  }
  .ap-metric-note {
    margin-top: 8px;
    padding: 10px 12px;
    border-radius: 8px;
    border-left: 2px solid var(--ap-blue);
    background: var(--ap-blue-dim);
  }
  .ap-metric-note-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--ap-blue);
    margin-bottom: 4px;
  }
  .ap-metric-note-text {
    font-size: 12px;
    color: var(--fg-default, #f1f5f9);
    line-height: 1.55;
    white-space: pre-wrap;
  }

  /* ── Coaching hero cards ── */
  .ap-coaching-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 14px;
  }
  .ap-coaching-card {
    border-radius: 18px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-elevated, #111118);
    overflow: hidden;
    transition: border-color 160ms ease, transform 160ms ease;
    display: flex;
    flex-direction: column;
  }
  .ap-coaching-card:hover {
    border-color: var(--border-strong, rgba(255,255,255,0.12));
    transform: translateY(-1px);
  }
  .ap-coaching-card-header {
    padding: 18px 18px 14px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
  }
  .ap-coaching-card-type {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--ap-blue);
    margin-bottom: 5px;
  }
  .ap-coaching-card-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--fg-default, #f1f5f9);
    letter-spacing: -0.02em;
    line-height: 1.35;
  }
  .ap-coaching-card-from {
    font-size: 12px;
    color: var(--fg-muted, #64748b);
    margin-top: 4px;
  }
  .ap-coaching-card-body { padding: 14px 18px; display: grid; gap: 10px; flex: 1; }
  .ap-coaching-meta-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .ap-coaching-meta-item {
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-base, #0a0a0f);
  }
  .ap-coaching-note-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .ap-coaching-note-item {
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-base, #0a0a0f);
  }
  .ap-coaching-card-footer {
    padding: 12px 18px;
    border-top: 1px solid var(--border, rgba(255,255,255,0.07));
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    background: var(--bg-base, #0a0a0f);
  }

  /* ── Stage progress bar ── */
  .ap-stage-track {
    display: flex;
    gap: 3px;
    margin-top: 10px;
  }
  .ap-stage-step {
    flex: 1;
    height: 3px;
    border-radius: 999px;
    background: var(--border, rgba(255,255,255,0.07));
    transition: background 200ms ease;
  }
  .ap-stage-step--done   { background: var(--ap-emerald); }
  .ap-stage-step--active { background: var(--ap-blue); }

  /* ── Filters panel ── */
  .ap-filters {
    padding: 18px;
    border-radius: 14px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-elevated, #111118);
    margin-bottom: 16px;
  }
  .ap-filters-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 14px;
    margin-bottom: 14px;
  }
  .ap-field-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted, #64748b);
    margin-bottom: 7px;
  }
  .ap-field {
    width: 100%;
    padding: 9px 12px;
    border-radius: 9px;
    border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
    background: var(--bg-base, #0a0a0f);
    color: var(--fg-default, #f1f5f9);
    font-size: 13px;
    font-family: inherit;
    transition: border-color 120ms ease;
    outline: none;
  }
  .ap-field:focus { border-color: var(--ap-blue); }
  .ap-filters-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .ap-filter-count {
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-muted, #64748b);
  }
  .ap-filter-count strong { color: var(--fg-default, #f1f5f9); }

  /* ── Textarea ── */
  .ap-textarea {
    width: 100%;
    padding: 11px 13px;
    border-radius: 10px;
    border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
    background: var(--bg-base, #0a0a0f);
    color: var(--fg-default, #f1f5f9);
    font-size: 13px;
    font-family: inherit;
    line-height: 1.6;
    resize: vertical;
    transition: border-color 120ms ease;
    outline: none;
  }
  .ap-textarea:focus { border-color: var(--ap-blue); }
  .ap-textarea::placeholder { color: var(--fg-subtle, #334155); }

  /* ── Empty state ── */
  .ap-empty {
    padding: 40px 20px;
    text-align: center;
    border-radius: 14px;
    border: 1px dashed var(--border, rgba(255,255,255,0.07));
    background: var(--bg-elevated, #111118);
  }
  .ap-empty-icon {
    font-size: 28px;
    margin-bottom: 10px;
    opacity: 0.5;
  }
  .ap-empty-text {
    font-size: 13px;
    font-weight: 500;
    color: var(--fg-muted, #64748b);
  }

  /* ── Loading bar ── */
  .ap-loading-bar {
    height: 2px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--border, rgba(255,255,255,0.07));
    margin-bottom: 20px;
  }
  .ap-loading-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--ap-blue), var(--ap-violet), var(--ap-cyan));
    background-size: 200%;
    animation: ap-shimmer 1.6s linear infinite;
  }

  /* ── Collapsed state ── */
  .ap-collapsed-hint {
    padding: 14px 18px;
    border-radius: 12px;
    border: 1px dashed var(--border, rgba(255,255,255,0.07));
    color: var(--fg-muted, #64748b);
    font-size: 13px;
    font-weight: 500;
    text-align: center;
  }

  /* ── Time pill (last loaded) ── */
  .ap-time-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 999px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-elevated, #111118);
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted, #64748b);
    white-space: nowrap;
  }
  .ap-time-pill-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--ap-emerald);
  }
`;

function usePortalStyles() {
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current || document.getElementById(PORTAL_STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = PORTAL_STYLE_ID;
    el.textContent = PORTAL_CSS;
    document.head.appendChild(el);
    injected.current = true;
    return () => {
      document.getElementById(PORTAL_STYLE_ID)?.remove();
      injected.current = false;
    };
  }, []);
}

// ─────────────────────────────────────────────────────────────
// Helpers: score color, result class, stage step, type pill
// ─────────────────────────────────────────────────────────────

function scorePillClass(score: number) {
  if (score >= 90) return 'ap-score-pill ap-score-pill--high';
  if (score >= 75) return 'ap-score-pill ap-score-pill--mid';
  return 'ap-score-pill ap-score-pill--low';
}

function resultPillClass(result: string) {
  if (result === 'Pass') return 'ap-pill ap-result-pass';
  if (result === 'Borderline') return 'ap-pill ap-result-borderline';
  if (result === 'Fail' || result === 'Auto-Fail') return 'ap-pill ap-result-fail';
  return 'ap-pill ap-result-na';
}

function stagePillClass(stage: ReviewStage) {
  if (stage === 'Closed') return 'ap-pill ap-pill--emerald';
  if (stage === 'Follow-up') return 'ap-pill ap-pill--violet';
  if (stage === 'Supervisor Reviewed') return 'ap-pill ap-pill--amber';
  if (stage === 'Agent Responded' || stage === 'Acknowledged') return 'ap-pill ap-pill--blue';
  return 'ap-pill ap-pill--slate';
}

function typePillClass(type: string) {
  if (type === 'Warning') return 'ap-pill ap-pill--rose';
  if (type === 'Audit Feedback') return 'ap-pill ap-pill--violet';
  if (type === 'Follow-up') return 'ap-pill ap-pill--amber';
  return 'ap-pill ap-pill--emerald';
}

function statusPillClass(status: string) {
  if (status === 'Closed') return 'ap-pill ap-pill--emerald';
  if (status === 'In Progress') return 'ap-pill ap-pill--amber';
  return 'ap-pill ap-pill--blue';
}

const STAGE_ORDER: ReviewStage[] = ['QA Shared', 'Acknowledged', 'Agent Responded', 'Supervisor Reviewed', 'Follow-up', 'Closed'];

function StageTrack({ current }: { current: ReviewStage }) {
  const currentIdx = STAGE_ORDER.indexOf(current);
  return (
    <div className="ap-stage-track" title={`Stage: ${current}`}>
      {STAGE_ORDER.map((stage, idx) => (
        <div
          key={stage}
          className={`ap-stage-step${idx < currentIdx ? ' ap-stage-step--done' : idx === currentIdx ? ' ap-stage-step--active' : ''}`}
          title={stage}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function EmptyState({ icon, text }: { icon?: string; text: string }) {
  return (
    <div className="ap-empty">
      {icon && <div className="ap-empty-icon">{icon}</div>}
      <div className="ap-empty-text">{text}</div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';
  icon?: ReactNode;
}
function StatCard({ title, value, subtitle, color = 'blue', icon }: StatCardProps) {
  return (
    <div className={`ap-stat-card ap-stat-card--${color}`}>
      {icon && (
        <div
          className="ap-stat-icon"
          style={{
            background: `var(--ap-${color}-dim)`,
            color: `var(--ap-${color})`,
          }}
        >
          {icon}
        </div>
      )}
      <div className="ap-stat-value">{value}</div>
      <div className="ap-stat-label">{title}</div>
      {subtitle && <div className="ap-stat-sub">{subtitle}</div>}
    </div>
  );
}

function PortalSection({
  eyebrow,
  title,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ap-section">
      <div className="ap-section-header">
        <div className="ap-section-header-left">
          {eyebrow && <div className="ap-section-eyebrow">{eyebrow}</div>}
          <h3 className="ap-section-title">{title}</h3>
        </div>
        {actions && <div className="ap-section-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

function AgentPortal({ currentUser }: AgentPortalProps) {
  usePortalStyles();

  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [callsRecords, setCallsRecords] = useState<CallsRecord[]>([]);
  const [ticketsRecords, setTicketsRecords] = useState<TicketsRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<AgentFeedback[]>([]);
  const [monitoringItems, setMonitoringItems] = useState<MonitoringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [monitoringOpen, setMonitoringOpen] = useState(false);
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [agentCommentDrafts, setAgentCommentDrafts] = useState<Record<string, string>>({});
  const [auditsVisible, setAuditsVisible] = useState(true);

  const cacheKey = useMemo(() => {
    return `agent-portal:${currentUser.id}:${currentUser.agent_id || 'no-agent'}:${currentUser.team || 'no-team'}`;
  }, [currentUser.id, currentUser.agent_id, currentUser.team]);

  useEffect(() => { void loadAgentData(); }, [cacheKey]);

  function applyAgentData(payload: AgentPortalCachePayload) {
    setAudits(payload.audits);
    setCallsRecords(payload.callsRecords);
    setTicketsRecords(payload.ticketsRecords);
    setSalesRecords(payload.salesRecords);
    setFeedbackItems(payload.feedbackItems);
    setMonitoringItems(payload.monitoringItems);
  }

  async function fetchAgentData() {
    if (!currentUser.agent_id || !currentUser.team) {
      throw new Error('Your profile is missing agent_id or team.');
    }
    const auditsPromise = supabase.from('audits').select('*').eq('agent_id', currentUser.agent_id).eq('team', currentUser.team).eq('shared_with_agent', true).order('audit_date', { ascending: false });
    const callsPromise = currentUser.team === 'Calls' ? supabase.from('calls_records').select('*').eq('agent_id', currentUser.agent_id).order('call_date', { ascending: false }) : Promise.resolve({ data: [], error: null });
    const ticketsPromise = currentUser.team === 'Tickets' ? supabase.from('tickets_records').select('*').eq('agent_id', currentUser.agent_id).order('ticket_date', { ascending: false }) : Promise.resolve({ data: [], error: null });
    const salesPromise = currentUser.team === 'Sales' ? supabase.from('sales_records').select('*').eq('agent_id', currentUser.agent_id).order('sale_date', { ascending: false }) : Promise.resolve({ data: [], error: null });
    const feedbackPromise = supabase.from('agent_feedback').select('*').eq('agent_id', currentUser.agent_id).eq('team', currentUser.team).neq('status', 'Closed').order('created_at', { ascending: false });
    const monitoringPromise = supabase.from('monitoring_items').select('*').eq('agent_id', currentUser.agent_id).eq('team', currentUser.team).eq('status', 'active').order('created_at', { ascending: false });
    const [auditsResult, callsResult, ticketsResult, salesResult, feedbackResult, monitoringResult] = await Promise.all([auditsPromise, callsPromise, ticketsPromise, salesPromise, feedbackPromise, monitoringPromise]);
    const errors = [auditsResult.error?.message, callsResult.error?.message, ticketsResult.error?.message, salesResult.error?.message, feedbackResult.error?.message, monitoringResult.error?.message].filter(Boolean);
    if (errors.length > 0) throw new Error(errors.join(' | '));
    return {
      audits: (auditsResult.data as AuditItem[]) || [],
      callsRecords: (callsResult.data as CallsRecord[]) || [],
      ticketsRecords: (ticketsResult.data as TicketsRecord[]) || [],
      salesRecords: (salesResult.data as SalesRecord[]) || [],
      feedbackItems: (feedbackResult.data as AgentFeedback[]) || [],
      monitoringItems: (monitoringResult.data as MonitoringItem[]) || [],
    } satisfies AgentPortalCachePayload;
  }

  async function loadAgentData(options?: { force?: boolean; background?: boolean }) {
    if (!currentUser.agent_id || !currentUser.team) {
      setAudits([]); setCallsRecords([]); setTicketsRecords([]); setSalesRecords([]); setFeedbackItems([]); setMonitoringItems([]);
      setErrorMessage('Your profile is missing agent_id or team.');
      setLoading(false); setRefreshing(false); return;
    }
    const force = options?.force ?? false;
    const background = options?.background ?? false;
    const cached = force ? null : peekCachedValue<AgentPortalCachePayload>(cacheKey);
    if (cached) { applyAgentData(cached); setLoading(false); }
    if (background || cached) { setRefreshing(true); } else { setLoading(true); }
    setErrorMessage('');
    try {
      const payload = await getCachedValue(cacheKey, fetchAgentData, { ttlMs: AGENT_PORTAL_CACHE_TTL_MS, force });
      applyAgentData(payload);
      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load profile data.');
    } finally { setLoading(false); setRefreshing(false); }
  }

  async function handleAcknowledgeFeedback(feedbackId: string) {
    setErrorMessage('');
    const currentItem = feedbackItems.find((item) => item.id === feedbackId) || null;
    const parsed = parseStructuredPlan(currentItem?.action_plan);
    const nextActionPlan = composeStructuredPlan({ ...parsed, reviewStage: parsed.reviewStage === 'QA Shared' ? 'Acknowledged' : parsed.reviewStage });
    const { data, error } = await supabase.from('agent_feedback').update({ acknowledged_by_agent: true, action_plan: nextActionPlan || null }).eq('id', feedbackId).select('id, acknowledged_by_agent, action_plan').maybeSingle();
    if (error) { setErrorMessage(error.message); return; }
    if (!data) { setErrorMessage('Acknowledge did not update. Please check the agent_feedback update policy in Supabase.'); return; }
    setFeedbackItems((prev) => prev.map((item) => item.id === feedbackId ? { ...item, acknowledged_by_agent: true, action_plan: nextActionPlan || null } : item));
    void loadAgentData({ force: true, background: true });
  }

  async function handleSaveAgentComment(item: AgentFeedback) {
    setErrorMessage('');
    const parsed = parseStructuredPlan(item.action_plan);
    const nextComment = String(agentCommentDrafts[item.id] ?? parsed.agentComment).trim();
    const nextActionPlan = composeStructuredPlan({ ...parsed, reviewStage: nextComment ? 'Agent Responded' : item.acknowledged_by_agent ? 'Acknowledged' : parsed.reviewStage, agentComment: nextComment });
    const { error } = await supabase.from('agent_feedback').update({ acknowledged_by_agent: true, action_plan: nextActionPlan || null }).eq('id', item.id);
    if (error) { setErrorMessage(error.message); return; }
    setFeedbackItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, acknowledged_by_agent: true, action_plan: nextActionPlan || null } : entry));
    void loadAgentData({ force: true, background: true });
  }

  const filteredAudits = useMemo(() => audits.filter((audit) => {
    const matchesFrom = auditDateFrom ? audit.audit_date >= auditDateFrom : true;
    const matchesTo = auditDateTo ? audit.audit_date <= auditDateTo : true;
    return matchesFrom && matchesTo;
  }), [audits, auditDateFrom, auditDateTo]);

  const averageQuality = filteredAudits.length > 0
    ? (filteredAudits.reduce((sum, item) => sum + Number(item.quality_score), 0) / filteredAudits.length).toFixed(2)
    : '0.00';

  const filteredCallsRecords = useMemo(() => callsRecords.filter((r) => matchesRecordRange(r.call_date, r.date_to || null, auditDateFrom, auditDateTo)), [callsRecords, auditDateFrom, auditDateTo]);
  const filteredTicketsRecords = useMemo(() => ticketsRecords.filter((r) => matchesRecordRange(r.ticket_date, r.date_to || null, auditDateFrom, auditDateTo)), [ticketsRecords, auditDateFrom, auditDateTo]);
  const filteredSalesRecords = useMemo(() => salesRecords.filter((r) => matchesRecordRange(r.sale_date, r.date_to || null, auditDateFrom, auditDateTo)), [salesRecords, auditDateFrom, auditDateTo]);

  const totalCalls = filteredCallsRecords.reduce((sum, item) => sum + Number(item.calls_count), 0);
  const totalTickets = filteredTicketsRecords.reduce((sum, item) => sum + Number(item.tickets_count), 0);
  const totalSales = filteredSalesRecords.reduce((sum, item) => sum + Number(item.amount), 0);

  const coachingQueueItems = feedbackItems.filter((item) => item.status !== 'Closed');
  const awaitingMyCommentCount = coachingQueueItems.filter((item) => !parseStructuredPlan(item.action_plan).agentComment.trim()).length;
  const awaitingSupervisorReviewCount = coachingQueueItems.filter((item) => {
    const p = parseStructuredPlan(item.action_plan);
    return p.reviewStage === 'Agent Responded' || (!!p.agentComment.trim() && !p.supervisorReview.trim());
  }).length;

  function formatDate(dateValue?: string | null) {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  }
  function formatDateOnly(dateValue?: string | null) {
    if (!dateValue) return '-';
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateValue;
    return date.toLocaleDateString();
  }
  function getAuditReference(audit: AuditItem) {
    if (audit.team === 'Tickets') return `Ticket ID: ${audit.ticket_id || '-'}`;
    return `#${audit.order_number || '-'} · ${audit.phone_number || '-'}`;
  }
  function getCommentsPreview(value?: string | null) {
    const text = (value || '').trim();
    if (!text) return '-';
    if (text.length <= 110) return text;
    return `${text.slice(0, 107)}…`;
  }
  function getUserInitials(name: string) {
    const parts = name.split(/[\s_-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  const hasVisibleData = audits.length > 0 || callsRecords.length > 0 || ticketsRecords.length > 0 || salesRecords.length > 0 || feedbackItems.length > 0 || monitoringItems.length > 0;
  const displayName = currentUser.display_name || currentUser.agent_name;
  const initials = getUserInitials(displayName);

  if (loading && !hasVisibleData) {
    return (
      <div className="ap-root">
        <div className="ap-loading-bar"><div className="ap-loading-bar-fill" /></div>
        <div style={{ color: 'var(--fg-muted)', fontSize: '13px', textAlign: 'center', marginTop: '60px' }}>
          Loading your workspace…
        </div>
      </div>
    );
  }

  return (
    <div className="ap-root">
      {/* ── Page header ── */}
      <div className="ap-page-header">
        <div>
          <div className="ap-page-eyebrow">Agent Portal</div>
          <h2 className="ap-page-title">My Workspace</h2>
        </div>
        <div className="ap-page-actions">
          {lastLoadedAt && (
            <div className="ap-time-pill">
              <div className="ap-time-pill-dot" />
              {formatDate(lastLoadedAt)}
            </div>
          )}
          <button
            type="button"
            className="ap-btn"
            onClick={() => { clearCachedValue(cacheKey); void loadAgentData({ force: true }); }}
            disabled={refreshing}
          >
            {refreshing ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'ap-spin 0.8s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />
                </svg>
                Refreshing…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {errorMessage && (
        <div className="ap-error">
          <div className="ap-error-dot" />
          {errorMessage}
        </div>
      )}

      {/* ── Profile card ── */}
      <div className="ap-profile-card">
        <div className="ap-profile-inner">
          <div className="ap-profile-avatar">{initials}</div>
          <div className="ap-profile-info">
            <div className="ap-profile-name">{displayName}</div>
            <div className="ap-profile-meta">
              <span className="ap-profile-tag ap-profile-tag--team">
                <div className="ap-profile-online" />
                {currentUser.team}
              </span>
              <span className="ap-profile-tag">{currentUser.role}</span>
              <span className="ap-profile-tag">{currentUser.email}</span>
              {currentUser.agent_id && (
                <span className="ap-profile-tag">ID: {currentUser.agent_id}</span>
              )}
            </div>
          </div>
        </div>
        <div className="ap-profile-fields">
          {[
            ['Agent Name', currentUser.agent_name],
            ['Display Name', currentUser.display_name || '—'],
            ['Email', currentUser.email],
            ['Role', currentUser.role],
            ['Agent ID', currentUser.agent_id || '—'],
            ['Team', currentUser.team || '—'],
          ].map(([label, value]) => (
            <div key={label} className="ap-profile-field">
              <div className="ap-profile-field-label">{label}</div>
              <div className="ap-profile-field-value">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className="ap-stats-grid">
        <StatCard title="Released Audits" value={String(filteredAudits.length)} subtitle="Filtered by date" color="blue"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        />
        <StatCard title="Avg Quality" value={`${averageQuality}%`} subtitle="Filtered audits" color={Number(averageQuality) >= 90 ? 'emerald' : Number(averageQuality) >= 75 ? 'amber' : 'rose'}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
        />
        <StatCard title="Feedback Items" value={String(feedbackItems.length)} subtitle="All coaching" color="violet"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
        />
        <StatCard title="Awaiting My Reply" value={String(awaitingMyCommentCount)} subtitle="Need comment" color={awaitingMyCommentCount > 0 ? 'rose' : 'emerald'}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
        />
        <StatCard title="Awaiting Supervisor" value={String(awaitingSupervisorReviewCount)} subtitle="Pending review" color="amber"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        />
        <StatCard title="Monitoring Alerts" value={String(monitoringItems.length)} subtitle="Active only" color={monitoringItems.length > 0 ? 'rose' : 'emerald'}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        />
        {currentUser.team === 'Calls' && (
          <StatCard title="Total Calls" value={String(totalCalls)} subtitle="Production records" color="cyan"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.93 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
          />
        )}
        {currentUser.team === 'Tickets' && (
          <StatCard title="Total Tickets" value={String(totalTickets)} subtitle="Production records" color="cyan"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
          />
        )}
        {currentUser.team === 'Sales' && (
          <StatCard title="Total Sales" value={`$${totalSales.toFixed(2)}`} subtitle="Production records" color="emerald"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
          />
        )}
      </div>

      {/* ── Coaching Review Queue ── */}
      <PortalSection eyebrow="Action Required" title="Coaching Review Queue">
        {coachingQueueItems.length === 0 ? (
          <EmptyState icon="✓" text="No open coaching items. You're all caught up!" />
        ) : (
          <div className="ap-coaching-grid">
            {coachingQueueItems.map((item) => {
              const parsed = parseStructuredPlan(item.action_plan);
              const isExpanded = expandedId === `feedback-${item.id}`;
              return (
                <div key={`queue-${item.id}`} className="ap-coaching-card">
                  <div className="ap-coaching-card-header">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ap-coaching-card-type">{item.feedback_type}</div>
                      <div className="ap-coaching-card-title">{item.subject}</div>
                      <div className="ap-coaching-card-from">From {item.qa_name}</div>
                      <StageTrack current={parsed.reviewStage} />
                    </div>
                    <span className={stagePillClass(parsed.reviewStage)}>{parsed.reviewStage}</span>
                  </div>

                  <div className="ap-coaching-card-body">
                    <div className="ap-coaching-meta-row">
                      <div className="ap-coaching-meta-item">
                        <div className="ap-detail-label">Due Date</div>
                        <div className="ap-detail-value">{item.due_date || '—'}</div>
                      </div>
                      <div className="ap-coaching-meta-item">
                        <div className="ap-detail-label">Acknowledged</div>
                        <div className="ap-detail-value">
                          {item.acknowledged_by_agent ? (
                            <span style={{ color: '#6ee7b7' }}>✓ Yes</span>
                          ) : (
                            <span style={{ color: '#fda4af' }}>Pending</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="ap-comment-card">
                      <div className="ap-detail-label">Coaching Summary</div>
                      <div className="ap-comment-text" style={{ maxHeight: '80px', overflow: 'hidden' }}>
                        {item.feedback_note || '—'}
                      </div>
                    </div>

                    <div className="ap-coaching-note-row">
                      <div className="ap-coaching-note-item">
                        <div className="ap-detail-label">My Reply</div>
                        <div className="ap-comment-text" style={{ fontSize: '12px', color: parsed.agentComment ? 'var(--fg-default)' : 'var(--fg-subtle)' }}>
                          {parsed.agentComment || 'No reply added yet.'}
                        </div>
                      </div>
                      <div className="ap-coaching-note-item">
                        <div className="ap-detail-label">Supervisor Review</div>
                        <div className="ap-comment-text" style={{ fontSize: '12px', color: parsed.supervisorReview ? 'var(--fg-default)' : 'var(--fg-subtle)' }}>
                          {parsed.supervisorReview || 'Waiting for review…'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="ap-coaching-card-footer">
                    {!item.acknowledged_by_agent && (
                      <button type="button" className="ap-btn ap-btn--ack" onClick={() => void handleAcknowledgeFeedback(item.id)}>
                        Acknowledge
                      </button>
                    )}
                    <button
                      type="button"
                      className="ap-btn"
                      onClick={() => setExpandedId(isExpanded ? null : `feedback-${item.id}`)}
                    >
                      {isExpanded ? 'Hide Details' : 'Full Review'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PortalSection>

      {/* ── Feedback table ── */}
      <PortalSection eyebrow="My Coaching" title="Feedback & Coaching History">
        {feedbackItems.length === 0 ? (
          <EmptyState icon="💬" text="No feedback found." />
        ) : (
          <div className="ap-table-wrap">
            <div className="ap-table ap-feedback-table">
              <div className="ap-table-head ap-feedback-cols">
                <div>Type</div>
                <div>Subject</div>
                <div>From QA</div>
                <div>Due Date</div>
                <div>Status</div>
                <div>Acknowledged</div>
                <div>Actions</div>
              </div>

              {feedbackItems.map((item) => {
                const isExpanded = expandedId === `feedback-${item.id}`;
                const parsed = parseStructuredPlan(item.action_plan);
                return (
                  <div key={item.id} className="ap-table-entry">
                    <div className="ap-table-row ap-feedback-cols">
                      <div><span className={typePillClass(item.feedback_type)}>{item.feedback_type}</span></div>
                      <div><div className="ap-cell-primary">{item.subject}</div></div>
                      <div><div className="ap-cell-primary">{item.qa_name}</div></div>
                      <div><div className="ap-cell-primary">{item.due_date || '—'}</div></div>
                      <div><span className={statusPillClass(item.status)}>{item.status}</span></div>
                      <div>
                        {item.acknowledged_by_agent ? (
                          <span className="ap-badge-ack">✓ Done</span>
                        ) : (
                          <button type="button" className="ap-btn ap-btn--ack" onClick={() => void handleAcknowledgeFeedback(item.id)}>
                            Acknowledge
                          </button>
                        )}
                      </div>
                      <div>
                        <button
                          type="button"
                          className="ap-btn ap-btn--sm"
                          onClick={() => setExpandedId(isExpanded ? null : `feedback-${item.id}`)}
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="ap-expanded">
                        <div className="ap-expanded-inner">
                          <div className="ap-detail-grid">
                            {[
                              ['Type', item.feedback_type],
                              ['From QA', item.qa_name],
                              ['Due Date', item.due_date || '—'],
                              ['Created', formatDate(item.created_at)],
                              ['Review Stage', parsed.reviewStage],
                              ['Supervisor Review', parsed.supervisorReview || 'Awaiting review…'],
                            ].map(([label, value]) => (
                              <div key={label} className="ap-detail-card">
                                <div className="ap-detail-label">{label}</div>
                                <div className="ap-detail-value">{value}</div>
                              </div>
                            ))}
                          </div>

                          {[
                            ['Subject', item.subject],
                            ['Coaching Summary', item.feedback_note || '—'],
                            ['Action Plan', parsed.actionPlan || '—'],
                            ['Justification', parsed.justification || '—'],
                          ].map(([label, value]) => (
                            <div key={label} className="ap-comment-card">
                              <div className="ap-detail-label">{label}</div>
                              <div className="ap-comment-text">{value}</div>
                            </div>
                          ))}

                          <div className="ap-comment-card">
                            <div className="ap-detail-label">My Comment / Response</div>
                            <textarea
                              className="ap-textarea"
                              rows={4}
                              value={agentCommentDrafts[item.id] ?? parsed.agentComment}
                              onChange={(e) => setAgentCommentDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              placeholder="Add your response, clarification, or acknowledgment here…"
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                              {!item.acknowledged_by_agent && (
                                <button type="button" className="ap-btn ap-btn--ack" onClick={() => void handleAcknowledgeFeedback(item.id)}>
                                  Acknowledge First
                                </button>
                              )}
                              <button type="button" className="ap-btn ap-btn--primary" onClick={() => void handleSaveAgentComment(item)}>
                                Save My Comment
                              </button>
                            </div>
                          </div>

                          <div className="ap-detail-grid">
                            {[
                              ['Acknowledged', item.acknowledged_by_agent ? 'Yes' : 'Not yet'],
                              ['Follow-up Outcome', parsed.followUpOutcome],
                              ['Resolution Note', parsed.resolutionNote || '—'],
                            ].map(([label, value]) => (
                              <div key={label} className="ap-detail-card">
                                <div className="ap-detail-label">{label}</div>
                                <div className="ap-detail-value">{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </PortalSection>

      {/* ── Released Audits ── */}
      <PortalSection
        eyebrow="QA Results"
        title="My Released Audits"
        actions={
          <button type="button" className="ap-btn ap-btn--sm" onClick={() => setAuditsVisible((p) => !p)}>
            {auditsVisible ? 'Hide' : 'Show'}
          </button>
        }
      >
        {auditsVisible ? (
          <>
            <div className="ap-filters">
              <div className="ap-filters-grid">
                <div>
                  <label className="ap-field-label">Audit Date From</label>
                  <input type="date" className="ap-field" value={auditDateFrom}
                    onChange={(e) => setAuditDateFrom(e.target.value)}
                    onClick={(e) => openNativeDatePicker(e.currentTarget)}
                    onFocus={(e) => openNativeDatePicker(e.currentTarget)}
                  />
                </div>
                <div>
                  <label className="ap-field-label">Audit Date To</label>
                  <input type="date" className="ap-field" value={auditDateTo}
                    onChange={(e) => setAuditDateTo(e.target.value)}
                    onClick={(e) => openNativeDatePicker(e.currentTarget)}
                    onFocus={(e) => openNativeDatePicker(e.currentTarget)}
                  />
                </div>
              </div>
              <div className="ap-filters-footer">
                <div className="ap-filter-count">
                  Showing <strong>{filteredAudits.length}</strong> audit{filteredAudits.length !== 1 ? 's' : ''} · Avg quality <strong>{averageQuality}%</strong>
                </div>
                {(auditDateFrom || auditDateTo) && (
                  <button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" onClick={() => { setAuditDateFrom(''); setAuditDateTo(''); }}>
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {filteredAudits.length === 0 ? (
              <EmptyState icon="📋" text="No audits released for this date range." />
            ) : (
              <div className="ap-table-wrap">
                <div className="ap-table ap-audits-table">
                  <div className="ap-table-head ap-audits-cols">
                    <div>Audit Date</div>
                    <div>Case Type</div>
                    <div>Reference</div>
                    <div>Quality</div>
                    <div>Released</div>
                    <div>Comments</div>
                    <div>Actions</div>
                  </div>

                  {filteredAudits.map((audit) => {
                    const score = Number(audit.quality_score);
                    const isExpanded = expandedId === audit.id;
                    return (
                      <div key={audit.id} className="ap-table-entry">
                        <div className="ap-table-row ap-audits-cols">
                          <div>
                            <div className="ap-cell-primary">{formatDateOnly(audit.audit_date)}</div>
                            <div className="ap-cell-secondary">{audit.team}</div>
                          </div>
                          <div><div className="ap-cell-primary">{audit.case_type}</div></div>
                          <div><div className="ap-cell-primary" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '12px' }}>{getAuditReference(audit)}</div></div>
                          <div>
                            <span className={scorePillClass(score)}>{score.toFixed(2)}%</span>
                          </div>
                          <div><div className="ap-cell-primary">{formatDate(audit.shared_at)}</div></div>
                          <div>
                            <div className="ap-cell-primary" style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>
                              {getCommentsPreview(audit.comments)}
                            </div>
                          </div>
                          <div>
                            <button type="button" className="ap-btn ap-btn--sm" onClick={() => setExpandedId(isExpanded ? null : audit.id)}>
                              {isExpanded ? 'Hide' : 'Details'}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="ap-expanded">
                            <div className="ap-expanded-inner">
                              <div className="ap-detail-grid">
                                {[
                                  ['Reference', getAuditReference(audit)],
                                  ['Released At', formatDate(audit.shared_at)],
                                  ['Quality Score', `${score.toFixed(2)}%`],
                                ].map(([label, value]) => (
                                  <div key={label} className="ap-detail-card">
                                    <div className="ap-detail-label">{label}</div>
                                    <div className="ap-detail-value">{value}</div>
                                  </div>
                                ))}
                              </div>

                              <div className="ap-comment-card">
                                <div className="ap-detail-label">Full Comment</div>
                                <div className="ap-comment-text">{audit.comments?.trim() || '—'}</div>
                              </div>

                              <div>
                                <div className="ap-detail-label" style={{ marginBottom: '10px' }}>Score Details</div>
                                <div className="ap-score-details-list">
                                  {(audit.score_details || [])
                                    .filter((d) => !HIDDEN_AGENT_METRICS.has(d.metric))
                                    .map((detail) => (
                                      <div key={`${audit.id}-${detail.metric}`} className="ap-score-detail-row">
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div className="ap-metric-name">{detail.metric}</div>
                                          <div className="ap-metric-meta">
                                            {detail.counts_toward_score === false
                                              ? 'Administrative question'
                                              : `Pass ${detail.pass} · Borderline ${detail.borderline} · Weight ${detail.adjustedWeight.toFixed(2)}`}
                                          </div>
                                          {detail.metric_comment && (
                                            <div className="ap-metric-note">
                                              <div className="ap-metric-note-label">QA Note</div>
                                              <div className="ap-metric-note-text">{detail.metric_comment}</div>
                                            </div>
                                          )}
                                        </div>
                                        <span className={`${resultPillClass(detail.result)}`}>{detail.result}</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="ap-collapsed-hint">Audits are hidden — click Show to reveal them.</div>
        )}
      </PortalSection>

      {/* ── Calls Records ── */}
      {currentUser.team === 'Calls' && (
        <PortalSection eyebrow="Production" title="My Calls Records">
          {filteredCallsRecords.length === 0 ? (
            <EmptyState icon="📞" text="No calls records for this period." />
          ) : (
            <RecordsTable
              headers={['Date From', 'Date To', 'Calls Count', 'Notes']}
              rows={filteredCallsRecords.map((r) => [
                formatDateOnly(r.call_date),
                r.date_to ? formatDateOnly(r.date_to) : '—',
                String(r.calls_count),
                r.notes?.trim() || '—',
              ])}
            />
          )}
        </PortalSection>
      )}

      {/* ── Tickets Records ── */}
      {currentUser.team === 'Tickets' && (
        <PortalSection eyebrow="Production" title="My Tickets Records">
          {filteredTicketsRecords.length === 0 ? (
            <EmptyState icon="🎫" text="No tickets records for this period." />
          ) : (
            <RecordsTable
              headers={['Date From', 'Date To', 'Tickets Count', 'Notes']}
              rows={filteredTicketsRecords.map((r) => [
                formatDateOnly(r.ticket_date),
                r.date_to ? formatDateOnly(r.date_to) : '—',
                String(r.tickets_count),
                r.notes?.trim() || '—',
              ])}
            />
          )}
        </PortalSection>
      )}

      {/* ── Sales Records ── */}
      {currentUser.team === 'Sales' && (
        <PortalSection eyebrow="Production" title="My Sales Records">
          {filteredSalesRecords.length === 0 ? (
            <EmptyState icon="💰" text="No sales records for this period." />
          ) : (
            <RecordsTable
              headers={['Date From', 'Date To', 'Amount', 'Notes']}
              rows={filteredSalesRecords.map((r) => [
                formatDateOnly(r.sale_date),
                r.date_to ? formatDateOnly(r.date_to) : '—',
                `$${Number(r.amount).toFixed(2)}`,
                r.notes?.trim() || '—',
              ])}
            />
          )}
        </PortalSection>
      )}

      {/* ── External sub-components (unchanged) ── */}
      <DigitalTrophyCabinet scope="agent" currentUser={currentUser} />
      <RecognitionWall compact currentUser={currentUser as any} />
      <QaAcademy team={currentUser.team} />
      <VoiceOfEmployeeSupabase currentUser={currentUser} />

      <MonitoringWidget
        count={monitoringItems.length}
        onClick={() => {
          setMonitoringOpen(true);
          window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        }}
      />
      <MonitoringDrawer
        open={monitoringOpen}
        onClose={() => setMonitoringOpen(false)}
        items={monitoringItems}
        mode="agent"
        onItemUpdated={() => loadAgentData({ force: true, background: true })}
      />
    </div>
  );
}

// ── Shared records table ──────────────────────────────────────

function RecordsTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="ap-table-wrap">
      <div className="ap-table ap-records-table">
        <div className="ap-table-head ap-records-cols">
          {headers.map((h) => <div key={h}>{h}</div>)}
        </div>
        {rows.map((row, idx) => (
          <div key={idx} className="ap-table-row ap-records-cols">
            {row.map((cell, ci) => (
              <div key={ci} className="ap-cell-primary">{cell}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default AgentPortal;
