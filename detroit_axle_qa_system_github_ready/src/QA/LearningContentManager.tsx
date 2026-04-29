import { memo, useCallback, useState, type ReactNode } from "react";
import type {
  BestPractice,
  CoachingNote,
  DefectExample,
  LearningDifficulty,
  LearningModule,
  LearningRole,
  OnboardingTrack,
  QualityStandard,
  SOPDocument,
  TeamMember,
  WorkInstruction,
} from "./learningService";

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
  onSaveTeamMember?: (item: TeamMember) => Promise<void> | void;
  onDeleteTeamMember?: (id: string) => Promise<void> | void;
  onSaveCoachingNote?: (agentId: string, note: string, metric?: string, noteId?: string) => Promise<void> | void;
  onDeleteCoachingNote?: (id: string) => Promise<void> | void;
}

const ROLE_OPTIONS: LearningRole[] = ["all", "admin", "qa", "supervisor", "agent"];
const DIFFICULTY_OPTIONS: LearningDifficulty[] = ["beginner", "intermediate", "advanced"];
const SEVERITY_OPTIONS: DefectExample["severity"][] = ["low", "medium", "high", "critical"];

const TITLES: Record<ContentManagerKind, { title: string; sub: string; empty: string }> = {
  modules: {
    title: "Training Module Manager",
    sub: "Add, edit, and delete training modules shown in the Training tab.",
    empty: "No training modules found.",
  },
  sops: {
    title: "SOP Library Manager",
    sub: "Maintain SOP titles, versions, categories, authors, and content.",
    empty: "No SOPs found.",
  },
  "work-instructions": {
    title: "Work Instructions Manager",
    sub: "Create short step-by-step guides for audit and coaching workflows.",
    empty: "No work instructions found.",
  },
  defects: {
    title: "Defect Examples Manager",
    sub: "Manage defect examples, severity, what went wrong, and the correct behavior.",
    empty: "No defect examples found.",
  },
  standards: {
    title: "Quality Standards Manager",
    sub: "Edit score bands, labels, colors, and descriptions.",
    empty: "No quality standards found.",
  },
  onboarding: {
    title: "Onboarding Materials Manager",
    sub: "Build role-based onboarding tracks and attach module steps.",
    empty: "No onboarding tracks found.",
  },
  "best-practices": {
    title: "Best Practices Manager",
    sub: "Capture high-performing examples and the metrics they support.",
    empty: "No best practices found.",
  },
  coaching: {
    title: "Supervisor Coaching Manager",
    sub: "Add/edit/delete team members and coaching notes used by Supervisor Coaching Mode.",
    empty: "No coaching records found.",
  },
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value?: readonly string[]): string {
  return (value ?? []).join("\n");
}

function parseChangeLog(value: string): SOPDocument["changeLog"] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [version = "1.0", date = new Date().toISOString().split("T")[0], ...rest] = line.split("|").map((part) => part.trim());
      return { version, date, summary: rest.join(" | ") || "Updated" };
    });
}

function stringifyChangeLog(value?: SOPDocument["changeLog"]): string {
  return (value ?? []).map((entry) => `${entry.version} | ${entry.date} | ${entry.summary}`).join("\n");
}

function parseOnboardingSteps(value: string): OnboardingTrack["steps"] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [title = `Step ${index + 1}`, description = "", moduleId = ""] = line.split("|").map((part) => part.trim());
      return { id: makeId("onboarding-step"), title, description, moduleId: moduleId || null };
    });
}

function stringifyOnboardingSteps(value?: OnboardingTrack["steps"]): string {
  return (value ?? [])
    .map((step) => `${step.title} | ${step.description} | ${step.moduleId ?? ""}`)
    .join("\n");
}

function confirmDelete(label: string): boolean {
  if (typeof window === "undefined") return true;
  return window.confirm(`Delete ${label}? This removes it from the Learning Center view.`);
}

const inputStyle = {
  width: "100%",
  minHeight: "38px",
  padding: "8px 10px",
  borderRadius: "9px",
  border: "1px solid var(--border-strong)",
  background: "var(--bg-elevated)",
  color: "var(--fg-default)",
  fontSize: "12px",
  fontFamily: "inherit",
  outline: "none",
} as const;

const textareaStyle = {
  ...inputStyle,
  minHeight: "84px",
  resize: "vertical" as const,
};

const labelStyle = {
  display: "block",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--fg-muted)",
  marginBottom: "6px",
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

function Actions({ onNew }: { onNew: () => void }) {
  return (
    <button className="lc-admin-action-btn" type="button" onClick={onNew}>
      + New
    </button>
  );
}

function ManagerShell({
  kind,
  children,
  onNew,
}: {
  kind: ContentManagerKind;
  children: ReactNode;
  onNew: () => void;
}) {
  const meta = TITLES[kind];
  return (
    <div>
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">{meta.title}</div>
          <div className="lc-section-sub">{meta.sub}</div>
        </div>
        <Actions onNew={onNew} />
      </div>
      {children}
    </div>
  );
}

function EditDeleteButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
      <button type="button" className="lc-admin-action-btn" onClick={onEdit}>Edit</button>
      <button
        type="button"
        className="lc-admin-action-btn"
        style={{ color: "var(--accent-rose)", borderColor: "color-mix(in srgb,var(--accent-rose) 25%,transparent)", background: "color-mix(in srgb,var(--accent-rose) 7%,transparent)" }}
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}

const ModuleManager = memo(function ModuleManager({ items, onSave, onDelete }: {
  items: LearningModule[];
  onSave: NonNullable<LearningContentManagerProps["onSaveModule"]>;
  onDelete: NonNullable<LearningContentManagerProps["onDeleteModule"]>;
}) {
  const blank = useCallback((): LearningModule => ({
    id: "",
    title: "",
    description: "",
    category: "General",
    difficulty: "beginner",
    durationMin: 15,
    xpReward: 100,
    content: "",
    author: "QA Training",
    updatedAt: new Date().toISOString().split("T")[0],
    rating: 4.5,
    completions: 0,
    tags: [],
    roles: ["all", "agent"],
    steps: [],
    metrics: [],
  }), []);
  const [draft, setDraft] = useState<LearningModule>(blank);
  const [tags, setTags] = useState("");
  const [steps, setSteps] = useState("");
  const [metrics, setMetrics] = useState("");
  const [message, setMessage] = useState("");

  const edit = (item: LearningModule) => {
    setDraft({ ...item }); setTags(joinList(item.tags)); setSteps(joinList(item.steps)); setMetrics(joinList(item.metrics)); setMessage("");
  };
  const reset = () => { setDraft(blank()); setTags(""); setSteps(""); setMetrics(""); setMessage(""); };
  const save = async () => {
    const next: LearningModule = { ...draft, id: draft.id || makeId("module"), tags: splitList(tags), steps: splitList(steps), metrics: splitList(metrics) };
    await onSave(next); setMessage("Saved training module."); edit(next);
  };
  const toggleRole = (role: LearningRole) => {
    setDraft((current) => {
      const roles = new Set(current.roles);
      if (roles.has(role)) roles.delete(role); else roles.add(role);
      return { ...current, roles: roles.size ? Array.from(roles) : ["all"] };
    });
  };
  return (
    <ManagerShell kind="modules" onNew={reset}>
      {message && <div className="lc-recommendation-banner">{message}</div>}
      <div className="lc-grid" style={{ marginBottom: "18px" }}>
        {items.map((item) => (
          <div key={item.id} className="lc-card">
            <div className="lc-card-header"><div className="lc-card-title">{item.title}</div><EditDeleteButtons onEdit={() => edit(item)} onDelete={() => confirmDelete(item.title) && onDelete(item.id)} /></div>
            <div className="lc-card-desc">{item.description}</div>
            <div className="lc-card-meta"><span className="lc-badge lc-badge-violet">{item.category}</span><span className="lc-badge lc-badge-muted">{item.difficulty}</span><span className="lc-badge lc-badge-blue">{item.durationMin} min</span></div>
          </div>
        ))}
      </div>
      <div className="lc-card" style={{ cursor: "default" }}>
        <div className="lc-section-title" style={{ marginBottom: "14px" }}>{draft.id ? "Edit Module" : "Add Module"}</div>
        <div className="lc-grid-sm">
          <Field label="Title"><input style={inputStyle} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="Category"><input style={inputStyle} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></Field>
          <Field label="Difficulty"><select style={inputStyle} value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as LearningDifficulty })}>{DIFFICULTY_OPTIONS.map((d) => <option key={d}>{d}</option>)}</select></Field>
          <Field label="Duration minutes"><input type="number" style={inputStyle} value={draft.durationMin} onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) })} /></Field>
          <Field label="XP reward"><input type="number" style={inputStyle} value={draft.xpReward} onChange={(e) => setDraft({ ...draft, xpReward: Number(e.target.value) })} /></Field>
          <Field label="Author"><input style={inputStyle} value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} /></Field>
        </div>
        <div style={{ marginTop: "12px" }}><Field label="Description"><textarea style={textareaStyle} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field></div>
        <div style={{ marginTop: "12px" }}><Field label="Content"><textarea style={textareaStyle} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></Field></div>
        <div className="lc-grid-sm" style={{ marginTop: "12px" }}>
          <Field label="Tags"><textarea style={textareaStyle} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="One per line or comma separated" /></Field>
          <Field label="Steps"><textarea style={textareaStyle} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="One step per line" /></Field>
          <Field label="Metrics"><textarea style={textareaStyle} value={metrics} onChange={(e) => setMetrics(e.target.value)} placeholder="One metric per line" /></Field>
        </div>
        <div style={{ marginTop: "12px" }}>
          <span style={labelStyle}>Audience roles</span>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>{ROLE_OPTIONS.map((role) => <button key={role} type="button" className={`lc-tab-btn${draft.roles.includes(role) ? " active" : ""}`} onClick={() => toggleRole(role)}>{role}</button>)}</div>
        </div>
        <button type="button" className="lc-complete-btn" onClick={save}>{draft.id ? "Save Module" : "Create Module"}</button>
      </div>
    </ManagerShell>
  );
});

const SOPManager = memo(function SOPManager({ items, onSave, onDelete }: {
  items: SOPDocument[];
  onSave: NonNullable<LearningContentManagerProps["onSaveSOP"]>;
  onDelete: NonNullable<LearningContentManagerProps["onDeleteSOP"]>;
}) {
  const blank = (): SOPDocument => ({ id: "", title: "", version: "1.0", category: "General", content: "", updatedAt: new Date().toISOString().split("T")[0], author: "QA Operations", changeLog: [] });
  const [draft, setDraft] = useState<SOPDocument>(blank);
  const [log, setLog] = useState("");
  const edit = (item: SOPDocument) => { setDraft({ ...item }); setLog(stringifyChangeLog(item.changeLog)); };
  const save = async () => { const next = { ...draft, id: draft.id || makeId("sop"), changeLog: parseChangeLog(log) }; await onSave(next); edit(next); };
  return (
    <ManagerShell kind="sops" onNew={() => { setDraft(blank()); setLog(""); }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>{items.map((item) => <div key={item.id} className="lc-sop-card"><div className="lc-sop-header"><div style={{ flex: 1 }}><div style={{ fontSize: "14px", fontWeight: 700 }}>{item.title}</div><div className="lc-sop-version"><span className="lc-badge lc-badge-cyan">v{item.version}</span><span>{item.category}</span><span>by {item.author}</span></div></div><EditDeleteButtons onEdit={() => edit(item)} onDelete={() => confirmDelete(item.title) && onDelete(item.id)} /></div></div>)}</div>
      <div className="lc-card" style={{ cursor: "default" }}><div className="lc-section-title" style={{ marginBottom: "14px" }}>{draft.id ? "Edit SOP" : "Add SOP"}</div><div className="lc-grid-sm"><Field label="Title"><input style={inputStyle} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field><Field label="Version"><input style={inputStyle} value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} /></Field><Field label="Category"><input style={inputStyle} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></Field><Field label="Author"><input style={inputStyle} value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Field label="Content"><textarea style={textareaStyle} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Field label="Change log"><textarea style={textareaStyle} value={log} onChange={(e) => setLog(e.target.value)} placeholder="1.1 | 2026-04-29 | Summary" /></Field></div><button type="button" className="lc-complete-btn" onClick={save}>Save SOP</button></div>
    </ManagerShell>
  );
});

const WorkInstructionManager = memo(function WorkInstructionManager({ items, onSave, onDelete }: {
  items: WorkInstruction[];
  onSave: NonNullable<LearningContentManagerProps["onSaveWorkInstruction"]>;
  onDelete: NonNullable<LearningContentManagerProps["onDeleteWorkInstruction"]>;
}) {
  const blank = (): WorkInstruction => ({ id: "", title: "", metric: "General", category: "General", steps: [], updatedAt: new Date().toISOString().split("T")[0] });
  const [draft, setDraft] = useState<WorkInstruction>(blank);
  const [steps, setSteps] = useState("");
  const edit = (item: WorkInstruction) => { setDraft({ ...item }); setSteps(joinList(item.steps)); };
  const save = async () => { const next = { ...draft, id: draft.id || makeId("work-instruction"), steps: splitList(steps) }; await onSave(next); edit(next); };
  return (
    <ManagerShell kind="work-instructions" onNew={() => { setDraft(blank()); setSteps(""); }}>
      <SimpleCards items={items.map((item) => ({ id: item.id, title: item.title, sub: `${item.metric} · ${item.category}`, desc: `${item.steps.length} steps`, raw: item }))} onEdit={(item) => edit(item.raw as WorkInstruction)} onDelete={(item) => confirmDelete(item.title) && onDelete(item.id)} />
      <div className="lc-card" style={{ cursor: "default" }}><div className="lc-section-title" style={{ marginBottom: 14 }}>{draft.id ? "Edit Work Instruction" : "Add Work Instruction"}</div><div className="lc-grid-sm"><Field label="Title"><input style={inputStyle} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field><Field label="Metric"><input style={inputStyle} value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })} /></Field><Field label="Category"><input style={inputStyle} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Field label="Steps"><textarea style={textareaStyle} value={steps} onChange={(e) => setSteps(e.target.value)} /></Field></div><button type="button" className="lc-complete-btn" onClick={save}>Save Work Instruction</button></div>
    </ManagerShell>
  );
});

const DefectManager = memo(function DefectManager({ items, onSave, onDelete }: {
  items: DefectExample[];
  onSave: NonNullable<LearningContentManagerProps["onSaveDefect"]>;
  onDelete: NonNullable<LearningContentManagerProps["onDeleteDefect"]>;
}) {
  const blank = (): DefectExample => ({ id: "", title: "", metric: "General", severity: "medium", whatWentWrong: "", correctBehavior: "" });
  const [draft, setDraft] = useState<DefectExample>(blank);
  const save = async () => { const next = { ...draft, id: draft.id || makeId("defect") }; await onSave(next); setDraft(next); };
  return (
    <ManagerShell kind="defects" onNew={() => setDraft(blank())}>
      <SimpleCards items={items.map((item) => ({ id: item.id, title: item.title, sub: `${item.metric} · ${item.severity}`, desc: item.whatWentWrong, raw: item }))} onEdit={(item) => setDraft(item.raw as DefectExample)} onDelete={(item) => confirmDelete(item.title) && onDelete(item.id)} />
      <div className="lc-card" style={{ cursor: "default" }}><div className="lc-section-title" style={{ marginBottom: 14 }}>{draft.id ? "Edit Defect Example" : "Add Defect Example"}</div><div className="lc-grid-sm"><Field label="Title"><input style={inputStyle} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field><Field label="Metric"><input style={inputStyle} value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })} /></Field><Field label="Severity"><select style={inputStyle} value={draft.severity} onChange={(e) => setDraft({ ...draft, severity: e.target.value as DefectExample["severity"] })}>{SEVERITY_OPTIONS.map((s) => <option key={s}>{s}</option>)}</select></Field></div><div className="lc-grid-sm" style={{ marginTop: 12 }}><Field label="What went wrong"><textarea style={textareaStyle} value={draft.whatWentWrong} onChange={(e) => setDraft({ ...draft, whatWentWrong: e.target.value })} /></Field><Field label="Correct behavior"><textarea style={textareaStyle} value={draft.correctBehavior} onChange={(e) => setDraft({ ...draft, correctBehavior: e.target.value })} /></Field></div><button type="button" className="lc-complete-btn" onClick={save}>Save Defect Example</button></div>
    </ManagerShell>
  );
});

interface SimpleCardItem { id: string; title: string; sub: string; desc: string; raw: unknown }
function SimpleCards({ items, onEdit, onDelete }: { items: SimpleCardItem[]; onEdit: (item: SimpleCardItem) => void; onDelete: (item: SimpleCardItem) => void }) {
  return <div className="lc-grid" style={{ marginBottom: "18px" }}>{items.map((item) => <div key={item.id} className="lc-card"><div className="lc-card-header"><div className="lc-card-title">{item.title}</div><EditDeleteButtons onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} /></div><div className="lc-card-desc">{item.desc}</div><div className="lc-card-meta"><span className="lc-badge lc-badge-muted">{item.sub}</span></div></div>)}</div>;
}

const StandardsManager = memo(function StandardsManager({ items, onSave, onDelete }: {
  items: QualityStandard[];
  onSave: NonNullable<LearningContentManagerProps["onSaveStandard"]>;
  onDelete: NonNullable<LearningContentManagerProps["onDeleteStandard"]>;
}) {
  const blank = (): QualityStandard => ({ id: "", name: "", min: 70, color: "var(--accent-blue)", desc: "" });
  const [draft, setDraft] = useState<QualityStandard>(blank);
  const save = async () => { const next = { ...draft, id: draft.id || makeId("standard") }; await onSave(next); setDraft(next); };
  return (
    <ManagerShell kind="standards" onNew={() => setDraft(blank())}>
      <SimpleCards items={items.map((item) => ({ id: item.id, title: item.name, sub: `${item.min}%+`, desc: item.desc, raw: item }))} onEdit={(item) => setDraft(item.raw as QualityStandard)} onDelete={(item) => confirmDelete(item.title) && onDelete(item.id)} />
      <div className="lc-card" style={{ cursor: "default" }}><div className="lc-section-title" style={{ marginBottom: 14 }}>{draft.id ? "Edit Standard" : "Add Standard"}</div><div className="lc-grid-sm"><Field label="Name"><input style={inputStyle} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field><Field label="Minimum score"><input type="number" style={inputStyle} value={draft.min} onChange={(e) => setDraft({ ...draft, min: Number(e.target.value) })} /></Field><Field label="Color token"><input style={inputStyle} value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Field label="Description"><textarea style={textareaStyle} value={draft.desc} onChange={(e) => setDraft({ ...draft, desc: e.target.value })} /></Field></div><button type="button" className="lc-complete-btn" onClick={save}>Save Standard</button></div>
    </ManagerShell>
  );
});

const BestPracticeManager = memo(function BestPracticeManager({ items, onSave, onDelete }: {
  items: BestPractice[];
  onSave: NonNullable<LearningContentManagerProps["onSaveBestPractice"]>;
  onDelete: NonNullable<LearningContentManagerProps["onDeleteBestPractice"]>;
}) {
  const blank = (): BestPractice => ({ id: "", title: "", category: "General", quote: "", agentLabel: "QA Training", metric: "General" });
  const [draft, setDraft] = useState<BestPractice>(blank);
  const save = async () => { const next = { ...draft, id: draft.id || makeId("best-practice") }; await onSave(next); setDraft(next); };
  return (
    <ManagerShell kind="best-practices" onNew={() => setDraft(blank())}>
      <SimpleCards items={items.map((item) => ({ id: item.id, title: item.title, sub: `${item.category} · ${item.metric}`, desc: item.quote, raw: item }))} onEdit={(item) => setDraft(item.raw as BestPractice)} onDelete={(item) => confirmDelete(item.title) && onDelete(item.id)} />
      <div className="lc-card" style={{ cursor: "default" }}><div className="lc-section-title" style={{ marginBottom: 14 }}>{draft.id ? "Edit Best Practice" : "Add Best Practice"}</div><div className="lc-grid-sm"><Field label="Title"><input style={inputStyle} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field><Field label="Category"><input style={inputStyle} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></Field><Field label="Agent / Source"><input style={inputStyle} value={draft.agentLabel} onChange={(e) => setDraft({ ...draft, agentLabel: e.target.value })} /></Field><Field label="Metric"><input style={inputStyle} value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Field label="Quote / example"><textarea style={textareaStyle} value={draft.quote} onChange={(e) => setDraft({ ...draft, quote: e.target.value })} /></Field></div><button type="button" className="lc-complete-btn" onClick={save}>Save Best Practice</button></div>
    </ManagerShell>
  );
});

const OnboardingManager = memo(function OnboardingManager({ items, onSave, onDelete }: {
  items: OnboardingTrack[];
  onSave: NonNullable<LearningContentManagerProps["onSaveOnboardingTrack"]>;
  onDelete: NonNullable<LearningContentManagerProps["onDeleteOnboardingTrack"]>;
}) {
  const blank = (): OnboardingTrack => ({ id: "", label: "", subtitle: "", badgeLabel: "Agent", steps: [] });
  const [draft, setDraft] = useState<OnboardingTrack>(blank);
  const [steps, setSteps] = useState("");
  const edit = (item: OnboardingTrack) => { setDraft({ ...item }); setSteps(stringifyOnboardingSteps(item.steps)); };
  const save = async () => { const next = { ...draft, id: draft.id || makeId("onboarding"), steps: parseOnboardingSteps(steps) }; await onSave(next); edit(next); };
  return (
    <ManagerShell kind="onboarding" onNew={() => { setDraft(blank()); setSteps(""); }}>
      <SimpleCards items={items.map((item) => ({ id: item.id, title: item.label, sub: item.badgeLabel, desc: `${item.steps.length} steps · ${item.subtitle}`, raw: item }))} onEdit={(item) => edit(item.raw as OnboardingTrack)} onDelete={(item) => confirmDelete(item.title) && onDelete(item.id)} />
      <div className="lc-card" style={{ cursor: "default" }}><div className="lc-section-title" style={{ marginBottom: 14 }}>{draft.id ? "Edit Onboarding Track" : "Add Onboarding Track"}</div><div className="lc-grid-sm"><Field label="Label"><input style={inputStyle} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></Field><Field label="Badge label / role"><input style={inputStyle} value={draft.badgeLabel} onChange={(e) => setDraft({ ...draft, badgeLabel: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Field label="Subtitle"><textarea style={textareaStyle} value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Field label="Steps"><textarea style={textareaStyle} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="Step title | description | module-id" /></Field></div><button type="button" className="lc-complete-btn" onClick={save}>Save Onboarding Track</button></div>
    </ManagerShell>
  );
});

const CoachingManager = memo(function CoachingManager({ teamData, coachingNotes, onSaveTeamMember, onDeleteTeamMember, onSaveCoachingNote, onDeleteCoachingNote }: {
  teamData: TeamMember[];
  coachingNotes: CoachingNote[];
  onSaveTeamMember: NonNullable<LearningContentManagerProps["onSaveTeamMember"]>;
  onDeleteTeamMember: NonNullable<LearningContentManagerProps["onDeleteTeamMember"]>;
  onSaveCoachingNote: NonNullable<LearningContentManagerProps["onSaveCoachingNote"]>;
  onDeleteCoachingNote: NonNullable<LearningContentManagerProps["onDeleteCoachingNote"]>;
}) {
  const blankTeam = (): TeamMember => ({ id: "", name: "", initials: "", score: 0, failedMetrics: [] });
  const [memberDraft, setMemberDraft] = useState<TeamMember>(blankTeam);
  const [failedMetrics, setFailedMetrics] = useState("");
  const [noteDraft, setNoteDraft] = useState<{ id?: string; agentId: string; note: string; metric: string }>({ agentId: "", note: "", metric: "" });
  const editMember = (item: TeamMember) => { setMemberDraft({ ...item }); setFailedMetrics(joinList(item.failedMetrics)); };
  const saveMember = async () => { const next = { ...memberDraft, id: memberDraft.id || makeId("team-member"), failedMetrics: splitList(failedMetrics) }; await onSaveTeamMember(next); editMember(next); };
  const editNote = (note: CoachingNote) => setNoteDraft({ id: note.id, agentId: note.agentId, note: note.note, metric: note.metric ?? "" });
  const saveNote = async () => { if (!noteDraft.agentId || !noteDraft.note.trim()) return; await onSaveCoachingNote(noteDraft.agentId, noteDraft.note, noteDraft.metric || undefined, noteDraft.id); setNoteDraft({ agentId: "", note: "", metric: "" }); };
  return (
    <ManagerShell kind="coaching" onNew={() => { setMemberDraft(blankTeam()); setFailedMetrics(""); setNoteDraft({ agentId: "", note: "", metric: "" }); }}>
      <div className="lc-section-title" style={{ marginBottom: 10 }}>Team Members</div>
      <SimpleCards items={teamData.map((item) => ({ id: item.id, title: item.name, sub: `Score ${item.score}%`, desc: item.failedMetrics.join(", ") || "No failed metrics", raw: item }))} onEdit={(item) => editMember(item.raw as TeamMember)} onDelete={(item) => confirmDelete(item.title) && onDeleteTeamMember(item.id)} />
      <div className="lc-card" style={{ cursor: "default", marginBottom: 20 }}><div className="lc-section-title" style={{ marginBottom: 14 }}>{memberDraft.id ? "Edit Team Member" : "Add Team Member"}</div><div className="lc-grid-sm"><Field label="Name"><input style={inputStyle} value={memberDraft.name} onChange={(e) => setMemberDraft({ ...memberDraft, name: e.target.value })} /></Field><Field label="Initials"><input style={inputStyle} value={memberDraft.initials} onChange={(e) => setMemberDraft({ ...memberDraft, initials: e.target.value })} /></Field><Field label="Score"><input type="number" style={inputStyle} value={memberDraft.score} onChange={(e) => setMemberDraft({ ...memberDraft, score: Number(e.target.value) })} /></Field><Field label="Failed metrics"><textarea style={textareaStyle} value={failedMetrics} onChange={(e) => setFailedMetrics(e.target.value)} /></Field></div><button type="button" className="lc-complete-btn" onClick={saveMember}>Save Team Member</button></div>
      <div className="lc-section-title" style={{ marginBottom: 10 }}>Coaching Notes</div>
      <SimpleCards items={coachingNotes.map((item) => ({ id: item.id, title: teamData.find((m) => m.id === item.agentId)?.name ?? item.agentId, sub: `${item.metric ?? "General"} · ${item.sessionDate}`, desc: item.note, raw: item }))} onEdit={(item) => editNote(item.raw as CoachingNote)} onDelete={(item) => confirmDelete(item.title) && onDeleteCoachingNote(item.id)} />
      <div className="lc-card" style={{ cursor: "default" }}><div className="lc-section-title" style={{ marginBottom: 14 }}>{noteDraft.id ? "Edit Coaching Note" : "Add Coaching Note"}</div><div className="lc-grid-sm"><Field label="Agent"><select style={inputStyle} value={noteDraft.agentId} onChange={(e) => setNoteDraft({ ...noteDraft, agentId: e.target.value })}><option value="">Select agent</option>{teamData.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></Field><Field label="Metric"><input style={inputStyle} value={noteDraft.metric} onChange={(e) => setNoteDraft({ ...noteDraft, metric: e.target.value })} /></Field></div><div style={{ marginTop: 12 }}><Field label="Note"><textarea style={textareaStyle} value={noteDraft.note} onChange={(e) => setNoteDraft({ ...noteDraft, note: e.target.value })} /></Field></div><button type="button" className="lc-complete-btn" onClick={saveNote}>Save Coaching Note</button></div>
    </ManagerShell>
  );
});

const LearningContentManager = memo(function LearningContentManager(props: LearningContentManagerProps) {
  switch (props.kind) {
    case "modules": return <ModuleManager items={props.modules ?? []} onSave={props.onSaveModule!} onDelete={props.onDeleteModule!} />;
    case "sops": return <SOPManager items={props.sops ?? []} onSave={props.onSaveSOP!} onDelete={props.onDeleteSOP!} />;
    case "work-instructions": return <WorkInstructionManager items={props.workInstructions ?? []} onSave={props.onSaveWorkInstruction!} onDelete={props.onDeleteWorkInstruction!} />;
    case "defects": return <DefectManager items={props.defects ?? []} onSave={props.onSaveDefect!} onDelete={props.onDeleteDefect!} />;
    case "standards": return <StandardsManager items={props.standards ?? []} onSave={props.onSaveStandard!} onDelete={props.onDeleteStandard!} />;
    case "onboarding": return <OnboardingManager items={props.onboardingTracks ?? []} onSave={props.onSaveOnboardingTrack!} onDelete={props.onDeleteOnboardingTrack!} />;
    case "best-practices": return <BestPracticeManager items={props.bestPractices ?? []} onSave={props.onSaveBestPractice!} onDelete={props.onDeleteBestPractice!} />;
    case "coaching": return <CoachingManager teamData={props.teamData ?? []} coachingNotes={props.coachingNotes ?? []} onSaveTeamMember={props.onSaveTeamMember!} onDeleteTeamMember={props.onDeleteTeamMember!} onSaveCoachingNote={props.onSaveCoachingNote!} onDeleteCoachingNote={props.onDeleteCoachingNote!} />;
    default: return null;
  }
});

export default LearningContentManager;
