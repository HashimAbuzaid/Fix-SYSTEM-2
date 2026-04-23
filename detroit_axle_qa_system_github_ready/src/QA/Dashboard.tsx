import {
  useEffect,
  useMemo,
  useRef,
  useState,
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

// ─── Types ────────────────────────────────────────────────────────────────────
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
type HybridLeader = { label: string; quantity: number; averageQuality: number; rsd: number; combinedScore: number };
type RankedAuditSummary = { label: string; averageQuality: number; auditsCount: number };
type DashboardCachePayload = {
  audits: AuditItem[]; profiles: AgentProfile[]; callsRecords: CallsRecord[];
  ticketsRecords: TicketsRecord[]; salesRecords: SalesRecord[];
  supervisorRequests: SupervisorRequestSummary[]; agentFeedback: AgentFeedbackSummary[];
  monitoringItems: MonitoringSummary[];
};
type ActionCenterItem = { id: string; title: string; count: number; detail: string; path: string; tone: 'critical' | 'warning' | 'info' };

const DASHBOARD_CACHE_KEY = 'dashboard:datasets:v1';
const DASHBOARD_CACHE_TTL_MS = 1000 * 60 * 5;

// ─── Utilities ────────────────────────────────────────────────────────────────
function normalizeAgentId(v?: string | null) { return String(v || '').trim().replace(/\.0+$/, ''); }
function normalizeAgentName(v?: string | null) { return String(v || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function getCurrentDateValue() { return new Date().toISOString().slice(0, 10); }
function getMonthStartValue() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10); }

function shiftDateStringByMonths(d: string, offset: number) {
  if (!d) return '';
  const [y, m, day] = d.split('-').map(Number);
  const shifted = m - 1 + offset;
  const ty = y + Math.floor(shifted / 12);
  const tm = ((shifted % 12) + 12) % 12;
  const safe = Math.min(day, new Date(ty, tm + 1, 0).getDate());
  return new Date(Date.UTC(ty, tm, safe)).toISOString().slice(0, 10);
}

function getPercentChange(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return ((cur - prev) / prev) * 100;
}

function getDaysOld(v?: string | null) {
  const raw = String(v || '').slice(0, 10);
  if (!raw) return 0;
  const base = new Date(`${raw}T00:00:00`);
  if (isNaN(base.getTime())) return 0;
  const now = new Date();
  return Math.max(0, Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - base.getTime()) / 86400000));
}

function matchesDateRange(s?: string | null, e?: string | null, from?: string, to?: string) {
  const rs = String(s || '').slice(0, 10);
  const re = String(e || s || '').slice(0, 10);
  if (!rs) return false;
  return re >= (from || '0001-01-01') && rs <= (to || '9999-12-31');
}

function getStdDev(vals: number[]) {
  if (vals.length <= 1) return 0;
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  return Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
}

function getTeamAvg(audits: AuditItem[]) {
  if (!audits.length) return 0;
  return audits.reduce((s, a) => s + Number(a.quality_score), 0) / audits.length;
}

function openNativeDatePicker(input: HTMLInputElement | null | undefined) {
  if (!input) return;
  input.focus();
  const w = input as HTMLInputElement & { showPicker?: () => void };
  if (typeof w.showPicker === 'function') w.showPicker();
}

function formatDateTime(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Theme System ─────────────────────────────────────────────────────────────
function useThemeRefresh() {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => setK(v => v + 1);
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-theme-mode'] });
    if (document.body) obs.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'data-theme-mode'] });
    window.addEventListener('storage', refresh);
    window.addEventListener('detroit-axle-theme-change', refresh as EventListener);
    return () => { obs.disconnect(); window.removeEventListener('storage', refresh); window.removeEventListener('detroit-axle-theme-change', refresh as EventListener); };
  }, []);
  return k;
}

function isLightMode() {
  if (typeof document === 'undefined') return false;
  const m = (document.body.dataset.theme || document.documentElement.dataset.theme || window.localStorage.getItem('detroit-axle-theme-mode') || '').toLowerCase();
  return m === 'light' || m === 'white';
}

// ─── CSS Injection ─────────────────────────────────────────────────────────────
function useDashboardStyles() {
  useEffect(() => {
    const id = 'da-dashboard-v5';
    if (document.getElementById(id)) return;
    const el = document.createElement('style');
    el.id = id;
    el.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

      .dash-root { font-family: 'Outfit', sans-serif; }

      @keyframes dash-fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      @keyframes dash-fade-in { from { opacity:0; } to { opacity:1; } }
      @keyframes dash-shimmer { 0%,100% { opacity:.7; } 50% { opacity:1; } }
      @keyframes dash-spin-slow { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      @keyframes dash-pulse-ring { 0% { box-shadow:0 0 0 0 rgba(99,102,241,.4); } 70% { box-shadow:0 0 0 8px rgba(99,102,241,0); } 100% { box-shadow:0 0 0 0 rgba(99,102,241,0); } }
      @keyframes dash-score-fill { from { width:0; } to { width:var(--score-w); } }
      @keyframes dash-count-up { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:scale(1); } }
      @keyframes dash-border-glow { 0%,100% { border-color:rgba(99,102,241,.25); } 50% { border-color:rgba(99,102,241,.6); } }
      @keyframes dash-grid-in { from { opacity:0; transform:scale(.97); } to { opacity:1; transform:scale(1); } }
      @keyframes dash-loader-rotate { to { transform:rotate(360deg); } }
      @keyframes dash-loader-dash { 0% { stroke-dashoffset:280; } 50% { stroke-dashoffset:70; stroke-dasharray:280 280; } 100% { stroke-dashoffset:0; stroke-dasharray:280 280; } }
      @keyframes dash-ticker-slide { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
      @keyframes dash-blink { 0%,100% { opacity:1; } 50% { opacity:.2; } }
      @keyframes dash-number-tick { 0% { clip-path:inset(100% 0 0 0); transform:translateY(10px); } 100% { clip-path:inset(0 0 0 0); transform:translateY(0); } }
      @keyframes dash-wave { 0%,100% { transform:scaleY(1); } 50% { transform:scaleY(1.6); } }

      .dash-root *:focus-visible { outline:2px solid rgba(99,102,241,.7); outline-offset:2px; border-radius:6px; }

      .dash-card-hover {
        transition: transform 200ms cubic-bezier(0.22,1,.36,1), box-shadow 200ms ease;
      }
      .dash-card-hover:hover {
        transform: translateY(-2px);
        box-shadow: 0 20px 50px rgba(0,0,0,.45) !important;
      }

      .dash-btn { transition: all 140ms ease; }
      .dash-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
      .dash-btn:active { transform: translateY(0); }

      .dash-action-card { transition: border-color 200ms ease, background 200ms ease; cursor: default; }
      .dash-action-card:hover { border-color: rgba(99,102,241,.5) !important; }

      .dash-nav-pill { transition: all 160ms ease; }
      .dash-nav-pill:hover { background: rgba(99,102,241,.12) !important; color: #a5b4fc !important; }
      .dash-nav-pill.active { background: rgba(99,102,241,.22) !important; color: #818cf8 !important; border-color: rgba(99,102,241,.4) !important; }

      .dash-rank-row { transition: all 140ms ease; }
      .dash-rank-row:hover { background: rgba(99,102,241,.07) !important; transform: translateX(3px); }

      .dash-score-bar-fill { animation: dash-score-fill 800ms cubic-bezier(.22,1,.36,1) forwards; }

      .dash-stagger-1 { animation: dash-fade-up 500ms cubic-bezier(.22,1,.36,1) 60ms both; }
      .dash-stagger-2 { animation: dash-fade-up 500ms cubic-bezier(.22,1,.36,1) 120ms both; }
      .dash-stagger-3 { animation: dash-fade-up 500ms cubic-bezier(.22,1,.36,1) 180ms both; }
      .dash-stagger-4 { animation: dash-fade-up 500ms cubic-bezier(.22,1,.36,1) 240ms both; }
      .dash-stagger-5 { animation: dash-fade-up 500ms cubic-bezier(.22,1,.36,1) 300ms both; }
      .dash-stagger-6 { animation: dash-fade-up 500ms cubic-bezier(.22,1,.36,1) 360ms both; }

      .dash-grid-in { animation: dash-grid-in 400ms cubic-bezier(.22,1,.36,1) both; }

      .dash-segment-tab { transition: all 160ms ease; cursor: pointer; }
      .dash-segment-tab:hover { background: rgba(99,102,241,.1) !important; }

      .dash-tag { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
      .dash-tag-critical { background: rgba(239,68,68,.15); color: #fca5a5; border: 1px solid rgba(239,68,68,.3); }
      .dash-tag-warning { background: rgba(245,158,11,.15); color: #fcd34d; border: 1px solid rgba(245,158,11,.3); }
      .dash-tag-info { background: rgba(99,102,241,.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,.3); }
      .dash-tag-success { background: rgba(16,185,129,.15); color: #6ee7b7; border: 1px solid rgba(16,185,129,.3); }

      .dash-tag-critical.light { background: rgba(239,68,68,.1); color: #b91c1c; border-color: rgba(239,68,68,.25); }
      .dash-tag-warning.light { background: rgba(245,158,11,.1); color: #92400e; border-color: rgba(245,158,11,.25); }
      .dash-tag-info.light { background: rgba(99,102,241,.1); color: #3730a3; border-color: rgba(99,102,241,.25); }
      .dash-tag-success.light { background: rgba(16,185,129,.1); color: #065f46; border-color: rgba(16,185,129,.25); }

      .dash-mono { font-family: 'JetBrains Mono', monospace; }
      .dash-display { font-family: 'Syne', sans-serif; }

      /* Sparkline pseudo bars */
      .dash-sparkline { display: flex; align-items: flex-end; gap: 3px; height: 28px; }
      .dash-sparkline-bar { flex: 1; border-radius: 3px 3px 0 0; min-width: 4px; background: currentColor; opacity: .55; }
      .dash-sparkline-bar.peak { opacity: 1; }

      /* Scrollbar for leaderboard panels */
      .dash-scroll::-webkit-scrollbar { width: 4px; }
      .dash-scroll::-webkit-scrollbar-track { background: transparent; }
      .dash-scroll::-webkit-scrollbar-thumb { background: rgba(99,102,241,.25); border-radius: 999px; }

      /* Tooltip  */
      .dash-tooltip-wrap { position: relative; }
      .dash-tooltip-wrap:hover .dash-tooltip { opacity: 1; pointer-events: auto; transform: translateY(0); }
      .dash-tooltip { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(4px); background: rgba(15,23,42,.96); border: 1px solid rgba(99,102,241,.3); border-radius: 8px; padding: 6px 10px; white-space: nowrap; font-size: 11px; font-weight: 600; color: #e2e8f0; pointer-events: none; opacity: 0; transition: opacity 140ms ease, transform 140ms ease; z-index: 999; }

      /* Horizontal divider */
      .dash-divider { height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(99,102,241,.25) 30%, rgba(99,102,241,.25) 70%, transparent 100%); margin: 24px 0; }

      /* Animated count */
      .dash-count-in { animation: dash-count-up 400ms cubic-bezier(.22,1,.36,1) both; }
    `;
    document.head.appendChild(el);
    return () => { document.getElementById(id)?.remove(); };
  }, []);
}

// ─── Mini sparkline data generator (deterministic from label) ─────────────────
function pseudoSparkline(label: string, len = 7): number[] {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = ((hash << 5) - hash) + label.charCodeAt(i);
  return Array.from({ length: len }, (_, i) => 40 + Math.abs((hash * (i + 1) * 2654435761) % 60));
}

// ─── Live ticker items ────────────────────────────────────────────────────────
function useLiveTicker(items: string[]) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!items.length) return;
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 4000);
    return () => clearInterval(t);
  }, [items.length]);
  return items[idx] ?? '';
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────
function Dashboard({
  currentUser = null,
}: {
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
  const themeKey = useThemeRefresh();
  const light = useMemo(() => isLightMode(), [themeKey]);

  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [callsRecords, setCallsRecords] = useState<CallsRecord[]>([]);
  const [ticketsRecords, setTicketsRecords] = useState<TicketsRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [supervisorRequests, setSupervisorRequests] = useState<SupervisorRequestSummary[]>([]);
  const [agentFeedback, setAgentFeedback] = useState<AgentFeedbackSummary[]>([]);
  const [monitoringItems, setMonitoringItems] = useState<MonitoringSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dateFrom, setDateFrom] = useState(getMonthStartValue());
  const [dateTo, setDateTo] = useState(getCurrentDateValue());
  const [lastLoadedAt, setLastLoadedAt] = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'rankings' | 'insights' | 'action'>('overview');
  const dateFromRef = useRef<HTMLInputElement | null>(null);
  const dateToRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();

  // Color palette
  const C = useMemo(() => light ? {
    bg: '#f0f2f8',
    surface: 'rgba(255,255,255,.95)',
    surfaceHover: 'rgba(248,250,255,.98)',
    border: 'rgba(203,213,225,.8)',
    borderAccent: 'rgba(99,102,241,.3)',
    text: '#0f172a',
    textSub: '#475569',
    textMuted: '#94a3b8',
    accent: '#6366f1',
    accentSoft: 'rgba(99,102,241,.1)',
    accentGlow: 'rgba(99,102,241,.2)',
    callsColor: '#2563eb',
    ticketsColor: '#7c3aed',
    salesColor: '#059669',
    criticalColor: '#dc2626',
    warningColor: '#d97706',
    panelBg: 'rgba(255,255,255,.97)',
    headerBg: 'rgba(255,255,255,.92)',
    codeBg: 'rgba(241,245,249,.9)',
    gradTop: 'linear-gradient(135deg, rgba(99,102,241,.06) 0%, transparent 60%)',
    shadow: '0 4px 24px rgba(15,23,42,.08)',
    shadowLg: '0 12px 40px rgba(15,23,42,.12)',
  } : {
    bg: '#060912',
    surface: 'rgba(13,18,36,.9)',
    surfaceHover: 'rgba(17,24,48,.95)',
    border: 'rgba(99,102,241,.15)',
    borderAccent: 'rgba(99,102,241,.4)',
    text: '#e2e8f0',
    textSub: '#94a3b8',
    textMuted: '#475569',
    accent: '#818cf8',
    accentSoft: 'rgba(99,102,241,.12)',
    accentGlow: 'rgba(99,102,241,.25)',
    callsColor: '#60a5fa',
    ticketsColor: '#a78bfa',
    salesColor: '#34d399',
    criticalColor: '#f87171',
    warningColor: '#fbbf24',
    panelBg: 'rgba(10,14,30,.95)',
    headerBg: 'rgba(6,9,18,.96)',
    codeBg: 'rgba(13,18,36,.8)',
    gradTop: 'linear-gradient(135deg, rgba(99,102,241,.08) 0%, transparent 60%)',
    shadow: '0 4px 24px rgba(0,0,0,.4)',
    shadowLg: '0 12px 50px rgba(0,0,0,.6)',
  }, [light]);

  // Data loading
  useEffect(() => { void loadData(); }, []);

  function applyData(p: DashboardCachePayload) {
    setAudits(p.audits); setProfiles(p.profiles); setCallsRecords(p.callsRecords);
    setTicketsRecords(p.ticketsRecords); setSalesRecords(p.salesRecords);
    setSupervisorRequests(p.supervisorRequests); setAgentFeedback(p.agentFeedback);
    setMonitoringItems(p.monitoringItems);
  }

  async function fetchData(): Promise<DashboardCachePayload> {
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
    const errs = [a.error, pr.error, ca.error, ti.error, sa.error, rq.error, fb.error, mo.error].filter(Boolean).map(e => e?.message);
    if (errs.length) throw new Error(errs.join(' | '));
    return { audits: (a.data as AuditItem[]) || [], profiles: (pr.data as AgentProfile[]) || [], callsRecords: (ca.data as CallsRecord[]) || [], ticketsRecords: (ti.data as TicketsRecord[]) || [], salesRecords: (sa.data as SalesRecord[]) || [], supervisorRequests: (rq.data as SupervisorRequestSummary[]) || [], agentFeedback: (fb.data as AgentFeedbackSummary[]) || [], monitoringItems: (mo.data as MonitoringSummary[]) || [] };
  }

  async function loadData(opts?: { force?: boolean }) {
    const force = opts?.force ?? false;
    const cached = force ? null : peekCachedValue<DashboardCachePayload>(DASHBOARD_CACHE_KEY);
    if (cached) { applyData(cached); setLoading(false); }
    cached ? setRefreshing(true) : setLoading(true);
    setErrorMessage('');
    try {
      const payload = await getCachedValue(DASHBOARD_CACHE_KEY, fetchData, { ttlMs: DASHBOARD_CACHE_TTL_MS, force });
      applyData(payload);
      setLastLoadedAt(new Date().toISOString());
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Could not load dashboard.');
    } finally { setLoading(false); setRefreshing(false); }
  }

  // Agent label helpers
  function getDisplayName(agentId?: string | null, agentName?: string | null, team?: string | null) {
    const nId = normalizeAgentId(agentId), nName = normalizeAgentName(agentName);
    const match = profiles.find(p => {
      if (p.team !== (team || null)) return false;
      const pId = normalizeAgentId(p.agent_id), pName = normalizeAgentName(p.agent_name);
      return nId && pId ? pId === nId : pName === nName;
    });
    return match?.display_name || null;
  }

  function getAgentLabel(agentId?: string | null, agentName?: string | null, team?: string | null) {
    const dn = getDisplayName(agentId, agentName, team);
    return dn ? `${agentName || '—'} — ${dn}` : `${agentName || '—'} — ${agentId || '—'}`;
  }

  function getAgentKey(agentId?: string | null, agentName?: string | null) {
    return `${normalizeAgentId(agentId)}|${normalizeAgentName(agentName)}`;
  }

  // Date filtering
  function matchesRange(d?: string | null, d2?: string | null) {
    return !dateFrom && !dateTo ? true : matchesDateRange(d, d2, dateFrom, dateTo);
  }

  const fAudits = useMemo(() => audits.filter(a => matchesRange(a.audit_date)), [audits, dateFrom, dateTo]);
  const fCalls = useMemo(() => callsRecords.filter(r => matchesRange(r.call_date, r.date_to)), [callsRecords, dateFrom, dateTo]);
  const fTickets = useMemo(() => ticketsRecords.filter(r => matchesRange(r.ticket_date, r.date_to)), [ticketsRecords, dateFrom, dateTo]);
  const fSales = useMemo(() => salesRecords.filter(r => matchesRange(r.sale_date, r.date_to)), [salesRecords, dateFrom, dateTo]);
  const fRequests = useMemo(() => supervisorRequests.filter(r => matchesRange(r.created_at.slice(0, 10))), [supervisorRequests, dateFrom, dateTo]);
  const fFeedback = useMemo(() => agentFeedback.filter(r => matchesRange(r.created_at.slice(0, 10))), [agentFeedback, dateFrom, dateTo]);
  const fMonitoring = useMemo(() => monitoringItems.filter(r => matchesRange(r.created_at.slice(0, 10))), [monitoringItems, dateFrom, dateTo]);

  const teamScope = currentUser?.role === 'supervisor' ? currentUser.team || null : null;
  const scopedReqs = useMemo(() => fRequests.filter(r => !teamScope || r.team === teamScope), [fRequests, teamScope]);
  const scopedFeedback = useMemo(() => fFeedback.filter(r => !teamScope || r.team === teamScope), [fFeedback, teamScope]);
  const scopedMonitoring = useMemo(() => fMonitoring.filter(r => !teamScope || r.team === teamScope), [fMonitoring, teamScope]);
  const scopedHiddenAudits = useMemo(() => fAudits.filter(a => !a.shared_with_agent && (!teamScope || a.team === teamScope)), [fAudits, teamScope]);

  const openReqs = useMemo(() => scopedReqs.filter(r => r.status !== 'Closed'), [scopedReqs]);
  const openFeedback = useMemo(() => scopedFeedback.filter(r => r.status !== 'Closed'), [scopedFeedback]);
  const activeMon = useMemo(() => scopedMonitoring.filter(r => r.status === 'active'), [scopedMonitoring]);
  const overdueFb = useMemo(() => openFeedback.filter(r => !!r.due_date && r.due_date.slice(0, 10) < getCurrentDateValue()), [openFeedback]);
  const agingReqs = useMemo(() => openReqs.filter(r => getDaysOld(r.created_at) >= 3), [openReqs]);
  const agingMon = useMemo(() => activeMon.filter(r => getDaysOld(r.created_at) >= 2), [activeMon]);
  const agingHiddenAudits = useMemo(() => scopedHiddenAudits.filter(a => getDaysOld(a.audit_date) >= 2), [scopedHiddenAudits]);

  // Previous month comparison
  const prevFrom = useMemo(() => shiftDateStringByMonths(dateFrom || getMonthStartValue(), -1), [dateFrom]);
  const prevTo = useMemo(() => shiftDateStringByMonths(dateTo || getCurrentDateValue(), -1), [dateTo]);
  const prevAudits = useMemo(() => audits.filter(a => matchesDateRange(a.audit_date, a.audit_date, prevFrom, prevTo)), [audits, prevFrom, prevTo]);
  const prevCalls = useMemo(() => callsRecords.filter(r => matchesDateRange(r.call_date, r.date_to, prevFrom, prevTo)), [callsRecords, prevFrom, prevTo]);
  const prevTickets = useMemo(() => ticketsRecords.filter(r => matchesDateRange(r.ticket_date, r.date_to, prevFrom, prevTo)), [ticketsRecords, prevFrom, prevTo]);
  const prevSales = useMemo(() => salesRecords.filter(r => matchesDateRange(r.sale_date, r.date_to, prevFrom, prevTo)), [salesRecords, prevFrom, prevTo]);

  // Team splits
  const callsAudits = useMemo(() => fAudits.filter(a => a.team === 'Calls'), [fAudits]);
  const ticketsAudits = useMemo(() => fAudits.filter(a => a.team === 'Tickets'), [fAudits]);
  const salesAudits = useMemo(() => fAudits.filter(a => a.team === 'Sales'), [fAudits]);
  const prevCallsAudits = useMemo(() => prevAudits.filter(a => a.team === 'Calls'), [prevAudits]);
  const prevTicketsAudits = useMemo(() => prevAudits.filter(a => a.team === 'Tickets'), [prevAudits]);
  const prevSalesAudits = useMemo(() => prevAudits.filter(a => a.team === 'Sales'), [prevAudits]);

  const auditedCallsKeys = useMemo(() => new Set(callsAudits.map(a => getAgentKey(a.agent_id, a.agent_name))), [callsAudits]);
  const auditedTicketsKeys = useMemo(() => new Set(ticketsAudits.map(a => getAgentKey(a.agent_id, a.agent_name))), [ticketsAudits]);

  // Leaderboards
  function buildQtyBoard<T extends { agent_id: string; agent_name: string }>(
    records: T[], team: 'Calls' | 'Tickets', getQty: (r: T) => number, keys: Set<string>
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

  function buildQualityBoard(team: 'Calls' | 'Tickets'): QualityLeader[] {
    const map = new Map<string, { label: string; scores: number[] }>();
    fAudits.filter(a => a.team === team).forEach(a => {
      const k = getAgentKey(a.agent_id, a.agent_name);
      const ex = map.get(k);
      ex ? ex.scores.push(Number(a.quality_score)) : map.set(k, { label: getAgentLabel(a.agent_id, a.agent_name, team), scores: [Number(a.quality_score)] });
    });
    return [...map.values()].map(v => ({ label: v.label, averageQuality: v.scores.reduce((s, x) => s + x, 0) / v.scores.length, auditsCount: v.scores.length })).sort((a, b) => b.averageQuality - a.averageQuality).slice(0, 5);
  }

  function buildHybridBoard<T extends { agent_id: string; agent_name: string }>(
    team: 'Calls' | 'Tickets', records: T[], getQty: (r: T) => number
  ): HybridLeader[] {
    const teamAudits = fAudits.filter(a => a.team === team);
    const qtyMap = new Map<string, { agent_id: string; agent_name: string; quantity: number }>();
    records.forEach(r => {
      const k = getAgentKey(r.agent_id, r.agent_name);
      const ex = qtyMap.get(k);
      ex ? (ex.quantity += getQty(r)) : qtyMap.set(k, { agent_id: r.agent_id, agent_name: r.agent_name, quantity: getQty(r) });
    });
    const qualMap = new Map<string, number[]>();
    teamAudits.forEach(a => { const k = getAgentKey(a.agent_id, a.agent_name); qualMap.set(k, [...(qualMap.get(k) || []), Number(a.quality_score)]); });
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

  function buildSalesBoard(): QuantityLeader[] {
    const map = new Map<string, QuantityLeader>();
    fSales.forEach(r => {
      const k = getAgentKey(r.agent_id, r.agent_name);
      const ex = map.get(k);
      ex ? (ex.quantity += Number(r.amount)) : map.set(k, { label: getAgentLabel(r.agent_id, r.agent_name, 'Sales'), quantity: Number(r.amount) });
    });
    return [...map.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }

  function buildRankedAuditSummary(team?: TeamName): RankedAuditSummary[] {
    const map = new Map<string, { label: string; scores: number[] }>();
    fAudits.filter(a => team ? a.team === team : true).forEach(a => {
      const k = getAgentKey(a.agent_id, a.agent_name);
      const ex = map.get(k);
      ex ? ex.scores.push(Number(a.quality_score)) : map.set(k, { label: getAgentLabel(a.agent_id, a.agent_name, a.team as TeamName), scores: [Number(a.quality_score)] });
    });
    return [...map.values()].map(v => ({ label: v.label, averageQuality: v.scores.reduce((s, x) => s + x, 0) / v.scores.length, auditsCount: v.scores.length })).sort((a, b) => b.averageQuality - a.averageQuality);
  }

  const callsQtyTop = useMemo(() => buildQtyBoard(fCalls, 'Calls', r => Number(r.calls_count), auditedCallsKeys), [fCalls, auditedCallsKeys, profiles]);
  const ticketsQtyTop = useMemo(() => buildQtyBoard(fTickets, 'Tickets', r => Number(r.tickets_count), auditedTicketsKeys), [fTickets, auditedTicketsKeys, profiles]);
  const callsQualTop = useMemo(() => buildQualityBoard('Calls'), [fAudits, profiles]);
  const ticketsQualTop = useMemo(() => buildQualityBoard('Tickets'), [fAudits, profiles]);
  const callsHybridTop = useMemo(() => buildHybridBoard('Calls', fCalls, r => Number(r.calls_count)), [fCalls, fAudits, profiles]);
  const ticketsHybridTop = useMemo(() => buildHybridBoard('Tickets', fTickets, r => Number(r.tickets_count)), [fTickets, fAudits, profiles]);
  const salesTop = useMemo(() => buildSalesBoard(), [fSales, profiles]);
  const allAuditSummaries = useMemo(() => buildRankedAuditSummary(), [fAudits, profiles]);

  // KPI values
  const totalAudits = fAudits.length;
  const avgQuality = totalAudits ? fAudits.reduce((s, a) => s + Number(a.quality_score), 0) / totalAudits : 0;
  const releasedAudits = fAudits.filter(a => a.shared_with_agent).length;
  const releasedRate = totalAudits ? (releasedAudits / totalAudits) * 100 : 0;
  const totalSales = fSales.reduce((s, r) => s + Number(r.amount), 0);
  const totalCalls = fCalls.reduce((s, r) => s + Number(r.calls_count), 0);
  const totalTickets = fTickets.reduce((s, r) => s + Number(r.tickets_count), 0);
  const prevCallsTotal = prevCalls.reduce((s, r) => s + Number(r.calls_count), 0);
  const prevTicketsTotal = prevTickets.reduce((s, r) => s + Number(r.tickets_count), 0);
  const prevSalesTotal = prevSales.reduce((s, r) => s + Number(r.amount), 0);
  const prevAvgQuality = prevAudits.length ? prevAudits.reduce((s, a) => s + Number(a.quality_score), 0) / prevAudits.length : 0;

  const callsAvgQual = getTeamAvg(callsAudits);
  const ticketsAvgQual = getTeamAvg(ticketsAudits);
  const salesAvgQual = getTeamAvg(salesAudits);
  const prevCallsQual = getTeamAvg(prevCallsAudits);
  const prevTicketsQual = getTeamAvg(prevTicketsAudits);
  const prevSalesQual = getTeamAvg(prevSalesAudits);

  const lowestAgent = allAuditSummaries.length ? [...allAuditSummaries].reverse()[0] : null;
  const coachTarget = allAuditSummaries.filter(a => a.auditsCount >= 2).sort((a, b) => a.averageQuality - b.averageQuality)[0] || null;
  const consistencyPool = [...callsHybridTop, ...ticketsHybridTop].sort((a, b) => a.rsd === b.rsd ? b.combinedScore - a.combinedScore : a.rsd - b.rsd);
  const mostConsistent = consistencyPool[0] || null;

  // Action center
  const actionItems = useMemo<ActionCenterItem[]>(() => [
    { id: 'requests', title: 'Supervisor Requests', count: openReqs.length, detail: agingReqs.length > 0 ? `${agingReqs.length} aging 3+ days` : 'No aging requests', path: '/supervisor-requests', tone: agingReqs.length > 0 ? 'critical' : openReqs.length > 0 ? 'warning' : 'info' },
    { id: 'feedback', title: 'Open Feedback', count: openFeedback.length, detail: overdueFb.length > 0 ? `${overdueFb.length} overdue` : 'No overdue feedback', path: '/agent-feedback', tone: overdueFb.length > 0 ? 'critical' : openFeedback.length > 0 ? 'warning' : 'info' },
    { id: 'monitoring', title: 'Active Monitoring', count: activeMon.length, detail: agingMon.length > 0 ? `${agingMon.length} aging 2+ days` : 'Queue controlled', path: '/monitoring', tone: agingMon.length > 0 ? 'critical' : activeMon.length > 0 ? 'warning' : 'info' },
    { id: 'audits', title: 'Unreleased Audits', count: scopedHiddenAudits.length, detail: agingHiddenAudits.length > 0 ? `${agingHiddenAudits.length} aging 2+ days` : 'No aging audits', path: '/audits-list', tone: agingHiddenAudits.length > 0 ? 'critical' : scopedHiddenAudits.length > 0 ? 'warning' : 'info' },
  ], [openReqs.length, agingReqs.length, openFeedback.length, overdueFb.length, activeMon.length, agingMon.length, scopedHiddenAudits.length, agingHiddenAudits.length]);

  // Ticker messages
  const tickerItems = useMemo(() => {
    const msgs: string[] = [];
    if (callsHybridTop[0]) msgs.push(`TOP CALLS — ${callsHybridTop[0].label}`);
    if (ticketsHybridTop[0]) msgs.push(`TOP TICKETS — ${ticketsHybridTop[0].label}`);
    if (salesTop[0]) msgs.push(`TOP SALES — ${salesTop[0].label}`);
    if (mostConsistent) msgs.push(`MOST CONSISTENT — ${mostConsistent.label}`);
    msgs.push(`QUALITY AUDITS — ${totalAudits} THIS PERIOD`, `RELEASE RATE — ${releasedRate.toFixed(0)}%`);
    return msgs;
  }, [callsHybridTop, ticketsHybridTop, salesTop, mostConsistent, totalAudits, releasedRate]);
  const ticker = useLiveTicker(tickerItems);

  const hasData = audits.length > 0 || profiles.length > 0 || callsRecords.length > 0;

  // ─── Styles ────────────────────────────────────────────────────────────────
  const $ = {
    root: { background: C.bg, minHeight: '100vh', color: C.text } as CSSProperties,
    section: { marginBottom: '32px' } as CSSProperties,
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading && !hasData) {
    return (
      <div className="dash-root" style={{ ...$.root, display: 'grid', placeItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ animation: 'dash-loader-rotate 1.2s linear infinite', display: 'block', margin: '0 auto 16px' }}>
            <circle cx="24" cy="24" r="20" stroke={C.border} strokeWidth="3" fill="none" />
            <circle cx="24" cy="24" r="20" stroke={C.accent} strokeWidth="3" fill="none" strokeDasharray="80 200" strokeLinecap="round" />
          </svg>
          <div className="dash-display" style={{ color: C.accent, fontSize: '13px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>Loading Dashboard</div>
          <div style={{ color: C.textMuted, fontSize: '12px', marginTop: '6px' }}>Gathering operational data…</div>
        </div>
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="dash-root" style={$.root}>
      {/* ── Live Ticker Banner ── */}
      <TickerBanner ticker={ticker} C={C} />

      {/* ── Hero Header ── */}
      <HeroHeader
        C={C} light={light}
        dateFrom={dateFrom} dateTo={dateTo}
        setDateFrom={setDateFrom} setDateTo={setDateTo}
        dateFromRef={dateFromRef} dateToRef={dateToRef}
        refreshing={refreshing} lastLoadedAt={lastLoadedAt}
        onRefresh={() => { clearCachedValue(DASHBOARD_CACHE_KEY); void loadData({ force: true }); }}
        onThisMonth={() => { setDateFrom(getMonthStartValue()); setDateTo(getCurrentDateValue()); }}
        onAllTime={() => { setDateFrom(''); setDateTo(''); }}
        currentUser={currentUser}
      />

      {/* ── Error ── */}
      {errorMessage && (
        <div style={{ margin: '0 0 20px', padding: '14px 18px', borderRadius: '12px', background: 'rgba(239,68,68,.12)', border: `1px solid rgba(239,68,68,.3)`, color: C.criticalColor, fontSize: '13px' }}>
          ⚠ {errorMessage}
        </div>
      )}

      {/* ── Section Nav ── */}
      <SectionNav active={activeSection} onChange={setActiveSection} C={C} light={light} />

      {/* ── Overview Section ── */}
      {activeSection === 'overview' && (
        <div className="dash-grid-in">
          {/* KPI Strip */}
          <KPIStrip
            C={C}
            totalAudits={totalAudits} prevAudits={prevAudits.length}
            avgQuality={avgQuality} prevAvgQuality={prevAvgQuality}
            releasedAudits={releasedAudits} releasedRate={releasedRate}
            totalCalls={totalCalls} prevCallsTotal={prevCallsTotal}
            totalTickets={totalTickets} prevTicketsTotal={prevTicketsTotal}
            totalSales={totalSales} prevSalesTotal={prevSalesTotal}
          />

          {/* Team Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <TeamPerfCard
              C={C} light={light}
              title="Calls" color={C.callsColor}
              volume={totalCalls} prevVolume={prevCallsTotal}               avgQual={callsAvgQual} prevAvgQual={prevCallsQual}
              auditedAgents={auditedCallsKeys.size}
              topPerformer={callsHybridTop[0]?.label || callsQualTop[0]?.label || '—'}
              sparkData={pseudoSparkline('calls' + totalCalls, 10)}
              auditCount={callsAudits.length}
            />
            <TeamPerfCard
              C={C} light={light}
              title="Tickets" color={C.ticketsColor}
              volume={totalTickets} prevVolume={prevTicketsTotal}               avgQual={ticketsAvgQual} prevAvgQual={prevTicketsQual}
              auditedAgents={auditedTicketsKeys.size}
              topPerformer={ticketsHybridTop[0]?.label || ticketsQualTop[0]?.label || '—'}
              sparkData={pseudoSparkline('tickets' + totalTickets, 10)}
              auditCount={ticketsAudits.length}
            />
            <TeamPerfCard
              C={C} light={light}
              title="Sales" color={C.salesColor}
              volume={totalSales} prevVolume={prevSalesTotal} isRevenue
              avgQual={salesAvgQual} prevAvgQual={prevSalesQual}
              auditedAgents={new Set(salesAudits.map(a => getAgentKey(a.agent_id, a.agent_name))).size}
              topPerformer={salesTop[0]?.label || '—'}
              sparkData={pseudoSparkline('sales' + totalSales, 10)}
              auditCount={salesAudits.length}
            />
          </div>

          <RecognitionWall currentUser={currentUser as any} />
          <DigitalTrophyCabinet scope="global" currentUser={currentUser} />
          {currentUser && <VoiceOfEmployeeSupabase currentUser={currentUser as any} title="Recent anonymous themes" showComposer={false} />}
        </div>
      )}

      {/* ── Action Section ── */}
      {activeSection === 'action' && (
        <div className="dash-grid-in">
          <ActionCenter C={C} light={light} items={actionItems} onNavigate={navigate}
            agingReqs={agingReqs.length} overdueFb={overdueFb.length}
            agingMon={agingMon.length} agingHidden={agingHiddenAudits.length}
          />
        </div>
      )}

      {/* ── Rankings Section ── */}
      {activeSection === 'rankings' && (
        <div className="dash-grid-in">
          <RankingsSection
            C={C} light={light}
            callsQtyTop={callsQtyTop} ticketsQtyTop={ticketsQtyTop} salesTop={salesTop}
            callsQualTop={callsQualTop} ticketsQualTop={ticketsQualTop}
            callsHybridTop={callsHybridTop} ticketsHybridTop={ticketsHybridTop}
          />
        </div>
      )}

      {/* ── Insights Section ── */}
      {activeSection === 'insights' && (
        <div className="dash-grid-in">
          <InsightsSection
            C={C} light={light}
            lowestAgent={lowestAgent}
            mostConsistent={mostConsistent}
            coachTarget={coachTarget}
            allSummaries={allAuditSummaries}
            avgQuality={avgQuality}
            releasedRate={releasedRate}
            totalAudits={totalAudits}
          />
        </div>
      )}
    </div>
  );
}

// ─── TickerBanner ────────────────────────────────────────────────────────────
function TickerBanner({ ticker, C }: { ticker: string; C: any }) {
  return (
    <div style={{
      height: '36px', display: 'flex', alignItems: 'center', gap: '20px',
      background: C.panelBg, borderBottom: `1px solid ${C.border}`,
      padding: '0 20px', marginBottom: '0', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
        padding: '4px 10px', borderRadius: '6px', background: C.accentSoft,
        border: `1px solid ${C.borderAccent}`,
      }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.accent, animation: 'dash-shimmer 1.5s ease-in-out infinite' }} />
        <span className="dash-display" style={{ fontSize: '10px', fontWeight: 700, color: C.accent, letterSpacing: '.1em' }}>LIVE</span>
      </div>
      <div key={ticker} style={{ fontSize: '11px', fontWeight: 600, color: C.textSub, letterSpacing: '.06em', animation: 'dash-ticker-slide 400ms cubic-bezier(.22,1,.36,1) both', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {ticker}
      </div>
    </div>
  );
}

// ─── HeroHeader ──────────────────────────────────────────────────────────────
function HeroHeader({ C, dateFrom, dateTo, setDateFrom, setDateTo, dateFromRef, dateToRef, refreshing, lastLoadedAt, onRefresh, onThisMonth, onAllTime, currentUser }: any) {
  const role = currentUser?.role || 'qa';
  const roleLabel = role === 'admin' ? 'Administrator' : role === 'qa' ? 'QA Analyst' : 'Supervisor';

  return (
    <div style={{
      padding: '28px 0 24px',
      borderBottom: `1px solid ${C.border}`,
      marginBottom: '24px',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className="dash-display" style={{ fontSize: '11px', fontWeight: 700, color: C.accent, letterSpacing: '.14em', textTransform: 'uppercase' }}>Quality Assurance System</span>
            <div style={{ height: '1px', width: '32px', background: C.accent, opacity: .4 }} />
            <span style={{ fontSize: '11px', color: C.textMuted, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>{roleLabel}</span>
          </div>
          <h1 className="dash-display" style={{ margin: 0, fontSize: '36px', fontWeight: 800, color: C.text, lineHeight: 1.1, letterSpacing: '-.02em' }}>
            Operations Dashboard
          </h1>
          <p style={{ margin: '8px 0 0', color: C.textSub, fontSize: '14px', fontWeight: 400 }}>
            Quality, volume, and performance for period <span style={{ color: C.text, fontWeight: 600 }}>{dateFrom || 'All time'}</span> — <span style={{ color: C.text, fontWeight: 600 }}>{dateTo || 'Today'}</span>
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, letterSpacing: '.08em', textTransform: 'uppercase' }}>From</label>
              <input
                ref={dateFromRef} type="date" value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                onClick={() => openNativeDatePicker(dateFromRef.current)}
                style={{ padding: '8px 12px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: '13px', fontWeight: 500, cursor: 'pointer', minWidth: '140px', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, letterSpacing: '.08em', textTransform: 'uppercase' }}>To</label>
              <input
                ref={dateToRef} type="date" value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                onClick={() => openNativeDatePicker(dateToRef.current)}
                style={{ padding: '8px 12px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: '13px', fontWeight: 500, cursor: 'pointer', minWidth: '140px', fontFamily: 'inherit' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end' }}>
            <button className="dash-btn" onClick={onThisMonth} style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.surface, color: C.textSub, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              This Month
            </button>
            <button className="dash-btn" onClick={onAllTime} style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.surface, color: C.textSub, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              All Time
            </button>
            <button className="dash-btn" onClick={onRefresh} style={{ padding: '8px 16px', borderRadius: '10px', border: `1px solid ${C.borderAccent}`, background: C.accentSoft, color: C.accent, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {refreshing && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ animation: 'dash-spin-slow 1s linear infinite' }}><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>}
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { label: 'Quality Source', value: 'Audits' },
          { label: 'Cache', value: refreshing ? 'Refreshing…' : 'Warm' },
          { label: 'Updated', value: lastLoadedAt ? formatDateTime(lastLoadedAt) : 'Session' },
        ].map(chip => (
          <div key={chip.label} style={{ padding: '5px 12px', borderRadius: '999px', border: `1px solid ${C.border}`, background: C.surface, fontSize: '11px', fontWeight: 600, color: C.textMuted }}>
            <span style={{ color: C.textSub, marginRight: '4px' }}>{chip.label}:</span>{chip.value}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SectionNav ──────────────────────────────────────────────────────────────
function SectionNav({ active, onChange, C, light }: { active: string; onChange: (s: any) => void; C: any; light: boolean }) {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '◈' },
    { id: 'action', label: 'Action Center', icon: '⚡' },
    { id: 'rankings', label: 'Rankings', icon: '⬆' },
    { id: 'insights', label: 'Insights', icon: '◎' },
  ];
  return (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', padding: '5px', borderRadius: '14px', background: light ? 'rgba(241,245,249,.8)' : 'rgba(13,18,36,.8)', border: `1px solid ${C.border}`, width: 'fit-content' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          className="dash-segment-tab"
          onClick={() => onChange(t.id)}
          style={{
            padding: '8px 18px', borderRadius: '10px', border: active === t.id ? `1px solid ${C.borderAccent}` : '1px solid transparent',
            background: active === t.id ? (light ? '#fff' : 'rgba(13,18,48,.9)') : 'transparent',
            color: active === t.id ? C.accent : C.textMuted,
            fontSize: '13px', fontWeight: active === t.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: '7px',
            boxShadow: active === t.id ? C.shadow : 'none',
            transition: 'all 160ms ease',
          }}
        >
          <span style={{ fontSize: '14px', opacity: .8 }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── KPIStrip ────────────────────────────────────────────────────────────────
function KPIStrip({ C, totalAudits, prevAudits, avgQuality, prevAvgQuality, releasedAudits, releasedRate, totalCalls, prevCallsTotal, totalTickets, prevTicketsTotal, totalSales, prevSalesTotal }: any) {
  const kpis = [
    { label: 'Total Audits', value: totalAudits, format: 'int', prev: prevAudits, color: C.accent, icon: '◎' },
    { label: 'Avg Quality', value: avgQuality, format: 'pct', prev: prevAvgQuality, color: C.callsColor, icon: '◈' },
    { label: 'Released', value: releasedAudits, sub: `${releasedRate.toFixed(0)}% rate`, format: 'int', color: C.salesColor, icon: '▲' },
    { label: 'Calls Volume', value: totalCalls, format: 'int', prev: prevCallsTotal, color: C.callsColor, icon: '○' },
    { label: 'Tickets Volume', value: totalTickets, format: 'int', prev: prevTicketsTotal, color: C.ticketsColor, icon: '◇' },
    { label: 'Sales Revenue', value: totalSales, format: 'usd', prev: prevSalesTotal, color: C.salesColor, icon: '$' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '28px' }}>
      {kpis.map((k, i) => {
        const delta = k.prev !== undefined ? getPercentChange(k.value, k.prev) : null;
        const fmtVal = k.format === 'pct' ? `${k.value.toFixed(1)}%` : k.format === 'usd' ? `$${k.value >= 1000 ? (k.value / 1000).toFixed(1) + 'k' : k.value.toFixed(0)}` : k.value >= 1000 ? (k.value / 1000).toFixed(1) + 'k' : String(k.value);
        return (
          <div key={k.label} className={`dash-card-hover dash-stagger-${Math.min(i + 1, 6)}`} style={{ padding: '18px 20px', borderRadius: '16px', border: `1px solid ${C.border}`, background: C.surface, boxShadow: C.shadow, position: 'relative', overflow: 'hidden' }}>
            {/* Accent top bar */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: k.color, borderRadius: '16px 16px 0 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, letterSpacing: '.08em', textTransform: 'uppercase' }}>{k.label}</span>
              <span style={{ fontSize: '16px', color: k.color, opacity: .7 }}>{k.icon}</span>
            </div>
            <div className="dash-display dash-count-in" style={{ fontSize: '28px', fontWeight: 800, color: C.text, lineHeight: 1, marginBottom: '6px', letterSpacing: '-.02em' }}>{fmtVal}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {delta !== null && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: delta >= 0 ? C.salesColor : C.criticalColor }}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%
                </span>
              )}
              {k.sub && <span style={{ fontSize: '11px', color: C.textMuted }}>{k.sub}</span>}
              {delta !== null && <span style={{ fontSize: '10px', color: C.textMuted }}>vs prev</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TeamPerfCard ────────────────────────────────────────────────────────────
function TeamPerfCard({ C, light, title, color, volume, prevVolume, isRevenue, avgQual, prevAvgQual, auditedAgents, topPerformer, sparkData, auditCount }: any) {
  const volDelta = getPercentChange(volume, prevVolume);
  const qualDelta = getPercentChange(avgQual, prevAvgQual);
  const sparkMax = Math.max(...sparkData);
  const fmtVol = isRevenue ? `$${volume >= 1000 ? (volume / 1000).toFixed(1) + 'k' : volume.toFixed(0)}` : volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : String(volume);

  return (
    <div className="dash-card-hover dash-stagger-3" style={{ padding: '24px', borderRadius: '20px', border: `1px solid ${C.border}`, background: C.surface, boxShadow: C.shadow, position: 'relative', overflow: 'hidden' }}>
      {/* Color stripe */}
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: color }} />

      <div style={{ paddingLeft: '8px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <div className="dash-display" style={{ fontSize: '18px', fontWeight: 800, color: C.text, letterSpacing: '-.01em' }}>{title}</div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '2px', fontWeight: 500 }}>{auditCount} audits • {auditedAgents} agents</div>
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', color: color }}>
            <div className="dash-sparkline">
              {sparkData.map((v: number, i: number) => (
                <div key={i} className={`dash-sparkline-bar ${v === sparkMax ? 'peak' : ''}`} style={{ height: `${(v / sparkMax) * 100}%`, background: color }} />
              ))}
            </div>
          </div>
        </div>

        {/* Metrics grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Volume</div>
            <div className="dash-display" style={{ fontSize: '24px', fontWeight: 800, color: C.text }}>{fmtVol}</div>
            <div style={{ fontSize: '11px', color: volDelta >= 0 ? C.salesColor : C.criticalColor, fontWeight: 700, marginTop: '2px' }}>
              {volDelta >= 0 ? '▲' : '▼'} {Math.abs(volDelta).toFixed(1)}% vs prev
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Quality</div>
            <div className="dash-display" style={{ fontSize: '24px', fontWeight: 800, color: C.text }}>{avgQual.toFixed(1)}%</div>
            <div style={{ fontSize: '11px', color: qualDelta >= 0 ? C.salesColor : C.criticalColor, fontWeight: 700, marginTop: '2px' }}>
              {qualDelta >= 0 ? '▲' : '▼'} {Math.abs(qualDelta).toFixed(1)}% vs prev
            </div>
          </div>
        </div>

        {/* Quality bar */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.06em' }}>Quality Score</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color }}>Target: 85%</span>
          </div>
          <div style={{ height: '6px', borderRadius: '999px', background: light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
            <div className="dash-score-bar-fill" style={{ height: '100%', borderRadius: '999px', background: avgQual >= 85 ? `linear-gradient(90deg, ${color}, ${color}cc)` : `linear-gradient(90deg, ${C.criticalColor}, ${C.warningColor})`, '--score-w': `${Math.min(avgQual, 100)}%` } as any} />
          </div>
        </div>

        {/* Top performer */}
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: light ? `${color}10` : `${color}15`, border: `1px solid ${color}30` }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '3px' }}>Top Performer</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topPerformer}</div>
        </div>
      </div>
    </div>
  );
}

// ─── ActionCenter ────────────────────────────────────────────────────────────
function ActionCenter({ C, light, items, onNavigate, agingReqs, overdueFb, agingMon, agingHidden }: any) {
  const urgentCount = items.filter((i: ActionCenterItem) => i.tone === 'critical' && i.count > 0).length;
  const watchCount = items.filter((i: ActionCenterItem) => i.tone === 'warning' && i.count > 0).length;

  return (
    <div>
      {/* Status banner */}
      <div style={{ padding: '20px 24px', borderRadius: '16px', border: `1px solid ${urgentCount > 0 ? 'rgba(239,68,68,.3)' : watchCount > 0 ? 'rgba(245,158,11,.3)' : C.borderAccent}`, background: urgentCount > 0 ? 'rgba(239,68,68,.06)' : watchCount > 0 ? 'rgba(245,158,11,.06)' : C.accentSoft, marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="dash-display" style={{ fontSize: '20px', fontWeight: 800, color: C.text, marginBottom: '4px' }}>
            {urgentCount > 0 ? `${urgentCount} Urgent Item${urgentCount > 1 ? 's' : ''} Requiring Attention` : watchCount > 0 ? `${watchCount} Item${watchCount > 1 ? 's' : ''} to Watch` : 'All Queues Healthy'}
          </div>
          <div style={{ fontSize: '13px', color: C.textSub }}>
            {urgentCount > 0 ? 'Act on critical items immediately to maintain SLA compliance.' : watchCount > 0 ? 'Monitor these items and address before they escalate.' : 'No urgent operational backlog in the selected period.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[{ label: 'Urgent', value: urgentCount, color: C.criticalColor }, { label: 'Watch', value: watchCount, color: C.warningColor }, { label: 'Stable', value: items.filter((i: ActionCenterItem) => i.tone === 'info').length, color: C.accent }].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div className="dash-display" style={{ fontSize: '22px', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.08em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {items.map((item: ActionCenterItem, i: number) => (
          <ActionCard key={item.id} item={item} C={C} light={light} onNavigate={onNavigate} index={i} />
        ))}
      </div>

      {/* Aging detail table */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${C.border}`, background: C.surface }}>
          <div className="dash-display" style={{ fontSize: '13px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '14px' }}>⚠ Aging / Overdue</div>
          {[
            { label: 'Requests aging 3+ days', value: agingReqs, tone: agingReqs > 0 ? 'critical' : 'info' },
            { label: 'Feedback overdue', value: overdueFb, tone: overdueFb > 0 ? 'critical' : 'info' },
            { label: 'Monitoring aging 2+ days', value: agingMon, tone: agingMon > 0 ? 'warning' : 'info' },
            { label: 'Unreleased audits 2+ days', value: agingHidden, tone: agingHidden > 0 ? 'warning' : 'info' },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '10px', marginBottom: '8px', background: light ? 'rgba(248,250,252,.8)' : 'rgba(13,18,36,.6)', border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: '13px', color: C.textSub, fontWeight: 500 }}>{row.label}</span>
              <span className="dash-display" style={{ fontSize: '18px', fontWeight: 800, color: row.value > 0 ? (row.tone === 'critical' ? C.criticalColor : C.warningColor) : C.textMuted }}>{row.value}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${C.border}`, background: C.surface }}>
          <div className="dash-display" style={{ fontSize: '13px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '14px' }}>→ Quick Links</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Audits List', path: '/audits-list' },
              { label: 'Feedback', path: '/agent-feedback' },
              { label: 'Monitoring', path: '/monitoring' },
              { label: 'Requests', path: '/supervisor-requests' },
              { label: 'Reports', path: '/reports' },
              { label: 'Heatmap', path: '/team-heatmap' },
            ].map(l => (
              <button key={l.path} className="dash-btn" onClick={() => onNavigate(l.path)} style={{ padding: '10px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: light ? 'rgba(248,250,252,.8)' : 'rgba(13,18,36,.6)', color: C.textSub, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                {l.label} →
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({ item, C, light, onNavigate, index }: { item: ActionCenterItem; C: any; light: boolean; onNavigate: (path: string) => void; index: number }) {
  const toneColor = item.tone === 'critical' ? C.criticalColor : item.tone === 'warning' ? C.warningColor : C.accent;
  const toneBg = item.tone === 'critical' ? 'rgba(239,68,68,.08)' : item.tone === 'warning' ? 'rgba(245,158,11,.08)' : C.accentSoft;
  const toneBorder = item.tone === 'critical' ? 'rgba(239,68,68,.25)' : item.tone === 'warning' ? 'rgba(245,158,11,.25)' : C.borderAccent;

  return (
    <div className={`dash-action-card dash-stagger-${index + 1}`} style={{ padding: '20px', borderRadius: '16px', border: `1px solid ${toneBorder}`, background: toneBg, display: 'grid', gap: '12px', animation: item.tone === 'critical' && item.count > 0 ? 'dash-border-glow 2s ease-in-out infinite' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span className={`dash-tag dash-tag-${item.tone}${light ? ' light' : ''}`}>{item.tone === 'critical' ? 'Urgent' : item.tone === 'warning' ? 'Watch' : 'Stable'}</span>
        <div className="dash-display" style={{ fontSize: '36px', fontWeight: 800, color: toneColor, lineHeight: 1 }}>{item.count}</div>
      </div>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>{item.title}</div>
        <div style={{ fontSize: '12px', color: C.textSub, lineHeight: 1.5 }}>{item.detail}</div>
      </div>
      <button className="dash-btn" onClick={() => onNavigate(item.path)} style={{ padding: '8px 14px', borderRadius: '10px', border: `1px solid ${toneBorder}`, background: light ? 'rgba(255,255,255,.8)' : 'rgba(13,18,36,.6)', color: toneColor, fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
        Open →
      </button>
    </div>
  );
}

// ─── RankingsSection ─────────────────────────────────────────────────────────
function RankingsSection({ C, light, callsQtyTop, ticketsQtyTop, salesTop, callsQualTop, ticketsQualTop, callsHybridTop, ticketsHybridTop }: any) {
  const [boardType, setBoardType] = useState<'quantity' | 'quality' | 'combined'>('combined');

  return (
    <div>
      {/* Board type switcher */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', padding: '4px', borderRadius: '12px', background: light ? 'rgba(241,245,249,.8)' : 'rgba(13,18,36,.8)', border: `1px solid ${C.border}`, width: 'fit-content' }}>
        {(['combined', 'quantity', 'quality'] as const).map(t => (
          <button key={t} className="dash-segment-tab" onClick={() => setBoardType(t)} style={{ padding: '7px 16px', borderRadius: '8px', border: boardType === t ? `1px solid ${C.borderAccent}` : '1px solid transparent', background: boardType === t ? C.surface : 'transparent', color: boardType === t ? C.accent : C.textMuted, fontSize: '12px', fontWeight: boardType === t ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {boardType === 'combined' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <LeaderboardPanel title="Calls Combined" color={C.callsColor} items={callsHybridTop} C={C} light={light} type="hybrid" />
          <LeaderboardPanel title="Tickets Combined" color={C.ticketsColor} items={ticketsHybridTop} C={C} light={light} type="hybrid" />
        </div>
      )}
      {boardType === 'quantity' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <LeaderboardPanel title="Calls Volume" color={C.callsColor} items={callsQtyTop} C={C} light={light} type="quantity" unit="calls" />
          <LeaderboardPanel title="Tickets Volume" color={C.ticketsColor} items={ticketsQtyTop} C={C} light={light} type="quantity" unit="tickets" />
          <LeaderboardPanel title="Sales Revenue" color={C.salesColor} items={salesTop} C={C} light={light} type="quantity" unit="usd" />
        </div>
      )}
      {boardType === 'quality' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <LeaderboardPanel title="Calls Quality" color={C.callsColor} items={callsQualTop} C={C} light={light} type="quality" />
          <LeaderboardPanel title="Tickets Quality" color={C.ticketsColor} items={ticketsQualTop} C={C} light={light} type="quality" />
        </div>
      )}
    </div>
  );
}

function LeaderboardPanel({ title, color, items, C, light, type, unit }: { title: string; color: string; items: any[]; C: any; light: boolean; type: 'quantity' | 'quality' | 'hybrid'; unit?: string }) {
  const maxVal = items.length ? Math.max(...items.map(i => type === 'quality' ? i.averageQuality : type === 'hybrid' ? i.combinedScore : i.quantity)) : 1;

  return (
    <div className="dash-card-hover" style={{ padding: '22px', borderRadius: '20px', border: `1px solid ${C.border}`, background: C.surface, boxShadow: C.shadow }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}80` }} />
        <div className="dash-display" style={{ fontSize: '15px', fontWeight: 800, color: C.text }}>{title}</div>
        <div style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: '999px', background: `${color}18`, border: `1px solid ${color}30`, fontSize: '10px', fontWeight: 700, color }}>{items.length} agents</div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: C.textMuted, fontSize: '13px', borderRadius: '10px', border: `1px dashed ${C.border}` }}>No data for period</div>
      ) : (
        <div className="dash-scroll" style={{ display: 'grid', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
          {items.map((item, i) => {
            const val = type === 'quality' ? item.averageQuality : type === 'hybrid' ? item.combinedScore : item.quantity;
            const barPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
            const displayVal = type === 'quality' ? `${item.averageQuality.toFixed(1)}%` : type === 'hybrid' ? `${item.combinedScore.toFixed(2)}` : unit === 'usd' ? `$${item.quantity >= 1000 ? (item.quantity / 1000).toFixed(1) + 'k' : item.quantity}` : String(item.quantity);
            const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

            return (
              <div key={item.label} className="dash-rank-row" style={{ padding: '12px 14px', borderRadius: '12px', border: `1px solid ${C.border}`, background: light ? 'rgba(248,250,252,.8)' : 'rgba(13,18,36,.6)', cursor: 'default' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '8px', background: i < 3 ? `${medalColors[i]}22` : C.accentSoft, border: `1px solid ${i < 3 ? medalColors[i] + '40' : C.borderAccent}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <span className="dash-mono" style={{ fontSize: '10px', fontWeight: 700, color: i < 3 ? medalColors[i] : C.accent }}>#{i + 1}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                    {type === 'hybrid' && <div style={{ fontSize: '10px', color: C.textMuted }}>Quality {item.averageQuality?.toFixed(1)}% · RSD {item.rsd?.toFixed(3)}</div>}
                    {type === 'quality' && <div style={{ fontSize: '10px', color: C.textMuted }}>{item.auditsCount} audit{item.auditsCount !== 1 ? 's' : ''}</div>}
                  </div>
                  <div className="dash-mono" style={{ fontSize: '13px', fontWeight: 700, color, flexShrink: 0 }}>{displayVal}</div>
                </div>
                {/* Mini bar */}
                <div style={{ height: '3px', borderRadius: '999px', background: light ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barPct}%`, background: `linear-gradient(90deg, ${color}, ${color}90)`, borderRadius: '999px', transition: 'width 600ms cubic-bezier(.22,1,.36,1)' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── InsightsSection ─────────────────────────────────────────────────────────
function InsightsSection({ C, light, lowestAgent, mostConsistent, coachTarget, allSummaries, avgQuality, releasedRate, totalAudits }: any) {
  return (
    <div>
      {/* Top 3 insight cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <InsightCard C={C} light={light} tone="warning" icon="◎" title="Needs Attention"
          agent={lowestAgent?.label || 'No data'}
          detail={lowestAgent ? `${lowestAgent.averageQuality.toFixed(1)}% avg quality across ${lowestAgent.auditsCount} audit${lowestAgent.auditsCount !== 1 ? 's' : ''}` : 'No quality insight available.'}
          badge="Lowest Quality"
        />
        <InsightCard C={C} light={light} tone="success" icon="◈" title="Most Consistent"
          agent={mostConsistent?.label || 'No combined data'}
          detail={mostConsistent ? `RSD ${mostConsistent.rsd.toFixed(3)} · Score ${mostConsistent.combinedScore.toFixed(3)}` : 'No consistency signal.'}
          badge="Top Stability"
        />
        <InsightCard C={C} light={light} tone="info" icon="▲" title="Coaching Opportunity"
          agent={coachTarget?.label || 'No target'}
          detail={coachTarget ? `${coachTarget.averageQuality.toFixed(1)}% avg · ${coachTarget.auditsCount} audits` : 'Need 2+ audits per agent.'}
          badge="Action Required"
        />
      </div>

      {/* Distribution */}
      <div style={{ padding: '24px', borderRadius: '20px', border: `1px solid ${C.border}`, background: C.surface, marginBottom: '20px' }}>
        <div className="dash-display" style={{ fontSize: '15px', fontWeight: 800, color: C.text, marginBottom: '4px' }}>Quality Distribution</div>
        <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '18px' }}>All agents ranked by average audit score</div>

        {allSummaries.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: C.textMuted, borderRadius: '10px', border: `1px dashed ${C.border}` }}>No audit data for period</div>
        ) : (
          <div className="dash-scroll" style={{ display: 'grid', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
            {allSummaries.map((a: RankedAuditSummary, i: number) => {
              const qualColor = a.averageQuality >= 90 ? C.salesColor : a.averageQuality >= 75 ? C.accent : a.averageQuality >= 60 ? C.warningColor : C.criticalColor;
              return (
                <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${C.border}`, background: light ? 'rgba(248,250,252,.8)' : 'rgba(13,18,36,.6)' }}>
                  <div className="dash-mono" style={{ width: '24px', fontSize: '11px', fontWeight: 700, color: C.textMuted, flexShrink: 0, textAlign: 'right' }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</div>
                    <div style={{ fontSize: '10px', color: C.textMuted }}>{a.auditsCount} audit{a.auditsCount !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ width: '120px', height: '4px', borderRadius: '999px', background: light ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.06)', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ height: '100%', width: `${a.averageQuality}%`, background: qualColor, borderRadius: '999px' }} />
                  </div>
                  <div className="dash-mono" style={{ fontSize: '13px', fontWeight: 700, color: qualColor, minWidth: '46px', textAlign: 'right', flexShrink: 0 }}>{a.averageQuality.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Period Audits', value: String(totalAudits), detail: 'Total in range' },
          { label: 'Avg Quality', value: `${avgQuality.toFixed(1)}%`, detail: 'Cross-team' },
          { label: 'Release Rate', value: `${releasedRate.toFixed(0)}%`, detail: 'Shared with agents' },
          { label: 'Agents Tracked', value: String(allSummaries.length), detail: 'With audit data' },
        ].map(m => (
          <div key={m.label} style={{ padding: '16px 18px', borderRadius: '14px', border: `1px solid ${C.border}`, background: C.surface }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '4px' }}>{m.label}</div>
            <div className="dash-display" style={{ fontSize: '24px', fontWeight: 800, color: C.text }}>{m.value}</div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '2px' }}>{m.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightCard({ C, light, tone, icon, title, agent, detail, badge }: any) {
  const toneColor = tone === 'warning' ? C.warningColor : tone === 'success' ? C.salesColor : C.accent;
  const toneBg = tone === 'warning' ? 'rgba(245,158,11,.08)' : tone === 'success' ? 'rgba(16,185,129,.08)' : C.accentSoft;
  const toneBorder = tone === 'warning' ? 'rgba(245,158,11,.25)' : tone === 'success' ? 'rgba(16,185,129,.25)' : C.borderAccent;
  return (
    <div className="dash-card-hover" style={{ padding: '22px', borderRadius: '18px', border: `1px solid ${toneBorder}`, background: toneBg, boxShadow: C.shadow }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <span style={{ fontSize: '22px', color: toneColor }}>{icon}</span>
        <span className={`dash-tag dash-tag-${tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'info'}${light ? ' light' : ''}`}>{badge}</span>
      </div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: toneColor, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '6px' }}>{title}</div>
      <div className="dash-display" style={{ fontSize: '17px', fontWeight: 800, color: C.text, marginBottom: '8px', lineHeight: 1.3 }}>{agent}</div>
      <div style={{ fontSize: '12px', color: C.textSub, lineHeight: 1.6 }}>{detail}</div>
    </div>
  );
}

export default Dashboard;
