import { memo, useMemo, useState } from "react";
import type { Quiz } from "./LearningCenter";

interface QuizEngineProps {
  quiz: Quiz;
  onComplete: (score: number) => void;
  onBack: () => void;
}

function QuizEngine({ quiz, onComplete, onBack }: QuizEngineProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const answeredCount = useMemo(
    () => quiz.questions.filter((question) => answers[question.id] !== undefined).length,
    [answers, quiz.questions]
  );

  const score = useMemo(() => {
    if (quiz.questions.length === 0) return 0;
    const correct = quiz.questions.filter(
      (question) => answers[question.id] === question.correctIndex
    ).length;
    return Math.round((correct / quiz.questions.length) * 100);
  }, [answers, quiz.questions]);

  const canSubmit = answeredCount === quiz.questions.length && quiz.questions.length > 0;

  function handleSubmit() {
    setSubmitted(true);
    onComplete(score);
  }

  return (
    <div className="lc-root">
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">{quiz.title}</div>
          <div className="lc-section-sub">
            {quiz.questions.length} questions · Passing score {quiz.passingScore}%
          </div>
        </div>
        <button className="lc-tab-btn" onClick={onBack}>
          ← Back
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {quiz.questions.map((question, qIndex) => {
          const selected = answers[question.id];
          const isCorrect = submitted && selected === question.correctIndex;
          const isWrong = submitted && selected !== undefined && selected !== question.correctIndex;

          return (
            <div key={question.id} className="lc-card" style={{ cursor: "default" }}>
              <div className="lc-card-header">
                <div className="lc-card-title">
                  {qIndex + 1}. {question.question}
                </div>
                {isCorrect && <span className="lc-badge lc-badge-emerald">Correct</span>}
                {isWrong && <span className="lc-badge lc-badge-rose">Review</span>}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                {question.options.map((option, index) => {
                  const active = selected === index;
                  const correctAnswer = submitted && index === question.correctIndex;
                  const wrongAnswer = submitted && active && index !== question.correctIndex;

                  return (
                    <button
                      key={option}
                      className={`lc-tab-btn${active ? " active" : ""}`}
                      style={{
                        justifyContent: "flex-start",
                        height: "auto",
                        minHeight: "36px",
                        padding: "9px 12px",
                        borderColor: correctAnswer
                          ? "color-mix(in srgb,var(--accent-emerald) 30%,transparent)"
                          : wrongAnswer
                            ? "color-mix(in srgb,var(--accent-rose) 30%,transparent)"
                            : undefined,
                        color: correctAnswer
                          ? "var(--accent-emerald)"
                          : wrongAnswer
                            ? "var(--accent-rose)"
                            : undefined,
                      }}
                      disabled={submitted}
                      onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: index }))}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--fg-muted)", lineHeight: 1.6 }}>
                  {question.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "18px", flexWrap: "wrap" }}>
        {!submitted && (
          <button className="lc-complete-btn" disabled={!canSubmit} onClick={handleSubmit}>
            Submit Quiz
          </button>
        )}
        {submitted && (
          <>
            <div className={`lc-badge ${score >= quiz.passingScore ? "lc-badge-emerald" : "lc-badge-rose"}`}>
              Score: {score}%
            </div>
            <button className="lc-tab-btn" onClick={onBack}>
              Back to Learning Center
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(QuizEngine);
