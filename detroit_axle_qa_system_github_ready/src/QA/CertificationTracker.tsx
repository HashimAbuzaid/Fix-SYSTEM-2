import { memo, useMemo, useState, useCallback, useEffect } from "react";
import type { LearningModule, Quiz, UserProgress, Certification } from "./LearningCenter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CertificationDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  badgeColor: string;
  /** All of these module IDs must be completed */
  requiredModuleIds: string[];
  /** All of these quiz IDs must be passed */
  requiredQuizIds: string[];
  /** Minimum average quiz score across required quizzes */
  minAvgScore: number;
  /** Minimum XP required */
  minXP: number;
  /** Minimum streak days */
  minStreak: number;
  /** Category tag shown on badge */
  category: string;
}

interface EvaluatedCert {
  definition: CertificationDefinition;
  earned: boolean;
  earnedAt: string | null;
  progressPct: number;
  /** Granular breakdown of each criterion */
  criteria: CriterionResult[];
}

interface CriterionResult {
  label: string;
  met: boolean;
  current: string;
  required: string;
}

interface CertificationTrackerProps {
  progress: UserProgress;
  modules: LearningModule[];
  quizzes: Quiz[];
  /** Certifications already stored in Supabase for this user */
  earnedCertifications?: Certification[];
  onBack: () => void;
  /** Called when the component detects a newly earned cert so the parent can persist it */
  onCertificationEarned?: (certId: string) => void;
}

// ─── Certification definitions ────────────────────────────────────────────────
// In a full Supabase integration these come from the `certifications` table.
// They live here as typed constants so the component is self-contained and
// testable without a live DB, while the shape mirrors the DB row exactly.

const CERTIFICATION_DEFINITIONS: CertificationDefinition[] = [
  {
    id: "qa-foundations",
    title: "QA Foundations",
    description:
      "Demonstrates core quality awareness by completing foundational modules and passing the introductory assessment.",
    icon: "🎓",
    badgeColor: "var(--accent-blue)",
    category: "Core",
    requiredModuleIds: [], // dynamically matched by tag; any 3 modules count
    requiredQuizIds: [],   // any 1 quiz
    minAvgScore: 70,
    minXP: 100,
    minStreak: 0,
  },
  {
    id: "documentation-specialist",
    title: "Documentation Specialist",
    description:
      "Mastery of ticket documentation standards — complete relevant modules and achieve ≥80% on all quizzes.",
    icon: "📋",
    badgeColor: "var(--accent-violet)",
    category: "Documentation",
    requiredModuleIds: [],
    requiredQuizIds: [],
    minAvgScore: 80,
    minXP: 250,
    minStreak: 0,
  },
  {
    id: "learning-streak",
    title: "Learning Streak",
    description:
      "Sustained engagement over 5+ consecutive active days — a testament to consistent professional development.",
    icon: "🔥",
    badgeColor: "var(--accent-amber)",
    category: "Engagement",
    requiredModuleIds: [],
    requiredQuizIds: [],
    minAvgScore: 0,
    minXP: 0,
    minStreak: 5,
  },
  {
    id: "perfect-scorer",
    title: "Perfect Scorer",
    description:
      "Achieved 100% on at least one assessment, demonstrating exceptional mastery of the material.",
    icon: "⭐",
    badgeColor: "var(--accent-amber)",
    category: "Achievement",
    requiredModuleIds: [],
    requiredQuizIds: [],
    minAvgScore: 0,
    minXP: 0,
    minStreak: 0,
  },
  {
    id: "module-master",
    title: "Module Master",
    description:
      "Completed 5 or more training modules, showing broad investment in quality knowledge.",
    icon: "📚",
    badgeColor: "var(--accent-emerald)",
    category: "Completion",
    requiredModuleIds: [],
    requiredQuizIds: [],
    minAvgScore: 0,
    minXP: 500,
    minStreak: 0,
  },
  {
    id: "xp-legend",
    title: "XP Legend",
    description:
      "Accumulated 1,500+ XP — the highest engagement tier for learners on the platform.",
    icon: "🏆",
    badgeColor: "var(--accent-rose)",
    category: "Elite",
    requiredModuleIds: [],
    requiredQuizIds: [],
    minAvgScore: 0,
    minXP: 1500,
    minStreak: 0,
  },
];

// ─── Evaluation logic ─────────────────────────────────────────────────────────

function evaluateCertification(
  def: CertificationDefinition,
  progress: UserProgress,
  modules: LearningModule[],
  quizzes: Quiz[],
  earnedCerts: Certification[]
): EvaluatedCert {
  const alreadyEarned = earnedCerts.find((c) => c.id === def.id);

  const scores = Object.values(progress.quizScores) as number[];
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  const hasPerfect = scores.some((s) => s === 100);
  const completedModuleCount = progress.completedModules.filter((id: string) =>
    modules.some((m) => m.id === id)
  ).length;

  const criteria: CriterionResult[] = [];

  // ── XP ───────────────────────────────────────────────────────────────────
  if (def.minXP > 0) {
    criteria.push({
      label: "XP Earned",
      met: progress.xp >= def.minXP,
      current: `${progress.xp} XP`,
      required: `${def.minXP} XP`,
    });
  }

  // ── Average quiz score ────────────────────────────────────────────────────
  if (def.minAvgScore > 0) {
    criteria.push({
      label: "Avg. Quiz Score",
      met: avgScore >= def.minAvgScore,
      current: scores.length > 0 ? `${avgScore}%` : "No quizzes taken",
      required: `≥${def.minAvgScore}%`,
    });
  }

  // ── Streak ────────────────────────────────────────────────────────────────
  if (def.minStreak > 0) {
    criteria.push({
      label: "Learning Streak",
      met: progress.streak >= def.minStreak,
      current: `${progress.streak} days`,
      required: `${def.minStreak} days`,
    });
  }

  // ── Perfect score special rule ────────────────────────────────────────────
  if (def.id === "perfect-scorer") {
    criteria.push({
      label: "Perfect Quiz Score (100%)",
      met: hasPerfect,
      current: hasPerfect ? "Achieved" : "Not yet",
      required: "At least once",
    });
  }

  // ── Module count ──────────────────────────────────────────────────────────
  if (def.id === "module-master") {
    const required = 5;
    criteria.push({
      label: "Modules Completed",
      met: completedModuleCount >= required,
      current: `${completedModuleCount}`,
      required: `${required}`,
    });
  }

  // ── Required modules ──────────────────────────────────────────────────────
  for (const modId of def.requiredModuleIds) {
    const mod = modules.find((m) => m.id === modId);
    if (!mod) continue;
    criteria.push({
      label: `Module: ${mod.title}`,
      met: progress.completedModules.includes(modId),
      current: progress.completedModules.includes(modId) ? "Complete" : "Incomplete",
      required: "Complete",
    });
  }

  // ── Required quizzes ──────────────────────────────────────────────────────
  for (const quizId of def.requiredQuizIds) {
    const quiz = quizzes.find((q) => q.id === quizId);
    if (!quiz) continue;
    const score = progress.quizScores[quizId] ?? 0;
    criteria.push({
      label: `Quiz: ${quiz.title}`,
      met: score >= quiz.passingScore,
      current: score > 0 ? `${score}%` : "Not taken",
      required: `≥${quiz.passingScore}%`,
    });
  }

  // ── QA Foundations special rule: any 3 modules + any 1 quiz ──────────────
  if (def.id === "qa-foundations") {
    const required = 3;
    criteria.push({
      label: "Modules Completed",
      met: completedModuleCount >= required,
      current: `${completedModuleCount}`,
      required: `${required}`,
    });
    const quizzesPassed = progress.completedQuizzes.length;
    criteria.push({
      label: "Quizzes Passed",
      met: quizzesPassed >= 1,
      current: `${quizzesPassed}`,
      required: "1",
    });
  }

  const earned = alreadyEarned ? true : criteria.every((c) => c.met);

  // Progress percentage: fraction of criteria met
  const progressPct =
    criteria.length === 0
      ? earned ? 100 : 0
      : Math.round((criteria.filter((c) => c.met).length / criteria.length) * 100);

  return {
    definition: def,
    earned,
    earnedAt: alreadyEarned?.earnedAt ?? (earned ? new Date().toISOString() : null),
    progressPct,
    criteria,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const CriterionRow = memo(function CriterionRow({ criterion }: { criterion: CriterionResult }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "6px 0",
        borderBottom: "1px solid var(--border)",
        fontSize: "12px",
      }}
    >
      <span
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          fontSize: "10px",
          flexShrink: 0,
          background: criterion.met
            ? "color-mix(in srgb,var(--accent-emerald) 15%,transparent)"
            : "var(--bg-subtle)",
          color: criterion.met ? "var(--accent-emerald)" : "var(--fg-muted)",
          border: `1px solid ${criterion.met ? "color-mix(in srgb,var(--accent-emerald) 25%,transparent)" : "var(--border)"}`,
        }}
      >
        {criterion.met ? "✓" : "○"}
      </span>
      <span style={{ flex: 1, color: criterion.met ? "var(--fg-default)" : "var(--fg-muted)" }}>
        {criterion.label}
      </span>
      <span style={{ color: "var(--fg-muted)", fontVariantNumeric: "tabular-nums" }}>
        {criterion.current}
      </span>
      <span style={{ color: "var(--fg-subtle)", fontSize: "11px" }}>/ {criterion.required}</span>
    </div>
  );
});

const CertCard = memo(function CertCard({ cert, isExpanded, onToggle }: {
  cert: EvaluatedCert;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { definition: def, earned, earnedAt, progressPct, criteria } = cert;

  const formattedDate = useMemo(() => {
    if (!earnedAt) return null;
    try {
      return new Date(earnedAt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      });
    } catch {
      return earnedAt;
    }
  }, [earnedAt]);

  return (
    <div
      style={{
        background: earned
          ? `linear-gradient(135deg, color-mix(in srgb,${def.badgeColor} 6%,var(--bg-elevated)), var(--bg-elevated))`
          : "var(--bg-elevated)",
        border: `1px solid ${earned
          ? `color-mix(in srgb,${def.badgeColor} 22%,transparent)`
          : "var(--border)"}`,
        borderRadius: "14px",
        overflow: "hidden",
        transition: "border-color 140ms ease, box-shadow 140ms ease",
        boxShadow: earned ? `0 0 0 1px color-mix(in srgb,${def.badgeColor} 8%,transparent)` : "none",
      }}
    >
      {/* Card header */}
      <div
        style={{
          padding: "18px 20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "14px",
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={onToggle}
        role="button"
        aria-expanded={isExpanded}
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        {/* Badge icon */}
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: earned
              ? `color-mix(in srgb,${def.badgeColor} 15%,transparent)`
              : "var(--bg-subtle)",
            border: `1px solid ${earned
              ? `color-mix(in srgb,${def.badgeColor} 25%,transparent)`
              : "var(--border)"}`,
            display: "grid",
            placeItems: "center",
            fontSize: "22px",
            flexShrink: 0,
            filter: earned ? "none" : "grayscale(1) opacity(0.4)",
            transition: "filter 200ms ease",
          }}
        >
          {def.icon}
        </div>

        {/* Title + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
            <span
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: earned ? "var(--fg-default)" : "var(--fg-muted)",
                letterSpacing: "-0.01em",
              }}
            >
              {def.title}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: "18px",
                padding: "0 7px",
                borderRadius: "5px",
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                background: earned
                  ? `color-mix(in srgb,${def.badgeColor} 12%,transparent)`
                  : "var(--bg-subtle)",
                color: earned ? def.badgeColor : "var(--fg-muted)",
                border: `1px solid ${earned
                  ? `color-mix(in srgb,${def.badgeColor} 20%,transparent)`
                  : "var(--border)"}`,
              }}
            >
              {def.category}
            </span>
            {earned && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  height: "18px",
                  padding: "0 7px",
                  borderRadius: "5px",
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  background: "color-mix(in srgb,var(--accent-emerald) 12%,transparent)",
                  color: "var(--accent-emerald)",
                  border: "1px solid color-mix(in srgb,var(--accent-emerald) 20%,transparent)",
                }}
              >
                ✓ Certified
              </span>
            )}
          </div>
          <div style={{ fontSize: "12px", color: "var(--fg-muted)", lineHeight: 1.5, marginBottom: "10px" }}>
            {def.description}
          </div>

          {/* Progress bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "999px",
                background: "var(--border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: "100%",
                  borderRadius: "999px",
                  background: earned ? def.badgeColor : `color-mix(in srgb,${def.badgeColor} 60%,var(--fg-muted))`,
                  transition: "width 600ms ease",
                }}
              />
            </div>
            <span style={{ fontSize: "11px", color: "var(--fg-muted)", flexShrink: 0, minWidth: "32px", textAlign: "right" }}>
              {progressPct}%
            </span>
          </div>

          {earned && formattedDate && (
            <div style={{ fontSize: "11px", color: "var(--fg-muted)", marginTop: "6px" }}>
              Earned {formattedDate}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <span
          style={{
            fontSize: "12px",
            color: "var(--fg-muted)",
            transition: "transform 200ms ease",
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
            marginTop: "2px",
          }}
        >
          ▼
        </span>
      </div>

      {/* Expanded criteria */}
      {isExpanded && criteria.length > 0 && (
        <div
          style={{
            padding: "0 20px 16px",
            borderTop: "1px solid var(--border)",
            paddingTop: "14px",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--fg-muted)",
              marginBottom: "8px",
            }}
          >
            Requirements
          </div>
          {criteria.map((c, i) => (
            <CriterionRow key={`${c.label}-${i}`} criterion={c} />
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Summary stat card ────────────────────────────────────────────────────────

const StatCard = memo(function StatCard({
  value, label, color,
}: { value: string | number; label: string; color: string }) {
  return (
    <div className="lc-stat-card">
      <div className="lc-stat-val" style={{ color }}>{value}</div>
      <div className="lc-stat-label">{label}</div>
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

function CertificationTracker({
  progress,
  modules,
  quizzes,
  earnedCertifications = [],
  onBack,
  onCertificationEarned,
}: CertificationTrackerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());
  const [filterEarned, setFilterEarned] = useState<"all" | "earned" | "inProgress">("all");

  // ── Evaluate every certification definition against current progress ──────
  const evaluated = useMemo(
    () =>
      CERTIFICATION_DEFINITIONS.map((def) =>
        evaluateCertification(def, progress, modules, quizzes, earnedCertifications)
      ),
    [progress, modules, quizzes, earnedCertifications]
  );

  // ── Notify parent of newly earned certs (once per session) ────────────────
  useEffect(() => {
    evaluated.forEach((cert) => {
      if (cert.earned && !notifiedIds.has(cert.definition.id)) {
        const wasAlreadyInDB = earnedCertifications.some((c) => c.id === cert.definition.id);
        if (!wasAlreadyInDB && onCertificationEarned) {
          onCertificationEarned(cert.definition.id);
        }
        setNotifiedIds((prev) => new Set([...prev, cert.definition.id]));
      }
    });
  }, [evaluated, earnedCertifications, notifiedIds, onCertificationEarned]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const earnedCount = useMemo(() => evaluated.filter((c) => c.earned).length, [evaluated]);

  const moduleCompletionRate = useMemo(() => {
    if (modules.length === 0) return 0;
    return Math.round(
      (progress.completedModules.filter((id: string) => modules.some((m) => m.id === id)).length /
        modules.length) *
        100
    );
  }, [modules, progress.completedModules]);

  const avgQuizScore = useMemo(() => {
    const scores = Object.values(progress.quizScores) as number[];
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [progress.quizScores]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filterEarned === "earned") return evaluated.filter((c) => c.earned);
    if (filterEarned === "inProgress") return evaluated.filter((c) => !c.earned);
    return evaluated;
  }, [evaluated, filterEarned]);

  return (
    <div className="lc-root">
      {/* Header ──────────────────────────────────────────────────────────── */}
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">Certification Tracker</div>
          <div className="lc-section-sub">
            Real-time progress toward professional QA certifications
          </div>
        </div>
        <button className="lc-tab-btn" onClick={onBack}>
          ← Back
        </button>
      </div>

      {/* Newly earned banner ────────────────────────────────────────────── */}
      {earnedCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 18px",
            background:
              "linear-gradient(135deg,color-mix(in srgb,var(--accent-amber) 8%,var(--bg-elevated)),color-mix(in srgb,var(--accent-emerald) 5%,var(--bg-elevated)))",
            border:
              "1px solid color-mix(in srgb,var(--accent-amber) 20%,transparent)",
            borderRadius: "12px",
            marginBottom: "20px",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--fg-default)",
          }}
        >
          <span style={{ fontSize: "20px" }}>🏅</span>
          <span>
            You hold{" "}
            <span style={{ color: "var(--accent-amber)" }}>
              {earnedCount} certification{earnedCount > 1 ? "s" : ""}
            </span>{" "}
            — keep learning to unlock more!
          </span>
        </div>
      )}

      {/* Stats grid ─────────────────────────────────────────────────────── */}
      <div className="lc-analytics-grid" style={{ marginBottom: "24px" }}>
        <StatCard
          value={`${earnedCount} / ${CERTIFICATION_DEFINITIONS.length}`}
          label="Certifications"
          color="var(--accent-violet)"
        />
        <StatCard
          value={`${moduleCompletionRate}%`}
          label="Module Progress"
          color="var(--accent-blue)"
        />
        <StatCard
          value={avgQuizScore > 0 ? `${avgQuizScore}%` : "—"}
          label="Avg. Quiz Score"
          color="var(--accent-emerald)"
        />
        <StatCard
          value={progress.badges.length}
          label="Badges Earned"
          color="var(--accent-amber)"
        />
      </div>

      {/* Filter pills ────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {(
          [
            { key: "all", label: "All" },
            { key: "earned", label: `Earned (${earnedCount})` },
            { key: "inProgress", label: `In Progress (${evaluated.length - earnedCount})` },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            className={`lc-tab-btn${filterEarned === key ? " active" : ""}`}
            onClick={() => setFilterEarned(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Cert cards ──────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "var(--fg-muted)",
            fontSize: "13px",
          }}
        >
          {filterEarned === "earned"
            ? "No certifications earned yet — keep learning!"
            : "All certifications have been earned. 🎉"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map((cert) => (
            <CertCard
              key={cert.definition.id}
              cert={cert}
              isExpanded={expandedId === cert.definition.id}
              onToggle={() => handleToggle(cert.definition.id)}
            />
          ))}
        </div>
      )}

      {/* Badges section ──────────────────────────────────────────────────── */}
      {progress.badges.length > 0 && (
        <div style={{ marginTop: "32px" }}>
          <div className="lc-section-header">
            <div>
              <div className="lc-section-title">Achievement Badges</div>
              <div className="lc-section-sub">Earned through key milestones and one-time actions</div>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {progress.badges.map((badge: string) => (
              <div
                key={badge}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "32px",
                  padding: "0 12px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 600,
                  border:
                    "1px solid color-mix(in srgb,var(--accent-amber) 25%,transparent)",
                  background:
                    "color-mix(in srgb,var(--accent-amber) 8%,transparent)",
                  color: "var(--accent-amber)",
                }}
              >
                🏅 {badge}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(CertificationTracker);
