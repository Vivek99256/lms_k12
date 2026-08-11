import type { AdmissionConversationState } from "@shared/conversational-ai-core";
import { buildAdmissionConfirmationPayload } from "./build-admission-payload";
import { buildRegistrationPayloadFromEnquiry } from "./build-admission-payload";

export interface AdmissionWorkflowContext {
  stateService: {
    get: (key: string) => Promise<AdmissionConversationState>;
    save: (key: string, state: AdmissionConversationState) => Promise<void>;
  };
  stateKey: string;
  admissionApi: {
    createRegistration: (payload: Record<string, any>) => Promise<{ registrationId?: string | number; id?: string | number }>;
    confirmAdmission: (payload: Record<string, any>) => Promise<{ success: boolean; message?: string; data?: any }>;
    getAdmissionStatusByEnquiryId: (input: {
      enquiryId: number;
      subInstituteId: string | number;
    }) => Promise<{ status?: string } | null>;
  };
  auth: {
    subInstituteId: string | number;
    academicYear: string | number;
    userId: string | number;
    userProfileId?: string | number;
    token?: string;
  };
}

export async function executePendingAdmissionAction(
  state: AdmissionConversationState,
  context: AdmissionWorkflowContext,
) {
  if (!state.pendingAction) {
    throw new Error("No pending admission action was found.");
  }

  state.stage = "executing_confirmation";
  await context.stateService.save(context.stateKey, state);

  let registrationId = state.registrationId;

  if (!registrationId) {
    const registrationPayload = buildRegistrationPayloadFromEnquiry(
      state.pendingAction.payload
    );

    const registrationResult = await context.admissionApi.createRegistration(
      registrationPayload
    );

    registrationId =
      Number(registrationResult.registrationId ?? registrationResult.id);

    if (!registrationId) {
      throw new Error(
        "Registration was created but the registration ID was not returned.",
      );
    }

    state.registrationId = Number(registrationId);
  }

  const existingResult =
    await context.admissionApi.getAdmissionStatusByEnquiryId({
      enquiryId: state.enquiryId!,
      subInstituteId: context.auth.subInstituteId,
    });

  if (existingResult?.status === "Confirmed") {
    state.stage = "completed";
    state.pendingAction = undefined;
    await context.stateService.save(context.stateKey, state);

    return {
      status: "already_completed",
      message: `${state.selectedCandidate?.fullName ?? "The student"} is already confirmed.`,
      data: existingResult,
    };
  }

  const confirmationResult = await context.admissionApi.confirmAdmission({
    ...buildAdmissionConfirmationPayload(state.pendingAction.payload),
    registration_id: registrationId,
    enquiry_id: state.enquiryId,
    sub_institute_id: context.auth.subInstituteId,
    user_id: context.auth.userId,
    user_profile_id: context.auth.userProfileId,
    syear: context.auth.academicYear,
    token: context.auth.token,
    confirmation_token: state.pendingAction.confirmationToken,
    __context: {
      baseUrl: process.env.NEXT_PUBLIC_ERP_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL_DEV || process.env.NEXT_PUBLIC_API_BASE_URL_PROD,
      subInstituteId: String(context.auth.subInstituteId),
      syear: String(context.auth.academicYear),
      termId: state.hydratedData.termId ? String(state.hydratedData.termId) : undefined,
      token: context.auth.token,
    },
  });

  if (!confirmationResult.success) {
    state.stage = "failed";
    state.lastError =
      confirmationResult.message ?? "Admission confirmation failed.";

    await context.stateService.save(context.stateKey, state);

    return {
      status: "failed",
      message: state.lastError,
    };
  }

  state.stage = "completed";
  state.pendingAction = undefined;

  await context.stateService.save(context.stateKey, state);

  return {
    status: "completed",
    data: confirmationResult.data,
    message: formatAdmissionSuccessMessage(confirmationResult.data),
  };
}

function formatAdmissionSuccessMessage(data: Record<string, any>): string {
  const studentName =
    typeof data.student_name === "string"
      ? data.student_name
      : typeof data.full_name === "string"
        ? data.full_name
        : "the student";

  const admissionNo =
    typeof data.admission_no === "string"
      ? data.admission_no
      : typeof data.enrollment_no === "string"
        ? data.enrollment_no
        : "";

  const standard =
    typeof data.standard_name === "string"
      ? data.standard_name
      : typeof data.standard === "string"
        ? data.standard
        : "";

  const division =
    typeof data.division_name === "string"
      ? data.division_name
      : typeof data.division === "string"
        ? data.division
        : "";

  const parts = [
    `Admission confirmed successfully for ${studentName}.`,
    admissionNo ? `Admission No.: ${admissionNo}` : null,
    standard ? `Standard: ${standard}` : null,
    division ? `Division: ${division}` : null,
    "Status: Confirmed",
  ].filter(Boolean);

  return parts.join("\n");
}
