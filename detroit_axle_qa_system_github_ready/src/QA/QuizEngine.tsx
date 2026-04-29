import {
  memo,
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { Quiz } from "./LearningCenter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizEngineProps {
  quiz: Quiz;
  onComplete: (score: number) => void;
  onBack: () => void;
}

type QuizPhase = "intro" | "question" | "review" | "result";

interface AnswerState {
  selectedIndex: number;
  /** ms elapsed when answer was submitted */
  timeSpentMs: number;
}

// ─── CSS injection ────────────────────────────────────────────────────────────

const QE_CSS_ID = "da-quiz-engine-v2";
const QE_CSS = `
.qe-root{display:flex;flex-direction:column;gap:0;min-height:100%;animation:fadeUp 220ms ease both}
.qe-progress-track{height:3px;border-radius:999px;background:var(--border);overflow:hidden;margin-bottom:28px}
.qe-progress-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--accent-violet),var(--accent-blue),var(--accent-cyan));transition:width 400ms ease}
.qe-question-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;padding:24px 26px;animation:fadeUp 180ms ease both}
.qe-q-label{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--fg-muted);margin-bottom:10px;display:flex;align-items:center;justify-content:space-between}
.qe-q-text{font-size:16px;font-weight:700;color:var(--fg-default);letter-spacing:-0.02em;line-height:1.5;margin-bottom:22px}
.qe-options{display:flex;flex-direction:column;gap:8px}
.qe-option{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;border:1px solid var(--border);background:var(--bg-overlay);cursor:pointer;transition:all 120ms ease;text-align:left;font-family:inherit;color:var(--fg-default);font-size:13px;font-weight:500;line-height:1.4}
.qe-option:hover:not(:disabled){border-color:var(--border-strong);background:var(--bg-subtle-hover);transform:translateX(2px)}
.qe-option:disabled{cursor:default}
.qe-option.selected{border-color:color-mix(in srgb,var(--accent-violet) 30%,transparent);background:color-mix(in srgb,var(--accent-violet) 8%,transparent);color:var(--fg-default)}
.qe-option.correct{border-color:color-mix(in srgb,var(--accent-emerald) 35%,transparent);background:color-mix(in srgb,var(--accent-emerald) 8%,transparent);color:var(--accent-emerald)}
.qe-option.wrong{border-color:color-mix(in srgb,var(--accent-rose) 35%,transparent);background:color-mix(in srgb,var(--accent-rose) 8%,transparent);color:var(--accent-rose)}
.qe-option.missed{border-color:color-mix(in srgb,var(--accent-emerald) 20%,transparent);background:transparent}
.qe-option-letter{width:26px;height:26px;border-radius:7px;background:var(--bg-subtle);border:1px solid var(--border);display:grid;place-items:center;font-size:11px;font-weight:700;flex-shrink:0;font-family:var(--font-mono,monospace);transition:all 120ms ease}
.qe-option.selected .qe-option-letter{background:color-mix(in srgb,var(--accent-violet) 15%,transparent);border-color:color-mix(in srgb,var(--accent-violet) 30%,transparent);color:var(--accent-violet)}
.qe-option.correct .qe-option-letter{background:color-mix(in srgb,var(--accent-emerald) 15%,transparent);border-color:color-mix(in srgb,var(--accent-emerald) 30%,transparent);color:var(--accent-emerald)}
.qe-option.wrong .qe-option-letter{background:color-mix(in srgb,var(--accent-rose) 15%,transparent);border-color:color-mix(in srgb,var(--accent-rose) 30%,transparent);color:var(--accent-rose)}
.qe-explanation{margin-top:16px;padding:12px 14px;border-radius:8px;border-left:3px solid var(--accent-cyan);background:color-mix(in srgb,var(--accent-cyan) 5%,var(--bg-subtle));font-size:12px;color:var(--fg-muted);line-height:1.7;animation:fadeUp 160ms ease both}
.qe-explanation strong{color:var(--fg-default);font-weight:600}
.qe-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:22px;flex-wrap:wrap}
.qe-nav-btn{display:flex;align-items:center;gap:6px;height:38px;padding:0 18px;border-radius:9px;border:1px solid var(--border-strong);background:var(--bg-elevated);color:var(--fg-default);font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 120ms ease}
.qe-nav-btn:hover:not(:disabled){background:var(--bg-overlay);border-color:var(--border-strong)}
.qe-nav-btn:disabled{opacity:0.35;cursor:not-allowed}
.qe-nav-btn.primary{background:linear-gradient(135deg,var(--accent-violet),var(--accent-blue));color:#fff;border:none}
.qe-nav-btn.primary:hover:not(:disabled){opacity:0.9;transform:translateY(-1px)}
.qe-dots{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;flex:1}
.qe-dot{width:8px;height:8px;border-radius:50%;background:var(--border);transition:all 180ms ease;flex-shrink:0}
.qe-dot.answered{background:var(--accent-blue)}
.qe-dot.current{background:var(--accent-violet);transform:scale(1.35)}
.qe-dot.correct{background:var(--accent-emerald)}
.qe-dot.wrong{background:var(--accent-rose)}
.qe-timer{display:flex;align-items:center;gap:5px;font-family:var(--font-mono,monospace);font-size:12px;font-weight:600;color:var(--fg-muted);letter-spacing:0.04em}
.qe-timer.warning{color:var(--accent-amber);animation:pulse 1s ease infinite}
.qe-timer.danger{color:var(--accent-rose);animation:pulse 0.5s ease infinite}
.qe-intro{background:var(--bg-elevated);border:1px solid var(--border);border-radius:16px;padding:32px;text-align:center;animation:scaleIn 200ms var(--spring,cubic-bezier(.175,.885,.32,1.075)) both}
.qe-result{background:var(--bg-elevated);border:1px solid var(--border);border-radius:16px;padding:36px;text-align:center;animation:scaleIn 220ms var(--spring,cubic-bezier(.175,.885,.32,1.075)) both}
.qe-result-score{font-size:72px;font-weight:800;letter-spacing:-0.06em;line-height:1;margin:16px 0}
.qe-result-label{font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:4px}
.qe-result-msg{font-size:14px;color:var(--fg-muted);line-height:1.6;max-width:400px;margin:0 auto 24px}
.qe-review-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:12px}
.qe-review-header{display:flex;align-items:flex-start;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border)}
.qe-review-icon{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:13px;flex-shrink:0}
.qe-review-body{padding:14px 18px;display:flex;flex-direction:column;gap:8px}
.qe-xp-burst{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:8px;font-size:13px;font-weight:700;background:color-mix(in srgb,var(--accent-violet) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent-violet) 22%,transparent);color:var(--accent-violet)}
@keyframes scaleIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
`;

function injectQEStyles() {
  if (document.getElementById(QE_CSS_ID)) return;
  const el = document.createElement("style");
  el.id = QE_CSS_ID;
  el.textContent = QE_CSS;
  document.head.appendChild(el);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OPTION_LETTERS = ["A", "B", "C", "D", "E"];
/** Seconds allowed per question. 0 = no timer */
const SECONDS_PER_QUESTION = 60;

// ─── Timer hook ───────────────────────────────────────────────────────────────

function useQuestionTimer(
  active: boolean,
  limitSecs: number,
  onExpire: () => void
): number {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setElapsed(0);
    if (!active || limitSecs === 0) return;

    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        if (next >= limitSecs) {
          clearInterval(intervalRef.current!);
          onExpireRef.current();
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, limitSecs]);

  return elapsed;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TimerDisplay = memo(function TimerDisplay({
  elapsed,
  limit,
}: {
  elapsed: number;
  limit: number;
}) {
  const remaining = limit - elapsed;
  const cls =
    remaining <= 10 ? "qe-timer danger" : remaining <= 20 ? "qe-timer warning" : "qe-timer";
  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  return (
    <div className={cls} aria-live="polite" aria-label={`${remaining} seconds remaining`}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      {mm}:{ss}
    </div>
  );
});

const ProgressDots = memo(function ProgressDots({
  total,
  current,
  answers,
  questions,
  phase,
}: {
  total: number;
  current: number;
  answers: Record<string, AnswerState>;
  questions: Quiz["questions"];
  phase: QuizPhase;
}) {
  return (
    <div className="qe-dots" aria-label="Question progress">
      {Array.from({ length: total }, (_, i) => {
        const q = questions[i];
        const ans = answers[q?.id ?? ""];
        let cls = "qe-dot";
        if (phase === "review" || phase === "result") {
          cls += ans !== undefined
            ? ans.selectedIndex === q.correctIndex
              ? " correct"
              : " wrong"
            : "";
        } else {
          if (i === current) cls += " current";
          else if (ans !== undefined) cls += " answered";
        }
        return (
          <div
            key={i}
            className={cls}
            title={`Question ${i + 1}`}
            aria-label={`Question ${i + 1}`}
          />
        );
      })}
    </div>
  );
});

// ─── Intro screen ─────────────────────────────────────────────────────────────

const IntroScreen = memo(function IntroScreen({
  quiz,
  onStart,
  onBack,
}: {
  quiz: Quiz;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <div className="qe-root">
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">{quiz.title}</div>
          <div className="lc-section-sub">Review the details before starting</div>
        </div>
        <button className="lc-tab-btn" onClick={onBack}>← Back</button>
      </div>

      <div className="qe-intro">
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>📝</div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--fg-default)", marginBottom: "8px" }}>
          {quiz.title}
        </h2>
        <p style={{ fontSize: "13px", color: "var(--fg-muted)", lineHeight: 1.6, maxWidth: "400px", margin: "0 auto 24px" }}>
          {quiz.description ?? "Test your knowledge with this assessment."}
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginBottom: "28px" }}>
          {[
            { icon: "❓", label: `${quiz.questions.length} Questions` },
            { icon: "🎯", label: `Pass: ${quiz.passingScore}%` },
            { icon: "⏱️", label: `${SECONDS_PER_QUESTION}s / question` },
            { icon: "⚡", label: `+${quiz.xpReward} XP on pass` },
          ].map(({ icon, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "8px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--fg-default)",
              }}
            >
              <span>{icon}</span> {label}
            </div>
          ))}
        </div>

        <button className="qe-nav-btn primary" style={{ margin: "0 auto" }} onClick={onStart}>
          Start Quiz →
        </button>
      </div>
    </div>
  );
});

// ─── Result screen ────────────────────────────────────────────────────────────

const ResultScreen = memo(function ResultScreen({
  quiz,
  score,
  answers,
  onReview,
  onBack,
}: {
  quiz: Quiz;
  score: number;
  answers: Record<string, AnswerState>;
  onReview: () => void;
  onBack: () => void;
}) {
  const passed = score >= quiz.passingScore;
  const correct = quiz.questions.filter(
    (q) => answers[q.id]?.selectedIndex === q.correctIndex
  ).length;

  const scoreColor = passed ? "var(--accent-emerald)" : "var(--accent-rose)";
  const message = passed
    ? score === 100
      ? "Perfect score! Exceptional mastery."
      : "Great work — you've passed this assessment."
    : `Not quite — you need ${quiz.passingScore}% to pass. Review and retry!`;

  return (
    <div className="qe-root">
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">Quiz Complete</div>
          <div className="lc-section-sub">{quiz.title}</div>
        </div>
        <button className="lc-tab-btn" onClick={onBack}>← Back</button>
      </div>

      <div className="qe-result">
        <div className="qe-result-label" style={{ color: scoreColor }}>
          {passed ? "✓ Passed" : "✗ Failed"}
        </div>
        <div className="qe-result-score" style={{ color: scoreColor }}>
          {score}<span style={{ fontSize: "32px", opacity: 0.5 }}>%</span>
        </div>
        <div className="qe-result-msg">{message}</div>

        {/* Stats row */}
        <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", marginBottom: "28px" }}>
          {[
            { label: "Correct", value: `${correct} / ${quiz.questions.length}`, color: "var(--accent-emerald)" },
            { label: "Wrong", value: `${quiz.questions.length - correct}`, color: "var(--accent-rose)" },
            { label: "Pass Mark", value: `${quiz.passingScore}%`, color: "var(--fg-muted)" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                padding: "12px 20px",
                borderRadius: "10px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                minWidth: "90px",
              }}
            >
              <div style={{ fontSize: "20px", fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</div>
              <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-muted)", marginTop: "2px" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* XP reward */}
        {passed && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
            <div className="qe-xp-burst">⚡ +{quiz.xpReward} XP Earned!</div>
          </div>
        )}

        {/* Dot recap */}
        <div style={{ display: "flex", justifyContent: "center", gap: "5px", marginBottom: "24px", flexWrap: "wrap" }}>
          {quiz.questions.map((q, i) => {
            const ans = answers[q.id];
            const wasCorrect = ans?.selectedIndex === q.correctIndex;
            return (
              <div
                key={q.id}
                title={`Q${i + 1}: ${wasCorrect ? "Correct" : "Wrong"}`}
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: wasCorrect ? "var(--accent-emerald)" : "var(--accent-rose)",
                }}
              />
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
          <button className="qe-nav-btn" onClick={onReview}>
            📋 Review Answers
          </button>
          <button className="qe-nav-btn primary" onClick={onBack}>
            Back to Learning Center
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Review screen ────────────────────────────────────────────────────────────

const ReviewScreen = memo(function ReviewScreen({
  quiz,
  answers,
  score,
  onBack,
}: {
  quiz: Quiz;
  answers: Record<string, AnswerState>;
  score: number;
  onBack: () => void;
}) {
  const passed = score >= quiz.passingScore;

  return (
    <div className="qe-root">
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">Answer Review</div>
          <div className="lc-section-sub">{quiz.title} · Score: {score}%</div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <span className={`lc-badge ${passed ? "lc-badge-emerald" : "lc-badge-rose"}`}>
            {passed ? "Passed" : "Failed"}
          </span>
          <button className="lc-tab-btn" onClick={onBack}>← Back</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {quiz.questions.map((q, idx) => {
          const ans = answers[q.id];
          const selected = ans?.selectedIndex;
          const wasCorrect = selected === q.correctIndex;
          const wasSkipped = selected === undefined;

          return (
            <div key={q.id} className="qe-review-card">
              <div className="qe-review-header">
                <div
                  className="qe-review-icon"
                  style={{
                    background: wasSkipped
                      ? "var(--bg-subtle)"
                      : wasCorrect
                      ? "color-mix(in srgb,var(--accent-emerald) 12%,transparent)"
                      : "color-mix(in srgb,var(--accent-rose) 12%,transparent)",
                  }}
                >
                  {wasSkipped ? "—" : wasCorrect ? "✓" : "✗"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: "4px" }}>
                    Question {idx + 1}
                    {ans?.timeSpentMs !== undefined && (
                      <span style={{ marginLeft: "8px", opacity: 0.7 }}>
                        · {(ans.timeSpentMs / 1000).toFixed(1)}s
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--fg-default)", letterSpacing: "-0.01em", lineHeight: 1.4 }}>
                    {q.question}
                  </div>
                </div>
                <span
                  className={`lc-badge ${wasSkipped ? "lc-badge-muted" : wasCorrect ? "lc-badge-emerald" : "lc-badge-rose"}`}
                >
                  {wasSkipped ? "Skipped" : wasCorrect ? "Correct" : "Wrong"}
                </span>
              </div>

              <div className="qe-review-body">
                {q.options.map((opt, i) => {
                  const isSelected = selected === i;
                  const isCorrectOpt = i === q.correctIndex;
                  let cls = "qe-option";
                  if (isCorrectOpt) cls += " correct";
                  else if (isSelected && !isCorrectOpt) cls += " wrong";

                  return (
                    <div key={opt} className={cls} style={{ cursor: "default" }}>
                      <span className="qe-option-letter">{OPTION_LETTERS[i]}</span>
                      <span style={{ flex: 1 }}>{opt}</span>
                      {isCorrectOpt && (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-emerald)", flexShrink: 0 }}>✓ Correct</span>
                      )}
                      {isSelected && !isCorrectOpt && (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-rose)", flexShrink: 0 }}>Your answer</span>
                      )}
                    </div>
                  );
                })}
                <div className="qe-explanation">
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end" }}>
        <button className="qe-nav-btn primary" onClick={onBack}>
          Back to Learning Center
        </button>
      </div>
    </div>
  );
});

// ─── Main QuizEngine ──────────────────────────────────────────────────────────

function QuizEngine({ quiz, onComplete, onBack }: QuizEngineProps) {
  // Inject styles once
  useEffect(() => { injectQEStyles(); }, []);

  const [phase, setPhase] = useState<QuizPhase>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [questionStartMs, setQuestionStartMs] = useState(0);

  const currentQuestion = quiz.questions[currentIndex];
  const totalQuestions = quiz.questions.length;
  const isTimerActive = phase === "question" && answers[currentQuestion?.id] === undefined;

  // ── Timer ────────────────────────────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    // Auto-advance without selecting — question stays unanswered (skipped)
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= totalQuestions) {
        setPhase("result");
        return prev;
      }
      setQuestionStartMs(Date.now());
      return next;
    });
  }, [totalQuestions]);

  const elapsed = useQuestionTimer(isTimerActive, SECONDS_PER_QUESTION, handleTimerExpire);

  // ── Score ────────────────────────────────────────────────────────────────
  const score = useMemo(() => {
    if (totalQuestions === 0) return 0;
    const correct = quiz.questions.filter(
      (q) => answers[q.id]?.selectedIndex === q.correctIndex
    ).length;
    return Math.round((correct / totalQuestions) * 100);
  }, [answers, quiz.questions, totalQuestions]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    setPhase("question");
    setCurrentIndex(0);
    setAnswers({});
    setQuestionStartMs(Date.now());
  }, []);

  const handleSelectOption = useCallback((index: number) => {
    if (!currentQuestion) return;
    setAnswers((prev) => {
      if (prev[currentQuestion.id] !== undefined) return prev; // immutable once answered
      return {
        ...prev,
        [currentQuestion.id]: {
          selectedIndex: index,
          timeSpentMs: Date.now() - questionStartMs,
        },
      };
    });
  }, [currentQuestion, questionStartMs]);

  const handleNext = useCallback(() => {
    const next = currentIndex + 1;
    if (next >= totalQuestions) {
      setPhase("result");
      onComplete(score);
    } else {
      setCurrentIndex(next);
      setQuestionStartMs(Date.now());
    }
  }, [currentIndex, totalQuestions, score, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setQuestionStartMs(Date.now());
    }
  }, [currentIndex]);

  const handleFinishEarly = useCallback(() => {
    setPhase("result");
    onComplete(score);
  }, [score, onComplete]);

  const handleGoToReview = useCallback(() => {
    setPhase("review");
  }, []);

  // ── Guard: empty quiz ─────────────────────────────────────────────────────
  if (totalQuestions === 0) {
    return (
      <div className="qe-root">
        <div className="lc-section-header">
          <div className="lc-section-title">{quiz.title}</div>
          <button className="lc-tab-btn" onClick={onBack}>← Back</button>
        </div>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--fg-muted)", fontSize: "13px" }}>
          This quiz has no questions yet.
        </div>
      </div>
    );
  }

  // ── Phase routing ─────────────────────────────────────────────────────────
  if (phase === "intro") {
    return <IntroScreen quiz={quiz} onStart={handleStart} onBack={onBack} />;
  }

  if (phase === "result") {
    return (
      <ResultScreen
        quiz={quiz}
        score={score}
        answers={answers}
        onReview={handleGoToReview}
        onBack={onBack}
      />
    );
  }

  if (phase === "review") {
    return (
      <ReviewScreen
        quiz={quiz}
        answers={answers}
        score={score}
        onBack={onBack}
      />
    );
  }

  // ── Question phase ────────────────────────────────────────────────────────
  const currentAnswer = answers[currentQuestion.id];
  const hasAnswered = currentAnswer !== undefined;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const answeredCount = Object.keys(answers).length;
  const progressPct = Math.round((currentIndex / totalQuestions) * 100);

  return (
    <div className="qe-root">
      {/* Header */}
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">{quiz.title}</div>
          <div className="lc-section-sub">
            {answeredCount} of {totalQuestions} answered · Pass: {quiz.passingScore}%
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {answeredCount > 0 && (
            <button className="lc-tab-btn" onClick={handleFinishEarly} style={{ color: "var(--accent-amber)" }}>
              Finish Early
            </button>
          )}
          <button className="lc-tab-btn" onClick={onBack}>← Back</button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="qe-progress-track">
        <div className="qe-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Question card */}
      <div className="qe-question-card" key={currentQuestion.id}>
        <div className="qe-q-label">
          <span>Question {currentIndex + 1} of {totalQuestions}</span>
          {SECONDS_PER_QUESTION > 0 && !hasAnswered && (
            <TimerDisplay elapsed={elapsed} limit={SECONDS_PER_QUESTION} />
          )}
          {hasAnswered && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: currentAnswer.selectedIndex === currentQuestion.correctIndex
                  ? "var(--accent-emerald)"
                  : "var(--accent-rose)",
              }}
            >
              {currentAnswer.selectedIndex === currentQuestion.correctIndex ? "✓ Correct" : "✗ Incorrect"}
            </span>
          )}
        </div>

        <div className="qe-q-text">{currentQuestion.question}</div>

        <div className="qe-options" role="radiogroup" aria-label="Answer options">
          {currentQuestion.options.map((option, index) => {
            const isSelected = currentAnswer?.selectedIndex === index;
            const isCorrectOpt = hasAnswered && index === currentQuestion.correctIndex;
            const isWrongOpt = hasAnswered && isSelected && index !== currentQuestion.correctIndex;
            const isMissed = hasAnswered && !isSelected && index === currentQuestion.correctIndex;

            let cls = "qe-option";
            if (isCorrectOpt) cls += " correct";
            else if (isWrongOpt) cls += " wrong";
            else if (isMissed) cls += " missed";
            else if (isSelected) cls += " selected";

            return (
              <button
                key={option}
                className={cls}
                disabled={hasAnswered}
                onClick={() => handleSelectOption(index)}
                role="radio"
                aria-checked={isSelected}
                aria-label={`Option ${OPTION_LETTERS[index]}: ${option}`}
              >
                <span className="qe-option-letter">{OPTION_LETTERS[index]}</span>
                <span style={{ flex: 1 }}>{option}</span>
                {isCorrectOpt && (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-emerald)", flexShrink: 0 }}>
                    ✓
                  </span>
                )}
                {isWrongOpt && (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent-rose)", flexShrink: 0 }}>
                    ✗
  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation (shown after answering) */}
        {hasAnswered && (
          <div className="qe-explanation">
            <strong>Explanation:</strong> {currentQuestion.explanation}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="qe-nav">
        <button
          className="qe-nav-btn"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          aria-label="Previous question"
        >
          ← Prev
        </button>

        <ProgressDots
          total={totalQuestions}
          current={currentIndex}
          answers={answers}
          questions={quiz.questions}
          phase={phase}
        />

        {hasAnswered ? (
          <button
            className="qe-nav-btn primary"
            onClick={handleNext}
            aria-label={isLastQuestion ? "Submit quiz" : "Next question"}
          >
            {isLastQuestion ? "Submit Quiz →" : "Next →"}
          </button>
        ) : (
          <button
            className="qe-nav-btn"
            onClick={handleNext}
            disabled={currentIndex === 0 && !hasAnswered}
            aria-label="Skip question"
            style={{ opacity: 0.6 }}
          >
            Skip →
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(QuizEngine);
