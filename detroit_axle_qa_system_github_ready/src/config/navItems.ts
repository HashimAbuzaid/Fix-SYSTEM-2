// ─────────────────────────────────────────────────────────────
// src/config/navItems.ts
// NavItem type, role/level display constants, and the
// buildNavItems() factory that maps a UserProfile → nav list.
// ─────────────────────────────────────────────────────────────

import type { UserProfile } from "../context/AuthContext";
import {
  ROUTES,
  NAV_GROUPS,
  NAV_SHORTCUTS,
  type RoutePath,
} from "./routes";

// ── Types ─────────────────────────────────────────────────────

export interface NavItem {
  readonly path:     RoutePath;
  readonly label:    string;
  readonly group:    string;
  readonly shortcut?: string;
  readonly badge?:   string;
  readonly isNew?:   boolean;
}

// ── Role → accent color ───────────────────────────────────────

export const ROLE_COLORS: Readonly<Record<string, string>> = {
  admin:      "var(--accent-rose)",
  qa:         "var(--accent-blue)",
  supervisor: "var(--accent-violet)",
  agent:      "var(--accent-emerald)",
};

// ── Gamification level display data ──────────────────────────

export const LEVEL_NAMES = [
  "Rookie", "Learner", "Practitioner",
  "Specialist", "Expert", "Master", "Legend",
];

export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1500, 2500];

export const LEVEL_COLORS = [
  "var(--fg-muted)",
  "var(--accent-blue)",
  "var(--accent-cyan)",
  "var(--accent-violet)",
  "var(--accent-amber)",
  "var(--accent-rose)",
  "#f59e0b",
];

// ── Helpers ───────────────────────────────────────────────────

/** Returns the sidebar group name for a given nav label. */
export function getNavGroup(label: string): string {
  for (const [group, labels] of Object.entries(NAV_GROUPS)) {
    if (labels.includes(label)) return group;
  }
  return "Other";
}

/** Returns the page label for the current pathname, or a fallback. */
export function getActiveRouteLabel(
  pathname: string,
  items: readonly NavItem[],
): string {
  return items.find((i) => i.path === pathname)?.label ?? "Workspace";
}

/** Derives the two-letter avatar initials from a UserProfile. */
export function getUserInitials(profile: UserProfile): string {
  const name = profile.display_name || profile.agent_name || profile.email || "?";
  const parts = name.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Factory ───────────────────────────────────────────────────

/** Builds the role-appropriate nav item list for a given profile. */
export function buildNavItems(profile: UserProfile): NavItem[] {
  const isAdmin      = profile.role === "admin";
  const isStaff      = isAdmin || profile.role === "qa";
  const isSupervisor = profile.role === "supervisor";

  const item = (
    path: RoutePath,
    label: string,
    extra?: Partial<NavItem>,
  ): NavItem => ({
    path,
    label,
    group:    getNavGroup(label),
    shortcut: NAV_SHORTCUTS[label],
    ...extra,
  });

  // ── Supervisor ────────────────────────────────────────────
  if (isSupervisor) {
    return [
      item(ROUTES.supervisorOverview,      "Overview"),
      item(ROUTES.supervisorTeamDashboard, "Team Dashboard"),
      item(ROUTES.supervisorRequestsView,  "Supervisor Requests"),
      item(ROUTES.learningCenter,          "Learning Center", { isNew: true }),
      item(ROUTES.supervisorProfile,       "My Supervisor Profile"),
    ];
  }

  // ── Agent ─────────────────────────────────────────────────
  if (!isStaff) {
    return [
      item(ROUTES.agentPortal,    "My Portal"),
      item(ROUTES.learningCenter, "Learning Center", { isNew: true }),
    ];
  }

  // ── QA / Admin ────────────────────────────────────────────
  const items: NavItem[] = [
    item(ROUTES.dashboard,      "Dashboard"),
    item(ROUTES.newAudit,       "New Audit"),
    item(ROUTES.auditsUpload,   "Audits Upload"),
    item(ROUTES.auditsList,     "Audits List"),
    item(ROUTES.callsUpload,    "Calls Upload"),
    item(ROUTES.ticketsUpload,  "Tickets Upload"),
    item(ROUTES.ticketEvidence, "Ticket Evidence"),
    item(ROUTES.ticketAiReview, "Ticket AI Review"),
    item(ROUTES.salesUpload,    "Sales Upload"),
    item(ROUTES.agentFeedback,  "Agent Feedback"),
    item(ROUTES.monitoring,     "Monitoring"),
    item(ROUTES.teamHeatmap,    "Team Heatmap"),
    item(ROUTES.learningCenter, "Learning Center", { isNew: true }),
  ];

  if (isAdmin) {
    items.push(
      item(ROUTES.accounts,           "Accounts"),
      item(ROUTES.supervisorRequests, "Supervisor Requests"),
      item(ROUTES.supportInbox,       "Support Inbox"),
      item(ROUTES.helpAdmin,          "Help Admin"),
    );
  }

  items.push(
    item(ROUTES.reports, "Reports"),
    item(ROUTES.profile, isAdmin ? "My Admin Profile" : "My QA Profile"),
  );

  return items;
}
