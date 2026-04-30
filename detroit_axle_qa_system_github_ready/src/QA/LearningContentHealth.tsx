import { memo, useMemo, useState, useCallback } from "react";
import type {
  AuditLink,
  BestPractice,
  CoachingNote,
  ContentAuditEntry,
  DefectExample,
  LearningAssignment,
  LearningModule,
  OnboardingTrack,
  QualityStandard,
  Quiz,
  SOPDocument,
  TeamMember,
  WorkInstruction,
} from "./learningService";
import type { LCTab } from "./LearningCenter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LearningContentHealthProps {
  modules: LearningModule[];
  sops: SOPDocument[];
  workInstructions: WorkInstruction[];
  defects: DefectExample[];
  standards: QualityStandard[];
  onboardingTracks: OnboardingTrack[];
  quizzes: Quiz[];
  bestPractices: BestPractice[];
  teamData: TeamMember[];
  coachingNotes: CoachingNote[];
  assignments: LearningAssignment[];
  auditLinks: AuditLink[];
  auditTrail: ContentAuditEntry[];
  onOpenTab: (tab: LCTab) => void;
  onPreviewRole: (role: "agent" | "supervisor" | "qa" | "admin") => void;
}

type IssueSeverity = "good" | "warning" | "danger" | "info";

interface HealthIssue {
  id: string;
  title: string;
  detail: string;
  severity: IssueSeverity;
  tab: LCTab;
  count?: number;
}

interface ContentItem {
  id: string;
  title: string;
  type: string;
  status: string;
  tab: LCTab;
  missingAudience: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusOf(item: { status?: string }): string {
  return item.status ?? "published";
}

function audienceMissing(item: {
  audienceRoles?: readonly string[];
  roles?: readonly string[];
}): boolean {
  const audience = item.audienceRoles ?? item.roles;
  return !audience || audience.length === 0;
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function actionIcon(action: string): string {
  const map: Record<string, string> = {
    created: "✦",
    updated: "↻",
    deleted: "✕",
    published: "▲",
    drafted: "○",
    archived: "□",
  };
  return map[action] ?? "·";
}

function actionColor(action: string): string {
  const map: Record<string, string> = {
    created: "var(--accent-emerald)",
    updated: "var(--accent-blue)",
    deleted: "var(--accent-rose)",
    published: "var(--accent-violet)",
    drafted: "var(--accent-amber)",
    archived: "var(--fg-muted)",
  };
  return map[action] ?? "var(--fg-muted)";
}

function severityConfig(severity: IssueSeverity) {
  return {
    good:    { color: "var(--accent-emerald)", bg: "color-mix(in srgb,var(--accent-emerald) 8%,transparent)",  border: "color-mix(in srgb,var(--accent-emerald) 18%,transparent)", icon: "✓", label: "All Good"  },
    warning: { color: "var(--accent-amber)",   bg: "color-mix(in srgb,var(--accent-amber) 8%,transparent)",    border: "color-mix(in srgb,var(--accent-amber) 18%,transparent)",   icon: "!", label: "Warning"  },
    danger:  { color: "var(--accent-rose)",    bg: "color-mix(in srgb,var(--accent-rose) 8%,transparent)",     border: "color-mix(in srgb,var(--accent-rose) 18%,transparent)",    icon: "✕", label: "Blocking" },
    info:    { color: "var(--accent-blue)",    bg: "color-mix(in srgb,var(--accent-blue) 8%,transparent)",     border: "color-mix(in srgb,var(--accent-blue) 18%,transparent)",    icon: "i", label: "Info"     },
  }[severity];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Score ring showing a percentage
const ScoreRing = memo(function ScoreRing({
  pct,
  size = 64,
  stroke = 6,
  color,
  label,
  value,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
  label: string;
  value: string | number;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const safePct = Math.max(0, Math.min(pct, 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)" }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${(circ * safePct) / 100} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 800ms cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 800,
            color,
            letterSpacing: "-0.03em",
          }}
        >
          {value}
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
          textAlign: "center",
        }}
      >
        {label}
      </div>
    </div>
  );
});

// Single stat tile
const StatTile = memo(function StatTile({
  label,
  value,
  color,
  icon,
  delta,
  onClick,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: string;
  delta?: { value: string; positive: boolean } | null;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 140ms ease, box-shadow 140ms ease",
      }}
      onMouseEnter={e => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          bottom: -16,
          right: -16,
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: `color-mix(in srgb,${color} 10%,transparent)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ fontSize: 14, marginBottom: 6 }}>{icon}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          color,
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--fg-muted)",
        }}
      >
        {label}
      </div>
      {delta && (
        <div
          style={{
            marginTop: 4,
            fontSize: 10,
            fontWeight: 700,
            color: delta.positive ? "var(--accent-emerald)" : "var(--accent-rose)",
          }}
        >
          {delta.positive ? "▲" : "▼"} {delta.value}
        </div>
      )}
    </div>
  );
});

// Horizontal progress bar
const ProgressBar = memo(function ProgressBar({
  pct,
  color,
  height = 4,
}: {
  pct: number;
  color: string;
  height?: number;
}) {
  return (
    <div
      style={{
        height,
        borderRadius: 999,
        background: "var(--border)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.max(0, Math.min(pct, 100))}%`,
          borderRadius: 999,
          background: color,
          transition: "width 700ms cubic-bezier(0.16,1,0.3,1)",
        }}
      />
    </div>
  );
});

// Issue row in the readiness panel
const IssueRow = memo(function IssueRow({
  issue,
  onClick,
}: {
  issue: HealthIssue;
  onClick: (tab: LCTab) => void;
}) {
  const cfg = severityConfig(issue.severity);
  const isGood = issue.severity === "good";

  return (
    <button
      type="button"
      onClick={() => onClick(issue.tab)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "11px 14px",
        borderRadius: 10,
        border: `1px solid ${cfg.border}`,
        background: cfg.bg,
        color: "var(--fg-default)",
        textAlign: "left",
        width: "100%",
        cursor: "pointer",
        transition: "all 120ms ease",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.filter = "brightness(1.05)";
        (e.currentTarget as HTMLElement).style.transform = "translateX(2px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.filter = "";
        (e.currentTarget as HTMLElement).style.transform = "";
      }}
    >
      {/* Severity icon */}
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: `color-mix(in srgb,${cfg.color} 14%,transparent)`,
          color: cfg.color,
          display: "grid",
          placeItems: "center",
          fontSize: 10,
          fontWeight: 900,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {cfg.icon}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "var(--fg-default)",
            marginBottom: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {issue.title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--fg-muted)",
            lineHeight: 1.5,
          }}
        >
          {issue.detail}
        </div>
      </div>

      {/* Badge + arrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {issue.count !== undefined && issue.count > 1 && (
          <span
            style={{
              height: 18,
              minWidth: 18,
              padding: "0 6px",
              borderRadius: 5,
              background: `color-mix(in srgb,${cfg.color} 14%,transparent)`,
              color: cfg.color,
              fontSize: 10,
              fontWeight: 700,
              display: "grid",
              placeItems: "center",
            }}
          >
            {issue.count}
          </span>
        )}
        {!isGood && (
          <span style={{ fontSize: 10, color: cfg.color, opacity: 0.7 }}>→</span>
        )}
      </div>
    </button>
  );
});

// Content status breakdown bar (published/draft/archived)
const StatusBreakdown = memo(function StatusBreakdown({
  published,
  draft,
  archived,
  total,
}: {
  published: number;
  draft: number;
  archived: number;
  total: number;
}) {
  if (total === 0) return null;
  const pPct = (published / total) * 100;
  const dPct = (draft / total) * 100;
  const aPct = (archived / total) * 100;

  return (
    <div>
      <div
        style={{
          display: "flex",
          height: 8,
          borderRadius: 999,
          overflow: "hidden",
          gap: 1,
        }}
      >
        {pPct > 0 && (
          <div
            style={{
              width: `${pPct}%`,
              background: "var(--accent-emerald)",
              transition: "width 700ms cubic-bezier(0.16,1,0.3,1)",
              borderRadius: "999px 0 0 999px",
            }}
          />
        )}
        {dPct > 0 && (
          <div
            style={{
              width: `${dPct}%`,
              background: "var(--accent-amber)",
              transition: "width 700ms cubic-bezier(0.16,1,0.3,1)",
            }}
          />
        )}
        {aPct > 0 && (
          <div
            style={{
              width: `${aPct}%`,
              background: "var(--fg-muted)",
              transition: "width 700ms cubic-bezier(0.16,1,0.3,1)",
              borderRadius: "0 999px 999px 0",
            }}
          />
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 8,
          fontSize: 11,
          color: "var(--fg-muted)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--accent-emerald)", display: "inline-block" }} />
          {published} published
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--accent-amber)", display: "inline-block" }} />
          {draft} draft
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--fg-muted)", display: "inline-block" }} />
          {archived} archived
        </span>
      </div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default memo(function LearningContentHealth({
  modules,
  sops,
  workInstructions,
  defects,
  standards,
  onboardingTracks,
  quizzes,
  bestPractices,
  teamData,
  coachingNotes,
  assignments,
  auditLinks,
  auditTrail,
  onOpenTab,
  onPreviewRole,
}: LearningContentHealthProps) {

  const [issueFilter, setIssueFilter] = useState<IssueSeverity | "all">("all");
  const [auditExpanded, setAuditExpanded] = useState(false);

  // ── Content inventory ──────────────────────────────────────────────────────

  const allContent = useMemo<ContentItem[]>(
    () => [
      ...modules.map(item => ({ id: item.id, title: item.title, type: "Module",            status: statusOf(item), tab: "modules"           as LCTab, missingAudience: audienceMissing(item) })),
      ...sops.map(item =>    ({ id: item.id, title: item.title, type: "SOP",               status: statusOf(item), tab: "sop"               as LCTab, missingAudience: audienceMissing(item) })),
      ...workInstructions.map(item => ({ id: item.id, title: item.title, type: "Work Instruction", status: statusOf(item), tab: "work-instructions" as LCTab, missingAudience: audienceMissing(item) })),
      ...defects.map(item => ({ id: item.id, title: item.title, type: "Defect",            status: statusOf(item), tab: "defects"           as LCTab, missingAudience: audienceMissing(item) })),
      ...standards.map(item => ({ id: item.id, title: item.name, type: "Quality Standard", status: statusOf(item), tab: "standards"         as LCTab, missingAudience: audienceMissing(item) })),
      ...onboardingTracks.map(item => ({ id: item.id, title: item.label, type: "Onboarding", status: statusOf(item), tab: "onboarding"       as LCTab, missingAudience: audienceMissing(item) })),
      ...bestPractices.map(item => ({ id: item.id, title: item.title, type: "Best Practice", status: statusOf(item), tab: "best-practices"  as LCTab, missingAudience: audienceMissing(item) })),
      ...quizzes.map(item =>  ({ id: item.id, title: item.title, type: "Quiz",              status: item.status ?? "published",             tab: "quizzes" as LCTab, missingAudience: audienceMissing(item) })),
    ],
    [modules, sops, workInstructions, defects, standards, onboardingTracks, bestPractices, quizzes]
  );

  // ── Issues (grouped by type, with counts) ─────────────────────────────────

  const issues = useMemo<HealthIssue[]>(() => {
    const list: HealthIssue[] = [];

    // Modules missing a quiz
    const modulesNoQuiz = modules.filter(m => !quizzes.some(q => q.moduleId === m.id));
    if (modulesNoQuiz.length > 0) {
      list.push({
        id: "modules-no-quiz",
        title: `${modulesNoQuiz.length} module${modulesNoQuiz.length > 1 ? "s" : ""} missing a quiz`,
        detail: modulesNoQuiz.slice(0, 2).map(m => m.title).join(", ") + (modulesNoQuiz.length > 2 ? ` +${modulesNoQuiz.length - 2} more` : ""),
        severity: "warning",
        tab: "modules",
        count: modulesNoQuiz.length,
      });
    }

    // Empty quizzes
    const emptyQuizzes = quizzes.filter(q => q.questions.length === 0);
    if (emptyQuizzes.length > 0) {
      list.push({
        id: "quiz-empty",
        title: `${emptyQuizzes.length} quiz${emptyQuizzes.length > 1 ? "zes" : ""} with no questions`,
        detail: "These quizzes should remain drafted until questions are added.",
        severity: "danger",
        tab: "quizzes",
        count: emptyQuizzes.length,
      });
    }

    // SOPs without version history
    const sopNoHistory = sops.filter(s => s.changeLog.length === 0);
    if (sopNoHistory.length > 0) {
      list.push({
        id: "sop-no-history",
        title: `${sopNoHistory.length} SOP${sopNoHistory.length > 1 ? "s" : ""} missing version history`,
        detail: "Add at least one change log entry to track document evolution.",
        severity: "warning",
        tab: "sop",
        count: sopNoHistory.length,
      });
    }

    // Work instructions with no steps
    const wiNoSteps = workInstructions.filter(w => w.steps.length === 0);
    if (wiNoSteps.length > 0) {
      list.push({
        id: "wi-no-steps",
        title: `${wiNoSteps.length} work instruction${wiNoSteps.length > 1 ? "s" : ""} with no steps`,
        detail: "Empty instructions should be drafted or removed.",
        severity: "danger",
        tab: "work-instructions",
        count: wiNoSteps.length,
      });
    }

    // Content missing role visibility
    const missingAudienceItems = allContent.filter(i => i.missingAudience);
    if (missingAudienceItems.length > 0) {
      list.push({
        id: "missing-audience",
        title: `${missingAudienceItems.length} item${missingAudienceItems.length > 1 ? "s" : ""} with no role visibility`,
        detail: missingAudienceItems.slice(0, 3).map(i => `${i.type}: ${i.title}`).join("; ") + (missingAudienceItems.length > 3 ? ` +${missingAudienceItems.length - 3} more` : ""),
        severity: "warning",
        tab: "health",
        count: missingAudienceItems.length,
      });
    }

    // Overdue assignments
    const today = new Date().toISOString().split("T")[0];
    const overdueAssignments = assignments.filter(a =>
      a.dueDate &&
      !["completed", "verified", "cancelled"].includes(a.status ?? "assigned") &&
      a.dueDate < today
    );
    if (overdueAssignments.length > 0) {
      list.push({
        id: "overdue-assignments",
        title: `${overdueAssignments.length} overdue assignment${overdueAssignments.length > 1 ? "s" : ""}`,
        detail: `${overdueAssignments.length} assignment${overdueAssignments.length > 1 ? "s need" : " needs"} immediate attention.`,
        severity: "danger",
        tab: "coaching",
        count: overdueAssignments.length,
      });
    }

    // Broken audit links
    const brokenAuditLinks = auditLinks.filter(l => !modules.some(m => m.id === l.moduleId));
    if (brokenAuditLinks.length > 0) {
      list.push({
        id: "broken-audit-links",
        title: `${brokenAuditLinks.length} audit finding${brokenAuditLinks.length > 1 ? "s" : ""} pointing to missing modules`,
        detail: brokenAuditLinks.map(l => l.metric).join(", "),
        severity: "warning",
        tab: "audit-findings",
        count: brokenAuditLinks.length,
      });
    }

    if (list.length === 0) {
      list.push({
        id: "all-clear",
        title: "All content checks passed",
        detail: "No blocking issues or warnings detected. Your learning center is in great shape.",
        severity: "good",
        tab: "home",
      });
    }

    return list;
  }, [allContent, assignments, auditLinks, modules, quizzes, sops, workInstructions]);

  // ── Derived counts ─────────────────────────────────────────────────────────

  const draftCount      = allContent.filter(i => i.status === "draft").length;
  const publishedCount  = allContent.filter(i => i.status === "published").length;
  const archivedCount   = allContent.filter(i => i.status === "archived").length;
  const totalContent    = allContent.length;
  const dangerCount     = issues.filter(i => i.severity === "danger").length;
  const warningCount    = issues.filter(i => i.severity === "warning").length;
  const healthScore     = totalContent > 0
    ? Math.max(0, Math.round(100 - (dangerCount * 15) - (warningCount * 5)))
    : 100;

  const readyToVerify   = assignments.filter(a => a.status === "completed").length;
  const verifiedCount   = assignments.filter(a => a.status === "verified").length;
  const openAssignments = assignments.filter(a => !["completed","verified","cancelled"].includes(a.status ?? "assigned")).length;

  const publishedPct    = totalContent > 0 ? Math.round((publishedCount / totalContent) * 100) : 0;
  const quizCoverage    = modules.length > 0 ? Math.round((quizzes.filter(q => modules.some(m => m.id === q.moduleId)).length / modules.length) * 100) : 0;
  const coachingActivity = Math.min(100, coachingNotes.length * 10);

  // ── Filter + sorted issues ─────────────────────────────────────────────────

  const filteredIssues = useMemo(() =>
    issueFilter === "all" ? issues : issues.filter(i => i.severity === issueFilter),
    [issues, issueFilter]
  );

  const handleOpenTab = useCallback((tab: LCTab) => {
    onOpenTab(tab);
  }, [onOpenTab]);

  // ── Health score color ─────────────────────────────────────────────────────
  const healthColor = healthScore >= 90
    ? "var(--accent-emerald)"
    : healthScore >= 70
    ? "var(--accent-amber)"
    : "var(--accent-rose)";

  const healthLabel = healthScore >= 90 ? "Excellent" : healthScore >= 70 ? "Needs Attention" : "Critical";

  // ── Audit trail to show ────────────────────────────────────────────────────
  const auditToShow = auditExpanded ? auditTrail.slice(0, 20) : auditTrail.slice(0, 5);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--fg-default)", marginBottom: 3 }}>
            Content Health
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>
            Readiness checks, publishing quality, and version activity
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["agent", "supervisor", "qa", "admin"] as const).map(role => (
            <button
              key={role}
              onClick={() => onPreviewRole(role)}
              style={{
                height: 30,
                padding: "0 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                color: "var(--fg-muted)",
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "all 120ms ease",
                textTransform: "capitalize",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--fg-default)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-strong)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--fg-muted)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              Preview: {role}
            </button>
          ))}
        </div>
      </div>

      {/* ── Health Score Hero ────────────────────────────────────────────── */}
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle background accent */}
        <div
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: `radial-gradient(circle,color-mix(in srgb,${healthColor} 10%,transparent),transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* Score ring */}
        <div style={{ position: "relative" }}>
          <ScoreRing
            pct={healthScore}
            size={80}
            stroke={7}
            color={healthColor}
            label={healthLabel}
            value={`${healthScore}`}
          />
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 60, background: "var(--border)", flexShrink: 0 }} />

        {/* Three key rings */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <ScoreRing pct={publishedPct}    size={56} stroke={5} color="var(--accent-blue)"    label="Published"      value={`${publishedPct}%`} />
          <ScoreRing pct={quizCoverage}    size={56} stroke={5} color="var(--accent-violet)"  label="Quiz Coverage"  value={`${quizCoverage}%`} />
          <ScoreRing pct={coachingActivity} size={56} stroke={5} color="var(--accent-cyan)"   label="Coaching"       value={coachingNotes.length.toString()} />
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 60, background: "var(--border)", flexShrink: 0 }} />

        {/* Issue summary */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", marginBottom: 10, fontWeight: 600 }}>
            Open Issues
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                background: "color-mix(in srgb,var(--accent-rose) 8%,transparent)",
                border: "1px solid color-mix(in srgb,var(--accent-rose) 18%,transparent)",
                cursor: dangerCount > 0 ? "pointer" : "default",
              }}
              onClick={() => dangerCount > 0 && setIssueFilter("danger")}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-rose)", letterSpacing: "-0.03em", lineHeight: 1 }}>{dangerCount}</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent-rose)", marginTop: 2 }}>Blocking</div>
            </div>
            <div
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: 10,
                background: "color-mix(in srgb,var(--accent-amber) 8%,transparent)",
                border: "1px solid color-mix(in srgb,var(--accent-amber) 18%,transparent)",
                cursor: warningCount > 0 ? "pointer" : "default",
              }}
              onClick={() => warningCount > 0 && setIssueFilter("warning")}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-amber)", letterSpacing: "-0.03em", lineHeight: 1 }}>{warningCount}</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--accent-amber)", marginTop: 2 }}>Warnings</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 10,
        }}
      >
        <StatTile label="Total Content"    value={totalContent}    color="var(--accent-violet)" icon="📦" onClick={() => onOpenTab("modules")} />
        <StatTile label="Published"        value={publishedCount}  color="var(--accent-emerald)" icon="✓" onClick={() => onOpenTab("modules")} />
        <StatTile label="Drafts"           value={draftCount}      color="var(--accent-amber)"  icon="○" />
        <StatTile label="Archived"         value={archivedCount}   color="var(--fg-muted)"      icon="□" />
        <StatTile label="Assignments"      value={assignments.length} color="var(--accent-blue)" icon="📋" onClick={() => onOpenTab("coaching")} />
        <StatTile label="Open"             value={openAssignments} color="var(--accent-cyan)"   icon="⏳" onClick={() => onOpenTab("coaching")} />
        <StatTile label="Ready to Verify"  value={readyToVerify}   color="var(--accent-amber)"  icon="👁" onClick={() => onOpenTab("coaching")} />
        <StatTile label="Verified"         value={verifiedCount}   color="var(--accent-violet)" icon="🏅" onClick={() => onOpenTab("coaching")} />
        <StatTile label="Team Members"     value={teamData.length} color="var(--accent-blue)"   icon="👥" onClick={() => onOpenTab("coaching")} />
        <StatTile label="Coaching Notes"   value={coachingNotes.length} color="var(--accent-rose)" icon="📝" onClick={() => onOpenTab("coaching")} />
      </div>

      {/* ── Content Status Breakdown ─────────────────────────────────────── */}
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "18px 20px",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--fg-default)", marginBottom: 14 }}>
          Content Status Breakdown
        </div>
        <StatusBreakdown
          published={publishedCount}
          draft={draftCount}
          archived={archivedCount}
          total={totalContent}
        />

        {/* Per-type breakdown */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 10,
            marginTop: 16,
          }}
        >
          {[
            { label: "Modules",          items: modules,          tab: "modules"           as LCTab, color: "var(--accent-violet)" },
            { label: "SOPs",             items: sops,             tab: "sop"               as LCTab, color: "var(--accent-emerald)" },
            { label: "Work Instructions",items: workInstructions, tab: "work-instructions" as LCTab, color: "var(--accent-blue)" },
            { label: "Defects",          items: defects,          tab: "defects"           as LCTab, color: "var(--accent-rose)" },
            { label: "Quizzes",          items: quizzes,          tab: "quizzes"           as LCTab, color: "var(--accent-cyan)" },
            { label: "Best Practices",   items: bestPractices,    tab: "best-practices"    as LCTab, color: "var(--accent-amber)" },
          ].map(({ label, items, tab, color }) => {
            const pub  = items.filter(i => statusOf(i) === "published").length;
            const drft = items.filter(i => statusOf(i) === "draft").length;
            const pct  = items.length > 0 ? Math.round((pub / items.length) * 100) : 0;
            return (
              <div
                key={label}
                onClick={() => onOpenTab(tab)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--bg-subtle)",
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = color;
                  (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb,${color} 5%,var(--bg-subtle))`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-subtle)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-default)" }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
                </div>
                <ProgressBar pct={pct} color={color} height={3} />
                <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 5 }}>
                  {pub} published{drft > 0 ? ` · ${drft} draft` : ""}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Bottom Grid: Issues + Audit Trail ───────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(260px, 0.6fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* ─ Readiness Checks ─ */}
        <section
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "18px 20px",
          }}
        >
          {/* Header with filter tabs */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--fg-default)" }}>
              Readiness Checks
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {(["all", "danger", "warning", "good"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setIssueFilter(f)}
                  style={{
                    height: 24,
                    padding: "0 9px",
                    borderRadius: 6,
                    border: "1px solid transparent",
                    background: issueFilter === f
                      ? f === "all" ? "var(--bg-subtle-hover)" : `color-mix(in srgb,${severityConfig(f === "good" ? "good" : f).color} 10%,transparent)`
                      : "transparent",
                    borderColor: issueFilter === f
                      ? f === "all" ? "var(--border-strong)" : `color-mix(in srgb,${severityConfig(f === "good" ? "good" : f).color} 22%,transparent)`
                      : "transparent",
                    color: issueFilter === f
                      ? f === "all" ? "var(--fg-default)" : severityConfig(f === "good" ? "good" : f).color
                      : "var(--fg-muted)",
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    transition: "all 100ms ease",
                  }}
                >
                  {f === "all" ? `All (${issues.length})` : f === "good" ? "Good" : f === "danger" ? `Blocking (${dangerCount})` : `Warn (${warningCount})`}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {filteredIssues.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--fg-muted)", fontSize: 12, border: "1px dashed var(--border)", borderRadius: 10 }}>
                No issues in this category.
              </div>
            ) : (
              filteredIssues.map(issue => (
                <IssueRow key={issue.id} issue={issue} onClick={handleOpenTab} />
              ))
            )}
          </div>
        </section>

        {/* ─ Audit Trail ─ */}
        <section
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "18px 20px",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--fg-default)", marginBottom: 14 }}>
            Recent Activity
          </div>

          {auditTrail.length === 0 ? (
            <div
              style={{
                padding: "20px 16px",
                textAlign: "center",
                border: "1px dashed var(--border)",
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 8, opacity: 0.4 }}>📋</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-default)", marginBottom: 4 }}>
                No activity yet
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.6 }}>
                Content saves will appear here once the audit table is connected.
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {auditToShow.map((entry, i) => {
                  const color = actionColor(entry.action);
                  const icon  = actionIcon(entry.action);
                  const isLast = i === auditToShow.length - 1;
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        gap: 10,
                        paddingBottom: isLast ? 0 : 12,
                        marginBottom: isLast ? 0 : 0,
                        position: "relative",
                      }}
                    >
                      {/* Timeline line */}
                      {!isLast && (
                        <div
                          style={{
                            position: "absolute",
                            left: 10,
                            top: 20,
                            bottom: 0,
                            width: 1,
                            background: "var(--border)",
                          }}
                        />
                      )}

                      {/* Icon */}
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          background: `color-mix(in srgb,${color} 12%,transparent)`,
                          color,
                          fontSize: 9,
                          fontWeight: 900,
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          marginTop: 1,
                          border: `1px solid color-mix(in srgb,${color} 20%,transparent)`,
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        {icon}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--fg-default)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {entry.title}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 2, display: "flex", gap: 5, flexWrap: "wrap" }}>
                          <span
                            style={{
                              color,
                              fontWeight: 700,
                              textTransform: "capitalize",
                            }}
                          >
                            {entry.action}
                          </span>
                          <span>·</span>
                          <span>{entry.contentType}</span>
                          <span>·</span>
                          <span>{timeAgo(entry.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {auditTrail.length > 5 && (
                <button
                  onClick={() => setAuditExpanded(e => !e)}
                  style={{
                    marginTop: 14,
                    width: "100%",
                    height: 30,
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-subtle)",
                    color: "var(--fg-muted)",
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "all 120ms ease",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.color = "var(--fg-default)";
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-subtle-hover)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.color = "var(--fg-muted)";
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-subtle)";
                  }}
                >
                  {auditExpanded ? "Show less" : `Show ${auditTrail.length - 5} more`}
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
});
