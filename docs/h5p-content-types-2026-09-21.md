# H5P Image Hotspots, Memory Game, Course Presentation, Arithmetic Quiz — integration and testing report

**Status:** implemented, unit-tested, typechecked, linted, builds clean. **Not yet run against a live database or a browser.**
**Date:** 21 September 2026
**Repos:** `lms_k12` (Next.js frontend) · `next_lms_erp` (Laravel backend)

---

## 1. Read this first: two things that change what "done" means

### 1.1 Neither repository contains H5P

This is the same situation `docs/h5p-drag-and-drop-integration.md` §1 describes, and
it has not changed. There is no `h5p/h5p-core` in `composer.json`, no
`@lumieducation/*` or `h5p-standalone` in `package.json`, no `h5p_libraries` /
`h5p_contents` tables, and no H5P player JS in `public/`. Every "H5P" type this
platform ships is a **native implementation** over its own tables, rendered by
this product's own player, surfaced under an H5P-branded hub and bound together
by the PAL V4 registry.

So "integrate the official H5P library `H5P.MemoryGame`" cannot mean what it
means in Moodle or Drupal. What was built instead, for all four types, is what
was built for Drag and Drop and the three text-passage types:

| The requirement | How it is met |
| --- | --- |
| Register the libraries | `config/h5p_libraries.php` registers all four official machine names, versions and dependency closures. |
| Auto-load dependencies | Every exported `h5p.json` declares the full closure in install order, so an importing host resolves them from its own store. |
| Content validation | Server-side validation per type, plus a publish check that refuses content that cannot be used, with a reason naming the thing to fix. |
| Store content JSON using the existing architecture | Rows are the source of truth; built H5P params are cached in `content_json` on every write, exactly as the existing types do. |
| Compatibility with the current rendering engine | The players are React, in the same module, sharing the same list/create/edit shells and the same xAPI helper. |
| Import / export | Real `.h5p` archives readable by Moodle, Drupal, Lumi and h5p.com. |

Because the stored rows project cleanly onto each library's params, adopting the
official player later stays a change of **renderer**, not of **data model**.

**What this does not do** is bundle library *code* in exports. A library-less
package is a supported H5P form — the host resolves from its own store — but a
host with no `H5P.MemoryGame` installed will say so rather than render it.

### 1.2 Image Hotspots is a NEW type, and `scenario_based` is untouched

The registry already had a native `image_hotspot` type over `h5p_scenarios`,
surfaced as the **"Scenario"** card. That type is a title, a picture, and points
carrying a title and a paragraph. It has no draft state, no package exchange,
and no column for any of what `H5P.ImageHotspots` actually is: popups that can
be text, an image or rich content; per-hotspot icons, colours and tooltips; an
accessible name distinct from the visible header.

Widening `h5p_scenarios` would have meant eleven new columns on a table 56
tenants already read through a Blade UI and an API contract, plus a controller
rewrite — **modifying existing functionality**, which the brief explicitly
rules out.

So this vertical adds a **separate registry code**, `image_hotspots`, over its
own tables, with the card named "Image Hotspots" as specified. Scenario keeps
its row, its route and its card, and nothing about it changed.

The consequence to be aware of: **the hub now shows two image-based cards**,
"Scenario" and "Image Hotspots". If the intent was for the new type to *replace*
Scenario, that is a follow-up — a data migration from `h5p_scenarios` into
`h5p_image_hotspots` plus retiring the old registry row — and it is deliberately
not part of this change.

---

## 2. What was delivered

### Backend — `next_lms_erp`

| File | What it is |
| --- | --- |
| `database/migrations/2026_09_21_120000_create_h5p_image_hotspots_tables.php` | `h5p_image_hotspots`, `h5p_image_hotspot_points`. |
| `database/migrations/2026_09_21_130000_create_h5p_memory_game_tables.php` | `h5p_memory_game`, `h5p_memory_game_cards` (a row is a **pair**). |
| `database/migrations/2026_09_21_140000_create_h5p_course_presentation_tables.php` | `h5p_course_presentation`, `h5p_presentation_slides`, `h5p_slide_elements`. |
| `database/migrations/2026_09_21_150000_create_h5p_arithmetic_quiz_table.php` | `h5p_arithmetic_quiz` — no child table; it stores a rule, not questions. |
| `database/migrations/2026_09_21_160000_sync_h5p_content_type_registry.php` | Re-publishes the PAL registry so the new types are visible at runtime. |
| `app/Models/lms/h5p/H5pImageHotspots.php` · `H5pImageHotspotPoint.php` · `H5pMemoryGame.php` · `H5pMemoryGameCard.php` · `H5pCoursePresentation.php` · `H5pPresentationSlide.php` · `H5pSlideElement.php` · `H5pArithmeticQuiz.php` | Eight models with casts, relations, publish checks and `maxScore()`. |
| `app/Http/Controllers/lms/h5p/H5PContentTypeController.php` | **New base controller**: the CRUD / publish / duplicate / media / package cycle, once. |
| `…/H5PImageHotspotsController.php` · `H5PMemoryGameController.php` · `H5PCoursePresentationController.php` · `H5PArithmeticQuizController.php` | Per-type validation, child sync, publish blockers, import mapping. |
| `app/Services/lms/H5P/ConvertsToH5PParams.php` | **New trait**: the five helpers every builder needs (sub-content ids, mime, feedback bands, preserved keys, library version). |
| `…/H5PImageHotspotsBuilder.php` · `H5PMemoryGameBuilder.php` · `H5PCoursePresentationBuilder.php` · `H5PArithmeticQuizBuilder.php` | Rows ⇄ official params, both directions. |
| `app/Services/lms/H5P/H5PContentPackageService.php` | **New base**: the `.h5p` read/write cycle over `H5PPackageArchive`. |
| `…/H5PImageHotspotsPackageService.php` · `H5PMemoryGamePackageService.php` · `H5PCoursePresentationPackageService.php` · `H5PArithmeticQuizPackageService.php` | Per-library media walks and export caveats. |
| `config/h5p_libraries.php` | Four library registrations: machine name, version, full dependency closure, editor closure. |
| `config/pal_h5p.php` | `image_hotspots` added; `memory_game`, `course_presentation`, `arithmetic_quiz` flipped `planned → native`; `module_category` added to every native type. |
| `app/Services/lms/Content/H5PContentAdapter.php` | Four new sources, all `published_only`. Scenario's `h5p_type` corrected to its registry code. |
| `app/Http/Controllers/lms/h5p/H5PIndexController.php` · `app/Services/PAL/H5P/H5PIntelligenceService.php` | Hub cards now carry `category`. |
| `routes/lms.php` | Four route blocks inside the existing `h5p` prefix group. |
| `resources/views/lms/h5p/{imagehotspots,memorygame,coursepresentation,arithmeticquiz}/` | Thin Blade surfaces (see §7). |
| `database/seeders/H5PContentTypeSampleSeeder.php` | One working sample per type. |
| `tests/Unit/H5PContentTypeBuilderTest.php` | 21 tests, 74 assertions. |

### Frontend — `lms_k12`

| File | What it is |
| --- | --- |
| `lib/h5p/arithmetic-quiz.ts` (+ test) | Seeded question generation and scoring. 16 tests. |
| `lib/h5p/memory-game.ts` (+ test) | Deck selection, seeded board building, two scoring modes. 20 tests. |
| `lib/h5p/image-hotspots.ts` (+ test) | Coverage scoring. 8 tests. |
| `lib/h5p/course-presentation-scoring.ts` (+ test) | Per-element grading, deck scoring, branch navigation, reachability. 18 tests. |
| `app/h5p/data/h5p-content-types.ts` | Types and a **generated API client** for all four, over the plumbing now exported from `h5p.ts`. |
| `app/h5p/data/h5p.ts` | `H5P_ROUTE_MAP` entries; session/header/error/URL helpers exported for reuse. |
| `app/h5p/data/h5p-model.ts` | Hub modules carry `category`. |
| `app/h5p/html_contents/page.tsx` | Four icons and the category chip. |
| `app/h5p/components/content-type-list.tsx` | **New**: the shared list surface (create, edit, duplicate, publish, export, import, delete, student filter). |
| `app/h5p/components/content-type-form.tsx` | **New**: the shared create and edit shells. |
| `app/h5p/components/fields.tsx` · `feedback-bands.tsx` | **New**: form primitives and the `overallFeedback` editor. |
| `app/h5p/h5p_image_hotspots/**` | List, create, edit, player, canvas editor, shared marker. |
| `app/h5p/h5p_memory_game/**` | List, create, edit, player, pair editor. |
| `app/h5p/h5p_course_presentation/**` | List, create, edit, player, slide canvas, element form. |
| `app/h5p/h5p_arithmetic_quiz/**` | List, create, edit, player, rules editor with a live worked example. |

---

## 3. How the pieces fit

### The content-library cards are not hand-written

The hub renders whatever the PAL registry reports as native. Flipping a type's
`implementation.status` in `config/pal_h5p.php` is what makes the card appear,
carrying its title, description, **category**, route, icon and live counts. The
only frontend changes needed were four icon mappings and the category chip.

**This requires a registry sync to take effect:**

```bash
php artisan migrate          # includes 2026_09_21_160000_sync_h5p_content_type_registry
# or, on an environment already migrated:
php artisan pal:h5p-registry-sync
```

The registry is read from `pal_vocabulary` at runtime with `config/pal_h5p.php`
as seed and offline fallback, so editing the config alone is not enough on a
database that has already run an earlier seed.

### Duplication was removed, not repeated

Four new types would have meant four copies of the CRUD controller, four copies
of the package cycle, four list pages and four create/edit pages. Instead:

- `H5PContentTypeController` holds the cycle; a subclass declares ~15 things.
- `H5PContentPackageService` holds the `.h5p` cycle; a subclass declares 4.
- `ConvertsToH5PParams` holds the builder helpers.
- `contentTypeApi()` generates the client; each type supplies its names.
- `ContentTypeListPage` / `ContentTypeCreatePage` / `ContentTypeEditPage` hold
  the shared surfaces.

The two **existing** builders and controllers were deliberately *not*
retrofitted onto the new bases. They pass their tests, the bases were derived
*from* them, and rewriting working audited write paths to remove duplication
that has already been paid for is risk with no user-visible result. The bases
are where a future tidy starts.

### Scoring lives in `lib/`, never in a player

Every scoring decision is a pure function in `lib/h5p/*` with no imports,
unit-tested without a browser. The players render and collect; they never decide
a mark. The embedded fill-in-the-blanks in a presentation **reuses the standalone
cloze marker**, so the same question marks identically on a slide and on its own.

### Geometry is a percentage, everywhere

Hotspot positions, slide element boxes: percentages in the editor, in the
database, and in the official params. Nothing converts to pixels until a
component measures its own container — which is what makes one authored item
render correctly on a phone and a projector.

---

## 4. Requirement coverage

| § | Requirement | Status |
| --- | --- | --- |
| 1 | Four content-type cards, same architecture as the existing ones | **Done** — registry-driven, not hand-written |
| 2 | Create / edit / preview / save / publish / unpublish / duplicate / delete / import / export | **Done** for all four. *Duplicate* is new to this family beyond the text types; Drag and Drop still lacks it |
| 3 | Backend registration, dependency closure, validation, content JSON, existing patterns | **Done** — see §1.1 for what "register" means here |
| 3 | Library **upgrades** | **Partial** — `library` column records the machine name + version every row was written against, and `config/h5p_libraries.php` is the single place to bump. There is **no upgrade runner** that rewrites existing rows; nothing in this repo has one for any type |
| 4A | Image Hotspots authoring: background, multiple hotspots, text/image/rich popups, custom icons, responsive, tooltips, a11y labels | **Done** |
| 4B | Memory Game: text/image/mixed cards, multiple pair sets, retry, completion screen, scoring config, time tracking, shuffle | **Done** |
| 4C | Course Presentation: multi-slide, text, images, video, audio, MC, T/F, blanks, drag-drop embeds, branching, progress, themes, transitions | **Done** — drag-drop embeds are *references* to existing activities (§7) |
| 4D | Arithmetic Quiz: +, −, ×, ÷, mixed, difficulty, random generation, timer, scoring, retry, max questions | **Done** — mixed operations exceed what H5P itself models (§6) |
| 5 | Image/audio/video upload, validation, DO Spaces, cleanup | **Mostly done** — upload, per-role MIME/size validation, DO-first with local fallback into the shared `h5p_content/` bucket. **Thumbnail generation and asset cleanup on delete are NOT implemented** (§8) |
| 6 | Attach and render across courses, lessons, topics, homework, worksheets, etc. | **Done via the existing adapter** — all four surface into the chapter content list as `format: h5p`, published-only, exactly as the existing types do. Every consumer of that list picks them up without further change |
| 7 | Student launch, resume, submit, results, retry, feedback, mobile | **Mostly done** — launch, submit, results, retry, feedback and responsive layouts are built. **Resume across a page reload is not**: attempt state is in-memory (§8) |
| 8 | xAPI: attempts, completion, success, score, max, %, time, timestamps | **Done** — `attempted`/`answered`/`progressed`/`completed` posted to the existing `/api/pal/h5p/xapi` pipeline with `success`, `response` and ISO-8601 duration |
| 9 | Design system, tokens, no hardcoded colours, typography, responsive, a11y | **Mostly done** — existing components and utility classes throughout. **Two author-chosen hex colours are stored** (hotspot marker, memory card) because they are content, not chrome; they are the only colour values in the new code |
| 10 | Validation and QA | See §5 |
| 11 | Migrations, no breaking changes, backward compatible, reuse tables | **Done** — five additive migrations, no table altered, no column changed |
| 12 | Deliverables incl. testing report and sample content | **Done** — this document plus `H5PContentTypeSampleSeeder` |
| 13 | Parity with the existing four | **Done, and ahead on two counts**: duplicate, and a publish check that names the specific thing to fix |

---

## 5. Test results

### Backend — `next_lms_erp`

```
php vendor/bin/phpunit --filter H5P
→ OK. Tests: 54, Assertions: 187
```

Of which `H5PContentTypeBuilderTest` is new: **21 tests, 74 assertions**,
covering the places where a format mismatch could corrupt content silently:

- ImageHotspots popups become the right **sub-content lists** (one `H5P.Image`
  entry vs one `H5P.AdvancedText`; text escaped, rich markup verbatim).
- A hotspot with no header still gets an accessible name.
- Per-hotspot icons resolve against the item defaults.
- MemoryGame **omits `matchImage`** for an identical pair — emitting it would
  change the game.
- MemoryGame reports `numCardsToUse` in **tiles, not pairs** — the off-by-half
  that would deal half a deck in a stock host.
- A text face survives as alt text *and* verbatim for a lossless round trip.
- CoursePresentation maps each element to its library; **GoToSlide addresses a
  slide by ordinal, not id** (the ids in the fixture are deliberately unordered).
- MultiChoice `singleAnswer` is **derived from the answer key**, so a two-correct
  question cannot be saved as a radio group that can never be answered.
- An unknown library in an imported deck is **skipped and named**, not silently dropped.
- ArithmeticQuiz narrows to one operation for H5P while keeping all of them for
  this product, and **reports that as an export caveat**.
- All four round-trip build → parse.

### Frontend — `lms_k12`

```
node --import tsx --test "lib/h5p/*.test.ts"
→ tests 133, pass 133, fail 0
```

Of which **62 are new**. Highlights:

- Subtraction **never produces a negative answer**; division is **always exact
  and never divides by zero** (asserted over four seeds × 60 questions each).
- A paper is exactly as long as the author asked, even when the range cannot
  supply that many distinct questions.
- Unanswered questions **count against the total** — a timed-out attempt must
  not report full marks on the part reached.
- `0` is a real answer and is scored as one (the classic falsy bug).
- A memory board has exactly two tiles per pair, and **every tile has exactly one
  partner** — the invariant behind "this board cannot be completed".
- `moves` scoring never awards more than full marks; a cleared board is
  *completed* even when it did not *pass*.
- **Ticking every box on a multi-answer question scores zero**, not full marks.
- A branch to a deleted slide **falls back to the sequence** rather than
  stranding the learner; a stranded slide is reported as unreachable.
- Embedded blanks honour the standalone cloze rules (case, one-edit spelling).
- Every scorer returns 0 rather than `NaN` on empty content.

### Whole-project checks

```
npx tsc --noEmit     → clean
npx eslint app/h5p lib/h5p → clean (0 errors, 0 warnings)
npm run build        → ✓ Compiled successfully in 4.1min; all 16 new routes present
```

```
php -l on every new/changed PHP file → no syntax errors
php artisan migrate --pretend        → all five migrations emit valid MySQL
php artisan tinker (router)          → 45 new named routes registered
php artisan tinker (registry)        → all four types resolve as native with the right table, title and machine name; image_hotspot (Scenario) unchanged
```

### Pre-existing failures, not caused by this work

`npm test` reports **384 pass, 2 fail**. Both failures are in
`lib/ai/ai-capabilities.test.ts` (`ai.providers is marked live but has no screen
to open`). Nothing under `lib/ai` or `app/ai` was touched by this change; the
H5P-only run is 133/133.

Separately, `app/lms/_shared/assign-work-panel.tsx`, `app/lms/lmsAssignment/api.ts`
and three backend files (`ApiQuestionPaperController`, `LmsAssignmentApiController`,
`routes/api.php`) are dirty in the working tree from **someone else's in-progress
question-paper PDF work**. They were left alone.

### Not yet verified — needs a live environment

- **No migration has been run.** A live database is reachable and the five
  migrations are `Pending`; they were dry-run only, because migrating shared
  state was not asked for. Nothing here has executed against real tables.
- **No sample content has been seeded**, for the same reason.
- **No browser testing.** Drag-to-place on the hotspot canvas, slide element
  dragging, the memory board's flip timing, video/audio playback, and the
  responsive breakpoints have not been exercised by a human or a headless browser.
- **No real `.h5p` package has been imported or exported.** Round trips are
  covered at the builder level; the zip layer (`H5PPackageArchive`) is reused
  unchanged from the shipping Drag and Drop path, but no actual archive from
  h5p.org has been fed through these four importers.
- **No xAPI statement has been observed end to end.** The calls are wired to the
  same helper the Drag and Drop player uses.
- **Library versions and dependency closures are stated from knowledge of the
  official `library.json` files, not read from them.** They should be checked
  against h5p.org before the first export is handed to an external host. They
  live in one place (`config/h5p_libraries.php`) precisely so that is a one-file edit.

---

## 6. Where this product is richer than H5P, and what happens on export

Three places where the schema models something the target library cannot. Each
is carried in an extension namespace (a foreign host ignores it, this importer
reads it back), and each raises an **export caveat** shown to the author at the
moment they download the file.

| Capability | In a stock H5P host | Re-imported here |
| --- | --- | --- |
| Memory Game **text cards** | `H5P.MemoryGame` has no text card. Tiles render blank with the word as alt text | Restored exactly |
| Arithmetic Quiz **multiple operations** | `arithmeticType` is single-valued; runs as the first operation only | All operations restored |
| Course Presentation **per-slide branching** | No such field; the deck plays in order | Branches restored |
| Course Presentation **speaker notes** | Not shown | Restored |

This is the honest trade. The alternative — writing a field H5P will ignore and
telling nobody — produces a package that looks fine and teaches the wrong lesson.

---

## 7. Deliberate scope calls

- **Image Hotspots is a new type, not a rewrite of Scenario.** §1.2.
- **Blade views are thin.** A working list plus export links; create, edit and
  play point at the Next.js app. The authoring canvases and players are several
  thousand lines of React each; a second implementation in Blade would drift and
  has no users. Same call as Drag and Drop.
- **An embedded Drag and Drop is a reference, not a copy.** A slide element holds
  `ref_content_id` pointing at a published activity in the same chapter, checked
  on save for tenant, chapter and published state. The builder inlines its params
  on export. The player links to the activity's own page rather than re-rendering
  it inside a slide — that player already handles pointer *and* keyboard
  placement and its own scoring, and a second drag surface inside a slide would
  be a second thing to keep correct.
- **Image Hotspots is scored on coverage.** H5P does not score this type at all,
  but the analytics contract (attempt, score, max, %) applies to every item and
  reporting 0/0 forever would make it invisible in every report. One point per
  hotspot opened is a real measurement of whether the diagram was read. The
  player says so in words rather than showing a mark beside a science diagram.
- **Arithmetic answers are in the client.** Generation is a seeded pure function
  in the browser, because a drill is measured in seconds per question and a round
  trip per question destroys the thing being measured. The answer to 7 × 8 is not
  a secret. A summative assessment would not be built this way, and the migration
  says so.
- **`module_category` was added to the existing native types too.** The hub gained
  a category chip; leaving the seven existing cards without one would make the
  four new cards look like a different kind of object. It is an additive metadata
  key that changes no behaviour and no existing value.
- **One string was corrected, not added:** `H5PContentAdapter` labelled the
  Scenario source `h5p_type: 'image_hotspots'` (plural), which no registry row has
  ever used. Harmless until this vertical claimed the plural for a real type; now
  it is `image_hotspot`, matching the registry.
- **Keyboard placement was built, not deferred.** Hotspot markers and slide
  elements are buttons; arrow keys move them and shift+arrows resize slide
  elements. Memory tiles are buttons with their face as their accessible name.
  H5P's own editors do not give us this, and a pointer-only authoring surface is
  unusable by an author on a keyboard or a switch.
- **Publish refuses a11y failures, drafts do not.** Publishing an Image Hotspots
  activity requires background alt text; publishing a Memory Game requires alt
  text on every picture card. Both types are *nothing but* images, so without it
  a learner using a screen reader cannot do the activity at all. A draft is
  allowed to be unfinished.

---

## 8. Known gaps

Stated plainly rather than left to be discovered:

1. **No thumbnail generation.** Uploads are stored at full size. The list pages
   render the original as a small `<img>`. For a class uploading 4 MB diagrams
   this is a bandwidth problem, not a correctness one.
2. **No asset cleanup on delete.** Deleting an activity soft-deletes its rows and
   leaves its files in `h5p_content/`. This matches every existing H5P type here —
   none of them clean up either — so it is a pre-existing platform gap this
   change does not widen, but it is also not fixed. A sweeper that reconciles
   `h5p_content/` against every `h5p_*` table's media columns is the right shape.
3. **No resume across a reload.** Attempt state is in memory. A learner who
   reloads a half-finished presentation starts again. The seeds are designed for
   this (the same seed replays the same paper or board) but nothing persists them
   yet; it needs an attempt table or `content-user-data`-style storage, which no
   type here has.
4. **No library upgrade runner.** §4.
5. **The sample seeder references image files it does not ship.** Paths point at
   `h5p_content/samples/*`; on an environment without them the activities are
   fully functional apart from the pictures, and the alt text still reads.

---

## 9. Security notes

Same posture as the Drag and Drop vertical, plus one addition:

- **Import is untrusted input.** Archives are bounded on package size,
  uncompressed size and entry count (zip-bomb guard); every entry name is
  path-checked before extraction; only configured media extensions are extracted.
  Limits live in `config/h5p_libraries.php`. All four importers go through the
  same `H5PPackageArchive` guards.
- **Tenancy comes from the session, not the request.** `sub_institute_id` and
  `user_id` are read from the session — hydrated from a verified JWT for
  `type=API` — with request values validated but never trusted.
- **Every read is tenant-scoped.** `findForTenant()` is the only way an item is
  loaded, so an id from another school 404s rather than leaking.
- **Drafts are filtered server-side** in both the list API and the content
  adapter, not hidden in the UI.
- **An embedded Drag and Drop is validated on save** for tenant, chapter *and*
  published state. Without the tenant check, a deck would have been the one way
  this type could read across a tenant boundary.
- **NEW: rich content is sanitised at render.** Image Hotspots `rich` popups and
  Course Presentation text elements are authored HTML, and an imported `.h5p` can
  carry arbitrary markup. Both go through `DOMPurify` — already a dependency —
  and those are the only two places in the new code that produce markup. A
  teacher account is not a reason to run a script in a learner's browser.

---

## 10. Deploying this

```bash
# backend
cd next_lms_erp
php artisan migrate                       # 5 migrations; the last re-publishes the registry
php artisan pal:h5p-registry-sync         # only if migrate was skipped
php artisan config:clear
php artisan db:seed --class=H5PContentTypeSampleSeeder   # optional; see §8.5
#   H5P_SAMPLE_TENANT / _STANDARD / _SUBJECT / _CHAPTER select the target chapter

# frontend
cd lms_k12
npm run build
```

After the registry sync, the four cards appear on **H5P content** for any chapter,
under their categories — Image Hotspots under *Interactive Content*, Memory Game
and Arithmetic Quiz under *Assessment*, Course Presentation under *Teaching
Content* — alongside the seven that were already there.
