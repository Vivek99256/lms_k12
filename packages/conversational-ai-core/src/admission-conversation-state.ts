export type AdmissionConversationStage =
  | "idle"
  | "listing_candidates"
  | "awaiting_candidate_selection"
  | "hydrating_candidate"
  | "collecting_missing_fields"
  | "awaiting_confirmation"
  | "executing_confirmation"
  | "completed"
  | "failed";

export interface AdmissionCandidateSummary {
  enquiryId: number;
  enquiryNo?: string;
  fullName: string;
  mobile?: string;
  standardId?: number;
  standardName?: string;
  status?: string;
}

export interface PendingAdmissionAction {
  name: "confirmAdmission";
  payload: Record<string, unknown>;
  idempotencyKey: string;
  confirmationToken?: string;
}

export interface AdmissionConversationState {
  workflow: "confirm_admission";
  stage: AdmissionConversationStage;

  enquiryId?: number;
  registrationId?: number;
  studentId?: number;

  candidates: AdmissionCandidateSummary[];
  selectedCandidate?: AdmissionCandidateSummary;

  hydratedData: Record<string, unknown>;
  collectedFields: Record<string, unknown>;
  missingFields: string[];

  pendingAction?: PendingAdmissionAction;

  lastTool?: string;
  lastError?: string;
}
