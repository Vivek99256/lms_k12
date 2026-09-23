/**
 * What an operator can actually configure on the AI Stack Automations tab.
 *
 * Reads the frontend agent catalogue directly — the same module list, tool list and
 * validator the Create Agent form and the create endpoint use — and reports, per module:
 * which tools it offers, what risk each carries, and whether a cross-module allow-list is
 * refused by the validator rather than merely absent from a dropdown.
 *
 * The distinction matters. A dropdown that does not offer a tool is a convenience; a
 * validator that refuses it is the control. `validateToolsForModule` runs server-side on
 * create, so what it returns here is what an operator posting a hand-built payload would
 * get.
 *
 *   npx tsx scripts/check-agent-catalogue.ts
 *
 * Read-only: it imports the registry and calls pure functions. Nothing is written and no
 * agent is created.
 */

import {
  AGENT_MODULES,
  AGENT_TOOLS,
  findModule,
  isKnownModule,
  rbacModuleKey,
  toolsForModule,
  validateToolsForModule,
} from '@/lib/agents/registry';
import type { AgentModuleKey } from '@/lib/agents/types';
import { COMPLAINT_AI_STACK } from '@/lib/complaint/complaint-ai-stack';
import { INSTITUTE_AI_STACK } from '@/lib/institute/institute-ai-stack';
import { LIBRARY_AI_STACK } from '@/lib/library/library-ai-stack';
import { LMS_AI_STACK } from '@/lib/lms-ai/lms-ai-stack';
import { PARENT_COMMUNICATION_AI_STACK } from '@/lib/parent-communication/parent-communication-ai-stack';
import { SQAA_AI_STACK } from '@/lib/sqaa/sqaa-ai-stack';
import { USERS_AI_STACK } from '@/lib/users/users-ai-stack';
import { CONSENT_AI_STACK } from '@/lib/consent/consent-ai-stack';
import { DOCUMENT_TEMPLATES_AI_STACK } from '@/lib/document-templates/document-templates-ai-stack';
import { FRONT_DESK_AI_STACK } from '@/lib/front-desk/front-desk-ai-stack';
import { INVENTORY_AI_STACK } from '@/lib/inventory/inventory-ai-stack';
import { TASK_MANAGEMENT_AI_STACK } from '@/lib/task-management/task-management-ai-stack';
import { UTILITY_AI_STACK } from '@/lib/utility/utility-ai-stack';
import { INWARD_AI_STACK } from '@/lib/inward/inward-ai-stack';
import { PETTY_CASH_AI_STACK } from '@/lib/petty-cash/petty-cash-ai-stack';
import { TRANSPORT_AI_STACK } from '@/lib/transport/transport-ai-stack';
import { USER_ICARD_AI_STACK } from '@/lib/user-icard/user-icard-ai-stack';
import { VISITOR_AI_STACK } from '@/lib/visitor/visitor-ai-stack';

/** The modules whose AI Stacks were added on 2026-09-24 and 2026-09-25. */
const RECENT: AgentModuleKey[] = [
  'inward_outward',
  'user_icard',
  'petty_cash',
  'consent',
  'visitor_management',
  'transportation',
  'inventory',
  'front_desk',
  'task_management',
  'complaint',
  // The Utility module. Keyed `migration-modules` because that row owns `/Utility/**`.
  'migration-modules',
  'document-templates',
  // Added 2026-09-26, completing the ERP menu.
  'parent_communication',
  'sqaa',
  'user',
  'library',
  'lms',
  'institute',
];

console.log(`Agent catalogue: ${AGENT_MODULES.length} modules, ${AGENT_TOOLS.length} tools\n`);

for (const key of RECENT) {
  // Not named `module`: Next.js forbids assigning that identifier, even in a script it
  // never bundles.
  const declared = findModule(key);
  const own = toolsForModule(key).filter((tool) => tool.module === key);

  const byRisk = own.reduce<Record<string, number>>(
    (acc, tool) => ({ ...acc, [tool.risk]: (acc[tool.risk] ?? 0) + 1 }),
    {},
  );

  console.log(
    `${key.padEnd(20)} known=${String(isKnownModule(key)).padEnd(5)} ` +
      `rbac=${rbacModuleKey(key).padEnd(27)} ${JSON.stringify(byRisk)}  ${declared?.label ?? '?'}`,
  );

  for (const tool of own) {
    console.log(`    ${tool.key.padEnd(34)} ${tool.risk.padEnd(6)} ${tool.kind}`);
  }
}

const writes = AGENT_TOOLS.filter(
  (tool) => RECENT.includes(tool.module as AgentModuleKey) && tool.risk === 'write',
);

console.log(`\nWrite tools across these six modules: ${writes.length === 0 ? 'none' : writes.map((t) => t.key).join(', ')}`);

console.log('\nCross-module allow-lists, as the create endpoint would answer them:\n');

// Each pair is a plausible mistake rather than an arbitrary one: a consent question that
// wants the child's medical file, a petty cash question that wants fee records, a gate
// question that wants the hostel's separate visitor register, and the two identity-card
// modules reaching for each other.
const crossings: Array<[AgentModuleKey, string]> = [
  ['consent', 'student_medical.visits'],
  ['petty_cash', 'fees.arrears'],
  ['visitor_management', 'hostel.occupancy'],
  ['transportation', 'user_icard.roster'],
  ['user_icard', 'student_icard.roster'],
  ['student_icard', 'user_icard.roster'],
  ['inward_outward', 'transport.routes'],
  ['inventory', 'front_desk.visits'],
  ['front_desk', 'tasks.list'],
  ['task_management', 'utility.custom_modules'],
  ['complaint', 'doc_templates.list'],
  ['migration-modules', 'inventory.items'],
  ['document-templates', 'complaints.list'],
  // The two modules over the same staff table, and the two message directions.
  ['user', 'user_icard.roster'],
  ['user_icard', 'user_accounts.directory'],
  ['parent_communication', 'communication.messages'],
  ['easy_com', 'parent_communication.messages'],
  ['library', 'sqaa.evidence'],
  ['sqaa', 'library.circulation'],
];

let allowed = 0;

for (const [module, tool] of crossings) {
  const error = validateToolsForModule(module, [tool]);

  if (error === null) {
    allowed += 1;
  }

  console.log(`    ${module.padEnd(20)} + ${tool.padEnd(28)} -> ${error ?? 'ALLOWED — this is a leak'}`);
}

console.log(`\n${allowed === 0 ? 'PASS' : 'FAIL'}: ${crossings.length - allowed}/${crossings.length} cross-module allow-lists refused.`);

/*
 * The other half: every preset button on an Automations tab must submit something the
 * server accepts.
 *
 * A preset is exactly the `CreateAgentInput` the Create Agent form would post, so a tool
 * named in one that is not in that module's catalogue is a button that fails when somebody
 * clicks it — and it fails for a reason that reads like a permissions problem rather than
 * like a typo. Running the descriptors through the same validator catches it here instead.
 */
console.log('\nPreset agents on each module’s Automations tab:\n');

const descriptors = [
  INWARD_AI_STACK,
  USER_ICARD_AI_STACK,
  PETTY_CASH_AI_STACK,
  CONSENT_AI_STACK,
  VISITOR_AI_STACK,
  TRANSPORT_AI_STACK,
  INVENTORY_AI_STACK,
  FRONT_DESK_AI_STACK,
  TASK_MANAGEMENT_AI_STACK,
  COMPLAINT_AI_STACK,
  UTILITY_AI_STACK,
  DOCUMENT_TEMPLATES_AI_STACK,
  PARENT_COMMUNICATION_AI_STACK,
  SQAA_AI_STACK,
  USERS_AI_STACK,
  LIBRARY_AI_STACK,
  LMS_AI_STACK,
  INSTITUTE_AI_STACK,
];

let brokenPresets = 0;

for (const descriptor of descriptors) {
  for (const preset of descriptor.presets) {
    const error = validateToolsForModule(preset.module as AgentModuleKey, preset.tools_allowed);

    if (error !== null) {
      brokenPresets += 1;
    }

    // The descriptor's own key must match what the preset declares, or the preset would
    // be filed against a different module than the tab it appears on.
    const mismatched = preset.module !== descriptor.key;

    if (mismatched) {
      brokenPresets += 1;
    }

    console.log(
      `    ${descriptor.key.padEnd(20)} ${preset.name.padEnd(28)} ` +
        `[${preset.tools_allowed.join(', ')}] -> ${error ?? (mismatched ? `module mismatch: ${preset.module}` : 'ok')}`,
    );
  }
}

console.log(`\n${brokenPresets === 0 ? 'PASS' : 'FAIL'}: ${brokenPresets} preset(s) the server would refuse.`);

process.exit(allowed === 0 && brokenPresets === 0 ? 0 : 1);
