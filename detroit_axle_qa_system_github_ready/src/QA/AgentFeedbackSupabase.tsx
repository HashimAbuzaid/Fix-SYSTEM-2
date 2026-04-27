/**
 * AgentFeedbackSupabase.tsx — Detroit Axle QA System
 * ──────────────────────────────────────────────────────────────
 * Upgraded to App.tsx design language:
 *   • Consumes --bg-*, --fg-*, --accent-*, --border-* CSS vars
 *   • Scoped .cc-* CSS injected once via useEffect
 *   • Priority/status/outcome pills with semantic color tiers
 *   • Staggered entry animations (transform/opacity only — no layout jank)
 *   • Compact KPI bento row, refined coaching workspace grid
 *   • Review-stage progress stepper in expanded detail panel
 *   • Zero inline style objects that recompute on every render
 * ──────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────
// Types (unchanged)
// ─────────────────────────────────────────────────────────────

type TeamName = 'Calls' | 'Tickets' | 'Sales';
type FeedbackType = 'Coaching' | 'Audit Feedback' | 'Warning' | 'Follow-up';
type FeedbackStatus = 'Open' | 'In Progress' | 'Closed';
type PlanTab = 'All' | 'Open' | 'Overdue' | 'Awaiting Ack' | 'Follow-up';
type PlanPriority = 'Low' | 'Medium' | 'High' | 'Critical';
type FollowUpOutcome =
  | 'Not Set'
  | 'Improved'
  | 'Partial Improvement'
  | 'No Improvement'
  | 'Needs Escalation';
type ReviewStage =
  | 'QA Shared'
  | 'Acknowledged'
  | 'Agent Responded'
  | 'Supervisor Reviewed'
  | 'Follow-up'
  | 'Closed';

type CurrentUser = {
  id?: string;
  role?: 'admin' | 'qa' | 'agent' | 'supervisor';
  agent_id?: string | null;
  agent_name?: string;
  display_name?: string | null;
  team?: TeamName | null;
  email?: string;
} | null;

type AgentFeedback = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName;
  qa_name: string;
  feedback_type: FeedbackType;
  subject: string;
  feedback_note: string;
  action_plan: string | null;
  due_date: string | null;
  status: FeedbackStatus;
  created_at: string;
  acknowledged_by_agent?: boolean | null;
};

type AgentProfile = {
  id: string;
  role: 'agent';
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
};

type AuditItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName;
  case_type: string;
  audit_date: string;
  quality_score: number;
  comments: string | null;
  shared_with_agent?: boolean | null;
};

// ─────────────────────────────────────────────────────────────
// CSS Injection
// ─────────────────────────────────────────────────────────────

const CC_CSS_ID = 'da-coaching-v2';
const CC_CSS = `
  /* ── Animations ──────────────────────────────────────────── */
  @keyframes ccFadeUp  { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
  @keyframes ccScaleIn { from { opacity:0; transform:scale(0.97) }      to { opacity:1; transform:scale(1) } }
  @keyframes ccSlideIn { from { opacity:0; transform:translateX(-6px) } to { opacity:1; transform:translateX(0) } }

  /* ── Page shell ──────────────────────────────────────────── */
  .cc-page {
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    color: var(--fg-default);
    animation: ccFadeUp 220ms cubic-bezier(0.16,1,0.3,1) both;
  }

  /* ── Page header ─────────────────────────────────────────── */
  .cc-page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }
  .cc-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-blue);
    margin-bottom: 5px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cc-eyebrow::before {
    content: '';
    display: inline-block;
    width: 14px;
    height: 2px;
    background: var(--accent-blue);
    border-radius: 1px;
  }
  .cc-page-title {
    font-size: 26px;
    font-weight: 700;
    color: var(--fg-default);
    letter-spacing: -0.03em;
    margin: 0 0 5px;
  }
  .cc-page-sub {
    font-size: 13px;
    color: var(--fg-muted);
    margin: 0;
  }

  /* ── KPI grid ────────────────────────────────────────────── */
  .cc-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
  }
  .cc-kpi-card {
    position: relative;
    padding: 14px 16px;
    border-radius: 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    overflow: hidden;
    transition: border-color 140ms ease, box-shadow 140ms ease;
    animation: ccFadeUp 240ms cubic-bezier(0.16,1,0.3,1) both;
  }
  .cc-kpi-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-sm); }
  .cc-kpi-card::before {
    content: '';
    position: absolute;
    left: 0; top: 10px; bottom: 10px;
    width: 2px;
    border-radius: 0 2px 2px 0;
    background: var(--kpi-accent, var(--accent-blue));
  }
  .cc-kpi-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-muted);
    margin-bottom: 6px;
  }
  .cc-kpi-value {
    font-size: 22px;
    font-weight: 800;
    color: var(--fg-default);
    letter-spacing: -0.04em;
    line-height: 1;
    margin-bottom: 4px;
  }
  .cc-kpi-sub {
    font-size: 10px;
    color: var(--fg-muted);
    line-height: 1.4;
  }

  /* ── Alert banners ───────────────────────────────────────── */
  .cc-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 14px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 14px;
    animation: ccFadeUp 160ms ease both;
  }
  .cc-banner-error {
    background: color-mix(in srgb, var(--accent-rose) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent);
    color: var(--accent-rose);
  }
  .cc-banner-success {
    background: color-mix(in srgb, var(--accent-emerald) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-emerald) 25%, transparent);
    color: var(--accent-emerald);
  }

  /* ── Workspace grid ──────────────────────────────────────── */
  .cc-workspace-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(300px, 0.9fr);
    gap: 14px;
    margin-bottom: 14px;
  }
  @media (max-width: 960px) { .cc-workspace-grid { grid-template-columns: 1fr; } }
  .cc-stack-col { display: grid; gap: 14px; align-content: start; }

  /* ── Panel ───────────────────────────────────────────────── */
  .cc-panel {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 20px;
    animation: ccFadeUp 240ms cubic-bezier(0.16,1,0.3,1) both;
  }
  .cc-panel-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent-blue);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cc-panel-eyebrow::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
    max-width: 80px;
  }
  .cc-panel-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--fg-default);
    letter-spacing: -0.025em;
    margin: 0 0 4px;
  }
  .cc-panel-sub {
    font-size: 12px;
    color: var(--fg-muted);
    margin: 0 0 18px;
    line-height: 1.5;
  }

  /* ── Refresh btn ─────────────────────────────────────────── */
  .cc-refresh-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 12px;
    border-radius: 7px;
    border: 1px solid var(--border-strong);
    background: var(--bg-overlay);
    color: var(--fg-muted);
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
  }
  .cc-refresh-btn:hover { color: var(--fg-default); background: var(--bg-subtle-hover, rgba(255,255,255,0.06)); }

  /* ── Form ────────────────────────────────────────────────── */
  .cc-form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  @media (max-width: 680px) { .cc-form-grid { grid-template-columns: 1fr; } }
  .cc-full-col { grid-column: 1 / -1; }

  .cc-field-label {
    display: block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-muted);
    margin-bottom: 6px;
  }
  .cc-field {
    width: 100%;
    height: 36px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    background: var(--bg-overlay);
    color: var(--fg-default);
    font-size: 13px;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .cc-field:focus {
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-blue) 20%, transparent);
  }
  .cc-field-textarea {
    height: auto;
    padding: 10px 12px;
    resize: vertical;
    line-height: 1.5;
  }
  .cc-field-select { cursor: pointer; }

  /* ── Agent picker ────────────────────────────────────────── */
  .cc-picker-btn {
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
    transition: border-color 120ms ease;
    text-align: left;
  }
  .cc-picker-btn:hover { border-color: var(--accent-blue); }
  .cc-picker-btn-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .cc-picker-menu {
    position: absolute;
    top: calc(100% + 5px);
    left: 0; right: 0;
    background: var(--bg-overlay);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    box-shadow: var(--shadow-lg);
    z-index: 50;
    overflow: hidden;
    animation: ccScaleIn 130ms cubic-bezier(0.16,1,0.3,1) both;
  }
  .cc-picker-search { padding: 8px; border-bottom: 1px solid var(--border); }
  .cc-picker-list {
    max-height: 240px;
    overflow-y: auto;
    padding: 5px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cc-picker-option {
    padding: 7px 10px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: var(--fg-default);
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    transition: background 80ms ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
  .cc-picker-option:hover { background: var(--bg-subtle-hover, rgba(255,255,255,0.06)); }
  .cc-picker-option.active {
    background: color-mix(in srgb, var(--accent-blue) 12%, transparent);
    border-color: color-mix(in srgb, var(--accent-blue) 25%, transparent);
    color: var(--accent-blue);
  }
  .cc-picker-empty { padding: 14px; text-align: center; font-size: 12px; color: var(--fg-muted); }

  /* ── Agent snapshot card ─────────────────────────────────── */
  .cc-snapshot-card {
    background: var(--bg-overlay);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
  }
  .cc-snapshot-title {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent-blue);
    margin-bottom: 10px;
  }
  .cc-snapshot-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    border-bottom: 1px solid var(--border);
    gap: 8px;
  }
  .cc-snapshot-row:last-child { border-bottom: none; }
  .cc-snapshot-key { font-size: 11px; font-weight: 600; color: var(--fg-muted); flex-shrink: 0; }
  .cc-snapshot-val { font-size: 11px; font-weight: 600; color: var(--fg-default); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ── Context stat cards ──────────────────────────────────── */
  .cc-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
    margin-bottom: 14px;
  }
  .cc-stat-card {
    padding: 11px 13px;
    border-radius: 10px;
    background: var(--bg-overlay);
    border: 1px solid var(--border);
  }
  .cc-stat-label { font-size: 9px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fg-muted); margin-bottom: 4px; }
  .cc-stat-value { font-size: 18px; font-weight: 800; color: var(--fg-default); letter-spacing: -0.03em; margin-bottom: 2px; }
  .cc-stat-helper { font-size: 10px; color: var(--fg-muted); }

  /* ── Routing grid ────────────────────────────────────────── */
  .cc-routing-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 14px;
  }

  /* ── Audit filter row ────────────────────────────────────── */
  .cc-audit-filter-grid {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 10px;
    align-items: flex-end;
    margin-bottom: 12px;
  }
  @media (max-width: 580px) { .cc-audit-filter-grid { grid-template-columns: 1fr; } }

  /* ── Audit history list ──────────────────────────────────── */
  .cc-audit-list {
    display: grid;
    gap: 8px;
    max-height: 420px;
    overflow-y: auto;
    padding-right: 2px;
  }
  .cc-audit-card {
    padding: 13px 14px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--bg-overlay);
    transition: border-color 120ms ease, background 80ms ease;
    cursor: default;
  }
  .cc-audit-card:hover { border-color: var(--border-strong); }
  .cc-audit-card.active {
    border-color: color-mix(in srgb, var(--accent-blue) 40%, transparent);
    background: color-mix(in srgb, var(--accent-blue) 5%, transparent);
  }
  .cc-audit-top-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .cc-audit-case-type { font-size: 13px; font-weight: 700; color: var(--fg-default); letter-spacing: -0.01em; }
  .cc-audit-meta { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }
  .cc-audit-score { font-size: 20px; font-weight: 800; letter-spacing: -0.04em; color: var(--fg-default); text-align: right; }
  .cc-audit-comment {
    font-size: 12px;
    color: var(--fg-muted);
    line-height: 1.55;
    white-space: pre-wrap;
    margin-bottom: 10px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .cc-audit-action-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .cc-source-badge {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-blue) 25%, transparent);
    color: var(--accent-blue);
  }

  /* ── Filter bar (saved plans) ────────────────────────────── */
  .cc-filter-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 14px;
  }
  @media (max-width: 640px) { .cc-filter-grid { grid-template-columns: 1fr; } }

  /* ── Buttons ─────────────────────────────────────────────── */
  .cc-btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 34px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid color-mix(in srgb, var(--accent-blue) 30%, transparent);
    background: linear-gradient(135deg, var(--accent-blue) 0%, #1d4ed8 100%);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 120ms ease;
  }
  .cc-btn-primary:hover { opacity: 0.9; }
  .cc-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .cc-btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 34px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid var(--border-strong);
    background: var(--bg-overlay);
    color: var(--fg-muted);
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    white-space: nowrap;
    transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
  }
  .cc-btn-secondary:hover { color: var(--fg-default); border-color: var(--border-strong); }
  .cc-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
  .cc-btn-danger {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 10px;
    border-radius: 7px;
    border: 1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent);
    background: color-mix(in srgb, var(--accent-rose) 8%, transparent);
    color: var(--accent-rose);
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }
  .cc-btn-danger:hover, .cc-btn-danger.confirm {
    background: color-mix(in srgb, var(--accent-rose) 14%, transparent);
    border-color: color-mix(in srgb, var(--accent-rose) 40%, transparent);
  }
  .cc-btn-ghost {
    display: inline-flex;
    align-items: center;
    height: 30px;
    padding: 0 10px;
    border-radius: 7px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--fg-muted);
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
  }
  .cc-btn-ghost:hover { color: var(--fg-default); background: var(--bg-subtle-hover, rgba(255,255,255,0.06)); }
  .cc-btn-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 14px; }

  /* ── Plan tabs ───────────────────────────────────────────── */
  .cc-tab-row { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 14px; }
  .cc-tab-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--fg-muted);
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    transition: all 100ms ease;
  }
  .cc-tab-btn:hover { color: var(--fg-default); background: var(--bg-subtle-hover, rgba(255,255,255,0.06)); }
  .cc-tab-btn.active {
    color: var(--accent-blue);
    background: color-mix(in srgb, var(--accent-blue) 10%, transparent);
    border-color: color-mix(in srgb, var(--accent-blue) 22%, transparent);
  }
  .cc-tab-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: var(--bg-subtle);
    font-size: 9px;
    font-weight: 800;
    color: var(--fg-muted);
  }
  .cc-tab-btn.active .cc-tab-count {
    background: color-mix(in srgb, var(--accent-blue) 18%, transparent);
    color: var(--accent-blue);
  }

  /* ── Plans table ─────────────────────────────────────────── */
  .cc-plans-table-wrap {
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg-elevated);
  }
  .cc-plans-head {
    display: grid;
    grid-template-columns: 2fr 1fr 1.6fr 0.9fr 1fr 1fr 1.2fr;
    gap: 10px;
    padding: 0 14px;
    height: 32px;
    align-items: center;
    background: var(--bg-overlay);
    border-bottom: 1px solid var(--border);
  }
  .cc-plans-head-cell {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cc-plans-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1.6fr 0.9fr 1fr 1fr 1.2fr;
    gap: 10px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
    align-items: start;
    transition: background 80ms ease;
  }
  .cc-plans-row:last-child { border-bottom: none; }
  .cc-plans-row:hover { background: var(--bg-subtle-hover, rgba(255,255,255,0.03)); }
  .cc-cell-primary {
    font-size: 12px;
    font-weight: 600;
    color: var(--fg-default);
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cc-cell-secondary {
    font-size: 10px;
    color: var(--fg-muted);
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cc-cell-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }

  /* ── Mini select ─────────────────────────────────────────── */
  .cc-mini-select {
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border-radius: 6px;
    border: 1px solid var(--border-strong);
    background: var(--bg-overlay);
    color: var(--fg-default);
    font-size: 11px;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    outline: none;
  }

  /* ── Expanded panel ──────────────────────────────────────── */
  .cc-expanded-wrap {
    background: var(--bg-overlay);
    border-top: 1px solid var(--border);
    padding: 16px 14px;
    display: grid;
    gap: 12px;
    animation: ccFadeUp 180ms cubic-bezier(0.16,1,0.3,1) both;
  }
  .cc-expanded-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
  }
  .cc-detail-block {
    padding: 12px 13px;
    border-radius: 9px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
  }
  .cc-detail-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-blue);
    margin-bottom: 6px;
  }
  .cc-detail-value {
    font-size: 12px;
    color: var(--fg-default);
    line-height: 1.55;
    white-space: pre-wrap;
  }
  .cc-detail-mini-val { font-size: 12px; font-weight: 600; color: var(--fg-default); margin-top: 3px; }

  /* ── Cycle editor ────────────────────────────────────────── */
  .cc-cycle-editor {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px;
  }
  .cc-cycle-editor-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-muted);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cc-cycle-editor-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .cc-cycle-editor-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  @media (max-width: 600px) { .cc-cycle-editor-grid { grid-template-columns: 1fr; } }
  .cc-cycle-editor-wide { grid-column: 1 / -1; }

  /* ── Review stage stepper ────────────────────────────────── */
  .cc-stage-stepper {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .cc-stage-step {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    color: var(--fg-subtle);
  }
  .cc-stage-step.done { color: var(--accent-emerald); }
  .cc-stage-step.current { color: var(--accent-blue); font-weight: 700; }
  .cc-stage-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--fg-subtle);
    flex-shrink: 0;
  }
  .cc-stage-step.done .cc-stage-dot { background: var(--accent-emerald); }
  .cc-stage-step.current .cc-stage-dot { background: var(--accent-blue); box-shadow: 0 0 4px color-mix(in srgb, var(--accent-blue) 50%, transparent); }
  .cc-stage-arrow { color: var(--fg-subtle); font-size: 9px; }

  /* ── Pills ───────────────────────────────────────────────── */
  .cc-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    padding: 0 7px;
    border-radius: 5px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
  }
  /* Type pills */
  .cc-pill-coaching { background: color-mix(in srgb, var(--accent-emerald) 12%, transparent); border: 1px solid color-mix(in srgb, var(--accent-emerald) 28%, transparent); color: var(--accent-emerald); }
  .cc-pill-warning  { background: color-mix(in srgb, var(--accent-rose) 12%, transparent);    border: 1px solid color-mix(in srgb, var(--accent-rose) 28%, transparent);    color: var(--accent-rose); }
  .cc-pill-audit    { background: color-mix(in srgb, var(--accent-violet) 12%, transparent);  border: 1px solid color-mix(in srgb, var(--accent-violet) 28%, transparent);  color: var(--accent-violet); }
  .cc-pill-followup { background: color-mix(in srgb, var(--accent-amber) 12%, transparent);   border: 1px solid color-mix(in srgb, var(--accent-amber) 28%, transparent);   color: var(--accent-amber); }
  /* Priority pills */
  .cc-pill-critical { background: color-mix(in srgb, var(--accent-rose) 14%, transparent);   border: 1px solid color-mix(in srgb, var(--accent-rose) 30%, transparent);   color: var(--accent-rose); }
  .cc-pill-high     { background: color-mix(in srgb, var(--accent-amber) 12%, transparent);   border: 1px solid color-mix(in srgb, var(--accent-amber) 28%, transparent);  color: var(--accent-amber); }
  .cc-pill-medium   { background: color-mix(in srgb, var(--accent-blue) 10%, transparent);    border: 1px solid color-mix(in srgb, var(--accent-blue) 22%, transparent);   color: var(--accent-blue); }
  .cc-pill-low      { background: var(--bg-subtle); border: 1px solid var(--border); color: var(--fg-muted); }
  /* Status pills */
  .cc-pill-open     { background: color-mix(in srgb, var(--accent-amber) 12%, transparent);   border: 1px solid color-mix(in srgb, var(--accent-amber) 28%, transparent);  color: var(--accent-amber); }
  .cc-pill-progress { background: color-mix(in srgb, var(--accent-violet) 12%, transparent);  border: 1px solid color-mix(in srgb, var(--accent-violet) 28%, transparent); color: var(--accent-violet); }
  .cc-pill-closed   { background: color-mix(in srgb, var(--accent-emerald) 10%, transparent); border: 1px solid color-mix(in srgb, var(--accent-emerald) 25%, transparent);color: var(--accent-emerald); }
  /* Outcome pills */
  .cc-pill-improved  { background: color-mix(in srgb, var(--accent-emerald) 10%, transparent); border: 1px solid color-mix(in srgb, var(--accent-emerald) 25%, transparent); color: var(--accent-emerald); }
  .cc-pill-partial   { background: color-mix(in srgb, var(--accent-amber) 10%, transparent);   border: 1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent);   color: var(--accent-amber); }
  .cc-pill-none      { background: color-mix(in srgb, var(--accent-rose) 10%, transparent);    border: 1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent);    color: var(--accent-rose); }
  .cc-pill-escalate  { background: color-mix(in srgb, var(--accent-rose) 14%, transparent);    border: 1px solid color-mix(in srgb, var(--accent-rose) 30%, transparent);    color: var(--accent-rose); }
  .cc-pill-notset    { background: var(--bg-subtle); border: 1px solid var(--border); color: var(--fg-muted); }
  /* Stage pills */
  .cc-pill-shared    { background: var(--bg-subtle); border: 1px solid var(--border); color: var(--fg-muted); }
  .cc-pill-acknowledged { background: color-mix(in srgb, var(--accent-blue) 10%, transparent); border: 1px solid color-mix(in srgb, var(--accent-blue) 22%, transparent); color: var(--accent-blue); }
  .cc-pill-responded { background: color-mix(in srgb, var(--accent-cyan) 10%, transparent);    border: 1px solid color-mix(in srgb, var(--accent-cyan) 22%, transparent);    color: var(--accent-cyan); }
  .cc-pill-reviewed  { background: color-mix(in srgb, var(--accent-amber) 10%, transparent);   border: 1px solid color-mix(in srgb, var(--accent-amber) 22%, transparent);   color: var(--accent-amber); }
  .cc-pill-followup-stage { background: color-mix(in srgb, var(--accent-violet) 10%, transparent); border: 1px solid color-mix(in srgb, var(--accent-violet) 22%, transparent); color: var(--accent-violet); }
  /* Ack button */
  .cc-ack-btn {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 9px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    cursor: pointer;
    transition: background 120ms ease;
    margin-bottom: 3px;
  }
  .cc-ack-btn.yes {
    background: color-mix(in srgb, var(--accent-emerald) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-emerald) 25%, transparent);
    color: var(--accent-emerald);
  }
  .cc-ack-btn.yes:hover { background: color-mix(in srgb, var(--accent-emerald) 16%, transparent); }
  .cc-ack-btn.no {
    background: var(--bg-subtle);
    border: 1px solid var(--border);
    color: var(--fg-muted);
  }
  .cc-ack-btn.no:hover { color: var(--fg-default); border-color: var(--border-strong); }

  /* ── Overdue badge ───────────────────────────────────────── */
  .cc-overdue { color: var(--accent-rose); font-size: 10px; font-weight: 700; }
  .cc-due-ok { color: var(--fg-muted); font-size: 10px; }

  /* ── Badge pill stack ────────────────────────────────────── */
  .cc-pill-stack { display: flex; gap: 4px; flex-wrap: wrap; }

  /* ── Empty state ─────────────────────────────────────────── */
  .cc-empty {
    padding: 28px 20px;
    text-align: center;
    font-size: 13px;
    color: var(--fg-muted);
    background: var(--bg-overlay);
    border-radius: 10px;
    border: 1px solid var(--border);
    margin-top: 4px;
  }

  /* ── Loader ──────────────────────────────────────────────── */
  .cc-loader { display: flex; align-items: center; justify-content: center; padding: 48px; gap: 10px; }
  .cc-spinner {
    width: 28px; height: 28px;
    border-radius: 50%;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent-blue);
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .cc-spinner-text { font-size: 12px; font-weight: 500; color: var(--fg-muted); }

  /* ── Section divider ─────────────────────────────────────── */
  .cc-section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .cc-section-title { font-size: 14px; font-weight: 700; color: var(--fg-default); letter-spacing: -0.02em; margin: 0; }
  .cc-section-count {
    font-size: 10px; font-weight: 600; color: var(--fg-muted);
    background: var(--bg-subtle); border: 1px solid var(--border);
    border-radius: 999px; padding: 1px 7px;
  }
  .cc-section-divider { flex: 1; height: 1px; background: var(--border); }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .cc-page, .cc-panel, .cc-kpi-card, .cc-picker-menu, .cc-expanded-wrap {
      animation: none !important;
    }
  }
`;

function useCCStyles() {
  useEffect(() => {
    if (document.getElementById(CC_CSS_ID)) return;
    const el = document.createElement('style');
    el.id = CC_CSS_ID;
    el.textContent = CC_CSS;
    document.head.appendChild(el);
    return () => { document.getElementById(CC_CSS_ID)?.remove(); };
  }, []);
}

// ─────────────────────────────────────────────────────────────
// Pill helpers
// ─────────────────────────────────────────────────────────────

function typePillClass(t: FeedbackType) {
  if (t === 'Warning') return 'cc-pill cc-pill-warning';
  if (t === 'Audit Feedback') return 'cc-pill cc-pill-audit';
  if (t === 'Follow-up') return 'cc-pill cc-pill-followup';
  return 'cc-pill cc-pill-coaching';
}

function priorityPillClass(p: PlanPriority) {
  if (p === 'Critical') return 'cc-pill cc-pill-critical';
  if (p === 'High') return 'cc-pill cc-pill-high';
  if (p === 'Low') return 'cc-pill cc-pill-low';
  return 'cc-pill cc-pill-medium';
}


function outcomePillClass(o: FollowUpOutcome) {
  if (o === 'Improved') return 'cc-pill cc-pill-improved';
  if (o === 'Partial Improvement') return 'cc-pill cc-pill-partial';
  if (o === 'No Improvement') return 'cc-pill cc-pill-none';
  if (o === 'Needs Escalation') return 'cc-pill cc-pill-escalate';
  return 'cc-pill cc-pill-notset';
}

function stagePillClass(s: ReviewStage) {
  if (s === 'Acknowledged') return 'cc-pill cc-pill-acknowledged';
  if (s === 'Agent Responded') return 'cc-pill cc-pill-responded';
  if (s === 'Supervisor Reviewed') return 'cc-pill cc-pill-reviewed';
  if (s === 'Follow-up') return 'cc-pill cc-pill-followup-stage';
  if (s === 'Closed') return 'cc-pill cc-pill-closed';
  return 'cc-pill cc-pill-shared';
}

// ─────────────────────────────────────────────────────────────
// Business logic helpers (unchanged)
// ─────────────────────────────────────────────────────────────

const STRUCTURED_PLAN_SECTION_LABELS = [
  'Priority', 'Review Stage', 'Action Plan', 'Justification',
  'Agent Comment', 'Supervisor Review', 'Follow-up Outcome', 'Resolution Note',
] as const;

function escapeRegex(v: string) { return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normalizePriority(v?: string | null): PlanPriority { return (v === 'Low' || v === 'Medium' || v === 'High' || v === 'Critical') ? v : 'Medium'; }
function normalizeFollowUpOutcome(v?: string | null): FollowUpOutcome { return (v === 'Improved' || v === 'Partial Improvement' || v === 'No Improvement' || v === 'Needs Escalation') ? v : 'Not Set'; }
function normalizeReviewStage(v?: string | null): ReviewStage { return (v === 'QA Shared' || v === 'Acknowledged' || v === 'Agent Responded' || v === 'Supervisor Reviewed' || v === 'Follow-up' || v === 'Closed') ? v : 'QA Shared'; }
function normalizeAgentId(v?: string | null) { return String(v || '').trim().replace(/\.0+$/, ''); }
function normalizeAgentName(v?: string | null) { return String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function getCurrentDateValue() { return new Date().toISOString().slice(0, 10); }

function daysUntil(dateValue?: string | null) {
  const raw = String(dateValue || '').slice(0, 10);
  if (!raw) return null;
  const base = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const today = new Date(`${getCurrentDateValue()}T00:00:00`);
  return Math.floor((base.getTime() - today.getTime()) / 86400000);
}

function formatDateOnly(v?: string | null) {
  if (!v) return '—';
  const raw = String(v).slice(0, 10);
  const d = new Date(`${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString();
}

function formatDateTime(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function parseStructuredPlan(value?: string | null) {
  const raw = String(value || '').trim();
  const labelsPattern = STRUCTURED_PLAN_SECTION_LABELS.map(escapeRegex).join('|');
  function readSection(label: (typeof STRUCTURED_PLAN_SECTION_LABELS)[number]) {
    const regex = new RegExp(`${escapeRegex(label)}:\n([\\s\\S]*?)(?=\\n(?:${labelsPattern}):\n|$)`);
    const match = raw.match(regex);
    return match ? match[1].trim() : '';
  }
  const hasStructured = STRUCTURED_PLAN_SECTION_LABELS.some((l) => raw.includes(`${l}:`));
  return {
    priority: normalizePriority(readSection('Priority')),
    reviewStage: normalizeReviewStage(readSection('Review Stage')),
    actionPlan: hasStructured ? readSection('Action Plan') : raw,
    justification: readSection('Justification'),
    agentComment: readSection('Agent Comment'),
    supervisorReview: readSection('Supervisor Review'),
    followUpOutcome: normalizeFollowUpOutcome(readSection('Follow-up Outcome')),
    resolutionNote: readSection('Resolution Note'),
  };
}

function composeStructuredPlan(fields: {
  priority: PlanPriority; reviewStage: ReviewStage; actionPlan: string; justification: string;
  agentComment: string; supervisorReview: string; followUpOutcome: FollowUpOutcome; resolutionNote: string;
}) {
  return [
    `Priority:\n${fields.priority}`,
    `Review Stage:\n${fields.reviewStage}`,
    fields.actionPlan.trim() ? `Action Plan:\n${fields.actionPlan.trim()}` : '',
    fields.justification.trim() ? `Justification:\n${fields.justification.trim()}` : '',
    fields.agentComment.trim() ? `Agent Comment:\n${fields.agentComment.trim()}` : '',
    fields.supervisorReview.trim() ? `Supervisor Review:\n${fields.supervisorReview.trim()}` : '',
    fields.followUpOutcome !== 'Not Set' ? `Follow-up Outcome:\n${fields.followUpOutcome}` : '',
    fields.resolutionNote.trim() ? `Resolution Note:\n${fields.resolutionNote.trim()}` : '',
  ].filter(Boolean).join('\n\n').trim();
}

function isFeedbackOverdue(item: Pick<AgentFeedback, 'due_date' | 'status'>) {
  const diff = daysUntil(item.due_date);
  return diff !== null && diff < 0 && item.status !== 'Closed';
}

function matchesPlanTab(item: AgentFeedback, tab: PlanTab) {
  const parsed = parseStructuredPlan(item.action_plan);
  if (tab === 'All') return true;
  if (tab === 'Open') return item.status !== 'Closed';
  if (tab === 'Overdue') return isFeedbackOverdue(item);
  if (tab === 'Awaiting Ack') return item.status !== 'Closed' && !item.acknowledged_by_agent;
  if (tab === 'Follow-up') return item.status !== 'Closed' && (item.feedback_type === 'Follow-up' || parsed.reviewStage === 'Follow-up');
  return true;
}

// ─────────────────────────────────────────────────────────────
// Review stage stepper
// ─────────────────────────────────────────────────────────────

const STAGE_ORDER: ReviewStage[] = ['QA Shared', 'Acknowledged', 'Agent Responded', 'Supervisor Reviewed', 'Follow-up', 'Closed'];

function ReviewStageStepper({ current }: { current: ReviewStage }) {
  const currentIdx = STAGE_ORDER.indexOf(current);
  return (
    <div className="cc-stage-stepper">
      {STAGE_ORDER.map((stage, idx) => {
        const isDone = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const label = stage === 'Supervisor Reviewed' ? 'Sup. Reviewed' : stage;
        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div className={`cc-stage-step${isDone ? ' done' : isCurrent ? ' current' : ''}`}>
              <div className="cc-stage-dot" />
              <span style={{ fontSize: '9px', fontWeight: isCurrent ? 700 : 600 }}>{label}</span>
            </div>
            {idx < STAGE_ORDER.length - 1 && <span className="cc-stage-arrow">›</span>}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

function CoachingCenter({ currentUser = null }: { currentUser?: CurrentUser }) {
  useCCStyles();

  const [feedbackItems, setFeedbackItems] = useState<AgentFeedback[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [savedAgentFilter, setSavedAgentFilter] = useState('');
  const [savedStatusFilter, setSavedStatusFilter] = useState<'All' | FeedbackStatus>('All');
  const [savedTypeFilter, setSavedTypeFilter] = useState<'All' | FeedbackType>('All');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

  const [selectedAgentProfileId, setSelectedAgentProfileId] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [qaName, setQaName] = useState(currentUser?.agent_name || '');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('Coaching');
  const [subject, setSubject] = useState('');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [justification, setJustification] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [statusOnCreate, setStatusOnCreate] = useState<FeedbackStatus>('Open');
  const [priorityOnCreate, setPriorityOnCreate] = useState<PlanPriority>('Medium');
  const [activePlanTab, setActivePlanTab] = useState<PlanTab>('All');
  const [planOutcomeDrafts, setPlanOutcomeDrafts] = useState<Record<string, FollowUpOutcome>>({});
  const [resolutionNoteDrafts, setResolutionNoteDrafts] = useState<Record<string, string>>({});
  const [reviewStageDrafts, setReviewStageDrafts] = useState<Record<string, ReviewStage>>({});
  const [agentCommentDrafts, setAgentCommentDrafts] = useState<Record<string, string>>({});
  const [supervisorReviewDrafts, setSupervisorReviewDrafts] = useState<Record<string, string>>({});
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [selectedAuditId, setSelectedAuditId] = useState('');

  const agentPickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { void loadAll(); }, []);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (agentPickerRef.current && !agentPickerRef.current.contains(e.target as Node)) {
        setIsAgentPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  async function loadAll() {
    setLoading(true);
    setErrorMessage('');
    const [feedbackResult, profilesResult, auditsResult] = await Promise.all([
      supabase.from('agent_feedback').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, role, agent_id, agent_name, display_name, team').eq('role', 'agent').order('agent_name', { ascending: true }),
      supabase.from('audits').select('id, agent_id, agent_name, team, case_type, audit_date, quality_score, comments, shared_with_agent').order('audit_date', { ascending: false }),
    ]);
    setLoading(false);
    if (feedbackResult.error || profilesResult.error || auditsResult.error) {
      setErrorMessage(feedbackResult.error?.message || profilesResult.error?.message || auditsResult.error?.message || 'Could not load coaching center data.');
      return;
    }
    setFeedbackItems((feedbackResult.data as AgentFeedback[]) || []);
    setProfiles((profilesResult.data as AgentProfile[]) || []);
    setAudits((auditsResult.data as AuditItem[]) || []);
  }

  const visibleAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      p.agent_name.toLowerCase().includes(q) ||
      (p.agent_id || '').toLowerCase().includes(q) ||
      (p.display_name || '').toLowerCase().includes(q)
    );
  }, [profiles, agentSearch]);

  const selectedAgent = profiles.find((p) => p.id === selectedAgentProfileId) || null;

  function getAgentLabel(p: AgentProfile) {
    return p.display_name ? `${p.agent_name} · ${p.display_name}` : `${p.agent_name} · ${p.agent_id || '—'}`;
  }

  function getFeedbackDisplayName(item: AgentFeedback) {
    return profiles.find((p) => normalizeAgentId(p.agent_id) === normalizeAgentId(item.agent_id) && normalizeAgentName(p.agent_name) === normalizeAgentName(item.agent_name) && p.team === item.team)?.display_name || '—';
  }

  function getFeedbackAgentKey(item: AgentFeedback) {
    return `${normalizeAgentId(item.agent_id)}||${normalizeAgentName(item.agent_name)}||${item.team}`;
  }

  const savedAgentOptions = useMemo(() => {
    const seen = new Set<string>();
    return feedbackItems
      .filter((item) => { const k = getFeedbackAgentKey(item); if (seen.has(k)) return false; seen.add(k); return true; })
      .map((item) => ({ key: getFeedbackAgentKey(item), label: `${item.agent_name} · ${item.agent_id} · ${item.team}` }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [feedbackItems, profiles]);

  const baseFilteredFeedbackItems = useMemo(() =>
    feedbackItems.filter((item) => {
      const matchesAgent = !savedAgentFilter || getFeedbackAgentKey(item) === savedAgentFilter;
      const matchesStatus = savedStatusFilter === 'All' || item.status === savedStatusFilter;
      const matchesType = savedTypeFilter === 'All' || item.feedback_type === savedTypeFilter;
      return matchesAgent && matchesStatus && matchesType;
    }),
    [feedbackItems, savedAgentFilter, savedStatusFilter, savedTypeFilter]
  );

  const filteredFeedbackItems = useMemo(() => {
    const rank: Record<PlanPriority, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return [...baseFilteredFeedbackItems]
      .filter((item) => matchesPlanTab(item, activePlanTab))
      .sort((a, b) => {
        const aO = isFeedbackOverdue(a) ? 1 : 0;
        const bO = isFeedbackOverdue(b) ? 1 : 0;
        if (aO !== bO) return bO - aO;
        const aA = a.status !== 'Closed' && !a.acknowledged_by_agent ? 1 : 0;
        const bA = b.status !== 'Closed' && !b.acknowledged_by_agent ? 1 : 0;
        if (aA !== bA) return bA - aA;
        const aP = rank[parseStructuredPlan(a.action_plan).priority];
        const bP = rank[parseStructuredPlan(b.action_plan).priority];
        if (aP !== bP) return aP - bP;
        const aDue = String(a.due_date || '9999-12-31');
        const bDue = String(b.due_date || '9999-12-31');
        if (aDue !== bDue) return aDue.localeCompare(bDue);
        return String(b.created_at).localeCompare(String(a.created_at));
      });
  }, [baseFilteredFeedbackItems, activePlanTab]);

  const planTabCounts = useMemo(() => ({
    All: baseFilteredFeedbackItems.length,
    Open: baseFilteredFeedbackItems.filter((i) => matchesPlanTab(i, 'Open')).length,
    Overdue: baseFilteredFeedbackItems.filter((i) => matchesPlanTab(i, 'Overdue')).length,
    'Awaiting Ack': baseFilteredFeedbackItems.filter((i) => matchesPlanTab(i, 'Awaiting Ack')).length,
    'Follow-up': baseFilteredFeedbackItems.filter((i) => matchesPlanTab(i, 'Follow-up')).length,
  } as Record<PlanTab, number>), [baseFilteredFeedbackItems]);

  const reviewStageCounts = useMemo(() => {
    const counts: Record<ReviewStage, number> = { 'QA Shared': 0, 'Acknowledged': 0, 'Agent Responded': 0, 'Supervisor Reviewed': 0, 'Follow-up': 0, 'Closed': 0 };
    feedbackItems.forEach((item) => { counts[parseStructuredPlan(item.action_plan).reviewStage] += 1; });
    return counts;
  }, [feedbackItems]);

  const selectedAgentAudits = useMemo(() => {
    if (!selectedAgent) return [];
    return audits
      .filter((i) => normalizeAgentId(i.agent_id) === normalizeAgentId(selectedAgent.agent_id) && normalizeAgentName(i.agent_name) === normalizeAgentName(selectedAgent.agent_name) && i.team === selectedAgent.team)
      .sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1));
  }, [audits, selectedAgent]);

  const selectedAgentAverage = selectedAgentAudits.length > 0
    ? selectedAgentAudits.reduce((s, i) => s + Number(i.quality_score), 0) / selectedAgentAudits.length
    : 0;

  const filteredSelectedAgentAudits = useMemo(() =>
    selectedAgentAudits.filter((i) => {
      const d = String(i.audit_date || '').slice(0, 10);
      return (!auditDateFrom || d >= auditDateFrom) && (!auditDateTo || d <= auditDateTo);
    }),
    [selectedAgentAudits, auditDateFrom, auditDateTo]
  );

  const selectedAudit = filteredSelectedAgentAudits.find((i) => i.id === selectedAuditId) || filteredSelectedAgentAudits[0] || null;

  const selectedAgentOpenItems = useMemo(() => {
    if (!selectedAgent) return [];
    return feedbackItems.filter((i) => normalizeAgentId(i.agent_id) === normalizeAgentId(selectedAgent.agent_id) && normalizeAgentName(i.agent_name) === normalizeAgentName(selectedAgent.agent_name) && i.team === selectedAgent.team && i.status !== 'Closed');
  }, [feedbackItems, selectedAgent]);

  const overdueCount = useMemo(() => feedbackItems.filter(isFeedbackOverdue).length, [feedbackItems]);
  const highPriorityCount = useMemo(() => feedbackItems.filter((i) => { const p = parseStructuredPlan(i.action_plan).priority; return i.status !== 'Closed' && (p === 'High' || p === 'Critical'); }).length, [feedbackItems]);
  const unacknowledgedCount = useMemo(() => feedbackItems.filter((i) => i.status !== 'Closed' && !i.acknowledged_by_agent).length, [feedbackItems]);
  const followUpCount = useMemo(() => feedbackItems.filter((i) => i.feedback_type === 'Follow-up' && i.status !== 'Closed').length, [feedbackItems]);

  function applyAuditToCoaching(audit: AuditItem) {
    setSelectedAuditId(audit.id);
    setSubject(`${audit.team} coaching · ${audit.case_type}`);
    setJustification(audit.comments || '');
    setActionPlan(`Review ${audit.case_type} standards, acknowledge the coaching note, and complete a follow-up check on the next matching case.`);
    setPriorityOnCreate(audit.quality_score < 75 ? 'Critical' : audit.quality_score < 85 ? 'High' : 'Medium');
  }

  function handleSelectAgent(profile: AgentProfile) {
    setSelectedAgentProfileId(profile.id);
    setAgentSearch(getAgentLabel(profile));
    setIsAgentPickerOpen(false);
    const recentAudit = audits.find((i) => normalizeAgentId(i.agent_id) === normalizeAgentId(profile.agent_id) && normalizeAgentName(i.agent_name) === normalizeAgentName(profile.agent_name) && i.team === profile.team);
    if (recentAudit) applyAuditToCoaching(recentAudit);
    else setSelectedAuditId('');
  }

  function resetForm() {
    setSelectedAgentProfileId(''); setAgentSearch(''); setIsAgentPickerOpen(false);
    setQaName(currentUser?.agent_name || ''); setFeedbackType('Coaching');
    setSubject(''); setFeedbackNote(''); setJustification(''); setActionPlan('');
    setFollowUpDate(''); setStatusOnCreate('Open'); setPriorityOnCreate('Medium');
    setAuditDateFrom(''); setAuditDateTo(''); setSelectedAuditId('');
  }

  async function handleCreatePlan() {
    setErrorMessage(''); setSuccessMessage('');
    if (!selectedAgent || !qaName.trim() || !subject.trim() || !feedbackNote.trim()) {
      setErrorMessage('Please choose an agent and fill QA Name, Subject, and Coaching Summary.');
      return;
    }
    setSaving(true);
    const mergedActionPlan = composeStructuredPlan({ priority: priorityOnCreate, reviewStage: statusOnCreate === 'Closed' ? 'Closed' : 'QA Shared', actionPlan, justification, agentComment: '', supervisorReview: '', followUpOutcome: 'Not Set', resolutionNote: '' });
    const { error } = await supabase.from('agent_feedback').insert({ agent_id: selectedAgent.agent_id, agent_name: selectedAgent.agent_name, team: selectedAgent.team, qa_name: qaName.trim(), feedback_type: feedbackType, subject: subject.trim(), feedback_note: feedbackNote.trim(), action_plan: mergedActionPlan || null, due_date: followUpDate || null, status: statusOnCreate, acknowledged_by_agent: false });
    setSaving(false);
    if (error) { setErrorMessage(error.message); return; }
    setSuccessMessage('Coaching plan created successfully.');
    resetForm();
    void loadAll();
  }

  async function handleStatusChange(feedbackId: string, newStatus: FeedbackStatus) {
    setErrorMessage(''); setSuccessMessage('');
    const { error } = await supabase.from('agent_feedback').update({ status: newStatus }).eq('id', feedbackId);
    if (error) { setErrorMessage(error.message); return; }
    setSuccessMessage(`Status updated to ${newStatus}.`);
    setFeedbackItems((prev) => prev.map((i) => i.id === feedbackId ? { ...i, status: newStatus } : i));
  }

  async function handleToggleAcknowledgment(item: AgentFeedback) {
    setErrorMessage(''); setSuccessMessage('');
    const nextAck = !item.acknowledged_by_agent;
    const parsed = parseStructuredPlan(item.action_plan);
    const nextStage = nextAck && parsed.reviewStage === 'QA Shared' ? 'Acknowledged' : parsed.reviewStage;
    const nextActionPlan = composeStructuredPlan({ ...parsed, reviewStage: nextStage });
    const { error } = await supabase.from('agent_feedback').update({ acknowledged_by_agent: nextAck, action_plan: nextActionPlan || null }).eq('id', item.id);
    if (error) { setErrorMessage(error.message); return; }
    setSuccessMessage(nextAck ? 'Acknowledgment saved.' : 'Acknowledgment removed.');
    setFeedbackItems((prev) => prev.map((e) => e.id === item.id ? { ...e, acknowledged_by_agent: nextAck, action_plan: nextActionPlan || null } : e));
  }

  async function handleSaveCycleUpdate(item: AgentFeedback) {
    setErrorMessage(''); setSuccessMessage('');
    const parsed = parseStructuredPlan(item.action_plan);
    const chosenStage = reviewStageDrafts[item.id] || parsed.reviewStage;
    const agentComment = agentCommentDrafts[item.id] ?? parsed.agentComment;
    const supervisorReview = supervisorReviewDrafts[item.id] ?? parsed.supervisorReview;
    const nextStage = agentComment.trim() && (chosenStage === 'QA Shared' || chosenStage === 'Acknowledged') ? 'Agent Responded' : supervisorReview.trim() && chosenStage === 'Agent Responded' ? 'Supervisor Reviewed' : chosenStage;
    const nextActionPlan = composeStructuredPlan({ ...parsed, reviewStage: nextStage, agentComment, supervisorReview });
    const nextStatus = nextStage === 'Closed' ? 'Closed' : item.status === 'Closed' ? 'In Progress' : item.status;
    const { error } = await supabase.from('agent_feedback').update({ action_plan: nextActionPlan || null, status: nextStatus }).eq('id', item.id);
    if (error) { setErrorMessage(error.message); return; }
    setSuccessMessage('Coaching cycle updated.');
    setFeedbackItems((prev) => prev.map((e) => e.id === item.id ? { ...e, action_plan: nextActionPlan || null, status: nextStatus } : e));
  }

  async function handleSaveFollowUpResult(item: AgentFeedback) {
    setErrorMessage(''); setSuccessMessage('');
    const parsed = parseStructuredPlan(item.action_plan);
    const followUpOutcome = planOutcomeDrafts[item.id] || parsed.followUpOutcome;
    const resolutionNote = resolutionNoteDrafts[item.id] ?? parsed.resolutionNote;
    const nextActionPlan = composeStructuredPlan({ ...parsed, reviewStage: followUpOutcome !== 'Not Set' ? parsed.reviewStage === 'Closed' ? 'Closed' : 'Follow-up' : parsed.reviewStage, followUpOutcome, resolutionNote });
    const { error } = await supabase.from('agent_feedback').update({ action_plan: nextActionPlan || null }).eq('id', item.id);
    if (error) { setErrorMessage(error.message); return; }
    setSuccessMessage('Follow-up outcome saved.');
    setFeedbackItems((prev) => prev.map((e) => e.id === item.id ? { ...e, action_plan: nextActionPlan || null } : e));
  }

  async function handleDelete(feedbackId: string) {
    setErrorMessage(''); setSuccessMessage('');
    if (pendingDeleteId !== feedbackId) { setPendingDeleteId(feedbackId); setSuccessMessage('Click delete again to confirm removal.'); return; }
    const { error } = await supabase.from('agent_feedback').delete().eq('id', feedbackId);
    if (error) { setErrorMessage(error.message); return; }
    setPendingDeleteId(null);
    setFeedbackItems((prev) => prev.filter((i) => i.id !== feedbackId));
    setSuccessMessage('Coaching item deleted successfully.');
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="cc-page">

      {/* Page header */}
      <div className="cc-page-header">
        <div>
          <div className="cc-eyebrow">Coaching Center</div>
          <h2 className="cc-page-title">Agent Feedback & Plans</h2>
          <p className="cc-page-sub">Build coaching plans, track the review cycle, and log follow-up outcomes.</p>
        </div>
        <button type="button" className="cc-refresh-btn" onClick={() => void loadAll()}>
          ↺ Refresh
        </button>
      </div>

      {/* Banners */}
      {errorMessage && <div className="cc-banner cc-banner-error">⚠ {errorMessage}</div>}
      {successMessage && <div className="cc-banner cc-banner-success">✓ {successMessage}</div>}

      {/* KPI bento row */}
      <div className="cc-kpi-grid">
        {[
          { label: 'Open Plans', value: String(feedbackItems.filter((i) => i.status !== 'Closed').length), sub: 'Active coaching items', accent: 'var(--accent-blue)', delay: 0 },
          { label: 'Overdue', value: String(overdueCount), sub: 'Due date passed, not closed', accent: overdueCount > 0 ? 'var(--accent-rose)' : 'var(--fg-muted)', delay: 40 },
          { label: 'Unacknowledged', value: String(unacknowledgedCount), sub: 'Agent has not acknowledged', accent: unacknowledgedCount > 0 ? 'var(--accent-amber)' : 'var(--fg-muted)', delay: 80 },
          { label: 'High Priority', value: String(highPriorityCount), sub: 'High + Critical, still open', accent: highPriorityCount > 0 ? 'var(--accent-rose)' : 'var(--fg-muted)', delay: 120 },
          { label: 'Follow-up Queue', value: String(followUpCount), sub: 'Open follow-up tasks', accent: 'var(--accent-violet)', delay: 160 },
        ].map(({ label, value, sub, accent, delay }) => (
          <div key={label} className="cc-kpi-card" style={{ '--kpi-accent': accent, animationDelay: `${delay}ms` } as React.CSSProperties}>
            <div className="cc-kpi-label">{label}</div>
            <div className="cc-kpi-value">{value}</div>
            <div className="cc-kpi-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Workspace: form + side panels */}
      <div className="cc-workspace-grid">

        {/* Left — coaching form */}
        <div className="cc-panel" style={{ animationDelay: '60ms' }}>
          <div className="cc-panel-eyebrow">Create Plan</div>
          <h3 className="cc-panel-title">Coaching Workspace</h3>
          <p className="cc-panel-sub">Start from the agent, use the latest audit as context, then define a clear next-step plan.</p>

          <div className="cc-form-grid">
            {/* Agent picker */}
            <div className="cc-full-col">
              <label className="cc-field-label">Agent</label>
              <div ref={agentPickerRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="cc-picker-btn"
                  onClick={() => setIsAgentPickerOpen((p) => !p)}
                  aria-expanded={isAgentPickerOpen}
                >
                  <span className="cc-picker-btn-text" style={{ color: selectedAgent ? 'var(--fg-default)' : 'var(--fg-muted)' }}>
                    {selectedAgent ? getAgentLabel(selectedAgent) : 'Select agent…'}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--fg-muted)', flexShrink: 0 }}>▾</span>
                </button>
                {isAgentPickerOpen && (
                  <div className="cc-picker-menu">
                    <div className="cc-picker-search">
                      <input type="text" value={agentSearch} onChange={(e) => setAgentSearch(e.target.value)} placeholder="Search by name, ID…" className="cc-field" />
                    </div>
                    <div className="cc-picker-list">
                      {visibleAgents.length === 0
                        ? <div className="cc-picker-empty">No agents found</div>
                        : visibleAgents.map((profile) => (
                          <button key={profile.id} type="button" className={`cc-picker-option${selectedAgentProfileId === profile.id ? ' active' : ''}`} onClick={() => handleSelectAgent(profile)}>
                            {getAgentLabel(profile)}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Agent snapshot */}
            <div className="cc-full-col">
              <div className="cc-snapshot-card">
                <div className="cc-snapshot-title">Agent Snapshot</div>
                {[
                  ['Agent ID', selectedAgent?.agent_id || '—'],
                  ['Name', selectedAgent?.agent_name || '—'],
                  ['Display', selectedAgent?.display_name || '—'],
                  ['Team', selectedAgent?.team || '—'],
                  ['Open Items', String(selectedAgentOpenItems.length)],
                ].map(([k, v]) => (
                  <div key={k} className="cc-snapshot-row">
                    <span className="cc-snapshot-key">{k}</span>
                    <span className="cc-snapshot-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="cc-field-label">QA Name</label>
              <input type="text" value={qaName} onChange={(e) => setQaName(e.target.value)} className="cc-field" placeholder="Enter QA name" />
            </div>

            <div>
              <label className="cc-field-label">Plan Type</label>
              <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value as FeedbackType)} className="cc-field cc-field-select">
                <option value="Coaching">Coaching</option>
                <option value="Audit Feedback">Audit Feedback</option>
                <option value="Warning">Warning</option>
                <option value="Follow-up">Follow-up</option>
              </select>
            </div>

            <div>
              <label className="cc-field-label">Priority</label>
              <select value={priorityOnCreate} onChange={(e) => setPriorityOnCreate(e.target.value as PlanPriority)} className="cc-field cc-field-select">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="cc-field-label">Starting Status</label>
              <select value={statusOnCreate} onChange={(e) => setStatusOnCreate(e.target.value as FeedbackStatus)} className="cc-field cc-field-select">
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="cc-field-label">Follow-up Date</label>
              <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="cc-field" />
            </div>

            <div className="cc-full-col">
              <label className="cc-field-label">Subject</label>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className="cc-field" placeholder="e.g. Calls coaching · Refund accuracy" />
            </div>

            <div className="cc-full-col">
              <label className="cc-field-label">Coaching Summary</label>
              <textarea value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)} rows={4} className="cc-field cc-field-textarea" placeholder="Summarize the gap, expectation, and what good looks like." />
            </div>

            <div className="cc-full-col">
              <label className="cc-field-label">Justification / Audit Context</label>
              <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} className="cc-field cc-field-textarea" placeholder="Use audit comments, examples, or case references to justify the plan." />
            </div>

            <div className="cc-full-col">
              <label className="cc-field-label">Action Plan</label>
              <textarea value={actionPlan} onChange={(e) => setActionPlan(e.target.value)} rows={4} className="cc-field cc-field-textarea" placeholder="Write concrete next steps, owner, and follow-up expectations." />
            </div>
          </div>

          <div className="cc-btn-row">
            <button onClick={handleCreatePlan} disabled={saving} className="cc-btn-primary">
              {saving ? 'Saving…' : '+ Create Coaching Plan'}
            </button>
            <button type="button" onClick={resetForm} disabled={saving} className="cc-btn-secondary">
              Clear Form
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="cc-stack-col">

          {/* Audit history panel */}
          <div className="cc-panel" style={{ animationDelay: '100ms' }}>
            <div className="cc-panel-eyebrow">Audit History</div>
            <h3 className="cc-panel-title">Selected Agent Audits</h3>
            <p className="cc-panel-sub">Filter by date, scroll the history, and pick the exact audit to use as coaching source.</p>

            {!selectedAgent ? (
              <div className="cc-empty">Pick an agent to load full audit history.</div>
            ) : (
              <>
                <div className="cc-stat-grid">
                  <div className="cc-stat-card"><div className="cc-stat-label">All Audits</div><div className="cc-stat-value">{selectedAgentAudits.length}</div><div className="cc-stat-helper">Loaded for this agent</div></div>
                  <div className="cc-stat-card"><div className="cc-stat-label">Visible</div><div className="cc-stat-value">{filteredSelectedAgentAudits.length}</div><div className="cc-stat-helper">After date filters</div></div>
                  <div className="cc-stat-card"><div className="cc-stat-label">Avg Quality</div><div className="cc-stat-value" style={{ fontSize: '16px' }}>{selectedAgentAudits.length ? `${selectedAgentAverage.toFixed(1)}%` : '—'}</div><div className="cc-stat-helper">All loaded audits</div></div>
                </div>

                <div className="cc-audit-filter-grid">
                  <div>
                    <label className="cc-field-label">From</label>
                    <input type="date" value={auditDateFrom} onChange={(e) => setAuditDateFrom(e.target.value)} className="cc-field" />
                  </div>
                  <div>
                    <label className="cc-field-label">To</label>
                    <input type="date" value={auditDateTo} onChange={(e) => setAuditDateTo(e.target.value)} className="cc-field" />
                  </div>
                  <div>
                    <button type="button" className="cc-btn-secondary" style={{ height: '36px', alignSelf: 'flex-end' }} onClick={() => { setAuditDateFrom(''); setAuditDateTo(''); }}>
                      Clear
                    </button>
                  </div>
                </div>

                <div className="cc-audit-list">
                  {filteredSelectedAgentAudits.length === 0 ? (
                    <div className="cc-empty">No audits match the selected date range.</div>
                  ) : (
                    filteredSelectedAgentAudits.map((audit) => {
                      const isActive = selectedAudit?.id === audit.id;
                      const score = Number(audit.quality_score);
                      const scoreColor = score >= 95 ? 'var(--accent-emerald)' : score >= 85 ? 'var(--accent-blue)' : score >= 75 ? 'var(--accent-amber)' : 'var(--accent-rose)';
                      return (
                        <div key={audit.id} className={`cc-audit-card${isActive ? ' active' : ''}`}>
                          <div className="cc-audit-top-row">
                            <div>
                              <div className="cc-audit-case-type">{audit.case_type}</div>
                              <div className="cc-audit-meta">{formatDateOnly(audit.audit_date)} · {audit.team} · {audit.shared_with_agent ? 'Shared' : 'Internal'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div className="cc-audit-score" style={{ color: scoreColor }}>{score.toFixed(2)}%</div>
                            </div>
                          </div>
                          <div className="cc-audit-comment">{audit.comments || 'No audit comment saved for this item.'}</div>
                          <div className="cc-audit-action-row">
                            <button type="button" className="cc-btn-primary" style={{ height: '28px', fontSize: '11px' }} onClick={() => applyAuditToCoaching(audit)}>
                              Use for Coaching
                            </button>
                            {isActive && <span className="cc-source-badge">Current Source</span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Review queue panel */}
          <div className="cc-panel" style={{ animationDelay: '140ms' }}>
            <div className="cc-panel-eyebrow">Review Queue</div>
            <h3 className="cc-panel-title">Routing & Cycle</h3>
            <p className="cc-panel-sub">Track where each plan is in the coaching cycle, then filter the queue below.</p>

            <div className="cc-routing-grid">
              {[
                { label: 'QA Shared', value: reviewStageCounts['QA Shared'], helper: 'Awaiting ack or comment', accent: 'var(--fg-muted)' },
                { label: 'Agent Responded', value: reviewStageCounts['Agent Responded'], helper: 'Ready for review', accent: 'var(--accent-cyan)' },
                { label: 'Sup. Reviewed', value: reviewStageCounts['Supervisor Reviewed'], helper: 'Needs sign-off', accent: 'var(--accent-amber)' },
                { label: 'Follow-up', value: reviewStageCounts['Follow-up'], helper: 'Outcome tracking', accent: 'var(--accent-violet)' },
              ].map(({ label, value, helper, accent }) => (
                <div key={label} className="cc-stat-card" style={{ borderLeft: `2px solid ${accent}` }}>
                  <div className="cc-stat-label">{label}</div>
                  <div className="cc-stat-value" style={{ fontSize: '18px', color: accent }}>{value}</div>
                  <div className="cc-stat-helper">{helper}</div>
                </div>
              ))}
            </div>

            <div className="cc-filter-grid">
              <div>
                <label className="cc-field-label">Agent</label>
                <select value={savedAgentFilter} onChange={(e) => setSavedAgentFilter(e.target.value)} className="cc-field cc-field-select">
                  <option value="">All Agents</option>
                  {savedAgentOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="cc-field-label">Status</label>
                <select value={savedStatusFilter} onChange={(e) => setSavedStatusFilter(e.target.value as 'All' | FeedbackStatus)} className="cc-field cc-field-select">
                  <option value="All">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="cc-field-label">Type</label>
                <select value={savedTypeFilter} onChange={(e) => setSavedTypeFilter(e.target.value as 'All' | FeedbackType)} className="cc-field cc-field-select">
                  <option value="All">All Types</option>
                  <option value="Coaching">Coaching</option>
                  <option value="Audit Feedback">Audit Feedback</option>
                  <option value="Warning">Warning</option>
                  <option value="Follow-up">Follow-up</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Saved plans table */}
      <div className="cc-panel" style={{ animationDelay: '180ms' }}>
        <div className="cc-panel-eyebrow">Saved Plans</div>
        <h3 className="cc-panel-title">Coaching Tasks & Follow-up</h3>
        <p className="cc-panel-sub">Use tabs to focus the queue, then open details to manage the full cycle: acknowledgment, agent comment, supervisor review, follow-up outcome, and closure.</p>

        {/* Tabs */}
        <div className="cc-tab-row">
          {(['All', 'Open', 'Overdue', 'Awaiting Ack', 'Follow-up'] as PlanTab[]).map((tab) => (
            <button key={tab} type="button" className={`cc-tab-btn${activePlanTab === tab ? ' active' : ''}`} onClick={() => setActivePlanTab(tab)}>
              {tab}
              <span className="cc-tab-count">{planTabCounts[tab]}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="cc-loader">
            <div className="cc-spinner" />
            <span className="cc-spinner-text">Loading coaching items…</span>
          </div>
        ) : filteredFeedbackItems.length === 0 ? (
          <div className="cc-empty">No coaching items found for the current filters.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '1080px' }}>
              <div className="cc-plans-table-wrap">
                {/* Head */}
                <div className="cc-plans-head">
                  <div className="cc-plans-head-cell">Agent</div>
                  <div className="cc-plans-head-cell">Type · Priority</div>
                  <div className="cc-plans-head-cell">Subject</div>
                  <div className="cc-plans-head-cell">Follow-up</div>
                  <div className="cc-plans-head-cell">Status · Stage</div>
                  <div className="cc-plans-head-cell">Agent Cycle</div>
                  <div className="cc-plans-head-cell">Actions</div>
                </div>

                {/* Rows */}
                {filteredFeedbackItems.map((item) => {
                  const isExpanded = expandedFeedbackId === item.id;
                  const parsed = parseStructuredPlan(item.action_plan);
                  const dueDiff = daysUntil(item.due_date);
                  const isOverdue = dueDiff !== null && dueDiff < 0 && item.status !== 'Closed';

                  return (
                    <div key={item.id}>
                      <div className="cc-plans-row">
                        {/* Agent */}
                        <div>
                          <div className="cc-cell-primary">{item.agent_name}</div>
                          <div className="cc-cell-secondary">{getFeedbackDisplayName(item)} · {item.agent_id} · {item.team}</div>
                        </div>

                        {/* Type + Priority */}
                        <div>
                          <div className="cc-pill-stack">
                            <span className={typePillClass(item.feedback_type)}>{item.feedback_type}</span>
                            <span className={priorityPillClass(parsed.priority)}>{parsed.priority}</span>
                          </div>
                          {parsed.followUpOutcome !== 'Not Set' && (
                            <div style={{ marginTop: '5px' }}>
                              <span className={outcomePillClass(parsed.followUpOutcome)}>{parsed.followUpOutcome}</span>
                            </div>
                          )}
                        </div>

                        {/* Subject */}
                        <div>
                          <div className="cc-cell-primary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subject}</div>
                          <div className="cc-cell-secondary">By {item.qa_name}</div>
                        </div>

                        {/* Follow-up date */}
                        <div>
                          <div className="cc-cell-primary">{formatDateOnly(item.due_date)}</div>
                          <div className={isOverdue ? 'cc-overdue' : 'cc-due-ok'}>
                            {item.due_date ? (isOverdue ? '⚠ Overdue' : dueDiff === 0 ? 'Due today' : `${dueDiff}d left`) : 'No due date'}
                          </div>
                        </div>

                        {/* Status + Stage */}
                        <div>
                          <select value={item.status} onChange={(e) => void handleStatusChange(item.id, e.target.value as FeedbackStatus)} className="cc-mini-select" style={{ marginBottom: '5px' }}>
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Closed">Closed</option>
                          </select>
                          <div><span className={stagePillClass(parsed.reviewStage)}>{parsed.reviewStage}</span></div>
                        </div>

                        {/* Agent Cycle */}
                        <div>
                          <button
                            type="button"
                            className={`cc-ack-btn${item.acknowledged_by_agent ? ' yes' : ' no'}`}
                            onClick={() => void handleToggleAcknowledgment(item)}
                          >
                            {item.acknowledged_by_agent ? '✓ Acknowledged' : '○ Not yet'}
                          </button>
                          <div className="cc-cell-secondary">
                            {parsed.agentComment ? 'Comment added' : 'Awaiting comment'}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="cc-cell-actions">
                          <button type="button" className="cc-btn-ghost" onClick={() => setExpandedFeedbackId(isExpanded ? null : item.id)}>
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                          <button type="button" className={`cc-btn-danger${pendingDeleteId === item.id ? ' confirm' : ''}`} onClick={() => void handleDelete(item.id)}>
                            {pendingDeleteId === item.id ? 'Confirm' : 'Delete'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="cc-expanded-wrap">
                          {/* Stage stepper */}
                          <ReviewStageStepper current={parsed.reviewStage} />

                          {/* Text blocks */}
                          <div style={{ display: 'grid', gap: '8px' }}>
                            <div className="cc-detail-block">
                              <div className="cc-detail-label">Coaching Summary</div>
                              <div className="cc-detail-value">{item.feedback_note}</div>
                            </div>
                            {parsed.actionPlan && (
                              <div className="cc-detail-block">
                                <div className="cc-detail-label">Action Plan</div>
                                <div className="cc-detail-value">{parsed.actionPlan}</div>
                              </div>
                            )}
                            {parsed.justification && (
                              <div className="cc-detail-block">
                                <div className="cc-detail-label">Justification</div>
                                <div className="cc-detail-value">{parsed.justification}</div>
                              </div>
                            )}
                          </div>

                          {/* Meta grid */}
                          <div className="cc-expanded-grid">
                            {[
                              ['Created', formatDateTime(item.created_at)],
                              ['Due Date', formatDateOnly(item.due_date)],
                              ['Status', item.status],
                              ['Stage', parsed.reviewStage],
                              ['Priority', parsed.priority],
                              ['Outcome', parsed.followUpOutcome],
                              ['Acknowledgment', item.acknowledged_by_agent ? 'Acknowledged' : 'Not yet'],
                            ].map(([k, v]) => (
                              <div key={k} className="cc-detail-block">
                                <div className="cc-detail-label">{k}</div>
                                <div className="cc-detail-mini-val">{v}</div>
                              </div>
                            ))}
                          </div>

                          {/* Cycle editor */}
                          <div className="cc-cycle-editor">
                            <div className="cc-cycle-editor-title">Coaching Cycle</div>
                            <div className="cc-cycle-editor-grid">
                              <div>
                                <label className="cc-field-label">Review Stage</label>
                                <select value={reviewStageDrafts[item.id] || parsed.reviewStage} onChange={(e) => setReviewStageDrafts((p) => ({ ...p, [item.id]: e.target.value as ReviewStage }))} className="cc-field cc-field-select">
                                  {(['QA Shared', 'Acknowledged', 'Agent Responded', 'Supervisor Reviewed', 'Follow-up', 'Closed'] as ReviewStage[]).map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </div>
                              <div style={{ gridColumn: 'span 1' }} /> {/* spacer */}
                              <div className="cc-cycle-editor-wide">
                                <label className="cc-field-label">Agent Comment</label>
                                <textarea value={agentCommentDrafts[item.id] ?? parsed.agentComment} onChange={(e) => setAgentCommentDrafts((p) => ({ ...p, [item.id]: e.target.value }))} rows={3} className="cc-field cc-field-textarea" placeholder="Agent can respond with questions, commitment, or explanation." />
                              </div>
                              <div className="cc-cycle-editor-wide">
                                <label className="cc-field-label">Supervisor Review</label>
                                <textarea value={supervisorReviewDrafts[item.id] ?? parsed.supervisorReview} onChange={(e) => setSupervisorReviewDrafts((p) => ({ ...p, [item.id]: e.target.value }))} rows={3} className="cc-field cc-field-textarea" placeholder="Supervisor can confirm next steps and route forward." />
                              </div>
                            </div>
                            <div className="cc-btn-row">
                              <button type="button" className="cc-btn-primary" onClick={() => void handleSaveCycleUpdate(item)}>Save Cycle Update</button>
                            </div>
                          </div>

                          {/* Follow-up result editor */}
                          <div className="cc-cycle-editor">
                            <div className="cc-cycle-editor-title">Follow-up Result</div>
                            <div className="cc-cycle-editor-grid">
                              <div>
                                <label className="cc-field-label">Outcome</label>
                                <select value={planOutcomeDrafts[item.id] || parsed.followUpOutcome} onChange={(e) => setPlanOutcomeDrafts((p) => ({ ...p, [item.id]: e.target.value as FollowUpOutcome }))} className="cc-field cc-field-select">
                                  {(['Not Set', 'Improved', 'Partial Improvement', 'No Improvement', 'Needs Escalation'] as FollowUpOutcome[]).map((o) => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </div>
                              <div style={{ gridColumn: 'span 1' }} />
                              <div className="cc-cycle-editor-wide">
                                <label className="cc-field-label">Resolution Note</label>
                                <textarea value={resolutionNoteDrafts[item.id] ?? parsed.resolutionNote} onChange={(e) => setResolutionNoteDrafts((p) => ({ ...p, [item.id]: e.target.value }))} rows={4} className="cc-field cc-field-textarea" placeholder="Document what happened, what improved, and what still needs attention." />
                              </div>
                            </div>
                            <div className="cc-btn-row">
                              <button type="button" className="cc-btn-primary" onClick={() => void handleSaveFollowUpResult(item)}>Save Follow-up Result</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CoachingCenter;
