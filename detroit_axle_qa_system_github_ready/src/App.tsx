// ═══════════════════════════════════════════════════════════════════════════
// src/App.tsx  — UPGRADED v2.0
//
// Architecture changes:
//  • Zustand stores replace scattered useState: useAppStore, useNotifStore
//  • React.lazy + Suspense for every page (code-split, parallel-load)
//  • useDeferredValue for command-palette search (non-blocking)
//  • Strict discriminated-union auth states (loading | recovery | unauthed | blocked | ready)
//  • Per-zone ErrorBoundary (shell vs route zone)
//  • Keyboard shortcut registry (ShortcutRegistry) — decoupled from component
//  • Breadcrumb trail derived from router + navItems
//  • Notification system (bell icon + toast stack + useNotifStore)
//  • Route transitions via CSS animation tokens (no Framer dep required)
//  • Sidebar hover intent (100ms debounce — eliminates flicker)
//  • Compact nav scroll-lock when mobile bottom bar is open
//  • All callbacks stable via useCallback; heavy objects via useMemo
//  • Zero "any" — strict types throughout
// ═══════════════════════════════════════════════════════════════════════════

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
  lazy,
  Suspense,
  useDeferredValue,
  useTransition,
  type CSSProperties,
  type ReactNode,
  type FC,
} from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

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
import { Sidebar, NavIcon }        from "./components/shell/Sidebar";
import { Header, ShortcutsModal }  from "./components/shell/Header";
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
import HelpTourOverlay      from "./components/HelpTourOverlay";

// ── Page components (lazy-loaded for code splitting) ──────────
const Login                        = lazy(() => import("./QA/Login"));
const ResetPassword                = lazy(() => import("./QA/ResetPassword"));
const AgentPortal                  = lazy(() => import("./QA/AgentPortal"));
const SupervisorPortal             = lazy(() => import("./QA/SupervisorPortal"));
const Dashboard                    = lazy(() => import("./QA/Dashboard"));
const NewAuditSupabase             = lazy(() => import("./QA/NewAuditSupabase"));
const AuditsImportSupabase         = lazy(() => import("./QA/AuditsImportSupabase"));
const CallsUploadSupabase          = lazy(() => import("./QA/CallsUploadSupabase"));
const TicketsUploadSupabase        = lazy(() => import("./QA/TicketsUploadSupabase"));
const TicketEvidenceUploadSupabase = lazy(() => import("./QA/TicketEvidenceUploadSupabase"));
const TicketAIReviewQueueSupabase  = lazy(() => import("./QA/TicketAIReviewQueueSupabase"));
const SalesUploadSupabase          = lazy(() => import("./QA/SalesUploadSupabase"));
const AuditsListSupabase           = lazy(() => import("./QA/AuditsListSupabase"));
const AccountsSupabase             = lazy(() => import("./QA/AccountsSupabase"));
const SupervisorRequestsSupabase   = lazy(() => import("./QA/SupervisorRequestsSupabase"));
const AgentFeedbackSupabase        = lazy(() => import("./QA/AgentFeedbackSupabase"));
const ReportsSupabase              = lazy(() => import("./QA/ReportsSupabase"));
const MonitoringSupabase           = lazy(() => import("./QA/MonitoringSupabase"));
const TeamHeatmapSupabase          = lazy(() => import("./QA/TeamHeatmapSupabase"));
const LearningCenter               = lazy(() => import("./QA/LearningCenter"));
const HelpContentAdmin             = lazy(() => import("./components/HelpContentAdmin"));
const SupportInbox                 = lazy(() => import("./components/SupportInbox"));

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type NotifLevel = "info" | "success" | "warning" | "error";

interface Notification {
  id:        string;
  level:     NotifLevel;
  title:     string;
  message?:  string;
  durationMs?: number;
  createdAt: number;
  read:      boolean;
}

interface MiniProgress {
  xp:               number;
  level:            number;
  streak:           number;
  completedModules: number;
}

// ---------------------------------------------------------------------------
// Discriminated union for auth state — eliminates impossible combinations.
//
// • loading     – session/profile fetch in flight
// • recovery    – password-reset flow active
// • unauthed    – no session at all
// • blocked     – session + profile exist but is_active === false
// • no-profile  – session exists, profile row missing/errored
// • ready       – fully authenticated and active user
// ---------------------------------------------------------------------------
type AuthPhase =
  | { phase: "loading" }
  | { phase: "recovery" }
  | { phase: "unauthed" }
  | { phase: "blocked";    profile: UserProfile }
  | { phase: "no-profile"; error: string }
  | { phase: "ready";      profile: UserProfile };

// ═══════════════════════════════════════════════════════════════════════════
// Zustand stores
// ═══════════════════════════════════════════════════════════════════════════

// ── App shell store ───────────────────────────────────────────────────────

interface AppState {
  // Sidebar
  sidebarPinned:   boolean;
  sidebarHovered:  boolean;
  collapsedGroups: Set<string>;
  // Modals/overlays
  cmdOpen:         boolean;
  helpOpen:        boolean;
  shortcutsOpen:   boolean;
  activeTourId:    string | null;
  // Theme
  themeMode:       ThemeMode;
  // Actions
  toggleSidebarPin:   () => void;
  setSidebarHovered:  (v: boolean) => void;
  toggleGroup:        (g: string) => void;
  setCmdOpen:         (v: boolean) => void;
  setHelpOpen:        (v: boolean) => void;
  setShortcutsOpen:   (v: boolean) => void;
  setActiveTourId:    (id: string | null) => void;
  toggleTheme:        () => void;
  collapseSidebar:    () => void;  // called on compact mode entry
}

const COLLAPSED_GROUPS_KEY = "da-collapsed-groups";

function persistCollapsed(groups: Set<string>) {
  try { localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...groups])); }
  catch { /* noop */ }
}

function readCollapsed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_GROUPS_KEY) ?? "[]")); }
  catch { return new Set(); }
}

function readTheme(): ThemeMode {
  try { return readStoredTheme(); }
  catch {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
}

const useAppStore = create<AppState>()(
  subscribeWithSelector((set, _get) => ({
    sidebarPinned:   false,
    sidebarHovered:  false,
    collapsedGroups: readCollapsed(),
    cmdOpen:         false,
    helpOpen:        false,
    shortcutsOpen:   false,
    activeTourId:    null,
    themeMode:       readTheme(),

    toggleSidebarPin: () =>
      set((s) => ({ sidebarPinned: !s.sidebarPinned, sidebarHovered: false })),

    setSidebarHovered: (v) =>
      set((s) => s.sidebarPinned ? s : { sidebarHovered: v }),

    toggleGroup: (g) =>
      set((s) => {
        const next = new Set(s.collapsedGroups);
        next.has(g) ? next.delete(g) : next.add(g);
        persistCollapsed(next);
        return { collapsedGroups: next };
      }),

    setCmdOpen:      (v) => set({ cmdOpen: v }),
    setHelpOpen:     (v) => set({ helpOpen: v }),
    setShortcutsOpen:(v) => set({ shortcutsOpen: v }),
    setActiveTourId: (id) => set({ activeTourId: id }),

    collapseSidebar: () =>
      set({ sidebarPinned: false, sidebarHovered: false }),

    toggleTheme: () =>
      set((s) => {
        const next: ThemeMode = s.themeMode === "light" ? "dark" : "light";
        try { localStorage.setItem("da-theme", next); } catch { /* noop */ }
        document.documentElement.setAttribute("data-theme", next);
        document.documentElement.style.colorScheme = next === "light" ? "light" : "dark";
        applyThemeCssVariables(next);
        return { themeMode: next };
      }),
  }))
);

// ── Notification store ────────────────────────────────────────────────────

interface NotifState {
  notifications:  Notification[];
  toasts:         Notification[];
  unreadCount:    number;
  push:           (n: Omit<Notification, "id" | "createdAt" | "read">) => void;
  dismiss:        (id: string) => void;
  markAllRead:    () => void;
  clearAll:       () => void;
}

let notifSeq = 0;

const useNotifStore = create<NotifState>()((set, _get) => ({
  notifications: [],
  toasts:        [],
  unreadCount:   0,

  push: (n) => {
    const notif: Notification = {
      ...n,
      id:        `notif-${++notifSeq}`,
      createdAt: Date.now(),
      read:      false,
    };
    set((s) => ({
      notifications: [notif, ...s.notifications].slice(0, 50),
      toasts:        [notif, ...s.toasts].slice(0, 5),
      unreadCount:   s.unreadCount + 1,
    }));
    const duration = n.durationMs ?? 4500;
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== notif.id) }));
    }, duration);
  },

  dismiss: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount:   0,
    })),

  clearAll: () =>
    set({ notifications: [], toasts: [], unreadCount: 0 }),
}));

// ═══════════════════════════════════════════════════════════════════════════
// Keyboard shortcut registry
// ═══════════════════════════════════════════════════════════════════════════

type ShortcutHandler = (e: KeyboardEvent) => void;

interface ShortcutDef {
  combo:       string;           // display label, e.g. "⌘K"
  description: string;
  handler:     ShortcutHandler;
  global?:     boolean;          // fires even when typing in inputs
}

class ShortcutRegistry {
  private shortcuts: ShortcutDef[] = [];

  register(def: ShortcutDef): () => void {
    this.shortcuts.push(def);
    return () => {
      this.shortcuts = this.shortcuts.filter((s) => s !== def);
    };
  }

  handle(e: KeyboardEvent): void {
    const tag      = (e.target as HTMLElement)?.tagName?.toLowerCase() ?? "";
    const isTyping = ["input", "textarea", "select"].includes(tag) ||
                     (e.target as HTMLElement)?.isContentEditable;

    for (const s of this.shortcuts) {
      if (isTyping && !s.global) continue;
      s.handler(e);
    }
  }
}

// Singleton registry; attach once at module level
const registry = new ShortcutRegistry();

/** Attaches the registry to window once (idempotent). */
function useShortcutRegistry() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => registry.handle(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}

// ═══════════════════════════════════════════════════════════════════════════
// Viewport hook (shared)
// ═══════════════════════════════════════════════════════════════════════════

function useViewportWidth(): number {
  const [w, setW] = useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth
  );
  useEffect(() => {
    let raf: number;
    const handler = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setW(window.innerWidth));
    };
    window.addEventListener("resize", handler, { passive: true });
    return () => { window.removeEventListener("resize", handler); cancelAnimationFrame(raf); };
  }, []);
  return w;
}

// ═══════════════════════════════════════════════════════════════════════════
// Recent pages hook
// ═══════════════════════════════════════════════════════════════════════════

const RECENT_PAGES_KEY = "da-recent-pages";
const MAX_RECENT       = 6;

function useRecentPages(navItems: readonly NavItem[], path: string): RecentPage[] {
  const [recent, setRecent] = useState<RecentPage[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_PAGES_KEY) ?? "[]"); }
    catch { return []; }
  });

  useEffect(() => {
    const item = navItems.find((i) => i.path === path);
    if (!item) return;
    setRecent((prev) => {
      const filtered = prev.filter((r) => r.path !== path);
      const next: RecentPage[] = [
        { path, label: item.label, group: item.group, visitedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, [path, navItems]);

  return recent;
}

// ═══════════════════════════════════════════════════════════════════════════
// Learning progress hook
// ═══════════════════════════════════════════════════════════════════════════

function useLearningProgress(userId?: string | null): MiniProgress {
  const [p, setP] = useState<MiniProgress>({ xp: 0, level: 0, streak: 0, completedModules: 0 });
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(`da-lc:progress:${userId}`);
      if (raw) {
        const d = JSON.parse(raw);
        setP({ xp: d.xp ?? 0, level: d.level ?? 0, streak: d.streak ?? 0, completedModules: d.completedModules?.length ?? 0 });
      }
    } catch { /* noop */ }
  }, [userId]);
  return p;
}

// ═══════════════════════════════════════════════════════════════════════════
// Breadcrumb
// ═══════════════════════════════════════════════════════════════════════════

interface Crumb { label: string; path?: string; }

function useBreadcrumbs(
  navItems: readonly NavItem[],
  currentPath: string,
  activeLabel: string,
): Crumb[] {
  return useMemo(() => {
    const item = navItems.find((i) => i.path === currentPath);
    if (!item) return [{ label: activeLabel }];
    const crumbs: Crumb[] = [];
    if (item.group) crumbs.push({ label: item.group });
    crumbs.push({ label: item.label, path: item.path });
    return crumbs;
  }, [navItems, currentPath, activeLabel]);
}

// ═══════════════════════════════════════════════════════════════════════════
// Toast stack
// ═══════════════════════════════════════════════════════════════════════════

const LEVEL_COLORS: Record<NotifLevel, string> = {
  info:    "var(--accent-blue)",
  success: "var(--accent-green)",
  warning: "var(--accent-amber)",
  error:   "var(--accent-rose)",
};

const LEVEL_ICONS: Record<NotifLevel, string> = {
  info:    "ℹ",
  success: "✓",
  warning: "⚠",
  error:   "✕",
};

const ToastStack = memo(function ToastStack() {
  const toasts  = useNotifStore((s) => s.toasts);
  const dismiss = useNotifStore((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column-reverse",
        gap: 10,
        maxWidth: 360,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const color = LEVEL_COLORS[t.level];
        return (
          <div
            key={t.id}
            role="alert"
            className="da-toast"
            style={{
              pointerEvents: "all",
              background: "var(--surface-raised)",
              border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
              borderLeft: `3px solid ${color}`,
              borderRadius: 10,
              padding: "12px 14px",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.24)",
              animation: "da-toast-in 0.25s cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color, flexShrink: 0, lineHeight: 1.4 }}>
              {LEVEL_ICONS[t.level]}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-default)", lineHeight: 1.4 }}>
                {t.title}
              </div>
              {t.message && (
                <div style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2, lineHeight: 1.5 }}>
                  {t.message}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              style={{
                background: "none",
                border: "none",
                padding: "2px 4px",
                cursor: "pointer",
                color: "var(--fg-muted)",
                fontSize: 14,
                flexShrink: 0,
                borderRadius: 4,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Notification bell + panel
// ═══════════════════════════════════════════════════════════════════════════

const NotificationBell = memo(function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unread      = useNotifStore((s) => s.unreadCount);
  const notifs      = useNotifStore((s) => s.notifications);
  const markAllRead = useNotifStore((s) => s.markAllRead);
  const clearAll    = useNotifStore((s) => s.clearAll);
  const ref         = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (unread) markAllRead(); }}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        style={{
          position: "relative",
          width: 36, height: 36,
          borderRadius: 8,
          background: "transparent",
          border: "1px solid var(--border-subtle)",
          cursor: "pointer",
          display: "grid",
          placeItems: "center",
          color: "var(--fg-muted)",
          transition: "background 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-default)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute", top: -3, right: -3,
            background: "var(--accent-rose)",
            color: "#fff", borderRadius: "999px",
            fontSize: 9, fontWeight: 700,
            minWidth: 16, height: 16,
            display: "grid", placeItems: "center",
            padding: "0 4px",
            lineHeight: 1,
            border: "2px solid var(--surface-page)",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 320,
          background: "var(--surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          boxShadow: "0 16px 48px rgba(0,0,0,0.28)",
          zIndex: 1000,
          animation: "da-toast-in 0.2s cubic-bezier(0.34,1.56,0.64,1) both",
          overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-subtle)",
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-default)" }}>
              Notifications
            </span>
            {notifs.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--fg-muted)", padding: "2px 6px", borderRadius: 4 }}
              >
                Clear all
              </button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {notifs.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
                No notifications
              </div>
            ) : notifs.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex", gap: 10, alignItems: "flex-start",
                  background: n.read ? "transparent" : "color-mix(in srgb, var(--accent-blue) 4%, transparent)",
                }}
              >
                <span style={{ color: LEVEL_COLORS[n.level], fontSize: 13, fontWeight: 700, flexShrink: 0, lineHeight: 1.6 }}>
                  {LEVEL_ICONS[n.level]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-default)", marginBottom: 1 }}>
                    {n.title}
                  </div>
                  {n.message && (
                    <div style={{ fontSize: 11, color: "var(--fg-muted)", lineHeight: 1.5 }}>
                      {n.message}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 3 }}>
                    {new Date(n.createdAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Breadcrumb bar
// ═══════════════════════════════════════════════════════════════════════════

const BreadcrumbBar = memo(function BreadcrumbBar({
  crumbs,
  onNavigate,
}: {
  crumbs:     Crumb[];
  onNavigate: (path: RoutePath) => void;
}) {
  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0 0" }}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && (
              <span style={{ color: "var(--fg-muted)", fontSize: 11, opacity: 0.5 }}>›</span>
            )}
            {crumb.path && !isLast ? (
              <button
                type="button"
                onClick={() => onNavigate(crumb.path as RoutePath)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 500,
                  color: "var(--fg-muted)",
                  padding: "2px 4px", borderRadius: 4,
                  transition: "color 0.15s",
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-default)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)"; }}
              >
                {crumb.label}
              </button>
            ) : (
              <span style={{
                fontSize: 11, fontWeight: isLast ? 600 : 500,
                color: isLast ? "var(--fg-default)" : "var(--fg-muted)",
                letterSpacing: "0.01em",
                padding: "2px 4px",
              }}>
                {crumb.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Route suspense fallback (skeleton)
// ═══════════════════════════════════════════════════════════════════════════

const RouteSkeleton = memo(function RouteSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{ padding: "32px 24px", display: "flex", flexDirection: "column", gap: 12 }}
    >
      {[100, 60, 80, 45, 70].map((w, i) => (
        <div
          key={i}
          className="da-skeleton"
          style={{
            width: `${w}%`, height: i === 0 ? 24 : 14,
            borderRadius: 6,
            background: "var(--surface-hover)",
            animation: `da-shimmer 1.6s ${i * 0.12}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Route transition wrapper
// ═══════════════════════════════════════════════════════════════════════════

const RouteTransition = memo(function RouteTransition({
  children,
  routeKey,
  pending,
}: {
  children:  ReactNode;
  routeKey:  string;
  pending:   boolean;
}) {
  return (
    <div
      key={routeKey}
      className="da-route-fade"
      style={{ opacity: pending ? 0.6 : 1, transition: "opacity 0.15s" }}
    >
      {children}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Loader
// ═══════════════════════════════════════════════════════════════════════════

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
        <path d="M88 28 C104 28 114 39 114 55 V84 C114 97 105 108 91 108 H78 C74 108 72 105 72 101
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
          <div className="da-loader-bar">
            <div className="da-loader-bar-fill" />
          </div>
        </div>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Account Disabled screen
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Shown when `profile.is_active === false`.
 * Renders in full-screen isolation — no sidebar, no nav, no shell chrome.
 * The only affordance is "Sign Out" so the user can try a different account.
 */
const AccountDisabledScreen = memo(function AccountDisabledScreen({
  onLogout,
}: {
  onLogout: () => void;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--surface-page)",
      }}
    >
      <div
        className="da-error-card"
        style={{
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          padding: "40px 32px",
          borderRadius: 16,
          background: "var(--surface-raised)",
          border: "1px solid color-mix(in srgb, var(--accent-rose) 30%, transparent)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
        }}
      >
        {/* Icon */}
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--accent-rose) 12%, transparent)",
            border: "2px solid color-mix(in srgb, var(--accent-rose) 30%, transparent)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 20px",
            fontSize: 28,
          }}
        >
          🚫
        </div>

        {/* Eyebrow */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--accent-rose)",
            marginBottom: 10,
          }}
        >
          Access Denied
        </div>

        {/* Headline */}
        <h1
          style={{
            margin: "0 0 12px",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--fg-default)",
            letterSpacing: "-0.02em",
          }}
        >
          Account Disabled
        </h1>

        {/* Body */}
        <p
          style={{
            margin: "0 0 28px",
            fontSize: 13,
            color: "var(--fg-muted)",
            lineHeight: 1.65,
          }}
        >
          Your account has been deactivated. Please contact your administrator
          if you believe this is an error.
        </p>

        {/* Sign-out CTA */}
        <button
          type="button"
          onClick={onLogout}
          className="da-sign-out-btn"
          style={{ margin: "0 auto" }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// Profile panel
// ═══════════════════════════════════════════════════════════════════════════

const ProfilePanel = memo(function ProfilePanel({
  title,
  profile,
}: {
  title:   string;
  profile: UserProfile;
}) {
  const initials  = getUserInitials(profile);
  const roleColor = ROLE_COLORS[profile.role ?? "qa"] ?? "var(--fg-muted)";

  const fields: [string, string][] = [
    ["Name",         profile.agent_name   ?? "—"],
    ["Display name", profile.display_name ?? "—"],
    ["Email",        profile.email        ?? "—"],
    ["Role",         profile.role         ?? "—"],
    ["Agent ID",     profile.agent_id     ?? "—"],
    ["Team",         profile.team         ?? "—"],
  ];

  return (
    <div className="da-profile-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: `color-mix(in srgb, ${roleColor} 15%, transparent)`,
          border: `2px solid color-mix(in srgb, ${roleColor} 30%, transparent)`,
          display: "grid", placeItems: "center",
          fontSize: 18, fontWeight: 700, color: roleColor,
          flexShrink: 0, letterSpacing: "-0.02em",
        }}>
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

// ═══════════════════════════════════════════════════════════════════════════
// Mobile bottom nav
// ═══════════════════════════════════════════════════════════════════════════

const BottomNav = memo(function BottomNav({
  navItems, activePath, onNavigate, onOpenHelp,
}: {
  navItems:   readonly NavItem[];
  activePath: string;
  onNavigate: (path: RoutePath) => void;
  onOpenHelp: () => void;
}) {
  const bottomItems = useMemo(() =>
    navItems.filter((i) => BOTTOM_NAV_LABELS.includes(i.label)).slice(0, 4),
    [navItems]
  );

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
            <div className="da-bottom-nav-icon"><NavIcon label={item.label} size={20} /></div>
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

// ═══════════════════════════════════════════════════════════════════════════
// Role-scoped route trees  (lazy pages wrapped in Suspense + ErrorBoundary)
// ═══════════════════════════════════════════════════════════════════════════

function RouteSuspense({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteSkeleton />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

const StaffRoutes: FC<{ profile: UserProfile; pending: boolean }> = memo(({ profile, pending }) => {
  const location = useLocation();
  const isAdmin  = profile.role === "admin";
  const isStaff  = isAdmin || profile.role === "qa";

  return (
    <RouteTransition routeKey={location.pathname} pending={pending}>
      <RouteSuspense>
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
          {isStaff  && <Route path={ROUTES.reports}            element={<ReportsSupabase />} />}
          {isAdmin  && <Route path={ROUTES.accounts}           element={<AccountsSupabase />} />}
          {isAdmin  && <Route path={ROUTES.supervisorRequests} element={<SupervisorRequestsSupabase currentUser={profile} />} />}
          {isAdmin  && <Route path={ROUTES.supportInbox}       element={<SupportInbox currentUser={profile} />} />}
          {isAdmin  && <Route path={ROUTES.helpAdmin}          element={<HelpContentAdmin currentUser={profile} />} />}
          <Route path={ROUTES.learningCenter} element={<LearningCenter currentUser={profile} />} />
          <Route path={ROUTES.profile}        element={
            <ProfilePanel title={isAdmin ? "My Admin Profile" : "My QA Profile"} profile={profile} />
          } />
          <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
        </Routes>
      </RouteSuspense>
    </RouteTransition>
  );
});

const SupervisorRoutes: FC<{ profile: UserProfile; pending: boolean }> = memo(({ profile, pending }) => {
  const location = useLocation();
  return (
    <RouteTransition routeKey={location.pathname} pending={pending}>
      <RouteSuspense>
        <Routes>
          <Route path={ROUTES.supervisorOverview}       element={<SupervisorPortal currentUser={profile} initialTab="overview" hideInternalTabs />} />
          <Route path={ROUTES.supervisorTeamDashboard}  element={<SupervisorPortal currentUser={profile} initialTab="team-dashboard" hideInternalTabs />} />
          <Route path={ROUTES.supervisorRequestsView}   element={<SupervisorPortal currentUser={profile} initialTab="requests" hideInternalTabs />} />
          <Route path={ROUTES.learningCenter}           element={<LearningCenter currentUser={profile} />} />
          <Route path={ROUTES.supervisorProfile}        element={<ProfilePanel title="My Supervisor Profile" profile={profile} />} />
          <Route path="*"                               element={<Navigate to={ROUTES.supervisorOverview} replace />} />
        </Routes>
      </RouteSuspense>
    </RouteTransition>
  );
});

const AgentRoutes: FC<{ profile: UserProfile; pending: boolean }> = memo(({ profile, pending }) => {
  const location = useLocation();
  return (
    <RouteTransition routeKey={location.pathname} pending={pending}>
      <RouteSuspense>
        <Routes>
          <Route path={ROUTES.agentPortal}    element={<AgentPortal currentUser={profile} />} />
          <Route path={ROUTES.learningCenter} element={<LearningCenter currentUser={profile} />} />
          <Route path="*"                     element={<Navigate to={ROUTES.agentPortal} replace />} />
        </Routes>
      </RouteSuspense>
    </RouteTransition>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// AppShell
// ═══════════════════════════════════════════════════════════════════════════

function AppShell() {
  const auth          = useAuthState();
  const navigate      = useNavigate();
  const location      = useLocation();
  const viewportWidth = useViewportWidth();
  const [isPending, startTransition] = useTransition();

  useGlobalStyles();
  useShortcutRegistry();

  // ── Zustand selectors (granular subscriptions) ────────────
  const sidebarPinned   = useAppStore((s) => s.sidebarPinned);
  const sidebarHovered  = useAppStore((s) => s.sidebarHovered);
  const collapsedGroups = useAppStore((s) => s.collapsedGroups);
  const cmdOpen         = useAppStore((s) => s.cmdOpen);
  const helpOpen        = useAppStore((s) => s.helpOpen);
  const shortcutsOpen   = useAppStore((s) => s.shortcutsOpen);
  const activeTourId    = useAppStore((s) => s.activeTourId);
  const themeMode       = useAppStore((s) => s.themeMode);

  const {
    toggleSidebarPin, setSidebarHovered: storeSidebarHovered,
    toggleGroup, setCmdOpen, setHelpOpen, setShortcutsOpen,
    setActiveTourId, toggleTheme, collapseSidebar,
  } = useAppStore.getState();

  // ── Layout flags ──────────────────────────────────────────
  const isCompact         = viewportWidth < COMPACT_BP;
  const isMobileBottom    = viewportWidth < BOTTOM_NAV_BP;
  const isSidebarExpanded = !isCompact && (sidebarPinned || sidebarHovered);

  // Collapse sidebar when viewport shrinks to compact
  useEffect(() => { if (isCompact) collapseSidebar(); }, [isCompact]);

  // Sync sidebar CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--sidebar-w",
      `${isSidebarExpanded ? SIDEBAR_W_EXPANDED : SIDEBAR_W_COLLAPSED}px`
    );
  }, [isSidebarExpanded]);

  // Sync theme attribute
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeMode);
    document.documentElement.style.colorScheme = themeMode === "light" ? "light" : "dark";
    applyThemeCssVariables(themeMode);
  }, [themeMode]);

  // ── Sidebar hover with 100ms intent debounce ──────────────
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSidebarEnter = useCallback(() => {
    if (sidebarPinned) return;
    hoverTimer.current = setTimeout(() => storeSidebarHovered(true), 100);
  }, [sidebarPinned]);

  const handleSidebarLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    storeSidebarHovered(false);
  }, []);

  // ── Auth-derived state ────────────────────────────────────
  const { profile, loading, recoveryMode, logout, handleRecoveryComplete, session, profileError } = auth;

  // ---------------------------------------------------------------------------
  // Build the discriminated auth phase.
  //
  // Order of checks matters:
  //   1. loading    — never show content while hydrating
  //   2. recovery   — password-reset flow takes over the whole screen
  //   3. unauthed   — no session → login wall
  //   4. no-profile — session but DB row missing
  //   5. blocked    — profile exists but is_active is explicitly false
  //   6. ready      — everything checks out
  //
  // The `blocked` check uses `=== false` (strict) so that rows where
  // `is_active` is null / undefined (e.g. legacy rows before the column
  // was added) are treated as active rather than accidentally locked out.
  // ---------------------------------------------------------------------------
  const authPhase = useMemo<AuthPhase>(() => {
    if (loading)      return { phase: "loading" };
    if (recoveryMode) return { phase: "recovery" };
    if (!session)     return { phase: "unauthed" };
    if (!profile)     return { phase: "no-profile", error: profileError ?? "No profile row found." };
    if (profile.is_active === false) return { phase: "blocked", profile };
    return { phase: "ready", profile };
  }, [loading, recoveryMode, session, profile, profileError]);

  // ── Nav items ─────────────────────────────────────────────
  const navItems = useMemo(
    () => (authPhase.phase === "ready" ? buildNavItems(authPhase.profile) : []),
    [authPhase]
  );

  const navGroupsOrdered = useMemo<[string, NavItem[]][]>(() => {
    const map: Record<string, NavItem[]> = {};
    navItems.forEach((item) => {
      (map[item.group] ??= []).push(item);
    });
    return Object.entries(map);
  }, [navItems]);

  const activeLabel = useMemo(
    () => getActiveRouteLabel(location.pathname as RoutePath, navItems),
    [location.pathname, navItems]
  );

  // ── Deferred search (non-blocking cmd palette) ────────────
  const deferredNavItems = useDeferredValue(navItems);

  // ── Recent pages ──────────────────────────────────────────
  const recentPages = useRecentPages(navItems, location.pathname);

  // ── Breadcrumbs ───────────────────────────────────────────
  const breadcrumbs = useBreadcrumbs(navItems, location.pathname, activeLabel);

  // ── Learning progress ─────────────────────────────────────
  const learningProgress = useLearningProgress(
    authPhase.phase === "ready" ? authPhase.profile.id : undefined
  );

  // ── Navigation with transition ────────────────────────────
  const handleNavigate = useCallback((path: RoutePath) => {
    startTransition(() => navigate(path));
    setCmdOpen(false);
  }, [navigate]);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const shortcuts = [
      {
        combo: "⌘K", description: "Open command palette", global: true,
        handler: (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
        },
      },
      {
        combo: "⌘/", description: "Toggle help drawer", global: true,
        handler: (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "/") { e.preventDefault(); setHelpOpen(!useAppStore.getState().helpOpen); }
        },
      },
      {
        combo: "⌘\\", description: "Pin/unpin sidebar", global: true,
        handler: (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "\\") { e.preventDefault(); toggleSidebarPin(); }
        },
      },
      {
        combo: "⌘⇧T", description: "Toggle theme", global: true,
        handler: (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "T") { e.preventDefault(); toggleTheme(); }
        },
      },
      {
        combo: "?", description: "Show shortcuts",
        handler: (e: KeyboardEvent) => {
          if (e.key === "?") setShortcutsOpen(!useAppStore.getState().shortcutsOpen);
        },
      },
      {
        combo: "Esc", description: "Close top modal", global: true,
        handler: (e: KeyboardEvent) => {
          if (e.key !== "Escape") return;
          if (shortcutsOpen) { setShortcutsOpen(false); return; }
          if (helpOpen)      { setHelpOpen(false); }
        },
      },
      // g + letter quick-nav
      (() => {
        let gPressed = false;
        let timer: ReturnType<typeof setTimeout>;
        return {
          combo: "g+…", description: "Quick navigation",
          handler: (e: KeyboardEvent) => {
            if (e.key === "g" || e.key === "G") {
              gPressed = true; clearTimeout(timer);
              timer = setTimeout(() => { gPressed = false; }, 800);
              return;
            }
            if (gPressed) {
              gPressed = false; clearTimeout(timer);
              const target = G_NAV_MAP[e.key.toLowerCase()];
              if (target) { e.preventDefault(); startTransition(() => navigate(target)); }
            }
          },
        };
      })(),
    ];

    const cleanups = shortcuts.map((s) => registry.register(s));
    return () => cleanups.forEach((fn) => fn());
  }, [shortcutsOpen, helpOpen, navigate, toggleTheme, toggleSidebarPin]);

  // ── Stable callbacks ──────────────────────────────────────
  const handleLogout         = useCallback(() => logout(), [logout]);
  const handleOpenHelp       = useCallback(() => setHelpOpen(true), []);
  const handleCloseHelp      = useCallback(() => setHelpOpen(false), []);
  const handleOpenShortcuts  = useCallback(() => setShortcutsOpen(true), []);
  const handleCloseShortcuts = useCallback(() => setShortcutsOpen(false), []);
  const handleOpenCmd        = useCallback(() => setCmdOpen(true), []);
  const handleCloseCmd       = useCallback(() => setCmdOpen(false), []);
  const handleHelpNavigate   = useCallback((path: string) => { navigate(path); setHelpOpen(false); }, [navigate]);
  const handleStartHelpTour  = useCallback((id: string) => { setActiveTourId(id); setHelpOpen(false); }, []);
  const handleCloseHelpTour  = useCallback(() => setActiveTourId(null), []);
  const handleGoToLearning   = useCallback(() => startTransition(() => navigate(ROUTES.learningCenter)), [navigate]);

  // ── Auth phase render ─────────────────────────────────────

  // Early exits for non-ready phases — no shell chrome rendered at all.
  if (authPhase.phase === "loading")   return <Loader />;
  if (authPhase.phase === "unauthed")  return <Suspense fallback={<Loader message="Loading login…" />}><Login /></Suspense>;
  if (authPhase.phase === "recovery")  return (
    <Suspense fallback={<Loader message="Loading…" />}>
      <ResetPassword onComplete={handleRecoveryComplete} onLogout={logout} />
    </Suspense>
  );
  if (authPhase.phase === "no-profile") return (
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
          {authPhase.error}
        </p>
        <button onClick={logout} className="da-sign-out-btn" style={{ margin: "0 auto" }}>
          Sign out
        </button>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Blocked phase — account disabled.
  // Rendered before any shell chrome so the sidebar, nav, and routes never
  // mount. The only action available is signing out.
  // ---------------------------------------------------------------------------
  if (authPhase.phase === "blocked") {
    return <AccountDisabledScreen onLogout={handleLogout} />;
  }

  // authPhase.phase === "ready"
  const { profile: readyProfile } = authPhase;
  const isAdmin      = readyProfile.role === "admin";
  const isQA         = readyProfile.role === "qa";
  const isSupervisor = readyProfile.role === "supervisor";
  const isStaff      = isAdmin || isQA;
  const hasSidebar   = isStaff || isSupervisor || readyProfile.role === "agent";
  const userInitials = getUserInitials(readyProfile);

  return (
    <AuthContext.Provider value={{ profile: readyProfile, loading: false, logout }}>
      {/* ── Overlays ─────────────────────────────────────── */}
      {cmdOpen && (
        <CommandPalette
          items={deferredNavItems}
          recentPages={recentPages}
          onNavigate={handleNavigate}
          onClose={handleCloseCmd}
        />
      )}

      {shortcutsOpen && <ShortcutsModal onClose={handleCloseShortcuts} />}

      <HelpDrawer
        open={helpOpen}
        onClose={handleCloseHelp}
        currentPage={`${activeLabel} ${location.pathname}`}
        currentRole={readyProfile.role}
        currentUserName={readyProfile.display_name ?? readyProfile.agent_name ?? readyProfile.email ?? undefined}
        currentUserEmail={readyProfile.email ?? undefined}
        onNavigate={handleHelpNavigate}
        onStartTour={handleStartHelpTour}
      />

      <HelpTourOverlay
        tourId={activeTourId}
        currentPage={`${activeLabel} ${location.pathname}`}
        currentRole={readyProfile.role}
        onClose={handleCloseHelpTour}
        onOpenHelp={handleOpenHelp}
      />

      {/* ── Toast stack ──────────────────────────────────── */}
      <ToastStack />

      {/* ── Shell layout ─────────────────────────────────── */}
      <div
        className="da-shell"
        style={{
          "--sidebar-w": `${isSidebarExpanded ? SIDEBAR_W_EXPANDED : SIDEBAR_W_COLLAPSED}px`,
        } as CSSProperties}
      >
        {hasSidebar && (
          <Sidebar
            navGroupsOrdered={navGroupsOrdered}
            activePath={location.pathname}
            isExpanded={isSidebarExpanded}
            collapsedGroups={collapsedGroups}
            onToggleGroup={toggleGroup}
            profile={readyProfile}
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
          {/* Header row: existing Header + notification bell */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <Header
                isCompact={isCompact}
                hasSidebar={hasSidebar}
                isSidebarPinned={sidebarPinned}
                activeLabel={activeLabel}
                profile={readyProfile}
                userInitials={userInitials}
                themeMode={themeMode}
                onToggleSidebarPin={toggleSidebarPin}
                onToggleTheme={toggleTheme}
                onOpenCmd={handleOpenCmd}
                onOpenShortcuts={handleOpenShortcuts}
                onLogout={handleLogout}
              />
            </div>
            {/* Notification bell injected at the right of the header row */}
            <div style={{ paddingRight: 16, flexShrink: 0 }}>
              <NotificationBell />
            </div>
          </div>

          {/* Breadcrumb bar below header */}
          {breadcrumbs.length > 1 && (
            <div style={{ padding: "0 24px" }}>
              <BreadcrumbBar crumbs={breadcrumbs} onNavigate={handleNavigate} />
            </div>
          )}

          <main>
            {hasSidebar ? (
              <>
                {isCompact && !isMobileBottom && (
                  <nav className="da-compact-nav" aria-label="Tablet navigation">
                    {navItems.map((item) => {
                      const accent   = GROUP_ACCENT[item.group] ?? "var(--accent-blue)";
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

                <div className="da-content">
                  {isStaff
                    ? <StaffRoutes      profile={readyProfile} pending={isPending} />
                    : isSupervisor
                    ? <SupervisorRoutes profile={readyProfile} pending={isPending} />
                    : <AgentRoutes      profile={readyProfile} pending={isPending} />}
                </div>

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
                <Suspense fallback={<RouteSkeleton />}>
                  <AgentPortal currentUser={readyProfile} />
                </Suspense>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Inline CSS additions for new features */}
      <style>{`
        @keyframes da-toast-in {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes da-shimmer {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.8; }
        }
      `}</style>
    </AuthContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Root
// ═══════════════════════════════════════════════════════════════════════════

export { useNotifStore };   // re-export so page components can push notifications

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
