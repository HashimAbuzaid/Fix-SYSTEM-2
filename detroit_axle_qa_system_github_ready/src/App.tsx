// ─────────────────────────────────────────────────────────────
// src/App.tsx
// Application root. Owns only:
//   • BrowserRouter + ErrorBoundary wrapper
//   • Auth guard / loader / recovery-mode gate
//   • Theme bootstrap
//   • Global CSS injection
//   • AppShell layout (sidebar + header + route trees)
//
// Everything else lives in its own module:
//   config/routes.ts        — ROUTES, NAV_GROUPS, GROUP_ACCENT, G_NAV_MAP …
//   config/navItems.ts      — NavItem type, buildNavItems(), getUserInitials() …
//   styles/globalCss.ts     — GLOBAL_CSS string, useGlobalStyles()
//   components/shell/Sidebar.tsx        — <Sidebar>, <NavIcon>
//   components/shell/Header.tsx         — <Header>, <ShortcutsModal>
//   components/shell/CommandPalette.tsx — <CommandPalette>
// ─────────────────────────────────────────────────────────────

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
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

// ── Config ────────────────────────────────────────────────────
import {
  ROUTES,
  GROUP_ACCENT,
  BOTTOM_NAV_LABELS,
  G_NAV_MAP,
  type RoutePath,
} from "./config/routes";
import {
  buildNavItems,
  getUserInitials,
  getActiveRouteLabel,
  ROLE_COLORS,
  type NavItem,
} from "./config/navItems";

// ── Styles ────────────────────────────────────────────────────
import {
  useGlobalStyles,
  SIDEBAR_W_COLLAPSED,
  SIDEBAR_W_EXPANDED,
  COMPACT_BP,
  BOTTOM_NAV_BP,
} from "./styles/globalCss";

// ── Shell components ──────────────────────────────────────────
import { Sidebar,  NavIcon }      from "./components/shell/Sidebar";
import { Header,   ShortcutsModal } from "./components/shell/Header";
import { CommandPalette }          from "./components/shell/CommandPalette";
import type { RecentPage }         from "./components/shell/CommandPalette";

// ── Auth ──────────────────────────────────────────────────────
import { AuthContext }    from "./context/AuthContext";
import { useAuthState }   from "./hooks/useAuthState";
import type { UserProfile } from "./context/AuthContext";

// ── Theme ─────────────────────────────────────────────────────
import {
  applyThemeCssVariables,
  readStoredTheme,
  type ThemeMode,
} from "./lib/theme";

// ── Other shell helpers ───────────────────────────────────────
import { ErrorBoundary }    from "./components/ErrorBoundary";
import HelpDrawer           from "./components/HelpDrawer";
import HelpContentAdmin     from "./components/HelpContentAdmin";
import HelpTourOverlay      from "./components/HelpTourOverlay";
import SupportInbox         from "./components/SupportInbox";

// ── Page components ───────────────────────────────────────────
import Login                           from "./QA/Login";
import ResetPassword                   from "./QA/ResetPassword";
import AgentPortal                     from "./QA/AgentPortal";
import SupervisorPortal                from "./QA/SupervisorPortal";
import Dashboard                       from "./QA/Dashboard";
import NewAuditSupabase                from "./QA/NewAuditSupabase";
import AuditsImportSupabase            from "./QA/AuditsImportSupabase";
import CallsUploadSupabase             from "./QA/CallsUploadSupabase";
import TicketsUploadSupabase           from "./QA/TicketsUploadSupabase";
import TicketEvidenceUploadSupabase    from "./QA/TicketEvidenceUploadSupabase";
import TicketAIReviewQueueSupabase     from "./QA/TicketAIReviewQueueSupabase";
import SalesUploadSupabase             from "./QA/SalesUploadSupabase";
import AuditsListSupabase              from "./QA/AuditsListSupabase";
import AccountsSupabase                from "./QA/AccountsSupabase";
import SupervisorRequestsSupabase      from "./QA/SupervisorRequestsSupabase";
import AgentFeedbackSupabase           from "./QA/AgentFeedbackSupabase";
import ReportsSupabase                 from "./QA/ReportsSupabase";
import MonitoringSupabase              from "./QA/MonitoringSupabase";
import TeamHeatmapSupabase             from "./QA/TeamHeatmapSupabase";
import LearningCenter                  from "./QA/LearningCenter";

// ─────────────────────────────────────────────────────────────
// Local constants
// ─────────────────────────────────────────────────────────────

const RECENT_PAGES_KEY   = "da-recent-pages";
const COLLAPSED_GROUPS_KEY = "da-collapsed-groups";
const MAX_RECENT_PAGES   = 6;

interface MiniProgress {
  xp:               number;
  level:            number;
  streak:           number;
  completedModules: number;
}

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try { return readStoredTheme(); }
    catch {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem("da-theme", mode); } catch { /* noop */ }
    document.documentElement.setAttribute("data-theme", mode);
    document.documentElement.style.colorScheme = mode === "light" ? "light" : "dark";
    applyThemeCssVariables(mode);
  }, [mode]);

  const toggle = useCallback(
    () => setMode((p) => (p === "light" ? "dark" : "light")),
    [],
  );

  return { mode, toggle } as const;
}

function useViewportWidth(): number {
  const [w, setW] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
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

/** Reads the LearningCenter's persisted progress for the sidebar widget. */
function useLearningProgress(userId: string | null | undefined): MiniProgress {
  const [progress, setProgress] = useState<MiniProgress>({
    xp: 0, level: 0, streak: 0, completedModules: 0,
  });
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
    } catch { /* noop */ }
  }, [userId]);
  return progress;
}

/** Tracks the last N visited pages for the command palette "Recent" section. */
function useRecentPages(
  navItems: readonly NavItem[],
  currentPath: string,
): RecentPage[] {
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
      try { localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, [currentPath, navItems]);

  return recent;
}

/** Persists which sidebar groups are collapsed. */
function useCollapsedGroups(): [Set<string>, (group: string) => void] {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(COLLAPSED_GROUPS_KEY) ?? "[]"));
    } catch { return new Set(); }
  });

  const toggle = useCallback((group: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      try {
        localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(Array.from(next)));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  return [collapsed, toggle];
}

// ─────────────────────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────────────────────

const RotorLoaderVisual = memo(function RotorLoaderVisual() {
  const boltHoles        = [0, 60, 120, 180, 240, 300];
  const ventilationSlots = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <div className="da-loader-visual" aria-hidden="true">
      <div className="da-loader-disc-spin">
        <svg viewBox="0 0 140 140" className="da-loader-svg">
          <defs>
            <radialGradient id="da-rotor-metal" cx="48%" cy="40%" r="70%">
              <stop offset="0%"   stopColor="#f3f6fb" />
              <stop offset="42%"  stopColor="#a4acb8" />
              <stop offset="72%"  stopColor="#5d6470" />
              <stop offset="100%" stopColor="#222831" />
            </radialGradient>
            <linearGradient id="da-rotor-edge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#eef2f7" />
              <stop offset="45%"  stopColor="#6d7480" />
              <stop offset="100%" stopColor="#1b2028" />
            </linearGradient>
            <radialGradient id="da-rotor-hub" cx="45%" cy="38%" r="75%">
              <stop offset="0%"   stopColor="#cfd6df" />
              <stop offset="70%"  stopColor="#47515e" />
              <stop offset="100%" stopColor="#1a2028" />
            </radialGradient>
          </defs>
          <circle cx="70" cy="70" r="61" fill="#0f1319" opacity="0.4" />
          <circle cx="70" cy="70" r="58" fill="url(#da-rotor-edge)"
            stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
          <circle cx="70" cy="70" r="46.5" fill="none"
            stroke="rgba(15,18,24,0.85)" strokeWidth="20" />
          <circle cx="70" cy="70" r="46.5" fill="none"
            stroke="url(#da-rotor-metal)" strokeWidth="16" />
          <circle cx="70" cy="70" r="45.5" fill="none"
            stroke="rgba(255,255,255,0.24)" strokeWidth="1.6" opacity="0.75" />
          {ventilationSlots.map((angle) => (
            <rect key={angle} x="67" y="15" width="6" height="22" rx="3"
              fill="rgba(12,16,24,0.62)"
              transform={`rotate(${angle} 70 70)`} />
          ))}
          <circle cx="70" cy="70" r="23" fill="url(#da-rotor-hub)"
            stroke="rgba(255,255,255,0.18)" strokeWidth="1.4" />
          <circle cx="70" cy="70" r="8.5" fill="#0b1016"
            stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
          {boltHoles.map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x   = 70 + Math.cos(rad) * 15;
            const y   = 70 + Math.sin(rad) * 15;
            return (
              <circle key={angle} cx={x} cy={y} r="2.6" fill="#0d1218"
                stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
            );
          })}
        </svg>
      </div>
      <svg viewBox="0 0 140 140" className="da-loader-svg da-loader-caliper">
        <defs>
          <linearGradient id="da-caliper-body" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#d7dee7" />
            <stop offset="35%"  stopColor="#8a93a0" />
            <stop offset="100%" stopColor="#353d49" />
          </linearGradient>
          <linearGradient id="da-caliper-accent" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#4ba7ff" />
            <stop offset="100%" stopColor="#235ec9" />
          </linearGradient>
        </defs>
        <path
          d="M88 28 C104 28 114 39 114 55 V84 C114 97 105 108 91 108 H78 C74 108 72 105 72 101
             V92 C72 88 70 85 66 84 L57 82 C53 81 50 77 50 73 V62 C50 58 53 54 57 53
             L66 51 C70 50 72 47 72 43 V35 C72 31 75 28 79 28 H88 Z"
          fill="url(#da-caliper-body)"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1.5"
        />
        <rect x="76" y="50" width="22" height="39" rx="9"
          fill="rgba(12,16,22,0.28)" />
        <rect x="81" y="45" width="8" height="49" rx="4"
          fill="url(#da-caliper-accent)" opacity="0.95" />
        <circle cx="95" cy="48" r="3.4" fill="#171d25"
          stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        <circle cx="95" cy="92" r="3.4" fill="#171d25"
          stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        <path d="M57 58 H74" stroke="rgba(255,255,255,0.18)"
          strokeWidth="2" strokeLinecap="round" />
        <path d="M57 78 H74" stroke="rgba(255,255,255,0.18)"
          strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
});

const Loader = memo(function Loader({
  message = "Loading workspace…",
}: {
  message?: string;
}) {
  return (
    <div className="da-loader-shell" role="status" aria-label={message}>
      <div className="da-loader-card">
        <RotorLoaderVisual />
        <div className="da-loader-copy">
          <div className="da-loader-eyebrow">Detroit Axle QA</div>
          <div className="da-loader-headline">{message}</div>
          <div className="da-loader-sub">
            Checking rotors, calipers, and release state.
          </div>
          <div className="da-loader-bar">
            <div className="da-loader-bar-fill" />
          </div>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Profile panel (used by all three route trees)
// ─────────────────────────────────────────────────────────────

const ProfilePanel = memo(function ProfilePanel({
  title,
  profile,
}: {
  title:   string;
  profile: UserProfile;
}) {
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
        <div
          style={{
            width: 52, height: 52, borderRadius: 14,
            background: `color-mix(in srgb, ${roleColor} 15%, transparent)`,
            border:     `2px solid color-mix(in srgb, ${roleColor} 30%, transparent)`,
            display: "grid", placeItems: "center",
            fontSize: 18, fontWeight: 700, color: roleColor,
            flexShrink: 0, letterSpacing: "-0.02em",
          }}
        >
          {initials}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)", marginBottom: 4 }}>
            Profile
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--fg-default)", letterSpacing: "-0.02em" }}>
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
// Mobile bottom tab bar
// ─────────────────────────────────────────────────────────────

const BottomNav = memo(function BottomNav({
  navItems,
  activePath,
  onNavigate,
  onOpenHelp,
}: {
  navItems:    readonly NavItem[];
  activePath:  string;
  onNavigate:  (path: RoutePath) => void;
  onOpenHelp:  () => void;
}) {
  const bottomItems = useMemo(() => {
    const preferred = navItems
      .filter((i) => BOTTOM_NAV_LABELS.includes(i.label))
      .slice(0, 4);
    return preferred.slice(0, 4);
  }, [navItems]);

  return (
    <div className="da-bottom-nav">
      {bottomItems.map((item) => {
        const isActive = activePath === item.path;
        return (
          <button
            key={item.path}
            type="button"
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
      <button
        type="button"
        className="da-bottom-nav-item"
        onClick={onOpenHelp}
        aria-label="Help"
      >
        <div className="da-bottom-nav-icon"><NavIcon label="Help" size={20} /></div>
        <div className="da-bottom-nav-label">Help</div>
      </button>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Route transition wrapper
// ─────────────────────────────────────────────────────────────

const RouteTransition = memo(function RouteTransition({
  children,
  routeKey,
}: {
  children: ReactNode;
  routeKey: string;
}) {
  return (
    <div key={routeKey} className="da-route-fade">
      {children}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// Role-scoped route trees
// ─────────────────────────────────────────────────────────────

const StaffRoutes = memo(function StaffRoutes({ profile }: { profile: UserProfile }) {
  const location = useLocation();
  const isAdmin  = profile.role === "admin";
  const isStaff  = isAdmin || profile.role === "qa";

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
        {isAdmin && (
          <Route path={ROUTES.accounts}
            element={<AccountsSupabase />} />
        )}
        {isAdmin && (
          <Route path={ROUTES.supervisorRequests}
            element={<SupervisorRequestsSupabase currentUser={profile} />} />
        )}
        {isAdmin && (
          <Route path={ROUTES.supportInbox}
            element={<SupportInbox currentUser={profile} />} />
        )}
        {isAdmin && (
          <Route path={ROUTES.helpAdmin}
            element={<HelpContentAdmin currentUser={profile} />} />
        )}
        {isStaff && (
          <Route path={ROUTES.reports} element={<ReportsSupabase />} />
        )}
        <Route path={ROUTES.learningCenter}
          element={<LearningCenter currentUser={profile} />} />
        <Route path={ROUTES.profile}
          element={
            <ProfilePanel
              title={isAdmin ? "My Admin Profile" : "My QA Profile"}
              profile={profile}
            />
          }
        />
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
        <Route path={ROUTES.supervisorOverview}
          element={<SupervisorPortal currentUser={profile} initialTab="overview" hideInternalTabs />} />
        <Route path={ROUTES.supervisorTeamDashboard}
          element={<SupervisorPortal currentUser={profile} initialTab="team-dashboard" hideInternalTabs />} />
        <Route path={ROUTES.supervisorRequestsView}
          element={<SupervisorPortal currentUser={profile} initialTab="requests" hideInternalTabs />} />
        <Route path={ROUTES.learningCenter}
          element={<LearningCenter currentUser={profile} />} />
        <Route path={ROUTES.supervisorProfile}
          element={<ProfilePanel title="My Supervisor Profile" profile={profile} />} />
        <Route path="*"
          element={<Navigate to={ROUTES.supervisorOverview} replace />} />
      </Routes>
    </RouteTransition>
  );
});

const AgentRoutes = memo(function AgentRoutes({ profile }: { profile: UserProfile }) {
  const location = useLocation();
  return (
    <RouteTransition routeKey={location.pathname}>
      <Routes>
        <Route path={ROUTES.agentPortal}
          element={<AgentPortal currentUser={profile} />} />
        <Route path={ROUTES.learningCenter}
          element={<LearningCenter currentUser={profile} />} />
        <Route path="*"
          element={<Navigate to={ROUTES.agentPortal} replace />} />
      </Routes>
    </RouteTransition>
  );
});

// ─────────────────────────────────────────────────────────────
// Sign-out icon (used only in the error card below)
// ─────────────────────────────────────────────────────────────

function LogOutIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// AppShell  (rendered inside BrowserRouter)
// ─────────────────────────────────────────────────────────────

function AppShell() {
  const auth          = useAuthState();
  const navigate      = useNavigate();
  const location      = useLocation();
  const viewportWidth = useViewportWidth();
  const { mode: themeMode, toggle: toggleTheme } = useTheme();

  // Inject global CSS once
  useGlobalStyles();

  // ── UI state ───────────────────────────────────────────────
  const [isSidebarPinned,  setSidebarPinned]  = useState(false);
  const [isSidebarHovered, setSidebarHovered] = useState(false);
  const [isCmdOpen,        setCmdOpen]        = useState(false);
  const [helpOpen,         setHelpOpen]       = useState(false);
  const [shortcutsOpen,    setShortcutsOpen]  = useState(false);
  const [activeTourId,     setActiveTourId]   = useState<string | null>(null);

  // Ref to avoid stale-closure issues in mouse handlers
  const pinnedRef = useRef(false);

  const [collapsedGroups, toggleGroup] = useCollapsedGroups();

  // ── Derived layout flags ───────────────────────────────────
  const isCompact          = viewportWidth < COMPACT_BP;
  const isMobileBottom     = viewportWidth < BOTTOM_NAV_BP;
  const isSidebarExpanded  = !isCompact && (isSidebarPinned || isSidebarHovered);

  // ── Learning progress (sidebar widget) ────────────────────
  const learningProgress = useLearningProgress(auth.profile?.id);

  // ── Nav items ──────────────────────────────────────────────
  const navItems = useMemo(
    () => (auth.profile ? buildNavItems(auth.profile) : []),
    [auth.profile],
  );

  /** Nav items grouped and ordered for the sidebar. */
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
    [location.pathname, navItems],
  );

  // ── Recent pages (command palette) ────────────────────────
  const recentPages = useRecentPages(navItems, location.pathname);

  // ── Sync CSS variables ────────────────────────────────────
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-w",
      isSidebarExpanded
        ? `${SIDEBAR_W_EXPANDED}px`
        : `${SIDEBAR_W_COLLAPSED}px`,
    );
  }, [isSidebarExpanded]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
  }, [themeMode]);

  // Collapse sidebar pin when entering compact mode
  useEffect(() => {
    if (isCompact) {
      setSidebarPinned(false);
      pinnedRef.current = false;
    }
  }, [isCompact]);

  // ── Global keyboard shortcuts ─────────────────────────────
  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      const tag      = (e.target as HTMLElement)?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable;

      // ⌘K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
        return;
      }
      // ⌘/ — help drawer
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }
      // ⌘\ — pin sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSidebarPinned((p) => { pinnedRef.current = !p; return !p; });
        return;
      }
      // ⌘⇧T — toggle theme
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "T") {
        e.preventDefault();
        toggleTheme();
        return;
      }
      // Esc — close modals in priority order
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
        const target = G_NAV_MAP[e.key.toLowerCase()];
        if (target) { navigate(target); e.preventDefault(); }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, toggleTheme, shortcutsOpen, helpOpen]);

  // ── Stable callbacks ──────────────────────────────────────
  const handleNavigate      = useCallback((path: RoutePath) => { navigate(path); setCmdOpen(false); }, [navigate]);
  const handleTogglePin     = useCallback(() => { setSidebarPinned((p) => { pinnedRef.current = !p; return !p; }); }, []);
  const handleSidebarEnter  = useCallback(() => { if (!pinnedRef.current) setSidebarHovered(true); }, []);
  const handleSidebarLeave  = useCallback(() => setSidebarHovered(false), []);
  const handleLogout        = useCallback(() => auth.logout(), [auth]);
  const handleOpenCmd       = useCallback(() => setCmdOpen(true),          []);
  const handleCloseCmd      = useCallback(() => setCmdOpen(false),         []);
  const handleOpenHelp      = useCallback(() => setHelpOpen(true),         []);
  const handleCloseHelp     = useCallback(() => setHelpOpen(false),        []);
  const handleOpenShortcuts = useCallback(() => setShortcutsOpen(true),    []);
  const handleCloseShortcuts = useCallback(() => setShortcutsOpen(false),  []);
  const handleHelpNavigate  = useCallback((path: string) => { navigate(path); setHelpOpen(false); }, [navigate]);
  const handleStartHelpTour = useCallback((tourId: string) => { setActiveTourId(tourId); setHelpOpen(false); }, []);
  const handleCloseHelpTour = useCallback(() => setActiveTourId(null),     []);
  const handleGoToLearning  = useCallback(() => navigate(ROUTES.learningCenter), [navigate]);

  // ── Auth guard states ─────────────────────────────────────
  const { profile, loading, recoveryMode, logout, handleRecoveryComplete } = auth;

  if (loading)      return <Loader />;
  if (recoveryMode) return <ResetPassword onComplete={handleRecoveryComplete} onLogout={logout} />;
  if (!auth.session) return <Login />;
  if (!profile) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
        <div className="da-error-card">
          <div style={{ fontSize: 36, marginBottom: 14 }}>⚠️</div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-rose)", marginBottom: 10 }}>
            Profile error
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--fg-default)", marginBottom: 10 }}>
            Profile not found
          </h1>
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

  // ── Role flags ────────────────────────────────────────────
  const isAdmin      = profile.role === "admin";
  const isQA         = profile.role === "qa";
  const isSupervisor = profile.role === "supervisor";
  const isStaff      = isAdmin || isQA;
  const hasSidebar   = isStaff || isSupervisor || profile.role === "agent";
  const userInitials = getUserInitials(profile);

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  return (
    <AuthContext.Provider value={{ profile, loading: false, logout }}>
      {/* ── Overlays ───────────────────────────────────────── */}
      {isCmdOpen && (
        <CommandPalette
          items={navItems}
          recentPages={recentPages}
          onNavigate={handleNavigate}
          onClose={handleCloseCmd}
        />
      )}

      {shortcutsOpen && (
        <ShortcutsModal onClose={handleCloseShortcuts} />
      )}

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

      {/* ── Shell layout ───────────────────────────────────── */}
      <div
        className="da-shell"
        style={{
          "--sidebar-w": isSidebarExpanded
            ? `${SIDEBAR_W_EXPANDED}px`
            : `${SIDEBAR_W_COLLAPSED}px`,
        } as CSSProperties}
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

        {/* Page root (header + main content) */}
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
                {/* Compact horizontal nav (tablet: 768–1024 px) */}
                {isCompact && !isMobileBottom && (
                  <nav className="da-compact-nav" aria-label="Tablet navigation">
                    {navItems.map((item) => {
                      const accent   = GROUP_ACCENT[item.group] || "var(--accent-blue)";
                      const isActive = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          type="button"
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
                      type="button"
                      className="da-compact-nav-item"
                      onClick={handleOpenHelp}
                      style={{ "--item-accent": "var(--accent-blue)" } as CSSProperties}
                    >
                      <NavIcon label="Help" size={13} /> Help
                    </button>
                  </nav>
                )}

                {/* Route content */}
                <div className="da-content">
                  {isStaff
                    ? <StaffRoutes      profile={profile} />
                    : isSupervisor
                    ? <SupervisorRoutes profile={profile} />
                    : <AgentRoutes      profile={profile} />}
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
              /* No sidebar — direct agent portal */
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
