import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import MonitoringWidget from './MonitoringWidget';
import MonitoringDrawer from './MonitoringDrawer';
import SupervisorRequestsSupabase from './SupervisorRequestsSupabase';
import RecognitionWall from './RecognitionWall';
import DigitalTrophyCabinet from './DigitalTrophyCabinet';
import SupervisorTeamDashboard from './SupervisorTeamDashboard';

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

type SupervisorPortalTab = 'overview' | 'team-dashboard' | 'requests';

type SupervisorPortalProps = {
  currentUser: UserProfile;
  initialTab?: SupervisorPortalTab;
  hideInternalTabs?: boolean;
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

const MONITORING_VIEW_OFFSET = 224;
const MONITORING_VIEW_GAP = 16;

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



function useThemeRefresh() {
  const [themeRefreshKey, setThemeRefreshKey] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const refreshTheme = () => setThemeRefreshKey((value) => value + 1);
    const observer = new MutationObserver(refreshTheme);
    const observerConfig = {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-mode'],
    };

    observer.observe(document.documentElement, observerConfig);

    if (document.body) {
      observer.observe(document.body, observerConfig);
    }

    window.addEventListener('storage', refreshTheme);
    window.addEventListener('detroit-axle-theme-change', refreshTheme as EventListener);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', refreshTheme);
      window.removeEventListener(
        'detroit-axle-theme-change',
        refreshTheme as EventListener
      );
    };
  }, []);

  return themeRefreshKey;
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
    '--da-page-text': isLight ? '#1f2937' : '#e5eefb',
    '--da-title': isLight ? '#081225' : '#f8fafc',
    '--da-muted-text': isLight ? '#334155' : '#cbd5e1',
    '--da-subtle-text': isLight ? '#64748b' : '#94a3b8',
    '--da-accent-text': isLight ? '#2563eb' : '#60a5fa',
    '--da-panel-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(243,247,255,0.96) 100%)'
      : 'linear-gradient(180deg, rgba(15,23,42,0.86) 0%, rgba(15,23,42,0.72) 100%)',
    '--da-panel-border': isLight ? '1px solid rgba(203,213,225,0.94)' : '1px solid rgba(148,163,184,0.16)',
    '--da-panel-shadow': isLight ? '0 16px 36px rgba(15,23,42,0.08)' : '0 18px 40px rgba(2,6,23,0.35)',
    '--da-surface-bg': isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.62)',
    '--da-card-bg': isLight ? 'rgba(255,255,255,0.99)' : 'rgba(15,23,42,0.56)',
    '--da-field-bg': isLight ? 'linear-gradient(180deg, rgba(255,255,255,0.995) 0%, rgba(250,252,255,0.99) 100%)' : 'rgba(15,23,42,0.78)',
    '--da-field-border': isLight ? '1px solid rgba(203,213,225,0.94)' : '1px solid rgba(148,163,184,0.18)',
    '--da-field-text': isLight ? '#0f172a' : '#e5eefb',
    '--da-menu-bg': isLight ? 'rgba(255,255,255,0.995)' : 'rgba(15,23,42,0.97)',
    '--da-option-bg': isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.60)',
    '--da-active-option-bg': isLight ? 'rgba(37,99,235,0.10)' : 'rgba(37,99,235,0.18)',
    '--da-secondary-bg': isLight ? 'rgba(255,255,255,0.99)' : 'rgba(15,23,42,0.82)',
    '--da-secondary-text': isLight ? '#334155' : '#e5eefb',
    '--da-secondary-border': isLight ? '1px solid rgba(203,213,225,0.94)' : '1px solid rgba(148,163,184,0.18)',
    '--da-error-text': isLight ? '#b91c1c' : '#fecaca',
    '--sd-critical-bg': isLight ? 'rgba(239,68,68,0.14)' : 'rgba(220,38,38,0.16)',
    '--sd-critical-text': isLight ? '#b91c1c' : '#fecaca',
    '--sd-warning-bg': isLight ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.16)',
    '--sd-warning-text': isLight ? '#b45309' : '#fde68a',
    '--sd-watch-bg': isLight ? 'rgba(59,130,246,0.14)' : 'rgba(59,130,246,0.14)',
    '--sd-watch-text': isLight ? '#1d4ed8' : '#bfdbfe',
    '--sd-good-bg': isLight ? 'rgba(34,197,94,0.12)' : 'rgba(22,163,74,0.12)',
    '--sd-good-text': isLight ? '#166534' : '#bbf7d0',
  };
}


function SupervisorPortal({ currentUser, initialTab = 'overview', hideInternalTabs = false }: SupervisorPortalProps) {
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
  const [activeTab, setActiveTab] = useState<SupervisorPortalTab>(initialTab);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [recordDateFrom, setRecordDateFrom] = useState('');
  const [recordDateTo, setRecordDateTo] = useState('');

  const [feedbackItems, setFeedbackItems] = useState<AgentFeedback[]>([]);
  const [reviewStageDrafts, setReviewStageDrafts] = useState<Record<string, ReviewStage>>({});
  const [supervisorReviewDrafts, setSupervisorReviewDrafts] = useState<Record<string, string>>({});
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

  const agentPickerRef = useRef<HTMLDivElement | null>(null);
  const pageRootRef = useRef<HTMLDivElement | null>(null);
  const themeRefreshKey = useThemeRefresh();
  const themeVars = useMemo(() => getSupervisorThemeVars(), [themeRefreshKey]);
  const [auditsVisible, setAuditsVisible] = useState(true);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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
    if (selectedAgent) {
      setMonitoringAgentFilter(selectedAgent.agent_id || '');
    } else {
      setMonitoringAgentFilter('');
    }

    if (typeof window !== 'undefined') {
      const isCompact = window.innerWidth < 900;
      const resolvedOffset = isCompact ? 0 : MONITORING_VIEW_OFFSET;
      const top = pageRootRef.current
        ? Math.max(
            0,
            window.scrollY +
              pageRootRef.current.getBoundingClientRect().top -
              (resolvedOffset + MONITORING_VIEW_GAP)
          )
        : 0;

      window.scrollTo({ top, behavior: 'smooth' });
    }

    setMonitoringOpen(true);
  }

  const selectedAgentFeedbackItems = useMemo(() => {
    return feedbackItems.filter((item) => {
      if (!selectedAgent) return true;
      return (
        ((normalizeAgentId(item.agent_id) &&
          normalizeAgentId(item.agent_id) === normalizeAgentId(selectedAgent.agent_id)) ||
          normalizeAgentName(item.agent_name) === normalizeAgentName(selectedAgent.agent_name)) &&
        item.team === selectedAgent.team
      );
    });
  }, [feedbackItems, selectedAgent]);

  const teamOpenFeedbackItems = useMemo(
    () => feedbackItems.filter((item) => item.status !== 'Closed'),
    [feedbackItems]
  );

  const scopedOpenFeedbackItems = useMemo(
    () => selectedAgentFeedbackItems.filter((item) => item.status !== 'Closed'),
    [selectedAgentFeedbackItems]
  );

  const coachingFallbackToTeam =
    Boolean(selectedAgent) &&
    scopedOpenFeedbackItems.length === 0 &&
    teamOpenFeedbackItems.length > 0;

  const supervisorInboxItems = useMemo(() => {
    const sourceItems =
      coachingFallbackToTeam || !selectedAgent
        ? teamOpenFeedbackItems
        : scopedOpenFeedbackItems;

    return [...sourceItems].sort((a, b) => {
      const aParsed = parseCoachingPlan(a.action_plan);
      const bParsed = parseCoachingPlan(b.action_plan);
      const aNeedsReview = aParsed.reviewStage === 'Agent Responded' ? 1 : 0;
      const bNeedsReview = bParsed.reviewStage === 'Agent Responded' ? 1 : 0;
      if (aNeedsReview !== bNeedsReview) return bNeedsReview - aNeedsReview;

      const aAwaitingComment = aParsed.agentComment.trim() ? 0 : 1;
      const bAwaitingComment = bParsed.agentComment.trim() ? 0 : 1;
      if (aAwaitingComment !== bAwaitingComment) return bAwaitingComment - aAwaitingComment;

      return String(b.created_at).localeCompare(String(a.created_at));
    });
  }, [coachingFallbackToTeam, selectedAgent, scopedOpenFeedbackItems, teamOpenFeedbackItems]);

  const awaitingSupervisorCount = supervisorInboxItems.filter((item) => {
    const parsed = parseCoachingPlan(item.action_plan);
    return parsed.reviewStage === 'Agent Responded' || (!!parsed.agentComment.trim() && !parsed.supervisorReview.trim());
  }).length;

  const visibleCoachingCount = supervisorInboxItems.length;
  const awaitingAgentReplyCount = supervisorInboxItems.filter((item) => {
    const parsed = parseCoachingPlan(item.action_plan);
    return !parsed.agentComment.trim();
  }).length;

  async function handleSaveSupervisorReview(item: AgentFeedback) {
    setErrorMessage('');

    const parsed = parseCoachingPlan(item.action_plan);
    const nextReview = String(
      supervisorReviewDrafts[item.id] ?? parsed.supervisorReview
    ).trim();

    const nextStage: ReviewStage = nextReview
      ? 'Supervisor Reviewed'
      : reviewStageDrafts[item.id] || parsed.reviewStage;

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

    const { data, error } = await supabase
      .from('agent_feedback')
      .update({ action_plan: nextActionPlan || null })
      .eq('id', item.id)
      .select('*')
      .single();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setFeedbackItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id ? (data as AgentFeedback) : entry
      )
    );

    setSupervisorReviewDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });

    setReviewStageDrafts((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });

    void loadTeamData(true);
  }

  if (loading) {

    return <div style={{ color: 'var(--da-muted-text, #cbd5e1)' }}>Loading supervisor portal...</div>;
  }

  return (
    <div
      ref={pageRootRef}
      data-no-theme-invert="true"
      style={{
        color: 'var(--da-page-text, #e5eefb)',
        scrollMarginTop: `${MONITORING_VIEW_OFFSET + MONITORING_VIEW_GAP}px`,
        ...(themeVars as any),
      }}
    >
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

      {!hideInternalTabs ? (
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
          onClick={() => setActiveTab('team-dashboard')}
          style={{
            ...tabButtonStyle,
            ...(activeTab === 'team-dashboard' ? activeTabButtonStyle : {}),
          }}
        >
          Team Dashboard
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
      ) : null}

      {activeTab === 'requests' ? (
        <div style={{ marginTop: '24px' }}>
          <SupervisorRequestsSupabase currentUser={currentUser} />
        </div>
      ) : activeTab === 'team-dashboard' ? (
        <div style={{ marginTop: '24px' }}>
          <SupervisorTeamDashboard
            currentTeam={currentUser.team as TeamName}
            agents={teamAgents}
            audits={audits}
            feedbackItems={feedbackItems}
            monitoringItems={monitoringItems}
            records={records}
            selectedAgent={selectedAgent}
          />
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
              Supervisors can review the full coaching cycle here. The queue stays compact, and each row opens into the full coaching view with agent reply, action plan, justification, and supervisor review controls.
            </p>

            <div style={coachingMetricsGridStyle}>
              <div style={coachingMetricCardStyle}>
                <div style={detailLabelStyle}>Visible Coaching</div>
                <div style={detailValueStyle}>{String(visibleCoachingCount)}</div>
              </div>
              <div style={coachingMetricCardStyle}>
                <div style={detailLabelStyle}>Awaiting Agent Reply</div>
                <div style={detailValueStyle}>{String(awaitingAgentReplyCount)}</div>
              </div>
              <div style={coachingMetricCardStyle}>
                <div style={detailLabelStyle}>Awaiting Supervisor</div>
                <div style={detailValueStyle}>{String(awaitingSupervisorCount)}</div>
              </div>
            </div>

            {coachingFallbackToTeam ? (
              <div style={coachingFallbackNoticeStyle}>
                No open coaching items were found for the currently selected agent, so the team-wide coaching queue is shown instead.
              </div>
            ) : null}

            {supervisorInboxItems.length === 0 ? (
              <p>No coaching items found for this team filter.</p>
            ) : (
              <div style={supervisorFeedbackTableWrapStyle}>
                <div style={supervisorFeedbackTableStyle}>
                  <div style={{ ...supervisorFeedbackRowStyle, ...supervisorFeedbackHeaderRowStyle }}>
                    <div style={supervisorFeedbackCellTypeStyle}>Type</div>
                    <div style={supervisorFeedbackCellSubjectStyle}>Subject</div>
                    <div style={supervisorFeedbackCellDueDateStyle}>Due Date</div>
                    <div style={supervisorFeedbackCellStageStyle}>Stage</div>
                    <div style={supervisorFeedbackCellAckStyle}>Acknowledged</div>
                    <div style={supervisorFeedbackCellActionsStyle}>Actions</div>
                  </div>

                  {supervisorInboxItems.map((item) => {
                    const parsedPlan = parseCoachingPlan(item.action_plan);
                    const isExpanded = expandedFeedbackId === item.id;
                    const stageColor =
                      parsedPlan.reviewStage === 'Closed'
                        ? '#166534'
                        : parsedPlan.reviewStage === 'Follow-up'
                        ? '#7c3aed'
                        : parsedPlan.reviewStage === 'Supervisor Reviewed'
                        ? '#b45309'
                        : parsedPlan.reviewStage === 'Agent Responded' || parsedPlan.reviewStage === 'Acknowledged'
                        ? '#2563eb'
                        : 'var(--da-subtle-text, #64748b)';

                    return (
                      <div key={`inbox-${item.id}`} style={supervisorFeedbackEntryStyle}>
                        <div style={supervisorFeedbackRowStyle}>
                          <div style={supervisorFeedbackCellTypeStyle}>
                            <span
                              style={{
                                ...pillStyle,
                                backgroundColor:
                                  item.feedback_type === 'Warning'
                                    ? '#991b1b'
                                    : item.feedback_type === 'Audit Feedback'
                                    ? '#7c3aed'
                                    : item.feedback_type === 'Follow-up'
                                    ? '#b45309'
                                    : '#166534',
                              }}
                            >
                              {item.feedback_type}
                            </span>
                          </div>

                          <div style={supervisorFeedbackCellSubjectStyle}>
                            <div style={primaryCellTextStyle}>{item.subject}</div>
                            <div style={secondaryCellTextStyle}>
                              {getAgentLabel(item.agent_id, item.agent_name)} • {parsedPlan.priority}
                            </div>
                          </div>

                          <div style={supervisorFeedbackCellDueDateStyle}>
                            <div style={primaryCellTextStyle}>{formatDateOnly(item.due_date)}</div>
                            <div style={secondaryCellTextStyle}>{item.status}</div>
                          </div>

                          <div style={supervisorFeedbackCellStageStyle}>
                            <span style={{ ...pillStyle, backgroundColor: stageColor }}>
                              {parsedPlan.reviewStage}
                            </span>
                          </div>

                          <div style={supervisorFeedbackCellAckStyle}>
                            <span
                              style={{
                                ...feedbackAcknowledgedPillStyle,
                                minWidth: '0',
                                padding: '8px 12px',
                                color: item.acknowledged_by_agent ? '#166534' : '#92400e',
                                background: item.acknowledged_by_agent ? 'rgba(22,101,52,0.14)' : 'rgba(180,83,9,0.14)',
                                border: item.acknowledged_by_agent
                                  ? '1px solid rgba(74,222,128,0.24)'
                                  : '1px solid rgba(245,158,11,0.24)',
                              }}
                            >
                              {item.acknowledged_by_agent ? 'Acknowledged' : 'Not yet'}
                            </span>
                          </div>

                          <div style={supervisorFeedbackCellActionsStyle}>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedFeedbackId(
                                  expandedFeedbackId === item.id ? null : item.id
                                )
                              }
                              style={miniSecondaryButton}
                            >
                              {isExpanded ? 'Hide' : 'Details'}
                            </button>
                          </div>
                        </div>

                        {isExpanded ? (
                          <div style={auditExpandedRowStyle}>
                            <div style={expandedPanelStyle}>
                              <div style={detailInfoGridStyle}>
                                <div style={detailInfoCardStyle}>
                                  <div style={detailLabelStyle}>Type</div>
                                  <div style={detailValueStyle}>{item.feedback_type}</div>
                                </div>

                                <div style={detailInfoCardStyle}>
                                  <div style={detailLabelStyle}>From QA</div>
                                  <div style={detailValueStyle}>{item.qa_name || '-'}</div>
                                </div>

                                <div style={detailInfoCardStyle}>
                                  <div style={detailLabelStyle}>Due Date</div>
                                  <div style={detailValueStyle}>{formatDateOnly(item.due_date)}</div>
                                </div>

                                <div style={detailInfoCardStyle}>
                                  <div style={detailLabelStyle}>Created At</div>
                                  <div style={detailValueStyle}>{formatDate(item.created_at)}</div>
                                </div>

                                <div style={detailInfoCardStyle}>
                                  <div style={detailLabelStyle}>Priority</div>
                                  <div style={detailValueStyle}>{parsedPlan.priority}</div>
                                </div>

                                <div style={detailInfoCardStyle}>
                                  <div style={detailLabelStyle}>Acknowledged</div>
                                  <div style={detailValueStyle}>{item.acknowledged_by_agent ? 'Yes' : 'Not yet'}</div>
                                </div>
                              </div>

                              <div style={fullCommentCardStyle}>
                                <div style={detailLabelStyle}>Subject</div>
                                <div style={fullCommentTextStyle}>{item.subject}</div>
                              </div>

                              <div style={fullCommentCardStyle}>
                                <div style={detailLabelStyle}>Coaching Summary</div>
                                <div style={fullCommentTextStyle}>{item.feedback_note || '-'}</div>
                              </div>

                              <div style={fullCommentCardStyle}>
                                <div style={detailLabelStyle}>Action Plan</div>
                                <div style={fullCommentTextStyle}>{parsedPlan.actionPlan || '-'}</div>
                              </div>

                              <div style={fullCommentCardStyle}>
                                <div style={detailLabelStyle}>Justification</div>
                                <div style={fullCommentTextStyle}>{parsedPlan.justification || '-'}</div>
                              </div>

                              <div style={fullCommentCardStyle}>
                                <div style={detailLabelStyle}>Agent Comment</div>
                                <div style={fullCommentTextStyle}>{parsedPlan.agentComment || 'No agent reply yet.'}</div>
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
                                  <div style={detailLabelStyle}>Outcome</div>
                                  <div style={detailValueStyle}>{parsedPlan.followUpOutcome}</div>
                                </div>

                                <div style={detailInfoCardStyle}>
                                  <div style={detailLabelStyle}>Resolution Note</div>
                                  <div style={detailValueStyle}>{parsedPlan.resolutionNote || '-'}</div>
                                </div>

                                <div style={detailInfoCardStyle}>
                                  <div style={detailLabelStyle}>Status</div>
                                  <div style={detailValueStyle}>{item.status}</div>
                                </div>
                              </div>

                              <div style={fullCommentCardStyle}>
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

                              <div style={sectionHeaderActionsStyle}>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveSupervisorReview(item)}
                                  style={miniSecondaryButton}
                                >
                                  Save Supervisor Review
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
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
                    const auditCommentPreview =
                      audit.comments?.trim() && audit.comments.trim().length > 180
                        ? `${audit.comments.trim().slice(0, 180)}…`
                        : audit.comments?.trim() || 'No audit comment saved for this item.';

                    return (
                      <div
                        key={audit.id}
                        style={{
                          ...auditHistoryCardStyle,
                          ...(isExpanded ? auditHistoryCardActiveStyle : {}),
                        }}
                      >
                        <div style={auditCompactTopRowStyle}>
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
                                backgroundColor: audit.shared_with_agent ? '#166534' : 'var(--da-subtle-text, #64748b)',
                                marginTop: '8px',
                              }}
                            >
                              {audit.shared_with_agent ? 'Released' : 'Hidden'}
                            </span>
                          </div>
                        </div>

                        <div style={auditCompactMetaRowStyle}>
                          <div style={auditCompactMetaCardStyle}>
                            <div style={detailLabelStyle}>Reference</div>
                            <div style={detailValueStyle}>{getAuditReference(audit)}</div>
                          </div>
                          <div style={auditCompactMetaCardStyle}>
                            <div style={detailLabelStyle}>Release Date</div>
                            <div style={detailValueStyle}>{formatDate(audit.shared_at)}</div>
                          </div>
                        </div>

                        <div style={auditHistoryCommentStyle}>{auditCommentPreview}</div>

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
                            <div style={auditHistoryCommentFullStyle}>
                              {audit.comments?.trim() || 'No audit comment saved for this item.'}
                            </div>

                            <div style={{ ...sectionEyebrow, marginBottom: '8px' }}>
                              Score Details
                            </div>
                            <div style={{ display: 'grid', gap: '8px' }}>
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
            topOffset={MONITORING_VIEW_OFFSET}
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
    <section style={supervisorSectionShellStyle}>
      <div style={supervisorSectionHeaderWrapStyle}>
        <div style={supervisorSectionEyebrowStyle}>Supervisor Workspace</div>
        <h3 style={supervisorSectionTitleStyle}>{title}</h3>
      </div>
      {children}
    </section>
  );
}


const supervisorSectionShellStyle = {
  marginTop: '32px',
  borderRadius: '24px',
  padding: '18px',
  background: 'var(--da-panel-bg, linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(243,247,255,0.96) 100%))',
  border: 'var(--da-panel-border, 1px solid rgba(203,213,225,0.94))',
  boxShadow: 'var(--da-panel-shadow, 0 16px 36px rgba(15,23,42,0.08))',
};

const supervisorSectionHeaderWrapStyle = {
  marginBottom: '14px',
};

const supervisorSectionEyebrowStyle = {
  color: 'var(--da-accent-text, #2563eb)',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  marginBottom: '8px',
};

const supervisorSectionTitleStyle = {
  margin: 0,
  color: 'var(--da-title, #081225)',
  fontSize: '22px',
};

const sectionHeaderActionsStyle = {

  display: 'flex',
  justifyContent: 'flex-end',
  marginBottom: '10px',
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
  color: 'var(--da-muted-text, #334155)',
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  marginTop: '20px',
  marginBottom: '8px',
};

const cardStyle = {
  background:
    'var(--da-panel-bg, linear-gradient(180deg, var(--da-field-bg, rgba(15, 23, 42, 0.82)) 0%, var(--da-surface-bg, rgba(15, 23, 42, 0.68)) 100%))',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  borderRadius: '18px',
  padding: '18px',
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
  gap: '10px',
  marginBottom: '12px',
};

const detailInfoCardStyle = {
  borderRadius: '14px',
  border: '1px solid rgba(148,163,184,0.14)',
  background: 'var(--da-card-bg, rgba(15,23,42,0.52))',
  padding: '12px 14px',
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
  marginBottom: '12px',
  color: 'var(--da-muted-text, #334155)',
  lineHeight: 1.6,
  fontSize: '13px',
};

const auditHistoryStatsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '10px',
  marginBottom: '12px',
};

const auditHistoryStatCardStyle = {
  borderRadius: '14px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-card-bg, rgba(15,23,42,0.52))',
  padding: '12px 14px',
};

const auditHistoryListWrapStyle = {
  display: 'grid',
  gap: '10px',
  maxHeight: '420px',
  overflowY: 'auto' as const,
  paddingRight: '6px',
};

const auditHistoryCardStyle = {
  borderRadius: '18px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-card-bg, rgba(15,23,42,0.52))',
  boxShadow: 'var(--da-panel-shadow, 0 10px 24px rgba(2,6,23,0.14))',
  padding: '10px 12px',
  display: 'grid',
  gap: '8px',
};

const auditHistoryCardActiveStyle = {
  outline: '2px solid rgba(96,165,250,0.45)',
  outlineOffset: '0',
};

const auditHistoryScoreStyle = {
  color: 'var(--da-title, #f8fafc)',
  fontSize: '16px',
  fontWeight: 900,
};

const auditHistoryCommentStyle = {
  borderRadius: '12px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-surface-bg, rgba(15,23,42,0.62))',
  padding: '10px 12px',
  color: 'var(--da-page-text, #e5eefb)',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap' as const,
  fontSize: '13px',
};

const auditHistoryExpandedWrapStyle = {
  display: 'grid',
  gap: '10px',
  marginTop: '2px',
};

const coachingMetricsGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '10px',
  marginBottom: '12px',
};

const coachingMetricCardStyle = {
  borderRadius: '14px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-card-bg, rgba(15,23,42,0.52))',
  padding: '12px 14px',
};

const coachingFallbackNoticeStyle = {
  marginBottom: '12px',
  borderRadius: '12px',
  border: '1px solid rgba(245,158,11,0.24)',
  background: 'rgba(245,158,11,0.10)',
  color: 'var(--da-page-text, #e5eefb)',
  padding: '10px 12px',
  lineHeight: 1.55,
  fontSize: '13px',
};

const auditCompactTopRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
};

const auditCompactMetaRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
};

const auditCompactMetaCardStyle = {
  borderRadius: '12px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-surface-bg, rgba(15,23,42,0.62))',
  padding: '10px 12px',
};

const auditHistoryCommentFullStyle = {
  borderRadius: '12px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-card-bg, rgba(15,23,42,0.52))',
  padding: '12px 14px',
  color: 'var(--da-page-text, #e5eefb)',
  lineHeight: 1.6,
  fontSize: '13px',
  whiteSpace: 'pre-wrap' as const,
};

const feedbackAcknowledgedPillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '118px',
  padding: '10px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(74,222,128,0.24)',
  background: 'rgba(22,101,52,0.16)',
  color: '#166534',
  fontWeight: 800,
  fontSize: '13px',
};

const auditExpandedRowStyle = { padding: '0 12px 12px 12px' };

const expandedPanelStyle = {
  borderRadius: '16px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-surface-bg, rgba(15,23,42,0.62))',
  padding: '14px',
};

const fullCommentCardStyle = {
  borderRadius: '14px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-card-bg, rgba(15,23,42,0.52))',
  padding: '12px',
};

const fullCommentTextStyle = {
  color: 'var(--da-page-text, #e5eefb)',
  fontSize: '13px',
  lineHeight: 1.65,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
};

const supervisorFeedbackTableWrapStyle = {
  marginTop: '8px',
  overflowX: 'auto' as const,
  borderRadius: '16px',
  border: 'var(--da-panel-border, 1px solid rgba(148,163,184,0.14))',
  background: 'var(--da-card-bg, rgba(15,23,42,0.52))',
};

const supervisorFeedbackTableStyle = {
  minWidth: '980px',
};

const supervisorFeedbackEntryStyle = {
  borderBottom: '1px solid rgba(148,163,184,0.08)',
};

const supervisorFeedbackRowStyle = {
  display: 'grid',
  gridTemplateColumns: '120px minmax(260px, 1.7fr) 130px 160px 150px 100px',
  gap: '12px',
  alignItems: 'center',
  padding: '12px 14px',
};

const supervisorFeedbackHeaderRowStyle = {
  position: 'sticky' as const,
  top: 0,
  zIndex: 1,
  background: 'var(--da-menu-bg, rgba(15,23,42,0.96))',
  color: 'var(--da-accent-text, #93c5fd)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.12em',
};

const supervisorFeedbackCellTypeStyle = {};
const supervisorFeedbackCellSubjectStyle = {};
const supervisorFeedbackCellDueDateStyle = {};
const supervisorFeedbackCellStageStyle = {};
const supervisorFeedbackCellAckStyle = {};
const supervisorFeedbackCellActionsStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
};

export default SupervisorPortal;
