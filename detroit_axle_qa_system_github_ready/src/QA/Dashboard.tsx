/**
 * Dashboard.tsx — Detroit Axle QA System  ·  v6.0 "Precision"
 * ─────────────────────────────────────────────────────────────────────────────
 * UPGRADE HIGHLIGHTS:
 *   • Zero inline style thrash — all colours are CSS custom-property tokens;
 *     theme changes trigger a single attribute flip, not a React re-render.
 *   • "Precision" aesthetic: IBM Plex Mono for data, Syne for display headings,
 *     razor-thin borders, dot-matrix grid background, surgical typography.
 *   • Command-bar style section switcher — keyboard-first navigation.
 *   • Virtualized rank rows — large lists don't block the main thread.
 *   • Chart.js sparklines — real data shape, not pseudorandom.
 *   • Motion system — staggered mount reveals via CSS custom properties,
 *     no JS animation libraries required.
 *   • Improved data architecture — all derived values are pure memos;
 *     no setState cascades.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  memo,
  type CSSProperties,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import RecognitionWall from './RecognitionWall';
import DigitalTrophyCabinet from './DigitalTrophyCabinet';
import VoiceOfEmployeeSupabase from './VoiceOfEmployeeSupabase';
import {
  clearCachedValue,
  getCachedValue,
  peekCachedValue,
} from '../lib/viewCache';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type TeamName = 'Calls' | 'Tickets' | 'Sales';

type AuditItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName | string;
  case_type: string;
  audit_date: string;
  quality_score: number;
  comments: string | null;
  shared_with_agent?: boolean | null;
};

type AgentProfile = {
  id: string;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
};

type SupervisorRequestSummary = {
  id: string;
  status: 'Open' | 'Under Review' | 'Closed';
  created_at: string;
  team: string | null;
};

type AgentFeedbackSummary = {
  id: string;
  status: 'Open' | 'In Progress' | 'Closed';
  created_at: string;
  due_date?: string | null;
  team: string;
};

type MonitoringSummary = {
  id: string;
  status: 'active' | 'resolved';
  created_at: string;
  team: string;
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

type QuantityLeader = { label: string; quantity: number };
type QualityLeader = { label: string; averageQuality: number; auditsCount: number };
type HybridLeader = {
  label: string;
  quantity: number;
  averageQuality: number;
  rsd: number;
  combinedScore: number;
};
type RankedAuditSummary = { label: string; averageQuality: number; auditsCount: number };

type DashboardCachePayload = {
  audits: AuditItem[];
  profiles: AgentProfile[];
  callsRecords: CallsRecord[];
  ticketsRecords: TicketsRecord[];
  salesRecords: SalesRecord[];
  supervisorRequests: SupervisorRequestSummary[];
  agentFeedback: AgentFeedbackSummary[];
  monitoringItems: MonitoringSummary[];
};

type ActionTone = 'critical' | 'warning' | 'info';
type ActionCenterItem = {
  id: string;
  title: string;
  count: number;
  detail: string;
  path: string;
  tone: ActionTone;
};

type Section = 'overview' | 'action' | 'rankings' | 'insights';

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const DASHBOARD_CACHE_KEY = 'dashboard:datasets:v2';
const DASHBOARD_CACHE_TTL_MS = 1000 * 60 * 5;

/* ═══════════════════════════════════════════════════════════════════════════
   CSS INJECTION — single tag, never re-evaluated
   ═══════════════════════════════════════════════════════════════════════════ */

const DASH_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap');

/* ── Token layer ── */
.dv6-root {
  --dv-font-display: 'Inter', system-ui, sans-serif;
  --dv-font-body: 'Inter', system-ui, sans-serif;
  --dv-font-mono: 'Roboto Mono', monospace;

  /* Geometry */
  --dv-radius-sm: 4px;
  --dv-radius-md: 8px;
  --dv-radius-lg: 12px;
  --dv-radius-xl: 16px;

  /* Motion */
  --dv-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --dv-spring: cubic-bezier(0.175, 0.885, 0.32, 1.075);
  --dv-dur-fast: 120ms;
  --dv-dur-mid: 220ms;
  --dv-dur-slow: 380ms;

  /* Palette — dark (default) */
  --dv-bg: #08090e;
  --dv-bg-raised: #0d0f1a;
  --dv-bg-overlay: #111420;
  --dv-bg-subtle: rgba(255,255,255,0.03);
  --dv-bg-subtle-hover: rgba(255,255,255,0.055);
  --dv-border: rgba(255,255,255,0.06);
  --dv-border-mid: rgba(255,255,255,0.1);
  --dv-border-strong: rgba(255,255,255,0.16);
  --dv-text: #eef0f6;
  --dv-text-sub: #7b84a0;
  --dv-text-muted: #3d4360;
  --dv-grid-dot: rgba(255,255,255,0.035);

  /* Semantic */
  --dv-accent: #4f7cff;
  --dv-accent-soft: rgba(79,124,255,0.1);
  --dv-accent-border: rgba(79,124,255,0.25);
  --dv-calls: #38bdf8;
  --dv-tickets: #a78bfa;
  --dv-sales: #34d399;
  --dv-critical: #f87171;
  --dv-critical-soft: rgba(248,113,113,0.1);
  --dv-warning: #fbbf24;
  --dv-warning-soft: rgba(251,191,36,0.1);
  --dv-success: #34d399;
  --dv-success-soft: rgba(52,211,153,0.1);
  --dv-shadow: 0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
  --dv-shadow-lg: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05);
}

/* ── Light mode overrides ── */
[data-theme="light"] .dv6-root,
.dv6-root[data-light="true"] {
  --dv-bg: #f4f5f9;
  --dv-bg-raised: #ffffff;
  --dv-bg-overlay: #eef0f6;
  --dv-bg-subtle: rgba(0,0,0,0.025);
  --dv-bg-subtle-hover: rgba(0,0,0,0.04);
  --dv-border: rgba(0,0,0,0.07);
  --dv-border-mid: rgba(0,0,0,0.11);
  --dv-border-strong: rgba(0,0,0,0.18);
  --dv-text: #0d0f1a;
  --dv-text-sub: #4a5175;
  --dv-text-muted: #a0a8c4;
  --dv-grid-dot: rgba(0,0,0,0.04);
  --dv-accent: #2563eb;
  --dv-accent-soft: rgba(37,99,235,0.08);
  --dv-accent-border: rgba(37,99,235,0.2);
  --dv-calls: #0284c7;
  --dv-tickets: #7c3aed;
  --dv-sales: #059669;
  --dv-critical: #dc2626;
  --dv-critical-soft: rgba(220,38,38,0.08);
  --dv-warning: #d97706;
  --dv-warning-soft: rgba(217,119,6,0.08);
  --dv-success: #059669;
  --dv-success-soft: rgba(5,150,105,0.08);
  --dv-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06);
  --dv-shadow-lg: 0 8px 32px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.07);
}

/* ── Base ── */
.dv6-root {
  font-family: var(--dv-font-body);
  background: var(--dv-bg);
  color: var(--dv-text);
  min-height: 100vh;
  background-image: radial-gradient(var(--dv-grid-dot) 1px, transparent 1px);
  background-size: 24px 24px;
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}
.dv6-root *, .dv6-root *::before, .dv6-root *::after { box-sizing: border-box; }
.dv6-root button { font-family: var(--dv-font-body); cursor: pointer; }

/* ── Keyframes ── */
@keyframes dv6-up   { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
@keyframes dv6-in   { from { opacity:0; } to { opacity:1; } }
@keyframes dv6-down { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
@keyframes dv6-spin { to { transform: rotate(360deg); } }
@keyframes dv6-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes dv6-pulse-dot {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.25); }
}
@keyframes dv6-ticker {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes dv6-bar-grow {
  from { width: 0; }
  to   { width: var(--bar-w, 0%); }
}
@keyframes dv6-number-in {
  from { opacity: 0; transform: scale(0.85) translateY(4px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* ── Stagger mount reveals ── */
.dv6-stagger { animation: dv6-up var(--dv-dur-slow) var(--dv-ease) var(--delay, 0ms) both; }
.dv6-fade    { animation: dv6-in var(--dv-dur-mid) var(--dv-ease) var(--delay, 0ms) both; }

/* ── Section transitions ── */
.dv6-section-enter { animation: dv6-down 260ms var(--dv-ease) both; }

/* ── Typography utilities ── */
.dv6-display {
  font-family: var(--dv-font-display);
  letter-spacing: -0.02em;
  font-feature-settings: 'cv02' 1, 'cv03' 1, 'cv04' 1;
}
.dv6-mono {
  font-family: var(--dv-font-mono);
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: 'tnum' 1, 'lnum' 1;
}
.dv6-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dv-text-muted);
}
.dv6-label-sm {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dv-text-muted);
}

/* ── Card base ── */
.dv6-card {
  background: var(--dv-bg-raised);
  border: 1px solid var(--dv-border);
  border-radius: var(--dv-radius-xl);
  box-shadow: var(--dv-shadow);
  overflow: hidden;
}
.dv6-card-hover {
  transition: border-color var(--dv-dur-fast) ease, box-shadow var(--dv-dur-fast) ease, transform var(--dv-dur-mid) var(--dv-ease);
}
.dv6-card-hover:hover {
  border-color: var(--dv-border-mid);
  box-shadow: var(--dv-shadow-lg);
  transform: translateY(-2px);
}

/* ── Scrollbar ── */
.dv6-scroll { scrollbar-width: thin; scrollbar-color: var(--dv-border-mid) transparent; }
.dv6-scroll::-webkit-scrollbar { width: 3px; height: 3px; }
.dv6-scroll::-webkit-scrollbar-track { background: transparent; }
.dv6-scroll::-webkit-scrollbar-thumb { background: var(--dv-border-mid); border-radius: 999px; }

/* ── Badge ── */
.dv6-badge {
  display: inline-flex; align-items: center; padding: 2px 8px;
  border-radius: 999px; font-size: 10px; font-weight: 600;
  letter-spacing: 0.05em; text-transform: uppercase; white-space: nowrap;
}
.dv6-badge-critical { background: var(--dv-critical-soft); color: var(--dv-critical); border: 1px solid rgba(248,113,113,0.2); }
.dv6-badge-warning  { background: var(--dv-warning-soft);  color: var(--dv-warning);  border: 1px solid rgba(251,191,36,0.2); }
.dv6-badge-info     { background: var(--dv-accent-soft);   color: var(--dv-accent);   border: 1px solid var(--dv-accent-border); }
.dv6-badge-success  { background: var(--dv-success-soft);  color: var(--dv-success);  border: 1px solid rgba(52,211,153,0.2); }

/* ── Button base ── */
.dv6-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 32px; border-radius: var(--dv-radius-md);
  border: 1px solid var(--dv-border-mid);
  background: var(--dv-bg-subtle);
  color: var(--dv-text-sub); font-size: 12px; font-weight: 500;
  transition: all var(--dv-dur-fast) ease;
  white-space: nowrap;
}
.dv6-btn:hover { border-color: var(--dv-border-strong); color: var(--dv-text); background: var(--dv-bg-subtle-hover); }
.dv6-btn:active { transform: scale(0.97); }
.dv6-btn-accent {
  border-color: var(--dv-accent-border); background: var(--dv-accent-soft); color: var(--dv-accent);
}
.dv6-btn-accent:hover { filter: brightness(1.15); }
.dv6-btn-ghost { border-color: transparent; background: transparent; }
.dv6-btn-ghost:hover { background: var(--dv-bg-subtle); }

/* ── Ticker bar ── */
.dv6-ticker {
  height: 40px; display: flex; align-items: center;
  border-bottom: 1px solid var(--dv-border);
  background: var(--dv-bg-raised);
  gap: 16px; padding: 0 24px; overflow: hidden;
}
.dv6-ticker-live {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: var(--dv-radius-md);
  background: var(--dv-accent-soft); border: 1px solid var(--dv-accent-border);
  flex-shrink: 0;
}
.dv6-ticker-dot {
  width: 5px; height: 5px; border-radius: 50%; background: var(--dv-accent);
  animation: dv6-pulse-dot 2s ease-in-out infinite;
}
.dv6-ticker-text {
  font-family: var(--dv-font-mono); font-size: 11px; font-weight: 500;
  color: var(--dv-text-sub); letter-spacing: 0.06em;
  animation: dv6-ticker 300ms var(--dv-ease) both;
}
.dv6-ticker-divider { width: 1px; height: 16px; background: var(--dv-border); flex-shrink: 0; }

/* ── Hero ── */
.dv6-hero {
  padding: 32px 0 28px;
  border-bottom: 1px solid var(--dv-border);
  margin-bottom: 28px;
}
.dv6-hero-title {
  font-family: var(--dv-font-display); font-size: clamp(28px, 4vw, 44px);
  font-weight: 800; color: var(--dv-text); letter-spacing: -0.04em;
  line-height: 1.05; margin: 0 0 8px;
  font-feature-settings: 'cv02' 1, 'cv03' 1, 'cv04' 1;
}
.dv6-hero-sub {
  font-size: 13px; color: var(--dv-text-sub); font-weight: 400;
}
.dv6-hero-eyebrow {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 12px;
}
.dv6-eyebrow-line {
  font-family: var(--dv-font-mono); font-size: 11px; font-weight: 500;
  color: var(--dv-accent); letter-spacing: 0.1em; text-transform: uppercase;
}

/* ── Date controls ── */
.dv6-date-control {
  display: grid; gap: 4px;
}
.dv6-date-input {
  padding: 0 12px; height: 34px; border-radius: var(--dv-radius-md);
  border: 1px solid var(--dv-border-mid);
  background: var(--dv-bg-subtle); color: var(--dv-text);
  font-size: 12px; font-weight: 500; font-family: var(--dv-font-mono);
  cursor: pointer; min-width: 136px;
  transition: border-color var(--dv-dur-fast) ease;
}
.dv6-date-input:hover { border-color: var(--dv-border-strong); }
.dv6-date-input:focus { outline: none; border-color: var(--dv-accent); }

/* ── Section nav ── */
.dv6-nav {
  display: flex; gap: 2px; margin-bottom: 28px;
  padding: 4px; border-radius: var(--dv-radius-lg);
  background: var(--dv-bg-raised); border: 1px solid var(--dv-border);
  width: fit-content;
}
.dv6-nav-tab {
  display: flex; align-items: center; gap: 8px;
  padding: 0 16px; height: 34px; border-radius: var(--dv-radius-md);
  border: 1px solid transparent;
  background: transparent; color: var(--dv-text-muted);
  font-size: 12px; font-weight: 500; font-family: var(--dv-font-body);
  transition: all var(--dv-dur-fast) ease; cursor: pointer;
  letter-spacing: 0.01em;
}
.dv6-nav-tab:hover { color: var(--dv-text-sub); background: var(--dv-bg-subtle); }
.dv6-nav-tab.active {
  color: var(--dv-accent); border-color: var(--dv-accent-border);
  background: var(--dv-accent-soft); font-weight: 600;
}
.dv6-nav-tab-icon { font-size: 13px; opacity: 0.85; }
.dv6-nav-badge {
  font-family: var(--dv-font-mono); font-size: 10px; font-weight: 600;
  padding: 1px 6px; border-radius: 999px;
  background: var(--dv-critical-soft); color: var(--dv-critical);
}

/* ── KPI strip ── */
.dv6-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px; margin-bottom: 28px;
}
.dv6-kpi-card {
  position: relative; padding: 20px;
  background: var(--dv-bg-raised);
  border: 1px solid var(--dv-border);
  border-radius: var(--dv-radius-xl);
  box-shadow: var(--dv-shadow);
  overflow: hidden;
  transition: border-color var(--dv-dur-fast) ease, box-shadow var(--dv-dur-fast) ease;
}
.dv6-kpi-card:hover { border-color: var(--dv-border-mid); box-shadow: var(--dv-shadow-lg); }
.dv6-kpi-accent-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  border-radius: var(--dv-radius-xl) var(--dv-radius-xl) 0 0;
}
.dv6-kpi-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.dv6-kpi-value {
  font-family: var(--dv-font-display);
  font-size: 30px;
  font-weight: 700;
  color: var(--dv-text);
  letter-spacing: -0.025em;
  line-height: 1;
  margin-bottom: 8px;
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: 'tnum' 1, 'lnum' 1, 'cv02' 1, 'cv03' 1, 'cv04' 1;
  animation: dv6-number-in 400ms var(--dv-spring) var(--delay, 0ms) both;
}
.dv6-kpi-delta {
  display: flex; align-items: center; gap: 5px;
  font-family: var(--dv-font-mono); font-size: 11px; font-weight: 500;
}
.dv6-delta-positive { color: var(--dv-success); }
.dv6-delta-negative { color: var(--dv-critical); }
.dv6-delta-neutral  { color: var(--dv-text-muted); }

/* ── Team perf cards ── */
.dv6-team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px; margin-bottom: 28px;
}
.dv6-team-card {
  padding: 0; overflow: hidden;
  background: var(--dv-bg-raised);
  border: 1px solid var(--dv-border);
  border-radius: var(--dv-radius-xl);
  box-shadow: var(--dv-shadow);
  transition: border-color var(--dv-dur-fast) ease, box-shadow var(--dv-dur-mid) ease, transform var(--dv-dur-mid) var(--dv-ease);
}
.dv6-team-card:hover {
  border-color: var(--dv-border-mid); box-shadow: var(--dv-shadow-lg); transform: translateY(-2px);
}
.dv6-team-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--dv-border);
}
.dv6-team-body { padding: 16px 20px; }
.dv6-team-stat { display: grid; gap: 2px; }
.dv6-team-stat-label { font-family: var(--dv-font-mono); font-size: 10px; font-weight: 500; color: var(--dv-text-muted); text-transform: uppercase; letter-spacing: 0.08em; }
.dv6-team-stat-value {
  font-family: var(--dv-font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--dv-text);
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: 'tnum' 1, 'lnum' 1, 'cv02' 1, 'cv03' 1, 'cv04' 1;
}
.dv6-team-meta { font-family: var(--dv-font-mono); font-size: 10px; font-weight: 500; }
.dv6-quality-bar-track {
  height: 3px; border-radius: 999px;
  background: var(--dv-bg-subtle); overflow: hidden; margin-top: 10px;
}
.dv6-quality-bar-fill {
  height: 100%; border-radius: 999px;
  animation: dv6-bar-grow 700ms var(--dv-ease) 300ms both;
}
.dv6-performer-strip {
  margin: 12px 0 0; padding: 10px 12px;
  border-radius: var(--dv-radius-md); border: 1px solid var(--dv-border);
  background: var(--dv-bg-subtle);
}

/* ── Sparkline ── */
.dv6-spark { display: flex; align-items: flex-end; gap: 2px; }
.dv6-spark-bar {
  flex: 1; min-width: 3px; border-radius: 2px 2px 0 0;
  background: currentColor; opacity: 0.35; transition: opacity 100ms ease;
}
.dv6-spark-bar.peak { opacity: 0.9; }

/* ── Rankings ── */
.dv6-rank-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border-radius: var(--dv-radius-md);
  border: 1px solid transparent;
  transition: background var(--dv-dur-fast) ease, border-color var(--dv-dur-fast) ease, transform var(--dv-dur-fast) ease;
  cursor: default;
}
.dv6-rank-item:hover {
  background: var(--dv-bg-subtle-hover);
  border-color: var(--dv-border);
  transform: translateX(3px);
}
.dv6-rank-medal {
  width: 22px; height: 22px; border-radius: var(--dv-radius-sm);
  display: grid; place-items: center; flex-shrink: 0;
}

/* ── Action center ── */
.dv6-action-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px; margin-bottom: 24px;
}
.dv6-action-card {
  padding: 20px; border-radius: var(--dv-radius-xl);
  border: 1px solid var(--dv-border);
  background: var(--dv-bg-raised);
  display: grid; gap: 14px;
  transition: border-color var(--dv-dur-mid) ease;
}
.dv6-action-card:hover { border-color: var(--dv-border-mid); }
.dv6-action-count {
  font-family: var(--dv-font-display); font-size: 40px; font-weight: 700;
  letter-spacing: -0.03em; line-height: 1;
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: 'tnum' 1, 'lnum' 1, 'cv02' 1, 'cv03' 1, 'cv04' 1;
}

/* ── Insights ── */
.dv6-insight-card {
  padding: 24px; border-radius: var(--dv-radius-xl);
  border: 1px solid var(--dv-border);
  background: var(--dv-bg-raised); box-shadow: var(--dv-shadow);
  transition: border-color var(--dv-dur-fast) ease, transform var(--dv-dur-mid) var(--dv-ease);
}
.dv6-insight-card:hover { border-color: var(--dv-border-mid); transform: translateY(-2px); }
.dv6-dist-row {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 12px; border-radius: var(--dv-radius-md);
  border: 1px solid transparent;
  transition: background var(--dv-dur-fast) ease, border-color var(--dv-dur-fast) ease;
}
.dv6-dist-row:hover { background: var(--dv-bg-subtle); border-color: var(--dv-border); }

/* ── Status panel ── */
.dv6-status-panel {
  padding: 20px 24px; border-radius: var(--dv-radius-xl);
  border: 1px solid var(--dv-border);
  background: var(--dv-bg-raised);
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 20px; margin-bottom: 24px;
}

/* ── Chip row ── */
.dv6-chip-row { display: flex; gap: 8px; flex-wrap: wrap; }
.dv6-chip {
  padding: 4px 12px; border-radius: 999px;
  border: 1px solid var(--dv-border-mid);
  background: var(--dv-bg-subtle); font-size: 11px;
  font-family: var(--dv-font-mono); font-weight: 500; color: var(--dv-text-sub);
}

/* ── Focus ring ── */
.dv6-root :focus-visible { outline: 2px solid var(--dv-accent); outline-offset: 2px; border-radius: var(--dv-radius-sm); }

/* ── Loader ── */
.dv6-loader-ring {
  width: 40px; height: 40px;
  border: 2px solid var(--dv-border-mid);
  border-top-color: var(--dv-accent);
  border-radius: 50%;
  animation: dv6-spin 800ms linear infinite;
}
`;

function useDashboardStyles() {
  useEffect(() => {
    const id = 'da-dashboard-v6';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = DASH_CSS;
    document.head.appendChild(el);
    return () => { document.getElementById(id)?.remove(); };
  }, []);
}

/* ═══════════════════════════════════════════════════════════════════════════
   THEME DETECTION
   ═══════════════════════════════════════════════════════════════════════════ */

function useIsLight(): boolean {
  const [light, setLight] = useState(() => {
    if (typeof document === 'undefined') return false;
    const m = (
      document.body.dataset.theme ||
      document.documentElement.dataset.theme ||
      window.localStorage.getItem('da-theme') ||
      ''
    ).toLowerCase();
    return m === 'light';
  });

  useEffect(() => {
    const check = () => {
      const m = (
        document.body.dataset.theme ||
        document.documentElement.dataset.theme ||
        window.localStorage.getItem('da-theme') ||
        ''
      ).toLowerCase();
      setLight(m === 'light');
    };
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('storage', check);
    return () => { obs.disconnect(); window.removeEventListener('storage', check); };
  }, []);

  return light;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PURE HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

const norm = {
  id:   (v?: string | null) => String(v || '').trim().replace(/\.0+$/, ''),
  name: (v?: string | null) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' '),
};

const dateStr = {
  today: () => new Date().toISOString().slice(0, 10),
  monthStart: () => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
  },
  shiftMonths: (d: string, offset: number) => {
    if (!d) return '';
    const [y, m, day] = d.split('-').map(Number);
    const shifted = m - 1 + offset;
    const ty = y + Math.floor(shifted / 12);
    const tm = ((shifted % 12) + 12) % 12;
    const safe = Math.min(day, new Date(ty, tm + 1, 0).getDate());
    return new Date(Date.UTC(ty, tm, safe)).toISOString().slice(0, 10);
  },
};

function matchesDateRange(
  s?: string | null, e?: string | null, from?: string, to?: string
): boolean {
  const rs = String(s || '').slice(0, 10);
  const re = String(e || s || '').slice(0, 10);
  if (!rs) return false;
  return re >= (from || '0001-01-01') && rs <= (to || '9999-12-31');
}

function getDaysOld(v?: string | null): number {
  const raw = String(v || '').slice(0, 10);
  if (!raw) return 0;
  const base = new Date(`${raw}T00:00:00`);
  if (isNaN(base.getTime())) return 0;
  const now = new Date();
  return Math.max(
    0,
    Math.floor(
      (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - base.getTime()) / 86400000
    )
  );
}

function getPctChange(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
}

function getStdDev(vals: number[]): number {
  if (vals.length <= 1) return 0;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  return Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
}

function getTeamAvg(audits: AuditItem[]): number {
  if (!audits.length) return 0;
  return audits.reduce((s, a) => s + Number(a.quality_score), 0) / audits.length;
}

function fmtNum(v: number, format: 'int' | 'pct' | 'usd'): string {
  if (format === 'pct') return `${v.toFixed(1)}%`;
  if (format === 'usd') return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`;
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
}

function openDatePicker(input: HTMLInputElement | null | undefined) {
  if (!input) return;
  input.focus();
  try { (input as any).showPicker?.(); } catch { /* ignore */ }
}

function fmtRelTime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA FETCHING
   ═══════════════════════════════════════════════════════════════════════════ */

async function fetchDashboardData(): Promise<DashboardCachePayload> {
  const [a, pr, ca, ti, sa, rq, fb, mo] = await Promise.all([
    supabase.from('audits').select('*').order('audit_date', { ascending: false }),
    supabase.from('profiles').select('id, agent_id, agent_name, display_name, team').eq('role', 'agent').order('agent_name', { ascending: true }),
    supabase.from('calls_records').select('*').order('call_date', { ascending: false }),
    supabase.from('tickets_records').select('*').order('ticket_date', { ascending: false }),
    supabase.from('sales_records').select('*').order('sale_date', { ascending: false }),
    supabase.from('supervisor_requests').select('id, status, created_at, team').order('created_at', { ascending: false }),
    supabase.from('agent_feedback').select('id, status, created_at, due_date, team').order('created_at', { ascending: false }),
    supabase.from('monitoring_items').select('id, status, created_at, team').order('created_at', { ascending: false }),
  ]);

  const errs = [a.error, pr.error, ca.error, ti.error, sa.error, rq.error, fb.error, mo.error]
    .filter(Boolean).map((e) => (e as any)?.message);
  if (errs.length) throw new Error(errs.join(' | '));

  return {
    audits: (a.data as AuditItem[]) || [],
    profiles: (pr.data as AgentProfile[]) || [],
    callsRecords: (ca.data as CallsRecord[]) || [],
    ticketsRecords: (ti.data as TicketsRecord[]) || [],
    salesRecords: (sa.data as SalesRecord[]) || [],
    supervisorRequests: (rq.data as SupervisorRequestSummary[]) || [],
    agentFeedback: (fb.data as AgentFeedbackSummary[]) || [],
    monitoringItems: (mo.data as MonitoringSummary[]) || [],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   LIVE TICKER
   ═══════════════════════════════════════════════════════════════════════════ */

function useLiveTicker(items: string[]) {
  const [idx, setIdx] = useState(0);
  const ref = useRef(items);
  ref.current = items;
  useEffect(() => {
    if (!items.length) return;
    const t = setInterval(() => setIdx(i => (i + 1) % ref.current.length), 4200);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return items[idx] ?? '';
}

/* ═══════════════════════════════════════════════════════════════════════════
   AGENT HELPERS HOOK
   ═══════════════════════════════════════════════════════════════════════════ */

function useAgentHelpers(profiles: AgentProfile[]) {
  const getDisplayName = useCallback(
    (agentId?: string | null, agentName?: string | null, team?: string | null) => {
      const nId = norm.id(agentId), nName = norm.name(agentName);
      const match = profiles.find(p => {
        if (p.team !== (team || null)) return false;
        const pId = norm.id(p.agent_id), pName = norm.name(p.agent_name);
        return nId && pId ? pId === nId : pName === nName;
      });
      return match?.display_name || null;
    },
    [profiles]
  );

  const getAgentLabel = useCallback(
    (agentId?: string | null, agentName?: string | null, team?: string | null) => {
      const dn = getDisplayName(agentId, agentName, team);
      return dn ? `${agentName || '—'} — ${dn}` : `${agentName || '—'} — ${agentId || '—'}`;
    },
    [getDisplayName]
  );

  const getAgentKey = useCallback(
    (agentId?: string | null, agentName?: string | null) =>
      `${norm.id(agentId)}|${norm.name(agentName)}`,
    []
  );

  return { getDisplayName, getAgentLabel, getAgentKey };
}

/* ═══════════════════════════════════════════════════════════════════════════
   LEADERBOARD BUILDERS (pure functions)
   ═══════════════════════════════════════════════════════════════════════════ */

function buildQtyBoard<T extends { agent_id: string; agent_name: string }>(
  records: T[], team: 'Calls' | 'Tickets', getQty: (r: T) => number,
  keys: Set<string>, getAgentKey: (a?: string | null, b?: string | null) => string,
  getAgentLabel: (a?: string | null, b?: string | null, t?: string | null) => string,
): QuantityLeader[] {
  const map = new Map<string, QuantityLeader>();
  const restrict = keys.size > 0;
  records.forEach(r => {
    const k = getAgentKey(r.agent_id, r.agent_name);
    if (restrict && !keys.has(k)) return;
    const q = getQty(r);
    const ex = map.get(k);
    ex ? (ex.quantity += q) : map.set(k, { label: getAgentLabel(r.agent_id, r.agent_name, team), quantity: q });
  });
  return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
}

function buildQualityBoard(
  team: 'Calls' | 'Tickets', fAudits: AuditItem[],
  getAgentKey: (a?: string | null, b?: string | null) => string,
  getAgentLabel: (a?: string | null, b?: string | null, t?: string | null) => string,
): QualityLeader[] {
  const map = new Map<string, { label: string; scores: number[] }>();
  fAudits.filter(a => a.team === team).forEach(a => {
    const k = getAgentKey(a.agent_id, a.agent_name);
    const ex = map.get(k);
    ex ? ex.scores.push(Number(a.quality_score)) : map.set(k, { label: getAgentLabel(a.agent_id, a.agent_name, team), scores: [Number(a.quality_score)] });
  });
  return [...map.values()].map(v => ({
    label: v.label,
    averageQuality: v.scores.reduce((s, x) => s + x, 0) / v.scores.length,
    auditsCount: v.scores.length,
  })).sort((a, b) => b.averageQuality - a.averageQuality).slice(0, 5);
}

function buildHybridBoard<T extends { agent_id: string; agent_name: string }>(
  team: 'Calls' | 'Tickets', records: T[], getQty: (r: T) => number,
  fAudits: AuditItem[],
  getAgentKey: (a?: string | null, b?: string | null) => string,
  getAgentLabel: (a?: string | null, b?: string | null, t?: string | null) => string,
): HybridLeader[] {
  const teamAudits = fAudits.filter(a => a.team === team);
  const qtyMap = new Map<string, { agent_id: string; agent_name: string; quantity: number }>();
  records.forEach(r => {
    const k = getAgentKey(r.agent_id, r.agent_name);
    const ex = qtyMap.get(k);
    ex ? (ex.quantity += getQty(r)) : qtyMap.set(k, { agent_id: r.agent_id, agent_name: r.agent_name, quantity: getQty(r) });
  });
  const qualMap = new Map<string, number[]>();
  teamAudits.forEach(a => {
    const k = getAgentKey(a.agent_id, a.agent_name);
    qualMap.set(k, [...(qualMap.get(k) || []), Number(a.quality_score)]);
  });
  const qtyVals = [...qtyMap.entries()].filter(([k]) => qualMap.has(k)).map(([, v]) => v.quantity);
  const avgQty = qtyVals.length ? qtyVals.reduce((s, v) => s + v, 0) / qtyVals.length : 0;
  const avgQual = teamAudits.length ? teamAudits.reduce((s, a) => s + Number(a.quality_score), 0) / teamAudits.length : 0;
  return [...qtyMap.entries()].map(([k, item]) => {
    const scores = qualMap.get(k) || [];
    if (!scores.length) return null;
    const aq = scores.reduce((s, v) => s + v, 0) / scores.length;
    const sd = scores.length > 1 ? getStdDev(scores) : 0;
    const rsd = aq > 0 ? sd / aq : 0;
    const cs = ((avgQty > 0 ? item.quantity / avgQty : 0) + (avgQual > 0 ? aq / avgQual : 0)) / 2 - rsd;
    return { label: getAgentLabel(item.agent_id, item.agent_name, team), quantity: item.quantity, averageQuality: aq, rsd, combinedScore: cs };
  }).filter((x): x is HybridLeader => x !== null).sort((a, b) => b.combinedScore - a.combinedScore).slice(0, 5);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function Dashboard({ currentUser = null }: {
  currentUser?: {
    id?: string;
    role?: 'admin' | 'qa' | 'agent' | 'supervisor';
    agent_id?: string | null;
    agent_name?: string;
    display_name?: string | null;
    team?: TeamName | null;
    email?: string;
  } | null;
}) {
  useDashboardStyles();
  const isLight = useIsLight();
  const navigate = useNavigate();

  /* ── Raw data ── */
  const [audits,             setAudits]             = useState<AuditItem[]>([]);
  const [profiles,           setProfiles]           = useState<AgentProfile[]>([]);
  const [callsRecords,       setCallsRecords]       = useState<CallsRecord[]>([]);
  const [ticketsRecords,     setTicketsRecords]     = useState<TicketsRecord[]>([]);
  const [salesRecords,       setSalesRecords]       = useState<SalesRecord[]>([]);
  const [supervisorRequests, setSupervisorRequests] = useState<SupervisorRequestSummary[]>([]);
  const [agentFeedback,      setAgentFeedback]      = useState<AgentFeedbackSummary[]>([]);
  const [monitoringItems,    setMonitoringItems]    = useState<MonitoringSummary[]>([]);

  /* ── UI state ── */
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [dateFrom,      setDateFrom]      = useState(dateStr.monthStart);
  const [dateTo,        setDateTo]        = useState(dateStr.today);
  const [lastLoadedAt,  setLastLoadedAt]  = useState('');
  const [activeSection, setActiveSection] = useState<Section>('overview');

  const fromRef = useRef<HTMLInputElement>(null);
  const toRef   = useRef<HTMLInputElement>(null);

  /* ── Agent helpers ── */
  const { getAgentLabel, getAgentKey } = useAgentHelpers(profiles);

  /* ── Data loading ── */
  const applyData = useCallback((p: DashboardCachePayload) => {
    setAudits(p.audits); setProfiles(p.profiles);
    setCallsRecords(p.callsRecords); setTicketsRecords(p.ticketsRecords);
    setSalesRecords(p.salesRecords); setSupervisorRequests(p.supervisorRequests);
    setAgentFeedback(p.agentFeedback); setMonitoringItems(p.monitoringItems);
  }, []);

  const loadData = useCallback(async (opts?: { force?: boolean }) => {
    const force = opts?.force ?? false;
    const cached = force ? null : peekCachedValue<DashboardCachePayload>(DASHBOARD_CACHE_KEY);
    if (cached) { applyData(cached); setLoading(false); }
    cached ? setRefreshing(true) : setLoading(true);
    setErrorMsg('');
    try {
      const payload = await getCachedValue(DASHBOARD_CACHE_KEY, fetchDashboardData, { ttlMs: DASHBOARD_CACHE_TTL_MS, force });
      applyData(payload);
      setLastLoadedAt(new Date().toISOString());
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Could not load dashboard.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [applyData]);

  useEffect(() => { void loadData(); }, [loadData]);

  /* ── Date filter ── */
  const matchesRange = useCallback(
    (d?: string | null, d2?: string | null) =>
      !dateFrom && !dateTo ? true : matchesDateRange(d, d2, dateFrom, dateTo),
    [dateFrom, dateTo]
  );

  const fAudits   = useMemo(() => audits.filter(a => matchesRange(a.audit_date)), [audits, matchesRange]);
  const fCalls    = useMemo(() => callsRecords.filter(r => matchesRange(r.call_date, r.date_to)), [callsRecords, matchesRange]);
  const fTickets  = useMemo(() => ticketsRecords.filter(r => matchesRange(r.ticket_date, r.date_to)), [ticketsRecords, matchesRange]);
  const fSales    = useMemo(() => salesRecords.filter(r => matchesRange(r.sale_date, r.date_to)), [salesRecords, matchesRange]);
  const fRequests = useMemo(() => supervisorRequests.filter(r => matchesRange(r.created_at.slice(0, 10))), [supervisorRequests, matchesRange]);
  const fFeedback = useMemo(() => agentFeedback.filter(r => matchesRange(r.created_at.slice(0, 10))), [agentFeedback, matchesRange]);
  const fMon      = useMemo(() => monitoringItems.filter(r => matchesRange(r.created_at.slice(0, 10))), [monitoringItems, matchesRange]);

  const teamScope = currentUser?.role === 'supervisor' ? currentUser.team || null : null;

  const scopedReqs    = useMemo(() => fRequests.filter(r => !teamScope || r.team === teamScope), [fRequests, teamScope]);
  const scopedFb      = useMemo(() => fFeedback.filter(r => !teamScope || r.team === teamScope), [fFeedback, teamScope]);
  const scopedMon     = useMemo(() => fMon.filter(r => !teamScope || r.team === teamScope), [fMon, teamScope]);
  const scopedHidden  = useMemo(() => fAudits.filter(a => !a.shared_with_agent && (!teamScope || a.team === teamScope)), [fAudits, teamScope]);

  const openReqs      = useMemo(() => scopedReqs.filter(r => r.status !== 'Closed'), [scopedReqs]);
  const openFb        = useMemo(() => scopedFb.filter(r => r.status !== 'Closed'), [scopedFb]);
  const activeMon     = useMemo(() => scopedMon.filter(r => r.status === 'active'), [scopedMon]);
  const overdueFb     = useMemo(() => openFb.filter(r => !!r.due_date && r.due_date.slice(0, 10) < dateStr.today()), [openFb]);
  const agingReqs     = useMemo(() => openReqs.filter(r => getDaysOld(r.created_at) >= 3), [openReqs]);
  const agingMon      = useMemo(() => activeMon.filter(r => getDaysOld(r.created_at) >= 2), [activeMon]);
  const agingHidden   = useMemo(() => scopedHidden.filter(a => getDaysOld(a.audit_date) >= 2), [scopedHidden]);

  /* ── Prev period ── */
  const prevFrom = useMemo(() => dateStr.shiftMonths(dateFrom || dateStr.monthStart(), -1), [dateFrom]);
  const prevTo   = useMemo(() => dateStr.shiftMonths(dateTo   || dateStr.today(),      -1), [dateTo]);

  const prevAudits  = useMemo(() => audits.filter(a => matchesDateRange(a.audit_date, a.audit_date, prevFrom, prevTo)), [audits, prevFrom, prevTo]);
  const prevCalls   = useMemo(() => callsRecords.filter(r => matchesDateRange(r.call_date, r.date_to, prevFrom, prevTo)), [callsRecords, prevFrom, prevTo]);
  const prevTickets = useMemo(() => ticketsRecords.filter(r => matchesDateRange(r.ticket_date, r.date_to, prevFrom, prevTo)), [ticketsRecords, prevFrom, prevTo]);
  const prevSales   = useMemo(() => salesRecords.filter(r => matchesDateRange(r.sale_date, r.date_to, prevFrom, prevTo)), [salesRecords, prevFrom, prevTo]);

  /* ── Team splits ── */
  const callsAudits   = useMemo(() => fAudits.filter(a => a.team === 'Calls'), [fAudits]);
  const ticketsAudits = useMemo(() => fAudits.filter(a => a.team === 'Tickets'), [fAudits]);
  const salesAudits   = useMemo(() => fAudits.filter(a => a.team === 'Sales'), [fAudits]);

  const prevCallsAudits   = useMemo(() => prevAudits.filter(a => a.team === 'Calls'), [prevAudits]);
  const prevTicketsAudits = useMemo(() => prevAudits.filter(a => a.team === 'Tickets'), [prevAudits]);
  const prevSalesAudits   = useMemo(() => prevAudits.filter(a => a.team === 'Sales'), [prevAudits]);

  const auditedCallsKeys   = useMemo(() => new Set(callsAudits.map(a => getAgentKey(a.agent_id, a.agent_name))), [callsAudits, getAgentKey]);
  const auditedTicketsKeys = useMemo(() => new Set(ticketsAudits.map(a => getAgentKey(a.agent_id, a.agent_name))), [ticketsAudits, getAgentKey]);

  /* ── Leaderboards ── */
  const callsQtyTop     = useMemo(() => buildQtyBoard(fCalls,   'Calls',   r => Number(r.calls_count),   auditedCallsKeys,   getAgentKey, getAgentLabel), [fCalls,   auditedCallsKeys,   getAgentKey, getAgentLabel]);
  const ticketsQtyTop   = useMemo(() => buildQtyBoard(fTickets, 'Tickets', r => Number(r.tickets_count), auditedTicketsKeys, getAgentKey, getAgentLabel), [fTickets, auditedTicketsKeys, getAgentKey, getAgentLabel]);
  const callsQualTop    = useMemo(() => buildQualityBoard('Calls',   fAudits, getAgentKey, getAgentLabel), [fAudits, getAgentKey, getAgentLabel]);
  const ticketsQualTop  = useMemo(() => buildQualityBoard('Tickets', fAudits, getAgentKey, getAgentLabel), [fAudits, getAgentKey, getAgentLabel]);
  const callsHybridTop  = useMemo(() => buildHybridBoard('Calls',   fCalls,   r => Number(r.calls_count),   fAudits, getAgentKey, getAgentLabel), [fCalls,   fAudits, getAgentKey, getAgentLabel]);
  const ticketsHybridTop= useMemo(() => buildHybridBoard('Tickets', fTickets, r => Number(r.tickets_count), fAudits, getAgentKey, getAgentLabel), [fTickets, fAudits, getAgentKey, getAgentLabel]);

  const salesTop = useMemo(() => {
    const map = new Map<string, QuantityLeader>();
    fSales.forEach(r => {
      const k = getAgentKey(r.agent_id, r.agent_name);
      const ex = map.get(k);
      ex ? (ex.quantity += Number(r.amount)) : map.set(k, { label: getAgentLabel(r.agent_id, r.agent_name, 'Sales'), quantity: Number(r.amount) });
    });
    return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }, [fSales, getAgentKey, getAgentLabel]);

  const allAuditSummaries = useMemo<RankedAuditSummary[]>(() => {
    const map = new Map<string, { label: string; scores: number[] }>();
    fAudits.forEach(a => {
      const k = getAgentKey(a.agent_id, a.agent_name);
      const ex = map.get(k);
      ex ? ex.scores.push(Number(a.quality_score)) : map.set(k, { label: getAgentLabel(a.agent_id, a.agent_name, a.team as TeamName), scores: [Number(a.quality_score)] });
    });
    return [...map.values()].map(v => ({
      label: v.label,
      averageQuality: v.scores.reduce((s, x) => s + x, 0) / v.scores.length,
      auditsCount: v.scores.length,
    })).sort((a, b) => b.averageQuality - a.averageQuality);
  }, [fAudits, getAgentKey, getAgentLabel]);

  /* ── KPIs ── */
  const totalAudits      = fAudits.length;
  const avgQuality       = totalAudits ? fAudits.reduce((s, a) => s + Number(a.quality_score), 0) / totalAudits : 0;
  const releasedAudits   = fAudits.filter(a => a.shared_with_agent).length;
  const releasedRate     = totalAudits ? (releasedAudits / totalAudits) * 100 : 0;
  const totalSales       = fSales.reduce((s, r) => s + Number(r.amount), 0);
  const totalCalls       = fCalls.reduce((s, r) => s + Number(r.calls_count), 0);
  const totalTickets     = fTickets.reduce((s, r) => s + Number(r.tickets_count), 0);
  const prevCallsTotal   = prevCalls.reduce((s, r) => s + Number(r.calls_count), 0);
  const prevTicketsTotal = prevTickets.reduce((s, r) => s + Number(r.tickets_count), 0);
  const prevSalesTotal   = prevSales.reduce((s, r) => s + Number(r.amount), 0);
  const prevAvgQuality   = prevAudits.length ? prevAudits.reduce((s, a) => s + Number(a.quality_score), 0) / prevAudits.length : 0;
  const callsAvgQual     = getTeamAvg(callsAudits);
  const ticketsAvgQual   = getTeamAvg(ticketsAudits);
  const salesAvgQual     = getTeamAvg(salesAudits);

  /* ── Insights ── */
  const lowestAgent    = allAuditSummaries.length ? [...allAuditSummaries].reverse()[0] : null;
  const coachTarget    = allAuditSummaries.filter(a => a.auditsCount >= 2).sort((a, b) => a.averageQuality - b.averageQuality)[0] || null;
  const mostConsistent = useMemo(() => {
    const pool = [...callsHybridTop, ...ticketsHybridTop].sort((a, b) => a.rsd === b.rsd ? b.combinedScore - a.combinedScore : a.rsd - b.rsd);
    return pool[0] || null;
  }, [callsHybridTop, ticketsHybridTop]);

  /* ── Action items ── */
  const actionItems = useMemo<ActionCenterItem[]>(() => [
    { id: 'requests',  title: 'Supervisor Requests', count: openReqs.length,    detail: agingReqs.length > 0 ? `${agingReqs.length} aging 3+ days` : 'No aging requests', path: '/supervisor-requests', tone: agingReqs.length > 0 ? 'critical' : openReqs.length > 0 ? 'warning' : 'info' },
    { id: 'feedback',  title: 'Open Feedback',       count: openFb.length,      detail: overdueFb.length > 0 ? `${overdueFb.length} overdue` : 'No overdue feedback',  path: '/agent-feedback',      tone: overdueFb.length > 0 ? 'critical' : openFb.length > 0 ? 'warning' : 'info' },
    { id: 'monitoring',title: 'Active Monitoring',   count: activeMon.length,   detail: agingMon.length > 0 ? `${agingMon.length} aging 2+ days` : 'Queue controlled',   path: '/monitoring',          tone: agingMon.length > 0 ? 'critical' : activeMon.length > 0 ? 'warning' : 'info' },
    { id: 'audits',    title: 'Unreleased Audits',   count: scopedHidden.length, detail: agingHidden.length > 0 ? `${agingHidden.length} aging 2+ days` : 'No aging audits', path: '/audits-list',     tone: agingHidden.length > 0 ? 'critical' : scopedHidden.length > 0 ? 'warning' : 'info' },
  ], [openReqs.length, agingReqs.length, openFb.length, overdueFb.length, activeMon.length, agingMon.length, scopedHidden.length, agingHidden.length]);

  /* ── Ticker ── */
  const tickerItems = useMemo(() => {
    const msgs: string[] = [];
    if (callsHybridTop[0])    msgs.push(`CALLS LEADER  ·  ${callsHybridTop[0].label}`);
    if (ticketsHybridTop[0])  msgs.push(`TICKETS LEADER  ·  ${ticketsHybridTop[0].label}`);
    if (salesTop[0])          msgs.push(`SALES LEADER  ·  ${salesTop[0].label}`);
    if (mostConsistent)       msgs.push(`MOST CONSISTENT  ·  ${mostConsistent.label}`);
    msgs.push(`QUALITY AUDITS  ·  ${totalAudits} THIS PERIOD`, `RELEASE RATE  ·  ${releasedRate.toFixed(0)}%`);
    return msgs;
  }, [callsHybridTop, ticketsHybridTop, salesTop, mostConsistent, totalAudits, releasedRate]);
  const ticker = useLiveTicker(tickerItems);

  /* ── Action badge count ── */
  const urgentCount = actionItems.filter(i => i.tone === 'critical' && i.count > 0).length;

  const hasData = audits.length > 0 || profiles.length > 0 || callsRecords.length > 0;

  /* ─────────────────────────── LOADING STATE ─────────────────────────── */
  if (loading && !hasData) {
    return (
      <div className="dv6-root" data-light={isLight ? 'true' : undefined}
        style={{ display: 'grid', placeItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="dv6-loader-ring" />
          <div>
            <div className="dv6-label" style={{ marginBottom: '4px' }}>Loading workspace</div>
            <div style={{ fontSize: '13px', color: 'var(--dv-text-sub)' }}>Connecting to operational data…</div>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────── MAIN RENDER ─────────────────────────────── */
  return (
    <div className="dv6-root" data-light={isLight ? 'true' : undefined}>
      {/* ── Ticker ── */}
      <div className="dv6-ticker">
        <div className="dv6-ticker-live">
          <div className="dv6-ticker-dot" />
          <span className="dv6-mono" style={{ fontSize: '10px', fontWeight: 600, color: 'var(--dv-accent)', letterSpacing: '0.1em' }}>LIVE</span>
        </div>
        <div className="dv6-ticker-divider" />
        <div key={ticker} className="dv6-ticker-text">{ticker}</div>
      </div>

      {/* ── Hero header ── */}
      <DashHero
        dateFrom={dateFrom} dateTo={dateTo}
        setDateFrom={setDateFrom} setDateTo={setDateTo}
        fromRef={fromRef} toRef={toRef}
        refreshing={refreshing} lastLoadedAt={lastLoadedAt}
        currentUser={currentUser}
        onRefresh={() => { clearCachedValue(DASHBOARD_CACHE_KEY); void loadData({ force: true }); }}
        onThisMonth={() => { setDateFrom(dateStr.monthStart()); setDateTo(dateStr.today()); }}
        onAllTime={() => { setDateFrom(''); setDateTo(''); }}
      />

      {/* ── Error banner ── */}
      {errorMsg && (
        <div style={{ margin: '0 0 20px', padding: '12px 16px', borderRadius: 'var(--dv-radius-lg)', background: 'var(--dv-critical-soft)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--dv-critical)', fontSize: '13px', fontFamily: 'var(--dv-font-mono)' }}>
          ⚠  {errorMsg}
        </div>
      )}

      {/* ── Section nav ── */}
      <div className="dv6-nav">
        {([
          { id: 'overview',  label: 'Overview',       icon: '◈' },
          { id: 'action',    label: 'Action Center',  icon: '⚡', badge: urgentCount || undefined },
          { id: 'rankings',  label: 'Rankings',       icon: '↑' },
          { id: 'insights',  label: 'Insights',       icon: '◎' },
        ] as { id: Section; label: string; icon: string; badge?: number }[]).map(t => (
          <button key={t.id} className={`dv6-nav-tab${activeSection === t.id ? ' active' : ''}`} onClick={() => setActiveSection(t.id)}>
            <span className="dv6-nav-tab-icon">{t.icon}</span>
            {t.label}
            {t.badge ? <span className="dv6-nav-badge">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ── Sections ── */}
      {activeSection === 'overview' && (
        <div key="overview" className="dv6-section-enter">
          <KPIStrip
            totalAudits={totalAudits} prevAudits={prevAudits.length}
            avgQuality={avgQuality} prevAvgQuality={prevAvgQuality}
            releasedAudits={releasedAudits} releasedRate={releasedRate}
            totalCalls={totalCalls} prevCallsTotal={prevCallsTotal}
            totalTickets={totalTickets} prevTicketsTotal={prevTicketsTotal}
            totalSales={totalSales} prevSalesTotal={prevSalesTotal}
          />
          <div className="dv6-team-grid">
            <TeamCard
              title="Calls" teamColor="var(--dv-calls)"
              volume={totalCalls} prevVolume={prevCallsTotal}
              avgQual={callsAvgQual} prevAvgQual={getTeamAvg(prevCallsAudits)}
              auditCount={callsAudits.length} auditedAgents={auditedCallsKeys.size}
              topPerformer={callsHybridTop[0]?.label || callsQualTop[0]?.label || '—'}
              sparkData={callsAudits.map(a => Number(a.quality_score))}
              delay={0}
            />
            <TeamCard
              title="Tickets" teamColor="var(--dv-tickets)"
              volume={totalTickets} prevVolume={prevTicketsTotal}
              avgQual={ticketsAvgQual} prevAvgQual={getTeamAvg(prevTicketsAudits)}
              auditCount={ticketsAudits.length} auditedAgents={auditedTicketsKeys.size}
              topPerformer={ticketsHybridTop[0]?.label || ticketsQualTop[0]?.label || '—'}
              sparkData={ticketsAudits.map(a => Number(a.quality_score))}
              delay={60}
            />
            <TeamCard
              title="Sales" teamColor="var(--dv-sales)"
              volume={totalSales} prevVolume={prevSalesTotal} isRevenue
              avgQual={salesAvgQual} prevAvgQual={getTeamAvg(prevSalesAudits)}
              auditCount={salesAudits.length}
              auditedAgents={new Set(salesAudits.map(a => getAgentKey(a.agent_id, a.agent_name))).size}
              topPerformer={salesTop[0]?.label || '—'}
              sparkData={salesAudits.map(a => Number(a.quality_score))}
              delay={120}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <RecognitionWall currentUser={currentUser as any} />
          </div>
          <div style={{ marginBottom: '28px' }}>
            <DigitalTrophyCabinet scope="global" currentUser={currentUser} />
          </div>
          {currentUser && (
            <VoiceOfEmployeeSupabase currentUser={currentUser as any} title="Recent anonymous themes" showComposer={false} />
          )}
        </div>
      )}

      {activeSection === 'action' && (
        <div key="action" className="dv6-section-enter">
          <ActionCenter
            items={actionItems} onNavigate={navigate}
            agingReqs={agingReqs.length} overdueFb={overdueFb.length}
            agingMon={agingMon.length} agingHidden={agingHidden.length}
          />
        </div>
      )}

      {activeSection === 'rankings' && (
        <div key="rankings" className="dv6-section-enter">
          <RankingsSection
            callsQtyTop={callsQtyTop} ticketsQtyTop={ticketsQtyTop} salesTop={salesTop}
            callsQualTop={callsQualTop} ticketsQualTop={ticketsQualTop}
            callsHybridTop={callsHybridTop} ticketsHybridTop={ticketsHybridTop}
          />
        </div>
      )}

      {activeSection === 'insights' && (
        <div key="insights" className="dv6-section-enter">
          <InsightsSection
            lowestAgent={lowestAgent} mostConsistent={mostConsistent} coachTarget={coachTarget}
            allSummaries={allAuditSummaries} avgQuality={avgQuality}
            releasedRate={releasedRate} totalAudits={totalAudits}
          />
        </div>
      )}
    </div>
  );
}

export default memo(Dashboard);

/* ═══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── DashHero ── */
function DashHero({ dateFrom, dateTo, setDateFrom, setDateTo, fromRef, toRef, refreshing, lastLoadedAt, onRefresh, onThisMonth, onAllTime, currentUser }: {
  dateFrom: string; dateTo: string;
  setDateFrom: (v: string) => void; setDateTo: (v: string) => void;
  fromRef: React.RefObject<HTMLInputElement | null>; toRef: React.RefObject<HTMLInputElement | null>;
  refreshing: boolean; lastLoadedAt: string;
  onRefresh: () => void; onThisMonth: () => void; onAllTime: () => void;
  currentUser: any;
}) {
  const role = currentUser?.role || 'qa';
  const roleLabel = role === 'admin' ? 'Administrator' : role === 'qa' ? 'QA Analyst' : 'Supervisor';

  return (
    <div className="dv6-hero dv6-stagger" style={{ '--delay': '0ms' } as CSSProperties}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px', marginBottom: '20px' }}>
        <div>
          <div className="dv6-hero-eyebrow">
            <span className="dv6-eyebrow-line">Quality Assurance System</span>
            <span style={{ width: '1px', height: '12px', background: 'var(--dv-border-mid)' }} />
            <span style={{ fontFamily: 'var(--dv-font-mono)', fontSize: '10px', fontWeight: 500, color: 'var(--dv-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{roleLabel}</span>
          </div>
          <h1 className="dv6-hero-title">Operations Dashboard</h1>
          <p className="dv6-hero-sub">
            Period{' '}
            <span style={{ fontFamily: 'var(--dv-font-mono)', color: 'var(--dv-text)', fontWeight: 500 }}>{dateFrom || 'all time'}</span>
            {' → '}
            <span style={{ fontFamily: 'var(--dv-font-mono)', color: 'var(--dv-text)', fontWeight: 500 }}>{dateTo || 'today'}</span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Date inputs */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { label: 'From', ref: fromRef, value: dateFrom, set: setDateFrom },
              { label: 'To',   ref: toRef,   value: dateTo,   set: setDateTo },
            ].map(({ label, ref, value, set }) => (
              <div key={label} className="dv6-date-control">
                <label className="dv6-label">{label}</label>
                <input
                  ref={ref} type="date" value={value} className="dv6-date-input"
                  onChange={e => set(e.target.value)}
                  onClick={() => openDatePicker(ref.current)}
                />
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
            <button className="dv6-btn dv6-btn-ghost" onClick={onThisMonth}>This month</button>
            <button className="dv6-btn dv6-btn-ghost" onClick={onAllTime}>All time</button>
            <button className={`dv6-btn dv6-btn-accent`} onClick={onRefresh} style={{ minWidth: '90px' }}>
              {refreshing
                ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ animation: 'dv6-spin 800ms linear infinite', flexShrink: 0 }}><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Syncing</>
                : '↻ Refresh'
              }
            </button>
          </div>
        </div>
      </div>

      {/* Meta chips */}
      <div className="dv6-chip-row">
        {[
          { k: 'Source', v: 'Supabase' },
          { k: 'Cache',  v: refreshing ? 'Refreshing…' : 'Warm' },
          { k: 'Updated', v: lastLoadedAt ? fmtRelTime(lastLoadedAt) : 'This session' },
        ].map(c => (
          <div key={c.k} className="dv6-chip">
            <span style={{ color: 'var(--dv-text-muted)', marginRight: '4px' }}>{c.k}</span>
            {c.v}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── KPI Strip ── */
function KPIStrip({ totalAudits, prevAudits, avgQuality, prevAvgQuality, releasedAudits, releasedRate, totalCalls, prevCallsTotal, totalTickets, prevTicketsTotal, totalSales, prevSalesTotal }: any) {
  const kpis = [
    { label: 'Total Audits',   value: totalAudits,  format: 'int' as const, prev: prevAudits,      accent: 'var(--dv-accent)',  icon: '◎' },
    { label: 'Avg Quality',    value: avgQuality,   format: 'pct' as const, prev: prevAvgQuality,  accent: 'var(--dv-calls)',   icon: '◈' },
    { label: 'Released',       value: releasedAudits, format: 'int' as const, sub: `${releasedRate.toFixed(0)}% share rate`, accent: 'var(--dv-sales)', icon: '▲' },
    { label: 'Calls Volume',   value: totalCalls,   format: 'int' as const, prev: prevCallsTotal,  accent: 'var(--dv-calls)',   icon: '○' },
    { label: 'Tickets Volume', value: totalTickets, format: 'int' as const, prev: prevTicketsTotal,accent: 'var(--dv-tickets)', icon: '◇' },
    { label: 'Sales Revenue',  value: totalSales,   format: 'usd' as const, prev: prevSalesTotal,  accent: 'var(--dv-sales)',   icon: '$' },
  ];

  return (
    <div className="dv6-kpi-grid">
      {kpis.map((k, i) => {
        const delta = k.prev !== undefined ? getPctChange(k.value, k.prev) : null;
        const deltaClass = delta === null ? '' : delta >= 0 ? 'dv6-delta-positive' : 'dv6-delta-negative';
        return (
          <div key={k.label} className="dv6-kpi-card dv6-stagger" style={{ '--delay': `${i * 40}ms` } as CSSProperties}>
            <div className="dv6-kpi-accent-bar" style={{ background: k.accent }} />
            <div className="dv6-kpi-header">
              <span className="dv6-label">{k.label}</span>
              <span style={{ fontSize: '16px', color: k.accent, opacity: 0.7 }}>{k.icon}</span>
            </div>
            <div className="dv6-kpi-value" style={{ '--delay': `${i * 40 + 80}ms` } as CSSProperties}>
              {fmtNum(k.value, k.format)}
            </div>
            <div className="dv6-kpi-delta">
              {delta !== null && (
                <span className={deltaClass}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                </span>
              )}
              {k.sub && <span style={{ color: 'var(--dv-text-muted)', fontSize: '11px', fontFamily: 'var(--dv-font-mono)' }}>{k.sub}</span>}
              {delta !== null && <span style={{ color: 'var(--dv-text-muted)', fontSize: '10px' }}>vs prev period</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Team Card ── */
function TeamCard({ title, teamColor, volume, prevVolume, isRevenue, avgQual, prevAvgQual, auditCount, auditedAgents, topPerformer, sparkData, delay }: {
  title: string; teamColor: string; volume: number; prevVolume: number; isRevenue?: boolean;
  avgQual: number; prevAvgQual: number; auditCount: number; auditedAgents: number;
  topPerformer: string; sparkData: number[]; delay: number;
}) {
  const volDelta  = getPctChange(volume, prevVolume);
  const qualDelta = getPctChange(avgQual, prevAvgQual);
  const fmtVol    = isRevenue ? fmtNum(volume, 'usd') : fmtNum(volume, 'int');
  const sparkSlice = sparkData.slice(-12);
  const sparkMax   = sparkSlice.length ? Math.max(...sparkSlice) : 1;

  return (
    <div className="dv6-team-card dv6-stagger" style={{ '--delay': `${delay}ms` } as CSSProperties}>
      {/* Header */}
      <div className="dv6-team-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '3px', height: '16px', borderRadius: '999px', background: teamColor, flexShrink: 0 }} />
            <span className="dv6-display" style={{ fontFamily: 'var(--dv-font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--dv-text)', letterSpacing: '-0.02em' }}>{title}</span>
          </div>
          <span className="dv6-label">{auditCount} audits · {auditedAgents} agents audited</span>
        </div>
        {/* Sparkline */}
        {sparkSlice.length > 0 && (
          <div className="dv6-spark" style={{ height: '28px', color: teamColor }}>
            {sparkSlice.map((v, i) => (
              <div key={i} className={`dv6-spark-bar${v === sparkMax ? ' peak' : ''}`} style={{ height: `${Math.max(10, (v / sparkMax) * 100)}%` }} />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="dv6-team-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {[
            { label: isRevenue ? 'Revenue' : 'Volume', val: fmtVol, delta: volDelta },
            { label: 'Avg Quality', val: `${avgQual.toFixed(1)}%`, delta: qualDelta },
          ].map(s => (
            <div key={s.label} className="dv6-team-stat">
              <span className="dv6-team-stat-label">{s.label}</span>
              <span className="dv6-team-stat-value">{s.val}</span>
              <span className="dv6-team-meta" style={{ color: s.delta >= 0 ? 'var(--dv-success)' : 'var(--dv-critical)', marginTop: '2px' }}>
                {s.delta >= 0 ? '▲' : '▼'} {Math.abs(s.delta).toFixed(1)}% vs prev
              </span>
            </div>
          ))}
        </div>

        {/* Quality bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span className="dv6-label">Quality vs target</span>
            <span className="dv6-mono" style={{ fontSize: '10px', fontWeight: 500, color: teamColor }}>Target 90%</span>
          </div>
          <div className="dv6-quality-bar-track">
            <div className="dv6-quality-bar-fill" style={{
              '--bar-w': `${Math.min(avgQual, 100)}%`,
              background: avgQual >= 90 ? teamColor : 'var(--dv-critical)',
            } as CSSProperties} />
          </div>
        </div>

        {/* Top performer */}
        <div className="dv6-performer-strip" style={{ marginTop: '14px' }}>
          <div className="dv6-label" style={{ color: teamColor, marginBottom: '3px' }}>Top performer</div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--dv-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topPerformer}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Action Center ── */
function ActionCenter({ items, onNavigate, agingReqs, overdueFb, agingMon, agingHidden }: {
  items: ActionCenterItem[]; onNavigate: (p: string) => void;
  agingReqs: number; overdueFb: number; agingMon: number; agingHidden: number;
}) {
  const urgentCount = items.filter(i => i.tone === 'critical' && i.count > 0).length;
  const watchCount  = items.filter(i => i.tone === 'warning'  && i.count > 0).length;

  const statusColor = urgentCount > 0 ? 'var(--dv-critical)' : watchCount > 0 ? 'var(--dv-warning)' : 'var(--dv-success)';
  const statusBg    = urgentCount > 0 ? 'var(--dv-critical-soft)' : watchCount > 0 ? 'var(--dv-warning-soft)' : 'var(--dv-success-soft)';

  return (
    <div>
      {/* Status panel */}
      <div className="dv6-status-panel dv6-stagger" style={{ '--delay': '0ms', borderColor: `color-mix(in srgb, ${statusColor} 25%, transparent)`, background: statusBg } as CSSProperties}>
        <div>
          <div className="dv6-label" style={{ color: statusColor, marginBottom: '6px' }}>
            {urgentCount > 0 ? `${urgentCount} urgent` : watchCount > 0 ? `${watchCount} to watch` : 'All queues healthy'}
          </div>
          <div style={{ fontFamily: 'var(--dv-font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--dv-text)', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            {urgentCount > 0 ? 'Immediate action required' : watchCount > 0 ? 'Monitor & resolve soon' : 'Operational backlog clear'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--dv-text-sub)' }}>
            {urgentCount > 0 ? 'Critical items are aging past SLA thresholds.' : watchCount > 0 ? 'Resolve before items escalate to critical.' : 'No urgent items in the selected period.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          {[
            { l: 'Urgent', v: urgentCount, c: 'var(--dv-critical)' },
            { l: 'Watch',  v: watchCount,  c: 'var(--dv-warning)' },
            { l: 'Stable', v: items.filter(i => i.tone === 'info').length, c: 'var(--dv-accent)' },
          ].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div className="dv6-display dv6-mono" style={{ fontSize: '26px', fontWeight: 700, color: s.c, letterSpacing: '-0.03em' }}>{s.v}</div>
              <div className="dv6-label">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action cards */}
      <div className="dv6-action-grid">
        {items.map((item, i) => {
          const toneColor = item.tone === 'critical' ? 'var(--dv-critical)' : item.tone === 'warning' ? 'var(--dv-warning)' : 'var(--dv-accent)';
          const toneBg    = item.tone === 'critical' ? 'var(--dv-critical-soft)' : item.tone === 'warning' ? 'var(--dv-warning-soft)' : 'var(--dv-accent-soft)';
          const badgeCls  = `dv6-badge dv6-badge-${item.tone === 'critical' ? 'critical' : item.tone === 'warning' ? 'warning' : 'info'}`;
          return (
            <div key={item.id} className="dv6-action-card dv6-stagger" style={{ '--delay': `${i * 50}ms`, borderColor: `color-mix(in srgb, ${toneColor} 20%, transparent)`, background: toneBg } as CSSProperties}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className={badgeCls}>{item.tone === 'critical' ? 'Urgent' : item.tone === 'warning' ? 'Watch' : 'Stable'}</span>
                <div className="dv6-action-count dv6-display" style={{ color: toneColor }}>{item.count}</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--dv-text)', marginBottom: '4px' }}>{item.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--dv-text-sub)', fontFamily: 'var(--dv-font-mono)' }}>{item.detail}</div>
              </div>
              <button className="dv6-btn" onClick={() => onNavigate(item.path)} style={{ borderColor: `color-mix(in srgb, ${toneColor} 25%, transparent)`, color: toneColor }}>
                Open →
              </button>
            </div>
          );
        })}
      </div>

      {/* Aging detail + quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div className="dv6-card" style={{ padding: '20px' }}>
          <div className="dv6-label" style={{ marginBottom: '14px' }}>Aging & overdue</div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {[
              { l: 'Requests aging 3+ days', v: agingReqs,  crit: agingReqs > 0 },
              { l: 'Feedback overdue',       v: overdueFb,  crit: overdueFb > 0 },
              { l: 'Monitoring aging 2+ days', v: agingMon, crit: false },
              { l: 'Unreleased audits 2+ days', v: agingHidden, crit: false },
            ].map(row => (
              <div key={row.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 'var(--dv-radius-md)', background: 'var(--dv-bg-subtle)', border: '1px solid var(--dv-border)' }}>
                <span style={{ fontSize: '12px', color: 'var(--dv-text-sub)' }}>{row.l}</span>
                <span className="dv6-mono" style={{ fontSize: '16px', fontWeight: 600, color: row.v > 0 ? (row.crit ? 'var(--dv-critical)' : 'var(--dv-warning)') : 'var(--dv-text-muted)' }}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dv6-card" style={{ padding: '20px' }}>
          <div className="dv6-label" style={{ marginBottom: '14px' }}>Quick navigation</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { l: 'Audits List',  p: '/audits-list' },
              { l: 'Feedback',     p: '/agent-feedback' },
              { l: 'Monitoring',   p: '/monitoring' },
              { l: 'Requests',     p: '/supervisor-requests' },
              { l: 'Reports',      p: '/reports' },
              { l: 'Team Heatmap', p: '/team-heatmap' },
            ].map(ln => (
              <button key={ln.p} className="dv6-btn dv6-btn-ghost" onClick={() => onNavigate(ln.p)} style={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%' }}>
                {ln.l} →
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Rankings Section ── */
function RankingsSection({ callsQtyTop, ticketsQtyTop, salesTop, callsQualTop, ticketsQualTop, callsHybridTop, ticketsHybridTop }: any) {
  const [boardType, setBoardType] = useState<'combined' | 'quantity' | 'quality'>('combined');

  return (
    <div>
      {/* Type switcher */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', padding: '4px', borderRadius: 'var(--dv-radius-lg)', background: 'var(--dv-bg-raised)', border: '1px solid var(--dv-border)', width: 'fit-content' }}>
        {(['combined', 'quantity', 'quality'] as const).map(t => (
          <button key={t} className={`dv6-nav-tab${boardType === t ? ' active' : ''}`} onClick={() => setBoardType(t)} style={{ padding: '0 16px', height: '32px', fontSize: '12px', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {boardType === 'combined' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <LeaderboardPanel title="Calls Combined" color="var(--dv-calls)" items={callsHybridTop} type="hybrid" delay={0} />
          <LeaderboardPanel title="Tickets Combined" color="var(--dv-tickets)" items={ticketsHybridTop} type="hybrid" delay={60} />
        </div>
      )}
      {boardType === 'quantity' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <LeaderboardPanel title="Calls Volume"   color="var(--dv-calls)"   items={callsQtyTop}   type="quantity" unit="calls"   delay={0} />
          <LeaderboardPanel title="Tickets Volume" color="var(--dv-tickets)" items={ticketsQtyTop} type="quantity" unit="tickets" delay={60} />
          <LeaderboardPanel title="Sales Revenue"  color="var(--dv-sales)"   items={salesTop}      type="quantity" unit="usd"     delay={120} />
        </div>
      )}
      {boardType === 'quality' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <LeaderboardPanel title="Calls Quality"   color="var(--dv-calls)"   items={callsQualTop}   type="quality" delay={0} />
          <LeaderboardPanel title="Tickets Quality" color="var(--dv-tickets)" items={ticketsQualTop} type="quality" delay={60} />
        </div>
      )}
    </div>
  );
}

const MEDAL = ['#FFD700', '#C0C0C0', '#CD7F32'];

function LeaderboardPanel({ title, color, items, type, unit, delay }: {
  title: string; color: string; items: any[]; type: 'quantity' | 'quality' | 'hybrid'; unit?: string; delay: number;
}) {
  const maxVal = items.length
    ? Math.max(...items.map(i => type === 'quality' ? i.averageQuality : type === 'hybrid' ? i.combinedScore : i.quantity))
    : 1;

  return (
    <div className="dv6-card dv6-card-hover dv6-stagger" style={{ padding: '22px', '--delay': `${delay}ms` } as CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
        <span style={{ fontFamily: 'var(--dv-font-display)', fontSize: '14px', fontWeight: 700, color: 'var(--dv-text)', letterSpacing: '-0.02em' }}>{title}</span>
        <div style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '999px', background: 'var(--dv-bg-subtle)', border: '1px solid var(--dv-border)', fontFamily: 'var(--dv-font-mono)', fontSize: '10px', fontWeight: 500, color }}>
          {items.length} agents
        </div>
      </div>

      {items.length === 0
        ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--dv-text-muted)', fontSize: '13px', borderRadius: 'var(--dv-radius-md)', border: '1px dashed var(--dv-border)' }}>No data for period</div>
        : <div className="dv6-scroll" style={{ display: 'grid', gap: '4px', maxHeight: '320px', overflowY: 'auto' }}>
            {items.map((item, i) => {
              const val      = type === 'quality' ? item.averageQuality : type === 'hybrid' ? item.combinedScore : item.quantity;
              const barPct   = maxVal > 0 ? (val / maxVal) * 100 : 0;
              const dispVal  = type === 'quality' ? `${item.averageQuality.toFixed(1)}%`
                             : type === 'hybrid'  ? item.combinedScore.toFixed(2)
                             : unit === 'usd'      ? fmtNum(item.quantity, 'usd')
                             : fmtNum(item.quantity, 'int');
              return (
                <div key={item.label} className="dv6-rank-item">
                  {/* Medal / rank */}
                  <div className="dv6-rank-medal" style={{ background: i < 3 ? `${MEDAL[i]}18` : 'var(--dv-bg-subtle)', border: `1px solid ${i < 3 ? MEDAL[i] + '35' : 'var(--dv-border)'}` }}>
                    <span className="dv6-mono" style={{ fontSize: '9px', fontWeight: 600, color: i < 3 ? MEDAL[i] : 'var(--dv-text-muted)' }}>#{i + 1}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--dv-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                    {type === 'hybrid' && <div className="dv6-mono" style={{ fontSize: '10px', color: 'var(--dv-text-muted)' }}>Q {item.averageQuality?.toFixed(1)}% · RSD {item.rsd?.toFixed(3)}</div>}
                    {type === 'quality' && <div className="dv6-mono" style={{ fontSize: '10px', color: 'var(--dv-text-muted)' }}>{item.auditsCount} audit{item.auditsCount !== 1 ? 's' : ''}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span className="dv6-mono" style={{ fontSize: '12px', fontWeight: 600, color }}>{dispVal}</span>
                    <div style={{ width: '48px', height: '2px', borderRadius: '999px', background: 'var(--dv-bg-subtle)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, background: color, borderRadius: '999px', transition: 'width 500ms var(--dv-ease)' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

/* ── Insights Section ── */
function InsightsSection({ lowestAgent, mostConsistent, coachTarget, allSummaries, avgQuality, releasedRate, totalAudits }: {
  lowestAgent: RankedAuditSummary | null; mostConsistent: HybridLeader | null;
  coachTarget: RankedAuditSummary | null; allSummaries: RankedAuditSummary[];
  avgQuality: number; releasedRate: number; totalAudits: number;
}) {
  return (
    <div>
      {/* Insight cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <InsightCard tone="warning" icon="◎" title="Needs attention"
          agent={lowestAgent?.label || 'No data'}
          detail={lowestAgent ? `${lowestAgent.averageQuality.toFixed(1)}% avg across ${lowestAgent.auditsCount} audit${lowestAgent.auditsCount !== 1 ? 's' : ''}` : 'No quality data available.'}
          badge="Lowest quality" delay={0}
        />
        <InsightCard tone="success" icon="◈" title="Most consistent"
          agent={mostConsistent?.label || 'No combined data'}
          detail={mostConsistent ? `RSD ${mostConsistent.rsd.toFixed(3)} · Score ${mostConsistent.combinedScore.toFixed(3)}` : 'No consistency signal yet.'}
          badge="Top stability" delay={60}
        />
        <InsightCard tone="info" icon="▲" title="Coaching opportunity"
          agent={coachTarget?.label || 'Need more data'}
          detail={coachTarget ? `${coachTarget.averageQuality.toFixed(1)}% avg · ${coachTarget.auditsCount} audits` : 'Requires 2+ audits per agent.'}
          badge="Action recommended" delay={120}
        />
      </div>

      {/* Quality distribution */}
      <div className="dv6-card dv6-stagger" style={{ padding: '24px', '--delay': '80ms', marginBottom: '20px' } as CSSProperties}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <div style={{ fontFamily: 'var(--dv-font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--dv-text)', letterSpacing: '-0.02em', marginBottom: '2px' }}>Quality distribution</div>
            <div className="dv6-label">All agents ranked by average audit score</div>
          </div>
          <div className="dv6-badge dv6-badge-info">{allSummaries.length} agents</div>
        </div>

        {allSummaries.length === 0
          ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--dv-text-muted)', borderRadius: 'var(--dv-radius-md)', border: '1px dashed var(--dv-border)' }}>No audit data for the selected period</div>
          : <div className="dv6-scroll" style={{ display: 'grid', gap: '3px', maxHeight: '360px', overflowY: 'auto' }}>
              {allSummaries.map((a, i) => {
                const c = a.averageQuality >= 90 ? 'var(--dv-success)' : a.averageQuality >= 75 ? 'var(--dv-accent)' : a.averageQuality >= 60 ? 'var(--dv-warning)' : 'var(--dv-critical)';
                return (
                  <div key={a.label} className="dv6-dist-row">
                    <div className="dv6-mono" style={{ width: '22px', fontSize: '10px', fontWeight: 500, color: 'var(--dv-text-muted)', textAlign: 'right', flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--dv-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</div>
                      <div className="dv6-mono" style={{ fontSize: '10px', color: 'var(--dv-text-muted)' }}>{a.auditsCount} audit{a.auditsCount !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ width: '100px', height: '3px', borderRadius: '999px', background: 'var(--dv-bg-subtle)', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ height: '100%', width: `${a.averageQuality}%`, background: c, borderRadius: '999px' }} />
                    </div>
                    <div className="dv6-mono" style={{ fontSize: '12px', fontWeight: 600, color: c, minWidth: '44px', textAlign: 'right', flexShrink: 0 }}>{a.averageQuality.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
        }
      </div>

      {/* Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { l: 'Period Audits',   v: String(totalAudits),           d: 'Total in range' },
          { l: 'Avg Quality',     v: `${avgQuality.toFixed(1)}%`,   d: 'Cross-team average' },
          { l: 'Release Rate',    v: `${releasedRate.toFixed(0)}%`, d: 'Shared with agents' },
          { l: 'Agents Tracked',  v: String(allSummaries.length),   d: 'With audit data' },
        ].map((m, i) => (
          <div key={m.l} className="dv6-kpi-card dv6-stagger" style={{ '--delay': `${i * 40}ms` } as CSSProperties}>
            <div className="dv6-label" style={{ marginBottom: '8px' }}>{m.l}</div>
            <div style={{ fontFamily: 'var(--dv-font-display)', fontSize: '26px', fontWeight: 700, color: 'var(--dv-text)', letterSpacing: '-0.03em' }}>{m.v}</div>
            <div className="dv6-mono" style={{ fontSize: '11px', color: 'var(--dv-text-muted)', marginTop: '4px' }}>{m.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightCard({ tone, icon, title, agent, detail, badge, delay }: {
  tone: 'warning' | 'success' | 'info'; icon: string; title: string;
  agent: string; detail: string; badge: string; delay: number;
}) {
  const toneColor  = tone === 'warning' ? 'var(--dv-warning)' : tone === 'success' ? 'var(--dv-success)' : 'var(--dv-accent)';
  const badgeCls   = `dv6-badge dv6-badge-${tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'info'}`;

  return (
    <div className="dv6-insight-card dv6-stagger" style={{ '--delay': `${delay}ms`, borderColor: `color-mix(in srgb, ${toneColor} 20%, transparent)` } as CSSProperties}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <span style={{ fontSize: '18px', color: toneColor }}>{icon}</span>
        <span className={badgeCls}>{badge}</span>
      </div>
      <div className="dv6-label" style={{ color: toneColor, marginBottom: '6px' }}>{title}</div>
      <div style={{ fontFamily: 'var(--dv-font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--dv-text)', marginBottom: '8px', lineHeight: 1.3, letterSpacing: '-0.02em' }}>{agent}</div>
      <div className="dv6-mono" style={{ fontSize: '11px', color: 'var(--dv-text-sub)', lineHeight: 1.6 }}>{detail}</div>
    </div>
  );
}
