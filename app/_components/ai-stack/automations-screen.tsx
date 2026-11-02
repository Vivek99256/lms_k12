'use client';

/**
 * AI Stack → Automations, for any module.
 *
 * ONE AGENT REGISTRY, NOT TWO
 *
 * This is the point of the tab. Everything on it is a row in a store the rest of the
 * platform already reads: the backend manifest panel at the top is the `ai_agents` row the
 * chatbot resolves, run through the same `AgentRunner`, writing to the same `ai_cases`,
 * `ai_evidence`, `ai_recommendations` and `workflow_approvals`. The tool agents below are
 * configurations on the central Agent Management engine, scoped to this module. There is
 * no AI-Stack copy of either.
 *
 * TWO KINDS OF AUTOMATION, AND THE DIFFERENCE IS REAL
 *
 * 1. A backend domain agent (top), when the module is bound to one in `config/ai.php`. It
 *    detects, opens a case, cites records as evidence, explains, and drafts something that
 *    stops at a human approval.
 *
 * 2. Tool agents (bottom). Each is allowed one or more read/draft tools from this module's
 *    catalogue. These are what an operator builds for themselves; the presets are simply
 *    the useful ones written out so nobody has to re-derive a tool allow-list.
 *
 * WHEN A MODULE HAS NO BOUND AGENT, THE PANEL SAYS SO AND WHY
 *
 * Most modules have none, and that is not a gap to paper over. A module with no manifest
 * cannot open a case, cannot raise a recommendation and has nothing for a person to
 * approve — so the panel prints the reason `config/ai.php` records for it and points at
 * what the module does have. An empty panel with a disabled Run button would leave
 * somebody looking for a feature that was never claimed.
 *
 * PERMISSIONS
 *
 * The tool agents are gated on `agents.<module>`, asked of Laravel through the same
 * `/api/permissions` endpoint every content screen uses, and re-checked server-side by
 * `/api/agents` before anything is created or run.
 *
 * A bound backend agent is deliberately NOT gated on that key in this client. Its
 * authority is the manifest's own `allowed_roles` and `required_permissions`, enforced by
 * `AgentRunner` on the server. Adding a second, different frontend gate in front of it
 * would mean a user who is allowed to run it is told they are not.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  ChevronRight,
  Info,
  Lock,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  Workflow,
  XCircle, Activity, BookOpen, Clock, Layers, Sparkles, X,
} from 'lucide-react';

import { AgentManagement } from '@/app/enterprise-brain/automation/agents/_components/AgentManagement';
import { RunAgentDialog } from '@/app/enterprise-brain/automation/agents/_components/RunAgentDialog';
import { useBrainResource } from '@/app/enterprise-brain/_components/useBrainResource';
import { usePermission } from '@/app/hooks/usePermission';
import { createAgent, fetchAgents, fetchRuns, setAgentStatus } from '@/lib/agents/client';
import { findTool } from '@/lib/agents/registry';
import type { Agent, AgentRun, CreateAgentInput } from '@/lib/agents/types';
import {
  listAgentRuns,
  listAgents,
  listPendingApprovals,
  runAgent,
} from '@/lib/intelligence/client';
import type { AgentRunResult, PendingApproval } from '@/lib/intelligence/types';
import { logModuleOperation, readModuleWorkspaceSession } from '@/lib/module-ai/module-ai-stack';

import { ModuleApprovalQueue } from './module-approval-queue';
import { AiStackCard, AiStackCardHeading, AiStackPill, formatWhen } from './ai-stack-chrome';
import { aiStackRbacKey, type AiStackBoundAgent, type AiStackModule } from './ai-stack-module';
import { CatalogueAgentControlCard } from './catalogue-agent-control-card';
import { ExamAssessmentAgentControlCard } from './exam-assessment-agent-control-card';
import { EngagementAgentControlCard } from './engagement-agent-control-card';

interface ToolAgentEsoInfo {
  name: string;
  module: string;
  tool: string;
  knowledge: {
    summary: string;
    items: string[];
    tables: string[];
  };
  activities: {
    summary: string;
    items: string[];
  };
  abilities: {
    summary: string;
    skills: string[];
    safeguards: string[];
  };
  usage: {
    summary: string;
    step_by_step_flow: string[];
  };
}

const TOOL_AGENT_ESO_MAP: Record<string, ToolAgentEsoInfo> = {
  'exam_assessment.online_exam_summary': {
    name: 'Online exam summary reader',
    module: 'Exam & Assessment',
    tool: 'exam_assessment.online_exam_summary',
    knowledge: {
      summary: 'Teacher-published online question papers, recorded student exam attempts, obtained marks, passing benchmarks (40%), and PAL test segregation rules.',
      items: [
        'Teacher-published exam master papers, marks, and configurations from question_paper',
        'Student attempt records, obtained marks, total marks, and timestamps from lms_online_exam',
        'Student directory and enrollment records from tblstudent',
        'Academic passing benchmark criteria (default 40%, matching the LMS Result Dashboard)',
        'PAL paper exclusion rule: strictly disregards papers where exam_type = "PAL"',
      ],
      tables: ['question_paper', 'lms_online_exam', 'tblstudent', 'standard', 'subject'],
    },
    activities: {
      summary: 'Scans published teacher online exams, filters out PAL tests, computes attempt metrics and average cohort scores, and isolates at-risk students below the passing bar.',
      items: [
        'Scanning published teacher exams scoped to the institute and target standard',
        'Strict exclusion of PAL-generated practice tests',
        'Calculation of attempt counts, total students assessed, and cohort average score (obtain_marks / total_marks * 100)',
        'Identification and extraction of at-risk student attempts scoring below the 40% threshold',
        'Gate 1 validation and formatting of at-risk student records for downstream intervention drafting',
      ],
    },
    abilities: {
      summary: 'Deterministic score calculation, PAL test segregation, tenant boundary isolation, and read-only extraction.',
      skills: [
        'Accurate percentage calculation and threshold filtering',
        'Selective filtering separating formal teacher exams from automated practice papers',
        'Safe student name resolution with graceful fallback for unmapped profiles',
        'At-risk attempt cohort packaging',
      ],
      safeguards: [
        'Read-only operations (zero modifications to student marks or exam status)',
        'Tenant institute boundary enforcement (sub_institute_id)',
        'Gate 1 validation pass requires valid exam attempt calculations',
      ],
    },
    usage: {
      summary: 'Executes as Step 1 of the Exam & Assessment pipeline, establishing the baseline exam performance and feeding at-risk student records to Agent 3.',
      step_by_step_flow: [
        'Step 1: Receives institute ID and standard parameter (or runs all-standards sweep)',
        'Step 2: Queries question_paper joined with lms_online_exam, filtering by institute and excluding PAL papers',
        'Step 3: Aggregates attempt counts and cohort average marks, then filters attempts scoring under at_risk_percent (40%)',
        'Step 4: Resolves student names from tblstudent and structures at-risk records',
        'Step 5: Validates Gate 1 and delivers at-risk exam records to Gate 1 output and downstream to Agent 3',
      ],
    },
  },
  'exam_assessment.assignment_status': {
    name: 'Assignment status reader',
    module: 'Exam & Assessment',
    tool: 'exam_assessment.assignment_status',
    knowledge: {
      summary: 'Assigned coursework records across assignments, worksheets, and projects, submission statuses, teacher review logs, due dates, and student class rosters.',
      items: [
        'Coursework records, instructions, due dates, and standard bindings from lms_assignment',
        'Work type taxonomy: differentiation between assignment, worksheet, and project stored in the same table',
        'Student submission and review status flags: submitted, reviewed by teacher, pending review, and not submitted',
        'Student directory and enrollment rosters from tblstudent for delinquent submission reconciliation',
      ],
      tables: ['lms_assignment', 'tblstudent', 'standard', 'subject'],
    },
    activities: {
      summary: 'Scans all coursework allocated to a standard, categorizes by work type, tracks submission and review counts, and compiles the delinquent not-submitted list.',
      items: [
        'Institute and standard-scoped querying of lms_assignment',
        'Taxonomic grouping and counting by work type (assignment, worksheet, project)',
        'Auditing submission completeness and teacher evaluation rates',
        'Compiling detailed list of students with unsubmitted coursework past scheduled due dates',
        'Gate 2 validation ensuring coursework integrity across the target standard',
      ],
    },
    abilities: {
      summary: 'Unified coursework schema disambiguation, class roster cross-referencing, and non-submitted student isolation.',
      skills: [
        'Multi-work-type aggregation over unified coursework storage',
        'Cross-table join between assignments and student enrollment rosters',
        'Accurate overdue status tracking without timezone drift',
        'Coursework delinquency ledger formatting',
      ],
      safeguards: [
        'Read-only execution with zero updates to student submission states',
        'Tenant institute boundary enforcement (sub_institute_id)',
        'Gate 2 validation ensures work status is fully accounted for',
      ],
    },
    usage: {
      summary: 'Executes as Step 2 of the Exam & Assessment pipeline, providing comprehensive coursework submission and review data to complement exam performance.',
      step_by_step_flow: [
        'Step 1: Receives standard scope from Gate 1',
        'Step 2: Queries lms_assignment filtered by institute ID, standard ID, and division',
        'Step 3: Breaks down coursework totals by work type (assignment, worksheet, project)',
        'Step 4: Tallies submitted, reviewed, and unsubmitted counts, isolating delinquent student records',
        'Step 5: Validates Gate 2 and delivers the unsubmitted coursework ledger to Gate 2 and Agent 3',
      ],
    },
  },
  'exam_assessment.draft_review_note': {
    name: 'Assessment review drafter',
    module: 'Exam & Assessment',
    tool: 'exam_assessment.draft_review_note',
    knowledge: {
      summary: 'Fused multi-source academic evidence: at-risk exam scores from Agent 1, unsubmitted coursework from Agent 2, pedagogical intervention strategies, and draft safety rules.',
      items: [
        'At-risk exam attempt scores, percentages, and exam names received from Agent 1 (Gate 1)',
        'Unsubmitted coursework items, due dates, and work types received from Agent 2 (Gate 2)',
        'Pedagogical intervention guidelines (1-on-1 concept reinforcement, submission extensions, guided practice)',
        'Safety and governance guardrails: mandatory draft status, no automated external dispatching, objective and supportive wording standards',
      ],
      tables: ['ai_cases', 'ai_evidence', 'ai_recommendations', 'question_paper', 'lms_assignment'],
    },
    activities: {
      summary: 'Synthesizes exam gaps and missing coursework to draft individualized educator review notes, prepares a comprehensive cohort executive summary, and applies human sign-off guardrails.',
      items: [
        'Synthesizing at-risk attempts from Agent 1 into individualized exam review notes citing exact scores and percentages',
        'Synthesizing unsubmitted coursework from Agent 2 into coursework follow-up notes citing exact assignment titles',
        'Compiling the overall Cohort Executive Review Summary with participation metrics, average scores, and recommended interventions',
        'Applying the strict draft_pending_human_approval status tag to all drafted notes',
        'Gate 3 safety validation ensuring zero external communication was dispatched',
      ],
    },
    abilities: {
      summary: 'Multi-agent evidence fusion, grounded factual synthesis, human-in-the-loop guardrail enforcement, and pedagogical recommendation generation.',
      skills: [
        'Correlating multi-agent performance deficits per student into a single cohesive profile',
        'Grounded factual drafting citing exact scores, benchmarks, and dates with zero fabricated numbers',
        'Pedagogical remediation mapping (linking specific failure modes to actionable teacher follow-ups)',
        'Cohort-level strategic intervention synthesis',
      ],
      safeguards: [
        'Strict draft-only policy: zero external messages, SMS, or emails are ever dispatched automatically',
        'Human-in-the-loop requirement: notes remain pending until approved by an authorized educator',
        'Objective, constructive pedagogical language with zero disparaging comments',
        'All drafts recorded in pipeline audit logs',
      ],
    },
    usage: {
      summary: 'Acts as the final synthesis step (Step 3) of the Exam & Assessment pipeline, converting raw exam and assignment data from Agents 1 & 2 into actionable, safe draft review notes ready for teacher sign-off.',
      step_by_step_flow: [
        'Step 1: Consumes at-risk exam records from Agent 1 (Gate 1) and unsubmitted coursework records from Agent 2 (Gate 2)',
        'Step 2: Drafts individual student review notes for low exam attempts (citing student name, exam title, score, total marks, percentage, and 1-on-1 reinforcement recommendation)',
        'Step 3: Drafts individual student follow-up notes for missing assignments (citing student name, work title, work type, and extension recommendation)',
        'Step 4: Compiles the Cohort Executive Review Summary consolidating institute stats, exams published, attempts, pass rates, and action items',
        'Step 5: Enforces Gate 3 safety validation, confirms no external dispatch, marks drafts as draft_pending_human_approval, and returns the final report',
      ],
    },
  },
  'lms.courses': {
    name: 'Course Catalogue Reader',
    module: 'Teach / Learn',
    tool: 'lms.courses',
    knowledge: {
      summary: 'Master academic hierarchy standards, standard-subject active mappings with content publishing enablement (allow_content = "Yes"), chapter sequences, topic definitions, and concept linkage records.',
      items: [
        'Standards curriculum definitions and board bindings from standard',
        'Subject mappings with active content publishing enabled (allow_content = "Yes") from sub_std_map and subject',
        'Chapter hierarchy sequences, titles, and academic years from chapter_master',
        'Topic definitions and sub-topic linkages from topic_master',
        'Concept nodes and published content relationships from lms_concept and content_master',
      ],
      tables: ['standard', 'sub_std_map', 'subject', 'chapter_master', 'topic_master', 'content_master', 'lms_concept'],
    },
    activities: {
      summary: 'Traverses the complete 5-tier content hierarchy sequentially, calculates estate content metrics, detects structural curriculum gaps, and enforces Gate 1 validation.',
      items: [
        'Standard ID resolution from user string inputs or institute roster queries',
        '5-tier hierarchical traversal across Standard -> Subject -> Chapter -> Topic -> Intelligence',
        'Gap classification across 5 defect classes: missing subjects, missing chapters, missing topics, missing intelligence/concepts, and broken mappings',
        'Estate metric aggregation (live counts of standards, courses with content, chapters, and topics)',
        'Generation and hashing of curriculum inventory for caching and downstream pipeline handoff',
      ],
    },
    abilities: {
      summary: 'Deterministic read-only recursive tree traversal, zero-fabrication gap scoring, standard ID resolution, and strict Gate 1 pipeline halting.',
      skills: [
        'Multi-tier relational graph traversal without data mutations (risk: read)',
        'Standard and board resolution logic',
        'Zero-fabrication reporting (preserves genuine database nulls instead of synthetic data)',
        'Curriculum hash calculation to avoid redundant database roundtrips',
      ],
      safeguards: [
        'Read-only enforcement (modifies zero database records)',
        'Tenant boundary isolation via sub_institute_id',
        'Mandatory Gate 1 halting if zero courses or invalid standard is returned',
      ],
    },
    usage: {
      summary: 'Serves as the foundation (Step 1) of the Teach / Learn pipeline, resolving class curriculum targets, validating structural integrity, and handing off clean standard and chapter scopes to downstream agents.',
      step_by_step_flow: [
        'Step 1: Receives institute ID and standard parameter (e.g. Standard 7 or "all")',
        'Step 2: Queries sub_std_map joined with standard and subject to filter active courses where allow_content = "Yes"',
        'Step 3: Traverses chapter_master and topic_master to measure catalog depth and checks content_master for concept links',
        'Step 4: Evaluates Gate 1 rules (must resolve valid standard_id, must find >= 1 active course, must extract chapter list)',
        'Step 5: Passes the validated standard_id to Agent 2 (Timeline Reader) and standard chapters scope to Agent 3 (Content Model Coverage)',
      ],
    },
  },
  'teach_learn.courses': {
    name: 'Course Catalogue Reader',
    module: 'Teach / Learn',
    tool: 'teach_learn.courses',
    knowledge: {
      summary: 'Master academic hierarchy standards, standard-subject active mappings with content publishing enablement (allow_content = "Yes"), chapter sequences, topic definitions, and concept linkage records.',
      items: [
        'Standards curriculum definitions and board bindings from standard',
        'Subject mappings with active content publishing enabled (allow_content = "Yes") from sub_std_map and subject',
        'Chapter hierarchy sequences, titles, and academic years from chapter_master',
        'Topic definitions and sub-topic linkages from topic_master',
        'Concept nodes and published content relationships from lms_concept and content_master',
      ],
      tables: ['standard', 'sub_std_map', 'subject', 'chapter_master', 'topic_master', 'content_master', 'lms_concept'],
    },
    activities: {
      summary: 'Traverses the complete 5-tier content hierarchy sequentially, calculates estate content metrics, detects structural curriculum gaps, and enforces Gate 1 validation.',
      items: [
        'Standard ID resolution from user string inputs or institute roster queries',
        '5-tier hierarchical traversal across Standard -> Subject -> Chapter -> Topic -> Intelligence',
        'Gap classification across 5 defect classes: missing subjects, missing chapters, missing topics, missing intelligence/concepts, and broken mappings',
        'Estate metric aggregation (live counts of standards, courses with content, chapters, and topics)',
        'Generation and hashing of curriculum inventory for caching and downstream pipeline handoff',
      ],
    },
    abilities: {
      summary: 'Deterministic read-only recursive tree traversal, zero-fabrication gap scoring, standard ID resolution, and strict Gate 1 pipeline halting.',
      skills: [
        'Multi-tier relational graph traversal without data mutations (risk: read)',
        'Standard and board resolution logic',
        'Zero-fabrication reporting (preserves genuine database nulls instead of synthetic data)',
        'Curriculum hash calculation to avoid redundant database roundtrips',
      ],
      safeguards: [
        'Read-only enforcement (modifies zero database records)',
        'Tenant boundary isolation via sub_institute_id',
        'Mandatory Gate 1 halting if zero courses or invalid standard is returned',
      ],
    },
    usage: {
      summary: 'Serves as the foundation (Step 1) of the Teach / Learn pipeline, resolving class curriculum targets, validating structural integrity, and handing off clean standard and chapter scopes to downstream agents.',
      step_by_step_flow: [
        'Step 1: Receives institute ID and standard parameter (e.g. Standard 7 or "all")',
        'Step 2: Queries sub_std_map joined with standard and subject to filter active courses where allow_content = "Yes"',
        'Step 3: Traverses chapter_master and topic_master to measure catalog depth and checks content_master for concept links',
        'Step 4: Evaluates Gate 1 rules (must resolve valid standard_id, must find >= 1 active course, must extract chapter list)',
        'Step 5: Passes the validated standard_id to Agent 2 (Timeline Reader) and standard chapters scope to Agent 3 (Content Model Coverage)',
      ],
    },
  },
  'lms.activities': {
    name: 'Activity Timeline Reader',
    module: 'Teach / Learn',
    tool: 'lms.activities',
    knowledge: {
      summary: 'Classroom instructional timeline data, scheduled virtual and offline periods, assigned student homework, and chronological date prioritization policies.',
      items: [
        'Homework assignments, descriptions, submission deadlines, and subject allocations from homework',
        'Scheduled virtual classroom sessions and daily timetable slots from timetable_schedule and daily_attendance',
        'Chronological date prioritization policy (prioritizes actual calendar timestamps over syear tags to support seamless multi-year/archival retrieval)',
        'Division and section roster mappings for the selected standard',
      ],
      tables: ['homework', 'daily_attendance', 'timetable_schedule', 'academic_year'],
    },
    activities: {
      summary: 'Aggregates homework and scheduled class sessions across a sliding temporal window around today, categorizes timeline status, and sanitizes sensitive meeting links.',
      items: [
        'Sliding window temporal scoping (default +/-7 days, configurable up to 90 days)',
        'Timeline orientation classification tagging each activity as past, today, or upcoming',
        'Class roster and division scope validation against the target standard',
        'Automatic redaction of virtual classroom join links to protect classroom meeting privacy',
        'Gate 2 validation ensuring activity records match standard scope',
      ],
    },
    abilities: {
      summary: 'Sliding-window temporal normalization, break and vacation period tolerance (non-blocking validation), and meeting URL redaction.',
      skills: [
        'Chronological multi-source timeline indexing and sorting',
        'Date normalization across changing academic years',
        'Non-blocking vacation tolerance (allows 0 activities during school breaks if class scope is valid)',
        'Privacy-preserving link sanitization',
      ],
      safeguards: [
        'Read-only enforcement (modifies zero homework or timetable records)',
        'Meeting join URLs are never returned in agent payloads',
        'Tenant and standard boundary enforcement',
      ],
    },
    usage: {
      summary: 'Executes as Step 2 of the Teach / Learn pipeline, consuming the validated standard from Agent 1 to verify instructional pacing and recent/upcoming class activity.',
      step_by_step_flow: [
        'Step 1: Receives the validated standard_id directly from Agent 1\'s Gate 1 output',
        'Step 2: Computes the sliding window boundary [today - days_back, today + days_ahead]',
        'Step 3: Queries homework and timetable_schedule for the standard within the window',
        'Step 4: Categorizes each record into past, today, or upcoming, and strips join URLs',
        'Step 5: Evaluates Gate 2 rules (standard ownership verified) and outputs the unified activity timeline to Gate 2',
      ],
    },
  },
  'teach_learn.activities': {
    name: 'Activity Timeline Reader',
    module: 'Teach / Learn',
    tool: 'teach_learn.activities',
    knowledge: {
      summary: 'Classroom instructional timeline data, scheduled virtual and offline periods, assigned student homework, and chronological date prioritization policies.',
      items: [
        'Homework assignments, descriptions, submission deadlines, and subject allocations from homework',
        'Scheduled virtual classroom sessions and daily timetable slots from timetable_schedule and daily_attendance',
        'Chronological date prioritization policy (prioritizes actual calendar timestamps over syear tags to support seamless multi-year/archival retrieval)',
        'Division and section roster mappings for the selected standard',
      ],
      tables: ['homework', 'daily_attendance', 'timetable_schedule', 'academic_year'],
    },
    activities: {
      summary: 'Aggregates homework and scheduled class sessions across a sliding temporal window around today, categorizes timeline status, and sanitizes sensitive meeting links.',
      items: [
        'Sliding window temporal scoping (default +/-7 days, configurable up to 90 days)',
        'Timeline orientation classification tagging each activity as past, today, or upcoming',
        'Class roster and division scope validation against the target standard',
        'Automatic redaction of virtual classroom join links to protect classroom meeting privacy',
        'Gate 2 validation ensuring activity records match standard scope',
      ],
    },
    abilities: {
      summary: 'Sliding-window temporal normalization, break and vacation period tolerance (non-blocking validation), and meeting URL redaction.',
      skills: [
        'Chronological multi-source timeline indexing and sorting',
        'Date normalization across changing academic years',
        'Non-blocking vacation tolerance (allows 0 activities during school breaks if class scope is valid)',
        'Privacy-preserving link sanitization',
      ],
      safeguards: [
        'Read-only enforcement (modifies zero homework or timetable records)',
        'Meeting join URLs are never returned in agent payloads',
        'Tenant and standard boundary enforcement',
      ],
    },
    usage: {
      summary: 'Executes as Step 2 of the Teach / Learn pipeline, consuming the validated standard from Agent 1 to verify instructional pacing and recent/upcoming class activity.',
      step_by_step_flow: [
        'Step 1: Receives the validated standard_id directly from Agent 1\'s Gate 1 output',
        'Step 2: Computes the sliding window boundary [today - days_back, today + days_ahead]',
        'Step 3: Queries homework and timetable_schedule for the standard within the window',
        'Step 4: Categorizes each record into past, today, or upcoming, and strips join URLs',
        'Step 5: Evaluates Gate 2 rules (standard ownership verified) and outputs the unified activity timeline to Gate 2',
      ],
    },
  },
  'teach_learn.content_model_coverage': {
    name: 'Content Model Coverage Agent',
    module: 'Teach / Learn',
    tool: 'teach_learn.content_model_coverage',
    knowledge: {
      summary: 'The 4-Type Pedagogical Content Model (Concept Learning, Practice Ladder, Misconception Library, Assessment Bank) and chapter semantic intelligence extractions.',
      items: [
        'Type 1: Concept Learning models (4 variants: definition, knowledge anchor, real-world application, evidence)',
        'Type 2: Practice Ladder (5-level Bloom\'s taxonomy cognitive ladder from assessment blueprints)',
        'Type 3: Misconception Library (common student traps, flawed heuristics, diagnostic feedback)',
        'Type 4: Assessment Bank (calibrated rubrics, marking schemes, question items)',
        'Semantic intelligence extraction records and section slice counts from semantic_intelligence and content_master',
      ],
      tables: ['semantic_intelligence', 'content_master', 'chapter_master', 'lms_concept'],
    },
    activities: {
      summary: 'Evaluates pedagogical depth across all standard chapters, measures 4-type model coverage percentages, detects authoring gaps, and generates coordinator insights.',
      items: [
        'Granular SQL slice analysis across chapter semantic extraction columns',
        'Evaluation of 4-type content coverage percentages for each chapter and across the institute estate',
        'Diagnosis of curriculum bottlenecks (e.g. chapters with Type 1-3 complete but lacking Type 4 assessment rubrics)',
        'Synthesis of actionable curriculum insights and pedagogical authoring priorities for educators',
        'Gate 3 content readiness validation and generation of the Unified Teach / Learn Report',
      ],
    },
    abilities: {
      summary: 'High-performance memory-safe SQL slicing, strict zero-fabrication metric scoring, and multi-agent evidence fusion.',
      skills: [
        'Targeted SQL column aggregations without heavy JSON blob hydration',
        'Multi-type pedagogical taxonomy evaluation against Bloom\'s cognitive tiers',
        'Zero-fabrication scoring (reports true 0% rather than synthesized default values when assets are unauthored)',
        'Multi-agent output consolidation into a unified executive report',
      ],
      safeguards: [
        'Read-only execution with zero database writes',
        'Institute-level tenant isolation',
        'Memory leak prevention on high-volume extraction tables',
      ],
    },
    usage: {
      summary: 'Acts as the analytical culmination (Step 3) of the Teach / Learn pipeline, fusing curriculum structure from Agent 1 and instructional timeline from Agent 2 with semantic intelligence to deliver the final Content Readiness Report.',
      step_by_step_flow: [
        'Step 1: Ingests the verified standard_id and chapter roster from Gate 1 and Gate 2',
        'Step 2: Executes SQL slice queries on semantic_intelligence and content_master matching chapter IDs',
        'Step 3: Measures coverage percentages across Type 1, Type 2, Type 3, and Type 4 models',
        'Step 4: Compiles learning gaps summary highlighting missing assessment rubrics and unextracted concepts',
        'Step 5: Enforces Gate 3 validation and outputs the consolidated Unified Teach / Learn Report',
      ],
    },
  },
  'engagement.students_needing_attention': {
    name: 'Engagement attention reader',
    module: 'Engagement',
    tool: 'engagement.students_needing_attention',
    knowledge: {
      summary: 'Live student attendance records, assigned homework, and LMS coursework submissions across the institute estate, participation benchmark thresholds (default 60%), and academic temporal windows.',
      items: [
        'Student directory and roster profiles from tblstudent',
        'Daily student attendance marks and attendance rates from tblstudent_attendance',
        'Assigned homework and submission rates from tblhomework and tblhomework_submission',
        'LMS assignment completion records from lms_assignment and lms_assignment_submission',
        'Configurable participation threshold (default 60%, evaluated across attendance and submissions)',
      ],
      tables: ['tblstudent', 'tblstudent_attendance', 'tblhomework', 'tblhomework_submission', 'lms_assignment'],
    },
    activities: {
      summary: 'Scans cohort attendance, homework, and assignment participation, identifies learners falling below the participation threshold, and isolates specific deficit vectors.',
      items: [
        'Auditing attendance percentage over the configured temporal window (default: 30 days)',
        'Evaluating homework submission and coursework completion rates against class benchmarks',
        'Detecting specific deficiencies: low attendance, missing homework, unsubmitted assignments',
        'Isolating at-risk learners without altering any marks or attendance records',
        'Gate 1 validation pass packaging flagged students for downstream activity profiling',
      ],
    },
    abilities: {
      summary: 'High-performance cross-table deficit calculation, tenant boundary isolation, zero synthetic scoring, and read-only extraction.',
      skills: [
        'Multi-source participation aggregation without fabricating default scores',
        'Temporal sliding window normalization',
        'Deficiency vector tagging and cohort packaging',
        'Strict tenant isolation via sub_institute_id',
      ],
      safeguards: [
        'Read-only enforcement (zero modifications to student records, marks, or attendance)',
        'Strict tenant isolation via sub_institute_id',
        'Gate 1 validation requires verified flagged students before pipeline progression',
      ],
    },
    usage: {
      summary: 'Executes as Step 1 of the Engagement pipeline, detecting which students need academic attention and passing validated candidates to Agent 2.',
      step_by_step_flow: [
        'Step 1: Ingests target standard, threshold percentage (default 60%), and days back (default 30 days)',
        'Step 2: Scans tblstudent_attendance, tblhomework, and lms_assignment for candidate records',
        'Step 3: Calculates individual participation rates and flags students falling below threshold',
        'Step 4: Tag specific deficit causes (low attendance, homework gaps, coursework delinquency)',
        'Step 5: Enforces Gate 1 validation and hands off validated flagged students to Agent 2 (Activity Profiler)',
      ],
    },
  },
  'engagement.student_summary': {
    name: 'Engagement activity profiler',
    module: 'Engagement',
    tool: 'engagement.student_summary',
    knowledge: {
      summary: 'Granular platform telemetry from lms_student_engagement, learning content views, interactive practice sessions, and student doubt discussions in lms_doubt.',
      items: [
        'Per-event digital platform interactions from lms_student_engagement (content views, practice attempts)',
        'Discussion forums and academic queries from lms_doubt and lms_doubt_conversation',
        'Unanswered doubt detection and student query timestamps',
        'Diagnostic disengagement vector classification taxonomy',
      ],
      tables: ['lms_student_engagement', 'lms_doubt', 'lms_doubt_conversation', 'tblstudent'],
    },
    activities: {
      summary: 'Consumes flagged students from Agent 1, profiles their learning platform usage, audits discussion engagement, and isolates root causes of participation decline.',
      items: [
        'Consuming validated candidate cohort from Gate 1 without re-scanning the estate independently',
        'Inspecting digital learning touchpoints (video lectures viewed, chapter practice sessions)',
        'Auditing social discussion activity and identifying unresolved student doubts',
        'Diagnosing participation gaps (platform inactivity, unanswered questions, delayed practice)',
        'Gate 2 validation ensuring activity timestamps and diagnostic accuracy',
      ],
    },
    abilities: {
      summary: 'Multi-channel digital telemetry correlation, objective diagnostic classification, and downstream evidence enrichment.',
      skills: [
        'Event stream aggregation from lms_student_engagement',
        'Social discussion and question resolution state analysis',
        'Non-judgmental diagnostic classification',
        'Evidence-enriched diagnostic profile packaging',
      ],
      safeguards: [
        'Read-only operations with zero modifications to doubt or platform engagement records',
        'Strict tenant isolation via sub_institute_id',
        'Gate 2 validation ensures diagnostic evidence matches verified platform data',
      ],
    },
    usage: {
      summary: 'Executes as Step 2 of the Engagement pipeline, explaining why learners are disengaged and feeding diagnostic evidence to Agent 3.',
      step_by_step_flow: [
        'Step 1: Receives validated flagged student cohort from Gate 1',
        'Step 2: Inspects digital event telemetry in lms_student_engagement for each learner',
        'Step 3: Checks doubt topics and unanswered questions in lms_doubt',
        'Step 4: Formulates enriched diagnostic profiles with specific disengagement causes',
        'Step 5: Enforces Gate 2 validation and passes diagnostic profiles to Agent 3 (Intervention Drafter)',
      ],
    },
  },
  'engagement.draft_intervention_note': {
    name: 'Re-engagement intervention drafter',
    module: 'Engagement',
    tool: 'engagement.draft_intervention_note',
    knowledge: {
      summary: 'Pedagogical intervention blueprints, non-judgmental educator communication standards, human approval workflows, and governance safety rules.',
      items: [
        'Actionable intervention strategies (1-on-1 check-ins, doubt clearance, remedial practice, submission extensions)',
        'Safety policies strictly forbidding negative labeling or character assumptions from raw metrics',
        'Human-in-the-loop approval workflows (engagement_intervention_review)',
        'Pending approval queue integration (ai_agent_approvals, ai_audit_logs)',
      ],
      tables: ['ai_agent_approvals', 'ai_audit_logs', 'tblstudent', 'lms_student_engagement'],
    },
    activities: {
      summary: 'Synthesizes diagnostic evidence into objective, constructive draft intervention proposals for teacher review and deposits them in the approval queue.',
      items: [
        'Ingesting enriched diagnostic profiles from Gate 2',
        'Drafting personalized student follow-up plans citing specific attendance or coursework evidence',
        'Composing cohort-level engagement briefs for academic coordinators',
        'Enforcing strict draft-only governance without automatic message dispatching',
        'Gate 3 validation depositing intervention proposals into the educator approval queue',
      ],
    },
    abilities: {
      summary: 'Non-judgmental natural language synthesis, policy compliance, and approval queue management.',
      skills: [
        'Generating objective, evidence-cited follow-up notes',
        'Recommending targeted pedagogical remedies without changing records',
        'Strict draft-only confinement (max_verb=recommend, may_execute=0)',
        'Dual-level execution history synchronization',
      ],
      safeguards: [
        'Zero automated external communication (no SMS, WhatsApp, or emails dispatched)',
        'Zero modifications to student marks, attendance, or enrollment records',
        'Human educator review and approval required before execution',
      ],
    },
    usage: {
      summary: 'Executes as Step 3 of the Engagement pipeline, producing the final educator-facing intervention drafts and completing the pipeline run.',
      step_by_step_flow: [
        'Step 1: Receives enriched diagnostic profiles from Gate 2',
        'Step 2: Composes factual evidence statements citing platform data',
        'Step 3: Formulates recommended educator actions tailored to observed deficits',
        'Step 4: Marks all proposals as draft_pending_human_approval',
        'Step 5: Enforces Gate 3 validation and records run results in ai_agent_runs and agent state',
      ],
    },
  },
};

function ToolAgentEsoModal({
  eso,
  onClose,
}: {
  eso: ToolAgentEsoInfo;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-slate-50 px-6 py-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                Executive Skill Object (ESO)
              </span>
              <span className="rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                {eso.module}
              </span>
              <span className="rounded-md bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                {eso.tool}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-950 mt-1">
              {eso.name}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Specific grounded specification of Knowledge, Activities, Abilities, and Usage for this agent.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-blue-200 bg-white p-4 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <BookOpen className="size-3.5 text-blue-600" />
                  1. Knowledge
                </span>
                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                  Data & Schemas
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                {eso.knowledge.summary}
              </p>
              <ul className="space-y-1 text-[11px] text-slate-700 pt-1">
                {eso.knowledge.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-blue-500 font-bold">•</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Database Tables:
                </span>
                <div className="flex flex-wrap gap-1">
                  {eso.knowledge.tables.map((t) => (
                    <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-700">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-purple-200 bg-white p-4 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between border-b border-purple-100 pb-2">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Activity className="size-3.5 text-purple-600" />
                  2. Activities
                </span>
                <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                  Operations & Audits
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                {eso.activities.summary}
              </p>
              <ul className="space-y-1 text-[11px] text-slate-700 pt-1">
                {eso.activities.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-purple-500 font-bold">➔</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-white p-4 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  3. Abilities
                </span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Skills & Safeguards
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                {eso.abilities.summary}
              </p>
              <div className="space-y-2 pt-1">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-800 block mb-1">
                    Technical Skills:
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    {eso.abilities.skills.map((skill, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span className="leading-snug">{skill}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    Safety & Safeguards:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {eso.abilities.safeguards.map((c, idx) => (
                      <span key={idx} className="rounded bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800">
                        🛡️ {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-white p-4 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Workflow className="size-3.5 text-amber-600" />
                  4. Usage
                </span>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                  Step-by-Step Flow
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                {eso.usage.summary}
              </p>
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-bold uppercase text-amber-800 block mb-1">
                  Concrete Execution Sequence:
                </span>
                <ol className="space-y-1 text-[11px] text-slate-700">
                  {eso.usage.step_by_step_flow.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-bold text-[9px] mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-snug">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 shrink-0">
          <span className="text-[11px] text-slate-500">
            {eso.name} · Distinct Executive Skill Object
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            Close ESO
          </button>
        </div>
      </div>
    </div>
  );
}

/** The manifest as `/api/ai/agents` returns it. Loosely typed — it is a config row. */
interface AgentManifestRow {
  agent_key?: string;
  name?: string;
  purpose?: string;
  description?: string;
  max_verb?: string;
  may_execute_actions?: boolean | number;
  authorized_workflow_keys?: string[] | string;
  allowed_roles?: string[];
  allowed_tools?: string[];
  [key: string]: unknown;
}

/** One case a backend agent opened, as its own result describes it. */
interface AgentCase {
  case_id: number;
  student_id?: number;
  student_name?: string;
  subject_label?: string;
  placement?: { standard_name?: string | null; division_name?: string | null } | null;
  severity?: string;
  priority_score?: number;
  signals?: Array<{ signal_key?: string; severity?: string; score?: number; evidence_count?: number }>;
  explanation?: { narrative?: string; governance_passed?: boolean; reason_refused?: string | null };
  recommendation?: {
    id?: number | null;
    status?: string;
    governance_passed?: boolean;
    reason_refused?: string | null;
    title?: string;
  } | null;
}

export function AiStackAutomationsScreen({ module }: { module: AiStackModule }) {
  const rbacKey = aiStackRbacKey(module);

  // Tool agents, on the central Agent Management engine.
  const agents = useBrainResource(() => fetchAgents({ module: module.key }), [module.key]);
  const runs = useBrainResource(() => fetchRuns({ module: module.key, limit: 100 }), [module.key]);
  const canCreate = usePermission(rbacKey, 'create');
  const canRun = usePermission(rbacKey, 'update');

  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [running, setRunning] = useState<Agent | null>(null);
  const [selectedEso, setSelectedEso] = useState<ToolAgentEsoInfo | null>(null);
  // Remounts the scoped console after a preset action so its own lists refresh.
  const [consoleKey, setConsoleKey] = useState(0);

  /** The agent each preset resolves to in this tenant, matched by name. */
  const configured = useMemo(() => {
    const map = new Map<string, Agent>();

    for (const preset of module.presets) {
      const match = (agents.data ?? []).find((agent) => agent.name === preset.name && agent.status !== 'archived');
      if (match) map.set(preset.name, match);
    }

    return map;
  }, [agents.data, module.presets]);

  const refreshAll = useCallback(() => {
    agents.refresh();
    runs.refresh();
    setConsoleKey((key) => key + 1);
  }, [agents, runs]);

  useEffect(() => {
    const handler = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ module?: string }>;
      if (!customEvt.detail?.module || customEvt.detail.module === module.key) {
        refreshAll();
      }
    };
    window.addEventListener('agents:runs-updated', handler);
    return () => window.removeEventListener('agents:runs-updated', handler);
  }, [refreshAll, module.key]);

  const enable = useCallback(
    async (preset: CreateAgentInput) => {
      setBusy(preset.name);
      setNote(null);
      try {
        const agent = await createAgent(preset);
        setNote(
          `${agent.name} enabled as ${agent.id}. It runs only when someone presses Run, and only as that person.`,
        );
        refreshAll();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The agent could not be enabled.');
      } finally {
        setBusy(null);
      }
    },
    [refreshAll],
  );

  const toggle = useCallback(
    async (agent: Agent) => {
      setBusy(agent.name);
      setNote(null);
      const next = agent.status === 'active' ? 'paused' : 'active';
      try {
        await setAgentStatus(agent.id, next);
        setNote(`${agent.name} is now ${next}.`);
        refreshAll();
      } catch (cause) {
        setNote(cause instanceof Error ? cause.message : 'The status could not be changed.');
      } finally {
        setBusy(null);
      }
    },
    [refreshAll],
  );

  /**
   * What to say about rights, and only when it is actually the obstacle.
   *
   * It names the key, because the failure this replaces was a message that told people to
   * ask for a right without saying what it was called.
   */
  const rightsNote =
    canCreate === false && configured.size === 0
      ? `Your role cannot enable tool agents for the ${module.label} module. Ask an administrator for ${rbacKey} create rights — the key is registered and grantable in Group-wise Rights.`
      : canRun === false && configured.size > 0
        ? `Your role can see these agents but cannot run or pause them (${rbacKey} update rights).`
        : null;

  const refreshing = agents.refreshing || runs.refreshing;

  return (
    <div className="space-y-6">
      {module.boundAgent?.agentKey === 'k12_course_catalogue' ? (
        <CatalogueAgentControlCard onValidated={refreshAll} />
      ) : module.boundAgent?.agentKey === 'k12_exam_assessment' ? (
        <ExamAssessmentAgentControlCard onValidated={refreshAll} />
      ) : module.boundAgent?.agentKey === 'k12_engagement' ? (
        <EngagementAgentControlCard onValidated={refreshAll} />
      ) : module.boundAgent ? (
        <BoundAgentPanel module={module} agent={module.boundAgent} />
      ) : (
        <NoBoundAgentPanel module={module} />
      )}

      <section className="rounded-lg border border-slate-200 bg-white px-5 py-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-950">{module.label} tool agents</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Each one runs on the central Agent Management engine, scoped to the {module.label} module. The read
              agents answer from this school&apos;s own {module.records}; a drafter writes text and sends nothing.
              Every run is recorded against the person who pressed Run.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:border-gray-300 disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {agents.error && !agents.data && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs text-red-700">
            {agents.error}
          </p>
        )}
        {rightsNote && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
            <Lock size={14} className="mt-0.5 shrink-0" />
            {rightsNote}
          </p>
        )}
        {note && (
          <p className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-900">
            {note}
          </p>
        )}

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {module.presets.map((preset) => (
            <PresetCard
              key={preset.name}
              preset={preset}
              agent={configured.get(preset.name) ?? null}
              runs={runs.data ?? []}
              checking={agents.loading && !agents.data}
              busy={busy === preset.name}
              canCreate={canCreate === true}
              canRun={canRun === true}
              onEnable={() => void enable(preset)}
              onToggle={(agent) => void toggle(agent)}
              onRun={setRunning}
              onShowEso={() => {
                const info = TOOL_AGENT_ESO_MAP[preset.tools_allowed[0]];
                if (info) setSelectedEso(info);
              }}
            />
          ))}
        </div>
      </section>

      <div>
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-slate-800">
          {module.label} agent management
        </h3>
        <AgentManagement key={consoleKey} moduleFilter={module.key} embedded hideCreate={module.key === 'teach_learn' || module.key === 'exam_assessment' || module.key === 'engagement'} />
      </div>

      {running && (
        <RunAgentDialog
          agent={running}
          onClose={() => setRunning(null)}
          onRan={() => {
            runs.refresh();
            setConsoleKey((key) => key + 1);
          }}
        />
      )}

      {selectedEso && (
        <ToolAgentEsoModal
          eso={selectedEso}
          onClose={() => setSelectedEso(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The module has no backend manifest — say so, and say what that means
// ---------------------------------------------------------------------------

/**
 * Why there is no Run button, and what the module does have instead.
 *
 * This is the honest state for most modules, and it is written out rather than left as an
 * absence because "where is the agent" is the first question somebody has on this tab. The
 * reason is the one `config/ai.php` records for the module — the same sentence the
 * lifecycle reports when it declines to reach its deeper stages — so the screen and the
 * backend cannot give different answers.
 */
function NoBoundAgentPanel({ module }: { module: AiStackModule }) {
  return (
    <AiStackCard>
      <AiStackCardHeading
        title={`${module.label} has no agent of its own`}
        hint="What that means for cases, recommendations and approvals in this module."
      />

      <div className="space-y-3 p-5">
        <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
          <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
          <span>
            {module.noAgentReason ??
              `No agent manifest is bound to the ${module.label} module, so nothing here opens a case or raises a recommendation.`}
          </span>
        </p>

        <ul className="grid gap-2 sm:grid-cols-3">
          <NoAgentFact
            title="No cases"
            detail={`Nothing detects a condition in the ${module.records} and opens a case against it.`}
          />
          <NoAgentFact
            title="No approval queue"
            detail="Nothing raises a recommendation, so there is nothing here for a person to approve or reject."
          />
          <NoAgentFact
            title="Tool agents still run"
            detail={`The agents below read this school's own ${module.records} as the person who presses Run.`}
          />
        </ul>

        <p className="text-xs leading-5 text-slate-500">
          This is a statement about configuration, not a fault. A module gains a manifest by an administrator
          registering one in <span className="font-mono">ai_agents</span> and binding it in{' '}
          <span className="font-mono">config/ai.php</span>; until then this panel would have nothing true to show,
          and a disabled Run button would suggest otherwise.
        </p>
      </div>
    </AiStackCard>
  );
}

function NoAgentFact({ title, detail }: { title: string; detail: string }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{detail}</p>
    </li>
  );
}

// ---------------------------------------------------------------------------
// The backend agent a module is bound to — the one the chatbot uses
// ---------------------------------------------------------------------------

/** The execution stages a run passes through, in the order a reader should see them. */
type StageState = 'pending' | 'ran' | 'skipped' | 'failed';

interface Stage {
  key: string;
  label: string;
  state: StageState;
  detail: string;
}

function BoundAgentPanel({ module, agent: bound }: { module: AiStackModule; agent: AiStackBoundAgent }) {
  const [manifest, setManifest] = useState<AgentManifestRow | null>(null);
  const [manifestError, setManifestError] = useState('');
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<Record<string, string>>(() =>
    Object.fromEntries(bound.filters.map((filter) => [filter.key, filter.key === 'limit' ? '50' : ''])),
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [runError, setRunError] = useState('');

  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [token, setToken] = useState(0);

  // `setLoading(true)` lives here rather than in the effect body. Calling setState
  // synchronously inside an effect triggers a cascading render, and the spinner belongs to
  // the act of asking for a reload, not to the effect that carries it out.
  const reload = useCallback(() => {
    setLoading(true);
    setToken((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const context = readModuleWorkspaceSession();

    // Settled, not all: the manifest, the run log and the approval queue are three reads
    // and one failing must not blank the other two.
    void Promise.allSettled([
      listAgents(context, 'k12'),
      listAgentRuns(context, bound.agentKey, 20),
      listPendingApprovals(context, 50),
    ]).then(([agentList, runList, approvalList]) => {
      if (cancelled) return;

      if (agentList.status === 'fulfilled') {
        const found = (agentList.value.agents ?? []).find(
          (row) => (row as AgentManifestRow).agent_key === bound.agentKey,
        ) as AgentManifestRow | undefined;

        setManifest(found ?? null);
        setManifestError(
          found
            ? ''
            : `No active manifest for ${bound.fallbackName} is registered for your role on this estate. It cannot run until an administrator registers one.`,
        );
      } else {
        setManifestError(
          agentList.reason instanceof Error ? agentList.reason.message : 'The agent registry could not be read.',
        );
      }

      setHistory(runList.status === 'fulfilled' ? (runList.value.runs ?? []) : []);
      setApprovals(
        approvalList.status === 'fulfilled'
          ? (approvalList.value.approvals ?? []).filter((approval) => approval.workflow_key === bound.workflowKey)
          : [],
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token, bound.agentKey, bound.workflowKey, bound.fallbackName]);

  const run = async () => {
    setRunning(true);
    setResult(null);
    setRunError('');

    /** A positive integer, or undefined so the backend applies its own default. */
    const positive = (value: string) => {
      const parsed = Number(value.trim());
      return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
    };

    // Only the filters this manifest actually reads — declared on the descriptor. Offering
    // one it ignores would be a control that silently does nothing.
    const input = Object.fromEntries(
      bound.filters
        .map((filter) => [filter.key, positive(filters[filter.key] ?? '')] as const)
        .filter(([, value]) => value !== undefined),
    );

    try {
      const outcome = await runAgent(readModuleWorkspaceSession(), bound.agentKey, input);

      setResult(outcome);

      logModuleOperation(module, `${module.key}_agent_run`, {
        status: outcome.status === 'completed' ? 'completed' : 'failed',
        message: outcome.summary,
        agentRunId: outcome.run_id === null ? null : String(outcome.run_id),
        result: { status: outcome.status, filters: input, ...outcome.counters },
      });

      reload();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The agent could not be run.';
      setRunError(message);
      // Recorded as a failure rather than swallowed: a run that was refused is a thing the
      // Activity tab should show, and it is the only place the reason survives.
      logModuleOperation(module, `${module.key}_agent_run`, { status: 'failed', message });
    } finally {
      setRunning(false);
    }
  };

  const cases = useMemo<AgentCase[]>(() => {
    const found = result?.result?.cases;

    return Array.isArray(found) ? (found as unknown as AgentCase[]) : [];
  }, [result]);

  const stages = useMemo(
    () => buildStages(bound, result, runError, cases, approvals.length),
    [bound, result, runError, cases, approvals.length],
  );

  const workflowKeys = useMemo(() => {
    const raw = manifest?.authorized_workflow_keys;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') return raw.split(',').map((key) => key.trim()).filter(Boolean);
    return [];
  }, [manifest]);

  return (
    <AiStackCard>
      <AiStackCardHeading
        title={manifest?.name ?? bound.fallbackName}
        hint="The agent this module is bound to, and the same one the chatbot runs. One manifest, one run log, one approval queue."
        actions={
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-slate-50"
          >
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
            Refresh
          </button>
        }
      />

      <div className="space-y-5 p-5">
        {manifestError && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {manifestError}
          </p>
        )}

        {manifest && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start gap-3">
              <span className="mt-0.5 shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-600">
                <Bot size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-950">{manifest.name ?? bound.fallbackName}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{manifest.purpose ?? manifest.description}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-mono">{bound.agentKey}</span>
                  <AiStackPill tone="blue">may {String(manifest.max_verb ?? 'recommend')}</AiStackPill>
                  {/* The single most important fact about an agent, so it is stated rather
                      than left to be inferred from the absence of a button. */}
                  <AiStackPill tone={manifest.may_execute_actions ? 'amber' : 'green'}>
                    {manifest.may_execute_actions ? 'can execute actions' : 'cannot act without a person'}
                  </AiStackPill>
                  {workflowKeys.map((key) => (
                    <span key={key} className="inline-flex items-center gap-1 font-mono">
                      <Workflow size={11} />
                      {key}
                    </span>
                  ))}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {bound.filters.map((filter) => (
                <label key={filter.key} className="block">
                  <span className="text-xs font-medium text-slate-700">{filter.label}</span>
                  <input
                    value={filters[filter.key] ?? ''}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, [filter.key]: event.target.value }))
                    }
                    inputMode="numeric"
                    placeholder={filter.placeholder}
                    className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500"
                  />
                </label>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void run()}
                disabled={running}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <Play className="size-4" />
                {running ? 'Running…' : 'Run agent'}
              </button>

              <p className="text-[11px] leading-4 text-slate-500">
                The institute and academic year come from your session, not from this form. The sweep reports how
                much it actually read, so &quot;nothing found&quot; is never confused with &quot;nothing
                read&quot;.
              </p>
            </div>
          </div>
        )}

        {runError && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            {runError}
          </p>
        )}

        {(result || runError) && <StageTrace stages={stages} />}

        {result && cases.length > 0 && <CaseList cases={cases} />}

        {result && cases.length === 0 && !runError && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            {result.result?.message ?? result.summary}
          </p>
        )}

        <ModuleApprovalQueue moduleLabel={module.label} workflowKey={bound.workflowKey} onChanged={reload} />

        <RunHistory runs={history} agentName={manifest?.name ?? bound.fallbackName} />
      </div>
    </AiStackCard>
  );
}

/**
 * The stages a run actually passed through, derived from what came back.
 *
 * Every state here is read off the result rather than assumed from a successful HTTP
 * status. A run that opened no case reports `skipped` on the stages that depend on one,
 * and a refused recommendation reports the governance reason — so a partly-completed run
 * is never shown as a finished one.
 */
function buildStages(
  bound: AiStackBoundAgent,
  result: AgentRunResult | null,
  runError: string,
  cases: AgentCase[],
  pendingApprovals: number,
): Stage[] {
  if (runError) {
    return [
      { key: 'request', label: 'Your request', state: 'ran', detail: `Sent to ${bound.fallbackName}.` },
      { key: 'agent', label: 'Agent', state: 'failed', detail: runError },
      { key: 'data', label: 'Records', state: 'pending', detail: 'Not reached.' },
    ];
  }

  if (!result) return [];

  const counters = result.counters ?? {
    signals_detected: 0,
    evidence_collected: 0,
    cases_opened: 0,
    recommendations_drafted: 0,
  };

  const withRecommendation = cases.filter((entry) => entry.recommendation?.id);
  const refused = cases.filter((entry) => entry.recommendation && entry.recommendation.governance_passed === false);
  const awaiting = withRecommendation.filter((entry) => entry.recommendation?.status === 'pending_approval');

  return [
    { key: 'request', label: 'Your request', state: 'ran', detail: bound.sweepDescription },
    {
      key: 'agent',
      label: 'Agent',
      state: result.status === 'completed' ? 'ran' : 'failed',
      detail: `${bound.agentKey} finished as ${result.status}.`,
    },
    {
      key: 'data',
      label: 'Real records',
      state: counters.signals_detected > 0 ? 'ran' : 'skipped',
      detail:
        counters.signals_detected > 0
          ? `${counters.signals_detected} signal(s) raised from the school's own records.`
          : 'Nothing in scope met a detector threshold, or too little was recorded to judge.',
    },
    {
      key: 'evidence',
      label: 'Evidence',
      state: counters.evidence_collected > 0 ? 'ran' : 'skipped',
      detail:
        counters.evidence_collected > 0
          ? `${counters.evidence_collected} record(s) stored and cited.`
          : 'Nothing to cite, because nothing was detected.',
    },
    {
      key: 'analysis',
      label: 'Analysis',
      state: counters.cases_opened > 0 ? 'ran' : 'skipped',
      detail:
        counters.cases_opened > 0
          ? `${counters.cases_opened} case(s) opened, each explained from its own cited evidence.`
          : 'No case was warranted at the configured severity.',
    },
    {
      key: 'recommendation',
      label: 'Recommendation',
      state: counters.recommendations_drafted > 0 ? 'ran' : refused.length > 0 ? 'failed' : 'skipped',
      detail:
        counters.recommendations_drafted > 0
          ? `${counters.recommendations_drafted} drafted.${
              refused.length ? ` ${refused.length} refused by governance.` : ''
            }`
          : refused.length > 0
            ? `${refused.length} refused by governance — see the reason on each case below.`
            : 'Nothing to recommend.',
    },
    {
      key: 'approval',
      label: 'Human approval',
      state: awaiting.length > 0 || pendingApprovals > 0 ? 'pending' : 'skipped',
      detail:
        awaiting.length > 0 || pendingApprovals > 0
          ? `Waiting on a person. ${pendingApprovals} approval(s) in the queue below.`
          : 'Nothing is waiting at this gate.',
    },
    {
      key: 'action',
      label: 'Action',
      state: 'pending',
      // Stated plainly, because "pending" on this row is not a delay — it is the design.
      detail: 'This agent may not act. Anything that follows requires a person approving it.',
    },
  ];
}

function StageTrace({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) return null;

  const tone: Record<StageState, string> = {
    ran: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    pending: 'border-amber-200 bg-amber-50 text-amber-900',
    skipped: 'border-slate-200 bg-slate-50 text-slate-600',
    failed: 'border-red-200 bg-red-50 text-red-900',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">What happened</p>
      <ol className="mt-3 space-y-2">
        {stages.map((stage, index) => (
          <li key={stage.key} className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${tone[stage.state]}`}>
            <span className="mt-0.5 shrink-0 text-[11px] font-semibold tabular-nums opacity-60">{index + 1}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                {stage.label}
                <span className="ml-2 text-[11px] font-normal uppercase tracking-wide opacity-70">{stage.state}</span>
              </span>
              <span className="mt-0.5 block text-xs leading-5 opacity-90">{stage.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CaseList({ cases }: { cases: AgentCase[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Cases opened ({cases.length})</p>

      {cases.map((entry) => (
        <div key={entry.case_id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-950">
              {entry.student_name ?? entry.subject_label ?? `Case #${entry.case_id}`}
              <span className="ml-2 text-xs font-normal text-slate-500">
                {[entry.placement?.standard_name, entry.placement?.division_name].filter(Boolean).join(' / ') || '—'}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {entry.severity && <AiStackPill tone={severityTone(entry.severity)}>{entry.severity}</AiStackPill>}
              <span className="font-mono text-[11px] text-slate-500">case #{entry.case_id}</span>
            </div>
          </div>

          {/* Every figure here came from the agent's own result. Nothing is recomputed in
              the browser, so this cannot disagree with the case record. */}
          {entry.signals && entry.signals.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-slate-600">
              {entry.signals.map((signal, index) => (
                <span
                  key={`${entry.case_id}-${signal.signal_key ?? index}`}
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-700"
                >
                  {signal.signal_key ?? 'signal'}
                  {signal.severity ? ` · ${signal.severity}` : ''}
                </span>
              ))}
            </p>
          )}

          {entry.explanation?.narrative && (
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
              {entry.explanation.narrative}
            </p>
          )}

          {entry.explanation?.governance_passed === false && entry.explanation.reason_refused && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-amber-700">
              <TriangleAlert className="mt-0.5 size-3 shrink-0" />
              Explanation refused: {entry.explanation.reason_refused}
            </p>
          )}

          {entry.recommendation && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <ChevronRight className="size-3.5 text-slate-400" />
              <span className="text-slate-700">{entry.recommendation.title ?? 'Recommendation drafted'}</span>
              <AiStackPill tone={entry.recommendation.status === 'pending_approval' ? 'amber' : 'gray'}>
                {entry.recommendation.status ?? 'drafted'}
              </AiStackPill>
              {entry.recommendation.governance_passed === false && entry.recommendation.reason_refused && (
                <span className="text-amber-700">refused: {entry.recommendation.reason_refused}</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RunHistory({ runs, agentName }: { runs: Array<Record<string, unknown>>; agentName: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
        <ShieldCheck className="size-3.5" />
        Recent runs of this agent
      </p>

      {runs.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No run of {agentName} has been recorded for this school yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {runs.slice(0, 10).map((entry, index) => {
            const status = String(entry.status ?? 'unknown');

            return (
              <li key={String(entry.id ?? index)} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <AiStackPill
                  tone={
                    status === 'completed'
                      ? 'green'
                      : status === 'rejected'
                        ? 'amber'
                        : status === 'failed'
                          ? 'red'
                          : 'gray'
                  }
                >
                  {status}
                </AiStackPill>
                <span className="font-mono text-[11px] text-slate-500">
                  {String(entry.run_reference ?? entry.id ?? '')}
                </span>
                <span className="text-slate-400">{formatWhen(String(entry.started_at ?? entry.created_at ?? ''))}</span>
                <span className="min-w-0 truncate">{String(entry.summary ?? entry.error ?? '')}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function severityTone(severity: string): 'red' | 'amber' | 'blue' | 'gray' {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'red';
    case 'high':
      return 'amber';
    case 'moderate':
      return 'blue';
    default:
      return 'gray';
  }
}

// ---------------------------------------------------------------------------
// Tool-agent preset card
// ---------------------------------------------------------------------------

function PresetCard({
  preset,
  agent,
  runs,
  checking,
  busy,
  canCreate,
  canRun,
  onEnable,
  onToggle,
  onRun,
  onShowEso,
}: {
  preset: CreateAgentInput;
  agent: Agent | null;
  runs: AgentRun[];
  checking: boolean;
  busy: boolean;
  canCreate: boolean;
  canRun: boolean;
  onEnable: () => void;
  onToggle: (agent: Agent) => void;
  onRun: (agent: Agent) => void;
  onShowEso?: () => void;
}) {
  const tool = findTool(preset.tools_allowed[0]);
  const lastRun = agent ? (runs.find((run) => run.agent_id === agent.id) ?? null) : null;

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-lg bg-indigo-50 p-2 text-indigo-600">
          <Bot size={18} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-950">{preset.name}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">{preset.description}</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        <span className="font-mono">{tool?.key}</span> ·{' '}
        <span className={tool?.risk === 'read' ? 'text-emerald-700' : 'text-slate-500'}>{tool?.risk} risk</span>
        {tool?.kind === 'mcp' && <> · reads live records</>}
        {agent && (
          <>
            {' '}
            · <span className="font-mono">{agent.id}</span> ·{' '}
            <span
              className={agent.status === 'active' ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}
            >
              {agent.status}
            </span>
          </>
        )}
      </p>

      <div className="mt-auto pt-4">
        {checking ? (
          <span className="text-xs text-slate-400">Checking…</span>
        ) : agent ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onRun(agent)}
              disabled={busy || agent.status !== 'active' || !canRun}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={12} />
              Run
            </button>
            <button
              type="button"
              onClick={() => onToggle(agent)}
              disabled={busy || !canRun}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {agent.status === 'active' ? <Pause size={12} /> : <Play size={12} />}
              {agent.status === 'active' ? 'Pause' : 'Resume'}
            </button>
            {onShowEso && (
              <button
                type="button"
                onClick={onShowEso}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer"
                title="View Executive Skill Object (Knowledge, Activities, Abilities, Usage)"
              >
                <Sparkles size={12} className="text-indigo-600" />
                ESO
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onEnable}
              disabled={busy || !canCreate}
              className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Enabling…' : 'Enable agent'}
            </button>
            {onShowEso && (
              <button
                type="button"
                onClick={onShowEso}
                className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer"
                title="View Executive Skill Object (Knowledge, Activities, Abilities, Usage)"
              >
                <Sparkles size={12} className="text-indigo-600" />
                ESO
              </button>
            )}
          </div>
        )}

        {lastRun && (
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            Last run{' '}
            <span
              className={
                lastRun.status === 'success'
                  ? 'font-semibold text-emerald-600'
                  : lastRun.status === 'denied'
                    ? 'font-semibold text-amber-600'
                    : 'font-semibold text-slate-600'
              }
            >
              {lastRun.status}
            </span>{' '}
            ·{' '}
            {new Date(lastRun.started_at).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            by {lastRun.acting_user_name || lastRun.acting_user_id}
            {lastRun.error && <span className="mt-0.5 block text-amber-700">{lastRun.error}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
