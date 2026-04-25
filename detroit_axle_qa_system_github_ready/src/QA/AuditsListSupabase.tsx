import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  memo,
  type CSSProperties,
} from 'react';
import { supabase } from '../lib/supabase';

/* ═════════════════════════════════════════════════════════════
   Types
   ═════════════════════════════════════════════════════════════ */

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
  team: 'Calls' | 'Tickets' | 'Sales';
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
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  created_by_email?: string | null;
  created_by_role?: string | null;
};

type AgentProfile = {
  id: string;
  role: 'admin' | 'qa' | 'agent';
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: 'Calls' | 'Tickets' | 'Sales' | null;
};

type CurrentProfile = {
  id: string;
  role: 'admin' | 'qa' | 'agent' | null;
  agent_name?: string | null;
};

type AgentDailyStatus = {
  id?: string;
  agent_id: string;
  team: 'Calls' | 'Tickets' | 'Sales';
  status_date: string;
  status: string;
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
};

type Metric = {
  name: string;
  pass: number;
  borderline: number;
  countsTowardScore?: boolean;
  options?: string[];
  defaultValue?: string;
};

type EditFormState = {
  team: 'Calls' | 'Tickets' | 'Sales' | '';
  caseType: string;
  auditDate: string;
  orderNumber: string;
  phoneNumber: string;
  ticketId: string;
  comments: string;
};

type ImportedEvaluation = {
  score: number | null;
  label: string;
};

type ImportedProgressRow = {
  agent_id: string;
  agent_name: string;
  display_name: string | null;
  team: 'Calls' | 'Tickets' | 'Sales';
  evaluations: ImportedEvaluation[];
  offToday?: boolean;
  latestScore?: number | null;
  averageScore?: number | null;
};

/* ═════════════════════════════════════════════════════════════
   Constants
   ═════════════════════════════════════════════════════════════ */

const MAX_PROGRESS_EVALS = 24;
const PROGRESS_GROUPS = [
  { key: 'g1' as const, label: 'Eval 1–8', start: 0, end: 8 },
  { key: 'g2' as const, label: 'Eval 9–16', start: 8, end: 16 },
  { key: 'g3' as const, label: 'Eval 17–24', start: 16, end: 24 },
];

type ProgressGroupKey = (typeof PROGRESS_GROUPS)[number]['key'];

const LOCKED_NA_METRICS = new Set(['Active Listening']);
const AUTO_FAIL_METRICS = new Set(['Hold (≤3 mins)', 'Procedure']);
const ISSUE_WAS_RESOLVED_METRIC = 'Issue was resolved';
const ISSUE_WAS_RESOLVED_QUESTION: Metric = {
  name: ISSUE_WAS_RESOLVED_METRIC,
  pass: 0,
  borderline: 0,
  countsTowardScore: false,
  options: ['', 'Yes', 'No'],
  defaultValue: '',
};

const callsMetrics: Metric[] = [
  { name: 'Greeting', pass: 2, borderline: 1 },
  { name: 'Friendliness', pass: 6, borderline: 4 },
  { name: 'Hold (≤3 mins)', pass: 9, borderline: 5 },
  { name: 'Call Managing', pass: 9, borderline: 5 },
  { name: 'Procedure', pass: 13, borderline: 7 },
  { name: 'Notes', pass: 13, borderline: 7 },
  { name: 'Creating REF Order', pass: 12, borderline: 6 },
  { name: 'Accuracy', pass: 13, borderline: 7 },
  { name: 'A-form', pass: 6, borderline: 3 },
  { name: 'Refund Form', pass: 11, borderline: 5 },
  { name: 'Providing RL', pass: 4, borderline: 2 },
  { name: 'Ending', pass: 2, borderline: 1 },
  ISSUE_WAS_RESOLVED_QUESTION,
];

const ticketsMetrics: Metric[] = [
  { name: 'Greeting', pass: 5, borderline: 3 },
  { name: 'Friendliness', pass: 5, borderline: 3 },
  { name: 'AI Detection', pass: 10, borderline: 5 },
  { name: 'Typing mistakes', pass: 5, borderline: 3 },
  { name: 'Procedure', pass: 12, borderline: 6 },
  { name: 'Notes', pass: 12, borderline: 6 },
  { name: 'Creating REF Order', pass: 12, borderline: 6 },
  { name: 'Accuracy', pass: 12, borderline: 6 },
  { name: 'A-form', pass: 11, borderline: 5 },
  { name: 'Refund Form', pass: 6, borderline: 3 },
  { name: 'Providing RL', pass: 5, borderline: 3 },
  { name: 'Ending', pass: 5, borderline: 3 },
  ISSUE_WAS_RESOLVED_QUESTION,
];

const salesMetrics: Metric[] = [
  { name: 'Greeting', pass: 2, borderline: 1 },
  { name: 'Friendliness', pass: 5, borderline: 3 },
  { name: 'Hold (≤3 mins)', pass: 10, borderline: 5 },
  { name: 'Call Managing', pass: 10, borderline: 5 },
  { name: 'Active Listening', pass: 5, borderline: 3 },
  { name: 'Polite', pass: 5, borderline: 3 },
  { name: 'Correct address', pass: 15, borderline: 7 },
  { name: 'Correct part was chosen', pass: 15, borderline: 7 },
  { name: 'ETA provided?', pass: 15, borderline: 7 },
  { name: 'Refund Form', pass: 5, borderline: 3 },
  { name: 'Up-selling', pass: 8, borderline: 4 },
  { name: 'Ending', pass: 5, borderline: 3 },
  ISSUE_WAS_RESOLVED_QUESTION,
];

/* ═════════════════════════════════════════════════════════════
   Helpers
   ═════════════════════════════════════════════════════════════ */

function normalizeOffEvalIndexes(indexes: number[]) {
  return Array.from(
    new Set(
      indexes.filter(
        (v) => Number.isInteger(v) && v >= 0 && v < MAX_PROGRESS_EVALS
      )
    )
  ).sort((a, b) => a - b);
}

function buildShiftedEvaluations(
  evaluations: ImportedEvaluation[],
  offIndexes: number[]
) {
  const normalized = normalizeOffEvalIndexes(offIndexes);
  if (normalized.length === 0) return evaluations.slice(0, MAX_PROGRESS_EVALS);
  const offSet = new Set(normalized);
  const shifted: ImportedEvaluation[] = Array.from(
    { length: MAX_PROGRESS_EVALS },
    (): ImportedEvaluation => ({ score: null, label: '' })
  );
  let si = 0;
  for (let di = 0; di < MAX_PROGRESS_EVALS; di++) {
    if (offSet.has(di)) continue;
    if (si >= evaluations.length) break;
    shifted[di] = evaluations[si] || { score: null, label: '' };
    si++;
  }
  return shifted;
}

function countsTowardScore(m: Metric) {
  return m.countsTowardScore !== false;
}
function shouldShowMetricComment(r: string) {
  return r === 'Borderline' || r === 'Fail' || r === 'Auto-Fail';
}
function openNativeDatePicker(t: HTMLInputElement) {
  try {
    (t as any).showPicker?.();
  } catch {
    /* ignore */
  }
}
function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}
function normalizeText(v?: string | null) {
  return String(v || '').replace(/\u00a0/g, ' ').trim();
}
function normalizeHeader(v?: string | null) {
  return normalizeText(v).toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function normalizeAgentId(v?: string | null) {
  return normalizeText(v).replace(/\.0+$/, '');
}
function clampScoreValue(score: number | null | undefined) {
  if (score === null || score === undefined || !Number.isFinite(score))
    return null;
  return Math.min(100, Math.max(0, score));
}
function parsePercentLike(v?: string | null) {
  const raw = normalizeText(v).replace('%', '').replace(/,/g, '');
  if (
    !raw ||
    raw === '-' ||
    raw.toLowerCase() === '#div/0!' ||
    raw.toLowerCase() === 'off'
  )
    return null;
  const p = Number(raw);
  return clampScoreValue(p);
}
function parseCsv(text: string) {
  const rows: string[][] = [];
  let cur = '',
    row: string[] = [],
    inQ = false;
  const input = text.replace(/^\ufeff/, '');
  for (let i = 0; i < input.length; i++) {
    const c = input[i],
      n = input[i + 1];
    if (c === '"') {
      if (inQ && n === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) {
      row.push(cur);
      cur = '';
      continue;
    }
    if ((c === '\n' || c === '\r') && !inQ) {
      if (c === '\r' && n === '\n') i++;
      row.push(cur);
      if (row.some((cell) => normalizeText(cell) !== '')) rows.push(row);
      row = [];
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.some((c) => normalizeText(c) !== '')) rows.push(row);
  }
  return rows;
}
function getScoreBand(score: number | null): 'strong' | 'medium' | 'weak' | 'empty' {
  if (score === null || isNaN(score)) return 'empty';
  if (score >= 90) return 'strong';
  if (score >= 75) return 'medium';
  return 'weak';
}
function formatDateOnly(v?: string | null) {
  if (!v) return '—';
  const d = new Date(`${v}T00:00:00`);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString();
}
function formatDateTime(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}
function getDaysOld(v?: string | null) {
  const raw = String(v || '').slice(0, 10);
  if (!raw) return 0;
  const base = new Date(`${raw}T00:00:00`);
  if (isNaN(base.getTime())) return 0;
  const now = new Date();
  return Math.max(
    0,
    Math.floor(
      (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
        base.getTime()) /
        86400000
    )
  );
}

/* ═════════════════════════════════════════════════════════════
   Theme
   ═════════════════════════════════════════════════════════════ */

function useThemeRefresh() {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => setK((v) => v + 1);
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-mode'],
    });
    if (document.body)
      obs.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-theme', 'data-theme-mode'],
      });
    window.addEventListener('storage', refresh);
    window.addEventListener(
      'detroit-axle-theme-change',
      refresh as EventListener
    );
    return () => {
      obs.disconnect();
      window.removeEventListener('storage', refresh);
      window.removeEventListener(
        'detroit-axle-theme-change',
        refresh as EventListener
      );
    };
  }, []);
  return k;
}

function getAuditsListThemeVars(): Record<string, string> {
  const themeMode =
    typeof document !== 'undefined'
      ? (
          document.body.dataset.theme ||
          document.documentElement.dataset.theme ||
          document.documentElement.getAttribute('data-theme-mode') ||
          window.localStorage.getItem('detroit-axle-theme-mode') ||
          ''
        ).toLowerCase()
      : '';
  const isLight = themeMode === 'light' || themeMode === 'white';
  return {
    '--al-text': isLight ? '#334155' : '#e5eefb',
    '--al-muted': isLight ? '#475569' : '#cbd5e1',
    '--al-subtle': isLight ? '#64748b' : '#94a3b8',
    '--al-title': isLight ? '#0f172a' : '#f8fafc',
    '--al-heading-soft': isLight ? '#1e293b' : '#f1f5f9',
    '--al-accent': isLight ? '#2563eb' : '#60a5fa',
    '--al-accent-soft': isLight ? '#1d4ed8' : '#93c5fd',
    '--al-panel-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(243,247,255,0.96) 100%)'
      : 'linear-gradient(180deg, rgba(15,23,42,0.80) 0%, rgba(15,23,42,0.65) 100%)',
    '--al-panel-border': isLight ? 'rgba(203,213,225,0.92)' : 'rgba(148,163,184,0.12)',
    '--al-surface': isLight ? 'rgba(255,255,255,0.99)' : 'rgba(15,23,42,0.70)',
    '--al-surface-soft': isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.50)',
    '--al-surface-muted': isLight ? 'rgba(241,245,249,0.98)' : 'rgba(15,23,42,0.40)',
    '--al-card-bg': isLight ? 'rgba(255,255,255,0.98)' : 'rgba(10,17,35,0.50)',
    '--al-table-bg': isLight ? 'rgba(255,255,255,0.98)' : 'rgba(10,17,35,0.60)',
    '--al-table-head': isLight ? 'rgba(241,245,255,0.98)' : 'rgba(6,12,28,0.95)',
    '--al-field-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,255,0.98) 100%)'
      : 'rgba(15,23,42,0.70)',
    '--al-field-bg-strong': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.98) 100%)'
      : 'rgba(15,23,42,0.80)',
    '--al-field-text': isLight ? '#334155' : '#e2e8f0',
    '--al-border': isLight ? 'rgba(203,213,225,0.92)' : 'rgba(148,163,184,0.18)',
    '--al-border-soft': isLight ? 'rgba(203,213,225,0.72)' : 'rgba(148,163,184,0.10)',
    '--al-border-faint': isLight ? 'rgba(203,213,225,0.56)' : 'rgba(148,163,184,0.07)',
    '--al-shadow': isLight ? '0 18px 40px rgba(15,23,42,0.08)' : '0 18px 40px rgba(2,6,23,0.35)',
    '--al-chip-bg': isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.60)',
    '--al-chip-text': isLight ? '#475569' : '#94a3b8',
    '--al-chip-muted-bg': isLight ? 'rgba(248,250,252,0.96)' : 'rgba(15,23,42,0.35)',
    '--al-chip-muted-text': isLight ? '#94a3b8' : '#475569',
    '--al-chip-active-bg': isLight ? 'rgba(37,99,235,0.10)' : 'rgba(37,99,235,0.22)',
    '--al-chip-active-text': isLight ? '#1d4ed8' : '#93c5fd',
    '--al-info-bg': isLight ? 'rgba(59,130,246,0.10)' : 'rgba(30,64,175,0.16)',
    '--al-info-border': isLight ? 'rgba(147,197,253,0.30)' : 'rgba(147,197,253,0.18)',
    '--al-info-text': isLight ? '#1d4ed8' : '#93c5fd',
    '--al-error-bg': isLight ? 'rgba(254,242,242,0.98)' : 'rgba(127,29,29,0.22)',
    '--al-error-border': isLight ? 'rgba(248,113,113,0.28)' : 'rgba(252,165,165,0.22)',
    '--al-error-text': isLight ? '#b91c1c' : '#fca5a5',
    '--al-success-bg': isLight ? 'rgba(240,253,244,0.98)' : 'rgba(22,101,52,0.22)',
    '--al-success-border': isLight ? 'rgba(134,239,172,0.30)' : 'rgba(134,239,172,0.22)',
    '--al-success-text': isLight ? '#166534' : '#86efac',
    '--al-danger-bg': isLight ? 'rgba(254,242,242,0.98)' : 'rgba(185,28,28,0.20)',
    '--al-danger-border': isLight ? 'rgba(248,113,113,0.28)' : 'rgba(239,68,68,0.24)',
    '--al-danger-text': isLight ? '#b91c1c' : '#fca5a5',
    '--al-progress-strong-bg': isLight ? 'rgba(34,197,94,0.12)' : 'rgba(16,185,129,0.14)',
    '--al-progress-strong-text': isLight ? '#166534' : '#34d399',
    '--al-progress-strong-border': isLight ? 'rgba(34,197,94,0.26)' : 'rgba(52,211,153,0.25)',
    '--al-progress-medium-bg': isLight ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.14)',
    '--al-progress-medium-text': isLight ? '#92400e' : '#fbbf24',
    '--al-progress-medium-border': isLight ? 'rgba(245,158,11,0.26)' : 'rgba(251,191,36,0.25)',
    '--al-progress-weak-bg': isLight ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.14)',
    '--al-progress-weak-text': isLight ? '#991b1b' : '#f87171',
    '--al-progress-weak-border': isLight ? 'rgba(239,68,68,0.24)' : 'rgba(248,113,113,0.25)',
    '--al-progress-empty-bg': isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.40)',
    '--al-progress-empty-text': isLight ? '#94a3b8' : '#475569',
    '--al-progress-empty-border': isLight ? 'rgba(203,213,225,0.92)' : 'rgba(148,163,184,0.10)',
    '--al-off-bg': isLight ? 'rgba(124,58,237,0.10)' : 'rgba(124,58,237,0.16)',
    '--al-off-text': isLight ? '#7c3aed' : '#c4b5fd',
    '--al-off-border': isLight ? 'rgba(139,92,246,0.26)' : 'rgba(196,181,253,0.22)',
    '--al-highlight-bg': isLight
      ? 'linear-gradient(135deg, rgba(219,234,254,0.70), rgba(255,255,255,0.98))'
      : 'linear-gradient(135deg, rgba(37,99,235,0.18), rgba(15,23,42,0.40))',
  };
}

/* ═════════════════════════════════════════════════════════════
   Sub-components
   ═════════════════════════════════════════════════════════════ */

const EvalBandBadge = memo(function EvalBandBadge({
  band,
}: {
  band: ReturnType<typeof getScoreBand>;
}) {
  const map: Record<string, CSSProperties> = {
    strong: {
      background: 'var(--al-progress-strong-bg)',
      color: 'var(--al-progress-strong-text)',
      borderColor: 'var(--al-progress-strong-border)',
    },
    medium: {
      background: 'var(--al-progress-medium-bg)',
      color: 'var(--al-progress-medium-text)',
      borderColor: 'var(--al-progress-medium-border)',
    },
    weak: {
      background: 'var(--al-progress-weak-bg)',
      color: 'var(--al-progress-weak-text)',
      borderColor: 'var(--al-progress-weak-border)',
    },
    empty: {
      background: 'var(--al-surface-muted)',
      color: 'var(--al-chip-muted-text)',
      borderColor: 'var(--al-progress-empty-border)',
    },
  };
  return <span style={map[band] || map.empty} />;
});

/* ═════════════════════════════════════════════════════════════
   Main Component
   ═════════════════════════════════════════════════════════════ */

function AuditsListSupabase() {
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [releaseLoadingId, setReleaseLoadingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [caseTypeFilter, setCaseTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingAuditId, setEditingAuditId] = useState<string | null>(null);
  const [selectedAgentProfileId, setSelectedAgentProfileId] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editForm, setEditForm] = useState<EditFormState>({
    team: '',
    caseType: '',
    auditDate: '',
    orderNumber: '',
    phoneNumber: '',
    ticketId: '',
    comments: '',
  });
  const [editScores, setEditScores] = useState<Record<string, string>>({});
  const [editMetricComments, setEditMetricComments] = useState<
    Record<string, string>
  >({});
  const [showEvaluationProgress, setShowEvaluationProgress] = useState(false);
  const [offTodayByAgent, setOffTodayByAgent] = useState<
    Record<string, boolean>
  >({});
  const [importedProgressByAgent, setImportedProgressByAgent] = useState<
    Record<string, ImportedProgressRow>
  >({});
  const [importedFileName, setImportedFileName] = useState('');
  const [importingBoard, setImportingBoard] = useState(false);
  const [focusedEvalGroup, setFocusedEvalGroup] = useState<'all' | ProgressGroupKey>('all');
  const [collapsedEvalGroups, setCollapsedEvalGroups] = useState<
    Record<ProgressGroupKey, boolean>
  >({ g1: false, g2: false, g3: false });
  const [selectedOffEvalIndexes, setSelectedOffEvalIndexes] = useState<number[]>([0]);
  const [manualOffEvalIndexesByAgent, setManualOffEvalIndexesByAgent] = useState<
    Record<string, number[]>
  >({});

  const agentPickerRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const deferredSearch = useDeferredValue(searchText);
  const deferredAgentSearch = useDeferredValue(agentSearch);
  const themeRefreshKey = useThemeRefresh();
  const themeVars = useMemo(() => getAuditsListThemeVars(), [themeRefreshKey]);

  const isAdmin = currentProfile?.role === 'admin';
  const canManageOffToday =
    currentProfile?.role === 'admin' || currentProfile?.role === 'qa';
  const todayStatusDate = getTodayDateValue();

  /* ── Data loading ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      setLoading(false);
      setErrorMessage(authErr.message);
      return;
    }
    const uid = authData.user?.id;
    const [auditsRes, profilesRes, currentRes, offRes] = await Promise.all([
      supabase.from('audits').select('*').order('audit_date', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, role, agent_id, agent_name, display_name, team')
        .eq('role', 'agent')
        .order('agent_name', { ascending: true }),
      uid
        ? supabase
            .from('profiles')
            .select('id, role, agent_name')
            .eq('id', uid)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('agent_daily_status')
        .select('agent_id, team, status_date, status')
        .eq('status_date', todayStatusDate),
    ]);
    setLoading(false);
    if (auditsRes.error) {
      setErrorMessage(auditsRes.error.message);
      return;
    }
    if (profilesRes.error) {
      setErrorMessage(profilesRes.error.message);
      return;
    }
    if (currentRes.error) {
      setErrorMessage(currentRes.error.message);
      return;
    }
    if (offRes.error) {
      setErrorMessage(offRes.error.message);
      return;
    }

    setAudits((auditsRes.data as AuditItem[]) || []);
    setProfiles((profilesRes.data as AgentProfile[]) || []);
    setCurrentProfile((currentRes.data as CurrentProfile) || null);

    const offMap: Record<string, boolean> = {};
    const manualMap: Record<string, number[]> = {};
    ((offRes.data as AgentDailyStatus[]) || []).forEach((item) => {
      const key = agentKey(item.agent_id, item.team);
      if (item.status === 'OFF') {
        offMap[key] = true;
        return;
      }
      const idx = parseOffEvalIdx(item.status);
      if (idx === null) return;
      manualMap[key] = normalizeOffEvalIndexes([
        ...(manualMap[key] || []),
        idx,
      ]);
    });
    setOffTodayByAgent(offMap);
    setManualOffEvalIndexesByAgent(manualMap);
  }, [todayStatusDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const ch = supabase
      .channel('agent-daily-status-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_daily_status' },
        () => void loadData()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [todayStatusDate, loadData]);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (
        agentPickerRef.current &&
        !agentPickerRef.current.contains(e.target as Node)
      )
        setIsAgentPickerOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  /* ── Memoized lookups ── */
  const displayNameByKey = useMemo(() => {
    const m = new Map<string, string | null>();
    profiles.forEach((p) => {
      if (!p.agent_id || !p.team) return;
      m.set(agentKey(p.agent_id, p.team), p.display_name || null);
    });
    return m;
  }, [profiles]);

  const profileByAuditKey = useMemo(() => {
    const m = new Map<string, AgentProfile>();
    profiles.forEach((p) => {
      if (!p.agent_id || !p.team) return;
      m.set(`${p.agent_id}||${p.agent_name}||${p.team}`, p);
    });
    return m;
  }, [profiles]);

  function agentKey(id?: string | null, team?: string | null) {
    return `${id || ''}||${team || ''}`;
  }
  function getOffEvalStatusValue(i: number) {
    return `OFF_EVAL_${i + 1}`;
  }
  function parseOffEvalIdx(s?: string | null) {
    const m = String(s || '').match(/^OFF_EVAL_(\d+)$/);
    if (!m) return null;
    const p = Number(m[1]) - 1;
    return Number.isInteger(p) && p >= 0 && p < MAX_PROGRESS_EVALS ? p : null;
  }
  function getMetricsForTeam(t: EditFormState['team']) {
    if (t === 'Calls') return callsMetrics;
    if (t === 'Tickets') return ticketsMetrics;
    if (t === 'Sales') return salesMetrics;
    return [];
  }
  function getMetricOptions(m: Metric) {
    if (m.options?.length) return m.options;
    if (LOCKED_NA_METRICS.has(m.name)) return ['N/A'];
    const opts = ['N/A', 'Pass', 'Borderline', 'Fail'];
    if (AUTO_FAIL_METRICS.has(m.name)) opts.push('Auto-Fail');
    return opts;
  }
  function getMetricStoredValue(m: Metric, scores: Record<string, string>) {
    if (LOCKED_NA_METRICS.has(m.name)) return 'N/A';
    return scores[m.name] ?? m.defaultValue ?? 'N/A';
  }
  function createDefaultScores(t: EditFormState['team']) {
    const d: Record<string, string> = {};
    getMetricsForTeam(t).forEach((m) => {
      d[m.name] = m.defaultValue ?? 'N/A';
    });
    return d;
  }
  function getMissingRequired(
    t: EditFormState['team'],
    scores: Record<string, string>
  ) {
    return getMetricsForTeam(t)
      .filter((m) => Array.isArray(m.options) && m.defaultValue === '')
      .filter((m) => !getMetricStoredValue(m, scores))
      .map((m) => m.name);
  }
  function buildScoreMap(audit: AuditItem) {
    const d = createDefaultScores(audit.team);
    (audit.score_details || []).forEach((s) => {
      d[s.metric] = s.result || 'N/A';
    });
    getMetricsForTeam(audit.team).forEach((m) => {
      if (LOCKED_NA_METRICS.has(m.name)) d[m.name] = 'N/A';
    });
    return d;
  }
  function buildMetricComments(audit: AuditItem) {
    const d: Record<string, string> = {};
    (audit.score_details || []).forEach((s) => {
      d[s.metric] = s.metric_comment || '';
    });
    return d;
  }
  function getAdjustedScoreData(
    t: EditFormState['team'],
    scores: Record<string, string>,
    comments: Record<string, string>
  ) {
    const metrics = getMetricsForTeam(t);
    const scored = metrics.filter(countsTowardScore);
    const active = scored.filter((m) => {
      const r = getMetricStoredValue(m, scores);
      return r !== 'N/A' && r !== '';
    });
    const activeW = active.reduce((s, m) => s + m.pass, 0);
    const fullW = scored.reduce((s, m) => s + m.pass, 0);
    const details = metrics.map((m) => {
      const result = getMetricStoredValue(m, scores);
      const sc = countsTowardScore(m);
      const aw =
        !sc || result === 'N/A' || result === '' || activeW === 0
          ? 0
          : (m.pass / activeW) * fullW;
      let earned = 0;
      if (sc && result === 'Pass') earned = aw;
      else if (sc && result === 'Borderline')
        earned = m.pass > 0 ? aw * (m.borderline / m.pass) : 0;
      return {
        metric: m.name,
        result,
        pass: m.pass,
        borderline: m.borderline,
        adjustedWeight: aw,
        earned,
        counts_toward_score: sc,
        metric_comment:
          sc && shouldShowMetricComment(result)
            ? (comments[m.name] || '').trim() || null
            : null,
      };
    });
    const hasAutoFail = details.some(
      (d) =>
        d.counts_toward_score !== false &&
        AUTO_FAIL_METRICS.has(d.metric) &&
        d.result === 'Auto-Fail'
    );
    const rawQualityScore = hasAutoFail
      ? 0
      : details
          .filter((d) => d.counts_toward_score !== false)
          .reduce((s, d) => s + d.earned, 0);
    const qualityScore = (clampScoreValue(rawQualityScore) ?? 0).toFixed(2);
    return { scoreDetails: details, qualityScore, hasAutoFail };
  }
  function getAgentLabel(p: AgentProfile) {
    return p.display_name
      ? `${p.agent_name} — ${p.display_name}`
      : `${p.agent_name} · ${p.agent_id}`;
  }
  function getDisplayName(audit: AuditItem) {
    return (
      displayNameByKey.get(agentKey(audit.agent_id, audit.team)) || null
    );
  }
  function getCreatedByLabel(audit: AuditItem) {
    return audit.created_by_name || audit.created_by_email || '—';
  }
  function getAuditReference(audit: AuditItem) {
    if (audit.team === 'Tickets') return `Ticket: ${audit.ticket_id || '—'}`;
    return `Order #${audit.order_number || '—'} · ${audit.phone_number || '—'}`;
  }
  function getCommentsPreview(v?: string | null) {
    const t = (v || '').trim();
    if (!t) return '—';
    return t.length <= 120 ? t : `${t.slice(0, 117)}…`;
  }

  const editTeamAgents = useMemo(
    () =>
      profiles.filter(
        (p) =>
          p.role === 'agent' &&
          p.team === editForm.team &&
          p.agent_id &&
          p.agent_name
      ),
    [profiles, editForm.team]
  );
  const visibleAgents = useMemo(() => {
    const s = deferredAgentSearch.trim().toLowerCase();
    if (!s) return editTeamAgents;
    return editTeamAgents.filter(
      (p) =>
        p.agent_name.toLowerCase().includes(s) ||
        (p.agent_id || '').toLowerCase().includes(s) ||
        (p.display_name || '').toLowerCase().includes(s)
    );
  }, [editTeamAgents, deferredAgentSearch]);

  const selectedAgent =
    editTeamAgents.find((p) => p.id === selectedAgentProfileId) || null;

  const filteredAudits = useMemo(() => {
    const s = deferredSearch.trim().toLowerCase();
    return audits.filter((a) => {
      const dn = (getDisplayName(a) || '').toLowerCase();
      const ms =
        !s ||
        a.agent_name.toLowerCase().includes(s) ||
        a.agent_id.toLowerCase().includes(s) ||
        dn.includes(s);
      const mt = teamFilter ? a.team === teamFilter : true;
      const mc = caseTypeFilter ? a.case_type === caseTypeFilter : true;
      const mdf = dateFrom ? a.audit_date >= dateFrom : true;
      const mdt = dateTo ? a.audit_date <= dateTo : true;
      return ms && mt && mc && mdf && mdt;
    });
  }, [
    audits,
    deferredSearch,
    teamFilter,
    caseTypeFilter,
    dateFrom,
    dateTo,
    profiles,
  ]);

  const uniqueCaseTypes = Array.from(new Set(audits.map((a) => a.case_type)));
  const sharedFiltered = filteredAudits.filter((a) => a.shared_with_agent)
    .length;
  const hiddenFiltered = filteredAudits.length - sharedFiltered;
  const sharedAll = audits.filter((a) => a.shared_with_agent).length;
  const hiddenAll = audits.length - sharedAll;

  function getEffectiveOffIndexes(aid?: string | null, team?: string | null) {
    const key = agentKey(aid, team);
    const mi = normalizeOffEvalIndexes(manualOffEvalIndexesByAgent[key] || []);
    return mi.length > 0 ? mi : [];
  }

  /* ── Progress data (expensive — memoized) ── */
  const progressData = useMemo(() => {
    const ns = deferredSearch.trim().toLowerCase();
    const scopedProfiles = profiles.filter(
      (p) =>
        (teamFilter ? p.team === teamFilter : true) &&
        (!ns ||
          p.agent_name.toLowerCase().includes(ns) ||
          (p.agent_id || '').toLowerCase().includes(ns) ||
          (p.display_name || '').toLowerCase().includes(ns))
    );
    const grouped = new Map<
      string,
      {
        agent_id: string;
        agent_name: string;
        display_name: string | null;
        team: 'Calls' | 'Tickets' | 'Sales';
        evaluations: Array<{
          id: string;
          audit_date: string;
          quality_score: number;
          case_type: string;
        }>;
      }
    >();

    filteredAudits.forEach((a) => {
      const k = agentKey(a.agent_id, a.team);
      const ex = grouped.get(k) || {
        agent_id: a.agent_id,
        agent_name: a.agent_name,
        display_name: getDisplayName(a),
        team: a.team,
        evaluations: [],
      };
      ex.evaluations.push({
        id: a.id,
        audit_date: a.audit_date,
        quality_score: Number(a.quality_score),
        case_type: a.case_type,
      });
      if (!ex.display_name) ex.display_name = getDisplayName(a);
      grouped.set(k, ex);
    });

    scopedProfiles.forEach((p) => {
      if (!p.agent_id || !p.team) return;
      const k = agentKey(p.agent_id, p.team);
      if (!grouped.has(k))
        grouped.set(k, {
          agent_id: p.agent_id,
          agent_name: p.agent_name,
          display_name: p.display_name,
          team: p.team,
          evaluations: [],
        });
    });

    Object.entries(importedProgressByAgent).forEach(([k, ir]) => {
      if (teamFilter && ir.team !== teamFilter) return;
      if (ns) {
        const hay = [ir.agent_name, ir.display_name || '', ir.agent_id]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(ns)) return;
      }
      const ex = grouped.get(k) || {
        agent_id: ir.agent_id,
        agent_name: ir.agent_name,
        display_name: ir.display_name,
        team: ir.team,
        evaluations: [],
      };
      grouped.set(k, ex);
    });

    const rows = Array.from(grouped.values())
      .map((row) => {
        const k = agentKey(row.agent_id, row.team);
        const imp = importedProgressByAgent[k] || null;
        const dbEvals = [...row.evaluations]
          .sort((a, b) => a.audit_date.localeCompare(b.audit_date))
          .slice(-MAX_PROGRESS_EVALS)
          .map((e) => ({
            score: clampScoreValue(e.quality_score),
            label: e.audit_date
              ? `${formatDateOnly(e.audit_date)} · ${e.case_type}`
              : '',
          }));
        const evals =
          imp?.evaluations?.length > 0
            ? imp.evaluations.slice(0, MAX_PROGRESS_EVALS)
            : dbEvals;
        const offToday =
          imp?.offToday === true || !!offTodayByAgent[k];
        const offIdx = getEffectiveOffIndexes(row.agent_id, row.team);
        const shifted = buildShiftedEvaluations(evals, offIdx);
        const scored = evals.filter((e) => e.score !== null);
        const avg = clampScoreValue(
          imp?.averageScore ??
            (scored.length > 0
              ? scored.reduce((s, e) => s + (e.score ?? 0), 0) /
                scored.length
              : null)
        );
        const latest = clampScoreValue(
          imp?.latestScore ??
            (scored.length > 0
              ? scored[scored.length - 1]?.score ?? null
              : null)
        );
        const latestDate =
          row.evaluations.length > 0
            ? [...row.evaluations]
                .sort((a, b) => a.audit_date.localeCompare(b.audit_date))
                .slice(-1)[0]?.audit_date ?? null
            : null;
        return {
          agent_id: row.agent_id,
          agent_name: imp?.agent_name || row.agent_name,
          display_name: imp?.display_name ?? row.display_name,
          team: row.team,
          evaluations: evals,
          shiftedEvaluations: shifted,
          offIndexes: offIdx,
          averageScore:
            avg !== null && Number.isFinite(avg) ? avg : null,
          latestScore:
            latest !== null && Number.isFinite(latest) ? latest : null,
          latestAuditDate: latestDate,
          offToday,
        };
      })
      .sort((a, b) => a.agent_name.localeCompare(b.agent_name));

    const cols = Array.from({ length: MAX_PROGRESS_EVALS }, (_, i) => {
      const g =
        PROGRESS_GROUPS.find((g) => i >= g.start && i < g.end) ||
        PROGRESS_GROUPS[0];
      return {
        index: i,
        label: `Eval ${i + 1}`,
        groupKey: g.key,
        groupLabel: g.label,
      };
    });

    return { rows, evaluationColumns: cols };
  }, [
    filteredAudits,
    profiles,
    deferredSearch,
    teamFilter,
    offTodayByAgent,
    manualOffEvalIndexesByAgent,
    importedProgressByAgent,
  ]);

  const visibleCols = useMemo(
    () =>
      progressData.evaluationColumns.filter(
        (c) =>
          (focusedEvalGroup === 'all' || c.groupKey === focusedEvalGroup) &&
          !collapsedEvalGroups[c.groupKey]
      ),
    [progressData.evaluationColumns, focusedEvalGroup, collapsedEvalGroups]
  );

  useEffect(() => {
    if (visibleCols.length === 0) return;
    const vs = new Set(visibleCols.map((c) => c.index));
    setSelectedOffEvalIndexes((prev) => {
      const f = normalizeOffEvalIndexes(prev.filter((i) => vs.has(i)));
      return f.length > 0 ? f : [visibleCols[0].index];
    });
  }, [visibleCols]);

  const visibleGroupSpans = useMemo(
    () =>
      PROGRESS_GROUPS.map((g) => ({
        ...g,
        count: visibleCols.filter((c) => c.groupKey === g.key).length,
      })).filter((g) => g.count > 0),
    [visibleCols]
  );

  const gridTemplate = useMemo(
    () => `280px 120px 130px repeat(${visibleCols.length}, 88px) 150px 130px`,
    [visibleCols.length]
  );

  const toggleGroupCollapse = useCallback((k: ProgressGroupKey) => {
    setCollapsedEvalGroups((prev) => ({ ...prev, [k]: !prev[k] }));
    setFocusedEvalGroup((prev) => (prev !== k ? prev : 'all'));
  }, []);

  const formatOffSummary = useCallback((idxs: number[]) => {
    const n = normalizeOffEvalIndexes(idxs);
    if (n.length === 0) return 'None';
    if (n.length <= 3) return n.map((i) => `Eval ${i + 1}`).join(', ');
    return `${n.length} evals selected`;
  }, []);

  /* ── Actions ── */
  const syncOffState = useCallback(
    async (agentId: string, team: 'Calls' | 'Tickets' | 'Sales', nextIdx: number[]) => {
      const existing = [
        'OFF',
        ...Array.from({ length: MAX_PROGRESS_EVALS }, (_, i) =>
          getOffEvalStatusValue(i)
        ),
      ];
      const { error: de } = await supabase
        .from('agent_daily_status')
        .delete()
        .eq('agent_id', agentId)
        .eq('team', team)
        .eq('status_date', todayStatusDate)
        .in('status', existing);
      if (de) throw de;
      if (nextIdx.length === 0) return;

      const rows: AgentDailyStatus[] = [
        {
          agent_id: agentId,
          team,
          status_date: todayStatusDate,
          status: 'OFF',
          created_by_user_id: currentProfile?.id || null,
          created_by_name: currentProfile?.agent_name || null,
        },
        ...normalizeOffEvalIndexes(nextIdx).map((i) => ({
          agent_id: agentId,
          team,
          status_date: todayStatusDate,
          status: getOffEvalStatusValue(i),
          created_by_user_id: currentProfile?.id || null,
          created_by_name: currentProfile?.agent_name || null,
        })),
      ];
      const { error: ie } = await supabase
        .from('agent_daily_status')
        .insert(rows);
      if (ie) throw ie;
    },
    [currentProfile, todayStatusDate]
  );

  const toggleAgentOff = useCallback(
    async (aid?: string | null, team?: AuditItem['team'] | null) => {
      setErrorMessage('');
      setSuccessMessage('');
      if (!canManageOffToday) {
        setErrorMessage('Only admin or QA can update OFF day markers.');
        return;
      }
      if (!aid || !team) {
        setErrorMessage('Agent ID or team is missing.');
        return;
      }
      const targets = normalizeOffEvalIndexes(selectedOffEvalIndexes);
      if (targets.length === 0) {
        setErrorMessage('Choose at least one Eval header before applying OFF.');
        return;
      }
      const k = agentKey(aid, team);
      const cur = getEffectiveOffIndexes(aid, team);
      const curSet = new Set(cur);
      const allOff = targets.every((i) => curSet.has(i));
      const next = allOff
        ? cur.filter((i) => !targets.includes(i))
        : normalizeOffEvalIndexes([...cur, ...targets]);

      try {
        await syncOffState(aid, team, next);
        setManualOffEvalIndexesByAgent((prev) => {
          const n = { ...prev };
          if (next.length > 0) n[k] = next;
          else delete n[k];
          return n;
        });
        setOffTodayByAgent((prev) => {
          const n = { ...prev };
          if (next.length > 0) n[k] = true;
          else delete n[k];
          return n;
        });
        setSuccessMessage(
          next.length > 0
            ? `OFF set for ${formatOffSummary(next)}.`
            : 'All OFF markers cleared.'
        );
      } catch (e) {
        setErrorMessage(
          e instanceof Error ? e.message : 'Could not update OFF markers.'
        );
      }
    },
    [canManageOffToday, selectedOffEvalIndexes, syncOffState, formatOffSummary]
  );

  const handleProgressImport = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      setImportingBoard(true);
      setErrorMessage('');
      setSuccessMessage('');
      try {
        if (!file.name.toLowerCase().endsWith('.csv')) {
          setErrorMessage('Please upload a CSV file.');
          return;
        }
        const text = await file.text();
        const rows = parseCsv(text);
        if (rows.length === 0) {
          setErrorMessage('CSV is empty.');
          return;
        }
        const headers = rows[0].map((h) => normalizeHeader(h));
        const fi = (...n: string[]) => headers.findIndex((h) => n.includes(h));
        const ani = fi('agentname', 'agent');
        const dni = fi('displayname', 'display');
        const aii = fi('agentid', 'agent');
        const ti = fi('team');
        const tdi = fi('today', 'offtoday', 'status');

        const eis = headers
          .map((h, i) => ({ h, i }))
          .filter(
            ({ h }) =>
              /^eval\d+$/.test(h) ||
              /^evaluation\d+$/.test(h) ||
              /^qc\d+$/.test(h)
          )
          .sort((a, b) => a.i - b.i)
          .slice(0, MAX_PROGRESS_EVALS);
        const li = fi('latest', 'latestscore');
        const avgi = fi('average', 'avg', 'averagescore');

        if (ani === -1 && aii === -1) {
          setErrorMessage('CSV must have Agent Name or Agent ID.');
          return;
        }

        const next: Record<string, ImportedProgressRow> = {};
        rows.slice(1).forEach((cells) => {
          const an = normalizeText(cells[ani] || '');
          const dn = dni >= 0 ? normalizeText(cells[dni] || '') : '';
          const aid = normalizeAgentId(cells[aii] || '');
          const rt = normalizeText(cells[ti] || '');
          const team = (
            rt === 'Calls' || rt === 'Tickets' || rt === 'Sales'
              ? rt
              : teamFilter === 'Calls' ||
                teamFilter === 'Tickets' ||
                teamFilter === 'Sales'
              ? teamFilter
              : ''
          ) as '' | 'Calls' | 'Tickets' | 'Sales';
          if (!team || (!an && !aid)) return;

          const k = agentKey(aid || an, team);
          const evals: ImportedEvaluation[] = eis.map(({ i }) => ({
            score: parsePercentLike(cells[i] || ''),
            label: normalizeText(cells[i] || ''),
          }));
          const tv =
            tdi >= 0 ? normalizeText(cells[tdi] || '').toLowerCase() : '';
          next[k] = {
            agent_id: aid,
            agent_name: an || aid,
            display_name: dn || null,
            team,
            evaluations: evals,
            offToday: tv === 'off',
            latestScore: li >= 0 ? parsePercentLike(cells[li] || '') : null,
            averageScore:
              avgi >= 0 ? parsePercentLike(cells[avgi] || '') : null,
          };
        });

        setImportedProgressByAgent(next);
        setImportedFileName(file.name);
        setSuccessMessage(
          `Imported ${Object.keys(next).length} rows from ${file.name}.`
        );
      } catch (e) {
        setErrorMessage(
          e instanceof Error ? e.message : 'Could not import CSV.'
        );
      } finally {
        setImportingBoard(false);
        if (importInputRef.current) importInputRef.current.value = '';
      }
    },
    [teamFilter]
  );

  const startEditAudit = useCallback(
    (audit: AuditItem) => {
      if (!isAdmin) {
        setErrorMessage('Only admin can edit audits.');
        return;
      }
      const mp =
        profileByAuditKey.get(
          `${audit.agent_id}||${audit.agent_name}||${audit.team}`
        ) || null;
      setErrorMessage('');
      setSuccessMessage('');
      setEditingAuditId(audit.id);
      setExpandedId(audit.id);
      setSelectedAgentProfileId(mp?.id || '');
      setAgentSearch(mp ? getAgentLabel(mp) : '');
      setIsAgentPickerOpen(false);
      setEditForm({
        team: audit.team,
        caseType: audit.case_type,
        auditDate: audit.audit_date,
        orderNumber: audit.order_number || '',
        phoneNumber: audit.phone_number || '',
        ticketId: audit.ticket_id || '',
        comments: audit.comments || '',
      });
      setEditScores(buildScoreMap(audit));
      setEditMetricComments(buildMetricComments(audit));
    },
    [isAdmin, profileByAuditKey]
  );

  const cancelEdit = useCallback(() => {
    setEditingAuditId(null);
    setSelectedAgentProfileId('');
    setAgentSearch('');
    setIsAgentPickerOpen(false);
    setEditForm({
      team: '',
      caseType: '',
      auditDate: '',
      orderNumber: '',
      phoneNumber: '',
      ticketId: '',
      comments: '',
    });
    setEditScores({});
    setEditMetricComments({});
  }, []);

  const handleTeamChange = useCallback(
    (t: EditFormState['team']) => {
      setEditForm((prev) => ({
        ...prev,
        team: t,
        orderNumber: '',
        phoneNumber: '',
        ticketId: '',
      }));
      setSelectedAgentProfileId('');
      setAgentSearch('');
      setIsAgentPickerOpen(false);
      setEditScores(createDefaultScores(t));
      setEditMetricComments({});
    },
    []
  );

  const handleScoreChange = useCallback(
    (name: string, val: string) => {
      if (LOCKED_NA_METRICS.has(name)) {
        setEditScores((prev) => ({ ...prev, [name]: 'N/A' }));
        setEditMetricComments((prev) => ({ ...prev, [name]: '' }));
        return;
      }
      setEditScores((prev) => ({ ...prev, [name]: val }));
      if (!shouldShowMetricComment(val))
        setEditMetricComments((prev) => {
          const n = { ...prev };
          delete n[name];
          return n;
        });
    },
    []
  );

  const handleUpdate = useCallback(
    async (auditId: string) => {
      setErrorMessage('');
      setSuccessMessage('');
      if (!isAdmin) {
        setErrorMessage('Only admin can save changes.');
        return;
      }
      if (!editForm.team) {
        setErrorMessage('Please choose a team.');
        return;
      }
      if (!selectedAgent) {
        setErrorMessage('Please choose an agent.');
        return;
      }
      if (!editForm.caseType || !editForm.auditDate) {
        setErrorMessage('Please fill Case Type and Audit Date.');
        return;
      }
      if (
        (editForm.team === 'Calls' || editForm.team === 'Sales') &&
        !editForm.orderNumber
      ) {
        setErrorMessage('Please fill Order Number.');
        return;
      }
      if (editForm.team === 'Tickets' && !editForm.ticketId) {
        setErrorMessage('Please fill Ticket ID.');
        return;
      }

      const missing = getMissingRequired(editForm.team, editScores);
      if (missing.length > 0) {
        setErrorMessage(`Please answer: ${missing.join(', ')}.`);
        return;
      }
      if (!selectedAgent.agent_id) {
        setErrorMessage('Selected agent has no Agent ID.');
        return;
      }

      const missingComments = getMetricsForTeam(editForm.team)
        .filter(countsTowardScore)
        .filter((m) =>
          shouldShowMetricComment(getMetricStoredValue(m, editScores))
        )
        .filter((m) => !(editMetricComments[m.name] || '').trim())
        .map((m) => m.name);
      if (missingComments.length > 0) {
        setErrorMessage(
          `Please add QA note for: ${missingComments.join(', ')}.`
        );
        return;
      }

      const adj = getAdjustedScoreData(
        editForm.team,
        editScores,
        editMetricComments
      );
      setSaving(true);
      const payload = {
        agent_id: selectedAgent.agent_id,
        agent_name: selectedAgent.agent_name,
        team: editForm.team,
        case_type: editForm.caseType,
        audit_date: editForm.auditDate,
        order_number:
          editForm.team === 'Calls' || editForm.team === 'Sales'
            ? editForm.orderNumber
            : null,
        phone_number:
          editForm.team === 'Calls' || editForm.team === 'Sales'
            ? editForm.phoneNumber || null
            : null,
        ticket_id: editForm.team === 'Tickets' ? editForm.ticketId : null,
        quality_score: Number(adj.qualityScore),
        comments: editForm.comments,
        score_details: adj.scoreDetails,
      };
      const { error } = await supabase
        .from('audits')
        .update(payload)
        .eq('id', auditId);
      setSaving(false);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setAudits((prev) =>
        prev.map((a) => (a.id === auditId ? { ...a, ...payload } : a))
      );
      setSuccessMessage('Audit updated successfully.');
      cancelEdit();
    },
    [isAdmin, editForm, selectedAgent, editScores, editMetricComments, cancelEdit]
  );

  const handleToggleShare = useCallback(
    async (audit: AuditItem) => {
      setErrorMessage('');
      setSuccessMessage('');
      if (!isAdmin) {
        setErrorMessage('Only admin can share or hide audits.');
        return;
      }
      const next = !audit.shared_with_agent;
      if (
        !window.confirm(
          next
            ? 'Share this audit with the agent?'
            : 'Hide this audit from the agent?'
        )
      )
        return;
      setReleaseLoadingId(audit.id);
      const { data, error } = await supabase
        .from('audits')
        .update({
          shared_with_agent: next,
          shared_at: next ? new Date().toISOString() : null,
        })
        .eq('id', audit.id)
        .select('id, shared_with_agent, shared_at')
        .maybeSingle();
      setReleaseLoadingId(null);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (!data) {
        setErrorMessage('Share update did not persist.');
        return;
      }
      setAudits((prev) =>
        prev.map((a) =>
          a.id === audit.id
            ? {
                ...a,
                shared_with_agent: data.shared_with_agent,
                shared_at: data.shared_at,
              }
            : a
        )
      );
      setSuccessMessage(
        data.shared_with_agent
          ? 'Audit shared successfully.'
          : 'Audit hidden successfully.'
      );
    },
    [isAdmin]
  );

  const handleBulkShare = useCallback(
    async (share: boolean) => {
      setErrorMessage('');
      setSuccessMessage('');
      if (!isAdmin) {
        setErrorMessage('Only admin can bulk release.');
        return;
      }
      if (filteredAudits.length === 0) {
        setErrorMessage('No audits match filters.');
        return;
      }
      if (
        !window.confirm(
          share
            ? `Share ${filteredAudits.length} filtered audits?`
            : `Hide ${filteredAudits.length} filtered audits?`
        )
      )
        return;
      setBulkSaving(true);
      const ids = filteredAudits.map((a) => a.id);
      const { data, error } = await supabase
        .from('audits')
        .update({
          shared_with_agent: share,
          shared_at: share ? new Date().toISOString() : null,
        })
        .in('id', ids)
        .select('id, shared_with_agent, shared_at');
      setBulkSaving(false);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (!data?.length) {
        setErrorMessage('Bulk share did not persist.');
        return;
      }
      const um = new Map(
        data.map((r) => [
          r.id,
          { shared_with_agent: r.shared_with_agent, shared_at: r.shared_at },
        ])
      );
      setAudits((prev) =>
        prev.map((a) => {
          const u = um.get(a.id);
          return u ? { ...a, ...u } : a;
        })
      );
      setSuccessMessage(
        share ? `${data.length} audits shared.` : `${data.length} audits hidden.`
      );
    },
    [isAdmin, filteredAudits]
  );

  const handleHideAll = useCallback(async () => {
    setErrorMessage('');
    setSuccessMessage('');
    if (!isAdmin) {
      setErrorMessage('Only admin can hide all.');
      return;
    }
    if (audits.length === 0) {
      setErrorMessage('No audits to hide.');
      return;
    }
    if (!window.confirm(`Hide all ${audits.length} audits?`)) return;
    setBulkSaving(true);
    const { data, error } = await supabase
      .from('audits')
      .update({ shared_with_agent: false, shared_at: null })
      .in(
        'id',
        audits.map((a) => a.id)
      )
      .select('id, shared_with_agent, shared_at');
    setBulkSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    if (!data?.length) {
      setErrorMessage('Hide all did not persist.');
      return;
    }
    const um = new Map(
      data.map((r) => [
        r.id,
        { shared_with_agent: r.shared_with_agent, shared_at: r.shared_at },
      ])
    );
    setAudits((prev) =>
      prev.map((a) => {
        const u = um.get(a.id);
        return u ? { ...a, ...u } : a;
      })
    );
    setSuccessMessage(`${data.length} audits hidden.`);
  }, [isAdmin, audits]);

  const handleDelete = useCallback(
    async (id: string) => {
      setErrorMessage('');
      setSuccessMessage('');
      if (!isAdmin) {
        setErrorMessage('Only admin can delete.');
        return;
      }
      if (!window.confirm('Delete this audit?')) return;
      const { error } = await supabase.from('audits').delete().eq('id', id);
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      setAudits((prev) => prev.filter((a) => a.id !== id));
      if (expandedId === id) setExpandedId(null);
      if (editingAuditId === id) cancelEdit();
      setSuccessMessage('Audit deleted.');
    },
    [isAdmin, expandedId, editingAuditId, cancelEdit]
  );

  function getResultColor(r: string): string {
    if (r === 'Pass') return '#10b981';
    if (r === 'Borderline') return '#f59e0b';
    if (r === 'Fail' || r === 'Auto-Fail') return '#ef4444';
    return 'var(--al-subtle)';
  }

  function getTeamAccent(team: string): string {
    if (team === 'Calls') return '#3b82f6';
    if (team === 'Tickets') return '#8b5cf6';
    if (team === 'Sales') return '#10b981';
    return 'var(--al-subtle)';
  }

  /* ═════════════════════════════════════════════════════════
     Render
     ═════════════════════════════════════════════════════════ */

  if (loading)
    return (
      <div
        data-no-theme-invert="true"
        style={{ ...(themeVars as CSSProperties), ...S.loadingWrap }}
      >
        <div className="da-themed-loader-shell da-themed-loader-shell--page">
          <div className="da-themed-loader-card">
            <div className="da-themed-loader">
              <div className="da-themed-loader__art" aria-hidden="true">
                <div className="da-themed-loader__glow" />
                <div className="da-themed-loader__rotor">
                  <div className="da-themed-loader__rotor-face" />
                  <div className="da-themed-loader__hub" />
                </div>
                <div className="da-themed-loader__caliper" />
                <div className="da-themed-loader__spark" />
              </div>
              <div className="da-themed-loader__copy">
                <div className="da-themed-loader__eyebrow">Detroit Axle</div>
                <div className="da-themed-loader__label">Loading audits...</div>
                <div className="da-themed-loader__sub">
                  Checking rotors, calipers, and release state
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div
      data-no-theme-invert="true"
      style={{ ...(themeVars as CSSProperties), ...S.root }}
    >
      {/* Page Header */}
      <div style={S.pageHeader}>
        <div>
          <div style={S.eyebrow}>Audit Management</div>
          <h2 style={S.pageTitle}>Audits List</h2>
          <p style={S.pageSubtitle}>
            QA can view audits and score details. Only admin can edit, delete,
            or release audits.
          </p>
        </div>
        <div style={S.headerActions}>
          <button
            onClick={() => setShowEvaluationProgress((p) => !p)}
            style={showEvaluationProgress ? S.btnAccent : S.btnSecondary}
          >
            {showEvaluationProgress ? '↑ Hide Progress' : '↓ Show Progress'}
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importingBoard}
            style={S.btnSecondary}
          >
            {importingBoard ? 'Importing…' : '⬆ Import CSV'}
          </button>
          {importedFileName && (
            <button
              onClick={() => {
                setImportedProgressByAgent({});
                setImportedFileName('');
                setSuccessMessage('Board cleared.');
              }}
              style={S.btnSecondary}
            >
              ✕ Clear Board
            </button>
          )}
          <button onClick={() => void loadData()} style={S.btnSecondary}>
            ↻ Refresh
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => void handleProgressImport(e.target.files?.[0])}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Banners */}
      {errorMessage && (
        <div style={S.bannerError} role="alert">
          <span style={S.bannerIcon}>⚠</span>
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div style={S.bannerSuccess} role="status">
          <span style={S.bannerIcon}>✓</span>
          {successMessage}
        </div>
      )}

      {/* Filters */}
      <div style={S.panel}>
        <div style={S.filterRow}>
          <div style={S.filterFieldWide}>
            <label style={S.label}>Search Agent</label>
            <div style={S.searchWrap}>
              <span style={S.searchIcon}>⌕</span>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Name, Display Name or ID…"
                style={S.searchInput}
              />
            </div>
          </div>
          <div style={S.filterField}>
            <label style={S.label}>Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={S.select}
            >
              <option value="">All Teams</option>
              <option value="Calls">Calls</option>
              <option value="Tickets">Tickets</option>
              <option value="Sales">Sales</option>
            </select>
          </div>
          <div style={S.filterField}>
            <label style={S.label}>Case Type</label>
            <select
              value={caseTypeFilter}
              onChange={(e) => setCaseTypeFilter(e.target.value)}
              style={S.select}
            >
              <option value="">All Types</option>
              {uniqueCaseTypes.map((ct) => (
                <option key={ct} value={ct}>
                  {ct}
                </option>
              ))}
            </select>
          </div>
          <div style={S.filterFieldNarrow}>
            <label style={S.label}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              onClick={(e) => openNativeDatePicker(e.currentTarget)}
              style={S.input}
            />
          </div>
          <div style={S.filterFieldNarrow}>
            <label style={S.label}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              onClick={(e) => openNativeDatePicker(e.currentTarget)}
              style={S.input}
            />
          </div>
        </div>
      </div>

      {/* Release Controls */}
      {isAdmin ? (
        <div style={{ ...S.panel, marginTop: '14px' }}>
          <div style={S.releaseHeader}>
            <div>
              <div style={S.eyebrow}>Weekly Release Controls</div>
              <p style={S.releaseDesc}>
                Use filters to select a scope, then share or hide filtered
                audits.
              </p>
            </div>
            <div style={S.statsRow}>
              {[
                {
                  label: 'Filtered',
                  val: filteredAudits.length,
                  color: 'var(--al-accent)',
                },
                {
                  label: 'Shared (filtered)',
                  val: sharedFiltered,
                  color: 'var(--al-progress-strong-text)',
                },
                {
                  label: 'Hidden (filtered)',
                  val: hiddenFiltered,
                  color: 'var(--al-progress-weak-text)',
                },
                { label: 'Total', val: audits.length, color: '#a78bfa' },
                {
                  label: 'Shared (all)',
                  val: sharedAll,
                  color: 'var(--al-progress-strong-text)',
                },
                {
                  label: 'Hidden (all)',
                  val: hiddenAll,
                  color: 'var(--al-progress-weak-text)',
                },
              ].map((stat) => (
                <div key={stat.label} style={S.statCard}>
                  <div style={{ ...S.statVal, color: stat.color }}>
                    {stat.val}
                  </div>
                  <div style={S.statLabel}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={S.btnGroup}>
            <button
              onClick={() => void handleBulkShare(true)}
              disabled={bulkSaving || filteredAudits.length === 0}
              style={S.btnPrimary}
            >
              {bulkSaving ? '…' : 'Share Filtered'}
            </button>
            <button
              onClick={() => void handleBulkShare(false)}
              disabled={bulkSaving || filteredAudits.length === 0}
              style={S.btnDanger}
            >
              {bulkSaving ? '…' : 'Hide Filtered'}
            </button>
            <button
              onClick={() => void handleHideAll()}
              disabled={bulkSaving || audits.length === 0}
              style={S.btnDanger}
            >
              {bulkSaving ? '…' : 'Hide All Audits'}
            </button>
          </div>
        </div>
      ) : (
        <div style={S.infoBanner}>
          QA view — read-only. Only admin can edit, delete, or release audits.
        </div>
      )}

      {/* Evaluation Progress Board */}
      {showEvaluationProgress && (
        <div style={{ ...S.panel, marginTop: '14px' }}>
          <div style={S.progressHeader}>
            <div>
              <div style={S.eyebrow}>Evaluation Progress</div>
              <h3 style={S.sectionTitle}>Team Progress Board</h3>
              <p style={S.releaseDesc}>
                Filtered audits displayed below. Import a CSV to overlay Eval
                columns.
              </p>
            </div>
            <div style={S.metaPills}>
              {[
                `Today: ${todayStatusDate}`,
                `Rows: ${progressData.rows.length}`,
                `Visible: ${visibleCols.length} evals`,
                importedFileName ? `CSV: ${importedFileName}` : null,
              ]
                .filter(Boolean)
                .map((t) => (
                  <span key={t} style={S.metaPill}>
                    {t}
                  </span>
                ))}
            </div>
          </div>

          {/* Controls */}
          <div style={S.progressControls}>
            <div style={S.controlBlock}>
              <div style={S.controlLabel}>Quick View</div>
              <div style={S.controlRow}>
                {(
                  ['all', ...PROGRESS_GROUPS.map((g) => g.key)] as (
                    | 'all'
                    | ProgressGroupKey
                  )[]
                ).map((k) => (
                  <button
                    key={k}
                    onClick={() => setFocusedEvalGroup(k)}
                    style={
                      focusedEvalGroup === k ? S.chipActive : S.chip
                    }
                  >
                    {k === 'all' ? 'All 24' : PROGRESS_GROUPS.find((g) => g.key === k)?.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={S.controlBlock}>
              <div style={S.controlLabel}>Groups</div>
              <div style={S.controlRow}>
                {PROGRESS_GROUPS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => toggleGroupCollapse(g.key)}
                    style={
                      collapsedEvalGroups[g.key] ? S.chipMuted : S.chip
                    }
                  >
                    {collapsedEvalGroups[g.key]
                      ? `+ ${g.label}`
                      : `− ${g.label}`}
                  </button>
                ))}
              </div>
            </div>
            <div style={S.controlBlock}>
              <div style={S.controlLabel}>OFF Targets</div>
              <div style={S.controlRow}>
                <button
                  onClick={() =>
                    setSelectedOffEvalIndexes(
                      normalizeOffEvalIndexes(
                        visibleCols.map((c) => c.index)
                      )
                    )
                  }
                  style={S.chip}
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedOffEvalIndexes([])}
                  style={S.chip}
                >
                  Clear
                </button>
                <span style={S.offTargetBadge}>
                  {selectedOffEvalIndexes.length > 0
                    ? formatOffSummary(selectedOffEvalIndexes)
                    : 'None selected'}
                </span>
              </div>
            </div>
          </div>

          <p style={S.progressHint}>
            Click Eval headers to pick OFF targets, then use each agent's Today
            button to apply.
          </p>

          {progressData.rows.length === 0 ? (
            <div style={S.emptyState}>
              No evaluation progress data for current filters.
            </div>
          ) : visibleCols.length === 0 ? (
            <div style={S.emptyState}>
              All eval groups hidden — use group buttons above to show one.
            </div>
          ) : (
            <div style={S.tableWrap}>
              <div style={{ minWidth: '2600px' }}>
                {/* Group header */}
                <div
                  style={{
                    ...S.progressRow,
                    gridTemplateColumns: gridTemplate,
                    background: 'var(--al-chip-bg)',
                    borderBottom: '1px solid rgba(148,163,184,0.10)',
                    padding: '10px 16px 0',
                  }}
                >
                  <div
                    style={{
                      ...S.groupHeaderCell,
                      gridColumn: 'span 3',
                    }}
                  >
                    Agent Snapshot
                  </div>
                  {visibleGroupSpans.map((g) => (
                    <div
                      key={g.key}
                      style={{
                        ...S.groupHeaderCell,
                        gridColumn: `span ${g.count}`,
                      }}
                    >
                      {g.label}
                    </div>
                  ))}
                  <div
                    style={{
                      ...S.groupHeaderCell,
                      gridColumn: 'span 2',
                    }}
                  >
                    Summary
                  </div>
                </div>

                {/* Column header */}
                <div
                  style={{
                    ...S.progressRow,
                    gridTemplateColumns: gridTemplate,
                    background: 'var(--al-surface-soft)',
                    borderBottom: '1px solid var(--al-border)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  }}
                >
                  <div style={{ ...S.th, ...S.stickyAgent }}>Agent</div>
                  <div style={{ ...S.th, ...S.stickyTeam }}>Team</div>
                  <div style={{ ...S.th, ...S.stickyToday }}>Today</div>
                  {visibleCols.map((col) => (
                    <button
                      key={col.label}
                      onClick={() =>
                        setSelectedOffEvalIndexes((prev) =>
                          prev.includes(col.index)
                            ? normalizeOffEvalIndexes(
                                prev.filter((i) => i !== col.index)
                              )
                            : normalizeOffEvalIndexes([...prev, col.index])
                        )
                      }
                      style={{
                        ...S.evalHeader,
                        ...(selectedOffEvalIndexes.includes(col.index)
                          ? S.evalHeaderActive
                          : {}),
                      }}
                    >
                      {col.label}
                    </button>
                  ))}
                  <div style={S.th}>Latest Date</div>
                  <div style={S.th}>Average</div>
                </div>

                {/* Rows */}
                {progressData.rows.map((row) => {
                  const offIdx =
                    row.offIndexes || getEffectiveOffIndexes(row.agent_id, row.team);
                  const hasOff = offIdx.length > 0;
                  const allOff =
                    selectedOffEvalIndexes.length > 0 &&
                    selectedOffEvalIndexes.every((i) => offIdx.includes(i));

                  return (
                    <div
                      key={agentKey(row.agent_id, row.team)}
                      style={{
                        ...S.progressRow,
                        gridTemplateColumns: gridTemplate,
                        borderBottom: '1px solid var(--al-border-faint)',
                        padding: '10px 16px',
                      }}
                    >
                      <div style={{ ...S.agentCell, ...S.stickyAgent }}>
                        <div style={S.agentName}>{row.agent_name}</div>
                        <div style={S.agentSub}>
                          {row.display_name || '—'} · {row.agent_id}
                        </div>
                      </div>
                      <div style={{ ...S.metaCell, ...S.stickyTeam }}>
                        <span
                          style={{
                            ...S.teamPill,
                            borderColor:
                              getTeamAccent(row.team) + '60',
                            color: getTeamAccent(row.team),
                          }}
                        >
                          {row.team}
                        </span>
                      </div>
                      <div style={{ ...S.metaCell, ...S.stickyToday }}>
                        <button
                          onClick={() =>
                            void toggleAgentOff(row.agent_id, row.team)
                          }
                          disabled={!canManageOffToday}
                          style={{
                            ...S.offBtn,
                            ...(hasOff ? S.offBtnActive : {}),
                            opacity: canManageOffToday ? 1 : 0.5,
                          }}
                        >
                          {selectedOffEvalIndexes.length === 0
                            ? '— Select —'
                            : allOff
                            ? `Clear ${selectedOffEvalIndexes.length}`
                            : `OFF ×${selectedOffEvalIndexes.length}`}
                        </button>
                      </div>
                      {visibleCols.map((col) => {
                        const ev =
                          row.shiftedEvaluations?.[col.index] ||
                          row.evaluations[col.index] || {
                            score: null,
                            label: '',
                          };
                        const displayScore = clampScoreValue(ev.score);
                        const has = displayScore !== null;
                        const isOff = offIdx.includes(col.index);
                        const isSel = selectedOffEvalIndexes.includes(
                          col.index
                        );

                        if (isOff)
                          return (
                            <div
                              key={`${row.agent_id}-${col.index}`}
                              style={{
                                ...S.evalCell,
                                ...S.evalOff,
                                ...(isSel ? S.evalSelected : {}),
                              }}
                              title={`OFF – ${col.label}`}
                            >
                              OFF
                            </div>
                          );

                        const band = getScoreBand(displayScore);
                        return (
                          <div
                            key={`${row.agent_id}-${col.index}`}
                            style={{
                              ...S.evalCell,
                              ...(band === 'strong'
                                ? S.evalStrong
                                : band === 'medium'
                                ? S.evalMedium
                                : band === 'weak'
                                ? S.evalWeak
                                : S.evalEmpty),
                              ...(isSel ? S.evalSelected : {}),
                            }}
                            title={
                              has
                                ? ev.label || `${displayScore}%`
                                : 'No eval'
                            }
                          >
                            {has ? `${displayScore!.toFixed(0)}%` : '—'}
                          </div>
                        );
                      })}
                      <div style={S.metaCell}>
                        {row.latestAuditDate ? (
                          <div style={S.agentName}>
                            {formatDateOnly(row.latestAuditDate)}
                          </div>
                        ) : hasOff ? (
                          <span style={S.offPill}>
                            {offIdx.length === 1
                              ? `Eval ${offIdx[0] + 1}`
                              : `${offIdx.length} OFF`}
                          </span>
                        ) : (
                          <span style={S.agentSub}>—</span>
                        )}
                      </div>
                      <div style={S.metaCell}>
                        <span
                          style={{
                            ...S.avgPill,
                            ...(getScoreBand(row.averageScore) === 'strong'
                              ? S.evalStrong
                              : getScoreBand(row.averageScore) === 'medium'
                              ? S.evalMedium
                              : getScoreBand(row.averageScore) === 'weak'
                              ? S.evalWeak
                              : S.evalEmpty),
                          }}
                        >
                          {row.averageScore === null
                            ? '—'
                            : `${row.averageScore.toFixed(1)}%`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audits Table */}
      {filteredAudits.length === 0 ? (
        <div style={S.emptyState}>
          No audits found for current filters.
        </div>
      ) : (
        <div style={{ ...S.tableWrap, marginTop: '14px' }}>
          <div style={{ minWidth: '1800px' }}>
            {/* Table header */}
            <div style={{ ...S.auditRow, ...S.auditHeader }}>
              {[
                'Agent',
                'Date',
                'Case Type',
                'Reference',
                'Quality',
                'Status',
                'Created By',
                'Comments',
                'Actions',
              ].map((h) => (
                <div key={h} style={S.th}>
                  {h}
                </div>
              ))}
            </div>

            {/* Table rows */}
            {filteredAudits.map((audit) => (
              <AuditTableRow
                key={audit.id}
                audit={audit}
                isAdmin={isAdmin}
                isEditing={editingAuditId === audit.id}
                isExpanded={expandedId === audit.id || editingAuditId === audit.id}
                releaseLoadingId={releaseLoadingId}
                saving={saving}
                bulkSaving={bulkSaving}
                onExpandToggle={() =>
                  setExpandedId(expandedId === audit.id ? null : audit.id)
                }
                onEdit={() => startEditAudit(audit)}
                onShare={() => void handleToggleShare(audit)}
                onDelete={() => void handleDelete(audit.id)}
                getDisplayName={getDisplayName}
                getCreatedByLabel={getCreatedByLabel}
                getAuditReference={getAuditReference}
                getCommentsPreview={getCommentsPreview}
              >
                {editingAuditId === audit.id && isAdmin && (
                  <EditAuditForm
                    audit={audit}
                    editForm={editForm}
                    setEditForm={setEditForm}
                    editScores={editScores}
                    setEditScores={setEditScores}
                    editMetricComments={editMetricComments}
                    setEditMetricComments={setEditMetricComments}
                    selectedAgentProfileId={selectedAgentProfileId}
                    setSelectedAgentProfileId={setSelectedAgentProfileId}
                    agentSearch={agentSearch}
                    setAgentSearch={setAgentSearch}
                    isAgentPickerOpen={isAgentPickerOpen}
                    setIsAgentPickerOpen={setIsAgentPickerOpen}
                    agentPickerRef={agentPickerRef}
                    visibleAgents={visibleAgents}
                    selectedAgent={selectedAgent}
                    getAgentLabel={getAgentLabel}
                    onTeamChange={handleTeamChange}
                    onScoreChange={handleScoreChange}
                    onUpdate={() => void handleUpdate(audit.id)}
                    onCancel={cancelEdit}
                    saving={saving}
                  />
                )}
                {editingAuditId !== audit.id && (
                  <AuditDetailView audit={audit} getResultColor={getResultColor} />
                )}
              </AuditTableRow>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(AuditsListSupabase);

/* ═════════════════════════════════════════════════════════════
   Sub-components (module scope)
   ═════════════════════════════════════════════════════════════ */

function AuditTableRow({
  audit,
  isAdmin,
  isEditing,
  isExpanded,
  releaseLoadingId,
  saving,
  bulkSaving,
  onExpandToggle,
  onEdit,
  onShare,
  onDelete,
  getDisplayName,
  getCreatedByLabel,
  getAuditReference,
  getCommentsPreview,
  children,
}: {
  audit: AuditItem;
  isAdmin: boolean;
  isEditing: boolean;
  isExpanded: boolean;
  releaseLoadingId: string | null;
  saving: boolean;
  bulkSaving: boolean;
  onExpandToggle: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
  getDisplayName: (a: AuditItem) => string | null;
  getCreatedByLabel: (a: AuditItem) => string;
  getAuditReference: (a: AuditItem) => string;
  getCommentsPreview: (v?: string | null) => string;
  children: React.ReactNode;
}) {
  const score = clampScoreValue(Number(audit.quality_score)) ?? 0;
  const band = getScoreBand(score);

  return (
    <div style={S.auditEntry}>
      <div style={S.auditRow}>
        <div>
          <div style={S.agentName}>{audit.agent_name}</div>
          <div style={S.agentSub}>
            {getDisplayName(audit) || '—'} · {audit.agent_id} ·{' '}
            <span style={{ color: getTeamAccent(audit.team) }}>
              {audit.team}
            </span>
          </div>
        </div>
        <div style={S.agentName}>{formatDateOnly(audit.audit_date)}</div>
        <div style={S.agentName}>{audit.case_type}</div>
        <div style={{ ...S.agentName, fontSize: '12px' }}>
          {getAuditReference(audit)}
        </div>
        <div>
          <span
            style={{
              ...S.scoreBadge,
              ...(band === 'strong'
                ? S.evalStrong
                : band === 'medium'
                ? S.evalMedium
                : band === 'weak'
                ? S.evalWeak
                : S.evalEmpty),
            }}
          >
            {score.toFixed(2)}%
          </span>
        </div>
        <div>
          <span
            style={{
              ...S.statusPill,
              background: audit.shared_with_agent
                ? 'var(--al-progress-strong-bg)'
                : 'var(--al-chip-muted-bg)',
              color: audit.shared_with_agent
                ? 'var(--al-progress-strong-text)'
                : 'var(--al-subtle)',
              borderColor: audit.shared_with_agent
                ? 'var(--al-progress-strong-border)'
                : 'var(--al-border)',
            }}
          >
            {audit.shared_with_agent ? '● Shared' : '○ Hidden'}
          </span>
          {audit.shared_at && (
            <div style={{ ...S.agentSub, marginTop: '4px' }}>
              {formatDateTime(audit.shared_at)}
            </div>
          )}
        </div>
        <div>
          <div style={S.agentName}>{getCreatedByLabel(audit)}</div>
          <div style={S.agentSub}>{audit.created_by_role || '—'}</div>
        </div>
        <div
          style={{ ...S.agentName, fontSize: '12px', opacity: 0.8 }}
        >
          {getCommentsPreview(audit.comments)}
        </div>
        <div style={S.actionCell}>
          <button onClick={onExpandToggle} style={S.btnMini}>
            {isExpanded ? 'Hide' : 'Details'}
          </button>
          {isAdmin && (
            <>
              <button
                onClick={onShare}
                disabled={
                  releaseLoadingId === audit.id || saving || bulkSaving
                }
                style={
                  audit.shared_with_agent
                    ? S.btnMiniDanger
                    : S.btnMiniPrimary
                }
              >
                {releaseLoadingId === audit.id
                  ? '…'
                  : audit.shared_with_agent
                  ? 'Hide'
                  : 'Share'}
              </button>
              {!isEditing && (
                <button onClick={onEdit} style={S.btnMini}>
                  Edit
                </button>
              )}
              <button onClick={onDelete} style={S.btnMiniDanger}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {isExpanded && <div style={S.expandedWrap}>{children}</div>}
    </div>
  );
}

function EditAuditForm({
  audit,
  editForm,
  setEditForm,
  editScores,
  setEditScores,
  editMetricComments,
  setEditMetricComments,
  selectedAgentProfileId,
  setSelectedAgentProfileId,
  agentSearch,
  setAgentSearch,
  isAgentPickerOpen,
  setIsAgentPickerOpen,
  agentPickerRef,
  visibleAgents,
  selectedAgent,
  getAgentLabel,
  onTeamChange,
  onScoreChange,
  onUpdate,
  onCancel,
  saving,
}: {
  audit: AuditItem;
  editForm: EditFormState;
  setEditForm: React.Dispatch<React.SetStateAction<EditFormState>>;
  editScores: Record<string, string>;
  setEditScores: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  editMetricComments: Record<string, string>;
  setEditMetricComments: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  selectedAgentProfileId: string;
  setSelectedAgentProfileId: (id: string) => void;
  agentSearch: string;
  setAgentSearch: (v: string) => void;
  isAgentPickerOpen: boolean;
  setIsAgentPickerOpen: (v: boolean) => void;
  agentPickerRef: React.RefObject<HTMLDivElement | null>;
  visibleAgents: AgentProfile[];
  selectedAgent: AgentProfile | null;
  getAgentLabel: (p: AgentProfile) => string;
  onTeamChange: (t: EditFormState['team']) => void;
  onScoreChange: (name: string, val: string) => void;
  onUpdate: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const adjEdit = useMemo(
    () => getAdjustedScoreData(editForm.team, editScores, editMetricComments),
    [editForm.team, editScores, editMetricComments]
  );

  return (
    <div style={S.expandedPanel}>
      <div style={S.eyebrow}>Edit Audit</div>
      <div style={S.editGrid}>
        <div>
          <label style={S.label}>Team</label>
          <select
            value={editForm.team}
            onChange={(e) =>
              onTeamChange(e.target.value as EditFormState['team'])
            }
            style={S.select}
          >
            <option value="">Select Team</option>
            <option value="Calls">Calls</option>
            <option value="Tickets">Tickets</option>
            <option value="Sales">Sales</option>
          </select>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Agent</label>
          <div ref={agentPickerRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsAgentPickerOpen((p) => !p)}
              style={S.pickerBtn}
            >
              <span
                style={{
                  color: selectedAgent
                    ? 'var(--al-text)'
                    : 'var(--al-subtle)',
                }}
              >
                {selectedAgent ? getAgentLabel(selectedAgent) : 'Select agent'}
              </span>
              <span>▾</span>
            </button>
            {isAgentPickerOpen && (
              <div style={S.pickerMenu}>
                <div
                  style={{
                    padding: '10px',
                    borderBottom: '1px solid var(--al-border)',
                  }}
                >
                  <input
                    type="text"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    placeholder="Search agents…"
                    style={S.input}
                  />
                </div>
                <div
                  style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    padding: '8px',
                    display: 'grid',
                    gap: '6px',
                  }}
                >
                  {visibleAgents.length === 0 ? (
                    <div
                      style={{ padding: '12px', color: 'var(--al-subtle)' }}
                    >
                      No agents found
                    </div>
                  ) : (
                    visibleAgents.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedAgentProfileId(p.id);
                          setAgentSearch(getAgentLabel(p));
                          setIsAgentPickerOpen(false);
                        }}
                        style={{
                          ...S.pickerOption,
                          ...(selectedAgentProfileId === p.id
                            ? S.pickerOptionActive
                            : {}),
                        }}
                      >
                        {getAgentLabel(p)}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div>
          <label style={S.label}>Case Type</label>
          <input
            value={editForm.caseType}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, caseType: e.target.value }))
            }
            style={S.input}
          />
        </div>
        <div>
          <label style={S.label}>Audit Date</label>
          <input
            type="date"
            value={editForm.auditDate}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, auditDate: e.target.value }))
            }
            onClick={(e) => openNativeDatePicker(e.currentTarget)}
            style={S.input}
          />
        </div>
        {(editForm.team === 'Calls' || editForm.team === 'Sales') && (
          <>
            <div>
              <label style={S.label}>Order Number</label>
              <input
                value={editForm.orderNumber}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    orderNumber: e.target.value,
                  }))
                }
                style={S.input}
              />
            </div>
            <div>
              <label style={S.label}>Phone Number</label>
              <input
                value={editForm.phoneNumber}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    phoneNumber: e.target.value,
                  }))
                }
                style={S.input}
              />
            </div>
          </>
        )}
        {editForm.team === 'Tickets' && (
          <div>
            <label style={S.label}>Ticket ID</label>
            <input
              value={editForm.ticketId}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, ticketId: e.target.value }))
              }
              style={S.input}
            />
          </div>
        )}
        <div style={{ gridColumn: '1/-1' }}>
          <label style={S.label}>Comments</label>
          <textarea
            value={editForm.comments}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, comments: e.target.value }))
            }
            rows={3}
            style={{ ...S.input, resize: 'vertical' }}
          />
        </div>
      </div>

      <div
        style={{ marginTop: '20px', display: 'grid', gap: '10px' }}
      >
        {getMetricsForTeam(editForm.team).map((m) => {
          const val = getMetricStoredValue(m, editScores);
          const showComment =
            countsTowardScore(m) && shouldShowMetricComment(val);
          return (
            <div key={m.name} style={S.metricRow}>
              <div style={{ flex: 1 }}>
                <div style={S.metricName}>
                  {countsTowardScore(m)
                    ? `${m.name} (${m.pass} pts)`
                    : m.name}
                </div>
                {showComment && (
                  <textarea
                    value={editMetricComments[m.name] || ''}
                    onChange={(e) =>
                      setEditMetricComments((prev) => ({
                        ...prev,
                        [m.name]: e.target.value,
                      }))
                    }
                    rows={2}
                    placeholder="Short QA note for this result…"
                    style={{
                      ...S.input,
                      marginTop: '8px',
                      resize: 'vertical',
                      fontSize: '12px',
                    }}
                  />
                )}
              </div>
              <select
                value={val}
                onChange={(e) => onScoreChange(m.name, e.target.value)}
                disabled={LOCKED_NA_METRICS.has(m.name)}
                style={{ ...S.select, minWidth: '160px', flexShrink: 0 }}
              >
                {getMetricOptions(m).map((o) => (
                  <option key={o || '__'} value={o}>
                    {o || 'Select answer'}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {adjEdit && (
        <div style={S.scoreSummary}>
          <div style={S.eyebrow}>Score Preview</div>
          <div style={S.scorePreviewVal}>{adjEdit.qualityScore}%</div>
        </div>
      )}
      <div style={{ ...S.btnGroup, marginTop: '18px' }}>
        <button
          onClick={onUpdate}
          disabled={saving}
          style={S.btnPrimary}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={onCancel} style={S.btnSecondary}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function AuditDetailView({
  audit,
  getResultColor,
}: {
  audit: AuditItem;
  getResultColor: (r: string) => string;
}) {
  return (
    <div style={S.expandedPanel}>
      <div style={S.eyebrow}>Audit Details</div>
      <div style={S.detailGrid}>
        {[
          {
            label: 'Created By',
            val: audit.created_by_name || audit.created_by_email || '—',
            sub: audit.created_by_role,
          },
          {
            label: 'Creator Email',
            val: audit.created_by_email || '—',
          },
          {
            label: 'Reference',
            val:
              audit.team === 'Tickets'
                ? `Ticket: ${audit.ticket_id || '—'}`
                : `Order #${audit.order_number || '—'} · ${audit.phone_number || '—'}`,
          },
          {
            label: 'Release Date',
            val: audit.shared_at ? formatDateTime(audit.shared_at) : '—',
          },
        ].map((d) => (
          <div key={d.label} style={S.detailCard}>
            <div style={S.detailLabel}>{d.label}</div>
            <div style={S.detailVal}>{d.val}</div>
            {d.sub && <div style={S.agentSub}>{d.sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ ...S.detailCard, marginBottom: '18px' }}>
        <div style={S.detailLabel}>Full Comment</div>
        <div
          style={{
            color: 'var(--al-text)',
            fontSize: '14px',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {audit.comments?.trim() || '—'}
        </div>
      </div>
      <div style={S.eyebrow}>Score Details</div>
      <div style={{ display: 'grid', gap: '8px' }}>
        {(audit.score_details || []).map((d) => (
          <div
            key={`${audit.id}-${d.metric}`}
            style={S.scoreDetailRow}
          >
            <div style={{ flex: 1 }}>
              <div style={S.metricName}>{d.metric}</div>
              <div style={S.agentSub}>
                {d.counts_toward_score === false
                  ? 'Administrative question'
                  : `Pass ${d.pass} · Borderline ${d.borderline} · Adj. ${d.adjustedWeight.toFixed(2)}`}
              </div>
              {d.metric_comment && (
                <div style={S.noteCard}>
                  <div style={S.noteLabel}>QA Note</div>
                  <div style={S.noteText}>{d.metric_comment}</div>
                </div>
              )}
            </div>
            <span
              style={{
                ...S.resultBadge,
                background: getResultColor(d.result) + '22',
                color: getResultColor(d.result),
                borderColor: getResultColor(d.result) + '44',
              }}
            >
              {d.result}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   Styles (module scope)
   ═════════════════════════════════════════════════════════════ */

const S: Record<string, CSSProperties> = {
  root: {
    color: 'var(--al-text)',
    fontFamily: "'DM Sans', 'Syne', system-ui, sans-serif",
  },
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '40px',
    color: 'var(--al-subtle)',
  },

  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '20px',
  },
  eyebrow: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: 'var(--al-accent)',
    marginBottom: '8px',
  },
  pageTitle: {
    margin: '0 0 6px',
    fontSize: '24px',
    fontWeight: 800,
    color: 'var(--al-heading-soft)',
    letterSpacing: '-0.02em',
    fontFamily: "'Syne', system-ui, sans-serif",
  },
  pageSubtitle: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--al-subtle)',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  panel: {
    background: 'var(--al-panel-bg)',
    border: '1px solid var(--al-panel-border)',
    borderRadius: '20px',
    padding: '20px 22px',
    backdropFilter: 'blur(12px)',
  },

  filterRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  filterFieldWide: { flex: '1 1 280px' },
  filterField: { flex: '1 1 200px' },
  filterFieldNarrow: { flex: '0 1 190px' },

  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: {
    position: 'absolute',
    left: '14px',
    fontSize: '16px',
    color: 'var(--al-subtle)',
    zIndex: 1,
    fontStyle: 'normal',
  },
  searchInput: {
    width: '100%',
    padding: '11px 14px 11px 40px',
    borderRadius: '14px',
    border: '1px solid var(--al-border)',
    background: 'var(--al-field-bg)',
    color: 'var(--al-field-text)',
    fontSize: '13px',
    outline: 'none',
  },

  label: {
    display: 'block',
    marginBottom: '7px',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--al-subtle)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '14px',
    border: '1px solid var(--al-border)',
    background: 'var(--al-field-bg)',
    color: 'var(--al-field-text)',
    fontSize: '13px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '14px',
    border: '1px solid var(--al-border)',
    background: 'var(--al-field-bg-strong)',
    color: 'var(--al-field-text)',
    fontSize: '13px',
    appearance: 'none',
    outline: 'none',
  },

  btnPrimary: {
    padding: '10px 18px',
    background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
    color: '#fff',
    border: '1px solid rgba(96,165,250,0.25)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  btnSecondary: {
    padding: '10px 16px',
    background: 'var(--al-field-bg)',
    color: 'var(--al-muted)',
    border: '1px solid var(--al-border)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  btnAccent: {
    padding: '10px 16px',
    background: 'var(--al-chip-active-bg)',
    color: 'var(--al-accent-soft)',
    border: '1px solid var(--al-info-border)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  btnDanger: {
    padding: '10px 18px',
    background: 'linear-gradient(135deg,#b91c1c,#991b1b)',
    color: '#fff',
    border: '1px solid rgba(252,165,165,0.20)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  btnMini: {
    padding: '7px 12px',
    background: 'var(--al-field-bg)',
    color: 'var(--al-muted)',
    border: '1px solid var(--al-border)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
    fontFamily: 'inherit',
  },
  btnMiniPrimary: {
    padding: '7px 12px',
    background: 'rgba(37,99,235,0.20)',
    color: 'var(--al-accent-soft)',
    border: '1px solid rgba(59,130,246,0.28)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
    fontFamily: 'inherit',
  },
  btnMiniDanger: {
    padding: '7px 12px',
    background: 'rgba(185,28,28,0.20)',
    color: 'var(--al-danger-text)',
    border: '1px solid var(--al-danger-border)',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
    fontFamily: 'inherit',
  },
  btnGroup: { display: 'flex', gap: '10px', flexWrap: 'wrap' },

  bannerError: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
    padding: '13px 16px',
    borderRadius: '14px',
    background: 'var(--al-error-bg)',
    border: '1px solid var(--al-error-border)',
    color: 'var(--al-danger-text)',
    fontSize: '13px',
    fontWeight: 600,
  },
  bannerSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
    padding: '13px 16px',
    borderRadius: '14px',
    background: 'var(--al-success-bg)',
    border: '1px solid var(--al-success-border)',
    color: 'var(--al-success-text)',
    fontSize: '13px',
    fontWeight: 600,
  },
  bannerIcon: { fontSize: '16px', flexShrink: 0 },
  infoBanner: {
    marginTop: '14px',
    padding: '14px 18px',
    borderRadius: '14px',
    background: 'var(--al-info-bg)',
    border: '1px solid var(--al-info-border)',
    color: 'var(--al-accent-soft)',
    fontSize: '13px',
    fontWeight: 600,
  },

  releaseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '20px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  releaseDesc: {
    margin: '6px 0 0',
    fontSize: '13px',
    color: 'var(--al-subtle)',
  },
  sectionTitle: {
    margin: '0 0 4px',
    fontSize: '18px',
    fontWeight: 800,
    color: 'var(--al-heading-soft)',
    fontFamily: "'Syne', system-ui, sans-serif",
  },
  statsRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  statCard: {
    padding: '10px 14px',
    borderRadius: '12px',
    background: 'var(--al-surface-soft)',
    border: '1px solid var(--al-border-soft)',
    minWidth: '80px',
    textAlign: 'center',
  },
  statVal: {
    fontSize: '22px',
    fontWeight: 800,
    fontFamily: "'Syne', system-ui, sans-serif",
  },
  statLabel: {
    fontSize: '11px',
    color: 'var(--al-subtle)',
    fontWeight: 600,
    marginTop: '2px',
  },

  tableWrap: {
    overflowX: 'auto',
    borderRadius: '18px',
    border: '1px solid var(--al-border-soft)',
    background: 'var(--al-table-bg)',
  },

  auditRow: {
    display: 'grid',
    gridTemplateColumns:
      '220px 120px 160px minmax(220px,1fr) 110px 170px 170px minmax(240px,1.5fr) 240px',
    gap: '14px',
    alignItems: 'center',
    padding: '14px 18px',
  },
  auditHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    background: 'var(--al-table-head)',
    borderBottom: '1px solid var(--al-border)',
  },
  auditEntry: { borderBottom: '1px solid var(--al-border-faint)' },
  actionCell: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },

  agentName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--al-field-text)',
    lineHeight: 1.4,
  },
  agentSub: {
    fontSize: '12px',
    color: 'var(--al-subtle)',
    marginTop: '3px',
    lineHeight: 1.4,
  },

  th: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: 'var(--al-chip-muted-text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },

  scoreBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '76px',
    padding: '6px 10px',
    borderRadius: '999px',
    fontWeight: 800,
    fontSize: '13px',
    border: '1px solid',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 10px',
    borderRadius: '999px',
    fontWeight: 700,
    fontSize: '12px',
    border: '1px solid',
  },

  teamPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 10px',
    borderRadius: '999px',
    fontWeight: 700,
    fontSize: '12px',
    border: '1px solid',
    background: 'var(--al-surface-soft)',
  },

  evalStrong: {
    background: 'var(--al-progress-strong-bg)',
    color: 'var(--al-progress-strong-text)',
    borderColor: 'var(--al-progress-strong-border)',
  },
  evalMedium: {
    background: 'var(--al-progress-medium-bg)',
    color: 'var(--al-progress-medium-text)',
    borderColor: 'var(--al-progress-medium-border)',
  },
  evalWeak: {
    background: 'var(--al-progress-weak-bg)',
    color: 'var(--al-progress-weak-text)',
    borderColor: 'var(--al-progress-weak-border)',
  },
  evalEmpty: {
    background: 'var(--al-surface-muted)',
    color: 'var(--al-chip-muted-text)',
    borderColor: 'var(--al-progress-empty-border)',
  },

  expandedWrap: { padding: '0 18px 18px' },
  expandedPanel: {
    borderRadius: '16px',
    border: '1px solid var(--al-border-soft)',
    background: 'rgba(10,17,35,0.50)',
    padding: '18px',
  },
  editGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
    gap: '14px',
  },

  metricRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid var(--al-border-soft)',
    background: 'var(--al-surface-muted)',
  },
  metricName: {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--al-field-text)',
  },

  scoreSummary: {
    marginTop: '18px',
    padding: '16px 20px',
    borderRadius: '14px',
    background: 'var(--al-highlight-bg)',
    border: '1px solid var(--al-info-border)',
  },
  scorePreviewVal: {
    fontSize: '32px',
    fontWeight: 800,
    color: 'var(--al-heading-soft)',
    marginTop: '6px',
    fontFamily: "'Syne', system-ui, sans-serif",
  },

  pickerBtn: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '14px',
    border: '1px solid var(--al-border)',
    background: 'var(--al-field-bg)',
    color: 'var(--al-field-text)',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    fontFamily: 'inherit',
  },
  pickerMenu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    background: 'var(--al-table-head)',
    border: '1px solid rgba(148,163,184,0.14)',
    borderRadius: '16px',
    boxShadow: 'var(--al-shadow)',
    zIndex: 20,
    overflow: 'hidden',
    backdropFilter: 'blur(16px)',
  },
  pickerOption: {
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid rgba(148,163,184,0.08)',
    background: 'var(--al-surface-soft)',
    textAlign: 'left',
    cursor: 'pointer',
    color: 'var(--al-field-text)',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  pickerOptionActive: {
    background: 'rgba(37,99,235,0.28)',
    borderColor: 'rgba(96,165,250,0.30)',
    color: 'var(--al-accent-soft)',
  },

  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
    gap: '10px',
    marginBottom: '14px',
  },
  detailCard: {
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid var(--al-border-soft)',
    background: 'var(--al-surface-muted)',
  },
  detailLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--al-chip-muted-text)',
    marginBottom: '6px',
  },
  detailVal: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--al-field-text)',
  },

  scoreDetailRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    padding: '11px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(148,163,184,0.09)',
    background: 'var(--al-chip-muted-bg)',
  },
  resultBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 10px',
    borderRadius: '999px',
    fontWeight: 700,
    fontSize: '12px',
    border: '1px solid',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  noteCard: {
    marginTop: '8px',
    padding: '9px 11px',
    borderRadius: '10px',
    border: '1px solid var(--al-border-soft)',
    background: 'var(--al-surface-soft)',
  },
  noteLabel: {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: 'var(--al-accent)',
    marginBottom: '4px',
  },
  noteText: {
    fontSize: '13px',
    color: 'var(--al-field-text)',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
  },

  emptyState: {
    marginTop: '14px',
    padding: '22px',
    borderRadius: '16px',
    border: '1px dashed var(--al-border)',
    background: 'var(--al-surface-muted)',
    color: 'var(--al-chip-muted-text)',
    textAlign: 'center',
    fontSize: '14px',
  },

  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '14px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  metaPills: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  metaPill: {
    padding: '6px 11px',
    borderRadius: '999px',
    background: 'var(--al-chip-bg)',
    border: '1px solid var(--al-panel-border)',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--al-subtle)',
  },

  progressControls: {
    display: 'grid',
    gap: '12px',
    marginBottom: '14px',
  },
  controlBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  controlLabel: {
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--al-chip-muted-text)',
    minWidth: '100px',
    flexShrink: 0,
  },
  controlRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  chip: {
    padding: '7px 13px',
    borderRadius: '999px',
    border: '1px solid var(--al-border)',
    background: 'var(--al-chip-bg)',
    color: 'var(--al-subtle)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  chipActive: {
    padding: '7px 13px',
    borderRadius: '999px',
    border: '1px solid rgba(96,165,250,0.30)',
    background: 'rgba(37,99,235,0.22)',
    color: 'var(--al-accent-soft)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  chipMuted: {
    padding: '7px 13px',
    borderRadius: '999px',
    border: '1px solid var(--al-border-soft)',
    background: 'var(--al-chip-muted-bg)',
    color: 'var(--al-chip-muted-text)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '12px',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    opacity: 0.85,
  },
  offTargetBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 13px',
    borderRadius: '999px',
    border: '1px solid rgba(148,163,184,0.14)',
    background: 'var(--al-surface-soft)',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--al-field-text)',
  },
  progressHint: {
    margin: '0 0 14px',
    fontSize: '12px',
    color: 'var(--al-chip-muted-text)',
    lineHeight: 1.6,
  },

  progressRow: { display: 'grid', alignItems: 'stretch', gap: '8px' },
  groupHeaderCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '36px',
    borderRadius: '10px',
    background: 'var(--al-surface-soft)',
    border: '1px solid rgba(148,163,184,0.08)',
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.10em',
    textTransform: 'uppercase',
    color: 'var(--al-accent)',
    marginBottom: '6px',
  },

  stickyAgent: {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    background: 'var(--al-table-head)',
    boxShadow: '4px 0 12px rgba(0,0,0,0.20)',
    justifyContent: 'flex-start',
  },
  stickyTeam: {
    position: 'sticky',
    left: '288px',
    zIndex: 2,
    background: 'var(--al-table-head)',
    boxShadow: '4px 0 12px rgba(0,0,0,0.20)',
  },
  stickyToday: {
    position: 'sticky',
    left: '416px',
    zIndex: 2,
    background: 'var(--al-table-head)',
    boxShadow: '4px 0 12px rgba(0,0,0,0.20)',
  },

  agentCell: { display: 'grid', alignContent: 'center' },
  metaCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },

  evalCell: {
    minHeight: '52px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    fontWeight: 800,
    fontSize: '13px',
    border: '1px solid',
  },
  evalOff: {
    background: 'var(--al-off-bg)',
    color: 'var(--al-off-text)',
    borderColor: 'var(--al-off-border)',
  },
  evalSelected: {
    boxShadow: '0 0 0 2px rgba(96,165,250,0.30) inset',
  },
  evalHeader: {
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '10px',
    background: 'transparent',
    border: '1px solid var(--al-panel-border)',
    color: 'var(--al-chip-muted-text)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '11px',
    letterSpacing: '0.06em',
    fontFamily: 'inherit',
  },
  evalHeaderActive: {
    background: 'var(--al-progress-strong-bg)',
    border: '1px solid rgba(52,211,153,0.30)',
    color: 'var(--al-progress-strong-text)',
  },

  offBtn: {
    padding: '7px 11px',
    borderRadius: '10px',
    border: '1px solid var(--al-border)',
    background: 'var(--al-chip-bg)',
    color: 'var(--al-subtle)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '11px',
    fontFamily: 'inherit',
  },
  offBtnActive: {
    background: 'rgba(124,58,237,0.18)',
    color: 'var(--al-off-text)',
    borderColor: 'rgba(196,181,253,0.24)',
  },
  offPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    background: 'var(--al-off-bg)',
    color: 'var(--al-off-text)',
    border: '1px solid rgba(196,181,253,0.22)',
    fontWeight: 800,
    fontSize: '12px',
  },
  avgPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '80px',
    padding: '7px 12px',
    borderRadius: '999px',
    fontWeight: 800,
    fontSize: '13px',
    border: '1px solid',
  },
};