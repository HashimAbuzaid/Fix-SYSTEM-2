import type { CSSProperties } from 'react';

export type ThemeMode = 'dark' | 'light';

export type ThemePalette = {
  shellBackground: string;
  shellColor: string;
  bodyBackground: string;
  bodyColor: string;
  glowTop: string;
  glowBottom: string;
  headerBackground: string;
  headerBorder: string;
  headerShadow: string;
  brandEyebrow: string;
  brandTitle: string;
  brandAccent: string;
  brandAccentShadow: string;
  metaBackground: string;
  metaBorder: string;
  metaText: string;
  navButtonBackground: string;
  navButtonBorder: string;
  navButtonText: string;
  navButtonActiveBackground: string;
  navButtonActiveBorder: string;
  navButtonActiveText: string;
  navButtonActiveShadow: string;
  panelBackground: string;
  panelBorder: string;
  panelShadow: string;
  profileCardBackground: string;
  profileCardBorder: string;
  profileCardLabel: string;
  profileCardValue: string;
  buttonPrimaryBackground: string;
  buttonPrimaryBorder: string;
  buttonPrimaryText: string;
  buttonPrimaryShadow: string;
  buttonSecondaryBackground: string;
  buttonSecondaryBorder: string;
  buttonSecondaryText: string;
  loadingBackground: string;
  loadingCardBackground: string;
  loadingCardBorder: string;
  loadingDotBackground: string;
  loadingDotShadow: string;
  loadingText: string;
  loadingSubtext: string;
  errorCardBackground: string;
  errorCardBorder: string;
  errorText: string;
  contentText: string;
  compactHeaderBg: string;
  compactHeaderBorder: string;
  compactHeaderShadow: string;
  headerBrandNameColor: string;
  headerBrandSubColor: string;
  headerPageTitleColor: string;
  headerCrumbColor: string;
  headerUserAvatarBg: string;
  headerUserAvatarText: string;
  headerUserNameColor: string;
  headerUserRoleColor: string;
  headerIconBtnBg: string;
  headerIconBtnBorder: string;
  headerIconBtnColor: string;
  headerIconBtnHoverBg: string;
  headerSignOutBg: string;
  headerSignOutBorder: string;
  headerSignOutColor: string;
  navGroupLabelColor: string;
  navDividerColor: string;
  avatarRingColor: string;
  profileStatBg: string;
  profileStatBorder: string;
  profileStatLabel: string;
  profileStatValue: string;
};

/* ── Theme detection ── */

export function isThemeMode(value: string): value is ThemeMode {
  return value === 'dark' || value === 'light';
}

export function readStoredTheme(): ThemeMode {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('detroit-axle-theme-mode');
      if (stored && isThemeMode(stored)) return stored;
    } catch {
      /* ignore */
    }

    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  }
  return 'dark';
}

/* ── Palettes ── */

export function getThemePalette(mode: ThemeMode): ThemePalette {
  if (mode === 'light') {
    return {
      shellBackground:
        'radial-gradient(ellipse 80% 40% at 10% -10%, rgba(37,99,235,0.12), transparent 60%), ' +
        'radial-gradient(ellipse 60% 30% at 90% 110%, rgba(99,102,241,0.08), transparent 50%), ' +
        'linear-gradient(180deg, #f4f8ff 0%, #eef4ff 100%)',
      shellColor: '#0f172a',
      bodyBackground: '#edf4ff',
      bodyColor: '#0f172a',
      glowTop: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 68%)',
      glowBottom: 'radial-gradient(circle, rgba(14,165,233,0.10) 0%, transparent 70%)',
      headerBackground: 'rgba(255,255,255,0.88)',
      headerBorder: '1px solid rgba(148,163,184,0.20)',
      headerShadow: '0 4px 24px rgba(15,23,42,0.08)',
      brandEyebrow: '#2563eb',
      brandTitle: '#0f172a',
      brandAccent: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)',
      brandAccentShadow: '0 0 24px rgba(37,99,235,0.22)',
      metaBackground: 'rgba(255,255,255,0.80)',
      metaBorder: '1px solid rgba(148,163,184,0.20)',
      metaText: '#334155',
      navButtonBackground: 'rgba(255,255,255,0.82)',
      navButtonBorder: '1px solid rgba(148,163,184,0.18)',
      navButtonText: '#475569',
      navButtonActiveBackground: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
      navButtonActiveBorder: '1px solid rgba(96,165,250,0.40)',
      navButtonActiveText: '#ffffff',
      navButtonActiveShadow: '0 8px 20px rgba(37,99,235,0.24)',
      panelBackground: 'rgba(255,255,255,0.80)',
      panelBorder: '1px solid rgba(148,163,184,0.16)',
      panelShadow: '0 20px 48px rgba(15,23,42,0.10)',
      profileCardBackground: 'rgba(248,251,255,0.92)',
      profileCardBorder: '1px solid rgba(148,163,184,0.18)',
      profileCardLabel: '#3b82f6',
      profileCardValue: '#0f172a',
      buttonPrimaryBackground: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      buttonPrimaryBorder: '1px solid rgba(37,99,235,0.30)',
      buttonPrimaryText: '#ffffff',
      buttonPrimaryShadow: '0 8px 20px rgba(37,99,235,0.28)',
      buttonSecondaryBackground: 'rgba(255,255,255,0.90)',
      buttonSecondaryBorder: '1px solid rgba(148,163,184,0.22)',
      buttonSecondaryText: '#334155',
      loadingBackground:
        'radial-gradient(ellipse 70% 40% at 10% -5%, rgba(37,99,235,0.12), transparent 55%), ' +
        'linear-gradient(180deg, #f4f8ff 0%, #edf4ff 100%)',
      loadingCardBackground: 'rgba(255,255,255,0.92)',
      loadingCardBorder: '1px solid rgba(148,163,184,0.18)',
      loadingDotBackground: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
      loadingDotShadow: '0 0 14px rgba(37,99,235,0.35)',
      loadingText: '#0f172a',
      loadingSubtext: '#64748b',
      errorCardBackground: 'rgba(255,255,255,0.94)',
      errorCardBorder: '1px solid rgba(248,113,113,0.24)',
      errorText: '#0f172a',
      contentText: '#334155',
      compactHeaderBg: 'rgba(255,255,255,0.88)',
      compactHeaderBorder: '1px solid rgba(148,163,184,0.18)',
      compactHeaderShadow: '0 2px 20px rgba(15,23,42,0.07)',
      headerBrandNameColor: '#0f172a',
      headerBrandSubColor: '#64748b',
      headerPageTitleColor: '#0f172a',
      headerCrumbColor: '#94a3b8',
      headerUserAvatarBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      headerUserAvatarText: '#ffffff',
      headerUserNameColor: '#0f172a',
      headerUserRoleColor: '#64748b',
      headerIconBtnBg: 'rgba(248,250,252,0.90)',
      headerIconBtnBorder: '1px solid rgba(148,163,184,0.18)',
      headerIconBtnColor: '#475569',
      headerIconBtnHoverBg: 'rgba(239,246,255,0.95)',
      headerSignOutBg: 'rgba(254,242,242,0.90)',
      headerSignOutBorder: '1px solid rgba(252,165,165,0.26)',
      headerSignOutColor: '#b91c1c',
      navGroupLabelColor: '#94a3b8',
      navDividerColor: 'rgba(148,163,184,0.14)',
      avatarRingColor: 'rgba(37,99,235,0.28)',
      profileStatBg: 'rgba(239,246,255,0.90)',
      profileStatBorder: '1px solid rgba(37,99,235,0.14)',
      profileStatLabel: '#2563eb',
      profileStatValue: '#0f172a',
    };
  }

  return {
    shellBackground:
      'radial-gradient(ellipse 80% 40% at 10% -10%, rgba(37,99,235,0.16), transparent 60%), ' +
      'radial-gradient(ellipse 60% 30% at 90% 110%, rgba(99,102,241,0.12), transparent 50%), ' +
      'linear-gradient(180deg, #050d1a 0%, #080f1e 50%, #060c18 100%)',
    shellColor: '#e5eefb',
    bodyBackground: '#050d1a',
    bodyColor: '#e5eefb',
    glowTop: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 68%)',
    glowBottom: 'radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 70%)',
    headerBackground: 'rgba(8, 16, 32, 0.82)',
    headerBorder: '1px solid rgba(148,163,184,0.12)',
    headerShadow: '0 4px 24px rgba(0,0,0,0.36)',
    brandEyebrow: '#60a5fa',
    brandTitle: '#f8fbff',
    brandAccent: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)',
    brandAccentShadow: '0 0 28px rgba(37,99,235,0.50)',
    metaBackground: 'rgba(8,16,34,0.68)',
    metaBorder: '1px solid rgba(148,163,184,0.12)',
    metaText: '#94a3b8',
    navButtonBackground: 'rgba(8,16,34,0.68)',
    navButtonBorder: '1px solid rgba(148,163,184,0.12)',
    navButtonText: '#94a3b8',
    navButtonActiveBackground: 'linear-gradient(135deg, rgba(29,78,216,0.95) 0%, rgba(59,130,246,0.90) 100%)',
    navButtonActiveBorder: '1px solid rgba(96,165,250,0.36)',
    navButtonActiveText: '#ffffff',
    navButtonActiveShadow: '0 8px 24px rgba(37,99,235,0.32)',
    panelBackground: 'rgba(8, 16, 32, 0.72)',
    panelBorder: '1px solid rgba(148,163,184,0.10)',
    panelShadow: '0 24px 64px rgba(0,0,0,0.50)',
    profileCardBackground: 'rgba(8,16,34,0.68)',
    profileCardBorder: '1px solid rgba(148,163,184,0.10)',
    profileCardLabel: '#60a5fa',
    profileCardValue: '#f8fafc',
    buttonPrimaryBackground: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    buttonPrimaryBorder: '1px solid rgba(96,165,250,0.32)',
    buttonPrimaryText: '#ffffff',
    buttonPrimaryShadow: '0 8px 24px rgba(37,99,235,0.36)',
    buttonSecondaryBackground: 'rgba(8,16,34,0.72)',
    buttonSecondaryBorder: '1px solid rgba(148,163,184,0.16)',
    buttonSecondaryText: '#e5eefb',
    loadingBackground:
      'radial-gradient(ellipse 70% 40% at 10% -5%, rgba(37,99,235,0.20), transparent 55%), ' +
      'linear-gradient(180deg, #050d1a 0%, #080f1e 100%)',
    loadingCardBackground: 'rgba(8,16,34,0.80)',
    loadingCardBorder: '1px solid rgba(148,163,184,0.12)',
    loadingDotBackground: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
    loadingDotShadow: '0 0 14px rgba(37,99,235,0.50)',
    loadingText: '#f8fbff',
    loadingSubtext: '#64748b',
    errorCardBackground: 'rgba(8,16,34,0.82)',
    errorCardBorder: '1px solid rgba(248,113,113,0.20)',
    errorText: '#f8fafc',
    contentText: '#e5eefb',
    compactHeaderBg: 'rgba(6, 12, 26, 0.86)',
    compactHeaderBorder: '1px solid rgba(148,163,184,0.10)',
    compactHeaderShadow: '0 2px 24px rgba(0,0,0,0.40)',
    headerBrandNameColor: '#f8fbff',
    headerBrandSubColor: '#64748b',
    headerPageTitleColor: '#e5eefb',
    headerCrumbColor: '#475569',
    headerUserAvatarBg: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
    headerUserAvatarText: '#ffffff',
    headerUserNameColor: '#e5eefb',
    headerUserRoleColor: '#64748b',
    headerIconBtnBg: 'rgba(15,23,42,0.70)',
    headerIconBtnBorder: '1px solid rgba(148,163,184,0.14)',
    headerIconBtnColor: '#94a3b8',
    headerIconBtnHoverBg: 'rgba(29,78,216,0.20)',
    headerSignOutBg: 'rgba(127,29,29,0.22)',
    headerSignOutBorder: '1px solid rgba(248,113,113,0.20)',
    headerSignOutColor: '#fca5a5',
    navGroupLabelColor: '#334155',
    navDividerColor: 'rgba(148,163,184,0.08)',
    avatarRingColor: 'rgba(59,130,246,0.36)',
    profileStatBg: 'rgba(29,78,216,0.14)',
    profileStatBorder: '1px solid rgba(96,165,250,0.18)',
    profileStatLabel: '#60a5fa',
    profileStatValue: '#f8fafc',
  };
}

/* ── CSS Variables ── */

const LIGHT_CSS_VARS = {
  '--da-page-text': '#334155',
  '--da-title': '#0f172a',
  '--da-muted-text': '#475569',
  '--da-subtle-text': '#64748b',
  '--da-eyebrow': '#3b82f6',
  '--da-section-eyebrow': '#2563eb',
  '--da-accent-text': '#2563eb',
  '--da-option-bg': '#ffffff',
  '--da-meta-bg': 'rgba(255,255,255,0.92)',
  '--da-meta-border': '1px solid rgba(148,163,184,0.22)',
  '--da-meta-text': '#475569',
  '--da-field-bg': 'rgba(255,255,255,0.96)',
  '--da-field-border': '1px solid rgba(148,163,184,0.22)',
  '--da-field-text': '#0f172a',
  '--da-secondary-bg': 'rgba(255,255,255,0.96)',
  '--da-secondary-border': '1px solid rgba(148,163,184,0.24)',
  '--da-secondary-text': '#334155',
  '--da-surface-bg': 'rgba(255,255,255,0.94)',
  '--da-card-bg': 'rgba(248,250,252,0.94)',
  '--da-menu-bg': 'rgba(255,255,255,0.98)',
  '--da-panel-bg': 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(244,247,255,0.92) 100%)',
  '--da-panel-border': '1px solid rgba(148,163,184,0.18)',
  '--da-panel-shadow': '0 18px 42px rgba(15,23,42,0.10)',
  '--da-card-label': '#64748b',
  '--da-card-value': '#0f172a',
  '--da-card-subtitle': '#94a3b8',
  '--da-row-bg': 'rgba(248,250,252,0.92)',
  '--da-row-border': '1px solid rgba(148,163,184,0.18)',
  '--da-row-title': '#0f172a',
  '--da-row-subtitle': '#64748b',
  '--da-rank-badge-bg': 'rgba(37,99,235,0.12)',
  '--da-rank-badge-text': '#2563eb',
  '--da-pill-bg': 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
  '--da-pill-text': '#1d4ed8',
  '--da-team-meta': '#475569',
  '--da-insight-title': '#2563eb',
  '--da-insight-body': '#475569',
  '--da-empty-bg': 'rgba(248,250,252,0.88)',
  '--da-empty-border': '1px dashed rgba(148,163,184,0.28)',
  '--da-empty-text': '#64748b',
  '--da-status-pill-bg': 'rgba(255,255,255,0.94)',
  '--da-status-pill-border': '1px solid rgba(148,163,184,0.22)',
  '--da-status-pill-text': '#475569',
  '--da-active-option-bg': 'rgba(191,219,254,0.92)',
  '--da-success-bg': 'rgba(240,253,244,0.98)',
  '--da-success-border': '1px solid rgba(74,222,128,0.28)',
  '--da-success-text': '#166534',
  '--da-warning-bg': 'rgba(255,247,237,0.98)',
  '--da-warning-border': '1px solid rgba(251,191,36,0.28)',
  '--da-warning-text': '#9a3412',
  '--da-error-bg': 'rgba(254,242,242,0.98)',
  '--da-error-border': '1px solid rgba(248,113,113,0.24)',
  '--da-error-text': '#b91c1c',
  '--da-widget-bg': 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,255,0.94) 100%)',
  '--da-widget-border': '1px solid rgba(148,163,184,0.2)',
  '--da-widget-title': '#0f172a',
  '--da-widget-subtitle': '#64748b',
  '--screen-field-bg': 'rgba(255,255,255,0.96)',
  '--screen-field-text': '#0f172a',
  '--screen-border': 'rgba(148,163,184,0.22)',
  '--screen-heading': '#0f172a',
  '--screen-muted': '#64748b',
  '--screen-select-option-bg': '#ffffff',
  '--screen-select-option-text': '#0f172a',
} as const;

const DARK_CSS_VARS = {
  '--da-page-text': '#e5eefb',
  '--da-title': '#f8fafc',
  '--da-muted-text': '#cbd5e1',
  '--da-subtle-text': '#94a3b8',
  '--da-eyebrow': '#60a5fa',
  '--da-section-eyebrow': '#93c5fd',
  '--da-accent-text': '#93c5fd',
  '--da-option-bg': '#0d1a30',
  '--da-meta-bg': 'rgba(8,16,34,0.68)',
  '--da-meta-border': '1px solid rgba(148,163,184,0.12)',
  '--da-meta-text': '#94a3b8',
  '--da-field-bg': 'rgba(8,16,34,0.80)',
  '--da-field-border': '1px solid rgba(148,163,184,0.14)',
  '--da-field-text': '#e5eefb',
  '--da-secondary-bg': 'rgba(8,16,34,0.72)',
  '--da-secondary-border': '1px solid rgba(148,163,184,0.14)',
  '--da-secondary-text': '#e5eefb',
  '--da-surface-bg': 'rgba(8,16,34,0.68)',
  '--da-card-bg': 'rgba(8,16,34,0.56)',
  '--da-menu-bg': 'rgba(6,12,26,0.98)',
  '--da-panel-bg': 'linear-gradient(180deg, rgba(8,16,34,0.88) 0%, rgba(8,16,34,0.72) 100%)',
  '--da-panel-border': '1px solid rgba(148,163,184,0.10)',
  '--da-panel-shadow': '0 20px 48px rgba(0,0,0,0.46)',
  '--da-card-label': '#64748b',
  '--da-card-value': '#f8fafc',
  '--da-card-subtitle': '#475569',
  '--da-row-bg': 'rgba(8,16,34,0.56)',
  '--da-row-border': '1px solid rgba(148,163,184,0.10)',
  '--da-row-title': '#f8fafc',
  '--da-row-subtitle': '#64748b',
  '--da-rank-badge-bg': 'rgba(29,78,216,0.22)',
  '--da-rank-badge-text': '#93c5fd',
  '--da-pill-bg': 'linear-gradient(135deg, #0f4c81 0%, #2563eb 100%)',
  '--da-pill-text': '#ffffff',
  '--da-team-meta': '#94a3b8',
  '--da-insight-title': '#60a5fa',
  '--da-insight-body': '#94a3b8',
  '--da-empty-bg': 'rgba(8,16,34,0.56)',
  '--da-empty-border': '1px dashed rgba(148,163,184,0.16)',
  '--da-empty-text': '#64748b',
  '--da-status-pill-bg': 'rgba(8,16,34,0.68)',
  '--da-status-pill-border': '1px solid rgba(148,163,184,0.12)',
  '--da-status-pill-text': '#94a3b8',
  '--da-active-option-bg': 'rgba(29,78,216,0.28)',
  '--da-success-bg': 'rgba(22,101,52,0.18)',
  '--da-success-border': '1px solid rgba(74,222,128,0.20)',
  '--da-success-text': '#bbf7d0',
  '--da-warning-bg': 'rgba(120,53,15,0.22)',
  '--da-warning-border': '1px solid rgba(251,191,36,0.22)',
  '--da-warning-text': '#fde68a',
  '--da-error-bg': 'rgba(127,29,29,0.24)',
  '--da-error-border': '1px solid rgba(248,113,113,0.20)',
  '--da-error-text': '#fecaca',
  '--da-widget-bg': 'linear-gradient(180deg, rgba(8,16,34,0.94) 0%, rgba(8,16,34,0.82) 100%)',
  '--da-widget-border': '1px solid rgba(96,165,250,0.18)',
  '--da-widget-title': '#f8fafc',
  '--da-widget-subtitle': '#64748b',
  '--screen-field-bg': 'rgba(8,16,34,0.80)',
  '--screen-field-text': '#e5eefb',
  '--screen-border': 'rgba(148,163,184,0.14)',
  '--screen-heading': '#f8fafc',
  '--screen-muted': '#94a3b8',
  '--screen-select-option-bg': '#0d1a30',
  '--screen-select-option-text': '#e5eefb',
} as const;

export type CssVarName = keyof typeof LIGHT_CSS_VARS;

export function applyThemeCssVariables(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const vars = mode === 'light' ? LIGHT_CSS_VARS : DARK_CSS_VARS;
  const style = document.documentElement.style;
  Object.entries(vars).forEach(([key, value]) => {
    style.setProperty(key, value);
  });
}

/* ── createStyles ── */

export function createStyles(theme: ThemePalette, mode: ThemeMode) {
  const isLight = mode === 'light';

  const secondaryButtonBase: CSSProperties = {
    padding: '9px 16px',
    borderRadius: '10px',
    border: theme.buttonSecondaryBorder,
    background: theme.buttonSecondaryBackground,
    color: theme.buttonSecondaryText,
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
  };

  const primaryButtonBase: CSSProperties = {
    padding: '9px 16px',
    borderRadius: '10px',
    border: theme.buttonPrimaryBorder,
    background: theme.buttonPrimaryBackground,
    color: theme.buttonPrimaryText,
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    boxShadow: theme.buttonPrimaryShadow,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease',
  };

  return {
    appShell: {
      minHeight: '100vh',
      background: theme.shellBackground,
      color: theme.shellColor,
      position: 'relative',
    } as CSSProperties,

    backgroundGlowTop: {
      position: 'fixed',
      top: '-80px',
      right: '-80px',
      width: '400px',
      height: '400px',
      background: theme.glowTop,
      pointerEvents: 'none',
      zIndex: 0,
    } as CSSProperties,

    backgroundGlowBottom: {
      position: 'fixed',
      bottom: '-180px',
      left: '-100px',
      width: '420px',
      height: '420px',
      background: theme.glowBottom,
      pointerEvents: 'none',
      zIndex: 0,
    } as CSSProperties,

    headerShell: {
      position: 'sticky',
      top: 0,
      zIndex: 50,
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '0 20px',
      background: theme.compactHeaderBg,
      borderBottom: theme.compactHeaderBorder,
      boxShadow: theme.compactHeaderShadow,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    } as CSSProperties,

    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      minWidth: 0,
      flexShrink: 0,
    } as CSSProperties,

    headerLogoMark: {
      width: '36px',
      height: '36px',
      borderRadius: '10px',
      background: isLight
        ? 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(239,246,255,0.90) 100%)'
        : 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
      border: theme.metaBorder,
      display: 'grid',
      placeItems: 'center',
      padding: '4px',
      flexShrink: 0,
    } as CSSProperties,

    headerBrandName: {
      fontSize: '15px',
      fontWeight: 700,
      color: theme.headerBrandNameColor,
      letterSpacing: '-0.01em',
      lineHeight: 1.2,
      fontFamily: "'Syne', sans-serif",
    } as CSSProperties,

    headerBrandSub: {
      fontSize: '11px',
      fontWeight: 500,
      color: theme.headerBrandSubColor,
      letterSpacing: '0.04em',
      lineHeight: 1,
    } as CSSProperties,

    headerCenter: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
    } as CSSProperties,

    headerCrumb: {
      fontSize: '13px',
      color: theme.headerCrumbColor,
      fontWeight: 500,
    } as CSSProperties,

    headerCrumbSep: {
      fontSize: '13px',
      color: theme.headerCrumbColor,
      opacity: 0.5,
    } as CSSProperties,

    headerPageTitle: {
      fontSize: '13px',
      fontWeight: 700,
      color: theme.headerPageTitleColor,
      letterSpacing: '-0.01em',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '200px',
    } as CSSProperties,

    headerActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexShrink: 0,
    } as CSSProperties,

    headerUserBadge: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '5px 10px 5px 5px',
      borderRadius: '999px',
      border: theme.metaBorder,
      background: theme.metaBackground,
      cursor: 'default',
    } as CSSProperties,

    headerUserAvatar: {
      width: '28px',
      height: '28px',
      borderRadius: '50%',
      background: theme.headerUserAvatarBg,
      color: theme.headerUserAvatarText,
      display: 'grid',
      placeItems: 'center',
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.02em',
      flexShrink: 0,
      boxShadow: `0 0 0 2px ${theme.avatarRingColor}`,
    } as CSSProperties,

    headerUserName: {
      fontSize: '13px',
      fontWeight: 600,
      color: theme.headerUserNameColor,
      lineHeight: 1.2,
    } as CSSProperties,

    headerUserRole: {
      fontSize: '10px',
      fontWeight: 500,
      color: theme.headerUserRoleColor,
      textTransform: 'capitalize' as const,
      lineHeight: 1,
    } as CSSProperties,

    headerThemeBtn: {
      ...secondaryButtonBase,
      padding: '7px 12px',
      borderRadius: '8px',
      background: theme.headerIconBtnBg,
      border: theme.headerIconBtnBorder,
      color: theme.headerIconBtnColor,
      fontSize: '12px',
    } as CSSProperties,

    headerLogoutBtn: {
      ...secondaryButtonBase,
      padding: '7px 12px',
      borderRadius: '8px',
      background: theme.headerSignOutBg,
      border: theme.headerSignOutBorder,
      color: theme.headerSignOutColor,
      fontSize: '12px',
      fontWeight: 700,
    } as CSSProperties,

    metaStrip: { display: 'flex', gap: '8px', flexWrap: 'wrap' as const } as CSSProperties,
    metaPill: {
      padding: '6px 12px',
      borderRadius: '999px',
      border: theme.metaBorder,
      backgroundColor: theme.metaBackground,
      color: theme.metaText,
      fontSize: '12px',
      fontWeight: 600,
      backdropFilter: 'blur(14px)',
    } as CSSProperties,

    themeButton: { ...secondaryButtonBase } as CSSProperties,
    logoutButton: { ...primaryButtonBase } as CSSProperties,

    contentShell: {
      position: 'relative',
      zIndex: 1,
      padding: '20px 20px 28px',
    } as CSSProperties,

    contentInner: {
      minHeight: 'calc(100vh - 180px)',
      width: '100%',
      padding: '28px',
      borderRadius: '20px',
      border: theme.panelBorder,
      background: theme.panelBackground,
      boxShadow: theme.panelShadow,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      color: theme.contentText,
    } as CSSProperties,

    workspaceShell: {
      display: 'grid',
      gridTemplateColumns: '300px minmax(0, 1fr)',
      gap: '20px',
      alignItems: 'start',
    } as CSSProperties,

    sidebarPanel: {
      position: 'sticky',
      top: '80px',
      borderRadius: '20px',
      border: theme.panelBorder,
      background: theme.panelBackground,
      boxShadow: theme.panelShadow,
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      padding: '16px',
      display: 'grid',
      gap: '8px',
    } as CSSProperties,

    sidebarTitle: {
      color: theme.brandEyebrow,
      fontSize: '10px',
      fontWeight: 800,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.18em',
      marginBottom: '2px',
    } as CSSProperties,

    sidebarText: {
      color: theme.metaText,
      fontSize: '13px',
      lineHeight: 1.5,
      margin: 0,
    } as CSSProperties,

    navGroupLabel: {
      fontSize: '10px',
      fontWeight: 800,
      letterSpacing: '0.14em',
      textTransform: 'uppercase' as const,
      color: theme.navGroupLabelColor,
      padding: '6px 12px 2px',
    } as CSSProperties,

    navDivider: {
      height: '1px',
      background: theme.navDividerColor,
      margin: '4px 0',
    } as CSSProperties,

    navShell: {
      position: 'relative',
      zIndex: 1,
      marginTop: '0',
      marginBottom: '16px',
    } as CSSProperties,

    navScroller: {
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      padding: '4px 2px 8px 2px',
      scrollbarWidth: 'none' as const,
      msOverflowStyle: 'none' as const,
    } as CSSProperties,

    navButton: {
      padding: '10px 14px',
      borderRadius: '10px',
      border: theme.navButtonBorder,
      background: theme.navButtonBackground,
      color: theme.navButtonText,
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '13px',
      whiteSpace: 'nowrap' as const,
      transition: 'all 0.18s ease',
      backdropFilter: 'blur(14px)',
    } as CSSProperties,

    activeNavButton: {
      background: theme.navButtonActiveBackground,
      color: theme.navButtonActiveText,
      border: theme.navButtonActiveBorder,
      boxShadow: theme.navButtonActiveShadow,
    } as CSSProperties,

    profilePanel: {
      borderRadius: '20px',
      border: theme.panelBorder,
      background: theme.panelBackground,
      padding: '28px',
    } as CSSProperties,

    sectionEyebrow: {
      color: theme.brandEyebrow,
      fontSize: '11px',
      fontWeight: 800,
      letterSpacing: '0.18em',
      textTransform: 'uppercase' as const,
      marginBottom: '10px',
    } as CSSProperties,

    profileGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '12px',
    } as CSSProperties,

    profileInfoCard: {
      borderRadius: '16px',
      padding: '18px 20px',
      border: theme.profileStatBorder,
      background: theme.profileStatBg,
      transition: 'transform 0.16s ease',
    } as CSSProperties,

    profileInfoLabel: {
      fontSize: '11px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.14em',
      color: theme.profileStatLabel,
      marginBottom: '8px',
      fontWeight: 700,
    } as CSSProperties,

    profileInfoValue: {
      fontSize: '15px',
      fontWeight: 700,
      color: theme.profileStatValue,
      wordBreak: 'break-word' as const,
      fontFamily: "'JetBrains Mono', monospace",
    } as CSSProperties,

    brandWrap: { display: 'flex', gap: '14px', alignItems: 'center', minWidth: 0 } as CSSProperties,

    brandLogoWrap: {
      width: '54px',
      height: '54px',
      borderRadius: '16px',
      border: theme.metaBorder,
      background: theme.metaBackground,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '8px',
      flexShrink: 0,
    } as CSSProperties,

    brandLogo: {
      width: '36px',
      height: '36px',
      objectFit: 'contain' as const,
    } as CSSProperties,

    brandAccent: {
      width: '4px',
      height: '54px',
      borderRadius: '999px',
      background: theme.brandAccent,
      boxShadow: theme.brandAccentShadow,
      flexShrink: 0,
    } as CSSProperties,

    brandEyebrow: {
      color: theme.brandEyebrow,
      fontSize: '11px',
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.16em',
      marginBottom: '6px',
    } as CSSProperties,

    brandTitle: {
      margin: 0,
      fontSize: '32px',
      lineHeight: 1.05,
      fontWeight: 800,
      color: theme.brandTitle,
      fontFamily: "'Syne', sans-serif",
    } as CSSProperties,

    loadingShell: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: theme.loadingBackground,
      padding: '24px',
      color: theme.loadingText,
    } as CSSProperties,

    loadingCard: {
      width: '100%',
      maxWidth: '440px',
      borderRadius: '24px',
      border: theme.loadingCardBorder,
      background: theme.loadingCardBackground,
      padding: '40px 36px',
      textAlign: 'center',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      animation: 'da-fade-in-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
    } as CSSProperties,

    loadingBrandMark: {
      width: '72px',
      height: '72px',
      margin: '0 auto 20px auto',
      objectFit: 'contain' as const,
      animation: 'da-logo-glow 2.4s ease-in-out infinite',
    } as CSSProperties,

    loadingDot: {
      width: '9px',
      height: '9px',
      borderRadius: '50%',
      background: theme.loadingDotBackground,
      boxShadow: theme.loadingDotShadow,
      display: 'inline-block',
    } as CSSProperties,

    loadingSubtext: { margin: '0 0 20px 0', color: theme.loadingSubtext, fontSize: '14px' } as CSSProperties,

    errorCard: {
      width: '100%',
      maxWidth: '560px',
      borderRadius: '24px',
      border: theme.errorCardBorder,
      background: theme.errorCardBackground,
      padding: '36px',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      color: theme.errorText,
    } as CSSProperties,

    secondaryButtonBase,
    primaryButtonBase,
  };
}