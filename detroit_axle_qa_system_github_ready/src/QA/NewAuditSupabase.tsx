import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  memo,
  type CSSProperties,
} from 'react';
import { supabase } from '../lib/supabase';
import {
  clearAgentProfilesCache,
  getCachedAgentProfiles,
  type CachedAgentProfile,
  type TeamName,
} from '../lib/agentProfilesCache';
import { usePersistentState } from '../hooks/usePersistentState';

/* ═════════════════════════════════════════════════════════════
   Types
   ═════════════════════════════════════════════════════════════ */

type Metric = {
  name: string;
  pass: number;
  borderline: number;
  countsTowardScore?: boolean;
  options?: string[];
  defaultValue?: string;
};

type TeamType = TeamName | '';

type AgentProfile = CachedAgentProfile;

type CreatorProfile = {
  id: string;
  role: 'admin' | 'qa' | 'agent';
  agent_name: string;
  display_name: string | null;
  email: string;
};

type CreatorSummary = {
  userId: string;
  name: string;
  role: 'admin' | 'qa' | 'agent' | '';
  email: string;
};

type LastAuditSummary = {
  id: string;
  agentName: string;
  agentId: string | null;
  team: TeamType;
  caseType: string;
  auditDate: string;
  qualityScore: number | null;
};

type AuthMetadata = {
  display_name?: string;
  full_name?: string;
  name?: string;
};

type AuditDraft = {
  team: TeamType;
  selectedAgentProfileId: string;
  agentSearch: string;
  caseType: string;
  auditDate: string;
  orderNumber: string;
  phoneNumber: string;
  ticketId: string;
  comments: string;
  scores: Record<string, string>;
  metricComments: Record<string, string>;
};

/* ═════════════════════════════════════════════════════════════
   Constants
   ═════════════════════════════════════════════════════════════ */

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

const CASE_TYPES = [
  '',
  'Order status',
  'General Inquiry',
  'Exchange',
  'Missing Parts',
  'Refund - Store credit',
  'Delivered but not received',
  'FedEx Cases',
  'Replacement',
  'Warranty',
  'Fitment issue',
  'Damaged package',
  'Cancellation',
];

const TEAMS: Exclude<TeamType, ''>[] = ['Calls', 'Tickets', 'Sales'];

const TEAM_ACCENTS: Record<string, string> = {
  Calls: '#3b82f6',
  Tickets: '#8b5cf6',
  Sales: '#10b981',
};

/* ═════════════════════════════════════════════════════════════
   Pure helpers (module scope = zero re-allocation)
   ═════════════════════════════════════════════════════════════ */

function countsTowardScore(metric: Metric) {
  return metric.countsTowardScore !== false;
}

function shouldShowMetricComment(result: string) {
  return result === 'Borderline' || result === 'Fail' || result === 'Auto-Fail';
}

function pickPreferredName(values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return 'Unknown User';
}

function getMetricsForTeam(teamValue: TeamType): Metric[] {
  if (teamValue === 'Calls') return callsMetrics;
  if (teamValue === 'Tickets') return ticketsMetrics;
  if (teamValue === 'Sales') return salesMetrics;
  return [];
}

function isLockedToNA(metricName: string) {
  return LOCKED_NA_METRICS.has(metricName);
}

function canAutoFail(metricName: string) {
  return AUTO_FAIL_METRICS.has(metricName);
}

function getMetricOptions(metric: Metric) {
  if (metric.options?.length) return metric.options;
  if (isLockedToNA(metric.name)) return ['N/A'];
  const options = ['N/A', 'Pass', 'Borderline', 'Fail'];
  if (canAutoFail(metric.name)) options.push('Auto-Fail');
  return options;
}

function getMetricStoredValue(metric: Metric, scores: Record<string, string>) {
  if (isLockedToNA(metric.name)) return 'N/A';
  return scores[metric.name] ?? metric.defaultValue ?? 'N/A';
}

function createDefaultScores(teamValue: TeamType) {
  const defaults: Record<string, string> = {};
  getMetricsForTeam(teamValue).forEach((metric) => {
    defaults[metric.name] = metric.defaultValue ?? 'N/A';
  });
  return defaults;
}

function createEmptyDraft(teamValue: TeamType = ''): AuditDraft {
  return {
    team: teamValue,
    selectedAgentProfileId: '',
    agentSearch: '',
    caseType: '',
    auditDate: '',
    orderNumber: '',
    phoneNumber: '',
    ticketId: '',
    comments: '',
    scores: createDefaultScores(teamValue),
    metricComments: {},
  };
}

function getMissingRequiredMetricLabels(
  teamValue: TeamType,
  scores: Record<string, string>
) {
  return getMetricsForTeam(teamValue)
    .filter(
      (metric) => Array.isArray(metric.options) && metric.defaultValue === ''
    )
    .filter((metric) => !getMetricStoredValue(metric, scores))
    .map((metric) => metric.name);
}

function getAdjustedScoreData(
  team: TeamType,
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
  const fullTotalWeight = scoredMetrics.reduce(
    (sum, item) => sum + item.pass,
    0
  );

  const scoreDetails = metrics.map((metric) => {
    const result = getMetricStoredValue(metric, scores);
    const scored = countsTowardScore(metric);
    const adjustedWeight =
      !scored ||
      result === 'N/A' ||
      result === '' ||
      activeTotalWeight === 0
        ? 0
        : (metric.pass / activeTotalWeight) * fullTotalWeight;
    let earned = 0;
    if (scored && result === 'Pass') earned = adjustedWeight;
    else if (scored && result === 'Borderline')
      earned =
        metric.pass > 0
          ? adjustedWeight * (metric.borderline / metric.pass)
          : 0;
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
      canAutoFail(item.metric) &&
      item.result === 'Auto-Fail'
  );
  const qualityScore = hasAutoFail
    ? '0.00'
    : scoreDetails
        .filter((item) => item.counts_toward_score !== false)
        .reduce((sum, item) => sum + item.earned, 0)
        .toFixed(2);

  return { scoreDetails, qualityScore, hasAutoFail };
}

function openNativeDatePicker(target: HTMLInputElement) {
  try {
    (target as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
  } catch {
    /* ignore unsupported browsers */
  }
}

function getResultColor(result: string): string {
  if (result === 'Pass') return '#10b981';
  if (result === 'Borderline') return '#f59e0b';
  if (result === 'Fail') return '#ef4444';
  if (result === 'Auto-Fail') return '#dc2626';
  if (result === 'N/A') return '#64748b';
  if (result === 'Yes') return '#10b981';
  if (result === 'No') return '#ef4444';
  return '#64748b';
}

/* ═════════════════════════════════════════════════════════════
   Theme
   ═════════════════════════════════════════════════════════════ */

function useThemeRefresh() {
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const refresh = () => setKey((v) => v + 1);
    const observer = new MutationObserver(refresh);
    const config = { attributes: true, attributeFilter: ['data-theme', 'data-theme-mode'] };

    observer.observe(document.documentElement, config);
    if (document.body) observer.observe(document.body, config);

    window.addEventListener('storage', refresh);
    window.addEventListener('detroit-axle-theme-change', refresh as EventListener);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', refresh);
      window.removeEventListener('detroit-axle-theme-change', refresh as EventListener);
    };
  }, []);

  return key;
}

function getThemeVars(): Record<string, string> {
  const themeMode =
    typeof document !== 'undefined'
      ? (
          document.body.dataset.theme ||
          document.documentElement.dataset.theme ||
          window.localStorage.getItem('detroit-axle-theme-mode') ||
          ''
        ).toLowerCase()
      : '';
  const isLight = themeMode === 'light' || themeMode === 'white';
  return {
    '--na-bg': isLight ? '#f8fafc' : '#080d1a',
    '--na-surface': isLight ? '#ffffff' : '#0d1526',
    '--na-surface-2': isLight ? '#f1f5f9' : '#111927',
    '--na-surface-3': isLight ? '#e2e8f0' : '#162030',
    '--na-border': isLight ? 'rgba(148,163,184,0.3)' : 'rgba(148,163,184,0.08)',
    '--na-border-strong': isLight ? 'rgba(148,163,184,0.6)' : 'rgba(148,163,184,0.14)',
    '--na-text': isLight ? '#0f172a' : '#e2eaf7',
    '--na-text-2': isLight ? '#334155' : '#94a3b8',
    '--na-text-3': isLight ? '#64748b' : '#475569',
    '--na-accent': isLight ? '#2563eb' : '#3b82f6',
    '--na-accent-dim': isLight ? 'rgba(37,99,235,0.12)' : 'rgba(59,130,246,0.10)',
    '--na-accent-glow': isLight ? 'rgba(37,99,235,0.20)' : 'rgba(59,130,246,0.18)',
    '--na-field-bg': isLight ? '#ffffff' : 'rgba(13,21,38,0.8)',
    '--na-field-text': isLight ? '#0f172a' : '#e2eaf7',
    '--na-option-bg': isLight ? '#ffffff' : '#0d1526',
    '--na-option-text': isLight ? '#0f172a' : '#e2eaf7',
    '--na-shadow-sm': isLight ? '0 1px 3px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.4)',
    '--na-shadow-md': isLight ? '0 4px 16px rgba(0,0,0,0.08)' : '0 4px 16px rgba(0,0,0,0.4)',
    '--na-shadow-lg': isLight ? '0 12px 40px rgba(0,0,0,0.10)' : '0 12px 40px rgba(0,0,0,0.5)',
  };
}

/* ═════════════════════════════════════════════════════════════
   Sub-components
   ═════════════════════════════════════════════════════════════ */

const ScoreGauge = memo(function ScoreGauge({
  score,
  size = 80,
}: {
  score: number;
  size?: number;
}) {
  const pct = Math.min(100, Math.max(0, score));
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - pct / 100);
  const color = pct >= 90 ? '#10b981' : pct >= 75 ? '#f59e0b' : '#ef4444';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)' }}
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(148,163,184,0.12)"
        strokeWidth="6"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        style={{
          transition:
            'stroke-dashoffset 0.6s cubic-bezier(0.34,1.56,0.64,1), stroke 0.3s ease',
        }}
      />
    </svg>
  );
});

type ScorecardProps = {
  title: string;
  metrics: Metric[];
  draft: AuditDraft;
  onScoreChange: (metricName: string, value: string) => void;
  onMetricCommentChange: (metricName: string, value: string) => void;
  qualityScore: string;
  hasAutoFail: boolean;
  scoreNum: number;
  scoreColor: string;
};

const ScorecardPanel = memo(function ScorecardPanel({
  title,
  metrics,
  draft,
  onScoreChange,
  onMetricCommentChange,
  qualityScore,
  hasAutoFail,
  scoreNum,
  scoreColor,
}: ScorecardProps) {
  return (
    <div style={{ marginTop: '28px' }}>
      <div style={styles.sectionLabel}>{title}</div>
      <div style={{ display: 'grid', gap: '10px' }}>
        {metrics.map((metric) => {
          const metricOptions = getMetricOptions(metric);
          const metricValue = getMetricStoredValue(metric, draft.scores);
          const showMetricComment =
            countsTowardScore(metric) && shouldShowMetricComment(metricValue);
          const resultColor = getResultColor(metricValue);
          const isMeaningful = metricValue !== 'N/A' && metricValue !== '';

          return (
            <div
              key={metric.name}
              style={{
                ...styles.metricCard,
                ...(isMeaningful
                  ? { borderLeft: `3px solid ${resultColor}` }
                  : {}),
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <div style={styles.metricName}>
                    {metric.name}
                    {countsTowardScore(metric) && (
                      <span style={styles.metricPts}>{metric.pass} pts</span>
                    )}
                  </div>
                  {isLockedToNA(metric.name) && (
                    <div style={styles.lockedBadge}>Locked · N/A</div>
                  )}
                </div>
                <div style={{ minWidth: '180px' }}>
                  <select
                    value={metricValue}
                    onChange={(e) => onScoreChange(metric.name, e.target.value)}
                    disabled={isLockedToNA(metric.name)}
                    aria-label={`${metric.name} result`}
                    style={{
                      ...styles.selectField,
                      borderColor: isMeaningful
                        ? `${resultColor}44`
                        : undefined,
                      color: isMeaningful ? resultColor : undefined,
                    }}
                  >
                    {metricOptions.map((option) => (
                      <option
                        key={option || '__empty__'}
                        value={option}
                        style={{
                          backgroundColor: 'var(--na-option-bg)',
                          color: 'var(--na-option-text)',
                        }}
                      >
                        {option || 'Select answer'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {showMetricComment && (
                <div style={{ marginTop: '10px' }}>
                  <div style={styles.qaNoteLabelStyle}>QA note for agent</div>
                  <textarea
                    value={draft.metricComments[metric.name] || ''}
                    onChange={(e) =>
                      onMetricCommentChange(metric.name, e.target.value)
                    }
                    rows={2}
                    placeholder="Brief explanation for this result…"
                    style={styles.qaTextarea}
                    aria-label={`QA note for ${metric.name}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasAutoFail && (
        <div style={styles.autoFailBanner}>
          <span style={{ fontSize: '16px' }}>⚠</span>
          <span>Auto-Fail triggered — Final score: 0.00%</span>
        </div>
      )}

      <div style={styles.scoreSummaryCard}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '20px' }}
        >
          <div
            style={{
              position: 'relative',
              width: '80px',
              height: '80px',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <ScoreGauge score={scoreNum} size={80} />
            <div
              style={{
                position: 'absolute',
                fontSize: '13px',
                fontWeight: 800,
                color: scoreColor,
              }}
            >
              {qualityScore}%
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--na-text-2)',
                marginBottom: '4px',
              }}
            >
              Quality Score
            </div>
            <div
              style={{
                fontSize: '36px',
                fontWeight: 900,
                color: scoreColor,
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {qualityScore}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ═════════════════════════════════════════════════════════════
   Main Component
   ═════════════════════════════════════════════════════════════ */

function NewAuditSupabase() {
  const [draft, setDraft] = usePersistentState<AuditDraft>(
    'detroit-axle-new-audit-draft',
    createEmptyDraft('')
  );
  const [saving, setSaving] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([]);
  const [agentLoadError, setAgentLoadError] = useState('');
  const [creatorSummary, setCreatorSummary] = useState<CreatorSummary | null>(
    null
  );
  const [lastAudit, setLastAudit] = useState<LastAuditSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);

  const themeRefreshKey = useThemeRefresh();
  const themeVars = useMemo(() => getThemeVars(), [themeRefreshKey]);
  const agentPickerRef = useRef<HTMLDivElement | null>(null);

  /* ── Data loading ── */
  const loadAgentProfiles = useCallback(
    async (options?: { force?: boolean }) => {
      setLoadingAgents(true);
      setAgentLoadError('');
      try {
        const data = await getCachedAgentProfiles(undefined, {
          force: options?.force,
        });
        setAgentProfiles(data);
      } catch (error) {
        setAgentLoadError(
          error instanceof Error ? error.message : 'Could not load agents.'
        );
      } finally {
        setLoadingAgents(false);
      }
    },
    []
  );

  const loadCurrentCreatorSummary = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setCreatorSummary(null);
      return;
    }
    const authUser = authData.user;
    const authMetadata = (authUser.user_metadata || {}) as AuthMetadata;

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, agent_name, display_name, email')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError || !profileData) {
      setCreatorSummary({
        userId: authUser.id,
        name: pickPreferredName([
          authMetadata.display_name,
          authMetadata.full_name,
          authMetadata.name,
          authUser.email,
        ]),
        role: '',
        email: authUser.email || '',
      });
      return;
    }

    const creatorProfile = profileData as CreatorProfile;
    setCreatorSummary({
      userId: creatorProfile.id,
      name: pickPreferredName([
        authMetadata.display_name,
        authMetadata.full_name,
        authMetadata.name,
        creatorProfile.display_name,
        creatorProfile.agent_name,
        creatorProfile.email,
        authUser.email,
      ]),
      role: creatorProfile.role,
      email: creatorProfile.email || authUser.email || '',
    });
  }, []);

  const loadLastAuditSummary = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setLastAudit(null);
      return;
    }
    const { data, error } = await supabase
      .from('audits')
      .select(
        'id, agent_name, agent_id, team, case_type, audit_date, quality_score'
      )
      .eq('created_by_user_id', authData.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      setLastAudit(null);
      return;
    }

    setLastAudit({
      id: data.id,
      agentName: data.agent_name || '-',
      agentId: data.agent_id || null,
      team: (data.team || '') as TeamType,
      caseType: data.case_type || '-',
      auditDate: data.audit_date || '',
      qualityScore:
        typeof data.quality_score === 'number'
          ? data.quality_score
          : Number(data.quality_score),
    });
  }, []);

  useEffect(() => {
    void loadAgentProfiles();
    void loadCurrentCreatorSummary();
    void loadLastAuditSummary();
  }, [loadAgentProfiles, loadCurrentCreatorSummary, loadLastAuditSummary]);

  /* ── Outside click for agent picker ── */
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

  /* ── Handlers ── */
  const handleRefreshAgents = useCallback(() => {
    clearAgentProfilesCache();
    void loadAgentProfiles({ force: true });
  }, [loadAgentProfiles]);

  const getAgentLabel = useCallback((profile: AgentProfile) => {
    return profile.display_name
      ? `${profile.agent_name} — ${profile.display_name}`
      : `${profile.agent_name} · ${profile.agent_id}`;
  }, []);

  const teamAgents = useMemo(
    () =>
      agentProfiles.filter(
        (p) =>
          p.role === 'agent' &&
          p.team === draft.team &&
          p.agent_id &&
          p.agent_name
      ),
    [agentProfiles, draft.team]
  );

  const visibleAgents = useMemo(() => {
    const search = draft.agentSearch.trim().toLowerCase();
    if (!search) return teamAgents;
    return teamAgents.filter((p) => {
      const label = getAgentLabel(p);
      return (
        p.agent_name.toLowerCase().includes(search) ||
        (p.agent_id || '').toLowerCase().includes(search) ||
        (p.display_name || '').toLowerCase().includes(search) ||
        label.toLowerCase().includes(search)
      );
    });
  }, [teamAgents, draft.agentSearch, getAgentLabel]);

  const selectedAgent =
    teamAgents.find((p) => p.id === draft.selectedAgentProfileId) || null;

  const adjustedData = useMemo(
    () => getAdjustedScoreData(draft.team, draft.scores, draft.metricComments),
    [draft.team, draft.scores, draft.metricComments]
  );

  const setDraftField = useCallback(
    <K extends keyof AuditDraft>(key: K, value: AuditDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
    },
    [setDraft]
  );

  const setTeamAndReset = useCallback(
    (nextTeam: TeamType) => {
      setErrorMessage('');
      setSuccessMessage('');
      setIsAgentPickerOpen(false);
      setDraft(createEmptyDraft(nextTeam));
    },
    [setDraft]
  );

  const handleScoreChange = useCallback(
    (metricName: string, value: string) => {
      if (isLockedToNA(metricName)) {
        setDraft((prev) => ({
          ...prev,
          scores: { ...prev.scores, [metricName]: 'N/A' },
          metricComments: { ...prev.metricComments, [metricName]: '' },
        }));
        return;
      }
      setDraft((prev) => {
        const nextMetricComments = { ...prev.metricComments };
        if (!shouldShowMetricComment(value))
          delete nextMetricComments[metricName];
        return {
          ...prev,
          scores: { ...prev.scores, [metricName]: value },
          metricComments: nextMetricComments,
        };
      });
    },
    [setDraft]
  );

  const handleMetricCommentChange = useCallback(
    (metricName: string, value: string) => {
      setDraft((prev) => ({
        ...prev,
        metricComments: { ...prev.metricComments, [metricName]: value },
      }));
    },
    [setDraft]
  );

  const handleSelectAgent = useCallback(
    (profile: AgentProfile) => {
      setDraft((prev) => ({
        ...prev,
        selectedAgentProfileId: profile.id,
        agentSearch: getAgentLabel(profile),
      }));
      setIsAgentPickerOpen(false);
    },
    [getAgentLabel, setDraft]
  );

  const handleSave = useCallback(async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!draft.team) {
      setErrorMessage('Please choose a team.');
      return;
    }
    if (!selectedAgent) {
      setErrorMessage('Please choose an agent.');
      return;
    }
    if (!draft.caseType || !draft.auditDate) {
      setErrorMessage('Please fill Case Type and Audit Date.');
      return;
    }
    if (
      (draft.team === 'Calls' || draft.team === 'Sales') &&
      !draft.orderNumber
    ) {
      setErrorMessage('Please fill Order Number for Calls and Sales.');
      return;
    }
    if (draft.team === 'Tickets' && !draft.ticketId) {
      setErrorMessage('Please fill Ticket ID for Tickets.');
      return;
    }

    const missingRequired = getMissingRequiredMetricLabels(
      draft.team,
      draft.scores
    );
    if (missingRequired.length > 0) {
      setErrorMessage(`Please answer: ${missingRequired.join(', ')}.`);
      return;
    }

    const missingComments = getMetricsForTeam(draft.team)
      .filter((m) => countsTowardScore(m))
      .filter((m) =>
        shouldShowMetricComment(getMetricStoredValue(m, draft.scores))
      )
      .filter((m) => !(draft.metricComments[m.name] || '').trim())
      .map((m) => m.name);

    if (missingComments.length > 0) {
      setErrorMessage(
        `Please add a QA note for: ${missingComments.join(', ')}.`
      );
      return;
    }

    if (!selectedAgent.agent_id) {
      setErrorMessage('Selected agent does not have an Agent ID.');
      return;
    }

    setSaving(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      setSaving(false);
      setErrorMessage(authError.message);
      return;
    }
    const authUser = authData.user;
    if (!authUser) {
      setSaving(false);
      setErrorMessage('Could not identify the logged-in user.');
      return;
    }

    const { data: creatorProfileData, error: creatorProfileError } =
      await supabase
        .from('profiles')
        .select('id, role, agent_name, display_name, email')
        .eq('id', authUser.id)
        .maybeSingle();

    if (creatorProfileError) {
      setSaving(false);
      setErrorMessage(creatorProfileError.message);
      return;
    }
    if (!creatorProfileData) {
      setSaving(false);
      setErrorMessage('Could not load the logged-in profile.');
      return;
    }

    const creatorProfile = creatorProfileData as CreatorProfile;
    const authMetadata = (authUser.user_metadata || {}) as AuthMetadata;
    const createdByName = pickPreferredName([
      authMetadata.display_name,
      authMetadata.full_name,
      authMetadata.name,
      creatorProfile.display_name,
      creatorProfile.agent_name,
      creatorProfile.email,
      authUser.email,
    ]);

    const { error } = await supabase.from('audits').insert({
      agent_id: selectedAgent.agent_id,
      agent_name: selectedAgent.agent_name,
      team: draft.team,
      case_type: draft.caseType,
      audit_date: draft.auditDate,
      order_number:
        draft.team === 'Calls' || draft.team === 'Sales'
          ? draft.orderNumber
          : null,
      phone_number:
        draft.team === 'Calls' || draft.team === 'Sales'
          ? draft.phoneNumber || null
          : null,
      ticket_id: draft.team === 'Tickets' ? draft.ticketId : null,
      quality_score: Number(adjustedData.qualityScore),
      comments: draft.comments,
      score_details: adjustedData.scoreDetails,
      created_by_user_id: creatorProfile.id,
      created_by_name: createdByName,
      created_by_email: creatorProfile.email || authUser.email || null,
      created_by_role: creatorProfile.role,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const savedTeam = draft.team;
    setIsAgentPickerOpen(false);
    setDraft(createEmptyDraft(savedTeam));
    setSuccessMessage('Audit saved successfully. Draft cleared.');
    void loadCurrentCreatorSummary();
    void loadLastAuditSummary();
  }, [draft, selectedAgent, adjustedData, setDraft, loadCurrentCreatorSummary, loadLastAuditSummary]);

  const scoreNum = parseFloat(adjustedData.qualityScore);
  const scoreColor =
    scoreNum >= 90 ? '#10b981' : scoreNum >= 75 ? '#f59e0b' : '#ef4444';

  const handleClearDraft = useCallback(() => {
    setIsAgentPickerOpen(false);
    setDraft(createEmptyDraft(draft.team));
    setErrorMessage('');
    setSuccessMessage('Draft cleared.');
  }, [draft.team, setDraft]);

  /* ═════════════════════════════════════════════════════════
     Render
     ═════════════════════════════════════════════════════════ */

  return (
    <div
      data-no-theme-invert="true"
      style={{
        color: 'var(--na-text)',
        ...(themeVars as CSSProperties),
        fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
      }}
    >
      {/* Page header */}
      <div style={styles.pageHeader}>
        <div>
          <div style={styles.eyebrow}>Audit Workspace</div>
          <h2 style={styles.pageTitle}>New Audit</h2>
          <p style={styles.pageSub}>
            Create a Detroit Axle QA audit using the live agent directory.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefreshAgents}
          style={styles.btnSecondary}
        >
          ↻ Refresh Agents
        </button>
      </div>

      {/* Banners */}
      {errorMessage && (
        <div style={styles.errorBanner} role="alert">
          <span>✕</span> {errorMessage}
        </div>
      )}
      {successMessage && (
        <div style={styles.successBanner} role="status">
          <span>✓</span> {successMessage}
        </div>
      )}

      {/* Team selector */}
      <div style={styles.card}>
        <div style={styles.cardInner}>
          <div style={styles.sectionLabel}>Select Team</div>
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
            }}
            role="radiogroup"
            aria-label="Select team"
          >
            {TEAMS.map((t) => {
              const active = draft.team === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTeamAndReset(t)}
                  style={{
                    ...styles.teamBtn,
                    ...(active
                      ? {
                          background: TEAM_ACCENTS[t],
                          color: '#fff',
                          boxShadow: `0 4px 20px ${TEAM_ACCENTS[t]}44`,
                          borderColor: `${TEAM_ACCENTS[t]}88`,
                        }
                      : {}),
                  }}
                >
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: active
                        ? 'rgba(255,255,255,0.6)'
                        : TEAM_ACCENTS[t],
                      flexShrink: 0,
                    }}
                  />
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main form */}
      {draft.team && (
        <div style={{ ...styles.card, marginTop: '12px' }}>
          <div style={styles.cardInner}>
            <div style={styles.formGrid}>
              {/* Agent picker */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={styles.fieldLabel}>Agent</label>
                <div ref={agentPickerRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    aria-expanded={isAgentPickerOpen}
                    aria-haspopup="listbox"
                    onClick={() => setIsAgentPickerOpen((p) => !p)}
                    style={{
                      ...styles.inputBase,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      textAlign: 'left',
                      ...(selectedAgent
                        ? {
                            borderColor: `${
                              TEAM_ACCENTS[draft.team] ?? '#3b82f6'
                            }44`,
                          }
                        : {}),
                    }}
                  >
                    <span
                      style={{
                        color: selectedAgent
                          ? 'var(--na-text)'
                          : 'var(--na-text-3)',
                      }}
                    >
                      {selectedAgent
                        ? getAgentLabel(selectedAgent)
                        : 'Select an agent…'}
                    </span>
                    <span
                      style={{
                        color: 'var(--na-text-3)',
                        fontSize: '11px',
                        transition: 'transform 0.2s',
                        transform: isAgentPickerOpen
                          ? 'rotate(180deg)'
                          : 'none',
                      }}
                    >
                      ▼
                    </span>
                  </button>

                  {isAgentPickerOpen && (
                    <div
                      style={styles.pickerDropdown}
                      role="listbox"
                      aria-label="Agent list"
                    >
                      <div style={{ padding: '10px 10px 6px' }}>
                        <input
                          type="text"
                          value={draft.agentSearch}
                          onChange={(e) =>
                            setDraftField('agentSearch', e.target.value)
                          }
                          placeholder="Search by name, ID, or display name…"
                          style={{ ...styles.inputBase, fontSize: '13px' }}
                          autoFocus
                        />
                      </div>
                      <div
                        style={{
                          maxHeight: '260px',
                          overflowY: 'auto',
                          padding: '4px 8px 8px',
                        }}
                      >
                        {loadingAgents ? (
                          <div style={styles.pickerEmpty}>Loading agents…</div>
                        ) : agentLoadError ? (
                          <div
                            style={{ ...styles.pickerEmpty, color: '#ef4444' }}
                          >
                            Error: {agentLoadError}
                          </div>
                        ) : visibleAgents.length === 0 ? (
                          <div style={styles.pickerEmpty}>No agents found</div>
                        ) : (
                          visibleAgents.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              role="option"
                              aria-selected={
                                draft.selectedAgentProfileId === p.id
                              }
                              onClick={() => handleSelectAgent(p)}
                              style={{
                                ...styles.pickerOption,
                                ...(draft.selectedAgentProfileId === p.id
                                  ? styles.pickerOptionActive
                                  : {}),
                              }}
                            >
                              <div
                                style={{ fontWeight: 600, fontSize: '13px' }}
                              >
                                {p.agent_name}
                              </div>
                              <div
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--na-text-3)',
                                }}
                              >
                                {p.display_name || p.agent_id}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Info chips */}
              <div
                style={{
                  gridColumn: '1 / -1',
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                }}
              >
                {[
                  ['Agent Name', selectedAgent?.agent_name],
                  ['Display Name', selectedAgent?.display_name],
                  ['Agent ID', selectedAgent?.agent_id],
                  ['Created By', creatorSummary?.name],
                  ['Creator Role', creatorSummary?.role],
                ].map(([label, value]) => (
                  <div key={label} style={styles.infoChip}>
                    <span style={styles.infoChipLabel}>{label}</span>
                    <span style={styles.infoChipValue}>
                      {value || '—'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Last audit */}
              {lastAudit && (
                <div style={{ gridColumn: '1 / -1', ...styles.lastAuditCard }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      flexWrap: 'wrap',
                      marginBottom: '14px',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'var(--na-accent)',
                          marginBottom: '4px',
                        }}
                      >
                        Last Audit Created
                      </div>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: 'var(--na-text)',
                        }}
                      >
                        {lastAudit.agentName}
                      </div>
                    </div>
                    {lastAudit.qualityScore !== null && (
                      <div
                        style={{
                          fontSize: '22px',
                          fontWeight: 900,
                          color:
                            lastAudit.qualityScore >= 90
                              ? '#10b981'
                              : lastAudit.qualityScore >= 75
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      >
                        {Number(lastAudit.qualityScore).toFixed(2)}%
                      </div>
                    )}
                  </div>
                  <div
                    style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}
                  >
                    {[
                      ['Team', lastAudit.team],
                      ['Case', lastAudit.caseType],
                      ['Date', lastAudit.auditDate],
                    ].map(([k, v]) => (
                      <div key={k} style={styles.lastAuditMeta}>
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--na-text-3)',
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {k}
                        </span>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--na-text)',
                          }}
                        >
                          {v || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Case Type */}
              <div>
                <label style={styles.fieldLabel}>Case Type</label>
                <select
                  value={draft.caseType}
                  onChange={(e) => setDraftField('caseType', e.target.value)}
                  style={styles.selectField}
                >
                  {CASE_TYPES.map((o) => (
                    <option
                      key={o || '__empty__'}
                      value={o}
                      style={{
                        backgroundColor: 'var(--na-option-bg)',
                        color: 'var(--na-option-text)',
                      }}
                    >
                      {o || 'Select Case Type'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Audit Date */}
              <div>
                <label style={styles.fieldLabel}>Audit Date</label>
                <input
                  type="date"
                  value={draft.auditDate}
                  onChange={(e) =>
                    setDraftField('auditDate', e.target.value)
                  }
                  onClick={(e) => openNativeDatePicker(e.currentTarget)}
                  onFocus={(e) => openNativeDatePicker(e.currentTarget)}
                  style={styles.inputBase}
                />
              </div>

              {(draft.team === 'Calls' || draft.team === 'Sales') && (
                <>
                  <div>
                    <label style={styles.fieldLabel}>Order Number</label>
                    <input
                      type="text"
                      value={draft.orderNumber}
                      onChange={(e) =>
                        setDraftField('orderNumber', e.target.value)
                      }
                      style={styles.inputBase}
                    />
                  </div>
                  <div>
                    <label style={styles.fieldLabel}>Phone Number</label>
                    <input
                      type="text"
                      value={draft.phoneNumber}
                      onChange={(e) =>
                        setDraftField('phoneNumber', e.target.value)
                      }
                      style={styles.inputBase}
                    />
                  </div>
                </>
              )}

              {draft.team === 'Tickets' && (
                <div>
                  <label style={styles.fieldLabel}>Ticket ID</label>
                  <input
                    type="text"
                    value={draft.ticketId}
                    onChange={(e) =>
                      setDraftField('ticketId', e.target.value)
                    }
                    style={styles.inputBase}
                  />
                </div>
              )}

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={styles.fieldLabel}>Comments</label>
                <textarea
                  value={draft.comments}
                  onChange={(e) =>
                    setDraftField('comments', e.target.value)
                  }
                  rows={3}
                  style={{ ...styles.inputBase, resize: 'vertical' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scorecards */}
      {draft.team === 'Calls' && (
        <ScorecardPanel
          title="QA Evaluation · Calls"
          metrics={callsMetrics}
          draft={draft}
          onScoreChange={handleScoreChange}
          onMetricCommentChange={handleMetricCommentChange}
          qualityScore={adjustedData.qualityScore}
          hasAutoFail={adjustedData.hasAutoFail}
          scoreNum={scoreNum}
          scoreColor={scoreColor}
        />
      )}
      {draft.team === 'Tickets' && (
        <ScorecardPanel
          title="QA Evaluation · Tickets"
          metrics={ticketsMetrics}
          draft={draft}
          onScoreChange={handleScoreChange}
          onMetricCommentChange={handleMetricCommentChange}
          qualityScore={adjustedData.qualityScore}
          hasAutoFail={adjustedData.hasAutoFail}
          scoreNum={scoreNum}
          scoreColor={scoreColor}
        />
      )}
      {draft.team === 'Sales' && (
        <ScorecardPanel
          title="QA Evaluation · Sales"
          metrics={salesMetrics}
          draft={draft}
          onScoreChange={handleScoreChange}
          onMetricCommentChange={handleMetricCommentChange}
          qualityScore={adjustedData.qualityScore}
          hasAutoFail={adjustedData.hasAutoFail}
          scoreNum={scoreNum}
          scoreColor={scoreColor}
        />
      )}

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          marginTop: '24px',
        }}
      >
        <button
          onClick={handleSave}
          disabled={saving || !draft.team}
          style={{
            ...styles.btnPrimary,
            opacity: !draft.team ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving…' : '✓ Save Audit'}
        </button>
        <button
          type="button"
          onClick={handleClearDraft}
          disabled={saving}
          style={styles.btnSecondary}
        >
          Clear Draft
        </button>
      </div>
    </div>
  );
}

export default memo(NewAuditSupabase);

/* ═════════════════════════════════════════════════════════════
   Module-level styles (no re-allocation per render)
   ═════════════════════════════════════════════════════════════ */

const styles: Record<string, CSSProperties> = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '14px',
    marginBottom: '24px',
  },
  eyebrow: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--na-accent)',
    marginBottom: '6px',
  },
  pageTitle: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 900,
    letterSpacing: '-0.025em',
    color: 'var(--na-text)',
  },
  pageSub: {
    margin: '6px 0 0',
    fontSize: '14px',
    color: 'var(--na-text-2)',
  },
  card: {
    background: 'var(--na-surface)',
    border: '1px solid var(--na-border)',
    borderRadius: '18px',
    boxShadow: 'var(--na-shadow-md)',
  },
  cardInner: { padding: '20px 22px' },
  sectionLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--na-accent)',
    marginBottom: '14px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--na-text-2)',
    marginBottom: '6px',
  },
  inputBase: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '12px',
    border: '1px solid var(--na-border-strong)',
    background: 'var(--na-field-bg)',
    color: 'var(--na-field-text)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  selectField: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '12px',
    border: '1px solid var(--na-border-strong)',
    background: 'var(--na-field-bg)',
    color: 'var(--na-field-text)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage:
      'linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%)',
    backgroundPosition:
      'calc(100% - 18px) calc(50% - 2px), calc(100% - 12px) calc(50% - 2px)',
    backgroundSize: '5px 5px, 5px 5px',
    backgroundRepeat: 'no-repeat',
    colorScheme: 'normal',
  },
  teamBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    borderRadius: '12px',
    border: '1px solid var(--na-border-strong)',
    background: 'var(--na-surface-2)',
    color: 'var(--na-text)',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
    transition: 'all 0.2s ease',
  },
  infoChip: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'var(--na-surface-2)',
    border: '1px solid var(--na-border)',
  },
  infoChipLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--na-text-3)',
  },
  infoChipValue: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--na-text)',
  },
  lastAuditCard: {
    padding: '16px 18px',
    borderRadius: '14px',
    background: 'var(--na-accent-dim)',
    border: '1px solid var(--na-accent-glow)',
  },
  lastAuditMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px 12px',
    borderRadius: '10px',
    background: 'var(--na-surface)',
    border: '1px solid var(--na-border)',
  },
  pickerDropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    background: 'var(--na-surface)',
    border: '1px solid var(--na-border-strong)',
    borderRadius: '16px',
    boxShadow: 'var(--na-shadow-lg)',
    zIndex: 30,
    overflow: 'hidden',
  },
  pickerEmpty: {
    padding: '16px 12px',
    fontSize: '13px',
    color: 'var(--na-text-3)',
    textAlign: 'center',
  },
  pickerOption: {
    width: '100%',
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: '10px',
    border: '1px solid transparent',
    background: 'transparent',
    color: 'var(--na-text)',
    cursor: 'pointer',
    marginBottom: '2px',
    transition: 'background 0.15s',
  },
  pickerOptionActive: {
    background: 'var(--na-accent-dim)',
    border: '1px solid var(--na-accent-glow)',
  },
  metricCard: {
    padding: '14px 16px',
    borderRadius: '14px',
    border: '1px solid var(--na-border)',
    background: 'var(--na-surface)',
    borderLeft: '3px solid transparent',
    transition: 'border-color 0.2s',
  },
  metricName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--na-text)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  metricPts: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--na-text-3)',
    background: 'var(--na-surface-2)',
    padding: '2px 8px',
    borderRadius: '999px',
  },
  lockedBadge: {
    marginTop: '3px',
    fontSize: '11px',
    color: 'var(--na-text-3)',
  },
  qaNoteLabelStyle: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--na-accent)',
    marginBottom: '6px',
  },
  qaTextarea: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: '12px',
    border: '1px solid var(--na-border-strong)',
    background: 'var(--na-field-bg)',
    color: 'var(--na-field-text)',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontSize: '13px',
  },
  autoFailBanner: {
    marginTop: '16px',
    padding: '14px 18px',
    borderRadius: '14px',
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.24)',
    color: '#fca5a5',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  scoreSummaryCard: {
    marginTop: '18px',
    padding: '20px 24px',
    borderRadius: '18px',
    background: 'var(--na-surface-2)',
    border: '1px solid var(--na-border-strong)',
  },
  btnPrimary: {
    padding: '13px 22px',
    borderRadius: '13px',
    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    color: '#fff',
    border: '1px solid rgba(96,165,250,0.3)',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 6px 20px rgba(37,99,235,0.35)',
    letterSpacing: '0.01em',
  },
  btnSecondary: {
    padding: '13px 18px',
    borderRadius: '13px',
    background: 'var(--na-surface)',
    color: 'var(--na-text)',
    border: '1px solid var(--na-border-strong)',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  },
  errorBanner: {
    marginBottom: '16px',
    padding: '13px 16px',
    borderRadius: '13px',
    background: 'rgba(239,68,68,0.10)',
    border: '1px solid rgba(239,68,68,0.24)',
    color: '#fca5a5',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  successBanner: {
    marginBottom: '16px',
    padding: '13px 16px',
    borderRadius: '13px',
    background: 'rgba(16,185,129,0.10)',
    border: '1px solid rgba(16,185,129,0.24)',
    color: '#6ee7b7',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
};
