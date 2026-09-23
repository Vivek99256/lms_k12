# Module Intelligence

One renderer, many contracts. This directory is what a module needs to get an
Intelligence screen without anyone writing another 3,600-line React file.

## What "intelligence" means here

A claim about the organization that **nobody asked for**, that **names what to
do about it**, and that can be **traced back to the rows that produced it**.

- A *report* answers a question you asked.
- A *dashboard* shows numbers you chose in advance.
- *Intelligence* tells you something you did not ask about, because a rule fired
  on your data, and it arrives carrying its evidence.

The test: **if you delete the evidence trail and the screen looks the same, it
is a dashboard.**

### The ladder

| Layer | Question | Section |
| --- | --- | --- |
| L0 Coverage | What data do we actually have? | gates the screen, plus `dataQuality` |
| L1 Position | What is true right now? | `position` |
| L2 Distribution | Where does it sit? | `breakdowns` |
| L3 Signals | What is abnormal, and how do we know? | `findings`, `priorities` |
| L4 Reasoning | Why? | `likelyCause` on a finding |
| L5 Loop | What to do, did it work, what did we learn? | `recommendations`, `decisions`, `learning` |

**L1 + L2 without L3 is a dashboard.** A module that can only produce position
and breakdowns has not earned an Intelligence tab yet.

## Files

| File | What it is |
| --- | --- |
| `payload.ts` | The canonical shape every module's endpoint speaks. Facts **and their units**. |
| `contract.ts` | What a module declares: sections, copy, accent, endpoints. Presentation only. |
| `format.ts` | Value formatting. Null renders as an em dash, never as zero. |
| `primitives.tsx` | Section, Surface, MetricTile, SeverityChip, EvidenceGrid, Unavailable. |
| `sections.tsx` | The eight standard sections, rendered from the payload. |
| `ModuleIntelligence.tsx` | The renderer. |
| `registry.ts` | Which modules have intelligence, and honestly what kind. |
| `contracts/fees.ts` | The reference contract, with an adapter over the existing Fees endpoint. |

## Adding a module

### 1. Backend emits `ModuleIntelligencePayload`

New controllers return the canonical shape directly. `contracts/fees.ts` has an
`adapt()` because the Fees endpoint predates this shape — **that adapter is a
migration step, not the pattern to copy.**

Register the module's signal rules in `IntelligencePipeline` (Laravel side).
That is a one-line change and it is what gives the module findings, evidence,
reasoning, recommendations, decisions and audit for free. Without it the module
has an L1/L2 screen, which is a dashboard.

### 2. Write the contract

```ts
export const resultIntelligenceContract = defineContract({
  key: 'result',
  label: 'Result Intelligence',
  accent: '#0F766E',
  grain: 'one student’s result in one subject for one exam',
  nouns: { singular: 'result', plural: 'result records' },
  load: () => brainFetch(tenantPath('/result/intelligence')),
  actions: { run: ..., decide: ... },
  sections: sectionsWith({
    position: { title: 'Academic position' },
    breakdowns: { title: 'Where performance sits' },
  }),
  summaryMetrics: ['appeared', 'passRate', 'mean', 'belowThreshold', 'subjects', 'pendingEntry'],
  emptyState: {
    title: 'No results for this academic year',
    fallbackReason: 'No marks have been entered for the year selected in the header.',
  },
});
```

### 3. Add the route — three lines

```tsx
// app/result/intelligence/page.tsx
'use client';
import { ModuleIntelligence } from '@/components/intelligence/module';
import { resultIntelligenceContract } from '@/components/intelligence/module/contracts/result';

export default function Page() {
  return <ModuleIntelligence contract={resultIntelligenceContract} />;
}
```

A top-level dynamic route cannot do this for you: Next resolves `/result/...`
inside the existing `app/result/` folder, so the file has to exist. Three lines
is the floor, and it is cheap.

### 4. Move it to `live` in `registry.ts` — but only after step 5

### 5. Reconcile before you ship

Check every headline number against the module's **existing report screen**. If
Result Intelligence says 1,240 students appeared and the existing result report
says 1,198, **stop**. Do not pick one. Find out why.

This is the step that makes the difference between an intelligence screen and a
convincing wrong screen, and it is the only step that cannot be generated.

## The rules the renderer enforces

1. **Null is not zero.** A rate over no denominator is undefined. `formatValue`
   renders it as an em dash. Sending `0` for "unknown" is the most common way an
   honest pipeline becomes a misleading dashboard.
2. **Every absence states its reason,** in the backend's words. "No students are
   enrolled" and "marks were never entered" are different problems.
3. **No finding without evidence.** An assertion with no figures behind it is a
   chart caption.
4. **A hypothesis is labelled as one.** `causeConfirmed: false` renders as
   "Possible cause, not confirmed".
5. **Silence is readable.** `ruleStatus` says which checks ran, so "two
   findings" never looks the same as "twenty-four checks never ran".
6. **No client-side arithmetic.** The only number this directory computes is the
   width of a bar. Anything else comes from the endpoint that knows the grain.
7. **At most three extra cards per module** (`MAX_EXTRA_CARDS`, enforced at
   module-evaluation time). Without the cap, the escape hatch becomes a bespoke
   screen again.

## What has *not* changed

Nothing existing was modified to add this layer. `app/fees/intelligence/**`
still has its own primitives, its own charts and its own screen, and
`/fees/intelligence` still renders them. `contracts/fees.ts` proves the generic
shape against the Fees endpoint without touching it; migrating the Fees route
onto this renderer — and moving its gateway, NACH and payment-failure cards into
`extraCards` — is a separate change.
