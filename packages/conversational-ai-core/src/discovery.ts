import { z } from "zod";

export const projectModuleSchema = z.object({
  name: z.string(),
  type: z.enum([
    "controller",
    "route",
    "service",
    "repository",
    "entity",
    "model",
    "dto",
    "validator",
    "permission",
    "workflow",
    "openapi",
    "database",
    "mcp_tool",
  ]),
  sourcePath: z.string(),
  exportedName: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const projectRouteSchema = z.object({
  id: z.string(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]),
  path: z.string(),
  controller: z.string().optional(),
  action: z.string().optional(),
  authRequired: z.boolean().default(true),
  permissions: z.array(z.string()).default([]),
  requestSchemaRef: z.string().optional(),
  responseSchemaRef: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const databaseEntitySchema = z.object({
  name: z.string(),
  table: z.string().optional(),
  sourcePath: z.string().optional(),
  primaryKey: z.string().optional(),
  fields: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean().default(false),
        searchable: z.boolean().default(false),
        filterable: z.boolean().default(false),
      })
    )
    .default([]),
  relations: z
    .array(
      z.object({
        name: z.string(),
        target: z.string(),
        type: z.enum(["oneToOne", "oneToMany", "manyToOne", "manyToMany"]),
      })
    )
    .default([]),
});

export const projectPermissionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  scope: z.enum(["global", "organization", "tenant", "user"]).default("tenant"),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
});

export const discoveredToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  source: z.enum(["api", "service", "database", "mcp", "workflow"]),
  operationRef: z.string(),
  permissions: z.array(z.string()).default([]),
  capabilities: z.array(z.string()).default([]),
  riskLevel: z.enum(["low", "medium", "high"]).default("medium"),
  requiresConfirmation: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const projectDiscoverySnapshotSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  version: z.string().default("1"),
  generatedAt: z.string(),
  modules: z.array(projectModuleSchema).default([]),
  routes: z.array(projectRouteSchema).default([]),
  entities: z.array(databaseEntitySchema).default([]),
  permissions: z.array(projectPermissionSchema).default([]),
  tools: z.array(discoveredToolSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ProjectModule = z.infer<typeof projectModuleSchema>;
export type ProjectRoute = z.infer<typeof projectRouteSchema>;
export type DatabaseEntity = z.infer<typeof databaseEntitySchema>;
export type ProjectPermission = z.infer<typeof projectPermissionSchema>;
export type DiscoveredTool = z.infer<typeof discoveredToolSchema>;
export type ProjectDiscoverySnapshot = z.infer<
  typeof projectDiscoverySnapshotSchema
>;

export interface DiscoverySource {
  name: string;
  collect(): Promise<Partial<ProjectDiscoverySnapshot>>;
}

export interface ProjectDiscoveryProvider {
  projectId: string;
  discover(): Promise<ProjectDiscoverySnapshot>;
  refresh?(): Promise<ProjectDiscoverySnapshot>;
}

export async function mergeDiscoverySources(
  projectId: string,
  projectName: string,
  sources: DiscoverySource[]
): Promise<ProjectDiscoverySnapshot> {
  const snapshot: ProjectDiscoverySnapshot = {
    projectId,
    projectName,
    version: "1",
    generatedAt: new Date().toISOString(),
    modules: [],
    routes: [],
    entities: [],
    permissions: [],
    tools: [],
    metadata: {},
  };

  for (const source of sources) {
    const partial = await source.collect();
    if (partial.modules) {
      snapshot.modules.push(...partial.modules);
    }
    if (partial.routes) {
      snapshot.routes.push(...partial.routes);
    }
    if (partial.entities) {
      snapshot.entities.push(...partial.entities);
    }
    if (partial.permissions) {
      snapshot.permissions.push(...partial.permissions);
    }
    if (partial.tools) {
      snapshot.tools.push(...partial.tools);
    }

    snapshot.metadata[source.name] = partial.metadata || {};
  }

  return projectDiscoverySnapshotSchema.parse(snapshot);
}
