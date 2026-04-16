
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

type TeamName = 'Calls' | 'Tickets' | 'Sales';
type FeedbackType = 'Coaching' | 'Audit Feedback' | 'Warning' | 'Follow-up';
type FeedbackStatus = 'Open' | 'In Progress' | 'Closed';
type PlanTab = 'All' | 'Open' | 'Overdue' | 'Awaiting Ack' | 'Follow-up';
type PlanPriority = 'Low' | 'Medium' | 'High' | 'Critical';
type FollowUpOutcome = 'Not Set' | 'Improved' | 'Partial Improvement' | 'No Improvement' | 'Needs Escalation';
type ReviewStage = 'QA Shared' | 'Acknowledged' | 'Agent Responded' | 'Supervisor Reviewed' | 'Follow-up' | 'Closed';

type CurrentUser = {
  id?: string;
  role?: 'admin' | 'qa' | 'agent' | 'supervisor';
  agent_id?: string | null;
  agent_name?: string;
  display_name?: string | null;
  team?: TeamName | null;
  email?: string;
} | null;

type AgentFeedback = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName;
  qa_name: string;
  feedback_type: FeedbackType;
  subject: string;
  feedback_note: string;
  action_plan: string | null;
  due_date: string | null;
  status: FeedbackStatus;
  created_at: string;
  acknowledged_by_agent?: boolean | null;
};

type AgentProfile = {
  id: string;
  role: 'agent';
  agent_id: string | null;
  agent_name: string;
  display_name: string | null;
  team: TeamName | null;
};

type AuditItem = {
  id: string;
  agent_id: string;
  agent_name: string;
  team: TeamName;
  case_type: string;
  audit_date: string;
  quality_score: number;
  comments: string | null;
  shared_with_agent?: boolean | null;
};

function normalizeAgentId(value?: string | null) {
  return String(value || '').trim().replace(/\.0+$/, '');
}

function normalizeAgentName(value?: string | null) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function formatDateOnly(value?: string | null) {
  if (!value) return '-';
  const raw = String(value).slice(0, 10);
  if (!raw) return '-';
  const date = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString();
}

function getCurrentDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateValue?: string | null) {
  const raw = String(dateValue || '').slice(0, 10);
  if (!raw) return null;
  const base = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(base.getTime())) return null;
  const todayRaw = getCurrentDateValue();
  const today = new Date(`${todayRaw}T00:00:00`);
  const diffMs = base.getTime() - today.getTime();
  return Math.floor(diffMs / 86400000);
}

function getTypeColor(typeValue: FeedbackType) {
  if (typeValue === 'Warning') return '#991b1b';
  if (typeValue === 'Audit Feedback') return '#7c3aed';
  if (typeValue === 'Follow-up') return '#b45309';
  return '#166534';
}

const STRUCTURED_PLAN_SECTION_LABELS = [
  'Priority',
  'Review Stage',
  'Action Plan',
  'Justification',
  'Agent Comment',
  'Supervisor Review',
  'Follow-up Outcome',
  'Resolution Note',
] as const;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePriority(value?: string | null): PlanPriority {
  if (value === 'Low' || value === 'Medium' || value === 'High' || value === 'Critical') {
    return value;
  }
  return 'Medium';
}

function normalizeFollowUpOutcome(value?: string | null): FollowUpOutcome {
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

function normalizeReviewStage(value?: string | null): ReviewStage {
  if (
    value === 'QA Shared' ||
    value === 'Agent Responded' ||
    value === 'Supervisor Reviewed' ||
    value === 'Follow-up' ||
    value === 'Closed'
  ) {
    return value;
  }
  return 'QA Shared';
}

function parseStructuredPlan(value?: string | null) {
  const raw = String(value || '').trim();
  const labelsPattern = STRUCTURED_PLAN_SECTION_LABELS.map((label) => escapeRegex(label)).join('|');

  function readSection(label: (typeof STRUCTURED_PLAN_SECTION_LABELS)[number]) {
    const regex = new RegExp(
      `${escapeRegex(label)}:\n([\\s\\S]*?)(?=\\n(?:${labelsPattern}):\\n|$)`
    );
    const match = raw.match(regex);
    return match ? match[1].trim() : '';
  }

  const hasStructuredSections = STRUCTURED_PLAN_SECTION_LABELS.some((label) =>
    raw.includes(`${label}:`)
  );

  return {
    priority: normalizePriority(readSection('Priority')),
    reviewStage: normalizeReviewStage(readSection('Review Stage')),
    actionPlan: hasStructuredSections ? readSection('Action Plan') : raw,
    justification: readSection('Justification'),
    agentComment: readSection('Agent Comment'),
    supervisorReview: readSection('Supervisor Review'),
    followUpOutcome: normalizeFollowUpOutcome(readSection('Follow-up Outcome')),
    resolutionNote: readSection('Resolution Note'),
  };
}

function composeStructuredPlan({
  priority,
  reviewStage,
  actionPlan,
  justification,
  agentComment,
  supervisorReview,
  followUpOutcome,
  resolutionNote,
}: {
  priority: PlanPriority;
  reviewStage: ReviewStage;
  actionPlan: string;
  justification: string;
  agentComment: string;
  supervisorReview: string;
  followUpOutcome: FollowUpOutcome;
  resolutionNote: string;
}) {
  const sections = [
    `Priority:\n${priority}`,
    `Review Stage:\n${reviewStage}`,
    actionPlan.trim() ? `Action Plan:\n${actionPlan.trim()}` : '',
    justification.trim() ? `Justification:\n${justification.trim()}` : '',
    agentComment.trim() ? `Agent Comment:\n${agentComment.trim()}` : '',
    supervisorReview.trim() ? `Supervisor Review:\n${supervisorReview.trim()}` : '',
    followUpOutcome !== 'Not Set'
      ? `Follow-up Outcome:\n${followUpOutcome}`
      : '',
    resolutionNote.trim() ? `Resolution Note:\n${resolutionNote.trim()}` : '',
  ].filter(Boolean);

  return sections.join('\n\n').trim();
}

function getPriorityColor(priority: PlanPriority) {
  if (priority === 'Critical') return '#b91c1c';
  if (priority === 'High') return '#b45309';
  if (priority === 'Low') return '#166534';
  return '#1d4ed8';
}

function getOutcomeColor(outcome: FollowUpOutcome) {
  if (outcome === 'Improved') return '#166534';
  if (outcome === 'Partial Improvement') return '#b45309';
  if (outcome === 'No Improvement') return '#b91c1c';
  if (outcome === 'Needs Escalation') return '#7c2d12';
  return '#475569';
}

function getReviewStageColor(stage: ReviewStage) {
  if (stage === 'Closed') return '#166534';
  if (stage === 'Follow-up') return '#7c3aed';
  if (stage === 'Supervisor Reviewed') return '#92400e';
  if (stage === 'Agent Responded' || stage === 'Acknowledged') return '#2563eb';
  return '#475569';
}

function isFeedbackOverdue(item: Pick<AgentFeedback, 'due_date' | 'status'>) {
  const diff = daysUntil(item.due_date);
  return diff !== null && diff < 0 && item.status !== 'Closed';
}

function matchesPlanTab(item: AgentFeedback, tab: PlanTab) {
  const parsed = parseStructuredPlan(item.action_plan);
  if (tab === 'All') return true;
  if (tab === 'Open') return item.status !== 'Closed';
  if (tab === 'Overdue') return isFeedbackOverdue(item);
  if (tab === 'Awaiting Ack') return item.status !== 'Closed' && !item.acknowledged_by_agent;
  if (tab === 'Follow-up') {
    return (
      item.status !== 'Closed' &&
      (item.feedback_type === 'Follow-up' || parsed.reviewStage === 'Follow-up')
    );
  }
  return true;
}

function getDashboardThemeVars(): Record<string, string> {
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
    '--cc-page-text': isLight ? '#334155' : '#e5eefb',
    '--cc-title': isLight ? '#0f172a' : '#f8fafc',
    '--cc-subtitle': isLight ? '#64748b' : '#94a3b8',
    '--cc-muted': isLight ? '#475569' : '#cbd5e1',
    '--cc-subtle': isLight ? '#64748b' : '#94a3b8',
    '--cc-eyebrow': isLight ? '#3b82f6' : '#93c5fd',
    '--cc-panel-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,250,255,0.96) 100%)'
      : 'linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(15,23,42,0.68) 100%)',
    '--cc-panel-border': isLight
      ? '1px solid rgba(203,213,225,0.92)'
      : '1px solid rgba(148,163,184,0.14)',
    '--cc-panel-shadow': isLight
      ? '0 18px 40px rgba(15,23,42,0.10)'
      : '0 18px 40px rgba(2,6,23,0.35)',
    '--cc-card-bg': isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.52)',
    '--cc-soft-bg': isLight ? 'rgba(248,250,252,0.98)' : 'rgba(15,23,42,0.62)',
    '--cc-row-border': isLight
      ? '1px solid rgba(203,213,225,0.92)'
      : '1px solid rgba(148,163,184,0.16)',
    '--cc-field-bg': isLight
      ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,255,0.98) 100%)'
      : 'rgba(15,23,42,0.74)',
    '--cc-field-border': isLight
      ? '1px solid rgba(203,213,225,0.92)'
      : '1px solid rgba(148,163,184,0.18)',
    '--cc-field-text': isLight ? '#334155' : '#e5eefb',
    '--cc-button-bg': isLight ? 'rgba(255,255,255,0.98)' : 'rgba(15,23,42,0.74)',
    '--cc-button-text': isLight ? '#475569' : '#e5eefb',
    '--cc-button-border': isLight
      ? '1px solid rgba(203,213,225,0.92)'
      : '1px solid rgba(148,163,184,0.18)',
    '--cc-error-bg': isLight ? 'rgba(254,242,242,0.98)' : 'rgba(127,29,29,0.24)',
    '--cc-error-text': isLight ? '#b91c1c' : '#fecaca',
    '--cc-success-bg': isLight ? 'rgba(240,253,244,0.98)' : 'rgba(20,83,45,0.24)',
    '--cc-success-text': isLight ? '#166534' : '#bbf7d0',
    '--cc-accent-bg': isLight ? 'rgba(37,99,235,0.10)' : 'rgba(37,99,235,0.14)',
    '--cc-accent-text': isLight ? '#2563eb' : '#93c5fd',
  };
}

function CoachingCenter({ currentUser = null }: { currentUser?: CurrentUser }) {
  const [feedbackItems, setFeedbackItems] = useState<AgentFeedback[]>([]);
  const [profiles, setProfiles] = useState<AgentProfile[]>([]);
  const [audits, setAudits] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [savedAgentFilter, setSavedAgentFilter] = useState('');
  const [savedStatusFilter, setSavedStatusFilter] = useState<'All' | FeedbackStatus>('All');
  const [savedTypeFilter, setSavedTypeFilter] = useState<'All' | FeedbackType>('All');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

  const [selectedAgentProfileId, setSelectedAgentProfileId] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
  const [qaName, setQaName] = useState(currentUser?.agent_name || '');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('Coaching');
  const [subject, setSubject] = useState('');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [justification, setJustification] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [statusOnCreate, setStatusOnCreate] = useState<FeedbackStatus>('Open');
  const [priorityOnCreate, setPriorityOnCreate] = useState<PlanPriority>('Medium');
  const [activePlanTab, setActivePlanTab] = useState<PlanTab>('All');
  const [planOutcomeDrafts, setPlanOutcomeDrafts] = useState<Record<string, FollowUpOutcome>>({});
  const [resolutionNoteDrafts, setResolutionNoteDrafts] = useState<Record<string, string>>({});
  const [reviewStageDrafts, setReviewStageDrafts] = useState<Record<string, ReviewStage>>({});
  const [agentCommentDrafts, setAgentCommentDrafts] = useState<Record<string, string>>({});
  const [supervisorReviewDrafts, setSupervisorReviewDrafts] = useState<Record<string, string>>({});
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [selectedAuditId, setSelectedAuditId] = useState('');

  const agentPickerRef = useRef<HTMLDivElement | null>(null);
  const themeVars = getDashboardThemeVars();

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (agentPickerRef.current && !agentPickerRef.current.contains(event.target as Node)) {
        setIsAgentPickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  async function loadAll() {
    setLoading(true);
    setErrorMessage('');

    const [feedbackResult, profilesResult, auditsResult] = await Promise.all([
      supabase.from('agent_feedback').select('*').order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, role, agent_id, agent_name, display_name, team')
        .eq('role', 'agent')
        .order('agent_name', { ascending: true }),
      supabase
        .from('audits')
        .select('id, agent_id, agent_name, team, case_type, audit_date, quality_score, comments, shared_with_agent')
        .order('audit_date', { ascending: false }),
    ]);

    setLoading(false);

    if (feedbackResult.error || profilesResult.error || auditsResult.error) {
      setErrorMessage(
        feedbackResult.error?.message ||
          profilesResult.error?.message ||
          auditsResult.error?.message ||
          'Could not load coaching center data.'
      );
      return;
    }

    setFeedbackItems((feedbackResult.data as AgentFeedback[]) || []);
    setProfiles((profilesResult.data as AgentProfile[]) || []);
    setAudits((auditsResult.data as AuditItem[]) || []);
  }

  const visibleAgents = useMemo(() => {
    const search = agentSearch.trim().toLowerCase();
    if (!search) return profiles;

    return profiles.filter((profile) => {
      const label = getAgentLabel(profile);
      return (
        profile.agent_name.toLowerCase().includes(search) ||
        (profile.agent_id || '').toLowerCase().includes(search) ||
        (profile.display_name || '').toLowerCase().includes(search) ||
        label.toLowerCase().includes(search)
      );
    });
  }, [profiles, agentSearch]);

  const selectedAgent =
    profiles.find((profile) => profile.id === selectedAgentProfileId) || null;

  function getAgentLabel(profile: AgentProfile) {
    return profile.display_name
      ? `${profile.agent_name} - ${profile.display_name}`
      : `${profile.agent_name} - ${profile.agent_id || '-'}`;
  }

  function getFeedbackDisplayName(item: AgentFeedback) {
    const matchedProfile = profiles.find(
      (profile) =>
        normalizeAgentId(profile.agent_id) === normalizeAgentId(item.agent_id) &&
        normalizeAgentName(profile.agent_name) === normalizeAgentName(item.agent_name) &&
        profile.team === item.team
    );

    return matchedProfile?.display_name || '-';
  }

  function getFeedbackAgentKey(item: AgentFeedback) {
    return `${normalizeAgentId(item.agent_id)}||${normalizeAgentName(item.agent_name)}||${item.team}`;
  }

  const savedAgentOptions = useMemo(() => {
    const seen = new Set<string>();
    return feedbackItems
      .filter((item) => {
        const key = getFeedbackAgentKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((item) => ({
        key: getFeedbackAgentKey(item),
        label: `${item.agent_name} - ${getFeedbackDisplayName(item)} • ${item.agent_id} • ${item.team}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [feedbackItems, profiles]);

  const baseFilteredFeedbackItems = useMemo(() => {
    return feedbackItems.filter((item) => {
      const matchesAgent =
        !savedAgentFilter || getFeedbackAgentKey(item) === savedAgentFilter;
      const matchesStatus =
        savedStatusFilter === 'All' || item.status === savedStatusFilter;
      const matchesType =
        savedTypeFilter === 'All' || item.feedback_type === savedTypeFilter;

      return matchesAgent && matchesStatus && matchesType;
    });
  }, [feedbackItems, savedAgentFilter, savedStatusFilter, savedTypeFilter]);

  const filteredFeedbackItems = useMemo(() => {
    const priorityRank: Record<PlanPriority, number> = {
      Critical: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    };

    return [...baseFilteredFeedbackItems]
      .filter((item) => matchesPlanTab(item, activePlanTab))
      .sort((a, b) => {
        const aOverdue = isFeedbackOverdue(a) ? 1 : 0;
        const bOverdue = isFeedbackOverdue(b) ? 1 : 0;
        if (aOverdue !== bOverdue) return bOverdue - aOverdue;

        const aAck = a.status !== 'Closed' && !a.acknowledged_by_agent ? 1 : 0;
        const bAck = b.status !== 'Closed' && !b.acknowledged_by_agent ? 1 : 0;
        if (aAck !== bAck) return bAck - aAck;

        const aPriority = parseStructuredPlan(a.action_plan).priority;
        const bPriority = parseStructuredPlan(b.action_plan).priority;
        if (priorityRank[aPriority] !== priorityRank[bPriority]) {
          return priorityRank[aPriority] - priorityRank[bPriority];
        }

        const aDue = String(a.due_date || '9999-12-31');
        const bDue = String(b.due_date || '9999-12-31');
        if (aDue !== bDue) return aDue.localeCompare(bDue);

        return String(b.created_at).localeCompare(String(a.created_at));
      });
  }, [baseFilteredFeedbackItems, activePlanTab]);

  const planTabCounts = useMemo(() => {
    return {
      All: baseFilteredFeedbackItems.length,
      Open: baseFilteredFeedbackItems.filter((item) => matchesPlanTab(item, 'Open')).length,
      Overdue: baseFilteredFeedbackItems.filter((item) => matchesPlanTab(item, 'Overdue')).length,
      'Awaiting Ack': baseFilteredFeedbackItems.filter((item) => matchesPlanTab(item, 'Awaiting Ack')).length,
      'Follow-up': baseFilteredFeedbackItems.filter((item) => matchesPlanTab(item, 'Follow-up')).length,
    } as Record<PlanTab, number>;
  }, [baseFilteredFeedbackItems]);

  const reviewStageCounts = useMemo(() => {
    const counts: Record<ReviewStage, number> = {
      'QA Shared': 0,
      'Acknowledged': 0,
      'Agent Responded': 0,
      'Supervisor Reviewed': 0,
      'Follow-up': 0,
      'Closed': 0,
    };

    feedbackItems.forEach((item) => {
      const stage = parseStructuredPlan(item.action_plan).reviewStage;
      counts[stage] += 1;
    });

    return counts;
  }, [feedbackItems]);

  const selectedAgentAudits = useMemo(() => {
    if (!selectedAgent) return [];
    return audits
      .filter(
        (item) =>
          normalizeAgentId(item.agent_id) === normalizeAgentId(selectedAgent.agent_id) &&
          normalizeAgentName(item.agent_name) === normalizeAgentName(selectedAgent.agent_name) &&
          item.team === selectedAgent.team
      )
      .sort((a, b) => (a.audit_date < b.audit_date ? 1 : -1));
  }, [audits, selectedAgent]);

  const latestAudit = selectedAgentAudits[0] || null;
  const selectedAgentAverage =
    selectedAgentAudits.length > 0
      ? selectedAgentAudits.reduce((sum, item) => sum + Number(item.quality_score), 0) /
        selectedAgentAudits.length
      : 0;

  const filteredSelectedAgentAudits = useMemo(() => {
    return selectedAgentAudits.filter((item) => {
      const auditDate = String(item.audit_date || '').slice(0, 10);
      if (auditDateFrom && auditDate < auditDateFrom) return false;
      if (auditDateTo && auditDate > auditDateTo) return false;
      return true;
    });
  }, [selectedAgentAudits, auditDateFrom, auditDateTo]);

  const selectedAudit =
    filteredSelectedAgentAudits.find((item) => item.id === selectedAuditId) ||
    filteredSelectedAgentAudits[0] ||
    latestAudit ||
    null;

  const selectedAgentOpenItems = useMemo(() => {
    if (!selectedAgent) return [];
    return feedbackItems.filter(
      (item) =>
        normalizeAgentId(item.agent_id) === normalizeAgentId(selectedAgent.agent_id) &&
        normalizeAgentName(item.agent_name) === normalizeAgentName(selectedAgent.agent_name) &&
        item.team === selectedAgent.team &&
        item.status !== 'Closed'
    );
  }, [feedbackItems, selectedAgent]);

  const overdueCount = useMemo(
    () => feedbackItems.filter((item) => isFeedbackOverdue(item)).length,
    [feedbackItems]
  );

  const highPriorityCount = useMemo(
    () =>
      feedbackItems.filter((item) => {
        const priority = parseStructuredPlan(item.action_plan).priority;
        return item.status !== 'Closed' && (priority === 'High' || priority === 'Critical');
      }).length,
    [feedbackItems]
  );

  const unacknowledgedCount = useMemo(
    () =>
      feedbackItems.filter(
        (item) => item.status !== 'Closed' && !item.acknowledged_by_agent
      ).length,
    [feedbackItems]
  );

  const followUpCount = useMemo(
    () =>
      feedbackItems.filter(
        (item) => item.feedback_type === 'Follow-up' && item.status !== 'Closed'
      ).length,
    [feedbackItems]
  );

  function applyAuditToCoaching(audit: AuditItem) {
    setSelectedAuditId(audit.id);
    setSubject(`${audit.team} coaching • ${audit.case_type}`);
    setJustification(audit.comments || '');
    setActionPlan(
      `Review ${audit.case_type} standards, acknowledge the coaching note, and complete a follow-up check on the next matching case.`
    );
    setPriorityOnCreate(
      audit.quality_score < 75 ? 'Critical' : audit.quality_score < 85 ? 'High' : 'Medium'
    );
  }

  function handleSelectAgent(profile: AgentProfile) {
    setSelectedAgentProfileId(profile.id);
    setAgentSearch(getAgentLabel(profile));
    setIsAgentPickerOpen(false);

    const recentAudit = audits.find(
      (item) =>
        normalizeAgentId(item.agent_id) === normalizeAgentId(profile.agent_id) &&
        normalizeAgentName(item.agent_name) === normalizeAgentName(profile.agent_name) &&
        item.team === profile.team
    );

    if (recentAudit) {
      applyAuditToCoaching(recentAudit);
    } else {
      setSelectedAuditId('');
    }
  }

  function resetForm() {
    setSelectedAgentProfileId('');
    setAgentSearch('');
    setIsAgentPickerOpen(false);
    setQaName(currentUser?.agent_name || '');
    setFeedbackType('Coaching');
    setSubject('');
    setFeedbackNote('');
    setJustification('');
    setActionPlan('');
    setFollowUpDate('');
    setStatusOnCreate('Open');
    setPriorityOnCreate('Medium');
    setAuditDateFrom('');
    setAuditDateTo('');
    setSelectedAuditId('');
  }

  async function handleCreatePlan() {
    setErrorMessage('');
    setSuccessMessage('');

    if (!selectedAgent || !qaName.trim() || !subject.trim() || !feedbackNote.trim()) {
      setErrorMessage('Please choose an agent and fill QA Name, Subject, and Coaching Summary.');
      return;
    }

    setSaving(true);

    const mergedActionPlan = composeStructuredPlan({
      priority: priorityOnCreate,
      reviewStage: statusOnCreate === 'Closed' ? 'Closed' : 'QA Shared',
      actionPlan,
      justification,
      agentComment: '',
      supervisorReview: '',
      followUpOutcome: 'Not Set',
      resolutionNote: '',
    });

    const { error } = await supabase.from('agent_feedback').insert({
      agent_id: selectedAgent.agent_id,
      agent_name: selectedAgent.agent_name,
      team: selectedAgent.team,
      qa_name: qaName.trim(),
      feedback_type: feedbackType,
      subject: subject.trim(),
      feedback_note: feedbackNote.trim(),
      action_plan: mergedActionPlan || null,
      due_date: followUpDate || null,
      status: statusOnCreate,
      acknowledged_by_agent: false,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Coaching plan created successfully.');
    resetForm();
    void loadAll();
  }

  async function handleStatusChange(feedbackId: string, newStatus: FeedbackStatus) {
    setErrorMessage('');
    setSuccessMessage('');

    const { error } = await supabase
      .from('agent_feedback')
      .update({ status: newStatus })
      .eq('id', feedbackId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(`Plan status updated to ${newStatus}.`);
    setFeedbackItems((prev) =>
      prev.map((item) => (item.id === feedbackId ? { ...item, status: newStatus } : item))
    );
  }

  async function handleToggleAcknowledgment(item: AgentFeedback) {
    setErrorMessage('');
    setSuccessMessage('');

    const nextAck = !item.acknowledged_by_agent;
    const parsed = parseStructuredPlan(item.action_plan);
    const nextStage =
      nextAck && parsed.reviewStage === 'QA Shared'
        ? 'Acknowledged'
        : parsed.reviewStage;

    const nextActionPlan = composeStructuredPlan({
      priority: parsed.priority,
      reviewStage: nextStage,
      actionPlan: parsed.actionPlan,
      justification: parsed.justification,
      agentComment: parsed.agentComment,
      supervisorReview: parsed.supervisorReview,
      followUpOutcome: parsed.followUpOutcome,
      resolutionNote: parsed.resolutionNote,
    });

    const { error } = await supabase
      .from('agent_feedback')
      .update({
        acknowledged_by_agent: nextAck,
        action_plan: nextActionPlan || null,
      })
      .eq('id', item.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(nextAck ? 'Acknowledgment saved.' : 'Acknowledgment removed.');
    setFeedbackItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? { ...entry, acknowledged_by_agent: nextAck, action_plan: nextActionPlan || null }
          : entry
      )
    );
  }

  async function handleSaveCycleUpdate(item: AgentFeedback) {
    setErrorMessage('');
    setSuccessMessage('');

    const parsed = parseStructuredPlan(item.action_plan);
    const chosenStage = reviewStageDrafts[item.id] || parsed.reviewStage;
    const agentComment = agentCommentDrafts[item.id] ?? parsed.agentComment;
    const supervisorReview = supervisorReviewDrafts[item.id] ?? parsed.supervisorReview;

    const nextStage =
      agentComment.trim() && (chosenStage === 'QA Shared' || chosenStage === 'Acknowledged')
        ? 'Agent Responded'
        : supervisorReview.trim() && chosenStage === 'Agent Responded'
        ? 'Supervisor Reviewed'
        : chosenStage;

    const nextActionPlan = composeStructuredPlan({
      priority: parsed.priority,
      reviewStage: nextStage,
      actionPlan: parsed.actionPlan,
      justification: parsed.justification,
      agentComment,
      supervisorReview,
      followUpOutcome: parsed.followUpOutcome,
      resolutionNote: parsed.resolutionNote,
    });

    const nextStatus =
      nextStage === 'Closed'
        ? 'Closed'
        : item.status === 'Closed'
        ? 'In Progress'
        : item.status;

    const { error } = await supabase
      .from('agent_feedback')
      .update({
        action_plan: nextActionPlan || null,
        status: nextStatus,
      })
      .eq('id', item.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Coaching cycle updated.');
    setFeedbackItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id
          ? { ...entry, action_plan: nextActionPlan || null, status: nextStatus }
          : entry
      )
    );
  }

  async function handleSaveFollowUpResult(item: AgentFeedback) {
    setErrorMessage('');
    setSuccessMessage('');

    const parsed = parseStructuredPlan(item.action_plan);
    const followUpOutcome = planOutcomeDrafts[item.id] || parsed.followUpOutcome;
    const resolutionNote = resolutionNoteDrafts[item.id] ?? parsed.resolutionNote;

    const nextActionPlan = composeStructuredPlan({
      priority: parsed.priority,
      reviewStage:
        followUpOutcome !== 'Not Set'
          ? parsed.reviewStage === 'Closed'
            ? 'Closed'
            : 'Follow-up'
          : parsed.reviewStage,
      actionPlan: parsed.actionPlan,
      justification: parsed.justification,
      agentComment: parsed.agentComment,
      supervisorReview: parsed.supervisorReview,
      followUpOutcome,
      resolutionNote,
    });

    const { error } = await supabase
      .from('agent_feedback')
      .update({ action_plan: nextActionPlan || null })
      .eq('id', item.id);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage('Follow-up outcome saved.');
    setFeedbackItems((prev) =>
      prev.map((entry) =>
        entry.id === item.id ? { ...entry, action_plan: nextActionPlan || null } : entry
      )
    );
  }

  async function handleDelete(feedbackId: string) {
    setErrorMessage('');
    setSuccessMessage('');

    if (pendingDeleteId !== feedbackId) {
      setPendingDeleteId(feedbackId);
      setSuccessMessage('Click delete again to confirm removal.');
      return;
    }

    const { error } = await supabase.from('agent_feedback').delete().eq('id', feedbackId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setPendingDeleteId(null);
    setFeedbackItems((prev) => prev.filter((item) => item.id !== feedbackId));
    setSuccessMessage('Coaching item deleted successfully.');
  }

  return (
    <div style={{ color: 'var(--cc-page-text, #e5eefb)', ...(themeVars as React.CSSProperties) }}>
      <div style={{ ...pageHeaderStyle, justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button type="button" onClick={() => void loadAll()} style={secondaryButton}>
          Refresh
        </button>
      </div>

      {errorMessage ? <div style={errorBannerStyle}>{errorMessage}</div> : null}
      {successMessage ? <div style={successBannerStyle}>{successMessage}</div> : null}

      <div style={summaryGridStyle}>
        <SummaryCard title="Open Plans" value={String(feedbackItems.filter((item) => item.status !== 'Closed').length)} subtitle="All coaching items still active" />
        <SummaryCard title="Overdue Follow-up" value={String(overdueCount)} subtitle="Due date passed and not closed" />
        <SummaryCard title="Need Acknowledgment" value={String(unacknowledgedCount)} subtitle="Agent has not acknowledged yet" />
        <SummaryCard title="High Priority" value={String(highPriorityCount)} subtitle="High and critical plans still open" />
        <SummaryCard title="Follow-up Queue" value={String(followUpCount)} subtitle="Open follow-up tasks" />
      </div>

      <div style={workspaceGridStyle}>
        <div style={panelStyle}>
          <div style={panelEyebrowStyle}>Create Plan</div>
          <h3 style={panelTitleStyle}>Coaching Workspace</h3>
          <p style={panelSubtitleStyle}>
            Start from the agent, use the latest audit as context, and convert the finding into a clear next-step plan.
          </p>

          <div style={formGridStyle}>
            <div style={wideFieldStyle}>
              <label style={labelStyle}>Agent</label>
              <div ref={agentPickerRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setIsAgentPickerOpen((prev) => !prev)}
                  style={pickerButtonStyle}
                >
                  <span style={{ color: selectedAgent ? 'var(--cc-title, #f8fafc)' : 'var(--cc-subtle, #94a3b8)' }}>
                    {selectedAgent ? getAgentLabel(selectedAgent) : 'Select agent'}
                  </span>
                  <span>▼</span>
                </button>

                {isAgentPickerOpen && (
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
                              ...(selectedAgentProfileId === profile.id ? pickerOptionActiveStyle : {}),
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
            </div>

            <div style={infoCardStyle}>
              <div style={infoCardTitleStyle}>Agent Snapshot</div>
              <p style={infoLineStyle}><strong>Agent ID:</strong> {selectedAgent?.agent_id || '-'}</p>
              <p style={infoLineStyle}><strong>Name:</strong> {selectedAgent?.agent_name || '-'}</p>
              <p style={infoLineStyle}><strong>Display:</strong> {selectedAgent?.display_name || '-'}</p>
              <p style={infoLineStyle}><strong>Team:</strong> {selectedAgent?.team || '-'}</p>
              <p style={{ ...infoLineStyle, marginBottom: 0 }}>
                <strong>Open Items:</strong> {selectedAgentOpenItems.length}
              </p>
            </div>

            <div>
              <label style={labelStyle}>QA Name</label>
              <input
                type="text"
                value={qaName}
                onChange={(e) => setQaName(e.target.value)}
                style={fieldStyle}
                placeholder="Enter QA name"
              />
            </div>

            <div>
              <label style={labelStyle}>Plan Type</label>
              <select
                value={feedbackType}
                onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
                style={fieldStyle}
              >
                <option value="Coaching">Coaching</option>
                <option value="Audit Feedback">Audit Feedback</option>
                <option value="Warning">Warning</option>
                <option value="Follow-up">Follow-up</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Priority</label>
              <select
                value={priorityOnCreate}
                onChange={(e) => setPriorityOnCreate(e.target.value as PlanPriority)}
                style={fieldStyle}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Starting Status</label>
              <select
                value={statusOnCreate}
                onChange={(e) => setStatusOnCreate(e.target.value as FeedbackStatus)}
                style={fieldStyle}
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Follow-up Date</label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                style={fieldStyle}
              />
            </div>

            <div style={wideFieldStyle}>
              <label style={labelStyle}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={fieldStyle}
                placeholder="Example: Calls coaching • Refund accuracy"
              />
            </div>

            <div style={wideFieldStyle}>
              <label style={labelStyle}>Coaching Summary</label>
              <textarea
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                rows={4}
                style={fieldStyle}
                placeholder="Summarize the gap, expectation, and what good looks like."
              />
            </div>

            <div style={wideFieldStyle}>
              <label style={labelStyle}>Justification / Audit Context</label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={4}
                style={fieldStyle}
                placeholder="Use audit comments, examples, or case references to justify the plan."
              />
            </div>

            <div style={wideFieldStyle}>
              <label style={labelStyle}>Action Plan</label>
              <textarea
                value={actionPlan}
                onChange={(e) => setActionPlan(e.target.value)}
                rows={5}
                style={fieldStyle}
                placeholder="Write concrete next steps, owner, and follow-up expectations."
              />
            </div>
          </div>

          <div style={actionRowStyle}>
            <button onClick={handleCreatePlan} disabled={saving} style={primaryButton}>
              {saving ? 'Saving...' : 'Create Coaching Plan'}
            </button>
            <button type="button" onClick={resetForm} disabled={saving} style={secondaryButton}>
              Clear Form
            </button>
          </div>
        </div>

        <div style={stackPanelStyle}>
          <div style={panelStyle}>
            <div style={panelEyebrowStyle}>Audit History</div>
            <h3 style={panelTitleStyle}>Selected Agent Audits</h3>
            <p style={panelSubtitleStyle}>
              Filter the selected agent’s audits by date, scroll the history, and choose the exact audit you want to use as the coaching subject.
            </p>

            {!selectedAgent ? (
              <EmptyState text="Pick an agent to load full audit history." />
            ) : (
              <>
                <div style={contextGridStyle}>
                  <ContextCard
                    title="All Audits"
                    value={String(selectedAgentAudits.length)}
                    helper="Loaded for this agent"
                  />
                  <ContextCard
                    title="Visible Audits"
                    value={String(filteredSelectedAgentAudits.length)}
                    helper="After date filters"
                  />
                  <ContextCard
                    title="Average Quality"
                    value={selectedAgentAudits.length ? `${selectedAgentAverage.toFixed(2)}%` : '-'}
                    helper="Across all loaded audits"
                  />
                </div>

                <div style={auditFilterGridStyle}>
                  <div>
                    <label style={labelStyle}>Audit Date From</label>
                    <input
                      type="date"
                      value={auditDateFrom}
                      onChange={(e) => setAuditDateFrom(e.target.value)}
                      style={fieldStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Audit Date To</label>
                    <input
                      type="date"
                      value={auditDateTo}
                      onChange={(e) => setAuditDateTo(e.target.value)}
                      style={fieldStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'end' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setAuditDateFrom('');
                        setAuditDateTo('');
                      }}
                      style={secondaryButton}
                    >
                      Clear Audit Filters
                    </button>
                  </div>
                </div>

                <div style={auditHistoryListStyle}>
                  {filteredSelectedAgentAudits.length === 0 ? (
                    <EmptyState text="No audits match the selected date range." />
                  ) : (
                    filteredSelectedAgentAudits.map((audit) => (
                      <div
                        key={audit.id}
                        style={{
                          ...auditHistoryCardStyle,
                          ...(selectedAudit?.id === audit.id ? auditHistoryCardActiveStyle : {}),
                        }}
                      >
                        <div style={auditHistoryTopRowStyle}>
                          <div>
                            <div style={primaryCellTextStyle}>{audit.case_type}</div>
                            <div style={secondaryCellTextStyle}>
                              {formatDateOnly(audit.audit_date)} • {audit.team}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={auditScoreStyle}>{Number(audit.quality_score).toFixed(2)}%</div>
                            <div style={secondaryCellTextStyle}>
                              {audit.shared_with_agent ? 'Shared' : 'Internal'}
                            </div>
                          </div>
                        </div>

                        <div style={auditHistoryCommentStyle}>
                          {audit.comments || 'No audit comment saved for this item.'}
                        </div>

                        <div style={auditHistoryActionRowStyle}>
                          <button
                            type="button"
                            onClick={() => applyAuditToCoaching(audit)}
                            style={primaryButton}
                          >
                            Use for Coaching
                          </button>
                          {selectedAudit?.id === audit.id ? (
                            <span style={selectedAuditPillStyle}>Current Coaching Source</span>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div style={panelStyle}>
            <div style={panelEyebrowStyle}>Review Queue</div>
            <h3 style={panelTitleStyle}>Routing & Cycle Control</h3>
            <p style={panelSubtitleStyle}>
              The old panel only filtered saved plans. This one shows where each plan is in the coaching cycle and lets you narrow the queue before you review details below.
            </p>

            <div style={routingGridStyle}>
              <ContextCard title="QA Shared" value={String(reviewStageCounts['QA Shared'])} helper="Waiting for acknowledgment or comment" />
              <ContextCard title="Agent Responded" value={String(reviewStageCounts['Agent Responded'])} helper="Ready for supervisor or QA review" />
              <ContextCard title="Supervisor Reviewed" value={String(reviewStageCounts['Supervisor Reviewed'])} helper="Needs supervisor sign-off" />
              <ContextCard title="Follow-up" value={String(reviewStageCounts['Follow-up'])} helper="Ready for outcome tracking" />
            </div>

            <div style={filterGridStyle}>
              <div>
                <label style={labelStyle}>Agent</label>
                <select
                  value={savedAgentFilter}
                  onChange={(e) => setSavedAgentFilter(e.target.value)}
                  style={fieldStyle}
                >
                  <option value="">All Agents</option>
                  {savedAgentOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Status</label>
                <select
                  value={savedStatusFilter}
                  onChange={(e) => setSavedStatusFilter(e.target.value as 'All' | FeedbackStatus)}
                  style={fieldStyle}
                >
                  <option value="All">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Type</label>
                <select
                  value={savedTypeFilter}
                  onChange={(e) => setSavedTypeFilter(e.target.value as 'All' | FeedbackType)}
                  style={fieldStyle}
                >
                  <option value="All">All Types</option>
                  <option value="Coaching">Coaching</option>
                  <option value="Audit Feedback">Audit Feedback</option>
                  <option value="Warning">Warning</option>
                  <option value="Follow-up">Follow-up</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={panelStyle}>
        <div style={panelEyebrowStyle}>Saved Plans</div>
        <h3 style={panelTitleStyle}>Coaching Tasks & Follow-up</h3>
        <p style={panelSubtitleStyle}>
          Use tabs to focus the queue, then open details to manage the full cycle: acknowledgment, agent comment, supervisor review, follow-up outcome, and closure.
        </p>

        <div style={planTabRowStyle}>
          {(['All', 'Open', 'Overdue', 'Awaiting Ack', 'Follow-up'] as PlanTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActivePlanTab(tab)}
              style={{
                ...planTabButtonStyle,
                ...(activePlanTab === tab ? planTabButtonActiveStyle : {}),
              }}
            >
              {tab} ({planTabCounts[tab]})
            </button>
          ))}
        </div>

        {loading ? (
          <p style={emptyTextStyle}>Loading coaching items...</p>
        ) : filteredFeedbackItems.length === 0 ? (
          <EmptyState text="No coaching items found for the current filters." />
        ) : (
          <div style={feedbackTableWrapStyle}>
            <div style={feedbackTableStyle}>
              <div style={{ ...feedbackRowStyle, ...feedbackHeaderRowStyle }}>
                <div style={feedbackCellAgentStyle}>Agent</div>
                <div style={feedbackCellTypeStyle}>Type / Priority</div>
                <div style={feedbackCellSubjectStyle}>Subject</div>
                <div style={feedbackCellDueDateStyle}>Follow-up</div>
                <div style={feedbackCellStatusStyle}>Status / Stage</div>
                <div style={feedbackCellAckStyle}>Agent Cycle</div>
                <div style={feedbackCellActionsStyle}>Actions</div>
              </div>

              {filteredFeedbackItems.map((item) => {
                const isExpanded = expandedFeedbackId === item.id;
                const dueDiff = daysUntil(item.due_date);
                const isOverdue = dueDiff !== null && dueDiff < 0 && item.status !== 'Closed';

                return (
                  <div key={item.id} style={feedbackEntryStyle}>
                    <div style={feedbackRowStyle}>
                      <div style={feedbackCellAgentStyle}>
                        <div style={primaryCellTextStyle}>{item.agent_name}</div>
                        <div style={secondaryCellTextStyle}>
                          {getFeedbackDisplayName(item)} • {item.agent_id} • {item.team}
                        </div>
                      </div>

                      <div style={feedbackCellTypeStyle}>
                        <div style={stackBadgeWrapStyle}>
                          <span style={statusPill(getTypeColor(item.feedback_type))}>
                            {item.feedback_type}
                          </span>
                          <span style={statusPill(getPriorityColor(parseStructuredPlan(item.action_plan).priority))}>
                            {parseStructuredPlan(item.action_plan).priority}
                          </span>
                        </div>
                      </div>

                      <div style={feedbackCellSubjectStyle}>
                        <div style={primaryCellTextStyle}>{item.subject}</div>
                        <div style={secondaryCellTextStyle}>By {item.qa_name}</div>
                        {parseStructuredPlan(item.action_plan).followUpOutcome !== 'Not Set' ? (
                          <div style={{ ...secondaryCellTextStyle, marginTop: '8px' }}>
                            Outcome:{' '}
                            <span style={{ ...statusPill(getOutcomeColor(parseStructuredPlan(item.action_plan).followUpOutcome)), fontSize: '11px', padding: '4px 8px' }}>
                              {parseStructuredPlan(item.action_plan).followUpOutcome}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div style={feedbackCellDueDateStyle}>
                        <div style={primaryCellTextStyle}>{formatDateOnly(item.due_date)}</div>
                        <div style={{ ...secondaryCellTextStyle, color: isOverdue ? '#b91c1c' : 'var(--cc-subtle, #94a3b8)' }}>
                          {item.due_date ? (isOverdue ? 'Overdue' : dueDiff === 0 ? 'Due today' : `${dueDiff} day(s) left`) : 'No due date'}
                        </div>
                      </div>

                      <div style={feedbackCellStatusStyle}>
                        <select
                          value={item.status}
                          onChange={(e) => void handleStatusChange(item.id, e.target.value as FeedbackStatus)}
                          style={miniSelectStyle}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Closed">Closed</option>
                        </select>
                        <div style={{ marginTop: '8px' }}>
                          <span style={statusPill(getReviewStageColor(parseStructuredPlan(item.action_plan).reviewStage))}>
                            {parseStructuredPlan(item.action_plan).reviewStage}
                          </span>
                        </div>
                      </div>

                      <div style={feedbackCellAckStyle}>
                        <button
                          type="button"
                          onClick={() => void handleToggleAcknowledgment(item)}
                          style={item.acknowledged_by_agent ? acknowledgedPillButtonStyle : notAcknowledgedPillButtonStyle}
                        >
                          {item.acknowledged_by_agent ? 'Acknowledged' : 'Not yet'}
                        </button>
                        <div style={secondaryCellTextStyle}>
                          {parseStructuredPlan(item.action_plan).agentComment
                            ? 'Agent comment added'
                            : 'Awaiting agent comment'}
                        </div>
                      </div>

                      <div style={feedbackCellActionsStyle}>
                        <button
                          type="button"
                          onClick={() => setExpandedFeedbackId(isExpanded ? null : item.id)}
                          style={secondaryMiniButton}
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item.id)}
                          style={{
                            ...dangerMiniButton,
                            ...(pendingDeleteId === item.id ? dangerMiniButtonActive : {}),
                          }}
                        >
                          {pendingDeleteId === item.id ? 'Confirm' : 'Delete'}
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div style={expandedFeedbackWrapStyle}>
                        <div style={expandedFeedbackPanelStyle}>
                          <DetailBlock label="Coaching Summary" value={item.feedback_note} />
                          <DetailBlock
                            label="Action Plan"
                            value={parseStructuredPlan(item.action_plan).actionPlan || 'No action plan saved.'}
                          />
                          <DetailBlock
                            label="Justification"
                            value={parseStructuredPlan(item.action_plan).justification || 'No justification saved.'}
                          />
                          <div style={expandedGridStyle}>
                            <DetailMini label="Created" value={formatDateTime(item.created_at)} />
                            <DetailMini
                              label="Acknowledgment"
                              value={item.acknowledged_by_agent ? 'Acknowledged' : 'Not yet'}
                            />
                            <DetailMini label="Follow-up Date" value={formatDateOnly(item.due_date)} />
                            <DetailMini label="Status" value={item.status} />
                            <DetailMini label="Stage" value={parseStructuredPlan(item.action_plan).reviewStage} />
                            <DetailMini label="Priority" value={parseStructuredPlan(item.action_plan).priority} />
                            <DetailMini
                              label="Outcome"
                              value={parseStructuredPlan(item.action_plan).followUpOutcome}
                            />
                          </div>

                          <div style={followUpEditorStyle}>
                            <div style={miniLabelStyle}>Coaching Cycle</div>
                            <div style={followUpEditorGridStyle}>
                              <div>
                                <label style={labelStyle}>Review Stage</label>
                                <select
                                  value={reviewStageDrafts[item.id] || parseStructuredPlan(item.action_plan).reviewStage}
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

                              <div style={wideFieldStyle}>
                                <label style={labelStyle}>Agent Comment</label>
                                <textarea
                                  value={agentCommentDrafts[item.id] ?? parseStructuredPlan(item.action_plan).agentComment}
                                  onChange={(e) =>
                                    setAgentCommentDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                  rows={3}
                                  style={fieldStyle}
                                  placeholder="Agent can respond here with questions, commitment, or explanation."
                                />
                              </div>

                              <div style={wideFieldStyle}>
                                <label style={labelStyle}>Supervisor Review</label>
                                <textarea
                                  value={supervisorReviewDrafts[item.id] ?? parseStructuredPlan(item.action_plan).supervisorReview}
                                  onChange={(e) =>
                                    setSupervisorReviewDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                  rows={3}
                                  style={fieldStyle}
                                  placeholder="Supervisor can review the coaching, confirm next steps, and route it forward."
                                />
                              </div>
                            </div>

                            <div style={actionRowStyle}>
                              <button
                                type="button"
                                onClick={() => void handleSaveCycleUpdate(item)}
                                style={primaryButton}
                              >
                                Save Cycle Update
                              </button>
                            </div>
                          </div>

                          <div style={followUpEditorStyle}>
                            <div style={miniLabelStyle}>Follow-up Result</div>
                            <div style={followUpEditorGridStyle}>
                              <div>
                                <label style={labelStyle}>Outcome</label>
                                <select
                                  value={planOutcomeDrafts[item.id] || parseStructuredPlan(item.action_plan).followUpOutcome}
                                  onChange={(e) =>
                                    setPlanOutcomeDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value as FollowUpOutcome,
                                    }))
                                  }
                                  style={fieldStyle}
                                >
                                  <option value="Not Set">Not Set</option>
                                  <option value="Improved">Improved</option>
                                  <option value="Partial Improvement">Partial Improvement</option>
                                  <option value="No Improvement">No Improvement</option>
                                  <option value="Needs Escalation">Needs Escalation</option>
                                </select>
                              </div>

                              <div style={wideFieldStyle}>
                                <label style={labelStyle}>Resolution Note</label>
                                <textarea
                                  value={resolutionNoteDrafts[item.id] ?? parseStructuredPlan(item.action_plan).resolutionNote}
                                  onChange={(e) =>
                                    setResolutionNoteDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                  rows={4}
                                  style={fieldStyle}
                                  placeholder="Document what happened after follow-up, what improved, and what still needs attention."
                                />
                              </div>
                            </div>

                            <div style={actionRowStyle}>
                              <button
                                type="button"
                                onClick={() => void handleSaveFollowUpResult(item)}
                                style={primaryButton}
                              >
                                Save Follow-up Result
                              </button>
                            </div>
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
      </div>
    </div>
  );
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryCardLabelStyle}>{title}</div>
      <div style={summaryCardValueStyle}>{value}</div>
      <div style={summaryCardSubtitleStyle}>{subtitle}</div>
    </div>
  );
}

function ContextCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div style={contextCardStyle}>
      <div style={miniLabelStyle}>{title}</div>
      <div style={contextValueStyle}>{value}</div>
      <div style={contextHelperStyle}>{helper}</div>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailBlockStyle}>
      <div style={miniLabelStyle}>{label}</div>
      <div style={detailValueStyle}>{value}</div>
    </div>
  );
}

function DetailMini({ label, value }: { label: string; value: string }) {
  return (
    <div style={detailMiniStyle}>
      <div style={miniLabelStyle}>{label}</div>
      <div style={primaryCellTextStyle}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={emptyStateStyle}>{text}</div>;
}

const pageHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
  marginBottom: '22px',
};


const panelEyebrowStyle: React.CSSProperties = {
  color: 'var(--cc-eyebrow, #93c5fd)',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  marginBottom: '8px',
};

const panelTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: '8px',
  color: 'var(--cc-title, #f8fafc)',
  fontSize: '24px',
  fontWeight: 900,
};

const panelSubtitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: '16px',
  color: 'var(--cc-subtitle, #94a3b8)',
  fontSize: '14px',
};

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
  marginBottom: '18px',
};

const summaryCardStyle: React.CSSProperties = {
  background: 'var(--cc-panel-bg)',
  border: 'var(--cc-panel-border)',
  borderRadius: '22px',
  padding: '20px',
  boxShadow: 'var(--cc-panel-shadow)',
};

const summaryCardLabelStyle: React.CSSProperties = {
  color: 'var(--cc-subtle)',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  marginBottom: '8px',
};

const summaryCardValueStyle: React.CSSProperties = {
  color: 'var(--cc-title)',
  fontSize: '30px',
  fontWeight: 900,
  marginBottom: '8px',
};

const summaryCardSubtitleStyle: React.CSSProperties = {
  color: 'var(--cc-subtle)',
  fontSize: '12px',
};

const workspaceGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)',
  gap: '18px',
  marginBottom: '18px',
};

const stackPanelStyle: React.CSSProperties = {
  display: 'grid',
  gap: '18px',
};

const panelStyle: React.CSSProperties = {
  background: 'var(--cc-panel-bg)',
  border: 'var(--cc-panel-border)',
  borderRadius: '24px',
  padding: '20px',
  boxShadow: 'var(--cc-panel-shadow)',
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '14px',
};

const filterGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '12px',
};

const wideFieldStyle: React.CSSProperties = {
  gridColumn: '1 / -1',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: 'var(--cc-muted)',
  fontSize: '12px',
  fontWeight: 700,
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '14px',
  border: 'var(--cc-field-border)',
  background: 'var(--cc-field-bg)',
  color: 'var(--cc-field-text)',
  minHeight: '48px',
};

const primaryButton: React.CSSProperties = {
  padding: '12px 16px',
  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
  color: '#ffffff',
  border: '1px solid rgba(96,165,250,0.24)',
  borderRadius: '14px',
  cursor: 'pointer',
  fontWeight: 700,
};

const secondaryButton: React.CSSProperties = {
  padding: '12px 16px',
  background: 'var(--cc-button-bg)',
  color: 'var(--cc-button-text)',
  border: 'var(--cc-button-border)',
  borderRadius: '14px',
  cursor: 'pointer',
  fontWeight: 700,
};

const actionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '18px',
};

const infoCardStyle: React.CSSProperties = {
  borderRadius: '18px',
  background: 'var(--cc-soft-bg)',
  border: 'var(--cc-row-border)',
  padding: '16px',
};

const infoCardTitleStyle: React.CSSProperties = {
  color: 'var(--cc-title)',
  fontWeight: 800,
  marginBottom: '10px',
};

const infoLineStyle: React.CSSProperties = {
  color: 'var(--cc-page-text)',
  margin: '0 0 8px 0',
  fontSize: '13px',
};

const pickerButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '14px',
  border: 'var(--cc-field-border)',
  background: 'var(--cc-field-bg)',
  color: 'var(--cc-field-text)',
  minHeight: '48px',
  cursor: 'pointer',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const pickerMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  left: 0,
  right: 0,
  zIndex: 20,
  borderRadius: '18px',
  background: 'var(--cc-panel-bg)',
  border: 'var(--cc-panel-border)',
  boxShadow: 'var(--cc-panel-shadow)',
  padding: '12px',
};

const pickerSearchWrapStyle: React.CSSProperties = {
  marginBottom: '10px',
};

const pickerListStyle: React.CSSProperties = {
  display: 'grid',
  gap: '8px',
  maxHeight: '260px',
  overflowY: 'auto',
};

const pickerInfoStyle: React.CSSProperties = {
  padding: '12px 14px',
  color: 'var(--cc-subtle)',
};

const pickerOptionStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '12px',
  border: 'var(--cc-row-border)',
  background: 'var(--cc-card-bg)',
  color: 'var(--cc-page-text)',
  textAlign: 'left',
  cursor: 'pointer',
};

const pickerOptionActiveStyle: React.CSSProperties = {
  background: 'var(--cc-accent-bg)',
  color: 'var(--cc-accent-text)',
};

const contextGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
};

const contextCardStyle: React.CSSProperties = {
  borderRadius: '18px',
  border: 'var(--cc-row-border)',
  background: 'var(--cc-card-bg)',
  padding: '16px',
};

const contextValueStyle: React.CSSProperties = {
  color: 'var(--cc-title)',
  fontSize: '20px',
  fontWeight: 800,
  margin: '6px 0',
};

const contextHelperStyle: React.CSSProperties = {
  color: 'var(--cc-subtle)',
  fontSize: '12px',
};

const auditFilterGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: '12px',
  marginTop: '14px',
  marginBottom: '14px',
};

const auditHistoryListStyle: React.CSSProperties = {
  display: 'grid',
  gap: '12px',
  maxHeight: '460px',
  overflowY: 'auto',
  paddingRight: '4px',
};

const auditHistoryCardStyle: React.CSSProperties = {
  borderRadius: '18px',
  border: 'var(--cc-row-border)',
  background: 'var(--cc-card-bg)',
  padding: '16px',
};

const auditHistoryCardActiveStyle: React.CSSProperties = {
  boxShadow: 'inset 0 0 0 2px rgba(37,99,235,0.20)',
  background: 'var(--cc-soft-bg)',
};

const auditHistoryTopRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  alignItems: 'flex-start',
};

const auditHistoryCommentStyle: React.CSSProperties = {
  marginTop: '12px',
  color: 'var(--cc-page-text)',
  lineHeight: 1.6,
  fontSize: '13px',
  whiteSpace: 'pre-wrap',
};

const auditHistoryActionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  alignItems: 'center',
  flexWrap: 'wrap',
  marginTop: '14px',
};

const auditScoreStyle: React.CSSProperties = {
  color: 'var(--cc-title)',
  fontSize: '18px',
  fontWeight: 900,
};

const selectedAuditPillStyle: React.CSSProperties = {
  padding: '7px 10px',
  borderRadius: '999px',
  background: 'var(--cc-accent-bg)',
  color: 'var(--cc-accent-text)',
  fontWeight: 800,
  fontSize: '12px',
};

const routingGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
  marginBottom: '14px',
};


const miniLabelStyle: React.CSSProperties = {
  color: 'var(--cc-eyebrow)',
  fontSize: '11px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
};


const feedbackTableWrapStyle: React.CSSProperties = {
  overflowX: 'auto',
  borderRadius: '18px',
  marginTop: '14px',
};

const feedbackTableStyle: React.CSSProperties = {
  minWidth: '1120px',
  display: 'grid',
  gap: '10px',
};

const feedbackEntryStyle: React.CSSProperties = {
  display: 'grid',
  gap: '10px',
};

const feedbackRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 1.6fr 1fr 1fr 1fr 1.3fr',
  gap: '10px',
  alignItems: 'center',
  padding: '14px',
  borderRadius: '16px',
  background: 'var(--cc-card-bg)',
  border: 'var(--cc-row-border)',
};

const feedbackHeaderRowStyle: React.CSSProperties = {
  background: 'var(--cc-soft-bg)',
};

const feedbackCellAgentStyle: React.CSSProperties = {};
const feedbackCellTypeStyle: React.CSSProperties = {};
const feedbackCellSubjectStyle: React.CSSProperties = {};
const feedbackCellDueDateStyle: React.CSSProperties = {};
const feedbackCellStatusStyle: React.CSSProperties = {};
const feedbackCellAckStyle: React.CSSProperties = {};
const feedbackCellActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
};

const primaryCellTextStyle: React.CSSProperties = {
  color: 'var(--cc-title)',
  fontWeight: 700,
  fontSize: '14px',
};

const secondaryCellTextStyle: React.CSSProperties = {
  color: 'var(--cc-subtle)',
  marginTop: '4px',
  fontSize: '12px',
};

const miniSelectStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '40px',
  padding: '8px 10px',
  borderRadius: '12px',
  border: 'var(--cc-field-border)',
  background: 'var(--cc-field-bg)',
  color: 'var(--cc-field-text)',
};

const secondaryMiniButton: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: '12px',
  background: 'var(--cc-button-bg)',
  color: 'var(--cc-button-text)',
  border: 'var(--cc-button-border)',
  cursor: 'pointer',
  fontWeight: 700,
};

const dangerMiniButton: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: '12px',
  background: 'rgba(239,68,68,0.10)',
  color: '#dc2626',
  border: '1px solid rgba(239,68,68,0.24)',
  cursor: 'pointer',
  fontWeight: 700,
};

const dangerMiniButtonActive: React.CSSProperties = {
  background: 'rgba(239,68,68,0.18)',
};

const acknowledgedPillButtonStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: '999px',
  background: 'rgba(22,101,52,0.10)',
  color: '#166534',
  border: '1px solid rgba(22,101,52,0.20)',
  cursor: 'pointer',
  fontWeight: 800,
};

const notAcknowledgedPillButtonStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: '999px',
  background: 'rgba(37,99,235,0.10)',
  color: '#1d4ed8',
  border: '1px solid rgba(37,99,235,0.20)',
  cursor: 'pointer',
  fontWeight: 800,
};

const expandedFeedbackWrapStyle: React.CSSProperties = {
  paddingLeft: '14px',
  paddingRight: '14px',
};

const expandedFeedbackPanelStyle: React.CSSProperties = {
  borderRadius: '18px',
  border: 'var(--cc-row-border)',
  background: 'var(--cc-soft-bg)',
  padding: '16px',
  display: 'grid',
  gap: '12px',
};

const detailBlockStyle: React.CSSProperties = {
  borderRadius: '14px',
  background: 'var(--cc-card-bg)',
  border: 'var(--cc-row-border)',
  padding: '14px',
};

const detailValueStyle: React.CSSProperties = {
  color: 'var(--cc-page-text)',
  lineHeight: 1.7,
  marginTop: '8px',
  whiteSpace: 'pre-wrap',
};

const expandedGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
};

const detailMiniStyle: React.CSSProperties = {
  borderRadius: '14px',
  background: 'var(--cc-card-bg)',
  border: 'var(--cc-row-border)',
  padding: '14px',
};

const planTabRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginBottom: '14px',
};

const planTabButtonStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '999px',
  background: 'var(--cc-button-bg)',
  color: 'var(--cc-button-text)',
  border: 'var(--cc-button-border)',
  cursor: 'pointer',
  fontWeight: 700,
};

const planTabButtonActiveStyle: React.CSSProperties = {
  background: 'var(--cc-accent-bg)',
  color: 'var(--cc-accent-text)',
};

const stackBadgeWrapStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
};

const followUpEditorStyle: React.CSSProperties = {
  borderRadius: '18px',
  border: 'var(--cc-row-border)',
  background: 'var(--cc-card-bg)',
  padding: '16px',
};

const followUpEditorGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '12px',
  marginTop: '12px',
};

const emptyTextStyle: React.CSSProperties = {
  color: 'var(--cc-subtle)',
};

const emptyStateStyle: React.CSSProperties = {
  marginTop: '8px',
  padding: '18px',
  borderRadius: '16px',
  border: 'var(--cc-row-border)',
  backgroundColor: 'var(--cc-card-bg)',
  color: 'var(--cc-subtle)',
  textAlign: 'center',
  fontWeight: 500,
};

const errorBannerStyle: React.CSSProperties = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  backgroundColor: 'var(--cc-error-bg)',
  color: 'var(--cc-error-text)',
};

const successBannerStyle: React.CSSProperties = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  backgroundColor: 'var(--cc-success-bg)',
  color: 'var(--cc-success-text)',
};

function statusPill(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    padding: '7px 10px',
    fontSize: '12px',
    fontWeight: 800,
    background: `${color}18`,
    color,
    border: `1px solid ${color}30`,
  };
}

export default CoachingCenter;
