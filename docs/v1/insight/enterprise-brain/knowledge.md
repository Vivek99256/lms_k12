# Knowledge

Last updated: 2026-11-04
Generated from commit: `8fe500dc` (frontend) / `86261072` (backend)

---

## Purpose

Organisational memory: what the institute has learnt about itself, accumulated from every reasoned case rather than authored by hand or by a model. Knowledge is keyed by root-cause family, not by individual incident.

---

## Menu path

Enterprise Brain → Knowledge

---

## Frontend route

`/enterprise-brain/knowledge`

Source: `app/enterprise-brain/knowledge/page.tsx`

---

## Core concept: knowledge assets keyed by root-cause family

Six separate ownership-gap findings (headless departments, staff with no manager, staff with no department) are not six separate things to know. They are one thing: "ownership is assigned late in this organisation." The pipeline sharpens a single knowledge asset per root-cause family and counts how often the pattern has recurred (`reuse_count`).

**Nothing on this screen was written by hand or by a model.** Each asset is composed from the cases that produced it and the human-approved remedy for that family, so every claim traces back to counted LMS rows.

---

## Screen layout

### KPI tiles

Dynamic metric tiles derived from `data.metrics`. Tiles are customisable per user.

### Knowledge by root-cause family (chart)

Bar chart showing the number of knowledge assets per root-cause family (up to 14 families shown).

### Mental models (panel)

Mental models are higher-level patterns reinforced each time their family recurs. Each row shows:

| Field | Description |
|---|---|
| Name | Model name |
| Reinforcement count (×N) | How many times this pattern has been seen in this institute |
| Confidence meter | The Brain's confidence that this model applies |
| Description | Plain-language explanation |
| Rule keys | The specific rules that contribute to this model (shown as monospace chips) |

Mental models are not created manually. They form once the Intelligence Loop has reasoned over enough signals. If no models appear, the administrator is prompted to run the Intelligence Loop.

### Knowledge assets (grid)

Cards showing individual knowledge assets:

| Field | Description |
|---|---|
| Title | Asset name |
| Category | Root-cause family (shown as `CATEGORY · seen N×`) |
| Confidence meter | Confidence score |
| Content | The asset body — plain text, pre-line-wrapped |

---

## Search

A search field at the top allows free-text filtering of knowledge assets. The filter is applied server-side (`fetchKnowledge(term)`).

---

## Customisation

Widgets on this screen can be hidden per user via `useDashboardPreferences('brain.knowledge', widgets)`. Customisable: the by-category chart, mental models panel, knowledge assets panel. KPI tiles are individually toggleable.

---

## RBAC

| Action | Required right |
|---|---|
| View Knowledge | `enterprise_brain.knowledge` |

---

## Source files

- Frontend: `app/enterprise-brain/knowledge/page.tsx`
- API: `lib/brain/api.ts` — `fetchKnowledge`
- Backend tables: `intelligence_entities` (knowledge assets), `mental_models`
