import type { AdmissionConversationState } from "./admission-conversation-state";

export interface ConversationStateStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

export class AdmissionStateService {
  constructor(private readonly store: ConversationStateStore) {}

  async get(key: string): Promise<AdmissionConversationState> {
    const existing = await this.store.get<AdmissionConversationState>(key);

    if (existing) {
      return existing;
    }

    return {
      workflow: "confirm_admission",
      stage: "idle",
      candidates: [],
      hydratedData: {},
      collectedFields: {},
      missingFields: [],
    };
  }

  async save(
    key: string,
    state: AdmissionConversationState,
  ): Promise<void> {
    await this.store.set(key, state);
  }

  async clear(key: string): Promise<void> {
    await this.store.delete(key);
  }
}
