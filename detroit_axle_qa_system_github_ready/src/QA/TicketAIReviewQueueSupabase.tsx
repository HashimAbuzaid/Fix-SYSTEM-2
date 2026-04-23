
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  ISSUE_WAS_RESOLVED_METRIC,
  getAdjustedScoreData,
  getMetricOptions,
  ticketsMetrics,
} from '../lib/auditScoring';
import {
  AI_REVIEW_REASON_OPTIONS,
  TICKETS_METRIC_ORDER,
  buildBenchmarkReport,
  getProviderLabel,
  normalizeProviderName,
  parseAiMetricDetails,
  parseRetrievedExamples,
  parseStringArray,
  type ConfidenceLevel,
  type EvaluationRow,
  type ReviewLabelRow,
} from '../lib/ticketAiReview';

type EvidenceCase = {
  id: string;
  source_type: 'ticket' | 'call';
  team: string;
  external_case_id: string;
  agent_id: string | null;
  agent_name: string;
  case_type: string | null;
  case_date: string | null;
  ticket_text: string | null;
  agent_reply_text: string | null;
  internal_notes: string | null;
  review_status?: 'new' | 'queued' | 'in_review' | 'completed';
  created_at: string;
};

type Provider = 'gemini' | 'groq';
type QueueFilter = 'all' | 'needs_draft' | 'draft_ready' | 'reviewed';

type ReviewMetricEditor = {
  result: string;
  rationale: string;
  evidenceText: string;
  confidence: ConfidenceLevel;
};

type ReviewFormState = {
  reviewDecision: 'accepted' | 'edited' | 'rejected';
  reviewReasonCodes: string[];
  reviewReasonNotes: string;
  finalSummary: string;
  finalComments: string;
  finalConfidenceNotes: string;
  coachingFocusText: string;
  metrics: Record<string, ReviewMetricEditor>;
};

const EMPTY_REVIEW_FORM: ReviewFormState = {
  reviewDecision: 'edited',
  reviewReasonCodes: [],
  reviewReasonNotes: '',
  finalSummary: '',
  finalComments: '',
  finalConfidenceNotes: '',
  coachingFocusText: '',
  metrics: {},
};

function TicketAIReviewQueueSupabase() {
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingLabel, setSavingLabel] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [provider, setProvider] = useState<Provider>('groq');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [cases, setCases] = useState<EvidenceCase[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [labels, setLabels] = useState<ReviewLabelRow[]>([]);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(EMPTY_REVIEW_FORM);

  useEffect(() => {
    void loadQueue();
  }, []);

  const labelsByCaseId = useMemo(
    () => new Map(labels.map((label) => [label.evidence_case_id, label])),
    [labels]
  );

  const draftsByCaseId = useMemo(() => {
    const map = new Map<string, EvaluationRow[]>();

    evaluations.forEach((evaluation) => {
      const list = map.get(evaluation.evidence_case_id) || [];
      list.push(evaluation);
      map.set(evaluation.evidence_case_id, list);
    });

    map.forEach((list) =>
      list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    );

    return map;
  }, [evaluations]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return cases.filter((item) => {
      const caseDrafts = draftsByCaseId.get(item.id) || [];
      const hasDraft = caseDrafts.length > 0;
      const hasLabel = labelsByCaseId.has(item.id);

      if (filter === 'needs_draft' && hasDraft) return false;
      if (filter === 'draft_ready' && !hasDraft) return false;
      if (filter === 'reviewed' && !hasLabel) return false;

      if (!normalizedSearch) return true;

      return (
        item.external_case_id.toLowerCase().includes(normalizedSearch) ||
        item.agent_name.toLowerCase().includes(normalizedSearch) ||
        (item.agent_id || '').toLowerCase().includes(normalizedSearch) ||
        (item.case_type || '').toLowerCase().includes(normalizedSearch) ||
        (item.ticket_text || '').toLowerCase().includes(normalizedSearch) ||
        (item.agent_reply_text || '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [cases, draftsByCaseId, filter, labelsByCaseId, search]);

  const selectedCase =
    filteredCases.find((item) => item.id === selectedEvidenceId) ||
    cases.find((item) => item.id === selectedEvidenceId) ||
    null;

  const draftsForSelectedCase = useMemo(() => {
    if (!selectedCase) return [];
    return draftsByCaseId.get(selectedCase.id) || [];
  }, [draftsByCaseId, selectedCase]);

  const selectedDraft = useMemo(() => {
    if (!selectedCase) return null;

    const preferred =
      draftsForSelectedCase.find(
        (item) =>
          normalizeProviderName(item.provider_name, item.generation_type, item.output_payload || null) ===
          provider
      ) || null;

    return preferred || draftsForSelectedCase[0] || null;
  }, [draftsForSelectedCase, provider, selectedCase]);

  const selectedLabel = useMemo(
    () => (selectedCase ? labelsByCaseId.get(selectedCase.id) || null : null),
    [labelsByCaseId, selectedCase]
  );

  const queueStats = useMemo(() => {
    const total = cases.length;
    const needsDraft = cases.filter((item) => (draftsByCaseId.get(item.id) || []).length === 0).length;
    const draftReady = total - needsDraft;
    const reviewed = cases.filter((item) => labelsByCaseId.has(item.id)).length;

    return { total, needsDraft, draftReady, reviewed };
  }, [cases, draftsByCaseId, labelsByCaseId]);

  const benchmarkReport = useMemo(
    () => buildBenchmarkReport(evaluations, labels),
    [evaluations, labels]
  );

  useEffect(() => {
    if (!selectedDraft && !selectedLabel) {
      setReviewForm(EMPTY_REVIEW_FORM);
      return;
    }

    const sourceDetails = selectedLabel
      ? parseAiMetricDetails(selectedLabel.final_score_details)
      : parseAiMetricDetails(selectedDraft?.suggested_score_details);
    const sourceDetailMap = new Map(sourceDetails.map((detail) => [detail.metric, detail]));

    const nextMetrics = Object.fromEntries(
      TICKETS_METRIC_ORDER.map((metricName) => {
        const detail = sourceDetailMap.get(metricName);
        const evidenceText = (detail?.evidence_refs || [])
          .map((ref) => `${ref.source}: ${ref.quote}`)
          .join('\n');

        const fallbackResult = metricName === ISSUE_WAS_RESOLVED_METRIC ? '' : 'N/A';

        return [
          metricName,
          {
            result: detail?.result || fallbackResult,
            rationale: String(detail?.rationale || detail?.metric_comment || '').trim(),
            evidenceText,
            confidence: detail?.confidence || 'medium',
          } satisfies ReviewMetricEditor,
        ];
      })
    ) as Record<string, ReviewMetricEditor>;

    setReviewForm({
      reviewDecision:
        selectedLabel?.review_decision ||
        (selectedDraft?.status === 'accepted' ||
        selectedDraft?.status === 'edited' ||
        selectedDraft?.status === 'rejected'
          ? selectedDraft.status
          : 'edited'),
      reviewReasonCodes: selectedLabel?.review_reason_codes || [],
      reviewReasonNotes: selectedLabel?.review_reason_notes || '',
      finalSummary: selectedLabel?.final_summary || selectedDraft?.summary || '',
      finalComments: selectedLabel?.final_comments || selectedDraft?.suggested_comments || '',
      finalConfidenceNotes:
        selectedLabel?.final_confidence_notes || selectedDraft?.confidence_notes || '',
      coachingFocusText: parseStringArray(
        selectedLabel?.final_coaching_focus ?? selectedDraft?.suggested_coaching_focus ?? []
      ).join('\n'),
      metrics: nextMetrics,
    });
  }, [selectedDraft, selectedLabel]);

  async function loadQueue() {
    setLoading(true);
    setErrorMessage('');

    try {
      const [casesResult, evaluationsResult, labelsResult] = await Promise.all([
        supabase
          .from('qa_evidence_cases')
          .select('*')
          .eq('team', 'Tickets')
          .eq('source_type', 'ticket')
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('qa_ai_evaluations')
          .select('*')
          .eq('generation_type', 'ticket_eval_draft')
          .order('created_at', { ascending: false })
          .limit(1200),
        supabase
          .from('qa_ai_review_labels')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(600),
      ]);

      if (casesResult.error) throw casesResult.error;
      if (evaluationsResult.error) throw evaluationsResult.error;
      if (labelsResult.error) throw labelsResult.error;

      const nextCases = (casesResult.data || []) as EvidenceCase[];
      setCases(nextCases);
      setEvaluations((evaluationsResult.data || []) as EvaluationRow[]);
      setLabels((labelsResult.data || []) as ReviewLabelRow[]);

      if (nextCases.length > 0) {
        setSelectedEvidenceId((prev) => prev || nextCases[0].id);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not load the Ticket AI review queue.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateDraft() {
    if (!selectedCase) {
      setErrorMessage('Please choose a ticket evidence item first.');
      return;
    }

    setSavingDraft(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const currentUser = await supabase.auth.getUser();
      const createdByUserId = currentUser.data.user?.id || null;
      const functionName =
        provider === 'gemini'
          ? 'generate-ticket-ai-draft-gemini'
          : 'generate-ticket-ai-draft-groq';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          evidenceCaseId: selectedCase.id,
          createdByUserId,
        },
      });

      if (error) throw error;
      if (!data?.evaluation) {
        throw new Error('The edge function did not return an evaluation row.');
      }

      await loadQueue();
      setSuccessMessage(
        `${getProviderLabel(provider)} draft generated using the full Tickets rubric, server-side scoring, and retrieved reviewed examples.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not generate the ticket AI draft.'
      );
    } finally {
      setSavingDraft(false);
    }
  }

  function updateReviewForm<K extends keyof ReviewFormState>(key: K, value: ReviewFormState[K]) {
    setReviewForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateMetric(metricName: string, patch: Partial<ReviewMetricEditor>) {
    setReviewForm((prev) => ({
      ...prev,
      metrics: {
        ...prev.metrics,
        [metricName]: {
          ...(prev.metrics[metricName] || {
            result: metricName === ISSUE_WAS_RESOLVED_METRIC ? '' : 'N/A',
            rationale: '',
            evidenceText: '',
            confidence: 'medium',
          }),
          ...patch,
        },
      },
    }));
  }

  function toggleReasonCode(reasonCode: string) {
    setReviewForm((prev) => {
      const exists = prev.reviewReasonCodes.includes(reasonCode);
      return {
        ...prev,
        reviewReasonCodes: exists
          ? prev.reviewReasonCodes.filter((item) => item !== reasonCode)
          : [...prev.reviewReasonCodes, reasonCode],
      };
    });
  }

  function parseEvidenceText(evidenceText: string) {
    return evidenceText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(customer_message|agent_reply|internal_notes)\s*:\s*(.+)$/i);
        if (!match) return null;

        return {
          source: match[1] as 'customer_message' | 'agent_reply' | 'internal_notes',
          quote: match[2].trim(),
        };
      })
      .filter(
        (
          item
        ): item is {
          source: 'customer_message' | 'agent_reply' | 'internal_notes';
          quote: string;
        } => item !== null && Boolean(item.quote)
      )
      .slice(0, 2);
  }

  async function handleSaveGoldLabel() {
    if (!selectedCase || !selectedDraft) {
      setErrorMessage('Choose a ticket case with a draft before saving a gold label.');
      return;
    }

    setSavingLabel(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const currentUser = await supabase.auth.getUser();
      const reviewerUserId = currentUser.data.user?.id || null;

      const scores: Record<string, string> = {};
      const metricComments: Record<string, string> = {};
      const reviewMetricDetails = TICKETS_METRIC_ORDER.map((metricName) => {
        const editor = reviewForm.metrics[metricName] || {
          result: metricName === ISSUE_WAS_RESOLVED_METRIC ? '' : 'N/A',
          rationale: '',
          evidenceText: '',
          confidence: 'medium' as ConfidenceLevel,
        };

        const result = String(editor.result || '').trim();
        const rationale = editor.rationale.trim();
        const evidenceRefs = parseEvidenceText(editor.evidenceText);

        if (!result) {
          throw new Error(`Please choose a result for ${metricName}.`);
        }

        if (metricName === ISSUE_WAS_RESOLVED_METRIC && !['Yes', 'No'].includes(result)) {
          throw new Error('Issue was resolved must be set to Yes or No.');
        }

        if (metricName !== ISSUE_WAS_RESOLVED_METRIC && result !== 'N/A' && !rationale) {
          throw new Error(`Please add a rationale for ${metricName}.`);
        }

        if (metricName !== ISSUE_WAS_RESOLVED_METRIC && result !== 'N/A' && evidenceRefs.length === 0) {
          throw new Error(`Please add at least one evidence reference for ${metricName}.`);
        }

        if (metricName === ISSUE_WAS_RESOLVED_METRIC && evidenceRefs.length === 0) {
          throw new Error('Please add an evidence reference for Issue was resolved.');
        }

        scores[metricName] = result;
        metricComments[metricName] = rationale;

        return {
          metric: metricName,
          result,
          rationale,
          confidence: editor.confidence,
          evidence_refs: evidenceRefs,
        };
      });

      if (reviewForm.reviewDecision !== 'accepted' && reviewForm.reviewReasonCodes.length === 0) {
        throw new Error('Please choose at least one review reason code for edited or rejected labels.');
      }

      const computed = getAdjustedScoreData('Tickets', scores, metricComments);
      const scoreDetailMap = new Map(
        computed.scoreDetails.map((detail) => [detail.metric, detail])
      );

      const finalScoreDetails = reviewMetricDetails.map((detail) => {
        const computedDetail = scoreDetailMap.get(detail.metric);
        return {
          metric: detail.metric,
          result: detail.result,
          pass: computedDetail?.pass ?? 0,
          borderline: computedDetail?.borderline ?? 0,
          adjustedWeight:
            computedDetail?.adjustedWeight ?? 0,
          earned: computedDetail?.earned ?? 0,
          counts_toward_score: computedDetail?.counts_toward_score ?? detail.metric !== ISSUE_WAS_RESOLVED_METRIC,
          metric_comment: detail.rationale || null,
          rationale: detail.rationale || '',
          confidence: detail.confidence,
          evidence_refs: detail.evidence_refs,
        };
      });

      const coachingFocus = reviewForm.coachingFocusText
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);

      const labelPayload = {
        evidence_case_id: selectedCase.id,
        source_evaluation_id: selectedDraft.id,
        reviewer_user_id: reviewerUserId,
        provider_name: selectedDraft.provider_name || provider,
        model_name: selectedDraft.model_name,
        rubric_version: 'tickets-v2-full-rubric',
        review_decision: reviewForm.reviewDecision,
        review_reason_codes: reviewForm.reviewReasonCodes,
        review_reason_notes: reviewForm.reviewReasonNotes.trim() || null,
        final_summary: reviewForm.finalSummary.trim() || null,
        final_score_details: finalScoreDetails,
        final_quality_score: computed.qualityScore,
        final_comments: reviewForm.finalComments.trim() || null,
        final_confidence_notes: reviewForm.finalConfidenceNotes.trim() || null,
        final_coaching_focus: coachingFocus,
      };

      const { error: labelError } = await supabase
        .from('qa_ai_review_labels')
        .upsert(labelPayload, {
          onConflict: 'evidence_case_id',
        });

      if (labelError) throw labelError;

      const { error: evaluationError } = await supabase
        .from('qa_ai_evaluations')
        .update({
          status: reviewForm.reviewDecision,
          reviewed_by_user_id: reviewerUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedDraft.id);

      if (evaluationError) throw evaluationError;

      const { error: caseError } = await supabase
        .from('qa_evidence_cases')
        .update({ review_status: 'completed' })
        .eq('id', selectedCase.id);

      if (caseError) throw caseError;

      await loadQueue();
      setSuccessMessage(
        `Gold label saved. Final score: ${computed.qualityScore.toFixed(2)}% • ${reviewForm.reviewDecision}.`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not save the gold label.'
      );
    } finally {
      setSavingLabel(false);
    }
  }

  const reviewScorePreview = useMemo(() => {
    const scores: Record<string, string> = {};
    const metricComments: Record<string, string> = {};

    TICKETS_METRIC_ORDER.forEach((metricName) => {
      const editor = reviewForm.metrics[metricName];
      if (!editor) return;
      scores[metricName] = editor.result;
      metricComments[metricName] = editor.rationale;
    });

    try {
      return getAdjustedScoreData('Tickets', scores, metricComments);
    } catch {
      return null;
    }
  }, [reviewForm.metrics]);

  const providerDraftRows = useMemo(() => {
    if (!selectedCase) return [];
    return draftsForSelectedCase.map((draft) => ({
      id: draft.id,
      provider: normalizeProviderName(draft.provider_name, draft.generation_type, draft.output_payload || null),
      createdAt: draft.created_at,
      score: draft.suggested_quality_score,
      status: draft.status,
      modelName: draft.model_name,
    }));
  }, [draftsForSelectedCase, selectedCase]);

  return (
    <div style={{ color: 'var(--da-page-text, #e5eefb)' }}>
      <div style={pageHeaderStyle}>
        <div>
          <div style={sectionEyebrow}>AI Review Workflow</div>
          <h2 style={{ margin: 0, fontSize: '30px' }}>Ticket AI Review Queue</h2>
          <p style={{ margin: '10px 0 0 0', color: 'var(--da-subtle-text, #94a3b8)' }}>
            Full-rubric ticket drafting, structured gold labeling, reason-code tracking, retrieval-augmented generation, and live Gemini-vs-Groq benchmarking.
          </p>
        </div>

        <div style={toolbarWrapStyle}>
          <div style={toolbarControlStyle}>
            <label style={labelStyle}>Provider</label>
            <select
              value={provider}
              onChange={(event: any) => setProvider(event.target.value as Provider)}
              style={fieldStyle}
            >
              <option value="groq">Groq</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>

          <button type="button" onClick={() => void loadQueue()} style={secondaryButton}>
            Refresh Queue
          </button>

          <button
            type="button"
            onClick={() => void handleGenerateDraft()}
            disabled={!selectedCase || savingDraft}
            style={primaryButton}
          >
            {savingDraft ? 'Generating Draft...' : `Generate ${getProviderLabel(provider)} Draft`}
          </button>
        </div>
      </div>

      {errorMessage ? <div style={errorBannerStyle}>{errorMessage}</div> : null}
      {successMessage ? <div style={successBannerStyle}>{successMessage}</div> : null}

      <div style={statsGridStyle}>
        <StatCard label="Evidence Cases" value={queueStats.total} />
        <StatCard label="Needs Draft" value={queueStats.needsDraft} />
        <StatCard label="Draft Ready" value={queueStats.draftReady} />
        <StatCard label="Reviewed" value={queueStats.reviewed} />
      </div>

      <div style={filterPanelStyle}>
        <div style={filterRowStyle}>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>Queue Filter</label>
            <select
              value={filter}
              onChange={(event: any) => setFilter(event.target.value as QueueFilter)}
              style={fieldStyle}
            >
              <option value="all">All Evidence</option>
              <option value="needs_draft">Needs Draft</option>
              <option value="draft_ready">Draft Ready</option>
              <option value="reviewed">Reviewed / Gold Labeled</option>
            </select>
          </div>

          <div style={{ ...filterGroupStyle, minWidth: '320px', flex: 1 }}>
            <label style={labelStyle}>Search</label>
            <input
              type="text"
              value={search}
              onChange={(event: any) => setSearch(event.target.value)}
              placeholder="Search ticket id, agent, case type, or text"
              style={fieldStyle}
            />
          </div>
        </div>
      </div>

      <div style={workspaceGridStyle}>
        <div style={queuePanelStyle}>
          <div style={panelHeaderStyle}>
            <div style={panelEyebrowStyle}>Queue</div>
            <div style={panelTitleStyle}>Ticket Evidence Cases</div>
          </div>

          {loading ? (
            <div className="da-themed-loader-shell da-themed-loader-shell--inline">
              <div className="da-themed-loader-card">
                <div className="da-themed-loader da-themed-loader--compact">
                  <div className="da-themed-loader__art" aria-hidden="true">
                    <div className="da-themed-loader__glow" />
                    <div className="da-themed-loader__rotor">
                      <div className="da-themed-loader__rotor-face" />
                      <div className="da-themed-loader__caliper" />
                      <div className="da-themed-loader__hub" />
                      <div className="da-themed-loader__spark" />
                    </div>
                  </div>
                  <div className="da-themed-loader__copy">
                    <div className="da-themed-loader__eyebrow">Detroit Axle</div>
                    <div className="da-themed-loader__label">Loading queue...</div>
                    <div className="da-themed-loader__sub">Preparing ticket AI review cases</div>
                  </div>
                </div>
              </div>
            </div>
          ) : filteredCases.length === 0 ? (
            <div style={emptyStateStyle}>No ticket evidence cases matched the current filter.</div>
          ) : (
            <div style={queueListStyle}>
              {filteredCases.map((item) => {
                const caseDrafts = draftsByCaseId.get(item.id) || [];
                const hasLabel = labelsByCaseId.has(item.id);
                const preferredDraft =
                  caseDrafts.find(
                    (draft) =>
                      normalizeProviderName(
                        draft.provider_name,
                        draft.generation_type,
                        draft.output_payload || null
                      ) === provider
                  ) || caseDrafts[0] || null;

                const isSelected = item.id === selectedEvidenceId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedEvidenceId(item.id)}
                    style={{
                      ...queueItemStyle,
                      ...(isSelected ? queueItemActiveStyle : {}),
                    }}
                  >
                    <div style={queueItemTopStyle}>
                      <div style={queueItemTitleStyle}>{item.external_case_id}</div>
                      <div style={queueBadgeRowStyle}>
                        {hasLabel ? (
                          <span style={{ ...statusPillStyle, ...reviewedPillStyle }}>Reviewed</span>
                        ) : null}
                        <span
                          style={{
                            ...statusPillStyle,
                            ...(preferredDraft ? readyPillStyle : mutedPillStyle),
                          }}
                        >
                          {preferredDraft ? preferredDraft.status : 'needs draft'}
                        </span>
                      </div>
                    </div>

                    <div style={queueItemMetaStyle}>
                      {item.agent_name}
                      {item.agent_id ? ` • ${item.agent_id}` : ''}
                    </div>

                    <div style={queueItemMetaStyle}>
                      {item.case_type || 'No case type'} • {item.case_date || 'No date'}
                    </div>

                    <div style={queueItemMetaStyle}>
                      Drafts: {caseDrafts.length}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={detailPanelStyle}>
          <div style={panelHeaderStyle}>
            <div style={panelEyebrowStyle}>Detail View</div>
            <div style={panelTitleStyle}>
              {selectedCase ? `Ticket ${selectedCase.external_case_id}` : 'Select evidence'}
            </div>
          </div>

          {!selectedCase ? (
            <div style={emptyStateStyle}>Choose a ticket evidence item from the queue.</div>
          ) : (
            <div style={{ display: 'grid', gap: '18px' }}>
              <div style={detailMetaGridStyle}>
                <InfoBlock label="Agent" value={selectedCase.agent_name} />
                <InfoBlock label="Agent ID" value={selectedCase.agent_id || '-'} />
                <InfoBlock label="Case Type" value={selectedCase.case_type || '-'} />
                <InfoBlock label="Ticket Date" value={selectedCase.case_date || '-'} />
              </div>

              <div style={contentCardStyle}>
                <div style={contentCardTitleStyle}>Customer Message</div>
                <div style={contentTextStyle}>{selectedCase.ticket_text || '-'}</div>
              </div>

              <div style={contentCardStyle}>
                <div style={contentCardTitleStyle}>Agent Reply</div>
                <div style={contentTextStyle}>{selectedCase.agent_reply_text || '-'}</div>
              </div>

              <div style={contentCardStyle}>
                <div style={contentCardTitleStyle}>Internal Notes</div>
                <div style={contentTextStyle}>{selectedCase.internal_notes || '-'}</div>
              </div>

              <div style={draftPanelStyle}>
                <div style={panelHeaderStyle}>
                  <div style={panelEyebrowStyle}>Provider Drafts</div>
                  <div style={panelTitleStyle}>
                    {selectedDraft
                      ? `${getProviderLabel(
                          normalizeProviderName(
                            selectedDraft.provider_name,
                            selectedDraft.generation_type,
                            selectedDraft.output_payload || null
                          )
                        )} Draft`
                      : 'No draft yet'}
                  </div>
                </div>

                {providerDraftRows.length > 0 ? (
                  <div style={providerChipRowStyle}>
                    {providerDraftRows.map((draftRow) => (
                      <div
                        key={draftRow.id}
                        style={{
                          ...providerChipStyle,
                          ...(selectedDraft?.id === draftRow.id ? providerChipActiveStyle : {}),
                        }}
                      >
                        <div style={providerChipTitleStyle}>{getProviderLabel(draftRow.provider)}</div>
                        <div style={providerChipMetaStyle}>
                          {draftRow.modelName || '-'} • {draftRow.status}
                        </div>
                        <div style={providerChipMetaStyle}>
                          {draftRow.score != null ? `${Number(draftRow.score).toFixed(2)}%` : '-'} •{' '}
                          {draftRow.createdAt.slice(0, 10)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {!selectedDraft ? (
                  <div style={emptyStateStyle}>
                    No draft exists for the currently selected provider. Generate a draft to start the review flow.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={detailMetaGridStyle}>
                      <InfoBlock label="Provider" value={getProviderLabel(normalizeProviderName(selectedDraft.provider_name, selectedDraft.generation_type, selectedDraft.output_payload || null))} />
                      <InfoBlock label="Model" value={selectedDraft.model_name || '-'} />
                      <InfoBlock label="Draft Status" value={selectedDraft.status} />
                      <InfoBlock
                        label="Suggested Score"
                        value={
                          selectedDraft.suggested_quality_score != null
                            ? `${Number(selectedDraft.suggested_quality_score).toFixed(2)}%`
                            : '-'
                        }
                      />
                    </div>

                    <div style={contentCardStyle}>
                      <div style={contentCardTitleStyle}>Summary</div>
                      <div style={contentTextStyle}>{selectedDraft.summary || '-'}</div>
                    </div>

                    <div style={contentCardStyle}>
                      <div style={contentCardTitleStyle}>Suggested Comments</div>
                      <div style={contentTextStyle}>{selectedDraft.suggested_comments || '-'}</div>
                    </div>

                    <div style={contentCardStyle}>
                      <div style={contentCardTitleStyle}>Confidence Notes</div>
                      <div style={contentTextStyle}>{selectedDraft.confidence_notes || '-'}</div>
                    </div>

                    <div style={contentCardStyle}>
                      <div style={contentCardTitleStyle}>Retrieved Reviewed Examples</div>
                      {parseRetrievedExamples(selectedDraft.retrieved_examples).length === 0 ? (
                        <div style={contentTextStyle}>No retrieved examples were captured for this draft.</div>
                      ) : (
                        <div style={{ display: 'grid', gap: '10px' }}>
                          {parseRetrievedExamples(selectedDraft.retrieved_examples).map((example) => (
                            <div key={example.evidence_case_id} style={retrievedExampleStyle}>
                              <div style={primaryCellTextStyle}>
                                {example.external_case_id || example.evidence_case_id}
                              </div>
                              <div style={secondaryCellTextStyle}>
                                {example.case_type || 'No case type'}
                              </div>
                              <div style={secondaryCellTextStyle}>
                                {example.final_summary || '-'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={contentCardStyle}>
                      <div style={contentCardTitleStyle}>Suggested Score Details</div>
                      <div style={{ display: 'grid', gap: '10px' }}>
                        {parseAiMetricDetails(selectedDraft.suggested_score_details).map((detail) => (
                          <div key={`${selectedDraft.id}-${detail.metric}`} style={metricDraftCardStyle}>
                            <div style={metricDraftHeaderStyle}>
                              <div style={primaryCellTextStyle}>{detail.metric}</div>
                              <div style={metricResultPillStyle(detail.result)}>{detail.result}</div>
                            </div>
                            <div style={secondaryCellTextStyle}>
                              {detail.rationale || 'No rationale supplied.'}
                            </div>
                            {(detail.evidence_refs || []).length > 0 ? (
                              <div style={{ marginTop: '8px', display: 'grid', gap: '6px' }}>
                                {(detail.evidence_refs || []).map((ref, index) => (
                                  <div key={`${detail.metric}-${index}`} style={evidenceRefStyle}>
                                    {ref.source}: {ref.quote}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {selectedDraft ? (
                <div style={reviewPanelStyle}>
                  <div style={panelHeaderStyle}>
                    <div style={panelEyebrowStyle}>Gold Label Editor</div>
                    <div style={panelTitleStyle}>
                      {selectedLabel ? 'Update Final Human Review' : 'Create Final Human Review'}
                    </div>
                  </div>

                  <div style={detailMetaGridStyle}>
                    <InfoBlock
                      label="Score Preview"
                      value={
                        reviewScorePreview
                          ? `${reviewScorePreview.qualityScore.toFixed(2)}%`
                          : '-'
                      }
                    />
                    <InfoBlock
                      label="Decision"
                      value={reviewForm.reviewDecision}
                    />
                    <InfoBlock
                      label="Loaded Label"
                      value={selectedLabel ? selectedLabel.updated_at.slice(0, 10) : 'No'}
                    />
                    <InfoBlock
                      label="Reason Codes"
                      value={String(reviewForm.reviewReasonCodes.length)}
                    />
                  </div>

                  <div style={reviewGridStyle}>
                    <div>
                      <label style={labelStyle}>Review Decision</label>
                      <select
                        value={reviewForm.reviewDecision}
                        onChange={(event: any) =>
                          updateReviewForm('reviewDecision', event.target.value as ReviewFormState['reviewDecision'])
                        }
                        style={fieldStyle}
                      >
                        <option value="accepted">Accepted</option>
                        <option value="edited">Edited</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Review Reason Codes</label>
                      <div style={reasonCodeGridStyle}>
                        {AI_REVIEW_REASON_OPTIONS.map((reason) => {
                          const active = reviewForm.reviewReasonCodes.includes(reason.value);
                          return (
                            <button
                              key={reason.value}
                              type="button"
                              onClick={() => toggleReasonCode(reason.value)}
                              style={{
                                ...reasonCodeButtonStyle,
                                ...(active ? reasonCodeButtonActiveStyle : {}),
                              }}
                            >
                              {reason.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Review Notes</label>
                      <textarea
                        value={reviewForm.reviewReasonNotes}
                        onChange={(event: any) => updateReviewForm('reviewReasonNotes', event.target.value)}
                        rows={3}
                        style={fieldStyle}
                        placeholder="Explain why the draft was accepted, edited, or rejected."
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Final Summary</label>
                      <textarea
                        value={reviewForm.finalSummary}
                        onChange={(event: any) => updateReviewForm('finalSummary', event.target.value)}
                        rows={3}
                        style={fieldStyle}
                        placeholder="Final reviewer summary."
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Final Comments</label>
                      <textarea
                        value={reviewForm.finalComments}
                        onChange={(event: any) => updateReviewForm('finalComments', event.target.value)}
                        rows={4}
                        style={fieldStyle}
                        placeholder="Final QA comments."
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Final Confidence Notes</label>
                      <textarea
                        value={reviewForm.finalConfidenceNotes}
                        onChange={(event: any) => updateReviewForm('finalConfidenceNotes', event.target.value)}
                        rows={3}
                        style={fieldStyle}
                        placeholder="Evidence limitations and uncertainty notes."
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Final Coaching Focus (one item per line)</label>
                      <textarea
                        value={reviewForm.coachingFocusText}
                        onChange={(event: any) => updateReviewForm('coachingFocusText', event.target.value)}
                        rows={4}
                        style={fieldStyle}
                        placeholder="Actionable coaching items, one per line."
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '14px', marginTop: '18px' }}>
                    {TICKETS_METRIC_ORDER.map((metricName) => {
                      const editor = reviewForm.metrics[metricName] || {
                        result: metricName === ISSUE_WAS_RESOLVED_METRIC ? '' : 'N/A',
                        rationale: '',
                        evidenceText: '',
                        confidence: 'medium' as ConfidenceLevel,
                      };
                      const metricDefinition = ticketsMetrics.find((item) => item.name === metricName);

                      return (
                        <div key={metricName} style={metricEditorCardStyle}>
                          <div style={metricEditorHeaderStyle}>
                            <div>
                              <div style={primaryCellTextStyle}>{metricName}</div>
                              <div style={secondaryCellTextStyle}>
                                {metricDefinition?.pass != null && metricName !== ISSUE_WAS_RESOLVED_METRIC
                                  ? `Pass weight ${metricDefinition.pass} • Borderline ${metricDefinition.borderline}`
                                  : 'Required yes/no resolution question'}
                              </div>
                            </div>
                            <div style={metricEditorResultWrapStyle}>
                              <select
                                value={editor.result}
                                onChange={(event: any) =>
                                  updateMetric(metricName, { result: event.target.value })
                                }
                                style={miniFieldStyle}
                              >
                                {getMetricOptions(
                                  metricDefinition || {
                                    name: metricName,
                                    pass: 0,
                                    borderline: 0,
                                    options: metricName === ISSUE_WAS_RESOLVED_METRIC ? ['', 'Yes', 'No'] : ['N/A', 'Pass', 'Borderline', 'Fail'],
                                  }
                                ).map((option) => (
                                  <option key={`${metricName}-${option || 'blank'}`} value={option}>
                                    {option || 'Select result'}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={editor.confidence}
                                onChange={(event: any) =>
                                  updateMetric(metricName, {
                                    confidence: event.target.value as ConfidenceLevel,
                                  })
                                }
                                style={miniFieldStyle}
                              >
                                <option value="high">high confidence</option>
                                <option value="medium">medium confidence</option>
                                <option value="low">low confidence</option>
                              </select>
                            </div>
                          </div>

                          <div style={reviewGridStyle}>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>Rationale</label>
                              <textarea
                                value={editor.rationale}
                                onChange={(event: any) =>
                                  updateMetric(metricName, { rationale: event.target.value })
                                }
                                rows={3}
                                style={fieldStyle}
                                placeholder="Evidence-grounded reviewer rationale."
                              />
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={labelStyle}>
                                Evidence References (one per line, format: source: exact quote)
                              </label>
                              <textarea
                                value={editor.evidenceText}
                                onChange={(event: any) =>
                                  updateMetric(metricName, { evidenceText: event.target.value })
                                }
                                rows={3}
                                style={fieldStyle}
                                placeholder="agent_reply: exact snippet&#10;internal_notes: exact snippet"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={actionRowStyle}>
                    <button
                      type="button"
                      onClick={() => void handleSaveGoldLabel()}
                      disabled={savingLabel}
                      style={primaryButton}
                    >
                      {savingLabel ? 'Saving Gold Label...' : 'Save Gold Label'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div style={benchmarkPanelStyle}>
        <div style={panelHeaderStyle}>
          <div style={panelEyebrowStyle}>Benchmark</div>
          <div style={panelTitleStyle}>Live Gemini vs Groq Comparison</div>
          <p style={panelSubtitleStyle}>
            Every reviewed case becomes a benchmark target. Drafts are compared against one structured gold label per evidence case.
          </p>
        </div>

        {benchmarkReport.providerSummaries.length === 0 ? (
          <div style={emptyStateStyle}>
            No benchmark data yet. Save gold labels first, then generate drafts from both providers on the same reviewed cases.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '18px' }}>
            <div style={statsGridStyle}>
              {benchmarkReport.providerSummaries.map((summary) => (
                <div key={summary.provider} style={statCardStyle}>
                  <div style={statLabelStyle}>{getProviderLabel(summary.provider)}</div>
                  <div style={statValueStyle}>{summary.reviewedCount}</div>
                  <div style={secondaryCellTextStyle}>reviewed evaluations</div>
                  <div style={benchmarkMetricTextStyle}>
                    Exact metric agreement: {summary.exactMetricAgreement.toFixed(2)}%
                  </div>
                  <div style={benchmarkMetricTextStyle}>
                    Weighted agreement: {summary.weightedMetricAgreement.toFixed(2)}%
                  </div>
                  <div style={benchmarkMetricTextStyle}>
                    Avg score delta: {summary.avgAbsoluteScoreDelta.toFixed(2)}
                  </div>
                  <div style={benchmarkMetricTextStyle}>
                    Accepted {summary.acceptedCount} • Edited {summary.editedCount} • Rejected {summary.rejectedCount}
                  </div>
                </div>
              ))}
            </div>

            <div style={benchmarkGridStyle}>
              <div style={contentCardStyle}>
                <div style={contentCardTitleStyle}>Metric Agreement</div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {TICKETS_METRIC_ORDER.map((metricName) => {
                    const groq = benchmarkReport.metricBenchmarkRows.find(
                      (row) => row.metric === metricName && row.provider === 'groq'
                    );
                    const gemini = benchmarkReport.metricBenchmarkRows.find(
                      (row) => row.metric === metricName && row.provider === 'gemini'
                    );

                    return (
                      <div key={metricName} style={benchmarkRowStyle}>
                        <div>
                          <div style={primaryCellTextStyle}>{metricName}</div>
                          <div style={secondaryCellTextStyle}>
                            Groq {groq?.agreementRate.toFixed(2) || '0.00'}% • Gemini {gemini?.agreementRate.toFixed(2) || '0.00'}%
                          </div>
                        </div>
                        <div style={benchmarkCountStyle}>
                          {(groq?.reviewedCount || 0) + (gemini?.reviewedCount || 0)} reviews
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={contentCardStyle}>
                <div style={contentCardTitleStyle}>Top Failure Reasons</div>
                {benchmarkReport.reasonCodeRows.length === 0 ? (
                  <div style={contentTextStyle}>No review reason codes have been captured yet.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {benchmarkReport.reasonCodeRows.slice(0, 12).map((row) => (
                      <div key={`${row.provider}-${row.reasonCode}`} style={benchmarkRowStyle}>
                        <div>
                          <div style={primaryCellTextStyle}>{row.reasonCode}</div>
                          <div style={secondaryCellTextStyle}>{getProviderLabel(row.provider)}</div>
                        </div>
                        <div style={benchmarkCountStyle}>{row.count}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={statValueStyle}>{value}</div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBlockStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

function metricResultPillStyle(result: string) {
  if (result === 'Pass' || result === 'Yes') {
    return {
      ...statusPillStyle,
      background: 'rgba(22, 101, 52, 0.24)',
      border: '1px solid rgba(134, 239, 172, 0.22)',
      color: 'var(--da-success-text, #bbf7d0)',
    };
  }

  if (result === 'Borderline') {
    return {
      ...statusPillStyle,
      background: 'rgba(146, 64, 14, 0.24)',
      border: '1px solid rgba(251, 191, 36, 0.24)',
      color: '#fcd34d',
    };
  }

  if (result === 'Fail' || result === 'Auto-Fail' || result === 'No') {
    return {
      ...statusPillStyle,
      background: 'rgba(127, 29, 29, 0.24)',
      border: '1px solid rgba(248, 113, 113, 0.22)',
      color: 'var(--da-error-text, #fecaca)',
    };
  }

  return {
    ...statusPillStyle,
    ...mutedPillStyle,
  };
}

const pageHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap' as const,
  gap: '16px',
  marginBottom: '20px',
};

const toolbarWrapStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
  alignItems: 'flex-end',
};

const toolbarControlStyle = {
  minWidth: '180px',
};

const sectionEyebrow = {
  color: 'var(--da-accent-text, #60a5fa)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.16em',
  marginBottom: '12px',
};

const panelSubtitleStyle = {
  margin: '8px 0 0 0',
  color: 'var(--da-subtle-text, #94a3b8)',
  lineHeight: 1.6,
};

const statsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '14px',
  marginBottom: '20px',
};

const statCardStyle = {
  borderRadius: '18px',
  padding: '18px',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background:
    'var(--da-panel-bg, linear-gradient(180deg, rgba(15, 23, 42, 0.82) 0%, rgba(15, 23, 42, 0.68) 100%))',
  boxShadow: '0 16px 32px rgba(2, 6, 23, 0.18)',
};

const statLabelStyle = {
  color: 'var(--da-subtle-text, #94a3b8)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
};

const statValueStyle = {
  color: 'var(--da-title, #f8fafc)',
  fontSize: '32px',
  fontWeight: 900,
  marginTop: '10px',
};

const filterPanelStyle = {
  borderRadius: '20px',
  padding: '18px',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background: 'var(--da-card-bg, rgba(15, 23, 42, 0.52))',
  marginBottom: '20px',
};

const filterRowStyle = {
  display: 'flex',
  gap: '14px',
  flexWrap: 'wrap' as const,
};

const filterGroupStyle = {
  minWidth: '220px',
};

const labelStyle = {
  display: 'block',
  marginBottom: '8px',
  fontSize: '13px',
  color: 'var(--da-muted-text, #cbd5e1)',
  fontWeight: 700,
};

const fieldStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '16px',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  background: 'var(--da-surface-bg, rgba(15, 23, 42, 0.7))',
  color: 'var(--da-page-text, #e5eefb)',
};

const miniFieldStyle = {
  minWidth: '150px',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  background: 'var(--da-surface-bg, rgba(15, 23, 42, 0.7))',
  color: 'var(--da-page-text, #e5eefb)',
};

const workspaceGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(320px, 0.95fr) minmax(0, 1.45fr)',
  gap: '18px',
};

const queuePanelStyle = {
  borderRadius: '22px',
  padding: '18px',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background:
    'var(--da-panel-bg, linear-gradient(180deg, rgba(15, 23, 42, 0.82) 0%, rgba(15, 23, 42, 0.68) 100%))',
  boxShadow: '0 18px 40px rgba(2, 6, 23, 0.18)',
};

const detailPanelStyle = {
  borderRadius: '22px',
  padding: '18px',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background:
    'var(--da-panel-bg, linear-gradient(180deg, rgba(15, 23, 42, 0.82) 0%, rgba(15, 23, 42, 0.68) 100%))',
  boxShadow: '0 18px 40px rgba(2, 6, 23, 0.18)',
};

const draftPanelStyle = {
  borderRadius: '18px',
  padding: '18px',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background: 'var(--da-card-bg, rgba(15, 23, 42, 0.52))',
};

const reviewPanelStyle = {
  borderRadius: '18px',
  padding: '18px',
  border: '1px solid rgba(96, 165, 250, 0.16)',
  background:
    'linear-gradient(180deg, rgba(30, 64, 175, 0.12) 0%, var(--da-card-bg, rgba(15, 23, 42, 0.52)) 100%)',
};

const benchmarkPanelStyle = {
  marginTop: '22px',
  borderRadius: '22px',
  padding: '18px',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background:
    'var(--da-panel-bg, linear-gradient(180deg, rgba(15, 23, 42, 0.82) 0%, rgba(15, 23, 42, 0.68) 100%))',
  boxShadow: '0 18px 40px rgba(2, 6, 23, 0.18)',
};

const benchmarkGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '18px',
};

const panelHeaderStyle = {
  marginBottom: '16px',
};

const panelEyebrowStyle = {
  color: 'var(--da-accent-text, #93c5fd)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  marginBottom: '8px',
};

const panelTitleStyle = {
  color: 'var(--da-title, #f8fafc)',
  fontSize: '22px',
  fontWeight: 800,
};

const queueListStyle = {
  display: 'grid',
  gap: '10px',
  maxHeight: '720px',
  overflowY: 'auto' as const,
};

const queueItemStyle = {
  width: '100%',
  borderRadius: '16px',
  padding: '14px',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background: 'var(--da-card-bg, rgba(15, 23, 42, 0.52))',
  textAlign: 'left' as const,
  cursor: 'pointer',
};

const queueItemActiveStyle = {
  border: '1px solid rgba(96, 165, 250, 0.34)',
  background: 'var(--da-active-option-bg, rgba(30, 64, 175, 0.32))',
  boxShadow: '0 14px 28px rgba(37, 99, 235, 0.14)',
};

const queueItemTopStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
};

const queueBadgeRowStyle = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap' as const,
  justifyContent: 'flex-end',
};

const queueItemTitleStyle = {
  color: 'var(--da-title, #f8fafc)',
  fontSize: '15px',
  fontWeight: 800,
};

const queueItemMetaStyle = {
  color: 'var(--da-subtle-text, #94a3b8)',
  fontSize: '12px',
  fontWeight: 600,
  marginTop: '6px',
  lineHeight: 1.45,
};

const statusPillStyle = {
  padding: '6px 10px',
  borderRadius: '999px',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
};

const readyPillStyle = {
  background: 'rgba(22, 101, 52, 0.24)',
  border: '1px solid rgba(134, 239, 172, 0.22)',
  color: 'var(--da-success-text, #bbf7d0)',
};

const reviewedPillStyle = {
  background: 'rgba(37, 99, 235, 0.14)',
  border: '1px solid rgba(96, 165, 250, 0.24)',
  color: '#bfdbfe',
};

const mutedPillStyle = {
  background: 'var(--da-surface-bg, rgba(15, 23, 42, 0.62))',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  color: 'var(--da-subtle-text, #94a3b8)',
};

const detailMetaGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
};

const infoBlockStyle = {
  borderRadius: '16px',
  padding: '14px',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background: 'var(--da-card-bg, rgba(15, 23, 42, 0.52))',
};

const infoLabelStyle = {
  color: 'var(--da-subtle-text, #94a3b8)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  marginBottom: '8px',
};

const infoValueStyle = {
  color: 'var(--da-title, #f8fafc)',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1.45,
};

const contentCardStyle = {
  borderRadius: '18px',
  padding: '16px',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background: 'var(--da-card-bg, rgba(15, 23, 42, 0.52))',
};

const contentCardTitleStyle = {
  color: 'var(--da-accent-text, #93c5fd)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
  marginBottom: '10px',
};

const contentTextStyle = {
  color: 'var(--da-page-text, #e5eefb)',
  fontSize: '14px',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
};

const providerChipRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '10px',
};

const providerChipStyle = {
  borderRadius: '16px',
  padding: '14px',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background: 'var(--da-surface-bg, rgba(15, 23, 42, 0.62))',
};

const providerChipActiveStyle = {
  border: '1px solid rgba(96, 165, 250, 0.28)',
  boxShadow: '0 12px 24px rgba(37, 99, 235, 0.18)',
};

const providerChipTitleStyle = {
  color: 'var(--da-title, #f8fafc)',
  fontWeight: 800,
  fontSize: '14px',
};

const providerChipMetaStyle = {
  marginTop: '6px',
  color: 'var(--da-subtle-text, #94a3b8)',
  fontSize: '12px',
  fontWeight: 600,
};

const metricDraftCardStyle = {
  borderRadius: '14px',
  padding: '14px',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  background: 'var(--da-surface-bg, rgba(15, 23, 42, 0.56))',
};

const metricDraftHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '10px',
  alignItems: 'center',
  marginBottom: '8px',
};

const evidenceRefStyle = {
  borderRadius: '12px',
  padding: '8px 10px',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  background: 'rgba(15, 23, 42, 0.45)',
  color: 'var(--da-subtle-text, #94a3b8)',
  fontSize: '12px',
  lineHeight: 1.5,
};

const retrievedExampleStyle = {
  borderRadius: '14px',
  padding: '12px 14px',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  background: 'rgba(15, 23, 42, 0.45)',
};

const reviewGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
};

const reasonCodeGridStyle = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap' as const,
};

const reasonCodeButtonStyle = {
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid rgba(148, 163, 184, 0.14)',
  background: 'var(--da-surface-bg, rgba(15, 23, 42, 0.62))',
  color: 'var(--da-page-text, #e5eefb)',
  cursor: 'pointer',
  fontWeight: 700,
};

const reasonCodeButtonActiveStyle = {
  border: '1px solid rgba(96, 165, 250, 0.28)',
  background: 'rgba(37, 99, 235, 0.16)',
};

const metricEditorCardStyle = {
  borderRadius: '18px',
  padding: '16px',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  background: 'rgba(15, 23, 42, 0.48)',
};

const metricEditorHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  marginBottom: '14px',
  flexWrap: 'wrap' as const,
};

const metricEditorResultWrapStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
};

const benchmarkRowStyle = {
  borderRadius: '14px',
  padding: '12px 14px',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  background: 'rgba(15, 23, 42, 0.45)',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
};

const benchmarkCountStyle = {
  color: 'var(--da-title, #f8fafc)',
  fontWeight: 800,
  fontSize: '14px',
};

const benchmarkMetricTextStyle = {
  marginTop: '8px',
  color: 'var(--da-subtle-text, #94a3b8)',
  fontSize: '12px',
  lineHeight: 1.5,
};

const primaryCellTextStyle = {
  color: 'var(--da-title, #f8fafc)',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1.45,
};

const secondaryCellTextStyle = {
  marginTop: '4px',
  color: 'var(--da-subtle-text, #94a3b8)',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1.4,
};

const actionRowStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
  marginTop: '18px',
};

const primaryButton = {
  padding: '14px 18px',
  borderRadius: '16px',
  border: '1px solid rgba(96, 165, 250, 0.24)',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 16px 32px rgba(37, 99, 235, 0.28)',
};

const secondaryButton = {
  padding: '14px 18px',
  borderRadius: '16px',
  border: '1px solid rgba(148, 163, 184, 0.16)',
  background: 'var(--da-field-bg, rgba(15, 23, 42, 0.74))',
  color: 'var(--da-page-text, #e5eefb)',
  fontWeight: 700,
  cursor: 'pointer',
};

const errorBannerStyle = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  backgroundColor: 'var(--da-error-bg, rgba(127, 29, 29, 0.24))',
  border: 'var(--da-warning-border, 1px solid rgba(252, 165, 165, 0.24))',
  color: 'var(--da-error-text, #fecaca)',
  fontWeight: 700,
};

const successBannerStyle = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  backgroundColor: 'rgba(22, 101, 52, 0.24)',
  border: '1px solid rgba(134, 239, 172, 0.22)',
  color: 'var(--da-success-text, #bbf7d0)',
  fontWeight: 700,
};

const emptyStateStyle = {
  borderRadius: '16px',
  padding: '18px',
  border: '1px dashed rgba(148, 163, 184, 0.18)',
  background: 'var(--da-surface-bg, rgba(15, 23, 42, 0.62))',
  color: 'var(--da-subtle-text, #94a3b8)',
  lineHeight: 1.6,
};

export default TicketAIReviewQueueSupabase;
