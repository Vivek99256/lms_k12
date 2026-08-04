/**
 * Master screen configurations for the Result module.
 *
 * Every field, column and validation below is transcribed from the
 * Laravel Blade contract (result_erp_contract.json) — nothing dropped.
 * API paths follow the `result/{resource}` Laravel resource convention
 * observed on `result/marks_entry`; adjust in one place if a route
 * differs on the backend.
 */

import {
  Activity, Award, BookMarked, BookOpenCheck, CalendarCheck2, CalendarRange,
  ClipboardCheck, FileBadge, Layers3, ListChecks, MessageSquareText, Ruler, Scale,
} from 'lucide-react';
import type { MasterScreenDef } from './types';

const YES_NO = [
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' },
];

/* ------------------------------------------------------------------------ */
/* HPC Activity (result_activity_master)                                     */
/* ------------------------------------------------------------------------ */

export const hpcActivity: MasterScreenDef = {
  slug: 'hpc-activity',
  title: 'HPC activity',
  subtitle: 'Define holistic progress card activities per standard and skillset',
  icon: Activity,
  entityName: 'activity',
  api: {
    index: 'result/result_activity_master',
    store: 'result/result_activity_master',
    update: 'result/result_activity_master',
    destroy: 'result/result_activity_master',
  },
  columns: [
    { key: 'id', header: 'Sr no.', width: '70px', mono: true },
    { key: 'standard', header: 'Standard', sortable: true, searchable: true },
    { key: 'title', header: 'Title', sortable: true, searchable: true },
    { key: 'skill_name', header: 'Skill name', sortable: true, searchable: true },
    { key: 'sub_activities', header: 'Sub activities', sortable: true, searchable: true },
    { key: 'sort_order', header: 'Sort order', sortable: true, searchable: true, align: 'center', width: '110px' },
    { key: 'term_name', header: 'Term', sortable: true, searchable: true },
  ],
  fields: [
    {
      name: 'standard', label: 'Standard', type: 'select', required: true, section: 'Activity details',
      placeholder: 'Select standard', options: { kind: 'chain', chain: 'standard' },
    },
    {
      name: 'skill_id', label: 'Skill name', type: 'select', required: true, section: 'Activity details',
      options: { kind: 'api', path: 'getActivityLists', params: { standard: '{standard}', level: '2' } },
      helper: 'Skillsets configured for the selected standard.',
    },
    {
      name: 'levels', label: 'Levels', type: 'select', section: 'Activity details', defaultValue: '3',
      options: { kind: 'static', options: [{ value: '3', label: '3 levels' }, { value: '4', label: '4 levels' }] },
      helper: 'Choose 4 levels to nest this activity under a sub-skill.',
    },
    {
      name: 'sub_skill_id', label: 'Sub skill name', type: 'select', section: 'Activity details',
      showIf: { field: 'levels', equals: ['4'] },
      options: { kind: 'api', path: 'getActivityLists', params: { standard: '{standard}', skill_id: '{skill_id}', levels: '3', level: '4' } },
    },
    { name: 'title', label: 'Title', type: 'text', required: true, section: 'Activity details' },
    {
      name: 'term', label: 'Select term', type: 'select', section: 'Activity details',
      options: { kind: 'chain', chain: 'term' },
      helper: 'Only applies when term-wise HPC is enabled for the institute.',
    },
    { name: 'sort_order', label: 'Sort order', type: 'text', required: true, section: 'Activity details' },
    {
      name: 'subData', label: 'Sub activities', type: 'repeater', section: 'Sub activities',
      repeater: {
        addLabel: 'Add sub activity',
        fields: [
          { name: 'title', label: 'Sub title', type: 'text', required: true },
          { name: 'sort_order', label: 'Sort order', type: 'number' },
        ],
      },
      helper: 'Optional nested sub-activities recorded against this activity.',
    },
  ],
  sectionOrder: ['Activity details', 'Sub activities'],
};

/* ------------------------------------------------------------------------ */
/* HPC Skillset (result_skillset)                                            */
/* ------------------------------------------------------------------------ */

export const hpcSkillset: MasterScreenDef = {
  slug: 'hpc-skillset',
  title: 'HPC skillset',
  subtitle: 'Skill groups that HPC activities are organised under',
  icon: Layers3,
  entityName: 'skillset',
  api: {
    index: 'result/result_skillset',
    store: 'result/result_skillset',
    update: 'result/result_skillset',
    destroy: 'result/result_skillset',
  },
  columns: [
    { key: 'id', header: 'Sr no.', width: '70px', mono: true },
    { key: 'standard_name', header: 'Standard', sortable: true, searchable: true },
    { key: 'main_title', header: 'Main title', sortable: true, searchable: true },
    { key: 'title', header: 'Title', sortable: true, searchable: true },
    { key: 'group', header: 'Group', sortable: true, searchable: true, align: 'center', width: '90px' },
  ],
  fields: [
    {
      name: 'standard', label: 'Standard', type: 'select', required: true, section: 'Skillset details',
      placeholder: 'Select standard', options: { kind: 'chain', chain: 'standard' },
    },
    { name: 'main_title', label: 'Main title', type: 'text', required: true, section: 'Skillset details' },
    { name: 'title', label: 'Title', type: 'text', section: 'Skillset details' },
    {
      name: 'group', label: 'Group', type: 'select', required: true, section: 'Skillset details',
      options: {
        kind: 'static',
        options: [1, 2, 3, 4, 5].map((group) => ({ value: String(group), label: `Group ${group}` })),
      },
      helper: 'Activity group this skillset\'s grades are picked from.',
    },
    { name: 'sort_order', label: 'Sort order', type: 'text', section: 'Skillset details' },
  ],
};

/* ------------------------------------------------------------------------ */
/* Exam Master + Exam Type Master (tabbed page)                              */
/* ------------------------------------------------------------------------ */

export const examMaster: MasterScreenDef = {
  slug: 'exam-master',
  title: 'Exam master',
  subtitle: 'Exam types with standards, terms, weightage and ordering',
  icon: BookOpenCheck,
  entityName: 'exam type',
  api: {
    index: 'result/exam_master',
    store: 'result/exam_master',
    update: 'result/exam_master',
    destroy: 'result/exam_master',
  },
  columns: [
    { key: 'id', header: 'Sr no.', width: '70px', mono: true },
    { key: 'ExamTitle', header: 'Exam type', sortable: true, searchable: true },
    { key: 'std_name', header: 'Standard', sortable: true, searchable: true },
    { key: 'term', header: 'Term', sortable: true, searchable: true },
    { key: 'weightage', header: 'Weightage', sortable: true, searchable: true, align: 'center', width: '110px' },
    { key: 'SortOrder', header: 'Sort order', sortable: true, searchable: true, align: 'center', width: '110px' },
  ],
  fields: [
    {
      name: 'all_standard', apiName: 'all_standard[]', label: 'Standard', type: 'multiselect', required: true,
      section: 'Exam details', placeholder: '--Select standard--', options: { kind: 'chain', chain: 'standard' },
    },
    {
      name: 'all_term', apiName: 'all_term[]', label: 'Term', type: 'multiselect', required: true,
      section: 'Exam details', placeholder: '--Select term--', options: { kind: 'chain', chain: 'term' },
    },
    { name: 'ExamTitle', label: 'Exam type', type: 'text', required: true, maxLength: 255, section: 'Exam details' },
    {
      name: 'weightage', label: 'Weightage', type: 'number', section: 'Exam details',
      helper: 'Used by the weightage conversion report.',
    },
    { name: 'SortOrder', label: 'Sort order', type: 'number', required: true, maxLength: 255, section: 'Exam details' },
    { name: 'Code', label: 'Code', type: 'hidden' },
  ],
};

export const examTypeMaster: MasterScreenDef = {
  slug: 'exam-type-master',
  title: 'Exam type master',
  subtitle: 'Coded exam type reference list',
  icon: BookMarked,
  entityName: 'exam type code',
  api: {
    index: 'result/exam_type_master',
    store: 'result/exam_type_master',
    update: 'result/exam_type_master',
    destroy: 'result/exam_type_master',
  },
  columns: [
    { key: 'id', header: 'Sr no.', width: '70px', mono: true },
    { key: 'Code', header: 'Code', sortable: true, searchable: true, mono: true, width: '110px' },
    { key: 'ExamType', header: 'Exam type', sortable: true, searchable: true },
    { key: 'ShortName', header: 'Short name', sortable: true, searchable: true },
    { key: 'SortOrder', header: 'Sort order', sortable: true, searchable: true, align: 'center', width: '110px' },
  ],
  fields: [
    { name: 'Code', label: 'Code', type: 'text', required: true, maxLength: 255, section: 'Exam type details' },
    { name: 'ExamType', label: 'Exam type', type: 'text', required: true, maxLength: 255, section: 'Exam type details' },
    { name: 'ShortName', label: 'Short name', type: 'text', maxLength: 255, section: 'Exam type details' },
    { name: 'SortOrder', label: 'Sort order', type: 'text', required: true, maxLength: 255, section: 'Exam type details' },
  ],
};

/* ------------------------------------------------------------------------ */
/* Exam Creation (result_create_exam)                                        */
/* ------------------------------------------------------------------------ */

export const examCreation: MasterScreenDef = {
  slug: 'exam-creation',
  title: 'Exam creation',
  subtitle: 'Create exams per term, standard and subject with marks and dates',
  icon: ClipboardCheck,
  entityName: 'exam',
  api: {
    index: 'result/exam_creation',
    store: 'result/exam_creation',
    update: 'result/exam_creation',
    destroy: 'result/exam_creation',
  },
  columns: [
    { key: 'term_name', header: 'Term', sortable: true, searchable: true },
    { key: 'medium', header: 'Medium', sortable: true, searchable: true, width: '100px' },
    { key: 'exam_type', header: 'Exam type', sortable: true, searchable: true },
    { key: 'app_disp_status', header: 'App status', sortable: true, searchable: true, align: 'center', width: '110px', badge: { Y: 'success', N: 'neutral' } },
    { key: 'std_name', header: 'Standard', sortable: true, searchable: true },
    { key: 'sub_name', header: 'Subject', sortable: true, searchable: true },
    { key: 'display_name', header: 'Display subject', sortable: true, searchable: true },
    { key: 'exam_name', header: 'Exam name', sortable: true, searchable: true },
    { key: 'points', header: 'Points', sortable: true, searchable: true, align: 'center', width: '90px' },
    { key: 'report_card_status', header: 'Report card', sortable: true, searchable: true, align: 'center', width: '110px', badge: { Y: 'success', N: 'neutral' } },
    { key: 'sort_order', header: 'Sort order', sortable: true, searchable: true, align: 'center', width: '100px' },
    { key: 'exam_date', header: 'Exam date', sortable: true, searchable: true, width: '120px' },
  ],
  fields: [
    { name: 'term', label: 'Select term', type: 'select', required: true, section: 'Target class', placeholder: 'Select term', options: { kind: 'chain', chain: 'term' } },
    { name: 'grade', label: 'Search section', type: 'select', required: true, section: 'Target class', options: { kind: 'chain', chain: 'section' } },
    { name: 'standard', label: 'Search standard', type: 'select', required: true, section: 'Target class', options: { kind: 'chain', chain: 'standard' } },
    {
      name: 'subject', apiName: 'subject[]', label: 'Select subject', type: 'multiselect', required: true, section: 'Target class',
      options: { kind: 'api', path: 'api/get-subject-list', params: { standard_id: '{standard}' } },
    },
    {
      name: 'exam', label: 'Select exam', type: 'select', required: true, section: 'Target class',
      options: { kind: 'api', path: 'api/get-exam-master-list', params: { standard_id: '{standard}', term_id: '{term}' } },
    },
    {
      name: 'report_card_status', label: 'Show on report card', type: 'radio', section: 'Target class', defaultValue: 'Y',
      options: { kind: 'static', options: YES_NO },
    },
    { name: 'medium', label: 'Medium', type: 'hidden', defaultValue: 'CBSE' },
    { name: 'con_point', label: 'Con point', type: 'hidden', defaultValue: '0' },
    { name: 'marks_type', label: 'Marks type', type: 'hidden', defaultValue: 'MARKS' },
    {
      name: 'exam_rows', apiName: 'exam_rows', label: 'Exam details', type: 'repeater', section: 'Exam details',
      repeater: {
        addLabel: 'Add exam row',
        minRows: 1,
        fields: [
          { name: 'title', label: 'Name', type: 'text', required: true },
          { name: 'points', label: 'Marks', type: 'number' },
          {
            name: 'app_disp_status', label: 'App status', type: 'select', defaultValue: 'Y',
            options: { kind: 'static', options: YES_NO },
          },
          { name: 'sort_order', label: 'Sort order', type: 'number' },
          { name: 'exam_date', label: 'Exam date', type: 'date' },
        ],
      },
      helper: 'Each row becomes one exam entry (name, marks, app visibility, order, date).',
    },
  ],
  sectionOrder: ['Target class', 'Exam details'],
  note: 'Rows submit as title[], points[], app_disp_status[], sort_order[] and exam_date[] exactly like the legacy screen.',
};

/* ------------------------------------------------------------------------ */
/* Grade Master (grade_master + grade_master_data, tabbed page)              */
/* ------------------------------------------------------------------------ */

export const gradeScaleMaster: MasterScreenDef = {
  slug: 'grade-scale',
  title: 'Grade scales',
  subtitle: 'Named grading scales (A–E, O-grades, …)',
  icon: Scale,
  entityName: 'grade scale',
  api: {
    index: 'result/grade_master',
    store: 'result/grade_master',
    update: 'result/grade_master',
    destroy: 'result/grade_master',
  },
  columns: [
    { key: 'id', header: 'Id', width: '70px', mono: true },
    { key: 'grade_name', header: 'Grade name', sortable: true, searchable: true },
    { key: 'sort_order', header: 'Sort order', sortable: true, searchable: true, align: 'center', width: '110px' },
  ],
  fields: [
    { name: 'grade_name', label: 'Grade name', type: 'text', required: true, maxLength: 255, section: 'Grade scale' },
    { name: 'sort_order', label: 'Sort order', type: 'text', required: true, section: 'Grade scale' },
  ],
};

export const gradeDataMaster: MasterScreenDef = {
  slug: 'grade-data',
  title: 'Grade data',
  subtitle: 'Break-offs, GP values and comments per grade scale',
  icon: Ruler,
  entityName: 'grade row',
  api: {
    index: 'result/grade_master',
    store: 'result/grade_master',
    update: 'result/grade_master',
    destroy: 'result/grade_master',
  },
  listKey: 'grade_data',
  columns: [
    { key: 'title', header: 'Title', sortable: true, searchable: true },
    { key: 'breakoff', header: 'Break off', sortable: true, searchable: true, align: 'center', width: '110px' },
    { key: 'gp', header: 'GP value', sortable: true, searchable: true, align: 'center', width: '100px' },
    { key: 'sort_order', header: 'Sort order', sortable: true, searchable: true, align: 'center', width: '110px' },
    { key: 'comment', header: 'Comment', sortable: true, searchable: true },
    { key: 'grade_name', header: 'Grade scale', sortable: true, searchable: true },
  ],
  fields: [
    {
      name: 'grade_id', label: 'Grade scale', type: 'select', required: true, section: 'Grade row',
      options: { kind: 'api', path: 'result/grade_master', params: {} },
      helper: 'Scale this row belongs to.',
    },
    { name: 'title', label: 'Title', type: 'text', required: true, maxLength: 255, section: 'Grade row' },
    { name: 'breakoff', label: 'Break off', type: 'number', required: true, section: 'Grade row', helper: 'Lower percentage bound for this grade.' },
    { name: 'gp', label: 'GP value', type: 'text', section: 'Grade row' },
    { name: 'sort_order', label: 'Sort order', type: 'number', required: true, section: 'Grade row' },
    { name: 'comment', label: 'Comment', type: 'text', maxLength: 255, section: 'Grade row' },
    { name: 'add_type', label: 'Add type', type: 'hidden', defaultValue: 'add_grade_data' },
  ],
};

/* ------------------------------------------------------------------------ */
/* Standard Grade Mapping (result_std_grd_maping)                            */
/* ------------------------------------------------------------------------ */

export const stdGradeMapping: MasterScreenDef = {
  slug: 'standard-grade-mapping',
  title: 'Standard grade mapping',
  subtitle: 'Map grade scales to academic sections and standards',
  icon: ListChecks,
  entityName: 'mapping',
  api: {
    index: 'result/std_grd_maping',
    store: 'result/std_grd_maping',
    update: 'result/std_grd_maping',
    destroy: 'result/std_grd_maping',
  },
  columns: [
    { key: 'scale_name', header: 'Grade scale', sortable: true, searchable: true },
    { key: 'grade_name', header: 'Academic section', sortable: true, searchable: true },
    { key: 'standard_name', header: 'Standard', sortable: true, searchable: true },
  ],
  fields: [
    {
      name: 'grade_scale', label: 'Grade scale', type: 'select', section: 'Mapping', placeholder: 'Select',
      options: { kind: 'api', path: 'result/grade_master', params: {} },
    },
    {
      name: 'grade', apiName: 'grade[]', label: 'Search section', type: 'multiselect', section: 'Mapping',
      placeholder: 'Select', options: { kind: 'chain', chain: 'section' },
    },
    {
      name: 'standard', apiName: 'standard[]', label: 'Search standard', type: 'multiselect', section: 'Mapping',
      placeholder: 'Select', options: { kind: 'chain', chain: 'standard' },
    },
  ],
};

/* ------------------------------------------------------------------------ */
/* Result Master (result_master_confrigration)                               */
/* ------------------------------------------------------------------------ */

export const resultMaster: MasterScreenDef = {
  slug: 'result-master',
  title: 'Result master',
  subtitle: 'Result day configuration, vacation dates, display rules and signatures',
  icon: CalendarRange,
  entityName: 'result configuration',
  multipart: true,
  api: {
    index: 'result/result_master',
    store: 'result/result_master',
    update: 'result/result_master',
    destroy: 'result/result_master',
  },
  columns: [
    { key: 'term_name', header: 'Term', sortable: true, searchable: true },
    { key: 'grade_name', header: 'Grade', sortable: true, searchable: true },
    { key: 'standard_name', header: 'Standard', sortable: true, searchable: true },
    { key: 'result_date', header: 'Result date', sortable: true, searchable: true, width: '120px' },
    { key: 'reopen_date', header: 'Reopen date', sortable: true, searchable: true, width: '120px' },
    { key: 'vaction_start_date', header: 'Vacation start', sortable: true, searchable: true, width: '130px' },
    { key: 'vaction_end_date', header: 'Vacation end', sortable: true, searchable: true, width: '130px' },
    { key: 'result_remark', header: 'Result remark', sortable: true, searchable: true },
    { key: 'optional_subject_display', header: 'Optional subject', sortable: true, searchable: true, align: 'center', badge: { y: 'success', n: 'neutral', Y: 'success', N: 'neutral' } },
    { key: 'remove_fail_per', header: 'Remove fail %', sortable: true, searchable: true, align: 'center', badge: { y: 'success', n: 'neutral', Y: 'success', N: 'neutral' } },
  ],
  fields: [
    { name: 'term', label: 'Select term', type: 'select', section: 'Scope', placeholder: 'Select term', options: { kind: 'chain', chain: 'term' } },
    { name: 'grade', apiName: 'grade[]', label: 'Search section', type: 'multiselect', section: 'Scope', options: { kind: 'chain', chain: 'section' } },
    { name: 'standard', apiName: 'standard[]', label: 'Search standard', type: 'multiselect', section: 'Scope', options: { kind: 'chain', chain: 'standard' } },
    { name: 'result_date', label: 'Result date', type: 'date', required: true, section: 'Key dates' },
    { name: 'reopen_date', label: 'School re-open date', type: 'date', section: 'Key dates' },
    { name: 'vaction_start_date', label: 'Vacation start date', type: 'date', required: true, section: 'Key dates' },
    { name: 'vaction_end_date', label: 'Vacation end date', type: 'date', required: true, section: 'Key dates' },
    {
      name: 'remove_fail_per', label: 'Remove fail percentage', type: 'radio', section: 'Display rules', defaultValue: 'y',
      options: { kind: 'static', options: [{ value: 'y', label: 'Yes' }, { value: 'n', label: 'No' }] },
    },
    {
      name: 'optional_subject_display', label: 'Display optional subject in mark sheet', type: 'radio', section: 'Display rules', defaultValue: 'y',
      options: { kind: 'static', options: [{ value: 'y', label: 'Yes' }, { value: 'n', label: 'No' }] },
    },
    {
      name: 'result_remark', label: 'Result remark', type: 'radio', section: 'Display rules', defaultValue: 'grade_master',
      options: {
        kind: 'static',
        options: [
          { value: 'grade_master', label: 'From grade master' },
          { value: 'individual', label: 'Individual student wise' },
        ],
      },
    },
    { name: 'teacher_sign', label: 'Class teacher signature', type: 'image', section: 'Signatures', accept: 'image/*' },
    { name: 'principal_sign', label: 'Principal signature', type: 'image', section: 'Signatures', accept: 'image/*' },
    { name: 'director_signatiure', label: 'Director signature', type: 'image', section: 'Signatures', accept: 'image/*' },
  ],
  sectionOrder: ['Scope', 'Key dates', 'Display rules', 'Signatures'],
};

/* ------------------------------------------------------------------------ */
/* Result Book Master (result_trust_master)                                  */
/* ------------------------------------------------------------------------ */

export const resultBookMaster: MasterScreenDef = {
  slug: 'result-book-master',
  title: 'Result book master',
  subtitle: 'Report card letterhead — CCE lines, trust logos and status',
  icon: FileBadge,
  entityName: 'result book',
  multipart: true,
  api: {
    index: 'result/result_book_master',
    store: 'result/result_book_master',
    update: 'result/result_book_master',
    destroy: 'result/result_book_master',
  },
  columns: [
    { key: 'line1', header: 'Line 1', sortable: true, searchable: true },
    { key: 'line2', header: 'Line 2', sortable: true, searchable: true },
    { key: 'line3', header: 'Line 3', sortable: true, searchable: true },
    { key: 'line4', header: 'Line 4', sortable: true, searchable: true },
    { key: 'grade_name', header: 'Grade', sortable: true, searchable: true },
    { key: 'standard_name', header: 'Standard', sortable: true, searchable: true },
    { key: 'status', header: 'Status', sortable: true, searchable: true, align: 'center', width: '90px', badge: { Y: 'success', N: 'neutral' } },
  ],
  fields: [
    { name: 'grade', apiName: 'grade[]', label: 'Search section', type: 'multiselect', section: 'Scope', options: { kind: 'chain', chain: 'section' } },
    { name: 'standard', apiName: 'standard[]', label: 'Search standard', type: 'multiselect', section: 'Scope', options: { kind: 'chain', chain: 'standard' } },
    { name: 'line1', label: 'CCE line 1', type: 'editor', section: 'Letterhead lines' },
    { name: 'line2', label: 'CCE line 2', type: 'editor', section: 'Letterhead lines' },
    { name: 'line3', label: 'CCE line 3', type: 'editor', section: 'Letterhead lines' },
    { name: 'line4', label: 'CCE line 4', type: 'editor', section: 'Letterhead lines' },
    { name: 'left_logo', label: 'Left logo', type: 'image', section: 'Logos', accept: 'image/*' },
    { name: 'right_logo', label: 'Right logo', type: 'image', section: 'Logos', accept: 'image/*' },
    {
      name: 'status', label: 'Status', type: 'radio', section: 'Logos', defaultValue: 'Y',
      options: { kind: 'static', options: YES_NO },
    },
  ],
  sectionOrder: ['Scope', 'Letterhead lines', 'Logos'],
};

/* ------------------------------------------------------------------------ */
/* Student Result Remark (result_remark_masters)                             */
/* ------------------------------------------------------------------------ */

export const resultRemarkMaster: MasterScreenDef = {
  slug: 'student-result-remark',
  title: 'Student result remark',
  subtitle: 'Reusable remark titles shown on report cards',
  icon: MessageSquareText,
  entityName: 'remark',
  api: {
    index: 'result/result_remark_master',
    store: 'result/result_remark_master',
    update: 'result/result_remark_master',
    destroy: 'result/result_remark_master',
  },
  columns: [
    { key: 'title', header: 'Title', sortable: true, searchable: true },
    { key: 'remark_status', header: 'Remark status', sortable: true, searchable: true, align: 'center', width: '130px', badge: { Y: 'success', N: 'neutral' } },
    { key: 'sort_order', header: 'Sort order', sortable: true, searchable: true, align: 'center', width: '110px' },
  ],
  fields: [
    { name: 'term', label: 'Select term', type: 'select', section: 'Remark details', placeholder: 'Select term', options: { kind: 'chain', chain: 'term' } },
    { name: 'title', label: 'Title', type: 'text', required: true, maxLength: 255, section: 'Remark details' },
    { name: 'sort_order', label: 'Sort order', type: 'text', required: true, maxLength: 255, section: 'Remark details' },
    {
      name: 'result_status', label: 'Remark status', type: 'radio', section: 'Remark details', defaultValue: 'Y',
      options: { kind: 'static', options: [{ value: 'Y', label: 'On' }, { value: 'N', label: 'Off' }] },
    },
  ],
};

/* ------------------------------------------------------------------------ */
/* Co-Scholastic Master (result_co_scholastic_parent)                        */
/* ------------------------------------------------------------------------ */

export const coScholasticMaster: MasterScreenDef = {
  slug: 'co-scholastic-master',
  title: 'Co-scholastic master',
  subtitle: 'Top-level co-scholastic areas (parents)',
  icon: Award,
  entityName: 'co-scholastic area',
  api: {
    index: 'result/co_scholastic_master',
    store: 'result/co_scholastic_master',
    update: 'result/co_scholastic_master',
    destroy: 'result/co_scholastic_master',
  },
  columns: [
    { key: 'title', header: 'Title', sortable: true, searchable: true },
    { key: 'sort_order', header: 'Sort order', sortable: true, searchable: true, align: 'center', width: '110px' },
  ],
  fields: [
    { name: 'title', label: 'Co-scholastic title', type: 'text', required: true, section: 'Details' },
    { name: 'sort_order', label: 'Sort order', type: 'text', required: true, section: 'Details' },
  ],
};

/* ------------------------------------------------------------------------ */
/* Co-Scholastic Setup (result_co_scholastic — child items w/ grade table)   */
/* ------------------------------------------------------------------------ */

export const coScholasticSetup: MasterScreenDef = {
  slug: 'co-scholastic-setup',
  title: 'Co-scholastic setup',
  subtitle: 'Co-scholastic items per standard — marks or grade based',
  icon: Award,
  entityName: 'co-scholastic item',
  api: {
    index: 'result/co_scholastic',
    store: 'result/co_scholastic',
    update: 'result/co_scholastic',
    destroy: 'result/co_scholastic',
  },
  columns: [
    { key: 'term_name', header: 'Term name', sortable: true, searchable: true },
    { key: 'parent_name', header: 'Parent name', sortable: true, searchable: true },
    { key: 'title', header: 'Title', sortable: true, searchable: true },
    { key: 'standard', header: 'Standard', sortable: true, searchable: true },
    { key: 'sort_order', header: 'Sort order', sortable: true, searchable: true, align: 'center', width: '110px' },
  ],
  fields: [
    {
      name: 'standard', apiName: 'standard[]', label: 'Standard', type: 'multiselect', required: true,
      section: 'Item details', placeholder: '--Select standard--', options: { kind: 'chain', chain: 'standard' },
    },
    {
      name: 'parent_id', label: 'Parent co-scholastic', type: 'select', required: true, section: 'Item details',
      placeholder: '--Select parent--', options: { kind: 'api', path: 'result/co_scholastic_master', params: {} },
    },
    { name: 'title', label: 'Co-scholastic title', type: 'text', required: true, section: 'Item details' },
    { name: 'max_mark', label: 'Total mark', type: 'text', section: 'Item details' },
    { name: 'sort_order', label: 'Sort order', type: 'text', section: 'Item details' },
    {
      name: 'mark_type', label: 'Display option', type: 'radio', section: 'Item details', defaultValue: 'MARK',
      options: { kind: 'static', options: [{ value: 'MARK', label: 'Mark' }, { value: 'GRADE', label: 'Grade' }] },
      helper: 'Grade-based items define up to 5 grade rows below.',
    },
    {
      name: 'co_grade', label: 'Grade table', type: 'repeater', section: 'Grade table',
      showIf: { field: 'mark_type', equals: ['GRADE'] },
      repeater: {
        addLabel: 'Add grade row',
        maxRows: 5,
        fields: [
          { name: 'title', label: 'Grade name', type: 'text' },
          { name: 'break_off', label: 'Break off', type: 'number' },
        ],
      },
      helper: 'Rows 1–5 shown when display option is Grade.',
    },
  ],
  sectionOrder: ['Item details', 'Grade table'],
};

/* ------------------------------------------------------------------------ */
/* Working Day Master (result_working_day_master)                            */
/* ------------------------------------------------------------------------ */

export const workingDayMaster: MasterScreenDef = {
  slug: 'working-day-master',
  title: 'Working day master',
  subtitle: 'Total working days per term and standard',
  icon: CalendarCheck2,
  entityName: 'working day record',
  api: {
    index: 'result/working_day_master',
    store: 'result/working_day_master',
    update: 'result/working_day_master',
    destroy: 'result/working_day_master',
  },
  columns: [
    { key: 'term_name', header: 'Term name', sortable: true, searchable: true },
    { key: 'standard_name', header: 'Standard', sortable: true, searchable: true },
    { key: 'total_working_day', header: 'Total working days', sortable: true, searchable: true, align: 'center', width: '160px' },
  ],
  fields: [
    { name: 'grade', apiName: 'grade[]', label: 'Search section', type: 'multiselect', section: 'Working days', placeholder: 'Select', options: { kind: 'chain', chain: 'section' } },
    { name: 'standard', apiName: 'standard[]', label: 'Search standard', type: 'multiselect', required: true, section: 'Working days', placeholder: 'Select', options: { kind: 'chain', chain: 'standard' } },
    { name: 'term', label: 'Select term', type: 'select', required: true, section: 'Working days', placeholder: 'Select term', options: { kind: 'chain', chain: 'term' } },
    { name: 'total_working_day', label: 'Total working days', type: 'text', required: true, section: 'Working days' },
  ],
};

/* ------------------------------------------------------------------------ */

export const MASTER_SCREENS: MasterScreenDef[] = [
  hpcActivity,
  hpcSkillset,
  examCreation,
  stdGradeMapping,
  resultMaster,
  resultBookMaster,
  resultRemarkMaster,
  coScholasticMaster,
  coScholasticSetup,
  workingDayMaster,
];

export function findMasterScreen(slug: string): MasterScreenDef | undefined {
  return [...MASTER_SCREENS, examMaster, examTypeMaster, gradeScaleMaster, gradeDataMaster].find(
    (screen) => screen.slug === slug,
  );
}
