/**
 * Dashboard.tsx — Apex Ops  ·  v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained SaaS operations dashboard.
 *
 * Sections:
 *   • Left sidebar  — logo, grouped nav, user identity footer
 *   • Top header    — search, notifications, avatar, CTA button
 *   • KPI strip     — 5 metric cards with delta chips
 *   • Main content  — bar chart (recharts) + activity table + side panels
 *   • Filters       — date range, department, status selects
 *   • Status badges — Active / Pending / Failed / Completed
 *
 * Design tokens injected via a single <style> tag (DASH_CSS).
 * Light / dark aware via CSS custom properties — no hard-coded colours in JSX.
 * All data is prop-driven; swap the static MOCK_* constants for real fetches.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  memo,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type BadgeStatus = 'Active' | 'Pending' | 'Failed' | 'Completed';
type DeltaDir    = 'up' | 'down' | 'neutral';




interface KpiDef {
  trend?: { val: number }[];
  label:   string;
  value:   string;
  icon:    string;
  iconBg:  string;
  iconColor: string;
  delta:   string;
  dir:     DeltaDir;
  sub:     string;
}

interface ActivityRow {
  id:         string;
  record:     string;
  department: string;
  assignee:   string;
  updated:    string;
  status:     BadgeStatus;
}

interface ChartDatum {
  day:       string;
  Completed: number;
  Pending:   number;
}

interface DeptProgress {
  name:    string;
  pct:     number;
  color:   string;
}

interface QuickStat {
  label: string;
  value: string;
}

interface DashboardProps {
  /** User info shown in sidebar footer + header avatar */
  currentUser?: {
    name?:        string | null;
    initials?:    string | null;
    role?:        string | null;
    email?:       string | null;
  } | null;
  /** Called when the "New record" CTA is clicked */
  onNewRecord?: () => void;
  /** Override KPI data — defaults to MOCK_KPIS */
  kpis?: KpiDef[];
  /** Override chart data — defaults to MOCK_CHART */
  chartData?: ChartDatum[];
  /** Override activity rows — defaults to MOCK_ACTIVITY */
  activityRows?: ActivityRow[];
  /** Override department progress — defaults to MOCK_DEPT */
  deptProgress?: DeptProgress[];
  /** Override quick stats — defaults to MOCK_STATS */
  quickStats?: QuickStat[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   CSS INJECTION
   ═══════════════════════════════════════════════════════════════════════════ */

const DASH_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── Token layer ── */
.db-root {
  --db-font-body:    var(--font-sans, 'Inter', system-ui, sans-serif);
  --db-font-mono:    var(--font-mono, 'Geist Mono', monospace);

  /* Geometry */
  --db-r-sm:  8px;
  --db-r-md:  10px;
  --db-r-lg:  14px;
  --db-r-xl:  20px;

  /* Motion */
  --db-ease:      cubic-bezier(0.16, 1, 0.3, 1);
  --db-dur-fast:  120ms;
  --db-dur-mid:   220ms;

  /* Palette aligned with project tokens */
  --db-page:          var(--bg-base);
  --db-surface:       var(--bg-elevated);
  --db-surface-alt:   var(--bg-subtle);
  --db-surface-hover: var(--bg-subtle-hover);
  --db-border:        var(--border);
  --db-border-mid:    var(--border-strong);
  --db-border-strong: rgba(255,255,255,0.15);
  --db-text:          var(--fg-default);
  --db-text-sub:      var(--fg-muted);
  --db-text-muted:    var(--fg-subtle);

  /* Accent — blue */
  --db-accent:        var(--accent-blue);
  --db-accent-soft:   color-mix(in srgb, var(--accent-blue) 10%, transparent);
  --db-accent-text:   var(--accent-blue);

  /* Semantic */
  --db-success:       var(--accent-emerald);
  --db-success-bg:    color-mix(in srgb, var(--accent-emerald) 10%, transparent);
  --db-success-text:  var(--accent-emerald);
  --db-warning:       var(--accent-amber);
  --db-warning-bg:    color-mix(in srgb, var(--accent-amber) 10%, transparent);
  --db-warning-text:  var(--accent-amber);
  --db-danger:        var(--accent-rose);
  --db-danger-bg:     color-mix(in srgb, var(--accent-rose) 10%, transparent);
  --db-danger-text:   var(--accent-rose);
  --db-info:          var(--accent-blue);
  --db-info-bg:       color-mix(in srgb, var(--accent-blue) 10%, transparent);
  --db-info-text:     var(--accent-blue);

  /* Chart */
  --db-chart-a:  var(--accent-blue);
  --db-chart-b:  var(--accent-violet);
  --db-glass-bg: rgba(15, 15, 24, 0.7);
  --db-glass-border: rgba(255, 255, 255, 0.08);
}

/* ── Dark mode overrides ── */
[data-theme="dark"] .db-root,
.db-root[data-dark="true"] {
  --db-glass-bg: rgba(15, 15, 24, 0.7);
}
[data-theme="light"] .db-root {
  --db-glass-bg: rgba(255, 255, 255, 0.7);
}

/* ── Base ── */
.db-root {
  font-family: var(--db-font-body);
  background:  var(--db-page);
  color:       var(--db-text);
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
}
.db-root *, .db-root *::before, .db-root *::after { box-sizing: border-box; }
.db-root button { font-family: var(--db-font-body); cursor: pointer; }
.db-root input,
.db-root select { font-family: var(--db-font-body); }

/* ── Main content ── */
.db-main { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }

.db-page-title { font-size: 26px; font-weight: 800; color: var(--db-text); letter-spacing: -0.03em; }
.db-page-sub   { font-size: 12px; color: var(--db-text-sub); margin-top: 2px; }

/* ── KPI strip ── */
.db-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.db-kpi-card {
  background: var(--db-glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--db-glass-border);
  border-radius: var(--db-r-lg);
  padding: 18px;
  transition: all var(--db-dur-mid) var(--db-ease);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
.db-kpi-card:hover { border-color: var(--db-border-mid); transform: translateY(-1px); }
.db-kpi-top  { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.db-kpi-lbl  { font-size: 11px; color: var(--db-text-sub); font-weight: 500; }
.db-kpi-icon {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.db-kpi-val  { font-size: 22px; font-weight: 600; color: var(--db-text); line-height: 1; margin-bottom: 6px; font-variant-numeric: tabular-nums; }
.db-kpi-dl   { display: flex; align-items: center; gap: 5px; }
.db-chip     { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
.db-chip-up  { background: var(--db-success-bg); color: var(--db-success-text); }
.db-chip-dn  { background: var(--db-danger-bg);  color: var(--db-danger-text);  }
.db-chip-nu  { background: var(--db-surface-alt); color: var(--db-text-muted); }
.db-kpi-sub  { font-size: 11px; color: var(--db-text-muted); }

/* ── Content grid ── */
.db-content-grid {
  display: grid;
  grid-template-columns: 1fr 256px;
  gap: 14px;
}
.db-left  { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.db-right { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

/* ── Card base ── */
.db-card {
  background: var(--db-glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--db-glass-border);
  border-radius: var(--db-r-lg);
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
}
.db-card-head {
  padding: 13px 16px;
  border-bottom: 1px solid var(--db-border);
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
.db-card-title { font-size: 13px; font-weight: 600; color: var(--db-text); }
.db-card-sub   { font-size: 11px; color: var(--db-text-sub); margin-top: 1px; }

/* ── Filters ── */
.db-filter-row { display: flex; gap: 6px; flex-wrap: wrap; }
.db-filter-sel {
  padding: 0 10px; height: 28px;
  border-radius: var(--db-r-sm);
  border: 1px solid var(--db-border);
  background: var(--db-surface-alt);
  font-size: 11px; color: var(--db-text-sub);
  outline: none; cursor: pointer;
  transition: border-color var(--db-dur-fast) ease;
}
.db-filter-sel:focus { border-color: var(--db-accent); }

/* ── Chart ── */
.db-chart-wrap { padding: 16px 16px 8px; }

/* ── Activity table ── */
.db-tbl-wrap { overflow-x: auto; }
.db-tbl {
  width: 100%; border-collapse: collapse; table-layout: fixed;
  font-size: 12px;
}
.db-tbl th {
  padding: 8px 14px;
  font-size: 10px; font-weight: 600;
  letter-spacing: .05em; text-transform: uppercase;
  color: var(--db-text-muted);
  text-align: left;
  border-bottom: 1px solid var(--db-border);
  background: var(--db-surface-alt);
  white-space: nowrap;
}
.db-tbl td {
  padding: 10px 14px;
  color: var(--db-text);
  border-bottom: 1px solid var(--db-border);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.db-tbl tr:last-child td { border-bottom: none; }
.db-tbl tr:hover td { background: var(--db-surface-hover); }
.db-tbl-mono {
  font-family: var(--db-font-mono);
  font-size: 11px; color: var(--db-text-sub);
}

/* ── Status badges ── */
.db-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px; border-radius: 999px;
  font-size: 10px; font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  border: 1px solid transparent;
}
.db-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.db-badge-active    { background: var(--db-success-bg); color: var(--db-success-text); border-color: color-mix(in srgb, var(--db-success) 20%, transparent); }
.db-badge-pending   { background: var(--db-warning-bg); color: var(--db-warning-text); border-color: color-mix(in srgb, var(--db-warning) 20%, transparent); }
.db-badge-failed    { background: var(--db-danger-bg);  color: var(--db-danger-text); border-color: color-mix(in srgb, var(--db-danger) 20%, transparent); }
.db-badge-completed { background: var(--db-info-bg);    color: var(--db-info-text); border-color: color-mix(in srgb, var(--db-info) 20%, transparent); }

`;
function useDashboardStyles() {
  useEffect(() => {
    const id = 'apex-dashboard-v1';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = DASH_CSS;
    document.head.appendChild(el);
    return () => { document.getElementById(id)?.remove(); };
  }, []);
}

function useIsDark(): boolean {
  const [dark, setDark] = useState(() => {
    if (typeof document === 'undefined') return false;
    const t = (
      document.body.dataset.theme ||
      document.documentElement.dataset.theme ||
      window.localStorage.getItem('da-theme') || ''
    ).toLowerCase();
    return t === 'dark';
  });
  useEffect(() => {
    const check = () => {
      const t = (
        document.body.dataset.theme ||
        document.documentElement.dataset.theme ||
        window.localStorage.getItem('da-theme') || ''
      ).toLowerCase();
      setDark(t === 'dark');
    };
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('storage', check);
    return () => { obs.disconnect(); window.removeEventListener('storage', check); };
  }, []);
  return dark;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOCK DATA — replace with real fetches / props
   ═══════════════════════════════════════════════════════════════════════════ */


const MOCK_KPIS: KpiDef[] = [
  { label: 'Total records',   value: '14,830', icon: 'database',      iconBg: '#EEF2FF', iconColor: '#4F46E5', delta: '+8.2%',  dir: 'up',      sub: 'vs last month' , trend: [{val:10}, {val:15}, {val:8}, {val:20}, {val:18}, {val:25}, {val:22}] },
  { label: 'Pending tasks',   value: '247',    icon: 'clock',         iconBg: '#FAEEDA', iconColor: '#854F0B', delta: '+12%',   dir: 'down',    sub: 'needs attention' , trend: [{val:10}, {val:15}, {val:8}, {val:20}, {val:18}, {val:25}, {val:22}] },
  { label: 'Completed work',  value: '3,419',  icon: 'circle-check',  iconBg: '#EAF3DE', iconColor: '#3B6D11', delta: '+5.1%',  dir: 'up',      sub: 'this week' , trend: [{val:10}, {val:15}, {val:8}, {val:20}, {val:18}, {val:25}, {val:22}] },
  { label: 'Error rate',      value: '1.4%',   icon: 'alert-triangle',iconBg: '#FCEBEB', iconColor: '#A32D2D', delta: '-0.3%',  dir: 'up',      sub: 'improving' , trend: [{val:10}, {val:15}, {val:8}, {val:20}, {val:18}, {val:25}, {val:22}] },
  { label: 'Weekly progress', value: '74%',    icon: 'trending-up',   iconBg: '#E6F1FB', iconColor: '#185FA5', delta: 'On track',dir: 'neutral', sub: 'target: 80%' , trend: [{val:10}, {val:15}, {val:8}, {val:20}, {val:18}, {val:25}, {val:22}] }];

const MOCK_CHART: ChartDatum[] = [
  { day: 'Mon', Completed: 312, Pending: 80  },
  { day: 'Tue', Completed: 478, Pending: 95  },
  { day: 'Wed', Completed: 391, Pending: 110 },
  { day: 'Thu', Completed: 520, Pending: 70  },
  { day: 'Fri', Completed: 444, Pending: 130 },
  { day: 'Sat', Completed: 280, Pending: 60  },
  { day: 'Sun', Completed: 360, Pending: 90  },
];

const MOCK_ACTIVITY: ActivityRow[] = [
  { id: '1', record: 'INV-20483', department: 'Calls',   assignee: 'Marcus T.',  updated: '2 min ago',  status: 'Active'    },
  { id: '2', record: 'TKT-09912', department: 'Tickets', assignee: 'Layla A.',   updated: '14 min ago', status: 'Pending'   },
  { id: '3', record: 'SLS-00341', department: 'Sales',   assignee: 'Jordan K.',  updated: '1 hr ago',   status: 'Completed' },
  { id: '4', record: 'INV-20480', department: 'Calls',   assignee: 'Sara R.',    updated: '2 hr ago',   status: 'Failed'    },
  { id: '5', record: 'TKT-09910', department: 'Tickets', assignee: 'Chris M.',   updated: '3 hr ago',   status: 'Completed' },
  { id: '6', record: 'SLS-00339', department: 'Sales',   assignee: 'Layla A.',   updated: '5 hr ago',   status: 'Active'    },
  { id: '7', record: 'TKT-09908', department: 'Tickets', assignee: 'Marcus T.',  updated: '6 hr ago',   status: 'Pending'   },
];

const MOCK_DEPT: DeptProgress[] = [
  { name: 'Calls',      pct: 82, color: '#4F46E5' },
  { name: 'Tickets',    pct: 61, color: '#2563EB' },
  { name: 'Sales',      pct: 74, color: '#16A34A' },
  { name: 'Operations', pct: 45, color: '#D97706' },
];

const MOCK_STATS: QuickStat[] = [
  { label: 'Avg handle time', value: '4m 12s' },
  { label: 'SLA met',         value: '96.2%'  },
  { label: 'Open tickets',    value: '83'     },
  { label: 'Active agents',   value: '31'     },
];

/* ═══════════════════════════════════════════════════════════════════════════
   ICON HELPER (inline SVG — Tabler-style outlines, no external dep)
   ═══════════════════════════════════════════════════════════════════════════ */

const ICONS: Record<string, ReactNode> = {
  'layout-dashboard': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  'chart-bar': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="6" width="4" height="15" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>
    </svg>
  ),
  'users': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M19 7a3 3 0 0 1 0 6"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    </svg>
  ),
  'checklist': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  'bell': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  'settings': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  'help-circle': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  'search': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  'plus': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  'bolt': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  'database': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  'clock': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  'circle-check': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  'alert-triangle': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  'trending-up': (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
};

function NavIcon({ name, size = 16 }: { name: string; size?: number }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return (
    <span style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
      {icon}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BADGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const BADGE_CLASS: Record<BadgeStatus, string> = {
  Active:    'db-badge db-badge-active',
  Pending:   'db-badge db-badge-pending',
  Failed:    'db-badge db-badge-failed',
  Completed: 'db-badge db-badge-completed',
};

const StatusBadge = memo(function StatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <span className={BADGE_CLASS[status]}>
      <span className="db-badge-dot" aria-hidden="true" />
      {status}
    </span>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   DELTA CHIP
   ═══════════════════════════════════════════════════════════════════════════ */

const DeltaChip = memo(function DeltaChip({ delta, dir }: { delta: string; dir: DeltaDir }) {
  const cls = dir === 'up' ? 'db-chip db-chip-up' : dir === 'down' ? 'db-chip db-chip-dn' : 'db-chip db-chip-nu';
  const arrow = dir === 'up' ? '▲ ' : dir === 'down' ? '▼ ' : '';
  return <span className={cls}>{arrow}{delta}</span>;
});

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════════
   KPI STRIP
   ═══════════════════════════════════════════════════════════════════════════ */

const KpiStrip = memo(function KpiStrip({ kpis }: { kpis: KpiDef[] }) {
  return (
    <div className="db-kpi-grid" role="region" aria-label="Key performance indicators">
      {kpis.map((k, i) => (
        <motion.div
          key={k.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
          className="db-kpi-card"
        >
          <div className="db-kpi-top">
            <span className="db-kpi-lbl">{k.label}</span>
            <div className="db-kpi-icon" style={{ background: k.iconBg }} aria-hidden="true">
              <span style={{ color: k.iconColor, display: 'flex' }}>
                <NavIcon name={k.icon} size={15} />
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div className="db-kpi-val">{k.value}</div>
              <div className="db-kpi-dl">
                <DeltaChip delta={k.delta} dir={k.dir} />
                <span className="db-kpi-sub">{k.sub}</span>
              </div>
            </div>
            {k.trend && (
              <div style={{ width: 60, height: 30, marginBottom: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={k.trend}>
                    <Line 
                      type="monotone" 
                      dataKey="val" 
                      stroke={k.iconColor} 
                      strokeWidth={2} 
                      dot={false} 
                      isAnimationActive={false} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   RECHARTS CUSTOM TOOLTIP
   ═══════════════════════════════════════════════════════════════════════════ */

const ChartTooltip = memo(function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: string | number; fill: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(15, 15, 24, 0.8)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: 12, padding: '12px 16px',
      fontSize: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontWeight: 700, color: '#fff', marginBottom: 8, fontSize: 13 }}>{label}</div>
      {payload.map((p: { name: string; value: string | number; fill: string }) => (
        <div key={p.name} style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'rgba(255,255,255,0.7)', margin: '4px 0' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, flexShrink: 0, boxShadow: `0 0 8px ${p.fill}` }} />
          <span style={{ flex: 1 }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: '#fff', marginLeft: 12 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   CHART CARD
   ═══════════════════════════════════════════════════════════════════════════ */

type DateRange  = 'This week' | 'Last 30 days' | 'This quarter';
type Department = 'All teams' | 'Calls' | 'Tickets' | 'Sales';

interface ChartCardProps {
  data:       ChartDatum[];
  onFilter?:  (range: DateRange, dept: Department) => void;
}

const ChartCard = memo(function ChartCard({ data, onFilter }: ChartCardProps) {
  const [range, setRange] = useState<DateRange>('This week');
  const [dept,  setDept]  = useState<Department>('All teams');

  const handleRange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as DateRange;
    setRange(v);
    onFilter?.(v, dept);
  }, [dept, onFilter]);

  const handleDept = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as Department;
    setDept(v);
    onFilter?.(range, v);
  }, [range, onFilter]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="db-card">
      <div className="db-card-head">
        <div>
          <div className="db-card-title">Activity overview</div>
          <div className="db-card-sub">Records processed per day</div>
        </div>
        <div className="db-filter-row">
          <select className="db-filter-sel" value={range} onChange={handleRange} aria-label="Date range">
            <option>This week</option>
            <option>Last 30 days</option>
            <option>This quarter</option>
          </select>
          <select className="db-filter-sel" value={dept} onChange={handleDept} aria-label="Department">
            <option>All teams</option>
            <option>Calls</option>
            <option>Tickets</option>
            <option>Sales</option>
          </select>
        </div>
      </div>
      <div className="db-chart-wrap">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} barGap={3} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--db-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--db-text-muted)', fontFamily: 'var(--db-font-body)' }}
            />
            <YAxis
              axisLine={false} tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--db-text-muted)', fontFamily: 'var(--db-font-body)' }}
              width={36}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--db-surface-hover)' }} />
            <Legend
              iconType="square" iconSize={8}
              wrapperStyle={{ fontSize: 11, color: 'var(--db-text-sub)', paddingTop: 8 }}
            />
            <Bar dataKey="Completed" fill="var(--db-chart-a)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Pending"   fill="var(--db-chart-b)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   ACTIVITY TABLE
   ═══════════════════════════════════════════════════════════════════════════ */

type StatusFilter = 'All statuses' | BadgeStatus;

interface ActivityTableProps {
  rows: ActivityRow[];
}

const ActivityTable = memo(function ActivityTable({ rows }: ActivityTableProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All statuses');

  const filtered = useMemo(() =>
    statusFilter === 'All statuses' ? rows : rows.filter(r => r.status === statusFilter),
    [rows, statusFilter]
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="db-card">
      <div className="db-card-head">
        <div>
          <div className="db-card-title">Recent activity</div>
          <div className="db-card-sub">Latest records across all departments</div>
        </div>
        <div className="db-filter-row">
          <select
            className="db-filter-sel"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter by status"
          >
            <option>All statuses</option>
            <option>Active</option>
            <option>Pending</option>
            <option>Failed</option>
            <option>Completed</option>
          </select>
        </div>
      </div>
      <div className="db-tbl-wrap">
        <table className="db-tbl" aria-label="Recent activity records">
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '20%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Record</th>
              <th scope="col">Department</th>
              <th scope="col">Assigned to</th>
              <th scope="col">Updated</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--db-text-muted)', padding: '24px' }}>
                  No records match this filter.
                </td>
              </tr>
            ) : filtered.map((row) => (
              <tr key={row.id}>
                <td><span className="db-tbl-mono">{row.record}</span></td>
                <td style={{ color: 'var(--db-text-sub)' }}>{row.department}</td>
                <td>{row.assignee}</td>
                <td style={{ color: 'var(--db-text-muted)', fontFamily: 'var(--db-font-mono)', fontSize: 11 }}>{row.updated}</td>
                <td><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PROGRESS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

const ProgressPanel = memo(function ProgressPanel({ depts }: { depts: DeptProgress[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} className="db-card">
      <div className="db-card-head">
        <div className="db-card-title">Department progress</div>
      </div>
      {depts.map((d) => (
        <div key={d.name} className="db-prog-row">
          <div className="db-prog-lbl">
            <span className="db-prog-name">{d.name}</span>
            <span className="db-prog-pct">{d.pct}%</span>
          </div>
          <div className="db-prog-track" role="progressbar" aria-valuenow={d.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${d.name} progress`}>
            <div className="db-prog-fill" style={{ width: `${d.pct}%`, background: d.color }} />
          </div>
        </div>
      ))}
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK STATS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickStatsPanel = memo(function QuickStatsPanel({ stats }: { stats: QuickStat[] }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }} className="db-card">
      <div className="db-card-head">
        <div className="db-card-title">Quick stats</div>
      </div>
      <div className="db-stat-grid">
        {stats.map((s) => (
          <div key={s.label} className="db-stat-mini">
            <div className="db-stat-lbl">{s.label}</div>
            <div className="db-stat-val">{s.value}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════════
   QUICK ACTIONS
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickActions = memo(function QuickActions() {
  const actions = [
    { label: 'New Audit', icon: 'plus', color: 'var(--accent-blue)' },
    { label: 'Upload Sales', icon: 'bolt', color: 'var(--accent-violet)' },
    { label: 'Team Reports', icon: 'chart-bar', color: 'var(--accent-emerald)' },
    { label: 'System Settings', icon: 'settings', color: 'var(--fg-muted)' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="db-card">
      <div className="db-card-head">
        <div className="db-card-title">Quick Actions</div>
      </div>
      <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {actions.map((a) => (
          <button
            onClick={() => alert(`Action: ${a.label}`)}
            key={a.label}
            className="db-icon-btn"
            style={{ 
              width: 'auto', 
              height: 'auto', 
              padding: '12px 8px', 
              flexDirection: 'column', 
              gap: 8,
              border: '1px solid var(--db-glass-border)',
              background: 'rgba(255,255,255,0.03)'
            }}
          >
            <div style={{ color: a.color }}><NavIcon name={a.icon} size={18} /></div>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{a.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
});


/* ═══════════════════════════════════════════════════════════════════════════
   PERSONAL GOALS
   ═══════════════════════════════════════════════════════════════════════════ */

const PersonalGoals = memo(function PersonalGoals() {
  const goals = [
    { label: 'Weekly Audits', current: 42, target: 50, color: 'var(--accent-blue)' },
    { label: 'Avg Quality', current: 94, target: 92, color: 'var(--accent-emerald)' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} className="db-card">
      <div className="db-card-head">
        <div className="db-card-title">Personal Goals</div>
      </div>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {goals.map((g) => {
          const pct = Math.min(100, (g.current / g.target) * 100);
          return (
            <div key={g.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--db-text-sub)', fontWeight: 500 }}>{g.label}</span>
                <span style={{ fontWeight: 700 }}>{g.current} / {g.target}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                  style={{ height: '100%', background: g.color, borderRadius: 3 }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
});

function Dashboard({
  currentUser   = null,
  kpis          = MOCK_KPIS,
  chartData     = MOCK_CHART,
  activityRows  = MOCK_ACTIVITY,
  deptProgress  = MOCK_DEPT,
  quickStats    = MOCK_STATS,
}: DashboardProps) {
  useDashboardStyles();
  const isDark = useIsDark();

  const userName = currentUser?.name ?? 'Sara Rodriguez';

  return (
    <div className="db-root" data-dark={isDark ? 'true' : undefined}>
      <main className="db-main" style={{ padding: 0 }}>
        {/* Page title */}
        <div className="db-anim" style={{ '--delay': '0ms' } as CSSProperties}>
          <div className="db-page-title">Dashboard</div>
          <div className="db-page-sub">
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {userName.split(' ')[0]} — here is your overview for today.
          </div>
        </div>

        {/* KPI strip */}
        <KpiStrip kpis={kpis} />

        {/* Content grid */}
        <div className="db-content-grid">
          {/* Left column */}
          <div className="db-left">
            <ChartCard data={chartData} />
            <ActivityTable rows={activityRows} />
          </div>

          {/* Right column */}
          <div className="db-right">
            <QuickActions />
            <PersonalGoals />
            <ProgressPanel depts={deptProgress} />
            <QuickStatsPanel stats={quickStats} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default memo(Dashboard);

/* ═══════════════════════════════════════════════════════════════════════════
   NAMED EXPORTS — useful for testing individual panels
   ═══════════════════════════════════════════════════════════════════════════ */
export {
  KpiStrip,
  ChartCard,
  ActivityTable,
  ProgressPanel,
  QuickStatsPanel,
  StatusBadge,
  DeltaChip,
  NavIcon,
  MOCK_KPIS,
  MOCK_CHART,
  MOCK_ACTIVITY,
  MOCK_DEPT,
  MOCK_STATS,
};
export type {
  DashboardProps,
  KpiDef,
  ChartDatum,
  ActivityRow,
  DeptProgress,
  QuickStat,
  BadgeStatus,
};
