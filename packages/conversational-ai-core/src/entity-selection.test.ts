import test from "node:test";
import assert from "node:assert/strict";
import { resolveEntitySelection, selectEntityOrNull } from "./entity-selection";

/** Mirrors the entities stored after a real listFeesDefaulters call. */
const feeDefaulters = [
  {
    id: "10",
    label: "EVAAN RAJESH RAFALIYA",
    reference: "10",
    secondary: "7",
    metadata: { studentId: "10", studentName: "EVAAN RAJESH RAFALIYA", standard: "7", division: "C", enrollmentNo: "10" },
  },
  {
    id: "102",
    label: "GREEVA RAJESH RAFALIYA",
    reference: "102",
    secondary: "7",
    metadata: { studentId: "102", studentName: "GREEVA RAJESH RAFALIYA", standard: "7", division: "A", enrollmentNo: "102" },
  },
  {
    id: "664",
    label: "komal H vala",
    reference: "664",
    secondary: "7",
    metadata: { studentId: "664", studentName: "komal H vala", standard: "7", division: "A", enrollmentNo: "664" },
  },
  {
    id: "233",
    label: "Zeel J Tank",
    reference: "233",
    secondary: "7",
    metadata: { studentId: "233", studentName: "Zeel J Tank", standard: "7", division: "C", enrollmentNo: "233" },
  },
  {
    id: "100234",
    label: "Sonika P Pansuriya",
    reference: "100234",
    secondary: "7",
    metadata: { studentId: "100234", studentName: "Sonika P Pansuriya", standard: "7", division: "C", enrollmentNo: "100234" },
  },
];

test("resolves the complete displayed value", () => {
  const result = resolveEntitySelection("Zeel J Tank, 7, 233", feeDefaulters);

  assert.equal(result.status, "resolved");
  assert.equal(result.entity?.id, "233");
});

test("resolves by full name only", () => {
  const result = resolveEntitySelection("Zeel J Tank", feeDefaulters);

  assert.equal(result.status, "resolved");
  assert.equal(result.entity?.id, "233");
});

test("resolves by name and standard", () => {
  const result = resolveEntitySelection("Zeel J Tank, 7", feeDefaulters);

  assert.equal(result.status, "resolved");
  assert.equal(result.entity?.id, "233");
});

test("resolves by name and reference", () => {
  const result = resolveEntitySelection("Zeel J Tank, 233", feeDefaulters);

  assert.equal(result.status, "resolved");
  assert.equal(result.entity?.id, "233");
});

test("resolves by list position", () => {
  const result = resolveEntitySelection("4", feeDefaulters);

  assert.equal(result.status, "resolved");
  assert.equal(result.entity?.id, "233");
});

test("resolves by reference alone when it is not a list position", () => {
  const result = resolveEntitySelection("664", feeDefaulters);

  assert.equal(result.status, "resolved");
  assert.equal(result.entity?.id, "664");
});

test("resolves a lowercase partial name", () => {
  const result = resolveEntitySelection("komal vala", feeDefaulters);

  assert.equal(result.status, "resolved");
  assert.equal(result.entity?.id, "664");
});

test("digits inside the selection do not hijack the ordinal match", () => {
  const result = resolveEntitySelection("Sonika P Pansuriya, 7, 100234", feeDefaulters);

  assert.equal(result.status, "resolved");
  assert.equal(result.entity?.id, "100234");
});

test("an affirmative reply resolves nothing", () => {
  const result = resolveEntitySelection("yes", feeDefaulters);

  assert.equal(result.status, "unresolved");
  assert.equal(result.entity, null);
});

test("an unknown name resolves nothing instead of guessing", () => {
  const result = resolveEntitySelection("Ramesh Patel", feeDefaulters);

  assert.equal(result.status, "unresolved");
});

test("a shared surname reports ambiguity", () => {
  const result = resolveEntitySelection("RAJESH RAFALIYA", feeDefaulters);

  assert.equal(result.status, "ambiguous");
  assert.equal(result.candidates.length, 2);
});

test("ordinal words still work", () => {
  const result = resolveEntitySelection("the second one", feeDefaulters);

  assert.equal(result.status, "resolved");
  assert.equal(result.entity?.id, "102");
});

test("selectEntityOrNull returns null when unresolved", () => {
  assert.equal(selectEntityOrNull("no idea", feeDefaulters), null);
  assert.equal(selectEntityOrNull("Zeel J Tank", feeDefaulters)?.id, "233");
});

test("admission enquiries resolve by enquiry number", () => {
  const enquiries = [
    {
      id: "41",
      label: "Aarav Sharma",
      reference: "ENQ-2026-0041",
      secondary: "5",
      metadata: { enquiryId: "41", enquiryNo: "ENQ-2026-0041", studentName: "Aarav Sharma" },
    },
    {
      id: "42",
      label: "Diya Mehta",
      reference: "ENQ-2026-0042",
      secondary: "6",
      metadata: { enquiryId: "42", enquiryNo: "ENQ-2026-0042", studentName: "Diya Mehta" },
    },
  ];

  const result = resolveEntitySelection("ENQ-2026-0042", enquiries);

  assert.equal(result.status, "resolved");
  assert.equal(result.entity?.id, "42");
});
