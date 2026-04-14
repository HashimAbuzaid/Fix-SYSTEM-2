# Bug Hunt and Code Cleanup Plan

## Executive Summary
The codebase is functional and reasonably organized, but it shows signs of fast feature growth:
- repeated helper logic
- repeated theme logic
- repeated Supabase access patterns
- role and type drift
- possible syntax/import inconsistencies

The safest path is:
1. stabilize build correctness
2. centralize shared logic
3. clean the data layer
4. reduce UI duplication

## Phase 1 — Stabilize the Codebase

### 1. Run a full verification pass
Execute:
- `npm install`
- `npm run build`
- `npm run lint`

Goal:
- catch invalid JSX/style syntax
- catch broken imports
- catch type mismatches
- catch stale code paths

### 2. Fix compile/lint blockers first
Potential risk areas from the uploaded code review:
- object spread/style syntax inconsistencies
- relative import consistency
- local duplicated type definitions
- possible dead branches

### 3. Create a “known issues” log
Track:
- file
- issue
- severity
- owner
- fix status

## Phase 2 — Centralize Shared Logic

### 4. Create a single source of truth for roles and profile types
Create a shared file such as:
- `src/types/auth.ts`

Include:
- role union
- team union
- profile type
- viewer type
- permission helpers

Reason:
- some files use older role shapes
- the main app now uses `admin | qa | agent | supervisor`

### 5. Centralize theme logic
Create:
- `src/lib/theme.ts`

Move shared theme-mode detection and CSS variable generation into one place.

Reason:
- theme variable logic is repeated in many components
- repeated logic increases styling drift and bugs

### 6. Centralize audit scoring logic
Create:
- `src/lib/auditScoring.ts`

Move:
- metric definitions
- score normalization
- score calculation
- comment requirements
- team-based metric selection

Reason:
- score rules are duplicated in new audit, import, and audit edit flows

## Phase 3 — Clean the Data Layer

### 7. Replace direct table usage with service modules
Create:
- `src/services/profileService.ts`
- `src/services/auditService.ts`
- `src/services/feedbackService.ts`
- `src/services/monitoringService.ts`
- `src/services/requestService.ts`
- `src/services/productionService.ts`

Reason:
- today the Supabase calls are scattered across screens
- future RLS fixes and API changes will be easier

### 8. Standardize caching patterns
You already have:
- `viewCache`
- `agentProfilesCache`
- `usePersistentState`

Now define rules for:
- what gets cached
- how long
- who can force refresh
- what invalidates cache

Reason:
- avoid stale UI confusion
- make data freshness predictable

## Phase 4 — Reduce UI Duplication

### 9. Create shared components
Recommended:
- `AgentPicker`
- `DateRangeFilter`
- `SectionHeader`
- `StatusBadge`
- `PanelCard`
- `ErrorBanner`
- `SuccessBanner`
- `EmptyState`

Reason:
- many screens repeat very similar markup and behavior

### 10. Standardize action handling
Create shared patterns for:
- create
- save
- update status
- delete
- bulk actions
- refresh actions

Reason:
- current screens each handle these slightly differently

## Phase 5 — Hardening and Testing

### 11. Add basic test coverage
Minimum useful tests:
- audit score calculation logic
- CSV parsing logic for calls/tickets/audits imports
- permission helper logic
- agent matching logic
- date-range overlap logic

### 12. Add smoke tests for key role flows
Test:
- admin login and navigation
- QA audit creation
- supervisor team view
- agent feedback acknowledgement
- monitoring lifecycle
- CSV upload happy paths

## Likely Bug Categories to Check

### A) Type drift
Symptoms:
- one file expects `qa` and `supervisor`
- another only expects `admin` and `agent`

Fix:
- unify types globally

### B) Import path inconsistency
Symptoms:
- similar components importing from different relative paths
- broken build depending on folder depth

Fix:
- verify all imports during typecheck/build
- consider path aliases later

### C) Repeated metric definitions drifting apart
Symptoms:
- “same audit rule” behaves differently in different screens

Fix:
- centralize metrics and scoring logic

### D) Stale cache behavior
Symptoms:
- updates not visible immediately
- users seeing old summaries after writes

Fix:
- define cache invalidation points on create/update/delete

### E) Repeated theme helpers
Symptoms:
- light mode and dark mode inconsistencies
- screens not matching one another exactly

Fix:
- central theme utilities and shared design tokens

## Cleanup Backlog by Priority

### P0
- build/lint/typecheck cleanup
- unify role/team/profile types
- verify imports
- centralize audit scoring
- confirm no broken JSX/style syntax

### P1
- create service layer
- create shared UI controls
- standardize cache invalidation
- reduce duplicated screen logic

### P2
- stronger automated tests
- path aliases
- more modular layout system
- more advanced shared analytics/read-model helpers

## Recommended Work Order
1. Build and lint cleanup
2. Type centralization
3. Audit scoring extraction
4. Service layer extraction
5. Shared component extraction
6. Cache cleanup
7. Tests

## Bottom Line
Do not start with visual polish. Start by making the codebase safer to change. Once the shared logic is centralized, every new feature will be faster and less risky to build.
