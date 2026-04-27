import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────

type ThemeTeamName = 'Calls' | 'Tickets' | 'Sales';
type AllowedRole = 'admin' | 'qa';

type CurrentUser = {
  id: string;
  role: AllowedRole | 'agent' | 'supervisor';
  team: ThemeTeamName | null;
};

type AgentProfile = {
  id: string;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: ThemeTeamName | null;
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
  team: ThemeTeamName;
  case_type: string;
  audit_date: string;
  quality_score: number;
  comments: string | null;
  score_details: ScoreDetail[];
};

type MetricCell = {
  metric: string;
  total: number;
  flagged: number;
  rate: number;
};

type HeatmapRow = {
  agentKey: string;
  label: string;
  agentId: string | null;
  averageQuality: number | null;
  cells: MetricCell[];
};

type SortConfig = {
  col: 'avg' | number;
  dir: 1 | -1;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FLAG_RESULTS = new Set(['Borderline', 'Fail', 'Auto-Fail']);
const MAX_HEATMAP_METRICS = 8;
const TEAM_OPTIONS: ThemeTeamName[] = ['Calls', 'Tickets', 'Sales'];

// ─── Data helpers (unchanged from original) ──────────────────────────────────

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
  return profile.display_name ?? profile.agent_name;
}
function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
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
function getAverageQualityForAudits(audits: AuditItem[]) {
  return roundScore(
    average(audits.map((item) => Number(item.quality_score)).filter((v) => Number.isFinite(v)))
  );
}
function toDateOnly(value?: string | null) {
  return String(value || '').slice(0, 10);
}
function matchesDateRange(dateValue?: string | null, from?: string, to?: string) {
  const value = toDateOnly(dateValue);
  if (!value) return false;
  const effectiveFrom = from || '0001-01-01';
  const effectiveTo = to || '9999-12-31';
  return value >= effectiveFrom && value <= effectiveTo;
}

// ─── Cell tone helper ─────────────────────────────────────────────────────────

function getCellClass(rate: number, total: number): 'empty' | 'green' | 'blue' | 'amber' | 'red' {
  if (total === 0) return 'empty';
  if (rate === 0) return 'green';
  if (rate < 0.3) return 'blue';
  if (rate < 0.5) return 'amber';
  return 'red';
}

function getAvgColor(avg: number | null): string {
  if (avg == null) return 'var(--da-muted)';
  if (avg >= 90) return '#6ee7b7';
  if (avg >= 80) return '#93c5fd';
  if (avg >= 70) return '#fcd34d';
  return '#fca5a5';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeamHeatmapSupabase({ currentUser }: { currentUser: CurrentUser }) {
  const [selectedTeam, setSelectedTeam] = useState<ThemeTeamName>(currentUser.team || 'Calls');
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<SortConfig>({ col: 'avg', dir: 1 });

  const canChangeTeam = currentUser.role === 'admin';

  useEffect(() => {
    if (currentUser.role !== 'admin' && currentUser.team) setSelectedTeam(currentUser.team);
  }, [currentUser.role, currentUser.team]);

  useEffect(() => {
    void loadHeatmap(false);
  }, [selectedTeam]);

  async function loadHeatmap(isRefresh: boolean) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage('');

    const [agentsResult, auditsResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, agent_id, agent_name, display_name, team, email')
        .eq('role', 'agent')
        .eq('team', selectedTeam)
        .order('agent_name', { ascending: true }),
      supabase
        .from('audits')
        .select('id, agent_id, agent_name, team, case_type, audit_date, quality_score, comments, score_details')
        .eq('team', selectedTeam)
        .order('audit_date', { ascending: false }),
    ]);

    const errors = [agentsResult.error?.message, auditsResult.error?.message].filter(Boolean);
    if (errors.length > 0) setErrorMessage(errors.join(' | '));

    setAgents((agentsResult.data as AgentProfile[]) || []);
    setAudits((auditsResult.data as AuditItem[]) || []);
    setLoading(false);
    setRefreshing(false);
  }

  const filteredAudits = useMemo(
    () => audits.filter((a) => matchesDateRange(a.audit_date, dateFrom, dateTo)),
    [audits, dateFrom, dateTo]
  );

  const metricUniverse = useMemo(() => getMetricUniverse(filteredAudits), [filteredAudits]);

  const agentAuditMap = useMemo(() => {
    const map = new Map<string, AuditItem[]>();
    filteredAudits.forEach((audit) => {
      const key = buildAgentKey(audit.agent_id, audit.agent_name);
      const current = map.get(key) || [];
      current.push(audit);
      map.set(key, current);
    });
    map.forEach((v) => v.sort((a, b) => String(b.audit_date).localeCompare(String(a.audit_date))));
    return map;
  }, [filteredAudits]);

  const heatmapRows = useMemo<HeatmapRow[]>(() => {
    return agents.map((agent) => {
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
        return { metric, total, flagged, rate: total > 0 ? flagged / total : 0 };
      });
      return {
        agentKey: key,
        label: getAgentLabel(agent),
        agentId: agent.agent_id,
        averageQuality: getAverageQualityForAudits(agentAudits),
        cells,
      };
    });
  }, [agents, agentAuditMap, metricUniverse]);

  const sortedRows = useMemo(() => {
    return [...heatmapRows].sort((a, b) => {
      if (sort.col === 'avg') {
        const av = a.averageQuality ?? -1;
        const bv = b.averageQuality ?? -1;
        return sort.dir * (av - bv);
      }
      const ai = typeof sort.col === 'number' ? sort.col : 0;
      return sort.dir * ((a.cells[ai]?.rate ?? 0) - (b.cells[ai]?.rate ?? 0));
    });
  }, [heatmapRows, sort]);

  const teamAverageQuality = getAverageQualityForAudits(filteredAudits);

  function toggleSort(col: SortConfig['col']) {
    setSort((prev) =>
      prev.col === col ? { col, dir: (prev.dir * -1) as 1 | -1 } : { col, dir: 1 }
    );
  }

  function clearDates() {
    setDateFrom('');
    setDateTo('');
  }

  // ─── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={s.loadingShell}>
        <div style={s.loadingCard}>
          <div style={s.spinnerRing} />
          <div>
            <div style={s.loadingEyebrow}>Team Heatmap</div>
            <div style={s.loadingLabel}>Loading quality data…</div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────────

  const SortIcon = ({ col }: { col: SortConfig['col'] }) => (
    <span style={{ ...s.sortIcon, color: sort.col === col ? '#60a5fa' : undefined }}>
      {sort.col === col ? (sort.dir === 1 ? '↑' : '↓') : '⇅'}
    </span>
  );

  return (
    <section style={s.root}>
      {/* ── Top bar ── */}
      <div style={s.topbar}>
        <div style={{ minWidth: 0 }}>
          <div style={s.eyebrow}>QA Platform &bull; Analytics</div>
          <h2 style={s.title}>{selectedTeam} — Team Heatmap</h2>
          <p style={s.subtitle}>
            Issue-rate by agent &times; metric. Darker cells signal higher flag rates. Click headers to sort.
          </p>
        </div>
        <div style={s.toolbar}>
          <div style={s.fieldWrap}>
            <label style={s.fieldLabel}>Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value as ThemeTeamName)}
              disabled={!canChangeTeam}
              style={s.select}
            >
              {TEAM_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={s.fieldWrap}>
            <label style={s.fieldLabel}>Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={s.dateInput}
            />
          </div>
          <div style={s.fieldWrap}>
            <label style={s.fieldLabel}>Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={s.dateInput}
            />
          </div>
          <button type="button" onClick={clearDates} style={s.btnGhost}>Clear</button>
          <button
            type="button"
            onClick={() => void loadHeatmap(true)}
            disabled={refreshing}
            style={s.btnPrimary}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={s.statsRow}>
        {[
          { label: 'Agents', value: agents.length.toString() },
          { label: 'Total Audits', value: filteredAudits.length.toString() },
          {
            label: 'Avg Quality',
            value: teamAverageQuality != null ? `${teamAverageQuality.toFixed(1)}%` : '—',
          },
        ].map(({ label, value }) => (
          <div key={label} style={s.statCard}>
            <div style={s.statLabel}>{label}</div>
            <div style={s.statValue}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Legend ── */}
      <div style={s.legend}>
        <span style={s.legendLabel}>Issue rate:</span>
        {[
          { tone: 'green' as const, text: '0%' },
          { tone: 'blue' as const, text: '1–29%' },
          { tone: 'amber' as const, text: '30–49%' },
          { tone: 'red' as const, text: '50%+' },
        ].map(({ tone, text }) => (
          <div key={tone} style={s.legendItem}>
            <div style={{ ...s.legendDot, ...CELL_TONES[tone].dot }} />
            <span>{text}</span>
          </div>
        ))}
      </div>

      {/* ── Error ── */}
      {errorMessage && <div style={s.error}>{errorMessage}</div>}

      {/* ── Table ── */}
      {heatmapRows.length === 0 || metricUniverse.length === 0 ? (
        <div style={s.emptyState}>No audit data available for the selected date range.</div>
      ) : (
        <div style={s.tableWrap}>
          <div style={s.tableScroll}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={{ ...s.th, ...s.thAgent }}>Agent</th>
                  <th
                    style={{ ...s.th, ...s.thAvg, cursor: 'pointer' }}
                    onClick={() => toggleSort('avg')}
                  >
                    Avg &nbsp;<SortIcon col="avg" />
                  </th>
                  {metricUniverse.map((metric, i) => (
                    <th
                      key={metric}
                      style={{ ...s.th, ...s.thMetric, cursor: 'pointer' }}
                      onClick={() => toggleSort(i)}
                    >
                      {metric} &nbsp;<SortIcon col={i} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.agentKey} style={s.tr}>
                    {/* Agent name */}
                    <td style={{ ...s.td, ...s.tdAgent }}>
                      <div style={s.agentName}>{row.label}</div>
                      {row.agentId && <div style={s.agentSub}>{row.agentId}</div>}
                    </td>
                    {/* Average */}
                    <td style={s.td}>
                      <div
                        style={{
                          ...s.avgPill,
                          color: getAvgColor(row.averageQuality),
                          borderColor: getAvgColor(row.averageQuality) + '44',
                          background: getAvgColor(row.averageQuality) + '14',
                        }}
                      >
                        {row.averageQuality != null ? `${row.averageQuality.toFixed(1)}%` : '—'}
                      </div>
                    </td>
                    {/* Metric cells */}
                    {row.cells.map((cell) => {
                      const cls = getCellClass(cell.rate, cell.total);
                      const tone = CELL_TONES[cls];
                      const pct = cell.total === 0 ? '—' : `${Math.round(cell.rate * 100)}%`;
                      const frac = `${cell.flagged}/${cell.total}`;
                      return (
                        <td key={`${row.agentKey}-${cell.metric}`} style={s.td}>
                          <div
                            style={{ ...s.cell, ...tone.cell }}
                            title={
                              cell.total > 0
                                ? `${cell.metric}: ${cell.flagged} flagged of ${cell.total}`
                                : `${cell.metric}: no checks yet`
                            }
                          >
                            <div style={{ ...s.cellPct, color: tone.cell.color }}>{pct}</div>
                            <div style={{ ...s.cellFrac, color: tone.cell.color }}>{frac}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Cell tone definitions ───────────────────────────────────────────────────

const CELL_TONES = {
  empty: {
    cell: {
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      color: '#374151',
    },
    dot: { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' },
  },
  green: {
    cell: {
      background: 'rgba(16,185,129,0.08)',
      border: '1px solid rgba(16,185,129,0.2)',
      color: '#6ee7b7',
    },
    dot: { background: 'rgba(16,185,129,0.25)', border: '1px solid rgba(16,185,129,0.4)' },
  },
  blue: {
    cell: {
      background: 'rgba(59,130,246,0.09)',
      border: '1px solid rgba(59,130,246,0.2)',
      color: '#93c5fd',
    },
    dot: { background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.35)' },
  },
  amber: {
    cell: {
      background: 'rgba(245,158,11,0.09)',
      border: '1px solid rgba(245,158,11,0.22)',
      color: '#fcd34d',
    },
    dot: { background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)' },
  },
  red: {
    cell: {
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.22)',
      color: '#fca5a5',
    },
    dot: { background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' },
  },
} satisfies Record<string, { cell: CSSProperties; dot: CSSProperties }>;

// ─── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },

  // Loading
  loadingShell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 0',
  },
  loadingCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px 24px',
    borderRadius: '14px',
    background: 'var(--da-card-bg, rgba(19,22,29,0.9))',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  spinnerRing: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid rgba(59,130,246,0.2)',
    borderTopColor: '#3b82f6',
    animation: 'spin 0.8s linear infinite',
  },
  loadingEyebrow: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#3b82f6',
    marginBottom: '2px',
  },
  loadingLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--da-title, #e8ecf3)',
  },

  // Top bar
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '20px',
    flexWrap: 'wrap',
    padding: '22px 24px',
    borderRadius: '14px',
    background: 'var(--da-card-bg, rgba(19,22,29,0.95))',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  eyebrow: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#3b82f6',
    marginBottom: '7px',
    fontFamily: 'var(--font-mono, monospace)',
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 600,
    letterSpacing: '-0.03em',
    color: 'var(--da-title, #e8ecf3)',
    lineHeight: 1.1,
  },
  subtitle: {
    margin: '6px 0 0',
    fontSize: '13px',
    color: 'var(--da-muted-text, #6b7280)',
    lineHeight: 1.5,
    maxWidth: '420px',
  },

  // Toolbar
  toolbar: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
    flexWrap: 'wrap',
  },
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  fieldLabel: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--da-muted-text, #6b7280)',
  },
  select: {
    height: '34px',
    padding: '0 10px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--da-field-text, #e8ecf3)',
    fontFamily: 'inherit',
    fontSize: '13px',
    outline: 'none',
    cursor: 'pointer',
    minWidth: '110px',
  },
  dateInput: {
    height: '34px',
    padding: '0 10px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--da-field-text, #e8ecf3)',
    fontFamily: 'inherit',
    fontSize: '13px',
    outline: 'none',
    minWidth: '136px',
  },
  btnGhost: {
    height: '34px',
    padding: '0 14px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: 'var(--da-muted-text, #6b7280)',
    fontFamily: 'inherit',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  btnPrimary: {
    height: '34px',
    padding: '0 16px',
    borderRadius: '8px',
    border: '1px solid rgba(59,130,246,0.3)',
    background: 'rgba(59,130,246,0.12)',
    color: '#60a5fa',
    fontFamily: 'inherit',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  // Stats
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  statCard: {
    padding: '14px 18px',
    borderRadius: '12px',
    background: 'var(--da-card-bg, rgba(19,22,29,0.9))',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  statLabel: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--da-muted-text, #6b7280)',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 600,
    letterSpacing: '-0.03em',
    color: 'var(--da-title, #e8ecf3)',
    fontFamily: 'var(--font-mono, monospace)',
  },

  // Legend
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    padding: '10px 14px',
    borderRadius: '10px',
    background: 'var(--da-card-bg, rgba(19,22,29,0.9))',
    border: '1px solid rgba(255,255,255,0.07)',
    fontSize: '11px',
    color: 'var(--da-muted-text, #6b7280)',
  },
  legendLabel: {
    fontWeight: 600,
    marginRight: '4px',
    color: 'var(--da-muted-text, #9ca3af)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  legendDot: {
    width: '10px',
    height: '10px',
    borderRadius: '3px',
  },

  // Error
  error: {
    padding: '12px 16px',
    borderRadius: '10px',
    background: 'rgba(127,29,29,0.2)',
    border: '1px solid rgba(248,113,113,0.2)',
    color: '#fca5a5',
    fontSize: '13px',
  },

  // Table
  tableWrap: {
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.07)',
    background: 'var(--da-card-bg, rgba(19,22,29,0.9))',
    overflow: 'hidden',
  },
  tableScroll: {
    overflowX: 'auto',
  },
  table: {
    minWidth: '900px',
    width: '100%',
    borderCollapse: 'collapse',
  },
  thead: {
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--da-muted-text, #6b7280)',
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  },
  thAgent: {
    minWidth: '180px',
  },
  thAvg: {
    minWidth: '80px',
  },
  thMetric: {
    textAlign: 'center' as const,
    color: '#60a5fa',
    fontFamily: 'var(--font-mono, monospace)',
    minWidth: '80px',
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    transition: 'background 0.12s',
  },
  td: {
    padding: '8px 10px',
    verticalAlign: 'middle' as const,
  },
  tdAgent: {
    padding: '10px 12px',
  },

  // Agent cell
  agentName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--da-title, #e8ecf3)',
    lineHeight: 1.3,
  },
  agentSub: {
    fontSize: '11px',
    color: 'var(--da-muted-text, #6b7280)',
    fontFamily: 'var(--font-mono, monospace)',
    marginTop: '2px',
  },

  // Avg pill
  avgPill: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '26px',
    padding: '0 10px',
    borderRadius: '999px',
    border: '1px solid',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: 'var(--font-mono, monospace)',
    whiteSpace: 'nowrap' as const,
  },

  // Heat cell
  cell: {
    borderRadius: '8px',
    padding: '8px 6px',
    textAlign: 'center' as const,
    cursor: 'default',
    transition: 'transform 0.12s',
    minWidth: '64px',
  },
  cellPct: {
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'var(--font-mono, monospace)',
    lineHeight: 1.1,
  },
  cellFrac: {
    fontSize: '10px',
    opacity: 0.75,
    marginTop: '3px',
    fontFamily: 'var(--font-mono, monospace)',
  },

  // Sort icon
  sortIcon: {
    fontSize: '9px',
    opacity: 0.6,
    cursor: 'pointer',
    verticalAlign: 'middle',
  },

  // Empty state
  emptyState: {
    padding: '40px 24px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.07)',
    background: 'var(--da-card-bg, rgba(19,22,29,0.9))',
    color: 'var(--da-muted-text, #6b7280)',
    fontSize: '13px',
    lineHeight: 1.6,
    textAlign: 'center',
  },
};
