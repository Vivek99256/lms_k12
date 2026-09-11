# Placeholder Build Plan — status

Tracks the "Placeholder Build Plan" sheet of `ScholarClone_Fees_Architecture_Tracker.xlsx`.
The Status column here is meant to be pasted straight back into that sheet.

Last updated: after the coverage audit — **all 13 rows complete, 3 gaps found and closed**.

| # | Module | Placeholder item | Priority | Status |
|---|---|---|---|---|
| 1 | Shared Component | One "Coming Soon" card/page component | Day 1 | **Done** |
| 2 | Course Catalog | Rollup counter view (X active · Y planned) | Day 1 | **Done** |
| 3 | Fees | AI Stack — locked state for Recommendation/Agent toggles | Day 1 | **Done** |
| 4 | Dashboard | "Coming soon" tile for dashboard personalisation | Day 2–3 | **Done** |
| 5 | Administration | "Platform Administration" link + roadmap page | Day 2–3 | **Done** |
| 6 | G2G | Agentic Library multi-module badge | Day 2–3 | **Done** |
| 7 | EB | AI Governance placeholder tab | Rest of week | **Done** |
| 8 | LMS | Enrichment / Interactive Learning naming | Rest of week | **Done** |
| 9 | Platform Roadmap | Consolidated "What's Coming" screen | Rest of week | **Done** |
| 10 | Curriculum | Per-framework tag: NGSS / STEM | Day 2–3 | **Done** (see note) |
| 11 | Curriculum | Per-framework tag: Vocational Training | Day 2–3 | **Done** |
| 12 | Curriculum | Per-framework tag: Soft Skills | Day 2–3 | **Done** |
| 13 | Curriculum | Move Framework tab to live under Curriculum | Rest of week | **Done** |

## Phase 0 — shared component (row 1)

Delivered:

- `components/ui/coming-soon.tsx` — one component, three shapes (`ComingSoonPanel`,
  `ComingSoonBadge`, `ComingSoonTile`).
- `lib/roadmap/registry.ts` + `lib/roadmap/index.ts` — the single source of truth for roadmap
  wording, phase and audience. Row 9's roadmap screen will be a view over this.
- `components/ui/tooltip.tsx` — now opens on keyboard focus and closes on Escape, and carries
  `aria-describedby`. Required before any locked control can be explained by a tooltip.
- `components/ui/status-badge.tsx` — `Coming Soon`, `Planned` and `Pilot` added to the status map.

Converged (five competing looks reduced to one):

| Was | Now |
|---|---|
| `app/fees/_components/fees-placeholder-screen.tsx` (34 call sites) | Thin alias over `ComingSoonPanel`; props unchanged |
| `ComingSoonBanner` inside `performance-center.tsx` | Deleted; uses `ComingSoonPanel` |
| `"Not built yet"` pills in `app/pal/new/` | Shared badge + shared tooltip wording |
| `app/quiz/page.tsx` bespoke hero | Rebuilt on `ComingSoonPanel`; gradients, glass and looping animation removed |
| `app/general/backend_gap_page.tsx` | Deleted — zero call sites |

## Phase 1 — Day 1 items (rows 2 and 3)

### Row 2 — Course catalog rollup counters

Shown on `/course-master` in the teacher/admin view, above the category filter pills.
Live categories read `Mainstream — 12 active`; roadmap tiers read
`Vocational training — 0 active · 18 planned` with a "Coming in Phase 2" chip.

- `lib/roadmap/registry.ts` — `CATALOG_CATEGORY_PLAN`, the per-category roadmap plan.
- `lib/roadmap/index.ts` — `catalogCategorySummary()` decides the wording.
- `components/ui/coming-soon.tsx` — `RoadmapRollupStrip`.
- `app/course-master/page.tsx` — counts and renders.

**No backend change was needed.** The active count is derived from the `lms_subject` list
`/api/lms-courses` already returns, which is the same list the cards below are drawn from, so
the counter and the cards cannot disagree. Only the "planned" number is curated, and a planned
subject has no database row by definition.

**Deliberately staff-only.** The strip does not render in the student view of the catalog. The
counters are a statement about product direction aimed at whoever chooses what the school offers;
a student has no use for "0 active · 18 planned" against a category they cannot open.

#### Re-verified against the database — two defects found and fixed

The plan's categories were written from the workbook, not from `sub_std_map`. Checked against the
stored values, two of them were wrong in ways that only show on a tenant that has the data.

1. **A populated tier was labelled unbuilt.** The registry status was printed as-is, so a tier with
   real subjects still wore its "Coming in Phase 2" chip. Sub-institute 1 — whose subjects merge
   into every LMS tenant's catalog — carries **36 STEM Resources** and **5 Career Counselling**
   subjects, both planned `coming-soon`, so the strip read "36 active · Coming in Phase 2" on those
   schools. That is the failure frozen decision #49 exists to prevent, committed by the very screen
   meant to prevent it. `presentedStatus()` in `lib/roadmap/index.ts` now derives what is shown:
   subjects and more planned reads `in-progress`, subjects and no agreed number reads `live`, and
   an empty tier keeps the curated status.

2. **One tier drew two tiles.** `subject_category` is free text and the same tier is stored under
   more than one spelling — `Soft Skill` (11 subjects, sub-institute 195) beside `Soft Skills`, and
   `My Courses` (4, sub-institute 341) beside `My Course`. Keyed by the raw value, 195 saw a live
   "Soft Skill — 11 active" next to an empty "Soft skills — Coming in Phase 2": one tier
   contradicting itself on one row. `CatalogCategoryPlan.aliases` folds the variants in, and
   counting goes through `resolveCatalogCategory()`.

`lib/roadmap/catalog.test.ts` pins both, using the stored spellings rather than invented ones.

Checked and clear: the merge in `fetchLmsCourses` dedupes by `subject_id_standard_id`, which would
lose a count if one subject appeared under two categories — exactly one such pair exists and its
`subject_id` is NULL, so it is skipped before the dedupe ever sees it.

### Row 3 — Fees AI Stack locked toggles

A new **Policies** tab, first in `/fees/ai-stack`, holding four switches shown locked:
Recommendation engine, Fees agent, Knowledge sources, Usage and audit view — with their
thresholds described. Scope is exactly the module-scoped subset the architecture review approved;
nothing engine-level was added.

- `components/ui/coming-soon.tsx` — `ComingSoonToggle`.
- `app/fees/ai-stack/_screens/ai-stack-screens.tsx` — the Policies tab.

No backend change: `fees_menu_categories` already carries the `ai-stack` category (row 10, active,
sort 9), and these switches persist nothing yet.

#### Re-verified — the tab is correct, a second "AI Stack" surface was not

The Policies tab holds up: it is first in `FEES_AI_STACK_SCREENS`, `FeesCategoryPage` puts static
tabs ahead of database menus and opens on the first one, all four `roadmapId`s resolve, the switch
is `disabled` and visible rather than hidden, and the tooltip sits on a focusable wrapper because a
disabled control is out of the tab order. Lint clean.

**The bug was elsewhere, under the same name.** `app/components/RightFloatingToolbar.tsx` — the
floating panel labelled "AI Stack", rendered by `DashboardShell` on **every page of the ERP** —
listed four capabilities including **Recommendation Engine**, the one this row names. Each was a
`<button>` with hover lift, hover border and hover shadow and **no `onClick` at all**: every
affordance of a control, wired to nothing. That is the failure this row exists to prevent, and a
worse version of it — a dead control that looks live reads as broken, where a locked one reads as
planned.

The cards are now presentational, and one shared `ComingSoonBadge` states what is actually unbuilt.

**The badge is on the panel, not on each card, and that is the point.** Conversational AI is live
and reached from the header; Knowledge graph and Recommendation engine are `in-progress` in the
registry. Badging each card "coming soon" would have marked working features as unbuilt — decision
#49 again. What is not built is *opening them from this panel*, so that is what the badge says.

## Phase 2 — Day 2-3 items (rows 4, 5, 10, 11, 12)

### Row 4 — Dashboard personalisation tile

A `ComingSoonTile` reading "Personalise this dashboard" on both dashboards:
`app/fees/_components/fees-dashboard.tsx` and `app/dashboard/AdminDashboard.tsx`.
It spans the full grid row rather than sitting as one more stat — it is a roadmap note, not a
measurement, and an orphan tile in a four-column grid reads as a layout bug.

#### Re-verified — the G2G tile was stretching

The two grid call sites are correct at every breakpoint: Fees is
`grid-cols-1 / sm:2 / xl:4` against `sm:col-span-2 xl:col-span-4`, and the admin dashboard is
`grid-cols-1 / sm:2 / lg:4` against `sm:col-span-2 lg:col-span-4`. Both reach full width at every
size, with no gap between `sm` and the last breakpoint.

**The G2G call site was the odd one out and was broken.** `command-center.tsx` renders the tile
between two grids, so it is not a grid cell at all — its parent is
`flex h-full flex-col gap-6 … overflow-y-auto`. `ComingSoonTile` carried `h-full`, and as a
flex-column child of a container with a definite height that resolves to `height: 100%` of the
scroll container: the tile claimed the dashboard's whole visible height, and because it lays out
`justify-between`, its icon, text and chip were strung to the top, middle and bottom of a mostly
empty box.

**Fixed in the component, not at the call site.** `h-full` was removed from `ComingSoonTile`
altogether. It was never earning anything: a grid item already stretches to its row height
(`align-self: stretch` is the default), and in both grid call sites the tile spans the full row, so
it has no sibling to match in the first place. Its only effect anywhere in the product was the G2G
breakage. Patching that one call site with `h-auto` would have left the same trap armed for the
next person to use the tile outside a grid — a component that only lays out correctly in one kind
of container is not finished. It now takes its height from whatever contains it, which is correct
in a grid cell, a flex column and a plain block alike, and its doc says not to reintroduce one.

Not changed: `TeacherDashboard` and `StudentDashboard` carry no tile. The row asks for Fees and
G2G, and the same reasoning as the catalog strip applies — a student is not who decides a dashboard
layout.

### Row 5 — Platform Administration

- `app/components/Header.tsx` — "Platform Administration" added to the avatar dropdown.
- `app/platform-administration/page.tsx` — the consolidated view.

Lists Platform services (12) and AI and intelligence (7), each marked Live, In progress or
Coming soon, entirely from `lib/roadmap`. Customer view shows 17 rows; an admin can switch on
"Show internal-only items" to reveal 2 more (Event bus, Decision approval trail). Same page, two
audiences, one set of words — two separate lists would drift, and once they disagree neither is
trusted.

No backend work: the dropdown is a hard-coded list in `Header.tsx`, not a database menu, so no
`tblmenumaster` migration and no `routeMapper.ts` entry are involved.

### Rows 10, 11, 12 — per-framework tags

- `app/pal/data/pal-content-model.ts` — `vocational-training` and `soft-skills` added as
  frameworks; `lifecycle` derived by `withDerivedLifecycle` from `UNBACKED_FRAMEWORKS`.
- `app/pal/_components/PalContentView.tsx` — the grid renders the badge.

**Row 10 (NGSS/STEM) was deliberately not badged, and this was agreed.** NGSS/STEM is built by
the same code as CASEL/SEL — keyword extraction over the same semantic-intelligence record — so on
a Science concept it fills with real content. Badging it would mark a working feature as unbuilt,
which is exactly what frozen decision #49 forbids. The genuinely empty thing is the STEM Resources
*subject category*, which already carries its counter from Phase 1.

An earlier version of this derived the badge from section count, which was wrong in a way worth
recording: open a Hindi concept and NGSS finds no science signals, so a zero count would have
labelled the whole NGSS framework "coming soon" when the truth was only that this concept has no
STEM content. The badge now answers "does this framework exist", and `emptyMessage` answers "is
there anything here for this concept".

To present any framework as not-yet-available, add its slug to `UNBACKED_FRAMEWORKS` — that set is
the single switch and is read in one place.

#### Re-tested against the database — the decision holds, and a matcher bug turned up

The "NGSS is as live as CASEL" call was reasoned from the frontend code and never checked against
data. Checked now, and it holds — more firmly than the original argument did:

- `pal_concept_metadata`, `pal_content_metadata`, `pal_question_metadata` carry `casel_domain` and
  `ngss_practice` columns. **Both are empty in every row**, so neither framework has curated data.
- `semantic_intelligence` — the table the Framework tab actually reads — has no framework columns
  at all. Both frameworks are derived by scanning generic concept text for keywords.
- Run across all **89 real records**: CASEL matched 100%, NGSS matched 100%. Identical.

Badging NGSS while leaving CASEL unmarked would have put "Coming soon" on a screen full of content,
beside an identically populated framework carrying no badge.

**The bug found on the way:** `findKeywordMatches` tested `value.includes(keyword)` — a plain
substring, no word boundary. So `"stem"` matched **sy·stem** and `"sel"` matched **sel·f**,
*counsel*, *select*. An English chapter listed "STEM signal matches" whose only STEM content was
the word "system", on a customer-facing screen. `keywordPattern()` now requires a whole word for
short acronyms and a word start for longer keywords, so inflections such as "models" still count
while "remodel" does not. Pinned by a test.

**Honest about the impact:** fixing it moved CASEL from 100% to 99% and left NGSS at 100%. The
substring matching was genuinely wrong and is worth fixing, but it was not what made both
frameworks match everything. That is the keyword lists themselves — `evidence`, `data`, `model`,
`relationship`, `reflection` are ordinary words in any pedagogy or assessment text. **The Framework
tab is therefore claiming framework relevance it cannot really support**, for every framework, on
every concept. The real fix is the curated `casel_domain` / `ngss_practice` columns that already
exist and are empty; keyword heuristics over that generic text cannot distinguish one framework
from another. Left for the team, since populating them is content work rather than a code change.

#### Rows 11 and 12 re-checked — both dependency notes verified, two defects fixed

Each row carries a condition, and neither had been checked.

**Row 12 — "confirm 'Soft Skills' vs 'Communication' doesn't collide": it does not.** "Communication"
appears only as descriptive prose inside soft-skills copy, never as a competing category or
framework name, and `sub_std_map` holds no category containing it. Clear.

**Row 11 — "depends on the Vocational category naming being resolved": it is.** One stored spelling
only, `Vocational Traning` (12 subjects), already carried as the data key with the corrected label.
Soft skills, by contrast, is stored under two spellings — `Soft Skill` (12) and `Soft Skills` (8) —
which the alias handling already folds into one tier.

**Defect 1: the two screens contradicted each other.** A school with soft-skills subjects saw
`Soft skills — 20 active [Live]` on the catalog strip and `Soft Skills [Coming soon]` on the
framework grid. Both statements were true of different things — the subjects exist, the framework
mapping does not — and neither screen said which it meant. The framework badge now reads
**"Alignment coming soon"**, which is what is actually missing. Vocational had the same clash:
`12 active · 18 planned [In progress]` beside `[Coming soon]`.

**Defect 2: the comment on the switch was false.** `UNBACKED_FRAMEWORKS` claimed the two had "no
vocabulary in the backend framework registry". `config/pal_content.php` defines both
`soft_skill_signals` and `nep_vocational_streams`, so anyone acting on that comment would have gone
hunting for vocabulary that already exists. The real test is a **metadata column**: every other
framework has one to record an alignment against a concept — `casel_domain`, `ngss_practice`,
`ncdg_goal`, `music_domain`, `sports_domain`, `finance_domain` — and these two have none. The rule
lands on exactly the same two frameworks; only the stated reason was wrong, and it is now correct.

**Also worth knowing: a stale Turbopack cache produced phantom 404s.** `/pal/frameworks` and both
new framework routes returned 404 from application code while their files were untouched and every
check passed. `rm -rf .next` restored them. The same stale cache was behind the
`.next/types/validator.ts` error about `app/career-counselling/page.js` that earlier notes recorded
as pre-existing — `tsc` is clean with no exceptions once the cache is cleared.

## Phase 3 — Rest of week (rows 6, 7, 8, 13)

### Row 6 — Agent library multi-module note

`app/enterprise-brain/_components/ScreenView.tsx` gained an optional `notice` slot;
`app/enterprise-brain/automation/agents/page.tsx` passes one, wording from the registry.

#### Re-checked against the row — two defects, both fixed

This row is marked "Needs spec first", with the note that the wording is customer-visible language
about a **live feature, not a new placeholder**. Judged against that, the first version failed on
both counts.

1. **It did not say what the row asks.** The row wants a note "indicating agents built here will
   extend to **K-12/EB**". The blurb read "Build an agent once and run it in any module, under that
   module's permissions" — which names neither, and so signals no particular decision. It also
   omitted the reassurance that makes this safe to show a customer relying on the screen today.
   The blurb now reads:

   > The agent library is becoming a shared service, so the same agents will serve K-12 and
   > Enterprise Brain. Agents built here today keep running unchanged.

   Drawn from the frozen decision in the AI Stack tab: the library migrates from G2G to a shared
   service hosted beside EB's Automation layer, existing agents migrate with `module='g2g'` for
   zero disruption, and K-12 becomes the second caller.

2. **A "coming soon" badge was branding a live feature.** The note used `ComingSoonBadge`, which
   renders a **hammer** for an `in-progress` row. A construction icon on a working screen says the
   feature is unfinished — untrue here, and the same mislabelling frozen decision #49 exists to
   prevent. This is the third instance of that one mistake (after the NGSS framework badge and the
   invented "Phase 2"), which is what makes it worth naming: reaching for the ComingSoon family is
   wrong whenever the subject already works.

   It now uses a neutral outline `Badge` with a `Boxes` icon. The screen is marked multi-module
   without any implication that it is unbuilt. Wording still comes from `lib/roadmap`, so the note
   and the roadmap screen cannot drift.

**Wording is the team's call.** The row says to confirm it before building, so treat the sentence
above as a proposal: it is one line in `lib/roadmap/registry.ts` and changing it updates both the
screen and the roadmap together.

### Row 7 — AI Governance

- `lib/brain/navigation.ts` — a `governance` section placed immediately after Intelligence Loop.
- `app/enterprise-brain/governance/page.tsx` — "Decision approval trail".

#### Re-checked against the row — "internal-only" was recorded but never enforced

The row's note asks whether to show this to customers at all, "given it's flagging your own
governance gap — may be internal-only for now". The registry row was marked
`audience: 'internal'` and that was treated as done. It was not: **`audience` only filters the two
roadmap screens. Nothing filtered the Brain's own navigation**, so the Governance tab rendered for
everyone who could open Enterprise Brain.

That is not a theoretical audience. The Brain is gated on the profile name containing "admin",
"principal" or "management" — and the estate holds **174 matching profiles**, almost all
school-side: *School Admin*, *Vice Principal*. A vice principal at a customer school would have
opened the Brain and read that decisions are approved and executed with no record of it.

**The same flaw made the roadmap screens' internal toggle useless.** Both pages tested the profile
name for "admin"/"principal"/"management" to decide who may reveal internal rows — and the
customers' own role names are "School Admin" and "Vice Principal". A test meant to separate our
staff from our customers was matching the words our customers use for themselves. Every school
admin could tick "Show internal-only items" and read the governance gap there too.

Fixed in three parts:

1. **`canSeeInternalItems()` in `lib/roadmap/index.ts`** replaces the role-name guess. Nothing in
   the session distinguishes a ScholarClone employee from a school user, so there is no honest role
   check to write; internal items are off unless a build sets
   `NEXT_PUBLIC_SHOW_INTERNAL_ROADMAP=true`. Both roadmap pages now use it, which also removes the
   third copy of that helper.
2. **`BrainSectionNav.audience` + `visibleBrainSections()`** in `lib/brain/navigation.ts`, marking
   `governance` internal. `DashboardShell` (sidebar) and `app/enterprise-brain/page.tsx` (section
   grid) both filter through it — the two places that render Brain navigation.
3. **The page guards itself.** A hidden link is not a closed door: the route still answers to
   anyone who types it, and the entire content of that page is a description of a gap in our own
   controls, so it checks rather than trusting that nobody found the URL.

This is a visibility measure, not a security control — it decides what the product advertises, and
what it hides is a "coming soon" note rather than protected data. Stated plainly in the helper's
doc so nobody mistakes it for access control later.

All 7 brain navigation tests still pass, including the uniqueness and round-trip checks that cover
the new section.

### Row 8 — Naming collision resolved

`NAMING` in `lib/roadmap/registry.ts` settles four terms. Every live use of "Enrichment" means the
per-concept activity — the lesson-plan "Enrichment activity" field, ESO's enrichment resolver,
PAL's content enrichment — and the subject-tier meaning appears nowhere. So the decision keeps what
is already true and renames nothing, which also respects the demo-week freeze on LMS navigation.

#### Correction — "zero occurrences" was wrong, and the constant was dead

Two defects in the first pass:

1. **The search was frontend-only.** It covered `app`, `components` and `lib` in `lms_k12` and
   concluded "Interactive Content" has zero occurrences. It has occurrences in the backend, and
   they disagree with each other — see the open item below. The claim has been removed rather than
   restated, because a confident wrong finding in a status document is worse than no finding.

2. **`NAMING` was exported and never read.** Every roadmap row repeated the string instead, so the
   decision governed nothing: the first person to edit a title without knowing the constant existed
   would have diverged from it silently. The three rows that embody a settled name now reference
   `NAMING`, and `lib/roadmap/catalog.test.ts` pins both that pairing and the absence of the
   rejected names ("Interactive Content", "Student Resources") anywhere in roadmap copy.

#### Overlap with a teammate — worth knowing before anyone edits this

`next_lms_erp` commit `219c1e6b4` (7 Sep, "update terminology") documents this same collision in
`docs/CURRENT_NAVIGATION_BASELINE.md` and reaches the same conclusion — Meaning A, the per-concept
activity, is marked DOMINANT in code. Two independent passes agreeing is a good sign; two people
editing the same names without knowing about each other is not. That work is on the LMS Content
Backlog sheet, which is someone else's.



| Term | Means |
|---|---|
| Enrichment | A per-concept extension activity. Not a subject tier. |
| Future capabilities | The subject tier: AI literacy, coding, robotics. |
| Interactive learning | The capability. H5P is one technology inside it. |
| Learning resources | Used in class, at home and in PAL — so not "Student resources". |

### Row 13 — Framework moved under Curriculum

Two halves, both required:

- **Backend** — `database/migrations/2026_09_08_100000_move_framework_menu_under_curriculum.php`
  moves menu row 605 from New PAL (531) to Curriculum Planning (327). **Applied and verified:**
  it now sits at position 8 under Curriculum Planning, and all 5 `tblgroupwise_rights` rows
  survived untouched because the menu id never changes.
- **Frontend** — `app/components/DashboardShell.tsx` drops Framework from
  `NEW_PAL_LEVEL3_ITEMS`. Without this the page would still wear New PAL's tab bar while living
  under Curriculum, because that list decides which routes New PAL claims.

#### Re-checked — the precondition holds, and New PAL was still landing on the moved page

The row says to do this **only** after verifying PAL's tab is not a second implementation. Verified:
`app/pal/framework/page.tsx` is a 28-line redirect shim that preserves the query string and sends
you to `/pal/frameworks`, and `app/pal/framework/ulu/page.tsx` is five lines doing the same. The
workbook flagged "four duplicated folders"; two of the four are shims, so there is one
implementation. Precondition satisfied.

Database re-checked: menu 605 sits under Curriculum Planning (327) at level 3, sort 8, status 1,
link `new_pal.frameworks`, with its 5 groupwise rights intact and no Framework row left under New
PAL. Migration recorded in batch 459. `app/data/routeMapper.ts:222` maps the link to the route, so
the entry resolves under its new parent without touching the link.

**The defect: clicking "New PAL" still landed on the page that had left it.** `DashboardShell`'s
level-2 handler special-cases the PAL root and pushed `/pal/frameworks`. That was right while
Framework belonged to New PAL and wrong the moment it moved: the click set `selectedBranch` to New
PAL and then navigated to a screen now owned by Curriculum Planning, while
`newPalLevel3Items` — correctly — no longer claims that route, so the shell rendered New PAL's
sub-nav over a page from another branch. It now lands on `/pal/new`, New PAL's own overview, which
`newPalLevel3Items` does claim.

Noted, not changed: `PalContextBootstrap` has no consumer. Its writer
(`persistPalConceptContext`) is called from the chapters screen, but the component that reads the
stored context is mounted nowhere. Pre-existing and harmless — `/pal/frameworks` reads `chapterId`
from the query string directly — and outside this row's scope.

Nothing moved on disk; `/pal/frameworks` is still the one implementation and PAL still reaches it.
The row's `link` (`new_pal.frameworks`) was left alone deliberately — it is an internal key that
`app/data/routeMapper.ts` maps to the route, and renaming it would break that for no visible gain.

## Phase 4 — Platform roadmap (row 9)

- `app/platform-roadmap/page.tsx` — the "What's coming" screen.
- `app/components/Header.tsx` — reachable from the avatar dropdown, beside Platform Administration.

Seven module sections, 27 upcoming capabilities, filterable by timeframe (Everything / Next /
Later). Delivered rows stay inline because they carry the story within a section — "CASEL/SEL is
live, three more frameworks follow" is a stronger thing to show than three items that are merely
not done. Admins can reveal the 2 internal-only rows; customers never see them.

**There is deliberately no "X of Y delivered" counter on this page.** The registry holds what
needed a roadmap marker — it is not an inventory of the platform, which does a great deal this
list never mentions. A ratio computed from it would read as "only five things work", which is
false and the opposite of what a roadmap shown to a customer is for. Counting is kept to screens
where the count is actually true: the course catalog strip, and Platform Administration, whose
scope genuinely is the platform's own services.

Timeframe tabs render only when they hold something. The Exploring tab is always empty in the
customer view, because its one item is internal-only, and a tab that opens onto "nothing is
scheduled" is a poor thing to click in front of a school.

#### Re-tested — a timeframe filter was showing the wrong timeframe

Every delivered row survived the phase filter, on the reasoning that a live item is context for the
rows around it. That holds on "Everything" and nowhere else. All five delivered rows happen to be
Phase 2, so clicking **Exploring** listed *Authentication* and *Roles and permissions* — both live,
both Phase 2 — above the single item actually being explored, and **Later** carried the same two.
A tab that says "Later" has to mean later. Delivered rows are now context on "Everything" only;
every tab reports zero off-phase rows.

Also added, from a coverage re-check against the workbook: **Primary and secondary alignment**
(Curriculum) and **One content library** (Learning). Both are named in the Course Catalog and PAL
sheets and both are things a school asks about — the first is the evidence behind "one lesson
develops several capabilities", the second is why content does not have to be maintained three
times. Deliberately still excluded: Career Intelligence confidence display, because the workbook
records that Career Intelligence does not exist as a working product yet, and a roadmap row for it
would be a promise with nothing behind it.

The page now carries **59 rows across 9 sections**, with the 2 internal rows verified absent from
the customer view.

## Coverage audit — re-checked against the sheet, gaps closed

Every row was re-read against its "What it should say/show" column rather than its title.
Three things had been missed, and all three are now done.

### Gap 1 — "Future capabilities" was missing from the catalog strip

Row 2 names three tiers by name: **Future Capabilities / Vocational / Career Exploration**. The
strip carried Vocational and Career Counselling but not Future capabilities, because no subject row
uses that category yet — which is exactly why it needed to be listed, not a reason to omit it.
Added to `CATALOG_CATEGORY_PLAN`. The strip now shows 10 tiers.

### Gap 2 — the G2G dashboard had no tile

Row 4 asks for a tile in the "Fees/**G2G** dashboard". Fees and the K-12 admin dashboard had one;
the G2G-lineage dashboard did not. Added to
`app/capability-intelligence/dashboard/components/command-center.tsx`. The workbook names three
independently-built dashboards (K-12 Fees, G2G Main, EB Overview) that the Dashboard Engine is
meant to replace, and two of those three now say so.

### Gap 3 — the roadmap only covered a third of the workbook

Row 9 asks for "every Phase 2/3 item across all tabs". The workbook carries **69** such rows; the
roadmap held 34, and had **nothing at all** from the PAL & Content Model or LMS Content Backlog
sheets. A school asking "will you have an AI tutor?" or "can you run our exams?" would have got
no answer.

Expanded to **59 rows across 9 sections**, curated as the row asks — internal plumbing such as
cheque reconciliation and NACH handling is deliberately left out, since it answers nothing a
school would ask.

| Section | Was | Now | Added |
|---|---|---|---|
| Course catalog | 4 | 7 | Grade enablement, student choice, school learning models |
| Fees | 4 | 12 | Online payments, reminders, discounts, refunds, approvals, reconciliation, reports, collection intelligence |
| Learning | 2 | 7 | AI tutor, personal learning path, adaptive teaching rules, content versioning, lesson kit |
| Assessment and exams | 0 | 4 | Examination management, board blueprints, one question bank, coverage and attainment |
| Teaching | 0 | 4 | Teacher workspace, content authoring, approval workflow, academic operations |
| Platform services | 11 | 12 | Student evidence store |
| Curriculum · Dashboard · AI | 11 | 11 | unchanged |

## Fix — the invented "Phase 2" promise

Reported after the audit: nearly every screen said "Coming in Phase 2".

`resolveCopy` in `components/ui/coming-soon.tsx` defaulted a missing phase to `'Phase 2'`. The 38
Fees scaffolded screens pass no `roadmapId`, so all 38 announced a delivery commitment that came
from a default value in the component rather than from any decision. That is a worse failure than
saying nothing — a vague promise is fine, a specific unearned one is not.

The phase is now optional throughout. A placeholder backed by a roadmap row still names its phase;
one without says only "Coming soon", with the tooltip "On the roadmap — ask us about your
timeline."

| Screen | Before | After |
|---|---|---|
| Fees scaffolded tabs (38) | "Coming in Phase 2" | "Coming soon" |
| Fees AI Stack policy toggles | "Coming in Phase 2" | unchanged — backed by real rows |
| Course catalog tiers | "Coming in Phase 2/3" | unchanged — backed by the catalog plan |

Separately worth knowing: those 38 Fees tabs each showing a placeholder is by design, not a bug.
They are navigation entries with no backend, and row 3 of the build plan explicitly rules out
hiding them — a visible, locked screen proves the feature is planned where a missing one reads as
absent.

## Open items for the team

1. **`--color-success` and `--color-warning` are not registered** in the Tailwind theme in
   `app/globals.css`. As a result the `success` / `warning` variants of `Badge`, and the
   `active` / `success` / `pending` / `warning` variants of `StatusBadge`, render unstyled
   wherever they are used today. Nothing in the shared Coming Soon component depends on them.
   Registering the two tokens is a small change but it would alter the appearance of every
   "Active" badge across the ERP, so it is being raised rather than changed during demo week.

2. **The Quiz landing screen said "Coming Soon" while linking to a working Create quiz page.**
   Its roadmap status is now `in-progress`, which is what is actually true.

3. **The "planned" counts are mostly unset.** Only Vocational training carries one (18, the
   figure the workbook itself uses). Every other roadmap category shows its status without a
   number, because inventing a figure a customer could later count is worse than showing none.
   Add numbers to `CATALOG_CATEGORY_PLAN` in `lib/roadmap/registry.ts` as the team agrees them.

4. **The Fees AI Stack "Models" and "Prompts" tabs are engine-level concerns.** The architecture
   review ruled that model management and prompt management stay central and must not be
   re-implemented per module. Those two tabs probably want to become links into the central AI
   console rather than editable screens inside Fees. Flagged, not changed.

5. **`php artisan migrate` must never be run bare on this project.** `migrate:status` reports
   **393 pending migrations** — the database was built from a snapshot of a pre-existing schema
   rather than by running migrations, so most have never been applied and would attempt to
   recreate live tables. Run one file at a time:
   `php artisan migrate --path=database/migrations/<file>.php`.

6. **Nine subjects are invisible in the catalog, and it is a backend one-liner.** The course query
   filters with `s.subject_category != 'SEL'`, and in SQL `NULL != 'SEL'` is NULL, so every subject
   with no category set is dropped — even though the same `SELECT` defaults it with
   `IFNULL(s.subject_category, 'My Course')`, which is what the filter was meant to keep. Nine live
   subjects on sub-institute 47 (SCIENCE, SOCIAL SCIENCE, GENERAL KNOWLEDGE across CBSE-3 to 7) have
   no card and are missing from the Mainstream counter. The fix is
   `(s.subject_category IS NULL OR s.subject_category != 'SEL')` in three places —
   `ApiLmsCourseController` lines 126 and 221, and `courseController.php` line 95. Not applied: it
   makes subjects appear that do not appear today, which is a catalog change during the demo-week
   freeze, not a counter fix. It does not make the counter disagree with the cards — both are drawn
   from the same list.

7. **"Framework" could become "Learning Alignment".** Decision #46 settles that as the formal
   name, but row 13 was scoped as a navigation move only, so the menu label was left as-is.
   Renaming it is a one-line change to the same menu row whenever the team wants it.

7. **The same module carries two different names, and one of them is the rejected one.**
   `database/migrations/2026_08_21_000001_seed_ai_module_coverage.php:89` seeds the h5p module as
   **"Interactive Learning"**; the live `ai_modules.label` row reads **"Interactive content"**, and
   `docs/CURRENT_NAVIGATION_BASELINE.md` records that second value as the current label. So the
   collision row 8 exists to resolve is sitting unresolved in the backend right now.

   Not changed here, deliberately. It is a one-row update, but the file that seeds it was committed
   by a teammate two days ago as part of the LMS terminology work on their own sheet, and the
   migration and the database disagree in a way only they can say is intended. Customer-visible
   navigation is unaffected — no `tblmenumaster` row uses any of the contested words — so this is
   not urgent, but it should be settled before either name reaches a screen.
