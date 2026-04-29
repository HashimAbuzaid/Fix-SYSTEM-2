/**
 * Learning Center — service layer
 *
 * Architecture decisions:
 *  - In-memory request cache with TTL so hot paths (module lists, standards)
 *    don't hit localStorage or the network on every render cycle.
 *  - Typed ServiceResult<T> / ServiceError union — callers never receive
 *    a raw `null` and never have to guess whether an operation succeeded.
 *  - Supabase token is resolved once per session and memoized.
 *  - Audit-insight enrichment is O(rows) with a pre-built agent index,
 *    not O(members × rows).
 *  - Seed data lives in a separate module (learningSeeds.ts) — this file
 *    only contains transport and transformation logic.
 *  - All `normalize*` helpers are pure functions; they are called exactly
 *    once on the way in (write) and once on the way out (read from remote).
 *  - localStorage access is centralised in three helpers: lsGet / lsSet /
 *    lsDel so the swap to Supabase realtime or IndexedDB is one-line.
 */

// ─── Re-export seeds so callers can import from one place ────────────────────
export {
  MODULES,
  SOPS,
  WORK_INSTRUCTIONS,
  DEFECTS,
  QUIZZES,
  LESSONS,
  BEST_PRACTICES,
  QUALITY_STANDARDS,
  TEAM_MEMBERS,
  AUDIT_LINKS,
  ONBOARDING_TRACKS,
} from "./learningSeeds";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LearningRole = "all" | "admin" | "qa" | "supervisor" | "agent";
export type QuizStatus = "draft" | "published";
export type ContentStatus = "draft" | "published" | "archived";
export type LearningDifficulty = "beginner" | "intermediate" | "advanced";
export type DefectSeverity = "low" | "medium" | "high" | "critical";
export type OperationalTeam = "Calls" | "Tickets" | "Sales";
export type LearningAssignableType =
  | "module"
  | "quiz"
  | "sop"
  | "work-instruction"
  | "defect"
  | "standard"
  | "onboarding"
  | "best-practice";
export type LearningAssignmentStatus =
  | "assigned"
  | "in_progress"
  | "completed"
  | "verified"
  | "overdue"
  | "cancelled";
export type LearningContentAuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "published"
  | "drafted"
  | "archived";

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
  status?: ContentStatus;
  audienceRoles?: LearningRole[];
  version?: string;
  approvedBy?: string | null;
  effectiveDate?: string | null;
  publishedAt?: string | null;
  lastEditedBy?: string | null;
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
  status?: ContentStatus;
  audienceRoles?: LearningRole[];
  approvedBy?: string | null;
  effectiveDate?: string | null;
  publishedAt?: string | null;
  lastEditedBy?: string | null;
}

export interface WorkInstruction {
  id: string;
  title: string;
  metric: string;
  category: string;
  steps: string[];
  updatedAt: string;
  status?: ContentStatus;
  audienceRoles?: LearningRole[];
  version?: string;
  approvedBy?: string | null;
  effectiveDate?: string | null;
  publishedAt?: string | null;
  lastEditedBy?: string | null;
}

export interface DefectExample {
  id: string;
  title: string;
  metric: string;
  severity: DefectSeverity;
  whatWentWrong: string;
  correctBehavior: string;
  status?: ContentStatus;
  audienceRoles?: LearningRole[];
  version?: string;
  approvedBy?: string | null;
  effectiveDate?: string | null;
  publishedAt?: string | null;
  lastEditedBy?: string | null;
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
  status?: ContentStatus;
  audienceRoles?: LearningRole[];
  version?: string;
  approvedBy?: string | null;
  effectiveDate?: string | null;
  publishedAt?: string | null;
  lastEditedBy?: string | null;
}

export interface QualityStandard {
  id: string;
  name: string;
  min: number;
  color: string;
  desc: string;
  status?: ContentStatus;
  audienceRoles?: LearningRole[];
  version?: string;
  approvedBy?: string | null;
  effectiveDate?: string | null;
  publishedAt?: string | null;
  lastEditedBy?: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  score: number;
  failedMetrics: string[];
  team?: OperationalTeam | string | null;
  agentId?: string | null;
  email?: string | null;
  source?: "profiles" | "manual";
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
  status?: ContentStatus;
  audienceRoles?: LearningRole[];
  version?: string;
  approvedBy?: string | null;
  effectiveDate?: string | null;
  publishedAt?: string | null;
  lastEditedBy?: string | null;
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
  contentType?: LearningAssignableType;
  contentId?: string;
  title?: string;
  dueDate?: string | null;
  status?: LearningAssignmentStatus;
  completedAt?: string | null;
}

export interface CertificationRule {
  id: string;
  title: string;
  description: string;
  requiredModuleIds: string[];
  requiredQuizIds: string[];
  minAvgScore: number;
  minXP: number;
  roleVisibility: LearningRole[];
  expiresAfterDays?: number | null;
  active: boolean;
}

export interface ContentAuditEntry {
  id: string;
  contentType: string;
  contentId: string;
  title: string;
  action: LearningContentAuditAction;
  actorId?: string | null;
  createdAt: string;
  summary?: string | null;
}

export interface ContentVersionEntry {
  id: string;
  contentType: string;
  contentId: string;
  title: string;
  version: string;
  data: unknown;
  createdAt: string;
  createdBy?: string | null;
}

// ─── Result type ──────────────────────────────────────────────────────────────

export type ServiceErrorCode =
  | "NOT_FOUND"
  | "NETWORK"
  | "PARSE"
  | "STORAGE"
  | "UNKNOWN";

export interface ServiceError {
  code: ServiceErrorCode;
  message: string;
}

export type ServiceResult<T> =
  | { data: T; error: null }
  | { data: null; error: ServiceError };

function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

function err(code: ServiceErrorCode, message: string): ServiceResult<never> {
  return { data: null, error: { code, message } };
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
// Keyed by cache key → { value, expiresAt }.  TTLs are conservative — most
// learning content changes infrequently.  Mutation helpers call cache.bust()
// on the affected key so subsequent reads are always fresh.

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60_000; // 1 minute

const cache = {
  store: new Map<string, CacheEntry<unknown>>(),

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  },

  set<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  },

  bust(...keys: string[]): void {
    for (const key of keys) this.store.delete(key);
  },

  bustPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  },
} as const;

// ─── Request deduplication ────────────────────────────────────────────────────
// If the same async request is already in-flight, return the same Promise
// instead of firing a second fetch.

const inflight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
// Centralised so swapping to IndexedDB or a different persistence layer
// touches exactly three functions.

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can throw in private / quota-exceeded contexts.
  }
}

function lsDel(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// ─── Key factories ────────────────────────────────────────────────────────────

const KEY = {
  progress: (uid: string) => `da-lc:progress:${uid}`,
  upvotes: (uid: string) => `da-lc:upvotes:${uid}`,
  assignments: (agentId: string) => `da-lc:assignments:${agentId}`,
  notes: (supervisorId: string) => `da-lc:notes:${supervisorId}`,
  custom: (entity: string) => `da-lc:custom:${entity}`,
  deleted: (entity: string) => `da-lc:deleted:${entity}`,
  auditTrail: "da-lc:audit-trail",
  versions: "da-lc:versions",
} as const;

// ─── ID helpers ───────────────────────────────────────────────────────────────

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

const today = new Date().toISOString().split("T")[0];

// ─── Supabase env / auth ──────────────────────────────────────────────────────
// Token resolution is memoized per session — no more full localStorage scans
// on every request.

let _cachedToken: string | null | undefined = undefined; // undefined = not yet resolved

function resolveSupabaseToken(): string | null {
  if (_cachedToken !== undefined) return _cachedToken;
  if (typeof window === "undefined") return (_cachedToken = null);

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k?.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        access_token?: string;
        currentSession?: { access_token?: string };
        session?: { access_token?: string };
      };
      const token =
        parsed.access_token ??
        parsed.currentSession?.access_token ??
        parsed.session?.access_token ??
        null;
      if (token) return (_cachedToken = token);
    }
  } catch {
    // ignore
  }
  return (_cachedToken = null);
}

/** Call this on Supabase auth state change (signIn / signOut) to reset the memo. */
export function invalidateAuthToken(): void {
  _cachedToken = undefined;
}

interface SupabaseConfig {
  url: string;
  anonKey: string;
}

function getSupabaseConfig(): SupabaseConfig | null {
  const env = (
    import.meta as ImportMeta & { env?: Record<string, string | undefined> }
  ).env;
  const url = env?.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = env?.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

// memoised — config never changes at runtime
const supabaseConfig = getSupabaseConfig();

function isSupabaseAvailable(): boolean {
  return supabaseConfig !== null && typeof fetch !== "undefined";
}

function buildHeaders(extra?: HeadersInit): HeadersInit {
  if (!supabaseConfig) return {};
  const token = resolveSupabaseToken() ?? supabaseConfig.anonKey;
  return {
    apikey: supabaseConfig.anonKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// ─── Supabase REST primitives ─────────────────────────────────────────────────

async function sbFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!isSupabaseAvailable() || !supabaseConfig) return null;
  try {
    const res = await fetch(`${supabaseConfig.url}/rest/v1/${path}`, {
      ...init,
      headers: buildHeaders(init?.headers),
    });
    if (!res.ok) return null;
    if (res.status === 204) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type DbRow<T> = { id: string; data: T };

async function fetchRemote<T>(table: string): Promise<T[] | null> {
  const rows = await sbFetch<DbRow<T>[]>(
    `${table}?select=id,data&order=updated_at.desc`,
    { method: "GET" }
  );
  return rows ? rows.map((r) => r.data).filter(Boolean) : null;
}

async function upsertRemote<T extends { id: string }>(
  table: string,
  item: T,
  extra?: Record<string, unknown>
): Promise<T | null> {
  const rows = await sbFetch<DbRow<T>[]>(
    `${table}?on_conflict=id&select=id,data`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: item.id,
        data: item,
        updated_at: new Date().toISOString(),
        ...extra,
      }),
    }
  );
  return rows?.[0]?.data ?? null;
}

async function deleteRemote(table: string, id: string): Promise<void> {
  await sbFetch<unknown>(`${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

// ─── Local-first CRUD helpers ─────────────────────────────────────────────────
// Each entity gets two localStorage keys:
//   custom: T[]    — items created/edited locally
//   deleted: string[] — ids soft-deleted locally
// On read these are merged with the seed array; remote wins when available.

function localList<T extends { id: string }>(entity: string): T[] {
  return lsGet<T[]>(KEY.custom(entity), []);
}

function localDeleted(entity: string): Set<string> {
  return new Set(lsGet<string[]>(KEY.deleted(entity), []));
}

function localSave<T extends { id: string }>(entity: string, item: T): void {
  const list = localList<T>(entity).filter((x) => x.id !== item.id);
  lsSet(KEY.custom(entity), [item, ...list]);
  // Remove from deleted set if it was there
  const deleted = localDeleted(entity);
  if (deleted.has(item.id)) {
    deleted.delete(item.id);
    lsSet(KEY.deleted(entity), Array.from(deleted));
  }
}

function localDelete(entity: string, id: string): void {
  lsSet(
    KEY.custom(entity),
    localList<{ id: string }>(entity).filter((x) => x.id !== id)
  );
  const deleted = localDeleted(entity);
  deleted.add(id);
  lsSet(KEY.deleted(entity), Array.from(deleted));
}

function mergeWithSeed<T extends { id: string }>(
  seed: readonly T[],
  custom: T[],
  deleted: Set<string>
): T[] {
  const map = new Map<string, T>();
  for (const item of seed) if (!deleted.has(item.id)) map.set(item.id, item);
  for (const item of custom) if (!deleted.has(item.id)) map.set(item.id, item);
  return Array.from(map.values());
}

// ─── Content entity registry ──────────────────────────────────────────────────
// Centralises table names and entity keys so adding a new content type is
// a one-line change here instead of scattered throughout the file.

const ENTITY = {
  modules: { table: "learning_modules", key: "modules" },
  sops: { table: "learning_sops", key: "sops" },
  workInstructions: { table: "learning_work_instructions", key: "workInstructions" },
  defects: { table: "learning_defect_examples", key: "defects" },
  quizzes: { table: "learning_quizzes", key: "quizzes" },
  bestPractices: { table: "learning_best_practices", key: "bestPractices" },
  standards: { table: "learning_quality_standards", key: "standards" },
  onboarding: { table: "learning_onboarding_tracks", key: "onboarding" },
  teamMembers: { table: "learning_team_members", key: "teamMembers" },
  coachingNotes: { table: "learning_coaching_notes", key: "coachingNotes" },
  progress: { table: "learning_progress", key: "progress" },
  assignments: { table: "learning_assignments", key: "assignments" },
  certifications: { table: "learning_certification_rules", key: "certifications" },
  contentAudit: { table: "learning_content_audit_log", key: "contentAudit" },
  contentVersions: { table: "learning_content_versions", key: "contentVersions" },
} as const;

// ─── Generic fetch / upsert / delete ─────────────────────────────────────────

async function fetchContent<T extends { id: string }>(
  entityKey: keyof typeof ENTITY,
  seed: readonly T[],
  normalize: (item: T) => T,
  sort?: (a: T, b: T) => number,
  cacheKey?: string,
  cacheTtl = DEFAULT_TTL_MS
): Promise<ServiceResult<T[]>> {
  const ck = cacheKey ?? `content:${entityKey}`;
  const cached = cache.get<T[]>(ck);
  if (cached) return ok(cached);

  return dedupe(ck, async () => {
    const { table, key } = ENTITY[entityKey];
    const remote = await fetchRemote<T>(table);

    let items: T[];
    if (remote && remote.length > 0) {
      items = remote.map(normalize);
    } else {
      items = mergeWithSeed(
        seed.map(normalize),
        localList<T>(key).map(normalize),
        localDeleted(key)
      );
    }

    if (sort) items = [...items].sort(sort);
    cache.set(ck, items, cacheTtl);
    return ok(items);
  });
}

async function upsertContent<T extends { id: string }>(
  entityKey: keyof typeof ENTITY,
  item: T,
  normalize: (item: T) => T,
  extra?: Record<string, unknown>
): Promise<ServiceResult<T>> {
  const { table, key } = ENTITY[entityKey];
  const normalized = normalize(item);

  // Optimistic local write
  localSave(key, normalized);
  cache.bustPrefix(`content:${entityKey}`);

  const remote = await upsertRemote(table, normalized, extra);
  const result = remote ? normalize(remote) : normalized;

  // Re-seed cache with the authoritative value
  cache.bustPrefix(`content:${entityKey}`);
  return ok(result);
}

async function deleteContent(
  entityKey: keyof typeof ENTITY,
  id: string
): Promise<ServiceResult<boolean>> {
  const { table, key } = ENTITY[entityKey];
  localDelete(key, id);
  cache.bustPrefix(`content:${entityKey}`);
  await deleteRemote(table, id);
  return ok(true);
}

// ─── Visibility filter ────────────────────────────────────────────────────────

export function isVisibleForRole<
  T extends {
    status?: ContentStatus;
    audienceRoles?: LearningRole[];
    roles?: LearningRole[];
  }
>(item: T, role: string): boolean {
  const status = item.status ?? "published";
  if (role === "agent" && status !== "published") return false;
  const audience = item.audienceRoles ?? item.roles ?? ["all"];
  return audience.includes("all") || audience.includes(role as LearningRole);
}

// ─── Normalize helpers ────────────────────────────────────────────────────────
// These are pure functions: same input → same output, no side-effects.

function csv(v: string[] | undefined): string[] {
  return v ?? [];
}

export function normalizeModule(m: LearningModule): LearningModule {
  return {
    ...m,
    id: m.id?.trim() || uid("module"),
    title: m.title?.trim() || "Untitled module",
    description: m.description ?? "",
    category: m.category || "General",
    difficulty: m.difficulty ?? "beginner",
    durationMin: Number(m.durationMin) || 0,
    xpReward: Number(m.xpReward) || 0,
    content: m.content ?? "",
    author: m.author || "QA Training",
    updatedAt: m.updatedAt || today,
    rating: Number(m.rating) || 0,
    completions: Number(m.completions) || 0,
    tags: csv(m.tags),
    roles: m.roles?.length ? m.roles : ["all"],
    steps: csv(m.steps),
    metrics: csv(m.metrics),
  };
}

export function normalizeSOP(s: SOPDocument): SOPDocument {
  return {
    ...s,
    id: s.id?.trim() || uid("sop"),
    title: s.title?.trim() || "Untitled SOP",
    version: s.version || "1.0",
    category: s.category || "General",
    content: s.content ?? "",
    updatedAt: s.updatedAt || today,
    author: s.author || "QA Training",
    changeLog: s.changeLog ?? [],
  };
}

export function normalizeWorkInstruction(w: WorkInstruction): WorkInstruction {
  return {
    ...w,
    id: w.id?.trim() || uid("work-instruction"),
    title: w.title?.trim() || "Untitled work instruction",
    metric: w.metric || "General",
    category: w.category || "General",
    steps: csv(w.steps),
    updatedAt: w.updatedAt || today,
  };
}

export function normalizeDefect(d: DefectExample): DefectExample {
  return {
    ...d,
    id: d.id?.trim() || uid("defect"),
    title: d.title?.trim() || "Untitled defect example",
    metric: d.metric || "General",
    severity: d.severity ?? "medium",
    whatWentWrong: d.whatWentWrong ?? "",
    correctBehavior: d.correctBehavior ?? "",
  };
}

export function normalizeQuiz(q: Quiz): Quiz {
  return {
    ...q,
    id: q.id?.trim() || uid("quiz"),
    moduleId: q.moduleId ?? null,
    title: q.title?.trim() || "Untitled quiz",
    description: q.description ?? "",
    passingScore: Number.isFinite(q.passingScore) ? q.passingScore : 70,
    xpReward: Number.isFinite(q.xpReward) ? q.xpReward : 0,
    status: q.status ?? "published",
    audienceRoles: q.audienceRoles?.length ? q.audienceRoles : ["all", "agent"],
    updatedAt: q.updatedAt ?? today,
    questions: q.questions.map((question, i) => {
      const options =
        question.options.length >= 2 ? question.options : ["Option A", "Option B"];
      return {
        ...question,
        id: question.id || uid(`q${i + 1}`),
        options,
        correctIndex: Math.max(
          0,
          Math.min(question.correctIndex, options.length - 1)
        ),
        explanation: question.explanation ?? "",
      };
    }),
  };
}

export function normalizeBestPractice(b: BestPractice): BestPractice {
  return {
    ...b,
    id: b.id?.trim() || uid("best-practice"),
    title: b.title?.trim() || "Untitled best practice",
    category: b.category || "General",
    quote: b.quote ?? "",
    agentLabel: b.agentLabel || "QA Training",
    metric: b.metric || "General",
  };
}

export function normalizeQualityStandard(s: QualityStandard): QualityStandard {
  return {
    ...s,
    id: s.id?.trim() || uid("standard"),
    name: s.name?.trim() || "Untitled standard",
    min: Math.max(0, Math.min(Number(s.min) || 0, 100)),
    color: s.color || "var(--accent-blue)",
    desc: s.desc ?? "",
  };
}

export function normalizeOnboardingTrack(t: OnboardingTrack): OnboardingTrack {
  return {
    ...t,
    id: t.id?.trim() || uid("onboarding"),
    label: t.label?.trim() || "Untitled onboarding track",
    subtitle: t.subtitle ?? "",
    badgeLabel: t.badgeLabel || "General",
    steps: (t.steps ?? []).map((step, i) => ({
      ...step,
      id: step.id || uid(`onboarding-step-${i + 1}`),
      title: step.title?.trim() || `Step ${i + 1}`,
      description: step.description ?? "",
      moduleId: step.moduleId || null,
    })),
  };
}

export function normalizeTeamMember(m: TeamMember): TeamMember {
  return {
    ...m,
    id: m.id?.trim() || uid("team-member"),
    name: m.name?.trim() || "New team member",
    initials: m.initials?.trim() || "TM",
    score: Math.max(0, Math.min(Number(m.score) || 0, 100)),
    failedMetrics: csv(m.failedMetrics),
    team: m.team ?? null,
    agentId: m.agentId ?? null,
    email: m.email ?? null,
    source: m.source ?? "manual",
  };
}

function normalizeAssignment(a: LearningAssignment): LearningAssignment {
  const contentType = a.contentType ?? "module";
  const contentId = a.contentId ?? a.moduleId;
  return {
    ...a,
    id: a.id?.trim() || `${a.agentId}:${contentType}:${contentId}`,
    moduleId: a.moduleId || contentId,
    contentType,
    contentId,
    assignedAt: a.assignedAt ?? new Date().toISOString(),
    status: a.status ?? "assigned",
    dueDate: a.dueDate ?? null,
    completedAt: a.completedAt ?? null,
  };
}

// ─── Team / profile helpers ───────────────────────────────────────────────────

const OPERATIONAL_TEAMS: readonly OperationalTeam[] = ["Calls", "Tickets", "Sales"];

function normalizeTeam(value?: string | null): OperationalTeam | null {
  const v = (value ?? "").trim().toLowerCase();
  if (["call", "calls", "calls team", "call team"].includes(v)) return "Calls";
  if (["ticket", "tickets", "tickets team", "ticket team"].includes(v)) return "Tickets";
  if (["sale", "sales", "sales team", "sale team"].includes(v)) return "Sales";
  return null;
}

function initials(name: string, email?: string | null): string {
  const src = name.trim() || email?.split("@")[0] || "TM";
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : src.slice(0, 2).toUpperCase();
}

type ProfileRow = Record<string, unknown>;

function strFrom(row: ProfileRow, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return null;
}

function profileToMember(row: ProfileRow): TeamMember {
  const id =
    strFrom(row, "id", "user_id", "profile_id", "agent_id", "email") ??
    uid("profile-agent");
  const agentId = strFrom(row, "agent_id", "user_id", "id") ?? id;
  const email = strFrom(row, "email", "user_email");
  const name =
    strFrom(
      row,
      "display_name",
      "agent_name",
      "full_name",
      "name",
      "employee_name"
    ) ??
    email ??
    agentId ??
    "Unknown Agent";
  const team = normalizeTeam(
    strFrom(row, "team", "department", "queue", "line_of_business", "lob", "channel")
  );
  return normalizeTeamMember({
    id,
    agentId,
    name,
    initials: initials(name, email),
    email,
    team,
    score: 0,
    failedMetrics: [],
    source: "profiles",
  });
}

// ─── Audit insight enrichment ─────────────────────────────────────────────────
// Previous implementation: O(members × rows) — each member scanned all rows.
// This implementation: O(rows) index build + O(rows) member assignment.

type AuditRow = Record<string, unknown>;

// Tables we scan for audit data. Batched with Promise.allSettled to avoid
// a single 404 blocking the rest.
const AUDIT_TABLES = [
  "qa_audits", "audits", "audit_records", "qa_reviews", "reviews",
  "call_audits", "calls_audits", "ticket_audits", "tickets_audits",
  "sales_audits", "calls_uploads", "tickets_uploads", "sales_uploads",
  "calls", "tickets", "sales", "ticket_ai_reviews", "ticket_review_queue",
] as const;

const KNOWN_METRICS: Record<string, string> = {
  rl: "Return Label", returnlabel: "Return Label", return_label: "Return Label",
  ticketdocumentation: "Ticket Documentation", ticket_documentation: "Ticket Documentation",
  documentation: "Ticket Documentation", firstcontactresolution: "First Contact Resolution",
  first_contact_resolution: "First Contact Resolution", fcr: "First Contact Resolution",
  professionalism: "Professionalism", productknowledge: "Product Knowledge",
  product_knowledge: "Product Knowledge", accuracy: "Accuracy",
  communication: "Communication", empathy: "Empathy", resolution: "Resolution",
  process: "Process Adherence", processadherence: "Process Adherence",
  policy: "Policy Adherence", policyadherence: "Policy Adherence",
  followup: "Follow Up", follow_up: "Follow Up", verification: "Verification",
  callcontrol: "Call Control", call_control: "Call Control",
  greeting: "Greeting", closing: "Closing", escalation: "Escalation",
  shipping: "Shipping Accuracy", warranty: "Warranty Accuracy",
};

const EXCLUDED_KEYS = new Set([
  "id", "uuid", "agent_id", "agentid", "agent", "agent_name", "agentname",
  "email", "user_email", "name", "team", "role", "channel", "created_at",
  "createdat", "updated_at", "updatedat", "date", "audit_date", "auditor",
  "notes", "comment", "comments", "status", "overall_status", "visibility",
  "hidden", "shared", "score", "total_score", "final_score", "qa_score",
  "quality_score", "average_quality",
]);

function prettify(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function metricLabel(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const compact = v.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const snake = v.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return KNOWN_METRICS[snake] ?? KNOWN_METRICS[compact] ?? prettify(v);
}

function dedup(arr: string[]): string[] {
  return Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));
}

function splitMetrics(text: string): string[] {
  return dedup(
    text
      .split(/[;,|\n]+/)
      .map((p) => metricLabel(p))
      .filter((p): p is string => Boolean(p))
  );
}

function isNegative(v: unknown): boolean {
  if (typeof v === "boolean") return v === false;
  if (typeof v === "number") return Number.isFinite(v) && v <= 0;
  if (typeof v === "string") {
    const n = v.trim().toLowerCase();
    return [
      "fail", "failed", "false", "no", "n", "miss", "missed",
      "incorrect", "not met", "needs improvement", "unsatisfactory", "zero", "0",
    ].includes(n);
  }
  return false;
}

function looksLikeMetricKey(key: string): boolean {
  const n = key.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  const c = n.replace(/_/g, "");
  if (EXCLUDED_KEYS.has(n) || EXCLUDED_KEYS.has(c)) return false;
  if (KNOWN_METRICS[n] || KNOWN_METRICS[c]) return true;
  return /(metric|rubric|criterion|category|documentation|professionalism|knowledge|resolution|accuracy|empathy|policy|process|greeting|closing|escalation|shipping|warranty)/i.test(key);
}

function negativeOutcome(obj: AuditRow): boolean {
  const flagged = ["failed", "missed", "fail"];
  const passing = ["passed", "pass", "met", "is_met", "success"];
  for (const [k, v] of Object.entries(obj)) {
    if (flagged.includes(k) && v === true) return true;
    if (passing.includes(k) && v === false) return true;
    if (["result", "outcome", "status", "value", "answer", "score", "points", "points_earned"].includes(k) && isNegative(v)) return true;
  }
  const pe = typeof obj.points_earned === "number" ? obj.points_earned
    : typeof obj.pointsEarned === "number" ? obj.pointsEarned : null;
  const mp = typeof obj.max_points === "number" ? obj.max_points
    : typeof obj.maxPoints === "number" ? obj.maxPoints : null;
  return pe !== null && mp !== null && pe < mp;
}

function collectFailed(value: unknown, parentKey: string | null, out: Set<string>): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    if (parentKey && /failed|missed|defect|opportunit|error|coaching/i.test(parentKey)) {
      splitMetrics(value).forEach((m) => out.add(m));
    }
    return;
  }
  if (Array.isArray(value)) { value.forEach((v) => collectFailed(v, parentKey, out)); return; }
  if (typeof value !== "object") return;

  const obj = value as AuditRow;
  const label = strFrom(obj, "metric", "metric_name", "metricName", "name", "title", "criterion", "category", "field", "label");
  if (label && negativeOutcome(obj)) { const l = metricLabel(label); if (l) out.add(l); }

  for (const [k, child] of Object.entries(obj)) {
    if (looksLikeMetricKey(k) && isNegative(child)) { const l = metricLabel(k); if (l) out.add(l); }
    if (/failed|missed|defect|opportunit|error|coaching/i.test(k) && typeof child === "string") {
      splitMetrics(child).forEach((m) => out.add(m));
    }
    collectFailed(child, k, out);
  }
}

function failedMetricsFromRow(row: AuditRow): string[] {
  const out = new Set<string>();
  collectFailed(row, null, out);
  return dedup(Array.from(out)).slice(0, 8);
}

function scoreFromRow(row: AuditRow): number | null {
  const keys = [
    "score", "qa_score", "qaScore", "quality_score", "qualityScore",
    "audit_score", "auditScore", "final_score", "finalScore",
    "total_score", "totalScore", "average_quality", "averageQuality",
  ];
  for (const k of keys) {
    const v = row[k];
    const n = typeof v === "number" ? v
      : typeof v === "string" ? Number(v.replace("%", "")) : NaN;
    if (Number.isFinite(n) && n >= 0 && n <= 100) return Math.round(n);
  }
  for (const child of Object.values(row)) {
    if (child && typeof child === "object" && !Array.isArray(child)) {
      const n = scoreFromRow(child as AuditRow);
      if (n !== null) return n;
    }
  }
  return null;
}

function normalizeKey(v: string | null | undefined): string {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9@.]+/g, "").trim();
}

/** Fetch all candidate audit rows once, with Promise.allSettled (no partial failures). */
async function fetchAllAuditRows(): Promise<AuditRow[]> {
  if (!isSupabaseAvailable()) return [];
  const results = await Promise.allSettled(
    AUDIT_TABLES.map((t) =>
      sbFetch<AuditRow[]>(`${t}?select=*&limit=5000`, { method: "GET" }).then((r) => r ?? [])
    )
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

/**
 * Enrich team members with real scores and failed metrics from audit data.
 * Builds an O(rows) index keyed by normalised identifier strings so each row
 * is visited once rather than once per team member.
 */
async function enrichTeamMembers(members: TeamMember[]): Promise<TeamMember[]> {
  if (!members.length || !isSupabaseAvailable()) return members;

  const rows = await dedupe("audit-rows", fetchAllAuditRows);
  if (!rows.length) return members;

  // Build index: normalised key → member index in `members`
  const index = new Map<string, number>();
  members.forEach((m, i) => {
    [m.id, m.agentId, m.email, m.name]
      .map((v) => normalizeKey(v))
      .filter(Boolean)
      .forEach((k) => { if (!index.has(k)) index.set(k, i); });
  });

  // Accumulate per-member scores and failed metrics
  const scoreAccum: number[][] = members.map(() => []);
  const metricAccum: Set<string>[] = members.map(() => new Set());

  for (const row of rows) {
    // Find which member this row belongs to
    const candidates = [
      strFrom(row, "agent_id", "agentId", "user_id", "profile_id"),
      strFrom(row, "email", "user_email", "agent_email"),
      strFrom(row, "agent_name", "agentName", "name", "employee_name"),
    ];

    // Also check nested profile object
    const nested = row.profile ?? row.agent_profile ?? row.user ?? row.agent;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const n = nested as ProfileRow;
      candidates.push(
        strFrom(n, "id", "user_id", "agent_id"),
        strFrom(n, "email", "user_email"),
        strFrom(n, "display_name", "agent_name", "full_name", "name")
      );
    }

    let memberIdx: number | undefined;
    for (const c of candidates) {
      const k = normalizeKey(c);
      if (k && index.has(k)) { memberIdx = index.get(k); break; }
    }
    if (memberIdx === undefined) continue;

    // Team scope filter
    const rowTeam = normalizeTeam(
      strFrom(row as ProfileRow, "team", "department", "queue", "line_of_business", "lob", "channel")
    );
    const member = members[memberIdx];
    if (rowTeam && member.team && rowTeam !== member.team) continue;

    const score = scoreFromRow(row);
    if (score !== null) scoreAccum[memberIdx].push(score);
    failedMetricsFromRow(row).forEach((m) => metricAccum[memberIdx!].add(m));
  }

  return members.map((m, i) => {
    const scores = scoreAccum[i];
    const failed = dedup(Array.from(metricAccum[i]));
    const score = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : m.score;
    return normalizeTeamMember({ ...m, score, failedMetrics: failed });
  });
}

// ─── Default data ─────────────────────────────────────────────────────────────

const DEFAULT_PROGRESS: UserProgress = {
  completedModules: [], completedQuizzes: [], quizScores: {},
  xp: 0, level: 0, badges: [], streak: 0,
  lastActiveDate: today, certifications: [],
};

const DEFAULT_CERTIFICATION_RULES: CertificationRule[] = [
  {
    id: "qa-foundations",
    title: "QA Foundations",
    description: "Complete foundational training and pass at least one quiz.",
    requiredModuleIds: ["qa-foundations"],
    requiredQuizIds: ["qa-foundations-quiz"],
    minAvgScore: 70, minXP: 100,
    roleVisibility: ["all", "agent", "supervisor", "qa", "admin"],
    expiresAfterDays: null, active: true,
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────
// Each function follows the pattern:
//   1. Check in-memory cache
//   2. Local-first merge (seed + localStorage) as instant fallback
//   3. Async Supabase fetch/write
//   4. Update cache

// ── Modules ──

import {
  MODULES, SOPS, WORK_INSTRUCTIONS, DEFECTS, QUIZZES,
  LESSONS, BEST_PRACTICES, QUALITY_STANDARDS, TEAM_MEMBERS,
  AUDIT_LINKS, ONBOARDING_TRACKS,
} from "./learningSeeds";

export async function fetchLearningModules(): Promise<ServiceResult<LearningModule[]>> {
  return fetchContent("modules", MODULES, normalizeModule);
}

export async function upsertLearningModule(item: LearningModule): Promise<ServiceResult<LearningModule>> {
  const normalized = normalizeModule({
    ...item,
    status: item.status ?? "published",
    updatedAt: today,
  });
  return upsertContent("modules", normalized, normalizeModule, {
    status: normalized.status,
    audience_roles: normalized.audienceRoles ?? normalized.roles ?? ["all"],
  });
}

export async function deleteLearningModule(id: string): Promise<ServiceResult<boolean>> {
  return deleteContent("modules", id);
}

// ── SOPs ──

export async function fetchSOPs(): Promise<ServiceResult<SOPDocument[]>> {
  return fetchContent("sops", SOPS, normalizeSOP);
}

export async function upsertSOP(item: SOPDocument): Promise<ServiceResult<SOPDocument>> {
  const normalized = normalizeSOP({ ...item, status: item.status ?? "published", updatedAt: today });
  return upsertContent("sops", normalized, normalizeSOP, {
    status: normalized.status,
    audience_roles: normalized.audienceRoles ?? ["all"],
  });
}

export async function deleteSOP(id: string): Promise<ServiceResult<boolean>> {
  return deleteContent("sops", id);
}

// ── Work Instructions ──

export async function fetchWorkInstructions(): Promise<ServiceResult<WorkInstruction[]>> {
  return fetchContent("workInstructions", WORK_INSTRUCTIONS, normalizeWorkInstruction);
}

export async function upsertWorkInstruction(item: WorkInstruction): Promise<ServiceResult<WorkInstruction>> {
  const normalized = normalizeWorkInstruction({ ...item, status: item.status ?? "published", updatedAt: today });
  return upsertContent("workInstructions", normalized, normalizeWorkInstruction, {
    status: normalized.status,
    audience_roles: normalized.audienceRoles ?? ["all"],
  });
}

export async function deleteWorkInstruction(id: string): Promise<ServiceResult<boolean>> {
  return deleteContent("workInstructions", id);
}

// ── Defects ──

export async function fetchDefectExamples(): Promise<ServiceResult<DefectExample[]>> {
  return fetchContent("defects", DEFECTS, normalizeDefect);
}

export async function upsertDefectExample(item: DefectExample): Promise<ServiceResult<DefectExample>> {
  const normalized = normalizeDefect({ ...item, status: item.status ?? "published" });
  return upsertContent("defects", normalized, normalizeDefect, {
    status: normalized.status,
    audience_roles: normalized.audienceRoles ?? ["all"],
  });
}

export async function deleteDefectExample(id: string): Promise<ServiceResult<boolean>> {
  return deleteContent("defects", id);
}

// ── Quizzes ──

export async function fetchQuizzes(): Promise<ServiceResult<Quiz[]>> {
  return fetchContent(
    "quizzes", QUIZZES, normalizeQuiz,
    (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
  );
}

export async function upsertQuiz(quiz: QuizUpsertInput, userId?: string): Promise<ServiceResult<Quiz>> {
  const normalized = normalizeQuiz({
    ...quiz,
    createdBy: quiz.createdBy ?? userId ?? null,
    updatedAt: new Date().toISOString(),
  });
  return upsertContent("quizzes", normalized, normalizeQuiz, {
    status: normalized.status,
    audience_roles: normalized.audienceRoles ?? ["all", "agent"],
    created_by: normalized.createdBy,
  });
}

export async function deleteQuiz(id: string): Promise<ServiceResult<boolean>> {
  return deleteContent("quizzes", id);
}

// ── Lessons Learned (static for now) ──

export async function fetchLessonsLearned(): Promise<ServiceResult<typeof LESSONS>> {
  return ok(LESSONS);
}

// ── Best Practices ──

export async function fetchBestPractices(): Promise<ServiceResult<BestPractice[]>> {
  return fetchContent("bestPractices", BEST_PRACTICES, normalizeBestPractice);
}

export async function upsertBestPractice(item: BestPractice): Promise<ServiceResult<BestPractice>> {
  const normalized = normalizeBestPractice({ ...item, status: item.status ?? "published" });
  return upsertContent("bestPractices", normalized, normalizeBestPractice, {
    status: normalized.status,
    audience_roles: normalized.audienceRoles ?? ["all"],
  });
}

export async function deleteBestPractice(id: string): Promise<ServiceResult<boolean>> {
  return deleteContent("bestPractices", id);
}

// ── Quality Standards ──

export async function fetchQualityStandards(): Promise<ServiceResult<QualityStandard[]>> {
  return fetchContent(
    "standards", QUALITY_STANDARDS, normalizeQualityStandard,
    (a, b) => b.min - a.min,
    "content:standards",
    5 * 60_000 // standards rarely change — 5 min TTL
  );
}

export async function upsertQualityStandard(item: QualityStandard): Promise<ServiceResult<QualityStandard>> {
  const normalized = normalizeQualityStandard({ ...item, status: item.status ?? "published" });
  return upsertContent("standards", normalized, normalizeQualityStandard, {
    status: normalized.status,
    audience_roles: normalized.audienceRoles ?? ["all"],
  });
}

export async function deleteQualityStandard(id: string): Promise<ServiceResult<boolean>> {
  return deleteContent("standards", id);
}

// ── Onboarding Tracks ──

export async function fetchOnboardingTracks(role: string): Promise<ServiceResult<OnboardingTrack[]>> {
  const result = await fetchContent("onboarding", ONBOARDING_TRACKS, normalizeOnboardingTrack);
  if (!result.data) return result;
  const tracks = result.data.filter((t) => isVisibleForRole(t, role));
  const filtered = role === "agent" ? tracks.filter((t) => t.badgeLabel === "Agent") : tracks;
  return ok(filtered);
}

export async function upsertOnboardingTrack(item: OnboardingTrack): Promise<ServiceResult<OnboardingTrack>> {
  const normalized = normalizeOnboardingTrack({ ...item, status: item.status ?? "published" });
  return upsertContent("onboarding", normalized, normalizeOnboardingTrack, {
    status: normalized.status,
    audience_roles: normalized.audienceRoles ?? ["all"],
  });
}

export async function deleteOnboardingTrack(id: string): Promise<ServiceResult<boolean>> {
  return deleteContent("onboarding", id);
}

// ── Team Members ──

export async function fetchTeamMembers(
  _supervisorId?: string,
  teamScope?: string | null
): Promise<ServiceResult<TeamMember[]>> {
  const scopeTeam = normalizeTeam(teamScope);

  const inScope = (m: TeamMember) => {
    const mt = normalizeTeam(m.team);
    if (!mt || !OPERATIONAL_TEAMS.includes(mt)) return false;
    return scopeTeam ? mt === scopeTeam : true;
  };

  const cacheKey = `team-members:${scopeTeam ?? "all"}`;
  const cached = cache.get<TeamMember[]>(cacheKey);
  if (cached) return ok(cached);

  return dedupe(cacheKey, async () => {
    const remote = await sbFetch<ProfileRow[]>("profiles?select=*&order=team.asc", { method: "GET" });

    let members: TeamMember[];
    if (remote) {
      members = remote.map(profileToMember).filter(inScope);
    } else {
      members = mergeWithSeed(
        TEAM_MEMBERS,
        localList<TeamMember>(ENTITY.teamMembers.key).map((m) =>
          normalizeTeamMember({ ...m, team: normalizeTeam(m.team) })
        ),
        localDeleted(ENTITY.teamMembers.key)
      ).filter(inScope);
    }

    const enriched = await enrichTeamMembers(members);
    cache.set(cacheKey, enriched, 30_000); // 30 s — audit scores can change
    return ok(enriched);
  });
}

/** @deprecated Use fetchTeamMembers — team members are synced from profiles. */
export async function upsertTeamMember(item: TeamMember): Promise<ServiceResult<TeamMember>> {
  return upsertContent("teamMembers", normalizeTeamMember(item), normalizeTeamMember);
}

export async function deleteTeamMember(id: string): Promise<ServiceResult<boolean>> {
  return deleteContent("teamMembers", id);
}

// ── User Progress ──

export async function fetchOrCreateUserProgress(userId: string): Promise<ServiceResult<UserProgress>> {
  const cacheKey = `progress:${userId}`;
  const cached = cache.get<UserProgress>(cacheKey);
  if (cached) return ok(cached);

  const remote = await sbFetch<DbRow<UserProgress>[]>(
    `${ENTITY.progress.table}?id=eq.${encodeURIComponent(userId)}&select=id,data&limit=1`,
    { method: "GET" }
  );

  const stored = remote?.[0]?.data ?? lsGet<UserProgress>(KEY.progress(userId), DEFAULT_PROGRESS);
  const merged: UserProgress = {
    ...DEFAULT_PROGRESS,
    ...stored,
    completedModules: stored.completedModules ?? [],
    completedQuizzes: stored.completedQuizzes ?? [],
    quizScores: stored.quizScores ?? {},
    badges: stored.badges ?? [],
    certifications: stored.certifications ?? [],
  };

  lsSet(KEY.progress(userId), merged);
  cache.set(cacheKey, merged, 10_000);

  // Fire-and-forget remote sync
  void upsertRemote(ENTITY.progress.table, { id: userId, ...merged }, { user_id: userId });

  return ok(merged);
}

export async function upsertUserProgress(userId: string, progress: UserProgress): Promise<ServiceResult<UserProgress>> {
  lsSet(KEY.progress(userId), progress);
  cache.set(`progress:${userId}`, progress, 10_000);
  await upsertRemote(ENTITY.progress.table, { id: userId, ...progress }, { user_id: userId });
  return ok(progress);
}

// ── Upvotes ──

export async function fetchUserUpvotes(userId: string): Promise<ServiceResult<string[]>> {
  return ok(lsGet<string[]>(KEY.upvotes(userId), []));
}

export async function toggleLessonUpvote(
  userId: string,
  lessonId: string,
  alreadyUpvoted: boolean
): Promise<ServiceResult<boolean>> {
  const current = new Set(lsGet<string[]>(KEY.upvotes(userId), []));
  alreadyUpvoted ? current.delete(lessonId) : current.add(lessonId);
  lsSet(KEY.upvotes(userId), Array.from(current));
  return ok(!alreadyUpvoted);
}

// ── Coaching Notes ──

export async function fetchCoachingNotes(supervisorId: string): Promise<ServiceResult<CoachingNote[]>> {
  const remote = await sbFetch<DbRow<CoachingNote>[]>(
    `${ENTITY.coachingNotes.table}?supervisor_id=eq.${encodeURIComponent(supervisorId)}&select=id,data&order=updated_at.desc`,
    { method: "GET" }
  );
  if (remote) return ok(remote.map((r) => r.data).filter(Boolean));
  return ok(lsGet<CoachingNote[]>(KEY.notes(supervisorId), []));
}

export async function upsertCoachingNote(input: {
  supervisorId: string;
  agentId: string;
  note: string;
  metric?: string;
  id?: string;
}): Promise<ServiceResult<CoachingNote>> {
  const note: CoachingNote = {
    id: input.id || uid("coaching-note"),
    supervisorId: input.supervisorId,
    agentId: input.agentId,
    note: input.note,
    metric: input.metric,
    sessionDate: new Date().toLocaleDateString(),
  };

  const existing = lsGet<CoachingNote[]>(KEY.notes(input.supervisorId), []);
  lsSet(KEY.notes(input.supervisorId), [note, ...existing.filter((n) => n.id !== note.id)]);

  const remote = await upsertRemote(ENTITY.coachingNotes.table, note, {
    supervisor_id: input.supervisorId,
    agent_id: input.agentId,
  });
  return ok(remote ?? note);
}

export async function deleteCoachingNote(supervisorId: string, noteId: string): Promise<ServiceResult<boolean>> {
  lsSet(
    KEY.notes(supervisorId),
    lsGet<CoachingNote[]>(KEY.notes(supervisorId), []).filter((n) => n.id !== noteId)
  );
  await deleteRemote(ENTITY.coachingNotes.table, noteId);
  return ok(true);
}

// ── Assignments ──

export async function createAssignment(input: {
  agentId: string;
  moduleId: string;
  assignedBy: string;
  contentType?: LearningAssignableType;
  contentId?: string;
  title?: string;
  dueDate?: string | null;
}): Promise<ServiceResult<LearningAssignment>> {
  const assignment = normalizeAssignment({
    id: `${input.agentId}:${input.contentType ?? "module"}:${input.contentId ?? input.moduleId}`,
    agentId: input.agentId,
    moduleId: input.moduleId,
    assignedBy: input.assignedBy,
    assignedAt: new Date().toISOString(),
    contentType: input.contentType ?? "module",
    contentId: input.contentId ?? input.moduleId,
    title: input.title,
    dueDate: input.dueDate ?? null,
    status: "assigned",
  });

  const existing = lsGet<LearningAssignment[]>(KEY.assignments(input.agentId), []);
  lsSet(KEY.assignments(input.agentId), [assignment, ...existing.filter((a) => a.id !== assignment.id)]);

  const remote = await upsertRemote(ENTITY.assignments.table, assignment, {
    agent_id: assignment.agentId,
    assigned_by: assignment.assignedBy,
    status: assignment.status,
  });
  return ok(remote ?? assignment);
}

export async function fetchAgentAssignments(agentId: string): Promise<ServiceResult<LearningAssignment[]>> {
  const remote = await sbFetch<DbRow<LearningAssignment>[]>(
    `${ENTITY.assignments.table}?agent_id=eq.${encodeURIComponent(agentId)}&select=id,data&order=created_at.desc`,
    { method: "GET" }
  );
  if (remote) return ok(remote.map((r) => r.data).filter(Boolean).map(normalizeAssignment));
  return ok(lsGet<LearningAssignment[]>(KEY.assignments(agentId), []).map(normalizeAssignment));
}

export async function fetchAllAssignments(): Promise<ServiceResult<LearningAssignment[]>> {
  const remote = await fetchRemote<LearningAssignment>(ENTITY.assignments.table);
  return ok((remote ?? []).map(normalizeAssignment));
}

export async function updateAssignment(assignment: LearningAssignment): Promise<ServiceResult<LearningAssignment>> {
  const normalized = normalizeAssignment(assignment);
  const existing = lsGet<LearningAssignment[]>(KEY.assignments(normalized.agentId), []);
  lsSet(KEY.assignments(normalized.agentId), [normalized, ...existing.filter((a) => a.id !== normalized.id)]);

  const remote = await upsertRemote(ENTITY.assignments.table, normalized, {
    agent_id: normalized.agentId,
    assigned_by: normalized.assignedBy,
    status: normalized.status,
  });
  return ok(remote ?? normalized);
}

export async function deleteAssignment(assignment: LearningAssignment): Promise<ServiceResult<boolean>> {
  lsSet(
    KEY.assignments(assignment.agentId),
    lsGet<LearningAssignment[]>(KEY.assignments(assignment.agentId), []).filter((a) => a.id !== assignment.id)
  );
  await deleteRemote(ENTITY.assignments.table, assignment.id);
  return ok(true);
}

// ── Certification Rules ──

export async function fetchCertificationRules(): Promise<ServiceResult<CertificationRule[]>> {
  const remote = await fetchRemote<CertificationRule>(ENTITY.certifications.table);
  return ok(remote?.length ? remote : DEFAULT_CERTIFICATION_RULES);
}

export async function upsertCertificationRule(rule: CertificationRule): Promise<ServiceResult<CertificationRule>> {
  const normalized = { ...rule, id: rule.id || uid("certification-rule") };
  const remote = await upsertRemote(ENTITY.certifications.table, normalized, { active: normalized.active });
  return ok(remote ?? normalized);
}

export async function deleteCertificationRule(id: string): Promise<ServiceResult<boolean>> {
  await deleteRemote(ENTITY.certifications.table, id);
  return ok(true);
}

// ── Certifications (grant based on progress) ──

export async function checkAndGrantCertifications(
  userId: string,
  progress: UserProgress
): Promise<ServiceResult<Certification[]>> {
  const certs = [...(progress.certifications ?? [])];
  const has = (id: string) => certs.some((c) => c.id === id);
  const grant = (id: string) => { if (!has(id)) certs.push({ id, earnedAt: new Date().toISOString() }); };

  if (progress.completedModules.length >= 1) grant("qa-foundations");
  if (Object.values(progress.quizScores).some((s) => s === 100)) grant("perfect-scorer");
  if (progress.xp >= 500) grant("module-master");

  const updated: UserProgress = { ...progress, certifications: certs };
  lsSet(KEY.progress(userId), updated);
  await upsertUserProgress(userId, updated);
  return ok(certs);
}

// ── Content Audit Trail ──

export async function fetchLearningContentAuditTrail(limit = 50): Promise<ServiceResult<ContentAuditEntry[]>> {
  const remote = await sbFetch<DbRow<ContentAuditEntry>[]>(
    `${ENTITY.contentAudit.table}?select=id,data&order=created_at.desc&limit=${limit}`,
    { method: "GET" }
  );
  if (remote) return ok(remote.map((r) => r.data).filter(Boolean));
  return ok(lsGet<ContentAuditEntry[]>(KEY.auditTrail, []).slice(0, limit));
}

// ── Content Versions ──

export async function fetchLearningContentVersions(
  contentType: string,
  contentId: string
): Promise<ServiceResult<ContentVersionEntry[]>> {
  const remote = await sbFetch<DbRow<ContentVersionEntry>[]>(
    `${ENTITY.contentVersions.table}?content_type=eq.${encodeURIComponent(contentType)}&content_id=eq.${encodeURIComponent(contentId)}&select=id,data&order=created_at.desc`,
    { method: "GET" }
  );
  if (remote) return ok(remote.map((r) => r.data).filter(Boolean));
  return ok(
    lsGet<ContentVersionEntry[]>(KEY.versions, []).filter(
      (e) => e.contentType === contentType && e.contentId === contentId
    )
  );
}

// ── Recommendations / Audit Links ──

export async function fetchRecommendedModuleIds(_userId: string): Promise<ServiceResult<string[]>> {
  return ok(["ticket-documentation"]);
}

export async function fetchAuditLinks(_userId?: string): Promise<ServiceResult<AuditLink[]>> {
  return ok(AUDIT_LINKS);
}

// ── Completions counter ──

export async function incrementModuleCompletions(moduleId: string): Promise<ServiceResult<boolean>> {
  const result = await fetchLearningModules();
  if (!result.data) return err("NOT_FOUND", `Module ${moduleId} not found`);
  const module = result.data.find((m) => m.id === moduleId);
  if (!module) return err("NOT_FOUND", `Module ${moduleId} not found`);
  await upsertLearningModule({ ...module, completions: module.completions + 1 });
  return ok(true);
}

// ── Cache management (exported for testing / dev tools) ──

export const learningCache = {
  bust: (...keys: string[]) => cache.bust(...keys),
  bustAll: () => cache.store.clear(),
  bustPrefix: (prefix: string) => cache.bustPrefix(prefix),
} as const;
