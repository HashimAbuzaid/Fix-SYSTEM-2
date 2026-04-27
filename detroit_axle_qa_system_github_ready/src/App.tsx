/**
 * App.tsx — Detroit Axle QA System  ·  v5.0
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED FROM v4:
 *
 * BUGS FIXED
 *  • Sidebar pin/hover state was split across ref + state causing desync.
 *    Now a single `sidebarMode` enum: "hover" | "pinned" | "closed".
 *  • `handleSidebarLeave` was unconditional — now guards when pinned.
 *  • CSS `--sidebar-w` was set on both :root and da-shell inline style,
 *    causing a flash; now only the shell inline style drives layout.
 *  • `color-mix()` had zero fallbacks; now every call has a graceful
 *    hex/rgba fallback for Safari <16.2.
 *  • `memo` comparators on Header/Sidebar were incomplete; replaced with
 *    shallow comparison helpers that won't silently skip re-renders.
 *  • LiveClock `setInterval` had no guard against rapid mount/unmount cycles.
 *  • Route navigation had no `startTransition` — now wrapped so React
 *    defers non-urgent renders and keeps the UI responsive.
 *  • Compact nav was not scroll-restored on route change.
 *
 * DESIGN UPGRADES
 *  • Font: Geist (display) + DM Sans (body) — sharp, modern, industrial.
 *    Goodbye Inter. 
 *  • Full design-token overhaul: 60/30/10 colour ratio, true midnight base,
 *    electric-blue primary, acid-amber accent, rose danger.
 *  • Sidebar gets a glass-morphism border with a subtle gradient sheen.
 *  • Nav items: pill highlight with animated left bar, icon glow on active.
 *  • Content area: staggered `fadeSlideUp` entrance on every route change
 *    (keyed on pathname so it re-triggers correctly).
 *  • Header: adds a live status dot + gradient wordmark.
 *  • Command palette: grouped sections with section headers, keyboard
 *    highlight animates (not just background-color change).
 *  • Loader: re-orchestrated — rotor spins while shimmer bar runs, card
 *    uses a noise-texture glass panel.
 *  • Scrollbars: 4px, rounded, themed per mode.
 *  • `@media (prefers-reduced-motion)` honoured everywhere.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  useTransition,
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
import { applyThemeCssVariables, readStoredTheme } from "./lib/theme";
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
type SidebarMode = "closed" | "hover" | "pinned";

interface NavItem {
  readonly path: RoutePath;
  readonly label: string;
  readonly group: string;
  readonly shortcut?: string;
}

const LOGO_MARK_SRC = "/detroit-axle-mark.png";
const LOGO_WORDMARK_SRC = "/detroit-axle-wordmark.svg";
const SIDEBAR_W_COLLAPSED = 62;
const SIDEBAR_W_EXPANDED = 248;
const COMPACT_BP = 1024;

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const DURATION_SIDEBAR = "280ms";

const NAV_GROUPS: Readonly<Record<string, readonly string[]>> = {
  Core: ["Dashboard", "Overview", "Team Dashboard"],
  Audits: ["New Audit", "Audits Upload", "Audits List"],
  Data: ["Calls Upload", "Tickets Upload", "Ticket Evidence", "Ticket AI Review", "Sales Upload"],
  Analytics: ["Agent Feedback", "Monitoring", "Team Heatmap"],
  Management: ["Accounts", "Supervisor Requests", "Reports"],
  Account: ["My Admin Profile", "My QA Profile", "My Supervisor Profile", "Supervisor Requests"],
};

// Each group maps to a CSS custom-property name (defined in token sheet)
const GROUP_ACCENT: Readonly<Record<string, string>> = {
  Core:       "var(--c-blue)",
  Audits:     "var(--c-violet)",
  Data:       "var(--c-cyan)",
  Analytics:  "var(--c-amber)",
  Management: "var(--c-rose)",
  Account:    "var(--c-emerald)",
  Other:      "var(--fg-muted)",
};

// Raw hex values mirroring CSS vars — needed for JS-driven styles (no var() in
// background-color shorthand fallbacks)
const GROUP_ACCENT_HEX: Readonly<Record<string, string>> = {
  Core:       "#3b82f6",
  Audits:     "#8b5cf6",
  Data:       "#06b6d4",
  Analytics:  "#f59e0b",
  Management: "#f43f5e",
  Account:    "#10b981",
  Other:      "#64748b",
};

const ROLE_COLORS: Readonly<Record<string, string>> = {
  admin:      "#f43f5e",
  qa:         "#3b82f6",
  supervisor: "#8b5cf6",
  agent:      "#10b981",
};

const NAV_SHORTCUTS: Partial<Record<string, string>> = {
  Dashboard:   "D",
  "New Audit": "N",
  "Audits List": "L",
  Monitoring:  "M",
  Reports:     "R",
  Accounts:    "A",
};

// ─────────────────────────────────────────────────────────────
// Global CSS — injected once
// ─────────────────────────────────────────────────────────────

const GLOBAL_STYLE_ID = "da-shell-v5";

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Geist+Mono:wght@400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Design Tokens ─────────────────────────────────────────── */
:root {
  /* Brand palette */
  --c-blue:    #3b82f6;
  --c-blue-hi: #60a5fa;
  --c-violet:  #8b5cf6;
  --c-cyan:    #06b6d4;
  --c-amber:   #f59e0b;
  --c-rose:    #f43f5e;
  --c-emerald: #10b981;

  /* Typography */
  --font-display: 'Geist', system-ui, sans-serif;
  --font-body:    'DM Sans', system-ui, sans-serif;
  --font-mono:    'Geist Mono', monospace;

  /* Motion */
  --ease-out:  ${EASE_OUT};
  --spring:    ${SPRING};
  --dur-sb:    ${DURATION_SIDEBAR};

  /* Sidebar geometry */
  --sb-w: ${SIDEBAR_W_COLLAPSED}px;
}

/* ── Dark (default) ────────────────────────────────────────── */
[data-theme="dark"], :root {
  --bg-base:         #080b12;
  --bg-raised:       #0d1117;
  --bg-overlay:      #131720;
  --bg-glass:        rgba(13, 17, 23, 0.82);
  --bg-tint:         rgba(255,255,255,0.035);
  --bg-tint-hover:   rgba(255,255,255,0.065);
  --border:          rgba(255,255,255,0.065);
  --border-strong:   rgba(255,255,255,0.11);
  --border-accent:   rgba(59,130,246,0.35);
  --fg-default:      #e8edf5;
  --fg-muted:        #556070;
  --fg-subtle:       #2e3845;
  --sidebar-bg:      rgba(9, 12, 18, 0.94);
  --sidebar-border:  rgba(255,255,255,0.055);
  --header-bg:       rgba(8, 11, 18, 0.88);
  --header-border:   rgba(255,255,255,0.055);
  --scroll-thumb:    rgba(255,255,255,0.08);
  --scroll-hover:    rgba(255,255,255,0.15);
  --shadow-sm:       0 1px 4px rgba(0,0,0,0.5);
  --shadow-md:       0 4px 20px rgba(0,0,0,0.55);
  --shadow-lg:       0 16px 48px rgba(0,0,0,0.65), 0 4px 12px rgba(0,0,0,0.4);
  --shadow-glow-blue: 0 0 16px rgba(59,130,246,0.35);
  --noise: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
}

/* ── Light ─────────────────────────────────────────────────── */
[data-theme="light"] {
  --bg-base:         #f2f4f8;
  --bg-raised:       #ffffff;
  --bg-overlay:      #eaecf2;
  --bg-glass:        rgba(255,255,255,0.85);
  --bg-tint:         rgba(0,0,0,0.028);
  --bg-tint-hover:   rgba(0,0,0,0.05);
  --border:          rgba(0,0,0,0.065);
  --border-strong:   rgba(0,0,0,0.11);
  --border-accent:   rgba(59,130,246,0.3);
  --fg-default:      #0e1420;
  --fg-muted:        #7a8699;
  --fg-subtle:       #b0bac8;
  --sidebar-bg:      rgba(248,250,255,0.96);
  --sidebar-border:  rgba(0,0,0,0.055);
  --header-bg:       rgba(255,255,255,0.9);
  --header-border:   rgba(0,0,0,0.065);
  --scroll-thumb:    rgba(0,0,0,0.1);
  --scroll-hover:    rgba(0,0,0,0.2);
  --shadow-sm:       0 1px 4px rgba(0,0,0,0.07);
  --shadow-md:       0 4px 20px rgba(0,0,0,0.08);
  --shadow-lg:       0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06);
  --shadow-glow-blue: 0 0 14px rgba(59,130,246,0.2);
  --noise: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E");
}

/* ── Base ──────────────────────────────────────────────────── */
html, body { height: 100%; }
body {
  font-family: var(--font-body);
  background: var(--bg-base);
  color: var(--fg-default);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-feature-settings: "cv02","cv03","cv04","cv11";
}
button { font-family: inherit; cursor: pointer; border: none; }
a { color: inherit; text-decoration: none; }

/* ── Scrollbars ────────────────────────────────────────────── */
* { scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) transparent; }
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: var(--scroll-thumb);
  border-radius: 999px;
  transition: background 200ms;
}
::-webkit-scrollbar-thumb:hover { background: var(--scroll-hover); }

/* ── Focus ─────────────────────────────────────────────────── */
:focus-visible {
  outline: 2px solid var(--c-blue);
  outline-offset: 2px;
  border-radius: 6px;
}

/* ── Keyframes ─────────────────────────────────────────────── */
@keyframes fadeIn     { from { opacity: 0 } to { opacity: 1 } }
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(10px) }
  to   { opacity: 1; transform: translateY(0) }
}
@keyframes slideInLeft { from { opacity: 0; transform: translateX(-10px) } to { opacity: 1; transform: translateX(0) } }
@keyframes scaleIn    { from { opacity: 0; transform: scale(.96) } to { opacity: 1; transform: scale(1) } }
@keyframes spin       { to { transform: rotate(360deg) } }
@keyframes blink      { 50% { opacity: 0.15 } }
@keyframes ping       { 75%, 100% { transform: scale(1.8); opacity: 0 } }
@keyframes shimmer    { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
@keyframes progressSlide {
  0%   { transform: scaleX(0); transform-origin: left }
  60%  { transform: scaleX(0.65); transform-origin: left }
  100% { transform: scaleX(1); transform-origin: left }
}
@keyframes cmdIn {
  from { opacity: 0; transform: translateY(-14px) scale(0.97) }
  to   { opacity: 1; transform: translateY(0)     scale(1) }
}
@keyframes contentIn {
  from { opacity: 0; transform: translateY(8px) }
  to   { opacity: 1; transform: translateY(0) }
}
@keyframes navPipGrow {
  from { height: 0 }
  to   { height: 18px }
}

/* ── Shell ─────────────────────────────────────────────────── */
.da-shell {
  display: flex;
  min-height: 100vh;
}

/* ═══════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════ */
.da-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  width: ${SIDEBAR_W_COLLAPSED}px;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  /* Gradient border effect via box-shadow + pseudo */
  border-right: 1px solid var(--sidebar-border);
  transition:
    width var(--dur-sb) var(--ease-out),
    box-shadow var(--dur-sb) ease;
  overflow: hidden;
  will-change: width;
}
.da-sidebar::after {
  content: '';
  position: absolute;
  inset: 0 0 0 auto;
  width: 1px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--border-strong) 20%,
    var(--border) 50%,
    var(--border-strong) 80%,
    transparent 100%
  );
  pointer-events: none;
}
.da-sidebar.expanded {
  width: ${SIDEBAR_W_EXPANDED}px;
  box-shadow: 0 0 0 1px var(--sidebar-border), 12px 0 40px rgba(0,0,0,0.28);
}

/* Header */
.da-sidebar-header {
  display: flex;
  align-items: center;
  height: 58px;
  padding: 0 11px;
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
  overflow: hidden;
  gap: 11px;
  position: relative;
}
.da-sidebar-logo-wrap {
  width: 38px; height: 38px;
  border-radius: 11px;
  background: linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(139,92,246,0.12) 100%);
  border: 1px solid rgba(59,130,246,0.22);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(59,130,246,0.15);
  transition: box-shadow 200ms;
}
.da-sidebar.expanded .da-sidebar-logo-wrap {
  box-shadow: 0 4px 14px rgba(59,130,246,0.22);
}
.da-sidebar-brand {
  opacity: 0;
  transform: translateX(-6px);
  transition: opacity 160ms ease 40ms, transform 200ms var(--ease-out) 20ms;
  white-space: nowrap;
  overflow: hidden;
  pointer-events: none;
  min-width: 0;
}
.da-sidebar.expanded .da-sidebar-brand {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}
.da-brand-name {
  font-family: var(--font-display);
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--fg-default);
  line-height: 1.15;
  /* gradient text */
  background: linear-gradient(135deg, var(--fg-default) 0%, var(--c-blue-hi) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.da-brand-sub {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin-top: 2px;
}

/* Nav rail */
.da-nav-rail {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px 7px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  /* Hide scrollbar visually when collapsed */
  scrollbar-width: none;
}
.da-nav-rail::-webkit-scrollbar { display: none; }
.da-sidebar.expanded .da-nav-rail { scrollbar-width: thin; }
.da-sidebar.expanded .da-nav-rail::-webkit-scrollbar { display: block; }

.da-nav-section { display: flex; flex-direction: column; gap: 1px; margin-bottom: 2px; }
.da-nav-section + .da-nav-section {
  padding-top: 10px;
  margin-top: 6px;
  border-top: 1px solid var(--border);
}
.da-nav-section-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0 9px 5px;
  overflow: hidden;
  max-height: 0;
  opacity: 0;
  transition: max-height var(--dur-sb) var(--ease-out), opacity 160ms ease, padding-bottom var(--dur-sb) var(--ease-out);
}
.da-sidebar.expanded .da-nav-section-label {
  max-height: 28px;
  opacity: 0.7;
  padding-bottom: 5px;
}

/* Nav item */
.da-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 37px;
  border-radius: 9px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  padding: 0 9px;
  gap: 0;
  overflow: hidden;
  white-space: nowrap;
  transition:
    color 140ms ease,
    background 120ms ease,
    border-color 140ms ease,
    gap var(--dur-sb) var(--ease-out);
  width: 100%;
  text-align: left;
  justify-content: center;
  outline: none;
}
.da-sidebar.expanded .da-nav-item { gap: 10px; justify-content: flex-start; }
.da-nav-item:hover {
  color: var(--fg-default);
  background: var(--bg-tint-hover);
}
.da-nav-item.active {
  color: var(--item-accent, var(--c-blue));
  background: rgba(var(--item-accent-rgb, 59,130,246), 0.09);
  border-color: rgba(var(--item-accent-rgb, 59,130,246), 0.18);
}
.da-nav-item.active:hover {
  background: rgba(var(--item-accent-rgb, 59,130,246), 0.13);
}
/* Glow on icon when active */
.da-nav-item.active .da-nav-icon {
  filter: drop-shadow(0 0 6px var(--item-accent, var(--c-blue)));
}

.da-nav-icon {
  width: 20px; height: 20px;
  display: grid; place-items: center;
  flex-shrink: 0;
  color: inherit;
  transition: filter 200ms ease;
}
.da-nav-label {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.015em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0;
  max-width: 0;
  transform: translateX(-8px);
  transition:
    max-width var(--dur-sb) var(--ease-out),
    opacity 150ms ease 30ms,
    transform var(--dur-sb) var(--ease-out);
  color: inherit;
}
.da-nav-item.active .da-nav-label { font-weight: 600; }
.da-sidebar.expanded .da-nav-label { opacity: 1; max-width: 165px; transform: translateX(0); }

/* Active pip — left bar with glow */
.da-nav-pip {
  position: absolute;
  left: 0; top: 50%;
  transform: translateY(-50%);
  width: 2.5px;
  border-radius: 0 3px 3px 0;
  background: var(--item-accent, var(--c-blue));
  height: 0;
  transition: height 220ms var(--spring);
  box-shadow: 0 0 8px var(--item-accent, var(--c-blue));
}
.da-nav-item.active .da-nav-pip { height: 18px; }

/* Sidebar footer / user */
.da-sidebar-user {
  padding: 8px 7px 10px;
  border-top: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}
.da-sidebar-user-row {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 8px 9px;
  border-radius: 10px;
  background: var(--bg-tint);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: gap var(--dur-sb) var(--ease-out), padding var(--dur-sb) var(--ease-out), background 140ms;
  justify-content: center;
  cursor: default;
}
.da-sidebar.expanded .da-sidebar-user-row { gap: 9px; justify-content: flex-start; }
.da-sidebar-user-row:hover { background: var(--bg-tint-hover); }

.da-avatar {
  width: 28px; height: 28px;
  border-radius: 8px;
  display: grid; place-items: center;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  position: relative;
  letter-spacing: -0.01em;
}
.da-avatar-online {
  position: absolute; bottom: -2px; right: -2px;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--c-emerald);
  border: 2px solid var(--sidebar-bg);
}
.da-avatar-online::after {
  content: '';
  position: absolute; inset: -2px;
  border-radius: 50%;
  background: var(--c-emerald);
  animation: ping 2.4s cubic-bezier(0,0,.2,1) infinite;
  opacity: 0.35;
}
.da-user-info {
  flex: 1; min-width: 0; overflow: hidden;
  opacity: 0; transform: translateX(-5px);
  transition: opacity 150ms ease 20ms, transform 200ms var(--ease-out) 10ms;
  pointer-events: none;
}
.da-sidebar.expanded .da-user-info { opacity: 1; transform: translateX(0); pointer-events: auto; }
.da-user-name {
  font-family: var(--font-display);
  font-size: 12px; font-weight: 600;
  color: var(--fg-default);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  letter-spacing: -0.02em;
}
.da-user-role {
  font-family: var(--font-mono);
  font-size: 9.5px; font-weight: 500;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  margin-top: 1px;
}
.da-sidebar-logout {
  width: 0; height: 26px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--fg-muted);
  display: grid; place-items: center;
  flex-shrink: 0; overflow: hidden;
  opacity: 0; padding: 0;
  transition: opacity 140ms ease, width 200ms var(--ease-out), color 120ms, background 120ms, border-color 120ms;
  pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-logout { opacity: 1; width: 26px; pointer-events: auto; }
.da-sidebar-logout:hover {
  color: var(--c-rose);
  background: rgba(244,63,94,0.1);
  border-color: rgba(244,63,94,0.25);
}

/* ═══════════════════════════════════════════════════════════
   HEADER
═══════════════════════════════════════════════════════════ */
.da-header {
  position: fixed;
  top: 0; right: 0;
  left: var(--sb-w, ${SIDEBAR_W_COLLAPSED}px);
  z-index: 30;
  height: 58px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--header-border);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  gap: 10px;
  transition: left var(--dur-sb) var(--ease-out);
  will-change: left;
}
.da-header-left  { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.da-header-right { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }

/* Breadcrumb */
.da-breadcrumb { display: flex; align-items: center; gap: 7px; font-size: 13px; min-width: 0; }
.da-bc-root {
  font-family: var(--font-body);
  color: var(--fg-muted);
  white-space: nowrap;
  font-weight: 400;
  font-size: 13px;
}
.da-bc-sep { color: var(--fg-subtle); font-size: 14px; line-height: 1; }
.da-bc-current {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 13.5px;
  letter-spacing: -0.02em;
  color: var(--fg-default);
  white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
  animation: slideInLeft 200ms var(--ease-out) both;
}

/* Status dot */
.da-status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--c-emerald);
  box-shadow: 0 0 6px var(--c-emerald);
  flex-shrink: 0;
}

/* Divider */
.da-div { width: 1px; height: 16px; background: var(--border-strong); flex-shrink: 0; }

/* Pill button */
.da-pill {
  display: flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 11px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: var(--bg-raised);
  color: var(--fg-muted);
  font-family: var(--font-body); font-size: 12.5px; font-weight: 500;
  cursor: pointer;
  transition: color 120ms, border-color 120ms, background 120ms, box-shadow 120ms;
  white-space: nowrap; flex-shrink: 0;
}
.da-pill:hover { color: var(--fg-default); background: var(--bg-overlay); border-color: var(--border-strong); }

/* Icon button */
.da-icon-btn {
  width: 32px; height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg-muted);
  display: grid; place-items: center;
  cursor: pointer;
  transition: color 120ms, background 120ms, border-color 120ms;
  flex-shrink: 0;
}
.da-icon-btn:hover { color: var(--fg-default); background: var(--bg-tint-hover); border-color: var(--border-strong); }
.da-icon-btn.pinned { color: var(--c-blue); border-color: rgba(59,130,246,0.35); background: rgba(59,130,246,0.08); }

/* Sign-out button */
.da-signout-btn {
  display: flex; align-items: center; gap: 5px;
  height: 32px; padding: 0 11px;
  border-radius: 8px;
  border: 1px solid rgba(244,63,94,0.22);
  background: rgba(244,63,94,0.07);
  color: var(--c-rose);
  font-family: var(--font-body); font-size: 12px; font-weight: 600;
  cursor: pointer;
  transition: background 120ms, border-color 120ms;
  white-space: nowrap; flex-shrink: 0;
}
.da-signout-btn:hover { background: rgba(244,63,94,0.13); border-color: rgba(244,63,94,0.38); }

/* User chip */
.da-user-chip {
  display: flex; align-items: center; gap: 7px;
  height: 32px; padding: 0 10px 0 5px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-tint);
}
.da-chip-avatar {
  width: 22px; height: 22px;
  border-radius: 6px;
  display: grid; place-items: center;
  font-family: var(--font-display);
  font-size: 9px; font-weight: 700;
  color: #fff; flex-shrink: 0;
}
.da-chip-name {
  font-family: var(--font-display); font-size: 12px; font-weight: 600;
  color: var(--fg-default); letter-spacing: -0.02em;
  max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.da-chip-role {
  font-family: var(--font-mono); font-size: 9.5px; font-weight: 500;
  letter-spacing: 0.06em; text-transform: uppercase;
}

/* Pin toggle — only visible on large viewports */
.da-pin-btn { display: none; }
@media (min-width: ${COMPACT_BP}px) { .da-pin-btn { display: grid; } }

/* Clock */
.da-clock {
  font-family: var(--font-mono); font-size: 12px; font-weight: 400;
  color: var(--fg-muted); letter-spacing: 0.04em;
  user-select: none; display: flex; align-items: center; gap: 0.5px;
}
.da-clock-sep { animation: blink 1s step-end infinite; }

/* ═══════════════════════════════════════════════════════════
   PAGE ROOT + CONTENT
═══════════════════════════════════════════════════════════ */
.da-page-root {
  flex: 1; min-width: 0;
  margin-left: var(--sb-w, ${SIDEBAR_W_COLLAPSED}px);
  padding-top: 58px;
  transition: margin-left var(--dur-sb) var(--ease-out);
  will-change: margin-left;
}

.da-content {
  padding: 24px;
  min-height: calc(100vh - 58px);
}
@media (max-width: ${COMPACT_BP - 1}px) { .da-content { padding: 14px; } }

/* Route content animation — keyed on pathname */
.da-route-view {
  animation: contentIn 280ms var(--ease-out) both;
}

/* Progress bar */
.da-progress {
  position: fixed;
  top: 0; left: 0; right: 0; height: 2px;
  z-index: 9999;
  background: linear-gradient(90deg, var(--c-blue), var(--c-violet), var(--c-cyan));
  animation: progressSlide 2.6s var(--ease-out) forwards;
  transform-origin: left;
}

/* Compact nav (mobile/tablet) */
.da-compact-nav {
  position: sticky; top: 58px; z-index: 20;
  display: flex; gap: 2px;
  padding: 8px 14px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border);
  background: var(--header-bg);
  backdrop-filter: blur(20px);
  scrollbar-width: none;
}
.da-compact-nav::-webkit-scrollbar { display: none; }
.da-compact-nav-item {
  display: flex; align-items: center; gap: 5px;
  height: 28px; padding: 0 10px;
  border-radius: 7px; border: 1px solid transparent;
  background: transparent; color: var(--fg-muted);
  font-family: var(--font-body); font-size: 12px; font-weight: 500;
  cursor: pointer; white-space: nowrap;
  transition: all 120ms; flex-shrink: 0;
}
.da-compact-nav-item:hover { color: var(--fg-default); background: var(--bg-tint-hover); }
.da-compact-nav-item.active {
  color: var(--item-accent, var(--c-blue));
  background: rgba(var(--item-accent-rgb, 59,130,246), 0.1);
  border-color: rgba(var(--item-accent-rgb, 59,130,246), 0.2);
  font-weight: 600;
}

/* ═══════════════════════════════════════════════════════════
   COMMAND PALETTE
═══════════════════════════════════════════════════════════ */
.da-cmd-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(6px) saturate(130%);
  animation: fadeIn 120ms ease both;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 13vh;
}
.da-cmd-dialog {
  width: min(596px, 94vw);
  border-radius: 16px;
  border: 1px solid var(--border-strong);
  background: var(--bg-overlay);
  /* Glass + noise */
  box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.05);
  overflow: hidden;
  animation: cmdIn 180ms var(--spring) both;
}
.da-cmd-header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.da-cmd-input {
  flex: 1; background: transparent; border: none; outline: none;
  font-family: var(--font-display); font-size: 15px; font-weight: 400;
  color: var(--fg-default); letter-spacing: -0.015em;
}
.da-cmd-input::placeholder { color: var(--fg-muted); }
.da-cmd-esc {
  font-family: var(--font-mono); font-size: 10px;
  background: var(--bg-tint); border: 1px solid var(--border-strong);
  border-radius: 5px; padding: 2px 7px; color: var(--fg-muted); flex-shrink: 0;
}
.da-cmd-body { max-height: 360px; overflow-y: auto; padding: 6px; }
.da-cmd-section-hdr {
  font-family: var(--font-mono); font-size: 9.5px; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--fg-subtle); padding: 8px 10px 4px;
}
.da-cmd-item {
  display: flex; align-items: center; gap: 10px;
  height: 42px; padding: 0 10px;
  border-radius: 9px; cursor: pointer;
  border: 1px solid transparent;
  transition: background 80ms, border-color 80ms;
  outline: none;
}
.da-cmd-item:hover, .da-cmd-item[aria-selected="true"] {
  background: var(--bg-tint-hover);
  border-color: var(--border);
}
.da-cmd-item[aria-selected="true"] { background: rgba(59,130,246,0.07); border-color: rgba(59,130,246,0.18); }
.da-cmd-item-icon {
  width: 30px; height: 30px; border-radius: 8px;
  display: grid; place-items: center; flex-shrink: 0; font-size: 13px;
}
.da-cmd-item-label {
  flex: 1; font-family: var(--font-display); font-size: 13px; font-weight: 500;
  color: var(--fg-default); letter-spacing: -0.015em;
}
.da-cmd-item-group { font-size: 11px; color: var(--fg-muted); font-family: var(--font-body); }
.da-cmd-shortcut {
  font-family: var(--font-mono); font-size: 11px;
  color: var(--fg-muted); background: var(--bg-tint);
  border: 1px solid var(--border); border-radius: 5px; padding: 1px 6px;
}
.da-cmd-empty {
  padding: 36px 16px; text-align: center;
  color: var(--fg-muted); font-size: 13.5px; font-family: var(--font-body);
}
.da-cmd-footer {
  display: flex; align-items: center; gap: 14px;
  padding: 8px 14px; border-top: 1px solid var(--border);
  font-family: var(--font-mono); font-size: 10.5px; color: var(--fg-subtle);
}
.da-cmd-footer kbd {
  font-family: var(--font-mono); font-size: 10px;
  background: var(--bg-tint); border: 1px solid var(--border-strong);
  border-radius: 4px; padding: 1px 5px; color: var(--fg-muted);
}

/* ═══════════════════════════════════════════════════════════
   LOADER
═══════════════════════════════════════════════════════════ */
.da-loader-shell {
  position: fixed; inset: 0;
  display: grid; place-items: center;
  background: var(--bg-base); z-index: 9999;
  animation: fadeIn 200ms ease;
}
.da-loader-card {
  display: flex; align-items: center; gap: 28px;
  padding: 32px 36px;
  border-radius: 22px;
  border: 1px solid var(--border-strong);
  background: var(--bg-glass);
  backdrop-filter: blur(32px);
  box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.06);
  animation: scaleIn 320ms var(--spring) both;
  min-width: min(580px, calc(100vw - 32px));
}
.da-loader-visual {
  position: relative; width: 120px; height: 120px;
  flex-shrink: 0; display: grid; place-items: center;
}
.da-loader-disc {
  position: absolute; inset: 0;
  animation: spin 1.1s linear infinite;
  will-change: transform;
}
.da-loader-copy { min-width: 0; }
.da-loader-eyebrow {
  font-family: var(--font-mono); font-size: 10px; font-weight: 600;
  letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--c-blue); margin-bottom: 7px;
}
.da-loader-headline {
  font-family: var(--font-display); font-size: 21px; font-weight: 700;
  color: var(--fg-default); letter-spacing: -0.03em; line-height: 1.2;
}
.da-loader-sub {
  font-family: var(--font-body); font-size: 13px;
  color: var(--fg-muted); margin-top: 7px; line-height: 1.6; max-width: 320px;
}
.da-loader-bar {
  height: 3px; margin-top: 20px;
  border-radius: 999px; background: var(--border);
  overflow: hidden; width: min(280px, 100%);
}
.da-loader-bar-fill {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--c-blue), var(--c-violet), var(--c-cyan));
  background-size: 200%;
  animation: shimmer 1.6s linear infinite;
}
@media (max-width: 640px) {
  .da-loader-card { min-width: 0; width: calc(100vw - 24px); flex-direction: column; padding: 24px; }
  .da-loader-bar { width: 100%; }
}

/* ═══════════════════════════════════════════════════════════
   PROFILE PANEL
═══════════════════════════════════════════════════════════ */
.da-profile-panel {
  max-width: 620px; padding: 32px;
  border-radius: 18px; background: var(--bg-raised);
  border: 1px solid var(--border);
  animation: fadeSlideUp 240ms var(--ease-out) both;
}
.da-profile-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px; margin-top: 24px;
}
@media (max-width: 520px) { .da-profile-grid { grid-template-columns: 1fr; } }
.da-profile-field {
  padding: 12px 16px; border-radius: 11px;
  background: var(--bg-tint); border: 1px solid var(--border);
}
.da-pf-label {
  font-family: var(--font-mono); font-size: 9.5px; font-weight: 600;
  letter-spacing: 0.09em; text-transform: uppercase; color: var(--fg-muted); margin-bottom: 5px;
}
.da-pf-value {
  font-family: var(--font-display); font-size: 13px; font-weight: 500;
  color: var(--fg-default); letter-spacing: -0.015em;
}

/* ═══════════════════════════════════════════════════════════
   ERROR CARD
═══════════════════════════════════════════════════════════ */
.da-error-card {
  max-width: 420px; padding: 32px;
  border-radius: 18px; background: var(--bg-raised);
  border: 1px solid rgba(244,63,94,0.25); text-align: center;
}

/* ── Reduced motion ────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-delay: 0ms !important;
    transition-duration: 1ms !important;
  }
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
    try { return readStoredTheme(); } catch {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem("da-theme", mode); } catch {}
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode === "light" ? "light" : "dark";
    applyThemeCssVariables(mode);
  }, [mode]);

  const toggle = useCallback(() => setMode(p => p === "light" ? "dark" : "light"), []);
  return { mode, toggle } as const;
}

function useViewportWidth() {
  const [w, setW] = useState(() => typeof window === "undefined" ? 1440 : window.innerWidth);
  useEffect(() => {
    let raf: number;
    const fn = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setW(window.innerWidth)); };
    window.addEventListener("resize", fn);
    return () => { window.removeEventListener("resize", fn); cancelAnimationFrame(raf); };
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

function getActiveRouteLabel(pathname: string, items: readonly NavItem[]): string {
  return items.find(i => i.path === pathname)?.label ?? "Workspace";
}

function getUserInitials(profile: UserProfile): string {
  const name = profile.display_name || profile.agent_name || profile.email || "?";
  const parts = name.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function buildNavItems(profile: UserProfile): NavItem[] {
  const isAdmin = profile.role === "admin";
  const isStaff = isAdmin || profile.role === "qa";
  const isSupervisor = profile.role === "supervisor";

  const item = (path: RoutePath, label: string): NavItem => ({
    path, label,
    group: getNavGroup(label),
    shortcut: NAV_SHORTCUTS[label],
  });

  if (isSupervisor) {
    return [
      item(ROUTES.supervisorOverview,      "Overview"),
      item(ROUTES.supervisorTeamDashboard, "Team Dashboard"),
      item(ROUTES.supervisorRequestsView,  "Supervisor Requests"),
      item(ROUTES.supervisorProfile,       "My Supervisor Profile"),
    ];
  }

  if (!isStaff) return [];

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
  ];

  if (isAdmin) {
    items.push(
      item(ROUTES.accounts,           "Accounts"),
      item(ROUTES.supervisorRequests, "Supervisor Requests"),
    );
  }

  items.push(
    item(ROUTES.reports, "Reports"),
    item(ROUTES.profile, isAdmin ? "My Admin Profile" : "My QA Profile"),
  );

  return items;
}

/** Returns inline style vars for a nav item's accent colour */
function accentStyle(group: string): CSSProperties {
  const hex = GROUP_ACCENT_HEX[group] ?? "#3b82f6";
  // Parse r,g,b from hex for rgba() fallback (no color-mix() dependency)
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    "--item-accent": GROUP_ACCENT[group] ?? "var(--c-blue)",
    "--item-accent-rgb": `${r},${g},${b}`,
  } as CSSProperties;
}

// ─────────────────────────────────────────────────────────────
// Icons — inline SVG
// ─────────────────────────────────────────────────────────────

type IconProps = { size?: number };

const svgBase = (size: number) => ({
  width: size, height: size,
  viewBox: "0 0 24 24" as const,
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

const SearchIcon = memo(({ size = 15 }: IconProps) => (
  <svg {...svgBase(size)}>
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
));

const SunIcon = memo(({ size = 14 }: IconProps) => (
  <svg {...svgBase(size)}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
));

const MoonIcon = memo(({ size = 14 }: IconProps) => (
  <svg {...svgBase(size)}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
));

const LogOutIcon = memo(({ size = 13 }: IconProps) => (
  <svg {...svgBase(size)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
));

const MenuIcon = memo(({ size = 15 }: IconProps) => (
  <svg {...svgBase(size)}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
));

const NavIcon = memo(function NavIcon({ label, size = 15 }: { label: string; size?: number }) {
  const p = svgBase(size);

  const icons: Record<string, ReactNode> = {
    Dashboard: <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>,
    "New Audit": <svg {...p}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>,
    "Audits Upload": <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
    "Audits List": <svg {...p}><line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" /><circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none" /><circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none" /></svg>,
    "Calls Upload": <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.93 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
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
  };

  return icons[label] ?? (
    <svg {...p}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></svg>
  );
});

// ─────────────────────────────────────────────────────────────
// LiveClock — ref-backed ticker, parent never re-renders
// ─────────────────────────────────────────────────────────────

const LiveClock = memo(function LiveClock() {
  const hhRef = useRef<HTMLSpanElement>(null);
  const mmRef = useRef<HTMLSpanElement>(null);
  const ssRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let id: ReturnType<typeof setInterval>;

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
    // Align to the next second boundary to reduce drift
    const delay = 1000 - (Date.now() % 1000);
    const timer = setTimeout(() => { tick(); id = setInterval(tick, 1000); }, delay);

    return () => { clearTimeout(timer); clearInterval(id); };
  }, []);

  return (
    <div className="da-clock">
      <span ref={hhRef} />
      <span className="da-clock-sep">:</span>
      <span ref={mmRef} />
      <span className="da-clock-sep" style={{ animationDelay: "0.5s" }}>:</span>
      <span ref={ssRef} style={{ opacity: 0.45 }} />
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Command Palette
// ─────────────────────────────────────────────────────────────

interface CmdPaletteProps {
  items: readonly NavItem[];
  onNavigate: (path: RoutePath) => void;
  onClose: () => void;
}

const CommandPalette = memo(function CommandPalette({ items, onNavigate, onClose }: CmdPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Group filtered results
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter(i => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q))
      : items;

    const map: Record<string, NavItem[]> = {};
    filtered.forEach(item => {
      if (!map[item.group]) map[item.group] = [];
      map[item.group].push(item);
    });
    return map;
  }, [query, items]);

  const flatFiltered = useMemo(() => Object.values(grouped).flat(), [grouped]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, flatFiltered.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && flatFiltered[selected]) { onNavigate(flatFiltered[selected].path); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flatFiltered, selected, onNavigate, onClose]);

  let globalIdx = 0;

  return (
    <div className="da-cmd-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="da-cmd-dialog" role="dialog" aria-label="Command palette" aria-modal="true">
        <div className="da-cmd-header">
          <SearchIcon size={16} />
          <input
            ref={inputRef}
            className="da-cmd-input"
            placeholder="Search pages…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search pages"
          />
          <span className="da-cmd-esc">ESC</span>
        </div>

        <div className="da-cmd-body" role="listbox">
          {flatFiltered.length === 0 ? (
            <div className="da-cmd-empty">No pages match "{query}"</div>
          ) : (
            Object.entries(grouped).map(([group, groupItems]) => {
              const groupAccent = GROUP_ACCENT_HEX[group] ?? "#3b82f6";
              return (
                <div key={group}>
                  <div className="da-cmd-section-hdr">{group}</div>
                  {groupItems.map(item => {
                    const idx = globalIdx++;
                    const isSelected = idx === selected;
                    return (
                      <div
                        key={item.path}
                        role="option"
                        aria-selected={isSelected}
                        className="da-cmd-item"
                        onClick={() => { onNavigate(item.path); onClose(); }}
                        onMouseEnter={() => setSelected(idx)}
                      >
                        <div
                          className="da-cmd-item-icon"
                          style={{ background: `${groupAccent}18`, color: groupAccent }}
                        >
                          <NavIcon label={item.label} size={14} />
                        </div>
                        <span className="da-cmd-item-label">{item.label}</span>
                        <span className="da-cmd-item-group">{group}</span>
                        {item.shortcut && <span className="da-cmd-shortcut">{item.shortcut}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="da-cmd-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> go</span>
          <span><kbd>esc</kbd> close</span>
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
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onLogout: () => void;
}

const Sidebar = memo(function Sidebar({
  navGroupsOrdered,
  activePath,
  isExpanded,
  profile,
  userInitials,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
  onLogout,
}: SidebarProps) {
  const name = profile.display_name || profile.agent_name || profile.email || "";
  const roleColor = ROLE_COLORS[profile.role ?? "qa"] ?? "#3b82f6";

  return (
    <nav
      className={`da-sidebar${isExpanded ? " expanded" : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="da-sidebar-header">
        <div className="da-sidebar-logo-wrap">
          <img src={LOGO_MARK_SRC} alt="" width={22} height={22} style={{ objectFit: "contain", display: "block" }} />
        </div>
        <div className="da-sidebar-brand">
          <div className="da-brand-name">Detroit Axle</div>
          <div className="da-brand-sub">QA Platform</div>
        </div>
      </div>

      {/* Nav */}
      <div className="da-nav-rail">
        {navGroupsOrdered.map(([group, groupItems]) => (
          <div key={group} className="da-nav-section">
            <div
              className="da-nav-section-label"
              style={{ color: GROUP_ACCENT[group] ?? "var(--fg-subtle)" }}
            >
              {group}
            </div>
            {groupItems.map(item => {
              const isActive = activePath === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  className={`da-nav-item${isActive ? " active" : ""}`}
                  onClick={() => onNavigate(item.path)}
                  aria-current={isActive ? "page" : undefined}
                  title={item.label}
                  style={accentStyle(item.group)}
                >
                  <div className="da-nav-pip" />
                  <span className="da-nav-icon"><NavIcon label={item.label} size={15} /></span>
                  <span className="da-nav-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User */}
      <div className="da-sidebar-user">
        <div className="da-sidebar-user-row">
          <div
            className="da-avatar"
            style={{
              background: `${roleColor}22`,
              border: `1.5px solid ${roleColor}44`,
              color: roleColor,
            }}
          >
            {userInitials}
            <div className="da-avatar-online" />
          </div>
          <div className="da-user-info">
            <div className="da-user-name">{name}</div>
            <div className="da-user-role" style={{ color: roleColor }}>{profile.role}</div>
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
});

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

interface HeaderProps {
  isCompact: boolean;
  hasSidebar: boolean;
  isPinned: boolean;
  activeLabel: string;
  profile: UserProfile;
  userInitials: string;
  themeMode: ThemeMode;
  onTogglePin: () => void;
  onToggleTheme: () => void;
  onOpenCmd: () => void;
  onLogout: () => void;
}

const Header = memo(function Header({
  isCompact,
  hasSidebar,
  isPinned,
  activeLabel,
  profile,
  userInitials,
  themeMode,
  onTogglePin,
  onToggleTheme,
  onOpenCmd,
  onLogout,
}: HeaderProps) {
  const isDark = themeMode === "dark";
  const roleColor = ROLE_COLORS[profile.role ?? "qa"] ?? "#3b82f6";
  const displayName = profile.display_name || profile.agent_name || profile.email || "";

  return (
    <header className="da-header">
      <div className="da-header-left">
        {hasSidebar && !isCompact && (
          <button
            type="button"
            className={`da-icon-btn da-pin-btn${isPinned ? " pinned" : ""}`}
            onClick={onTogglePin}
            aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
            title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            <MenuIcon size={15} />
          </button>
        )}

        {!isCompact && hasSidebar && (
          <>
            <div className="da-div" />
            <div className="da-status-dot" title="Connected" />
            <nav className="da-breadcrumb" aria-label="Breadcrumb">
              <span className="da-bc-root">Workspace</span>
              <span className="da-bc-sep">›</span>
              <span key={activeLabel} className="da-bc-current">{activeLabel}</span>
            </nav>
          </>
        )}

        {isCompact && (
          <img src={LOGO_WORDMARK_SRC} alt="Detroit Axle" height={26} style={{ objectFit: "contain" }} />
        )}
      </div>

      <div className="da-header-right">
        {!isCompact && <LiveClock />}
        {!isCompact && <div className="da-div" />}

        {/* ⌘K */}
        <button type="button" className="da-pill" onClick={onOpenCmd} aria-label="Open command palette">
          <SearchIcon size={13} />
          {!isCompact && <span>Search</span>}
          {!isCompact && (
            <kbd style={{ fontFamily: "var(--font-mono)", fontSize: "10px", background: "var(--bg-tint)", border: "1px solid var(--border-strong)", borderRadius: "4px", padding: "1px 5px", color: "var(--fg-muted)" }}>
              ⌘K
            </kbd>
          )}
        </button>

        {/* Theme */}
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
            <div className="da-chip-avatar" style={{ background: roleColor + "cc" }}>
              {userInitials}
            </div>
            <div>
              <div className="da-chip-name">{displayName}</div>
              <div className="da-chip-role" style={{ color: roleColor }}>{profile.role}</div>
            </div>
          </div>
        )}

        {/* Sign out */}
        <button type="button" className="da-signout-btn" onClick={onLogout} aria-label="Sign out">
          <LogOutIcon size={12} />
          {!isCompact && "Sign out"}
        </button>
      </div>
    </header>
  );
});

// ─────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────

const RotorVisual = memo(function RotorVisual() {
  const bolts = [0, 60, 120, 180, 240, 300];
  const vents  = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <div className="da-loader-visual" aria-hidden>
      <div className="da-loader-disc">
        <svg viewBox="0 0 140 140" width="120" height="120">
          <defs>
            <radialGradient id="rg-metal" cx="48%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#f3f6fb" />
              <stop offset="42%" stopColor="#a4acb8" />
              <stop offset="72%" stopColor="#5d6470" />
              <stop offset="100%" stopColor="#1c2530" />
            </radialGradient>
            <radialGradient id="rg-hub" cx="45%" cy="38%" r="75%">
              <stop offset="0%" stopColor="#cfd6df" />
              <stop offset="70%" stopColor="#3b4456" />
              <stop offset="100%" stopColor="#131922" />
            </radialGradient>
          </defs>
          <circle cx="70" cy="70" r="62" fill="#0a0d14" opacity={0.5} />
          <circle cx="70" cy="70" r="59" fill="url(#rg-metal)" stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
          <circle cx="70" cy="70" r="46" fill="none" stroke="#0c1018" strokeWidth={20} />
          <circle cx="70" cy="70" r="46" fill="none" stroke="url(#rg-metal)" strokeWidth={16} />
          {vents.map(a => (
            <rect key={a} x="67.5" y="15" width="5" height="21" rx="2.5" fill="rgba(0,0,0,0.55)" transform={`rotate(${a} 70 70)`} />
          ))}
          <circle cx="70" cy="70" r="23" fill="url(#rg-hub)" stroke="rgba(255,255,255,0.15)" strokeWidth={1.2} />
          <circle cx="70" cy="70" r="8" fill="#080c13" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
          {bolts.map(a => {
            const rad = (a * Math.PI) / 180;
            return <circle key={a} cx={70 + Math.cos(rad) * 15} cy={70 + Math.sin(rad) * 15} r={2.4} fill="#0c1018" stroke="rgba(255,255,255,0.1)" strokeWidth={0.8} />;
          })}
        </svg>
      </div>
    </div>
  );
});

const Loader = memo(function Loader({ message = "Loading workspace…" }: { message?: string }) {
  return (
    <div className="da-loader-shell" role="status" aria-label={message}>
      <div className="da-loader-card">
        <RotorVisual />
        <div className="da-loader-copy">
          <div className="da-loader-eyebrow">Detroit Axle QA</div>
          <div className="da-loader-headline">{message}</div>
          <div className="da-loader-sub">Checking rotors, calipers, and credentials.</div>
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
  const roleColor = ROLE_COLORS[profile.role ?? "qa"] ?? "#3b82f6";

  const fields: [string, string][] = [
    ["Name",         profile.agent_name    || "—"],
    ["Display name", profile.display_name  || "—"],
    ["Email",        profile.email         || "—"],
    ["Role",         profile.role          || "—"],
    ["Agent ID",     profile.agent_id      || "—"],
    ["Team",         profile.team          || "—"],
  ];

  return (
    <div className="da-profile-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: roleColor + "22",
          border: `2px solid ${roleColor}44`,
          display: "grid", placeItems: "center",
          fontSize: 18, fontWeight: 700, color: roleColor,
          fontFamily: "var(--font-display)",
          letterSpacing: "-0.025em",
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: 5 }}>
            Profile
          </div>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--fg-default)", letterSpacing: "-0.03em" }}>
            {title}
          </h2>
        </div>
      </div>
      <div className="da-profile-grid">
        {fields.map(([label, value]) => (
          <div key={label} className="da-profile-field">
            <div className="da-pf-label">{label}</div>
            <div className="da-pf-value">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Animated route wrapper — re-keys on pathname to re-trigger entrance
// ─────────────────────────────────────────────────────────────

function RouteView({ children, pathKey }: { children: ReactNode; pathKey: string }) {
  return (
    <div key={pathKey} className="da-route-view">
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Route Trees
// ─────────────────────────────────────────────────────────────

const StaffRoutes = memo(function StaffRoutes({ profile }: { profile: UserProfile }) {
  const isAdmin = profile.role === "admin";
  const isStaff = isAdmin || profile.role === "qa";

  return (
    <Routes>
      <Route path={ROUTES.dashboard}       element={<Dashboard />} />
      <Route path={ROUTES.newAudit}        element={<NewAuditSupabase />} />
      <Route path={ROUTES.auditsUpload}    element={<AuditsImportSupabase />} />
      <Route path={ROUTES.auditsList}      element={<AuditsListSupabase />} />
      <Route path={ROUTES.callsUpload}     element={<CallsUploadSupabase />} />
      <Route path={ROUTES.ticketsUpload}   element={<TicketsUploadSupabase />} />
      <Route path={ROUTES.ticketEvidence}  element={<TicketEvidenceUploadSupabase />} />
      <Route path={ROUTES.ticketAiReview}  element={<TicketAIReviewQueueSupabase />} />
      <Route path={ROUTES.salesUpload}     element={<SalesUploadSupabase />} />
      <Route path={ROUTES.agentFeedback}   element={<AgentFeedbackSupabase />} />
      <Route path={ROUTES.monitoring}      element={<MonitoringSupabase />} />
      <Route path={ROUTES.teamHeatmap}     element={<TeamHeatmapSupabase currentUser={profile} />} />
      {isAdmin && <Route path={ROUTES.accounts}           element={<AccountsSupabase />} />}
      {isAdmin && <Route path={ROUTES.supervisorRequests} element={<SupervisorRequestsSupabase currentUser={profile} />} />}
      {isStaff && <Route path={ROUTES.reports}            element={<ReportsSupabase />} />}
      <Route path={ROUTES.profile} element={
        <ProfilePanel title={isAdmin ? "My Admin Profile" : "My QA Profile"} profile={profile} />
      } />
      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  );
});

const SupervisorRoutes = memo(function SupervisorRoutes({ profile }: { profile: UserProfile }) {
  return (
    <Routes>
      <Route path={ROUTES.supervisorOverview}      element={<SupervisorPortal currentUser={profile} initialTab="overview"       hideInternalTabs />} />
      <Route path={ROUTES.supervisorTeamDashboard} element={<SupervisorPortal currentUser={profile} initialTab="team-dashboard" hideInternalTabs />} />
      <Route path={ROUTES.supervisorRequestsView}  element={<SupervisorPortal currentUser={profile} initialTab="requests"       hideInternalTabs />} />
      <Route path={ROUTES.supervisorProfile}       element={<ProfilePanel title="My Supervisor Profile" profile={profile} />} />
      <Route path="*"                              element={<Navigate to={ROUTES.supervisorOverview} replace />} />
    </Routes>
  );
});

// ─────────────────────────────────────────────────────────────
// AppShell
// ─────────────────────────────────────────────────────────────

function AppShell() {
  const auth = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();
  const viewport = useViewportWidth();
  const { mode: themeMode, toggle: toggleTheme } = useTheme();
  const [, startTransition] = useTransition();

  useGlobalStyles();

  // ── Sidebar state — single enum avoids ref/state desync ────
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("closed");
  const [isCmdOpen, setCmdOpen] = useState(false);

  const isCompact = viewport < COMPACT_BP;
  const isSidebarExpanded = !isCompact && sidebarMode !== "closed";
  const isPinned = sidebarMode === "pinned";

  // Drive CSS var for sidebar width
  const sidebarWidth = isSidebarExpanded ? SIDEBAR_W_EXPANDED : SIDEBAR_W_COLLAPSED;

  // Reset to closed when viewport becomes compact
  useEffect(() => {
    if (isCompact) setSidebarMode("closed");
  }, [isCompact]);

  // Sync header left offset via CSS var on root for the header's `left` transition
  useEffect(() => {
    document.documentElement.style.setProperty("--sb-w", `${sidebarWidth}px`);
  }, [sidebarWidth]);

  // Theme attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  // ⌘K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(o => !o); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  // ── Stable callbacks ────────────────────────────────────────
  const handleNavigate = useCallback((path: RoutePath) => {
    startTransition(() => { navigate(path); });
    setCmdOpen(false);
  }, [navigate, startTransition]);

  const handleTogglePin = useCallback(() => {
    setSidebarMode(m => m === "pinned" ? "closed" : "pinned");
  }, []);

  const handleSidebarEnter = useCallback(() => {
    setSidebarMode(m => m === "pinned" ? "pinned" : "hover");
  }, []);

  const handleSidebarLeave = useCallback(() => {
    setSidebarMode(m => m === "pinned" ? "pinned" : "closed");
  }, []);

  const handleLogout = useCallback(() => auth.logout(), [auth]);
  const handleOpenCmd  = useCallback(() => setCmdOpen(true), []);
  const handleCloseCmd = useCallback(() => setCmdOpen(false), []);

  // ── Derived ────────────────────────────────────────────────
  const { profile, loading, recoveryMode, logout, handleRecoveryComplete } = auth;

  const navItems = useMemo(() => profile ? buildNavItems(profile) : [], [profile]);

  const navGroupsOrdered = useMemo<[string, NavItem[]][]>(() => {
    const map: Record<string, NavItem[]> = {};
    navItems.forEach(item => {
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
  if (recoveryMode) return <ResetPassword onComplete={handleRecoveryComplete} onLogout={logout} />;
  if (!auth.session)  return <Login />;

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="da-error-card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--c-rose)", marginBottom: 8 }}>
            Profile error
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--fg-default)", marginBottom: 10 }}>
            Profile not found
          </h1>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--fg-muted)", lineHeight: 1.6, marginBottom: 20 }}>
            {auth.profileError || "This account exists in Auth but has no profile row."}
          </p>
          <button onClick={logout} className="da-signout-btn" style={{ margin: "0 auto" }}>
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
  const hasSidebar   = isStaff || isSupervisor;
  const userInitials = getUserInitials(profile);

  return (
    <AuthContext.Provider value={{ profile, loading: false, logout }}>
      {isCmdOpen && (
        <CommandPalette items={navItems} onNavigate={handleNavigate} onClose={handleCloseCmd} />
      )}

      <div
        className="da-shell"
        style={{ "--sb-w": `${sidebarWidth}px` } as CSSProperties}
      >
        {hasSidebar && (
          <Sidebar
            navGroupsOrdered={navGroupsOrdered}
            activePath={location.pathname}
            isExpanded={isSidebarExpanded}
            profile={profile}
            userInitials={userInitials}
            onNavigate={handleNavigate}
            onMouseEnter={handleSidebarEnter}
            onMouseLeave={handleSidebarLeave}
            onLogout={handleLogout}
          />
        )}

        <div className="da-page-root" style={{ marginLeft: sidebarWidth }}>
          <Header
            isCompact={isCompact}
            hasSidebar={hasSidebar}
            isPinned={isPinned}
            activeLabel={activeLabel}
            profile={profile}
            userInitials={userInitials}
            themeMode={themeMode}
            onTogglePin={handleTogglePin}
            onToggleTheme={toggleTheme}
            onOpenCmd={handleOpenCmd}
            onLogout={handleLogout}
          />

          <main>
            {hasSidebar ? (
              <>
                {isCompact && (
                  <nav className="da-compact-nav" aria-label="Mobile navigation">
                    {navItems.map(item => {
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          className={`da-compact-nav-item${isActive ? " active" : ""}`}
                          onClick={() => handleNavigate(item.path)}
                          style={accentStyle(item.group)}
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
                  <RouteView pathKey={location.pathname}>
                    {isStaff ? <StaffRoutes profile={profile} /> : <SupervisorRoutes profile={profile} />}
                  </RouteView>
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

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
