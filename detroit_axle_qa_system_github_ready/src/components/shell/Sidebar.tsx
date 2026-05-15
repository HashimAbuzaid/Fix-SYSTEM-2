/**
 * Sidebar.tsx — Detroit Axle QA System
 *
 * Claude-aesthetic redesign:
 *   • Single muted surface — no heavy contrast panel; feels native to the page
 *   • Nav items: icon + label, subtle hover lift, accent active state with left pip
 *   • Smooth expand/collapse via CSS transitions; labels fade in after width settles
 *   • Section group labels collapse with the sidebar width
 *   • Brand name + sub-label visible only when expanded, animated in/out
 *   • Avatar + user chip in footer; online dot indicator
 *   • Accessible: aria-current, aria-label, focus-visible rings
 */

import {
  memo,
  useCallback,
  type CSSProperties,
  type FC,
} from "react";
import type { NavItem } from "../../config/navItems";
import type { UserProfile } from "../../context/AuthContext";
import type { RoutePath } from "../../config/routes";
import { GROUP_ACCENT } from "../../config/routes";
import { ROLE_COLORS } from "../../config/navItems";

/* ─── Types ────────────────────────────────────────────────── */

interface MiniProgress {
  xp: number;
  level: number;
  streak: number;
  completedModules: number;
}

interface SidebarProps {
  navGroupsOrdered:  [string, NavItem[]][];
  activePath:        string;
  isExpanded:        boolean;
  collapsedGroups:   Set<string>;
  onToggleGroup:     (group: string) => void;
  profile:           UserProfile;
  userInitials:      string;
  learningProgress:  MiniProgress;
  onNavigate:        (path: RoutePath) => void;
  onExpand:          () => void;
  onCollapse:        () => void;
  onLogout:          () => void;
  onOpenHelp:        () => void;
  onGoToLearning:    () => void;
}

/* ─── Icon map ──────────────────────────────────────────────── */
// Maps nav item labels to Tabler outline icon names.
const ICON_MAP: Record<string, string> = {
  Dashboard:              "layout-dashboard",
  "New Audit":            "circle-plus",
  "Audits List":          "clipboard-check",
  "Audits Upload":        "file-upload",
  "Calls Upload":         "phone-incoming",
  "Tickets Upload":       "ticket",
  "Ticket Evidence":      "camera",
  "AI Review Queue":      "robot",
  "Sales Upload":         "currency-dollar",
  "Agent Feedback":       "message-circle",
  Monitoring:             "eye",
  "Team Heatmap":         "grid-dots",
  Reports:                "chart-bar",
  Accounts:               "users",
  "Supervisor Requests":  "bell",
  "Support Inbox":        "inbox",
  "Help Admin":           "help-circle",
  "Learning Center":      "school",
  Profile:                "user-circle",
  // Supervisor group
  Overview:               "home",
  "Team Dashboard":       "chart-line",
  Requests:               "list-check",
};

function iconName(label: string): string {
  return ICON_MAP[label] ?? "circle";
}

/* ─── NavIcon (public export used by BottomNav / CompactNav) ── */
export const NavIcon: FC<{ label: string; size?: number }> = memo(({ label, size = 17 }) => (
  <i
    className={`ti ti-${iconName(label)}`}
    aria-hidden="true"
    style={{ fontSize: size, lineHeight: 1 }}
  />
));
NavIcon.displayName = "NavIcon";

/* ─── Learning progress ring (SVG) ─────────────────────────── */
const ProgressRing: FC<{ pct: number; size?: number }> = memo(({ pct, size = 30 }) => {
  const r   = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(pct / 100, 1);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--border)" strokeWidth={2}
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 600ms var(--ease-out)" }}
      />
      <text
        x={size / 2} y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fontWeight={600}
        fill="var(--accent)"
        fontFamily="var(--font-ui)"
      >
        {Math.round(pct)}
      </text>
    </svg>
  );
});
ProgressRing.displayName = "ProgressRing";

/* ─── SidebarNavItem ────────────────────────────────────────── */
interface NavItemProps {
  item:       NavItem;
  isActive:   boolean;
  isExpanded: boolean;
  badge?:     number;
  onNavigate: (path: RoutePath) => void;
}

const SidebarNavItem: FC<NavItemProps> = memo(({ item, isActive, isExpanded, badge, onNavigate }) => {
  const accent = GROUP_ACCENT[item.group] ?? "var(--accent)";

  const handleClick = useCallback(() => {
    onNavigate(item.path);
  }, [item.path, onNavigate]);

  const itemStyle: CSSProperties = {
    position:      "relative",
    display:       "flex",
    alignItems:    "center",
    height:        34,
    borderRadius:  "var(--radius-md)",
    border:        isActive
      ? `0.5px solid color-mix(in srgb, ${accent} 22%, transparent)`
      : "0.5px solid transparent",
    background:    isActive
      ? `color-mix(in srgb, ${accent} 10%, transparent)`
      : "transparent",
    color:         isActive ? accent : "var(--fg-muted)",
    cursor:        "pointer",
    padding:       "0 9px",
    gap:           isExpanded ? 9 : 0,
    overflow:      "hidden",
    whiteSpace:    "nowrap",
    width:         "100%",
    textAlign:     "left",
    justifyContent: isExpanded ? "flex-start" : "center",
    transition:    "color 110ms ease, background 100ms ease, border-color 110ms ease, gap 220ms cubic-bezier(0.16,1,0.3,1)",
    fontFamily:    "var(--font-ui)",
  };

  const labelStyle: CSSProperties = {
    fontSize:     13,
    fontWeight:   isActive ? 500 : 400,
    overflow:     "hidden",
    textOverflow: "ellipsis",
    whiteSpace:   "nowrap",
    opacity:      isExpanded ? 1 : 0,
    maxWidth:     isExpanded ? 160 : 0,
    transform:    isExpanded ? "none" : "translateX(-4px)",
    transition:   "max-width 220ms cubic-bezier(0.16,1,0.3,1), opacity 140ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1)",
    color:        "inherit",
    letterSpacing: "-0.005em",
    flex:         1,
  };

  const badgeStyle: CSSProperties = {
    display:       isExpanded ? "flex" : "none",
    height:        15,
    padding:       "0 5px",
    borderRadius:  "var(--radius-sm)",
    fontSize:      9,
    fontWeight:    500,
    letterSpacing: "0.03em",
    background:    `color-mix(in srgb, ${accent} 12%, transparent)`,
    color:         accent,
    border:        `0.5px solid color-mix(in srgb, ${accent} 24%, transparent)`,
    flexShrink:    0,
    alignItems:    "center",
    justifyContent: "center",
    textTransform: "uppercase" as const,
  };

  return (
    <button
      style={itemStyle}
      onClick={handleClick}
      aria-current={isActive ? "page" : undefined}
      aria-label={item.label}
      onMouseEnter={(e) => {
        if (isActive) return;
        (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-default)";
        (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-subtle-hover)";
      }}
      onMouseLeave={(e) => {
        if (isActive) return;
        (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      {/* Active pip */}
      <span
        aria-hidden="true"
        style={{
          position:    "absolute",
          left:        0,
          top:         "50%",
          transform:   "translateY(-50%)",
          width:       2,
          borderRadius: "0 2px 2px 0",
          background:  accent,
          height:      isActive ? 14 : 0,
          transition:  "height 180ms cubic-bezier(0.16,1,0.3,1)",
        }}
      />

      {/* Icon */}
      <span
        aria-hidden="true"
        style={{
          width:    19,
          height:   19,
          display:  "grid",
          placeItems: "center",
          flexShrink: 0,
          fontSize: 16,
          color:    "inherit",
        }}
      >
        <NavIcon label={item.label} size={16} />
      </span>

      {/* Label */}
      <span style={labelStyle}>{item.label}</span>

      {/* Badge */}
      {badge && badge > 0 ? (
        <span style={badgeStyle}>{badge > 99 ? "99+" : badge}</span>
      ) : null}
    </button>
  );
});
SidebarNavItem.displayName = "SidebarNavItem";

/* ─── Section group ─────────────────────────────────────────── */
interface SectionProps {
  label:          string;
  items:          NavItem[];
  activePath:     string;
  isExpanded:     boolean;
  isCollapsed:    boolean;
  onToggle:       () => void;
  onNavigate:     (path: RoutePath) => void;
  getBadge:       (label: string) => number | undefined;
  isFirst:        boolean;
}

const NavSection: FC<SectionProps> = memo(({
  label, items, activePath, isExpanded, isCollapsed, onToggle, onNavigate, getBadge, isFirst,
}) => {
  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        gap:           1,
        marginBottom:  2,
        ...(isFirst ? {} : {
          paddingTop:   8,
          borderTop:    "0.5px solid var(--border)",
          marginTop:    2,
        }),
      }}
    >
      {/* Group label — only visible when expanded */}
      <button
        onClick={onToggle}
        aria-expanded={!isCollapsed}
        style={{
          fontSize:      10,
          fontWeight:    500,
          letterSpacing: "0.06em",
          textTransform: "uppercase" as const,
          color:         "var(--fg-subtle)",
          overflow:      "hidden",
          maxHeight:     isExpanded ? 24 : 0,
          opacity:       isExpanded ? 0.65 : 0,
          transition:    "max-height 220ms cubic-bezier(0.16,1,0.3,1), opacity 140ms ease, padding 220ms cubic-bezier(0.16,1,0.3,1)",
          display:       "flex",
          alignItems:    "center",
          justifyContent: "space-between",
          gap:           6,
          borderRadius:  "var(--radius-sm)",
          userSelect:    "none" as const,
          padding:       isExpanded ? "3px 8px" : "0 8px",
          background:    "transparent",
          border:        "none",
          cursor:        "pointer",
          width:         "100%",
          fontFamily:    "var(--font-ui)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "1";
          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-subtle)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.opacity = "0.65";
          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        }}
      >
        <span>{label}</span>
        {isExpanded && (
          <i
            className="ti ti-chevron-right"
            aria-hidden="true"
            style={{
              fontSize:   10,
              transform:  isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
              transition: "transform 180ms ease",
              color:      "var(--fg-subtle)",
            }}
          />
        )}
      </button>

      {/* Items */}
      {!isCollapsed && items.map((item) => (
        <SidebarNavItem
          key={item.path}
          item={item}
          isActive={activePath === item.path}
          isExpanded={isExpanded}
          badge={getBadge(item.label)}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
});
NavSection.displayName = "NavSection";

/* ─── Learning widget ───────────────────────────────────────── */
const LearningWidget: FC<{
  progress:   MiniProgress;
  isExpanded: boolean;
  onClick:    () => void;
}> = memo(({ progress, isExpanded, onClick }) => {
  const xpToNext  = 100;
  const pct       = Math.min((progress.xp % xpToNext) / xpToNext * 100, 100);

  return (
    <div style={{ flexShrink: 0, padding: "6px 6px 0", borderTop: "0.5px solid var(--border)" }}>
      <button
        onClick={onClick}
        aria-label="Learning center"
        style={{
          width:         "100%",
          borderRadius:  "var(--radius-md)",
          background:    "color-mix(in srgb, var(--accent) 7%, transparent)",
          border:        "0.5px solid var(--accent-border)",
          padding:       "8px 9px",
          display:       "flex",
          alignItems:    "center",
          gap:           isExpanded ? 9 : 0,
          justifyContent: isExpanded ? "flex-start" : "center",
          cursor:        "pointer",
          transition:    "gap 220ms cubic-bezier(0.16,1,0.3,1), background 110ms ease",
          fontFamily:    "var(--font-ui)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "color-mix(in srgb, var(--accent) 12%, transparent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "color-mix(in srgb, var(--accent) 7%, transparent)";
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <ProgressRing pct={pct} size={30} />
        </div>

        <div
          style={{
            flex:      1,
            minWidth:  0,
            opacity:   isExpanded ? 1 : 0,
            transform: isExpanded ? "none" : "translateX(-4px)",
            transition: "opacity 130ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1)",
            pointerEvents: isExpanded ? "auto" : "none",
            overflow:  "hidden",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--fg-default)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
            Level {progress.level}
          </div>
          <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 400, marginTop: 1 }}>
            {progress.xp} XP
          </div>
          {progress.streak > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--amber)", fontWeight: 400, marginTop: 2 }}>
              <i className="ti ti-flame" aria-hidden="true" style={{ fontSize: 11 }} />
              {progress.streak} day streak
            </div>
          )}
        </div>
      </button>
    </div>
  );
});
LearningWidget.displayName = "LearningWidget";

/* ─── User footer ───────────────────────────────────────────── */
const SidebarUser: FC<{
  profile:    UserProfile;
  initials:   string;
  isExpanded: boolean;
  onLogout:   () => void;
}> = memo(({ profile, initials, isExpanded, onLogout }) => {
  const roleColor  = ROLE_COLORS[profile.role ?? "qa"] ?? "var(--accent)";
  const displayName = profile.display_name ?? profile.agent_name ?? profile.email ?? "—";
  const roleLabel   = profile.role ?? "agent";

  return (
    <div style={{ padding: "6px 6px", borderTop: "0.5px solid var(--border)", flexShrink: 0 }}>
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          gap:            isExpanded ? 9 : 0,
          padding:        "7px 8px",
          borderRadius:   "var(--radius-md)",
          background:     "var(--bg-subtle)",
          border:         "0.5px solid var(--border)",
          overflow:       "hidden",
          justifyContent: isExpanded ? "flex-start" : "center",
          transition:     "gap 220ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width:       27,
            height:      27,
            borderRadius: "var(--radius-sm)",
            display:     "grid",
            placeItems:  "center",
            fontSize:    10,
            fontWeight:  500,
            flexShrink:  0,
            position:    "relative",
            background:  `color-mix(in srgb, ${roleColor} 14%, transparent)`,
            color:       roleColor,
            border:      `0.5px solid color-mix(in srgb, ${roleColor} 25%, transparent)`,
            fontFamily:  "var(--font-ui)",
          }}
          aria-hidden="true"
        >
          {initials}
          {/* Online dot */}
          <span
            style={{
              position:    "absolute",
              bottom:      -1,
              right:       -1,
              width:       6,
              height:      6,
              borderRadius: "50%",
              background:  "var(--accent)",
              border:      "1.5px solid var(--sidebar-bg)",
            }}
          />
        </div>

        {/* Name + role */}
        <div
          style={{
            flex:         1,
            minWidth:     0,
            overflow:     "hidden",
            opacity:      isExpanded ? 1 : 0,
            transform:    isExpanded ? "none" : "translateX(-4px)",
            transition:   "opacity 130ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1)",
            pointerEvents: isExpanded ? "auto" : "none",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-default)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.01em", fontFamily: "var(--font-ui)" }}>
            {displayName}
          </div>
          <div style={{ fontSize: 10, fontWeight: 400, color: roleColor, marginTop: 1, textTransform: "capitalize" as const, letterSpacing: "0.02em" }}>
            {roleLabel}
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={onLogout}
          aria-label="Sign out"
          title="Sign out"
          style={{
            width:       isExpanded ? 24 : 0,
            height:      24,
            borderRadius: "var(--radius-sm)",
            border:      "0.5px solid transparent",
            background:  "transparent",
            color:       "var(--fg-muted)",
            display:     "grid",
            placeItems:  "center",
            flexShrink:  0,
            overflow:    "hidden",
            opacity:     isExpanded ? 1 : 0,
            padding:     0,
            transition:  "opacity 130ms ease, width 170ms ease, color 110ms ease, background 110ms ease",
            pointerEvents: isExpanded ? "auto" : "none",
            cursor:      "pointer",
            fontSize:    14,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--rose)";
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(229,115,115,0.10)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(229,115,115,0.22)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
          }}
        >
          <i className="ti ti-logout" aria-hidden="true" style={{ fontSize: 14 }} />
        </button>
      </div>
    </div>
  );
});
SidebarUser.displayName = "SidebarUser";

/* ─── Badge counts — adapt to your real data source ─────────── */
// Replace these with live counts from your stores/queries as needed.
const BADGE_COUNTS: Record<string, number> = {
  "Agent Feedback":      3,
  "Audits List":        12,
  "Supervisor Requests": 2,
};

/* ─── Main Sidebar ──────────────────────────────────────────── */
export const Sidebar: FC<SidebarProps> = memo(({
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
}) => {
  const sidebarStyle: CSSProperties = {
    position:      "fixed",
    inset:         "0 auto 0 0",
    zIndex:        40,
    width:         isExpanded ? 240 : 56,
    display:       "flex",
    flexDirection: "column",
    background:    "var(--sidebar-bg)",
    borderRight:   "0.5px solid var(--sidebar-border)",
    boxShadow:     "var(--shadow-sidebar)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    transition:    "width 220ms cubic-bezier(0.16,1,0.3,1), box-shadow 220ms ease",
    overflow:      "hidden",
    willChange:    "width",
  };

  return (
    <aside
      className={`da-sidebar${isExpanded ? " expanded" : ""}`}
      style={sidebarStyle}
      aria-label="Main navigation"
      onMouseEnter={onExpand}
      onMouseLeave={onCollapse}
    >
      {/* ── Header ── */}
      <div
        style={{
          height:       52,
          display:      "flex",
          alignItems:   "center",
          padding:      "0 10px",
          gap:          10,
          borderBottom: "0.5px solid var(--sidebar-border)",
          flexShrink:   0,
          overflow:     "hidden",
        }}
      >
        {/* Logo mark */}
        <div
          aria-hidden="true"
          style={{
            width:       32,
            height:      32,
            borderRadius: "var(--radius-md)",
            flexShrink:  0,
            background:  "var(--accent-dim)",
            border:      "0.5px solid var(--accent-border)",
            display:     "grid",
            placeItems:  "center",
            color:       "var(--accent)",
            fontSize:    15,
          }}
        >
          <i className="ti ti-circle-check" aria-hidden="true" />
        </div>

        {/* Brand text — slides in when expanded */}
        <div
          style={{
            opacity:       isExpanded ? 1 : 0,
            transform:     isExpanded ? "none" : "translateX(-6px)",
            transition:    "opacity 140ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1)",
            whiteSpace:    "nowrap",
            pointerEvents: isExpanded ? "auto" : "none",
            overflow:      "hidden",
          }}
          aria-hidden={!isExpanded}
        >
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-default)", letterSpacing: "-0.01em", lineHeight: 1.2, fontFamily: "var(--font-ui)" }}>
            Detroit Axle QA
          </div>
          <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 1, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "var(--font-ui)" }}>
            Ops System
          </div>
        </div>
      </div>

      {/* ── Nav rail ── */}
      <nav
        aria-label="Site navigation"
        style={{
          flex:        1,
          overflowY:   "auto",
          overflowX:   "hidden",
          padding:     "8px 6px",
          display:     "flex",
          flexDirection: "column",
          gap:         1,
          scrollbarWidth: "none",
        }}
      >
        {navGroupsOrdered.map(([group, items], idx) => (
          <NavSection
            key={group}
            label={group}
            items={items}
            activePath={activePath}
            isExpanded={isExpanded}
            isCollapsed={collapsedGroups.has(group)}
            onToggle={() => onToggleGroup(group)}
            onNavigate={onNavigate}
            getBadge={(label) => BADGE_COUNTS[label]}
            isFirst={idx === 0}
          />
        ))}

        {/* Help item at the bottom of the rail */}
        <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "0.5px solid var(--border)" }}>
          <SidebarNavItem
            item={{ label: "Help", path: "/help" as RoutePath, group: "Help" }}
            isActive={false}
            isExpanded={isExpanded}
            onNavigate={() => onOpenHelp()}
          />
        </div>
      </nav>

      {/* ── Learning progress widget ── */}
      <LearningWidget
        progress={learningProgress}
        isExpanded={isExpanded}
        onClick={onGoToLearning}
      />

      {/* ── User / logout footer ── */}
      <SidebarUser
        profile={profile}
        initials={userInitials}
        isExpanded={isExpanded}
        onLogout={onLogout}
      />
    </aside>
  );
});
Sidebar.displayName = "Sidebar";
