import test from "node:test";
import assert from "node:assert/strict";
import { getModuleDataIntent, isAnalyticalLmsQuery } from "./adapter";

function route(message: string) {
  return getModuleDataIntent(message.toLowerCase());
}

test("student count questions route to the student directory", () => {
  assert.equal(route("How many students are there?")?.suggestedTool, "getStudentDirectory");
  assert.equal(route("Show students from Standard 7")?.suggestedTool, "getStudentDirectory");
  assert.equal(route("What is the class strength of Standard 7 B?")?.suggestedTool, "getStudentDirectory");
});

test("student questions that belong to another workflow are left alone", () => {
  // Fees, homework, admission and result questions keep their existing tools.
  assert.equal(route("How many students have pending fees?"), null);
  assert.equal(route("Show homework for students of Standard 7"), null);
  assert.equal(route("How many student admission enquiries are open?"), null);
});

test("teacher questions route to the right teacher tool", () => {
  assert.equal(route("How many teachers are there?")?.suggestedTool, "getTeacherDirectory");
  assert.equal(
    route("Which teachers are assigned to Standard 7 B?")?.suggestedTool,
    "getClassTeachers"
  );
});

test("student attendance no longer falls through to the teacher daily report", () => {
  assert.equal(route("Show today's attendance")?.suggestedTool, "getAttendanceOverview");
  assert.equal(
    route("Show attendance for Standard 7")?.suggestedTool,
    "getAttendanceOverview"
  );
  // Teacher attendance keeps the existing daily-report workflow.
  assert.equal(
    route("Which teachers are absent today?")?.suggestedTool,
    "getTeacherDailyReport"
  );
});

test("catalogue questions route to the catalogue tools", () => {
  assert.equal(route("Show available subjects")?.suggestedTool, "getSubjectCatalog");
  assert.equal(route("Which courses are available?")?.suggestedTool, "getCourseCatalog");
  assert.equal(route("List all classes")?.suggestedTool, "getClassStructure");
  assert.equal(
    route("How many departments do we have?")?.suggestedTool,
    "getDepartmentDirectory"
  );
});

test("aggregate fee questions route to the fee summary, not a student lookup", () => {
  assert.equal(route("What is the total fee collection?")?.suggestedTool, "getFeesSummary");
  assert.equal(route("How much fee is outstanding?")?.suggestedTool, "getFeesSummary");
});

test("unrelated messages are not claimed by module data routing", () => {
  assert.equal(route("hello"), null);
  assert.equal(route("thanks for your help"), null);
});

test("analytical questions are detected only when they are LMS related", () => {
  assert.equal(isAnalyticalLmsQuery("which department needs the most training?"), true);
  assert.equal(isAnalyticalLmsQuery("compare attendance between standard 7 and 8"), true);
  assert.equal(isAnalyticalLmsQuery("which students have the highest fee risk?"), true);
  assert.equal(isAnalyticalLmsQuery("what trends can you identify in attendance?"), true);

  assert.equal(isAnalyticalLmsQuery("which is the best programming language?"), false);
  assert.equal(isAnalyticalLmsQuery("why is the sky blue?"), false);
  assert.equal(isAnalyticalLmsQuery("hello"), false);
});
