/**
 * App.tsx — Detroit Axle QA System
 * Performance-optimized: isolated memo components, local hover state,
 * module-level style factories, zero unnecessary re-renders.
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
} from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { useAuthState } from './hooks/useAuthState';
import {
  getThemePalette,
  applyThemeCssVariables,
  createStyles,
  readStoredTheme,
} from './lib/theme';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { ThemeMode } from './lib/theme';
import type { UserProfile } from './context/AuthContext';

import Login from './QA/Login';
import ResetPassword from './QA/ResetPassword';
import AgentPortal from './QA/AgentPortal';
import SupervisorPortal from './QA/SupervisorPortal';
import Dashboard from './QA/Dashboard';
import NewAuditSupabase from './QA/NewAuditSupabase';
import AuditsImportSupabase from './QA/AuditsImportSupabase';
import CallsUploadSupabase from './QA/CallsUploadSupabase';
import TicketsUploadSupabase from './QA/TicketsUploadSupabase';
import TicketEvidenceUploadSupabase from './QA/TicketEvidenceUploadSupabase';
import TicketAIReviewQueueSupabase from './QA/TicketAIReviewQueueSupabase';
import SalesUploadSupabase from './QA/SalesUploadSupabase';
import AuditsListSupabase from './QA/AuditsListSupabase';
import AccountsSupabase from './QA/AccountsSupabase';
import SupervisorRequestsSupabase from './QA/SupervisorRequestsSupabase';
import AgentFeedbackSupabase from './QA/AgentFeedbackSupabase';
import ReportsSupabase from './QA/ReportsSupabase';
import MonitoringSupabase from './QA/MonitoringSupabase';
import TeamHeatmapSupabase from './QA/TeamHeatmapSupabase';

// ═════════════════════════════════════════════════════════════
// Constants & Types
// ═════════════════════════════════════════════════════════════

const ROUTES = {
  dashboard: '/',
  newAudit: '/new-audit',
  auditsUpload: '/audits-upload',
  auditsList: '/audits-list',
  callsUpload: '/calls-upload',
  ticketsUpload: '/tickets-upload',
  ticketEvidence: '/ticket-evidence',
  ticketAiReview: '/ticket-ai-review',
  salesUpload: '/sales-upload',
  agentFeedback: '/agent-feedback',
  monitoring: '/monitoring',
  accounts: '/accounts',
  supervisorRequests: '/supervisor-requests',
  reports: '/reports',
  teamHeatmap: '/team-heatmap',
  profile: '/profile',
  supervisorOverview: '/supervisor',
  supervisorTeamDashboard: '/supervisor/team-dashboard',
  supervisorRequestsView: '/supervisor/requests',
  supervisorProfile: '/supervisor/profile',
} as const;

type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

interface NavItem {
  readonly path: RoutePath;
  readonly label: string;
  readonly group: string;
}

const LOGO_MARK_SRC = '/detroit-axle-mark.png';
const LOGO_WORDMARK_SRC = '/detroit-axle-wordmark.svg';
const SIDEBAR_COLLAPSED_WIDTH = 72;
const SIDEBAR_EXPANDED_WIDTH = 272;
const SIDEBAR_ITEM_HEIGHT = 46;
const SIDEBAR_ITEM_GAP = 3;
const EXPAND_EASE = '240ms cubic-bezier(0.22, 1, 0.36, 1)';
const COMPACT_BREAKPOINT = 1100;

const NAV_GROUPS: Readonly<Record<string, readonly string[]>> = {
  Core: ['Dashboard', 'Overview', 'Team Dashboard'],
  Audits: ['New Audit', 'Audits Upload', 'Audits List'],
  Data: ['Calls Upload', 'Tickets Upload', 'Ticket Evidence', 'Ticket AI Review', 'Sales Upload'],
  Analytics: ['Agent Feedback', 'Monitoring', 'Team Heatmap'],
  Management: ['Accounts', 'Supervisor Requests', 'Reports'],
  Account: ['My Admin Profile', 'My QA Profile', 'My Supervisor Profile', 'Supervisor Requests'],
};

const GROUP_COLORS: Readonly<Record<string, string>> = {
  Core: '#3b82f6',
  Audits: '#8b5cf6',
  Data: '#06b6d4',
  Analytics: '#f59e0b',
  Management: '#ef4444',
  Account: '#10b981',
  Other: '#6b7280',
};

const ROLE_COLORS: Readonly<Record<string, string>> = {
  admin: '#ef4444',
  qa: '#3b82f6',
  supervisor: '#8b5cf6',
  agent: '#10b981',
};

// ═════════════════════════════════════════════════════════════
// Module-level style factories  (no closure capture → stable)
// ═════════════════════════════════════════════════════════════

function makeNavButtonStyle(
  active: boolean,
  hovered: boolean,
  expanded: boolean,
  isDark: boolean,
  reducedMotion: boolean,
  activeGroupColor: string,
): CSSProperties {
  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: expanded ? '10px' : '0',
    height: `${SIDEBAR_ITEM_HEIGHT}px`,
    minHeight: `${SIDEBAR_ITEM_HEIGHT}px`,
    marginBottom: `${SIDEBAR_ITEM_GAP}px`,
    textAlign: 'left',
    borderRadius: '14px',
    padding: expanded ? '0 12px' : '0',
    justifyContent: expanded ? 'flex-start' : 'center',
    border: active ? `1px solid ${activeGroupColor}33` : '1px solid transparent',
    background: active
      ? `linear-gradient(135deg, ${activeGroupColor}22 0%, ${activeGroupColor}15 100%)`
      : hovered
      ? isDark ? 'rgba(255,255,255,0.05)' : 'rgba(37,99,235,0.05)'
      : 'transparent',
    color: active
      ? activeGroupColor
      : hovered
      ? isDark ? '#93c5fd' : '#2563eb'
      : isDark ? '#94a3b8' : '#64748b',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: reducedMotion
      ? undefined
      : `color 140ms ease, background 120ms ease, gap ${EXPAND_EASE}, padding ${EXPAND_EASE}, border-color 160ms ease`,
    width: '100%',
    fontFamily: "'DM Sans', sans-serif",
  };
}

function makeNavIconBubbleStyle(
  active: boolean,
  hovered: boolean,
  isDark: boolean,
  activeGroupColor: string,
): CSSProperties {
  return {
    width: '30px',
    height: '30px',
    borderRadius: '9px',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    color: active
      ? activeGroupColor
      : hovered
      ? isDark ? '#93c5fd' : '#2563eb'
      : isDark ? '#64748b' : '#94a3b8',
    background: active
      ? `${activeGroupColor}18`
      : hovered
      ? isDark ? 'rgba(255,255,255,0.07)' : 'rgba(37,99,235,0.08)'
      : 'transparent',
    transition: 'background 140ms ease, color 140ms ease',
  };
}

function makeActiveIndicatorStyle(
  active: boolean,
  reducedMotion: boolean,
  activeGroupColor: string,
): CSSProperties {
  return {
    position: 'absolute',
    left: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    width: '3px',
    height: active ? '22px' : '0',
    borderRadius: '0 2px 2px 0',
    background: activeGroupColor,
    transition: reducedMotion ? undefined : 'height 200ms cubic-bezier(0.22, 1, 0.36, 1)',
    boxShadow: active ? `0 0 8px ${activeGroupColor}80` : 'none',
  };
}

function makeNavLabelStyle(active: boolean, expanded: boolean, reducedMotion: boolean): CSSProperties {
  return {
    fontSize: '13px',
    fontWeight: active ? 700 : 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    opacity: expanded ? 1 : 0,
    maxWidth: expanded ? '160px' : '0',
    transition: reducedMotion
      ? undefined
      : `max-width 220ms cubic-bezier(0.22,1,0.36,1), opacity 120ms ease`,
    color: 'currentColor',
    fontFamily: "'DM Sans', sans-serif",
  };
}

// ═════════════════════════════════════════════════════════════
// Hooks
// ═════════════════════════════════════════════════════════════

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return reduced;
}

function useViewportWidth(): number {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let raf: number;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, []);
  return width;
}

function useThemeManager() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      return readStoredTheme();
    } catch {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem('detroit-axle-theme-mode', themeMode); } catch { /* ignore */ }
    document.documentElement.setAttribute('data-theme-mode', themeMode);
    document.documentElement.style.colorScheme = themeMode === 'light' ? 'light' : 'dark';
  }, [themeMode]);

  const toggleTheme = useCallback(
    () => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light')),
    []
  );

  return { themeMode, setThemeMode, toggleTheme } as const;
}

// ═════════════════════════════════════════════════════════════
// Global Styles (injected once, never re-run)
// ═════════════════════════════════════════════════════════════

const GLOBAL_STYLE_ID = 'da-global-v3';
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@10..48,400;10..48,600;10..48,700;10..48,800;10..48,900&family=DM+Mono:ital,wght@0,400;0,500;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.25); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.45); }

@keyframes da-spin-ring { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes da-spin-ring-reverse { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
@keyframes da-fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes da-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes da-pulse-dot { 0%, 100% { opacity: 0.25; transform: scale(0.75); } 50% { opacity: 1; transform: scale(1); } }
@keyframes da-clock-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@keyframes da-status-ring { 0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); } 70% { box-shadow: 0 0 0 6px rgba(34,197,94,0); } 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); } }
@keyframes da-indicator-slide { from { height: 0; opacity: 0; } to { height: 24px; opacity: 1; } }
@keyframes da-nav-item-in { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
@keyframes da-shimmer-load { 0% { background-position: -300% 0; } 100% { background-position: 300% 0; } }
@keyframes da-top-bar-glow { 0%, 100% { opacity: 0.8; } 50% { opacity: 1; } }
@keyframes da-loader-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes da-loader-pulse { 0%, 100% { transform: scale(0.96); opacity: 0.78; } 50% { transform: scale(1.04); opacity: 1; } }
@keyframes da-loader-shine { 0% { transform: rotate(0deg); opacity: 0.38; } 100% { transform: rotate(360deg); opacity: 0.9; } }
@keyframes da-loader-caliper-breathe { 0%, 100% { transform: translateY(0) scale(1); box-shadow: 0 8px 20px rgba(37,99,235,0.2); } 50% { transform: translateY(-1px) scale(1.03); box-shadow: 0 10px 24px rgba(37,99,235,0.28); } }
@keyframes da-loader-spark-float { 0%, 100% { transform: translate3d(0, 0, 0) scale(0.92); opacity: 0.7; } 50% { transform: translate3d(2px, -3px, 0) scale(1.08); opacity: 1; } }

:root {
  --da-loader-shell-bg: linear-gradient(180deg, rgba(6,12,26,0.98) 0%, rgba(10,18,40,0.94) 100%);
  --da-loader-card-bg: linear-gradient(180deg, rgba(12,22,44,0.96) 0%, rgba(9,16,34,0.94) 100%);
  --da-loader-card-border: rgba(96,165,250,0.16);
  --da-loader-copy-bg: rgba(15,23,42,0.52);
  --da-loader-copy-border: rgba(96,165,250,0.16);
  --da-loader-title: #f8fafc;
  --da-loader-text: #cbd5e1;
  --da-loader-muted: #93c5fd;
  --da-loader-rotor-outer: rgba(191,219,254,0.26);
  --da-loader-rotor-inner: rgba(148,163,184,0.18);
  --da-loader-metal: #dbe7f5;
  --da-loader-slot: rgba(8,15,30,0.72);
  --da-loader-hub: #0f172a;
  --da-loader-bolt: rgba(148,163,184,0.92);
  --da-loader-caliper-top: #2563eb;
  --da-loader-caliper-bottom: #7c3aed;
  --da-loader-glow: rgba(37,99,235,0.2);
  --da-loader-accent: #60a5fa;
}

html[data-theme-mode='light'], html[data-theme='light'], body[data-theme='light'], body[data-theme-mode='light'] {
  --da-loader-shell-bg: linear-gradient(180deg, rgba(241,245,249,0.98) 0%, rgba(226,232,240,0.98) 100%);
  --da-loader-card-bg: linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%);
  --da-loader-card-border: rgba(59,130,246,0.16);
  --da-loader-copy-bg: rgba(241,245,249,0.88);
  --da-loader-copy-border: rgba(59,130,246,0.12);
  --da-loader-title: #0f172a;
  --da-loader-text: #475569;
  --da-loader-muted: #2563eb;
  --da-loader-rotor-outer: rgba(148,163,184,0.2);
  --da-loader-rotor-inner: rgba(148,163,184,0.14);
  --da-loader-metal: #f8fafc;
  --da-loader-slot: rgba(148,163,184,0.26);
  --da-loader-hub: #dbeafe;
  --da-loader-bolt: rgba(71,85,105,0.7);
  --da-loader-caliper-top: #2563eb;
  --da-loader-caliper-bottom: #8b5cf6;
  --da-loader-glow: rgba(59,130,246,0.16);
  --da-loader-accent: #2563eb;
}

.da-themed-loader-shell { display: grid; place-items: center; width: 100%; }
.da-themed-loader-shell--page { min-height: min(420px, 52vh); }
.da-themed-loader-shell--inline { min-height: 180px; padding: 16px 0; }
.da-themed-loader-card { display: inline-flex; align-items: center; justify-content: center; padding: 22px 26px; border-radius: 28px; border: 1px solid var(--da-loader-card-border); background: var(--da-loader-card-bg); box-shadow: 0 24px 56px rgba(15,23,42,0.14); backdrop-filter: blur(18px); }
.da-themed-loader-card--overlay { padding: 36px 40px; box-shadow: 0 32px 72px rgba(15,23,42,0.24); }
.da-themed-loader { display: flex; align-items: center; gap: 18px; color: var(--da-loader-text); }
.da-themed-loader--compact { gap: 14px; }
.da-themed-loader__art { position: relative; width: 74px; height: 74px; flex-shrink: 0; display: grid; place-items: center; }
.da-themed-loader--compact .da-themed-loader__art { width: 60px; height: 60px; }
.da-themed-loader__glow { position: absolute; inset: 10px; border-radius: 999px; background: radial-gradient(circle, var(--da-loader-glow) 0%, transparent 70%); filter: blur(6px); animation: da-loader-pulse 1.8s ease-in-out infinite; }
.da-themed-loader__rotor { position: relative; width: 100%; height: 100%; animation: da-loader-rotate 1.35s linear infinite; z-index: 1; }
.da-themed-loader__rotor-face { position: absolute; inset: 10px; border-radius: 999px; border: 2px solid var(--da-loader-rotor-outer); background: radial-gradient(circle at center, transparent 0 14px, var(--da-loader-rotor-inner) 14px 15px, transparent 15px 24px, var(--da-loader-rotor-outer) 24px 26px, transparent 26px 100%), repeating-conic-gradient(from 0deg, transparent 0deg 18deg, var(--da-loader-slot) 18deg 28deg, transparent 28deg 60deg), radial-gradient(circle at center, rgba(255,255,255,0.16) 0%, transparent 72%); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); }
.da-themed-loader__rotor-face::before { content: ''; position: absolute; inset: 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.08); }
.da-themed-loader__rotor-face::after { content: ''; position: absolute; inset: -3px; border-radius: 999px; border-top: 2px solid rgba(255,255,255,0.4); border-right: 2px solid transparent; border-bottom: 2px solid transparent; border-left: 2px solid transparent; opacity: 0.65; animation: da-loader-shine 1.8s linear infinite; }
.da-themed-loader__hub { position: absolute; inset: 24px; border-radius: 999px; background: radial-gradient(circle at 35% 35%, var(--da-loader-metal) 0%, var(--da-loader-hub) 70%); border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 0 0 4px rgba(148,163,184,0.14), 0 0 0 10px rgba(148,163,184,0.08); }
.da-themed-loader__hub::before { content: ''; position: absolute; inset: 8px; border-radius: 999px; background: var(--da-loader-bolt); box-shadow: 0 -10px 0 0 var(--da-loader-bolt), 0 10px 0 0 var(--da-loader-bolt), 10px 0 0 0 var(--da-loader-bolt), -10px 0 0 0 var(--da-loader-bolt); opacity: 0.9; }
.da-themed-loader__caliper { position: absolute; top: 15px; left: 4px; width: 24px; height: 38px; border-radius: 14px 12px 12px 14px; background: linear-gradient(180deg, var(--da-loader-caliper-top) 0%, var(--da-loader-caliper-bottom) 100%); border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 8px 20px rgba(37,99,235,0.2); animation: da-loader-caliper-breathe 1.8s ease-in-out infinite; z-index: 2; }
.da-themed-loader__caliper::before, .da-themed-loader__caliper::after { content: ''; position: absolute; left: 4px; right: 4px; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.18); }
.da-themed-loader__caliper::before { top: 8px; }
.da-themed-loader__caliper::after { bottom: 8px; }
.da-themed-loader__spark { position: absolute; width: 8px; height: 8px; right: 11px; bottom: 9px; border-radius: 999px; background: var(--da-loader-accent); box-shadow: 0 0 14px rgba(96,165,250,0.65); animation: da-loader-spark-float 1.5s ease-in-out infinite; z-index: 3; }
.da-themed-loader__copy { display: grid; gap: 6px; min-width: 0; padding: 12px 14px; border-radius: 18px; border: 1px solid var(--da-loader-copy-border); background: var(--da-loader-copy-bg); }
.da-themed-loader--compact .da-themed-loader__copy { padding: 10px 12px; }
.da-themed-loader__eyebrow { color: var(--da-loader-muted); font-size: 10px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; font-family: 'DM Sans', sans-serif; }
.da-themed-loader__label { color: var(--da-loader-title); font-size: 16px; font-weight: 800; letter-spacing: -0.02em; font-family: 'Bricolage Grotesque', sans-serif; white-space: nowrap; }
.da-themed-loader--compact .da-themed-loader__label { font-size: 14px; }
.da-themed-loader__sub { color: var(--da-loader-text); font-size: 12px; font-weight: 500; font-family: 'DM Sans', sans-serif; }

input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.65) brightness(1.3) hue-rotate(200deg); cursor: pointer; opacity: 0.75; transition: opacity 150ms; }
input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
button { -webkit-tap-highlight-color: transparent; }
button:focus-visible { outline: 2px solid rgba(59,130,246,0.7); outline-offset: 2px; border-radius: 10px; }
`;

function useGlobalStyles() {
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current || document.getElementById(GLOBAL_STYLE_ID)) return;
    const el = document.createElement('style');
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

// ═════════════════════════════════════════════════════════════
// Helpers (module-level, no re-creation)
// ═════════════════════════════════════════════════════════════

function getNavGroup(label: string): string {
  for (const [group, labels] of Object.entries(NAV_GROUPS)) {
    if (labels.includes(label)) return group;
  }
  return 'Other';
}

function getActiveRouteLabel(pathname: string, items: readonly NavItem[]): string {
  return items.find((item) => item.path === pathname)?.label ?? 'Workspace';
}

function getUserInitials(profile: UserProfile): string {
  const name = profile.display_name || profile.agent_name || profile.email || '?';
  const parts = name.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function buildNavItems(profile: UserProfile): NavItem[] {
  const isAdmin = profile.role === 'admin';
  const isStaff = isAdmin || profile.role === 'qa';
  const isSupervisor = profile.role === 'supervisor';

  const withGroup = (path: RoutePath, label: string): NavItem => ({
    path,
    label,
    group: getNavGroup(label),
  });

  if (isSupervisor) {
    return [
      withGroup(ROUTES.supervisorOverview, 'Overview'),
      withGroup(ROUTES.supervisorTeamDashboard, 'Team Dashboard'),
      withGroup(ROUTES.supervisorRequestsView, 'Supervisor Requests'),
      withGroup(ROUTES.supervisorProfile, 'My Supervisor Profile'),
    ];
  }

  if (!isStaff) return [];

  const items: NavItem[] = [
    withGroup(ROUTES.dashboard, 'Dashboard'),
    withGroup(ROUTES.newAudit, 'New Audit'),
    withGroup(ROUTES.auditsUpload, 'Audits Upload'),
    withGroup(ROUTES.auditsList, 'Audits List'),
    withGroup(ROUTES.callsUpload, 'Calls Upload'),
    withGroup(ROUTES.ticketsUpload, 'Tickets Upload'),
    withGroup(ROUTES.ticketEvidence, 'Ticket Evidence'),
    withGroup(ROUTES.ticketAiReview, 'Ticket AI Review'),
    withGroup(ROUTES.salesUpload, 'Sales Upload'),
    withGroup(ROUTES.agentFeedback, 'Agent Feedback'),
    withGroup(ROUTES.monitoring, 'Monitoring'),
    withGroup(ROUTES.teamHeatmap, 'Team Heatmap'),
  ];

  if (isAdmin) {
    items.push(
      withGroup(ROUTES.accounts, 'Accounts'),
      withGroup(ROUTES.supervisorRequests, 'Supervisor Requests'),
    );
  }

  items.push(
    withGroup(ROUTES.reports, 'Reports'),
    withGroup(ROUTES.profile, isAdmin ? 'My Admin Profile' : 'My QA Profile'),
  );

  return items;
}

// ═════════════════════════════════════════════════════════════
// Icons (memoized, stable)
// ═════════════════════════════════════════════════════════════

const SunIcon = memo(function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
});

const MoonIcon = memo(function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
});

const LogoutIcon = memo(function LogoutIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
});

const MenuIcon = memo(function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
});

const NavIconSvg = memo(function NavIconSvg({ label, size = 17 }: { label: string; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor' as const,
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const map: Record<string, ReactNode> = {
    Dashboard: (<svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>),
    'New Audit': (<svg {...p}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>),
    'Audits Upload': (<svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>),
    'Audits List': (<svg {...p}><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>),
    'Calls Upload': (<svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.93 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>),
    'Tickets Upload': (<svg {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>),
    'Ticket Evidence': (<svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>),
    'Ticket AI Review': (<svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>),
    'Sales Upload': (<svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>),
    'Agent Feedback': (<svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>),
    Monitoring: (<svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>),
    'Team Heatmap': (<svg {...p}><rect x="3" y="3" width="4" height="4" rx="0.8"/><rect x="10" y="3" width="4" height="4" rx="0.8"/><rect x="17" y="3" width="4" height="4" rx="0.8"/><rect x="3" y="10" width="4" height="4" rx="0.8"/><rect x="10" y="10" width="4" height="4" rx="0.8"/><rect x="17" y="10" width="4" height="4" rx="0.8"/><rect x="3" y="17" width="4" height="4" rx="0.8"/><rect x="10" y="17" width="4" height="4" rx="0.8"/><rect x="17" y="17" width="4" height="4" rx="0.8"/></svg>),
    Accounts: (<svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
    'Supervisor Requests': (<svg {...p}><polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/><polyline points="7 21 3 17 7 13"/><line x1="15" y1="17" x2="3" y2="17"/></svg>),
    Reports: (<svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>),
    'My Admin Profile': (<svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
    'My QA Profile': (<svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
    Overview: (<svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
    'Team Dashboard': (<svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>),
    'My Supervisor Profile': (<svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
  };

  return (map[label] ?? (
    <svg {...p}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>
  ));
});

// ═════════════════════════════════════════════════════════════
// NavButton — owns its own hover state → zero parent re-renders
// ═════════════════════════════════════════════════════════════

interface NavButtonProps {
  item: NavItem;
  isActive: boolean;
  expanded: boolean;
  isDark: boolean;
  reducedMotion: boolean;
  activeGroupColor: string;
  onNavigate: (path: RoutePath) => void;
}

const NavButton = memo(function NavButton({
  item,
  isActive,
  expanded,
  isDark,
  reducedMotion,
  activeGroupColor,
  onNavigate,
}: NavButtonProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => onNavigate(item.path), [onNavigate, item.path]);
  const handleEnter = useCallback(() => setHovered(true), []);
  const handleLeave = useCallback(() => setHovered(false), []);

  const buttonStyle = useMemo(
    () => makeNavButtonStyle(isActive, hovered, expanded, isDark, reducedMotion, activeGroupColor),
    [isActive, hovered, expanded, isDark, reducedMotion, activeGroupColor],
  );
  const iconBubbleStyle = useMemo(
    () => makeNavIconBubbleStyle(isActive, hovered, isDark, activeGroupColor),
    [isActive, hovered, isDark, activeGroupColor],
  );
  const indicatorStyle = useMemo(
    () => makeActiveIndicatorStyle(isActive, reducedMotion, activeGroupColor),
    [isActive, reducedMotion, activeGroupColor],
  );
  const labelStyle = useMemo(
    () => makeNavLabelStyle(isActive, expanded, reducedMotion),
    [isActive, expanded, reducedMotion],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      aria-current={isActive ? 'page' : undefined}
      title={!expanded ? item.label : undefined}
      style={buttonStyle}
    >
      <div style={indicatorStyle} />
      <span style={iconBubbleStyle}>
        <NavIconSvg label={item.label} size={15} />
      </span>
      <span style={labelStyle}>{item.label}</span>
    </button>
  );
}, (prev, next) =>
  prev.isActive === next.isActive &&
  prev.expanded === next.expanded &&
  prev.isDark === next.isDark &&
  prev.reducedMotion === next.reducedMotion &&
  prev.activeGroupColor === next.activeGroupColor &&
  prev.item === next.item &&
  prev.onNavigate === next.onNavigate
);

// ═════════════════════════════════════════════════════════════
// SidebarPanel — isolated from AppShell hover churn
// ═════════════════════════════════════════════════════════════

interface SidebarPanelProps {
  navItems: readonly NavItem[];
  navGroupsOrdered: [string, NavItem[]][];
  activePath: string;
  expanded: boolean;
  isDark: boolean;
  reducedMotion: boolean;
  activeGroupColor: string;
  profile: UserProfile;
  userInitials: string;
  onNavigate: (path: RoutePath) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onLogout: () => void;
}

const SidebarPanel = memo(function SidebarPanel({
  navItems,
  navGroupsOrdered,
  activePath,
  expanded,
  isDark,
  reducedMotion,
  activeGroupColor,
  profile,
  userInitials,
  onNavigate,
  onMouseEnter,
  onMouseLeave,
  onLogout,
}: SidebarPanelProps) {
  const sidebarDockStyle = useMemo<CSSProperties>(() => ({
    position: 'sticky',
    top: '80px',
    alignSelf: 'start',
    width: `${expanded ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH}px`,
    height: 'calc(100vh - 96px)',
    maxHeight: 'calc(100vh - 96px)',
    minHeight: '380px',
    zIndex: 10,
    transition: reducedMotion ? undefined : `width ${EXPAND_EASE}`,
  }), [expanded, reducedMotion]);

  const sidebarPanelStyle = useMemo<CSSProperties>(() => ({
    position: 'relative',
    width: '100%',
    minHeight: '100%',
    height: '100%',
    padding: '8px 8px 0 8px',
    borderRadius: '22px',
    border: isDark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(203,213,225,0.7)',
    background: isDark ? 'rgba(8,14,32,0.92)' : 'rgba(255,255,255,0.93)',
    boxShadow: expanded
      ? isDark ? '0 32px 64px rgba(0,0,0,0.5)' : '0 32px 64px rgba(15,23,42,0.12)'
      : isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(15,23,42,0.06)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    transition: reducedMotion ? undefined : `width ${EXPAND_EASE}, box-shadow 200ms ease`,
    willChange: 'width',
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
  }), [expanded, isDark, reducedMotion]);

  const railHeaderStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: expanded ? '10px' : '0',
    padding: expanded ? '10px 8px 14px 8px' : '10px 4px 14px 4px',
    justifyContent: expanded ? 'flex-start' : 'center',
    borderBottom: isDark ? '1px solid rgba(148,163,184,0.07)' : '1px solid rgba(203,213,225,0.3)',
    overflow: 'hidden',
    transition: reducedMotion ? undefined : `gap ${EXPAND_EASE}, padding ${EXPAND_EASE}`,
  }), [expanded, isDark, reducedMotion]);

  const railLogoWrapStyle = useMemo<CSSProperties>(() => ({
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    padding: '5px',
    background: isDark ? 'rgba(37,99,235,0.15)' : 'rgba(37,99,235,0.08)',
    border: isDark ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(59,130,246,0.15)',
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  }), [isDark]);

  const railBrandTextStyle = useMemo<CSSProperties>(() => ({
    display: 'grid',
    gap: '1px',
    minWidth: 0,
    opacity: expanded ? 1 : 0,
    transform: expanded ? 'translateX(0)' : 'translateX(-10px)',
    transition: reducedMotion ? undefined : 'opacity 140ms ease, transform 180ms ease',
    pointerEvents: expanded ? 'auto' : 'none',
    overflow: 'hidden',
  }), [expanded, reducedMotion]);

  const navGroupLabelBaseStyle = useMemo<CSSProperties>(() => ({
    padding: expanded ? '8px 12px 4px 12px' : '8px 0 4px 0',
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    overflow: 'hidden',
    maxWidth: expanded ? '200px' : '0',
    opacity: expanded ? 1 : 0,
    transition: reducedMotion ? undefined : `max-width ${EXPAND_EASE}, opacity 120ms ease`,
    whiteSpace: 'nowrap',
    fontFamily: "'DM Sans', sans-serif",
  }), [expanded, reducedMotion]);

  const navDividerStyle = useMemo<CSSProperties>(() => ({
    height: '1px',
    margin: expanded ? '6px 12px' : '6px 8px',
    background: isDark ? 'rgba(148,163,184,0.06)' : 'rgba(203,213,225,0.4)',
    transition: reducedMotion ? undefined : `margin ${EXPAND_EASE}`,
  }), [expanded, isDark, reducedMotion]);

  const navRailStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '8px 0',
    scrollbarWidth: 'thin',
    scrollBehavior: 'smooth',
    WebkitOverflowScrolling: 'touch',
  };

  return (
    <aside
      style={sidebarDockStyle}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="navigation"
      aria-label="Sidebar navigation"
    >
      <div style={sidebarPanelStyle}>
        {/* Logo header */}
        <div style={railHeaderStyle}>
          <div style={railLogoWrapStyle}>
            <img
              src={LOGO_MARK_SRC}
              alt="Detroit Axle"
              style={{ width: '26px', height: '26px', objectFit: 'contain' }}
            />
          </div>
          <div style={railBrandTextStyle}>
            <div style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: '14px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: isDark ? '#f1f5f9' : '#0f172a',
              whiteSpace: 'nowrap',
            }}>
              Detroit Axle
            </div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: isDark ? '#475569' : '#94a3b8',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              QA System
            </div>
          </div>
        </div>

        {/* Nav items */}
        <div style={navRailStyle}>
          {expanded
            ? navGroupsOrdered.map(([groupName, groupItems], gi) => (
                <div key={groupName}>
                  {gi > 0 && <div style={navDividerStyle} />}
                  <div style={{ ...navGroupLabelBaseStyle, color: GROUP_COLORS[groupName] || '#6b7280' }}>
                    {groupName}
                  </div>
                  {groupItems.map((item) => (
                    <NavButton
                      key={item.path}
                      item={item}
                      isActive={activePath === item.path}
                      expanded={expanded}
                      isDark={isDark}
                      reducedMotion={reducedMotion}
                      activeGroupColor={activeGroupColor}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              ))
            : navItems.map((item) => (
                <NavButton
                  key={item.path}
                  item={item}
                  isActive={activePath === item.path}
                  expanded={expanded}
                  isDark={isDark}
                  reducedMotion={reducedMotion}
                  activeGroupColor={activeGroupColor}
                  onNavigate={onNavigate}
                />
              ))}
        </div>

        {/* User card */}
        <SidebarUserCard
          profile={profile}
          initials={userInitials}
          expanded={expanded}
          isDark={isDark}
          onLogout={onLogout}
        />
      </div>
    </aside>
  );
}, (prev, next) =>
  prev.activePath === next.activePath &&
  prev.expanded === next.expanded &&
  prev.isDark === next.isDark &&
  prev.reducedMotion === next.reducedMotion &&
  prev.activeGroupColor === next.activeGroupColor &&
  prev.navItems === next.navItems &&
  prev.navGroupsOrdered === next.navGroupsOrdered &&
  prev.profile === next.profile &&
  prev.userInitials === next.userInitials &&
  prev.onNavigate === next.onNavigate &&
  prev.onMouseEnter === next.onMouseEnter &&
  prev.onMouseLeave === next.onMouseLeave &&
  prev.onLogout === next.onLogout
);

// ═════════════════════════════════════════════════════════════
// AppHeader — isolated so route/hover changes don't re-render it
// ═════════════════════════════════════════════════════════════

interface AppHeaderProps {
  isDark: boolean;
  isCompactLayout: boolean;
  hasSidebarRail: boolean;
  isSidebarPinned: boolean;
  activeRouteLabel: string;
  activeGroupColor: string;
  profileLabel: string;
  profile: UserProfile;
  userInitials: string;
  themeMode: ThemeMode;
  reducedMotion: boolean;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
}

const AppHeader = memo(function AppHeader({
  isDark,
  isCompactLayout,
  hasSidebarRail,
  isSidebarPinned,
  activeRouteLabel,
  activeGroupColor,
  profileLabel,
  profile,
  userInitials,
  themeMode,
  reducedMotion,
  onToggleSidebar,
  onToggleTheme,
  onLogout,
}: AppHeaderProps) {
  const headerShellStyle = useMemo<CSSProperties>(() => ({
    position: 'sticky',
    top: 0,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    height: '64px',
    background: isDark ? 'rgba(5,9,26,0.88)' : 'rgba(248,250,255,0.92)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: isDark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(203,213,225,0.7)',
    boxShadow: isDark
      ? '0 1px 0 rgba(255,255,255,0.03), 0 4px 16px rgba(0,0,0,0.3)'
      : '0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(15,23,42,0.06)',
  }), [isDark]);

  const headerSidebarToggleBtnStyle = useMemo<CSSProperties>(() => ({
    display: hasSidebarRail && !isCompactLayout ? 'grid' : 'none',
    placeItems: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    border: isSidebarPinned
      ? `1px solid ${activeGroupColor}55`
      : isDark ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(203,213,225,0.8)',
    background: isSidebarPinned
      ? `${activeGroupColor}14`
      : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
    color: isSidebarPinned ? activeGroupColor : isDark ? '#94a3b8' : '#64748b',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 160ms ease',
  }), [hasSidebarRail, isCompactLayout, isSidebarPinned, isDark, activeGroupColor]);

  const headerUserBadge = useMemo<CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 12px 6px 8px',
    borderRadius: '14px',
    border: isDark ? '1px solid rgba(148,163,184,0.1)' : '1px solid rgba(203,213,225,0.7)',
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
  }), [isDark]);

  const headerThemeBtnStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '12px',
    border: isDark ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(203,213,225,0.8)',
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
    color: isDark ? '#94a3b8' : '#64748b',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 140ms ease',
  }), [isDark]);

  const headerLogoutBtnStyle = useMemo<CSSProperties>(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: '12px',
    border: isDark ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(239,68,68,0.2)',
    background: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(254,242,242,0.8)',
    color: isDark ? '#fca5a5' : '#dc2626',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 140ms ease',
  }), [isDark]);

  return (
    <header style={headerShellStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={isSidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          title={isSidebarPinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          style={headerSidebarToggleBtnStyle}
        >
          <MenuIcon />
        </button>

        <div style={{
          width: '5px',
          height: '40px',
          borderRadius: '999px',
          background: `linear-gradient(180deg, ${activeGroupColor} 0%, rgba(139,92,246,0.6) 100%)`,
          boxShadow: `0 0 12px ${activeGroupColor}80`,
          flexShrink: 0,
          transition: 'background 400ms ease, box-shadow 400ms ease',
        }} />

        <img
          src={LOGO_WORDMARK_SRC}
          alt="Detroit Axle"
          style={{
            width: isCompactLayout ? '120px' : '180px',
            height: isCompactLayout ? '26px' : '36px',
            objectFit: 'contain',
            objectPosition: 'left center',
            display: 'block',
          }}
        />
      </div>

      {!isCompactLayout && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: isDark ? '#475569' : '#94a3b8', fontWeight: 500 }}>
              Workspace
            </span>
            <span style={{ color: isDark ? '#334155' : '#cbd5e1', fontSize: '14px' }}>›</span>
            <span style={{
              fontSize: '13px',
              fontWeight: 700,
              color: isDark ? '#e2e8f0' : '#1e293b',
              animation: reducedMotion ? undefined : 'da-fade-in 200ms ease',
            }}>
              {activeRouteLabel}
            </span>
          </nav>
          <div style={{ width: '1px', height: '16px', background: isDark ? 'rgba(148,163,184,0.15)' : 'rgba(203,213,225,0.6)' }} />
          <LiveClock isDark={isDark} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {!isCompactLayout && (
          <div style={headerUserBadge}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(37,99,235,0.6) 0%, rgba(139,92,246,0.6) 100%)',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: "'Bricolage Grotesque', sans-serif",
              letterSpacing: '-0.01em',
              flexShrink: 0,
            }}>
              {userInitials}
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.2 }}>
                {profileLabel || profile.email}
              </div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: activeGroupColor, fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {profile.role}
              </div>
            </div>
          </div>
        )}

        <button type="button" onClick={onToggleTheme} style={headerThemeBtnStyle} title={themeMode === 'light' ? 'Dark mode' : 'Light mode'}>
          {themeMode === 'light' ? <MoonIcon /> : <SunIcon />}
          {!isCompactLayout && (themeMode === 'light' ? 'Dark' : 'Light')}
        </button>

        <button type="button" onClick={onLogout} style={headerLogoutBtnStyle}>
          <LogoutIcon size={13} />
          {!isCompactLayout && 'Sign Out'}
        </button>
      </div>
    </header>
  );
}, (prev, next) =>
  prev.isDark === next.isDark &&
  prev.isCompactLayout === next.isCompactLayout &&
  prev.hasSidebarRail === next.hasSidebarRail &&
  prev.isSidebarPinned === next.isSidebarPinned &&
  prev.activeRouteLabel === next.activeRouteLabel &&
  prev.activeGroupColor === next.activeGroupColor &&
  prev.profileLabel === next.profileLabel &&
  prev.profile === next.profile &&
  prev.userInitials === next.userInitials &&
  prev.themeMode === next.themeMode &&
  prev.reducedMotion === next.reducedMotion &&
  prev.onToggleSidebar === next.onToggleSidebar &&
  prev.onToggleTheme === next.onToggleTheme &&
  prev.onLogout === next.onLogout
);

// ═════════════════════════════════════════════════════════════
// Sub-Components
// ═════════════════════════════════════════════════════════════

const LiveClock = memo(function LiveClock({ isDark }: { isDark: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');

  return (
    <div
      aria-label={`Current time ${hh}:${mm}:${ss}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1px',
        fontFamily: "'DM Mono', monospace",
        fontSize: '12px',
        fontWeight: 500,
        color: isDark ? 'rgba(148,163,184,0.9)' : 'rgba(100,116,139,0.9)',
        letterSpacing: '0.04em',
        userSelect: 'none',
      }}
    >
      <span>{hh}</span>
      <span style={{ animation: 'da-clock-blink 1s step-end infinite', opacity: 1 }}>:</span>
      <span>{mm}</span>
      <span style={{ animation: 'da-clock-blink 1s step-end infinite 0.5s', opacity: 1 }}>:</span>
      <span style={{ opacity: 0.6 }}>{ss}</span>
    </div>
  );
});

const ProfileInfoCard = memo(function ProfileInfoCard({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <div style={styles.profileInfoCard}>
      <div style={styles.profileInfoLabel}>{label}</div>
      <div style={styles.profileInfoValue}>{value}</div>
    </div>
  );
});

const ProfilePanel = memo(function ProfilePanel({
  title,
  profile,
  styles,
  theme,
}: {
  title: string;
  profile: UserProfile;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof getThemePalette>;
}) {
  const initials = getUserInitials(profile);
  return (
    <div style={styles.profilePanel}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '18px',
          background: `linear-gradient(135deg, ${theme.headerUserAvatarBg} 0%, rgba(37,99,235,0.6) 100%)`,
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: '20px',
          fontWeight: 800,
          fontFamily: "'Bricolage Grotesque', sans-serif",
          boxShadow: `0 0 0 2px rgba(59,130,246,0.3), 0 8px 24px rgba(37,99,235,0.25)`,
          flexShrink: 0,
          letterSpacing: '-0.02em',
        }}>
          {initials}
        </div>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.brandAccent, marginBottom: '4px', fontFamily: "'DM Sans', sans-serif" }}>
            Profile
          </div>
          <h2 style={{ margin: 0, color: theme.brandTitle, fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {title}
          </h2>
        </div>
      </div>

      <div style={styles.profileGrid}>
        <ProfileInfoCard label="Name" value={profile.agent_name || '-'} styles={styles} />
        <ProfileInfoCard label="Display Name" value={profile.display_name || '-'} styles={styles} />
        <ProfileInfoCard label="Email" value={profile.email || '-'} styles={styles} />
        <ProfileInfoCard label="Role" value={profile.role || '-'} styles={styles} />
        <ProfileInfoCard label="Agent ID" value={profile.agent_id || '-'} styles={styles} />
        <ProfileInfoCard label="Team" value={profile.team || '-'} styles={styles} />
      </div>
    </div>
  );
});

const LoadingScreen = memo(function LoadingScreen({
  theme,
  message = 'Preparing your workspace…',
}: {
  theme: ReturnType<typeof getThemePalette>;
  message?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      style={{ position: 'fixed', inset: 0, background: 'var(--da-loader-shell-bg)', display: 'grid', placeItems: 'center', zIndex: 9999 }}
    >
      <div style={{
        position: 'absolute',
        top: '18%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(720px, 78vw)',
        height: '320px',
        background: 'radial-gradient(ellipse, var(--da-loader-glow) 0%, transparent 72%)',
        pointerEvents: 'none',
        opacity: theme.bodyBackground.includes('241,245,249') ? 0.9 : 1,
      }} />
      <div className="da-themed-loader-card da-themed-loader-card--overlay" style={{ animation: 'da-fade-up 0.4s ease both' }}>
        <div className="da-themed-loader">
          <div className="da-themed-loader__art" aria-hidden="true">
            <div className="da-themed-loader__glow" />
            <div className="da-themed-loader__rotor">
              <div className="da-themed-loader__rotor-face" />
              <div className="da-themed-loader__hub" />
            </div>
            <div className="da-themed-loader__caliper" />
            <div className="da-themed-loader__spark" />
          </div>
          <div className="da-themed-loader__copy">
            <div className="da-themed-loader__eyebrow">Detroit Axle</div>
            <div className="da-themed-loader__label">{message}</div>
            <div className="da-themed-loader__sub">Brake-ready workspace loading</div>
          </div>
        </div>
      </div>
    </div>
  );
});

const SidebarUserCard = memo(function SidebarUserCard({
  profile,
  initials,
  expanded,
  isDark,
  onLogout,
}: {
  profile: UserProfile;
  initials: string;
  expanded: boolean;
  isDark: boolean;
  onLogout: () => void;
}) {
  const name = profile.display_name || profile.agent_name || profile.email || '';
  const roleColor = ROLE_COLORS[profile.role || 'qa'] || '#6b7280';

  return (
    <div style={{
      marginTop: 'auto',
      padding: '8px',
      borderTop: isDark ? '1px solid rgba(148,163,184,0.08)' : '1px solid rgba(203,213,225,0.25)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: expanded ? '10px' : '0',
        padding: expanded ? '10px' : '6px',
        borderRadius: '14px',
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        justifyContent: expanded ? 'flex-start' : 'center',
        transition: `all ${EXPAND_EASE}`,
        overflow: 'hidden',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: `linear-gradient(135deg, ${roleColor}33 0%, ${roleColor}55 100%)`,
          border: `1.5px solid ${roleColor}55`,
          display: 'grid',
          placeItems: 'center',
          fontSize: '11px',
          fontWeight: 800,
          color: roleColor,
          fontFamily: "'Bricolage Grotesque', sans-serif",
          flexShrink: 0,
          position: 'relative',
        }}>
          {initials}
          <div style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10b981',
            border: isDark ? '1.5px solid #0a1628' : '1.5px solid #f8fafc',
            animation: 'da-status-ring 2s ease-in-out infinite',
          }} />
        </div>

        <div style={{
          flex: 1,
          minWidth: 0,
          opacity: expanded ? 1 : 0,
          transform: expanded ? 'translateX(0)' : 'translateX(-8px)',
          transition: 'opacity 160ms ease, transform 200ms ease',
          pointerEvents: expanded ? 'auto' : 'none',
          overflow: 'hidden',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}>
            {name}
          </div>
          <div style={{ fontSize: '10px', fontWeight: 600, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '1px', fontFamily: "'DM Sans', sans-serif" }}>
            {profile.role}
          </div>
        </div>

        {expanded && (
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            aria-label="Sign out"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              border: isDark ? '1px solid rgba(148,163,184,0.12)' : '1px solid rgba(203,213,225,0.6)',
              background: 'transparent',
              color: isDark ? '#64748b' : '#94a3b8',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              transition: 'all 140ms ease',
            }}
            onMouseEnter={(e) => {
              const t = e.currentTarget;
              t.style.color = '#ef4444';
              t.style.borderColor = 'rgba(239,68,68,0.4)';
              t.style.background = 'rgba(239,68,68,0.08)';
            }}
            onMouseLeave={(e) => {
              const t = e.currentTarget;
              t.style.color = isDark ? '#64748b' : '#94a3b8';
              t.style.borderColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(203,213,225,0.6)';
              t.style.background = 'transparent';
            }}
          >
            <LogoutIcon size={13} />
          </button>
        )}
      </div>
    </div>
  );
});

// ═════════════════════════════════════════════════════════════
// Route Components
// ═════════════════════════════════════════════════════════════

const StaffRoutes = memo(function StaffRoutes({
  profile,
  styles,
  theme,
}: {
  profile: UserProfile;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof getThemePalette>;
}) {
  const isAdmin = profile.role === 'admin';
  const isStaff = isAdmin || profile.role === 'qa';

  return (
    <Routes>
      <Route path={ROUTES.dashboard} element={<Dashboard />} />
      <Route path={ROUTES.newAudit} element={<NewAuditSupabase />} />
      <Route path={ROUTES.auditsUpload} element={<AuditsImportSupabase />} />
      <Route path={ROUTES.auditsList} element={<AuditsListSupabase />} />
      <Route path={ROUTES.callsUpload} element={<CallsUploadSupabase />} />
      <Route path={ROUTES.ticketsUpload} element={<TicketsUploadSupabase />} />
      <Route path={ROUTES.ticketEvidence} element={<TicketEvidenceUploadSupabase />} />
      <Route path={ROUTES.ticketAiReview} element={<TicketAIReviewQueueSupabase />} />
      <Route path={ROUTES.salesUpload} element={<SalesUploadSupabase />} />
      <Route path={ROUTES.agentFeedback} element={<AgentFeedbackSupabase />} />
      <Route path={ROUTES.monitoring} element={<MonitoringSupabase />} />
      <Route path={ROUTES.teamHeatmap} element={<TeamHeatmapSupabase currentUser={profile} />} />
      {isAdmin && <Route path={ROUTES.accounts} element={<AccountsSupabase />} />}
      {isAdmin && <Route path={ROUTES.supervisorRequests} element={<SupervisorRequestsSupabase currentUser={profile} />} />}
      {isStaff && <Route path={ROUTES.reports} element={<ReportsSupabase />} />}
      <Route path={ROUTES.profile} element={
        <ProfilePanel
          title={isAdmin ? 'My Admin Profile' : 'My QA Profile'}
          profile={profile}
          styles={styles}
          theme={theme}
        />
      } />
      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  );
});

const SupervisorRoutes = memo(function SupervisorRoutes({
  profile,
  styles,
  theme,
}: {
  profile: UserProfile;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof getThemePalette>;
}) {
  return (
    <Routes>
      <Route path={ROUTES.supervisorOverview} element={<SupervisorPortal currentUser={profile} initialTab="overview" hideInternalTabs />} />
      <Route path={ROUTES.supervisorTeamDashboard} element={<SupervisorPortal currentUser={profile} initialTab="team-dashboard" hideInternalTabs />} />
      <Route path={ROUTES.supervisorRequestsView} element={<SupervisorPortal currentUser={profile} initialTab="requests" hideInternalTabs />} />
      <Route path={ROUTES.supervisorProfile} element={<ProfilePanel title="My Supervisor Profile" profile={profile} styles={styles} theme={theme} />} />
      <Route path="*" element={<Navigate to={ROUTES.supervisorOverview} replace />} />
    </Routes>
  );
});

// ═════════════════════════════════════════════════════════════
// Main Layout
// ═════════════════════════════════════════════════════════════

function AppShell() {
  const auth = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const viewportWidth = useViewportWidth();
  const { themeMode, toggleTheme } = useThemeManager();

  useGlobalStyles();

  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const theme = useMemo(() => getThemePalette(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(theme, themeMode), [theme, themeMode]);
  const isCompactLayout = viewportWidth < COMPACT_BREAKPOINT;
  const isDark = themeMode === 'dark';

  // Sync body styles
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.background = theme.bodyBackground;
    document.body.style.color = theme.bodyColor;
    document.body.style.fontFamily = "'DM Sans', sans-serif";
    applyThemeCssVariables(themeMode);
  }, [themeMode, theme.bodyBackground, theme.bodyColor]);

  // Reset sidebar state when entering compact mode
  useEffect(() => {
    if (isCompactLayout) {
      setIsSidebarPinned(false);
      setIsSidebarHovered(false);
    }
  }, [isCompactLayout]);

  const { profile, loading, recoveryMode, logout, handleRecoveryComplete } = auth;

  const profileLabel = useMemo(() => {
    if (!profile) return '';
    return profile.display_name
      ? `${profile.agent_name} — ${profile.display_name}`
      : profile.agent_name ?? '';
  }, [profile]);

  const navItems = useMemo(() => (profile ? buildNavItems(profile) : []), [profile]);

  const navGroupsOrdered = useMemo(() => {
    const groups: Record<string, NavItem[]> = {};
    navItems.forEach((item) => {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    });
    return Object.entries(groups) as [string, NavItem[]][];
  }, [navItems]);

  // ── Stable callbacks ──────────────────────────────────────

  const handleNavigate = useCallback((path: RoutePath) => navigate(path), [navigate]);
  const handleToggleSidebar = useCallback(() => setIsSidebarPinned((p) => !p), []);
  const handleLogout = useCallback(() => logout(), [logout]);
  const handleSidebarEnter = useCallback(() => setIsSidebarHovered(true), []);
  const handleSidebarLeave = useCallback(() => setIsSidebarHovered(false), []);

  // ── Derived values ────────────────────────────────────────

  if (loading) return <LoadingScreen theme={theme} />;
  if (recoveryMode) return <ResetPassword onComplete={handleRecoveryComplete} onLogout={logout} />;
  if (!auth.session) return <Login />;

  if (!profile) {
    return (
      <div style={styles.loadingShell}>
        <div style={styles.errorCard}>
          <div style={styles.sectionEyebrow}>Profile Error</div>
          <h1 style={{ marginTop: 0, color: theme.errorText, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Profile not found
          </h1>
          <p style={{ color: theme.loadingSubtext, marginBottom: '20px' }}>
            {auth.profileError || 'This user exists in Supabase Auth but does not have a profile row yet.'}
          </p>
          <button onClick={logout} style={styles.logoutButton}>Logout</button>
        </div>
      </div>
    );
  }

  const isAdmin = profile.role === 'admin';
  const isQA = profile.role === 'qa';
  const isSupervisor = profile.role === 'supervisor';
  const isStaff = isAdmin || isQA;
  const hasSidebarRail = isStaff || isSupervisor;

  const activeRouteLabel = getActiveRouteLabel(location.pathname as RoutePath, navItems);
  const expandedSidebar = !isCompactLayout && (isSidebarPinned || isSidebarHovered);
  const userInitials = getUserInitials(profile);

  const activeItem = navItems.find((item) => item.path === location.pathname);
  const activeGroupColor = activeItem ? (GROUP_COLORS[activeItem.group] || '#3b82f6') : '#3b82f6';

  // ── Layout styles (stable across hover) ──────────────────

  const topAccentBarStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #1d4ed8 0%, #3b82f6 35%, #8b5cf6 65%, #06b6d4 100%)',
    zIndex: 101,
    animation: reducedMotion ? undefined : 'da-top-bar-glow 3s ease-in-out infinite',
  };

  const desktopShellStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: hasSidebarRail
      ? `${expandedSidebar ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH}px minmax(0, 1fr)`
      : 'minmax(0, 1fr)',
    gap: hasSidebarRail ? '16px' : '0',
    alignItems: 'start',
    transition: reducedMotion ? undefined : `grid-template-columns ${EXPAND_EASE}`,
  };

  return (
    <AuthContext.Provider value={{ profile, loading: false, logout }}>
      <div role="presentation" style={topAccentBarStyle} />

      <div style={{ ...styles.appShell, fontFamily: "'DM Sans', sans-serif", paddingTop: '3px' }}>
        <div style={styles.backgroundGlowTop} />
        <div style={styles.backgroundGlowBottom} />

        <AppHeader
          isDark={isDark}
          isCompactLayout={isCompactLayout}
          hasSidebarRail={hasSidebarRail}
          isSidebarPinned={isSidebarPinned}
          activeRouteLabel={activeRouteLabel}
          activeGroupColor={activeGroupColor}
          profileLabel={profileLabel}
          profile={profile}
          userInitials={userInitials}
          themeMode={themeMode}
          reducedMotion={reducedMotion}
          onToggleSidebar={handleToggleSidebar}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
        />

        {/* ── Main Content ── */}
        {hasSidebarRail ? (
          <main style={styles.contentShell}>
            {isCompactLayout ? (
              <>
                <nav style={styles.navShell} aria-label="Main navigation">
                  <div style={styles.navScroller}>
                    {navItems.map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => handleNavigate(item.path)}
                        aria-current={location.pathname === item.path ? 'page' : undefined}
                        style={{
                          ...styles.navButton,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontFamily: "'DM Sans', sans-serif",
                          fontWeight: 600,
                          ...(location.pathname === item.path ? styles.activeNavButton : {}),
                        }}
                      >
                        <NavIconSvg label={item.label} size={14} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </nav>
                <div style={styles.contentInner}>
                  {isStaff
                    ? <StaffRoutes profile={profile} styles={styles} theme={theme} />
                    : <SupervisorRoutes profile={profile} styles={styles} theme={theme} />}
                </div>
              </>
            ) : (
              <div style={desktopShellStyle}>
                <SidebarPanel
                  navItems={navItems}
                  navGroupsOrdered={navGroupsOrdered}
                  activePath={location.pathname}
                  expanded={expandedSidebar}
                  isDark={isDark}
                  reducedMotion={reducedMotion}
                  activeGroupColor={activeGroupColor}
                  profile={profile}
                  userInitials={userInitials}
                  onNavigate={handleNavigate}
                  onMouseEnter={handleSidebarEnter}
                  onMouseLeave={handleSidebarLeave}
                  onLogout={handleLogout}
                />

                <div style={styles.contentInner}>
                  {isStaff
                    ? <StaffRoutes profile={profile} styles={styles} theme={theme} />
                    : <SupervisorRoutes profile={profile} styles={styles} theme={theme} />}
                </div>
              </div>
            )}
          </main>
        ) : (
          <main style={styles.contentShell}>
            <div style={styles.contentInner}>
              <AgentPortal currentUser={profile} />
            </div>
          </main>
        )}
      </div>
    </AuthContext.Provider>
  );
}

// ═════════════════════════════════════════════════════════════
// Root
// ═════════════════════════════════════════════════════════════

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
