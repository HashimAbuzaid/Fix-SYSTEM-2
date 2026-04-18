import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

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

type EvaluationRow = {
  id: string;
  evidence_case_id: string;
  generation_type: string;
  model_name: string | null;
  summary: string | null;
  suggested_score_details: unknown;
  suggested_quality_score: number | null;
  suggested_comments: string | null;
  confidence_notes: string | null;
  status: 'draft' | 'accepted' | 'rejected' | 'edited';
  created_at: string;
};

type QueueFilter = 'all' | 'needs_draft' | 'draft_ready';
type Provider = 'gemini' | 'groq';

function TicketAIReviewQueueSupabase() {
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filter, setFilter] = useState<QueueFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  const [provider, setProvider] = useState<Provider>('gemini');
  const [cases, setCases] = useState<EvidenceCase[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);

  useEffect(() => {
    void loadQueue();
  }, []);

  async function loadQueue() {
    setLoading(true);
    setErrorMessage('');

    try {
      const [casesResult, evaluationsResult] = await Promise.all([
        supabase
          .from('qa_evidence_cases')
          .select('*')
          .eq('team', 'Tickets')
          .eq('source_type', 'ticket')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('qa_ai_evaluations')
          .select('*')
          .eq('generation_type', 'ticket_eval_draft')
          .order('created_at', { ascending: false })
          .limit(400),
      ]);

      if (casesResult.error) throw casesResult.error;
      if (evaluationsResult.error) throw evaluationsResult.error;

      const nextCases = (casesResult.data || []) as EvidenceCase[];
      setCases(nextCases);
      setEvaluations((evaluationsResult.data || []) as EvaluationRow[]);

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

  const latestEvaluationByCaseId = useMemo(() => {
    const map = new Map<string, EvaluationRow>();

    evaluations.forEach((item) => {
      const current = map.get(item.evidence_case_id);
      if (!current || current.created_at < item.created_at) {
        map.set(item.evidence_case_id, item);
      }
    });

    return map;
  }, [evaluations]);

  const filteredCases = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return cases.filter((item) => {
      const latestDraft = latestEvaluationByCaseId.get(item.id);
      const hasDraft = Boolean(latestDraft);

      if (filter === 'needs_draft' && hasDraft) return false;
      if (filter === 'draft_ready' && !hasDraft) return false;

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
  }, [cases, filter, latestEvaluationByCaseId, search]);

  const selectedCase =
    filteredCases.find((item) => item.id === selectedEvidenceId) ||
    cases.find((item) => item.id === selectedEvidenceId) ||
    null;

  const selectedDraft = selectedCase
    ? latestEvaluationByCaseId.get(selectedCase.id) || null
    : null;

  const queueStats = useMemo(() => {
    const total = cases.length;
    const draftReady = cases.filter((item) => latestEvaluationByCaseId.has(item.id)).length;
    const needsDraft = total - draftReady;

    return { total, draftReady, needsDraft };
  }, [cases, latestEvaluationByCaseId]);

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
        provider === 'gemini'
          ? 'Gemini ticket draft generated and saved.'
          : 'Groq ticket draft generated and saved.'
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not generate the ticket AI draft.'
      );
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleChangeDraftStatus(nextStatus: EvaluationRow['status']) {
    if (!selectedDraft) return;

    setErrorMessage('');
    setSuccessMessage('');

    try {
      const currentUser = await supabase.auth.getUser();
      const reviewedByUserId = currentUser.data.user?.id || null;

      const { data, error } = await supabase
        .from('qa_ai_evaluations')
        .update({
          status: nextStatus,
          reviewed_by_user_id: reviewedByUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', selectedDraft.id)
        .select('*')
        .single();

      if (error) throw error;

      setEvaluations((prev) =>
        prev.map((item) => (item.id === selectedDraft.id ? (data as EvaluationRow) : item))
      );

      setSuccessMessage(`Draft marked as ${nextStatus}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not update the draft status.'
      );
    }
  }

  return (
    <div style={{ color: 'var(--da-page-text, #e5eefb)' }}>
      <div style={pageHeaderStyle}>
        <div>
          <div style={sectionEyebrow}>AI Review Workflow</div>
          <h2 style={{ margin: 0, fontSize: '30px' }}>Ticket AI Review Queue</h2>
          <p style={{ margin: '10px 0 0 0', color: 'var(--da-subtle-text, #94a3b8)' }}>
            Review saved ticket evidence and generate real LLM draft outputs through Gemini or Groq.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ minWidth: '180px' }}>
            <label style={labelStyle}>AI Provider</label>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as Provider)}
              style={fieldStyle}
            >
              <option value="gemini">Gemini</option>
              <option value="groq">Groq</option>
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
            {savingDraft ? 'Generating Draft...' : `Generate ${provider === 'gemini' ? 'Gemini' : 'Groq'} Draft`}
          </button>
        </div>
      </div>

      {errorMessage ? <div style={errorBannerStyle}>{errorMessage}</div> : null}
      {successMessage ? <div style={successBannerStyle}>{successMessage}</div> : null}

      <div style={statsGridStyle}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Evidence Cases</div>
          <div style={statValueStyle}>{queueStats.total}</div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Needs Draft</div>
          <div style={statValueStyle}>{queueStats.needsDraft}</div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Draft Ready</div>
          <div style={statValueStyle}>{queueStats.draftReady}</div>
        </div>
      </div>

      <div style={filterPanelStyle}>
        <div style={filterRowStyle}>
          <div style={filterGroupStyle}>
            <label style={labelStyle}>Queue Filter</label>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as QueueFilter)}
              style={fieldStyle}
            >
              <option value="all">All Evidence</option>
              <option value="needs_draft">Needs Draft</option>
              <option value="draft_ready">Draft Ready</option>
            </select>
          </div>

          <div style={{ ...filterGroupStyle, minWidth: '320px', flex: 1 }}>
            <label style={labelStyle}>Search</label>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
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
            <div style={panelTitleStyle}>Evidence Cases</div>
          </div>

          {loading ? (
            <div style={emptyStateStyle}>Loading queue...</div>
          ) : filteredCases.length === 0 ? (
            <div style={emptyStateStyle}>No ticket evidence cases matched the current filter.</div>
          ) : (
            <div style={queueListStyle}>
              {filteredCases.map((item) => {
                const latestDraft = latestEvaluationByCaseId.get(item.id);
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
                      <div
                        style={{
                          ...statusPillStyle,
                          ...(latestDraft ? readyPillStyle : mutedPillStyle),
                        }}
                      >
                        {latestDraft ? latestDraft.status : 'needs draft'}
                      </div>
                    </div>

                    <div style={queueItemMetaStyle}>
                      {item.agent_name}
                      {item.agent_id ? ` • ${item.agent_id}` : ''}
                    </div>

                    <div style={queueItemMetaStyle}>
                      {item.case_type || 'No case type'} • {item.case_date || 'No date'}
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
                  <div style={panelEyebrowStyle}>Draft Output</div>
                  <div style={panelTitleStyle}>
                    {selectedDraft ? 'Latest Ticket Draft' : 'No draft yet'}
                  </div>
                </div>

                {!selectedDraft ? (
                  <div style={emptyStateStyle}>
                    No AI draft exists for this ticket yet. Generate one to start the review flow.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <div style={detailMetaGridStyle}>
                      <InfoBlock label="Model" value={selectedDraft.model_name || '-'} />
                      <InfoBlock label="Status" value={selectedDraft.status} />
                      <InfoBlock
                        label="Suggested Score"
                        value={
                          selectedDraft.suggested_quality_score != null
                            ? `${Number(selectedDraft.suggested_quality_score).toFixed(2)}%`
                            : '-'
                        }
                      />
                      <InfoBlock label="Created" value={selectedDraft.created_at.slice(0, 10)} />
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
                      <div style={contentCardTitleStyle}>Suggested Score Details</div>
                      <pre style={jsonBlockStyle}>
                        {JSON.stringify(selectedDraft.suggested_score_details || {}, null, 2)}
                      </pre>
                    </div>

                    <div style={actionRowStyle}>
                      <button
                        type="button"
                        onClick={() => void handleChangeDraftStatus('accepted')}
                        style={primaryButton}
                      >
                        Mark Accepted
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleChangeDraftStatus('edited')}
                        style={secondaryButton}
                      >
                        Mark Edited
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleChangeDraftStatus('rejected')}
                        style={dangerButton}
                      >
                        Mark Rejected
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
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

const pageHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap' as const,
  gap: '16px',
  marginBottom: '20px',
};

const sectionEyebrow = {
  color: 'var(--da-accent-text, #60a5fa)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.16em',
  marginBottom: '12px',
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

const jsonBlockStyle = {
  margin: 0,
  color: 'var(--da-page-text, #e5eefb)',
  fontSize: '12px',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
};

const actionRowStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
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

const dangerButton = {
  padding: '14px 18px',
  borderRadius: '16px',
  border: '1px solid rgba(248, 113, 113, 0.22)',
  background: 'rgba(127, 29, 29, 0.24)',
  color: 'var(--da-error-text, #fecaca)',
  fontWeight: 800,
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
