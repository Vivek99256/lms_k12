import type { ModuleIntelligenceContract } from './contract';

/**
 * Which modules have an Intelligence screen, and which only look like they do.
 *
 * WHY A STATUS FIELD RATHER THAN JUST A LIST. An audit of this repo found
 * `/teach-learn/intelligence` routing to a category page with no intelligence
 * in it, and two modules named `*-intelligence` that are taxonomy CRUD. A flat
 * list of routes would have counted all three as coverage. The status says what
 * each one actually is, so "how many modules have intelligence?" has an answer
 * that does not require reading forty files again.
 *
 * Teach/Learn has since been given a real contract — it is the curriculum
 * content catalogue, `sub_std_map` and `content_master` — and its route now
 * renders that. The two taxonomy-CRUD modules are still exactly what the audit
 * said they were, which is why they are still absent from this list.
 *
 *   live     — renders real findings, each with evidence, from this institute's
 *              own rows, AND its headline figures have been reconciled against
 *              the source tables.
 *   partial  — data-backed, but not the full ladder (no signals, or figures not
 *              yet reconciled).
 *   planned  — contract not written yet. Nothing is routed.
 *
 * KEEP THIS HONEST. A module moves to `live` when its numbers have been checked
 * against the rows they claim to come from, not when its screen first renders
 * without an error.
 *
 * ── WHY `ladder` IS A SEPARATE FIELD ────────────────────────────────────────
 *
 * `live` used to carry two claims at once — "the findings are real" and "the
 * whole loop is wired" — and every module except Fees fails the second while
 * most pass the first. Collapsing them meant either overstating twelve modules
 * or understating them, so how far each one climbs is recorded on its own axis:
 *
 *   L2 — coverage, position and distribution. A dashboard.
 *   L3 — findings with evidence and a visible rule ledger.
 *   L4 — reasoning: a stated cause, labelled as unconfirmed where it is.
 *   L5 — the action loop: recommendation, decision, execution, outcome, memory.
 *
 * Every module below except PAL and Career now reaches L5: their findings are
 * written into `hpbrain_signals` by `ModuleSignalBridge`, reasoned over by the
 * same `Reasoner` that serves Fees, and read back through `ModuleLoop`.
 *
 * REACHING L5 IS NOT THE SAME AS HAVING BEEN THROUGH IT. Until someone presses
 * "Analyse this year" the ledger holds nothing for that institute-year and all
 * three sections say so in words; and a rule with no approved cause in
 * `RuleCatalogue` produces a recommendation carrying no explanation rather than
 * a composed one. The ladder records what the module is WIRED for, which is why
 * `status` is still a separate field.
 */
export type ModuleIntelligenceStatus = 'live' | 'partial' | 'planned';

/** How far up the intelligence ladder a module actually climbs. */
export type ModuleIntelligenceLadder = 'L2' | 'L3' | 'L4' | 'L5';

export interface RegisteredIntelligenceModule {
  key: string;
  label: string;
  /** The module's own route segment. The screen lives at `${route}/intelligence`. */
  route: string;
  status: ModuleIntelligenceStatus;
  /**
   * How far up the ladder this module climbs. Absent while planned.
   *
   * Recorded separately from `status` because "the findings are real" and "the
   * action loop is wired" are different claims, and every module except Fees
   * passes the first while failing the second.
   */
  ladder?: ModuleIntelligenceLadder;
  /** Present for `live` and `partial`; absent while planned. */
  loadContract?: () => Promise<ModuleIntelligenceContract>;
  note?: string;

  /**
   * Where the screen actually lives, when it is not `${route}/intelligence`.
   *
   * Career Intelligence IS its own module rather than a tab inside one, so
   * appending `/intelligence` to its route would send the nav to a 404.
   */
  intelligenceHref?: string;

  /**
   * The module slug this Intelligence is canonically reached under, for pages
   * that link to it from OUTSIDE the menu system.
   *
   * ── WHY THIS IS NEEDED AT ALL ───────────────────────────────────────────
   *
   * The menu does not need it: `buildMenuTree` is handed one level-2
   * `tblmenumaster` row at a time and looks its slug up by
   * `fees_menu_categories.level2_menu_id`, which is correct even where several
   * modules share one Intelligence. A launcher card on a module's own hub page
   * has no menu row to look up, and the answer is not derivable from the
   * registry `key` — the Result module has no level-2 row called "Result".
   *
   * Declare it only where a page outside the menu links to the screen, and only
   * from checked evidence. Absent ⇒ callers fall back to the legacy route,
   * which still renders.
   */
  moduleSlug?: string;

  /**
   * Every OTHER `fees_menu_categories.module_name` this one screen serves.
   *
   * One Intelligence screen frequently serves several menu modules — the staff
   * domain is six of them — and `moduleSlug` can only name the canonical one.
   * Without this list the others fall through to label guessing, which is how
   * the "Users" bar (module_name `user-i-card`) reached the Enterprise Brain
   * fallback: de-slugifying gave "user i card" and the matcher wanted
   * "user i-card".
   *
   * Declared from the live `fees_menu_categories` rows, never guessed.
   */
  moduleSlugs?: string[];

  /**
   * How to recognise this module in the LMS's own menu.
   *
   * ── WHY THE MATCHER LIVES HERE ──────────────────────────────────────────
   *
   * It used to live in `app/data/menuMappers.ts`, in a second table that
   * repeated every route. That table had drifted: it was missing Fees — the
   * reference implementation — so the one module with a complete Intelligence
   * screen was the one you could only reach by typing its URL. One table, in
   * the registry, is the fix; the nav reads it rather than restating it.
   *
   * `tblmenumaster` is per-tenant and its labels are whatever a school called
   * the module, which is why this is a predicate over the label, the legacy
   * `link` and the level-3 hrefs already resolved beneath it, rather than an
   * id. Absent ⇒ the module is not attached to the LMS menu at all.
   */
  nav?: (label: string, link: string, hrefs: string[]) => boolean;
}

/**
 * Where a registered module's Intelligence screen lives in the LEGACY,
 * per-module-folder namespace: `/students/intelligence`, `/fees/intelligence`,
 * `/Transportation/intelligence`, and so on.
 *
 * These routes still exist and still render — links already shared keep
 * working — but they are no longer what navigation points at. See
 * `moduleIntelligenceRoute` for the canonical one.
 */
export function intelligenceHrefFor(module: RegisteredIntelligenceModule): string {
  return module.intelligenceHref ?? `${module.route}/intelligence`;
}

/**
 * THE canonical Intelligence route: `/modules/<module-slug>/intelligence`.
 *
 * The slug is not invented here and is not a registry key — it is the
 * `module_name` on the module's own rows in `fees_menu_categories`, whose
 * `route` column already spells this exact path for all 64 configured modules.
 * The registry says WHICH intelligence a module gets; the database says what
 * the module is called. Keeping the two apart is why a school that renames a
 * module does not need a code change.
 */
export function moduleIntelligenceRoute(moduleSlug: string): string {
  return `/modules/${moduleSlug.trim()}/intelligence`;
}

/**
 * Where a page outside the menu system should send a reader for this module's
 * Intelligence.
 *
 * The canonical `/modules/<slug>/intelligence` when the module declares its
 * slug, and otherwise the legacy route — which still renders the same screen,
 * so a module that has not declared one links to something that works rather
 * than to a guess.
 */
export function canonicalIntelligenceRoute(module: RegisteredIntelligenceModule): string {
  return module.moduleSlug ? moduleIntelligenceRoute(module.moduleSlug) : intelligenceHrefFor(module);
}

/**
 * Which registered Intelligence module — if any — a level-2 LMS menu row is.
 *
 * `tblmenumaster` is per-tenant and its labels are whatever a school called the
 * module, so this is a predicate over the label, the legacy `link` and the
 * level-3 routes beneath it rather than an id. Each module's own `nav` matcher
 * is the single definition of that, which is what keeps the sidebar, the
 * category bar and `/modules/<slug>/intelligence` agreeing about which screen a
 * module gets instead of each deciding for itself.
 *
 * `planned` modules never match: nothing is routed for them, and an item
 * pointing at a 404 is worse than no item.
 */
export function resolveIntelligenceModuleForMenu(
  label: string,
  link: string,
  hrefs: string[],
): RegisteredIntelligenceModule | undefined {
  const normalizedLabel = (label || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const normalizedLink = (link || '').trim().toLowerCase();
  const normalizedHrefs = hrefs.map((href) => (href || '').toLowerCase());

  return INTELLIGENCE_MODULES.find(
    (module) =>
      module.status !== 'planned' &&
      typeof module.nav === 'function' &&
      module.nav(normalizedLabel, normalizedLink, normalizedHrefs),
  );
}

/**
 * Contracts are loaded on demand.
 *
 * Each one imports its module's own API client, and a static registry would
 * therefore pull every module's client into every bundle that touches this
 * file — including the nav.
 */
export const INTELLIGENCE_MODULES: RegisteredIntelligenceModule[] = [
  {
    key: 'fees',
    label: 'Fees Intelligence',
    route: '/fees',
    status: 'live',
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/fees')).feesIntelligenceContract,
    note: 'The reference implementation. Its own screen at /fees/intelligence still renders the original components.',
    nav: (label, link, hrefs) =>
      label === 'fees' ||
      label === 'fee' ||
      label === 'fees management' ||
      label === 'fee collection' ||
      link.includes('fees') ||
      hrefs.some((h) => h.startsWith('/fees')),
  },
  {
    key: 'pal',
    label: 'PAL Intelligence',
    route: '/pal',
    // DELIBERATELY NOT PROMOTED to a native Intelligence screen, and the reason
    // is measured rather than assumed. PAL holds by far the largest learner
    // dataset in this database — 2,405,676 question responses and 149,045 exam
    // attempts across two institutes — and EVERY DIMENSION THAT WOULD MAKE IT
    // INTELLIGENCE RATHER THAN COUNTING IS UNPOPULATED:
    //
    //   - `pal_assessment_results.response_time_ms` is 0 on 2,405,627 of
    //     2,405,676 rows. Forty-nine rows in the database carry a time.
    //   - `pal_question_metadata` resolves for ~1.3% of responses, and
    //     `concept_ref_id` has ZERO distinct values at both institutes that
    //     hold the response data. No response can be attached to a concept.
    //   - `lms_online_exam.accuracy_rate`, `skip_rate`, `avg_time` and
    //     `struggle_score` are NULL on all 149,045 attempts.
    //   - `pal_concept_mastery` holds 60 rows and `pal_learner_misconceptions`
    //     holds 2, across the whole database.
    //
    // What remains is correctness counts, which a screen can show but which
    // cannot answer a question about learning: without a concept, a difficulty
    // or a time, "84.8% correct across 495,526 responses" is a volume figure.
    // Promoting it would produce an Intelligence screen whose every section had
    // to say what it could not tell you.
    //
    // It also does not currently read inside a page load: measured at 1.9s for a
    // plain count and 5.8s for count-plus-correct at one institute-year, because
    // `pal_assessment_results` is indexed on (learner_id, is_correct) and not on
    // created_at. An index would fix that and is the prerequisite for revisiting
    // this, not the blocker on its own.
    //
    // REVISIT WHEN `concept_ref_id` IS POPULATED. That single field is what
    // turns this from telemetry into intelligence.
    //
    // ── AND IT OWNS NO MODULE, WHICH IS A SEPARATE FINDING ─────────────────
    //
    // `/pal/intelligence` is NOT a module Intelligence screen and has no
    // `moduleSlug` for that reason. It is a per-LEARNER PAL V4 workspace —
    // velocity, plateau, regression, risk, misconception clusters, remediation
    // — opened by a button on the `/pal` workspace itself, and NO ROW IN
    // `tblmenumaster` points at it (checked: the only PAL menu rows are 426
    // "PAL" → `pal.index`, 495 "PAL Report", and New PAL's own seven).
    //
    // So there is no owning module to canonicalise it under. `/pal` is menu row
    // 426, which sits under level-2 "Test" (276) — and Test's category bar
    // already resolves to HOMEWORK Intelligence through its /lms/homework
    // screens. Putting PAL there would displace a real contract with one that
    // does not exist. New PAL (531) holds Content Model, ULU, Coherence Map,
    // Pedagogy Engine, Administration, Gamification and ESO — no Intelligence.
    //
    // `/pal/intelligence` therefore stays exactly where it is, reached from the
    // PAL workspace, outside the module Intelligence system by intent.
    status: 'partial',
    ladder: 'L2',
    note: '2.4M real learner responses, but concept, difficulty, response-time and struggle columns are all unpopulated — measured, not assumed. Counting is possible; intelligence is not, until questions are tagged.',
  },
  {
    key: 'career',
    label: 'Career Intelligence',
    route: '/career-intelligence',
    // Career Intelligence IS the module rather than a tab inside one, so its
    // screen is the route itself. `${route}/intelligence` would 404.
    intelligenceHref: '/career-intelligence',
    // NOT PROMOTED, for a simpler reason than PAL: there is no tenant data at
    // all. `s_competency_career_paths` holds 1 row and
    // `s_competency_career_path_steps` holds 2, across the whole database.
    // `onet_career_cluster` holds 1,011 rows and is a REFERENCE TAXONOMY — the
    // O*NET occupational catalogue — carrying no institute, no student and no
    // year. A native Intelligence screen needs an institute's own records to
    // analyse, and this module has none to analyse yet.
    status: 'partial',
    ladder: 'L2',
    note: 'No tenant-scoped records exist: 1 career path and 2 steps database-wide, and onet_career_cluster is a reference taxonomy with no institute, student or year. Nothing to analyse until institutes use it.',
  },
  {
    key: 'result',
    label: 'Result Intelligence',
    route: '/result',
    // `partial`, and the reason is a finding in its own right.
    //
    // Its figures reconcile against result_personalize_marks EXACTLY — 244
    // students, 17 subjects, 10,123 mark entries, 74.6% mark-weighted mean, all
    // re-derived from the table with the same scope. (`exams: 12` counts exam
    // NAMES, not the 594 per-class-per-subject instances; twelve is what a
    // principal means by "exams", and the exam-name-variant check in the record
    // ledger guards the spellings.)
    //
    // They DID NOT reconcile against /result/reports, and that turned out to be
    // a defect in the report rather than in this module: its consolidate view
    // read `result_marks` alone — a table holding TWELVE ROWS in the entire
    // database — so every real institute's consolidated grid rendered zeros.
    // `consolidateReportController` now reads `result_personalize_marks` as
    // well, keyed on (exam_id, student_id) with an enrolment-number fallback,
    // with `result_marks` still winning where it holds a row. At institute 195
    // that turns 0 cells into 2,196 real marks for a single class-year.
    //
    // It still shows nothing at institutes 47 and 254, and that is the correct
    // answer: 47's mark rows carry exam ids matching no exam definition, and
    // 254 has no `result_create_exam` rows at all, so there is no structure to
    // hang their imported marks on. Empty cells rather than invented ones.
    //
    // `partial` because that last part is a real reconciliation gap — two
    // institutes' marks exist and this report cannot reach them.
    status: 'partial',
    ladder: 'L5',
    // Result has NO level-2 menu row called "Result". Its screens hang off two:
    // "Exam" (tblmenumaster 67 — Mark Entry, Co-scholastic Mark, Upload Result,
    // HPC entry) and "Exam Report" (72 — the report cards and result reports).
    // Both resolve to this registry entry through `nav` below, so both expose
    // Intelligence from their own category bar. `exam` is the one named here
    // because it is the module that owns Result's ENTRY and MASTER screens —
    // the same set the /result hub page is a launcher for — while "Exam Report"
    // is its reports sibling.
    moduleSlug: 'exam',
    loadContract: async () => (await import('./contracts/result')).resultIntelligenceContract,
    note: 'Built on result_personalize_marks (1.3M rows), NOT result_marks (12 rows) — the profiler found that, and the consolidate report was fixed to read the same table. Six rules run per request; the L5 loop is wired.',
    nav: (label, link, hrefs) =>
      // Document Templates is NOT Result, however much its routes look like it.
      // Its screens live under `/result/templates`, so both the `link` test and
      // the `/result/` route family below claimed it — and because this entry
      // sits earlier in the array than the document-templates one, `find()`
      // returned Result first. A bursar opening the template library was shown
      // marks. The guard is an exact label match, so a genuine Result menu is
      // untouched.
      label !== 'document templates' &&
      (label === 'result' ||
        label === 'result template' ||
        label === 'hpc skillset' ||
        label === 'hpc activity' ||
        link.includes('result') ||
        hrefs.some((h) => h.toLowerCase().includes('/result/'))),
  },
  {
    key: 'attendance',
    label: 'Attendance Intelligence',
    route: '/attendance',
    status: 'live',
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/attendance')).attendanceIntelligenceContract,
    note:
      'Built on result_student_attendance_master, result_working_day_master and tblstudent_enrollment. Rates are ' +
      'computed from days present over working days, never from the stored percentage column, which disagrees with ' +
      'the days on thousands of rows. A year where fewer than half the rows carry days present reports unavailable ' +
      'with the counts, rather than a rate over whoever was filled in. Five rules; the L5 loop is not wired.',
    // THIS IS THE PUPIL REGISTER, AND ONLY THE PUPIL REGISTER. The staff
    // modules are excluded by name and by route family: `hrit-management`
    // used to land here because `/hrit/attendance-management/attendance-tracking`
    // contains "/attendance", which handed a staff leave-and-payroll workspace
    // the children's attendance screen. Staff attendance is the punch register
    // and belongs to `hr`, which reads hrms_attendances.
    nav: (label, link, hrefs) =>
      (label.includes('attendance') &&
        !label.includes('user attendance') &&
        !label.includes('hrit') &&
        !label.includes('hrms')) ||
      (link.includes('attendance') && !link.includes('hrit') && !link.includes('hrms')) ||
      hrefs.some((h) => {
        const href = h.toLowerCase();
        if (href.startsWith('/hrit/') || href.startsWith('/hrms_')) return false;
        return href.includes('/attendance') || href.includes('attendance_master');
      }),
  },
  {
    key: 'student',
    label: 'Student Intelligence',
    route: '/students',
    status: 'live',
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/student')).studentIntelligenceContract,
    note:
      'Built on tblstudent_enrollment, tblstudent, standard, division and student_quota. A class is a standard AND a ' +
      'section — dividing the roll by sections alone is what produced an average class of 390. Five rules covering ' +
      'class size, section balance, composition, retention against last year, and unplaced students. Religion, caste ' +
      'and Aadhaar are deliberately not read. The L5 loop is not wired.',
    nav: (label, link, hrefs) =>
      ((label === 'student' || label === 'students') &&
        !label.includes('i-card') &&
        !label.includes('medical') &&
        !label.includes('request') &&
        !label.includes('transfer') &&
        !label.includes('attendance') &&
        !label.includes('result')) ||
      // Both student route trees are real modules in this app. Either one in
      // the menu gets the item; it always points at the registry's route, so
      // there is one screen rather than two that drift.
      //
      // THIS IS WHAT GIVES THE STUDENT-RECORD MODULES ONE SHARED SCREEN. Student
      // I-card, Certificate, Student Medical, Student Request and Mobile Apps
      // are separate level-2 menu modules whose screens all live under
      // /student* — `/student/student_icard`, `/student/student_certificate`,
      // `/student/student_infirmary`, `/students/requests/`, `/students/leave/`
      // — and they all describe the same children, so they all resolve here
      // rather than to five duplicate contracts.
      //
      // `user_icard` is the exception and is excluded: it is the STAFF ID card,
      // and it lives in the student folder only for historical reasons. It used
      // to match this clause, which is why the User I-card module opened the
      // children's roll. It belongs to `hr`.
      hrefs.some((h) => {
        const href = h.toLowerCase();
        return href.startsWith('/student') && !href.includes('user_icard');
      }),
  },
  {
    key: 'academic',
    label: 'Academic Intelligence',
    route: '/academic_setup',
    status: 'live',
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/academic')).academicIntelligenceContract,
    note:
      'Built on timetable, subject, standard and tbluser. A teacher’s week is their DISTINCT (weekday, ' +
      'period) slots in one marking period, not their timetable row count — counting rows reported 129 weekly ' +
      'periods for a real member of staff at a school whose week holds 72. Four rules, including the 427 slots ' +
      'that put a teacher in two classrooms at once. The L5 loop is not wired.',
    nav: (label, link, hrefs) =>
      label === 'academic setup' ||
      label === 'school setup' ||
      label === 'timetable' ||
      label === 'curriculum planning' ||
      link.includes('academic_setup') ||
      link.includes('school_setup') ||
      hrefs.some((h) => h.toLowerCase().includes('/academic_setup/')),
  },
  {
    key: 'admissions',
    label: 'Admissions Intelligence',
    route: '/admissions',
    status: 'live',
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/admissions')).admissionsIntelligenceContract,
    note:
      'Built on admission_registration_v1 and new_admission_inquiry_registration. Scoped by the institute’s ' +
      'own term dates, not the calendar year — the calendar filter put 114 of 678 candidates in the wrong year. ' +
      'Funnel stages nest; confirmation codes are shown verbatim with the grouping the LMS admission module ' +
      'itself applies. The inquiry table’s health, caste and identity columns are not read. Five rules; the ' +
      'L5 loop is not wired.',
    nav: (label, link, hrefs) =>
      label === 'admissions' ||
      label === 'admission' ||
      label === 'admission report' ||
      link.includes('admission') ||
      hrefs.some((h) => h.toLowerCase().includes('/admissions/')),
  },
  {
    key: 'exam',
    label: 'Exam Intelligence',
    route: '/exam',
    // NOT A MODULE, and this is a decision rather than a backlog item. Every
    // exam-shaped table in this database already belongs somewhere:
    //
    //   - The marks and the exam definitions — `result_create_exam` (33,763
    //     rows), `result_exam_master` (1,229), `result_exam_approve` (6,125)
    //     and `result_personalize_marks` (1.3M) — are Result's, and Result
    //     Intelligence reads them. An Exam screen would divide the same rows a
    //     second way and disagree with itself at the edges.
    //   - The online attempts — `lms_online_exam` (149,045) and
    //     `lms_online_exam_answer` (2.4M) — are PAL's, and are excluded for the
    //     reasons recorded against PAL above.
    //   - What is left that is exam-specific is `exam_schedule` (5,216 rows),
    //     and it is a FILE STORE: a title, an uploaded .docx or .pdf, a date and
    //     a class. One datasheet is written once per (standard, division) it
    //     covers, so even the row count is not a count of exams. It carries no
    //     subject, no paper, no time slot and no duration. Nothing in it can be
    //     analysed beyond "a document was uploaded", which is not a finding.
    //
    // So `planned` would be a promise this data cannot keep. Exam questions are
    // answered on the Result screen, which is where the marks are.
    status: 'planned',
    note: 'Deliberately not a module: its marks are Result’s, its online attempts are PAL’s, and the only exam-specific table left (exam_schedule, 5,216 rows) is a store of uploaded timetable files with no subject, paper or slot in it.',
  },
  {
    key: 'library',
    label: 'Library Intelligence',
    route: '/library',
    status: 'live',
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/library')).libraryIntelligenceContract,
    note:
      'Built on library_book_circulations and library_books. A loan belongs to the year when it says so, or — ' +
      'where syear is null, as 36,851 of one institute’s 36,977 loans are — when it was issued inside the ' +
      'year’s own dates. Filtering on syear alone showed that library 126 of its loans. Three rules ' +
      'including dormant catalogue (10,293 of 18,827 titles never borrowed). The L5 loop is not wired.',
    nav: (label, link, hrefs) =>
      label === 'books' ||
      label.includes('library') ||
      link.includes('library') ||
      link.includes('book') ||
      // A ROUTE FAMILY, NOT THE WORD ANYWHERE IN A PATH. This used to match any
      // href merely CONTAINING "library" or "book", and the LMS has screens
      // called /capability-intelligence/competency-library and
      // /organization-management/compliance-library. Both modules were handed
      // Library Intelligence — a menu item opening another module's screen, in
      // one case a module the registry's own header names as taxonomy CRUD
      // rather than intelligence. The real Library menus are /library/* and
      // /library/book_resources, which this still matches.
      hrefs.some((h) => {
        const href = h.toLowerCase();
        return href.startsWith('/library') || href.includes('/library/') || href.includes('/book');
      }),
  },
  {
    key: 'hostel',
    label: 'Hostel & Boarding Intelligence',
    route: '/hostel',
    status: 'partial',
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/hostel')).hostelIntelligenceContract,
    note: 'Built on hostel_room_allocation and hostel_room_master. Truthfully reports insufficient-data for non-boarding institutes (<5 records across DB).',
    nav: (label, link, hrefs) =>
      label.includes('hostel') ||
      link.includes('hostel') ||
      hrefs.some((h) => h.toLowerCase().includes('/hostel/')),
  },
  {
    key: 'transportation',
    label: 'Transport Intelligence',
    route: '/Transportation',
    status: 'live',
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/transport')).transportIntelligenceContract,
    note:
      'Built on transport_map_student, transport_vehicle, transport_stop, transport_school_shift and ' +
      'transport_route_bus. Stop names are resolved rather than shown as keys, and records carrying more than 3× ' +
      'their stated seats are excluded from capacity figures as travel-mode markers. Five rules, one finding per ' +
      'pattern. The L5 loop is not wired, so those sections are omitted.',
    nav: (label, link, hrefs) =>
      label.includes('transport') ||
      link.includes('transport') ||
      hrefs.some((h) => h.toLowerCase().includes('transport')),
  },
  {
    key: 'hr',
    label: 'HR & Staff Intelligence',
    route: '/user',
    status: 'live',
    // The six staff menu modules this one screen serves, taken from their live
    // `fees_menu_categories` rows. `user-i-card` is the level-2 row labelled
    // "Users" (tblmenumaster 105) — the bar a person actually clicks.
    moduleSlugs: ['user', 'user-i-card', 'user-attendance', 'leave', 'payroll', 'hrms-report', 'hrit-management'],
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/hr')).hrIntelligenceContract,
    note:
      'Built on tbluser, tbluserprofilemaster, hrms_emp_leaves and hrms_leave_types. Where an institute keeps no ' +
      'staff leave register the leave figures are NULL, not 0 — the earlier version reported "0 leave days" at ' +
      'schools that simply do not use the module. Headcount distinguishes active from total (556 rows, 188 ' +
      'active at one institute). Leave is date-scoped through the institute’s own term dates. ' +
      'leave_applications is excluded: it is STUDENT leave. Five rules; the L5 loop is not wired.',
    // ── THE STAFF DOMAIN IS SIX MENU MODULES, NOT ONE ───────────────────────
    //
    // Measured against the live `fees_menu_categories` / `tblmenumaster` rows,
    // this institute's staff records are split across six level-2 modules, and
    // only one of them used to reach this screen:
    //
    //   leave (353)             Apply Leave, Leave Authorisation, My Leave,
    //                           Leave Type Master  → hrms_emp_leaves +
    //                           hrms_leave_types, which THIS MODULE ALREADY READS
    //   user-attendance (372)   My Attendance, User Attendance, Shift Master
    //                           → hrms_attendances, the 356,872-row punch
    //                           register THIS MODULE ALREADY READS
    //   payroll (351)           Salary Structure, Payroll Type, Form 16
    //   hrms-report (364)       the leave / attendance / payroll reports
    //   hrit-management (535)   Leave Dashboard, Attendance Tracking, Payroll
    //   user-i-card (266)       staff ID cards, off tbluser
    //
    // The first four matched NOTHING and showed no Intelligence. The last two
    // matched the WRONG screen, which is worse: `hrit-management` resolved to
    // Attendance Intelligence because its route
    // `/hrit/attendance-management/attendance-tracking` contains "/attendance",
    // and `user-i-card` resolved to STUDENT Intelligence because its one screen
    // lives at `/student/user_icard`. A staff module showing the children's
    // roll is the same class of defect the Library matcher was narrowed for.
    //
    // Both are excluded at their own end (see `attendance` and `student`), and
    // all six are claimed here, because the question every one of them asks is
    // about staff and this is the screen that answers it. Matching is on the
    // module's own label and on ROUTE FAMILIES rather than on the words "leave",
    // "payroll" or "attendance" appearing anywhere in a path — that is what put
    // hrit under Attendance in the first place.
    nav: (label, link, hrefs) =>
      ((label === 'user master' || label === 'user' || label === 'hr' || label === 'staff') &&
        !label.includes('i-card') &&
        !label.includes('attendance') &&
        !label.includes('log')) ||
      // The staff modules, by their own level-2 label. Exact equality, not
      // `includes`: "Payroll Register" is a different module and must keep
      // getting nothing.
      label === 'leave' ||
      label === 'payroll' ||
      label === 'user attendance' ||
      label === 'hrms report' ||
      label === 'hrit management' ||
      label === 'user i-card' ||
      hrefs.some((h) => {
        const href = h.toLowerCase();
        return (
          href.includes('/user/') ||
          // The HRIT workspace — every screen under it is staff leave,
          // staff attendance or payroll.
          href.startsWith('/hrit/') ||
          // The staff ID card, which lives in the student folder and is the
          // reason this module used to open Student Intelligence.
          href.includes('user_icard') ||
          // The HRMS legacy screens, matched as whole route names so that
          // "attendance" inside them cannot pull in the pupil register.
          href.startsWith('/hrms_') ||
          href.startsWith('/leave-apply') ||
          href.startsWith('/leave-authorisation') ||
          href.startsWith('/my-leave') ||
          href.startsWith('/leave-type') ||
          href.startsWith('/leave_encashment') ||
          href.startsWith('/payroll_') ||
          href.startsWith('/employee_salary_structure') ||
          href.startsWith('/employee_payroll_history') ||
          href.startsWith('/monthly_payroll')
        );
      }),
  },
  {
    key: 'communication',
    label: 'Communication & Engagement Intelligence',
    route: '/easy_com',
    status: 'live',
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/communication')).communicationIntelligenceContract,
    note:
      'Built on parent_communication and sms_sent_parents. `title` is NOT a topic — it is a free-text subject ' +
      'line a parent writes (2,495 distinct values across 4,873 rows, including a named child’s illness), ' +
      'and nothing reads it. Inquiries are sliced by class and by month instead. Evidence is aggregate only; no ' +
      'message text leaves the database. Five rules; the L5 loop is not wired.',
    nav: (label, link, hrefs) =>
      label === 'communication' ||
      label === 'easy com' ||
      label === 'easy_com' ||
      label === 'whatsapp api' ||
      label === 'engagement' ||
      label === 'interactions' ||
      link.includes('easy_com') ||
      hrefs.some((h) => h.toLowerCase().includes('/easy_com/')),
  },
  {
    key: 'homework',
    label: 'Homework & Assignment Intelligence',
    route: '/lms/homework',
    status: 'partial',
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/homework')).homeworkIntelligenceContract,
    note: 'Built on homework, subject, and standard. Evaluates curriculum assignment volume, completion rates, pending student burdens, and grading review lag.',
    nav: (label, link, hrefs) =>
      label === 'homework' ||
      (label === 'student homework' && !link.includes('student_homework')) ||
      link.includes('student_homework.index') ||
      hrefs.some((h) => h.toLowerCase().includes('/homework')),
  },
  {
    key: 'inventory',
    label: 'Inventory & Asset Intelligence',
    route: '/Inventory',
    status: 'live',
    ladder: 'L5',
    loadContract: async () => (await import('./contracts/inventory')).inventoryIntelligenceContract,
    note:
      'Built on item_scan_details and inventory_requisition_details. A blank scan outcome is UNKNOWN, not a missing ' +
      'asset — the earlier version read 1,105 blank outcomes as 0% verified. Item-code prefixes are shown as ' +
      'prefixes, not as invented category names. inventory_item_master is excluded: it holds one row across every ' +
      'institute that runs a stock-take. Four rules; the L5 loop is not wired.',
    nav: (label, link, hrefs) =>
      label.includes('inventory') ||
      link.includes('inventory') ||
      hrefs.some((h) => h.toLowerCase().includes('inventory')),
  },
  {
    key: 'visitor',
    label: 'Visitor Management Intelligence',
    route: '/admin-services/visitor',
    status: 'live',
    ladder: 'L5',
    moduleSlug: 'visitor-management',
    loadContract: async () => (await import('./contracts/visitor')).visitorIntelligenceContract,
    note:
      'Built on visitor_master and visitor_type, scoped by the institute’s own term dates against the visit date. ' +
      'NO VISIT DURATION ANYWHERE: entry and exit are bare times on an inconsistent clock and 12 of 112 closed ' +
      'visits in one year record an exit before the entry, so a dwell time would be wrong rather than approximate. ' +
      'What it does report is whether a visit was ever closed — 27.7% of one year’s visitors were never signed out ' +
      '— and that one institute files every visitor under a type belonging to a DIFFERENT institute. No visitor is ' +
      'named: name, contact, email, photo and the host field are not read. Five rules; the L5 loop is wired.',
    // The gate register, and only it. Matched on the module's own label and on
    // the add-visitor route rather than on the word "visitor" anywhere in a
    // path, because `hostel_visitor_master` and the hostel visitor screens are
    // a different module's records.
    nav: (label, link, hrefs) =>
      label === 'visitor management' ||
      label === 'visitor' ||
      hrefs.some((h) => {
        const href = h.toLowerCase();
        return href.includes('/admin-services/add-visitor') || href.includes('/admin-services/visitor-report');
      }),
  },
  {
    key: 'correspondence',
    label: 'Inward & Outward Intelligence',
    route: '/inward_outward',
    status: 'live',
    ladder: 'L5',
    moduleSlug: 'inward-outward',
    loadContract: async () =>
      (await import('./contracts/correspondence')).correspondenceIntelligenceContract,
    note:
      'Built on inward, outward, place_master and physical_file_location, year-scoped natively by the register’s own ' +
      'syear. The finding at every institute in this database is the ASYMMETRY: 1,830 letters logged in for one year ' +
      'and none logged out. Duplicate inward numbers are counted WITHIN the year — numbering restarts each year by ' +
      'design, and counting across years reported 409 collisions where the real figure is five. What a letter said ' +
      'is never read: title and description are free text and this register holds matters about named staff and ' +
      'children. Five rules; the L5 loop is wired.',
    // Both the register and its reports module resolve here: they are the same
    // records read two ways.
    nav: (label, link, hrefs) =>
      label === 'inward outward' ||
      label === 'inward outward report' ||
      label === 'inward/outward' ||
      hrefs.some((h) => h.toLowerCase().startsWith('/inward_outward')),
  },
  {
    key: 'teach-learn',
    label: 'Teach/Learn Intelligence',
    route: '/teach-learn',
    // `partial`, and the reason is the data rather than the screen. The findings
    // are real and reconciled, but ONE institute in this database publishes
    // content at any scale: 14,948 of the 15,005 tenant-owned `content_master`
    // rows are at institute 195, and the next largest holds 40. Every other
    // institute gets an honest unavailable state naming what it actually has.
    status: 'partial',
    ladder: 'L5',
    moduleSlug: 'teach_learn',
    loadContract: async () => (await import('./contracts/teach-learn')).teachLearnIntelligenceContract,
    note:
      'The curriculum content catalogue — NOT PAL, homework or exams, all three of which were checked and are owned ' +
      'elsewhere here. Built on sub_std_map (the courses) and content_master (the material). The two scope ' +
      'differently and the screen says so: sub_std_map carries no syear, so the catalogue is not year-scoped, while ' +
      'content_master carries one on all 31,197 rows. NO CHAPTER FIGURE APPEARS ANYWHERE — chapter_master holds 446 ' +
      'rows database-wide against 31,192 content rows citing a chapter, and 28,392 of those citations resolve to ' +
      'nothing, so the only mention of chapters is the finding that they do not resolve. Institute 1’s shared ' +
      'library is never counted as a tenant’s coverage: standard ids are tenant-scoped, so it joins to one course ' +
      'at institute 195 and none at 254. Five rules; the L5 loop is wired.',
    // ── TEACH/LEARN IS THE COURSE CATALOGUE, AND ONLY IT ────────────────────
    //
    // Measured against the live menu rows: `tblmenumaster` 269, level 2 under
    // "LMS + PAL" (230), holds exactly two `status = 1` level-3 screens —
    // 275 "LMS Global Mapping" (`lmsmapping.index` → /lms/global-mapping) and
    // 270 "Course Catalog" (`course-master/` → /course-master). 488 H5P content
    // and 462 Content Library are both disabled.
    //
    // Before this entry existed the module matched NOTHING — its label is
    // "Teach/Learn", its link is `javascript:void(0);` and neither of its two
    // routes contains a word any other matcher looks for — so its Intelligence
    // category resolved to a category page with no intelligence in it. That is
    // the case the registry header has described since the first audit.
    //
    // Matched on the module's own label and on ROUTE FAMILIES, never on a word
    // appearing anywhere in a path. `/course-master` is checked as a prefix
    // rather than a substring because `course_master.index` is a DIFFERENT and
    // currently disabled menu (456) under another parent, and a substring match
    // would claim it the moment somebody enabled it.
    nav: (label, link, hrefs) =>
      label === 'teach/learn' ||
      label === 'teach / learn' ||
      label === 'teach/ learn' ||
      label === 'teach learn' ||
      hrefs.some((h) => {
        const href = h.toLowerCase();
        return href.startsWith('/course-master') || href.startsWith('/lms/global-mapping');
      }),
  },

  // ── PEOPLE & COMPETENCY ────────────────────────────────────────────────
  //
  // Six level-2 modules under `tblmenumaster` 350 "People & Competency":
  // Organization Management (590), Task Management (551), Talent Management
  // (563), HRIT Management (535), Capability Intelligence (598) and LMS
  // (628) — verified against live `tblmenumaster`/`fees_menu_categories`
  // rows before writing any matcher below, per the standing rule that this
  // question is never answered by reading code alone.
  //
  // HRIT MANAGEMENT (535) IS DELIBERATELY ABSENT FROM THIS LIST. It is the
  // exact same row the `hr` entry above already claims by name — its own
  // documented six-module staff domain names "hrit-management (535)"
  // explicitly, and its children include "Attendance Tracking" and
  // "Attendance Reports". A dedicated staff Attendance Management
  // Intelligence screen exists, but it is mounted directly as a tab on
  // `/hrit/attendance-management/attendance-reports` (see that page), not
  // reached through this registry — adding a second entry here would only
  // ever lose to `hr`'s prior claim, or contest it.
  {
    key: 'organization',
    label: 'Organization Management Intelligence',
    route: '/modules/organization-management',
    status: 'live',
    ladder: 'L5',
    moduleSlug: 'organization-management',
    loadContract: async () => (await import('./contracts/organization')).organizationIntelligenceContract,
    note:
      'Built on tbluser, hrms_departments, talent_job_postings and talent_job_applications — the same tables the ' +
      'Employee Directory analytics endpoint already reads. Active headcount excludes terminated staff. ' +
      's_user_jobrole is not queried: it has no migration in this deployment.',
    // Two legacy children still use the old typo`d/underscored path
    // (`/organization_managment/...`) alongside the current hyphenated one —
    // both are matched as route-family prefixes, never as a bare label
    // substring, which is what let this module's own `/compliance-library`
    // child get mis-claimed by Library Intelligence before that matcher was
    // narrowed (see `library` above).
    nav: (label, link, hrefs) =>
      label === 'organization management' ||
      hrefs.some((h) => {
        const href = h.toLowerCase();
        return href.startsWith('/organization-management/') || href.startsWith('/organization_managment/');
      }),
  },
  {
    key: 'task-management',
    label: 'Task Management Intelligence',
    route: '/modules/task-management-551',
    status: 'live',
    ladder: 'L5',
    // The fees_menu_categories module_name for this row really is
    // `task-management-551`, not `task-management` — that slug is already
    // taken by an unrelated legacy module (tblmenumaster 253, "Institute
    // ERP"). Declared explicitly so `canonicalIntelligenceRoute` links here
    // rather than guessing the shorter slug.
    moduleSlug: 'task-management-551',
    loadContract: async () => (await import('./contracts/task-management')).taskManagementIntelligenceContract,
    note:
      'Built on the task table, scoped by sub_institute_id and SYEAR. There is no completed_at column, so the ' +
      'estimated cycle time is derived from updated_at rather than measured — the same precedent the task ' +
      'module\'s own workspace summary already relies on.',
    // NOT matched on the bare label: a different, unrelated menu row is also
    // literally labelled "Task Management" (tblmenumaster 253), so label
    // equality alone would claim the wrong module wherever that one appears.
    // Matched on the /task-management/ route family instead, confirmed
    // against this row's own ten children (dashboard, my-tasks,
    // projects-workstreams, calendar, reports-analysis, administration/*).
    nav: (label, link, hrefs) => hrefs.some((h) => h.toLowerCase().startsWith('/task-management/')),
  },
  {
    key: 'talent',
    label: 'Talent Management Intelligence',
    route: '/modules/talent-management',
    status: 'live',
    ladder: 'L5',
    moduleSlug: 'talent-management',
    loadContract: async () => (await import('./contracts/talent')).talentIntelligenceContract,
    note:
      'Built on talent_job_postings, talent_job_applications, talent_onboarding_journeys, s_mobility_applications/' +
      '_transfers/_promotions, talent_offboarding_cases and s_performance_reviews. talent_mobility_requests and ' +
      'talent_offboarding_clearances do not exist in this deployment; internal mobility and offboarding clearance ' +
      'read from the tables that actually hold that data instead of returning a silent zero.',
    nav: (label, link, hrefs) =>
      label === 'talent management' || hrefs.some((h) => h.toLowerCase().startsWith('/talent-management/')),
  },
  {
    key: 'capability',
    label: 'Capability Intelligence',
    route: '/modules/capability-intelligence',
    status: 'live',
    ladder: 'L5',
    moduleSlug: 'capability-intelligence',
    loadContract: async () => (await import('./contracts/capability')).capabilityIntelligenceContract,
    note:
      'Built on s_user_jobrole and s_user_skill_jobrole. The real job-role title lives on ' +
      's_user_skill_jobrole.skill, not .jobrole as an existing dashboard controller assumes — joining on .jobrole ' +
      'returns zero mapped roles despite tens of thousands of real mapping rows; this module joins on .skill.',
    // This module's own children include /capability-intelligence/competency-library
    // and /capability-intelligence/competency-framework — exactly the routes
    // the `library` matcher above was previously narrowed to exclude after
    // both were found opening Library Intelligence by mistake. Matched here
    // on the module's own label and route family, not on either word.
    nav: (label, link, hrefs) =>
      label === 'capability intelligence' ||
      hrefs.some((h) => h.toLowerCase().startsWith('/capability-intelligence/')),
  },
  {
    key: 'lms-activity',
    label: 'LMS Intelligence',
    route: '/modules/lms',
    status: 'live',
    ladder: 'L5',
    moduleSlug: 'lms',
    loadContract: async () => (await import('./contracts/lms-activity')).lmsActivityIntelligenceContract,
    note:
      'Blends the real course/content catalogue (sub_std_map, content_master — the same tables Teach/Learn reads) ' +
      'with real homework submission activity. NOT the same menu row as Teach/Learn: this is tblmenumaster 628 ' +
      '"LMS" under "People & Competency" (350); Teach/Learn is 269 under the unrelated "LMS + PAL" (230). No ' +
      'evaluation/scoring signal exists in the homework data (0 of 1,543 rows carry teacher review), so none is shown.',
    // This row's own nine children resolve to dotted route-name identifiers
    // (`g2g_lms.course_builder` and similar), not real paths, so no href
    // route family can be matched reliably here — the level-2 label, which
    // was verified against the live menu row and is not used as a label by
    // any other registered module, is the only safe signal.
    nav: (label) => label === 'lms',
  },

  /*
   * ââ FOUR MODULES THAT USED TO ANSWER "The Brain does not watch this menu" ââ
   *
   * Each declares `moduleSlug`, so `intelligenceEntryFor` matches it by exact
   * equality against `fees_menu_categories.module_name` and never has to guess
   * from a label. That is deliberate: label guessing is what once gave
   * document-templates the RESULT contract, so a bursar opening the template
   * library was shown marks.
   *
   * `nav` is still declared for the sidebar path, which resolves by label and
   * route family rather than by slug.
   */
  {
    key: 'petty-cash',
    label: 'Petty Cash Intelligence',
    route: '/modules/petty-cash',
    status: 'live',
    ladder: 'L3',
    moduleSlug: 'petty-cash',
    loadContract: async () => (await import('./contracts/petty-cash')).pettyCashIntelligenceContract,
    note:
      'Built on petty_cash (215 rows) and petty_cash_master. There is no approval or payment column on the ' +
      'claims table, so the screen reports spending and evidence, never approval status. No syear: figures are ' +
      'all-time per institute.',
    nav: (label, link, hrefs) =>
      label === 'petty cash' ||
      link === 'petty_cash' ||
      hrefs.some((h) => h.toLowerCase().includes('/petty-cash/') || h.toLowerCase().includes('/petty_cash/')),
  },
  {
    key: 'document-templates',
    label: 'Document Templates Intelligence',
    route: '/modules/document-templates',
    status: 'live',
    ladder: 'L3',
    moduleSlug: 'document-templates',
    loadContract: async () =>
      (await import('./contracts/document-templates')).documentTemplatesIntelligenceContract,
    note:
      'Built on template_master and result_template_master, both tenant-scoped. ai_templates is EXCLUDED: all 143 ' +
      'rows leave sub_institute_id empty because they are product-shipped prompt templates, not an instituteâs ' +
      'documents. Previously mis-resolved to the Result contract.',
    nav: (label, link, hrefs) =>
      label === 'document templates' ||
      link === 'document_templates' ||
      hrefs.some((h) => h.toLowerCase().includes('/document-templates/')),
  },
  {
    key: 'ptm',
    label: 'PTM Intelligence',
    route: '/modules/ptm',
    status: 'live',
    ladder: 'L3',
    moduleSlug: 'ptm',
    loadContract: async () => (await import('./contracts/ptm')).ptmIntelligenceContract,
    note:
      'Built on ptm_time_slots_master (syear + sub_institute_id) and ptm_booking_master (SUB_INSTITUTE_ID, no ' +
      'syear) â bookings are year-scoped through their slot. PTM_ATTENDED_STATUS holds the words Yes/No plus a ' +
      '"--Select Status--" placeholder, which counts as unmarked rather than absent.',
    nav: (label, link, hrefs) =>
      label === 'ptm' ||
      link === 'ptm' ||
      hrefs.some((h) => h.toLowerCase().includes('/ptm/')),
  },
  {
    key: 'consent',
    label: 'Consent Intelligence',
    route: '/modules/consent',
    status: 'live',
    ladder: 'L3',
    moduleSlug: 'consent',
    loadContract: async () => (await import('./contracts/consent')).consentIntelligenceContract,
    note:
      'Built on consent_master (sub_institute_id + syear). Rows carry an amount and an imprest head, so this is ' +
      'consent with money attached. The status integer is grouped but never translated: its meaning is set by the ' +
      'instituteâs own screens.',
    nav: (label, link, hrefs) =>
      label === 'consent' ||
      link === 'consent' ||
      hrefs.some((h) => h.toLowerCase().includes('/consent/')),
  },
];

export function findIntelligenceModule(key: string): RegisteredIntelligenceModule | undefined {
  return INTELLIGENCE_MODULES.find((module) => module.key === key);
}

/** Modules a reader can actually open something useful in today. */
export function liveIntelligenceModules(): RegisteredIntelligenceModule[] {
  return INTELLIGENCE_MODULES.filter((module) => module.status === 'live');
}
