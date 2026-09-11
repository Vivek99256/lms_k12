/**
 * The AI & Intelligence capability registry — one description of each capability,
 * shared by every product that consumes it.
 *
 * WHY THIS FILE EXISTS
 *
 * The twelve AI & Intelligence entries were a hard-coded array of labels in
 * `app/components/Header.tsx` and a second hard-coded map of routes beside it.
 * Ten of the twelve pointed at `/general/coming-soon?module=<label>`, a bespoke
 * placeholder that reads its title from the query string. So the menu knew a
 * name and nothing else: not what the capability is for, not whether it is
 * built, not which products it serves. Nothing else in the codebase could ask.
 *
 * That is the thing standing between these menus and being shared. A menu that
 * is a list of strings can only ever be copied into the next product; a menu
 * that is a list of records can be imported. This file is that list of records,
 * and it lives in `packages/` rather than `lib/` for exactly that reason —
 * G2G and Enterprise Brain can depend on it, and neither can depend on
 * `lms_k12/app`.
 *
 * THE PATTERN IS NOT NEW
 *
 * Conversational AI — one of the twelve — is already centralised this way:
 * `packages/conversational-ai-core` holds the runtime, `lib/ai/project-resolver.ts`
 * registers all three products, `/api/conversational-ai/projects/[id]/settings`
 * holds each product's configuration, and `/api/conversational-ai/projects/[id]/token`
 * issues the service token an external product presents. It works, and it is in
 * production. This registry generalises that one proven case to the other eleven
 * rather than proposing a second architecture beside it.
 *
 * STATUS IS BORROWED, NEVER RESTATED
 *
 * Where a capability has a row in `lib/roadmap/registry.ts`, `roadmapId` names
 * it and `lib/ai/ai-capabilities.test.ts` asserts the two agree. The roadmap
 * registry stays the single source of truth for what is delivered, so this file
 * cannot quietly tell a customer something different from Platform Administration.
 * Five capabilities have no roadmap row yet — see `roadmapId` on each — which is a
 * real gap in the roadmap rather than a licence for this file to invent one.
 */

import type { SolutionId } from './solutions';

/**
 * What state a capability is in.
 *
 * Deliberately the same three words `RoadmapStatus` uses, minus `pilot`, which no
 * AI capability is in. Never mark something `coming-soon` that already works —
 * a construction notice on a live screen is the one mistake this product has
 * made repeatedly, and it reads as broken rather than as planned.
 */
export type CapabilityStatus = 'live' | 'in-progress' | 'coming-soon';

/** Whether a product consumes this capability today. */
export type ConsumptionState = 'yes' | 'partial' | 'no';

export interface SolutionConsumption {
  /** Whether this product uses the capability today, not whether it should. */
  today: ConsumptionState;
  /** What this product asks the capability for, in one sentence. */
  use: string;
}

export interface AiCapability {
  /** Stable dotted id. Screens and tests reference this, never the name. */
  id: string;
  /** URL segment under `/ai/`. Lowercase, hyphenated, stable — it gets bookmarked. */
  slug: string;
  /** The menu label, exactly as it reads in the header today. */
  name: string;
  /** What the capability is for. One sentence, sentence case. */
  purpose: string;
  /** Why it has to be one shared service instead of three implementations. */
  whyCentral: string;
  /** What LMS K-12 does about this today — the current source of truth. */
  todayInK12: string;
  /** What has to be built or moved before another product can call it. */
  toCentralise: readonly string[];
  /** What the platform gains once it is shared. */
  afterCentralisation: readonly string[];
  status: CapabilityStatus;
  /** The row in `lib/roadmap/registry.ts`, where one exists. */
  roadmapId?: string;
  /**
   * The working screen, for capabilities that have one. Capabilities without a
   * screen are rendered by the shared console at `/ai/<slug>`.
   */
  href?: string;
  solutions: Record<SolutionId, SolutionConsumption>;
}

/**
 * The twelve capabilities, in the order the menu lists them.
 *
 * Registry order is the running order — the menu, the console index and the
 * roadmap all read it, so re-ordering here re-orders every surface at once and
 * nothing sorts at render time behind anyone's back.
 */
export const AI_CAPABILITIES: readonly AiCapability[] = [
  {
    id: 'ai.providers',
    slug: 'providers',
    name: 'AI Providers',
    purpose:
      'The vendor accounts the platform is allowed to call, their credentials, endpoints and health.',
    whyCentral:
      'A key held in three codebases is rotated in three places and leaked from three places. One account, one rotation, one bill.',
    todayInK12:
      'Live at /ai/providers. Each AI module is bound to a provider, model and credential in ai_api_keys, and the runtime resolves that binding per call. Credentials are write-only: the screen shows a masked preview, never the key.',
    toCentralise: [
      'A provider record store: vendor, endpoint, region, credential reference, enabled solutions.',
      'A resolver that hands a caller a ready client and never the credential itself.',
      'A health and quota probe, so a dead key is visible before a user meets it as a broken answer.',
    ],
    afterCentralisation: [
      'Rotate a credential once and all three products follow on their next call.',
      'A provider can be allowed for one product and withheld from another.',
      'No product ships a vendor SDK or a vendor key of its own.',
    ],
    status: 'live',
    roadmapId: 'ai.gateway',
    solutions: {
      lms_k12: {
        today: 'yes',
        use: 'Conversational AI, Generative AI and agent planning resolve provider, model and key from the central configuration on every call.',
      },
      g2g: {
        today: 'no',
        use: 'Would call the shared endpoint with a service token and hold no vendor credential at all.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Same service-token path, so agent runs and signal scoring bill to the one platform account.',
      },
    },
  },

  {
    id: 'ai.models',
    slug: 'models',
    name: 'Model Management',
    purpose:
      'Which models exist, what each is approved for, and which one a given capability gets by default.',
    whyCentral:
      'The architecture review already ruled that model management stays central and must never be re-implemented inside a module. Three model catalogues would mean a model retired in one product still serving traffic in another.',
    todayInK12:
      'Live at /ai/models. The ai_models catalogue is the one list every model dropdown reads, seeded from config/ai.php so nothing that worked before it existed stopped. Platform rows are shared estate-wide; a school may add its own.',
    toCentralise: [
      'A model catalogue keyed by provider, with capability, context window, cost and deprecation date.',
      'Default and fallback selection per capability, not per product.',
      'A pinning rule, so a product can hold a version while another moves ahead.',
    ],
    afterCentralisation: [
      'Retire or swap a model once; every product picks up the change on its next request.',
      'A fallback chain absorbs a provider outage without a code change anywhere.',
      'Cost per capability becomes answerable, because the model behind it is known.',
    ],
    status: 'live',
    roadmapId: 'ai.gateway',
    solutions: {
      lms_k12: {
        today: 'yes',
        use: 'Model choice is a catalogue row an administrator can read and change, not a constant in config or code.',
      },
      g2g: {
        today: 'no',
        use: 'Would name a capability and receive whatever model the catalogue currently designates for it.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Same, and can pin a model for long-running agents that must not change behaviour mid-programme.',
      },
    },
  },

  {
    id: 'ai.prompts',
    slug: 'prompts',
    name: 'Prompt Management',
    purpose:
      'Versioned prompt templates and their variables, owned centrally rather than pasted into each caller.',
    whyCentral:
      'The same architecture review that centralised models centralised prompts. A prompt copied into three codebases is three prompts the moment one is improved, and the improvement never reaches the other two.',
    todayInK12:
      'Prompts live inline in the code and in the Laravel lifecycle. There is no place to see them all, diff them, or roll one back.',
    toCentralise: [
      'A template store with named variables, versions and an active pointer per capability.',
      'Render-time variable binding, so a caller supplies data and never prompt text.',
      'A rollback path, because a bad prompt reaches every product at once once this is shared.',
    ],
    afterCentralisation: [
      'Improve a prompt once and all three products get the better answer.',
      'A regression is rolled back in one place instead of three deploys.',
      'Prompts become reviewable content rather than string literals buried in handlers.',
    ],
    status: 'coming-soon',
    roadmapId: 'ai.gateway',
    solutions: {
      lms_k12: {
        today: 'partial',
        use: 'Owns its prompts inline; would keep authoring them but store them centrally.',
      },
      g2g: {
        today: 'no',
        use: 'Would supply its own competency variables against shared templates rather than write prompts.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Would bind agent and deliberation templates the same way, versioned with the rest.',
      },
    },
  },

  {
    id: 'ai.policies',
    slug: 'policies',
    name: 'AI Policies',
    purpose:
      'What the AI is permitted to do: data handling, redaction, tool limits, and when a human must approve.',
    whyCentral:
      'A policy that only one product enforces is not a policy. Every product touches the same tenants and the same students, so the rule has to sit where no caller can route around it.',
    todayInK12:
      'The guard contracts in packages/conversational-ai-core/src/security.ts cover prompt injection and tool execution. Fees has four module-scoped policy switches, shown locked — deliberately a subset, with engine-level policy left central.',
    toCentralise: [
      'A policy document per tenant: residency, retention, redaction, and the human-approval threshold.',
      'Enforcement in the shared runtime, before a tool runs, rather than in each caller.',
      'A module-scoped overlay so a product can tighten a rule but never loosen it.',
    ],
    afterCentralisation: [
      'One place answers "what is this school allowed to send to a model".',
      'A tightened rule takes effect everywhere at once, including in products that did not ship a change.',
      'The module-scoped switches Fees already shows become real, backed by the central document.',
    ],
    status: 'coming-soon',
    solutions: {
      lms_k12: {
        today: 'partial',
        use: 'Enforces the shared security guards; module policy toggles are designed but locked.',
      },
      g2g: {
        today: 'no',
        use: 'Would inherit the tenant policy unchanged and add its own tighter limits where its data warrants.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Needs it most: agents act without a human in the loop, so the approval threshold is what bounds them.',
      },
    },
  },

  {
    id: 'ai.agents',
    slug: 'agents',
    name: 'Agent Management',
    purpose: 'The library of agents, what each may do, and the record of what it did.',
    whyCentral:
      'This one is already decided. The agent library migrates from G2G to a shared service hosted beside Enterprise Brain’s automation layer; existing agents move across carrying module=‘g2g’ so nothing in flight breaks, and K-12 becomes the second caller.',
    todayInK12:
      'The library screen is live at /enterprise-brain/automation/agents and carries a note saying it is becoming a shared service and that agents built there keep running unchanged.',
    toCentralise: [
      'Move the library out of G2G into the shared service, keeping every agent’s module tag.',
      'Scope each agent run by the calling product’s permissions rather than the library’s own.',
      'One run history, filterable by product, so an agent’s behaviour is legible across all three.',
    ],
    afterCentralisation: [
      'An agent is built once and offered to any product, under that product’s permissions.',
      'Agents in flight keep running through the migration — the stated commitment to customers.',
      'A misbehaving agent is disabled once, everywhere.',
    ],
    status: 'in-progress',
    roadmapId: 'ai.agentic-library',
    href: '/enterprise-brain/automation/agents',
    solutions: {
      lms_k12: {
        today: 'partial',
        use: 'Reads the library through Enterprise Brain; becomes a first-class caller after the migration.',
      },
      g2g: {
        today: 'yes',
        use: 'Owns the library today. Contributes it to the shared service and stays a consumer.',
      },
      enterprise_brain: {
        today: 'yes',
        use: 'Hosts the shared service beside its automation layer and runs agents against organisation data.',
      },
    },
  },

  {
    id: 'ai.conversational',
    slug: 'conversational-ai',
    name: 'Conversational AI',
    purpose:
      'One assistant runtime that knows which product and which module the question came from.',
    whyCentral:
      'It already is — this is the worked example the other eleven follow. All three products are registered adapters, they identify themselves with x-project-id, and an unknown id is an error rather than a silent fall back to LMS data.',
    todayInK12:
      'Live. packages/conversational-ai-core holds the runtime, lib/ai/project-resolver.ts registers all three products, and the admin screen at /enterprise-brain/automation/conversational-ai shows each adapter, its channel settings and its service token.',
    toCentralise: [
      'Nothing structural. G2G and Enterprise Brain are registered but marked implemented: false until their adapter modules land.',
      'Each needs lib/ai/adapters/<id>/adapter.ts and its discovery sources wired.',
    ],
    afterCentralisation: [
      'One assistant, three products, each answering in its own context and permissions.',
      'A new product is an adapter file and a registration, not a second assistant.',
    ],
    status: 'live',
    roadmapId: 'ai.conversational',
    href: '/enterprise-brain/automation/conversational-ai',
    solutions: {
      lms_k12: {
        today: 'yes',
        use: 'Hosts the runtime and the ask/stream proxy; the assistant panel belongs to it.',
      },
      g2g: {
        today: 'partial',
        use: 'Registered as an external adapter with channel settings and a service token; adapter module still to land.',
      },
      enterprise_brain: {
        today: 'partial',
        use: 'Same — declared and configurable, not yet implemented on this branch.',
      },
    },
  },

  {
    id: 'ai.knowledge-rag',
    slug: 'knowledge-rag',
    name: 'Knowledge & RAG',
    purpose:
      'The documents each product can ground an answer in, and the retrieval that finds the right passage.',
    whyCentral:
      'Ingestion, chunking and embedding are expensive and identical everywhere. What differs is only which corpus a tenant may read — which is an access rule, not a reason for three pipelines.',
    todayInK12:
      'Enterprise Brain carries the knowledge screens (library, ESO library, memory, KASBA). There is no shared ingestion contract and no roadmap row.',
    toCentralise: [
      'One ingestion pipeline: source, chunking, embedding, refresh schedule.',
      'Corpora scoped by tenant and by product, so retrieval cannot cross a boundary.',
      'A retrieval contract the runtime calls, so a caller asks a question and never runs a search.',
    ],
    afterCentralisation: [
      'A document is ingested once and grounds answers in whichever product may see it.',
      'Embedding cost is paid once per document rather than once per product.',
      'Answers cite a passage, which is what makes them checkable.',
    ],
    status: 'coming-soon',
    solutions: {
      lms_k12: {
        today: 'no',
        use: 'Would ground answers in circulars, policies and curriculum documents.',
      },
      g2g: {
        today: 'no',
        use: 'Would ground them in competency frameworks and role definitions.',
      },
      enterprise_brain: {
        today: 'partial',
        use: 'Holds the knowledge screens today and would contribute them as the first shared corpora.',
      },
    },
  },

  {
    id: 'ai.recommendations',
    slug: 'recommendations',
    name: 'Recommendation Engine',
    purpose: 'Turns stored evidence into ranked, explainable recommendations for any module that asks.',
    whyCentral:
      'A recommendation is only trusted if it can be explained, and the explanation is the evidence behind it. Three engines over three evidence stores would produce three different answers about the same student.',
    todayInK12:
      'Not built. It appears as a locked switch on the Fees AI Stack and as a presentational card on the AI Stack floating panel, which is deliberately marked as not yet openable.',
    toCentralise: [
      'A scoring contract: evidence in, ranked items out, each with the evidence that produced it.',
      'Ranking that reads the shared knowledge graph rather than a per-product table.',
      'Per-module thresholds, so Fees can require more confidence than a content suggestion does.',
    ],
    afterCentralisation: [
      'Any module asks the same question the same way and gets a comparable answer.',
      'Every recommendation carries its reasons, so a school can challenge one.',
      'Improving the ranking improves it for all three products at once.',
    ],
    status: 'in-progress',
    roadmapId: 'ai.recommendation-engine',
    solutions: {
      lms_k12: {
        today: 'no',
        use: 'Would rank interventions, fee-collection actions and content for a concept.',
      },
      g2g: {
        today: 'no',
        use: 'Would rank development paths and role matches against the same evidence.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Would rank the actions surfaced by its signals and deliberation loop.',
      },
    },
  },

  {
    id: 'ai.knowledge-graph',
    slug: 'knowledge-graph',
    name: 'Knowledge Graph',
    purpose: 'The shared evidence store every recommendation and explanation is drawn from.',
    whyCentral:
      'This is the substrate the other capabilities stand on. A student’s evidence in K-12, their capability record in G2G and their signals in Enterprise Brain describe one person; kept apart they describe three.',
    todayInK12:
      'Not built as a shared store. Enterprise Brain has a graph screen, and concept intelligence is live over its own records.',
    toCentralise: [
      'One entity and relationship model spanning learner, capability, role, concept and evidence.',
      'Write contracts, so each product contributes facts without owning the schema.',
      'Tenant isolation in the store itself, not in the callers.',
    ],
    afterCentralisation: [
      'One record of what is known about an entity, contributed to by all three products.',
      'Recommendations and explanations read the same evidence, so they cannot contradict each other.',
      'A new product gains context on day one instead of starting empty.',
    ],
    status: 'in-progress',
    roadmapId: 'ai.knowledge-graph',
    solutions: {
      lms_k12: {
        today: 'no',
        use: 'Would contribute learning evidence and read capability context back.',
      },
      g2g: {
        today: 'no',
        use: 'Would contribute the competency taxonomy that the other two currently lack.',
      },
      enterprise_brain: {
        today: 'partial',
        use: 'Has the graph screen and is the natural host for the shared store.',
      },
    },
  },

  {
    id: 'ai.evaluation',
    slug: 'evaluation',
    name: 'AI Evaluation',
    purpose:
      'Test sets and scores that say whether a prompt or model change made answers better or worse.',
    whyCentral:
      'Once prompts and models are shared, a change ships to all three products at once. Evaluation is what makes that safe — without it, centralising raises the blast radius without raising the confidence.',
    todayInK12:
      'Not built. Prompt and model changes ship without a measured before and after.',
    toCentralise: [
      'Named test sets per capability, with expected outcomes contributed by each product.',
      'Scoring runs against a candidate prompt or model, reported beside the active one.',
      'A gate in the release path, so a regression is caught before it is promoted.',
    ],
    afterCentralisation: [
      'A prompt or model change is measured before it reaches a school.',
      'Each product contributes the cases it cares about and is protected by all of them.',
      'Regressions become a number rather than a support ticket.',
    ],
    status: 'coming-soon',
    solutions: {
      lms_k12: {
        today: 'no',
        use: 'Would contribute curriculum, fees and admissions cases as its test set.',
      },
      g2g: {
        today: 'no',
        use: 'Would contribute competency-mapping cases.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Would contribute agent-behaviour cases, which is where an unmeasured regression costs most.',
      },
    },
  },

  {
    id: 'ai.usage-cost',
    slug: 'usage-cost',
    name: 'Usage & Cost',
    purpose: 'What each product, tenant and module spent on AI, and against which quota.',
    whyCentral:
      'The bill arrives as one number from the provider. Attributing it is only possible where the calls are counted — the shared gateway — which is the same place the quota has to be enforced.',
    todayInK12:
      'Not built. Fees carries a locked "usage and audit" switch scoped to its own module, which the architecture review treated as a module view over central data rather than a second meter.',
    toCentralise: [
      'Metering at the gateway: tokens, latency and cost tagged with solution, tenant, module and capability.',
      'Quotas and alerts per product and per tenant.',
      'A module-scoped view, so Fees sees its own spend without a separate meter.',
    ],
    afterCentralisation: [
      'One provider bill is attributable to a product, a school and a feature.',
      'A runaway agent hits a quota instead of an invoice.',
      'Cost per capability informs which model each capability should get.',
    ],
    status: 'coming-soon',
    roadmapId: 'ai.gateway',
    solutions: {
      lms_k12: {
        today: 'no',
        use: 'Would see spend per module and per school, and enforce a per-tenant quota.',
      },
      g2g: {
        today: 'no',
        use: 'Would see its own share of the shared bill rather than an unattributed total.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Would meter agent runs, which are the least predictable spend of the three.',
      },
    },
  },

  {
    id: 'ai.audit',
    slug: 'audit',
    name: 'AI Audit',
    purpose:
      'The record of every AI call: who asked, what was sent, which model answered, which tools ran.',
    whyCentral:
      'An audit trail split across three products cannot answer the one question it exists for — what did the system do about this person. It also has to be written where a caller cannot skip it, which is the shared runtime.',
    todayInK12:
      'Partial. The conversational runtime carries an audit contract in packages/conversational-ai-core, and the Laravel lifecycle records a trace. Nothing covers the capabilities that are not conversational, and there is no screen.',
    toCentralise: [
      'One append-only record written by the runtime, not by callers.',
      'Redaction applied on write, so the trail does not become a second copy of the sensitive data.',
      'Retention per the tenant policy document, and a search a school can be shown.',
    ],
    afterCentralisation: [
      'One place answers what the AI did for a given student, staff member or tenant.',
      'The decision approval trail — currently an acknowledged internal gap — has somewhere to be written.',
      'Every product inherits auditability without implementing any of it.',
    ],
    status: 'coming-soon',
    solutions: {
      lms_k12: {
        today: 'partial',
        use: 'Conversational calls are traced; nothing else is, and none of it is visible on a screen.',
      },
      g2g: {
        today: 'no',
        use: 'Would inherit the trail for every call it makes through the shared endpoint.',
      },
      enterprise_brain: {
        today: 'no',
        use: 'Needs it most: an agent acting unattended is exactly what an audit trail is for.',
      },
    },
  },
];
