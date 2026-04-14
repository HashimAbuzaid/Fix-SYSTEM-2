# UI / UX Improvement List

## Executive Summary
The system already has a strong foundation: role-based experiences, themed screens, operational modules, and good coverage of QA workflows. The biggest UX opportunity is reducing friction. Right now, users can do a lot, but they often have to navigate through dense screens and repeated controls to do it.

## Highest-Impact Improvements

### 1) Add Smart Homepage Actions
Add a role-aware quick-launch section on the homepage/dashboard.

Suggested actions:
- Start New Audit
- Import Audits
- Upload Calls
- Upload Tickets
- Upload Sales
- Open Monitoring
- Open Reports
- Open Supervisor Requests
- Manage Accounts
- Open Office Screen / TV Mode

Why:
- reduces time-to-task
- makes the homepage operational instead of only informational

### 2) Simplify navigation
The current navigation is powerful but crowded.

Recommended structure:
- Operations
- Quality
- People
- Admin

Add:
- icons
- grouping
- clearer labels
- a favorites or recent section later if needed

### 3) Standardize shared controls
Multiple screens reimplement similar UI patterns:
- agent picker
- date range filter
- status pills
- banners
- section headers
- empty states

Create shared components for consistency:
- `AgentPicker`
- `DateRangeBar`
- `StatusPill`
- `MessageBanner`
- `PanelCard`
- `EmptyState`

### 4) Reduce dense screen fatigue
The heaviest screens appear to be:
- reports
- audits list
- monitoring
- supervisor requests

Improvements:
- stronger section hierarchy
- fewer competing card styles
- clearer summary area at top
- progressive disclosure for details
- drawers or modals for detail instead of giant expanded sections

## Detailed Recommendations

### Homepage / Dashboard
Improve by adding:
- quick actions
- role spotlight section
- “continue where you left off”
- today’s priority items
- pending actions count
- direct launch into common workflows

### Forms
Improve form behavior with:
- inline validation
- disabled state explanations
- first-invalid-field focus
- better save success messaging
- unsaved draft awareness where appropriate

### CSV import screens
Current import workflows are useful, but the experience can be clearer.

Add:
- import summary box
- duplicate detection summary
- clearer skipped-row reasons
- “what date range will be applied” summary
- clearer next step after successful import

### Filters and reporting
Recommended:
- sticky filter bar
- reset filters button
- saved filters
- export actions
- visible active-filter chips
- result count summary

### Tables and row actions
Improve with:
- pinned headers
- clearer action grouping
- safer destructive actions
- bulk action toolbar
- less visual noise in each row

### Role-specific UX
#### Admin / QA
Need fast operations and safe controls.
Focus on:
- quick actions
- confidence in dangerous actions
- clearer permission messaging
- cleaner data-heavy layouts

#### Supervisor
Need team visibility, not system clutter.
Focus on:
- team-scoped views
- priority request handling
- monitoring and recognition
- easy agent switching

#### Agent
Already the most focused experience.
Still improve with:
- clearer “what needs action” section
- stronger visibility for new feedback
- cleaner timeline/history view
- direct links to academy, recognition, voice

## Accessibility and Readability Improvements
- increase contrast checks for themed elements
- ensure focus states are visible on all custom buttons
- improve keyboard navigation in dropdown/picker menus
- make dense tables easier to scan
- use consistent spacing rhythm
- ensure TV mode and dashboard cards use large readable text

## Visual Consistency Improvements
You already have a strong look, but it needs more centralization.

Recommended:
- one shared theme helper
- one card system
- one button hierarchy
- one status-color language
- one spacing scale

## Suggested UX Roadmap

### P0
- Smart homepage actions
- cleaner navigation grouping
- shared banners and pickers
- improved heavy-screen hierarchy

### P1
- saved filters
- bulk action bars
- drawer/modal detail views
- better import summaries

### P2
- favorites / recent actions
- personalized homepage
- office TV mode enhancements
- richer accessibility polish

## Bottom Line
The product already does a lot. The next big UX gain is not “more features,” it is making the most common actions feel obvious, fast, and consistent.
