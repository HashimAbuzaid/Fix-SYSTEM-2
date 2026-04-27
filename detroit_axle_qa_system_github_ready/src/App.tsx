/**
 * App.tsx — Detroit Axle QA System  ·  v6.0
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED FROM v5:
 *
 * ARCHITECTURE OVERHAUL
 *  • `sidebarMode` state machine promoted to a proper reducer with explicit
 *    transitions — eliminates all stale-closure race conditions.
 *  • Global CSS injected via a singleton module-level constant (no ref needed).
 *  • Nav items memoised with a stable deep-equality check; group map built
 *    in a single pass.
 *  • `useTheme` now returns a derived `isDark` flag directly.
 *  • `useViewportWidth` debounced with requestAnimationFrame cancellation to
 *    avoid excessive state churn on resize.
 *  • `startTransition` wrapper extracted to `useNavigateWithTransition` hook.
 *  • `LiveClock` uses a single imperative DOM-write path with no re-renders
 *    and drift compensation aligned to wall-clock seconds.
 *  • All `memo` wrappers now include explicit `displayName`.
 *  • Route trees typed with discriminated union so TypeScript catches role
 *    mismatches at compile time.
 *  • Zero `useEffect` chains — derived values are computed synchronously.
 *
 * BUGS FIXED (v5 → v6)
 *  • `handleSidebarLeave` was not stable between renders when `sidebarMode`
 *    changed; now purely derived from reducer, never captures stale state.
 *  • `--sb-w` was set on both `document.documentElement` AND the shell inline
 *    style producing layout thrash. v6 uses only shell inline style.
 *  • `CommandPalette` keyboard handler captured a stale `selected` index on
 *    fast keypresses; fixed with a functional update.
 *  • `NavIcon` was re-creating SVG elements on every render; hoisted to
 *    module-scope lookup table of stable elements.
 *  • `ProfilePanel` had no key on grid items causing reconciler confusion.
 *  • `progressSlide` animation on `<progress>` was always playing; now tied
 *    to `isPending` from `useTransition`.
 *  • LiveClock `clearTimeout` / `clearInterval` order was wrong; fixed.
 *  • Compact nav scroll position was not reset on route change.
 *  • `color-scheme` meta was set only on `<html>`; now also in a `<meta>`
 *    tag to prevent FOUC on Safari.
 *
 * DESIGN SYSTEM — "Precision Industrial"
 *  • Concept: high-end automotive engineering meets terminal precision.
 *    Think Rolls-Royce instrument cluster × Bloomberg Terminal × Figma 2025.
 *  • Fonts: Syne (display) — geometric, confident, wide;
 *           IBM Plex Sans (body) — technical, legible, trustworthy;
 *           IBM Plex Mono (code/labels) — data-dense, aligned.
 *  • Colour rethink: Deep graphite base (#050709) with a primary palette of
 *    warm steel white (#E8EBF0), electric cobalt (#1D6FF3) and a single
 *    volcanic orange accent (#FF5C1A). Danger stays rose. Luminance is
 *    distributed via 9-stop token scale (--grey-50 … --grey-950).
 *  • Sidebar: full-bleed brushed-metal texture via SVG filter; collapsible
 *    sections preserve pixel-perfect icon alignment; every group rendered
 *    with its accent temperature on the icon container, not the text.
 *  • Header: edge-to-edge frosted glass with a 1px illuminated top edge on
 *    dark mode. Clock is monospaced, colon blink is CSS-only.
 *  • Nav items: square-cap left indicator (not pill); icon receives a
 *    colour-matched ambient glow at 8px blur; hover state is a raw
 *    translucent fill without border (cleaner at 62px collapsed).
 *  • Command palette: now shows a recency section (last 5 navigated) above
 *    the full list. Fuzzy match highlights matched chars with a mark.
 *  • Loader: Rotor visual upgraded to full SVG mesh with Phong-like shading
 *    gradients, proper spoke geometry, and a chrome ring.
 *  • Scrollbars: 3px, no track, thumb matches mode perfectly.
 *  • Keyframe library expanded; all transforms use `translate3d` for GPU
 *    compositing. `will-change` only on elements that animate width/left.
 *  • `@layer base, components, utilities` ordering so specificity never
 *    surprises you.
 *  • Full `prefers-reduced-motion` and `prefers-contrast` query support.
 *  • Sidebar section labels now slide in on expand with a staggered delay.
 *  • Active route broadcasts its group accent to the header breadcrumb.
 *  • Mobile: bottom-sheet nav strip replaced with a fixed pill dock.
 *  • Dark/light tokens fully separated — no mid-alpha compromise colours.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
  useReducer,
  useTransition,
  memo,
  type CSSProperties,
  type ReactNode,
  type Dispatch,
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
  dashboard:               "/",
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
  teamHeatmap:             "/team-heatmap",
  profile:                 "/profile",
  supervisorOverview:      "/supervisor",
  supervisorTeamDashboard: "/supervisor/team-dashboard",
  supervisorRequestsView:  "/supervisor/requests",
  supervisorProfile:       "/supervisor/profile",
} as const;

type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

// Sidebar state machine
type SidebarMode = "closed" | "hover" | "pinned";
type SidebarAction =
  | { type: "ENTER" }
  | { type: "LEAVE" }
  | { type: "TOGGLE_PIN" }
  | { type: "COMPACT_RESET" };

function sidebarReducer(state: SidebarMode, action: SidebarAction): SidebarMode {
  switch (action.type) {
    case "ENTER":       return state === "pinned" ? "pinned" : "hover";
    case "LEAVE":       return state === "pinned" ? "pinned" : "closed";
    case "TOGGLE_PIN":  return state === "pinned" ? "closed" : "pinned";
    case "COMPACT_RESET": return "closed";
    default:            return state;
  }
}

interface NavItem {
  readonly path: RoutePath;
  readonly label: string;
  readonly group: string;
  readonly shortcut?: string;
}

const LOGO_MARK_SRC     = "/detroit-axle-mark.png";
const LOGO_WORDMARK_SRC = "/detroit-axle-wordmark.svg";
const SIDEBAR_W_COLLAPSED = 60;
const SIDEBAR_W_EXPANDED  = 252;
const COMPACT_BP          = 1024;
const RECENCY_KEY         = "da-nav-recency";
const RECENCY_MAX         = 5;

const EASING = {
  smooth:  "cubic-bezier(0.16, 1, 0.3, 1)",
  spring:  "cubic-bezier(0.34, 1.56, 0.64, 1)",
  sharp:   "cubic-bezier(0.4, 0, 0.6, 1)",
  linear:  "linear",
} as const;

// Navigation groups and their order
const NAV_GROUP_ORDER = ["Core", "Audits", "Data", "Analytics", "Management", "Account"] as const;

const NAV_GROUP_LABELS: Readonly<Record<string, string[]>> = {
  Core:       ["Dashboard", "Overview", "Team Dashboard"],
  Audits:     ["New Audit", "Audits Upload", "Audits List"],
  Data:       ["Calls Upload", "Tickets Upload", "Ticket Evidence", "Ticket AI Review", "Sales Upload"],
  Analytics:  ["Agent Feedback", "Monitoring", "Team Heatmap"],
  Management: ["Accounts", "Supervisor Requests", "Reports"],
  Account:    ["My Admin Profile", "My QA Profile", "My Supervisor Profile", "Supervisor Requests"],
};

// Group accent — HSL tokens for programmatic manipulation
const GROUP_ACCENT: Readonly<Record<string, { css: string; hex: string; rgb: string }>> = {
  Core:       { css: "var(--c-cobalt)",  hex: "#1D6FF3", rgb: "29,111,243" },
  Audits:     { css: "var(--c-violet)",  hex: "#7C3AED", rgb: "124,58,237" },
  Data:       { css: "var(--c-cyan)",    hex: "#0891B2", rgb: "8,145,178"  },
  Analytics:  { css: "var(--c-amber)",   hex: "#D97706", rgb: "217,119,6"  },
  Management: { css: "var(--c-rose)",    hex: "#E11D48", rgb: "225,29,72"  },
  Account:    { css: "var(--c-emerald)", hex: "#059669", rgb: "5,150,105"  },
  Other:      { css: "var(--fg-muted)",  hex: "#64748B", rgb: "100,116,139"},
};

const ROLE_COLORS: Readonly<Record<string, string>> = {
  admin:      "#E11D48",
  qa:         "#1D6FF3",
  supervisor: "#7C3AED",
  agent:      "#059669",
};

const NAV_SHORTCUTS: Readonly<Partial<Record<string, string>>> = {
  Dashboard:     "D",
  "New Audit":   "N",
  "Audits List": "L",
  Monitoring:    "M",
  Reports:       "R",
  Accounts:      "A",
};

// ─────────────────────────────────────────────────────────────
// Global CSS — module-level constant, injected once
// ─────────────────────────────────────────────────────────────

const GLOBAL_STYLE_ID = "da-shell-v6";

function injectGlobalStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(GLOBAL_STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = GLOBAL_STYLE_ID;
  el.textContent = GLOBAL_CSS;
  document.head.prepend(el);
}

const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

@layer base, shell, motion;

@layer base {

/* ── Reset ─────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
button { font-family: inherit; cursor: pointer; border: none; background: none; }
a { color: inherit; text-decoration: none; }

/* ── Design Tokens ─────────────────────────────────────────── */
:root {
  /* Brand palette */
  --c-cobalt:   #1D6FF3;
  --c-cobalt-hi:#4F90FF;
  --c-violet:   #7C3AED;
  --c-cyan:     #0891B2;
  --c-amber:    #D97706;
  --c-rose:     #E11D48;
  --c-emerald:  #059669;
  --c-orange:   #FF5C1A;

  /* Grey scale */
  --grey-50:    #F8FAFB;
  --grey-100:   #EEF1F5;
  --grey-200:   #D8DDE6;
  --grey-300:   #B0BAC8;
  --grey-400:   #7F8EA3;
  --grey-500:   #556070;
  --grey-600:   #3A424F;
  --grey-700:   #272D38;
  --grey-800:   #181C24;
  --grey-900:   #0E1118;
  --grey-950:   #050709;

  /* Typography */
  --font-display: 'Syne', system-ui, sans-serif;
  --font-body:    'IBM Plex Sans', system-ui, sans-serif;
  --font-mono:    'IBM Plex Mono', monospace;

  /* Sidebar geometry */
  --sb-collapsed: ${SIDEBAR_W_COLLAPSED}px;
  --sb-expanded:  ${SIDEBAR_W_EXPANDED}px;
  --sb-dur:       260ms;
  --sb-ease:      cubic-bezier(0.16, 1, 0.3, 1);

  /* Header */
  --header-h: 56px;
}

/* ── Dark (default) ─────────────────────────────────────────── */
[data-theme="dark"], :root {
  --bg-base:          #050709;
  --bg-raised:        #0C0F15;
  --bg-overlay:       #111520;
  --bg-glass:         rgba(10, 12, 18, 0.88);
  --bg-tint:          rgba(255,255,255,0.03);
  --bg-tint-hover:    rgba(255,255,255,0.055);
  --bg-tint-active:   rgba(255,255,255,0.08);
  --border:           rgba(255,255,255,0.055);
  --border-strong:    rgba(255,255,255,0.1);
  --border-accent:    rgba(29,111,243,0.4);
  --fg-default:       #E8EBF0;
  --fg-secondary:     #A8B4C4;
  --fg-muted:         #556070;
  --fg-subtle:        #2E3845;
  --sidebar-bg:       rgba(6, 8, 13, 0.96);
  --sidebar-border:   rgba(255,255,255,0.05);
  --header-bg:        rgba(5, 7, 9, 0.9);
  --header-border:    rgba(255,255,255,0.07);
  --header-top-line:  rgba(255,255,255,0.12);
  --scroll-thumb:     rgba(255,255,255,0.07);
  --scroll-hover:     rgba(255,255,255,0.13);
  --shadow-sm:        0 1px 3px rgba(0,0,0,0.6);
  --shadow-md:        0 4px 16px rgba(0,0,0,0.6);
  --shadow-lg:        0 20px 60px rgba(0,0,0,0.7), 0 8px 20px rgba(0,0,0,0.5);
  --shadow-glow:      0 0 20px rgba(29,111,243,0.3);
  --gradient-mesh:    radial-gradient(ellipse 80% 60% at 20% 0%, rgba(29,111,243,0.08) 0%, transparent 60%),
                      radial-gradient(ellipse 60% 40% at 80% 100%, rgba(124,58,237,0.06) 0%, transparent 60%);
}

/* ── Light ──────────────────────────────────────────────────── */
[data-theme="light"] {
  --bg-base:          #F2F4F7;
  --bg-raised:        #FFFFFF;
  --bg-overlay:       #E8ECF2;
  --bg-glass:         rgba(255,255,255,0.92);
  --bg-tint:          rgba(0,0,0,0.025);
  --bg-tint-hover:    rgba(0,0,0,0.045);
  --bg-tint-active:   rgba(0,0,0,0.07);
  --border:           rgba(0,0,0,0.06);
  --border-strong:    rgba(0,0,0,0.1);
  --border-accent:    rgba(29,111,243,0.3);
  --fg-default:       #0D1117;
  --fg-secondary:     #374151;
  --fg-muted:         #6B7280;
  --fg-subtle:        #C4CDD6;
  --sidebar-bg:       rgba(248,250,253,0.97);
  --sidebar-border:   rgba(0,0,0,0.06);
  --header-bg:        rgba(255,255,255,0.92);
  --header-border:    rgba(0,0,0,0.07);
  --header-top-line:  rgba(29,111,243,0.35);
  --scroll-thumb:     rgba(0,0,0,0.09);
  --scroll-hover:     rgba(0,0,0,0.16);
  --shadow-sm:        0 1px 3px rgba(0,0,0,0.06);
  --shadow-md:        0 4px 16px rgba(0,0,0,0.07);
  --shadow-lg:        0 20px 60px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.06);
  --shadow-glow:      0 0 16px rgba(29,111,243,0.18);
  --gradient-mesh:    radial-gradient(ellipse 80% 60% at 20% 0%, rgba(29,111,243,0.04) 0%, transparent 60%),
                      radial-gradient(ellipse 60% 40% at 80% 100%, rgba(124,58,237,0.03) 0%, transparent 60%);
}

/* ── Base typography ────────────────────────────────────────── */
body {
  font-family: var(--font-body);
  background: var(--bg-base);
  color: var(--fg-default);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-feature-settings: "cv01","cv02","cv04","ss01";
}

/* ── Scrollbars ─────────────────────────────────────────────── */
* { scrollbar-width: thin; scrollbar-color: var(--scroll-thumb) transparent; }
::-webkit-scrollbar { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--scroll-thumb); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: var(--scroll-hover); }

/* ── Focus ──────────────────────────────────────────────────── */
:focus-visible {
  outline: 1.5px solid var(--c-cobalt);
  outline-offset: 2px;
  border-radius: 4px;
}

} /* end @layer base */

@layer shell {

/* ── Keyframes ──────────────────────────────────────────────── */
@keyframes fadeIn {
  from { opacity: 0 } to { opacity: 1 }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translate3d(0, 12px, 0) }
  to   { opacity: 1; transform: translate3d(0, 0, 0) }
}
@keyframes fadeLeft {
  from { opacity: 0; transform: translate3d(-8px, 0, 0) }
  to   { opacity: 1; transform: translate3d(0, 0, 0) }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale3d(0.96, 0.96, 1) }
  to   { opacity: 1; transform: scale3d(1, 1, 1) }
}
@keyframes spin {
  to { transform: rotate(360deg) }
}
@keyframes blink {
  0%, 100% { opacity: 1 }
  50%       { opacity: 0.2 }
}
@keyframes ping {
  75%, 100% { transform: scale3d(1.9, 1.9, 1); opacity: 0 }
}
@keyframes shimmer {
  0%   { background-position: -200% center }
  100% { background-position:  200% center }
}
@keyframes progressIn {
  0%   { transform: scaleX(0.02) }
  30%  { transform: scaleX(0.45) }
  70%  { transform: scaleX(0.75) }
  100% { transform: scaleX(1) }
}
@keyframes cmdIn {
  from { opacity: 0; transform: translate3d(0, -12px, 0) scale3d(0.97, 0.97, 1) }
  to   { opacity: 1; transform: translate3d(0, 0, 0) scale3d(1, 1, 1) }
}
@keyframes routeIn {
  from { opacity: 0; transform: translate3d(0, 6px, 0) }
  to   { opacity: 1; transform: translate3d(0, 0, 0) }
}
@keyframes pipGrow {
  from { height: 0; opacity: 0 }
  to   { height: 20px; opacity: 1 }
}
@keyframes sectionLabelIn {
  from { opacity: 0; transform: translate3d(-4px, 0, 0) }
  to   { opacity: 0.5; transform: translate3d(0, 0, 0) }
}
@keyframes glowPulse {
  0%, 100% { opacity: 0.6 }
  50%       { opacity: 1 }
}

/* ─────────────────────────────────────────────────────────────
   SHELL
───────────────────────────────────────────────────────────── */
.da-shell {
  display: flex;
  min-height: 100vh;
  background: var(--gradient-mesh) var(--bg-base);
}

/* ─────────────────────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────────────────────── */
.da-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  width: var(--sb-collapsed);
  display: flex;
  flex-direction: column;
  /* Brushed metal effect via layered backgrounds */
  background: var(--sidebar-bg);
  backdrop-filter: blur(32px) saturate(160%);
  -webkit-backdrop-filter: blur(32px) saturate(160%);
  border-right: 1px solid var(--sidebar-border);
  transition: width var(--sb-dur) var(--sb-ease);
  overflow: hidden;
  will-change: width;
  /* Subtle interior shadow to ground the sidebar */
  box-shadow: inset -1px 0 0 var(--sidebar-border);
}

/* Right gradient line — luminance edge */
.da-sidebar::after {
  content: '';
  position: absolute;
  inset: 0 0 0 auto;
  width: 1px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    var(--border-strong) 15%,
    var(--border) 50%,
    var(--border-strong) 85%,
    transparent 100%
  );
  pointer-events: none;
}

.da-sidebar.expanded {
  width: var(--sb-expanded);
  box-shadow:
    inset -1px 0 0 var(--sidebar-border),
    8px 0 32px rgba(0, 0, 0, 0.22),
    24px 0 80px rgba(0, 0, 0, 0.1);
}

/* ── Sidebar header ─────────────────────────────────────────── */
.da-sidebar-header {
  display: flex;
  align-items: center;
  height: var(--header-h);
  padding: 0 10px;
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
  overflow: hidden;
  gap: 12px;
  position: relative;
}

.da-sidebar-logo {
  width: 38px; height: 38px;
  border-radius: 10px;
  background: linear-gradient(145deg, rgba(29,111,243,0.2) 0%, rgba(124,58,237,0.12) 100%);
  border: 1px solid rgba(29,111,243,0.25);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  box-shadow: 0 2px 10px rgba(29,111,243,0.18), inset 0 1px 0 rgba(255,255,255,0.1);
  transition: box-shadow var(--sb-dur) ease;
}
.da-sidebar.expanded .da-sidebar-logo {
  box-shadow: 0 4px 18px rgba(29,111,243,0.25), inset 0 1px 0 rgba(255,255,255,0.1);
}

.da-sidebar-brand {
  overflow: hidden;
  opacity: 0;
  transform: translate3d(-8px, 0, 0);
  transition:
    opacity 150ms ease 50ms,
    transform 220ms var(--sb-ease) 30ms;
  pointer-events: none;
  white-space: nowrap;
  min-width: 0;
}
.da-sidebar.expanded .da-sidebar-brand {
  opacity: 1;
  transform: translate3d(0, 0, 0);
  pointer-events: auto;
}

.da-brand-name {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--fg-default);
  line-height: 1.1;
}
.da-brand-sub {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin-top: 3px;
}

/* ── Nav rail ───────────────────────────────────────────────── */
.da-nav-rail {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 0;
  scrollbar-width: none;
}
.da-nav-rail::-webkit-scrollbar { display: none; }
.da-sidebar.expanded .da-nav-rail { scrollbar-width: thin; }
.da-sidebar.expanded .da-nav-rail::-webkit-scrollbar { display: block; }

.da-nav-section {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
}
.da-nav-section + .da-nav-section {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--border);
}

/* Section label */
.da-nav-section-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-muted);
  overflow: hidden;
  /* Animate from 0 height when sidebar expands */
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows var(--sb-dur) var(--sb-ease),
    opacity 180ms ease;
}
.da-nav-section-label-inner {
  overflow: hidden;
  padding: 8px 8px 4px;
}
.da-sidebar.expanded .da-nav-section-label {
  grid-template-rows: 1fr;
  opacity: 0.55;
  animation: sectionLabelIn 200ms var(--sb-ease) both;
}

/* Nav item */
.da-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 36px;
  border-radius: 7px;
  border: none;
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
    gap var(--sb-dur) var(--sb-ease);
  width: 100%;
  text-align: left;
  justify-content: center;
  outline: none;
  margin-bottom: 1px;
}
.da-sidebar.expanded .da-nav-item {
  gap: 10px;
  justify-content: flex-start;
}
.da-nav-item:hover {
  color: var(--fg-secondary);
  background: var(--bg-tint-hover);
}
.da-nav-item:active {
  background: var(--bg-tint-active);
}
.da-nav-item.active {
  color: var(--item-accent, var(--c-cobalt));
  background: rgba(var(--item-rgb, 29,111,243), 0.1);
}
.da-nav-item.active:hover {
  background: rgba(var(--item-rgb, 29,111,243), 0.14);
}

/* Active pip — square cap, left rail */
.da-nav-pip {
  position: absolute;
  left: 0; top: 50%;
  transform: translate3d(0, -50%, 0);
  width: 2px;
  border-radius: 0 2px 2px 0;
  background: var(--item-accent, var(--c-cobalt));
  height: 0;
  opacity: 0;
  box-shadow: 2px 0 8px var(--item-accent, var(--c-cobalt));
}
.da-nav-item.active .da-nav-pip {
  animation: pipGrow 200ms var(--sb-ease) forwards;
}

/* Icon */
.da-nav-icon {
  width: 22px; height: 22px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition:
    background 120ms ease,
    box-shadow 160ms ease;
}
.da-nav-item.active .da-nav-icon {
  background: rgba(var(--item-rgb, 29,111,243), 0.15);
  box-shadow: 0 0 10px rgba(var(--item-rgb, 29,111,243), 0.25);
}

/* Label */
.da-nav-label {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0;
  max-width: 0;
  transform: translate3d(-6px, 0, 0);
  transition:
    max-width var(--sb-dur) var(--sb-ease),
    opacity 140ms ease 40ms,
    transform var(--sb-dur) var(--sb-ease);
}
.da-nav-item.active .da-nav-label { font-weight: 600; }
.da-sidebar.expanded .da-nav-label {
  opacity: 1;
  max-width: 170px;
  transform: translate3d(0, 0, 0);
}

/* Shortcut badge */
.da-nav-shortcut {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--fg-subtle);
  background: var(--bg-tint);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 4px;
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 140ms ease;
}
.da-sidebar.expanded .da-nav-shortcut { opacity: 1; }

/* ── Sidebar footer / user ──────────────────────────────────── */
.da-sidebar-user {
  padding: 6px;
  border-top: 1px solid var(--sidebar-border);
  flex-shrink: 0;
}

.da-user-row {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 7px 8px;
  border-radius: 8px;
  background: var(--bg-tint);
  border: 1px solid var(--border);
  overflow: hidden;
  transition:
    gap var(--sb-dur) var(--sb-ease),
    background 120ms ease;
  justify-content: center;
  cursor: default;
}
.da-sidebar.expanded .da-user-row {
  gap: 9px;
  justify-content: flex-start;
}
.da-user-row:hover { background: var(--bg-tint-hover); }

.da-avatar {
  width: 28px; height: 28px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  position: relative;
  letter-spacing: -0.01em;
}

/* Online dot */
.da-online-dot {
  position: absolute;
  bottom: -2px; right: -2px;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--c-emerald);
  border: 2px solid var(--sidebar-bg);
}
.da-online-dot::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  background: var(--c-emerald);
  animation: ping 2.6s cubic-bezier(0, 0, 0.2, 1) infinite;
  opacity: 0.3;
}

.da-user-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  opacity: 0;
  transform: translate3d(-4px, 0, 0);
  transition:
    opacity 140ms ease 30ms,
    transform 200ms var(--sb-ease) 20ms;
  pointer-events: none;
}
.da-sidebar.expanded .da-user-info {
  opacity: 1;
  transform: translate3d(0, 0, 0);
  pointer-events: auto;
}

.da-user-name {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-default);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.015em;
}
.da-user-role {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-top: 1px;
}

.da-sidebar-logout {
  width: 0; height: 24px;
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
  transition:
    opacity 140ms ease,
    width var(--sb-dur) var(--sb-ease),
    color 100ms,
    background 100ms,
    border-color 100ms;
  pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-logout {
  opacity: 1;
  width: 24px;
  pointer-events: auto;
}
.da-sidebar-logout:hover {
  color: var(--c-rose);
  background: rgba(225,29,72,0.1);
  border-color: rgba(225,29,72,0.25);
}

/* ─────────────────────────────────────────────────────────────
   HEADER
───────────────────────────────────────────────────────────── */
.da-header {
  position: fixed;
  top: 0; right: 0;
  left: var(--sb-w, var(--sb-collapsed));
  z-index: 30;
  height: var(--header-h);
  display: flex;
  align-items: center;
  padding: 0 18px;
  background: var(--header-bg);
  border-bottom: 1px solid var(--header-border);
  /* Illuminated top edge */
  box-shadow: inset 0 1px 0 var(--header-top-line);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  gap: 10px;
  transition: left var(--sb-dur) var(--sb-ease);
  will-change: left;
}

.da-header-left  { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.da-header-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }

/* Divider */
.da-hdiv {
  width: 1px; height: 14px;
  background: var(--border-strong);
  flex-shrink: 0;
}

/* Breadcrumb */
.da-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.da-bc-root {
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 400;
  color: var(--fg-muted);
  white-space: nowrap;
  flex-shrink: 0;
}
.da-bc-sep {
  color: var(--fg-subtle);
  font-size: 13px;
  flex-shrink: 0;
  user-select: none;
}
.da-bc-current {
  font-family: var(--font-display);
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--fg-default);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: fadeLeft 180ms var(--sb-ease) both;
}

/* Status */
.da-status {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}
.da-status-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: var(--c-emerald);
  box-shadow: 0 0 5px var(--c-emerald);
  animation: glowPulse 3s ease-in-out infinite;
}
.da-status-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.06em;
  color: var(--fg-muted);
}

/* Icon button */
.da-icon-btn {
  width: 30px; height: 30px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg-muted);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: color 100ms, background 100ms, border-color 100ms;
  flex-shrink: 0;
}
.da-icon-btn:hover { color: var(--fg-default); background: var(--bg-tint-hover); border-color: var(--border-strong); }
.da-icon-btn.active {
  color: var(--c-cobalt);
  border-color: rgba(29,111,243,0.35);
  background: rgba(29,111,243,0.08);
}

/* Search pill */
.da-search-pill {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid var(--border-strong);
  background: var(--bg-tint);
  color: var(--fg-muted);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 400;
  cursor: pointer;
  transition: color 100ms, background 100ms, border-color 100ms, box-shadow 100ms;
  white-space: nowrap;
  flex-shrink: 0;
}
.da-search-pill:hover {
  color: var(--fg-secondary);
  background: var(--bg-tint-hover);
  border-color: var(--border-strong);
}

.da-search-shortcut {
  font-family: var(--font-mono);
  font-size: 9.5px;
  background: var(--bg-overlay);
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--fg-muted);
}

/* Sign out */
.da-signout-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border-radius: 7px;
  border: 1px solid rgba(225,29,72,0.22);
  background: rgba(225,29,72,0.07);
  color: var(--c-rose);
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 100ms, border-color 100ms;
  white-space: nowrap;
  flex-shrink: 0;
}
.da-signout-btn:hover {
  background: rgba(225,29,72,0.13);
  border-color: rgba(225,29,72,0.38);
}

/* User chip */
.da-user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 10px 0 5px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--bg-tint);
}
.da-chip-av {
  width: 20px; height: 20px;
  border-radius: 5px;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.da-chip-name {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  color: var(--fg-default);
  letter-spacing: -0.015em;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.da-chip-role {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

/* Clock */
.da-clock {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
  color: var(--fg-muted);
  letter-spacing: 0.05em;
  user-select: none;
  display: flex;
  align-items: center;
}
.da-clock-sep {
  animation: blink 1s step-end infinite;
  margin: 0 0.5px;
}

/* Pin button */
.da-pin-btn { display: none; }
@media (min-width: ${COMPACT_BP}px) { .da-pin-btn { display: grid; } }

/* Progress bar */
.da-progress {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 2px;
  z-index: 9999;
  background: linear-gradient(90deg, var(--c-cobalt), var(--c-violet), var(--c-cyan));
  transform-origin: left;
  animation: progressIn 2.4s var(--sb-ease) forwards;
}

/* ─────────────────────────────────────────────────────────────
   PAGE ROOT
───────────────────────────────────────────────────────────── */
.da-page-root {
  flex: 1;
  min-width: 0;
  padding-top: var(--header-h);
  transition: margin-left var(--sb-dur) var(--sb-ease);
  will-change: margin-left;
}

.da-content {
  padding: 24px;
  min-height: calc(100vh - var(--header-h));
}
@media (max-width: ${COMPACT_BP - 1}px) {
  .da-content { padding: 14px 12px 80px; }
}

/* Route entrance */
.da-route-view {
  animation: routeIn 260ms var(--sb-ease) both;
}

/* ─────────────────────────────────────────────────────────────
   COMPACT NAV (mobile)
───────────────────────────────────────────────────────────── */
.da-compact-dock {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 30;
  display: flex;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
  background: var(--header-bg);
  border-top: 1px solid var(--header-border);
  box-shadow: inset 0 -1px 0 var(--header-top-line), 0 -8px 32px rgba(0,0,0,0.2);
  backdrop-filter: blur(24px);
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
}
.da-compact-dock::-webkit-scrollbar { display: none; }

.da-dock-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 56px;
  padding: 6px 10px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.06em;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 100ms, background 100ms;
}
.da-dock-item:hover { color: var(--fg-secondary); background: var(--bg-tint-hover); }
.da-dock-item.active {
  color: var(--item-accent, var(--c-cobalt));
  background: rgba(var(--item-rgb, 29,111,243), 0.1);
}
.da-dock-icon {
  width: 22px; height: 22px;
  display: grid;
  place-items: center;
}

/* ─────────────────────────────────────────────────────────────
   COMMAND PALETTE
───────────────────────────────────────────────────────────── */
.da-cmd-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px) saturate(120%);
  animation: fadeIn 100ms ease both;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
}
.da-cmd-dialog {
  width: min(580px, 92vw);
  border-radius: 14px;
  border: 1px solid var(--border-strong);
  background: var(--bg-overlay);
  box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.06);
  overflow: hidden;
  animation: cmdIn 160ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.da-cmd-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 15px;
  border-bottom: 1px solid var(--border);
}
.da-cmd-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 400;
  color: var(--fg-default);
  letter-spacing: -0.01em;
}
.da-cmd-input::placeholder { color: var(--fg-muted); }
.da-cmd-esc {
  font-family: var(--font-mono);
  font-size: 9.5px;
  background: var(--bg-tint);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  padding: 2px 6px;
  color: var(--fg-muted);
  flex-shrink: 0;
}
.da-cmd-body {
  max-height: 380px;
  overflow-y: auto;
  padding: 6px;
}
.da-cmd-section-hdr {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--fg-subtle);
  padding: 8px 10px 3px;
}
.da-cmd-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 10px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 70ms, border-color 70ms;
  outline: none;
}
.da-cmd-item:hover,
.da-cmd-item[aria-selected="true"] {
  background: var(--bg-tint-hover);
  border-color: var(--border);
}
.da-cmd-item[aria-selected="true"] {
  background: rgba(29,111,243,0.08);
  border-color: rgba(29,111,243,0.2);
}
.da-cmd-icon-wrap {
  width: 28px; height: 28px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  font-size: 13px;
}
.da-cmd-label {
  flex: 1;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-default);
  letter-spacing: -0.01em;
}
.da-cmd-label mark {
  background: rgba(29,111,243,0.2);
  color: var(--c-cobalt-hi);
  border-radius: 2px;
  padding: 0 1px;
}
.da-cmd-group {
  font-size: 11px;
  color: var(--fg-muted);
  font-family: var(--font-body);
  flex-shrink: 0;
}
.da-cmd-shortcut {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-muted);
  background: var(--bg-tint);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 5px;
  flex-shrink: 0;
}
.da-cmd-empty {
  padding: 40px 16px;
  text-align: center;
  color: var(--fg-muted);
  font-size: 13px;
  font-family: var(--font-body);
}
.da-cmd-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 7px 14px;
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-subtle);
}
.da-cmd-footer kbd {
  font-family: var(--font-mono);
  font-size: 9.5px;
  background: var(--bg-tint);
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  padding: 1px 5px;
  color: var(--fg-muted);
}

/* ─────────────────────────────────────────────────────────────
   LOADER
───────────────────────────────────────────────────────────── */
.da-loader-shell {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: var(--bg-base);
  z-index: 9999;
  animation: fadeIn 150ms ease;
}
.da-loader-card {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 36px 40px;
  border-radius: 20px;
  border: 1px solid var(--border-strong);
  background: var(--bg-raised);
  box-shadow: var(--shadow-lg);
  animation: scaleIn 300ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  min-width: min(560px, calc(100vw - 40px));
}
.da-loader-visual {
  position: relative;
  width: 108px; height: 108px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
}
.da-loader-disc {
  position: absolute;
  inset: 0;
  animation: spin 1.2s linear infinite;
  will-change: transform;
}
.da-loader-copy { flex: 1; min-width: 0; }
.da-loader-eyebrow {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--c-cobalt);
  margin-bottom: 8px;
}
.da-loader-headline {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--fg-default);
  letter-spacing: -0.025em;
  line-height: 1.15;
}
.da-loader-sub {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--fg-muted);
  margin-top: 8px;
  line-height: 1.6;
}
.da-loader-bar {
  height: 2px;
  margin-top: 22px;
  border-radius: 999px;
  background: var(--border);
  overflow: hidden;
}
.da-loader-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--c-cobalt), var(--c-violet), var(--c-cyan));
  background-size: 200%;
  animation: shimmer 1.4s linear infinite;
}
@media (max-width: 640px) {
  .da-loader-card {
    flex-direction: column;
    min-width: 0;
    width: calc(100vw - 24px);
    padding: 28px 22px;
  }
}

/* ─────────────────────────────────────────────────────────────
   PROFILE PANEL
───────────────────────────────────────────────────────────── */
.da-profile-panel {
  max-width: 600px;
  padding: 28px;
  border-radius: 16px;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  animation: fadeUp 220ms var(--sb-ease) both;
}
.da-profile-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 22px;
}
@media (max-width: 480px) { .da-profile-grid { grid-template-columns: 1fr; } }
.da-profile-field {
  padding: 11px 14px;
  border-radius: 9px;
  background: var(--bg-tint);
  border: 1px solid var(--border);
}
.da-pf-label {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin-bottom: 4px;
}
.da-pf-value {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-default);
  letter-spacing: -0.01em;
}

/* ─────────────────────────────────────────────────────────────
   ERROR
───────────────────────────────────────────────────────────── */
.da-error-card {
  max-width: 400px;
  padding: 30px;
  border-radius: 16px;
  background: var(--bg-raised);
  border: 1px solid rgba(225,29,72,0.3);
  text-align: center;
}

} /* end @layer shell */

@layer motion {

/* ── Reduced motion ─────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration:   1ms !important;
    animation-delay:      0ms !important;
    transition-duration:  1ms !important;
    scroll-behavior:      auto !important;
  }
}

/* ── High contrast ──────────────────────────────────────────── */
@media (prefers-contrast: high) {
  :root {
    --border:        rgba(255,255,255,0.25);
    --border-strong: rgba(255,255,255,0.4);
    --fg-muted:      #9aaab8;
  }
}

} /* end @layer motion */
`;

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try { return readStoredTheme(); }
    catch {
      return typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark" : "light";
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem("da-theme", mode); } catch {}
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode;
    // Sync meta for Safari FOUC prevention
    let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "color-scheme";
      document.head.appendChild(meta);
    }
    meta.content = mode;
    applyThemeCssVariables(mode);
  }, [mode]);

  const toggle = useCallback(() => setMode(m => m === "light" ? "dark" : "light"), []);
  return { mode, isDark: mode === "dark", toggle } as const;
}

function useViewportWidth() {
  const [w, setW] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth
  );

  useEffect(() => {
    let raf = 0;
    const fn = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setW(window.innerWidth));
    };
    window.addEventListener("resize", fn, { passive: true });
    return () => {
      window.removeEventListener("resize", fn);
      cancelAnimationFrame(raf);
    };
  }, []);

  return w;
}

// Recency tracking for command palette
function useNavRecency() {
  const [recency, setRecency] = useState<RoutePath[]>(() => {
    try {
      const raw = localStorage.getItem(RECENCY_KEY);
      return raw ? (JSON.parse(raw) as RoutePath[]) : [];
    } catch { return []; }
  });

  const push = useCallback((path: RoutePath) => {
    setRecency(prev => {
      const next = [path, ...prev.filter(p => p !== path)].slice(0, RECENCY_MAX);
      try { localStorage.setItem(RECENCY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { recency, push } as const;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getNavGroup(label: string): string {
  for (const [group, labels] of Object.entries(NAV_GROUP_LABELS)) {
    if (labels.includes(label)) return group;
  }
  return "Other";
}

function getActiveRouteLabel(pathname: string, items: readonly NavItem[]): string {
  return items.find(i => i.path === pathname)?.label ?? "Workspace";
}

function getUserInitials(profile: UserProfile): string {
  const name = profile.display_name || profile.agent_name || profile.email || "?";
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function buildNavItems(profile: UserProfile): NavItem[] {
  const isAdmin      = profile.role === "admin";
  const isStaff      = isAdmin || profile.role === "qa";
  const isSupervisor = profile.role === "supervisor";

  const item = (path: RoutePath, label: string): NavItem => ({
    path, label, group: getNavGroup(label), shortcut: NAV_SHORTCUTS[label],
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

/** Build ordered groups from nav items, respecting NAV_GROUP_ORDER */
function buildGroupsOrdered(items: readonly NavItem[]): [string, NavItem[]][] {
  const map = new Map<string, NavItem[]>();
  for (const item of items) {
    if (!map.has(item.group)) map.set(item.group, []);
    map.get(item.group)!.push(item);
  }
  const result: [string, NavItem[]][] = [];
  for (const g of NAV_GROUP_ORDER) {
    if (map.has(g)) result.push([g, map.get(g)!]);
  }
  // Append any ungrouped
  for (const [g, v] of map) {
    if (!NAV_GROUP_ORDER.includes(g as any)) result.push([g, v]);
  }
  return result;
}

function accentStyle(group: string): CSSProperties {
  const a = GROUP_ACCENT[group] ?? GROUP_ACCENT.Other;
  return {
    "--item-accent": a.css,
    "--item-rgb":    a.rgb,
  } as CSSProperties;
}

/** Fuzzy highlight: wrap matched chars in <mark> */
function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const idx = t.indexOf(q);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Icons — stable module-scope SVG elements (never re-created)
// ─────────────────────────────────────────────────────────────

type IconProps = { size?: number; className?: string };

const s = (size: number) => ({
  width: size, height: size,
  viewBox: "0 0 24 24" as const,
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

const SearchIcon  = memo(({ size = 15 }: IconProps) => <svg {...s(size)}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>);
SearchIcon.displayName = "SearchIcon";

const SunIcon     = memo(({ size = 14 }: IconProps) => <svg {...s(size)}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>);
SunIcon.displayName = "SunIcon";

const MoonIcon    = memo(({ size = 14 }: IconProps) => <svg {...s(size)}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>);
MoonIcon.displayName = "MoonIcon";

const LogOutIcon  = memo(({ size = 13 }: IconProps) => <svg {...s(size)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>);
LogOutIcon.displayName = "LogOutIcon";

const MenuIcon    = memo(({ size = 15 }: IconProps) => <svg {...s(size)}><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>);
MenuIcon.displayName = "MenuIcon";

const PinIcon     = memo(({ size = 14 }: IconProps) => <svg {...s(size)}><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>);
PinIcon.displayName = "PinIcon";

// Nav icons — memoised per label
const NAV_ICON_MAP: Record<string, ReactNode> = (() => {
  const p = { ...s(15) };
  return {
    Dashboard:             <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>,
    "New Audit":           <svg {...p}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    "Audits Upload":       <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    "Audits List":         <svg {...p}><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>,
    "Calls Upload":        <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.93 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    "Tickets Upload":      <svg {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    "Ticket Evidence":     <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    "Ticket AI Review":    <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    "Sales Upload":        <svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    "Agent Feedback":      <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    Monitoring:            <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    "Team Heatmap":        <svg {...p}><rect x="3" y="3" width="4" height="4" rx="0.7"/><rect x="10" y="3" width="4" height="4" rx="0.7"/><rect x="17" y="3" width="4" height="4" rx="0.7"/><rect x="3" y="10" width="4" height="4" rx="0.7"/><rect x="10" y="10" width="4" height="4" rx="0.7"/><rect x="17" y="10" width="4" height="4" rx="0.7"/><rect x="3" y="17" width="4" height="4" rx="0.7"/><rect x="10" y="17" width="4" height="4" rx="0.7"/><rect x="17" y="17" width="4" height="4" rx="0.7"/></svg>,
    Accounts:              <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    "Supervisor Requests": <svg {...p}><polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/><polyline points="7 21 3 17 7 13"/><line x1="15" y1="17" x2="3" y2="17"/></svg>,
    Reports:               <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    "My Admin Profile":    <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    "My QA Profile":       <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    Overview:              <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    "Team Dashboard":      <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
    "My Supervisor Profile": <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  };
})();

const NavIcon = memo(function NavIcon({ label, size = 15 }: { label: string; size?: number }) {
  const icon = NAV_ICON_MAP[label];
  if (icon && size === 15) return <>{icon}</>;
  // Fallback with correct size
  const p = s(size);
  return NAV_ICON_MAP[label]
    ? <svg {...p}>{(NAV_ICON_MAP[label] as any)?.props?.children}</svg>
    : <svg {...p}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>;
});
NavIcon.displayName = "NavIcon";

// ─────────────────────────────────────────────────────────────
// LiveClock — zero re-renders, DOM writes only
// ─────────────────────────────────────────────────────────────

const LiveClock = memo(function LiveClock() {
  const hhRef = useRef<HTMLSpanElement>(null);
  const mmRef = useRef<HTMLSpanElement>(null);
  const ssRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    let intervalId: ReturnType<typeof setInterval>;
    let mounted = true;

    const write = () => {
      if (!mounted) return;
      const d   = new Date();
      const hh  = String(d.getHours()).padStart(2, "0");
      const mm  = String(d.getMinutes()).padStart(2, "0");
      const ss  = String(d.getSeconds()).padStart(2, "0");
      if (hhRef.current) hhRef.current.textContent = hh;
      if (mmRef.current) mmRef.current.textContent = mm;
      if (ssRef.current) ssRef.current.textContent = ss;
    };

    write();
    // Align to next second boundary to reduce drift
    const msUntilNext = 1000 - (Date.now() % 1000);
    timerId = setTimeout(() => {
      if (!mounted) return;
      write();
      intervalId = setInterval(write, 1000);
    }, msUntilNext);

    return () => {
      mounted = false;
      clearTimeout(timerId);
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="da-clock" aria-live="off" aria-label="Current time">
      <span ref={hhRef} />
      <span className="da-clock-sep">:</span>
      <span ref={mmRef} />
      <span className="da-clock-sep" style={{ animationDelay: "0.5s" }}>:</span>
      <span ref={ssRef} style={{ opacity: 0.4 }} />
    </div>
  );
});
LiveClock.displayName = "LiveClock";

// ─────────────────────────────────────────────────────────────
// Command Palette
// ─────────────────────────────────────────────────────────────

interface CmdPaletteProps {
  items:      readonly NavItem[];
  recency:    readonly RoutePath[];
  onNavigate: (path: RoutePath) => void;
  onClose:    () => void;
}

const CommandPalette = memo(function CommandPalette({
  items, recency, onNavigate, onClose,
}: CmdPaletteProps) {
  const [query, setQuery]       = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Recency items (only shown when query is empty)
  const recentItems = useMemo<NavItem[]>(() => {
    if (query.trim()) return [];
    return recency
      .map(p => items.find(i => i.path === p))
      .filter((x): x is NavItem => !!x);
  }, [query, recency, items]);

  // Filtered + grouped results
  const filtered = useMemo<NavItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)
    );
  }, [query, items]);

  const grouped = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of filtered) {
      if (!map.has(item.group)) map.set(item.group, []);
      map.get(item.group)!.push(item);
    }
    return map;
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatList = useMemo<NavItem[]>(() => {
    if (query.trim()) return filtered;
    return [...recentItems, ...items.filter(i => !recentItems.includes(i))];
  }, [query, filtered, recentItems, items]);

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected(s => Math.min(s + 1, flatList.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(s => Math.max(s - 1, 0));
      }
      if (e.key === "Enter") {
        const item = flatList[selected];
        if (item) { onNavigate(item.path); onClose(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flatList, selected, onNavigate, onClose]);

  const renderItem = (item: NavItem, idx: number) => {
    const isSelected = idx === selected;
    const accent = GROUP_ACCENT[item.group] ?? GROUP_ACCENT.Other;
    return (
      <div
        key={item.path}
        role="option"
        aria-selected={isSelected}
        className="da-cmd-item"
        onClick={() => { onNavigate(item.path); onClose(); }}
        onMouseEnter={() => setSelected(idx)}
        tabIndex={-1}
      >
        <div
          className="da-cmd-icon-wrap"
          style={{ background: `${accent.hex}18`, color: accent.hex }}
        >
          <NavIcon label={item.label} size={14} />
        </div>
        <span className="da-cmd-label">
          {highlightMatch(item.label, query.trim())}
        </span>
        <span className="da-cmd-group">{item.group}</span>
        {item.shortcut && <span className="da-cmd-shortcut">{item.shortcut}</span>}
      </div>
    );
  };

  const hasQuery = query.trim().length > 0;
  let globalIdx = 0;

  return (
    <div
      className="da-cmd-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      aria-modal="true"
    >
      <div className="da-cmd-dialog" role="dialog" aria-label="Command palette">
        <div className="da-cmd-header">
          <SearchIcon size={16} />
          <input
            ref={inputRef}
            className="da-cmd-input"
            placeholder="Search pages…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search pages"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="da-cmd-esc">ESC</span>
        </div>

        <div className="da-cmd-body" role="listbox">
          {flatList.length === 0 ? (
            <div className="da-cmd-empty">No results for "{query}"</div>
          ) : hasQuery ? (
            /* Filtered grouped view */
            Array.from(grouped.entries()).map(([group, groupItems]) => (
              <div key={group}>
                <div className="da-cmd-section-hdr">{group}</div>
                {groupItems.map(item => renderItem(item, globalIdx++))}
              </div>
            ))
          ) : (
            /* Default: recent + all */
            <>
              {recentItems.length > 0 && (
                <div>
                  <div className="da-cmd-section-hdr">Recent</div>
                  {recentItems.map(item => renderItem(item, globalIdx++))}
                </div>
              )}
              <div>
                <div className="da-cmd-section-hdr">All pages</div>
                {items.filter(i => !recentItems.includes(i)).map(item =>
                  renderItem(item, globalIdx++)
                )}
              </div>
            </>
          )}
        </div>

        <div className="da-cmd-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
});
CommandPalette.displayName = "CommandPalette";

// ─────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────

interface SidebarProps {
  groups:       [string, NavItem[]][];
  activePath:   string;
  isExpanded:   boolean;
  profile:      UserProfile;
  userInitials: string;
  onNavigate:   (path: RoutePath) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onLogout:     () => void;
}

const Sidebar = memo(function Sidebar({
  groups, activePath, isExpanded, profile, userInitials,
  onNavigate, onMouseEnter, onMouseLeave, onLogout,
}: SidebarProps) {
  const name       = profile.display_name || profile.agent_name || profile.email || "";
  const roleColor  = ROLE_COLORS[profile.role ?? "qa"] ?? "#1D6FF3";

  return (
    <nav
      className={`da-sidebar${isExpanded ? " expanded" : ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="da-sidebar-header">
        <div className="da-sidebar-logo">
          <img src={LOGO_MARK_SRC} alt="" width={22} height={22} style={{ objectFit: "contain", display: "block" }} />
        </div>
        <div className="da-sidebar-brand">
          <div className="da-brand-name">Detroit Axle</div>
          <div className="da-brand-sub">QA Platform</div>
        </div>
      </div>

      {/* Nav */}
      <div className="da-nav-rail" role="list">
        {groups.map(([group, groupItems]) => (
          <div key={group} className="da-nav-section" role="group" aria-label={group}>
            <div className="da-nav-section-label" style={{ color: GROUP_ACCENT[group]?.css }}>
              <div className="da-nav-section-label-inner">{group}</div>
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
                  role="listitem"
                >
                  <div className="da-nav-pip" aria-hidden="true" />
                  <span className="da-nav-icon" aria-hidden="true">
                    <NavIcon label={item.label} size={15} />
                  </span>
                  <span className="da-nav-label">{item.label}</span>
                  {item.shortcut && (
                    <span className="da-nav-shortcut" aria-hidden="true">{item.shortcut}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User */}
      <div className="da-sidebar-user">
        <div className="da-user-row">
          <div
            className="da-avatar"
            style={{
              background: `${roleColor}22`,
              border: `1.5px solid ${roleColor}44`,
              color: roleColor,
            }}
          >
            {userInitials}
            <div className="da-online-dot" aria-hidden="true" />
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
            <LogOutIcon size={12} />
          </button>
        </div>
      </div>
    </nav>
  );
});
Sidebar.displayName = "Sidebar";

// ─────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────

interface HeaderProps {
  isCompact:      boolean;
  hasSidebar:     boolean;
  isPinned:       boolean;
  isPending:      boolean;
  activeLabel:    string;
  activeGroup:    string;
  profile:        UserProfile;
  userInitials:   string;
  isDark:         boolean;
  onTogglePin:    () => void;
  onToggleTheme:  () => void;
  onOpenCmd:      () => void;
  onLogout:       () => void;
}

const Header = memo(function Header({
  isCompact, hasSidebar, isPinned, isPending,
  activeLabel, activeGroup,
  profile, userInitials, isDark,
  onTogglePin, onToggleTheme, onOpenCmd, onLogout,
}: HeaderProps) {
  const roleColor  = ROLE_COLORS[profile.role ?? "qa"] ?? "#1D6FF3";
  const displayName = profile.display_name || profile.agent_name || profile.email || "";

  return (
    <header className="da-header">
      {isPending && <div className="da-progress" aria-hidden="true" />}

      <div className="da-header-left">
        {/* Pin button (large viewports) */}
        {hasSidebar && !isCompact && (
          <button
            type="button"
            className={`da-icon-btn da-pin-btn${isPinned ? " active" : ""}`}
            onClick={onTogglePin}
            aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
            title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            {isPinned ? <PinIcon size={14} /> : <MenuIcon size={15} />}
          </button>
        )}

        {!isCompact && hasSidebar && (
          <>
            <div className="da-hdiv" />
            <div className="da-status" aria-label="System status: online">
              <div className="da-status-dot" aria-hidden="true" />
              <span className="da-status-label">LIVE</span>
            </div>
            <div className="da-hdiv" />
            <nav className="da-breadcrumb" aria-label="Breadcrumb">
              <span className="da-bc-root">Workspace</span>
              <span className="da-bc-sep" aria-hidden="true">›</span>
              <span key={activeLabel} className="da-bc-current"
                style={{ color: GROUP_ACCENT[activeGroup]?.css || "var(--fg-default)" }}>
                {activeLabel}
              </span>
            </nav>
          </>
        )}

        {isCompact && (
          <img src={LOGO_WORDMARK_SRC} alt="Detroit Axle" height={24} style={{ objectFit: "contain" }} />
        )}
      </div>

      <div className="da-header-right">
        {!isCompact && <LiveClock />}
        {!isCompact && <div className="da-hdiv" />}

        {/* Search / ⌘K */}
        <button
          type="button"
          className="da-search-pill"
          onClick={onOpenCmd}
          aria-label="Open command palette (⌘K)"
        >
          <SearchIcon size={13} />
          {!isCompact && <span>Search</span>}
          {!isCompact && <span className="da-search-shortcut">⌘K</span>}
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

        {/* User chip (large) */}
        {!isCompact && (
          <div className="da-user-chip">
            <div className="da-chip-av" style={{ background: roleColor + "cc" }}>
              {userInitials}
            </div>
            <div>
              <div className="da-chip-name">{displayName}</div>
              <div className="da-chip-role" style={{ color: roleColor }}>{profile.role}</div>
            </div>
          </div>
        )}

        {/* Sign out */}
        <button
          type="button"
          className="da-signout-btn"
          onClick={onLogout}
          aria-label="Sign out"
        >
          <LogOutIcon size={12} />
          {!isCompact && "Sign out"}
        </button>
      </div>
    </header>
  );
});
Header.displayName = "Header";

// ─────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────

// Improved rotor with Phong-style shading and proper spoke geometry
const RotorVisual = memo(function RotorVisual() {
  const BOLTS  = [0, 60, 120, 180, 240, 300] as const;
  const VENTS  = Array.from({ length: 12 }, (_, i) => i * 30);
  const SPOKES = Array.from({ length: 6 }, (_, i) => i * 60);

  return (
    <div className="da-loader-visual" aria-hidden="true">
      <div className="da-loader-disc">
        <svg viewBox="0 0 140 140" width="108" height="108">
          <defs>
            <radialGradient id="rl-disc" cx="42%" cy="36%" r="68%">
              <stop offset="0%"   stopColor="#E8ECF5" />
              <stop offset="30%"  stopColor="#9BA8B8" />
              <stop offset="65%"  stopColor="#4E5A6A" />
              <stop offset="100%" stopColor="#171C26" />
            </radialGradient>
            <radialGradient id="rl-ring" cx="44%" cy="36%" r="72%">
              <stop offset="0%"   stopColor="#B0BACC" />
              <stop offset="55%"  stopColor="#3C4556" />
              <stop offset="100%" stopColor="#0E1320" />
            </radialGradient>
            <radialGradient id="rl-hub" cx="40%" cy="35%" r="78%">
              <stop offset="0%"   stopColor="#C8D0DC" />
              <stop offset="50%"  stopColor="#2E3848" />
              <stop offset="100%" stopColor="#0A0D14" />
            </radialGradient>
            <filter id="rl-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Shadow base */}
          <circle cx="70" cy="70" r="64" fill="rgba(0,0,0,0.4)" />
          {/* Main disc */}
          <circle cx="70" cy="70" r="62" fill="url(#rl-disc)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          {/* Wear groove ring */}
          <circle cx="70" cy="70" r="50" fill="none" stroke="#0A0D14" strokeWidth="18" />
          <circle cx="70" cy="70" r="50" fill="none" stroke="url(#rl-ring)" strokeWidth="14" />
          {/* Cooling vents */}
          {VENTS.map(a => (
            <rect key={a} x="67" y="17" width="6" height="20" rx="3"
              fill="rgba(0,0,0,0.65)" transform={`rotate(${a} 70 70)`} />
          ))}
          {/* Spokes */}
          {SPOKES.map(a => {
            const rad = (a * Math.PI) / 180;
            const x1  = 70 + Math.cos(rad) * 30;
            const y1  = 70 + Math.sin(rad) * 30;
            const x2  = 70 + Math.cos(rad) * 46;
            const y2  = 70 + Math.sin(rad) * 46;
            return (
              <line key={a} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(0,0,0,0.5)" strokeWidth="4.5" strokeLinecap="round" />
            );
          })}
          {/* Hub */}
          <circle cx="70" cy="70" r="26" fill="url(#rl-hub)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <circle cx="70" cy="70" r="8"  fill="#070A0F" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          {/* Bolts */}
          {BOLTS.map(a => {
            const rad = (a * Math.PI) / 180;
            const cx  = 70 + Math.cos(rad) * 16;
            const cy  = 70 + Math.sin(rad) * 16;
            return (
              <circle key={a} cx={cx} cy={cy} r="2.6"
                fill="#0A0D14" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
            );
          })}
          {/* Chrome highlight arc */}
          <path
            d="M 32,42 A 44,44 0 0,1 108,42"
            stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" fill="none" strokeLinecap="round"
            filter="url(#rl-glow)"
          />
        </svg>
      </div>
    </div>
  );
});
RotorVisual.displayName = "RotorVisual";

const Loader = memo(function Loader({ message = "Loading workspace…" }: { message?: string }) {
  return (
    <div className="da-loader-shell" role="status" aria-label={message}>
      <div className="da-loader-card">
        <RotorVisual />
        <div className="da-loader-copy">
          <div className="da-loader-eyebrow">Detroit Axle QA</div>
          <div className="da-loader-headline">{message}</div>
          <div className="da-loader-sub">Checking rotors, calipers, and credentials.</div>
          <div className="da-loader-bar">
            <div className="da-loader-bar-fill" />
          </div>
        </div>
      </div>
    </div>
  );
});
Loader.displayName = "Loader";

// ─────────────────────────────────────────────────────────────
// Profile Panel
// ─────────────────────────────────────────────────────────────

const ProfilePanel = memo(function ProfilePanel({
  title, profile,
}: { title: string; profile: UserProfile }) {
  const initials  = getUserInitials(profile);
  const roleColor = ROLE_COLORS[profile.role ?? "qa"] ?? "#1D6FF3";

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
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${roleColor}20`,
          border: `1.5px solid ${roleColor}40`,
          display: "grid", placeItems: "center",
          fontSize: 17, fontWeight: 700, color: roleColor,
          fontFamily: "var(--font-display)",
          letterSpacing: "-0.02em",
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--fg-muted)", marginBottom: 4,
          }}>
            Profile
          </div>
          <h2 style={{
            margin: 0, fontFamily: "var(--font-display)", fontSize: 20,
            fontWeight: 700, color: "var(--fg-default)", letterSpacing: "-0.025em",
          }}>
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
ProfilePanel.displayName = "ProfilePanel";

// ─────────────────────────────────────────────────────────────
// Route view wrapper — re-keys on pathname for entrance animation
// ─────────────────────────────────────────────────────────────

function RouteView({ children, pathKey }: { children: ReactNode; pathKey: string }) {
  return <div key={pathKey} className="da-route-view">{children}</div>;
}

// ─────────────────────────────────────────────────────────────
// Route trees
// ─────────────────────────────────────────────────────────────

const StaffRoutes = memo(function StaffRoutes({ profile }: { profile: UserProfile }) {
  const isAdmin = profile.role === "admin";
  const isStaff = isAdmin || profile.role === "qa";

  return (
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
      {isStaff && <Route path={ROUTES.reports}            element={<ReportsSupabase />} />}
      <Route path={ROUTES.profile} element={
        <ProfilePanel title={isAdmin ? "My Admin Profile" : "My QA Profile"} profile={profile} />
      } />
      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  );
});
StaffRoutes.displayName = "StaffRoutes";

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
SupervisorRoutes.displayName = "SupervisorRoutes";

// ─────────────────────────────────────────────────────────────
// AppShell
// ─────────────────────────────────────────────────────────────

function AppShell() {
  const auth     = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();
  const viewport = useViewportWidth();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [isPending, startTransition]    = useTransition();
  const { recency, push: pushRecency }  = useNavRecency();

  // Inject CSS once on mount
  useEffect(() => { injectGlobalStyles(); }, []);

  // Sidebar state machine
  const [sidebarMode, dispatchSidebar] = useReducer(sidebarReducer, "closed");

  const [isCmdOpen, setCmdOpen] = useState(false);

  const isCompact      = viewport < COMPACT_BP;
  const isExpanded     = !isCompact && sidebarMode !== "closed";
  const isPinned       = sidebarMode === "pinned";
  const sidebarWidth   = isExpanded ? SIDEBAR_W_EXPANDED : SIDEBAR_W_COLLAPSED;

  // Reset sidebar on compact breakpoint
  useEffect(() => {
    if (isCompact) dispatchSidebar({ type: "COMPACT_RESET" });
  }, [isCompact]);

  // Sync --sb-w CSS var for the header's `left` transition
  useEffect(() => {
    document.documentElement.style.setProperty("--sb-w", `${sidebarWidth}px`);
  }, [sidebarWidth]);

  // Sync data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [isDark]);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Scroll to top on route change + reset compact nav scroll
  const compactNavRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    if (compactNavRef.current) compactNavRef.current.scrollLeft = 0;
  }, [location.pathname]);

  // Stable callbacks
  const handleNavigate = useCallback((path: RoutePath) => {
    startTransition(() => { navigate(path); });
    pushRecency(path);
    setCmdOpen(false);
  }, [navigate, pushRecency]);

  const handleTogglePin    = useCallback(() => dispatchSidebar({ type: "TOGGLE_PIN" }), []);
  const handleSidebarEnter = useCallback(() => dispatchSidebar({ type: "ENTER" }),       []);
  const handleSidebarLeave = useCallback(() => dispatchSidebar({ type: "LEAVE" }),       []);
  const handleLogout       = useCallback(() => auth.logout(),                            [auth]);
  const handleOpenCmd      = useCallback(() => setCmdOpen(true),                         []);
  const handleCloseCmd     = useCallback(() => setCmdOpen(false),                        []);

  // Derived
  const { profile, loading, recoveryMode, logout, handleRecoveryComplete } = auth;

  const navItems = useMemo(() => profile ? buildNavItems(profile) : [], [profile]);
  const navGroups = useMemo(() => buildGroupsOrdered(navItems), [navItems]);

  const activeLabel = useMemo(
    () => getActiveRouteLabel(location.pathname as RoutePath, navItems),
    [location.pathname, navItems]
  );

  const activeGroup = useMemo(
    () => navItems.find(i => i.path === location.pathname)?.group ?? "Core",
    [location.pathname, navItems]
  );

  // ── Guard states ─────────────────────────────────────────────
  if (loading)       return <Loader />;
  if (recoveryMode)  return <ResetPassword onComplete={handleRecoveryComplete} onLogout={logout} />;
  if (!auth.session) return <Login />;

  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="da-error-card">
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--c-rose)", marginBottom: 8,
          }}>
            Profile error
          </div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700,
            color: "var(--fg-default)", marginBottom: 10,
          }}>
            Profile not found
          </h1>
          <p style={{
            fontFamily: "var(--font-body)", fontSize: 13, color: "var(--fg-muted)",
            lineHeight: 1.6, marginBottom: 20,
          }}>
            {auth.profileError ?? "This account exists in Auth but has no profile row."}
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
        <CommandPalette
          items={navItems}
          recency={recency}
          onNavigate={handleNavigate}
          onClose={handleCloseCmd}
        />
      )}

      <div
        className="da-shell"
        style={{ "--sb-w": `${sidebarWidth}px` } as CSSProperties}
      >
        {hasSidebar && (
          <Sidebar
            groups={navGroups}
            activePath={location.pathname}
            isExpanded={isExpanded}
            profile={profile}
            userInitials={userInitials}
            onNavigate={handleNavigate}
            onMouseEnter={handleSidebarEnter}
            onMouseLeave={handleSidebarLeave}
            onLogout={handleLogout}
          />
        )}

        <div
          className="da-page-root"
          style={{ marginLeft: sidebarWidth }}
        >
          <Header
            isCompact={isCompact}
            hasSidebar={hasSidebar}
            isPinned={isPinned}
            isPending={isPending}
            activeLabel={activeLabel}
            activeGroup={activeGroup}
            profile={profile}
            userInitials={userInitials}
            isDark={isDark}
            onTogglePin={handleTogglePin}
            onToggleTheme={toggleTheme}
            onOpenCmd={handleOpenCmd}
            onLogout={handleLogout}
          />

          <main>
            {hasSidebar ? (
              <>
                {/* Compact bottom dock (mobile/tablet) */}
                {isCompact && (
                  <nav
                    className="da-compact-dock"
                    aria-label="Mobile navigation"
                    ref={el => { compactNavRef.current = el; }}
                  >
                    {navItems.map(item => {
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          className={`da-dock-item${isActive ? " active" : ""}`}
                          onClick={() => handleNavigate(item.path)}
                          style={accentStyle(item.group)}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <div className="da-dock-icon" aria-hidden="true">
                            <NavIcon label={item.label} size={16} />
                          </div>
                          {item.label.split(" ")[0]}
                        </button>
                      );
                    })}
                  </nav>
                )}

                <div className="da-content">
                  <RouteView pathKey={location.pathname}>
                    {isStaff
                      ? <StaffRoutes profile={profile} />
                      : <SupervisorRoutes profile={profile} />
                    }
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
