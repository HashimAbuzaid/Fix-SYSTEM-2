import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

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
  averageQuality: number | null;
  cells: MetricCell[];
};

type TeamHeatmapSupabaseProps = {
  currentUser: CurrentUser;
};

const FLAG_RESULTS = new Set(['Borderline', 'Fail', 'Auto-Fail']);
const MAX_HEATMAP_METRICS = 8;
const TEAM_OPTIONS: ThemeTeamName[] = ['Calls', 'Tickets', 'Sales'];

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
    average(audits.map((item) => Number(item.quality_score)).filter((value) => Number.isFinite(value)))
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

function getHeatCellTone(rate: number) {
  if (rate >= 0.5) {
    return {
      background: 'linear-gradient(180deg, rgba(254,226,226,0.98) 0%, rgba(254,202,202,0.98) 100%)',
      color: '#991b1b',
      border: '1px solid rgba(239,68,68,0.28)',
    };
  }

  if (rate >= 0.3) {
    return {
      background: 'linear-gradient(180deg, rgba(255,247,237,0.98) 0%, rgba(254,215,170,0.96) 100%)',
      color: '#b45309',
      border: '1px solid rgba(245,158,11,0.26)',
    };
  }

  if (rate > 0) {
    return {
      background: 'linear-gradient(180deg, rgba(239,246,255,0.98) 0%, rgba(191,219,254,0.96) 100%)',
      color: '#1d4ed8',
      border: '1px solid rgba(59,130,246,0.24)',
    };
  }

  return {
    background: 'linear-gradient(180deg, rgba(240,253,244,0.98) 0%, rgba(220,252,231,0.96) 100%)',
    color: '#166534',
    border: '1px solid rgba(34,197,94,0.22)',
  };
}

export default function TeamHeatmapSupabase({ currentUser }: TeamHeatmapSupabaseProps) {
  const [selectedTeam, setSelectedTeam] = useState<ThemeTeamName>(currentUser.team || 'Calls');
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const canChangeTeam = currentUser.role === 'admin';

  useEffect(() => {
    if (currentUser.role !== 'admin' && currentUser.team) {
      setSelectedTeam(currentUser.team);
    }
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

    if (errors.length > 0) {
      setErrorMessage(errors.join(' | '));
    }

    setAgents((agentsResult.data as AgentProfile[]) || []);
    setAudits((auditsResult.data as AuditItem[]) || []);
    setLoading(false);
    setRefreshing(false);
  }

  const filteredAudits = useMemo(() => {
    return audits.filter((audit) => matchesDateRange(audit.audit_date, dateFrom, dateTo));
  }, [audits, dateFrom, dateTo]);

  const metricUniverse = useMemo(() => getMetricUniverse(filteredAudits), [filteredAudits]);

  const agentAuditMap = useMemo(() => {
    const map = new Map<string, AuditItem[]>();
    filteredAudits.forEach((audit) => {
      const key = buildAgentKey(audit.agent_id, audit.agent_name);
      const current = map.get(key) || [];
      current.push(audit);
      map.set(key, current);
    });

    map.forEach((value) => {
      value.sort((a, b) => String(b.audit_date).localeCompare(String(a.audit_date)));
    });

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
  }, [agents, agentAuditMap, metricUniverse]);

  const teamAverageQuality = getAverageQualityForAudits(filteredAudits);

  function clearDates() {
    setDateFrom('');
    setDateTo('');
  }

  if (loading) {
    return (
      <div style={loadingStyle} className="da-themed-loader-shell da-themed-loader-shell--page">
        <div className="da-themed-loader-card">
          <div className="da-themed-loader">
            <div className="da-themed-loader__art" aria-hidden="true">
              <div className="da-themed-loader__glow" />
              <div className="da-themed-loader__rotor">
                <div className="da-themed-loader__rotor-face" />
                <div className="da-themed-loader__hub" />
              </div>
              <div className="da-themed-loader__caliper" />
              <div className="da-themed-loader__spark" />
            </div>
            <div className="da-themed-loader__copy">
              <div className="da-themed-loader__eyebrow">Detroit Axle</div>
              <div className="da-themed-loader__label">Loading team heatmap...</div>
              <div className="da-themed-loader__sub">Mapping quality pressure by metric</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section style={rootStyle}>
      <div style={heroPanelStyle}>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrowStyle}>Team Heatmap</div>
          <h2 style={titleStyle}>{selectedTeam} Heatmap</h2>
          <p style={subtitleStyle}>
            Standalone issue-rate heatmap by agent and audit metric. Clearer heat tones and date filtering are included here.
          </p>
        </div>

        <div style={toolbarStyle}>
          <div style={toolbarFieldWrapStyle}>
            <label style={labelStyle}>Team</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value as ThemeTeamName)}
              disabled={!canChangeTeam}
              style={fieldStyle}
            >
              {TEAM_OPTIONS.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          <div style={toolbarFieldWrapStyle}>
            <label style={labelStyle}>Date From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={fieldStyle} />
          </div>

          <div style={toolbarFieldWrapStyle}>
            <label style={labelStyle}>Date To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={fieldStyle} />
          </div>

          <button type="button" onClick={clearDates} style={secondaryButtonStyle}>
            Clear Dates
          </button>

          <button
            type="button"
            onClick={() => void loadHeatmap(true)}
            disabled={refreshing}
            style={refreshButtonStyle}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Heatmap'}
          </button>
        </div>
      </div>

      <div style={summaryStripStyle}>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Agents</div>
          <div style={summaryValueStyle}>{agents.length}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Audits</div>
          <div style={summaryValueStyle}>{filteredAudits.length}</div>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Average Quality</div>
          <div style={summaryValueStyle}>
            {teamAverageQuality != null ? `${teamAverageQuality.toFixed(2)}%` : '-'}
          </div>
        </div>
      </div>

      {errorMessage ? <div style={errorBannerStyle}>{errorMessage}</div> : null}

      {heatmapRows.length === 0 || metricUniverse.length === 0 ? (
        <div style={emptyStateStyle}>No audit score detail data is available for this heatmap in the selected date range.</div>
      ) : (
        <div style={heatmapWrapStyle}>
          <div style={heatmapTableStyle}>
            <div style={{ ...heatmapRowStyle, ...heatmapHeaderRowStyle }}>
              <div style={heatmapAgentCellStyle}>Agent</div>
              <div style={heatmapAvgCellStyle}>Avg</div>
              {metricUniverse.map((metric) => (
                <div key={metric} style={heatmapMetricHeaderCellStyle}>
                  {metric}
                </div>
              ))}
            </div>

            {heatmapRows.map((row) => (
              <div key={row.agentKey} style={heatmapRowStyle}>
                <div style={heatmapAgentCellStyle}>
                  <div style={cellPrimaryStyle}>{row.label}</div>
                </div>

                <div style={heatmapAvgCellStyle}>
                  <span style={metricPillStyle}>
                    {row.averageQuality != null ? `${row.averageQuality.toFixed(2)}%` : '-'}
                  </span>
                </div>

                {row.cells.map((cell) => {
                  const tone = getHeatCellTone(cell.rate);
                  return (
                    <div
                      key={`${row.agentKey}-${cell.metric}`}
                      style={{
                        ...heatmapMetricCellStyle,
                        background: tone.background,
                        color: tone.color,
                        border: tone.border,
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
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const rootStyle: CSSProperties = {
  display: 'grid',
  gap: '18px',
};

const loadingStyle: CSSProperties = {
  color: 'var(--da-muted-text, #cbd5e1)',
  fontSize: '14px',
};

const heroPanelStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-end',
  gap: '18px',
  flexWrap: 'wrap',
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

const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: '12px',
  flexWrap: 'wrap',
};

const toolbarFieldWrapStyle: CSSProperties = {
  display: 'grid',
  gap: '8px',
  minWidth: '170px',
};

const labelStyle: CSSProperties = {
  color: 'var(--da-muted-text, #334155)',
  fontWeight: 700,
  fontSize: '13px',
};

const fieldStyle: CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: 'var(--da-field-border, 1px solid rgba(148,163,184,0.16))',
  background: 'var(--da-field-bg, rgba(15,23,42,0.7))',
  color: 'var(--da-field-text, #e5eefb)',
};

const refreshButtonStyle: CSSProperties = {
  backgroundColor: 'var(--da-secondary-bg, rgba(15,23,42,0.78))',
  color: 'var(--da-secondary-text, #e5eefb)',
  border: 'var(--da-secondary-border, 1px solid rgba(148,163,184,0.18))',
  padding: '12px 16px',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 700,
};

const secondaryButtonStyle: CSSProperties = {
  background: 'rgba(37,99,235,0.10)',
  color: '#1d4ed8',
  border: '1px solid rgba(59,130,246,0.20)',
  padding: '12px 16px',
  borderRadius: '12px',
  cursor: 'pointer',
  fontWeight: 700,
};

const summaryStripStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
};

const summaryCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '18px',
  background: 'var(--da-card-bg, rgba(255,255,255,0.99))',
  border: 'var(--da-panel-border, 1px solid rgba(203,213,225,0.94))',
  boxShadow: 'var(--da-panel-shadow, 0 10px 24px rgba(15,23,42,0.08))',
};

const summaryLabelStyle: CSSProperties = {
  color: 'var(--da-subtle-text, #94a3b8)',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontWeight: 800,
};

const summaryValueStyle: CSSProperties = {
  marginTop: '10px',
  color: 'var(--da-title, #f8fafc)',
  fontWeight: 900,
  fontSize: '28px',
};

const errorBannerStyle: CSSProperties = {
  padding: '12px 14px',
  borderRadius: '10px',
  backgroundColor: 'rgba(127,29,29,0.24)',
  border: '1px solid rgba(248,113,113,0.22)',
  color: 'var(--da-error-text, #fecaca)',
};

const heatmapWrapStyle: CSSProperties = {
  overflowX: 'auto',
  borderRadius: '18px',
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'var(--da-card-bg, rgba(15,23,42,0.52))',
  boxShadow: 'var(--da-panel-shadow, 0 10px 24px rgba(15,23,42,0.08))',
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

const heatmapMetricHeaderCellStyle: CSSProperties = {
  minWidth: 0,
  padding: '10px 8px',
  borderRadius: '12px',
  textAlign: 'center',
  color: '#2563eb',
  background: 'rgba(37,99,235,0.06)',
  border: '1px solid rgba(59,130,246,0.12)',
};

const heatmapMetricCellStyle: CSSProperties = {
  minWidth: 0,
  padding: '12px 8px',
  borderRadius: '12px',
  textAlign: 'center',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)',
};

const heatCellTopStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: '14px',
  lineHeight: 1.1,
};

const heatCellBottomStyle: CSSProperties = {
  marginTop: '4px',
  fontSize: '12px',
  opacity: 0.95,
  fontWeight: 700,
};

const cellPrimaryStyle: CSSProperties = {
  color: 'var(--da-title, #f8fafc)',
  fontWeight: 700,
  fontSize: '14px',
  lineHeight: 1.4,
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

const emptyStateStyle: CSSProperties = {
  color: 'var(--da-muted-text, #cbd5e1)',
  fontSize: '14px',
  lineHeight: 1.6,
  borderRadius: '18px',
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'var(--da-card-bg, rgba(255,255,255,0.99))',
  padding: '20px',
};
