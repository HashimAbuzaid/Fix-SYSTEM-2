import { memo, useCallback, useMemo, useState } from "react";
import type { LearningModule, LearningRole, Quiz, QuizQuestion } from "./learningService";

interface QuizManagerProps {
  quizzes: Quiz[];
  modules: LearningModule[];
  currentRole: string;
  onSaveQuiz: (quiz: Quiz) => Promise<Quiz | void> | Quiz | void;
  onDeleteQuiz: (quizId: string) => Promise<void> | void;
}

type QuizDraft = Quiz;

const ROLE_OPTIONS: { value: LearningRole; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "agent", label: "Agents" },
  { value: "supervisor", label: "Supervisors" },
  { value: "qa", label: "QA" },
  { value: "admin", label: "Admins" },
];

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createBlankQuestion(): QuizQuestion {
  return {
    id: createId("question"),
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    explanation: "",
  };
}

function createBlankQuiz(): QuizDraft {
  return {
    id: "",
    moduleId: null,
    title: "",
    description: "",
    passingScore: 70,
    xpReward: 75,
    status: "draft",
    audienceRoles: ["agent"],
    questions: [createBlankQuestion()],
  };
}

function cloneQuiz(quiz: Quiz): QuizDraft {
  return {
    ...quiz,
    moduleId: quiz.moduleId ?? null,
    description: quiz.description ?? "",
    status: quiz.status ?? "published",
    audienceRoles: quiz.audienceRoles && quiz.audienceRoles.length > 0 ? quiz.audienceRoles : ["agent"],
    questions: quiz.questions.map((question) => ({
      ...question,
      options: [...question.options],
      explanation: question.explanation ?? "",
    })),
  };
}

function duplicateQuiz(quiz: Quiz): QuizDraft {
  return {
    ...cloneQuiz(quiz),
    id: "",
    title: `${quiz.title} Copy`,
    status: "draft",
    updatedAt: undefined,
    questions: quiz.questions.map((question) => ({
      ...question,
      id: createId("question"),
      options: [...question.options],
    })),
  };
}

function sanitizeDraft(draft: QuizDraft): Quiz {
  const questions = draft.questions
    .map((question, questionIndex) => {
      const options = question.options.map((option) => option.trim()).filter(Boolean);
      return {
        id: question.id || createId(`question-${questionIndex + 1}`),
        question: question.question.trim(),
        options: options.length >= 2 ? options : ["Option A", "Option B"],
        correctIndex: Math.min(question.correctIndex, Math.max(options.length - 1, 0)),
        explanation: question.explanation.trim(),
      } satisfies QuizQuestion;
    })
    .filter((question) => question.question.length > 0);

  return {
    ...draft,
    id: draft.id.trim(),
    title: draft.title.trim() || "Untitled quiz",
    description: draft.description?.trim() ?? "",
    moduleId: draft.moduleId || null,
    passingScore: Math.max(0, Math.min(Number(draft.passingScore) || 70, 100)),
    xpReward: Math.max(0, Number(draft.xpReward) || 0),
    status: draft.status ?? "draft",
    audienceRoles: draft.audienceRoles && draft.audienceRoles.length > 0 ? draft.audienceRoles : ["agent"],
    questions: questions.length > 0 ? questions : [createBlankQuestion()],
  };
}

function isRoleChecked(roles: readonly LearningRole[] | undefined, role: LearningRole): boolean {
  return Boolean(roles?.includes(role));
}

const FieldLabel = memo(function FieldLabel({ children }: { children: string }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--fg-muted)",
        marginBottom: "6px",
      }}
    >
      {children}
    </label>
  );
});

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

const QuizManager = memo(function QuizManager({
  quizzes,
  modules,
  currentRole,
  onSaveQuiz,
  onDeleteQuiz,
}: QuizManagerProps) {
  const [draft, setDraft] = useState<QuizDraft>(() => createBlankQuiz());
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "published">("all");

  const filteredQuizzes = useMemo(() => {
    if (filterStatus === "all") return quizzes;
    return quizzes.filter((quiz) => (quiz.status ?? "published") === filterStatus);
  }, [filterStatus, quizzes]);

  const selectedQuiz = useMemo(
    () => quizzes.find((quiz) => quiz.id === selectedQuizId) ?? null,
    [quizzes, selectedQuizId]
  );

  const dirtyQuestionCount = draft.questions.filter((question) => question.question.trim()).length;
  const canPublish = draft.title.trim().length > 0 && dirtyQuestionCount > 0;

  const resetDraft = useCallback(() => {
    setDraft(createBlankQuiz());
    setSelectedQuizId(null);
    setMessage("");
  }, []);

  const handleEdit = useCallback((quiz: Quiz) => {
    setDraft(cloneQuiz(quiz));
    setSelectedQuizId(quiz.id);
    setMessage("");
  }, []);

  const handleDuplicate = useCallback((quiz: Quiz) => {
    setDraft(duplicateQuiz(quiz));
    setSelectedQuizId(null);
    setMessage("Duplicated into a new draft. Review it, then save.");
  }, []);

  const handleRoleToggle = useCallback((role: LearningRole) => {
    setDraft((current) => {
      const roles = new Set(current.audienceRoles ?? ["agent"]);
      if (role === "all") {
        return { ...current, audienceRoles: roles.has("all") ? ["agent"] : ["all"] };
      }
      roles.delete("all");
      if (roles.has(role)) roles.delete(role);
      else roles.add(role);
      return { ...current, audienceRoles: roles.size > 0 ? Array.from(roles) : ["agent"] };
    });
  }, []);

  const updateQuestion = useCallback((questionId: string, updater: (question: QuizQuestion) => QuizQuestion) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question) => question.id === questionId ? updater(question) : question),
    }));
  }, []);

  const handleSave = useCallback(async (statusOverride?: "draft" | "published") => {
    const next = sanitizeDraft({ ...draft, status: statusOverride ?? draft.status });
    if ((next.status ?? "draft") === "published" && !canPublish) {
      setMessage("Add a title and at least one question before publishing.");
      return;
    }

    setSaving(true);
    try {
      const savedQuiz = await onSaveQuiz(next);
      const effectiveQuiz = savedQuiz ?? next;
      setDraft(cloneQuiz(effectiveQuiz));
      setSelectedQuizId(effectiveQuiz.id || null);
      setMessage(next.status === "published" ? "Quiz published for the selected audience." : "Quiz saved as draft.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save quiz.");
    } finally {
      setSaving(false);
    }
  }, [canPublish, draft, onSaveQuiz]);

  const handleDelete = useCallback(async (quizId: string) => {
    const confirmed = window.confirm("Delete this quiz from the Learning Center?");
    if (!confirmed) return;
    setSaving(true);
    try {
      await onDeleteQuiz(quizId);
      if (selectedQuizId === quizId) resetDraft();
      setMessage("Quiz deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete quiz.");
    } finally {
      setSaving(false);
    }
  }, [onDeleteQuiz, resetDraft, selectedQuizId]);

  return (
    <div>
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">Quiz Builder</div>
          <div className="lc-section-sub">
            Create, edit, publish, and manage quizzes for agents and teams. Current role: {currentRole}.
          </div>
        </div>
        <button className="lc-tab-btn active" onClick={resetDraft} type="button">
          ＋ New Quiz
        </button>
      </div>

      {message && (
        <div
          role="status"
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "color-mix(in srgb,var(--accent-violet) 8%,transparent)",
            border: "1px solid color-mix(in srgb,var(--accent-violet) 22%,transparent)",
            color: "var(--fg-default)",
            fontSize: "12px",
            marginBottom: "16px",
          }}
        >
          {message}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 0.9fr) minmax(360px, 1.4fr)", gap: "18px", alignItems: "start" }}>
        <section className="lc-card" style={{ cursor: "default" }}>
          <div className="lc-section-header" style={{ marginBottom: "12px" }}>
            <div>
              <div className="lc-section-title">Quiz Library</div>
              <div className="lc-section-sub">{quizzes.length} total quizzes</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
            {(["all", "draft", "published"] as const).map((status) => (
              <button
                key={status}
                className={`lc-tab-btn${filterStatus === status ? " active" : ""}`}
                type="button"
                onClick={() => setFilterStatus(status)}
              >
                {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {!filteredQuizzes.length && (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--fg-muted)", fontSize: "13px" }}>
              No quizzes in this view yet.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filteredQuizzes.map((quiz) => {
              const isSelected = selectedQuiz?.id === quiz.id;
              const status = quiz.status ?? "published";
              return (
                <article
                  key={quiz.id}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: `1px solid ${isSelected ? "color-mix(in srgb,var(--accent-violet) 35%,transparent)" : "var(--border)"}`,
                    background: isSelected ? "color-mix(in srgb,var(--accent-violet) 7%,var(--bg-elevated))" : "var(--bg-elevated)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--fg-default)", marginBottom: "4px" }}>{quiz.title}</div>
                      <div style={{ fontSize: "11px", color: "var(--fg-muted)", lineHeight: 1.5 }}>
                        {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"} · Pass {quiz.passingScore}% · +{quiz.xpReward} XP
                      </div>
                    </div>
                    <span className={`lc-badge ${status === "published" ? "lc-badge-emerald" : "lc-badge-amber"}`}>{status}</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
                    <button className="lc-assign-btn" type="button" onClick={() => handleEdit(quiz)}>Edit</button>
                    <button className="lc-assign-btn" type="button" onClick={() => handleDuplicate(quiz)}>Duplicate</button>
                    <button
                      className="lc-assign-btn"
                      type="button"
                      style={{ color: "var(--accent-rose)", borderColor: "color-mix(in srgb,var(--accent-rose) 25%,transparent)", background: "color-mix(in srgb,var(--accent-rose) 6%,transparent)" }}
                      onClick={() => handleDelete(quiz.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="lc-card" style={{ cursor: "default" }}>
          <div className="lc-section-header">
            <div>
              <div className="lc-section-title">{selectedQuizId ? "Edit Quiz" : "Create Quiz"}</div>
              <div className="lc-section-sub">Supervisors, QA, and admins manage quizzes here instead of taking them.</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Quiz Title</FieldLabel>
              <input
                style={inputStyle}
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Example: Warranty Call Handling Quiz"
              />
            </div>
            <div>
              <FieldLabel>Linked Module</FieldLabel>
              <select
                style={inputStyle}
                value={draft.moduleId ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, moduleId: event.target.value || null }))}
              >
                <option value="">No linked module</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>{module.title}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <select
                style={inputStyle}
                value={draft.status ?? "draft"}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as "draft" | "published" }))}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <FieldLabel>Passing Score</FieldLabel>
              <input
                style={inputStyle}
                type="number"
                min={0}
                max={100}
                value={draft.passingScore}
                onChange={(event) => setDraft((current) => ({ ...current, passingScore: Number(event.target.value) }))}
              />
            </div>
            <div>
              <FieldLabel>XP Reward</FieldLabel>
              <input
                style={inputStyle}
                type="number"
                min={0}
                value={draft.xpReward}
                onChange={(event) => setDraft((current) => ({ ...current, xpReward: Number(event.target.value) }))}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <FieldLabel>Description</FieldLabel>
              <textarea
                style={{ ...inputStyle, minHeight: "72px", resize: "vertical" }}
                value={draft.description ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="What should this quiz measure?"
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <FieldLabel>Audience</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {ROLE_OPTIONS.map((role) => (
                <label key={role.value} className="lc-badge lc-badge-muted" style={{ cursor: "pointer", height: "28px" }}>
                  <input
                    type="checkbox"
                    checked={isRoleChecked(draft.audienceRoles, role.value)}
                    onChange={() => handleRoleToggle(role.value)}
                    style={{ marginRight: "4px" }}
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </div>

          <div className="lc-section-header" style={{ marginTop: "20px" }}>
            <div>
              <div className="lc-section-title">Questions</div>
              <div className="lc-section-sub">Add answer options and mark the correct answer.</div>
            </div>
            <button
              className="lc-tab-btn active"
              type="button"
              onClick={() => setDraft((current) => ({ ...current, questions: [...current.questions, createBlankQuestion()] }))}
            >
              ＋ Add Question
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {draft.questions.map((question, questionIndex) => (
              <article key={question.id} style={{ padding: "14px", borderRadius: "12px", border: "1px solid var(--border)", background: "var(--bg-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--fg-default)" }}>Question {questionIndex + 1}</div>
                  <button
                    className="lc-detail-close"
                    type="button"
                    aria-label="Remove question"
                    onClick={() => setDraft((current) => ({
                      ...current,
                      questions: current.questions.length > 1 ? current.questions.filter((item) => item.id !== question.id) : current.questions,
                    }))}
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  style={{ ...inputStyle, minHeight: "54px", resize: "vertical", marginBottom: "10px" }}
                  value={question.question}
                  onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, question: event.target.value }))}
                  placeholder="Question prompt"
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {question.options.map((option, optionIndex) => (
                    <div key={`${question.id}-${optionIndex}`} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <input
                        type="radio"
                        checked={question.correctIndex === optionIndex}
                        onChange={() => updateQuestion(question.id, (current) => ({ ...current, correctIndex: optionIndex }))}
                        aria-label={`Mark option ${optionIndex + 1} as correct`}
                      />
                      <input
                        style={inputStyle}
                        value={option}
                        onChange={(event) => updateQuestion(question.id, (current) => ({
                          ...current,
                          options: current.options.map((item, index) => index === optionIndex ? event.target.value : item),
                        }))}
                        placeholder={`Option ${optionIndex + 1}`}
                      />
                    </div>
                  ))}
                </div>
                <textarea
                  style={{ ...inputStyle, minHeight: "54px", resize: "vertical", marginTop: "10px" }}
                  value={question.explanation}
                  onChange={(event) => updateQuestion(question.id, (current) => ({ ...current, explanation: event.target.value }))}
                  placeholder="Explanation shown after answer review"
                />
              </article>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "18px", flexWrap: "wrap" }}>
            <button className="lc-tab-btn" type="button" disabled={saving} onClick={() => handleSave("draft")}>Save Draft</button>
            <button className="lc-complete-btn" type="button" disabled={saving || !canPublish} style={{ width: "auto", minWidth: "150px", marginTop: 0 }} onClick={() => handleSave("published")}>
              {saving ? "Saving…" : "Publish Quiz"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
});

export default QuizManager;
