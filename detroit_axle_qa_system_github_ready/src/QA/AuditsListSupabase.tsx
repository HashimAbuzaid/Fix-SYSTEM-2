import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
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
  status: 'OFF';
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
const LOCKED_NA_METRICS = new Set(['Active Listening']);
const AUTO_FAIL_METRICS = new Set(['Hold (≤3 mins)', 'Procedure']);

function countsTowardScore(metric: Metric) {
  return metric.countsTowardScore !== false;
}

function shouldShowMetricComment(result: string) {
  return (
    result === 'Borderline' || result === 'Fail' || result === 'Auto-Fail'
  );
}

function openNativeDatePicker(target: HTMLInputElement) {
  const input = target as HTMLInputElement & { showPicker?: () => void };
  input.showPicker?.();
}

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeText(value?: string | null) {
  return String(value || '').replace(/\u00a0/g, ' ').trim();
}

function normalizeHeader(value?: string | null) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizeAgentId(value?: string | null) {
  return normalizeText(value).replace(/\.0+$/, '');
}

function parsePercentLike(value?: string | null) {
  const raw = normalizeText(value).replace('%', '').replace(/,/g, '');
  if (!raw || raw === '-' || raw.toLowerCase() === '#div/0!' || raw.toLowerCase() === 'off') {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCsv(textValue: string) {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;
  const input = textValue.replace(/^\ufeff/, '');

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some((cell) => normalizeText(cell) !== '')) rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => normalizeText(cell) !== '')) rows.push(row);
  }

  return rows;
}

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
  { name: 'Friendliness', pass: 5, borderline: 3 },
  { name: 'Hold (≤3 mins)', pass: 8, borderline: 4 },
  { name: 'Call Managing', pass: 8, borderline: 4 },
  { name: 'Active Listening', pass: 5, borderline: 3 },
  { name: 'Procedure', pass: 12, borderline: 6 },
  { name: 'Notes', pass: 12, borderline: 6 },
  { name: 'Creating REF Order', pass: 12, borderline: 6 },
  { name: 'Accuracy', pass: 12, borderline: 6 },
  { name: 'A-form', pass: 6, borderline: 3 },
  { name: 'Refund Form', pass: 11, borderline: 5 },
  { name: 'Providing RL', pass: 5, borderline: 3 },
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

function getThemeVars(): Record<string, string> {
  const themeMode =
    typeof document !== 'undefined'
      ? (
          document.body.dataset.theme ||
          document.documentElement.dataset.theme ||
          window.localStorage.getItem('detroit-axle-theme-mode') ||
          window.sessionStorage.getItem('detroit-axle-theme-mode') ||
          window.localStorage.getItem('detroit-axle-theme') ||
          window.sessionStorage.getItem('detroit-axle-theme') ||
          ''
        ).toLowerCase()
      : '';

  const isLight = themeMode === 'light' || themeMode === 'white';

  return {
    '--screen-text': isLight ? '#334155' : '#e5eefb',
    '--screen-heading': isLight ? '#0f172a' : '#f8fafc',
    '--screen-muted': isLight ? '#8a98b3' : '#94a3b8',
    '--screen-subtle': isLight ? '#64748b' : '#64748b',
    '--screen-accent': isLight ? '#2563eb' : '#60a5fa',
    '--screen-panel-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,250,255,0.96) 100%)'
      : 'linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.68) 100%)',
    '--screen-card-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,255,0.97) 100%)'
      : 'linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.68) 100%)',
    '--screen-card-soft-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,248,253,0.96) 100%)'
      : 'rgba(15,23,42,0.52)',
    '--screen-field-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,255,0.98) 100%)'
      : 'rgba(15,23,42,0.7)',
    '--screen-field-text': isLight ? '#334155' : '#e5eefb',
    '--screen-border': isLight ? 'rgba(203,213,225,0.92)' : 'rgba(148,163,184,0.14)',
    '--screen-border-strong': isLight ? 'rgba(203,213,225,1)' : 'rgba(148,163,184,0.18)',
    '--screen-table-head-bg': isLight ? 'rgba(13, 27, 57, 0.98)' : 'rgba(2,6,23,0.92)',
    '--screen-pill-bg': isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.56)',
    '--screen-secondary-btn-bg': isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.78)',
    '--screen-secondary-btn-text': isLight ? '#475569' : '#e5eefb',
    '--screen-select-option-bg': isLight ? '#ffffff' : '#0f172a',
    '--screen-select-option-text': isLight ? '#0f172a' : '#e5eefb',
    '--screen-menu-bg': isLight ? 'rgba(255,255,255,0.99)' : 'rgba(15, 23, 42, 0.96)',
    '--screen-shadow': isLight ? '0 18px 40px rgba(15,23,42,0.10)' : '0 18px 40px rgba(2,6,23,0.35)',
    '--screen-score-pill-bg': isLight ? 'rgba(37,99,235,0.14)' : 'rgba(37,99,235,0.18)',
    '--screen-score-pill-border': isLight ? 'rgba(59,130,246,0.34)' : 'rgba(96,165,250,0.26)',
    '--screen-score-pill-text': isLight ? '#1d4ed8' : '#dbeafe',
    '--screen-soft-fill': isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.48)',
    '--screen-soft-fill-2': isLight ? 'rgba(241,245,249,0.98)' : 'rgba(15,23,42,0.62)',
    '--screen-note-bg': isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.52)',
    '--screen-highlight-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,250,255,0.98) 100%)'
      : 'linear-gradient(135deg, rgba(30,64,175,0.22) 0%, rgba(15,23,42,0.5) 100%)',
    '--progress-strong-bg': isLight ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.16)',
    '--progress-strong-border': isLight ? 'rgba(34,197,94,0.24)' : 'rgba(134,239,172,0.20)',
    '--progress-strong-text': isLight ? '#166534' : '#bbf7d0',
    '--progress-medium-bg': isLight ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.16)',
    '--progress-medium-border': isLight ? 'rgba(245,158,11,0.24)' : 'rgba(252,211,77,0.20)',
    '--progress-medium-text': isLight ? '#92400e' : '#fde68a',
    '--progress-weak-bg': isLight ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.16)',
    '--progress-weak-border': isLight ? 'rgba(239,68,68,0.24)' : 'rgba(252,165,165,0.20)',
    '--progress-weak-text': isLight ? '#991b1b' : '#fecaca',
    '--progress-empty-bg': isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.42)',
    '--progress-empty-text': isLight ? '#64748b' : '#94a3b8',
    '--progress-off-bg': isLight ? 'rgba(124,58,237,0.12)' : 'rgba(124,58,237,0.18)',
    '--progress-off-border': isLight ? 'rgba(124,58,237,0.24)' : 'rgba(196,181,253,0.22)',
    '--progress-off-text': isLight ? '#6d28d9' : '#ddd6fe',
  };
}

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
  const [offTodayByAgent, setOffTodayByAgent] = useState<Record<string, boolean>>({});
  const [importedProgressByAgent, setImportedProgressByAgent] = useState<Record<string, ImportedProgressRow>>({});
  const [importedFileName, setImportedFileName] = useState('');
  const [importingBoard, setImportingBoard] = useState(false);
  const themeVars = getThemeVars();
  const agentPickerRef = useRef<HTMLDivElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const isAdmin = currentProfile?.role === 'admin';
  const canManageOffToday = currentProfile?.role === 'admin' || currentProfile?.role === 'qa';
  const todayStatusDate = getTodayDateValue();
  useEffect(() => {
    void loadAuditsAndProfiles();
  }, []);
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        agentPickerRef.current &&
        !agentPickerRef.current.contains(event.target as Node)
      ) {
        setIsAgentPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);
  async function loadAuditsAndProfiles() {
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      setLoading(false);
      setErrorMessage(authError.message);
      return;
    }
    const userId = authData.user?.id;
    const [auditsResult, profilesResult, currentProfileResult, offTodayResult] =
      await Promise.all([
        supabase
          .from('audits')
          .select('*')
          .order('audit_date', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, role, agent_id, agent_name, display_name, team')
          .eq('role', 'agent')
          .order('agent_name', { ascending: true }),
        userId
          ? supabase
              .from('profiles')
              .select('id, role, agent_name')
              .eq('id', userId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('agent_daily_status')
          .select('agent_id, team, status_date, status')
          .eq('status_date', todayStatusDate)
          .eq('status', 'OFF'),
      ]);
    setLoading(false);
    if (auditsResult.error) {
      setErrorMessage(auditsResult.error.message);
      return;
    }
    if (profilesResult.error) {
      setErrorMessage(profilesResult.error.message);
      return;
    }
    if (currentProfileResult.error) {
      setErrorMessage(currentProfileResult.error.message);
      return;
    }
    if (offTodayResult.error) {
      setErrorMessage(offTodayResult.error.message);
      return;
    }
    setAudits((auditsResult.data as AuditItem[]) || []);
    setProfiles((profilesResult.data as AgentProfile[]) || []);
    setCurrentProfile((currentProfileResult.data as CurrentProfile) || null);

    const nextOffTodayMap: Record<string, boolean> = {};
    ((offTodayResult.data as AgentDailyStatus[]) || []).forEach((item) => {
      nextOffTodayMap[getAgentProgressKey(item.agent_id, item.team)] = true;
    });
    setOffTodayByAgent(nextOffTodayMap);
  }
  function getMetricsForTeam(team: EditFormState['team']) {
    if (team === 'Calls') return callsMetrics;
    if (team === 'Tickets') return ticketsMetrics;
    if (team === 'Sales') return salesMetrics;
    return [];
  }
  function getMetricOptions(metric: Metric) {
    if (metric.options?.length) return metric.options;
    if (LOCKED_NA_METRICS.has(metric.name)) return ['N/A'];
    const options = ['N/A', 'Pass', 'Borderline', 'Fail'];
    if (AUTO_FAIL_METRICS.has(metric.name)) options.push('Auto-Fail');
    return options;
  }
  function getMetricStoredValue(
    metric: Metric,
    scores: Record<string, string>
  ) {
    if (LOCKED_NA_METRICS.has(metric.name)) return 'N/A';
    return scores[metric.name] ?? metric.defaultValue ?? 'N/A';
  }
  function createDefaultScores(team: EditFormState['team']) {
    const defaults: Record<string, string> = {};
    getMetricsForTeam(team).forEach((metric) => {
      defaults[metric.name] = metric.defaultValue ?? 'N/A';
    });
    return defaults;
  }
  function getMissingRequiredMetricLabels(
    team: EditFormState['team'],
    scores: Record<string, string>
  ) {
    return getMetricsForTeam(team)
      .filter((metric) => Array.isArray(metric.options) && metric.defaultValue === '')
      .filter((metric) => !getMetricStoredValue(metric, scores))
      .map((metric) => metric.name);
  }
  function buildScoreMapFromAudit(audit: AuditItem) {
    const defaults = createDefaultScores(audit.team);
    (audit.score_details || []).forEach((item) => {
      defaults[item.metric] = item.result || 'N/A';
    });
    getMetricsForTeam(audit.team).forEach((metric) => {
      if (LOCKED_NA_METRICS.has(metric.name)) {
        defaults[metric.name] = 'N/A';
      }
    });
    return defaults;
  }

  function buildMetricCommentsFromAudit(audit: AuditItem) {
    const defaults: Record<string, string> = {};
    (audit.score_details || []).forEach((item) => {
      defaults[item.metric] = item.metric_comment || '';
    });
    return defaults;
  }

  function getAdjustedScoreData(
    team: EditFormState['team'],
    scores: Record<string, string>,
    metricComments: Record<string, string>
  ) {
    const metrics = getMetricsForTeam(team);
    const scoredMetrics = metrics.filter((item) => countsTowardScore(item));
    const activeMetrics = scoredMetrics.filter((item) => {
      const itemResult = getMetricStoredValue(item, scores);
      return itemResult !== 'N/A' && itemResult !== '';
    });
    const activeTotalWeight = activeMetrics.reduce(
      (sum, item) => sum + item.pass,
      0
    );
    const fullTotalWeight = scoredMetrics.reduce((sum, item) => sum + item.pass, 0);
    const scoreDetails = metrics.map((metric) => {
      const result = getMetricStoredValue(metric, scores);
      const scored = countsTowardScore(metric);
      const adjustedWeight =
        !scored || result === 'N/A' || result === '' || activeTotalWeight === 0
          ? 0
          : (metric.pass / activeTotalWeight) * fullTotalWeight;
      let earned = 0;
      if (scored && result === 'Pass') {
        earned = adjustedWeight;
      } else if (scored && result === 'Borderline') {
        earned =
          metric.pass > 0
            ? adjustedWeight * (metric.borderline / metric.pass)
            : 0;
      }
      return {
        metric: metric.name,
        result,
        pass: metric.pass,
        borderline: metric.borderline,
        adjustedWeight,
        earned,
        counts_toward_score: scored,
        metric_comment:
          scored && shouldShowMetricComment(result)
            ? (metricComments[metric.name] || '').trim() || null
            : null,
      };
    });
    const hasAutoFail = scoreDetails.some(
      (item) =>
        item.counts_toward_score !== false &&
        AUTO_FAIL_METRICS.has(item.metric) && item.result === 'Auto-Fail'
    );
    const qualityScore = hasAutoFail
      ? '0.00'
      : scoreDetails
          .filter((item) => item.counts_toward_score !== false)
          .reduce((sum, item) => sum + item.earned, 0)
          .toFixed(2);
    return { scoreDetails, qualityScore, hasAutoFail };
  }
  function getAgentLabel(profile: AgentProfile) {
    return profile.display_name
      ? `${profile.agent_name} - ${profile.display_name}`
      : `${profile.agent_name} - ${profile.agent_id}`;
  }
  function getDisplayName(audit: AuditItem) {
    const matchedProfile = profiles.find(
      (profile) =>
        profile.agent_id === audit.agent_id &&
        profile.agent_name === audit.agent_name &&
        profile.team === audit.team
    );
    return matchedProfile?.display_name || null;
  }
  function getCreatedByLabel(audit: AuditItem) {
    return audit.created_by_name || audit.created_by_email || '-';
  }
  function getAgentProgressKey(agentId?: string | null, team?: string | null) {
    return `${agentId || ''}||${team || ''}`;
  }
  function matchesProfileSearch(profile: AgentProfile, search: string) {
    if (!search) return true;
    const label = getAgentLabel(profile).toLowerCase();
    return (
      profile.agent_name.toLowerCase().includes(search) ||
      (profile.agent_id || '').toLowerCase().includes(search) ||
      (profile.display_name || '').toLowerCase().includes(search) ||
      label.includes(search)
    );
  }
  async function toggleAgentOffToday(agentId?: string | null, team?: string | null) {
    setErrorMessage('');
    setSuccessMessage('');

    if (!canManageOffToday) {
      setErrorMessage('Only admin or QA can update OFF today status.');
      return;
    }

    if (!agentId || !team) {
      setErrorMessage('Agent ID or team is missing for OFF today.');
      return;
    }

    const key = getAgentProgressKey(agentId, team);
    const nextValue = !offTodayByAgent[key];

    if (nextValue) {
      const { error } = await supabase
        .from('agent_daily_status')
        .upsert(
          {
            agent_id: agentId,
            team,
            status_date: todayStatusDate,
            status: 'OFF',
            created_by_user_id: currentProfile?.id || null,
            created_by_name: currentProfile?.agent_name || null,
          },
          { onConflict: 'agent_id,team,status_date' }
        );

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setOffTodayByAgent((prev) => ({ ...prev, [key]: true }));
      setSuccessMessage('Agent marked as OFF today.');
      return;
    }

    const { error } = await supabase
      .from('agent_daily_status')
      .delete()
      .eq('agent_id', agentId)
      .eq('team', team)
      .eq('status_date', todayStatusDate)
      .eq('status', 'OFF');

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setOffTodayByAgent((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSuccessMessage('OFF today cleared for agent.');
  }
  async function handleProgressImport(file?: File | null) {
    if (!file) return;

    setImportingBoard(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setErrorMessage('Please upload a CSV file for the progress board import.');
        setImportingBoard(false);
        return;
      }

      const csvText = await file.text();
      const rows = parseCsv(csvText);

      if (rows.length === 0) {
        setErrorMessage('The uploaded CSV is empty.');
        setImportingBoard(false);
        return;
      }

      const headers = rows[0].map((item) => normalizeHeader(item));
      const findIndex = (...names: string[]) => headers.findIndex((header) => names.includes(header));

      const agentNameIndex = findIndex('agentname', 'agent');
      const displayNameIndex = findIndex('displayname', 'display');
      const agentIdIndex = findIndex('agentid', 'agent');
      const teamIndex = findIndex('team');
      const todayIndex = findIndex('today', 'offtoday', 'status');

      const evalIndices = headers
        .map((header, index) => ({ header, index }))
        .filter((item) => /^eval\d+$/.test(item.header) || /^evaluation\d+$/.test(item.header) || /^qc\d+$/.test(item.header))
        .sort((a, b) => a.index - b.index)
        .slice(0, 12);

      const latestIndex = findIndex('latest', 'latestscore');
      const averageIndex = findIndex('average', 'avg', 'averagescore');

      if (agentNameIndex === -1 && agentIdIndex === -1) {
        setErrorMessage('The CSV must include at least Agent Name or Agent ID columns.');
        setImportingBoard(false);
        return;
      }

      const nextImported: Record<string, ImportedProgressRow> = {};

      rows.slice(1).forEach((cells) => {
        const agentName = normalizeText(cells[agentNameIndex] || '');
        const displayName = displayNameIndex >= 0 ? normalizeText(cells[displayNameIndex] || '') : '';
        const agentId = normalizeAgentId(cells[agentIdIndex] || '');
        const rawTeam = normalizeText(cells[teamIndex] || '');
        const team = (rawTeam === 'Calls' || rawTeam === 'Tickets' || rawTeam === 'Sales'
          ? rawTeam
          : teamFilter === 'Calls' || teamFilter === 'Tickets' || teamFilter === 'Sales'
          ? teamFilter
          : '') as '' | 'Calls' | 'Tickets' | 'Sales';

        if (!team) return;
        if (!agentName && !agentId) return;

        const key = getAgentProgressKey(agentId || agentName, team);
        const evaluations: ImportedEvaluation[] = evalIndices.map(({ index }) => {
          const raw = cells[index] || '';
          return {
            score: parsePercentLike(raw),
            label: normalizeText(raw),
          };
        });

        const todayValue = todayIndex >= 0 ? normalizeText(cells[todayIndex] || '').toLowerCase() : '';
        const latestScore = latestIndex >= 0 ? parsePercentLike(cells[latestIndex] || '') : null;
        const averageScore = averageIndex >= 0 ? parsePercentLike(cells[averageIndex] || '') : null;

        nextImported[key] = {
          agent_id: agentId,
          agent_name: agentName || agentId,
          display_name: displayName || null,
          team,
          evaluations,
          offToday: todayValue === 'off',
          latestScore,
          averageScore,
        };
      });

      setImportedProgressByAgent(nextImported);
      setImportedFileName(file.name);
      setSuccessMessage(`Imported ${Object.keys(nextImported).length} progress row(s) from ${file.name}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not import evaluation table.');
    } finally {
      setImportingBoard(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  function clearImportedProgress() {
    setImportedProgressByAgent({});
    setImportedFileName('');
    setSuccessMessage('Imported progress table cleared.');
  }

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
    if (audit.team === 'Tickets') {
      return `Ticket ID: ${audit.ticket_id || '-'}`;
    }
    return `Order #: ${audit.order_number || '-'} | Phone: ${
      audit.phone_number || '-'
    }`;
  }
  function getCommentsPreview(value?: string | null) {
    const text = (value || '').trim();
    if (!text) return '-';
    if (text.length <= 120) return text;
    return `${text.slice(0, 117)}...`;
  }
  function isNoScoreDetail(detail: ScoreDetail) {
    return detail.counts_toward_score === false;
  }
  const editTeamAgents = useMemo(() => {
    return profiles.filter(
      (profile) =>
        profile.role === 'agent' &&
        profile.team === editForm.team &&
        profile.agent_id &&
        profile.agent_name
    );
  }, [profiles, editForm.team]);
  const visibleAgents = useMemo(() => {
    const search = agentSearch.trim().toLowerCase();
    if (!search) return editTeamAgents;
    return editTeamAgents.filter((profile) => {
      const label = getAgentLabel(profile);
      return (
        profile.agent_name.toLowerCase().includes(search) ||
        (profile.agent_id || '').toLowerCase().includes(search) ||
        (profile.display_name || '').toLowerCase().includes(search) ||
        label.toLowerCase().includes(search)
      );
    });
  }, [editTeamAgents, agentSearch]);
  const selectedAgent =
    editTeamAgents.find((profile) => profile.id === selectedAgentProfileId) ||
    null;
  const filteredAudits = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return audits.filter((audit) => {
      const displayName = (getDisplayName(audit) || '').toLowerCase();
      const matchesSearch =
        !search ||
        audit.agent_name.toLowerCase().includes(search) ||
        audit.agent_id.toLowerCase().includes(search) ||
        displayName.includes(search);
      const matchesTeam = teamFilter ? audit.team === teamFilter : true;
      const matchesCaseType = caseTypeFilter
        ? audit.case_type === caseTypeFilter
        : true;
      const matchesDateFrom = dateFrom ? audit.audit_date >= dateFrom : true;
      const matchesDateTo = dateTo ? audit.audit_date <= dateTo : true;
      return (
        matchesSearch &&
        matchesTeam &&
        matchesCaseType &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [
    audits,
    searchText,
    teamFilter,
    caseTypeFilter,
    dateFrom,
    dateTo,
    profiles,
  ]);
  const uniqueCaseTypes = Array.from(
    new Set(audits.map((audit) => audit.case_type))
  );
  const sharedFilteredCount = filteredAudits.filter(
    (item) => item.shared_with_agent
  ).length;
  const hiddenFilteredCount = filteredAudits.length - sharedFilteredCount;
  const sharedAllCount = audits.filter((item) => item.shared_with_agent).length;
  const hiddenAllCount = audits.length - sharedAllCount;
  const evaluationProgressData = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    const scopedProfiles = profiles.filter((profile) => {
      const matchesTeam = teamFilter ? profile.team === teamFilter : true;
      return matchesTeam && matchesProfileSearch(profile, normalizedSearch);
    });

    const groupedRows = new Map<
      string,
      {
        agent_id: string;
        agent_name: string;
        display_name: string | null;
        team: 'Calls' | 'Tickets' | 'Sales';
        evaluations: Array<{ id: string; audit_date: string; quality_score: number; case_type: string }>;
      }
    >();

    filteredAudits.forEach((audit) => {
      const key = getAgentProgressKey(audit.agent_id, audit.team);
      const existing = groupedRows.get(key) || {
        agent_id: audit.agent_id,
        agent_name: audit.agent_name,
        display_name: getDisplayName(audit),
        team: audit.team,
        evaluations: [],
      };

      existing.evaluations.push({
        id: audit.id,
        audit_date: audit.audit_date,
        quality_score: Number(audit.quality_score),
        case_type: audit.case_type,
      });

      if (!existing.display_name) {
        existing.display_name = getDisplayName(audit);
      }

      groupedRows.set(key, existing);
    });

    scopedProfiles.forEach((profile) => {
      if (!profile.agent_id || !profile.team) return;
      const key = getAgentProgressKey(profile.agent_id, profile.team);
      if (!groupedRows.has(key)) {
        groupedRows.set(key, {
          agent_id: profile.agent_id,
          agent_name: profile.agent_name,
          display_name: profile.display_name,
          team: profile.team,
          evaluations: [],
        });
      }
    });

    Object.entries(importedProgressByAgent).forEach(([key, importedRow]) => {
      if (teamFilter && importedRow.team !== teamFilter) return;
      if (normalizedSearch) {
        const haystack = [
          importedRow.agent_name,
          importedRow.display_name || '',
          importedRow.agent_id,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(normalizedSearch)) return;
      }

      const existing = groupedRows.get(key) || {
        agent_id: importedRow.agent_id,
        agent_name: importedRow.agent_name,
        display_name: importedRow.display_name,
        team: importedRow.team,
        evaluations: [],
      };

      groupedRows.set(key, existing);
    });

    const rows = Array.from(groupedRows.values())
      .map((row) => {
        const key = getAgentProgressKey(row.agent_id, row.team);
        const imported = importedProgressByAgent[key] || null;

        const dbEvaluations = [...row.evaluations]
          .sort((a, b) => a.audit_date.localeCompare(b.audit_date))
          .slice(-12)
          .map((item) => ({
            score: Number.isFinite(item.quality_score) ? item.quality_score : null,
            label: item.audit_date ? `${formatDateOnly(item.audit_date)} • ${item.case_type}` : '',
          }));

        const evaluations = imported?.evaluations?.length ? imported.evaluations.slice(0, 12) : dbEvaluations;
        const averageScore =
          imported?.averageScore ?? (evaluations.length > 0
            ? evaluations.reduce((sum, item) => sum + (item.score ?? 0), 0) /
              evaluations.filter((item) => item.score !== null).length
            : null);

        const latestScore =
          imported?.latestScore ??
          (evaluations.length > 0
            ? evaluations.filter((item) => item.score !== null).slice(-1)[0]?.score ?? null
            : null);

        return {
          agent_id: row.agent_id,
          agent_name: imported?.agent_name || row.agent_name,
          display_name: imported?.display_name ?? row.display_name,
          team: row.team,
          evaluations,
          averageScore:
            averageScore !== null && Number.isFinite(averageScore) ? averageScore : null,
          latestScore: latestScore !== null && Number.isFinite(latestScore) ? latestScore : null,
          offToday:
            imported?.offToday === true ||
            !!offTodayByAgent[getAgentProgressKey(row.agent_id, row.team)],
        };
      })
      .sort((a, b) => a.agent_name.localeCompare(b.agent_name));

    const maxEvaluations = Math.max(
      1,
      ...rows.map((row) => Math.min(12, row.evaluations.length || 0))
    );

    const evaluationColumns = Array.from(
      { length: Math.min(maxEvaluations, 12) },
      (_, index) => `Eval ${index + 1}`
    );

    return { rows, evaluationColumns };
  }, [filteredAudits, profiles, searchText, teamFilter, offTodayByAgent, importedProgressByAgent]);

  function getProgressCellTone(score: number | null) {
    if (score === null || Number.isNaN(score)) return progressEmptyCellStyle;
    if (score >= 90) return progressStrongCellStyle;
    if (score >= 75) return progressMediumCellStyle;
    return progressWeakCellStyle;
  }
  function startEditAudit(audit: AuditItem) {
    if (!isAdmin) {
      setErrorMessage('Only admin can edit audits.');
      return;
    }
    const matchedProfile = profiles.find(
      (profile) =>
        profile.agent_id === audit.agent_id &&
        profile.agent_name === audit.agent_name &&
        profile.team === audit.team
    );
    setErrorMessage('');
    setSuccessMessage('');
    setEditingAuditId(audit.id);
    setExpandedId(audit.id);
    setSelectedAgentProfileId(matchedProfile?.id || '');
    setAgentSearch(matchedProfile ? getAgentLabel(matchedProfile) : '');
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
    setEditScores(buildScoreMapFromAudit(audit));
    setEditMetricComments(buildMetricCommentsFromAudit(audit));
  }
  function cancelEdit() {
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
  }
  function handleTeamChange(nextTeam: EditFormState['team']) {
    setEditForm((prev) => ({
      ...prev,
      team: nextTeam,
      orderNumber: '',
      phoneNumber: '',
      ticketId: '',
    }));
    setSelectedAgentProfileId('');
    setAgentSearch('');
    setIsAgentPickerOpen(false);
    setEditScores(createDefaultScores(nextTeam));
    setEditMetricComments({});
  }
  function handleSelectAgent(profile: AgentProfile) {
    setSelectedAgentProfileId(profile.id);
    setAgentSearch(getAgentLabel(profile));
    setIsAgentPickerOpen(false);
  }
  function handleScoreChange(metricName: string, value: string) {
    if (LOCKED_NA_METRICS.has(metricName)) {
      setEditScores((prev) => ({ ...prev, [metricName]: 'N/A' }));
      setEditMetricComments((prev) => ({ ...prev, [metricName]: '' }));
      return;
    }

    setEditScores((prev) => ({ ...prev, [metricName]: value }));

    if (!shouldShowMetricComment(value)) {
      setEditMetricComments((prev) => {
        const next = { ...prev };
        delete next[metricName];
        return next;
      });
    }
  }

  function handleMetricCommentChange(metricName: string, value: string) {
    setEditMetricComments((prev) => ({ ...prev, [metricName]: value }));
  }
  async function handleUpdate(auditId: string) {
    setErrorMessage('');
    setSuccessMessage('');
    if (!isAdmin) {
      setErrorMessage('Only admin can save audit changes.');
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
      setErrorMessage('Please fill Order Number for Calls and Sales.');
      return;
    }
    if (editForm.team === 'Tickets' && !editForm.ticketId) {
      setErrorMessage('Please fill Ticket ID for Tickets.');
      return;
    }
    const missingRequiredMetricLabels = getMissingRequiredMetricLabels(
      editForm.team,
      editScores
    );
    if (missingRequiredMetricLabels.length > 0) {
      setErrorMessage(
        `Please answer: ${missingRequiredMetricLabels.join(', ')}.`
      );
      return;
    }
    if (!selectedAgent.agent_id) {
      setErrorMessage('Selected agent does not have an Agent ID.');
      return;
    }
    const missingMetricCommentLabels = getMetricsForTeam(editForm.team)
      .filter((metric) => countsTowardScore(metric))
      .filter((metric) =>
        shouldShowMetricComment(getMetricStoredValue(metric, editScores))
      )
      .filter((metric) => !(editMetricComments[metric.name] || '').trim())
      .map((metric) => metric.name);
    if (missingMetricCommentLabels.length > 0) {
      setErrorMessage(
        `Please add a short QA note for: ${missingMetricCommentLabels.join(', ')}.`
      );
      return;
    }
    const adjustedData = getAdjustedScoreData(
      editForm.team,
      editScores,
      editMetricComments
    );
    setSaving(true);
    const updatePayload = {
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
      quality_score: Number(adjustedData.qualityScore),
      comments: editForm.comments,
      score_details: adjustedData.scoreDetails,
    };
    const { error } = await supabase
      .from('audits')
      .update(updatePayload)
      .eq('id', auditId);
    setSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setAudits((prev) =>
      prev.map((item) =>
        item.id === auditId ? { ...item, ...updatePayload } : item
      )
    );
    setSuccessMessage('Audit updated successfully.');
    cancelEdit();
  }
  async function handleToggleShare(audit: AuditItem) {
    setErrorMessage('');
    setSuccessMessage('');
    if (!isAdmin) {
      setErrorMessage('Only admin can share or hide audits.');
      return;
    }
    const nextSharedValue = !audit.shared_with_agent;
    const confirmed = window.confirm(
      nextSharedValue
        ? 'Share this audit with the agent?'
        : 'Hide this audit from the agent?'
    );
    if (!confirmed) return;
    setReleaseLoadingId(audit.id);
    const nextSharedAt = nextSharedValue ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('audits')
      .update({ shared_with_agent: nextSharedValue, shared_at: nextSharedAt })
      .eq('id', audit.id)
      .select('id, shared_with_agent, shared_at')
      .maybeSingle();
    setReleaseLoadingId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    if (!data) {
      setErrorMessage('Share update did not persist in Supabase.');
      return;
    }
    setAudits((prev) =>
      prev.map((item) =>
        item.id === audit.id
          ? {
              ...item,
              shared_with_agent: data.shared_with_agent,
              shared_at: data.shared_at,
            }
          : item
      )
    );
    setSuccessMessage(
      data.shared_with_agent
        ? 'Audit shared with agent successfully.'
        : 'Audit hidden from agent successfully.'
    );
  }
  async function handleBulkShare(shareValue: boolean) {
    setErrorMessage('');
    setSuccessMessage('');
    if (!isAdmin) {
      setErrorMessage('Only admin can perform bulk release actions.');
      return;
    }
    if (filteredAudits.length === 0) {
      setErrorMessage('No audits match the current filters.');
      return;
    }
    const confirmed = window.confirm(
      shareValue
        ? `Share ${filteredAudits.length} filtered audits with agents?`
        : `Hide ${filteredAudits.length} filtered audits from agents?`
    );
    if (!confirmed) return;
    setBulkSaving(true);
    const ids = filteredAudits.map((item) => item.id);
    const nextSharedAt = shareValue ? new Date().toISOString() : null;
    const { data, error } = await supabase
      .from('audits')
      .update({ shared_with_agent: shareValue, shared_at: nextSharedAt })
      .in('id', ids)
      .select('id, shared_with_agent, shared_at');
    setBulkSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setErrorMessage('Bulk share or hide did not persist in Supabase.');
      return;
    }
    const updatedMap = new Map(
      data.map((row) => [
        row.id,
        { shared_with_agent: row.shared_with_agent, shared_at: row.shared_at },
      ])
    );
    setAudits((prev) =>
      prev.map((item) => {
        const updated = updatedMap.get(item.id);
        return updated ? { ...item, ...updated } : item;
      })
    );
    setSuccessMessage(
      shareValue
        ? `${data.length} filtered audit(s) shared successfully.`
        : `${data.length} filtered audit(s) hidden successfully.`
    );
  }
  async function handleHideAllAudits() {
    setErrorMessage('');
    setSuccessMessage('');
    if (!isAdmin) {
      setErrorMessage('Only admin can hide all audits.');
      return;
    }
    if (audits.length === 0) {
      setErrorMessage('There are no audits to hide.');
      return;
    }
    const confirmed = window.confirm(
      `Hide all ${audits.length} audits from agents? This ignores the current filters.`
    );
    if (!confirmed) return;
    setBulkSaving(true);
    const ids = audits.map((item) => item.id);
    const { data, error } = await supabase
      .from('audits')
      .update({ shared_with_agent: false, shared_at: null })
      .in('id', ids)
      .select('id, shared_with_agent, shared_at');
    setBulkSaving(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    if (!data || data.length === 0) {
      setErrorMessage('Hide all did not persist in Supabase.');
      return;
    }
    const updatedMap = new Map(
      data.map((row) => [
        row.id,
        { shared_with_agent: row.shared_with_agent, shared_at: row.shared_at },
      ])
    );
    setAudits((prev) =>
      prev.map((item) => {
        const updated = updatedMap.get(item.id);
        return updated ? { ...item, ...updated } : item;
      })
    );
    setSuccessMessage(`${data.length} audit(s) hidden successfully.`);
  }
  async function handleDelete(auditId: string) {
    setErrorMessage('');
    setSuccessMessage('');
    if (!isAdmin) {
      setErrorMessage('Only admin can delete audits.');
      return;
    }
    const confirmed = window.confirm('Delete this audit?');
    if (!confirmed) return;
    const { error } = await supabase.from('audits').delete().eq('id', auditId);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setAudits((prev) => prev.filter((item) => item.id !== auditId));
    if (expandedId === auditId) setExpandedId(null);
    if (editingAuditId === auditId) cancelEdit();
    setSuccessMessage('Audit deleted successfully.');
  }
  function getResultBadgeColor(result: string) {
    if (result === 'Pass') return '#166534';
    if (result === 'Borderline') return '#92400e';
    if (result === 'Fail' || result === 'Auto-Fail') return '#991b1b';
    if (result === 'N/A') return '#374151';
    return '#1f2937';
  }
  if (loading) {
    return <div style={{ color: 'var(--screen-text)' }}>Loading audits...</div>;
  }
  return (
    <div
      data-no-theme-invert="true"
      style={{ color: 'var(--screen-text)', ...(themeVars as CSSProperties) }}
    >
      {' '}
      <div style={pageHeaderStyle}>
        {' '}
        <div>
          {' '}
          <div style={sectionEyebrow}>Audit Management</div>{' '}
          <h2 style={{ marginBottom: '8px', color: 'var(--screen-heading)' }}>Audits List</h2>{' '}
          <p style={{ margin: 0, color: 'var(--screen-muted)' }}>
            {' '}
            QA can view audits and score details. Only admin can edit, delete,
            or release audits.{' '}
          </p>{' '}
        </div>{' '}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowEvaluationProgress((prev) => !prev)}
            style={secondaryButton}
          >
            {showEvaluationProgress ? 'Hide Evaluation Progress' : 'Show Evaluation Progress'}
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            disabled={importingBoard}
            style={secondaryButton}
          >
            {importingBoard ? 'Importing...' : 'Import Progress CSV'}
          </button>
          {importedFileName ? (
            <button type="button" onClick={clearImportedProgress} style={secondaryButton}>
              Clear Imported Board
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void loadAuditsAndProfiles()}
            style={secondaryButton}
          >
            Refresh
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => void handleProgressImport(e.target.files?.[0] || null)}
            style={{ display: 'none' }}
          />
        </div>
      </div>{' '}
      {errorMessage ? <div style={errorBanner}>{errorMessage}</div> : null}{' '}
      {successMessage ? (
        <div style={successBanner}>{successMessage}</div>
      ) : null}{' '}
      <div style={panelStyle}>
        {' '}
        <div style={filterGridStyle}>
          {' '}
          <div style={searchFilterFieldStyle}>
            {' '}
            <label style={labelStyle}>
              {' '}
              Search by Agent Name, Display Name, or Agent ID{' '}
            </label>{' '}
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={fieldStyle}
            />{' '}
          </div>{' '}
          <div style={standardFilterFieldStyle}>
            {' '}
            <label style={labelStyle}>Filter by Team</label>{' '}
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={selectFieldStyle}
            >
              {' '}
              <option value="">All Teams</option>{' '}
              <option value="Calls">Calls</option>{' '}
              <option value="Tickets">Tickets</option>{' '}
              <option value="Sales">Sales</option>{' '}
            </select>{' '}
          </div>{' '}
          <div style={standardFilterFieldStyle}>
            {' '}
            <label style={labelStyle}>Filter by Case Type</label>{' '}
            <select
              value={caseTypeFilter}
              onChange={(e) => setCaseTypeFilter(e.target.value)}
              style={selectFieldStyle}
            >
              {' '}
              <option value="">All Case Types</option>{' '}
              {uniqueCaseTypes.map((caseType) => (
                <option key={caseType} value={caseType}>
                  {' '}
                  {caseType}{' '}
                </option>
              ))}{' '}
            </select>{' '}
          </div>{' '}
          <div style={dateFilterFieldStyle}>
            {' '}
            <label style={labelStyle}>Date From</label>{' '}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              onClick={(e) => openNativeDatePicker(e.currentTarget)}
              onFocus={(e) => openNativeDatePicker(e.currentTarget)}
              style={fieldStyle}
            />{' '}
          </div>{' '}
          <div style={dateFilterFieldStyle}>
            {' '}
            <label style={labelStyle}>Date To</label>{' '}
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              onClick={(e) => openNativeDatePicker(e.currentTarget)}
              onFocus={(e) => openNativeDatePicker(e.currentTarget)}
              style={fieldStyle}
            />{' '}
          </div>{' '}
        </div>{' '}
      </div>{' '}
      {isAdmin ? (
        <div style={{ ...panelStyle, marginTop: '18px' }}>
          {' '}
          <h3 style={{ marginTop: 0, color: 'var(--screen-heading)' }}>
            {' '}
            Weekly Release Controls{' '}
          </h3>{' '}
          <p style={{ color: 'var(--screen-muted)' }}>
            {' '}
            Use the filters above to choose the week, team, or case type, then
            share or hide filtered audits, or hide all audits at once.{' '}
          </p>{' '}
          <p>
            {' '}
            <strong>Filtered Audits:</strong> {filteredAudits.length}{' '}
          </p>{' '}
          <p>
            {' '}
            <strong>Already Shared (Filtered):</strong> {sharedFilteredCount}{' '}
          </p>{' '}
          <p>
            {' '}
            <strong>Still Hidden (Filtered):</strong> {hiddenFilteredCount}{' '}
          </p>{' '}
          <p>
            {' '}
            <strong>Total Audits:</strong> {audits.length}{' '}
          </p>{' '}
          <p>
            {' '}
            <strong>Already Shared (All):</strong> {sharedAllCount}{' '}
          </p>{' '}
          <p>
            {' '}
            <strong>Already Hidden (All):</strong> {hiddenAllCount}{' '}
          </p>{' '}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {' '}
            <button
              onClick={() => void handleBulkShare(true)}
              disabled={bulkSaving || filteredAudits.length === 0}
              style={primaryButton}
            >
              {' '}
              {bulkSaving ? 'Working...' : 'Share Filtered Audits'}{' '}
            </button>{' '}
            <button
              onClick={() => void handleBulkShare(false)}
              disabled={bulkSaving || filteredAudits.length === 0}
              style={dangerButton}
            >
              {' '}
              {bulkSaving ? 'Working...' : 'Hide Filtered Audits'}{' '}
            </button>{' '}
            <button
              onClick={() => void handleHideAllAudits()}
              disabled={bulkSaving || audits.length === 0}
              style={dangerButton}
            >
              {' '}
              {bulkSaving ? 'Working...' : 'Hide All Audits'}{' '}
            </button>{' '}
          </div>{' '}
        </div>
      ) : (
        <div style={infoBanner}>
          {' '}
          QA view is read-only on this page. Only admin can edit, delete, or
          release audits.{' '}
        </div>
      )}{' '}
      {showEvaluationProgress ? (
        <div style={progressPanelStyle}>
          <div style={progressPanelHeaderStyle}>
            <div>
              <div style={sectionEyebrow}>Evaluation Progress</div>
              <h3 style={{ margin: 0, color: 'var(--screen-heading)' }}>
                Team Progress Board
              </h3>
              <p style={{ margin: '8px 0 0 0', color: 'var(--screen-muted)' }}>
                This board uses the currently filtered audits. You can also import a CSV evaluation table to overlay Eval columns, Average, and OFF today.
              </p>
            </div>
            <div style={progressMetaRowStyle}>
              <span style={progressMetaPillStyle}>
                Today: {todayStatusDate}
              </span>
              <span style={progressMetaPillStyle}>
                Rows: {evaluationProgressData.rows.length}
              </span>
              <span style={progressMetaPillStyle}>
                Columns: {evaluationProgressData.evaluationColumns.length}
              </span>
              {importedFileName ? (
                <span style={progressMetaPillStyle}>Imported: {importedFileName}</span>
              ) : null}
            </div>
          </div>

          {evaluationProgressData.rows.length === 0 ? (
            <div style={progressEmptyStateStyle}>
              No evaluation progress data matches the current filters yet.
            </div>
          ) : (
            <div style={progressTableWrapStyle}>
              <div style={progressTableStyle}>
                <div style={{ ...progressRowStyle, ...progressHeaderRowStyle }}>
                  <div style={progressAgentCellStyle}>Agent</div>
                  <div style={progressMetaCellStyle}>Team</div>
                  <div style={progressMetaCellStyle}>Today</div>
                  {evaluationProgressData.evaluationColumns.map((column) => (
                    <div key={column} style={progressEvalCellStyle}>
                      {column}
                    </div>
                  ))}
                  <div style={progressMetaCellStyle}>Latest</div>
                  <div style={progressMetaCellStyle}>Average</div>
                </div>

                {evaluationProgressData.rows.map((row) => {
                  const paddedEvaluations = [...row.evaluations];
                  while (paddedEvaluations.length < evaluationProgressData.evaluationColumns.length) {
                    paddedEvaluations.push({
                      score: null,
                      label: '',
                    });
                  }

                  return (
                    <div
                      key={getAgentProgressKey(row.agent_id, row.team)}
                      style={progressEntryStyle}
                    >
                      <div style={progressRowStyle}>
                        <div style={progressAgentCellStyle}>
                          <div style={primaryCellTextStyle}>{row.agent_name}</div>
                          <div style={secondaryCellTextStyle}>
                            {row.display_name || '-'} • {row.agent_id}
                          </div>
                        </div>

                        <div style={progressMetaCellStyle}>
                          <span style={teamMiniPillStyle}>{row.team}</span>
                        </div>

                        <div style={progressMetaCellStyle}>
                          <button
                            type="button"
                            onClick={() => void toggleAgentOffToday(row.agent_id, row.team)}
                            disabled={!canManageOffToday}
                            title={
                              canManageOffToday
                                ? row.offToday
                                  ? 'Clear OFF today'
                                  : 'Mark agent as OFF today'
                                : 'Only admin or QA can update OFF today'
                            }
                            style={
                              row.offToday
                                ? {
                                    ...progressOffButtonActiveStyle,
                                    opacity: canManageOffToday ? 1 : 0.7,
                                    cursor: canManageOffToday ? 'pointer' : 'not-allowed',
                                  }
                                : {
                                    ...progressOffButtonStyle,
                                    opacity: canManageOffToday ? 1 : 0.7,
                                    cursor: canManageOffToday ? 'pointer' : 'not-allowed',
                                  }
                            }
                          >
                            {row.offToday ? 'OFF' : 'Mark OFF'}
                          </button>
                        </div>

                        {paddedEvaluations.map((evaluation, index) => {
                          const hasValue = evaluation.score !== null && Number.isFinite(evaluation.score);
                          const cellTone = hasValue
                            ? getProgressCellTone(evaluation.score)
                            : progressEmptyCellStyle;

                          return (
                            <div
                              key={`${row.agent_id}-${row.team}-${index}`}
                              style={{
                                ...progressEvalCellStyle,
                                ...cellTone,
                              }}
                              title={hasValue ? evaluation.label || `${evaluation.score}%` : 'No evaluation'}
                            >
                              {hasValue ? `${Number(evaluation.score).toFixed(0)}%` : '-'}
                            </div>
                          );
                        })}

                        <div style={progressMetaCellStyle}>
                          {row.offToday ? (
                            <span style={progressOffPillStyle}>OFF</span>
                          ) : row.latestScore !== null ? (
                            <div>
                              <div style={primaryCellTextStyle}>{Number(row.latestScore).toFixed(0)}%</div>
                              <div style={secondaryCellTextStyle}>{importedFileName ? 'Imported board' : 'Latest score'}</div>
                            </div>
                          ) : (
                            <span style={secondaryCellTextStyle}>-</span>
                          )}
                        </div>

                        <div style={progressMetaCellStyle}>
                          <span style={{ ...progressAveragePillStyle, ...getProgressCellTone(row.averageScore) }}>
                            {row.averageScore === null ? '-' : `${row.averageScore.toFixed(1)}%`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
      {filteredAudits.length === 0 ? (
        <p style={{ color: 'var(--screen-muted)', marginTop: '18px' }}>No audits found.</p>
      ) : (
        <div style={auditTableWrapStyle}>
          {' '}
          <div style={auditTableStyle}>
            {' '}
            <div style={{ ...auditRowStyle, ...auditHeaderRowStyle }}>
              {' '}
              <div style={auditCellAgentStyle}>Agent</div>{' '}
              <div style={auditCellDateStyle}>Audit Date</div>{' '}
              <div style={auditCellCaseStyle}>Case Type</div>{' '}
              <div style={auditCellReferenceStyle}>Reference</div>{' '}
              <div style={auditCellScoreStyle}>Quality</div>{' '}
              <div style={auditCellReleaseStyle}>Release</div>{' '}
              <div style={auditCellCreatorStyle}>Created By</div>{' '}
              <div style={auditCellCommentsStyle}>Comments</div>{' '}
              <div style={auditCellActionsStyle}>Actions</div>{' '}
            </div>{' '}
            {filteredAudits.map((audit) => {
              const isEditing = editingAuditId === audit.id;
              const isExpanded = expandedId === audit.id || isEditing;
              const adjustedEditData = isEditing
                ? getAdjustedScoreData(
                    editForm.team,
                    editScores,
                    editMetricComments
                  )
                : null;
              return (
                <div key={audit.id} style={auditEntryStyle}>
                  {' '}
                  <div style={auditRowStyle}>
                    {' '}
                    <div style={auditCellAgentStyle}>
                      {' '}
                      <div style={primaryCellTextStyle}>
                        {audit.agent_name}
                      </div>{' '}
                      <div style={secondaryCellTextStyle}>
                        {' '}
                        {getDisplayName(audit) || '-'} • {audit.agent_id} •{' '}
                        {audit.team}{' '}
                      </div>{' '}
                    </div>{' '}
                    <div style={auditCellDateStyle}>
                      {' '}
                      <div style={primaryCellTextStyle}>
                        {' '}
                        {formatDateOnly(audit.audit_date)}{' '}
                      </div>{' '}
                    </div>{' '}
                    <div style={auditCellCaseStyle}>
                      {' '}
                      <div style={primaryCellTextStyle}>
                        {audit.case_type}
                      </div>{' '}
                    </div>{' '}
                    <div style={auditCellReferenceStyle}>
                      {' '}
                      <div style={primaryCellTextStyle}>
                        {' '}
                        {getAuditReference(audit)}{' '}
                      </div>{' '}
                    </div>{' '}
                    <div style={auditCellScoreStyle}>
                      {' '}
                      <span style={scorePillStyle}>
                        {' '}
                        {Number(audit.quality_score).toFixed(2)}%{' '}
                      </span>{' '}
                    </div>{' '}
                    <div style={auditCellReleaseStyle}>
                      {' '}
                      <span
                        style={{
                          ...pillStyle,
                          backgroundColor: audit.shared_with_agent
                            ? '#166534'
                            : '#475569',
                        }}
                      >
                        {' '}
                        {audit.shared_with_agent ? 'Shared' : 'Hidden'}{' '}
                      </span>{' '}
                      <div style={secondaryCellTextStyle}>
                        {' '}
                        {formatDate(audit.shared_at)}{' '}
                      </div>{' '}
                    </div>{' '}
                    <div style={auditCellCreatorStyle}>
                      {' '}
                      <div style={primaryCellTextStyle}>
                        {' '}
                        {getCreatedByLabel(audit)}{' '}
                      </div>{' '}
                      <div style={secondaryCellTextStyle}>
                        {' '}
                        {audit.created_by_role || '-'}{' '}
                      </div>{' '}
                    </div>{' '}
                    <div style={auditCellCommentsStyle}>
                      {' '}
                      <div style={primaryCellTextStyle}>
                        {' '}
                        {getCommentsPreview(audit.comments)}{' '}
                      </div>{' '}
                    </div>{' '}
                    <div style={auditCellActionsStyle}>
                      {' '}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(
                            expandedId === audit.id ? null : audit.id
                          )
                        }
                        style={miniSecondaryButton}
                      >
                        {' '}
                        {isExpanded ? 'Hide' : 'Details'}{' '}
                      </button>{' '}
                      {isAdmin ? (
                        <>
                          {' '}
                          <button
                            type="button"
                            onClick={() => void handleToggleShare(audit)}
                            disabled={
                              releaseLoadingId === audit.id ||
                              saving ||
                              bulkSaving
                            }
                            style={
                              audit.shared_with_agent
                                ? miniDangerButton
                                : miniPrimaryButton
                            }
                          >
                            {' '}
                            {releaseLoadingId === audit.id
                              ? '...'
                              : audit.shared_with_agent
                              ? 'Hide'
                              : 'Share'}{' '}
                          </button>{' '}
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => startEditAudit(audit)}
                              style={miniSecondaryButton}
                            >
                              {' '}
                              Edit{' '}
                            </button>
                          ) : null}{' '}
                          <button
                            type="button"
                            onClick={() => void handleDelete(audit.id)}
                            style={miniDangerButton}
                          >
                            {' '}
                            Delete{' '}
                          </button>{' '}
                        </>
                      ) : null}{' '}
                    </div>{' '}
                  </div>{' '}
                  {isExpanded ? (
                    <div style={auditExpandedRowStyle}>
                      {' '}
                      {isEditing && isAdmin ? (
                        <div style={expandedPanelStyle}>
                          {' '}
                          <div style={sectionEyebrow}>Edit Audit</div>{' '}
                          <div style={editGridStyle}>
                            {' '}
                            <div>
                              {' '}
                              <label style={labelStyle}>Team</label>{' '}
                              <select
                                value={editForm.team}
                                onChange={(e) =>
                                  handleTeamChange(
                                    e.target.value as EditFormState['team']
                                  )
                                }
                                style={selectFieldStyle}
                              >
                                {' '}
                                <option value="">Select Team</option>{' '}
                                <option value="Calls">Calls</option>{' '}
                                <option value="Tickets">Tickets</option>{' '}
                                <option value="Sales">Sales</option>{' '}
                              </select>{' '}
                            </div>{' '}
                            <div style={{ gridColumn: '1 / -1' }}>
                              {' '}
                              <label style={labelStyle}>Agent</label>{' '}
                              <div
                                ref={agentPickerRef}
                                style={{ position: 'relative' }}
                              >
                                {' '}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setIsAgentPickerOpen((prev) => !prev)
                                  }
                                  style={pickerButtonStyle}
                                >
                                  {' '}
                                  <span
                                    style={{
                                      color: selectedAgent
                                        ? '#f8fafc'
                                        : '#94a3b8',
                                    }}
                                  >
                                    {' '}
                                    {selectedAgent
                                      ? getAgentLabel(selectedAgent)
                                      : 'Select agent'}{' '}
                                  </span>{' '}
                                  <span>▼</span>{' '}
                                </button>{' '}
                                {isAgentPickerOpen && (
                                  <div style={pickerMenuStyle}>
                                    {' '}
                                    <div style={pickerSearchWrapStyle}>
                                      {' '}
                                      <input
                                        type="text"
                                        value={agentSearch}
                                        onChange={(e) =>
                                          setAgentSearch(e.target.value)
                                        }
                                        placeholder="Search by name, ID, or display name"
                                        style={fieldStyle}
                                      />{' '}
                                    </div>{' '}
                                    <div style={pickerListStyle}>
                                      {' '}
                                      {visibleAgents.length === 0 ? (
                                        <div style={pickerInfoStyle}>
                                          {' '}
                                          No agents found{' '}
                                        </div>
                                      ) : (
                                        visibleAgents.map((profile) => (
                                          <button
                                            key={profile.id}
                                            type="button"
                                            onClick={() =>
                                              handleSelectAgent(profile)
                                            }
                                            style={{
                                              ...pickerOptionStyle,
                                              ...(selectedAgentProfileId ===
                                              profile.id
                                                ? pickerOptionActiveStyle
                                                : {}),
                                            }}
                                          >
                                            {' '}
                                            {getAgentLabel(profile)}{' '}
                                          </button>
                                        ))
                                      )}{' '}
                                    </div>{' '}
                                  </div>
                                )}{' '}
                              </div>{' '}
                            </div>{' '}
                            <div>
                              {' '}
                              <label style={labelStyle}>Case Type</label>{' '}
                              <input
                                value={editForm.caseType}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    caseType: e.target.value,
                                  }))
                                }
                                style={fieldStyle}
                              />{' '}
                            </div>{' '}
                            <div>
                              {' '}
                              <label style={labelStyle}>Audit Date</label>{' '}
                              <input
                                type="date"
                                value={editForm.auditDate}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    auditDate: e.target.value,
                                  }))
                                }
                                onClick={(e) => openNativeDatePicker(e.currentTarget)}
                                onFocus={(e) => openNativeDatePicker(e.currentTarget)}
                                style={fieldStyle}
                              />{' '}
                            </div>{' '}
                            {(editForm.team === 'Calls' ||
                              editForm.team === 'Sales') && (
                              <>
                                {' '}
                                <div>
                                  {' '}
                                  <label style={labelStyle}>
                                    Order Number
                                  </label>{' '}
                                  <input
                                    value={editForm.orderNumber}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        orderNumber: e.target.value,
                                      }))
                                    }
                                    style={fieldStyle}
                                  />{' '}
                                </div>{' '}
                                <div>
                                  {' '}
                                  <label style={labelStyle}>
                                    Phone Number
                                  </label>{' '}
                                  <input
                                    value={editForm.phoneNumber}
                                    onChange={(e) =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        phoneNumber: e.target.value,
                                      }))
                                    }
                                    style={fieldStyle}
                                  />{' '}
                                </div>{' '}
                              </>
                            )}{' '}
                            {editForm.team === 'Tickets' && (
                              <div>
                                {' '}
                                <label style={labelStyle}>Ticket ID</label>{' '}
                                <input
                                  value={editForm.ticketId}
                                  onChange={(e) =>
                                    setEditForm((prev) => ({
                                      ...prev,
                                      ticketId: e.target.value,
                                    }))
                                  }
                                  style={fieldStyle}
                                />{' '}
                              </div>
                            )}{' '}
                            <div style={{ gridColumn: '1 / -1' }}>
                              {' '}
                              <label style={labelStyle}>Comments</label>{' '}
                              <textarea
                                value={editForm.comments}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    comments: e.target.value,
                                  }))
                                }
                                rows={4}
                                style={fieldStyle}
                              />{' '}
                            </div>{' '}
                          </div>{' '}
                          <div
                            style={{
                              marginTop: '18px',
                              display: 'grid',
                              gap: '12px',
                            }}
                          >
                            {' '}
                            {getMetricsForTeam(editForm.team).map((metric) => (
                              <div key={metric.name} style={scoreRowStyle}>
                                {' '}
                                <div
                                  style={{ color: 'var(--screen-text)', fontWeight: 700 }}
                                >
                                  {' '}
                                  {countsTowardScore(metric)
                                    ? `${metric.name} (${metric.pass} pts)`
                                    : metric.name}{' '}
                                </div>{' '}
                                <div style={{ display: 'grid', gap: '8px', minWidth: '230px' }}>
                                  <select
                                    value={getMetricStoredValue(metric, editScores)}
                                    onChange={(e) =>
                                      handleScoreChange(
                                        metric.name,
                                        e.target.value
                                      )
                                    }
                                    disabled={LOCKED_NA_METRICS.has(metric.name)}
                                    style={compactSelectFieldStyle}
                                  >
                                    {' '}
                                    {getMetricOptions(metric).map((option) => (
                                      <option
                                        key={option || '__empty__'}
                                        value={option}
                                        style={selectOptionStyle}
                                      >
                                        {' '}
                                        {option || 'Select answer'}{' '}
                                      </option>
                                    ))}{' '}
                                  </select>{' '}
                                  {countsTowardScore(metric) &&
                                  shouldShowMetricComment(
                                    getMetricStoredValue(metric, editScores)
                                  ) ? (
                                    <textarea
                                      value={editMetricComments[metric.name] || ''}
                                      onChange={(e) =>
                                        handleMetricCommentChange(
                                          metric.name,
                                          e.target.value
                                        )
                                      }
                                      rows={2}
                                      placeholder="Leave a short note explaining the result"
                                      style={metricCommentFieldStyle}
                                    />
                                  ) : null}
                                </div>
                              </div>
                            ))}{' '}
                          </div>{' '}
                          {adjustedEditData ? (
                            <div style={editSummaryStyle}>
                              {' '}
                              <div style={summaryEyebrowStyle}>
                                {' '}
                                Updated Score Preview{' '}
                              </div>{' '}
                              <div style={summaryScoreStyle}>
                                {' '}
                                {adjustedEditData.qualityScore}%{' '}
                              </div>{' '}
                            </div>
                          ) : null}{' '}
                          <div
                            style={{
                              marginTop: '18px',
                              display: 'flex',
                              gap: '10px',
                              flexWrap: 'wrap',
                            }}
                          >
                            {' '}
                            <button
                              type="button"
                              onClick={() => void handleUpdate(audit.id)}
                              disabled={saving}
                              style={primaryButton}
                            >
                              {' '}
                              {saving ? 'Saving...' : 'Save Changes'}{' '}
                            </button>{' '}
                            <button
                              type="button"
                              onClick={cancelEdit}
                              style={secondaryButton}
                            >
                              {' '}
                              Cancel Edit{' '}
                            </button>{' '}
                          </div>{' '}
                        </div>
                      ) : (
                        <div style={expandedPanelStyle}>
                          {' '}
                          <div style={sectionEyebrow}>Audit Details</div>{' '}
                          <div style={detailInfoGridStyle}>
                            {' '}
                            <div style={detailInfoCardStyle}>
                              {' '}
                              <div style={detailLabelStyle}>
                                Created By
                              </div>{' '}
                              <div style={detailValueStyle}>
                                {' '}
                                {getCreatedByLabel(audit)}{' '}
                              </div>{' '}
                              <div style={detailSubValueStyle}>
                                {' '}
                                {audit.created_by_role || '-'}{' '}
                              </div>{' '}
                            </div>{' '}
                            <div style={detailInfoCardStyle}>
                              {' '}
                              <div style={detailLabelStyle}>
                                Creator Email
                              </div>{' '}
                              <div style={detailValueStyle}>
                                {' '}
                                {audit.created_by_email || '-'}{' '}
                              </div>{' '}
                            </div>{' '}
                            <div style={detailInfoCardStyle}>
                              {' '}
                              <div style={detailLabelStyle}>Reference</div>{' '}
                              <div style={detailValueStyle}>
                                {' '}
                                {getAuditReference(audit)}{' '}
                              </div>{' '}
                            </div>{' '}
                            <div style={detailInfoCardStyle}>
                              {' '}
                              <div style={detailLabelStyle}>
                                Release Date
                              </div>{' '}
                              <div style={detailValueStyle}>
                                {' '}
                                {formatDate(audit.shared_at)}{' '}
                              </div>{' '}
                            </div>{' '}
                          </div>{' '}
                          <div style={fullCommentCardStyle}>
                            {' '}
                            <div style={detailLabelStyle}>
                              Full Comment
                            </div>{' '}
                            <div style={fullCommentTextStyle}>
                              {' '}
                              {audit.comments?.trim() || '-'}{' '}
                            </div>{' '}
                          </div>{' '}
                          <div style={{ ...sectionEyebrow, marginTop: '18px' }}>
                            {' '}
                            Score Details{' '}
                          </div>{' '}
                          <div style={{ display: 'grid', gap: '10px' }}>
                            {' '}
                            {(audit.score_details || []).map((detail) => (
                              <div
                                key={`${audit.id}-${detail.metric}`}
                                style={detailRowStyle}
                              >
                                {' '}
                                <div>
                                  {' '}
                                  <div
                                    style={{
                                      color: 'var(--screen-heading)',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {' '}
                                    {detail.metric}{' '}
                                  </div>{' '}
                                  <div
                                    style={{
                                      color: 'var(--screen-muted)',
                                      fontSize: '12px',
                                      marginTop: '4px',
                                    }}
                                  >
                                    {' '}
                                    {isNoScoreDetail(detail)
                                      ? 'Administrative question'
                                      : `Pass ${detail.pass} • Borderline ${detail.borderline} • Adjusted ${detail.adjustedWeight.toFixed(2)}`}{' '}
                                  </div>{' '}
                                  {detail.metric_comment ? (
                                    <div style={metricNoteCardStyle}>
                                      <div style={metricNoteLabelStyle}>QA Note</div>
                                      <div style={metricNoteTextStyle}>
                                        {detail.metric_comment}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>{' '}
                                <span
                                  style={{
                                    ...pillStyle,
                                    backgroundColor: getResultBadgeColor(
                                      detail.result
                                    ),
                                  }}
                                >
                                  {' '}
                                  {detail.result}{' '}
                                </span>{' '}
                              </div>
                            ))}{' '}
                          </div>{' '}
                        </div>
                      )}{' '}
                    </div>
                  ) : null}{' '}
                </div>
              );
            })}{' '}
          </div>{' '}
        </div>
      )}{' '}
    </div>
  );
}
const pageHeaderStyle = {
  display: 'flex',
  gap: '12px',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
  marginBottom: '18px',
};
const sectionEyebrow = {
  color: 'var(--screen-accent)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.16em',
  marginBottom: '12px',
};
const panelStyle = {
  background: 'var(--screen-panel-bg)',
  border: '1px solid var(--screen-border)',
  borderRadius: '24px',
  padding: '22px',
  boxShadow: 'var(--screen-shadow)',
  backdropFilter: 'blur(14px)',
};
const filterGridStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '14px',
  alignItems: 'flex-end',
};

const searchFilterFieldStyle = {
  flex: '1 1 320px',
  minWidth: '300px',
};

const standardFilterFieldStyle = {
  flex: '1 1 240px',
  minWidth: '220px',
};

const dateFilterFieldStyle = {
  flex: '0 1 220px',
  minWidth: '200px',
};
const labelStyle = {
  display: 'block',
  marginBottom: '8px',
  fontSize: '13px',
  color: 'var(--screen-text)',
  fontWeight: 700,
};
const fieldStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '16px',
  border: '1px solid var(--screen-border-strong)',
  background: 'var(--screen-field-bg)',
  color: 'var(--screen-text)',
};
const selectFieldStyle = {
  ...fieldStyle,
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  MozAppearance: 'none' as const,
  paddingRight: '44px',
  backgroundImage:
    'linear-gradient(45deg, transparent 50%, #cbd5e1 50%), linear-gradient(135deg, #cbd5e1 50%, transparent 50%)',
  backgroundPosition: 'calc(100% - 22px) calc(50% - 3px), calc(100% - 16px) calc(50% - 3px)',
  backgroundSize: '6px 6px, 6px 6px',
  backgroundRepeat: 'no-repeat',
  colorScheme: 'normal' as const,
};
const compactFieldStyle = {
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid var(--screen-border-strong)',
  background: 'var(--screen-field-bg)',
  color: 'var(--screen-text)',
  minWidth: '170px',
};
const compactSelectFieldStyle = {
  ...compactFieldStyle,
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  MozAppearance: 'none' as const,
  paddingRight: '40px',
  backgroundImage:
    'linear-gradient(45deg, transparent 50%, #cbd5e1 50%), linear-gradient(135deg, #cbd5e1 50%, transparent 50%)',
  backgroundPosition: 'calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px)',
  backgroundSize: '6px 6px, 6px 6px',
  backgroundRepeat: 'no-repeat',
  colorScheme: 'normal' as const,
};
const selectOptionStyle = {
  backgroundColor: 'var(--screen-select-option-bg)',
  color: 'var(--screen-select-option-text)',
};
const metricCommentFieldStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid var(--screen-border-strong)',
  background: 'rgba(15,23,42,0.78)',
  color: 'var(--screen-text)',
  resize: 'vertical' as const,
};
const metricNoteCardStyle = {
  marginTop: '10px',
  borderRadius: '12px',
  border: '1px solid var(--screen-border)',
  background: 'var(--screen-card-soft-bg)',
  padding: '10px 12px',
};
const metricNoteLabelStyle = {
  color: '#93c5fd',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  marginBottom: '6px',
};
const metricNoteTextStyle = {
  color: 'var(--screen-text)',
  fontSize: '13px',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap' as const,
};
const secondaryButton = {
  padding: '12px 16px',
  background: 'var(--screen-secondary-btn-bg)',
  color: 'var(--screen-secondary-btn-text)',
  border: '1px solid var(--screen-border-strong)',
  borderRadius: '14px',
  cursor: 'pointer',
  fontWeight: 700,
};
const primaryButton = {
  padding: '12px 16px',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  border: '1px solid rgba(96,165,250,0.24)',
  borderRadius: '14px',
  cursor: 'pointer',
  fontWeight: 700,
};
const dangerButton = {
  padding: '12px 16px',
  background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)',
  color: '#ffffff',
  border: '1px solid rgba(252,165,165,0.2)',
  borderRadius: '14px',
  cursor: 'pointer',
  fontWeight: 700,
};
const miniSecondaryButton = {
  padding: '8px 10px',
  background: 'var(--screen-secondary-btn-bg)',
  color: 'var(--screen-secondary-btn-text)',
  border: '1px solid var(--screen-border-strong)',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '12px',
};
const miniPrimaryButton = {
  padding: '8px 10px',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  border: '1px solid rgba(96,165,250,0.24)',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '12px',
};
const miniDangerButton = {
  padding: '8px 10px',
  background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)',
  color: '#ffffff',
  border: '1px solid rgba(252,165,165,0.2)',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '12px',
};
const errorBanner = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  backgroundColor: 'rgba(127,29,29,0.24)',
  border: '1px solid rgba(252,165,165,0.24)',
  color: '#fecaca',
};
const successBanner = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  backgroundColor: 'rgba(22,101,52,0.24)',
  border: '1px solid rgba(134,239,172,0.22)',
  color: '#bbf7d0',
};
const infoBanner = {
  backgroundColor: 'rgba(30,64,175,0.18)',
  border: '1px solid rgba(147,197,253,0.22)',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '24px',
  color: '#bfdbfe',
  marginTop: '18px',
};
const progressPanelStyle = {
  ...panelStyle,
  marginTop: '18px',
};
const progressPanelHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
  flexWrap: 'wrap' as const,
  marginBottom: '16px',
};
const progressMetaRowStyle = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap' as const,
};
const progressMetaPillStyle = {
  padding: '8px 10px',
  borderRadius: '999px',
  border: '1px solid var(--screen-border)',
  background: 'var(--screen-card-soft-bg)',
  color: 'var(--screen-text)',
  fontSize: '12px',
  fontWeight: 700,
};
const progressEmptyStateStyle = {
  padding: '18px',
  borderRadius: '16px',
  border: '1px dashed var(--screen-border)',
  background: 'var(--screen-card-soft-bg)',
  color: 'var(--screen-muted)',
};
const progressTableWrapStyle = {
  overflowX: 'auto' as const,
  borderRadius: '18px',
  border: '1px solid var(--screen-border)',
  background: 'var(--screen-panel-bg)',
};
const progressTableStyle = {
  minWidth: '1400px',
};
const progressEntryStyle = {
  borderBottom: '1px solid rgba(148,163,184,0.08)',
};
const progressRowStyle = {
  display: 'grid',
  gridTemplateColumns: '240px 100px 110px repeat(12, 78px) 110px 110px',
  gap: '10px',
  alignItems: 'stretch',
  padding: '12px 14px',
};
const progressHeaderRowStyle = {
  position: 'sticky' as const,
  top: 0,
  zIndex: 1,
  background: 'var(--screen-table-head-bg)',
  color: '#93c5fd',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
};
const progressAgentCellStyle = {
  display: 'grid',
  alignContent: 'center',
};
const progressMetaCellStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center' as const,
};
const progressEvalCellStyle = {
  minHeight: '54px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center' as const,
  borderRadius: '12px',
  border: '1px solid var(--screen-border)',
  fontWeight: 800,
  fontSize: '13px',
};
const progressStrongCellStyle = {
  background: 'var(--progress-strong-bg)',
  color: 'var(--progress-strong-text)',
  border: '1px solid var(--progress-strong-border)',
};
const progressMediumCellStyle = {
  background: 'var(--progress-medium-bg)',
  color: 'var(--progress-medium-text)',
  border: '1px solid var(--progress-medium-border)',
};
const progressWeakCellStyle = {
  background: 'var(--progress-weak-bg)',
  color: 'var(--progress-weak-text)',
  border: '1px solid var(--progress-weak-border)',
};
const progressEmptyCellStyle = {
  background: 'var(--progress-empty-bg)',
  color: 'var(--progress-empty-text)',
};
const progressOffButtonStyle = {
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid var(--screen-border-strong)',
  background: 'var(--screen-secondary-btn-bg)',
  color: 'var(--screen-secondary-btn-text)',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '12px',
};
const progressOffButtonActiveStyle = {
  ...progressOffButtonStyle,
  background: 'var(--progress-off-bg)',
  color: 'var(--progress-off-text)',
  border: '1px solid var(--progress-off-border)',
};
const progressOffPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 10px',
  borderRadius: '999px',
  background: 'var(--progress-off-bg)',
  color: 'var(--progress-off-text)',
  border: '1px solid var(--progress-off-border)',
  fontWeight: 800,
  fontSize: '12px',
};
const progressAveragePillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '78px',
  padding: '8px 10px',
  borderRadius: '999px',
  fontWeight: 800,
  fontSize: '13px',
};
const teamMiniPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '7px 10px',
  borderRadius: '999px',
  background: 'var(--screen-card-soft-bg)',
  border: '1px solid var(--screen-border)',
  color: 'var(--screen-text)',
  fontSize: '12px',
  fontWeight: 700,
};
const auditTableWrapStyle = {
  marginTop: '18px',
  overflowX: 'auto' as const,
  borderRadius: '20px',
  border: '1px solid var(--screen-border)',
  background: 'var(--screen-panel-bg)',
};
const auditTableStyle = { minWidth: '1800px' };
const auditEntryStyle = { borderBottom: '1px solid rgba(148,163,184,0.08)' };
const auditRowStyle = {
  display: 'grid',
  gridTemplateColumns:
    '220px 130px 170px minmax(240px,1.35fr) 110px 180px 180px minmax(300px,1.8fr) 260px',
  gap: '14px',
  alignItems: 'center',
  padding: '14px 16px',
};
const auditHeaderRowStyle = {
  position: 'sticky' as const,
  top: 0,
  zIndex: 1,
  background: 'var(--screen-table-head-bg)',
  color: '#93c5fd',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
};
const auditCellAgentStyle = {};
const auditCellDateStyle = {};
const auditCellCaseStyle = {};
const auditCellReferenceStyle = {};
const auditCellScoreStyle = {};
const auditCellReleaseStyle = {};
const auditCellCreatorStyle = {};
const auditCellCommentsStyle = {};
const auditCellActionsStyle = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap' as const,
};
const primaryCellTextStyle = {
  color: 'var(--screen-heading)',
  fontSize: '14px',
  fontWeight: 600,
  lineHeight: 1.4,
};
const secondaryCellTextStyle = {
  marginTop: '4px',
  color: 'var(--screen-subtle)',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1.4,
};
const scorePillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '84px',
  padding: '8px 10px',
  borderRadius: '999px',
  background: 'var(--screen-score-pill-bg)',
  border: '1px solid var(--screen-score-pill-border)',
  color: 'var(--screen-score-pill-text)',
  fontSize: '13px',
  fontWeight: 800,
};
const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  color: '#ffffff',
};
const auditExpandedRowStyle = { padding: '0 16px 16px 16px' };
const expandedPanelStyle = {
  borderRadius: '18px',
  border: '1px solid var(--screen-border)',
  background: 'var(--screen-panel-bg)',
  padding: '18px',
};
const editGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
};
const detailInfoGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
  marginBottom: '18px',
};
const detailInfoCardStyle = {
  borderRadius: '14px',
  border: '1px solid var(--screen-border)',
  background: 'var(--screen-card-soft-bg)',
  padding: '14px 16px',
};
const detailLabelStyle = {
  color: 'var(--screen-muted)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  marginBottom: '8px',
};
const detailValueStyle = {
  color: 'var(--screen-heading)',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1.5,
};
const detailSubValueStyle = {
  color: 'var(--screen-subtle)',
  fontSize: '12px',
  fontWeight: 600,
  marginTop: '6px',
};
const fullCommentCardStyle = {
  borderRadius: '14px',
  border: '1px solid var(--screen-border)',
  background: 'var(--screen-card-soft-bg)',
  padding: '14px 16px',
};
const fullCommentTextStyle = {
  color: 'var(--screen-heading)',
  fontSize: '14px',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
};
const pickerButtonStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '16px',
  border: '1px solid var(--screen-border-strong)',
  background: 'var(--screen-field-bg)',
  color: 'var(--screen-field-text)',
  textAlign: 'left' as const,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};
const pickerMenuStyle = {
  position: 'absolute' as const,
  top: 'calc(100% + 8px)',
  left: 0,
  right: 0,
  background: 'rgba(15,23,42,0.96)',
  border: '1px solid var(--screen-border-strong)',
  borderRadius: '18px',
  boxShadow: '0 18px 44px rgba(2,6,23,0.45)',
  zIndex: 20,
  overflow: 'hidden',
  backdropFilter: 'blur(16px)',
};
const pickerSearchWrapStyle = {
  padding: '12px',
  borderBottom: '1px solid rgba(148,163,184,0.12)',
};
const pickerListStyle = {
  maxHeight: '280px',
  overflowY: 'auto' as const,
  padding: '8px',
  display: 'grid',
  gap: '8px',
};
const pickerInfoStyle = {
  padding: '12px',
  borderRadius: '12px',
  backgroundColor: 'var(--screen-soft-fill)',
  color: 'var(--screen-muted)',
};
const pickerOptionStyle = {
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid var(--screen-border)',
  backgroundColor: 'var(--screen-soft-fill)',
  textAlign: 'left' as const,
  cursor: 'pointer',
  color: 'var(--screen-text)',
  fontWeight: 600,
};
const pickerOptionActiveStyle = {
  border: '1px solid rgba(96,165,250,0.36)',
  backgroundColor: 'rgba(30,64,175,0.32)',
};
const scoreRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1px solid var(--screen-border)',
  background: 'var(--screen-card-soft-bg)',
};
const editSummaryStyle = {
  marginTop: '18px',
  borderRadius: '18px',
  padding: '18px',
  border: '1px solid rgba(96,165,250,0.2)',
  background:
    'linear-gradient(135deg, rgba(30,64,175,0.22) 0%, rgba(15,23,42,0.5) 100%)',
};
const summaryEyebrowStyle = {
  color: '#93c5fd',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  fontSize: '12px',
  letterSpacing: '0.12em',
};
const summaryScoreStyle = {
  fontSize: '32px',
  fontWeight: 800,
  color: 'var(--screen-heading)',
  marginTop: '8px',
};
const detailRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1px solid var(--screen-border)',
  background: 'var(--screen-card-soft-bg)',
};
export default AuditsListSupabase;
