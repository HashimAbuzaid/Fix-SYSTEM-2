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
  useRef,
  useState,
  useCallback,
  memo,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type BadgeStatus = 'Active' | 'Pending' | 'Failed' | 'Completed';
type DeltaDir    = 'up' | 'down' | 'neutral';
type NavGroup    = { label: string; items: NavItemDef[] };

interface NavItemDef {
  label:  string;
  icon:   string;   // Tabler icon name without "ti-"
  path?:  string;
  badge?: number;
}

interface KpiDef {
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
  /** Active nav path — controls which nav item is highlighted */
  activePath?: string;
  /** User info shown in sidebar footer + header avatar */
  currentUser?: {
    name?:        string | null;
    initials?:    string | null;
    role?:        string | null;
    email?:       string | null;
  } | null;
  /** Called when a nav item is clicked */
  onNavigate?: (path: string) => void;
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
  --db-font-body:    'Inter', system-ui, sans-serif;
  --db-font-mono:    'JetBrains Mono', monospace;

  /* Geometry */
  --db-r-sm:  6px;
  --db-r-md:  8px;
  --db-r-lg:  12px;
  --db-r-xl:  16px;

  /* Motion */
  --db-ease:      cubic-bezier(0.16, 1, 0.3, 1);
  --db-dur-fast:  120ms;
  --db-dur-mid:   220ms;

  /* Palette — light (default) */
  --db-page:          #F4F5F9;
  --db-surface:       #FFFFFF;
  --db-surface-alt:   #F8F9FB;
  --db-surface-hover: rgba(0,0,0,0.028);
  --db-border:        rgba(0,0,0,0.07);
  --db-border-mid:    rgba(0,0,0,0.11);
  --db-border-strong: rgba(0,0,0,0.18);
  --db-text:          #0D0F1A;
  --db-text-sub:      #4A5175;
  --db-text-muted:    #A0A8C4;

  /* Accent — indigo */
  --db-accent:        #4F46E5;
  --db-accent-soft:   #EEF2FF;
  --db-accent-text:   #3730A3;

  /* Semantic */
  --db-success:       #16A34A;
  --db-success-bg:    #EAF3DE;
  --db-success-text:  #27500A;
  --db-warning:       #D97706;
  --db-warning-bg:    #FAEEDA;
  --db-warning-text:  #633806;
  --db-danger:        #DC2626;
  --db-danger-bg:     #FCEBEB;
  --db-danger-text:   #791F1F;
  --db-info:          #2563EB;
  --db-info-bg:       #E6F1FB;
  --db-info-text:     #0C447C;

  /* Chart */
  --db-chart-a:  #4F46E5;
  --db-chart-b:  #A5B4FC;
}

/* ── Dark mode overrides ── */
[data-theme="dark"] .db-root,
.db-root[data-dark="true"] {
  --db-page:          #08090E;
  --db-surface:       #0D0F1A;
  --db-surface-alt:   #111420;
  --db-surface-hover: rgba(255,255,255,0.04);
  --db-border:        rgba(255,255,255,0.07);
  --db-border-mid:    rgba(255,255,255,0.11);
  --db-border-strong: rgba(255,255,255,0.18);
  --db-text:          #EEF0F6;
  --db-text-sub:      #7B84A0;
  --db-text-muted:    #3D4360;
  --db-accent:        #6366F1;
  --db-accent-soft:   rgba(99,102,241,0.12);
  --db-accent-text:   #A5B4FC;
  --db-success-bg:    rgba(22,163,74,0.12);
  --db-warning-bg:    rgba(217,119,6,0.12);
  --db-danger-bg:     rgba(220,38,38,0.12);
  --db-info-bg:       rgba(37,99,235,0.12);
  --db-chart-a:  #6366F1;
  --db-chart-b:  #818CF8;
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

/* ── Layout shell ── */
.db-shell {
  display:               grid;
  grid-template-columns: var(--db-sidebar-w, 220px) 1fr;
  grid-template-rows:    52px 1fr;
  min-height:            100vh;
}

/* ── Sidebar ── */
.db-sidebar {
  grid-row:   1 / 3;
  display:    flex;
  flex-direction: column;
  background: var(--db-surface);
  border-right: 1px solid var(--db-border);
  width: var(--db-sidebar-w, 220px);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  scrollbar-width: none;
  transition: width var(--db-dur-mid) var(--db-ease);
}
.db-sidebar::-webkit-scrollbar { display: none; }

.db-sidebar-top {
  padding: 14px 14px 12px;
  border-bottom: 1px solid var(--db-border);
  flex-shrink: 0;
}

.db-logo {
  display: flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
}
.db-logomark {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: var(--db-accent);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.db-logomark svg { color: #fff; }
.db-brand {
  font-size: 14px; font-weight: 600;
  color: var(--db-text);
  white-space: nowrap;
}

.db-nav { padding: 10px 8px; flex: 1; }
.db-nav-section {
  font-size: 10px; font-weight: 600;
  letter-spacing: .07em; text-transform: uppercase;
  color: var(--db-text-muted);
  padding: 10px 8px 5px;
}
.db-nav-item {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 8px; border-radius: var(--db-r-md);
  border: none; background: transparent;
  font-size: 13px; font-weight: 400;
  color: var(--db-text-sub);
  width: 100%; text-align: left;
  cursor: pointer;
  transition: background var(--db-dur-fast) ease,
              color    var(--db-dur-fast) ease;
  white-space: nowrap;
  position: relative;
}
.db-nav-item svg { flex-shrink: 0; opacity: 0.75; }
.db-nav-item:hover {
  background: var(--db-surface-hover);
  color: var(--db-text);
}
.db-nav-item:hover svg { opacity: 1; }
.db-nav-item.active {
  background: var(--db-accent-soft);
  color: var(--db-accent-text);
  font-weight: 500;
}
.db-nav-item.active svg { opacity: 1; color: var(--db-accent); }
.db-nav-badge {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--db-danger-bg);
  color: var(--db-danger-text);
  font-size: 10px; font-weight: 600;
  font-family: var(--db-font-mono);
}

.db-sidebar-footer {
  padding: 10px 12px;
  border-top: 1px solid var(--db-border);
  display: flex; align-items: center; gap: 9px;
  flex-shrink: 0;
}
.db-user-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--db-accent-soft);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600;
  color: var(--db-accent-text);
  flex-shrink: 0;
  border: 1px solid var(--db-border-mid);
}
.db-user-name  { font-size: 12px; font-weight: 500; color: var(--db-text); }
.db-user-role  { font-size: 11px; color: var(--db-text-muted); }

/* ── Header ── */
.db-header {
  background: var(--db-surface);
  border-bottom: 1px solid var(--db-border);
  display: flex; align-items: center;
  padding: 0 20px; gap: 12px;
  position: sticky; top: 0; z-index: 100;
}

.db-search {
  flex: 1; max-width: 300px; position: relative;
}
.db-search-icon {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  color: var(--db-text-muted); pointer-events: none;
}
.db-search input {
  width: 100%; padding: 0 10px 0 34px; height: 32px;
  border-radius: var(--db-r-md);
  border: 1px solid var(--db-border);
  background: var(--db-surface-alt);
  font-size: 12px; color: var(--db-text);
  outline: none;
  transition: border-color var(--db-dur-fast) ease;
}
.db-search input::placeholder { color: var(--db-text-muted); }
.db-search input:focus { border-color: var(--db-accent); }

.db-header-right {
  display: flex; align-items: center; gap: 8px; margin-left: auto;
}
.db-icon-btn {
  width: 32px; height: 32px; border-radius: var(--db-r-md);
  border: 1px solid var(--db-border);
  background: transparent;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; position: relative;
  color: var(--db-text-sub);
  transition: background var(--db-dur-fast) ease,
              color    var(--db-dur-fast) ease;
}
.db-icon-btn:hover { background: var(--db-surface-hover); color: var(--db-text); }
.db-notif-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--db-danger);
  border: 1.5px solid var(--db-surface);
  position: absolute; top: 5px; right: 5px;
}
.db-header-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--db-accent-soft);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600;
  color: var(--db-accent-text);
  border: 1px solid var(--db-border-mid);
  cursor: pointer;
}
.db-cta-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 0 14px; height: 32px;
  border-radius: var(--db-r-md);
  border: none; background: var(--db-accent);
  color: #fff; font-size: 12px; font-weight: 500;
  cursor: pointer; white-space: nowrap;
  transition: filter var(--db-dur-fast) ease, transform var(--db-dur-fast) ease;
}
.db-cta-btn:hover  { filter: brightness(1.1); }
.db-cta-btn:active { transform: scale(0.97); }

/* ── Main content ── */
.db-main { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }

.db-page-title { font-size: 18px; font-weight: 600; color: var(--db-text); }
.db-page-sub   { font-size: 12px; color: var(--db-text-sub); margin-top: 2px; }

/* ── KPI strip ── */
.db-kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.db-kpi-card {
  background: var(--db-surface);
  border: 1px solid var(--db-border);
  border-radius: var(--db-r-lg);
  padding: 16px;
  transition: border-color var(--db-dur-fast) ease,
              transform   var(--db-dur-mid)  var(--db-ease);
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
  background: var(--db-surface);
  border: 1px solid var(--db-border);
  border-radius: var(--db-r-lg);
  overflow: hidden;
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
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 4px;
  font-size: 10px; font-weight: 600;
}
.db-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
.db-badge-active    { background: var(--db-success-bg); color: var(--db-success-text); }
.db-badge-pending   { background: var(--db-warning-bg); color: var(--db-warning-text); }
.db-badge-failed    { background: var(--db-danger-bg);  color: var(--db-danger-text);  }
.db-badge-completed { background: var(--db-info-bg);    color: var(--db-info-text);    }

/* ── Progress panel ── */
.db-prog-row { padding: 11px 14px; border-bottom: 1px solid var(--db-border); }
.db-prog-row:last-child { border-bottom: none; }
.db-prog-lbl  { display: flex; justify-content: space-between; margin-bottom: 6px; }
.db-prog-name { font-size: 12px; color: var(--db-text-sub); }
.db-prog-pct  { font-size: 12px; font-weight: 600; color: var(--db-text); font-variant-numeric: tabular-nums; }
.db-prog-track { height: 5px; border-radius: 3px; background: var(--db-surface-alt); overflow: hidden; }
.db-prog-fill  { height: 100%; border-radius: 3px; transition: width 600ms var(--db-ease); }

/* ── Quick stats ── */
.db-stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px; }
.db-stat-mini { background: var(--db-surface-alt); border-radius: var(--db-r-md); padding: 10px; }
.db-stat-lbl  { font-size: 10px; color: var(--db-text-muted); margin-bottom: 4px; }
.db-stat-val  { font-size: 16px; font-weight: 600; color: var(--db-text); font-variant-numeric: tabular-nums; }

/* ── Scrollbar ── */
.db-root ::-webkit-scrollbar { width: 4px; height: 4px; }
.db-root ::-webkit-scrollbar-track { background: transparent; }
.db-root ::-webkit-scrollbar-thumb { background: var(--db-border-mid); border-radius: 999px; }

/* ── Focus ring ── */
.db-root :focus-visible { outline: 2px solid var(--db-accent); outline-offset: 2px; border-radius: var(--db-r-sm); }

/* ── Keyframes ── */
@keyframes db-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.db-anim { animation: db-up 280ms var(--db-ease) var(--delay, 0ms) both; }
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

/* ═══════════════════════════════════════════════════════════════════════════
   THEME DETECTION
   ═══════════════════════════════════════════════════════════════════════════ */

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

const MOCK_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', icon: 'layout-dashboard' },
      { label: 'Reports',   icon: 'chart-bar' },
      { label: 'Users',     icon: 'users' },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { label: 'Tasks',         icon: 'checklist',    badge: 12 },
      { label: 'Notifications', icon: 'bell' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Settings', icon: 'settings' },
      { label: 'Support',  icon: 'help-circle' },
    ],
  },
];

const MOCK_KPIS: KpiDef[] = [
  { label: 'Total records',   value: '14,830', icon: 'database',      iconBg: '#EEF2FF', iconColor: '#4F46E5', delta: '+8.2%',  dir: 'up',      sub: 'vs last month' },
  { label: 'Pending tasks',   value: '247',    icon: 'clock',         iconBg: '#FAEEDA', iconColor: '#854F0B', delta: '+12%',   dir: 'down',    sub: 'needs attention' },
  { label: 'Completed work',  value: '3,419',  icon: 'circle-check',  iconBg: '#EAF3DE', iconColor: '#3B6D11', delta: '+5.1%',  dir: 'up',      sub: 'this week' },
  { label: 'Error rate',      value: '1.4%',   icon: 'alert-triangle',iconBg: '#FCEBEB', iconColor: '#A32D2D', delta: '-0.3%',  dir: 'up',      sub: 'improving' },
  { label: 'Weekly progress', value: '74%',    icon: 'trending-up',   iconBg: '#E6F1FB', iconColor: '#185FA5', delta: 'On track',dir: 'neutral', sub: 'target: 80%' },
];

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

interface SidebarProps {
  groups:     NavGroup[];
  activePath: string;
  onNavigate: (path: string) => void;
  userName:   string;
  userInitials: string;
  userRole:   string;
}

const Sidebar = memo(function Sidebar({
  groups, activePath, onNavigate, userName, userInitials, userRole,
}: SidebarProps) {
  return (
    <aside className="db-sidebar" aria-label="Main navigation">
      {/* Logo */}
      <div className="db-sidebar-top">
        <div className="db-logo">
          <div className="db-logomark" aria-hidden="true">
            <NavIcon name="bolt" size={14} />
          </div>
          <span className="db-brand">Apex Ops</span>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="db-nav">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="db-nav-section">{group.label}</div>
            {group.items.map((item) => {
              const isActive = activePath === (item.path ?? `/${item.label.toLowerCase().replace(/\s+/g, '-')}`);
              return (
                <button
                  key={item.label}
                  className={`db-nav-item${isActive ? ' active' : ''}`}
                  onClick={() => onNavigate(item.path ?? `/${item.label.toLowerCase().replace(/\s+/g, '-')}`)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <NavIcon name={item.icon} size={16} />
                  {item.label}
                  {item.badge ? <span className="db-nav-badge">{item.badge}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="db-sidebar-footer">
        <div className="db-user-avatar" aria-hidden="true">{userInitials}</div>
        <div style={{ minWidth: 0 }}>
          <div className="db-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
          <div className="db-user-role">{userRole}</div>
        </div>
      </div>
    </aside>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════════════════════════════════ */

interface HeaderProps {
  userInitials: string;
  onNewRecord:  () => void;
  notifCount:   number;
}

const Header = memo(function Header({ userInitials, onNewRecord, notifCount }: HeaderProps) {
  return (
    <header className="db-header">
      <div className="db-search">
        <span className="db-search-icon" aria-hidden="true"><NavIcon name="search" size={15} /></span>
        <input
          type="search"
          placeholder="Search records, users, tasks…"
          aria-label="Search"
        />
      </div>
      <div className="db-header-right">
        <button className="db-icon-btn" aria-label={`Notifications${notifCount > 0 ? ` (${notifCount} unread)` : ''}`}>
          <NavIcon name="bell" size={16} />
          {notifCount > 0 && <span className="db-notif-dot" aria-hidden="true" />}
        </button>
        <button className="db-icon-btn" aria-label="Settings">
          <NavIcon name="settings" size={16} />
        </button>
        <div className="db-header-avatar" role="button" tabIndex={0} aria-label="User profile">
          {userInitials}
        </div>
        <button className="db-cta-btn" onClick={onNewRecord}>
          <NavIcon name="plus" size={14} />
          New record
        </button>
      </div>
    </header>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   KPI STRIP
   ═══════════════════════════════════════════════════════════════════════════ */

const KpiStrip = memo(function KpiStrip({ kpis }: { kpis: KpiDef[] }) {
  return (
    <div className="db-kpi-grid" role="region" aria-label="Key performance indicators">
      {kpis.map((k, i) => (
        <div key={k.label} className="db-kpi-card db-anim" style={{ '--delay': `${i * 40}ms` } as CSSProperties}>
          <div className="db-kpi-top">
            <span className="db-kpi-lbl">{k.label}</span>
            <div className="db-kpi-icon" style={{ background: k.iconBg }} aria-hidden="true">
              <span style={{ color: k.iconColor, display: 'flex' }}>
                <NavIcon name={k.icon} size={15} />
              </span>
            </div>
          </div>
          <div className="db-kpi-val">{k.value}</div>
          <div className="db-kpi-dl">
            <DeltaChip delta={k.delta} dir={k.dir} />
            <span className="db-kpi-sub">{k.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   RECHARTS CUSTOM TOOLTIP
   ═══════════════════════════════════════════════════════════════════════════ */

const ChartTooltip = memo(function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--db-surface)',
      border: '1px solid var(--db-border-mid)',
      borderRadius: 8, padding: '10px 14px',
      fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, color: 'var(--db-text)', marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--db-text-sub)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, flexShrink: 0 }} />
          {p.name}: <span style={{ fontWeight: 600, color: 'var(--db-text)', marginLeft: 'auto', paddingLeft: 12 }}>{p.value}</span>
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
    <div className="db-card db-anim" style={{ '--delay': '60ms' } as CSSProperties}>
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
    </div>
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
    <div className="db-card db-anim" style={{ '--delay': '100ms' } as CSSProperties}>
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
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   PROGRESS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

const ProgressPanel = memo(function ProgressPanel({ depts }: { depts: DeptProgress[] }) {
  return (
    <div className="db-card db-anim" style={{ '--delay': '80ms' } as CSSProperties}>
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
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   QUICK STATS PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

const QuickStatsPanel = memo(function QuickStatsPanel({ stats }: { stats: QuickStat[] }) {
  return (
    <div className="db-card db-anim" style={{ '--delay': '120ms' } as CSSProperties}>
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
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function Dashboard({
  activePath    = '/dashboard',
  currentUser   = null,
  onNavigate,
  onNewRecord,
  kpis          = MOCK_KPIS,
  chartData     = MOCK_CHART,
  activityRows  = MOCK_ACTIVITY,
  deptProgress  = MOCK_DEPT,
  quickStats    = MOCK_STATS,
}: DashboardProps) {
  useDashboardStyles();
  const isDark = useIsDark();

  const userName     = currentUser?.name     ?? 'Sara Rodriguez';
  const userInitials = currentUser?.initials ?? 'SR';
  const userRole     = currentUser?.role     ?? 'Admin';

  const handleNavigate = useCallback((path: string) => {
    onNavigate?.(path);
  }, [onNavigate]);

  const handleNewRecord = useCallback(() => {
    onNewRecord?.();
  }, [onNewRecord]);

  // Number of unread notifications — wire to your real store in production
  const notifCount = 3;

  return (
    <div className="db-root" data-dark={isDark ? 'true' : undefined}>
      <div className="db-shell">
        {/* ── Sidebar ── */}
        <Sidebar
          groups={MOCK_NAV_GROUPS}
          activePath={activePath}
          onNavigate={handleNavigate}
          userName={userName}
          userInitials={userInitials}
          userRole={userRole}
        />

        {/* ── Page right ── */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh' }}>

          {/* Header */}
          <Header
            userInitials={userInitials}
            onNewRecord={handleNewRecord}
            notifCount={notifCount}
          />

          {/* Main */}
          <main className="db-main">
            {/* Page title */}
            <div className="db-anim" style={{ '--delay': '0ms' } as CSSProperties}>
              <div className="db-page-title">Dashboard</div>
              <div className="db-page-sub">
                Good morning, {userName.split(' ')[0]} — here is your overview for today.
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
                <ProgressPanel depts={deptProgress} />
                <QuickStatsPanel stats={quickStats} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default memo(Dashboard);

/* ═══════════════════════════════════════════════════════════════════════════
   NAMED EXPORTS — useful for testing individual panels
   ═══════════════════════════════════════════════════════════════════════════ */
export {
  Sidebar,
  Header,
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
  NavGroup,
  NavItemDef,
};
