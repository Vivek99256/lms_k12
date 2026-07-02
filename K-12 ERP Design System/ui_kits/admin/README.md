# Admin Console — UI Kit

A high-fidelity, interactive recreation of the **EduERP** K–12 administrator console, composed entirely from the design system's components and tokens.

## Run
Open `index.html`. It loads `../../styles.css` + `../../_ds_bundle.js` (the compiled component library), then the screen scripts.

## Screens & flows
- **Dashboard** (`Dashboard.jsx`) — KPI strip, fee-collection chart, pending-approvals panel, activity feed, quick actions.
- **Students** (`Students.jsx`) — list-page template: filter bar (search + class + density), sortable/selectable `DataTable`, row menu, pagination. Click a row → **Student detail**.
- **Student detail** (`StudentDetail.jsx`) — detail/profile template: identity header, tabs (Overview / Fees / Attendance / Documents), description lists, activity timeline.
- **Admissions** (`Admissions.jsx`) — approval template: queue table → review **Drawer** with comment thread → **ConfirmationDialog** → success **Toast**.
- **Fees** (`Fees.jsx`) — dues table → collect-payment **Modal** (form) → receipt **Toast**.

Other sidebar modules render a placeholder that points back to these canonical patterns.

## Notes
- Every visual comes from design-system components (`window.EduERPDesignSystem_<hash>`); the kit only adds layout scaffolding in `kit.css`.
- Sample data lives in `data.js` (fictional). No real records.
- Recreation is faithful to the source spec's layouts (03), templates (04), components (05) and patterns (06).
