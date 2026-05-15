// ─────────────────────────────────────────────────────────────
// src/styles/globalCss.ts
// Claude-aesthetic redesign: neutral grays, warm whites,
// teal/slate accent, refined typography, consistent spacing.
//
// CHANGED in this revision:
//   • Sidebar styles — muted bg flush with page, clean active
//     states via accent-tinted fill + left pip, smooth expand
//   • Button system — four clear variants (primary, secondary,
//     ghost, danger) plus size modifiers (sm, md, lg)
//   • Interactive elements — toggles, inputs, selects, links
//     all follow the same token system; no one-off overrides
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";

// ── Layout constants (shared with components that need them) ──
export const SIDEBAR_W_COLLAPSED = 56;
export const SIDEBAR_W_EXPANDED  = 240;
export const COMPACT_BP          = 1024;
export const BOTTOM_NAV_BP       = 768;

const EASE_OUT       = "cubic-bezier(0.16, 1, 0.3, 1)";
const EASE_STANDARD  = "cubic-bezier(0.4, 0, 0.2, 1)";
const DURATION_SIDEBAR = "220ms";

const STYLE_ID = "da-shell-v6-claude";

export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* ── Accent ── */
  --accent:          #2A9D8F;
  --accent-light:    #3BBCAD;
  --accent-dim:      rgba(42,157,143,0.10);
  --accent-border:   rgba(42,157,143,0.20);

  /* ── Supporting accents ── */
  --amber:   #E9A84C;
  --rose:    #E57373;
  --violet:  #7C6FF7;
  --emerald: #34A98F;

  /* ── Sidebar geometry ── */
  --sidebar-w: ${SIDEBAR_W_COLLAPSED}px;
  --sidebar-transition:
    width ${DURATION_SIDEBAR} ${EASE_OUT},
    box-shadow ${DURATION_SIDEBAR} ${EASE_STANDARD};

  /* ── Typography ── */
  --font-sans: 'Source Sans 3', 'Inter', system-ui, sans-serif;
  --font-ui:   'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* ── Easing ── */
  --ease-out:      ${EASE_OUT};
  --ease-standard: ${EASE_STANDARD};

  /* ── Spacing scale ── */
  --sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px; --sp-4: 16px;
  --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-10: 40px;

  /* ── Border radius ── */
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  14px;
  --radius-xl:  20px;
}

/* ── Dark palette (default) ── */
[data-theme="dark"], :root {
  --bg-base:         #1A1A1A;
  --bg-elevated:     #212121;
  --bg-overlay:      #2A2A2A;
  --bg-subtle:       rgba(255,255,255,0.04);
  --bg-subtle-hover: rgba(255,255,255,0.07);

  --border:          rgba(255,255,255,0.08);
  --border-strong:   rgba(255,255,255,0.13);

  --fg-default:   #ECECEC;
  --fg-secondary: #C8C8C8;
  --fg-muted:     #888888;
  --fg-subtle:    #555555;

  --sidebar-bg:     rgba(26,26,26,0.98);
  --sidebar-border: rgba(255,255,255,0.07);
  --header-bg:      rgba(26,26,26,0.92);
  --header-border:  rgba(255,255,255,0.07);

  --scrollbar:       rgba(255,255,255,0.08);
  --scrollbar-hover: rgba(255,255,255,0.15);

  --shadow-xs: 0 1px 2px rgba(0,0,0,0.40);
  --shadow-sm: 0 2px 6px rgba(0,0,0,0.45);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.50);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.60);
  --shadow-sidebar: 1px 0 0 rgba(255,255,255,0.05);

  /* Semantic surfaces for buttons / badges */
  --surface-danger:  rgba(229,115,115,0.10);
  --border-danger:   rgba(229,115,115,0.22);
  --text-danger:     #E57373;
  --surface-success: rgba(52,211,153,0.10);
  --border-success:  rgba(52,211,153,0.22);
  --text-success:    #34D399;
  --surface-warning: rgba(233,168,76,0.10);
  --border-warning:  rgba(233,168,76,0.22);
  --text-warning:    #E9A84C;
  --surface-info:    rgba(42,157,143,0.10);
  --border-info:     rgba(42,157,143,0.20);
  --text-info:       #3BBCAD;
}

/* ── Light palette ── */
[data-theme="light"] {
  --bg-base:         #F7F7F5;
  --bg-elevated:     #FFFFFF;
  --bg-overlay:      #F0EFEB;
  --bg-subtle:       rgba(0,0,0,0.04);
  --bg-subtle-hover: rgba(0,0,0,0.07);

  --border:          rgba(0,0,0,0.08);
  --border-strong:   rgba(0,0,0,0.13);

  --fg-default:   #1A1A1A;
  --fg-secondary: #3A3A3A;
  --fg-muted:     #6B6B6B;
  --fg-subtle:    #ADADAD;

  --sidebar-bg:     rgba(247,247,245,0.98);
  --sidebar-border: rgba(0,0,0,0.07);
  --header-bg:      rgba(255,255,255,0.90);
  --header-border:  rgba(0,0,0,0.07);

  --scrollbar:       rgba(0,0,0,0.10);
  --scrollbar-hover: rgba(0,0,0,0.18);

  --shadow-xs: 0 1px 2px rgba(0,0,0,0.06);
  --shadow-sm: 0 2px 6px rgba(0,0,0,0.07);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.07);
  --shadow-lg: 0 12px 40px rgba(0,0,0,0.09);
  --shadow-sidebar: 1px 0 0 rgba(0,0,0,0.06);

  --surface-danger:  rgba(229,115,115,0.08);
  --border-danger:   rgba(229,115,115,0.20);
  --text-danger:     #C0392B;
  --surface-success: rgba(39,174,96,0.08);
  --border-success:  rgba(39,174,96,0.20);
  --text-success:    #1E8449;
  --surface-warning: rgba(230,126,34,0.08);
  --border-warning:  rgba(230,126,34,0.20);
  --text-warning:    #B7770D;
  --surface-info:    rgba(42,157,143,0.08);
  --border-info:     rgba(42,157,143,0.18);
  --text-info:       #1D7A6E;
}

/* ── Base ── */
html { height: 100%; }
body {
  font-family: var(--font-sans);
  background: var(--bg-base);
  color: var(--fg-default);
  min-height: 100%;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-size: 15px;
  line-height: 1.5;
}
button { font-family: var(--font-ui); cursor: pointer; }
a      { color: inherit; text-decoration: none; }
h1,h2,h3,h4,h5,h6 { font-family: var(--font-ui); font-weight: 500; }

/* ── Scrollbars ── */
* { scrollbar-width: thin; scrollbar-color: var(--scrollbar) transparent; }
::-webkit-scrollbar        { width: 3px; height: 3px; }
::-webkit-scrollbar-track  { background: transparent; }
::-webkit-scrollbar-thumb  { background: var(--scrollbar); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }

/* ── Focus ring ── */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* ── Keyframes ── */
@keyframes fadeUp    { from { opacity:0; transform:translateY(6px)  } to { opacity:1; transform:none } }
@keyframes fadeIn    { from { opacity:0 }                             to { opacity:1 } }
@keyframes scaleIn   { from { opacity:0; transform:scale(.97) }      to { opacity:1; transform:scale(1) } }
@keyframes slideIn   { from { opacity:0; transform:translateX(-6px)} to { opacity:1; transform:none } }
@keyframes slideDown { from { opacity:0; transform:translateY(-6px)} to { opacity:1; transform:none } }
@keyframes bottomUp  { from { opacity:0; transform:translateY(100%)} to { opacity:1; transform:none } }
@keyframes spin      { to { transform:rotate(360deg) } }
@keyframes blink     { 50% { opacity:0.25 } }
@keyframes pulse     { 0%,100% { opacity:0.55 } 50% { opacity:1 } }
@keyframes ping      { 75%,100% { transform:scale(1.7); opacity:0 } }
@keyframes shimmer   { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
@keyframes cmdIn     { from { opacity:0; transform:translateY(-8px) scale(0.98) } to { opacity:1; transform:none } }
@keyframes routeFade { from { opacity:0; transform:translateY(3px) }  to { opacity:1; transform:none } }
@keyframes badgePop  { 0% { transform:scale(0) } 60% { transform:scale(1.12) } 100% { transform:scale(1) } }
@keyframes progressBar { 0%{width:0%} 40%{width:60%} 70%{width:82%} 100%{width:100%} }
@keyframes da-toast-in { from { opacity:0; transform:translateY(12px) scale(0.96) } to { opacity:1; transform:none } }
@keyframes da-shimmer  { 0%,100% { opacity:0.4 } 50% { opacity:0.8 } }

/* ══════════════════════════════════════════════
   SHELL LAYOUT
══════════════════════════════════════════════ */
.da-shell { display: flex; min-height: 100vh; }

/* ══════════════════════════════════════════════
   SIDEBAR
   Muted surface — matches page bg; no heavy
   contrast panel. Active items use accent-tinted
   fill + 0.5px border + left pip (2px).
   Labels/brand animate in on expand; collapse
   removes them without layout jank.
══════════════════════════════════════════════ */
.da-sidebar {
  position: fixed; inset: 0 auto 0 0; z-index: 40;
  width: ${SIDEBAR_W_COLLAPSED}px;
  display: flex; flex-direction: column;
  /* Use sidebar-bg (rgba-based) so it sits flush with page bg */
  background: var(--sidebar-bg);
  border-right: 0.5px solid var(--sidebar-border);
  box-shadow: var(--shadow-sidebar);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  transition: width ${DURATION_SIDEBAR} ${EASE_OUT},
              box-shadow ${DURATION_SIDEBAR} ${EASE_STANDARD};
  overflow: hidden; will-change: width;
}
.da-sidebar.expanded { width: ${SIDEBAR_W_EXPANDED}px; }
@media (prefers-reduced-motion: reduce) { .da-sidebar { transition: none !important; } }

/* Header */
.da-sidebar-header {
  display: flex; align-items: center;
  height: 52px; padding: 0 10px;
  border-bottom: 0.5px solid var(--sidebar-border);
  flex-shrink: 0; overflow: hidden; gap: 10px;
}
.da-sidebar-logo {
  width: 32px; height: 32px; border-radius: var(--radius-md);
  background: var(--accent-dim); border: 0.5px solid var(--accent-border);
  display: grid; place-items: center; flex-shrink: 0; color: var(--accent);
  font-size: 15px;
}

/* Brand slides in on expand */
.da-sidebar-brand {
  opacity: 0; transform: translateX(-6px);
  transition: opacity 140ms ease, transform ${DURATION_SIDEBAR} ${EASE_OUT};
  white-space: nowrap; overflow: hidden; pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-brand { opacity: 1; transform: none; pointer-events: auto; }
.da-sidebar-brand-name {
  font-size: 12px; font-weight: 500; letter-spacing: -0.01em;
  color: var(--fg-default); line-height: 1.2; font-family: var(--font-ui);
}
.da-sidebar-brand-sub {
  font-size: 10px; font-weight: 400; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--fg-muted); margin-top: 1px;
}

/* Nav rail */
.da-nav-rail {
  flex: 1; overflow-y: auto; overflow-x: hidden;
  padding: 8px 6px; display: flex; flex-direction: column;
  gap: 1px; scrollbar-width: none;
}
.da-nav-rail::-webkit-scrollbar { display: none; }
.da-nav-section { display: flex; flex-direction: column; gap: 1px; margin-bottom: 2px; }
.da-nav-section + .da-nav-section {
  padding-top: 8px; border-top: 0.5px solid var(--border); margin-top: 2px;
}
.da-nav-section.collapsed .da-nav-item { display: none; }

/* Section label */
.da-nav-section-label {
  font-size: 10px; font-weight: 500; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--fg-subtle);
  overflow: hidden; max-height: 0; opacity: 0;
  transition: max-height ${DURATION_SIDEBAR} ${EASE_OUT},
              opacity 140ms ease,
              padding ${DURATION_SIDEBAR} ${EASE_OUT};
  cursor: pointer; display: flex; align-items: center;
  justify-content: space-between; gap: 6px;
  border-radius: var(--radius-sm); user-select: none;
  padding: 0 8px; background: transparent; border: none; width: 100%;
  font-family: var(--font-ui);
}
.da-sidebar.expanded .da-nav-section-label {
  max-height: 24px; opacity: 0.65; padding: 3px 8px;
}
.da-sidebar.expanded .da-nav-section-label:hover {
  opacity: 1; background: var(--bg-subtle);
}

/* Nav item — collapsed: icon only, centred. Expanded: icon + label. */
.da-nav-item {
  position: relative; display: flex; align-items: center;
  height: 34px; border-radius: var(--radius-md);
  border: 0.5px solid transparent;
  background: transparent; color: var(--fg-muted);
  cursor: pointer; padding: 0 9px; gap: 0;
  overflow: hidden; white-space: nowrap;
  transition:
    color 110ms ease,
    background 100ms ease,
    border-color 110ms ease,
    gap ${DURATION_SIDEBAR} ${EASE_OUT};
  width: 100%; text-align: left; justify-content: center;
  font-family: var(--font-ui);
}
.da-sidebar.expanded .da-nav-item { gap: 9px; justify-content: flex-start; }
.da-nav-item:hover { color: var(--fg-default); background: var(--bg-subtle-hover); }

/* Active — accent tint, accent border, left pip */
.da-nav-item.active {
  color: var(--accent-light);
  background: var(--accent-dim);
  border-color: var(--accent-border);
}
.da-nav-item.active:hover { background: rgba(42,157,143,0.14); }

/* Left pip */
.da-nav-pip {
  position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 2px; border-radius: 0 2px 2px 0; background: var(--accent);
  height: 0; transition: height 180ms ${EASE_OUT};
}
.da-nav-item.active .da-nav-pip { height: 14px; }

/* Icon */
.da-nav-icon {
  width: 19px; height: 19px; display: grid; place-items: center;
  flex-shrink: 0; color: inherit; font-size: 16px;
}

/* Label — fade + slide on expand */
.da-nav-label {
  font-size: 13px; font-weight: 400;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  opacity: 0; max-width: 0; transform: translateX(-4px);
  transition:
    max-width ${DURATION_SIDEBAR} ${EASE_OUT},
    opacity 140ms ease,
    transform ${DURATION_SIDEBAR} ${EASE_OUT};
  color: inherit; letter-spacing: -0.005em; flex: 1;
}
.da-nav-item.active .da-nav-label { font-weight: 500; }
.da-sidebar.expanded .da-nav-label { opacity: 1; max-width: 160px; transform: none; }

/* Badge */
.da-nav-badge {
  display: none; height: 15px; padding: 0 5px; border-radius: var(--radius-sm);
  font-size: 9px; font-weight: 500; letter-spacing: 0.03em;
  background: var(--accent-dim); color: var(--accent);
  border: 0.5px solid var(--accent-border);
  flex-shrink: 0; align-items: center; justify-content: center;
  animation: badgePop 220ms ${EASE_OUT} both; text-transform: uppercase;
}
.da-sidebar.expanded .da-nav-badge { display: flex; }

/* Learning progress widget */
.da-lc-widget {
  flex-shrink: 0; padding: 6px 6px 0;
  border-top: 0.5px solid var(--sidebar-border);
}
.da-lc-widget-inner {
  border-radius: var(--radius-md);
  background: rgba(42,157,143,0.07);
  border: 0.5px solid var(--accent-border);
  padding: 8px 9px; display: flex; align-items: center;
  gap: 0; transition: gap ${DURATION_SIDEBAR} ${EASE_OUT}; justify-content: center; cursor: pointer;
}
.da-sidebar.expanded .da-lc-widget-inner { gap: 9px; justify-content: flex-start; }
.da-lc-widget-inner:hover { background: rgba(42,157,143,0.12); }
.da-lc-widget-ring  { width: 30px; height: 30px; flex-shrink: 0; }
.da-lc-widget-info  {
  flex: 1; min-width: 0; opacity: 0; transform: translateX(-4px);
  transition: opacity 130ms ease, transform 220ms ${EASE_OUT};
  pointer-events: none; overflow: hidden;
}
.da-sidebar.expanded .da-lc-widget-info { opacity: 1; transform: none; pointer-events: auto; }
.da-lc-widget-level  { font-size: 11px; font-weight: 500; color: var(--fg-default); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.da-lc-widget-xp     { font-size: 10px; color: var(--accent); font-weight: 400; margin-top: 1px; }
.da-lc-widget-streak { display: flex; align-items: center; gap: 3px; font-size: 10px; color: var(--amber); font-weight: 400; margin-top: 2px; }

/* User chip (footer) */
.da-sidebar-user { padding: 6px; border-top: 0.5px solid var(--sidebar-border); flex-shrink: 0; }
.da-sidebar-user-inner {
  display: flex; align-items: center; gap: 0; padding: 7px 8px;
  border-radius: var(--radius-md); background: var(--bg-subtle);
  border: 0.5px solid var(--border); overflow: hidden;
  transition: gap ${DURATION_SIDEBAR} ${EASE_OUT}; justify-content: center;
}
.da-sidebar.expanded .da-sidebar-user-inner { gap: 9px; justify-content: flex-start; }
.da-sidebar-avatar {
  width: 27px; height: 27px; border-radius: var(--radius-sm);
  display: grid; place-items: center; font-size: 10px; font-weight: 500;
  flex-shrink: 0; position: relative; font-family: var(--font-ui);
}
.da-sidebar-avatar-online {
  position: absolute; bottom: -1px; right: -1px;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent); border: 1.5px solid var(--sidebar-bg);
}
.da-sidebar-avatar-online::after {
  content: ''; position: absolute; inset: -2px; border-radius: 50%;
  background: var(--accent); animation: ping 2.5s ease-in-out infinite; opacity: 0.3;
}
.da-sidebar-user-info {
  flex: 1; min-width: 0; overflow: hidden; opacity: 0; transform: translateX(-4px);
  transition: opacity 130ms ease, transform 220ms ${EASE_OUT}; pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-user-info { opacity: 1; transform: none; pointer-events: auto; }
.da-sidebar-user-name {
  font-size: 12px; font-weight: 500; color: var(--fg-default);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  letter-spacing: -0.01em; font-family: var(--font-ui);
}
.da-sidebar-user-role {
  font-size: 10px; font-weight: 400; letter-spacing: 0.02em;
  text-transform: capitalize; margin-top: 1px;
}
.da-sidebar-logout {
  width: 0; height: 24px; border-radius: var(--radius-sm);
  border: 0.5px solid transparent; background: transparent; color: var(--fg-muted);
  display: grid; place-items: center; flex-shrink: 0; overflow: hidden;
  opacity: 0; padding: 0;
  transition: opacity 130ms ease, width 170ms ease, color 110ms ease, background 110ms ease;
  pointer-events: none; font-size: 14px;
}
.da-sidebar.expanded .da-sidebar-logout { opacity: 1; width: 24px; pointer-events: auto; }
.da-sidebar-logout:hover {
  color: var(--rose);
  background: rgba(229,115,115,0.10);
  border-color: rgba(229,115,115,0.22);
}

/* ══════════════════════════════════════════════
   HEADER
══════════════════════════════════════════════ */
.da-header {
  position: fixed; top: 0;
  left: var(--sidebar-w, ${SIDEBAR_W_COLLAPSED}px); right: 0;
  z-index: 30; height: 52px;
  display: flex; align-items: center; padding: 0 var(--sp-5);
  background: var(--header-bg); border-bottom: 1px solid var(--header-border);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  gap: var(--sp-2);
  transition: left ${DURATION_SIDEBAR} ${EASE_OUT}; will-change: left;
}
.da-sidebar.expanded ~ .da-page-root .da-header { left: ${SIDEBAR_W_EXPANDED}px; }

.da-header-left  { display: flex; align-items: center; gap: var(--sp-2); flex: 1; min-width: 0; }
.da-header-right { display: flex; align-items: center; gap: var(--sp-1); flex-shrink: 0; }

/* Breadcrumb */
.da-breadcrumb { display: flex; align-items: center; gap: var(--sp-1); font-size: 13px; overflow: hidden; font-family: var(--font-ui); }
.da-breadcrumb-root    { color: var(--fg-muted); font-weight: 400; white-space: nowrap; }
.da-breadcrumb-sep     { color: var(--fg-subtle); font-size: 12px; }
.da-breadcrumb-current {
  font-weight: 500; color: var(--fg-default); letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  animation: fadeIn 160ms ease both;
}

/* ── Search pill ── */
.da-pill-btn {
  display: flex; align-items: center; gap: var(--sp-1); height: 30px; padding: 0 var(--sp-3);
  border-radius: var(--radius-md); border: 0.5px solid var(--border-strong);
  background: var(--bg-subtle); color: var(--fg-muted);
  font-size: 12px; font-weight: 400; font-family: var(--font-ui);
  cursor: pointer; transition: color 110ms ease, border-color 110ms ease, background 110ms ease;
  white-space: nowrap; flex-shrink: 0;
}
.da-pill-btn:hover { color: var(--fg-default); background: var(--bg-subtle-hover); border-color: var(--border-strong); }

/* ── Icon buttons ── */
.da-icon-btn {
  width: 30px; height: 30px; border-radius: var(--radius-md);
  border: 0.5px solid transparent;
  background: transparent; color: var(--fg-muted);
  display: grid; place-items: center;
  cursor: pointer; transition: color 110ms ease, background 110ms ease, border-color 110ms ease;
  flex-shrink: 0; position: relative;
}
.da-icon-btn:hover { color: var(--fg-default); background: var(--bg-subtle-hover); }
.da-icon-btn.active {
  color: var(--accent); border-color: var(--accent-border); background: var(--accent-dim);
}
.da-icon-btn-badge {
  position: absolute; top: 5px; right: 5px; width: 6px; height: 6px;
  border-radius: 50%; background: var(--rose);
  border: 1.5px solid var(--header-bg); animation: badgePop 280ms ${EASE_OUT} both;
}

/* ── User chip ── */
.da-user-chip {
  display: flex; align-items: center; gap: var(--sp-2); height: 30px;
  padding: 0 var(--sp-2) 0 5px; border-radius: var(--radius-md);
  border: 0.5px solid var(--border); background: var(--bg-subtle);
}
.da-user-chip-avatar {
  width: 20px; height: 20px; border-radius: var(--radius-sm);
  display: grid; place-items: center; font-size: 9px; font-weight: 500;
  color: #fff; flex-shrink: 0; font-family: var(--font-ui);
}
.da-user-chip-name { font-size: 12px; font-weight: 500; color: var(--fg-default); letter-spacing: -0.01em; font-family: var(--font-ui); }
.da-user-chip-role { font-size: 10px; font-weight: 400; letter-spacing: 0.04em; text-transform: uppercase; }

/* Pin button */
.da-pin-btn { display: none; }
@media (min-width: ${COMPACT_BP}px) { .da-pin-btn { display: grid; } }

/* Divider */
.da-hdivider { width: 1px; height: 14px; background: var(--border); flex-shrink: 0; }

/* ══════════════════════════════════════════════
   BUTTONS & INTERACTIVE ELEMENTS
   
   Four variants: primary, secondary, ghost, danger.
   Three sizes: sm (28px), md (32px, default), lg (38px).
   All share the same base (.da-btn) — add modifier classes.
   
   Rationale:
     • primary   — solid accent fill; high-emphasis CTA
     • secondary — muted surface + border; mid-emphasis
     • ghost     — no bg, no border until hover; low-emphasis
     • danger    — semantic red; destructive actions only
   
   No purple gradients. No heavy shadows. Weight stays at 400
   (body) / 500 (active label) — heavier looks out of place
   alongside the rest of the shell type.
══════════════════════════════════════════════ */

/* Base */
.da-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; border-radius: var(--radius-md);
  font-family: var(--font-ui); font-size: 13px; font-weight: 400;
  letter-spacing: -0.005em; white-space: nowrap; cursor: pointer;
  text-decoration: none; user-select: none;
  transition:
    color 110ms ease,
    background 110ms ease,
    border-color 110ms ease,
    transform 80ms ease,
    opacity 110ms ease;
  /* Default size (md) */
  height: 32px; padding: 0 14px;
  /* Neutral base that variants override */
  border: 0.5px solid transparent;
  background: transparent; color: var(--fg-default);
}
.da-btn:active { transform: scale(0.97); }
.da-btn:disabled,
.da-btn[aria-disabled="true"] {
  opacity: 0.45; cursor: not-allowed; pointer-events: none;
}
.da-btn i { font-size: 15px; flex-shrink: 0; }

/* Sizes */
.da-btn-sm { height: 28px; padding: 0 10px; font-size: 12px; border-radius: var(--radius-sm); }
.da-btn-sm i { font-size: 13px; }
.da-btn-lg { height: 38px; padding: 0 18px; font-size: 14px; }
.da-btn-lg i { font-size: 16px; }
.da-btn-icon { width: 32px; padding: 0; }
.da-btn-icon.da-btn-sm { width: 28px; }
.da-btn-icon.da-btn-lg { width: 38px; }

/* ── Primary — solid accent ── */
.da-btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff; font-weight: 500;
}
.da-btn-primary:hover {
  background: var(--accent-light);
  border-color: var(--accent-light);
}
.da-btn-primary:active { transform: scale(0.97); }

/* ── Secondary — muted surface ── */
.da-btn-secondary {
  background: var(--bg-subtle);
  border-color: var(--border-strong);
  color: var(--fg-default);
}
.da-btn-secondary:hover {
  background: var(--bg-subtle-hover);
  border-color: var(--border-strong);
  color: var(--fg-default);
}

/* ── Ghost — no surface until hover ── */
.da-btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--fg-muted);
}
.da-btn-ghost:hover {
  background: var(--bg-subtle-hover);
  border-color: var(--border);
  color: var(--fg-default);
}

/* ── Danger — destructive actions ── */
.da-btn-danger {
  background: var(--surface-danger);
  border-color: var(--border-danger);
  color: var(--text-danger); font-weight: 500;
}
.da-btn-danger:hover {
  background: rgba(229,115,115,0.16);
  border-color: var(--border-danger);
}

/* ── Accent ghost (e.g. "Learn more" links) ── */
.da-btn-accent-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--accent);
}
.da-btn-accent-ghost:hover {
  background: var(--accent-dim);
  border-color: var(--accent-border);
}

/* ── Sign-out (special case, legacy class kept) ── */
.da-sign-out-btn {
  display: inline-flex; align-items: center; gap: 5px;
  height: 30px; padding: 0 var(--sp-3); border-radius: var(--radius-md);
  border: 0.5px solid var(--border-danger);
  background: var(--surface-danger); color: var(--text-danger);
  font-size: 12px; font-weight: 500; font-family: var(--font-ui);
  cursor: pointer; transition: background 110ms ease, border-color 110ms ease;
  white-space: nowrap; flex-shrink: 0;
}
.da-sign-out-btn:hover { background: rgba(229,115,115,0.14); border-color: var(--border-danger); }

/* ══════════════════════════════════════════════
   FORM INPUTS & SELECTS
   All 36px tall, consistent radius and focus ring.
   No box-shadows — rely on border + ring.
══════════════════════════════════════════════ */
.da-input,
.da-select,
.da-textarea {
  display: block; width: 100%;
  background: var(--bg-elevated); color: var(--fg-default);
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-md);
  font-family: var(--font-ui); font-size: 13px; font-weight: 400;
  line-height: 1.5; transition: border-color 110ms ease;
  outline: none;
}
.da-input,
.da-select { height: 36px; padding: 0 12px; }
.da-textarea { padding: 8px 12px; resize: vertical; min-height: 80px; }
.da-input::placeholder,
.da-textarea::placeholder { color: var(--fg-muted); }
.da-input:hover,
.da-select:hover,
.da-textarea:hover { border-color: var(--border-strong); }
.da-input:focus,
.da-select:focus,
.da-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-dim);
}
.da-input-error,
.da-select-error,
.da-textarea-error { border-color: var(--border-danger); }
.da-input-error:focus,
.da-textarea-error:focus {
  border-color: var(--text-danger);
  box-shadow: 0 0 0 2px var(--surface-danger);
}
.da-input-label {
  display: block; font-size: 11px; font-weight: 500; color: var(--fg-muted);
  letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 5px;
  font-family: var(--font-ui);
}
.da-input-hint {
  font-size: 11px; color: var(--fg-subtle); margin-top: 4px; font-family: var(--font-ui);
}
.da-input-error-msg {
  font-size: 11px; color: var(--text-danger); margin-top: 4px; font-family: var(--font-ui);
}

/* ══════════════════════════════════════════════
   TOGGLE / CHECKBOX / RADIO
══════════════════════════════════════════════ */
/* Toggle switch */
.da-toggle-wrap {
  display: flex; align-items: center; gap: 9px; cursor: pointer; user-select: none;
}
.da-toggle {
  position: relative; width: 36px; height: 20px; flex-shrink: 0;
}
.da-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.da-toggle-track {
  position: absolute; inset: 0; border-radius: 999px;
  background: var(--border-strong);
  border: 0.5px solid transparent;
  transition: background 180ms ease, border-color 180ms ease;
}
.da-toggle input:checked ~ .da-toggle-track {
  background: var(--accent); border-color: var(--accent);
}
.da-toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; transition: transform 180ms ${EASE_OUT};
  box-shadow: 0 1px 3px rgba(0,0,0,0.25);
}
.da-toggle input:checked ~ .da-toggle-track ~ .da-toggle-thumb,
.da-toggle input:checked + .da-toggle-track + .da-toggle-thumb { transform: translateX(16px); }
.da-toggle-label { font-size: 13px; font-weight: 400; color: var(--fg-default); font-family: var(--font-ui); }

/* Checkbox */
.da-checkbox-wrap {
  display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;
}
.da-checkbox {
  width: 16px; height: 16px; border-radius: 4px;
  border: 0.5px solid var(--border-strong);
  background: var(--bg-elevated); flex-shrink: 0;
  display: grid; place-items: center;
  transition: background 110ms ease, border-color 110ms ease;
  cursor: pointer;
}
.da-checkbox.checked {
  background: var(--accent); border-color: var(--accent);
}
.da-checkbox-label { font-size: 13px; color: var(--fg-default); font-family: var(--font-ui); }

/* ══════════════════════════════════════════════
   LINKS
══════════════════════════════════════════════ */
.da-link {
  color: var(--accent); text-decoration: none; font-weight: 400;
  transition: color 110ms ease; cursor: pointer;
}
.da-link:hover { color: var(--accent-light); text-decoration: underline; }
.da-link-muted {
  color: var(--fg-muted); text-decoration: none;
  transition: color 110ms ease; cursor: pointer;
}
.da-link-muted:hover { color: var(--fg-default); }

/* ══════════════════════════════════════════════
   BADGES / STATUS CHIPS
══════════════════════════════════════════════ */
.da-badge {
  display: inline-flex; align-items: center; gap: 4px;
  height: 20px; padding: 0 8px; border-radius: 999px;
  font-size: 11px; font-weight: 500; font-family: var(--font-ui);
  letter-spacing: 0.02em; white-space: nowrap;
  border: 0.5px solid transparent;
}
.da-badge-default  { background: var(--bg-subtle);       color: var(--fg-muted);     border-color: var(--border); }
.da-badge-accent   { background: var(--accent-dim);      color: var(--accent-light); border-color: var(--accent-border); }
.da-badge-success  { background: var(--surface-success); color: var(--text-success); border-color: var(--border-success); }
.da-badge-warning  { background: var(--surface-warning); color: var(--text-warning); border-color: var(--border-warning); }
.da-badge-danger   { background: var(--surface-danger);  color: var(--text-danger);  border-color: var(--border-danger); }
.da-badge-info     { background: var(--surface-info);    color: var(--text-info);    border-color: var(--border-info); }

/* ══════════════════════════════════════════════
   NOTIFICATION DROPDOWN
══════════════════════════════════════════════ */
.da-notif-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0; width: 296px;
  background: var(--bg-elevated); border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  animation: slideDown 150ms ${EASE_OUT} both; overflow: hidden; z-index: 200;
}
.da-notif-header {
  padding: var(--sp-3) var(--sp-4); border-bottom: 0.5px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.da-notif-title { font-size: 13px; font-weight: 500; color: var(--fg-default); letter-spacing: -0.01em; font-family: var(--font-ui); }
.da-notif-mark-all {
  font-size: 11px; color: var(--accent); cursor: pointer; font-weight: 400;
  background: none; border: none; padding: 0;
}
.da-notif-mark-all:hover { opacity: 0.75; }
.da-notif-list { max-height: 300px; overflow-y: auto; }
.da-notif-item {
  display: flex; align-items: flex-start; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4);
  border-bottom: 0.5px solid var(--border); cursor: pointer; position: relative;
  transition: background 90ms ease;
}
.da-notif-item:last-child { border-bottom: none; }
.da-notif-item:hover { background: var(--bg-subtle-hover); }
.da-notif-item.unread::before {
  content: ''; position: absolute; left: 5px; top: 50%; transform: translateY(-50%);
  width: 4px; height: 4px; border-radius: 50%; background: var(--accent);
}
.da-notif-text-title { font-size: 12px; font-weight: 500; color: var(--fg-default); line-height: 1.4; font-family: var(--font-ui); }
.da-notif-text-sub   { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }
.da-notif-time       { font-size: 10px; color: var(--fg-subtle); flex-shrink: 0; margin-top: 2px; font-family: var(--font-mono); }
.da-notif-empty      { padding: 28px var(--sp-4); text-align: center; color: var(--fg-muted); font-size: 12px; }

/* ══════════════════════════════════════════════
   PAGE ROOT
══════════════════════════════════════════════ */
.da-page-root {
  flex: 1; min-width: 0;
  margin-left: var(--sidebar-w, ${SIDEBAR_W_COLLAPSED}px);
  padding-top: 52px;
  transition: margin-left ${DURATION_SIDEBAR} ${EASE_OUT}; will-change: margin-left;
}
.da-sidebar.expanded ~ .da-page-root { margin-left: ${SIDEBAR_W_EXPANDED}px; }

.da-content    { padding: var(--sp-6); min-height: calc(100vh - 52px); }
.da-route-fade { animation: routeFade 200ms ${EASE_OUT} both; }
@media (max-width: ${COMPACT_BP - 1}px) { .da-content { padding: var(--sp-4) var(--sp-4) 80px; } }

/* ══════════════════════════════════════════════
   KEYBOARD SHORTCUTS MODAL
══════════════════════════════════════════════ */
.da-shortcuts-overlay {
  position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.45);
  backdrop-filter: blur(4px); animation: fadeIn 110ms ease both;
  display: flex; align-items: center; justify-content: center; padding: var(--sp-6);
}
.da-shortcuts-card {
  width: min(520px, 100%); background: var(--bg-elevated);
  border: 0.5px solid var(--border-strong); border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg); overflow: hidden; animation: scaleIn 180ms ${EASE_OUT} both;
}
.da-shortcuts-header  { padding: var(--sp-5) var(--sp-6); border-bottom: 0.5px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.da-shortcuts-body    { padding: var(--sp-4) var(--sp-6) var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-1); }
.da-shortcuts-section { font-size: 10px; font-weight: 500; letter-spacing: 0.09em; text-transform: uppercase; color: var(--fg-muted); margin: var(--sp-3) 0 var(--sp-1); }
.da-shortcut-row      { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 0.5px solid var(--border); }
.da-shortcut-row:last-child { border-bottom: none; }
.da-shortcut-desc     { font-size: 13px; color: var(--fg-default); font-weight: 400; font-family: var(--font-ui); }
.da-shortcut-keys     { display: flex; gap: 3px; align-items: center; }
.da-key {
  font-family: var(--font-mono); font-size: 11px; font-weight: 400; color: var(--fg-muted);
  background: var(--bg-subtle); border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-sm); padding: 2px 6px; line-height: 1.5;
}

/* ══════════════════════════════════════════════
   BOTTOM TAB BAR (mobile)
══════════════════════════════════════════════ */
.da-bottom-nav {
  display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  height: 60px; padding: 0 var(--sp-1);
  background: var(--sidebar-bg); border-top: 0.5px solid var(--sidebar-border);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  align-items: center; justify-content: space-around;
  animation: bottomUp 260ms ${EASE_OUT} both;
}
@media (max-width: ${BOTTOM_NAV_BP}px) { .da-bottom-nav { display: flex; } }
.da-bottom-nav-item {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; height: 100%; border: none; background: transparent; color: var(--fg-muted);
  font-family: var(--font-ui); cursor: pointer; transition: color 110ms ease;
  position: relative; padding: var(--sp-2) var(--sp-1); border-radius: var(--radius-sm);
  min-width: 0;
}
.da-bottom-nav-item.active  { color: var(--accent); }
.da-bottom-nav-item:hover   { color: var(--fg-default); }
.da-bottom-nav-icon  { font-size: 17px; line-height: 1; }
.da-bottom-nav-label { font-size: 9px; font-weight: 500; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.da-bottom-nav-pip   {
  position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
  width: 16px; height: 2px; border-radius: 999px; background: var(--accent);
  opacity: 0; transition: opacity 140ms ease;
}
.da-bottom-nav-item.active .da-bottom-nav-pip { opacity: 1; }

/* ══════════════════════════════════════════════
   COMMAND PALETTE
══════════════════════════════════════════════ */
.da-cmd-backdrop {
  position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.45);
  backdrop-filter: blur(5px); animation: fadeIn 110ms ease both;
  display: flex; align-items: flex-start; justify-content: center; padding-top: 11vh;
}
.da-cmd-palette {
  width: min(580px, 94vw); border-radius: var(--radius-xl);
  border: 0.5px solid var(--border-strong); background: var(--bg-elevated);
  box-shadow: var(--shadow-lg); overflow: hidden;
  animation: cmdIn 150ms ${EASE_OUT} both;
}
.da-cmd-input-wrap {
  display: flex; align-items: center; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4);
  border-bottom: 0.5px solid var(--border);
}
.da-cmd-input {
  flex: 1; background: transparent; border: none; outline: none;
  font-size: 14px; font-weight: 400; font-family: var(--font-sans);
  color: var(--fg-default); letter-spacing: -0.008em;
}
.da-cmd-input::placeholder { color: var(--fg-muted); }
.da-cmd-results       { max-height: 360px; overflow-y: auto; padding: var(--sp-1); }
.da-cmd-section-label { font-size: 10px; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fg-subtle); padding: var(--sp-2) var(--sp-2) var(--sp-1); }
.da-cmd-item {
  display: flex; align-items: center; gap: var(--sp-2); height: 40px; padding: 0 var(--sp-2);
  border-radius: var(--radius-md); cursor: pointer; transition: background 70ms ease;
  border: 0.5px solid transparent;
}
.da-cmd-item:hover,
.da-cmd-item.selected { background: var(--bg-subtle-hover); border-color: var(--border); }
.da-cmd-item-icon  { width: 26px; height: 26px; border-radius: var(--radius-sm); display: grid; place-items: center; flex-shrink: 0; font-size: 12px; }
.da-cmd-item-label { flex: 1; font-size: 13px; font-weight: 400; color: var(--fg-default); letter-spacing: -0.01em; font-family: var(--font-ui); }
.da-cmd-item-group  { font-size: 11px; color: var(--fg-muted); }
.da-cmd-shortcut   { font-size: 11px; font-family: var(--font-mono); color: var(--fg-muted); background: var(--bg-subtle); border: 0.5px solid var(--border); border-radius: var(--radius-sm); padding: 1px 5px; }
.da-cmd-empty      { padding: 28px var(--sp-4); text-align: center; color: var(--fg-muted); font-size: 13px; }
.da-cmd-footer {
  display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-2) var(--sp-3);
  border-top: 0.5px solid var(--border); font-size: 11px; color: var(--fg-subtle);
  font-family: var(--font-mono);
}
.da-cmd-footer kbd {
  font-family: var(--font-mono); font-size: 10px; background: var(--bg-subtle);
  border: 0.5px solid var(--border-strong); border-radius: var(--radius-sm);
  padding: 1px 4px; color: var(--fg-muted);
}

/* ══════════════════════════════════════════════
   LOADER
══════════════════════════════════════════════ */
.da-loader-shell {
  position: fixed; inset: 0; display: grid; place-items: center;
  background: var(--bg-base); z-index: 9999; animation: fadeIn 180ms ease;
}
.da-loader-card {
  display: flex; align-items: center; gap: var(--sp-8); padding: var(--sp-8) var(--sp-10);
  border-radius: var(--radius-xl); border: 0.5px solid var(--border-strong);
  background: var(--bg-elevated); box-shadow: var(--shadow-md);
  animation: scaleIn 280ms ${EASE_OUT} both; min-width: min(540px, calc(100vw - 32px));
}
.da-loader-visual  { position: relative; width: 100px; height: 100px; flex-shrink: 0; display: grid; place-items: center; }
.da-loader-disc-spin { position: absolute; inset: 0; animation: spin 1.2s linear infinite; will-change: transform; }
.da-loader-svg    { width: 100%; height: 100%; display: block; overflow: visible; }
.da-loader-copy   { min-width: 0; }
.da-loader-eyebrow  { font-size: 10px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; font-family: var(--font-ui); }
.da-loader-headline { font-size: 20px; font-weight: 500; color: var(--fg-default); letter-spacing: -0.02em; font-family: var(--font-ui); }
.da-loader-sub    { font-size: 13px; color: var(--fg-muted); margin-top: 5px; line-height: 1.5; max-width: 340px; }
.da-loader-bar    { height: 2px; margin-top: var(--sp-5); border-radius: 999px; background: var(--border); overflow: hidden; width: min(260px, 100%); }
.da-loader-bar-fill {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--accent), var(--accent-light));
  background-size: 200%; animation: shimmer 1.6s linear infinite;
}
@media (max-width: 640px) {
  .da-loader-card { min-width: 0; width: calc(100vw - 24px); flex-direction: column; align-items: flex-start; padding: var(--sp-6); }
  .da-loader-visual { width: 80px; height: 80px; }
  .da-loader-bar { width: 100%; }
}

/* ══════════════════════════════════════════════
   PROFILE PANEL
══════════════════════════════════════════════ */
.da-profile-panel {
  max-width: 580px; padding: var(--sp-8); border-radius: var(--radius-lg);
  background: var(--bg-elevated); border: 0.5px solid var(--border);
  animation: fadeUp 200ms ${EASE_OUT} both;
}
.da-profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); margin-top: var(--sp-6); }
@media (max-width: 500px) { .da-profile-grid { grid-template-columns: 1fr; } }
.da-profile-field { padding: var(--sp-3) var(--sp-4); border-radius: var(--radius-md); background: var(--bg-subtle); border: 0.5px solid var(--border); }
.da-profile-field-label { font-size: 10px; font-weight: 500; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fg-muted); margin-bottom: 3px; font-family: var(--font-ui); }
.da-profile-field-value { font-size: 13px; font-weight: 400; color: var(--fg-default); letter-spacing: -0.01em; font-family: var(--font-ui); }

/* ══════════════════════════════════════════════
   ERROR CARD
══════════════════════════════════════════════ */
.da-error-card {
  max-width: 400px; padding: var(--sp-8); border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  border: 0.5px solid var(--border-danger);
  text-align: center; animation: scaleIn 260ms ${EASE_OUT} both;
}

/* ══════════════════════════════════════════════
   CLOCK
══════════════════════════════════════════════ */
.da-clock {
  font-family: var(--font-mono); font-size: 12px; font-weight: 400;
  color: var(--fg-muted); letter-spacing: 0.04em; user-select: none;
  display: flex; align-items: center; gap: 1px;
}
.da-clock-colon { animation: blink 1s step-end infinite; }

/* ══════════════════════════════════════════════
   COMPACT NAV (tablet)
══════════════════════════════════════════════ */
.da-compact-nav {
  position: sticky; top: 52px; z-index: 20;
  display: flex; gap: 2px; padding: var(--sp-2) var(--sp-4);
  overflow-x: auto; border-bottom: 0.5px solid var(--border);
  background: var(--header-bg); backdrop-filter: blur(14px);
  scrollbar-width: none;
}
.da-compact-nav::-webkit-scrollbar { display: none; }
@media (max-width: ${BOTTOM_NAV_BP}px) { .da-compact-nav { display: none; } }
.da-compact-nav-item {
  display: flex; align-items: center; gap: var(--sp-1); height: 26px; padding: 0 var(--sp-2);
  border-radius: var(--radius-sm); border: 0.5px solid transparent;
  background: transparent; color: var(--fg-muted);
  font-size: 12px; font-weight: 400; font-family: var(--font-ui);
  cursor: pointer; white-space: nowrap; transition: all 110ms ease; flex-shrink: 0;
}
.da-compact-nav-item:hover { color: var(--fg-default); background: var(--bg-subtle-hover); }
.da-compact-nav-item.active {
  color: var(--accent-light); background: var(--accent-dim);
  border-color: var(--accent-border); font-weight: 500;
}

/* ══════════════════════════════════════════════
   TOAST STACK
══════════════════════════════════════════════ */
.da-toast {
  animation: da-toast-in 0.25s cubic-bezier(0.34,1.56,0.64,1) both;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}



/* ══════════════════════════════════════════════
   FORM ELEMENTS — v2.1 redesign
   Overrides the base rules in GLOBAL_CSS.
   All inputs share height / radius / color tokens.
   Focus uses an accent ring (no harsh outline).
   Error uses a rose border; no red background fill.
══════════════════════════════════════════════ */

/* ── Base reset shared by all text-entry controls ── */
.da-input,
.da-select,
.da-textarea {
  display: block;
  width: 100%;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--fg-default);
  background: var(--bg-elevated);
  border: 0.5px solid var(--border-strong);
  border-radius: var(--radius-md);
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
  -webkit-appearance: none;
  appearance: none;
}

/* ── Text inputs and selects — fixed height ── */
.da-input,
.da-select {
  height: 38px;
  padding: 0 12px;
}

/* ── Textarea — resizable, min height ── */
.da-textarea {
  padding: 9px 12px;
  resize: vertical;
  min-height: 84px;
  height: auto;
}

/* ── Placeholder legibility ── */
.da-input::placeholder,
.da-textarea::placeholder {
  color: var(--fg-subtle);
  opacity: 1;
}

/* ── Hover — slightly stronger border ── */
.da-input:not(:disabled):hover,
.da-select:not(:disabled):hover,
.da-textarea:not(:disabled):hover {
  border-color: var(--border-strong);
}

/* ── Focus — accent border + soft ring (no harsh outline) ── */
.da-input:focus,
.da-select:focus,
.da-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-dim);
}

/* ── Error state — rose border + ring; NO red bg fill ── */
.da-input-error,
.da-select-error,
.da-textarea-error {
  border-color: var(--border-danger);
}
.da-input-error:focus,
.da-select-error:focus,
.da-textarea-error:focus {
  border-color: var(--text-danger);
  box-shadow: 0 0 0 3px var(--surface-danger);
}

/* ── Disabled — muted surface, no pointer ── */
.da-input:disabled,
.da-select:disabled,
.da-textarea:disabled {
  background: var(--bg-subtle);
  border-color: var(--border);
  color: var(--fg-muted);
  cursor: not-allowed;
  opacity: 0.6;
}
.da-input:disabled::placeholder,
.da-textarea:disabled::placeholder {
  color: var(--fg-subtle);
}

/* ── Select — accent chevron via mask-image ── */
.da-select {
  padding-right: 32px;
  background-image: none;
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 14px 14px;
  /* SVG chevron in fg-muted color for both themes */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
}
[data-theme="dark"] .da-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
}

/* ── Labels and hint text ── */
.da-input-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin-bottom: 6px;
  font-family: var(--font-ui);
}
.da-input-hint {
  font-size: 11px;
  color: var(--fg-muted);
  margin-top: 5px;
  font-family: var(--font-ui);
  line-height: 1.4;
}
.da-input-error-msg {
  font-size: 11px;
  color: var(--text-danger);
  margin-top: 5px;
  font-family: var(--font-ui);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ── Checkbox — branded, accessible ── */
.da-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 0.5px solid var(--border-strong);
  background: var(--bg-elevated);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
  flex-shrink: 0;
}
.da-checkbox:hover {
  border-color: var(--accent);
}
.da-checkbox.checked {
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-dim);
}
.da-checkbox.checked::after {
  content: '';
  display: block;
  width: 9px;
  height: 5px;
  border-left: 1.5px solid #fff;
  border-bottom: 1.5px solid #fff;
  transform: rotate(-45deg) translateY(-1px);
}

/* ── Toggle — unchanged base, refined thumb shadow ── */
.da-toggle-thumb {
  box-shadow: 0 1px 4px rgba(0,0,0,0.20);
}
.da-toggle input:checked ~ .da-toggle-track {
  background: var(--accent);
}

/* ── Cards v2.1 — consistent rounded surfaces ── */

/* Flat: off-white/dark-gray, thin border, no shadow */
.da-card {
  background: var(--bg-elevated);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
}

/* Raised: sits above the page with a soft multi-layer shadow */
.da-card-elevated {
  background: var(--bg-elevated);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  box-shadow:
    0 1px 2px rgba(0,0,0,0.04),
    0 4px 14px rgba(0,0,0,0.06);
}
[data-theme="dark"] .da-card-elevated {
  box-shadow:
    0 1px 2px rgba(0,0,0,0.25),
    0 4px 14px rgba(0,0,0,0.28);
}

/* Interactive: border and shadow animate on hover */
.da-card-interactive {
  background: var(--bg-elevated);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04);
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 150ms ease;
  cursor: pointer;
}
.da-card-interactive:hover {
  border-color: var(--accent-border);
  box-shadow:
    0 2px 4px rgba(0,0,0,0.06),
    0 8px 24px rgba(0,0,0,0.08);
  transform: translateY(-1px);
}
[data-theme="dark"] .da-card-interactive {
  box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.28);
}
[data-theme="dark"] .da-card-interactive:hover {
  box-shadow:
    0 2px 4px rgba(0,0,0,0.4),
    0 8px 24px rgba(0,0,0,0.4);
}

/* Stat: secondary surface for metric display, no border */
.da-card-stat {
  background: var(--bg-subtle);
  border: 0.5px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}

/* Glass: backdrop-blur over imagery */
.da-card-glass {
  background: var(--bg-elevated);
  background: rgba(255,255,255,0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 0.5px solid rgba(255,255,255,0.5);
  border-radius: var(--radius-lg);
  padding: 20px 22px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
[data-theme="dark"] .da-card-glass {
  background: rgba(26,26,26,0.75);
  border-color: rgba(255,255,255,0.09);
  box-shadow: 0 2px 8px rgba(0,0,0,0.35);
}
`;

/** Injects the global CSS once and removes it on unmount. */
export function useGlobalStyles(): void {
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current || document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    injected.current = true;
    return () => {
      document.getElementById(STYLE_ID)?.remove();
      injected.current = false;
    };
  }, []);
}