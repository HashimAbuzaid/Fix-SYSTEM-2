import { useMemo, useState, useEffect, useRef, type CSSProperties } from 'react';
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
  const [activeIndicator, setActiveIndicator] = useState({ top: 0, height: 0, opacity: 0 });

  const navButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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

  const navItems = useMemo(() => (profile ? buildNavItems(profile) : []), [profile]);
  const activeRouteLabel = useMemo(
    () => getActiveRouteLabel(location.pathname as RoutePath, navItems),
    [location.pathname, navItems]
  );

  useEffect(() => {
    if (loading || !profile || isCompactLayout || navItems.length === 0) {
      setActiveIndicator((previous) =>
        previous.opacity === 0 ? previous : { top: 0, height: 0, opacity: 0 }
      );
      return;
    }

    const activePath = navItems.some((item) => item.path === location.pathname)
      ? location.pathname
      : navItems[0]?.path;

    if (!activePath) return;

    const activeElement = navButtonRefs.current[activePath];
    if (!activeElement) return;

    setActiveIndicator({
      top: activeElement.offsetTop,
      height: activeElement.offsetHeight,
      opacity: 1,
    });
  }, [isCompactLayout, loading, location.pathname, navItems, profile, viewportWidth]);

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

  const desktopShellStyle: CSSProperties = {
    ...styles.workspaceShell,
    gridTemplateColumns: '228px minmax(0, 1fr)',
    gap: '18px',
  };

  const sidebarShellStyle: CSSProperties = {
    ...styles.sidebarPanel,
    top: '136px',
    padding: '14px 12px 14px 12px',
    display: 'grid',
    gap: '12px',
    alignContent: 'start',
    borderRadius: '28px',
    background:
      themeMode === 'light'
        ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,255,0.97) 100%)'
        : 'linear-gradient(180deg, rgba(8,18,38,0.96) 0%, rgba(10,17,34,0.94) 100%)',
  };

  const railBrandStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '36px minmax(0, 1fr)',
    gap: '10px',
    alignItems: 'center',
    padding: '4px 6px 6px 6px',
    minWidth: 0,
  };

  const railMarkWrapStyle: CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '12px',
    padding: '4px',
    border: theme.metaBorder,
    background:
      themeMode === 'light'
        ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,247,255,0.95) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
    boxShadow: '0 10px 24px rgba(2,6,23,0.10)',
    display: 'grid',
    placeItems: 'center',
  };

  const railWordmarkStyle: CSSProperties = {
    width: '100%',
    maxWidth: '118px',
    height: '22px',
    objectFit: 'contain',
    objectPosition: 'left center',
  };

  const railCurrentViewStyle: CSSProperties = {
    display: 'grid',
    gap: '2px',
    minWidth: 0,
  };

  const navRailStyle: CSSProperties = {
    position: 'relative',
    display: 'grid',
    gap: '8px',
    padding: '4px 0',
  };

  const activePillStyle: CSSProperties = {
    position: 'absolute',
    left: 0,
    right: 0,
    top: `${activeIndicator.top}px`,
    height: `${activeIndicator.height}px`,
    borderRadius: '18px',
    background: theme.navButtonActiveBackground,
    border: theme.navButtonActiveBorder,
    boxShadow: theme.navButtonActiveShadow,
    opacity: activeIndicator.opacity,
    transition: 'top 240ms cubic-bezier(0.22, 1, 0.36, 1), height 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease',
    pointerEvents: 'none',
  };

  const navButtonDesktopStyle: CSSProperties = {
    ...styles.navButton,
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '32px minmax(0, 1fr)',
    alignItems: 'center',
    gap: '10px',
    minHeight: '54px',
    textAlign: 'left',
    borderRadius: '18px',
    padding: '10px 12px',
    background: 'transparent',
    border: '1px solid transparent',
    boxShadow: 'none',
    zIndex: 1,
  };

  const navIconBubbleStyle = (active: boolean): CSSProperties => ({
    width: '32px',
    height: '32px',
    borderRadius: '11px',
    display: 'grid',
    placeItems: 'center',
    fontSize: '14px',
    fontWeight: 900,
    color: active ? '#ffffff' : theme.navButtonText,
    background: active
      ? 'rgba(255,255,255,0.18)'
      : themeMode === 'light'
      ? 'rgba(37,99,235,0.08)'
      : 'rgba(148,163,184,0.10)',
    boxShadow: active ? '0 10px 20px rgba(37,99,235,0.16)' : 'none',
    transition: 'transform 180ms ease, background 180ms ease, color 180ms ease, box-shadow 180ms ease',
  });

  const headerBrandLogoWrapStyle: CSSProperties = {
    ...styles.brandLogoWrap,
    width: '82px',
    height: '82px',
    borderRadius: '26px',
    padding: '6px',
    background:
      themeMode === 'light'
        ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,248,255,0.95) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
  };

  const headerBrandInnerStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    borderRadius: '20px',
    display: 'grid',
    placeItems: 'center',
    background:
      themeMode === 'light'
        ? 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(245,249,255,0.94) 100%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)',
    overflow: 'hidden',
  };

  const desktopContentInnerStyle: CSSProperties = {
    ...styles.contentInner,
    padding: '28px',
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
                  <img
                    src={LOGO_MARK_SRC}
                    alt="Detroit Axle mark"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              </div>
              <div style={{ ...styles.brandAccent, height: '80px', width: '10px' }} />
              <div style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
                <div style={styles.brandEyebrow}>Detroit Axle Workspace</div>
                <img
                  src={LOGO_WORDMARK_SRC}
                  alt="Detroit Axle"
                  style={{
                    width: '100%',
                    maxWidth: '720px',
                    height: isCompactLayout ? '44px' : '68px',
                    objectFit: 'contain',
                    objectPosition: 'left center',
                  }}
                />
                <div
                  style={{
                    fontSize: isCompactLayout ? '28px' : '34px',
                    lineHeight: 1.04,
                    fontWeight: 800,
                    color: themeMode === 'light' ? '#334155' : '#dbeafe',
                  }}
                >
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
                  <div style={railBrandStyle}>
                    <div style={railMarkWrapStyle}>
                      <img
                        src={LOGO_MARK_SRC}
                        alt="Detroit Axle mark"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
                      <div
                        style={{
                          color: theme.brandEyebrow,
                          fontSize: '10px',
                          fontWeight: 800,
                          letterSpacing: '0.16em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Detroit Axle Workspace
                      </div>
                      <img src={LOGO_WORDMARK_SRC} alt="Detroit Axle" style={railWordmarkStyle} />
                      <div style={railCurrentViewStyle}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: theme.brandTitle }}>
                          {activeRouteLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={navRailStyle}>
                    <div style={activePillStyle} />
                    {navItems.map((item) => {
                      const active = location.pathname === item.path;
                      return (
                        <button
                          key={item.path}
                          ref={(element) => {
                            navButtonRefs.current[item.path] = element;
                          }}
                          type="button"
                          onClick={() => navigate(item.path)}
                          style={{
                            ...navButtonDesktopStyle,
                            color: active ? '#ffffff' : theme.navButtonText,
                            transform: active ? 'translateX(0)' : 'translateX(0)',
                          }}
                        >
                          <span style={navIconBubbleStyle(active)}>{getNavIcon(item.label)}</span>
                          <span style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
                            <span
                              style={{
                                fontWeight: 800,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.label}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                color: active ? 'rgba(255,255,255,0.82)' : theme.metaText,
                                opacity: 0.9,
                              }}
                            >
                              {active ? 'Current view' : 'Open'}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </aside>

                <div style={desktopContentInnerStyle}>
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
