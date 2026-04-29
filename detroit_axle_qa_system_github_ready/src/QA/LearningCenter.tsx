import { useState, useCallback, useMemo, memo, useEffect } from "react";
import QuizEngine from "./QuizEngine";
import CertificationTracker from "./CertificationTracker";
import type { UserProfile } from "../context/AuthContext";
import {
  fetchLearningModules, fetchSOPs, fetchWorkInstructions, fetchDefectExamples,
  fetchQuizzes, fetchLessonsLearned, fetchBestPractices,
  fetchOrCreateUserProgress, upsertUserProgress, fetchUserUpvotes,
  toggleLessonUpvote, fetchTeamMembers, fetchCoachingNotes, upsertCoachingNote,
  createAssignment, fetchAgentAssignments, fetchRecommendedModuleIds,
  fetchAuditLinks, checkAndGrantCertifications, fetchOnboardingTracks,
  incrementModuleCompletions,
} from "./learningService";
import type {
  LearningModule, SOPDocument, WorkInstruction, DefectExample,
  Quiz, LessonLearned, BestPractice, TeamMember, CoachingNote,
  UserProgress, Certification, OnboardingTrack, AuditLink,
} from "./learningService";

// ─── Re-export types consumers rely on ───────────────────────────────────────
export type { LearningModule, SOPDocument, WorkInstruction, DefectExample,
              Quiz, LessonLearned, BestPractice, TeamMember, CoachingNote,
              UserProgress, Certification, OnboardingTrack, AuditLink };

// ─── Tab type ─────────────────────────────────────────────────────────────────
export type LCTab =
  | "home" | "modules" | "sop" | "work-instructions" | "defects"
  | "standards" | "onboarding" | "quizzes" | "certifications"
  | "lessons" | "audit-findings" | "best-practices" | "analytics" | "coaching";

// ─── Quiz question type (used by QuizEngine) ──────────────────────────────────
export interface QuizQuestion {
  id: string; question: string; options: string[];
  correctIndex: number; explanation: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1500, 2500];
const LEVEL_NAMES = ["Rookie","Learner","Practitioner","Specialist","Expert","Master","Legend"];

const DEFAULT_PROGRESS: UserProgress = {
  completedModules: [], completedQuizzes: [], quizScores: {},
  xp: 0, level: 0, badges: [], streak: 0,
  lastActiveDate: new Date().toISOString().split("T")[0],
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const LC_CSS_ID = "da-learning-center-v2";
const LC_CSS = `
.lc-root{display:flex;flex-direction:column;gap:0;min-height:100%;animation:fadeUp 220ms ease both}
.lc-hero{background:linear-gradient(135deg,color-mix(in srgb,var(--accent-violet) 12%,var(--bg-elevated)) 0%,color-mix(in srgb,var(--accent-blue) 8%,var(--bg-elevated)) 50%,color-mix(in srgb,var(--accent-cyan) 6%,var(--bg-elevated)) 100%);border:1px solid var(--border);border-radius:16px;padding:28px 32px;margin-bottom:24px;position:relative;overflow:hidden}
.lc-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 80% 50%,color-mix(in srgb,var(--accent-violet) 10%,transparent),transparent);pointer-events:none}
.lc-hero-inner{position:relative;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
.lc-hero-title{font-size:24px;font-weight:800;letter-spacing:-0.03em;color:var(--fg-default);margin-bottom:6px}
.lc-hero-sub{font-size:13px;color:var(--fg-muted);max-width:480px}
.lc-hero-xp{display:flex;align-items:center;gap:16px;flex-shrink:0}
.lc-xp-card{background:var(--bg-overlay);border:1px solid var(--border-strong);border-radius:12px;padding:12px 18px;text-align:center;min-width:90px}
.lc-xp-val{font-size:22px;font-weight:800;letter-spacing:-0.03em;color:var(--accent-violet)}
.lc-xp-label{font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-muted);margin-top:2px}
.lc-progress-ring-wrap{position:relative;width:72px;height:72px;flex-shrink:0}
.lc-progress-ring-label{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.lc-progress-ring-level{font-size:18px;font-weight:800;color:var(--fg-default);line-height:1}
.lc-progress-ring-name{font-size:8px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--fg-muted);margin-top:2px}
.lc-tab-nav{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:24px}
.lc-tab-btn{display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--fg-muted);font-size:12px;font-weight:500;font-family:inherit;cursor:pointer;transition:all 120ms ease;white-space:nowrap}
.lc-tab-btn:hover{color:var(--fg-default);background:var(--bg-subtle-hover)}
.lc-tab-btn.active{color:var(--accent-violet);background:color-mix(in srgb,var(--accent-violet) 10%,transparent);border-color:color-mix(in srgb,var(--accent-violet) 20%,transparent);font-weight:600}
.lc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.lc-grid-sm{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.lc-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:20px;transition:border-color 140ms ease,box-shadow 140ms ease,transform 140ms ease;cursor:pointer}
.lc-card:hover{border-color:var(--border-strong);box-shadow:var(--shadow-md);transform:translateY(-1px)}
.lc-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
.lc-card-title{font-size:14px;font-weight:700;color:var(--fg-default);letter-spacing:-0.01em;line-height:1.3}
.lc-card-desc{font-size:12px;color:var(--fg-muted);line-height:1.6;margin-bottom:14px}
.lc-card-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.lc-badge{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 8px;border-radius:5px;font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap}
.lc-badge-violet{background:color-mix(in srgb,var(--accent-violet) 12%,transparent);color:var(--accent-violet)}
.lc-badge-blue{background:color-mix(in srgb,var(--accent-blue) 12%,transparent);color:var(--accent-blue)}
.lc-badge-cyan{background:color-mix(in srgb,var(--accent-cyan) 12%,transparent);color:var(--accent-cyan)}
.lc-badge-amber{background:color-mix(in srgb,var(--accent-amber) 12%,transparent);color:var(--accent-amber)}
.lc-badge-rose{background:color-mix(in srgb,var(--accent-rose) 12%,transparent);color:var(--accent-rose)}
.lc-badge-emerald{background:color-mix(in srgb,var(--accent-emerald) 12%,transparent);color:var(--accent-emerald)}
.lc-badge-muted{background:var(--bg-subtle);color:var(--fg-muted)}
.lc-section-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.lc-section-title{font-size:16px;font-weight:700;letter-spacing:-0.02em;color:var(--fg-default)}
.lc-section-sub{font-size:12px;color:var(--fg-muted);margin-top:2px}
.lc-pinned{background:linear-gradient(135deg,color-mix(in srgb,var(--accent-amber) 8%,var(--bg-elevated)),color-mix(in srgb,var(--accent-rose) 5%,var(--bg-elevated)));border:1px solid color-mix(in srgb,var(--accent-amber) 20%,transparent);border-radius:14px;padding:20px 24px;margin-bottom:24px}
.lc-pinned-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:14px}
.lc-pinned-item{background:var(--bg-overlay);border:1px solid var(--border);border-radius:10px;padding:12px 14px;cursor:pointer;transition:all 120ms ease;display:flex;align-items:flex-start;gap:10px}
.lc-pinned-item:hover{border-color:var(--border-strong);background:var(--bg-subtle-hover)}
.lc-pinned-icon{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;font-size:14px}
.lc-pinned-item-title{font-size:12px;font-weight:600;color:var(--fg-default);margin-bottom:2px}
.lc-pinned-item-sub{font-size:11px;color:var(--fg-muted)}
.lc-badges-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.lc-achievement-badge{display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:7px;font-size:11px;font-weight:600;border:1px solid color-mix(in srgb,var(--accent-amber) 25%,transparent);background:color-mix(in srgb,var(--accent-amber) 8%,transparent);color:var(--accent-amber)}
.lc-sop-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:border-color 140ms ease}
.lc-sop-card:hover{border-color:var(--border-strong)}
.lc-sop-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:12px}
.lc-sop-body{padding:16px 20px}
.lc-sop-version{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--fg-muted);margin-top:4px}
.lc-sop-changelog{margin-top:12px;border-top:1px solid var(--border);padding-top:12px}
.lc-sop-changelog-item{display:flex;gap:12px;padding:6px 0;font-size:11px;color:var(--fg-muted);border-bottom:1px solid var(--border)}
.lc-sop-changelog-item:last-child{border-bottom:none}
.lc-sop-changelog-version{font-family:var(--font-mono,monospace);font-weight:600;color:var(--accent-cyan);flex-shrink:0;min-width:36px}
.lc-defect-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.lc-defect-top{padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)}
.lc-defect-body{padding:14px 18px;display:flex;flex-direction:column;gap:10px}
.lc-defect-label{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px}
.lc-defect-bad{color:var(--accent-rose)}
.lc-defect-good{color:var(--accent-emerald)}
.lc-defect-text{font-size:12px;color:var(--fg-muted);line-height:1.6}
.lc-wi-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:18px 20px}
.lc-wi-steps{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.lc-wi-step{display:flex;align-items:flex-start;gap:10px;font-size:12px;color:var(--fg-muted);line-height:1.5}
.lc-wi-step-num{width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--accent-blue) 12%,transparent);color:var(--accent-blue);font-size:10px;font-weight:700;display:grid;place-items:center;flex-shrink:0;margin-top:1px}
.lc-lesson-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:18px 20px;transition:border-color 140ms ease}
.lc-lesson-card:hover{border-color:var(--border-strong)}
.lc-lesson-insight{font-size:13px;color:var(--fg-default);line-height:1.7;margin:10px 0;padding:12px 14px;background:var(--bg-subtle);border-radius:8px;border-left:3px solid var(--accent-cyan)}
.lc-lesson-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:8px}
.lc-upvote-btn{display:flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--fg-muted);font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 120ms ease}
.lc-upvote-btn:hover{color:var(--accent-violet);border-color:color-mix(in srgb,var(--accent-violet) 30%,transparent);background:color-mix(in srgb,var(--accent-violet) 8%,transparent)}
.lc-standard-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:20px}
.lc-standard-score{font-size:36px;font-weight:800;letter-spacing:-0.04em;line-height:1;margin:8px 0}
.lc-standard-bar{height:6px;border-radius:999px;background:var(--border);overflow:hidden;margin:6px 0}
.lc-standard-bar-fill{height:100%;border-radius:999px;transition:width 600ms ease}
.lc-analytics-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:24px}
.lc-stat-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:18px 20px}
.lc-stat-val{font-size:32px;font-weight:800;letter-spacing:-0.04em;line-height:1;margin-bottom:4px}
.lc-stat-label{font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--fg-muted)}
.lc-search-bar{width:100%;display:flex;align-items:center;gap:10px;height:42px;padding:0 14px;border-radius:10px;border:1px solid var(--border-strong);background:var(--bg-elevated);margin-bottom:20px}
.lc-search-input{flex:1;background:transparent;border:none;outline:none;font-size:13px;font-family:inherit;color:var(--fg-default)}
.lc-search-input::placeholder{color:var(--fg-muted)}
.lc-coaching-agent{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px 10px 0 0;margin-bottom:0}
.lc-coaching-agent-info{display:flex;align-items:center;gap:12px}
.lc-coaching-avatar{width:36px;height:36px;border-radius:10px;background:color-mix(in srgb,var(--accent-blue) 15%,transparent);border:1px solid color-mix(in srgb,var(--accent-blue) 25%,transparent);color:var(--accent-blue);display:grid;place-items:center;font-size:12px;font-weight:700;flex-shrink:0}
.lc-assign-btn{display:flex;align-items:center;gap:5px;height:28px;padding:0 12px;border-radius:7px;border:1px solid color-mix(in srgb,var(--accent-blue) 25%,transparent);background:color-mix(in srgb,var(--accent-blue) 8%,transparent);color:var(--accent-blue);font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 120ms ease}
.lc-assign-btn:hover{background:color-mix(in srgb,var(--accent-blue) 14%,transparent)}
.lc-detail-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:flex-start;justify-content:flex-end;animation:fadeIn 120ms ease}
.lc-detail-panel{width:min(600px,100vw);height:100vh;background:var(--bg-elevated);border-left:1px solid var(--border-strong);overflow-y:auto;animation:lcSlideIn 200ms cubic-bezier(0.16,1,0.3,1) both;display:flex;flex-direction:column}
@keyframes lcSlideIn{from{transform:translateX(32px);opacity:0}to{transform:translateX(0);opacity:1}}
.lc-detail-header{padding:24px 28px 20px;border-bottom:1px solid var(--border);flex-shrink:0}
.lc-detail-body{padding:24px 28px;flex:1}
.lc-detail-close{width:28px;height:28px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--fg-muted);display:grid;place-items:center;cursor:pointer;transition:all 120ms ease;font-size:14px;font-family:inherit}
.lc-detail-close:hover{color:var(--fg-default);background:var(--bg-subtle-hover)}
.lc-detail-content{font-size:13px;color:var(--fg-muted);line-height:1.8;white-space:pre-wrap}
.lc-detail-content strong{color:var(--fg-default);font-weight:700}
.lc-complete-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:42px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent-violet),var(--accent-blue));color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;transition:opacity 120ms ease,transform 120ms ease;margin-top:24px}
.lc-complete-btn:hover{opacity:0.9;transform:translateY(-1px)}
.lc-complete-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
.lc-onboarding-track{background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px}
.lc-onboarding-header{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.lc-onboarding-steps{padding:0;list-style:none}
.lc-onboarding-step{display:flex;align-items:center;gap:14px;padding:14px 22px;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer;transition:background 100ms ease}
.lc-onboarding-step:last-child{border-bottom:none}
.lc-onboarding-step:hover{background:var(--bg-subtle-hover)}
.lc-onboarding-step.completed{opacity:0.6}
.lc-step-check{width:22px;height:22px;border-radius:50%;border:2px solid var(--border-strong);display:grid;place-items:center;flex-shrink:0;font-size:10px;transition:all 200ms ease}
.lc-step-check.done{background:var(--accent-emerald);border-color:var(--accent-emerald);color:#fff}
.lc-bp-card{background:linear-gradient(135deg,color-mix(in srgb,var(--accent-emerald) 6%,var(--bg-elevated)),var(--bg-elevated));border:1px solid color-mix(in srgb,var(--accent-emerald) 15%,transparent);border-radius:12px;padding:18px 20px;transition:border-color 140ms ease}
.lc-bp-card:hover{border-color:color-mix(in srgb,var(--accent-emerald) 30%,transparent)}
.lc-bp-quote{font-size:13px;color:var(--fg-default);line-height:1.7;font-style:italic;margin:10px 0;padding:10px 14px;border-left:3px solid var(--accent-emerald)}
.lc-streak-banner{display:flex;align-items:center;gap:12px;padding:10px 16px;background:color-mix(in srgb,var(--accent-amber) 8%,var(--bg-elevated));border:1px solid color-mix(in srgb,var(--accent-amber) 20%,transparent);border-radius:10px;margin-bottom:16px;font-size:13px;font-weight:600;color:var(--accent-amber)}
.lc-skeleton{background:linear-gradient(90deg,var(--bg-subtle) 25%,var(--border) 50%,var(--bg-subtle) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:8px}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.lc-recommendation-banner{display:flex;align-items:center;gap:12px;padding:12px 16px;background:color-mix(in srgb,var(--accent-rose) 6%,var(--bg-elevated));border:1px solid color-mix(in srgb,var(--accent-rose) 18%,transparent);border-radius:10px;margin-bottom:16px;font-size:12px;color:var(--fg-default);font-weight:500}
.lc-admin-action-btn{display:flex;align-items:center;gap:6px;height:30px;padding:0 12px;border-radius:8px;border:1px solid color-mix(in srgb,var(--accent-violet) 25%,transparent);background:color-mix(in srgb,var(--accent-violet) 8%,transparent);color:var(--accent-violet);font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 120ms ease}
.lc-admin-action-btn:hover{background:color-mix(in srgb,var(--accent-violet) 14%,transparent)}
@media(max-width:640px){.lc-hero{padding:20px}.lc-grid{grid-template-columns:1fr}.lc-pinned-items{grid-template-columns:1fr}.lc-analytics-grid{grid-template-columns:1fr 1fr}}
`;

function injectLCStyles() {
  if (document.getElementById(LC_CSS_ID)) return;
  const el = document.createElement("style");
  el.id = LC_CSS_ID; el.textContent = LC_CSS;
  document.head.appendChild(el);
}

// ─── Small reusable components (pure presentation) ───────────────────────────

const DifficultyBadge = memo(function DifficultyBadge({ difficulty }: { difficulty: LearningModule["difficulty"] }) {
  const map: Record<LearningModule["difficulty"], string> = { beginner: "lc-badge-emerald", intermediate: "lc-badge-amber", advanced: "lc-badge-rose" };
  return <span className={`lc-badge ${map[difficulty]}`}>{difficulty}</span>;
});

const SeverityBadge = memo(function SeverityBadge({ severity }: { severity: DefectExample["severity"] }) {
  const map: Record<DefectExample["severity"], string> = { low: "lc-badge-muted", medium: "lc-badge-amber", high: "lc-badge-rose", critical: "lc-badge-rose" };
  return <span className={`lc-badge ${map[severity]}`}>{severity}</span>;
});

const XPPill = memo(function XPPill({ xp }: { xp: number }) {
  return <span className="lc-badge lc-badge-violet">+{xp} XP</span>;
});

const CompletedPill = memo(function CompletedPill() {
  return <span className="lc-badge lc-badge-emerald">✓ Done</span>;
});

const StarRating = memo(function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ color: "var(--accent-amber)", fontSize: "11px", fontWeight: 600 }}>
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))} {rating.toFixed(1)}
    </span>
  );
});

const ProgressRing = memo(function ProgressRing({ pct, size = 72, stroke = 6, color = "var(--accent-violet)" }: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${circ * (pct / 100)} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 600ms ease" }} />
    </svg>
  );
});

function SearchSVG() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <div className="lc-skeleton" style={{ height: 14, width: "70%", marginBottom: 10 }} />
      <div className="lc-skeleton" style={{ height: 11, width: "100%", marginBottom: 6 }} />
      <div className="lc-skeleton" style={{ height: 11, width: "80%" }} />
    </div>
  );
}

// ─── Supabase Data Hook ───────────────────────────────────────────────────────

interface LearningData {
  modules: LearningModule[];
  sops: SOPDocument[];
  workInstructions: WorkInstruction[];
  defects: DefectExample[];
  quizzes: Quiz[];
  lessons: LessonLearned[];
  bestPractices: BestPractice[];
  progress: UserProgress;
  teamData: TeamMember[];
  coachingNotes: CoachingNote[];
  recommendations: string[];
  auditLinks: AuditLink[];
  onboardingTracks: OnboardingTrack[];
  userUpvotes: Set<string>;
  assignedModuleIds: Set<string>;
  loading: boolean;
  error: string | null;
}

function useSupabaseLearning(userId: string | undefined, role: string): LearningData & {
  completeModule: (moduleId: string) => Promise<void>;
  completeQuiz: (quizId: string, score: number) => Promise<void>;
  saveCoachingNote: (agentId: string, note: string, metric?: string) => Promise<void>;
  assignModule: (agentId: string, moduleId: string) => Promise<void>;
  toggleUpvote: (lessonId: string) => Promise<void>;
  handleCertificationEarned: (certId: string) => Promise<void>;
} {
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [sops, setSops] = useState<SOPDocument[]>([]);
  const [workInstructions, setWorkInstructions] = useState<WorkInstruction[]>([]);
  const [defects, setDefects] = useState<DefectExample[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [bestPractices, setBestPractices] = useState<BestPractice[]>([]);
  const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS);
  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [coachingNotes, setCoachingNotes] = useState<CoachingNote[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [auditLinks, setAuditLinks] = useState<AuditLink[]>([]);
  const [onboardingTracks, setOnboardingTracks] = useState<OnboardingTrack[]>([]);
  const [userUpvotes, setUserUpvotes] = useState<Set<string>>(new Set());
  const [assignedModuleIds, setAssignedModuleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const activeUserId = userId;

    const isSup = role === "supervisor";
    const isAgent = role === "agent";

    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [
          modRes, sopRes, wiRes, defRes, quizRes,
          lessonRes, bpRes, progressRes, upvoteRes, trackRes,
        ] = await Promise.all([
          fetchLearningModules(),
          fetchSOPs(),
          fetchWorkInstructions(),
          fetchDefectExamples(),
          fetchQuizzes(),
          fetchLessonsLearned(),
          fetchBestPractices(),
          fetchOrCreateUserProgress(activeUserId),
          fetchUserUpvotes(activeUserId),
          fetchOnboardingTracks(role),
        ]);

        if (modRes.data)        setModules(modRes.data);
        if (sopRes.data)        setSops(sopRes.data);
        if (wiRes.data)         setWorkInstructions(wiRes.data);
        if (defRes.data)        setDefects(defRes.data);
        if (quizRes.data)       setQuizzes(quizRes.data);
        if (lessonRes.data)     setLessons(lessonRes.data);
        if (bpRes.data)         setBestPractices(bpRes.data);
        if (progressRes.data)   setProgress(progressRes.data);
        if (upvoteRes.data)     setUserUpvotes(new Set(upvoteRes.data));
        if (trackRes.data)      setOnboardingTracks(trackRes.data);

        if (isSup) {
          const [teamRes, notesRes, linksRes] = await Promise.all([
            fetchTeamMembers(activeUserId),
            fetchCoachingNotes(activeUserId),
            fetchAuditLinks(),
          ]);
          if (teamRes.data)  setTeamData(teamRes.data);
          if (notesRes.data) setCoachingNotes(notesRes.data);
          if (linksRes.data) setAuditLinks(linksRes.data);
        } else if (isAgent) {
          const [recRes, assignRes, linksRes] = await Promise.all([
            fetchRecommendedModuleIds(activeUserId),
            fetchAgentAssignments(activeUserId),
            fetchAuditLinks(activeUserId),
          ]);
          if (recRes.data)    setRecommendations(recRes.data);
          if (assignRes.data) setAssignedModuleIds(new Set(assignRes.data.map(a => a.moduleId ?? "").filter(Boolean)));
          if (linksRes.data)  setAuditLinks(linksRes.data);
        } else {
          const [teamRes, notesRes, linksRes] = await Promise.all([
            fetchTeamMembers(activeUserId),
            fetchCoachingNotes(activeUserId),
            fetchAuditLinks(),
          ]);
          if (teamRes.data)  setTeamData(teamRes.data);
          if (notesRes.data) setCoachingNotes(notesRes.data);
          if (linksRes.data) setAuditLinks(linksRes.data);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load learning data");
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, [userId, role]);

  // ── Mutation: complete a module ──────────────────────────────────────────
  const completeModule = useCallback(async (moduleId: string) => {
    if (!userId) return;
    const mod = modules.find(m => m.id === moduleId);
    if (!mod || progress.completedModules.includes(moduleId)) return;

    const newCompletedModules = [...progress.completedModules, moduleId];
    const newXP = progress.xp + mod.xpReward;
    const newLevel = Math.max(0,
      (LEVEL_THRESHOLDS.findIndex(t => t > newXP) - 1 + LEVEL_THRESHOLDS.length) % LEVEL_THRESHOLDS.length
    );
    const newBadges = [...progress.badges];
    if (!newBadges.includes("First Module") && newCompletedModules.length === 1) {
      newBadges.push("First Module");
    }

    const updated: UserProgress = {
      ...progress,
      completedModules: newCompletedModules,
      xp: newXP, level: newLevel, badges: newBadges,
    };

    setProgress(updated);
    await Promise.all([
      upsertUserProgress(userId, updated),
      incrementModuleCompletions(moduleId),
      checkAndGrantCertifications(userId, updated),
    ]);
  }, [userId, modules, progress]);

  // ── Mutation: complete a quiz ────────────────────────────────────────────
  const completeQuiz = useCallback(async (quizId: string, score: number) => {
    if (!userId) return;
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) return;

    const passed = score >= quiz.passingScore;
    const prevScore = progress.quizScores[quizId] ?? 0;
    const bestScore = Math.max(prevScore, score);
    const newCompletedQuizzes = progress.completedQuizzes.includes(quizId)
      ? progress.completedQuizzes
      : [...progress.completedQuizzes, quizId];
    const xpEarned = passed && !progress.completedQuizzes.includes(quizId) ? quiz.xpReward : 0;
    const newBadges = [...progress.badges];
    if (score === 100 && !newBadges.includes("Perfect Score")) newBadges.push("Perfect Score");

    const updated: UserProgress = {
      ...progress,
      completedQuizzes: newCompletedQuizzes,
      quizScores: { ...progress.quizScores, [quizId]: bestScore },
      xp: progress.xp + xpEarned,
      badges: newBadges,
    };

    setProgress(updated);
    await Promise.all([
      upsertUserProgress(userId, updated),
      checkAndGrantCertifications(userId, updated),
    ]);
  }, [userId, quizzes, progress]);

  // ── Mutation: save coaching note ─────────────────────────────────────────
  const saveCoachingNote = useCallback(async (agentId: string, note: string, metric?: string) => {
    if (!userId || !note.trim()) return;
    const res = await upsertCoachingNote({ supervisorId: userId, agentId, note, metric });
    if (res.data) {
      setCoachingNotes(prev => {
        const idx = prev.findIndex(n => n.agentId === agentId);
        return idx >= 0
          ? prev.map((n, i) => i === idx ? res.data! : n)
          : [res.data!, ...prev];
      });
    }
  }, [userId]);

  // ── Mutation: assign module ──────────────────────────────────────────────
  const assignModule = useCallback(async (agentId: string, moduleId: string) => {
    if (!userId) return;
    await createAssignment({ agentId, moduleId, assignedBy: userId });
  }, [userId]);

  // ── Mutation: toggle lesson upvote ───────────────────────────────────────
  const toggleUpvote = useCallback(async (lessonId: string) => {
    if (!userId) return;
    const alreadyUpvoted = userUpvotes.has(lessonId);
    setUserUpvotes(prev => {
      const next = new Set(prev);
      alreadyUpvoted ? next.delete(lessonId) : next.add(lessonId);
      return next;
    });
    setLessons(prev => prev.map(l => l.id === lessonId
      ? { ...l, upvotes: l.upvotes + (alreadyUpvoted ? -1 : 1) }
      : l
    ));
    await toggleLessonUpvote(userId, lessonId, alreadyUpvoted);
  }, [userId, userUpvotes]);

  // ── Mutation: persist a cert newly detected by CertificationTracker ──────
  // CertificationTracker evaluates criteria client-side and fires this when
  // it detects a cert is earned that isn't yet in progress.certifications.
  // We optimistically add it to progress so the badge appears immediately,
  // then let checkAndGrantCertifications write the canonical DB row.
  const handleCertificationEarned = useCallback(async (certId: string) => {
    if (!userId) return;
    const alreadyHeld = (progress.certifications ?? []).some(c => c.id === certId);
    if (alreadyHeld) return;

    const newCert: Certification = {
      id: certId,
      earnedAt: new Date().toISOString(),
    };
    const updated: UserProgress = {
      ...progress,
      certifications: [...(progress.certifications ?? []), newCert],
    };

    setProgress(updated);
    await Promise.all([
      upsertUserProgress(userId, updated),
      checkAndGrantCertifications(userId, updated),
    ]);
  }, [userId, progress]);

  return {
    modules, sops, workInstructions, defects, quizzes, lessons, bestPractices,
    progress, teamData, coachingNotes, recommendations, auditLinks,
    onboardingTracks, userUpvotes, assignedModuleIds,
    loading, error,
    completeModule, completeQuiz, saveCoachingNote, assignModule, toggleUpvote,
    handleCertificationEarned,
  };
}

// ─── Module Detail Panel ──────────────────────────────────────────────────────

const ModuleDetailPanel = memo(function ModuleDetailPanel({
  module: mod, progress, quizzes, onClose, onComplete, onStartQuiz,
}: {
  module: LearningModule; progress: UserProgress; quizzes: Quiz[];
  onClose: () => void; onComplete: (id: string) => void; onStartQuiz: (qId: string) => void;
}) {
  const isCompleted = progress.completedModules.includes(mod.id);
  const relatedQuiz = useMemo(() => quizzes.find(q => q.moduleId === mod.id), [quizzes, mod.id]);
  const quizCompleted = relatedQuiz ? progress.completedQuizzes.includes(relatedQuiz.id) : false;

  return (
    <div className="lc-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="lc-detail-panel">
        <div className="lc-detail-header">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
              <DifficultyBadge difficulty={mod.difficulty} />
              <span className="lc-badge lc-badge-violet">{mod.category}</span>
              <XPPill xp={mod.xpReward} />
              {isCompleted && <CompletedPill />}
            </div>
            <button className="lc-detail-close" onClick={onClose}>✕</button>
          </div>
          <h2 style={{ fontSize:"20px", fontWeight:800, color:"var(--fg-default)", letterSpacing:"-0.02em", marginBottom:"6px" }}>{mod.title}</h2>
          <p style={{ fontSize:"13px", color:"var(--fg-muted)" }}>{mod.description}</p>
          <div style={{ display:"flex", gap:"12px", marginTop:"10px", fontSize:"11px", color:"var(--fg-muted)" }}>
            <span>🕐 {mod.durationMin} min</span>
            <span>👤 {mod.author}</span>
            <span>🔄 {mod.updatedAt}</span>
            <StarRating rating={mod.rating} />
          </div>
        </div>
        <div className="lc-detail-body">
          {mod.videoUrl && (
            <div style={{ marginBottom:"20px", padding:"12px 14px", background:"var(--bg-subtle)", borderRadius:"8px", display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ fontSize:"18px" }}>🎬</span>
              <div>
                <div style={{ fontSize:"12px", fontWeight:600, color:"var(--fg-default)" }}>Video Available</div>
                <a href={mod.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize:"11px", color:"var(--accent-blue)" }}>Watch training video →</a>
              </div>
            </div>
          )}
          <div className="lc-detail-content"
            dangerouslySetInnerHTML={{ __html: mod.content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }}
          />
          {mod.steps && (
            <div style={{ marginTop:"20px" }}>
              <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)", marginBottom:"10px" }}>Step-by-Step Instructions</div>
              <div className="lc-wi-steps">
                {mod.steps.map((step, i) => (
                  <div key={i} className="lc-wi-step">
                    <div className="lc-wi-step-num">{i+1}</div><span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mod.metrics && mod.metrics.length > 0 && (
            <div style={{ marginTop:"20px" }}>
              <div style={{ fontSize:"11px", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:"6px" }}>Related Metrics</div>
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                {mod.metrics.map(m => <span key={m} className="lc-badge lc-badge-cyan">{m}</span>)}
              </div>
            </div>
          )}
          <button className="lc-complete-btn" disabled={isCompleted} onClick={() => onComplete(mod.id)}>
            {isCompleted ? "✓ Module Completed" : "Mark as Complete (+XP)"}
          </button>
          {relatedQuiz && !quizCompleted && (
            <button className="lc-complete-btn"
              style={{ marginTop:"10px", background:"linear-gradient(135deg,var(--accent-cyan),var(--accent-blue))" }}
              onClick={() => onStartQuiz(relatedQuiz.id)}
            >
              📝 Take Quiz — {relatedQuiz.title}
            </button>
          )}
          {relatedQuiz && quizCompleted && (
            <div style={{ marginTop:"10px", padding:"10px 14px", borderRadius:"8px", background:"color-mix(in srgb,var(--accent-emerald) 8%,transparent)", border:"1px solid color-mix(in srgb,var(--accent-emerald) 20%,transparent)", fontSize:"12px", color:"var(--accent-emerald)", fontWeight:600, textAlign:"center" }}>
              ✓ Quiz passed — Score: {progress.quizScores[relatedQuiz.id]}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Tab: Home ────────────────────────────────────────────────────────────────

const HomeTab = memo(function HomeTab({
  progress, modules, quizzes, sops, workInstructions, defects,
  lessons, recommendations, onTabChange, onSelectModule,
}: {
  progress: UserProgress; modules: LearningModule[]; quizzes: Quiz[];
  sops: SOPDocument[]; workInstructions: WorkInstruction[];
  defects: DefectExample[]; lessons: LessonLearned[];
  recommendations: string[]; onTabChange: (tab: LCTab) => void;
  onSelectModule: (mod: LearningModule) => void;
}) {
  const pinned = useMemo(() => {
    const recMods = recommendations.map(id => modules.find(m => m.id === id)).filter(Boolean) as LearningModule[];
    const remaining = modules.filter(m =>
      !progress.completedModules.includes(m.id) && !recMods.find(r => r.id === m.id)
    );
    return [...recMods, ...remaining].slice(0, 3);
  }, [modules, progress.completedModules, recommendations]);

  const levelPct = useMemo(() => {
    const cur = LEVEL_THRESHOLDS[progress.level] ?? 0;
    const next = LEVEL_THRESHOLDS[progress.level + 1] ?? cur + 1000;
    return Math.round(((progress.xp - cur) / (next - cur)) * 100);
  }, [progress]);

  const hasRecommendations = recommendations.length > 0;

  return (
    <>
      {progress.streak > 1 && (
        <div className="lc-streak-banner">🔥 {progress.streak}-day learning streak! Keep it up!</div>
      )}
      {hasRecommendations && (
        <div className="lc-recommendation-banner">
          <span style={{ fontSize:18 }}>⚡</span>
          <span>
            <strong>Personalized recommendations ready —</strong>{" "}
            Based on your recent audit findings, {recommendations.length} training module{recommendations.length > 1 ? "s have" : " has"} been highlighted for you below.
          </span>
        </div>
      )}
      <div className="lc-pinned">
        <div>
          <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)" }}>📌 Pinned For You</div>
          <div style={{ fontSize:"11px", color:"var(--fg-muted)", marginTop:"2px" }}>
            {hasRecommendations ? "Based on your audit findings" : "Your assigned and recommended training"}
          </div>
        </div>
        <div className="lc-pinned-items">
          {pinned.map(mod => (
            <div key={mod.id} className="lc-pinned-item" onClick={() => onSelectModule(mod)}>
              <div className="lc-pinned-icon" style={{ background:"color-mix(in srgb,var(--accent-violet) 12%,transparent)", color:"var(--accent-violet)" }}>
                {recommendations.includes(mod.id) ? "⚡" : "📚"}
              </div>
              <div>
                <div className="lc-pinned-item-title">{mod.title}</div>
                <div className="lc-pinned-item-sub">{mod.durationMin} min · {mod.difficulty}</div>
              </div>
            </div>
          ))}
          <div className="lc-pinned-item" onClick={() => onTabChange("quizzes")}>
            <div className="lc-pinned-icon" style={{ background:"color-mix(in srgb,var(--accent-cyan) 12%,transparent)", color:"var(--accent-cyan)" }}>📝</div>
            <div>
              <div className="lc-pinned-item-title">Pending Quizzes</div>
              <div className="lc-pinned-item-sub">{quizzes.filter(q => !progress.completedQuizzes.includes(q.id)).length} remaining</div>
            </div>
          </div>
        </div>
      </div>
      {progress.badges.length > 0 && (
        <div style={{ marginBottom:"24px" }}>
          <div className="lc-section-header">
            <div>
              <div className="lc-section-title">🏆 Your Achievements</div>
              <div className="lc-section-sub">Level {progress.level} · {LEVEL_NAMES[progress.level]}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:"11px", color:"var(--fg-muted)", marginBottom:"2px" }}>Level progress {levelPct}%</div>
              <div style={{ width:"100px", height:"4px", borderRadius:"999px", background:"var(--border)", overflow:"hidden" }}>
                <div style={{ width:`${levelPct}%`, height:"100%", background:"var(--accent-violet)", borderRadius:"999px", transition:"width 600ms ease" }} />
              </div>
            </div>
          </div>
          <div className="lc-badges-row">
            {progress.badges.map(b => <div key={b} className="lc-achievement-badge">🏅 {b}</div>)}
          </div>
        </div>
      )}
      <div style={{ marginBottom:"24px" }}>
        <div className="lc-section-header"><div className="lc-section-title">Quick Access</div></div>
        <div className="lc-grid-sm">
          {([
            { tab:"sop" as LCTab, icon:"📄", label:"SOPs", sub:`${sops.length} documents` },
            { tab:"work-instructions" as LCTab, icon:"📋", label:"Work Instructions", sub:`${workInstructions.length} guides` },
            { tab:"defects" as LCTab, icon:"⚠️", label:"Defect Examples", sub:`${defects.length} examples` },
            { tab:"lessons" as LCTab, icon:"💡", label:"Lessons Learned", sub:`${lessons.length} insights` },
            { tab:"standards" as LCTab, icon:"⭐", label:"Quality Standards", sub:"Scoring guide" },
            { tab:"best-practices" as LCTab, icon:"🌟", label:"Best Practices", sub:"Top examples" },
          ]).map(({ tab, icon, label, sub }) => (
            <div key={tab} className="lc-card" style={{ padding:"16px" }} onClick={() => onTabChange(tab)}>
              <div style={{ fontSize:"22px", marginBottom:"8px" }}>{icon}</div>
              <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)", marginBottom:"2px" }}>{label}</div>
              <div style={{ fontSize:"11px", color:"var(--fg-muted)" }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
});

// ─── Tab: Modules ─────────────────────────────────────────────────────────────

const ModulesTab = memo(function ModulesTab({
  progress, modules, recommendations, onSelectModule,
}: {
  progress: UserProgress; modules: LearningModule[];
  recommendations: string[]; onSelectModule: (mod: LearningModule) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterDiff, setFilterDiff] = useState("all");

  const filtered = useMemo(() => modules.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.title.toLowerCase().includes(q) || m.tags.some(t => t.includes(q));
    const matchDiff = filterDiff === "all" || m.difficulty === filterDiff;
    return matchSearch && matchDiff;
  }), [modules, search, filterDiff]);

  return (
    <>
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">Training Modules</div>
          <div className="lc-section-sub">
            {progress.completedModules.filter(id => modules.some(m => m.id === id)).length}/{modules.length} completed
          </div>
        </div>
      </div>
      <div className="lc-search-bar">
        <SearchSVG />
        <input className="lc-search-input" placeholder="Search modules…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div style={{ display:"flex", gap:"6px", marginBottom:"16px", flexWrap:"wrap" }}>
        {["all","beginner","intermediate","advanced"].map(d => (
          <button key={d} className={`lc-tab-btn${filterDiff === d ? " active" : ""}`} onClick={() => setFilterDiff(d)}>
            {d === "all" ? "All levels" : d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
      <div className="lc-grid">
        {filtered.map(mod => {
          const isCompleted = progress.completedModules.includes(mod.id);
          const isRecommended = recommendations.includes(mod.id);
          return (
            <div key={mod.id} className="lc-card"
              style={isRecommended ? { borderColor:"color-mix(in srgb,var(--accent-amber) 35%,transparent)" } : {}}
              onClick={() => onSelectModule(mod)}
            >
              <div className="lc-card-header">
                <div className="lc-card-title">{mod.title}</div>
                <div style={{ display:"flex", gap:"4px" }}>
                  {isRecommended && <span className="lc-badge lc-badge-amber">⚡ Rec.</span>}
                  {isCompleted && <CompletedPill />}
                </div>
              </div>
              <div className="lc-card-desc">{mod.description}</div>
              <div className="lc-card-meta">
                <DifficultyBadge difficulty={mod.difficulty} />
                <span className="lc-badge lc-badge-muted">{mod.durationMin} min</span>
                <XPPill xp={mod.xpReward} />
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:"10px" }}>
                <StarRating rating={mod.rating} />
                <span style={{ fontSize:"11px", color:"var(--fg-muted)" }}>{mod.completions} completions</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
});

// ─── Tab: SOPs ────────────────────────────────────────────────────────────────

const SOPTab = memo(function SOPTab({ sops }: { sops: SOPDocument[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">SOP Library</div><div className="lc-section-sub">Version-controlled standard operating procedures</div></div></div>
      {!sops.length && <div style={{ padding:"32px", textAlign:"center", color:"var(--fg-muted)", fontSize:"13px" }}>No SOPs found.</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
        {sops.map(sop => (
          <div key={sop.id} className="lc-sop-card">
            <div className="lc-sop-header">
              <div style={{ fontSize:"22px" }}>📄</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"14px", fontWeight:700, color:"var(--fg-default)" }}>{sop.title}</div>
                <div className="lc-sop-version">
                  <span className="lc-badge lc-badge-cyan">v{sop.version}</span>
                  <span className="lc-badge lc-badge-muted">{sop.category}</span>
                  <span>Updated {sop.updatedAt}</span>
                  <span>by {sop.author}</span>
                </div>
              </div>
              <button className="lc-detail-close" onClick={() => setExpanded(expanded === sop.id ? null : sop.id)}>
                {expanded === sop.id ? "▲" : "▼"}
              </button>
            </div>
            {expanded === sop.id && (
              <div className="lc-sop-body">
                <div className="lc-detail-content" dangerouslySetInnerHTML={{ __html: sop.content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />
                {sop.changeLog.length > 0 && (
                  <div className="lc-sop-changelog">
                    <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:"6px" }}>Version History</div>
                    {sop.changeLog.map(entry => (
                      <div key={entry.version} className="lc-sop-changelog-item">
                        <span className="lc-sop-changelog-version">v{entry.version}</span>
                        <span style={{ flexShrink:0 }}>{entry.date}</span>
                        <span>{entry.summary}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
});

// ─── Tab: Work Instructions ───────────────────────────────────────────────────

const WorkInstructionsTab = memo(function WorkInstructionsTab({ workInstructions }: { workInstructions: WorkInstruction[] }) {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Work Instructions</div><div className="lc-section-sub">Short, actionable step-by-step guides</div></div></div>
      {!workInstructions.length && <div style={{ padding:"32px", textAlign:"center", color:"var(--fg-muted)", fontSize:"13px" }}>No work instructions found.</div>}
      <div className="lc-grid">
        {workInstructions.map(wi => (
          <div key={wi.id} className="lc-wi-card">
            <div style={{ fontSize:"14px", fontWeight:700, color:"var(--fg-default)", marginBottom:"6px" }}>{wi.title}</div>
            <div style={{ display:"flex", gap:"6px", marginBottom:"6px", flexWrap:"wrap" }}>
              <span className="lc-badge lc-badge-blue">{wi.metric}</span>
              <span className="lc-badge lc-badge-muted">{wi.category}</span>
            </div>
            <div style={{ fontSize:"11px", color:"var(--fg-muted)", marginBottom:"4px" }}>Updated {wi.updatedAt}</div>
            <div className="lc-wi-steps">
              {wi.steps.map((step, i) => (
                <div key={i} className="lc-wi-step"><div className="lc-wi-step-num">{i+1}</div><span>{step}</span></div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
});

// ─── Tab: Defects ─────────────────────────────────────────────────────────────

const DefectsTab = memo(function DefectsTab({ defects }: { defects: DefectExample[] }) {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Defect Examples Library</div><div className="lc-section-sub">Real audit-based examples showing what went wrong and the correct behavior</div></div></div>
      {!defects.length && <div style={{ padding:"32px", textAlign:"center", color:"var(--fg-muted)", fontSize:"13px" }}>No defect examples found.</div>}
      <div className="lc-grid">
        {defects.map(defect => (
          <div key={defect.id} className="lc-defect-card">
            <div className="lc-defect-top">
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)", marginBottom:"4px" }}>{defect.title}</div>
                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                  <span className="lc-badge lc-badge-blue">{defect.metric}</span>
                  <SeverityBadge severity={defect.severity} />
                </div>
              </div>
            </div>
            <div className="lc-defect-body">
              <div><div className="lc-defect-label lc-defect-bad">❌ What Went Wrong</div><div className="lc-defect-text">{defect.whatWentWrong}</div></div>
              <div><div className="lc-defect-label lc-defect-good">✅ Correct Behavior</div><div className="lc-defect-text">{defect.correctBehavior}</div></div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
});

// ─── Tab: Standards ───────────────────────────────────────────────────────────

const QUALITY_STANDARDS_DATA = [
  { name:"Excellent", min:95, color:"var(--accent-emerald)", desc:"Exceeds all expectations. Exemplary service, complete documentation, proactive solutions." },
  { name:"Good", min:85, color:"var(--accent-blue)", desc:"Meets all standards. Minor areas for improvement but overall strong performance." },
  { name:"Needs Improvement", min:70, color:"var(--accent-amber)", desc:"Meets minimum requirements but has notable gaps. Coaching recommended." },
  { name:"Unsatisfactory", min:0, color:"var(--accent-rose)", desc:"Does not meet minimum standards. Immediate retraining required." },
];

const StandardsTab = memo(function StandardsTab() {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Quality Standards</div><div className="lc-section-sub">Scoring expectations and metric definitions</div></div></div>
      <div className="lc-grid" style={{ marginBottom:"28px" }}>
        {QUALITY_STANDARDS_DATA.map(s => (
          <div key={s.name} className="lc-standard-card">
            <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:s.color }}>{s.name}</div>
            <div className="lc-standard-score" style={{ color:s.color }}>{s.min > 0 ? `${s.min}%+` : "<70%"}</div>
            <div className="lc-standard-bar"><div className="lc-standard-bar-fill" style={{ width:`${s.min > 0 ? s.min : 45}%`, background:s.color }} /></div>
            <div style={{ fontSize:"12px", color:"var(--fg-muted)", lineHeight:1.6, marginTop:"8px" }}>{s.desc}</div>
          </div>
        ))}
      </div>
      <div className="lc-section-header"><div className="lc-section-title">Metric Definitions</div></div>
      <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
        {[
          { name:"Return Label (RL)", desc:"Whether the correct return label was provided accurately, timely, and via preferred channel.", weight:"15%" },
          { name:"Ticket Documentation", desc:"Completeness, clarity, timeliness, and accuracy of all ticket notes.", weight:"20%" },
          { name:"First Contact Resolution", desc:"Whether the customer's issue was fully resolved without a follow-up contact.", weight:"25%" },
          { name:"Professionalism", desc:"Tone, language, empathy, and adherence to communication standards.", weight:"20%" },
          { name:"Product Knowledge", desc:"Accuracy of product information, part numbers, and technical guidance.", weight:"20%" },
        ].map(metric => (
          <div key={metric.name} style={{ padding:"14px 18px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"10px", display:"flex", alignItems:"flex-start", gap:"14px" }}>
            <div style={{ flexShrink:0, minWidth:"50px", textAlign:"center" }}>
              <div style={{ fontSize:"16px", fontWeight:800, color:"var(--accent-blue)" }}>{metric.weight}</div>
              <div style={{ fontSize:"9px", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--fg-muted)" }}>Weight</div>
            </div>
            <div>
              <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)", marginBottom:"4px" }}>{metric.name}</div>
              <div style={{ fontSize:"12px", color:"var(--fg-muted)", lineHeight:1.6 }}>{metric.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
});

// ─── Tab: Onboarding ──────────────────────────────────────────────────────────

const OnboardingTab = memo(function OnboardingTab({
  progress, modules, onboardingTracks, onSelectModule,
}: {
  progress: UserProgress; modules: LearningModule[];
  onboardingTracks: OnboardingTrack[]; onSelectModule: (mod: LearningModule) => void;
}) {
  const badgeClassMap: Record<string, string> = {
    Agent: "lc-badge-blue", Supervisor: "lc-badge-violet",
    Admin: "lc-badge-rose", QA: "lc-badge-amber",
  };

  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Onboarding Materials</div><div className="lc-section-sub">Role-based onboarding tracks</div></div></div>
      {!onboardingTracks.length && (
        <div style={{ padding:"32px", textAlign:"center", color:"var(--fg-muted)", fontSize:"13px" }}>
          No onboarding tracks configured for your role yet.
        </div>
      )}
      {onboardingTracks.map(track => (
        <div key={track.id} className="lc-onboarding-track">
          <div className="lc-onboarding-header">
            <div>
              <div style={{ fontSize:"14px", fontWeight:700, color:"var(--fg-default)" }}>{track.label}</div>
              <div style={{ fontSize:"11px", color:"var(--fg-muted)", marginTop:"2px" }}>{track.subtitle}</div>
            </div>
            <span className={`lc-badge ${badgeClassMap[track.badgeLabel] ?? "lc-badge-muted"}`}>{track.badgeLabel}</span>
          </div>
          <ul className="lc-onboarding-steps">
            {track.steps.map((step, i) => {
              const mod = step.moduleId ? modules.find(m => m.id === step.moduleId) : null;
              const done = mod ? progress.completedModules.includes(mod.id) : false;
              return (
                <li key={step.id} className={`lc-onboarding-step${done ? " completed" : ""}`} onClick={() => mod && onSelectModule(mod)}>
                  <div className={`lc-step-check${done ? " done" : ""}`}>{done ? "✓" : i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"13px", fontWeight:600, color:"var(--fg-default)" }}>{step.title}</div>
                    <div style={{ fontSize:"11px", color:"var(--fg-muted)" }}>{step.description}</div>
                  </div>
                  {mod && <span style={{ fontSize:"11px", color:"var(--accent-blue)" }}>Open →</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
});

// ─── Tab: Lessons Learned ─────────────────────────────────────────────────────

const LessonsTab = memo(function LessonsTab({
  lessons, userUpvotes, onToggleUpvote,
}: {
  lessons: LessonLearned[]; userUpvotes: Set<string>;
  onToggleUpvote: (id: string) => void;
}) {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Lessons Learned</div><div className="lc-section-sub">Insights captured from audits and performance reviews</div></div></div>
      {!lessons.length && <div style={{ padding:"32px", textAlign:"center", color:"var(--fg-muted)", fontSize:"13px" }}>No lessons learned yet.</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
        {lessons.map(lesson => {
          const isUpvoted = userUpvotes.has(lesson.id);
          return (
            <div key={lesson.id} className="lc-lesson-card">
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"10px" }}>
                <div style={{ fontSize:"14px", fontWeight:700, color:"var(--fg-default)" }}>{lesson.title}</div>
                <span className="lc-badge lc-badge-cyan">{lesson.topic}</span>
              </div>
              <div className="lc-lesson-insight">{lesson.insight}</div>
              <div className="lc-lesson-meta">
                <span style={{ fontSize:"11px", color:"var(--fg-muted)" }}>Source: {lesson.source} · {lesson.dateAdded}</span>
                <button
                  className="lc-upvote-btn"
                  style={isUpvoted ? { color:"var(--accent-violet)", borderColor:"color-mix(in srgb,var(--accent-violet) 30%,transparent)", background:"color-mix(in srgb,var(--accent-violet) 8%,transparent)" } : {}}
                  onClick={() => onToggleUpvote(lesson.id)}
                >
                  👍 {lesson.upvotes}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
});

// ─── Tab: Audit Findings ──────────────────────────────────────────────────────

const AuditFindingsTab = memo(function AuditFindingsTab({
  auditLinks, modules, onSelectModule,
}: {
  auditLinks: AuditLink[]; modules: LearningModule[];
  onSelectModule: (mod: LearningModule) => void;
}) {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Audit Findings → Training</div><div className="lc-section-sub">Failed metrics linked to relevant training modules</div></div></div>
      {!auditLinks.length && (
        <div style={{ padding:"32px", textAlign:"center", color:"var(--fg-muted)", fontSize:"13px" }}>
          No audit metric mappings configured yet.
        </div>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
        {auditLinks.map(link => {
          const mod = modules.find(m => m.id === link.moduleId);
          return (
            <div key={link.metric} style={{ padding:"16px 20px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"12px", display:"flex", alignItems:"center", gap:"16px", flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:"160px" }}>
                <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)", marginBottom:"4px" }}>{link.metric}</div>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <div style={{ height:"4px", width:"120px", borderRadius:"999px", background:"var(--border)", overflow:"hidden" }}>
                    <div style={{ width:`${Math.min(link.failRate, 100)}%`, height:"100%", background:link.failRate > 25 ? "var(--accent-rose)" : "var(--accent-amber)", borderRadius:"999px" }} />
                  </div>
                  <span style={{ fontSize:"12px", color:link.failRate > 25 ? "var(--accent-rose)" : "var(--accent-amber)", fontWeight:700 }}>
                    {link.failRate > 0 ? `${link.failRate}% fail rate` : "No data yet"}
                  </span>
                </div>
              </div>
              {mod && (
                <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                  <div style={{ fontSize:"11px", color:"var(--fg-muted)" }}>→ Recommended:</div>
                  <button className="lc-assign-btn" onClick={() => onSelectModule(mod)}>📚 {mod.title}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
});

// ─── Tab: Best Practices ──────────────────────────────────────────────────────

const BestPracticesTab = memo(function BestPracticesTab({ bestPractices }: { bestPractices: BestPractice[] }) {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Best Practices</div><div className="lc-section-sub">Curated examples from top-performing agents and supervisors</div></div></div>
      {!bestPractices.length && <div style={{ padding:"32px", textAlign:"center", color:"var(--fg-muted)", fontSize:"13px" }}>No best practices added yet.</div>}
      <div className="lc-grid">
        {bestPractices.map(bp => (
          <div key={bp.id} className="lc-bp-card">
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"8px", marginBottom:"4px" }}>
              <div style={{ fontSize:"14px", fontWeight:700, color:"var(--fg-default)" }}>{bp.title}</div>
              <span className="lc-badge lc-badge-emerald">{bp.category}</span>
            </div>
            <div className="lc-bp-quote">"{bp.quote}"</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"6px" }}>
              <span style={{ fontSize:"11px", color:"var(--fg-muted)" }}>— {bp.agentLabel}</span>
              <span className="lc-badge lc-badge-blue">{bp.metric}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
});

// ─── Tab: Analytics ───────────────────────────────────────────────────────────

const AnalyticsTab = memo(function AnalyticsTab({
  progress, modules,
}: { progress: UserProgress; modules: LearningModule[] }) {
  const completionRate = modules.length
    ? Math.round((progress.completedModules.filter(id => modules.some(m => m.id === id)).length / modules.length) * 100)
    : 0;

  const avgQuizScore = useMemo(() => {
    const scores = Object.values(progress.quizScores) as number[];
    if (!scores.length) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [progress]);

  const weekDays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const mockActivity = [3,5,2,7,4,1,6];

  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Learning Analytics</div><div className="lc-section-sub">Your personal performance metrics</div></div></div>
      <div className="lc-analytics-grid">
        <div className="lc-stat-card"><div className="lc-stat-val" style={{ color:"var(--accent-blue)" }}>{completionRate}%</div><div className="lc-stat-label">Completion Rate</div></div>
        <div className="lc-stat-card"><div className="lc-stat-val" style={{ color:"var(--accent-emerald)" }}>{avgQuizScore || "—"}%</div><div className="lc-stat-label">Avg Quiz Score</div></div>
        <div className="lc-stat-card"><div className="lc-stat-val" style={{ color:"var(--accent-violet)" }}>{progress.xp}</div><div className="lc-stat-label">Total XP</div></div>
        <div className="lc-stat-card"><div className="lc-stat-val" style={{ color:"var(--accent-amber)" }}>{progress.streak}</div><div className="lc-stat-label">Day Streak</div></div>
      </div>
      <div style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"12px", padding:"20px", marginBottom:"20px" }}>
        <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)", marginBottom:"16px" }}>Weekly Activity</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:"8px", height:"60px" }}>
          {weekDays.map((day, i) => {
            const h = (mockActivity[i] / 7) * 100;
            return (
              <div key={day} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                <div style={{ width:"100%", height:`${h}%`, background:"var(--accent-violet)", borderRadius:"4px 4px 0 0", minHeight:"4px", opacity:0.75 }} />
                <div style={{ fontSize:"10px", color:"var(--fg-muted)" }}>{day}</div>
              </div>
            );
          })}
        </div>
      </div>
      {modules.length > 0 && (
        <div style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"12px", padding:"20px" }}>
          <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)", marginBottom:"14px" }}>Module Engagement</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
            {[...modules].sort((a,b) => b.completions - a.completions).slice(0,4).map(mod => (
              <div key={mod.id} style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <div style={{ fontSize:"12px", fontWeight:600, color:"var(--fg-default)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{mod.title}</div>
                <div style={{ width:"120px", height:"6px", borderRadius:"999px", background:"var(--border)", overflow:"hidden", flexShrink:0 }}>
                  <div style={{ width:`${Math.min((mod.completions / Math.max(...modules.map(m => m.completions), 1)) * 100, 100)}%`, height:"100%", background:"var(--accent-blue)", borderRadius:"999px" }} />
                </div>
                <div style={{ fontSize:"11px", color:"var(--fg-muted)", flexShrink:0, minWidth:"40px", textAlign:"right" }}>{mod.completions}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
});

// ─── Tab: Coaching ────────────────────────────────────────────────────────────

const CoachingTab = memo(function CoachingTab({
  teamData, modules, coachingNotes, assignedMap, onSelectModule, onSaveNote, onAssign,
}: {
  teamData: TeamMember[]; modules: LearningModule[];
  coachingNotes: CoachingNote[]; assignedMap: Record<string, string[]>;
  onSelectModule: (mod: LearningModule) => void;
  onSaveNote: (agentId: string, note: string, metric?: string) => void;
  onAssign: (agentId: string, moduleId: string) => void;
}) {
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const noteMap: Record<string, string> = {};
    coachingNotes.forEach(n => { if (!noteMap[n.agentId]) noteMap[n.agentId] = n.note; });
    setLocalNotes(noteMap);
  }, [coachingNotes]);

  const handleSave = useCallback(async (agentId: string, metric?: string) => {
    const note = localNotes[agentId]?.trim();
    if (!note) return;
    setSaving(prev => ({ ...prev, [agentId]: true }));
    await onSaveNote(agentId, note, metric);
    setSaving(prev => ({ ...prev, [agentId]: false }));
  }, [localNotes, onSaveNote]);

  return (
    <>
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">Supervisor Coaching Mode</div>
          <div className="lc-section-sub">Assign modules, log coaching notes, and track your team's progress</div>
        </div>
        <span className="lc-badge lc-badge-violet">{teamData.length} agents</span>
      </div>
      {!teamData.length && (
        <div style={{ padding:"32px", textAlign:"center", color:"var(--fg-muted)", fontSize:"13px" }}>
          No team members found. Ensure agents have you set as their supervisor.
        </div>
      )}
      <div>
        {teamData.map(agent => {
          const scoreColor = agent.score >= 85 ? "var(--accent-emerald)" : agent.score >= 70 ? "var(--accent-amber)" : "var(--accent-rose)";
          const recommended = modules.filter(m => agent.failedMetrics.some(fm => m.metrics?.includes(fm)));
          const isSaving = saving[agent.id];

          return (
            <div key={agent.id} style={{ marginBottom:"16px" }}>
              <div className="lc-coaching-agent">
                <div className="lc-coaching-agent-info">
                  <div className="lc-coaching-avatar">{agent.initials}</div>
                  <div>
                    <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)" }}>{agent.name}</div>
                    <div style={{ fontSize:"11px", color:scoreColor, fontWeight:600 }}>Score: {agent.score}%</div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                  {agent.failedMetrics.map(m => <span key={m} className="lc-badge lc-badge-rose">{m}</span>)}
                  {(assignedMap[agent.id]?.length ?? 0) > 0 && (
                    <span className="lc-badge lc-badge-blue">{assignedMap[agent.id].length} assigned</span>
                  )}
                </div>
              </div>
              <div style={{ padding:"12px 18px", background:"var(--bg-subtle)", borderRadius:"0 0 10px 10px", border:"1px solid var(--border)", borderTop:"none" }}>
                {recommended.length > 0 && (
                  <>
                    <div style={{ fontSize:"11px", fontWeight:600, color:"var(--fg-muted)", marginBottom:"8px", letterSpacing:"0.05em", textTransform:"uppercase" }}>Recommended Training</div>
                    <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"10px" }}>
                      {recommended.map(mod => {
                        const isAssigned = assignedMap[agent.id]?.includes(mod.id);
                        return (
                          <div key={mod.id} style={{ display:"flex", gap:"6px" }}>
                            <button className="lc-assign-btn" onClick={() => onSelectModule(mod)}>📚 {mod.title}</button>
                            <button
                              className="lc-assign-btn"
                              style={isAssigned ? { background:"color-mix(in srgb,var(--accent-emerald) 14%,transparent)", color:"var(--accent-emerald)", borderColor:"color-mix(in srgb,var(--accent-emerald) 25%,transparent)" } : {}}
                              onClick={() => !isAssigned && onAssign(agent.id, mod.id)}
                            >
                              {isAssigned ? "✓ Assigned" : "Assign"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                <div style={{ display:"flex", gap:"8px", alignItems:"flex-start" }}>
                  <textarea
                    placeholder="Add coaching note… (saved to agent's record)"
                    value={localNotes[agent.id] || ""}
                    onChange={e => setLocalNotes(prev => ({ ...prev, [agent.id]: e.target.value }))}
                    style={{ flex:1, minHeight:"52px", padding:"8px 10px", borderRadius:"7px", border:"1px solid var(--border-strong)", background:"var(--bg-elevated)", color:"var(--fg-default)", fontSize:"12px", fontFamily:"inherit", resize:"vertical", outline:"none" }}
                  />
                  <button
                    className="lc-assign-btn"
                    style={{ height:"auto", padding:"8px 14px", alignSelf:"flex-end" }}
                    disabled={isSaving || !localNotes[agent.id]?.trim()}
                    onClick={() => handleSave(agent.id, agent.failedMetrics[0])}
                  >
                    {isSaving ? "Saving…" : "Save Note"}
                  </button>
                </div>
                {coachingNotes.find(n => n.agentId === agent.id) && (
                  <div style={{ marginTop:"8px", fontSize:"11px", color:"var(--fg-muted)" }}>
                    Last saved: {coachingNotes.find(n => n.agentId === agent.id)?.sessionDate}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
});

// ─── Loading skeleton ─────────────────────────────────────────────────────────

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="lc-root">
      <div style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:16, padding:"28px 32px", marginBottom:24 }}>
        <div className="lc-skeleton" style={{ height:12, width:"12%", marginBottom:10 }} />
        <div className="lc-skeleton" style={{ height:22, width:"40%", marginBottom:8 }} />
        <div className="lc-skeleton" style={{ height:12, width:"60%" }} />
      </div>
      <div className="lc-grid">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

interface LearningCenterProps {
  userRole?: string;
  currentUser?: UserProfile | null;
}

export default function LearningCenter({ userRole, currentUser = null }: LearningCenterProps) {
  const resolvedRole = userRole ?? currentUser?.role ?? "agent";
  const userId = currentUser?.id;

  useEffect(() => { injectLCStyles(); }, []);

  const [activeTab, setActiveTab] = useState<LCTab>("home");
  const [selectedModule, setSelectedModule] = useState<LearningModule | null>(null);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [showCerts, setShowCerts] = useState(false);
  const [search, setSearch] = useState("");
  const [assignedMap, setAssignedMap] = useState<Record<string, string[]>>({});

  const {
    modules, sops, workInstructions, defects, quizzes, lessons, bestPractices,
    progress, teamData, coachingNotes, recommendations, auditLinks,
    onboardingTracks, userUpvotes, loading, error,
    completeModule, completeQuiz, saveCoachingNote, assignModule, toggleUpvote,
    handleCertificationEarned,
  } = useSupabaseLearning(userId, resolvedRole);

  const isAdmin      = resolvedRole === "admin" || resolvedRole === "qa";
  const isSupervisor = resolvedRole === "supervisor";
  const isAgent      = resolvedRole === "agent";

  const roleLabel = isAgent ? "Agent Learning" : isSupervisor ? "Supervisor Team Learning" : "Learning Center";
  const heroSubtitle = isAgent
    ? "Your personal training hub — assigned modules, SOPs, quizzes, certifications, and refreshers."
    : isSupervisor
    ? "Team-focused training hub — coaching, team findings, assigned modules, and supervisor resources."
    : "Centralized QA training hub — modules, SOPs, quizzes, certifications, analytics, and coaching.";

  const roleModules = useMemo(
    () => modules.filter(m => {
      if (isAgent) return m.roles.includes("agent");
      if (isSupervisor) return m.roles.includes("supervisor") || m.roles.includes("agent");
      return true;
    }),
    [modules, isAgent, isSupervisor]
  );

  const roleQuizzes = useMemo(
    () => quizzes.filter(q => {
      const mod = q.moduleId ? modules.find(m => m.id === q.moduleId) : null;
      if (!mod) return true;
      if (isAgent) return mod.roles.includes("agent");
      if (isSupervisor) return mod.roles.includes("supervisor") || mod.roles.includes("agent");
      return true;
    }),
    [quizzes, modules, isAgent, isSupervisor]
  );

  const levelPct = useMemo(() => {
    const cur = LEVEL_THRESHOLDS[progress.level] ?? 0;
    const next = LEVEL_THRESHOLDS[progress.level + 1] ?? cur + 1000;
    return Math.round(((progress.xp - cur) / (next - cur)) * 100);
  }, [progress]);

  // ── Earned certifications extracted from progress ──────────────────────────
  // progress.certifications is the Supabase-persisted array; CertificationTracker
  // receives it so it can distinguish "already in DB" from "newly crossed threshold".
  const earnedCertifications = useMemo<Certification[]>(
    () => progress.certifications ?? [],
    [progress.certifications]
  );

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return {
      mods:    roleModules.filter(m => m.title.toLowerCase().includes(q) || m.tags.some(t => t.includes(q))),
      sops:    sops.filter(s => s.title.toLowerCase().includes(q)),
      wis:     workInstructions.filter(w => w.title.toLowerCase().includes(q)),
      lessons: lessons.filter(l => l.title.toLowerCase().includes(q) || l.insight.toLowerCase().includes(q)),
    };
  }, [roleModules, sops, workInstructions, lessons, search]);

  const handleCompleteModule = useCallback(async (moduleId: string) => {
    await completeModule(moduleId);
  }, [completeModule]);

  const handleQuizComplete = useCallback(async (quizId: string, score: number) => {
    await completeQuiz(quizId, score);
    setActiveQuizId(null);
    setSelectedModule(null);
  }, [completeQuiz]);

  const handleAssign = useCallback(async (agentId: string, moduleId: string) => {
    setAssignedMap(prev => ({
      ...prev,
      [agentId]: prev[agentId]?.includes(moduleId) ? prev[agentId] : [...(prev[agentId] ?? []), moduleId],
    }));
    await assignModule(agentId, moduleId);
  }, [assignModule]);

  const agentAllowed = useMemo<Set<LCTab>>(() => new Set([
    "home","modules","sop","work-instructions","defects",
    "standards","onboarding","quizzes","certifications",
    "lessons","audit-findings","best-practices",
  ]), []);

  const TABS: { id: LCTab; label: string; icon: string; minRole?: string[] }[] = [
    { id:"home",              label:"Home",              icon:"🏠" },
    { id:"modules",           label:"Training",          icon:"📚" },
    { id:"sop",               label:"SOPs",              icon:"📄" },
    { id:"work-instructions", label:"Work Instructions", icon:"📋" },
    { id:"defects",           label:"Defect Examples",   icon:"⚠️" },
    { id:"standards",         label:"Standards",         icon:"⭐" },
    { id:"onboarding",        label:"Onboarding",        icon:"🎯" },
    { id:"quizzes",           label:"Quizzes",           icon:"📝" },
    { id:"certifications",    label:"Certifications",    icon:"🏆" },
    { id:"lessons",           label:"Lessons Learned",   icon:"💡" },
    { id:"audit-findings",    label:"Audit Findings",    icon:"🔗" },
    { id:"best-practices",    label:"Best Practices",    icon:"🌟" },
    { id:"analytics",         label:"Analytics",         icon:"📊" },
    { id:"coaching",          label:"Coaching",          icon:"👔", minRole:["supervisor","admin","qa"] },
  ];

  const visibleTabs = TABS.filter(tab => {
    if (isAgent && !agentAllowed.has(tab.id)) return false;
    if (tab.minRole && !tab.minRole.includes(resolvedRole)) return false;
    return true;
  });

  // ── Render guard: quiz ──────────────────────────────────────────────────────
  if (activeQuizId) {
    const quiz = roleQuizzes.find(q => q.id === activeQuizId);
    if (quiz) return (
      <QuizEngine
        quiz={quiz}
        onComplete={score => handleQuizComplete(activeQuizId, score)}
        onBack={() => setActiveQuizId(null)}
      />
    );
  }

  // ── Render guard: certifications ─────────────────────────────────────────
  // Now passes earnedCertifications (DB-persisted) and onCertificationEarned
  // so the tracker can write newly crossed thresholds back to Supabase.
  if (showCerts) return (
    <CertificationTracker
      progress={progress}
      modules={roleModules}
      quizzes={roleQuizzes}
      earnedCertifications={earnedCertifications}
      onCertificationEarned={handleCertificationEarned}
      onBack={() => setShowCerts(false)}
    />
  );

  // ── Render guard: loading ───────────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />;

  // ── Render guard: error ─────────────────────────────────────────────────────
  if (error) return (
    <div style={{ padding:"48px 24px", textAlign:"center" }}>
      <div style={{ fontSize:"32px", marginBottom:"12px" }}>⚠️</div>
      <div style={{ fontSize:"16px", fontWeight:700, color:"var(--fg-default)", marginBottom:"6px" }}>Failed to load Learning Center</div>
      <div style={{ fontSize:"13px", color:"var(--fg-muted)", marginBottom:"20px" }}>{error}</div>
      <button className="lc-assign-btn" style={{ margin:"0 auto" }} onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  );

  return (
    <div className="lc-root">
      {/* Hero */}
      <div className="lc-hero">
        <div className="lc-hero-inner">
          <div>
            <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--accent-violet)", marginBottom:"6px" }}>{roleLabel}</div>
            <div className="lc-hero-title">Grow Your Skills 🚀</div>
            <div className="lc-hero-sub">{heroSubtitle}</div>
          </div>
          <div className="lc-hero-xp">
            <div className="lc-xp-card">
              <div className="lc-xp-val">{progress.xp}</div>
              <div className="lc-xp-label">Total XP</div>
            </div>
            <div className="lc-progress-ring-wrap">
              <ProgressRing pct={levelPct} />
              <div className="lc-progress-ring-label">
                <div className="lc-progress-ring-level">{progress.level}</div>
                <div className="lc-progress-ring-name">{LEVEL_NAMES[progress.level]}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Search */}
      <div className="lc-search-bar">
        <SearchSVG />
        <input
          className="lc-search-input"
          placeholder="Search modules, SOPs, lessons, defects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:"var(--fg-muted)", cursor:"pointer", fontSize:"14px" }}>✕</button>
        )}
      </div>

      {/* Search results */}
      {searchResults && (
        <div style={{ marginBottom:"24px" }}>
          {!searchResults.mods.length && !searchResults.sops.length && !searchResults.wis.length && !searchResults.lessons.length ? (
            <div style={{ padding:"24px", textAlign:"center", color:"var(--fg-muted)", fontSize:"13px" }}>No results for "{search}"</div>
          ) : (
            <>
              {searchResults.mods.length > 0 && (
                <>
                  <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:"8px" }}>Training Modules</div>
                  <div className="lc-grid" style={{ marginBottom:"16px" }}>
                    {searchResults.mods.map(m => (
                      <div key={m.id} className="lc-card" onClick={() => setSelectedModule(m)}>
                        <div className="lc-card-title">{m.title}</div>
                        <div className="lc-card-desc">{m.description}</div>
                        <DifficultyBadge difficulty={m.difficulty} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {searchResults.sops.length > 0 && (
                <>
                  <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:"8px", marginTop:"16px" }}>SOPs</div>
                  {searchResults.sops.map(s => (
                    <div key={s.id} style={{ padding:"12px 16px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"10px", marginBottom:"8px" }}>
                      <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)" }}>{s.title}</div>
                      <div style={{ fontSize:"11px", color:"var(--fg-muted)", marginTop:"2px" }}>v{s.version} · {s.category}</div>
                    </div>
                  ))}
                </>
              )}
              {searchResults.lessons.length > 0 && (
                <>
                  <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:"8px", marginTop:"16px" }}>Lessons Learned</div>
                  {searchResults.lessons.map(l => (
                    <div key={l.id} style={{ padding:"12px 16px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"10px", marginBottom:"8px" }}>
                      <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)" }}>{l.title}</div>
                      <div style={{ fontSize:"11px", color:"var(--fg-muted)", marginTop:"2px" }}>{l.topic}</div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab nav + content */}
      {!search && (
        <>
          <div className="lc-tab-nav">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                className={`lc-tab-btn${activeTab === tab.id ? " active" : ""}`}
                onClick={() => {
                  if (tab.id === "certifications") { setShowCerts(true); return; }
                  setActiveTab(tab.id);
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "home" && (
            <HomeTab
              progress={progress} modules={roleModules} quizzes={roleQuizzes}
              sops={sops} workInstructions={workInstructions} defects={defects}
              lessons={lessons} recommendations={recommendations}
              onTabChange={tab => { if (tab === "certifications") { setShowCerts(true); return; } setActiveTab(tab); }}
              onSelectModule={setSelectedModule}
            />
          )}
          {activeTab === "modules" && (
            <ModulesTab
              progress={progress} modules={roleModules}
              recommendations={recommendations} onSelectModule={setSelectedModule}
            />
          )}
          {activeTab === "sop" && <SOPTab sops={sops} />}
          {activeTab === "work-instructions" && <WorkInstructionsTab workInstructions={workInstructions} />}
          {activeTab === "defects" && <DefectsTab defects={defects} />}
          {activeTab === "standards" && <StandardsTab />}
          {activeTab === "onboarding" && (
            <OnboardingTab
              progress={progress} modules={roleModules}
              onboardingTracks={onboardingTracks} onSelectModule={setSelectedModule}
            />
          )}
          {activeTab === "quizzes" && (
            <div>
              <div className="lc-section-header"><div><div className="lc-section-title">Refresher Quizzes</div><div className="lc-section-sub">Test your knowledge and earn XP</div></div></div>
              {!roleQuizzes.length && <div style={{ padding:"32px", textAlign:"center", color:"var(--fg-muted)", fontSize:"13px" }}>No quizzes available yet.</div>}
              <div className="lc-grid">
                {roleQuizzes.map(quiz => {
                  const done = progress.completedQuizzes.includes(quiz.id);
                  const score = progress.quizScores[quiz.id];
                  return (
                    <div key={quiz.id} className="lc-card">
                      <div className="lc-card-header">
                        <div className="lc-card-title">{quiz.title}</div>
                        {done && <span className="lc-badge lc-badge-emerald">✓ {score}%</span>}
                      </div>
                      <div className="lc-card-desc">{quiz.questions.length} questions · Pass: {quiz.passingScore}%</div>
                      <div className="lc-card-meta"><XPPill xp={quiz.xpReward} /></div>
                      <button
                        className="lc-complete-btn"
                        style={{ marginTop:"14px", background:done ? "var(--bg-subtle)" : "linear-gradient(135deg,var(--accent-cyan),var(--accent-blue))", color:done ? "var(--fg-muted)" : "#fff" }}
                        onClick={() => setActiveQuizId(quiz.id)}
                      >
                        {done ? "Retake Quiz" : "Start Quiz →"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {activeTab === "lessons" && (
            <LessonsTab lessons={lessons} userUpvotes={userUpvotes} onToggleUpvote={toggleUpvote} />
          )}
          {activeTab === "audit-findings" && (
            <AuditFindingsTab auditLinks={auditLinks} modules={roleModules} onSelectModule={setSelectedModule} />
          )}
          {activeTab === "best-practices" && <BestPracticesTab bestPractices={bestPractices} />}
          {activeTab === "analytics" && <AnalyticsTab progress={progress} modules={roleModules} />}
          {activeTab === "coaching" && (isSupervisor || isAdmin) && (
            <CoachingTab
              teamData={teamData} modules={roleModules}
              coachingNotes={coachingNotes} assignedMap={assignedMap}
              onSelectModule={setSelectedModule}
              onSaveNote={saveCoachingNote}
              onAssign={handleAssign}
            />
          )}
        </>
      )}

      {/* Module detail slide-over */}
      {selectedModule && (
        <ModuleDetailPanel
          module={selectedModule}
          progress={progress}
          quizzes={roleQuizzes}
          onClose={() => setSelectedModule(null)}
          onComplete={handleCompleteModule}
          onStartQuiz={qId => { setSelectedModule(null); setActiveQuizId(qId); }}
        />
      )}
    </div>
  );
}
