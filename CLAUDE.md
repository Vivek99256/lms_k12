# EduERP Design System

An enterprise design system for a **cloud-based, multi-tenant K–12 school ERP** platform. It is desktop-first, accessibility-first (WCAG 2.2 AA), and tuned for data-heavy workflows — forms, dashboards, reports, and complex tables — across 15+ business modules and four roles (Admin, Teacher, Staff, Parent).

The design language prioritises **consistency, scalability, readability and long-duration usage** over decoration. No gradients, glassmorphism, neumorphism, or ornament.

---

## Sources

Built from a written specification (no prior code) mounted read-only at `ERP Design System/`:

- `foundation/01_design_foundation.md` — constitutional principles (vision, roles, UX/design principles, a11y, density, navigation).
- `foundation/02_design_tokens.yaml` — the two-tier token system (primitives → semantic roles, 4 themes, 3 density modes). **Ground truth for `tokens/`.**
- `foundation/03_layout_system.yaml` — application frame + layout archetypes.
- `templates/04_page_templates.yaml` — 18 page templates + 4 state templates.
- `components/05_component_library.yaml` — \~55 components, categories, and the anti-duplication map. **Ground truth for `components/`.**
- `patterns/06_pattern_library.yaml` — 27 end-to-end UX patterns.
- `rules/07_module_rules.yaml` — module registry + governance.
- `prompts/08_prompt_library.md` — reuse/consistency prompt library.

No logo or font binaries were supplied — see *Font substitution* and *Iconography* below.

---

## What's here (manifest)

- **`styles.css`** — the single entry point consumers link. Import-only; pulls in fonts → tokens → base → component CSS.
- **`tokens/`** — CSS custom properties: `colors.css` (primitives + 4 themes), `typography.css`, `fonts.css`, `spacing.css` (+ density), `shape.css` (radius/border/shadow/sizing/icon/opacity), `motion.css`, `layout.css` (breakpoints/containers/z-index), `base.css` (resets + type-role utility classes).
- **`components/`** — 74 React components (`.jsx` + `.d.ts` + `.prompt.md`) across 16 groups; per-group CSS in `components/_css/`; one `@dsCard` HTML per group.
- **`ui_kits/admin/`** — interactive Admin console recreation (dashboard, students, admissions, fees).
- **`guidelines/`** — foundation specimen cards (colors, type, spacing, shape, motion, brand) shown on the Design System tab.
- **`assets/`** — `logo.svg` (placeholder monogram).
- **`SKILL.md`** — Agent-Skill-compatible entry so this system can be used standalone.

Compiler outputs (`_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`) are generated automatically — do not edit.

### Component groups

`buttons` (Button, IconButton, ButtonGroup, SplitButton) · `inputs` (TextField, Textarea, SearchInput, DatePicker) · `selection` (Checkbox, RadioGroup, Toggle, Select, Combobox, SegmentedControl) · `data-display` (Badge, Tag, Avatar, DescriptionList, ListRow, FilterBar, EventChip, CalendarGrid, AgendaList, DocumentPreview) · `cards` (Card, MetricCard, SectionPanel) · `tables` (DataTable) · `feedback` (AlertBanner, InlineMessage, Toast, Spinner, Skeleton, ProgressBar, StatusView) · `overlays` (Modal, ConfirmationDialog, Drawer, Popover, Tooltip) · `navigation` (SidebarNav, Sidebar — composable multi-level with SidebarProvider/SidebarTrigger/SidebarMenu/SidebarMenuSub, TopbarNav, Breadcrumb, Tabs, ModuleTabBar, CommandPalette, Stepper, Pagination, TreeView, Menu, BottomNav) · `layout` (Resizable / ResizablePanelGroup / ResizablePanel / ResizableHandle split panes) · `utilities` (Icon, Divider, Accordion, DensityToggle, ThemeToggle) · `charts` (Chart, Sparkline, ChartLegend, ChartTile) · `workflow` (ApprovalCard, TimelineItem, ActivityFeed, AuditEntry) · `communication` (NotificationItem, CommentThread, AssistantPanel, AssistantLauncher) · `auth` (AuthForm, OtpInput, PasswordStrengthMeter) · `uploads` (FileUpload) · `blocks` (Carousel, Collapsible, ToggleButton, ToggleButtonGroup, ScrollArea, AspectRatio, Kbd) · `chat` (Bubble, Message, MessageScroller, Attachment, Item, Field, Marker).

**shadcn-parity additions (Batch 1):** composable `Sidebar` family, structural `Table` family (Table/TableHeader/TableBody/TableFooter/TableRow/TableHead/TableCell/TableCaption), `DataTable` density-toggle variant, `Resizable` split panes, validated `Form` family (Form/FormField/FormItem/FormLabel/FormControl/FormDescription/FormMessage), `Slider`, standalone `Calendar`, and `NativeSelect`. These share the existing token + class system; `Combobox`, `RadioGroup`, and `OtpInput` already provided parity.

**shadcn-parity additions (Batch 2):** composable `Sheet` family (Sheet/SheetContent/SheetHeader/SheetTitle/SheetDescription/SheetBody/SheetFooter/SheetClose) on the Drawer surface, `Drawer edge="bottom-sheet"` mobile dock (grab handle, slide-up), `Toaster` Sonner-style stacked toasts (Toaster.toast/.success/.error/.warning/.info), `NavigationMenu` family (NavigationMenu/NavigationMenuItem/NavigationMenuLink) for portal headers, `Menubar` family (Menubar/MenubarMenu) desktop-app strip, `ContextMenu` right-click actions, and `HoverCard` info-on-hover. Modal, ConfirmationDialog, Popover, Tooltip, Toast, AlertBanner, ProgressBar, Skeleton, Menu, Breadcrumb, Pagination, Tabs, and CommandPalette already provided the rest of the batch's parity.

**shadcn-parity additions (Batch 3):** UI blocks — `Carousel` (embla-style track), `Collapsible` (single disclosure, vs Accordion's set), `ToggleButton` + `ToggleButtonGroup` (pressable `aria-pressed`, single/multiple; distinct from switch `Toggle` and from `SegmentedControl`), `ScrollArea` (thin cross-browser scrollbars), `AspectRatio`, and `Kbd`. Chat primitives — `Bubble` (system/user/outline + typing), `Message` (avatar + meta + bubbles), `MessageScroller` (bottom-stick thread), `Attachment` (file/image chip), `Item` (structured list row), `Field` (label/value pair), and `Marker` (day/status divider). Chat bubbles reuse `--action-primary` (user) and `--surface-subtle` (system); `AssistantPanel` remains the batteries-included docked surface built on these primitives.
 `Badge` is the status indicator (no `status-badge`); `MetricCard` covers stat/kpi; `StatusView` covers empty/error/success; `DescriptionList` is the key/value list; `Menu` is the dropdown; `TreeView` is the settings nav; `DataTable` covers the editable grid. Reuse variants, never fork.

---

## Content fundamentals

The product personality is **competent, calm, respectful, quietly reassuring** — never playful, edgy, or clever. Personality is expressed through restraint.

- **Voice:** professional, warm, jargon-free. Plain language, especially on parent-facing surfaces (lowest reasonable reading level).
- **Person:** address the user as *you*; refer to the system impersonally ("Receipt issued"), never anthropomorphised ("Oops!").
- **Casing:** **Sentence case** everywhere — buttons, labels, headings, menu items ("Add student", "Collect fee", not "Add Student"). All-caps is reserved for the overline type role (short section labels, table headers) with wide tracking.
- **Tone by moment:** quiet confirmation for routine saves; prominent, reassuring confirmation for money/records (durable receipts with reference numbers); steady, blame-free language for errors that says *what happened + what to do next*.
- **Buttons are verbs:** "Approve", "Collect ₹12,500", "Add student" — action-first, specific over generic ("Save changes" over "OK").
- **Numbers & currency:** tabular figures; Indian grouping and ₹ (e.g. `₹18.4L`, `₹42,500`); IDs in mono (`ADM-2026-0421`, `FEE-2026-0912`).
- **No emoji.** Meaning is carried by text + icon + shape, never color or emoji alone.

Examples: *"Term-2 fees are due on 15 July for 42 students."* · *"Admission number already exists."* · *"Payment received — receipt FEE-2026-0912 issued."*

---

## Visual foundations

- **Color:** brand is **indigo** (`--action-primary #4f46e5`); neutrals are **slate**; feedback is emerald / amber / red / blue. UI consumes **semantic roles only** (`--surface-*`, `--content-*`, `--border-*`, `--action-*`, `--feedback-*`, `--focus-*`) so all four themes (light, dark, high-contrast light/dark via `[data-theme]`) work by construction. Backgrounds are flat — canvas is `--surface-canvas` (slate-50), panels are white.
- **Type:** **Inter** for all UI (display → caption), **JetBrains Mono** for IDs/codes/amounts. Modular scale 11 → 60px; headings use tight tracking; overlines use widest tracking + uppercase. Minimum body text 14px on dense surfaces.
- **Spacing:** 4px base rhythm; layout composed from semantic intents (`--inset-*`, `--stack-*`, `--inline-*`, `--gutter-*`, `--section-*`). Three density modes (`[data-density]`): comfortable (48px rows), cozy (40px, default), compact (32px).
- **Shape:** radii — control 6px, surface 8px, overlay 12px, **button 12px (pill-leaning rounded)**, pill full. Cards = 1px `--border-subtle` + `--shadow-raised` (subtle) + 8px radius. Hairline 1px borders throughout; no heavy rules.
- **Elevation:** a layered, low-opacity slate shadow ramp with hairline rings (raised → sticky → dropdown → overlay → modal), plus molded control shadows (`--shadow-btn`, `--shadow-btn-primary`) that give buttons quiet depth. Signals layering, never decoration.
- **Backgrounds:** solid fills only. **No gradients, no glass, no textures, no blur** (overlays use a flat slate scrim). Imagery is limited to avatars and document previews.
- **Motion:** quick and functional, with a **tactile layer** for premium feel. Durations 100–300ms; standard easing `cubic-bezier(0.2,0,0,1)`, plus an out-quint (`--ease-emphasized`) for hover/enter and a gentle spring (`--ease-spring`) for press-release. Interactive controls (buttons, chips, nav items, toggles, cards) **press-scale** on `:active` and spring back; the active indicator on Tabs and ModuleTabBar **slides** to its target; menus/popovers/modals scale-in from their origin. No infinite loops, no decorative motion. All of it collapses to instant under `prefers-reduced-motion` (duration tokens zero out).
- **Hover / press:** hover shifts to `--surface-hover` (or one brand step darker for solids); press to `--surface-active` / next brand step **plus a subtle press-scale** on buttons, chips and nav items (`--press-scale` ≈ 0.97). Dense rows and table cells do **not** transform, so data stays stable during interaction.
- **Focus:** a 2px `--focus-ring` outline at 2px offset on `:focus-visible`, never obscured by sticky regions (WCAG 2.2). Targets ≥ 24px (44–48px on mobile/parent surfaces).
- **Corners & cards:** softly rounded (6–12px), quietly bordered, gently shadowed — calm and legible at high information density.

---

## Premium interaction layer

A 2026 pass benchmarked the system against the interaction quality of modern enterprise/productivity apps (Linear, Vercel, Stripe, Notion, Gamma, Intercom) and closed the gaps that read as "generic" — while keeping the enterprise restraint (no gradients, glass, or ornament). Premium here means **craft**, not decoration: tactile press feedback, sliding indicators, layered hairline shadows, and a global command surface.

**Upgraded (existing components):**

- **Tabs** — a single indicator now *slides* to the active tab (underline bar / enclosed pill) instead of snapping, using the spring release curve. The framer-style layout animation is the clearest "premium tab" signal.
- **Breadcrumb** — segments are hover-chips, the root takes an `icon` (e.g. `house`), and the trail collapses its middle into a `…` overflow menu past `maxItems`.
- **Buttons / controls** — molded depth + `press-scale` spring (added earlier); buttons use the pill-leaning `--radius-button`.

**New components** (the anti-duplication map has no equivalent — each is a distinct IA level or capability, so a new component *is* required):

- **ModuleTabBar** (`navigation`) — horizontal **sub-module** navigation, i.e. the `module → sub-module` level of the specced IA (foundation §17, §11). The sidebar picks the module; this bar picks the sub-module. Distinct from `Tabs` (in-page peer sections *within* one sub-module): it carries the module label, a sliding filled indicator, horizontal scrolling and overflow chevrons for the "hundreds of sub-modules" the foundation calls out. *Requested by the product team; matches their Fees module screen.*
- **CommandPalette** (`navigation`) — the global **⌘K / Ctrl-K** command + jump-to surface anticipated by the spec ("global command/search entry point," foundation §11; `TopbarNav` future-reuse: "command palette"). Type to filter across 15 modules, ↑/↓ to move, ↵ to run. The single biggest modern-enterprise premium signal; pairs with global search.
- **AssistantPanel** + **AssistantLauncher** (`communication`) — a docked **AI copilot / agent** surface (right dock) with chat thread, suggestion chips, typing indicator and composer, plus a floating agent rail for the collapsed state. This is a **genuinely new capability** — the source spec predates the product's AI direction and has no assistant/copilot surface — modelled on Gamma / Notion AI / Intercom, rebuilt in the enterprise language (flat surfaces, hairlines, brand indigo, no glass). *Requested by the product team.*

All five honour keyboard nav, visible focus, and `prefers-reduced-motion`. Live demos: the **Motion → Premium Interactions** card, the three new **Components** cards (Module tab bar, Command palette, Assistant), and the **Admin console** UI kit, which wires the ModuleTabBar under the top bar, the ⌘K palette, and the docked assistant together.

## Iconography

- **Library:** [Lucide](https://lucide.dev) — the spec assumes a line-icon set; Lucide matches the required 1.5–2px stroke weights and rounded caps. The `Icon` component renders any Lucide glyph by name (`<Icon name="calendar" />`) from the Lucide UMD global, which cards and UI kits load from CDN (`lucide@0.544.0`).
- **Sizing:** icon tokens 12–40px; 16px inline with dense text, 20px default in controls. Stroke tokens: thin 1.5 / regular 1.75 / bold 2.
- **Usage:** icons **supplement** labels and status (paired with text), never replace an accessible name; icon-only buttons require a `label`. **No emoji**, no decorative illustration. The only bespoke SVG is `assets/logo.svg` — a placeholder graduation-cap monogram (Lucide glyph, ISC) standing in until the institution's real logo is supplied.

---

## Font substitution ⚠️

The spec names **Inter** and **JetBrains Mono** but shipped no font binaries. `tokens/fonts.css` therefore loads both from **Google Fonts** (their canonical source). If you have licensed/self-hosted copies, drop them in and swap the `@import` for local `@font-face` rules. *Please confirm this is acceptable or provide the font files.*

---

## Themes & density

Set `data-theme="light | dark | high-contrast-light | high-contrast-dark"` and `data-density="comfortable | cozy | compact"` on `<html>` (or any ancestor). Semantic tokens re-resolve automatically. `ThemeToggle` and `DensityToggle` components drive these.
