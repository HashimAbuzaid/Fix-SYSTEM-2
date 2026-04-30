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
import HelpDrawer from "./components/HelpDrawer";
import HelpContentAdmin from "./components/HelpContentAdmin";
import HelpTourOverlay from "./components/HelpTourOverlay";
import SupportInbox from "./components/SupportInbox";
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
import LearningCenter from "./QA/LearningCenter";

// ─────────────────────────────────────────────────────────────
// Constants & Types
// ─────────────────────────────────────────────────────────────

const ROUTES = {
  dashboard: "/",
  agentPortal: "/agent",
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
  supportInbox: "/support-inbox",
  helpAdmin: "/help-admin",
  teamHeatmap: "/team-heatmap",
  learningCenter: "/learning-center",
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
  readonly badge?: string;
  readonly isNew?: boolean;
}

const LOGO_MARK_SRC = "/detroit-axle-mark.png";
const LOGO_WORDMARK_SRC = "/detroit-axle-wordmark.svg";
const SIDEBAR_W_COLLAPSED = 60;
const SIDEBAR_W_EXPANDED = 248;
const COMPACT_BP = 1024;
const BOTTOM_NAV_BP = 768;

const SPRING = "cubic-bezier(0.175, 0.885, 0.32, 1.075)";
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const DURATION_SIDEBAR = "260ms";

const RECENT_PAGES_KEY = "da-recent-pages";
const COLLAPSED_GROUPS_KEY = "da-collapsed-groups";
const MAX_RECENT_PAGES = 6;

const LEVEL_NAMES = ["Rookie","Learner","Practitioner","Specialist","Expert","Master","Legend"];
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1500, 2500];
const LEVEL_COLORS = [
  "var(--fg-muted)","var(--accent-blue)","var(--accent-cyan)",
  "var(--accent-violet)","var(--accent-amber)","var(--accent-rose)","#f59e0b",
];

interface RecentPage {
  path: string;
  label: string;
  group: string;
  visitedAt: number;
}

interface MiniProgress {
  xp: number;
  level: number;
  streak: number;
  completedModules: number;
}

const NAV_GROUPS: Readonly<Record<string, readonly string[]>> = {
  Core: ["Dashboard", "Overview", "Team Dashboard", "My Portal"],
  Audits: ["New Audit", "Audits Upload", "Audits List"],
  Data: ["Calls Upload", "Tickets Upload", "Ticket Evidence", "Ticket AI Review", "Sales Upload"],
  Analytics: ["Agent Feedback", "Monitoring", "Team Heatmap"],
  Learning: ["Learning Center"],
  Management: ["Accounts", "Supervisor Requests", "Reports", "Support Inbox", "Help Admin"],
  Account: ["My Admin Profile", "My QA Profile", "My Supervisor Profile", "Supervisor Requests"],
};

const GROUP_ACCENT: Readonly<Record<string, string>> = {
  Core:       "var(--accent-blue)",
  Audits:     "var(--accent-violet)",
  Data:       "var(--accent-cyan)",
  Analytics:  "var(--accent-amber)",
  Learning:   "var(--accent-emerald)",
  Management: "var(--accent-rose)",
  Account:    "var(--accent-emerald)",
  Other:      "var(--fg-muted)",
};

const ROLE_COLORS: Readonly<Record<string, string>> = {
  admin:      "var(--accent-rose)",
  qa:         "var(--accent-blue)",
  supervisor: "var(--accent-violet)",
  agent:      "var(--accent-emerald)",
};

const NAV_SHORTCUTS: Partial<Record<string, string>> = {
  Dashboard:       "D",
  "New Audit":     "N",
  "Audits List":   "L",
  Monitoring:      "M",
  Reports:         "R",
  Accounts:        "A",
  "Learning Center":"E",
  "Support Inbox": "S",
  "Help Admin":    "H",
  Help:            "?",
};

// Bottom nav items (mobile) — most important 5
const BOTTOM_NAV_LABELS = ["Dashboard", "My Portal", "Overview", "Learning Center", "Monitoring", "Reports"];

// ─────────────────────────────────────────────────────────────
// Global CSS
// ─────────────────────────────────────────────────────────────

const GLOBAL_STYLE_ID = "da-shell-v5";
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --accent-blue:    #3b82f6;
  --accent-violet:  #8b5cf6;
  --accent-cyan:    #06b6d4;
  --accent-amber:   #f59e0b;
  --accent-rose:    #f43f5e;
  --accent-emerald: #10b981;

  --sidebar-w: ${SIDEBAR_W_COLLAPSED}px;
  --sidebar-transition: width ${DURATION_SIDEBAR} ${EASE_OUT},
                        box-shadow ${DURATION_SIDEBAR} ease,
                        opacity 160ms ease;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'Geist Mono', monospace;
  --spring: ${SPRING};
  --ease-out: ${EASE_OUT};
}

[data-theme="dark"], :root {
  --bg-base:        #080810;
  --bg-elevated:    #0f0f18;
  --bg-overlay:     #14141e;
  --bg-subtle:      rgba(255,255,255,0.035);
  --bg-subtle-hover:rgba(255,255,255,0.065);
  --border:         rgba(255,255,255,0.065);
  --border-strong:  rgba(255,255,255,0.11);
  --fg-default:     #f0f4fa;
  --fg-muted:       #5a6a80;
  --fg-subtle:      #2e3a4a;
  --sidebar-bg:     rgba(8,8,16,0.97);
  --sidebar-border: rgba(255,255,255,0.055);
  --header-bg:      rgba(8,8,14,0.90);
  --header-border:  rgba(255,255,255,0.055);
  --scrollbar:      rgba(255,255,255,0.07);
  --scrollbar-hover:rgba(255,255,255,0.14);
  --shadow-sm:      0 1px 3px rgba(0,0,0,0.5);
  --shadow-md:      0 4px 20px rgba(0,0,0,0.55);
  --shadow-lg:      0 16px 48px rgba(0,0,0,0.65);
  --shadow-sidebar: 1px 0 0 rgba(255,255,255,0.04), 10px 0 30px rgba(0,0,0,0.35);
  --glow-blue:      0 0 20px rgba(59,130,246,0.2);
}

[data-theme="light"] {
  --bg-base:        #f5f7fc;
  --bg-elevated:    #ffffff;
  --bg-overlay:     #eef1f8;
  --bg-subtle:      rgba(0,0,0,0.028);
  --bg-subtle-hover:rgba(0,0,0,0.048);
  --border:         rgba(0,0,0,0.065);
  --border-strong:  rgba(0,0,0,0.11);
  --fg-default:     #0d1829;
  --fg-muted:       #5a6a80;
  --fg-subtle:      #9faab8;
  --sidebar-bg:     rgba(250,252,255,0.98);
  --sidebar-border: rgba(0,0,0,0.055);
  --header-bg:      rgba(255,255,255,0.92);
  --header-border:  rgba(0,0,0,0.065);
  --scrollbar:      rgba(0,0,0,0.09);
  --scrollbar-hover:rgba(0,0,0,0.18);
  --shadow-sm:      0 1px 3px rgba(0,0,0,0.07);
  --shadow-md:      0 4px 20px rgba(0,0,0,0.07);
  --shadow-lg:      0 16px 48px rgba(0,0,0,0.09);
  --shadow-sidebar: 1px 0 0 rgba(0,0,0,0.06), 10px 0 30px rgba(0,0,0,0.04);
  --glow-blue:      0 0 20px rgba(59,130,246,0.12);
}

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

* { scrollbar-width: thin; scrollbar-color: var(--scrollbar) transparent; }
::-webkit-scrollbar { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }

:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
  border-radius: 6px;
}

/* ── Keyframes ───────────────────────────────────────────── */
@keyframes fadeUp    { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn    { from { opacity:0 } to { opacity:1 } }
@keyframes slideIn   { from { opacity:0; transform:translateX(-8px) } to { opacity:1; transform:translateX(0) } }
@keyframes scaleIn   { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:scale(1) } }
@keyframes spin      { to { transform:rotate(360deg) } }
@keyframes blink     { 50% { opacity:0.2 } }
@keyframes pulse     { 0%,100% { opacity:0.6 } 50% { opacity:1 } }
@keyframes ping      { 75%,100% { transform:scale(1.7); opacity:0 } }
@keyframes shimmer   { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
@keyframes progressBar { 0% { width:0% } 40% { width:60% } 70% { width:80% } 100% { width:100% } }
@keyframes cmdIn     { from { opacity:0; transform:translateY(-10px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
@keyframes routeFade { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
@keyframes badgePop  { 0% { transform:scale(0) } 60% { transform:scale(1.15) } 100% { transform:scale(1) } }
@keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
@keyframes bottomUp  { from { opacity:0; transform:translateY(100%) } to { opacity:1; transform:translateY(0) } }

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
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  transition: var(--sidebar-transition);
  overflow: hidden;
  will-change: width;
}
.da-sidebar.expanded { width: ${SIDEBAR_W_EXPANDED}px; }
@media (prefers-reduced-motion: reduce) { .da-sidebar { transition: none !important; } }

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
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent-blue) 15%, var(--bg-subtle)), color-mix(in srgb, var(--accent-violet) 10%, var(--bg-subtle)));
  border: 1px solid color-mix(in srgb, var(--accent-blue) 22%, transparent);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
}
.da-sidebar-brand {
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 140ms ease, transform 160ms ease;
  white-space: nowrap;
  overflow: hidden;
  pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-brand { opacity: 1; transform: translateX(0); pointer-events: auto; }
.da-sidebar-brand-name {
  font-size: 13px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--fg-default); line-height: 1.2;
}
.da-sidebar-brand-sub {
  font-size: 10px; font-weight: 500; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fg-muted); margin-top: 1px;
}

/* Nav rail */
.da-nav-rail {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  padding: 8px 6px;
  display: flex; flex-direction: column; gap: 1px;
}
.da-nav-section {
  display: flex; flex-direction: column; gap: 1px; margin-bottom: 2px;
}
.da-nav-section + .da-nav-section {
  padding-top: 6px; border-top: 1px solid var(--border); margin-top: 2px;
}
.da-nav-section.collapsed .da-nav-item { display: none; }

/* Section label — clickable to collapse */
.da-nav-section-label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: var(--fg-subtle);
  padding: 0 8px 4px;
  overflow: hidden; max-height: 0; opacity: 0;
  transition: max-height ${DURATION_SIDEBAR} ${EASE_OUT}, opacity 160ms ease, padding ${DURATION_SIDEBAR} ${EASE_OUT};
  cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  border-radius: 5px;
  user-select: none;
}
.da-sidebar.expanded .da-nav-section-label {
  max-height: 28px; opacity: 0.75; padding: 5px 8px 5px;
}
.da-sidebar.expanded .da-nav-section-label:hover { opacity: 1; background: var(--bg-subtle); }
.da-nav-section-label-collapse {
  width: 14px; height: 14px; display: grid; place-items: center;
  font-size: 9px; color: var(--fg-subtle); flex-shrink: 0;
  transition: transform 200ms ease, opacity 160ms ease; opacity: 0;
}
.da-sidebar.expanded .da-nav-section-label:hover .da-nav-section-label-collapse { opacity: 1; }
.da-nav-section.collapsed .da-nav-section-label-collapse { transform: rotate(-90deg); opacity: 0.6; }

/* Nav item */
.da-nav-item {
  position: relative; display: flex; align-items: center;
  height: 36px; border-radius: 9px;
  border: 1px solid transparent; background: transparent;
  color: var(--fg-muted); cursor: pointer;
  padding: 0 8px; gap: 0; overflow: hidden; white-space: nowrap;
  transition: color 120ms ease, background 100ms ease, border-color 120ms ease,
              gap ${DURATION_SIDEBAR} ${EASE_OUT}, padding ${DURATION_SIDEBAR} ${EASE_OUT};
  width: 100%; text-align: left; justify-content: center;
}
.da-sidebar.expanded .da-nav-item { gap: 9px; justify-content: flex-start; }
.da-nav-item:hover { color: var(--fg-default); background: var(--bg-subtle-hover); }
.da-nav-item.active {
  color: var(--item-accent, var(--accent-blue));
  background: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 9%, transparent);
  border-color: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 16%, transparent);
}
.da-nav-item.active:hover {
  background: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 13%, transparent);
}
.da-nav-icon {
  width: 20px; height: 20px; display: grid; place-items: center;
  flex-shrink: 0; color: inherit; position: relative;
}
.da-nav-label {
  font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; opacity: 0; max-width: 0; transform: translateX(-6px);
  transition: max-width ${DURATION_SIDEBAR} ${EASE_OUT}, opacity 150ms ease, transform ${DURATION_SIDEBAR} ${EASE_OUT};
  color: inherit; letter-spacing: -0.01em; flex: 1;
}
.da-nav-item.active .da-nav-label { font-weight: 600; }
.da-sidebar.expanded .da-nav-label { opacity: 1; max-width: 160px; transform: translateX(0); }

/* Active pip */
.da-nav-pip {
  position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; border-radius: 0 3px 3px 0;
  background: var(--item-accent, var(--accent-blue));
  height: 0; transition: height 200ms var(--spring);
  box-shadow: 0 0 8px color-mix(in srgb, var(--item-accent, var(--accent-blue)) 70%, transparent);
}
.da-nav-item.active .da-nav-pip { height: 18px; }

/* Nav badge (New / count) */
.da-nav-badge {
  display: none;
  height: 16px; padding: 0 5px; border-radius: 4px;
  font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
  background: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 12%, transparent);
  color: var(--item-accent, var(--accent-blue));
  border: 1px solid color-mix(in srgb, var(--item-accent, var(--accent-blue)) 20%, transparent);
  flex-shrink: 0; align-items: center; justify-content: center;
  animation: badgePop 250ms var(--spring) both;
  text-transform: uppercase;
}
.da-sidebar.expanded .da-nav-badge { display: flex; }

/* ── Learning Progress Widget ─────────────────────────────── */
.da-lc-widget {
  flex-shrink: 0;
  padding: 8px 6px;
  border-top: 1px solid var(--sidebar-border);
}
.da-lc-widget-inner {
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-emerald) 5%, var(--bg-subtle));
  border: 1px solid color-mix(in srgb, var(--accent-emerald) 14%, transparent);
  padding: 10px;
  display: flex; align-items: center; gap: 0;
  overflow: hidden;
  transition: gap ${DURATION_SIDEBAR} ${EASE_OUT};
  justify-content: center;
  cursor: pointer;
}
.da-sidebar.expanded .da-lc-widget-inner { gap: 9px; justify-content: flex-start; }
.da-lc-widget-ring {
  width: 32px; height: 32px; flex-shrink: 0; position: relative; display: grid; place-items: center;
}
.da-lc-widget-info {
  flex: 1; min-width: 0; opacity: 0; transform: translateX(-4px);
  transition: opacity 140ms ease, transform 160ms ease; pointer-events: none;
  overflow: hidden;
}
.da-sidebar.expanded .da-lc-widget-info { opacity: 1; transform: translateX(0); pointer-events: auto; }
.da-lc-widget-level {
  font-size: 11px; font-weight: 700; color: var(--fg-default); letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.da-lc-widget-xp {
  font-size: 10px; color: var(--accent-emerald); font-weight: 600; margin-top: 1px;
}
.da-lc-widget-streak {
  display: flex; align-items: center; gap: 3px;
  font-size: 10px; color: var(--accent-amber); font-weight: 600; margin-top: 2px;
}

/* Sidebar user */
.da-sidebar-user { padding: 8px 6px; border-top: 1px solid var(--sidebar-border); flex-shrink: 0; }
.da-sidebar-user-inner {
  display: flex; align-items: center; gap: 0; padding: 8px;
  border-radius: 9px; background: var(--bg-subtle); border: 1px solid var(--border);
  overflow: hidden;
  transition: gap ${DURATION_SIDEBAR} ${EASE_OUT}, padding ${DURATION_SIDEBAR} ${EASE_OUT};
  justify-content: center;
}
.da-sidebar.expanded .da-sidebar-user-inner { gap: 9px; justify-content: flex-start; }
.da-sidebar-avatar {
  width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center;
  font-size: 11px; font-weight: 700; flex-shrink: 0; position: relative;
}
.da-sidebar-avatar-online {
  position: absolute; bottom: -1px; right: -1px;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent-emerald); border: 1.5px solid var(--sidebar-bg);
}
.da-sidebar-avatar-online::after {
  content: ''; position: absolute; inset: -2px; border-radius: 50%;
  background: var(--accent-emerald);
  animation: ping 2s cubic-bezier(0,0,.2,1) infinite; opacity: 0.35;
}
.da-sidebar-user-info {
  flex: 1; min-width: 0; overflow: hidden;
  opacity: 0; transform: translateX(-4px);
  transition: opacity 140ms ease, transform 160ms ease; pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-user-info { opacity: 1; transform: translateX(0); pointer-events: auto; }
.da-sidebar-user-name {
  font-size: 12px; font-weight: 600; color: var(--fg-default);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -0.01em;
}
.da-sidebar-user-role {
  font-size: 10px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 1px;
}
.da-sidebar-logout {
  width: 0; height: 26px; border-radius: 6px; border: 1px solid transparent;
  background: transparent; color: var(--fg-muted);
  display: grid; place-items: center; flex-shrink: 0; overflow: hidden;
  opacity: 0; padding: 0;
  transition: opacity 140ms ease, width 180ms ease, color 120ms ease, background 120ms ease;
  pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-logout { opacity: 1; width: 26px; pointer-events: auto; }
.da-sidebar-logout:hover {
  color: var(--accent-rose);
  background: color-mix(in srgb, var(--accent-rose) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent-rose) 25%, transparent);
}

/* ── Header ──────────────────────────────────────────────── */
.da-header {
  position: fixed; top: 0;
  left: var(--sidebar-w, ${SIDEBAR_W_COLLAPSED}px);
  right: 0; z-index: 30; height: 56px;
  display: flex; align-items: center; padding: 0 20px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--header-border);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
  gap: 10px;
  transition: left ${DURATION_SIDEBAR} ${EASE_OUT};
  will-change: left;
}
.da-sidebar.expanded ~ .da-page-root .da-header { left: ${SIDEBAR_W_EXPANDED}px; }
.da-header-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.da-header-right { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }

.da-breadcrumb {
  display: flex; align-items: center; gap: 6px; font-size: 13px; overflow: hidden;
}
.da-breadcrumb-root { color: var(--fg-muted); font-weight: 400; white-space: nowrap; }
.da-breadcrumb-sep { color: var(--fg-subtle); }
.da-breadcrumb-current {
  font-weight: 600; color: var(--fg-default); letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  animation: fadeIn 180ms ease both;
}

/* Pill & icon buttons */
.da-pill-btn {
  display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
  border-radius: 8px; border: 1px solid var(--border-strong); background: var(--bg-elevated);
  color: var(--fg-muted); font-size: 12px; font-weight: 500; font-family: inherit;
  cursor: pointer; transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
  white-space: nowrap; flex-shrink: 0;
}
.da-pill-btn:hover { color: var(--fg-default); background: var(--bg-overlay); }

.da-icon-btn {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border);
  background: transparent; color: var(--fg-muted);
  display: grid; place-items: center; cursor: pointer;
  transition: color 120ms ease, background 120ms ease, border-color 120ms ease; flex-shrink: 0;
  position: relative;
}
.da-icon-btn:hover { color: var(--fg-default); background: var(--bg-subtle-hover); }
.da-icon-btn.active {
  color: var(--accent-blue);
  border-color: color-mix(in srgb, var(--accent-blue) 30%, transparent);
  background: color-mix(in srgb, var(--accent-blue) 8%, transparent);
}

/* Notification badge on icon-btn */
.da-icon-btn-badge {
  position: absolute; top: 5px; right: 5px;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent-rose); border: 1.5px solid var(--header-bg);
  animation: badgePop 300ms var(--spring) both;
}

.da-sign-out-btn {
  display: flex; align-items: center; gap: 5px; height: 32px; padding: 0 11px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent);
  background: color-mix(in srgb, var(--accent-rose) 7%, transparent);
  color: var(--accent-rose); font-size: 12px; font-weight: 600; font-family: inherit;
  cursor: pointer; transition: background 120ms ease, border-color 120ms ease;
  white-space: nowrap; flex-shrink: 0;
}
.da-sign-out-btn:hover {
  background: color-mix(in srgb, var(--accent-rose) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent-rose) 40%, transparent);
}

/* User chip */
.da-user-chip {
  display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px 0 6px;
  border-radius: 8px; border: 1px solid var(--border); background: var(--bg-subtle);
}
.da-user-chip-avatar {
  width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center;
  font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.da-user-chip-name {
  font-size: 12px; font-weight: 600; color: var(--fg-default); letter-spacing: -0.01em;
}
.da-user-chip-role {
  font-size: 10px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase;
}

.da-pin-btn { display: none; }
@media (min-width: ${COMPACT_BP}px) { .da-pin-btn { display: grid; } }

/* Divider in header */
.da-hdivider { width: 1px; height: 16px; background: var(--border); flex-shrink: 0; }

/* ── Notification Dropdown ─────────────────────────────────── */
.da-notif-wrap { position: relative; }
.da-notif-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0;
  width: 300px; background: var(--bg-elevated);
  border: 1px solid var(--border-strong); border-radius: 14px;
  box-shadow: var(--shadow-lg);
  animation: slideDown 160ms var(--spring) both;
  overflow: hidden; z-index: 200;
}
.da-notif-header {
  padding: 12px 16px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.da-notif-title { font-size: 13px; font-weight: 700; color: var(--fg-default); letter-spacing: -0.01em; }
.da-notif-mark-all { font-size: 11px; color: var(--accent-blue); cursor: pointer; font-weight: 600; background: none; border: none; padding: 0; }
.da-notif-mark-all:hover { opacity: 0.8; }
.da-notif-list { max-height: 320px; overflow-y: auto; }
.da-notif-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 11px 16px; border-bottom: 1px solid var(--border);
  cursor: pointer; transition: background 100ms ease; position: relative;
}
.da-notif-item:last-child { border-bottom: none; }
.da-notif-item:hover { background: var(--bg-subtle-hover); }
.da-notif-item.unread::before {
  content: ''; position: absolute; left: 6px; top: 50%; transform: translateY(-50%);
  width: 5px; height: 5px; border-radius: 50%; background: var(--accent-blue);
}
.da-notif-icon {
  width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center;
  font-size: 13px; flex-shrink: 0;
}
.da-notif-text { flex: 1; }
.da-notif-text-title { font-size: 12px; font-weight: 600; color: var(--fg-default); line-height: 1.4; }
.da-notif-text-sub { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }
.da-notif-time { font-size: 10px; color: var(--fg-subtle); flex-shrink: 0; margin-top: 2px; }
.da-notif-empty { padding: 28px 16px; text-align: center; color: var(--fg-muted); font-size: 12px; }

/* ── Page root ───────────────────────────────────────────── */
.da-page-root {
  flex: 1; min-width: 0;
  margin-left: var(--sidebar-w, ${SIDEBAR_W_COLLAPSED}px);
  padding-top: 56px;
  transition: margin-left ${DURATION_SIDEBAR} ${EASE_OUT};
  will-change: margin-left;
}
.da-sidebar.expanded ~ .da-page-root { margin-left: ${SIDEBAR_W_EXPANDED}px; }

/* ── Route transition ────────────────────────────────────── */
.da-content {
  padding: 24px;
  min-height: calc(100vh - 56px);
}
.da-route-fade { animation: routeFade 220ms ${EASE_OUT} both; }
@media (max-width: ${COMPACT_BP - 1}px) { .da-content { padding: 16px 16px 80px; } }

/* ── Progress bar (top) ──────────────────────────────────── */
.da-progress-bar {
  position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 9999;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-violet), var(--accent-cyan));
  animation: progressBar 2.4s ${EASE_OUT} forwards; transform-origin: left;
}

/* ── Keyboard Shortcuts Modal ────────────────────────────── */
.da-shortcuts-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(5px);
  animation: fadeIn 120ms ease both;
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.da-shortcuts-card {
  width: min(540px, 100%); background: var(--bg-elevated);
  border: 1px solid var(--border-strong); border-radius: 18px;
  box-shadow: var(--shadow-lg); overflow: hidden;
  animation: scaleIn 200ms var(--spring) both;
}
.da-shortcuts-header {
  padding: 20px 24px; border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.da-shortcuts-body { padding: 16px 24px 20px; display: flex; flex-direction: column; gap: 6px; }
.da-shortcuts-section { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-muted); margin: 10px 0 6px; }
.da-shortcut-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 0; border-bottom: 1px solid var(--border);
}
.da-shortcut-row:last-child { border-bottom: none; }
.da-shortcut-desc { font-size: 13px; color: var(--fg-default); font-weight: 500; }
.da-shortcut-keys { display: flex; gap: 4px; align-items: center; }
.da-key {
  font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--fg-muted);
  background: var(--bg-subtle); border: 1px solid var(--border-strong);
  border-radius: 5px; padding: 2px 7px; line-height: 1.5;
}

/* ── Bottom Tab Bar (mobile) ─────────────────────────────── */
.da-bottom-nav {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  height: 64px; padding: 0 4px;
  background: var(--sidebar-bg); border-top: 1px solid var(--sidebar-border);
  backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
  align-items: center; justify-content: space-around;
  animation: bottomUp 280ms var(--spring) both;
}
@media (max-width: ${BOTTOM_NAV_BP}px) { .da-bottom-nav { display: flex; } }
.da-bottom-nav-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; height: 100%; border: none; background: transparent;
  color: var(--fg-muted); font-family: inherit; cursor: pointer;
  transition: color 120ms ease; position: relative; padding: 8px 4px; border-radius: 8px;
  min-width: 0;
}
.da-bottom-nav-item.active { color: var(--accent-blue); }
.da-bottom-nav-item:hover { color: var(--fg-default); }
.da-bottom-nav-icon { font-size: 18px; line-height: 1; }
.da-bottom-nav-label { font-size: 9px; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.da-bottom-nav-pip {
  position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
  width: 18px; height: 3px; border-radius: 999px; background: var(--accent-blue);
  opacity: 0; transition: opacity 150ms ease;
}
.da-bottom-nav-item.active .da-bottom-nav-pip { opacity: 1; }

/* ── Command Palette ─────────────────────────────────────── */
.da-cmd-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);
  animation: fadeIn 120ms ease both;
  display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh;
}
.da-cmd-palette {
  width: min(600px, 94vw); border-radius: 16px;
  border: 1px solid var(--border-strong); background: var(--bg-overlay);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.03);
  overflow: hidden; animation: cmdIn 160ms var(--spring) both;
}
.da-cmd-input-wrap {
  display: flex; align-items: center; gap: 10px; padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.da-cmd-input {
  flex: 1; background: transparent; border: none; outline: none;
  font-size: 15px; font-weight: 400; font-family: inherit;
  color: var(--fg-default); letter-spacing: -0.01em;
}
.da-cmd-input::placeholder { color: var(--fg-muted); }
.da-cmd-results { max-height: 380px; overflow-y: auto; padding: 6px; }
.da-cmd-section-label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--fg-subtle); padding: 8px 10px 4px;
}
.da-cmd-item {
  display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 10px;
  border-radius: 9px; cursor: pointer; transition: background 80ms ease;
  border: 1px solid transparent;
}
.da-cmd-item:hover, .da-cmd-item.selected { background: var(--bg-subtle-hover); border-color: var(--border); }
.da-cmd-item-icon {
  width: 28px; height: 28px; border-radius: 8px;
  display: grid; place-items: center; flex-shrink: 0; font-size: 13px;
}
.da-cmd-item-label { flex: 1; font-size: 13px; font-weight: 500; color: var(--fg-default); letter-spacing: -0.01em; }
.da-cmd-item-group { font-size: 11px; color: var(--fg-muted); }
.da-cmd-item-recent { font-size: 10px; color: var(--fg-subtle); }
.da-cmd-shortcut {
  font-size: 11px; font-family: var(--font-mono); color: var(--fg-muted);
  background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px;
}
.da-cmd-empty { padding: 32px 16px; text-align: center; color: var(--fg-muted); font-size: 13px; }
.da-cmd-footer {
  display: flex; align-items: center; gap: 12px; padding: 8px 14px;
  border-top: 1px solid var(--border); font-size: 11px;
  color: var(--fg-subtle); font-family: var(--font-mono);
}
.da-cmd-footer kbd {
  font-family: var(--font-mono); font-size: 10px;
  background: var(--bg-subtle); border: 1px solid var(--border-strong);
  border-radius: 4px; padding: 1px 5px; color: var(--fg-muted);
}

/* ── Loader ──────────────────────────────────────────────── */
.da-loader-shell {
  position: fixed; inset: 0; display: grid; place-items: center;
  background: var(--bg-base); z-index: 9999; animation: fadeIn 200ms ease;
}
.da-loader-card {
  display: flex; align-items: center; gap: 28px; padding: 32px 36px;
  border-radius: 22px; border: 1px solid var(--border-strong);
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--bg-elevated) 94%, transparent),
    color-mix(in srgb, var(--bg-overlay) 86%, transparent)
  );
  box-shadow: var(--shadow-lg); animation: scaleIn 300ms var(--spring) both;
  min-width: min(580px, calc(100vw - 36px));
}
.da-loader-visual {
  position: relative; width: 120px; height: 120px; flex-shrink: 0;
  display: grid; place-items: center;
  filter: drop-shadow(0 14px 26px rgba(0,0,0,0.45));
}
.da-loader-visual::before {
  content: ''; position: absolute; inset: 14px; border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent-blue) 20%, transparent) 0%, transparent 72%);
  filter: blur(10px); opacity: 0.9;
}
.da-loader-disc-spin { position: absolute; inset: 0; animation: spin 1.15s linear infinite; will-change: transform; }
.da-loader-svg { width: 100%; height: 100%; display: block; overflow: visible; }
.da-loader-caliper { position: absolute; inset: 0; pointer-events: none; }
.da-loader-copy { min-width: 0; }
.da-loader-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-blue); margin-bottom: 5px; }
.da-loader-headline { font-size: 21px; font-weight: 700; color: var(--fg-default); letter-spacing: -0.025em; }
.da-loader-sub { font-size: 13px; color: var(--fg-muted); margin-top: 6px; line-height: 1.55; max-width: 360px; }
.da-loader-bar { height: 3px; margin-top: 18px; border-radius: 999px; background: var(--border); overflow: hidden; width: min(280px, 100%); }
.da-loader-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent-blue), var(--accent-violet), var(--accent-cyan)); background-size: 200%; animation: shimmer 1.5s linear infinite; }
@media (max-width: 640px) {
  .da-loader-card { min-width: 0; width: calc(100vw - 24px); flex-direction: column; align-items: flex-start; padding: 24px; }
  .da-loader-visual { width: 104px; height: 104px; }
  .da-loader-bar { width: 100%; }
}

/* ── Profile panel ───────────────────────────────────────── */
.da-profile-panel { max-width: 600px; padding: 32px; border-radius: 16px; background: var(--bg-elevated); border: 1px solid var(--border); animation: fadeUp 220ms var(--ease-out) both; }
.da-profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; }
@media (max-width: 500px) { .da-profile-grid { grid-template-columns: 1fr; } }
.da-profile-field { padding: 12px 16px; border-radius: 10px; background: var(--bg-subtle); border: 1px solid var(--border); }
.da-profile-field-label { font-size: 10px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fg-muted); margin-bottom: 4px; }
.da-profile-field-value { font-size: 13px; font-weight: 500; color: var(--fg-default); letter-spacing: -0.01em; }

/* ── Error card ──────────────────────────────────────────── */
.da-error-card {
  max-width: 420px; padding: 36px; border-radius: 18px; background: var(--bg-elevated);
  border: 1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent); text-align: center;
  animation: scaleIn 280ms var(--spring) both;
}

/* ── Clock ───────────────────────────────────────────────── */
.da-clock {
  font-family: var(--font-mono); font-size: 12px; font-weight: 400;
  color: var(--fg-muted); letter-spacing: 0.05em; user-select: none;
  display: flex; align-items: center; gap: 1px;
}
.da-clock-colon { animation: blink 1s step-end infinite; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }

/* ── Compact header compact nav (>768 <1024) ──────────────── */
.da-compact-nav {
  position: sticky; top: 56px; z-index: 20;
  display: flex; gap: 2px; padding: 8px 16px; overflow-x: auto;
  border-bottom: 1px solid var(--border); background: var(--header-bg);
  backdrop-filter: blur(16px); scrollbar-width: none;
}
.da-compact-nav::-webkit-scrollbar { display: none; }
@media (max-width: ${BOTTOM_NAV_BP}px) { .da-compact-nav { display: none; } }
.da-compact-nav-item {
  display: flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px;
  border-radius: 7px; border: 1px solid transparent; background: transparent;
  color: var(--fg-muted); font-size: 12px; font-weight: 500; font-family: inherit;
  cursor: pointer; white-space: nowrap; transition: all 120ms ease; flex-shrink: 0;
}
.da-compact-nav-item:hover { color: var(--fg-default); background: var(--bg-subtle-hover); }
.da-compact-nav-item.active {
  color: var(--item-accent, var(--accent-blue));
  background: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 10%, transparent);
  border-color: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 20%, transparent);
  font-weight: 600;
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
    return () => { document.getElementById(GLOBAL_STYLE_ID)?.remove(); injected.current = false; };
  }, []);
}

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try { return readStoredTheme(); }
    catch { return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
  });
  useEffect(() => {
    try { window.localStorage.setItem("da-theme", mode); } catch {}
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode === "light" ? "light" : "dark";
    applyThemeCssVariables(mode);
  }, [mode]);
  const toggle = useCallback(() => setMode((p) => (p === "light" ? "dark" : "light")), []);
  return { mode, toggle } as const;
}

function useViewportWidth() {
  const [w, setW] = useState(() => typeof window === "undefined" ? 1440 : window.innerWidth);
  useEffect(() => {
    let raf: number;
    const handler = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setW(window.innerWidth)); };
    window.addEventListener("resize", handler);
    return () => { window.removeEventListener("resize", handler); cancelAnimationFrame(raf); };
  }, []);
  return w;
}

/** Reads the LearningCenter's progress from localStorage for the mini sidebar widget */
function useLearningProgress(userId: string | null | undefined): MiniProgress {
  const [progress, setProgress] = useState<MiniProgress>({ xp: 0, level: 0, streak: 0, completedModules: 0 });
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(`da-lc:progress:${userId}`);
      if (raw) {
        const data = JSON.parse(raw);
        setProgress({
          xp:               data.xp               ?? 0,
          level:            data.level             ?? 0,
          streak:           data.streak            ?? 0,
          completedModules: data.completedModules?.length ?? 0,
        });
      }
    } catch {}
  }, [userId]);
  return progress;
}

/** Tracks the last N visited pages */
function useRecentPages(navItems: readonly NavItem[], currentPath: string): RecentPage[] {
  const [recent, setRecent] = useState<RecentPage[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_PAGES_KEY) ?? "[]"); }
    catch { return []; }
  });
  useEffect(() => {
    const item = navItems.find((i) => i.path === currentPath);
    if (!item) return;
    setRecent((prev) => {
      const filtered = prev.filter((r) => r.path !== currentPath);
      const next: RecentPage[] = [
        { path: currentPath, label: item.label, group: item.group, visitedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT_PAGES);
      try { localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [currentPath, navItems]);
  return recent;
}

/** Persists which sidebar groups are collapsed */
function useCollapsedGroups(): [Set<string>, (group: string) => void] {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_GROUPS_KEY) ?? "[]")); }
    catch { return new Set(); }
  });
  const toggle = useCallback((group: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      try { localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }, []);
  return [collapsed, toggle];
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

function getActiveRouteLabel(pathname: string, items: readonly NavItem[]): string {
  return items.find((i) => i.path === pathname)?.label ?? "Workspace";
}

function getUserInitials(profile: UserProfile): string {
  const name = profile.display_name || profile.agent_name || profile.email || "?";
  const parts = name.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function buildNavItems(profile: UserProfile): NavItem[] {
  const isAdmin     = profile.role === "admin";
  const isStaff     = isAdmin || profile.role === "qa";
  const isSupervisor = profile.role === "supervisor";

  const item = (path: RoutePath, label: string, extra?: Partial<NavItem>): NavItem => ({
    path, label, group: getNavGroup(label),
    shortcut: NAV_SHORTCUTS[label], ...extra,
  });

  if (isSupervisor) {
    return [
      item(ROUTES.supervisorOverview, "Overview"),
      item(ROUTES.supervisorTeamDashboard, "Team Dashboard"),
      item(ROUTES.supervisorRequestsView, "Supervisor Requests"),
      item(ROUTES.learningCenter, "Learning Center", { isNew: true }),
      item(ROUTES.supervisorProfile, "My Supervisor Profile"),
    ];
  }

  if (!isStaff) {
    return [
      item(ROUTES.agentPortal, "My Portal"),
      item(ROUTES.learningCenter, "Learning Center", { isNew: true }),
    ];
  }

  const items: NavItem[] = [
    item(ROUTES.dashboard,       "Dashboard"),
    item(ROUTES.newAudit,        "New Audit"),
    item(ROUTES.auditsUpload,    "Audits Upload"),
    item(ROUTES.auditsList,      "Audits List"),
    item(ROUTES.callsUpload,     "Calls Upload"),
    item(ROUTES.ticketsUpload,   "Tickets Upload"),
    item(ROUTES.ticketEvidence,  "Ticket Evidence"),
    item(ROUTES.ticketAiReview,  "Ticket AI Review"),
    item(ROUTES.salesUpload,     "Sales Upload"),
    item(ROUTES.agentFeedback,   "Agent Feedback"),
    item(ROUTES.monitoring,      "Monitoring"),
    item(ROUTES.teamHeatmap,     "Team Heatmap"),
    item(ROUTES.learningCenter,  "Learning Center", { isNew: true }),
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

// ─────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────

type IconProps = { size?: number };

const SearchIcon = memo(function SearchIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
});

const SunIcon = memo(function SunIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
});

const MoonIcon = memo(function MoonIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
});

const LogOutIcon = memo(function LogOutIcon({ size = 13 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
});

const MenuIcon = memo(function MenuIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
});

const BellIcon = memo(function BellIcon({ size = 15 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
});

const KeyboardIcon = memo(function KeyboardIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M6 17h12" />
    </svg>
  );
});

const NavIcon = memo(function NavIcon({ label, size = 15 }: { label: string; size?: number }) {
  const p = {
    width: size, height: size, viewBox: "0 0 24 24" as const, fill: "none" as const,
    stroke: "currentColor" as const, strokeWidth: 1.6,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  const icons: Record<string, ReactNode> = {
    Dashboard: <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>,
    "New Audit": <svg {...p}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>,
    "Audits Upload": <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
    "Audits List": <svg {...p}><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none" /></svg>,
    "Calls Upload": <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.93 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
    "Tickets Upload": <svg {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>,
    "Ticket Evidence": <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    "Ticket AI Review": <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
    "Sales Upload": <svg {...p}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    "Agent Feedback": <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    Monitoring: <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    "Team Heatmap": <svg {...p}><rect x="3" y="3" width="4" height="4" rx="0.7" /><rect x="10" y="3" width="4" height="4" rx="0.7" /><rect x="17" y="3" width="4" height="4" rx="0.7" /><rect x="3" y="10" width="4" height="4" rx="0.7" /><rect x="10" y="10" width="4" height="4" rx="0.7" /><rect x="17" y="10" width="4" height="4" rx="0.7" /><rect x="3" y="17" width="4" height="4" rx="0.7" /><rect x="10" y="17" width="4" height="4" rx="0.7" /><rect x="17" y="17" width="4" height="4" rx="0.7" /></svg>,
    Accounts: <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    "Supervisor Requests": <svg {...p}><polyline points="17 11 21 7 17 3" /><line x1="21" y1="7" x2="9" y2="7" /><polyline points="7 21 3 17 7 13" /><line x1="15" y1="17" x2="3" y2="17" /></svg>,
    Reports: <svg {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
    "My Admin Profile": <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    "My QA Profile": <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    Overview: <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
    "Team Dashboard": <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>,
    "My Supervisor Profile": <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    "Learning Center": <svg {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="14" y2="11" /></svg>,
    "Support Inbox": <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8" /><path d="M8 13h5" /></svg>,
    "Help Admin": <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 1v4" /><path d="M12 19v4" /><path d="M4.22 4.22l2.83 2.83" /><path d="M16.95 16.95l2.83 2.83" /><path d="M1 12h4" /><path d="M19 12h4" /><path d="M4.22 19.78l2.83-2.83" /><path d="M16.95 7.05l2.83-2.83" /></svg>,
    "My Portal": <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
    Help: <svg {...p}><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 1 1 5.8 1c-.5 1.4-2.4 2-2.7 3.5" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  };
  return icons[label] ?? <svg {...p}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></svg>;
});

// nav icons for bottom bar
const NAV_ICONS_EMOJI: Record<string, string> = {
  Dashboard: "⬛", "My Portal": "👤", Overview: "🏠", "Learning Center": "📚",
  Monitoring: "📈", Reports: "📊", "New Audit": "➕", "Audits List": "📋",
  Accounts: "👥", "Team Dashboard": "📊", Help: "❓",
};

// ─────────────────────────────────────────────────────────────
// LiveClock
// ─────────────────────────────────────────────────────────────

const LiveClock = memo(function LiveClock() {
  const hhRef = useRef<HTMLSpanElement>(null);
  const mmRef = useRef<HTMLSpanElement>(null);
  const ssRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      if (hhRef.current) hhRef.current.textContent = now.getHours().toString().padStart(2, "0");
      if (mmRef.current) mmRef.current.textContent = now.getMinutes().toString().padStart(2, "0");
      if (ssRef.current) ssRef.current.textContent = now.getSeconds().toString().padStart(2, "0");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="da-clock">
      <span ref={hhRef} /><span className="da-clock-colon">:</span>
      <span ref={mmRef} /><span className="da-clock-colon" style={{ animationDelay: "0.5s" }}>:</span>
      <span ref={ssRef} style={{ opacity: 0.5 }} />
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Learning Progress Ring (sidebar widget)
// ─────────────────────────────────────────────────────────────

const LearningProgressRing = memo(function LearningProgressRing({ pct, level, size = 32, stroke = 3 }: { pct: number; level: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)] ?? "var(--accent-emerald)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${circ * Math.max(0, Math.min(pct, 100)) / 100} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.16,1,0.3,1)" }} />
    </svg>
  );
});

// ─────────────────────────────────────────────────────────────
// Notification Center
// ─────────────────────────────────────────────────────────────

interface NotificationItem {
  id: string;
  icon: string;
  title: string;
  sub: string;
  time: string;
  unread: boolean;
  color: string;
}

// Static notifications — in production these would come from Supabase realtime
const DEMO_NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", icon: "📚", title: "New training assigned", sub: "Supervisor assigned Return Label Fundamentals", time: "5m ago", unread: true, color: "color-mix(in srgb,var(--accent-blue) 12%,transparent)" },
  { id: "n2", icon: "🏆", title: "Quiz score improved!", sub: "You scored 94% on QA Foundations", time: "1h ago", unread: true, color: "color-mix(in srgb,var(--accent-amber) 12%,transparent)" },
  { id: "n3", icon: "🔥", title: "5-day learning streak!", sub: "Keep up the momentum", time: "2h ago", unread: false, color: "color-mix(in srgb,var(--accent-rose) 12%,transparent)" },
];

const NotificationCenter = memo(function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(DEMO_NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.unread).length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, []);

  return (
    <div className="da-notif-wrap" ref={ref}>
      <button
        type="button"
        className={`da-icon-btn${open ? " active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        title="Notifications"
      >
        <BellIcon size={15} />
        {unreadCount > 0 && <div className="da-icon-btn-badge" />}
      </button>

      {open && (
        <div className="da-notif-dropdown">
          <div className="da-notif-header">
            <span className="da-notif-title">Notifications</span>
            {unreadCount > 0 && (
              <button className="da-notif-mark-all" onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          <div className="da-notif-list">
            {notifications.length === 0 ? (
              <div className="da-notif-empty">No notifications</div>
            ) : notifications.map((n) => (
              <div
                key={n.id}
                className={`da-notif-item${n.unread ? " unread" : ""}`}
                onClick={() => setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, unread: false } : item))}
              >
                <div className="da-notif-icon" style={{ background: n.color, fontSize: 14 }}>{n.icon}</div>
                <div className="da-notif-text">
                  <div className="da-notif-text-title">{n.title}</div>
                  <div className="da-notif-text-sub">{n.sub}</div>
                </div>
                <div className="da-notif-time">{n.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Keyboard Shortcuts Modal
// ─────────────────────────────────────────────────────────────

const SHORTCUTS = [
  { section: "Navigation", items: [
    { desc: "Open command palette", keys: ["⌘", "K"] },
    { desc: "Open help center",     keys: ["⌘", "/"] },
    { desc: "Keyboard shortcuts",   keys: ["?"] },
    { desc: "Close / go back",      keys: ["Esc"] },
  ]},
  { section: "Pages (press G, then…)", items: [
    { desc: "Go to Dashboard",      keys: ["G", "D"] },
    { desc: "Go to New Audit",      keys: ["G", "N"] },
    { desc: "Go to Reports",        keys: ["G", "R"] },
    { desc: "Go to Learning Center",keys: ["G", "E"] },
    { desc: "Go to Monitoring",     keys: ["G", "M"] },
  ]},
  { section: "General", items: [
    { desc: "Toggle theme",         keys: ["⌘", "⇧", "T"] },
    { desc: "Pin / unpin sidebar",  keys: ["⌘", "\\"] },
  ]},
];

const ShortcutsModal = memo(function ShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="da-shortcuts-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="da-shortcuts-card">
        <div className="da-shortcuts-header">
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--fg-default)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8 }}>
              <KeyboardIcon size={16} /> Keyboard Shortcuts
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 3 }}>Press Esc to close</div>
          </div>
          <button
            type="button" onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--fg-muted)", cursor: "pointer", fontSize: 13, display: "grid", placeItems: "center" }}
          >✕</button>
        </div>
        <div className="da-shortcuts-body">
          {SHORTCUTS.map((section) => (
            <div key={section.section}>
              <div className="da-shortcuts-section">{section.section}</div>
              {section.items.map((item) => (
                <div key={item.desc} className="da-shortcut-row">
                  <span className="da-shortcut-desc">{item.desc}</span>
                  <div className="da-shortcut-keys">{item.keys.map((k) => <span key={k} className="da-key">{k}</span>)}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Command Palette (enhanced with recent pages)
// ─────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  items: readonly NavItem[];
  recentPages: RecentPage[];
  onNavigate: (path: RoutePath) => void;
  onClose: () => void;
}

const CommandPalette = memo(function CommandPalette({ items, recentPages, onNavigate, onClose }: CommandPaletteProps) {
  const [query, setQuery]     = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)
    );
  }, [query, items]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")    { onClose(); }
      if (e.key === "ArrowDown") setSelected((s) => Math.min(s + 1, filtered.length - 1));
      if (e.key === "ArrowUp")   setSelected((s) => Math.max(s - 1, 0));
      if (e.key === "Enter" && filtered[selected]) { onNavigate(filtered[selected].path); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selected, onNavigate, onClose]);

  const showRecent = !query.trim() && recentPages.length > 0;

  return (
    <div className="da-cmd-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="da-cmd-palette" role="dialog" aria-label="Command palette">
        <div className="da-cmd-input-wrap">
          <SearchIcon size={16} />
          <input
            ref={inputRef} className="da-cmd-input"
            placeholder="Search pages, navigate…"
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Command input"
          />
          <kbd style={{ fontFamily: "var(--font-mono)", fontSize: "10px", background: "var(--bg-subtle)", border: "1px solid var(--border-strong)", borderRadius: "4px", padding: "2px 6px", color: "var(--fg-muted)", flexShrink: 0 }}>ESC</kbd>
        </div>

        <div className="da-cmd-results" role="listbox">
          {/* Recent pages */}
          {showRecent && (
            <>
              <div className="da-cmd-section-label">Recent</div>
              {recentPages.map((page) => (
                <div
                  key={page.path} className="da-cmd-item"
                  onClick={() => { onNavigate(page.path as RoutePath); onClose(); }}
                >
                  <div className="da-cmd-item-icon" style={{ background: `color-mix(in srgb, ${GROUP_ACCENT[page.group] ?? "var(--accent-blue)"} 10%, transparent)`, color: GROUP_ACCENT[page.group] ?? "var(--accent-blue)" }}>
                    <NavIcon label={page.label} size={13} />
                  </div>
                  <span className="da-cmd-item-label">{page.label}</span>
                  <span className="da-cmd-item-recent">recent</span>
                </div>
              ))}
              <div className="da-cmd-section-label" style={{ marginTop: 4 }}>All Pages</div>
            </>
          )}

          {filtered.length === 0 ? (
            <div className="da-cmd-empty">No results for "{query}"</div>
          ) : (
            filtered.map((item, idx) => (
              <div
                key={item.path} role="option" aria-selected={idx === selected}
                className={`da-cmd-item${idx === selected ? " selected" : ""}`}
                onClick={() => { onNavigate(item.path); onClose(); }}
                onMouseEnter={() => setSelected(idx)}
                style={{ "--item-accent": GROUP_ACCENT[item.group] ?? "var(--accent-blue)" } as CSSProperties}
              >
                <div className="da-cmd-item-icon" style={{ background: `color-mix(in srgb, ${GROUP_ACCENT[item.group] ?? "var(--accent-blue)"} 12%, transparent)`, color: GROUP_ACCENT[item.group] ?? "var(--accent-blue)" }}>
                  <NavIcon label={item.label} size={14} />
                </div>
                <span className="da-cmd-item-label">{item.label}</span>
                <span className="da-cmd-item-group">{item.group}</span>
                {item.shortcut && <span className="da-cmd-shortcut">{item.shortcut}</span>}
              </div>
            ))
          )}
        </div>

        <div className="da-cmd-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> go</span>
          <span><kbd>esc</kbd> close</span>
          <span style={{ marginLeft: "auto" }}><kbd>?</kbd> shortcuts</span>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Mobile Bottom Tab Bar
// ─────────────────────────────────────────────────────────────

const BottomNav = memo(function BottomNav({ navItems, activePath, onNavigate, onOpenHelp }: {
  navItems: readonly NavItem[];
  activePath: string;
  onNavigate: (path: RoutePath) => void;
  onOpenHelp: () => void;
}) {
  const bottomItems = useMemo(() => {
    const preferred = navItems.filter((i) => BOTTOM_NAV_LABELS.includes(i.label)).slice(0, 4);
    const rest = navItems.filter((i) => !BOTTOM_NAV_LABELS.includes(i.label) && preferred.length < 4);
    return [...preferred, ...rest].slice(0, 4);
  }, [navItems]);

  return (
    <div className="da-bottom-nav">
      {bottomItems.map((item) => {
        const isActive = activePath === item.path;
        return (
          <button
            key={item.path} type="button"
            className={`da-bottom-nav-item${isActive ? " active" : ""}`}
            onClick={() => onNavigate(item.path)}
            aria-current={isActive ? "page" : undefined}
          >
            <div className="da-bottom-nav-icon">
              <NavIcon label={item.label} size={20} />
            </div>
            <div className="da-bottom-nav-label">{item.label.split(" ")[0]}</div>
            <div className="da-bottom-nav-pip" />
          </button>
        );
      })}
      <button type="button" className="da-bottom-nav-item" onClick={onOpenHelp} aria-label="Help">
        <div className="da-bottom-nav-icon"><NavIcon label="Help" size={20} /></div>
        <div className="da-bottom-nav-label">Help</div>
      </button>
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
  collapsedGroups: Set<string>;
  onToggleGroup: (group: string) => void;
  profile: UserProfile;
  userInitials: string;
  learningProgress: MiniProgress;
  onNavigate: (path: RoutePath) => void;
  onExpand: () => void;
  onCollapse: () => void;
  onLogout: () => void;
  onOpenHelp: () => void;
  onGoToLearning: () => void;
}

const Sidebar = memo(function Sidebar({
  navGroupsOrdered, activePath, isExpanded, collapsedGroups, onToggleGroup,
  profile, userInitials, learningProgress,
  onNavigate, onExpand, onCollapse, onLogout, onOpenHelp, onGoToLearning,
}: SidebarProps) {
  const name = profile.display_name || profile.agent_name || profile.email || "";
  const roleColor = ROLE_COLORS[profile.role || "qa"] || "var(--fg-muted)";
  const levelColor = LEVEL_COLORS[Math.min(learningProgress.level, LEVEL_COLORS.length - 1)] ?? "var(--accent-emerald)";
  const levelPct = useMemo(() => {
    const cur  = LEVEL_THRESHOLDS[learningProgress.level]     ?? 0;
    const next = LEVEL_THRESHOLDS[learningProgress.level + 1] ?? cur + 1000;
    return Math.round(((learningProgress.xp - cur) / (next - cur)) * 100);
  }, [learningProgress]);

  return (
    <nav
      className={`da-sidebar${isExpanded ? " expanded" : ""}`}
      onMouseEnter={onExpand} onMouseLeave={onCollapse}
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className="da-sidebar-header">
        <div className="da-sidebar-logo">
          <img src={LOGO_MARK_SRC} alt="" width={24} height={24} style={{ objectFit: "contain", display: "block" }} />
        </div>
        <div className="da-sidebar-brand">
          <div className="da-sidebar-brand-name">Detroit Axle</div>
          <div className="da-sidebar-brand-sub">QA Platform</div>
        </div>
      </div>

      {/* Nav */}
      <div className="da-nav-rail">
        {navGroupsOrdered.map(([group, groupItems]) => {
          const accent    = GROUP_ACCENT[group] || "var(--fg-subtle)";
          const isCollapsed = collapsedGroups.has(group);
          return (
            <div key={group} className={`da-nav-section${isCollapsed ? " collapsed" : ""}`}>
              <div
                className="da-nav-section-label"
                style={{ color: accent }}
                onClick={() => onToggleGroup(group)}
                role="button"
                tabIndex={-1}
                aria-expanded={!isCollapsed}
              >
                <span>{group}</span>
                <span className="da-nav-section-label-collapse">›</span>
              </div>
              {groupItems.map((item) => {
                const itemAccent = GROUP_ACCENT[item.group] || "var(--accent-blue)";
                const isActive   = activePath === item.path;
                return (
                  <button
                    key={item.path} type="button"
                    className={`da-nav-item${isActive ? " active" : ""}`}
                    onClick={() => onNavigate(item.path)}
                    aria-current={isActive ? "page" : undefined}
                    title={item.label}
                    style={{ "--item-accent": itemAccent } as CSSProperties}
                  >
                    <div className="da-nav-pip" />
                    <span className="da-nav-icon">
                      <NavIcon label={item.label} size={15} />
                    </span>
                    <span className="da-nav-label">{item.label}</span>
                    {item.isNew && (
                      <span className="da-nav-badge" style={{ "--item-accent": "var(--accent-emerald)" } as CSSProperties}>New</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* Support section */}
        <div className="da-nav-section" style={{ marginTop: "auto" }}>
          <div className="da-nav-section-label" style={{ color: "var(--accent-blue)" }}>Support</div>
          <button
            type="button" className="da-nav-item" onClick={onOpenHelp}
            title="Help" aria-label="Open Help Center"
            style={{ "--item-accent": "var(--accent-blue)" } as CSSProperties}
          >
            <div className="da-nav-pip" />
            <span className="da-nav-icon"><NavIcon label="Help" size={15} /></span>
            <span className="da-nav-label">Help</span>
          </button>
        </div>
      </div>

      {/* Learning Progress Widget */}
      {learningProgress.xp > 0 && (
        <div className="da-lc-widget">
          <div className="da-lc-widget-inner" onClick={onGoToLearning} title="Your learning progress">
            <div className="da-lc-widget-ring">
              <LearningProgressRing pct={levelPct} level={learningProgress.level} />
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 800, color: levelColor }}>
                {learningProgress.level}
              </div>
            </div>
            <div className="da-lc-widget-info">
              <div className="da-lc-widget-level">{LEVEL_NAMES[learningProgress.level] ?? "Rookie"}</div>
              <div className="da-lc-widget-xp">{learningProgress.xp.toLocaleString()} XP · {learningProgress.completedModules} modules</div>
              {learningProgress.streak > 1 && (
                <div className="da-lc-widget-streak">🔥 {learningProgress.streak}-day streak</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User */}
      <div className="da-sidebar-user">
        <div className="da-sidebar-user-inner">
          <div className="da-sidebar-avatar" style={{ background: `color-mix(in srgb, ${roleColor} 15%, transparent)`, border: `1.5px solid color-mix(in srgb, ${roleColor} 30%, transparent)`, color: roleColor }}>
            {userInitials}
            <div className="da-sidebar-avatar-online" />
          </div>
          <div className="da-sidebar-user-info">
            <div className="da-sidebar-user-name">{name}</div>
            <div className="da-sidebar-user-role" style={{ color: roleColor }}>{profile.role}</div>
          </div>
          <button type="button" className="da-sidebar-logout" onClick={onLogout} title="Sign out" aria-label="Sign out">
            <LogOutIcon size={13} />
          </button>
        </div>
      </div>
    </nav>
  );
},
(prev, next) =>
  prev.activePath       === next.activePath &&
  prev.isExpanded       === next.isExpanded &&
  prev.collapsedGroups  === next.collapsedGroups &&
  prev.navGroupsOrdered === next.navGroupsOrdered &&
  prev.profile          === next.profile &&
  prev.userInitials     === next.userInitials &&
  prev.learningProgress === next.learningProgress &&
  prev.onNavigate       === next.onNavigate &&
  prev.onExpand         === next.onExpand &&
  prev.onCollapse       === next.onCollapse &&
  prev.onLogout         === next.onLogout &&
  prev.onOpenHelp       === next.onOpenHelp &&
  prev.onGoToLearning   === next.onGoToLearning &&
  prev.onToggleGroup    === next.onToggleGroup
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
  onOpenShortcuts: () => void;
  onLogout: () => void;
}

const Header = memo(function Header({
  isCompact, hasSidebar, isSidebarPinned, activeLabel, profile, userInitials,
  themeMode, onToggleSidebarPin, onToggleTheme, onOpenCmd, onOpenShortcuts, onLogout,
}: HeaderProps) {
  const isDark    = themeMode === "dark";
  const roleColor = ROLE_COLORS[profile.role || "qa"] || "var(--fg-muted)";
  const profileLabel = profile.display_name || profile.agent_name || profile.email || "";

  return (
    <header className="da-header">
      <div className="da-header-left">
        {hasSidebar && !isCompact && (
          <button
            type="button"
            className={`da-icon-btn da-pin-btn${isSidebarPinned ? " active" : ""}`}
            onClick={onToggleSidebarPin}
            aria-label={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
            title={isSidebarPinned ? "Unpin sidebar (⌘\\)" : "Pin sidebar (⌘\\)"}
          >
            <MenuIcon size={15} />
          </button>
        )}

        {!isCompact && hasSidebar && (
          <>
            <div className="da-hdivider" />
            <nav className="da-breadcrumb" aria-label="Breadcrumb">
              <span className="da-breadcrumb-root">Workspace</span>
              <span className="da-breadcrumb-sep">›</span>
              <span key={activeLabel} className="da-breadcrumb-current">{activeLabel}</span>
            </nav>
          </>
        )}

        {isCompact && (
          <img src={LOGO_WORDMARK_SRC} alt="Detroit Axle" height={28} style={{ objectFit: "contain", display: "block" }} />
        )}
      </div>

      <div className="da-header-right">
        {!isCompact && <LiveClock />}
        {!isCompact && <div className="da-hdivider" />}

        {/* ⌘K Search */}
        <button type="button" className="da-pill-btn" onClick={onOpenCmd} aria-label="Open command palette (⌘K)">
          <SearchIcon size={13} />
          {!isCompact && <span>Search</span>}
          {!isCompact && (
            <kbd style={{ fontFamily: "var(--font-mono)", fontSize: "10px", background: "var(--bg-subtle)", border: "1px solid var(--border-strong)", borderRadius: "4px", padding: "1px 5px", color: "var(--fg-muted)", marginLeft: 2 }}>⌘K</kbd>
          )}
        </button>

        {/* Keyboard shortcuts */}
        {!isCompact && (
          <button type="button" className="da-icon-btn" onClick={onOpenShortcuts} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
            <KeyboardIcon size={14} />
          </button>
        )}

        {/* Notifications */}
        <NotificationCenter />

        {/* Theme toggle */}
        <button type="button" className="da-icon-btn" onClick={onToggleTheme} title={isDark ? "Light mode" : "Dark mode"} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* User chip */}
        {!isCompact && (
          <div className="da-user-chip">
            <div className="da-user-chip-avatar" style={{ background: `color-mix(in srgb, ${roleColor} 60%, #000)` }}>{userInitials}</div>
            <div>
              <div className="da-user-chip-name" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profileLabel}</div>
              <div className="da-user-chip-role" style={{ color: roleColor }}>{profile.role}</div>
            </div>
          </div>
        )}

        {/* Sign out */}
        <button type="button" className="da-sign-out-btn" onClick={onLogout} aria-label="Sign out">
          <LogOutIcon size={12} />
          {!isCompact && "Sign out"}
        </button>
      </div>
    </header>
  );
},
(prev, next) =>
  prev.isCompact        === next.isCompact &&
  prev.hasSidebar       === next.hasSidebar &&
  prev.isSidebarPinned  === next.isSidebarPinned &&
  prev.activeLabel      === next.activeLabel &&
  prev.profile          === next.profile &&
  prev.userInitials     === next.userInitials &&
  prev.themeMode        === next.themeMode &&
  prev.onToggleSidebarPin === next.onToggleSidebarPin &&
  prev.onToggleTheme    === next.onToggleTheme &&
  prev.onOpenCmd        === next.onOpenCmd &&
  prev.onOpenShortcuts  === next.onOpenShortcuts &&
  prev.onLogout         === next.onLogout
);

// ─────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────

const RotorLoaderVisual = memo(function RotorLoaderVisual() {
  const boltHoles = [0, 60, 120, 180, 240, 300];
  const ventilationSlots = Array.from({ length: 12 }, (_, idx) => idx * 30);
  return (
    <div className="da-loader-visual" aria-hidden="true">
      <div className="da-loader-disc-spin">
        <svg viewBox="0 0 140 140" className="da-loader-svg">
          <defs>
            <radialGradient id="da-rotor-metal" cx="48%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#f3f6fb" /><stop offset="42%" stopColor="#a4acb8" />
              <stop offset="72%" stopColor="#5d6470" /><stop offset="100%" stopColor="#222831" />
            </radialGradient>
            <linearGradient id="da-rotor-edge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#eef2f7" /><stop offset="45%" stopColor="#6d7480" />
              <stop offset="100%" stopColor="#1b2028" />
            </linearGradient>
            <radialGradient id="da-rotor-hub" cx="45%" cy="38%" r="75%">
              <stop offset="0%" stopColor="#cfd6df" /><stop offset="70%" stopColor="#47515e" />
              <stop offset="100%" stopColor="#1a2028" />
            </radialGradient>
          </defs>
          <circle cx="70" cy="70" r="61" fill="#0f1319" opacity="0.4" />
          <circle cx="70" cy="70" r="58" fill="url(#da-rotor-edge)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
          <circle cx="70" cy="70" r="46.5" fill="none" stroke="rgba(15,18,24,0.85)" strokeWidth="20" />
          <circle cx="70" cy="70" r="46.5" fill="none" stroke="url(#da-rotor-metal)" strokeWidth="16" />
          <circle cx="70" cy="70" r="45.5" fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.6" opacity="0.75" />
          {ventilationSlots.map((angle) => (
            <rect key={angle} x="67" y="15" width="6" height="22" rx="3" fill="rgba(12,16,24,0.62)" transform={`rotate(${angle} 70 70)`} />
          ))}
          <circle cx="70" cy="70" r="23" fill="url(#da-rotor-hub)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4" />
          <circle cx="70" cy="70" r="8.5" fill="#0b1016" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
          {boltHoles.map((angle) => {
            const radians = (angle * Math.PI) / 180;
            const x = 70 + Math.cos(radians) * 15;
            const y = 70 + Math.sin(radians) * 15;
            return <circle key={angle} cx={x} cy={y} r="2.6" fill="#0d1218" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />;
          })}
        </svg>
      </div>
      <svg viewBox="0 0 140 140" className="da-loader-svg da-loader-caliper">
        <defs>
          <linearGradient id="da-caliper-body" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d7dee7" /><stop offset="35%" stopColor="#8a93a0" />
            <stop offset="100%" stopColor="#353d49" />
          </linearGradient>
          <linearGradient id="da-caliper-accent" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4ba7ff" /><stop offset="100%" stopColor="#235ec9" />
          </linearGradient>
        </defs>
        <path d="M88 28 C104 28 114 39 114 55 V84 C114 97 105 108 91 108 H78 C74 108 72 105 72 101 V92 C72 88 70 85 66 84 L57 82 C53 81 50 77 50 73 V62 C50 58 53 54 57 53 L66 51 C70 50 72 47 72 43 V35 C72 31 75 28 79 28 H88 Z" fill="url(#da-caliper-body)" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
        <rect x="76" y="50" width="22" height="39" rx="9" fill="rgba(12,16,22,0.28)" />
        <rect x="81" y="45" width="8" height="49" rx="4" fill="url(#da-caliper-accent)" opacity="0.95" />
        <circle cx="95" cy="48" r="3.4" fill="#171d25" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        <circle cx="95" cy="92" r="3.4" fill="#171d25" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        <path d="M57 58 H74" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" />
        <path d="M57 78 H74" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
});

const Loader = memo(function Loader({ message = "Loading workspace…" }: { message?: string }) {
  return (
    <div className="da-loader-shell" role="status" aria-label={message}>
      <div className="da-loader-card">
        <RotorLoaderVisual />
        <div className="da-loader-copy">
          <div className="da-loader-eyebrow">Detroit Axle QA</div>
          <div className="da-loader-headline">{message}</div>
          <div className="da-loader-sub">Checking rotors, calipers, and release state.</div>
          <div className="da-loader-bar"><div className="da-loader-bar-fill" /></div>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Profile Panel
// ─────────────────────────────────────────────────────────────

const ProfilePanel = memo(function ProfilePanel({ title, profile }: { title: string; profile: UserProfile }) {
  const initials  = getUserInitials(profile);
  const roleColor = ROLE_COLORS[profile.role || "qa"] || "var(--fg-muted)";
  const fields: [string, string][] = [
    ["Name",         profile.agent_name   || "—"],
    ["Display name", profile.display_name || "—"],
    ["Email",        profile.email        || "—"],
    ["Role",         profile.role         || "—"],
    ["Agent ID",     profile.agent_id     || "—"],
    ["Team",         profile.team         || "—"],
  ];
  return (
    <div className="da-profile-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: `color-mix(in srgb, ${roleColor} 15%, transparent)`, border: `2px solid color-mix(in srgb, ${roleColor} 30%, transparent)`, display: "grid", placeItems: "center", fontSize: 18, fontWeight: 700, color: roleColor, flexShrink: 0, letterSpacing: "-0.02em" }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: 4 }}>Profile</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--fg-default)", letterSpacing: "-0.02em" }}>{title}</h2>
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
// Route trees (route content wrapped in fade animation)
// ─────────────────────────────────────────────────────────────

const RouteTransition = memo(function RouteTransition({ children, routeKey }: { children: ReactNode; routeKey: string }) {
  return <div key={routeKey} className="da-route-fade">{children}</div>;
});

const StaffRoutes = memo(function StaffRoutes({ profile }: { profile: UserProfile }) {
  const location  = useLocation();
  const isAdmin   = profile.role === "admin";
  const isStaff   = isAdmin || profile.role === "qa";
  return (
    <RouteTransition routeKey={location.pathname}>
      <Routes>
        <Route path={ROUTES.dashboard}      element={<Dashboard />} />
        <Route path={ROUTES.newAudit}       element={<NewAuditSupabase />} />
        <Route path={ROUTES.auditsUpload}   element={<AuditsImportSupabase />} />
        <Route path={ROUTES.auditsList}     element={<AuditsListSupabase />} />
        <Route path={ROUTES.callsUpload}    element={<CallsUploadSupabase />} />
        <Route path={ROUTES.ticketsUpload}  element={<TicketsUploadSupabase />} />
        <Route path={ROUTES.ticketEvidence} element={<TicketEvidenceUploadSupabase />} />
        <Route path={ROUTES.ticketAiReview} element={<TicketAIReviewQueueSupabase />} />
        <Route path={ROUTES.salesUpload}    element={<SalesUploadSupabase />} />
        <Route path={ROUTES.agentFeedback}  element={<AgentFeedbackSupabase />} />
        <Route path={ROUTES.monitoring}     element={<MonitoringSupabase />} />
        <Route path={ROUTES.teamHeatmap}    element={<TeamHeatmapSupabase currentUser={profile} />} />
        {isAdmin && <Route path={ROUTES.accounts}           element={<AccountsSupabase />} />}
        {isAdmin && <Route path={ROUTES.supervisorRequests} element={<SupervisorRequestsSupabase currentUser={profile} />} />}
        {isAdmin && <Route path={ROUTES.supportInbox}       element={<SupportInbox currentUser={profile} />} />}
        {isAdmin && <Route path={ROUTES.helpAdmin}          element={<HelpContentAdmin currentUser={profile} />} />}
        {isStaff && <Route path={ROUTES.reports}            element={<ReportsSupabase />} />}
        <Route path={ROUTES.learningCenter} element={<LearningCenter currentUser={profile} />} />
        <Route path={ROUTES.profile} element={<ProfilePanel title={isAdmin ? "My Admin Profile" : "My QA Profile"} profile={profile} />} />
        <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
      </Routes>
    </RouteTransition>
  );
});

const SupervisorRoutes = memo(function SupervisorRoutes({ profile }: { profile: UserProfile }) {
  const location = useLocation();
  return (
    <RouteTransition routeKey={location.pathname}>
      <Routes>
        <Route path={ROUTES.supervisorOverview}      element={<SupervisorPortal currentUser={profile} initialTab="overview"        hideInternalTabs />} />
        <Route path={ROUTES.supervisorTeamDashboard} element={<SupervisorPortal currentUser={profile} initialTab="team-dashboard"   hideInternalTabs />} />
        <Route path={ROUTES.supervisorRequestsView}  element={<SupervisorPortal currentUser={profile} initialTab="requests"         hideInternalTabs />} />
        <Route path={ROUTES.learningCenter}          element={<LearningCenter   currentUser={profile} />} />
        <Route path={ROUTES.supervisorProfile}       element={<ProfilePanel title="My Supervisor Profile" profile={profile} />} />
        <Route path="*" element={<Navigate to={ROUTES.supervisorOverview} replace />} />
      </Routes>
    </RouteTransition>
  );
});

const AgentRoutes = memo(function AgentRoutes({ profile }: { profile: UserProfile }) {
  const location = useLocation();
  return (
    <RouteTransition routeKey={location.pathname}>
      <Routes>
        <Route path={ROUTES.agentPortal}    element={<AgentPortal    currentUser={profile} />} />
        <Route path={ROUTES.learningCenter} element={<LearningCenter currentUser={profile} />} />
        <Route path="*" element={<Navigate to={ROUTES.agentPortal} replace />} />
      </Routes>
    </RouteTransition>
  );
});

// ─────────────────────────────────────────────────────────────
// AppShell
// ─────────────────────────────────────────────────────────────

function AppShell() {
  const auth         = useAuthState();
  const navigate     = useNavigate();
  const location     = useLocation();
  const viewportWidth = useViewportWidth();
  const { mode: themeMode, toggle: toggleTheme } = useTheme();

  useGlobalStyles();

  // ── State ──────────────────────────────────────────────────
  const [isSidebarPinned,  setSidebarPinned]  = useState(false);
  const [isSidebarHovered, setSidebarHovered] = useState(false);
  const [isCmdOpen,        setCmdOpen]        = useState(false);
  const [helpOpen,         setHelpOpen]       = useState(false);
  const [shortcutsOpen,    setShortcutsOpen]  = useState(false);
  const [activeTourId,     setActiveTourId]   = useState<string | null>(null);
  const pinnedRef = useRef(false);

  const [collapsedGroups, toggleGroup] = useCollapsedGroups();

  const isCompact         = viewportWidth < COMPACT_BP;
  const isMobileBottom    = viewportWidth < BOTTOM_NAV_BP;
  const isSidebarExpanded = !isCompact && (isSidebarPinned || isSidebarHovered);

  // ── Learning progress ──────────────────────────────────────
  const learningProgress = useLearningProgress(auth.profile?.id);

  // ── Nav ────────────────────────────────────────────────────
  const navItems = useMemo(() => auth.profile ? buildNavItems(auth.profile) : [], [auth.profile]);

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

  // ── Recent pages ───────────────────────────────────────────
  const recentPages = useRecentPages(navItems, location.pathname);

  // ── Sync CSS var ───────────────────────────────────────────
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-w",
      isSidebarExpanded ? `${SIDEBAR_W_EXPANDED}px` : `${SIDEBAR_W_COLLAPSED}px`
    );
  }, [isSidebarExpanded]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (isCompact) { setSidebarPinned(false); pinnedRef.current = false; }
  }, [isCompact]);

  // ── Keyboard shortcuts ─────────────────────────────────────
  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable;

      // ⌘K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault(); setCmdOpen((o) => !o); return;
      }
      // ⌘/ — help
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault(); setHelpOpen((o) => !o); return;
      }
      // ⌘\ — pin sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarPinned((p) => { pinnedRef.current = !p; return !p; }); return;
      }
      // ⌘⇧T — toggle theme
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "T") {
        e.preventDefault(); toggleTheme(); return;
      }
      // Esc — close modals
      if (e.key === "Escape") {
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (helpOpen)      { setHelpOpen(false);      return; }
        return;
      }
      if (isTyping) return;
      // ? — shortcuts modal
      if (e.key === "?") { setShortcutsOpen((o) => !o); return; }

      // G + letter — quick navigation
      if (e.key === "g" || e.key === "G") {
        gPressed = true;
        clearTimeout(gTimeout);
        gTimeout = setTimeout(() => { gPressed = false; }, 800);
        return;
      }
      if (gPressed) {
        gPressed = false;
        clearTimeout(gTimeout);
        const dest: Record<string, RoutePath> = {
          d: ROUTES.dashboard, n: ROUTES.newAudit, r: ROUTES.reports,
          e: ROUTES.learningCenter, m: ROUTES.monitoring, a: ROUTES.auditsList,
        };
        const target = dest[e.key.toLowerCase()];
        if (target) { navigate(target); e.preventDefault(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, toggleTheme, shortcutsOpen, helpOpen]);

  // ── Callbacks ──────────────────────────────────────────────
  const handleNavigate      = useCallback((path: RoutePath) => { navigate(path); setCmdOpen(false); }, [navigate]);
  const handleTogglePin     = useCallback(() => { setSidebarPinned((p) => { pinnedRef.current = !p; return !p; }); }, []);
  const handleSidebarEnter  = useCallback(() => { if (!pinnedRef.current) setSidebarHovered(true); }, []);
  const handleSidebarLeave  = useCallback(() => setSidebarHovered(false), []);
  const handleLogout        = useCallback(() => auth.logout(), [auth]);
  const handleOpenCmd       = useCallback(() => setCmdOpen(true), []);
  const handleCloseCmd      = useCallback(() => setCmdOpen(false), []);
  const handleOpenHelp      = useCallback(() => setHelpOpen(true), []);
  const handleCloseHelp     = useCallback(() => setHelpOpen(false), []);
  const handleOpenShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const handleCloseShortcuts = useCallback(() => setShortcutsOpen(false), []);
  const handleHelpNavigate  = useCallback((path: string) => { navigate(path); setHelpOpen(false); }, [navigate]);
  const handleStartHelpTour = useCallback((tourId: string) => { setActiveTourId(tourId); setHelpOpen(false); }, []);
  const handleCloseHelpTour = useCallback(() => setActiveTourId(null), []);
  const handleGoToLearning  = useCallback(() => { navigate(ROUTES.learningCenter); }, [navigate]);

  // ── Guard states ───────────────────────────────────────────
  const { profile, loading, recoveryMode, logout, handleRecoveryComplete } = auth;

  if (loading)       return <Loader />;
  if (recoveryMode)  return <ResetPassword onComplete={handleRecoveryComplete} onLogout={logout} />;
  if (!auth.session) return <Login />;
  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="da-error-card">
          <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-rose)", marginBottom: 10 }}>Profile error</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--fg-default)", marginBottom: 10 }}>Profile not found</h1>
          <p style={{ fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.6, marginBottom: 22 }}>
            {auth.profileError || "This account exists in Auth but has no profile row."}
          </p>
          <button onClick={logout} className="da-sign-out-btn" style={{ margin: "0 auto" }}>
            <LogOutIcon size={12} /> Sign out
          </button>
        </div>
      </div>
    );
  }

  const isAdmin      = profile.role === "admin";
  const isQA         = profile.role === "qa";
  const isSupervisor = profile.role === "supervisor";
  const isStaff      = isAdmin || isQA;
  const isAgent      = profile.role === "agent";
  const hasSidebar   = isStaff || isSupervisor || isAgent;
  const userInitials = getUserInitials(profile);

  return (
    <AuthContext.Provider value={{ profile, loading: false, logout }}>
      {/* Command palette */}
      {isCmdOpen && (
        <CommandPalette
          items={navItems}
          recentPages={recentPages}
          onNavigate={handleNavigate}
          onClose={handleCloseCmd}
        />
      )}

      {/* Keyboard shortcuts modal */}
      {shortcutsOpen && <ShortcutsModal onClose={handleCloseShortcuts} />}

      <HelpDrawer
        open={helpOpen}
        onClose={handleCloseHelp}
        currentPage={`${activeLabel} ${location.pathname}`}
        currentRole={profile.role}
        currentUserName={profile.display_name || profile.agent_name || profile.email || undefined}
        currentUserEmail={profile.email || undefined}
        onNavigate={handleHelpNavigate}
        onStartTour={handleStartHelpTour}
      />

      <HelpTourOverlay
        tourId={activeTourId}
        currentPage={`${activeLabel} ${location.pathname}`}
        currentRole={profile.role}
        onClose={handleCloseHelpTour}
        onOpenHelp={handleOpenHelp}
      />

      <div
        className="da-shell"
        style={{ "--sidebar-w": isSidebarExpanded ? `${SIDEBAR_W_EXPANDED}px` : `${SIDEBAR_W_COLLAPSED}px` } as CSSProperties}
      >
        {/* Sidebar */}
        {hasSidebar && (
          <Sidebar
            navGroupsOrdered={navGroupsOrdered}
            activePath={location.pathname}
            isExpanded={isSidebarExpanded}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            profile={profile}
            userInitials={userInitials}
            learningProgress={learningProgress}
            onNavigate={handleNavigate}
            onExpand={handleSidebarEnter}
            onCollapse={handleSidebarLeave}
            onLogout={handleLogout}
            onOpenHelp={handleOpenHelp}
            onGoToLearning={handleGoToLearning}
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
            onOpenShortcuts={handleOpenShortcuts}
            onLogout={handleLogout}
          />

          <main>
            {hasSidebar ? (
              <>
                {/* Compact horizontal nav (tablet, >768 <1024) */}
                {isCompact && !isMobileBottom && (
                  <nav className="da-compact-nav" aria-label="Tablet navigation">
                    {navItems.map((item) => {
                      const accent   = GROUP_ACCENT[item.group] || "var(--accent-blue)";
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.path} type="button"
                          className={`da-compact-nav-item${isActive ? " active" : ""}`}
                          onClick={() => handleNavigate(item.path)}
                          style={{ "--item-accent": accent } as CSSProperties}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <NavIcon label={item.label} size={13} />
                          {item.label}
                        </button>
                      );
                    })}
                    <button
                      type="button" className="da-compact-nav-item" onClick={handleOpenHelp}
                      style={{ "--item-accent": "var(--accent-blue)" } as CSSProperties}
                    >
                      <NavIcon label="Help" size={13} /> Help
                    </button>
                  </nav>
                )}

                <div className="da-content">
                  {isStaff      ? <StaffRoutes      profile={profile} />
                  : isSupervisor ? <SupervisorRoutes profile={profile} />
                  :               <AgentRoutes       profile={profile} />}
                </div>

                {/* Mobile bottom tab bar */}
                {isMobileBottom && (
                  <BottomNav
                    navItems={navItems}
                    activePath={location.pathname}
                    onNavigate={handleNavigate}
                    onOpenHelp={handleOpenHelp}
                  />
                )}
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
