'use client';

/**
 * Curriculum metadata for the selected tenant (sub-institute).
 *
 * The board (CBSE / ICSE / GSEB / IB / state boards / …) is tenant + subject +
 * academic-year specific and lives on the `lms/new_curriculum` record, so nothing in
 * the UI may assume a board. Both the curriculum screen and the chapter screens read
 * it from here.
 */
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/app/components/utils/api_url';

export type CurriculumSession = {
  token: string;
  hostName: string;
  subInstituteId: string;
  academicYearId: string;
};

export type CurriculumData = {
  curriculum_id: number;
  extraction_id: number;
  sub_institute_id: number;
  grade_id: number | null;
  standard_id: number;
  subject_id: number;
  board_id: number | null;
  curriculum_name: string;
  curriculum_alignment: string | null;
  holistic_curriculum: string | null;
  model_integration: string | null;
  syear: number;
  board: string | null;
  framework: string | null;
  internal_marks: number | null;
  status: string | null;
  created_at: string;
  updated_at: string;
};

export type UnitData = {
  unit_number: number;
  name: string;
  unit_chapters: string | string[] | null;
  total_marks: number | null;
  planned_periods: number | string | null;
  chapter_id: number;
};

export type OutcomeNode = {
  id: number;
  code: string | null;
  type: string | null;
  parent_id: number | null;
  description: string | null;
  objective: string | null;
  chapter: string | null;
  outcome: string | null;
  assessment_tool: string | null;
  children: OutcomeNode[];
};

export type CurriculumApiResult = {
  curriculum_data: CurriculumData | null;
  unit_data: UnitData[];
  outcomes: OutcomeNode[];
};

function readString(value: unknown): string {
  return value != null && value !== '' ? String(value) : '';
}

export function getCurriculumSession(): CurriculumSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

    const token = readString(userData.user_token ?? userData.token);
    const hostName = readString(userData.host_name) || API_BASE_URL;
    const subInstituteId = readString(userData.sub_institute_id ?? menuContext.sub_institute_id);
    const academicYearId =
      readString(localStorage.getItem('selectedAcademicYear')) ||
      readString(userData.academic_year_id ?? userData.academicYearId);

    if (!token || !hostName || !subInstituteId || !academicYearId) {
      return null;
    }

    return {
      token,
      hostName,
      subInstituteId,
      academicYearId,
    };
  } catch {
    return null;
  }
}

export async function fetchCurriculumData(
  session: CurriculumSession,
  subjectId: string,
  standardId?: string
): Promise<CurriculumApiResult> {
  const query = new URLSearchParams({
    subject_id: subjectId,
    sub_institute_id: session.subInstituteId,
    syear: session.academicYearId,
    ...(standardId ? { standard_id: standardId } : {}),
  });

  const response = await fetch(
    `${session.hostName.replace(/\/$/, '')}/lms/new_curriculum?${query.toString()}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
    }
  );

  const responseData = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error('Curriculum request failed');
  }

  const result = Array.isArray(responseData) ? responseData[0] : responseData;

  const curriculumData =
    result && typeof result === 'object' && 'curriculum_data' in result
      ? ((result as Record<string, unknown>).curriculum_data as CurriculumData | null) ?? null
      : null;
  const unitData =
    result && typeof result === 'object' && Array.isArray((result as Record<string, unknown>).unit_data)
      ? ((result as Record<string, unknown>).unit_data as UnitData[])
      : [];
  const outcomes =
    result && typeof result === 'object' && Array.isArray((result as Record<string, unknown>).outcomes)
      ? ((result as Record<string, unknown>).outcomes as OutcomeNode[])
      : [];

  return {
    curriculum_data: curriculumData,
    unit_data: unitData,
    outcomes,
  };
}

/**
 * Board name for the tenant's curriculum, e.g. "CBSE", "ICSE", "IB".
 * Returns '' when the tenant has no curriculum record yet — callers must then
 * omit the board rather than substituting a default.
 */
/**
 * The fields these labels read. Structural so callers holding their own curriculum
 * shape - the student screen keeps a local copy of this record - can label it
 * without re-deriving the rule or converting the type.
 */
export type CurriculumLabelSource = {
  board?: string | null;
  framework?: string | null;
  curriculum_name?: string | null;
} | null;

export function getCurriculumBoard(curriculum: CurriculumLabelSource): string {
  return readString(curriculum?.board).trim();
}

/**
 * Header label for the tenant's curriculum — "CBSE curriculum", "ICSE curriculum",
 * "GSEB curriculum", and so on for whichever board the tenant has configured.
 * Falls back to the framework or the curriculum name when the board itself isn't
 * set, and to '' when nothing is known, in which case callers omit the label
 * rather than substituting a default board.
 */
export function getCurriculumLabel(curriculum: CurriculumLabelSource): string {
  const board = getCurriculumBoard(curriculum);
  if (board) return `${board} curriculum`;

  const framework = readString(curriculum?.framework).trim();
  if (framework) return `${framework} curriculum`;

  return readString(curriculum?.curriculum_name).trim();
}

/**
 * Fetch just the curriculum record for a subject, ignoring units and outcomes.
 * Resolves to null (never throws) so a missing curriculum can't break a page
 * that only needs the board for a label.
 */
export async function fetchCurriculumMeta(
  subjectId: string,
  standardId?: string
): Promise<CurriculumData | null> {
  const session = getCurriculumSession();
  if (!session || !subjectId) return null;

  try {
    const result = await fetchCurriculumData(session, subjectId, standardId);
    return result.curriculum_data;
  } catch {
    return null;
  }
}

/**
 * The tenant's curriculum for a subject, as a header-ready label.
 *
 * `loading` separates "not fetched yet" from "fetched, nothing configured" so the
 * header can stay quiet while the request is in flight instead of flashing a
 * label that is about to change.
 */
export function useCurriculumMeta(
  subjectId: string,
  standardId?: string
): { curriculum: CurriculumData | null; board: string; label: string; loading: boolean } {
  const key = `${subjectId}|${standardId ?? ''}`;
  // The resolved subject is stored with its result, so switching subjects reports
  // `loading` again without a synchronous setState in the effect.
  const [resolved, setResolved] = useState<{ key: string; curriculum: CurriculumData | null } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;

    fetchCurriculumMeta(subjectId, standardId).then((data) => {
      if (!cancelled) setResolved({ key, curriculum: data });
    });

    return () => {
      cancelled = true;
    };
  }, [key, standardId, subjectId]);

  const loading = resolved?.key !== key;
  const curriculum = loading ? null : resolved?.curriculum ?? null;
  const label = getCurriculumLabel(curriculum);

  return {
    curriculum,
    board: getCurriculumBoard(curriculum),
    label: loading ? '' : label,
    loading,
  };
}
