# CensusSync — Product Requirements Document (PRD)

**Version:** 1.0  
**Prepared for:** Product / Development Use  
**Project Type:** Web Application (Modern Full-Stack)  
**Domain:** GovTech / Census & Field Data Collection  
**Recommended Stack:** Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui + Firebase + IndexedDB/Dexie + Mapbox/Leaflet

---

## P1. Project Overview

### Summary
CensusSync is an offline-first census data collection and analytics platform for field enumerators, supervisors, and administrators. It enables household census data capture in low-connectivity environments, stores records locally on the device, and synchronizes data securely when connectivity returns. The system also provides validation, auditability, geo-tagged submission monitoring, analytics dashboards, and exportable reports.

### Core Problem
Traditional census collection workflows depend on paper forms and delayed manual entry, which creates stale data, operational errors, and weak visibility into field progress. In remote or low-connectivity locations, existing digital tools often fail because they assume continuous internet access.

### Solution Summary
CensusSync replaces paper-based collection with a progressive web application that works offline by default. Enumerators can collect and save household data locally, then sync it automatically later. Supervisors and admins get near real-time dashboards, coverage maps, validation workflows, and downloadable reports, reducing data lag and improving operational oversight.

### Product Goals
- Eliminate paper-first collection dependency for district-scale census operations.
- Enable reliable offline capture and delayed sync.
- Improve data quality using client-side and server-side validation.
- Give supervisors live visibility into coverage, progress, and anomalies.
- Provide secure role-based access and audit trails.
- Support report exports for administrative and policy workflows.

### Non-Goals
- National-scale concurrency and infrastructure in v1.
- Aadhaar, biometric, or government identity integration.
- Custom drag-and-drop form builder in v1.
- ML-based policy recommendations in v1.
- Advanced conflict merging between overlapping submissions in v1.

---

## P2. User Roles

**Role: Enumerator**
- Who they are: Field workers assigned to collect household-level census data.
- What they can do:
  - Log in securely
  - Download/receive assigned survey scope
  - Fill census forms offline
  - Edit unsynced submissions
  - Capture optional geo-tagging
  - Sync data when connectivity returns
  - View their sync status and submission history
- Their dashboard:
  - Assigned area summary
  - Pending offline records
  - Sync status
  - Recent submissions
  - Quick action to start a new household form

**Role: Supervisor**
- Who they are: District/block-level officers monitoring collection quality and coverage.
- What they can do:
  - View all submissions in their assigned jurisdiction
  - Monitor sync progress and enumerator productivity
  - Review flagged or duplicate entries
  - View geo-tagged coverage map
  - Filter dashboards by area/date/enumerator
  - Export reports
  - Review audit logs relevant to their scope
- Their dashboard:
  - Submission KPIs
  - Coverage map
  - Validation queue
  - Demographic charts
  - Enumerator performance table

**Role: Admin**
- Who they are: Central operations or technical administrators with full platform control.
- What they can do:
  - Manage users, roles, and assignments
  - Access all submissions across regions
  - Configure census templates and release versions
  - View system-wide audit logs
  - Manage exports and retention settings
  - Review sync health and operational metrics
- Their dashboard:
  - Global KPIs
  - User management
  - Assignment controls
  - System activity and logs
  - Export center

---

## P3. Feature List

### Data Collection Module

**Feature: Offline Household Census Form**
- Description: Multi-section household data form that works without internet and persists locally on the device.
- User role(s): Enumerator
- Input: Household ID, address, family member details, demographic fields, housing details, optional notes
- Output / Result: Submission saved locally and queued for sync
- Edge cases:
  - Missing required fields → inline validation blocks submit
  - Browser closes unexpectedly → draft restored from local storage
  - Duplicate household ID → warning before save
- Priority: High

**Feature: Draft Save and Resume**
- Description: Enumerators can save incomplete forms and continue later.
- User role(s): Enumerator
- Input: Partial household form data
- Output / Result: Draft stored locally and reopened later
- Edge cases:
  - Corrupted local record → move to recovery state
  - Assignment changed before resume → prompt to review before submit
- Priority: High

**Feature: Optional Geo-Tagging**
- Description: Capture GPS coordinates when user permission is granted.
- User role(s): Enumerator
- Input: Device location permission
- Output / Result: Latitude/longitude attached to submission
- Edge cases:
  - Permission denied → form still submits without location
  - GPS timeout → allow retry or skip
- Priority: Medium

### Authentication and Access Module

**Feature: Secure Authentication**
- Description: Role-based sign-in with session persistence and protected routes.
- User role(s): Enumerator, Supervisor, Admin
- Input: Email/password or approved auth provider credentials
- Output / Result: Authenticated session and role-specific navigation
- Edge cases:
  - Wrong credentials → error message and retry
  - Disabled account → block login and show support message
- Priority: High

**Feature: Role-Based Access Control**
- Description: Users only see data, tools, and screens allowed for their role and assignment.
- User role(s): Enumerator, Supervisor, Admin
- Input: User role, district/block assignment, auth claims
- Output / Result: Scoped data access and UI controls
- Edge cases:
  - Role mismatch or tampered client state → server denies access
- Priority: High

### Sync and Validation Module

**Feature: Offline Sync Queue**
- Description: Background synchronization engine pushes local records to the cloud when connectivity returns.
- User role(s): Enumerator
- Input: Unsynced local submissions
- Output / Result: Synced submissions, sync timestamps, queue status
- Edge cases:
  - Partial failure → retry with backoff
  - Duplicate payload → idempotent write prevents double insert
  - Connection drops mid-sync → resume later
- Priority: High

**Feature: Server-Side Validation**
- Description: Cloud validation checks required fields, valid ranges, duplicate household IDs, and schema integrity before records become active.
- User role(s): System, Supervisor, Admin
- Input: Incoming synced submission
- Output / Result: Approved, rejected, or flagged submission
- Edge cases:
  - Validation service unavailable → queue for retry
  - Duplicate household ID → flagged for review
- Priority: High

**Feature: Conflict and Duplicate Flagging**
- Description: Identify overlapping submissions or suspicious duplicate households for manual review.
- User role(s): Supervisor, Admin
- Input: Submission metadata, household ID, timestamps, enumerator ID
- Output / Result: Flagged review item
- Edge cases:
  - Same household legitimately updated → maintain history
- Priority: Medium

### Monitoring and Analytics Module

**Feature: Real-Time Dashboard**
- Description: Displays live counts, completion rates, demographic distributions, and sync activity.
- User role(s): Supervisor, Admin
- Input: Synced census data and filters
- Output / Result: Charts, cards, tables, summaries
- Edge cases:
  - No data → empty states with onboarding message
  - Slow query → skeleton loaders and cached results
- Priority: High

**Feature: Coverage Map**
- Description: Visual map of geo-tagged submissions to verify geographic coverage.
- User role(s): Supervisor, Admin
- Input: Submission coordinates and filters
- Output / Result: Map markers, area heat/coverage visualization
- Edge cases:
  - Missing coordinates → excluded from map with count summary
- Priority: Medium

**Feature: Enumerator Performance Monitoring**
- Description: View productivity and sync patterns by enumerator.
- User role(s): Supervisor, Admin
- Input: User activity and submission metrics
- Output / Result: Performance table and trend metrics
- Edge cases:
  - Newly created enumerator with no activity → zero-state row
- Priority: Medium

### Reporting and Audit Module

**Feature: Report Export**
- Description: Export filtered results in CSV and PDF formats.
- User role(s): Supervisor, Admin
- Input: Filters, date ranges, geography, status
- Output / Result: Downloadable report file
- Edge cases:
  - Large export → async job with completion notification
  - Empty filter result → block empty export with clear message
- Priority: High

**Feature: Audit Log**
- Description: Track logins, sync events, exports, validation outcomes, and administrative actions.
- User role(s): Supervisor, Admin
- Input: System and user events
- Output / Result: Searchable activity log
- Edge cases:
  - Missing actor metadata → preserve event with system fallback
- Priority: High

**Feature: Policy Insight Summary**
- Description: Rule-based summary layer that surfaces notable demographic patterns for reviewers.
- User role(s): Supervisor, Admin
- Input: Aggregated census results and thresholds
- Output / Result: Insight cards and alerts
- Edge cases:
  - Low sample size → suppress insights or show confidence warning
- Priority: Medium

### Administration Module

**Feature: User and Assignment Management**
- Description: Create users, assign roles, and map enumerators/supervisors to districts or blocks.
- User role(s): Admin
- Input: User profile, role, assignment scope
- Output / Result: Provisioned access
- Edge cases:
  - Duplicate email → block creation
  - Assignment conflict → warn admin
- Priority: High

**Feature: Census Template Versioning**
- Description: Manage form schema versions while keeping backward compatibility for submitted records.
- User role(s): Admin
- Input: Template fields and version metadata
- Output / Result: New active template version
- Edge cases:
  - Breaking schema change → require migration strategy
- Priority: Medium

---

## P4. User Flows

**Flow: Authentication and Role Routing**
1. User opens the app and lands on the sign-in page.
2. User enters credentials.
3. System authenticates the user.
4. User profile and role claims are fetched.
5. App routes the user to the correct dashboard:
   - Enumerator → `/app/enumerator`
   - Supervisor → `/app/supervisor`
   - Admin → `/app/admin`
6. Protected layouts and navigation are rendered based on permissions.
7. On logout, local session is cleared and user returns to `/login`.

**Flow: Offline Census Submission**
1. Enumerator logs in and taps “New Household”.
2. App loads the active census template.
3. Enumerator fills the form section by section.
4. Device loses or lacks internet.
5. App continues working offline and autosaves locally.
6. Enumerator submits the form.
7. Record is added to the local sync queue with a local status of `pending_sync`.
8. When connectivity returns, background sync starts automatically.
9. Server validates the payload and stores it centrally.
10. Enumerator sees sync success or failure status.

**Flow: Supervisor Review and Export**
1. Supervisor logs in to the dashboard.
2. System loads KPIs, charts, flagged records, and coverage map.
3. Supervisor applies filters by geography/date/enumerator.
4. Supervisor opens flagged records and reviews duplicates or validation failures.
5. Supervisor resolves or escalates issues.
6. Supervisor exports filtered data as CSV or PDF.
7. System records the export event in the audit log.

---

## P5. Page & Screen Inventory

| Page Name | Route | Who Can Access | Key Components on This Page |
|---|---|---|---|
| Landing Page | `/` | Public | Product overview, feature highlights, CTA |
| Login | `/login` | Public | Auth form, error states, password reset link |
| Enumerator Dashboard | `/app/enumerator` | Enumerator | Assignment summary, sync queue, recent submissions, new form CTA |
| New Household Form | `/app/enumerator/forms/new` | Enumerator | Multi-step census form, autosave, validation, geo-tagging |
| Drafts & Pending Sync | `/app/enumerator/drafts` | Enumerator | Draft list, pending queue, retry sync, edit actions |
| Submission History | `/app/enumerator/submissions` | Enumerator | Submission table, status badges, search/filter |
| Supervisor Dashboard | `/app/supervisor` | Supervisor | KPI cards, charts, alerts, map, filter bar |
| Validation Queue | `/app/supervisor/validation` | Supervisor | Flagged record list, record detail panel, resolve/escalate actions |
| Coverage Map | `/app/supervisor/map` | Supervisor | Interactive map, area filters, marker details |
| Reports | `/app/supervisor/reports` | Supervisor, Admin | Export builder, saved reports, download history |
| Admin Dashboard | `/app/admin` | Admin | Global KPIs, health summary, quick actions |
| User Management | `/app/admin/users` | Admin | User table, create/edit drawer, assignment controls |
| Template Management | `/app/admin/templates` | Admin | Template versions, status, release actions |
| Audit Logs | `/app/admin/audit` | Admin | Searchable log table, filters, event details |
| Settings | `/app/settings` | Authenticated users | Profile, preferences, device sync settings |
| Unauthorized | `/unauthorized` | Authenticated users | Access denied message, navigation options |

---

## P6. UI/UX Requirements

### Layout Pattern
- Public marketing/auth pages use a clean top navigation layout.
- Authenticated areas use sidebar navigation with role-specific menus.
- Mobile behavior should collapse the sidebar into a drawer.

### Responsiveness
- Desktop-first but fully mobile-responsive.
- Enumerator flows must be optimized for phones and tablets.
- Large touch targets for field conditions.

### Design System
- Use Tailwind CSS with shadcn/ui primitives.
- Consistent typography scale and spacing tokens.
- Accessible contrast and keyboard navigability.
- Support light mode at launch; dark mode optional.

### Key Components
- KPI cards: show submission counts, pending sync, validation backlog, coverage metrics
- Multi-step form components: household details, members table, housing data, notes
- Data tables: submissions, users, audit logs, flagged records
- Filters: district, block, enumerator, date range, sync status
- Charts: age distribution, household size distribution, completion trends
- Map view: geo-tagged submissions with popup details
- Status badges: synced, pending, failed, flagged
- Toasts and banners: sync progress and validation feedback
- Modals/drawers: resolve duplicates, edit assignments, export setup

### Empty States
- No submissions yet → show onboarding steps and “Create first submission”
- No flagged records → show clean-state confirmation
- No map points → explain geo-tagging availability

### Loading States
- Skeleton loaders on dashboards and tables
- Progressive section loading for large analytics pages
- Background sync indicators for enumerator views

### Accessibility Requirements
- WCAG-conscious forms and labels
- Keyboard accessibility for admin/supervisor workflows
- Clear offline/online state indicators
- Error messages must be specific and recoverable

---

## Recommended Modern Tech Stack

The original synopsis used React + Bootstrap + Chart.js + Firebase. For a more modern production-ready stack, this PRD recommends:

- **Frontend/App Framework:** Next.js 15 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Forms:** React Hook Form + Zod
- **Offline Storage:** IndexedDB via Dexie
- **Data Fetching/Caching:** TanStack Query
- **Auth & Backend Services:** Firebase Auth, Firestore, Cloud Functions, Storage
- **Maps:** Mapbox GL JS or Leaflet
- **Charts:** Recharts
- **PWA/Offline:** next-pwa or service worker strategy with app-shell caching
- **Observability:** Sentry + Firebase Analytics/Crash reporting equivalent where needed
- **Testing:** Playwright + Vitest + React Testing Library

---

## Success Metrics
- 95%+ offline submissions sync successfully without manual intervention
- Reduced submission delay compared with paper workflow
- Less than 2% duplicate/invalid submission rate after validation
- Supervisor can identify district/block coverage gaps within one dashboard session
- Export generation completes within acceptable operational SLA for district-scale datasets

---

## Release Scope Recommendation

### MVP
- Role-based auth
- Offline household form
- Sync queue
- Validation
- Supervisor dashboard
- CSV/PDF export
- Audit log

### Post-MVP
- Template versioning UI
- Assignment optimization
- Conflict merge interface
- Advanced geospatial analytics
- Insight tuning / ML support
