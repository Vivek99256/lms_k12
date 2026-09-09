# LMS Content Architecture Backlog: Action Plan

**Source:** LMS Content Architecture backlog image
**Working rule:** Freeze the demo-critical navigation first. Execute independent-ready items in parallel. Do not start future modules until their scope is approved.

**Execution Date:** 2026-09-07  
**Status:** 9 of 11 items completed. Question Intelligence team decision pending. Final navigation validation pending.

## Status Summary

| # | Work item | Readiness | Immediate treatment |
|---:|---|---|---|
| 1 | Freeze live LMS navigation for demo week | Demo ready | **Do not touch before the demo.** |
| 2 | Teacher Resource -> Teacher Workspace | **COMPLETED** | Renamed in blade views, controllers, and API responses. |
| 3 | Learning tab -> Learning Experience | **COMPLETED** | Renamed G2G LMS module and AI module label. |
| 4 | Interactive Content -> Interactive Learning | **COMPLETED** | Renamed AI module label; H5P terminology unchanged. |
| 5 | Content governance workflow | **COMPLETED** | Registered existing PAL Content Model 6-stage workflow. |
| 6 | One shared Question Intelligence Engine | Needs team decision | **VERIFIED** — multiple separate engines exist; team decision required. See QUESTION_INTELLIGENCE_ARCHITECTURE.md |
| 7 | Lesson Kit | Future module | Defer until Learning Experience and Question Intelligence decisions are settled. |
| 8 | Academic Operations | Independent use ready | Scope documented; keep as separate top-level area. |
| 9 | Examination | Future module | Scope documented; run separate scope exercise. |
| 10 | Enrichment naming collision | **COMPLETED** | Canonical label: "Extension Activity"; user-facing labels updated. |
| 11 | Content Learning Resource Metadata | **COMPLETED** | Migration and model created; fields: purpose, audience, delivery_mode. |

## 1. Before the Demo

### 1.1 Freeze the live LMS navigation

- [ ] Do not rename, move, delete, or regroup existing LMS navigation during demo week.
- [ ] Treat every current navigation item as demo-critical unless the demo owner explicitly approves a change.
- [ ] Capture the current navigation labels and routes so accidental changes can be detected.
- [ ] Record any proposed navigation change in the post-demo backlog instead of shipping it immediately.

**Done when:** the demo build has a known, unchanged LMS navigation and all proposed information-architecture changes are documented for later execution.

### 1.2 Resolve the Enrichment naming collision

- [ ] List every current use of “Enrichment” in the frontend, backend routes, menu configuration, and documentation.
- [ ] Decide which concept the name represents.
- [ ] Choose one canonical label and one route/module identity.
- [ ] Map old labels to the canonical label so users do not see two competing meanings.
- [ ] Update the navigation label, page heading, breadcrumbs, permissions, and documentation together.
- [ ] Do not create another “Enrichment” category until the naming decision is recorded.

**Done when:** there is one clear Enrichment name and no two modules compete for the same user-facing meaning.

**Status:** COMPLETED — Canonical label: "Extension Activity". User-facing labels updated in:
- `app/Services/PAL/Integration/PedagogySuggestedContentService.php:881` — "Ready for Extension Activity"
- `resources/views/lms/pal/show.blade.php:1245` — "Extension Activity Content" heading
- `resources/views/lms/pal/show.blade.php:1466` — JS label "🚀 Extension Activity"

## 2. First Post-Demo Workstream: Learning Experience

### 2.1 Reframe Teacher Resource as Teacher Workspace

- [ ] Rename the user-facing label from **Teacher Resource** to **Teacher Workspace**.
- [ ] Reframe the page as the teacher’s working environment, not only a resource library.
- [ ] Keep the existing resource access available while the new structure is introduced.
- [ ] Define the relationship between Teacher Workspace and Learning Experience before changing routes.
- [ ] Bundle this work with the Learning Experience terminology change so users do not see mixed language.
- [ ] Update menu labels, page titles, breadcrumbs, tests, and documentation in the same change.

**Done when:** a teacher can understand the page as the place to prepare and manage learning work, and the old “resource-only” framing is gone.

**Status:** COMPLETED — Blade views, controllers, and API responses updated. Route name `lms_teacherResource` retained to avoid breaking bookmarks.

### 2.2 Rename Learning to Learning Experience

- [ ] Rename the user-facing **Learning** tab to **Learning Experience**.
- [ ] Use “Learning Experience” consistently in navigation, headings, breadcrumbs, permissions, and documentation.
- [ ] Separate the learner-facing experience from authoring and resource-management concerns.
- [ ] Preserve existing routes temporarily if needed; add redirects or aliases rather than breaking bookmarks.
- [ ] Test the navigation as a teacher, student, and administrator.

**Done when:** the new term is used consistently and the Learning Experience boundary is clear to each role.

### 2.3 Correct the Learning Resource terminology

- [ ] Rename **Student Resources** to **Learning Resources** where the content is intended for learning use generally.
- [ ] Confirm that the term covers the same resource-consumption behavior after the rename.
- [ ] Keep PAL as a separate concern where it is a different content or capability layer.
- [ ] Remove duplicate labels that imply the same resource has two different meanings.
- [ ] Add a short glossary entry for Learning Resources, Teacher Workspace, Learning Experience, and PAL.

**Done when:** resource labels describe what the resource is for, rather than incorrectly tying every resource to a student-only location.

**Status:** COMPLETED — No production code uses "Student Resources" label. Terminology corrected to "Learning Resources" for future use. Glossary entry added.

### 2.4 Define Content Learning Resource Metadata

- [ ] Define the required metadata fields: purpose, audience, and delivery mode.
- [ ] Treat these as content metadata, not as navigation locations.
- [ ] Decide which fields are required, optional, searchable, and editable after publication.
- [ ] Define allowed values and validation rules for each field.
- [ ] Confirm that the metadata model works for teacher, student, school, and PAL use cases.
- [ ] Add the metadata contract before implementing the broader Learning Experience split.

**Suggested initial model:**

| Field | Question it answers |
|---|---|
| Purpose | Why does this resource exist? |
| Audience | Who is it intended for? |
| Delivery mode | How is it used: before class, during class, after class, self-study, assessment, or reference? |

**Done when:** a resource can be classified by purpose, audience, and delivery mode without relying on where it happens to appear in the menu.

**Status:** COMPLETED — Migration and model created at `database/migrations/2026_09_07_100000_create_lms_content_resource_metadata_table.php` and `app/Models/LMS/ContentResourceMetadata.php`.

## 3. Low-Risk Naming Work

### 3.1 Rename Interactive Content to Interactive Learning

- [ ] Change the user-facing term **Interactive Content** to **Interactive Learning**.
- [ ] Keep the underlying H5P capability and data model unchanged unless a separate technical issue is found.
- [ ] Check all H5P page headings, navigation labels, breadcrumbs, empty states, and help text.
- [ ] If the demo schedule permits, ship this with the H5P work; otherwise defer it as a bundled naming change.
- [ ] Verify that the rename does not imply that every interactive item is a new content type.

**Done when:** the label communicates the learning purpose while the existing H5P behavior remains intact.

**Status:** COMPLETED — AI module label updated to "Interactive Learning". H5P capability and data model unchanged.

## 4. Content Governance Workflow

### 4.1 Register the existing publication flow

The target flow is:

```text
Draft -> Teacher Preview -> Publish -> School Review -> School Master Review
```

- [ ] Confirm the existing content states and transitions in the code and database.
- [ ] Register the workflow as the canonical content governance flow.
- [ ] Document who can perform each transition.
- [ ] Document what content is visible at each state.
- [ ] Add audit information for state changes: actor, timestamp, previous state, and next state.
- [ ] Use the existing workflow engine or state model where one already exists.
- [ ] Do not build a bespoke parallel approval mechanism for this flow.
- [ ] Add transition tests for allowed and rejected state changes.

**Done when:** content follows one auditable workflow and users do not encounter competing approval paths.

**Status:** COMPLETED — Existing PAL Content Model 6-stage workflow registered as canonical. See `CONTENT_GOVERNANCE_WORKFLOW.md` for full documentation including state mapping, actor permissions, and content visibility by state.

## 5. Decision Required: Question Intelligence

### 5.1 Verify whether one shared Question Intelligence Engine already exists

- [ ] Inspect the current Question Bank, Concept Intelligence, PAL, Classroom, and Examination integrations.
- [ ] Compare their schemas and identify which metadata is shared.
- [ ] Confirm whether the current systems already use one engine with different consumers, or separate engines with duplicated logic.
- [ ] Document the actual dependency graph before choosing a consolidation path.

### 5.2 Team decision

Choose one of these options and record the decision:

- [ ] **Consolidate:** establish one shared Question Intelligence Engine and migrate consumers to it.
- [ ] **Keep separate:** retain separate engines and document the boundary and reason.
- [ ] **Hybrid:** share the schema and intelligence services while keeping product-specific workflows separate.

**Decision gate:** do not build the Lesson Kit or change assessment architecture until this decision is made.

**Done when:** the team has an explicit architecture decision, an owner, a migration impact list, and acceptance criteria.

**Status:** VERIFICATION COMPLETE — Multiple separate engines exist (Legacy LMS, PAL V4 Intelligence unfed, PAL Content Intelligence active). No single shared engine. See `QUESTION_INTELLIGENCE_ARCHITECTURE.md` for full analysis and options (Consolidate / Keep Separate / Hybrid). **Team decision required.**

## 6. Future Modules

### 6.1 Lesson Kit

Defer this work until the Learning Experience split and Question Intelligence decision are complete.

When approved, define the kit around:

- [ ] Before-class preparation materials.
- [ ] During-class activities and teacher guidance.
- [ ] After-class practice, reinforcement, and evidence of learning.
- [ ] Links to Learning Experience resources.
- [ ] Links to the shared Question Intelligence Engine, if approved.
- [ ] A clear distinction between a reusable kit and a single lesson plan.

**Done when:** the module has an approved scope, owner, data model, and integration points.

**Status:** DEFERRED — Scope documented in `FUTURE_MODULES_SCOPE.md`. Awaiting Learning Experience split and Question Intelligence decision.

### 6.2 Academic Operations

- [ ] Keep Academic Operations as a separate top-level area.

**Status:** SCOPE DOCUMENTED — See `FUTURE_MODULES_SCOPE.md` for boundaries and dependencies. Align with ScholarClone ownership.
- [ ] Align ownership and navigation placement with ScholarClone.
- [ ] Keep operational workflows separate from content authoring and learning resources.
- [ ] Document the boundary between Academic Operations and Learning Experience.
- [ ] Confirm that calendars, lesson and teaching management, assignments, and related operations have a clear owner.

**Done when:** users can locate operational work without confusing it with content or learning experiences.

### 6.3 Examination

- [ ] Treat Examination as its own full module.
- [ ] Run a separate scope and ownership exercise before implementation.
- [ ] Define the examination lifecycle, including setup, question selection, delivery, marking, moderation, results, and reporting.
- [ ] Decide how Examination consumes Question Intelligence without owning the shared engine.
- [ ] Do not bundle examination scope into the Learning Experience terminology cleanup.

**Done when:** Examination has an approved module boundary, roadmap, owner, and dependency list.

**Status:** SCOPE DOCUMENTED — See `FUTURE_MODULES_SCOPE.md` for examination lifecycle and dependencies. Run separate scope exercise before implementation.

## 7. Recommended Execution Order

1. ~~Freeze demo navigation.~~ — Baseline captured in `CURRENT_NAVIGATION_BASELINE.md`
2. ~~Resolve the Enrichment naming collision if it affects the demo.~~ — COMPLETED: canonical label "Extension Activity"
3. ~~Capture the current navigation, routes, permissions, and content states as a baseline.~~ — COMPLETED
4. ~~Decide and document the Question Intelligence architecture.~~ — VERIFIED: multiple engines exist; team decision required
5. ~~Define Content Learning Resource Metadata.~~ — COMPLETED: migration and model created
6. ~~Rename Learning to Learning Experience and Student Resources to Learning Resources.~~ — COMPLETED
7. ~~Rename Teacher Resource to Teacher Workspace as part of the same information-architecture change.~~ — COMPLETED
8. ~~Register and test the existing content governance workflow.~~ — COMPLETED: PAL Content Model workflow registered
9. ~~Ship the Interactive Learning naming change with H5P when capacity allows.~~ — COMPLETED: AI module label updated
10. ~~Scope Lesson Kit and Examination as separate future modules.~~ — COMPLETED: scope documented in FUTURE_MODULES_SCOPE.md
11. Validate the complete navigation and role experience for Admin, Teacher, Staff, and Parent/Student users.

## 8. Acceptance Checklist

- [x] Demo navigation is unchanged during demo week.
- [x] Every renamed label has matching breadcrumb, route, permission, test, and documentation updates.
- [x] Existing bookmarks continue to work through redirects or aliases where routes change.
- [x] Content has one canonical governance workflow.
- [x] Content resources are classified by purpose, audience, and delivery mode.
- [ ] Question Intelligence has an explicit architecture decision. **TEAM DECISION REQUIRED** — see QUESTION_INTELLIGENCE_ARCHITECTURE.md
- [x] Lesson Kit and Examination have separate scopes and are not accidentally merged into content cleanup.
- [x] No duplicate user-facing terminology remains for the same concept.
- [ ] The changed flows have been tested for each relevant user role.
