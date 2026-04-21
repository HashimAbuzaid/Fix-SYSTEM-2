import { useMemo, useState, useEffect, type CSSProperties, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import { useAuthState } from './hooks/useAuthState';
import { getThemePalette, applyThemeCssVariables, createStyles, readStoredTheme } from './lib/theme';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { ThemeMode } from './lib/theme';

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
import type { UserProfile } from './context/AuthContext';

// ─────────────────────────────────────────────────────────────
// Routes & constants
// ─────────────────────────────────────────────────────────────
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

type RoutePath = typeof ROUTES[keyof typeof ROUTES];
type NavItem = { path: RoutePath; label: string; group: string };

const LOGO_MARK_SRC = '/detroit-axle-mark.png';
const LOGO_WORDMARK_SRC = '/detroit-axle-wordmark.svg';
const SIDEBAR_COLLAPSED_WIDTH = 72;
const SIDEBAR_EXPANDED_WIDTH = 264;
const SIDEBAR_ITEM_HEIGHT = 48;
const SIDEBAR_ITEM_GAP = 4;
const EXPAND_EASE = '220ms cubic-bezier(0.22, 1, 0.36, 1)';

// ─────────────────────────────────────────────────────────────
// Nav group definitions
// ─────────────────────────────────────────────────────────────
const NAV_GROUPS: Record<string, string[]> = {
  Core:       ['Dashboard', 'Overview', 'Team Dashboard'],
  Audits:     ['New Audit', 'Audits Upload', 'Audits List'],
  Data:       ['Calls Upload', 'Tickets Upload', 'Ticket Evidence', 'Ticket AI Review', 'Sales Upload'],
  Analytics:  ['Agent Feedback', 'Monitoring', 'Team Heatmap'],
  Management: ['Accounts', 'Supervisor Requests', 'Reports'],
  Account:    ['My Admin Profile', 'My QA Profile', 'My Supervisor Profile', 'Supervisor Requests'],
};

function getNavGroup(label: string): string {
  for (const [group, labels] of Object.entries(NAV_GROUPS)) {
    if (labels.includes(label)) return group;
  }
  return 'Other';
}

// ─────────────────────────────────────────────────────────────
// SVG icons
// ─────────────────────────────────────────────────────────────
function NavIconSvg({ label, size = 17 }: { label: string; size?: number }) {
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
    Dashboard: (
      <svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
    ),
    'New Audit': (
      <svg {...p}><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
    ),
    'Audits Upload': (
      <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
    ),
    'Audits List': (
      <svg {...p}><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
    ),
    'Calls Upload': (
      <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.93 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    ),
    'Tickets Upload': (
      <svg {...p}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
    ),
    'Ticket Evidence': (
      <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    ),
    'Ticket AI Review': (
      <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    ),
    'Sales Upload': (
      <svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    ),
    'Agent Feedback': (
      <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    ),
    Monitoring: (
      <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
    ),
    'Team Heatmap': (
      <svg {...p}><rect x="3" y="3" width="4" height="4" rx="0.8"/><rect x="10" y="3" width="4" height="4" rx="0.8"/><rect x="17" y="3" width="4" height="4" rx="0.8"/><rect x="3" y="10" width="4" height="4" rx="0.8"/><rect x="10" y="10" width="4" height="4" rx="0.8"/><rect x="17" y="10" width="4" height="4" rx="0.8"/><rect x="3" y="17" width="4" height="4" rx="0.8"/><rect x="10" y="17" width="4" height="4" rx="0.8"/><rect x="17" y="17" width="4" height="4" rx="0.8"/></svg>
    ),
    Accounts: (
      <svg {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    ),
    'Supervisor Requests': (
      <svg {...p}><polyline points="17 11 21 7 17 3"/><line x1="21" y1="7" x2="9" y2="7"/><polyline points="7 21 3 17 7 13"/><line x1="15" y1="17" x2="3" y2="17"/></svg>
    ),
    Reports: (
      <svg {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    ),
    'My Admin Profile': (
      <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    ),
    'My QA Profile': (
      <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    ),
    Overview: (
      <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    ),
    'Team Dashboard': (
      <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
    ),
    'My Supervisor Profile': (
      <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    ),
  };
  return map[label] ?? (
    <svg {...p}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Theme toggle icons
// ─────────────────────────────────────────────────────────────
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function getActiveRouteLabel(pathname: string, items: NavItem[]) {
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
    path, label, group: getNavGroup(label),
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

// ─────────────────────────────────────────────────────────────
// ProfileInfoCard
// ─────────────────────────────────────────────────────────────
function ProfileInfoCard({
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
}

// ─────────────────────────────────────────────────────────────
// ProfilePanel
// ─────────────────────────────────────────────────────────────
function ProfilePanel({
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
      {/* Avatar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: theme.headerUserAvatarBg,
          color: theme.headerUserAvatarText,
          display: 'grid',
          placeItems: 'center',
          fontSize: '18px',
          fontWeight: 800,
          fontFamily: "'Syne', sans-serif",
          boxShadow: `0 0 0 3px ${theme.avatarRingColor}`,
          flexShrink: 0,
        }}>
          {initials}
        </div>
        <div>
          <div style={styles.sectionEyebrow}>Profile</div>
          <h2 style={{ marginTop: 0, marginBottom: 0, color: theme.brandTitle, fontFamily: "'Syne', sans-serif", fontSize: '22px' }}>
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
}

// ─────────────────────────────────────────────────────────────
// StaffRoutes
// ─────────────────────────────────────────────────────────────
function StaffRoutes({
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
      {isAdmin && (
        <Route
          path={ROUTES.supervisorRequests}
          element={<SupervisorRequestsSupabase currentUser={profile} />}
        />
      )}
      {isStaff && <Route path={ROUTES.reports} element={<ReportsSupabase />} />}
      <Route
        path={ROUTES.profile}
        element={
          <ProfilePanel
            title={isAdmin ? 'My Admin Profile' : 'My QA Profile'}
            profile={profile}
            styles={styles}
            theme={theme}
          />
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  );
}

// ─────────────────────────────────────────────────────────────
// SupervisorRoutes
// ─────────────────────────────────────────────────────────────
function SupervisorRoutes({
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
}

// ─────────────────────────────────────────────────────────────
// LoadingScreen
// ─────────────────────────────────────────────────────────────
function LoadingScreen({
  styles,
  theme,
  message = 'Preparing your workspace…',
}: {
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof getThemePalette>;
  message?: string;
}) {
  return (
    <div style={styles.loadingShell}>
      <div style={styles.loadingCard}>
        <img src={LOGO_MARK_SRC} alt="Detroit Axle" style={styles.loadingBrandMark} />
        <h2 style={{
          margin: '0 0 6px 0',
          fontSize: '22px',
          fontWeight: 800,
          color: theme.loadingText,
          fontFamily: "'Syne', sans-serif",
          letterSpacing: '-0.02em',
        }}>
          Detroit Axle QA
        </h2>
        <p style={styles.loadingSubtext}>{message}</p>
        {/* Three-dot pulse */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '4px' }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                ...styles.loadingDot,
                animation: `da-pulse-dot 1.2s ease-in-out ${i * 160}ms infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AppShell — main layout
// ─────────────────────────────────────────────────────────────
function AppShell() {
  const auth = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme());
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<RoutePath | null>(null);

  const theme = useMemo(() => getThemePalette(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(theme, themeMode), [theme, themeMode]);
  const isCompactLayout = viewportWidth < 1100;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('detroit-axle-theme-mode', themeMode);
    document.documentElement.setAttribute('data-theme-mode', themeMode);
    document.documentElement.style.colorScheme = themeMode === 'light' ? 'light' : 'dark';
    document.body.style.background = theme.bodyBackground;
    document.body.style.color = theme.bodyColor;
    applyThemeCssVariables(themeMode);
  }, [themeMode, theme.bodyBackground, theme.bodyColor]);

  useEffect(() => {
    if (isCompactLayout) {
      setIsSidebarExpanded(false);
      setHoveredPath(null);
    }
  }, [isCompactLayout]);

  const { profile, loading, recoveryMode, logout, handleRecoveryComplete } = auth;

  const profileLabel = useMemo(() => {
    if (!profile) return '';
    return profile.display_name
      ? `${profile.agent_name} — ${profile.display_name}`
      : profile.agent_name;
  }, [profile]);

  const navGroupsOrdered = useMemo(() => {
    const groups: Record<string, NavItem[]> = {};
    if (!profile) return [] as [string, NavItem[]][];
    const items = buildNavItems(profile);
    items.forEach((item) => {
      const g = item.group;
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    });
    return Object.entries(groups) as [string, NavItem[]][];
  }, [profile]);

  // ── Loading ──
  if (loading) {
    return <LoadingScreen styles={styles} theme={theme} />;
  }

  if (recoveryMode) {
    return <ResetPassword onComplete={handleRecoveryComplete} onLogout={logout} />;
  }

  if (!auth.session) return <Login />;

  if (!profile) {
    return (
      <div style={styles.loadingShell}>
        <div style={styles.errorCard}>
          <div style={styles.sectionEyebrow}>Profile Error</div>
          <h1 style={{ marginTop: 0, color: theme.errorText, fontFamily: "'Syne', sans-serif" }}>
            Profile not found
          </h1>
          <p style={{ color: theme.loadingSubtext, marginBottom: '20px' }}>
            {auth.profileError ||
              'This user exists in Supabase Auth but does not have a profile row yet.'}
          </p>
          <button onClick={logout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = profile.role === 'admin';
  const isQA = profile.role === 'qa';
  const isSupervisor = profile.role === 'supervisor';
  const isStaff = isAdmin || isQA;
  const hasSidebarRail = isStaff || isSupervisor;
  const navItems = buildNavItems(profile);
  const activeRouteLabel = getActiveRouteLabel(location.pathname as RoutePath, navItems);
  const expandedSidebar = !isCompactLayout && isSidebarExpanded;
  const userInitials = getUserInitials(profile);

  // ── Desktop sidebar layout ──
  const desktopShellStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: hasSidebarRail
      ? `${SIDEBAR_COLLAPSED_WIDTH}px minmax(0, 1fr)`
      : 'minmax(0, 1fr)',
    gap: hasSidebarRail ? '16px' : '0',
    alignItems: 'start',
  };

  const sidebarDockStyle: CSSProperties = {
    position: 'sticky',
    top: '76px',
    alignSelf: 'start',
    width: `${SIDEBAR_COLLAPSED_WIDTH}px`,
    height: 'calc(100vh - 92px)',
    maxHeight: 'calc(100vh - 92px)',
    minHeight: '420px',
    zIndex: 10,
  };

  const sidebarPanelStyle: CSSProperties = {
    position: 'relative',
    width: expandedSidebar ? `${SIDEBAR_EXPANDED_WIDTH}px` : `${SIDEBAR_COLLAPSED_WIDTH}px`,
    minHeight: '100%',
    height: '100%',
    padding: '8px',
    borderRadius: '20px',
    border: theme.panelBorder,
    background: themeMode === 'light'
      ? 'rgba(255,255,255,0.90)'
      : 'rgba(6,12,26,0.92)',
    boxShadow: expandedSidebar
      ? '0 24px 56px rgba(0,0,0,0.36)'
      : '0 12px 32px rgba(0,0,0,0.24)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    overflow: 'hidden',
    willChange: 'width, box-shadow',
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    transition: `width ${EXPAND_EASE}, box-shadow 200ms ease`,
  };

  // Sidebar header (logo area)
  const railHeaderStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: expandedSidebar ? '10px' : '0',
    padding: expandedSidebar ? '8px 10px 12px 10px' : '8px 4px 12px 4px',
    borderBottom: themeMode === 'light'
      ? '1px solid rgba(148,163,184,0.14)'
      : '1px solid rgba(148,163,184,0.08)',
    overflow: 'hidden',
    transition: `gap ${EXPAND_EASE}, padding ${EXPAND_EASE}`,
  };

  const railLogoWrapStyle: CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    padding: '5px',
    background: themeMode === 'light'
      ? 'rgba(239,246,255,0.96)'
      : 'rgba(255,255,255,0.08)',
    border: theme.metaBorder,
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    justifySelf: 'center',
  };

  const railBrandTextStyle: CSSProperties = {
    display: 'grid',
    gap: '2px',
    minWidth: 0,
    opacity: expandedSidebar ? 1 : 0,
    transform: expandedSidebar ? 'translateX(0)' : 'translateX(-8px)',
    transition: 'opacity 140ms ease, transform 180ms ease',
    pointerEvents: expandedSidebar ? 'auto' : 'none',
    overflow: 'hidden',
  };

  // Nav rail
  const navRailStyle: CSSProperties = {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    height: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '4px 4px 24px 0',
    scrollbarWidth: 'thin',
    scrollbarColor:
      themeMode === 'light'
        ? 'rgba(37,99,235,0.42) rgba(37,99,235,0.06)'
        : 'rgba(96,165,250,0.34) rgba(255,255,255,0.04)',
    scrollbarGutter: 'stable',
    scrollBehavior: 'smooth',
    WebkitOverflowScrolling: 'touch',
  };

  const navButtonDesktopStyle = (active: boolean, hovered: boolean): CSSProperties => ({
    ...styles.navButton,
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: expandedSidebar ? '10px' : '0',
    height: `${SIDEBAR_ITEM_HEIGHT}px`,
    minHeight: `${SIDEBAR_ITEM_HEIGHT}px`,
    marginBottom: `${SIDEBAR_ITEM_GAP}px`,
    textAlign: 'left',
    borderRadius: '14px',
    padding: expandedSidebar ? '0 12px' : '0',
    justifyContent: expandedSidebar ? 'flex-start' : 'center',
    border: active ? theme.navButtonActiveBorder : '1px solid transparent',
    background: active
      ? theme.navButtonActiveBackground
      : !active && hovered
      ? themeMode === 'light' ? 'rgba(37,99,235,0.06)' : 'rgba(255,255,255,0.06)'
      : 'transparent',
    color: active
      ? theme.navButtonActiveText
      : hovered
      ? themeMode === 'light' ? '#2563eb' : '#93c5fd'
      : theme.navButtonText,
    boxShadow: active ? theme.navButtonActiveShadow : 'none',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    transition: `color 140ms ease, background 120ms ease, gap ${EXPAND_EASE}, padding ${EXPAND_EASE}, box-shadow 160ms ease, border-color 160ms ease`,
    width: '100%',
  });

  const navIconBubbleStyle = (active: boolean, hovered: boolean): CSSProperties => ({
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    color: active
      ? '#ffffff'
      : hovered
      ? themeMode === 'light' ? '#2563eb' : '#93c5fd'
      : theme.navButtonText,
    background: active
      ? 'rgba(255,255,255,0.18)'
      : hovered
      ? themeMode === 'light' ? 'rgba(37,99,235,0.10)' : 'rgba(255,255,255,0.10)'
      : 'transparent',
    transition: 'background 140ms ease, color 140ms ease',
  });

  const navLabelStyle = (active: boolean): CSSProperties => ({
    fontSize: '13px',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    opacity: expandedSidebar ? 1 : 0,
    maxWidth: expandedSidebar ? '160px' : '0',
    transition: `max-width 220ms cubic-bezier(0.22,1,0.36,1), opacity 120ms ease`,
    color: active ? '#ffffff' : 'currentColor',
  });

  return (
    <>
      <style>{`
        .da-sidebar-scroll::-webkit-scrollbar {
          width: 10px;
        }

        .da-sidebar-scroll::-webkit-scrollbar-track {
          background: ${themeMode === 'light' ? 'rgba(37,99,235,0.05)' : 'rgba(255,255,255,0.04)'};
          border-radius: 999px;
        }

        .da-sidebar-scroll::-webkit-scrollbar-thumb {
          background: ${
            themeMode === 'light'
              ? 'linear-gradient(180deg, rgba(37,99,235,0.52) 0%, rgba(59,130,246,0.44) 100%)'
              : 'linear-gradient(180deg, rgba(96,165,250,0.40) 0%, rgba(37,99,235,0.34) 100%)'
          };
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
          opacity: 0;
          transition: opacity 180ms ease, background 180ms ease;
        }

        .da-sidebar-scroll:hover::-webkit-scrollbar-thumb,
        .da-sidebar-scroll:focus-within::-webkit-scrollbar-thumb,
        .da-sidebar-scroll:active::-webkit-scrollbar-thumb {
          opacity: 1;
        }

        .da-sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: ${
            themeMode === 'light'
              ? 'linear-gradient(180deg, rgba(29,78,216,0.64) 0%, rgba(37,99,235,0.56) 100%)'
              : 'linear-gradient(180deg, rgba(147,197,253,0.52) 0%, rgba(59,130,246,0.42) 100%)'
          };
          border: 2px solid transparent;
          background-clip: padding-box;
        }
      `}</style>
    <AuthContext.Provider value={{ profile, loading: false, logout }}>
      <div style={styles.appShell}>
        {/* Ambient glows */}
        <div style={styles.backgroundGlowTop} />
        <div style={styles.backgroundGlowBottom} />

        {/* ── Compact sticky header ── */}
        <header style={styles.headerShell}>
          {/* Left: brand */}
          <div style={{ ...styles.headerLeft, gap: '10px' }}>
            <div
              style={{
                width: '8px',
                height: '52px',
                borderRadius: '999px',
                background: theme.brandAccent,
                boxShadow: theme.brandAccentShadow,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isCompactLayout ? '8px' : '10px',
                minWidth: 0,
              }}
            >
              <img
                src={LOGO_WORDMARK_SRC}
                alt="Detroit Axle"
                style={{
                  width: isCompactLayout ? '128px' : '220px',
                  height: isCompactLayout ? '28px' : '42px',
                  objectFit: 'contain',
                  objectPosition: 'left center',
                  display: 'block',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: isCompactLayout ? '13px' : '16px',
                  fontWeight: 900,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
                  background: themeMode === 'light'
                    ? 'linear-gradient(90deg, #0b6fb3 0%, #35a8e0 100%)'
                    : 'linear-gradient(90deg, #127bc0 0%, #58c0f4 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                  filter: themeMode === 'light' ? 'none' : 'drop-shadow(0 1px 10px rgba(37,99,235,0.14))',
                  transform: 'translateY(-1px)',
                  flexShrink: 0,
                  marginLeft: isCompactLayout ? '2px' : '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                QA SYSTEM
              </span>
            </div>
          </div>

          {/* Center: breadcrumb */}
          {!isCompactLayout && (
            <div style={styles.headerCenter}>
              <span style={styles.headerCrumb}>Workspace</span>
              <span style={styles.headerCrumbSep}>›</span>
              <span style={styles.headerPageTitle}>{activeRouteLabel}</span>
            </div>
          )}

          {/* Right: user + actions */}
          <div style={styles.headerActions}>
            {!isCompactLayout && (
              <div style={styles.headerUserBadge}>
                <div style={styles.headerUserAvatar}>{userInitials}</div>
                <div>
                  <div style={styles.headerUserName}>{profileLabel || profile.email}</div>
                  <div style={styles.headerUserRole}>{profile.role}</div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))}
              style={styles.headerThemeBtn}
              title={themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                {themeMode === 'light' ? <MoonIcon /> : <SunIcon />}
                {!isCompactLayout && (themeMode === 'light' ? 'Dark' : 'Light')}
              </span>
            </button>

            <button type="button" onClick={logout} style={styles.headerLogoutBtn}>
              Sign Out
            </button>
          </div>
        </header>

        {/* ── Main content area ── */}
        {hasSidebarRail ? (
          <main style={styles.contentShell}>
            {isCompactLayout ? (
              /* ── Mobile: horizontal scrolling nav ── */
              <>
                <nav style={styles.navShell}>
                  <div style={styles.navScroller}>
                    {navItems.map((item) => (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => navigate(item.path)}
                        style={{
                          ...styles.navButton,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          ...(location.pathname === item.path ? styles.activeNavButton : {}),
                        }}
                      >
                        <NavIconSvg label={item.label} size={15} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </nav>
                <div style={styles.contentInner}>
                  {isStaff ? (
                    <StaffRoutes profile={profile} styles={styles} theme={theme} />
                  ) : (
                    <SupervisorRoutes profile={profile} styles={styles} theme={theme} />
                  )}
                </div>
              </>
            ) : (
              /* ── Desktop: collapsible sidebar rail ── */
              <div style={desktopShellStyle}>
                <aside
                  style={sidebarDockStyle}
                  onMouseEnter={() => setIsSidebarExpanded(true)}
                  onMouseLeave={() => { setIsSidebarExpanded(false); setHoveredPath(null); }}
                  onFocusCapture={() => setIsSidebarExpanded(true)}
                  onBlurCapture={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setIsSidebarExpanded(false);
                      setHoveredPath(null);
                    }
                  }}
                >
                  <div style={sidebarPanelStyle}>
                    {/* Sidebar header */}
                    <div style={railHeaderStyle}>
                      <div style={railLogoWrapStyle}>
                        <img
                          src={LOGO_MARK_SRC}
                          alt="Detroit Axle"
                          style={{ width: '28px', height: '28px', objectFit: 'contain' }}
                        />
                      </div>
                      <div style={railBrandTextStyle}>
                        <img
                          src={LOGO_WORDMARK_SRC}
                          alt="Detroit Axle"
                          style={{ width: '110px', height: '18px', objectFit: 'contain', objectPosition: 'left center' }}
                        />
                        <span style={{
                          fontSize: '10px',
                          color: themeMode === 'light' ? '#64748b' : '#475569',
                          fontWeight: 500,
                          letterSpacing: '0.04em',
                        }}>
                          QA System
                        </span>
                      </div>
                    </div>

                    {/* Nav items */}
                    <div className="da-sidebar-scroll" style={navRailStyle}>
                      {expandedSidebar
                        ? navGroupsOrdered.map(([groupName, groupItems], gi) => (
                          <div key={groupName}>
                            {gi > 0 && <div style={styles.navDivider} />}
                            <div style={styles.navGroupLabel}>{groupName}</div>
                            {groupItems.map((item) => {
                              const active = location.pathname === item.path;
                              const hovered = hoveredPath === item.path;
                              return (
                                <button
                                  key={item.path}
                                  type="button"
                                  onClick={() => navigate(item.path)}
                                  onMouseEnter={() => setHoveredPath(item.path)}
                                  onMouseLeave={() => setHoveredPath(null)}
                                  style={navButtonDesktopStyle(active, hovered)}
                                  title={undefined}
                                >
                                  <span style={navIconBubbleStyle(active, hovered)}>
                                    <NavIconSvg label={item.label} size={16} />
                                  </span>
                                  <span style={navLabelStyle(active)}>{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        ))
                        : navItems.map((item) => {
                          const active = location.pathname === item.path;
                          const hovered = hoveredPath === item.path;
                          return (
                            <button
                              key={item.path}
                              type="button"
                              onClick={() => navigate(item.path)}
                              onMouseEnter={() => setHoveredPath(item.path)}
                              onMouseLeave={() => setHoveredPath(null)}
                              style={navButtonDesktopStyle(active, hovered)}
                              title={item.label}
                            >
                              <span style={navIconBubbleStyle(active, hovered)}>
                                <NavIconSvg label={item.label} size={16} />
                              </span>
                              <span style={navLabelStyle(active)}>{item.label}</span>
                            </button>
                          );
                        })
                      }
                    </div>
                  </div>
                </aside>

                {/* Content panel */}
                <div style={styles.contentInner}>
                  {isStaff ? (
                    <StaffRoutes profile={profile} styles={styles} theme={theme} />
                  ) : (
                    <SupervisorRoutes profile={profile} styles={styles} theme={theme} />
                  )}
                </div>
              </div>
            )}
          </main>
        ) : (
          /* ── Agent portal (no sidebar) ── */
          <main style={styles.contentShell}>
            <div style={styles.contentInner}>
              <AgentPortal currentUser={profile} />
            </div>
          </main>
        )}
      </div>
    </AuthContext.Provider>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// App root
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
