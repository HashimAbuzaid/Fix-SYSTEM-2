import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  memo,
  type CSSProperties,
} from 'react';
import { supabase } from '../lib/supabase';
import TrainingModule, {
  type LearningContentItem,
  type LearningStatus,
  type TeamName,
  type UserRole,
} from './TrainingModule';
import QuizEngine, { type QuizQuestion } from './QuizEngine';
import CertificationTracker, { type CertificationRecord } from './CertificationTracker';

type CurrentUser = {
  id?: string;
  role?: UserRole | string | null;
  agent_id?: string | null;
  agent_name?: string | null;
  display_name?: string | null;
  team?: TeamName | null;
  email?: string | null;
};

type LearningAssignment = {
  id: string;
  content_id: string;
  assigned_to: string;
  assigned_by?: string | null;
  status: LearningStatus;
  due_date?: string | null;
  created_at?: string | null;
};

type AuditSignal = {
  metric: string;
  count: number;
  latestScore: number | null;
};

type CoachingNote = {
  id: string;
  agent_name: string;
  module_title: string;
  note: string;
  status: LearningStatus;
};

type LearningStats = {
  assigned: number;
  completed: number;
  overdue: number;
  quizAverage: number;
  certifications: number;
  xp: number;
};

type SupabaseLearningItem = Partial<LearningContentItem> & {
  type?: LearningContentItem['type'];
};

type SupabaseAssignment = Partial<LearningAssignment>;
type SupabaseCertification = Partial<CertificationRecord>;
type SupabaseQuizQuestion = Partial<QuizQuestion>;

const LC_STYLE_ID = 'da-learning-center-v1';

const FALLBACK_CONTENT: LearningContentItem[] = [
  {
    id: 'module-providing-rl',
    type: 'training',
    title: 'Providing RL: Required Return Label Workflow',
    summary: 'Standardizes when and how agents provide return labels without missing required checks.',
    body: 'Confirm the customer issue, verify order eligibility, document the reason clearly, then provide the correct RL path. Always leave notes that another QA reviewer can understand without extra context.',
    team: 'Calls',
    role: 'agent',
    metric: 'Providing RL',
    durationMinutes: 12,
    xp: 40,
    status: 'assigned',
    dueDate: 'This week',
    steps: [
      'Confirm order and customer details.',
      'Identify the return reason and required approval path.',
      'Create accurate notes before sharing the return label.',
      'Verify the customer understands the next step.',
    ],
  },
  {
    id: 'sop-refund-form',
    type: 'sop',
    title: 'Refund Form SOP',
    summary: 'Version-controlled guidance for refund documentation and approval expectations.',
    body: 'Use the refund form only after validating order status, customer request, and policy eligibility. Missing fields should be treated as a quality risk.',
    team: 'Tickets',
    role: 'qa',
    metric: 'Refund Form',
    version: 'v1.0',
    author: 'QA Team',
    updatedAt: 'Current',
    xp: 25,
    status: 'available',
    steps: [
      'Check the order status.',
      'Confirm the refund reason.',
      'Attach notes and required references.',
      'Submit using the correct approval path.',
    ],
  },
  {
    id: 'defect-procedure',
    type: 'defect',
    title: 'Defect Example: Procedure Miss',
    summary: 'Shows what went wrong, why it matters, and the expected corrected behavior.',
    body: 'A procedure miss occurs when the agent solves the surface issue but skips the documented workflow. This creates inconsistent outcomes and repeat contacts.',
    team: 'Calls',
    role: 'agent',
    metric: 'Procedure',
    xp: 30,
    status: 'recommended',
    defectExample: 'Agent offered a replacement before confirming eligibility and notes.',
    correctBehavior: 'Follow the required verification sequence, then document the decision before setting expectations.',
  },
  {
    id: 'quality-standard-accuracy',
    type: 'standard',
    title: 'Quality Standard: Accuracy',
    summary: 'Defines what strong accuracy looks like across calls, tickets, and sales interactions.',
    body: 'Accuracy means the customer receives correct information, the order/ticket is updated properly, and internal policy is followed without creating downstream rework.',
    team: 'All',
    role: 'agent',
    metric: 'Accuracy',
    xp: 20,
    status: 'available',
  },
  {
    id: 'onboarding-agent',
    type: 'onboarding',
    title: 'Agent Onboarding Path',
    summary: 'Role-based starter path for new agents covering QA expectations and common workflows.',
    body: 'Complete the basics before moving into team-specific procedures. Supervisors can use this path to track early readiness.',
    team: 'All',
    role: 'agent',
    xp: 75,
    status: 'assigned',
    steps: [
      'Understand QA score categories.',
      'Review hidden/shared audit expectations.',
      'Complete the first refresher quiz.',
      'Review common defect examples.',
    ],
  },
  {
    id: 'lesson-audit-findings',
    type: 'lesson',
    title: 'Lessons Learned from Recent Audit Findings',
    summary: 'Recurring patterns from audits converted into practical coaching points.',
    body: 'Recent quality reviews show that repeat issues usually come from missed documentation, unclear customer expectations, and skipped verification steps.',
    team: 'All',
    role: 'supervisor',
    xp: 35,
    status: 'available',
  },
  {
    id: 'best-practice-notes',
    type: 'best-practice',
    title: 'Best Practice: Notes That Reduce Repeat Errors',
    summary: 'Examples of concise notes that help agents, supervisors, and QA reviewers stay aligned.',
    body: 'Strong notes explain the customer issue, the action taken, why it was taken, and the next expected step.',
    team: 'All',
    role: 'agent',
    metric: 'Notes',
    xp: 25,
    status: 'recommended',
  },
  {
    id: 'work-instruction-aform',
    type: 'work-instruction',
    title: 'A-form Work Instruction',
    summary: 'Short actionable checklist for completing A-form requirements correctly.',
    body: 'Use this when the customer interaction requires an A-form. The goal is complete, clean, and reviewable documentation.',
    team: 'Calls',
    role: 'agent',
    metric: 'A-form',
    xp: 20,
    status: 'available',
    steps: [
      'Open the correct form.',
      'Fill required customer/order fields.',
      'Validate the reason code.',
      'Save and reference the form in notes.',
    ],
  },
];

const FALLBACK_QUIZ: QuizQuestion[] = [
  {
    id: 'q-rl-1',
    prompt: 'What should happen before providing an RL?',
    options: [
      'Send it immediately',
      'Verify eligibility and document the reason',
      'Ask another agent to handle it',
      'Skip notes if the customer is upset',
    ],
    correctAnswer: 'Verify eligibility and document the reason',
    feedback: 'RL handling must be documented and eligible before the customer receives the next step.',
    topic: 'Providing RL',
  },
  {
    id: 'q-notes-1',
    prompt: 'Which note style is strongest?',
    options: [
      'Done',
      'Customer called',
      'Verified order, confirmed issue, created REF, advised next step',
      'Will check later',
    ],
    correctAnswer: 'Verified order, confirmed issue, created REF, advised next step',
    feedback: 'Strong notes explain the issue, action, and next expectation.',
    topic: 'Notes',
  },
  {
    id: 'q-procedure-1',
    prompt: 'Why does procedure matter even if the customer issue is solved?',
    options: [
      'It creates consistent outcomes and reduces rework',
      'It only matters for supervisors',
      'It replaces accuracy',
      'It is optional when volume is high',
    ],
    correctAnswer: 'It creates consistent outcomes and reduces rework',
    feedback: 'Procedure protects consistency, compliance, and future review quality.',
    topic: 'Procedure',
  },
];

const FALLBACK_CERTIFICATIONS: CertificationRecord[] = [
  {
    id: 'cert-agent-basics',
    name: 'QA Foundations',
    description: 'Core quality expectations, scoring awareness, and documentation basics.',
    status: 'in-progress',
    progress: 68,
    requiredRole: 'agent',
    expiresAt: 'Annual refresher',
  },
  {
    id: 'cert-supervisor-coaching',
    name: 'Supervisor Coaching Readiness',
    description: 'Assign learning, track completion, and coach from audit findings.',
    status: 'not-started',
    progress: 0,
    requiredRole: 'supervisor',
  },
  {
    id: 'cert-refund-accuracy',
    name: 'Refund & RL Accuracy',
    description: 'Refund form, return label, and related policy quality standards.',
    status: 'certified',
    progress: 100,
    requiredRole: 'agent',
  },
];

const LEARNING_CSS = `
.lc-root {
  --lc-bg: var(--bg-base, #0a0a0f);
  --lc-surface: var(--bg-elevated, #111118);
  --lc-surface-2: var(--bg-overlay, #16161f);
  --lc-soft: var(--bg-subtle, rgba(255,255,255,0.04));
  --lc-soft-hover: var(--bg-subtle-hover, rgba(255,255,255,0.07));
  --lc-border: var(--border, rgba(255,255,255,0.07));
  --lc-border-strong: var(--border-strong, rgba(255,255,255,0.12));
  --lc-text: var(--fg-default, #f1f5f9);
  --lc-muted: var(--fg-muted, #64748b);
  --lc-subtle: var(--fg-subtle, #334155);
  --lc-accent: var(--accent-blue, #3b82f6);
  --lc-success: var(--accent-emerald, #10b981);
  --lc-warning: var(--accent-amber, #f59e0b);
  --lc-danger: var(--accent-rose, #f43f5e);
  --lc-violet: var(--accent-violet, #8b5cf6);
  --lc-cyan: var(--accent-cyan, #06b6d4);
  --lc-shadow: var(--shadow-md, 0 4px 16px rgba(0,0,0,0.5));
  font-family: var(--font-sans, Inter, system-ui, sans-serif);
  color: var(--lc-text);
  min-height: calc(100vh - 104px);
}
.lc-root * { box-sizing: border-box; }
.lc-root button,
.lc-root input,
.lc-root textarea,
.lc-root select { font-family: inherit; }
@keyframes lc-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes lc-in { from { opacity: 0; } to { opacity: 1; } }
.lc-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 18px;
  align-items: end;
  padding: 26px;
  border-radius: 22px;
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--lc-accent) 18%, transparent), transparent 36%),
    linear-gradient(180deg, var(--lc-surface), var(--lc-surface-2));
  border: 1px solid var(--lc-border-strong);
  box-shadow: var(--lc-shadow);
  overflow: hidden;
  animation: lc-up 220ms var(--ease-out, ease) both;
}
.lc-eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--lc-accent);
  margin-bottom: 8px;
}
.lc-title {
  margin: 0;
  font-size: clamp(28px, 4vw, 44px);
  letter-spacing: -0.045em;
  line-height: 1.02;
  font-weight: 850;
}
.lc-subtitle {
  margin-top: 10px;
  color: var(--lc-muted);
  font-size: 14px;
  line-height: 1.65;
  max-width: 780px;
}
.lc-search {
  width: min(360px, 100%);
  height: 40px;
  border-radius: 12px;
  border: 1px solid var(--lc-border-strong);
  background: var(--lc-soft);
  color: var(--lc-text);
  padding: 0 14px;
  outline: none;
  font-size: 13px;
  transition: border-color 120ms ease, background 120ms ease;
}
.lc-search:focus { border-color: var(--lc-accent); background: var(--lc-surface); }
.lc-search::placeholder { color: var(--lc-muted); }
.lc-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 18px 0;
}
.lc-tab {
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--lc-border);
  background: var(--lc-surface);
  color: var(--lc-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease, transform 120ms ease;
}
.lc-tab:hover { color: var(--lc-text); background: var(--lc-soft-hover); }
.lc-tab.active {
  color: var(--lc-accent);
  background: color-mix(in srgb, var(--lc-accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--lc-accent) 26%, transparent);
}
.lc-tab:active { transform: scale(.98); }
.lc-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 14px;
}
.lc-card {
  background: var(--lc-surface);
  border: 1px solid var(--lc-border);
  border-radius: 18px;
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,.4));
  animation: lc-up 220ms var(--ease-out, ease) both;
}
.lc-card-pad { padding: 18px; }
.lc-span-3 { grid-column: span 3; }
.lc-span-4 { grid-column: span 4; }
.lc-span-5 { grid-column: span 5; }
.lc-span-6 { grid-column: span 6; }
.lc-span-7 { grid-column: span 7; }
.lc-span-8 { grid-column: span 8; }
.lc-span-12 { grid-column: span 12; }
.lc-kpi-label {
  color: var(--lc-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .11em;
  text-transform: uppercase;
}
.lc-kpi-value {
  margin-top: 8px;
  font-size: 30px;
  font-weight: 850;
  letter-spacing: -.035em;
  font-variant-numeric: tabular-nums;
}
.lc-kpi-note {
  margin-top: 6px;
  color: var(--lc-muted);
  font-size: 12px;
}
.lc-section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -.02em;
}
.lc-pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.lc-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 4px 9px;
  border-radius: 999px;
  border: 1px solid var(--lc-border);
  background: var(--lc-soft);
  color: var(--lc-muted);
  font-size: 11px;
  font-weight: 700;
}
.lc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 13px;
  border-radius: 10px;
  border: 1px solid var(--lc-border-strong);
  background: var(--lc-soft);
  color: var(--lc-text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 750;
  transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
}
.lc-btn:hover { background: var(--lc-soft-hover); border-color: var(--lc-border-strong); }
.lc-btn:active { transform: scale(.98); }
.lc-btn-primary {
  color: var(--lc-accent);
  background: color-mix(in srgb, var(--lc-accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--lc-accent) 26%, transparent);
}
.lc-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lc-mini-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--lc-border);
  background: var(--lc-soft);
}
.lc-mini-icon {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--lc-accent) 12%, transparent);
  color: var(--lc-accent);
  flex: 0 0 auto;
  font-size: 14px;
}
.lc-mini-title {
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 3px;
}
.lc-mini-copy {
  color: var(--lc-muted);
  font-size: 12px;
  line-height: 1.5;
}
.lc-muted { color: var(--lc-muted); }
.lc-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.lc-empty {
  padding: 28px;
  text-align: center;
  color: var(--lc-muted);
  border: 1px dashed var(--lc-border-strong);
  border-radius: 16px;
  background: var(--lc-soft);
  font-size: 13px;
}
@media (max-width: 1100px) {
  .lc-span-3, .lc-span-4, .lc-span-5, .lc-span-6, .lc-span-7, .lc-span-8 { grid-column: span 12; }
  .lc-hero { grid-template-columns: 1fr; }
  .lc-search { width: 100%; }
}
@media (max-width: 720px) {
  .lc-grid { grid-template-columns: 1fr; }
  .lc-span-12, .lc-span-8, .lc-span-7, .lc-span-6, .lc-span-5, .lc-span-4, .lc-span-3 { grid-column: span 1; }
  .lc-two-col { grid-template-columns: 1fr; }
  .lc-hero { padding: 20px; }
}
`;

function useLearningStyles() {
  useEffect(() => {
    if (document.getElementById(LC_STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = LC_STYLE_ID;
    el.textContent = LEARNING_CSS;
    document.head.appendChild(el);
    return () => {
      document.getElementById(LC_STYLE_ID)?.remove();
    };
  }, []);
}

function normalizeRole(role?: string | null): UserRole {
  if (role === 'admin' || role === 'qa' || role === 'supervisor' || role === 'agent') return role;
  return 'agent';
}

function isOverdue(due?: string | null) {
  if (!due || due === 'This week' || due === 'Annual refresher') return false;
  const dueTime = new Date(`${due}T23:59:59`).getTime();
  return Number.isFinite(dueTime) && dueTime < Date.now();
}

function statusFromAssignment(status?: string | null): LearningStatus {
  if (status === 'completed') return 'completed';
  if (status === 'in-progress') return 'in-progress';
  if (status === 'overdue') return 'overdue';
  if (status === 'recommended') return 'recommended';
  return 'assigned';
}

function safeText(value?: string | null) {
  return String(value || '').trim();
}

function mapContentRow(row: SupabaseLearningItem): LearningContentItem | null {
  if (!row.id || !row.title) return null;
  return {
    id: String(row.id),
    type: row.type || 'training',
    title: String(row.title),
    summary: safeText(row.summary || row.description) || 'Learning Center content.',
    body: safeText(row.body || row.content) || '',
    team: (row.team as TeamName) || 'All',
    role: (row.role as UserRole) || 'agent',
    metric: row.metric || row.metric_tag || null,
    durationMinutes: Number(row.durationMinutes || row.duration_minutes || 10),
    xp: Number(row.xp || 25),
    status: row.status || 'available',
    dueDate: row.dueDate || row.due_date || null,
    version: row.version || null,
    author: row.author || null,
    updatedAt: row.updatedAt || row.updated_at || null,
    videoUrl: row.videoUrl || row.video_url || null,
    steps: Array.isArray(row.steps) ? row.steps.map(String) : [],
    defectExample: row.defectExample || row.defect_example || null,
    correctBehavior: row.correctBehavior || row.correct_behavior || null,
  };
}

function mapQuizRow(row: SupabaseQuizQuestion): QuizQuestion | null {
  if (!row.id || !row.prompt) return null;
  const options = Array.isArray(row.options) ? row.options.map(String) : [];
  const correctAnswer = String(row.correctAnswer || row.correct_answer || '');
  if (options.length === 0 || !correctAnswer) return null;
  return {
    id: String(row.id),
    prompt: String(row.prompt),
    options,
    correctAnswer,
    feedback: String(row.feedback || ''),
    topic: String(row.topic || 'General'),
  };
}

function mapCertificationRow(row: SupabaseCertification): CertificationRecord | null {
  if (!row.id || !row.name) return null;
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description || ''),
    status: row.status === 'certified' || row.status === 'expired' || row.status === 'in-progress' ? row.status : 'not-started',
    progress: Number(row.progress || 0),
    requiredRole: (row.requiredRole || row.required_role || 'agent') as UserRole,
    expiresAt: row.expiresAt || row.expires_at || null,
  };
}

function getTypeLabel(type: LearningContentItem['type']) {
  const labels: Record<LearningContentItem['type'], string> = {
    training: 'Training',
    sop: 'SOP',
    'work-instruction': 'Work Instruction',
    defect: 'Defect Example',
    standard: 'Quality Standard',
    onboarding: 'Onboarding',
    lesson: 'Lesson Learned',
    'best-practice': 'Best Practice',
  };
  return labels[type];
}

function getRoleCanManage(role: UserRole) {
  return role === 'admin' || role === 'qa' || role === 'supervisor';
}

function LearningCenter({ currentUser = null }: { currentUser?: CurrentUser | null }) {
  useLearningStyles();

  const role = normalizeRole(currentUser?.role);
  const canManage = getRoleCanManage(role);
  const userId = currentUser?.id || '';
  const userTeam = currentUser?.team || 'All';

  const [activeTab, setActiveTab] = useState<'overview' | 'library' | 'quizzes' | 'certifications' | 'coaching' | 'analytics'>('overview');
  const [search, setSearch] = useState('');
  const [content, setContent] = useState<LearningContentItem[]>(FALLBACK_CONTENT);
  const [assignments, setAssignments] = useState<LearningAssignment[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>(FALLBACK_QUIZ);
  const [certifications, setCertifications] = useState<CertificationRecord[]>(FALLBACK_CERTIFICATIONS);
  const [auditSignals, setAuditSignals] = useState<AuditSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const loadLearningData = useCallback(async () => {
    setLoading(true);
    setNotice('');

    const [
      contentRes,
      assignmentRes,
      quizRes,
      certRes,
      auditRes,
    ] = await Promise.allSettled([
      supabase.from('learning_content').select('*').order('updated_at', { ascending: false }),
      userId
        ? supabase.from('learning_assignments').select('*').eq('assigned_to', userId)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('learning_quiz_questions').select('*'),
      userId
        ? supabase.from('learning_certifications').select('*').eq('user_id', userId)
        : Promise.resolve({ data: [], error: null }),
      userId
        ? supabase.from('audits').select('quality_score, score_details, audit_date').or(`agent_id.eq.${currentUser?.agent_id || ''},created_by_user_id.eq.${userId}`).limit(40)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (contentRes.status === 'fulfilled' && !contentRes.value.error && Array.isArray(contentRes.value.data)) {
      const mapped = (contentRes.value.data as SupabaseLearningItem[]).map(mapContentRow).filter((item): item is LearningContentItem => item !== null);
      if (mapped.length) setContent(mapped);
    }

    if (assignmentRes.status === 'fulfilled' && !assignmentRes.value.error && Array.isArray(assignmentRes.value.data)) {
      const mapped = (assignmentRes.value.data as SupabaseAssignment[])
        .filter((row): row is SupabaseAssignment & { id: string; content_id: string; assigned_to: string } => !!row.id && !!row.content_id && !!row.assigned_to)
        .map((row) => ({
          id: String(row.id),
          content_id: String(row.content_id),
          assigned_to: String(row.assigned_to),
          assigned_by: row.assigned_by || null,
          status: statusFromAssignment(row.status),
          due_date: row.due_date || null,
          created_at: row.created_at || null,
        }));
      setAssignments(mapped);
    }

    if (quizRes.status === 'fulfilled' && !quizRes.value.error && Array.isArray(quizRes.value.data)) {
      const mapped = (quizRes.value.data as SupabaseQuizQuestion[]).map(mapQuizRow).filter((item): item is QuizQuestion => item !== null);
      if (mapped.length) setQuizQuestions(mapped);
    }

    if (certRes.status === 'fulfilled' && !certRes.value.error && Array.isArray(certRes.value.data)) {
      const mapped = (certRes.value.data as SupabaseCertification[]).map(mapCertificationRow).filter((item): item is CertificationRecord => item !== null);
      if (mapped.length) setCertifications(mapped);
    }

    if (auditRes.status === 'fulfilled' && !auditRes.value.error && Array.isArray(auditRes.value.data)) {
      const metricMap = new Map<string, { count: number; latestScore: number | null }>();
      (auditRes.value.data as Array<{ quality_score?: number | null; score_details?: Array<{ metric?: string; result?: string }> | null }>).forEach((audit) => {
        (audit.score_details || []).forEach((detail) => {
          const result = String(detail.result || '');
          const metric = String(detail.metric || '').trim();
          if (!metric || !['Fail', 'Borderline', 'Auto-Fail'].includes(result)) return;
          const current = metricMap.get(metric) || { count: 0, latestScore: null };
          metricMap.set(metric, { count: current.count + 1, latestScore: Number(audit.quality_score ?? current.latestScore ?? 0) });
        });
      });
      setAuditSignals([...metricMap.entries()].map(([metric, value]) => ({ metric, ...value })).sort((a, b) => b.count - a.count).slice(0, 6));
    }

    const hadRejected = [contentRes, assignmentRes, quizRes, certRes, auditRes].some((result) => result.status === 'rejected');
    if (hadRejected) setNotice('Learning Center is using starter content until the Supabase learning tables are available.');
    setLoading(false);
  }, [currentUser?.agent_id, userId]);

  useEffect(() => {
    void loadLearningData();
  }, [loadLearningData]);

  const contentWithAssignments = useMemo(() => {
    const assignmentByContent = new Map(assignments.map((item) => [item.content_id, item]));
    return content.map((item) => {
      const assignment = assignmentByContent.get(item.id);
      if (!assignment) return item;
      return {
        ...item,
        status: isOverdue(assignment.due_date) ? 'overdue' as const : assignment.status,
        dueDate: assignment.due_date || item.dueDate || null,
      };
    });
  }, [assignments, content]);

  const recommended = useMemo(() => {
    const signalMetrics = new Set(auditSignals.map((signal) => signal.metric.toLowerCase()));
    return contentWithAssignments
      .filter((item) => {
        if (item.status === 'assigned' || item.status === 'overdue' || item.status === 'recommended') return true;
        if (item.metric && signalMetrics.has(item.metric.toLowerCase())) return true;
        return item.role === role || item.team === userTeam || item.team === 'All';
      })
      .slice(0, 6);
  }, [auditSignals, contentWithAssignments, role, userTeam]);

  const filteredContent = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contentWithAssignments;
    return contentWithAssignments.filter((item) =>
      [
        item.title,
        item.summary,
        item.body,
        item.metric || '',
        item.team,
        item.role,
        getTypeLabel(item.type),
      ].join(' ').toLowerCase().includes(query)
    );
  }, [contentWithAssignments, search]);

  const stats = useMemo<LearningStats>(() => {
    const assigned = contentWithAssignments.filter((item) => item.status === 'assigned' || item.status === 'overdue' || item.status === 'in-progress').length;
    const completed = contentWithAssignments.filter((item) => item.status === 'completed').length;
    const overdue = contentWithAssignments.filter((item) => item.status === 'overdue' || isOverdue(item.dueDate)).length;
    const completedCerts = certifications.filter((cert) => cert.status === 'certified').length;
    const earnedXp = contentWithAssignments
      .filter((item) => item.status === 'completed')
      .reduce((sum, item) => sum + item.xp, 0);
    return {
      assigned,
      completed,
      overdue,
      quizAverage: 86,
      certifications: completedCerts,
      xp: earnedXp + completedCerts * 100,
    };
  }, [certifications, contentWithAssignments]);

  const coachingNotes = useMemo<CoachingNote[]>(() => [
    {
      id: 'coach-1',
      agent_name: currentUser?.agent_name || currentUser?.display_name || 'Agent',
      module_title: recommended[0]?.title || 'Recommended Training',
      note: 'Review assigned content before the next QA touchpoint.',
      status: recommended[0]?.status || 'assigned',
    },
    {
      id: 'coach-2',
      agent_name: 'Team Focus',
      module_title: auditSignals[0]?.metric ? `${auditSignals[0].metric} Refresher` : 'Procedure Refresher',
      note: 'Use audit findings to drive a short refresher during coaching.',
      status: auditSignals.length ? 'recommended' : 'available',
    },
  ], [auditSignals, currentUser?.agent_name, currentUser?.display_name, recommended]);

  const handleMarkComplete = useCallback((id: string) => {
    setContent((prev) => prev.map((item) => item.id === id ? { ...item, status: 'completed' } : item));
  }, []);

  const tabs: Array<{ id: typeof activeTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'library', label: 'Library' },
    { id: 'quizzes', label: 'Quizzes' },
    { id: 'certifications', label: 'Certifications' },
    { id: 'coaching', label: 'Coaching' },
    { id: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="lc-root">
      <section className="lc-hero">
        <div>
          <div className="lc-eyebrow">Detroit Axle QA System</div>
          <h1 className="lc-title">Learning Center</h1>
          <p className="lc-subtitle">
            Centralized training, SOPs, work instructions, defect examples, quizzes, certifications,
            and audit-driven coaching built to reduce repeat errors and improve quality awareness.
          </p>
        </div>
        <input
          className="lc-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search SOPs, modules, lessons, defects..."
          aria-label="Search Learning Center"
        />
      </section>

      <div className="lc-tabs" role="tablist" aria-label="Learning Center sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`lc-tab${activeTab === tab.id ? ' active' : ''}`}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="lc-card lc-card-pad lc-span-12" style={{ marginBottom: 14 }}>
          <div className="lc-mini-copy">{notice}</div>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="lc-grid">
          <KpiCard label="Assigned" value={stats.assigned} note="Open learning items" />
          <KpiCard label="Completed" value={stats.completed} note="Finished modules" />
          <KpiCard label="Certifications" value={stats.certifications} note="Currently certified" />
          <KpiCard label="XP" value={stats.xp} note="Learning points earned" />

          <section className="lc-card lc-card-pad lc-span-8">
            <h2 className="lc-section-title">Pinned for You</h2>
            {recommended.length ? (
              <div className="lc-list">
                {recommended.slice(0, 4).map((item) => (
                  <TrainingModule key={item.id} item={item} compact onComplete={handleMarkComplete} />
                ))}
              </div>
            ) : (
              <div className="lc-empty">No pinned learning yet.</div>
            )}
          </section>

          <section className="lc-card lc-card-pad lc-span-4">
            <h2 className="lc-section-title">Audit Findings Training</h2>
            <div className="lc-list">
              {(auditSignals.length ? auditSignals : [{ metric: 'Procedure', count: 3, latestScore: 82 }, { metric: 'Notes', count: 2, latestScore: 88 }]).map((signal) => (
                <div className="lc-mini-row" key={signal.metric}>
                  <div className="lc-mini-icon">↗</div>
                  <div>
                    <div className="lc-mini-title">{signal.metric}</div>
                    <div className="lc-mini-copy">
                      {signal.count} recent finding{signal.count === 1 ? '' : 's'} linked to refresher content.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="lc-card lc-card-pad lc-span-6">
            <h2 className="lc-section-title">Quality Loop</h2>
            <div className="lc-list">
              {['Audit identifies issue', 'Learning is recommended', 'Supervisor coaches', 'Agent completes refresher', 'Performance improves'].map((label, index) => (
                <div className="lc-mini-row" key={label}>
                  <div className="lc-mini-icon">{index + 1}</div>
                  <div>
                    <div className="lc-mini-title">{label}</div>
                    <div className="lc-mini-copy">Keeps quality improvement connected to real audit outcomes.</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="lc-card lc-card-pad lc-span-6">
            <h2 className="lc-section-title">Gamification</h2>
            <div className="lc-two-col">
              <div className="lc-mini-row">
                <div className="lc-mini-icon">XP</div>
                <div>
                  <div className="lc-mini-title">Level {Math.max(1, Math.floor(stats.xp / 150) + 1)}</div>
                  <div className="lc-mini-copy">{stats.xp} XP earned from learning and certifications.</div>
                </div>
              </div>
              <div className="lc-mini-row">
                <div className="lc-mini-icon">★</div>
                <div>
                  <div className="lc-mini-title">Badges</div>
                  <div className="lc-mini-copy">Procedure Master, RL Ready, Notes Pro, and Accuracy Certified.</div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'library' && (
        <div className="lc-grid">
          <section className="lc-card lc-card-pad lc-span-12">
            <h2 className="lc-section-title">Knowledge Library</h2>
            <div className="lc-pill-row" style={{ marginBottom: 14 }}>
              {['Training', 'SOPs', 'Work Instructions', 'Defects', 'Standards', 'Onboarding', 'Lessons', 'Best Practices'].map((label) => (
                <span key={label} className="lc-pill">{label}</span>
              ))}
            </div>
            {filteredContent.length ? (
              <div className="lc-grid">
                {filteredContent.map((item) => (
                  <div className="lc-span-6" key={item.id}>
                    <TrainingModule item={item} onComplete={handleMarkComplete} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="lc-empty">No learning content matches your search.</div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'quizzes' && (
        <QuizEngine questions={quizQuestions} onComplete={(score) => setNotice(`Quiz submitted. Score: ${score.toFixed(0)}%.`)} />
      )}

      {activeTab === 'certifications' && (
        <CertificationTracker certifications={certifications} role={role} />
      )}

      {activeTab === 'coaching' && (
        <section className="lc-card lc-card-pad">
          <h2 className="lc-section-title">Supervisor Coaching Mode</h2>
          <div className="lc-list">
            {coachingNotes.map((note) => (
              <div className="lc-mini-row" key={note.id}>
                <div className="lc-mini-icon">☑</div>
                <div style={{ flex: 1 }}>
                  <div className="lc-mini-title">{note.agent_name} · {note.module_title}</div>
                  <div className="lc-mini-copy">{note.note}</div>
                </div>
                <span className="lc-pill">{note.status}</span>
              </div>
            ))}
          </div>
          {canManage && (
            <div className="lc-pill-row" style={{ marginTop: 14 }}>
              <button type="button" className="lc-btn lc-btn-primary">Assign module</button>
              <button type="button" className="lc-btn">Add coaching note</button>
              <button type="button" className="lc-btn">Track completion</button>
            </div>
          )}
        </section>
      )}

      {activeTab === 'analytics' && (
        <div className="lc-grid">
          <KpiCard label="Completion Rate" value={`${contentWithAssignments.length ? Math.round((stats.completed / contentWithAssignments.length) * 100) : 0}%`} note="Completed learning items" />
          <KpiCard label="Quiz Avg" value={`${stats.quizAverage}%`} note="Refresher quiz performance" />
          <KpiCard label="Overdue" value={stats.overdue} note="Needs follow-up" />
          <KpiCard label="Top Finding" value={auditSignals[0]?.metric || 'Procedure'} note="Most repeated topic" />
          <section className="lc-card lc-card-pad lc-span-12">
            <h2 className="lc-section-title">Learning Analytics</h2>
            <div className="lc-list">
              {[
                'Completion rates show whether assigned training is being finished on time.',
                'Quiz performance highlights topics that need better SOPs or coaching.',
                'Most failed topics connect audit findings directly to refresher modules.',
                'Training-to-quality correlation can be expanded once learning completion data grows.',
              ].map((text) => (
                <div className="lc-mini-row" key={text}>
                  <div className="lc-mini-icon">•</div>
                  <div className="lc-mini-copy">{text}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {loading && <div className="lc-empty" style={{ marginTop: 14 }}>Refreshing Learning Center...</div>}
    </div>
  );
}

function KpiCard({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <section className="lc-card lc-card-pad lc-span-3">
      <div className="lc-kpi-label">{label}</div>
      <div className="lc-kpi-value">{value}</div>
      <div className="lc-kpi-note">{note}</div>
    </section>
  );
}

export default memo(LearningCenter);
