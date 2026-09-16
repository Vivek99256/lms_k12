import assert from "node:assert/strict";
import { test } from "node:test";

import { moduleHandoffFor } from "./module-handoff";
import type { AnswerAction } from "./types";

const approve: AnswerAction = {
  key: "approve",
  label: "Approve",
  intent: "approve_recommendation",
  utterance: "Approve the recommendation.",
  payload: { recommendation_id: 1 },
  style: "primary",
};

test("a confirmed admission opens the enrolment it created", () => {
  const handoff = moduleHandoffFor("admissions", { enquiry_id: 53, student_id: 190488 });

  assert.equal(handoff?.route, "/admissions/admission_confirmation");
  assert.equal(handoff?.query?.student_id, 190488);
  // The enquiry travels too — the page can show where the enrolment came from.
  assert.equal(handoff?.query?.enquiry_id, 53);
});

test("an enquiry with no enrolment yet opens the enquiry, not the confirmation", () => {
  // The student does not exist until the admission is confirmed, so sending someone to
  // the confirmation page would open it on nothing.
  const handoff = moduleHandoffFor("admissions", { enquiry_id: 53 });

  assert.equal(handoff?.route, "/admissions/admission_enquiry");
  assert.equal(handoff?.query?.enquiry_id, 53);
});

test("a fees turn opens collection for the student it identified", () => {
  const handoff = moduleHandoffFor("fees", { student_id: 190488 });

  assert.equal(handoff?.route, "/fees/collect/190488");
});

test("no record means no hand-off", () => {
  // "Go to the fees module" is a menu item, not a next step. A hand-off is only worth
  // offering when the conversation produced something specific to open.
  assert.equal(moduleHandoffFor("fees", {}), null);
  assert.equal(moduleHandoffFor("admissions", {}), null);
});

test("a module with no page of its own offers nothing", () => {
  assert.equal(moduleHandoffFor("student", { student_id: 190488 }), null);
  assert.equal(moduleHandoffFor(undefined, { student_id: 1 }), null);
});

test("a turn still waiting on a decision offers no way out of the panel", () => {
  // Leaving mid-flow with an unanswered Approve button is how a user ends up wondering
  // later why nothing happened.
  assert.equal(moduleHandoffFor("fees", { student_id: 190488 }, [approve]), null);
});

test("a non-numeric or zero id is not a record", () => {
  assert.equal(moduleHandoffFor("fees", { student_id: 0 }), null);
  assert.equal(moduleHandoffFor("fees", { student_id: "not-an-id" }), null);
  // A numeric string is still an id — PHP hands these across as strings routinely.
  assert.equal(moduleHandoffFor("fees", { student_id: "190488" })?.route, "/fees/collect/190488");
});

test("an enquiry waiting on a person opens the confirmation screen, not the list", () => {
  // The hand-off the conversation exists to reach: the assistant gathered the details,
  // and the module is where the confirmation is made and the process carries on.
  // Sending them to the enquiry list would drop them one screen short.
  for (const state of ['ready', 'collecting']) {
    const handoff = moduleHandoffFor('admissions', { enquiry_id: 57, admission_state: state });

    assert.equal(handoff?.route, '/admissions/admission_confirmation', state);
    assert.equal(handoff?.query?.enquiry_id, 57);
  }
});

test("an enquiry in no particular state still opens the enquiry screen", () => {
  const handoff = moduleHandoffFor('admissions', { enquiry_id: 57 });

  assert.equal(handoff?.route, '/admissions/admission_enquiry');
});

test("a confirmed admission still wins with the enrolment it created", () => {
  // State must not override the student: once the enrolment exists, that is the record
  // worth opening.
  const handoff = moduleHandoffFor('admissions', {
    enquiry_id: 57,
    student_id: 190488,
    admission_state: 'confirmed',
  });

  assert.equal(handoff?.route, '/admissions/admission_confirmation');
  assert.equal(handoff?.query?.student_id, 190488);
});

test("the in-chat confirm action does not suppress the hand-off", () => {
  // `admission_confirm` is not an approval gate — it is the flow's own step, and the
  // module hand-off is a parallel way to finish, not a competing one.
  const handoff = moduleHandoffFor(
    'admissions',
    { enquiry_id: 57, admission_state: 'ready' },
    [{ key: 'confirm_admission', label: 'Confirm', intent: 'admission_confirm', utterance: 'Yes.', payload: {}, style: 'primary' }]
  );

  assert.notEqual(handoff, null);
});

test("the backend's own permission opens the confirmation screen", () => {
  // `allowed_actions.open_confirmation_page` is a different question from "can this be
  // confirmed here": an enquiry missing four fields cannot be confirmed in the chat but
  // can be finished in the module. That gap is what the hand-off is for.
  const handoff = moduleHandoffFor('admissions', {
    enquiry_id: 21,
    admission_state: 'collecting',
    can_open_confirmation_page: 1,
  });

  assert.equal(handoff?.route, '/admissions/admission_confirmation');
  assert.equal(handoff?.query?.enquiry_id, 21);
});

test("without the flag, the flow state still decides", () => {
  // Keeps the button working against a backend that does not send the permission yet.
  assert.equal(
    moduleHandoffFor('admissions', { enquiry_id: 21, admission_state: 'ready' })?.route,
    '/admissions/admission_confirmation'
  );
  assert.equal(
    moduleHandoffFor('admissions', { enquiry_id: 21 })?.route,
    '/admissions/admission_enquiry'
  );
});

test("a saved report opens the report, whichever module produced it", () => {
  // The same document comes out of fees, admissions and attendance turns, so the
  // hand-off cannot be keyed on the module.
  for (const moduleKey of ['fees', 'admissions', 'attendance']) {
    const handoff = moduleHandoffFor(moduleKey, {
      report_id: 118,
      report_link: '/ai-reports/118',
      report_title: 'Fees report — 12 rows, 7 Sep 2026',
    });

    assert.equal(handoff?.route, '/ai-reports/118');
    assert.equal(handoff?.label, 'Open report');
    assert.equal(handoff?.title, 'Fees report — 12 rows, 7 Sep 2026');
  }
});

test("the report hand-off outranks the per-student one", () => {
  // A fees report turn also names the students it covers. Offering "collect fees" for
  // one of them would walk the user past the document they asked to have made.
  const handoff = moduleHandoffFor('fees', { report_id: 118, student_id: 190488 });

  assert.equal(handoff?.route, '/ai-reports/118');
});

test("a report turn with no id falls back to the module hand-off", () => {
  const handoff = moduleHandoffFor('fees', { student_id: 190488 });

  assert.equal(handoff?.route, '/fees/collect/190488');
});
