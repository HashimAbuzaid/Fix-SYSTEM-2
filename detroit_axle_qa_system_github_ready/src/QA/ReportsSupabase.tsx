import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchSummaryStats,
  fetchTrendBuckets,
  fetchRecurringIssues,
  fetchAuditPage,
  fetchRequestPage,
  fetchFeedbackPage,
  type FilterParams,
  type SummaryStats,
  type TrendBucket,
  type RecurringIssueRow,
} from '../lib/reportsApi';
import type { TrendPoint, RecurringIssue } from '../lib/reportsAnalytics';

type TeamName = 'Calls' | 'Tickets' | 'Sales';

type AgentProfile = {
  id: string;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
  role?: string | null;
  email?: string | null;
};

type AuditItem = {
  id: string;
  agent_id: string | null;
  agent_name: string;
  team: TeamName | string | null;
  case_type: string | null;
  audit_date: string | null;
  quality_score: number | string | null;
  comments?: string | null;
  order_number?: string | null;
  phone_number?: string | null;
  ticket_id?: string | null;
};

type SupervisorRequest = {
  id: string;
  agent_name?: string | null;
  agent_id?: string | null;
  request_type?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type AgentFeedback = {
  id: string;
  agent_name?: string | null;
  agent_id?: string | null;
  feedback?: string | null;
  message?: string | null;
  category?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const REPORT_STYLE_ID = 'da-reports-page-styles-v2';

function useReportStyles() {
  useEffect(() => {
    if (document.getElementById(REPORT_STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = REPORT_STYLE_ID;
    el.textContent = `
.rpt-page{color:var(--fg-default);display:grid;gap:18px}
.rpt-page-header{display:flex;flex-direction:column;gap:4px}.rpt-eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--accent-blue)}
.rpt-page-title{margin:0;font-size:26px;font-weight:850;letter-spacing:-.035em;color:var(--fg-default)}.rpt-page-sub{margin:0;color:var(--fg-muted);font-size:13px}
.rpt-filter-panel,.rpt-section,.rpt-export-bar{border:1px solid var(--border);background:var(--bg-elevated);border-radius:16px;padding:16px}.rpt-filter-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;align-items:end}
.rpt-label{display:block;font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-muted);margin-bottom:6px}.rpt-input,.rpt-select,.rpt-agent-picker-btn{width:100%;height:38px;border:1px solid var(--border);background:var(--bg-subtle);color:var(--fg-default);border-radius:10px;padding:0 11px;font:inherit;font-size:13px}
.rpt-agent-picker{position:relative}.rpt-agent-picker-btn{display:flex;align-items:center;justify-content:space-between;text-align:left;cursor:pointer}.rpt-agent-menu{position:absolute;z-index:20;top:calc(100% + 6px);left:0;right:0;border:1px solid var(--border-strong);border-radius:14px;background:var(--bg-overlay);box-shadow:var(--shadow-lg);overflow:hidden}.rpt-agent-list{max-height:260px;overflow:auto;padding:8px;display:grid;gap:6px}.rpt-agent-option{border:1px solid var(--border);background:var(--bg-subtle);color:var(--fg-default);border-radius:10px;padding:9px 10px;text-align:left;font:inherit;font-size:12px;cursor:pointer}.rpt-agent-option.active{border-color:color-mix(in srgb,var(--accent-blue) 35%,transparent);background:color-mix(in srgb,var(--accent-blue) 12%,transparent);color:var(--accent-blue)}
.rpt-filter-actions,.rpt-export-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.rpt-export-label{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--fg-muted);margin-right:4px}.rpt-export-btn{height:34px;padding:0 13px;border-radius:10px;border:1px solid var(--border);background:var(--bg-subtle);color:var(--fg-default);font:inherit;font-size:12px;font-weight:700;cursor:pointer}.rpt-export-btn-primary{background:color-mix(in srgb,var(--accent-blue) 12%,transparent);border-color:color-mix(in srgb,var(--accent-blue) 25%,transparent);color:var(--accent-blue)}.rpt-export-btn:disabled{opacity:.55;cursor:not-allowed}
.rpt-section{display:grid;gap:14px}.rpt-section-header{display:flex;align-items:center;justify-content:space-between;gap:12px}.rpt-section-title{font-size:15px;font-weight:800;color:var(--fg-default)}.rpt-count{font-size:11px;color:var(--fg-muted);border:1px solid var(--border);border-radius:999px;padding:3px 8px}.rpt-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.rpt-kpi-card{border:1px solid var(--border);background:var(--bg-subtle);border-radius:14px;padding:14px}.rpt-kpi-label{font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-muted)}.rpt-kpi-value{font-size:26px;font-weight:850;letter-spacing:-.04em;margin-top:6px}
.rpt-toggle-group{display:inline-flex;gap:4px;padding:4px;border:1px solid var(--border);border-radius:12px;background:var(--bg-subtle)}.rpt-toggle-btn{border:0;background:transparent;color:var(--fg-muted);font:inherit;font-size:12px;font-weight:750;border-radius:9px;padding:7px 10px;cursor:pointer}.rpt-toggle-btn.active{background:var(--bg-elevated);color:var(--accent-blue)}.rpt-chart{width:100%;height:auto;display:block;border:1px solid var(--border);border-radius:14px;background:var(--bg-subtle)}
.rpt-issue-card{border:1px solid var(--border);background:var(--bg-subtle);border-radius:12px;padding:12px;animation:fadeUp 220ms ease both}.rpt-issue-header{display:flex;align-items:center;justify-content:space-between;gap:10px}.rpt-issue-metric{font-size:13px;font-weight:800}.rpt-issue-count{font-size:18px;font-weight:850;color:var(--accent-rose)}.rpt-issue-meta{font-size:12px;color:var(--fg-muted);margin-top:4px}.rpt-issue-bar-track{height:6px;background:var(--border);border-radius:999px;overflow:hidden;margin-top:9px}.rpt-issue-bar-fill{height:100%;background:var(--accent-rose);border-radius:999px}
.rpt-table-wrap{border:1px solid var(--border);border-radius:14px;overflow:auto;background:var(--bg-subtle)}.rpt-table-head-row,.rpt-table-body-row{display:grid;gap:10px;align-items:center;min-width:900px;padding:11px 14px}.rpt-table-head-row{background:var(--bg-overlay);border-bottom:1px solid var(--border);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--fg-muted)}.rpt-table-body-row{border-bottom:1px solid var(--border);font-size:13px}.rpt-table-body-row:last-child{border-bottom:0}.rpt-muted{color:var(--fg-muted)}
.rpt-loader-shell{min-height:55vh;display:grid;place-items:center}.rpt-loader-inner{display:flex;align-items:center;gap:12px;color:var(--fg-muted)}.rpt-loader-spinner{width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--accent-blue);border-radius:50%;animation:spin 800ms linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
    document.head.appendChild(el);
    return () => { document.getElementById(REPORT_STYLE_ID)?.remove(); };
  }, []);
}

function asTeam(value: unknown): TeamName | null {
  return value === 'Calls' || value === 'Tickets' || value === 'Sales' ? value : null;
}

async function fetchAllAgentProfiles(): Promise<AgentProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, agent_id, agent_name, display_name, team, role, email')
    .order('agent_name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ''),
    agent_id: typeof row.agent_id === 'string' ? row.agent_id : null,
    agent_name: String(row.agent_name ?? row.display_name ?? row.email ?? 'Unknown Agent'),
    display_name: typeof row.display_name === 'string' ? row.display_name : null,
    team: asTeam(row.team),
    role: typeof row.role === 'string' ? row.role : null,
    email: typeof row.email === 'string' ? row.email : null,
  }));
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section className="rpt-section">
      <div className="rpt-section-header">
        <div className="rpt-section-title">{title}</div>
        {typeof count === 'number' && <span className="rpt-count">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function KpiCard({ label, value, accent, delay = 0, accentValue = false }: {
  label: string;
  value: string;
  accent: string;
  delay?: number;
  accentValue?: boolean;
}) {
  return (
    <div className="rpt-kpi-card" style={{ animation: 'fadeUp 220ms ease both', animationDelay: `${delay}ms` }}>
      <div className="rpt-kpi-label">{label}</div>
      <div className="rpt-kpi-value" style={{ color: accentValue ? accent : 'var(--fg-default)' }}>{value}</div>
    </div>
  );
}

function MiniTrendChart({ points }: { points: TrendPoint[] }) {
  const width = 920;
  const height = 260;
  const pad = 34;
  const values = points
    .flatMap((p) => [p.subjectAverage, p.teamAverage])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const min = Math.min(60, ...values);
  const max = Math.max(100, ...values);
  const x = (i: number) => (points.length <= 1 ? pad : pad + (i * (width - pad * 2)) / (points.length - 1));
  const y = (v: number | null) => height - pad - (((typeof v === 'number' ? v : min) - min) / Math.max(1, max - min)) * (height - pad * 2);
  const pathFor = (selector: (p: TrendPoint) => number | null) =>
    points.map((p, i) => {
      const value = selector(p);
      return value === null || !Number.isFinite(value) ? '' : `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(value).toFixed(1)}`;
    }).filter(Boolean).join(' ');

  if (points.length === 0) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-muted)' }}>No trend data for this range.</div>;
  }

  return (
    <svg className="rpt-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Performance trend chart">
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--border)" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="var(--border)" />
      {[70, 80, 90, 100].map((tick) => (
        <g key={tick}>
          <line x1={pad} x2={width - pad} y1={y(tick)} y2={y(tick)} stroke="var(--border)" opacity={0.45} />
          <text x={8} y={y(tick) + 4} fill="var(--fg-muted)" fontSize="11">{tick}%</text>
        </g>
      ))}
      <path d={pathFor((p) => p.teamAverage)} fill="none" stroke="var(--accent-violet)" strokeWidth="2.5" opacity={0.75} />
      <path d={pathFor((p) => p.subjectAverage)} fill="none" stroke="var(--accent-blue)" strokeWidth="3.5" />
      {points.map((p, i) => (
        <g key={p.key}>
          {typeof p.subjectAverage === 'number' && <circle cx={x(i)} cy={y(p.subjectAverage)} r="4" fill="var(--accent-blue)" />}
          <text x={x(i)} y={height - 9} fill="var(--fg-muted)" fontSize="10" textAnchor="middle">{p.shortLabel}</text>
        </g>
      ))}
    </svg>
  );
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: unknown) => {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatPeriodLabel(key: string, mode: 'weekly' | 'monthly') {
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

function exportSummaryCsv(summary: SummaryStats | null) {
  if (!summary) { alert('No data loaded yet.'); return; }
  downloadCsv('reports_summary.csv', [summary as unknown as Record<string, unknown>]);
}

function exportAuditsCsv(rows: AuditItem[]) {
  if (!rows.length) { alert('No audits loaded.'); return; }
  downloadCsv('audits_report.csv', rows.map((i) => ({
    id: i.id,
    agent_name: i.agent_name,
    team: i.team,
    case_type: i.case_type,
    audit_date: i.audit_date,
    quality_score: Number(i.quality_score ?? 0).toFixed(2),
    comments: i.comments ?? '',
  })));
}

function ReportsSupabase() {
  useReportStyles();

  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [trendBuckets, setTrendBuckets] = useState<{ subject: TrendBucket[]; team: TrendBucket[] } | null>(null);
  const [issues, setIssues] = useState<RecurringIssueRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditItem[]>([]);
  const [requestRows, setRequestRows] = useState<SupervisorRequest[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<AgentFeedback[]>([]);
  const [auditPage, setAuditPage] = useState(0);
  const [hasMoreAudits, setHasMoreAudits] = useState(true);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [selectedAgentProfileIds, setSelectedAgentProfileIds] = useState<string[]>([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [periodMode, setPeriodMode] = useState<'weekly' | 'monthly'>('weekly');
  const agentPickerRef = useRef<HTMLDivElement | null>(null);

  const selectedAgents = useMemo(
    () => profiles.filter((p) => selectedAgentProfileIds.includes(p.id)),
    [profiles, selectedAgentProfileIds],
  );

  const filter = useMemo((): FilterParams => ({
    team: teamFilter || undefined,
    agentIds: selectedAgents.map((a) => a.agent_id).filter((id): id is string => Boolean(id)),
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [teamFilter, selectedAgents, dateFrom, dateTo]);

  useEffect(() => {
    fetchAllAgentProfiles().then(setProfiles).catch(console.error);
  }, []);

  useEffect(() => {
    function onOutside(event: MouseEvent) {
      if (agentPickerRef.current && !agentPickerRef.current.contains(event.target as Node)) setIsAgentPickerOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAuditRows([]);
    setAuditPage(0);
    setHasMoreAudits(true);

    async function run() {
      try {
        const [summaryData, bucketsData, issuesData, audits, requests, feedback] = await Promise.all([
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
        if (!cancelled) {
          console.error(err);
          setLoading(false);
        }
      }
    }

    void run();
    return () => { cancelled = true; };
  }, [filter, periodMode]);

  const loadMoreAudits = useCallback(async () => {
    const nextPage = auditPage + 1;
    const rows = await fetchAuditPage(filter, nextPage) as AuditItem[];
    setAuditRows((prev) => [...prev, ...rows]);
    setAuditPage(nextPage);
    setHasMoreAudits(rows.length === 50);
  }, [filter, auditPage]);

  const trendPoints: TrendPoint[] = useMemo(() => {
    if (!trendBuckets) return [];
    const teamMap = new Map(trendBuckets.team.map((b) => [b.period_key, b]));
    return trendBuckets.subject.map((b) => ({
      key: b.period_key,
      label: formatPeriodLabel(b.period_key, periodMode).label,
      shortLabel: formatPeriodLabel(b.period_key, periodMode).shortLabel,
      subjectAverage: b.avg_score,
      teamAverage: teamMap.get(b.period_key)?.avg_score ?? null,
      auditCount: b.audit_count,
      teamAuditCount: teamMap.get(b.period_key)?.audit_count ?? 0,
    }));
  }, [trendBuckets, periodMode]);

  const recurringIssues: RecurringIssue[] = useMemo(() =>
    issues.map((i) => ({
      metric: i.metric,
      count: i.total_count,
      borderlineCount: i.borderline_count,
      failCount: i.fail_count,
      autoFailCount: i.auto_fail_count,
    })),
  [issues]);

  const handleExportTrend = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { runTrendExport } = await import('../lib/reportsExport');
      const { fetchFullAuditsForExport } = await import('../lib/reportsApi');
      const allAudits = await fetchFullAuditsForExport(filter);
      await new Promise<void>((resolve, reject) => {
        const task = async () => {
          try {
            const { buildTrendPoints, buildRecurringIssues, buildProcedureHotspots, buildProcedureFlaggedCases } = await import('../lib/reportsAnalytics');
            const tp = buildTrendPoints(allAudits, allAudits, periodMode);
            await runTrendExport({
              subjectLabel: selectedAgents.length === 1 ? selectedAgents[0].agent_name : teamFilter || 'All Teams',
              periodMode,
              trendPoints: tp,
              recurringIssues: buildRecurringIssues(allAudits),
              procedureHotspots: buildProcedureHotspots(allAudits),
              procedureCases: buildProcedureFlaggedCases(allAudits),
              latestAverage: tp.at(-1)?.subjectAverage ?? null,
              momentumDelta: tp.length > 1
                ? Number(((tp.at(-1)!.subjectAverage ?? 0) - (tp.at(-2)!.subjectAverage ?? 0)).toFixed(2))
                : null,
              teamGap: null,
            });
            resolve();
          } catch (e) { reject(e); }
        };
        setTimeout(task, 0);
      });
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed. Check the console.');
    } finally {
      setExporting(false);
    }
  }, [filter, periodMode, selectedAgents, teamFilter, exporting]);

  if (loading && !summary) {
    return <div className="rpt-page"><div className="rpt-loader-shell"><div className="rpt-loader-inner"><div className="rpt-loader-spinner" /><div>Loading reports...</div></div></div></div>;
  }

  const avg = summary?.average_quality?.toFixed(2) ?? '0.00';

  return (
    <div className="rpt-page" style={{ opacity: isPending ? 0.7 : 1, transition: 'opacity 150ms' }}>
      <div className="rpt-page-header">
        <div className="rpt-eyebrow">Reporting</div>
        <h2 className="rpt-page-title">Reports</h2>
        <p className="rpt-page-sub">Filter by date, team, and agent.</p>
      </div>

      <div className="rpt-filter-panel">
        <div className="rpt-filter-grid">
          <div><label className="rpt-label">From</label><input className="rpt-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div><label className="rpt-label">To</label><input className="rpt-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          <div><label className="rpt-label">Team</label><select className="rpt-select" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}><option value="">All Teams</option><option value="Calls">Calls</option><option value="Tickets">Tickets</option><option value="Sales">Sales</option></select></div>
          <div className="rpt-agent-picker" ref={agentPickerRef}>
            <label className="rpt-label">Agents</label>
            <button type="button" className="rpt-agent-picker-btn" onClick={() => setIsAgentPickerOpen((open) => !open)}><span>{selectedAgents.length === 0 ? 'All Agents' : selectedAgents.length === 1 ? selectedAgents[0].agent_name : `${selectedAgents.length} agents selected`}</span><span>v</span></button>
            {isAgentPickerOpen && (
              <div className="rpt-agent-menu">
                <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}><input className="rpt-input" value={agentSearch} onChange={(e) => setAgentSearch(e.target.value)} placeholder="Search agents..." /></div>
                <div className="rpt-agent-list">
                  {profiles.filter((p) => !teamFilter || p.team === teamFilter).filter((p) => {
                    const q = agentSearch.trim().toLowerCase();
                    if (!q) return true;
                    return [p.agent_name, p.display_name ?? '', p.agent_id ?? '', p.email ?? ''].join(' ').toLowerCase().includes(q);
                  }).map((p) => {
                    const active = selectedAgentProfileIds.includes(p.id);
                    return <button key={p.id} type="button" className={`rpt-agent-option${active ? ' active' : ''}`} onClick={() => setSelectedAgentProfileIds((prev) => prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id])}>{p.agent_name}{p.display_name ? ` - ${p.display_name}` : ''}{p.team ? ` - ${p.team}` : ''}</button>;
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="rpt-filter-actions"><button type="button" className="rpt-export-btn" onClick={() => { setDateFrom(''); setDateTo(''); setTeamFilter(''); setSelectedAgentProfileIds([]); setAgentSearch(''); }}>Clear filters</button></div>
        </div>
      </div>

      <div className="rpt-export-bar">
        <span className="rpt-export-label">Export</span>
        <button className="rpt-export-btn rpt-export-btn-primary" onClick={() => exportSummaryCsv(summary)}>Summary</button>
        <button className="rpt-export-btn" onClick={() => exportAuditsCsv(auditRows)}>Audits current page</button>
        <button className="rpt-export-btn rpt-export-btn-primary" onClick={handleExportTrend} disabled={exporting}>{exporting ? 'Building...' : 'Trends Excel + Chart'}</button>
      </div>

      <Section title="Summary">
        <div className="rpt-kpi-grid">
          <KpiCard label="Total Audits" value={String(summary?.total_audits ?? 0)} accent="var(--accent-blue)" delay={0} />
          <KpiCard label="Average Quality" value={`${avg}%`} accent="var(--accent-emerald)" accentValue delay={40} />
          <KpiCard label="Calls Avg" value={`${summary?.calls_avg?.toFixed(2) ?? '0.00'}%`} accent="var(--accent-cyan)" delay={80} />
          <KpiCard label="Tickets Avg" value={`${summary?.tickets_avg?.toFixed(2) ?? '0.00'}%`} accent="var(--accent-violet)" delay={120} />
          <KpiCard label="Sales Avg" value={`${summary?.sales_avg?.toFixed(2) ?? '0.00'}%`} accent="var(--accent-emerald)" delay={160} />
        </div>
      </Section>

      <Section title="Performance Trends" count={trendPoints.length}>
        <div className="rpt-toggle-group">
          {(['weekly', 'monthly'] as const).map((mode) => <button key={mode} type="button" className={`rpt-toggle-btn${periodMode === mode ? ' active' : ''}`} onClick={() => setPeriodMode(mode)}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>)}
        </div>
        <MiniTrendChart points={trendPoints} />
        <Section title="Recurring Issues" count={recurringIssues.length}>
          {recurringIssues.map((issue, idx) => (
            <div key={issue.metric} className="rpt-issue-card" style={{ animationDelay: `${idx * 40}ms` }}>
              <div className="rpt-issue-header"><div className="rpt-issue-metric">{issue.metric}</div><div className="rpt-issue-count">{issue.count}</div></div>
              <div className="rpt-issue-meta">Borderline: {issue.borderlineCount} - Fail: {issue.failCount} - Auto-Fail: {issue.autoFailCount}</div>
              <div className="rpt-issue-bar-track"><div className="rpt-issue-bar-fill" style={{ width: `${Math.round((issue.count / (recurringIssues[0]?.count || 1)) * 100)}%` }} /></div>
            </div>
          ))}
        </Section>
      </Section>

      <Section title="Recent Audits" count={summary?.total_audits}>
        {auditRows.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>No audits in this range.</div> : (
          <>
            <div className="rpt-table-wrap">
              <div className="rpt-table-head-row" style={{ gridTemplateColumns: '1fr 1.3fr 1fr 1.7fr 0.7fr' }}><div>Date</div><div>Agent</div><div>Team</div><div>Case Type</div><div>Score</div></div>
              {auditRows.map((item) => <div key={item.id} className="rpt-table-body-row" style={{ gridTemplateColumns: '1fr 1.3fr 1fr 1.7fr 0.7fr' }}><div>{item.audit_date ?? '-'}</div><div>{item.agent_name || item.agent_id || '-'}</div><div>{item.team ?? '-'}</div><div>{item.case_type ?? '-'}</div><div>{Number(item.quality_score ?? 0).toFixed(2)}%</div></div>)}
            </div>
            {hasMoreAudits && <button type="button" className="rpt-export-btn" style={{ marginTop: 10 }} onClick={loadMoreAudits}>Load more audits</button>}
          </>
        )}
      </Section>

      <Section title="Supervisor Requests" count={requestRows.length}>
        {requestRows.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>No supervisor requests in this range.</div> : <div className="rpt-table-wrap"><div className="rpt-table-head-row" style={{ gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr' }}><div>Created</div><div>Agent</div><div>Type</div><div>Status</div></div>{requestRows.map((row) => <div key={row.id} className="rpt-table-body-row" style={{ gridTemplateColumns: '1.2fr 1.2fr 1fr 1fr' }}><div>{row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}</div><div>{row.agent_name || row.agent_id || '-'}</div><div>{row.request_type || '-'}</div><div>{row.status || '-'}</div></div>)}</div>}
      </Section>

      <Section title="Agent Feedback" count={feedbackRows.length}>
        {feedbackRows.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>No feedback in this range.</div> : <div className="rpt-table-wrap"><div className="rpt-table-head-row" style={{ gridTemplateColumns: '1.1fr 1.2fr 1fr 2fr' }}><div>Created</div><div>Agent</div><div>Status</div><div>Feedback</div></div>{feedbackRows.map((row) => <div key={row.id} className="rpt-table-body-row" style={{ gridTemplateColumns: '1.1fr 1.2fr 1fr 2fr' }}><div>{row.created_at ? new Date(row.created_at).toLocaleDateString() : '-'}</div><div>{row.agent_name || row.agent_id || '-'}</div><div>{row.status || row.category || '-'}</div><div className="rpt-muted">{row.feedback || row.message || '-'}</div></div>)}</div>}
      </Section>
    </div>
  );
}

export default ReportsSupabase;
