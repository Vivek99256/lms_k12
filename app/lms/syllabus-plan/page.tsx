'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { SearchDropdown, type DropdownValue } from '@/components/search-dropdown';
import { buildSessionContext } from '@/lib/erp-client';
import { RecordTable, type RecordColumn } from '@/components/erp/RecordTable';
import {
  deleteSyllabus,
  fetchCurriculums,
  fetchSyllabusList,
  saveSyllabus,
  type CurriculumOption,
  type SyllabusRow,
} from '@/app/lms/syllabus-plan/api';
import RequireStaff from '@/app/lms/_shared/RequireStaff';

function singleValue(value: DropdownValue): string {
  return Array.isArray(value) ? value[0] ?? '' : value;
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const inputClass =
  'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-50';
const textareaClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400';

interface FormState {
  gradeId: string;
  standardId: string;
  subjectId: string;
  curriculumId: string;
  title: string;
  objectives: string;
  learningOutcomes: string;
  suggestedMaterials: string;
  assessmentPlan: string;
  progressTracking: string;
}

const EMPTY_FORM: FormState = {
  gradeId: '',
  standardId: '',
  subjectId: '',
  curriculumId: '',
  title: '',
  objectives: '',
  learningOutcomes: '',
  suggestedMaterials: '',
  assessmentPlan: '',
  progressTracking: '',
};

export default function SyllabusPlanPage() {
  const session = useMemo(() => buildSessionContext(), []);

  const [rows, setRows] = useState<SyllabusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [curriculums, setCurriculums] = useState<CurriculumOption[]>([]);
  const [saving, setSaving] = useState(false);
  // Remounts SearchDropdown so it re-inits with preselected values on edit.
  const [dropdownKey, setDropdownKey] = useState(0);

  const loadList = () => {
    setLoading(true);
    fetchSyllabusList()
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch((error: unknown) => {
        setRows([]);
        setErrorText(errorMessage(error));
        setLoading(false);
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    // `loading` starts true; the .then/.catch below flip it (async, not in-body).
    fetchSyllabusList(controller.signal)
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRows([]);
        setErrorText(errorMessage(error));
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Load curriculum options when standard+subject are set.
  useEffect(() => {
    let cancelled = false;
    if (!form.standardId || !form.subjectId) {
      queueMicrotask(() => {
        if (!cancelled) setCurriculums([]);
      });
      return () => {
        cancelled = true;
      };
    }
    const controller = new AbortController();
    fetchCurriculums(form.standardId, form.subjectId, controller.signal)
      .then((data) => {
        if (!cancelled) setCurriculums(data);
      })
      .catch(() => {
        if (!cancelled) setCurriculums([]);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [form.standardId, form.subjectId]);

  const patch = (values: Partial<FormState>) => setForm((prev) => ({ ...prev, ...values }));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setCurriculums([]);
    setDropdownKey((k) => k + 1);
    setShowForm(true);
    setSuccessText('');
  };

  const openEdit = (row: SyllabusRow) => {
    setEditingId(row.id);
    setForm({
      gradeId: row.gradeId,
      standardId: row.standardId,
      subjectId: row.subjectId,
      curriculumId: row.curriculumId,
      title: row.title,
      objectives: row.objectives,
      learningOutcomes: row.learningOutcomes,
      suggestedMaterials: row.suggestedMaterials,
      assessmentPlan: row.assessmentPlan,
      progressTracking: row.progressTracking ? String(row.progressTracking) : '',
    });
    setDropdownKey((k) => k + 1);
    setShowForm(true);
    setSuccessText('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const canSave = !!form.standardId && !!form.subjectId && !!form.curriculumId && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setErrorText('');
    setSuccessText('');
    try {
      const msg = await saveSyllabus(form, editingId ?? undefined);
      setSuccessText(msg);
      closeForm();
      loadList();
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: SyllabusRow) => {
    if (!window.confirm(`Delete syllabus "${row.title || row.curriculumName}"?`)) return;
    setErrorText('');
    setSuccessText('');
    try {
      const msg = await deleteSyllabus(row.id);
      setSuccessText(msg);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (error) {
      setErrorText(errorMessage(error));
    }
  };

  const columns = useMemo<RecordColumn<SyllabusRow>[]>(
    () => [
      { key: 'standardName', label: 'Standard', value: (r) => r.standardName || '-', sortable: true },
      { key: 'subjectName', label: 'Subject', value: (r) => r.subjectName || '-', sortable: true },
      { key: 'curriculumName', label: 'Curriculum', value: (r) => r.curriculumName || '-', sortable: true },
      { key: 'title', label: 'Syllabus Title', value: (r) => r.title || '-', sortable: true },
      { key: 'objectives', label: 'Objectives', value: (r) => r.objectives || '-' },
      { key: 'learningOutcomes', label: 'Learning Outcomes', value: (r) => r.learningOutcomes || '-' },
      { key: 'suggestedMaterials', label: 'Suggested Materials', value: (r) => r.suggestedMaterials || '-' },
      { key: 'assessmentPlan', label: 'Assessment Plan', value: (r) => r.assessmentPlan || '-' },
      {
        key: 'progressTracking',
        label: 'Progress %',
        align: 'right',
        value: (r) => String(r.progressTracking),
        sortable: true,
      },
    ],
    []
  );

  return (
    <RequireStaff>
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <NotebookPen className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Syllabus Plan</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Per-subject syllabus: objectives, outcomes, materials, assessment and progress.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={showForm ? closeForm : openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca]"
          >
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? 'Close' : 'Add Syllabus'}
          </button>
        </header>

        {errorText ? (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">{errorText}</div>
          </div>
        ) : null}
        {successText ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">{successText}</div>
          </div>
        ) : null}

        {showForm ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              {editingId ? 'Edit Syllabus' : 'Add Syllabus'}
            </h2>

            <SearchDropdown
              key={dropdownKey}
              fields={['section', 'standard', 'subject']}
              subInstituteId={session.subInstituteId}
              token={session.token}
              labels={{ section: 'Grade', standard: 'Standard', subject: 'Subject' }}
              required={{ standard: true, subject: true }}
              values={{ section: form.gradeId, standard: form.standardId, subject: form.subjectId }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              onSectionChange={(value) => patch({ gradeId: singleValue(value), standardId: '', subjectId: '', curriculumId: '' })}
              onStandardChange={(value) => patch({ standardId: singleValue(value), subjectId: '', curriculumId: '' })}
              onSubjectChange={(value) => patch({ subjectId: singleValue(value), curriculumId: '' })}
            />

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Curriculum <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.curriculumId}
                  onChange={(e) => patch({ curriculumId: e.target.value })}
                  disabled={!form.subjectId || curriculums.length === 0}
                  className={inputClass}
                >
                  <option value="">
                    {!form.subjectId ? 'Select subject first' : curriculums.length === 0 ? 'No curriculums' : 'Select curriculum'}
                  </option>
                  {curriculums.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Syllabus Title</label>
                <input type="text" value={form.title} onChange={(e) => patch({ title: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Progress Tracking (%)</label>
                <input
                  type="number"
                  min={0}
                  max={999.99}
                  step={0.01}
                  value={form.progressTracking}
                  onChange={(e) => patch({ progressTracking: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Objectives</label>
                <textarea value={form.objectives} onChange={(e) => patch({ objectives: e.target.value })} rows={3} className={textareaClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Learning Outcomes</label>
                <textarea value={form.learningOutcomes} onChange={(e) => patch({ learningOutcomes: e.target.value })} rows={3} className={textareaClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Suggested Materials</label>
                <textarea value={form.suggestedMaterials} onChange={(e) => patch({ suggestedMaterials: e.target.value })} rows={3} className={textareaClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Assessment Plan</label>
                <textarea value={form.assessmentPlan} onChange={(e) => patch({ assessmentPlan: e.target.value })} rows={3} className={textareaClass} />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeForm} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-16 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading syllabus…
          </div>
        ) : (
          <RecordTable
            rows={rows}
            columns={columns}
            getRowKey={(row, i) => row.id || String(i)}
            serialColumn
            searchPlaceholder="Search syllabus…"
            exportFilename="syllabus-plan"
            exportTitle="Syllabus Plan"
            emptyTitle="No syllabus entries"
            emptyHint="Use “Add Syllabus” to create the first entry."
            actions={(row) => (
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                >
                  <Pencil className="size-3.5" /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(row)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            )}
          />
        )}
      </div>
    </div>
    </RequireStaff>
  );
}
