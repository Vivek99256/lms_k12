'use client';

import { ComingSoonPanel } from '@/components/ui/coming-soon';
import { canSeeInternalItems } from '@/lib/roadmap';

/**
 * Enterprise Brain → Governance.
 *
 * WHY THIS SCREEN EXISTS BEFORE IT IS BUILT
 *
 * The Intelligence Loop already approves decisions and executes them. What it
 * does not have is a record of who approved each one, on what evidence, or a
 * gate where a person can stop it first. That is a real gap in our own
 * controls, and leaving the space blank hides it — from the team who need to
 * close it, and from anyone reviewing whether the loop can be trusted with
 * decisions that affect money or a student.
 *
 * So the section exists and says plainly what is missing. Its roadmap row is
 * marked internal-only, so it is visible to staff here and never appears on the
 * customer-facing roadmap: a school does not need to be handed a description of
 * a control we have not finished.
 */
export default function GovernancePage() {
  // The section is hidden from the Brain's navigation on customer builds, but a
  // hidden link is not a closed door — the route still answers to anyone who
  // types it. Since the whole content of this page is a description of a gap in
  // our own controls, the page checks for itself rather than trusting that
  // nobody found the URL.
  if (!canSeeInternalItems()) {
    return (
      <div className="pb-8">
        <ComingSoonPanel
          title="Not available"
          summary="This section is not part of your workspace."
          status="coming-soon"
        />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <ComingSoonPanel
        roadmapId="ai.governance"
        title="Decision approval trail"
        points={[
          'Who or what approved each decision, and when.',
          'The evidence it was approved on, and the confidence behind it.',
          'A human approval gate before anything is carried out.',
          'An override record when a person overrules the recommendation.',
        ]}
      />
    </div>
  );
}
