import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthContext } from './context/AuthContext';
import type { UserProfile } from './context/AuthContext';
import { useAuthState } from './hooks/useAuthState';
import {
  applyThemeCssVariables,
  createStyles,
  getThemePalette,
  readStoredTheme,
} from './lib/theme';
import type { ThemeMode } from './lib/theme';

import AccountsSupabase from './QA/AccountsSupabase';
import AgentFeedbackSupabase from './QA/AgentFeedbackSupabase';
import AgentPortal from './QA/AgentPortal';
import AuditsImportSupabase from './QA/AuditsImportSupabase';
import AuditsListSupabase from './QA/AuditsListSupabase';
import CallsUploadSupabase from './QA/CallsUploadSupabase';
import Dashboard from './QA/Dashboard';
import Login from './QA/Login';
import MonitoringSupabase from './QA/MonitoringSupabase';
import NewAuditSupabase from './QA/NewAuditSupabase';
import ReportsSupabase from './QA/ReportsSupabase';
import ResetPassword from './QA/ResetPassword';
import SalesUploadSupabase from './QA/SalesUploadSupabase';
import SupervisorPortal from './QA/SupervisorPortal';
import SupervisorRequestsSupabase from './QA/SupervisorRequestsSupabase';
import TicketAIReviewQueueSupabase from './QA/TicketAIReviewQueueSupabase';
import TicketEvidenceUploadSupabase from './QA/TicketEvidenceUploadSupabase';
import TicketsUploadSupabase from './QA/TicketsUploadSupabase';

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

type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

const BRAND_MARK_SRC = '/detroit-axle-mark.png';
const BRAND_WORDMARK_SRC = '/detroit-axle-wordmark.svg';

function getActiveRouteLabel(
  pathname: string,
  items: Array<{ path: RoutePath; label: string }>
) {
  return items.find((item) => item.path === pathname)?.label || 'Workspace';
}

function buildNavItems(profile: UserProfile) {
  const isAdmin = profile.role === 'admin';
  const isStaff = isAdmin || profile.role === 'qa';

  if (!isStaff) return [];

  const items: Array<{ path: RoutePath; label: string }> = [
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
    {
      path: ROUTES.profile,
      label: isAdmin ? 'My Admin Profile' : 'My QA Profile',
    }
  );

  return items;
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
      <Route
        path={ROUTES.ticketEvidence}
        element={<TicketEvidenceUploadSupabase />}
      />
      <Route
        path={ROUTES.ticketAiReview}
        element={<TicketAIReviewQueueSupabase />}
      />
      <Route path={ROUTES.salesUpload} element={<SalesUploadSupabase />} />
      <Route path={ROUTES.agentFeedback} element={<AgentFeedbackSupabase />} />
      <Route path={ROUTES.monitoring} element={<MonitoringSupabase />} />
      {isAdmin && (
        <Route path={ROUTES.accounts} element={<AccountsSupabase />} />
      )}
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
            <h2
              style={{
                marginTop: 0,
                marginBottom: '18px',
                color: theme.brandTitle,
              }}
            >
              {isAdmin ? 'My Admin Profile' : 'My QA Profile'}
            </h2>
            <div style={styles.profileGrid}>
              <ProfileInfoCard
                label="Name"
                value={profile.agent_name || '-'}
                styles={styles}
              />
              <ProfileInfoCard
                label="Display Name"
                value={profile.display_name || '-'}
                styles={styles}
              />
              <ProfileInfoCard
                label="Email"
                value={profile.email || '-'}
                styles={styles}
              />
              <ProfileInfoCard
                label="Role"
                value={profile.role || '-'}
                styles={styles}
              />
              <ProfileInfoCard
                label="Agent ID"
                value={profile.agent_id || '-'}
                styles={styles}
              />
              <ProfileInfoCard
                label="Team"
                value={profile.team || '-'}
                styles={styles}
              />
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
  const [routeReady, setRouteReady] = useState(false);

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
    document.documentElement.style.colorScheme =
      themeMode === 'light' ? 'light' : 'dark';
    document.body.style.background = theme.bodyBackground;
    document.body.style.color = theme.bodyColor;
    applyThemeCssVariables(themeMode);
  }, [themeMode, theme.bodyBackground, theme.bodyColor]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setRouteReady(false);
    const frameId = window.requestAnimationFrame(() => {
      setRouteReady(true);
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [location.pathname]);

  const { profile, loading, recoveryMode, logout, handleRecoveryComplete } = auth;

  const profileLabel = useMemo(() => {
    if (!profile) return '';
    return profile.display_name
      ? `${profile.agent_name} - ${profile.display_name}`
      : profile.agent_name;
  }, [profile]);

  const renderStaffContent = (content: ReactNode) => (
    <div
      style={{
        ...styles.routeStage,
        opacity: routeReady ? 1 : 0,
        transform: routeReady ? 'translateY(0)' : 'translateY(14px)',
      }}
      data-route-shell="true"
    >
      {content}
    </div>
  );

  if (loading) {
    return (
      <div style={styles.loadingShell}>
        <div style={styles.loadingCard}>
          <img
            src={BRAND_MARK_SRC}
            alt="Detroit Axle"
            style={styles.loadingBrandMark}
          />
          <h1 style={{ margin: '0 0 8px 0', color: theme.loadingText }}>
            Loading Detroit Axle QA System
          </h1>
          <p style={styles.loadingSubtext}>Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  if (recoveryMode) {
    return (
      <ResetPassword onComplete={handleRecoveryComplete} onLogout={logout} />
    );
  }

  if (!auth.session) return <Login />;

  if (!profile) {
    return (
      <div style={styles.loadingShell}>
        <div style={styles.errorCard}>
          <div style={styles.sectionEyebrow}>Profile Error</div>
          <h1 style={{ marginTop: 0, color: theme.errorText }}>
            Profile not found
          </h1>
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
  const activeRouteLabel = getActiveRouteLabel(
    location.pathname as RoutePath,
    navItems
  );

  return (
    <AuthContext.Provider value={{ profile, loading: false, logout }}>
      <div style={styles.appShell}>
        <div style={styles.backgroundGlowTop} />
        <div style={styles.backgroundGlowBottom} />

        <header style={styles.headerShell}>
          <div style={styles.headerLeft}>
            <div style={styles.brandWrap}>
              <div style={styles.brandLogoWrap}>
                <img
                  src={BRAND_MARK_SRC}
                  alt="Detroit Axle logo"
                  style={styles.brandLogo}
                />
              </div>

              <div style={styles.brandAccent} />

              <div style={styles.brandTextWrap}>
                <div style={styles.brandEyebrow}>Detroit Axle Workspace</div>
                <img
                  src={BRAND_WORDMARK_SRC}
                  alt="Detroit Axle"
                  style={styles.brandWordmark}
                />
                <div style={styles.brandSubtitle}>
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
              onClick={() =>
                setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))
              }
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
                          ...(location.pathname === item.path
                            ? styles.activeNavButton
                            : {}),
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </nav>

                {renderStaffContent(
                  <div style={styles.contentInner}>
                    <StaffRoutes profile={profile} styles={styles} theme={theme} />
                  </div>
                )}
              </>
            ) : (
              <div style={styles.workspaceShell}>
                <aside style={styles.sidebarPanel}>
                  <div style={styles.sidebarTitle}>Workspace Navigation</div>
                  <p style={styles.sidebarText}>
                    Jump between operations, audits, uploads, reports, and
                    people workflows.
                  </p>
                  <div style={styles.metaStrip}>
                    <div style={styles.metaPill}>
                      Active View: {activeRouteLabel}
                    </div>
                    <div style={styles.metaPill}>{navItems.length} tools</div>
                  </div>
                  {navItems.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => navigate(item.path)}
                      style={{
                        ...styles.navButton,
                        textAlign: 'left',
                        ...(location.pathname === item.path
                          ? styles.activeNavButton
                          : {}),
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </aside>

                {renderStaffContent(
                  <div style={styles.contentInner}>
                    <StaffRoutes profile={profile} styles={styles} theme={theme} />
                  </div>
                )}
              </div>
            )}
          </main>
        ) : isSupervisor ? (
          <main style={styles.contentShell}>
            <div
              style={{
                ...styles.routeStage,
                opacity: routeReady ? 1 : 0,
                transform: routeReady ? 'translateY(0)' : 'translateY(14px)',
              }}
              data-route-shell="true"
            >
              <div style={styles.contentInner}>
                <SupervisorPortal currentUser={profile} />
              </div>
            </div>
          </main>
        ) : (
          <main style={styles.contentShell}>
            <div
              style={{
                ...styles.routeStage,
                opacity: routeReady ? 1 : 0,
                transform: routeReady ? 'translateY(0)' : 'translateY(14px)',
              }}
              data-route-shell="true"
            >
              <div style={styles.contentInner}>
                <AgentPortal currentUser={profile} />
              </div>
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
