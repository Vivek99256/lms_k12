# Result module — Next.js redesign

Modern rebuild of the 31 Laravel Blade screens described in `result_erp_contract.json`
(Entry 7 · Master 12 · Report 12). Every field, filter, column and button from the
contract is represented; business logic and backend endpoints are unchanged — only the
UX layer is new.

---

## 1. Architecture

**Config-driven where screens are uniform, bespoke where they are not.**

```
lib/result/
  api.ts          Session-aware proxy client (resultGet / resultPost / assertOk /
                  toOptions / extractRows). All calls go through /api/proxy with
                  token, sub_institute_id, user_id, syear appended — identical to
                  what the Blade forms sent.
  types.ts        FieldDef · ColumnDef · MasterScreenDef · OptionSource
  masters.ts      12 master screens encoded as typed configs (every contract field)

components/result/
  PageHeader.tsx  Breadcrumbs + icon + title + actions + toast outlet
  FilterBar.tsx   Config-driven search panel with the academic cascade
                  (Term → Section → Standard → Division) plus API/static/date/
                  number filters, `{placeholder}` dependent reload, conditional
                  visibility (showIf), multi-select, required-field gating
  DataTable.tsx   Sticky header · global search · per-column filters · sorting ·
                  pagination · row selection + bulk delete · column visibility ·
                  CSV/Excel/PDF/Print export · skeleton/empty/error states
  DynamicForm.tsx React Hook Form + Zod renderer for every field type: text,
                  textarea, number, date, select, multiselect, radio, checkbox,
                  toggle, file, image (preview), HTML editor (code + live
                  preview), repeaters (dynamic row groups)
  MasterCrud.tsx  Generic list + create/edit drawer + delete confirm, wired to
                  Laravel resource routes (POST + _method=PUT/DELETE)
  primitives.tsx  Modal · Drawer · ConfirmDialog · Checkbox · Switch · Tabs ·
                  Skeleton · EmptyState · Banner · StatusChip
  toast.tsx       Global toast notifications
  print.ts        printElement() — legacy printDiv() equivalent (hidden iframe)

app/result/
  page.tsx                      Module hub (searchable card launcher, 3 categories)
  master/[slug]/page.tsx        All config-driven masters (one dynamic route)
  master/exam-master/page.tsx   Tabbed: Exam master + Exam type master
  master/grade-master/page.tsx  Tabbed: Grade scales + Grade data
  marks-entry/ co-scholastic-marks/ templates/ hpc-activity-entry/
  hpc-entry-v1/ approve-mobile-result/ upload-result/ student-attendance/
  reports/ (+ marks-approval, classwise-grade, consolidate, wrt, wrt-progress)
  report-card/ (+ cbse-1t5, cbse-t2, cbse-11, cnse-11)
  student-result-remarks/
```

Routes are registered in `app/data/routeMapper.ts` for both `result/{resource}` and
`{resource}.index` menu-link formats. The two pre-existing mappings
(`result/marks_entry` → `/exam/marks-entry`, `result/exam_master` → `/exam/exam-master`)
were left untouched; the enhanced versions of those screens live at
`/result/marks-entry` (adds the approve flow, auto grade/percentage, validation) and
`/result/master/exam-master` (adds the Exam-type tab). Repoint the two mappings when
ready to switch.

## 2. Key UX improvements over the Blade screens

- **Cascading filters with disabled states** — downstream selects stay disabled until
  their dependency is chosen and reset automatically when it changes (the Blade pages
  silently kept stale selections).
- **Drawer-based create/edit** replaces full-page add/edit reloads; the list keeps its
  scroll position, filters and page.
- **Explicit approve flows** — approving marks asks for confirmation, then locks the
  grid with a visible "Approved" status chip (Blade only disabled inputs silently).
- **Live derived values** — percentage and grade compute as marks are typed, with
  AB / N.A. / EX handled as first-class values.
- **Tables** get global + per-column search, sort, pagination, column visibility and
  client exports on every list (Blade had DataTables on some screens only).
- **States everywhere** — loading skeletons, empty states with next-step hints, error
  banners with retry, toasts for save/delete outcomes.
- **Sentence-case microcopy**, required-field markers, helper texts, and keyboard/ARIA
  support (dialogs trap Escape, tables and radios are focusable, chips never rely on
  color alone).

## 3. Forms

Built with **React Hook Form + Zod** (`DynamicForm`). Fields are grouped into logical
sections with overline headings (e.g. Result master → Scope / Key dates / Display
rules / Signatures). Validation mirrors the contract: `required` rules, max lengths,
file/image acceptance; marks inputs additionally enforce the "≤ out-of, or AB/N.A./EX"
rule from the Blade JS. Repeaters cover the dynamic-row patterns (exam creation rows,
sub-activities, co-scholastic grade rows 1–5) and serialise to the exact bracketed
keys Laravel expects (`title[0]`, `co_grade[2][break_off]`, `values[12][points]`, …).

## 4. Responsive plan

- Filter grids: 1 col (mobile) → 2 (sm) → 3 (lg) → 4 (xl).
- Tables scroll horizontally inside their card with sticky headers; entry matrices
  (HPC v1) additionally pin the first column.
- Drawers become full-width sheets under `sm`; hub cards collapse 4 → 2 → 1 columns.
- Touch targets ≥ 36 px; print views use dedicated print CSS via `printElement`.

## 5. API integration points (verify on the backend)

All paths are relative to the Laravel API base and follow the
`result/{resource}` convention observed on `result/marks_entry`. Each screen's
endpoints live in exactly one place (its config in `lib/result/masters.ts` or the
constant at the top of its page), so corrections are one-line changes:

| Area | Endpoints used |
|---|---|
| Shared dropdowns | `api/get-grade-list`, `api/get-standard-list`, `api/get-division-list`, `api/get-subject-list`, `api/get-exam-master-list`, `api/get-exam-list`, `api/get-co-scholastic-parent-list`, `api/get-co-scholastic-list`, `api/get-activity-master-list`, `getActivityLists`, `getCreateExamName`, `ajax_StandardwiseSubject` |
| Marks entry | `result/marks_entry/create`, `result/marks_entry`, `result/approve` |
| Co-scholastic | `result/co_scholastic_marks_entry(/create)`, `result/co_scholastic_marks_entry_approve`, `result/co_scholastic`, `result/co_scholastic_master` |
| Masters (resource) | `result/result_activity_master`, `result/result_skillset`, `result/exam_master`, `result/exam_type_master`, `result/exam_creation`, `result/grade_master`, `result/std_grd_maping`, `result/result_master`, `result/result_book_master`, `result/result_remark_master`, `result/working_day_master`, `result/student_attendance_master`, `result/result-template` |
| Entry (other) | `result/result_activity_marks(_V1)(/create)`, `result/approve_mobile_result(/create)`, `result/upload_result(/create)` |
| Reports | `result/show_result_report`, `result/getMarksApproval`, `result/classwise_grade_report/create`, `result/consolidate_report/create`, `result/WRT_report/show_result`, `result/WRT_progress_report/show_result`, `result/cbse_1t5_result/show_result`, `result/cbse_1t5_t2_result/show_result`, `result/cbse_11_t2_result/show_result`, `result/student-result(/create)`, `result/student-result-remarks(/create)`, `result/save_result_html`, `result/save_result_html_new`, `result/cbse_1t5_result/download_overall_report`, `result/view_all_result_tag` |

Updates/deletes use Laravel method spoofing: `POST {resource}/{id}` with
`_method=PUT|DELETE`. Payload parsing is defensive (`readString` / `asRecord` /
`toCollection`) because list payload shapes vary between endpoints.

## 6. Accessibility

WCAG 2.2 AA-oriented: visible focus rings on every interactive element, `role`/`aria`
on dialogs, tabs, radiogroups and listboxes, `aria-live` toasts, labels tied to
inputs, status conveyed by text + chip (never color alone), Escape closes overlays,
body scroll locked under modals, reduced reliance on hover-only affordances.
