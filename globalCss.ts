// ─────────────────────────────────────────────────────────────
// src/styles/globalCss.ts
// The single source of truth for all shell-level CSS.
// Consumed by the useGlobalStyles() hook exported below.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";

// ── Layout constants (shared with components that need them) ──
export const SIDEBAR_W_COLLAPSED = 60;
export const SIDEBAR_W_EXPANDED  = 248;
export const COMPACT_BP          = 1024;
export const BOTTOM_NAV_BP       = 768;

const SPRING   = "cubic-bezier(0.175, 0.885, 0.32, 1.075)";
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const DURATION_SIDEBAR = "260ms";

const STYLE_ID = "da-shell-v5";

export const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --accent-blue:    #3b82f6;
  --accent-violet:  #8b5cf6;
  --accent-cyan:    #06b6d4;
  --accent-amber:   #f59e0b;
  --accent-rose:    #f43f5e;
  --accent-emerald: #10b981;

  --sidebar-w: ${SIDEBAR_W_COLLAPSED}px;
  --sidebar-transition: width ${DURATION_SIDEBAR} ${EASE_OUT},
                        box-shadow ${DURATION_SIDEBAR} ease,
                        opacity 160ms ease;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'Geist Mono', monospace;
  --spring: ${SPRING};
  --ease-out: ${EASE_OUT};
}

[data-theme="dark"], :root {
  --bg-base:        #080810;
  --bg-elevated:    #0f0f18;
  --bg-overlay:     #14141e;
  --bg-subtle:      rgba(255,255,255,0.035);
  --bg-subtle-hover:rgba(255,255,255,0.065);
  --border:         rgba(255,255,255,0.065);
  --border-strong:  rgba(255,255,255,0.11);
  --fg-default:     #f0f4fa;
  --fg-muted:       #5a6a80;
  --fg-subtle:      #2e3a4a;
  --sidebar-bg:     rgba(8,8,16,0.97);
  --sidebar-border: rgba(255,255,255,0.055);
  --header-bg:      rgba(8,8,14,0.90);
  --header-border:  rgba(255,255,255,0.055);
  --scrollbar:      rgba(255,255,255,0.07);
  --scrollbar-hover:rgba(255,255,255,0.14);
  --shadow-sm:      0 1px 3px rgba(0,0,0,0.5);
  --shadow-md:      0 4px 20px rgba(0,0,0,0.55);
  --shadow-lg:      0 16px 48px rgba(0,0,0,0.65);
  --shadow-sidebar: 1px 0 0 rgba(255,255,255,0.04), 10px 0 30px rgba(0,0,0,0.35);
  --glow-blue:      0 0 20px rgba(59,130,246,0.2);
}

[data-theme="light"] {
  --bg-base:        #f5f7fc;
  --bg-elevated:    #ffffff;
  --bg-overlay:     #eef1f8;
  --bg-subtle:      rgba(0,0,0,0.028);
  --bg-subtle-hover:rgba(0,0,0,0.048);
  --border:         rgba(0,0,0,0.065);
  --border-strong:  rgba(0,0,0,0.11);
  --fg-default:     #0d1829;
  --fg-muted:       #5a6a80;
  --fg-subtle:      #9faab8;
  --sidebar-bg:     rgba(250,252,255,0.98);
  --sidebar-border: rgba(0,0,0,0.055);
  --header-bg:      rgba(255,255,255,0.92);
  --header-border:  rgba(0,0,0,0.065);
  --scrollbar:      rgba(0,0,0,0.09);
  --scrollbar-hover:rgba(0,0,0,0.18);
  --shadow-sm:      0 1px 3px rgba(0,0,0,0.07);
  --shadow-md:      0 4px 20px rgba(0,0,0,0.07);
  --shadow-lg:      0 16px 48px rgba(0,0,0,0.09);
  --shadow-sidebar: 1px 0 0 rgba(0,0,0,0.06), 10px 0 30px rgba(0,0,0,0.04);
  --glow-blue:      0 0 20px rgba(59,130,246,0.12);
}

html { height: 100%; }
body {
  font-family: var(--font-sans);
  background: var(--bg-base);
  color: var(--fg-default);
  min-height: 100%;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
button { font-family: inherit; cursor: pointer; }
a { color: inherit; text-decoration: none; }

* { scrollbar-width: thin; scrollbar-color: var(--scrollbar) transparent; }
::-webkit-scrollbar { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 999px; }
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }

:focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
  border-radius: 6px;
}

/* ── Keyframes ───────────────────────────────────────────── */
@keyframes fadeUp    { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
@keyframes fadeIn    { from { opacity:0 } to { opacity:1 } }
@keyframes slideIn   { from { opacity:0; transform:translateX(-8px) } to { opacity:1; transform:translateX(0) } }
@keyframes scaleIn   { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:scale(1) } }
@keyframes spin      { to { transform:rotate(360deg) } }
@keyframes blink     { 50% { opacity:0.2 } }
@keyframes pulse     { 0%,100% { opacity:0.6 } 50% { opacity:1 } }
@keyframes ping      { 75%,100% { transform:scale(1.7); opacity:0 } }
@keyframes shimmer   { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
@keyframes progressBar { 0% { width:0% } 40% { width:60% } 70% { width:80% } 100% { width:100% } }
@keyframes cmdIn     { from { opacity:0; transform:translateY(-10px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }
@keyframes routeFade { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
@keyframes badgePop  { 0% { transform:scale(0) } 60% { transform:scale(1.15) } 100% { transform:scale(1) } }
@keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
@keyframes bottomUp  { from { opacity:0; transform:translateY(100%) } to { opacity:1; transform:translateY(0) } }

/* ── Shell Layout ────────────────────────────────────────── */
.da-shell { display: flex; min-height: 100vh; }

/* ── Sidebar ─────────────────────────────────────────────── */
.da-sidebar {
  position: fixed; inset: 0 auto 0 0; z-index: 40;
  width: var(--sidebar-w, ${SIDEBAR_W_COLLAPSED}px);
  display: flex; flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  box-shadow: var(--shadow-sidebar);
  backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
  transition: var(--sidebar-transition);
  overflow: hidden; will-change: width;
}
.da-sidebar.expanded { width: ${SIDEBAR_W_EXPANDED}px; }
@media (prefers-reduced-motion: reduce) { .da-sidebar { transition: none !important; } }

.da-sidebar-header {
  display: flex; align-items: center; height: 56px; padding: 0 10px;
  border-bottom: 1px solid var(--sidebar-border); flex-shrink: 0; overflow: hidden; gap: 10px;
}
.da-sidebar-logo {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent-blue) 15%, var(--bg-subtle)), color-mix(in srgb, var(--accent-violet) 10%, var(--bg-subtle)));
  border: 1px solid color-mix(in srgb, var(--accent-blue) 22%, transparent);
  display: grid; place-items: center; flex-shrink: 0; overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
}
.da-sidebar-brand {
  opacity: 0; transform: translateX(-4px);
  transition: opacity 140ms ease, transform 160ms ease;
  white-space: nowrap; overflow: hidden; pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-brand { opacity: 1; transform: translateX(0); pointer-events: auto; }
.da-sidebar-brand-name { font-size: 13px; font-weight: 700; letter-spacing: -0.02em; color: var(--fg-default); line-height: 1.2; }
.da-sidebar-brand-sub  { font-size: 10px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-muted); margin-top: 1px; }

.da-nav-rail {
  flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px 6px;
  display: flex; flex-direction: column; gap: 1px;
}
.da-nav-section { display: flex; flex-direction: column; gap: 1px; margin-bottom: 2px; }
.da-nav-section + .da-nav-section { padding-top: 6px; border-top: 1px solid var(--border); margin-top: 2px; }
.da-nav-section.collapsed .da-nav-item { display: none; }

.da-nav-section-label {
  font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--fg-subtle); padding: 0 8px 4px;
  overflow: hidden; max-height: 0; opacity: 0;
  transition: max-height ${DURATION_SIDEBAR} ${EASE_OUT}, opacity 160ms ease, padding ${DURATION_SIDEBAR} ${EASE_OUT};
  cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 6px;
  border-radius: 5px; user-select: none;
}
.da-sidebar.expanded .da-nav-section-label { max-height: 28px; opacity: 0.75; padding: 5px 8px 5px; }
.da-sidebar.expanded .da-nav-section-label:hover { opacity: 1; background: var(--bg-subtle); }
.da-nav-section-label-collapse {
  width: 14px; height: 14px; display: grid; place-items: center;
  font-size: 9px; color: var(--fg-subtle); flex-shrink: 0;
  transition: transform 200ms ease, opacity 160ms ease; opacity: 0;
}
.da-sidebar.expanded .da-nav-section-label:hover .da-nav-section-label-collapse { opacity: 1; }
.da-nav-section.collapsed .da-nav-section-label-collapse { transform: rotate(-90deg); opacity: 0.6; }

.da-nav-item {
  position: relative; display: flex; align-items: center;
  height: 36px; border-radius: 9px; border: 1px solid transparent;
  background: transparent; color: var(--fg-muted); cursor: pointer;
  padding: 0 8px; gap: 0; overflow: hidden; white-space: nowrap;
  transition: color 120ms ease, background 100ms ease, border-color 120ms ease,
              gap ${DURATION_SIDEBAR} ${EASE_OUT}, padding ${DURATION_SIDEBAR} ${EASE_OUT};
  width: 100%; text-align: left; justify-content: center;
}
.da-sidebar.expanded .da-nav-item { gap: 9px; justify-content: flex-start; }
.da-nav-item:hover { color: var(--fg-default); background: var(--bg-subtle-hover); }
.da-nav-item.active {
  color: var(--item-accent, var(--accent-blue));
  background: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 9%, transparent);
  border-color: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 16%, transparent);
}
.da-nav-item.active:hover { background: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 13%, transparent); }
.da-nav-icon { width: 20px; height: 20px; display: grid; place-items: center; flex-shrink: 0; color: inherit; position: relative; }
.da-nav-label {
  font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  opacity: 0; max-width: 0; transform: translateX(-6px);
  transition: max-width ${DURATION_SIDEBAR} ${EASE_OUT}, opacity 150ms ease, transform ${DURATION_SIDEBAR} ${EASE_OUT};
  color: inherit; letter-spacing: -0.01em; flex: 1;
}
.da-nav-item.active .da-nav-label { font-weight: 600; }
.da-sidebar.expanded .da-nav-label { opacity: 1; max-width: 160px; transform: translateX(0); }

.da-nav-pip {
  position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; border-radius: 0 3px 3px 0;
  background: var(--item-accent, var(--accent-blue));
  height: 0; transition: height 200ms var(--spring);
  box-shadow: 0 0 8px color-mix(in srgb, var(--item-accent, var(--accent-blue)) 70%, transparent);
}
.da-nav-item.active .da-nav-pip { height: 18px; }

.da-nav-badge {
  display: none; height: 16px; padding: 0 5px; border-radius: 4px;
  font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
  background: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 12%, transparent);
  color: var(--item-accent, var(--accent-blue));
  border: 1px solid color-mix(in srgb, var(--item-accent, var(--accent-blue)) 20%, transparent);
  flex-shrink: 0; align-items: center; justify-content: center;
  animation: badgePop 250ms var(--spring) both; text-transform: uppercase;
}
.da-sidebar.expanded .da-nav-badge { display: flex; }

/* ── Learning Progress Widget ─────────────────────────────── */
.da-lc-widget { flex-shrink: 0; padding: 8px 6px; border-top: 1px solid var(--sidebar-border); }
.da-lc-widget-inner {
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent-emerald) 5%, var(--bg-subtle));
  border: 1px solid color-mix(in srgb, var(--accent-emerald) 14%, transparent);
  padding: 10px; display: flex; align-items: center; gap: 0; overflow: hidden;
  transition: gap ${DURATION_SIDEBAR} ${EASE_OUT}; justify-content: center; cursor: pointer;
}
.da-sidebar.expanded .da-lc-widget-inner { gap: 9px; justify-content: flex-start; }
.da-lc-widget-ring { width: 32px; height: 32px; flex-shrink: 0; position: relative; display: grid; place-items: center; }
.da-lc-widget-info {
  flex: 1; min-width: 0; opacity: 0; transform: translateX(-4px);
  transition: opacity 140ms ease, transform 160ms ease; pointer-events: none; overflow: hidden;
}
.da-sidebar.expanded .da-lc-widget-info { opacity: 1; transform: translateX(0); pointer-events: auto; }
.da-lc-widget-level { font-size: 11px; font-weight: 700; color: var(--fg-default); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.da-lc-widget-xp { font-size: 10px; color: var(--accent-emerald); font-weight: 600; margin-top: 1px; }
.da-lc-widget-streak { display: flex; align-items: center; gap: 3px; font-size: 10px; color: var(--accent-amber); font-weight: 600; margin-top: 2px; }

/* ── Sidebar user ─────────────────────────────────────────── */
.da-sidebar-user { padding: 8px 6px; border-top: 1px solid var(--sidebar-border); flex-shrink: 0; }
.da-sidebar-user-inner {
  display: flex; align-items: center; gap: 0; padding: 8px;
  border-radius: 9px; background: var(--bg-subtle); border: 1px solid var(--border); overflow: hidden;
  transition: gap ${DURATION_SIDEBAR} ${EASE_OUT}, padding ${DURATION_SIDEBAR} ${EASE_OUT};
  justify-content: center;
}
.da-sidebar.expanded .da-sidebar-user-inner { gap: 9px; justify-content: flex-start; }
.da-sidebar-avatar { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-size: 11px; font-weight: 700; flex-shrink: 0; position: relative; }
.da-sidebar-avatar-online { position: absolute; bottom: -1px; right: -1px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent-emerald); border: 1.5px solid var(--sidebar-bg); }
.da-sidebar-avatar-online::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; background: var(--accent-emerald); animation: ping 2s cubic-bezier(0,0,.2,1) infinite; opacity: 0.35; }
.da-sidebar-user-info { flex: 1; min-width: 0; overflow: hidden; opacity: 0; transform: translateX(-4px); transition: opacity 140ms ease, transform 160ms ease; pointer-events: none; }
.da-sidebar.expanded .da-sidebar-user-info { opacity: 1; transform: translateX(0); pointer-events: auto; }
.da-sidebar-user-name { font-size: 12px; font-weight: 600; color: var(--fg-default); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -0.01em; }
.da-sidebar-user-role { font-size: 10px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; margin-top: 1px; }
.da-sidebar-logout {
  width: 0; height: 26px; border-radius: 6px; border: 1px solid transparent;
  background: transparent; color: var(--fg-muted); display: grid; place-items: center;
  flex-shrink: 0; overflow: hidden; opacity: 0; padding: 0;
  transition: opacity 140ms ease, width 180ms ease, color 120ms ease, background 120ms ease; pointer-events: none;
}
.da-sidebar.expanded .da-sidebar-logout { opacity: 1; width: 26px; pointer-events: auto; }
.da-sidebar-logout:hover { color: var(--accent-rose); background: color-mix(in srgb, var(--accent-rose) 10%, transparent); border-color: color-mix(in srgb, var(--accent-rose) 25%, transparent); }

/* ── Header ──────────────────────────────────────────────── */
.da-header {
  position: fixed; top: 0;
  left: var(--sidebar-w, ${SIDEBAR_W_COLLAPSED}px); right: 0; z-index: 30; height: 56px;
  display: flex; align-items: center; padding: 0 20px;
  background: var(--header-bg); border-bottom: 1px solid var(--header-border);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); gap: 10px;
  transition: left ${DURATION_SIDEBAR} ${EASE_OUT}; will-change: left;
}
.da-sidebar.expanded ~ .da-page-root .da-header { left: ${SIDEBAR_W_EXPANDED}px; }
.da-header-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.da-header-right { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }

.da-breadcrumb { display: flex; align-items: center; gap: 6px; font-size: 13px; overflow: hidden; }
.da-breadcrumb-root { color: var(--fg-muted); font-weight: 400; white-space: nowrap; }
.da-breadcrumb-sep { color: var(--fg-subtle); }
.da-breadcrumb-current { font-weight: 600; color: var(--fg-default); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; animation: fadeIn 180ms ease both; }

.da-pill-btn {
  display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px;
  border-radius: 8px; border: 1px solid var(--border-strong); background: var(--bg-elevated);
  color: var(--fg-muted); font-size: 12px; font-weight: 500; font-family: inherit;
  cursor: pointer; transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
  white-space: nowrap; flex-shrink: 0;
}
.da-pill-btn:hover { color: var(--fg-default); background: var(--bg-overlay); }

.da-icon-btn {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border);
  background: transparent; color: var(--fg-muted); display: grid; place-items: center;
  cursor: pointer; transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
  flex-shrink: 0; position: relative;
}
.da-icon-btn:hover { color: var(--fg-default); background: var(--bg-subtle-hover); }
.da-icon-btn.active { color: var(--accent-blue); border-color: color-mix(in srgb, var(--accent-blue) 30%, transparent); background: color-mix(in srgb, var(--accent-blue) 8%, transparent); }
.da-icon-btn-badge { position: absolute; top: 5px; right: 5px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent-rose); border: 1.5px solid var(--header-bg); animation: badgePop 300ms var(--spring) both; }

.da-sign-out-btn {
  display: flex; align-items: center; gap: 5px; height: 32px; padding: 0 11px;
  border-radius: 8px; border: 1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent);
  background: color-mix(in srgb, var(--accent-rose) 7%, transparent);
  color: var(--accent-rose); font-size: 12px; font-weight: 600; font-family: inherit;
  cursor: pointer; transition: background 120ms ease, border-color 120ms ease; white-space: nowrap; flex-shrink: 0;
}
.da-sign-out-btn:hover { background: color-mix(in srgb, var(--accent-rose) 12%, transparent); border-color: color-mix(in srgb, var(--accent-rose) 40%, transparent); }

.da-user-chip { display: flex; align-items: center; gap: 8px; height: 32px; padding: 0 10px 0 6px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-subtle); }
.da-user-chip-avatar { width: 22px; height: 22px; border-radius: 6px; display: grid; place-items: center; font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0; }
.da-user-chip-name { font-size: 12px; font-weight: 600; color: var(--fg-default); letter-spacing: -0.01em; }
.da-user-chip-role { font-size: 10px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; }

.da-pin-btn { display: none; }
@media (min-width: ${COMPACT_BP}px) { .da-pin-btn { display: grid; } }
.da-hdivider { width: 1px; height: 16px; background: var(--border); flex-shrink: 0; }

/* ── Notification Dropdown ─────────────────────────────────── */
.da-notif-wrap { position: relative; }
.da-notif-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 300px; background: var(--bg-elevated); border: 1px solid var(--border-strong); border-radius: 14px; box-shadow: var(--shadow-lg); animation: slideDown 160ms var(--spring) both; overflow: hidden; z-index: 200; }
.da-notif-header { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.da-notif-title { font-size: 13px; font-weight: 700; color: var(--fg-default); letter-spacing: -0.01em; }
.da-notif-mark-all { font-size: 11px; color: var(--accent-blue); cursor: pointer; font-weight: 600; background: none; border: none; padding: 0; }
.da-notif-mark-all:hover { opacity: 0.8; }
.da-notif-list { max-height: 320px; overflow-y: auto; }
.da-notif-item { display: flex; align-items: flex-start; gap: 10px; padding: 11px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 100ms ease; position: relative; }
.da-notif-item:last-child { border-bottom: none; }
.da-notif-item:hover { background: var(--bg-subtle-hover); }
.da-notif-item.unread::before { content: ''; position: absolute; left: 6px; top: 50%; transform: translateY(-50%); width: 5px; height: 5px; border-radius: 50%; background: var(--accent-blue); }
.da-notif-icon { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; font-size: 13px; flex-shrink: 0; }
.da-notif-text { flex: 1; }
.da-notif-text-title { font-size: 12px; font-weight: 600; color: var(--fg-default); line-height: 1.4; }
.da-notif-text-sub { font-size: 11px; color: var(--fg-muted); margin-top: 2px; }
.da-notif-time { font-size: 10px; color: var(--fg-subtle); flex-shrink: 0; margin-top: 2px; }
.da-notif-empty { padding: 28px 16px; text-align: center; color: var(--fg-muted); font-size: 12px; }

/* ── Page root ───────────────────────────────────────────── */
.da-page-root { flex: 1; min-width: 0; margin-left: var(--sidebar-w, ${SIDEBAR_W_COLLAPSED}px); padding-top: 56px; transition: margin-left ${DURATION_SIDEBAR} ${EASE_OUT}; will-change: margin-left; }
.da-sidebar.expanded ~ .da-page-root { margin-left: ${SIDEBAR_W_EXPANDED}px; }

.da-content { padding: 24px; min-height: calc(100vh - 56px); }
.da-route-fade { animation: routeFade 220ms ${EASE_OUT} both; }
@media (max-width: ${COMPACT_BP - 1}px) { .da-content { padding: 16px 16px 80px; } }

/* ── Keyboard Shortcuts Modal ────────────────────────────── */
.da-shortcuts-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.55); backdrop-filter: blur(5px); animation: fadeIn 120ms ease both; display: flex; align-items: center; justify-content: center; padding: 24px; }
.da-shortcuts-card { width: min(540px, 100%); background: var(--bg-elevated); border: 1px solid var(--border-strong); border-radius: 18px; box-shadow: var(--shadow-lg); overflow: hidden; animation: scaleIn 200ms var(--spring) both; }
.da-shortcuts-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
.da-shortcuts-body { padding: 16px 24px 20px; display: flex; flex-direction: column; gap: 6px; }
.da-shortcuts-section { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-muted); margin: 10px 0 6px; }
.da-shortcut-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--border); }
.da-shortcut-row:last-child { border-bottom: none; }
.da-shortcut-desc { font-size: 13px; color: var(--fg-default); font-weight: 500; }
.da-shortcut-keys { display: flex; gap: 4px; align-items: center; }
.da-key { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--fg-muted); background: var(--bg-subtle); border: 1px solid var(--border-strong); border-radius: 5px; padding: 2px 7px; line-height: 1.5; }

/* ── Bottom Tab Bar (mobile) ─────────────────────────────── */
.da-bottom-nav { display: none; position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; height: 64px; padding: 0 4px; background: var(--sidebar-bg); border-top: 1px solid var(--sidebar-border); backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px); align-items: center; justify-content: space-around; animation: bottomUp 280ms var(--spring) both; }
@media (max-width: ${BOTTOM_NAV_BP}px) { .da-bottom-nav { display: flex; } }
.da-bottom-nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; height: 100%; border: none; background: transparent; color: var(--fg-muted); font-family: inherit; cursor: pointer; transition: color 120ms ease; position: relative; padding: 8px 4px; border-radius: 8px; min-width: 0; }
.da-bottom-nav-item.active { color: var(--accent-blue); }
.da-bottom-nav-item:hover { color: var(--fg-default); }
.da-bottom-nav-icon { font-size: 18px; line-height: 1; }
.da-bottom-nav-label { font-size: 9px; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.da-bottom-nav-pip { position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); width: 18px; height: 3px; border-radius: 999px; background: var(--accent-blue); opacity: 0; transition: opacity 150ms ease; }
.da-bottom-nav-item.active .da-bottom-nav-pip { opacity: 1; }

/* ── Command Palette ─────────────────────────────────────── */
.da-cmd-backdrop { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.55); backdrop-filter: blur(6px); animation: fadeIn 120ms ease both; display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; }
.da-cmd-palette { width: min(600px, 94vw); border-radius: 16px; border: 1px solid var(--border-strong); background: var(--bg-overlay); box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.03); overflow: hidden; animation: cmdIn 160ms var(--spring) both; }
.da-cmd-input-wrap { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.da-cmd-input { flex: 1; background: transparent; border: none; outline: none; font-size: 15px; font-weight: 400; font-family: inherit; color: var(--fg-default); letter-spacing: -0.01em; }
.da-cmd-input::placeholder { color: var(--fg-muted); }
.da-cmd-results { max-height: 380px; overflow-y: auto; padding: 6px; }
.da-cmd-section-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-subtle); padding: 8px 10px 4px; }
.da-cmd-item { display: flex; align-items: center; gap: 10px; height: 42px; padding: 0 10px; border-radius: 9px; cursor: pointer; transition: background 80ms ease; border: 1px solid transparent; }
.da-cmd-item:hover, .da-cmd-item.selected { background: var(--bg-subtle-hover); border-color: var(--border); }
.da-cmd-item-icon { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; font-size: 13px; }
.da-cmd-item-label { flex: 1; font-size: 13px; font-weight: 500; color: var(--fg-default); letter-spacing: -0.01em; }
.da-cmd-item-group { font-size: 11px; color: var(--fg-muted); }
.da-cmd-item-recent { font-size: 10px; color: var(--fg-subtle); }
.da-cmd-shortcut { font-size: 11px; font-family: var(--font-mono); color: var(--fg-muted); background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; }
.da-cmd-empty { padding: 32px 16px; text-align: center; color: var(--fg-muted); font-size: 13px; }
.da-cmd-footer { display: flex; align-items: center; gap: 12px; padding: 8px 14px; border-top: 1px solid var(--border); font-size: 11px; color: var(--fg-subtle); font-family: var(--font-mono); }
.da-cmd-footer kbd { font-family: var(--font-mono); font-size: 10px; background: var(--bg-subtle); border: 1px solid var(--border-strong); border-radius: 4px; padding: 1px 5px; color: var(--fg-muted); }

/* ── Loader ──────────────────────────────────────────────── */
.da-loader-shell { position: fixed; inset: 0; display: grid; place-items: center; background: var(--bg-base); z-index: 9999; animation: fadeIn 200ms ease; }
.da-loader-card { display: flex; align-items: center; gap: 28px; padding: 32px 36px; border-radius: 22px; border: 1px solid var(--border-strong); background: linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 94%, transparent), color-mix(in srgb, var(--bg-overlay) 86%, transparent)); box-shadow: var(--shadow-lg); animation: scaleIn 300ms var(--spring) both; min-width: min(580px, calc(100vw - 36px)); }
.da-loader-visual { position: relative; width: 120px; height: 120px; flex-shrink: 0; display: grid; place-items: center; filter: drop-shadow(0 14px 26px rgba(0,0,0,0.45)); }
.da-loader-visual::before { content: ''; position: absolute; inset: 14px; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--accent-blue) 20%, transparent) 0%, transparent 72%); filter: blur(10px); opacity: 0.9; }
.da-loader-disc-spin { position: absolute; inset: 0; animation: spin 1.15s linear infinite; will-change: transform; }
.da-loader-svg { width: 100%; height: 100%; display: block; overflow: visible; }
.da-loader-caliper { position: absolute; inset: 0; pointer-events: none; }
.da-loader-copy { min-width: 0; }
.da-loader-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-blue); margin-bottom: 5px; }
.da-loader-headline { font-size: 21px; font-weight: 700; color: var(--fg-default); letter-spacing: -0.025em; }
.da-loader-sub { font-size: 13px; color: var(--fg-muted); margin-top: 6px; line-height: 1.55; max-width: 360px; }
.da-loader-bar { height: 3px; margin-top: 18px; border-radius: 999px; background: var(--border); overflow: hidden; width: min(280px, 100%); }
.da-loader-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent-blue), var(--accent-violet), var(--accent-cyan)); background-size: 200%; animation: shimmer 1.5s linear infinite; }
@media (max-width: 640px) { .da-loader-card { min-width: 0; width: calc(100vw - 24px); flex-direction: column; align-items: flex-start; padding: 24px; } .da-loader-visual { width: 104px; height: 104px; } .da-loader-bar { width: 100%; } }

/* ── Profile panel ───────────────────────────────────────── */
.da-profile-panel { max-width: 600px; padding: 32px; border-radius: 16px; background: var(--bg-elevated); border: 1px solid var(--border); animation: fadeUp 220ms var(--ease-out) both; }
.da-profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; }
@media (max-width: 500px) { .da-profile-grid { grid-template-columns: 1fr; } }
.da-profile-field { padding: 12px 16px; border-radius: 10px; background: var(--bg-subtle); border: 1px solid var(--border); }
.da-profile-field-label { font-size: 10px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fg-muted); margin-bottom: 4px; }
.da-profile-field-value { font-size: 13px; font-weight: 500; color: var(--fg-default); letter-spacing: -0.01em; }

/* ── Error card ──────────────────────────────────────────── */
.da-error-card { max-width: 420px; padding: 36px; border-radius: 18px; background: var(--bg-elevated); border: 1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent); text-align: center; animation: scaleIn 280ms var(--spring) both; }

/* ── Clock ───────────────────────────────────────────────── */
.da-clock { font-family: var(--font-mono); font-size: 12px; font-weight: 400; color: var(--fg-muted); letter-spacing: 0.05em; user-select: none; display: flex; align-items: center; gap: 1px; }
.da-clock-colon { animation: blink 1s step-end infinite; }

/* ── Compact nav (tablet, >768 <1024) ─────────────────────── */
.da-compact-nav { position: sticky; top: 56px; z-index: 20; display: flex; gap: 2px; padding: 8px 16px; overflow-x: auto; border-bottom: 1px solid var(--border); background: var(--header-bg); backdrop-filter: blur(16px); scrollbar-width: none; }
.da-compact-nav::-webkit-scrollbar { display: none; }
@media (max-width: ${BOTTOM_NAV_BP}px) { .da-compact-nav { display: none; } }
.da-compact-nav-item { display: flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 7px; border: 1px solid transparent; background: transparent; color: var(--fg-muted); font-size: 12px; font-weight: 500; font-family: inherit; cursor: pointer; white-space: nowrap; transition: all 120ms ease; flex-shrink: 0; }
.da-compact-nav-item:hover { color: var(--fg-default); background: var(--bg-subtle-hover); }
.da-compact-nav-item.active { color: var(--item-accent, var(--accent-blue)); background: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 10%, transparent); border-color: color-mix(in srgb, var(--item-accent, var(--accent-blue)) 20%, transparent); font-weight: 600; }

@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
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
