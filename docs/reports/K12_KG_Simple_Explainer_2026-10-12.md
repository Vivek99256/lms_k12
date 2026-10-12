# Knowledge Graph in K-12 — Simple Explainer

**Date:** 2026-10-12
**Purpose:** A plain-language answer to two questions — how does our Knowledge Graph work, and
where does it actually show up as a recommendation in the product.

---

## 1. What is a "Knowledge Graph," in plain terms?

Think of our normal database as a set of filing cabinets — one for students, one for questions,
one for results. It's great at "pull me this one file."

The Knowledge Graph is a different kind of database built to store **connections**, not just
records — things like "this topic needs that topic first" or "this question tests that topic."
It's good at the question a filing cabinet struggles with: *"follow this chain for me, three or
four steps deep, and tell me where it leads."*

We use a product called **Neo4j** for this. It's not a prototype — it currently holds about
**954,000 pieces of data and 2.95 million connections between them**, covering curriculum,
results, HR, and skills information.

## 2. How does data get into it?

Nobody types data into the graph directly. It's always a copy, kept fresh automatically:

- **Every minute**, any change in the main database (a new student, a new result, etc.) gets
  copied over.
- **Every night**, a deeper refresh re-checks the curriculum side specifically — concepts,
  prerequisites, content links.

So the main database is still "the truth." The graph is a specialised mirror of it, built to
answer connection-shaped questions the main database can't answer as well.

## 3. Where do we actually use it today?

Two real, working places:

| Where | What it does |
|---|---|
| **Coherence Map** screens | Shows teachers and content staff the prerequisite chain between concepts — what a student needs to know *before* the next topic. |
| **Adaptive Learning Engine** (the "why is this student stuck" logic) | When a student struggles, the system doesn't just flag the one question they got wrong — it follows the chain backward through the graph to find the *real* root concept causing the trouble, even if that's several steps further back. This is the one place the graph is making a real decision a student sees today. |

## 4. Is it powering our recommendations?

**Partly — and here's the honest line to use with anyone who asks:**

- **Diagnosing *why* a student is stuck** → genuinely graph-powered, live, working today.
- **Deciding *what content* to show that student** (the "Suggested Content" screen) → still
  decided by simple scoring rules against the main database, not the graph. The graph's "here's
  the root cause" insight is shown next to it as a helpful note, but it doesn't yet decide the
  ranking.

So: the engine is built and it's genuinely smart about diagnosis. The next step — letting that
same insight also choose the content — hasn't been wired in yet. That's a deliberate, scoped
next step, not a bug.

## 5. What's solid vs. what's still being built

**Solid and verified today:**
- The graph is live, reachable, and growing (confirmed by directly querying it this week).
- Data stays correctly separated per school/institute — no mixing between them.
- Two real screens (Coherence Map, Adaptive Learning diagnosis) genuinely use it.
- Two security/consistency issues found during this review were fixed immediately: one API was
  returning student data with no login check, and a nightly data-refresh job was quietly skipping
  a quarter of its steps. Both are corrected and verified now.

**Still to be done (recommended, not urgent):**
- Connect the graph's "root cause" insight into the actual content-ranking decision.
- A couple of navigation menus don't yet link to every screen that already exists.
- One content screen still shows sample placeholder content when nothing real has been written
  for that topic yet (always clearly labeled "sample," never shown as if it were real).

## 6. Bottom line

*"It's a live map of how our curriculum connects, built on top of our real data, kept
automatically up to date. Today it's doing one high-value job well — finding the real root cause
when a student is stuck — and it's technically ready to do more, but choosing what content to
recommend is still rule-based for now, not graph-based yet."*
