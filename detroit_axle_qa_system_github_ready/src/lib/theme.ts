import type { CSSProperties } from 'react';

export type ThemeMode = 'dark' | 'light';

export type ThemePalette = {
  shellBackground: string;
  shellColor: string;
  bodyBackground: string;
  bodyColor: string;
  headerBackground: string;
  headerBorder: string;
  headerShadow: string;
  brandEyebrow: string;
  brandTitle: string;
  brandAccent: string;
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

// ── Theme detection ──────────────────────────────────────────

export function isThemeMode(value: string): value is ThemeMode {
  return value === 'dark' || value === 'light';
}

export function readStoredTheme(): ThemeMode {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('da-theme-mode');
      if (stored && isThemeMode(stored)) return stored;
    } catch { /* ignore */ }
    if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  }
  return 'dark';
}

// ── Palettes ─────────────────────────────────────────────────
//
// Claude-aesthetic: calm neutrals, warm blacks/whites,
// teal (#2A9D8F) as the single accent.
// No gradients on backgrounds; depth via layered borders
// and very subtle box-shadows.

export function getThemePalette(mode: ThemeMode): ThemePalette {
  if (mode === 'light') {
    return {
      // Shell
      shellBackground: '#F7F7F5',
      shellColor: '#1A1A1A',
      bodyBackground: '#F7F7F5',
      bodyColor: '#1A1A1A',

      // Header
      headerBackground: 'rgba(255,255,255,0.90)',
      headerBorder: '1px solid rgba(0,0,0,0.07)',
      headerShadow: '0 1px 0 rgba(0,0,0,0.06)',

      // Brand
      brandEyebrow: '#2A9D8F',
      brandTitle: '#1A1A1A',
      brandAccent: '#2A9D8F',

      // Meta / pill surfaces
      metaBackground: 'rgba(255,255,255,0.88)',
      metaBorder: '1px solid rgba(0,0,0,0.08)',
      metaText: '#555555',

      // Nav
      navButtonBackground: 'rgba(255,255,255,0.85)',
      navButtonBorder: '1px solid rgba(0,0,0,0.08)',
      navButtonText: '#555555',
      navButtonActiveBackground: '#2A9D8F',
      navButtonActiveBorder: '1px solid rgba(42,157,143,0.35)',
      navButtonActiveText: '#ffffff',
      navButtonActiveShadow: '0 4px 14px rgba(42,157,143,0.22)',

      // Panels
      panelBackground: 'rgba(255,255,255,0.85)',
      panelBorder: '1px solid rgba(0,0,0,0.07)',
      panelShadow: '0 4px 20px rgba(0,0,0,0.07)',

      // Profile card
      profileCardBackground: '#FFFFFF',
      profileCardBorder: '1px solid rgba(0,0,0,0.08)',
      profileCardLabel: '#2A9D8F',
      profileCardValue: '#1A1A1A',

      // Primary button
      buttonPrimaryBackground: '#2A9D8F',
      buttonPrimaryBorder: '1px solid rgba(42,157,143,0.30)',
      buttonPrimaryText: '#ffffff',
      buttonPrimaryShadow: '0 4px 12px rgba(42,157,143,0.22)',

      // Secondary button
      buttonSecondaryBackground: 'rgba(255,255,255,0.90)',
      buttonSecondaryBorder: '1px solid rgba(0,0,0,0.10)',
      buttonSecondaryText: '#3A3A3A',

      // Loading
      loadingBackground: '#F7F7F5',
      loadingCardBackground: '#FFFFFF',
      loadingCardBorder: '1px solid rgba(0,0,0,0.08)',
      loadingDotBackground: '#2A9D8F',
      loadingDotShadow: '0 0 10px rgba(42,157,143,0.30)',
      loadingText: '#1A1A1A',
      loadingSubtext: '#888888',

      // Error
      errorCardBackground: '#FFFFFF',
      errorCardBorder: '1px solid rgba(229,115,115,0.22)',
      errorText: '#1A1A1A',

      // Content
      contentText: '#3A3A3A',

      // Compact header
      compactHeaderBg: 'rgba(255,255,255,0.90)',
      compactHeaderBorder: '1px solid rgba(0,0,0,0.07)',
      compactHeaderShadow: '0 1px 0 rgba(0,0,0,0.06)',

      // Header internals
      headerBrandNameColor: '#1A1A1A',
      headerBrandSubColor: '#888888',
      headerPageTitleColor: '#1A1A1A',
      headerCrumbColor: '#ADADAD',
      headerUserAvatarBg: '#2A9D8F',
      headerUserAvatarText: '#ffffff',
      headerUserNameColor: '#1A1A1A',
      headerUserRoleColor: '#888888',
      headerIconBtnBg: 'rgba(0,0,0,0.03)',
      headerIconBtnBorder: '1px solid rgba(0,0,0,0.08)',
      headerIconBtnColor: '#6B6B6B',
      headerIconBtnHoverBg: 'rgba(42,157,143,0.08)',
      headerSignOutBg: 'rgba(229,115,115,0.06)',
      headerSignOutBorder: '1px solid rgba(229,115,115,0.18)',
      headerSignOutColor: '#C0392B',

      // Sidebar nav
      navGroupLabelColor: '#ADADAD',
      navDividerColor: 'rgba(0,0,0,0.06)',

      // Avatar ring
      avatarRingColor: 'rgba(42,157,143,0.25)',

      // Profile stats
      profileStatBg: 'rgba(42,157,143,0.06)',
      profileStatBorder: '1px solid rgba(42,157,143,0.14)',
      profileStatLabel: '#2A9D8F',
      profileStatValue: '#1A1A1A',
    };
  }

  // ── Dark palette ──
  return {
    shellBackground: '#1A1A1A',
    shellColor: '#ECECEC',
    bodyBackground: '#1A1A1A',
    bodyColor: '#ECECEC',

    headerBackground: 'rgba(26,26,26,0.92)',
    headerBorder: '1px solid rgba(255,255,255,0.07)',
    headerShadow: '0 1px 0 rgba(0,0,0,0.40)',

    brandEyebrow: '#3BBCAD',
    brandTitle: '#ECECEC',
    brandAccent: '#2A9D8F',

    metaBackground: 'rgba(255,255,255,0.05)',
    metaBorder: '1px solid rgba(255,255,255,0.08)',
    metaText: '#888888',

    navButtonBackground: 'rgba(255,255,255,0.05)',
    navButtonBorder: '1px solid rgba(255,255,255,0.08)',
    navButtonText: '#888888',
    navButtonActiveBackground: '#2A9D8F',
    navButtonActiveBorder: '1px solid rgba(42,157,143,0.40)',
    navButtonActiveText: '#ffffff',
    navButtonActiveShadow: '0 4px 14px rgba(42,157,143,0.28)',

    panelBackground: 'rgba(33,33,33,0.85)',
    panelBorder: '1px solid rgba(255,255,255,0.08)',
    panelShadow: '0 4px 24px rgba(0,0,0,0.45)',

    profileCardBackground: 'rgba(42,42,42,0.80)',
    profileCardBorder: '1px solid rgba(255,255,255,0.08)',
    profileCardLabel: '#3BBCAD',
    profileCardValue: '#ECECEC',

    buttonPrimaryBackground: '#2A9D8F',
    buttonPrimaryBorder: '1px solid rgba(42,157,143,0.35)',
    buttonPrimaryText: '#ffffff',
    buttonPrimaryShadow: '0 4px 14px rgba(42,157,143,0.28)',

    buttonSecondaryBackground: 'rgba(255,255,255,0.06)',
    buttonSecondaryBorder: '1px solid rgba(255,255,255,0.10)',
    buttonSecondaryText: '#C8C8C8',

    loadingBackground: '#1A1A1A',
    loadingCardBackground: 'rgba(33,33,33,0.90)',
    loadingCardBorder: '1px solid rgba(255,255,255,0.08)',
    loadingDotBackground: '#2A9D8F',
    loadingDotShadow: '0 0 12px rgba(42,157,143,0.40)',
    loadingText: '#ECECEC',
    loadingSubtext: '#888888',

    errorCardBackground: 'rgba(33,33,33,0.90)',
    errorCardBorder: '1px solid rgba(229,115,115,0.20)',
    errorText: '#ECECEC',

    contentText: '#C8C8C8',

    compactHeaderBg: 'rgba(26,26,26,0.92)',
    compactHeaderBorder: '1px solid rgba(255,255,255,0.07)',
    compactHeaderShadow: '0 1px 0 rgba(0,0,0,0.40)',

    headerBrandNameColor: '#ECECEC',
    headerBrandSubColor: '#888888',
    headerPageTitleColor: '#ECECEC',
    headerCrumbColor: '#555555',
    headerUserAvatarBg: '#2A9D8F',
    headerUserAvatarText: '#ffffff',
    headerUserNameColor: '#ECECEC',
    headerUserRoleColor: '#888888',
    headerIconBtnBg: 'rgba(255,255,255,0.04)',
    headerIconBtnBorder: '1px solid rgba(255,255,255,0.08)',
    headerIconBtnColor: '#888888',
    headerIconBtnHoverBg: 'rgba(42,157,143,0.12)',
    headerSignOutBg: 'rgba(229,115,115,0.08)',
    headerSignOutBorder: '1px solid rgba(229,115,115,0.18)',
    headerSignOutColor: '#E57373',

    navGroupLabelColor: '#555555',
    navDividerColor: 'rgba(255,255,255,0.06)',

    avatarRingColor: 'rgba(42,157,143,0.30)',

    profileStatBg: 'rgba(42,157,143,0.10)',
    profileStatBorder: '1px solid rgba(42,157,143,0.20)',
    profileStatLabel: '#3BBCAD',
    profileStatValue: '#ECECEC',
  };
}

// ── CSS Variables ────────────────────────────────────────────
//
// Applied to <html> so every CSS rule inheriting from :root
// picks up the theme without class toggling.

const LIGHT_CSS_VARS = {
  '--da-page-text':    '#3A3A3A',
  '--da-title':        '#1A1A1A',
  '--da-muted-text':   '#555555',
  '--da-subtle-text':  '#888888',
  '--da-eyebrow':      '#2A9D8F',
  '--da-section-eyebrow': '#2A9D8F',
  '--da-accent-text':  '#2A9D8F',

  '--da-option-bg':     '#FFFFFF',
  '--da-meta-bg':       'rgba(255,255,255,0.90)',
  '--da-meta-border':   '1px solid rgba(0,0,0,0.08)',
  '--da-meta-text':     '#555555',

  '--da-field-bg':      '#FFFFFF',
  '--da-field-border':  '1px solid rgba(0,0,0,0.10)',
  '--da-field-text':    '#1A1A1A',

  '--da-secondary-bg':     '#FFFFFF',
  '--da-secondary-border': '1px solid rgba(0,0,0,0.10)',
  '--da-secondary-text':   '#3A3A3A',

  '--da-surface-bg':  'rgba(255,255,255,0.90)',
  '--da-card-bg':     'rgba(248,248,246,0.92)',
  '--da-menu-bg':     'rgba(255,255,255,0.98)',

  '--da-panel-bg':     'rgba(255,255,255,0.88)',
  '--da-panel-border': '1px solid rgba(0,0,0,0.07)',
  '--da-panel-shadow': '0 4px 20px rgba(0,0,0,0.07)',

  '--da-card-label':    '#888888',
  '--da-card-value':    '#1A1A1A',
  '--da-card-subtitle': '#ADADAD',

  '--da-row-bg':       'rgba(248,248,246,0.90)',
  '--da-row-border':   '1px solid rgba(0,0,0,0.07)',
  '--da-row-title':    '#1A1A1A',
  '--da-row-subtitle': '#888888',

  '--da-rank-badge-bg':   'rgba(42,157,143,0.10)',
  '--da-rank-badge-text': '#2A9D8F',

  '--da-pill-bg':   'rgba(42,157,143,0.10)',
  '--da-pill-text': '#2A9D8F',

  '--da-team-meta':    '#555555',
  '--da-insight-title':'#2A9D8F',
  '--da-insight-body': '#555555',

  '--da-empty-bg':     'rgba(248,248,246,0.88)',
  '--da-empty-border': '1px dashed rgba(0,0,0,0.12)',
  '--da-empty-text':   '#888888',

  '--da-status-pill-bg':     'rgba(255,255,255,0.90)',
  '--da-status-pill-border': '1px solid rgba(0,0,0,0.10)',
  '--da-status-pill-text':   '#555555',

  '--da-active-option-bg': 'rgba(42,157,143,0.10)',

  '--da-success-bg':     'rgba(52,169,143,0.08)',
  '--da-success-border': '1px solid rgba(52,169,143,0.22)',
  '--da-success-text':   '#167a67',

  '--da-warning-bg':     'rgba(233,168,76,0.08)',
  '--da-warning-border': '1px solid rgba(233,168,76,0.22)',
  '--da-warning-text':   '#9a6600',

  '--da-error-bg':     'rgba(229,115,115,0.07)',
  '--da-error-border': '1px solid rgba(229,115,115,0.20)',
  '--da-error-text':   '#C0392B',

  '--da-widget-bg':       'rgba(255,255,255,0.92)',
  '--da-widget-border':   '1px solid rgba(0,0,0,0.08)',
  '--da-widget-title':    '#1A1A1A',
  '--da-widget-subtitle': '#888888',

  '--screen-field-bg':          '#FFFFFF',
  '--screen-field-text':        '#1A1A1A',
  '--screen-border':            'rgba(0,0,0,0.10)',
  '--screen-heading':           '#1A1A1A',
  '--screen-muted':             '#888888',
  '--screen-select-option-bg':  '#FFFFFF',
  '--screen-select-option-text':'#1A1A1A',
} as const;

const DARK_CSS_VARS = {
  '--da-page-text':    '#C8C8C8',
  '--da-title':        '#ECECEC',
  '--da-muted-text':   '#ADADAD',
  '--da-subtle-text':  '#888888',
  '--da-eyebrow':      '#3BBCAD',
  '--da-section-eyebrow': '#3BBCAD',
  '--da-accent-text':  '#3BBCAD',

  '--da-option-bg':     '#212121',
  '--da-meta-bg':       'rgba(255,255,255,0.05)',
  '--da-meta-border':   '1px solid rgba(255,255,255,0.08)',
  '--da-meta-text':     '#888888',

  '--da-field-bg':      'rgba(255,255,255,0.06)',
  '--da-field-border':  '1px solid rgba(255,255,255,0.09)',
  '--da-field-text':    '#ECECEC',

  '--da-secondary-bg':     'rgba(255,255,255,0.05)',
  '--da-secondary-border': '1px solid rgba(255,255,255,0.09)',
  '--da-secondary-text':   '#C8C8C8',

  '--da-surface-bg':  'rgba(255,255,255,0.05)',
  '--da-card-bg':     'rgba(255,255,255,0.04)',
  '--da-menu-bg':     'rgba(26,26,26,0.98)',

  '--da-panel-bg':     'rgba(33,33,33,0.85)',
  '--da-panel-border': '1px solid rgba(255,255,255,0.08)',
  '--da-panel-shadow': '0 4px 24px rgba(0,0,0,0.45)',

  '--da-card-label':    '#555555',
  '--da-card-value':    '#ECECEC',
  '--da-card-subtitle': '#555555',

  '--da-row-bg':       'rgba(255,255,255,0.04)',
  '--da-row-border':   '1px solid rgba(255,255,255,0.07)',
  '--da-row-title':    '#ECECEC',
  '--da-row-subtitle': '#888888',

  '--da-rank-badge-bg':   'rgba(42,157,143,0.15)',
  '--da-rank-badge-text': '#3BBCAD',

  '--da-pill-bg':   'rgba(42,157,143,0.14)',
  '--da-pill-text': '#3BBCAD',

  '--da-team-meta':    '#888888',
  '--da-insight-title':'#3BBCAD',
  '--da-insight-body': '#888888',

  '--da-empty-bg':     'rgba(255,255,255,0.04)',
  '--da-empty-border': '1px dashed rgba(255,255,255,0.10)',
  '--da-empty-text':   '#555555',

  '--da-status-pill-bg':     'rgba(255,255,255,0.05)',
  '--da-status-pill-border': '1px solid rgba(255,255,255,0.09)',
  '--da-status-pill-text':   '#888888',

  '--da-active-option-bg': 'rgba(42,157,143,0.15)',

  '--da-success-bg':     'rgba(52,169,143,0.12)',
  '--da-success-border': '1px solid rgba(52,169,143,0.22)',
  '--da-success-text':   '#7EDECF',

  '--da-warning-bg':     'rgba(233,168,76,0.12)',
  '--da-warning-border': '1px solid rgba(233,168,76,0.22)',
  '--da-warning-text':   '#F5C97B',

  '--da-error-bg':     'rgba(229,115,115,0.10)',
  '--da-error-border': '1px solid rgba(229,115,115,0.18)',
  '--da-error-text':   '#E57373',

  '--da-widget-bg':       'rgba(33,33,33,0.90)',
  '--da-widget-border':   '1px solid rgba(42,157,143,0.18)',
  '--da-widget-title':    '#ECECEC',
  '--da-widget-subtitle': '#888888',

  '--screen-field-bg':          'rgba(255,255,255,0.06)',
  '--screen-field-text':        '#ECECEC',
  '--screen-border':            'rgba(255,255,255,0.09)',
  '--screen-heading':           '#ECECEC',
  '--screen-muted':             '#888888',
  '--screen-select-option-bg':  '#212121',
  '--screen-select-option-text':'#ECECEC',
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

// ── createStyles ─────────────────────────────────────────────

export function createStyles(theme: ThemePalette, _mode: ThemeMode) {
  const secondaryButtonBase: CSSProperties = {
    padding: '8px 14px',
    borderRadius: '8px',
    border: theme.buttonSecondaryBorder,
    background: theme.buttonSecondaryBackground,
    color: theme.buttonSecondaryText,
    fontWeight: 600,
    fontSize: '13px',
    fontFamily: "'Inter', system-ui, sans-serif",
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
  };

  const primaryButtonBase: CSSProperties = {
    padding: '8px 14px',
    borderRadius: '8px',
    border: theme.buttonPrimaryBorder,
    background: theme.buttonPrimaryBackground,
    color: theme.buttonPrimaryText,
    fontWeight: 600,
    fontSize: '13px',
    fontFamily: "'Inter', system-ui, sans-serif",
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    boxShadow: theme.buttonPrimaryShadow,
    transition: 'filter 0.12s ease, box-shadow 0.12s ease',
  };

  return {
    appShell: {
      minHeight: '100vh',
      background: theme.shellBackground,
      color: theme.shellColor,
      position: 'relative',
    } as CSSProperties,

    // No decorative glows — Claude aesthetic is clean
    backgroundGlowTop:    { display: 'none' } as CSSProperties,
    backgroundGlowBottom: { display: 'none' } as CSSProperties,

    headerShell: {
      position: 'sticky',
      top: 0,
      zIndex: 50,
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '0 20px',
      background: theme.compactHeaderBg,
      borderBottom: theme.compactHeaderBorder,
      boxShadow: theme.compactHeaderShadow,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    } as CSSProperties,

    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minWidth: 0,
      flexShrink: 0,
    } as CSSProperties,

    headerLogoMark: {
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      background: 'rgba(42,157,143,0.10)',
      border: '1px solid rgba(42,157,143,0.20)',
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0,
    } as CSSProperties,

    headerBrandName: {
      fontSize: '13px',
      fontWeight: 600,
      color: theme.headerBrandNameColor,
      letterSpacing: '-0.012em',
      lineHeight: 1.2,
      fontFamily: "'Inter', system-ui, sans-serif",
    } as CSSProperties,

    headerBrandSub: {
      fontSize: '10px',
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
      fontFamily: "'Inter', system-ui, sans-serif",
    } as CSSProperties,

    headerCrumbSep: {
      fontSize: '12px',
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
      fontFamily: "'Inter', system-ui, sans-serif",
    } as CSSProperties,

    headerActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      flexShrink: 0,
    } as CSSProperties,

    headerUserBadge: {
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      padding: '4px 8px 4px 4px',
      borderRadius: '8px',
      border: theme.metaBorder,
      background: theme.metaBackground,
      cursor: 'default',
    } as CSSProperties,

    headerUserAvatar: {
      width: '24px',
      height: '24px',
      borderRadius: '6px',
      background: theme.headerUserAvatarBg,
      color: theme.headerUserAvatarText,
      display: 'grid',
      placeItems: 'center',
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.02em',
      flexShrink: 0,
    } as CSSProperties,

    headerUserName: {
      fontSize: '12px',
      fontWeight: 600,
      color: theme.headerUserNameColor,
      lineHeight: 1.2,
      fontFamily: "'Inter', system-ui, sans-serif",
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
      padding: '6px 10px',
      borderRadius: '7px',
      background: theme.headerIconBtnBg,
      border: theme.headerIconBtnBorder,
      color: theme.headerIconBtnColor,
      fontSize: '12px',
    } as CSSProperties,

    headerLogoutBtn: {
      ...secondaryButtonBase,
      padding: '6px 10px',
      borderRadius: '7px',
      background: theme.headerSignOutBg,
      border: theme.headerSignOutBorder,
      color: theme.headerSignOutColor,
      fontSize: '12px',
    } as CSSProperties,

    metaStrip: { display: 'flex', gap: '6px', flexWrap: 'wrap' as const } as CSSProperties,
    metaPill: {
      padding: '5px 10px',
      borderRadius: '999px',
      border: theme.metaBorder,
      backgroundColor: theme.metaBackground,
      color: theme.metaText,
      fontSize: '12px',
      fontWeight: 500,
      fontFamily: "'Inter', system-ui, sans-serif",
    } as CSSProperties,

    themeButton:  { ...secondaryButtonBase } as CSSProperties,
    logoutButton: { ...primaryButtonBase  } as CSSProperties,

    contentShell: {
      position: 'relative',
      zIndex: 1,
      padding: '20px 20px 28px',
    } as CSSProperties,

    contentInner: {
      minHeight: 'calc(100vh - 160px)',
      width: '100%',
      padding: '24px',
      borderRadius: '14px',
      border: theme.panelBorder,
      background: theme.panelBackground,
      boxShadow: theme.panelShadow,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      color: theme.contentText,
    } as CSSProperties,

    workspaceShell: {
      display: 'grid',
      gridTemplateColumns: '280px minmax(0, 1fr)',
      gap: '16px',
      alignItems: 'start',
    } as CSSProperties,

    sidebarPanel: {
      position: 'sticky',
      top: '68px',
      borderRadius: '14px',
      border: theme.panelBorder,
      background: theme.panelBackground,
      boxShadow: theme.panelShadow,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      padding: '14px',
      display: 'grid',
      gap: '6px',
    } as CSSProperties,

    sidebarTitle: {
      color: theme.brandEyebrow,
      fontSize: '10px',
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.12em',
      marginBottom: '2px',
      fontFamily: "'Inter', system-ui, sans-serif",
    } as CSSProperties,

    sidebarText: {
      color: theme.metaText,
      fontSize: '13px',
      lineHeight: 1.5,
      margin: 0,
    } as CSSProperties,

    navGroupLabel: {
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.10em',
      textTransform: 'uppercase' as const,
      color: theme.navGroupLabelColor,
      padding: '6px 10px 2px',
      fontFamily: "'Inter', system-ui, sans-serif",
    } as CSSProperties,

    navDivider: {
      height: '1px',
      background: theme.navDividerColor,
      margin: '4px 0',
    } as CSSProperties,

    navShell: {
      position: 'relative',
      zIndex: 1,
      marginBottom: '14px',
    } as CSSProperties,

    navScroller: {
      display: 'flex',
      gap: '6px',
      overflowX: 'auto',
      padding: '4px 2px 6px 2px',
      scrollbarWidth: 'none' as const,
      msOverflowStyle: 'none' as const,
    } as CSSProperties,

    navButton: {
      padding: '8px 12px',
      borderRadius: '8px',
      border: theme.navButtonBorder,
      background: theme.navButtonBackground,
      color: theme.navButtonText,
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: '13px',
      fontFamily: "'Inter', system-ui, sans-serif",
      whiteSpace: 'nowrap' as const,
      transition: 'all 0.14s ease',
    } as CSSProperties,

    activeNavButton: {
      background: theme.navButtonActiveBackground,
      color: theme.navButtonActiveText,
      border: theme.navButtonActiveBorder,
      boxShadow: theme.navButtonActiveShadow,
    } as CSSProperties,

    profilePanel: {
      borderRadius: '14px',
      border: theme.panelBorder,
      background: theme.panelBackground,
      padding: '24px',
    } as CSSProperties,

    sectionEyebrow: {
      color: theme.brandEyebrow,
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.14em',
      textTransform: 'uppercase' as const,
      marginBottom: '8px',
      fontFamily: "'Inter', system-ui, sans-serif",
    } as CSSProperties,

    profileGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
      gap: '10px',
    } as CSSProperties,

    profileInfoCard: {
      borderRadius: '10px',
      padding: '14px 16px',
      border: theme.profileStatBorder,
      background: theme.profileStatBg,
    } as CSSProperties,

    profileInfoLabel: {
      fontSize: '10px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.10em',
      color: theme.profileStatLabel,
      marginBottom: '6px',
      fontWeight: 700,
      fontFamily: "'Inter', system-ui, sans-serif",
    } as CSSProperties,

    profileInfoValue: {
      fontSize: '14px',
      fontWeight: 600,
      color: theme.profileStatValue,
      wordBreak: 'break-word' as const,
      fontFamily: "'JetBrains Mono', monospace",
    } as CSSProperties,

    brandWrap: { display: 'flex', gap: '12px', alignItems: 'center', minWidth: 0 } as CSSProperties,

    brandLogoWrap: {
      width: '44px',
      height: '44px',
      borderRadius: '12px',
      border: theme.metaBorder,
      background: theme.metaBackground,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '6px',
      flexShrink: 0,
    } as CSSProperties,

    brandLogo: {
      width: '30px',
      height: '30px',
      objectFit: 'contain' as const,
    } as CSSProperties,

    brandAccent: {
      width: '3px',
      height: '44px',
      borderRadius: '999px',
      background: theme.brandAccent,
      flexShrink: 0,
    } as CSSProperties,

    brandEyebrow: {
      color: theme.brandEyebrow,
      fontSize: '10px',
      fontWeight: 700,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.14em',
      marginBottom: '4px',
      fontFamily: "'Inter', system-ui, sans-serif",
    } as CSSProperties,

    brandTitle: {
      margin: 0,
      fontSize: '26px',
      lineHeight: 1.05,
      fontWeight: 700,
      color: theme.brandTitle,
      fontFamily: "'Inter', system-ui, sans-serif",
      letterSpacing: '-0.02em',
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
      maxWidth: '400px',
      borderRadius: '16px',
      border: theme.loadingCardBorder,
      background: theme.loadingCardBackground,
      padding: '32px 28px',
      textAlign: 'center',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
    } as CSSProperties,

    loadingBrandMark: {
      width: '56px',
      height: '56px',
      margin: '0 auto 16px auto',
      objectFit: 'contain' as const,
    } as CSSProperties,

    loadingDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: theme.loadingDotBackground,
      boxShadow: theme.loadingDotShadow,
      display: 'inline-block',
    } as CSSProperties,

    loadingSubtext: { margin: '0 0 16px 0', color: theme.loadingSubtext, fontSize: '13px' } as CSSProperties,

    errorCard: {
      width: '100%',
      maxWidth: '500px',
      borderRadius: '16px',
      border: theme.errorCardBorder,
      background: theme.errorCardBackground,
      padding: '32px',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      color: theme.errorText,
    } as CSSProperties,

    secondaryButtonBase,
    primaryButtonBase,
  };
}