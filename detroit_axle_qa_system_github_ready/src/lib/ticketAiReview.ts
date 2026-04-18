import { ISSUE_WAS_RESOLVED_METRIC, ticketsMetrics } from './auditScoring';

export type ProviderName = 'groq' | 'gemini' | 'unknown';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type EvidenceRefSource = 'customer_message' | 'agent_reply' | 'internal_notes';
export type AiMetricResult =
  | 'Pass'
  | 'Borderline'
  | 'Fail'
  | 'Auto-Fail'
  | 'N/A'
  | 'Yes'
  | 'No';

export type AiEvidenceRef = {
  source: EvidenceRefSource;
  quote: string;
};

export type AiMetricDetail = {
  metric: string;
  result: AiMetricResult;
  rationale?: string | null;
  metric_comment?: string | null;
  confidence?: ConfidenceLevel | null;
  evidence_refs?: AiEvidenceRef[] | null;
  counts_toward_score?: boolean;
  pass?: number;
  borderline?: number;
  adjustedWeight?: number;
  adjusted_weight?: number;
  earned?: number;
};

export type EvaluationRow = {
  id: string;
  evidence_case_id: string;
  generation_type: string;
  provider_name?: string | null;
  model_name: string | null;
  summary: string | null;
  suggested_score_details: unknown;
  suggested_quality_score: number | null;
  suggested_comments: string | null;
  confidence_notes: string | null;
  suggested_coaching_focus?: unknown;
  retrieved_examples?: unknown;
  retrieved_example_case_ids?: string[] | null;
  output_payload?: Record<string, unknown> | null;
  status: 'draft' | 'accepted' | 'rejected' | 'edited';
  created_at: string;
};

export type ReviewLabelRow = {
  id: string;
  evidence_case_id: string;
  source_evaluation_id: string | null;
  reviewer_user_id?: string | null;
  provider_name?: string | null;
  model_name?: string | null;
  rubric_version: string;
  review_decision: 'accepted' | 'edited' | 'rejected';
  review_reason_codes: string[] | null;
  review_reason_notes: string | null;
  final_summary: string | null;
  final_score_details: unknown;
  final_quality_score: number | null;
  final_comments: string | null;
  final_confidence_notes: string | null;
  final_coaching_focus: unknown;
  created_at: string;
  updated_at: string;
};

export type RetrievedExample = {
  evidence_case_id: string;
  external_case_id?: string | null;
  case_type?: string | null;
  final_summary?: string | null;
  final_comments?: string | null;
};

export type ProviderBenchmarkSummary = {
  provider: ProviderName;
  reviewedCount: number;
  acceptedCount: number;
  editedCount: number;
  rejectedCount: number;
  avgAbsoluteScoreDelta: number;
  exactMetricAgreement: number;
  weightedMetricAgreement: number;
};

export type MetricBenchmarkRow = {
  metric: string;
  provider: ProviderName;
  reviewedCount: number;
  matchedCount: number;
  agreementRate: number;
};

export type ReasonCodeBenchmarkRow = {
  reasonCode: string;
  provider: ProviderName;
  count: number;
};

export const TICKETS_METRIC_ORDER = ticketsMetrics.map((metric) => metric.name);

export const AI_REVIEW_REASON_OPTIONS = [
  { value: 'wrong_metric_result', label: 'Wrong metric result' },
  { value: 'missed_policy_requirement', label: 'Missed policy requirement' },
  { value: 'hallucinated_fact', label: 'Hallucinated fact' },
  { value: 'ignored_internal_notes', label: 'Ignored internal notes' },
  { value: 'weak_rationale', label: 'Weak rationale' },
  { value: 'wrong_evidence_reference', label: 'Wrong evidence reference' },
  { value: 'missed_case_context', label: 'Missed case context' },
  { value: 'too_harsh', label: 'Too harsh' },
  { value: 'too_lenient', label: 'Too lenient' },
  { value: 'poor_comments_quality', label: 'Poor comments quality' },
  { value: 'bad_coaching_focus', label: 'Bad coaching focus' },
  { value: 'json_shape_issue', label: 'JSON shape issue' },
] as const;

const PROVIDER_LABEL_MAP: Record<ProviderName, string> = {
  groq: 'Groq',
  gemini: 'Gemini',
  unknown: 'Unknown',
};

export function getProviderLabel(provider: ProviderName) {
  return PROVIDER_LABEL_MAP[provider];
}

export function normalizeProviderName(
  providerName?: string | null,
  generationType?: string | null,
  outputPayload?: Record<string, unknown> | null
): ProviderName {
  const candidates = [
    providerName,
    generationType,
    typeof outputPayload?.source === 'string' ? outputPayload.source : '',
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  if (candidates.some((value) => value.includes('groq'))) return 'groq';
  if (candidates.some((value) => value.includes('gemini'))) return 'gemini';
  return 'unknown';
}

export function parseStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
}

export function parseRetrievedExamples(value: unknown): RetrievedExample[] {
  if (!Array.isArray(value)) return [];

  const rows: RetrievedExample[] = [];

  value.forEach((item) => {
    const row = item as Record<string, unknown>;
    const evidenceCaseId = String(row.evidence_case_id ?? '').trim();
    if (!evidenceCaseId) return;

    rows.push({
      evidence_case_id: evidenceCaseId,
      external_case_id: String(row.external_case_id ?? '').trim() || null,
      case_type: String(row.case_type ?? '').trim() || null,
      final_summary: String(row.final_summary ?? '').trim() || null,
      final_comments: String(row.final_comments ?? '').trim() || null,
    });
  });

  return rows;
}

export function parseAiMetricDetails(value: unknown): AiMetricDetail[] {
  if (!Array.isArray(value)) return [];

  const details: AiMetricDetail[] = [];

  value.forEach((item) => {
    const row = item as Record<string, unknown>;
    const metric = String(row.metric ?? '').trim();
    const result = String(row.result ?? '').trim() as AiMetricResult;
    if (!metric || !result) return;

    const evidenceRefs: AiEvidenceRef[] = [];

    if (Array.isArray(row.evidence_refs)) {
      row.evidence_refs.forEach((ref) => {
        const refRow = ref as Record<string, unknown>;
        const source = String(refRow.source ?? '').trim() as EvidenceRefSource;
        const quote = String(refRow.quote ?? '').trim();
        if (
          (source === 'customer_message' ||
            source === 'agent_reply' ||
            source === 'internal_notes') &&
          quote
        ) {
          evidenceRefs.push({
            source,
            quote,
          });
        }
      });
    }

    details.push({
      metric,
      result,
      rationale: String(row.rationale ?? row.metric_comment ?? '').trim() || null,
      metric_comment: String(row.metric_comment ?? row.rationale ?? '').trim() || null,
      confidence:
        row.confidence === 'high' || row.confidence === 'medium' || row.confidence === 'low'
          ? row.confidence
          : null,
      evidence_refs: evidenceRefs,
      counts_toward_score:
        typeof row.counts_toward_score === 'boolean' ? row.counts_toward_score : undefined,
      pass: Number.isFinite(Number(row.pass)) ? Number(row.pass) : undefined,
      borderline: Number.isFinite(Number(row.borderline)) ? Number(row.borderline) : undefined,
      adjustedWeight: Number.isFinite(Number(row.adjustedWeight))
        ? Number(row.adjustedWeight)
        : Number.isFinite(Number(row.adjusted_weight))
          ? Number(row.adjusted_weight)
          : undefined,
      adjusted_weight: Number.isFinite(Number(row.adjusted_weight))
        ? Number(row.adjusted_weight)
        : Number.isFinite(Number(row.adjustedWeight))
          ? Number(row.adjustedWeight)
          : undefined,
      earned: Number.isFinite(Number(row.earned)) ? Number(row.earned) : undefined,
    });
  });

  return details;
}

function getMetricWeight(metric: string) {
  const metricDef = ticketsMetrics.find((item) => item.name === metric);
  if (metricDef) return metricDef.pass;
  if (metric === ISSUE_WAS_RESOLVED_METRIC) return 1;
  return 1;
}

export function buildBenchmarkReport(
  evaluations: EvaluationRow[],
  labels: ReviewLabelRow[]
) {
  const labelByCaseId = new Map(labels.map((label) => [label.evidence_case_id, label]));
  const providerRows = new Map<
    ProviderName,
    {
      reviewedCount: number;
      acceptedCount: number;
      editedCount: number;
      rejectedCount: number;
      totalScoreDelta: number;
      totalMetricCount: number;
      matchedMetricCount: number;
      weightedMetricTotal: number;
      weightedMetricMatched: number;
    }
  >();

  const metricRows = new Map<string, { reviewedCount: number; matchedCount: number }>();
  const reasonRows = new Map<string, number>();

  evaluations.forEach((evaluation) => {
    const label = labelByCaseId.get(evaluation.evidence_case_id);
    if (!label) return;

    const provider = normalizeProviderName(
      evaluation.provider_name,
      evaluation.generation_type,
      evaluation.output_payload || null
    );

    const draftDetails = parseAiMetricDetails(evaluation.suggested_score_details);
    const goldDetails = parseAiMetricDetails(label.final_score_details);

    if (goldDetails.length === 0) return;

    const draftMap = new Map(draftDetails.map((detail) => [detail.metric, detail]));
    const providerSummary =
      providerRows.get(provider) || {
        reviewedCount: 0,
        acceptedCount: 0,
        editedCount: 0,
        rejectedCount: 0,
        totalScoreDelta: 0,
        totalMetricCount: 0,
        matchedMetricCount: 0,
        weightedMetricTotal: 0,
        weightedMetricMatched: 0,
      };

    providerSummary.reviewedCount += 1;
    if (label.review_decision === 'accepted') providerSummary.acceptedCount += 1;
    if (label.review_decision === 'edited') providerSummary.editedCount += 1;
    if (label.review_decision === 'rejected') providerSummary.rejectedCount += 1;

    const scoreDelta = Math.abs(
      Number(evaluation.suggested_quality_score ?? 0) - Number(label.final_quality_score ?? 0)
    );
    providerSummary.totalScoreDelta += scoreDelta;

    goldDetails.forEach((goldDetail) => {
      const weight = getMetricWeight(goldDetail.metric);
      const draftDetail = draftMap.get(goldDetail.metric);
      const matched = draftDetail?.result === goldDetail.result;

      providerSummary.totalMetricCount += 1;
      providerSummary.weightedMetricTotal += weight;

      if (matched) {
        providerSummary.matchedMetricCount += 1;
        providerSummary.weightedMetricMatched += weight;
      }

      const metricKey = `${provider}::${goldDetail.metric}`;
      const metricSummary = metricRows.get(metricKey) || { reviewedCount: 0, matchedCount: 0 };
      metricSummary.reviewedCount += 1;
      if (matched) metricSummary.matchedCount += 1;
      metricRows.set(metricKey, metricSummary);
    });

    (label.review_reason_codes || []).forEach((reasonCode) => {
      const key = `${provider}::${reasonCode}`;
      reasonRows.set(key, (reasonRows.get(key) || 0) + 1);
    });

    providerRows.set(provider, providerSummary);
  });

  const providerSummaries: ProviderBenchmarkSummary[] = Array.from(providerRows.entries())
    .map(([provider, summary]) => ({
      provider,
      reviewedCount: summary.reviewedCount,
      acceptedCount: summary.acceptedCount,
      editedCount: summary.editedCount,
      rejectedCount: summary.rejectedCount,
      avgAbsoluteScoreDelta:
        summary.reviewedCount === 0
          ? 0
          : Number((summary.totalScoreDelta / summary.reviewedCount).toFixed(2)),
      exactMetricAgreement:
        summary.totalMetricCount === 0
          ? 0
          : Number(((summary.matchedMetricCount / summary.totalMetricCount) * 100).toFixed(2)),
      weightedMetricAgreement:
        summary.weightedMetricTotal === 0
          ? 0
          : Number(
              ((summary.weightedMetricMatched / summary.weightedMetricTotal) * 100).toFixed(2)
            ),
    }))
    .sort((a, b) => {
      if (b.reviewedCount !== a.reviewedCount) return b.reviewedCount - a.reviewedCount;
      return a.provider.localeCompare(b.provider);
    });

  const metricBenchmarkRows: MetricBenchmarkRow[] = Array.from(metricRows.entries())
    .map(([key, summary]) => {
      const [provider, metric] = key.split('::') as [ProviderName, string];
      return {
        provider,
        metric,
        reviewedCount: summary.reviewedCount,
        matchedCount: summary.matchedCount,
        agreementRate:
          summary.reviewedCount === 0
            ? 0
            : Number(((summary.matchedCount / summary.reviewedCount) * 100).toFixed(2)),
      };
    })
    .sort((a, b) => {
      const metricDelta =
        TICKETS_METRIC_ORDER.indexOf(a.metric) - TICKETS_METRIC_ORDER.indexOf(b.metric);
      if (metricDelta !== 0) return metricDelta;
      return a.provider.localeCompare(b.provider);
    });

  const reasonCodeRows: ReasonCodeBenchmarkRow[] = Array.from(reasonRows.entries())
    .map(([key, count]) => {
      const [provider, reasonCode] = key.split('::') as [ProviderName, string];
      return {
        provider,
        reasonCode,
        count,
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.reasonCode !== b.reasonCode) return a.reasonCode.localeCompare(b.reasonCode);
      return a.provider.localeCompare(b.provider);
    });

  return {
    providerSummaries,
    metricBenchmarkRows,
    reasonCodeRows,
  };
}