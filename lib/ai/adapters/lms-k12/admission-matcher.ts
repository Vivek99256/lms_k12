import type { AdmissionCandidateSummary } from "@shared/conversational-ai-core";
import type { ParsedCandidateReference } from "./admission-candidate-parser";

function normalizeText(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function matchSavedCandidates(
  candidates: AdmissionCandidateSummary[],
  input: ParsedCandidateReference,
): AdmissionCandidateSummary[] {
  if (input.ordinal) {
    const candidate = candidates[input.ordinal - 1];
    return candidate ? [candidate] : [];
  }

  return candidates.filter((candidate) => {
    if (
      input.enquiryNo &&
      normalizeText(candidate.enquiryNo) === normalizeText(input.enquiryNo)
    ) {
      return true;
    }

    if (
      input.mobile &&
      candidate.mobile?.replace(/\D/g, "") === input.mobile.replace(/\D/g, "")
    ) {
      return true;
    }

    if (input.fullName) {
      const candidateName = normalizeText(candidate.fullName);
      const requestedName = normalizeText(input.fullName);

      const nameMatches =
        candidateName === requestedName ||
        candidateName.includes(requestedName) ||
        requestedName.includes(candidateName);

      const standardMatches =
        !input.standard ||
        normalizeText(candidate.standardName) === normalizeText(input.standard) ||
        String(candidate.standardId) === String(input.standard);

      return nameMatches && standardMatches;
    }

    return false;
  });
}
