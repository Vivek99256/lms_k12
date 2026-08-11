import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdmissionSlots,
  getMissingAdmissionFields,
  normalizeAdmissionData,
  parseAdmissionFieldReply,
  parseAdmissionSlotInput,
  resolveAdmissionSelection,
} from "./admission-workflow";

test("buildAdmissionSlots only returns genuinely missing fields", () => {
  const slots = buildAdmissionSlots(
    {
      first_name: "Gajera",
      last_name: "Babubhai",
      mobile: "9876543210",
      date_of_birth: "2013-03-15",
      admission_standard: 8,
      admission_division: "",
      student_quota: "",
      admission_date: "2026-06-01",
    },
    {
      division: [{ id: "1", name: "A" }],
      category: [{ id: "2", title: "General" }],
      standard: [{ id: "8", name: "Standard 8" }],
    }
  );

  assert.deepEqual(
    slots.map((slot) => slot.key),
    ["admission_division", "student_quota"]
  );
});

test("parseAdmissionSlotInput extracts grouped slot values", () => {
  const updates = parseAdmissionSlotInput("Division A, General", [
    {
      key: "admission_division",
      label: "Division",
      type: "select",
      required: true,
      options: [{ value: "1", label: "A" }],
    },
    {
      key: "student_quota",
      label: "Student quota",
      type: "select",
      required: true,
      options: [{ value: "2", label: "General" }],
    },
  ]);

  assert.equal(updates.admission_division, "1");
  assert.equal(updates.student_quota, "2");
});

test("parseAdmissionFieldReply understands labelled aliases", () => {
  const updates = parseAdmissionFieldReply(
    "First name: Vivek, Last name: Gajera, DOB: 2019-09-01, Divisio: A, Quota: General, Admission date: 2025-09-01"
  );

  assert.equal(updates.first_name, "Vivek");
  assert.equal(updates.last_name, "Gajera");
  assert.equal(updates.date_of_birth, "2019-09-01");
  assert.equal(updates.admission_division, "A");
  assert.equal(updates.student_quota, "General");
  assert.equal(updates.admission_date, "2025-09-01");
});

test("normalizeAdmissionData maps legacy keys before missing-field validation", () => {
  const normalized = normalizeAdmissionData({
    first_name: "Vivek",
    last_name: "Gajera",
    dob: "2019-09-01",
    standard_id: "6",
    division_id: "1",
    student_quota_id: "2",
    admission_date: "2025-09-01",
  });

  assert.deepEqual(getMissingAdmissionFields(normalized), []);
});

test("resolveAdmissionSelection understands ordinal replies", () => {
  const selected = resolveAdmissionSelection("second student", [
    { id: "1", studentName: "Rajesh Kumar", enquiryNo: "2022001" },
    { id: "2", studentName: "Gajera Vivek Babubhai", enquiryNo: "2022009" },
  ]);

  assert.equal(selected?.id, "2");
});
