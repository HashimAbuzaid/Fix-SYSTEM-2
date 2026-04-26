import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileRole = 'admin' | 'qa' | 'agent' | 'supervisor';
type TeamName = 'Calls' | 'Tickets' | 'Sales';
type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
type Status = 'Open' | 'Under Review' | 'Closed';

type SupervisorRequest = {
  id: string;
  case_reference: string;
  agent_id: string | null;
  agent_name: string | null;
  display_name?: string | null;
  team: TeamName | null;
  case_type: string;
  supervisor_name: string;
  priority: Priority;
  request_note: string;
  status: Status;
  created_at: string;
};

type AgentProfile = {
  id: string;
  role: 'agent';
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
};

type CurrentUser = {
  id: string;
  role: ProfileRole;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
  email: string;
};

type SupervisorRequestsSupabaseProps = {
  currentUser?: CurrentUser | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CASE_TYPES = [
  'Order status', 'General Inquiry', 'Exchange', 'Missing Parts',
  'Refund - Store credit', 'Delivered but not received', 'FedEx Cases',
  'Replacement', 'Warranty', 'Fitment issue', 'Damaged package', 'Cancellation',
];

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; border: string; dot: string }> = {
  Low:    { color: '#6b7280', bg: 'rgba(107,114,128,0.1)',  border: 'rgba(107,114,128,0.25)', dot: '#6b7280' },
  Medium: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',   dot: '#3b82f6' },
  High:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',   dot: '#f59e0b' },
  Urgent: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',    dot: '#ef4444' },
};

const STATUS_CONFIG: Record<Status, { color: string; bg: string; border: string; label: string }> = {
  'Open':         { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)',  label: 'Open' },
  'Under Review': { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)',  label: 'Under Review' },
  'Closed':       { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  label: 'Closed' },
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const INJECTED_STYLE_ID = 'sr-upgrade-styles';

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap');

.sr-root * { box-sizing: border-box; }

.sr-root {
  font-family: 'Geist', system-ui, sans-serif;
  color: var(--sr-text, #e2e8f0);
}

/* ── Animations ── */
@keyframes sr-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sr-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes sr-slide-down {
  from { opacity: 0; transform: translateY(-6px) scaleY(0.96); }
  to   { opacity: 1; transform: translateY(0) scaleY(1); }
}
@keyframes sr-scale-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes sr-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
@keyframes sr-pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.8); }
}
@keyframes sr-spin {
  to { transform: rotate(360deg); }
}

/* ── Stats Row ── */
.sr-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
  animation: sr-fade-up 0.35s ease both;
}
@media (max-width: 700px) {
  .sr-stats-row { grid-template-columns: repeat(2, 1fr); }
}

.sr-stat-card {
  padding: 16px 18px;
  border-radius: 14px;
  background: var(--sr-card-bg, rgba(255,255,255,0.03));
  border: 1px solid var(--sr-border, rgba(255,255,255,0.07));
  position: relative;
  overflow: hidden;
  cursor: default;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.sr-stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  border-radius: 14px 14px 0 0;
  background: var(--sr-stat-accent, #3b82f6);
  opacity: 0.7;
}
.sr-stat-card:hover {
  background: var(--sr-card-bg-hover, rgba(255,255,255,0.055));
  border-color: var(--sr-border-hover, rgba(255,255,255,0.12));
}
.sr-stat-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--sr-muted, #64748b);
  margin-bottom: 8px;
}
.sr-stat-value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--sr-stat-accent, #e2e8f0);
  font-family: 'Geist Mono', monospace;
}
.sr-stat-sub {
  font-size: 11px;
  color: var(--sr-muted, #64748b);
  margin-top: 5px;
}

/* ── Create Form Panel ── */
.sr-form-panel {
  background: var(--sr-panel-bg, rgba(255,255,255,0.03));
  border: 1px solid var(--sr-border, rgba(255,255,255,0.07));
  border-radius: 18px;
  overflow: hidden;
  margin-bottom: 28px;
  animation: sr-fade-up 0.3s ease both;
}

.sr-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--sr-border, rgba(255,255,255,0.07));
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}
.sr-form-header:hover {
  background: var(--sr-hover, rgba(255,255,255,0.03));
}
.sr-form-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sr-form-header-icon {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(59,130,246,0.15);
  border: 1px solid rgba(59,130,246,0.25);
  display: grid;
  place-items: center;
  color: #60a5fa;
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}
.sr-form-header-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--sr-text, #e2e8f0);
  letter-spacing: -0.015em;
}
.sr-form-header-sub {
  font-size: 12px;
  color: var(--sr-muted, #64748b);
  margin-top: 1px;
}
.sr-form-chevron {
  color: var(--sr-muted, #64748b);
  transition: transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.1);
  flex-shrink: 0;
}
.sr-form-chevron.open { transform: rotate(180deg); }

.sr-form-body {
  padding: 22px;
  display: grid;
  gap: 18px;
  animation: sr-slide-down 0.22s ease both;
}

.sr-field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
@media (max-width: 600px) { .sr-field-grid { grid-template-columns: 1fr; } }

.sr-field { display: flex; flex-direction: column; gap: 6px; }
.sr-field-full { grid-column: 1 / -1; }

.sr-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--sr-muted, #64748b);
}
.sr-label-required::after {
  content: ' *';
  color: #ef4444;
}

.sr-input, .sr-select, .sr-textarea {
  width: 100%;
  padding: 10px 13px;
  border-radius: 10px;
  border: 1px solid var(--sr-field-border, rgba(255,255,255,0.1));
  background: var(--sr-field-bg, rgba(255,255,255,0.05));
  color: var(--sr-field-text, #e2e8f0);
  font-size: 13px;
  font-family: 'Geist', system-ui, sans-serif;
  font-weight: 500;
  outline: none;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  appearance: none;
  -webkit-appearance: none;
}
.sr-input::placeholder, .sr-textarea::placeholder { color: var(--sr-muted, #475569); }
.sr-input:focus, .sr-select:focus, .sr-textarea:focus {
  border-color: rgba(59,130,246,0.5);
  background: var(--sr-field-bg-focus, rgba(59,130,246,0.06));
  box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
}
.sr-input.error, .sr-select.error { border-color: rgba(239,68,68,0.5); box-shadow: 0 0 0 3px rgba(239,68,68,0.1); }
.sr-textarea { resize: vertical; min-height: 100px; line-height: 1.6; }

/* Select arrow */
.sr-select-wrap { position: relative; }
.sr-select-wrap::after {
  content: '';
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 0; height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--sr-muted, #64748b);
  pointer-events: none;
}
.sr-select { padding-right: 32px; cursor: pointer; }
.sr-select option { background: #1e293b; color: #e2e8f0; }

/* Agent Picker */
.sr-picker-wrap { position: relative; }
.sr-picker-btn {
  width: 100%;
  padding: 10px 13px;
  border-radius: 10px;
  border: 1px solid var(--sr-field-border, rgba(255,255,255,0.1));
  background: var(--sr-field-bg, rgba(255,255,255,0.05));
  color: var(--sr-field-text, #e2e8f0);
  font-size: 13px;
  font-family: 'Geist', system-ui, sans-serif;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.sr-picker-btn:focus, .sr-picker-btn.open {
  border-color: rgba(59,130,246,0.5);
  background: rgba(59,130,246,0.06);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
  outline: none;
}
.sr-picker-btn-text { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sr-picker-btn-placeholder { color: var(--sr-muted, #475569); }
.sr-picker-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0; right: 0;
  border-radius: 12px;
  border: 1px solid var(--sr-border, rgba(255,255,255,0.1));
  background: var(--sr-dropdown-bg, #1a2035);
  box-shadow: 0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);
  z-index: 100;
  overflow: hidden;
  animation: sr-slide-down 0.18s ease both;
}
.sr-picker-search-wrap { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.sr-picker-list { max-height: 240px; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 2px; }
.sr-picker-option {
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--sr-field-text, #e2e8f0);
  font-size: 12.5px;
  font-family: 'Geist', system-ui, sans-serif;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  width: 100%;
  transition: background 0.1s ease, border-color 0.1s ease;
}
.sr-picker-option:hover { background: rgba(255,255,255,0.06); }
.sr-picker-option.selected {
  background: rgba(59,130,246,0.15);
  border-color: rgba(59,130,246,0.3);
  color: #93c5fd;
}
.sr-picker-empty {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: var(--sr-muted, #64748b);
}

/* Agent info card */
.sr-agent-card {
  padding: 13px 15px;
  border-radius: 10px;
  background: var(--sr-field-bg, rgba(255,255,255,0.04));
  border: 1px solid var(--sr-field-border, rgba(255,255,255,0.08));
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}
.sr-agent-field { display: flex; flex-direction: column; gap: 2px; }
.sr-agent-field-label { font-size: 10px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--sr-muted, #64748b); }
.sr-agent-field-value { font-size: 13px; font-weight: 500; color: var(--sr-text, #e2e8f0); font-family: 'Geist Mono', monospace; }

/* Priority selector */
.sr-priority-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.sr-priority-option {
  padding: 9px 6px;
  border-radius: 9px;
  border: 1.5px solid transparent;
  background: rgba(255,255,255,0.04);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  transition: all 0.15s ease;
  font-family: 'Geist', system-ui, sans-serif;
}
.sr-priority-option:hover { background: rgba(255,255,255,0.07); }
.sr-priority-dot { width: 8px; height: 8px; border-radius: 50%; }
.sr-priority-label { font-size: 11px; font-weight: 600; letter-spacing: 0.03em; }

/* Form actions */
.sr-form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  flex-wrap: wrap;
  gap: 10px;
}
.sr-scope-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 7px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  font-size: 11px;
  color: var(--sr-muted, #64748b);
  font-weight: 500;
}
.sr-scope-badge strong { color: var(--sr-text, #cbd5e1); font-weight: 600; }

/* Buttons */
.sr-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 9px;
  border: 1px solid transparent;
  font-family: 'Geist', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  flex-shrink: 0;
}
.sr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sr-btn-primary {
  background: #2563eb;
  color: #fff;
  border-color: #1d4ed8;
  box-shadow: 0 1px 3px rgba(37,99,235,0.3), 0 0 0 1px rgba(37,99,235,0.2) inset;
}
.sr-btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
  box-shadow: 0 4px 12px rgba(37,99,235,0.4), 0 0 0 1px rgba(37,99,235,0.3) inset;
}
.sr-btn-secondary {
  background: rgba(255,255,255,0.06);
  color: var(--sr-text, #e2e8f0);
  border-color: rgba(255,255,255,0.1);
}
.sr-btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.15); }
.sr-btn-ghost {
  background: transparent;
  color: var(--sr-muted, #64748b);
  border-color: transparent;
  padding-left: 8px;
  padding-right: 8px;
}
.sr-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.06); color: var(--sr-text, #e2e8f0); }
.sr-btn-sm { padding: 6px 11px; font-size: 12px; border-radius: 7px; gap: 4px; }
.sr-btn-danger { background: rgba(239,68,68,0.12); color: #fca5a5; border-color: rgba(239,68,68,0.25); }
.sr-btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.2); }
.sr-btn-success { background: rgba(16,185,129,0.12); color: #6ee7b7; border-color: rgba(16,185,129,0.25); }
.sr-btn-success:hover:not(:disabled) { background: rgba(16,185,129,0.2); }

/* Spinner inside button */
.sr-spinner {
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: sr-spin 0.7s linear infinite;
  flex-shrink: 0;
}

/* ── Toolbar ── */
.sr-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.sr-toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.sr-toolbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.sr-search-wrap { position: relative; flex: 1; max-width: 320px; }
.sr-search-icon {
  position: absolute;
  left: 11px; top: 50%;
  transform: translateY(-50%);
  color: var(--sr-muted, #64748b);
  pointer-events: none;
  width: 14px; height: 14px;
}
.sr-search-input {
  width: 100%;
  padding: 9px 13px 9px 32px;
  border-radius: 10px;
  border: 1px solid var(--sr-field-border, rgba(255,255,255,0.09));
  background: var(--sr-field-bg, rgba(255,255,255,0.04));
  color: var(--sr-field-text, #e2e8f0);
  font-size: 13px;
  font-family: 'Geist', system-ui, sans-serif;
  font-weight: 400;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.sr-search-input::placeholder { color: var(--sr-muted, #475569); }
.sr-search-input:focus {
  border-color: rgba(59,130,246,0.4);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}

/* Status filter tabs */
.sr-status-tabs { display: flex; align-items: center; gap: 4px; }
.sr-status-tab {
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--sr-muted, #64748b);
  font-size: 12px;
  font-weight: 600;
  font-family: 'Geist', system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 5px;
}
.sr-status-tab:hover { background: rgba(255,255,255,0.05); color: var(--sr-text, #e2e8f0); }
.sr-status-tab.active {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.12);
  color: var(--sr-text, #e2e8f0);
}
.sr-status-tab-count {
  font-size: 10px;
  font-weight: 700;
  font-family: 'Geist Mono', monospace;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 1px 5px;
  min-width: 18px;
  text-align: center;
}
.sr-status-tab.active .sr-status-tab-count { background: rgba(255,255,255,0.15); }

/* ── Results count ── */
.sr-results-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--sr-muted, #64748b);
  font-weight: 500;
}
.sr-results-count {
  font-family: 'Geist Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 5px;
  padding: 2px 7px;
  color: var(--sr-text, #e2e8f0);
}

/* ── Request Cards ── */
.sr-cards { display: flex; flex-direction: column; gap: 8px; }

.sr-card {
  border-radius: 14px;
  border: 1px solid var(--sr-border, rgba(255,255,255,0.07));
  background: var(--sr-card-bg, rgba(255,255,255,0.03));
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  animation: sr-fade-up 0.25s ease both;
}
.sr-card:hover {
  border-color: var(--sr-border-hover, rgba(255,255,255,0.12));
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.sr-card-main {
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
}
.sr-card-main:hover .sr-card-toggle { opacity: 1; }

.sr-card-priority-bar {
  width: 3px;
  border-radius: 2px;
  align-self: stretch;
  flex-shrink: 0;
  min-height: 40px;
}

.sr-card-content { flex: 1; min-width: 0; display: grid; gap: 4px; }
.sr-card-ref {
  font-size: 13px;
  font-weight: 700;
  color: var(--sr-text, #e2e8f0);
  letter-spacing: -0.01em;
  font-family: 'Geist Mono', monospace;
}
.sr-card-meta {
  font-size: 12px;
  color: var(--sr-muted, #64748b);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sr-card-note-preview {
  font-size: 11.5px;
  color: var(--sr-subtle, #475569);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.sr-card-badges { display: flex; align-items: center; gap: 6px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
.sr-card-toggle {
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.2s ease;
  flex-shrink: 0;
  color: var(--sr-muted, #64748b);
}
.sr-card-toggle.open { opacity: 1; transform: rotate(180deg); }

/* Badges */
.sr-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  border: 1px solid transparent;
}
.sr-badge-dot { width: 5px; height: 5px; border-radius: 50%; }

/* ── Card Detail ── */
.sr-card-detail {
  padding: 0 16px 16px;
  border-top: 1px solid var(--sr-border, rgba(255,255,255,0.06));
  margin-top: 0;
  animation: sr-slide-down 0.2s ease both;
  padding-top: 14px;
}
.sr-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.sr-detail-field { display: flex; flex-direction: column; gap: 3px; }
.sr-detail-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--sr-muted, #64748b);
}
.sr-detail-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--sr-text, #e2e8f0);
}
.sr-detail-value-mono { font-family: 'Geist Mono', monospace; font-size: 12px; }

.sr-note-block {
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--sr-field-bg, rgba(255,255,255,0.03));
  border: 1px solid var(--sr-border, rgba(255,255,255,0.07));
  margin-bottom: 14px;
}
.sr-note-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #60a5fa;
  margin-bottom: 7px;
}
.sr-note-text { font-size: 13px; color: var(--sr-text, #e2e8f0); line-height: 1.65; }

.sr-status-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.sr-status-action-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--sr-muted, #64748b);
  margin-right: 4px;
}
.sr-status-btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 600;
  font-family: 'Geist', system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 5px;
}
.sr-status-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sr-status-btn.current { opacity: 0.5; cursor: default; }

/* ── Empty State ── */
.sr-empty {
  padding: 56px 24px;
  text-align: center;
  animation: sr-fade-in 0.4s ease both;
}
.sr-empty-icon {
  width: 52px; height: 52px;
  border-radius: 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  display: grid;
  place-items: center;
  margin: 0 auto 16px;
  color: var(--sr-muted, #64748b);
}
.sr-empty-title { font-size: 15px; font-weight: 700; color: var(--sr-text, #e2e8f0); margin-bottom: 6px; letter-spacing: -0.01em; }
.sr-empty-sub { font-size: 13px; color: var(--sr-muted, #64748b); }

/* ── Banner ── */
.sr-banner {
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sr-banner-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; }
.sr-banner-warning { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); color: #fcd34d; }

/* ── Loading skeleton ── */
.sr-skeleton {
  border-radius: 14px;
  background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%);
  background-size: 200% 100%;
  animation: sr-shimmer 1.5s ease infinite;
}

/* ── Header ── */
.sr-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  animation: sr-fade-up 0.3s ease both;
}
.sr-page-eyebrow {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #60a5fa;
  margin-bottom: 5px;
}
.sr-page-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--sr-text, #e2e8f0);
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin: 0;
}
.sr-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

/* Divider */
.sr-divider {
  height: 1px;
  background: var(--sr-border, rgba(255,255,255,0.07));
  margin: 18px 0;
}

/* Scrollbar */
.sr-root * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent; }
.sr-root *::-webkit-scrollbar { width: 4px; }
.sr-root *::-webkit-scrollbar-track { background: transparent; }
.sr-root *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
`;

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const Icon = {
  Plus: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  ChevronDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.55"/>
    </svg>
  ),
  Alert: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  Inbox: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  Check: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  User: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className="sr-badge"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      <span className="sr-badge-dot" style={{ background: cfg.dot }} />
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="sr-badge"
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
    >
      {status}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function SupervisorRequestsSupabase({ currentUser = null }: SupervisorRequestsSupabaseProps) {
  // ── Style injection ────────────────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById(INJECTED_STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = INJECTED_STYLE_ID;
    el.textContent = STYLES;
    document.head.appendChild(el);
    return () => { document.getElementById(INJECTED_STYLE_ID)?.remove(); };
  }, []);

  // ── State ──────────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<SupervisorRequest[]>([]);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<CurrentUser | null>(currentUser);
  const [loading, setLoading] = useState(true);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [agentLoadError, setAgentLoadError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  // Form fields
  const [caseReference, setCaseReference] = useState('');
  const [selectedAgentProfileId, setSelectedAgentProfileId] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [caseType, setCaseType] = useState('');
  const [supervisorName, setSupervisorName] = useState(
    currentUser?.display_name || currentUser?.agent_name || ''
  );
  const [priority, setPriority] = useState<Priority>('Medium');
  const [requestNote, setRequestNote] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  const agentPickerRef = useRef<HTMLDivElement>(null);

  // ── Derived permissions ───────────────────────────────────────────────────
  const viewerProfile = currentUser ?? currentProfile;
  const isAdmin = viewerProfile?.role === 'admin';
  const isQA = viewerProfile?.role === 'qa';
  const isSupervisor = viewerProfile?.role === 'supervisor';
  const canView = isAdmin || isQA || isSupervisor;
  const canCreate = isAdmin || isSupervisor;
  const canUpdateStatus = isAdmin || isQA;
  const scopedTeam = isSupervisor ? viewerProfile?.team || null : null;

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (currentUser) {
      setCurrentProfile(currentUser);
      setSupervisorName(currentUser.display_name || currentUser.agent_name);
    }
    void loadAll();
  }, [currentUser?.id, currentUser?.role, currentUser?.team]);

  // Outside click for agent picker
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (agentPickerRef.current && !agentPickerRef.current.contains(e.target as Node)) {
        setIsAgentPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function loadAll() {
    setLoading(true);
    setErrorMessage('');

    let profile = currentUser;

    if (!profile) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) { setLoading(false); setErrorMessage(authError.message); return; }
      const userId = authData.user?.id;
      if (!userId) { setLoading(false); setErrorMessage('Could not identify the logged-in user.'); return; }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, agent_name, display_name, team, email')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) { setLoading(false); setErrorMessage(profileError.message); return; }
      if (!profileData) { setLoading(false); setErrorMessage('Could not load current profile.'); return; }

      profile = profileData as CurrentUser;
      setCurrentProfile(profile);
      setSupervisorName(profile.display_name || profile.agent_name);
    }

    if (!profile || !['admin', 'qa', 'supervisor'].includes(profile.role)) {
      setLoading(false);
      setErrorMessage('You do not have permission to view requests.');
      return;
    }

    await Promise.all([loadRequests(profile), loadAgents(profile)]);
    setLoading(false);
  }

  async function loadRequests(profile: CurrentUser) {
    let query = supabase.from('supervisor_requests').select('*').order('created_at', { ascending: false });
    if (profile.role === 'supervisor' && profile.team) query = query.eq('team', profile.team);
    const { data, error } = await query;
    if (error) { setErrorMessage(error.message); return; }
    setRequests((data as SupervisorRequest[]) || []);
  }

  async function loadAgents(profile: CurrentUser) {
    setLoadingAgents(true);
    setAgentLoadError('');
    let query = supabase.from('profiles')
      .select('id, role, agent_id, agent_name, display_name, team')
      .eq('role', 'agent').not('agent_id', 'is', null).order('agent_name', { ascending: true });
    if (profile.role === 'supervisor' && profile.team) query = query.eq('team', profile.team);
    const { data, error } = await query;
    setLoadingAgents(false);
    if (error) { setAgentLoadError(error.message); setAgentProfiles([]); return; }
    setAgentProfiles((data as AgentProfile[]) || []);
  }

  const handleRefresh = useCallback(async () => {
    if (!viewerProfile) return;
    setLoading(true);
    setErrorMessage('');
    await loadRequests(viewerProfile);
    setLoading(false);
  }, [viewerProfile]);

  const handleRefreshAgents = useCallback(async () => {
    if (!viewerProfile) return;
    await loadAgents(viewerProfile);
  }, [viewerProfile]);

  // ── Agent picker helpers ──────────────────────────────────────────────────
  const selectedAgent = agentProfiles.find(p => p.id === selectedAgentProfileId) || null;

  function getAgentLabel(p: AgentProfile) {
    return p.display_name ? `${p.agent_name} — ${p.display_name}` : `${p.agent_name} — ${p.agent_id}`;
  }

  function getRequestDisplayName(r: SupervisorRequest) {
    const m = agentProfiles.find(p =>
      p.agent_id === (r.agent_id || null) &&
      p.agent_name === (r.agent_name || '') &&
      p.team === (r.team || null)
    );
    return m?.display_name || r.display_name || '—';
  }

  const visibleAgents = useMemo(() => {
    const s = agentSearch.trim().toLowerCase();
    if (!s) return agentProfiles;
    return agentProfiles.filter(p =>
      p.agent_name.toLowerCase().includes(s) ||
      (p.agent_id || '').toLowerCase().includes(s) ||
      (p.display_name || '').toLowerCase().includes(s)
    );
  }, [agentProfiles, agentSearch]);

  function handleSelectAgent(p: AgentProfile) {
    setSelectedAgentProfileId(p.id);
    setAgentSearch(getAgentLabel(p));
    setIsAgentPickerOpen(false);
    setFormErrors(e => ({ ...e, agent: false }));
  }

  // ── Filtered requests ─────────────────────────────────────────────────────
  const filteredRequests = useMemo(() => {
    const s = searchText.trim().toLowerCase();
    return requests.filter(r => {
      const dn = getRequestDisplayName(r).toLowerCase();
      const matchesSearch = !s ||
        (r.case_reference || '').toLowerCase().includes(s) ||
        (r.agent_name || '').toLowerCase().includes(s) ||
        (r.agent_id || '').toLowerCase().includes(s) ||
        dn.includes(s) ||
        (r.case_type || '').toLowerCase().includes(s) ||
        (r.supervisor_name || '').toLowerCase().includes(s) ||
        (r.request_note || '').toLowerCase().includes(s);
      const matchesStatus = statusFilter ? r.status === statusFilter : true;
      return matchesSearch && matchesStatus;
    });
  }, [requests, searchText, statusFilter, agentProfiles]);

  // Stats
  const stats = useMemo(() => ({
    total: requests.length,
    open: requests.filter(r => r.status === 'Open').length,
    underReview: requests.filter(r => r.status === 'Under Review').length,
    closed: requests.filter(r => r.status === 'Closed').length,
  }), [requests]);


  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!viewerProfile || !canCreate) return;

    const errors: Record<string, boolean> = {};
    if (!caseReference.trim()) errors.caseReference = true;
    if (!caseType) errors.caseType = true;
    if (!requestNote.trim()) errors.requestNote = true;
    if (!supervisorName.trim()) errors.supervisorName = true;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (isSupervisor && viewerProfile.team && selectedAgent?.team && selectedAgent.team !== viewerProfile.team) {
      alert('Supervisors can only create requests for their own team.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('supervisor_requests').insert({
      case_reference: caseReference.trim(),
      agent_id: selectedAgent?.agent_id || null,
      agent_name: selectedAgent?.agent_name || null,
      display_name: selectedAgent?.display_name || null,
      team: selectedAgent?.team || viewerProfile.team || null,
      case_type: caseType,
      supervisor_name: supervisorName.trim(),
      priority,
      request_note: requestNote.trim(),
      status: 'Open',
    });
    setSaving(false);

    if (error) { alert(error.message); return; }

    // Reset form
    setCaseReference('');
    setSelectedAgentProfileId('');
    setAgentSearch('');
    setCaseType('');
    setPriority('Medium');
    setRequestNote('');
    setFormErrors({});
    setFormOpen(false);

    await handleRefresh();
  }

  // ── Status update ─────────────────────────────────────────────────────────
  async function handleStatusChange(requestId: string, nextStatus: Status) {
    if (!canUpdateStatus) return;
    setStatusSavingId(requestId);
    const { error } = await supabase.from('supervisor_requests').update({ status: nextStatus }).eq('id', requestId);
    setStatusSavingId(null);
    if (error) { alert(error.message); return; }
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: nextStatus } : r));
  }

  function formatDate(d?: string | null) {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!loading && !canView) {
    return (
      <div className="sr-root">
        <div className="sr-banner sr-banner-error">
          <Icon.Alert /> You do not have permission to view Supervisor Requests.
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="sr-root" data-no-theme-invert="true">

      {/* Page header */}
      <div className="sr-page-header">
        <div>
          <div className="sr-page-eyebrow">Queue Management</div>
          <h2 className="sr-page-title">Supervisor Requests</h2>
        </div>
        <div className="sr-header-actions">
          <button
            className="sr-btn sr-btn-secondary sr-btn-sm"
            onClick={() => void handleRefreshAgents()}
            disabled={loadingAgents}
            title="Refresh agent list"
          >
            <span style={loadingAgents ? { animation: 'sr-spin 0.7s linear infinite', display: 'inline-block' } : {}}>
              <Icon.Refresh />
            </span>
            {loadingAgents ? 'Agents…' : 'Agents'}
          </button>
          <button
            className="sr-btn sr-btn-secondary sr-btn-sm"
            onClick={() => void handleRefresh()}
            disabled={loading}
          >
            <span style={loading ? { animation: 'sr-spin 0.7s linear infinite', display: 'inline-block' } : {}}>
              <Icon.Refresh />
            </span>
            Refresh
          </button>
          {canCreate && (
            <button
              className="sr-btn sr-btn-primary sr-btn-sm"
              onClick={() => setFormOpen(o => !o)}
            >
              <Icon.Plus />
              New Request
            </button>
          )}
        </div>
      </div>

      {/* Banners */}
      {errorMessage && (
        <div className="sr-banner sr-banner-error"><Icon.Alert /> {errorMessage}</div>
      )}
      {agentLoadError && (
        <div className="sr-banner sr-banner-warning"><Icon.Alert /> {agentLoadError}</div>
      )}

      {/* Stats */}
      {!loading && (
        <div className="sr-stats-row">
          {([
            { label: 'Total', value: stats.total, accent: '#60a5fa', sub: 'all requests' },
            { label: 'Open', value: stats.open, accent: STATUS_CONFIG['Open'].color, sub: 'awaiting action' },
            { label: 'Under Review', value: stats.underReview, accent: STATUS_CONFIG['Under Review'].color, sub: 'in progress' },
            { label: 'Closed', value: stats.closed, accent: STATUS_CONFIG['Closed'].color, sub: 'resolved' },
          ] as const).map(({ label, value, accent, sub }) => (
            <div
              key={label}
              className="sr-stat-card"
              style={{ '--sr-stat-accent': accent } as React.CSSProperties}
              onClick={() => setStatusFilter(prev => prev === label && label !== 'Total' ? '' : label === 'Total' ? '' : label as Status)}
            >
              <div className="sr-stat-label">{label}</div>
              <div className="sr-stat-value">{value.toString().padStart(2, '0')}</div>
              <div className="sr-stat-sub">{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {canCreate && (
        <div className="sr-form-panel">
          <div className="sr-form-header" onClick={() => setFormOpen(o => !o)} role="button" tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && setFormOpen(o => !o)}>
            <div className="sr-form-header-left">
              <div className="sr-form-header-icon">+</div>
              <div>
                <div className="sr-form-header-title">Create Request</div>
                <div className="sr-form-header-sub">
                  {scopedTeam ? `Scoped to ${scopedTeam} team` : 'All teams'} · {agentProfiles.length} agents loaded
                </div>
              </div>
            </div>
            <span className={`sr-form-chevron${formOpen ? ' open' : ''}`}>
              <Icon.ChevronDown />
            </span>
          </div>

          {formOpen && (
            <div className="sr-form-body">
              <div className="sr-field-grid">

                {/* Case Reference */}
                <div className="sr-field">
                  <label className="sr-label sr-label-required">Case Reference</label>
                  <input
                    type="text"
                    className={`sr-input${formErrors.caseReference ? ' error' : ''}`}
                    value={caseReference}
                    onChange={e => { setCaseReference(e.target.value); setFormErrors(f => ({ ...f, caseReference: false })); }}
                    placeholder="e.g. CASE-10042"
                  />
                </div>

                {/* Agent picker */}
                <div className="sr-field">
                  <label className="sr-label">Agent</label>
                  <div className="sr-picker-wrap" ref={agentPickerRef}>
                    <button
                      type="button"
                      className={`sr-picker-btn${isAgentPickerOpen ? ' open' : ''}`}
                      onClick={() => setIsAgentPickerOpen(o => !o)}
                    >
                      <span className={`sr-picker-btn-text${!selectedAgent ? ' sr-picker-btn-placeholder' : ''}`}>
                        {selectedAgent ? getAgentLabel(selectedAgent) : 'Select agent (optional)'}
                      </span>
                      <Icon.ChevronDown />
                    </button>
                    {isAgentPickerOpen && (
                      <div className="sr-picker-dropdown">
                        <div className="sr-picker-search-wrap">
                          <input
                            className="sr-input"
                            value={agentSearch}
                            onChange={e => setAgentSearch(e.target.value)}
                            placeholder="Search name, ID, display name…"
                            autoFocus
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                        <div className="sr-picker-list">
                          {loadingAgents ? (
                            <div className="sr-picker-empty">Loading agents…</div>
                          ) : visibleAgents.length === 0 ? (
                            <div className="sr-picker-empty">No agents found</div>
                          ) : visibleAgents.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              className={`sr-picker-option${selectedAgentProfileId === p.id ? ' selected' : ''}`}
                              onClick={() => handleSelectAgent(p)}
                            >
                              {selectedAgentProfileId === p.id && <><Icon.Check /> </>}
                              {getAgentLabel(p)}
                              {p.team && <span style={{ color: '#64748b', marginLeft: 4 }}>· {p.team}</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Agent info card */}
                <div className="sr-field" style={{ gridColumn: '1 / -1' }}>
                  <div className="sr-agent-card">
                    {[
                      { label: 'Agent ID', value: selectedAgent?.agent_id || '—' },
                      { label: 'Name', value: selectedAgent?.agent_name || '—' },
                      { label: 'Display Name', value: selectedAgent?.display_name || '—' },
                      { label: 'Team', value: selectedAgent?.team || viewerProfile?.team || '—' },
                    ].map(f => (
                      <div key={f.label} className="sr-agent-field">
                        <div className="sr-agent-field-label">{f.label}</div>
                        <div className="sr-agent-field-value">{f.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Case Type */}
                <div className="sr-field">
                  <label className="sr-label sr-label-required">Case Type</label>
                  <div className="sr-select-wrap">
                    <select
                      className={`sr-select${formErrors.caseType ? ' error' : ''}`}
                      value={caseType}
                      onChange={e => { setCaseType(e.target.value); setFormErrors(f => ({ ...f, caseType: false })); }}
                    >
                      <option value="">Select case type…</option>
                      {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Requester */}
                <div className="sr-field">
                  <label className="sr-label sr-label-required">Requester Name</label>
                  <input
                    type="text"
                    className={`sr-input${formErrors.supervisorName ? ' error' : ''}`}
                    value={supervisorName}
                    onChange={e => { setSupervisorName(e.target.value); setFormErrors(f => ({ ...f, supervisorName: false })); }}
                    readOnly={isSupervisor}
                    style={{ opacity: isSupervisor ? 0.75 : 1 }}
                  />
                </div>

                {/* Priority */}
                <div className="sr-field sr-field-full">
                  <label className="sr-label">Priority</label>
                  <div className="sr-priority-row">
                    {(['Low', 'Medium', 'High', 'Urgent'] as Priority[]).map(p => {
                      const cfg = PRIORITY_CONFIG[p];
                      const isSelected = priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          className="sr-priority-option"
                          onClick={() => setPriority(p)}
                          style={{
                            borderColor: isSelected ? cfg.border : 'transparent',
                            background: isSelected ? cfg.bg : 'rgba(255,255,255,0.04)',
                            color: isSelected ? cfg.color : '#64748b',
                          }}
                        >
                          <span className="sr-priority-dot" style={{ background: cfg.dot }} />
                          <span className="sr-priority-label">{p}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Request Note */}
                <div className="sr-field sr-field-full">
                  <label className="sr-label sr-label-required">Request Note</label>
                  <textarea
                    className={`sr-textarea${formErrors.requestNote ? ' error' : ''}`}
                    value={requestNote}
                    onChange={e => { setRequestNote(e.target.value); setFormErrors(f => ({ ...f, requestNote: false })); }}
                    placeholder="Describe the issue, context, and what you need from QA…"
                    rows={4}
                  />
                </div>
              </div>

              {/* Form actions */}
              <div className="sr-form-actions">
                <div className="sr-scope-badge">
                  <Icon.User />
                  Role: <strong>{viewerProfile?.role || '—'}</strong>
                  &nbsp;·&nbsp;
                  Team: <strong>{scopedTeam || 'All'}</strong>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="sr-btn sr-btn-ghost"
                    onClick={() => { setFormOpen(false); setFormErrors({}); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="sr-btn sr-btn-primary"
                    onClick={() => void handleCreate()}
                    disabled={saving}
                  >
                    {saving ? <><span className="sr-spinner" /> Saving…</> : <><Icon.Plus /> Create Request</>}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="sr-toolbar">
        <div className="sr-toolbar-left">
          <div className="sr-search-wrap">
            <span className="sr-search-icon"><Icon.Search /></span>
            <input
              className="sr-search-input"
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search cases, agents, notes…"
            />
          </div>
        </div>
        <div className="sr-status-tabs">
          {([
            { value: '', label: 'All' },
            { value: 'Open', label: 'Open' },
            { value: 'Under Review', label: 'Review' },
            { value: 'Closed', label: 'Closed' },
          ] as const).map(tab => (
            <button
              key={tab.value}
              className={`sr-status-tab${statusFilter === tab.value ? ' active' : ''}`}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
              <span className="sr-status-tab-count">
                {tab.value === ''
                  ? requests.length
                  : requests.filter(r => r.status === tab.value).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Results meta */}
      <div className="sr-results-meta">
        <span className="sr-results-count">{filteredRequests.length}</span>
        {filteredRequests.length === 1 ? 'request' : 'requests'}
        {(searchText || statusFilter) && ' matching filters'}
      </div>

      {/* Request list */}
      {loading ? (
        <div className="sr-cards">
          {[1, 2, 3].map(i => (
            <div key={i} className="sr-skeleton" style={{ height: 70, animationDelay: `${i * 0.08}s` }} />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="sr-empty">
          <div className="sr-empty-icon"><Icon.Inbox /></div>
          <div className="sr-empty-title">No requests found</div>
          <div className="sr-empty-sub">
            {searchText || statusFilter
              ? 'Try adjusting your search or filters'
              : 'No supervisor requests yet'}
          </div>
        </div>
      ) : (
        <div className="sr-cards">
          {filteredRequests.map((request, idx) => {
            const isExpanded = expandedId === request.id;
            const pCfg = PRIORITY_CONFIG[request.priority];
            const isSaving = statusSavingId === request.id;

            return (
              <div
                key={request.id}
                className="sr-card"
                style={{ animationDelay: `${Math.min(idx * 0.04, 0.3)}s` }}
              >
                {/* Card main row */}
                <div className="sr-card-main" onClick={() => setExpandedId(prev => prev === request.id ? null : request.id)}>
                  {/* Priority bar */}
                  <div className="sr-card-priority-bar" style={{ background: pCfg.dot }} />

                  {/* Content */}
                  <div className="sr-card-content">
                    <div className="sr-card-ref">#{request.case_reference}</div>
                    <div className="sr-card-meta">
                      {request.agent_name || '—'}
                      {getRequestDisplayName(request) !== '—' && ` · ${getRequestDisplayName(request)}`}
                      {request.team && ` · ${request.team}`}
                      {` · ${request.case_type}`}
                    </div>
                    {request.request_note && (
                      <div className="sr-card-note-preview">{request.request_note}</div>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="sr-card-badges">
                    <PriorityBadge priority={request.priority} />
                    <StatusBadge status={request.status} />
                    <span className={`sr-card-toggle${isExpanded ? ' open' : ''}`}>
                      <Icon.ChevronDown />
                    </span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="sr-card-detail">
                    <div className="sr-detail-grid">
                      {[
                        { label: 'Agent ID', value: request.agent_id || '—', mono: true },
                        { label: 'Agent Name', value: request.agent_name || '—' },
                        { label: 'Display Name', value: getRequestDisplayName(request) },
                        { label: 'Team', value: request.team || '—' },
                        { label: 'Case Type', value: request.case_type },
                        { label: 'Requester', value: request.supervisor_name },
                        { label: 'Created', value: formatDate(request.created_at) },
                        { label: 'Status', value: request.status },
                      ].map(f => (
                        <div key={f.label} className="sr-detail-field">
                          <div className="sr-detail-label">{f.label}</div>
                          <div className={`sr-detail-value${f.mono ? ' sr-detail-value-mono' : ''}`}>{f.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Note */}
                    <div className="sr-note-block">
                      <div className="sr-note-label">Request Note</div>
                      <div className="sr-note-text">{request.request_note || '—'}</div>
                    </div>

                    {/* Status actions */}
                    {canUpdateStatus && (
                      <div className="sr-status-actions">
                        <span className="sr-status-action-label">Move to:</span>
                        {(['Open', 'Under Review', 'Closed'] as Status[]).map(s => {
                          const sCfg = STATUS_CONFIG[s];
                          const isCurrent = request.status === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              className={`sr-status-btn${isCurrent ? ' current' : ''}`}
                              disabled={isSaving || isCurrent}
                              onClick={() => void handleStatusChange(request.id, s)}
                              style={{
                                color: sCfg.color,
                                background: sCfg.bg,
                                borderColor: sCfg.border,
                                opacity: isCurrent ? 0.4 : undefined,
                              }}
                            >
                              {isSaving && !isCurrent ? <span className="sr-spinner" style={{ borderTopColor: sCfg.color, borderColor: `${sCfg.color}40` }} /> : null}
                              {isCurrent && <Icon.Check />}
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SupervisorRequestsSupabase;
