import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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

import Login from './QA/Login';
import ResetPassword from './QA/ResetPassword';
import AgentPortal from './QA/AgentPortal';
import SupervisorPortal from './QA/SupervisorPortal';
import Dashboard from './QA/Dashboard';
import NewAuditSupabase from './QA/NewAuditSupabase';
import AuditsImportSupabase from './QA/AuditsImportSupabase';
import CallsUploadSupabase from './QA/CallsUploadSupabase';
import TicketsUploadSupabase from './QA/TicketsUploadSupabase';
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
  salesUpload: '/sales-upload',
  agentFeedback: '/agent-feedback',
  monitoring: '/monitoring',
  accounts: '/accounts',
  supervisorRequests: '/supervisor-requests',
  reports: '/reports',
  profile: '/profile',
} as const;

type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

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
              <ProfileInfoCard
                label="Display Name"
                value={profile.display_name || '-'}
                styles={styles}
              />
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

function WorkspaceBootScreen({
  theme,
  styles,
  title,
  subtitle,
  badge,
}: {
  theme: ReturnType<typeof getThemePalette>;
  styles: ReturnType<typeof createStyles>;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <div style={styles.loadingShell}>
      <div
        style={{
          ...styles.loadingCard,
          maxWidth: '640px',
          padding: '40px 36px',
          position: 'relative',
          overflow: 'hidden',
          background:
            themeModeFromBody() === 'light'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(245,249,255,0.94) 100%)'
              : 'linear-gradient(180deg, rgba(15,23,42,0.86) 0%, rgba(15,23,42,0.74) 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '0 auto auto 0',
            width: '220px',
            height: '220px',
            background:
              themeModeFromBody() === 'light'
                ? 'radial-gradient(circle, rgba(37,99,235,0.10) 0%, transparent 68%)'
                : 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: '86px',
              height: '86px',
              margin: '0 auto 18px auto',
              borderRadius: '26px',
              border: theme.headerBorder,
              background: theme.metaBackground,
              display: 'grid',
              placeItems: 'center',
              boxShadow: theme.headerShadow,
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '18px',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: '18px',
                color: theme.brandTitle,
                background: theme.brandAccent,
                boxShadow: theme.brandAccentShadow,
              }}
            >
              DA
            </div>
          </div>

          {badge ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                borderRadius: '999px',
                marginBottom: '14px',
                fontSize: '12px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: theme.brandEyebrow,
                border: theme.metaBorder,
                background: theme.metaBackground,
              }}
            >
              {badge}
            </div>
          ) : null}

          <h1
            style={{
              margin: '0 0 10px 0',
              color: theme.loadingText,
              fontSize: '32px',
              lineHeight: 1.08,
            }}
          >
            {title}
          </h1>

          <p
            style={{
              margin: '0 auto',
              maxWidth: '480px',
              color: theme.loadingSubtext,
              lineHeight: 1.7,
              fontSize: '15px',
            }}
          >
            {subtitle}
          </p>

          <div
            style={{
              marginTop: '22px',
              display: 'grid',
              gap: '10px',
            }}
          >
            <div
              style={{
                height: '10px',
                borderRadius: '999px',
                background:
                  themeModeFromBody() === 'light'
                    ? 'rgba(226,232,240,0.92)'
                    : 'rgba(30,41,59,0.86)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '52%',
                  height: '100%',
                  borderRadius: '999px',
                  background: theme.brandAccent,
                  boxShadow: theme.brandAccentShadow,
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                justifyContent: 'center',
              }}
            >
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '999px',
                    background:
                      index === 1
                        ? theme.brandAccent
                        : themeModeFromBody() === 'light'
                        ? 'rgba(148,163,184,0.34)'
                        : 'rgba(148,163,184,0.22)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StartupOverlay({
  theme,
  activeRouteLabel,
}: {
  theme: ReturnType<typeof getThemePalette>;
  activeRouteLabel: string;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background:
          themeModeFromBody() === 'light'
            ? 'rgba(237,244,255,0.76)'
            : 'rgba(7,17,31,0.66)',
        backdropFilter: 'blur(14px)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '28px',
          border: theme.headerBorder,
          background: theme.headerBackground,
          boxShadow: theme.headerShadow,
          padding: '28px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px',
            borderRadius: '999px',
            marginBottom: '14px',
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: theme.brandEyebrow,
            border: theme.metaBorder,
            background: theme.metaBackground,
          }}
        >
          Opening Workspace
        </div>

        <h2 style={{ margin: '0 0 8px 0', color: theme.brandTitle }}>
          Loading {activeRouteLabel}
        </h2>

        <p
          style={{
            margin: '0 auto',
            maxWidth: '400px',
            color: theme.loadingSubtext,
            lineHeight: 1.65,
          }}
        >
          Finalizing the first screen so brief component loaders do not flash during login.
        </p>

        <div
          style={{
            marginTop: '18px',
            height: '8px',
            borderRadius: '999px',
            background:
              themeModeFromBody() === 'light'
                ? 'rgba(226,232,240,0.92)'
                : 'rgba(30,41,59,0.86)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: '64%',
              height: '100%',
              borderRadius: '999px',
              background: theme.brandAccent,
              boxShadow: theme.brandAccentShadow,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function themeModeFromBody(): ThemeMode {
  if (typeof document === 'undefined') return 'dark';
  const mode =
    document.documentElement.getAttribute('data-theme-mode') ||
    document.body.dataset.theme ||
    window.localStorage.getItem('detroit-axle-theme-mode') ||
    'dark';

  return mode === 'light' ? 'light' : 'dark';
}

function AppShell() {
  const auth = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStoredTheme());
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );
  const [bootOverlayVisible, setBootOverlayVisible] = useState(false);

  const theme = useMemo(() => getThemePalette(themeMode), [themeMode]);
  const styles = useMemo(() => createStyles(theme, themeMode), [theme, themeMode]);
  const isCompactLayout = viewportWidth < 1180;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

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
  const sessionUserId = auth.session?.user?.id || '';

  useEffect(() => {
    if (loading || !auth.session || !profile) {
      setBootOverlayVisible(false);
      return undefined;
    }

    if (typeof window === 'undefined') return undefined;

    setBootOverlayVisible(true);
    const timer = window.setTimeout(() => {
      setBootOverlayVisible(false);
    }, 650);

    return () => window.clearTimeout(timer);
  }, [loading, auth.session, profile, sessionUserId]);

  const profileLabel = useMemo(() => {
    if (!profile) return '';
    return profile.display_name
      ? `${profile.agent_name} - ${profile.display_name}`
      : profile.agent_name;
  }, [profile]);

  if (loading) {
    return (
      <WorkspaceBootScreen
        theme={theme}
        styles={styles}
        badge="Starting Session"
        title="Loading Detroit Axle QA System"
        subtitle="Syncing your profile, workspace permissions, and first-view modules."
      />
    );
  }

  if (recoveryMode) {
    return <ResetPassword onComplete={handleRecoveryComplete} onLogout={logout} />;
  }

  if (!auth.session) return <Login />;

  if (!profile) {
    const authUserId = auth.session?.user?.id || '';
    const authEmail = auth.session?.user?.email || '';

    return (
      <div style={styles.loadingShell}>
        <div
          style={{
            ...styles.errorCard,
            maxWidth: '760px',
            background:
              themeMode === 'light'
                ? 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.94) 100%)'
                : 'linear-gradient(180deg, rgba(15,23,42,0.86) 0%, rgba(15,23,42,0.78) 100%)',
          }}
        >
          <div style={styles.sectionEyebrow}>Profile Error</div>

          <h1 style={{ margin: '0 0 10px 0', color: theme.errorText }}>Profile not found</h1>

          <p style={{ color: theme.loadingSubtext, lineHeight: 1.7, marginBottom: '18px' }}>
            {auth.profileError ||
              'This user exists in Supabase Auth but does not have a matching row in public.profiles yet.'}
          </p>

          <div
            style={{
              display: 'grid',
              gap: '12px',
              padding: '16px',
              borderRadius: '18px',
              border: theme.headerBorder,
              background: theme.metaBackground,
              marginBottom: '18px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: theme.brandEyebrow,
                }}
              >
                Auth User UUID
              </div>
              <div
                style={{
                  marginTop: '6px',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: theme.brandTitle,
                  wordBreak: 'break-all',
                }}
              >
                {authUserId || '-'}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: theme.brandEyebrow,
                }}
              >
                Email
              </div>
              <div
                style={{
                  marginTop: '6px',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: theme.brandTitle,
                }}
              >
                {authEmail || '-'}
              </div>
            </div>

            <div style={{ color: theme.loadingSubtext, fontSize: '14px', lineHeight: 1.6 }}>
              Create a row in <strong>public.profiles</strong> using this UUID as the profile{' '}
              <strong>id</strong>. Agent needs <strong>agent_id</strong> and{' '}
              <strong>team</strong>. Supervisor needs <strong>team</strong>.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={async () => {
                if (!authUserId) return;
                try {
                  await navigator.clipboard.writeText(authUserId);
                } catch {
                  // ignore clipboard failures
                }
              }}
              style={styles.themeButton}
            >
              Copy UUID
            </button>

            <button onClick={logout} style={styles.logoutButton}>
              Logout
            </button>
          </div>
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

  return (
    <AuthContext.Provider value={{ profile, loading: false, logout }}>
      <div style={styles.appShell}>
        <div style={styles.backgroundGlowTop} />
        <div style={styles.backgroundGlowBottom} />

        <header style={styles.headerShell}>
          <div style={styles.headerLeft}>
            <div style={styles.brandWrap}>
              <div style={styles.brandLogoWrap}>
                <div
                  style={{
                    fontWeight: 900,
                    fontSize: '18px',
                    color: theme.brandTitle,
                    letterSpacing: '0.08em',
                  }}
                >
                  DA
                </div>
              </div>
              <div style={styles.brandAccent} />
              <div>
                <div style={styles.brandEyebrow}>Detroit Axle Workspace</div>
                <h1 style={styles.brandTitle}>Detroit Axle QA System</h1>
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
              <div style={styles.workspaceShell}>
                <aside style={styles.sidebarPanel}>
                  <div style={styles.sidebarTitle}>Workspace Navigation</div>
                  <p style={styles.sidebarText}>
                    Jump between operations, audits, uploads, reports, and people workflows.
                  </p>
                  <div style={styles.metaStrip}>
                    <div style={styles.metaPill}>Active View: {activeRouteLabel}</div>
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
                        ...(location.pathname === item.path ? styles.activeNavButton : {}),
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
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

        {bootOverlayVisible ? (
          <StartupOverlay theme={theme} activeRouteLabel={activeRouteLabel} />
        ) : null}
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