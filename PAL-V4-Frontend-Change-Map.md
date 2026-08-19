# PAL V4 Frontend Change Map

A record of what changed in the PAL V4 frontend this session, a full inventory of every screen under `app/pal/` and `app/h5p/`, and the real click-through workflows for students and teachers.

---

## 1. Changed this session

Exactly **five files**, all under `app/h5p/`. No page was newly created — every H5P player already existed and worked; what was missing was the telemetry call. One shared function now feeds all four players.

### `app/h5p/data/h5p.ts` — new shared data-layer function
Added `postH5pXapiStatement()`, the `H5pXapiVerb` type, and a verb→IRI map. Best-effort: never throws, never blocks the player on a network failure.
**Enables:** the POST target every player below now calls.

### `app/h5p/h5p_flashacard/[id]/page.tsx` — student player
On answer check: fires `answered` (with success/response). On set completion: fires `completed`.
**Feeds:** real BKT mastery update + misconception detection.

### `app/h5p/h5p_mcq/page.tsx` — student player
On option selection: fires `answered`. On quiz end: fires `completed` per answered question.
**Feeds:** real BKT mastery update + misconception detection.

### `app/h5p/h5p_interactive_video/[id]/page.tsx` — student player
On popup-quiz submit: fires `answered`. On video end: fires `completed`.
**Feeds:** real BKT mastery update + misconception detection.

### `app/h5p/scenario_based/[id]/page.tsx` — student player
On hotspot point opened: fires `attempted` (no right/wrong signal exists for this content type). On all points viewed: fires `completed`.
**Feeds:** real engagement telemetry.

---

## 2. Full frontend page inventory

All 47 `page.tsx` files under `app/pal/` and `app/h5p/`, read directly (not inferred from folder names).

**Legend:** 🟢 Student — the learner's own view · 🔵 Teacher — staff-facing/authoring · 🟠 Admin — config, approval authority · ⚪ Shared — role-branches at runtime · — redirect / not applicable

### Core PAL journey

| Page | Audience | Purpose | PAL V4 capability |
|---|---|---|---|
| `/pal` | ⚪ Shared | Subject → chapter accordion; start-quiz, diagnostic and practice actions per chapter; staff get a student picker / class-preview toggle. | Adaptive quiz launch, prerequisite gating, pedagogy & misconception modals |
| `/pal/exam` | 🟢 Student | The adaptive quiz player — timed, per-question timing, submits a real attempt (or scores client-side in staff preview). | Adaptive quiz delivery |
| `/pal/result` | 🟢 Student | Score plus per-concept mastery breakdown (mastered / developing / needs practice / not started); retake action. | Quiz result & concept mastery computation |
| `/pal/intelligence` | ⚪ Shared | Mastery, three risk cards (disengagement / failure / burnout), velocity, plateau, regression, and a concept-level misconception + remediation modal. | Learner state, risk prediction, misconception clustering |

### Content intelligence, frameworks & ULU

| Page | Audience | Purpose | PAL V4 capability |
|---|---|---|---|
| `/pal/content` | 🟠 Admin | Metadata coverage, misconception-library health, review-queue sample, CLI commands for backfilling data. | Content tagging & QA coverage dashboard |
| `/pal/content/review` | 🟠 Admin | Bulk approve/transition machine-tagged questions and content, inline metadata editing. | Content approval gate before content reaches learners |
| `/pal/content/misconceptions` | 🟠 Admin | Read-only misconception library browser with corrective content and safety-flag detail. | Misconception library review |
| `/pal/frameworks` | ⚪ Shared | Grid of framework modules (RIASEC, Gardner, NGSS, CASEL, NCDG, HPC…) for the current chapter/concept. | Framework / semantic-intelligence module grid |
| `/pal/frameworks/[slug]` | ⚪ Shared | Detail view of one framework module for a concept. | Framework module detail |
| `/pal/ulu` | ⚪ Shared | Grid of Unified Learning Unit modules for the current chapter/concept. | ULU module grid |
| `/pal/ulu/[slug]` | ⚪ Shared | Detail view of one ULU module. | ULU module detail |

### New PAL — Content Model & Administration

| Page | Audience | Purpose | PAL V4 capability |
|---|---|---|---|
| `/pal/new` | 🟠 Admin | Landing dashboard for the New PAL suite — estate coverage plus cards into each sub-module. | Navigation hub / estate coverage overview |
| `/pal/new/administration` | 🟠 Admin | Status of the nine architecture subsystems (BKT params, HPC stages, agent personas…). | Architecture administration |
| `/pal/new/administration/[subsystem]` | 🟠 Admin | Config panels for one subsystem — params, records, live status; save/reset gated by `canWrite`. | Subsystem-level configuration (e.g. BKT/mastery parameters) |
| `/pal/new/content-model` | 🟠 Admin | Four-type coverage tiles, vocabulary cards, authoring funnel, filterable chapter picker. | Content model administration entry point |
| `/pal/new/content-model/chapter` | 🟠 Admin | Scores a chapter against the seven content-model requirements; lists concepts with coverage. | Chapter-level content-model scoring |
| `/pal/new/content-model/concept` | 🟠 Admin | Tabbed four-type view — variants, Bloom ladder, misconception library, assessment bank, prerequisite graph. | Full four-type content model per concept |
| `/pal/new/content-model/authoring` | 🟠 Admin | Node editor — metadata form, quality-pipeline transitions, AI enrichment, translation, version history. | Content authoring, AI-assisted tagging, revision history |
| `/pal/new/content-model/misconceptions` | 🟠 Admin | Chapter-scoped misconception library, severity filter, corrective-content safety banner. | Misconception library (chapter scope) |
| `/pal/new/content-model/review` | 🟠 Admin | Authoring review queue — human- and AI-proposed nodes, bulk transitions. | Content-node QA / approval workflow |

### New PAL — Gamification

| Page | Audience | Purpose | PAL V4 capability |
|---|---|---|---|
| `/pal/new/gamification` | ⚪ Shared | Overview — mastery map, streak, badges, personal bests, career quest, team challenges; staff pick a student via a scope bar. | Gamification overview |
| `/pal/new/gamification/badges` | ⚪ Shared | Badge catalogue, earned + not-yet-earned, HPC/CASEL/NCDG mapping per badge. | Badges as portfolio evidence |
| `/pal/new/gamification/streaks` | ⚪ Shared | Streak dashboard, day-by-day ledger of qualifying vs. non-qualifying activity. | Engagement streaks |
| `/pal/new/gamification/personal-best` | ⚪ Shared | Self-referential record board, no peer comparison, plus history ledger. | Personal-best tracking |
| `/pal/new/gamification/career-quest` | 🟢 Student | RIASEC-based pathway quest — readiness gate, pathway choice, generated career report. | Career quest / pathway recommendation |
| `/pal/new/gamification/challenge-mode` | 🟢 Student | Opt-in peer leaderboard (grade 4+) — the one place students are compared, and only if they opt in. | Optional competitive leaderboard |
| `/pal/new/gamification/session-summary` | 🟢 Student | End-of-session recap — mastery delta, streak update, one badge celebration max. | Session summary / celebration budget |
| `/pal/new/gamification/team-challenges` | ⚪ Shared | Class-wide progress; staff see per-student breakdown and can create/end challenges, students see aggregate + own contribution. | Team-based challenges (anti-leaderboard design) |

### Teacher tools

| Page | Audience | Purpose | PAL V4 capability |
|---|---|---|---|
| `/pal/pedagogy-engine` | 🔵 Teacher | Pedagogy Engine rule tables, engagement score, trigger map, per concept/chapter. | Pedagogy recommendation rule engine |
| `/pal/personalize-marks` | 🔵 Teacher | Manual bulk marks-entry form feeding the adaptive engine. | Personalization data ingestion |
| `/pal/report` | 🔵 Teacher | Sortable, exportable PAL attempts report (CSV / Excel / PDF / print). | PAL attempt reporting |

### H5P content suite

| Page | Audience | Purpose | PAL V4 capability |
|---|---|---|---|
| `/h5p/html_contents` | ⚪ Shared | Content-type hub — one card per registered H5P type, node/part counts, pedagogies served. | H5P registry / hub navigation |
| `/h5p/model` | 🟠 Admin | Chapter H5P workspace — type catalogue, pedagogy/framework tags, coverage matrix, xAPI event contract, pedagogy selector. | H5P pedagogy/framework tagging & coverage |
| `/h5p/h5p_flashacard` | 🔵 Teacher | List/manage flashcard sets for a chapter; students auto-redirected to the player. | Flashcard content administration |
| `/h5p/h5p_flashacard/create` | 🔵 Teacher | Repeatable card editor (question / content / answer / hint). | Flashcard authoring |
| `/h5p/h5p_flashacard/[id]` | 🟢 Student | Flashcard player — hints, reveal, scoring. | **Player · now emits real xAPI telemetry** |
| `/h5p/h5p_flashacard/[id]/edit` | 🔵 Teacher | Edit a single flashcard. | Flashcard authoring (edit) |
| `/h5p/h5p_interactive_video` | 🔵 Teacher | List/manage interactive videos for a chapter. | Interactive-video administration |
| `/h5p/h5p_interactive_video/create` | 🔵 Teacher | Video upload plus timestamped interaction rows (MCQ / true-false / info). | Interactive-video authoring |
| `/h5p/h5p_interactive_video/[id]` | 🟢 Student | Player — timeline markers, auto-popups, answer checking. | **Player · now emits real xAPI telemetry** |
| `/h5p/h5p_interactive_video/[id]/edit` | 🔵 Teacher | Edit an interactive video; replaces the whole interaction set. | Interactive-video authoring (edit) |
| `/h5p/h5p_mcq` | 🟢 Student | Difficulty picker → one-question-at-a-time quiz, results, printable certificate. | **Player · now emits real xAPI telemetry** |
| `/h5p/scenario_based` | 🔵 Teacher | List/manage scenario items; students redirected to the viewer. | Scenario content administration |
| `/h5p/scenario_based/create` | 🔵 Teacher | Upload an image, place hotspot points, optional AI-generated description. | Scenario authoring (AI-assisted) |
| `/h5p/scenario_based/[id]` | ⚪ Shared | Hotspot viewer with embedded video support — explicitly viewable by staff and students. | **Player · now emits real xAPI telemetry** |
| `/h5p/scenario_based/[id]/edit` | 🔵 Teacher | Edit an existing scenario's points. | Scenario authoring (edit) |
| `/pal/framework` | — | Legacy redirect to `/pal/frameworks`. | — |
| `/pal/framework/ulu` | — | Legacy redirect to `/pal/ulu`. | — |

---

## 3. Student workflow

The path a learner actually clicks through, from opening PAL to seeing their own growth reflected back.

1. **`/pal`** — Opens their subject → chapter list. Each chapter shows a Start-quiz action, gated by prerequisite completion.
2. **`/pal/exam`** — Takes the adaptive quiz — timed, per-question response tracked, submitted as a real attempt.
3. **`/pal/result`** — Sees score and a per-concept mastery breakdown. Can retake the chapter or return to `/pal`.
   *A wrong answer on a concept means a misconception is detected server-side and surfaces in the next steps.*
4. **`/pal/intelligence`** — Checks their own mastery, risk signals, and — for any concept with an active misconception — opens the remediation modal.
5. **`/h5p/html_contents`** — Practices via H5P content (flashcards, MCQ, interactive video, or a hotspot scenario) recommended by the pedagogy engine for the concept they're weak on.
   *Every answer now posts a real xAPI statement → updates BKT mastery and re-checks the misconception in real time, not just at quiz submission.*
6. **`/pal/exam`** — Reassesses the same concept. A correct answer resolves the misconception and raises mastery — visible immediately back at `/pal/intelligence`.
7. **`/pal/new/gamification`** — Sees the session reflected as progress — streak, personal bests, any earned badge — and, if they've opted in, the peer leaderboard at `/challenge-mode`.

---

## 4. Teacher workflow

Two threads teachers actually run: checking on a student, and authoring/approving the content students receive.

### Checking on a student

1. **`/pal`** — Switches to Teacher mode and picks a specific student via the student picker (never sees another student's data without doing this — enforced server-side by class/subject assignment).
2. **`/pal/intelligence`** — Reviews that student's mastery, risk cards, and any active misconception clusters — the same view the student sees, scoped to them.
3. **`/pal/new/gamification`** — Uses the scope bar to check the same student's streak/badges, or switches to the class-aggregate view.
4. **`/pal/new/gamification/team-challenges`** — Sees per-student breakdown (a view only staff get) and can create or end a class challenge.
5. **`/pal/report`** — Pulls the exportable attempts report for grading records or a parent conversation.

### Authoring & approving content

1. **`/pal/new/content-model`** — Opens the content model, picks a chapter to check its coverage against the seven requirements.
2. **`/pal/new/content-model/concept`** — Drills into one concept — checks its four content types (variants, Bloom ladder, misconceptions, assessment).
3. **`/pal/new/content-model/authoring`** — Writes or edits a content node; can trigger AI enrichment (framework tags, translation) — proposals land as drafts, never auto-approved.
4. **`/pal/content/review`** or **`/pal/new/content-model/review`** — Reviews the queue of human- and AI-proposed content, approves or transitions status before it can reach students.
5. **`/h5p/html_contents` → content-type page** — Authors the actual H5P practice content students will play — create or edit forms per content type.
6. **`/h5p/model`** — Tags that content's pedagogy and framework alignment for the chapter, and checks the coverage matrix for gaps.

---

*PAL V4 · Frontend: `d:\lms_k12` · Backend: `d:\next_lms_erp` · 47 pages inventoried · 5 files changed this session*
