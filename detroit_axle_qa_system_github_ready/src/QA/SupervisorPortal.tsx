import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import MonitoringWidget from './MonitoringWidget';
import MonitoringDrawer from './MonitoringDrawer';
import SupervisorRequestsSupabase from './SupervisorRequestsSupabase';
import RecognitionWall from './RecognitionWall';
import DigitalTrophyCabinet from './DigitalTrophyCabinet';

type TeamName = 'Calls' | 'Tickets' | 'Sales';

type UserProfile = {
  id: string;
  role: 'admin' | 'qa' | 'agent' | 'supervisor';
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
  email: string;
};

type AgentProfile = {
  id: string;
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
  email: string;
};

type ScoreDetail = {
  metric: string;
  result: string;
  pass: number;
  borderline: number;
  adjustedWeight: number;
  earned: number;
  counts_toward_score?: boolean;
  metric_comment?: string | null;
};

type AuditItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName;
  case_type: string;
  audit_date: string;
  order_number?: string | null;
  phone_number?: string | null;
  ticket_id?: string | null;
  quality_score: number;
  comments: string | null;
  score_details: ScoreDetail[];
  shared_with_agent?: boolean;
  created_by_name?: string | null;
  created_by_email?: string | null;
  shared_at?: string | null;
};

type TeamRecord = {
  id: string;
  agent_id: string;
  agent_name: string;
  calls_count?: number;
  tickets_count?: number;
  amount?: number;
  call_date?: string;
  ticket_date?: string;
  sale_date?: string;
  date_to?: string | null;
  notes: string | null;
};

type MonitoringItem = {
  id: string;
  order_number: string;
  comment: string;
  agent_id: string;
  agent_name: string;
  display_name: string | null;
  team: TeamName;
  created_by_name: string;
  created_by_email: string;
  created_at: string;
  status: 'active' | 'resolved';
  acknowledged_by_agent: boolean;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolved_by_name: string | null;
  resolved_by_email: string | null;
};

type SupervisorPortalTab = 'overview' | 'requests';

type SupervisorPortalProps = {
  currentUser: UserProfile;
};

type AgentFeedback = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName;
  qa_name: string;
  feedback_type: 'Coaching' | 'Audit Feedback' | 'Warning' | 'Follow-up';
  subject: string;
  feedback_note: string;
  action_plan?: string | null;
  due_date: string | null;
  status: 'Open' | 'In Progress' | 'Closed';
  created_at: string;
  acknowledged_by_agent?: boolean | null;
};

type ReviewStage = 'QA Shared' | 'Acknowledged' | 'Agent Responded' | 'Supervisor Reviewed' | 'Follow-up' | 'Closed';
type PlanPriority = 'Low' | 'Medium' | 'High' | 'Critical';
type FollowUpOutcome = 'Not Set' | 'Improved' | 'Partial Improvement' | 'No Improvement' | 'Needs Escalation';

const COACHING_PLAN_SECTION_LABELS = [
  'Priority',
  'Action Plan',
  'Justification',
  'Review Stage',
  'Agent Comment',
  'Supervisor Review',
  'Follow-up Outcome',
  'Resolution Note',
] as const;

function escapeCoachingRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeReviewStage(value?: string | null): ReviewStage {
  if (
    value === 'QA Shared' ||
    value === 'Acknowledged' ||
    value === 'Agent Responded' ||
    value === 'Supervisor Reviewed' ||
    value === 'Follow-up' ||
    value === 'Closed'
  ) {
    return value;
  }
  return 'QA Shared';
}

function normalizeFeedbackPriority(value?: string | null): PlanPriority {
  if (value === 'Low' || value === 'Medium' || value === 'High' || value === 'Critical') {
    return value;
  }
  return 'Medium';
}

function normalizeFeedbackOutcome(value?: string | null): FollowUpOutcome {
  if (
    value === 'Improved' ||
    value === 'Partial Improvement' ||
    value === 'No Improvement' ||
    value === 'Needs Escalation'
  ) {
    return value;
  }
  return 'Not Set';
}

function parseCoachingPlan(value?: string | null) {
  const raw = String(value || '').trim();
  const labelsPattern = COACHING_PLAN_SECTION_LABELS.map((label) => escapeCoachingRegex(label)).join('|');

  function readSection(label: (typeof COACHING_PLAN_SECTION_LABELS)[number]) {
    const regex = new RegExp(`${escapeCoachingRegex(label)}:\n([\\s\\S]*?)(?=\\n(?:${labelsPattern}):\\n|$)`);
    const match = raw.match(regex);
    return match ? match[1].trim() : '';
  }

  const hasStructuredSections = COACHING_PLAN_SECTION_LABELS.some((label) => raw.includes(`${label}:`));

  return {
    priority: normalizeFeedbackPriority(readSection('Priority')),
    actionPlan: hasStructuredSections ? readSection('Action Plan') : raw,
    justification: readSection('Justification'),
    reviewStage: normalizeReviewStage(readSection('Review Stage')),
    agentComment: readSection('Agent Comment'),
    supervisorReview: readSection('Supervisor Review'),
    followUpOutcome: normalizeFeedbackOutcome(readSection('Follow-up Outcome')),
    resolutionNote: readSection('Resolution Note'),
  };
}

function composeCoachingPlan({
  priority,
  actionPlan,
  justification,
  reviewStage,
  agentComment,
  supervisorReview,
  followUpOutcome,
  resolutionNote,
}: {
  priority: PlanPriority;
  actionPlan: string;
  justification: string;
  reviewStage: ReviewStage;
  agentComment: string;
  supervisorReview: string;
  followUpOutcome: FollowUpOutcome;
  resolutionNote: string;
}) {
  const sections = [
    `Priority:\n${priority}`,
    actionPlan.trim() ? `Action Plan:\n${actionPlan.trim()}` : '',
    justification.trim() ? `Justification:\n${justification.trim()}` : '',
    `Review Stage:\n${reviewStage}`,
    agentComment.trim() ? `Agent Comment:\n${agentComment.trim()}` : '',
    supervisorReview.trim() ? `Supervisor Review:\n${supervisorReview.trim()}` : '',
    followUpOutcome !== 'Not Set' ? `Follow-up Outcome:\n${followUpOutcome}` : '',
    resolutionNote.trim() ? `Resolution Note:\n${resolutionNote.trim()}` : '',
  ].filter(Boolean);

  return sections.join('\n\n').trim();
}
function openNativeDatePicker(target: HTMLInputElement) {
  const input = target as HTMLInputElement & { showPicker?: () => void };
  input.showPicker?.();
}

function getSupervisorThemeVars(): Record<string, string> {
  const themeMode =
    typeof document !== 'undefined'
      ? (
          document.body.dataset.theme ||
          document.documentElement.dataset.theme ||
          window.localStorage.getItem('detroit-axle-theme-mode') ||
          window.sessionStorage.getItem('detroit-axle-theme-mode') ||
          window.localStorage.getItem('detroit-axle-theme') ||
          window.sessionStorage.getItem('detroit-axle-theme') ||
          ''
        ).toLowerCase()
      : '';

  const isLight = themeMode === 'light' || themeMode === 'white';

  return {
    '--da-page-text': isLight ? '#334155' : '#e5eefb',
    '--da-title': isLight ? '#0f172a' : '#f8fafc',
    '--da-muted-text': isLight ? '#475569' : '#cbd5e1',
    '--da-subtle-text': isLight ? '#64748b' : '#94a3b8',
    '--da-accent-text': isLight ? '#2563eb' : '#60a5fa',
    '--da-panel-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,250,255,0.96) 100%)'
      : 'linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.68) 100%)',
    '--da-panel-border': isLight
      ? '1px solid rgba(203,213,225,0.92)'
      : '1px solid rgba(148,163,184,0.14)',
    '--da-panel-shadow': isLight
      ? '0 18px 40px rgba(15,23,42,0.10)'
      : '0 18px 40px rgba(2,6,23,0.35)',
    '--da-surface-bg': isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.62)',
    '--da-field-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,255,0.98) 100%)'
      : 'rgba(15,23,42,0.74)',
  };
}

function SupervisorPortal({ currentUser }: SupervisorPortalProps) {
  const [teamAgents, setTeamAgents] = useState<AgentProfile[]>([]);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [records, setRecords] = useState<TeamRecord[]>([]);
  const [monitoringItems, setMonitoringItems] = useState<MonitoringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedAgentProfileId, setSelectedAgentProfileId] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [monitoringOpen, setMonitoringOpen] = useState(false);
  const [monitoringAgentFilter, setMonitoringAgentFilter] = useState('');
  const [activeTab, setActiveTab] = useState<SupervisorPortalTab>('overview');
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [recordDateFrom, setRecordDateFrom] = useState('');
  const [recordDateTo, setRecordDateTo] = useState('');

  const [feedbackItems, setFeedbackItems] = useState<AgentFeedback[]>([]);
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);
  const [reviewStageDrafts, setReviewStageDrafts] = useState<Record<string, ReviewStage>>({});
  const [supervisorReviewDrafts, setSupervisorReviewDrafts] = useState<Record<string, string>>({});

  const agentPickerRef = useRef<HTMLDivElement | null>(null);
  const pageRootRef = useRef<HTMLDivElement | null>(null);
  const themeVars = getSupervisorThemeVars();
  const [auditsVisible, setAuditsVisible] = useState(true);

  useEffect(() => {
    void loadTeamData(false);
  }, [currentUser.id, currentUser.team]);

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

  async function loadTeamData(isRefresh: boolean) {
    if (!currentUser.team) {
      setErrorMessage('Your supervisor profile is missing a team.');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setErrorMessage('');

    const agentsPromise = supabase
      .from('profiles')
      .select('id, agent_id, agent_name, display_name, team, email')
      .eq('role', 'agent')
      .eq('team', currentUser.team)
      .order('agent_name', { ascending: true });

    const auditsPromise = supabase
      .from('audits')
      .select('*')
      .eq('team', currentUser.team)
      .order('audit_date', { ascending: false });

    const monitoringPromise = supabase
      .from('monitoring_items')
      .select('*')
      .eq('team', currentUser.team)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    const feedbackPromise = supabase
      .from('agent_feedback')
      .select('*')
      .eq('team', currentUser.team)
      .order('created_at', { ascending: false });

    const recordsPromise =
      currentUser.team === 'Calls'
        ? supabase
            .from('calls_records')
            .select('*')
            .order('call_date', { ascending: false })
        : currentUser.team === 'Tickets'
        ? supabase
            .from('tickets_records')
            .select('*')
            .order('ticket_date', { ascending: false })
        : supabase
            .from('sales_records')
            .select('*')
            .order('sale_date', { ascending: false });

    const [agentsResult, auditsResult, recordsResult, monitoringResult, feedbackResult] =
      await Promise.all([
        agentsPromise,
        auditsPromise,
        recordsPromise,
        monitoringPromise,
        feedbackPromise,
      ]);

    const errors = [
      agentsResult.error?.message,
      auditsResult.error?.message,
      recordsResult.error?.message,
      monitoringResult.error?.message,
      feedbackResult.error?.message,
    ].filter(Boolean);

    if (errors.length > 0) {
      setErrorMessage(errors.join(' | '));
    }

    setTeamAgents((agentsResult.data as AgentProfile[]) || []);
    setAudits((auditsResult.data as AuditItem[]) || []);
    setRecords((recordsResult.data as TeamRecord[]) || []);
    setMonitoringItems((monitoringResult.data as MonitoringItem[]) || []);
    setFeedbackItems((feedbackResult.data as AgentFeedback[]) || []);
    setLoading(false);
    setRefreshing(false);
  }

  function getAgentLabel(agentId?: string | null, agentName?: string | null) {
    const matchedProfile = teamAgents.find(
      (profile) =>
        profile.agent_id === (agentId || null) &&
        profile.agent_name === (agentName || '')
    );

    if (matchedProfile?.display_name) {
      return `${agentName || '-'} - ${matchedProfile.display_name}`;
    }

    return `${agentName || '-'} - ${agentId || '-'}`;
  }

  function formatDate(dateValue?: string | null) {
    if (!dateValue) return '-';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  }

  function formatDateOnly(dateValue?: string | null) {
    if (!dateValue) return '-';
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateValue;
    return date.toLocaleDateString();
  }

  function getAuditReference(audit: AuditItem) {
    if (audit.team === 'Tickets') {
      return `Ticket ID: ${audit.ticket_id || '-'}`;
    }

    return `Order #: ${audit.order_number || '-'} | Phone: ${
      audit.phone_number || '-'
    }`;
  }

  function normalizeAgentId(value?: string | null) {
    return String(value || '').trim().replace(/\.0+$/, '');
  }

  function normalizeAgentName(value?: string | null) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function matchesDateRange(
    startDate?: string | null,
    endDate?: string | null,
    filterFrom?: string,
    filterTo?: string
  ) {
    const recordStart = String(startDate || '').slice(0, 10);
    const recordEnd = String(endDate || startDate || '').slice(0, 10);

    if (!recordStart) return false;

    const effectiveFrom = filterFrom || '0001-01-01';
    const effectiveTo = filterTo || '9999-12-31';

    return recordEnd >= effectiveFrom && recordStart <= effectiveTo;
  }

  function clearAuditDateFilters() {
    setAuditDateFrom('');
    setAuditDateTo('');
  }

  function clearRecordDateFilters() {
    setRecordDateFrom('');
    setRecordDateTo('');
  }

  function getResultBadgeColor(result: string) {
    if (result === 'Pass') return '#166534';
    if (result === 'Borderline') return '#92400e';
    if (result === 'Fail' || result === 'Auto-Fail') return '#991b1b';
    if (result === 'N/A') return '#374151';
    if (result === 'Yes') return '#166534';
    if (result === 'No') return '#991b1b';
    return '#1f2937';
  }

  function isNoScoreDetail(detail: ScoreDetail) {
    return (
      detail.counts_toward_score === false ||
      (Number(detail.pass || 0) === 0 &&
        Number(detail.borderline || 0) === 0 &&
        Number(detail.adjustedWeight || 0) === 0)
    );
  }

  function getRecordStartDate(record: TeamRecord) {
    return record.call_date || record.ticket_date || record.sale_date || '-';
  }

  function getRecordMetricLabel() {
    if (currentUser.team === 'Calls') return 'Calls Count';
    if (currentUser.team === 'Tickets') return 'Tickets Count';
    return 'Amount';
  }

  function getRecordMetricValue(record: TeamRecord) {
    if (currentUser.team === 'Calls') return String(record.calls_count ?? 0);
    if (currentUser.team === 'Tickets') return String(record.tickets_count ?? 0);
    return `$${Number(record.amount || 0).toFixed(2)}`;
  }

  const visibleAgents = useMemo(() => {
    const search = agentSearch.trim().toLowerCase();

    if (!search) return teamAgents;

    return teamAgents.filter((profile) => {
      const label = getAgentLabel(
        profile.agent_id,
        profile.agent_name
      ).toLowerCase();

      return (
        profile.agent_name.toLowerCase().includes(search) ||
        (profile.agent_id || '').toLowerCase().includes(search) ||
        (profile.display_name || '').toLowerCase().includes(search) ||
        label.includes(search)
      );
    });
  }, [teamAgents, agentSearch]);

  const selectedAgent =
    teamAgents.find((profile) => profile.id === selectedAgentProfileId) || null;

  function handleSelectAgent(profile: AgentProfile) {
    setSelectedAgentProfileId(profile.id);
    setAgentSearch(getAgentLabel(profile.agent_id, profile.agent_name));
    setIsAgentPickerOpen(false);
  }

  function clearAgentFilter() {
    setSelectedAgentProfileId('');
    setAgentSearch('');
    setIsAgentPickerOpen(false);
  }

  const filteredAudits = useMemo(() => {
    return audits.filter((audit) => {
      const matchesAgent = selectedAgent
        ? (
            (normalizeAgentId(audit.agent_id) &&
              normalizeAgentId(audit.agent_id) === normalizeAgentId(selectedAgent.agent_id)) ||
            normalizeAgentName(audit.agent_name) ===
              normalizeAgentName(selectedAgent.agent_name)
          )
        : true;

      const matchesDates = matchesDateRange(
        audit.audit_date,
        audit.audit_date,
        auditDateFrom,
        auditDateTo
      );

      return matchesAgent && matchesDates;
    });
  }, [audits, selectedAgent, auditDateFrom, auditDateTo]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesAgent = selectedAgent
        ? (
            (normalizeAgentId(record.agent_id) &&
              normalizeAgentId(record.agent_id) === normalizeAgentId(selectedAgent.agent_id)) ||
            normalizeAgentName(record.agent_name) ===
              normalizeAgentName(selectedAgent.agent_name)
          )
        : true;

      const recordStart =
        record.call_date || record.ticket_date || record.sale_date || null;
      const matchesDates = matchesDateRange(
        recordStart,
        record.date_to || null,
        recordDateFrom,
        recordDateTo
      );

      return matchesAgent && matchesDates;
    });
  }, [records, selectedAgent, recordDateFrom, recordDateTo]);

  const averageQuality =
    filteredAudits.length > 0
      ? (
          filteredAudits.reduce(
            (sum, item) => sum + Number(item.quality_score),
            0
          ) / filteredAudits.length
        ).toFixed(2)
      : '0.00';

  const releasedAuditCount = filteredAudits.filter(
    (item) => item.shared_with_agent
  ).length;

  const hiddenAuditCount = filteredAudits.length - releasedAuditCount;

  const totalMetric = filteredRecords.reduce(
    (sum, item) =>
      sum + Number(item.calls_count || item.tickets_count || item.amount || 0),
    0
  );

  function handleMonitoringWidgetClick() {
    setMonitoringOpen(true);

    if (pageRootRef.current) {
      pageRootRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const filteredFeedbackItems = useMemo(() => {
    return feedbackItems.filter((item) => {
      const matchesAgent = selectedAgent
        ? (
            (normalizeAgentId(item.agent_id) &&
              normalizeAgentId(item.agent_id) === normalizeAgentId(selectedAgent.agent_id)) ||
            normalizeAgentName(item.agent_name) === normalizeAgentName(selectedAgent.agent_name)
          )
        : true;
      return matchesAgent;
    });
  }, [feedbackItems, selectedAgent]);

  const awaitingSupervisorCount = filteredFeedbackItems.filter((item) => {
    const parsed = parseCoachingPlan(item.action_plan);
    return item.status !== 'Closed' && parsed.reviewStage === 'Agent Responded';
  }).length;

  const supervisorInboxItems = filteredFeedbackItems
    .filter((item) => item.status !== 'Closed')
    .sort((a, b) => {
      const aParsed = parseCoachingPlan(a.action_plan);
      const bParsed = parseCoachingPlan(b.action_plan);
      const aNeedsReview = aParsed.reviewStage === 'Agent Responded' ? 1 : 0;
      const bNeedsReview = bParsed.reviewStage === 'Agent Responded' ? 1 : 0;
      if (aNeedsReview !== bNeedsReview) return bNeedsReview - aNeedsReview;
      return String(b.created_at).localeCompare(String(a.created_at));
    });

  async function handleSaveSupervisorReview(item: AgentFeedback) {
    setErrorMessage('');

    const parsed = parseCoachingPlan(item.action_plan);
    const nextStage = reviewStageDrafts[item.id] || parsed.reviewStage;
    const nextReview = String(supervisorReviewDrafts[item.id] ?? parsed.supervisorReview).trim();

    const nextActionPlan = composeCoachingPlan({
      priority: parsed.priority,
      actionPlan: parsed.actionPlan,
      justification: parsed.justification,
      reviewStage: nextStage,
      agentComment: parsed.agentComment,
      supervisorReview: nextReview,
      followUpOutcome: parsed.followUpOutcome,
      resolutionNote: parsed.resolutionNote,
    });

    const { error } = await supabase
      .from('agent_feedback')
      .update({ action_plan: nextActionPlan || null })
      .eq('id', item.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setFeedbackItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id ? { ...entry, action_plan: nextActionPlan || null } : entry
      )
    );
  }

  if (loading) {

    return <div style={{ color: 'var(--da-muted-text, #cbd5e1)' }}>Loading supervisor portal...</div>;
  }

  return (
    <div ref={pageRootRef} data-no-theme-invert="true" style={{ color: 'var(--da-page-text, #e5eefb)', ...(themeVars as any) }}>
      <div style={pageHeaderStyle}>
        <div>
          <div style={sectionEyebrow}>Supervisor Portal</div>
          <h2 style={{ marginBottom: '8px' }}>
            {currentUser.team || 'Team'} Supervisor Portal
          </h2>
        </div>

        <button
          type="button"
          onClick={() => void loadTeamData(true)}
          disabled={refreshing}
          style={secondaryButton}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div style={tabBarStyle}>
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          style={{
            ...tabButtonStyle,
            ...(activeTab === 'overview' ? activeTabButtonStyle : {}),
          }}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          style={{
            ...tabButtonStyle,
            ...(activeTab === 'requests' ? activeTabButtonStyle : {}),
          }}
        >
          Supervisor Requests
        </button>
      </div>

      {activeTab === 'requests' ? (
        <div style={{ marginTop: '24px' }}>
          <SupervisorRequestsSupabase currentUser={currentUser} />
        </div>
      ) : (
        <>
          {errorMessage ? <div style={errorBanner}>{errorMessage}</div> : null}

          <div style={panelStyle}>
            <label style={labelStyle}>Agent Filter</label>

            <div ref={agentPickerRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsAgentPickerOpen((prev) => !prev)}
                style={pickerButtonStyle}
              >
                <span style={{ color: selectedAgent ? 'var(--da-title, #f8fafc)' : 'var(--da-subtle-text, #94a3b8)' }}>
                  {selectedAgent
                    ? getAgentLabel(
                        selectedAgent.agent_id,
                        selectedAgent.agent_name
                      )
                    : 'All team agents'}
                </span>
                <span>▼</span>
              </button>

              {isAgentPickerOpen ? (
                <div style={pickerMenuStyle}>
                  <div style={pickerSearchWrapStyle}>
                    <input
                      type="text"
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                      placeholder="Search by name, ID, or display name"
                      style={fieldStyle}
                    />
                  </div>

                  <div style={pickerListStyle}>
                    {visibleAgents.length === 0 ? (
                      <div style={pickerInfoStyle}>No agents found</div>
                    ) : (
                      visibleAgents.map((profile) => (
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
                          {getAgentLabel(profile.agent_id, profile.agent_name)}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                onClick={clearAgentFilter}
                style={secondaryButton}
              >
                Clear Filter
              </button>
            </div>

            <div style={{ ...filterGridStyle, marginTop: '16px' }}>
              <div>
                <label style={labelStyle}>Audit Date From</label>
                <input
                  type="date"
                  value={auditDateFrom}
                  onChange={(e) => setAuditDateFrom(e.target.value)}
                  onClick={(e) => openNativeDatePicker(e.currentTarget)}
                  onFocus={(e) => openNativeDatePicker(e.currentTarget)}
                  style={fieldStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Audit Date To</label>
                <input
                  type="date"
                  value={auditDateTo}
                  onChange={(e) => setAuditDateTo(e.target.value)}
                  onClick={(e) => openNativeDatePicker(e.currentTarget)}
                  onFocus={(e) => openNativeDatePicker(e.currentTarget)}
                  style={fieldStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Records Date From</label>
                <input
                  type="date"
                  value={recordDateFrom}
                  onChange={(e) => setRecordDateFrom(e.target.value)}
                  onClick={(e) => openNativeDatePicker(e.currentTarget)}
                  onFocus={(e) => openNativeDatePicker(e.currentTarget)}
                  style={fieldStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Records Date To</label>
                <input
                  type="date"
                  value={recordDateTo}
                  onChange={(e) => setRecordDateTo(e.target.value)}
                  onClick={(e) => openNativeDatePicker(e.currentTarget)}
                  onFocus={(e) => openNativeDatePicker(e.currentTarget)}
                  style={fieldStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
              <button
                type="button"
                onClick={clearAuditDateFilters}
                style={secondaryButton}
              >
                Clear Audit Dates
              </button>
              <button
                type="button"
                onClick={clearRecordDateFilters}
                style={secondaryButton}
              >
                Clear Record Dates
              </button>
            </div>
          </div>

          <div style={summaryGridStyle}>
            <SummaryCard
              title="Team Agents"
              value={String(teamAgents.length)}
            />
            <SummaryCard
              title={selectedAgent ? 'Filtered Audits' : 'Team Audits'}
              value={String(filteredAudits.length)}
            />
            <SummaryCard title="Average Quality" value={`${averageQuality}%`} />
            <SummaryCard
              title="Released Audits"
              value={String(releasedAuditCount)}
            />
            <SummaryCard
              title="Hidden Audits"
              value={String(hiddenAuditCount)}
            />
            <SummaryCard
              title={
                currentUser.team === 'Sales'
                  ? 'Total Sales'
                  : `Total ${currentUser.team}`
              }
              value={
                currentUser.team === 'Sales'
                  ? `$${totalMetric.toFixed(2)}`
                  : String(totalMetric)
              }
            />
            <SummaryCard
              title="Monitoring Alerts"
              value={String(monitoringItems.length)}
            />
            <SummaryCard
              title="Awaiting Supervisor"
              value={String(awaitingSupervisorCount)}
            />
          </div>

          <Section title="Coaching Review Queue">
            <p style={sectionIntroTextStyle}>
              Coaching items now stay visible on the supervisor portal. Review the agent reply, leave your supervisor review, and move the coaching cycle forward from here.
            </p>
            {supervisorInboxItems.length === 0 ? (
              <p>No coaching items found for this team filter.</p>
            ) : (
              <div style={supervisorInboxGridStyle}>
                {supervisorInboxItems.map((item) => {
                  const parsedPlan = parseCoachingPlan(item.action_plan);
                  const stageColor =
                    parsedPlan.reviewStage === 'Closed'
                      ? '#166534'
                      : parsedPlan.reviewStage === 'Follow-up'
                      ? '#7c3aed'
                      : parsedPlan.reviewStage === 'Supervisor Reviewed'
                      ? '#b45309'
                      : parsedPlan.reviewStage === 'Agent Responded' || parsedPlan.reviewStage === 'Acknowledged'
                      ? '#2563eb'
                      : '#475569';

                  return (
                    <div key={`inbox-${item.id}`} style={supervisorInboxCardStyle}>
                      <div style={supervisorInboxTopRowStyle}>
                        <div>
                          <div style={sectionEyebrow}>Coaching Inbox</div>
                          <div style={primaryCellTextStyle}>{item.subject}</div>
                          <div style={secondaryCellTextStyle}>
                            {getAgentLabel(item.agent_id, item.agent_name)} • {item.team}
                          </div>
                        </div>
                        <span style={{ ...pillStyle, backgroundColor: stageColor }}>
                          {parsedPlan.reviewStage}
                        </span>
                      </div>

                      <div style={detailInfoGridStyle}>
                        <div style={detailInfoCardStyle}>
                          <div style={detailLabelStyle}>Agent Comment</div>
                          <div style={detailValueStyle}>{parsedPlan.agentComment || 'No agent reply yet.'}</div>
                        </div>
                        <div style={detailInfoCardStyle}>
                          <div style={detailLabelStyle}>Action Plan</div>
                          <div style={detailValueStyle}>{parsedPlan.actionPlan || '-'}</div>
                        </div>
                      </div>

                      <div style={detailInfoGridStyle}>
                        <div style={detailInfoCardStyle}>
                          <div style={detailLabelStyle}>Review Stage</div>
                          <select
                            value={reviewStageDrafts[item.id] || parsedPlan.reviewStage}
                            onChange={(e) =>
                              setReviewStageDrafts((prev) => ({
                                ...prev,
                                [item.id]: e.target.value as ReviewStage,
                              }))
                            }
                            style={fieldStyle}
                          >
                            <option value="QA Shared">QA Shared</option>
                            <option value="Acknowledged">Acknowledged</option>
                            <option value="Agent Responded">Agent Responded</option>
                            <option value="Supervisor Reviewed">Supervisor Reviewed</option>
                            <option value="Follow-up">Follow-up</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </div>
                        <div style={detailInfoCardStyle}>
                          <div style={detailLabelStyle}>Supervisor Review</div>
                          <textarea
                            value={supervisorReviewDrafts[item.id] ?? parsedPlan.supervisorReview}
                            onChange={(e) =>
                              setSupervisorReviewDrafts((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                            rows={4}
                            style={fieldStyle}
                            placeholder="Leave your supervisor review, decision, or escalation guidance."
                          />
                        </div>
                      </div>

                      <div style={sectionHeaderActionsStyle}>
                        <button
                          type="button"
                          onClick={() => void handleSaveSupervisorReview(item)}
                          style={miniSecondaryButton}
                        >
                          Save Supervisor Review
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedFeedbackId(expandedFeedbackId === item.id ? null : item.id)
                          }
                          style={miniSecondaryButton}
                        >
                          {expandedFeedbackId === item.id ? 'Hide Full Queue Row' : 'Open Full Queue Row'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title={selectedAgent ? 'Audit History • Selected Agent Audits' : `${currentUser.team || 'Team'} Audit History`}>
            <p style={sectionIntroTextStyle}>
              This audit history stays fixed in its own panel and scrolls inside the section, so supervisors can keep the selected agent context visible while reviewing details.
            </p>

            <div style={sectionHeaderActionsStyle}>
              <button
                type="button"
                onClick={() => setAuditsVisible((prev) => !prev)}
                style={miniSecondaryButton}
              >
                {auditsVisible ? 'Hide Audits' : 'Show Audits'}
              </button>
            </div>

            {!auditsVisible ? (
              <div style={collapsedMessageStyle}>Audits are hidden for now.</div>
            ) : filteredAudits.length === 0 ? (
              <p>No audits found for this selection.</p>
            ) : (
              <>
                <div style={auditHistoryStatsGridStyle}>
                  <div style={auditHistoryStatCardStyle}>
                    <div style={detailLabelStyle}>Loaded Audits</div>
                    <div style={detailValueStyle}>{String(filteredAudits.length)}</div>
                  </div>
                  <div style={auditHistoryStatCardStyle}>
                    <div style={detailLabelStyle}>Released</div>
                    <div style={detailValueStyle}>{String(releasedAuditCount)}</div>
                  </div>
                  <div style={auditHistoryStatCardStyle}>
                    <div style={detailLabelStyle}>Average Quality</div>
                    <div style={detailValueStyle}>{averageQuality}%</div>
                  </div>
                </div>

                <div style={auditHistoryListWrapStyle}>
                  {filteredAudits.map((audit) => {
                    const isExpanded = expandedAuditId === audit.id;

                    return (
                      <div
                        key={audit.id}
                        style={{
                          ...auditHistoryCardStyle,
                          ...(isExpanded ? auditHistoryCardActiveStyle : {}),
                        }}
                      >
                        <div style={auditHistoryTopRowStyle}>
                          <div>
                            <div style={primaryCellTextStyle}>{audit.case_type}</div>
                            <div style={secondaryCellTextStyle}>
                              {formatDateOnly(audit.audit_date)} • {getAgentLabel(audit.agent_id, audit.agent_name)}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={auditHistoryScoreStyle}>
                              {Number(audit.quality_score).toFixed(2)}%
                            </div>
                            <span
                              style={{
                                ...pillStyle,
                                backgroundColor: audit.shared_with_agent ? '#166534' : '#475569',
                                marginTop: '8px',
                              }}
                            >
                              {audit.shared_with_agent ? 'Released' : 'Hidden'}
                            </span>
                          </div>
                        </div>

                        <div style={auditHistoryMetaGridStyle}>
                          <div style={auditHistoryMetaCardStyle}>
                            <div style={detailLabelStyle}>Reference</div>
                            <div style={detailValueStyle}>{getAuditReference(audit)}</div>
                          </div>
                          <div style={auditHistoryMetaCardStyle}>
                            <div style={detailLabelStyle}>Created By</div>
                            <div style={detailValueStyle}>
                              {audit.created_by_name || audit.created_by_email || '-'}
                            </div>
                          </div>
                          <div style={auditHistoryMetaCardStyle}>
                            <div style={detailLabelStyle}>Release Date</div>
                            <div style={detailValueStyle}>{formatDate(audit.shared_at)}</div>
                          </div>
                        </div>

                        <div style={auditHistoryCommentStyle}>
                          {audit.comments?.trim() || 'No audit comment saved for this item.'}
                        </div>

                        <div style={sectionHeaderActionsStyle}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedAuditId(expandedAuditId === audit.id ? null : audit.id)
                            }
                            style={miniSecondaryButton}
                          >
                            {isExpanded ? 'Hide Details' : 'Open Details'}
                          </button>
                        </div>

                        {isExpanded ? (
                          <div style={auditHistoryExpandedWrapStyle}>
                            <div style={{ ...sectionEyebrow, marginBottom: '10px' }}>
                              Score Details
                            </div>
                            <div style={{ display: 'grid', gap: '10px' }}>
                              {(audit.score_details || []).map((detail) => (
                                <div
                                  key={`${audit.id}-${detail.metric}`}
                                  style={detailRowStyle}
                                >
                                  <div>
                                    <div
                                      style={{
                                        color: 'var(--da-title, #f8fafc)',
                                        fontWeight: 700,
                                      }}
                                    >
                                      {detail.metric}
                                    </div>
                                    <div
                                      style={{
                                        color: 'var(--da-subtle-text, #94a3b8)',
                                        fontSize: '12px',
                                        marginTop: '4px',
                                      }}
                                    >
                                      {isNoScoreDetail(detail)
                                        ? 'Yes / No question • No score'
                                        : `Pass ${detail.pass} • Borderline ${detail.borderline} • Adjusted ${Number(detail.adjustedWeight || 0).toFixed(2)}`}
                                    </div>
                                    {detail.metric_comment ? (
                                      <div style={metricNoteCardStyle}>
                                        <div style={metricNoteLabelStyle}>QA Note</div>
                                        <div style={metricNoteTextStyle}>{detail.metric_comment}</div>
                                      </div>
                                    ) : null}
                                  </div>

                                  <span
                                    style={{
                                      ...pillStyle,
                                      backgroundColor: getResultBadgeColor(detail.result),
                                    }}
                                  >
                                    {detail.result}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Section>

          <Section title={`${currentUser.team} Team Records`}>
            {filteredRecords.length === 0 ? (
              <p>No team records found.</p>
            ) : (
              <div style={recordsTableWrapStyle}>
                <div style={recordsTableStyle}>
                  <div style={{ ...recordsRowStyle, ...recordsHeaderRowStyle }}>
                    <div style={recordsCellAgentStyle}>Agent</div>
                    <div style={recordsCellDateFromStyle}>Date From</div>
                    <div style={recordsCellDateToStyle}>Date To</div>
                    <div style={recordsCellMetricStyle}>{getRecordMetricLabel()}</div>
                    <div style={recordsCellNotesStyle}>Notes</div>
                  </div>

                  {filteredRecords.map((record) => (
                    <div key={record.id} style={recordsRowStyle}>
                      <div style={recordsCellAgentStyle}>
                        <div style={primaryCellTextStyle}>
                          {getAgentLabel(record.agent_id, record.agent_name)}
                        </div>
                      </div>

                      <div style={recordsCellDateFromStyle}>
                        <div style={primaryCellTextStyle}>
                          {getRecordStartDate(record)}
                        </div>
                      </div>

                      <div style={recordsCellDateToStyle}>
                        <div style={primaryCellTextStyle}>
                          {record.date_to || '-'}
                        </div>
                      </div>

                      <div style={recordsCellMetricStyle}>
                        <div style={primaryCellTextStyle}>
                          {getRecordMetricValue(record)}
                        </div>
                      </div>

                      <div style={recordsCellNotesStyle}>
                        <div style={primaryCellTextStyle}>
                          {record.notes || '-'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <RecognitionWall compact currentUser={currentUser as any} />
          <DigitalTrophyCabinet scope="team" currentUser={currentUser} />

          <MonitoringWidget
            count={monitoringItems.length}
            onClick={handleMonitoringWidgetClick}
          />
          <MonitoringDrawer
            open={monitoringOpen}
            onClose={() => setMonitoringOpen(false)}
            items={monitoringItems}
            mode="supervisor"
            selectedAgentId={monitoringAgentFilter}
            onSelectAgentId={setMonitoringAgentFilter}
            agentOptions={teamAgents.map((item) => ({
              id: item.id,
              agent_id: item.agent_id,
              agent_name: item.agent_name,
              display_name: item.display_name,
            }))}
            onItemUpdated={() => loadTeamData(true)}
          />
        </>
      )}
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: '13px', color: 'var(--da-subtle-text, #94a3b8)', marginBottom: '8px' }}>
        {title}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--da-title, #f8fafc)' }}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: '32px' }}>
      <h3 style={{ marginBottom: '14px' }}>{title}</h3>
      {children}
    </div>
  );
}

const sectionHeaderActionsStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginBottom: '12px',
};

const collapsedMessageStyle = {
  color: 'var(--da-subtle-text, #94a3b8)',
  fontWeight: 600,
  padding: '8px 2px',
};

const pageHeaderStyle = {
  display: 'flex',
  gap: '16px',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
  marginBottom: '22px',
};

const sectionEyebrow = {
  color: 'var(--da-accent-text, #60a5fa)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  marginBottom: '12px',
};

const tabBarStyle = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap' as const,
  marginBottom: '12px',
};

const tabButtonStyle = {
  padding: '12px 16px',
  borderRadius: '14px',
  border: '1px solid rgba(148,163,184,0.16)',
  background: 'var(--da-surface-bg, rgba(15,23,42,0.62))',
  color: 'var(--da-muted-text, #cbd5e1)',
  cursor: 'pointer',
  fontWeight: 700,
  whiteSpace: 'nowrap' as const,
  transition: 'all 0.2s ease',
};

const activeTabButtonStyle = {
  background:
    'linear-gradient(135deg, rgba(37,99,235,0.95) 0%, rgba(59,130,246,0.92) 100%)',
  color: '#ffffff',
  border: '1px solid rgba(147,197,253,0.38)',
  boxShadow: '0 10px 24px rgba(37,99,235,0.25)',
};

const panelStyle = {
  background:
    'var(--da-panel-bg, linear-gradient(180deg, var(--da-field-bg, rgba(15, 23, 42, 0.82)) 0%, var(--da-surface-bg, rgba(15, 23, 42, 0.68)) 100%))',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  borderRadius: '24px',
  padding: '22px',
  boxShadow: 'var(--da-panel-shadow, 0 18px 40px rgba(2,6,23,0.26))',
  backdropFilter: 'blur(16px)',
};

const filterGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
};

const labelStyle = {
  display: 'block',
  marginBottom: '8px',
  color: 'var(--da-muted-text, #475569)',
  fontWeight: 700,
  fontSize: '13px',
};

const fieldStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: 'var(--da-field-border, 1px solid rgba(148,163,184,0.16))',
  background: 'var(--da-field-bg, rgba(15,23,42,0.7))',
  color: 'var(--da-field-text, #e5eefb)',
};

const pickerButtonStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: 'var(--da-field-border, 1px solid rgba(148,163,184,0.16))',
  background: 'var(--da-field-bg, rgba(15,23,42,0.7))',
  textAlign: 'left' as const,
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: 'var(--da-field-text, #e5eefb)',
};

const pickerMenuStyle = {
  position: 'absolute' as const,
  top: 'calc(100% + 8px)',
  left: 0,
  right: 0,
  background: 'var(--da-menu-bg, rgba(15,23,42,0.96))',
  border: 'var(--da-field-border, 1px solid rgba(148,163,184,0.16))',
  borderRadius: '16px',
  boxShadow: 'var(--da-panel-shadow, 0 10px 30px rgba(0,0,0,0.22))',
  zIndex: 20,
  overflow: 'hidden',
};

const pickerSearchWrapStyle = {
  padding: '12px',
  borderBottom: '1px solid rgba(148,163,184,0.12)',
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
  backgroundColor: 'var(--da-card-bg, rgba(15,23,42,0.68))',
  color: 'var(--da-subtle-text, #94a3b8)',
};

const pickerOptionStyle = {
  padding: '12px',
  borderRadius: '8px',
  border: '1px solid rgba(148,163,184,0.12)',
  backgroundColor: 'var(--da-option-bg, rgba(15,23,42,0.6))',
  textAlign: 'left' as const,
  cursor: 'pointer',
  fontWeight: 500,
  color: 'var(--da-field-text, #e5eefb)',
};

const pickerOptionActiveStyle = {
  border: '1px solid #2563eb',
  backgroundColor: 'var(--da-active-option-bg, rgba(37, 99, 235, 0.18))',
};

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
  marginTop: '24px',
  marginBottom: '8px',
};

const cardStyle = {
  background:
    'var(--da-panel-bg, linear-gradient(180deg, var(--da-field-bg, rgba(15, 23, 42, 0.82)) 0%, var(--da-surface-bg, rgba(15, 23, 42, 0.68)) 100%))',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  borderRadius: '22px',
  padding: '22px',
  boxShadow: 'var(--da-panel-shadow, 0 18px 40px rgba(2,6,23,0.24))',
};

const secondaryButton = {
  backgroundColor: 'var(--da-secondary-bg, rgba(15,23,42,0.78))',
  color: 'var(--da-secondary-text, #e5eefb)',
  border: 'var(--da-secondary-border, 1px solid rgba(148,163,184,0.18))',
  padding: '10px 14px',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 700,
};

const errorBanner = {
  marginTop: '16px',
  padding: '12px 14px',
  borderRadius: '10px',
  backgroundColor: 'rgba(127,29,29,0.24)',
  border: '1px solid rgba(248,113,113,0.22)',
  color: 'var(--da-error-text, #fecaca)',
};

const primaryCellTextStyle = {
  color: 'var(--da-title, #f8fafc)',
  fontSize: '14px',
  fontWeight: 600,
  lineHeight: 1.4,
};

const secondaryCellTextStyle = {
  marginTop: '4px',
  color: 'var(--da-subtle-text, #64748b)',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: 1.4,
};

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  color: '#ffffff',
};

const miniSecondaryButton = {
  padding: '8px 10px',
  background: 'var(--da-secondary-bg, rgba(15,23,42,0.78))',
  color: 'var(--da-secondary-text, #e5eefb)',
  border: 'var(--da-secondary-border, 1px solid rgba(148,163,184,0.18))',
  borderRadius: '10px',
  cursor: 'pointer',
  fontWeight: 700,
  fontSize: '12px',
};

const detailInfoGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
  marginBottom: '18px',
};

const detailInfoCardStyle = {
  borderRadius: '14px',
  border: '1px solid rgba(148,163,184,0.14)',
  background: 'var(--da-surface-bg, rgba(15,23,42,0.6))',
  padding: '14px 16px',
};

const detailLabelStyle = {
  color: 'var(--da-subtle-text, #94a3b8)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  marginBottom: '8px',
};

const detailValueStyle = {
  color: 'var(--da-title, #f8fafc)',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1.5,
};

const detailRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'center',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'var(--da-surface-bg, rgba(15,23,42,0.52))',
};

const metricNoteCardStyle = {
  marginTop: '10px',
  borderRadius: '12px',
  border: '1px solid rgba(148,163,184,0.12)',
  background: 'var(--da-surface-bg, rgba(15,23,42,0.52))',
  padding: '10px 12px',
};

const metricNoteLabelStyle = {
  color: 'var(--da-accent-text, #93c5fd)',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  marginBottom: '6px',
};

const metricNoteTextStyle = {
  color: 'var(--da-page-text, #e5eefb)',
  fontSize: '13px',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap' as const,
};

const recordsTableWrapStyle = {
  marginTop: '16px',
  overflowX: 'auto' as const,
  borderRadius: '18px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background:
    'var(--da-panel-bg, linear-gradient(180deg, var(--da-field-bg, rgba(15, 23, 42, 0.82)) 0%, var(--da-surface-bg, rgba(15, 23, 42, 0.68)) 100%))',
  boxShadow: 'var(--da-panel-shadow, 0 8px 24px rgba(2,6,23,0.2))',
};

const recordsTableStyle = {
  minWidth: '1080px',
};

const recordsRowStyle = {
  display: 'grid',
  gridTemplateColumns: '240px 150px 150px 170px minmax(280px, 1.4fr)',
  gap: '14px',
  alignItems: 'center',
  padding: '14px 16px',
  borderBottom: '1px solid rgba(148,163,184,0.1)',
};

const recordsHeaderRowStyle = {
  position: 'sticky' as const,
  top: 0,
  zIndex: 1,
  background: 'rgba(2,6,23,0.92)',
  color: 'var(--da-accent-text, #93c5fd)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
};

const recordsCellAgentStyle = {};
const recordsCellDateFromStyle = {};
const recordsCellDateToStyle = {};
const recordsCellMetricStyle = {};
const recordsCellNotesStyle = {};

const sectionIntroTextStyle = {
  marginTop: '0',
  marginBottom: '14px',
  color: 'var(--da-subtle-text, #94a3b8)',
  lineHeight: 1.6,
};

const auditHistoryStatsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '12px',
  marginBottom: '14px',
};

const auditHistoryStatCardStyle = {
  borderRadius: '16px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-surface-bg, rgba(15,23,42,0.62))',
  padding: '14px 16px',
};

const auditHistoryListWrapStyle = {
  display: 'grid',
  gap: '14px',
  maxHeight: '900px',
  overflowY: 'auto' as const,
  paddingRight: '6px',
};

const auditHistoryCardStyle = {
  borderRadius: '22px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background:
    'var(--da-panel-bg, linear-gradient(180deg, var(--da-field-bg, rgba(15, 23, 42, 0.82)) 0%, var(--da-surface-bg, rgba(15, 23, 42, 0.68)) 100%))',
  boxShadow: 'var(--da-panel-shadow, 0 18px 40px rgba(2,6,23,0.24))',
  padding: '18px',
  display: 'grid',
  gap: '12px',
};

const auditHistoryCardActiveStyle = {
  outline: '2px solid rgba(96,165,250,0.45)',
  outlineOffset: '0',
};

const auditHistoryTopRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
};

const auditHistoryScoreStyle = {
  color: 'var(--da-title, #f8fafc)',
  fontSize: '22px',
  fontWeight: 900,
};

const auditHistoryMetaGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '12px',
};

const auditHistoryMetaCardStyle = {
  borderRadius: '14px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-surface-bg, rgba(15,23,42,0.62))',
  padding: '12px 14px',
};

const auditHistoryCommentStyle = {
  borderRadius: '14px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-surface-bg, rgba(15,23,42,0.62))',
  padding: '14px 16px',
  color: 'var(--da-page-text, #e5eefb)',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap' as const,
};

const auditHistoryExpandedWrapStyle = {
  display: 'grid',
  gap: '10px',
  marginTop: '4px',
};

const supervisorInboxGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
  gap: '16px',
};

const supervisorInboxCardStyle = {
  borderRadius: '22px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background:
    'var(--da-panel-bg, linear-gradient(180deg, var(--da-field-bg, rgba(15, 23, 42, 0.82)) 0%, var(--da-surface-bg, rgba(15, 23, 42, 0.68)) 100%))',
  boxShadow: 'var(--da-panel-shadow, 0 18px 40px rgba(2,6,23,0.24))',
  padding: '18px',
  display: 'grid',
  gap: '12px',
};

const supervisorInboxTopRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
};

export default SupervisorPortal;
