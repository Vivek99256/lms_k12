# 06 - DATABASE AUDIT

> Repos in scope: `D:\lms_k12` (Next.js frontend) and `D:\next_lms_erp` (Laravel backend). Static analysis only: no code modified, no server contacted, no `.env` read. Issue references are shown as `SOURCE-ID (LMS-AUDIT-###)`; unified IDs are defined in [14_MASTER_ISSUE_REGISTER.md](14_MASTER_ISSUE_REGISTER.md). Baseline: Laravel commit 0bd66fc3b; uncommitted V1 API-guard edits made during the audit are excluded (see the register header).

## Companion data files

- [parts/part11-migration-inventory.csv](parts/part11-migration-inventory.csv) - 1,084 migration files
- [parts/part11-table-inventory.csv](parts/part11-table-inventory.csv) - 827 tables (tenant column, model, first migration)
- [parts/part11-model-table-map.csv](parts/part11-model-table-map.csv) - 475 models -> tables

## Scope and limits

Static analysis only. The live database (a remote MySQL host) was never contacted and `.env` was not read, so the live schema, indexes, column types and row data are **NOT VERIFIED**. Memory notes from earlier work record that the live schema drifts from the migrations (e.g. `tblstudent` has no `roll_no`) and that 408 stale pending migrations would re-create live tables, so a bare `php artisan migrate` is unsafe here.

## 1. Scope & coverage

| Area/dir | Files in scope | Read fully | Skimmed (targeted read / grep) | Not reviewed | Notes |
|---|---|---|---|---|---|
| `database/migrations/*.php` | 1,084 (1 from 2014, 2 from 2019, 373 from 2023, 70 from 2024, 40 from 2025, 598 from 2026) | 19 read by hand (see below) | **all 1,084 parsed programmatically** (up/down bodies, `Schema::create/table/dropIfExists/rename`, `$table->...` column/index/FK calls incl. nested `if(!hasColumn)` blocks and `createIfMissing()` helper, raw `CREATE TABLE`/`ALTER TABLE`/`CREATE INDEX` SQL, DML ops, guards) | none | Parser is regex based: cannot see indexes/columns produced by loops over `const` arrays (3 such files were read manually and patched in: `2026_09_03_008900`, `2026_09_04_100000`, `2026_08_25_160000`), and cannot see column order (`after()`). |
| `database/pal_schema_full.sql` | 1 (371 lines, 27 `CREATE TABLE`) | parsed | all 27 tables are also created by migrations | - | duplicate schema source for PAL |
| `database/seeders`, `database/seeds`, `database/factories`, `database/data`, `database/neo4j` | 9 + 1 + 1 + 3 dirs + 3 dirs | 0 | `DatabaseSeeder` (calls 2 seeders), names only | 9 seeders' bodies, `database/neo4j/*` (cypher/JSON) | not schema-defining except menu/rights data |
| `app/Models/**` + `app/CareerIntelligence/Evidence/EvidenceEvent.php` | 474 + 1 = **475** | `loginModel`, `EmployeeMonthlySalaryData`, `send_late_sms`, `std_grd_maping` (x2), `LearnerNodeState` head | all 475 parsed (`$table`, `$primaryKey`, `$fillable`, `$guarded`, `$hidden`, `$casts`, `$timestamps`, `SoftDeletes`, `boot/addGlobalScope`, relations, traits); reference index over 4,094 PHP files | - | model reference counts are name-token based (upper bound; duplicates share a name) |
| `config/database.php`, `config/neo4j.php` (`triggered` list), `phpunit.xml`, `tests/` | 4 dirs/files | `config/database.php`, `phpunit.xml`, `Console/Kernel.php::bootstrap` | tests grepped for DB traits / DDL | - | |
| Code-vs-schema drift | `app/**` builder/joins (615 distinct table names via `DB::table/from/join`) | - | regex extraction, compared with migration table list | tables reached only via raw SQL strings | |
| Route / API layer for traceability | `part10-laravel-route-inventory.csv` (3,094 routes) | - | controller -> route join by controller basename | - | |
| Frontend (for traceability only) | 2,062 `.ts/.tsx` files under `app/ lib/ components/ services/ hooks/ contexts/` | - | literal-path search of API paths | - | |

Migrations read by hand: `2023_03_05_115658_create_attendance_student_table`, `2023_06_10_233617_add_foreign_key_into_fees_refund_table`, `2023_10_06_112100_create_sharebazar_position_table`, `2026_09_01_000001_add_unique_enrollment_no_to_tblstudent`, `2026_08_25_160000_correct_student_role_menu_rights`, `2026_09_18_120000_reset_cfu_attempts_for_reordered_learning_cycle`, `2026_08_31_000002_drop_display_id_from_evidence_events_table`, `2026_09_11_114052_rename_engagement_score_to_exam_accuracy`, `2024_10_18_120053_add_column_lms_curriculum`, `2026_08_18_172423_alter_tblstudent_password_column_length`, `2025_02_13_144313_add_columns_month_ids`, `2026_08_21_100100_create_neo4j_sync_triggers`, `2026_09_03_008900_brain_erp_lookup_indexes`, `2026_09_04_100000_add_lms_engagement_indexes`, `2026_09_11_100400_add_platform_services_menu_rows`, `2026_09_05_220000_alter_sub_std_map_for_g2g_lms`, `2026_09_05_230100_create_lms_assignments_table`, `2026_08_20_100800_add_task_management_missing_columns_to_task_table`, `2026_01_01_000000_organization`.

Not reviewed: live database (schema, indexes, engines, row counts, data quality, backups, privileges), the 9 seeder bodies, `database/neo4j/*`, the Neo4j side, query plans.

---


## 2. Module inventory (inventories with totals)

### 2.1 MIGRATION INVENTORY

| Metric | Value | Note |
|---|---|---|
| Migration files (only path: `database/migrations`) | **1,084** | no other migration paths exist (`git ls-files` = 1,084; `.claude/worktrees/*` and `.kilo/worktrees/*` copies excluded) |
| Style | 1,071 anonymous-class, 13 named-class (`Create...Table`) | no class-name collisions |
| Files sharing one timestamp with others | 370 files in 44 groups; **279 files carry the single timestamp `2023_03_05_115658`** (bulk schema dump) | order within a group is alphabetical; 1 malformed name `2025_11_14_add_missing_columns_to_result_reportcard_marks_table.php` (no time component) |
| Kind (by `up()` content) | create 565 / alter-only 223 / raw-SQL or data-only 281 / **FK-stub 7** / other 8 | see 2.1.2 |
| Distinct tables created | **827** = 723 via Schema builder (incl. 14 via a private `createIfMissing()` helper in 2 files) + 104 via raw `CREATE TABLE` SQL (all `hpbrain_*`) | BE-25 (LMS-AUDIT-350) said 708: it missed the helper-created and raw-SQL tables |
| Tables by family | hpbrain 107, pal 73, lms 64, s_ 46, fees 35, ai 35, result 26, h5p 23, task 21, o_net 18, talent 18, inventory 18, student 15, hrms 14, tblstudent 13, transport 10, wk 8, hostel 7 | |
| Tables created by more than one migration | **84** = **68 columnless FK-stub creates** + **16 genuine duplicate creates** | see 2.1.2 and 2.1.3 (BE-25 (LMS-AUDIT-350)'s "84" is right but 68 of them are the stub files, not true re-creation) |
| Tables altered but never created by any migration | **3**: `result_reportcard_marks` (`2025_11_14_add_missing_columns...`), `result_personalize_marks` (`2026_02_24_102900`), `neo4j_sync_queue` (`2026_08_21_100000`, `2026_09_04_140000`) | + `sync_log`, `tblprofilewise_menu` etc. are *queried* by code / triggers but appear in no migration at all (2.3.4) |
| Dropped-then-recreated | 1: `2023_10_06_112100_create_sharebazar_position_table` runs `Schema::dropIfExists('sharebazar_position')` immediately before its `create` | table belongs to a stock-market domain foreign to a school ERP |
| Renamed tables / columns in `up()` | 0 tables; 6 files rename columns (`2025_01_09_173010`, `2025_02_13_144313` (`fees_late_master.term_id` -> `month_id`), `2026_05_15_114234`, `2026_06_17_120407`, `2026_09_11_114052`, `2026_09_21_110000`) | |
| Ordering conflicts (alter before create, FK to a later-created table) by timestamp order | **0** found | the real ordering problems are duplicates and never-created tables, not timestamps |
| Migrations with **no `down()`** | 0 | all have the method |
| Migrations with an **empty `down()`** (comment only / no-op) | **35** | BE-25 (LMS-AUDIT-350) said 2. Includes data-changing ones that cannot be undone: `2026_09_18_120000_reset_cfu_attempts_for_reordered_learning_cycle` (bulk UPDATE), `2026_08_24_150000_seed_default_proficiency_scale`, `2026_09_14_000005_restore_fees_ai_workspace`, `2026_09_01_000001_enable_student_intervention_workflow` and `2026_09_01_000002_publish_single_approval_academic_intervention_workflow`, `2026_09_21_100100_seed_pal_flow_shipped_profiles`, `2026_09_28_100500_rename_generic_module_templates...`; plus ~10 `brain_*` "make nullable / widen / precision" ALTERs and the 3 `pal_diagnostic_*` creates (full list: `down_empty=Y` in the CSV) |
| Migrations whose `down()` drops a table | **673** | `migrate:rollback` / `migrate:reset` would drop live tables (Kernel guard does not block these, see DB-09 (LMS-AUDIT-183)) |
| `create` migrations without a `hasTable` guard | **492 of 572** create-type files (485 of 565 real creates; 333 of them from 2023) | matches BE-25 (LMS-AUDIT-350)'s 492 |
| `alter` migrations without a `hasColumn` guard | 133 of 223 alter-only files (139 of the 237 files that contain any `Schema::table`; 34 unguarded from 2023, 42 from 2024) | a re-run fails with "duplicate column" |
| Raw `DB::statement` / `DB::unprepared` | **713 statements in 167 files** | mostly `hpbrain_*` DDL ported verbatim, triggers, `MODIFY`, `CREATE INDEX` |
| Data-writing migrations (`insert/update/delete/upsert`) | **150 files** (insert 110, delete 105, update 87, upsert/updateOrInsert 6) | menu/rights/workflow/template seeding lives in the schema history: 74 files touch `tblmenumaster`, 50 touch `tblgroupwise_rights`/`tblindividual_rights` |
| `DELETE` in `up()` | 5 files (`seed_ai_workspace_config`, `seed_course_catalog_ai`, `correct_student_role_menu_rights`, `move_teach_learn_course_catalog_to_onboarding`, `restore_teach_learn_operations_course_catalog`) | |
| `->change()` / `MODIFY` / `dropColumn` / `rename` in `up()` | change 10, MODIFY/ALTER COLUMN 13, dropColumn 3, rename 6, DROP TRIGGER/INDEX/FK 3 | listed in 2.1.4 |
| `TRUNCATE` | 0 | |
| Migrations using a transaction | 3 | DDL auto-commits on MySQL anyway |
| `migrate:status` reality (memory 2026-09-22) | 410 pending of 1,084 | `migrations` table never backfilled |

#### 2.1.1 Tables with a real Schema builder `create` and their guard status by year
2014-2019: 3 files unguarded; 2023: 333 unguarded / 0 guarded; 2024: 31 / 0; 2025: 23 / 0; 2026: 95 unguarded / 80 guarded. Only the 2026 Brain / PAL / platform work uses `hasTable` guards.

#### 2.1.2 The 7 "add_foreign_key" migrations are structurally broken (new finding, DB-01 (LMS-AUDIT-179))
Files: `2023_05_10_233617_add_foreign_key_into_access_log_route_table`, `2023_05_10_233617_..._batch_table`, `2023_06_10_233617_..._exam_schedule_table`, `2023_06_10_233617_..._fees_refund_table`, `2023_06_11_233617_..._inventory_item_quotation_details_table`, `2023_06_12_233617_..._inventory_item_lms_mapping_type_table`, `2023_06_12_233618_..._inventory_item_lms_mapping_type_table`.
Each `up()` contains **69 `Schema::create('<existing table>', function($table){ $table->foreign(...) ... })` calls with no columns at all** (159 FK declarations, `result_create_exam` three times), followed by `Schema::table(...)` blocks. `Schema::create` of an existing table throws error 1050; of a missing table emits `CREATE TABLE t ()` (syntax error). 9 of the 161 FK declarations reference columns that do not exist in the table (`result_create_exam.student_id/grade_id/division_id`, ...), and three reference tables that do not exist (`hostel_type_id`, `tbl_user`, `s_user_jobrole`). Net effect: **none of the foreign keys these files describe (fees_collect->tblstudent, homework->standard/subject/division, attendance, hostel, inventory ...) can ever have been applied by migration.**

#### 2.1.3 Genuine duplicate creates (16 tables)
`lms_competency_standards` (`2026_05_21_101524` and `2026_05_28_165851`, both unguarded - second always fails), `result_sub_activity` (`2024_09_03_114740_create_...` and `2024_09_10_161054_add_columns_hpc_report`, both unguarded), `failed_jobs` (2019 unguarded + `2026_09_03_010100` guarded), `jobs`, `job_batches` (`2026_08_20_000001` + `2026_09_03_010100`), `lms_assignments` (`2026_08_21_090600_add_competency_link_to_lms_assignments_table` *creates* it if missing, then `2026_09_05_230100_create_lms_assignments_table`), 9 `s_performance_*` tables (`2026_08_18_112000` unguarded + `2026_08_21_150000` guarded), `talent_onboarding_activity_log`.

#### 2.1.4 Migrations that would be destructive or irreversible on production
| Migration | Effect | Reversible? |
|---|---|---|
| `2023_10_06_112100_create_sharebazar_position_table` | `dropIfExists` before create | data lost if rerun |
| `2026_08_25_160000_correct_student_role_menu_rights` | `DELETE FROM tblgroupwise_rights WHERE menu_id IN (231,236,275,327,96,153,154,311) AND profile_id IN (all 'Student' profiles of every tenant)` + `UPDATE ... can_add/edit/delete=0` for menu ids 230,269,270,242,464,426; inserts 3 grants | hard-coded **numeric menu ids** (ids are not stable across databases - other menu migrations key on `link` precisely for that reason); deleted rows are not restorable |
| `2026_09_18_120000_reset_cfu_attempts_for_reordered_learning_cycle` | `UPDATE learner_node_state SET cfu_attempts=0 WHERE cfu_passed_at IS NULL AND cfu_attempts>0` across all tenants | empty `down()` |
| `2025_02_13_144313_add_columns_month_ids` | `fees_late_master.late_date` string(10) -> `date` (`change()`) and `term_id` -> `month_id` on a live fees table | `down()` re-changes back but non-date strings would be lost |
| `2026_08_31_000002_drop_display_id_from_evidence_events_table`, `2026_08_31_000003_convert_evidence_id_to_autoincrement` | drop column / PK conversion on `evidence_events` (documented APPEND-ONLY evidence ledger) | down re-adds an AUTO_INCREMENT UNIQUE column |
| `2024_10_18_120053_add_column_lms_curriculum` | `dropColumn('subject_curricula')` (inside hasColumn) | column data lost |
| `2026_08_18_172423_alter_tblstudent_password_column_length` | `ALTER TABLE tblstudent MODIFY password VARCHAR(255) NULL` (raw) | down narrows back to 50 (truncates bcrypt hashes) |
| `2026_09_11_114052_rename_engagement_score_to_exam_accuracy` | rename + change + re-add column on `pal_learning_sessions` | |
| `2026_08_21_100100_create_neo4j_sync_triggers` | creates AFTER INSERT/UPDATE/DELETE triggers on `tblstudent`, `tblstudent_enrollment`, `tbluser`, `lms_online_exam` and ~30 tables from `config/neo4j.php['projections']['triggered']` writing to `sync_log` (which no migration creates) | `down()` drops triggers; see DB-10 (LMS-AUDIT-184) |
| 33 other "empty `down()`" data / seed migrations | see CSV (`down_empty=Y`) | no rollback |
| 673 create migrations' `down()` | `Schema::dropIfExists` of live tables | `php artisan migrate:reset/rollback` (not blocked by `Kernel::bootstrap()`) |

### 2.2 MODEL <-> TABLE MAP

| Metric | Value |
|---|---|
| Model classes | **475** (474 in `app/Models/**` + `EvidenceEvent`) - all extend `Illuminate\Database\Eloquent\Model` (one `Authenticatable`: `User`) |
| Table source | 433 explicit `$table`, 1 dynamic (`DynamicModel`), 42 by naming convention |
| Distinct tables mapped | 461 |
| Models whose table is created by a migration | 456 |
| Models whose table is **not** created by any migration | **18** (2.2.1) |
| Tables in migrations with **no model** | **382** of 827 (hpbrain 107, ai 33, pal 32, lms 30, s_ 24, fees 19, result 9, wk 8 ...; 310 of them are still queried through `DB::table`/raw SQL; **72 have zero references anywhere in `app/routes/config/tests`**) |
| Mass-assignment declarations | `$fillable` 321, `$guarded` 96 (**35 are `$guarded = []`**, i.e. everything fillable: 8 `Mobility*`, 23 `H5p*`, `contentLibraryModel`, `userActivityModel`, `organizationDetails`, `organizationSisterDetails`), **58 models declare neither** |
| `$hidden` | **1** (`User` -> `users` table, which the ERP does not use) |
| `$casts` present | 157; **0 use `encrypted` casts** |
| Soft deletes (`use SoftDeletes`) | 96 models; every one of those tables has a `deleted_at` column in the migrations (checked) |
| `$timestamps = false` | 166 |
| Global / tenant scopes (`addGlobalScope`, `ScopedBy`) | **0** (the single `booted()` hit is not a scope). Tenancy is 100 % per-query. |
| `$connection` overrides | 0 |
| Duplicate class basenames | 5: `AuditLog` x2, `FeesCollect` x2, `chapterModel` x2, `topicModel` x2, `std_grd_maping` x2 |
| Tables mapped by more than one model | 12: `fees_collect` x3 (`FeesCollect`, `fees_collect`, `FeesCollect`), `tbluser` x2 (`loginModel`, `tbluserModel`), `task` x2 (`Task`, `taskModel`), `caste`, `fees_breackoff`, `inventory_requisition_details`, `chapter_master`, `master_skills`, `topic_master`, `school_setup`, `student_quota`, `transport_kilometer_rate` (x2 each) |
| Data-access reality | `DB::table(` **7,217** call sites, `DB::select` 246, `DB::raw` 1,203, `whereRaw` 1,901 vs Eloquent; 615 distinct tables touched through the query builder; only 131 `DB::transaction/beginTransaction`, **6 `lockForUpdate` (all in `InventoryApiController`)** |

#### 2.2.1 Models whose table has no creating migration
| Model (file) | Table | Verdict |
|---|---|---|
| `ac_typeModel` (`fees/NACH`) | `NACH_ac_type` | migration creates lowercase `nach_ac_type`; **fails on case-sensitive Linux MySQL** |
| `studentChangeRequestTypeModel` | `STUDENT_CHANGE_REQ_TYPE` | migration creates `student_change_req_type`; same case problem |
| `co_scholastic_master` (`result/co_scholastic_master`) | `co_scholastic_master` | referenced by 4 controllers + routes; no migration; migrations only create `result_co_scholastic*` |
| `lmslmsData` | `lms_data` | 1 controller; no migration |
| `OnetCareerCluster`, `OnetContentModelReference`, `OnetOccupationData` | `onet_career_cluster`, `onet_content_model_reference`, `onet_occupation_data` | O*NET import tables created outside migrations |
| `ConceptMastery` (PAL) | `pal_concept_mastery` | used by scheduled `coherence-mastery-sweep` (Kernel:105) |
| `questioncategoryModel`, `questionlevelModel` | `question_category_master`, `question_level_master` | migrations only create `old_question_*_master` |
| `ReportDynamic` | `report_dynamic` | |
| `jobOccupation`, `jobroleSkillModel`, `jobroleTaskModel`, `MobilityJobRole` | `s_jobrole`, `s_jobrole_skills`, `s_jobrole_task`, `s_user_jobrole` | 69 query-builder hits on `s_user_jobrole` in `G2gLms/AiAssessmentController` alone |
| `send_late_sms`, `std_grd_maping` (`result/std_grade_maping`) | `send_late_smses`, `std_grd_mapings` (naming convention) | **empty stub classes** (`//` body), the second is shadowed by the working `std_grd_maping` (`result/std_grd_mapping`, table `result_std_grd_maping`) |

#### 2.2.2 Models never used
19 models have **zero references** in controllers, services, other models, routes and tests: `LmsCertificate`, `LmsCourseEnroll`, `LmsCoursePrerequisite`, `LmsCourseSetting`, `LmsIntegration`, `SuggestedCourse` (all `G2gLms/`), `AdaptiveResponse`, `RelationAudit` (PAL), `PerformanceActivityLog`, `TalentOnboardingActivityLog`, `IdempotencyKey`, `TaskPriorityOption`, `TaskStatusOption`, `feesRefundModel` (the fees refund controller uses raw `DB::table('fees_refund')`), `requisitionApprovedModel`, `ContentResourceMetadata`, `lb_pointsModel`, `tblapplicationModel`, `add_vehicle_type`. A further 14 are referenced only by other models (`CompetencyAssessment*`, `LmsTrainer`, `LmsVendor`, `DiagnosticResponse`, `ProjectMember`, `ProjectTask`, `TimeEntry`, `AttachmentVersion`, `DeadlineExtension`, `MobilityJobRole`).

#### 2.2.3 Models exposing sensitive columns through `$fillable` with no `$hidden`
`loginModel` and `tbluserModel` (-> `tbluser`: `password`, `plain_password`, `otp`, `account_no`, `ifsc_code`, `pan_no`, `fcm_token`), `tblstudentModel` (`password`, `otp`, `aadhar_document_upload`, `ifsc_code`, `pan_card`, `admission_token_no`), `tblclientModel` (`db_password`), `tblapplicationModel` (`app_secret_key`), `temp_signupModel` (`otp`), `virtualclassroomModel` (`password`), `admissionEnquiryModel` / `admissionRegistrationModel` (Aadhaar), `inventory_vendor_masterModel` (PAN, bank a/c, IFSC), `feesCircularMasterModel` (`account_no`), `tblfeesConfigModel` (`pan_no`), `tblstudentFeesDetailModel` (`ifsc_code`). None has `$hidden`; `loginModel` also lists `is_admin`, `user_profile_id`, `sub_institute_id`, `client_id`, `status` as fillable.

#### 2.2.4 Tables with no model (382) - the ones that matter
Fees: `fees_payment`, `fees_aggre_pay`, `fees_axis`, `fees_hdffc`, `fees_icici`, `fees_payphi`, `fees_razorpay`, `fees_reconciliation`, `fees_receipt`, `fees_receipt_css`, `fees_online_maping`, `fees_online_split`, `fees_cancel_type`, `fees_title_master`, `fees_month_header`, `fees_breakoff_other`, `fees_breackoff_logs`. Attendance: **`attendance_student`**. HR: `hrms_leave_allocation`, `hrms_departments_mapping`, `hrms_emp_payroll_deduction`, `hrms_salary_certificate`. Result: `result_activity_*`, `result_remarks`, `result_exam_approve`, `result_skillset`. Student: `tblstudent_siblings`, `tblstudent_fees_failure`, `tblstudent_bank_detail_log`, `tblstudent_doc_std_mapping`. Exam evaluation: `exam_evaluation_batch/sheet/answer`. Easy-com: `smtp_details`. AI: `ai_api_keys` (+ 32 more `ai_*`). LMS: 30 `lms_*`. Full list: filter `no_model=Y` in `part11-table-inventory.csv`.

### 2.3 TABLE INVENTORY AND ORPHANS

#### 2.3.1 Totals
827 tables; 532 with a `sub_institute_id` column (530 exact + 2 case variants `SUB_INSTITUTE_ID`/`SubInstituteId`); 103 keyed by `tenant_id` (Brain); 3 by `client_id`; 1 by `institute_id`; **188 with no tenant column at all** (section 4). 329 tables declare no index at all (only implicit PK); 175 tables have at least one non-PK unique index; effective FKs total 129 (72 on `hpbrain_*`, 57 on 41 other tables) - see section 4.

#### 2.3.2 Orphan tables (no reference anywhere in `app`, `routes`, `config`, `tests`): 72
65 `hpbrain_*` (`hpbrain_accreditation_*`, `hpbrain_ai_*` (8), `hpbrain_dashboard*` (3), `hpbrain_import_*`, `hpbrain_locations`, `hpbrain_roles`, `hpbrain_skills`, `hpbrain_students`, `hpbrain_tenants`, `hpbrain_themes`, ...), plus `ai_agent_tools`, `ai_policy_acknowledgements`, `chapter_topics`, `job_batches`, `lms_chapter_topic_mapping`, `lms_master_mapping`, `lms_practice_sessions`. The `hpbrain_*` block is a verbatim port of a separate "enterprise brain" product: 107 tables created in **two parallel copies of the same migration set** (`2026_01_01_0000xx_*` raw SQL, and `2026_09_03_*_brain_*` re-issuing them), yet the app reads only ~40 of them.

#### 2.3.3 Legacy / foreign-domain tables
`sharebazar_position/margin/pnl` (stock-market), `erptour`, `wk_*` (8 legacy workflow tables), `o_net_*` (18 O*NET reference tables), `blogs`, `csv_data`, `tblmenumaster_new`, `tblmenumaster_old`, `old_question_category_master`, `old_question_level_master`, `users` (Laravel default identity table, `email` unique, unused - the ERP identity table is `tbluser`), `password_resets`.

#### 2.3.4 Tables queried by code but created by no migration (43 distinct via builder; NOT VERIFIED whether they exist live)
Most consequential: **`tblprofilewise_menu`** (joined in `api/GroupwiseRightsApiController.php:149,341` for the rights UI; migration `2026_09_22_160000_add_homework_review_menu` inserts into it only `if hasTable`), **`sync_log`** (16 refs; written by 30+ DB triggers), `neo4j_sync_queue`, `ai_models` (guarded by `hasTable`), `fees_hdfcrazorpay` (5 refs in online fees controller), `lms_question_extraction`, `lms_question_asset`, `question_publisher`, `question_type_catalog` (all `ApiLmsCourseController`), `pal_concept_mastery`, `pal_vocabulary`, `s_jobrole*`, `s_user_jobrole`, `result_reportcard_marks`, `result_personalize_marks`, `co_scholastic_master`, `hrms_attendance`, `career_journey`, `org_designation`, `talent_mobility_requests`, `talent_offboarding_clearances`, `student_master`, `teacher_content`, `units`, `grades`, `audit_logs`, `lms_achievements`, `lms_concept_outcome`, `z_donardetails`, `onet_*` (9), `tblstudent_quota`, `college_fees_collect`.

---


## 3. Role / access-control findings (database layer)

| Topic | Finding | Evidence |
|---|---|---|
| Rights tables | `tblgroupwise_rights(menu_id,profile_id,can_view/add/edit/delete,sub_institute_id,...)` and `tblindividual_rights(user_id,menu_id,profile_id,...)` have **no index, no unique key on `(profile_id,menu_id,sub_institute_id)`, no FK to `tblmenumaster`/`tbluserprofilemaster`, all columns nullable** | `2023_03_05_115658_create_tblgroupwise_rights_table` / `..._tblindividual_rights_table`; duplicates rows are possible and the same table is read on every navigation and login (`MenuRightsController`, `PermissionService`, `loginController`) |
| Menu master | `tblmenumaster.sub_institute_id` and `client_id` are **`text NOT NULL` comma-separated id lists** (not ints); no index at all; menu entries are also created by 74 migrations that resolve parents by `link`/`name` | `create_tblmenumaster_table`; `2026_09_11_100400_add_platform_services_menu_rows` docblock ("comma-separated lists of institute and client ids") |
| Profiles | `tbluserprofilemaster` gained `role_key varchar(64)`, `data_scope enum(self,team,department,organization)`, `is_system` (migration `2026_08_19_175501`) - a sound direction, but the runtime still keys authorisation off the tenant-editable `name` (see BE part) | schema only |
| Users | `tbluser.is_admin int`, `status int`, `user_profile_id unsignedInteger` with no FK; `password varchar(100)` + `plain_password varchar(100)` + `otp varchar(10)`; one row per (person, tenant) with **no unique on `email`** (login is by e-mail; BE-29 (LMS-AUDIT-353)) | `create_tbluser_table`; a later Brain migration (`2026_09_03_008900`) adds `hpb_tbluser_email(email)` and a `(sub_institute_id,status,deleted_at)` index, the latter only if `tbluser.deleted_at` exists (absent from all migrations) - live NOT VERIFIED |
| Mass assignment | 35 `$guarded=[]` models, 58 with no declaration, `loginModel` fillable includes the role/tenant/status columns | section 2.2 |
| Data exposure | only one model has `$hidden`; `plain_password`, `otp`, `password` are returned by any `->toArray()`/`response()->json($model)` of the three identity models (BE-14 (LMS-AUDIT-061)) | `loginModel.php`, `tbluserModel`, `tblstudentModel` |
| DB accounts / least privilege | migrations and app share one credential set in `.env` (`DB_USERNAME`); the second connection named `information_schema` (`config/database.php:79-90`) actually targets the **Moodle database `triz_lms`** (`mdl_user`, used by `apiController.php:325,805`) with fallback username `dev_db`; a code comment says the password "remains in git history and must be rotated" | `config/database.php`; live privileges NOT VERIFIED |
| Legacy per-client DB credentials | `tblclient(db_host,db_user,db_password,db_solution,db_cms,db_hrms,db_library,db_lms)` - plaintext connection strings for a former multi-database-per-client design | `create_tblclient_table`; model `tblclientModel` fillable includes `db_password` |

---


## 4. Tenant / school / academic-year scoping findings (schema view)

Extends part10 section 4 (which covered controllers). Here: what the **schema** does and does not enforce.

### 4.1 Tenant columns
| Tenant key | Tables | Type in migrations |
|---|---|---|
| `sub_institute_id` (or `SUB_INSTITUTE_ID`/`SubInstituteId`) | **532** | unsignedBigInteger 234, integer 200, bigInteger 72, **string 20, text 3** (`admission_form`, `fees_paid_other`, `hrms_leave_allocation`, `inventory_tax_master`, `result_co_scholastic*` x4, `result_marks`, `result_remark_masters`, `result_std_grd_maping`, `result_student_attendance_master`, `result_working_day_master`, `rightside_menumaster`, `school_detail`, `smtp_details`, `tblmenumaster`, `tblmenumaster_new/old`) |
| `tenant_id varchar(36)` (Brain, UUID) | 103 + 4 `hpbrain_*` without any (`hpbrain_dead_letter_queue`, `hpbrain_consumer_state`, `hpbrain_health_checks`, `hpbrain_tenants`) | mapping tenant UUID <-> `sub_institute_id` lives in application code only |
| `client_id` (group of schools) | `school_setup`, `tblapplications`, `sharebazar_position` | int |
| `institute_id` | `onet_institute_courses` | |
| `sub_institute_id = 0` | convention for a global/template row in 19 migration literals (`onboarding_module`, `pal_architecture_settings`, `master_fields_table` ...) | unique keys including tenant treat 0 as a real tenant |
| **none** | **188** | see 4.2 |

Two coexisting tenant vocabularies (`sub_institute_id` vs `tenant_id`), plus `client_id`, plus uppercase variants in 39 tables with PascalCase/UPPER columns (`task.ID/SYEAR/STATUS`, `complaint.SUB_INSTITUTE_ID`, `result_exam_master.SubInstituteId varchar(255)`, `school_setup.Id/SchoolName`).

### 4.2 Tenant-owned data with **no tenant column in the migrations** (188 tables; frontend-relevant ones first)
| Group | Tables | Consequence |
|---|---|---|
| HR / leave | `hrms_emp_leaves` (keyed by `user_id`, no index), `hrms_holidays` (code filters `sub_institute_id` at `HrmsController.php:1225,1374` - column exists live but not in any migration: drift), `hrms_weekdays` | tenant isolation depends entirely on joining `tbluser` |
| Library | `library_books`, `library_items`, `library_book_circulations` (student-keyed) | whole library catalogue is cross-tenant at DB level |
| LMS exams / learner state | `lms_online_exam`, `lms_online_exam_answer(_student)`, `lms_online_exam_student`, `lms_offline_exam_answer`, `lms_question_mapping`, `lms_mapping_type`, `lms_student_profile`, `lms_concept_mastery(_log)`, `lms_forgetting_curve`, `lms_student_engagement`, `lms_class_insights`, `lms_teacher_interventions`, `lms_peer_tutoring_groups`, `lms_knowledge_graph`, `lms_content_metadata/recommendations/provenance`, `lms_units`, `lms_learning_outcomes/objectives` (27 total) | learner-keyed; the estate-wide question pool split (memory: `project_pal_calibration_tenant_split`) is only possible because `lms_question_master` has a tenant column |
| PAL | 45 `pal_*` tables created by `pal_schema_full.sql`-era migrations (`pal_learning_sessions`, `pal_assessment_results`, `pal_learner_states`, `pal_learner_misconceptions`, `pal_remediation_sessions`, `pal_telemetry_events`, `pal_learning_plans`, `pal_badges`, `pal_learner_streaks`, ...) | keyed by `learner_id`/`student_id`; `PalApiAuth` learner-ownership check (part10) is the only guard; `pal_concept_nodes`, `learner_node_state` (ESO, newer) do carry `sub_institute_id` |
| Students | `student_aspirations`, `student_ambitions`, `student_career_originality` (`student_id` **string**, `academic_year`), `student_change_request`(+`_req_type`), `student_document_type`, `temp_signup` (`institute_name`, `syear` string) | |
| Fees | `fees_receipt_css`, `fees_title_master`, `fees_cancel_type`, `fees_menu_categories/items` (masters, plausibly global) | |
| Other | `complaint_status`, `counselling_online_exam_answer`, `counselling_question_mapping`, `learning_outcome_*` (4), `form_builder`, `app_notification*`, `activity_log`, `access_log`(has `SUB_INSTITUTE_ID`), `err_log`, `s2_log`, `incoming_messages`, `evidence_events` (student-keyed, `academic_year`), `exam_evaluation_answer` (via sheet_id), `ptm_booking_master`, `role_responsibility`, `workflow_steps/versions`, `s_skill_matrix`, `s_assessment_library`, `s_mobility_talent_pool_members`, `talent_workflow_stages/approvers` | audit/notification tables cannot be filtered per tenant |

Global references legitimately without tenant: `tblcity`, `tblstate`, `religion`, `caste`, `blood_group`, 18 `o_net_*`, `password_resets`, `failed_jobs`, `personal_access_tokens`, `users`, `wk_*`.

### 4.3 Hot tables: tenant / year columns and indexes (from migrations; live NOT VERIFIED)
| Table | Tenant col (type) | Index on tenant | `syear` (type) | Index on `syear` | Other keys |
|---|---|---|---|---|---|
| `fees_collect` | `sub_institute_id` int | **no** | int | **no** | idx `student_id`, redundant idx on PK `id`; no unique on `receipt_no` |
| `fees_payment` | bigInteger NN | **no** | **string(150)** | no | **0 indexes**; `student_id varchar(150)`, `amount varchar(150)`; gateway ids in longText |
| `fees_refund` | bigInteger | no | bigInteger | no | idx `student_id` |
| `fees_cancel` | int NN | yes (+ syear, student, standard, term) | int | yes | only well-indexed fees table |
| `fees_breackoff` | int | yes | int | yes | 8-column composite unique |
| `fees_receipt_book_master` | int | no | int | no | idx `receipt_id`; `last_receipt_number varchar(50)` counter |
| `fees_title`, `fees_head_master`, `fees_late_master`, `fees_online_maping`, `fees_other_collection` | int | no | int / string | no | |
| `tblstudent` | bigInteger | yes | - | - | unique `(sub_institute_id, enrollment_no)` **added 2026-09-01 and skipped if duplicates exist** (live NOT VERIFIED) |
| `tblstudent_enrollment` | bigInteger | yes | bigInteger | yes | unique `(syear,student_id,term_id,sub_institute_id)` - `term_id` is nullable so uniqueness is not enforced for NULL terms |
| `tbluser` | int NN | conditional (Brain migration) | - | - | no unique `email`/`user_name`; `email` index only from `2026_09_03_008900` |
| `tbluserprofilemaster` | bigInteger NN | yes | - | - | |
| `attendance_student` | int (nullable) | **no** | int | no | idx `student_id`, `attendance_date`; **no unique `(student_id, attendance_date[, standard/section])`** |
| `timetable` | int NN | no | int NN | no | six single-column indexes (teacher/standard/period...), no composite with tenant/year |
| `result_marks` | **string NN** | no | none | - | **0 indexes**, no unique `(student_id, exam_id)` |
| `result_create_exam` | int NN | no | int NN | no | 0 indexes |
| `result_exam_master` | `SubInstituteId varchar(255)` | no | - | - | |
| `hrms_emp_leaves` | **none** | - | - | - | no index (not even `user_id`), `status enum` |
| `hrms_leave_allocation` | `text` | no | `year text(15)` | - | every column is TEXT (employee_id, leave_type_id, year, value, sub_institute_id) |
| `hrms_attendances` | unsignedBigInteger NN | no | - | - | no index on `(user_id, day)` |
| `tblmenumaster` | **text NN (CSV list)** | no | - | - | 0 indexes |
| `tblgroupwise_rights`, `tblindividual_rights` | int | **no** | - | - | 0 indexes |
| `homework`, `lms_assignment` | int | no | int | no | 0 indexes; `homework` declares 4 FKs only in a stub migration |
| `lms_question_master` | int | no | - | - | 5 indexes on concept/chapter/deleted_at; unique `(concept_id, question_type_id, g_content_hash)` |
| `task` | int | no | `SYEAR` int | no | legacy UPPER-case columns + new snake-case columns |
| `smtp_details` | **string NN** | no | - | - | |

Aggregate: of 532 tenant-column tables, **258 have an index containing the tenant column, 274 do not**; of 181 tables with `syear`, **27** index it and **7** have a `(sub_institute_id, syear)` composite. (BE-25 (LMS-AUDIT-350) counted 199 / 264; the difference is raw-SQL and const-array index migrations it could not see.)

### 4.4 Academic-year representation
`syear` in **182 tables**, but stored as integer (103), string (41), bigInteger (16), decimal (11), unsignedInteger (10) - inconsistent joins (`fees_payment.syear varchar(150)` vs `fees_collect.syear int`). Other spellings: `academic_year` (17 tables: `ai_*`, `evidence_events`, `student_*`, `library_books`, `workflow_runs`, `assessment_blueprint` which has **both** `syear` and `academic_year`), `year` (6 payroll/HR tables, `hrms_leave_allocation.year text`), `term_id` (27), `marking_period_id` (16; 9 tables carry both `syear` and `marking_period_id`). `academic_year(id, term_id, syear, sub_institute_id, start_date, end_date, ...)` is the calendar table, itself with no unique key.

### 4.5 Enforcement model
There is **no database-level or Eloquent-level tenant enforcement**: 0 global scopes across 475 models, 7,217 raw builder calls, 78 `FIND_IN_SET(...)` CSV-column lookups, 59 `LIKE '%...'`, no MySQL views/RLS, no per-tenant schemas (the legacy `tblclient.db_*` multi-DB design is vestigial). Every controller must remember `where('sub_institute_id', ...)`; part10 shows 228 controllers reading the tenant from the request. The only tenant-aware construct at DB level is the composite unique keys on the newer Brain/platform/onboarding tables (`onboarding_module (module_key, sub_institute_id)`, `workflow_definitions (workflow_key, sub_institute_id)`, `platform_notification_channels (sub_institute_id, channel)`, `user_dashboard_preferences (sub_institute_id,user_id,user_type,dashboard_key)`, ...).

---


## 5. Table -> Model -> Controller -> Service -> API -> Frontend traceability (43 most important tables)

Method: model from `part11-model-table-map.csv`; controllers = files mentioning the table or model class, restricted to controllers that own routes referenced by `lms_k12` (`part10-laravel-route-inventory.csv` col H); frontend = files in `D:\lms_k12` containing the literal path. Status column is "trace confirmed by grep", not runtime proof.

| # | Table | Model(s) | Laravel controller(s) | Service / helper | API (Laravel path) | Frontend consumer (lms_k12) | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `tbluser` | `loginModel`, `tbluserModel` (2 models) | `api/ApiLoginController`, `api/UserManagementApiController`, `api/OrganizationManagement/EmployeeDirectory/EmployeeDirectoryController`, `loginController` (web) | `Services/Rbac/PermissionService`, `Brain/Intelligence/GraphProjection`, `Services/Mcp/*` | `POST /api/api-login`; `GET|POST /api/users`; `GET|POST /api/organization-management/employee-directory` | `contexts/AuthContext.tsx`; `app/user/api.ts` (via `/api/proxy?path=api/users`); `app/organization-management/employee-directory/*` | trigger `neo4j_sync_tbluser_*`; plaintext `password`+`plain_password` |
| 2 | `tbluserprofilemaster` | `tbluserprofilemasterModel` | `UserManagementApiController`, `RolePermissionsController` | `PermissionService` | `/api/user-profiles`, `/api/organization-management/role-permissions/roles` | `app/general/api.ts`, `app/organization-management/role-and-permissions/*` | role names per tenant |
| 3 | `tblstudent` | `tblstudentModel` | `api/apiController` (student login), `student/tblstudentController`, `student/studentSearchController`, `api/StudentSetupApiController`, `dashboardController` | `Brain/Intelligence/LmsSignalRules`, `LmsAnalytics` | `POST /api/login`; `/student/add_student`; `POST /student/show_search_student`; `/api/students-dashboard/summary` | `app/student/add_student/page.tsx`, `app/students/_lib/students-dashboard-api.ts`, `app/student/_components/setup-api.ts` | live drift (`roll_no`) |
| 4 | `tblstudent_enrollment` | `tblstudentEnrollmentModel` | `studentSearchController`, `rollOverController`, `dashboardController`, `studentOptionalSubjectController` | `Services/Graph/StudentGraphProjection` | `/student/search_student`, `/student/rollover` | `app/student/add_student/page.tsx` | class/section per year |
| 5 | `attendance_student` | **none** (raw) | `student/studentAttendanceController`, `school_setup/teacherdailyReportController` | `Brain/Intelligence/LmsSignalRules`, `GraphProjection` | `GET /student/student_attendance`, `POST /student/show_student_attendance`, `POST /student/save_student_attendance` | `app/attendance/_lib/attendance-api.ts`, `app/student/student_attendance/page.tsx` | no unique / no tenant index |
| 6 | `timetable` | `timetableModel` | `school_setup/timetableController`, `classwisetimetableController`, `facultywisetimetableController`, `proxyController` | `Services/Mcp/TimetableService`, `LessonIntelligenceService` | `POST /school_setup/ajax_getTimetable*` | `app/front_desk/create-timetable/api.ts`, `app/api/dashboard/teacher-timetable/route.ts` | teacher->class link (memory) |
| 7 | `standard`, `division`, `sub_std_map`, `academic_year` | `standardModel`, `divisionModel`, `sub_std_mapModel`, `academic_yearModel` | `api/AcademicSetupApiController`, `school_setup/sub_std_mapController`, `AJAXController` | `Helpers/Helper.php` (57 refs to `standard`) | `GET|POST|PUT /api/academic-setup/{module}` | `app/academic_setup/api.ts` | setup masters |
| 8 | `class_teacher` | `classteacherModel` | `api/ClassTeacherApiController` | `Brain/GraphExplorer` | `/api/class-teachers` | `app/classteacher/api.ts`, `lib/class-options.ts` | |
| 9 | `fees_collect` | `FeesCollect` x2, `fees_collect` | `fees/fees_collect/fees_collect_controller`, `fees/fees_cancel/feesCancelController`, `FeesReportController` | `Services/Fees/FeeAuditService`, `Brain/FeesIntelligence`, `Helpers/Helper.php` | `/fees/fees_collect`, `/fees/fees_collect/{id}/ledger`, `/pending_fees` | `app/fees/collect/page.tsx`, `app/api/fees/reports/fees-collection/route.ts` | `receipt_no` via `max()+1` (`fees_collect_controller.php:1187,1989`) |
| 10 | `fees_payment` | **none** | `fees/online_fees/online_fees_collect_controller`, `online_payments_api_controller`, `reconciliation_status_api_controller`, `online_fees_payment_api_controller` | `Services/Fees/FeePaymentGatewayResolver` | `/fees/online_payments`, `/fees/reconciliation/status`, `/fees/online_fees_payment_api/{gateway}` | `app/api/fees/online-payments/route.ts` | varchar money/ids |
| 11 | `fees_breackoff` | `fees_breackoff`, `FeesBreackoff` | `fees/fees_breackoff/fees_breackoff_controller`, `student/rollOverController` | `AI/Fees/FeesPromptService` | `/fees/fees_breackoff` | `app/fees/master/fees-breakoff/page.tsx` | only well-keyed fee table |
| 12 | `fees_title` | `fees_title` | `fees/fees_title/fees_title_controller`, `other_fee_map_controller` | `Helpers/Helper.php` (29) | `/fees/fees_title` | `app/fees/master/new-fees-title-master/page.tsx` | |
| 13 | `fees_receipt_book_master` | `feesReceiptBookMasterModel` | `fees/feesReceiptBookMasterController`, `fees_collect_controller` | `InstituteBranding` | `/fees/fees_receipt_book_master` | `app/fees/master/fees-receipt-book-master/page.tsx` | receipt counter |
| 14 | `fees_cancel` | `feesCancelModel` | `fees/fees_cancel/feesCancelController` | `Brain/FeesSignalRules` | `POST /api/fees-cancel/search` | `app/fees/cancel-refund/page.tsx` | |
| 15 | `fees_refund` | `feesRefundModel` (unused) | `api/FeesRefundApiController` (raw `DB::table`) | `Brain/FeesIntelligence` | `POST /api/fees-refund/{search,detail/{id},save}` | `app/fees/cancel-refund/page.tsx` | FIN-09 (LMS-AUDIT-116) |
| 16 | `fees_circular_master`, `fees_circular_log` | `feesCircularMasterModel` | `fees/fees_circular/feesCircularController` | - | `POST /api/fees-circular/{filters,students,generate}` | `app/fees/circulars/page.tsx` | |
| 17 | `fees_razorpay` / `fees_hdffc` / `fees_icici` / `fees_axis` / `fees_aggre_pay` / `fees_payphi` (+ `fees_hdfcrazorpay` unresolved) | **none** | `fees/online_fees/online_fees_settigs_controller` | `FeePaymentGatewayResolver` | `/fees/online_fees_settings_api` | `app/fees/online-fees-settings/page.tsx` | plaintext secrets |
| 18 | `result_exam_master` | `ExamMaster` | `result/ExamMaster/ExamMasterController` | `Services/Mcp/ResultReportService` | `/result/exam_master` | `app/exam/exam-master/page.tsx` | `SubInstituteId varchar(255)` |
| 19 | `result_create_exam` | `exam_creation` | `result/exam_creation/exam_creation_controller` | `Brain/LmsQueryScope` | `/result/exam_creation` | `app/lms/exam/page.tsx`, `app/result/page.tsx` | |
| 20 | `result_marks` | `marks_entry` | `result/marks_entry/marks_entry_controller`, `result/new_result/studentResultController`, `api/ImportApiController` | `Brain/LmsSignalRules`, `ResultIntelligence` | `/result/marks_entry`, `/api/result/marks-entry/*`, `/api/import/*` | `app/exam/marks-entry/page.tsx`, `app/import-data/page.tsx` | `sub_institute_id string`, 0 indexes |
| 21 | `hrms_emp_leaves` | `HrmsEmpLeave` | `api/Leave/LeaveRequestApiController`, `leave/ApplyLeaveController` | `Services/Leave/LeaveAnalyticsService` | `GET|POST /api/leave/requests`, `POST /api/leave/requests/bulk-decision` | `app/hrit/_lib/leave-api.ts`, `.../LeaveRequestDetailsDrawer.tsx` | no tenant column |
| 22 | `hrms_leave_types` | `HrmsLeaveType` | `api/Leave/LeaveTypeApiController` | `LeaveAnalyticsService` | `/api/leave/leave-types` | `app/hrit/leave-management/leave-configuration/page.tsx` | |
| 23 | `hrms_attendances` | `HrmsAttendance` | `api/Attendance/AttendanceTrackingApiController`, `AttendanceDashboardApiController`, `HRMS/HrmsController` | `Brain/StaffAttendanceIntelligence` | `POST /api/attendance/punch-in|punch-out`, `GET /api/attendance/kpi` | `app/hrit/_lib/attendance-api.ts` | |
| 24 | `tblmenumaster` | `tblmenumasterModel` | `api/MenuRightsController`, `IndividualRightsApiController`, `GroupwiseRightsApiController` | `Services/Onboarding/OnboardingProgressService`, `PermissionService` | `POST /api/menu-rights`, `GET /api/master-menu-rights` | `app/hooks/useMenuRights.ts`, `app/components/DashboardShell.tsx` | SQLi (BE-01 (LMS-AUDIT-008)), CSV tenant list |
| 25 | `tblgroupwise_rights` (+ `tblprofilewise_menu`, no migration) | `tblgroupwise_rightsModel` | `api/GroupwiseRightsApiController`, `RolePermissionsController`, `loginController` | `PermissionService` | `GET|POST /api/groupwise-rights` | `app/general/groupwise_rights/api.ts` | join on a table no migration creates |
| 26 | `tblindividual_rights` | `tblindividual_rightsModel` | `api/IndividualRightsApiController`, `ApiLoginController` | `PermissionService` | `GET /api/individual-rights` | `app/general/individual_rights/api.ts` | |
| 27 | `lms_question_master` | `lmsQuestionMasterModel` | `api/ApiLmsCourseController`, `lms/assessmentQuestionController`, `lms/questionpaperController`, `lms/pal/palController` | `Services/PAL/Questions/PalQuestionForms`, `Eso/EsoPolicyService` | `/api/lms-question-bank/*`, `/api/lms-courses` | `app/course-master/data/chapters.ts`, `app/h5p/question-bank-library/page.tsx` | tenant split (memory) |
| 28 | `homework` | `studentHomeworkModel` | `api/lms/StudentHomeworkApiController`, `HomeworkSubmissionApiController` | `Brain/HomeworkIntelligence`, `HomeworkSignalRules` | `POST /api/lms-homework/*` | `app/lms/homework/api.ts` | 0 indexes |
| 29 | `lms_assignment` | `lms_assignmentModel` | `api/lms/LmsAssignmentApiController` | `Services/Mcp/AssignmentReportService` | `POST /api/lms-assignment/*` | `app/lms/lmsAssignment/api.ts`, `lmsAnnotate_assignment/api.ts` | duplicate route registration (part10 BE-07 (LMS-AUDIT-009)) |
| 30 | `lms_online_exam` (+ answers) | `lmsOnlineExamModel` | `lms/onlineExamController`, `lms/pal/palController` | `Services/Mcp/OnlineExamReportService`, `Graph/ResultGraphProjection` | `/lms/online_exam`, `/lms/pal/diagnostic*` | `app/lms/exam/page.tsx`, `app/lms/exam/_result-dashboard/api.ts` | no tenant col; trigger on this table |
| 31 | `exam_evaluation_batch/sheet/answer` | **none** | `api/ExamEvaluationApiController` (+ `Jobs/EvaluateAnswerSheetJob`) | `ExamEvaluationStorage` | `/api/exam-evaluation/*` | `app/lms/exam/_exam-evaluation/api.ts` | |
| 32 | `sub_std_map`, `lms_course_enroll` (G2G) | `sub_std_mapModel`, `LmsCourseEnroll` (unused) | `G2gLms/CourseBuilderController`, `AssignmentsController`, `CertificationsRecordsController` | - | `/api/g2g-lms/*` | `components/domain/lms/*` | |
| 33 | `learner_node_state`, `pal_concept_nodes` | `LearnerNodeState`, `ConceptNode` | `api/PAL/EsoEngineController`, `lms/pal/palController` | `Services/PAL/Plan/DiagnosticEsoBridge`, `MasteryOverviewService` | `/api/pal/eso/*` | `app/pal/data/pal-eso.ts` | tenant-1-only nodes (memory) |
| 34 | `pal_learning_sessions`, `pal_learner_states`, `pal_assessment_results` | `LearningSession`..., `LearnerState` | `api/PAL/*` (`PalWorkspaceController`) | `Services/PAL/*` | `/api/pal/*` | `app/pal/*`, `app/api/pal/pedagogy-engine/route.ts` | no tenant column |
| 35 | `admission_enquiry` | `admissionEnquiryModel` (soft delete) | `admission/admissionEnquiryController`, `api/admissionRegistrationAPIController`, `admission/admissionReportController` | `Services/Mcp/AdmissionMcpService`, `Domain/Admissions/Risk/StalledEnquiryDetector` | `/api/admission_registration*`, `/admission/admission_enquiry` | `app/admissions/admission_enquiry/page.tsx` | Aadhaar plaintext |
| 36 | `admission_registration` | `admissionRegistrationModel` | `api/admissionRegistrationAPIController`, `AdmissionsDashboardApiController` | `AdmissionMcpService` | `/api/admission_registration`, `POST /api/admissions-dashboard/summary` | `app/admissions/admission_registration/*` | |
| 37 | `task` (legacy) + `task_management_*` | `Task`, `taskModel` | `api/TaskManagement/WorkspaceController`, `MyTasksController` | `Services/Mcp/TaskService` | `/api/task-management/*` | `app/task-management/_lib/*` | dual UPPER/lower column naming |
| 38 | `library_books/items/book_circulations` | `LibraryBook`, `LibraryItem`, `LibraryBookCirculation` | `library/BookController`, `LibraryReportController`, `api/LibraryDashboardApiController` | `Services/Mcp/LibraryService`, `Brain/LibraryIntelligence` | `/books`, `POST /api/library-dashboard/summary` | `app/api/library/books-list/route.ts`, `app/library/book_resources/page.tsx` | no tenant column |
| 39 | `hostel_room_allocation` | `tblhostelRoomAllocationModel` | `api/HostelSetupApiController`, `HostelDashboardApiController` | `Services/Mcp/HostelOccupancyService` | `/api/hostel-setup/{module}`, `POST /api/hostel-dashboard/summary` | `app/hostel/setup-api.ts`, `app/api/hostel/dashboard/summary/route.ts` | no unique bed |
| 40 | `inventory_item_master` (+ 17 inventory tables) | `inventory_item_masterModel` | `api/InventoryApiController` | `Services/Mcp/InventoryService` | `/api/inventory/{module}` | `app/Inventory/api.ts` | only `lockForUpdate` users |
| 41 | `smtp_details`, `sms_api_details`, `sms_sent_parents`, `whatsapp_*` | none / `send_sms_parents` | `settings/smtpController`, `easy_com/send_sms_parents_controller`, `easycomapi` controllers | `Services/Mcp/CommunicationService` | `/settings/smtp_setting`, `/easy_com/send_sms_parents` | `app/easy_com/smtp/page.tsx` | plaintext SMTP password |
| 42 | `ai_api_keys` (+ `ai_*`) | **none** | `AI/AiConfigurationController`, `AiModuleModelController` | `Domain/AI/Support/ProviderKeyResolver`, `AiConfigurationResolver` | `/api/ai/configuration`, `/api/ai/modules/{module}/models` | `lib/intelligence/ai-configuration.ts` | `api_key mediumText` plaintext |
| 43 | `hpbrain_*` (107) | **none** (raw) | `Brain/BrainController` and 10 other `Brain/*` controllers | `Brain/Ingestion/FoundationIngestor`, `Brain/Intelligence/*` | `/api/brain/{tenantId}/...` | `lib/brain/api.ts`, `app/components/DashboardShell.tsx` | 65 of 107 tables unreferenced |

Also traced (no separate row): `circular` -> `front_desk/circular/circularController` -> `/front_desk/circular` -> `app/front_desk/*`; `tblstudent_document` -> `student/studentTransferController` -> `app/Utility/student-transfer/api.ts`; `admission_*` reports; `easy_com` -> `app/easy_com/*`.

---


## 6. Business-logic notes (database-level rules)

1. **Student identity**: Input (admission / add student) -> `tblstudent` insert -> `tblstudent_enrollment` insert (class/section/year) -> triggers `neo4j_sync_tblstudent_ai` and `..._enrollment_ai` write `sync_log` rows *inside the same transaction*. Rules the schema enforces: unique `(sub_institute_id, enrollment_no)` (only if the 2026-09-01 migration found no duplicates and was recorded; otherwise no rule) and unique `(syear, student_id, term_id, sub_institute_id)` on enrollment (bypassed when `term_id` is NULL, MySQL treats NULLs as distinct). No FK from `tblstudent_enrollment.student_id`/`standard_id` to their parents.
2. **Fee collection**: Input (student, heads, mode) -> receipt number computed by `ifnull(max(cast(RECEIPT_ID_n as unsigned)), last_receipt_number)+1` (`fees_collect_controller.php:1187,1206`, `:1989 max(receipt_no)+1`) -> insert into `fees_collect` (one wide row: named head columns + `title_1..title_12` + `fees_html mediumText`) and `fees_paid_other` -> SMS/e-mail. No unique index on `(sub_institute_id, syear, receipt_no)`, no `lockForUpdate`, `receipt_no int`, `last_receipt_number varchar(50)`; concurrent collectors can mint the same number (FIN-08 (LMS-AUDIT-115) confirmed at schema level). Money columns are `decimal(10,0)` in `fees_collect` (26 columns), `fees_refund` (24), `fees_cancel`, `fees_config_master`, and `varchar(150)` in `fees_payment.amount`.
3. **Online payment**: gateway request/response blobs (`*_plain_request`, `*_bank_res` longText) go to `fees_payment`; the resulting receipt stores the gateway id in `fees_collect.cheque_no` (**integer**). Because `config/database.php` sets `'strict' => false`, MySQL coerces the text to `0` instead of raising an error: FIN-34 (LMS-AUDIT-310)'s "insert may fail" is not what happens; the reference is silently **lost** (reconciliation `ledger_finalized` false). See DB-03 (LMS-AUDIT-181).
4. **Leave**: `hrms_emp_leaves` (`from_date`, `to_date`, `status enum`) has no overlap constraint, no `sub_institute_id`, no index; balance in `hrms_leave_allocation` (all TEXT columns) - approval/overlap/balance rules live entirely in `LeaveRequestApiController`.
5. **Attendance**: `attendance_student` allows several rows per (student, date, section); "save" semantics depend on controller delete/insert; no uniqueness. Staff attendance `hrms_attendances(user_id, day)` has no unique either.
6. **Rights**: `tblgroupwise_rights` / `tblindividual_rights` allow duplicate `(profile_id, menu_id, sub_institute_id)`; 50 migrations insert/delete rows in them by menu id; a rights row for a non-existent menu id is legal.
7. **Migration procedure in practice**: memory note - apply single migrations with `migrate --force --path=<file>`; the recent Brain/PAL/AI migrations are written defensively (`hasTable`, `insertOrIgnore`, key by `link`), the 2023 dump and the 7 FK-stub files are not.

---


## 7. Test / documentation coverage for the database scope

| Item | Finding |
|---|---|
| Tests total | 124 files (`tests/Feature`, `tests/Unit`) |
| DB isolation | `phpunit.xml:24-25` has the sqlite `:memory:` lines commented out; there is **no `.env.testing`** (only `.env`, `.env.bak-before-ai-provider`, `.env.example`); test files themselves state this (`tests/Feature/Eso/EsoFlowParityTest.php:36`, `tests/Unit/AiPolicyIsolationTest.php:28`). 49 test files `use DatabaseTransactions` against the configured (shared, remote) MySQL; `tests/Feature/ExampleTest.php` imports `RefreshDatabase` (unused). No test creates or drops tables. |
| Migration tests | none: no test runs migrations, checks `migrate:status`, or diffs schema vs migrations; no model/schema contract tests (only 5 tests call `Schema::has*`) |
| Constraint tests | none for uniqueness/FK/tenant columns |
| Docs | `database/pal_schema_full.sql` (PAL only, header says "run in phpMyAdmin"); `database/neo4j/*`; per-migration docblocks are extensive for 2026 files (good) but there is no ERD, no data dictionary, no schema snapshot |

---


## 8. NOT VERIFIED items

| Item | Reason |
|---|---|
| Live schema (all tables/columns/types), engines (InnoDB vs MyISAM), collations | no DB access; memory says live differs from migrations |
| Live indexes, whether `tblstudent_sub_institute_enrollment_no_unique`, `hpb_tbluser_email`, `hpb_tbluser_tenant`, `lb_points_*`, `hrms_departments_tenant_status_index` exist | need `SHOW INDEX` |
| Whether the 2026-08-21 triggers exist live and whether `sync_log` exists / its row count / PENDING backlog (Neo4j auth broken per memory) | no DB access |
| Server-side `sql_mode` (the `'strict' => false` setting is what Laravel sends; a server-global strict mode could still apply) | `.env`/server not readable |
| Presence of duplicate `(sub_institute_id, enrollment_no)`, duplicate `receipt_no`, duplicate attendance, duplicate e-mails | no data access |
| Which of 410 pending migrations are truly applied | `migrations` table not readable |
| Whether the 43 tables queried but not migrated exist live (`tblprofilewise_menu`, `sync_log`, `ai_models`, ...) | no DB access |
| Backups, PITR, replication, DB user privileges, encryption at rest / in transit | infra, not in repo |
| Query plans / performance | no EXPLAIN possible |
| Seeder bodies (9), `database/neo4j/*` | not reviewed |
| Index/column changes produced by loops over `const` arrays in migrations other than the 3 read manually | parser limitation (list candidates: `grep -l "const INDEXES\|addIndex" database/migrations`) |
| Frontend usage per table beyond literal path matching | heuristic |

How to close them (for someone with DB access): `mysqldump --no-data` diff against the CSV; `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS`; `SELECT * FROM information_schema.STATISTICS`; `SHOW TRIGGERS`; `SELECT @@sql_mode`; duplicate-detection queries in section 10 (DB-05 (LMS-AUDIT-182)).

---


## 9. Second-pass results

| Check (scope: `database/`, `app/Models`, DB call sites in `app/`) | Count | Material hits |
|---|---|---|
| `TODO|FIXME|HACK|XXX` in migrations / models | 1 / 0 | negligible |
| Hard-coded tenant literals in migrations (`sub_institute_id ... = <n>`) | 19 | all are `= 0` template convention or comments; `2026_08_24_150000_seed_default_proficiency_scale` reasons from "tenant 1" |
| Hard-coded **menu ids** in data migrations | 1 file with 17 ids (`2026_08_25_160000`) | DB-09 (LMS-AUDIT-183) |
| E-mails / credentials / API keys committed in migrations & seeders | 0 found (regex for 20+ char literals next to key/secret/token names) | `config/database.php` comment says a DB password remains in git history (not read/verified) |
| `DB::table(` / `DB::select(` / `DB::raw(` / `whereRaw(` / `DB::statement(` in `app/` | 7,217 / 246 / 1,203 / 1,901 / 8 | |
| `DB::transaction` / `beginTransaction` | 131 | for 7,217 builder sites |
| `lockForUpdate` | 6 (all `InventoryApiController`) | none in fees, attendance, enrollment |
| `Schema::hasTable` / `hasColumn` in `app/` | 612 / 180 in 67 controllers + services | runtime drift probes; each is an `information_schema` round trip |
| `FIND_IN_SET` / `LIKE '%..'` | 78 / 59 | CSV-in-column pattern; several string-interpolated (`admissionRegistrationController.php:547,583,674`) |
| `encrypted` casts / `Crypt::` / `Hash::make` / `bcrypt(` | 0 / 4 / 5 files / 3 | no field-level encryption |
| `plain_password` references | 18 in 12 files | DB-08 (LMS-AUDIT-049) |
| `$hidden` in models | 1 | |
| `information_schema` named connection | 2 call sites (`apiController.php:325,805`), points at Moodle DB `triz_lms` | DB-17 (LMS-AUDIT-440) |
| Test files touching DB | 49 `DatabaseTransactions`, 53 files insert rows | DB-11 (LMS-AUDIT-185) |

---


## Database-related issues in the master register (89)

| ID | Severity | Module | Issue | Source IDs |
|---|---|---|---|---|
| LMS-AUDIT-008 | Critical | Generic table API, menu rights, LMS cou… | Anonymous /table_data and /lms_data dump any DB table (incl. tbluser plaintext passwords); frontend depends on it | BE-01, HR-01, ORPH-01 |
| LMS-AUDIT-010 | Critical | Menu / navigation backend (`/api/menu-r… | Unauthenticated POST /api/menu-rights builds SQL from raw request values | AUTH-01, HR-05 |
| LMS-AUDIT-013 | Critical | Organization Management > Employee Dire… | Employee Directory API: authentication only, mass-assignment, returns tbluser (password/plain_password/otp) to any token incl. students | HR-03, AUTH-03 |
| LMS-AUDIT-015 | Critical | Web-root PHP scripts / secrets in source | Standalone PHP scripts under public/ bypass Laravel (phpinfo, request-supplied DB host, hard-coded DB passwords, SQLi in excel_upload/*) | BE-06, INT-04 |
| LMS-AUDIT-021 | Critical | Legacy homework family, lesson planning… | Unauthenticated endpoints with client-supplied identity. | LMS-06 |
| LMS-AUDIT-025 | Critical | Enterprise Brain — AI Assistant search | The global search selects entire rows (`DB::table('tbluser')->...->limit(10)->get()`) and returns each one as `'record' => $record`. | AI-C02 |
| LMS-AUDIT-026 | Critical | Migration modules (learning outcomes, i… | Tenant, user and academic year come from client-supplied request fields; | AI-D03 |
| LMS-AUDIT-027 | Critical | Fees / Mobile "GPay" self-reported paym… | `POST /fees/get_online_receipt` posts fee receipts based on client-supplied `amount`, `transactionid`, `bank_name`, `sub_institute_id`, `syear` and a student-b… | FIN-02 |
| LMS-AUDIT-032 | Critical | Utility / Custom module - arbitrary row… | `table_name` comes from the request and is passed to `DynamicModel::deleteRecord($request->table_name, $id)`; | FIN-64 |
| LMS-AUDIT-033 | Critical | Utility / Custom module - DDL SQL injec… | Table/column names, types, lengths and defaults are interpolated into `CREATE/ALTER/DROP` and `SHOW TABLES LIKE` statements; | FIN-65 |
| LMS-AUDIT-034 | Critical | Admissions (enquiry / registration / on… | The three admission API controllers are registered at top level of `routes/api.php` with no middleware other than the group `throttle:1000,1`, and the controll… | STU-01 |
| LMS-AUDIT-037 | Critical | Attendance | Request parameters are concatenated into raw SQL. | STU-04 |
| LMS-AUDIT-039 | Critical | Attendance / Students legacy / Proxy /… | The `session` middleware validates the JWT and hydrates a correct tenant from the token, but each controller then overwrites it with the request value when `ty… | STU-06 |
| LMS-AUDIT-046 | Critical | Super-admin provisioning | `Route::any('superAdmin')` and `POST superAdmin-store` are on the `web` group with no `session`/`auth`/permission middleware. | BE-02 |
| LMS-AUDIT-048 | Critical | Tier B controllers (JWT valid + client-… | These controllers call `$this->jwtToken()->validate()` (signature/expiry only) and then use `sub_institute_id`, `user_id`, `syear` from the request. | BE-11 |
| LMS-AUDIT-049 | Critical | Sensitive data at rest (database facet;… | 66 sensitive columns are plain `varchar/text`; | DB-08 |
| LMS-AUDIT-051 | Critical | SQAA PDF / file deletion | `POST /unlink-file` deletes any path given in the request: | INT-03 |
| LMS-AUDIT-058 | High | Menu -> route mapping (Result module) | Result menu route-name map shadowed/incorrect; ~31-36 menu links point at non-existent pages | AUTH-13, LMS-27, ORPH-09 |
| LMS-AUDIT-059 | High | Repository hygiene / agent tooling state | Agent runtime state under .kilo/conversational-ai (real student/enquiry PII) committed to git | INFRA-03, NAPI-13, AI-D20 |
| LMS-AUDIT-061 | High | Credentials storage & exposure | Staff passwords stored/compared in plaintext (plain_password) and exposed by APIs | BE-14, AUTH-09, STU-34 |
| LMS-AUDIT-068 | High | HRIT Leave | Leave APIs have no role/ownership/self-approval check; identity from request | HR-09, BE-13 |
| LMS-AUDIT-072 | High | Fees online payment | `student_id` and the amount (`pay_amount ?: | NAPI-09 |
| LMS-AUDIT-084 | High | Homework v2 review / files | (1) `reviewList` scopes by tenant/year only `->when(request value)`; | LMS-18 |
| LMS-AUDIT-085 | High | Learning Outcome (migration-modules API) | `guard()` verifies only that a JWT is valid, then trusts `sub_institute_id`, `user_id`, `syear` from the body. | LMS-20 |
| LMS-AUDIT-097 | High | People & Competency LMS — Assignments (… | The shared `DataTable` identifies selected rows by `String(index)`. | AI-C07 |
| LMS-AUDIT-115 | High | Fees / receipts & idempotency | Receipt numbers are `MAX(existing)+1` read outside the write transaction, with no lock and (per migration `2023_03_05_115658_create_fees_receipt_table.php`) no… | FIN-08 |
| LMS-AUDIT-117 | High | Fees / Receipt generation and display | The printed/stored receipt takes student identity, remarks and bank fields from `$_REQUEST` (client input) instead of the database, without HTML escaping; | FIN-10 |
| LMS-AUDIT-127 | High | Inventory / Item receivable | `Route::get('inventory/{module}')->where('module','^(?!reports$).+')` (matches slashes) is declared before `inventory/receivables/items` and `POST inventory/{m… | FIN-45 |
| LMS-AUDIT-132 | High | Hostel / capacity and double booking | Uniqueness only per (user, group, year, tenant); | FIN-54 |
| LMS-AUDIT-143 | High | Utility / Inter-institute student trans… | `to_sub_institute_id` never checked to belong to the same client; | FIN-73 |
| LMS-AUDIT-148 | High | Inward/Outward numbering and add | Next number is computed with `CAST(inward_number AS INT)` (invalid MySQL) and handed to Blade via `view()->share`, so the JSON never contains it; | FIN-79 |
| LMS-AUDIT-153 | High | Attendance | Server-side validation that exists in `showStudent` (academic-year window, holiday, Sunday) is absent from `save`. | STU-10 |
| LMS-AUDIT-157 | High | Student create / login | (a) No email uniqueness check although login is by email and `first()` picks the first matching student (legacy `ajax_checkEmailExist` exists but the new API d… | STU-16 |
| LMS-AUDIT-158 | High | Student delete / withdraw | `tblstudentModel::where(["id" => $id])->update(['status'=>"0"])` has no tenant filter; | STU-17 |
| LMS-AUDIT-160 | High | Proxy / substitution teacher | `update` and `destroy` operate by `id` only (`proxyModel::where(["id" => $id])->update/delete()`), a cross-tenant IDOR (STU-06 pattern). | STU-21 |
| LMS-AUDIT-175 | High | G2G Assessments / Learning dashboard, T… | 35 frontend endpoints have no matching Laravel route: | ORPH-11 |
| LMS-AUDIT-179 | High | Migrations / reproducible schema | The migration set cannot rebuild a database and does not describe the live one. | DB-01 |
| LMS-AUDIT-180 | High | Tenancy in schema | 188 of 827 tables (23 %) carry no tenant column in the migrations, including tenant-owned data (leave, library, exam attempts, PAL learner state, student aspir… | DB-02 |
| LMS-AUDIT-181 | High | Connection configuration / data integri… | Laravel's non-strict mode removes `STRICT_TRANS_TABLES`, so MySQL truncates over-long strings, rounds `decimal(10,0)`, turns non-numeric text inserted into int… | DB-03 |
| LMS-AUDIT-182 | High | Missing unique constraints | Business rules that require uniqueness are enforced only in controllers: | DB-05 |
| LMS-AUDIT-183 | High | Production migration safety | The only safeguard is a regex on the raw argv: | DB-09 |
| LMS-AUDIT-184 | High | DB triggers writing to an uncreated tab… | AFTER INSERT/UPDATE/DELETE triggers on the hottest tables insert into `sync_log`, but no migration or SQL file anywhere in the repo creates `sync_log` (`grep C… | DB-10 |
| LMS-AUDIT-185 | High | Test database isolation | `php artisan test` runs against whatever database `.env` points to (per memory the shared remote `vivek_erp`); | DB-11 |
| LMS-AUDIT-195 | High | Outbound TLS verification disabled (ext… | Every listed call turns off peer/host verification. | INT-15 |
| LMS-AUDIT-200 | High | Console commands (destructive seeding) | The class docblock promises it "writes only to a dedicated sub_institute_id, never to one holding real records", and `guardTenant()` refuses non-synthetic tena… | INT-21 |
| LMS-AUDIT-215 | Medium | Generic migrated modules (`/reports/*`,… | Generic "migrated module" pages dump raw first-array API data / show feature names with no implementation | STU-33, AI-D19 |
| LMS-AUDIT-216 | Medium | Error handling / debug output | Exception messages, SQL text and debug output returned to clients | BE-23, LMS-36 |
| LMS-AUDIT-223 | Medium | User / profile administration | Anyone with `add`/`edit` on `add_user.index` can set `user_profile_id` to any active profile of the tenant, including the admin profile (only tenant and status… | AUTH-22 |
| LMS-AUDIT-237 | Medium | Result - grade / rank / pass rules | (1) Percentage is rounded to an integer **before** matching breakoffs (34.5 -> 35 = pass grade) while the failed-subject count uses the raw ratio (`< 35`), so… | LMS-23 |
| LMS-AUDIT-240 | Medium | Duplicate modules | Parallel implementations with different behaviour: | LMS-28 |
| LMS-AUDIT-241 | Medium | Quiz, Subjects, Learning Outcome, LMS M… | `handlePublish` sets a 1.5 s timeout then navigates - the quiz is never saved (false success). | LMS-29 |
| LMS-AUDIT-265 | Medium | Gamification - Challenge Mode scoring /… | Score is computed server-side, but its inputs are client assertions: | AI-B07 |
| LMS-AUDIT-268 | Medium | Gamification backend read paths | GET endpoints recompute and WRITE on every request: | AI-B10 |
| LMS-AUDIT-272 | Medium | Personalize Marks | The server performs no validation: | AI-B14 |
| LMS-AUDIT-302 | Medium | Fees / rounding and currency handling | Money uses JS `Number` (floating) summed with `reduce` and no rounding; | FIN-21 |
| LMS-AUDIT-303 | Medium | Fees / Late fee | The query that fills `$getLateData` is commented out ("no migration found"), so `$config_late_fine` remains `0`; | FIN-22 |
| LMS-AUDIT-310 | Medium | Fees / online payment reconciliation | Gateway payment ids (`pay_...`, `order_...`) are stored in the integer `cheque_no` (per migration), the reconciliation view's own comment says it is "only reli… | FIN-34 |
| LMS-AUDIT-313 | Medium | Inventory / Direct purchase | No uniqueness on (vendor, bill_no, challan_no); | FIN-47 |
| LMS-AUDIT-315 | Medium | Inventory / reports and receipts | The overall report left-joins one-to-many tables and sums (multiplied totals; | FIN-50 |
| LMS-AUDIT-317 | Medium | Transportation / student mapping and fa… | Fare (`amount`, `distance`) is computed in the browser and stored as sent (`nullable\\|numeric\\|min:0`); | FIN-56 |
| LMS-AUDIT-324 | Medium | Student create/edit (data integrity) | Legacy and bulk-update use `M/F/O`; | STU-18 |
| LMS-AUDIT-325 | Medium | Bulk student update | Whitelisted fields are updated without: | STU-19 |
| LMS-AUDIT-327 | Medium | Class teacher master | `grade_id`, `standard_id`, `division_id`, `teacher_id` are only `integer`; | STU-23 |
| LMS-AUDIT-338 | Medium | HRIT role gating and menu rights | Client gates use `name.toLowerCase().includes('admin') \\|\\| includes('hr')`, which matches unrelated profiles ("Admin Assistant", "Chris", "Three...", "Front… | HR-24 |
| LMS-AUDIT-350 | Medium | Migrations, schema hygiene | 708 tables created by migrations; | BE-25 |
| LMS-AUDIT-351 | Medium | Jobs, events, scheduler | With the default `sync` driver the four AI-grading jobs run inside the HTTP request (60–600 s); | BE-26 |
| LMS-AUDIT-355 | Medium | Fees / money data types | Fee amounts are `decimal(10,0)` (no paise) in 69 money columns (82 scale-0 decimals in all), `varchar(150)` in the online-payment ledger, `integer` in 24 other… | DB-04 |
| LMS-AUDIT-356 | Medium | Referential integrity | Effective foreign keys in the entire migration history: | DB-06 |
| LMS-AUDIT-357 | Medium | Indexing | 274 of 532 tenant-column tables have no index containing the tenant column, 154 of 181 `syear` tables have none on the year, and hot tables are bare: | DB-07 |
| LMS-AUDIT-358 | Medium | Code vs migration drift | ~43 tables (and 18 models) are used by application code but created by no migration; | DB-12 |
| LMS-AUDIT-359 | Medium | Model layer | The model layer is a partial, inconsistent view of the schema: | DB-13 |
| LMS-AUDIT-360 | Medium | Data types | Keys and dates are stored as free text: | DB-14 |
| LMS-AUDIT-361 | Medium | Comma-separated lists in columns | Many-to-many relations are stored as CSV strings: | DB-15 |
| LMS-AUDIT-362 | Medium | Data seeding inside schema migrations | Menu structure, role rights, workflow definitions and AI templates are deployed as migrations that write into live shared tables. | DB-18 |
| LMS-AUDIT-363 | Medium | JSON / blob storage | Payroll amounts, raw payment-gateway requests/responses, learner state and rendered receipt HTML are stored as opaque blobs; | DB-19 |
| LMS-AUDIT-368 | Medium | Queue configuration (extends BE-26) | Beyond the `sync` default (BE-26): | INT-26 |
| LMS-AUDIT-369 | Medium | Scheduler and Kernel guard | Only Neo4j tasks are scheduled. | INT-27 |
| LMS-AUDIT-378 | Medium | Opt-in `api_guard` coverage (uncommitte… | The new guard protects only the listed `api/*` patterns (`lms-homework/*`, `lms-assignment/*`, `exam-evaluation/*`, `question-paper/*`, `get-*`, ...). | INT-36 |
| LMS-AUDIT-397 | Low | PAL Test submission robustness | No `DB::transaction`: | AI-A23 |
| LMS-AUDIT-398 | Low | PAL Test debug logging | "TEMP DIAGNOSTIC" `console.debug` statements dump full question records (options with correct flags) on every fetch/render in production builds. | AI-A24 |
| LMS-AUDIT-408 | Low | PAL content/pedagogy/administration emp… | End-user screens print server-operator instructions (`php artisan pal:tag-content`, `pal:install-pedagogy-engine`, "Deploy the New PAL Administration module an… | AI-B20 |
| LMS-AUDIT-426 | Low | Fees / Refund permission | Non-admin profiles are authorised via menu link `fees_refund` or `fees/fees_refund`, whereas menu links are route names (`fees_refund.index`); | FIN-30 |
| LMS-AUDIT-433 | Low | General > Implementation management | The transaction deletes `implementation_master` rows for the whole tenant (`where sub_institute_id`), not the current `syear`, then inserts only the current ye… | HR-35 |
| LMS-AUDIT-436 | Low | Cross-module consistency | Same concept, many spellings: | ORPH-20 |
| LMS-AUDIT-439 | Low | Dead, duplicate and deprecated schema | Roughly 8 % of tables are unreferenced, several belong to unrelated products (stock-market), and wide entity tables carry duplicate concepts: | DB-16 |
| LMS-AUDIT-440 | Low | Runtime schema introspection and connec… | Code defends against drift by probing the schema at request time (each call is an `information_schema` query, uncached), and a connection named `information_sc… | DB-17 |
| LMS-AUDIT-441 | Low | Migration naming / ordering conventions | Dependency order for same-timestamp files is alphabetical (fragile); | DB-20 |
| LMS-AUDIT-442 | Low | Legacy / one-off commands | One-off tenant migrations, test commands and duplicated sync code ship in production; | INT-37 |
| LMS-AUDIT-444 | Low | Repository hygiene (Laravel) | Backup/dump/archive artifacts are tracked in the Laravel repo: | SP-04 |

