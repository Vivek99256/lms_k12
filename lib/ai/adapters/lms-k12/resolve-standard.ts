import type { ProjectContext } from "@shared/conversational-ai-core";

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export async function resolveStandard(input: {
  value: string | number;
  subInstituteId: string | number;
  academicYear: string | number;
  admissionApi: {
    listStandards: (ctx: {
      subInstituteId: string | number;
      academicYear: string | number;
    }) => Promise<Array<{ id: string | number; name: string; shortName?: string }>>;
  };
}) {
  const standards = await input.admissionApi.listStandards({
    subInstituteId: input.subInstituteId,
    academicYear: input.academicYear,
  });

  const normalized = normalizeText(String(input.value));

  const match = standards.find((standard) => {
    return (
      String(standard.id) === String(input.value) ||
      normalizeText(standard.name) === normalized ||
      normalizeText(standard.shortName ?? "") === normalized
    );
  });

  if (!match) {
    const available = standards.map((item) => ({
      id: item.id,
      name: item.name,
    }));
    const message = `The selected Standard "${input.value}" was not found.`;
    const error = new Error(message) as Error & {
      field: string;
      availableOptions: typeof available;
    };
    error.field = "standard";
    error.availableOptions = available;
    throw error;
  }

  return match;
}
