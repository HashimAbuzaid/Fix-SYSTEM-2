import { memo, useMemo, useState } from 'react';

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  feedback: string;
  topic: string;
};

type QuizEngineProps = {
  questions: QuizQuestion[];
  onComplete?: (score: number) => void;
};

function QuizEngine({ questions, onComplete }: QuizEngineProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const score = useMemo(() => {
    if (!questions.length) return 0;
    const correct = questions.filter((question) => answers[question.id] === question.correctAnswer).length;
    return (correct / questions.length) * 100;
  }, [answers, questions]);

  const answeredCount = questions.filter((question) => answers[question.id]).length;
  const canSubmit = answeredCount === questions.length && questions.length > 0;

  function handleSubmit() {
    setSubmitted(true);
    onComplete?.(score);
  }

  if (!questions.length) {
    return <div className="lc-empty">No quiz questions are available yet.</div>;
  }

  return (
    <section className="lc-card lc-card-pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 className="lc-section-title">Refresher Quiz</h2>
          <p className="lc-mini-copy">Scenario-based checks with instant feedback.</p>
        </div>
        <span className="lc-pill">{answeredCount} / {questions.length} answered</span>
      </div>

      <div className="lc-list">
        {questions.map((question) => {
          const selected = answers[question.id];
          const isCorrect = submitted && selected === question.correctAnswer;
          const isWrong = submitted && !!selected && selected !== question.correctAnswer;

          return (
            <div className="lc-card lc-card-pad" key={question.id}>
              <div className="lc-pill-row" style={{ marginBottom: 10 }}>
                <span className="lc-pill">{question.topic}</span>
                {isCorrect && <span className="lc-pill">Correct</span>}
                {isWrong && <span className="lc-pill">Review</span>}
              </div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{question.prompt}</h3>
              <div className="lc-list" style={{ marginTop: 12 }}>
                {question.options.map((option) => (
                  <button
                    type="button"
                    className={`lc-btn${selected === option ? ' lc-btn-primary' : ''}`}
                    key={option}
                    onClick={() => {
                      if (!submitted) {
                        setAnswers((prev) => ({ ...prev, [question.id]: option }));
                      }
                    }}
                    style={{ justifyContent: 'flex-start', minHeight: 38 }}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {submitted && (
                <p className="lc-mini-copy" style={{ marginTop: 12 }}>
                  {question.feedback}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="lc-pill-row" style={{ marginTop: 16, alignItems: 'center' }}>
        <button type="button" className="lc-btn lc-btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
          Submit quiz
        </button>
        {submitted && <span className="lc-pill">Score: {score.toFixed(0)}%</span>}
      </div>
    </section>
  );
}

export default memo(QuizEngine);
