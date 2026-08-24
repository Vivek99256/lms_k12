/**
 * End-to-end orchestration tests for the shared conversational workflow.
 *
 * The adapter here stands in for a project adapter (LMS_K12 in production) and
 * its tools return rows in exactly the shape the real LMS tools return, so the
 * assertions verify the orchestration: context retention between tool calls,
 * selection resolution, and the module handoff. No production code path is
 * mocked — `generateConversationResponse` runs for real.
 */

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtempSync, rmSync } from "node:fs";

import { z } from "zod";
import { generateConversationResponse } from "./conversation";
import { detectConversationLanguage } from "./context";
import type { ConversationIntent, ConversationMessage } from "./schemas";
import type { ProjectAIAdapter, ProjectToolDefinition } from "./types";

// The file store reads this on every operation, so setting it here keeps all
// workflow state written by these tests inside a throwaway directory.
process.env.CONVERSATIONAL_AI_STATE_DIR = mkdtempSync(
  path.join(os.tmpdir(), "conversational-ai-flow-")
);

const FEE_DEFAULTER_ROWS = [
  { id: "10", studentName: "EVAAN RAJESH RAFALIYA", standard: "7", division: "C", enrollmentNo: "10", pendingFees: 8000 },
  { id: "102", studentName: "GREEVA RAJESH RAFALIYA", standard: "7", division: "A", enrollmentNo: "102", pendingFees: 6500 },
  { id: "664", studentName: "komal H vala", standard: "7", division: "A", enrollmentNo: "664", pendingFees: 4000 },
  { id: "233", studentName: "Zeel J Tank", standard: "7", division: "C", enrollmentNo: "233", pendingFees: 12500 },
  { id: "100234", studentName: "Sonika P Pansuriya", standard: "7", division: "C", enrollmentNo: "100234", pendingFees: 2000 },
];

const HOMEWORK_ROWS = [
  {
    id: 91,
    title: "Algebra worksheet 3",
    student_name: "Zeel J Tank",
    standard_id: 7,
    standard_name: "Standard 7",
    division_id: 3,
    division_name: "C",
    subject_id: 12,
    subject_name: "Maths",
    date: "2026-08-10",
  },
  {
    id: 92,
    title: "Science reading log",
    student_name: "komal H vala",
    standard_id: 7,
    standard_name: "Standard 7",
    division_id: 2,
    division_name: "A",
    subject_id: 14,
    subject_name: "Science",
    date: "2026-08-10",
  },
];

const ADMISSION_ENQUIRY_ROWS = [
  { id: "41", enquiryNo: "ENQ-2026-0041", studentName: "Aarav Sharma", standard: "5", status: "New", mobile: "9000000001" },
  { id: "42", enquiryNo: "ENQ-2026-0042", studentName: "Diya Mehta", standard: "6", status: "New", mobile: "9000000002" },
];

interface TestHarness {
  adapter: ProjectAIAdapter;
  calls: Array<{ tool: string; input: Record<string, unknown> }>;
  setIntent: (intent: Partial<ConversationIntent>) => void;
}

function createHarness(): TestHarness {
  const calls: Array<{ tool: string; input: Record<string, unknown> }> = [];
  let nextIntent: ConversationIntent = {
    type: "ask",
    domain: "k12",
    capability: "unpaid_fees",
    entities: {},
    confidence: 0.9,
    requiresConfirmation: false,
    suggestedTool: "listFeesDefaulters",
  };

  const record = (tool: string, input: Record<string, unknown>) => {
    calls.push({ tool, input });
  };

  const tools: ProjectToolDefinition[] = [
    {
      name: "listFeesDefaulters",
      description: "Fees defaulter report",
      inputSchema: z.object({
        standard: z.string().optional(),
        division: z.string().optional(),
      }),
      requiredPermissions: [],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["fees"],
      async execute(input: Record<string, unknown>) {
        record("listFeesDefaulters", input);
        return {
          source: "lms_backend",
          students: FEE_DEFAULTER_ROWS,
          totalCount: FEE_DEFAULTER_ROWS.length,
        };
      },
    },
    {
      name: "findStudentFeeRecord",
      description: "Fee collection student lookup",
      inputSchema: z.object({
        studentName: z.string().optional(),
        standard: z.string().optional(),
        division: z.string().optional(),
        enrollmentNo: z.string().optional(),
        rollNo: z.string().optional(),
        mobileNo: z.string().optional(),
      }),
      requiredPermissions: [],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["fee_collection"],
      async execute(input: Record<string, unknown>) {
        record("findStudentFeeRecord", input);
        const students = FEE_DEFAULTER_ROWS.filter((row) => {
          if (
            typeof input.studentName === "string" &&
            input.studentName &&
            !row.studentName.toLowerCase().includes(input.studentName.toLowerCase())
          ) {
            return false;
          }
          if (
            typeof input.enrollmentNo === "string" &&
            input.enrollmentNo &&
            row.enrollmentNo !== input.enrollmentNo
          ) {
            return false;
          }
          return true;
        });
        return { source: "lms_backend", students, totalCount: students.length };
      },
    },
    {
      name: "listHomework",
      description: "Homework list",
      inputSchema: z.object({
        standard: z.string().optional(),
        division: z.string().optional(),
        subject: z.string().optional(),
        grade: z.string().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      requiredPermissions: [],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["homework"],
      async execute(input: Record<string, unknown>) {
        record("listHomework", input);
        return { status: 1, data: HOMEWORK_ROWS, count: HOMEWORK_ROWS.length };
      },
    },
    {
      name: "listAdmissionEnquiries",
      description: "Admission enquiries",
      inputSchema: z.object({ onlyPending: z.boolean().optional() }),
      requiredPermissions: [],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["admission_enquiries"],
      async execute(input: Record<string, unknown>) {
        record("listAdmissionEnquiries", input);
        return {
          source: "lms_backend",
          total: ADMISSION_ENQUIRY_ROWS.length,
          normalized: {
            filteredCount: ADMISSION_ENQUIRY_ROWS.length,
            filteredEnquiries: ADMISSION_ENQUIRY_ROWS,
            filteredHighlights: ADMISSION_ENQUIRY_ROWS.map(
              (row) => `${row.studentName} for Grade ${row.standard} — Status: ${row.status}`
            ),
          },
        };
      },
    },
    {
      name: "findAdmissionCandidate",
      description: "Admission candidate lookup",
      inputSchema: z.object({
        studentName: z.string().optional(),
        enquiryNo: z.string().optional(),
        standard: z.string().optional(),
        mobileNo: z.string().optional(),
        onlyPending: z.boolean().optional(),
      }),
      requiredPermissions: [],
      riskLevel: "low",
      requiresConfirmation: false,
      capabilities: ["admission_confirmation"],
      async execute(input: Record<string, unknown>) {
        record("findAdmissionCandidate", input);
        const matches = ADMISSION_ENQUIRY_ROWS.filter((row) =>
          typeof input.studentName === "string" && input.studentName
            ? row.studentName.toLowerCase().includes(input.studentName.toLowerCase())
            : true
        ).map((row) => ({
          id: row.id,
          enquiryId: row.id,
          enquiryNo: row.enquiryNo,
          studentName: row.studentName,
          standard: row.standard,
          registrationId: `reg-${row.id}`,
          canConfirm: true,
          readiness: "ready",
          missingFields: [],
          missingSlots: [],
        }));
        return { source: "lms_backend", candidates: matches, totalCount: matches.length };
      },
    },
  ];

  const adapter: ProjectAIAdapter = {
    projectId: "test_project",
    projectName: "Test Project",
    async resolveContext({ request, trustedContext }) {
      const latestUserMessage = [...request.messages]
        .reverse()
        .find((message) => message.role === "user") as ConversationMessage;
      return {
        projectId: "test_project",
        projectName: "Test Project",
        conversationId: trustedContext.conversationId,
        userId: trustedContext.userId,
        request,
        latestUserMessage,
        messageHistory: request.messages,
        detectedLanguage: detectConversationLanguage(latestUserMessage.content),
      };
    },
    async classifyIntent() {
      return nextIntent;
    },
    async buildSystemPrompt() {
      return "test";
    },
    async getToolDefinitions() {
      return tools;
    },
    async getAllowedToolNames() {
      return tools.map((tool) => tool.name);
    },
    async validatePermission() {},
  };

  return {
    adapter,
    calls,
    setIntent(intent) {
      nextIntent = { ...nextIntent, ...intent } as ConversationIntent;
    },
  };
}

function buildRequest(conversationId: string, messages: ConversationMessage[]) {
  return {
    messages,
    responseMode: "json" as const,
    context: { conversationId, userId: `user-${conversationId}` },
  };
}

test("fees: list -> select by displayed value -> redirect with the resolved record", async (t) => {
  const conversationId = "fees-flow";
  const harness = createHarness();
  const history: ConversationMessage[] = [];

  const say = async (content: string) => {
    history.push({ role: "user", content });
    const response = await generateConversationResponse(
      harness.adapter,
      buildRequest(conversationId, [...history]),
      []
    );
    history.push({ role: "assistant", content: response.message });
    return response;
  };

  // 1. "How many students have pending fees?"
  harness.setIntent({ capability: "unpaid_fees", suggestedTool: "listFeesDefaulters" });
  const listed = await say("How many students have pending fees?");
  assert.match(listed.message, /5 students with pending fees/i);

  // 2. "yes" -> the assistant offers the real rows to choose from.
  harness.setIntent({ capability: "fee_collection", suggestedTool: "findStudentFeeRecord" });
  const selection = await say("yes");
  assert.equal(selection.status, "requires_input");
  assert.match(selection.message, /4\. Zeel J Tank/);

  // 3. The reported failure: selecting an already-listed record must not ask for
  //    the student's name again.
  const resolved = await say("Zeel J Tank, 7, 233");

  assert.doesNotMatch(resolved.message, /share the student's full name/i);
  assert.equal(resolved.status, "navigation_required");
  assert.equal(resolved.navigation?.route, "/fees/collect/233");

  const lookup = harness.calls.filter((call) => call.tool === "findStudentFeeRecord").at(-1);
  assert.equal(lookup?.input.studentName, "Zeel J Tank");
  assert.equal(lookup?.input.enrollmentNo, "233");
  assert.equal(lookup?.input.standard, "7");

  const record = (resolved.data as { record?: Record<string, unknown> })?.record;
  assert.equal(record?.studentId, "233");
  assert.equal(record?.studentName, "Zeel J Tank");
  t.diagnostic(`tools called: ${harness.calls.map((call) => call.tool).join(" -> ")}`);
});

test("fees: selecting by list number resolves the same backend record", async () => {
  const conversationId = "fees-number";
  const harness = createHarness();
  const history: ConversationMessage[] = [];

  const say = async (content: string) => {
    history.push({ role: "user", content });
    const response = await generateConversationResponse(
      harness.adapter,
      buildRequest(conversationId, [...history]),
      []
    );
    history.push({ role: "assistant", content: response.message });
    return response;
  };

  harness.setIntent({ capability: "unpaid_fees", suggestedTool: "listFeesDefaulters" });
  await say("Which students have pending fees?");

  harness.setIntent({ capability: "fee_collection", suggestedTool: "findStudentFeeRecord" });
  const resolved = await say("4");

  assert.equal(resolved.status, "navigation_required");
  assert.equal(resolved.navigation?.route, "/fees/collect/233");
});

test("fees: an unmatched selection asks again without restarting the search", async () => {
  const conversationId = "fees-unmatched";
  const harness = createHarness();
  const history: ConversationMessage[] = [];

  const say = async (content: string) => {
    history.push({ role: "user", content });
    const response = await generateConversationResponse(
      harness.adapter,
      buildRequest(conversationId, [...history]),
      []
    );
    history.push({ role: "assistant", content: response.message });
    return response;
  };

  harness.setIntent({ capability: "unpaid_fees", suggestedTool: "listFeesDefaulters" });
  await say("Which students have pending fees?");

  harness.setIntent({ capability: "fee_collection", suggestedTool: "findStudentFeeRecord" });
  const response = await say("Ramesh Patel");

  assert.equal(response.status, "requires_input");
  assert.match(response.message, /couldn't match that selection/i);
  assert.equal(
    harness.calls.filter((call) => call.tool === "findStudentFeeRecord").length,
    0,
    "the workflow must not restart the student search"
  );
});

test("homework: list -> select -> redirect to the homework report with the record", async () => {
  const conversationId = "homework-flow";
  const harness = createHarness();
  const history: ConversationMessage[] = [];

  const say = async (content: string) => {
    history.push({ role: "user", content });
    const response = await generateConversationResponse(
      harness.adapter,
      buildRequest(conversationId, [...history]),
      []
    );
    history.push({ role: "assistant", content: response.message });
    return response;
  };

  harness.setIntent({ capability: "homework", suggestedTool: "listHomework" });
  const listed = await say("Show pending homework");
  assert.match(listed.message, /1\. Algebra worksheet 3/);

  const resolved = await say("2");
  assert.equal(resolved.status, "navigation_required");
  assert.equal(resolved.navigation?.route, "/lms/homework/report");
  assert.equal(resolved.navigation?.query?.homework_id, "92");
  assert.equal(resolved.navigation?.query?.subject_id, "14");
});

test("admissions: the existing list -> candidate flow keeps its context", async () => {
  const conversationId = "admissions-flow";
  const harness = createHarness();
  const history: ConversationMessage[] = [];

  const say = async (content: string) => {
    history.push({ role: "user", content });
    const response = await generateConversationResponse(
      harness.adapter,
      buildRequest(conversationId, [...history]),
      []
    );
    history.push({ role: "assistant", content: response.message });
    return response;
  };

  harness.setIntent({
    capability: "pending_admissions",
    suggestedTool: "listAdmissionEnquiries",
  });
  const listed = await say("Show pending admissions");
  assert.match(listed.message, /admission application/i);

  harness.setIntent({
    capability: "admission_confirmation",
    suggestedTool: "findAdmissionCandidate",
  });
  const resolved = await say("Diya Mehta, 6, ENQ-2026-0042");

  const lookup = harness.calls.filter((call) => call.tool === "findAdmissionCandidate").at(-1);
  assert.equal(lookup?.input.studentName, "Diya Mehta");
  assert.equal(lookup?.input.enquiryNo, "ENQ-2026-0042");
  assert.equal(resolved.status, "navigation_required");
  assert.equal(resolved.navigation?.route, "/admissions/confirmation");
});

test.after(() => {
  rmSync(process.env.CONVERSATIONAL_AI_STATE_DIR as string, {
    recursive: true,
    force: true,
  });
});
