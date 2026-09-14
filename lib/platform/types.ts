/**
 * Platform Services — the shapes the three screens read.
 *
 * THESE MIRROR THE API, THEY DO NOT DEFINE IT. Laravel owns the contract:
 * config/platform_services.php declares every module, component, notification,
 * task and workflow point, and app/Http/Controllers/api/Platform/* validates
 * every write against it. This file is how TypeScript sees what comes back.
 *
 * WHY THERE IS NO REGISTRY CONSTANT HERE. An earlier draft carried the module
 * and component catalogue in TypeScript as well. Two copies of a contract drift,
 * and the copy that drifts is always the one doing the validating — so the
 * catalogue is fetched from GET /api/platform/registry and rendered, never
 * declared twice. Adding a module is one edit to the PHP config with no frontend
 * release at all.
 *
 * ONE ADDRESS FOR EVERYTHING. `fees` is a module, `fees.collection` a component,
 * `fees.collection.payment_received` an item on that component. That prefix is
 * the whole relationship between the three services, which is why they share a
 * registry rather than each keeping a private list of modules.
 */

/** `module.component`. */
export type ComponentKey = string;

/** `module.component.event` | `.task` | `.flow`. */
export type ItemKey = string;

// ── Registry (GET /api/platform/registry) ───────────────────────────────────

export interface RegistryModule {
  key: string;
  label: string;
  description: string;
  group: string;
  /** Lucide glyph name. */
  icon: string;
  counts: {
    components: number;
    notifications: number;
    tasks: number;
    workflows: number;
  };
}

export interface RegistryComponent {
  key: ComponentKey;
  module: string;
  label: string;
  description: string;
}

export interface RegistryChannel {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  needs_credentials: boolean;
}

export interface RegistryOption {
  key: string;
  label: string;
  description: string;
  /** Approver types only: whether the step needs a role name or user id. */
  needs_value?: boolean;
}

export interface PlatformRegistry {
  channels: RegistryChannel[];
  modules: RegistryModule[];
  components: RegistryComponent[];
  notifications: Array<{ key: ItemKey; module: string; component: ComponentKey; label: string }>;
  tasks: Array<{ key: ItemKey; module: string; component: ComponentKey; label: string }>;
  workflows: Array<{ key: ItemKey; module: string; component: ComponentKey; label: string }>;
  approver_types: RegistryOption[];
  escalation_actions: RegistryOption[];
}

// ── Communication ───────────────────────────────────────────────────────────

/**
 * One channel's setting for one notification.
 *
 * `locked` is the half that makes this a central service. `enabled` decides what
 * a recipient gets by default; `locked` decides whether they may change it. A fee
 * receipt is locked on for email because a school cannot allow somebody to opt
 * out of the record of money they paid.
 */
export interface ChannelSetting {
  enabled: boolean;
  locked: boolean;
}

export interface NotificationChannelRow extends RegistryChannel {
  /** False while the institute is still on the shipped default. */
  customised: boolean;
}

export interface NotificationEventRow {
  key: ItemKey;
  module: string;
  component: ComponentKey;
  component_label: string;
  label: string;
  description: string;
  /** Who receives it, so an administrator can see the blast radius. */
  audience: string[];
  /** Required notifications cannot be switched off; their channels still can. */
  mandatory: boolean;
  enabled: boolean;
  channels: Record<string, ChannelSetting>;
  /** False while nothing is stored and the registry default is answering. */
  customised: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export interface NotificationSummary {
  total: number;
  enabled: number;
  /**
   * On, with at least one channel on, where that channel is also on for the
   * institute. The number nothing else on the screen shows: an event whose only
   * channel is a switched-off WhatsApp sends nothing at all.
   */
  reachable: number;
  locked: number;
  customised: number;
}

export interface NotificationPayload {
  channels: NotificationChannelRow[];
  events: NotificationEventRow[];
  summary: NotificationSummary;
  saved?: number;
}

/** One row of a save. Absent fields mean unchanged, not reset. */
export interface NotificationChange {
  event_key: ItemKey;
  enabled?: boolean;
  channels?: Record<string, Partial<ChannelSetting>>;
}

// ── Scheduler ───────────────────────────────────────────────────────────────

/** The five cron fields, in the order the screen shows them. */
export interface CronSchedule {
  minute: string;
  hour: string;
  day: string;
  month: string;
  day_of_week: string;
}

export interface ScheduledTaskRow {
  key: ItemKey;
  module: string;
  component: ComponentKey;
  component_label: string;
  label: string;
  description: string;
  schedule: CronSchedule;
  default_schedule: CronSchedule;
  /** `0 9 * * 1-5`, for the mono column. */
  expression: string;
  /** The schedule as a sentence, computed server-side. */
  describes: string | null;
  disabled: boolean;
  disabled_by_default: boolean;
  /** Minutes to wait after a failure, doubling each retry. 0 means no retry. */
  fail_delay: number;
  last_run_at: string | null;
  last_run_status: 'ok' | 'failed' | null;
  /** Computed on read, never stored — a stored one goes stale on the next edit. */
  next_run_at: string | null;
  /** The schedule differs from the shipped default. */
  customised: boolean;
  /** A row exists for this institute at all (it may match the default). */
  overridden: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

export interface ScheduledTaskSummary {
  total: number;
  enabled: number;
  disabled: number;
  customised: number;
  failing: number;
}

export interface SchedulerPayload {
  tasks: ScheduledTaskRow[];
  summary: ScheduledTaskSummary;
}

export interface ScheduledTaskChange {
  task_key: ItemKey;
  schedule?: Partial<CronSchedule>;
  disabled?: boolean;
  fail_delay?: number;
  /** Throw away this institute's override and follow the shipped default again. */
  reset_to_default?: boolean;
}

// ── Workflow ────────────────────────────────────────────────────────────────

export type ApproverType = 'role' | 'user' | 'reporting_manager' | 'class_teacher' | 'principal';

export type EscalationAction = 'none' | 'remind' | 'escalate' | 'auto_approve' | 'auto_reject';

export interface WorkflowStep {
  id: string;
  /** 1-based, derived server-side from the array order the operator arranged. */
  order: number;
  name: string;
  approver_type: ApproverType;
  /** A role name or user id; empty for the types resolved from the record. */
  approver: string;
  /** Hours before `on_breach` fires. 0 disables the SLA. */
  sla_hours: number;
  on_breach: EscalationAction;
  allow_delegate: boolean;
  require_comment: boolean;
}

export type WorkflowStatus = 'draft' | 'active' | 'disabled';

export interface WorkflowChain {
  id: number;
  flow_key: ItemKey;
  module: string;
  component: ComponentKey;
  name: string;
  description: string;
  status: WorkflowStatus;
  /** Free text, evaluated by the engine. Empty means the chain always applies. */
  condition: string;
  steps: WorkflowStep[];
  step_count: number;
  /** The question a principal actually asks: how long can this take? */
  total_sla_hours: number;
  on_reject: 'return_to_requester' | 'close';
  notify_requester: boolean;
  created_at: string | null;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

/**
 * A place a component's action can pause for a sign-off, and the chains defined
 * against it.
 *
 * A point is the product's; a chain is the school's. Most points have no chain,
 * and that is the thing an administrator came to the screen to see.
 */
export interface WorkflowPoint {
  key: ItemKey;
  module: string;
  component: ComponentKey;
  component_label: string;
  label: string;
  description: string;
  /** What the record is called in an approval inbox. */
  subject: string;
  /** A starting ladder, offered when somebody adds the first chain here. */
  suggested_steps: WorkflowStep[];
  workflows: WorkflowChain[];
}

export interface WorkflowSummary {
  points: number;
  /** Points with at least one ACTIVE chain. A draft does not govern anything. */
  governed: number;
  workflows: number;
  active: number;
  draft: number;
}

export interface WorkflowPayload {
  points: WorkflowPoint[];
  summary: WorkflowSummary;
}

export interface WorkflowInput {
  flow_key?: ItemKey;
  name?: string;
  description?: string;
  status?: WorkflowStatus;
  condition?: string;
  steps?: Array<Partial<WorkflowStep>>;
  on_reject?: WorkflowChain['on_reject'];
  notify_requester?: boolean;
}

// ── Address arithmetic ──────────────────────────────────────────────────────

/** `fees.collection.payment_received` is owned by `fees`. */
export function moduleOf(key: string): string {
  return key.split('.')[0] ?? '';
}

/** `fees.collection.payment_received` sits on `fees.collection`. */
export function componentOf(itemKey: ItemKey): ComponentKey {
  const parts = itemKey.split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : itemKey;
}
