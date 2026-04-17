import { useMemo, type CSSProperties } from 'react';

type TeamName = 'Calls' | 'Tickets' | 'Sales';

type AgentProfile = {
  id: string;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
  email?: string;
};

type ScoreDetail = {
  metric: string;
  result: string;
  pass: number;
  borderline: number;
  adjustedWeight?: number;
  earned: number;
  counts_toward_score?: boolean;
  metric_comment?: string | null;
};

type AuditItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName;
  case_type: string;
  audit_date: string;
  quality_score: number;
  comments: string | null;
  score_details: ScoreDetail[];
  shared_with_agent?: boolean;
  shared_at?: string | null;
};

type MonitoringItem = {
  id: string;
  order_number: string;
  comment: string;
  agent_id: string;
  agent_name: string;
  display_name: string | null;
  team: TeamName;
  created_at: string;
  status: 'active' | 'resolved';
};

type TeamRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  calls_count?: number;
  tickets_count?: number;
  amount?: number;
  call_date?: string;
  ticket_date?: string;
  sale_date?: string;
  date_to?: string | null;
  notes: string | null;
};

type AgentFeedback = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName;
  qa_name: string;
  feedback_type: 'Coaching' | 'Audit Feedback' | 'Warning' | 'Follow-up';
  subject: string;
  feedback_note: string;
  action_plan?: string | null;
  due_date: string | null;
  status: 'Open' | 'In Progress' | 'Closed';
  created_at: string;
  acknowledged_by_agent?: boolean | null;
};

type ReviewStage =
  | 'QA Shared'
  | 'Acknowledged'
  | 'Agent Responded'
  | 'Supervisor Reviewed'
  | 'Follow-up'
  | 'Closed';

type RiskLevel = 'Critical' | 'High' | 'Watch' | 'Healthy';

type MetricCell = {
  metric: string;
  total: number;
  flagged: number;
  rate: number;
};

type HeatmapRow = {
  agentKey: string;
  label: string;
  averageQuality: number | null;
  cells: MetricCell[];
};

type LowPerformerRow = {
  agentKey: string;
  label: string;
  averageQuality: number | null;
  auditsCount: number;
  flaggedCount: number;
  procedureFlags: number;
  openCoaching: number;
  overdueCoaching: number;
  activeMonitoring: number;
  workloadTotal: number;
  riskScore: number;
  riskLevel: RiskLevel;
  trendDelta: number | null;
  reasons: string[];
};

type OverdueCoachingRow = {
  id: string;
  label: string;
  subject: string;
  dueDate: string | null;
  daysOverdue: number;
  reviewStage: ReviewStage;
  status: string;
  acknowledged: boolean;
};

type RiskFlagRow = {
  agentKey: string;
  label: string;
  riskLevel: RiskLevel;
  reasons: string[];
  averageQuality: number | null;
  procedureFlags: number;
  overdueCoaching: number;
  activeMonitoring: number;
};


type Props = {
  currentTeam: TeamName;
  agents: AgentProfile[];
  audits: AuditItem[];
  feedbackItems: AgentFeedback[];
  monitoringItems: MonitoringItem[];
  records?: TeamRecord[];
  selectedAgent?: AgentProfile | null;
};

const FLAG_RESULTS = new Set(['Borderline', 'Fail', 'Auto-Fail']);
const MAX_HEATMAP_METRICS = 8;
const COACHING_PLAN_LABELS = [
  'Priority',
  'Action Plan',
  'Justification',
  'Review Stage',
  'Agent Comment',
  'Supervisor Review',
  'Follow-up Outcome',
  'Resolution Note',
] as const;

function normalizeAgentId(value?: string | null) {
  return String(value || '').trim().replace(/\.0+$/, '');
}

function normalizeAgentName(value?: string | null) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildAgentKey(agentId?: string | null, agentName?: string | null) {
  const id = normalizeAgentId(agentId);
  const name = normalizeAgentName(agentName);
  return id ? `id:${id}` : `name:${name}`;
}

function getAgentLabel(profile: AgentProfile) {
  return profile.display_name
    ? `${profile.agent_name} - ${profile.display_name}`
    : `${profile.agent_name} - ${profile.agent_id || '-'}`;
}

function getTodayStart() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function getDaysOverdue(value?: string | null) {
  const raw = String(value || '').slice(0, 10);
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = getTodayStart().getTime() - date.getTime();
  return Math.floor(diffMs / 86400000);
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundScore(value: number | null) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(2));
}


function getMetricLabel(detail: ScoreDetail) {
  return String(detail.metric || '').trim() || 'Unknown';
}

function isFlagged(detail: ScoreDetail) {
  return FLAG_RESULTS.has(String(detail.result || ''));
}

function getProcedureDetail(audit: AuditItem) {
  return (audit.score_details || []).find(
    (detail) => getMetricLabel(detail) === 'Procedure' && isFlagged(detail)
  ) || null;
}

function readStructuredSection(
  rawValue: string,
  label: (typeof COACHING_PLAN_LABELS)[number]
) {
  const raw = String(rawValue || '');
  const startToken = `${label}:\n`;
  const startIndex = raw.indexOf(startToken);
  if (startIndex === -1) return '';

  const contentStart = startIndex + startToken.length;
  let contentEnd = raw.length;

  COACHING_PLAN_LABELS.forEach((nextLabel) => {
    if (nextLabel === label) return;
    const nextToken = `\n${nextLabel}:\n`;
    const nextIndex = raw.indexOf(nextToken, contentStart);
    if (nextIndex !== -1 && nextIndex < contentEnd) {
      contentEnd = nextIndex;
    }
  });

  return raw.slice(contentStart, contentEnd).trim();
}

function normalizeReviewStage(value?: string | null): ReviewStage {
  if (
    value === 'QA Shared' ||
    value === 'Acknowledged' ||
    value === 'Agent Responded' ||
    value === 'Supervisor Reviewed' ||
    value === 'Follow-up' ||
    value === 'Closed'
  ) {
    return value;
  }
  return 'QA Shared';
}

function parseCoachingPlan(value?: string | null) {
  const raw = String(value || '').trim();
  const hasStructured = COACHING_PLAN_LABELS.some((label) =>
    raw.includes(`${label}:`)
  );

  return {
    reviewStage: normalizeReviewStage(readStructuredSection(raw, 'Review Stage')),
    agentComment: readStructuredSection(raw, 'Agent Comment'),
    supervisorReview: readStructuredSection(raw, 'Supervisor Review'),
    actionPlan: hasStructured ? readStructuredSection(raw, 'Action Plan') : raw,
  };
}

function getFeedbackAgentLabel(item: AgentFeedback, profiles: AgentProfile[]) {
  const key = buildAgentKey(item.agent_id, item.agent_name);
  const profile = profiles.find(
    (entry) => buildAgentKey(entry.agent_id, entry.agent_name) === key
  );

  return profile ? getAgentLabel(profile) : `${item.agent_name} - ${item.agent_id || '-'}`;
}

function buildProcedureHotspots(audits: AuditItem[]) {
  const counts = new Map<
    string,
    { count: number; borderlineCount: number; failCount: number; autoFailCount: number }
  >();

  audits.forEach((audit) => {
    const detail = getProcedureDetail(audit);
    if (!detail) return;

    const caseType = String(audit.case_type || 'Unknown').trim() || 'Unknown';
    const current = counts.get(caseType) || {
      count: 0,
      borderlineCount: 0,
      failCount: 0,
      autoFailCount: 0,
    };

    current.count += 1;
    if (detail.result === 'Borderline') current.borderlineCount += 1;
    if (detail.result === 'Fail') current.failCount += 1;
    if (detail.result === 'Auto-Fail') current.autoFailCount += 1;

    counts.set(caseType, current);
  });

  return Array.from(counts.entries())
    .map(([caseType, value]) => ({
      caseType,
      count: value.count,
      borderlineCount: value.borderlineCount,
      failCount: value.failCount,
      autoFailCount: value.autoFailCount,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.failCount !== a.failCount) return b.failCount - a.failCount;
      return a.caseType.localeCompare(b.caseType);
    })
    .slice(0, 6);
}

function getMetricUniverse(audits: AuditItem[]) {
  const counts = new Map<string, number>();

  audits.forEach((audit) => {
    (audit.score_details || []).forEach((detail) => {
      const metric = getMetricLabel(detail);
      counts.set(metric, (counts.get(metric) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      if (a[0] === 'Procedure') return -1;
      if (b[0] === 'Procedure') return 1;
      return a[0].localeCompare(b[0]);
    })
    .map(([metric]) => metric)
    .slice(0, MAX_HEATMAP_METRICS);
}

function getHeatCellTone(rate: number) {
  if (rate >= 0.5) return 'var(--sd-critical-bg, rgba(220,38,38,0.16))';
  if (rate >= 0.3) return 'var(--sd-warning-bg, rgba(245,158,11,0.16))';
  if (rate > 0) return 'var(--sd-watch-bg, rgba(59,130,246,0.14))';
  return 'var(--sd-good-bg, rgba(22,163,74,0.12))';
}

function getHeatCellText(rate: number) {
  if (rate >= 0.5) return 'var(--sd-critical-text, #fecaca)';
  if (rate >= 0.3) return 'var(--sd-warning-text, #fde68a)';
  if (rate > 0) return 'var(--sd-watch-text, #bfdbfe)';
  return 'var(--sd-good-text, #bbf7d0)';
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 70) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 28) return 'Watch';
  return 'Healthy';
}

function getRiskTone(level: RiskLevel) {
  if (level === 'Critical') {
    return {
      background: 'var(--sd-critical-bg, rgba(220,38,38,0.16))',
      color: 'var(--sd-critical-text, #fecaca)',
      border: '1px solid rgba(248,113,113,0.22)',
    };
  }

  if (level === 'High') {
    return {
      background: 'var(--sd-warning-bg, rgba(245,158,11,0.16))',
      color: 'var(--sd-warning-text, #fde68a)',
      border: '1px solid rgba(251,191,36,0.22)',
    };
  }

  if (level === 'Watch') {
    return {
      background: 'var(--sd-watch-bg, rgba(59,130,246,0.14))',
      color: 'var(--sd-watch-text, #bfdbfe)',
      border: '1px solid rgba(147,197,253,0.22)',
    };
  }

  return {
    background: 'var(--sd-good-bg, rgba(22,163,74,0.12))',
    color: 'var(--sd-good-text, #bbf7d0)',
    border: '1px solid rgba(74,222,128,0.22)',
  };
}

function formatDelta(value: number | null) {
  if (value == null) return '-';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)} pts`;
}

function getAverageQualityForAudits(audits: AuditItem[]) {
  return roundScore(
    average(audits.map((item) => Number(item.quality_score)).filter((value) => Number.isFinite(value)))
  );
}

function getMetricCount(audits: AuditItem[]) {
  return audits.reduce((sum, audit) => {
    return (
      sum +
      (audit.score_details || []).filter((detail) => isFlagged(detail)).length
    );
  }, 0);
}

export default function SupervisorTeamDashboard({
  currentTeam,
  agents,
  audits,
  feedbackItems,
  monitoringItems,
  records = [],
  selectedAgent = null,
}: Props) {
  const teamAgents = useMemo(
    () => agents.filter((agent) => agent.team === currentTeam),
    [agents, currentTeam]
  );

  const selectedAgentKey = selectedAgent
    ? buildAgentKey(selectedAgent.agent_id, selectedAgent.agent_name)
    : null;

  const currentTeamAudits = useMemo(
    () => audits.filter((audit) => audit.team === currentTeam),
    [audits, currentTeam]
  );

  const currentTeamFeedback = useMemo(
    () => feedbackItems.filter((item) => item.team === currentTeam),
    [feedbackItems, currentTeam]
  );

  const currentTeamMonitoring = useMemo(
    () =>
      monitoringItems.filter(
        (item) => item.team === currentTeam && item.status === 'active'
      ),
    [monitoringItems, currentTeam]
  );

  const agentAuditMap = useMemo(() => {
    const map = new Map<string, AuditItem[]>();
    currentTeamAudits.forEach((audit) => {
      const key = buildAgentKey(audit.agent_id, audit.agent_name);
      const current = map.get(key) || [];
      current.push(audit);
      map.set(key, current);
    });

    map.forEach((value) => {
      value.sort((a, b) => String(b.audit_date).localeCompare(String(a.audit_date)));
    });

    return map;
  }, [currentTeamAudits]);

  const agentFeedbackMap = useMemo(() => {
    const map = new Map<string, AgentFeedback[]>();
    currentTeamFeedback.forEach((item) => {
      const key = buildAgentKey(item.agent_id, item.agent_name);
      const current = map.get(key) || [];
      current.push(item);
      map.set(key, current);
    });

    return map;
  }, [currentTeamFeedback]);

  const agentMonitoringMap = useMemo(() => {
    const map = new Map<string, MonitoringItem[]>();
    currentTeamMonitoring.forEach((item) => {
      const key = buildAgentKey(item.agent_id, item.agent_name);
      const current = map.get(key) || [];
      current.push(item);
      map.set(key, current);
    });

    return map;
  }, [currentTeamMonitoring]);

  const agentWorkloadMap = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((record) => {
      const key = buildAgentKey(record.agent_id, record.agent_name);
      const amount = Number(
        record.calls_count ?? record.tickets_count ?? record.amount ?? 0
      );
      map.set(key, (map.get(key) || 0) + amount);
    });
    return map;
  }, [records]);

  const metricUniverse = useMemo(
    () => getMetricUniverse(currentTeamAudits),
    [currentTeamAudits]
  );

  const heatmapRows = useMemo<HeatmapRow[]>(() => {
    return teamAgents.map((agent) => {
      const key = buildAgentKey(agent.agent_id, agent.agent_name);
      const agentAudits = agentAuditMap.get(key) || [];
      const cells = metricUniverse.map((metric) => {
        let total = 0;
        let flagged = 0;

        agentAudits.forEach((audit) => {
          (audit.score_details || []).forEach((detail) => {
            if (getMetricLabel(detail) !== metric) return;
            total += 1;
            if (isFlagged(detail)) flagged += 1;
          });
        });

        return {
          metric,
          total,
          flagged,
          rate: total > 0 ? flagged / total : 0,
        };
      });

      return {
        agentKey: key,
        label: getAgentLabel(agent),
        averageQuality: getAverageQualityForAudits(agentAudits),
        cells,
      };
    });
  }, [teamAgents, agentAuditMap, metricUniverse]);

  const lowPerformers = useMemo<LowPerformerRow[]>(() => {
    return teamAgents
      .map((agent) => {
        const agentKey = buildAgentKey(agent.agent_id, agent.agent_name);
        const agentAudits = agentAuditMap.get(agentKey) || [];
        const agentFeedback = agentFeedbackMap.get(agentKey) || [];
        const agentMonitoring = agentMonitoringMap.get(agentKey) || [];
        const recentAudits = agentAudits.slice(0, 8);
        const latestFour = recentAudits.slice(0, 4);
        const previousFour = recentAudits.slice(4, 8);

        const averageQuality = getAverageQualityForAudits(recentAudits);
        const latestAverage = getAverageQualityForAudits(latestFour);
        const previousAverage = getAverageQualityForAudits(previousFour);
        const trendDelta =
          latestAverage != null && previousAverage != null
            ? roundScore(latestAverage - previousAverage)
            : null;

        const flaggedCount = getMetricCount(recentAudits);
        const procedureFlags = recentAudits.filter((audit) => getProcedureDetail(audit)).length;

        const openCoaching = agentFeedback.filter((item) => item.status !== 'Closed').length;
        const overdueCoaching = agentFeedback.filter((item) => {
          if (item.status === 'Closed') return false;
          const parsed = parseCoachingPlan(item.action_plan);
          const daysOverdue = getDaysOverdue(item.due_date);
          return (daysOverdue != null && daysOverdue > 0) || (
            parsed.reviewStage === 'Agent Responded' &&
            !parsed.supervisorReview.trim()
          );
        }).length;

        const activeMonitoring = agentMonitoring.length;
        const workloadTotal = Math.round(agentWorkloadMap.get(agentKey) || 0);

        let riskScore = 0;
        if (averageQuality != null) {
          if (averageQuality < 80) riskScore += 36;
          else if (averageQuality < 88) riskScore += 20;
          else if (averageQuality < 92) riskScore += 8;
        }

        riskScore += Math.min(flaggedCount * 3, 21);
        riskScore += Math.min(procedureFlags * 7, 21);
        riskScore += Math.min(overdueCoaching * 14, 28);
        riskScore += Math.min(activeMonitoring * 16, 24);

        if (trendDelta != null && trendDelta < -3) riskScore += 10;
        else if (trendDelta != null && trendDelta < 0) riskScore += 4;

        const reasons: string[] = [];
        if (averageQuality != null && averageQuality < 80) reasons.push('Average quality below 80%');
        else if (averageQuality != null && averageQuality < 88) reasons.push('Average quality below 88%');
        if (procedureFlags >= 2) reasons.push('Repeated Procedure flags');
        if (flaggedCount >= 6) reasons.push('High borderline/fail volume');
        if (overdueCoaching > 0) reasons.push('Overdue coaching');
        if (activeMonitoring > 0) reasons.push('Active monitoring alert');
        if (trendDelta != null && trendDelta < -3) reasons.push('Downward quality trend');

        return {
          agentKey,
          label: getAgentLabel(agent),
          averageQuality,
          auditsCount: recentAudits.length,
          flaggedCount,
          procedureFlags,
          openCoaching,
          overdueCoaching,
          activeMonitoring,
          workloadTotal,
          riskScore,
          riskLevel: getRiskLevel(riskScore),
          trendDelta,
          reasons,
        };
      })
      .sort((a, b) => {
        if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
        if ((a.averageQuality ?? 100) !== (b.averageQuality ?? 100)) {
          return (a.averageQuality ?? 100) - (b.averageQuality ?? 100);
        }
        return a.label.localeCompare(b.label);
      });
  }, [teamAgents, agentAuditMap, agentFeedbackMap, agentMonitoringMap, agentWorkloadMap]);

  const overdueCoaching = useMemo<OverdueCoachingRow[]>(() => {
    return currentTeamFeedback.flatMap((item) => {
      if (item.status === 'Closed') return [];

      const parsed = parseCoachingPlan(item.action_plan);
      const daysOverdue = getDaysOverdue(item.due_date);
      const needsSupervisorReview =
        parsed.reviewStage === 'Agent Responded' &&
        !parsed.supervisorReview.trim();

      if ((daysOverdue == null || daysOverdue <= 0) && !needsSupervisorReview) {
        return [];
      }

      const row: OverdueCoachingRow = {
        id: item.id,
        label: getFeedbackAgentLabel(item, teamAgents),
        subject: item.subject,
        dueDate: item.due_date,
        daysOverdue: Math.max(daysOverdue || 0, needsSupervisorReview ? 1 : 0),
        reviewStage: parsed.reviewStage,
        status: item.status,
        acknowledged: Boolean(item.acknowledged_by_agent),
      };

      return [row];
    }).sort((a, b) => {
      if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
      return a.label.localeCompare(b.label);
    });
  }, [currentTeamFeedback, teamAgents]);

  const riskFlags = useMemo<RiskFlagRow[]>(() => {
    return lowPerformers
      .filter((item) => item.riskLevel !== 'Healthy')
      .map((item) => ({
        agentKey: item.agentKey,
        label: item.label,
        riskLevel: item.riskLevel,
        reasons: item.reasons.length > 0 ? item.reasons : ['Needs supervisor review'],
        averageQuality: item.averageQuality,
        procedureFlags: item.procedureFlags,
        overdueCoaching: item.overdueCoaching,
        activeMonitoring: item.activeMonitoring,
      }));
  }, [lowPerformers]);

  const procedureHotspots = useMemo(
    () => buildProcedureHotspots(currentTeamAudits),
    [currentTeamAudits]
  );

  const teamAverageQuality = getAverageQualityForAudits(currentTeamAudits);
  const teamLatestAverage = getAverageQualityForAudits(currentTeamAudits.slice(0, 4));
  const teamPreviousAverage = getAverageQualityForAudits(currentTeamAudits.slice(4, 8));
  const teamTrendDelta =
    teamLatestAverage != null && teamPreviousAverage != null
      ? roundScore(teamLatestAverage - teamPreviousAverage)
      : null;

  const totalOpenCoaching = currentTeamFeedback.filter((item) => item.status !== 'Closed').length;
  const totalActiveMonitoring = currentTeamMonitoring.length;
  const atRiskCount = riskFlags.filter((item) => item.riskLevel === 'Critical' || item.riskLevel === 'High').length;
  const focusedAgentNote = selectedAgentKey
    ? lowPerformers.find((item) => item.agentKey === selectedAgentKey)?.label || null
    : null;

  return (
    <section style={rootStyle}>
      <div style={heroPanelStyle}>
        <div>
          <div style={eyebrowStyle}>Team Dashboard</div>
          <h3 style={titleStyle}>{currentTeam} Supervisor Team Dashboard</h3>
          <p style={subtitleStyle}>
            Team heatmap, low performers, overdue coaching, risk flags, and procedure hotspots in one place.
          </p>
          {focusedAgentNote ? (
            <div style={focusedAgentStyle}>Focused agent filter: {focusedAgentNote}</div>
          ) : null}
        </div>
      </div>

      <div style={pulseGridStyle}>
        <PulseCard
          title="Team Avg Quality"
          value={teamAverageQuality != null ? `${teamAverageQuality.toFixed(2)}%` : '-'}
          helper={`Trend: ${formatDelta(teamTrendDelta)}`}
        />
        <PulseCard
          title="Agents At Risk"
          value={String(atRiskCount)}
          helper={`${riskFlags.length} total with active flags`}
        />
        <PulseCard
          title="Overdue Coaching"
          value={String(overdueCoaching.length)}
          helper={`${totalOpenCoaching} open coaching items`}
        />
        <PulseCard
          title="Active Monitoring"
          value={String(totalActiveMonitoring)}
          helper="Operational alerts still active"
        />
        <PulseCard
          title="Procedure Hotspot"
          value={procedureHotspots[0]?.caseType || 'None'}
          helper={
            procedureHotspots[0]
              ? `${procedureHotspots[0].count} flagged procedure cases`
              : 'No repeated procedure hotspot'
          }
        />
      </div>

      <Section title="Team Heatmap" subtitle="Issue rate by agent and audit metric. Darker cells mean more Borderline / Fail / Auto-Fail pressure.">
        {heatmapRows.length === 0 || metricUniverse.length === 0 ? (
          <EmptyState text="No audit score detail data is available for the heatmap yet." />
        ) : (
          <div style={heatmapWrapStyle}>
            <div style={heatmapTableStyle}>
              <div style={{ ...heatmapRowStyle, ...heatmapHeaderRowStyle }}>
                <div style={heatmapAgentCellStyle}>Agent</div>
                <div style={heatmapAvgCellStyle}>Avg</div>
                {metricUniverse.map((metric) => (
                  <div key={metric} style={heatmapMetricCellStyle}>
                    {metric}
                  </div>
                ))}
              </div>

              {heatmapRows.map((row) => {
                const isFocused = selectedAgentKey != null && row.agentKey === selectedAgentKey;

                return (
                  <div
                    key={row.agentKey}
                    style={{
                      ...heatmapRowStyle,
                      ...(isFocused ? focusedRowStyle : {}),
                    }}
                  >
                    <div style={heatmapAgentCellStyle}>
                      <div style={cellPrimaryStyle}>{row.label}</div>
                    </div>

                    <div style={heatmapAvgCellStyle}>
                      <span style={metricPillStyle}>
                        {row.averageQuality != null ? `${row.averageQuality.toFixed(2)}%` : '-'}
                      </span>
                    </div>

                    {row.cells.map((cell) => (
                      <div
                        key={`${row.agentKey}-${cell.metric}`}
                        style={{
                          ...heatmapMetricCellStyle,
                          background: getHeatCellTone(cell.rate),
                          color: getHeatCellText(cell.rate),
                          border: '1px solid rgba(148,163,184,0.12)',
                        }}
                        title={
                          cell.total > 0
                            ? `${cell.metric}: ${cell.flagged} flagged out of ${cell.total} checks`
                            : `${cell.metric}: no checks yet`
                        }
                      >
                        <div style={heatCellTopStyle}>
                          {cell.total > 0 ? `${Math.round(cell.rate * 100)}%` : '-'}
                        </div>
                        <div style={heatCellBottomStyle}>
                          {cell.flagged}/{cell.total}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      <div style={twoColumnGridStyle}>
        <Section title="Low Performers" subtitle="Sorted by combined quality, issue pressure, procedure repeats, monitoring, and overdue coaching.">
          {lowPerformers.length === 0 ? (
            <EmptyState text="No agents found for this team." />
          ) : (
            <div style={tableWrapStyle}>
              <div style={tableStyle}>
                <div style={{ ...tableRowStyle, ...tableHeaderRowStyle }}>
                  <div style={lowPerformerAgentCellStyle}>Agent</div>
                  <div style={lowPerformerQualityCellStyle}>Avg</div>
                  <div style={lowPerformerFlagsCellStyle}>Flags</div>
                  <div style={lowPerformerProcedureCellStyle}>Procedure</div>
                  <div style={lowPerformerCoachingCellStyle}>Coaching</div>
                  <div style={lowPerformerRiskCellStyle}>Risk</div>
                </div>

                {lowPerformers.map((item) => {
                  const tone = getRiskTone(item.riskLevel);
                  const isFocused = selectedAgentKey != null && item.agentKey === selectedAgentKey;

                  return (
                    <div
                      key={item.agentKey}
                      style={{
                        ...tableRowStyle,
                        ...(isFocused ? focusedRowStyle : {}),
                      }}
                    >
                      <div style={lowPerformerAgentCellStyle}>
                        <div style={cellPrimaryStyle}>{item.label}</div>
                        <div style={cellSecondaryStyle}>
                          {item.auditsCount} audits • workload {item.workloadTotal}
                        </div>
                      </div>

                      <div style={lowPerformerQualityCellStyle}>
                        <div style={cellPrimaryStyle}>
                          {item.averageQuality != null ? `${item.averageQuality.toFixed(2)}%` : '-'}
                        </div>
                        <div style={cellSecondaryStyle}>{formatDelta(item.trendDelta)}</div>
                      </div>

                      <div style={lowPerformerFlagsCellStyle}>
                        <div style={cellPrimaryStyle}>{item.flaggedCount}</div>
                        <div style={cellSecondaryStyle}>Flagged metrics</div>
                      </div>

                      <div style={lowPerformerProcedureCellStyle}>
                        <div style={cellPrimaryStyle}>{item.procedureFlags}</div>
                        <div style={cellSecondaryStyle}>Procedure cases</div>
                      </div>

                      <div style={lowPerformerCoachingCellStyle}>
                        <div style={cellPrimaryStyle}>
                          {item.openCoaching} open / {item.overdueCoaching} overdue
                        </div>
                        <div style={cellSecondaryStyle}>
                          {item.activeMonitoring} active monitoring
                        </div>
                      </div>

                      <div style={lowPerformerRiskCellStyle}>
                        <span style={{ ...riskPillStyle, ...tone }}>{item.riskLevel}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        <Section title="Risk Flags" subtitle="Agents who need the fastest supervisor attention, with the reasons that pushed them into risk.">
          {riskFlags.length === 0 ? (
            <EmptyState text="No active team risk flags right now." />
          ) : (
            <div style={flagListStyle}>
              {riskFlags.map((item) => {
                const tone = getRiskTone(item.riskLevel);
                const isFocused = selectedAgentKey != null && item.agentKey === selectedAgentKey;

                return (
                  <div
                    key={item.agentKey}
                    style={{
                      ...flagCardStyle,
                      ...(isFocused ? focusedRowStyle : {}),
                    }}
                  >
                    <div style={flagCardTopStyle}>
                      <div>
                        <div style={cellPrimaryStyle}>{item.label}</div>
                        <div style={cellSecondaryStyle}>
                          Avg {item.averageQuality != null ? `${item.averageQuality.toFixed(2)}%` : '-'} • Procedure {item.procedureFlags} • Overdue {item.overdueCoaching} • Monitoring {item.activeMonitoring}
                        </div>
                      </div>

                      <span style={{ ...riskPillStyle, ...tone }}>{item.riskLevel}</span>
                    </div>

                    <div style={reasonListStyle}>
                      {item.reasons.map((reason) => (
                        <span key={`${item.agentKey}-${reason}`} style={reasonPillStyle}>
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      <div style={twoColumnGridStyle}>
        <Section title="Overdue Coaching" subtitle="Open coaching items that are late or waiting for supervisor review after an agent response.">
          {overdueCoaching.length === 0 ? (
            <EmptyState text="No overdue coaching items right now." />
          ) : (
            <div style={tableWrapStyle}>
              <div style={tableStyle}>
                <div style={{ ...tableRowStyle, ...tableHeaderRowStyle }}>
                  <div style={overdueAgentCellStyle}>Agent</div>
                  <div style={overdueSubjectCellStyle}>Subject</div>
                  <div style={overdueDateCellStyle}>Due</div>
                  <div style={overdueStageCellStyle}>Stage</div>
                </div>

                {overdueCoaching.map((item) => (
                  <div key={item.id} style={tableRowStyle}>
                    <div style={overdueAgentCellStyle}>
                      <div style={cellPrimaryStyle}>{item.label}</div>
                      <div style={cellSecondaryStyle}>
                        {item.acknowledged ? 'Acknowledged' : 'Not acknowledged'}
                      </div>
                    </div>

                    <div style={overdueSubjectCellStyle}>
                      <div style={cellPrimaryStyle}>{item.subject}</div>
                      <div style={cellSecondaryStyle}>{item.status}</div>
                    </div>

                    <div style={overdueDateCellStyle}>
                      <div style={cellPrimaryStyle}>{item.dueDate || '-'}</div>
                      <div style={cellSecondaryStyle}>{item.daysOverdue} day(s) overdue</div>
                    </div>

                    <div style={overdueStageCellStyle}>
                      <span style={metricPillStyle}>{item.reviewStage}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Procedure Hotspots" subtitle="Case types that are showing the highest Procedure Borderline / Fail concentration.">
          {procedureHotspots.length === 0 ? (
            <EmptyState text="No procedure hotspots found in the current team audits." />
          ) : (
            <div style={flagListStyle}>
              {procedureHotspots.map((item) => (
                <div key={item.caseType} style={flagCardStyle}>
                  <div style={flagCardTopStyle}>
                    <div>
                      <div style={cellPrimaryStyle}>{item.caseType}</div>
                      <div style={cellSecondaryStyle}>
                        Borderline {item.borderlineCount} • Fail {item.failCount} • Auto-Fail {item.autoFailCount}
                      </div>
                    </div>

                    <span style={metricPillStyle}>{item.count} flags</span>
                  </div>

                  <div style={progressTrackStyle}>
                    <div
                      style={{
                        ...progressFillStyle,
                        width: `${Math.max(
                          12,
                          Math.round(
                            (item.count / Math.max(procedureHotspots[0]?.count || 1, 1)) * 100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </section>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section style={sectionStyle}>
      <div style={sectionHeaderStyle}>
        <h4 style={sectionTitleStyle}>{title}</h4>
        <p style={sectionSubtitleStyle}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function PulseCard({
  title,
  value,
  helper,
}: {
  title: string;
  value: string;
  helper: string;
}) {
  return (
    <div style={pulseCardStyle}>
      <div style={pulseLabelStyle}>{title}</div>
      <div style={pulseValueStyle}>{value}</div>
      <div style={pulseHelperStyle}>{helper}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={emptyStateStyle}>{text}</div>;
}

const rootStyle: CSSProperties = {
  marginTop: '24px',
  display: 'grid',
  gap: '18px',
};

const heroPanelStyle: CSSProperties = {
  borderRadius: '28px',
  padding: '24px',
  background:
    'linear-gradient(135deg, rgba(37,99,235,0.14) 0%, var(--da-card-bg, rgba(255,255,255,0.99)) 58%, var(--da-surface-bg, rgba(248,250,252,0.98)) 100%)',
  border: 'var(--da-panel-border, 1px solid rgba(203,213,225,0.94))',
  boxShadow: 'var(--da-panel-shadow, 0 18px 40px rgba(15,23,42,0.08))',
};

const eyebrowStyle: CSSProperties = {
  color: 'var(--da-accent-text, #60a5fa)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
};

const titleStyle: CSSProperties = {
  margin: '10px 0 8px 0',
  color: 'var(--da-title, #f8fafc)',
  fontSize: '30px',
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--da-muted-text, #cbd5e1)',
  lineHeight: 1.6,
};

const focusedAgentStyle: CSSProperties = {
  marginTop: '12px',
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: '999px',
  background: 'rgba(37,99,235,0.12)',
  border: '1px solid rgba(147,197,253,0.22)',
  color: 'var(--da-title, #f8fafc)',
  fontWeight: 700,
  fontSize: '13px',
};

const pulseGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '12px',
};

const pulseCardStyle: CSSProperties = {
  borderRadius: '20px',
  padding: '18px',
  background: 'var(--da-card-bg, rgba(255,255,255,0.99))',
  border: 'var(--da-panel-border, 1px solid rgba(203,213,225,0.94))',
  boxShadow: 'var(--da-panel-shadow, 0 10px 24px rgba(15,23,42,0.08))',
};

const pulseLabelStyle: CSSProperties = {
  color: 'var(--da-subtle-text, #94a3b8)',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontWeight: 800,
};

const pulseValueStyle: CSSProperties = {
  marginTop: '10px',
  color: 'var(--da-title, #f8fafc)',
  fontWeight: 900,
  fontSize: '28px',
};

const pulseHelperStyle: CSSProperties = {
  marginTop: '8px',
  color: 'var(--da-muted-text, #cbd5e1)',
  fontSize: '13px',
  lineHeight: 1.5,
};

const sectionStyle: CSSProperties = {
  borderRadius: '22px',
  padding: '18px',
  background: 'var(--da-panel-bg, linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.68) 100%))',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  boxShadow: 'var(--da-panel-shadow, 0 18px 40px rgba(2,6,23,0.26))',
};

const sectionHeaderStyle: CSSProperties = {
  marginBottom: '12px',
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--da-title, #f8fafc)',
  fontSize: '20px',
};

const sectionSubtitleStyle: CSSProperties = {
  margin: '6px 0 0 0',
  color: 'var(--da-muted-text, #cbd5e1)',
  lineHeight: 1.55,
  fontSize: '13px',
};

const heatmapWrapStyle: CSSProperties = {
  overflowX: 'auto',
  borderRadius: '18px',
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'var(--da-card-bg, rgba(15,23,42,0.52))',
};

const heatmapTableStyle: CSSProperties = {
  minWidth: '1080px',
};

const heatmapRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `260px 90px repeat(${MAX_HEATMAP_METRICS}, minmax(110px, 1fr))`,
  gap: '10px',
  alignItems: 'stretch',
  padding: '10px 12px',
  borderBottom: '1px solid rgba(148,163,184,0.08)',
};

const heatmapHeaderRowStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: 'var(--da-menu-bg, rgba(15,23,42,0.96))',
  color: 'var(--da-accent-text, #93c5fd)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
};

const heatmapAgentCellStyle: CSSProperties = {
  minWidth: 0,
};

const heatmapAvgCellStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

const heatmapMetricCellStyle: CSSProperties = {
  minWidth: 0,
  padding: '10px 8px',
  borderRadius: '12px',
  textAlign: 'center',
};

const heatCellTopStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: '14px',
};

const heatCellBottomStyle: CSSProperties = {
  marginTop: '4px',
  fontSize: '12px',
  opacity: 0.88,
};

const twoColumnGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)',
  gap: '18px',
};

const tableWrapStyle: CSSProperties = {
  overflowX: 'auto',
  overflowY: 'auto',
  maxHeight: '460px',
  borderRadius: '18px',
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'var(--da-card-bg, rgba(255,255,255,0.99))',
  boxShadow: 'var(--da-panel-shadow, 0 10px 24px rgba(15,23,42,0.08))',
};

const tableStyle: CSSProperties = {
  minWidth: '880px',
};

const tableRowStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
  alignItems: 'center',
  padding: '12px 14px',
  borderBottom: '1px solid rgba(148,163,184,0.08)',
};

const tableHeaderRowStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: 'var(--da-menu-bg, rgba(15,23,42,0.96))',
  color: 'var(--da-accent-text, #93c5fd)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
};

const lowPerformerAgentCellStyle: CSSProperties = {};
const lowPerformerQualityCellStyle: CSSProperties = {};
const lowPerformerFlagsCellStyle: CSSProperties = {};
const lowPerformerProcedureCellStyle: CSSProperties = {};
const lowPerformerCoachingCellStyle: CSSProperties = {};
const lowPerformerRiskCellStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-start',
};

const overdueAgentCellStyle: CSSProperties = {};
const overdueSubjectCellStyle: CSSProperties = {};
const overdueDateCellStyle: CSSProperties = {};
const overdueStageCellStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

const cellPrimaryStyle: CSSProperties = {
  color: 'var(--da-title, #f8fafc)',
  fontWeight: 700,
  fontSize: '14px',
  lineHeight: 1.4,
};

const cellSecondaryStyle: CSSProperties = {
  marginTop: '4px',
  color: 'var(--da-subtle-text, #94a3b8)',
  fontSize: '12px',
  lineHeight: 1.4,
};

const riskPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
};

const metricPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(37,99,235,0.14)',
  border: '1px solid rgba(147,197,253,0.22)',
  color: 'var(--da-title, #f8fafc)',
  fontSize: '12px',
  fontWeight: 800,
};

const flagListStyle: CSSProperties = {
  display: 'grid',
  gap: '10px',
};

const flagCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'var(--da-card-bg, rgba(255,255,255,0.99))',
  boxShadow: 'var(--da-panel-shadow, 0 8px 20px rgba(15,23,42,0.06))',
};

const flagCardTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
};

const reasonListStyle: CSSProperties = {
  marginTop: '10px',
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
};

const reasonPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 10px',
  borderRadius: '999px',
  background: 'var(--da-surface-bg, rgba(15,23,42,0.62))',
  border: '1px solid rgba(148,163,184,0.12)',
  color: 'var(--da-page-text, #e5eefb)',
  fontSize: '12px',
  fontWeight: 700,
};





const progressTrackStyle: CSSProperties = {
  marginTop: '10px',
  height: '10px',
  borderRadius: '999px',
  background: 'rgba(148,163,184,0.14)',
  overflow: 'hidden',
};

const progressFillStyle: CSSProperties = {
  height: '100%',
  borderRadius: '999px',
  background: 'linear-gradient(90deg, rgba(37,99,235,0.95) 0%, rgba(59,130,246,0.88) 100%)',
};

const emptyStateStyle: CSSProperties = {
  color: 'var(--da-muted-text, #cbd5e1)',
  fontSize: '14px',
  lineHeight: 1.6,
};

const focusedRowStyle: CSSProperties = {
  outline: '2px solid rgba(96,165,250,0.35)',
  outlineOffset: '-2px',
  borderRadius: '14px',
};
