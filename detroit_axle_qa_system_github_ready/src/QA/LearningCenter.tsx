import { useState, useCallback, useMemo, memo, useEffect } from "react";
import TrainingModule from "./TrainingModule";
import QuizEngine from "./QuizEngine";
import CertificationTracker from "./CertificationTracker";

// ─── Types ───────────────────────────────────────────────────

export type LCTab =
  | "home" | "modules" | "sop" | "work-instructions" | "defects"
  | "standards" | "onboarding" | "quizzes" | "certifications"
  | "lessons" | "audit-findings" | "best-practices" | "analytics" | "coaching";

export interface LearningModule {
  id: string; title: string; description: string; category: string;
  tags: string[]; content: string; videoUrl?: string; steps?: string[];
  durationMin: number; difficulty: "beginner" | "intermediate" | "advanced";
  roles: string[]; metrics?: string[]; completions: number; rating: number;
  createdAt: string; updatedAt: string; author: string; xpReward: number;
}

export interface SOPDocument {
  id: string; title: string; version: string; author: string;
  updatedAt: string; content: string; category: string;
  changeLog: { version: string; date: string; summary: string }[];
}

export interface WorkInstruction {
  id: string; title: string; metric: string; steps: string[]; category: string; updatedAt: string;
}

export interface DefectExample {
  id: string; title: string; metric: string; whatWentWrong: string;
  correctBehavior: string; severity: "low" | "medium" | "high" | "critical";
  category: string; dateAdded: string;
}

export interface Quiz {
  id: string; title: string; moduleId?: string; questions: QuizQuestion[];
  passingScore: number; xpReward: number; attempts?: number; bestScore?: number;
}

export interface QuizQuestion {
  id: string; question: string; options: string[]; correctIndex: number; explanation: string;
}

export interface Certification {
  id: string; title: string; description: string; requiredModules: string[];
  requiredQuizzes: string[]; roles: string[]; isCompleted: boolean;
  completedAt?: string; expiresAt?: string;
}

export interface LessonLearned {
  id: string; title: string; insight: string; topic: string;
  source: string; dateAdded: string; upvotes: number;
}

export interface UserProgress {
  completedModules: string[]; completedQuizzes: string[];
  quizScores: Record<string, number>; xp: number; level: number;
  badges: string[]; streak: number; lastActiveDate: string;
}

// ─── Mock Data ────────────────────────────────────────────────

export const MOCK_MODULES: LearningModule[] = [
  {
    id: "mod-1", title: "Return Label (RL) Excellence",
    description: "Master the art of providing accurate return labels and exceeding customer expectations.",
    category: "Core Skills", tags: ["returns", "rl", "customer-service"],
    content: `Return labels are a critical touchpoint in our customer journey.\n\n**Why This Matters**\nReturn labels are one of our most audited metrics. Failing to provide timely, correct RL information is the #1 driver of low QA scores.\n\n**Key Principles**\n1. Always confirm the customer's order number before generating a label.\n2. Verify the return window has not elapsed.\n3. Send the label via the customer's preferred channel.\n4. Follow up with a confirmation message.\n5. Document the return in the ticketing system within 5 minutes.`,
    steps: ["Greet the customer and confirm identity","Pull up their order","Verify return eligibility window","Generate the return label from the portal","Send via email or SMS based on preference","Log the interaction in the ticket","Confirm receipt with customer"],
    videoUrl: "https://example.com/rl-training",
    durationMin: 15, difficulty: "beginner", roles: ["agent","supervisor"],
    metrics: ["Return Label (RL)","Customer Satisfaction"], completions: 142, rating: 4.7,
    createdAt: "2024-10-01", updatedAt: "2025-03-15", author: "QA Team", xpReward: 100,
  },
  {
    id: "mod-2", title: "Ticket Documentation Standards",
    description: "Learn how to write clear, complete, and audit-ready ticket notes.",
    category: "Documentation", tags: ["tickets","documentation","notes"],
    content: `Proper ticket documentation is the backbone of our QA system.\n\n**Documentation Pillars**\n- **Completeness**: Every action taken must be recorded\n- **Clarity**: Write for a reader who has zero context\n- **Timeliness**: Update within 5 minutes of interaction end\n- **Accuracy**: No assumptions, only facts`,
    steps: ["Open the ticket immediately upon contact","Record customer name and contact reason","Document each step in real time","Note any promises or commitments made","Update status and sub-status correctly","Add follow-up tasks if applicable","Close with resolution summary"],
    durationMin: 20, difficulty: "beginner", roles: ["agent"],
    metrics: ["Ticket Notes","Documentation Quality"], completions: 198, rating: 4.5,
    createdAt: "2024-09-15", updatedAt: "2025-02-20", author: "QA Team", xpReward: 100,
  },
  {
    id: "mod-3", title: "Handling Escalations Professionally",
    description: "Advanced techniques for de-escalating situations and retaining customer trust.",
    category: "Advanced Skills", tags: ["escalation","de-escalation","advanced"],
    content: `Escalations are opportunities, not failures.\n\n**The CALM Framework**\n- **C**onfirm their frustration is valid\n- **A**cknowledge the impact on them\n- **L**isten without interrupting\n- **M**ove toward solution`,
    steps: ["Stay calm and lower your vocal tone","Acknowledge customer feelings explicitly","Apologize for the experience","Ask clarifying questions","Offer a concrete solution or timeline","Confirm agreement before closing","Document the escalation details"],
    durationMin: 30, difficulty: "advanced", roles: ["agent","supervisor"],
    metrics: ["Escalation Handling","CSAT"], completions: 87, rating: 4.9,
    createdAt: "2024-11-01", updatedAt: "2025-04-01", author: "Training Team", xpReward: 200,
  },
  {
    id: "mod-4", title: "Product Knowledge: Brake Systems",
    description: "Deep dive into Detroit Axle's brake product line to better assist customers.",
    category: "Product Knowledge", tags: ["product","brakes","technical"],
    content: `Understanding our products allows you to answer customer questions with confidence.\n\n**Brake System Overview**\nDetroit Axle manufactures complete brake kits including rotors, pads, calipers, and hardware.`,
    steps: ["Study the brake system diagram","Learn part number conventions","Understand compatibility by vehicle year/make/model","Practice using the part lookup tool","Review common installation questions"],
    durationMin: 25, difficulty: "intermediate", roles: ["agent"],
    metrics: ["Product Knowledge","First Contact Resolution"], completions: 115, rating: 4.3,
    createdAt: "2024-12-01", updatedAt: "2025-01-10", author: "Product Team", xpReward: 150,
  },
  {
    id: "mod-5", title: "Supervisor Coaching Fundamentals",
    description: "Build your coaching toolkit to drive agent performance and quality.",
    category: "Leadership", tags: ["coaching","leadership","supervisor"],
    content: `Effective coaching is the most powerful lever a supervisor has.\n\n**SBI Framework**: Situation → Behavior → Impact\n\nSet SMART goals collaboratively and follow up consistently.`,
    steps: ["Review agent audit data before each session","Identify 1-2 focus areas per session","Use SBI framework","Set SMART goals collaboratively","Schedule follow-up check-ins","Document coaching notes"],
    durationMin: 45, difficulty: "intermediate", roles: ["supervisor"],
    metrics: ["Team Quality Score","Agent Improvement Rate"], completions: 43, rating: 4.8,
    createdAt: "2025-01-15", updatedAt: "2025-03-20", author: "Leadership Team", xpReward: 250,
  },
];

export const MOCK_SOPS: SOPDocument[] = [
  {
    id: "sop-1", title: "Return & Exchange Process SOP", version: "3.2",
    author: "Operations Team", updatedAt: "2025-03-01", category: "Returns",
    content: `**Purpose**: Ensure consistent handling of all return and exchange requests.\n\n**Procedure**:\n1. Verify customer identity and order details\n2. Confirm return eligibility per policy\n3. Generate return label through portal\n4. Communicate return instructions clearly\n5. Process refund or exchange as appropriate\n6. Document in ticket within 5 minutes`,
    changeLog: [
      { version: "3.2", date: "2025-03-01", summary: "Updated portal URL and refund timeline" },
      { version: "3.1", date: "2024-11-15", summary: "Added exchange workflow" },
      { version: "3.0", date: "2024-08-01", summary: "Major revision to align with new policy" },
    ],
  },
  {
    id: "sop-2", title: "Ticket Escalation SOP", version: "2.1",
    author: "QA Team", updatedAt: "2025-02-10", category: "Escalations",
    content: `**Purpose**: Define when and how to escalate customer tickets.\n\n**Escalation Triggers**:\n- Customer requests supervisor\n- Issue cannot be resolved in first contact\n- Refund over $200 required\n- Legal or compliance concern`,
    changeLog: [
      { version: "2.1", date: "2025-02-10", summary: "Lowered auto-escalation threshold to $200" },
      { version: "2.0", date: "2024-06-01", summary: "Redesigned escalation matrix" },
    ],
  },
  {
    id: "sop-3", title: "Quality Audit Scoring Guide SOP", version: "1.5",
    author: "QA Lead", updatedAt: "2025-04-01", category: "Quality",
    content: `**Purpose**: Ensure consistent, fair, and accurate scoring across all QA auditors.\n\n**Scoring Philosophy**: Scores reflect the customer experience, not effort.`,
    changeLog: [
      { version: "1.5", date: "2025-04-01", summary: "Added AI-review scoring criteria" },
      { version: "1.4", date: "2024-12-01", summary: "Updated ticket note requirements" },
    ],
  },
];

export const MOCK_WORK_INSTRUCTIONS: WorkInstruction[] = [
  {
    id: "wi-1", title: "How to Generate a Return Label", metric: "Return Label (RL)",
    category: "Returns", updatedAt: "2025-02-15",
    steps: ["Log into the returns portal","Enter the customer's order number","Select the item(s) being returned","Choose return reason from dropdown","Click 'Generate Label'","Download the PDF label","Send via email using ticket template"],
  },
  {
    id: "wi-2", title: "How to Process a Warranty Claim", metric: "Warranty Handling",
    category: "Warranty", updatedAt: "2025-01-20",
    steps: ["Verify purchase date is within warranty period","Confirm defect matches warranty coverage","Request photo evidence from customer","Submit claim through warranty portal","Issue replacement or refund","Notify customer within 24 hours"],
  },
  {
    id: "wi-3", title: "How to Update Ticket Status Correctly", metric: "Ticket Documentation",
    category: "Documentation", updatedAt: "2025-03-10",
    steps: ["Open the ticket from the queue","Read all previous notes before acting","Update Status field","Add detailed notes describing your actions","Set a follow-up date if pending","Save and confirm the update"],
  },
];

export const MOCK_DEFECTS: DefectExample[] = [
  {
    id: "def-1", title: "Return Label Sent to Wrong Email", metric: "Return Label (RL)",
    whatWentWrong: "Agent sent the return label to an old email on file without confirming with the customer first. Customer never received it and had to call back.",
    correctBehavior: "Always confirm the customer's preferred email or communication channel before sending. Read back the email address if needed.",
    severity: "high", category: "Returns", dateAdded: "2025-02-01",
  },
  {
    id: "def-2", title: "Missing Ticket Notes After Call", metric: "Ticket Documentation",
    whatWentWrong: "Agent closed the ticket immediately after the call with only 'Resolved' as the note. No actions taken, no promises made, no resolution summary.",
    correctBehavior: "Every ticket must have a complete note: what the customer contacted for, what actions were taken, what was communicated, and the resolution.",
    severity: "critical", category: "Documentation", dateAdded: "2025-01-15",
  },
  {
    id: "def-3", title: "Incorrect Part Number Provided", metric: "Product Knowledge",
    whatWentWrong: "Agent provided a part number from memory without verifying in the system. Customer ordered wrong part, causing a return and negative review.",
    correctBehavior: "Always verify part numbers using the official lookup tool. Never quote from memory. Confirm compatibility before providing.",
    severity: "high", category: "Product Knowledge", dateAdded: "2025-03-05",
  },
];

export const MOCK_QUIZZES: Quiz[] = [
  {
    id: "quiz-1", title: "Return Label Process Quiz", moduleId: "mod-1",
    passingScore: 80, xpReward: 50,
    questions: [
      {
        id: "q1", question: "What is the FIRST step when a customer requests a return label?",
        options: ["Generate the label immediately","Confirm customer identity and order number","Check if the item is returnable","Ask for the reason for return"],
        correctIndex: 1, explanation: "Always confirm identity and order details first to ensure you're helping the right customer.",
      },
      {
        id: "q2", question: "How soon must you document a return interaction in the ticket?",
        options: ["Within 1 hour","Within 30 minutes","Within 5 minutes","By end of shift"],
        correctIndex: 2, explanation: "Tickets must be updated within 5 minutes of interaction end.",
      },
      {
        id: "q3", question: "A customer requests a return on day 32 and your policy is 30 days. What do you do?",
        options: ["Automatically deny the return","Process it without mentioning the window","Verify the window, then escalate to supervisor","Tell the customer to contact the manufacturer"],
        correctIndex: 2, explanation: "Out-of-window requests should be escalated for supervisor review.",
      },
    ],
  },
  {
    id: "quiz-2", title: "Documentation Standards Quiz", moduleId: "mod-2",
    passingScore: 75, xpReward: 50,
    questions: [
      {
        id: "q1", question: "Which is the BEST example of a ticket note?",
        options: ["Resolved","Spoke to customer","Customer called requesting return label for order #DA-12345. Verified return eligibility. Generated and emailed label to john@email.com. Customer confirmed receipt.","Return label sent"],
        correctIndex: 2, explanation: "Good notes include: who called, why they called, what you did, and the outcome.",
      },
      {
        id: "q2", question: "Documentation should be written for:",
        options: ["Your supervisor only","A reader with zero context about the interaction","The QA auditor","Yourself as a reminder"],
        correctIndex: 1, explanation: "Write notes as if the reader has never seen the ticket before — they need full context.",
      },
    ],
  },
];

export const MOCK_LESSONS: LessonLearned[] = [
  {
    id: "lesson-1", title: "Confirming Email Before Sending Saves Callbacks",
    insight: "Teams that verbally confirm the email address before sending return labels see a 40% reduction in 'label not received' callbacks. This 10-second step prevents a 5-minute callback.",
    topic: "Returns", source: "Q1 2025 Audit Analysis", dateAdded: "2025-02-15", upvotes: 24,
  },
  {
    id: "lesson-2", title: "Real-Time Ticket Notes Reduce AHT",
    insight: "Agents who type notes during the call (not after) have 18% lower average handle time on follow-up contacts. Customers get faster resolution when the next agent has complete context.",
    topic: "Documentation", source: "Team Performance Review", dateAdded: "2025-01-20", upvotes: 31,
  },
  {
    id: "lesson-3", title: "The CALM Framework Cuts Escalations",
    insight: "After training on the CALM de-escalation framework, the pilot team saw escalation rates drop by 22% in 6 weeks. The key is validating feelings before moving to solutions.",
    topic: "Escalations", source: "Pilot Team Coaching Study", dateAdded: "2025-03-01", upvotes: 19,
  },
];

const MOCK_USER_PROGRESS: UserProgress = {
  completedModules: ["mod-1", "mod-2"], completedQuizzes: ["quiz-1"],
  quizScores: { "quiz-1": 100 }, xp: 350, level: 4,
  badges: ["First Module", "Perfect Score", "3-Day Streak"], streak: 5,
  lastActiveDate: new Date().toISOString().split("T")[0],
};

const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1500, 2500];
const LEVEL_NAMES = ["Rookie","Learner","Practitioner","Specialist","Expert","Master","Legend"];

// ─── CSS ─────────────────────────────────────────────────────

const LC_CSS_ID = "da-learning-center-v1";
const LC_CSS = `
.lc-root { display:flex;flex-direction:column;gap:0;min-height:100%;animation:fadeUp 220ms ease both; }
.lc-hero { background:linear-gradient(135deg,color-mix(in srgb,var(--accent-violet) 12%,var(--bg-elevated)) 0%,color-mix(in srgb,var(--accent-blue) 8%,var(--bg-elevated)) 50%,color-mix(in srgb,var(--accent-cyan) 6%,var(--bg-elevated)) 100%);border:1px solid var(--border);border-radius:16px;padding:28px 32px;margin-bottom:24px;position:relative;overflow:hidden; }
.lc-hero::before { content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 80% 50%,color-mix(in srgb,var(--accent-violet) 10%,transparent),transparent);pointer-events:none; }
.lc-hero-inner { position:relative;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap; }
.lc-hero-title { font-size:24px;font-weight:800;letter-spacing:-0.03em;color:var(--fg-default);margin-bottom:6px; }
.lc-hero-sub { font-size:13px;color:var(--fg-muted);max-width:480px; }
.lc-hero-xp { display:flex;align-items:center;gap:16px;flex-shrink:0; }
.lc-xp-card { background:var(--bg-overlay);border:1px solid var(--border-strong);border-radius:12px;padding:12px 18px;text-align:center;min-width:90px; }
.lc-xp-val { font-size:22px;font-weight:800;letter-spacing:-0.03em;color:var(--accent-violet); }
.lc-xp-label { font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--fg-muted);margin-top:2px; }
.lc-progress-ring-wrap { position:relative;width:72px;height:72px;flex-shrink:0; }
.lc-progress-ring-label { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center; }
.lc-progress-ring-level { font-size:18px;font-weight:800;color:var(--fg-default);line-height:1; }
.lc-progress-ring-name { font-size:8px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--fg-muted);margin-top:2px; }
.lc-tab-nav { display:flex;flex-wrap:wrap;gap:4px;margin-bottom:24px; }
.lc-tab-btn { display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:8px;border:1px solid transparent;background:transparent;color:var(--fg-muted);font-size:12px;font-weight:500;font-family:inherit;cursor:pointer;transition:all 120ms ease;white-space:nowrap; }
.lc-tab-btn:hover { color:var(--fg-default);background:var(--bg-subtle-hover); }
.lc-tab-btn.active { color:var(--accent-violet);background:color-mix(in srgb,var(--accent-violet) 10%,transparent);border-color:color-mix(in srgb,var(--accent-violet) 20%,transparent);font-weight:600; }
.lc-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px; }
.lc-grid-sm { display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px; }
.lc-card { background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:20px;transition:border-color 140ms ease,box-shadow 140ms ease,transform 140ms ease;cursor:pointer; }
.lc-card:hover { border-color:var(--border-strong);box-shadow:var(--shadow-md);transform:translateY(-1px); }
.lc-card-header { display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px; }
.lc-card-title { font-size:14px;font-weight:700;color:var(--fg-default);letter-spacing:-0.01em;line-height:1.3; }
.lc-card-desc { font-size:12px;color:var(--fg-muted);line-height:1.6;margin-bottom:14px; }
.lc-card-meta { display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
.lc-badge { display:inline-flex;align-items:center;gap:3px;height:20px;padding:0 8px;border-radius:5px;font-size:10px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap; }
.lc-badge-violet { background:color-mix(in srgb,var(--accent-violet) 12%,transparent);color:var(--accent-violet); }
.lc-badge-blue { background:color-mix(in srgb,var(--accent-blue) 12%,transparent);color:var(--accent-blue); }
.lc-badge-cyan { background:color-mix(in srgb,var(--accent-cyan) 12%,transparent);color:var(--accent-cyan); }
.lc-badge-amber { background:color-mix(in srgb,var(--accent-amber) 12%,transparent);color:var(--accent-amber); }
.lc-badge-rose { background:color-mix(in srgb,var(--accent-rose) 12%,transparent);color:var(--accent-rose); }
.lc-badge-emerald { background:color-mix(in srgb,var(--accent-emerald) 12%,transparent);color:var(--accent-emerald); }
.lc-badge-muted { background:var(--bg-subtle);color:var(--fg-muted); }
.lc-section-header { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px; }
.lc-section-title { font-size:16px;font-weight:700;letter-spacing:-0.02em;color:var(--fg-default); }
.lc-section-sub { font-size:12px;color:var(--fg-muted);margin-top:2px; }
.lc-pinned { background:linear-gradient(135deg,color-mix(in srgb,var(--accent-amber) 8%,var(--bg-elevated)),color-mix(in srgb,var(--accent-rose) 5%,var(--bg-elevated)));border:1px solid color-mix(in srgb,var(--accent-amber) 20%,transparent);border-radius:14px;padding:20px 24px;margin-bottom:24px; }
.lc-pinned-items { display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:14px; }
.lc-pinned-item { background:var(--bg-overlay);border:1px solid var(--border);border-radius:10px;padding:12px 14px;cursor:pointer;transition:all 120ms ease;display:flex;align-items:flex-start;gap:10px; }
.lc-pinned-item:hover { border-color:var(--border-strong);background:var(--bg-subtle-hover); }
.lc-pinned-icon { width:32px;height:32px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;font-size:14px; }
.lc-pinned-item-title { font-size:12px;font-weight:600;color:var(--fg-default);margin-bottom:2px; }
.lc-pinned-item-sub { font-size:11px;color:var(--fg-muted); }
.lc-badges-row { display:flex;flex-wrap:wrap;gap:8px;margin-top:12px; }
.lc-achievement-badge { display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:7px;font-size:11px;font-weight:600;border:1px solid color-mix(in srgb,var(--accent-amber) 25%,transparent);background:color-mix(in srgb,var(--accent-amber) 8%,transparent);color:var(--accent-amber); }
.lc-sop-card { background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:border-color 140ms ease; }
.lc-sop-card:hover { border-color:var(--border-strong); }
.lc-sop-header { padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:12px; }
.lc-sop-body { padding:16px 20px; }
.lc-sop-version { display:flex;align-items:center;gap:6px;font-size:11px;color:var(--fg-muted);margin-top:4px; }
.lc-sop-changelog { margin-top:12px;border-top:1px solid var(--border);padding-top:12px; }
.lc-sop-changelog-item { display:flex;gap:12px;padding:6px 0;font-size:11px;color:var(--fg-muted);border-bottom:1px solid var(--border); }
.lc-sop-changelog-item:last-child { border-bottom:none; }
.lc-sop-changelog-version { font-family:var(--font-mono,monospace);font-weight:600;color:var(--accent-cyan);flex-shrink:0;min-width:36px; }
.lc-defect-card { background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;overflow:hidden; }
.lc-defect-top { padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border); }
.lc-defect-body { padding:14px 18px;display:flex;flex-direction:column;gap:10px; }
.lc-defect-label { font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px; }
.lc-defect-bad { color:var(--accent-rose); }
.lc-defect-good { color:var(--accent-emerald); }
.lc-defect-text { font-size:12px;color:var(--fg-muted);line-height:1.6; }
.lc-wi-card { background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:18px 20px; }
.lc-wi-steps { margin-top:12px;display:flex;flex-direction:column;gap:8px; }
.lc-wi-step { display:flex;align-items:flex-start;gap:10px;font-size:12px;color:var(--fg-muted);line-height:1.5; }
.lc-wi-step-num { width:20px;height:20px;border-radius:50%;background:color-mix(in srgb,var(--accent-blue) 12%,transparent);color:var(--accent-blue);font-size:10px;font-weight:700;display:grid;place-items:center;flex-shrink:0;margin-top:1px; }
.lc-lesson-card { background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:18px 20px;transition:border-color 140ms ease; }
.lc-lesson-card:hover { border-color:var(--border-strong); }
.lc-lesson-insight { font-size:13px;color:var(--fg-default);line-height:1.7;margin:10px 0;padding:12px 14px;background:var(--bg-subtle);border-radius:8px;border-left:3px solid var(--accent-cyan); }
.lc-lesson-meta { display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:8px; }
.lc-upvote-btn { display:flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--fg-muted);font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 120ms ease; }
.lc-upvote-btn:hover { color:var(--accent-violet);border-color:color-mix(in srgb,var(--accent-violet) 30%,transparent);background:color-mix(in srgb,var(--accent-violet) 8%,transparent); }
.lc-standard-card { background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:20px; }
.lc-standard-score { font-size:36px;font-weight:800;letter-spacing:-0.04em;line-height:1;margin:8px 0; }
.lc-standard-bar { height:6px;border-radius:999px;background:var(--border);overflow:hidden;margin:6px 0; }
.lc-standard-bar-fill { height:100%;border-radius:999px;transition:width 600ms ease; }
.lc-analytics-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;margin-bottom:24px; }
.lc-stat-card { background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;padding:18px 20px; }
.lc-stat-val { font-size:32px;font-weight:800;letter-spacing:-0.04em;line-height:1;margin-bottom:4px; }
.lc-stat-label { font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--fg-muted); }
.lc-search-bar { width:100%;display:flex;align-items:center;gap:10px;height:42px;padding:0 14px;border-radius:10px;border:1px solid var(--border-strong);background:var(--bg-elevated);margin-bottom:20px; }
.lc-search-input { flex:1;background:transparent;border:none;outline:none;font-size:13px;font-family:inherit;color:var(--fg-default); }
.lc-search-input::placeholder { color:var(--fg-muted); }
.lc-coaching-agent { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:10px 10px 0 0;margin-bottom:0; }
.lc-coaching-agent-info { display:flex;align-items:center;gap:12px; }
.lc-coaching-avatar { width:36px;height:36px;border-radius:10px;background:color-mix(in srgb,var(--accent-blue) 15%,transparent);border:1px solid color-mix(in srgb,var(--accent-blue) 25%,transparent);color:var(--accent-blue);display:grid;place-items:center;font-size:12px;font-weight:700;flex-shrink:0; }
.lc-assign-btn { display:flex;align-items:center;gap:5px;height:28px;padding:0 12px;border-radius:7px;border:1px solid color-mix(in srgb,var(--accent-blue) 25%,transparent);background:color-mix(in srgb,var(--accent-blue) 8%,transparent);color:var(--accent-blue);font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;transition:all 120ms ease; }
.lc-assign-btn:hover { background:color-mix(in srgb,var(--accent-blue) 14%,transparent); }
.lc-detail-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:flex-start;justify-content:flex-end;animation:fadeIn 120ms ease; }
.lc-detail-panel { width:min(600px,100vw);height:100vh;background:var(--bg-elevated);border-left:1px solid var(--border-strong);overflow-y:auto;animation:lcSlideIn 200ms cubic-bezier(0.16,1,0.3,1) both;display:flex;flex-direction:column; }
@keyframes lcSlideIn { from{transform:translateX(32px);opacity:0} to{transform:translateX(0);opacity:1} }
.lc-detail-header { padding:24px 28px 20px;border-bottom:1px solid var(--border);flex-shrink:0; }
.lc-detail-body { padding:24px 28px;flex:1; }
.lc-detail-close { width:28px;height:28px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--fg-muted);display:grid;place-items:center;cursor:pointer;transition:all 120ms ease;font-size:14px;font-family:inherit; }
.lc-detail-close:hover { color:var(--fg-default);background:var(--bg-subtle-hover); }
.lc-detail-content { font-size:13px;color:var(--fg-muted);line-height:1.8;white-space:pre-wrap; }
.lc-detail-content strong { color:var(--fg-default);font-weight:700; }
.lc-complete-btn { display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:42px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent-violet),var(--accent-blue));color:#fff;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;transition:opacity 120ms ease,transform 120ms ease;margin-top:24px; }
.lc-complete-btn:hover { opacity:0.9;transform:translateY(-1px); }
.lc-complete-btn:disabled { opacity:0.5;cursor:not-allowed;transform:none; }
.lc-onboarding-track { background:var(--bg-elevated);border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:16px; }
.lc-onboarding-header { padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between; }
.lc-onboarding-steps { padding:0;list-style:none; }
.lc-onboarding-step { display:flex;align-items:center;gap:14px;padding:14px 22px;border-bottom:1px solid var(--border);font-size:13px;cursor:pointer;transition:background 100ms ease; }
.lc-onboarding-step:last-child { border-bottom:none; }
.lc-onboarding-step:hover { background:var(--bg-subtle-hover); }
.lc-onboarding-step.completed { opacity:0.6; }
.lc-step-check { width:22px;height:22px;border-radius:50%;border:2px solid var(--border-strong);display:grid;place-items:center;flex-shrink:0;font-size:10px;transition:all 200ms ease; }
.lc-step-check.done { background:var(--accent-emerald);border-color:var(--accent-emerald);color:#fff; }
.lc-bp-card { background:linear-gradient(135deg,color-mix(in srgb,var(--accent-emerald) 6%,var(--bg-elevated)),var(--bg-elevated));border:1px solid color-mix(in srgb,var(--accent-emerald) 15%,transparent);border-radius:12px;padding:18px 20px;transition:border-color 140ms ease; }
.lc-bp-card:hover { border-color:color-mix(in srgb,var(--accent-emerald) 30%,transparent); }
.lc-bp-quote { font-size:13px;color:var(--fg-default);line-height:1.7;font-style:italic;margin:10px 0;padding:10px 14px;border-left:3px solid var(--accent-emerald); }
.lc-streak-banner { display:flex;align-items:center;gap:12px;padding:10px 16px;background:color-mix(in srgb,var(--accent-amber) 8%,var(--bg-elevated));border:1px solid color-mix(in srgb,var(--accent-amber) 20%,transparent);border-radius:10px;margin-bottom:16px;font-size:13px;font-weight:600;color:var(--accent-amber); }
@media(max-width:640px){.lc-hero{padding:20px}.lc-grid{grid-template-columns:1fr}.lc-pinned-items{grid-template-columns:1fr}.lc-analytics-grid{grid-template-columns:1fr 1fr}}
`;

function injectLCStyles() {
  if (document.getElementById(LC_CSS_ID)) return;
  const el = document.createElement("style");
  el.id = LC_CSS_ID;
  el.textContent = LC_CSS;
  document.head.appendChild(el);
}

// ─── Small components ─────────────────────────────────────────

const DifficultyBadge = memo(function DifficultyBadge({ difficulty }: { difficulty: LearningModule["difficulty"] }) {
  const map = { beginner: "lc-badge-emerald", intermediate: "lc-badge-amber", advanced: "lc-badge-rose" };
  return <span className={`lc-badge ${map[difficulty]}`}>{difficulty}</span>;
});

const SeverityBadge = memo(function SeverityBadge({ severity }: { severity: DefectExample["severity"] }) {
  const map = { low: "lc-badge-muted", medium: "lc-badge-amber", high: "lc-badge-rose", critical: "lc-badge-rose" };
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
  const dash = circ * (pct / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 600ms ease" }}
      />
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

// ─── Module Detail Panel ──────────────────────────────────────

const ModuleDetailPanel = memo(function ModuleDetailPanel({
  module: mod, progress, onClose, onComplete, onStartQuiz,
}: { module: LearningModule; progress: UserProgress; onClose: () => void; onComplete: (id: string) => void; onStartQuiz: (quizId: string) => void; }) {
  const isCompleted = progress.completedModules.includes(mod.id);
  const relatedQuiz = MOCK_QUIZZES.find((q) => q.moduleId === mod.id);
  const quizCompleted = relatedQuiz ? progress.completedQuizzes.includes(relatedQuiz.id) : false;

  return (
    <div className="lc-detail-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
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
                    <div className="lc-wi-step-num">{i+1}</div>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {mod.metrics && mod.metrics.length > 0 && (
            <div style={{ marginTop:"20px" }}>
              <div style={{ fontSize:"11px", fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:"6px" }}>Related Metrics</div>
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                {mod.metrics.map((m) => <span key={m} className="lc-badge lc-badge-cyan">{m}</span>)}
              </div>
            </div>
          )}
          <button className="lc-complete-btn" disabled={isCompleted} onClick={() => onComplete(mod.id)}>
            {isCompleted ? "✓ Module Completed" : "Mark as Complete (+XP)"}
          </button>
          {relatedQuiz && !quizCompleted && (
            <button className="lc-complete-btn" style={{ marginTop:"10px", background:"linear-gradient(135deg,var(--accent-cyan),var(--accent-blue))" }} onClick={() => onStartQuiz(relatedQuiz.id)}>
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

// ─── Tab components ───────────────────────────────────────────

const HomeTab = memo(function HomeTab({ progress, onTabChange, onSelectModule }: { progress: UserProgress; onTabChange: (tab: LCTab) => void; onSelectModule: (mod: LearningModule) => void; }) {
  const recommended = useMemo(() => MOCK_MODULES.filter((m) => !progress.completedModules.includes(m.id)).slice(0, 3), [progress]);
  const levelPct = useMemo(() => {
    const cur = LEVEL_THRESHOLDS[progress.level] ?? 0;
    const next = LEVEL_THRESHOLDS[progress.level + 1] ?? cur + 1000;
    return Math.round(((progress.xp - cur) / (next - cur)) * 100);
  }, [progress]);

  return (
    <>
      {progress.streak > 1 && <div className="lc-streak-banner">🔥 {progress.streak}-day learning streak! Keep it up!</div>}
      <div className="lc-pinned">
        <div>
          <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)" }}>📌 Pinned For You</div>
          <div style={{ fontSize:"11px", color:"var(--fg-muted)", marginTop:"2px" }}>Your assigned and recommended training</div>
        </div>
        <div className="lc-pinned-items">
          {recommended.map((mod) => (
            <div key={mod.id} className="lc-pinned-item" onClick={() => onSelectModule(mod)}>
              <div className="lc-pinned-icon" style={{ background:"color-mix(in srgb,var(--accent-violet) 12%,transparent)", color:"var(--accent-violet)" }}>📚</div>
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
              <div className="lc-pinned-item-sub">{MOCK_QUIZZES.filter(q => !progress.completedQuizzes.includes(q.id)).length} remaining</div>
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
            {progress.badges.map((b) => <div key={b} className="lc-achievement-badge">🏅 {b}</div>)}
          </div>
        </div>
      )}
      <div style={{ marginBottom:"24px" }}>
        <div className="lc-section-header"><div className="lc-section-title">Quick Access</div></div>
        <div className="lc-grid-sm">
          {([
            { tab:"sop" as LCTab, icon:"📄", label:"SOPs", sub:`${MOCK_SOPS.length} documents` },
            { tab:"work-instructions" as LCTab, icon:"📋", label:"Work Instructions", sub:`${MOCK_WORK_INSTRUCTIONS.length} guides` },
            { tab:"defects" as LCTab, icon:"⚠️", label:"Defect Examples", sub:`${MOCK_DEFECTS.length} examples` },
            { tab:"lessons" as LCTab, icon:"💡", label:"Lessons Learned", sub:`${MOCK_LESSONS.length} insights` },
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

const ModulesTab = memo(function ModulesTab({ progress, onSelectModule }: { progress: UserProgress; onSelectModule: (mod: LearningModule) => void; }) {
  const [search, setSearch] = useState("");
  const [filterDiff, setFilterDiff] = useState("all");
  const filtered = useMemo(() => MOCK_MODULES.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.title.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q));
    const matchDiff = filterDiff === "all" || m.difficulty === filterDiff;
    return matchSearch && matchDiff;
  }), [search, filterDiff]);

  return (
    <>
      <div className="lc-section-header">
        <div><div className="lc-section-title">Training Modules</div><div className="lc-section-sub">{progress.completedModules.length}/{MOCK_MODULES.length} completed</div></div>
      </div>
      <div className="lc-search-bar"><SearchSVG /><input className="lc-search-input" placeholder="Search modules…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <div style={{ display:"flex", gap:"6px", marginBottom:"16px", flexWrap:"wrap" }}>
        {["all","beginner","intermediate","advanced"].map((d) => (
          <button key={d} className={`lc-tab-btn${filterDiff === d ? " active" : ""}`} onClick={() => setFilterDiff(d)}>
            {d === "all" ? "All levels" : d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
      <div className="lc-grid">
        {filtered.map((mod) => {
          const isCompleted = progress.completedModules.includes(mod.id);
          return (
            <div key={mod.id} className="lc-card" onClick={() => onSelectModule(mod)}>
              <div className="lc-card-header"><div className="lc-card-title">{mod.title}</div>{isCompleted && <CompletedPill />}</div>
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

const SOPTab = memo(function SOPTab() {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">SOP Library</div><div className="lc-section-sub">Version-controlled standard operating procedures</div></div></div>
      <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
        {MOCK_SOPS.map((sop) => (
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
                <div className="lc-sop-changelog">
                  <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:"6px" }}>Version History</div>
                  {sop.changeLog.map((entry) => (
                    <div key={entry.version} className="lc-sop-changelog-item">
                      <span className="lc-sop-changelog-version">v{entry.version}</span>
                      <span style={{ flexShrink:0 }}>{entry.date}</span>
                      <span>{entry.summary}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
});

const WorkInstructionsTab = memo(function WorkInstructionsTab() {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Work Instructions</div><div className="lc-section-sub">Short, actionable step-by-step guides</div></div></div>
      <div className="lc-grid">
        {MOCK_WORK_INSTRUCTIONS.map((wi) => (
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

const DefectsTab = memo(function DefectsTab() {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Defect Examples Library</div><div className="lc-section-sub">Real audit-based examples showing what went wrong and the correct behavior</div></div></div>
      <div className="lc-grid">
        {MOCK_DEFECTS.map((defect) => (
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
        {QUALITY_STANDARDS_DATA.map((s) => (
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
        ].map((metric) => (
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

const AGENT_ONBOARDING_STEPS = [
  { title:"Welcome & System Overview", desc:"Introduction to the QA system and your role", moduleId:"mod-2" },
  { title:"Product Knowledge Basics", desc:"Learn the Detroit Axle product line", moduleId:"mod-4" },
  { title:"Ticket Documentation Standards", desc:"Master proper ticket notes", moduleId:"mod-2" },
  { title:"Return Label Process", desc:"Learn to generate and send return labels", moduleId:"mod-1" },
  { title:"Quality Standards Orientation", desc:"Understand how you're scored", moduleId:null },
  { title:"Handling Your First Escalation", desc:"De-escalation techniques", moduleId:"mod-3" },
];

const SUPERVISOR_ONBOARDING_STEPS = [
  { title:"Supervisor Portal Overview", desc:"Navigate your supervisor tools", moduleId:null },
  { title:"Reading Audit Reports", desc:"Understand team performance data", moduleId:null },
  { title:"Coaching Fundamentals", desc:"Build your coaching framework", moduleId:"mod-5" },
  { title:"Escalation Handling", desc:"Manage complex situations", moduleId:"mod-3" },
  { title:"Setting Team Quality Goals", desc:"Align team on performance targets", moduleId:null },
];

const OnboardingTab = memo(function OnboardingTab({ progress, onSelectModule }: { progress: UserProgress; onSelectModule: (mod: LearningModule) => void; }) {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Onboarding Materials</div><div className="lc-section-sub">Role-based onboarding tracks</div></div></div>
      {[
        { label:"🎯 Agent Onboarding Track", sub:"6 steps · ~3 hours", badge:"Agent", badgeClass:"lc-badge-blue", steps:AGENT_ONBOARDING_STEPS },
        { label:"👔 Supervisor Onboarding Track", sub:"5 steps · ~4 hours", badge:"Supervisor", badgeClass:"lc-badge-violet", steps:SUPERVISOR_ONBOARDING_STEPS },
      ].map(({ label, sub, badge, badgeClass, steps }) => (
        <div key={label} className="lc-onboarding-track">
          <div className="lc-onboarding-header">
            <div>
              <div style={{ fontSize:"14px", fontWeight:700, color:"var(--fg-default)" }}>{label}</div>
              <div style={{ fontSize:"11px", color:"var(--fg-muted)", marginTop:"2px" }}>{sub}</div>
            </div>
            <span className={`lc-badge ${badgeClass}`}>{badge}</span>
          </div>
          <ul className="lc-onboarding-steps">
            {steps.map((step, i) => {
              const mod = step.moduleId ? MOCK_MODULES.find((m) => m.id === step.moduleId) : null;
              const done = mod ? progress.completedModules.includes(mod.id) : false;
              return (
                <li key={i} className={`lc-onboarding-step${done ? " completed" : ""}`} onClick={() => mod && onSelectModule(mod)}>
                  <div className={`lc-step-check${done ? " done" : ""}`}>{done ? "✓" : i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"13px", fontWeight:600, color:"var(--fg-default)" }}>{step.title}</div>
                    <div style={{ fontSize:"11px", color:"var(--fg-muted)" }}>{step.desc}</div>
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

const LessonsTab = memo(function LessonsTab() {
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Lessons Learned</div><div className="lc-section-sub">Insights captured from audits and performance reviews</div></div></div>
      <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
        {MOCK_LESSONS.map((lesson) => (
          <div key={lesson.id} className="lc-lesson-card">
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"10px" }}>
              <div style={{ fontSize:"14px", fontWeight:700, color:"var(--fg-default)" }}>{lesson.title}</div>
              <span className="lc-badge lc-badge-cyan">{lesson.topic}</span>
            </div>
            <div className="lc-lesson-insight">{lesson.insight}</div>
            <div className="lc-lesson-meta">
              <span style={{ fontSize:"11px", color:"var(--fg-muted)" }}>Source: {lesson.source} · {lesson.dateAdded}</span>
              <button className="lc-upvote-btn"
                style={upvoted.has(lesson.id) ? { color:"var(--accent-violet)", borderColor:"color-mix(in srgb,var(--accent-violet) 30%,transparent)", background:"color-mix(in srgb,var(--accent-violet) 8%,transparent)" } : {}}
                onClick={() => setUpvoted((prev) => { const next = new Set(prev); if (next.has(lesson.id)) next.delete(lesson.id); else next.add(lesson.id); return next; })}
              >
                👍 {lesson.upvotes + (upvoted.has(lesson.id) ? 1 : 0)}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
});

const AuditFindingsTab = memo(function AuditFindingsTab({ onSelectModule }: { onSelectModule: (mod: LearningModule) => void; }) {
  const auditLinks = [
    { metric:"Return Label (RL)", failRate:34, moduleId:"mod-1" },
    { metric:"Ticket Documentation", failRate:28, moduleId:"mod-2" },
    { metric:"Product Knowledge", failRate:19, moduleId:"mod-4" },
    { metric:"Escalation Handling", failRate:15, moduleId:"mod-3" },
  ];
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Audit Findings → Training</div><div className="lc-section-sub">Failed metrics linked to relevant training modules</div></div></div>
      <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
        {auditLinks.map((link) => {
          const mod = MOCK_MODULES.find((m) => m.id === link.moduleId);
          return (
            <div key={link.metric} style={{ padding:"16px 20px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"12px", display:"flex", alignItems:"center", gap:"16px", flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:"160px" }}>
                <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)", marginBottom:"4px" }}>{link.metric}</div>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <div style={{ height:"4px", width:"120px", borderRadius:"999px", background:"var(--border)", overflow:"hidden" }}>
                    <div style={{ width:`${link.failRate}%`, height:"100%", background:link.failRate > 25 ? "var(--accent-rose)" : "var(--accent-amber)", borderRadius:"999px" }} />
                  </div>
                  <span style={{ fontSize:"12px", color:link.failRate > 25 ? "var(--accent-rose)" : "var(--accent-amber)", fontWeight:700 }}>{link.failRate}% fail rate</span>
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

const BEST_PRACTICES_DATA = [
  { title:"The 10-Second Email Confirmation", category:"Returns", quote:"Before hitting send, I always read the email address back to the customer. It takes 10 seconds and has completely eliminated my 'label not received' callbacks.", agent:"Top Performer · Returns Team", metric:"Return Label (RL)" },
  { title:"Narrating While Working", category:"Documentation", quote:"I talk through what I'm doing while typing notes. Customers appreciate the transparency and my notes are always complete.", agent:"Top Performer · Tier 2", metric:"Ticket Documentation" },
  { title:"Silence is Agreement", category:"Escalations", quote:"During escalations, I let the customer finish completely before responding. Most agents interrupt at 70%. That last 30% is where the real issue lives.", agent:"Senior Agent · Escalations", metric:"Escalation Handling" },
];

const BestPracticesTab = memo(function BestPracticesTab() {
  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Best Practices</div><div className="lc-section-sub">Curated examples from top-performing agents and supervisors</div></div></div>
      <div className="lc-grid">
        {BEST_PRACTICES_DATA.map((bp, i) => (
          <div key={i} className="lc-bp-card">
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"8px", marginBottom:"4px" }}>
              <div style={{ fontSize:"14px", fontWeight:700, color:"var(--fg-default)" }}>{bp.title}</div>
              <span className="lc-badge lc-badge-emerald">{bp.category}</span>
            </div>
            <div className="lc-bp-quote">"{bp.quote}"</div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"6px" }}>
              <span style={{ fontSize:"11px", color:"var(--fg-muted)" }}>— {bp.agent}</span>
              <span className="lc-badge lc-badge-blue">{bp.metric}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
});

const AnalyticsTab = memo(function AnalyticsTab({ progress }: { progress: UserProgress }) {
  const completionRate = Math.round((progress.completedModules.length / MOCK_MODULES.length) * 100);
  const avgQuizScore = useMemo(() => {
    const scores = Object.values(progress.quizScores);
    if (!scores.length) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [progress]);
  const weekDays = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const mockActivity = [3,5,2,7,4,1,6];

  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Learning Analytics</div><div className="lc-section-sub">Performance metrics and learning insights</div></div></div>
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
      <div style={{ background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"12px", padding:"20px" }}>
        <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)", marginBottom:"14px" }}>Module Engagement</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {[...MOCK_MODULES].sort((a,b) => b.completions - a.completions).slice(0,4).map((mod) => (
            <div key={mod.id} style={{ display:"flex", alignItems:"center", gap:"12px" }}>
              <div style={{ fontSize:"12px", fontWeight:600, color:"var(--fg-default)", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{mod.title}</div>
              <div style={{ width:"120px", height:"6px", borderRadius:"999px", background:"var(--border)", overflow:"hidden", flexShrink:0 }}>
                <div style={{ width:`${(mod.completions/200)*100}%`, height:"100%", background:"var(--accent-blue)", borderRadius:"999px" }} />
              </div>
              <div style={{ fontSize:"11px", color:"var(--fg-muted)", flexShrink:0, minWidth:"40px", textAlign:"right" }}>{mod.completions}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
});

const MOCK_TEAM_DATA = [
  { id:"a1", name:"Marcus J.", score:72, failedMetrics:["Return Label (RL)"], initials:"MJ" },
  { id:"a2", name:"Sarah K.", score:88, failedMetrics:[], initials:"SK" },
  { id:"a3", name:"Darius T.", score:65, failedMetrics:["Ticket Documentation","Return Label (RL)"], initials:"DT" },
  { id:"a4", name:"Priya N.", score:91, failedMetrics:[], initials:"PN" },
  { id:"a5", name:"Kevin B.", score:79, failedMetrics:["Escalation Handling"], initials:"KB" },
];

const CoachingTab = memo(function CoachingTab({ onSelectModule }: { onSelectModule: (mod: LearningModule) => void; }) {
  const [assigned, setAssigned] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const handleAssign = useCallback((agentId: string, moduleId: string) => {
    setAssigned((prev) => ({ ...prev, [agentId]: [...(prev[agentId] || []), moduleId] }));
  }, []);

  return (
    <>
      <div className="lc-section-header"><div><div className="lc-section-title">Supervisor Coaching Mode</div><div className="lc-section-sub">Assign modules, add coaching notes, and track agent progress</div></div></div>
      <div>
        {MOCK_TEAM_DATA.map((agent) => {
          const scoreColor = agent.score >= 85 ? "var(--accent-emerald)" : agent.score >= 70 ? "var(--accent-amber)" : "var(--accent-rose)";
          const recommended = MOCK_MODULES.filter((m) => agent.failedMetrics.some((fm) => m.metrics?.includes(fm)));
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
                  {agent.failedMetrics.map((m) => <span key={m} className="lc-badge lc-badge-rose">{m}</span>)}
                  {(assigned[agent.id]?.length ?? 0) > 0 && <span className="lc-badge lc-badge-blue">{assigned[agent.id].length} assigned</span>}
                </div>
              </div>
              {agent.failedMetrics.length > 0 && (
                <div style={{ padding:"12px 18px", background:"var(--bg-subtle)", borderRadius:"0 0 10px 10px", border:"1px solid var(--border)", borderTop:"none" }}>
                  <div style={{ fontSize:"11px", fontWeight:600, color:"var(--fg-muted)", marginBottom:"8px", letterSpacing:"0.05em", textTransform:"uppercase" }}>Recommended Training</div>
                  <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"10px" }}>
                    {recommended.map((mod) => (
                      <div key={mod.id} style={{ display:"flex", gap:"6px" }}>
                        <button className="lc-assign-btn" onClick={() => onSelectModule(mod)}>📚 {mod.title}</button>
                        <button className="lc-assign-btn"
                          style={assigned[agent.id]?.includes(mod.id) ? { background:"color-mix(in srgb,var(--accent-emerald) 14%,transparent)", color:"var(--accent-emerald)" } : {}}
                          onClick={() => handleAssign(agent.id, mod.id)}
                        >
                          {assigned[agent.id]?.includes(mod.id) ? "✓ Assigned" : "Assign"}
                        </button>
                      </div>
                    ))}
                  </div>
                  <textarea placeholder="Add coaching note…" value={notes[agent.id] || ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [agent.id]: e.target.value }))}
                    style={{ width:"100%", minHeight:"52px", padding:"8px 10px", borderRadius:"7px", border:"1px solid var(--border-strong)", background:"var(--bg-elevated)", color:"var(--fg-default)", fontSize:"12px", fontFamily:"inherit", resize:"vertical", outline:"none" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
});

// ─── Main Component ───────────────────────────────────────────

interface LearningCenterProps { userRole?: string; }

export default function LearningCenter({ userRole = "agent" }: LearningCenterProps) {
  useEffect(() => { injectLCStyles(); }, []);

  const [activeTab, setActiveTab] = useState<LCTab>("home");
  const [progress, setProgress] = useState<UserProgress>(MOCK_USER_PROGRESS);
  const [selectedModule, setSelectedModule] = useState<LearningModule | null>(null);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [showCerts, setShowCerts] = useState(false);
  const [search, setSearch] = useState("");

  const isAdmin = userRole === "admin" || userRole === "qa";
  const isSupervisor = userRole === "supervisor";

  const levelPct = useMemo(() => {
    const cur = LEVEL_THRESHOLDS[progress.level] ?? 0;
    const next = LEVEL_THRESHOLDS[progress.level + 1] ?? cur + 1000;
    return Math.round(((progress.xp - cur) / (next - cur)) * 100);
  }, [progress]);

  const handleCompleteModule = useCallback((moduleId: string) => {
    const mod = MOCK_MODULES.find((m) => m.id === moduleId);
    if (!mod) return;
    setProgress((prev) => {
      if (prev.completedModules.includes(moduleId)) return prev;
      const newXP = prev.xp + mod.xpReward;
      const newLevel = LEVEL_THRESHOLDS.findIndex((t) => t > newXP) - 1;
      return { ...prev, completedModules: [...prev.completedModules, moduleId], xp: newXP, level: Math.max(0, newLevel === -1 ? LEVEL_THRESHOLDS.length - 1 : newLevel) };
    });
  }, []);

  const handleQuizComplete = useCallback((quizId: string, score: number) => {
    const quiz = MOCK_QUIZZES.find((q) => q.id === quizId);
    if (!quiz) return;
    setProgress((prev) => ({
      ...prev,
      completedQuizzes: prev.completedQuizzes.includes(quizId) ? prev.completedQuizzes : [...prev.completedQuizzes, quizId],
      quizScores: { ...prev.quizScores, [quizId]: Math.max(prev.quizScores[quizId] ?? 0, score) },
      xp: prev.xp + (score >= quiz.passingScore ? quiz.xpReward : 0),
    }));
    setActiveQuizId(null);
    setSelectedModule(null);
  }, []);

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return {
      mods: MOCK_MODULES.filter((m) => m.title.toLowerCase().includes(q) || m.tags.some((t) => t.includes(q))),
      sops: MOCK_SOPS.filter((s) => s.title.toLowerCase().includes(q)),
      wis: MOCK_WORK_INSTRUCTIONS.filter((w) => w.title.toLowerCase().includes(q)),
      lessons: MOCK_LESSONS.filter((l) => l.title.toLowerCase().includes(q) || l.insight.toLowerCase().includes(q)),
    };
  }, [search]);

  const TABS: { id: LCTab; label: string; icon: string; roles?: string[] }[] = [
    { id:"home", label:"Home", icon:"🏠" },
    { id:"modules", label:"Training", icon:"📚" },
    { id:"sop", label:"SOPs", icon:"📄" },
    { id:"work-instructions", label:"Work Instructions", icon:"📋" },
    { id:"defects", label:"Defect Examples", icon:"⚠️" },
    { id:"standards", label:"Standards", icon:"⭐" },
    { id:"onboarding", label:"Onboarding", icon:"🎯" },
    { id:"quizzes", label:"Quizzes", icon:"📝" },
    { id:"certifications", label:"Certifications", icon:"🏆" },
    { id:"lessons", label:"Lessons Learned", icon:"💡" },
    { id:"audit-findings", label:"Audit Findings", icon:"🔗" },
    { id:"best-practices", label:"Best Practices", icon:"🌟" },
    { id:"analytics", label:"Analytics", icon:"📊" },
    { id:"coaching", label:"Coaching", icon:"👔", roles:["supervisor","admin","qa"] },
  ];

  const visibleTabs = TABS.filter((t) => !t.roles || t.roles.includes(userRole));

  if (activeQuizId) {
    const quiz = MOCK_QUIZZES.find((q) => q.id === activeQuizId);
    if (quiz) return <QuizEngine quiz={quiz} onComplete={(score) => handleQuizComplete(activeQuizId, score)} onBack={() => setActiveQuizId(null)} />;
  }

  if (showCerts) return <CertificationTracker progress={progress} modules={MOCK_MODULES} quizzes={MOCK_QUIZZES} onBack={() => setShowCerts(false)} />;

  return (
    <div className="lc-root">
      {/* Hero */}
      <div className="lc-hero">
        <div className="lc-hero-inner">
          <div>
            <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"var(--accent-violet)", marginBottom:"6px" }}>Learning Center</div>
            <div className="lc-hero-title">Grow Your Skills 🚀</div>
            <div className="lc-hero-sub">Your personal training hub — modules, SOPs, quizzes, certifications, and more.</div>
          </div>
          <div className="lc-hero-xp">
            <div className="lc-xp-card"><div className="lc-xp-val">{progress.xp}</div><div className="lc-xp-label">Total XP</div></div>
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

      {/* Smart Search */}
      <div className="lc-search-bar">
        <SearchSVG />
        <input className="lc-search-input" placeholder="Search modules, SOPs, lessons, defects…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:"var(--fg-muted)", cursor:"pointer", fontSize:"14px" }}>✕</button>}
      </div>

      {/* Search results */}
      {searchResults && (
        <div style={{ marginBottom:"24px" }}>
          {!searchResults.mods.length && !searchResults.sops.length && !searchResults.wis.length && !searchResults.lessons.length ? (
            <div style={{ padding:"24px", textAlign:"center", color:"var(--fg-muted)", fontSize:"13px" }}>No results found for "{search}"</div>
          ) : (
            <>
              {searchResults.mods.length > 0 && (
                <>
                  <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:"8px" }}>Training Modules</div>
                  <div className="lc-grid" style={{ marginBottom:"16px" }}>
                    {searchResults.mods.map((m) => (
                      <div key={m.id} className="lc-card" onClick={() => setSelectedModule(m)}>
                        <div className="lc-card-title">{m.title}</div>
                        <div className="lc-card-desc">{m.description}</div>
                        <DifficultyBadge difficulty={m.difficulty} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {searchResults.sops.length > 0 && <>
                <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:"8px", marginTop:"16px" }}>SOPs</div>
                {searchResults.sops.map((s) => (
                  <div key={s.id} style={{ padding:"12px 16px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"10px", marginBottom:"8px" }}>
                    <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)" }}>{s.title}</div>
                    <div style={{ fontSize:"11px", color:"var(--fg-muted)", marginTop:"2px" }}>v{s.version} · {s.category}</div>
                  </div>
                ))}
              </>}
              {searchResults.lessons.length > 0 && <>
                <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase", color:"var(--fg-muted)", marginBottom:"8px", marginTop:"16px" }}>Lessons Learned</div>
                {searchResults.lessons.map((l) => (
                  <div key={l.id} style={{ padding:"12px 16px", background:"var(--bg-elevated)", border:"1px solid var(--border)", borderRadius:"10px", marginBottom:"8px" }}>
                    <div style={{ fontSize:"13px", fontWeight:700, color:"var(--fg-default)" }}>{l.title}</div>
                    <div style={{ fontSize:"11px", color:"var(--fg-muted)", marginTop:"2px" }}>{l.topic}</div>
                  </div>
                ))}
              </>}
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      {!search && (
        <>
          <div className="lc-tab-nav">
            {visibleTabs.map((tab) => (
              <button key={tab.id}
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

          {activeTab === "home" && <HomeTab progress={progress} onTabChange={(tab) => { if (tab === "certifications") { setShowCerts(true); return; } setActiveTab(tab); }} onSelectModule={setSelectedModule} />}
          {activeTab === "modules" && <ModulesTab progress={progress} onSelectModule={setSelectedModule} />}
          {activeTab === "sop" && <SOPTab />}
          {activeTab === "work-instructions" && <WorkInstructionsTab />}
          {activeTab === "defects" && <DefectsTab />}
          {activeTab === "standards" && <StandardsTab />}
          {activeTab === "onboarding" && <OnboardingTab progress={progress} onSelectModule={setSelectedModule} />}
          {activeTab === "quizzes" && (
            <div>
              <div className="lc-section-header"><div><div className="lc-section-title">Refresher Quizzes</div><div className="lc-section-sub">Test your knowledge and earn XP</div></div></div>
              <div className="lc-grid">
                {MOCK_QUIZZES.map((quiz) => {
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
                      <button className="lc-complete-btn"
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
          {activeTab === "lessons" && <LessonsTab />}
          {activeTab === "audit-findings" && <AuditFindingsTab onSelectModule={setSelectedModule} />}
          {activeTab === "best-practices" && <BestPracticesTab />}
          {activeTab === "analytics" && <AnalyticsTab progress={progress} />}
          {activeTab === "coaching" && (isSupervisor || isAdmin) && <CoachingTab onSelectModule={setSelectedModule} />}
        </>
      )}

      {/* Module detail */}
      {selectedModule && (
        <ModuleDetailPanel
          module={selectedModule} progress={progress}
          onClose={() => setSelectedModule(null)}
          onComplete={handleCompleteModule}
          onStartQuiz={(qId) => { setSelectedModule(null); setActiveQuizId(qId); }}
        />
      )}
    </div>
  );
}
