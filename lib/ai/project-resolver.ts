import {
  createProjectAdapterResolver,
  registerProjectAdapters,
} from "@shared/conversational-ai-core";
import { lmsK12Adapter } from "./adapters/lms-k12/adapter";

registerProjectAdapters([{ id: lmsK12Adapter.projectId, adapter: lmsK12Adapter }]);

const resolveRegisteredProjectAdapter = createProjectAdapterResolver("lms_k12");

export function resolveProjectAdapter() {
  const projectId = (process.env.AI_PROJECT_ID || "lms_k12").trim().toLowerCase();
  return resolveRegisteredProjectAdapter(projectId);
}
