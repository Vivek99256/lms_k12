import type { ProjectContext } from "@shared/conversational-ai-core";

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export async function resolveStudentQuota(input: {
  value: string | number;
  subInstituteId: string | number;
  academicYear: string | number;
  admissionApi: {
    listStudentQuotas: (ctx: {
      subInstituteId: string | number;
      academicYear: string | number;
    }) => Promise<Array<{ id: string | number; name: string }>>;
  };
}) {
  const quotas = await input.admissionApi.listStudentQuotas({
    subInstituteId: input.subInstituteId,
    academicYear: input.academicYear,
  });

  const normalized = normalizeText(String(input.value));

  const match = quotas.find(
    (quota) =>
      String(quota.id) === String(input.value) ||
      normalizeText(quota.name) === normalized,
  );

  if (!match) {
    const error = new Error(
      `Student quota "${input.value}" was not found.`,
    ) as Error & {
      field: string;
      availableOptions: typeof quotas;
    };
    error.field = "studentQuota";
    error.availableOptions = quotas;
    throw error;
  }

  return match;
}
