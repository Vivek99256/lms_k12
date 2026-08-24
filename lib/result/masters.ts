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
import {
  serializeForm,
} from '@/components/result/MasterCrud';
import { readString } from './api';
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
<<<<<<< HEAD
    index: 'result/result_activity_master',
    store: 'result/result_activity_master',
    update: 'result/result_activity_master',
    destroy: 'result/result_activity_master',
=======
    index: 'api/result/hpc-activity-master',
    store: 'api/result/hpc-activity-master',
    update: 'api/result/hpc-activity-master',
    destroy: 'api/result/hpc-activity-master',
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
      placeholder: 'Select standard', options: { kind: 'chain', chain: 'standard' },
    },
    {
      name: 'skill_id', label: 'Skill name', type: 'select', required: true, section: 'Activity details',
      options: { kind: 'api', path: 'result/getActivityLists', params: { standard: '{standard}', level: '2' } },
=======
      placeholder: 'Select standard',
      options: { kind: 'api', path: 'api/result/hpc-activity-master/create', dataKey: 'standardLists' },
    },
    {
      name: 'skill_id', label: 'Skill name', type: 'select', required: true, section: 'Activity details',
      options: { kind: 'api', path: 'api/result/hpc-activity-master/activity-lists', params: { standard: '{standard}', level: '2' } },
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
      options: { kind: 'api', path: 'result/getActivityLists', params: { standard: '{standard}', skill_id: '{skill_id}', levels: '3', level: '4' } },
=======
      options: { kind: 'api', path: 'api/result/hpc-activity-master/activity-lists', params: { standard: '{standard}', skill_id: '{skill_id}', levels: '3', level: '4' } },
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
    index: 'result/result_skillset',
    store: 'result/result_skillset',
    update: 'result/result_skillset',
    destroy: 'result/result_skillset',
=======
    index: 'api/result/hpc-skillset',
    store: 'api/result/hpc-skillset',
    update: 'api/result/hpc-skillset',
    destroy: 'api/result/hpc-skillset',
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
      placeholder: 'Select standard', options: { kind: 'chain', chain: 'standard' },
    },
    { name: 'main_title', label: 'Main title', type: 'text', required: true, section: 'Skillset details' },
    { name: 'title', label: 'Title', type: 'text', section: 'Skillset details' },
=======
      placeholder: 'Select standard',
      options: { kind: 'api', path: 'api/result/hpc-activity-master/create', dataKey: 'standardLists' },
    },
    { name: 'main_title', label: 'Main title', type: 'text', required: true, section: 'Skillset details' },
    { name: 'title', label: 'Title', type: 'text', required: true, section: 'Skillset details' },
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
    index: 'api/result/exam-master',
    store: 'api/result/exam-master',
    update: 'api/result/exam-master',
    destroy: 'api/result/exam-master',
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
    { name: 'grade', label: 'Section', type: 'select', required: true, section: 'Exam details', options: { kind: 'chain', chain: 'section' } },
    {
      name: 'all_standard', apiName: 'all_standard[]', label: 'Standard', type: 'multiselect', required: true,
      section: 'Exam details', placeholder: '--Select standard--', options: { kind: 'chain', chain: 'standard' },
    },
    {
      name: 'all_term', apiName: 'all_term[]', label: 'Term', type: 'multiselect', required: true,
      section: 'Exam details', placeholder: '--Select term--', options: { kind: 'chain', chain: 'term' },
    },
    { name: 'ExamTitle', apiName: 'title', label: 'Exam type', type: 'text', required: true, maxLength: 255, section: 'Exam details' },
    {
      name: 'app_disp_status', label: 'App display status', type: 'select', required: true, section: 'Exam details', defaultValue: '1',
      options: {
        kind: 'static',
        options: [
          { value: '1', label: 'Yes' },
          { value: '0', label: 'No' },
        ],
      },
    },
    {
      name: 'weightage', label: 'Weightage', type: 'number', section: 'Exam details',
      helper: 'Used by the weightage conversion report.',
    },
    { name: 'SortOrder', label: 'Sort order', type: 'number', required: true, maxLength: 255, section: 'Exam details' },
    { name: 'Code', label: 'Code', type: 'hidden' },
  ],
  serialize: (fields, values, isEdit) => {
    const { data, hasFile } = serializeForm(fields, values);
    delete data.grade;
    return { data, hasFile };
  },
};

export const examTypeMaster: MasterScreenDef = {
  slug: 'exam-type-master',
  title: 'Exam type master',
  subtitle: 'Coded exam type reference list',
  icon: BookMarked,
  entityName: 'exam type code',
  api: {
    index: 'api/result/exam-type-master',
    store: 'api/result/exam-type-master',
    update: 'api/result/exam-type-master',
    destroy: 'api/result/exam-type-master',
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
    index: 'api/result/exam-creation',
    store: 'api/result/exam-creation',
    update: 'api/result/exam-creation',
    destroy: 'api/result/exam-creation',
    show: 'api/result/exam-creation',
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
  note: 'On create, each exam-detail row becomes a separate exam entry per selected subject. Editing an existing exam only updates its single row (matching the legacy edit screen, which never supported multi-row edits).',
  // Laravel's create and update actions expect different payload shapes (result/exam_creation
  // controller): create takes parallel arrays (title[], points[], ... one per exam_rows entry,
  // cross-joined with every selected subject); update takes scalar fields for a single existing
  // row, keyed `exam_id` instead of `exam`. The generic bracket-array serializer can't express
  // that divergence, so this screen supplies its own.
  serialize: (_fields, values, isEdit) => {
    const rows = Array.isArray(values.exam_rows) ? (values.exam_rows as Record<string, unknown>[]) : [];
    const subjects = Array.isArray(values.subject) ? values.subject.map(readString) : [];
    const data: Record<string, unknown> = {
      term: readString(values.term),
      standard: readString(values.standard),
      medium: readString(values.medium),
      con_point: readString(values.con_point),
      marks_type: readString(values.marks_type),
      report_card_status: readString(values.report_card_status),
    };

    if (isEdit) {
      const row = rows[0] ?? {};
      data.exam_id = readString(values.exam);
      data.subject = subjects[0] ?? '';
      data.title = readString(row.title);
      data.points = readString(row.points);
      data.app_disp_status = readString(row.app_disp_status);
      data.sort_order = readString(row.sort_order);
      data.exam_date = readString(row.exam_date);
    } else {
      data.exam = readString(values.exam);
      subjects.forEach((subjectId, index) => { data[`subject[${index}]`] = subjectId; });
      rows.forEach((row, index) => {
        data[`title[${index}]`] = readString(row.title);
        data[`points[${index}]`] = readString(row.points);
        data[`app_disp_status[${index}]`] = readString(row.app_disp_status);
        data[`sort_order[${index}]`] = readString(row.sort_order);
        data[`exam_date[${index}]`] = readString(row.exam_date);
      });
    }
    return { data, hasFile: false };
  },
  // GET .../{id} returns id-based fields (term_id, standard_id, subject_id, exam_id, grade) that
  // the list payload never includes (it only has display names) — reshape them into this screen's
  // field names so the edit drawer's selects/repeater actually prefill.
  deserialize: (record) => ({
    term: record.term_id,
    grade: record.grade,
    standard: record.standard_id,
    subject: [readString(record.subject_id)],
    exam: record.exam_id,
    report_card_status: record.report_card_status,
    medium: record.medium,
    con_point: record.con_point,
    marks_type: record.marks_type,
    exam_rows: [{
      title: record.title,
      points: record.points,
      app_disp_status: record.app_disp_status,
      sort_order: record.sort_order,
      exam_date: record.exam_date,
    }],
  }),
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
    index: 'api/result/grade-master',
    store: 'api/result/grade-master',
    // No PUT endpoint exists in Laravel for grade scales (GradeMasterController has no update()) —
    // backend gap reported; edit is intentionally disabled until that's built.
    destroy: 'api/result/grade-master',
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
    index: 'api/result/grade-master',
    store: 'api/result/grade-master',
    // No PUT endpoint exists in Laravel for grade rows either — same backend gap as the grade-scale
    // screen above; edit is intentionally disabled until that's built.
    destroy: 'api/result/grade-master',
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
      options: { kind: 'api', path: 'api/result/grade-master', params: {} },
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
    index: 'api/result/standard-grade-mapping',
    store: 'api/result/standard-grade-mapping',
    update: 'api/result/standard-grade-mapping',
    destroy: 'api/result/standard-grade-mapping',
  },
  columns: [
    { key: 'scale_name', header: 'Grade scale', sortable: true, searchable: true },
    { key: 'grade_name', header: 'Academic section', sortable: true, searchable: true },
    { key: 'standard_name', header: 'Standard', sortable: true, searchable: true },
  ],
  fields: [
    {
      name: 'grade_scale', required: true, label: 'Grade scale', type: 'select', section: 'Mapping', placeholder: 'Select',
      options: { kind: 'api', path: 'api/result/grade-master', params: {} },
    },
    {
      name: 'grade', apiName: 'grade[]', seedKey: 'grade_id', label: 'Search section', type: 'multiselect', section: 'Mapping',
      placeholder: 'Select', options: { kind: 'chain', chain: 'section' },
    },
    {
      name: 'standard', apiName: 'standard[]', seedKey: 'standard_id', required: true, label: 'Search standard', type: 'multiselect', section: 'Mapping',
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
    index: 'api/result/result-master',
    store: 'api/result/result-master',
    update: 'api/result/result-master',
    destroy: 'api/result/result-master',
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
          { value: 'student_wise', label: 'Individual student wise' },
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
<<<<<<< HEAD
    index: 'result/result_book_master',
    store: 'result/result_book_master',
    update: 'result/result_book_master',
    destroy: 'result/result_book_master',
=======
    index: 'api/result/result-book-master',
    store: 'api/result/result-book-master',
    update: 'api/result/result-book-master',
    destroy: 'api/result/result-book-master',
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
    { name: 'standard', apiName: 'standard[]', label: 'Search standard', type: 'multiselect', section: 'Scope', options: { kind: 'chain', chain: 'standard' } },
=======
    { name: 'standard', apiName: 'standard[]', label: 'Search standard', type: 'multiselect', required: true, section: 'Scope', options: { kind: 'chain', chain: 'standard' } },
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
    index: 'result/result_remark_master',
    store: 'result/result_remark_master',
    update: 'result/result_remark_master',
    destroy: 'result/result_remark_master',
=======
    index: 'api/result/result-remark-master',
    store: 'api/result/result-remark-master',
    update: 'api/result/result-remark-master',
    destroy: 'api/result/result-remark-master',
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
    index: 'result/co_scholastic_master',
    store: 'result/co_scholastic_master',
    update: 'result/co_scholastic_master',
    destroy: 'result/co_scholastic_master',
=======
    index: 'api/result/co-scholastic-master',
    store: 'api/result/co-scholastic-master',
    update: 'api/result/co-scholastic-master',
    destroy: 'api/result/co-scholastic-master',
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
    index: 'result/co_scholastic',
    store: 'result/co_scholastic',
    update: 'result/co_scholastic',
    destroy: 'result/co_scholastic',
=======
    index: 'api/result/co-scholastic',
    store: 'api/result/co-scholastic',
    update: 'api/result/co-scholastic',
    destroy: 'api/result/co-scholastic',
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
=======
      name: 'term', label: 'Select term', type: 'select', required: true,
      section: 'Item details', placeholder: 'Select term', options: { kind: 'chain', chain: 'term' },
    },
    {
      name: 'grade', label: 'Grade', type: 'multiselect', required: true,
      section: 'Item details', placeholder: '--Select grade--', options: { kind: 'chain', chain: 'section' },
    },
    {
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      name: 'standard', apiName: 'standard[]', label: 'Standard', type: 'multiselect', required: true,
      section: 'Item details', placeholder: '--Select standard--', options: { kind: 'chain', chain: 'standard' },
    },
    {
      name: 'parent_id', label: 'Parent co-scholastic', type: 'select', required: true, section: 'Item details',
<<<<<<< HEAD
      placeholder: '--Select parent--', options: { kind: 'api', path: 'result/co_scholastic_master', params: {} },
=======
      placeholder: '--Select parent--', options: { kind: 'api', path: 'api/result/co-scholastic-master', params: {} },
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
=======
  serialize: (fields, values) => {
    const { data, hasFile } = serializeForm(fields, values);
    delete data.grade;
    return { data, hasFile };
  },
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
<<<<<<< HEAD
    index: 'result/working_day_master',
    store: 'result/working_day_master',
    update: 'result/working_day_master',
    destroy: 'result/working_day_master',
=======
    index: 'api/result/working-day-master',
    store: 'api/result/working-day-master',
    update: 'api/result/working-day-master',
    destroy: 'api/result/working-day-master',
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
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
