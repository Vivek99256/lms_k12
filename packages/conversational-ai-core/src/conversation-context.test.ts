import test from "node:test";
import assert from "node:assert/strict";
import {
  clearFollowUpState,
  isContextualFollowUp,
  recordFollowUpQuery,
  resolveConversationFocus,
  getFollowUpState,
} from "./followup-state";
import { extractConversationFocus } from "./conversation-focus";
import {
  composeAnalysisNarrative,
  summarizeModuleDataResult,
} from "./conversation";

const SESSION = { userId: "user-1", sessionId: "conversation-1" };

function departmentDirectoryResult() {
  return {
    source: "lms_backend",
    available: true,
    module: "departments",
    totalCount: 3,
    totalEmployees: 9,
    largestDepartment: { name: "Workplace Safety and Health", totalEmployees: 3 },
    departments: [
      { id: "4", name: "Workplace Safety and Health", parentName: null, totalEmployees: 3 },
      { id: "7", name: "Operational Control", parentName: "Workplace Safety and Health", totalEmployees: 2 },
      { id: "9", name: "System Audit", parentName: "Workplace Safety and Health", totalEmployees: 1 },
    ],
  };
}

/* -------------------------------------------------------------------------- */
/* Detecting a message that cannot stand on its own                           */
/* -------------------------------------------------------------------------- */

test("bare and pronoun-bearing messages are recognised as follow-ups", () => {
  for (const message of [
    "Why?",
    "why",
    "Why would that department be considered high risk?",
    "Which employees are affected?",
    "What skills are missing there?",
    "and for Standard 8?",
    "tell me more",
    "How does it compare with the others?",
  ]) {
    assert.equal(isContextualFollowUp(message), true, message);
  }
});

test("self-contained questions are not treated as follow-ups", () => {
  for (const message of [
    "How many students are enrolled in Standard 7 division B this year?",
    "Show the fees defaulter report for Standard 9 with pending amounts",
    "Which teachers are assigned to Standard 8 A according to the timetable?",
  ]) {
    assert.equal(isContextualFollowUp(message), false, message);
  }
});

/* -------------------------------------------------------------------------- */
/* Focus extraction                                                           */
/* -------------------------------------------------------------------------- */

test("a department answer leaves the named department behind as the focus", () => {
  const extraction = extractConversationFocus(
    "getDepartmentDirectory",
    departmentDirectoryResult()
  );

  assert.equal(extraction?.module, "departments");
  assert.equal(extraction?.focus?.kind, "department");
  assert.equal(extraction?.focus?.name, "Workplace Safety and Health");
  assert.equal(extraction?.candidates.length, 3);
});

test("an attendance answer focuses on the weakest class", () => {
  const extraction = extractConversationFocus("getAttendanceOverview", {
    module: "attendance",
    date: "2026-08-18",
    lowestAttendance: { standard: "7", division: "B", attendancePercent: 62 },
    classes: [
      { standard: "7", division: "A", standardId: "7", attendancePercent: 94 },
      { standard: "7", division: "B", standardId: "7", attendancePercent: 62 },
    ],
  });

  assert.equal(extraction?.focus?.kind, "class");
  assert.equal(extraction?.focus?.name, "7 B");
});

test("the analysis bundle promotes the leader of whichever dataset has one", () => {
  const extraction = extractConversationFocus("analyzeLmsData", {
    module: "analysis",
    facts: { departments: departmentDirectoryResult() },
  });

  assert.equal(extraction?.focus?.name, "Workplace Safety and Health");
});

test("a tool that returned no rows leaves no focus to point at", () => {
  const extraction = extractConversationFocus("getDepartmentDirectory", {
    module: "departments",
    departments: [],
  });

  assert.equal(extraction?.focus, undefined);
  assert.deepEqual(extraction?.candidates, []);
});

/* -------------------------------------------------------------------------- */
/* Resolving the follow-up against the remembered turn                        */
/* -------------------------------------------------------------------------- */

test("a bare 'Why?' resolves to the record the previous answer was about", () => {
  clearFollowUpState(SESSION.userId);

  const extraction = extractConversationFocus(
    "getDepartmentDirectory",
    departmentDirectoryResult()
  )!;

  recordFollowUpQuery(SESSION, {
    tool: "getDepartmentDirectory",
    module: extraction.module,
    filters: {},
    focus: extraction.focus,
    candidates: extraction.candidates,
    resolvedEntities: [],
    rowCount: extraction.rowCount,
    status: "success",
  });

  const resolved = resolveConversationFocus(
    getFollowUpState(SESSION.userId, SESSION.sessionId),
    "Why?"
  );

  assert.equal(resolved?.focus.name, "Workplace Safety and Health");
  assert.equal(resolved?.focus.kind, "department");
});

test("naming a different record in the follow-up overrides the previous focus", () => {
  clearFollowUpState(SESSION.userId);

  const extraction = extractConversationFocus(
    "getDepartmentDirectory",
    departmentDirectoryResult()
  )!;

  recordFollowUpQuery(SESSION, {
    tool: "getDepartmentDirectory",
    module: extraction.module,
    filters: {},
    focus: extraction.focus,
    candidates: extraction.candidates,
    resolvedEntities: [],
    status: "success",
  });

  const resolved = resolveConversationFocus(
    getFollowUpState(SESSION.userId, SESSION.sessionId),
    "What about System Audit?"
  );

  assert.equal(resolved?.focus.name, "System Audit");
});

test("with nothing remembered, a follow-up resolves to nothing rather than guessing", () => {
  clearFollowUpState(SESSION.userId);

  const resolved = resolveConversationFocus(
    getFollowUpState(SESSION.userId, SESSION.sessionId),
    "Why?"
  );

  assert.equal(resolved, null);
});

/* -------------------------------------------------------------------------- */
/* The answer must never carry raw output                                     */
/* -------------------------------------------------------------------------- */

test("analysis facts are rendered as sentences, never as serialised data", () => {
  const message = composeAnalysisNarrative({
    module: "analysis",
    facts: {
      departments: departmentDirectoryResult(),
      students: {
        totalStudents: 420,
        byStandard: [{ label: "7", count: 96 }],
        byClass: [],
        byGender: [],
      },
    },
    unavailableDatasets: [{ dataset: "fees_summary", reason: "backend unreachable" }],
  });

  assert.match(message, /Workplace Safety and Health/);
  assert.match(message, /420 enrolled students/);
  assert.match(message, /fees summary/);

  // The reported defect: raw structures and internal identifiers leaking out.
  assert.doesNotMatch(message, /[{}]/);
  assert.doesNotMatch(message, /"source"|lms_backend|totalCount|analyzeLmsData/);
});

test("an analysis that loaded nothing says so instead of returning an empty object", () => {
  const message = composeAnalysisNarrative({
    module: "analysis",
    facts: {},
    unavailableDatasets: [{ dataset: "departments", reason: "backend unreachable" }],
  });

  assert.match(message, /could not load/i);
  assert.match(message, /departments/);
  assert.doesNotMatch(message, /[{}]/);
});

/* -------------------------------------------------------------------------- */
/* Each answer addresses its own question, in a scannable shape               */
/* -------------------------------------------------------------------------- */

test("an attendance answer reports attendance, not a student roster", () => {
  const message = summarizeModuleDataResult("getAttendanceOverview", {
    module: "attendance",
    date: "2026-08-18",
    appliedFilters: { standard: "7", division: null },
    totals: {
      totalStudents: 42,
      present: 35,
      absent: 7,
      attendancePercent: 83.3,
      classesReported: 3,
      classesPending: 1,
    },
    lowestAttendance: { standard: "7", division: "B", attendancePercent: 75 },
    classes: [
      { standard: "7", division: "A", present: 15, totalStudents: 16, attendancePercent: 93.8, attendanceTaken: true },
      { standard: "7", division: "B", present: 12, totalStudents: 16, attendancePercent: 75, attendanceTaken: true },
      { standard: "7", division: "C", present: 8, totalStudents: 10, attendancePercent: 80, attendanceTaken: true },
    ],
  })!;

  assert.match(message, /Attendance for Standard 7 on 2026-08-18/);
  assert.match(message, /Present: 35 \(83\.3%\)/);
  assert.match(message, /Absent: 7/);
  assert.match(message, /7 B — 12 of 16 present/);
  assert.match(message, /Lowest: 7 B at 75%/);

  // Broken into blocks rather than delivered as one paragraph.
  assert.ok(message.split("\n").length >= 6);
});

test("a roster answer leads with the count for the class that was asked about", () => {
  const message = summarizeModuleDataResult("getStudentDirectory", {
    module: "students",
    totalCount: 12,
    instituteTotal: 21,
    appliedFilters: { standard: "7", division: null },
    breakdown: [
      { label: "7 A", count: 5 },
      { label: "7 B", count: 4 },
      { label: "7 C", count: 3 },
    ],
    students: [
      { studentName: "Zeel J Tank", standard: "7", division: "A", rollNo: "4" },
      { studentName: "komal H vala", standard: "7", division: "A", rollNo: "7" },
    ],
  })!;

  assert.match(message, /Standard 7 has 12 enrolled students\./);
  assert.match(message, /By division:/);
  assert.match(message, /• 7 A — 5/);
  assert.match(message, /• Zeel J Tank — Standard 7 A, roll 4/);
  assert.ok(message.split("\n").length >= 6);
});
