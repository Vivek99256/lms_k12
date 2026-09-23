# H5P Single Choice Set and True/False — integration and testing report

**Status:** implemented, unit-tested, typechecked, linted, builds clean. **Not yet run against a live database or a browser.**
**Date:** 21 September 2026
**Repos:** `lms_k12` (Next.js frontend) · `next_lms_erp` (Laravel backend)

This is the second vertical of 21 September 2026. The first added Image Hotspots,
Memory Game, Course Presentation and Arithmetic Quiz and is documented in
`docs/h5p-content-types-2026-09-21.md`; everything that report says about the
shape of this platform still holds, and §1 below is the part worth re-reading
rather than assuming.

---

## 1. Read this first: what "integrate the official H5P library" means here

### 1.1 Neither repository contains H5P

Unchanged from the two verticals before this one. There is no `h5p/h5p-core` in
`composer.json`, no `@lumieducation/*` or `h5p-standalone` in `package.json`, no
`h5p_libraries` / `h5p_contents` tables, and no H5P player JS in `public/`.
Every "H5P" type this platform ships is a **native implementation** over its own
tables, rendered by this product's own player, surfaced under an H5P-branded hub
and bound together by the PAL V4 registry.

So "register the official libraries `H5P.SingleChoiceSet` and `H5P.TrueFalse`"
cannot mean what it means in Moodle or Drupal. What was built instead is what
was built for the six types before these two:

| The requirement | How it is met |
| --- | --- |
| Register the libraries | `config/h5p_libraries.php` registers both official machine names, versions and full dependency closures. |
| Auto-load dependencies | Every exported `h5p.json` declares the whole closure in install order, so an importing host resolves it from its own store. |
| Support library upgrades | The version and closure live in one config entry each; a minor bump is a one-file edit, and `libraryVersionString()` is the only thing that reads it. |
| Content validation | Server-side validation per type, a save-time refusal for the single-correct-answer invariant, and a publish check that refuses content that cannot be used, naming the thing to fix. |
| Store content JSON using the existing architecture | Rows are the source of truth; built H5P params are cached in `content_json` on every write, exactly as the existing types do. |
| Reuse repository, services, adapters, controllers, rendering engine | Both controllers extend `H5PContentTypeController`; both package services extend `H5PContentPackageService`; both builders use `ConvertsToH5PParams`; both frontends use `ContentTypeListPage` / `ContentTypeCreatePage` / `ContentTypeEditPage` unchanged. |
| Compatibility with existing types | Nothing existing was modified. See §7. |
| Import / export | Real `.h5p` archives readable by Moodle, Drupal, Lumi and h5p.com. |

Because the stored rows project cleanly onto each library's params, adopting the
official player later stays a change of **renderer**, not of data model.

**What this does not do** is bundle library *code* in exports. A library-less
package is a supported H5P form — the host resolves from its own store — but a
host with no `H5P.SingleChoiceSet` installed will say so rather than render it.

### 1.2 Both types are WIDER than the libraries they are named after

This is the substantive design decision in this vertical, and it is the same
decision `H5PArithmeticQuizBuilder` already made for a different reason.

**True/False is the sharp case.** `H5P.TrueFalse` holds exactly ONE statement
with one boolean answer. That is a faithful modelling of the widget and a
useless modelling of the classroom: nobody sets a single true/false question,
and the brief itself asks for "Question Pool Support" and for a ten-question
sample. So an item here is a **pool**, and the export does both things at once:
the first statement becomes the `question` / `correct` pair a stock host runs,
and the whole pool travels in an `eduerpPool` extension this importer reads back
exactly.

**Single Choice Set is the softer case.** The library's shape is right — a run
of questions, one right answer each — but it has no field for per-question or
per-option feedback, randomised order, or points per question, all of which the
brief asks for. Those travel in `eduerpSet`.

The consequence, stated plainly: **a package exported from here opens in Moodle
or Lumi as a narrower activity, not a broken one, and re-imports here complete.**
The export endpoint returns a warning naming exactly what a foreign host will
drop, and the list page shows it to the author at the moment they download the
file. §6 has the full table.

The alternative — writing ten statements into a field H5P will ignore — would
look like it worked and would not.

### 1.3 `H5P.TrueFalse` was already in the registry, as a sub-library

`config/h5p_libraries.php` already declared `H5P.TrueFalse 1.8` inside the
**Course Presentation** dependency closure, because a deck can carry a
true/false question as a slide element. That is not duplication to remove: a
deck asks an importing host to resolve it as a SUB-library, and the new entry
asks a host to resolve it as the MAIN one. The version numbers are deliberately
identical, and the config carries a comment saying that if one moves the other
belongs in the same edit.

### 1.4 `multiple_choice` is untouched

The registry already had a `multiple_choice` type. It is the
`question_type_id = 1` slice of the shared chapter question bank
(`lms_question_master`), it has no draft state, no publish cycle and no package
exchange, and it is surfaced as the "Multiple Choice Questions" card. Single
Choice Set is a different content type on its own tables with the full
lifecycle, and it got its own registry code, its own card and a visibly
different glyph so the two cards cannot be mistaken for one another. **Nothing
about `multiple_choice` changed.**

---

## 2. What was delivered

### Backend — `next_lms_erp`

| File | What it is |
| --- | --- |
| `database/migrations/2026_09_21_170000_create_h5p_single_choice_set_tables.php` | `h5p_single_choice_set`, `h5p_single_choice_questions`, `h5p_single_choice_options`. |
| `database/migrations/2026_09_21_180000_create_h5p_true_false_tables.php` | `h5p_true_false`, `h5p_true_false_questions` (a row is one statement in the pool). |
| `database/migrations/2026_09_21_190000_sync_h5p_question_type_registry.php` | Re-publishes the PAL registry so the two new types are visible at runtime. |
| `app/Models/lms/h5p/H5pSingleChoiceSet.php` · `H5pSingleChoiceQuestion.php` · `H5pSingleChoiceOption.php` · `H5pTrueFalse.php` · `H5pTrueFalseQuestion.php` | Five models with casts, relations, publish helpers and `maxScore()`. |
| `app/Http/Controllers/lms/h5p/H5PSingleChoiceSetController.php` | Two-pass child writes, the single-correct-answer refusal, publish blockers, import mapping. |
| `app/Http/Controllers/lms/h5p/H5PTrueFalseController.php` | Pool writes, per-statement media, the all-one-answer publish blocker. |
| `app/Services/lms/H5P/H5PSingleChoiceSetBuilder.php` · `H5PTrueFalseBuilder.php` | Rows ⇄ official params, both directions. |
| `app/Services/lms/H5P/H5PSingleChoiceSetPackageService.php` · `H5PTrueFalsePackageService.php` | The `.h5p` cycle; True/False walks media in two places (see §3). |
| `config/h5p_libraries.php` | Two library registrations: machine name, version, dependency closure, editor closure. |
| `config/pal_h5p.php` | `single_choice_set` and `true_false` added as `native` types, sort order 13 and 14. |
| `app/Services/PAL/H5P/H5PRegistrySeeder.php` | Two codes added to `ADDED_H5P_TYPES`. |
| `app/Services/lms/Content/H5PContentAdapter.php` | Two new sources, both `published_only`. This is the whole of the LMS integration — see §4. |
| `routes/lms.php` | Both types added to the existing shared route loop. |
| `resources/views/lms/h5p/{singlechoiceset,truefalse}/` | Thin Blade surfaces, matching the pattern the other types use. |
| `database/seeders/H5PQuestionTypeSampleSeeder.php` | The two samples the brief specifies (§9). |
| `tests/Unit/H5PQuestionTypeBuilderTest.php` | 22 tests, 93 assertions. |

### Frontend — `lms_k12`

| File | What it is |
| --- | --- |
| `lib/h5p/single-choice-set.ts` (+ test) | Seeded shuffling, answer resolution, feedback precedence, scoring. 21 tests. |
| `lib/h5p/true-false.ts` (+ test) | Seeded pool draw, scoring, answer balance. 24 tests. |
| `app/h5p/data/h5p-content-types.ts` | Row types, save payloads, two generated API clients, defaults, blank-question factories. |
| `app/h5p/data/h5p.ts` | Two `H5P_ROUTE_MAP` entries. |
| `app/h5p/html_contents/page.tsx` | Two icon mappings. |
| `app/h5p/h5p_single_choice_set/**` | List, create, edit, player, question editor. |
| `app/h5p/h5p_true_false/**` | List, create, edit, player, statement editor. |

No shared component was modified. `ContentTypeListPage`, `ContentTypeCreatePage`,
`ContentTypeEditPage`, `FeedbackBandEditor` and `fields.tsx` are used exactly as
they are.

---

## 3. How the pieces fit

### The content-library cards are not hand-written

The hub renders whatever the PAL registry reports as native, carrying each
type's title, description, category, route, icon and live counts. The only
frontend change needed was two icon mappings.

**This requires a registry sync to take effect:**

```bash
php artisan migrate          # includes 2026_09_21_190000_sync_h5p_question_type_registry
# or, on an environment already migrated:
php artisan pal:h5p-registry-sync
```

Verified on this machine: the registry's runtime source is `database`, the two
new codes are **not yet** in `pal_vocabulary`, and the config seed resolves
correctly for both. That gap is exactly what the sync migration closes, and it
is why editing `config/pal_h5p.php` alone would have shipped two invisible
content types.

### The correct answer is a flag here and a position in H5P

`H5P.SingleChoiceSet` stores a question as `{question, answers: [...]}` and
declares that `answers[0]` **is** the correct one. There is no `correct` key
anywhere in the format. This schema stores an `is_correct` flag instead, because
a flag survives an author reordering their options and a position does not.

The conversion therefore happens in exactly two places —
`H5PSingleChoiceSetBuilder::build()` and `::parse()` — and nowhere else.
Every bug this type can have that reaches a classroom without looking broken is
a bug in those two functions, which is why they carry the heaviest test coverage
in the vertical and why the sample content deliberately puts the right answer at
a different position in each question.

Three defences, at three layers:

1. **The editor cannot produce a bad question.** The correct answer is a radio
   group, not a checkbox per option, so "two right answers" and "no right
   answer" are unreachable states rather than validated ones. Deleting the
   marked option moves the mark to the first survivor.
2. **The save refuses one anyway**, because a payload can arrive from something
   other than this editor. `assertOneCorrectAnswer()` raises a normal validation
   error keyed to the offending question, so the message lands beside it rather
   than in a banner at the top of a thirty-question form.
3. **Publish re-checks the stored rows**, because a row can also arrive by
   import or duplicate.

### True/False media appears twice in one params object

The first statement's image is written into `media.type`, where the library
looks for it, **and** into `eduerpPool.questions[0].media`, where this importer
looks. Rewrite only the first on export and a re-import gets an absolute URL
back for question 1 and packaged paths for the rest — which works for exactly as
long as the exporting server stays reachable, and then silently does not.

`H5PTrueFalsePackageService::rewriteMedia()` therefore walks both, and walks the
pool in full rather than "the rest". The rewrite callback is content-addressed
by path, so an image referenced twice is packed once.

### Scoring lives in `lib/`, never in a player

`lib/h5p/single-choice-set.ts` and `lib/h5p/true-false.ts` have no imports. They
take structural inputs, so the row types satisfy them without either side
depending on the other, and they are testable without a browser, a fetch stub or
a React tree. The players move state and render; they never decide a mark.

### Both draws are seeded, and the seed is kept

Shuffling a single choice set and drawing from a true/false pool are both seeded
permutations, with the seed drawn once per attempt and held in attempt state.
That buys three things, and the third is the one that matters:

1. a learner who reloads mid-attempt gets the same paper back, not a new one;
2. the tests assert on real papers rather than on statistics over a sample;
3. a teacher looking at a result can reconstruct exactly what the learner was
   asked — without which "she got 4 out of 10" is not a fact anyone can act on.

---

## 4. LMS integration: what was added, and what did not need to be

The brief asks that both types be usable inside courses, lessons, topics,
concepts, learning activities, homework, worksheets, projects, assessments,
practice activities, remedial learning and teacher resources.

**All of those read chapter content from one place**:
`H5PContentAdapter::forChapter()`, which surfaces H5P items into the content list
as a *format* (`format: 'h5p'`, category `H5P Interactive`) rather than as a peer
category. Two new `SOURCES` entries is the entire integration. There is no
per-consumer registration, and none was added — which is the point of that
adapter and is why adding a type does not touch twelve call sites.

Both entries are `published_only`, matching every type since Drag and Drop: a
draft is authored work in progress, and this list is read by every student-facing
surface at once.

Assignment and launch work the same way they do for the existing types: the item
is addressed by its namespaced id (`h5p:single_choice_set:7`), and the deep link
is `/h5p/h5p_single_choice_set/{id}` with the chapter context on the query
string.

---

## 5. Analytics and xAPI

Both players emit through `postH5pXapiStatement`, the same helper every other
H5P player in this app uses, into `POST /api/pal/h5p/xapi`:

| Statement | When | Carries |
| --- | --- | --- |
| `answered` | as each question is answered | `success`, `response` (the chosen option as plain text, or `"true"` / `"false"`), chapter / subject / standard context |
| `completed` | at the end of an attempt | `success` (passed), `response` (`score/maxScore`), `duration` (ISO 8601 seconds) |

`answered` is emitted per question **as it happens**, not batched at the end, so
an abandoned attempt still produces evidence of the questions that were reached.

Both registry entries declare `xapi_events: ['answered', 'completed']`, which is
what binds them into the existing pipeline — `H5PXapiPipeline`, the analytics
dashboard, student reports, progress tracking, the competency framework and the
evidence collection pipeline all read the registry rather than a hard-coded type
list.

The nine tracked fields the brief lists are covered as follows. Six come
directly from the statements above; three are the pipeline's, computed from them
exactly as they are for every existing question type:

| Field | Source |
| --- | --- |
| Score, Max score, Percentage | `completed.result.response` and the server's computed `max_score` on the row |
| Success status | `completed.result.success` |
| Completion status | the presence of a `completed` statement |
| Time spent | `completed.result.duration` |
| Attempt count, First attempt, Last attempt | the pipeline, by counting and bounding the statements for `(learner, object)` |

**`max_score` is computed server-side and sent with every row**, deliberately
never recomputed in the frontend: the list page, the player and the analytics
pipeline have to agree on what an activity is worth, and three independent
counts is three chances to disagree.

Two type-specific notes worth having in a report:

- **True/False `max_score` counts the paper drawn, not the pool.** A learner
  asked ten of twenty is scored out of ten. Scoring against the pool would
  report every attempt as a half-mark failure, and the test named
  `the score is out of the paper drawn, not out of the pool` exists to stop that
  regressing.
- **True/False carries the lowest `engagement_weight` in the registry (0.7).** A
  two-way question is guessable half the time, so a session on it is weaker
  evidence of engagement than any other scored type. The weight is what stops a
  term of true/false reading as a term of deep work in the engagement figures.
  Single Choice Set is 0.9 — slightly above `multiple_choice` at 0.8, because
  the one-at-a-time rhythm with feedback between questions holds attention
  better than a page with a submit button.

---

## 6. Where this product is richer than H5P, and what happens on export

| Authored here | `H5P.SingleChoiceSet` | On export | Re-imported here |
| --- | --- | --- | --- |
| Per-question feedback | no field | dropped by a foreign host; kept in `eduerpSet` | complete |
| Per-option feedback | no field | same | complete |
| Explanation per question | no field | same | complete |
| Randomised question order | no field | fixed order in a foreign host | complete |
| Randomised answer order | no field | fixed order in a foreign host | complete |
| Points per question | always 1 | scored 1 per question elsewhere | complete |
| Task description | no field | not shown elsewhere | complete |

| Authored here | `H5P.TrueFalse` | On export | Re-imported here |
| --- | --- | --- | --- |
| A pool of *n* statements | exactly 1 | a foreign host shows the **first** only | all *n* |
| Per-statement feedback | only for its one question | the first statement's is lifted onto `behaviour`; the rest ride in `eduerpPool` | complete |
| Explanation per statement | no field | dropped by a foreign host | complete |
| `questions_to_ask` draw | no field | not drawn elsewhere | complete |
| Points per statement | always 1 | scored 1 elsewhere | complete |

The export endpoint returns these as `warnings` in an `X-H5P-Export-Notes`
header (base64'd JSON, because a header cannot carry newlines), and
`ContentTypeListPage` shows them beside "Package downloaded." — at the moment
the author hands the file over, which is the only moment they can act on it.

**A warning is raised only when something is actually lost.** A single-statement
true/false, or a single choice set with no extras, exports losslessly and says
nothing. A warning on every export teaches authors to ignore warnings, and both
builders have a test asserting the quiet case.

---

## 7. Nothing existing was modified

Every backend change outside the new files is additive:

- `config/h5p_libraries.php` — two new entries appended inside `libraries`.
- `config/pal_h5p.php` — two new type entries inserted; no existing entry's
  status, label, sort order, weight or implementation block was touched.
- `H5PRegistrySeeder::ADDED_H5P_TYPES` — two codes appended. Both are genuinely
  new codes, so they are this seeder's to prune on a rollback; no promoted type
  was added to that list.
- `H5PContentAdapter::SOURCES` — two entries appended.
- `routes/lms.php` — two entries added to the **existing** shared route loop
  rather than a second loop, because the route shape is identical and a second
  loop would be a second place for the "declare non-id routes before the
  resource" rule to be got wrong.

And on the frontend:

- `h5p.ts` — two `H5P_ROUTE_MAP` entries.
- `html_contents/page.tsx` — two icon mappings and two imports.
- `h5p-content-types.ts` — new types, two API clients, two default objects, two
  factory functions. The `contentTypeApi()` factory itself is unchanged.

The existing controllers, builders, package services, shared React components
and shared form primitives were not edited.

---

## 8. Test results

### Backend — `next_lms_erp`

```
./vendor/bin/phpunit --filter H5PQuestionTypeBuilderTest
  → 22 tests, 93 assertions, all passing
```

What those 22 cover, and why each exists rather than being a coverage number:

**Single Choice Set (12 tests)**
- the correct answer is written to `answers[0]` whatever its authored position —
  asserted for a right answer authored 2nd, 1st and 3rd;
- distractors keep author order behind it (an unstable partition would scramble
  them between two exports of the same set);
- bare text is wrapped in `<p>`, existing markup is left alone;
- `behaviour` keys map onto the library, the rest onto `eduerpSet`;
- **per-option feedback is re-indexed to the reordered answers** — the subtle
  one: reordering the options without reordering their messages would attach an
  author's "you may be thinking of the Venus flytrap" to a different distractor;
- a full round trip through `parse()` keeps exactly one correct option per
  question;
- a stock package with no `eduerpSet` still imports, applying the format's
  position rule;
- a question with fewer than two options is **dropped and reported**, and the
  survivors are renumbered so `sort_order` has no hole;
- a package with no usable question is refused;
- the export caveat names only what is actually lost, and is silent when nothing
  is;
- `maxScore()` is questions × points.

**True/False (10 tests)**
- the boolean column becomes the string H5P expects, for the library's own field
  *and* for every question in the pool (they must agree);
- the first question is what a stock host runs, with its feedback lifted onto
  `behaviour`;
- an image becomes an `H5P.Image` node with the right mime, in the right place,
  and a statement with no picture gets **no node** rather than an empty one;
- a pool round-trips;
- a stock one-question package imports as a pool of one, with its `media.type`
  unwrapped correctly;
- **an unreadable `correct` value is treated as true** — `true`, `1`, `"1"` and
  `"perhaps"` all read true; `"false"` and `0` read false. A statement whose
  answer cannot be parsed is far more likely to be a true one written oddly than
  a silently inverted one;
- a blank statement is skipped and reported, with renumbering;
- `questions_to_ask` is clamped to the pool that survived import;
- the export caveat counts the statements a foreign host will drop and quotes
  the one it will keep;
- `maxScore()` counts the paper asked, not the pool;
- an **empty pool builds without faulting** — `build()` runs on every save,
  including the save that creates an empty draft, so it must not fault before
  publish has had a chance to refuse.

The pre-existing suite is unaffected: `H5PContentTypeBuilderTest` still reports
21 tests / 74 assertions passing, with the same 16 configuration-level PHPUnit
deprecations before and after this change.

### Frontend — `lms_k12`

```
node --import tsx --test "lib/h5p/*.test.ts"
  → 178 tests, all passing (45 of them new)
```

The 45 new ones guard the behaviour that renders perfectly and scores wrongly:

**`single-choice-set.test.ts` (21)** — shuffling never loses, duplicates or
invents a question or an option, and exactly one correct option survives every
shuffle (asserted over 50 seeds); the same seed reproduces a paper; preparing a
paper does not reorder the caller's rows (the editor and the results screen read
them afterwards); correctness is read from the flag and never from the position;
per-option feedback beats the question's generic message and falls back when
blank; unanswered questions count against the total and are reported separately
from wrong; an answer is matched by paper position, not by index into the rows;
an empty paper scores 0%, not `NaN`; the pass mark is inclusive at its boundary.

**`true-false.test.ts` (24)** — `0` means the whole pool; a positive count draws
that many; asking for more than the pool holds asks for the pool; **the pool is
shuffled before it is truncated, not after** (truncate-then-shuffle looks random,
passes a casual glance, and means the back of the pool is never asked); a drawn
paper never repeats a statement; drawing does not reorder the caller's pool;
**a `false` answer on a `false` statement is not read as unanswered** — the
classic `if (!answer)` bug, which would mark every false statement wrong and
silently halve a class's marks; the score is out of the paper drawn, not the
pool; an all-one-answer pool is reported as lopsided, and a single statement is
not.

### Whole-project checks

```
npx tsc --noEmit               → clean
npx eslint app/h5p lib/h5p     → clean (0 errors, 0 warnings)
npm test                       → 431 tests, 429 pass, 2 fail
npm run build                  → exit 0; all 8 new routes compiled
```

The 8 are list / create / edit / player for each type:

```
.next/server/app/h5p/h5p_single_choice_set/{page,create/page,[id]/page,[id]/edit/page}.js
.next/server/app/h5p/h5p_true_false/{page,create/page,[id]/page,[id]/edit/page}.js
```

Both failures are pre-existing and are in `lib/ai/ai-capabilities.test.ts`
(`a live capability points at a real screen`, `a capability that cites a roadmap
row agrees with it`). Nothing under `lib/ai` or `app/ai` was touched by this
change; the same two failed before it, against a then-total of 386.

```
php -l on every new and changed PHP file → no syntax errors
php artisan migrate --pretend            → both migrations emit valid MySQL
php artisan tinker (router)              → 23 new named routes registered
php artisan tinker (registry)            → both config seeds resolve as native,
                                           with the right table, route, category
                                           and library; both absent from
                                           pal_vocabulary until the sync runs
```

The 23 routes are 11 for Single Choice Set and 12 for True/False — the extra one
is `h5p_true_false.media`. Single Choice Set has no media endpoint, deliberately:
routing one would advertise a capability the controller refuses.

`php artisan route:list` is unusable in this repository for reasons that predate
this work (`ResultAdminPermissionController` is referenced by a route and does
not exist), so the route check was done through the `Route` facade instead.

### Run against the live database

All three migrations have now been run, by path (see §13 for why a bare
`migrate` must not be used here):

```
2026_09_21_170000_create_h5p_single_choice_set_tables   DONE  3s
2026_09_21_180000_create_h5p_true_false_tables          DONE  1s
2026_09_21_190000_sync_h5p_question_type_registry       DONE 13s
php artisan config:clear                                cleared
```

Verified afterwards:

```
all 5 tables                    exist
single_choice_set  in registry  native · h5p_single_choice_set.index · Assessment
true_false         in registry  native · h5p_true_false.index        · Assessment
native types                    12 → 14
H5PIntelligenceService::hubModules()  → 14 cards, both new ones available=yes,
                                        titled "Single Choice Set" and "True / False"
```

The twelve pre-existing native types were re-read afterwards and are unchanged —
same labels, same categories, same source tables. The sync is additive and does
not touch a label an admin has edited, or any tenant's own rows.

### Not yet verified — needs a browser

- **No sample content has been seeded.** The seeder is written and ready; it was
  not run.
- **No browser testing.** The auto-continue timing, the instant-feedback path,
  the picture upload, the solution list and the responsive breakpoints have not
  been exercised by a human or a headless browser.
- **No real `.h5p` package has been imported or exported.** Round trips are
  covered at the builder level and the zip layer (`H5PPackageArchive`) is reused
  unchanged from the shipping Drag and Drop path, but no actual archive from
  h5p.org has been fed through these two importers.
- **No xAPI statement has been observed end to end.** The calls are wired to the
  same helper every other H5P player here uses.
- **Library versions and dependency closures are stated from knowledge of the
  official `library.json` files, not read from them.** `H5P.SingleChoiceSet
  1.11` and `H5P.TrueFalse 1.8` and their closures should be checked against
  h5p.org before the first export is handed to an external host. They live in
  one place (`config/h5p_libraries.php`) precisely so that is a one-file edit.

---

## 9. Sample content

`php artisan db:seed --class=H5PQuestionTypeSampleSeeder`

Scoped by `H5P_SAMPLE_TENANT` / `_STANDARD` / `_SUBJECT` / `_CHAPTER` — the same
variables `H5PContentTypeSampleSeeder` uses, so both can be run against one
chapter and the hub shows the whole estate together. Re-running replaces the
samples rather than adding more.

**Single Choice Set — "Science recap — states, forces and the solar system"**
Five questions (states of matter, balanced forces, the closest planet,
photosynthesis, evaporation), instant feedback, retry and show-solution on,
answers shuffled, per-distractor feedback on every wrong option, an explanation
on every question. **The correct option is at a different position in each
question** — 2nd, 4th, 1st, 3rd, 2nd — because that is the case that would break
silently if the flag-to-position conversion regressed.

**True/False — "General knowledge — true or false"**
Ten statements, instant feedback (`auto_check`, so the Check button is off),
retry and show-solution on, an explanation on every statement. **Five true and
five false**, which is not decorative: the publish check refuses a pool whose
answers are all the same, and an even split is the honest version of that rule.
`questions_to_ask` is left at 0 (ask all ten); setting it to 5 demonstrates the
pool draw.

Both samples are seeded **published**, because a draft is invisible to a student
surface and a demo of the student experience against draft content shows an
empty list. They pass their own publish checks, which makes seeding a smoke test
of `publishBlocker()`.

---

## 10. Requirement coverage

| Brief | Where |
| --- | --- |
| Content library cards, named / iconed / categorised as specified | `config/pal_h5p.php` (title, description, `module_category: Assessment`), `html_contents/page.tsx` (glyphs) |
| Create / edit / preview / save | `ContentTypeCreatePage`, `ContentTypeEditPage`, the `[id]` players, `store` / `update` |
| Publish / unpublish | `publish()` on the base controller, with per-type blockers |
| Duplicate | `duplicate()`, children copied per type; a copy is always a draft |
| Delete | `destroy()`, soft delete with `deleted_by`, children swept first |
| Import / export `.h5p` | the two package services over `H5PContentPackageService` |
| Register `H5P.SingleChoiceSet`, `H5P.TrueFalse` | `config/h5p_libraries.php` |
| Auto-load dependencies | full closures written into every exported `h5p.json` |
| Library upgrades | one config entry each; `libraryVersionString()` is the only reader |
| Content validation | `saveRules()`, `assertOneCorrectAnswer()`, `publishBlocker()` |
| Store content JSON in the existing architecture | `content_json` cache, refreshed on every write |
| **SCS:** multiple questions, single correct answer, multiple options | the three-table schema; radio group in the editor |
| **SCS:** per-question feedback, global feedback | `feedback_correct` / `feedback_incorrect` / per-option `feedback`; `FeedbackBandEditor` |
| **SCS:** retry, show solution | `enable_retry`, `enable_show_solution`; the solution list in the player |
| **SCS:** randomised questions and answers | `randomize_questions` / `randomize_answers`, seeded in `lib/h5p/single-choice-set.ts` |
| **SCS:** scoring, passing score, progress tracking | `points_per_question`, `pass_percentage`, `show_progress` + the progress bar |
| **T/F:** question creation, correct answer, explanation / feedback | `h5p_true_false_questions` |
| **T/F:** retry, show solution, instant feedback | `enable_retry`, `enable_show_solution`, `auto_check` |
| **T/F:** scoring rules | `points_per_question`, `pass_percentage`, `maxScore()` over the drawn paper |
| **T/F:** question pool support | the pool schema, `questions_to_ask`, the seeded draw |
| Accessibility | see §11 |
| LMS integration | `H5PContentAdapter` — §4 |
| Student experience | the two players — launch, answer, submit, results, retry, solutions, mobile |
| Analytics / xAPI | §5 |
| UI: existing design system, no hardcoded colours beyond the tokens the module already uses, responsive, light-theme | shared shells and `fields.tsx`, unchanged |
| Database: additive, backward compatible, existing conventions | §7; two new table groups, nothing altered |
| Testing report | this document |
| Sample content | §9 |

---

## 11. Accessibility

Both players and both editors follow what the rest of the module already does,
with three points specific to these types:

- **Right and wrong are never carried by colour alone.** Every marked answer in
  both players gets a `Check` or `X` glyph beside the colour, and the
  `aria-live="polite"` feedback region states "Correct" or "Not quite" in words.
- **The single-correct-answer control is a real radio group**, and the
  true/false answer control is a `fieldset` of two `aria-pressed` buttons with a
  screen-reader legend naming the statement number. Both are keyboard-operable
  without any custom handling.
- **A picture on a true/false statement cannot be published without a
  description.** It is a publish blocker, not a save blocker — a draft is
  allowed to be unfinished — and it is enforced on the server as well as shown
  in the editor, because on this type the picture is often the question itself.

Feedback regions are `aria-live="polite"` so they are announced without
interrupting; progress bars carry `role="progressbar"` with real
`aria-valuenow` / `aria-valuemax`; every icon-only button has a `title` and an
`aria-label` naming the row it acts on ("Remove statement 4").

---

## 12. Known gaps and deliberate scope calls

1. **Question text is plain text, not a rich editor.** It is stored and exported
   as HTML (and bare text is wrapped in `<p>` on the way out, so it renders with
   correct spacing in a foreign host), but the authoring control is a single
   line input. A rich-text control belongs to the whole module, not to one type,
   and adding one here would make two types inconsistent with the other six.
2. **No question bank reuse.** Neither type can pull an existing question out of
   `lms_question_master`. That is a real feature and a much larger one — it
   crosses the question bank's own schema and its permission model — and it was
   not asked for.
3. **Single Choice Set has no media.** Matching the official library, which has
   no image field for this type. A question that needs a picture is a Multiple
   Choice or an Image Hotspots activity.
4. **The attempt seed is not persisted server-side.** It is held in attempt
   state, which is what makes a reload return the same paper within a session;
   it is not yet written with the xAPI statement, so reconstructing a paper from
   a report months later is not possible today. Recording it is a one-field
   addition to the statement extensions when the reporting module wants it.
5. **`max_attempts` is not modelled for either type.** The arithmetic quiz has
   it; these two have `enable_retry` only. Adding it later is an additive column
   plus a client check, exactly as it is there.
6. **True/False export loses nine statements out of ten to a foreign host.**
   Stated in §1.2 and §6, warned about at the moment of download. It is the
   honest consequence of modelling a pool on a library that holds one question,
   and the alternative was judged worse.

---

## 13. Deploying this

### ⚠ Do not run a bare `php artisan migrate` on this database

`migrate:status` reports **402 pending migrations** on the live database —
including `2014_10_12_create_password_resets_table` and several hundred
`2023_03_05_create_*_table` entries for tables that plainly already exist. This
database was built from SQL dumps, not from the migration history, so the two
have been out of step since long before this work. A bare `migrate` would try
to re-create existing tables and fail partway through, having already run an
unknown number of unrelated migrations.

**Run these three by path, and nothing else:**

```bash
# backend
cd next_lms_erp
php artisan migrate --path=database/migrations/2026_09_21_170000_create_h5p_single_choice_set_tables.php --force
php artisan migrate --path=database/migrations/2026_09_21_180000_create_h5p_true_false_tables.php --force
php artisan migrate --path=database/migrations/2026_09_21_190000_sync_h5p_question_type_registry.php --force
php artisan config:clear

php artisan db:seed --class=H5PQuestionTypeSampleSeeder   # optional; see §9
#   H5P_SAMPLE_TENANT / _STANDARD / _SUBJECT / _CHAPTER select the target chapter

# frontend
cd lms_k12
npm run build
```

The third migration is the one that makes the cards appear: it writes the two
`pal_vocabulary` rows and flushes the registry cache. Without it the code is
fully deployed and the hub shows nothing new, because the hub reads the
registry from the database and not from `config/pal_h5p.php`.

`php artisan pal:h5p-registry-sync` does the same thing as that third migration
and is the right command on an environment where it has already run once.

After the sync, **Single Choice Set** and **True / False** appear on the **H5P
content** hub for any chapter, under *Assessment*, alongside the twelve cards
that were already there.
