import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';

import type { Agent, AgentModuleKey, AgentRun, AgentRunStatus, AgentRunTrigger } from './types';

/**
 * Where agents and their runs live.
 *
 * SERVER ONLY. This module touches the filesystem and database; the browser reaches it through
 * app/api/agents/* and never imports it.
 */

export interface AgentListFilter {
  module?: string;
  status?: Agent['status'];
}

export interface RunListFilter {
  module?: string;
  agentId?: string;
  limit?: number;
}

export interface AgentStore {
  listAgents(tenantId: string, filter?: AgentListFilter): Promise<Agent[]>;
  getAgent(tenantId: string, id: string): Promise<Agent | null>;
  insertAgent(agent: Agent): Promise<Agent>;
  updateAgent(agent: Agent): Promise<Agent>;
  listRuns(tenantId: string, filter?: RunListFilter): Promise<AgentRun[]>;
  appendRun(run: AgentRun): Promise<AgentRun>;
}

interface StoreShape {
  agents: Agent[];
  runs: AgentRun[];
}

export const BASELINE_AGENTS: Agent[] = [
  {
    id: 'agt_34dc52f6dc24',
    name: 'Course catalogue reader',
    description:
      'Reads the courses and chapters configured for this institute and continuously validates the complete 5-tier content hierarchy (Standard -> Subject -> Chapter -> Topic -> Intelligence). Changes nothing.',
    module: 'teach_learn',
    tenant_id: '1',
    tools_allowed: ['teach_learn.courses'],
    instructions:
      'Report what the course catalogue returns and validate the complete 5-tier learning content hierarchy: Standard -> Subject -> Chapter -> Topic -> Intelligence. Identify missing subjects, chapters, topics, or intelligence configurations, and report any broken mappings. Never describe configured content as something a student has completed.',
    trigger: 'scheduled',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-09-23T08:47:56.926Z',
    updated_at: '2026-10-27T13:30:00.000Z',
  },
  {
    id: 'agt_e39a5505022e',
    name: 'Activity timeline reader',
    description: 'Reads sessions and homework set for a class over a window around today. Changes nothing.',
    module: 'teach_learn',
    tenant_id: '1',
    tools_allowed: ['teach_learn.activities'],
    instructions:
      'Report the activities exactly as recorded, with their dates. An activity being on the timeline means it was scheduled or set, not that it happened or was completed — never imply otherwise.',
    trigger: 'manual',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-10-27T07:12:38.284Z',
    updated_at: '2026-10-27T07:12:38.284Z',
  },
  {
    id: 'agt_a52e39ddbd8b',
    name: 'Content model coverage agent',
    description:
      'Analyzes content model coverage across institute chapters, identifying covered and missing content mappings to support curriculum and content planning. Changes nothing.',
    module: 'teach_learn',
    tenant_id: '1',
    tools_allowed: ['teach_learn.content_model_coverage'],
    instructions:
      'Analyze and report content model coverage across institute chapters. Identify which chapters have complete mappings (concept learning, practice, misconceptions, assessment) and which have missing components. Present actionable coverage results to support curriculum and content planning. Changes nothing.',
    trigger: 'manual',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-10-28T09:15:00.000Z',
    updated_at: '2026-10-28T09:15:00.000Z',
  },
  {
    id: 'agt_exam_summary_reader',
    name: 'Online exam summary reader',
    description:
      'Reads published teacher online question papers and student exam attempts to evaluate cohort performance benchmarks. Excludes PAL automated tests. Changes nothing.',
    module: 'exam_assessment',
    tenant_id: '1',
    tools_allowed: ['exam_assessment.online_exam_summary'],
    instructions:
      'Scan online exams for the target standard. Compute student attempts, average score %, and isolate at-risk attempts below 40%. Disregard PAL practice tests. Changes nothing.',
    trigger: 'scheduled',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-10-28T10:00:00.000Z',
    updated_at: '2026-10-28T10:00:00.000Z',
  },
  {
    id: 'agt_assignment_status_reader',
    name: 'Assignment status reader',
    description:
      'Audits coursework completion across homework, subjective assignments, worksheets, and projects. Changes nothing.',
    module: 'exam_assessment',
    tenant_id: '1',
    tools_allowed: ['exam_assessment.assignment_status'],
    instructions:
      'Track assignment submissions and highlight pending or unsubmitted items across all coursework types. Changes nothing.',
    trigger: 'manual',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-10-28T10:05:00.000Z',
    updated_at: '2026-10-28T10:05:00.000Z',
  },
  {
    id: 'agt_review_note_drafter',
    name: 'Assessment review drafter',
    description:
      'Synthesizes exam performance and coursework status into constructive draft review notes for teacher approval.',
    module: 'exam_assessment',
    tenant_id: '1',
    tools_allowed: ['exam_assessment.review_note_drafter'],
    instructions:
      'Generate evidence-backed constructive review drafts citing specific marks and missing work. Requires human teacher sign-off.',
    trigger: 'manual',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-10-28T10:10:00.000Z',
    updated_at: '2026-10-28T10:10:00.000Z',
  },
  {
    id: 'agt_engagement_attention_reader',
    name: 'At-risk engagement detector',
    description:
      'Reads attendance, homework, and coursework records, isolating students below the participation threshold. Changes nothing.',
    module: 'engagement',
    tenant_id: '1',
    tools_allowed: ['engagement.students_needing_attention'],
    instructions:
      'Report students whose computed engagement falls below the configured threshold across attendance, homework, and coursework. Never characterise students beyond the figures given.',
    trigger: 'manual',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-10-31T10:00:00.000Z',
    updated_at: '2026-10-31T10:00:00.000Z',
  },
  {
    id: 'agt_engagement_activity_profiler',
    name: 'Student activity profiler',
    description:
      'Profiles detailed activity logs, content views, practice sessions, and social discussion engagement for flagged learners. Changes nothing.',
    module: 'engagement',
    tenant_id: '1',
    tools_allowed: ['engagement.student_summary'],
    instructions:
      'Diagnose participation trends, digital platform touchpoints, and discussion questions for flagged learners without making character judgements.',
    trigger: 'manual',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-10-31T10:05:00.000Z',
    updated_at: '2026-10-31T10:05:00.000Z',
  },
  {
    id: 'agt_engagement_intervention_drafter',
    name: 'Re-engagement intervention drafter',
    description:
      'Drafts factual, non-judgmental intervention recommendations for educators to review. Sends nothing externally.',
    module: 'engagement',
    tenant_id: '1',
    tools_allowed: ['engagement.draft_intervention_note'],
    instructions:
      'Draft objective, evidence-based re-engagement action plans for educator sign-off. Ensure strict draft-only governance.',
    trigger: 'manual',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-10-31T10:10:00.000Z',
    updated_at: '2026-10-31T10:10:00.000Z',
  },
  {
    id: 'agt_8294009535e7',
    name: 'Fee defaulter analyst',
    description: 'Reads the live fee records and reports who owes anything, and how much. Changes nothing.',
    module: 'fees',
    tenant_id: '1',
    tools_allowed: ['fees.list_defaulters'],
    instructions: 'Report only what the fee records return.',
    trigger: 'manual',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-09-29T06:57:09.734Z',
    updated_at: '2026-09-29T06:57:09.734Z',
  },
  {
    id: 'agt_630f357e5bfb',
    name: 'Fee collection reporter',
    description: 'Reads what was actually collected over a date range, from the receipts. Changes nothing.',
    module: 'fees',
    tenant_id: '1',
    tools_allowed: ['fees.collection_report'],
    instructions: 'Report collections exactly as the receipts show them.',
    trigger: 'manual',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-09-29T08:51:56.476Z',
    updated_at: '2026-09-29T08:51:56.476Z',
  },
  {
    id: 'agt_a8ae3ff89b3e',
    name: 'Low attendance analyst',
    description: 'Reads the marked register and reports who is attending least. Changes nothing.',
    module: 'attendance',
    tenant_id: '1',
    tools_allowed: ['attendance.low_attendance'],
    instructions: 'Report only what the register returns.',
    trigger: 'manual',
    status: 'active',
    created_by: '7013',
    created_by_name: 'Kalpesh1 Sheth1',
    created_at: '2026-09-19T08:42:57.836Z',
    updated_at: '2026-09-19T08:42:57.836Z',
  },
  {
    id: 'agt_3a22dcb44103',
    name: 'Admission pipeline reader',
    description: 'Reads admission enquiries and stage conversion metrics. Changes nothing.',
    module: 'admissions',
    tenant_id: '1',
    tools_allowed: ['admissions.list_enquiries'],
    instructions: 'Report admission enquiries.',
    trigger: 'manual',
    status: 'active',
    created_by: '1',
    created_by_name: 'Probe',
    created_at: '2026-09-21T10:17:53.706Z',
    updated_at: '2026-09-21T10:17:53.706Z',
  },
];

function emptyStore(): StoreShape {
  return { agents: [], runs: [] };
}

function mergeWithBaseline(agents: Agent[], tenantId?: string): Agent[] {
  const map = new Map<string, Agent>();
  const baselineIds = new Set(BASELINE_AGENTS.map((b) => b.id));

  for (const b of BASELINE_AGENTS) {
    map.set(b.id, { ...b, tenant_id: tenantId || b.tenant_id });
  }

  for (const a of agents) {
    if (baselineIds.has(a.id)) {
      map.set(a.id, { ...a, tenant_id: tenantId || a.tenant_id });
    } else {
      map.set(a.id, a);
    }
  }

  return Array.from(map.values());
}

function applyAgentFilter(agents: Agent[], tenantId: string, filter?: AgentListFilter): Agent[] {
  return agents
    .filter((agent) => !tenantId || agent.tenant_id === tenantId || agent.tenant_id === '1')
    .filter((agent) => !filter?.module || agent.module === filter.module)
    .filter((agent) => !filter?.status || agent.status === filter.status)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function applyRunFilter(runs: AgentRun[], tenantId: string, filter?: RunListFilter): AgentRun[] {
  const limit = filter?.limit && filter.limit > 0 ? filter.limit : 200;
  return runs
    .filter((run) => !tenantId || run.tenant_id === tenantId || run.tenant_id === '1')
    .filter((run) => !filter?.module || run.module === filter.module)
    .filter((run) => !filter?.agentId || run.agent_id === filter.agentId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Database pool & sync with genuine live backend (ai_agent_runs table)
// ---------------------------------------------------------------------------

let agentDbPool: mysql.Pool | null = null;

function getDbPool(): mysql.Pool {
  if (!agentDbPool) {
    const host = process.env.LIVE_CHAT_DB_HOST || process.env.DB_HOST || '202.47.117.220';
    const user = process.env.LIVE_CHAT_DB_USER || process.env.DB_USERNAME || process.env.DB_USER || 'vivek_user';
    const password = process.env.LIVE_CHAT_DB_PASSWORD || process.env.DB_PASSWORD || 'vivek@sql';
    const database = process.env.LIVE_CHAT_DB_DATABASE || process.env.DB_DATABASE || 'vivek_erp';
    const port = Number(process.env.LIVE_CHAT_DB_PORT || process.env.DB_PORT || 3306);

    agentDbPool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: 4,
      queueLimit: 0,
      connectTimeout: 4000,
    });
  }
  return agentDbPool;
}

async function fetchDbRuns(tenantId: string, filter?: RunListFilter): Promise<AgentRun[]> {
  try {
    const pool = getDbPool();
    const limit = Math.max(300, (filter?.limit && filter.limit > 0 ? filter.limit * 10 : 200));
    const [rows] = (await pool.query(
      'SELECT * FROM ai_agent_runs ORDER BY id DESC LIMIT ?',
      [limit]
    )) as [Array<Record<string, unknown>>, unknown];

    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    return rows.map((row) => {
      const key = String(row.agent_key || '');
      let mod: AgentModuleKey = 'teach_learn';
      let agtId = 'agt_34dc52f6dc24';
      let agtName = 'Course catalogue reader';

      if (key === 'teach_learn.courses' || key === 'lms.courses' || key === 'k12_course_catalogue') {
        mod = 'teach_learn';
        agtId = 'agt_34dc52f6dc24';
        agtName = 'Course catalogue reader';
      } else if (key === 'teach_learn.activities' || key === 'lms.activities') {
        mod = 'teach_learn';
        agtId = 'agt_e39a5505022e';
        agtName = 'Activity timeline reader';
      } else if (key === 'teach_learn.content_model_coverage') {
        mod = 'teach_learn';
        agtId = 'agt_a52e39ddbd8b';
        agtName = 'Content model coverage agent';
      } else if (key === 'exam_assessment.online_exam_summary' || key === 'k12_exam_assessment') {
        mod = 'exam_assessment';
        agtId = 'agt_exam_summary_reader';
        agtName = 'Online exam summary reader';
      } else if (key === 'exam_assessment.assignment_status') {
        mod = 'exam_assessment';
        agtId = 'agt_assignment_status_reader';
        agtName = 'Assignment status reader';
      } else if (key === 'exam_assessment.review_note_drafter') {
        mod = 'exam_assessment';
        agtId = 'agt_review_note_drafter';
        agtName = 'Assessment review drafter';
      } else if (key === 'engagement.student_attendance_summary' || key === 'engagement.students_needing_attention' || key === 'agt_engagement_attention_reader') {
        mod = 'engagement';
        agtId = 'agt_engagement_attention_reader';
        agtName = 'At-risk engagement detector';
      } else if (key === 'engagement.profile_engagement' || key === 'engagement.student_summary' || key === 'agt_engagement_activity_profiler') {
        mod = 'engagement';
        agtId = 'agt_engagement_activity_profiler';
        agtName = 'Student activity profiler';
      } else if (key === 'engagement.draft_intervention_note' || key === 'agt_engagement_intervention_drafter') {
        mod = 'engagement';
        agtId = 'agt_engagement_intervention_drafter';
        agtName = 'Re-engagement intervention drafter';
      } else if (key === 'k12_engagement') {
        mod = 'engagement';
        agtId = 'agt_engagement_attention_reader';
        agtName = 'Engagement Master Agent';
      } else if (key.startsWith('fees.')) {
        mod = 'fees';
        agtId = 'agt_8294009535e7';
        agtName = 'Fee defaulter analyst';
      } else if (key.startsWith('attendance.')) {
        mod = 'attendance';
        agtId = 'agt_a8ae3ff89b3e';
        agtName = 'Low attendance analyst';
      } else if (key.startsWith('admissions.')) {
        mod = 'admissions';
        agtId = 'agt_3a22dcb44103';
        agtName = 'Admission pipeline reader';
      }

      let parsedInput: Record<string, unknown> = {};
      try {
        parsedInput = typeof row.input === 'string' ? JSON.parse(row.input || '{}') : ((row.input as Record<string, unknown>) || {});
      } catch {}

      let parsedOutput: Record<string, unknown> | null = null;
      try {
        parsedOutput = typeof row.output === 'string' ? JSON.parse(row.output || '{}') : ((row.output as Record<string, unknown>) || null);
      } catch {}

      const rawStatus = String(row.status || '').toLowerCase();
      const status: AgentRunStatus =
        rawStatus === 'success' || rawStatus === 'completed'
          ? 'success'
          : rawStatus === 'denied'
            ? 'denied'
            : 'failure';

      return {
        id: 'run_' + row.id,
        agent_id: agtId,
        agent_name: agtName,
        module: mod,
        tenant_id: String(row.sub_institute_id || '1'),
        started_at: row.started_at ? new Date(row.started_at as string).toISOString() : new Date().toISOString(),
        finished_at: row.finished_at ? new Date(row.finished_at as string).toISOString() : new Date().toISOString(),
        duration_ms: Number(row.duration_ms || 100),
        acting_user_id: String(row.triggered_by || '1'),
        acting_user_name: 'Admin',
        acting_profile_id: '1',
        acting_profile_name: String(row.actor_role || 'Admin'),
        trigger: (row.trigger_type as AgentRunTrigger) || 'pipeline',
        input: parsedInput,
        output: parsedOutput,
        tools_used: [key],
        status,
        error: row.error_message ? String(row.error_message) : null,
      };
    });
  } catch {
    return [];
  }
}

async function insertDbRun(run: AgentRun): Promise<void> {
  try {
    const pool = getDbPool();
    const tool = run.tools_used[0] || run.agent_name;
    await pool.query(
      `INSERT INTO ai_agent_runs (
        run_reference, agent_id, agent_key, trigger_type, trigger_reference,
        triggered_by, input, output, tool_calls, status,
        started_at, finished_at, duration_ms, sub_institute_id, client_id,
        actor_role, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        run.id,
        10,
        tool,
        run.trigger || 'manual',
        run.agent_name,
        Number(run.acting_user_id || 1),
        JSON.stringify(run.input || {}),
        JSON.stringify(run.output || {}),
        JSON.stringify([{ tool, arguments: run.input || {} }]),
        run.status,
        new Date(run.started_at),
        new Date(run.finished_at),
        run.duration_ms || 100,
        Number(run.tenant_id || 1),
        1,
        run.acting_profile_name || 'admin',
      ]
    );
  } catch (err) {
    console.warn('[store] insertDbRun warning:', err);
  }
}

/** In-memory store: the engine's tests use it, and so does a host with no writable disk. */
export class MemoryAgentStore implements AgentStore {
  private data: StoreShape = emptyStore();

  async listAgents(tenantId: string, filter?: AgentListFilter) {
    return applyAgentFilter(this.data.agents, tenantId, filter);
  }

  async getAgent(tenantId: string, id: string) {
    return this.data.agents.find((agent) => (!tenantId || agent.tenant_id === tenantId) && agent.id === id) ?? null;
  }

  async insertAgent(agent: Agent) {
    this.data.agents.push(agent);
    return agent;
  }

  async updateAgent(agent: Agent) {
    const index = this.data.agents.findIndex((row) => row.id === agent.id);
    if (index === -1) {
      this.data.agents.push(agent);
    } else {
      this.data.agents[index] = agent;
    }
    return agent;
  }

  async listRuns(tenantId: string, filter?: RunListFilter) {
    return applyRunFilter(this.data.runs, tenantId, filter);
  }

  async appendRun(run: AgentRun) {
    this.data.runs.push(run);
    return run;
  }
}

/**
 * JSON-file store with baseline seeding and database synchronization.
 */
export class JsonFileAgentStore implements AgentStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<StoreShape> {
    try {
      const text = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(text) as Partial<StoreShape>;
      return {
        agents: mergeWithBaseline(Array.isArray(parsed.agents) ? parsed.agents : []),
        runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return emptyStore();
      }
      return emptyStore();
    }
  }

  private async save(data: StoreShape) {
    try {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
      await rename(temp, this.filePath);
    } catch {
      // Ephemeral or read-only filesystem (e.g. Vercel); safe to continue in memory
    }
  }

  /** Run one read-modify-write after every previous one has finished. */
  private mutate<T>(work: (data: StoreShape) => T): Promise<T> {
    const next = this.queue.then(async () => {
      const data = await this.load();
      const result = work(data);
      await this.save(data);
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  async listAgents(tenantId: string, filter?: AgentListFilter) {
    const { agents } = await this.load();
    return applyAgentFilter(mergeWithBaseline(agents, tenantId), tenantId, filter);
  }

  async getAgent(tenantId: string, id: string) {
    const { agents } = await this.load();
    const all = mergeWithBaseline(agents, tenantId);
    return all.find((agent) => (!tenantId || agent.tenant_id === tenantId) && agent.id === id) ?? null;
  }

  insertAgent(agent: Agent) {
    return this.mutate((data) => {
      data.agents.push(agent);
      return agent;
    });
  }

  updateAgent(agent: Agent) {
    return this.mutate((data) => {
      const index = data.agents.findIndex((row) => row.id === agent.id);
      if (index === -1) {
        data.agents.push(agent);
      } else {
        data.agents[index] = agent;
      }
      return agent;
    });
  }

  async listRuns(tenantId: string, filter?: RunListFilter) {
    const fileRuns = (await this.load()).runs;
    const dbRuns = process.env.NODE_ENV === 'test' ? [] : await fetchDbRuns(tenantId, filter);
    const combined = [...dbRuns];
    const seen = new Set(dbRuns.map((r) => r.id));
    for (const r of fileRuns) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        combined.push(r);
      }
    }
    return applyRunFilter(combined, tenantId, filter);
  }

  appendRun(run: AgentRun) {
    if (process.env.NODE_ENV !== 'test') void insertDbRun(run);
    return this.mutate((data) => {
      data.runs.push(run);
      return run;
    });
  }
}

/**
 * The process-wide store the API routes use.
 */
export function getAgentStore(): AgentStore {
  const holder = globalThis as typeof globalThis & { __agentStore?: AgentStore };
  if (!holder.__agentStore) {
    const filePath = (process.env.AGENTS_STORE_PATH || '').trim() || path.join(process.cwd(), '.data', 'agents.json');
    holder.__agentStore = new JsonFileAgentStore(filePath);
  }
  return holder.__agentStore;
}
