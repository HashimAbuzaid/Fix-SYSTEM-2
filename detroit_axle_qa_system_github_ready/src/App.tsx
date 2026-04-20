import { useMemo, useState, useEffect, type CSSProperties } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
import type { UserProfile } from './context/AuthContext';

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
  profile: '/profile',
} as const;

type RoutePath = typeof ROUTES[keyof typeof ROUTES];

type NavItem = { path: RoutePath; label: string };

const LOGO_MARK_SRC = '/detroit-axle-mark.png';
const LOGO_WORDMARK_SRC = '/detroit-axle-wordmark.svg';

function getActiveRouteLabel(pathname: string, items: NavItem[]) {
  return items.find((item) => item.path === pathname)?.label || 'Workspace';
}

function buildNavItems(profile: UserProfile): NavItem[] {
  const isAdmin = profile.role === 'admin';
  const isStaff = isAdmin || profile.role === 'qa';

  if (!isStaff) return [];

  const items: NavItem[] = [
    { path: ROUTES.dashboard, label: 'Dashboard' },
    { path: ROUTES.newAudit, label: 'New Audit' },
    { path: ROUTES.auditsUpload, label: 'Audits Upload' },
    { path: ROUTES.auditsList, label: 'Audits List' },
    { path: ROUTES.callsUpload, label: 'Calls Upload' },
    { path: ROUTES.ticketsUpload, label: 'Tickets Upload' },
    { path: ROUTES.ticketEvidence, label: 'Ticket Evidence' },
    { path: ROUTES.ticketAiReview, label: 'Ticket AI Review' },
    { path: ROUTES.salesUpload, label: 'Sales Upload' },
    { path: ROUTES.agentFeedback, label: 'Agent Feedback' },
    { path: ROUTES.monitoring, label: 'Monitoring' },
  ];

  if (isAdmin) {
    items.push(
      { path: ROUTES.accounts, label: 'Accounts' },
      { path: ROUTES.supervisorRequests, label: 'Supervisor Requests' }
    );
  }

  items.push(
    { path: ROUTES.reports, label: 'Reports' },
    { path: ROUTES.profile, label: isAdmin ? 'My Admin Profile' : 'My QA Profile' }
  );

  return items;
}

function getNavIcon(label: string) {
  const map: Record<string, string> = {
    Dashboard: '⌂',
    'New Audit': '+',
    'Audits Upload': '⇪',
    'Audits List': '≣',
    'Calls Upload': '☎',
    'Tickets Upload': '✉',
    'Ticket Evidence': '◫',
    'Ticket AI Review': '✦',
    'Sales Upload': '$',
    'Agent Feedback': '☰',
    Monitoring: '⦿',
    Accounts: '◎',
    'Supervisor Requests': '↗',
    Reports: '▤',
    'My Admin Profile': '☺',
    'My QA Profile': '☺',
  };

  return map[label] || '•';
}

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
          <div style={styles.profilePanel}>
            <div style={styles.sectionEyebrow}>Profile</div>
            <h2 style={{ marginTop: 0, marginBottom: '18px', color: theme.brandTitle }}>
              {isAdmin ? 'My Admin Profile' : 'My QA Profile'}
            </h2>
            <div style={styles.profileGrid}>
              <ProfileInfoCard label="Name" value={profile.agent_name || '-'} styles={styles} />
              <ProfileInfoCard label="Display Name" value={profile.display_name || '-'} styles={styles} />
              <ProfileInfoCard label="Email" value={profile.email || '-'} styles={styles} />
              <ProfileInfoCard label="Role" value={profile.role || '-'} styles={styles} />
              <ProfileInfoCard label="Agent ID" value={profile.agent_id || '-'} styles={styles} />
              <ProfileInfoCard label="Team" value={profile.team || '-'} styles={styles} />
            </div>
          </div>
        }
      />
      <Route path="*" element={<Dashboard />} />
    </Routes>
  );
}

function AppShell() {
  const auth = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme());
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );

  const theme = useMemo(() => getThemePalette(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(theme, themeMode), [theme, themeMode]);
  const isCompactLayout = viewportWidth < 1180;

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

  const { profile, loading, recoveryMode, logout, handleRecoveryComplete } = auth;

  const profileLabel = useMemo(() => {
    if (!profile) return '';
    return profile.display_name
      ? `${profile.agent_name} - ${profile.display_name}`
      : profile.agent_name;
  }, [profile]);

  if (loading) {
    return (
      <div style={styles.loadingShell}>
        <div style={styles.loadingCard}>
          <div style={styles.loadingDot} />
          <h1 style={{ margin: '0 0 8px 0', color: theme.loadingText }}>
            Loading Detroit Axle QA System
          </h1>
          <p style={styles.loadingSubtext}>Preparing your workspace...</p>
        </div>
      </div>
    );
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
          <h1 style={{ marginTop: 0, color: theme.errorText }}>Profile not found</h1>
          <p style={{ color: theme.loadingSubtext }}>
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
  const navItems = buildNavItems(profile);
  const activeRouteLabel = getActiveRouteLabel(location.pathname as RoutePath, navItems);

  const desktopShellStyle: CSSProperties = {
    ...styles.workspaceShell,
    gridTemplateColumns: '292px minmax(0, 1fr)',
    gap: '24px',
  };

  const sidebarShellStyle: CSSProperties = {
    ...styles.sidebarPanel,
    top: '132px',
    padding: '18px 16px 18px 16px',
    display: 'grid',
    gap: '16px',
    alignContent: 'start',
    background:
      themeMode === 'light'
        ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,247,255,0.96) 100%)'
        : 'linear-gradient(180deg, rgba(8,18,38,0.96) 0%, rgba(9,17,34,0.92) 100%)',
  };

  const railHeaderStyle: CSSProperties = {
    display: 'grid',
    gap: '14px',
    padding: '8px 6px 2px 6px',
  };

  const railLogoCardStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '66px minmax(0, 1fr)',
    gap: '12px',
    alignItems: 'center',
    padding: '10px',
    borderRadius: '20px',
    border: theme.metaBorder,
    background: theme.metaBackground,
    boxShadow: theme.headerShadow,
    minWidth: 0,
  };

  const railLogoWrapStyle: CSSProperties = {
    width: '66px',
    height: '66px',
    borderRadius: '20px',
    padding: '6px',
    background:
      themeMode === 'light'
        ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,247,255,0.94) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
    border: theme.metaBorder,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 16px 30px rgba(2,6,23,0.18)',
    display: 'grid',
    placeItems: 'center',
  };

  const railWordmarkStyle: CSSProperties = {
    width: '100%',
    maxWidth: '132px',
    height: '28px',
    objectFit: 'contain',
    objectPosition: 'left center',
  };

  const navGroupStyle: CSSProperties = {
    display: 'grid',
    gap: '8px',
  };

  const navButtonDesktopStyle: CSSProperties = {
    ...styles.navButton,
    display: 'grid',
    gridTemplateColumns: '34px minmax(0, 1fr)',
    alignItems: 'center',
    gap: '12px',
    minHeight: '52px',
    textAlign: 'left',
    borderRadius: '18px',
    padding: '10px 12px',
  };

  const navIconBubbleStyle = (active: boolean): CSSProperties => ({
    width: '34px',
    height: '34px',
    borderRadius: '12px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '15px',
    fontWeight: 900,
    color: active ? '#ffffff' : theme.navButtonText,
    background: active
      ? 'rgba(255,255,255,0.18)'
      : themeMode === 'light'
      ? 'rgba(37,99,235,0.08)'
      : 'rgba(148,163,184,0.10)',
    boxShadow: active ? '0 12px 24px rgba(37,99,235,0.18)' : 'none',
  });

  const sectionTagStyle: CSSProperties = {
    color: theme.brandEyebrow,
    fontSize: '11px',
    fontWeight: 800,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
  };

  const headerBrandLogoWrapStyle: CSSProperties = {
    ...styles.brandLogoWrap,
    width: '86px',
    height: '86px',
    borderRadius: '28px',
    padding: '7px',
    background:
      themeMode === 'light'
        ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,248,255,0.95) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
  };

  const headerBrandInnerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: '22px',
    display: 'grid',
    placeItems: 'center',
    background:
      themeMode === 'light'
        ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,249,255,0.94) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)',
    overflow: 'hidden',
  };

  return (
    <AuthContext.Provider value={{ profile, loading: false, logout }}>
      <div style={styles.appShell}>
        <div style={styles.backgroundGlowTop} />
        <div style={styles.backgroundGlowBottom} />

        <header style={styles.headerShell}>
          <div style={styles.headerLeft}>
            <div style={styles.brandWrap}>
              <div style={headerBrandLogoWrapStyle}>
                <div style={headerBrandInnerStyle}>
                  <img src={LOGO_MARK_SRC} alt="Detroit Axle mark" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              </div>
              <div style={{ ...styles.brandAccent, height: '84px', width: '12px' }} />
              <div style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
                <div style={styles.brandEyebrow}>Detroit Axle Workspace</div>
                <img src={LOGO_WORDMARK_SRC} alt="Detroit Axle" style={{ width: '100%', maxWidth: '760px', height: isCompactLayout ? '48px' : '72px', objectFit: 'contain', objectPosition: 'left center' }} />
                <div style={{ fontSize: isCompactLayout ? '28px' : '36px', lineHeight: 1.04, fontWeight: 800, color: themeMode === 'light' ? '#334155' : '#dbeafe' }}>
                  Quality Assurance Command Center
                </div>
              </div>
            </div>
            <div style={styles.metaStrip}>
              <div style={styles.metaPill}>Role: {profile.role}</div>
              <div style={styles.metaPill}>Workspace: {activeRouteLabel}</div>
              <div style={styles.metaPill}>User: {profileLabel}</div>
              <div style={styles.metaPill}>Email: {profile.email}</div>
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              onClick={() => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))}
              style={styles.themeButton}
            >
              {themeMode === 'light' ? 'Dark Theme' : 'Light Theme'}
            </button>
            <button type="button" onClick={logout} style={styles.logoutButton}>
              Logout
            </button>
          </div>
        </header>

        {isStaff ? (
          <main style={styles.contentShell}>
            {isCompactLayout ? (
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
                          ...(location.pathname === item.path ? styles.activeNavButton : {}),
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </nav>
                <div style={styles.contentInner}>
                  <StaffRoutes profile={profile} styles={styles} theme={theme} />
                </div>
              </>
            ) : (
              <div style={desktopShellStyle}>
                <aside style={sidebarShellStyle}>
                  <div style={railHeaderStyle}>
                    <div style={railLogoCardStyle}>
                      <div style={railLogoWrapStyle}>
                        <img src={LOGO_MARK_SRC} alt="Detroit Axle mark" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ display: 'grid', gap: '6px', minWidth: 0 }}>
                        <div style={sectionTagStyle}>Detroit Axle Workspace</div>
                        <img src={LOGO_WORDMARK_SRC} alt="Detroit Axle" style={railWordmarkStyle} />
                      </div>
                    </div>
                    <div style={{ ...styles.sidebarText, fontSize: '13px' }}>
                      Premium operations hub for audits, uploads, evidence review, reports, and people workflows.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ ...styles.metaPill, justifyContent: 'center', display: 'flex' }}>View: {activeRouteLabel}</div>
                      <div style={{ ...styles.metaPill, justifyContent: 'center', display: 'flex' }}>{navItems.length} tools</div>
                    </div>
                  </div>

                  <div style={navGroupStyle}>
                    <div style={styles.sidebarTitle}>Workspace Navigation</div>
                    {navItems.map((item) => {
                      const active = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => navigate(item.path)}
                          style={{
                            ...navButtonDesktopStyle,
                            ...(active ? styles.activeNavButton : {}),
                          }}
                        >
                          <span style={navIconBubbleStyle(active)}>{getNavIcon(item.label)}</span>
                          <span style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
                            <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                            <span style={{ fontSize: '11px', color: active ? 'rgba(255,255,255,0.8)' : theme.metaText, opacity: 0.9 }}>
                              {active ? 'Current workspace' : 'Open view'}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </aside>
                <div style={styles.contentInner}>
                  <StaffRoutes profile={profile} styles={styles} theme={theme} />
                </div>
              </div>
            )}
          </main>
        ) : isSupervisor ? (
          <main style={styles.contentShell}>
            <div style={styles.contentInner}>
              <SupervisorPortal currentUser={profile} />
            </div>
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
