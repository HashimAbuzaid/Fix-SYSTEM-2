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
  Calls: '#2A9D8F',
  Tickets: '#7C6FF7',
  Sales: '#34A98F',
};

/* ═════════════════════════════════════════════════════════════
   Pure helpers
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
    else if (scored && result === 'Borderline') {
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
    /* unsupported browser */
  }
}

function getResultColor(result: string): string {
  if (result === 'Pass') return '#34D399';
  if (result === 'Borderline') return '#E9A84C';
  if (result === 'Fail') return '#E57373';
  if (result === 'Auto-Fail') return '#E57373';
  if (result === 'N/A') return 'var(--fg-muted)';
  if (result === 'Yes') return '#34D399';
  if (result === 'No') return '#E57373';
  return 'var(--fg-muted)';
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#34D399';
  if (score >= 75) return '#E9A84C';
  return '#E57373';
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
  const color = getScoreColor(pct);

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
        stroke="var(--border)"
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
            'stroke-dashoffset 0.6s var(--ease-out), stroke 0.3s ease',
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
    <div style={{ marginTop: 28 }}>
      <div className="da-input-label">{title}</div>

      <div style={{ display: 'grid', gap: 10 }}>
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
              className="da-card-stat"
              style={{
                borderLeft: isMeaningful
                  ? `3px solid ${resultColor}`
                  : '3px solid transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: 'var(--fg-default)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    {metric.name}

                    {countsTowardScore(metric) && (
                      <span className="da-badge da-badge-default">
                        {metric.pass} pts
                      </span>
                    )}
                  </div>

                  {isLockedToNA(metric.name) && (
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: 'var(--fg-muted)',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      Locked · N/A
                    </div>
                  )}
                </div>

                <div style={{ minWidth: 180 }}>
                  <select
                    value={metricValue}
                    onChange={(e) => onScoreChange(metric.name, e.target.value)}
                    disabled={isLockedToNA(metric.name)}
                    aria-label={`${metric.name} result`}
                    className="da-select"
                    style={{
                      borderColor: isMeaningful ? `${resultColor}66` : undefined,
                      color: isMeaningful ? resultColor : undefined,
                    }}
                  >
                    {metricOptions.map((option) => (
                      <option key={option || '__empty__'} value={option}>
                        {option || 'Select answer'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {showMetricComment && (
                <div style={{ marginTop: 10 }}>
                  <div className="da-input-label">QA note for agent</div>

                  <textarea
                    value={draft.metricComments[metric.name] || ''}
                    onChange={(e) =>
                      onMetricCommentChange(metric.name, e.target.value)
                    }
                    rows={2}
                    placeholder="Brief explanation for this result…"
                    className="da-textarea"
                    aria-label={`QA note for ${metric.name}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasAutoFail && (
        <div
          className="da-card"
          role="alert"
          style={{
            marginTop: 16,
            background: 'var(--surface-danger)',
            borderColor: 'var(--border-danger)',
            color: 'var(--text-danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 500,
            fontFamily: 'var(--font-ui)',
          }}
        >
          <span aria-hidden="true">⚠</span>
          <span>Auto-Fail triggered — Final score: 0.00%</span>
        </div>
      )}

      <div className="da-card-elevated" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              position: 'relative',
              width: 80,
              height: 80,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <ScoreGauge score={scoreNum} size={80} />

            <div
              style={{
                position: 'absolute',
                fontSize: 13,
                fontWeight: 600,
                color: scoreColor,
                fontFamily: 'var(--font-ui)',
              }}
            >
              {qualityScore}%
            </div>
          </div>

          <div>
            <div className="da-input-label">Quality Score</div>

            <div
              style={{
                fontSize: 36,
                fontWeight: 600,
                color: scoreColor,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                fontFamily: 'var(--font-ui)',
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

  const agentPickerRef = useRef<HTMLDivElement | null>(null);

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

        if (!shouldShowMetricComment(value)) {
          delete nextMetricComments[metricName];
        }

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
  }, [
    draft,
    selectedAgent,
    adjustedData,
    setDraft,
    loadCurrentCreatorSummary,
    loadLastAuditSummary,
  ]);

  const scoreNum = parseFloat(adjustedData.qualityScore);
  const scoreColor = getScoreColor(scoreNum);

  const handleClearDraft = useCallback(() => {
    setIsAgentPickerOpen(false);
    setDraft(createEmptyDraft(draft.team));
    setErrorMessage('');
    setSuccessMessage('Draft cleared.');
  }, [draft.team, setDraft]);

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <div className="da-input-label">Audit Workspace</div>

          <h2 style={styles.pageTitle}>New Audit</h2>

          <p style={styles.pageSub}>
            Create a Detroit Axle QA audit using the live agent directory.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefreshAgents}
          className="da-btn da-btn-secondary"
        >
          ↻ Refresh Agents
        </button>
      </div>

      {errorMessage && (
        <div
          className="da-card"
          role="alert"
          style={{
            marginBottom: 16,
            background: 'var(--surface-danger)',
            borderColor: 'var(--border-danger)',
            color: 'var(--text-danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 500,
            fontFamily: 'var(--font-ui)',
          }}
        >
          <span aria-hidden="true">✕</span>
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          className="da-card"
          role="status"
          style={{
            marginBottom: 16,
            background: 'var(--surface-success)',
            borderColor: 'var(--border-success)',
            color: 'var(--text-success)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontWeight: 500,
            fontFamily: 'var(--font-ui)',
          }}
        >
          <span aria-hidden="true">✓</span>
          {successMessage}
        </div>
      )}

      <div className="da-card-elevated">
        <div className="da-input-label">Select Team</div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
          role="radiogroup"
          aria-label="Select team"
        >
          {TEAMS.map((team) => {
            const active = draft.team === team;
            const accent = TEAM_ACCENTS[team] ?? 'var(--accent)';

            return (
              <button
                key={team}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTeamAndReset(team)}
                className={`da-btn ${active ? 'da-btn-primary' : 'da-btn-secondary'}`}
                style={
                  active
                    ? {
                        background: accent,
                        borderColor: accent,
                      }
                    : undefined
                }
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: active ? 'rgba(255,255,255,0.72)' : accent,
                    flexShrink: 0,
                  }}
                />
                {team}
              </button>
            );
          })}
        </div>
      </div>

      {draft.team && (
        <div className="da-card-elevated" style={{ marginTop: 12 }}>
          <div style={styles.formGrid}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="da-input-label">Agent</label>

              <div ref={agentPickerRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  aria-expanded={isAgentPickerOpen}
                  aria-haspopup="listbox"
                  onClick={() => setIsAgentPickerOpen((p) => !p)}
                  className="da-input"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    textAlign: 'left',
                    height: 38,
                    borderColor: selectedAgent
                      ? 'var(--accent-border)'
                      : undefined,
                  }}
                >
                  <span
                    style={{
                      color: selectedAgent
                        ? 'var(--fg-default)'
                        : 'var(--fg-subtle)',
                    }}
                  >
                    {selectedAgent
                      ? getAgentLabel(selectedAgent)
                      : 'Select an agent…'}
                  </span>

                  <span
                    style={{
                      color: 'var(--fg-muted)',
                      fontSize: 11,
                      transition: 'transform 0.2s',
                      transform: isAgentPickerOpen ? 'rotate(180deg)' : 'none',
                    }}
                  >
                    ▼
                  </span>
                </button>

                {isAgentPickerOpen && (
                  <div
                    className="da-card-elevated"
                    role="listbox"
                    aria-label="Agent list"
                    style={styles.pickerDropdown}
                  >
                    <div style={{ padding: '10px 10px 6px' }}>
                      <input
                        type="text"
                        value={draft.agentSearch}
                        onChange={(e) =>
                          setDraftField('agentSearch', e.target.value)
                        }
                        placeholder="Search by name, ID, or display name…"
                        className="da-input"
                        autoFocus
                      />
                    </div>

                    <div
                      style={{
                        maxHeight: 260,
                        overflowY: 'auto',
                        padding: '4px 8px 8px',
                      }}
                    >
                      {loadingAgents ? (
                        <div style={styles.pickerEmpty}>Loading agents…</div>
                      ) : agentLoadError ? (
                        <div
                          style={{
                            ...styles.pickerEmpty,
                            color: 'var(--text-danger)',
                          }}
                        >
                          Error: {agentLoadError}
                        </div>
                      ) : visibleAgents.length === 0 ? (
                        <div style={styles.pickerEmpty}>No agents found</div>
                      ) : (
                        visibleAgents.map((profile) => (
                          <button
                            key={profile.id}
                            type="button"
                            role="option"
                            aria-selected={
                              draft.selectedAgentProfileId === profile.id
                            }
                            onClick={() => handleSelectAgent(profile)}
                            className="da-btn da-btn-ghost"
                            style={{
                              width: '100%',
                              justifyContent: 'flex-start',
                              height: 'auto',
                              padding: '10px 12px',
                              marginBottom: 2,
                              background:
                                draft.selectedAgentProfileId === profile.id
                                  ? 'var(--accent-dim)'
                                  : undefined,
                              borderColor:
                                draft.selectedAgentProfileId === profile.id
                                  ? 'var(--accent-border)'
                                  : undefined,
                            }}
                          >
                            <span>
                              <span
                                style={{
                                  display: 'block',
                                  fontWeight: 500,
                                  fontSize: 13,
                                  color: 'var(--fg-default)',
                                }}
                              >
                                {profile.agent_name}
                              </span>

                              <span
                                style={{
                                  display: 'block',
                                  fontSize: 11,
                                  color: 'var(--fg-muted)',
                                  marginTop: 2,
                                }}
                              >
                                {profile.display_name || profile.agent_id}
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
                        <div
              style={{
                gridColumn: '1 / -1',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              {[
                ['Agent Name', selectedAgent?.agent_name],
                ['Display Name', selectedAgent?.display_name],
                ['Agent ID', selectedAgent?.agent_id],
                ['Created By', creatorSummary?.name],
                ['Creator Role', creatorSummary?.role],
              ].map(([label, value]) => (
                <div key={label} className="da-card-stat">
                  <div className="da-input-label" style={{ marginBottom: 4 }}>
                    {label}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--fg-default)',
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    {value || '—'}
                  </div>
                </div>
              ))}
            </div>

            {lastAudit && (
              <div
                className="da-card"
                style={{
                  gridColumn: '1 / -1',
                  background: 'var(--accent-dim)',
                  borderColor: 'var(--accent-border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <div className="da-input-label">Last Audit Created</div>

                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 500,
                        color: 'var(--fg-default)',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      {lastAudit.agentName}
                    </div>
                  </div>

                  {lastAudit.qualityScore !== null && (
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 600,
                        color: getScoreColor(lastAudit.qualityScore),
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      {Number(lastAudit.qualityScore).toFixed(2)}%
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {[
                    ['Team', lastAudit.team],
                    ['Case', lastAudit.caseType],
                    ['Date', lastAudit.auditDate],
                  ].map(([key, value]) => (
                    <div key={key} className="da-card-stat">
                      <div className="da-input-label" style={{ marginBottom: 4 }}>
                        {key}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: 'var(--fg-default)',
                          fontFamily: 'var(--font-ui)',
                        }}
                      >
                        {value || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="da-input-label">Case Type</label>

              <select
                value={draft.caseType}
                onChange={(e) => setDraftField('caseType', e.target.value)}
                className="da-select"
              >
                {CASE_TYPES.map((option) => (
                  <option key={option || '__empty__'} value={option}>
                    {option || 'Select Case Type'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="da-input-label">Audit Date</label>

              <input
                type="date"
                value={draft.auditDate}
                onChange={(e) => setDraftField('auditDate', e.target.value)}
                onClick={(e) => openNativeDatePicker(e.currentTarget)}
                onFocus={(e) => openNativeDatePicker(e.currentTarget)}
                className="da-input"
              />
            </div>

            {(draft.team === 'Calls' || draft.team === 'Sales') && (
              <>
                <div>
                  <label className="da-input-label">Order Number</label>

                  <input
                    type="text"
                    value={draft.orderNumber}
                    onChange={(e) =>
                      setDraftField('orderNumber', e.target.value)
                    }
                    className="da-input"
                  />
                </div>

                <div>
                  <label className="da-input-label">Phone Number</label>

                  <input
                    type="text"
                    value={draft.phoneNumber}
                    onChange={(e) =>
                      setDraftField('phoneNumber', e.target.value)
                    }
                    className="da-input"
                  />
                </div>
              </>
            )}

            {draft.team === 'Tickets' && (
              <div>
                <label className="da-input-label">Ticket ID</label>

                <input
                  type="text"
                  value={draft.ticketId}
                  onChange={(e) => setDraftField('ticketId', e.target.value)}
                  className="da-input"
                />
              </div>
            )}

            <div style={{ gridColumn: '1 / -1' }}>
              <label className="da-input-label">Comments</label>

              <textarea
                value={draft.comments}
                onChange={(e) => setDraftField('comments', e.target.value)}
                rows={3}
                className="da-textarea"
              />
            </div>
          </div>
        </div>
      )}

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

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          marginTop: 24,
        }}
      >
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !draft.team}
          className="da-btn da-btn-primary"
        >
          {saving ? 'Saving…' : '✓ Save Audit'}
        </button>

        <button
          type="button"
          onClick={handleClearDraft}
          disabled={saving}
          className="da-btn da-btn-secondary"
        >
          Clear Draft
        </button>
      </div>
    </div>
  );
}

export default memo(NewAuditSupabase);

/* ═════════════════════════════════════════════════════════════
   Module-level styles
   ═════════════════════════════════════════════════════════════ */

const styles: Record<string, CSSProperties> = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  pageTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 500,
    letterSpacing: '-0.025em',
    color: 'var(--fg-default)',
    fontFamily: 'var(--font-ui)',
  },
  pageSub: {
    margin: '6px 0 0',
    fontSize: 14,
    color: 'var(--fg-muted)',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
  },
  pickerDropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    zIndex: 30,
    overflow: 'hidden',
    padding: 0,
  },
  pickerEmpty: {
    padding: '16px 12px',
    fontSize: 13,
    color: 'var(--fg-muted)',
    textAlign: 'center',
  },
};