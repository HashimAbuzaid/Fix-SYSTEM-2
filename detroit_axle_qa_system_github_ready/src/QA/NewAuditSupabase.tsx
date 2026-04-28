import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  memo,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { supabase } from '../lib/supabase';
import {
  clearAgentProfilesCache,
  getCachedAgentProfiles,
  type CachedAgentProfile,
  type TeamName,
} from '../lib/agentProfilesCache';
import { usePersistentState } from '../hooks/usePersistentState';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

type Metric = {
  name: string;
  pass: number;
  borderline: number;
  countsTowardScore?: boolean;
  options?: string[];
  defaultValue?: string;
};

type TeamType = TeamName | '';
type AgentProfile = CachedAgentProfile;

type CreatorProfile = {
  id: string;
  role: 'admin' | 'qa' | 'agent';
  agent_name: string;
  display_name: string | null;
  email: string;
};

type LastAuditSummary = {
  id: string;
  agentName: string;
  agentId: string | null;
  team: TeamType;
  caseType: string;
  auditDate: string;
  qualityScore: number | null;
  scoreDetails?: ScoreDetail[];
  orderNumber?: string | null;
  phoneNumber?: string | null;
  ticketId?: string | null;
};

type ScoreDetail = {
  metric: string;
  result: string;
  pass: number;
  borderline: number;
  adjustedWeight: number;
  earned: number;
  counts_toward_score: boolean;
  metric_comment: string | null;
};

type AuthMetadata = {
  display_name?: string;
  full_name?: string;
  name?: string;
};

type AuditDraft = {
  team: TeamType;
  selectedAgentProfileId: string;
  agentSearch: string;
  caseType: string;
  auditDate: string;
  orderNumber: string;
  phoneNumber: string;
  ticketId: string;
  comments: string;
  scores: Record<string, string>;
  metricComments: Record<string, string>;
};

type PanelSection = 'team' | 'agent' | 'details' | 'scorecard';

/* ═══════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════ */

const LOCKED_NA_METRICS = new Set(['Active Listening']);
const AUTO_FAIL_METRICS = new Set(['Hold (≤3 mins)', 'Procedure']);
const ISSUE_WAS_RESOLVED_METRIC = 'Issue was resolved';

const ISSUE_WAS_RESOLVED_QUESTION: Metric = {
  name: ISSUE_WAS_RESOLVED_METRIC,
  pass: 0,
  borderline: 0,
  countsTowardScore: false,
  options: ['', 'Yes', 'No'],
  defaultValue: '',
};

const callsMetrics: Metric[] = [
  { name: 'Greeting', pass: 2, borderline: 1 },
  { name: 'Friendliness', pass: 6, borderline: 4 },
  { name: 'Hold (≤3 mins)', pass: 9, borderline: 5 },
  { name: 'Call Managing', pass: 9, borderline: 5 },
  { name: 'Procedure', pass: 13, borderline: 7 },
  { name: 'Notes', pass: 13, borderline: 7 },
  { name: 'Creating REF Order', pass: 12, borderline: 6 },
  { name: 'Accuracy', pass: 13, borderline: 7 },
  { name: 'A-form', pass: 6, borderline: 3 },
  { name: 'Refund Form', pass: 11, borderline: 5 },
  { name: 'Providing RL', pass: 4, borderline: 2 },
  { name: 'Ending', pass: 2, borderline: 1 },
  ISSUE_WAS_RESOLVED_QUESTION,
];

const ticketsMetrics: Metric[] = [
  { name: 'Greeting', pass: 5, borderline: 3 },
  { name: 'Friendliness', pass: 5, borderline: 3 },
  { name: 'AI Detection', pass: 10, borderline: 5 },
  { name: 'Typing mistakes', pass: 5, borderline: 3 },
  { name: 'Procedure', pass: 12, borderline: 6 },
  { name: 'Notes', pass: 12, borderline: 6 },
  { name: 'Creating REF Order', pass: 12, borderline: 6 },
  { name: 'Accuracy', pass: 12, borderline: 6 },
  { name: 'A-form', pass: 11, borderline: 5 },
  { name: 'Refund Form', pass: 6, borderline: 3 },
  { name: 'Providing RL', pass: 5, borderline: 3 },
  { name: 'Ending', pass: 5, borderline: 3 },
  ISSUE_WAS_RESOLVED_QUESTION,
];

const salesMetrics: Metric[] = [
  { name: 'Greeting', pass: 2, borderline: 1 },
  { name: 'Friendliness', pass: 5, borderline: 3 },
  { name: 'Hold (≤3 mins)', pass: 10, borderline: 5 },
  { name: 'Call Managing', pass: 10, borderline: 5 },
  { name: 'Active Listening', pass: 5, borderline: 3 },
  { name: 'Polite', pass: 5, borderline: 3 },
  { name: 'Correct address', pass: 15, borderline: 7 },
  { name: 'Correct part was chosen', pass: 15, borderline: 7 },
  { name: 'ETA provided?', pass: 15, borderline: 7 },
  { name: 'Refund Form', pass: 5, borderline: 3 },
  { name: 'Up-selling', pass: 8, borderline: 4 },
  { name: 'Ending', pass: 5, borderline: 3 },
  ISSUE_WAS_RESOLVED_QUESTION,
];

const CASE_TYPES = [
  '',
  'Order status',
  'General Inquiry',
  'Exchange',
  'Missing Parts',
  'Refund - Store credit',
  'Delivered but not received',
  'FedEx Cases',
  'Replacement',
  'Warranty',
  'Fitment issue',
  'Damaged package',
  'Cancellation',
];

const TEAMS: Exclude<TeamType, ''>[] = ['Calls', 'Tickets', 'Sales'];

const TEAM_CONFIG: Record<string, { accent: string; icon: string; desc: string; key: string }> = {
  Calls: {
    accent: '#3b82f6',
    key: 'C',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.93 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    desc: 'Phone support',
  },
  Tickets: {
    accent: '#8b5cf6',
    key: 'T',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    desc: 'Written support',
  },
  Sales: {
    accent: '#10b981',
    key: 'S',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    desc: 'Sales calls',
  },
};

/* ═══════════════════════════════════════════════════════════
   Pure helpers
   ═══════════════════════════════════════════════════════════ */

function countsTowardScore(metric: Metric) {
  return metric.countsTowardScore !== false;
}

function shouldShowMetricComment(result: string) {
  return result === 'Borderline' || result === 'Fail' || result === 'Auto-Fail';
}

function pickPreferredName(values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return 'Unknown User';
}

function getMetricsForTeam(teamValue: TeamType): Metric[] {
  if (teamValue === 'Calls') return callsMetrics;
  if (teamValue === 'Tickets') return ticketsMetrics;
  if (teamValue === 'Sales') return salesMetrics;
  return [];
}

function isLockedToNA(metricName: string) {
  return LOCKED_NA_METRICS.has(metricName);
}

function canAutoFail(metricName: string) {
  return AUTO_FAIL_METRICS.has(metricName);
}

function getMetricOptions(metric: Metric) {
  if (metric.options?.length) return metric.options;
  if (isLockedToNA(metric.name)) return ['N/A'];
  const options = ['N/A', 'Pass', 'Borderline', 'Fail'];
  if (canAutoFail(metric.name)) options.push('Auto-Fail');
  return options;
}

function getMetricStoredValue(metric: Metric, scores: Record<string, string>) {
  if (isLockedToNA(metric.name)) return 'N/A';
  return scores[metric.name] ?? metric.defaultValue ?? 'N/A';
}

function createDefaultScores(teamValue: TeamType) {
  const defaults: Record<string, string> = {};
  getMetricsForTeam(teamValue).forEach((metric) => {
    defaults[metric.name] = metric.defaultValue ?? 'N/A';
  });
  return defaults;
}

function createEmptyDraft(teamValue: TeamType = ''): AuditDraft {
  return {
    team: teamValue,
    selectedAgentProfileId: '',
    agentSearch: '',
    caseType: '',
    auditDate: new Date().toISOString().split('T')[0], // Default to today
    orderNumber: '',
    phoneNumber: '',
    ticketId: '',
    comments: '',
    scores: createDefaultScores(teamValue),
    metricComments: {},
  };
}

function getMissingRequiredMetricLabels(teamValue: TeamType, scores: Record<string, string>) {
  return getMetricsForTeam(teamValue)
    .filter((metric) => Array.isArray(metric.options) && metric.defaultValue === '')
    .filter((metric) => !getMetricStoredValue(metric, scores))
    .map((metric) => metric.name);
}

function getAdjustedScoreData(
  team: TeamType,
  scores: Record<string, string>,
  metricComments: Record<string, string>
) {
  const metrics = getMetricsForTeam(team);
  const scoredMetrics = metrics.filter((item) => countsTowardScore(item));
  const activeMetrics = scoredMetrics.filter((item) => {
    const itemResult = getMetricStoredValue(item, scores);
    return itemResult !== 'N/A' && itemResult !== '';
  });
  const activeTotalWeight = activeMetrics.reduce((sum, item) => sum + item.pass, 0);
  const fullTotalWeight = scoredMetrics.reduce((sum, item) => sum + item.pass, 0);

  const scoreDetails: ScoreDetail[] = metrics.map((metric) => {
    const result = getMetricStoredValue(metric, scores);
    const scored = countsTowardScore(metric);
    const adjustedWeight =
      !scored || result === 'N/A' || result === '' || activeTotalWeight === 0
        ? 0
        : (metric.pass / activeTotalWeight) * fullTotalWeight;
    let earned = 0;
    if (scored && result === 'Pass') earned = adjustedWeight;
    else if (scored && result === 'Borderline')
      earned = metric.pass > 0 ? adjustedWeight * (metric.borderline / metric.pass) : 0;
    return {
      metric: metric.name,
      result,
      pass: metric.pass,
      borderline: metric.borderline,
      adjustedWeight,
      earned,
      counts_toward_score: scored,
      metric_comment:
        scored && shouldShowMetricComment(result)
          ? (metricComments[metric.name] || '').trim() || null
          : null,
    };
  });

  const hasAutoFail = scoreDetails.some(
    (item) => item.counts_toward_score && canAutoFail(item.metric) && item.result === 'Auto-Fail'
  );
  const qualityScore = hasAutoFail
    ? '0.00'
    : scoreDetails
        .filter((item) => item.counts_toward_score)
        .reduce((sum, item) => sum + item.earned, 0)
        .toFixed(2);

  return { scoreDetails, qualityScore, hasAutoFail };
}

function getResultConfig(result: string): { color: string; bg: string } {
  if (result === 'Pass') return { color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
  if (result === 'Borderline') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  if (result === 'Fail') return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
  if (result === 'Auto-Fail') return { color: '#dc2626', bg: 'rgba(220,38,38,0.14)' };
  if (result === 'Yes') return { color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
  if (result === 'No') return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
  return { color: '#64748b', bg: 'rgba(100,116,139,0.07)' };
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#10b981';
  if (score >= 75) return '#f59e0b';
  return '#ef4444';
}

function openNativeDatePicker(target: HTMLInputElement) {
  try {
    (target as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
  } catch { /* ignore */ }
}

/* ═══════════════════════════════════════════════════════════
   Theme Hook
   ═══════════════════════════════════════════════════════════ */

function useThemeRefresh() {
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const refresh = () => setKey((v) => v + 1);
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('storage', refresh);
    window.addEventListener('detroit-axle-theme-change', refresh as EventListener);
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', refresh);
      window.removeEventListener('detroit-axle-theme-change', refresh as EventListener);
    };
  }, []);
  return key;
}

function getThemeVars(): { isLight: boolean } & Record<string, string | boolean> {
  const themeMode =
    typeof document !== 'undefined'
      ? (
          document.body.dataset.theme ||
          document.documentElement.dataset.theme ||
          (typeof window !== 'undefined' ? window.localStorage.getItem('detroit-axle-theme-mode') : '') ||
          ''
        ).toLowerCase()
      : '';
  const isLight = themeMode === 'light' || themeMode === 'white';
  return {
    isLight,
    '--na-bg': isLight ? '#f4f6fa' : '#07090f',
    '--na-surface': isLight ? '#ffffff' : '#0c1120',
    '--na-surface-2': isLight ? '#f0f4f8' : '#0f1829',
    '--na-surface-3': isLight ? '#e8edf5' : '#131e33',
    '--na-border': isLight ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.07)',
    '--na-border-strong': isLight ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.12)',
    '--na-text': isLight ? '#0f172a' : '#e2eaf7',
    '--na-text-2': isLight ? '#334155' : '#94a3b8',
    '--na-text-3': isLight ? '#64748b' : '#475569',
    '--na-accent': isLight ? '#2563eb' : '#3b82f6',
    '--na-accent-dim': isLight ? 'rgba(37,99,235,0.07)' : 'rgba(59,130,246,0.08)',
    '--na-field-bg': isLight ? '#ffffff' : 'rgba(12,17,32,0.9)',
    '--na-field-text': isLight ? '#0f172a' : '#e2eaf7',
    '--na-option-bg': isLight ? '#ffffff' : '#0c1120',
    '--na-option-text': isLight ? '#0f172a' : '#e2eaf7',
    '--na-shadow-sm': isLight ? '0 1px 3px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.5)',
    '--na-shadow-md': isLight ? '0 4px 20px rgba(0,0,0,0.06)' : '0 4px 20px rgba(0,0,0,0.45)',
    '--na-shadow-lg': isLight ? '0 12px 48px rgba(0,0,0,0.08)' : '0 12px 48px rgba(0,0,0,0.6)',
  };
}

/* ═══════════════════════════════════════════════════════════
   Styles injection
   ═══════════════════════════════════════════════════════════ */

const AUDIT_STYLE_ID = 'da-new-audit-v6';

function useAuditStyles(isLight: boolean) {
  useEffect(() => {
    const existing = document.getElementById(AUDIT_STYLE_ID);
    if (existing) existing.remove();
    const el = document.createElement('style');
    el.id = AUDIT_STYLE_ID;
    el.textContent = `
      @keyframes na-fadeUp   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
      @keyframes na-fadeIn   { from{opacity:0} to{opacity:1} }
      @keyframes na-pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
      @keyframes na-scaleIn  { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
      @keyframes na-popIn    { 0%{opacity:0;transform:scale(.88)} 70%{transform:scale(1.04)} 100%{opacity:1;transform:scale(1)} }
      @keyframes na-slideRight { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
      @keyframes na-shimmer  { from{background-position:-200% 0} to{background-position:200% 0} }

      /* ── Section panels ── */
      .na-section {
        border-radius: 14px;
        border: 1.5px solid var(--na-border-strong);
        background: var(--na-surface);
        overflow: hidden;
        transition: border-color .2s ease, box-shadow .2s ease;
      }
      .na-section.active-section {
        border-color: var(--section-accent, var(--na-accent));
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--section-accent, var(--na-accent)) 12%, transparent);
      }
      .na-section-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 13px 18px;
        cursor: pointer;
        user-select: none;
        transition: background .15s ease;
      }
      .na-section-header:hover { background: var(--na-surface-2); }
      .na-section-body {
        padding: 0 18px 18px;
        animation: na-fadeUp .18s ease both;
      }

      /* ── Team chips ── */
      .na-team-chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 8px 14px;
        border-radius: 10px;
        border: 1.5px solid var(--na-border-strong);
        background: var(--na-surface-2);
        cursor: pointer;
        transition: all .15s cubic-bezier(.34,1.56,.64,1);
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        color: var(--na-text-2);
      }
      .na-team-chip:hover { transform: translateY(-1px); border-color: var(--chip-accent); color: var(--chip-accent); background: color-mix(in srgb, var(--chip-accent) 8%, var(--na-surface)); }
      .na-team-chip.selected { border-color: var(--chip-accent); color: var(--chip-accent); background: color-mix(in srgb, var(--chip-accent) 10%, var(--na-surface)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--chip-accent) 15%, transparent); }

      /* ── Agent list ── */
      .na-agent-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: background .1s ease, border-color .1s ease;
        width: 100%;
        text-align: left;
        background: transparent;
        color: var(--na-text);
        font-family: inherit;
      }
      .na-agent-row:hover { background: var(--na-surface-2); }
      .na-agent-row.selected { background: color-mix(in srgb, var(--agent-accent) 10%, transparent); border-color: color-mix(in srgb, var(--agent-accent) 25%, transparent); }

      /* ── Metric row ── */
      .na-metric {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: start;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--na-border);
        background: var(--na-surface);
        transition: border-color .15s ease, background .15s ease;
      }
      .na-metric:hover { border-color: var(--na-border-strong); }
      .na-metric.scored { border-left: 2.5px solid var(--metric-color, var(--na-border)); }

      /* ── Score select ── */
      .na-score-select {
        appearance: none;
        -webkit-appearance: none;
        border: 1.5px solid var(--na-border-strong);
        border-radius: 7px;
        padding: 6px 28px 6px 10px;
        font-size: 12px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='5' fill='none'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-width='1.5' d='M1 1l3.5 3.5L8 1'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
        outline: none;
        min-width: 120px;
        transition: border-color .15s ease, background .15s ease, color .15s ease;
      }
      .na-score-select:focus { border-color: var(--na-accent); }
      .na-score-select option { background: var(--na-option-bg); color: var(--na-option-text); }

      /* ── Inputs ── */
      .na-input {
        width: 100%;
        padding: 9px 12px;
        border-radius: 9px;
        border: 1.5px solid var(--na-border-strong);
        background: var(--na-field-bg);
        color: var(--na-field-text);
        font-size: 13px;
        font-family: inherit;
        outline: none;
        box-sizing: border-box;
        transition: border-color .15s ease;
      }
      .na-input:focus { border-color: var(--na-accent); }
      .na-input::placeholder { color: var(--na-text-3); }

      /* ── Buttons ── */
      .na-btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 11px 22px;
        border-radius: 10px;
        font-weight: 700;
        font-size: 13px;
        font-family: inherit;
        cursor: pointer;
        border: none;
        transition: all .15s ease;
        letter-spacing: -.01em;
      }
      .na-btn-primary:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.08); }
      .na-btn-primary:active:not(:disabled) { transform: translateY(0); }
      .na-btn-primary:disabled { opacity: .45; cursor: not-allowed; }

      .na-btn-ghost {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 8px;
        font-weight: 600;
        font-size: 12px;
        font-family: inherit;
        cursor: pointer;
        border: 1.5px solid var(--na-border-strong);
        background: var(--na-surface);
        color: var(--na-text-2);
        transition: all .15s ease;
      }
      .na-btn-ghost:hover { color: var(--na-text); background: var(--na-surface-2); }
      .na-btn-ghost:disabled { opacity: .4; cursor: not-allowed; }

      /* ── Previous audit panel ── */
      .na-prev-card {
        border-radius: 14px;
        border: 1.5px solid var(--na-border-strong);
        background: var(--na-surface);
        overflow: hidden;
        position: sticky;
        top: 24px;
      }
      .na-prev-metric-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 10px;
        border-radius: 6px;
        gap: 8px;
        transition: background .1s ease;
      }
      .na-prev-metric-row:hover { background: var(--na-surface-2); }

      /* ── Compact clone banner ── */
      .na-clone-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1.5px dashed var(--na-border-strong);
        background: var(--na-accent-dim);
        cursor: pointer;
        transition: all .15s ease;
      }
      .na-clone-banner:hover { border-style: solid; border-color: var(--na-accent); }

      /* ── Score ring ── */
      .na-score-ring { display: grid; place-items: center; }

      /* ── Section status dot ── */
      .na-status-dot {
        width: 7px; height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
        transition: background .2s ease;
      }

      /* ── Progress bar ── */
      .na-progress-track {
        height: 3px;
        border-radius: 999px;
        background: var(--na-surface-3);
        overflow: hidden;
      }
      .na-progress-fill {
        height: 100%;
        border-radius: 999px;
        transition: width .4s cubic-bezier(.34,1.56,.64,1);
      }

      /* Kbd hint */
      .na-kbd {
        font-size: 9px;
        font-weight: 700;
        font-family: monospace;
        padding: 1px 5px;
        border-radius: 4px;
        border: 1px solid var(--na-border-strong);
        background: var(--na-surface-2);
        color: var(--na-text-3);
        letter-spacing: .04em;
      }
    `;
    document.head.appendChild(el);
    return () => { document.getElementById(AUDIT_STYLE_ID)?.remove(); };
  }, [isLight]);
}

/* ═══════════════════════════════════════════════════════════
   Score Ring (memoised SVG)
   ═══════════════════════════════════════════════════════════ */

const ScoreRing = memo(function ScoreRing({
  score,
  size = 72,
  stroke = 6,
  hasAutoFail,
}: {
  score: number;
  size?: number;
  stroke?: number;
  hasAutoFail?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, score));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = hasAutoFail ? '#dc2626' : getScoreColor(pct);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.34,1.56,.64,1), stroke .3s ease' }}
      />
    </svg>
  );
});

/* ═══════════════════════════════════════════════════════════
   Agent Avatar
   ═══════════════════════════════════════════════════════════ */

const AgentAvatar = memo(function AgentAvatar({ name, size = 32, accent }: { name: string; size?: number; accent: string }) {
  const initials = name.split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size * 0.28,
      background: `color-mix(in srgb, ${accent} 14%, transparent)`,
      border: `1.5px solid color-mix(in srgb, ${accent} 28%, transparent)`,
      display: 'grid', placeItems: 'center',
      fontSize: size * 0.36, fontWeight: 700,
      color: accent, flexShrink: 0,
    }}>
      {initials || '?'}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════
   Single Metric Row (keyboard-navigable)
   ═══════════════════════════════════════════════════════════ */

const MetricRow = memo(function MetricRow({
  metric,
  value,
  comment,
  prevResult,
  onScoreChange,
  onCommentChange,
  idx,
}: {
  metric: Metric;
  value: string;
  comment: string;
  prevResult?: string;
  onScoreChange: (name: string, val: string) => void;
  onCommentChange: (name: string, val: string) => void;
  idx: number;
}) {
  const options = getMetricOptions(metric);
  const isMeaningful = value !== 'N/A' && value !== '';
  const cfg = getResultConfig(value);
  const showComment = countsTowardScore(metric) && shouldShowMetricComment(value);
  const isSpecial = !countsTowardScore(metric);
  const changed = prevResult && prevResult !== value && value !== 'N/A' && value !== '';

  // Keyboard shortcut: 1=N/A, 2=Pass, 3=Borderline, 4=Fail, 5=Auto-Fail
  const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLSelectElement>) => {
    const map: Record<string, string> = { '1': 'N/A', '2': 'Pass', '3': 'Borderline', '4': 'Fail', '5': 'Auto-Fail' };
    if (map[e.key] && options.includes(map[e.key])) {
      e.preventDefault();
      onScoreChange(metric.name, map[e.key]);
    }
  }, [metric.name, onScoreChange, options]);

  return (
    <div
      className={`na-metric${isMeaningful && !isSpecial ? ' scored' : ''}`}
      style={{
        '--metric-color': cfg.color,
        animationDelay: `${idx * 18}ms`,
        background: isMeaningful && !isSpecial ? `color-mix(in srgb, ${cfg.color} 4%, var(--na-surface))` : undefined,
      } as CSSProperties}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: isSpecial ? 'var(--na-text-2)' : 'var(--na-text)',
            fontStyle: isSpecial ? 'italic' : 'normal',
          }}>
            {metric.name}
          </span>
          {countsTowardScore(metric) && (
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--na-text-3)', background: 'var(--na-surface-2)', padding: '1px 5px', borderRadius: 999, border: '1px solid var(--na-border)' }}>
              {metric.pass}pts
            </span>
          )}
          {canAutoFail(metric.name) && (
            <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '1px 6px', borderRadius: 999, border: '1px solid rgba(239,68,68,0.15)' }}>
              AF
            </span>
          )}
          {/* Delta badge vs prev audit */}
          {changed && (() => {
            const prevCfg = getResultConfig(prevResult!);
            return (
              <span style={{ fontSize: 9, color: prevCfg.color, background: prevCfg.bg, padding: '1px 5px', borderRadius: 999, fontWeight: 600 }}>
                was {prevResult}
              </span>
            );
          })()}
        </div>
        {showComment && (
          <textarea
            value={comment}
            onChange={(e) => onCommentChange(metric.name, e.target.value)}
            rows={2}
            placeholder="QA note for agent…"
            className="na-input"
            style={{ fontSize: 11, marginTop: 6, resize: 'vertical', minHeight: 48 }}
          />
        )}
      </div>

      <select
        value={value}
        onChange={(e) => onScoreChange(metric.name, e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLockedToNA(metric.name)}
        className="na-score-select"
        style={{
          background: isMeaningful ? cfg.bg : 'var(--na-field-bg)',
          color: isMeaningful ? cfg.color : 'var(--na-text-2)',
          borderColor: isMeaningful ? `color-mix(in srgb, ${cfg.color} 40%, transparent)` : undefined,
        }}
      >
        {options.map((opt) => (
          <option key={opt || '__empty__'} value={opt}>{opt || 'Select…'}</option>
        ))}
      </select>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════
   Previous Audit Panel
   ═══════════════════════════════════════════════════════════ */

const PrevAuditPanel = memo(function PrevAuditPanel({
  lastAudit,
  currentTeam,
  currentAgent,
  onClone,
}: {
  lastAudit: LastAuditSummary | null;
  currentTeam: TeamType;
  currentAgent: AgentProfile | null;
  onClone: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!lastAudit) {
    return (
      <div className="na-prev-card">
        <div style={{ padding: '20px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--na-text-2)' }}>No previous audits</div>
          <div style={{ fontSize: 11, color: 'var(--na-text-3)', marginTop: 4 }}>Your last audit will appear here</div>
        </div>
      </div>
    );
  }

  const score = lastAudit.qualityScore ?? 0;
  const color = getScoreColor(score);
  const scoreDetails = lastAudit.scoreDetails || [];
  const sameAgent = currentAgent?.agent_name === lastAudit.agentName;
  const sameTeam = currentTeam === lastAudit.team;
  const isContextual = sameAgent || sameTeam;

  return (
    <div className="na-prev-card" style={{ borderColor: isContextual ? `${color}40` : undefined }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--na-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--na-text-3)', marginBottom: 3 }}>
              {isContextual ? '⚡ Contextual Reference' : '🕐 Last Audit'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--na-text)' }}>{lastAudit.agentName}</div>
            <div style={{ fontSize: 11, color: 'var(--na-text-3)', marginTop: 1 }}>
              {lastAudit.team} · {lastAudit.caseType} · {lastAudit.auditDate}
            </div>
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <ScoreRing score={score} size={56} stroke={5} />
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color, letterSpacing: '-.02em' }}>
              {score.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Clone button — only if same team */}
        {sameTeam && (
          <button
            type="button"
            className="na-clone-banner"
            onClick={onClone}
            style={{ width: '100%', marginTop: 10 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--na-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: 'var(--na-text-2)', textAlign: 'left' }}>
              Clone scores from this audit
            </span>
            <span style={{ fontSize: 10, color: 'var(--na-text-3)' }}>→</span>
          </button>
        )}
      </div>

      {/* Score breakdown */}
      {scoreDetails.length > 0 && (
        <>
          <div
            style={{ padding: '10px 16px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onClick={() => setExpanded((v) => !v)}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--na-text-3)' }}>Score breakdown</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--na-text-3)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          {/* Mini visual bar always visible */}
          <div style={{ padding: '0 16px 10px', display: 'flex', gap: 1, height: 4 }}>
            {scoreDetails.filter((d) => d.counts_toward_score && d.adjustedWeight > 0).map((d) => {
              const totalW = scoreDetails.filter((x) => x.counts_toward_score && x.adjustedWeight > 0).reduce((s, x) => s + x.adjustedWeight, 0);
              const pct = (d.adjustedWeight / totalW) * 100;
              return (
                <div key={d.metric} title={`${d.metric}: ${d.result}`}
                  style={{ width: `${pct}%`, background: getResultConfig(d.result).color, borderRadius: 999, minWidth: 2 }} />
              );
            })}
          </div>

          {expanded && (
            <div style={{ padding: '0 10px 12px', animation: 'na-fadeUp .15s ease both', maxHeight: 280, overflowY: 'auto' }}>
              {scoreDetails.filter((d) => d.counts_toward_score).map((d) => {
                const cfg = getResultConfig(d.result);
                return (
                  <div key={d.metric} className="na-prev-metric-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'var(--na-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.metric}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '1px 6px', borderRadius: 5, flexShrink: 0 }}>{d.result}</span>
                  </div>
                );
              })}
              {scoreDetails.find((d) => d.metric === ISSUE_WAS_RESOLVED_METRIC) && (() => {
                const d = scoreDetails.find((d) => d.metric === ISSUE_WAS_RESOLVED_METRIC)!;
                if (!d.result || d.result === '') return null;
                const cfg = getResultConfig(d.result);
                return (
                  <div className="na-prev-metric-row" style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--na-text-3)', fontStyle: 'italic' }}>{d.metric}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '1px 6px', borderRadius: 5 }}>{d.result}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* Summary tally */}
      <div style={{ padding: '8px 16px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['Pass', 'Borderline', 'Fail', 'Auto-Fail'] as const).map((r) => {
          const count = scoreDetails.filter((d) => d.result === r && d.counts_toward_score).length;
          if (!count) return null;
          const cfg = getResultConfig(r);
          return (
            <div key={r} style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 7px', borderRadius: 6, border: `1px solid color-mix(in srgb, ${cfg.color} 25%, transparent)` }}>
              {count} {r}
            </div>
          );
        })}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════
   Section Header component
   ═══════════════════════════════════════════════════════════ */

function SectionHeader({
  num,
  label,
  done,
  accent,
  summary,
  open,
  onClick,
}: {
  num: number;
  label: string;
  done: boolean;
  accent: string;
  summary?: string;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <div className="na-section-header" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: done ? accent : open ? `color-mix(in srgb, ${accent} 14%, transparent)` : 'var(--na-surface-2)',
        border: `2px solid ${done || open ? accent : 'var(--na-border-strong)'}`,
        display: 'grid', placeItems: 'center',
        fontSize: 11, fontWeight: 800,
        color: done ? '#fff' : open ? accent : 'var(--na-text-3)',
        flexShrink: 0,
        transition: 'all .2s ease',
      }}>
        {done ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5 3.5-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : num}
      </div>
      <span style={{ fontSize: 13, fontWeight: open ? 700 : 600, color: open ? 'var(--na-text)' : done ? 'var(--na-text-2)' : 'var(--na-text-2)', flex: 1, transition: 'color .15s ease' }}>
        {label}
      </span>
      {done && summary && !open && (
        <span style={{ fontSize: 11, color: 'var(--na-text-3)', background: 'var(--na-surface-2)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--na-border)' }}>
          {summary}
        </span>
      )}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ color: 'var(--na-text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease', flexShrink: 0 }}>
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

function NewAuditSupabase() {
  const [draft, setDraft] = usePersistentState<AuditDraft>(
    'detroit-axle-new-audit-draft-v3',
    createEmptyDraft('')
  );

  // Which panels are open (can multi-open, but we control flow)
  const [openSection, setOpenSection] = useState<PanelSection>('team');

  const [saving, setSaving] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([]);
  const [agentLoadError, setAgentLoadError] = useState('');
  const [lastAudit, setLastAudit] = useState<LastAuditSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [creatorInfo, setCreatorInfo] = useState<{ userId: string; name: string; role: string; email: string } | null>(null);

  const agentSearchRef = useRef<HTMLInputElement>(null);
  const scorecardRef = useRef<HTMLDivElement>(null);

  const themeRefreshKey = useThemeRefresh();
  const themeVarsRaw = useMemo(() => getThemeVars(), [themeRefreshKey]);
  const { isLight, ...themeVars } = themeVarsRaw;
  useAuditStyles(isLight);

  const teamAccent = draft.team ? (TEAM_CONFIG[draft.team]?.accent ?? '#3b82f6') : '#3b82f6';

  /* ── Data loading ── */
  const loadAgentProfiles = useCallback(async (options?: { force?: boolean }) => {
    setLoadingAgents(true);
    setAgentLoadError('');
    try {
      const data = await getCachedAgentProfiles(undefined, { force: options?.force });
      setAgentProfiles(data);
    } catch (error) {
      setAgentLoadError(error instanceof Error ? error.message : 'Could not load agents.');
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  const loadCreatorInfo = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const authUser = authData.user;
    const meta = (authUser.user_metadata || {}) as AuthMetadata;
    const { data: profileData } = await supabase.from('profiles').select('id,role,agent_name,display_name,email').eq('id', authUser.id).maybeSingle();
    if (!profileData) return;
    const cp = profileData as CreatorProfile;
    setCreatorInfo({
      userId: cp.id,
      name: pickPreferredName([meta.display_name, meta.full_name, meta.name, cp.display_name, cp.agent_name, cp.email, authUser.email]),
      role: cp.role,
      email: cp.email || authUser.email || '',
    });
  }, []);

  const loadLastAudit = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const { data } = await supabase
      .from('audits')
      .select('id,agent_name,agent_id,team,case_type,audit_date,quality_score,score_details,order_number,phone_number,ticket_id')
      .eq('created_by_user_id', authData.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) { setLastAudit(null); return; }
    setLastAudit({
      id: data.id,
      agentName: data.agent_name || '-',
      agentId: data.agent_id || null,
      team: (data.team || '') as TeamType,
      caseType: data.case_type || '-',
      auditDate: data.audit_date || '',
      qualityScore: typeof data.quality_score === 'number' ? data.quality_score : Number(data.quality_score),
      scoreDetails: Array.isArray(data.score_details) ? data.score_details : [],
      orderNumber: data.order_number || null,
      phoneNumber: data.phone_number || null,
      ticketId: data.ticket_id || null,
    });
  }, []);

  useEffect(() => {
    void loadAgentProfiles();
    void loadCreatorInfo();
    void loadLastAudit();
  }, [loadAgentProfiles, loadCreatorInfo, loadLastAudit]);

  // Restore open section from existing draft
  useEffect(() => {
    if (draft.team && openSection === 'team') {
      if (!draft.selectedAgentProfileId) setOpenSection('agent');
      else if (!draft.caseType) setOpenSection('details');
      else setOpenSection('scorecard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Keyboard shortcut: Alt+1/2/3 to select team ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === '1') handleSelectTeam('Calls');
      if (e.key === '2') handleSelectTeam('Tickets');
      if (e.key === '3') handleSelectTeam('Sales');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Derived ── */
  const teamAgents = useMemo(
    () => agentProfiles.filter((p) => p.role === 'agent' && p.team === draft.team && p.agent_id && p.agent_name),
    [agentProfiles, draft.team]
  );

  const visibleAgents = useMemo(() => {
    const search = draft.agentSearch.trim().toLowerCase();
    if (!search) return teamAgents.slice(0, 40);
    return teamAgents.filter((p) =>
      p.agent_name.toLowerCase().includes(search) ||
      (p.agent_id || '').toLowerCase().includes(search) ||
      (p.display_name || '').toLowerCase().includes(search)
    ).slice(0, 40);
  }, [teamAgents, draft.agentSearch]);

  const selectedAgent = useMemo(
    () => teamAgents.find((p) => p.id === draft.selectedAgentProfileId) || null,
    [teamAgents, draft.selectedAgentProfileId]
  );

  const adjustedData = useMemo(
    () => getAdjustedScoreData(draft.team, draft.scores, draft.metricComments),
    [draft.team, draft.scores, draft.metricComments]
  );

  const metrics = getMetricsForTeam(draft.team);

  const scoredMetrics = metrics.filter((m) => countsTowardScore(m));
  const answeredCount = scoredMetrics.filter((m) => {
    const v = getMetricStoredValue(m, draft.scores);
    return v !== 'N/A' && v !== '';
  }).length;
  const progressPct = scoredMetrics.length ? (answeredCount / scoredMetrics.length) * 100 : 0;

  // Build prev score lookup for delta comparison
  const prevScoreLookup = useMemo(() => {
    const map: Record<string, string> = {};
    if (lastAudit?.scoreDetails) {
      for (const d of lastAudit.scoreDetails) map[d.metric] = d.result;
    }
    return map;
  }, [lastAudit]);

  /* ── Section done states ── */
  const teamDone = !!draft.team;
  const agentDone = !!selectedAgent;
  const detailsDone = !!(draft.caseType && draft.auditDate &&
    ((draft.team === 'Calls' || draft.team === 'Sales') ? draft.orderNumber : true) &&
    (draft.team === 'Tickets' ? draft.ticketId : true));
  const scorecardDone = answeredCount === scoredMetrics.length && scoredMetrics.length > 0;

  /* ── Handlers ── */
  const setDraftField = useCallback(<K extends keyof AuditDraft>(key: K, value: AuditDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, [setDraft]);

  const handleSelectTeam = useCallback((t: Exclude<TeamType, ''>) => {
    if (draft.team === t) return;
    setDraft(createEmptyDraft(t));
    setOpenSection('agent');
    setTimeout(() => agentSearchRef.current?.focus(), 80);
  }, [draft.team, setDraft]);

  const handleSelectAgent = useCallback((profile: AgentProfile) => {
    setDraft((prev) => ({
      ...prev,
      selectedAgentProfileId: profile.id,
      agentSearch: profile.agent_name,
    }));
    // Auto-advance to details if not yet done
    setTimeout(() => setOpenSection('details'), 100);
  }, [setDraft]);

  const handleAgentSearchChange = useCallback((v: string) => {
    setDraft((prev) => ({ ...prev, agentSearch: v, selectedAgentProfileId: '' }));
  }, [setDraft]);

  const handleScoreChange = useCallback((metricName: string, value: string) => {
    if (isLockedToNA(metricName)) return;
    setDraft((prev) => {
      const nextMetricComments = { ...prev.metricComments };
      if (!shouldShowMetricComment(value)) delete nextMetricComments[metricName];
      return { ...prev, scores: { ...prev.scores, [metricName]: value }, metricComments: nextMetricComments };
    });
  }, [setDraft]);

  const handleMetricCommentChange = useCallback((metricName: string, value: string) => {
    setDraft((prev) => ({ ...prev, metricComments: { ...prev.metricComments, [metricName]: value } }));
  }, [setDraft]);

  // Clone previous audit scores (same team only)
  const handleClonePrevScores = useCallback(() => {
    if (!lastAudit?.scoreDetails || lastAudit.team !== draft.team) return;
    const cloned: Record<string, string> = { ...createDefaultScores(draft.team) };
    for (const d of lastAudit.scoreDetails) {
      if (cloned[d.metric] !== undefined) cloned[d.metric] = d.result;
    }
    setDraft((prev) => ({ ...prev, scores: cloned }));
    setOpenSection('scorecard');
    setTimeout(() => scorecardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }, [lastAudit, draft.team, setDraft]);

  // Submit
  const handleSave = useCallback(async () => {
    setErrorMessage('');

    if (!draft.team) { setErrorMessage('Please choose a team.'); setOpenSection('team'); return; }
    if (!selectedAgent) { setErrorMessage('Please select an agent.'); setOpenSection('agent'); return; }
    if (!draft.caseType || !draft.auditDate) { setErrorMessage('Please fill Case Type and Audit Date.'); setOpenSection('details'); return; }
    if ((draft.team === 'Calls' || draft.team === 'Sales') && !draft.orderNumber) { setErrorMessage('Please fill Order Number.'); setOpenSection('details'); return; }
    if (draft.team === 'Tickets' && !draft.ticketId) { setErrorMessage('Please fill Ticket ID.'); setOpenSection('details'); return; }

    const missingRequired = getMissingRequiredMetricLabels(draft.team, draft.scores);
    if (missingRequired.length > 0) { setErrorMessage(`Please answer: ${missingRequired.join(', ')}.`); setOpenSection('scorecard'); return; }

    const missingComments = getMetricsForTeam(draft.team)
      .filter((m) => countsTowardScore(m))
      .filter((m) => shouldShowMetricComment(getMetricStoredValue(m, draft.scores)))
      .filter((m) => !(draft.metricComments[m.name] || '').trim())
      .map((m) => m.name);
    if (missingComments.length > 0) { setErrorMessage(`Add QA notes for: ${missingComments.join(', ')}.`); setOpenSection('scorecard'); return; }
    if (!selectedAgent.agent_id) { setErrorMessage('Selected agent has no Agent ID.'); return; }

    setSaving(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { setSaving(false); setErrorMessage(authError?.message || 'Auth error.'); return; }

    const authUser = authData.user;
    const meta = (authUser.user_metadata || {}) as AuthMetadata;
    const { data: cpData, error: cpe } = await supabase.from('profiles').select('id,role,agent_name,display_name,email').eq('id', authUser.id).maybeSingle();
    if (cpe || !cpData) { setSaving(false); setErrorMessage(cpe?.message || 'Could not load profile.'); return; }
    const cp = cpData as CreatorProfile;
    const createdByName = pickPreferredName([meta.display_name, meta.full_name, meta.name, cp.display_name, cp.agent_name, cp.email, authUser.email]);

    const { error } = await supabase.from('audits').insert({
      agent_id: selectedAgent.agent_id,
      agent_name: selectedAgent.agent_name,
      team: draft.team,
      case_type: draft.caseType,
      audit_date: draft.auditDate,
      order_number: (draft.team === 'Calls' || draft.team === 'Sales') ? draft.orderNumber : null,
      phone_number: (draft.team === 'Calls' || draft.team === 'Sales') ? draft.phoneNumber || null : null,
      ticket_id: draft.team === 'Tickets' ? draft.ticketId : null,
      quality_score: Number(adjustedData.qualityScore),
      comments: draft.comments,
      score_details: adjustedData.scoreDetails,
      created_by_user_id: cp.id,
      created_by_name: createdByName,
      created_by_email: cp.email || authUser.email || null,
      created_by_role: cp.role,
    });

    setSaving(false);
    if (error) { setErrorMessage(error.message); return; }

    const savedTeam = draft.team;
    const savedAgent = selectedAgent.agent_name;
    const savedScore = adjustedData.qualityScore;

    setDraft(createEmptyDraft(savedTeam));
    setOpenSection('agent');
    setSuccessMessage(`✓ Audit saved — ${savedAgent} · ${draft.caseType} · ${savedScore}%`);
    setTimeout(() => setSuccessMessage(''), 6000);

    void loadLastAudit();
    void loadCreatorInfo();
  }, [draft, selectedAgent, adjustedData, setDraft, loadLastAudit, loadCreatorInfo]);

  const handleClear = useCallback(() => {
    setDraft(createEmptyDraft(draft.team));
    setOpenSection('team');
    setErrorMessage('');
    setSuccessMessage('');
  }, [draft.team, setDraft]);

  /* ═══════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════ */

  return (
    <div
      data-no-theme-invert="true"
      style={{
        ...(themeVars as CSSProperties),
        color: 'var(--na-text)',
        fontFamily: "'DM Sans','Outfit',system-ui,sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: teamAccent, marginBottom: 5, transition: 'color .3s ease' }}>
            Audit Workspace
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: '-.025em', color: 'var(--na-text)' }}>
            New Audit
          </h2>
          {creatorInfo && (
            <div style={{ fontSize: 11, color: 'var(--na-text-3)', marginTop: 3 }}>
              {creatorInfo.name} · {creatorInfo.role}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Live score badge */}
          {draft.team && answeredCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 14px 6px 8px',
              borderRadius: 12,
              background: 'var(--na-surface)',
              border: '1.5px solid var(--na-border-strong)',
              animation: 'na-scaleIn .2s ease both',
            }}>
              <div style={{ position: 'relative', width: 44, height: 44 }}>
                <ScoreRing score={parseFloat(adjustedData.qualityScore)} size={44} stroke={4} hasAutoFail={adjustedData.hasAutoFail} />
                <div style={{
                  position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                  fontSize: 9, fontWeight: 800,
                  color: adjustedData.hasAutoFail ? '#dc2626' : getScoreColor(parseFloat(adjustedData.qualityScore)),
                }}>
                  {adjustedData.qualityScore}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--na-text-3)' }}>Live</div>
                <div style={{
                  fontSize: 16, fontWeight: 900, letterSpacing: '-.03em',
                  color: adjustedData.hasAutoFail ? '#dc2626' : getScoreColor(parseFloat(adjustedData.qualityScore)),
                }}>
                  {adjustedData.qualityScore}%
                </div>
              </div>
            </div>
          )}
          <button type="button" className="na-btn-ghost" onClick={handleClear}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
            </svg>
            Clear
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', borderRadius: 10, marginBottom: 14,
          background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.2)',
          color: '#fca5a5', fontWeight: 600, fontSize: 12,
          animation: 'na-scaleIn .15s ease both',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {errorMessage}
          <button type="button" onClick={() => setErrorMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>
      )}
      {successMessage && (
        <div role="status" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', borderRadius: 10, marginBottom: 14,
          background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.2)',
          color: '#6ee7b7', fontWeight: 600, fontSize: 12,
          animation: 'na-scaleIn .15s ease both',
        }}>
          {successMessage}
          <button type="button" onClick={() => setSuccessMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 15 }}>×</button>
        </div>
      )}

      {/* ── Main 2-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>

        {/* Left: form sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Section 1: Team ── */}
          <div
            className={`na-section${openSection === 'team' ? ' active-section' : ''}`}
            style={{ '--section-accent': teamAccent } as CSSProperties}
          >
            <SectionHeader
              num={1} label="Team" done={teamDone} accent={teamAccent}
              summary={draft.team}
              open={openSection === 'team'}
              onClick={() => setOpenSection(openSection === 'team' ? 'agent' : 'team')}
            />
            {openSection === 'team' && (
              <div className="na-section-body">
                <div style={{ fontSize: 11, color: 'var(--na-text-3)', marginBottom: 10 }}>
                  Press <span className="na-kbd">Alt+1</span> <span className="na-kbd">Alt+2</span> <span className="na-kbd">Alt+3</span> to select
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TEAMS.map((t) => {
                    const cfg = TEAM_CONFIG[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        className={`na-team-chip${draft.team === t ? ' selected' : ''}`}
                        style={{ '--chip-accent': cfg.accent } as CSSProperties}
                        onClick={() => handleSelectTeam(t)}
                        aria-pressed={draft.team === t}
                      >
                        <span dangerouslySetInnerHTML={{ __html: cfg.icon }} style={{ display: 'flex', alignItems: 'center', color: draft.team === t ? cfg.accent : 'var(--na-text-3)' }} />
                        {t}
                        <span className="na-kbd" style={{ fontSize: 9 }}>Alt+{TEAMS.indexOf(t) + 1}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Section 2: Agent ── */}
          <div
            className={`na-section${openSection === 'agent' ? ' active-section' : ''}`}
            style={{ '--section-accent': teamAccent } as CSSProperties}
          >
            <SectionHeader
              num={2} label="Agent" done={agentDone} accent={teamAccent}
              summary={selectedAgent?.agent_name}
              open={openSection === 'agent'}
              onClick={() => setOpenSection(openSection === 'agent' ? 'team' : 'agent')}
            />
            {openSection === 'agent' && (
              <div className="na-section-body">
                {/* Selected agent badge */}
                {selectedAgent && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 10, marginBottom: 10,
                    background: `color-mix(in srgb, ${teamAccent} 8%, transparent)`,
                    border: `1.5px solid color-mix(in srgb, ${teamAccent} 22%, transparent)`,
                    animation: 'na-scaleIn .18s ease both',
                  }}>
                    <AgentAvatar name={selectedAgent.agent_name} accent={teamAccent} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--na-text)' }}>{selectedAgent.agent_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--na-text-3)' }}>{selectedAgent.display_name || selectedAgent.agent_id}</div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 7, background: `color-mix(in srgb, ${teamAccent} 14%, transparent)`, color: teamAccent }}>
                      Selected ✓
                    </div>
                  </div>
                )}

                {/* Search */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--na-text-3)', pointerEvents: 'none' }}>
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    ref={agentSearchRef}
                    type="text"
                    value={draft.agentSearch}
                    onChange={(e) => handleAgentSearchChange(e.target.value)}
                    placeholder={draft.team ? `Search ${teamAgents.length} agents in ${draft.team}…` : 'Select a team first'}
                    className="na-input"
                    style={{ paddingLeft: 32 }}
                    disabled={!draft.team}
                  />
                  <div style={{ display: 'flex', gap: 6, position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
                    <button type="button" className="na-btn-ghost" style={{ padding: '3px 8px', fontSize: 10 }}
                      onClick={() => { clearAgentProfilesCache(); void loadAgentProfiles({ force: true }); }}>
                      ↺
                    </button>
                  </div>
                </div>

                {/* Agent list */}
                <div style={{
                  border: '1.5px solid var(--na-border-strong)',
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'var(--na-surface)',
                  maxHeight: 260,
                  overflowY: 'auto',
                }}>
                  {loadingAgents ? (
                    <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--na-text-3)', animation: 'na-pulse 1.5s ease infinite' }}>Loading agents…</div>
                  ) : agentLoadError ? (
                    <div style={{ padding: 16, color: '#ef4444', fontSize: 12, textAlign: 'center' }}>⚠ {agentLoadError}</div>
                  ) : !draft.team ? (
                    <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--na-text-3)' }}>Select a team first</div>
                  ) : visibleAgents.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--na-text-3)' }}>No agents match "{draft.agentSearch}"</div>
                  ) : (
                    <div style={{ padding: 4 }}>
                      {visibleAgents.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`na-agent-row${draft.selectedAgentProfileId === p.id ? ' selected' : ''}`}
                          style={{ '--agent-accent': teamAccent } as CSSProperties}
                          onClick={() => handleSelectAgent(p)}
                          aria-selected={draft.selectedAgentProfileId === p.id}
                        >
                          <AgentAvatar name={p.agent_name} size={30} accent={teamAccent} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--na-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.agent_name}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--na-text-3)' }}>{p.display_name || p.agent_id}</div>
                          </div>
                          {draft.selectedAgentProfileId === p.id && (
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: teamAccent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 3.5-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Section 3: Details ── */}
          <div
            className={`na-section${openSection === 'details' ? ' active-section' : ''}`}
            style={{ '--section-accent': teamAccent } as CSSProperties}
          >
            <SectionHeader
              num={3} label="Details" done={detailsDone} accent={teamAccent}
              summary={draft.caseType || undefined}
              open={openSection === 'details'}
              onClick={() => setOpenSection(openSection === 'details' ? 'scorecard' : 'details')}
            />
            {openSection === 'details' && (
              <div className="na-section-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                  {/* Case Type */}
                  <div>
                    <label style={s.label}>Case Type <span style={{ color: '#ef4444' }}>*</span></label>
                    <select value={draft.caseType} onChange={(e) => setDraftField('caseType', e.target.value)} className="na-input"
                      style={{ appearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='5' fill='none'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-width='1.5' d='M1 1l3.5 3.5L8 1'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                      {CASE_TYPES.map((o) => <option key={o || '__empty__'} value={o}>{o || 'Select…'}</option>)}
                    </select>
                  </div>

                  {/* Audit Date */}
                  <div>
                    <label style={s.label}>Audit Date <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="date" value={draft.auditDate}
                      onChange={(e) => setDraftField('auditDate', e.target.value)}
                      onClick={(e) => openNativeDatePicker(e.currentTarget)}
                      onFocus={(e) => openNativeDatePicker(e.currentTarget)}
                      className="na-input" />
                  </div>

                  {/* Order/Phone for Calls & Sales */}
                  {(draft.team === 'Calls' || draft.team === 'Sales') && (
                    <>
                      <div>
                        <label style={s.label}>Order Number <span style={{ color: '#ef4444' }}>*</span></label>
                        <input type="text" value={draft.orderNumber} onChange={(e) => setDraftField('orderNumber', e.target.value)} placeholder="ORD-12345" className="na-input" />
                      </div>
                      <div>
                        <label style={s.label}>Phone Number</label>
                        <input type="text" value={draft.phoneNumber} onChange={(e) => setDraftField('phoneNumber', e.target.value)} placeholder="(555) 000-1234" className="na-input" />
                      </div>
                    </>
                  )}

                  {/* Ticket ID for Tickets */}
                  {draft.team === 'Tickets' && (
                    <div>
                      <label style={s.label}>Ticket ID <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" value={draft.ticketId} onChange={(e) => setDraftField('ticketId', e.target.value)} placeholder="TKT-98765" className="na-input" />
                    </div>
                  )}

                  {/* Comments */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={s.label}>Comments</label>
                    <textarea value={draft.comments} onChange={(e) => setDraftField('comments', e.target.value)}
                      rows={2} placeholder="General observations…" className="na-input" style={{ resize: 'vertical' }} />
                  </div>
                </div>

                {detailsDone && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="na-btn-ghost" onClick={() => setOpenSection('scorecard')}>
                      Go to Scorecard →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section 4: Scorecard ── */}
          <div
            ref={scorecardRef}
            className={`na-section${openSection === 'scorecard' ? ' active-section' : ''}`}
            style={{ '--section-accent': teamAccent } as CSSProperties}
          >
            <SectionHeader
              num={4} label="Scorecard" done={scorecardDone} accent={teamAccent}
              summary={draft.team ? `${answeredCount}/${scoredMetrics.length}` : undefined}
              open={openSection === 'scorecard'}
              onClick={() => setOpenSection(openSection === 'scorecard' ? 'details' : 'scorecard')}
            />
            {openSection === 'scorecard' && (
              <div className="na-section-body">
                {!draft.team ? (
                  <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--na-text-3)' }}>Select a team to see the scorecard</div>
                ) : (
                  <>
                    {/* Progress + live score summary */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'var(--na-surface-2)', border: '1px solid var(--na-border)' }}>
                      <div style={{ position: 'relative', flexShrink: 0, width: 52, height: 52 }}>
                        <ScoreRing score={parseFloat(adjustedData.qualityScore)} size={52} stroke={5} hasAutoFail={adjustedData.hasAutoFail} />
                        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 800, color: adjustedData.hasAutoFail ? '#dc2626' : getScoreColor(parseFloat(adjustedData.qualityScore)), letterSpacing: '-.02em' }}>
                          {adjustedData.qualityScore}%
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--na-text-2)' }}>{answeredCount} of {scoredMetrics.length} scored</span>
                          <span style={{ fontSize: 11, color: 'var(--na-text-3)' }}>
                            <span className="na-kbd">1</span>–<span className="na-kbd">5</span> to score
                          </span>
                        </div>
                        <div className="na-progress-track">
                          <div className="na-progress-fill" style={{ width: `${progressPct}%`, background: teamAccent }} />
                        </div>
                        {/* Mini breakdown bar */}
                        <div style={{ display: 'flex', height: 3, borderRadius: 999, overflow: 'hidden', gap: 1, marginTop: 4 }}>
                          {adjustedData.scoreDetails.filter((d) => d.counts_toward_score && d.adjustedWeight > 0).map((d) => {
                            const total = adjustedData.scoreDetails.filter((x) => x.counts_toward_score && x.adjustedWeight > 0).reduce((s, x) => s + x.adjustedWeight, 0);
                            return (
                              <div key={d.metric} title={`${d.metric}: ${d.result}`}
                                style={{ width: `${(d.adjustedWeight / total) * 100}%`, background: getResultConfig(d.result).color, minWidth: 2 }} />
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {adjustedData.hasAutoFail && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 9, marginBottom: 10, background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: 12, fontWeight: 600 }}>
                        ⚠ Auto-Fail triggered — final score will be 0.00%
                      </div>
                    )}

                    {/* Metric list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {metrics.map((metric, idx) => (
                        <MetricRow
                          key={metric.name}
                          metric={metric}
                          value={getMetricStoredValue(metric, draft.scores)}
                          comment={draft.metricComments[metric.name] || ''}
                          prevResult={prevScoreLookup[metric.name]}
                          onScoreChange={handleScoreChange}
                          onCommentChange={handleMetricCommentChange}
                          idx={idx}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Submit row ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderRadius: 14,
            background: 'var(--na-surface)',
            border: '1.5px solid var(--na-border-strong)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {teamDone && agentDone && detailsDone && (
                <div style={{ fontSize: 11, color: 'var(--na-text-2)', fontWeight: 500 }}>
                  {selectedAgent?.agent_name} · {draft.caseType} · {draft.auditDate}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--na-text-3)' }}>
                {!teamDone ? 'Select a team to begin' :
                  !agentDone ? 'Select an agent' :
                  !detailsDone ? 'Fill in audit details' :
                  scorecardDone ? '✓ All metrics scored — ready to submit' :
                  `${scoredMetrics.length - answeredCount} metrics remaining`}
              </div>
            </div>

            <button
              type="button"
              className="na-btn-primary"
              onClick={handleSave}
              disabled={saving || !teamDone || !agentDone || !detailsDone}
              style={{
                background: saving ? 'var(--na-surface-3)' : `linear-gradient(135deg, ${teamAccent}, color-mix(in srgb, ${teamAccent} 75%, #000))`,
                color: saving ? 'var(--na-text-3)' : '#fff',
                boxShadow: saving ? 'none' : `0 6px 20px color-mix(in srgb, ${teamAccent} 35%, transparent)`,
                minWidth: 140,
              }}
            >
              {saving ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'na-pulse 1s ease infinite' }}>
                    <circle cx="12" cy="12" r="10"/>
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Save Audit
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Right: Previous Audit Panel ── */}
        <div>
          <PrevAuditPanel
            lastAudit={lastAudit}
            currentTeam={draft.team}
            currentAgent={selectedAgent}
            onClone={handleClonePrevScores}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(NewAuditSupabase);

/* ═══════════════════════════════════════════════════════════
   Module styles
   ═══════════════════════════════════════════════════════════ */
const s: Record<string, CSSProperties> = {
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--na-text-2)',
    marginBottom: 5,
    letterSpacing: '.01em',
  },
};
