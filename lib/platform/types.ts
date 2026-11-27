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
  tasks: Array<{ key: ItemKey; module: string; component: ComponentKey; label: string; has_job?: boolean }>;
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
  /** A job is registered to run this task. Without one, Run now has nothing to do. */
  has_job: boolean;
  /** Minutes to wait after a failure, doubling each retry. 0 means no retry. */
  fail_delay: number;
  last_run_at: string | null;
  last_run_status: 'ok' | 'failed' | null;
  /** The summary line of the latest ok run (from the audit trail); null when none or the last run failed. */
  last_run_message?: string | null;
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

/** Who a graph-resolved approver type resolves to right now, or `resolved: false` when the graph has no answer. */
export interface WorkflowApproverPreview {
  resolved: boolean;
  staff_id: number | null;
  name: string | null;
}

/**
 * Tenant-wide Fees "Knowledge Graph Intelligence" banner data. There is no
 * selected student on this screen, so every section is an aggregate — and an
 * `available: false` section is a real "nothing to show yet" state (e.g. no
 * concession requests have been submitted through the workflow engine), not
 * a loading or error state.
 */
export interface FeesSiblingAmbiguous {
  oversized_threshold: number;
  oversized_groups: number;
  oversized_students: number;
  mixed_guardian_groups: number;
  mixed_guardian_students: number;
  duplicate_name_groups: number;
  duplicate_name_students: number;
}

export interface FeesDefaulterTopRow {
  student_id: number;
  student_name: string | null;
  outstanding: number;
  family: { anchor_student_id: number; size: number } | null;
  oldest_pending_month: number | null;
  months_overdue: number | null;
}

export interface FeesChannelStats {
  sent: number;
  read_rate?: number;
  delivered_rate?: number;
  reply_rate?: number;
}

export interface FeesFamilyReach {
  family_groups: number;
  reached_90d: number;
  read_90d: number;
  replied_90d: number;
}

export interface FeesReminderFollowupByChannel {
  reminders: number;
  followed_by_payment: number;
  rate: number;
}

export type FeesReminderFollowup =
  | {
      available: true;
      window_days: number;
      lookback_days: number;
      by_channel: Record<string, FeesReminderFollowupByChannel>;
      basis: string;
    }
  | { available: false; reason: string };

export interface FeesTcApplicant {
  student_id: number;
  student_name: string | null;
  status: 'zero_due' | 'has_dues' | 'not_checked';
  outstanding: number;
  date_of_application: string | null;
  self_reported_dues_paid_upto: string | null;
  self_reported_any_concession: string | boolean | null;
}

export interface FeesGraphSignalCard {
  title: string;
  severity: string;
  available: boolean;
  reason: string | null;
  description: string | null;
}

export type FeesGraphSignals =
  | { available: true; basis: string | null; cards: Record<string, FeesGraphSignalCard> }
  | { available: false; reason: string };

export interface FeesConcessionQueueItem {
  run_id: number;
  flow_key: string;
  student_id: number;
  student_name: string | null;
  amount: number | null;
  current_step: number;
  created_at: string;
}

export interface FeesConcessionQueue {
  available: true;
  pending_count: number;
  pending_by_flow: { concession: number; refund: number };
  escalated_to_trustee: number;
  approved_awaiting: { count: number; amount: number };
  applied_this_year: { count: number; amount: number };
  closed_30d: number;
  chain_active: { concession: boolean; refund: boolean };
  items: FeesConcessionQueueItem[];
}

export interface FeesEscalationRule {
  accounts_max: number;
  principal_max: number;
  enforced: boolean;
  basis: string | null;
}

export interface FeesEscalationChainStep {
  order: number;
  name: string;
  approver_type: string;
  approver: string;
  tier: string;
}

export interface FeesEscalationChain {
  id: number;
  name: string;
  status: string;
  condition: string;
  engine_choice: boolean;
  steps: FeesEscalationChainStep[];
}

export interface FeesEscalationFinding {
  code: string;
  count: number;
  message: string;
  run_ids: number[];
}

export interface FeesEscalation {
  available: true;
  rule: FeesEscalationRule;
  chains: FeesEscalationChain[];
  matrix: Record<string, Record<string, number>>;
  findings: FeesEscalationFinding[];
}

export interface FeesIntelligenceData {
  sub_institute_id: number;
  academic_year: number | null;
  computed_at: string;
  siblings:
    | {
        available: true;
        family_groups: number;
        students_in_groups: number;
        already_applied: number;
        pending: number;
        ungrouped_students: number;
        no_contact_students: number;
        families_every_applied: number;
        families_some_applied: number;
        families_none_applied: number;
        ambiguous: FeesSiblingAmbiguous;
        applied_scope: string;
      }
    | { available: false; reason: string };
  defaulter_risk:
    | {
        available: true;
        defaulter_count: number;
        total_outstanding: number;
        cohort_size: number;
        students_checked: number;
        truncated: boolean;
        sample_bias: 'largest_balance_first' | string;
        top_defaulters: FeesDefaulterTopRow[];
        basis: string | null;
      }
    | { available: false; reason: string };
  notification_channel_routing:
    | {
        available: true;
        recommended_channel: 'whatsapp' | 'direct_message' | null;
        confidence: number;
        channels: {
          whatsapp?: FeesChannelStats;
          direct_message?: FeesChannelStats;
        };
        window_days: number;
        family_reach: FeesFamilyReach;
        reminder_followup: FeesReminderFollowup;
      }
    | { available: false; reason: string };
  tc_no_dues:
    | {
        available: true;
        pending_applications: number;
        zero_due: number;
        has_dues: number;
        not_checked: number;
        applicants: FeesTcApplicant[];
        basis: string | null;
      }
    | { available: false; reason: string };
  graph_signals: FeesGraphSignals;
  concession_queue: FeesConcessionQueue | { available: false; reason: string };
  escalation: FeesEscalation | { available: false; reason: string };
}

// ── Fees Intelligence drill-downs (GET /api/platform/workflow/fees-intelligence/*) ──

export interface FamilyMember {
  student_id: number;
  name: string;
  enrollment_no: string | null;
  standard: string | null;
  applied: boolean;
}

export interface FamilyChannelStats {
  wa_sent_90d: number;
  wa_read_90d: number;
  dm_replied_90d: number;
}

export interface FamilyGroupRow {
  anchor_student_id: number;
  masked_mobile: string;
  member_count: number;
  applied_count: number;
  applied_state: 'none' | 'some' | 'every';
  flags: string[];
  members: FamilyMember[];
  channel: FamilyChannelStats;
}

export interface FamilyDetailMember {
  student_id: number;
  name: string;
  enrollment_no: string | null;
  standard: string | null;
  applied: boolean;
  outstanding: number | null;
  open_request: { run_id: number; flow_key: string } | null;
}

export interface FamilyDetail {
  anchor_student_id: number;
  masked_mobile: string;
  member_ids: number[];
  members: FamilyDetailMember[];
  flags: string[];
}

export interface ArrearsRow {
  rank: number;
  student_id: number;
  student_name: string | null;
  enrollment_no: string | null;
  standard_name: string | null;
  outstanding: number | null;
  pending_items: number;
  family: { anchor_student_id: number; size: number } | null;
  checked: boolean;
}

export interface ArrearsData {
  available: boolean;
  page: number;
  per_page: number;
  ranking_total: number;
  ranking_basis: string | null;
  rows: ArrearsRow[];
  not_checked: number[];
}

// ── Fees concession/refund requests (GET/POST /api/platform/fees/concession-requests, /concession-grants) ──

export type ConcessionKind = 'concession' | 'refund';
export type ConcessionState = 'pending' | 'approved_pending_application' | 'applied' | 'closed';

export interface ConcessionRequestRow {
  run_id: number;
  flow_key: string;
  kind: ConcessionKind;
  status: string;
  title: string | null;
  current_step: number;
  created_at: string;
  student_id: number;
  student_name: string | null;
  grant_id: number | null;
  amount: number | null;
  applied_amount: number | null;
}

export interface ConcessionGrant {
  id: number;
  run_id: number;
  kind: ConcessionKind;
  student_id: number;
  amount: number;
  applied_amount: number;
  remaining: number;
  refund_heads: Record<string, number> | null;
  status: 'approved_pending_application' | 'applied';
  approved_at: string | null;
}

export interface SubmitConcessionInput {
  kind: ConcessionKind;
  student_id: number;
  reason: string;
  /** Concession only. */
  amount?: number;
  /** Refund only. */
  refund_heads?: Record<string, number>;
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

// ── Paging ──────────────────────────────────────────────────────────────────

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}

// ── Audit (GET /api/platform/audit) ─────────────────────────────────────────

export interface AuditEntry {
  id: number;
  module: string;
  component: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | number | null;
  actor_user_id: number | string | null;
  actor_name: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  is_sample: boolean;
  created_at: string | null;
}

export interface AuditSummary {
  total: number;
  by_module: Record<string, number>;
  by_action: Record<string, number>;
  sample_rows: number;
}

// ── Integrations (GET /api/platform/integrations) ───────────────────────────

export type IntegrationCategory = 'sms' | 'email' | 'whatsapp' | 'push' | 'payment' | 'biometric' | 'bank';

export interface PlatformIntegration {
  id: number;
  provider_key: string;
  display_name: string;
  category: IntegrationCategory | string;
  description: string | null;
  status: 'active' | 'inactive' | 'error';
  /** Secrets arrive as `********`; sending that back keeps the stored value. */
  config: Record<string, string | number | boolean | null>;
  required_fields: string[];
  last_tested_at: string | null;
  last_tested_by: string | null;
  updated_by: string | null;
  is_sample: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface IntegrationInput {
  provider_key: string;
  display_name: string;
  category: string;
  description?: string | null;
  status?: 'active' | 'inactive' | 'error';
  config: Record<string, string | number | boolean | null>;
}

export interface IntegrationTestResult {
  ok: boolean;
  /** `connectivity` reached something; `validation` only checked the fields. */
  mode: 'connectivity' | 'validation' | string;
  message: string;
  integration: PlatformIntegration;
}
