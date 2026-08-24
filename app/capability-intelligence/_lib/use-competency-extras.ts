'use client';

/**
 * Ported from G2G's `hooks/use-competency-approvals.ts` — only the
 * `useSubmitForApproval` export, the sole piece the two ported screens use
 * (the Framework screen's "Submit for publish" action). See the GAP notice
 * in `competency-extras-api.ts`.
 */

import { useCallback, useEffect, useState } from 'react';

import { buildSessionContext, competencyApprovalService, type ApprovalTrailEntry } from './competency-extras-api';

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export interface ApprovalMutationResult {
  ok: boolean;
  message: string;
}

export function useSubmitForApproval() {
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (subjectType: 'competency' | 'framework', subjectId: number, note?: string): Promise<ApprovalMutationResult> => {
      setSubmitting(true);
      try {
        const response = await competencyApprovalService.submit(buildSessionContext(), {
          subject_type: subjectType,
          subject_id: subjectId,
          ...(note ? { note } : {}),
        });
        return { ok: true, message: response.message };
      } catch (error) {
        return { ok: false, message: toMessage(error, 'Failed to submit for approval.') };
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  return { submit, submitting };
}

/**
 * Ported from G2G's `hooks/use-competency-approvals.ts` — `useApprovalTrail`.
 * One subject's approval trail, for the Competency Library detail panel's
 * History tab. See the naming-overlap note in `competency-extras-api.ts`'s
 * `competencyApprovalService` header for the caveat on `subject_type='competency'`.
 */
export function useApprovalTrail(subjectType: 'competency' | 'framework', subjectId: number | null) {
  const [trail, setTrail] = useState<ApprovalTrailEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      if (subjectId == null) {
        setTrail([]);
        return;
      }
      try {
        const response = await competencyApprovalService.trail(buildSessionContext(), subjectType, subjectId);
        if (!cancelled) setTrail(response.data ?? []);
      } catch {
        // The trail is supporting context - a failure must not blank the panel.
        if (!cancelled) setTrail([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [subjectId, subjectType]);

  return trail;
}
