# H5P Branching Scenario — integration, generation and testing report

**Status:** implemented, unit-tested, typechecked, linted, and exercised in a real browser against
real generated content. **Not yet run against the live database** (no migration has been run, by design).
**Date:** 10 October 2026
**Repos:** `lms_k12` (Next.js frontend) · `next_lms_erp` (Laravel backend)

---

## 1. Read this first

### 1.1 What was checked about "official H5P", and what it means for this type

The brief says: *do not assume a type name or a database record is enough; verify whether the official
runtime exists; if it does not, explain the gap and propose the approach.* So, before writing anything:

| Question | Finding |
| --- | --- |
| Is the official H5P runtime in either repo? | **No.** No `h5p/h5p-core` in `composer.json`, no `@lumieducation/*` or `h5p-standalone` in `package.json`, no `h5p_libraries` / `h5p_contents` tables, no H5P player JS. Same finding as `h5p-drag-and-drop-integration.md` §1 and `h5p-content-types-2026-09-21.md` §1.1. |
| Was Branching Scenario implemented? | **No.** `config/pal_h5p.php` had `branching_scenario` as `implementation.status = planned`; `lib/h5p/question-bank-h5p-map.ts` and `CoursePresentationPlayer.tsx` both said "a planned type with no table and no player". (Course Presentation can branch between slides, but that is a different library and was not relabelled.) |
| What does the official library look like? | Read from the upstream repositories, not recalled: `h5p/h5p-branching-scenario` **v1.11.1** (`library.json`, `semantics.json`) and `h5p/h5p-branching-question` **v1.0.20**. The h5p.org page itself only describes the type at a high level. |

**The approach, and why it is not a new architecture.** Every H5P type in this product is a *native
implementation* over its own tables, played by its own React player, with its data **shaped as the official
library's params** and exchanged as real `.h5p` packages. That is the architecture the project already
approved twice (Drag and Drop; the 2026-09-21 and second verticals). Branching Scenario follows it exactly,
on the shared `H5PContentTypeController` base:

* a native type, **`branching_scenario`**, over `h5p_branching_scenario` + `h5p_branching_nodes`;
* rows ⇄ **`H5P.BranchingScenario 1.11` params** (`H5PBranchingScenarioBuilder`), with `.h5p` export and import;
* played by this product's player — **not** the official H5P player.

**It is not labelled "the official H5P Branching Scenario".** What was verified is *structural* compatibility:
the builder's output uses only keys the upstream `semantics.json` defines (plus `eduerp*` extension keys a
foreign host ignores), a build → parse round trip loses nothing, and a package round-trips through the
importer (§6). What was **not** verified is a run inside a real H5P host (Moodle, Lumi, h5p.com): none is
available here. If that matters, the next step is an import into one of them; the data model does not change.

**If the intent was to install the H5P framework itself,** that is a separate and much larger piece of work
(library store, dependency resolver, player and editor bundles, content-user-data tables). Say so and it
becomes its own plan; nothing here blocks it, because adopting the official player later is a change of
*renderer*, not of data model.

### 1.2 Generation reuses the study-deck pipeline; it does not add a second one

The brief asked for the existing generation workflow to be extended, not duplicated. The chapter-based
pipeline that already reads chapter → topic → concept → concept-intelligence → question bank is the
**StudyDeck** pipeline (decks, revision notes, remedial classes, activities). Branching Scenario is another
product of it, in `app/Services/StudyDeck/Branching/`, exactly as the study documents are in
`StudyDeck/Documents/`:

| Reused, unchanged | For |
| --- | --- |
| `ConceptContextBuilder` | the read-only chapter / topic / concept / prerequisite / intelligence / question context |
| `QuestionSelector` | which bank questions are self-contained enough to reuse (it rejects "according to the passage", unseen figures, padded wording) |
| `Completer` (`ClaudeApiCompleter`, `ClaudeCliCompleter`) | the one model call, with key resolution, streaming and refusal handling in `ContentGenerationService` |
| `ExtractsJson`, `DeckValidator::groundingCheck` | tolerant JSON reading; "no number the chapter does not contain" |
| `H5pPatternSelector` | the pattern catalogue already describes *branching* ("pose a decision, reveal the consequence"); its concept signals rank which concepts suit a decision |
| `ContentGenerationService` | gets one method, `generateBranchingScenario()`, behind the same `claude.chapter_ids` gate as every other Claude-written type |

The existing ad-hoc `get-h5p-ai-output` / `get-h5p-ai-scenario` endpoints (a free-text prompt sent to
OpenRouter, no grounding, no validation) were deliberately **not** used.

---

## 2. What it does

**For a teacher, on H5P content → Branching scenario** (and as a card on the H5P hub, under *Interactive Content*):

1. **Generate with AI.** Pick topics/concepts (or leave it to the generator, which picks the ones that suit a
   decision best), a length, an optional focus ("set it on a school bus"), and whether to reuse bank questions.
2. **Wait honestly.** It takes minutes; the dialog says so and shows elapsed time. There is no fake progress bar.
3. **Review before anything is stored.** The draft is played in the dialog exactly as a student would play it,
   with the map of paths, the stats (steps, decisions, endings, paths, minutes, concepts taught), the checker's
   notes, and where a picture would help.
4. **Save as draft** (or *Save and edit*). A draft is invisible to students. **Publishing is a second, separate
   act** and runs the server's graph check again.

**For a teacher who builds by hand:** a step editor (screens, decisions, endings), a *"leads to…"* control that
can make the next step on the spot, an outline and a map, live checks that say *which step to open*, and a
preview of the unsaved state.

**For a student:** a start screen (what you will do, about how long), screens, decisions whose choices are not
marked before they are made, a calm *consequence* after each choice (what happened and why — "Let's rethink",
never a red cross), a step back (if the scenario allows it), and an ending with a recap of the path taken,
`Endings found: 2 of 3`, and *Try a different path*.

---

## 3. What a generated scenario is

Not questions. A connected decision tree, built in two checked stages:

**Stage 1 — the skeleton** (`ScenarioPlanner`, `ScenarioBlueprint`): nodes, what each is *for*, where each choice
leads, no prose. Checked deterministically, and sent back to the model with the exact errors until it passes:
connected, acyclic, every path ends, ≥ 1 sound and ≥ 1 weaker choice per decision, **every weaker choice leads to
a screen that explains it**, an investigate/predict decision, a "best" and a weaker ending, every chosen concept
taught, size within the chosen length, bank questions capped (a lesson, not a quiz).

**Stage 2 — the words** (`ScenarioWriter`): text for each node, **keyed by id**. The writer cannot add, remove or
rewire a node, so prose cannot break the graph the skeleton proved sound.

**Then** `ScenarioAssembler` produces exactly the payload the editor saves, and `ScenarioValidator` checks what
structure cannot: completeness, grounding in the chapter (no invented numbers), no screen repeating another, no
repeat of a scenario already written for the chapter, a teaching/quiz balance, tone, reading level. Findings are
tied to nodes, and **only the failing nodes** are sent back for one targeted rewrite.

Bank questions are **copied verbatim, never rewritten** (the model supplies only a title and a connecting
sentence). Endings are scored by outcome (best 100 … revisit 30), not by the model.

A real example is in §6 (chapter 8592, "The sudden stop on the school bus": 13 steps, 3 decisions, 3 endings, 12 paths).

---

## 4. Files

### Backend — `next_lms_erp`

| File | What it is |
| --- | --- |
| `database/migrations/2026_10_10_120000_create_h5p_branching_scenario_tables.php` | `h5p_branching_scenario`, `h5p_branching_nodes` (a node is a tagged union: screen / decision / ending). Additive; **not run**. |
| `database/migrations/2026_10_10_130000_sync_h5p_branching_scenario_registry.php` | Re-publishes the PAL registry so the hub card appears. **Not run.** |
| `app/Models/lms/h5p/H5pBranchingScenario.php`, `H5pBranchingNode.php` | Models. |
| `app/Http/Controllers/lms/h5p/H5PBranchingScenarioController.php` | The type, on `H5PContentTypeController`; plus `sources` (read-only) and `generate` (stores nothing). |
| `app/Services/lms/H5P/BranchingGraph.php`, `BranchingPayload.php` | The rules a tree must satisfy, as pure functions. Used by save/publish *and* the generator. |
| `app/Services/lms/H5P/H5PBranchingScenarioBuilder.php`, `H5PBranchingScenarioPackageService.php` | Rows ⇄ `H5P.BranchingScenario` params; `.h5p` import/export. |
| `app/Services/lms/H5P/HtmlLite.php` | Reduces authored/model HTML to paragraphs, lists, emphasis, simple tables, links. |
| `app/Services/StudyDeck/Branching/*` (9 files) | The generator (§3). |
| `app/Console/Commands/LMS/GenerateBranchingScenarioCommand.php` | `lms:generate-branching-scenario` — writes a review bundle (incl. every path as readable text); **stores nothing**. |
| `app/Services/ContentGenerationService.php` | + `generateBranchingScenario()`, behind the `claude.chapter_ids` gate. |
| `config/h5p_libraries.php`, `config/pal_h5p.php` | Library manifest (v1.11.1 and the three nested libraries); registry row flipped `planned → native`. |
| `app/Services/lms/Content/H5PContentAdapter.php` | + source: a **published** scenario appears in the chapter content list. |
| `routes/lms.php` | 14 routes in the existing `h5p` group; `generate` carries the content-generation throttle. |
| `resources/views/lms/h5p/branchingscenario/*` | Thin legacy Blade views, as for the other types. |
| `tests/Unit/H5P/Branching/*`, `tests/Unit/StudyDeck/Branching/*` | 85 no-database tests (§5). |

### Frontend — `lms_k12`

| File | What it is |
| --- | --- |
| `lib/h5p/branching-scenario.ts` | Graph rules, scoring, path enumeration, the player's state machine, reading-time estimate. **No imports.** |
| `lib/h5p/branching-editor.ts` | The editor's state and every operation on it (add, link, delete, move, make start…). **No imports.** |
| `lib/h5p/branching-text.ts` | Plain text ⇄ the small HTML a screen is stored as. |
| `lib/h5p/fixtures/branching-graph-golden.json` | Golden file shared with the backend: both implementations of "sound" must agree on it. |
| `app/h5p/data/h5p-branching.ts` | Row and payload types; `branchingScenarioApi` (the shared content-type API); `fetchBranchingSources`, `generateBranchingScenario`. |
| `app/h5p/h5p_branching_scenario/page.tsx`, `create/`, `[id]/`, `[id]/edit/` | List, create, player route, edit. |
| `…/components/player.tsx`, `editor.tsx`, `story-map.tsx`, `fields.tsx`, `generate-scenario.tsx` | Player, editor, map, fields, the generation dialog. |
| `app/h5p/components/content-type-list.tsx` | + optional `extraActions` prop (how the list gets a *Generate* button). |
| `app/h5p/data/h5p-content-types.ts` | `contentTypeApi` is now exported (one keyword). |
| `app/h5p/data/h5p.ts`, `app/h5p/html_contents/page.tsx`, `app/_lib/module-screens.generated.ts` | Route map entry, hub icon, two screen entries. |
| `app/h5p/h5p.css` | `.h5p-prose`, `.bs-feedback`, `.bs-dot` (plain CSS, tokens only). |
| `lib/h5p/question-bank-h5p-map.ts`, `components/h5p/players/CoursePresentationPlayer.tsx` | Two stale comments ("planned, no table, no player") corrected. |

---

## 5. Database, API and configuration changes

**Database (additive, nothing altered, nothing run):** two tables (`h5p_branching_scenario`,
`h5p_branching_nodes`, soft-deleted, tenant-scoped, audit columns) and one registry sync. To deploy:

```bash
cd next_lms_erp
php artisan migrate                       # the two new migrations
php artisan pal:h5p-registry-sync         # only if migrate was skipped
```

**API (all under the existing `h5p` group, same `type=API` contract as every other type):**
`GET/POST h5p_branching_scenario`, `GET/PUT/DELETE …/{id}`, `POST …/{id}/publish`, `POST …/{id}/duplicate`,
`GET …/{id}/export`, `POST …/import`, `POST …/media` — and two new: **`GET …/sources`** (the chapter's topics and
concepts with suitability and reusable-question counts; read-only) and **`POST …/generate`** (returns a draft
and a report; **writes nothing**; teachers only; rate-limited).

**Configuration required before generation works** (none of this was changed):
`CLAUDE_CONTENT_CHAPTER_IDS` must list the chapter (or `*`), and an Anthropic key must exist
(`ai_api_keys` or `ANTHROPIC_API_KEY`). In the environment this was developed in, `claude.chapter_ids` is empty
and tenant 1 has no Anthropic key, so the dialog reports "not switched on for this chapter" there. The two
real generations in §6 used the dev-only `--executor=cli` path.

---

## 6. Test results

### Backend — no database (plain `PHPUnit\Framework\TestCase`; `Tests\TestCase` boots Laravel, whose provider reads the live DB)

```
php vendor/bin/phpunit --no-configuration --bootstrap vendor/autoload.php tests/Unit/H5P tests/Unit/StudyDeck/Branching
→ OK (86 tests, 365 assertions)     run with DB_HOST=127.0.0.1 DB_PORT=1 so a stray connection fails at once
```

Covers: every graph rule; the H5P params against the **upstream key lists**; build → parse round trip; a real
`.h5p` zip export and re-import (manifest, media packaging, wrong-library refusal); the controller's real write
paths (refs → ids, dangling-ref refusal, duplicate remapping, publish check on saved rows) **against the real
migration on a private in-memory SQLite database**; the generator end to end with a scripted model (13 skeleton
rules, repair rounds, writer cannot rewire, invented number caught and only that node rewritten, validator
rules); registration agreement (registry ↔ migration ↔ library ↔ routes ↔ adapter ↔ frontend route map); the
generation gate; and the **golden file** (PHP side).

### Frontend

```
node --import tsx --test "lib/h5p/branching-*.test.ts"      → 70 tests, 70 pass
npx tsc --noEmit                                            → clean for every source file
npx eslint <new and changed files>                          → clean
```

Includes the golden file run through the TypeScript implementation (15 scenarios: the editor's "ready" and the
server's publish check agree), the whole player state machine, scoring, back/restart, shuffled choice order, every
editor operation and invariant, and the text helper's round trips.

### Real chapter, real model, real data (chapter 8592, Std 9 Science; read-only DB, dev CLI executor)

| Run | Result |
| --- | --- |
| **A** — topic *Models* (4 concepts), standard length | validation passed: 18 steps, 5 decisions, 3 endings, **48 distinct node paths** (216 choice sequences), 4/4 concepts taught, 1 bank question reused verbatim, ~2,200 words of teaching |
| **B** — topic *Laws, theories, principles* (4 concepts), short, after prompt tuning | validation passed: 13 steps, 3 decisions, 3 endings, 12 paths, 4/4 concepts, sentence-case title, ~1,250 words |

Run A went through the real controller rules, real persistence (SQLite), the publish check (**publishable**), the
H5P params builder (15 content entries + 3 end screens) and a `.h5p` export/import round trip (**48 paths in, 48
paths out**). Reading the output found things the unit tests could not, and they were fixed: title in Title Case,
objectives as paragraphs, long sentences, feedback repeating the consequence screen, a bank question's table
rendered as loose text (now wrapped in a paragraph).

### Browser (Playwright, real Chrome, a **production build** served with `next start`, every backend call answered from fixtures — nothing reached a backend)

The fixture is the scenario generated for chapter 8592 (run A: 18 steps, 5 decisions, 3 endings). Five scripts, all
passing on the final build:

| Check | Result |
| --- | --- |
| **Every way through** | all **216 choice sequences** played to an ending; all 3 endings reached; the usage events add up exactly (216 completed, 1,080 answered, objectId `branching_scenario:<id>`); focus lands on the new step's heading (`H2`, `tabindex=-1`); no page errors |
| **Generate dialog** | working screen with elapsed time; review shows real stats (13 steps, 3 decisions, 3 endings, 12 paths) and that all 4 concepts are taught; picture suggestions offered, not invented; preview plays inside the dialog and records nothing; **nothing saved until "Save as draft"**, exactly one create call, 13 nodes addressed by ref, provenance kept, **no publish call**; a failed generation says why and that nothing was saved; generate is disabled when AI is not enabled for the chapter |
| **Editor** | the generated scenario opens as ready to publish; a new empty ending is named as the thing to fix; writing it clears that; rerouting a choice that orphans a step is reported by name; deleting a step says how many links were cleared and flags them; preview shows unsaved changes; save is a `PUT` that keeps ids and does not resend provenance |
| **Keyboard and accessibility** | a whole path played with the keyboard alone; axe-core (WCAG 2.0/2.1/2.2 A and AA plus best practice) on the start screen, a step, a decision, a consequence and an ending: no violations inside the scenario |
| **Phone width (390 px)** | no sideways scroll on the start screen, a decision or a consequence; choices at least 44 px tall |
| **Student and hub** | a student sees cards and none of the authoring buttons; a draft opened by a student is refused with "This scenario has not been published yet…"; the H5P hub card for the new type links to the list, counts items and steps, and has its own icon |

Findings from these runs that were fixed: low-contrast secondary text in the player (`--h5p-ink-faint`, 2.6:1,
now `--h5p-ink-muted`), the score chip on an ending (2.8:1, now 5.6:1), duplicate `id`s on the decision selects in
the editor, the generate dialog overflowing sideways when the story map was shown, and a student seeing a generic
"try again" for a draft.

One finding is **not** this feature's and was left alone: the Chapter / Subject / Standard chips in the shared H5P
page header (`H5pContextChips`) use slate-400 text at 2.6:1. They appear on every H5P page. Worth fixing once, there.

### Not verified

* **Nothing has run against the live database.** The migrations are unrun; persistence was proven on SQLite
  with the real migration, and the HTTP layer (request validation, session tenancy, middleware) needs a booted app.
* **No run inside a real H5P host.** Structural compatibility only (§1.1).
* **Browser runs used fixtures**, not a booted backend, so the real HTTP layer (session tenancy, middleware,
  throttling) was not exercised from the browser. The production build compiles with all four new routes.
* **No generation through the HTTP endpoint** (no Anthropic key here). The pipeline was run through the CLI executor;
  the endpoint is covered up to the model call.

---

## 7. Deliberate decisions and known limits

* **Native, not official.** See §1.1.
* **Static scoring only.** `no-score` and `static-end-score` (an ending is worth what it carries; the best ending
  is full marks). H5P's `dynamic-score` is not modelled; an imported package that uses it is converted and
  **reported**. A scenario therefore cannot claim a score the player does not compute.
* **Node kinds.** Screens, decisions, endings. A screen may carry a picture (exported as an `H5P.Image` step
  followed by the text step — reported). Embedding another H5P activity (Course Presentation, Image Hotspots,
  Interactive Video, Video) is **not** supported; such a node in an imported package becomes a placeholder screen and
  is named in the import warnings, so no branch is dropped silently.
* **Images are not generated.** Every image source in this codebase is licence-unconfirmed (see the study-deck
  notes), and a picture a teacher has no right to use is worse than none. The generator **suggests** where a
  picture would teach something (shown in the review); the editor and player fully support pictures with
  required alt text.
* **Bank questions are copied, with provenance** (`source_question_id`). Unlike the live-rendered bank players,
  an edit to the bank question afterwards does not change the scenario. Copying is what makes the scenario
  exportable and self-contained.
* **Cycles.** The editor and H5P allow "try that decision again" loops as long as every step can still reach an
  ending; the *generator* produces acyclic trees only, so every generated path terminates.
* **Generation is synchronous** (several model calls, typically 2–10 minutes), like the study documents: the
  request has a long time limit and the dialog can be cancelled. There is no background queue.
* **No resume across a reload.** Attempt state is in memory, as for every other H5P type here.
* **Choice order shuffle is per attempt**, seeded, so Back/forward in one attempt shows the same order.
* **Authoring defaults to plain text,** not a rich-text widget: paragraphs, bullets, numbered steps and
  bold/italic read as text; anything else (a table, a link) is shown as HTML and never silently flattened.

---

## 8. Security notes

* Tenancy comes from the session; every read is `findForTenant`; a chapter from another school is refused.
* A draft is invisible to students server-side (list and `show`), not just hidden in the UI.
* `generate` and `sources` are teacher-only; `generate` is rate-limited by the existing content-generation throttle
  and gated by `claude.chapter_ids`; it is audited even though it stores nothing.
* Stored HTML passes `HtmlLite` (allow-list; no attributes except a vetted link `href`); it is sanitised **again**
  by the project's `sanitizeHtml` at render, because an imported `.h5p` can carry anything.
* Import is untrusted input: the shared zip guards (size, entry count, path traversal, allowed media extensions).
