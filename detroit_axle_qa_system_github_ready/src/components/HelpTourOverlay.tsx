import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { recordHelpEvent } from "../lib/helpSystemApi";

interface TourStep {
  readonly title: string;
  readonly body: string;
  readonly selectorHint?: string;
}

interface HelpTourOverlayProps {
  readonly tourId: string | null;
  readonly currentPage?: string;
  readonly currentRole?: string;
  readonly onClose: () => void;
  readonly onOpenHelp?: () => void;
}

const TOUR_LIBRARY: Record<string, readonly TourStep[]> = {
  dashboard: [
    {
      title: "Start with the KPI cards",
      body: "Review the top cards first. They summarize quality health before you drill into filters, agents, or teams.",
      selectorHint: "Top summary cards",
    },
    {
      title: "Read trends over snapshots",
      body: "Use movement over time to separate a one-off audit result from a recurring coaching or process pattern.",
      selectorHint: "Trend sections",
    },
    {
      title: "Recognize wins",
      body: "Recognition and trophy areas help managers identify standout performance and reinforce positive behavior.",
      selectorHint: "Recognition area",
    },
  ],
  newAudit: [
    {
      title: "Confirm agent and team",
      body: "Start every audit by checking the agent, team, channel, and interaction context before scoring.",
      selectorHint: "Agent/team selectors",
    },
    {
      title: "Score each metric deliberately",
      body: "Metrics drive the calculated score. Use evidence and notes so feedback stays clear and defensible.",
      selectorHint: "Metric scoring area",
    },
    {
      title: "Review before saving",
      body: "Check calculated score, visibility, and notes before the audit becomes part of reporting.",
      selectorHint: "Save/review actions",
    },
  ],
  reports: [
    {
      title: "Set the right filters",
      body: "Date ranges, teams, agents, and channels control which audits are included in every chart and export.",
      selectorHint: "Report filters",
    },
    {
      title: "Compare multiple agents carefully",
      body: "Multi-agent filters are useful for coaching and trend review, but the selected population should be clear before sharing.",
      selectorHint: "Agent filters",
    },
    {
      title: "Export what you see",
      body: "Exports should match the active filters. Re-check criteria before using a file in a meeting.",
      selectorHint: "Export controls",
    },
  ],
  auditsList: [
    {
      title: "Filter the audit list",
      body: "Use filters to find audits by date range, channel, team, agent, score, or release state.",
      selectorHint: "Audit list filters",
    },
    {
      title: "Review hidden and shared states",
      body: "Visibility controls decide whether an audit is ready for shared views or should remain internal.",
      selectorHint: "Visibility controls",
    },
    {
      title: "Check release actions",
      body: "Review notes, score, and context before changing release status or sharing audit results.",
      selectorHint: "Release controls",
    },
  ],
  supervisor: [
    {
      title: "Review team-level signals",
      body: "Begin with team-level quality signals before drilling into one agent or one interaction.",
      selectorHint: "Team summary",
    },
    {
      title: "Prioritize coaching items",
      body: "Use repeated metric misses and request context to decide what needs follow-up first.",
      selectorHint: "Coaching and requests",
    },
    {
      title: "Use trends for fair coaching",
      body: "Compare performance over time so coaching is based on patterns, not only single audits.",
      selectorHint: "Trend cards",
    },
  ],
  general: [
    {
      title: "Use the sidebar for workflows",
      body: "Move between audits, uploads, analytics, reports, and management pages without losing your session.",
      selectorHint: "Sidebar",
    },
    {
      title: "Use Help without leaving the page",
      body: "The Help Center overlays the current view and keeps your place while you look up guidance.",
      selectorHint: "Help drawer",
    },
    {
      title: "Use Search for fast navigation",
      body: "The command palette and Help search can get you to the right page or article quickly.",
      selectorHint: "Search controls",
    },
  ],
};

const cardStyle: CSSProperties = {
  width: "min(440px, calc(100vw - 32px))",
  borderRadius: "18px",
  border: "1px solid var(--border-strong)",
  background: "linear-gradient(180deg, var(--bg-elevated), var(--bg-overlay))",
  boxShadow: "var(--shadow-lg)",
  padding: "18px",
};

function resolveTourSteps(tourId: string | null, currentPage?: string): readonly TourStep[] {
  if (tourId && TOUR_LIBRARY[tourId]) return TOUR_LIBRARY[tourId];
  const page = (currentPage || "").toLowerCase();
  if (page.includes("dashboard")) return TOUR_LIBRARY.dashboard;
  if (page.includes("new audit")) return TOUR_LIBRARY.newAudit;
  if (page.includes("report")) return TOUR_LIBRARY.reports;
  if (page.includes("audits list")) return TOUR_LIBRARY.auditsList;
  if (page.includes("supervisor") || page.includes("team dashboard")) return TOUR_LIBRARY.supervisor;
  return TOUR_LIBRARY.general;
}

const HelpTourOverlay = memo(function HelpTourOverlay({
  tourId,
  currentPage,
  currentRole,
  onClose,
  onOpenHelp,
}: HelpTourOverlayProps) {
  const steps = useMemo(() => resolveTourSteps(tourId, currentPage), [tourId, currentPage]);
  const [stepIndex, setStepIndex] = useState(0);
  const open = Boolean(tourId);
  const step = steps[stepIndex] || steps[0];

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    recordHelpEvent({
      event_name: "tour_started",
      current_page: currentPage,
      user_role: currentRole,
      target: tourId || "general",
    });
  }, [currentPage, currentRole, open, tourId]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setStepIndex((value) => Math.min(value + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setStepIndex((value) => Math.max(value - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, open, steps.length]);

  if (!open || !step) return null;

  const isLast = stepIndex === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guided page tour"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 180,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "24px",
        background: "color-mix(in srgb, var(--bg-base) 35%, rgba(0,0,0,0.52))",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
          <div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--accent-blue)",
                marginBottom: "7px",
              }}
            >
              Tour {stepIndex + 1} of {steps.length}
            </div>
            <h2 style={{ margin: 0, fontSize: "19px", lineHeight: 1.2, color: "var(--fg-default)", letterSpacing: "-0.03em" }}>
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close tour"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "var(--bg-subtle)",
              color: "var(--fg-muted)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <p style={{ margin: "12px 0 0", color: "var(--fg-muted)", fontSize: "13px", lineHeight: 1.6 }}>
          {step.body}
        </p>

        {step.selectorHint && (
          <div
            style={{
              marginTop: "13px",
              padding: "10px 12px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              background: "var(--bg-subtle)",
              color: "var(--fg-muted)",
              fontSize: "12px",
            }}
          >
            Look for: <strong style={{ color: "var(--fg-default)" }}>{step.selectorHint}</strong>
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginTop: "16px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setStepIndex((value) => Math.max(value - 1, 0))}
            disabled={stepIndex === 0}
            style={{
              height: "36px",
              padding: "0 13px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              background: "var(--bg-subtle)",
              color: stepIndex === 0 ? "var(--fg-subtle)" : "var(--fg-default)",
            }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) {
                recordHelpEvent({
                  event_name: "tour_completed",
                  current_page: currentPage,
                  user_role: currentRole,
                  target: tourId || "general",
                });
                onClose();
                return;
              }
              setStepIndex((value) => Math.min(value + 1, steps.length - 1));
            }}
            style={{
              height: "36px",
              padding: "0 14px",
              borderRadius: "10px",
              border: "1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent)",
              background: "color-mix(in srgb, var(--accent-blue) 14%, transparent)",
              color: "var(--fg-default)",
              fontWeight: 700,
            }}
          >
            {isLast ? "Finish" : "Next"}
          </button>
          {onOpenHelp && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenHelp();
              }}
              style={{
                height: "36px",
                marginLeft: "auto",
                padding: "0 12px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--fg-muted)",
              }}
            >
              Open Help
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default HelpTourOverlay;
