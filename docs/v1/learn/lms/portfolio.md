# Portfolio
**Product:** Scholar Learn | **Module:** LMS | **Frontend route:** `/lms/portfolio` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | TBD — via `lmsPortfolioController`; data fetched via `fetchPortfolioItems()` and `createPortfolioItem()` in `app/lms/data/portfolio.ts` |
| Roles | Student (create/view own), Teacher (view student portfolios), Admin |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users
Students maintain a digital portfolio of their best work — projects, assignments, lab work, art & craft, and certificates. Teachers can view student portfolios. Used throughout the academic year to showcase learning progress.

## 2. Screens

### Portfolio list — `/lms/portfolio`
Shows: tab filter (All / Project / Assignment / Lab Work / Art & Craft / Certificate), grid of portfolio items with title, subject, type, description, file attachment, and rating stars.
Main actions: add portfolio item, filter by type, search.
![](./screenshots/portfolio.png)

### Add Portfolio modal
Shows: title, subject, type selector, description, file upload.
Main actions: save.

## 3. Features & business rules

| Field | Type | Required | Validation | Default |
|---|---|---|---|---|
| Title | Text | Yes | Non-empty | — |
| Subject | Text | No | — | `Science` (placeholder default) |
| Type | Select | Yes | One of: Project, Assignment, Lab Work, Art & Craft, Certificate | `Project` |
| Description | Textarea | Yes | Non-empty | — |
| File | File upload | No | MIME + size (MAX_UPLOAD_BYTES) | — |

Type constants: `['All', 'Project', 'Assignment', 'Lab Work', 'Art & Craft', 'Certificate']`

Portfolio items are owned by the student who created them. Teachers view in read-only mode.

## 4. User flows

**Student adds work:**
1. Open `/lms/portfolio`.
2. Click "+ Add".
3. Fill modal — title, subject, type, description, optional file.
4. Save → `createPortfolioItem()`.
5. Item appears in grid under its type tab.

**Filter view:**
1. Click a type tab (e.g. "Project").
2. Grid filters to show only that type.

## 5. Data model

| Table | Key columns | Notes |
|---|---|---|
| `lms_portfolio` | `id`, `sub_institute_id`, `student_id`, `title`, `subject_name`, `type`, `description`, `file_path`, `rating`, `created_at` | From `PortfolioItem` type |

`PortfolioItem` type (from `data/portfolio.ts`):
```
{ id, title, subjectName, type, description, filePath?, rating?, createdAt }
```

## 6. APIs

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | (TBD) | JWT | List portfolio items — `fetchPortfolioItems()` |
| POST | (TBD) | JWT | Create item — `createPortfolioItem()` |

## 7. UI components & design tokens
- `AddPortfolioModal` — inline modal
- Type tab filter bar
- Rating stars display
- Lucide icons: `Award`, `BookOpen`, `CheckCircle2`, `FileText`, `Filter`, `FolderPlus`, `MessageSquare`, `Plus`, `RefreshCw`, `Search`, `Star`, `Upload`, `User`, `X`
- `Skeleton` pulse for loading state

## 8. Reports & exports
No dedicated export in v1. Items have `file_path` for download.

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| PF-01 | Student adds project | Fill modal with title + description + file, save | Item in grid under Project tab | Happy |
| PF-02 | Filter by type | Click "Assignment" tab | Only assignment items shown | Happy |
| PF-03 | Missing description | Save without description | Error "Please write a short description" | Negative |
| PF-04 | Missing title | Save without title | Error "Please enter a title" | Negative |
| PF-05 | File upload | Attach file, save | Item shows download link | Happy |

## 10. Known issues, limitations & FAQs
- Subject field defaults to `Science` — teacher and subject are not linked; student types freeform subject name.
- No teacher feedback or rating mechanism visible in v1 frontend code.

## 11. Sales notes
- **Selling point**: digital showcase of student work — parents can see their child's portfolio; reduces reliance on physical portfolios.
- **Demo flow**: (1) Student uploads science project; (2) teacher opens student portfolio view; (3) filter to show certificates.
- Plan/pricing: TBD.

## 12. v1 status & v2 ideas
- v1: Complete. Create, type-filter, file attachment functional.
- v2: Teacher feedback and rating; parent-visible portfolio; share portfolio as PDF; link portfolio items to learning outcomes.

## Source files
- `C:\rajesh\lms_k12\app\lms\portfolio\page.tsx`
- `C:\rajesh\lms_k12\app\lms\data\portfolio.ts`
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\lms\lmsPortfolioController.php`
