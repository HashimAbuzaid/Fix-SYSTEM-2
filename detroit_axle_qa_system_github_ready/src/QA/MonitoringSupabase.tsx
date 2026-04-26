import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
} from 'react';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type MonitoringStatus = 'active' | 'resolved';

type AgentProfile = {
  id: string;
  role: 'agent';
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: 'Calls' | 'Tickets' | 'Sales' | null;
};

type CurrentProfile = {
  id: string;
  role: 'admin' | 'qa' | 'agent' | 'supervisor';
  agent_name: string;
  display_name: string | null;
  team: 'Calls' | 'Tickets' | 'Sales' | null;
  email: string;
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
  status: MonitoringStatus;
  acknowledged_by_agent: boolean;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolved_by_email: string | null;
};

// ─────────────────────────────────────────────────────────────
// CSS — injected once
// ─────────────────────────────────────────────────────────────

const STYLE_ID = 'da-monitoring-v2';
const MONITORING_CSS = `
  .mon-shell { font-family: var(--font-sans, 'Geist', system-ui, sans-serif); }

  /* ── Page header ── */
  .mon-page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 28px;
    flex-wrap: wrap;
  }
  .mon-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent-blue, #3b82f6);
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mon-eyebrow-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent-blue, #3b82f6);
    animation: mon-pulse 2s ease-in-out infinite;
  }
  @keyframes mon-pulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50%       { opacity: 1;   transform: scale(1.3); }
  }
  .mon-headline {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--fg-default, #f1f5f9);
    margin: 0 0 4px;
    line-height: 1.2;
  }
  .mon-subline {
    font-size: 13px;
    color: var(--fg-muted, #64748b);
    margin: 0;
    line-height: 1.5;
  }
  .mon-header-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

  /* ── Stats strip ── */
  .mon-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
    margin-bottom: 22px;
  }
  .mon-stat-card {
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-elevated, #111118);
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: border-color 160ms ease;
  }
  .mon-stat-card:hover { border-color: var(--border-strong, rgba(255,255,255,0.12)); }
  .mon-stat-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--fg-muted, #64748b);
  }
  .mon-stat-value {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--fg-default, #f1f5f9);
    line-height: 1;
  }
  .mon-stat-sub { font-size: 11px; color: var(--fg-muted, #64748b); }

  /* ── Panel ── */
  .mon-panel {
    background: var(--bg-elevated, #111118);
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    border-radius: 16px;
    overflow: hidden;
  }
  .mon-panel-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
  }
  .mon-panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--fg-default, #f1f5f9);
    letter-spacing: -0.01em;
    flex: 1;
  }
  .mon-panel-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 999px;
    letter-spacing: 0.04em;
  }
  .mon-panel-body { padding: 20px; }

  /* ── Form grid ── */
  .mon-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  @media (max-width: 600px) { .mon-form-grid { grid-template-columns: 1fr; } }
  .mon-full { grid-column: 1 / -1; }

  /* ── Field ── */
  .mon-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-muted, #64748b);
    margin-bottom: 7px;
  }
  .mon-field {
    width: 100%;
    padding: 10px 13px;
    border-radius: 10px;
    border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
    background: var(--bg-subtle, rgba(255,255,255,0.04));
    color: var(--fg-default, #f1f5f9);
    font-size: 13px;
    font-family: inherit;
    font-weight: 400;
    outline: none;
    transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
    box-sizing: border-box;
    line-height: 1.5;
  }
  .mon-field:focus {
    border-color: var(--accent-blue, #3b82f6);
    background: color-mix(in srgb, var(--accent-blue, #3b82f6) 5%, var(--bg-subtle, rgba(255,255,255,0.04)));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-blue, #3b82f6) 12%, transparent);
  }
  .mon-field::placeholder { color: var(--fg-muted, #64748b); }
  textarea.mon-field { resize: vertical; min-height: 90px; }

  /* ── Agent picker ── */
  .mon-picker-wrap { position: relative; }
  .mon-picker-btn {
    width: 100%;
    padding: 10px 13px;
    border-radius: 10px;
    border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
    background: var(--bg-subtle, rgba(255,255,255,0.04));
    color: var(--fg-default, #f1f5f9);
    font-size: 13px;
    font-family: inherit;
    font-weight: 400;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    text-align: left;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }
  .mon-picker-btn:focus, .mon-picker-btn[data-open="true"] {
    border-color: var(--accent-blue, #3b82f6);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-blue, #3b82f6) 12%, transparent);
    outline: none;
  }
  .mon-picker-btn-placeholder { color: var(--fg-muted, #64748b); }
  .mon-picker-chevron {
    flex-shrink: 0;
    color: var(--fg-muted, #64748b);
    transition: transform 200ms ease;
  }
  .mon-picker-btn[data-open="true"] .mon-picker-chevron { transform: rotate(180deg); }
  .mon-picker-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0; right: 0;
    background: var(--bg-overlay, #16161f);
    border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
    border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03);
    z-index: 50;
    overflow: hidden;
    animation: mon-menu-in 140ms cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes mon-menu-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }
  .mon-picker-search-wrap {
    padding: 10px;
    border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
  }
  .mon-picker-list {
    max-height: 260px;
    overflow-y: auto;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mon-picker-empty {
    padding: 14px;
    text-align: center;
    font-size: 13px;
    color: var(--fg-muted, #64748b);
  }
  .mon-picker-option {
    padding: 9px 11px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    color: var(--fg-default, #f1f5f9);
    display: flex;
    align-items: center;
    gap: 9px;
    transition: background 100ms ease, border-color 100ms ease;
  }
  .mon-picker-option:hover { background: var(--bg-subtle-hover, rgba(255,255,255,0.07)); }
  .mon-picker-option.selected {
    background: color-mix(in srgb, var(--accent-blue, #3b82f6) 10%, transparent);
    border-color: color-mix(in srgb, var(--accent-blue, #3b82f6) 20%, transparent);
    color: var(--accent-blue, #3b82f6);
    font-weight: 500;
  }
  .mon-picker-avatar {
    width: 24px; height: 24px;
    border-radius: 7px;
    display: grid;
    place-items: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
    background: color-mix(in srgb, var(--accent-blue, #3b82f6) 15%, transparent);
    color: var(--accent-blue, #3b82f6);
  }
  .mon-picker-option-label { flex: 1; min-width: 0; }
  .mon-picker-option-name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mon-picker-option-meta { font-size: 11px; color: var(--fg-muted, #64748b); margin-top: 1px; }

  /* ── Team badge ── */
  .mon-team-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 5px;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  /* ── Action row ── */
  .mon-action-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  /* ── Buttons ── */
  .mon-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid transparent;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 160ms ease;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .mon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .mon-btn-primary {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: #fff;
    border-color: rgba(96,165,250,0.2);
    box-shadow: 0 1px 3px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.1);
  }
  .mon-btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
    box-shadow: 0 4px 12px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
    transform: translateY(-1px);
  }
  .mon-btn-primary:active:not(:disabled) { transform: translateY(0); }
  .mon-btn-secondary {
    background: var(--bg-subtle, rgba(255,255,255,0.04));
    color: var(--fg-default, #f1f5f9);
    border-color: var(--border-strong, rgba(255,255,255,0.12));
  }
  .mon-btn-secondary:hover:not(:disabled) {
    background: var(--bg-subtle-hover, rgba(255,255,255,0.07));
    border-color: var(--border-strong, rgba(255,255,255,0.18));
  }
  .mon-btn-ghost {
    background: transparent;
    color: var(--fg-muted, #64748b);
    border-color: transparent;
    height: 32px;
    padding: 0 10px;
    font-size: 12px;
  }
  .mon-btn-ghost:hover:not(:disabled) {
    color: var(--fg-default, #f1f5f9);
    background: var(--bg-subtle, rgba(255,255,255,0.04));
  }
  .mon-btn-danger {
    background: color-mix(in srgb, var(--accent-rose, #f43f5e) 10%, transparent);
    color: var(--accent-rose, #f43f5e);
    border-color: color-mix(in srgb, var(--accent-rose, #f43f5e) 25%, transparent);
  }
  .mon-btn-danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--accent-rose, #f43f5e) 16%, transparent);
  }

  /* ── Filter bar ── */
  .mon-filter-bar {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 16px;
  }
  .mon-filter-group {
    display: flex;
    gap: 4px;
    background: var(--bg-subtle, rgba(255,255,255,0.04));
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    border-radius: 10px;
    padding: 3px;
  }
  .mon-filter-chip {
    height: 28px;
    padding: 0 12px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--fg-muted, #64748b);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 120ms ease;
    white-space: nowrap;
  }
  .mon-filter-chip:hover { color: var(--fg-default, #f1f5f9); }
  .mon-filter-chip.active {
    background: var(--bg-elevated, #111118);
    color: var(--fg-default, #f1f5f9);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  }
  .mon-filter-chip.active[data-accent="active"] { color: var(--accent-blue, #3b82f6); }
  .mon-filter-chip.active[data-accent="resolved"] { color: var(--accent-emerald, #10b981); }
  .mon-search-wrap {
    flex: 1;
    min-width: 200px;
    position: relative;
    display: flex;
    align-items: center;
  }
  .mon-search-icon {
    position: absolute;
    left: 11px;
    color: var(--fg-muted, #64748b);
    pointer-events: none;
    display: grid;
    place-items: center;
  }
  .mon-search-field {
    width: 100%;
    height: 36px;
    padding: 0 11px 0 34px;
    border-radius: 10px;
    border: 1px solid var(--border-strong, rgba(255,255,255,0.12));
    background: var(--bg-subtle, rgba(255,255,255,0.04));
    color: var(--fg-default, #f1f5f9);
    font-size: 13px;
    font-family: inherit;
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease;
    box-sizing: border-box;
  }
  .mon-search-field:focus {
    border-color: var(--accent-blue, #3b82f6);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-blue, #3b82f6) 12%, transparent);
  }
  .mon-search-field::placeholder { color: var(--fg-muted, #64748b); }

  /* ── Items list ── */
  .mon-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mon-item-card {
    border-radius: 14px;
    border: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-elevated, #111118);
    overflow: hidden;
    transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
    animation: mon-item-in 200ms cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes mon-item-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .mon-item-card:hover {
    border-color: var(--border-strong, rgba(255,255,255,0.12));
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  }
  .mon-item-card.resolved { opacity: 0.72; }
  .mon-item-card.resolved:hover { opacity: 1; }

  /* Side accent bar */
  .mon-item-inner {
    display: flex;
    gap: 0;
  }
  .mon-item-accent-bar {
    width: 3px;
    flex-shrink: 0;
    border-radius: 14px 0 0 14px;
  }
  .mon-item-body { flex: 1; padding: 16px 18px; min-width: 0; }

  /* Top row */
  .mon-item-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .mon-item-order {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .mon-order-number {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--fg-default, #f1f5f9);
    font-family: var(--font-mono, monospace);
  }
  .mon-item-agent {
    font-size: 12px;
    color: var(--fg-muted, #64748b);
    margin-top: 3px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .mon-item-pills { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }

  /* Status pill */
  .mon-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .mon-pill-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .mon-pill-active {
    background: color-mix(in srgb, var(--accent-blue, #3b82f6) 12%, transparent);
    color: var(--accent-blue, #3b82f6);
    border-color: color-mix(in srgb, var(--accent-blue, #3b82f6) 20%, transparent);
  }
  .mon-pill-active .mon-pill-dot {
    background: var(--accent-blue, #3b82f6);
    animation: mon-pulse 2s ease-in-out infinite;
  }
  .mon-pill-resolved {
    background: color-mix(in srgb, var(--accent-emerald, #10b981) 12%, transparent);
    color: var(--accent-emerald, #10b981);
    border-color: color-mix(in srgb, var(--accent-emerald, #10b981) 20%, transparent);
  }
  .mon-pill-resolved .mon-pill-dot { background: var(--accent-emerald, #10b981); }
  .mon-pill-ack {
    background: color-mix(in srgb, var(--accent-emerald, #10b981) 10%, transparent);
    color: var(--accent-emerald, #10b981);
    border-color: color-mix(in srgb, var(--accent-emerald, #10b981) 18%, transparent);
  }
  .mon-pill-unack {
    background: color-mix(in srgb, var(--accent-amber, #f59e0b) 10%, transparent);
    color: var(--accent-amber, #f59e0b);
    border-color: color-mix(in srgb, var(--accent-amber, #f59e0b) 20%, transparent);
  }

  /* Comment */
  .mon-comment {
    font-size: 13px;
    line-height: 1.6;
    color: var(--fg-default, #f1f5f9);
    margin-bottom: 12px;
    padding: 10px 12px;
    background: var(--bg-subtle, rgba(255,255,255,0.04));
    border-radius: 8px;
    border-left: 2px solid var(--border-strong, rgba(255,255,255,0.12));
  }

  /* Meta grid */
  .mon-item-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 6px 16px;
    padding-top: 10px;
    border-top: 1px solid var(--border, rgba(255,255,255,0.07));
  }
  .mon-meta-field {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mon-meta-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--fg-subtle, #334155);
  }
  .mon-meta-value {
    font-size: 12px;
    color: var(--fg-muted, #64748b);
    font-weight: 400;
  }
  .mon-meta-value.highlight { color: var(--fg-default, #f1f5f9); font-weight: 500; }

  /* Item footer */
  .mon-item-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 18px;
    border-top: 1px solid var(--border, rgba(255,255,255,0.07));
    background: var(--bg-subtle, rgba(255,255,255,0.02));
    flex-wrap: wrap;
  }
  .mon-item-footer-meta {
    font-size: 11px;
    color: var(--fg-muted, #64748b);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mon-item-footer-sep { opacity: 0.4; }

  /* ── Error banner ── */
  .mon-error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent-rose, #f43f5e) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-rose, #f43f5e) 22%, transparent);
    color: #fca5a5;
    font-size: 13px;
    margin-bottom: 16px;
    animation: mon-item-in 200ms ease both;
  }

  /* ── Empty state ── */
  .mon-empty {
    padding: 48px 24px;
    border-radius: 14px;
    border: 1px dashed var(--border-strong, rgba(255,255,255,0.12));
    background: var(--bg-subtle, rgba(255,255,255,0.02));
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: var(--fg-muted, #64748b);
  }
  .mon-empty-icon { font-size: 32px; margin-bottom: 4px; opacity: 0.5; }
  .mon-empty-title { font-size: 15px; font-weight: 600; color: var(--fg-default, #f1f5f9); }
  .mon-empty-sub { font-size: 13px; max-width: 300px; }

  /* ── Divider ── */
  .mon-divider {
    height: 1px;
    background: var(--border, rgba(255,255,255,0.07));
    margin: 22px 0;
  }

  /* ── Section header ── */
  .mon-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
  }
  .mon-section-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--fg-muted, #64748b);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mon-count-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    background: var(--bg-subtle, rgba(255,255,255,0.06));
    color: var(--fg-muted, #64748b);
    border: 1px solid var(--border, rgba(255,255,255,0.07));
  }

  /* ── Loader ── */
  .mon-loader-shell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    min-height: 400px;
    color: var(--fg-muted, #64748b);
  }
  .mon-spinner {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid var(--border, rgba(255,255,255,0.07));
    border-top-color: var(--accent-blue, #3b82f6);
    animation: mon-spin 0.7s linear infinite;
  }
  @keyframes mon-spin { to { transform: rotate(360deg); } }
  .mon-loader-label { font-size: 13px; font-weight: 500; }

  /* ── Resolve check animation ── */
  @keyframes mon-check-in {
    from { opacity: 0; transform: scale(0.5) rotate(-30deg); }
    to   { opacity: 1; transform: scale(1) rotate(0deg); }
  }
  .mon-check { animation: mon-check-in 240ms var(--spring, cubic-bezier(0.175,0.885,0.32,1.075)) both; }
`;

function injectStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = MONITORING_CSS;
  document.head.appendChild(el);
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const TEAM_COLORS: Record<string, { bg: string; color: string }> = {
  Calls:   { bg: 'color-mix(in srgb, var(--accent-blue,#3b82f6) 12%, transparent)',   color: 'var(--accent-blue,#3b82f6)' },
  Tickets: { bg: 'color-mix(in srgb, var(--accent-violet,#8b5cf6) 12%, transparent)', color: 'var(--accent-violet,#8b5cf6)' },
  Sales:   { bg: 'color-mix(in srgb, var(--accent-emerald,#10b981) 12%, transparent)',color: 'var(--accent-emerald,#10b981)' },
};

function TeamBadge({ team }: { team: string }) {
  const c = TEAM_COLORS[team] ?? { bg: 'var(--bg-subtle)', color: 'var(--fg-muted)' };
  return (
    <span
      className="mon-team-badge"
      style={{ background: c.bg, color: c.color }}
    >
      {team}
    </span>
  );
}

function fmt(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function fmtRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Icons (inline SVG)
const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconCheck = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconAlert = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IconChevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconUser = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconClock = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

function MonitoringSupabase() {
  injectStyles();

  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const [profiles, setProfiles]             = useState<AgentProfile[]>([]);
  const [items, setItems]                   = useState<MonitoringItem[]>([]);
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);
  const [workingId, setWorkingId]           = useState('');
  const [errorMessage, setErrorMessage]     = useState('');
  const [recentlyResolved, setRecentlyResolved] = useState<string | null>(null);

  // Form state
  const [selectedAgentProfileId, setSelectedAgentProfileId] = useState('');
  const [agentSearch, setAgentSearch]       = useState('');
  const [isPickerOpen, setPickerOpen]       = useState(false);
  const [orderNumber, setOrderNumber]       = useState('');
  const [comment, setComment]               = useState('');

  // Filter state
  const [statusFilter, setStatusFilter]     = useState<MonitoringStatus | ''>('active');
  const [teamFilter, setTeamFilter]         = useState<'Calls' | 'Tickets' | 'Sales' | ''>('');
  const [searchText, setSearchText]         = useState('');

  const pickerRef = useRef<HTMLDivElement>(null);

  // ── Data loading ──────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) { setLoading(false); setErrorMessage(authError.message); return; }

    const userId = authData.user?.id;
    if (!userId) { setLoading(false); setErrorMessage('Could not identify logged-in user.'); return; }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, agent_name, display_name, team, email')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) { setLoading(false); setErrorMessage(profileError.message); return; }
    setCurrentProfile((profileData as CurrentProfile) || null);

    const [profilesResult, itemsResult] = await Promise.all([
      supabase.from('profiles').select('id, role, agent_id, agent_name, display_name, team').eq('role', 'agent').order('agent_name', { ascending: true }),
      supabase.from('monitoring_items').select('*').order('created_at', { ascending: false }),
    ]);

    setLoading(false);
    if (profilesResult.error) { setErrorMessage(profilesResult.error.message); return; }
    if (itemsResult.error)    { setErrorMessage(itemsResult.error.message);    return; }

    setProfiles((profilesResult.data as AgentProfile[]) || []);
    setItems((itemsResult.data as MonitoringItem[]) || []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Close picker on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Derived ────────────────────────────────────────────────

  const selectedAgent = useMemo(
    () => profiles.find((p) => p.id === selectedAgentProfileId) || null,
    [profiles, selectedAgentProfileId]
  );

  function agentLabel(p: AgentProfile) {
    return p.display_name ? `${p.agent_name} — ${p.display_name}` : `${p.agent_name} — ${p.agent_id}`;
  }

  const visibleAgents = useMemo(() => {
    const s = agentSearch.trim().toLowerCase();
    if (!s) return profiles;
    return profiles.filter((p) =>
      p.agent_name.toLowerCase().includes(s) ||
      (p.agent_id || '').toLowerCase().includes(s) ||
      (p.display_name || '').toLowerCase().includes(s)
    );
  }, [profiles, agentSearch]);

  const filteredItems = useMemo(() => {
    const s = searchText.trim().toLowerCase();
    return items.filter((item) => {
      const matchStatus = statusFilter ? item.status === statusFilter : true;
      const matchTeam   = teamFilter   ? item.team   === teamFilter   : true;
      const matchSearch = s
        ? item.order_number.toLowerCase().includes(s) ||
          item.agent_name.toLowerCase().includes(s) ||
          (item.display_name || '').toLowerCase().includes(s) ||
          item.comment.toLowerCase().includes(s)
        : true;
      return matchStatus && matchTeam && matchSearch;
    });
  }, [items, statusFilter, teamFilter, searchText]);

  const stats = useMemo(() => ({
    total:    items.length,
    active:   items.filter((i) => i.status === 'active').length,
    resolved: items.filter((i) => i.status === 'resolved').length,
    unacked:  items.filter((i) => i.status === 'active' && !i.acknowledged_by_agent).length,
  }), [items]);

  // ── Actions ────────────────────────────────────────────────

  function resetForm() {
    setSelectedAgentProfileId('');
    setAgentSearch('');
    setPickerOpen(false);
    setOrderNumber('');
    setComment('');
  }

  async function handleCreate() {
    setErrorMessage('');
    if (!currentProfile)          { setErrorMessage('Current profile is missing.'); return; }
    if (!selectedAgent)           { setErrorMessage('Please choose an agent.'); return; }
    if (!orderNumber.trim() || !comment.trim()) { setErrorMessage('Please fill in Order Number and Comment.'); return; }
    if (!selectedAgent.agent_id || !selectedAgent.team) { setErrorMessage('Selected agent is missing Agent ID or Team.'); return; }

    setSaving(true);
    const { error } = await supabase.from('monitoring_items').insert({
      order_number:       orderNumber.trim(),
      comment:            comment.trim(),
      agent_id:           selectedAgent.agent_id,
      agent_name:         selectedAgent.agent_name,
      display_name:       selectedAgent.display_name || null,
      team:               selectedAgent.team,
      created_by_name:    currentProfile.display_name || currentProfile.agent_name,
      created_by_email:   currentProfile.email,
      created_by_user_id: currentProfile.id,
      status:             'active',
    });
    setSaving(false);

    if (error) { setErrorMessage(error.message); return; }
    resetForm();
    await load();
  }

  async function handleResolve(item: MonitoringItem) {
    if (!currentProfile) return;
    setWorkingId(item.id);
    const { error } = await supabase
      .from('monitoring_items')
      .update({
        status:             'resolved',
        resolved_at:        new Date().toISOString(),
        resolved_by_name:   currentProfile.display_name || currentProfile.agent_name,
        resolved_by_email:  currentProfile.email,
      })
      .eq('id', item.id);
    setWorkingId('');
    if (error) { setErrorMessage(error.message); return; }
    setRecentlyResolved(item.id);
    setTimeout(() => setRecentlyResolved(null), 2000);
    await load();
  }

  // ── Render ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="mon-shell mon-loader-shell">
        <div className="mon-spinner" />
        <div className="mon-loader-label">Loading monitoring items…</div>
      </div>
    );
  }

  return (
    <div className="mon-shell">

      {/* Page header */}
      <div className="mon-page-header">
        <div>
          <div className="mon-eyebrow">
            <span className="mon-eyebrow-dot" />
            Operational Alerts
          </div>
          <h2 className="mon-headline">Monitoring</h2>
          <p className="mon-subline">Track and resolve live order watch items linked to agents.</p>
        </div>
        <div className="mon-header-actions">
          <button type="button" className="mon-btn mon-btn-ghost" onClick={() => void load()}>
            <IconRefresh /> Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {errorMessage && (
        <div className="mon-error">
          <IconAlert />
          <span style={{ flex: 1 }}>{errorMessage}</span>
          <button type="button" className="mon-btn mon-btn-ghost" style={{ height: 'auto', padding: '2px 6px' }} onClick={() => setErrorMessage('')}>
            <IconX />
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="mon-stats">
        {[
          { label: 'Total Items',    value: stats.total,    sub: 'all time',         color: 'var(--fg-default)' },
          { label: 'Active',         value: stats.active,   sub: 'needs attention',  color: 'var(--accent-blue,#3b82f6)' },
          { label: 'Resolved',       value: stats.resolved, sub: 'closed out',       color: 'var(--accent-emerald,#10b981)' },
          { label: 'Not Ack\'d',     value: stats.unacked,  sub: 'agent unaware',    color: 'var(--accent-amber,#f59e0b)' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="mon-stat-card">
            <div className="mon-stat-label">{label}</div>
            <div className="mon-stat-value" style={{ color }}>{value}</div>
            <div className="mon-stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Create form */}
      <div className="mon-panel">
        <div className="mon-panel-header">
          <span className="mon-panel-title">Create Monitoring Item</span>
          <span
            className="mon-panel-badge"
            style={{
              background: 'color-mix(in srgb, var(--accent-blue,#3b82f6) 10%, transparent)',
              color: 'var(--accent-blue,#3b82f6)',
              border: '1px solid color-mix(in srgb, var(--accent-blue,#3b82f6) 20%, transparent)',
            }}
          >
            New
          </span>
        </div>
        <div className="mon-panel-body">
          <div className="mon-form-grid">

            {/* Agent picker — full width */}
            <div className="mon-full">
              <label className="mon-label">Agent</label>
              <div ref={pickerRef} className="mon-picker-wrap">
                <button
                  type="button"
                  className="mon-picker-btn"
                  data-open={isPickerOpen ? 'true' : 'false'}
                  onClick={() => setPickerOpen((o) => !o)}
                >
                  {selectedAgent ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '20px', height: '20px', borderRadius: '6px',
                          background: 'color-mix(in srgb, var(--accent-blue,#3b82f6) 15%, transparent)',
                          color: 'var(--accent-blue,#3b82f6)',
                          fontSize: '9px', fontWeight: 700,
                          display: 'grid', placeItems: 'center', flexShrink: 0,
                        }}
                      >
                        {getInitials(selectedAgent.agent_name)}
                      </span>
                      <span style={{ fontWeight: 500 }}>{agentLabel(selectedAgent)}</span>
                      {selectedAgent.team && <TeamBadge team={selectedAgent.team} />}
                    </span>
                  ) : (
                    <span className="mon-picker-btn-placeholder">Select an agent…</span>
                  )}
                  <span className="mon-picker-chevron"><IconChevron /></span>
                </button>

                {isPickerOpen && (
                  <div className="mon-picker-menu">
                    <div className="mon-picker-search-wrap">
                      <div className="mon-search-wrap" style={{ minWidth: 0 }}>
                        <span className="mon-search-icon"><IconSearch /></span>
                        <input
                          type="text"
                          className="mon-search-field"
                          value={agentSearch}
                          onChange={(e) => setAgentSearch(e.target.value)}
                          placeholder="Search by name, ID, display name…"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="mon-picker-list">
                      {visibleAgents.length === 0 ? (
                        <div className="mon-picker-empty">No agents found</div>
                      ) : (
                        visibleAgents.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={`mon-picker-option${selectedAgentProfileId === p.id ? ' selected' : ''}`}
                            onClick={() => {
                              setSelectedAgentProfileId(p.id);
                              setAgentSearch('');
                              setPickerOpen(false);
                            }}
                          >
                            <div className="mon-picker-avatar">{getInitials(p.agent_name)}</div>
                            <div className="mon-picker-option-label">
                              <div className="mon-picker-option-name">{p.agent_name}</div>
                              <div className="mon-picker-option-meta">
                                {p.display_name || p.agent_id}
                              </div>
                            </div>
                            {p.team && <TeamBadge team={p.team} />}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Order number */}
            <div>
              <label className="mon-label">Order Number</label>
              <input
                type="text"
                className="mon-field"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. ORD-12345"
              />
            </div>

            {/* Spacer on desktop, full width on mobile */}
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              {/* intentionally empty to keep grid balanced */}
            </div>

            {/* Comment — full width */}
            <div className="mon-full">
              <label className="mon-label">Comment</label>
              <textarea
                className="mon-field"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Describe the issue or watch reason…"
              />
            </div>
          </div>

          <div className="mon-action-row">
            <button
              type="button"
              className="mon-btn mon-btn-primary"
              onClick={() => void handleCreate()}
              disabled={saving}
            >
              <IconPlus />
              {saving ? 'Creating…' : 'Create Item'}
            </button>
            <button
              type="button"
              className="mon-btn mon-btn-secondary"
              onClick={resetForm}
              disabled={saving}
            >
              <IconX /> Clear
            </button>
          </div>
        </div>
      </div>

      <div className="mon-divider" />

      {/* Filter bar */}
      <div className="mon-filter-bar">
        {/* Status filter */}
        <div className="mon-filter-group">
          {([
            { value: '',         label: 'All',      accent: '' },
            { value: 'active',   label: 'Active',   accent: 'active' },
            { value: 'resolved', label: 'Resolved',  accent: 'resolved' },
          ] as const).map(({ value, label, accent }) => (
            <button
              key={value}
              type="button"
              className={`mon-filter-chip${statusFilter === value ? ' active' : ''}`}
              data-accent={accent ?? ''}
              onClick={() => setStatusFilter(value as typeof statusFilter)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Team filter */}
        <div className="mon-filter-group">
          {(['', 'Calls', 'Tickets', 'Sales'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`mon-filter-chip${teamFilter === t ? ' active' : ''}`}
              onClick={() => setTeamFilter(t)}
            >
              {t || 'All Teams'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mon-search-wrap">
          <span className="mon-search-icon"><IconSearch /></span>
          <input
            type="text"
            className="mon-search-field"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search orders, agents, comments…"
          />
        </div>
      </div>

      {/* Items list */}
      <div className="mon-section-header">
        <div className="mon-section-title">
          Items
          <span className="mon-count-badge">{filteredItems.length}</span>
        </div>
        {filteredItems.length !== items.length && (
          <button
            type="button"
            className="mon-btn mon-btn-ghost"
            onClick={() => { setStatusFilter(''); setTeamFilter(''); setSearchText(''); }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mon-list">
        {filteredItems.length === 0 ? (
          <div className="mon-empty">
            <div className="mon-empty-icon">📋</div>
            <div className="mon-empty-title">No items found</div>
            <div className="mon-empty-sub">
              {searchText || statusFilter || teamFilter
                ? 'Try adjusting your filters or search query.'
                : 'Create your first monitoring item above.'}
            </div>
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isActive   = item.status === 'active';
            const accentColor = isActive
              ? 'var(--accent-blue,#3b82f6)'
              : 'var(--accent-emerald,#10b981)';
            const isWorking  = workingId === item.id;
            const justResolved = recentlyResolved === item.id;

            return (
              <div
                key={item.id}
                className={`mon-item-card${!isActive ? ' resolved' : ''}`}
                style={{ animationDelay: `${idx * 30}ms` } as CSSProperties}
              >
                <div className="mon-item-inner">
                  {/* Accent bar */}
                  <div className="mon-item-accent-bar" style={{ background: accentColor }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Body */}
                    <div className="mon-item-body">
                      <div className="mon-item-top">
                        <div>
                          <div className="mon-item-order">
                            <span className="mon-order-number">#{item.order_number}</span>
                            <TeamBadge team={item.team} />
                          </div>
                          <div className="mon-item-agent">
                            <IconUser />
                            <span style={{ fontWeight: 500, color: 'var(--fg-default)' }}>{item.agent_name}</span>
                            {item.display_name && (
                              <><span style={{ opacity: 0.4 }}>·</span><span>{item.display_name}</span></>
                            )}
                          </div>
                        </div>
                        <div className="mon-item-pills">
                          {/* Status */}
                          <span className={`mon-pill ${isActive ? 'mon-pill-active' : 'mon-pill-resolved'}`}>
                            <span className="mon-pill-dot" />
                            {isActive ? 'Active' : 'Resolved'}
                          </span>
                          {/* Acknowledgement */}
                          <span className={`mon-pill ${item.acknowledged_by_agent ? 'mon-pill-ack' : 'mon-pill-unack'}`}>
                            {item.acknowledged_by_agent ? (
                              <><span className="mon-check"><IconCheck /></span> Ack'd</>
                            ) : (
                              <>⚠ Not Ack'd</>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Comment */}
                      <div className="mon-comment">{item.comment}</div>

                      {/* Meta grid */}
                      <div className="mon-item-meta">
                        <div className="mon-meta-field">
                          <div className="mon-meta-label">Created by</div>
                          <div className="mon-meta-value highlight">{item.created_by_name}</div>
                          <div className="mon-meta-value">{item.created_by_email}</div>
                        </div>
                        <div className="mon-meta-field">
                          <div className="mon-meta-label">Created</div>
                          <div className="mon-meta-value highlight">{fmtRelative(item.created_at)}</div>
                          <div className="mon-meta-value">{fmt(item.created_at)}</div>
                        </div>
                        {item.acknowledged_at && (
                          <div className="mon-meta-field">
                            <div className="mon-meta-label">Acknowledged</div>
                            <div className="mon-meta-value highlight">{fmtRelative(item.acknowledged_at)}</div>
                            <div className="mon-meta-value">{fmt(item.acknowledged_at)}</div>
                          </div>
                        )}
                        {item.resolved_at && (
                          <div className="mon-meta-field">
                            <div className="mon-meta-label">Resolved by</div>
                            <div className="mon-meta-value highlight">{item.resolved_by_name ?? '—'}</div>
                            <div className="mon-meta-value">{fmt(item.resolved_at)}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mon-item-footer">
                      <div className="mon-item-footer-meta">
                        <IconClock />
                        <span>{fmt(item.created_at)}</span>
                        <span className="mon-item-footer-sep">·</span>
                        <span>ID: <span style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: '10px' }}>{item.id.slice(0, 8)}</span></span>
                      </div>

                      {isActive && (
                        <button
                          type="button"
                          className={`mon-btn ${justResolved ? 'mon-btn-secondary' : 'mon-btn-secondary'}`}
                          style={justResolved ? {
                            background: 'color-mix(in srgb, var(--accent-emerald,#10b981) 12%, transparent)',
                            color: 'var(--accent-emerald,#10b981)',
                            borderColor: 'color-mix(in srgb, var(--accent-emerald,#10b981) 25%, transparent)',
                          } : {}}
                          onClick={() => void handleResolve(item)}
                          disabled={isWorking}
                        >
                          {isWorking ? (
                            <><div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'mon-spin 0.6s linear infinite' }} /> Resolving…</>
                          ) : justResolved ? (
                            <><span className="mon-check"><IconCheck /></span> Resolved!</>
                          ) : (
                            <><IconCheck /> Mark Resolved</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default MonitoringSupabase;
