# H5P Drag and Drop — integration and testing report

**Status:** implemented, unit-tested, not yet run against a live database.
**Date:** 19 September 2026
**Repos:** `lms_k12` (Next.js frontend) · `next_lms_erp` (Laravel backend)

---

## 1. Read this first: what "H5P" means in this platform

The request asked to integrate the **official H5P library** `H5P.DragQuestion`,
following the architecture already used for Branching Scenario, Flashcards,
Interactive Video and Multiple Choice.

Those two things point in different directions, and it is worth being exact
about why before reading the rest of this document.

**Neither repository contains H5P.** There is no `h5p/h5p-core` in
`composer.json`, no `@lumieducation/*` or `h5p-standalone` in `package.json`, no
`h5p_libraries` / `h5p_contents` tables, and no H5P player JS anywhere in
`public/`. What exists is a family of **native content types** — each its own
Laravel tables, its own controller, and its own React authoring UI and player —
surfaced under an H5P-branded hub and bound together by the PAL V4 registry in
`config/pal_h5p.php`. `image_hotspot` is `h5p_scenarios`; `flash_cards` is
`h5p_flashcard`; `interactive_video` is `h5p_interactive_video`. The registry
calls this `implementation.status = 'native'` and is explicit about it.

(Also worth noting: there is no Branching Scenario module. The existing scenario
type is **image hotspot** — `scenario_based` — which is a different content type.)

So "register library `H5P.DragQuestion` and load all required dependencies
automatically" cannot mean what it means in Moodle or Drupal: there is no H5P
framework here to register a library *with*. Installing one would be a separate,
much larger piece of work — a library store, a dependency resolver, the H5P
player and editor bundles, content-user-data tables, and a second rendering
stack living beside the one this product already has.

### What was built instead, and why it satisfies the intent

Drag and Drop is implemented **as a native type, exactly like its four
siblings** — and its data is **shaped as H5P.DragQuestion params**, with real
`.h5p` package import and export on top.

That gets the three things the requirement is actually reaching for:

| The requirement | How it is met |
| --- | --- |
| Register the library `H5P.DragQuestion` | `config/h5p_libraries.php` registers the official machine name, version (1.14) and full dependency closure. It is written into every exported package's manifest and validated on import. |
| Load all required dependencies automatically | An exported `h5p.json` declares `H5P.DragQuestion` plus `jQuery.ui`, `H5P.Question`, `H5P.JoubelUI`, `H5P.Transition` and `FontAwesome`, in install order, so an importing H5P host resolves them from its own store without being told. |
| Import / export H5P package | Real `.h5p` archives (`h5p.json` + `content/content.json` + `content/images/*`), readable by Moodle, Drupal, Lumi and h5p.com. |

And it leaves the door open: because the stored rows project cleanly onto
`H5P.DragQuestion` params (`H5PDragQuestionBuilder`), adopting the official
player later becomes a change of **renderer**, not a change of **data model** or
a re-authoring exercise.

**The one thing this does not do** is bundle the library *code* in the export.
An official h5p.com export contains an `H5P.DragQuestion/` directory of JS and
CSS; ours does not, because we do not host that code. A library-less package is
a supported H5P form — the host resolves dependencies from its own library store
— but a host with no `H5P.DragQuestion` installed will say so rather than render
it. If bundling matters, the next step is vendoring the official library
directory and copying it into the archive; nothing else about this design
changes.

If the intent really was to install the H5P framework proper, say so and that
becomes its own piece of work. Everything below ships and is usable either way.

---

## 2. What was delivered

### Backend — `next_lms_erp`

| File | What it is |
| --- | --- |
| `database/migrations/2026_09_19_120000_create_h5p_drag_drop_tables.php` | `h5p_drag_drop`, `h5p_drag_drop_zones`, `h5p_drag_drop_elements`. Soft deletes, tenant column, audit columns, the indexes the list and registry queries need. |
| `app/Models/lms/h5p/H5pDragDrop.php` · `H5pDragDropZone.php` · `H5pDragDropElement.php` | Eloquent models with casts and relations. |
| `app/Http/Controllers/lms/h5p/H5PDragDropController.php` | Resource CRUD, `publish`, `media` (image upload), `export`, `import`. Session-derived tenancy, `type=API` JSON contract, `AuditLog` on every write. |
| `app/Services/lms/H5P/H5PDragQuestionBuilder.php` | Rows ⇄ `H5P.DragQuestion` params. |
| `app/Services/lms/H5P/H5PPackageService.php` | `.h5p` zip read/write, media bundling, import hardening. |
| `config/h5p_libraries.php` | The library registry: machine name, version, dependency closure, import limits. |
| `config/pal_h5p.php` | `drag_and_drop` flipped from `status: planned` to `status: native` with its `implementation` block. |
| `app/Services/lms/Content/H5PContentAdapter.php` | `drag_drop` added as a fourth source, `published_only`. |
| `routes/lms.php` | Nine routes inside the existing `h5p` prefix group. |
| `resources/views/lms/h5p/dragdrop/*.blade.php` | Legacy Blade surface (see §6). |
| `database/seeders/H5PDragDropSampleSeeder.php` | Two sample activities. |
| `tests/Unit/H5PDragQuestionBuilderTest.php` | 8 tests, 43 assertions. |

### Frontend — `lms_k12`

| File | What it is |
| --- | --- |
| `app/h5p/data/h5p.ts` | Types, API functions, client-side scoring, solution derivation. Appended to the existing module; `H5P_ROUTE_MAP` gained `h5p_drag_drop.index`. |
| `app/h5p/h5p_drag_drop/page.tsx` | List, with publish/unpublish, delete, export, import. |
| `app/h5p/h5p_drag_drop/create/page.tsx` | Create, with save-as-draft and save-and-publish. |
| `app/h5p/h5p_drag_drop/[id]/edit/page.tsx` | Edit, with preview and publish toggle. |
| `app/h5p/h5p_drag_drop/[id]/page.tsx` | Player: drag, keyboard placement, check, retry, show solution, xAPI. |
| `app/h5p/h5p_drag_drop/components/editor.tsx` | The authoring canvas, shared by create and edit. |
| `app/h5p/html_contents/page.tsx` | Icon for the new registry code. |

---

## 3. How the pieces fit

### The content-library card is not hand-written

The H5P hub renders whatever the PAL registry reports as native. Flipping
`drag_and_drop` to `status: native` in `config/pal_h5p.php` is what makes the
card appear, carrying its title, description, route, icon, live item count and
drop-zone count. The only frontend change needed was one icon mapping.

**This requires a registry sync to take effect:**

```bash
php artisan pal:h5p-registry-sync
```

The registry is read from `pal_vocabulary` at runtime, with `config/pal_h5p.php`
as the seed and offline fallback. Until the sync runs on an environment whose
`pal_vocabulary` is already populated, the card will not appear there.

- **Name:** Drag and Drop ✔
- **Description:** "Learners can drag text or images into correct drop zones." ✔
- **Category:** the registry has no `category` axis for H5P types — items are
  classified by pedagogy and Bloom range. `category: 'assessment'` was recorded
  on the implementation block, and the existing `bloom_from/to: apply` and
  `pal_use_cases` already place this type on the assessment/practice side.

### Ids, indices and refs

Three representations, and mixing them up is the one thing that silently
corrupts an activity:

- **Database ids** — what the rows use.
- **Params indices** — `H5P.DragQuestion` references elements and zones by their
  *position* in the params arrays, as strings. `correctElements: ["0","3"]`.
- **Refs** — client-side strings used while authoring, before ids exist.

`H5PDragQuestionBuilder` translates ids ⇄ indices; the controller's
`syncChildren()` translates refs → ids in one pass (elements first, then zones
with real element ids, then back-fill the element side). Two of the unit tests
exist purely to catch a regression here, and they use non-sequential ids
(501, 733, 812) so an id-used-as-index bug cannot hide.

### Scoring

`scoreDragDropAttempt()` mirrors H5P.DragQuestion rather than inventing a scheme:

- **Max score is the number of correct (element, zone) pairs**, not the number
  of draggables — so a one-to-many item that belongs in three zones is worth
  three, and a partly-completed sort scores proportionally.
- **`applyPenalties`** subtracts one per wrong placement, floored at zero. Off
  means wrong placements simply do not count.
- **`singlePoint`** makes the whole activity worth 1, awarded at the pass mark.

### Analytics

The player posts xAPI to the existing `POST /api/pal/h5p/xapi` pipeline with
object ids of the form `drag_and_drop:<id>`. `H5PXapiPipeline` parses that
`<type>:<id>` form and normalises the type against the registry, so **no backend
analytics change was needed** — the type resolves the moment the registry knows
it.

| Tracked | How |
| --- | --- |
| Attempt count | One `attempted` on first interaction; one `answered` per check. |
| Completion status | `completed` on the first passing attempt. |
| Score / max score | `result.score` on each `answered`. |
| Time spent | `result.duration` (ISO 8601), reset per attempt so retries report their own time rather than a growing total. |

`answered` is the verb `config/pal_h5p.php` wires to the BKT mastery and
misconception-detection jobs, so this feeds real PAL analytics, not a log.

### LMS integration

`H5PContentAdapter` is the seam. Adding `drag_drop` to its `SOURCES` surfaces
published activities into the chapter content list under **H5P Interactive**,
which is what courses, lessons, topics, learning activities, homework,
worksheets and assessments all read. Ids are namespaced (`h5p:drag_drop:7`) so
they can never collide with a `content_master.id`.

Drafts are filtered out there and in the list API — an unfinished activity
should not reach a student through any of those surfaces at once.

---

## 4. Test results

```
$ php vendor/bin/phpunit --filter H5PDragQuestionBuilderTest
PHPUnit 11.5.56 · PHP 8.2.12
........                                                  8 / 8 (100%)
OK — Tests: 8, Assertions: 43
```

(The 16 PHPUnit deprecations reported alongside are suite-level and pre-existing
— an unrelated `ExampleTest` run reports the same 16.)

| Test | What it protects |
| --- | --- |
| `converts_ids_into_params_indices_on_both_sides` | The id ⇄ index translation, on both the element and zone sides, with non-sequential ids. |
| `drops_references_to_deleted_items` | A zone pointing at a deleted element does not emit a dangling index. |
| `maps_element_types_to_the_official_sub_libraries` | Text → `H5P.AdvancedText 1.1`, image → `H5P.Image 1.1`, correct MIME. |
| `behaviour_and_pass_mark_survive_a_parse` | Build → parse keeps pass mark, retry/penalty/single-point flags, canvas size, one-to-one vs one-to-many, and the mapping. |
| `sub_content_ids_are_stable_across_exports` | Exporting twice produces identical packages (diffable exports, idempotent re-import). |
| `export_writes_a_manifest_with_the_full_dependency_closure` | `mainLibrary`, dependency list and install order in `h5p.json`; element/zone counts in `content.json`; un-fetchable media reported as warnings. |
| `import_rejects_a_package_of_the_wrong_type` | An `H5P.InteractiveVideo` package is refused with a message naming both types. |
| `import_round_trips_an_exported_package` | Export → import preserves title, pass mark, counts, mapping and element types. |

### Frontend checks

```
$ npx tsc --noEmit        # clean
$ npx eslint app/h5p/h5p_drag_drop app/h5p/data/h5p.ts app/h5p/html_contents/page.tsx
                          # clean — 0 errors, 0 warnings
```

### Not yet verified — needs a live environment

Everything below is written and lints/typechecks, but has not been exercised
against a running database and server. **These are the steps to close out the
validation section of the request:**

1. `php artisan migrate` — create the three tables.
2. `php artisan pal:h5p-registry-sync` — publish the registry change so the
   content-library card appears.
3. `php artisan db:seed --class=H5PDragDropSampleSeeder` — two sample
   activities (set `H5P_SAMPLE_CHAPTER` etc. to a chapter that exists).
4. Open the H5P hub for that chapter → confirm the **Drag and Drop** card, with
   an item count of 2.
5. Create → place zones and draggables, upload a background, map them, save as
   draft → confirm rows in all three tables and the draft chip in the list.
6. Edit → move an item, change the pass mark, save → confirm the change persists
   and the old child rows are soft-deleted rather than hard-deleted.
7. Publish → confirm the publish blocker fires on an unmapped activity, and
   that publishing succeeds once a zone has a correct draggable.
8. Preview as a student → drag, check, retry, show solution.
9. Confirm xAPI rows reach the pipeline and that PAL's engagement figures for
   `drag_and_drop` become non-null.
10. Export → re-import → confirm the round trip, and open the exported `.h5p`
    in Lumi or a Moodle with `H5P.DragQuestion` installed.
11. Confirm published activities appear in the chapter content list under
    **H5P Interactive**, and drafts do not.

A full `next build` was not run — `tsc --noEmit` and ESLint both pass, which
covers type and lint correctness, but a production build has not been timed.

---

## 5. Authoring features

All requested features are present:

| Feature | Where |
| --- | --- |
| Background image | Editor toolbar → **Background image**. Uploaded via `POST /h5p/h5p_drag_drop/media`, DigitalOcean with local fallback (the same path the scenario type uses). |
| Multiple drop zones | **Add drop zone**, unlimited, drag to move, corner handle to resize. |
| Text draggables | **Add text draggable**. |
| Image draggables | **Add image draggable** — uploads and places in one step. |
| One-to-one mapping | Zone → **One item only** (default). |
| One-to-many mapping | Clear **One item only** on the zone; set **Can go in several zones** on the draggable. |
| Scoring configuration | Pass mark, penalties on/off, single-point on/off. |
| Retry button | Zone-independent task setting. |
| Show solution button | Task setting; places the correct answer on the canvas. |

Two things worth knowing about the mapping UI: marking a draggable **correct**
in a zone automatically makes it **droppable** there (keeping two lists in step
by hand is how authors produce activities that cannot be completed), and
removing the droppable allowance removes the correctness that depended on it.

---

## 6. Deliberate scope calls

- **Blade views are thin.** `resources/views/lms/h5p/dragdrop/` has a working
  list plus export links; create, edit and play point at the Next.js app. The
  authoring canvas and the player are ~1,400 lines of React; a second
  implementation in Blade would drift from the first and has no users, since
  every H5P surface is being built in Next.js now.
- **No `category` axis was invented** in the PAL registry to hold "Assessment".
  The registry classifies by pedagogy and Bloom range; adding a parallel
  taxonomy for one type would fork the vocabulary. The value is recorded on the
  implementation block where it does no harm.
- **Writes are JSON, not multipart.** The other H5P types post multipart forms.
  A drag-and-drop task is two arrays of positioned children that reference each
  other; flattening that into form keys would be unreadable on both sides. The
  consequence is that `_method` spoofing has to travel in the **query string** —
  Laravel does not read it from a JSON body — which `methodOverride()` in
  `app/h5p/data/h5p.ts` handles and documents.
- **Children are replaced wholesale on update, not diffed.** The client sends
  refs, so there is nothing stable to diff against, and a task holds tens of
  rows rather than thousands. Soft deletes keep the old rows for audit.
- **Keyboard placement was built, not deferred.** Every draggable is a button
  that can be picked up and every zone accepts it — the same state and the same
  scoring as pointer dragging. H5P's own player does not give us this, and a
  drag-only assessment is not usable by a student on a keyboard or a switch.

---

## 7. Security notes

- **Import is untrusted input.** Uploaded `.h5p` archives are bounded on package
  size, uncompressed size and entry count (zip-bomb guard); every entry name is
  path-checked before extraction, so an entry naming `../../public/index.php` is
  rejected rather than written; and only a configured list of image extensions
  is extracted. Limits live in `config/h5p_libraries.php`.
- **Tenancy comes from the session, not the request.** `sub_institute_id` and
  `user_id` are read from the session — hydrated from a verified JWT for
  `type=API` callers — with the request values validated but never trusted. This
  matches the note already carried in `H5PFlashcardController`.
- **Every read is tenant-scoped.** `findForTenant()` is the only way a task is
  loaded, so an id from another school 404s rather than leaking.
- **Drafts are filtered server-side** in both the list API and the content
  adapter, not hidden in the UI.

---

## 8. Post-release fix: "You scored 0 out of 1"

**Reported:** items drop into their assigned zones, but every check returns
`0 out of 1`.

**Cause: an authoring UI defect, not a scoring defect.** Inspecting the saved
rows showed the element side of the mapping populated and the zone side empty
on every zone:

```
EL   id=4 text='patel' drop_zone_ids='[4]'
EL   id=5 text='Sepal' drop_zone_ids='[5]'
ZONE id=4 label='patel' correct_element_ids='[]'
ZONE id=5 label='Sepal' correct_element_ids='[]'
```

With no correct pairs, `maxScore` fell to its `Math.max(1, 0)` floor and the
score was necessarily 0 — hence the odd `0 out of 1` for a two-item task.

The data got that way because the editor's **element** inspector offered only
one checkbox, *"Zones this may be dropped into"*, which sets droppability, with
a read-only "correct" chip that could not be turned on from that panel.
Correctness was reachable **only** from the zone inspector. An author mapping
the task from the draggable outwards therefore built something that looked
complete, allowed every drop, and could never award a mark.

Both affected tasks were `status=draft` — the server-side publish blocker had
correctly refused them. The guard worked; the UI that led the author there did
not.

**Fixed:**

- The element inspector now has two explicit columns per zone — **Correct** and
  **Can drop** — with correct implying droppable. The mapping can be built
  fully from either side.
- A zone with no correct draggable shows an inline warning in its inspector.
- `toggleAllowed` was rewritten as a single patch; it previously called
  `updateElement` and then `patch` with state computed before the first update,
  which could drop one of the two changes.
- The player no longer reports an unmarkable task as a score. A new `scoreable`
  flag distinguishes "got it wrong" from "there is nothing to mark", and the
  player says so plainly.
- Previewing a draft now says it is a draft.
- Opt-in diagnostics: append `?h5pDebug=1` to the player URL to log the authored
  mapping on load, and on every drop the draggable id, zone id, allowed zone
  ids, the zone's accepted element ids, and whether the drop counted.

**Scoring itself was not changed** beyond the `scoreable` flag and a `passed`
guard. It was moved to `lib/h5p/drag-drop-scoring.ts` — no imports, structurally
typed — so it can be tested without a browser, and covered by
`lib/h5p/drag-drop-scoring.test.ts` (9 tests, all passing), including a
regression test that reproduces the exact broken-data shape above.

Comparison is by numeric id throughout; no label, caption or alt text is read
during scoring, so renaming a zone cannot change the answer key and casing or
whitespace in a label cannot make a right answer read as wrong.

**The two existing draft activities still have empty answer keys.** Open each in
the editor, tick **Correct** against the right zone for every draggable, and
publish.

---

## 9. Post-release fix: the background image was cropped

**Reported:** an uploaded background does not display fully — parts of the
image are cut off — and the canvas will not take the image's shape.

**Cause.** The canvas drew its background with `object-fit: cover` into a box
whose aspect ratio came from `canvas_width` / `canvas_height`, and nothing ever
set those from the image. Every task therefore opened at the 620×310 default —
roughly 2:1 — and cover fills a box by cropping whatever does not fit. A square
diagram lost both ends; a portrait one lost most of itself.

The second-order damage is the one that matters for a labelled diagram. Zone
and element geometry is stored as a **percentage of the canvas**, which only
means anything if the image occupies the whole canvas. Under cover it does not,
so a zone the author drew over a visible label sat over a different part of the
image — or over a part that had been cropped away entirely.

**Fixed:**

- `lib/h5p/drag-drop-canvas.ts` is the new single definition of how a
  background meets a canvas: the four fit modes, the object-fit class for each,
  the canvas size derived from an image, and the aspect ratio the box renders
  at. Both the editor and the player read it, so the student's canvas resolves
  the image exactly the way the authoring canvas did.
- **`contain` is the default**, and under it the canvas takes the *image's* own
  aspect ratio. The whole image is visible, nothing is cropped, the canvas
  height follows the image rather than the 2:1 default, portrait and landscape
  both work, and one percent of the canvas is one percent of the image — which
  is what keeps the drop zones aligned after any scaling.
- **Uploading a background now sets the canvas to the image's intrinsic size**,
  measured from the picked file before the upload so it lands in the same state
  patch as the URL. At that size all four modes agree. The size is scaled into
  the range the save endpoint already validated (200–4000 × 120–4000),
  preserving the ratio.
- **Four author-visible fit options** — Contain (recommended), Cover, Original
  size, Stretch — in a picker next to the background button, each with a
  one-line note on what it gives up. Stored as `image_fit` on `h5p_drag_drop`
  (`2026_09_19_140000_add_image_fit_to_h5p_drag_drop_table.php`), defaulting to
  `contain`, so **existing tasks become fully visible rather than cropped**.
- **"Fit canvas to image"** appears only when the stored canvas has drifted from
  the image's proportions — an older task, or a file swapped by hand. It
  re-aligns the coordinate space without touching a single zone, which is safe
  precisely because the geometry is percentages.
- The fit rides through export/import in the `eduerpExtensions` block.
  H5P.DragQuestion has no background fit of its own, so a package that never
  carried one parses as `contain`.

Responsiveness needed no breakpoint work: the canvas is `width: 100%` plus an
aspect ratio, so desktop shows the full image width and tablet and phone scale
proportionally, with no crop at any width.

**Covered by** `lib/h5p/drag-drop-canvas.test.ts` (8 tests, all passing) —
16:9, 1:1 and 9:16 images each keep their ratio, every derived size is one the
save endpoint accepts, a portrait image produces a taller canvas than a wide
one, contain overrides a mismatched stored canvas while the other three do not,
and an unknown or missing fit reads as `contain`. The builder's
`behaviour_and_pass_mark_survive_a_parse` gained the `image_fit` round trip.
