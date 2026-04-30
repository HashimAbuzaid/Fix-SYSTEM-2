// ─────────────────────────────────────────────────────────────
// src/components/shell/Header.tsx
// Fixed top bar: breadcrumb, clock, search trigger, theme
// toggle, notifications, user chip, and sign-out.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback, memo } from "react";
import type { UserProfile } from "../../context/AuthContext";
import { ROLE_COLORS } from "../../config/routes";
import type { ThemeMode } from "../../lib/theme";

// ── Icon primitives ───────────────────────────────────────────

const SearchIcon = memo(function SearchIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
});

const SunIcon = memo(function SunIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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

const MoonIcon = memo(function MoonIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
});

const LogOutIcon = memo(function LogOutIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
});

const MenuIcon = memo(function MenuIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
});

const BellIcon = memo(function BellIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
});

const KeyboardIcon = memo(function KeyboardIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M6 17h12" />
    </svg>
  );
});

// ── LiveClock ─────────────────────────────────────────────────

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
      <span ref={hhRef} />
      <span className="da-clock-colon">:</span>
      <span ref={mmRef} />
      <span className="da-clock-colon" style={{ animationDelay: "0.5s" }}>:</span>
      <span ref={ssRef} style={{ opacity: 0.5 }} />
    </div>
  );
});

// ── NotificationCenter ────────────────────────────────────────

interface NotificationItem {
  id: string;
  icon: string;
  title: string;
  sub: string;
  time: string;
  unread: boolean;
  color: string;
}

// Static seed — in production replace with Supabase Realtime
const DEMO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n1", icon: "📚",
    title: "New training assigned",
    sub: "Supervisor assigned Return Label Fundamentals",
    time: "5m ago", unread: true,
    color: "color-mix(in srgb,var(--accent-blue) 12%,transparent)",
  },
  {
    id: "n2", icon: "🏆",
    title: "Quiz score improved!",
    sub: "You scored 94% on QA Foundations",
    time: "1h ago", unread: true,
    color: "color-mix(in srgb,var(--accent-amber) 12%,transparent)",
  },
  {
    id: "n3", icon: "🔥",
    title: "5-day learning streak!",
    sub: "Keep up the momentum",
    time: "2h ago", unread: false,
    color: "color-mix(in srgb,var(--accent-rose) 12%,transparent)",
  },
];

const NotificationCenter = memo(function NotificationCenter() {
  const [open, setOpen]             = useState(false);
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
              <button className="da-notif-mark-all" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div className="da-notif-list">
            {notifications.length === 0 ? (
              <div className="da-notif-empty">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`da-notif-item${n.unread ? " unread" : ""}`}
                  onClick={() =>
                    setNotifications((prev) =>
                      prev.map((item) =>
                        item.id === n.id ? { ...item, unread: false } : item,
                      ),
                    )
                  }
                >
                  <div
                    className="da-notif-icon"
                    style={{ background: n.color, fontSize: 14 }}
                  >
                    {n.icon}
                  </div>
                  <div className="da-notif-text">
                    <div className="da-notif-text-title">{n.title}</div>
                    <div className="da-notif-text-sub">{n.sub}</div>
                  </div>
                  <div className="da-notif-time">{n.time}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// ── Keyboard Shortcuts Modal ──────────────────────────────────

const SHORTCUTS = [
  {
    section: "Navigation",
    items: [
      { desc: "Open command palette", keys: ["⌘", "K"] },
      { desc: "Open help center",     keys: ["⌘", "/"] },
      { desc: "Keyboard shortcuts",   keys: ["?"] },
      { desc: "Close / go back",      keys: ["Esc"] },
    ],
  },
  {
    section: "Pages (press G, then…)",
    items: [
      { desc: "Go to Dashboard",       keys: ["G", "D"] },
      { desc: "Go to New Audit",       keys: ["G", "N"] },
      { desc: "Go to Reports",         keys: ["G", "R"] },
      { desc: "Go to Learning Center", keys: ["G", "E"] },
      { desc: "Go to Monitoring",      keys: ["G", "M"] },
    ],
  },
  {
    section: "General",
    items: [
      { desc: "Toggle theme",        keys: ["⌘", "⇧", "T"] },
      { desc: "Pin / unpin sidebar", keys: ["⌘", "\\"] },
    ],
  },
];

export const ShortcutsModal = memo(function ShortcutsModal({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div
      className="da-shortcuts-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="da-shortcuts-card">
        <div className="da-shortcuts-header">
          <div>
            <div
              style={{
                fontSize: 15, fontWeight: 700, color: "var(--fg-default)",
                letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 8,
              }}
            >
              <KeyboardIcon size={16} /> Keyboard Shortcuts
            </div>
            <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 3 }}>
              Press Esc to close
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--fg-muted)", cursor: "pointer", fontSize: 13,
              display: "grid", placeItems: "center",
            }}
          >
            ✕
          </button>
        </div>
        <div className="da-shortcuts-body">
          {SHORTCUTS.map((section) => (
            <div key={section.section}>
              <div className="da-shortcuts-section">{section.section}</div>
              {section.items.map((item) => (
                <div key={item.desc} className="da-shortcut-row">
                  <span className="da-shortcut-desc">{item.desc}</span>
                  <div className="da-shortcut-keys">
                    {item.keys.map((k) => (
                      <span key={k} className="da-key">{k}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ── Logo constant ─────────────────────────────────────────────

const LOGO_WORDMARK_SRC = "/detroit-axle-wordmark.svg";

// ── Header ────────────────────────────────────────────────────

export interface HeaderProps {
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

export const Header = memo(
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
    onOpenShortcuts,
    onLogout,
  }: HeaderProps) {
    const isDark        = themeMode === "dark";
    const roleColor     = ROLE_COLORS[profile.role || "qa"] || "var(--fg-muted)";
    const profileLabel  = profile.display_name || profile.agent_name || profile.email || "";

    return (
      <header className="da-header">
        {/* Left: pin toggle + breadcrumb / wordmark */}
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

        {/* Right: clock, search, shortcuts, notifications, theme, user, sign-out */}
        <div className="da-header-right">
          {!isCompact && <LiveClock />}
          {!isCompact && <div className="da-hdivider" />}

          {/* ⌘K search pill */}
          <button
            type="button"
            className="da-pill-btn"
            onClick={onOpenCmd}
            aria-label="Open command palette (⌘K)"
          >
            <SearchIcon size={13} />
            {!isCompact && <span>Search</span>}
            {!isCompact && (
              <kbd style={{
                fontFamily: "var(--font-mono)", fontSize: "10px",
                background: "var(--bg-subtle)", border: "1px solid var(--border-strong)",
                borderRadius: "4px", padding: "1px 5px", color: "var(--fg-muted)", marginLeft: 2,
              }}>
                ⌘K
              </kbd>
            )}
          </button>

          {/* Keyboard shortcuts */}
          {!isCompact && (
            <button
              type="button"
              className="da-icon-btn"
              onClick={onOpenShortcuts}
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <KeyboardIcon size={14} />
            </button>
          )}

          {/* Notifications */}
          <NotificationCenter />

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
                style={{ background: `color-mix(in srgb, ${roleColor} 60%, #000)` }}
              >
                {userInitials}
              </div>
              <div>
                <div
                  className="da-user-chip-name"
                  style={{
                    maxWidth: 120, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {profileLabel}
                </div>
                <div className="da-user-chip-role" style={{ color: roleColor }}>
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
  // Custom equality — skip re-renders when nothing changed
  (prev, next) =>
    prev.isCompact          === next.isCompact &&
    prev.hasSidebar         === next.hasSidebar &&
    prev.isSidebarPinned    === next.isSidebarPinned &&
    prev.activeLabel        === next.activeLabel &&
    prev.profile            === next.profile &&
    prev.userInitials       === next.userInitials &&
    prev.themeMode          === next.themeMode &&
    prev.onToggleSidebarPin === next.onToggleSidebarPin &&
    prev.onToggleTheme      === next.onToggleTheme &&
    prev.onOpenCmd          === next.onOpenCmd &&
    prev.onOpenShortcuts    === next.onOpenShortcuts &&
    prev.onLogout           === next.onLogout,
);

export default Header;
