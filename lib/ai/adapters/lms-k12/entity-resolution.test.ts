import test from "node:test";
import assert from "node:assert/strict";
import {
  filterStudentDirectory,
  normalizeEntityLabel,
  type StudentRecord,
} from "./entity-resolution";

function student(overrides: Partial<StudentRecord>): StudentRecord {
  return {
    id: "1",
    studentName: "Unknown Student",
    enrollmentNo: "",
    rollNo: "",
    mobileNo: "",
    email: "",
    gender: "",
    grade: "Primary",
    gradeId: "1",
    standard: "7",
    standardId: "7",
    division: "A",
    divisionId: "11",
    fatherName: "",
    motherName: "",
    ...overrides,
  };
}

const directory: StudentRecord[] = [
  student({ id: "1", studentName: "Zeel J Tank", standard: "7", division: "A", gender: "M", enrollmentNo: "GR-101" }),
  student({ id: "2", studentName: "Aarohi Shah", standard: "7", division: "B", divisionId: "12", gender: "F", rollNo: "14" }),
  student({ id: "3", studentName: "Rohan Patel", standard: "8", standardId: "8", division: "A", gender: "M", mobileNo: "98765 43210" }),
];

test("normalizeEntityLabel strips class and division prefixes", () => {
  assert.equal(normalizeEntityLabel("Standard 7"), "7");
  assert.equal(normalizeEntityLabel("std 7"), "7");
  assert.equal(normalizeEntityLabel("Class 7"), "7");
  assert.equal(normalizeEntityLabel("Division B"), "b");
  assert.equal(normalizeEntityLabel("Section B"), "b");
  assert.equal(normalizeEntityLabel(""), "");
});

test("filterStudentDirectory matches a standard given as a spoken label", () => {
  const rows = filterStudentDirectory(directory, { standard: "Standard 7" });
  assert.deepEqual(
    rows.map((row) => row.id),
    ["1", "2"]
  );
});

test("filterStudentDirectory matches a standard given as a backend id", () => {
  const rows = filterStudentDirectory(directory, { standard: "8" });
  assert.deepEqual(
    rows.map((row) => row.id),
    ["3"]
  );
});

test("filterStudentDirectory combines standard and division filters", () => {
  const rows = filterStudentDirectory(directory, { standard: "7", division: "B" });
  assert.deepEqual(
    rows.map((row) => row.id),
    ["2"]
  );
});

test("filterStudentDirectory resolves a partial student name", () => {
  const rows = filterStudentDirectory(directory, { studentName: "aarohi" });
  assert.deepEqual(
    rows.map((row) => row.id),
    ["2"]
  );
});

test("filterStudentDirectory compares mobile numbers without formatting", () => {
  const rows = filterStudentDirectory(directory, { mobileNo: "9876543210" });
  assert.deepEqual(
    rows.map((row) => row.id),
    ["3"]
  );
});

test("filterStudentDirectory understands gender words", () => {
  assert.deepEqual(
    filterStudentDirectory(directory, { gender: "female" }).map((row) => row.id),
    ["2"]
  );
  assert.deepEqual(
    filterStudentDirectory(directory, { gender: "male" }).map((row) => row.id),
    ["1", "3"]
  );
});

test("filterStudentDirectory returns nothing for a class the institute does not run", () => {
  assert.deepEqual(filterStudentDirectory(directory, { standard: "12" }), []);
});
