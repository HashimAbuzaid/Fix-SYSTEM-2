import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  memo,
  type CSSProperties,
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

type CreatorSummary = {
  userId: string;
  name: string;
  role: 'admin' | 'qa' | 'agent' | '';
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

type Step = 'team' | 'agent' | 'details' | 'scorecard' | 'review';

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

const TEAM_CONFIG: Record<string, { accent: string; icon: string; desc: string }> = {
  Calls: {
    accent: '#3b82f6',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.99 9a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.93 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    desc: 'Phone support quality',
  },
  Tickets: {
    accent: '#8b5cf6',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    desc: 'Written support quality',
  },
  Sales: {
    accent: '#10b981',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    desc: 'Sales call quality',
  },
};

const STEPS: { id: Step; label: string }[] = [
  { id: 'team', label: 'Team' },
  { id: 'agent', label: 'Agent' },
  { id: 'details', label: 'Details' },
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'review', label: 'Submit' },
];

const STEP_ORDER: Step[] = ['team', 'agent', 'details', 'scorecard', 'review'];

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
    auditDate: '',
    orderNumber: '',
    phoneNumber: '',
    ticketId: '',
    comments: '',
    scores: createDefaultScores(teamValue),
    metricComments: {},
  };
}

function getMissingRequiredMetricLabels(
  teamValue: TeamType,
  scores: Record<string, string>
) {
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

  const scoreDetails = metrics.map((metric) => {
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
    (item) =>
      item.counts_toward_score !== false &&
      canAutoFail(item.metric) &&
      item.result === 'Auto-Fail'
  );
  const qualityScore = hasAutoFail
    ? '0.00'
    : scoreDetails
        .filter((item) => item.counts_toward_score !== false)
        .reduce((sum, item) => sum + item.earned, 0)
        .toFixed(2);

  return { scoreDetails, qualityScore, hasAutoFail };
}

function openNativeDatePicker(target: HTMLInputElement) {
  try {
    (target as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
  } catch { /* ignore */ }
}

function getResultConfig(result: string): { color: string; bg: string; label: string } {
  if (result === 'Pass') return { color: '#10b981', bg: 'rgba(16,185,129,0.08)', label: 'Pass' };
  if (result === 'Borderline') return { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'Borderline' };
  if (result === 'Fail') return { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: 'Fail' };
  if (result === 'Auto-Fail') return { color: '#dc2626', bg: 'rgba(220,38,38,0.12)', label: 'Auto-Fail' };
  if (result === 'Yes') return { color: '#10b981', bg: 'rgba(16,185,129,0.08)', label: 'Yes' };
  if (result === 'No') return { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: 'No' };
  return { color: '#64748b', bg: 'rgba(100,116,139,0.06)', label: result || 'N/A' };
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#10b981';
  if (score >= 75) return '#f59e0b';
  return '#ef4444';
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
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-theme-mode'] });
    if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme', 'data-theme-mode'] });
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

function getThemeVars(): Record<string, string> & { isLight: boolean } {
  const themeMode =
    typeof document !== 'undefined'
      ? (
          document.body.dataset.theme ||
          document.documentElement.dataset.theme ||
          window.localStorage.getItem('detroit-axle-theme-mode') ||
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
    '--na-border-strong': isLight ? 'rgba(148,163,184,0.45)' : 'rgba(148,163,184,0.12)',
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
   Global style injection
   ═══════════════════════════════════════════════════════════ */

const AUDIT_STYLE_ID = 'da-new-audit-v5';

function useAuditStyles(isLight: boolean) {
  useEffect(() => {
    const existing = document.getElementById(AUDIT_STYLE_ID);
    if (existing) existing.remove();

    const el = document.createElement('style');
    el.id = AUDIT_STYLE_ID;
    el.textContent = `
      @keyframes na-fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
      @keyframes na-fadeIn  { from { opacity:0 } to { opacity:1 } }
      @keyframes na-pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
      @keyframes na-shine   { from{background-position:-200% 0} to{background-position:200% 0} }
      @keyframes na-dash    { to { stroke-dashoffset: 0; } }
      @keyframes na-scaleIn { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
      @keyframes na-popIn   { 0%{opacity:0;transform:scale(.9) translateY(-4px)} 70%{transform:scale(1.03) translateY(0)} 100%{opacity:1;transform:scale(1)} }

      .na-step-btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: inherit;
        transition: opacity 0.15s ease;
      }
      .na-step-btn:hover { opacity: 0.8; }
      .na-step-btn:disabled { cursor: default; }

      .na-team-card {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 20px;
        border-radius: 16px;
        border: 1.5px solid var(--na-border-strong);
        background: var(--na-surface);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.34,1.56,0.64,1);
        overflow: hidden;
      }
      .na-team-card:hover { transform: translateY(-2px); box-shadow: var(--na-shadow-md); }
      .na-team-card.active { transform: translateY(-2px); }
      .na-team-card::before {
        content: '';
        position: absolute;
        inset: 0;
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
      }
      .na-team-card.active::before { opacity: 1; }

      .na-metric-row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: start;
        gap: 14px;
        padding: 14px 16px;
        border-radius: 12px;
        border: 1px solid var(--na-border);
        background: var(--na-surface);
        transition: border-color 0.15s ease, background 0.15s ease;
        animation: na-fadeUp 0.15s ease both;
      }
      .na-metric-row:hover { border-color: var(--na-border-strong); }
      .na-metric-row.has-result { border-left-width: 3px; }

      .na-select-pill {
        appearance: none;
        -webkit-appearance: none;
        border: 1.5px solid var(--na-border-strong);
        border-radius: 8px;
        padding: 7px 32px 7px 12px;
        font-size: 13px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-width='1.5' d='M1 1l4 4 4-4'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
        outline: none;
        min-width: 140px;
        transition: border-color 0.15s ease;
      }
      .na-select-pill:focus { border-color: var(--na-accent); }
      .na-select-pill option { background: var(--na-option-bg); color: var(--na-option-text); }

      .na-input-base {
        width: 100%;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1.5px solid var(--na-border-strong);
        background: var(--na-field-bg);
        color: var(--na-field-text);
        font-size: 14px;
        font-family: inherit;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.15s ease;
        -webkit-font-smoothing: antialiased;
      }
      .na-input-base:focus { border-color: var(--na-accent); }
      .na-input-base::placeholder { color: var(--na-text-3); }

      .na-agent-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid transparent;
        cursor: pointer;
        transition: background 0.1s ease, border-color 0.1s ease;
        width: 100%;
        text-align: left;
        background: transparent;
        color: var(--na-text);
        font-family: inherit;
      }
      .na-agent-option:hover { background: var(--na-surface-2); }
      .na-agent-option.selected { background: var(--na-accent-dim); border-color: rgba(59,130,246,0.2); }

      .na-progress-segment {
        height: 3px;
        border-radius: 999px;
        transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
      }

      .na-score-bar-fill {
        height: 100%;
        border-radius: 999px;
        transition: width 0.6s cubic-bezier(0.34,1.56,0.64,1);
      }

      .na-review-metric {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-radius: 8px;
        transition: background 0.1s ease;
      }
      .na-review-metric:hover { background: var(--na-surface-2); }

      .na-btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 14px;
        font-family: inherit;
        cursor: pointer;
        border: none;
        transition: all 0.15s ease;
        letter-spacing: -0.01em;
      }
      .na-btn-primary:hover { transform: translateY(-1px); }
      .na-btn-primary:active { transform: translateY(0); }
      .na-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

      .na-btn-secondary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 13px;
        font-family: inherit;
        cursor: pointer;
        border: 1.5px solid var(--na-border-strong);
        background: var(--na-surface);
        color: var(--na-text-2);
        transition: all 0.15s ease;
      }
      .na-btn-secondary:hover { color: var(--na-text); background: var(--na-surface-2); }
      .na-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

      .na-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        border: 1px solid transparent;
        background: transparent;
        color: var(--na-text-3);
        transition: all 0.15s ease;
        white-space: nowrap;
        letter-spacing: 0.01em;
      }
      .na-tab:hover { color: var(--na-text-2); background: var(--na-surface-2); }
      .na-tab.active { color: var(--na-text); background: var(--na-surface-2); border-color: var(--na-border-strong); }

      .na-floating-score {
        position: sticky;
        bottom: 20px;
        z-index: 10;
        pointer-events: none;
      }
    `;
    document.head.appendChild(el);
    return () => { document.getElementById(AUDIT_STYLE_ID)?.remove(); };
  }, [isLight]);
}

/* ═══════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════ */

const ScoreRing = memo(function ScoreRing({
  score,
  size = 88,
  strokeWidth = 7,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
}) {
  const pct = Math.min(100, Math.max(0, score));
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = getScoreColor(pct);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.34,1.56,0.64,1), stroke 0.3s ease' }}
      />
    </svg>
  );
});

const ScoreDisplay = memo(function ScoreDisplay({
  qualityScore,
  hasAutoFail,
  compact = false,
}: {
  qualityScore: string;
  hasAutoFail: boolean;
  compact?: boolean;
}) {
  const num = parseFloat(qualityScore);
  const color = hasAutoFail ? '#dc2626' : getScoreColor(num);
  const size = compact ? 64 : 88;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 12 : 20 }}>
      <div style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <ScoreRing score={hasAutoFail ? 0 : num} size={size} />
        <div style={{ position: 'absolute', fontSize: compact ? 11 : 13, fontWeight: 800, color, letterSpacing: '-0.02em' }}>
          {qualityScore}%
        </div>
      </div>
      {!compact && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--na-text-3)', marginBottom: 4 }}>
            Quality Score
          </div>
          <div style={{ fontSize: 40, fontWeight: 900, color, letterSpacing: '-0.04em', lineHeight: 1 }}>
            {qualityScore}%
          </div>
          {hasAutoFail && (
            <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600, marginTop: 4 }}>Auto-Fail triggered</div>
          )}
        </div>
      )}
    </div>
  );
});

/* Step Indicator */
const StepIndicator = memo(function StepIndicator({
  currentStep,
  completedSteps,
  teamAccent,
  onStepClick,
}: {
  currentStep: Step;
  completedSteps: Set<Step>;
  teamAccent: string;
  onStepClick: (step: Step) => void;
}) {
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STEPS.map((step, idx) => {
        const isActive = step.id === currentStep;
        const isCompleted = completedSteps.has(step.id);
        const isClickable = isCompleted || idx <= currentIdx;

        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
            <button
              className="na-step-btn"
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              aria-current={isActive ? 'step' : undefined}
            >
              <div style={{
                width: 28, height: 28,
                borderRadius: '50%',
                display: 'grid', placeItems: 'center',
                fontSize: 12, fontWeight: 700,
                transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                background: isCompleted ? teamAccent : isActive ? `${teamAccent}18` : 'var(--na-surface-2)',
                border: `2px solid ${isCompleted || isActive ? teamAccent : 'var(--na-border-strong)'}`,
                color: isCompleted ? '#fff' : isActive ? teamAccent : 'var(--na-text-3)',
                boxShadow: isActive ? `0 0 0 4px ${teamAccent}18` : 'none',
                animation: isActive ? 'none' : undefined,
              }}>
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : idx + 1}
              </div>
              <span style={{
                fontSize: 12, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--na-text)' : 'var(--na-text-3)',
                transition: 'color 0.15s ease',
              }}>
                {step.label}
              </span>
            </button>
            {idx < STEPS.length - 1 && (
              <div style={{
                width: 32, height: 1,
                margin: '0 4px',
                background: `linear-gradient(90deg, ${isCompleted ? teamAccent : 'var(--na-border-strong)'} 0%, ${idx < currentIdx - 1 ? teamAccent : 'var(--na-border-strong)'} 100%)`,
                transition: 'background 0.3s ease',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
});

/* Agent Avatar */
const AgentAvatar = memo(function AgentAvatar({
  name,
  size = 36,
  accent,
}: {
  name: string;
  size?: number;
  accent: string;
}) {
  const initials = name
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size * 0.3,
      background: `${accent}18`,
      border: `1.5px solid ${accent}30`,
      display: 'grid', placeItems: 'center',
      fontSize: size * 0.35, fontWeight: 700,
      color: accent, flexShrink: 0, letterSpacing: '-0.02em',
    }}>
      {initials || '?'}
    </div>
  );
});

/* Metric Row */
const MetricRow = memo(function MetricRow({
  metric,
  value,
  comment,
  onScoreChange,
  onCommentChange,
  animDelay,
}: {
  metric: Metric;
  value: string;
  comment: string;
  onScoreChange: (name: string, val: string) => void;
  onCommentChange: (name: string, val: string) => void;
  animDelay: number;
}) {
  const options = getMetricOptions(metric);
  const isMeaningful = value !== 'N/A' && value !== '';
  const cfg = getResultConfig(value);
  const showComment = countsTowardScore(metric) && shouldShowMetricComment(value);
  const isSpecial = !countsTowardScore(metric);

  return (
    <div
      className={`na-metric-row${isMeaningful ? ' has-result' : ''}`}
      style={{
        animationDelay: `${animDelay}ms`,
        borderLeftColor: isMeaningful ? cfg.color : undefined,
        background: isMeaningful && !isSpecial ? `${cfg.bg}` : undefined,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showComment ? 8 : 0 }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'var(--na-text)',
            ...(isSpecial ? { fontStyle: 'italic', color: 'var(--na-text-2)' } : {}),
          }}>
            {metric.name}
          </span>
          {countsTowardScore(metric) && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              color: 'var(--na-text-3)',
              background: 'var(--na-surface-2)',
              padding: '2px 7px', borderRadius: 999,
              border: '1px solid var(--na-border)',
            }}>
              {metric.pass}pts
            </span>
          )}
          {isLockedToNA(metric.name) && (
            <span style={{ fontSize: 10, color: 'var(--na-text-3)', fontStyle: 'italic' }}>locked N/A</span>
          )}
          {canAutoFail(metric.name) && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: '#ef4444',
              background: 'rgba(239,68,68,0.08)',
              padding: '2px 7px', borderRadius: 999,
              border: '1px solid rgba(239,68,68,0.15)',
            }}>
              Auto-Fail risk
            </span>
          )}
        </div>

        {showComment && (
          <textarea
            value={comment}
            onChange={(e) => onCommentChange(metric.name, e.target.value)}
            rows={2}
            placeholder="Add a QA note for the agent…"
            className="na-input-base"
            style={{ fontSize: 12, marginTop: 4, resize: 'vertical' }}
            aria-label={`QA note for ${metric.name}`}
          />
        )}
      </div>

      <select
        value={value}
        onChange={(e) => onScoreChange(metric.name, e.target.value)}
        disabled={isLockedToNA(metric.name)}
        className="na-select-pill"
        aria-label={`${metric.name} result`}
        style={{
          background: isMeaningful ? `${cfg.bg}` : 'var(--na-field-bg)',
          color: isMeaningful ? cfg.color : 'var(--na-text-2)',
          borderColor: isMeaningful ? `${cfg.color}50` : undefined,
        }}
      >
        {options.map((opt) => (
          <option key={opt || '__empty__'} value={opt}>
            {opt || 'Select…'}
          </option>
        ))}
      </select>
    </div>
  );
});

/* Score breakdown bar */
const ScoreBreakdownBar = memo(function ScoreBreakdownBar({
  scoreDetails,
}: {
  scoreDetails: ReturnType<typeof getAdjustedScoreData>['scoreDetails'];
}) {
  const scored = scoreDetails.filter((d) => d.counts_toward_score && d.adjustedWeight > 0);
  if (!scored.length) return null;

  return (
    <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: 1 }}>
      {scored.map((d) => {
        const pct = (d.adjustedWeight / scored.reduce((s, x) => s + x.adjustedWeight, 0)) * 100;
        const cfg = getResultConfig(d.result);
        return (
          <div
            key={d.metric}
            title={`${d.metric}: ${d.result}`}
            style={{ width: `${pct}%`, background: cfg.color, minWidth: 2, transition: 'background 0.2s ease' }}
          />
        );
      })}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════
   Step Panels
   ═══════════════════════════════════════════════════════════ */

/* Step 1: Team */
const TeamStep = memo(function TeamStep({
  selectedTeam,
  onSelect,
}: {
  selectedTeam: TeamType;
  onSelect: (t: Exclude<TeamType, ''>) => void;
}) {
  return (
    <div style={{ animation: 'na-fadeUp 0.2s ease both' }}>
      <div style={styles.stepHeading}>Which team are you auditing?</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 20 }}>
        {TEAMS.map((t) => {
          const cfg = TEAM_CONFIG[t];
          const active = selectedTeam === t;
          return (
            <button
              key={t}
              type="button"
              className={`na-team-card${active ? ' active' : ''}`}
              onClick={() => onSelect(t)}
              aria-pressed={active}
              style={{
                borderColor: active ? cfg.accent : undefined,
                boxShadow: active ? `0 0 0 3px ${cfg.accent}20, var(--na-shadow-md)` : undefined,
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: active ? `${cfg.accent}18` : 'var(--na-surface-2)',
                border: `1.5px solid ${active ? `${cfg.accent}40` : 'var(--na-border-strong)'}`,
                display: 'grid', placeItems: 'center',
                color: active ? cfg.accent : 'var(--na-text-3)',
                transition: 'all 0.2s ease',
              }} dangerouslySetInnerHTML={{ __html: cfg.icon }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: active ? 'var(--na-text)' : 'var(--na-text-2)', letterSpacing: '-0.01em' }}>
                  {t}
                </div>
                <div style={{ fontSize: 12, color: 'var(--na-text-3)', marginTop: 2 }}>{cfg.desc}</div>
              </div>
              {active && (
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  width: 18, height: 18, borderRadius: '50%',
                  background: cfg.accent, display: 'grid', placeItems: 'center',
                  animation: 'na-popIn 0.25s ease both',
                }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5 3.5-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

/* Step 2: Agent */
const AgentStep = memo(function AgentStep({
  draft,
  teamAgents,
  visibleAgents,
  selectedAgent,
  loadingAgents,
  agentLoadError,
  teamAccent,
  onSelectAgent,
  onSearchChange,
  onRefresh,
  getAgentLabel,
}: {
  draft: AuditDraft;
  teamAgents: AgentProfile[];
  visibleAgents: AgentProfile[];
  selectedAgent: AgentProfile | null;
  loadingAgents: boolean;
  agentLoadError: string;
  teamAccent: string;
  onSelectAgent: (p: AgentProfile) => void;
  onSearchChange: (v: string) => void;
  onRefresh: () => void;
  getAgentLabel: (p: AgentProfile) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div style={{ animation: 'na-fadeUp 0.2s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div>
          <div style={styles.stepHeading}>Select the agent</div>
          <div style={{ fontSize: 13, color: 'var(--na-text-3)', marginTop: 4 }}>
            {teamAgents.length} agents in {draft.team} team
          </div>
        </div>
        <button type="button" className="na-btn-secondary" onClick={onRefresh} style={{ flexShrink: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
      </div>

      {selectedAgent && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 12, marginBottom: 16,
          background: `${teamAccent}0a`,
          border: `1.5px solid ${teamAccent}25`,
          animation: 'na-scaleIn 0.2s ease both',
        }}>
          <AgentAvatar name={selectedAgent.agent_name} accent={teamAccent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--na-text)' }}>{selectedAgent.agent_name}</div>
            <div style={{ fontSize: 12, color: 'var(--na-text-3)', marginTop: 1 }}>
              {selectedAgent.display_name || selectedAgent.agent_id}
            </div>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8,
            background: `${teamAccent}15`, color: teamAccent,
          }}>Selected ✓</div>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 12 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--na-text-3)', pointerEvents: 'none' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={draft.agentSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, ID, display name…"
          className="na-input-base"
          style={{ paddingLeft: 38 }}
        />
      </div>

      <div style={{
        border: '1.5px solid var(--na-border-strong)',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--na-surface)',
        maxHeight: 340,
        overflowY: 'auto',
      }}>
        {loadingAgents ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--na-text-3)', animation: 'na-pulse 1.5s ease infinite' }}>Loading agents…</div>
          </div>
        ) : agentLoadError ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#ef4444', fontSize: 13 }}>
            ⚠ {agentLoadError}
          </div>
        ) : visibleAgents.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--na-text-3)' }}>
            No agents found matching "{draft.agentSearch}"
          </div>
        ) : (
          <div style={{ padding: 6 }}>
            {visibleAgents.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`na-agent-option${draft.selectedAgentProfileId === p.id ? ' selected' : ''}`}
                onClick={() => onSelectAgent(p)}
                role="option"
                aria-selected={draft.selectedAgentProfileId === p.id}
              >
                <AgentAvatar name={p.agent_name} size={34} accent={teamAccent} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--na-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.agent_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--na-text-3)', marginTop: 1 }}>
                    {p.display_name || p.agent_id}
                  </div>
                </div>
                {draft.selectedAgentProfileId === p.id && (
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: teamAccent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5 3.5-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

/* Step 3: Details */
const DetailsStep = memo(function DetailsStep({
  draft,
  setDraftField,
}: {
  draft: AuditDraft;
  setDraftField: <K extends keyof AuditDraft>(key: K, value: AuditDraft[K]) => void;
}) {
  const showOrderFields = draft.team === 'Calls' || draft.team === 'Sales';
  const showTicketId = draft.team === 'Tickets';

  return (
    <div style={{ animation: 'na-fadeUp 0.2s ease both' }}>
      <div style={styles.stepHeading}>Audit details</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 20 }}>
        <div>
          <label style={styles.fieldLabel}>Case Type <span style={{ color: '#ef4444' }}>*</span></label>
          <select
            value={draft.caseType}
            onChange={(e) => setDraftField('caseType', e.target.value)}
            className="na-input-base"
            style={{ appearance: 'none', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath stroke='%2394a3b8' stroke-linecap='round' stroke-width='1.5' d='M1 1l4 4 4-4'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
          >
            {CASE_TYPES.map((o) => (
              <option key={o || '__empty__'} value={o} style={{ background: 'var(--na-option-bg)', color: 'var(--na-option-text)' }}>
                {o || 'Select case type…'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={styles.fieldLabel}>Audit Date <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="date"
            value={draft.auditDate}
            onChange={(e) => setDraftField('auditDate', e.target.value)}
            onClick={(e) => openNativeDatePicker(e.currentTarget)}
            onFocus={(e) => openNativeDatePicker(e.currentTarget)}
            className="na-input-base"
          />
        </div>

        {showOrderFields && (
          <>
            <div>
              <label style={styles.fieldLabel}>Order Number <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                value={draft.orderNumber}
                onChange={(e) => setDraftField('orderNumber', e.target.value)}
                placeholder="e.g. ORD-12345"
                className="na-input-base"
              />
            </div>
            <div>
              <label style={styles.fieldLabel}>Phone Number</label>
              <input
                type="text"
                value={draft.phoneNumber}
                onChange={(e) => setDraftField('phoneNumber', e.target.value)}
                placeholder="e.g. (555) 000-1234"
                className="na-input-base"
              />
            </div>
          </>
        )}

        {showTicketId && (
          <div>
            <label style={styles.fieldLabel}>Ticket ID <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="text"
              value={draft.ticketId}
              onChange={(e) => setDraftField('ticketId', e.target.value)}
              placeholder="e.g. TKT-98765"
              className="na-input-base"
            />
          </div>
        )}

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={styles.fieldLabel}>Comments</label>
          <textarea
            value={draft.comments}
            onChange={(e) => setDraftField('comments', e.target.value)}
            rows={3}
            placeholder="General observations or notes about this audit…"
            className="na-input-base"
            style={{ resize: 'vertical' }}
          />
        </div>
      </div>
    </div>
  );
});

/* Step 4: Scorecard */
const ScorecardStep = memo(function ScorecardStep({
  draft,
  metrics,
  adjustedData,
  onScoreChange,
  onMetricCommentChange,
  teamAccent,
}: {
  draft: AuditDraft;
  metrics: Metric[];
  adjustedData: ReturnType<typeof getAdjustedScoreData>;
  onScoreChange: (name: string, val: string) => void;
  onMetricCommentChange: (name: string, val: string) => void;
  teamAccent: string;
}) {
  const scoreNum = parseFloat(adjustedData.qualityScore);
  const scoreColor = adjustedData.hasAutoFail ? '#dc2626' : getScoreColor(scoreNum);

  const scoredMetrics = metrics.filter((m) => countsTowardScore(m));
  const resolved = metrics.filter((m) => !countsTowardScore(m));
  const answeredCount = scoredMetrics.filter((m) => {
    const v = getMetricStoredValue(m, draft.scores);
    return v !== 'N/A' && v !== '';
  }).length;

  // Filter tabs
  const [filter, setFilter] = useState<'all' | 'flagged' | 'unanswered'>('all');

  const displayedMetrics = useMemo(() => {
    if (filter === 'flagged') {
      return metrics.filter((m) => {
        const v = getMetricStoredValue(m, draft.scores);
        return shouldShowMetricComment(v);
      });
    }
    if (filter === 'unanswered') {
      return metrics.filter((m) => {
        const v = getMetricStoredValue(m, draft.scores);
        return v === 'N/A' || v === '';
      });
    }
    return metrics;
  }, [metrics, draft.scores, filter]);

  const flaggedCount = metrics.filter((m) => shouldShowMetricComment(getMetricStoredValue(m, draft.scores))).length;
  const unansweredCount = metrics.filter((m) => {
    const v = getMetricStoredValue(m, draft.scores);
    return (v === 'N/A' || v === '') && countsTowardScore(m);
  }).length;

  return (
    <div style={{ animation: 'na-fadeUp 0.2s ease both' }}>
      {/* Score Summary Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '20px 24px',
        borderRadius: 16,
        background: 'var(--na-surface)',
        border: '1.5px solid var(--na-border-strong)',
        marginBottom: 20,
        boxShadow: 'var(--na-shadow-sm)',
      }}>
        <ScoreDisplay qualityScore={adjustedData.qualityScore} hasAutoFail={adjustedData.hasAutoFail} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--na-text-3)' }}>
              Progress
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--na-text-2)' }}>
              {answeredCount} / {scoredMetrics.length} scored
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--na-surface-3)', overflow: 'hidden', marginBottom: 12 }}>
            <div
              className="na-score-bar-fill"
              style={{
                width: `${(answeredCount / Math.max(1, scoredMetrics.length)) * 100}%`,
                background: teamAccent,
              }}
            />
          </div>
          <ScoreBreakdownBar scoreDetails={adjustedData.scoreDetails} />
        </div>
      </div>

      {adjustedData.hasAutoFail && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', borderRadius: 12, marginBottom: 16,
          background: 'rgba(239,68,68,0.08)',
          border: '1.5px solid rgba(239,68,68,0.2)',
          color: '#fca5a5', fontWeight: 600, fontSize: 13,
          animation: 'na-scaleIn 0.2s ease both',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Auto-Fail triggered — final score will be 0.00%
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[
          { id: 'all' as const, label: 'All metrics', count: metrics.length },
          { id: 'flagged' as const, label: 'Flagged', count: flaggedCount },
          { id: 'unanswered' as const, label: 'Unanswered', count: unansweredCount },
        ].map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            className={`na-tab${filter === id ? ' active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
            {count > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '1px 6px', borderRadius: 999,
                background: filter === id ? teamAccent : 'var(--na-surface-3)',
                color: filter === id ? '#fff' : 'var(--na-text-3)',
                transition: 'all 0.15s ease',
              }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Metrics list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {displayedMetrics.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--na-text-3)', fontSize: 13 }}>
            Nothing to show for this filter.
          </div>
        ) : (
          displayedMetrics.map((metric, idx) => (
            <MetricRow
              key={metric.name}
              metric={metric}
              value={getMetricStoredValue(metric, draft.scores)}
              comment={draft.metricComments[metric.name] || ''}
              onScoreChange={onScoreChange}
              onCommentChange={onMetricCommentChange}
              animDelay={idx * 20}
            />
          ))
        )}
      </div>
    </div>
  );
});

/* Step 5: Review */
const ReviewStep = memo(function ReviewStep({
  draft,
  selectedAgent,
  creatorSummary,
  adjustedData,
  teamAccent,
  lastAudit,
}: {
  draft: AuditDraft;
  selectedAgent: AgentProfile | null;
  creatorSummary: CreatorSummary | null;
  adjustedData: ReturnType<typeof getAdjustedScoreData>;
  teamAccent: string;
  lastAudit: LastAuditSummary | null;
}) {
  const scoreNum = parseFloat(adjustedData.qualityScore);
  const scoreColor = adjustedData.hasAutoFail ? '#dc2626' : getScoreColor(scoreNum);

  const flaggedMetrics = adjustedData.scoreDetails.filter(
    (d) => d.counts_toward_score && shouldShowMetricComment(d.result)
  );

  return (
    <div style={{ animation: 'na-fadeUp 0.2s ease both' }}>
      <div style={styles.stepHeading}>Review & submit</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 20 }}>
        {/* Score card */}
        <div style={{
          gridColumn: '1 / -1',
          display: 'flex', alignItems: 'center', gap: 24,
          padding: '24px 28px', borderRadius: 16,
          background: `${teamAccent}08`,
          border: `1.5px solid ${teamAccent}25`,
        }}>
          <ScoreDisplay qualityScore={adjustedData.qualityScore} hasAutoFail={adjustedData.hasAutoFail} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <ScoreBreakdownBar scoreDetails={adjustedData.scoreDetails} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              {(['Pass', 'Borderline', 'Fail', 'Auto-Fail', 'N/A'] as const).map((result) => {
                const count = adjustedData.scoreDetails.filter((d) => d.result === result && d.counts_toward_score).length;
                if (!count) return null;
                const cfg = getResultConfig(result);
                return (
                  <div key={result} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                    background: cfg.bg, color: cfg.color,
                    border: `1px solid ${cfg.color}30`,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color }} />
                    {count} {result}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Agent info */}
        <div style={styles.reviewCard}>
          <div style={styles.reviewCardLabel}>Agent</div>
          {selectedAgent ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <AgentAvatar name={selectedAgent.agent_name} size={38} accent={teamAccent} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--na-text)' }}>{selectedAgent.agent_name}</div>
                <div style={{ fontSize: 11, color: 'var(--na-text-3)' }}>{selectedAgent.display_name || selectedAgent.agent_id}</div>
              </div>
            </div>
          ) : <div style={{ color: 'var(--na-text-3)', fontSize: 13 }}>—</div>}
        </div>

        {/* Details */}
        <div style={styles.reviewCard}>
          <div style={styles.reviewCardLabel}>Details</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['Team', draft.team],
              ['Case Type', draft.caseType || '—'],
              ['Date', draft.auditDate || '—'],
              ...(draft.orderNumber ? [['Order #', draft.orderNumber] as const] : []),
              ...(draft.ticketId ? [['Ticket ID', draft.ticketId] as const] : []),
              ...(draft.phoneNumber ? [['Phone', draft.phoneNumber] as const] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--na-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--na-text)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Creator */}
        <div style={styles.reviewCard}>
          <div style={styles.reviewCardLabel}>Submitted by</div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--na-text)' }}>{creatorSummary?.name || '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--na-text-3)', marginTop: 2 }}>{creatorSummary?.role || ''} · {creatorSummary?.email || ''}</div>
          </div>
        </div>

        {/* Flagged metrics */}
        {flaggedMetrics.length > 0 && (
          <div style={{ ...styles.reviewCard, gridColumn: '1 / -1' }}>
            <div style={styles.reviewCardLabel}>Flagged Metrics ({flaggedMetrics.length})</div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {flaggedMetrics.map((d) => {
                const cfg = getResultConfig(d.result);
                return (
                  <div key={d.metric} className="na-review-metric">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--na-text)' }}>{d.metric}</span>
                      {d.metric_comment && (
                        <span style={{ fontSize: 11, color: 'var(--na-text-3)', fontStyle: 'italic' }}>"{d.metric_comment}"</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 6 }}>
                      {d.result}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Last audit reference */}
        {lastAudit && (
          <div style={{ ...styles.reviewCard, gridColumn: '1 / -1', background: 'var(--na-accent-dim)', border: '1px solid rgba(59,130,246,0.12)' }}>
            <div style={{ ...styles.reviewCardLabel, color: 'var(--na-accent)' }}>Previous audit reference</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--na-text)' }}>{lastAudit.agentName}</div>
                <div style={{ fontSize: 11, color: 'var(--na-text-3)', marginTop: 2 }}>
                  {lastAudit.team} · {lastAudit.caseType} · {lastAudit.auditDate}
                </div>
              </div>
              {lastAudit.qualityScore !== null && (
                <div style={{
                  fontSize: 20, fontWeight: 900, letterSpacing: '-0.03em',
                  color: getScoreColor(lastAudit.qualityScore),
                }}>
                  {Number(lastAudit.qualityScore).toFixed(2)}%
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {draft.comments && (
        <div style={{ ...styles.reviewCard, marginTop: 14 }}>
          <div style={styles.reviewCardLabel}>Comments</div>
          <p style={{ fontSize: 13, color: 'var(--na-text-2)', marginTop: 6, lineHeight: 1.6 }}>{draft.comments}</p>
        </div>
      )}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

function NewAuditSupabase() {
  const [draft, setDraft] = usePersistentState<AuditDraft>(
    'detroit-axle-new-audit-draft-v2',
    createEmptyDraft('')
  );
  const [currentStep, setCurrentStep] = useState<Step>('team');
  const [completedSteps, setCompletedSteps] = useState<Set<Step>>(new Set());
  const [saving, setSaving] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([]);
  const [agentLoadError, setAgentLoadError] = useState('');
  const [creatorSummary, setCreatorSummary] = useState<CreatorSummary | null>(null);
  const [lastAudit, setLastAudit] = useState<LastAuditSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  const loadCurrentCreatorSummary = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { setCreatorSummary(null); return; }
    const authUser = authData.user;
    const authMetadata = (authUser.user_metadata || {}) as AuthMetadata;
    const { data: profileData } = await supabase
      .from('profiles').select('id, role, agent_name, display_name, email').eq('id', authUser.id).maybeSingle();
    if (!profileData) {
      setCreatorSummary({ userId: authUser.id, name: pickPreferredName([authMetadata.display_name, authMetadata.full_name, authMetadata.name, authUser.email]), role: '', email: authUser.email || '' });
      return;
    }
    const cp = profileData as CreatorProfile;
    setCreatorSummary({ userId: cp.id, name: pickPreferredName([authMetadata.display_name, authMetadata.full_name, authMetadata.name, cp.display_name, cp.agent_name, cp.email, authUser.email]), role: cp.role, email: cp.email || authUser.email || '' });
  }, []);

  const loadLastAuditSummary = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { setLastAudit(null); return; }
    const { data } = await supabase
      .from('audits').select('id, agent_name, agent_id, team, case_type, audit_date, quality_score')
      .eq('created_by_user_id', authData.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!data) { setLastAudit(null); return; }
    setLastAudit({
      id: data.id,
      agentName: data.agent_name || '-',
      agentId: data.agent_id || null,
      team: (data.team || '') as TeamType,
      caseType: data.case_type || '-',
      auditDate: data.audit_date || '',
      qualityScore: typeof data.quality_score === 'number' ? data.quality_score : Number(data.quality_score),
    });
  }, []);

  useEffect(() => {
    void loadAgentProfiles();
    void loadCurrentCreatorSummary();
    void loadLastAuditSummary();
  }, [loadAgentProfiles, loadCurrentCreatorSummary, loadLastAuditSummary]);

  /* ── Restore step if draft exists ── */
  useEffect(() => {
    if (draft.team && currentStep === 'team') {
      const completed = new Set<Step>(['team']);
      if (draft.selectedAgentProfileId) {
        completed.add('agent');
        if (draft.caseType && draft.auditDate) {
          completed.add('details');
        }
      }
      setCompletedSteps(completed);
      if (draft.selectedAgentProfileId && draft.caseType && draft.auditDate) {
        setCurrentStep('scorecard');
      } else if (draft.selectedAgentProfileId) {
        setCurrentStep('details');
      } else if (draft.team) {
        setCurrentStep('agent');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Handlers ── */
  const handleRefreshAgents = useCallback(() => {
    clearAgentProfilesCache();
    void loadAgentProfiles({ force: true });
  }, [loadAgentProfiles]);

  const getAgentLabel = useCallback((profile: AgentProfile) => {
    return profile.display_name
      ? `${profile.agent_name} — ${profile.display_name}`
      : `${profile.agent_name} · ${profile.agent_id}`;
  }, []);

  const teamAgents = useMemo(
    () => agentProfiles.filter((p) => p.role === 'agent' && p.team === draft.team && p.agent_id && p.agent_name),
    [agentProfiles, draft.team]
  );

  const visibleAgents = useMemo(() => {
    const search = draft.agentSearch.trim().toLowerCase();
    if (!search) return teamAgents;
    return teamAgents.filter((p) =>
      p.agent_name.toLowerCase().includes(search) ||
      (p.agent_id || '').toLowerCase().includes(search) ||
      (p.display_name || '').toLowerCase().includes(search)
    );
  }, [teamAgents, draft.agentSearch]);

  const selectedAgent = useMemo(
    () => teamAgents.find((p) => p.id === draft.selectedAgentProfileId) || null,
    [teamAgents, draft.selectedAgentProfileId]
  );

  const adjustedData = useMemo(
    () => getAdjustedScoreData(draft.team, draft.scores, draft.metricComments),
    [draft.team, draft.scores, draft.metricComments]
  );

  const setDraftField = useCallback(<K extends keyof AuditDraft>(key: K, value: AuditDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, [setDraft]);

  const handleSelectTeam = useCallback((t: Exclude<TeamType, ''>) => {
    setDraft(createEmptyDraft(t));
    setCompletedSteps(new Set(['team']));
    setErrorMessage('');
    setSuccessMessage('');
  }, [setDraft]);

  const handleScoreChange = useCallback((metricName: string, value: string) => {
    if (isLockedToNA(metricName)) {
      setDraft((prev) => ({ ...prev, scores: { ...prev.scores, [metricName]: 'N/A' }, metricComments: { ...prev.metricComments, [metricName]: '' } }));
      return;
    }
    setDraft((prev) => {
      const nextMetricComments = { ...prev.metricComments };
      if (!shouldShowMetricComment(value)) delete nextMetricComments[metricName];
      return { ...prev, scores: { ...prev.scores, [metricName]: value }, metricComments: nextMetricComments };
    });
  }, [setDraft]);

  const handleMetricCommentChange = useCallback((metricName: string, value: string) => {
    setDraft((prev) => ({ ...prev, metricComments: { ...prev.metricComments, [metricName]: value } }));
  }, [setDraft]);

  const handleSelectAgent = useCallback((profile: AgentProfile) => {
    setDraft((prev) => ({ ...prev, selectedAgentProfileId: profile.id, agentSearch: getAgentLabel(profile) }));
  }, [getAgentLabel, setDraft]);

  const handleAgentSearchChange = useCallback((v: string) => {
    setDraftField('agentSearch', v);
    if (draft.selectedAgentProfileId) {
      setDraft((prev) => ({ ...prev, agentSearch: v, selectedAgentProfileId: '' }));
    }
  }, [setDraftField, setDraft, draft.selectedAgentProfileId]);

  /* ── Step navigation ── */
  const canAdvanceFrom = useCallback((step: Step): boolean => {
    if (step === 'team') return !!draft.team;
    if (step === 'agent') return !!selectedAgent;
    if (step === 'details') {
      if (!draft.caseType || !draft.auditDate) return false;
      if ((draft.team === 'Calls' || draft.team === 'Sales') && !draft.orderNumber) return false;
      if (draft.team === 'Tickets' && !draft.ticketId) return false;
      return true;
    }
    if (step === 'scorecard') {
      const missing = getMissingRequiredMetricLabels(draft.team, draft.scores);
      if (missing.length > 0) return false;
      const missingComments = getMetricsForTeam(draft.team)
        .filter((m) => countsTowardScore(m))
        .filter((m) => shouldShowMetricComment(getMetricStoredValue(m, draft.scores)))
        .filter((m) => !(draft.metricComments[m.name] || '').trim());
      return missingComments.length === 0;
    }
    return true;
  }, [draft, selectedAgent]);

  const handleNext = useCallback(() => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx < STEP_ORDER.length - 1) {
      if (!canAdvanceFrom(currentStep)) {
        if (currentStep === 'team') setErrorMessage('Please select a team.');
        else if (currentStep === 'agent') setErrorMessage('Please select an agent.');
        else if (currentStep === 'details') {
          if (!draft.caseType || !draft.auditDate) setErrorMessage('Please fill Case Type and Audit Date.');
          else if ((draft.team === 'Calls' || draft.team === 'Sales') && !draft.orderNumber) setErrorMessage('Please fill Order Number.');
          else if (draft.team === 'Tickets' && !draft.ticketId) setErrorMessage('Please fill Ticket ID.');
        } else if (currentStep === 'scorecard') {
          const missing = getMissingRequiredMetricLabels(draft.team, draft.scores);
          if (missing.length > 0) setErrorMessage(`Please answer: ${missing.join(', ')}.`);
          else {
            const missingComments = getMetricsForTeam(draft.team)
              .filter((m) => countsTowardScore(m))
              .filter((m) => shouldShowMetricComment(getMetricStoredValue(m, draft.scores)))
              .filter((m) => !(draft.metricComments[m.name] || '').trim())
              .map((m) => m.name);
            if (missingComments.length > 0) setErrorMessage(`Please add QA notes for: ${missingComments.join(', ')}.`);
          }
        }
        return;
      }
      setErrorMessage('');
      const next = STEP_ORDER[idx + 1];
      setCompletedSteps((prev) => { const s = new Set(prev); s.add(currentStep); return s; });
      setCurrentStep(next);
    }
  }, [currentStep, canAdvanceFrom, draft]);

  const handleBack = useCallback(() => {
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx > 0) {
      setErrorMessage('');
      setCurrentStep(STEP_ORDER[idx - 1]);
    }
  }, [currentStep]);

  const handleStepClick = useCallback((step: Step) => {
    setErrorMessage('');
    setCurrentStep(step);
  }, []);

  const handleSave = useCallback(async () => {
    setErrorMessage('');
    if (!draft.team) { setErrorMessage('Please choose a team.'); return; }
    if (!selectedAgent) { setErrorMessage('Please choose an agent.'); return; }
    if (!draft.caseType || !draft.auditDate) { setErrorMessage('Please fill Case Type and Audit Date.'); return; }
    if ((draft.team === 'Calls' || draft.team === 'Sales') && !draft.orderNumber) { setErrorMessage('Please fill Order Number.'); return; }
    if (draft.team === 'Tickets' && !draft.ticketId) { setErrorMessage('Please fill Ticket ID.'); return; }
    const missingRequired = getMissingRequiredMetricLabels(draft.team, draft.scores);
    if (missingRequired.length > 0) { setErrorMessage(`Please answer: ${missingRequired.join(', ')}.`); return; }
    const missingComments = getMetricsForTeam(draft.team)
      .filter((m) => countsTowardScore(m))
      .filter((m) => shouldShowMetricComment(getMetricStoredValue(m, draft.scores)))
      .filter((m) => !(draft.metricComments[m.name] || '').trim())
      .map((m) => m.name);
    if (missingComments.length > 0) { setErrorMessage(`Please add QA notes for: ${missingComments.join(', ')}.`); return; }
    if (!selectedAgent.agent_id) { setErrorMessage('Selected agent does not have an Agent ID.'); return; }

    setSaving(true);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) { setSaving(false); setErrorMessage(authError?.message || 'Authentication error.'); return; }
    const authUser = authData.user;
    const { data: creatorProfileData, error: cpe } = await supabase.from('profiles').select('id, role, agent_name, display_name, email').eq('id', authUser.id).maybeSingle();
    if (cpe || !creatorProfileData) { setSaving(false); setErrorMessage(cpe?.message || 'Could not load profile.'); return; }
    const cp = creatorProfileData as CreatorProfile;
    const authMetadata = (authUser.user_metadata || {}) as AuthMetadata;
    const createdByName = pickPreferredName([authMetadata.display_name, authMetadata.full_name, authMetadata.name, cp.display_name, cp.agent_name, cp.email, authUser.email]);

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
    setDraft(createEmptyDraft(savedTeam));
    setCurrentStep('team');
    setCompletedSteps(new Set());
    setSaveSuccess(true);
    setSuccessMessage(`Audit saved — ${selectedAgent.agent_name} · ${draft.caseType} · ${adjustedData.qualityScore}%`);
    setTimeout(() => setSaveSuccess(false), 5000);
    void loadCurrentCreatorSummary();
    void loadLastAuditSummary();
  }, [draft, selectedAgent, adjustedData, setDraft, loadCurrentCreatorSummary, loadLastAuditSummary]);

  const handleClearDraft = useCallback(() => {
    setDraft(createEmptyDraft(draft.team));
    setCurrentStep('team');
    setCompletedSteps(new Set());
    setErrorMessage('');
    setSuccessMessage('Draft cleared.');
  }, [draft.team, setDraft]);

  const metrics = getMetricsForTeam(draft.team);
  const isLastStep = currentStep === 'review';
  const isFirstStep = currentStep === 'team';

  return (
    <div
      data-no-theme-invert="true"
      style={{
        color: 'var(--na-text)',
        ...(themeVars as CSSProperties),
        fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
        minHeight: '100vh',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* Page header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 14, marginBottom: 28,
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: teamAccent, marginBottom: 6, transition: 'color 0.3s ease' }}>
            Audit Workspace
          </div>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-0.025em', color: 'var(--na-text)' }}>
            New Audit
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Live score badge if on scorecard */}
          {(currentStep === 'scorecard' || currentStep === 'review') && draft.team && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 14px 6px 10px',
              borderRadius: 12,
              background: 'var(--na-surface)',
              border: '1.5px solid var(--na-border-strong)',
              animation: 'na-scaleIn 0.2s ease both',
            }}>
              <ScoreDisplay qualityScore={adjustedData.qualityScore} hasAutoFail={adjustedData.hasAutoFail} compact />
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--na-text-3)' }}>Live Score</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: adjustedData.hasAutoFail ? '#dc2626' : getScoreColor(parseFloat(adjustedData.qualityScore)), letterSpacing: '-0.03em' }}>
                  {adjustedData.qualityScore}%
                </div>
              </div>
            </div>
          )}
          <button type="button" className="na-btn-secondary" onClick={handleClearDraft}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
            Clear
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 16px', borderRadius: 12, marginBottom: 16,
          background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.2)',
          color: '#fca5a5', fontWeight: 600, fontSize: 13,
          animation: 'na-scaleIn 0.15s ease both',
        }} role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {errorMessage}
          <button type="button" onClick={() => setErrorMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}
      {successMessage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 16px', borderRadius: 12, marginBottom: 16,
          background: 'rgba(16,185,129,0.08)', border: '1.5px solid rgba(16,185,129,0.2)',
          color: '#6ee7b7', fontWeight: 600, fontSize: 13,
          animation: 'na-scaleIn 0.15s ease both',
        }} role="status">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          {successMessage}
          <button type="button" onClick={() => setSuccessMessage('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Main wizard card */}
      <div style={{
        background: 'var(--na-surface)',
        border: '1.5px solid var(--na-border-strong)',
        borderRadius: 20,
        boxShadow: 'var(--na-shadow-md)',
        overflow: 'hidden',
      }}>
        {/* Step indicator bar */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--na-border)',
          background: 'var(--na-surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
          overflowX: 'auto',
        }}>
          <StepIndicator
            currentStep={currentStep}
            completedSteps={completedSteps}
            teamAccent={teamAccent}
            onStepClick={handleStepClick}
          />
          {draft.team && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: `${teamAccent}12`,
              color: teamAccent,
              border: `1px solid ${teamAccent}25`,
              flexShrink: 0,
            }}
              dangerouslySetInnerHTML={{
                __html: `<span style="display:flex;align-items:center;gap:6px">${TEAM_CONFIG[draft.team]?.icon ?? ''}<span>${draft.team}</span></span>`,
              }}
            />
          )}
        </div>

        {/* Step content */}
        <div style={{ padding: '28px 28px 24px' }}>
          {currentStep === 'team' && (
            <TeamStep selectedTeam={draft.team} onSelect={handleSelectTeam} />
          )}
          {currentStep === 'agent' && draft.team && (
            <AgentStep
              draft={draft}
              teamAgents={teamAgents}
              visibleAgents={visibleAgents}
              selectedAgent={selectedAgent}
              loadingAgents={loadingAgents}
              agentLoadError={agentLoadError}
              teamAccent={teamAccent}
              onSelectAgent={handleSelectAgent}
              onSearchChange={handleAgentSearchChange}
              onRefresh={handleRefreshAgents}
              getAgentLabel={getAgentLabel}
            />
          )}
          {currentStep === 'details' && (
            <DetailsStep draft={draft} setDraftField={setDraftField} />
          )}
          {currentStep === 'scorecard' && draft.team && (
            <ScorecardStep
              draft={draft}
              metrics={metrics}
              adjustedData={adjustedData}
              onScoreChange={handleScoreChange}
              onMetricCommentChange={handleMetricCommentChange}
              teamAccent={teamAccent}
            />
          )}
          {currentStep === 'review' && (
            <ReviewStep
              draft={draft}
              selectedAgent={selectedAgent}
              creatorSummary={creatorSummary}
              adjustedData={adjustedData}
              teamAccent={teamAccent}
              lastAudit={lastAudit}
            />
          )}
        </div>

        {/* Bottom navigation */}
        <div style={{
          padding: '16px 28px 20px',
          borderTop: '1px solid var(--na-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
          background: 'var(--na-surface-2)',
        }}>
          <button
            type="button"
            className="na-btn-secondary"
            onClick={handleBack}
            disabled={isFirstStep}
            style={{ opacity: isFirstStep ? 0 : 1, pointerEvents: isFirstStep ? 'none' : 'auto' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Step dots */}
            <div style={{ display: 'flex', gap: 5 }}>
              {STEP_ORDER.map((s) => (
                <div
                  key={s}
                  style={{
                    width: s === currentStep ? 18 : 6,
                    height: 6, borderRadius: 999,
                    background: s === currentStep ? teamAccent : completedSteps.has(s) ? `${teamAccent}60` : 'var(--na-border-strong)',
                    transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                />
              ))}
            </div>

            {isLastStep ? (
              <button
                type="button"
                className="na-btn-primary"
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: saving ? 'var(--na-surface-3)' : `linear-gradient(135deg, ${teamAccent}, ${teamAccent}cc)`,
                  color: saving ? 'var(--na-text-3)' : '#fff',
                  boxShadow: saving ? 'none' : `0 6px 24px ${teamAccent}40`,
                  minWidth: 140,
                }}
              >
                {saving ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'na-pulse 1s ease infinite' }}>
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                    Saving…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Save Audit
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="na-btn-primary"
                onClick={() => {
                  if (currentStep === 'team' && draft.team) {
                    handleNext();
                  } else {
                    handleNext();
                  }
                }}
                disabled={currentStep === 'team' && !draft.team}
                style={{
                  background: `linear-gradient(135deg, ${teamAccent}, ${teamAccent}cc)`,
                  color: '#fff',
                  boxShadow: `0 4px 16px ${teamAccent}30`,
                  opacity: currentStep === 'team' && !draft.team ? 0.5 : 1,
                }}
              >
                Continue
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(NewAuditSupabase);

/* ═══════════════════════════════════════════════════════════
   Module-level styles
   ═══════════════════════════════════════════════════════════ */

const styles: Record<string, CSSProperties> = {
  stepHeading: {
    fontSize: 20,
    fontWeight: 800,
    color: 'var(--na-text)',
    letterSpacing: '-0.02em',
  },
  fieldLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--na-text-2)',
    marginBottom: 7,
    letterSpacing: '0.01em',
  },
  reviewCard: {
    padding: '16px 20px',
    borderRadius: 14,
    background: 'var(--na-surface)',
    border: '1px solid var(--na-border-strong)',
  },
  reviewCardLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase' as const,
    color: 'var(--na-text-3)',
  },
};
