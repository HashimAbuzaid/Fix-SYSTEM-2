import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

const LOGO_MARK_SRC = '/detroit-axle-mark.png';
const LOGO_WORDMARK_SRC = '/detroit-axle-wordmark.svg';

// ─── Keyframes injected once ───────────────────────────────────────────────
const STYLE_ID = 'da-login-styles';
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes da-login-fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes da-login-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes da-login-slide-right {
    from { opacity: 0; transform: translateX(-20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes da-login-rotor-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes da-login-rotor-reverse {
    from { transform: rotate(0deg); }
    to   { transform: rotate(-360deg); }
  }
  @keyframes da-login-caliper-breathe {
    0%, 100% { transform: translateX(0); }
    50%       { transform: translateX(2px); }
  }
  @keyframes da-login-grid-scroll {
    from { transform: translateY(0); }
    to   { transform: translateY(-60px); }
  }
  @keyframes da-login-shimmer {
    0%   { background-position: -300% 0; }
    100% { background-position:  300% 0; }
  }
  @keyframes da-login-pip-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
    50%       { box-shadow: 0 0 0 6px rgba(59,130,246,0); }
  }
  @keyframes da-login-bar-fill {
    from { width: 0%; }
    to   { width: 100%; }
  }
  @keyframes da-login-error-shake {
    0%, 100% { transform: translateX(0); }
    15%       { transform: translateX(-6px); }
    30%       { transform: translateX(5px); }
    45%       { transform: translateX(-4px); }
    60%       { transform: translateX(3px); }
    75%       { transform: translateX(-2px); }
    90%       { transform: translateX(1px); }
  }
  @keyframes da-login-scan-line {
    from { top: -4px; }
    to   { top: calc(100% + 4px); }
  }
  @keyframes da-login-float {
    0%, 100% { transform: translateY(0px) rotate(var(--float-rotate, 0deg)); }
    50%       { transform: translateY(-8px) rotate(var(--float-rotate, 0deg)); }
  }

  .da-login-shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 0;
    background: #060a12;
    font-family: 'Geist', system-ui, sans-serif;
    position: relative;
    overflow: hidden;
  }

  /* Animated grid background */
  .da-login-grid-bg {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(59,130,246,0.055) 1px, transparent 1px),
      linear-gradient(90deg, rgba(59,130,246,0.055) 1px, transparent 1px);
    background-size: 48px 48px;
    animation: da-login-grid-scroll 8s linear infinite;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
  }

  /* Ambient light bleeds */
  .da-login-glow-1 {
    position: absolute;
    top: -160px; left: -120px;
    width: 540px; height: 540px;
    background: radial-gradient(circle, rgba(37,99,235,0.2) 0%, transparent 68%);
    pointer-events: none;
    animation: da-login-float 7s ease-in-out infinite;
    --float-rotate: -3deg;
  }
  .da-login-glow-2 {
    position: absolute;
    bottom: -140px; right: -100px;
    width: 480px; height: 480px;
    background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 68%);
    pointer-events: none;
    animation: da-login-float 9s ease-in-out infinite 2s;
    --float-rotate: 4deg;
  }
  .da-login-glow-3 {
    position: absolute;
    top: 40%; left: 50%;
    transform: translate(-50%, -50%);
    width: 900px; height: 400px;
    background: radial-gradient(ellipse, rgba(30,58,138,0.12) 0%, transparent 70%);
    pointer-events: none;
  }

  /* Main layout */
  .da-login-layout {
    position: relative;
    z-index: 10;
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 100vh;
    width: 100%;
  }

  /* Left panel — brand */
  .da-login-brand {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 52px 56px;
    position: relative;
    overflow: hidden;
    border-right: 1px solid rgba(59,130,246,0.1);
  }
  .da-login-brand::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(37,99,235,0.06) 0%, transparent 60%);
    pointer-events: none;
  }

  /* Rotor visual */
  .da-login-rotor-wrap {
    position: absolute;
    right: -120px;
    top: 50%;
    transform: translateY(-50%);
    width: 480px;
    height: 480px;
    opacity: 0.18;
  }
  .da-login-rotor-outer {
    position: absolute;
    inset: 0;
    animation: da-login-rotor-spin 18s linear infinite;
  }
  .da-login-rotor-inner {
    position: absolute;
    inset: 80px;
    animation: da-login-rotor-reverse 12s linear infinite;
  }
  .da-login-caliper-visual {
    position: absolute;
    right: 96px;
    top: 50%;
    transform: translateY(-50%);
    animation: da-login-caliper-breathe 2.8s ease-in-out infinite;
    opacity: 0.22;
  }

  /* Brand header */
  .da-login-brand-logo {
    display: flex;
    align-items: center;
    gap: 14px;
    animation: da-login-slide-right 0.6s cubic-bezier(0.16,1,0.3,1) both;
  }
  .da-login-brand-mark {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(37,99,235,0.08) 100%);
    border: 1px solid rgba(59,130,246,0.3);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    overflow: hidden;
  }
  .da-login-brand-wordmark {
    height: 28px;
    object-fit: contain;
    object-position: left;
    opacity: 0.9;
    filter: brightness(0) invert(1);
  }

  /* Brand center content */
  .da-login-brand-center {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 48px 0 0 0;
  }
  .da-login-brand-tag {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 11px 5px 9px;
    border-radius: 999px;
    border: 1px solid rgba(59,130,246,0.28);
    background: rgba(37,99,235,0.1);
    width: fit-content;
    margin-bottom: 28px;
    animation: da-login-slide-right 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both;
  }
  .da-login-brand-pip {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
    animation: da-login-pip-pulse 2s ease-in-out infinite;
  }
  .da-login-brand-tag-text {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #60a5fa;
    font-family: 'Geist Mono', monospace;
  }

  .da-login-brand-headline {
    font-size: clamp(36px, 4vw, 52px);
    font-weight: 800;
    line-height: 1.04;
    letter-spacing: -0.035em;
    color: #f8fafc;
    margin-bottom: 20px;
    animation: da-login-slide-right 0.65s cubic-bezier(0.16,1,0.3,1) 0.15s both;
  }
  .da-login-brand-headline em {
    font-style: normal;
    background: linear-gradient(90deg, #60a5fa, #818cf8, #38bdf8);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    background-size: 200%;
    animation: da-login-shimmer 3s linear infinite;
  }

  .da-login-brand-copy {
    font-size: 15px;
    line-height: 1.7;
    color: rgba(148,163,184,0.8);
    font-weight: 400;
    max-width: 360px;
    margin-bottom: 44px;
    animation: da-login-slide-right 0.65s cubic-bezier(0.16,1,0.3,1) 0.2s both;
  }

  /* Feature pills */
  .da-login-features {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: da-login-fade-up 0.6s cubic-bezier(0.16,1,0.3,1) 0.3s both;
  }
  .da-login-feature {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 13px 16px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.05);
    background: rgba(255,255,255,0.025);
    transition: border-color 200ms ease, background 200ms ease;
  }
  .da-login-feature:hover {
    border-color: rgba(59,130,246,0.2);
    background: rgba(37,99,235,0.06);
  }
  .da-login-feature-icon {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: rgba(37,99,235,0.12);
    border: 1px solid rgba(59,130,246,0.2);
    display: grid;
    place-items: center;
    flex-shrink: 0;
    color: #60a5fa;
  }
  .da-login-feature-text {
    font-size: 13px;
    font-weight: 500;
    color: rgba(203,213,225,0.85);
    letter-spacing: -0.01em;
  }

  /* Brand footer */
  .da-login-brand-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    animation: da-login-fade-in 0.6s ease 0.5s both;
  }
  .da-login-brand-footer-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: rgba(100,116,139,0.5);
  }
  .da-login-brand-footer-text {
    font-size: 11px;
    font-family: 'Geist Mono', monospace;
    color: rgba(100,116,139,0.6);
    letter-spacing: 0.06em;
  }

  /* Right panel — form */
  .da-login-form-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 52px 56px;
    position: relative;
    background: rgba(8,12,22,0.6);
  }

  /* Scan line effect on form */
  .da-login-scan {
    position: absolute;
    left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.3) 50%, transparent 100%);
    animation: da-login-scan-line 4s ease-in-out infinite;
    pointer-events: none;
    z-index: 1;
  }

  .da-login-form-inner {
    width: 100%;
    max-width: 420px;
    position: relative;
    z-index: 2;
  }

  /* Form header */
  .da-login-form-eyebrow {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #3b82f6;
    font-family: 'Geist Mono', monospace;
    margin-bottom: 12px;
    animation: da-login-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) 0.2s both;
  }
  .da-login-form-title {
    font-size: 30px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #f1f5f9;
    line-height: 1.1;
    margin-bottom: 8px;
    animation: da-login-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) 0.25s both;
  }
  .da-login-form-sub {
    font-size: 13px;
    color: rgba(100,116,139,0.9);
    line-height: 1.6;
    margin-bottom: 36px;
    animation: da-login-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) 0.3s both;
  }

  /* Form fields */
  .da-login-field {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-bottom: 16px;
    animation: da-login-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) 0.35s both;
  }
  .da-login-field:last-of-type {
    animation-delay: 0.4s;
  }
  .da-login-label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(148,163,184,0.9);
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .da-login-input-wrap {
    position: relative;
  }
  .da-login-input-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(100,116,139,0.7);
    pointer-events: none;
    display: grid;
    place-items: center;
    transition: color 200ms ease;
  }
  .da-login-input {
    width: 100%;
    height: 46px;
    padding: 0 16px 0 42px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.04);
    color: #f1f5f9;
    font-size: 14px;
    font-family: 'Geist', system-ui, sans-serif;
    font-weight: 400;
    letter-spacing: -0.01em;
    outline: none;
    transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
    -webkit-autofill: none;
  }
  .da-login-input::placeholder {
    color: rgba(100,116,139,0.5);
  }
  .da-login-input:focus {
    border-color: rgba(59,130,246,0.5);
    background: rgba(37,99,235,0.06);
    box-shadow: 0 0 0 3px rgba(37,99,235,0.12), inset 0 0 0 1px rgba(59,130,246,0.1);
  }
  .da-login-input-wrap:focus-within .da-login-input-icon {
    color: #3b82f6;
  }

  /* Error / success banners */
  .da-login-banner {
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 18px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    line-height: 1.5;
  }
  .da-login-banner.error {
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.25);
    color: #fca5a5;
    animation: da-login-error-shake 0.45s cubic-bezier(0.36,0.07,0.19,0.97) both;
  }
  .da-login-banner.success {
    background: rgba(16,185,129,0.08);
    border: 1px solid rgba(16,185,129,0.25);
    color: #6ee7b7;
  }
  .da-login-banner-icon {
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* Buttons */
  .da-login-btn-primary {
    width: 100%;
    height: 48px;
    border-radius: 12px;
    border: 1px solid rgba(96,165,250,0.3);
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 60%, #1e40af 100%);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    font-family: 'Geist', system-ui, sans-serif;
    letter-spacing: -0.01em;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: transform 120ms ease, box-shadow 180ms ease, opacity 150ms ease;
    box-shadow: 0 4px 20px rgba(37,99,235,0.3), inset 0 1px 0 rgba(255,255,255,0.12);
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    animation: da-login-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) 0.45s both;
  }
  .da-login-btn-primary::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
    background-size: 300%;
    opacity: 0;
    transition: opacity 300ms ease;
  }
  .da-login-btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 28px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
  }
  .da-login-btn-primary:hover::before { opacity: 1; animation: da-login-shimmer 1.5s linear; }
  .da-login-btn-primary:active:not(:disabled) { transform: translateY(0); }
  .da-login-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

  .da-login-btn-ghost {
    width: 100%;
    height: 44px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.07);
    background: transparent;
    color: rgba(148,163,184,0.8);
    font-size: 13px;
    font-weight: 500;
    font-family: 'Geist', system-ui, sans-serif;
    cursor: pointer;
    transition: color 150ms ease, border-color 150ms ease, background 150ms ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    animation: da-login-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) 0.5s both;
  }
  .da-login-btn-ghost:hover:not(:disabled) {
    color: #e2e8f0;
    border-color: rgba(255,255,255,0.13);
    background: rgba(255,255,255,0.04);
  }
  .da-login-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Loading spinner */
  .da-login-spinner {
    width: 16px; height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.25);
    border-top-color: rgba(255,255,255,0.85);
    animation: da-login-rotor-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  /* Divider */
  .da-login-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
    animation: da-login-fade-in 0.5s ease 0.55s both;
  }
  .da-login-divider-line {
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.06);
  }
  .da-login-divider-text {
    font-size: 11px;
    font-family: 'Geist Mono', monospace;
    color: rgba(100,116,139,0.5);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Footer note */
  .da-login-form-footer {
    margin-top: 28px;
    text-align: center;
    animation: da-login-fade-in 0.5s ease 0.6s both;
  }
  .da-login-form-footer-text {
    font-size: 11px;
    font-family: 'Geist Mono', monospace;
    color: rgba(71,85,105,0.7);
    letter-spacing: 0.04em;
    line-height: 1.7;
  }

  /* Progress bar for loading state */
  .da-login-progress {
    position: absolute;
    bottom: 0; left: 0;
    height: 2px;
    background: linear-gradient(90deg, #2563eb, #818cf8, #38bdf8);
    border-radius: 0 1px 1px 0;
    animation: da-login-bar-fill 1.8s cubic-bezier(0.4,0,0.2,1) forwards;
  }

  /* Responsive */
  @media (max-width: 800px) {
    .da-login-layout {
      grid-template-columns: 1fr;
    }
    .da-login-brand {
      display: none;
    }
    .da-login-form-panel {
      padding: 40px 28px;
    }
  }
`;

function injectStyles() {
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }
}

// ─── Icon primitives ───────────────────────────────────────────────────────
function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  );
}

// ─── Rotor SVG (decorative, left panel) ───────────────────────────────────
function RotorSVG({ size }: { size: number }) {
  const slots = Array.from({ length: 12 }, (_, i) => i * 30);
  const bolts = [0, 60, 120, 180, 240, 300];
  const cx = size / 2, cy = size / 2, r = size / 2 - 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <radialGradient id="rg-outer" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="50%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#1e293b" />
        </radialGradient>
        <radialGradient id="rg-hub" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="url(#rg-outer)" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={r * 0.6} fill="#0f1928" />
      <circle cx={cx} cy={cy} r={r * 0.58} fill="url(#rg-outer)" opacity={0.5} />
      {slots.map(angle => {
        const rad = (angle * Math.PI) / 180;
        const x1 = cx + Math.cos(rad) * (r * 0.64);
        const y1 = cy + Math.sin(rad) * (r * 0.64);
        const x2 = cx + Math.cos(rad) * (r * 0.86);
        const y2 = cy + Math.sin(rad) * (r * 0.86);
        return <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,0,0,0.5)" strokeWidth={8} strokeLinecap="round" />;
      })}
      <circle cx={cx} cy={cy} r={r * 0.32} fill="url(#rg-hub)" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
      {bolts.map(angle => {
        const rad = (angle * Math.PI) / 180;
        const bx = cx + Math.cos(rad) * (r * 0.2);
        const by = cy + Math.sin(rad) * (r * 0.2);
        return <circle key={angle} cx={bx} cy={by} r={r * 0.035} fill="#0d1520" stroke="rgba(255,255,255,0.1)" strokeWidth={0.8} />;
      })}
      <circle cx={cx} cy={cy} r={r * 0.1} fill="#060c18" stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} />
    </svg>
  );
}

// ─── Feature data ──────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    text: 'Live quality dashboards by role',
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    text: 'Recognition, monitoring & coaching',
  },
  {
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    text: 'Role-based access for every team',
  },
];

// ─── Main Component ────────────────────────────────────────────────────────
function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingRecovery, setSendingRecovery] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => { injectStyles(); }, []);

  async function handleLogin() {
    setErrorMessage('');
    setSuccessMessage('');
    if (!email || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setShowProgress(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    setShowProgress(false);
    if (error) setErrorMessage(error.message);
  }

  async function handleForgotPassword() {
    setErrorMessage('');
    setSuccessMessage('');
    if (!email) {
      setErrorMessage('Enter your email above, then click Forgot password.');
      return;
    }
    setSendingRecovery(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    setSendingRecovery(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setSuccessMessage('Recovery email sent — check your inbox to reset your password.');
  }

  return (
    <div className="da-login-shell">
      {/* Animated backgrounds */}
      <div className="da-login-grid-bg" />
      <div className="da-login-glow-1" />
      <div className="da-login-glow-2" />
      <div className="da-login-glow-3" />

      <div className="da-login-layout">
        {/* ── Left: Brand panel ── */}
        <div className="da-login-brand">
          {/* Decorative rotor background */}
          <div className="da-login-rotor-wrap">
            <div className="da-login-rotor-outer">
              <RotorSVG size={480} />
            </div>
          </div>

          {/* Logo */}
          <div className="da-login-brand-logo">
            <div className="da-login-brand-mark">
              <img src={LOGO_MARK_SRC} alt="Detroit Axle" style={{ width: 28, height: 28, objectFit: 'contain' }} />
            </div>
            <img src={LOGO_WORDMARK_SRC} alt="Detroit Axle" className="da-login-brand-wordmark" />
          </div>

          {/* Center content */}
          <div className="da-login-brand-center">
            <div className="da-login-brand-tag">
              <div className="da-login-brand-pip" />
              <span className="da-login-brand-tag-text">QA Command Center</span>
            </div>

            <h1 className="da-login-brand-headline">
              Quality assurance,<br />
              <em>built for precision.</em>
            </h1>

            <p className="da-login-brand-copy">
              One platform for audits, team monitoring, agent coaching, and performance reporting — purpose-built for Detroit Axle's QA teams.
            </p>

            <div className="da-login-features">
              {FEATURES.map((f, i) => (
                <div key={i} className="da-login-feature" style={{ animationDelay: `${0.3 + i * 0.06}s` }}>
                  <div className="da-login-feature-icon">{f.icon}</div>
                  <span className="da-login-feature-text">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="da-login-brand-footer">
            <div className="da-login-brand-footer-dot" />
            <span className="da-login-brand-footer-text">DETROIT AXLE QA PLATFORM</span>
            <div className="da-login-brand-footer-dot" />
            <span className="da-login-brand-footer-text">v2.0</span>
          </div>
        </div>

        {/* ── Right: Form panel ── */}
        <div className="da-login-form-panel">
          {showProgress && <div className="da-login-progress" />}
          <div className="da-login-scan" />

          <div className="da-login-form-inner" ref={formRef}>
            <div className="da-login-form-eyebrow">Secure Access</div>
            <h2 className="da-login-form-title">Sign in to your<br />workspace</h2>
            <p className="da-login-form-sub">
              Use your Detroit Axle credentials to continue.
            </p>

            {/* Banners */}
            {errorMessage && (
              <div className="da-login-banner error" role="alert">
                <span className="da-login-banner-icon"><AlertIcon /></span>
                <span>{errorMessage}</span>
              </div>
            )}
            {successMessage && (
              <div className="da-login-banner success" role="status">
                <span className="da-login-banner-icon"><CheckIcon /></span>
                <span>{successMessage}</span>
              </div>
            )}

            {/* Email field */}
            <div className="da-login-field">
              <label className="da-login-label" htmlFor="da-email">
                Email address
              </label>
              <div className="da-login-input-wrap">
                <span className="da-login-input-icon"><MailIcon /></span>
                <input
                  id="da-email"
                  type="email"
                  className="da-login-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@detroitaxle.com"
                  autoComplete="email"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            {/* Password field */}
            <div className="da-login-field">
              <label className="da-login-label" htmlFor="da-password">
                Password
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={sendingRecovery}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: sendingRecovery ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    color: '#60a5fa',
                    fontFamily: "'Geist', system-ui, sans-serif",
                    fontWeight: 500,
                    padding: 0,
                    opacity: sendingRecovery ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'color 150ms ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#93c5fd')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#60a5fa')}
                >
                  <KeyIcon />
                  {sendingRecovery ? 'Sending…' : 'Forgot password?'}
                </button>
              </label>
              <div className="da-login-input-wrap">
                <span className="da-login-input-icon"><LockIcon /></span>
                <input
                  id="da-password"
                  type="password"
                  className="da-login-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="da-login-divider">
              <div className="da-login-divider-line" />
            </div>

            {/* Login button */}
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className="da-login-btn-primary"
            >
              {loading ? (
                <>
                  <div className="da-login-spinner" />
                  Authenticating…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Sign in to workspace
                </>
              )}
            </button>

            {/* Footer */}
            <div className="da-login-form-footer">
              <p className="da-login-form-footer-text">
                Protected by Supabase Auth · Detroit Axle QA Platform
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
