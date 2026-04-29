import { useState, useCallback, useMemo, memo, useEffect, useRef } from "react";
import QuizEngine from "./QuizEngine";
import QuizManager from "./QuizManager";
import LearningContentManager from "./LearningContentManager";
import LearningContentHealth from "./LearningContentHealth";
import CertificationTracker from "./CertificationTracker";
import type { UserProfile } from "../context/AuthContext";
import {
  fetchLearningModules, fetchSOPs, fetchWorkInstructions, fetchDefectExamples,
  fetchQuizzes, fetchLessonsLearned, fetchBestPractices,
  fetchOrCreateUserProgress, upsertUserProgress, fetchUserUpvotes,
  toggleLessonUpvote, fetchTeamMembers, fetchCoachingNotes, upsertCoachingNote,
  createAssignment, fetchAgentAssignments, fetchRecommendedModuleIds,
  fetchAuditLinks, checkAndGrantCertifications, fetchOnboardingTracks,
  incrementModuleCompletions, upsertQuiz, deleteQuiz,
  fetchQualityStandards, upsertLearningModule, deleteLearningModule,
  upsertSOP, deleteSOP, upsertWorkInstruction, deleteWorkInstruction,
  upsertDefectExample, deleteDefectExample, upsertQualityStandard, deleteQualityStandard,
  upsertOnboardingTrack, deleteOnboardingTrack, upsertBestPractice, deleteBestPractice,
  deleteCoachingNote,
  fetchAllAssignments, fetchLearningContentAuditTrail, updateAssignment, deleteAssignment,
} from "./learningService";
import type {
  LearningModule, SOPDocument, WorkInstruction, DefectExample,
  Quiz, LessonLearned, BestPractice, TeamMember, CoachingNote,
  UserProgress, Certification, OnboardingTrack, AuditLink, QualityStandard, LearningRole,
  LearningAssignment, ContentAuditEntry, LearningAssignableType,
} from "./learningService";

export type { LearningModule, SOPDocument, WorkInstruction, DefectExample,
              Quiz, LessonLearned, BestPractice, TeamMember, CoachingNote,
              UserProgress, Certification, OnboardingTrack, AuditLink, QualityStandard };

export type LCTab =
  | "home" | "modules" | "sop" | "work-instructions" | "defects"
  | "standards" | "onboarding" | "quizzes" | "certifications"
  | "lessons" | "audit-findings" | "best-practices" | "analytics" | "coaching" | "health";

export interface QuizQuestion {
  id: string; question: string; options: string[];
  correctIndex: number; explanation: string;
}

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1500, 2500];
const LEVEL_NAMES = ["Rookie","Learner","Practitioner","Specialist","Expert","Master","Legend"];
const LEVEL_COLORS = ["var(--accent-muted)","var(--accent-blue)","var(--accent-cyan)","var(--accent-violet)","var(--accent-amber)","var(--accent-rose)","#f59e0b"];

const DEFAULT_PROGRESS: UserProgress = {
  completedModules: [], completedQuizzes: [], quizScores: {},
  xp: 0, level: 0, badges: [], streak: 0,
  lastActiveDate: new Date().toISOString().split("T")[0],
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const LC_CSS_ID = "da-learning-center-v3";
const LC_CSS = `
/* ── Base ──────────────────────────────────────── */
.lc-root{display:flex;flex-direction:column;gap:0;min-height:100%;font-family:inherit}
.lc-root *{box-sizing:border-box}

/* ── Animations ─────────────────────────────────── */
@keyframes lcFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes lcFadeIn{from{opacity:0}to{opacity:1}}
@keyframes lcSlideIn{from{transform:translateX(24px);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes lcSlideUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes lcScaleIn{from{transform:scale(0.97);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes lcPulse{0%,100%{opacity:1}50%{opacity:0.5}}
@keyframes lcRingFill{from{stroke-dasharray:0 1000}to{}}
@keyframes lcToastIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes lcToastOut{from{transform:translateX(0);opacity:1}to{transform:translateX(110%);opacity:0}}
@keyframes lcBounce{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}

/* ── Hero ────────────────────────────────────────── */
.lc-hero{position:relative;border-radius:18px;padding:0;margin-bottom:20px;overflow:hidden;border:1px solid var(--border)}
.lc-hero-bg{position:absolute;inset:0;background:linear-gradient(135deg,color-mix(in srgb,var(--accent-violet) 14%,var(--bg-elevated)) 0%,color-mix(in srgb,var(--accent-blue) 9%,var(--bg-elevated)) 55%,color-mix(in srgb,var(--accent-cyan) 6%,var(--bg-elevated)) 100%)}
.lc-hero-bg::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 70% 80% at 90% 50%,color-mix(in srgb,var(--accent-violet) 12%,transparent),transparent);pointer-events:none}
.lc-hero-bg::after{content:'';position:absolute;top:-40px;right:-40px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent-blue) 8%,transparent),transparent 70%);pointer-events:none}
.lc-hero-content{position:relative;padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap}
.lc-hero-eyebrow{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 10px;border-radius:999px;background:color-mix(in srgb,var(--accent-violet) 12%,transparent);border:1px solid color-mix(in srgb,var(--accent-violet) 20%,transparent);font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--accent-violet);margin-bottom:10px}
.lc-hero-title{font-size:26px;font-weight:800;letter-spacing:-0.035em;color:var(--fg-default);margin-bottom:6px;line-height:1.1}
.lc-hero-sub{font-size:13px;color:var(--fg-muted);max-width:440px;line-height:1.6}
.lc-hero-stats{display:flex;align-items:center;gap:12px;flex-shrink:0;flex-wrap:wrap}
.lc-xp-ring-wrap{position:relative;width:88px;height:88px;flex-shrink:0}
.lc-xp-ring-inner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}
.lc-xp-ring-level{font-size:22px;font-weight:800;color:var(--fg-default);line-height:1;letter-spacing:-0.03em}
.lc-xp-ring-name{font-size:8px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--fg-muted)}
.lc-hero-stat-cards{display:flex;flex-direction:column;gap:6px}
.lc-stat-mini{background:var(--bg-overlay);border:1px solid var(--border);border-radius:10px;padding:8px 14px;min-width:84px;text-align:center}
.lc-stat-mini-val{font-size:18px;font-weight:800;letter-spacing:-0.03em;color:var(--fg-default);line-height:1}
.lc-stat-mini-label{font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-muted);margin-top:2px}

/* ── Command Palette ─────────────────────────────── */
.lc-cmd-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(6px);z-index:500;display:flex;align-items:flex-start;justify-content:center;padding-top:15vh;animation:lcFadeIn 120ms ease}
.lc-cmd-box{width:min(540px,92vw);background:var(--bg-elevated);border:1px solid var(--border-strong);border-radius:16px;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,0.28),0 8px 24px rgba(0,0,0,0.16);animation:lcScaleIn 140ms cubic-bezier(0.16,1,0.3,1)}
.lc-cmd-input-row{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--border)}
.lc-cmd-icon{color:var(--fg-muted);flex-shrink:0}
.lc-cmd-input{flex:1;background:transparent;border:none;outline:none;font-size:15px;font-family:inherit;color:var(--fg-default)}
.lc-cmd-input::placeholder{color:var(--fg-muted)}
.lc-cmd-kbd{display:inline-flex;align-items:center;justify-content:center;height:20px;padding:0 6px;border-radius:4px;border:1px solid var(--border);background:var(--bg-subtle);font-size:10px;font-weight:600;color:var(--fg-muted);letter-spacing:0.05em;flex-shrink:0}
.lc-cmd-results{max-height:340px;overflow-y:auto;padding:8px}
.lc-cmd-section-label{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--fg-muted);padding:8px 12px 4px}
.lc-cmd-item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;transition:background 100ms ease}
.lc-cmd-item:hover,.lc-cmd-item.selected{background:var(--bg-subtle-hover)}
.lc-cmd-item-icon{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;font-size:14px}
.lc-cmd-item-title{font-size:13px;font-weight:600;color:var(--fg-default);margin-bottom:1px}
.lc-cmd-item-sub{font-size:11px;color:var(--fg-muted)}
.lc-cmd-empty{padding:32px 16px;text-align:center;color:var(--fg-muted);font-size:13px}
.lc-cmd-footer{display:flex;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid var(--border);font-size:11px;color:var(--fg-muted)}

/* ── Toast ────────────────────────────────────────── */
.lc-toast-region{position:fixed;bottom:24px;right:24px;display:flex;flex-direction:column;gap:8px;z-index:1000;pointer-events:none}
.lc-toast{pointer-events:all;display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;background:var(--bg-overlay);border:1px solid var(--border-strong);box-shadow:0 8px 24px rgba(0,0,0,0.18),0 2px 8px rgba(0,0,0,0.12);font-size:13px;color:var(--fg-default);min-width:260px;max-width:340px;animation:lcToastIn 280ms cubic-bezier(0.16,1,0.3,1) both}
.lc-toast.exit{animation:lcToastOut 220ms ease forwards}
.lc-toast-icon{width:28px;height:28px;border-radius:7px;display:grid;place-items:center;font-size:13px;flex-shrink:0}
.lc-toast-title{font-weight:700;color:var(--fg-default);margin-bottom:1px;font-size:13px}
.lc-toast-sub{font-size:11px;color:var(--fg-muted)}
.lc-toast.success .lc-toast-icon{background:color-mix(in srgb,var(--accent-emerald) 12%,transparent);color:var(--accent-emerald)}
.lc-toast.info .lc-toast-icon{background:color-mix(in srgb,var(--accent-blue) 12%,transparent);color:var(--accent-blue)}
.lc-toast.xp .lc-toast-icon{background:color-mix(in srgb,var(--accent-violet) 12%,transparent);color:var(--accent-violet);animation:lcBounce 400ms ease 200ms both}

/* ── Tab Navigation ─────────────────────────────── */
.lc-nav-wrap{margin-bottom:22px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.lc-nav-search-btn{display:flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 10px;border-radius:10px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--fg-muted);font-size:12px;font-weight:500;font-family:inherit;cursor:pointer;transition:all 120ms ease;gap:6px;white-space:nowrap;margin-left:auto}
.lc-nav-search-btn:hover{border-color:var(--border-strong);color:var(--fg-default);background:var(--bg-subtle-hover)}
.lc-tab-scroll{display:flex;gap:3px;flex-wrap:wrap;flex:1}
.lc-tab-btn{display:flex;align-items:center;gap:5px;height:32px;padding:0 12px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--fg-muted);font-size:12px;font-weight:500;font-family:inherit;cursor:pointer;transition:all 100ms ease;white-space:nowrap}
.lc-tab-btn:hover{color:var(--fg-default);background:var(--bg-subtle-hover)}
.lc-tab-btn.active{color:var(--accent-violet);background:color-mix(in srgb,var(--accent-violet) 10%,transparent);border-color:color-mix(in srgb,var(--accent-violet) 22%,transparent);font-weight:600}

/* ── Cards ───────────────────────────────────────── */
.lc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.lc-grid-sm{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.lc-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;padding:20px;transition:border-color 140ms ease,box-shadow 150ms ease,transform 150ms ease;cursor:pointer;position:relative;overflow:hidden}
.lc-card::before{content:'';position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse 80% 60% at 50% 0%,color-mix(in srgb,var(--accent-violet) 6%,transparent),transparent);transition:opacity 200ms ease;pointer-events:none}
.lc-card:hover{border-color:var(--border-strong);box-shadow:0 4px 16px rgba(0,0,0,0.07),0 1px 4px rgba(0,0,0,0.05);transform:translateY(-1px)}
.lc-card:hover::before{opacity:1}
.lc-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
.lc-card-icon{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;font-size:16px;flex-shrink:0;margin-bottom:12px}
.lc-card-title{font-size:14px;font-weight:700;color:var(--fg-default);letter-spacing:-0.01em;line-height:1.35}
.lc-card-desc{font-size:12px;color:var(--fg-muted);line-height:1.6;margin-bottom:14px}
.lc-card-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lc-card-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}

/* ── Badges ──────────────────────────────────────── */
.lc-badge{display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 7px;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap}
.lc-badge-violet{background:color-mix(in srgb,var(--accent-violet) 12%,transparent);color:var(--accent-violet)}
.lc-badge-blue{background:color-mix(in srgb,var(--accent-blue) 12%,transparent);color:var(--accent-blue)}
.lc-badge-cyan{background:color-mix(in srgb,var(--accent-cyan) 12%,transparent);color:var(--accent-cyan)}
.lc-badge-amber{background:color-mix(in srgb,var(--accent-amber) 12%,transparent);color:var(--accent-amber)}
.lc-badge-rose{background:color-mix(in srgb,var(--accent-rose) 12%,transparent);color:var(--accent-rose)}
.lc-badge-emerald{background:color-mix(in srgb,var(--accent-emerald) 12%,transparent);color:var(--accent-emerald)}
.lc-badge-muted{background:var(--bg-subtle);color:var(--fg-muted)}

/* ── Section Headers ─────────────────────────────── */
.lc-section-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}
.lc-section-title{font-size:15px;font-weight:700;letter-spacing:-0.02em;color:var(--fg-default)}
.lc-section-sub{font-size:12px;color:var(--fg-muted);margin-top:2px}

/* ── Home Pinned ─────────────────────────────────── */
.lc-pinned{background:linear-gradient(135deg,color-mix(in srgb,var(--accent-amber) 6%,var(--bg-elevated)),color-mix(in srgb,var(--accent-rose) 4%,var(--bg-elevated)));border:1px solid color-mix(in srgb,var(--accent-amber) 18%,transparent);border-radius:16px;padding:20px 24px;margin-bottom:20px}
.lc-pinned-items{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:12px}
.lc-pinned-item{background:var(--bg-overlay);border:1px solid var(--border);border-radius:11px;padding:12px 14px;cursor:pointer;transition:all 120ms ease;display:flex;align-items:flex-start;gap:10px}
.lc-pinned-item:hover{border-color:var(--border-strong);background:var(--bg-subtle-hover);transform:translateY(-1px)}
.lc-pinned-icon{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;font-size:14px}
.lc-pinned-item-title{font-size:12px;font-weight:600;color:var(--fg-default);margin-bottom:2px;line-height:1.35}
.lc-pinned-item-sub{font-size:10px;color:var(--fg-muted)}

/* ── Assignments Banner ──────────────────────────── */
.lc-assignments-banner{background:color-mix(in srgb,var(--accent-blue) 5%,var(--bg-elevated));border:1px solid color-mix(in srgb,var(--accent-blue) 18%,transparent);border-radius:14px;padding:18px 22px;margin-bottom:18px}
.lc-assignment-item{display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-overlay);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:all 120ms ease}
.lc-assignment-item:hover{border-color:var(--border-strong);background:var(--bg-subtle-hover)}
.lc-assignment-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}

/* ── Streak Banner ───────────────────────────────── */
.lc-streak-banner{display:flex;align-items:center;gap:10px;padding:10px 16px;background:color-mix(in srgb,var(--accent-amber) 7%,var(--bg-elevated));border:1px solid color-mix(in srgb,var(--accent-amber) 20%,transparent);border-radius:10px;margin-bottom:16px;font-size:13px;font-weight:600;color:var(--accent-amber);animation:lcFadeUp 300ms ease both}
.lc-streak-days{display:flex;gap:4px;margin-left:auto}
.lc-streak-day{width:8px;height:8px;border-radius:2px;background:color-mix(in srgb,var(--accent-amber) 30%,transparent)}
.lc-streak-day.active{background:var(--accent-amber)}

/* ── Achievement Badges ──────────────────────────── */
.lc-badges-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.lc-achievement-badge{display:flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:7px;font-size:11px;font-weight:600;border:1px solid color-mix(in srgb,var(--accent-amber) 22%,transparent);background:color-mix(in srgb,var(--accent-amber) 7%,transparent);color:var(--accent-amber);transition:all 120ms ease}
.lc-achievement-badge:hover{background:color-mix(in srgb,var(--accent-amber) 12%,transparent)}

/* ── Quick Access Grid ───────────────────────────── */
.lc-quickaccess-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:16px;cursor:pointer;transition:all 130ms ease;text-align:center}
.lc-quickaccess-card:hover{border-color:var(--border-strong);box-shadow:0 3px 10px rgba(0,0,0,0.06);transform:translateY(-1px)}
.lc-quickaccess-icon{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;font-size:18px;margin:0 auto 10px}

/* ── Recommendation Banner ───────────────────────── */
.lc-rec-banner{display:flex;align-items:flex-start;gap:12px;padding:12px 16px;background:color-mix(in srgb,var(--accent-rose) 5%,var(--bg-elevated));border:1px solid color-mix(in srgb,var(--accent-rose) 16%,transparent);border-radius:10px;margin-bottom:14px;font-size:12px;color:var(--fg-default);font-weight:500}

/* ── SOPs ────────────────────────────────────────── */
.lc-sop-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:border-color 140ms ease}
.lc-sop-card:hover{border-color:var(--border-strong)}
.lc-sop-header{padding:16px 20px;display:flex;align-items:flex-start;gap:12px;cursor:pointer}
.lc-sop-body{padding:0 20px 20px}
.lc-sop-version{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--fg-muted);margin-top:5px;flex-wrap:wrap}
.lc-sop-changelog{margin-top:16px;border-top:1px solid var(--border);padding-top:14px}
.lc-sop-changelog-item{display:flex;gap:12px;padding:6px 0;font-size:11px;color:var(--fg-muted);border-bottom:1px solid var(--border)}
.lc-sop-changelog-item:last-child{border-bottom:none}
.lc-sop-changelog-version{font-family:var(--font-mono,monospace);font-weight:600;color:var(--accent-cyan);flex-shrink:0;min-width:36px}
.lc-sop-toggle-btn{margin-left:auto;width:26px;height:26px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--fg-muted);display:grid;place-items:center;cursor:pointer;transition:all 120ms ease;font-size:10px;flex-shrink:0}
.lc-sop-toggle-btn:hover{background:var(--bg-subtle-hover);color:var(--fg-default)}

/* ── Defects ─────────────────────────────────────── */
.lc-defect-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:border-color 140ms ease,box-shadow 140ms ease}
.lc-defect-card:hover{border-color:var(--border-strong);box-shadow:0 3px 12px rgba(0,0,0,0.06)}
.lc-defect-top{padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);background:color-mix(in srgb,var(--accent-rose) 3%,transparent)}
.lc-defect-body{padding:14px 18px;display:flex;flex-direction:column;gap:12px}
.lc-defect-label{font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:5px}
.lc-defect-text{font-size:12px;color:var(--fg-muted);line-height:1.65;padding:10px 12px;border-radius:8px;background:var(--bg-subtle)}

/* ── Work Instructions ────────────────────────────── */
.lc-wi-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;padding:18px 20px;transition:border-color 140ms ease}
.lc-wi-card:hover{border-color:var(--border-strong)}
.lc-wi-steps{margin-top:14px;display:flex;flex-direction:column;gap:6px}
.lc-wi-step{display:flex;align-items:flex-start;gap:10px;font-size:12px;color:var(--fg-muted);line-height:1.55;padding:8px 10px;border-radius:8px;transition:background 100ms ease}
.lc-wi-step:hover{background:var(--bg-subtle)}
.lc-wi-step-num{width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--accent-blue) 12%,transparent);color:var(--accent-blue);font-size:10px;font-weight:700;display:grid;place-items:center;flex-shrink:0;margin-top:1px}

/* ── Lessons ─────────────────────────────────────── */
.lc-lesson-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;padding:18px 20px;transition:border-color 140ms ease}
.lc-lesson-card:hover{border-color:var(--border-strong)}
.lc-lesson-insight{font-size:13px;color:var(--fg-default);line-height:1.75;margin:12px 0;padding:12px 16px;background:var(--bg-subtle);border-radius:8px;border-left:3px solid var(--accent-cyan);font-style:italic}
.lc-lesson-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:10px}
.lc-upvote-btn{display:flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--fg-muted);font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 120ms ease}
.lc-upvote-btn:hover,.lc-upvote-btn.active{color:var(--accent-violet);border-color:color-mix(in srgb,var(--accent-violet) 30%,transparent);background:color-mix(in srgb,var(--accent-violet) 8%,transparent)}

/* ── Standards ───────────────────────────────────── */
.lc-standard-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;padding:20px;transition:all 130ms ease}
.lc-standard-card:hover{border-color:var(--border-strong);transform:translateY(-1px)}
.lc-standard-score{font-size:40px;font-weight:800;letter-spacing:-0.05em;line-height:1;margin:10px 0 4px}
.lc-standard-bar{height:6px;border-radius:999px;background:var(--border);overflow:hidden;margin:8px 0}
.lc-standard-bar-fill{height:100%;border-radius:999px;transition:width 700ms cubic-bezier(0.16,1,0.3,1)}

/* ── Analytics ───────────────────────────────────── */
.lc-analytics-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin-bottom:20px}
.lc-stat-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;padding:18px 20px;position:relative;overflow:hidden;transition:all 130ms ease}
.lc-stat-card:hover{border-color:var(--border-strong)}
.lc-stat-card::before{content:'';position:absolute;bottom:-20px;right:-20px;width:80px;height:80px;border-radius:50%;opacity:0.06}
.lc-stat-val{font-size:34px;font-weight:800;letter-spacing:-0.045em;line-height:1;margin-bottom:4px}
.lc-stat-label{font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--fg-muted)}
.lc-stat-delta{font-size:11px;font-weight:600;margin-top:4px}
.lc-chart-bar-wrap{display:flex;align-items:flex-end;gap:6px;height:64px}
.lc-chart-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}
.lc-chart-bar{width:100%;border-radius:4px 4px 0 0;transition:height 600ms cubic-bezier(0.16,1,0.3,1);min-height:3px}
.lc-chart-label{font-size:9px;color:var(--fg-muted);font-weight:500}

/* ── Onboarding Track ─────────────────────────────── */
.lc-onboarding-track{background:var(--bg-elevated);border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:14px}
.lc-onboarding-header{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.lc-onboarding-step{display:flex;align-items:center;gap:14px;padding:13px 22px;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer;transition:background 100ms ease}
.lc-onboarding-step:last-child{border-bottom:none}
.lc-onboarding-step:hover{background:var(--bg-subtle-hover)}
.lc-onboarding-step.completed{opacity:0.55}
.lc-step-check{width:22px;height:22px;border-radius:50%;border:2px solid var(--border-strong);display:grid;place-items:center;flex-shrink:0;font-size:10px;transition:all 200ms ease}
.lc-step-check.done{background:var(--accent-emerald);border-color:var(--accent-emerald);color:#fff}
.lc-onboarding-progress{height:3px;background:var(--border);overflow:hidden}
.lc-onboarding-progress-fill{height:100%;background:linear-gradient(90deg,var(--accent-violet),var(--accent-cyan));transition:width 600ms cubic-bezier(0.16,1,0.3,1)}

/* ── Best Practices ──────────────────────────────── */
.lc-bp-card{background:linear-gradient(135deg,color-mix(in srgb,var(--accent-emerald) 5%,var(--bg-elevated)),var(--bg-elevated));border:1px solid color-mix(in srgb,var(--accent-emerald) 14%,transparent);border-radius:14px;padding:18px 20px;transition:all 130ms ease}
.lc-bp-card:hover{border-color:color-mix(in srgb,var(--accent-emerald) 28%,transparent);transform:translateY(-1px)}
.lc-bp-quote{font-size:13px;color:var(--fg-default);line-height:1.75;font-style:italic;margin:12px 0;padding:12px 16px;border-left:3px solid var(--accent-emerald)}

/* ── Detail Panel ────────────────────────────────── */
.lc-detail-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(5px);z-index:100;display:flex;align-items:flex-start;justify-content:flex-end;animation:lcFadeIn 130ms ease}
.lc-detail-panel{width:min(620px,100vw);height:100vh;background:var(--bg-elevated);border-left:1px solid var(--border-strong);overflow-y:auto;animation:lcSlideIn 220ms cubic-bezier(0.16,1,0.3,1) both;display:flex;flex-direction:column}
.lc-detail-header{padding:24px 28px 20px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg-elevated);position:sticky;top:0;z-index:2}
.lc-detail-body{padding:24px 28px;flex:1}
.lc-detail-close{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--fg-muted);display:grid;place-items:center;cursor:pointer;transition:all 120ms ease;font-size:14px;font-family:inherit}
.lc-detail-close:hover{color:var(--fg-default);background:var(--bg-subtle-hover)}
.lc-detail-content{font-size:13px;color:var(--fg-muted);line-height:1.8;white-space:pre-wrap}
.lc-detail-content strong{color:var(--fg-default);font-weight:700}
.lc-complete-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:44px;border-radius:11px;border:none;background:linear-gradient(135deg,var(--accent-violet),var(--accent-blue));color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;transition:opacity 120ms ease,transform 120ms ease,box-shadow 120ms ease;margin-top:24px;box-shadow:0 4px 14px color-mix(in srgb,var(--accent-violet) 35%,transparent)}
.lc-complete-btn:hover{opacity:0.92;transform:translateY(-1px);box-shadow:0 6px 18px color-mix(in srgb,var(--accent-violet) 45%,transparent)}
.lc-complete-btn:disabled{opacity:0.45;cursor:not-allowed;transform:none;box-shadow:none}
.lc-complete-btn.done{background:var(--bg-subtle);color:var(--fg-muted);box-shadow:none}

/* ── Action Buttons ──────────────────────────────── */
.lc-btn{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--fg-muted);font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 120ms ease;white-space:nowrap}
.lc-btn:hover{color:var(--fg-default);border-color:var(--border-strong);background:var(--bg-subtle-hover)}
.lc-btn-primary{border-color:color-mix(in srgb,var(--accent-violet) 25%,transparent);background:color-mix(in srgb,var(--accent-violet) 8%,transparent);color:var(--accent-violet)}
.lc-btn-primary:hover{background:color-mix(in srgb,var(--accent-violet) 14%,transparent)}
.lc-btn-blue{border-color:color-mix(in srgb,var(--accent-blue) 25%,transparent);background:color-mix(in srgb,var(--accent-blue) 8%,transparent);color:var(--accent-blue)}
.lc-btn-blue:hover{background:color-mix(in srgb,var(--accent-blue) 14%,transparent)}
.lc-btn-admin{border-color:color-mix(in srgb,var(--accent-violet) 25%,transparent);background:color-mix(in srgb,var(--accent-violet) 8%,transparent);color:var(--accent-violet)}
.lc-btn-admin:hover{background:color-mix(in srgb,var(--accent-violet) 14%,transparent)}
.lc-btn-danger{border-color:color-mix(in srgb,var(--accent-rose) 20%,transparent);background:transparent;color:var(--accent-rose)}
.lc-btn-danger:hover{background:color-mix(in srgb,var(--accent-rose) 8%,transparent)}

/* ── Search Bar ──────────────────────────────────── */
.lc-search-bar{width:100%;display:flex;align-items:center;gap:10px;height:42px;padding:0 14px;border-radius:11px;border:1px solid var(--border);background:var(--bg-elevated);margin-bottom:18px;transition:border-color 140ms ease}
.lc-search-bar:focus-within{border-color:var(--border-strong)}
.lc-search-input{flex:1;background:transparent;border:none;outline:none;font-size:13px;font-family:inherit;color:var(--fg-default)}
.lc-search-input::placeholder{color:var(--fg-muted)}

/* ── Skeleton ────────────────────────────────────── */
.lc-skeleton{background:linear-gradient(90deg,var(--bg-subtle) 25%,var(--border) 50%,var(--bg-subtle) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:8px}

/* ── Preview Banner ──────────────────────────────── */
.lc-preview-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px;padding:11px 16px;border-radius:11px;border:1px solid color-mix(in srgb,var(--accent-amber) 25%,transparent);background:color-mix(in srgb,var(--accent-amber) 6%,var(--bg-elevated))}
.lc-preview-roles{display:flex;gap:5px;flex-wrap:wrap}

/* ── Empty States ────────────────────────────────── */
.lc-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 24px;text-align:center;border:1px dashed var(--border);border-radius:14px;background:var(--bg-elevated)}
.lc-empty-icon{font-size:36px;margin-bottom:12px;opacity:0.5}
.lc-empty-title{font-size:14px;font-weight:700;color:var(--fg-default);margin-bottom:4px}
.lc-empty-sub{font-size:12px;color:var(--fg-muted);max-width:280px;line-height:1.6}

/* ── Module Completion Shimmer ───────────────────── */
.lc-completed-overlay{position:absolute;inset:0;border-radius:14px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent-emerald) 5%,transparent),transparent);pointer-events:none}

/* ── Audit Findings ──────────────────────────────── */
.lc-audit-row{display:flex;align-items:center;gap:16px;padding:14px 18px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;flex-wrap:wrap;transition:all 120ms ease}
.lc-audit-row:hover{border-color:var(--border-strong)}
.lc-audit-fail-bar{height:5px;border-radius:999px;background:var(--border);overflow:hidden;margin:6px 0 0}
.lc-audit-fail-fill{height:100%;border-radius:999px;transition:width 700ms cubic-bezier(0.16,1,0.3,1)}

/* ── Quiz Card ───────────────────────────────────── */
.lc-quiz-card{background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;padding:20px;transition:all 130ms ease;overflow:hidden;position:relative}
.lc-quiz-card:hover{border-color:var(--border-strong);box-shadow:0 3px 12px rgba(0,0,0,0.06)}
.lc-quiz-score-bar{height:3px;background:var(--border);border-radius:999px;overflow:hidden;margin-top:10px}
.lc-quiz-score-fill{height:100%;border-radius:999px;transition:width 600ms cubic-bezier(0.16,1,0.3,1)}

/* ── Progress Bar (inline) ───────────────────────── */
.lc-prog-bar{height:4px;border-radius:999px;background:var(--border);overflow:hidden}
.lc-prog-fill{height:100%;border-radius:999px;background:var(--accent-violet);transition:width 600ms cubic-bezier(0.16,1,0.3,1)}

/* ── Spotlight card ──────────────────────────────── */
.lc-spotlight{background:linear-gradient(135deg,color-mix(in srgb,var(--accent-violet) 10%,var(--bg-elevated)),color-mix(in srgb,var(--accent-blue) 6%,var(--bg-elevated)));border:1px solid color-mix(in srgb,var(--accent-violet) 18%,transparent);border-radius:14px;padding:20px;margin-bottom:18px;position:relative;overflow:hidden}
.lc-spotlight::after{content:'';position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent-violet) 10%,transparent),transparent 70%);pointer-events:none}

/* ── Responsive ──────────────────────────────────── */
@media(max-width:640px){
  .lc-hero-content{padding:20px 20px}
  .lc-hero-title{font-size:20px}
  .lc-grid{grid-template-columns:1fr}
  .lc-pinned-items{grid-template-columns:1fr}
  .lc-analytics-grid{grid-template-columns:1fr 1fr}
  .lc-hero-stats{gap:8px}
  .lc-xp-ring-wrap{width:72px;height:72px}
}
`;

function injectLCStyles() {
  if (document.getElementById(LC_CSS_ID)) return;
  const el = document.createElement("style");
  el.id = LC_CSS_ID; el.textContent = LC_CSS;
  document.head.appendChild(el);
}

// ─── Toast System ─────────────────────────────────────────────────────────────

interface ToastItem {
  id: string;
  type: "success" | "info" | "xp";
  title: string;
  sub?: string;
  exiting?: boolean;
}

function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-3), { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 240);
    }, 3200);
  }, []);

  return { toasts, add };
}

const ToastRegion = memo(function ToastRegion({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="lc-toast-region">
      {toasts.map(t => (
        <div key={t.id} className={`lc-toast ${t.type}${t.exiting ? " exit" : ""}`}>
          <div className="lc-toast-icon">
            {t.type === "success" ? "✓" : t.type === "xp" ? "⚡" : "ℹ"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="lc-toast-title">{t.title}</div>
            {t.sub && <div className="lc-toast-sub">{t.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
});

// ─── Command Palette ──────────────────────────────────────────────────────────

interface CmdItem {
  id: string; icon: string; title: string; sub: string;
  action: () => void; color: string;
}

const CommandPalette = memo(function CommandPalette({
  modules, sops, quizzes,
  onClose, onSelectModule, onTabChange,
}: {
  modules: LearningModule[]; sops: SOPDocument[]; workInstructions: WorkInstruction[];
  quizzes: Quiz[]; onClose: () => void;
  onSelectModule: (m: LearningModule) => void; onTabChange: (t: LCTab) => void;
}) {
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const navItems: CmdItem[] = useMemo(() => [
    { id:"nav-home", icon:"🏠", title:"Go to Home", sub:"Home tab", action:() => { onTabChange("home"); onClose(); }, color:"var(--accent-violet)" },
    { id:"nav-modules", icon:"📚", title:"Training Modules", sub:"All modules", action:() => { onTabChange("modules"); onClose(); }, color:"var(--accent-blue)" },
    { id:"nav-quizzes", icon:"📝", title:"Quizzes", sub:"Test your knowledge", action:() => { onTabChange("quizzes"); onClose(); }, color:"var(--accent-cyan)" },
    { id:"nav-certs", icon:"🏆", title:"Certifications", sub:"Your certifications", action:() => { onTabChange("certifications"); onClose(); }, color:"var(--accent-amber)" },
    { id:"nav-sop", icon:"📄", title:"SOPs", sub:"Standard procedures", action:() => { onTabChange("sop"); onClose(); }, color:"var(--accent-emerald)" },
    { id:"nav-coaching", icon:"👔", title:"Coaching", sub:"Team coaching", action:() => { onTabChange("coaching"); onClose(); }, color:"var(--accent-rose)" },
    { id:"nav-analytics", icon:"📊", title:"Analytics", sub:"Your stats", action:() => { onTabChange("analytics"); onClose(); }, color:"var(--accent-violet)" },
  ], [onTabChange, onClose]);

  const items = useMemo<CmdItem[]>(() => {
    if (!query.trim()) return navItems;
    const q = query.toLowerCase();
    const results: CmdItem[] = [];
    modules.filter(m => m.title.toLowerCase().includes(q)).slice(0, 4).forEach(m => {
      results.push({ id:`mod-${m.id}`, icon:"📚", title:m.title, sub:`Module · ${m.difficulty}`,
        action:() => { onSelectModule(m); onClose(); }, color:"var(--accent-blue)" });
    });
    sops.filter(s => s.title.toLowerCase().includes(q)).slice(0, 2).forEach(s => {
      results.push({ id:`sop-${s.id}`, icon:"📄", title:s.title, sub:`SOP v${s.version}`,
        action:() => { onTabChange("sop"); onClose(); }, color:"var(--accent-emerald)" });
    });
    quizzes.filter(q2 => q2.title.toLowerCase().includes(q)).slice(0, 2).forEach(q2 => {
      results.push({ id:`quiz-${q2.id}`, icon:"📝", title:q2.title, sub:`Quiz · ${q2.questions.length} questions`,
        action:() => { onTabChange("quizzes"); onClose(); }, color:"var(--accent-cyan)" });
    });
    return results;
  }, [query, navItems, modules, sops, quizzes, onSelectModule, onTabChange, onClose]);

  useEffect(() => { setSel(0); }, [items]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s+1, items.length-1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s-1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); items[sel]?.action(); }
    else if (e.key === "Escape") { onClose(); }
  }, [items, sel, onClose]);

  return (
    <div className="lc-cmd-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="lc-cmd-box">
        <div className="lc-cmd-input-row">
          <span className="lc-cmd-icon">
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input ref={inputRef} className="lc-cmd-input" placeholder="Search modules, SOPs, quizzes or navigate…"
            value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKey} />
          <span className="lc-cmd-kbd">ESC</span>
        </div>
        <div className="lc-cmd-results">
          {items.length === 0 && (
            <div className="lc-cmd-empty">No results for "{query}"</div>
          )}
          {!query && <div className="lc-cmd-section-label">Navigate</div>}
          {query && items.some(i => i.id.startsWith("mod")) && <div className="lc-cmd-section-label">Modules</div>}
          {items.map((item, i) => (
            <div key={item.id} className={`lc-cmd-item${sel === i ? " selected" : ""}`}
              onClick={item.action} onMouseEnter={() => setSel(i)}>
              <div className="lc-cmd-item-icon" style={{ background:`color-mix(in srgb,${item.color} 12%,transparent)`, color:item.color }}>
                {item.icon}
              </div>
              <div>
                <div className="lc-cmd-item-title">{item.title}</div>
                <div className="lc-cmd-item-sub">{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="lc-cmd-footer">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
});

// ─── Small reusable components ────────────────────────────────────────────────

const DifficultyBadge = memo(function DifficultyBadge({ difficulty }: { difficulty: LearningModule["difficulty"] }) {
  const map: Record<LearningModule["difficulty"], string> = {
    beginner: "lc-badge-emerald", intermediate: "lc-badge-amber", advanced: "lc-badge-rose"
  };
  return <span className={`lc-badge ${map[difficulty]}`}>{difficulty}</span>;
});

const SeverityBadge = memo(function SeverityBadge({ severity }: { severity: DefectExample["severity"] }) {
  const map: Record<DefectExample["severity"], string> = {
    low:"lc-badge-muted", medium:"lc-badge-amber", high:"lc-badge-rose", critical:"lc-badge-rose"
  };
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
    <span style={{ color:"var(--accent-amber)", fontSize:"11px", fontWeight:600 }}>
      {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))} {rating.toFixed(1)}
    </span>
  );
});

function SearchSVG({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, color:"var(--fg-muted)" }}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  );
}

function SkeletonCard() {
  return (
    <div style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:14, padding:20 }}>
      <div className="lc-skeleton" style={{ height:36, width:36, borderRadius:10, marginBottom:14 }} />
      <div className="lc-skeleton" style={{ height:14, width:"72%", marginBottom:10 }} />
      <div className="lc-skeleton" style={{ height:11, width:"100%", marginBottom:6 }} />
      <div className="lc-skeleton" style={{ height:11, width:"75%" }} />
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="lc-empty">
      <div className="lc-empty-icon">{icon}</div>
      <div className="lc-empty-title">{title}</div>
      <div className="lc-empty-sub">{sub}</div>
    </div>
  );
}

const ProgressRing = memo(function ProgressRing({
  pct, size = 88, stroke = 7, color = "var(--accent-violet)"
}: { pct: number; size?: number; stroke?: number; color?: string }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform:"rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${circ * Math.max(0, Math.min(pct,100)) / 100} ${circ}`} strokeLinecap="round"
        style={{ transition:"stroke-dasharray 700ms cubic-bezier(0.16,1,0.3,1)" }} />
    </svg>
  );
});

function defaultDueDate(daysFromNow = 7): string {
  const d = new Date(); d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

// ─── Data Hook (unchanged logic, same API) ────────────────────────────────────
interface LearningData {
  modules: LearningModule[]; sops: SOPDocument[]; workInstructions: WorkInstruction[];
  defects: DefectExample[]; quizzes: Quiz[]; lessons: LessonLearned[];
  bestPractices: BestPractice[]; qualityStandards: QualityStandard[]; progress: UserProgress;
  teamData: TeamMember[]; coachingNotes: CoachingNote[]; recommendations: string[];
  auditLinks: AuditLink[]; onboardingTracks: OnboardingTrack[]; userUpvotes: Set<string>;
  assignedModuleIds: Set<string>; assignments: LearningAssignment[]; contentAudit: ContentAuditEntry[];
  loading: boolean; error: string | null;
}

function useSupabaseLearning(userId: string | undefined, role: string, teamScope?: string | null): LearningData & {
  completeModule: (moduleId: string) => Promise<void>;
  completeQuiz: (quizId: string, score: number) => Promise<void>;
  saveCoachingNote: (agentId: string, note: string, metric?: string) => Promise<void>;
  assignModule: (agentId: string, moduleId: string) => Promise<void>;
  assignLearningContent: (input: { agentId: string; moduleId: string; contentType?: LearningAssignableType; contentId?: string; title?: string; dueDate?: string | null }) => Promise<void>;
  toggleUpvote: (lessonId: string) => Promise<void>;
  handleCertificationEarned: (certId: string) => Promise<void>;
  saveQuiz: (quiz: Quiz) => Promise<Quiz | void>;
  removeQuiz: (quizId: string) => Promise<void>;
  saveModule: (item: LearningModule) => Promise<void>;
  removeModule: (id: string) => Promise<void>;
  saveSOP: (item: SOPDocument) => Promise<void>;
  removeSOP: (id: string) => Promise<void>;
  saveWorkInstruction: (item: WorkInstruction) => Promise<void>;
  removeWorkInstruction: (id: string) => Promise<void>;
  saveDefect: (item: DefectExample) => Promise<void>;
  removeDefect: (id: string) => Promise<void>;
  saveStandard: (item: QualityStandard) => Promise<void>;
  removeStandard: (id: string) => Promise<void>;
  saveOnboardingTrack: (item: OnboardingTrack) => Promise<void>;
  removeOnboardingTrack: (id: string) => Promise<void>;
  saveBestPractice: (item: BestPractice) => Promise<void>;
  removeBestPractice: (id: string) => Promise<void>;
  removeCoachingNote: (id: string) => Promise<void>;
  saveCoachingNoteWithId: (agentId: string, note: string, metric?: string, noteId?: string) => Promise<void>;
  updateLearningAssignment: (assignment: LearningAssignment) => Promise<void>;
  removeLearningAssignment: (assignment: LearningAssignment) => Promise<void>;
} {
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [sops, setSops] = useState<SOPDocument[]>([]);
  const [workInstructions, setWorkInstructions] = useState<WorkInstruction[]>([]);
  const [defects, setDefects] = useState<DefectExample[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [bestPractices, setBestPractices] = useState<BestPractice[]>([]);
  const [qualityStandards, setQualityStandards] = useState<QualityStandard[]>([]);
  const [progress, setProgress] = useState<UserProgress>(DEFAULT_PROGRESS);
  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [coachingNotes, setCoachingNotes] = useState<CoachingNote[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [auditLinks, setAuditLinks] = useState<AuditLink[]>([]);
  const [onboardingTracks, setOnboardingTracks] = useState<OnboardingTrack[]>([]);
  const [userUpvotes, setUserUpvotes] = useState<Set<string>>(new Set());
  const [assignedModuleIds, setAssignedModuleIds] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<LearningAssignment[]>([]);
  const [contentAudit, setContentAudit] = useState<ContentAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const activeUserId = userId;
    const isSup = role === "supervisor";
    const isAgent = role === "agent";

    async function loadAll() {
      setLoading(true); setError(null);
      try {
        const [modRes, sopRes, wiRes, defRes, quizRes, lessonRes, bpRes, standardRes, progressRes, upvoteRes, trackRes] =
          await Promise.all([fetchLearningModules(), fetchSOPs(), fetchWorkInstructions(), fetchDefectExamples(),
            fetchQuizzes(), fetchLessonsLearned(), fetchBestPractices(), fetchQualityStandards(),
            fetchOrCreateUserProgress(activeUserId), fetchUserUpvotes(activeUserId), fetchOnboardingTracks(role)]);

        if (modRes.data)      setModules(modRes.data);
        if (sopRes.data)      setSops(sopRes.data);
        if (wiRes.data)       setWorkInstructions(wiRes.data);
        if (defRes.data)      setDefects(defRes.data);
        if (quizRes.data)     setQuizzes(quizRes.data);
        if (lessonRes.data)   setLessons(lessonRes.data);
        if (bpRes.data)       setBestPractices(bpRes.data);
        if (standardRes.data) setQualityStandards(standardRes.data);
        if (progressRes.data) setProgress(progressRes.data);
        if (upvoteRes.data)   setUserUpvotes(new Set(upvoteRes.data));
        if (trackRes.data)    setOnboardingTracks(trackRes.data);

        if (isSup) {
          const [teamRes, notesRes, linksRes, assignmentsRes, auditRes] = await Promise.all([
            fetchTeamMembers(activeUserId, teamScope ?? null), fetchCoachingNotes(activeUserId),
            fetchAuditLinks(), fetchAllAssignments(), fetchLearningContentAuditTrail()]);
          if (teamRes.data)        setTeamData(teamRes.data);
          if (notesRes.data)       setCoachingNotes(notesRes.data);
          if (linksRes.data)       setAuditLinks(linksRes.data);
          if (assignmentsRes.data) setAssignments(assignmentsRes.data);
          if (auditRes.data)       setContentAudit(auditRes.data);
        } else if (isAgent) {
          const [recRes, assignRes, linksRes] = await Promise.all([
            fetchRecommendedModuleIds(activeUserId), fetchAgentAssignments(activeUserId), fetchAuditLinks(activeUserId)]);
          if (recRes.data)    setRecommendations(recRes.data);
          if (assignRes.data) {
            setAssignments(assignRes.data);
            setAssignedModuleIds(new Set(assignRes.data.map(a => a.moduleId ?? "").filter(Boolean)));
          }
          if (linksRes.data)  setAuditLinks(linksRes.data);
        } else {
          const [teamRes, notesRes, linksRes, assignmentsRes, auditRes] = await Promise.all([
            fetchTeamMembers(activeUserId, teamScope ?? null), fetchCoachingNotes(activeUserId),
            fetchAuditLinks(), fetchAllAssignments(), fetchLearningContentAuditTrail()]);
          if (teamRes.data)        setTeamData(teamRes.data);
          if (notesRes.data)       setCoachingNotes(notesRes.data);
          if (linksRes.data)       setAuditLinks(linksRes.data);
          if (assignmentsRes.data) setAssignments(assignmentsRes.data);
          if (auditRes.data)       setContentAudit(auditRes.data);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load learning data");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [userId, role, teamScope]);

  const completeModule = useCallback(async (moduleId: string) => {
    if (!userId) return;
    const mod = modules.find(m => m.id === moduleId);
    if (!mod || progress.completedModules.includes(moduleId)) return;
    const newCompleted = [...progress.completedModules, moduleId];
    const newXP = progress.xp + mod.xpReward;
    const newLevel = Math.max(0, (LEVEL_THRESHOLDS.findIndex(t => t > newXP) - 1 + LEVEL_THRESHOLDS.length) % LEVEL_THRESHOLDS.length);
    const newBadges = [...progress.badges];
    if (!newBadges.includes("First Module") && newCompleted.length === 1) newBadges.push("First Module");
    const updated: UserProgress = { ...progress, completedModules: newCompleted, xp: newXP, level: newLevel, badges: newBadges };
    setProgress(updated);
    await Promise.all([upsertUserProgress(userId, updated), incrementModuleCompletions(moduleId), checkAndGrantCertifications(userId, updated)]);
  }, [userId, modules, progress]);

  const completeQuiz = useCallback(async (quizId: string, score: number) => {
    if (!userId) return;
    const quiz = quizzes.find(q => q.id === quizId);
    if (!quiz) return;
    const passed = score >= quiz.passingScore;
    const prevScore = progress.quizScores[quizId] ?? 0;
    const bestScore = Math.max(prevScore, score);
    const newCompletedQuizzes = progress.completedQuizzes.includes(quizId) ? progress.completedQuizzes : [...progress.completedQuizzes, quizId];
    const xpEarned = passed && !progress.completedQuizzes.includes(quizId) ? quiz.xpReward : 0;
    const newBadges = [...progress.badges];
    if (score === 100 && !newBadges.includes("Perfect Score")) newBadges.push("Perfect Score");
    const updated: UserProgress = { ...progress, completedQuizzes: newCompletedQuizzes, quizScores: { ...progress.quizScores, [quizId]: bestScore }, xp: progress.xp + xpEarned, badges: newBadges };
    setProgress(updated);
    await Promise.all([upsertUserProgress(userId, updated), checkAndGrantCertifications(userId, updated)]);
  }, [userId, quizzes, progress]);

  const saveCoachingNoteWithId = useCallback(async (agentId: string, note: string, metric?: string, noteId?: string) => {
    if (!userId || !note.trim()) return;
    const res = await upsertCoachingNote({ supervisorId: userId, agentId, note, metric, id: noteId });
    if (res.data) setCoachingNotes(prev => [res.data!, ...prev.filter(n => n.id !== res.data!.id)]);
  }, [userId]);

  const saveCoachingNote = useCallback(async (agentId: string, note: string, metric?: string) => {
    await saveCoachingNoteWithId(agentId, note, metric);
  }, [saveCoachingNoteWithId]);

  const assignLearningContent = useCallback(async (input: { agentId: string; moduleId: string; contentType?: LearningAssignableType; contentId?: string; title?: string; dueDate?: string | null }) => {
    if (!userId) return;
    const res = await createAssignment({ agentId: input.agentId, moduleId: input.moduleId, assignedBy: userId, contentType: input.contentType ?? "module", contentId: input.contentId ?? input.moduleId, title: input.title, dueDate: input.dueDate ?? defaultDueDate(7) });
    if (res.data) {
      setAssignments(prev => [res.data!, ...prev.filter(item => item.id !== res.data!.id)]);
      if ((res.data.contentType ?? "module") === "module") setAssignedModuleIds(prev => new Set([...Array.from(prev), res.data!.moduleId]));
    }
  }, [userId]);

  const assignModule = useCallback(async (agentId: string, moduleId: string) => {
    await assignLearningContent({ agentId, moduleId, contentType: "module", contentId: moduleId });
  }, [assignLearningContent]);

  const toggleUpvote = useCallback(async (lessonId: string) => {
    if (!userId) return;
    const alreadyUpvoted = userUpvotes.has(lessonId);
    setUserUpvotes(prev => { const n = new Set(prev); alreadyUpvoted ? n.delete(lessonId) : n.add(lessonId); return n; });
    setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, upvotes: l.upvotes + (alreadyUpvoted ? -1 : 1) } : l));
    await toggleLessonUpvote(userId, lessonId, alreadyUpvoted);
  }, [userId, userUpvotes]);

  const handleCertificationEarned = useCallback(async (certId: string) => {
    if (!userId) return;
    if ((progress.certifications ?? []).some(c => c.id === certId)) return;
    const newCert: Certification = { id: certId, earnedAt: new Date().toISOString() };
    const updated: UserProgress = { ...progress, certifications: [...(progress.certifications ?? []), newCert] };
    setProgress(updated);
    await Promise.all([upsertUserProgress(userId, updated), checkAndGrantCertifications(userId, updated)]);
  }, [userId, progress]);

  const saveModule = useCallback(async (item: LearningModule) => {
    const res = await upsertLearningModule(item);
    if (res.data) setModules(prev => [res.data, ...prev.filter(e => e.id !== res.data.id)]);
  }, []);
  const removeModule = useCallback(async (id: string) => { await deleteLearningModule(id); setModules(prev => prev.filter(i => i.id !== id)); }, []);
  const saveSOP = useCallback(async (item: SOPDocument) => { const res = await upsertSOP(item); if (res.data) setSops(prev => [res.data, ...prev.filter(e => e.id !== res.data.id)]); }, []);
  const removeSOP = useCallback(async (id: string) => { await deleteSOP(id); setSops(prev => prev.filter(i => i.id !== id)); }, []);
  const saveWorkInstruction = useCallback(async (item: WorkInstruction) => { const res = await upsertWorkInstruction(item); if (res.data) setWorkInstructions(prev => [res.data, ...prev.filter(e => e.id !== res.data.id)]); }, []);
  const removeWorkInstruction = useCallback(async (id: string) => { await deleteWorkInstruction(id); setWorkInstructions(prev => prev.filter(i => i.id !== id)); }, []);
  const saveDefect = useCallback(async (item: DefectExample) => { const res = await upsertDefectExample(item); if (res.data) setDefects(prev => [res.data, ...prev.filter(e => e.id !== res.data.id)]); }, []);
  const removeDefect = useCallback(async (id: string) => { await deleteDefectExample(id); setDefects(prev => prev.filter(i => i.id !== id)); }, []);
  const saveStandard = useCallback(async (item: QualityStandard) => { const res = await upsertQualityStandard(item); if (res.data) setQualityStandards(prev => [res.data, ...prev.filter(e => e.id !== res.data.id)].sort((a,b) => b.min - a.min)); }, []);
  const removeStandard = useCallback(async (id: string) => { await deleteQualityStandard(id); setQualityStandards(prev => prev.filter(i => i.id !== id)); }, []);
  const saveOnboardingTrack = useCallback(async (item: OnboardingTrack) => { const res = await upsertOnboardingTrack(item); if (res.data) setOnboardingTracks(prev => [res.data, ...prev.filter(e => e.id !== res.data.id)]); }, []);
  const removeOnboardingTrack = useCallback(async (id: string) => { await deleteOnboardingTrack(id); setOnboardingTracks(prev => prev.filter(i => i.id !== id)); }, []);
  const saveBestPractice = useCallback(async (item: BestPractice) => { const res = await upsertBestPractice(item); if (res.data) setBestPractices(prev => [res.data, ...prev.filter(e => e.id !== res.data.id)]); }, []);
  const removeBestPractice = useCallback(async (id: string) => { await deleteBestPractice(id); setBestPractices(prev => prev.filter(i => i.id !== id)); }, []);
  const removeCoachingNote = useCallback(async (id: string) => { if (!userId) return; await deleteCoachingNote(userId, id); setCoachingNotes(prev => prev.filter(i => i.id !== id)); }, [userId]);
  const saveQuiz = useCallback(async (quiz: Quiz): Promise<Quiz | void> => { const res = await upsertQuiz(quiz, userId); if (res.data) { setQuizzes(prev => [res.data, ...prev.filter(i => i.id !== res.data.id)]); return res.data; } }, [userId]);
  const updateLearningAssignment = useCallback(async (assignment: LearningAssignment) => { const res = await updateAssignment(assignment); if (res.data) setAssignments(prev => [res.data!, ...prev.filter(i => i.id !== res.data!.id)]); }, []);
  const removeLearningAssignment = useCallback(async (assignment: LearningAssignment) => { await deleteAssignment(assignment); setAssignments(prev => prev.filter(i => i.id !== assignment.id)); }, []);
  const removeQuiz = useCallback(async (quizId: string) => { await deleteQuiz(quizId); setQuizzes(prev => prev.filter(i => i.id !== quizId)); }, []);

  return {
    modules, sops, workInstructions, defects, quizzes, lessons, bestPractices, qualityStandards,
    progress, teamData, coachingNotes, recommendations, auditLinks, onboardingTracks, userUpvotes,
    assignedModuleIds, assignments, contentAudit, loading, error,
    completeModule, completeQuiz, saveCoachingNote, assignModule, assignLearningContent, toggleUpvote,
    handleCertificationEarned, saveQuiz, removeQuiz, saveModule, removeModule, saveSOP, removeSOP,
    saveWorkInstruction, removeWorkInstruction, saveDefect, removeDefect, saveStandard, removeStandard,
    saveOnboardingTrack, removeOnboardingTrack, saveBestPractice, removeBestPractice,
    removeCoachingNote, saveCoachingNoteWithId, updateLearningAssignment, removeLearningAssignment,
  };
}

// ─── Module Detail Panel ──────────────────────────────────────────────────────

const ModuleDetailPanel = memo(function ModuleDetailPanel({
  module: mod, progress, quizzes, canTakeQuizzes, readOnly, onClose, onComplete, onStartQuiz,
}: {
  module: LearningModule; progress: UserProgress; quizzes: Quiz[]; canTakeQuizzes: boolean;
  readOnly?: boolean; onClose: () => void; onComplete: (id: string) => void; onStartQuiz: (qId: string) => void;
}) {
  const isCompleted = progress.completedModules.includes(mod.id);
  const relatedQuiz = useMemo(() => quizzes.find(q => q.moduleId === mod.id), [quizzes, mod.id]);
  const quizScore = relatedQuiz ? progress.quizScores[relatedQuiz.id] : undefined;
  const quizCompleted = relatedQuiz ? progress.completedQuizzes.includes(relatedQuiz.id) : false;

  return (
    <div className="lc-detail-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="lc-detail-panel">
        <div className="lc-detail-header">
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <DifficultyBadge difficulty={mod.difficulty} />
              <span className="lc-badge lc-badge-violet">{mod.category}</span>
              <XPPill xp={mod.xpReward} />
              {isCompleted && <CompletedPill />}
            </div>
            <button className="lc-detail-close" onClick={onClose}>✕</button>
          </div>
          <h2 style={{ fontSize:20, fontWeight:800, color:"var(--fg-default)", letterSpacing:"-0.025em", marginBottom:6, lineHeight:1.2 }}>{mod.title}</h2>
          <p style={{ fontSize:13, color:"var(--fg-muted)", lineHeight:1.6, margin:0 }}>{mod.description}</p>
          <div style={{ display:"flex", gap:14, marginTop:10, fontSize:11, color:"var(--fg-muted)", flexWrap:"wrap" }}>
            <span>🕐 {mod.durationMin} min</span>
            <span>👤 {mod.author}</span>
            <span>🔄 {mod.updatedAt}</span>
            <StarRating rating={mod.rating} />
            <span style={{ marginLeft:"auto" }}>{mod.completions} completions</span>
          </div>
          {isCompleted && (
            <div style={{ marginTop:12, height:3, borderRadius:999, background:"var(--border)", overflow:"hidden" }}>
              <div style={{ width:"100%", height:"100%", background:"var(--accent-emerald)", borderRadius:999 }} />
            </div>
          )}
        </div>
        <div className="lc-detail-body">
          {mod.videoUrl && (
            <div style={{ marginBottom:20, padding:"12px 14px", background:"var(--bg-subtle)", borderRadius:10, display:"flex", alignItems:"center", gap:10, border:"1px solid var(--border)" }}>
              <div style={{ width:36, height:36, borderRadius:9, background:"color-mix(in srgb,var(--accent-rose) 12%,transparent)", display:"grid", placeItems:"center", fontSize:16, flexShrink:0 }}>🎬</div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"var(--fg-default)", marginBottom:2 }}>Video Training Available</div>
                <a href={mod.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize:11, color:"var(--accent-blue)", textDecoration:"none" }}>Watch now →</a>
              </div>
            </div>
          )}
          <div className="lc-detail-content" dangerouslySetInnerHTML={{ __html: mod.content.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br/>") }} />
          {mod.steps && mod.steps.length > 0 && (
            <div style={{ marginTop:22 }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--fg-default)", marginBottom:10, letterSpacing:"0.02em" }}>Step-by-Step Instructions</div>
              <div className="lc-wi-steps">
                {mod.steps.map((step,i) => (
                  <div key={i} className="lc-wi-step">
                    <div className="lc-wi-step-num">{i+1}</div><span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mod.metrics && mod.metrics.length > 0 && (
            <div style={{ marginTop:22 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:8 }}>Related Metrics</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {mod.metrics.map(m => <span key={m} className="lc-badge lc-badge-cyan">{m}</span>)}
              </div>
            </div>
          )}
          <button
            className={`lc-complete-btn${isCompleted ? " done" : ""}`}
            disabled={isCompleted || readOnly}
            onClick={() => onComplete(mod.id)}
          >
            {readOnly ? "Preview only" : isCompleted ? "✓ Module Completed" : "Mark as Complete  ·  +" + mod.xpReward + " XP"}
          </button>
          {canTakeQuizzes && relatedQuiz && !quizCompleted && (
            <button className="lc-complete-btn"
              style={{ marginTop:10, background:"linear-gradient(135deg,var(--accent-cyan),var(--accent-blue))", boxShadow:"0 4px 14px color-mix(in srgb,var(--accent-cyan) 30%,transparent)" }}
              onClick={() => onStartQuiz(relatedQuiz.id)}
            >
              📝 Take Quiz — {relatedQuiz.title}
            </button>
          )}
          {canTakeQuizzes && relatedQuiz && quizCompleted && (
            <div style={{ marginTop:10, padding:"12px 16px", borderRadius:10, background:"color-mix(in srgb,var(--accent-emerald) 8%,transparent)", border:"1px solid color-mix(in srgb,var(--accent-emerald) 20%,transparent)", fontSize:12, color:"var(--accent-emerald)", fontWeight:700, textAlign:"center" }}>
              ✓ Quiz completed — Best score: {quizScore}%
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ─── Tab: Home ────────────────────────────────────────────────────────────────

const HomeTab = memo(function HomeTab({
  progress, modules, quizzes, sops, workInstructions, defects, lessons,
  recommendations, assignments, onTabChange, onSelectModule, onUpdateAssignment,
}: {
  progress: UserProgress; modules: LearningModule[]; quizzes: Quiz[];
  sops: SOPDocument[]; workInstructions: WorkInstruction[];
  defects: DefectExample[]; lessons: LessonLearned[]; recommendations: string[];
  assignments: LearningAssignment[];
  onTabChange: (t: LCTab) => void;
  onSelectModule: (m: LearningModule) => void;
  onUpdateAssignment: (a: LearningAssignment) => Promise<void> | void;
}) {
  const nextLevelXP = useMemo(() => {
    const next = LEVEL_THRESHOLDS[progress.level + 1];
    return next ? next - progress.xp : 0;
  }, [progress]);

  const pinned = useMemo(() => {
    const recMods = recommendations.map(id => modules.find(m => m.id === id)).filter(Boolean) as LearningModule[];
    const remaining = modules.filter(m => !progress.completedModules.includes(m.id) && !recMods.find(r => r.id === m.id));
    return [...recMods, ...remaining].slice(0, 3);
  }, [modules, progress.completedModules, recommendations]);

  const openAssignments = useMemo(
    () => assignments.filter(a => !["completed","verified","cancelled"].includes(a.status ?? "assigned")),
    [assignments]
  );

  const completionPct = modules.length
    ? Math.round((progress.completedModules.filter(id => modules.some(m => m.id === id)).length / modules.length) * 100)
    : 0;

  const quickLinks = [
    { tab:"sop" as LCTab,              icon:"📄", label:"SOPs",              sub:`${sops.length} docs`,          color:"var(--accent-blue)" },
    { tab:"work-instructions" as LCTab, icon:"📋", label:"Work Instructions", sub:`${workInstructions.length} guides`, color:"var(--accent-cyan)" },
    { tab:"defects" as LCTab,           icon:"⚠️", label:"Defect Examples",   sub:`${defects.length} examples`,    color:"var(--accent-rose)" },
    { tab:"lessons" as LCTab,           icon:"💡", label:"Lessons Learned",   sub:`${lessons.length} insights`,   color:"var(--accent-amber)" },
    { tab:"standards" as LCTab,         icon:"⭐", label:"Quality Standards", sub:"Scoring guide",                 color:"var(--accent-violet)" },
    { tab:"best-practices" as LCTab,    icon:"🌟", label:"Best Practices",    sub:"Top examples",                  color:"var(--accent-emerald)" },
  ];

  return (
    <div style={{ animation:"lcFadeUp 240ms ease both" }}>
      {/* Streak */}
      {progress.streak > 1 && (
        <div className="lc-streak-banner">
          <span>🔥</span>
          <span>{progress.streak}-day streak! Keep learning!</span>
          <div className="lc-streak-days">
            {Array.from({ length: Math.min(progress.streak, 7) }).map((_, i) => (
              <div key={i} className="lc-streak-day active" />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="lc-rec-banner">
          <span style={{ fontSize:16, flexShrink:0 }}>⚡</span>
          <span>
            <strong>Personalized for you — </strong>
            {recommendations.length} module{recommendations.length > 1 ? "s" : ""} flagged based on recent audit findings.
          </span>
        </div>
      )}

      {/* Open Assignments */}
      {openAssignments.length > 0 && (
        <div className="lc-assignments-banner" style={{ marginBottom:18 }}>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--fg-default)", display:"flex", alignItems:"center", gap:7 }}>
              <span>✅</span> Assigned by Supervisor
              <span className="lc-badge lc-badge-blue">{openAssignments.length}</span>
            </div>
            <div style={{ fontSize:11, color:"var(--fg-muted)", marginTop:2 }}>Complete these by their due dates.</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {openAssignments.slice(0, 4).map(a => {
              const mod = modules.find(m => m.id === a.moduleId || m.id === a.contentId);
              const quiz = quizzes.find(q => q.id === a.contentId);
              const title = a.title ?? mod?.title ?? quiz?.title ?? "Assigned training";
              const isQuiz = a.contentType === "quiz";
              const statusColor: Record<string, string> = { assigned:"var(--fg-muted)", in_progress:"var(--accent-blue)", completed:"var(--accent-emerald)" };
              return (
                <div key={a.id} className="lc-assignment-item" onClick={() => { isQuiz ? onTabChange("quizzes") : mod && onSelectModule(mod); }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:`color-mix(in srgb,var(--accent-blue) 12%,transparent)`, color:"var(--accent-blue)", display:"grid", placeItems:"center", fontSize:13, flexShrink:0 }}>{isQuiz ? "📝" : "📚"}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"var(--fg-default)", marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{title}</div>
                    <div style={{ fontSize:10, color:"var(--fg-muted)", display:"flex", gap:8 }}>
                      {a.dueDate && <span>Due {a.dueDate}</span>}
                      <span style={{ color: statusColor[a.status ?? "assigned"] ?? "var(--fg-muted)", fontWeight:600 }}>{a.status ?? "assigned"}</span>
                    </div>
                  </div>
                  <div className="lc-assignment-actions" onClick={e => e.stopPropagation()}>
                    {(a.status ?? "assigned") === "assigned" && (
                      <button className="lc-btn lc-btn-blue" onClick={() => onUpdateAssignment({ ...a, status:"in_progress" })}>Start</button>
                    )}
                    <button className="lc-btn lc-btn-blue" onClick={() => onUpdateAssignment({ ...a, status:"completed", completedAt: new Date().toISOString() })}>
                      Mark Complete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress Spotlight */}
      <div className="lc-spotlight" style={{ marginBottom:20 }}>
        <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:200 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--accent-violet)", marginBottom:8 }}>
              Your Progress
            </div>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:8 }}>
              <span style={{ fontSize:32, fontWeight:800, letterSpacing:"-0.04em", color:"var(--fg-default)", lineHeight:1 }}>{completionPct}%</span>
              <span style={{ fontSize:12, color:"var(--fg-muted)" }}>modules completed</span>
            </div>
            <div className="lc-prog-bar" style={{ marginBottom:8 }}>
              <div className="lc-prog-fill" style={{ width:`${completionPct}%` }} />
            </div>
            <div style={{ fontSize:11, color:"var(--fg-muted)" }}>
              {progress.completedModules.filter(id => modules.some(m => m.id === id)).length} of {modules.length} modules  ·  {nextLevelXP > 0 ? `${nextLevelXP} XP to Level ${progress.level + 1}` : "Max level reached!"}
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {progress.badges.length > 0 && (
              <div className="lc-badges-row" style={{ maxWidth:240, justifyContent:"flex-end", margin:0 }}>
                {progress.badges.slice(0,4).map(b => (
                  <div key={b} className="lc-achievement-badge">🏅 {b}</div>
                ))}
                {progress.badges.length > 4 && <div className="lc-achievement-badge">+{progress.badges.length - 4} more</div>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pinned */}
      <div className="lc-pinned">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--fg-default)" }}>📌 Pinned For You</div>
            <div style={{ fontSize:11, color:"var(--fg-muted)", marginTop:2 }}>
              {recommendations.length > 0 ? "Based on your audit findings" : "Assigned and recommended training"}
            </div>
          </div>
          <button className="lc-btn" onClick={() => onTabChange("modules")}>View all →</button>
        </div>
        <div className="lc-pinned-items">
          {pinned.map(mod => (
            <div key={mod.id} className="lc-pinned-item" onClick={() => onSelectModule(mod)}>
              <div className="lc-pinned-icon" style={{ background:"color-mix(in srgb,var(--accent-violet) 12%,transparent)", color:"var(--accent-violet)" }}>
                {recommendations.includes(mod.id) ? "⚡" : "📚"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div className="lc-pinned-item-title">{mod.title}</div>
                <div className="lc-pinned-item-sub">{mod.durationMin} min · {mod.difficulty}</div>
                <div style={{ marginTop:5 }}>
                  <div className="lc-prog-bar" style={{ height:2 }}>
                    <div className="lc-prog-fill" style={{ width: progress.completedModules.includes(mod.id) ? "100%" : "0%" }} />
                  </div>
                </div>
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

      {/* Quick Access */}
      <div>
        <div className="lc-section-header">
          <div className="lc-section-title">Quick Access</div>
        </div>
        <div className="lc-grid-sm">
          {quickLinks.map(({ tab, icon, label, sub, color }) => (
            <div key={tab} className="lc-quickaccess-card" onClick={() => onTabChange(tab)}>
              <div className="lc-quickaccess-icon" style={{ background:`color-mix(in srgb,${color} 12%,transparent)`, color }}>
                {icon}
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--fg-default)", marginBottom:2 }}>{label}</div>
              <div style={{ fontSize:11, color:"var(--fg-muted)" }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─── Tab: Modules ─────────────────────────────────────────────────────────────

const ModulesTab = memo(function ModulesTab({
  progress, modules, recommendations, onSelectModule,
}: {
  progress: UserProgress; modules: LearningModule[];
  recommendations: string[]; onSelectModule: (m: LearningModule) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterDiff, setFilterDiff] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  const categories = useMemo(() => {
    const cats = [...new Set(modules.map(m => m.category))].filter(Boolean);
    return cats;
  }, [modules]);

  const filtered = useMemo(() => modules.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.title.toLowerCase().includes(q) || m.tags?.some(t => t.toLowerCase().includes(q)) || m.description?.toLowerCase().includes(q);
    const matchDiff = filterDiff === "all" || m.difficulty === filterDiff;
    const matchCat = filterCat === "all" || m.category === filterCat;
    return matchSearch && matchDiff && matchCat;
  }), [modules, search, filterDiff, filterCat]);

  const completedCount = progress.completedModules.filter(id => modules.some(m => m.id === id)).length;
  const completionPct = modules.length ? Math.round((completedCount / modules.length) * 100) : 0;

  return (
    <>
      <div className="lc-section-header">
        <div>
          <div className="lc-section-title">Training Modules</div>
          <div className="lc-section-sub">{completedCount}/{modules.length} completed · {completionPct}%</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div className="lc-prog-bar" style={{ width:100 }}>
            <div className="lc-prog-fill" style={{ width:`${completionPct}%` }} />
          </div>
        </div>
      </div>

      <div className="lc-search-bar">
        <SearchSVG />
        <input className="lc-search-input" placeholder="Search by title, tag, or description…"
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:"var(--fg-muted)", cursor:"pointer", fontSize:13, padding:"0 2px" }}>✕</button>}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {["all","beginner","intermediate","advanced"].map(d => (
          <button key={d} className={`lc-tab-btn${filterDiff === d ? " active" : ""}`} onClick={() => setFilterDiff(d)}>
            {d === "all" ? "All levels" : d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
        {categories.length > 0 && (
          <>
            <span style={{ width:1, height:24, background:"var(--border)", alignSelf:"center", flexShrink:0 }} />
            {["all",...categories].slice(0, 6).map(c => (
              <button key={c} className={`lc-tab-btn${filterCat === c ? " active" : ""}`} onClick={() => setFilterCat(c)}>
                {c === "all" ? "All categories" : c}
              </button>
            ))}
          </>
        )}
      </div>

      {filtered.length === 0 && (
        <EmptyState icon="📚" title="No modules found" sub="Try adjusting your search or filters." />
      )}

      <div className="lc-grid">
        {filtered.map((mod, idx) => {
          const isCompleted = progress.completedModules.includes(mod.id);
          const isRecommended = recommendations.includes(mod.id);
          return (
            <div key={mod.id} className="lc-card" style={{ animation:`lcFadeUp ${160 + idx * 30}ms ease both`, ...(isRecommended ? { borderColor:"color-mix(in srgb,var(--accent-amber) 30%,transparent)" } : {}) }}
              onClick={() => onSelectModule(mod)}>
              {isCompleted && <div className="lc-completed-overlay" />}
              <div className="lc-card-icon" style={{ background:`color-mix(in srgb,var(--accent-violet) 10%,transparent)`, color:"var(--accent-violet)" }}>
                📚
              </div>
              <div className="lc-card-header" style={{ marginBottom:6 }}>
                <div className="lc-card-title">{mod.title}</div>
                <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                  {isRecommended && <span className="lc-badge lc-badge-amber">⚡</span>}
                  {isCompleted && <CompletedPill />}
                </div>
              </div>
              <div className="lc-card-desc">{mod.description}</div>
              <div className="lc-card-meta">
                <DifficultyBadge difficulty={mod.difficulty} />
                <span className="lc-badge lc-badge-muted">🕐 {mod.durationMin}m</span>
                <XPPill xp={mod.xpReward} />
              </div>
              <div className="lc-card-footer">
                <StarRating rating={mod.rating} />
                <span style={{ fontSize:10, color:"var(--fg-muted)" }}>{mod.completions} completions</span>
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
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => sops.filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase())), [sops, search]);

  return (
    <>
      <div className="lc-section-header">
        <div><div className="lc-section-title">SOP Library</div><div className="lc-section-sub">Version-controlled standard operating procedures</div></div>
      </div>
      <div className="lc-search-bar">
        <SearchSVG />
        <input className="lc-search-input" placeholder="Search SOPs…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {!filtered.length && <EmptyState icon="📄" title="No SOPs found" sub={sops.length ? "Try a different search." : "No SOPs have been added yet."} />}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.map(sop => (
          <div key={sop.id} className="lc-sop-card" style={{ animation:"lcFadeUp 200ms ease both" }}>
            <div className="lc-sop-header" onClick={() => setExpanded(expanded === sop.id ? null : sop.id)}>
              <div style={{ width:36, height:36, borderRadius:9, background:"color-mix(in srgb,var(--accent-emerald) 10%,transparent)", color:"var(--accent-emerald)", display:"grid", placeItems:"center", fontSize:15, flexShrink:0 }}>📄</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--fg-default)" }}>{sop.title}</div>
                <div className="lc-sop-version">
                  <span className="lc-badge lc-badge-cyan">v{sop.version}</span>
                  <span className="lc-badge lc-badge-muted">{sop.category}</span>
                  <span>Updated {sop.updatedAt}</span>
                  <span>by {sop.author}</span>
                </div>
              </div>
              <button className="lc-sop-toggle-btn">{expanded === sop.id ? "▲" : "▼"}</button>
            </div>
            {expanded === sop.id && (
              <div className="lc-sop-body" style={{ animation:"lcFadeUp 150ms ease both" }}>
                <div className="lc-detail-content" dangerouslySetInnerHTML={{ __html: sop.content.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br/>") }} />
                {sop.changeLog.length > 0 && (
                  <div className="lc-sop-changelog">
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:8 }}>Version History</div>
                    {sop.changeLog.map(e => (
                      <div key={e.version} className="lc-sop-changelog-item">
                        <span className="lc-sop-changelog-version">v{e.version}</span>
                        <span style={{ flexShrink:0 }}>{e.date}</span>
                        <span>{e.summary}</span>
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
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => workInstructions.filter(w => !search || w.title.toLowerCase().includes(search.toLowerCase())), [workInstructions, search]);
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Work Instructions</div><div className="lc-section-sub">Short, actionable step-by-step guides</div></div></div>
      <div className="lc-search-bar"><SearchSVG /><input className="lc-search-input" placeholder="Search work instructions…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      {!filtered.length && <EmptyState icon="📋" title="No work instructions" sub={workInstructions.length ? "Try a different search." : "No work instructions have been added yet."} />}
      <div className="lc-grid">
        {filtered.map(wi => (
          <div key={wi.id} className="lc-wi-card">
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:6 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"var(--fg-default)" }}>{wi.title}</div>
            </div>
            <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap" }}>
              <span className="lc-badge lc-badge-blue">{wi.metric}</span>
              <span className="lc-badge lc-badge-muted">{wi.category}</span>
            </div>
            <div style={{ fontSize:10, color:"var(--fg-muted)", marginBottom:2 }}>Updated {wi.updatedAt}</div>
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
  const [filter, setFilter] = useState<"all"|"low"|"medium"|"high"|"critical">("all");
  const filtered = useMemo(() => defects.filter(d => filter === "all" || d.severity === filter), [defects, filter]);
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Defect Examples Library</div><div className="lc-section-sub">Real audit-based examples showing correct vs incorrect behavior</div></div></div>
      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {(["all","low","medium","high","critical"] as const).map(s => (
          <button key={s} className={`lc-tab-btn${filter === s ? " active" : ""}`} onClick={() => setFilter(s)}>
            {s === "all" ? "All severities" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
      {!filtered.length && <EmptyState icon="⚠️" title="No defect examples" sub="No defects match the current filter." />}
      <div className="lc-grid">
        {filtered.map(defect => (
          <div key={defect.id} className="lc-defect-card">
            <div className="lc-defect-top">
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--fg-default)", marginBottom:6 }}>{defect.title}</div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  <span className="lc-badge lc-badge-blue">{defect.metric}</span>
                  <SeverityBadge severity={defect.severity} />
                </div>
              </div>
            </div>
            <div className="lc-defect-body">
              <div>
                <div className="lc-defect-label" style={{ color:"var(--accent-rose)" }}>❌ What Went Wrong</div>
                <div className="lc-defect-text">{defect.whatWentWrong}</div>
              </div>
              <div>
                <div className="lc-defect-label" style={{ color:"var(--accent-emerald)" }}>✅ Correct Behavior</div>
                <div className="lc-defect-text" style={{ background:"color-mix(in srgb,var(--accent-emerald) 5%,var(--bg-subtle))" }}>{defect.correctBehavior}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
});

// ─── Tab: Standards ───────────────────────────────────────────────────────────

const StandardsTab = memo(function StandardsTab({ standards }: { standards: QualityStandard[] }) {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Quality Standards</div><div className="lc-section-sub">Scoring tiers and metric definitions</div></div></div>
      <div className="lc-grid" style={{ marginBottom:28 }}>
        {standards.map(s => (
          <div key={s.name} className="lc-standard-card">
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:s.color }}>{s.name}</div>
            <div className="lc-standard-score" style={{ color:s.color }}>{s.min > 0 ? `${s.min}%+` : "<70%"}</div>
            <div className="lc-standard-bar"><div className="lc-standard-bar-fill" style={{ width:`${s.min > 0 ? s.min : 45}%`, background:s.color }} /></div>
            <div style={{ fontSize:12, color:"var(--fg-muted)", lineHeight:1.65, marginTop:8 }}>{s.desc}</div>
          </div>
        ))}
      </div>
      <div className="lc-section-header"><div className="lc-section-title">Metric Definitions</div></div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {[
          { name:"Return Label (RL)", desc:"Correct return label accuracy, timeliness, and channel adherence.", weight:"15%" },
          { name:"Ticket Documentation", desc:"Completeness, clarity, timeliness, and accuracy of all ticket notes.", weight:"20%" },
          { name:"First Contact Resolution", desc:"Issue fully resolved without follow-up contact.", weight:"25%" },
          { name:"Professionalism", desc:"Tone, language, empathy, and communication standard adherence.", weight:"20%" },
          { name:"Product Knowledge", desc:"Accuracy of product info, part numbers, and technical guidance.", weight:"20%" },
        ].map(metric => (
          <div key={metric.name} style={{ padding:"14px 18px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:12, display:"flex", alignItems:"flex-start", gap:14 }}>
            <div style={{ flexShrink:0, minWidth:54, textAlign:"center" }}>
              <div style={{ fontSize:17, fontWeight:800, color:"var(--accent-blue)", letterSpacing:"-0.03em" }}>{metric.weight}</div>
              <div style={{ fontSize:9, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--fg-muted)" }}>Weight</div>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"var(--fg-default)", marginBottom:4 }}>{metric.name}</div>
              <div style={{ fontSize:12, color:"var(--fg-muted)", lineHeight:1.65 }}>{metric.desc}</div>
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
  onboardingTracks: OnboardingTrack[]; onSelectModule: (m: LearningModule) => void;
}) {
  const badgeMap: Record<string, string> = { Agent:"lc-badge-blue", Supervisor:"lc-badge-violet", Admin:"lc-badge-rose", QA:"lc-badge-amber" };

  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Onboarding Tracks</div><div className="lc-section-sub">Role-based guided onboarding</div></div></div>
      {!onboardingTracks.length && <EmptyState icon="🎯" title="No onboarding tracks" sub="No tracks have been configured for your role yet." />}
      {onboardingTracks.map(track => {
        const steps = track.steps;
        const doneCount = steps.filter(s => s.moduleId && progress.completedModules.includes(s.moduleId)).length;
        const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;
        return (
          <div key={track.id} className="lc-onboarding-track">
            <div className="lc-onboarding-header">
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--fg-default)" }}>{track.label}</div>
                <div style={{ fontSize:11, color:"var(--fg-muted)", marginTop:2 }}>{track.subtitle}  ·  {doneCount}/{steps.length} complete</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span className={`lc-badge ${badgeMap[track.badgeLabel] ?? "lc-badge-muted"}`}>{track.badgeLabel}</span>
                <span style={{ fontSize:12, fontWeight:700, color:"var(--accent-violet)" }}>{pct}%</span>
              </div>
            </div>
            <div className="lc-onboarding-progress"><div className="lc-onboarding-progress-fill" style={{ width:`${pct}%` }} /></div>
            <ul style={{ listStyle:"none", padding:0, margin:0 }}>
              {steps.map((step, i) => {
                const mod = step.moduleId ? modules.find(m => m.id === step.moduleId) : null;
                const done = mod ? progress.completedModules.includes(mod.id) : false;
                return (
                  <li key={step.id} className={`lc-onboarding-step${done ? " completed" : ""}`} onClick={() => mod && onSelectModule(mod)}>
                    <div className={`lc-step-check${done ? " done" : ""}`}>{done ? "✓" : i+1}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"var(--fg-default)" }}>{step.title}</div>
                      <div style={{ fontSize:11, color:"var(--fg-muted)" }}>{step.description}</div>
                    </div>
                    {mod && <span style={{ fontSize:11, color:"var(--accent-blue)", flexShrink:0 }}>Open →</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </>
  );
});

// ─── Tab: Lessons Learned ─────────────────────────────────────────────────────

const LessonsTab = memo(function LessonsTab({
  lessons, userUpvotes, onToggleUpvote,
}: {
  lessons: LessonLearned[]; userUpvotes: Set<string>; onToggleUpvote: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const topics = useMemo(() => [...new Set(lessons.map(l => l.topic))].filter(Boolean), [lessons]);
  const filtered = useMemo(() => lessons.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.title.toLowerCase().includes(q) || l.insight.toLowerCase().includes(q);
    const matchTopic = filter === "all" || l.topic === filter;
    return matchSearch && matchTopic;
  }), [lessons, search, filter]);

  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Lessons Learned</div><div className="lc-section-sub">Insights from audits and performance reviews</div></div></div>
      <div className="lc-search-bar"><SearchSVG /><input className="lc-search-input" placeholder="Search lessons…" value={search} onChange={e => setSearch(e.target.value)} /></div>
      {topics.length > 0 && (
        <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
          {["all",...topics].map(t => (
            <button key={t} className={`lc-tab-btn${filter === t ? " active" : ""}`} onClick={() => setFilter(t)}>
              {t === "all" ? "All topics" : t}
            </button>
          ))}
        </div>
      )}
      {!filtered.length && <EmptyState icon="💡" title="No lessons found" sub={lessons.length ? "Try a different search." : "No lessons learned have been added yet."} />}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {filtered.map(lesson => {
          const isUpvoted = userUpvotes.has(lesson.id);
          return (
            <div key={lesson.id} className="lc-lesson-card">
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
                <div style={{ fontSize:14, fontWeight:700, color:"var(--fg-default)" }}>{lesson.title}</div>
                <span className="lc-badge lc-badge-cyan">{lesson.topic}</span>
              </div>
              <div className="lc-lesson-insight">{lesson.insight}</div>
              <div className="lc-lesson-meta">
                <span style={{ fontSize:11, color:"var(--fg-muted)" }}>Source: {lesson.source} · {lesson.dateAdded}</span>
                <button className={`lc-upvote-btn${isUpvoted ? " active" : ""}`} onClick={() => onToggleUpvote(lesson.id)}>
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
  auditLinks: AuditLink[]; modules: LearningModule[]; onSelectModule: (m: LearningModule) => void;
}) {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Audit Findings → Training</div><div className="lc-section-sub">Failed metrics linked to remedial training modules</div></div></div>
      {!auditLinks.length && <EmptyState icon="🔗" title="No audit links configured" sub="Audit metric → module mappings will appear here once configured." />}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {auditLinks.sort((a,b) => b.failRate - a.failRate).map(link => {
          const mod = modules.find(m => m.id === link.moduleId);
          const isHigh = link.failRate > 25;
          return (
            <div key={link.metric} className="lc-audit-row">
              <div style={{ flex:1, minWidth:160 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"var(--fg-default)", marginBottom:6 }}>{link.metric}</div>
                <div className="lc-audit-fail-bar" style={{ width:160 }}>
                  <div className="lc-audit-fail-fill" style={{ width:`${Math.min(link.failRate,100)}%`, background: isHigh ? "var(--accent-rose)" : "var(--accent-amber)" }} />
                </div>
                <div style={{ fontSize:11, fontWeight:700, color: isHigh ? "var(--accent-rose)" : "var(--accent-amber)", marginTop:4 }}>
                  {link.failRate > 0 ? `${link.failRate}% fail rate` : "No data yet"}
                </div>
              </div>
              {mod && (
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:11, color:"var(--fg-muted)" }}>→</span>
                  <button className="lc-btn lc-btn-blue" onClick={() => onSelectModule(mod)}>📚 {mod.title}</button>
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
  const [filter, setFilter] = useState("all");
  const categories = useMemo(() => [...new Set(bestPractices.map(b => b.category))].filter(Boolean), [bestPractices]);
  const filtered = useMemo(() => bestPractices.filter(b => filter === "all" || b.category === filter), [bestPractices, filter]);
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Best Practices</div><div className="lc-section-sub">Curated examples from top-performing agents</div></div></div>
      {categories.length > 0 && (
        <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
          {["all",...categories].map(c => (
            <button key={c} className={`lc-tab-btn${filter === c ? " active" : ""}`} onClick={() => setFilter(c)}>
              {c === "all" ? "All categories" : c}
            </button>
          ))}
        </div>
      )}
      {!filtered.length && <EmptyState icon="🌟" title="No best practices yet" sub="Best practices will appear here once added." />}
      <div className="lc-grid">
        {filtered.map(bp => (
          <div key={bp.id} className="lc-bp-card">
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8, marginBottom:4 }}>
              <div style={{ fontSize:14, fontWeight:700, color:"var(--fg-default)" }}>{bp.title}</div>
              <span className="lc-badge lc-badge-emerald">{bp.category}</span>
            </div>
            <div className="lc-bp-quote">"{bp.quote}"</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6, marginTop:4 }}>
              <span style={{ fontSize:11, color:"var(--fg-muted)" }}>— {bp.agentLabel}</span>
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
  progress, modules, quizzes,
}: { progress: UserProgress; modules: LearningModule[]; quizzes: Quiz[] }) {
  const completedCount = progress.completedModules.filter(id => modules.some(m => m.id === id)).length;
  const completionRate = modules.length ? Math.round((completedCount / modules.length) * 100) : 0;

  const avgQuizScore = useMemo(() => {
    const scores = Object.values(progress.quizScores) as number[];
    return scores.length ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
  }, [progress]);

  const passedQuizzes = useMemo(() => {
    return quizzes.filter(q => {
      const score = progress.quizScores[q.id];
      return score !== undefined && score >= q.passingScore;
    }).length;
  }, [quizzes, progress]);

  const levelPct = useMemo(() => {
    const cur = LEVEL_THRESHOLDS[progress.level] ?? 0;
    const next = LEVEL_THRESHOLDS[progress.level + 1] ?? cur + 1000;
    return Math.round(((progress.xp - cur) / (next - cur)) * 100);
  }, [progress]);

  const topModules = useMemo(() => [...modules].sort((a,b) => b.completions - a.completions).slice(0,5), [modules]);
  const maxCompletions = topModules[0]?.completions ?? 1;

  const weekDays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const mockActivity = [3,5,2,7,4,1,6];

  const stats = [
    { val:`${completionRate}%`, label:"Module Completion", color:"var(--accent-blue)", icon:"📚", delta:null },
    { val:`${avgQuizScore || "—"}%`, label:"Avg Quiz Score", color:"var(--accent-emerald)", icon:"📝", delta:null },
    { val:String(progress.xp), label:"Total XP", color:"var(--accent-violet)", icon:"⚡", delta:null },
    { val:String(progress.streak), label:"Day Streak", color:"var(--accent-amber)", icon:"🔥", delta:null },
    { val:LEVEL_NAMES[progress.level], label:`Level ${progress.level}`, color:LEVEL_COLORS[progress.level] ?? "var(--accent-violet)", icon:"🏆", delta:null },
    { val:`${passedQuizzes}/${quizzes.length}`, label:"Quizzes Passed", color:"var(--accent-cyan)", icon:"✓", delta:null },
  ];

  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Learning Analytics</div><div className="lc-section-sub">Your personal performance metrics</div></div></div>

      <div className="lc-analytics-grid">
        {stats.map((s, i) => (
          <div key={s.label} className="lc-stat-card" style={{ animation:`lcFadeUp ${120 + i*40}ms ease both` }}>
            <div style={{ fontSize:11, marginBottom:8 }}>{s.icon}</div>
            <div className="lc-stat-val" style={{ color:s.color }}>{s.val}</div>
            <div className="lc-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Level progress */}
      <div style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:14, padding:20, marginBottom:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--fg-default)" }}>Level Progress</div>
          <div style={{ fontSize:12, color:"var(--fg-muted)" }}>{progress.level < LEVEL_NAMES.length - 1 ? `${LEVEL_THRESHOLDS[progress.level+1] - progress.xp} XP to next level` : "Max level!"}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          {LEVEL_NAMES.map((name, i) => (
            <div key={name} style={{ flex:1, textAlign:"center" }}>
              <div style={{ width:"100%", height:6, borderRadius:4, background: i <= progress.level ? LEVEL_COLORS[i] : "var(--border)", transition:"background 400ms ease", marginBottom:4 }} />
              <div style={{ fontSize:9, color: i <= progress.level ? "var(--fg-default)" : "var(--fg-muted)", fontWeight:600 }}>{i}</div>
            </div>
          ))}
        </div>
        <div className="lc-prog-bar"><div className="lc-prog-fill" style={{ width:`${levelPct}%` }} /></div>
        <div style={{ fontSize:11, color:"var(--fg-muted)", marginTop:6 }}>{levelPct}% to Level {progress.level + 1}: {LEVEL_NAMES[progress.level + 1] ?? "Legend"}</div>
      </div>

      {/* Weekly activity */}
      <div style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:14, padding:20, marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"var(--fg-default)", marginBottom:16 }}>Weekly Activity</div>
        <div className="lc-chart-bar-wrap">
          {weekDays.map((day, i) => {
            const h = Math.max(4, Math.round((mockActivity[i] / 7) * 100));
            return (
              <div key={day} className="lc-chart-bar-col">
                <div className="lc-chart-bar" style={{ height:`${h}%`, background:i === 3 ? "var(--accent-violet)" : "color-mix(in srgb,var(--accent-violet) 35%,var(--border))" }} />
                <div className="lc-chart-label">{day}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Module engagement */}
      {topModules.length > 0 && (
        <div style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:14, padding:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:"var(--fg-default)", marginBottom:16 }}>Top Modules by Completions</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {topModules.map(mod => (
              <div key={mod.id} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--fg-default)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{mod.title}</div>
                <div style={{ width:120, height:6, borderRadius:999, background:"var(--border)", overflow:"hidden", flexShrink:0 }}>
                  <div style={{ width:`${Math.round((mod.completions / maxCompletions) * 100)}%`, height:"100%", background:"var(--accent-blue)", borderRadius:999, transition:"width 700ms cubic-bezier(0.16,1,0.3,1)" }} />
                </div>
                <div style={{ fontSize:11, color:"var(--fg-muted)", flexShrink:0, minWidth:36, textAlign:"right" }}>{mod.completions}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
});

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="lc-root">
      <div style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:18, padding:"28px 32px", marginBottom:20 }}>
        <div className="lc-skeleton" style={{ height:10, width:"15%", borderRadius:999, marginBottom:12 }} />
        <div className="lc-skeleton" style={{ height:24, width:"45%", marginBottom:8 }} />
        <div className="lc-skeleton" style={{ height:12, width:"65%" }} />
      </div>
      <div style={{ display:"flex", gap:4, marginBottom:20 }}>
        {[60,80,70,90,75,65,85,55].map((w,i) => (
          <div key={i} className="lc-skeleton" style={{ height:32, width:w, borderRadius:8 }} />
        ))}
      </div>
      <div className="lc-grid">
        {Array.from({ length: 6 }).map((_,i) => <SkeletonCard key={i} />)}
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
  const [globalSearch, setGlobalSearch] = useState("");
  const [showCmd, setShowCmd] = useState(false);
  const [previewRole, setPreviewRole] = useState<"agent"|"supervisor"|"qa"|"admin"|null>(null);
  const { toasts, add: addToast } = useToasts();

  // Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowCmd(prev => !prev); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const {
    modules, sops, workInstructions, defects, quizzes, lessons, bestPractices,
    qualityStandards, progress, teamData, coachingNotes, recommendations, auditLinks,
    onboardingTracks, userUpvotes, assignments, contentAudit, loading, error,
    completeModule, completeQuiz, assignLearningContent, toggleUpvote,
    handleCertificationEarned, saveQuiz, removeQuiz,
    saveModule, removeModule, saveSOP, removeSOP,
    saveWorkInstruction, removeWorkInstruction, saveDefect, removeDefect,
    saveStandard, removeStandard, saveOnboardingTrack, removeOnboardingTrack,
    saveBestPractice, removeBestPractice,
    removeCoachingNote, saveCoachingNoteWithId, updateLearningAssignment, removeLearningAssignment,
  } = useSupabaseLearning(userId, resolvedRole, currentUser?.team ?? null);

  const activeRole = previewRole ?? resolvedRole;
  const canManageLearning = resolvedRole === "admin" || resolvedRole === "qa" || resolvedRole === "supervisor";
  const isPreviewing = previewRole !== null;
  const isAdmin      = activeRole === "admin" || activeRole === "qa";
  const isSupervisor = activeRole === "supervisor";
  const isAgent      = activeRole === "agent";

  const isPublishedForAgent = useCallback((status?: string) => !status || status === "published", []);

  const roleModules = useMemo(() => modules.filter(m => {
    if (isAgent) return isPublishedForAgent(m.status) && (m.roles.includes("agent") || m.roles.includes("all"));
    if (isSupervisor) return m.roles.includes("supervisor") || m.roles.includes("agent") || m.roles.includes("all");
    return true;
  }), [modules, isAgent, isSupervisor, isPublishedForAgent]);

  const roleQuizzes = useMemo(() => quizzes.filter(q => {
    const status = q.status ?? "published";
    const audienceRoles: LearningRole[] =
      Array.isArray(q.audienceRoles) && q.audienceRoles.length > 0
        ? q.audienceRoles
        : ["all", "agent"];
    const audienceOk = audienceRoles.includes("all") || audienceRoles.includes(activeRole as LearningRole);
    const mod = q.moduleId ? modules.find(m => m.id === q.moduleId) : null;
    if (isAgent) {
      if (status !== "published" || !audienceOk) return false;
      return mod ? mod.roles.includes("agent") || mod.roles.includes("all") : true;
    }
    if (isSupervisor) return mod ? mod.roles.includes("supervisor") || mod.roles.includes("agent") || mod.roles.includes("all") : true;
    return true;
  }), [quizzes, modules, isAgent, isSupervisor, activeRole]);

  const earnedCertifications = useMemo<Certification[]>(() => progress.certifications ?? [], [progress.certifications]);

  const levelPct = useMemo(() => {
    const cur = LEVEL_THRESHOLDS[progress.level] ?? 0;
    const next = LEVEL_THRESHOLDS[progress.level + 1] ?? cur + 1000;
    return Math.round(((progress.xp - cur) / (next - cur)) * 100);
  }, [progress]);

  // Enhanced complete module with toast
  const handleCompleteModule = useCallback(async (moduleId: string) => {
    const mod = roleModules.find(m => m.id === moduleId);
    await completeModule(moduleId);
    if (mod) addToast({ type:"xp", title:"Module completed!", sub:`+${mod.xpReward} XP earned · ${mod.title}` });
  }, [completeModule, roleModules, addToast]);

  // Enhanced complete quiz with toast
  const handleQuizComplete = useCallback(async (quizId: string, score: number) => {
    const quiz = roleQuizzes.find(q => q.id === quizId);
    await completeQuiz(quizId, score);
    if (quiz) {
      const passed = score >= quiz.passingScore;
      addToast({ type: passed ? "success" : "info", title: passed ? `Quiz passed! ${score}%` : `Quiz score: ${score}%`, sub: passed ? `+${quiz.xpReward} XP earned` : `Passing score is ${quiz.passingScore}%` });
    }
    setActiveQuizId(null); setSelectedModule(null);
  }, [completeQuiz, roleQuizzes, addToast]);

  const searchResults = useMemo(() => {
    if (!globalSearch.trim()) return null;
    const q = globalSearch.toLowerCase();
    return {
      mods: roleModules.filter(m => m.title.toLowerCase().includes(q) || m.tags?.some(t => t.toLowerCase().includes(q)) || m.description?.toLowerCase().includes(q)),
      sops: sops.filter(s => s.title.toLowerCase().includes(q)),
      wis:  workInstructions.filter(w => w.title.toLowerCase().includes(q)),
      lessons: lessons.filter(l => l.title.toLowerCase().includes(q) || l.insight.toLowerCase().includes(q)),
    };
  }, [roleModules, sops, workInstructions, lessons, globalSearch]);

  const agentAllowed = useMemo<Set<LCTab>>(() => new Set(["home","modules","sop","work-instructions","defects","standards","onboarding","quizzes","certifications","lessons","audit-findings","best-practices"]), []);

  const TABS: { id: LCTab; label: string; icon: string; minRole?: string[] }[] = [
    { id:"home",              label:"Home",             icon:"🏠" },
    { id:"modules",           label:"Training",         icon:"📚" },
    { id:"sop",               label:"SOPs",             icon:"📄" },
    { id:"work-instructions", label:"Work Instructions",icon:"📋" },
    { id:"defects",           label:"Defect Examples",  icon:"⚠️" },
    { id:"standards",         label:"Standards",        icon:"⭐" },
    { id:"onboarding",        label:"Onboarding",       icon:"🎯" },
    { id:"quizzes",           label:"Quizzes",          icon:"📝" },
    { id:"certifications",    label:"Certifications",   icon:"🏆" },
    { id:"lessons",           label:"Lessons Learned",  icon:"💡" },
    { id:"audit-findings",    label:"Audit Findings",   icon:"🔗" },
    { id:"best-practices",    label:"Best Practices",   icon:"🌟" },
    { id:"analytics",         label:"Analytics",        icon:"📊" },
    { id:"health",            label:"Content Health",   icon:"🩺", minRole:["supervisor","admin","qa"] },
    { id:"coaching",          label:"Coaching",         icon:"👔", minRole:["supervisor","admin","qa"] },
  ];

  const visibleTabs = TABS.filter(tab => {
    if (isAgent && !agentAllowed.has(tab.id)) return false;
    if (tab.minRole && !tab.minRole.includes(resolvedRole)) return false;
    return true;
  });

  // Hero role label
  const roleLabel = isPreviewing ? `Previewing as ${activeRole}` : isAgent ? "Agent Learning Portal" : isSupervisor ? "Supervisor Team Hub" : "QA Learning Center";
  const heroSub = isAgent
    ? "Your personal training hub — modules, quizzes, SOPs, and certifications."
    : isSupervisor
    ? "Team training hub — coaching, assignments, team analytics, and supervisor resources."
    : "Centralized QA hub — content management, coaching, certifications, and analytics.";

  // Quiz render guard
  if (activeQuizId && isAgent) {
    const quiz = roleQuizzes.find(q => q.id === activeQuizId);
    if (quiz) return <QuizEngine quiz={quiz} onComplete={score => handleQuizComplete(activeQuizId, score)} onBack={() => setActiveQuizId(null)} />;
  }

  // Certification render guard
  if (showCerts) return (
    <CertificationTracker progress={progress} modules={roleModules} quizzes={roleQuizzes}
      earnedCertifications={earnedCertifications} onCertificationEarned={handleCertificationEarned}
      onBack={() => setShowCerts(false)} />
  );

  if (loading) return <LoadingSkeleton />;

  if (error) return (
    <div style={{ padding:"48px 24px", textAlign:"center" }}>
      <div style={{ fontSize:32, marginBottom:12 }}>⚠️</div>
      <div style={{ fontSize:16, fontWeight:700, color:"var(--fg-default)", marginBottom:6 }}>Failed to load Learning Center</div>
      <div style={{ fontSize:13, color:"var(--fg-muted)", marginBottom:20 }}>{error}</div>
      <button className="lc-btn lc-btn-primary" style={{ margin:"0 auto" }} onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  return (
    <div className="lc-root">
      {/* Command Palette */}
      {showCmd && (
        <CommandPalette
          modules={roleModules} sops={sops} workInstructions={workInstructions} quizzes={roleQuizzes}
          onClose={() => setShowCmd(false)}
          onSelectModule={m => { setSelectedModule(m); setShowCmd(false); }}
          onTabChange={tab => { if (tab === "certifications") { setShowCerts(true); setShowCmd(false); return; } setActiveTab(tab); setShowCmd(false); }}
        />
      )}

      {/* Hero */}
      <div className="lc-hero" style={{ animation:"lcFadeUp 200ms ease both" }}>
        <div className="lc-hero-bg" />
        <div className="lc-hero-content">
          <div style={{ flex:1, minWidth:0 }}>
            <div className="lc-hero-eyebrow">
              <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--accent-violet)", display:"inline-block" }} />
              {roleLabel}
            </div>
            <div className="lc-hero-title">Grow Your Skills 🚀</div>
            <div className="lc-hero-sub">{heroSub}</div>
          </div>
          <div className="lc-hero-stats">
            <div className="lc-hero-stat-cards">
              <div className="lc-stat-mini">
                <div className="lc-stat-mini-val" style={{ color:"var(--accent-violet)" }}>{progress.xp}</div>
                <div className="lc-stat-mini-label">Total XP</div>
              </div>
              <div className="lc-stat-mini">
                <div className="lc-stat-mini-val" style={{ color:"var(--accent-amber)" }}>{progress.streak}🔥</div>
                <div className="lc-stat-mini-label">Day Streak</div>
              </div>
            </div>
            <div className="lc-xp-ring-wrap">
              <ProgressRing pct={levelPct} color={LEVEL_COLORS[progress.level] ?? "var(--accent-violet)"} />
              <div className="lc-xp-ring-inner">
                <div className="lc-xp-ring-level">{progress.level}</div>
                <div className="lc-xp-ring-name">{LEVEL_NAMES[progress.level]}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Banner */}
      {canManageLearning && (
        <div className="lc-preview-bar">
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--fg-default)" }}>Preview & Publishing Controls</div>
            <div style={{ fontSize:11, color:"var(--fg-muted)", marginTop:1 }}>Preview role views before publishing content.</div>
          </div>
          <div className="lc-preview-roles">
            {(["agent","supervisor","qa","admin"] as const).map(role => (
              <button key={role} className={`lc-tab-btn${previewRole === role ? " active" : ""}`} onClick={() => setPreviewRole(role)}>
                Preview: {role}
              </button>
            ))}
            {previewRole && <button className="lc-tab-btn" onClick={() => setPreviewRole(null)}>✕ Exit Preview</button>}
          </div>
        </div>
      )}

      {/* Nav + Search */}
      <div className="lc-nav-wrap">
        <div className="lc-tab-scroll">
          {visibleTabs.map(tab => (
            <button key={tab.id}
              className={`lc-tab-btn${activeTab === tab.id && !globalSearch ? " active" : ""}`}
              onClick={() => {
                if (tab.id === "certifications") { setShowCerts(true); return; }
                setGlobalSearch(""); setActiveTab(tab.id);
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        <button className="lc-nav-search-btn" onClick={() => setShowCmd(true)}>
          <SearchSVG size={12} />
          <span>Search</span>
          <span className="lc-cmd-kbd">⌘K</span>
        </button>
      </div>

      {/* Global Search Input (inline) */}
      <div className="lc-search-bar" style={{ marginBottom:16 }}>
        <SearchSVG />
        <input className="lc-search-input" placeholder="Search everything — modules, SOPs, lessons, defects…"
          value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} />
        {globalSearch && <button onClick={() => setGlobalSearch("")} style={{ background:"none", border:"none", color:"var(--fg-muted)", cursor:"pointer", fontSize:14 }}>✕</button>}
      </div>

      {/* Global search results */}
      {searchResults && (
        <div style={{ marginBottom:24, animation:"lcFadeUp 160ms ease both" }}>
          {!searchResults.mods.length && !searchResults.sops.length && !searchResults.wis.length && !searchResults.lessons.length ? (
            <EmptyState icon="🔍" title={`No results for "${globalSearch}"`} sub="Try a different keyword or use the command palette (⌘K) to navigate." />
          ) : (
            <>
              {searchResults.mods.length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:8 }}>Training Modules</div>
                  <div className="lc-grid" style={{ marginBottom:16 }}>
                    {searchResults.mods.map(m => (
                      <div key={m.id} className="lc-card" onClick={() => setSelectedModule(m)}>
                        <div className="lc-card-title">{m.title}</div>
                        <div className="lc-card-desc">{m.description}</div>
                        <div className="lc-card-meta"><DifficultyBadge difficulty={m.difficulty} /><XPPill xp={m.xpReward} /></div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {searchResults.sops.length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:8 }}>SOPs</div>
                  {searchResults.sops.map(s => (
                    <div key={s.id} onClick={() => { setGlobalSearch(""); setActiveTab("sop"); }} style={{ padding:"12px 16px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:10, marginBottom:6, cursor:"pointer", transition:"border-color 120ms ease" }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"var(--fg-default)" }}>{s.title}</div>
                      <div style={{ fontSize:11, color:"var(--fg-muted)", marginTop:2 }}>v{s.version} · {s.category}</div>
                    </div>
                  ))}
                </>
              )}
              {searchResults.lessons.length > 0 && (
                <>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:8, marginTop:12 }}>Lessons Learned</div>
                  {searchResults.lessons.map(l => (
                    <div key={l.id} onClick={() => { setGlobalSearch(""); setActiveTab("lessons"); }} style={{ padding:"12px 16px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:10, marginBottom:6, cursor:"pointer" }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"var(--fg-default)" }}>{l.title}</div>
                      <div style={{ fontSize:11, color:"var(--fg-muted)", marginTop:2 }}>{l.topic}</div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab Content */}
      {!globalSearch && (
        <>
          {activeTab === "home" && (
            <HomeTab
              progress={progress} modules={roleModules} quizzes={roleQuizzes}
              sops={sops} workInstructions={workInstructions} defects={defects}
              lessons={lessons} recommendations={recommendations} assignments={assignments}
              onTabChange={tab => { if (tab === "certifications") { setShowCerts(true); return; } setActiveTab(tab); }}
              onSelectModule={setSelectedModule}
              onUpdateAssignment={updateLearningAssignment}
            />
          )}
          {activeTab === "modules" && (
            isAgent
              ? <ModulesTab progress={progress} modules={roleModules} recommendations={recommendations} onSelectModule={setSelectedModule} />
              : <LearningContentManager kind="modules" modules={modules} onSaveModule={saveModule} onDeleteModule={removeModule} />
          )}
          {activeTab === "sop" && (isAgent ? <SOPTab sops={sops} /> : <LearningContentManager kind="sops" sops={sops} onSaveSOP={saveSOP} onDeleteSOP={removeSOP} />)}
          {activeTab === "work-instructions" && (isAgent ? <WorkInstructionsTab workInstructions={workInstructions} /> : <LearningContentManager kind="work-instructions" workInstructions={workInstructions} onSaveWorkInstruction={saveWorkInstruction} onDeleteWorkInstruction={removeWorkInstruction} />)}
          {activeTab === "defects" && (isAgent ? <DefectsTab defects={defects} /> : <LearningContentManager kind="defects" defects={defects} onSaveDefect={saveDefect} onDeleteDefect={removeDefect} />)}
          {activeTab === "standards" && (isAgent ? <StandardsTab standards={qualityStandards} /> : <LearningContentManager kind="standards" standards={qualityStandards} onSaveStandard={saveStandard} onDeleteStandard={removeStandard} />)}
          {activeTab === "onboarding" && (
            isAgent
              ? <OnboardingTab progress={progress} modules={roleModules} onboardingTracks={onboardingTracks} onSelectModule={setSelectedModule} />
              : <LearningContentManager kind="onboarding" onboardingTracks={onboardingTracks} onSaveOnboardingTrack={saveOnboardingTrack} onDeleteOnboardingTrack={removeOnboardingTrack} />
          )}
          {activeTab === "quizzes" && (
            isAgent ? (
              <>
                <div className="lc-section-header"><div><div className="lc-section-title">Refresher Quizzes</div><div className="lc-section-sub">Test your knowledge and earn XP</div></div></div>
                {!roleQuizzes.length && <EmptyState icon="📝" title="No quizzes available" sub="Check back later — quizzes will appear here once published." />}
                <div className="lc-grid">
                  {roleQuizzes.map(quiz => {
                    const done = progress.completedQuizzes.includes(quiz.id);
                    const score = progress.quizScores[quiz.id];
                    const passed = done && score >= quiz.passingScore;
                    return (
                      <div key={quiz.id} className="lc-quiz-card">
                        <div className="lc-card-icon" style={{ background:"color-mix(in srgb,var(--accent-cyan) 10%,transparent)", color:"var(--accent-cyan)" }}>📝</div>
                        <div className="lc-card-header" style={{ marginBottom:6 }}>
                          <div className="lc-card-title">{quiz.title}</div>
                          {done && <span className={`lc-badge ${passed ? "lc-badge-emerald" : "lc-badge-amber"}`}>{score}%</span>}
                        </div>
                        <div className="lc-card-desc">{quiz.questions.length} questions · Pass: {quiz.passingScore}%</div>
                        <div className="lc-card-meta"><XPPill xp={quiz.xpReward} /></div>
                        {done && (
                          <div className="lc-quiz-score-bar">
                            <div className="lc-quiz-score-fill" style={{ width:`${score}%`, background: passed ? "var(--accent-emerald)" : "var(--accent-amber)" }} />
                          </div>
                        )}
                        <button
                          className="lc-complete-btn"
                          style={{ marginTop:14, ...(done ? { background:"var(--bg-subtle)", color:"var(--fg-muted)", boxShadow:"none" } : { background:"linear-gradient(135deg,var(--accent-cyan),var(--accent-blue))", boxShadow:"0 4px 14px color-mix(in srgb,var(--accent-cyan) 28%,transparent)" }) }}
                          disabled={isPreviewing}
                          onClick={() => !isPreviewing && setActiveQuizId(quiz.id)}
                        >
                          {isPreviewing ? "Preview only" : done ? "Retake Quiz" : "Start Quiz →"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <QuizManager quizzes={roleQuizzes} modules={roleModules} currentRole={resolvedRole} onSaveQuiz={saveQuiz} onDeleteQuiz={removeQuiz} />
            )
          )}
          {activeTab === "lessons" && <LessonsTab lessons={lessons} userUpvotes={userUpvotes} onToggleUpvote={toggleUpvote} />}
          {activeTab === "audit-findings" && <AuditFindingsTab auditLinks={auditLinks} modules={roleModules} onSelectModule={setSelectedModule} />}
          {activeTab === "best-practices" && (isAgent ? <BestPracticesTab bestPractices={bestPractices} /> : <LearningContentManager kind="best-practices" bestPractices={bestPractices} onSaveBestPractice={saveBestPractice} onDeleteBestPractice={removeBestPractice} />)}
          {activeTab === "analytics" && <AnalyticsTab progress={progress} modules={roleModules} quizzes={roleQuizzes} />}
          {activeTab === "health" && canManageLearning && (
            <LearningContentHealth
              modules={modules} sops={sops} workInstructions={workInstructions} defects={defects}
              standards={qualityStandards} onboardingTracks={onboardingTracks} quizzes={quizzes}
              bestPractices={bestPractices} teamData={teamData} coachingNotes={coachingNotes}
              assignments={assignments} auditLinks={auditLinks} auditTrail={contentAudit}
              onOpenTab={setActiveTab} onPreviewRole={setPreviewRole}
            />
          )}
          {activeTab === "coaching" && (isSupervisor || isAdmin) && (
            <LearningContentManager
              kind="coaching" teamData={teamData} coachingNotes={coachingNotes}
              modules={roleModules} quizzes={roleQuizzes} assignments={assignments}
              onCreateAssignment={assignLearningContent} onUpdateAssignment={updateLearningAssignment}
              onDeleteAssignment={removeLearningAssignment} onSaveCoachingNote={saveCoachingNoteWithId}
              onDeleteCoachingNote={removeCoachingNote}
            />
          )}
        </>
      )}

      {/* Module Detail Panel */}
      {selectedModule && (
        <ModuleDetailPanel
          module={selectedModule} progress={progress} quizzes={roleQuizzes}
          canTakeQuizzes={isAgent && !isPreviewing} readOnly={isPreviewing}
          onClose={() => setSelectedModule(null)}
          onComplete={handleCompleteModule}
          onStartQuiz={qId => { setSelectedModule(null); setActiveQuizId(qId); }}
        />
      )}

      {/* Toast Notifications */}
      <ToastRegion toasts={toasts} />
    </div>
  );
}
