import type { AnswerAction } from './types';

/**
 * Where a finished turn lets you go next.
 *
 * This is the "and now open it in the module" hand-off the panel offers after a
 * conversation has actually produced something: an enrolment created, a student
 * identified, an enquiry picked out of a list. It disappeared when the model-driven
 * chat route was retired — that route stamped a `navigation` object onto its reply, and
 * with the route went both the field and the card that drew it.
 *
 * Rebuilt on the current architecture rather than resurrected. The backend names the
 * *record* a turn touched (`links`) and never the page, because Laravel has no business
 * knowing this application's routes and a route rename should not be a backend deploy.
 * So the mapping from record to destination lives here, next to the routes it names.
 *
 * The rule for offering one at all: a hand-off is only useful when there is a specific
 * record to open. "Go to the fees module" is a menu item, not a next step; "collect fees
 * for this student" is the thing the conversation just made possible.
 */

export interface ModuleHandoff {
  title: string;
  description: string;
  label: string;
  route: string;
  query?: Record<string, string | number>;
}

/** Read an id out of the backend's links, whatever numeric shape it arrived in. */
function id(links: Record<string, unknown>, key: string): number | null {
  const raw = links?.[key];
  const value = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());

  return Number.isFinite(value) && value > 0 ? value : null;
}

export function moduleHandoffFor(
  module: string | undefined,
  links: Record<string, unknown>,
  actions: AnswerAction[] = []
): ModuleHandoff | null {
  // A turn still waiting on a decision is not finished. Offering a way out of the panel
  // while an Approve button is sitting there unanswered invites the user to leave
  // mid-flow and wonder later why nothing happened.
  if (actions.some((action) => action.intent?.startsWith('approve') || action.intent?.startsWith('reject'))) {
    return null;
  }

  const studentId = id(links, 'student_id');
  const enquiryId = id(links, 'enquiry_id');

  // A saved report is checked before the module switch, because the same document can
  // come out of a fees, admissions or attendance turn and the destination is the same
  // one either way. It also outranks the per-student hand-offs below: the turn's result
  // *is* the document, so offering "collect fees" instead would send the user past the
  // very thing they asked to have made.
  const reportId = id(links, 'report_id');

  if (reportId) {
    const title = String(links?.report_title ?? '').trim();

    return {
      title: title || 'Report saved',
      description:
        'Saved under AI templates. Opens where it can be edited, printed, sent or refreshed against live records.',
      label: 'Open report',
      route: `/ai-reports/${reportId}`,
    };
  }

  switch ((module ?? '').toLowerCase()) {
    case 'admissions': {
      // A confirmed admission links both: the enquiry it came from and the student it
      // became. The student is the more useful destination — the enrolment is the thing
      // that now exists — so it wins when present.
      if (studentId) {
        return {
          title: 'Admission confirmed',
          description: 'The enrolment exists. Open it in the Admission module to carry on.',
          label: 'Open admission confirmation',
          route: '/admissions/admission_confirmation',
          query: { student_id: studentId, ...(enquiryId ? { enquiry_id: enquiryId } : {}) },
        };
      }

      if (!enquiryId) return null;

      // The enquiry has everything it needs and is waiting on a person. This is the
      // hand-off the conversation exists to reach: the assistant gathered the details,
      // and the module is where the confirmation is actually made and the process
      // carries on. Sending them to the enquiry list instead would drop them one screen
      // short of the thing they just spent a conversation preparing.
      // The backend's own answer to "may this person be sent to the confirmation
      // screen", carried as `allowed_actions.open_confirmation_page`. Deliberately not
      // the same question as "can this be confirmed": an admission missing four fields
      // cannot be confirmed in the chat but can absolutely be finished in the module,
      // and that gap is exactly what this hand-off is for.
      //
      // Falling back to the flow state keeps the button working if an older backend
      // does not send the flag.
      const state = String(links?.admission_state ?? '');
      const mayOpen =
        links?.can_open_confirmation_page != null || state === 'ready' || state === 'collecting';

      if (mayOpen) {
        return {
          title: 'Continue in the Admission module',
          description:
            'Opens this enquiry on the admission confirmation screen, where the rest of the process carries on.',
          label: 'Open in Admission module',
          route: '/admissions/admission_confirmation',
          query: { enquiry_id: enquiryId },
        };
      }

      return {
        title: 'Admission enquiry ready',
        description: 'Continue this enquiry in the Admission module.',
        label: 'Open this enquiry',
        route: '/admissions/admission_enquiry',
        query: { enquiry_id: enquiryId },
      };
    }

    case 'fees': {
      // Fees has a per-student collection page, which is the whole point of the
      // hand-off: the conversation identified who owes, the module takes the payment.
      if (studentId) {
        return {
          title: 'Fee collection ready',
          description: 'Open the collection page with this student already selected.',
          label: 'Collect fees',
          route: `/fees/collect/${studentId}`,
        };
      }

      return null;
    }

    default:
      return null;
  }
}
