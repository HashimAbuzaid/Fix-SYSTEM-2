import type {
  LearningModule,
  SOPDocument,
  WorkInstruction,
  DefectExample,
  Quiz,
  LessonLearned,
  BestPractice,
  QualityStandard,
  TeamMember,
  AuditLink,
  OnboardingTrack,
} from "./learningService";

/**
 * Default Learning Center seed data.
 *
 * Keep these arrays typed and exported so learningService.ts can merge them
 * with local edits and Supabase records. Empty arrays are valid: content can
 * still be created from the Learning Center UI or loaded from Supabase.
 */

export const MODULES: LearningModule[] = [];
export const SOPS: SOPDocument[] = [];
export const WORK_INSTRUCTIONS: WorkInstruction[] = [];
export const DEFECTS: DefectExample[] = [];
export const QUIZZES: Quiz[] = [];
export const LESSONS: LessonLearned[] = [];
export const BEST_PRACTICES: BestPractice[] = [];
export const QUALITY_STANDARDS: QualityStandard[] = [];
export const TEAM_MEMBERS: TeamMember[] = [];
export const AUDIT_LINKS: AuditLink[] = [];
export const ONBOARDING_TRACKS: OnboardingTrack[] = [];
