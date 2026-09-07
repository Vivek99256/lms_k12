import assert from "node:assert/strict";
import { test } from "node:test";

import { rowAction } from "../../components/intelligence/AnswerSections";

/*
 * The bug this pins: every row in every module offered "Why is <name> at risk?",
 * so clicking View on an admission enquiry asked why that applicant was at academic
 * risk — and got told to run a risk scan first. A row belongs to a module, and the
 * only sensible question is that module's.
 */

test("an admission row starts the confirmation flow, addressed by id", () => {
  assert.equal(
    rowAction("admissions", { title: "Testing v Testing", id: 57 }),
    "Confirm the admission for enquiry 57"
  );
});

test("an admission row with no id offers nothing rather than asking by name", () => {
  // The confirmation flow resolves an enquiry by id. Asking by name would resolve
  // against nothing, and a button that silently fails is worse than no button.
  assert.equal(rowAction("admissions", { title: "Testing v Testing" }), null);
});

test("a student row still asks the risk question", () => {
  assert.equal(
    rowAction("student", { title: "Abhi Raval", id: 190488 }),
    "Why is Abhi Raval at risk?"
  );
});

test("a module with no row action offers no button", () => {
  // A generic fallback is what caused the original bug: it looked like the flow was
  // broken rather than absent.
  assert.equal(rowAction("hr", { title: "Someone", id: 1 }), null);
  assert.equal(rowAction(undefined, { title: "Someone", id: 1 }), null);
});
