'use client';

// Fetch logic for the Outcomes & Delivery tab, shared by the tab itself
// (the summary) and the Outcome Detail drawer (one outcome at a time) so
// the URLSearchParams/fetch/AbortController boilerplate is not duplicated
// across the two.

import { useEffect, useState } from 'react';
import { createAuthHeaders, useLmsSessionContext } from '@/app/lms/_shared/useLmsSession';
import type { OutcomeDetailApiResponse, OutcomeSummaryApiData, OutcomeSummaryApiResponse } from './outcomes-types';

export type OutcomeFilters = {
  standardId: number | null;
  subjectId: number | null;
  curriculumId: number | null;
};

export function useOutcomeSummary(filters: OutcomeFilters) {
  const session = useLmsSessionContext();
  const [data, setData] = useState<OutcomeSummaryApiData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      if (!session.subInstituteId || !session.syear || !filters.standardId || !filters.subjectId || !filters.curriculumId) {
        setData(null);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const params = new URLSearchParams({
          sub_institute_id: session.subInstituteId,
          syear: session.syear,
          standard_id: String(filters.standardId),
          subject_id: String(filters.subjectId),
          curriculum_id: String(filters.curriculumId),
        });

        const response = await fetch(`${session.baseUrl}/api/intelligence/curriculum-outcomes?${params}`, {
          method: 'GET',
          signal: controller.signal,
          headers: createAuthHeaders(session),
        });

        const payload = (await response.json().catch(() => ({}))) as OutcomeSummaryApiResponse;

        if (response.status === 404) {
          setData(null);
          return;
        }

        if (!response.ok) {
          throw new Error(payload.message || `Curriculum outcomes API failed with status ${response.status}`);
        }

        setData(payload.data ?? null);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Couldn’t load curriculum outcomes.');
        setData(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [session.baseUrl, session.subInstituteId, session.syear, session.token, filters.standardId, filters.subjectId, filters.curriculumId]);

  return { data, isLoading, loadError };
}

export function useOutcomeDetail(outcomeId: number | null, filters: OutcomeFilters) {
  const session = useLmsSessionContext();
  const [detail, setDetail] = useState<OutcomeDetailApiResponse['data']>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      if (!outcomeId || !session.subInstituteId || !session.syear || !filters.curriculumId) {
        setDetail(null);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const params = new URLSearchParams({
          sub_institute_id: session.subInstituteId,
          syear: session.syear,
          curriculum_id: String(filters.curriculumId),
          outcome_id: String(outcomeId),
        });
        if (filters.standardId) params.set('standard_id', String(filters.standardId));

        const response = await fetch(`${session.baseUrl}/api/intelligence/curriculum-outcomes/outcome?${params}`, {
          method: 'GET',
          signal: controller.signal,
          headers: createAuthHeaders(session),
        });

        const payload = (await response.json().catch(() => ({}))) as OutcomeDetailApiResponse;

        if (!response.ok) {
          throw new Error(payload.message || `Outcome detail failed with status ${response.status}`);
        }

        setDetail(payload.data ?? null);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Couldn’t load outcome detail.');
        setDetail(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [outcomeId, session.baseUrl, session.subInstituteId, session.syear, session.token, filters.curriculumId, filters.standardId]);

  return { detail, isLoading, loadError };
}
