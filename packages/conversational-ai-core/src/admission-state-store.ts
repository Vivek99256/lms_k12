import type { AdmissionConversationState } from "./admission-conversation-state";
import {
  deleteStoredJson,
  readStoredJson,
  writeStoredJson,
} from "./file-store";

export async function getAdmissionState(key: string): Promise<AdmissionConversationState | null> {
  return readStoredJson<AdmissionConversationState>("admission-state", key);
}

export async function setAdmissionState(
  key: string,
  value: AdmissionConversationState
): Promise<void> {
  writeStoredJson("admission-state", key, value);
}

export async function deleteAdmissionState(key: string): Promise<void> {
  deleteStoredJson("admission-state", key);
}
