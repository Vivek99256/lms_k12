const fs = require('fs');
const path = 'packages/conversational-ai-core/src/conversation.ts';
let content = fs.readFileSync(path, 'utf8');

const startMarker = '  if (admissionState.workflow === "confirm_admission" && admissionState.stage !== "idle") {';
const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  console.log('Start marker not found');
  process.exit(1);
}

const endMarker = '  if (\n    workflowState?.workflowId === "admission_confirmation" &&\n    workflowState.currentStage === "collecting_slots"\n  ) {';
const endIndex = content.indexOf(endMarker);
if (endIndex === -1) {
  console.log('End marker not found');
  process.exit(1);
}

const newBlock = `  if (admissionState.workflow === "confirm_admission" && admissionState.stage !== "idle") {
    const admissionRouting = routeAdmissionConversation(latestMessage, admissionState);

    switch (admissionRouting.action) {
      case "find_candidate":
        toolName = "findAdmissionCandidate";
        break;
      case "hydrate_candidate":
        toolName = "hydrateAdmissionCandidate";
        break;
      case "collect_missing_fields":
        toolName = "updateAdmissionCandidateDetails";
        break;
      case "execute_confirmation":
        toolName = "confirmAdmissionCandidate";
        break;
      case "cancel_confirmation": {
        admissionState.stage = "idle";
        admissionState.pendingAction = undefined;
        await saveAdmissionConversationState(prepared, admissionState);
        return {
          message: "Admission confirmation cancelled. Let me know if you need anything else.",
          conversationType: prepared.intent.type,
          status: "completed",
          toolExecutions: [{ tool: "cancelAdmissionConfirmation", status: "completed", summary: "Workflow cancelled by user." }],
          followUpSuggestions: ["List pending admissions", "Start over"],
          intent: prepared.intent,
          activeTools: prepared.activeTools,
        };
      }
      case "repeat_confirmation_summary": {
        const fullName = admissionState.selectedCandidate?.fullName || "the student";
        return {
          message: \`I'm ready to confirm admission for \${fullName}. Please reply "yes" to proceed or "no" to cancel.\`,
          conversationType: prepared.intent.type,
          status: "requires_input",
          toolExecutions: [{ tool: "repeatConfirmationSummary", status: "completed", summary: "Repeated confirmation summary." }],
          followUpSuggestions: ["Yes, confirm", "No, cancel"],
          intent: prepared.intent,
          activeTools: prepared.activeTools,
        };
      }
      case "wait_for_current_execution":
        return {
          message: "I'm processing the admission confirmation. Please wait a moment...",
          conversationType: prepared.intent.type,
          status: "in_progress",
          toolExecutions: [{ tool: "executeAdmissionConfirmation", status: "in_progress", summary: "Waiting for backend response." }],
          followUpSuggestions: ["Wait for completion"],
          intent: prepared.intent,
          activeTools: prepared.activeTools,
        };
      default:
        break;
    }
  }
`;

content = content.substring(0, startIndex) + newBlock + content.substring(endIndex);
fs.writeFileSync(path, content);
console.log('Replaced admission block');
