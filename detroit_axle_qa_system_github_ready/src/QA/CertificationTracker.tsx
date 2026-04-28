import { memo, useMemo } from "react";
import type { LearningModule, Quiz, UserProgress } from "./LearningCenter";

interface CertificationTrackerProps {
  progress: UserProgress;
  modules: LearningModule[];
  quizzes: Quiz[];
  onBack: () => void;
}

function CertificationTracker({ progress, modules, quizzes, onBack }: CertificationTrackerProps) {
  const moduleCompletionRate = useMemo(() => {
    if (modules.length === 0) return 0;
    return Math.round((progress.completedModules.length / modules.length) * 100);
  }, [modules.length, progress.completedModules.length]);

  const quizCompletionRate = useMemo(() => {
    if (quizzes.length === 0) return 0;
    return Math.round((progress.completedQuizzes.length / quizzes.length) * 100);
  }, [progress.completedQuizzes.length, quizzes.length]);

  const averageQuizScore = useMemo(() => {
    const scores = Object.values(progress.quizScores);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }, [progress.quizScores]);

  const certifications = [
    {
      id: "qa-foundations",
      title: "QA Foundations",
      description: "Complete core modules and one quiz to validate quality awareness.",
      progress: Math.min(100, Math.round((moduleCompletionRate + quizCompletionRate) / 2)),
      status: moduleCompletionRate >= 40 && quizCompletionRate >= 50 ? "Certified" : "In Progress",
    },
    {
      id: "documentation-ready",
      title: "Documentation Ready",
      description: "Complete documentation training and maintain strong quiz performance.",
      progress: Math.min(100, averageQuizScore),
      status: averageQuizScore >= 80 ? "Certified" : "In Progress",
    },
    {
      id: "learning-streak",
      title: "Learning Streak",
      description: "Maintain an active learning rhythm through modules, quizzes, and refreshers.",
      progress: Math.min(100, progress.streak * 20),
      status: progress.streak >= 5 ? "Certified" : "In Progress",
    },
  ];

  return (
    <div className="lc-root">
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">Certification Tracking</div>
          <div className="lc-section-sub">
            Track completed modules, passed quizzes, and readiness milestones.
          </div>
        </div>
        <button className="lc-tab-btn" onClick={onBack}>
          ← Back
        </button>
      </div>

      <div className="lc-analytics-grid">
        <div className="lc-stat-card">
          <div className="lc-stat-val" style={{ color: "var(--accent-blue)" }}>
            {moduleCompletionRate}%
          </div>
          <div className="lc-stat-label">Module Progress</div>
        </div>
        <div className="lc-stat-card">
          <div className="lc-stat-val" style={{ color: "var(--accent-cyan)" }}>
            {quizCompletionRate}%
          </div>
          <div className="lc-stat-label">Quiz Progress</div>
        </div>
        <div className="lc-stat-card">
          <div className="lc-stat-val" style={{ color: "var(--accent-emerald)" }}>
            {averageQuizScore || "—"}%
          </div>
          <div className="lc-stat-label">Average Score</div>
        </div>
        <div className="lc-stat-card">
          <div className="lc-stat-val" style={{ color: "var(--accent-violet)" }}>
            {progress.badges.length}
          </div>
          <div className="lc-stat-label">Badges Earned</div>
        </div>
      </div>

      <div className="lc-grid">
        {certifications.map((certification) => (
          <div key={certification.id} className="lc-card" style={{ cursor: "default" }}>
            <div className="lc-card-header">
              <div className="lc-card-title">{certification.title}</div>
              <span className={`lc-badge ${certification.status === "Certified" ? "lc-badge-emerald" : "lc-badge-amber"}`}>
                {certification.status}
              </span>
            </div>
            <div className="lc-card-desc">{certification.description}</div>
            <div className="lc-standard-bar">
              <div
                className="lc-standard-bar-fill"
                style={{
                  width: `${certification.progress}%`,
                  background: certification.status === "Certified" ? "var(--accent-emerald)" : "var(--accent-violet)",
                }}
              />
            </div>
            <div style={{ fontSize: "11px", color: "var(--fg-muted)", marginTop: "8px" }}>
              {certification.progress}% complete
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(CertificationTracker);
