import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

type TeamName = 'Calls' | 'Tickets' | 'Sales';
type PeriodMode = 'weekly' | 'monthly';

type ScoreDetail = {
  metric: string;
  result: string;
  pass: number;
  borderline: number;
  adjusted_weight?: number;
  adjustedWeight?: number;
  earned: number;
  counts_toward_score?: boolean;
  metric_comment?: string | null;
};

type AuditItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName | string;
  case_type: string;
  audit_date: string;
  order_number: string | null;
  phone_number: string | null;
  ticket_id: string | null;
  quality_score: number;
  comments: string | null;
  score_details?: ScoreDetail[];
};

type AgentProfile = {
  id: string;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
};

type CallsRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  calls_count: number;
  call_date: string;
  notes: string | null;
};

type TicketsRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  tickets_count: number;
  ticket_date: string;
  notes: string | null;
};

type SalesRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  amount: number;
  sale_date: string;
  notes: string | null;
};

type SupervisorRequest = {
  id: string;
  status: 'Open' | 'Under Review' | 'Closed';
  created_at: string;
  team: string | null;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  case_reference: string;
  agent_id?: string | null;
  agent_name?: string | null;
  case_type?: string;
  supervisor_name?: string;
  request_note?: string;
};

type AgentFeedback = {
  id: string;
  status: 'Open' | 'In Progress' | 'Closed';
  created_at: string;
  team: string;
  feedback_type: 'Coaching' | 'Audit Feedback' | 'Warning' | 'Follow-up';
  agent_name: string;
  agent_id?: string;
  qa_name?: string;
  subject: string;
  feedback_note?: string;
  action_plan?: string | null;
  due_date?: string | null;
};

type TrendPoint = {
  key: string;
  label: string;
  shortLabel: string;
  subjectAverage: number | null;
  teamAverage: number | null;
  auditCount: number;
  teamAuditCount: number;
};

type RecurringIssue = {
  metric: string;
  count: number;
  borderlineCount: number;
  failCount: number;
  autoFailCount: number;
};

const ISSUE_RESULTS = new Set(['Borderline', 'Fail', 'Auto-Fail']);


function getReportsThemeVars(): Record<string, string> {
  const themeMode =
    typeof document !== 'undefined'
      ? (
          document.body.dataset.theme ||
          document.documentElement.dataset.theme ||
          document.documentElement.getAttribute('data-theme-mode') ||
          window.localStorage.getItem('detroit-axle-theme-mode') ||
          window.sessionStorage.getItem('detroit-axle-theme-mode') ||
          window.localStorage.getItem('detroit-axle-theme') ||
          window.sessionStorage.getItem('detroit-axle-theme') ||
          ''
        ).toLowerCase()
      : '';

  const isLight = themeMode === 'light' || themeMode === 'white';

  return {
    '--screen-text': isLight ? '#334155' : '#e5eefb',
    '--screen-heading': isLight ? '#0f172a' : '#f8fafc',
    '--screen-muted': isLight ? '#64748b' : '#94a3b8',
    '--screen-subtle': isLight ? '#64748b' : '#94a3b8',
    '--screen-accent': isLight ? '#2563eb' : '#60a5fa',
    '--screen-panel-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,250,255,0.96) 100%)'
      : 'linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.68) 100%)',
    '--screen-card-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,255,0.97) 100%)'
      : 'linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.68) 100%)',
    '--screen-card-soft-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,248,253,0.96) 100%)'
      : 'rgba(15,23,42,0.52)',
    '--screen-field-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,255,0.98) 100%)'
      : 'rgba(15,23,42,0.70)',
    '--screen-field-text': isLight ? '#334155' : '#e5eefb',
    '--screen-border': isLight ? 'rgba(203,213,225,0.92)' : 'rgba(148,163,184,0.14)',
    '--screen-border-strong': isLight ? 'rgba(203,213,225,1)' : 'rgba(148,163,184,0.18)',
    '--screen-table-head-bg': isLight ? 'rgba(13,27,57,0.98)' : 'rgba(2,6,23,0.92)',
    '--screen-pill-bg': isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.56)',
    '--screen-secondary-btn-bg': isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.78)',
    '--screen-secondary-btn-text': isLight ? '#475569' : '#e5eefb',
    '--screen-menu-bg': isLight ? 'rgba(255,255,255,0.99)' : 'rgba(15,23,42,0.96)',
    '--screen-shadow': isLight ? '0 18px 40px rgba(15,23,42,0.10)' : '0 18px 40px rgba(2,6,23,0.35)',
    '--screen-score-pill-bg': isLight ? 'rgba(37,99,235,0.10)' : 'rgba(37,99,235,0.18)',
    '--screen-score-pill-border': isLight ? 'rgba(59,130,246,0.24)' : 'rgba(96,165,250,0.26)',
  };
}

function ReportsSupabase() {
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [callsRecords, setCallsRecords] = useState<CallsRecord[]>([]);
  const [ticketsRecords, setTicketsRecords] = useState<TicketsRecord[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [supervisorRequests, setSupervisorRequests] = useState<
    SupervisorRequest[]
  >([]);
  const [agentFeedback, setAgentFeedback] = useState<AgentFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [selectedAgentProfileId, setSelectedAgentProfileId] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);

  const agentPickerRef = useRef<HTMLDivElement | null>(null);
  const themeVars = getReportsThemeVars();

  useEffect(() => {
    void loadReportsData();
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        agentPickerRef.current &&
        !agentPickerRef.current.contains(event.target as Node)
      ) {
        setIsAgentPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  async function loadReportsData() {
    setLoading(true);

    const [
      auditsResult,
      profilesResult,
      callsResult,
      ticketsResult,
      salesResult,
      requestsResult,
      feedbackResult,
    ] = await Promise.all([
      supabase
        .from('audits')
        .select('*')
        .order('audit_date', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, agent_id, agent_name, display_name, team')
        .eq('role', 'agent')
        .order('agent_name', { ascending: true }),
      supabase
        .from('calls_records')
        .select('*')
        .order('call_date', { ascending: false }),
      supabase
        .from('tickets_records')
        .select('*')
        .order('ticket_date', { ascending: false }),
      supabase
        .from('sales_records')
        .select('*')
        .order('sale_date', { ascending: false }),
      supabase
        .from('supervisor_requests')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('agent_feedback')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    setAudits((auditsResult.data as AuditItem[]) || []);
    setProfiles((profilesResult.data as AgentProfile[]) || []);
    setCallsRecords((callsResult.data as CallsRecord[]) || []);
    setTicketsRecords((ticketsResult.data as TicketsRecord[]) || []);
    setSalesRecords((salesResult.data as SalesRecord[]) || []);
    setSupervisorRequests((requestsResult.data as SupervisorRequest[]) || []);
    setAgentFeedback((feedbackResult.data as AgentFeedback[]) || []);

    setLoading(false);
  }

  function getDisplayName(
    agentId?: string | null,
    agentName?: string | null,
    team?: string | null
  ) {
    const matchedProfile = profiles.find(
      (profile) =>
        profile.agent_id === (agentId || null) &&
        profile.agent_name === (agentName || '') &&
        profile.team === (team || null)
    );

    return matchedProfile?.display_name || null;
  }

  function getAgentLabel(profile: AgentProfile) {
    return profile.display_name
      ? `${profile.agent_name} - ${profile.display_name}`
      : `${profile.agent_name} - ${profile.agent_id}`;
  }

  function matchesDate(dateValue: string) {
    const raw = String(dateValue || '').slice(0, 10);
    const afterFrom = dateFrom ? raw >= dateFrom : true;
    const beforeTo = dateTo ? raw <= dateTo : true;
    return afterFrom && beforeTo;
  }

  const selectedAgent =
    profiles.find((profile) => profile.id === selectedAgentProfileId) || null;

  function matchesSelectedAgent(
    itemAgentId?: string | null,
    itemAgentName?: string | null,
    itemTeam?: string | null
  ) {
    if (!selectedAgent) return true;

    const idMatches = (itemAgentId || '') === (selectedAgent.agent_id || '');
    const nameMatches = (itemAgentName || '') === selectedAgent.agent_name;
    const teamMatches = (itemTeam || '') === (selectedAgent.team || '');

    return idMatches && nameMatches && teamMatches;
  }

  const visibleAgentProfiles = useMemo(() => {
    const scopedProfiles = teamFilter
      ? profiles.filter((profile) => profile.team === teamFilter)
      : profiles;

    const search = agentSearch.trim().toLowerCase();

    if (!search) return scopedProfiles;

    return scopedProfiles.filter((profile) => {
      const label = getAgentLabel(profile).toLowerCase();

      return (
        profile.agent_name.toLowerCase().includes(search) ||
        (profile.agent_id || '').toLowerCase().includes(search) ||
        (profile.display_name || '').toLowerCase().includes(search) ||
        label.includes(search)
      );
    });
  }, [profiles, teamFilter, agentSearch]);

  function handleSelectAgent(profile: AgentProfile) {
    setSelectedAgentProfileId(profile.id);
    setAgentSearch(getAgentLabel(profile));
    setIsAgentPickerOpen(false);
    if (profile.team) {
      setTeamFilter(profile.team);
    }
  }

  function clearAgentFilter() {
    setSelectedAgentProfileId('');
    setAgentSearch('');
    setIsAgentPickerOpen(false);
  }

  const filteredAudits = useMemo(() => {
    return audits.filter((item) => {
      const matchesTeam = teamFilter ? item.team === teamFilter : true;
      const matchesAgent = matchesSelectedAgent(
        item.agent_id,
        item.agent_name,
        item.team
      );
      return matchesTeam && matchesAgent && matchesDate(item.audit_date);
    });
  }, [audits, teamFilter, dateFrom, dateTo, selectedAgentProfileId]);

  const filteredCalls = useMemo(() => {
    return callsRecords.filter((item) => {
      const matchesTeam = teamFilter ? teamFilter === 'Calls' : true;
      const matchesAgent = matchesSelectedAgent(
        item.agent_id,
        item.agent_name,
        'Calls'
      );
      return matchesTeam && matchesAgent && matchesDate(item.call_date);
    });
  }, [callsRecords, teamFilter, dateFrom, dateTo, selectedAgentProfileId]);

  const filteredTickets = useMemo(() => {
    return ticketsRecords.filter((item) => {
      const matchesTeam = teamFilter ? teamFilter === 'Tickets' : true;
      const matchesAgent = matchesSelectedAgent(
        item.agent_id,
        item.agent_name,
        'Tickets'
      );
      return matchesTeam && matchesAgent && matchesDate(item.ticket_date);
    });
  }, [ticketsRecords, teamFilter, dateFrom, dateTo, selectedAgentProfileId]);

  const filteredSales = useMemo(() => {
    return salesRecords.filter((item) => {
      const matchesTeam = teamFilter ? teamFilter === 'Sales' : true;
      const matchesAgent = matchesSelectedAgent(
        item.agent_id,
        item.agent_name,
        'Sales'
      );
      return matchesTeam && matchesAgent && matchesDate(item.sale_date);
    });
  }, [salesRecords, teamFilter, dateFrom, dateTo, selectedAgentProfileId]);

  const filteredRequests = useMemo(() => {
    return supervisorRequests.filter((item) => {
      const matchesTeam = teamFilter ? item.team === teamFilter : true;
      const matchesAgent = matchesSelectedAgent(
        item.agent_id || null,
        item.agent_name || null,
        item.team || null
      );
      return (
        matchesTeam && matchesAgent && matchesDate(item.created_at.slice(0, 10))
      );
    });
  }, [
    supervisorRequests,
    teamFilter,
    dateFrom,
    dateTo,
    selectedAgentProfileId,
  ]);

  const filteredFeedback = useMemo(() => {
    return agentFeedback.filter((item) => {
      const matchesTeam = teamFilter ? item.team === teamFilter : true;
      const matchesAgent = matchesSelectedAgent(
        item.agent_id || null,
        item.agent_name || null,
        item.team || null
      );
      return (
        matchesTeam && matchesAgent && matchesDate(item.created_at.slice(0, 10))
      );
    });
  }, [agentFeedback, teamFilter, dateFrom, dateTo, selectedAgentProfileId]);

  const averageQuality =
    filteredAudits.length > 0
      ? (
          filteredAudits.reduce(
            (sum, item) => sum + Number(item.quality_score),
            0
          ) / filteredAudits.length
        ).toFixed(2)
      : '0.00';

  const totalCalls = filteredCalls.reduce(
    (sum, item) => sum + Number(item.calls_count),
    0
  );
  const totalTickets = filteredTickets.reduce(
    (sum, item) => sum + Number(item.tickets_count),
    0
  );
  const totalSales = filteredSales.reduce(
    (sum, item) => sum + Number(item.amount),
    0
  );

  const openRequests = filteredRequests.filter(
    (item) => item.status !== 'Closed'
  ).length;
  const closedRequests = filteredRequests.filter(
    (item) => item.status === 'Closed'
  ).length;

  const openFeedback = filteredFeedback.filter(
    (item) => item.status !== 'Closed'
  ).length;
  const closedFeedback = filteredFeedback.filter(
    (item) => item.status === 'Closed'
  ).length;

  const callsAudits = filteredAudits.filter((item) => item.team === 'Calls');
  const ticketsAudits = filteredAudits.filter(
    (item) => item.team === 'Tickets'
  );
  const salesAudits = filteredAudits.filter((item) => item.team === 'Sales');

  const callsAverage =
    callsAudits.length > 0
      ? (
          callsAudits.reduce(
            (sum, item) => sum + Number(item.quality_score),
            0
          ) / callsAudits.length
        ).toFixed(2)
      : '0.00';

  const ticketsAverage =
    ticketsAudits.length > 0
      ? (
          ticketsAudits.reduce(
            (sum, item) => sum + Number(item.quality_score),
            0
          ) / ticketsAudits.length
        ).toFixed(2)
      : '0.00';

  const salesAverage =
    salesAudits.length > 0
      ? (
          salesAudits.reduce(
            (sum, item) => sum + Number(item.quality_score),
            0
          ) / salesAudits.length
        ).toFixed(2)
      : '0.00';

  const selectedAgentFeedbackByType = useMemo(() => {
    const grouped = new Map<string, number>();

    filteredFeedback.forEach((item) => {
      grouped.set(
        item.feedback_type,
        (grouped.get(item.feedback_type) || 0) + 1
      );
    });

    return Array.from(grouped.entries()).map(([type, count]) => ({
      type,
      count,
    }));
  }, [filteredFeedback]);

  const trendTeamFilter = selectedAgent?.team || teamFilter || '';

  const trendTeamAudits = useMemo(() => {
    return audits.filter((item) => {
      const matchesTeam = trendTeamFilter ? item.team === trendTeamFilter : true;
      return matchesTeam && matchesDate(item.audit_date);
    });
  }, [audits, trendTeamFilter, dateFrom, dateTo]);

  function escapeCsvValue(value: unknown) {
    const stringValue = value == null ? '' : String(value);
    if (
      stringValue.includes(',') ||
      stringValue.includes('"') ||
      stringValue.includes('\n')
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
    if (rows.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvLines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => escapeCsvValue(row[header])).join(',')
      ),
    ];

    const blob = new Blob([csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportSummaryCsv() {
    downloadCsv('reports_summary.csv', [
      {
        date_from: dateFrom || 'All',
        date_to: dateTo || 'All',
        team_filter: teamFilter || 'All',
        selected_agent: selectedAgent
          ? getAgentLabel(selectedAgent)
          : 'All Agents',
        total_audits: filteredAudits.length,
        average_quality: averageQuality,
        total_calls: totalCalls,
        total_tickets: totalTickets,
        total_sales: totalSales.toFixed(2),
        open_supervisor_requests: openRequests,
        closed_supervisor_requests: closedRequests,
        open_agent_feedback: openFeedback,
        closed_agent_feedback: closedFeedback,
        calls_avg_quality: callsAverage,
        tickets_avg_quality: ticketsAverage,
        sales_avg_quality: salesAverage,
      },
    ]);
  }

  function exportAuditsCsv() {
    downloadCsv(
      'audits_report.csv',
      filteredAudits.map((item) => ({
        id: item.id,
        agent_id: item.agent_id,
        agent_name: item.agent_name,
        display_name:
          getDisplayName(item.agent_id, item.agent_name, item.team) || '',
        team: item.team,
        case_type: item.case_type,
        audit_date: item.audit_date,
        order_number: item.order_number || '',
        phone_number: item.phone_number || '',
        ticket_id: item.ticket_id || '',
        quality_score: Number(item.quality_score).toFixed(2),
        comments: item.comments || '',
      }))
    );
  }

  function exportCallsCsv() {
    downloadCsv(
      'calls_report.csv',
      filteredCalls.map((item) => ({
        id: item.id,
        agent_id: item.agent_id,
        agent_name: item.agent_name,
        calls_count: item.calls_count,
        call_date: item.call_date,
        notes: item.notes || '',
      }))
    );
  }

  function exportTicketsCsv() {
    downloadCsv(
      'tickets_report.csv',
      filteredTickets.map((item) => ({
        id: item.id,
        agent_id: item.agent_id,
        agent_name: item.agent_name,
        tickets_count: item.tickets_count,
        ticket_date: item.ticket_date,
        notes: item.notes || '',
      }))
    );
  }

  function exportSalesCsv() {
    downloadCsv(
      'sales_report.csv',
      filteredSales.map((item) => ({
        id: item.id,
        agent_id: item.agent_id,
        agent_name: item.agent_name,
        amount: Number(item.amount).toFixed(2),
        sale_date: item.sale_date,
        notes: item.notes || '',
      }))
    );
  }

  function exportRequestsCsv() {
    downloadCsv(
      'supervisor_requests_report.csv',
      filteredRequests.map((item) => ({
        id: item.id,
        case_reference: item.case_reference,
        team: item.team || '',
        priority: item.priority,
        status: item.status,
        created_at: item.created_at,
        agent_id: item.agent_id || '',
        agent_name: item.agent_name || '',
        display_name:
          getDisplayName(
            item.agent_id || null,
            item.agent_name || null,
            item.team || null
          ) || '',
        case_type: item.case_type || '',
        supervisor_name: item.supervisor_name || '',
        request_note: item.request_note || '',
      }))
    );
  }

  function exportFeedbackCsv() {
    downloadCsv(
      'agent_feedback_report.csv',
      filteredFeedback.map((item) => ({
        id: item.id,
        agent_id: item.agent_id || '',
        agent_name: item.agent_name,
        display_name:
          getDisplayName(
            item.agent_id || null,
            item.agent_name || null,
            item.team || null
          ) || '',
        team: item.team,
        qa_name: item.qa_name || '',
        feedback_type: item.feedback_type,
        subject: item.subject,
        feedback_note: item.feedback_note || '',
        action_plan: item.action_plan || '',
        due_date: item.due_date || '',
        status: item.status,
        created_at: item.created_at,
      }))
    );
  }

  if (loading) {
    return <div style={{ color: '#e5eefb' }}>Loading reports...</div>;
  }

  return (
    <div
      data-no-theme-invert="true"
      style={{ color: 'var(--screen-text)', ...(themeVars as CSSProperties) }}
    >
      <div style={pageHeaderStyle}>
        <div>
          <div style={sectionEyebrow}>Reporting</div>
          <h2 style={{ margin: 0 }}>Reports</h2>
          <p style={{ margin: '10px 0 0 0', color: '#94a3b8' }}>
            Filter by date, team, and agent to build detailed performance
            reports.
          </p>
        </div>
      </div>

      <div style={filterPanelStyle}>
        <div style={filterGridStyle}>
          <div>
            <label style={labelStyle}>Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={fieldStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={fieldStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Team Filter</label>
            <select
              value={teamFilter}
              onChange={(e) => {
                setTeamFilter(e.target.value);
                clearAgentFilter();
              }}
              style={fieldStyle}
            >
              <option value="">All Teams</option>
              <option value="Calls">Calls</option>
              <option value="Tickets">Tickets</option>
              <option value="Sales">Sales</option>
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Agent Report Filter</label>
            <div ref={agentPickerRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsAgentPickerOpen((prev) => !prev)}
                style={pickerButtonStyle}
              >
                <span style={{ color: selectedAgent ? '#e5eefb' : '#94a3b8' }}>
                  {selectedAgent
                    ? getAgentLabel(selectedAgent)
                    : 'Select agent'}
                </span>
                <span>▼</span>
              </button>

              {isAgentPickerOpen && (
                <div style={pickerMenuStyle}>
                  <div
                    style={{
                      padding: '12px',
                      borderBottom: '1px solid rgba(148,163,184,0.12)',
                    }}
                  >
                    <input
                      type="text"
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                      placeholder="Search by name, ID, or display name"
                      style={fieldStyle}
                    />
                  </div>

                  <div style={pickerListStyle}>
                    {visibleAgentProfiles.length === 0 ? (
                      <div style={pickerInfoStyle}>No agents found</div>
                    ) : (
                      visibleAgentProfiles.map((profile) => (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => handleSelectAgent(profile)}
                          style={{
                            ...pickerOptionStyle,
                            ...(selectedAgentProfileId === profile.id
                              ? pickerOptionActiveStyle
                              : {}),
                          }}
                        >
                          {getAgentLabel(profile)}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={filterActionsStyle}>
              <button
                type="button"
                onClick={clearAgentFilter}
                style={secondaryButton}
              >
                Clear Agent Filter
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={buttonRowStyle}>
        <button onClick={exportSummaryCsv} style={primaryButton}>
          Export Summary CSV
        </button>
        <button onClick={exportAuditsCsv} style={primaryButton}>
          Export Audits CSV
        </button>
        <button onClick={exportCallsCsv} style={primaryButton}>
          Export Calls CSV
        </button>
        <button onClick={exportTicketsCsv} style={primaryButton}>
          Export Tickets CSV
        </button>
        <button onClick={exportSalesCsv} style={primaryButton}>
          Export Sales CSV
        </button>
        <button onClick={exportRequestsCsv} style={primaryButton}>
          Export Requests CSV
        </button>
        <button onClick={exportFeedbackCsv} style={primaryButton}>
          Export Feedback CSV
        </button>
      </div>

      <h3 style={sectionTitleStyle}>Summary</h3>
      <div style={summaryGridStyle}>
        <SummaryCard
          title="Total Audits"
          value={String(filteredAudits.length)}
        />
        <SummaryCard title="Average Quality" value={`${averageQuality}%`} />
        <SummaryCard title="Total Calls" value={String(totalCalls)} />
        <SummaryCard title="Total Tickets" value={String(totalTickets)} />
        <SummaryCard title="Total Sales" value={`$${totalSales.toFixed(2)}`} />
        <SummaryCard
          title="Open Supervisor Requests"
          value={String(openRequests)}
        />
        <SummaryCard
          title="Closed Supervisor Requests"
          value={String(closedRequests)}
        />
        <SummaryCard title="Open Agent Feedback" value={String(openFeedback)} />
        <SummaryCard
          title="Closed Agent Feedback"
          value={String(closedFeedback)}
        />
      </div>

      <h3 style={sectionTitleStyle}>Team Breakdown</h3>
      <div style={summaryGridStyle}>
        <SummaryCard title="Calls Avg Quality" value={`${callsAverage}%`} />
        <SummaryCard title="Tickets Avg Quality" value={`${ticketsAverage}%`} />
        <SummaryCard title="Sales Avg Quality" value={`${salesAverage}%`} />
      </div>

      <PerformanceTrendsSection
        audits={filteredAudits}
        allAudits={trendTeamAudits}
        selectedAgent={selectedAgent}
        effectiveTeamFilter={trendTeamFilter}
      />

      {selectedAgent && (
        <Section title={`Agent Report: ${getAgentLabel(selectedAgent)}`}>
          <div style={summaryGridStyle}>
            <SummaryCard title="Agent Team" value={selectedAgent.team || '-'} />
            <SummaryCard
              title="Agent Audits"
              value={String(filteredAudits.length)}
            />
            <SummaryCard
              title="Agent Avg Quality"
              value={`${averageQuality}%`}
            />
            {selectedAgent.team === 'Calls' && (
              <SummaryCard
                title="Agent Total Calls"
                value={String(totalCalls)}
              />
            )}
            {selectedAgent.team === 'Tickets' && (
              <SummaryCard
                title="Agent Total Tickets"
                value={String(totalTickets)}
              />
            )}
            {selectedAgent.team === 'Sales' && (
              <SummaryCard
                title="Agent Total Sales"
                value={`$${totalSales.toFixed(2)}`}
              />
            )}
            <SummaryCard
              title="Agent Feedback Items"
              value={String(filteredFeedback.length)}
            />
            <SummaryCard
              title="Agent Open Feedback"
              value={String(openFeedback)}
            />
            <SummaryCard
              title="Agent Closed Feedback"
              value={String(closedFeedback)}
            />
            <SummaryCard
              title="Agent Requests"
              value={String(filteredRequests.length)}
            />
          </div>

          <div style={detailGridStyle}>
            <div style={detailCardStyle}>
              <div style={detailLabelStyle}>Agent Details</div>
              <p>
                <strong>Agent Name:</strong> {selectedAgent.agent_name}
              </p>
              <p>
                <strong>Display Name:</strong>{' '}
                {selectedAgent.display_name || '-'}
              </p>
              <p>
                <strong>Agent ID:</strong> {selectedAgent.agent_id || '-'}
              </p>
              <p>
                <strong>Team:</strong> {selectedAgent.team || '-'}
              </p>
            </div>

            <div style={detailCardStyle}>
              <div style={detailLabelStyle}>Feedback Breakdown</div>
              {selectedAgentFeedbackByType.length === 0 ? (
                <p>No feedback items for this agent.</p>
              ) : (
                selectedAgentFeedbackByType.map((item) => (
                  <p key={item.type}>
                    <strong>{item.type}:</strong> {item.count}
                  </p>
                ))
              )}
            </div>
          </div>
        </Section>
      )}

<Section title="Recent Audits">
  {filteredAudits.length === 0 ? (
    <p style={emptyMessageStyle}>No audits in this range.</p>
  ) : (
    <div style={thinTableWrapStyle}>
      <div style={thinTableStyle}>
        <div style={{ ...recentAuditsRowGridStyle, ...thinHeaderRowStyle }}>
          <div style={recentAuditDateCellStyle}>Date</div>
          <div style={recentAuditAgentCellStyle}>Agent</div>
          <div style={recentAuditCaseCellStyle}>Case Type</div>
          <div style={recentAuditReferenceCellStyle}>Reference</div>
          <div style={recentAuditScoreCellStyle}>Quality</div>
        </div>

        {filteredAudits.map((item) => (
          <div key={item.id} style={recentAuditsRowGridStyle}>
            <div style={recentAuditDateCellStyle}>
              <div style={thinPrimaryTextStyle}>{item.audit_date}</div>
              <div style={thinSecondaryTextStyle}>{item.team}</div>
            </div>

            <div style={recentAuditAgentCellStyle}>
              <div style={thinPrimaryTextStyle}>{item.agent_name}</div>
              <div style={thinSecondaryTextStyle}>
                {getDisplayName(item.agent_id, item.agent_name, item.team) || '-'}
              </div>
            </div>

            <div style={recentAuditCaseCellStyle}>
              <div style={thinPrimaryTextStyle}>{item.case_type}</div>
            </div>

            <div style={recentAuditReferenceCellStyle}>
              <div style={thinPrimaryTextStyle}>
                {item.team === 'Tickets'
                  ? `Ticket: ${item.ticket_id || '-'}`
                  : `Order: ${item.order_number || '-'} • Phone: ${item.phone_number || '-'}`
                }
              </div>
            </div>

            <div style={recentAuditScoreCellStyle}>
              <span style={scorePillStyle}>
                {Number(item.quality_score).toFixed(2)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
</Section>

<Section title="Recent Supervisor Requests">
  {filteredRequests.length === 0 ? (
    <p style={emptyMessageStyle}>No supervisor requests in this range.</p>
  ) : (
    <div style={thinTableWrapStyle}>
      <div style={thinTableStyle}>
        <div style={{ ...recentRequestsRowGridStyle, ...thinHeaderRowStyle }}>
          <div style={recentRequestDateCellStyle}>Created</div>
          <div style={recentRequestCaseRefCellStyle}>Case Ref</div>
          <div style={recentRequestAgentCellStyle}>Agent</div>
          <div style={recentRequestPriorityCellStyle}>Priority</div>
          <div style={recentRequestStatusCellStyle}>Status</div>
        </div>

        {filteredRequests.map((item) => (
          <div key={item.id} style={recentRequestsRowGridStyle}>
            <div style={recentRequestDateCellStyle}>
              <div style={thinPrimaryTextStyle}>
                {new Date(item.created_at).toLocaleDateString()}
              </div>
              <div style={thinSecondaryTextStyle}>{item.team || '-'}</div>
            </div>

            <div style={recentRequestCaseRefCellStyle}>
              <div style={thinPrimaryTextStyle}>{item.case_reference}</div>
              <div style={thinSecondaryTextStyle}>{item.case_type || '-'}</div>
            </div>

            <div style={recentRequestAgentCellStyle}>
              <div style={thinPrimaryTextStyle}>{item.agent_name || '-'}</div>
              <div style={thinSecondaryTextStyle}>
                {getDisplayName(
                  item.agent_id || null,
                  item.agent_name || null,
                  item.team || null
                ) || '-'}
              </div>
            </div>

            <div style={recentRequestPriorityCellStyle}>
              <span style={pillStyle}>{item.priority}</span>
            </div>

            <div style={recentRequestStatusCellStyle}>
              <span style={pillStyle}>{item.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
</Section>

<Section title="Recent Agent Feedback">
  {filteredFeedback.length === 0 ? (
    <p style={emptyMessageStyle}>No feedback items in this range.</p>
  ) : (
    <div style={thinTableWrapStyle}>
      <div style={thinTableStyle}>
        <div style={{ ...recentFeedbackRowGridStyle, ...thinHeaderRowStyle }}>
          <div style={recentFeedbackDateCellStyle}>Created</div>
          <div style={recentFeedbackAgentCellStyle}>Agent</div>
          <div style={recentFeedbackTypeCellStyle}>Type</div>
          <div style={recentFeedbackSubjectCellStyle}>Subject</div>
          <div style={recentFeedbackStatusCellStyle}>Status</div>
        </div>

        {filteredFeedback.map((item) => (
          <div key={item.id} style={recentFeedbackRowGridStyle}>
            <div style={recentFeedbackDateCellStyle}>
              <div style={thinPrimaryTextStyle}>
                {new Date(item.created_at).toLocaleDateString()}
              </div>
              <div style={thinSecondaryTextStyle}>{item.team}</div>
            </div>

            <div style={recentFeedbackAgentCellStyle}>
              <div style={thinPrimaryTextStyle}>{item.agent_name}</div>
              <div style={thinSecondaryTextStyle}>
                {getDisplayName(
                  item.agent_id || null,
                  item.agent_name || null,
                  item.team || null
                ) || '-'}
              </div>
            </div>

            <div style={recentFeedbackTypeCellStyle}>
              <span style={pillStyle}>{item.feedback_type}</span>
            </div>

            <div style={recentFeedbackSubjectCellStyle}>
              <div style={thinPrimaryTextStyle}>{item.subject}</div>
              <div style={thinSecondaryTextStyle}>{item.qa_name || '-'}</div>
            </div>

            <div style={recentFeedbackStatusCellStyle}>
              <span style={pillStyle}>{item.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )}
</Section>
    </div>
  );
}

function PerformanceTrendsSection({
  audits,
  allAudits,
  selectedAgent,
  effectiveTeamFilter,
}: {
  audits: AuditItem[];
  allAudits: AuditItem[];
  selectedAgent: AgentProfile | null;
  effectiveTeamFilter: string;
}) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('weekly');

  const trendPoints = useMemo(() => {
    return buildTrendPoints(audits, allAudits, periodMode);
  }, [audits, allAudits, periodMode]);

  const recurringIssues = useMemo(() => {
    return buildRecurringIssues(audits);
  }, [audits]);

  const latestAverage =
    trendPoints.length > 0
      ? trendPoints[trendPoints.length - 1].subjectAverage
      : null;

  const previousAverage =
    trendPoints.length > 1
      ? trendPoints[trendPoints.length - 2].subjectAverage
      : null;

  const teamLatestAverage =
    trendPoints.length > 0
      ? trendPoints[trendPoints.length - 1].teamAverage
      : null;

  const momentumDelta =
    latestAverage != null && previousAverage != null
      ? Number((latestAverage - previousAverage).toFixed(2))
      : null;

  const teamGap =
    latestAverage != null && teamLatestAverage != null
      ? Number((latestAverage - teamLatestAverage).toFixed(2))
      : null;

  const subjectLabel = selectedAgent
    ? selectedAgent.display_name
      ? `${selectedAgent.agent_name} - ${selectedAgent.display_name}`
      : `${selectedAgent.agent_name} - ${selectedAgent.agent_id || '-'}`
    : effectiveTeamFilter
    ? `${effectiveTeamFilter} Team`
    : 'All Teams';

  const strongestIssue = recurringIssues[0]?.metric || 'None';
  const totalIssueTouches = recurringIssues.reduce(
    (sum, issue) => sum + issue.count,
    0
  );

  return (
    <Section title="Performance Trends">
      <div style={trendHeaderRowStyle}>
        <div>
          <div style={detailLabelStyle}>Trend Layer</div>
          <h3 style={trendTitleStyle}>
            Quality movement, team baseline, and recurring issues
          </h3>
          <p style={trendSubtitleStyle}>
            Selected scope: <strong>{subjectLabel}</strong>
          </p>
        </div>

        <div style={trendToggleWrapStyle}>
          <button
            type="button"
            onClick={() => setPeriodMode('weekly')}
            style={{
              ...trendToggleButtonStyle,
              ...(periodMode === 'weekly' ? trendToggleButtonActiveStyle : {}),
            }}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode('monthly')}
            style={{
              ...trendToggleButtonStyle,
              ...(periodMode === 'monthly'
                ? trendToggleButtonActiveStyle
                : {}),
            }}
          >
            Monthly
          </button>
        </div>
      </div>

      <div style={summaryGridStyle}>
        <SummaryCard
          title="Current Average"
          value={latestAverage != null ? `${latestAverage.toFixed(2)}%` : '-'}
        />
        <SummaryCard
          title="Momentum"
          value={getMomentumLabel(momentumDelta)}
        />
        <SummaryCard
          title="Vs Team Average"
          value={
            teamGap != null ? `${teamGap > 0 ? '+' : ''}${teamGap.toFixed(2)} pts` : '-'
          }
        />
        <SummaryCard
          title="Top Recurring Issue"
          value={strongestIssue}
        />
      </div>

      <div style={trendHelperTextStyle}>
        {momentumDelta != null
          ? `${momentumDelta > 0 ? '+' : ''}${momentumDelta.toFixed(
              2
            )} pts vs prior period`
          : 'Need at least 2 periods for momentum'}{' '}
        • {totalIssueTouches} total issue hits in selection
      </div>

      <MiniTrendChart points={trendPoints} />

      <div style={trendDetailGridStyle}>
        <div style={detailCardStyle}>
          <div style={detailLabelStyle}>Trend Breakdown</div>
          {trendPoints.length === 0 ? (
            <p>No audit trend data for this selection.</p>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              <div style={{ ...trendTableRowStyle, ...trendTableHeaderStyle }}>
                <div>Period</div>
                <div>Selected Scope</div>
                <div>Team Avg</div>
                <div>Scoped Audits</div>
                <div>Team Audits</div>
              </div>

              {trendPoints.map((point) => (
                <div key={point.key} style={trendTableRowStyle}>
                  <div>{point.label}</div>
                  <div>
                    {point.subjectAverage != null
                      ? `${point.subjectAverage.toFixed(2)}%`
                      : '-'}
                  </div>
                  <div>
                    {point.teamAverage != null
                      ? `${point.teamAverage.toFixed(2)}%`
                      : '-'}
                  </div>
                  <div>{point.auditCount}</div>
                  <div>{point.teamAuditCount}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={detailCardStyle}>
          <div style={detailLabelStyle}>Recurring Issues</div>
          {recurringIssues.length === 0 ? (
            <p>No recurring Borderline / Fail / Auto-Fail issues in this range.</p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {recurringIssues.map((issue) => (
                <div key={issue.metric} style={trendIssueCardStyle}>
                  <div style={trendIssueHeaderStyle}>
                    <div style={trendIssueMetricStyle}>{issue.metric}</div>
                    <div style={trendIssueCountPillStyle}>{issue.count}</div>
                  </div>

                  <div style={trendIssueMetaStyle}>
                    Borderline: {issue.borderlineCount} · Fail: {issue.failCount}{' '}
                    · Auto-Fail: {issue.autoFailCount}
                  </div>

                  <div style={trendIssueBarTrackStyle}>
                    <div
                      style={{
                        ...trendIssueBarFillStyle,
                        width: `${Math.max(
                          12,
                          Math.round(
                            (issue.count /
                              Math.max(recurringIssues[0]?.count || 1, 1)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!selectedAgent && effectiveTeamFilter ? (
        <div style={trendHelperTextStyle}>
          Team trend is comparing the filtered team against itself. Once an
          agent is selected, this becomes agent vs team.
        </div>
      ) : null}

      {!selectedAgent && !effectiveTeamFilter ? (
        <div style={trendHelperTextStyle}>
          With no team or agent selected, this shows all visible audits as the
          selected scope and compares them to the same overall baseline.
        </div>
      ) : null}
    </Section>
  );
}

function MiniTrendChart({ points }: { points: TrendPoint[] }) {
  const subjectValues = points.map((point) => point.subjectAverage);
  const teamValues = points.map((point) => point.teamAverage);

  const subjectPolyline = getLineChartPoints(subjectValues, 1000, 240, 28);
  const teamPolyline = getLineChartPoints(teamValues, 1000, 240, 28);

  if (points.length === 0) {
    return <div style={trendEmptyStateStyle}>No periods available.</div>;
  }

  return (
    <div style={trendChartShellStyle}>
      <svg
        viewBox="0 0 1000 240"
        preserveAspectRatio="none"
        style={trendChartSvgStyle}
      >
        <line x1="28" y1="212" x2="972" y2="212" style={trendChartAxisStyle} />

        {teamPolyline ? (
          <polyline
            points={teamPolyline}
            fill="none"
            stroke="rgba(148,163,184,0.85)"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {subjectPolyline ? (
          <polyline
            points={subjectPolyline}
            fill="none"
            stroke="rgba(37,99,235,0.95)"
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
      </svg>

      <div style={trendLegendStyle}>
        <span style={trendLegendItemStyle}>
          <span
            style={{
              ...trendLegendDotStyle,
              background: 'rgba(37,99,235,0.95)',
            }}
          />
          Selected Scope
        </span>
        <span style={trendLegendItemStyle}>
          <span
            style={{
              ...trendLegendDotStyle,
              background: 'rgba(148,163,184,0.85)',
            }}
          />
          Team Average
        </span>
      </div>

      <div style={trendChartLabelsStyle}>
        {points.map((point) => (
          <div key={point.key} style={trendChartLabelStyle}>
            {point.shortLabel}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryCardTitleStyle}>{title}</div>
      <div style={summaryCardValueStyle}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: '35px' }}>
      <h3 style={sectionTitleStyle}>{title}</h3>
      {children}
    </div>
  );
}

function buildTrendPoints(
  subjectAudits: AuditItem[],
  teamAudits: AuditItem[],
  mode: PeriodMode
): TrendPoint[] {
  const keys = new Set<string>();
  const subjectMap = new Map<string, number[]>();
  const teamMap = new Map<string, number[]>();
  const labels = new Map<string, { label: string; shortLabel: string }>();

  subjectAudits.forEach((audit) => {
    const meta = getPeriodMeta(audit.audit_date, mode);
    keys.add(meta.key);
    labels.set(meta.key, { label: meta.label, shortLabel: meta.shortLabel });

    const scores = subjectMap.get(meta.key) || [];
    scores.push(Number(audit.quality_score));
    subjectMap.set(meta.key, scores);
  });

  teamAudits.forEach((audit) => {
    const meta = getPeriodMeta(audit.audit_date, mode);
    keys.add(meta.key);
    labels.set(meta.key, { label: meta.label, shortLabel: meta.shortLabel });

    const scores = teamMap.get(meta.key) || [];
    scores.push(Number(audit.quality_score));
    teamMap.set(meta.key, scores);
  });

  return Array.from(keys)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({
      key,
      label: labels.get(key)?.label || key,
      shortLabel: labels.get(key)?.shortLabel || key,
      subjectAverage: roundScore(average(teamOrSubject(subjectMap.get(key)))),
      teamAverage: roundScore(average(teamOrSubject(teamMap.get(key)))),
      auditCount: (subjectMap.get(key) || []).length,
      teamAuditCount: (teamMap.get(key) || []).length,
    }));
}

function teamOrSubject(values?: number[]) {
  return values || [];
}

function buildRecurringIssues(audits: AuditItem[]): RecurringIssue[] {
  const counts = new Map<
    string,
    { count: number; borderlineCount: number; failCount: number; autoFailCount: number }
  >();

  audits.forEach((audit) => {
    (audit.score_details || []).forEach((detail) => {
      if (!detail.metric || !ISSUE_RESULTS.has(String(detail.result || ''))) {
        return;
      }

      const current = counts.get(detail.metric) || {
        count: 0,
        borderlineCount: 0,
        failCount: 0,
        autoFailCount: 0,
      };

      current.count += 1;

      if (detail.result === 'Borderline') current.borderlineCount += 1;
      if (detail.result === 'Fail') current.failCount += 1;
      if (detail.result === 'Auto-Fail') current.autoFailCount += 1;

      counts.set(detail.metric, current);
    });
  });

  return Array.from(counts.entries())
    .map(([metric, value]) => ({
      metric,
      count: value.count,
      borderlineCount: value.borderlineCount,
      failCount: value.failCount,
      autoFailCount: value.autoFailCount,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.autoFailCount !== a.autoFailCount) return b.autoFailCount - a.autoFailCount;
      if (b.failCount !== a.failCount) return b.failCount - a.failCount;
      return a.metric.localeCompare(b.metric);
    })
    .slice(0, 6);
}

function getPeriodMeta(dateValue: string, mode: PeriodMode) {
  return mode === 'weekly'
    ? formatWeekLabel(dateValue)
    : formatMonthLabel(dateValue);
}

function startOfWeek(dateValue: string) {
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return monday;
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWeekLabel(dateValue: string) {
  const weekStart = startOfWeek(dateValue);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const shortLabel = `${weekStart.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;

  const label = `${weekStart.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} - ${weekEnd.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;

  return {
    key: formatIsoDate(weekStart),
    label,
    shortLabel,
  };
}

function formatMonthLabel(dateValue: string) {
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  const year = date.getFullYear();
  const month = date.getMonth();
  const first = new Date(year, month, 1);

  return {
    key: `${year}-${String(month + 1).padStart(2, '0')}`,
    label: first.toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    }),
    shortLabel: first.toLocaleDateString(undefined, {
      month: 'short',
    }),
  };
}

function average(values: number[]) {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function roundScore(value: number | null) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(2));
}

function getMomentumLabel(value: number | null) {
  if (value == null) return 'Not enough data';
  if (value >= 2) return 'Rising';
  if (value <= -2) return 'Needs Attention';
  return 'Stable';
}

function getLineChartPoints(
  values: Array<number | null>,
  width: number,
  height: number,
  padding: number
) {
  const validValues = values.filter((value): value is number => value != null);
  if (validValues.length === 0) return '';

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = Math.max(max - min, 1);

  return values
    .map((value, index) => {
      if (value == null) return null;
      const x =
        padding +
        (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
      const y =
        height -
        padding -
        ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(' ');
}

const pageHeaderStyle = {
  marginBottom: '20px',
};

const sectionEyebrow = {
  color: 'var(--screen-accent)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  marginBottom: '12px',
};

const filterPanelStyle = {
  background: 'var(--screen-panel-bg)',
  border: '1px solid var(--screen-border)',
  borderRadius: '20px',
  padding: '20px',
  marginBottom: '22px',
  boxShadow: 'var(--screen-shadow)',
};

const filterGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '15px',
};

const labelStyle = {
  display: 'block',
  marginBottom: '8px',
  color: 'var(--screen-muted)',
  fontWeight: 700,
  fontSize: '13px',
};

const fieldStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid var(--screen-border-strong)',
  background: 'var(--screen-field-bg)',
  color: 'var(--screen-field-text)',
};

const pickerButtonStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid var(--screen-border-strong)',
  background: 'var(--screen-field-bg)',
  textAlign: 'left' as const,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: 'var(--screen-field-text)',
};

const pickerMenuStyle = {
  position: 'absolute' as const,
  top: 'calc(100% + 8px)',
  left: 0,
  right: 0,
  background: 'var(--screen-menu-bg)',
  border: '1px solid var(--screen-border-strong)',
  borderRadius: '16px',
  boxShadow: 'var(--screen-shadow)',
  zIndex: 20,
  overflow: 'hidden',
};

const pickerListStyle = {
  maxHeight: '280px',
  overflowY: 'auto' as const,
  padding: '8px',
  display: 'grid',
  gap: '8px',
};

const pickerInfoStyle = {
  padding: '12px',
  borderRadius: '8px',
  backgroundColor: 'var(--screen-card-soft-bg)',
  color: 'var(--screen-muted)',
};

const pickerOptionStyle = {
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid var(--screen-border)',
  backgroundColor: 'var(--screen-card-soft-bg)',
  textAlign: 'left' as const,
  cursor: 'pointer',
  fontWeight: 500,
  color: 'var(--screen-text)',
};

const pickerOptionActiveStyle = {
  border: '1px solid #2563eb',
  backgroundColor: 'rgba(37,99,235,0.18)',
};

const filterActionsStyle = {
  marginTop: '10px',
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
};

const buttonRowStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
  marginBottom: '28px',
};

const primaryButton = {
  padding: '10px 14px',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: 'white',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 700,
};

const secondaryButton = {
  padding: '10px 14px',
  backgroundColor: 'var(--screen-secondary-btn-bg)',
  color: 'var(--screen-secondary-btn-text)',
  border: '1px solid var(--screen-border-strong)',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 700,
};

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
  marginTop: '15px',
  marginBottom: '30px',
};

const summaryCardStyle = {
  background: 'var(--screen-card-bg)',
  border: '1px solid var(--screen-border)',
  borderRadius: '16px',
  padding: '20px',
  boxShadow: 'var(--screen-shadow)',
};

const summaryCardTitleStyle = {
  fontSize: '14px',
  color: 'var(--screen-muted)',
  marginBottom: '8px',
};

const summaryCardValueStyle = {
  fontSize: '28px',
  fontWeight: 800,
  color: 'var(--screen-heading)',
};

const sectionTitleStyle = {
  color: 'var(--screen-heading)',
  marginBottom: '14px',
};

const detailGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '16px',
  marginTop: '18px',
};

const detailCardStyle = {
  background: 'var(--screen-card-bg)',
  border: '1px solid var(--screen-border)',
  borderRadius: '16px',
  padding: '18px',
  color: 'var(--screen-text)',
  boxShadow: 'var(--screen-shadow)',
};

const detailLabelStyle = {
  color: 'var(--screen-accent)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  marginBottom: '12px',
};


const trendHeaderRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  alignItems: 'flex-start',
  flexWrap: 'wrap' as const,
};

const trendTitleStyle = {
  margin: '8px 0 6px 0',
  color: 'var(--screen-heading)',
  fontSize: '24px',
};

const trendSubtitleStyle = {
  margin: 0,
  color: 'var(--screen-muted)',
};

const trendToggleWrapStyle = {
  display: 'inline-flex',
  gap: '8px',
  padding: '6px',
  borderRadius: '18px',
  background: 'var(--screen-card-soft-bg)',
  border: '1px solid var(--screen-border)',
};

const trendToggleButtonStyle = {
  border: 'none',
  background: 'transparent',
  color: 'var(--screen-muted)',
  padding: '10px 14px',
  borderRadius: '12px',
  fontWeight: 800,
  cursor: 'pointer',
};

const trendToggleButtonActiveStyle = {
  background: 'rgba(37,99,235,0.16)',
  color: 'var(--screen-heading)',
};

const trendHelperTextStyle = {
  marginTop: '-12px',
  marginBottom: '18px',
  color: 'var(--screen-muted)',
  fontSize: '13px',
  lineHeight: 1.6,
};

const trendChartShellStyle = {
  marginTop: '18px',
  borderRadius: '22px',
  padding: '18px',
  background: 'var(--screen-card-bg)',
  border: '1px solid var(--screen-border)',
};

const trendChartSvgStyle = {
  width: '100%',
  height: '260px',
  display: 'block',
};

const trendChartAxisStyle = {
  stroke: 'rgba(148,163,184,0.28)',
  strokeWidth: 2,
};

const trendLegendStyle = {
  display: 'flex',
  gap: '18px',
  flexWrap: 'wrap' as const,
  marginTop: '10px',
};

const trendLegendItemStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  color: 'var(--screen-muted)',
  fontWeight: 700,
  fontSize: '13px',
};

const trendLegendDotStyle = {
  width: '12px',
  height: '12px',
  borderRadius: '999px',
  display: 'inline-block',
};

const trendChartLabelsStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
  gap: '8px',
  marginTop: '14px',
};

const trendChartLabelStyle = {
  color: 'var(--screen-muted)',
  fontSize: '12px',
  textAlign: 'center' as const,
};

const trendDetailGridStyle = {
  marginTop: '18px',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
  gap: '14px',
};

const trendTableRowStyle = {
  display: 'grid',
  gridTemplateColumns: '1.35fr 0.9fr 0.9fr 0.7fr 0.7fr',
  gap: '12px',
  padding: '12px 14px',
  borderRadius: '14px',
  background: 'var(--screen-card-soft-bg)',
  color: 'var(--screen-text)',
  alignItems: 'center',
};

const trendTableHeaderStyle = {
  color: 'var(--screen-accent)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
  fontWeight: 800,
  fontSize: '12px',
};

const trendIssueCardStyle = {
  padding: '14px',
  borderRadius: '16px',
  background: 'var(--screen-card-soft-bg)',
  border: '1px solid var(--screen-border)',
};

const trendIssueHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '10px',
  alignItems: 'center',
};

const trendIssueMetricStyle = {
  color: 'var(--screen-heading)',
  fontWeight: 800,
};

const trendIssueCountPillStyle = {
  minWidth: '32px',
  height: '32px',
  padding: '0 10px',
  borderRadius: '999px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(37,99,235,0.16)',
  color: 'var(--screen-heading)',
  fontWeight: 900,
};

const trendIssueMetaStyle = {
  marginTop: '8px',
  color: 'var(--screen-muted)',
  fontSize: '13px',
};

const trendIssueBarTrackStyle = {
  marginTop: '10px',
  width: '100%',
  height: '10px',
  borderRadius: '999px',
  background: 'rgba(148,163,184,0.16)',
  overflow: 'hidden' as const,
};

const trendIssueBarFillStyle = {
  height: '100%',
  borderRadius: '999px',
  background:
    'linear-gradient(90deg, rgba(37,99,235,0.95) 0%, rgba(59,130,246,0.88) 100%)',
};

const trendEmptyStateStyle = {
  color: 'var(--screen-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
};

const thinTableWrapStyle = {
  maxHeight: '340px',
  overflowY: 'auto' as const,
  borderRadius: '18px',
  border: '1px solid var(--screen-border)',
  background: 'var(--screen-card-bg)',
  boxShadow: 'var(--screen-shadow)',
};

const thinTableStyle = {
  minWidth: '100%',
};

const thinRowStyle = {
  display: 'grid',
  gap: '12px',
  padding: '12px 16px',
  alignItems: 'center',
  borderBottom: '1px solid var(--screen-border)',
  color: 'var(--screen-text)',
  background: 'transparent',
};

const thinHeaderRowStyle = {
  position: 'sticky' as const,
  top: 0,
  zIndex: 2,
  background: 'var(--screen-table-head-bg)',
  color: 'var(--screen-accent)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  fontWeight: 800,
  fontSize: '12px',
};

const thinPrimaryTextStyle = {
  color: 'var(--screen-heading)',
  fontWeight: 700,
  fontSize: '13px',
  lineHeight: 1.35,
};

const thinSecondaryTextStyle = {
  color: 'var(--screen-muted)',
  fontSize: '12px',
  marginTop: '3px',
  lineHeight: 1.35,
};

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '28px',
  padding: '0 10px',
  borderRadius: '999px',
  background: 'var(--screen-pill-bg)',
  border: '1px solid var(--screen-border)',
  color: 'var(--screen-heading)',
  fontSize: '12px',
  fontWeight: 800,
};

const scorePillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'var(--screen-score-pill-bg)',
  border: '1px solid var(--screen-score-pill-border)',
  color: 'var(--screen-heading)',
  fontSize: '12px',
  fontWeight: 900,
};

const recentAuditsRowGridStyle = {
  ...thinRowStyle,
  gridTemplateColumns: '1.05fr 1.35fr 1.05fr 1.8fr 0.7fr',
};

const recentRequestsRowGridStyle = {
  ...thinRowStyle,
  gridTemplateColumns: '0.9fr 1.2fr 1.3fr 0.8fr 0.8fr',
};

const recentFeedbackRowGridStyle = {
  ...thinRowStyle,
  gridTemplateColumns: '0.9fr 1.25fr 0.9fr 1.6fr 0.8fr',
};

const recentAuditDateCellStyle = {
  minWidth: 0,
};

const recentAuditAgentCellStyle = {
  minWidth: 0,
};

const recentAuditCaseCellStyle = {
  minWidth: 0,
};

const recentAuditReferenceCellStyle = {
  minWidth: 0,
};

const recentAuditScoreCellStyle = {
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
};

const recentRequestDateCellStyle = {
  minWidth: 0,
};

const recentRequestCaseRefCellStyle = {
  minWidth: 0,
};

const recentRequestAgentCellStyle = {
  minWidth: 0,
};

const recentRequestPriorityCellStyle = {
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
};

const recentRequestStatusCellStyle = {
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
};

const recentFeedbackDateCellStyle = {
  minWidth: 0,
};

const recentFeedbackAgentCellStyle = {
  minWidth: 0,
};

const recentFeedbackTypeCellStyle = {
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
};

const recentFeedbackSubjectCellStyle = {
  minWidth: 0,
};

const recentFeedbackStatusCellStyle = {
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
};

const emptyMessageStyle = {
  color: 'var(--screen-muted)',
};

export default ReportsSupabase;