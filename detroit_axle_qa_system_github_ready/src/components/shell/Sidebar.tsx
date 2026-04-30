// ─────────────────────────────────────────────────────────────
// src/components/shell/Sidebar.tsx
// Collapsible icon-rail sidebar with grouped nav, learning
// progress widget, and user identity footer.
// ─────────────────────────────────────────────────────────────

import { useMemo, memo, type CSSProperties } from "react";
import type { UserProfile } from "../../context/AuthContext";
import { GROUP_ACCENT } from "../../config/routes";
import {
  ROLE_COLORS,
  LEVEL_COLORS,
  LEVEL_NAMES,
  LEVEL_THRESHOLDS,
  type NavItem,
} from "../../config/navItems";
import type { RoutePath } from "../../config/routes";

// ── Sub-component props ───────────────────────────────────────

interface MiniProgress {
  xp: number;
  level: number;
  streak: number;
  completedModules: number;
}

export interface SidebarProps {
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

// ── Icons ─────────────────────────────────────────────────────

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

export const NavIcon = memo(function NavIcon({
  label,
  size = 15,
}: {
  label: string;
  size?: number;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24" as const,
    fill: "none" as const,
    stroke: "currentColor" as const,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const icons: Record<string, React.ReactNode> = {
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
    "Learning Center": (
      <svg {...p}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    "Support Inbox": (
      <svg {...p}>
        <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </svg>
    ),
    "Help Admin": (
      <svg {...p}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4" /><path d="M12 19v4" />
        <path d="M4.22 4.22l2.83 2.83" /><path d="M16.95 16.95l2.83 2.83" />
        <path d="M1 12h4" /><path d="M19 12h4" />
        <path d="M4.22 19.78l2.83-2.83" /><path d="M16.95 7.05l2.83-2.83" />
      </svg>
    ),
    "My Portal": (
      <svg {...p}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    Help: (
      <svg {...p}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.1 9a3 3 0 1 1 5.8 1c-.5 1.4-2.4 2-2.7 3.5" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
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

// ── Learning Progress Ring ────────────────────────────────────

const LearningProgressRing = memo(function LearningProgressRing({
  pct,
  level,
  size = 32,
  stroke = 3,
}: {
  pct: number;
  level: number;
  size?: number;
  stroke?: number;
}) {
  const r     = (size - stroke) / 2;
  const circ  = 2 * Math.PI * r;
  const color = LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)] ?? "var(--accent-emerald)";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: "rotate(-90deg)", flexShrink: 0 }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={`${circ * Math.max(0, Math.min(pct, 100)) / 100} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.16,1,0.3,1)" }} />
    </svg>
  );
});

// ── Logo constants ────────────────────────────────────────────

const LOGO_MARK_SRC = "/detroit-axle-mark.png";

// ── Sidebar ───────────────────────────────────────────────────

export const Sidebar = memo(
  function Sidebar({
    navGroupsOrdered,
    activePath,
    isExpanded,
    collapsedGroups,
    onToggleGroup,
    profile,
    userInitials,
    learningProgress,
    onNavigate,
    onExpand,
    onCollapse,
    onLogout,
    onOpenHelp,
    onGoToLearning,
  }: SidebarProps) {
    const name      = profile.display_name || profile.agent_name || profile.email || "";
    const roleColor = ROLE_COLORS[profile.role || "qa"] || "var(--fg-muted)";
    const levelColor =
      LEVEL_COLORS[Math.min(learningProgress.level, LEVEL_COLORS.length - 1)] ??
      "var(--accent-emerald)";

    const levelPct = useMemo(() => {
      const cur  = LEVEL_THRESHOLDS[learningProgress.level]     ?? 0;
      const next = LEVEL_THRESHOLDS[learningProgress.level + 1] ?? cur + 1000;
      return Math.round(((learningProgress.xp - cur) / (next - cur)) * 100);
    }, [learningProgress]);

    return (
      <nav
        className={`da-sidebar${isExpanded ? " expanded" : ""}`}
        onMouseEnter={onExpand}
        onMouseLeave={onCollapse}
        aria-label="Main navigation"
      >
        {/* ── Header ── */}
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

        {/* ── Nav rail ── */}
        <div className="da-nav-rail">
          {navGroupsOrdered.map(([group, groupItems]) => {
            const accent      = GROUP_ACCENT[group] || "var(--fg-subtle)";
            const isCollapsed = collapsedGroups.has(group);

            return (
              <div
                key={group}
                className={`da-nav-section${isCollapsed ? " collapsed" : ""}`}
              >
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
                      key={item.path}
                      type="button"
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
                        <span
                          className="da-nav-badge"
                          style={
                            { "--item-accent": "var(--accent-emerald)" } as CSSProperties
                          }
                        >
                          New
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Support section */}
          <div className="da-nav-section" style={{ marginTop: "auto" }}>
            <div
              className="da-nav-section-label"
              style={{ color: "var(--accent-blue)" }}
            >
              Support
            </div>
            <button
              type="button"
              className="da-nav-item"
              onClick={onOpenHelp}
              title="Help"
              aria-label="Open Help Center"
              style={{ "--item-accent": "var(--accent-blue)" } as CSSProperties}
            >
              <div className="da-nav-pip" />
              <span className="da-nav-icon">
                <NavIcon label="Help" size={15} />
              </span>
              <span className="da-nav-label">Help</span>
            </button>
          </div>
        </div>

        {/* ── Learning Progress Widget ── */}
        {learningProgress.xp > 0 && (
          <div className="da-lc-widget">
            <div
              className="da-lc-widget-inner"
              onClick={onGoToLearning}
              title="Your learning progress"
            >
              <div className="da-lc-widget-ring">
                <LearningProgressRing
                  pct={levelPct}
                  level={learningProgress.level}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 9,
                    fontWeight: 800,
                    color: levelColor,
                  }}
                >
                  {learningProgress.level}
                </div>
              </div>
              <div className="da-lc-widget-info">
                <div className="da-lc-widget-level">
                  {LEVEL_NAMES[learningProgress.level] ?? "Rookie"}
                </div>
                <div className="da-lc-widget-xp">
                  {learningProgress.xp.toLocaleString()} XP ·{" "}
                  {learningProgress.completedModules} modules
                </div>
                {learningProgress.streak > 1 && (
                  <div className="da-lc-widget-streak">
                    🔥 {learningProgress.streak}-day streak
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── User footer ── */}
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
              <div className="da-sidebar-user-role" style={{ color: roleColor }}>
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
  // Custom equality — only re-render when something actually changed
  (prev, next) =>
    prev.activePath        === next.activePath &&
    prev.isExpanded        === next.isExpanded &&
    prev.collapsedGroups   === next.collapsedGroups &&
    prev.navGroupsOrdered  === next.navGroupsOrdered &&
    prev.profile           === next.profile &&
    prev.userInitials      === next.userInitials &&
    prev.learningProgress  === next.learningProgress &&
    prev.onNavigate        === next.onNavigate &&
    prev.onExpand          === next.onExpand &&
    prev.onCollapse        === next.onCollapse &&
    prev.onLogout          === next.onLogout &&
    prev.onOpenHelp        === next.onOpenHelp &&
    prev.onGoToLearning    === next.onGoToLearning &&
    prev.onToggleGroup     === next.onToggleGroup,
);

export default Sidebar;
