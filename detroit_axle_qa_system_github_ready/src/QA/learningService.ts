// Type-safe Learning Center service.
// This file intentionally has no external imports so it cannot break deploys if
// a Supabase client path differs between environments. It provides strongly
// typed fallback data and local persistence hooks for LearningCenter.tsx.

export type LearningRole = "all" | "admin" | "qa" | "supervisor" | "agent";
export type QuizStatus = "draft" | "published";
export type LearningDifficulty = "beginner" | "intermediate" | "advanced";
export type DefectSeverity = "low" | "medium" | "high" | "critical";

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: LearningDifficulty;
  durationMin: number;
  xpReward: number;
  content: string;
  author: string;
  updatedAt: string;
  rating: number;
  completions: number;
  tags: string[];
  roles: LearningRole[];
  videoUrl?: string;
  steps?: string[];
  metrics?: string[];
}

export interface SOPChangeLogEntry {
  version: string;
  date: string;
  summary: string;
}

export interface SOPDocument {
  id: string;
  title: string;
  version: string;
  category: string;
  content: string;
  updatedAt: string;
  author: string;
  changeLog: SOPChangeLogEntry[];
}

export interface WorkInstruction {
  id: string;
  title: string;
  metric: string;
  category: string;
  steps: string[];
  updatedAt: string;
}

export interface DefectExample {
  id: string;
  title: string;
  metric: string;
  severity: DefectSeverity;
  whatWentWrong: string;
  correctBehavior: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  moduleId?: string | null;
  title: string;
  description?: string | null;
  questions: QuizQuestion[];
  passingScore: number;
  xpReward: number;
  status?: QuizStatus;
  audienceRoles?: LearningRole[];
  createdBy?: string | null;
  updatedAt?: string;
}

export type QuizUpsertInput = Quiz;

export interface LessonLearned {
  id: string;
  title: string;
  topic: string;
  insight: string;
  source: string;
  dateAdded: string;
  upvotes: number;
}

export interface BestPractice {
  id: string;
  title: string;
  category: string;
  quote: string;
  agentLabel: string;
  metric: string;
}

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  score: number;
  failedMetrics: string[];
}

export interface CoachingNote {
  id: string;
  supervisorId: string;
  agentId: string;
  note: string;
  metric?: string;
  sessionDate: string;
}

export interface Certification {
  id: string;
  earnedAt: string;
}

export interface UserProgress {
  completedModules: string[];
  completedQuizzes: string[];
  quizScores: Record<string, number>;
  xp: number;
  level: number;
  badges: string[];
  streak: number;
  lastActiveDate: string;
  certifications?: Certification[];
}

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  moduleId?: string | null;
  completed?: boolean;
}

export interface OnboardingTrack {
  id: string;
  label: string;
  subtitle: string;
  badgeLabel: string;
  steps: OnboardingStep[];
}

export interface AuditLink {
  metric: string;
  moduleId: string;
  failRate: number;
}

export interface LearningAssignment {
  id: string;
  agentId: string;
  moduleId: string;
  assignedBy: string;
  assignedAt: string;
}

export interface ServiceResult<T> {
  data: T;
  error: null;
}

const today = new Date().toISOString().split("T")[0];

const DEFAULT_PROGRESS: UserProgress = {
  completedModules: [],
  completedQuizzes: [],
  quizScores: {},
  xp: 0,
  level: 0,
  badges: [],
  streak: 0,
  lastActiveDate: today,
  certifications: [],
};

const MODULES: LearningModule[] = [
  {
    id: "qa-foundations",
    title: "QA Foundations",
    description: "Core Detroit Axle QA expectations, scoring flow, and audit review standards.",
    category: "Foundations",
    difficulty: "beginner",
    durationMin: 18,
    xpReward: 100,
    author: "QA Training",
    updatedAt: today,
    rating: 4.8,
    completions: 0,
    tags: ["qa", "audit", "score", "foundations"],
    roles: ["all", "admin", "qa", "supervisor", "agent"],
    metrics: ["Professionalism", "Documentation", "Product Knowledge"],
    steps: [
      "Review the interaction and evidence before scoring.",
      "Apply each metric consistently against the current rubric.",
      "Add clear coaching notes when a miss is identified.",
    ],
    content:
      "**Purpose**\nBuild a shared understanding of the QA workflow.\n\n**Key idea**\nA good audit is consistent, evidence-backed, and useful for coaching.",
  },
  {
    id: "ticket-documentation",
    title: "Ticket Documentation Standards",
    description: "How to write clear, complete, and audit-ready ticket notes.",
    category: "Documentation",
    difficulty: "intermediate",
    durationMin: 22,
    xpReward: 150,
    author: "QA Training",
    updatedAt: today,
    rating: 4.7,
    completions: 0,
    tags: ["ticket", "documentation", "notes"],
    roles: ["all", "admin", "qa", "supervisor", "agent"],
    metrics: ["Ticket Documentation"],
    steps: [
      "Identify the customer issue and action taken.",
      "Document evidence without unnecessary opinion.",
      "Confirm next steps and ownership before closing.",
    ],
    content:
      "**Documentation standard**\nTicket notes should explain what happened, what was verified, what action was taken, and what the next step is.",
  },
  {
    id: "coaching-follow-up",
    title: "Coaching Follow-Up Workflow",
    description: "How supervisors and QA staff convert audit findings into coaching actions.",
    category: "Coaching",
    difficulty: "advanced",
    durationMin: 25,
    xpReward: 200,
    author: "QA Training",
    updatedAt: today,
    rating: 4.6,
    completions: 0,
    tags: ["coaching", "supervisor", "follow-up"],
    roles: ["admin", "qa", "supervisor"],
    metrics: ["Professionalism", "First Contact Resolution"],
    content:
      "**Coaching workflow**\nUse patterns, evidence, and repeated misses to prioritize coaching. Avoid basing coaching plans on one isolated audit unless the risk is high.",
  },
];

const SOPS: SOPDocument[] = [
  {
    id: "qa-audit-release-sop",
    title: "QA Audit Review and Release SOP",
    version: "1.0",
    category: "QA Operations",
    content:
      "**Before release**\nConfirm agent, team, channel, score, and notes are accurate. Hidden audits should remain internal until ready for shared reporting.",
    updatedAt: today,
    author: "QA Operations",
    changeLog: [{ version: "1.0", date: today, summary: "Initial Learning Center SOP seed." }],
  },
];

const WORK_INSTRUCTIONS: WorkInstruction[] = [
  {
    id: "wi-score-review",
    title: "Review an Audit Score",
    metric: "Score Accuracy",
    category: "Audit Review",
    updatedAt: today,
    steps: [
      "Open the audit and confirm the selected agent and team.",
      "Review each metric outcome against the evidence.",
      "Confirm notes explain the reason for any missed points.",
    ],
  },
];

const DEFECTS: DefectExample[] = [
  {
    id: "defect-missing-ticket-summary",
    title: "Missing Ticket Summary",
    metric: "Ticket Documentation",
    severity: "medium",
    whatWentWrong: "The note says the issue was handled but does not explain what was verified or completed.",
    correctBehavior: "Document the customer issue, verification performed, action taken, and next step.",
  },
];

const QUIZZES: Quiz[] = [
  {
    id: "qa-foundations-quiz",
    moduleId: "qa-foundations",
    title: "QA Foundations Quiz",
    description: "Check your understanding of basic audit expectations.",
    passingScore: 70,
    xpReward: 75,
    status: "published",
    audienceRoles: ["all", "agent"],
    updatedAt: today,
    questions: [
      {
        id: "q1",
        question: "What should a strong audit note be based on?",
        options: ["Assumption", "Evidence", "Speed only", "Personal preference"],
        correctIndex: 1,
        explanation: "Audit notes should be based on evidence from the customer interaction and supporting records.",
      },
      {
        id: "q2",
        question: "When should hidden/shared state be reviewed?",
        options: ["Before release", "Only after reports export", "Never", "Only after logout"],
        correctIndex: 0,
        explanation: "Visibility should be reviewed before audits are released or shared broadly.",
      },
    ],
  },
];

const LESSONS: LessonLearned[] = [
  {
    id: "lesson-clear-notes",
    title: "Clear notes reduce follow-up questions",
    topic: "Documentation",
    insight: "Evidence-backed notes make audits easier to review and coaching easier to accept.",
    source: "QA calibration",
    dateAdded: today,
    upvotes: 0,
  },
];

const BEST_PRACTICES: BestPractice[] = [
  {
    id: "bp-confirm-next-step",
    title: "Confirm the next step",
    category: "Customer Experience",
    quote: "Close the loop by documenting the next action and who owns it.",
    agentLabel: "QA Training",
    metric: "Professionalism",
  },
];

const TEAM_MEMBERS: TeamMember[] = [
  { id: "agent-1", name: "Sample Agent", initials: "SA", score: 82, failedMetrics: ["Ticket Documentation"] },
];

const AUDIT_LINKS: AuditLink[] = [
  { metric: "Ticket Documentation", moduleId: "ticket-documentation", failRate: 18 },
  { metric: "Professionalism", moduleId: "qa-foundations", failRate: 9 },
];

const ONBOARDING_TRACKS: OnboardingTrack[] = [
  {
    id: "agent-onboarding",
    label: "Agent Onboarding",
    subtitle: "Start here for QA expectations and self-review basics.",
    badgeLabel: "Agent",
    steps: [
      { id: "agent-step-1", title: "Complete QA Foundations", description: "Learn the core audit expectations.", moduleId: "qa-foundations" },
      { id: "agent-step-2", title: "Review Ticket Documentation", description: "Understand audit-ready notes.", moduleId: "ticket-documentation" },
    ],
  },
  {
    id: "supervisor-onboarding",
    label: "Supervisor Onboarding",
    subtitle: "Coaching, assignments, and team learning workflow.",
    badgeLabel: "Supervisor",
    steps: [
      { id: "sup-step-1", title: "Complete Coaching Follow-Up", description: "Learn how findings become coaching actions.", moduleId: "coaching-follow-up" },
    ],
  },
];

function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can fail in private/restricted contexts; the UI should still work.
  }
}

function progressKey(userId: string): string {
  return `da-learning-progress:${userId}`;
}

function upvoteKey(userId: string): string {
  return `da-learning-upvotes:${userId}`;
}

function assignmentKey(agentId: string): string {
  return `da-learning-assignments:${agentId}`;
}

function notesKey(supervisorId: string): string {
  return `da-learning-notes:${supervisorId}`;
}

const CUSTOM_QUIZZES_KEY = "da-learning-custom-quizzes";
const DELETED_QUIZZES_KEY = "da-learning-deleted-quizzes";

function createLocalId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 9);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function normalizeQuiz(quiz: Quiz): Quiz {
  return {
    ...quiz,
    moduleId: quiz.moduleId ?? null,
    description: quiz.description ?? "",
    passingScore: Number.isFinite(quiz.passingScore) ? quiz.passingScore : 70,
    xpReward: Number.isFinite(quiz.xpReward) ? quiz.xpReward : 0,
    status: quiz.status ?? "published",
    audienceRoles: quiz.audienceRoles && quiz.audienceRoles.length > 0 ? quiz.audienceRoles : ["all", "agent"],
    updatedAt: quiz.updatedAt ?? today,
    questions: quiz.questions.map((question, index) => {
      const options = question.options.length >= 2 ? question.options : ["Option A", "Option B"];
      return {
        ...question,
        id: question.id || createLocalId(`q${index + 1}`),
        options,
        correctIndex: Math.max(0, Math.min(question.correctIndex, Math.max(options.length - 1, 0))),
        explanation: question.explanation ?? "",
      };
    }),
  };
}

function readCustomQuizzes(): Quiz[] {
  return readJson<Quiz[]>(CUSTOM_QUIZZES_KEY, []).map(normalizeQuiz);
}

function writeCustomQuizzes(quizzes: Quiz[]): void {
  writeJson(CUSTOM_QUIZZES_KEY, quizzes.map(normalizeQuiz));
}

function readDeletedQuizIds(): Set<string> {
  return new Set(readJson<string[]>(DELETED_QUIZZES_KEY, []));
}

function writeDeletedQuizIds(ids: Set<string>): void {
  writeJson(DELETED_QUIZZES_KEY, Array.from(ids));
}

export async function fetchLearningModules(): Promise<ServiceResult<LearningModule[]>> {
  return ok(MODULES);
}

export async function fetchSOPs(): Promise<ServiceResult<SOPDocument[]>> {
  return ok(SOPS);
}

export async function fetchWorkInstructions(): Promise<ServiceResult<WorkInstruction[]>> {
  return ok(WORK_INSTRUCTIONS);
}

export async function fetchDefectExamples(): Promise<ServiceResult<DefectExample[]>> {
  return ok(DEFECTS);
}

export async function fetchQuizzes(): Promise<ServiceResult<Quiz[]>> {
  const deletedIds = readDeletedQuizIds();
  const staticQuizzes = QUIZZES.map(normalizeQuiz).filter((quiz) => !deletedIds.has(quiz.id));
  const customQuizzes = readCustomQuizzes().filter((quiz) => !deletedIds.has(quiz.id));
  const merged = new Map<string, Quiz>();
  staticQuizzes.forEach((quiz) => merged.set(quiz.id, quiz));
  customQuizzes.forEach((quiz) => merged.set(quiz.id, quiz));
  return ok(Array.from(merged.values()).sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")));
}

export async function upsertQuiz(quiz: QuizUpsertInput, userId?: string): Promise<ServiceResult<Quiz>> {
  const now = new Date().toISOString();
  const id = quiz.id?.trim() || createLocalId("quiz");
  const normalized = normalizeQuiz({
    ...quiz,
    id,
    createdBy: quiz.createdBy ?? userId ?? null,
    updatedAt: now,
  });

  const customQuizzes = readCustomQuizzes();
  const next = [normalized, ...customQuizzes.filter((item) => item.id !== normalized.id)];
  writeCustomQuizzes(next);

  const deletedIds = readDeletedQuizIds();
  deletedIds.delete(normalized.id);
  writeDeletedQuizIds(deletedIds);

  return ok(normalized);
}

export async function deleteQuiz(quizId: string): Promise<ServiceResult<boolean>> {
  const customQuizzes = readCustomQuizzes().filter((quiz) => quiz.id !== quizId);
  writeCustomQuizzes(customQuizzes);

  const deletedIds = readDeletedQuizIds();
  deletedIds.add(quizId);
  writeDeletedQuizIds(deletedIds);

  return ok(true);
}

export async function fetchLessonsLearned(): Promise<ServiceResult<LessonLearned[]>> {
  return ok(LESSONS);
}

export async function fetchBestPractices(): Promise<ServiceResult<BestPractice[]>> {
  return ok(BEST_PRACTICES);
}

export async function fetchOrCreateUserProgress(userId: string): Promise<ServiceResult<UserProgress>> {
  const stored = readJson<UserProgress>(progressKey(userId), DEFAULT_PROGRESS);
  const merged: UserProgress = {
    ...DEFAULT_PROGRESS,
    ...stored,
    completedModules: stored.completedModules ?? [],
    completedQuizzes: stored.completedQuizzes ?? [],
    quizScores: stored.quizScores ?? {},
    badges: stored.badges ?? [],
    certifications: stored.certifications ?? [],
  };
  writeJson(progressKey(userId), merged);
  return ok(merged);
}

export async function upsertUserProgress(userId: string, progress: UserProgress): Promise<ServiceResult<UserProgress>> {
  writeJson(progressKey(userId), progress);
  return ok(progress);
}

export async function fetchUserUpvotes(userId: string): Promise<ServiceResult<string[]>> {
  return ok(readJson<string[]>(upvoteKey(userId), []));
}

export async function toggleLessonUpvote(
  userId: string,
  lessonId: string,
  alreadyUpvoted: boolean
): Promise<ServiceResult<boolean>> {
  const current = new Set(readJson<string[]>(upvoteKey(userId), []));
  if (alreadyUpvoted) current.delete(lessonId);
  else current.add(lessonId);
  writeJson(upvoteKey(userId), Array.from(current));
  return ok(!alreadyUpvoted);
}

export async function fetchTeamMembers(_supervisorId?: string): Promise<ServiceResult<TeamMember[]>> {
  return ok(TEAM_MEMBERS);
}

export async function fetchCoachingNotes(supervisorId: string): Promise<ServiceResult<CoachingNote[]>> {
  return ok(readJson<CoachingNote[]>(notesKey(supervisorId), []));
}

export async function upsertCoachingNote(input: {
  supervisorId: string;
  agentId: string;
  note: string;
  metric?: string;
}): Promise<ServiceResult<CoachingNote>> {
  const existing = readJson<CoachingNote[]>(notesKey(input.supervisorId), []);
  const nextNote: CoachingNote = {
    id: `${input.supervisorId}:${input.agentId}`,
    supervisorId: input.supervisorId,
    agentId: input.agentId,
    note: input.note,
    metric: input.metric,
    sessionDate: new Date().toLocaleDateString(),
  };
  const next = [nextNote, ...existing.filter((n) => n.agentId !== input.agentId)];
  writeJson(notesKey(input.supervisorId), next);
  return ok(nextNote);
}

export async function createAssignment(input: {
  agentId: string;
  moduleId: string;
  assignedBy: string;
}): Promise<ServiceResult<LearningAssignment>> {
  const assignment: LearningAssignment = {
    id: `${input.agentId}:${input.moduleId}`,
    agentId: input.agentId,
    moduleId: input.moduleId,
    assignedBy: input.assignedBy,
    assignedAt: new Date().toISOString(),
  };
  const existing = readJson<LearningAssignment[]>(assignmentKey(input.agentId), []);
  const next = [assignment, ...existing.filter((a) => a.moduleId !== input.moduleId)];
  writeJson(assignmentKey(input.agentId), next);
  return ok(assignment);
}

export async function fetchAgentAssignments(agentId: string): Promise<ServiceResult<LearningAssignment[]>> {
  return ok(readJson<LearningAssignment[]>(assignmentKey(agentId), []));
}

export async function fetchRecommendedModuleIds(_userId: string): Promise<ServiceResult<string[]>> {
  return ok(["ticket-documentation"]);
}

export async function fetchAuditLinks(_userId?: string): Promise<ServiceResult<AuditLink[]>> {
  return ok(AUDIT_LINKS);
}

export async function checkAndGrantCertifications(
  userId: string,
  progress: UserProgress
): Promise<ServiceResult<Certification[]>> {
  const certifications = [...(progress.certifications ?? [])];
  const ensure = (id: string) => {
    if (!certifications.some((cert) => cert.id === id)) {
      certifications.push({ id, earnedAt: new Date().toISOString() });
    }
  };

  if (progress.completedModules.length >= 1) ensure("qa-foundations");
  if (Object.values(progress.quizScores).some((score) => score === 100)) ensure("perfect-scorer");
  if (progress.xp >= 500) ensure("module-master");

  const updated: UserProgress = { ...progress, certifications };
  writeJson(progressKey(userId), updated);
  return ok(certifications);
}

export async function fetchOnboardingTracks(role: string): Promise<ServiceResult<OnboardingTrack[]>> {
  if (role === "supervisor") return ok(ONBOARDING_TRACKS);
  if (role === "agent") return ok(ONBOARDING_TRACKS.filter((track) => track.badgeLabel === "Agent"));
  return ok(ONBOARDING_TRACKS);
}

export async function incrementModuleCompletions(_moduleId: string): Promise<ServiceResult<boolean>> {
  return ok(true);
}
