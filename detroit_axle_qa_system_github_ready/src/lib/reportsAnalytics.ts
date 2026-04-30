export type PeriodMode = 'weekly' | 'monthly';

export type TrendPoint = {
  key: string;
  label: string;
  shortLabel: string;
  subjectAverage: number | null;
  teamAverage: number | null;
  auditCount: number;
  teamAuditCount: number;
};

export type RecurringIssue = {
  metric: string;
  count: number;
  borderlineCount: number;
  failCount: number;
  autoFailCount: number;
};

export type ProcedureHotspot = {
  metric: string;
  count: number;
  averageScore: number | null;
  failRate: number;
};

export type ProcedureCaseItem = {
  id: string;
  agentName: string;
  team: string;
  caseType: string;
  auditDate: string;
  qualityScore: number | null;
  issue: string;
  result: string;
  comment: string | null;
};

type DetailLike = {
  metric?: unknown;
  result?: unknown;
  metric_comment?: unknown;
};

type AuditLike = {
  id?: unknown;
  agent_name?: unknown;
  team?: unknown;
  case_type?: unknown;
  audit_date?: unknown;
  quality_score?: unknown;
  score_details?: unknown;
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function details(audit: AuditLike): DetailLike[] {
  return Array.isArray(audit.score_details) ? (audit.score_details as DetailLike[]) : [];
}

function average(values: number[]): number | null {
  return values.length ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2)) : null;
}

function parseDate(value: unknown): Date | null {
  const raw = asString(value);
  if (!raw) return null;
  const d = new Date(`${raw.slice(0, 10)}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function startOfIsoWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function periodKey(date: Date, mode: PeriodMode): string {
  if (mode === 'monthly') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return startOfIsoWeek(date).toISOString().slice(0, 10);
}

function periodLabels(key: string, mode: PeriodMode): Pick<TrendPoint, 'label' | 'shortLabel'> {
  if (mode === 'monthly') {
    const d = new Date(`${key}-01T00:00:00`);
    return {
      label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      shortLabel: d.toLocaleDateString(undefined, { month: 'short' }),
    };
  }
  const start = new Date(`${key}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    label: `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    shortLabel: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  };
}

function isIssueResult(result: string): boolean {
  return result === 'Borderline' || result === 'Fail' || result === 'Auto-Fail';
}

export function buildTrendPoints(subjectAudits: AuditLike[], teamAudits: AuditLike[], mode: PeriodMode): TrendPoint[] {
  const subject = new Map<string, number[]>();
  const team = new Map<string, number[]>();

  for (const audit of subjectAudits) {
    const d = parseDate(audit.audit_date);
    const score = asNumber(audit.quality_score);
    if (!d || score === null) continue;
    const key = periodKey(d, mode);
    subject.set(key, [...(subject.get(key) ?? []), score]);
  }

  for (const audit of teamAudits) {
    const d = parseDate(audit.audit_date);
    const score = asNumber(audit.quality_score);
    if (!d || score === null) continue;
    const key = periodKey(d, mode);
    team.set(key, [...(team.get(key) ?? []), score]);
  }

  return Array.from(new Set([...subject.keys(), ...team.keys()])).sort().map((key) => {
    const labels = periodLabels(key, mode);
    const subjectScores = subject.get(key) ?? [];
    const teamScores = team.get(key) ?? [];
    return {
      key,
      ...labels,
      subjectAverage: average(subjectScores),
      teamAverage: average(teamScores),
      auditCount: subjectScores.length,
      teamAuditCount: teamScores.length,
    };
  });
}

export function buildRecurringIssues(audits: AuditLike[]): RecurringIssue[] {
  const map = new Map<string, RecurringIssue>();
  for (const audit of audits) {
    for (const detail of details(audit)) {
      const metric = asString(detail.metric, 'Unknown Metric');
      const result = asString(detail.result);
      if (!isIssueResult(result)) continue;
      const item = map.get(metric) ?? { metric, count: 0, borderlineCount: 0, failCount: 0, autoFailCount: 0 };
      item.count += 1;
      if (result === 'Borderline') item.borderlineCount += 1;
      if (result === 'Fail') item.failCount += 1;
      if (result === 'Auto-Fail') item.autoFailCount += 1;
      map.set(metric, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export function buildProcedureHotspots(audits: AuditLike[]): ProcedureHotspot[] {
  const map = new Map<string, { metric: string; issueCount: number; total: number; scores: number[] }>();
  for (const audit of audits) {
    const score = asNumber(audit.quality_score);
    for (const detail of details(audit)) {
      const metric = asString(detail.metric, 'Unknown Metric');
      const result = asString(detail.result);
      const item = map.get(metric) ?? { metric, issueCount: 0, total: 0, scores: [] };
      item.total += 1;
      if (score !== null) item.scores.push(score);
      if (isIssueResult(result)) item.issueCount += 1;
      map.set(metric, item);
    }
  }
  return Array.from(map.values())
    .filter((item) => item.issueCount > 0)
    .map((item) => ({
      metric: item.metric,
      count: item.issueCount,
      averageScore: average(item.scores),
      failRate: item.total ? Number(((item.issueCount / item.total) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function buildProcedureFlaggedCases(audits: AuditLike[]): ProcedureCaseItem[] {
  const rows: ProcedureCaseItem[] = [];
  for (const audit of audits) {
    for (const detail of details(audit)) {
      const result = asString(detail.result);
      if (!isIssueResult(result)) continue;
      rows.push({
        id: asString(audit.id),
        agentName: asString(audit.agent_name, 'Unknown Agent'),
        team: asString(audit.team),
        caseType: asString(audit.case_type),
        auditDate: asString(audit.audit_date),
        qualityScore: asNumber(audit.quality_score),
        issue: asString(detail.metric, 'Unknown Metric'),
        result,
        comment: typeof detail.metric_comment === 'string' ? detail.metric_comment : null,
      });
    }
  }
  return rows;
}
