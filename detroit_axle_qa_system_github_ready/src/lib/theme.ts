export type ThemeMode = 'dark' | 'light';

export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';

  const stored =
    window.localStorage.getItem('detroit-axle-theme-mode') ||
    window.sessionStorage.getItem('detroit-axle-theme-mode') ||
    window.localStorage.getItem('detroit-axle-theme') ||
    window.sessionStorage.getItem('detroit-axle-theme') ||
    '';

  return stored.toLowerCase() === 'light' || stored.toLowerCase() === 'white'
    ? 'light'
    : 'dark';
}

export function isLightThemeMode() {
  return getStoredThemeMode() === 'light';
}
