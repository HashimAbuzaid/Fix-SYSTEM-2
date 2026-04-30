import {
  useCallback, useEffect, useMemo, useRef,
  useState, useTransition, type CSSProperties,
} from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchSummaryStats, fetchTrendBuckets, fetchRecurringIssues,
  fetchAuditPage, fetchRequestPage, fetchFeedbackPage,
  type FilterParams, type SummaryStats, type TrendBucket, type RecurringIssueRow,
} from '../lib/reportsApi';

// ─── No static import of reportsExport — loaded on demand ───

function ReportsSupabase() {
  useReportStyles();

  // ── Lightweight data: profiles only (small table) ──────────
  const [profiles, setProfiles]   = useState<AgentProfile[]>([]);

  // ── RPC-backed aggregates ──────────────────────────────────
  const [summary, setSummary]     = useState<SummaryStats | null>(null);
  const [trendBuckets, setTrendBuckets] = useState<{ subject: TrendBucket[]; team: TrendBucket[] } | null>(null);
  const [issues, setIssues]       = useState<RecurringIssueRow[]>([]);

  // ── Paginated detail rows ──────────────────────────────────
  const [auditRows, setAuditRows]     = useState<AuditItem[]>([]);
  const [requestRows, setRequestRows] = useState<SupervisorRequest[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<AgentFeedback[]>([]);
  const [auditPage, setAuditPage]     = useState(0);
  const [hasMoreAudits, setHasMoreAudits] = useState(true);

  // ── Misc state ─────────────────────────────────────────────
  const [loading, setLoading]         = useState(true);
  const [exporting, setExporting]     = useState(false);
  const [isPending, startTransition]  = useTransition();   // ← non-blocking filter updates

  // ── Filter state ───────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [selectedAgentProfileIds, setSelectedAgentProfileIds] = useState<string[]>([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [periodMode, setPeriodMode] = useState<'weekly' | 'monthly'>('weekly');
  const agentPickerRef = useRef<HTMLDivElement | null>(null);

  // ── Derived filter object ──────────────────────────────────
  const selectedAgents = useMemo(
    () => profiles.filter(p => selectedAgentProfileIds.includes(p.id)),
    [profiles, selectedAgentProfileIds]
  );

  const filter = useMemo((): FilterParams => ({
    team:     teamFilter   || undefined,
    agentIds: selectedAgents.map(a => a.agent_id).filter(Boolean) as string[],
    dateFrom: dateFrom     || undefined,
    dateTo:   dateTo       || undefined,
  }), [teamFilter, selectedAgents, dateFrom, dateTo]);

  // ── Boot: load profiles (tiny), then first summary ─────────
  useEffect(() => {
    fetchAllAgentProfiles()
      .then(setProfiles)
      .catch(console.error);
  }, []);

  // ── Re-run analytics whenever filters change ───────────────
  // startTransition keeps the old UI interactive while fetching
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setAuditRows([]);
    setAuditPage(0);
    setHasMoreAudits(true);

    const run = async () => {
      try {
        const [summaryData, bucketsData, issuesData, audits, requests, feedback] =
          await Promise.all([
            fetchSummaryStats(filter),
            fetchTrendBuckets(filter, periodMode),
            fetchRecurringIssues(filter),
            fetchAuditPage(filter, 0),
            fetchRequestPage(filter, 0),
            fetchFeedbackPage(filter, 0),
          ]);

        if (cancelled) return;

        startTransition(() => {
          setSummary(summaryData);
          setTrendBuckets(bucketsData);
          setIssues(issuesData);
          setAuditRows(audits as AuditItem[]);
          setRequestRows(requests as SupervisorRequest[]);
          setFeedbackRows(feedback as AgentFeedback[]);
          setHasMoreAudits(audits.length === 50);
          setLoading(false);
        });
      } catch (err) {
        if (!cancelled) { console.error(err); setLoading(false); }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [filter, periodMode]);   // ← periodMode change also re-fetches trend buckets

  // ── Load more audits (pagination) ─────────────────────────
  const loadMoreAudits = useCallback(async () => {
    const nextPage = auditPage + 1;
    const rows = await fetchAuditPage(filter, nextPage) as AuditItem[];
    setAuditRows(prev => [...prev, ...rows]);
    setAuditPage(nextPage);
    setHasMoreAudits(rows.length === 50);
  }, [filter, auditPage]);

  // ── On-demand export: lazy-import + lazy full-fetch ────────
  const handleExportTrend = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Dynamic import — parse cost deferred until click
      const { runTrendExport } = await import('../lib/reportsExport');
      // Full data fetch only happens here
      const { fetchFullAuditsForExport } = await import('../lib/reportsApi');
      const allAudits = await fetchFullAuditsForExport(filter);

      // Heavy computation runs after import, off the critical path
      // Wrap in scheduler.postTask if available, else setTimeout(0)
      await new Promise<void>((resolve, reject) => {
        const task = async () => {
          try {
            const { buildTrendPoints, buildRecurringIssues, buildProcedureHotspots, buildProcedureFlaggedCases } =
              await import('../lib/reportsAnalytics');   // see note below
            const tp = buildTrendPoints(allAudits, allAudits, periodMode);
            await runTrendExport({
              subjectLabel: selectedAgents.length === 1
                ? selectedAgents[0].agent_name
                : teamFilter || 'All Teams',
              periodMode,
              trendPoints: tp,
              recurringIssues:   buildRecurringIssues(allAudits),
              procedureHotspots: buildProcedureHotspots(allAudits),
              procedureCases:    buildProcedureFlaggedCases(allAudits),
              latestAverage:     tp.at(-1)?.subjectAverage ?? null,
              momentumDelta:     tp.length > 1
                ? Number(((tp.at(-1)!.subjectAverage ?? 0) - (tp.at(-2)!.subjectAverage ?? 0)).toFixed(2))
                : null,
              teamGap: null,
            });
            resolve();
          } catch (e) { reject(e); }
        };
        // Yield to the browser before starting heavy work
        setTimeout(task, 0);
      });
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed — check the console.');
    } finally {
      setExporting(false);
    }
  }, [filter, periodMode, selectedAgents, teamFilter, exporting]);

  // ── Trend points from RPC buckets (no heavy JS loop) ───────
  const trendPoints: TrendPoint[] = useMemo(() => {
    if (!trendBuckets) return [];
    const teamMap = new Map(trendBuckets.team.map(b => [b.period_key, b]));
    return trendBuckets.subject.map(b => ({
      key:            b.period_key,
      label:          formatPeriodLabel(b.period_key, periodMode).label,
      shortLabel:     formatPeriodLabel(b.period_key, periodMode).shortLabel,
      subjectAverage: b.avg_score,
      teamAverage:    teamMap.get(b.period_key)?.avg_score ?? null,
      auditCount:     b.audit_count,
      teamAuditCount: teamMap.get(b.period_key)?.audit_count ?? 0,
    }));
  }, [trendBuckets, periodMode]);

  // ── Recurring issues from RPC ──────────────────────────────
  const recurringIssues: RecurringIssue[] = useMemo(() =>
    issues.map(i => ({
      metric:         i.metric,
      count:          i.total_count,
      borderlineCount:i.borderline_count,
      failCount:      i.fail_count,
      autoFailCount:  i.auto_fail_count,
    })),
    [issues]
  );

  if (loading && !summary) {
    return (
      <div className="rpt-page">
        <div className="rpt-loader-shell">
          <div className="rpt-loader-inner">
            <div className="rpt-loader-spinner" />
            <div className="rpt-loader-text">Loading reports…</div>
          </div>
        </div>
      </div>
    );
  }

  const avg = summary?.average_quality?.toFixed(2) ?? '0.00';

  return (
    <div className="rpt-page" style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 150ms' }}>

      {/* ── Page header ── */}
      <div className="rpt-page-header">
        <div className="rpt-eyebrow">Reporting</div>
        <h2 className="rpt-page-title">Reports</h2>
        <p className="rpt-page-sub">Filter by date, team, and agent.</p>
      </div>

      {/* ── Filter panel (unchanged markup) ── */}
      {/* ... your existing filter panel JSX ... */}

      {/* ── Export bar ── */}
      <div className="rpt-export-bar">
        <span className="rpt-export-label">Export</span>
        {/* CSV exports stay inline — they operate on already-loaded auditRows */}
        <button className="rpt-export-btn rpt-export-btn-primary" onClick={() => exportSummaryCsv(summary)}>
          ↓ Summary
        </button>
        <button className="rpt-export-btn" onClick={() => exportAuditsCsv(auditRows)}>
          Audits (current page)
        </button>
        {/* Trend export: lazy */}
        <button
          className="rpt-export-btn rpt-export-btn-primary"
          onClick={handleExportTrend}
          disabled={exporting}
        >
          {exporting ? '⏳ Building…' : '↓ Trends Excel + Chart'}
        </button>
      </div>

      {/* ── KPI Summary (from RPC — renders immediately) ── */}
      <Section title="Summary">
        <div className="rpt-kpi-grid">
          <KpiCard label="Total Audits"    value={String(summary?.total_audits  ?? 0)}   accent="var(--accent-blue)" delay={0} />
          <KpiCard label="Average Quality" value={`${avg}%`}                             accent="var(--accent-emerald)" accentValue delay={40} />
          <KpiCard label="Calls Avg"       value={`${summary?.calls_avg?.toFixed(2) ?? '0.00'}%`} accent="var(--accent-cyan)" delay={80} />
          <KpiCard label="Tickets Avg"     value={`${summary?.tickets_avg?.toFixed(2) ?? '0.00'}%`} accent="var(--accent-violet)" delay={120} />
          <KpiCard label="Sales Avg"       value={`${summary?.sales_avg?.toFixed(2) ?? '0.00'}%`} accent="var(--accent-emerald)" delay={160} />
        </div>
      </Section>

      {/* ── Trends (chart uses trendPoints from RPC buckets, no full-row scan) ── */}
      <Section title="Performance Trends" count={trendPoints.length}>
        <div className="rpt-trend-actions" style={{ marginBottom: 14 }}>
          <div className="rpt-toggle-group">
            {(['weekly', 'monthly'] as const).map(m => (
              <button key={m} type="button"
                className={`rpt-toggle-btn${periodMode === m ? ' active' : ''}`}
                onClick={() => setPeriodMode(m)}>
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <MiniTrendChart points={trendPoints} />

        {/* Recurring issues from RPC (no client-side JSON parsing) */}
        <Section title="Recurring Issues" count={recurringIssues.length}>
          {recurringIssues.map((issue, idx) => (
            <div key={issue.metric} className="rpt-issue-card" style={{ animationDelay: `${idx * 40}ms` }}>
              <div className="rpt-issue-header">
                <div className="rpt-issue-metric">{issue.metric}</div>
                <div className="rpt-issue-count">{issue.count}</div>
              </div>
              <div className="rpt-issue-meta">
                Borderline: {issue.borderlineCount} · Fail: {issue.failCount} · Auto-Fail: {issue.autoFailCount}
              </div>
              <div className="rpt-issue-bar-track">
                <div className="rpt-issue-bar-fill"
                  style={{ width: `${Math.round((issue.count / (recurringIssues[0]?.count || 1)) * 100)}%` }} />
              </div>
            </div>
          ))}
        </Section>
      </Section>

      {/* ── Paginated Audits table ── */}
      <Section title="Recent Audits" count={summary?.total_audits}>
        {auditRows.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
            No audits in this range.
          </div>
        ) : (
          <>
            <div className="rpt-table-wrap">
              {/* ... your existing table header ... */}
              {auditRows.map(item => (
                <div key={item.id} className="rpt-table-body-row"
                  style={{ gridTemplateColumns: '1fr 1.3fr 1fr 1.7fr 0.7fr' }}>
                  {/* ... your existing cells ... */}
                </div>
              ))}
            </div>

            {hasMoreAudits && (
              <button
                type="button"
                className="rpt-export-btn"
                style={{ marginTop: 10 }}
                onClick={loadMoreAudits}
              >
                Load more audits
              </button>
            )}
          </>
        )}
      </Section>

      {/* Requests and Feedback tables follow the same pattern */}

    </div>
  );
}

// ── Helper: convert RPC period_key back to display labels ──
function formatPeriodLabel(key: string, mode: 'weekly' | 'monthly') {
  if (mode === 'monthly') {
    const d = new Date(`${key}-01T00:00:00`);
    return {
      label:      d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      shortLabel: d.toLocaleDateString(undefined, { month: 'short' }),
    };
  }
  // weekly: key is ISO Monday date
  const start = new Date(`${key}T00:00:00`);
  const end   = new Date(start); end.setDate(start.getDate() + 6);
  return {
    label:      `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    shortLabel: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  };
}

// ── Inline CSV helpers (operate on already-loaded rows, no extra fetch) ──
function exportSummaryCsv(summary: SummaryStats | null) {
  if (!summary) { alert('No data loaded yet.'); return; }
  downloadCsv('reports_summary.csv', [summary]);
}

function exportAuditsCsv(rows: AuditItem[]) {
  if (!rows.length) { alert('No audits loaded.'); return; }
  downloadCsv('audits_report.csv', rows.map(i => ({
    id: i.id, agent_name: i.agent_name, team: i.team,
    case_type: i.case_type, audit_date: i.audit_date,
    quality_score: Number(i.quality_score).toFixed(2),
    comments: i.comments ?? '',
  })));
}

export default ReportsSupabase;
