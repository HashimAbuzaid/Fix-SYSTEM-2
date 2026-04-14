import type { TeamName } from '../types/app';

export type TeamType = TeamName | '';

export type Metric = {
  name: string;
  pass: number;
  borderline: number;
  countsTowardScore?: boolean;
  options?: string[];
  defaultValue?: string;
};

export type ScoreDetail = {
  metric: string;
  result: string;
  pass: number;
  borderline: number;
  adjustedWeight: number;
  earned: number;
  counts_toward_score?: boolean;
  metric_comment?: string | null;
};

export const LOCKED_NA_METRICS = new Set(['Active Listening']);
export const AUTO_FAIL_METRICS = new Set(['Hold (≤3 mins)', 'Procedure']);
export const ISSUE_WAS_RESOLVED_METRIC = 'Issue was resolved';

export const ISSUE_WAS_RESOLVED_QUESTION: Metric = {
  name: ISSUE_WAS_RESOLVED_METRIC,
  pass: 0,
  borderline: 0,
  countsTowardScore: false,
  options: ['', 'Yes', 'No'],
  defaultValue: '',
};

export const callsMetrics: Metric[] = [
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

export const ticketsMetrics: Metric[] = [
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

export const salesMetrics: Metric[] = [
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

export function countsTowardScore(metric: Metric) {
  return metric.countsTowardScore !== false;
}

export function shouldShowMetricComment(result: string) {
  return (
    result === 'Borderline' || result === 'Fail' || result === 'Auto-Fail'
  );
}

export function isLockedToNA(metricName: string) {
  return LOCKED_NA_METRICS.has(metricName);
}

export function canAutoFail(metricName: string) {
  return AUTO_FAIL_METRICS.has(metricName);
}

export function getMetricsForTeam(teamValue: TeamType): Metric[] {
  if (teamValue === 'Calls') return callsMetrics;
  if (teamValue === 'Tickets') return ticketsMetrics;
  if (teamValue === 'Sales') return salesMetrics;
  return [];
}

export function getMetricOptions(metric: Metric) {
  if (metric.options?.length) return metric.options;
  if (isLockedToNA(metric.name)) return ['N/A'];

  const options = ['N/A', 'Pass', 'Borderline', 'Fail'];
  if (canAutoFail(metric.name)) options.push('Auto-Fail');
  return options;
}

export function getMetricStoredValue(
  metric: Metric,
  scores: Record<string, string>
) {
  if (isLockedToNA(metric.name)) return 'N/A';
  return scores[metric.name] ?? metric.defaultValue ?? 'N/A';
}

export function createDefaultScores(teamValue: TeamType) {
  const defaults: Record<string, string> = {};

  getMetricsForTeam(teamValue).forEach((metric) => {
    defaults[metric.name] = metric.defaultValue ?? 'N/A';
  });

  return defaults;
}

export function getMissingRequiredMetricLabels(
  teamValue: TeamType,
  scores: Record<string, string>
) {
  return getMetricsForTeam(teamValue)
    .filter((metric) => Array.isArray(metric.options) && metric.defaultValue === '')
    .filter((metric) => !getMetricStoredValue(metric, scores))
    .map((metric) => metric.name);
}

export function getAdjustedScoreData(
  teamValue: TeamType,
  scores: Record<string, string>,
  metricComments: Record<string, string> = {}
) {
  const metrics = getMetricsForTeam(teamValue);
  const scoredMetrics = metrics.filter((metric) => countsTowardScore(metric));

  const hasAutoFail = scoredMetrics.some((metric) => {
    const result = getMetricStoredValue(metric, scores);
    return result === 'Auto-Fail';
  });

  const activeMetrics = scoredMetrics.filter((metric) => {
    const result = getMetricStoredValue(metric, scores);
    return result !== 'N/A' && result !== '';
  });

  const activeTotalWeight = activeMetrics.reduce(
    (sum, metric) => sum + metric.pass,
    0
  );

  const fullTotalWeight = scoredMetrics.reduce(
    (sum, metric) => sum + metric.pass,
    0
  );

  const scoreDetails: ScoreDetail[] = metrics.map((metric) => {
    const result = getMetricStoredValue(metric, scores);
    const scored = countsTowardScore(metric);

    const adjustedWeight =
      !scored || result === 'N/A' || result === '' || activeTotalWeight === 0
        ? 0
        : (metric.pass / activeTotalWeight) * fullTotalWeight;

    let earned = 0;

    if (hasAutoFail && scored) {
      earned = 0;
    } else if (scored && result === 'Pass') {
      earned = adjustedWeight;
    } else if (scored && result === 'Borderline') {
      earned =
        metric.pass > 0
          ? adjustedWeight * (metric.borderline / metric.pass)
          : 0;
    } else {
      earned = 0;
    }

    return {
      metric: metric.name,
      result,
      pass: metric.pass,
      borderline: metric.borderline,
      adjustedWeight: Number(adjustedWeight.toFixed(4)),
      earned: Number(earned.toFixed(4)),
      counts_toward_score: scored,
      metric_comment: metricComments[metric.name]?.trim() || null,
    };
  });

  const qualityScore = hasAutoFail
    ? 0
    : fullTotalWeight === 0
    ? 0
    : Number(
        (
          (scoreDetails.reduce((sum, item) => sum + item.earned, 0) /
            fullTotalWeight) *
          100
        ).toFixed(2)
      );

  return {
    hasAutoFail,
    qualityScore,
    scoreDetails,
  };
}
