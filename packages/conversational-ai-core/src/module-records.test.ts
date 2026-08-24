import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecordNavigation,
  buildToolInputCandidates,
  extractModuleRecords,
} from "./module-records";

test("listFeesDefaulters rows become selectable fee records", () => {
  const extraction = extractModuleRecords("listFeesDefaulters", {
    source: "lms_backend",
    totalCount: 2,
    students: [
      {
        id: "233",
        studentName: "Zeel J Tank",
        standard: "7",
        division: "C",
        enrollmentNo: "233",
        mobileNo: "9876543210",
        pendingFees: 12500,
      },
      {
        id: "664",
        studentName: "komal H vala",
        standard: "7",
        division: "A",
        enrollmentNo: "664",
        pendingFees: 4000,
      },
    ],
  });

  assert.ok(extraction);
  assert.equal(extraction?.module, "fees");
  assert.equal(extraction?.workflowId, "fee_collection");
  assert.equal(extraction?.entities.length, 2);
  assert.equal(extraction?.entities[0].label, "Zeel J Tank");
  assert.equal(extraction?.entities[0].reference, "233");
  assert.equal(extraction?.entities[0].metadata?.studentId, "233");
  assert.equal(extraction?.entities[0].metadata?.division, "C");
});

test("a selected fee record projects onto findStudentFeeRecord input", () => {
  const [primary, ...fallbacks] = buildToolInputCandidates("findStudentFeeRecord", {
    module: "fees",
    studentId: "233",
    studentName: "Zeel J Tank",
    standard: "7",
    division: "C",
    enrollmentNo: "233",
  });

  assert.deepEqual(primary, {
    studentName: "Zeel J Tank",
    standard: "7",
    division: "C",
    enrollmentNo: "233",
  });
  // Looser retries exist so an over-strict class filter never dead-ends.
  assert.ok(fallbacks.length > 0);
  assert.deepEqual(fallbacks.at(-1), { studentName: "Zeel J Tank" });
});

test("a selected fee record projects onto getStudentFeeDetails input", () => {
  assert.deepEqual(
    buildToolInputCandidates("getStudentFeeDetails", { studentId: "233" }),
    [{ studentId: "233" }]
  );
});

test("no record means no projected input", () => {
  assert.deepEqual(buildToolInputCandidates("findStudentFeeRecord", null), []);
});

test("a fee record navigates to the existing fee collection route", () => {
  const navigation = buildRecordNavigation("fees", {
    studentId: "233",
    studentName: "Zeel J Tank",
  });

  assert.deepEqual(navigation, {
    route: "/fees/collect/233",
    query: {},
    label: "Continue to Fee Collection",
  });
});

test("a fee record without a student id does not navigate", () => {
  assert.equal(buildRecordNavigation("fees", { studentName: "Zeel J Tank" }), null);
});

test("an admission record navigates to the existing confirmation route", () => {
  const navigation = buildRecordNavigation("admissions", {
    enquiryId: "41",
    registrationId: "77",
    studentName: "Aarav Sharma",
  });

  assert.equal(navigation?.route, "/admissions/confirmation");
  assert.deepEqual(navigation?.query, { enquiry_id: "41", registration_id: "77" });
});

test("homework rows become selectable records and navigate to the report", () => {
  const extraction = extractModuleRecords("listHomework", {
    count: 1,
    data: [
      {
        id: 91,
        title: "Algebra worksheet 3",
        student_name: "Zeel J Tank",
        standard_id: 7,
        standard_name: "Standard 7",
        division_id: 3,
        division_name: "C",
        subject_id: 12,
        subject_name: "Maths",
        date: "2026-08-10",
      },
    ],
  });

  assert.equal(extraction?.module, "homework");
  assert.equal(extraction?.entities.length, 1);
  assert.equal(extraction?.entities[0].label, "Algebra worksheet 3");

  const navigation = buildRecordNavigation(
    "homework",
    extraction?.entities[0].metadata as Record<string, unknown>
  );

  assert.equal(navigation?.route, "/lms/homework/report");
  assert.deepEqual(navigation?.query, {
    homework_id: "91",
    standard_id: "7",
    division_id: "3",
    subject_id: "12",
    from_date: "2026-08-10",
    to_date: "2026-08-10",
    q: "Algebra worksheet 3",
  });
});

test("non record-producing tools are ignored", () => {
  assert.equal(extractModuleRecords("getLmsDashboard", { anything: true }), null);
});
