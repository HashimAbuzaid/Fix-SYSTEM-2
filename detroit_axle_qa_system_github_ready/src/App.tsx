/**
 * App.tsx — Detroit Axle QA System
 * ──────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE:
 *   • CSS custom-property theming (zero JS re-renders for colour changes)
 *   • Sidebar state driven by a single data attribute on the shell root —
 *     no React state fans out into child tree; CSS does all the layout work.
 *   • All stable callbacks live in module scope or are hoisted with useRef so
 *     memo'd children never see new references.
 *   • LiveClock uses a ref-backed ticker; no parent re-render on tick.
 *   • Command palette (⌘K) for keyboard-first navigation.
 *   • Framer-less spring easing achieved with a hand-tuned cubic-bezier.
 * ──────────────────────────────────────────────────────────────────────────
 */

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { AuthContext } from "./context/AuthContext";
import { useAuthState } from "./hooks/useAuthState";
import {
  applyThemeCssVariables,
  readStoredTheme,
} from "./lib/theme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { ThemeMode } from "./lib/theme";
import type { UserProfile } from "./context/AuthContext";

import Login from "./QA/Login";
import ResetPassword from "./QA/ResetPassword";
import AgentPortal from "./QA/AgentPortal";
import SupervisorPortal from "./QA/SupervisorPortal";
import Dashboard from "./QA/Dashboard";
import NewAuditSupabase from "./QA/NewAuditSupabase";
import AuditsImportSupabase from "./QA/AuditsImportSupabase";
import CallsUploadSupabase from "./QA/CallsUploadSupabase";
import TicketsUploadSupabase from "./QA/TicketsUploadSupabase";
import TicketEvidenceUploadSupabase from "./QA/TicketEvidenceUploadSupabase";
import TicketAIReviewQueueSupabase from "./QA/TicketAIReviewQueueSupabase";
import SalesUploadSupabase from "./QA/SalesUploadSupabase";
import AuditsListSupabase from "./QA/AuditsListSupabase";
import AccountsSupabase from "./QA/AccountsSupabase";
import SupervisorRequestsSupabase from "./QA/SupervisorRequestsSupabase";
import AgentFeedbackSupabase from "./QA/AgentFeedbackSupabase";
import ReportsSupabase from "./QA/ReportsSupabase";
import MonitoringSupabase from "./QA/MonitoringSupabase";
import TeamHeatmapSupabase from "./QA/TeamHeatmapSupabase";

// ─────────────────────────────────────────────────────────────
// Constants & Types
// ─────────────────────────────────────────────────────────────

const ROUTES = {
  dashboard: "/",
  newAudit: "/new-audit",
  auditsUpload: "/audits-upload",
  auditsList: "/audits-list",
  callsUpload: "/calls-upload",
  ticketsUpload: "/tickets-upload",
  ticketEvidence: "/ticket-evidence",
  ticketAiReview: "/ticket-ai-review",
  salesUpload: "/sales-upload",
  agentFeedback: "/agent-feedback",
  monitoring: "/monitoring",
  accounts: "/accounts",
  supervisorRequests: "/supervisor-requests",
  reports: "/reports",
  teamHeatmap: "/team-heatmap",
  profile: "/profile",
  supervisorOverview: "/supervisor",
  supervisorTeamDashboard: "/supervisor/team-dashboard",
  supervisorRequestsView: "/supervisor/requests",
  supervisorProfile: "/supervisor/profile",
} as const;

type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

interface NavItem {
  readonly path: RoutePath;
  readonly label: string;
  readonly group: string;
  readonly shortcut?: string;
}

const LOGO_MARK_SRC = "/detroit-axle-mark.png";
const LOGO_WORDMARK_SRC = "/detroit-axle-wordmark.svg";
const SIDEBAR_W_COLLAPSED = 60;
const SIDEBAR_W_EXPANDED = 240;
const COMPACT_BP = 1024;

// Spring-like easing — matches a physical spring with low mass/high stiffness
const SPRING = "cubic-bezier(0.175, 0.885, 0.32, 1.075)";
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const DURATION_SIDEBAR = "220ms";

const NAV_GROUPS: Readonly<Record<string, readonly string[]>> = {
  Core: ["Dashboard", "Overview", "Team Dashboard"],
  Audits: ["New Audit", "Audits Upload", "Audits List"],
  Data: [
    "Calls Upload",
    "Tickets Upload",
    "Ticket Evidence",
    "Ticket AI Review",
    "Sales Upload",
  ],
  Analytics: ["Agent Feedback", "Monitoring", "Team Heatmap"],
  Management: ["Accounts", "Supervisor Requests", "Reports"],
  Account: [
    "My Admin Profile",
    "My QA Profile",
    "My Supervisor Profile",
    "Supervisor Requests",
  ],
};

// Carefully chosen accent colours — each group has a distinct identity.
const GROUP_ACCENT: Readonly<Record<string, string>> = {
  Core: "var(--accent-blue)",
  Audits: "var(--accent-violet)",
  Data: "var(--accent-cyan)",
  Analytics: "var(--accent-amber)",
  Management: "var(--accent-rose)",
  Account: "var(--accent-emerald)",
  Other: "var(--fg-muted)",
};

const ROLE_COLORS: Readonly<Record<string, string>> = {
  admin: "var(--accent-rose)",
  qa: "var(--accent-blue)",
  supervisor: "var(--accent-violet)",
  agent: "var(--accent-emerald)",
};

// Nav shortcuts — the first character of each label (displayed in palette)
const NAV_SHORTCUTS: Partial<Record<string, string>> = {
  Dashboard: "D",
  "New Audit": "N",
  "Audits List": "L",
  Monitoring: "M",
  Reports: "R",
  Accounts: "A",
};

// ─────────────────────────────────────────────────────────────
// Global CSS — injected once, never re-evaluated
// ─────────────────────────────────────────────────────────────

const GLOBAL_STYLE_ID = "da-shell-v4";
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Design tokens ───────────────────────────────────────── */
:root {
  /* Palette */
  --accent-blue:    #3b82f6;
  --accent-violet:  #8b5cf6;
  --accent-cyan:    #06b6d4;
  --accent-amber:   #f59e0b;
  --accent-rose:    #f43f5e;
  --accent-emerald: #10b981;

  /* Sidebar */
  --sidebar-w: ${SIDEBAR_W_COLLAPSED}px;
  --sidebar-transition: width ${DURATION_SIDEBAR} ${EASE_OUT},
                        opacity 160ms ease;

  /* Typography */
  --font-sans: 'Geist', system-ui, sans-serif;
  --font-mono: 'Geist Mono', monospace;

  /* Motion */
  --spring: ${SPRING};
  --ease-out: ${EASE_OUT};
}

/* Dark theme (default) */
[data-theme="dark"], :root {
  --bg-base:        #0a0a0f;
  --bg-elevated:    #111118;
  --bg-overlay:     #16161f;
  --bg-subtle:      rgba(255,255,255,0.04);
  --bg-subtle-hover:rgba(255,255,255,0.07);
  --border:         rgba(255,255,255,0.07);
  --border-strong:  rgba(255,255,255,0.12);
  --fg-default:     #f1f5f9;
  --fg-muted:       #64748b;
  --fg-subtle:      #334155;
  --sidebar-bg:     rgba(10,10,18,0.95);
  --sidebar-border: rgba(255,255,255,0.06);
  --header-bg:      rgba(10,10,16,0.88);
  --header-border:  rgba(255,255,255,0.06);
  --scrollbar:      rgba(255,255,255,0.08);
  --scrollbar-hover:rgba(255,255,255,0.15);
  --shadow-sm:      0 1px 3px rgba(0,0,0,0.4);
  --shadow-md:      0 4px 16px rgba(0,0,0,0.5);
  --shadow-lg:      0 12px 40px rgba(0,0,0,0.6);
  --shadow-sidebar: 1px 0 0 rgba(255,255,255,0.05), 8px 0 24px rgba(0,0,0,0.3);
}

/* Light theme */
[data-theme="light"] {
  --bg-base:        #f8f9fc;
  --bg-elevated:    #ffffff;
  --bg-overlay:     #f0f2f7;
  --bg-subtle:      rgba(0,0,0,0.03);
  --bg-subtle-hover:rgba(0,0,0,0.05);
  --border:         rgba(0,0,0,0.07);
  --border-strong:  rgba(0,0,0,0.12);
  --fg-default:     #0f172a;
  --fg-muted:       #64748b;
  --fg-subtle:      #94a3b8;
  --sidebar-bg:     rgba(252,253,255,0.97);
  --sidebar-border: rgba(0,0,0,0.06);
  --header-bg:      rgba(255,255,255,0.9);
  --header-border:  rgba(0,0,0,0.07);
  --scrollbar:      rgba(0,0,0,0.1);
  --scrollbar-hover:rgba(0,0,0,0.2);
  --shadow-sm:      0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:      0 4px 16px rgba(0,0,0,0.08);
  --shadow-lg:      0 12px 40px rgba(0,0,0,0.1);
  --shadow-sidebar: 1px 0 0 rgba(0,0,0,0.07), 8px 0 24px rgba(0,0,0,0.05);
}

/* ── Reset & Base ────────────────────────────────────────── */
html { height: 100%; }
body {
  font-family: var(--font-sans);
  background: var(--bg-base);
  color: var(--fg-default);
  min-height: 100%;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
button { font-family: inherit; cursor: pointer; }
a { color: inherit; text-decoration: none; }

/* ── Scrollbars ──────────────────────────────────────────── */
* { scrollbar-width: thin; scrollbar-color: var(--scrollbar) transparent; }
::-webkit-scrollbar { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }

/* ── Focus ───────────────────────────────────────────────── */
:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
  border-radius: 6px;
}

/* ── Keyframes ───────────────────────────────────────────── */
@keyframes fadeUp    { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn    { from { opacity:0 } to { opacity:1 } }
@keyframes slideIn   { from { opacity:0; transform:translateX(-8px) } to { opacity:1; transform:translateX(0) } }
@keyframes scaleIn   { from { opacity:0; transform:scale(.97) } to { opacity:1; transform:scale(1) } }
@keyframes spin      { to { transform:rotate(360deg) } }
@keyframes blink     { 50% { opacity:0.2 } }
@keyframes pulse     { 0%,100% { opacity:0.6 } 50% { opacity:1 } }
@keyframes ping      { 75%,100% { transform:scale(1.6); opacity:0 } }
@keyframes shimmer   {
  0%   { background-position: -200% 0 }
  100% { background-position:  200% 0 }
}
@keyframes progressBar {
  0%   { width: 0% }
  40%  { width: 60% }
  70%  { width: 80% }
  100% { width: 100% }
}
@keyframes cmdIn {
  from { opacity:0; transform:translateY(-10px) scale(0.98) }
  to   { opacity:1; transform:translateY(0)     scale(1)    }
}

/* ── Shell Layout ────────────────────────────────────────── */
.da-shell {
  display: flex;
  min-height: 100vh;
}

/* ── Sidebar ─────────────────────────────────────────────── */
.da-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  width: var(--sidebar-w, ${SIDEBAR_W_COLLAPSED}px);
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  box-shadow: var(--shadow-sidebar);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  transition: var(--sidebar-transition);
  overflow: hidden;
  will-change: width;
}
.da-sidebar.expanded {
  width: ${SIDEBAR_W_EXPANDED}px;
}
@media (prefers-reduced-motion: reduce) {
  .da-sidebar { transition: none !important; }
}

/* Sidebar header */
.da-sidebar-header {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 10px;
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
  overflow: hidden;
  gap: 10px;
}
.da-sidebar-logo {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(59,130,246,0.1);
  border: 1px solid rgba(59,130,246,0.2);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
}
.da-sidebar-brand {
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 140ms ease, transform 160ms ease;
  white-space: nowrap;
  overflow: hidden;
  pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-brand {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}
.da-sidebar-brand-name {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--fg-default);
  line-height: 1.2;
}
.da-sidebar-brand-sub {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin-top: 1px;
}

/* Nav rail */
.da-nav-rail {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.da-nav-section {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 4px;
}
.da-nav-section + .da-nav-section {
  padding-top: 8px;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}
.da-nav-section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  padding: 0 8px 4px;
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition:
    max-height ${DURATION_SIDEBAR} ${EASE_OUT},
    opacity 100ms ease,
    padding ${DURATION_SIDEBAR} ${EASE_OUT};
}
.da-sidebar.expanded .da-nav-section-label {
  max-height: 24px;
  opacity: 0.8;
  padding: 4px 8px 4px;
}

/* Nav item */
.da-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 36px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  padding: 0 8px;
  gap: 0;
  overflow: hidden;
  white-space: nowrap;
  transition:
    color 120ms ease,
    background 100ms ease,
    border-color 120ms ease,
    gap ${DURATION_SIDEBAR} ${EASE_OUT},
    padding ${DURATION_SIDEBAR} ${EASE_OUT};
  width: 100%;
  text-align: left;
  justify-content: center;
}
.da-sidebar.expanded .da-nav-item { gap: 9px; justify-content: flex-start; }
.da-nav-item:hover {
  color: var(--fg-default);
  background: var(--bg-subtle-hover);
}
.da-nav-item.active {
  color: var(--item-accent, var(--accent-blue));
  background: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 10%, transparent);
  border-color: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 18%, transparent);
}
.da-nav-item.active:hover {
  background: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 14%, transparent);
}
.da-nav-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: inherit;
}
.da-nav-label {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0;
  max-width: 0;
  transition:
    max-width 200ms ${EASE_OUT},
    opacity 100ms ease;
  color: inherit;
  letter-spacing: -0.01em;
}
.da-nav-item.active .da-nav-label { font-weight: 600; }
.da-sidebar.expanded .da-nav-label { opacity: 1; max-width: 160px; }

/* Active pip */
.da-nav-pip {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--item-accent, var(--accent-blue));
  height: 0;
  transition: height 180ms var(--spring);
  box-shadow: 0 0 6px color-mix(in srgb, var(--item-accent, var(--accent-blue)) 60%, transparent);
}
.da-nav-item.active .da-nav-pip { height: 16px; }

/* Sidebar user */
.da-sidebar-user {
  padding: 8px 6px;
  border-top: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}
.da-sidebar-user-inner {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 8px;
  border-radius: 8px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: gap ${DURATION_SIDEBAR} ${EASE_OUT}, padding ${DURATION_SIDEBAR} ${EASE_OUT};
  justify-content: center;
}
.da-sidebar.expanded .da-sidebar-user-inner { gap: 9px; justify-content: flex-start; }
.da-sidebar-avatar {
  width: 28px; height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  position: relative;
}
.da-sidebar-avatar-online {
  position: absolute;
  bottom: -1px; right: -1px;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--accent-emerald);
  border: 1.5px solid var(--sidebar-bg);
}
.da-sidebar-avatar-online::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  background: var(--accent-emerald);
  animation: ping 2s cubic-bezier(0,0,.2,1) infinite;
  opacity: 0.4;
}
.da-sidebar-user-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 140ms ease, transform 160ms ease;
  pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-user-info { opacity: 1; transform: translateX(0); pointer-events: auto; }
.da-sidebar-user-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-default);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}
.da-sidebar-user-role {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-top: 1px;
}
.da-sidebar-logout {
  width: 0;
  height: 26px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-muted);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
  opacity: 0;
  padding: 0;
  transition: opacity 140ms ease, width 180ms ease, color 120ms ease, background 120ms ease;
  pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-logout {
  opacity: 1;
  width: 26px;
  pointer-events: auto;
}
.da-sidebar-logout:hover { color: var(--accent-rose); background: color-mix(in srgb, var(--accent-rose) 10%, transparent); border-color: color-mix(in srgb, var(--accent-rose) 25%, transparent); }

/* ── Header ──────────────────────────────────────────────── */
.da-header {
  position: fixed;
  top: 0;
  left: var(--sidebar-w, ${SIDEBAR_W_COLLAPSED}px);
  right: 0;
  z-index: 30;
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--header-border);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  gap: 12px;
  transition: left ${DURATION_SIDEBAR} ${EASE_OUT};
}
.da-sidebar.expanded ~ .da-page-root .da-header { left: ${SIDEBAR_W_EXPANDED}px; }
/* Simpler: header is a sibling — use CSS var */
.da-header-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.da-header-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.da-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  overflow: hidden;
}
.da-breadcrumb-root { color: var(--fg-muted); font-weight: 400; white-space: nowrap; }
.da-breadcrumb-sep { color: var(--fg-subtle); }
.da-breadcrumb-current {
  font-weight: 600;
  color: var(--fg-default);
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: fadeIn 180ms ease both;
}

/* Pill button — used for theme toggle, cmd-k */
.da-pill-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: var(--bg-elevated);
  color: var(--fg-muted);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
  white-space: nowrap;
  flex-shrink: 0;
}
.da-pill-btn:hover { color: var(--fg-default); border-color: var(--border-strong); background: var(--bg-overlay); }

.da-icon-btn {
  width: 32px; height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
  flex-shrink: 0;
}
.da-icon-btn:hover { color: var(--fg-default); background: var(--bg-subtle-hover); }
.da-icon-btn.active { color: var(--accent-blue); border-color: color-mix(in srgb, var(--accent-blue) 30%, transparent); background: color-mix(in srgb, var(--accent-blue) 8%, transparent); }

.da-sign-out-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 11px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent);
  background: color-mix(in srgb, var(--accent-rose) 7%, transparent);
  color: var(--accent-rose);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
  white-space: nowrap;
  flex-shrink: 0;
}
.da-sign-out-btn:hover { background: color-mix(in srgb, var(--accent-rose) 12%, transparent); border-color: color-mix(in srgb, var(--accent-rose) 40%, transparent); }

/* Header user chip */
.da-user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 32px;
  padding: 0 10px 0 6px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-subtle);
}
.da-user-chip-avatar {
  width: 22px; height: 22px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.da-user-chip-name { font-size: 12px; font-weight: 600; color: var(--fg-default); letter-spacing: -0.01em; }
.da-user-chip-role { font-size: 10px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }

/* Sidebar pin toggle button */
.da-pin-btn {
  display: none;
}
@media (min-width: ${COMPACT_BP}px) {
  .da-pin-btn { display: grid; }
}

/* ── Page root (accounts for sidebar & header) ───────────── */
.da-page-root {
  flex: 1;
  min-width: 0;
  margin-left: var(--sidebar-w, ${SIDEBAR_W_COLLAPSED}px);
  padding-top: 56px;
  transition: margin-left ${DURATION_SIDEBAR} ${EASE_OUT};
}
.da-sidebar.expanded ~ .da-page-root { margin-left: ${SIDEBAR_W_EXPANDED}px; }

/* ── Main content area ───────────────────────────────────── */
.da-content {
  padding: 24px;
  min-height: calc(100vh - 56px);
}
@media (max-width: ${COMPACT_BP - 1}px) {
  .da-content { padding: 16px; }
}

/* ── Progress bar ────────────────────────────────────────── */
.da-progress-bar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 2px;
  z-index: 9999;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-violet), var(--accent-cyan));
  animation: progressBar 2.4s ${EASE_OUT} forwards;
  transform-origin: left;
}

/* ── Compact nav (mobile/tablet) ─────────────────────────── */
.da-compact-nav {
  position: sticky;
  top: 56px;
  z-index: 20;
  display: flex;
  gap: 2px;
  padding: 8px 16px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
  background: var(--header-bg);
  backdrop-filter: blur(16px);
  scrollbar-width: none;
}
.da-compact-nav::-webkit-scrollbar { display: none; }
.da-compact-nav-item {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-muted);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: all 120ms ease;
  flex-shrink: 0;
}
.da-compact-nav-item:hover { color: var(--fg-default); background: var(--bg-subtle-hover); }
.da-compact-nav-item.active {
  color: var(--item-accent, var(--accent-blue));
  background: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 10%, transparent);
  border-color: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 20%, transparent);
  font-weight: 600;
}

/* ── Command Palette ─────────────────────────────────────── */
.da-cmd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  animation: fadeIn 120ms ease both;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 14vh;
}
.da-cmd-palette {
  width: min(580px, 92vw);
  border-radius: 14px;
  border: 1px solid var(--border-strong);
  background: var(--bg-overlay);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.03);
  overflow: hidden;
  animation: cmdIn 160ms var(--spring) both;
}
.da-cmd-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.da-cmd-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 15px;
  font-weight: 400;
  font-family: inherit;
  color: var(--fg-default);
  letter-spacing: -0.01em;
}
.da-cmd-input::placeholder { color: var(--fg-muted); }
.da-cmd-results {
  max-height: 340px;
  overflow-y: auto;
  padding: 6px;
}
.da-cmd-section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  padding: 8px 10px 4px;
}
.da-cmd-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 80ms ease;
  border: 1px solid transparent;
}
.da-cmd-item:hover, .da-cmd-item.selected {
  background: var(--bg-subtle-hover);
  border-color: var(--border);
}
.da-cmd-item-icon { width: 28px; height: 28px; border-radius: 7px; display: grid; place-items: center; flex-shrink: 0; font-size: 13px; }
.da-cmd-item-label { flex: 1; font-size: 13px; font-weight: 500; color: var(--fg-default); letter-spacing: -0.01em; }
.da-cmd-item-group { font-size: 11px; color: var(--fg-muted); }
.da-cmd-shortcut {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--fg-muted);
  background: var(--bg-subtle);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 6px;
}
.da-cmd-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--fg-muted);
  font-size: 13px;
}
.da-cmd-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--fg-subtle);
  font-family: var(--font-mono);
}
.da-cmd-footer kbd {
  font-family: var(--font-mono);
  font-size: 10px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  padding: 1px 5px;
  color: var(--fg-muted);
}

/* ── Loader ──────────────────────────────────────────────── */
.da-loader-shell {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--bg-base);
  z-index: 9999;
  animation: fadeIn 200ms ease;
}
.da-loader-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 28px 32px;
  border-radius: 20px;
  border: 1px solid var(--border-strong);
  background: var(--bg-elevated);
  box-shadow: var(--shadow-lg);
  animation: scaleIn 300ms var(--spring) both;
}
.da-loader-rotor {
  width: 52px; height: 52px;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent-blue);
  border-right-color: var(--accent-violet);
  animation: spin 0.9s linear infinite;
  flex-shrink: 0;
}
.da-loader-copy {}
.da-loader-eyebrow {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-blue);
  margin-bottom: 4px;
}
.da-loader-headline {
  font-size: 16px;
  font-weight: 700;
  color: var(--fg-default);
  letter-spacing: -0.02em;
}
.da-loader-sub {
  font-size: 12px;
  color: var(--fg-muted);
  margin-top: 2px;
}
.da-loader-bar {
  height: 2px;
  margin-top: 14px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
  width: 200px;
}
.da-loader-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-violet));
  background-size: 200%;
  animation: shimmer 1.5s linear infinite;
}

/* ── Profile panel ───────────────────────────────────────── */
.da-profile-panel {
  max-width: 600px;
  padding: 32px;
  border-radius: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  animation: fadeUp 220ms var(--ease-out) both;
}
.da-profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 24px;
}
@media (max-width: 500px) { .da-profile-grid { grid-template-columns: 1fr; } }
.da-profile-field {
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--bg-subtle);
  border: 1px solid var(--border);
}
.da-profile-field-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin-bottom: 4px;
}
.da-profile-field-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-default);
  letter-spacing: -0.01em;
}

/* ── Error card ──────────────────────────────────────────── */
.da-error-card {
  max-width: 400px;
  padding: 32px;
  border-radius: 16px;
  background: var(--bg-elevated);
  border: 1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent);
  text-align: center;
}

/* ── Clock ───────────────────────────────────────────────── */
.da-clock {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  color: var(--fg-muted);
  letter-spacing: 0.05em;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 1px;
}
.da-clock-colon { animation: blink 1s step-end infinite; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

function useGlobalStyles() {
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current || document.getElementById(GLOBAL_STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = GLOBAL_STYLE_ID;
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    injected.current = true;
    return () => {
      document.getElementById(GLOBAL_STYLE_ID)?.remove();
      injected.current = false;
    };
  }, []);
}

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      return readStoredTheme();
    } catch {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("da-theme", mode);
    } catch {}
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme =
      mode === "light" ? "light" : "dark";
    applyThemeCssVariables(mode);
  }, [mode]);

  const toggle = useCallback(
    () => setMode((p) => (p === "light" ? "dark" : "light")),
    []
  );
  return { mode, toggle } as const;
}

function useViewportWidth() {
  const [w, setW] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth
  );
  useEffect(() => {
    let raf: number;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setW(window.innerWidth));
    };
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("resize", handler);
      cancelAnimationFrame(raf);
    };
  }, []);
  return w;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getNavGroup(label: string): string {
  for (const [group, labels] of Object.entries(NAV_GROUPS)) {
    if (labels.includes(label)) return group;
  }
  return "Other";
}

function getActiveRouteLabel(
  pathname: string,
  items: readonly NavItem[]
): string {
  return items.find((i) => i.path === pathname)?.label ?? "Workspace";
}

function getUserInitials(profile: UserProfile): string {
  const name =
    profile.display_name || profile.agent_name || profile.email || "?";
  const parts = name.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function buildNavItems(profile: UserProfile): NavItem[] {
  const isAdmin = profile.role === "admin";
  const isStaff = isAdmin || profile.role === "qa";
  const isSupervisor = profile.role === "supervisor";

  const item = (path: RoutePath, label: string): NavItem => ({
    path,
    label,
    group: getNavGroup(label),
    shortcut: NAV_SHORTCUTS[label],
  });

  if (isSupervisor) {
    return [
      item(ROUTES.supervisorOverview, "Overview"),
      item(ROUTES.supervisorTeamDashboard, "Team Dashboard"),
      item(ROUTES.supervisorRequestsView, "Supervisor Requests"),
      item(ROUTES.supervisorProfile, "My Supervisor Profile"),
    ];
  }

  if (!isStaff) return [];

  const items: NavItem[] = [
    item(ROUTES.dashboard, "Dashboard"),
    item(ROUTES.newAudit, "New Audit"),
    item(ROUTES.auditsUpload, "Audits Upload"),
    item(ROUTES.auditsList, "Audits List"),
    item(ROUTES.callsUpload, "Calls Upload"),
    item(ROUTES.ticketsUpload, "Tickets Upload"),
    item(ROUTES.ticketEvidence, "Ticket Evidence"),
    item(ROUTES.ticketAiReview, "Ticket AI Review"),
    item(ROUTES.salesUpload, "Sales Upload"),
    item(ROUTES.agentFeedback, "Agent Feedback"),
    item(ROUTES.monitoring, "Monitoring"),
    item(ROUTES.teamHeatmap, "Team Heatmap"),
  ];

  if (isAdmin) {
    items.push(
      item(ROUTES.accounts, "Accounts"),
      item(ROUTES.supervisorRequests, "Supervisor Requests")
    );
  }

  items.push(
    item(ROUTES.reports, "Reports"),
    item(ROUTES.profile, isAdmin ? "My Admin Profile" : "My QA Profile")
  );

  return items;
}

// ─────────────────────────────────────────────────────────────
// Icons — inline SVG, memoised once
// ─────────────────────────────────────────────────────────────

type IconProps = { size?: number };

const SearchIcon = memo(function SearchIcon({ size = 15 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
});

const SunIcon = memo(function SunIcon({ size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
});

const MoonIcon = memo(function MoonIcon({ size = 14 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
});

const LogOutIcon = memo(function LogOutIcon({ size = 13 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
});

const MenuIcon = memo(function MenuIcon({ size = 15 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
});

const NavIcon = memo(function NavIcon({
  label,
  size = 15,
}: {
  label: string;
  size?: number;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const icons: Record<string, ReactNode> = {
    Dashboard: (
      <svg {...p}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
    "New Audit": (
      <svg {...p}>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
    "Audits Upload": (
      <svg {...p}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
    "Audits List": (
      <svg {...p}>
        <line x1="9" y1="6" x2="20" y2="6" />
        <line x1="9" y1="12" x2="20" y2="12" />
        <line x1="9" y1="18" x2="20" y2="18" />
        <circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
    "Calls Upload": (
      <svg {...p}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.93 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    ),
    "Tickets Upload": (
      <svg {...p}>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    "Ticket Evidence": (
      <svg {...p}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    "Ticket AI Review": (
      <svg {...p}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
    "Sales Upload": (
      <svg {...p}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    "Agent Feedback": (
      <svg {...p}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    Monitoring: (
      <svg {...p}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    "Team Heatmap": (
      <svg {...p}>
        <rect x="3" y="3" width="4" height="4" rx="0.7" />
        <rect x="10" y="3" width="4" height="4" rx="0.7" />
        <rect x="17" y="3" width="4" height="4" rx="0.7" />
        <rect x="3" y="10" width="4" height="4" rx="0.7" />
        <rect x="10" y="10" width="4" height="4" rx="0.7" />
        <rect x="17" y="10" width="4" height="4" rx="0.7" />
        <rect x="3" y="17" width="4" height="4" rx="0.7" />
        <rect x="10" y="17" width="4" height="4" rx="0.7" />
        <rect x="17" y="17" width="4" height="4" rx="0.7" />
      </svg>
    ),
    Accounts: (
      <svg {...p}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    "Supervisor Requests": (
      <svg {...p}>
        <polyline points="17 11 21 7 17 3" />
        <line x1="21" y1="7" x2="9" y2="7" />
        <polyline points="7 21 3 17 7 13" />
        <line x1="15" y1="17" x2="3" y2="17" />
      </svg>
    ),
    Reports: (
      <svg {...p}>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    "My Admin Profile": (
      <svg {...p}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    "My QA Profile": (
      <svg {...p}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    Overview: (
      <svg {...p}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    "Team Dashboard": (
      <svg {...p}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    "My Supervisor Profile": (
      <svg {...p}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  };

  return (
    icons[label] ?? (
      <svg {...p}>
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      </svg>
    )
  );
});

// ─────────────────────────────────────────────────────────────
// LiveClock — ref-backed, never re-renders parent
// ─────────────────────────────────────────────────────────────

const LiveClock = memo(function LiveClock() {
  const hhRef = useRef<HTMLSpanElement>(null);
  const mmRef = useRef<HTMLSpanElement>(null);
  const ssRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, "0");
      const mm = now.getMinutes().toString().padStart(2, "0");
      const ss = now.getSeconds().toString().padStart(2, "0");
      if (hhRef.current) hhRef.current.textContent = hh;
      if (mmRef.current) mmRef.current.textContent = mm;
      if (ssRef.current) ssRef.current.textContent = ss;
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="da-clock">
      <span ref={hhRef} />
      <span className="da-clock-colon">:</span>
      <span ref={mmRef} />
      <span className="da-clock-colon" style={{ animationDelay: "0.5s" }}>
        :
      </span>
      <span ref={ssRef} style={{ opacity: 0.5 }} />
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Command Palette
// ─────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  items: readonly NavItem[];
  onNavigate: (path: RoutePath) => void;
  onClose: () => void;
}

const CommandPalette = memo(function CommandPalette({
  items,
  onNavigate,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q)
    );
  }, [query, items]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown")
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      if (e.key === "ArrowUp") setSelected((s) => Math.max(s - 1, 0));
      if (e.key === "Enter" && filtered[selected]) {
        onNavigate(filtered[selected].path);
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selected, onNavigate, onClose]);

  return (
    <div
      className="da-cmd-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="da-cmd-palette" role="dialog" aria-label="Command palette">
        <div className="da-cmd-input-wrap">
          <SearchIcon size={16} />
          <input
            ref={inputRef}
            className="da-cmd-input"
            placeholder="Search pages, actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Command input"
          />
          <kbd
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              background: "var(--bg-subtle)",
              border: "1px solid var(--border-strong)",
              borderRadius: "4px",
              padding: "2px 6px",
              color: "var(--fg-muted)",
              flexShrink: 0,
            }}
          >
            ESC
          </kbd>
        </div>

        <div className="da-cmd-results" role="listbox">
          {filtered.length === 0 ? (
            <div className="da-cmd-empty">No results for "{query}"</div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.path}
                role="option"
                aria-selected={idx === selected}
                className={`da-cmd-item${idx === selected ? " selected" : ""}`}
                onClick={() => {
                  onNavigate(item.path);
                  onClose();
                }}
                onMouseEnter={() => setSelected(idx)}
                style={{ "--item-accent": GROUP_ACCENT[item.group] ?? "var(--accent-blue)" } as CSSProperties}
              >
                <div
                  className="da-cmd-item-icon"
                  style={{
                    background: `color-mix(in srgb, ${GROUP_ACCENT[item.group] ?? "var(--accent-blue)"} 12%, transparent)`,
                    color: GROUP_ACCENT[item.group] ?? "var(--accent-blue)",
                  }}
                >
                  <NavIcon label={item.label} size={14} />
                </div>
                <span className="da-cmd-item-label">{item.label}</span>
                <span className="da-cmd-item-group">{item.group}</span>
                {item.shortcut && (
                  <span className="da-cmd-shortcut">{item.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="da-cmd-footer">
          <span>
            <kbd>↑↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> go
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────

interface SidebarProps {
  navGroupsOrdered: [string, NavItem[]][];
  activePath: string;
  isExpanded: boolean;
  profile: UserProfile;
  userInitials: string;
  onNavigate: (path: RoutePath) => void;
  onExpand: () => void;
  onCollapse: () => void;
  onLogout: () => void;
}

const Sidebar = memo(
  function Sidebar({
    navGroupsOrdered,
    activePath,
    isExpanded,
    profile,
    userInitials,
    onNavigate,
    onExpand,
    onCollapse,
    onLogout,
  }: SidebarProps) {
    const name =
      profile.display_name || profile.agent_name || profile.email || "";
    const roleColor = ROLE_COLORS[profile.role || "qa"] || "var(--fg-muted)";

    return (
      <nav
        className={`da-sidebar${isExpanded ? " expanded" : ""}`}
        onMouseEnter={onExpand}
        onMouseLeave={onCollapse}
        aria-label="Main navigation"
      >
        {/* Header */}
        <div className="da-sidebar-header">
          <div className="da-sidebar-logo">
            <img
              src={LOGO_MARK_SRC}
              alt=""
              width={24}
              height={24}
              style={{ objectFit: "contain", display: "block" }}
            />
          </div>
          <div className="da-sidebar-brand">
            <div className="da-sidebar-brand-name">Detroit Axle</div>
            <div className="da-sidebar-brand-sub">QA Platform</div>
          </div>
        </div>

        {/* Nav */}
        <div className="da-nav-rail">
          {navGroupsOrdered.map(([group, groupItems]) => (
            <div key={group} className="da-nav-section">
              <div
                className="da-nav-section-label"
                style={{ color: GROUP_ACCENT[group] || "var(--fg-subtle)" }}
              >
                {group}
              </div>
              {groupItems.map((item) => {
                const accent =
                  GROUP_ACCENT[item.group] || "var(--accent-blue)";
                const isActive = activePath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={`da-nav-item${isActive ? " active" : ""}`}
                    onClick={() => onNavigate(item.path)}
                    aria-current={isActive ? "page" : undefined}
                    title={item.label}
                    style={
                      {
                        "--item-accent": accent,
                      } as CSSProperties
                    }
                  >
                    <div className="da-nav-pip" />
                    <span className="da-nav-icon">
                      <NavIcon label={item.label} size={15} />
                    </span>
                    <span className="da-nav-label">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* User */}
        <div className="da-sidebar-user">
          <div className="da-sidebar-user-inner">
            <div
              className="da-sidebar-avatar"
              style={{
                background: `color-mix(in srgb, ${roleColor} 15%, transparent)`,
                border: `1.5px solid color-mix(in srgb, ${roleColor} 30%, transparent)`,
                color: roleColor,
              }}
            >
              {userInitials}
              <div className="da-sidebar-avatar-online" />
            </div>
            <div className="da-sidebar-user-info">
              <div className="da-sidebar-user-name">{name}</div>
              <div
                className="da-sidebar-user-role"
                style={{ color: roleColor }}
              >
                {profile.role}
              </div>
            </div>
            <button
              type="button"
              className="da-sidebar-logout"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOutIcon size={13} />
            </button>
          </div>
        </div>
      </nav>
    );
  },
  (prev, next) =>
    prev.activePath === next.activePath &&
    prev.isExpanded === next.isExpanded &&
    prev.navGroupsOrdered === next.navGroupsOrdered &&
    prev.profile === next.profile &&
    prev.userInitials === next.userInitials &&
    prev.onNavigate === next.onNavigate &&
    prev.onExpand === next.onExpand &&
    prev.onCollapse === next.onCollapse &&
    prev.onLogout === next.onLogout
);

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

interface HeaderProps {
  isCompact: boolean;
  hasSidebar: boolean;
  isSidebarPinned: boolean;
  activeLabel: string;
  profile: UserProfile;
  userInitials: string;
  themeMode: ThemeMode;
  onToggleSidebarPin: () => void;
  onToggleTheme: () => void;
  onOpenCmd: () => void;
  onLogout: () => void;
}

const Header = memo(
  function Header({
    isCompact,
    hasSidebar,
    isSidebarPinned,
    activeLabel,
    profile,
    userInitials,
    themeMode,
    onToggleSidebarPin,
    onToggleTheme,
    onOpenCmd,
    onLogout,
  }: HeaderProps) {
    const isDark = themeMode === "dark";
    const roleColor = ROLE_COLORS[profile.role || "qa"] || "var(--fg-muted)";
    const profileLabel =
      profile.display_name || profile.agent_name || profile.email || "";

    return (
      <header className="da-header">
        <div className="da-header-left">
          {hasSidebar && !isCompact && (
            <button
              type="button"
              className={`da-icon-btn da-pin-btn${isSidebarPinned ? " active" : ""}`}
              onClick={onToggleSidebarPin}
              aria-label={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
              title={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
            >
              <MenuIcon size={15} />
            </button>
          )}

          {!isCompact && hasSidebar && (
            <>
              <div
                style={{
                  width: "1px",
                  height: "16px",
                  background: "var(--border-strong)",
                }}
              />
              <nav className="da-breadcrumb" aria-label="Breadcrumb">
                <span className="da-breadcrumb-root">Workspace</span>
                <span className="da-breadcrumb-sep">›</span>
                <span key={activeLabel} className="da-breadcrumb-current">
                  {activeLabel}
                </span>
              </nav>
            </>
          )}

          {isCompact && (
            <img
              src={LOGO_WORDMARK_SRC}
              alt="Detroit Axle"
              height={28}
              style={{ objectFit: "contain", display: "block" }}
            />
          )}
        </div>

        <div className="da-header-right">
          {!isCompact && <LiveClock />}

          {!isCompact && (
            <div
              style={{
                width: "1px",
                height: "16px",
                background: "var(--border)",
              }}
            />
          )}

          {/* ⌘K button */}
          <button
            type="button"
            className="da-pill-btn"
            onClick={onOpenCmd}
            aria-label="Open command palette"
          >
            <SearchIcon size={13} />
            {!isCompact && <span>Search</span>}
            {!isCompact && (
              <kbd
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "4px",
                  padding: "1px 5px",
                  color: "var(--fg-muted)",
                  marginLeft: "2px",
                }}
              >
                ⌘K
              </kbd>
            )}
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            className="da-icon-btn"
            onClick={onToggleTheme}
            title={isDark ? "Light mode" : "Dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* User chip */}
          {!isCompact && (
            <div className="da-user-chip">
              <div
                className="da-user-chip-avatar"
                style={{
                  background: `color-mix(in srgb, ${roleColor} 60%, #000)`,
                }}
              >
                {userInitials}
              </div>
              <div>
                <div className="da-user-chip-name" style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {profileLabel}
                </div>
                <div
                  className="da-user-chip-role"
                  style={{ color: roleColor }}
                >
                  {profile.role}
                </div>
              </div>
            </div>
          )}

          {/* Sign out */}
          <button
            type="button"
            className="da-sign-out-btn"
            onClick={onLogout}
            aria-label="Sign out"
          >
            <LogOutIcon size={12} />
            {!isCompact && "Sign out"}
          </button>
        </div>
      </header>
    );
  },
  (prev, next) =>
    prev.isCompact === next.isCompact &&
    prev.hasSidebar === next.hasSidebar &&
    prev.isSidebarPinned === next.isSidebarPinned &&
    prev.activeLabel === next.activeLabel &&
    prev.profile === next.profile &&
    prev.userInitials === next.userInitials &&
    prev.themeMode === next.themeMode &&
    prev.onToggleSidebarPin === next.onToggleSidebarPin &&
    prev.onToggleTheme === next.onToggleTheme &&
    prev.onOpenCmd === next.onOpenCmd &&
    prev.onLogout === next.onLogout
);

// ─────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────

const Loader = memo(function Loader({
  message = "Loading workspace…",
}: {
  message?: string;
}) {
  return (
    <div className="da-loader-shell" role="status" aria-label={message}>
      <div className="da-loader-card">
        <div className="da-loader-rotor" aria-hidden="true" />
        <div className="da-loader-copy">
          <div className="da-loader-eyebrow">Detroit Axle QA</div>
          <div className="da-loader-headline">{message}</div>
          <div className="da-loader-sub">Preparing your workspace</div>
          <div className="da-loader-bar">
            <div className="da-loader-bar-fill" />
          </div>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Profile panel
// ─────────────────────────────────────────────────────────────

const ProfilePanel = memo(function ProfilePanel({
  title,
  profile,
}: {
  title: string;
  profile: UserProfile;
}) {
  const initials = getUserInitials(profile);
  const roleColor = ROLE_COLORS[profile.role || "qa"] || "var(--fg-muted)";

  const fields: [string, string][] = [
    ["Name", profile.agent_name || "—"],
    ["Display name", profile.display_name || "—"],
    ["Email", profile.email || "—"],
    ["Role", profile.role || "—"],
    ["Agent ID", profile.agent_id || "—"],
    ["Team", profile.team || "—"],
  ];

  return (
    <div className="da-profile-panel">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            background: `color-mix(in srgb, ${roleColor} 15%, transparent)`,
            border: `2px solid color-mix(in srgb, ${roleColor} 30%, transparent)`,
            display: "grid",
            placeItems: "center",
            fontSize: "18px",
            fontWeight: 700,
            color: roleColor,
            flexShrink: 0,
            letterSpacing: "-0.02em",
          }}
        >
          {initials}
        </div>
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--fg-muted)",
              marginBottom: "4px",
            }}
          >
            Profile
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: "22px",
              fontWeight: 700,
              color: "var(--fg-default)",
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h2>
        </div>
      </div>

      <div className="da-profile-grid">
        {fields.map(([label, value]) => (
          <div key={label} className="da-profile-field">
            <div className="da-profile-field-label">{label}</div>
            <div className="da-profile-field-value">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Route trees
// ─────────────────────────────────────────────────────────────

const StaffRoutes = memo(function StaffRoutes({
  profile,
}: {
  profile: UserProfile;
}) {
  const isAdmin = profile.role === "admin";
  const isStaff = isAdmin || profile.role === "qa";

  return (
    <Routes>
      <Route path={ROUTES.dashboard} element={<Dashboard />} />
      <Route path={ROUTES.newAudit} element={<NewAuditSupabase />} />
      <Route
        path={ROUTES.auditsUpload}
        element={<AuditsImportSupabase />}
      />
      <Route path={ROUTES.auditsList} element={<AuditsListSupabase />} />
      <Route
        path={ROUTES.callsUpload}
        element={<CallsUploadSupabase />}
      />
      <Route
        path={ROUTES.ticketsUpload}
        element={<TicketsUploadSupabase />}
      />
      <Route
        path={ROUTES.ticketEvidence}
        element={<TicketEvidenceUploadSupabase />}
      />
      <Route
        path={ROUTES.ticketAiReview}
        element={<TicketAIReviewQueueSupabase />}
      />
      <Route
        path={ROUTES.salesUpload}
        element={<SalesUploadSupabase />}
      />
      <Route
        path={ROUTES.agentFeedback}
        element={<AgentFeedbackSupabase />}
      />
      <Route
        path={ROUTES.monitoring}
        element={<MonitoringSupabase />}
      />
      <Route
        path={ROUTES.teamHeatmap}
        element={<TeamHeatmapSupabase currentUser={profile} />}
      />
      {isAdmin && (
        <Route
          path={ROUTES.accounts}
          element={<AccountsSupabase />}
        />
      )}
      {isAdmin && (
        <Route
          path={ROUTES.supervisorRequests}
          element={<SupervisorRequestsSupabase currentUser={profile} />}
        />
      )}
      {isStaff && (
        <Route
          path={ROUTES.reports}
          element={<ReportsSupabase />}
        />
      )}
      <Route
        path={ROUTES.profile}
        element={
          <ProfilePanel
            title={isAdmin ? "My Admin Profile" : "My QA Profile"}
            profile={profile}
          />
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  );
});

const SupervisorRoutes = memo(function SupervisorRoutes({
  profile,
}: {
  profile: UserProfile;
}) {
  return (
    <Routes>
      <Route
        path={ROUTES.supervisorOverview}
        element={
          <SupervisorPortal
            currentUser={profile}
            initialTab="overview"
            hideInternalTabs
          />
        }
      />
      <Route
        path={ROUTES.supervisorTeamDashboard}
        element={
          <SupervisorPortal
            currentUser={profile}
            initialTab="team-dashboard"
            hideInternalTabs
          />
        }
      />
      <Route
        path={ROUTES.supervisorRequestsView}
        element={
          <SupervisorPortal
            currentUser={profile}
            initialTab="requests"
            hideInternalTabs
          />
        }
      />
      <Route
        path={ROUTES.supervisorProfile}
        element={
          <ProfilePanel
            title="My Supervisor Profile"
            profile={profile}
          />
        }
      />
      <Route
        path="*"
        element={<Navigate to={ROUTES.supervisorOverview} replace />}
      />
    </Routes>
  );
});

// ─────────────────────────────────────────────────────────────
// AppShell — the orchestrator
// ─────────────────────────────────────────────────────────────

function AppShell() {
  const auth = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();
  const viewportWidth = useViewportWidth();
  const { mode: themeMode, toggle: toggleTheme } = useTheme();

  useGlobalStyles();

  // ── Sidebar state ──────────────────────────────────────────
  // Driven by CSS classes, not inline styles, to avoid re-renders.
  const [isSidebarPinned, setSidebarPinned] = useState(false);
  const [isSidebarHovered, setSidebarHovered] = useState(false);
  const [isCmdOpen, setCmdOpen] = useState(false);
  const pinnedRef = useRef(false);

  const isCompact = viewportWidth < COMPACT_BP;
  const isSidebarExpanded =
    !isCompact && (isSidebarPinned || isSidebarHovered);

  // Sync CSS var for sidebar width so header & content can shift.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-w",
      isSidebarExpanded
        ? `${SIDEBAR_W_EXPANDED}px`
        : `${SIDEBAR_W_COLLAPSED}px`
    );
  }, [isSidebarExpanded]);

  // Theme attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  // Reset pin on compact
  useEffect(() => {
    if (isCompact) {
      setSidebarPinned(false);
      pinnedRef.current = false;
    }
  }, [isCompact]);

  // ⌘K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Stable callbacks ────────────────────────────────────────
  const handleNavigate = useCallback(
    (path: RoutePath) => {
      navigate(path);
      setCmdOpen(false);
    },
    [navigate]
  );
  const handleTogglePin = useCallback(() => {
    setSidebarPinned((p) => {
      pinnedRef.current = !p;
      return !p;
    });
  }, []);
  const handleSidebarEnter = useCallback(
    () => !pinnedRef.current && setSidebarHovered(true),
    []
  );
  const handleSidebarLeave = useCallback(
    () => setSidebarHovered(false),
    []
  );
  const handleLogout = useCallback(() => auth.logout(), [auth]);
  const handleOpenCmd = useCallback(() => setCmdOpen(true), []);
  const handleCloseCmd = useCallback(() => setCmdOpen(false), []);

  // ── Derived ────────────────────────────────────────────────
  const { profile, loading, recoveryMode, logout, handleRecoveryComplete } =
    auth;

  const navItems = useMemo(
    () => (profile ? buildNavItems(profile) : []),
    [profile]
  );

  const navGroupsOrdered = useMemo<[string, NavItem[]][]>(() => {
    const map: Record<string, NavItem[]> = {};
    navItems.forEach((item) => {
      if (!map[item.group]) map[item.group] = [];
      map[item.group].push(item);
    });
    return Object.entries(map);
  }, [navItems]);

  const activeLabel = useMemo(
    () => getActiveRouteLabel(location.pathname as RoutePath, navItems),
    [location.pathname, navItems]
  );

  // ── Guard states ────────────────────────────────────────────
  if (loading) return <Loader />;
  if (recoveryMode)
    return (
      <ResetPassword
        onComplete={handleRecoveryComplete}
        onLogout={logout}
      />
    );
  if (!auth.session) return <Login />;
  if (!profile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
        }}
      >
        <div className="da-error-card">
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--accent-rose)",
              marginBottom: "8px",
            }}
          >
            Profile error
          </div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "var(--fg-default)",
              marginBottom: "10px",
            }}
          >
            Profile not found
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--fg-muted)",
              lineHeight: 1.6,
              marginBottom: "20px",
            }}
          >
            {auth.profileError ||
              "This account exists in Auth but has no profile row."}
          </p>
          <button
            onClick={logout}
            className="da-sign-out-btn"
            style={{ margin: "0 auto" }}
          >
            <LogOutIcon size={12} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = profile.role === "admin";
  const isQA = profile.role === "qa";
  const isSupervisor = profile.role === "supervisor";
  const isStaff = isAdmin || isQA;
  const hasSidebar = isStaff || isSupervisor;
  const userInitials = getUserInitials(profile);

  return (
    <AuthContext.Provider value={{ profile, loading: false, logout }}>
      {/* Command palette */}
      {isCmdOpen && (
        <CommandPalette
          items={navItems}
          onNavigate={handleNavigate}
          onClose={handleCloseCmd}
        />
      )}

      <div className="da-shell">
        {hasSidebar && (
          <Sidebar
            navGroupsOrdered={navGroupsOrdered}
            activePath={location.pathname}
            isExpanded={isSidebarExpanded}
            profile={profile}
            userInitials={userInitials}
            onNavigate={handleNavigate}
            onExpand={handleSidebarEnter}
            onCollapse={handleSidebarLeave}
            onLogout={handleLogout}
          />
        )}

        <div className="da-page-root">
          <Header
            isCompact={isCompact}
            hasSidebar={hasSidebar}
            isSidebarPinned={isSidebarPinned}
            activeLabel={activeLabel}
            profile={profile}
            userInitials={userInitials}
            themeMode={themeMode}
            onToggleSidebarPin={handleTogglePin}
            onToggleTheme={toggleTheme}
            onOpenCmd={handleOpenCmd}
            onLogout={handleLogout}
          />

          <main>
            {hasSidebar ? (
              <>
                {isCompact && (
                  <nav className="da-compact-nav" aria-label="Mobile navigation">
                    {navItems.map((item) => {
                      const accent =
                        GROUP_ACCENT[item.group] || "var(--accent-blue)";
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          className={`da-compact-nav-item${isActive ? " active" : ""}`}
                          onClick={() => handleNavigate(item.path)}
                          style={
                            {
                              "--item-accent": accent,
                            } as CSSProperties
                          }
                          aria-current={isActive ? "page" : undefined}
                        >
                          <NavIcon label={item.label} size={13} />
                          {item.label}
                        </button>
                      );
                    })}
                  </nav>
                )}
                <div className="da-content">
                  {isStaff ? (
                    <StaffRoutes profile={profile} />
                  ) : (
                    <SupervisorRoutes profile={profile} />
                  )}
                </div>
              </>
            ) : (
              <div className="da-content">
                <AgentPortal currentUser={profile} />
              </div>
            )}
          </main>
        </div>
      </div>
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
