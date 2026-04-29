// Type-safe Learning Center service with local persistence fallback.
// Replace these localStorage hooks with Supabase calls later without changing the UI layer.

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

export interface QualityStandard {
  id: string;
  name: string;
  min: number;
  color: string;
  desc: string;
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

const QUALITY_STANDARDS: QualityStandard[] = [
  {
    id: "excellent",
    name: "Excellent",
    min: 95,
    color: "var(--accent-emerald)",
    desc: "Exceeds all expectations. Exemplary service, complete documentation, proactive solutions.",
  },
  {
    id: "good",
    name: "Good",
    min: 85,
    color: "var(--accent-blue)",
    desc: "Meets all standards. Minor areas for improvement but overall strong performance.",
  },
  {
    id: "needs-improvement",
    name: "Needs Improvement",
    min: 70,
    color: "var(--accent-amber)",
    desc: "Meets minimum requirements but has notable gaps. Coaching recommended.",
  },
  {
    id: "unsatisfactory",
    name: "Unsatisfactory",
    min: 0,
    color: "var(--accent-rose)",
    desc: "Does not meet minimum standards. Immediate retraining required.",
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

function progressKey(userId: string): string { return `da-learning-progress:${userId}`; }
function upvoteKey(userId: string): string { return `da-learning-upvotes:${userId}`; }
function assignmentKey(agentId: string): string { return `da-learning-assignments:${agentId}`; }
function notesKey(supervisorId: string): string { return `da-learning-notes:${supervisorId}`; }

function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function readCustom<T>(key: string): T[] { return readJson<T[]>(key, []); }
function writeCustom<T>(key: string, items: T[]): void { writeJson(key, items); }
function readDeleted(key: string): Set<string> { return new Set(readJson<string[]>(key, [])); }
function writeDeleted(key: string, ids: Set<string>): void { writeJson(key, Array.from(ids)); }

function mergeItems<T extends { id: string }>(base: T[], custom: T[], deletedIds: Set<string>): T[] {
  const merged = new Map<string, T>();
  base.filter((item) => !deletedIds.has(item.id)).forEach((item) => merged.set(item.id, item));
  custom.filter((item) => !deletedIds.has(item.id)).forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

function saveItem<T extends { id: string }>(customKey: string, deletedKey: string, item: T): T {
  const next = [item, ...readCustom<T>(customKey).filter((existing) => existing.id !== item.id)];
  writeCustom(customKey, next);
  const deletedIds = readDeleted(deletedKey);
  deletedIds.delete(item.id);
  writeDeleted(deletedKey, deletedIds);
  return item;
}

function removeItem(customKey: string, deletedKey: string, id: string): void {
  writeCustom(customKey, readCustom<{ id: string }>(customKey).filter((item) => item.id !== id));
  const deletedIds = readDeleted(deletedKey);
  deletedIds.add(id);
  writeDeleted(deletedKey, deletedIds);
}

const customKeys = {
  modules: "da-learning-custom-modules",
  sops: "da-learning-custom-sops",
  workInstructions: "da-learning-custom-work-instructions",
  defects: "da-learning-custom-defects",
  quizzes: "da-learning-custom-quizzes",
  bestPractices: "da-learning-custom-best-practices",
  standards: "da-learning-custom-quality-standards",
  onboarding: "da-learning-custom-onboarding-tracks",
  teamMembers: "da-learning-custom-team-members",
};

const deletedKeys = {
  modules: "da-learning-deleted-modules",
  sops: "da-learning-deleted-sops",
  workInstructions: "da-learning-deleted-work-instructions",
  defects: "da-learning-deleted-defects",
  quizzes: "da-learning-deleted-quizzes",
  bestPractices: "da-learning-deleted-best-practices",
  standards: "da-learning-deleted-quality-standards",
  onboarding: "da-learning-deleted-onboarding-tracks",
  teamMembers: "da-learning-deleted-team-members",
};

function csv(value: string[] | undefined): string[] { return value ?? []; }

function normalizeModule(module: LearningModule): LearningModule {
  return {
    ...module,
    id: module.id?.trim() || createLocalId("module"),
    title: module.title?.trim() || "Untitled module",
    description: module.description ?? "",
    category: module.category || "General",
    difficulty: module.difficulty ?? "beginner",
    durationMin: Number(module.durationMin) || 0,
    xpReward: Number(module.xpReward) || 0,
    content: module.content ?? "",
    author: module.author || "QA Training",
    updatedAt: new Date().toISOString().split("T")[0],
    rating: Number(module.rating) || 0,
    completions: Number(module.completions) || 0,
    tags: csv(module.tags),
    roles: module.roles && module.roles.length > 0 ? module.roles : ["all"],
    steps: csv(module.steps),
    metrics: csv(module.metrics),
  };
}

function normalizeSOP(sop: SOPDocument): SOPDocument {
  return {
    ...sop,
    id: sop.id?.trim() || createLocalId("sop"),
    title: sop.title?.trim() || "Untitled SOP",
    version: sop.version || "1.0",
    category: sop.category || "General",
    content: sop.content ?? "",
    updatedAt: new Date().toISOString().split("T")[0],
    author: sop.author || "QA Training",
    changeLog: sop.changeLog ?? [],
  };
}

function normalizeWorkInstruction(item: WorkInstruction): WorkInstruction {
  return {
    ...item,
    id: item.id?.trim() || createLocalId("work-instruction"),
    title: item.title?.trim() || "Untitled work instruction",
    metric: item.metric || "General",
    category: item.category || "General",
    steps: csv(item.steps),
    updatedAt: new Date().toISOString().split("T")[0],
  };
}

function normalizeDefect(item: DefectExample): DefectExample {
  return {
    ...item,
    id: item.id?.trim() || createLocalId("defect"),
    title: item.title?.trim() || "Untitled defect example",
    metric: item.metric || "General",
    severity: item.severity ?? "medium",
    whatWentWrong: item.whatWentWrong ?? "",
    correctBehavior: item.correctBehavior ?? "",
  };
}

function normalizeQuiz(quiz: Quiz): Quiz {
  return {
    ...quiz,
    id: quiz.id?.trim() || createLocalId("quiz"),
    moduleId: quiz.moduleId ?? null,
    title: quiz.title?.trim() || "Untitled quiz",
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

function normalizeBestPractice(item: BestPractice): BestPractice {
  return {
    ...item,
    id: item.id?.trim() || createLocalId("best-practice"),
    title: item.title?.trim() || "Untitled best practice",
    category: item.category || "General",
    quote: item.quote ?? "",
    agentLabel: item.agentLabel || "QA Training",
    metric: item.metric || "General",
  };
}

function normalizeQualityStandard(item: QualityStandard): QualityStandard {
  return {
    ...item,
    id: item.id?.trim() || createLocalId("standard"),
    name: item.name?.trim() || "Untitled standard",
    min: Math.max(0, Math.min(Number(item.min) || 0, 100)),
    color: item.color || "var(--accent-blue)",
    desc: item.desc ?? "",
  };
}

function normalizeOnboardingTrack(item: OnboardingTrack): OnboardingTrack {
  return {
    ...item,
    id: item.id?.trim() || createLocalId("onboarding"),
    label: item.label?.trim() || "Untitled onboarding track",
    subtitle: item.subtitle ?? "",
    badgeLabel: item.badgeLabel || "General",
    steps: (item.steps ?? []).map((step, index) => ({
      ...step,
      id: step.id || createLocalId(`onboarding-step-${index + 1}`),
      title: step.title?.trim() || `Step ${index + 1}`,
      description: step.description ?? "",
      moduleId: step.moduleId || null,
    })),
  };
}

function normalizeTeamMember(item: TeamMember): TeamMember {
  return {
    ...item,
    id: item.id?.trim() || createLocalId("team-member"),
    name: item.name?.trim() || "New team member",
    initials: item.initials?.trim() || "TM",
    score: Math.max(0, Math.min(Number(item.score) || 0, 100)),
    failedMetrics: csv(item.failedMetrics),
  };
}

export async function fetchLearningModules(): Promise<ServiceResult<LearningModule[]>> {
  return ok(mergeItems(MODULES, readCustom<LearningModule>(customKeys.modules).map(normalizeModule), readDeleted(deletedKeys.modules)));
}
export async function upsertLearningModule(item: LearningModule): Promise<ServiceResult<LearningModule>> {
  return ok(saveItem(customKeys.modules, deletedKeys.modules, normalizeModule(item)));
}
export async function deleteLearningModule(id: string): Promise<ServiceResult<boolean>> {
  removeItem(customKeys.modules, deletedKeys.modules, id); return ok(true);
}

export async function fetchSOPs(): Promise<ServiceResult<SOPDocument[]>> {
  return ok(mergeItems(SOPS, readCustom<SOPDocument>(customKeys.sops).map(normalizeSOP), readDeleted(deletedKeys.sops)));
}
export async function upsertSOP(item: SOPDocument): Promise<ServiceResult<SOPDocument>> {
  return ok(saveItem(customKeys.sops, deletedKeys.sops, normalizeSOP(item)));
}
export async function deleteSOP(id: string): Promise<ServiceResult<boolean>> {
  removeItem(customKeys.sops, deletedKeys.sops, id); return ok(true);
}

export async function fetchWorkInstructions(): Promise<ServiceResult<WorkInstruction[]>> {
  return ok(mergeItems(WORK_INSTRUCTIONS, readCustom<WorkInstruction>(customKeys.workInstructions).map(normalizeWorkInstruction), readDeleted(deletedKeys.workInstructions)));
}
export async function upsertWorkInstruction(item: WorkInstruction): Promise<ServiceResult<WorkInstruction>> {
  return ok(saveItem(customKeys.workInstructions, deletedKeys.workInstructions, normalizeWorkInstruction(item)));
}
export async function deleteWorkInstruction(id: string): Promise<ServiceResult<boolean>> {
  removeItem(customKeys.workInstructions, deletedKeys.workInstructions, id); return ok(true);
}

export async function fetchDefectExamples(): Promise<ServiceResult<DefectExample[]>> {
  return ok(mergeItems(DEFECTS, readCustom<DefectExample>(customKeys.defects).map(normalizeDefect), readDeleted(deletedKeys.defects)));
}
export async function upsertDefectExample(item: DefectExample): Promise<ServiceResult<DefectExample>> {
  return ok(saveItem(customKeys.defects, deletedKeys.defects, normalizeDefect(item)));
}
export async function deleteDefectExample(id: string): Promise<ServiceResult<boolean>> {
  removeItem(customKeys.defects, deletedKeys.defects, id); return ok(true);
}

export async function fetchQuizzes(): Promise<ServiceResult<Quiz[]>> {
  const deletedIds = readDeleted(deletedKeys.quizzes);
  const merged = mergeItems(QUIZZES.map(normalizeQuiz), readCustom<Quiz>(customKeys.quizzes).map(normalizeQuiz), deletedIds);
  return ok(merged.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")));
}
export async function upsertQuiz(quiz: QuizUpsertInput, userId?: string): Promise<ServiceResult<Quiz>> {
  const normalized = normalizeQuiz({ ...quiz, createdBy: quiz.createdBy ?? userId ?? null, updatedAt: new Date().toISOString() });
  return ok(saveItem(customKeys.quizzes, deletedKeys.quizzes, normalized));
}
export async function deleteQuiz(id: string): Promise<ServiceResult<boolean>> {
  removeItem(customKeys.quizzes, deletedKeys.quizzes, id); return ok(true);
}

export async function fetchLessonsLearned(): Promise<ServiceResult<LessonLearned[]>> { return ok(LESSONS); }

export async function fetchBestPractices(): Promise<ServiceResult<BestPractice[]>> {
  return ok(mergeItems(BEST_PRACTICES, readCustom<BestPractice>(customKeys.bestPractices).map(normalizeBestPractice), readDeleted(deletedKeys.bestPractices)));
}
export async function upsertBestPractice(item: BestPractice): Promise<ServiceResult<BestPractice>> {
  return ok(saveItem(customKeys.bestPractices, deletedKeys.bestPractices, normalizeBestPractice(item)));
}
export async function deleteBestPractice(id: string): Promise<ServiceResult<boolean>> {
  removeItem(customKeys.bestPractices, deletedKeys.bestPractices, id); return ok(true);
}

export async function fetchQualityStandards(): Promise<ServiceResult<QualityStandard[]>> {
  return ok(mergeItems(QUALITY_STANDARDS, readCustom<QualityStandard>(customKeys.standards).map(normalizeQualityStandard), readDeleted(deletedKeys.standards)).sort((a, b) => b.min - a.min));
}
export async function upsertQualityStandard(item: QualityStandard): Promise<ServiceResult<QualityStandard>> {
  return ok(saveItem(customKeys.standards, deletedKeys.standards, normalizeQualityStandard(item)));
}
export async function deleteQualityStandard(id: string): Promise<ServiceResult<boolean>> {
  removeItem(customKeys.standards, deletedKeys.standards, id); return ok(true);
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
  writeJson(progressKey(userId), progress); return ok(progress);
}
export async function fetchUserUpvotes(userId: string): Promise<ServiceResult<string[]>> { return ok(readJson<string[]>(upvoteKey(userId), [])); }
export async function toggleLessonUpvote(userId: string, lessonId: string, alreadyUpvoted: boolean): Promise<ServiceResult<boolean>> {
  const current = new Set(readJson<string[]>(upvoteKey(userId), []));
  if (alreadyUpvoted) current.delete(lessonId); else current.add(lessonId);
  writeJson(upvoteKey(userId), Array.from(current)); return ok(!alreadyUpvoted);
}

export async function fetchTeamMembers(_supervisorId?: string): Promise<ServiceResult<TeamMember[]>> {
  return ok(mergeItems(TEAM_MEMBERS, readCustom<TeamMember>(customKeys.teamMembers).map(normalizeTeamMember), readDeleted(deletedKeys.teamMembers)));
}
export async function upsertTeamMember(item: TeamMember): Promise<ServiceResult<TeamMember>> {
  return ok(saveItem(customKeys.teamMembers, deletedKeys.teamMembers, normalizeTeamMember(item)));
}
export async function deleteTeamMember(id: string): Promise<ServiceResult<boolean>> {
  removeItem(customKeys.teamMembers, deletedKeys.teamMembers, id); return ok(true);
}

export async function fetchCoachingNotes(supervisorId: string): Promise<ServiceResult<CoachingNote[]>> {
  return ok(readJson<CoachingNote[]>(notesKey(supervisorId), []));
}
export async function upsertCoachingNote(input: { supervisorId: string; agentId: string; note: string; metric?: string; id?: string }): Promise<ServiceResult<CoachingNote>> {
  const existing = readJson<CoachingNote[]>(notesKey(input.supervisorId), []);
  const nextNote: CoachingNote = {
    id: input.id || createLocalId("coaching-note"),
    supervisorId: input.supervisorId,
    agentId: input.agentId,
    note: input.note,
    metric: input.metric,
    sessionDate: new Date().toLocaleDateString(),
  };
  const next = [nextNote, ...existing.filter((note) => note.id !== nextNote.id)];
  writeJson(notesKey(input.supervisorId), next);
  return ok(nextNote);
}
export async function deleteCoachingNote(supervisorId: string, noteId: string): Promise<ServiceResult<boolean>> {
  writeJson(notesKey(supervisorId), readJson<CoachingNote[]>(notesKey(supervisorId), []).filter((note) => note.id !== noteId));
  return ok(true);
}

export async function createAssignment(input: { agentId: string; moduleId: string; assignedBy: string }): Promise<ServiceResult<LearningAssignment>> {
  const assignment: LearningAssignment = { id: `${input.agentId}:${input.moduleId}`, agentId: input.agentId, moduleId: input.moduleId, assignedBy: input.assignedBy, assignedAt: new Date().toISOString() };
  const existing = readJson<LearningAssignment[]>(assignmentKey(input.agentId), []);
  writeJson(assignmentKey(input.agentId), [assignment, ...existing.filter((a) => a.moduleId !== input.moduleId)]);
  return ok(assignment);
}
export async function fetchAgentAssignments(agentId: string): Promise<ServiceResult<LearningAssignment[]>> { return ok(readJson<LearningAssignment[]>(assignmentKey(agentId), [])); }
export async function fetchRecommendedModuleIds(_userId: string): Promise<ServiceResult<string[]>> { return ok(["ticket-documentation"]); }
export async function fetchAuditLinks(_userId?: string): Promise<ServiceResult<AuditLink[]>> { return ok(AUDIT_LINKS); }

export async function checkAndGrantCertifications(userId: string, progress: UserProgress): Promise<ServiceResult<Certification[]>> {
  const certifications = [...(progress.certifications ?? [])];
  const ensure = (id: string) => {
    if (!certifications.some((cert) => cert.id === id)) certifications.push({ id, earnedAt: new Date().toISOString() });
  };
  if (progress.completedModules.length >= 1) ensure("qa-foundations");
  if (Object.values(progress.quizScores).some((score) => score === 100)) ensure("perfect-scorer");
  if (progress.xp >= 500) ensure("module-master");
  const updated: UserProgress = { ...progress, certifications };
  writeJson(progressKey(userId), updated);
  return ok(certifications);
}

export async function fetchOnboardingTracks(role: string): Promise<ServiceResult<OnboardingTrack[]>> {
  const tracks = mergeItems(ONBOARDING_TRACKS, readCustom<OnboardingTrack>(customKeys.onboarding).map(normalizeOnboardingTrack), readDeleted(deletedKeys.onboarding));
  if (role === "agent") return ok(tracks.filter((track) => track.badgeLabel === "Agent"));
  return ok(tracks);
}
export async function upsertOnboardingTrack(item: OnboardingTrack): Promise<ServiceResult<OnboardingTrack>> {
  return ok(saveItem(customKeys.onboarding, deletedKeys.onboarding, normalizeOnboardingTrack(item)));
}
export async function deleteOnboardingTrack(id: string): Promise<ServiceResult<boolean>> {
  removeItem(customKeys.onboarding, deletedKeys.onboarding, id); return ok(true);
}

export async function incrementModuleCompletions(_moduleId: string): Promise<ServiceResult<boolean>> { return ok(true); }
