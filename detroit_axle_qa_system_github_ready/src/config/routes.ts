// ─────────────────────────────────────────────────────────────
// src/config/routes.ts
// All route paths, nav groupings, accent colors, and shortcuts.
// Import from here — never hard-code paths elsewhere.
// ─────────────────────────────────────────────────────────────

export const ROUTES = {
  dashboard:               "/",
  agentPortal:             "/agent",
  newAudit:                "/new-audit",
  auditsUpload:            "/audits-upload",
  auditsList:              "/audits-list",
  callsUpload:             "/calls-upload",
  ticketsUpload:           "/tickets-upload",
  ticketEvidence:          "/ticket-evidence",
  ticketAiReview:          "/ticket-ai-review",
  salesUpload:             "/sales-upload",
  agentFeedback:           "/agent-feedback",
  monitoring:              "/monitoring",
  accounts:                "/accounts",
  supervisorRequests:      "/supervisor-requests",
  reports:                 "/reports",
  supportInbox:            "/support-inbox",
  helpAdmin:               "/help-admin",
  teamHeatmap:             "/team-heatmap",
  learningCenter:          "/learning-center",
  profile:                 "/profile",
  supervisorOverview:      "/supervisor",
  supervisorTeamDashboard: "/supervisor/team-dashboard",
  supervisorRequestsView:  "/supervisor/requests",
  supervisorProfile:       "/supervisor/profile",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

// ── Which sidebar group each nav label belongs to ─────────────
export const NAV_GROUPS: Readonly<Record<string, readonly string[]>> = {
  Core:       ["Dashboard", "Overview", "Team Dashboard", "My Portal"],
  Audits:     ["New Audit", "Audits Upload", "Audits List"],
  Data:       ["Calls Upload", "Tickets Upload", "Ticket Evidence", "Ticket AI Review", "Sales Upload"],
  Analytics:  ["Agent Feedback", "Monitoring", "Team Heatmap"],
  Learning:   ["Learning Center"],
  Management: ["Accounts", "Supervisor Requests", "Reports", "Support Inbox", "Help Admin"],
  Account:    ["My Admin Profile", "My QA Profile", "My Supervisor Profile", "Supervisor Requests"],
};

// ── Accent color per group ────────────────────────────────────
export const GROUP_ACCENT: Readonly<Record<string, string>> = {
  Core:       "var(--accent-blue)",
  Audits:     "var(--accent-violet)",
  Data:       "var(--accent-cyan)",
  Analytics:  "var(--accent-amber)",
  Learning:   "var(--accent-emerald)",
  Management: "var(--accent-rose)",
  Account:    "var(--accent-emerald)",
  Other:      "var(--fg-muted)",
};

// ── Single-key shortcuts shown in the command palette ─────────
export const NAV_SHORTCUTS: Partial<Record<string, string>> = {
  Dashboard:        "D",
  "New Audit":      "N",
  "Audits List":    "L",
  Monitoring:       "M",
  Reports:          "R",
  Accounts:         "A",
  "Learning Center":"E",
  "Support Inbox":  "S",
  "Help Admin":     "H",
  Help:             "?",
};

// ── G + letter quick-nav map (used in AppShell keyboard handler) ──
export const G_NAV_MAP: Record<string, RoutePath> = {
  d: ROUTES.dashboard,
  n: ROUTES.newAudit,
  r: ROUTES.reports,
  e: ROUTES.learningCenter,
  m: ROUTES.monitoring,
  a: ROUTES.auditsList,
};

// ── Labels shown in the mobile bottom tab bar (priority order) ─
export const BOTTOM_NAV_LABELS = [
  "Dashboard",
  "My Portal",
  "Overview",
  "Learning Center",
  "Monitoring",
  "Reports",
];
