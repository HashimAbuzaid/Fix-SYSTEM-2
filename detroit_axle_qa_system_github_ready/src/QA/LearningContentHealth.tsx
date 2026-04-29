import { memo, useMemo } from "react";
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

interface HealthIssue {
  id: string;
  title: string;
  detail: string;
  severity: "good" | "warning" | "danger";
  tab: LCTab;
}

function statusOf(item: { status?: string }): string {
  return item.status ?? "published";
}

function audienceMissing(item: { audienceRoles?: readonly string[]; roles?: readonly string[] }): boolean {
  const audience = item.audienceRoles ?? item.roles;
  return !audience || audience.length === 0;
}

function issueColor(severity: HealthIssue["severity"]): string {
  if (severity === "danger") return "var(--accent-rose)";
  if (severity === "warning") return "var(--accent-amber)";
  return "var(--accent-emerald)";
}

const HealthStat = memo(function HealthStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="lc-stat-card">
      <div className="lc-stat-val" style={{ color }}>{value}</div>
      <div className="lc-stat-label">{label}</div>
    </div>
  );
});

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
  const allContent = useMemo(
    () => [
      ...modules.map((item) => ({ id: item.id, title: item.title, type: "Module", status: statusOf(item), tab: "modules" as LCTab, missingAudience: audienceMissing(item) })),
      ...sops.map((item) => ({ id: item.id, title: item.title, type: "SOP", status: statusOf(item), tab: "sop" as LCTab, missingAudience: audienceMissing(item) })),
      ...workInstructions.map((item) => ({ id: item.id, title: item.title, type: "Work Instruction", status: statusOf(item), tab: "work-instructions" as LCTab, missingAudience: audienceMissing(item) })),
      ...defects.map((item) => ({ id: item.id, title: item.title, type: "Defect", status: statusOf(item), tab: "defects" as LCTab, missingAudience: audienceMissing(item) })),
      ...standards.map((item) => ({ id: item.id, title: item.name, type: "Quality Standard", status: statusOf(item), tab: "standards" as LCTab, missingAudience: audienceMissing(item) })),
      ...onboardingTracks.map((item) => ({ id: item.id, title: item.label, type: "Onboarding", status: statusOf(item), tab: "onboarding" as LCTab, missingAudience: audienceMissing(item) })),
      ...bestPractices.map((item) => ({ id: item.id, title: item.title, type: "Best Practice", status: statusOf(item), tab: "best-practices" as LCTab, missingAudience: audienceMissing(item) })),
      ...quizzes.map((item) => ({ id: item.id, title: item.title, type: "Quiz", status: item.status ?? "published", tab: "quizzes" as LCTab, missingAudience: audienceMissing(item) })),
    ],
    [modules, sops, workInstructions, defects, standards, onboardingTracks, bestPractices, quizzes]
  );

  const issues = useMemo<HealthIssue[]>(() => {
    const list: HealthIssue[] = [];
    modules.filter((module) => !quizzes.some((quiz) => quiz.moduleId === module.id)).forEach((module) => {
      list.push({ id: `module-no-quiz-${module.id}`, title: module.title, detail: "Training module has no linked quiz.", severity: "warning", tab: "modules" });
    });
    quizzes.filter((quiz) => quiz.questions.length === 0).forEach((quiz) => {
      list.push({ id: `quiz-empty-${quiz.id}`, title: quiz.title, detail: "Quiz has no questions and should stay drafted until complete.", severity: "danger", tab: "quizzes" });
    });
    sops.filter((sop) => sop.changeLog.length === 0).forEach((sop) => {
      list.push({ id: `sop-no-history-${sop.id}`, title: sop.title, detail: "SOP has no version history entry.", severity: "warning", tab: "sop" });
    });
    workInstructions.filter((instruction) => instruction.steps.length === 0).forEach((instruction) => {
      list.push({ id: `wi-no-steps-${instruction.id}`, title: instruction.title, detail: "Work instruction has no steps.", severity: "danger", tab: "work-instructions" });
    });
    allContent.filter((item) => item.missingAudience).forEach((item) => {
      list.push({ id: `audience-${item.type}-${item.id}`, title: item.title, detail: `${item.type} has no role visibility set.`, severity: "warning", tab: item.tab });
    });
    assignments.filter((assignment) => assignment.dueDate && !["completed", "verified", "cancelled"].includes(assignment.status ?? "assigned") && assignment.dueDate < new Date().toISOString().split("T")[0]).forEach((assignment) => {
      list.push({ id: `assignment-${assignment.id}`, title: assignment.title || assignment.contentId || assignment.moduleId, detail: `Overdue assignment for ${assignment.agentId}.`, severity: "danger", tab: "coaching" });
    });
    auditLinks.filter((link) => !modules.some((module) => module.id === link.moduleId)).forEach((link) => {
      list.push({ id: `audit-link-${link.metric}`, title: link.metric, detail: "Audit finding points to a missing training module.", severity: "warning", tab: "audit-findings" });
    });
    if (list.length === 0) {
      list.push({ id: "all-clear", title: "Content health is clean", detail: "No blocking content issues were detected.", severity: "good", tab: "home" });
    }
    return list;
  }, [allContent, assignments, auditLinks, modules, quizzes, sops, workInstructions]);

  const draftCount = allContent.filter((item) => item.status === "draft").length;
  const publishedCount = allContent.filter((item) => item.status === "published").length;
  const archivedCount = allContent.filter((item) => item.status === "archived").length;
  const dangerCount = issues.filter((issue) => issue.severity === "danger").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const readyToVerifyCount = assignments.filter((assignment) => assignment.status === "completed").length;
  const verifiedCount = assignments.filter((assignment) => assignment.status === "verified").length;

  return (
    <div>
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">Content Health</div>
          <div className="lc-section-sub">Preview, readiness checks, publishing quality, and recent version activity</div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {(["agent", "supervisor", "qa", "admin"] as const).map((role) => (
            <button key={role} className="lc-tab-btn" onClick={() => onPreviewRole(role)}>
              Preview as {role}
            </button>
          ))}
        </div>
      </div>

      <div className="lc-analytics-grid">
        <HealthStat label="Published" value={publishedCount} color="var(--accent-emerald)" />
        <HealthStat label="Drafts" value={draftCount} color="var(--accent-amber)" />
        <HealthStat label="Archived" value={archivedCount} color="var(--fg-muted)" />
        <HealthStat label="Warnings" value={warningCount} color="var(--accent-amber)" />
        <HealthStat label="Blocking Issues" value={dangerCount} color="var(--accent-rose)" />
        <HealthStat label="Coaching Notes" value={coachingNotes.length} color="var(--accent-violet)" />
        <HealthStat label="Team Members" value={teamData.length} color="var(--accent-blue)" />
        <HealthStat label="Assignments" value={assignments.length} color="var(--accent-cyan)" />
        <HealthStat label="Ready to Verify" value={readyToVerifyCount} color="var(--accent-emerald)" />
        <HealthStat label="Verified" value={verifiedCount} color="var(--accent-blue)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(280px, 0.65fr)", gap: "16px", alignItems: "start" }}>
        <section style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px" }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--fg-default)", marginBottom: "12px" }}>Readiness checks</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {issues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                onClick={() => onOpenTab(issue.tab)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  border: `1px solid color-mix(in srgb, ${issueColor(issue.severity)} 24%, transparent)`,
                  background: "var(--bg-subtle)",
                  color: "var(--fg-default)",
                  textAlign: "left",
                }}
              >
                <span style={{ color: issueColor(issue.severity), fontWeight: 900 }}>{issue.severity === "good" ? "✓" : issue.severity === "danger" ? "!" : "•"}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontSize: "13px", fontWeight: 700 }}>{issue.title}</span>
                  <span style={{ display: "block", marginTop: "3px", fontSize: "12px", lineHeight: 1.5, color: "var(--fg-muted)" }}>{issue.detail}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px" }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--fg-default)", marginBottom: "12px" }}>Recent version activity</div>
          {auditTrail.length === 0 ? (
            <div style={{ fontSize: "12px", lineHeight: 1.6, color: "var(--fg-muted)" }}>
              No audit activity has been recorded yet. New v5 saves will populate this list when the Supabase audit table is available.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {auditTrail.slice(0, 10).map((entry) => (
                <div key={entry.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--fg-default)" }}>{entry.title}</div>
                  <div style={{ fontSize: "11px", color: "var(--fg-muted)", marginTop: "2px" }}>
                    {entry.action} · {entry.contentType} · {new Date(entry.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
});
