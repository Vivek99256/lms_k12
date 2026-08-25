import { z } from "zod";
import type {
  ProjectContext,
  ProjectToolDefinition,
} from "@shared/conversational-ai-core";

import {
  approveRecommendation,
  getCase,
  getSubjectIntelligence,
  listCases,
  listPendingApprovals,
  listPendingRecommendations,
  listSignals,
  queryKnowledgeGraph,
  resolveApproval,
  resolveEntity,
  runAgent,
  type IntelligenceContext,
} from "@/lib/intelligence/client";
import type { AgentCaseFinding } from "@/lib/intelligence/types";

/**
 * Conversational tools for the shared intelligence layer.
 *
 * These are *additive*: they are appended to `getLmsToolDefinitions()` and gated in
 * `getAllowedToolNamesForProfile()`. Nothing in the existing conversational core or
 * the 17 existing tools is modified, so the working assistant keeps working.
 *
 * Two deliberate restraints, both from the brief:
 *
 *  - The tool descriptions tell the model when NOT to use them. A question like
 *    "how many students are in 8B?" must stay on the existing cheap lookup tools;
 *    running a risk agent for it would be slow, expensive and wrong.
 *
 *  - `approveRecommendationAction` is the only tool here with
 *    `requiresConfirmation: true`. Approving is a human act, and the conversational
 *    layer may only ever carry the approval — the backend still records the decision
 *    and re-checks it before anything executes.
 */

function intelligenceContext(context: ProjectContext): IntelligenceContext {
  return {
    token: context.token,
    baseUrl: context.baseUrl,
    instituteId: context.subInstituteId,
    academicYear: context.syear,
    termId: context.termId,
  };
}

/** Trim an agent finding down to what is worth putting in a chat reply. */
function summarizeFinding(finding: AgentCaseFinding) {
  return {
    case_id: finding.case_id,
    student_id: finding.student_id,
    student: finding.student_name,
    class: finding.placement
      ? [finding.placement.standard_name, finding.placement.division_name]
          .filter(Boolean)
          .join("-")
      : null,
    severity: finding.severity,
    why: finding.explanation?.narrative ?? null,
    // The measurement says results fell; the hypothesis says what the agent thinks
    // is behind it. Relaying only the first leaves the teacher to guess the second.
    likely_cause: finding.hypotheses?.[0]
      ? {
          statement: finding.hypotheses[0].statement,
          rationale: finding.hypotheses[0].rationale,
          confidence: finding.hypotheses[0].confidence,
        }
      : null,
    // A refused explanation is surfaced rather than hidden — the assistant should
    // say "I could not evidence this" instead of quietly showing nothing.
    explanation_withheld: finding.explanation?.governance_passed === false
      ? finding.explanation.reason_refused
      : null,
    recommendation: finding.recommendation
      ? {
          id: finding.recommendation.id,
          title: finding.recommendation.title,
          status: finding.recommendation.status,
          requires_approval: true,
        }
      : null,
  };
}

const findStudentsAtRiskSchema = z.object({
  studentId: z
    .number()
    .optional()
    .describe("Analyse a single student instead of the whole in-scope cohort."),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of students to analyse. Defaults to 50."),
});

/**
 * Runs the Academic Risk agent. This is the expensive path — detection, evidence
 * collection, case building, explanation and a drafted recommendation.
 */
async function findStudentsAtRisk(
  input: z.infer<typeof findStudentsAtRiskSchema>,
  context: ProjectContext
) {
  const result = await runAgent(intelligenceContext(context), "k12_academic_risk", {
    subject_id: input.studentId,
    limit: input.limit ?? 50,
  });

  if (result.status === "rejected") {
    return {
      allowed: false,
      message: result.summary,
    };
  }

  const findings = (result.result?.cases || []).map(summarizeFinding);

  return {
    summary: result.summary,
    students_at_risk: result.result?.students_at_risk ?? findings.length,
    signals_detected: result.result?.signals_detected ?? 0,
    findings,
    // Say plainly that nothing has been done yet.
    next_step:
      findings.length > 0
        ? "Each recommendation is waiting for a teacher to approve it. Nothing has been created yet."
        : null,
  };
}

const explainRiskSchema = z.object({
  studentId: z.number().describe("The student to explain."),
  caseId: z.number().optional().describe("A specific case, if one is already known."),
});

/**
 * Explains why a student was identified, with the evidence behind each claim.
 * Reads what already exists — it does not re-run detection.
 */
async function explainStudentRisk(
  input: z.infer<typeof explainRiskSchema>,
  context: ProjectContext
) {
  const ctx = intelligenceContext(context);

  let caseId = input.caseId;

  if (!caseId) {
    const subject = await getSubjectIntelligence(ctx, "student", input.studentId);
    const openCase = subject.cases.find((record) =>
      ["open", "analysing", "awaiting_decision", "in_progress"].includes(record.status)
    );

    if (!openCase) {
      return {
        found: false,
        message:
          "There is no open academic risk case for this student. Run a risk analysis first if you want one.",
        signals: subject.signals.slice(0, 5),
      };
    }

    caseId = openCase.id;
  }

  const detail = await getCase(ctx, caseId);

  // Only verified evidence is citable, so only verified evidence is offered as the
  // answer to "why". Generated content is returned separately and labelled.
  const citable = detail.evidence.filter((item) => item.verified && !item.is_generated);

  return {
    found: true,
    case_id: detail.case.id,
    case_reference: detail.case.reference,
    student: detail.case.subject_label,
    severity: detail.case.severity,
    explanation: detail.explanation?.governance_passed
      ? detail.explanation.narrative
      : null,
    explanation_withheld: detail.explanation?.governance_passed === false
      ? "The explanation could not be evidenced and is being withheld."
      : null,
    claims: (detail.explanation?.claims || []).map((claim) => ({
      claim: claim.claim,
      evidence: claim.evidence_ids
        .map((id) => citable.find((item) => item.id === id)?.summary)
        .filter(Boolean),
    })),
    evidence: citable.slice(0, 12).map((item) => ({
      kind: item.kind,
      summary: item.summary,
      observed_at: item.observed_at,
      source: item.source.table || item.source.service,
    })),
    // The reasoning step, not just the measurement. `rationale` carries why the
    // agent proposed each reading, and `status` says whether the evidence supported
    // or refuted it — a refuted hypothesis is as worth relaying as a supported one,
    // because it tells the teacher what has already been ruled out.
    hypotheses: detail.hypotheses.map((h) => ({
      statement: h.statement,
      rationale: h.rationale,
      status: h.status,
      confidence: h.confidence,
    })),
    recommendations: detail.recommendations
      .filter((rec) => rec.governance_passed)
      .map((rec) => ({
        id: rec.id,
        title: rec.title,
        status: rec.status,
        requires_approval: rec.requires_approval,
      })),
    outcomes: detail.outcomes.map((outcome) => ({
      metric: outcome.metric_label || outcome.metric_key,
      baseline: outcome.baseline_value,
      observed: outcome.observed_value,
      status: outcome.status,
    })),
  };
}

const listCasesSchema = z.object({
  caseType: z.string().optional().describe("Filter by case type, e.g. academic_risk."),
  minSeverity: z
    .enum(["low", "moderate", "high", "critical"])
    .optional()
    .describe("Only cases at or above this severity."),
  limit: z.number().min(1).max(100).optional(),
});

async function listIntelligenceCases(
  input: z.infer<typeof listCasesSchema>,
  context: ProjectContext
) {
  const result = await listCases(intelligenceContext(context), {
    caseType: input.caseType,
    minSeverity: input.minSeverity,
    limit: input.limit ?? 25,
  });

  return {
    total: result.cases.length,
    cases: result.cases.map((record) => ({
      case_id: record.id,
      reference: record.reference,
      title: record.title,
      subject: record.subject_label,
      severity: record.severity,
      status: record.status,
      opened_at: record.opened_at,
    })),
  };
}

const listSignalsSchema = z.object({
  signalKey: z.string().optional(),
  minSeverity: z.enum(["low", "moderate", "high", "critical"]).optional(),
  limit: z.number().min(1).max(100).optional(),
});

async function listOpenSignals(
  input: z.infer<typeof listSignalsSchema>,
  context: ProjectContext
) {
  const result = await listSignals(intelligenceContext(context), {
    signalKey: input.signalKey,
    minSeverity: input.minSeverity,
    limit: input.limit ?? 25,
  });

  return {
    total: result.signals.length,
    signals: result.signals.map((signal) => ({
      id: signal.id,
      signal: signal.signal_key,
      subject: signal.subject_label,
      score: signal.score,
      severity: signal.severity,
      detected_at: signal.detected_at,
    })),
  };
}

const pendingRecommendationsSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
});

async function listRecommendationsAwaitingApproval(
  input: z.infer<typeof pendingRecommendationsSchema>,
  context: ProjectContext
) {
  const result = await listPendingRecommendations(
    intelligenceContext(context),
    input.limit ?? 25
  );

  return {
    total: result.recommendations.length,
    recommendations: result.recommendations.map((rec) => ({
      id: rec.id,
      reference: rec.reference,
      title: rec.title,
      action: rec.action_type,
      confidence: rec.confidence,
      risk_level: rec.risk_level,
      why: rec.body,
      objective: rec.eso_binding?.objective ?? null,
      case_id: rec.case_id,
    })),
    note: "These are drafts. Nothing happens until a teacher approves one.",
  };
}

const approveSchema = z.object({
  recommendationId: z.number().describe("The recommendation the user is approving."),
  reason: z.string().optional().describe("Optional note from the approver."),
});

/**
 * Carries a human approval through to the backend.
 *
 * The conversational layer is only the transport. The backend writes the durable
 * decision record against the authenticated user and re-checks it before any
 * consequential workflow step runs, so this tool cannot approve on anyone's behalf.
 */
async function approveRecommendationAction(
  input: z.infer<typeof approveSchema>,
  context: ProjectContext
) {
  const result = await approveRecommendation(
    intelligenceContext(context),
    input.recommendationId,
    {
      reason: input.reason,
      decidedByName: context.profileName,
      startWorkflow: true,
    }
  );

  return {
    approved: true,
    recommendation: result.recommendation.title,
    status: result.recommendation.status,
    workflow: result.workflow
      ? {
          status: result.workflow.status,
          message: result.workflow.message,
          awaiting: result.workflow.status === "awaiting_approval" ? result.workflow.current_step : null,
        }
      : null,
  };
}

const pendingApprovalsSchema = z.object({
  limit: z.number().min(1).max(50).optional(),
});

/**
 * Workflow steps waiting on a person.
 *
 * Distinct from a pending *recommendation*: approving a recommendation starts the
 * workflow, and the workflow then has its own approval step before it may do
 * anything consequential. That second gate is what stands between a decision and
 * an intervention actually being created.
 */
async function listWorkflowApprovals(
  input: z.infer<typeof pendingApprovalsSchema>,
  context: ProjectContext
) {
  const result = await listPendingApprovals(intelligenceContext(context), input.limit ?? 20);

  return {
    count: result.approvals.length,
    approvals: result.approvals.map((approval) => ({
      approval_id: approval.id,
      workflow: approval.workflow_key,
      step: approval.step_key,
      run_id: approval.run_id,
      approver_role: approval.approver_role,
      expires_at: approval.expires_at,
    })),
    next_step:
      result.approvals.length > 0
        ? "Each of these is holding a workflow. Resolving one lets the remaining steps run."
        : null,
  };
}

const resolveApprovalSchema = z.object({
  approvalId: z.number().describe("The workflow approval to resolve."),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().optional().describe("Optional note recorded with the decision."),
});

/**
 * Releases — or stops — a workflow parked at its approval step.
 *
 * This is the gate the whole pipeline ends at: until it is resolved the workflow
 * cannot reach its action step, so no intervention is created. It was reachable
 * only from an artisan command before this tool existed, which left the last stage
 * of the pipeline unreachable from the product.
 *
 * Consequential, and therefore confirmation-gated: approving here is what allows a
 * real record to be written.
 */
async function resolveWorkflowApproval(
  input: z.infer<typeof resolveApprovalSchema>,
  context: ProjectContext
) {
  const run = await resolveApproval(
    intelligenceContext(context),
    input.approvalId,
    input.decision,
    input.comment
  );

  return {
    resolved: input.decision,
    run_id: run.run_id,
    status: run.status,
    current_step: run.current_step,
    message: run.message,
    // Says plainly whether anything downstream actually ran.
    outcome:
      input.decision === "rejected"
        ? "The workflow was stopped. Nothing was created."
        : run.status === "completed"
          ? "The workflow completed and its action has been carried out."
          : `The workflow is now ${run.status}.`,
  };
}

const relationshipSchema = z.object({
  entity: z.string().describe("Starting ontology entity, e.g. student."),
  id: z.number().describe("The record to start from."),
  path: z
    .array(z.string())
    .optional()
    .describe("Ordered entity keys to walk, e.g. ['assessment']."),
  relations: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).optional(),
});

async function exploreRelationships(
  input: z.infer<typeof relationshipSchema>,
  context: ProjectContext
) {
  const traversal = await queryKnowledgeGraph(intelligenceContext(context), {
    entity: input.entity,
    id: input.id,
    path: input.path,
    relations: input.relations,
    limit: input.limit ?? 15,
  });

  if (!traversal.start) {
    return { found: false, message: "That record could not be found in your scope." };
  }

  return {
    found: true,
    start: { entity: traversal.start.entity, label: traversal.start.label },
    related: traversal.nodes
      .filter((node) => node.depth > 0)
      .map((node) => ({
        entity: node.entity,
        label: node.label,
        via: node.via,
        depth: node.depth,
      })),
    truncated: traversal.truncated,
  };
}

const resolveEntitySchema = z.object({
  entity: z.string().describe("The ontology entity to search, e.g. student or subject."),
  search: z.string().optional().describe("Name or code fragment to match."),
  limit: z.number().min(1).max(50).optional(),
});

async function resolveOntologyEntity(
  input: z.infer<typeof resolveEntitySchema>,
  context: ProjectContext
) {
  const result = await resolveEntity(
    intelligenceContext(context),
    input.entity,
    input.search,
    input.limit ?? 10
  );

  return { entity: result.entity, matches: result.results };
}

/**
 * The tool definitions, appended to the existing LMS tool set.
 */
export function getIntelligenceToolDefinitions(): ProjectToolDefinition[] {
  return [
    {
      name: "findStudentsAtRisk",
      description:
        "Assess academic risk against real student data and return evidence-backed findings. Use this whenever the user asks to analyse, assess or check academic risk — for one student or across the cohort — or asks who is at risk, who is struggling, or who needs intervention. Pass studentId when the question is about a single student, including when the page context already names one. Do NOT use it for plain counts, lists or lookups; those have their own faster tools.",
      inputSchema: findStudentsAtRiskSchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: [
        "academic_risk",
        "students_at_risk",
        "needs_intervention",
        "struggling_students",
        "risk_analysis",
      ],
      execute: findStudentsAtRisk,
    },
    {
      name: "explainStudentRisk",
      description:
        "Explain WHY a specific student was identified as at risk, citing the assessments, attendance and assignments behind each claim, plus the hypotheses the agent formed about the cause. Reads existing analysis; does not re-run it — call findStudentsAtRisk first if no case exists yet. Use when the user asks why, or asks for the evidence or reasoning.",
      inputSchema: explainRiskSchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: [
        "explain_risk",
        "why_at_risk",
        "risk_evidence",
        "student_explanation",
      ],
      execute: explainStudentRisk,
    },
    {
      name: "listIntelligenceCases",
      description:
        "List open AI cases — students or staff the system has flagged and gathered evidence about. Use for 'what has the system flagged' or 'show me open cases'.",
      inputSchema: listCasesSchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["ai_cases", "open_cases", "flagged_students"],
      execute: listIntelligenceCases,
    },
    {
      name: "listOpenSignals",
      description:
        "List raw detected signals before they become cases. Mostly useful to administrators checking what detection is finding.",
      inputSchema: listSignalsSchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["ai_signals", "detected_signals"],
      execute: listOpenSignals,
    },
    {
      name: "listRecommendationsAwaitingApproval",
      description:
        "List AI recommendations waiting for a human to approve or reject. Use for 'what needs my approval' or 'what is pending'. These are drafts — nothing has been actioned.",
      inputSchema: pendingRecommendationsSchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: [
        "pending_recommendations",
        "awaiting_approval",
        "approval_queue",
      ],
      execute: listRecommendationsAwaitingApproval,
    },
    {
      name: "approveRecommendationAction",
      description:
        "Approve an AI recommendation so its workflow can begin. This is a consequential action: it records a decision in the user's name and may create an intervention. Only call it when the user has clearly and explicitly said to approve a specific recommendation.",
      inputSchema: approveSchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "high",
      // The confirmation gate. Approving is never inferred.
      requiresConfirmation: true,
      // Says who it is recorded against and what follows, because both are the point:
      // the decision carries the approver's name, and it sets a workflow running.
      confirmationMessage: (input: z.infer<typeof approveSchema>) =>
        `Approve recommendation #${input.recommendationId}? The decision will be recorded in your name and the intervention process will start.`,
      capabilities: [
        "approve_recommendation",
        "confirm_intervention",
        "create_intervention",
      ],
      execute: approveRecommendationAction,
    },
    {
      name: "listWorkflowApprovals",
      description:
        "List workflow steps waiting for a person to approve them. Different from pending recommendations: this is a workflow already under way that cannot continue — and cannot create anything — until someone resolves this step. Use for 'what is waiting on me', 'what is stuck', or after approving a recommendation.",
      inputSchema: pendingApprovalsSchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["workflow_approvals", "pending_steps", "stuck_workflows"],
      execute: listWorkflowApprovals,
    },
    {
      name: "resolveWorkflowApproval",
      description:
        "Approve or reject a workflow step that is waiting on a person. Approving lets the workflow run its remaining steps, which may create a real record such as an intervention. Only call it when the user has clearly said to approve or reject a specific pending step.",
      inputSchema: resolveApprovalSchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "high",
      // The last gate before something is actually created.
      requiresConfirmation: true,
      // Approving and rejecting have opposite consequences, so they get opposite
      // sentences rather than one hedged wording covering both.
      confirmationMessage: (input: z.infer<typeof resolveApprovalSchema>) =>
        input.decision === "approved"
          ? `Approve the waiting step on approval #${input.approvalId}? The process will continue and create the intervention.`
          : `Reject the waiting step on approval #${input.approvalId}? The process will stop and nothing will be created.`,
      capabilities: ["resolve_approval", "release_workflow", "complete_intervention"],
      execute: resolveWorkflowApproval,
    },
    {
      name: "exploreRelationships",
      description:
        "Walk relationships between real records — a student's assessments, a subject's chapters, a case's evidence. Use when the user asks how two things are connected, or wants the chain behind a finding.",
      inputSchema: relationshipSchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["relationships", "knowledge_graph", "connections"],
      execute: exploreRelationships,
    },
    {
      name: "resolveOntologyEntity",
      description:
        "Find records of a known entity type by name or code, so a later tool can be given an id. Use this to turn a name the user said into a record.",
      inputSchema: resolveEntitySchema,
      requiredPermissions: ["lms:student:read"],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["entity_resolution", "record_lookup"],
      execute: resolveOntologyEntity,
    },
  ];
}

/**
 * Which of these tools each profile tier may use.
 *
 * Mirrors the additive tiering of `getAllowedToolNamesForProfile()`. Students get
 * nothing here: risk analysis over a cohort is not theirs to run, and their own risk
 * is a conversation for a teacher to have with them, not a chatbot.
 */
export const INTELLIGENCE_TOOL_NAMES = {
  read: [
    "explainStudentRisk",
    "listIntelligenceCases",
    "exploreRelationships",
    "resolveOntologyEntity",
  ],
  analysis: [
    "findStudentsAtRisk",
    "listRecommendationsAwaitingApproval",
    "listWorkflowApprovals",
  ],
  admin: ["listOpenSignals", "approveRecommendationAction", "resolveWorkflowApproval"],
} as const;
