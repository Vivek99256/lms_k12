# PAL — Coherence Map

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

> Source of truth: `app/pal/new/coherence-map/page.tsx`

---

## Purpose

The Coherence Map visualises the concept prerequisite graph for a given class and subject. It shows which concepts must be mastered before others, enabling teachers and curriculum designers to audit the learning sequence and identify structural problems (cycles, missing entry points).

---

## Scope

The map is scoped by:
- **Class** (standard / grade)
- **Subject**

Both are selectable via filters on the page. The graph updates when either filter changes.

---

## Graph Elements

| Element | Description |
|---|---|
| Concepts | Nodes in the graph. Each concept is a learning unit within a chapter. |
| Prerequisite links | Directed edges: "must master A before B" |
| Related links | Undirected edges: "A and B are related, no strict ordering" |
| Entry points | Concepts with no prerequisites — where a learner can begin |
| Max chain depth | Longest prerequisite chain in the graph (longest path metric) |

---

## AI-Suggested Links

The coherence map distinguishes between:
- **Reviewed links** — manually approved prerequisite/related connections
- **Draft AI-suggested links** — AI-generated candidates not yet reviewed

Draft links are flagged visually. Curriculum reviewers must approve or reject them before they influence adaptive routing.

---

## Cycle Detection

The engine detects and flags circular prerequisite chains (A → B → C → A). Cycles are shown as warnings and must be resolved before the graph is used for adaptive sequencing.

---

## Component

The map is rendered by `CoherenceMapView`, a dedicated client component imported into the page.

---

## API

The page calls `/api/pal/coherence` (via the `app/api/pal/` route layer) to fetch the graph for the selected class and subject.

---

## Source Files

- `app/pal/new/coherence-map/page.tsx`
- `app/pal/_components/CoherenceMapView.tsx` (map renderer)
- `app/api/pal/coherence/` (API route)
