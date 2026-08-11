export const ADMISSION_CONFIRMATION_REQUIRED_FIELDS = [
  "firstName",
  "lastName",
  "dateOfBirth",
  "standardId",
  "divisionId",
  "studentQuotaId",
  "admissionDate",
] as const;

export function getMissingAdmissionFields(
  data: Record<string, unknown>,
): string[] {
  return ADMISSION_CONFIRMATION_REQUIRED_FIELDS.filter((field) => {
    const value = data[field];

    return (
      value === undefined ||
      value === null ||
      value === "" ||
      (typeof value === "number" && Number.isNaN(value))
    );
  });
}
