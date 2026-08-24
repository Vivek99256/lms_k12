---
name: eduerp-design
description: Use this skill to generate well-branded interfaces and assets for EduERP, the enterprise K–12 school ERP design system, either for production or throwaway prototypes/mocks. Contains essential design guidelines, color and type tokens, fonts, icon conventions, reusable React components, and an interactive admin UI kit for building data-heavy enterprise screens (dashboards, tables, forms, reports).
user-invocable: true
---

Read `readme.md` in this skill first — it is the design guide and manifest (sources, content fundamentals, visual foundations, iconography, themes). Then explore the other files as needed.

## What's here
- `styles.css` — the single stylesheet to link; imports all tokens + component CSS.
- `tokens/` — CSS custom properties (colors + 4 themes, typography, spacing + density, shape, motion, layout, base resets + type-role utility classes).
- `components/` — 70 React components (`.jsx` + `.d.ts` props contract + `.prompt.md` usage) across 16 groups; each group has a `@dsCard` demo HTML.
- `ui_kits/admin/` — an interactive K–12 admin console recreation (dashboard, students, admissions, fees) — the reference for composing screens.
- `guidelines/` — foundation specimen cards.
- `assets/logo.svg` — placeholder brand mark.

## How to build
- If creating visual artifacts (slides, mocks, throwaway prototypes): copy `styles.css` + `tokens/` + `assets/` out, link `styles.css`, load the compiled `_ds_bundle.js`, load Lucide (`lucide@0.544.0` UMD) for icons, and mount components from `window.<Namespace>` (run the design-system check to get the exact namespace). Copy a `@dsCard` HTML or the UI kit `index.html` as a starting scaffold.
- If working in production code: read the token CSS and `.prompt.md` files to become an expert in the brand, then use the components directly.

## Rules that matter (from the source spec)
- **Reuse before creating.** Use existing components as variants — never fork. `Badge` (not status-badge), `MetricCard` (stat/kpi), `StatusView` (empty/error/success), `DescriptionList` (key/value), `Menu` (dropdown), `TreeView` (settings nav), `DataTable` (editable grid).
- **Tokens only.** Consume semantic roles (`--surface-*`, `--content-*`, `--action-*`, `--feedback-*`) so themes work; never hardcode colors/spacing.
- **Enterprise, minimal, high-readability.** No gradients, glass, neumorphism, decoration, or emoji. Desktop-first, data-dense, WCAG 2.2 AA (visible focus, ≥24px targets, meaning never by color alone).
- **Sentence case** copy; buttons are specific verbs; plain language for parent-facing surfaces; durable confirmations (reference numbers) for money/records.

If invoked without guidance, ask what the user wants to build, ask a few focused questions (module, role, desktop vs mobile, which templates/patterns), and act as an expert enterprise-UX designer who outputs HTML artifacts or production code.
