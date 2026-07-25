import {
  isRecord,
  readNumber,
  readString,
  recordArray,
  requireSession,
  utilityRequest,
} from "./erp";

/**
 * Grade → standard → division options.
 *
 * The legacy Blade screens render these three chained dropdowns with the
 * `App\Helpers\SearchChain()` helper, which is session-bound and HTML-only. The
 * stateless equivalent already used by the Next.js frontend is
 * `GET api/class-teachers`, which returns `academic_sections`, `standards`
 * (carrying `grade_id`) and `divisions` (carrying `standard_id`) for the
 * institute — the exact three tables SearchChain reads. Nothing is hardcoded.
 */

export type NamedOption = {
  id: number;
  name: string;
};

export type StandardOption = NamedOption & {
  gradeId: number;
};

export type DivisionOption = NamedOption & {
  standardId: number;
};

export type ClassOptions = {
  academicSections: NamedOption[];
  standards: StandardOption[];
  divisions: DivisionOption[];
};

export const emptyClassOptions: ClassOptions = {
  academicSections: [],
  standards: [],
  divisions: [],
};

/**
 * @param overrides Institute / academic year to scope the options to. Student
 *   transfer uses this to read the *destination* institute's classes, since the
 *   endpoint takes `sub_institute_id` as a request parameter.
 */
export async function loadClassOptions(overrides?: {
  subInstituteId?: string;
  syear?: string;
}): Promise<ClassOptions> {
  const session = requireSession();
  const payload = await utilityRequest("api/class-teachers", {
    session,
    query: {
      ...(overrides?.subInstituteId ? { sub_institute_id: overrides.subInstituteId } : {}),
      ...(overrides?.syear ? { syear: overrides.syear } : {}),
    },
  });
  const data = isRecord(payload.data) ? payload.data : payload;

  return {
    academicSections: recordArray(data.academic_sections)
      .map((record) => ({
        id: readNumber(record.id),
        name: readString(record.title).trim(),
      }))
      .filter((option) => option.id > 0),
    standards: recordArray(data.standards)
      .map((record) => ({
        id: readNumber(record.id),
        name: readString(record.name).trim(),
        gradeId: readNumber(record.grade_id),
      }))
      .filter((option) => option.id > 0),
    divisions: recordArray(data.divisions)
      .map((record) => ({
        id: readNumber(record.id),
        name: readString(record.name).trim(),
        standardId: readNumber(record.standard_id),
      }))
      .filter((option) => option.id > 0),
  };
}

export function standardsForGrade(options: ClassOptions, gradeId: string): StandardOption[] {
  if (!gradeId) return [];
  return options.standards.filter((standard) => standard.gradeId === Number(gradeId));
}

export function divisionsForStandard(options: ClassOptions, standardId: string): DivisionOption[] {
  if (!standardId) return [];
  return options.divisions.filter((division) => division.standardId === Number(standardId));
}
