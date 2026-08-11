import type { ProjectAIAdapter } from "./types";

export interface RegisteredProjectAdapter {
  id: string;
  adapter: ProjectAIAdapter;
}

const registry = new Map<string, ProjectAIAdapter>();

function normalizeProjectId(projectId: string) {
  return projectId.trim().toLowerCase();
}

export function registerProjectAdapter(projectId: string, adapter: ProjectAIAdapter) {
  registry.set(normalizeProjectId(projectId), adapter);
}

export function registerProjectAdapters(adapters: RegisteredProjectAdapter[]) {
  for (const entry of adapters) {
    registerProjectAdapter(entry.id, entry.adapter);
  }
}

export function getRegisteredProjectAdapter(projectId: string) {
  return registry.get(normalizeProjectId(projectId));
}

export function listRegisteredProjectAdapters() {
  return [...registry.entries()].map(([id, adapter]) => ({
    id,
    adapter,
  }));
}

export function createProjectAdapterResolver(defaultProjectId: string) {
  return function resolveProjectAdapter(projectId = defaultProjectId) {
    const adapter = getRegisteredProjectAdapter(projectId);
    if (!adapter) {
      throw new Error(
        `No conversational AI adapter is registered for "${projectId}".`
      );
    }

    return adapter;
  };
}
