# Admission Follow-Up
**Product:** Scholar Core | **Module:** Admissions | **Frontend route:** `/admissions/admission_followUp` | **v1 status:** Complete

| Field | Value |
|---|---|
| Backend routes | `GET /admission/admission_enquiry` (enquiry options), `POST /admission/admission_follow_up`, `GET` (follow-up report via `inquiry_followup` report endpoint) |
| Roles | Admin, Admissions Staff, Counsellor |
| Last updated | 2026-11-04 |
| Source commit | 8fe500dc (FE) / 86261072 (BE) |

## 1. Purpose & users

The Follow-Up screen is an agenda/activity-feed view that shows what follow-up actions are scheduled or already done for admission enquiries. Staff can quickly see upcoming follow-up tasks grouped by date and a communication log of recent follow-up activity. They can also create new follow-up reminders for any open enquiry.

There is no separate dedicated follow-up calendar endpoint on the backend. This screen reuses the **Inquiry Follow-Up Report** endpoint (same data as `admission_reports/inquiry-followup`) and reshapes the rows into two panels: upcoming tasks and a communication log.

**Primary users:** Admissions coordinator, Counsellor  
**When used:** Daily — to check what follow-ups are due today and log new ones.

## 2. Screens

### Follow-Up Agenda
**Route:** `/admissions/admission_followUp`  
**What is shown:**
- Two panels side by side:
  - **Upcoming tasks:** Follow-up items sorted by date (day + weekday + student name + standard).
  - **Communication log:** Last 8 follow-up activities showing initials, actor, action text, student name, and time ago.
- "+ New reminder" button to open the New Reminder modal.

![](./screenshots/follow-up-agenda.png)

### New Reminder Modal
Opened by clicking "+ New reminder".  
**Fields:**
- Enquiry (dropdown, required) — dynamically loaded from `GET /admission/admission_enquiry`
- Follow-up date (date, required) — defaults to today
- Status (select, required) — `open` / `closed`
- Remarks (textarea, optional)

**Validation:** enquiryId and followUpDate must be non-empty before submission.  
**On success:** modal closes, task list reloads.

![](./screenshots/follow-up-new-reminder.png)

## 3. Features & business rules

### Data sourcing
- Both the task list and communication log are built from the **Inquiry Follow-Up Report** (`inquiry_followup`) filtered for a rolling window: 30 days ago → 14 days ahead.
- The report endpoint returns one row per enquiry with its most recent `follow_up_date` and `followup_remark`.
- **Tasks panel:** rows with a parseable `follow_up_date`, sorted ascending by that date.
- **Communication log panel:** rows with a non-empty `followup_remark`, sorted descending by date, capped at 8 entries.

### New follow-up creation
- Calls `POST /admission/admission_follow_up` (proxied through `/api/proxy?path=admission/admission_follow_up`).
- Payload includes: `type: "API"`, `sub_institute_id`, `enquiry_id`, `follow_up_date`, `status`, `remarks`, `module_type: "admission_enquiry"`.
- Backend is `admissionFollowUpController@store`.

### Follow-up task display format
Each task card shows:
- Day number (zero-padded, e.g., "09")
- Weekday abbreviation (e.g., "MON")
- Title: "Follow-up — {student name} ({admission standard})"

### Communication log display format
Each entry shows:
- Initials badge (up to 2 letters from student name, rotating colour palette: indigo/amber/slate)
- Actor: always "Admissions team" (the backend follow-up table has no actor field)
- Action: "logged a follow-up with {student name}"
- Time ago: "Today", "1 day ago", or "{n} days ago"

### Session requirements
- `baseUrl`, `subInstituteId`, `syear` must all be present in session. If missing, an error is thrown before any API call.

## 4. User flows

### Happy path — View upcoming follow-ups
1. Navigate to `/admissions/admission_followUp`.
2. `fetchFollowUpTasks()` calls the inquiry follow-up report for the rolling window.
3. Tasks panel renders sorted by date.
4. Communication log panel renders last 8 entries.

### Happy path — Create new reminder
1. Click "+ New reminder".
2. Modal opens; enquiry dropdown loads from `GET /admission/admission_enquiry`.
3. Select an enquiry, set date, optionally add remarks.
4. Click Save.
5. `POST /admission/admission_follow_up` fires.
6. Modal closes; task list reloads.

### Error paths
- Session missing → "Session is missing API base URL, sub institute, or academic year."
- Backend fails → modal shows error "Couldn't create the reminder. Try again."

## 5. Data model

### Backend table: `admission_follow_up` (inferred from controller)

| Column | Type | Notes |
|---|---|---|
| `id` | bigint PK | |
| `enquiry_id` | bigint | FK to `admission_enquiry.id` |
| `follow_up_date` | date | Scheduled follow-up date |
| `status` | varchar | open / closed |
| `remarks` | text | Notes from counsellor |
| `module_type` | varchar | `admission_enquiry` |
| `sub_institute_id` | int | Multi-tenant |
| `created_on` | timestamp | |
| `created_by` | int | |

> Note: No actor name field in the table; the communication log always shows "Admissions team" as actor.

### Report rows used (from `inquiry_followup` report)

| Field | Usage |
|---|---|
| `enquiry_id` | Task/log ID |
| `enquiry_no` | Fallback for display |
| `student_name` | Display name |
| `father_name` | Fallback if no student name |
| `admission_std` | Standard shown in task title |
| `follow_up_date` | Date for tasks panel (dd-mm-yyyy format) |
| `followup_remark` | Remark for communication log |
| `enquiry_date` | Fallback date for communication log |

## 6. APIs

| Method | Endpoint (proxied) | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/api/proxy?path=admission/admission_enquiry&type=API&sub_institute_id=&syear=` | Bearer JWT | Query params | `{ status_code: "1", data: EnquiryRow[] }` |
| POST | `/api/proxy?path=admission/admission_follow_up` | Bearer JWT | `{ type, sub_institute_id, enquiry_id, follow_up_date, status, remarks, module_type }` | `{ status_code: "1" }` |
| GET | Follow-up report (via `runAdmissionReport("inquiry_followup", …)`) | Bearer JWT | Date range + filters | Report rows |

## 7. UI components & design tokens

| Component | Used for |
|---|---|
| `NewReminderModal` (inline in page) | Create follow-up modal |
| `fetchFollowUpTasks`, `fetchCommunicationLog`, `createFollowUp`, `fetchEnquiryOptions` from `follow-up-agenda-api.ts` | Data layer |
| Lucide: `Plus, ArrowRight, X, Loader2` | Icons |
| `bg-indigo-50 text-indigo-600`, `bg-amber-50 text-amber-600`, `bg-slate-100 text-slate-600` | Log entry palette (rotating) |
| Tailwind utility classes | All layout and styling |

## 8. Reports & exports

No export from this screen. For a downloadable follow-up report, use:  
→ [Admissions Reports — Inquiry Follow-up Report](./reports.md)

## 9. Test cases

| ID | Scenario | Steps | Expected result | Type |
|---|---|---|---|---|
| AFL-01 | Load agenda | Navigate to `/admissions/admission_followUp` | Tasks and communication log render | Happy |
| AFL-02 | Tasks sorted by date | Multiple enquiries with different follow-up dates | Earliest date first | Happy |
| AFL-03 | Communication log capped | >8 enquiries with remarks | Only 8 shown, most recent first | Edge |
| AFL-04 | Create new reminder | Fill modal → submit | Follow-up created; task list refreshes | Happy |
| AFL-05 | Required field — missing enquiry | Submit without selecting enquiry | Form does not submit | Negative |
| AFL-06 | Required field — missing date | Clear date, submit | Form does not submit | Negative |
| AFL-07 | Session missing | No `sub_institute_id` in session | Error thrown; no API call | Negative |
| AFL-08 | Enquiry dropdown loads | Open modal | All open enquiries listed with names | Happy |
| AFL-09 | No follow-up rows | Empty report result | Tasks panel shows empty state | Edge |
| AFL-10 | Rows with no remark | Follow-up has no remark | Row excluded from communication log | Edge |

## 10. Known issues, limitations & FAQs

- **No actor field on follow-up records:** The backend table does not store who logged the follow-up. The communication log always shows "Admissions team" as the actor, regardless of which user saved it.
- **Task list is report-driven, not a live table:** The task panel reuses the inquiry follow-up report endpoint. If the report endpoint is slow, the agenda is slow.
- **Rolling window is fixed:** The agenda always shows ±14 days (30 days back, 14 days ahead). No way to look further ahead in v1.
- **Status options are hardcoded:** Only "open" and "closed" in v1. No "in progress" or custom status.

**FAQ:**
- *How is the communication log different from the task list?* — Tasks are upcoming follow-ups (future dates); the log shows follow-ups that already have a remark attached (past activity).
- *Can I edit a follow-up once created?* — Not from this screen in v1. Edit the enquiry in the Enquiry Roster and update the follow-up date there.

## 11. Sales notes

**Selling points:**
- Counsellors see their entire week's follow-ups in one glance — no spreadsheet, no calendar digging.
- One-click "New reminder" attached to any enquiry.
- Activity feed shows recent follow-up history across the team.

**Demo flow (3 steps):**
1. Show agenda: "Here are today's 5 follow-ups — all sorted by date."
2. Click "+ New reminder" → select enquiry → set date → save: "Reminder logged in seconds."
3. Show communication log: "And here's what the team did in the last week."

**Pricing:** Included in Scholar Core.

## 12. v1 status & v2 ideas

**v1 complete:** Task list (upcoming follow-ups), communication log (recent activity), new reminder modal.

**v2 ideas:**
- Full calendar view with month/week navigation.
- Actor attribution on follow-up records (store `created_by` name).
- WhatsApp/SMS shortcut from each task card.
- Filter tasks by counsellor.
- Mark a follow-up as done from the agenda directly.
- Extend rolling window with configurable date range.

## Source files

- `C:\rajesh\lms_k12\app\admissions\admission_followUp\page.tsx`
- `C:\rajesh\lms_k12\app\admissions\admission_followUp\_lib\follow-up-agenda-api.ts`
- `C:\rajesh\lms_k12\app\admissions\admission_reports\api.ts` (reused for report data)
- `F:\xampp\htdocs\next_lms_erp\app\Http\Controllers\admission\admissionFollowUpController.php`
- `F:\xampp\htdocs\next_lms_erp\routes\api.php` (follow-up route)
