import type { ProjectContext } from "@shared/conversational-ai-core";

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export async function resolveDivision(input: {
  value: string | number;
  standardId: string | number;
  subInstituteId: string | number;
  academicYear: string | number;
  admissionApi: {
    listDivisions: (ctx: {
      standardId: string | number;
      subInstituteId: string | number;
      academicYear: string | number;
    }) => Promise<Array<{ id: string | number; name: string }>>;
  };
}) {
  const divisions = await input.admissionApi.listDivisions({
    standardId: input.standardId,
    subInstituteId: input.subInstituteId,
    academicYear: input.academicYear,
  });

  const normalized = normalizeText(String(input.value));

  const match = divisions.find(
    (division) =>
      String(division.id) === String(input.value) ||
      normalizeText(division.name) === normalized,
  );

  if (!match) {
    const error = new Error(
      `Division "${input.value}" is not available for the selected Standard.`,
    ) as Error & {
      field: string;
      availableOptions: typeof divisions;
    };
    error.field = "division";
    error.availableOptions = divisions;
    throw error;
  }

  return match;
}
