/**
 * ReportsSupabase.tsx — Detroit Axle QA System
 * ──────────────────────────────────────────────────────────────
 * Upgraded to match the App.tsx design system:
 *   • Uses global CSS vars (--bg-*, --fg-*, --accent-*, --border-*)
 *   • Staggered card-entry animations via CSS animation-delay
 *   • Color-coded score/priority/status pills (performance tiers)
 *   • Refined bento-box grid layouts
 *   • Compact export pill-bar with icon affordances
 *   • Improved trend chart (grid + data-point dots)
 *   • Zero layout jitter — all animations are transform/opacity only
 * ──────────────────────────────────────────────────────────────
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────
// Types (unchanged)
// ─────────────────────────────────────────────────────────────

type TeamName = 'Calls' | 'Tickets' | 'Sales';
type PeriodMode = 'weekly' | 'monthly';

type ScoreDetail = {
  metric: string;
  result: string;
  pass: number;
  borderline: number;
  adjusted_weight?: number;
  adjustedWeight?: number;
  earned: number;
  counts_toward_score?: boolean;
  metric_comment?: string | null;
};

type AuditItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName | string;
  case_type: string;
  audit_date: string;
  order_number: string | null;
  phone_number: string | null;
  ticket_id: string | null;
  quality_score: number;
  comments: string | null;
  score_details?: ScoreDetail[];
};

type AgentProfile = {
  id: string;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
};

type CallsRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  calls_count: number;
  call_date: string;
  notes: string | null;
};

type TicketsRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  tickets_count: number;
  ticket_date: string;
  notes: string | null;
};

type SalesRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  amount: number;
  sale_date: string;
  notes: string | null;
};

type SupervisorRequest = {
  id: string;
  status: 'Open' | 'Under Review' | 'Closed';
  created_at: string;
  team: string | null;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  case_reference: string;
  agent_id?: string | null;
  agent_name?: string | null;
  case_type?: string;
  supervisor_name?: string;
  request_note?: string;
};

type AgentFeedback = {
  id: string;
  status: 'Open' | 'In Progress' | 'Closed';
  created_at: string;
  team: string;
  feedback_type: 'Coaching' | 'Audit Feedback' | 'Warning' | 'Follow-up';
  agent_name: string;
  agent_id?: string;
  qa_name?: string;
  subject: string;
  feedback_note?: string;
  action_plan?: string | null;
  due_date?: string | null;
};

type TrendPoint = {
  key: string;
  label: string;
  shortLabel: string;
  subjectAverage: number | null;
  teamAverage: number | null;
  auditCount: number;
  teamAuditCount: number;
};

type RecurringIssue = {
  metric: string;
  count: number;
  borderlineCount: number;
  failCount: number;
  autoFailCount: number;
};

type ProcedureHotspot = {
  caseType: string;
  count: number;
  borderlineCount: number;
  failCount: number;
  autoFailCount: number;
};

type ProcedureCaseItem = {
  id: string;
  auditDate: string;
  agentName: string;
  team: TeamName | string;
  caseType: string;
  qualityScore: number;
  procedureResult: string;
  metricComment: string | null;
};

const ISSUE_RESULTS = new Set(['Borderline', 'Fail', 'Auto-Fail']);

// ─────────────────────────────────────────────────────────────
// CSS Injection — reports-specific classes that extend App.tsx tokens
// ─────────────────────────────────────────────────────────────

const RPT_CSS_ID = 'da-reports-v2';
const RPT_CSS = `
  /* ── Entry animations ──────────────────────────────────── */
  @keyframes rptFadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes rptSlideIn {
    from { opacity: 0; transform: translateX(-6px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes rptScaleIn {
    from { opacity: 0; transform: scale(0.97); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes rptBarGrow {
    from { width: 0; }
    to   { width: var(--bar-target, 100%); }
  }

  /* ── Page shell ────────────────────────────────────────── */
  .rpt-page {
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    color: var(--fg-default);
    animation: rptFadeUp 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
    overflow: visible;
  }

  /* ── Page header ───────────────────────────────────────── */
  .rpt-page-header {
    margin-bottom: 24px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
  }
  .rpt-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-blue);
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .rpt-eyebrow::before {
    content: '';
    display: inline-block;
    width: 16px;
    height: 2px;
    background: var(--accent-blue);
    border-radius: 1px;
  }
  .rpt-page-title {
    font-size: 26px;
    font-weight: 700;
    color: var(--fg-default);
    letter-spacing: -0.03em;
    margin: 0 0 6px;
  }
  .rpt-page-sub {
    font-size: 13px;
    color: var(--fg-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ── Filter panel ──────────────────────────────────────── */
  .rpt-filter-panel {
    position: relative;
    z-index: 20;
    overflow: visible;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: 16px;
    padding: 18px;
    margin-bottom: 16px;
    box-shadow: var(--shadow-sm);
    animation: rptFadeUp 240ms cubic-bezier(0.16, 1, 0.3, 1) 40ms both;
  }
  .rpt-filter-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-muted);
    margin-bottom: 7px;
  }
  .rpt-filter-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 768px) {
    .rpt-filter-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 520px) {
    .rpt-filter-grid { grid-template-columns: 1fr; }
  }
  .rpt-agent-row {
    grid-column: 1 / -1;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .rpt-agent-picker-wrap {
    flex: 1;
    position: relative;
    z-index: 30;
  }

  /* Input / Select / Picker */
  .rpt-field {
    width: 100%;
    height: 36px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    background: var(--bg-overlay);
    color: var(--fg-default);
    font-size: 13px;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    transition: border-color 120ms ease, box-shadow 120ms ease;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
  }
  .rpt-field:focus {
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-blue) 20%, transparent);
  }
  .rpt-picker-btn {
    width: 100%;
    height: 36px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    background: var(--bg-overlay);
    color: var(--fg-default);
    font-size: 13px;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease;
    text-align: left;
  }
  .rpt-picker-btn:hover { border-color: var(--accent-blue); }
  .rpt-picker-btn-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .rpt-picker-btn-arrow {
    font-size: 10px;
    color: var(--fg-muted);
    flex-shrink: 0;
    transition: transform 150ms ease;
  }
  .rpt-picker-btn[aria-expanded="true"] .rpt-picker-btn-arrow {
    transform: rotate(180deg);
  }
  .rpt-picker-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0; right: 0;
    background: var(--bg-overlay);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    z-index: 9999;
    overflow: hidden;
    animation: rptScaleIn 140ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .rpt-picker-search-wrap {
    padding: 10px;
    border-bottom: 1px solid var(--border);
  }
  .rpt-picker-list {
    max-height: 260px;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .rpt-picker-option {
    padding: 8px 10px;
    border-radius: 7px;
    border: 1px solid transparent;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: var(--fg-default);
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    transition: background 80ms ease, border-color 80ms ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
  .rpt-picker-option:hover {
    background: var(--bg-subtle-hover, rgba(255,255,255,0.06));
  }
  .rpt-picker-option.selected {
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
    border-color: color-mix(in srgb, var(--accent-blue) 25%, transparent);
    color: var(--accent-blue);
  }
  .rpt-picker-empty {
    padding: 16px 10px;
    text-align: center;
    font-size: 12px;
    color: var(--fg-muted);
  }

  /* Clear filter btn */
  .rpt-clear-btn {
    height: 36px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    background: var(--bg-overlay);
    color: var(--fg-muted);
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    align-self: flex-end;
    transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
  }
  .rpt-clear-btn:hover {
    color: var(--fg-default);
    border-color: var(--accent-rose);
    background: color-mix(in srgb, var(--accent-rose) 8%, transparent);
  }

  /* ── Export bar ────────────────────────────────────────── */
  .rpt-export-bar {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 28px;
    padding: 12px 14px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 12px;
    animation: rptFadeUp 240ms cubic-bezier(0.16, 1, 0.3, 1) 60ms both;
  }
  .rpt-export-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted);
    align-self: center;
    margin-right: 4px;
    flex-shrink: 0;
  }
  .rpt-export-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 11px;
    border-radius: 6px;
    border: 1px solid var(--border-strong);
    background: var(--bg-overlay);
    color: var(--fg-muted);
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    white-space: nowrap;
    transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
  }
  .rpt-export-btn:hover {
    color: var(--fg-default);
    background: var(--bg-subtle-hover, rgba(255,255,255,0.06));
    border-color: color-mix(in srgb, var(--accent-blue) 40%, transparent);
  }
  .rpt-export-btn-primary {
    color: var(--accent-blue);
    border-color: color-mix(in srgb, var(--accent-blue) 30%, transparent);
    background: color-mix(in srgb, var(--accent-blue) 8%, transparent);
  }
  .rpt-export-btn-primary:hover {
    background: color-mix(in srgb, var(--accent-blue) 14%, transparent);
    border-color: color-mix(in srgb, var(--accent-blue) 50%, transparent);
    color: var(--accent-blue);
  }

  /* ── Section ────────────────────────────────────────────── */
  .rpt-section {
    margin-top: 32px;
    animation: rptFadeUp 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .rpt-section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .rpt-section-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--fg-default);
    letter-spacing: -0.02em;
    margin: 0;
  }
  .rpt-section-count {
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted);
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 1px 8px;
  }
  .rpt-section-divider {
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* ── KPI grid ───────────────────────────────────────────── */
  .rpt-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }
  .rpt-kpi-card {
    position: relative;
    padding: 16px;
    border-radius: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    overflow: hidden;
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }
  .rpt-kpi-card:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-sm);
  }
  .rpt-kpi-card::before {
    content: '';
    position: absolute;
    left: 0; top: 12px; bottom: 12px;
    width: 2px;
    border-radius: 0 2px 2px 0;
    background: var(--card-accent, var(--accent-blue));
  }
  .rpt-kpi-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted);
    margin-bottom: 8px;
    letter-spacing: 0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rpt-kpi-value {
    font-size: 24px;
    font-weight: 800;
    color: var(--fg-default);
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .rpt-kpi-value.accent {
    color: var(--card-accent, var(--accent-blue));
  }

  /* ── Team breakdown grid ────────────────────────────────── */
  .rpt-team-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 8px;
  }
  @media (max-width: 600px) {
    .rpt-team-grid { grid-template-columns: 1fr; }
  }
  .rpt-team-card {
    padding: 18px;
    border-radius: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    position: relative;
    overflow: hidden;
    transition: border-color 140ms ease;
  }
  .rpt-team-card:hover { border-color: var(--border-strong); }
  .rpt-team-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .rpt-team-avg {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.05em;
    line-height: 1;
    margin-bottom: 4px;
  }
  .rpt-team-sub {
    font-size: 11px;
    color: var(--fg-muted);
  }

  /* ── Detail 2-col grid ──────────────────────────────────── */
  .rpt-detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 14px;
  }
  @media (max-width: 700px) {
    .rpt-detail-grid { grid-template-columns: 1fr; }
  }
  .rpt-detail-card {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 18px;
    overflow: hidden;
  }
  .rpt-detail-card-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent-blue);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .rpt-detail-card-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }
  .rpt-detail-field {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 0;
    border-bottom: 1px solid var(--border);
    gap: 12px;
  }
  .rpt-detail-field:last-child { border-bottom: none; }
  .rpt-detail-field-key {
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-muted);
    flex-shrink: 0;
  }
  .rpt-detail-field-val {
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-default);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ── Score pill (performance-tiered) ────────────────────── */
  .rpt-score-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 58px;
    height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    font-family: var(--font-mono, 'Geist Mono', monospace);
    letter-spacing: 0.01em;
  }
  .rpt-score-pill.tier-s {
    background: color-mix(in srgb, var(--accent-emerald) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-emerald) 30%, transparent);
    color: var(--accent-emerald);
  }
  .rpt-score-pill.tier-a {
    background: color-mix(in srgb, var(--accent-blue) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent);
    color: var(--accent-blue);
  }
  .rpt-score-pill.tier-b {
    background: color-mix(in srgb, var(--accent-amber) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-amber) 30%, transparent);
    color: var(--accent-amber);
  }
  .rpt-score-pill.tier-c {
    background: color-mix(in srgb, var(--accent-rose) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-rose) 30%, transparent);
    color: var(--accent-rose);
  }

  /* ── Status / Priority pills ────────────────────────────── */
  .rpt-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .rpt-pill-open {
    background: color-mix(in srgb, var(--accent-amber) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-amber) 28%, transparent);
    color: var(--accent-amber);
  }
  .rpt-pill-review {
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-blue) 28%, transparent);
    color: var(--accent-blue);
  }
  .rpt-pill-closed {
    background: color-mix(in srgb, var(--accent-emerald) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-emerald) 25%, transparent);
    color: var(--accent-emerald);
  }
  .rpt-pill-progress {
    background: color-mix(in srgb, var(--accent-violet) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-violet) 28%, transparent);
    color: var(--accent-violet);
  }
  .rpt-pill-urgent {
    background: color-mix(in srgb, var(--accent-rose) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-rose) 30%, transparent);
    color: var(--accent-rose);
  }
  .rpt-pill-high {
    background: color-mix(in srgb, var(--accent-amber) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-amber) 28%, transparent);
    color: var(--accent-amber);
  }
  .rpt-pill-medium {
    background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-blue) 22%, transparent);
    color: var(--accent-blue);
  }
  .rpt-pill-low {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    color: var(--fg-muted);
  }
  .rpt-pill-coaching {
    background: color-mix(in srgb, var(--accent-cyan) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-cyan) 25%, transparent);
    color: var(--accent-cyan);
  }
  .rpt-pill-warning {
    background: color-mix(in srgb, var(--accent-rose) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent);
    color: var(--accent-rose);
  }
  .rpt-pill-audit {
    background: color-mix(in srgb, var(--accent-violet) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-violet) 25%, transparent);
    color: var(--accent-violet);
  }
  .rpt-pill-followup {
    background: color-mix(in srgb, var(--accent-emerald) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-emerald) 25%, transparent);
    color: var(--accent-emerald);
  }
  .rpt-pill-default {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    color: var(--fg-muted);
  }

  /* ── Data table ─────────────────────────────────────────── */
  .rpt-table-wrap {
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg-elevated);
    max-height: 380px;
    overflow-y: auto;
  }
  .rpt-table-head-row {
    display: grid;
    gap: 12px;
    padding: 0 16px;
    height: 34px;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--bg-overlay);
    border-bottom: 1px solid var(--border);
  }
  .rpt-table-head-cell {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rpt-table-body-row {
    display: grid;
    gap: 12px;
    padding: 0 16px;
    min-height: 50px;
    align-items: center;
    border-bottom: 1px solid var(--border);
    transition: background 80ms ease;
    color: var(--fg-default);
  }
  .rpt-table-body-row:last-child { border-bottom: none; }
  .rpt-table-body-row:hover {
    background: var(--bg-subtle-hover, rgba(255,255,255,0.04));
  }
  .rpt-table-cell { min-width: 0; }
  .rpt-cell-primary {
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-default);
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rpt-cell-secondary {
    font-size: 11px;
    color: var(--fg-muted);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rpt-empty-row {
    padding: 36px 20px;
    text-align: center;
    font-size: 13px;
    color: var(--fg-muted);
  }

  /* ── Trend chart ────────────────────────────────────────── */
  .rpt-chart-wrap {
    padding: 16px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-top: 14px;
  }
  .rpt-chart-svg {
    width: 100%;
    height: 220px;
    display: block;
    overflow: visible;
  }
  .rpt-chart-legend {
    display: flex;
    gap: 18px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .rpt-chart-legend-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    font-weight: 600;
    color: var(--fg-muted);
  }
  .rpt-chart-legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .rpt-chart-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    padding: 0 4px;
  }
  .rpt-chart-label {
    font-size: 10px;
    color: var(--fg-muted);
    font-family: var(--font-mono, 'Geist Mono', monospace);
    text-align: center;
  }
  .rpt-chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 120px;
    font-size: 13px;
    color: var(--fg-muted);
  }

  /* ── Trend section ──────────────────────────────────────── */
  .rpt-trend-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .rpt-trend-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .rpt-toggle-group {
    display: inline-flex;
    background: var(--bg-overlay);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }
  .rpt-toggle-btn {
    height: 26px;
    padding: 0 12px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--fg-muted);
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    transition: color 120ms ease, background 120ms ease;
  }
  .rpt-toggle-btn:hover { color: var(--fg-default); }
  .rpt-toggle-btn.active {
    background: var(--bg-elevated);
    color: var(--fg-default);
    box-shadow: var(--shadow-sm);
  }
  .rpt-export-trend-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 12px;
    border-radius: 7px;
    border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent);
    background: color-mix(in srgb, var(--accent-blue) 8%, transparent);
    color: var(--accent-blue);
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    white-space: nowrap;
    transition: background 120ms ease;
  }
  .rpt-export-trend-btn:hover {
    background: color-mix(in srgb, var(--accent-blue) 14%, transparent);
  }
  .rpt-trend-helper {
    font-size: 11px;
    color: var(--fg-muted);
    line-height: 1.6;
    margin-bottom: 12px;
  }
  .rpt-trend-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
    margin-bottom: 14px;
  }
  .rpt-trend-stat {
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
  }
  .rpt-trend-stat-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-muted);
    margin-bottom: 4px;
  }
  .rpt-trend-stat-value {
    font-size: 18px;
    font-weight: 800;
    color: var(--fg-default);
    letter-spacing: -0.03em;
  }
  .rpt-trend-detail-grid {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 10px;
    margin-top: 14px;
  }
  @media (max-width: 820px) {
    .rpt-trend-detail-grid { grid-template-columns: 1fr; }
  }
  .rpt-trend-procedure-grid {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 10px;
    margin-top: 10px;
  }
  @media (max-width: 820px) {
    .rpt-trend-procedure-grid { grid-template-columns: 1fr; }
  }

  /* ── Issue cards ────────────────────────────────────────── */
  .rpt-issue-card {
    padding: 12px;
    border-radius: 10px;
    background: var(--bg-overlay);
    border: 1px solid var(--border);
    margin-bottom: 6px;
    transition: border-color 120ms ease;
  }
  .rpt-issue-card:last-child { margin-bottom: 0; }
  .rpt-issue-card:hover { border-color: var(--border-strong); }
  .rpt-issue-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
  }
  .rpt-issue-metric {
    font-size: 12px;
    font-weight: 700;
    color: var(--fg-default);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rpt-issue-count {
    height: 22px;
    min-width: 28px;
    padding: 0 8px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent);
    color: var(--accent-blue);
    font-size: 11px;
    font-weight: 800;
    flex-shrink: 0;
  }
  .rpt-issue-meta {
    font-size: 10px;
    color: var(--fg-muted);
    margin-bottom: 8px;
  }
  .rpt-issue-bar-track {
    height: 3px;
    border-radius: 999px;
    background: var(--bg-subtle);
    overflow: hidden;
  }
  .rpt-issue-bar-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent-blue), var(--accent-cyan));
    transition: width 400ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  /* ── Generic table (trend / hotspot) ────────────────────── */
  .rpt-generic-table { display: grid; gap: 4px; }
  .rpt-generic-row {
    display: grid;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 8px;
    align-items: center;
    font-size: 12px;
  }
  .rpt-generic-row.head {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }
  .rpt-generic-row.body {
    background: var(--bg-overlay);
    color: var(--fg-default);
    font-weight: 500;
    transition: background 80ms ease;
  }
  .rpt-generic-row.body:hover {
    background: var(--bg-subtle-hover, rgba(255,255,255,0.06));
  }

  /* Procedure cases */
  .rpt-proc-wrap {
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-elevated);
  }
  .rpt-proc-row {
    display: grid;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    align-items: center;
    font-size: 11px;
    color: var(--fg-default);
    transition: background 80ms ease;
  }
  .rpt-proc-row:last-child { border-bottom: none; }
  .rpt-proc-row:hover { background: var(--bg-subtle-hover, rgba(255,255,255,0.04)); }
  .rpt-proc-row.head {
    position: sticky; top: 0; z-index: 1;
    background: var(--bg-overlay);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }
  .rpt-proc-result-bl {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    background: color-mix(in srgb, var(--accent-amber) 12%, transparent);
    color: var(--accent-amber);
  }
  .rpt-proc-result-fail {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    background: color-mix(in srgb, var(--accent-rose) 12%, transparent);
    color: var(--accent-rose);
  }
  .rpt-proc-result-af {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    background: color-mix(in srgb, var(--accent-rose) 20%, transparent);
    color: var(--accent-rose);
    border: 1px solid color-mix(in srgb, var(--accent-rose) 40%, transparent);
  }

  /* ── Loader ─────────────────────────────────────────────── */
  .rpt-loader-shell {
    display: grid;
    place-items: center;
    padding: 80px 24px;
    animation: rptFadeUp 200ms ease both;
  }
  .rpt-loader-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
  }
  .rpt-loader-spinner {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent-blue);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .rpt-loader-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-muted);
  }
`;

function useReportStyles() {
  useEffect(() => {
    if (document.getElementById(RPT_CSS_ID)) return;
    const el = document.createElement('style');
    el.id = RPT_CSS_ID;
    el.textContent = RPT_CSS;
    document.head.appendChild(el);
    return () => { document.getElementById(RPT_CSS_ID)?.remove(); };
  }, []);
}

// ─────────────────────────────────────────────────────────────
// Color helpers
// ─────────────────────────────────────────────────────────────

function getScoreTierClass(score: number): string {
  if (score >= 95) return 'tier-s';
  if (score >= 85) return 'tier-a';
  if (score >= 75) return 'tier-b';
  return 'tier-c';
}

function getStatusPillClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'open') return 'rpt-pill rpt-pill-open';
  if (s === 'closed') return 'rpt-pill rpt-pill-closed';
  if (s.includes('review')) return 'rpt-pill rpt-pill-review';
  if (s === 'in progress') return 'rpt-pill rpt-pill-progress';
  return 'rpt-pill rpt-pill-default';
}

function getPriorityPillClass(priority: string): string {
  const p = priority.toLowerCase();
  if (p === 'urgent') return 'rpt-pill rpt-pill-urgent';
  if (p === 'high') return 'rpt-pill rpt-pill-high';
  if (p === 'medium') return 'rpt-pill rpt-pill-medium';
  if (p === 'low') return 'rpt-pill rpt-pill-low';
  return 'rpt-pill rpt-pill-default';
}

function getFeedbackTypePillClass(type: string): string {
  const t = type.toLowerCase();
  if (t === 'coaching') return 'rpt-pill rpt-pill-coaching';
  if (t === 'warning') return 'rpt-pill rpt-pill-warning';
  if (t.includes('audit')) return 'rpt-pill rpt-pill-audit';
  if (t.includes('follow')) return 'rpt-pill rpt-pill-followup';
  return 'rpt-pill rpt-pill-default';
}

function getProcResultClass(result: string): string {
  if (result === 'Borderline') return 'rpt-proc-result-bl';
  if (result === 'Auto-Fail') return 'rpt-proc-result-af';
  if (result === 'Fail') return 'rpt-proc-result-fail';
  return '';
}

// Team colors
const TEAM_CONFIG: Record<string, { accent: string; label: string }> = {
  Calls: { accent: 'var(--accent-cyan)', label: '📞 Calls' },
  Tickets: { accent: 'var(--accent-violet)', label: '🎫 Tickets' },
  Sales: { accent: 'var(--accent-emerald)', label: '💰 Sales' },
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  accent = 'var(--accent-blue)',
  accentValue = false,
  delay = 0,
}: {
  label: string;
  value: string;
  accent?: string;
  accentValue?: boolean;
  delay?: number;
}) {
  return (
    <div
      className="rpt-kpi-card"
      style={
        {
          '--card-accent': accent,
          animationDelay: `${delay}ms`,
          animationFillMode: 'both',
          animation: `rptFadeUp 240ms cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
        } as CSSProperties
      }
    >
      <div className="rpt-kpi-label">{label}</div>
      <div className={`rpt-kpi-value${accentValue ? ' accent' : ''}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
  delay = 0,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="rpt-section"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="rpt-section-header">
        <h3 className="rpt-section-title">{title}</h3>
        {count !== undefined && (
          <span className="rpt-section-count">{count}</span>
        )}
        <div className="rpt-section-divider" />
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Trend Chart (improved)
// ─────────────────────────────────────────────────────────────

function MiniTrendChart({ points }: { points: TrendPoint[] }) {
  const W = 1000;
  const H = 200;
  const PAD_L = 44;
  const PAD_R = 20;
  const PAD_T = 16;
  const PAD_B = 28;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  if (points.length === 0) {
    return <div className="rpt-chart-empty">No periods available for the current filter.</div>;
  }

  const subVals = points.map((p) => p.subjectAverage).filter((v): v is number => v != null);
  const teamVals = points.map((p) => p.teamAverage).filter((v): v is number => v != null);
  const allVals = [...subVals, ...teamVals];
  const minVal = allVals.length ? Math.max(0, Math.min(...allVals) - 3) : 0;
  const maxVal = allVals.length ? Math.min(100, Math.max(...allVals) + 3) : 100;
  const range = Math.max(maxVal - minVal, 1);

  const toX = (i: number) =>
    PAD_L + (i / Math.max(points.length - 1, 1)) * plotW;
  const toY = (v: number) =>
    PAD_T + plotH - ((v - minVal) / range) * plotH;

  const buildPolyline = (vals: Array<number | null>) =>
    vals
      .map((v, i) => (v != null ? `${toX(i)},${toY(v)}` : null))
      .filter(Boolean)
      .join(' ');

  const subPolyline = buildPolyline(points.map((p) => p.subjectAverage));
  const teamPolyline = buildPolyline(points.map((p) => p.teamAverage));

  // Grid lines at 4 levels
  const gridLevels = [0, 0.33, 0.66, 1].map((t) => ({
    y: PAD_T + plotH - t * plotH,
    val: (minVal + t * range).toFixed(0),
  }));

  const visibleLabels = points.length <= 10 ? points : points.filter((_, i) => i % Math.ceil(points.length / 8) === 0 || i === points.length - 1);

  return (
    <div className="rpt-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="rpt-chart-svg" preserveAspectRatio="none">
        {/* Grid lines */}
        {gridLevels.map((g) => (
          <g key={g.val}>
            <line
              x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y}
              stroke="rgba(148,163,184,0.10)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text
              x={PAD_L - 6} y={g.y + 4}
              textAnchor="end"
              fontSize="20"
              fill="rgba(100,116,139,0.8)"
              fontFamily="var(--font-mono,'Geist Mono',monospace)"
            >
              {g.val}
            </text>
          </g>
        ))}

        {/* X-axis baseline */}
        <line
          x1={PAD_L} y1={PAD_T + plotH}
          x2={W - PAD_R} y2={PAD_T + plotH}
          stroke="rgba(148,163,184,0.18)"
          strokeWidth="1.5"
        />

        {/* Team avg line */}
        {teamPolyline && (
          <polyline
            points={teamPolyline}
            fill="none"
            stroke="rgba(100,116,139,0.50)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
        )}

        {/* Subject avg line */}
        {subPolyline && (
          <polyline
            points={subPolyline}
            fill="none"
            stroke="var(--accent-blue)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        {/* Data-point dots */}
        {points.map((p, i) => (
          <g key={p.key}>
            {p.teamAverage != null && (
              <circle
                cx={toX(i)} cy={toY(p.teamAverage)} r="4"
                fill="var(--bg-elevated)"
                stroke="rgba(100,116,139,0.60)"
                strokeWidth="2"
              />
            )}
            {p.subjectAverage != null && (
              <circle
                cx={toX(i)} cy={toY(p.subjectAverage)} r="5"
                fill="var(--bg-elevated)"
                stroke="var(--accent-blue)"
                strokeWidth="2.5"
              />
            )}
          </g>
        ))}
      </svg>

      <div className="rpt-chart-legend">
        <div className="rpt-chart-legend-item">
          <span className="rpt-chart-legend-dot" style={{ background: 'var(--accent-blue)' }} />
          Selected Scope
        </div>
        <div className="rpt-chart-legend-item">
          <span className="rpt-chart-legend-dot" style={{ background: 'rgba(100,116,139,0.60)' }} />
          Team Average
        </div>
      </div>

      {points.length > 1 && (
        <div className="rpt-chart-labels">
          {visibleLabels.map((p) => (
            <div key={p.key} className="rpt-chart-label">{p.shortLabel}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PerformanceTrendsSection
// ─────────────────────────────────────────────────────────────

function PerformanceTrendsSection({
  audits,
  allAudits,
  selectedAgents,
  effectiveTeamFilter,
}: {
  audits: AuditItem[];
  allAudits: AuditItem[];
  selectedAgents: AgentProfile[];
  effectiveTeamFilter: string;
}) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('weekly');

  const trendPoints = useMemo(() => buildTrendPoints(audits, allAudits, periodMode), [audits, allAudits, periodMode]);
  const recurringIssues = useMemo(() => buildRecurringIssues(audits), [audits]);
  const procedureHotspots = useMemo(() => buildProcedureHotspots(audits), [audits]);
  const procedureCases = useMemo(() => buildProcedureFlaggedCases(audits), [audits]);

  const latestAverage = trendPoints.length > 0 ? trendPoints[trendPoints.length - 1].subjectAverage : null;
  const previousAverage = trendPoints.length > 1 ? trendPoints[trendPoints.length - 2].subjectAverage : null;
  const teamLatestAverage = trendPoints.length > 0 ? trendPoints[trendPoints.length - 1].teamAverage : null;
  const momentumDelta = latestAverage != null && previousAverage != null ? Number((latestAverage - previousAverage).toFixed(2)) : null;
  const teamGap = latestAverage != null && teamLatestAverage != null ? Number((latestAverage - teamLatestAverage).toFixed(2)) : null;

  const subjectLabel = selectedAgents.length === 1
    ? selectedAgents[0].display_name ? `${selectedAgents[0].agent_name} — ${selectedAgents[0].display_name}` : `${selectedAgents[0].agent_name} — ${selectedAgents[0].agent_id || '-'}`
    : selectedAgents.length > 1
      ? `${selectedAgents.length} Agents Selected`
      : effectiveTeamFilter ? `${effectiveTeamFilter} Team` : 'All Teams';

  const strongestIssue = recurringIssues[0]?.metric || 'None';
  const totalIssueTouches = recurringIssues.reduce((s, i) => s + i.count, 0);
  const procedureTotal = procedureCases.length;
  const topProcedureCaseType = procedureHotspots[0]?.caseType || 'None';

  const getMomentumDisplay = () => {
    if (momentumDelta == null) return { label: '—', color: 'var(--fg-muted)' };
    if (momentumDelta >= 2) return { label: `↑ +${momentumDelta.toFixed(2)}`, color: 'var(--accent-emerald)' };
    if (momentumDelta <= -2) return { label: `↓ ${momentumDelta.toFixed(2)}`, color: 'var(--accent-rose)' };
    return { label: `→ ${momentumDelta > 0 ? '+' : ''}${momentumDelta.toFixed(2)}`, color: 'var(--accent-amber)' };
  };

  const getGapDisplay = () => {
    if (teamGap == null) return { label: '—', color: 'var(--fg-muted)' };
    if (teamGap > 0) return { label: `+${teamGap.toFixed(2)} pts`, color: 'var(--accent-emerald)' };
    if (teamGap < 0) return { label: `${teamGap.toFixed(2)} pts`, color: 'var(--accent-rose)' };
    return { label: 'On par', color: 'var(--accent-amber)' };
  };

  const momentum = getMomentumDisplay();
  const gap = getGapDisplay();

  async function handleExportTrendWorkbook() {
    try {
      const baseFilename = `performance_trends_${sanitizeFilePart(subjectLabel)}_${periodMode}_${new Date().toISOString().slice(0, 10)}`;
      const chartSvg = buildTrendChartSvg(trendPoints, subjectLabel, periodMode);
      const chartPngBlob = await svgToPngBlob(chartSvg, 1400, 460);
      const workbookXml = buildPerformanceTrendWorkbookXml({
        subjectLabel, periodMode, latestAverage, momentumDelta, teamGap,
        strongestIssue, procedureTotal, topProcedureCaseType, trendPoints,
        recurringIssues, procedureHotspots, procedureCases,
        chartAssetName: `${baseFilename}_chart.png`,
      });
      await downloadTrendExportPackage({ baseFilename, workbookXml, chartSvg, chartPngBlob });
    } catch (error) {
      console.error('Trend export failed', error);
      alert('Unable to export Performance Trends right now.');
    }
  }

  return (
    <Section title="Performance Trends" count={trendPoints.length > 0 ? trendPoints.length : undefined}>
      {/* Header row */}
      <div className="rpt-trend-header">
        <div>
          <div style={{ fontSize: '12px', color: 'var(--fg-muted)', marginBottom: '4px' }}>
            Scope: <strong style={{ color: 'var(--fg-default)' }}>{subjectLabel}</strong>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>
            {totalIssueTouches} issue hits · Procedure hotspot: {topProcedureCaseType}
          </div>
        </div>
        <div className="rpt-trend-actions">
          <div className="rpt-toggle-group">
            <button
              type="button"
              className={`rpt-toggle-btn${periodMode === 'weekly' ? ' active' : ''}`}
              onClick={() => setPeriodMode('weekly')}
            >
              Weekly
            </button>
            <button
              type="button"
              className={`rpt-toggle-btn${periodMode === 'monthly' ? ' active' : ''}`}
              onClick={() => setPeriodMode('monthly')}
            >
              Monthly
            </button>
          </div>
          <button type="button" className="rpt-export-trend-btn" onClick={handleExportTrendWorkbook}>
            ↓ Export Excel + Chart
          </button>
        </div>
      </div>

      {/* KPI stat pills */}
      <div className="rpt-trend-info-grid">
        <div className="rpt-trend-stat">
          <div className="rpt-trend-stat-label">Current Avg</div>
          <div className="rpt-trend-stat-value" style={{ color: latestAverage != null ? `var(--accent-blue)` : 'var(--fg-muted)' }}>
            {latestAverage != null ? `${latestAverage.toFixed(2)}%` : '—'}
          </div>
        </div>
        <div className="rpt-trend-stat">
          <div className="rpt-trend-stat-label">Momentum</div>
          <div className="rpt-trend-stat-value" style={{ color: momentum.color }}>{momentum.label}</div>
        </div>
        <div className="rpt-trend-stat">
          <div className="rpt-trend-stat-label">vs Team Avg</div>
          <div className="rpt-trend-stat-value" style={{ color: gap.color }}>{gap.label}</div>
        </div>
        <div className="rpt-trend-stat">
          <div className="rpt-trend-stat-label">Top Issue</div>
          <div className="rpt-trend-stat-value" style={{ fontSize: '13px', letterSpacing: '-0.01em', color: 'var(--fg-default)' }}>
            {strongestIssue}
          </div>
        </div>
        <div className="rpt-trend-stat">
          <div className="rpt-trend-stat-label">Procedure Flags</div>
          <div className="rpt-trend-stat-value" style={{ color: procedureTotal > 0 ? 'var(--accent-rose)' : 'var(--fg-muted)' }}>
            {procedureTotal || '—'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <MiniTrendChart points={trendPoints} />

      {/* Trend table + Issues side by side */}
      <div className="rpt-trend-detail-grid">
        {/* Breakdown table */}
        <div className="rpt-detail-card">
          <div className="rpt-detail-card-label">Trend Breakdown</div>
          {trendPoints.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>No trend data for this selection.</p>
          ) : (
            <div className="rpt-generic-table">
              <div className="rpt-generic-row head" style={{ gridTemplateColumns: '1.4fr 0.9fr 0.9fr 0.6fr 0.6fr' }}>
                <div>Period</div>
                <div>Scope</div>
                <div>Team</div>
                <div>Audits</div>
                <div>Team</div>
              </div>
              {trendPoints.map((p) => (
                <div key={p.key} className="rpt-generic-row body" style={{ gridTemplateColumns: '1.4fr 0.9fr 0.9fr 0.6fr 0.6fr' }}>
                  <div style={{ fontSize: '11px' }}>{p.label}</div>
                  <div style={{ fontWeight: 700, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {p.subjectAverage != null ? `${p.subjectAverage.toFixed(1)}%` : '—'}
                  </div>
                  <div style={{ color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {p.teamAverage != null ? `${p.teamAverage.toFixed(1)}%` : '—'}
                  </div>
                  <div style={{ color: 'var(--fg-muted)' }}>{p.auditCount}</div>
                  <div style={{ color: 'var(--fg-muted)' }}>{p.teamAuditCount}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recurring issues */}
        <div className="rpt-detail-card">
          <div className="rpt-detail-card-label">Recurring Issues</div>
          {recurringIssues.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>No Borderline / Fail issues in this range.</p>
          ) : (
            recurringIssues.map((issue, idx) => (
              <div key={issue.metric} className="rpt-issue-card" style={{ animationDelay: `${idx * 40}ms` }}>
                <div className="rpt-issue-header">
                  <div className="rpt-issue-metric">{issue.metric}</div>
                  <div className="rpt-issue-count">{issue.count}</div>
                </div>
                <div className="rpt-issue-meta">
                  Borderline: {issue.borderlineCount} · Fail: {issue.failCount} · Auto-Fail: {issue.autoFailCount}
                </div>
                <div className="rpt-issue-bar-track">
                  <div
                    className="rpt-issue-bar-fill"
                    style={{ width: `${Math.max(10, Math.round((issue.count / Math.max(recurringIssues[0]?.count || 1, 1)) * 100))}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Procedure hotspots + flagged cases */}
      <div className="rpt-trend-procedure-grid">
        {/* Hotspots */}
        <div className="rpt-detail-card">
          <div className="rpt-detail-card-label">Procedure Hotspots</div>
          {procedureHotspots.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>No procedure issues in this range.</p>
          ) : (
            <div className="rpt-generic-table">
              <div className="rpt-generic-row head" style={{ gridTemplateColumns: '1.5fr 0.6fr 0.8fr 0.5fr 0.7fr' }}>
                <div>Case Type</div>
                <div>Total</div>
                <div>Borderline</div>
                <div>Fail</div>
                <div>Auto-Fail</div>
              </div>
              {procedureHotspots.slice(0, 8).map((item) => (
                <div key={item.caseType} className="rpt-generic-row body" style={{ gridTemplateColumns: '1.5fr 0.6fr 0.8fr 0.5fr 0.7fr' }}>
                  <div style={{ fontSize: '11px' }}>{item.caseType}</div>
                  <div style={{ fontWeight: 700 }}>{item.count}</div>
                  <div style={{ color: 'var(--accent-amber)' }}>{item.borderlineCount}</div>
                  <div style={{ color: 'var(--accent-rose)' }}>{item.failCount}</div>
                  <div style={{ color: 'var(--accent-rose)', fontWeight: 700 }}>{item.autoFailCount}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Flagged cases */}
        <div className="rpt-detail-card">
          <div className="rpt-detail-card-label">Procedure Flagged Cases</div>
          {procedureCases.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>No procedure-flagged cases.</p>
          ) : (
            <div className="rpt-proc-wrap">
              <div className="rpt-proc-row head" style={{ gridTemplateColumns: '0.8fr 1.1fr 0.6fr 1fr 0.8fr 0.7fr' }}>
                <div>Date</div><div>Agent</div><div>Team</div>
                <div>Case Type</div><div>Result</div><div>Score</div>
              </div>
              {procedureCases.slice(0, 16).map((item) => (
                <div key={item.id} className="rpt-proc-row" style={{ gridTemplateColumns: '0.8fr 1.1fr 0.6fr 1fr 0.8fr 0.7fr' }}>
                  <div style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>{item.auditDate}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.agentName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--fg-muted)' }}>{item.team}</div>
                  <div style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.caseType}</div>
                  <div><span className={getProcResultClass(item.procedureResult)}>{item.procedureResult}</span></div>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '11px', fontWeight: 700, color: 'var(--accent-blue)' }}>{item.qualityScore.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedAgents.length === 0 && !effectiveTeamFilter && (
        <div className="rpt-trend-helper" style={{ marginTop: '10px' }}>
          No team or agent selected — showing all visible audits vs overall baseline.
        </div>
      )}
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

function ReportsSupabase() {
  useReportStyles();

  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [callsRecords, setCallsRecords] = useState<CallsRecord[]>([]);
  const [ticketsRecords, setTicketsRecords] = useState<TicketsRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [supervisorRequests, setSupervisorRequests] = useState<SupervisorRequest[]>([]);
  const [agentFeedback, setAgentFeedback] = useState<AgentFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [selectedAgentProfileIds, setSelectedAgentProfileIds] = useState<string[]>([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);

  const agentPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { void loadReportsData(); }, []);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (agentPickerRef.current && !agentPickerRef.current.contains(e.target as Node)) {
        setIsAgentPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  async function loadReportsData() {
    setLoading(true);
    const [auditsR, profilesR, callsR, ticketsR, salesR, requestsR, feedbackR] = await Promise.all([
      supabase.from('audits').select('*').order('audit_date', { ascending: false }),
      supabase.from('profiles').select('id, agent_id, agent_name, display_name, team').eq('role', 'agent').order('agent_name', { ascending: true }),
      supabase.from('calls_records').select('*').order('call_date', { ascending: false }),
      supabase.from('tickets_records').select('*').order('ticket_date', { ascending: false }),
      supabase.from('sales_records').select('*').order('sale_date', { ascending: false }),
      supabase.from('supervisor_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('agent_feedback').select('*').order('created_at', { ascending: false }),
    ]);
    setAudits((auditsR.data as AuditItem[]) || []);
    setProfiles((profilesR.data as AgentProfile[]) || []);
    setCallsRecords((callsR.data as CallsRecord[]) || []);
    setTicketsRecords((ticketsR.data as TicketsRecord[]) || []);
    setSalesRecords((salesR.data as SalesRecord[]) || []);
    setSupervisorRequests((requestsR.data as SupervisorRequest[]) || []);
    setAgentFeedback((feedbackR.data as AgentFeedback[]) || []);
    setLoading(false);
  }

  function getDisplayName(agentId?: string | null, agentName?: string | null, team?: string | null) {
    return profiles.find((p) => p.agent_id === (agentId || null) && p.agent_name === (agentName || '') && p.team === (team || null))?.display_name || null;
  }

  function getAgentLabel(profile: AgentProfile) {
    return profile.display_name ? `${profile.agent_name} · ${profile.display_name}` : `${profile.agent_name} · ${profile.agent_id}`;
  }

  function matchesDate(dateValue: string) {
    const raw = String(dateValue || '').slice(0, 10);
    return (dateFrom ? raw >= dateFrom : true) && (dateTo ? raw <= dateTo : true);
  }

  const selectedAgents = useMemo(
    () => profiles.filter((p) => selectedAgentProfileIds.includes(p.id)),
    [profiles, selectedAgentProfileIds]
  );

  const selectedAgent = selectedAgents.length === 1 ? selectedAgents[0] : null;

  function matchesSelectedAgent(itemAgentId?: string | null, itemAgentName?: string | null) {
    if (selectedAgents.length === 0) return true;

    return selectedAgents.some((agent) => {
      if (agent.agent_id && itemAgentId) {
        return String(itemAgentId).trim() === String(agent.agent_id).trim();
      }

      return String(itemAgentName || '').trim().toLowerCase() ===
        String(agent.agent_name || '').trim().toLowerCase();
    });
  }

  const visibleAgentProfiles = useMemo(() => {
    const scoped = teamFilter ? profiles.filter((p) => p.team === teamFilter) : profiles;
    const q = agentSearch.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((p) =>
      p.agent_name.toLowerCase().includes(q) ||
      (p.agent_id || '').toLowerCase().includes(q) ||
      (p.display_name || '').toLowerCase().includes(q)
    );
  }, [profiles, teamFilter, agentSearch]);

  function handleSelectAgent(profile: AgentProfile) {
    setSelectedAgentProfileIds((current) =>
      current.includes(profile.id)
        ? current.filter((id) => id !== profile.id)
        : [...current, profile.id]
    );
    setAgentSearch('');
  }

  function clearAgentFilter() {
    setSelectedAgentProfileIds([]);
    setAgentSearch('');
    setIsAgentPickerOpen(false);
  }

  // ── Filtered datasets ──────────────────────────────────────

  const filteredAudits = useMemo(() => audits.filter((item) => {
    const matchesTeam = teamFilter ? item.team === teamFilter : true;
    return matchesTeam && matchesSelectedAgent(item.agent_id, item.agent_name) && matchesDate(item.audit_date);
  }), [audits, teamFilter, dateFrom, dateTo, selectedAgentProfileIds]);

  const filteredCalls = useMemo(() => callsRecords.filter((item) => {
    const matchesTeam = teamFilter ? teamFilter === 'Calls' : true;
    return matchesTeam && matchesSelectedAgent(item.agent_id, item.agent_name) && matchesDate(item.call_date);
  }), [callsRecords, teamFilter, dateFrom, dateTo, selectedAgentProfileIds]);

  const filteredTickets = useMemo(() => ticketsRecords.filter((item) => {
    const matchesTeam = teamFilter ? teamFilter === 'Tickets' : true;
    return matchesTeam && matchesSelectedAgent(item.agent_id, item.agent_name) && matchesDate(item.ticket_date);
  }), [ticketsRecords, teamFilter, dateFrom, dateTo, selectedAgentProfileIds]);

  const filteredSales = useMemo(() => salesRecords.filter((item) => {
    const matchesTeam = teamFilter ? teamFilter === 'Sales' : true;
    return matchesTeam && matchesSelectedAgent(item.agent_id, item.agent_name) && matchesDate(item.sale_date);
  }), [salesRecords, teamFilter, dateFrom, dateTo, selectedAgentProfileIds]);

  const filteredRequests = useMemo(() => supervisorRequests.filter((item) => {
    const matchesTeam = teamFilter ? item.team === teamFilter : true;
    return matchesTeam && matchesSelectedAgent(item.agent_id || null, item.agent_name || null) && matchesDate(item.created_at.slice(0, 10));
  }), [supervisorRequests, teamFilter, dateFrom, dateTo, selectedAgentProfileIds]);

  const filteredFeedback = useMemo(() => agentFeedback.filter((item) => {
    const matchesTeam = teamFilter ? item.team === teamFilter : true;
    return matchesTeam && matchesSelectedAgent(item.agent_id || null, item.agent_name || null) && matchesDate(item.created_at.slice(0, 10));
  }), [agentFeedback, teamFilter, dateFrom, dateTo, selectedAgentProfileIds]);

  // ── Aggregates ─────────────────────────────────────────────

  const averageQuality = filteredAudits.length > 0
    ? (filteredAudits.reduce((s, i) => s + Number(i.quality_score), 0) / filteredAudits.length).toFixed(2)
    : '0.00';

  const totalCalls = filteredCalls.reduce((s, i) => s + Number(i.calls_count), 0);
  const totalTickets = filteredTickets.reduce((s, i) => s + Number(i.tickets_count), 0);
  const totalSales = filteredSales.reduce((s, i) => s + Number(i.amount), 0);
  const openRequests = filteredRequests.filter((i) => i.status !== 'Closed').length;
  const closedRequests = filteredRequests.filter((i) => i.status === 'Closed').length;
  const openFeedback = filteredFeedback.filter((i) => i.status !== 'Closed').length;
  const closedFeedback = filteredFeedback.filter((i) => i.status === 'Closed').length;

  const callsAudits = filteredAudits.filter((i) => i.team === 'Calls');
  const ticketsAudits = filteredAudits.filter((i) => i.team === 'Tickets');
  const salesAudits = filteredAudits.filter((i) => i.team === 'Sales');

  const teamAvg = (arr: AuditItem[]) =>
    arr.length > 0 ? (arr.reduce((s, i) => s + Number(i.quality_score), 0) / arr.length).toFixed(2) : '0.00';

  const callsAverage = teamAvg(callsAudits);
  const ticketsAverage = teamAvg(ticketsAudits);
  const salesAverage = teamAvg(salesAudits);

  const selectedAgentFeedbackByType = useMemo(() => {
    const grouped = new Map<string, number>();
    filteredFeedback.forEach((item) => grouped.set(item.feedback_type, (grouped.get(item.feedback_type) || 0) + 1));
    return Array.from(grouped.entries()).map(([type, count]) => ({ type, count }));
  }, [filteredFeedback]);

  const trendTeamFilter = selectedAgent?.team || teamFilter || '';
  const trendTeamAudits = useMemo(() =>
    audits.filter((item) => (trendTeamFilter ? item.team === trendTeamFilter : true) && matchesDate(item.audit_date)),
    [audits, trendTeamFilter, dateFrom, dateTo]
  );

  // ── CSV Exports (unchanged logic) ─────────────────────────

  function escapeCsvValue(value: unknown) {
    const str = value == null ? '' : String(value);
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
  }

  function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
    if (rows.length === 0) { alert('No data to export.'); return; }
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escapeCsvValue(r[h])).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const exportFns = {
    summary: () => downloadCsv('reports_summary.csv', [{
      date_from: dateFrom || 'All', date_to: dateTo || 'All', team_filter: teamFilter || 'All',
      selected_agent: selectedAgents.length > 0 ? selectedAgents.map(getAgentLabel).join(' | ') : 'All Agents',
      total_audits: filteredAudits.length, average_quality: averageQuality,
      total_calls: totalCalls, total_tickets: totalTickets, total_sales: totalSales.toFixed(2),
      open_supervisor_requests: openRequests, closed_supervisor_requests: closedRequests,
      open_agent_feedback: openFeedback, closed_agent_feedback: closedFeedback,
      calls_avg_quality: callsAverage, tickets_avg_quality: ticketsAverage, sales_avg_quality: salesAverage,
    }]),
    audits: () => downloadCsv('audits_report.csv', filteredAudits.map((i) => ({
      id: i.id, agent_id: i.agent_id, agent_name: i.agent_name,
      display_name: getDisplayName(i.agent_id, i.agent_name, i.team) || '',
      team: i.team, case_type: i.case_type, audit_date: i.audit_date,
      order_number: i.order_number || '', phone_number: i.phone_number || '',
      ticket_id: i.ticket_id || '', quality_score: Number(i.quality_score).toFixed(2), comments: i.comments || '',
    }))),
    calls: () => downloadCsv('calls_report.csv', filteredCalls.map((i) => ({ id: i.id, agent_id: i.agent_id, agent_name: i.agent_name, calls_count: i.calls_count, call_date: i.call_date, notes: i.notes || '' }))),
    tickets: () => downloadCsv('tickets_report.csv', filteredTickets.map((i) => ({ id: i.id, agent_id: i.agent_id, agent_name: i.agent_name, tickets_count: i.tickets_count, ticket_date: i.ticket_date, notes: i.notes || '' }))),
    sales: () => downloadCsv('sales_report.csv', filteredSales.map((i) => ({ id: i.id, agent_id: i.agent_id, agent_name: i.agent_name, amount: Number(i.amount).toFixed(2), sale_date: i.sale_date, notes: i.notes || '' }))),
    requests: () => downloadCsv('supervisor_requests_report.csv', filteredRequests.map((i) => ({
      id: i.id, case_reference: i.case_reference, team: i.team || '', priority: i.priority, status: i.status,
      created_at: i.created_at, agent_id: i.agent_id || '', agent_name: i.agent_name || '',
      display_name: getDisplayName(i.agent_id || null, i.agent_name || null, i.team || null) || '',
      case_type: i.case_type || '', supervisor_name: i.supervisor_name || '', request_note: i.request_note || '',
    }))),
    feedback: () => downloadCsv('agent_feedback_report.csv', filteredFeedback.map((i) => ({
      id: i.id, agent_id: i.agent_id || '', agent_name: i.agent_name,
      display_name: getDisplayName(i.agent_id || null, i.agent_name || null, i.team || null) || '',
      team: i.team, qa_name: i.qa_name || '', feedback_type: i.feedback_type, subject: i.subject,
      feedback_note: i.feedback_note || '', action_plan: i.action_plan || '', due_date: i.due_date || '',
      status: i.status, created_at: i.created_at,
    }))),
  };

  // ── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="rpt-page">
        <div className="rpt-loader-shell">
          <div className="rpt-loader-inner">
            <div className="rpt-loader-spinner" />
            <div className="rpt-loader-text">Loading reports…</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="rpt-page">

      {/* Page header */}
      <div className="rpt-page-header">
        <div className="rpt-eyebrow">Reporting</div>
        <h2 className="rpt-page-title">Reports</h2>
        <p className="rpt-page-sub">Filter by date, team, and agent to build detailed performance reports.</p>
      </div>

      {/* Filter panel */}
      <div
        className="rpt-filter-panel"
        style={{ zIndex: isAgentPickerOpen ? 1000 : 20 }}
      >
        <div className="rpt-filter-grid">
          <div>
            <label className="rpt-filter-label">Date From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rpt-field" />
          </div>
          <div>
            <label className="rpt-filter-label">Date To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rpt-field" />
          </div>
          <div>
            <label className="rpt-filter-label">Team</label>
            <select value={teamFilter} onChange={(e) => { setTeamFilter(e.target.value); clearAgentFilter(); }} className="rpt-field">
              <option value="">All Teams</option>
              <option value="Calls">Calls</option>
              <option value="Tickets">Tickets</option>
              <option value="Sales">Sales</option>
            </select>
          </div>

          {/* Agent row */}
          <div className="rpt-agent-row">
            <div className="rpt-agent-picker-wrap" ref={agentPickerRef}>
              <label className="rpt-filter-label">Agent Filter</label>
              <button
                type="button"
                className="rpt-picker-btn"
                onClick={() => setIsAgentPickerOpen((p) => !p)}
                aria-expanded={isAgentPickerOpen}
              >
                <span className="rpt-picker-btn-text" style={{ color: selectedAgent ? 'var(--fg-default)' : 'var(--fg-muted)' }}>
                  {selectedAgents.length === 0 ? 'Select agent…' : selectedAgents.length === 1 ? getAgentLabel(selectedAgents[0]) : `${selectedAgents.length} agents selected`}
                </span>
                <span className="rpt-picker-btn-arrow">▾</span>
              </button>

              {isAgentPickerOpen && (
                <div className="rpt-picker-menu">
                  <div className="rpt-picker-search-wrap">
                    <input
                      type="text"
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                      placeholder="Search by name, ID…"
                      className="rpt-field"
                      style={{ height: '32px' }}
                    />
                  </div>
                  <div className="rpt-picker-list">
                    {visibleAgentProfiles.length === 0 ? (
                      <div className="rpt-picker-empty">No agents found</div>
                    ) : (
                      visibleAgentProfiles.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          className={`rpt-picker-option${selectedAgentProfileIds.includes(profile.id) ? ' selected' : ''}`}
                          onClick={() => handleSelectAgent(profile)}
                        >
                          {selectedAgentProfileIds.includes(profile.id) ? '✓ ' : ''}{getAgentLabel(profile)}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {selectedAgents.length > 0 && (
              <div style={{ alignSelf: 'flex-end' }}>
                <button type="button" className="rpt-clear-btn" onClick={clearAgentFilter}>
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export bar */}
      <div className="rpt-export-bar">
        <span className="rpt-export-label">Export</span>
        <button className={`rpt-export-btn rpt-export-btn-primary`} onClick={exportFns.summary}>↓ Summary</button>
        <button className="rpt-export-btn" onClick={exportFns.audits}>Audits</button>
        <button className="rpt-export-btn" onClick={exportFns.calls}>Calls</button>
        <button className="rpt-export-btn" onClick={exportFns.tickets}>Tickets</button>
        <button className="rpt-export-btn" onClick={exportFns.sales}>Sales</button>
        <button className="rpt-export-btn" onClick={exportFns.requests}>Requests</button>
        <button className="rpt-export-btn" onClick={exportFns.feedback}>Feedback</button>
      </div>

      {/* Summary KPIs */}
      <Section title="Summary">
        <div className="rpt-kpi-grid">
          <KpiCard label="Total Audits" value={String(filteredAudits.length)} accent="var(--accent-blue)" delay={0} />
          <KpiCard label="Average Quality" value={`${averageQuality}%`} accent="var(--accent-emerald)" accentValue delay={40} />
          <KpiCard label="Total Calls" value={String(totalCalls)} accent="var(--accent-cyan)" delay={80} />
          <KpiCard label="Total Tickets" value={String(totalTickets)} accent="var(--accent-violet)" delay={120} />
          <KpiCard label="Total Sales" value={`$${totalSales.toFixed(2)}`} accent="var(--accent-emerald)" delay={160} />
          <KpiCard label="Open Requests" value={String(openRequests)} accent={openRequests > 0 ? 'var(--accent-amber)' : 'var(--fg-muted)'} delay={200} />
          <KpiCard label="Closed Requests" value={String(closedRequests)} accent="var(--accent-emerald)" delay={240} />
          <KpiCard label="Open Feedback" value={String(openFeedback)} accent={openFeedback > 0 ? 'var(--accent-rose)' : 'var(--fg-muted)'} delay={280} />
          <KpiCard label="Closed Feedback" value={String(closedFeedback)} accent="var(--accent-emerald)" delay={320} />
        </div>
      </Section>

      {/* Team breakdown */}
      <Section title="Team Breakdown">
        <div className="rpt-team-grid">
          {(['Calls', 'Tickets', 'Sales'] as const).map((team, i) => {
            const cfg = TEAM_CONFIG[team];
            const avg = team === 'Calls' ? callsAverage : team === 'Tickets' ? ticketsAverage : salesAverage;
            const count = team === 'Calls' ? callsAudits.length : team === 'Tickets' ? ticketsAudits.length : salesAudits.length;
            return (
              <div key={team} className="rpt-team-card" style={{ animationDelay: `${i * 60}ms`, borderLeft: `2px solid ${cfg.accent}` }}>
                <div className="rpt-team-badge" style={{ background: `color-mix(in srgb, ${cfg.accent} 12%, transparent)`, color: cfg.accent }}>
                  {cfg.label}
                </div>
                <div className="rpt-team-avg" style={{ color: cfg.accent }}>{avg}%</div>
                <div className="rpt-team-sub">{count} audit{count !== 1 ? 's' : ''} · Avg quality</div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Performance Trends */}
      <PerformanceTrendsSection
        audits={filteredAudits}
        allAudits={trendTeamAudits}
        selectedAgents={selectedAgents}
        effectiveTeamFilter={trendTeamFilter}
      />

      {/* Agent-specific report */}
      {selectedAgent && (
        <Section title={`Agent Report — ${getAgentLabel(selectedAgent)}`}>
          <div className="rpt-kpi-grid">
            <KpiCard label="Team" value={selectedAgent.team || '—'} accent="var(--accent-violet)" delay={0} />
            <KpiCard label="Audits" value={String(filteredAudits.length)} accent="var(--accent-blue)" delay={40} />
            <KpiCard label="Avg Quality" value={`${averageQuality}%`} accent="var(--accent-emerald)" accentValue delay={80} />
            {selectedAgent.team === 'Calls' && <KpiCard label="Total Calls" value={String(totalCalls)} accent="var(--accent-cyan)" delay={120} />}
            {selectedAgent.team === 'Tickets' && <KpiCard label="Total Tickets" value={String(totalTickets)} accent="var(--accent-violet)" delay={120} />}
            {selectedAgent.team === 'Sales' && <KpiCard label="Total Sales" value={`$${totalSales.toFixed(2)}`} accent="var(--accent-emerald)" delay={120} />}
            <KpiCard label="Feedback Items" value={String(filteredFeedback.length)} accent="var(--accent-amber)" delay={160} />
            <KpiCard label="Open Feedback" value={String(openFeedback)} accent={openFeedback > 0 ? 'var(--accent-rose)' : 'var(--fg-muted)'} delay={200} />
            <KpiCard label="Requests" value={String(filteredRequests.length)} accent="var(--accent-blue)" delay={240} />
          </div>

          <div className="rpt-detail-grid" style={{ marginTop: '14px' }}>
            <div className="rpt-detail-card">
              <div className="rpt-detail-card-label">Agent Details</div>
              {[
                ['Name', selectedAgent.agent_name],
                ['Display Name', selectedAgent.display_name || '—'],
                ['Agent ID', selectedAgent.agent_id || '—'],
                ['Team', selectedAgent.team || '—'],
              ].map(([k, v]) => (
                <div key={k} className="rpt-detail-field">
                  <span className="rpt-detail-field-key">{k}</span>
                  <span className="rpt-detail-field-val">{v}</span>
                </div>
              ))}
            </div>
            <div className="rpt-detail-card">
              <div className="rpt-detail-card-label">Feedback Breakdown</div>
              {selectedAgentFeedbackByType.length === 0 ? (
                <p style={{ fontSize: '12px', color: 'var(--fg-muted)' }}>No feedback items.</p>
              ) : (
                selectedAgentFeedbackByType.map(({ type, count }) => (
                  <div key={type} className="rpt-detail-field">
                    <span className="rpt-detail-field-key">{type}</span>
                    <span className="rpt-detail-field-val" style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 800 }}>{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Recent Audits */}
      <Section title="Recent Audits" count={filteredAudits.length}>
        {filteredAudits.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '13px' }}>No audits in this range.</div>
        ) : (
          <div className="rpt-table-wrap">
            <div className="rpt-table-head-row" style={{ gridTemplateColumns: '1fr 1.3fr 1fr 1.7fr 0.7fr' }}>
              <div className="rpt-table-head-cell">Date</div>
              <div className="rpt-table-head-cell">Agent</div>
              <div className="rpt-table-head-cell">Case Type</div>
              <div className="rpt-table-head-cell">Reference</div>
              <div className="rpt-table-head-cell">Score</div>
            </div>
            {filteredAudits.map((item) => (
              <div key={item.id} className="rpt-table-body-row" style={{ gridTemplateColumns: '1fr 1.3fr 1fr 1.7fr 0.7fr' }}>
                <div className="rpt-table-cell">
                  <div className="rpt-cell-primary">{item.audit_date}</div>
                  <div className="rpt-cell-secondary">{item.team}</div>
                </div>
                <div className="rpt-table-cell">
                  <div className="rpt-cell-primary">{item.agent_name}</div>
                  <div className="rpt-cell-secondary">{getDisplayName(item.agent_id, item.agent_name, item.team) || '—'}</div>
                </div>
                <div className="rpt-table-cell">
                  <div className="rpt-cell-primary">{item.case_type}</div>
                </div>
                <div className="rpt-table-cell">
                  <div className="rpt-cell-primary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.team === 'Tickets'
                      ? `Ticket: ${item.ticket_id || '—'}`
                      : `Order: ${item.order_number || '—'} · Phone: ${item.phone_number || '—'}`}
                  </div>
                </div>
                <div className="rpt-table-cell" style={{ display: 'flex', alignItems: 'center' }}>
                  <span className={`rpt-score-pill ${getScoreTierClass(Number(item.quality_score))}`}>
                    {Number(item.quality_score).toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Recent Supervisor Requests */}
      <Section title="Recent Supervisor Requests" count={filteredRequests.length}>
        {filteredRequests.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '13px' }}>No supervisor requests in this range.</div>
        ) : (
          <div className="rpt-table-wrap">
            <div className="rpt-table-head-row" style={{ gridTemplateColumns: '0.9fr 1.1fr 1.2fr 0.8fr 0.8fr' }}>
              <div className="rpt-table-head-cell">Created</div>
              <div className="rpt-table-head-cell">Case Ref</div>
              <div className="rpt-table-head-cell">Agent</div>
              <div className="rpt-table-head-cell">Priority</div>
              <div className="rpt-table-head-cell">Status</div>
            </div>
            {filteredRequests.map((item) => (
              <div key={item.id} className="rpt-table-body-row" style={{ gridTemplateColumns: '0.9fr 1.1fr 1.2fr 0.8fr 0.8fr' }}>
                <div className="rpt-table-cell">
                  <div className="rpt-cell-primary">{new Date(item.created_at).toLocaleDateString()}</div>
                  <div className="rpt-cell-secondary">{item.team || '—'}</div>
                </div>
                <div className="rpt-table-cell">
                  <div className="rpt-cell-primary">{item.case_reference}</div>
                  <div className="rpt-cell-secondary">{item.case_type || '—'}</div>
                </div>
                <div className="rpt-table-cell">
                  <div className="rpt-cell-primary">{item.agent_name || '—'}</div>
                  <div className="rpt-cell-secondary">{getDisplayName(item.agent_id || null, item.agent_name || null, item.team || null) || '—'}</div>
                </div>
                <div className="rpt-table-cell" style={{ display: 'flex', alignItems: 'center' }}>
                  <span className={getPriorityPillClass(item.priority)}>{item.priority}</span>
                </div>
                <div className="rpt-table-cell" style={{ display: 'flex', alignItems: 'center' }}>
                  <span className={getStatusPillClass(item.status)}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Recent Agent Feedback */}
      <Section title="Recent Agent Feedback" count={filteredFeedback.length}>
        {filteredFeedback.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '13px' }}>No feedback items in this range.</div>
        ) : (
          <div className="rpt-table-wrap">
            <div className="rpt-table-head-row" style={{ gridTemplateColumns: '0.9fr 1.2fr 0.9fr 1.5fr 0.8fr' }}>
              <div className="rpt-table-head-cell">Created</div>
              <div className="rpt-table-head-cell">Agent</div>
              <div className="rpt-table-head-cell">Type</div>
              <div className="rpt-table-head-cell">Subject</div>
              <div className="rpt-table-head-cell">Status</div>
            </div>
            {filteredFeedback.map((item) => (
              <div key={item.id} className="rpt-table-body-row" style={{ gridTemplateColumns: '0.9fr 1.2fr 0.9fr 1.5fr 0.8fr' }}>
                <div className="rpt-table-cell">
                  <div className="rpt-cell-primary">{new Date(item.created_at).toLocaleDateString()}</div>
                  <div className="rpt-cell-secondary">{item.team}</div>
                </div>
                <div className="rpt-table-cell">
                  <div className="rpt-cell-primary">{item.agent_name}</div>
                  <div className="rpt-cell-secondary">{getDisplayName(item.agent_id || null, item.agent_name || null, item.team || null) || '—'}</div>
                </div>
                <div className="rpt-table-cell" style={{ display: 'flex', alignItems: 'center' }}>
                  <span className={getFeedbackTypePillClass(item.feedback_type)}>{item.feedback_type}</span>
                </div>
                <div className="rpt-table-cell">
                  <div className="rpt-cell-primary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subject}</div>
                  <div className="rpt-cell-secondary">{item.qa_name || '—'}</div>
                </div>
                <div className="rpt-table-cell" style={{ display: 'flex', alignItems: 'center' }}>
                  <span className={getStatusPillClass(item.status)}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Business logic helpers (unchanged from original)
// ─────────────────────────────────────────────────────────────

function buildTrendPoints(subjectAudits: AuditItem[], teamAudits: AuditItem[], mode: PeriodMode): TrendPoint[] {
  const keys = new Set<string>();
  const subjectMap = new Map<string, number[]>();
  const teamMap = new Map<string, number[]>();
  const labels = new Map<string, { label: string; shortLabel: string }>();

  subjectAudits.forEach((audit) => {
    const meta = getPeriodMeta(audit.audit_date, mode);
    keys.add(meta.key);
    labels.set(meta.key, { label: meta.label, shortLabel: meta.shortLabel });
    const scores = subjectMap.get(meta.key) || [];
    scores.push(Number(audit.quality_score));
    subjectMap.set(meta.key, scores);
  });

  teamAudits.forEach((audit) => {
    const meta = getPeriodMeta(audit.audit_date, mode);
    keys.add(meta.key);
    labels.set(meta.key, { label: meta.label, shortLabel: meta.shortLabel });
    const scores = teamMap.get(meta.key) || [];
    scores.push(Number(audit.quality_score));
    teamMap.set(meta.key, scores);
  });

  return Array.from(keys).sort((a, b) => a.localeCompare(b)).map((key) => ({
    key,
    label: labels.get(key)?.label || key,
    shortLabel: labels.get(key)?.shortLabel || key,
    subjectAverage: roundScore(average(subjectMap.get(key) || [])),
    teamAverage: roundScore(average(teamMap.get(key) || [])),
    auditCount: (subjectMap.get(key) || []).length,
    teamAuditCount: (teamMap.get(key) || []).length,
  }));
}

function buildRecurringIssues(audits: AuditItem[]): RecurringIssue[] {
  const counts = new Map<string, { count: number; borderlineCount: number; failCount: number; autoFailCount: number }>();
  audits.forEach((audit) => {
    (audit.score_details || []).forEach((detail) => {
      if (!detail.metric || !ISSUE_RESULTS.has(String(detail.result || ''))) return;
      const cur = counts.get(detail.metric) || { count: 0, borderlineCount: 0, failCount: 0, autoFailCount: 0 };
      cur.count += 1;
      if (detail.result === 'Borderline') cur.borderlineCount += 1;
      if (detail.result === 'Fail') cur.failCount += 1;
      if (detail.result === 'Auto-Fail') cur.autoFailCount += 1;
      counts.set(detail.metric, cur);
    });
  });
  return Array.from(counts.entries())
    .map(([metric, v]) => ({ metric, ...v }))
    .sort((a, b) => b.count - a.count || b.autoFailCount - a.autoFailCount || b.failCount - a.failCount)
    .slice(0, 6);
}

function getProcedureIssueDetail(audit: AuditItem) {
  return (audit.score_details || []).find((d) => String(d.metric || '').trim() === 'Procedure' && ISSUE_RESULTS.has(String(d.result || ''))) || null;
}

function buildProcedureHotspots(audits: AuditItem[]): ProcedureHotspot[] {
  const counts = new Map<string, { count: number; borderlineCount: number; failCount: number; autoFailCount: number }>();
  audits.forEach((audit) => {
    const detail = getProcedureIssueDetail(audit);
    if (!detail) return;
    const caseType = String(audit.case_type || 'Unknown').trim() || 'Unknown';
    const cur = counts.get(caseType) || { count: 0, borderlineCount: 0, failCount: 0, autoFailCount: 0 };
    cur.count += 1;
    if (detail.result === 'Borderline') cur.borderlineCount += 1;
    if (detail.result === 'Fail') cur.failCount += 1;
    if (detail.result === 'Auto-Fail') cur.autoFailCount += 1;
    counts.set(caseType, cur);
  });
  return Array.from(counts.entries())
    .map(([caseType, v]) => ({ caseType, ...v }))
    .sort((a, b) => b.count - a.count || b.failCount - a.failCount || b.borderlineCount - a.borderlineCount);
}

function buildProcedureFlaggedCases(audits: AuditItem[]): ProcedureCaseItem[] {
  return audits
    .map((audit) => {
      const detail = getProcedureIssueDetail(audit);
      if (!detail) return null;
      return { id: audit.id, auditDate: audit.audit_date, agentName: audit.agent_name, team: audit.team, caseType: audit.case_type, qualityScore: Number(audit.quality_score), procedureResult: detail.result, metricComment: detail.metric_comment || null } satisfies ProcedureCaseItem;
    })
    .filter((i): i is ProcedureCaseItem => i !== null)
    .sort((a, b) => String(b.auditDate || '').localeCompare(String(a.auditDate || '')) || a.agentName.localeCompare(b.agentName));
}

function getPeriodMeta(dateValue: string, mode: PeriodMode) {
  return mode === 'weekly' ? formatWeekLabel(dateValue) : formatMonthLabel(dateValue);
}

function startOfWeek(dateValue: string) {
  const d = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon;
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatWeekLabel(dateValue: string) {
  const s = startOfWeek(dateValue);
  const e = new Date(s); e.setDate(s.getDate() + 6);
  return {
    key: formatIsoDate(s),
    label: `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    shortLabel: s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  };
}

function formatMonthLabel(dateValue: string) {
  const d = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  return {
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    label: first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    shortLabel: first.toLocaleDateString(undefined, { month: 'short' }),
  };
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function roundScore(v: number | null) {
  if (v == null || Number.isNaN(v)) return null;
  return Number(v.toFixed(2));
}

function sanitizeFilePart(v: string) {
  return String(v || 'trends').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'trends';
}

// ── Excel / ZIP export helpers (unchanged) ─────────────────

type ExcelCell = { value: string | number | null; type?: 'String' | 'Number'; styleId?: string };
type ExcelSheet = { name: string; columnWidths?: number[]; rows: ExcelCell[][] };

function escapeExcelXml(v: string) {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function makeExcelCell(value: string | number | null | undefined, styleId = 'Body', type?: 'String' | 'Number'): ExcelCell {
  if (value == null || value === '') return { value: '', styleId, type: 'String' };
  if (type) return { value, styleId, type };
  return typeof value === 'number' ? { value, styleId, type: 'Number' } : { value: String(value), styleId, type: 'String' };
}

function buildExcelWorkbookXml(sheets: ExcelSheet[]) {
  const stylesXml = `<Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1F2937"/></Style><Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Bold="1" ss:Size="16" ss:Color="#0F172A"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/></Style><Style ss:ID="Section"><Font ss:FontName="Calibri" ss:Bold="1" ss:Size="11" ss:Color="#1D4ED8"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style><Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0F172A" ss:Pattern="Solid"/></Style><Style ss:ID="Body"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders></Style><Style ss:ID="Number"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders><NumberFormat ss:Format="0.00"/></Style><Style ss:ID="Count"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders><NumberFormat ss:Format="0"/></Style><Style ss:ID="Good"><Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#166534"/><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/></Style><Style ss:ID="Warning"><Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#92400E"/><Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/></Style><Style ss:ID="Bad"><Font ss:FontName="Calibri" ss:Bold="1" ss:Color="#991B1B"/><Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/></Style></Styles>`;
  const worksheetsXml = sheets.map((sheet) => {
    const columnsXml = (sheet.columnWidths || []).map((w) => `<Column ss:AutoFitWidth="0" ss:Width="${w}"/>`).join('');
    const rowsXml = sheet.rows.map((row) => `<Row>${row.map((cell) => {
      const style = cell.styleId ? ` ss:StyleID="${cell.styleId}"` : '';
      const t = cell.type || (typeof cell.value === 'number' ? 'Number' : 'String');
      const v = cell.value == null ? '' : t === 'Number' ? String(cell.value) : escapeExcelXml(String(cell.value));
      return `<Cell${style}><Data ss:Type="${t}">${v}</Data></Cell>`;
    }).join('')}</Row>`).join('');
    return `<Worksheet ss:Name="${escapeExcelXml(sheet.name.slice(0, 31))}"><Table>${columnsXml}${rowsXml}</Table></Worksheet>`;
  }).join('');
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">${stylesXml}${worksheetsXml}</Workbook>`;
}

function getProcedureResultStyleId(result: string | null | undefined) {
  if (result === 'Borderline') return 'Warning';
  if (result === 'Fail' || result === 'Auto-Fail') return 'Bad';
  return 'Body';
}

function buildPerformanceTrendWorkbookXml(params: {
  subjectLabel: string; periodMode: PeriodMode; latestAverage: number | null; momentumDelta: number | null;
  teamGap: number | null; strongestIssue: string; procedureTotal: number; topProcedureCaseType: string;
  trendPoints: TrendPoint[]; recurringIssues: RecurringIssue[]; procedureHotspots: ProcedureHotspot[];
  procedureCases: ProcedureCaseItem[]; chartAssetName: string;
}) {
  const { subjectLabel, periodMode, latestAverage, momentumDelta, teamGap, strongestIssue, procedureTotal, topProcedureCaseType, trendPoints, recurringIssues, procedureHotspots, procedureCases, chartAssetName } = params;
  return buildExcelWorkbookXml([
    { name: 'Overview', columnWidths: [200, 200, 180, 180], rows: [
      [makeExcelCell('Performance Trends Export', 'Title')],
      [makeExcelCell('Generated', 'Section'), makeExcelCell(new Date().toLocaleString(), 'Body')],
      [makeExcelCell('Scope', 'Section'), makeExcelCell(subjectLabel, 'Body')],
      [makeExcelCell('Period Mode', 'Section'), makeExcelCell(periodMode === 'weekly' ? 'Weekly' : 'Monthly', 'Body')],
      [makeExcelCell('Current Average', 'Header'), makeExcelCell(latestAverage ?? '', latestAverage == null ? 'Body' : 'Number', latestAverage == null ? 'String' : 'Number')],
      [makeExcelCell('Momentum (pts)', 'Header'), makeExcelCell(momentumDelta ?? '', momentumDelta == null ? 'Body' : 'Number', momentumDelta == null ? 'String' : 'Number')],
      [makeExcelCell('Vs Team Average (pts)', 'Header'), makeExcelCell(teamGap ?? '', teamGap == null ? 'Body' : 'Number', teamGap == null ? 'String' : 'Number')],
      [makeExcelCell('Top Recurring Issue', 'Header'), makeExcelCell(strongestIssue, 'Body')],
      [makeExcelCell('Procedure Flagged Cases', 'Header'), makeExcelCell(procedureTotal, 'Count', 'Number')],
      [makeExcelCell('Top Procedure Case Type', 'Header'), makeExcelCell(topProcedureCaseType, 'Body')],
      [makeExcelCell('Chart Asset in ZIP', 'Header'), makeExcelCell(chartAssetName, 'Body')],
    ]},
    { name: 'Trend Breakdown', columnWidths: [130, 170, 130, 130, 120], rows: [
      [makeExcelCell('Period', 'Header'), makeExcelCell('Selected Scope Avg', 'Header'), makeExcelCell('Team Avg', 'Header'), makeExcelCell('Scoped Audits', 'Header'), makeExcelCell('Team Audits', 'Header')],
      ...trendPoints.map((p) => [makeExcelCell(p.label, 'Body'), makeExcelCell(p.subjectAverage ?? '', p.subjectAverage == null ? 'Body' : 'Number', p.subjectAverage == null ? 'String' : 'Number'), makeExcelCell(p.teamAverage ?? '', p.teamAverage == null ? 'Body' : 'Number', p.teamAverage == null ? 'String' : 'Number'), makeExcelCell(p.auditCount, 'Count', 'Number'), makeExcelCell(p.teamAuditCount, 'Count', 'Number')]),
    ]},
    { name: 'Recurring Issues', columnWidths: [180, 100, 100, 100, 100], rows: [
      [makeExcelCell('Metric', 'Header'), makeExcelCell('Total', 'Header'), makeExcelCell('Borderline', 'Header'), makeExcelCell('Fail', 'Header'), makeExcelCell('Auto-Fail', 'Header')],
      ...recurringIssues.map((i) => [makeExcelCell(i.metric, 'Body'), makeExcelCell(i.count, 'Count', 'Number'), makeExcelCell(i.borderlineCount, 'Count', 'Number'), makeExcelCell(i.failCount, 'Count', 'Number'), makeExcelCell(i.autoFailCount, 'Count', 'Number')]),
    ]},
    { name: 'Procedure Hotspots', columnWidths: [180, 100, 100, 100, 100], rows: [
      [makeExcelCell('Case Type', 'Header'), makeExcelCell('Total', 'Header'), makeExcelCell('Borderline', 'Header'), makeExcelCell('Fail', 'Header'), makeExcelCell('Auto-Fail', 'Header')],
      ...procedureHotspots.map((i) => [makeExcelCell(i.caseType, 'Body'), makeExcelCell(i.count, 'Count', 'Number'), makeExcelCell(i.borderlineCount, 'Count', 'Number'), makeExcelCell(i.failCount, 'Count', 'Number'), makeExcelCell(i.autoFailCount, 'Count', 'Number')]),
    ]},
    { name: 'Procedure Cases', columnWidths: [90, 140, 90, 140, 120, 110, 240], rows: [
      [makeExcelCell('Audit Date', 'Header'), makeExcelCell('Agent', 'Header'), makeExcelCell('Team', 'Header'), makeExcelCell('Case Type', 'Header'), makeExcelCell('Procedure Result', 'Header'), makeExcelCell('Quality Score', 'Header'), makeExcelCell('QA Note', 'Header')],
      ...procedureCases.map((i) => [makeExcelCell(i.auditDate, 'Body'), makeExcelCell(i.agentName, 'Body'), makeExcelCell(i.team, 'Body'), makeExcelCell(i.caseType, 'Body'), makeExcelCell(i.procedureResult, getProcedureResultStyleId(i.procedureResult)), makeExcelCell(i.qualityScore, 'Number', 'Number'), makeExcelCell(i.metricComment || '', 'Body')]),
    ]},
  ]);
}

function buildTrendChartSvg(points: TrendPoint[], subjectLabel: string, periodMode: PeriodMode) {
  const width = 1400, height = 460, chartLeft = 80, chartRight = 40, chartTop = 72, chartBottom = 94;
  const plotWidth = width - chartLeft - chartRight, plotHeight = height - chartTop - chartBottom;
  const subjectValues = points.map((p) => p.subjectAverage);
  const teamValues = points.map((p) => p.teamAverage);
  const allValues = [...subjectValues, ...teamValues].filter((v): v is number => v != null);
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : 100;
  const paddedMin = Math.max(0, Math.floor((minVal - 2) / 5) * 5);
  const paddedMax = Math.min(100, Math.ceil((maxVal + 2) / 5) * 5);
  const valueRange = Math.max(paddedMax - paddedMin, 1);
  const getPolyline = (values: Array<number | null>, stroke: string, strokeWidth: number) => {
    const pts = values.map((v, i) => v == null ? null : `${chartLeft + (i * plotWidth) / Math.max(values.length - 1, 1)},${chartTop + plotHeight - ((v - paddedMin) / valueRange) * plotHeight}`).filter(Boolean).join(' ');
    return pts ? `<polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round"/>` : '';
  };
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((s) => { const y = chartTop + plotHeight - s * plotHeight; const v = paddedMin + s * valueRange; return `<line x1="${chartLeft}" y1="${y}" x2="${width - chartRight}" y2="${y}" stroke="#D7DFEA" stroke-width="1"/><text x="${chartLeft - 12}" y="${y + 4}" font-size="12" text-anchor="end" fill="#64748B">${v.toFixed(0)}%</text>`; }).join('');
  const xLabels = points.map((p, i) => { const x = chartLeft + (i * plotWidth) / Math.max(points.length - 1, 1); return `<text x="${x}" y="${height - 36}" font-size="12" text-anchor="middle" fill="#64748B">${p.shortLabel}</text>`; }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect x="0" y="0" width="${width}" height="${height}" rx="24" fill="#FFFFFF"/><text x="36" y="38" font-size="24" font-weight="700" fill="#0F172A">Performance Trends</text><text x="36" y="60" font-size="13" fill="#64748B">${subjectLabel} • ${periodMode === 'weekly' ? 'Weekly' : 'Monthly'}</text>${gridLines}<line x1="${chartLeft}" y1="${chartTop + plotHeight}" x2="${width - chartRight}" y2="${chartTop + plotHeight}" stroke="#94A3B8" stroke-width="1.2"/>${getPolyline(teamValues, '#94A3B8', 4)}${getPolyline(subjectValues, '#2563EB', 5)}<circle cx="${chartLeft + 4}" cy="26" r="6" fill="#2563EB"/><text x="${chartLeft + 18}" y="30" font-size="13" fill="#334155">Selected Scope</text><circle cx="${chartLeft + 150}" cy="26" r="6" fill="#94A3B8"/><text x="${chartLeft + 164}" y="30" font-size="13" fill="#334155">Team Average</text>${xLabels}</svg>`;
}

function svgToPngBlob(svgMarkup: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8;' }));
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas context unavailable')); return; }
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => { URL.revokeObjectURL(url); blob ? resolve(blob) : reject(new Error('PNG creation failed')); }, 'image/png');
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load failed')); };
    img.src = url;
  });
}

function crc32(bytes: Uint8Array) {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) { crc ^= bytes[i]; for (let j = 0; j < 8; j++) { const mask = -(crc & 1); crc = (crc >>> 1) ^ (0xedb88320 & mask); } }
  return (crc ^ -1) >>> 0;
}

function toZipAB(bytes: Uint8Array) { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; }

function createZipBlob(entries: Array<{ name: string; data: Uint8Array }>) {
  const enc = new TextEncoder();
  const localParts: ArrayBuffer[] = [];
  const centralParts: ArrayBuffer[] = [];
  let offset = 0;
  entries.forEach((e) => {
    const nameBytes = enc.encode(e.name);
    const checksum = crc32(e.data);
    const lh = new Uint8Array(30 + nameBytes.length); const lv = new DataView(lh.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint32(14, checksum, true); lv.setUint32(18, e.data.length, true); lv.setUint32(22, e.data.length, true); lv.setUint16(26, nameBytes.length, true);
    lh.set(nameBytes, 30);
    localParts.push(toZipAB(lh), toZipAB(e.data));
    const ch = new Uint8Array(46 + nameBytes.length); const cv = new DataView(ch.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint32(16, checksum, true); cv.setUint32(20, e.data.length, true); cv.setUint32(24, e.data.length, true); cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);
    centralParts.push(toZipAB(ch));
    offset += lh.length + e.data.length;
  });
  const centralSize = centralParts.reduce((s, p) => s + p.byteLength, 0);
  const er = new Uint8Array(22); const ev = new DataView(er.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true); ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true);
  return new Blob([...localParts, ...centralParts, toZipAB(er)], { type: 'application/zip' });
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function downloadTrendExportPackage(params: { baseFilename: string; workbookXml: string; chartSvg: string; chartPngBlob: Blob }) {
  const { baseFilename, workbookXml, chartSvg, chartPngBlob } = params;
  const enc = new TextEncoder();
  const readme = `Performance Trends export\n\nWorkbook: ${baseFilename}.xls\nChart PNG: ${baseFilename}_chart.png\nChart SVG: ${baseFilename}_chart.svg`;
  const zip = createZipBlob([
    { name: `${baseFilename}.xls`, data: enc.encode(workbookXml) },
    { name: `${baseFilename}_chart.svg`, data: enc.encode(chartSvg) },
    { name: `${baseFilename}_chart.png`, data: new Uint8Array(await chartPngBlob.arrayBuffer()) },
    { name: `${baseFilename}_README.txt`, data: enc.encode(readme) },
  ]);
  downloadBlob(`${baseFilename}.zip`, zip);
}

export default ReportsSupabase;
