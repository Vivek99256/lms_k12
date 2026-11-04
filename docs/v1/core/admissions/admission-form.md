# Admission Form (Form Master)
**Product:** Scholar Core | **Module:** Admissions | **Frontend route:** `/admissions/admission_form` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /admission/admission_master?type=API`, `POST /admission/admission_master?type=API` |
| Roles | Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

The Admission Form screen is the form builder/configurator for the three admission-stage forms: Enquiry Form, Registration Form, and Confirmation Form. Admin staff can see which fields are on each form, what custom fields have been added, and add new custom fields to any stage's form.

This screen does **not** accept applicant data — it configures the forms that applicants fill. It is used at the start of an admission season or whenever the school wants to add a new field.

**Primary users:** Admin, IT coordinator  
**When used:** Initial setup; when adding a new field to the admission process.

## 2. Screens

### Form Master List
**Route:** `/admissions/admission_form`  
**What is shown:**
- 3 form cards: Admission enquiry form, Admission registration form, Admission confirmation form
- Each card shows: title, applicable grades range, status (Published/Draft), field count, age validation rule, and a list of all fields with their types and required status.
- "Add custom field" button on each card.

**Main actions:** View form fields, add custom field to a stage.

![](./screenshots/admission-form-master.png)

### Add Custom Field Modal
Opened by clicking "Add custom field" on any form card.  
**Fields:** Field label (text, required).  
**What it does:** Adds a new column to the stage's DB table (enquiry / registration / confirmation) via `POST /admission/admission_master`.

![](./screenshots/admission-form-add-field.png)

## 3. Features & business rules

### Three admission stages and their DB tables

| Stage ID | Form title | DB table |
|---|---|---|
| AF | Admission enquiry form | `admission_enquiry` |
| RF | Admission registration form | `admission_registration` |
| CF | Admission confirmation form | `admission_form` (confirmation) |

### Field sources
- **Schema fields:** Columns from the stage's live table schema (returned as `enquryFields`, `RegistrationFields`, `confirmationFields` by the backend).
- **Custom fields:** Per-institute custom columns added via this screen (returned as `enquiryCustoms`, `registrationCustom`, `confirmationCustom`).

### Form status logic
| Condition | Status |
|---|---|
| `customFields.length > 0` | Published |
| No custom fields | Draft |

### Age validation rules
- Read from `ageValidation` array in the backend response.
- Shows: standard name + "as on {date}" for each rule.
- Configured separately; not editable from this screen.

### Adding a custom field
- User enters a field label.
- Frontend POSTs to `admission_master` with `table_name` (enquiry/registration/confirmation) and `{tableName}Fields: [fieldLabel]`.
- Backend adds the column to `tblcustom_fields` for the institute.
- The field appears on the form when the next enquiry/registration/confirmation is created.

### Grades display
- Shows the range of standards for which the form applies (e.g., "Nursery – 12 (15 grades)").
- Derived from the `standard` list returned by the backend.

## 4. User flows

### Happy path — View forms
1. Navigate to `/admissions/admission_form`.
2. `GET /admission/admission_master?type=API&sub_institute_id=&syear=` is called.
3. Three form cards render showing fields and status.

### Happy path — Add custom field
1. Click "Add custom field" on a form card (e.g., Enquiry form).
2. Modal opens asking for field label.
3. Enter label (e.g., "Sibling admission number").
4. Click Add.
5. `POST /admission/admission_master` with `table_name: "enquiry"` and `enquiryFields: ["Sibling admission number"]`.
6. On success: modal closes; form card reflects new field count on next load.

## 5. Data model

### Backend data source: `admission_master` endpoint
Combines:
- Live table schemas for `admission_enquiry`, `admission_registration`, `admission_form`
- `tblcustom_fields` where `status = "1"` and `table_name` matches the stage
- `standard` list (from `tblstandard` or similar)
- `ageValidation` rows (from `admission_age_validation` table)

### Table: `admission_age_validation`
Created by migration `2025_08_12_161202_create_admission_age_validation_table.php`.
Columns: TBD (not read in this scan; exact schema in that migration file).

### Table: `tblcustom_fields` (inferred from controller usage)

| Column | Purpose |
|---|---|
| `field_name` | DB column name |
| `field_label` | Display label |
| `field_type` | text / date / select etc. |
| `required` | "1" = required |
| `table_name` | enquiry / registration / confirmation |
| `status` | "1" = active |
| `sub_institute_id` | Multi-tenant |

## 6. APIs

| Method | Endpoint | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/admission/admission_master?type=API&sub_institute_id=&syear=` | JWT / session | Query params | `{ standard[], ageValidation[], enquryFields[], RegistrationFields[], confirmationFields[], enquiryCustoms[], registrationCustom[], confirmationCustom[] }` |
| POST | `/admission/admission_master?type=API&sub_institute_id=&syear=` | JWT / session | `{ table_name, {tableName}Fields: [label] }` | `{ status_code: "1" }` |

**Error cases:**
- `status: "2"` from backend → error message shown in UI.
- Stage ID not in `{AF, RF, CF}` → frontend throws "Unknown admission form stage".

## 7. UI components & design tokens

| Component | Used for |
|---|---|
| `AddCustomFieldModal` | Add field dialog |
| `ChevronRight`, `Loader2`, `X` (Lucide) | Navigation, loading, close icons |
| `erp-client`: `buildSessionContext`, `createAuthHeaders` | Auth headers |
| Tailwind utility classes | All layout and styling |
| `--primary-blue` | Button colour |

## 8. Reports & exports

No reports or exports from this screen. It is a configuration screen only.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AF-01 | Load form cards | Navigate to `/admissions/admission_form` | 3 cards shown with field lists | Happy |
| AF-02 | Add custom field to enquiry form | Click Add custom field → enter label → submit | Field appears in enquiry form card on reload | Happy |
| AF-03 | Empty label | Submit add field with blank label | Nothing submitted; no request | Negative |
| AF-04 | Age validation rules shown | Backend returns age validation | "as on {date}" per standard shown | Happy |
| AF-05 | Form status = Draft | No custom fields | Card shows "Draft" | Edge |
| AF-06 | Form status = Published | Custom fields exist | Card shows "Published" | Happy |

## 10. Known issues, limitations & FAQs

- **Custom fields cannot be deleted or reordered from this UI.** Only adding is supported in v1.
- **Field type is always "text"** when added via this screen. No support for date, select, or checkbox custom fields in v1.
- **No required flag** on custom fields added here — always `required: false`.

**FAQ:**
- *How do I remove a custom field?* — Not possible through the UI in v1. Must be done directly in the database or by a backend developer.
- *Are custom fields shared across all standards?* — Yes, they apply to all grades for that stage.

## 11. Sales notes

**Selling points:**
- Schools can extend the admission form without developer help — just type the field name.
- Three-stage form configuration mirrors the actual admission lifecycle.
- Age validation rules visible at a glance per standard.

**Demo flow (2 steps):**
1. Show three form cards: "Every school's enquiry, registration, and confirmation forms are managed here."
2. Click "Add custom field" → type "Sibling admission number" → show it added in seconds.

**Pricing:** Included in Scholar Core.

## 12. v1 status & v2 ideas

**v1 complete:** View all three stage forms with schema + custom fields, add custom field.

**v2 ideas:**
- Delete / deactivate custom fields from the UI.
- Support field types: select (with options), date, checkbox, number.
- Drag-and-drop field ordering.
- Required / optional toggle per field.
- Preview mode showing the form as a parent would see it.

## Source files

- `C:\rajesh\lms_k12\app\admissions\admission_form\page.tsx`
- `C:\rajesh\lms_k12\app\admissions\admission_form\_lib\admission-form-api.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\admission\admissionMasterController.php`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\admission\admissionFormController.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2023_03_05_115658_create_admission_form_table.php`
- `F:\xampp\htdocs\next_lms_erp\database\migrations\2025_08_12_161202_create_admission_age_validation_table.php`
