export type AdmissionWorkflowLikeState = {
  stage?: string | null;
};

export type AdmissionWorkflowLikeIntent = {
  capability?: string | null;
  suggestedTool?: string | null;
};

function looksLikeNonAdmissionModuleRequest(message: string) {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const isOtherModule = /(fees?|defaulter|homework|assignment|result|marks|attendance|timetable|exam|library|transport|hostel|notification|notice|account|invoice|expense|ledger|payment|dues|receipt)/i.test(normalized);
  const isAdmissionContext = /(admission|enquiry|candidate|registration|confirm)/i.test(normalized);

  return isOtherModule && !isAdmissionContext;
}

export function shouldContinueAdmissionWorkflow(
  state: AdmissionWorkflowLikeState | null | undefined,
  message: string,
  intent?: AdmissionWorkflowLikeIntent | null
) {
  if (!state || state.stage === "idle") {
    return false;
  }

  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return false;
  }

  if (/^(yes|haan|ha|yep|yeah|ok|okay|sure|continue|go ahead|proceed)\b/i.test(normalizedMessage)) {
    return state.stage === "awaiting_confirmation";
  }

  if (looksLikeNonAdmissionModuleRequest(normalizedMessage)) {
    return false;
  }

  const admissionIntent = Boolean(
    intent?.capability && /admission|confirm_admission|admission_enquiries/i.test(intent.capability)
  ) || Boolean(
    intent?.suggestedTool && /admission|confirmAdmission|findAdmission|updateAdmission|hydrateAdmission/i.test(intent.suggestedTool)
  );

  if (admissionIntent) {
    return true;
  }

  const isAdmissionMessage = /(admission|enquiry|candidate|registration|confirm)/i.test(normalizedMessage);
  if (isAdmissionMessage) {
    return true;
  }

  return state.stage === "collecting_missing_fields" || state.stage === "awaiting_candidate_selection";
}
