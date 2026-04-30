import {
  memo,
  useCallback,
  useState,
  useMemo,
  useRef,
  useEffect,
  type ReactNode,
  type ChangeEvent,
} from "react";
import type {
  BestPractice,
  CoachingNote,
  DefectExample,
  LearningDifficulty,
  LearningAssignment,
  LearningAssignableType,
  LearningModule,
  LearningRole,
  OnboardingTrack,
  QualityStandard,
  Quiz,
  SOPDocument,
  TeamMember,
  WorkInstruction,
} from "./learningService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentManagerKind =
  | "modules"
  | "sops"
  | "work-instructions"
  | "defects"
  | "standards"
  | "onboarding"
  | "best-practices"
  | "coaching";

interface LearningContentManagerProps {
  kind: ContentManagerKind;
  modules?: LearningModule[];
  quizzes?: Quiz[];
  assignments?: LearningAssignment[];
  sops?: SOPDocument[];
  workInstructions?: WorkInstruction[];
  defects?: DefectExample[];
  standards?: QualityStandard[];
  onboardingTracks?: OnboardingTrack[];
  bestPractices?: BestPractice[];
  teamData?: TeamMember[];
  coachingNotes?: CoachingNote[];
  currentUserId?: string;
  onSaveModule?: (item: LearningModule) => Promise<void> | void;
  onDeleteModule?: (id: string) => Promise<void> | void;
  onSaveSOP?: (item: SOPDocument) => Promise<void> | void;
  onDeleteSOP?: (id: string) => Promise<void> | void;
  onSaveWorkInstruction?: (item: WorkInstruction) => Promise<void> | void;
  onDeleteWorkInstruction?: (id: string) => Promise<void> | void;
  onSaveDefect?: (item: DefectExample) => Promise<void> | void;
  onDeleteDefect?: (id: string) => Promise<void> | void;
  onSaveStandard?: (item: QualityStandard) => Promise<void> | void;
  onDeleteStandard?: (id: string) => Promise<void> | void;
  onSaveOnboardingTrack?: (item: OnboardingTrack) => Promise<void> | void;
  onDeleteOnboardingTrack?: (id: string) => Promise<void> | void;
  onSaveBestPractice?: (item: BestPractice) => Promise<void> | void;
  onDeleteBestPractice?: (id: string) => Promise<void> | void;
  onSaveCoachingNote?: (agentId: string, note: string, metric?: string, noteId?: string) => Promise<void> | void;
  onDeleteCoachingNote?: (id: string) => Promise<void> | void;
  onCreateAssignment?: (input: {
    agentId: string;
    moduleId: string;
    contentType?: LearningAssignableType;
    contentId?: string;
    title?: string;
    dueDate?: string | null;
  }) => Promise<void> | void;
  onUpdateAssignment?: (assignment: LearningAssignment) => Promise<void> | void;
  onDeleteAssignment?: (assignment: LearningAssignment) => Promise<void> | void;
}

// ─── CSS injection ────────────────────────────────────────────────────────────

const LCM_CSS_ID = "da-lcm-v3";
const LCM_CSS = `
/* ── Shell ─────────────────────────────────────────── */
.lcm-root{display:flex;flex-direction:column;gap:0;animation:fadeUp 200ms ease both}
.lcm-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:24px;flex-wrap:wrap}
.lcm-header-text{}
.lcm-title{font-size:16px;font-weight:700;letter-spacing:-0.02em;color:var(--fg-default)}
.lcm-sub{font-size:12px;color:var(--fg-muted);margin-top:3px}

/* ── Toast ─────────────────────────────────────────── */
.lcm-toast-wrap{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.lcm-toast{display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:10px;font-size:12px;font-weight:600;backdrop-filter:blur(12px);pointer-events:all;animation:lcmToastIn 220ms cubic-bezier(.16,1,.3,1) both;box-shadow:0 4px 20px rgba(0,0,0,.35);border:1px solid}
.lcm-toast.success{background:color-mix(in srgb,var(--accent-emerald) 12%,var(--bg-overlay));border-color:color-mix(in srgb,var(--accent-emerald) 25%,transparent);color:var(--accent-emerald)}
.lcm-toast.error{background:color-mix(in srgb,var(--accent-rose) 12%,var(--bg-overlay));border-color:color-mix(in srgb,var(--accent-rose) 25%,transparent);color:var(--accent-rose)}
.lcm-toast.info{background:color-mix(in srgb,var(--accent-blue) 12%,var(--bg-overlay));border-color:color-mix(in srgb,var(--accent-blue) 25%,transparent);color:var(--accent-blue)}
@keyframes lcmToastIn{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}

/* ── Search bar ────────────────────────────────────── */
.lcm-search{display:flex;align-items:center;gap:8px;height:38px;padding:0 12px;border-radius:9px;border:1px solid var(--border-strong);background:var(--bg-elevated);margin-bottom:16px;transition:border-color 120ms}
.lcm-search:focus-within{border-color:color-mix(in srgb,var(--accent-violet) 40%,transparent)}
.lcm-search-input{flex:1;background:transparent;border:none;outline:none;font-size:12px;font-family:inherit;color:var(--fg-default)}
.lcm-search-input::placeholder{color:var(--fg-muted)}

/* ── List ──────────────────────────────────────────── */
.lcm-list{display:flex;flex-direction:column;gap:8px;margin-bottom:20px;max-height:400px;overflow-y:auto;padding-right:2px}
.lcm-list-item{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border-radius:10px;border:1px solid var(--border);background:var(--bg-elevated);transition:border-color 120ms,box-shadow 120ms}
.lcm-list-item:hover{border-color:var(--border-strong);box-shadow:var(--shadow-sm)}
.lcm-list-item.editing{border-color:color-mix(in srgb,var(--accent-violet) 30%,transparent);background:color-mix(in srgb,var(--accent-violet) 4%,var(--bg-elevated))}
.lcm-list-item-body{flex:1;min-width:0}
.lcm-list-item-title{font-size:13px;font-weight:600;color:var(--fg-default);letter-spacing:-0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lcm-list-item-meta{font-size:11px;color:var(--fg-muted);margin-top:3px;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.lcm-list-empty{padding:28px;text-align:center;color:var(--fg-muted);font-size:12px;border-radius:10px;border:1px dashed var(--border);background:var(--bg-subtle)}

/* ── Form card ─────────────────────────────────────── */
.lcm-form-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.lcm-form-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--bg-subtle)}
.lcm-form-title{font-size:13px;font-weight:700;color:var(--fg-default);letter-spacing:-0.01em}
.lcm-form-body{padding:20px;display:flex;flex-direction:column;gap:14px}
.lcm-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.lcm-form-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
@media(max-width:640px){.lcm-form-row,.lcm-form-row-3{grid-template-columns:1fr}}
.lcm-form-footer{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-top:1px solid var(--border);background:var(--bg-subtle);gap:10px;flex-wrap:wrap}

/* ── Field ─────────────────────────────────────────── */
.lcm-field{display:flex;flex-direction:column;gap:5px}
.lcm-label{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-muted)}
.lcm-label-required::after{content:" *";color:var(--accent-rose)}
.lcm-input,.lcm-select,.lcm-textarea{width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-strong);background:var(--bg-overlay);color:var(--fg-default);font-size:12px;font-family:inherit;outline:none;transition:border-color 120ms,box-shadow 120ms}
.lcm-input:focus,.lcm-select:focus,.lcm-textarea:focus{border-color:color-mix(in srgb,var(--accent-violet) 50%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent-violet) 10%,transparent)}
.lcm-input.error,.lcm-select.error,.lcm-textarea.error{border-color:color-mix(in srgb,var(--accent-rose) 50%,transparent)}
.lcm-input::placeholder,.lcm-textarea::placeholder{color:var(--fg-muted)}
.lcm-textarea{min-height:76px;resize:vertical;line-height:1.55}
.lcm-field-hint{font-size:10px;color:var(--fg-muted);margin-top:2px}
.lcm-field-error{font-size:10px;color:var(--accent-rose);margin-top:2px;font-weight:600}

/* ── Pill toggle (roles) ───────────────────────────── */
.lcm-pill-group{display:flex;gap:5px;flex-wrap:wrap}
.lcm-pill{height:26px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--fg-muted);font-size:11px;font-weight:500;font-family:inherit;cursor:pointer;transition:all 120ms ease}
.lcm-pill:hover{color:var(--fg-default);border-color:var(--border-strong)}
.lcm-pill.active{color:var(--accent-violet);background:color-mix(in srgb,var(--accent-violet) 10%,transparent);border-color:color-mix(in srgb,var(--accent-violet) 25%,transparent);font-weight:600}

/* ── Buttons ───────────────────────────────────────── */
.lcm-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 14px;border-radius:8px;border:1px solid transparent;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 120ms ease;white-space:nowrap;flex-shrink:0}
.lcm-btn:disabled{opacity:0.45;cursor:not-allowed}
.lcm-btn-primary{background:linear-gradient(135deg,var(--accent-violet),var(--accent-blue));color:#fff;border:none}
.lcm-btn-primary:hover:not(:disabled){opacity:.9;transform:translateY(-1px)}
.lcm-btn-ghost{background:transparent;color:var(--fg-muted);border-color:var(--border)}
.lcm-btn-ghost:hover:not(:disabled){color:var(--fg-default);background:var(--bg-subtle-hover);border-color:var(--border-strong)}
.lcm-btn-danger{background:color-mix(in srgb,var(--accent-rose) 8%,transparent);color:var(--accent-rose);border-color:color-mix(in srgb,var(--accent-rose) 22%,transparent)}
.lcm-btn-danger:hover:not(:disabled){background:color-mix(in srgb,var(--accent-rose) 14%,transparent)}
.lcm-btn-sm{height:26px;padding:0 10px;font-size:11px;border-radius:6px}
.lcm-btn-blue{background:color-mix(in srgb,var(--accent-blue) 10%,transparent);color:var(--accent-blue);border-color:color-mix(in srgb,var(--accent-blue) 22%,transparent)}
.lcm-btn-blue:hover:not(:disabled){background:color-mix(in srgb,var(--accent-blue) 16%,transparent)}
.lcm-btn-emerald{background:color-mix(in srgb,var(--accent-emerald) 10%,transparent);color:var(--accent-emerald);border-color:color-mix(in srgb,var(--accent-emerald) 22%,transparent)}
.lcm-btn-emerald:hover:not(:disabled){background:color-mix(in srgb,var(--accent-emerald) 16%,transparent)}
.lcm-btn-amber{background:color-mix(in srgb,var(--accent-amber) 10%,transparent);color:var(--accent-amber);border-color:color-mix(in srgb,var(--accent-amber) 22%,transparent)}
.lcm-btn-amber:hover:not(:disabled){background:color-mix(in srgb,var(--accent-amber) 16%,transparent)}

/* ── Spinner ───────────────────────────────────────── */
.lcm-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:lcmSpin 600ms linear infinite;flex-shrink:0}
.lcm-spinner-dark{border-color:rgba(0,0,0,.1);border-top-color:currentColor}
@keyframes lcmSpin{to{transform:rotate(360deg)}}

/* ── Stats grid ────────────────────────────────────── */
.lcm-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;margin-bottom:18px}
.lcm-stat{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:14px 16px}
.lcm-stat-val{font-size:28px;font-weight:800;letter-spacing:-0.04em;line-height:1;margin-bottom:4px}
.lcm-stat-label{font-size:10px;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;color:var(--fg-muted)}

/* ── Agent card ────────────────────────────────────── */
.lcm-agent-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:border-color 120ms}
.lcm-agent-card:hover{border-color:var(--border-strong)}
.lcm-agent-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border)}
.lcm-agent-avatar{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-size:13px;font-weight:700;flex-shrink:0}
.lcm-agent-body{padding:12px 16px;display:flex;flex-direction:column;gap:10px}
.lcm-agent-footer{padding:10px 16px;border-top:1px solid var(--border);background:var(--bg-subtle);display:flex;gap:6px;flex-wrap:wrap}

/* ── Assignment row ────────────────────────────────── */
.lcm-assignment-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg-subtle);flex-wrap:wrap}
.lcm-assignment-row.overdue{border-color:color-mix(in srgb,var(--accent-rose) 22%,transparent);background:color-mix(in srgb,var(--accent-rose) 4%,var(--bg-subtle))}
.lcm-assignment-row.completed{opacity:.7}

/* ── Status badge ──────────────────────────────────── */
.lcm-status{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 8px;border-radius:5px;font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;flex-shrink:0}
.lcm-status-assigned{background:color-mix(in srgb,var(--accent-blue) 12%,transparent);color:var(--accent-blue)}
.lcm-status-in_progress{background:color-mix(in srgb,var(--accent-amber) 12%,transparent);color:var(--accent-amber)}
.lcm-status-completed{background:color-mix(in srgb,var(--accent-emerald) 12%,transparent);color:var(--accent-emerald)}
.lcm-status-verified{background:color-mix(in srgb,var(--accent-violet) 12%,transparent);color:var(--accent-violet)}
.lcm-status-cancelled{background:var(--bg-subtle);color:var(--fg-muted)}
.lcm-status-overdue{background:color-mix(in srgb,var(--accent-rose) 12%,transparent);color:var(--accent-rose)}

/* ── Drill-down panel ──────────────────────────────── */
.lcm-drill{background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:14px;padding:20px;margin-bottom:20px;animation:lcmFadeUp 180ms ease both}
.lcm-drill-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
@keyframes lcmFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

/* ── Note card ─────────────────────────────────────── */
.lcm-note-card{padding:12px 14px;border-radius:10px;border:1px solid var(--border);background:var(--bg-subtle);border-left:3px solid var(--accent-cyan)}
.lcm-note-meta{font-size:10px;color:var(--fg-muted);margin-bottom:6px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase}
.lcm-note-text{font-size:12px;color:var(--fg-default);line-height:1.6}

/* ── Divider ───────────────────────────────────────── */
.lcm-divider{height:1px;background:var(--border);margin:6px 0}

/* ── Section title inside panels ──────────────────── */
.lcm-section-label{font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:var(--fg-muted);margin-bottom:8px}

/* ── Confirm dialog ────────────────────────────────── */
.lcm-confirm-overlay{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;animation:fadeIn 120ms ease}
.lcm-confirm-card{background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:14px;padding:28px 32px;max-width:380px;width:calc(100vw - 32px);animation:scaleIn 180ms cubic-bezier(.16,1,.3,1) both;text-align:center}
.lcm-confirm-icon{font-size:32px;margin-bottom:12px}
.lcm-confirm-title{font-size:16px;font-weight:700;color:var(--fg-default);margin-bottom:8px;letter-spacing:-0.02em}
.lcm-confirm-body{font-size:13px;color:var(--fg-muted);line-height:1.6;margin-bottom:22px}
.lcm-confirm-actions{display:flex;gap:10px;justify-content:center}
@keyframes scaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}

/* ── Responsive ────────────────────────────────────── */
@media(max-width:640px){
  .lcm-stats{grid-template-columns:1fr 1fr}
  .lcm-agent-card .lcm-form-row{grid-template-columns:1fr}
}
`;

function injectLCMStyles() {
  if (document.getElementById(LCM_CSS_ID)) return;
  const el = document.createElement("style");
  el.id = LCM_CSS_ID;
  el.textContent = LCM_CSS;
  document.head.appendChild(el);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: LearningRole[] = ["all", "admin", "qa", "supervisor", "agent"];
const DIFFICULTY_OPTIONS: LearningDifficulty[] = ["beginner", "intermediate", "advanced"];
const SEVERITY_OPTIONS: DefectExample["severity"][] = ["low", "medium", "high", "critical"];
const ASSIGNMENT_STATUSES = ["assigned", "in_progress", "completed", "verified", "cancelled"] as const;

const TITLES: Record<ContentManagerKind, { title: string; sub: string; empty: string }> = {
  modules: { title: "Training Module Manager", sub: "Create, edit, and organize training modules with role targeting and XP rewards.", empty: "No training modules found." },
  sops: { title: "SOP Library Manager", sub: "Manage version-controlled standard operating procedures.", empty: "No SOPs found." },
  "work-instructions": { title: "Work Instructions Manager", sub: "Build short step-by-step guides for audit workflows.", empty: "No work instructions found." },
  defects: { title: "Defect Examples Manager", sub: "Document real audit failures with correct behavior explanations.", empty: "No defect examples found." },
  standards: { title: "Quality Standards Manager", sub: "Define score bands, labels, and thresholds for performance tiers.", empty: "No quality standards found." },
  onboarding: { title: "Onboarding Materials Manager", sub: "Construct role-based onboarding tracks with linked module steps.", empty: "No onboarding tracks found." },
  "best-practices": { title: "Best Practices Manager", sub: "Curate high-performing examples from top agents and supervisors.", empty: "No best practices found." },
  coaching: { title: "Supervisor Coaching Manager", sub: "Assign training, track completions, and log coaching notes per agent.", empty: "No coaching records found." },
};

// ─── Utils ────────────────────────────────────────────────────────────────────

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitLines(v: string): string[] {
  return v.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

function joinLines(v?: readonly string[]): string {
  return (v ?? []).join("\n");
}

function parseChangeLog(v: string): SOPDocument["changeLog"] {
  return v.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const [version = "1.0", date = today(), ...rest] = l.split("|").map(p => p.trim());
    return { version, date, summary: rest.join(" | ") || "Updated" };
  });
}

function stringifyChangeLog(v?: SOPDocument["changeLog"]): string {
  return (v ?? []).map(e => `${e.version} | ${e.date} | ${e.summary}`).join("\n");
}

function parseOnboardingSteps(v: string): OnboardingTrack["steps"] {
  return v.split("\n").map(l => l.trim()).filter(Boolean).map((l, i) => {
    const [title = `Step ${i + 1}`, description = "", moduleId = ""] = l.split("|").map(p => p.trim());
    return { id: makeId("step"), title, description, moduleId: moduleId || null };
  });
}

function stringifyOnboardingSteps(v?: OnboardingTrack["steps"]): string {
  return (v ?? []).map(s => `${s.title} | ${s.description} | ${s.moduleId ?? ""}`).join("\n");
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function futureDateISO(days = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function isOpen(a: LearningAssignment): boolean {
  return !["completed", "verified", "cancelled"].includes(a.status ?? "assigned");
}

function isOverdue(a: LearningAssignment): boolean {
  if (!a.dueDate || !isOpen(a)) return false;
  return a.dueDate < today();
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function moduleMatchesMetric(m: LearningModule, metric: string): boolean {
  const target = normalizeText(metric);
  if (!target) return false;
  const hay = [m.title, m.description, m.category, ...(m.metrics ?? []), ...(m.tags ?? [])].map(normalizeText).join("|");
  return hay.includes(target) || target.includes(normalizeText(m.title));
}

function recommendedForAgent(agent: TeamMember, modules: LearningModule[]): LearningModule[] {
  const failed = agent.failedMetrics ?? [];
  if (!failed.length) return [];
  const matches = modules.filter(m => failed.some(f => moduleMatchesMetric(m, f)));
  return matches.length ? matches.slice(0, 3) : modules.slice(0, 2);
}

function countByMetric(teamData: TeamMember[]): { metric: string; count: number }[] {
  const counts = new Map<string, number>();
  teamData.forEach(a => (a.failedMetrics ?? []).forEach(m => counts.set(m, (counts.get(m) ?? 0) + 1)));
  return Array.from(counts.entries()).map(([metric, count]) => ({ metric, count })).sort((a, b) => b.count - a.count).slice(0, 6);
}

function coachingTemplate(agent: TeamMember, metric?: string): string {
  const focus = metric || agent.failedMetrics[0] || "quality performance";
  return `Observed gap in ${focus}. Recommend completing the assigned training module and reviewing the related QA standard. Will follow up after next audit to confirm improvement.`;
}

function statusClass(status?: string): string {
  const s = status ?? "assigned";
  return `lcm-status lcm-status-${s}`;
}

function statusLabel(status?: string): string {
  return (status ?? "assigned").replace(/_/g, " ");
}

// ─── Toast system ─────────────────────────────────────────────────────────────

interface Toast { id: string; message: string; kind: "success" | "error" | "info" }

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, kind: Toast["kind"] = "success") => {
    const id = makeId("toast");
    setToasts(prev => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);
  return { toasts, push };
}

const ToastHost = memo(function ToastHost({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null;
  return (
    <div className="lcm-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`lcm-toast ${t.kind}`}>
          {t.kind === "success" ? "✓" : t.kind === "error" ? "✕" : "ℹ"} {t.message}
        </div>
      ))}
    </div>
  );
});

// ─── Confirm dialog ───────────────────────────────────────────────────────────

interface ConfirmState { message: string; onConfirm: () => void }

function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);
  const request = useCallback((message: string, onConfirm: () => void) => {
    setState({ message, onConfirm });
  }, []);
  const resolve = useCallback((yes: boolean) => {
    if (yes) state?.onConfirm();
    setState(null);
  }, [state]);
  return { confirmState: state, request, resolve };
}

const ConfirmDialog = memo(function ConfirmDialog({ state, onResolve }: { state: ConfirmState; onResolve: (yes: boolean) => void }) {
  return (
    <div className="lcm-confirm-overlay" onClick={() => onResolve(false)}>
      <div className="lcm-confirm-card" onClick={e => e.stopPropagation()}>
        <div className="lcm-confirm-icon">🗑️</div>
        <div className="lcm-confirm-title">Confirm Delete</div>
        <div className="lcm-confirm-body">{state.message}</div>
        <div className="lcm-confirm-actions">
          <button className="lcm-btn lcm-btn-ghost" onClick={() => onResolve(false)}>Cancel</button>
          <button className="lcm-btn lcm-btn-danger" onClick={() => onResolve(true)}>Delete</button>
        </div>
      </div>
    </div>
  );
});

// ─── Reusable primitives ──────────────────────────────────────────────────────

function SearchBar({ value, onChange, placeholder = "Search…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="lcm-search">
      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--fg-muted)" }}>
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input className="lcm-search-input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {value && <button onClick={() => onChange("")} style={{ background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer", fontSize: 13, padding: 0, lineHeight: 1 }}>✕</button>}
    </div>
  );
}

interface FieldProps { label: string; required?: boolean; hint?: string; error?: string; children: ReactNode }
function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <div className="lcm-field">
      <span className={`lcm-label${required ? " lcm-label-required" : ""}`}>{label}</span>
      {children}
      {hint && !error && <span className="lcm-field-hint">{hint}</span>}
      {error && <span className="lcm-field-error">{error}</span>}
    </div>
  );
}

function Input({ value, onChange, placeholder, error, type = "text", min, max }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string;
  error?: boolean; type?: string; min?: number; max?: number;
}) {
  return (
    <input
      className={`lcm-input${error ? " error" : ""}`}
      type={type} value={value} min={min} max={max}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function Select({ value, onChange, options, error }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; error?: boolean;
}) {
  return (
    <select className={`lcm-select${error ? " error" : ""}`} value={value} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Textarea({ value, onChange, placeholder, error, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; error?: boolean; rows?: number;
}) {
  return (
    <textarea
      className={`lcm-textarea${error ? " error" : ""}`}
      value={value} rows={rows}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function Btn({ children, onClick, variant = "ghost", size, disabled, loading, type = "button" }: {
  children: ReactNode; onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "blue" | "emerald" | "amber";
  size?: "sm"; disabled?: boolean; loading?: boolean; type?: "button" | "submit";
}) {
  return (
    <button
      type={type} disabled={disabled || loading}
      className={`lcm-btn lcm-btn-${variant}${size ? ` lcm-btn-${size}` : ""}`}
      onClick={onClick}
    >
      {loading && <span className={`lcm-spinner${variant !== "primary" ? " lcm-spinner-dark" : ""}`} />}
      {children}
    </button>
  );
}

// ─── ItemList — generic sorted/filtered list ──────────────────────────────────

interface ListItem { id: string; title: string; badges?: { label: string; color?: string }[]; meta?: string }

function ItemList<T extends ListItem>({ items, editingId, onEdit, onDelete, empty }: {
  items: T[]; editingId?: string;
  onEdit: (item: T) => void; onDelete: (item: T) => void; empty: string;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? items.filter(i => i.title.toLowerCase().includes(q) || (i.meta ?? "").toLowerCase().includes(q)) : items;
  }, [items, search]);

  return (
    <>
      {items.length > 4 && <SearchBar value={search} onChange={setSearch} placeholder="Filter list…" />}
      <div className="lcm-list">
        {!filtered.length && <div className="lcm-list-empty">{search ? `No results for "${search}"` : empty}</div>}
        {filtered.map(item => (
          <div key={item.id} className={`lcm-list-item${editingId === item.id ? " editing" : ""}`}>
            <div className="lcm-list-item-body">
              <div className="lcm-list-item-title">{item.title}</div>
              <div className="lcm-list-item-meta">
                {item.badges?.map((b, i) => (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center", height: 18, padding: "0 7px", borderRadius: 4, fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", background: `color-mix(in srgb,${b.color ?? "var(--accent-blue)"} 12%,transparent)`, color: b.color ?? "var(--accent-blue)" }}>{b.label}</span>
                ))}
                {item.meta && <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>{item.meta}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <Btn size="sm" variant="ghost" onClick={() => onEdit(item)}>Edit</Btn>
              <Btn size="sm" variant="danger" onClick={() => onDelete(item)}>Delete</Btn>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── FormCard wrapper ─────────────────────────────────────────────────────────

function FormCard({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="lcm-form-card">
      <div className="lcm-form-header"><span className="lcm-form-title">{title}</span></div>
      <div className="lcm-form-body">{children}</div>
      <div className="lcm-form-footer">{footer}</div>
    </div>
  );
}

// ─── ManagerShell ─────────────────────────────────────────────────────────────

function ManagerShell({ kind, children, onNew }: { kind: ContentManagerKind; children: ReactNode; onNew: () => void }) {
  const meta = TITLES[kind];
  return (
    <div className="lcm-root">
      <div className="lcm-header">
        <div className="lcm-header-text">
          <div className="lcm-title">{meta.title}</div>
          <div className="lcm-sub">{meta.sub}</div>
        </div>
        <Btn variant="primary" onClick={onNew}>+ New</Btn>
      </div>
      {children}
    </div>
  );
}

// ─── Module Manager ───────────────────────────────────────────────────────────

type ModuleErrors = Partial<Record<keyof LearningModule, string>>;

function blankModule(): LearningModule {
  return { id: "", title: "", description: "", category: "General", difficulty: "beginner", durationMin: 15, xpReward: 100, content: "", author: "QA Training", updatedAt: today(), rating: 4.5, completions: 0, tags: [], roles: ["agent"], steps: [], metrics: [] };
}

const ModuleManager = memo(function ModuleManager({ items, onSave, onDelete, toast, confirm }: {
  items: LearningModule[];
  onSave: (item: LearningModule) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  confirm: (msg: string, fn: () => void) => void;
}) {
  const [draft, setDraft] = useState<LearningModule>(blankModule);
  const [tags, setTags] = useState("");
  const [steps, setSteps] = useState("");
  const [metrics, setMetrics] = useState("");
  const [errors, setErrors] = useState<ModuleErrors>({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const edit = useCallback((item: LearningModule) => {
    setDraft({ ...item });
    setTags(joinLines(item.tags));
    setSteps(joinLines(item.steps));
    setMetrics(joinLines(item.metrics));
    setErrors({});
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const reset = useCallback(() => {
    setDraft(blankModule());
    setTags(""); setSteps(""); setMetrics(""); setErrors({});
  }, []);

  const validate = (): boolean => {
    const e: ModuleErrors = {};
    if (!draft.title.trim()) e.title = "Title is required";
    if (draft.durationMin < 1) e.durationMin = "Must be at least 1 minute";
    if (draft.xpReward < 0) e.xpReward = "XP must be positive";
    if (!draft.content.trim()) e.content = "Content is required";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const save = async () => {
    if (!validate()) { toast("Please fix the highlighted fields.", "error"); return; }
    setSaving(true);
    try {
      const next: LearningModule = { ...draft, id: draft.id || makeId("module"), tags: splitLines(tags), steps: splitLines(steps), metrics: splitLines(metrics), updatedAt: today() };
      await onSave(next);
      toast(draft.id ? "Module updated." : "Module created.");
      edit(next);
    } catch {
      toast("Save failed. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (role: LearningRole) => {
    setDraft(d => {
      const roles = new Set(d.roles);
      roles.has(role) ? roles.delete(role) : roles.add(role);
      return { ...d, roles: roles.size ? Array.from(roles) : ["agent"] };
    });
  };

  const listItems = useMemo(() => items.map(m => ({
    ...m,
    badges: [
      { label: m.difficulty, color: m.difficulty === "beginner" ? "var(--accent-emerald)" : m.difficulty === "intermediate" ? "var(--accent-amber)" : "var(--accent-rose)" },
      { label: m.category, color: "var(--accent-violet)" },
      { label: `${m.xpReward} XP`, color: "var(--accent-blue)" },
    ],
    meta: `${m.durationMin} min · ${m.author}`,
  })), [items]);

  return (
    <ManagerShell kind="modules" onNew={reset}>
      <ItemList items={listItems} editingId={draft.id} onEdit={item => edit(items.find(m => m.id === item.id)!)} onDelete={item => confirm(`Delete module "${item.title}"?`, async () => { await onDelete(item.id); toast("Module deleted."); })} empty={TITLES.modules.empty} />
      <div ref={formRef}>
        <FormCard
          title={draft.id ? `Editing: ${draft.title || "Untitled"}` : "New Training Module"}
          footer={
            <>
              <Btn variant="ghost" onClick={reset}>Discard</Btn>
              <Btn variant="primary" onClick={save} loading={saving}>{draft.id ? "Save Changes" : "Create Module"}</Btn>
            </>
          }
        >
          <div className="lcm-form-row-3">
            <Field label="Title" required error={errors.title}><Input value={draft.title} onChange={v => setDraft(d => ({ ...d, title: v }))} error={!!errors.title} placeholder="e.g. Return Label Fundamentals" /></Field>
            <Field label="Category"><Input value={draft.category} onChange={v => setDraft(d => ({ ...d, category: v }))} placeholder="e.g. Documentation" /></Field>
            <Field label="Difficulty">
              <Select value={draft.difficulty} onChange={v => setDraft(d => ({ ...d, difficulty: v as LearningDifficulty }))} options={DIFFICULTY_OPTIONS.map(d => ({ value: d, label: d.charAt(0).toUpperCase() + d.slice(1) }))} />
            </Field>
          </div>
          <div className="lcm-form-row">
            <Field label="Duration (minutes)" error={String(errors.durationMin ?? "")}><Input type="number" value={draft.durationMin} onChange={v => setDraft(d => ({ ...d, durationMin: Number(v) }))} min={1} error={!!errors.durationMin} /></Field>
            <Field label="XP Reward" error={String(errors.xpReward ?? "")}><Input type="number" value={draft.xpReward} onChange={v => setDraft(d => ({ ...d, xpReward: Number(v) }))} min={0} error={!!errors.xpReward} /></Field>
          </div>
          <Field label="Author"><Input value={draft.author} onChange={v => setDraft(d => ({ ...d, author: v }))} /></Field>
          <Field label="Description"><Textarea value={draft.description} onChange={v => setDraft(d => ({ ...d, description: v }))} placeholder="Short summary shown on the module card…" rows={2} /></Field>
          <Field label="Content" required error={errors.content}><Textarea value={draft.content} onChange={v => setDraft(d => ({ ...d, content: v }))} placeholder="Full module content. Use **bold** for emphasis." rows={5} error={!!errors.content} /></Field>
          <div className="lcm-form-row">
            <Field label="Tags" hint="One per line or comma-separated"><Textarea value={tags} onChange={setTags} placeholder="return-label, documentation…" rows={3} /></Field>
            <Field label="Steps" hint="One step per line"><Textarea value={steps} onChange={setSteps} placeholder="Open the ticket\nVerify the order…" rows={3} /></Field>
          </div>
          <Field label="Related Metrics" hint="Metrics that trigger recommendation of this module"><Textarea value={metrics} onChange={setMetrics} placeholder="Return Label (RL)\nTicket Documentation" rows={2} /></Field>
          <Field label="Audience Roles">
            <div className="lcm-pill-group" style={{ marginTop: 2 }}>
              {ROLE_OPTIONS.map(r => <button key={r} type="button" className={`lcm-pill${draft.roles.includes(r) ? " active" : ""}`} onClick={() => toggleRole(r)}>{r}</button>)}
            </div>
          </Field>
          {draft.videoUrl !== undefined && (
            <Field label="Video URL" hint="Optional embedded video link"><Input value={draft.videoUrl ?? ""} onChange={v => setDraft(d => ({ ...d, videoUrl: v || undefined }))} placeholder="https://…" /></Field>
          )}
        </FormCard>
      </div>
    </ManagerShell>
  );
});

// ─── SOP Manager ──────────────────────────────────────────────────────────────

function blankSOP(): SOPDocument {
  return { id: "", title: "", version: "1.0", category: "General", content: "", updatedAt: today(), author: "QA Operations", changeLog: [] };
}

const SOPManager = memo(function SOPManager({ items, onSave, onDelete, toast, confirm }: {
  items: SOPDocument[];
  onSave: (item: SOPDocument) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  confirm: (msg: string, fn: () => void) => void;
}) {
  const [draft, setDraft] = useState<SOPDocument>(blankSOP);
  const [log, setLog] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const edit = (item: SOPDocument) => { setDraft({ ...item }); setLog(stringifyChangeLog(item.changeLog)); setErrors({}); formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  const reset = () => { setDraft(blankSOP()); setLog(""); setErrors({}); };
  const validate = () => { const e: Record<string, string> = {}; if (!draft.title.trim()) e.title = "Required"; if (!draft.content.trim()) e.content = "Required"; setErrors(e); return !Object.keys(e).length; };
  const save = async () => {
    if (!validate()) { toast("Please complete the required fields.", "error"); return; }
    setSaving(true);
    try { const next = { ...draft, id: draft.id || makeId("sop"), changeLog: parseChangeLog(log), updatedAt: today() }; await onSave(next); toast(draft.id ? "SOP updated." : "SOP created."); edit(next); }
    catch { toast("Save failed.", "error"); }
    finally { setSaving(false); }
  };

  const listItems = useMemo(() => items.map(s => ({ ...s, badges: [{ label: `v${s.version}`, color: "var(--accent-cyan)" }, { label: s.category }], meta: `by ${s.author} · updated ${s.updatedAt}` })), [items]);

  return (
    <ManagerShell kind="sops" onNew={reset}>
      <ItemList items={listItems} editingId={draft.id} onEdit={item => edit(items.find(s => s.id === item.id)!)} onDelete={item => confirm(`Delete SOP "${item.title}"?`, async () => { await onDelete(item.id); toast("SOP deleted."); })} empty={TITLES.sops.empty} />
      <div ref={formRef}>
        <FormCard title={draft.id ? `Editing: ${draft.title || "Untitled"}` : "New SOP"} footer={<><Btn variant="ghost" onClick={reset}>Discard</Btn><Btn variant="primary" onClick={save} loading={saving}>{draft.id ? "Save Changes" : "Create SOP"}</Btn></>}>
          <div className="lcm-form-row">
            <Field label="Title" required error={errors.title}><Input value={draft.title} onChange={v => setDraft(d => ({ ...d, title: v }))} error={!!errors.title} /></Field>
            <Field label="Version"><Input value={draft.version} onChange={v => setDraft(d => ({ ...d, version: v }))} placeholder="1.0" /></Field>
          </div>
          <div className="lcm-form-row">
            <Field label="Category"><Input value={draft.category} onChange={v => setDraft(d => ({ ...d, category: v }))} /></Field>
            <Field label="Author"><Input value={draft.author} onChange={v => setDraft(d => ({ ...d, author: v }))} /></Field>
          </div>
          <Field label="Content" required error={errors.content}><Textarea value={draft.content} onChange={v => setDraft(d => ({ ...d, content: v }))} placeholder="Full SOP content…" rows={6} error={!!errors.content} /></Field>
          <Field label="Change Log" hint="Format: version | date | summary, one per line"><Textarea value={log} onChange={setLog} placeholder="1.1 | 2026-04-29 | Updated return label steps" rows={3} /></Field>
        </FormCard>
      </div>
    </ManagerShell>
  );
});

// ─── Work Instruction Manager ─────────────────────────────────────────────────

function blankWI(): WorkInstruction {
  return { id: "", title: "", metric: "General", category: "General", steps: [], updatedAt: today() };
}

const WorkInstructionManager = memo(function WorkInstructionManager({ items, onSave, onDelete, toast, confirm }: {
  items: WorkInstruction[];
  onSave: (item: WorkInstruction) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  confirm: (msg: string, fn: () => void) => void;
}) {
  const [draft, setDraft] = useState<WorkInstruction>(blankWI);
  const [steps, setSteps] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const edit = (item: WorkInstruction) => { setDraft({ ...item }); setSteps(joinLines(item.steps)); setErrors({}); formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  const reset = () => { setDraft(blankWI()); setSteps(""); setErrors({}); };
  const validate = () => { const e: Record<string, string> = {}; if (!draft.title.trim()) e.title = "Required"; if (!steps.trim()) e.steps = "At least one step required"; setErrors(e); return !Object.keys(e).length; };
  const save = async () => {
    if (!validate()) { toast("Please fix errors.", "error"); return; }
    setSaving(true);
    try { const next = { ...draft, id: draft.id || makeId("wi"), steps: splitLines(steps), updatedAt: today() }; await onSave(next); toast("Work instruction saved."); edit(next); }
    catch { toast("Save failed.", "error"); }
    finally { setSaving(false); }
  };

  const listItems = useMemo(() => items.map(w => ({ ...w, badges: [{ label: w.metric, color: "var(--accent-blue)" }, { label: w.category }], meta: `${w.steps.length} steps · updated ${w.updatedAt}` })), [items]);

  return (
    <ManagerShell kind="work-instructions" onNew={reset}>
      <ItemList items={listItems} editingId={draft.id} onEdit={item => edit(items.find(w => w.id === item.id)!)} onDelete={item => confirm(`Delete "${item.title}"?`, async () => { await onDelete(item.id); toast("Deleted."); })} empty={TITLES["work-instructions"].empty} />
      <div ref={formRef}>
        <FormCard title={draft.id ? `Editing: ${draft.title}` : "New Work Instruction"} footer={<><Btn variant="ghost" onClick={reset}>Discard</Btn><Btn variant="primary" onClick={save} loading={saving}>{draft.id ? "Save Changes" : "Create"}</Btn></>}>
          <div className="lcm-form-row-3">
            <Field label="Title" required error={errors.title}><Input value={draft.title} onChange={v => setDraft(d => ({ ...d, title: v }))} error={!!errors.title} /></Field>
            <Field label="Metric"><Input value={draft.metric} onChange={v => setDraft(d => ({ ...d, metric: v }))} /></Field>
            <Field label="Category"><Input value={draft.category} onChange={v => setDraft(d => ({ ...d, category: v }))} /></Field>
          </div>
          <Field label="Steps" required error={errors.steps} hint="One step per line"><Textarea value={steps} onChange={setSteps} placeholder="Open the Zendesk ticket\nVerify order number matches…" rows={6} error={!!errors.steps} /></Field>
        </FormCard>
      </div>
    </ManagerShell>
  );
});

// ─── Defect Manager ───────────────────────────────────────────────────────────

function blankDefect(): DefectExample {
  return { id: "", title: "", metric: "General", severity: "medium", whatWentWrong: "", correctBehavior: "" };
}

const DefectManager = memo(function DefectManager({ items, onSave, onDelete, toast, confirm }: {
  items: DefectExample[];
  onSave: (item: DefectExample) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  confirm: (msg: string, fn: () => void) => void;
}) {
  const [draft, setDraft] = useState<DefectExample>(blankDefect);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const severityColor = { low: "var(--fg-muted)", medium: "var(--accent-amber)", high: "var(--accent-rose)", critical: "var(--accent-rose)" };

  const edit = (item: DefectExample) => { setDraft({ ...item }); setErrors({}); formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  const reset = () => { setDraft(blankDefect()); setErrors({}); };
  const validate = () => { const e: Record<string, string> = {}; if (!draft.title.trim()) e.title = "Required"; if (!draft.whatWentWrong.trim()) e.whatWentWrong = "Required"; if (!draft.correctBehavior.trim()) e.correctBehavior = "Required"; setErrors(e); return !Object.keys(e).length; };
  const save = async () => {
    if (!validate()) { toast("Please fill all required fields.", "error"); return; }
    setSaving(true);
    try { const next = { ...draft, id: draft.id || makeId("defect") }; await onSave(next); toast("Defect example saved."); edit(next); }
    catch { toast("Save failed.", "error"); }
    finally { setSaving(false); }
  };

  const listItems = useMemo(() => items.map(d => ({ ...d, badges: [{ label: d.metric, color: "var(--accent-blue)" }, { label: d.severity, color: severityColor[d.severity] }], meta: d.whatWentWrong.slice(0, 60) + "…" })), [items]);

  return (
    <ManagerShell kind="defects" onNew={reset}>
      <ItemList items={listItems} editingId={draft.id} onEdit={item => edit(items.find(d => d.id === item.id)!)} onDelete={item => confirm(`Delete defect "${item.title}"?`, async () => { await onDelete(item.id); toast("Deleted."); })} empty={TITLES.defects.empty} />
      <div ref={formRef}>
        <FormCard title={draft.id ? `Editing: ${draft.title}` : "New Defect Example"} footer={<><Btn variant="ghost" onClick={reset}>Discard</Btn><Btn variant="primary" onClick={save} loading={saving}>{draft.id ? "Save Changes" : "Create"}</Btn></>}>
          <div className="lcm-form-row-3">
            <Field label="Title" required error={errors.title}><Input value={draft.title} onChange={v => setDraft(d => ({ ...d, title: v }))} error={!!errors.title} /></Field>
            <Field label="Metric"><Input value={draft.metric} onChange={v => setDraft(d => ({ ...d, metric: v }))} /></Field>
            <Field label="Severity">
              <Select value={draft.severity} onChange={v => setDraft(d => ({ ...d, severity: v as DefectExample["severity"] }))} options={SEVERITY_OPTIONS.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} />
            </Field>
          </div>
          <div className="lcm-form-row">
            <Field label="What Went Wrong" required error={errors.whatWentWrong}><Textarea value={draft.whatWentWrong} onChange={v => setDraft(d => ({ ...d, whatWentWrong: v }))} rows={4} error={!!errors.whatWentWrong} placeholder="Describe the failure…" /></Field>
            <Field label="Correct Behavior" required error={errors.correctBehavior}><Textarea value={draft.correctBehavior} onChange={v => setDraft(d => ({ ...d, correctBehavior: v }))} rows={4} error={!!errors.correctBehavior} placeholder="Describe the expected behavior…" /></Field>
          </div>
        </FormCard>
      </div>
    </ManagerShell>
  );
});

// ─── Standards Manager ────────────────────────────────────────────────────────

function blankStandard(): QualityStandard {
  return { id: "", name: "", min: 70, color: "var(--accent-blue)", desc: "" };
}

const StandardsManager = memo(function StandardsManager({ items, onSave, onDelete, toast, confirm }: {
  items: QualityStandard[];
  onSave: (item: QualityStandard) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  confirm: (msg: string, fn: () => void) => void;
}) {
  const [draft, setDraft] = useState<QualityStandard>(blankStandard);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const edit = (item: QualityStandard) => { setDraft({ ...item }); formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  const reset = () => setDraft(blankStandard());
  const save = async () => {
    if (!draft.name.trim()) { toast("Name is required.", "error"); return; }
    setSaving(true);
    try { const next = { ...draft, id: draft.id || makeId("standard") }; await onSave(next); toast("Standard saved."); edit(next); }
    catch { toast("Save failed.", "error"); }
    finally { setSaving(false); }
  };

  const listItems = useMemo(() => items.map(s => ({ ...s, title: s.name, badges: [{ label: `${s.min}%+`, color: s.color }], meta: s.desc.slice(0, 70) })), [items]);

  return (
    <ManagerShell kind="standards" onNew={reset}>
      <ItemList items={listItems} editingId={draft.id} onEdit={item => edit(items.find(s => s.id === item.id)!)} onDelete={item => confirm(`Delete standard "${item.title}"?`, async () => { await onDelete(item.id); toast("Deleted."); })} empty={TITLES.standards.empty} />
      <div ref={formRef}>
        <FormCard title={draft.id ? `Editing: ${draft.name}` : "New Quality Standard"} footer={<><Btn variant="ghost" onClick={reset}>Discard</Btn><Btn variant="primary" onClick={save} loading={saving}>{draft.id ? "Save Changes" : "Create"}</Btn></>}>
          <div className="lcm-form-row-3">
            <Field label="Name" required><Input value={draft.name} onChange={v => setDraft(d => ({ ...d, name: v }))} placeholder="e.g. Excellent" /></Field>
            <Field label="Minimum Score %" hint="Scores at or above this value qualify"><Input type="number" value={draft.min} onChange={v => setDraft(d => ({ ...d, min: Number(v) }))} min={0} max={100} /></Field>
            <Field label="Color Token" hint="e.g. var(--accent-emerald)"><Input value={draft.color} onChange={v => setDraft(d => ({ ...d, color: v }))} /></Field>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: `color-mix(in srgb,${draft.color} 10%,var(--bg-subtle))`, border: `1px solid color-mix(in srgb,${draft.color} 20%,transparent)` }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: draft.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: draft.color, fontWeight: 600 }}>Preview: {draft.name || "Standard name"} ({draft.min}%+)</span>
          </div>
          <Field label="Description"><Textarea value={draft.desc} onChange={v => setDraft(d => ({ ...d, desc: v }))} rows={2} placeholder="What this score tier means…" /></Field>
        </FormCard>
      </div>
    </ManagerShell>
  );
});

// ─── Best Practices Manager ───────────────────────────────────────────────────

function blankBP(): BestPractice {
  return { id: "", title: "", category: "General", quote: "", agentLabel: "QA Training", metric: "General" };
}

const BestPracticeManager = memo(function BestPracticeManager({ items, onSave, onDelete, toast, confirm }: {
  items: BestPractice[];
  onSave: (item: BestPractice) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  confirm: (msg: string, fn: () => void) => void;
}) {
  const [draft, setDraft] = useState<BestPractice>(blankBP);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const edit = (item: BestPractice) => { setDraft({ ...item }); setErrors({}); formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  const reset = () => { setDraft(blankBP()); setErrors({}); };
  const validate = () => { const e: Record<string, string> = {}; if (!draft.title.trim()) e.title = "Required"; if (!draft.quote.trim()) e.quote = "Required"; setErrors(e); return !Object.keys(e).length; };
  const save = async () => {
    if (!validate()) { toast("Please fix errors.", "error"); return; }
    setSaving(true);
    try { const next = { ...draft, id: draft.id || makeId("bp") }; await onSave(next); toast("Best practice saved."); edit(next); }
    catch { toast("Save failed.", "error"); }
    finally { setSaving(false); }
  };

  const listItems = useMemo(() => items.map(b => ({ ...b, badges: [{ label: b.category, color: "var(--accent-emerald)" }, { label: b.metric }], meta: `— ${b.agentLabel}` })), [items]);

  return (
    <ManagerShell kind="best-practices" onNew={reset}>
      <ItemList items={listItems} editingId={draft.id} onEdit={item => edit(items.find(b => b.id === item.id)!)} onDelete={item => confirm(`Delete "${item.title}"?`, async () => { await onDelete(item.id); toast("Deleted."); })} empty={TITLES["best-practices"].empty} />
      <div ref={formRef}>
        <FormCard title={draft.id ? `Editing: ${draft.title}` : "New Best Practice"} footer={<><Btn variant="ghost" onClick={reset}>Discard</Btn><Btn variant="primary" onClick={save} loading={saving}>{draft.id ? "Save Changes" : "Create"}</Btn></>}>
          <div className="lcm-form-row">
            <Field label="Title" required error={errors.title}><Input value={draft.title} onChange={v => setDraft(d => ({ ...d, title: v }))} error={!!errors.title} /></Field>
            <Field label="Category"><Input value={draft.category} onChange={v => setDraft(d => ({ ...d, category: v }))} /></Field>
          </div>
          <div className="lcm-form-row">
            <Field label="Agent / Source"><Input value={draft.agentLabel} onChange={v => setDraft(d => ({ ...d, agentLabel: v }))} /></Field>
            <Field label="Metric"><Input value={draft.metric} onChange={v => setDraft(d => ({ ...d, metric: v }))} /></Field>
          </div>
          <Field label="Quote / Example" required error={errors.quote}><Textarea value={draft.quote} onChange={v => setDraft(d => ({ ...d, quote: v }))} rows={4} placeholder="The standout behavior or quote from this agent…" error={!!errors.quote} /></Field>
        </FormCard>
      </div>
    </ManagerShell>
  );
});

// ─── Onboarding Manager ───────────────────────────────────────────────────────

function blankOnboarding(): OnboardingTrack {
  return { id: "", label: "", subtitle: "", badgeLabel: "Agent", steps: [] };
}

const OnboardingManager = memo(function OnboardingManager({ items, onSave, onDelete, toast, confirm }: {
  items: OnboardingTrack[];
  onSave: (item: OnboardingTrack) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  confirm: (msg: string, fn: () => void) => void;
}) {
  const [draft, setDraft] = useState<OnboardingTrack>(blankOnboarding);
  const [steps, setSteps] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const edit = (item: OnboardingTrack) => { setDraft({ ...item }); setSteps(stringifyOnboardingSteps(item.steps)); setErrors({}); formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
  const reset = () => { setDraft(blankOnboarding()); setSteps(""); setErrors({}); };
  const validate = () => { const e: Record<string, string> = {}; if (!draft.label.trim()) e.label = "Required"; setErrors(e); return !Object.keys(e).length; };
  const save = async () => {
    if (!validate()) { toast("Label is required.", "error"); return; }
    setSaving(true);
    try { const next = { ...draft, id: draft.id || makeId("onboarding"), steps: parseOnboardingSteps(steps) }; await onSave(next); toast("Onboarding track saved."); edit(next); }
    catch { toast("Save failed.", "error"); }
    finally { setSaving(false); }
  };

  const listItems = useMemo(() => items.map(o => ({ ...o, title: o.label, badges: [{ label: o.badgeLabel, color: "var(--accent-violet)" }], meta: `${o.steps.length} steps · ${o.subtitle}` })), [items]);

  return (
    <ManagerShell kind="onboarding" onNew={reset}>
      <ItemList items={listItems} editingId={draft.id} onEdit={item => edit(items.find(o => o.id === item.id)!)} onDelete={item => confirm(`Delete track "${item.title}"?`, async () => { await onDelete(item.id); toast("Deleted."); })} empty={TITLES.onboarding.empty} />
      <div ref={formRef}>
        <FormCard title={draft.id ? `Editing: ${draft.label}` : "New Onboarding Track"} footer={<><Btn variant="ghost" onClick={reset}>Discard</Btn><Btn variant="primary" onClick={save} loading={saving}>{draft.id ? "Save Changes" : "Create"}</Btn></>}>
          <div className="lcm-form-row">
            <Field label="Track Label" required error={errors.label}><Input value={draft.label} onChange={v => setDraft(d => ({ ...d, label: v }))} error={!!errors.label} placeholder="e.g. Agent Onboarding Track" /></Field>
            <Field label="Role Badge"><Input value={draft.badgeLabel} onChange={v => setDraft(d => ({ ...d, badgeLabel: v }))} placeholder="Agent, Supervisor…" /></Field>
          </div>
          <Field label="Subtitle"><Input value={draft.subtitle} onChange={v => setDraft(d => ({ ...d, subtitle: v }))} placeholder="Short description shown below the title" /></Field>
          <Field label="Steps" hint="Format: Step title | description | module-id (one per line)">
            <Textarea value={steps} onChange={setSteps} rows={6} placeholder={"Welcome orientation | Review platform overview | module-abc\nQA Basics | Complete QA Foundations module | module-xyz"} />
          </Field>
        </FormCard>
      </div>
    </ManagerShell>
  );
});

// ─── Coaching Manager ─────────────────────────────────────────────────────────

function agentId(agent: TeamMember): string {
  return agent.agentId ?? agent.id;
}

const CoachingManager = memo(function CoachingManager({
  teamData, coachingNotes, modules, quizzes, assignments,
  onCreateAssignment, onUpdateAssignment, onDeleteAssignment,
  onSaveCoachingNote, onDeleteCoachingNote,
  toast, confirm,
}: {
  teamData: TeamMember[];
  coachingNotes: CoachingNote[];
  modules: LearningModule[];
  quizzes: Quiz[];
  assignments: LearningAssignment[];
  onCreateAssignment: NonNullable<LearningContentManagerProps["onCreateAssignment"]>;
  onUpdateAssignment: NonNullable<LearningContentManagerProps["onUpdateAssignment"]>;
  onDeleteAssignment: NonNullable<LearningContentManagerProps["onDeleteAssignment"]>;
  onSaveCoachingNote: NonNullable<LearningContentManagerProps["onSaveCoachingNote"]>;
  onDeleteCoachingNote: NonNullable<LearningContentManagerProps["onDeleteCoachingNote"]>;
  toast: (msg: string, kind?: Toast["kind"]) => void;
  confirm: (msg: string, fn: () => void) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<{ id?: string; agentId: string; note: string; metric: string }>({ agentId: "", note: "", metric: "" });
  const [assigningKeys, setAssigningKeys] = useState<Set<string>>(new Set());
  const [savingNote, setSavingNote] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const noteFormRef = useRef<HTMLDivElement>(null);
  const drillRef = useRef<HTMLDivElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const openAssignments = useMemo(() => assignments.filter(isOpen), [assignments]);
  const overdueAssignments = useMemo(() => assignments.filter(isOverdue), [assignments]);
  const needsCoaching = useMemo(() => teamData.filter(a => (a.failedMetrics ?? []).length > 0), [teamData]);
  const topMetrics = useMemo(() => countByMetric(teamData), [teamData]);
  const completedCount = useMemo(() => assignments.filter(a => a.status === "completed").length, [assignments]);
  const verifiedCount = useMemo(() => assignments.filter(a => a.status === "verified").length, [assignments]);

  const filteredAgents = useMemo(() => {
    const q = agentSearch.toLowerCase();
    return teamData.filter(a => !q || a.name.toLowerCase().includes(q) || (a.team ?? "").toLowerCase().includes(q) || (a.failedMetrics ?? []).some(m => m.toLowerCase().includes(q)));
  }, [teamData, agentSearch]);

  const selectedAgent = useMemo(() => selectedId ? teamData.find(a => agentId(a) === selectedId || a.id === selectedId) ?? null : null, [teamData, selectedId]);

  const agentAssignments = useCallback((agent: TeamMember) =>
    assignments.filter(a => a.agentId === agentId(agent) || a.agentId === agent.id),
  [assignments]);

  const filteredAgentAssignments = useCallback((agent: TeamMember) => {
    const all = agentAssignments(agent);
    return statusFilter === "all" ? all : all.filter(a => (a.status ?? "assigned") === statusFilter);
  }, [agentAssignments, statusFilter]);

  const agentNotes = useCallback((agent: TeamMember) =>
    coachingNotes.filter(n => n.agentId === agentId(agent) || n.agentId === agent.id),
  [coachingNotes]);

  // ── Assignment actions ─────────────────────────────────────────────────────
  const assign = useCallback(async (agent: TeamMember, module: LearningModule, quiz?: Quiz) => {
    const aid = agentId(agent);
    const key = `${aid}:${module.id}`;
    setAssigningKeys(prev => new Set([...prev, key]));
    try {
      await onCreateAssignment({ agentId: aid, moduleId: module.id, contentType: "module", contentId: module.id, title: module.title, dueDate: futureDateISO(7) });
      if (quiz) await onCreateAssignment({ agentId: aid, moduleId: module.id, contentType: "quiz", contentId: quiz.id, title: quiz.title, dueDate: futureDateISO(7) });
      toast(`Assigned "${module.title}" to ${agent.name}.`);
    } catch { toast("Assignment failed.", "error"); }
    finally { setAssigningKeys(prev => { const next = new Set(prev); next.delete(key); return next; }); }
  }, [onCreateAssignment, toast]);

  const assignAll = useCallback(async (agent: TeamMember) => {
    const recommended = recommendedForAgent(agent, modules);
    for (const mod of recommended) {
      const quiz = quizzes.find(q => q.moduleId === mod.id);
      await assign(agent, mod, quiz);
    }
  }, [assign, modules, quizzes]);

  const updateStatus = useCallback(async (a: LearningAssignment, status: string) => {
    try {
      await onUpdateAssignment({ ...a, status: status as LearningAssignment["status"], completedAt: ["completed", "verified"].includes(status) ? (a.completedAt ?? new Date().toISOString()) : a.completedAt });
      toast(`Marked as ${statusLabel(status)}.`);
    } catch { toast("Update failed.", "error"); }
  }, [onUpdateAssignment, toast]);

  // ── Note actions ───────────────────────────────────────────────────────────
  const startNote = useCallback((agent: TeamMember, metric?: string) => {
    const firstMetric = metric ?? agent.failedMetrics[0] ?? "";
    setNoteDraft({ agentId: agentId(agent), note: coachingTemplate(agent, firstMetric), metric: firstMetric });
    setTimeout(() => noteFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
  }, []);

  const saveNote = async () => {
    if (!noteDraft.agentId || !noteDraft.note.trim()) { toast("Agent and note are required.", "error"); return; }
    setSavingNote(true);
    try {
      await onSaveCoachingNote(noteDraft.agentId, noteDraft.note, noteDraft.metric || undefined, noteDraft.id);
      toast("Coaching note saved.");
      setNoteDraft({ agentId: "", note: "", metric: "" });
    } catch { toast("Save failed.", "error"); }
    finally { setSavingNote(false); }
  };

  const openDrill = useCallback((agent: TeamMember) => {
    setSelectedId(agentId(agent));
    setTimeout(() => drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ManagerShell kind="coaching" onNew={() => setNoteDraft({ agentId: "", note: "", metric: "" })}>

      {/* Stats ────────────────────────────────────────────────────────────── */}
      <div className="lcm-stats">
        <div className="lcm-stat"><div className="lcm-stat-val" style={{ color: "var(--accent-blue)" }}>{teamData.length}</div><div className="lcm-stat-label">Agents</div></div>
        <div className="lcm-stat"><div className="lcm-stat-val" style={{ color: "var(--accent-amber)" }}>{needsCoaching.length}</div><div className="lcm-stat-label">Need Coaching</div></div>
        <div className="lcm-stat"><div className="lcm-stat-val" style={{ color: "var(--accent-violet)" }}>{openAssignments.length}</div><div className="lcm-stat-label">Open</div></div>
        <div className="lcm-stat"><div className="lcm-stat-val" style={{ color: "var(--accent-rose)" }}>{overdueAssignments.length}</div><div className="lcm-stat-label">Overdue</div></div>
        <div className="lcm-stat"><div className="lcm-stat-val" style={{ color: "var(--accent-emerald)" }}>{completedCount}</div><div className="lcm-stat-label">Completed</div></div>
        <div className="lcm-stat"><div className="lcm-stat-val" style={{ color: "var(--accent-cyan)" }}>{verifiedCount}</div><div className="lcm-stat-label">Verified</div></div>
      </div>

      {/* Failed metric heatmap ───────────────────────────────────────────── */}
      {topMetrics.length > 0 && (
        <div className="lcm-form-card" style={{ marginBottom: 16 }}>
          <div className="lcm-form-header"><span className="lcm-form-title">Top Failed Metrics</span></div>
          <div style={{ padding: "14px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topMetrics.map(({ metric, count }) => {
              const intensity = Math.min(count / Math.max(...topMetrics.map(m => m.count)), 1);
              return (
                <div key={metric} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: `color-mix(in srgb,var(--accent-rose) ${Math.round(intensity * 20) + 6}%,var(--bg-subtle))`, border: "1px solid color-mix(in srgb,var(--accent-rose) 20%,transparent)" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-default)" }}>{metric}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-rose)", background: "color-mix(in srgb,var(--accent-rose) 12%,transparent)", borderRadius: 4, padding: "1px 5px" }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent list ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
        <div className="lcm-section-label" style={{ margin: 0 }}>Team Members ({filteredAgents.length})</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 0, maxWidth: 320 }}>
          <SearchBar value={agentSearch} onChange={setAgentSearch} placeholder="Search agents, teams, metrics…" />
        </div>
      </div>

      {filteredAgents.length === 0 ? (
        <div className="lcm-list-empty" style={{ marginBottom: 20 }}>
          {agentSearch ? `No agents matching "${agentSearch}"` : "No agents synced. Confirm team assignment in agent profiles."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12, marginBottom: 20 }}>
          {filteredAgents.map(agent => {
            const recommended = recommendedForAgent(agent, modules);
            const aAssignments = agentAssignments(agent);
            const openCount = aAssignments.filter(isOpen).length;
            const overdueCount = aAssignments.filter(isOverdue).length;
            const scoreColor = agent.score >= 85 ? "var(--accent-emerald)" : agent.score >= 70 ? "var(--accent-amber)" : "var(--accent-rose)";
            const initials = agent.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
            const isSelected = selectedId === agentId(agent) || selectedId === agent.id;

            return (
              <div key={agent.id} className="lcm-agent-card" style={isSelected ? { borderColor: "color-mix(in srgb,var(--accent-violet) 35%,transparent)", boxShadow: "0 0 0 3px color-mix(in srgb,var(--accent-violet) 8%,transparent)" } : {}}>
                <div className="lcm-agent-header">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="lcm-agent-avatar" style={{ background: `color-mix(in srgb,${scoreColor} 12%,transparent)`, border: `1px solid color-mix(in srgb,${scoreColor} 22%,transparent)`, color: scoreColor }}>{initials}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-default)", letterSpacing: "-0.01em" }}>{agent.name}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>{agent.team ?? agent.email ?? agentId(agent)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: scoreColor, letterSpacing: "-0.03em" }}>{agent.score}%</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {openCount > 0 && <span className="lcm-status lcm-status-assigned">{openCount} open</span>}
                      {overdueCount > 0 && <span className="lcm-status lcm-status-overdue">{overdueCount} overdue</span>}
                    </div>
                  </div>
                </div>

                <div className="lcm-agent-body">
                  {/* Failed metrics */}
                  <div>
                    <div className="lcm-section-label">Failed Metrics</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {agent.failedMetrics.length ? agent.failedMetrics.map(m => (
                        <span key={m} style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: "color-mix(in srgb,var(--accent-rose) 10%,transparent)", color: "var(--accent-rose)", border: "1px solid color-mix(in srgb,var(--accent-rose) 18%,transparent)" }}>{m}</span>
                      )) : <span style={{ fontSize: 11, color: "var(--fg-muted)" }}>No failed metrics</span>}
                    </div>
                  </div>

                  {/* Recommended modules */}
                  {recommended.length > 0 && (
                    <div>
                      <div className="lcm-section-label">Recommended Training</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {recommended.map(mod => {
                          const quiz = quizzes.find(q => q.moduleId === mod.id);
                          const key = `${agentId(agent)}:${mod.id}`;
                          const isAssigning = assigningKeys.has(key);
                          const alreadyAssigned = aAssignments.some(a => a.contentId === mod.id || a.moduleId === mod.id);
                          return (
                            <div key={mod.id} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-default)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mod.title}</div>
                                {quiz && <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 1 }}>+ {quiz.title}</div>}
                              </div>
                              <Btn size="sm" variant={alreadyAssigned ? "emerald" : "blue"} loading={isAssigning} disabled={alreadyAssigned} onClick={() => assign(agent, mod, quiz)}>
                                {alreadyAssigned ? "✓ Assigned" : "Assign"}
                              </Btn>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="lcm-agent-footer">
                  <Btn size="sm" variant="ghost" onClick={() => openDrill(agent)}>Drill-down</Btn>
                  {recommended.length > 1 && <Btn size="sm" variant="blue" onClick={() => assignAll(agent)}>Assign All</Btn>}
                  <Btn size="sm" variant="amber" onClick={() => startNote(agent)}>Add Note</Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drill-down panel ───────────────────────────────────────────────── */}
      {selectedAgent && (
        <div ref={drillRef} className="lcm-drill">
          <div className="lcm-drill-header">
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--fg-default)", letterSpacing: "-0.02em" }}>
                {selectedAgent.name} — Drill-down
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 3 }}>
                {selectedAgent.team ?? ""} · Score {selectedAgent.score}% · {agentAssignments(selectedAgent).length} assignments
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn size="sm" variant="amber" onClick={() => startNote(selectedAgent)}>Add Note</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setSelectedId(null)}>Close</Btn>
            </div>
          </div>

          {/* Assignment filter pills */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            {["all", ...ASSIGNMENT_STATUSES].map(s => (
              <button key={s} type="button" className={`lcm-pill${statusFilter === s ? " active" : ""}`} onClick={() => setStatusFilter(s)}>
                {s === "all" ? "All" : statusLabel(s)}
              </button>
            ))}
          </div>

          {/* Assignments */}
          {filteredAgentAssignments(selectedAgent).length === 0 ? (
            <div className="lcm-list-empty" style={{ marginBottom: 14 }}>No assignments{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
              {filteredAgentAssignments(selectedAgent).map(a => (
                <div key={a.id} className={`lcm-assignment-row${isOverdue(a) ? " overdue" : ""}${!isOpen(a) ? " completed" : ""}`}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-default)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.title ?? a.contentId ?? a.moduleId}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 2 }}>
                      {a.contentType ?? "module"} · Due {a.dueDate ?? "not set"}{isOverdue(a) ? " ⚠ Overdue" : ""}
                    </div>
                  </div>
                  <span className={statusClass(a.status)}>{statusLabel(a.status)}</span>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap" }}>
                    {a.status !== "in_progress" && isOpen(a) && <Btn size="sm" variant="amber" onClick={() => updateStatus(a, "in_progress")}>In Progress</Btn>}
                    {a.status !== "completed" && a.status !== "verified" && <Btn size="sm" variant="blue" onClick={() => updateStatus(a, "completed")}>Complete</Btn>}
                    {a.status === "completed" && <Btn size="sm" variant="emerald" onClick={() => updateStatus(a, "verified")}>Verify</Btn>}
                    <Btn size="sm" variant="danger" onClick={() => confirm(`Remove assignment "${a.title ?? a.id}"?`, async () => { await onDeleteAssignment(a); toast("Assignment removed."); })}>✕</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="lcm-divider" />

          {/* Coaching notes history */}
          <div style={{ marginTop: 14 }}>
            <div className="lcm-section-label">Coaching Note History</div>
            {agentNotes(selectedAgent).length === 0 ? (
              <div className="lcm-list-empty">No coaching notes for this agent yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {agentNotes(selectedAgent).map(note => (
                  <div key={note.id} className="lcm-note-card">
                    <div className="lcm-note-meta">{note.metric ?? "General"} · {note.sessionDate}</div>
                    <div className="lcm-note-text">{note.note}</div>
                    <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                      <Btn size="sm" variant="ghost" onClick={() => { setNoteDraft({ id: note.id, agentId: note.agentId, note: note.note, metric: note.metric ?? "" }); setTimeout(() => noteFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100); }}>Edit</Btn>
                      <Btn size="sm" variant="danger" onClick={() => confirm("Delete this coaching note?", async () => { await onDeleteCoachingNote(note.id); toast("Note deleted."); })}>Delete</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coaching notes list (global) ───────────────────────────────────── */}
      {coachingNotes.length > 0 && (
        <>
          <div className="lcm-section-label">All Coaching Notes ({coachingNotes.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, maxHeight: 300, overflowY: "auto" }}>
            {coachingNotes.map(note => {
              const agentName = teamData.find(a => agentId(a) === note.agentId || a.id === note.agentId)?.name ?? note.agentId;
              return (
                <div key={note.id} className="lcm-note-card">
                  <div className="lcm-note-meta" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{agentName} · {note.metric ?? "General"} · {note.sessionDate}</span>
                    <div style={{ display: "flex", gap: 5 }}>
                      <Btn size="sm" variant="ghost" onClick={() => setNoteDraft({ id: note.id, agentId: note.agentId, note: note.note, metric: note.metric ?? "" })}>Edit</Btn>
                      <Btn size="sm" variant="danger" onClick={() => confirm("Delete this note?", async () => { await onDeleteCoachingNote(note.id); toast("Note deleted."); })}>✕</Btn>
                    </div>
                  </div>
                  <div className="lcm-note-text">{note.note}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Note form ─────────────────────────────────────────────────────── */}
      <div ref={noteFormRef}>
        <FormCard
          title={noteDraft.id ? "Edit Coaching Note" : "New Coaching Note"}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setNoteDraft({ agentId: "", note: "", metric: "" })}>Discard</Btn>
              <Btn variant="primary" onClick={saveNote} loading={savingNote} disabled={!noteDraft.agentId || !noteDraft.note.trim()}>
                {noteDraft.id ? "Update Note" : "Save Note"}
              </Btn>
            </>
          }
        >
          <div className="lcm-form-row">
            <Field label="Agent" required>
              <select className="lcm-select" value={noteDraft.agentId} onChange={e => setNoteDraft(d => ({ ...d, agentId: e.target.value }))}>
                <option value="">Select agent…</option>
                {teamData.map(a => <option key={a.id} value={agentId(a)}>{a.name}{a.team ? ` — ${a.team}` : ""}</option>)}
              </select>
            </Field>
            <Field label="Related Metric"><Input value={noteDraft.metric} onChange={v => setNoteDraft(d => ({ ...d, metric: v }))} placeholder="e.g. Return Label (RL)" /></Field>
          </div>
          <Field label="Coaching Note" required><Textarea value={noteDraft.note} onChange={v => setNoteDraft(d => ({ ...d, note: v }))} rows={4} placeholder="Describe the observed behavior, coaching action, and expected follow-up…" /></Field>
        </FormCard>
      </div>
    </ManagerShell>
  );
});

// ─── Root component ───────────────────────────────────────────────────────────

const LearningContentManager = memo(function LearningContentManager(props: LearningContentManagerProps) {
  useEffect(() => { injectLCMStyles(); }, []);

  const { toasts, push: toast } = useToast();
  const { confirmState, request: confirm, resolve } = useConfirm();

  const sharedProps = { toast, confirm };

  const child = useMemo(() => {
    switch (props.kind) {
      case "modules":
        return <ModuleManager items={props.modules ?? []} onSave={props.onSaveModule!} onDelete={props.onDeleteModule!} {...sharedProps} />;
      case "sops":
        return <SOPManager items={props.sops ?? []} onSave={props.onSaveSOP!} onDelete={props.onDeleteSOP!} {...sharedProps} />;
      case "work-instructions":
        return <WorkInstructionManager items={props.workInstructions ?? []} onSave={props.onSaveWorkInstruction!} onDelete={props.onDeleteWorkInstruction!} {...sharedProps} />;
      case "defects":
        return <DefectManager items={props.defects ?? []} onSave={props.onSaveDefect!} onDelete={props.onDeleteDefect!} {...sharedProps} />;
      case "standards":
        return <StandardsManager items={props.standards ?? []} onSave={props.onSaveStandard!} onDelete={props.onDeleteStandard!} {...sharedProps} />;
      case "onboarding":
        return <OnboardingManager items={props.onboardingTracks ?? []} onSave={props.onSaveOnboardingTrack!} onDelete={props.onDeleteOnboardingTrack!} {...sharedProps} />;
      case "best-practices":
        return <BestPracticeManager items={props.bestPractices ?? []} onSave={props.onSaveBestPractice!} onDelete={props.onDeleteBestPractice!} {...sharedProps} />;
      case "coaching":
        return (
          <CoachingManager
            teamData={props.teamData ?? []}
            coachingNotes={props.coachingNotes ?? []}
            modules={props.modules ?? []}
            quizzes={props.quizzes ?? []}
            assignments={props.assignments ?? []}
            onCreateAssignment={props.onCreateAssignment!}
            onUpdateAssignment={props.onUpdateAssignment!}
            onDeleteAssignment={props.onDeleteAssignment!}
            onSaveCoachingNote={props.onSaveCoachingNote!}
            onDeleteCoachingNote={props.onDeleteCoachingNote!}
            {...sharedProps}
          />
        );
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props]);

  return (
    <>
      {child}
      <ToastHost toasts={toasts} />
      {confirmState && <ConfirmDialog state={confirmState} onResolve={resolve} />}
    </>
  );
});

export default LearningContentManager;
