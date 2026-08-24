'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Medal,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { SearchDropdown, type DropdownValue } from '@/components/search-dropdown';
import { buildSessionContext } from '@/lib/erp-client';
import { cn } from '@/lib/utils';
import { RecordTable, type RecordColumn } from '@/components/erp/RecordTable';
import {
  deleteLbMaster,
  fetchLbMasters,
  ICON_OPTIONS,
  iconLabel,
  MODULE_OPTIONS,
  moduleLabel,
  PER_VALUE_MODULES,
  saveLbMaster,
  type LbMasterRow,
} from '@/app/lms/leader-board-master/api';
<<<<<<< HEAD
=======
import RequireStaff from '@/app/lms/_shared/RequireStaff';
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

function singleValue(value: DropdownValue): string {
  return Array.isArray(value) ? value[0] ?? '' : value;
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const inputClass =
  'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-50';

interface FormState {
  gradeId: string;
  standardId: string;
  moduleName: string;
  perValue: string;
  description: string;
  points: string;
  icon: string;
  showHide: boolean;
}

const EMPTY_FORM: FormState = {
  gradeId: '',
  standardId: '',
  moduleName: '',
  perValue: '',
  description: '',
  points: '',
  icon: '',
  showHide: true,
};

export default function LeaderBoardMasterPage() {
  const session = useMemo(() => buildSessionContext(), []);

  const [rows, setRows] = useState<LbMasterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [dropdownKey, setDropdownKey] = useState(0);

  const loadList = () => {
    setLoading(true);
    fetchLbMasters()
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
    fetchLbMasters(controller.signal)
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

  const patch = (values: Partial<FormState>) => setForm((prev) => ({ ...prev, ...values }));
  const showPerValue = PER_VALUE_MODULES.includes(form.moduleName);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDropdownKey((k) => k + 1);
    setShowForm(true);
    setSuccessText('');
  };

  const openEdit = (row: LbMasterRow) => {
    setEditingId(row.id);
    setForm({
      gradeId: row.gradeId,
      standardId: row.standardId,
      moduleName: row.moduleName,
      perValue: row.perValue ? String(row.perValue) : '',
      description: row.description,
      points: row.points ? String(row.points) : '',
      icon: row.icon,
      showHide: row.status === '1',
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

  const canSave =
    !!form.gradeId &&
    !!form.standardId &&
    !!form.moduleName &&
    !!form.points &&
    !!form.icon &&
    (!showPerValue || !!form.perValue) &&
    !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setErrorText('');
    setSuccessText('');
    try {
      const msg = await saveLbMaster(form, editingId ?? undefined);
      setSuccessText(msg);
      closeForm();
      loadList();
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: LbMasterRow) => {
    if (!window.confirm(`Delete the "${moduleLabel(row.moduleName)}" rule for ${row.standard}?`)) return;
    setErrorText('');
    setSuccessText('');
    try {
      const msg = await deleteLbMaster(row.id);
      setSuccessText(msg);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (error) {
      setErrorText(errorMessage(error));
    }
  };

  const columns = useMemo<RecordColumn<LbMasterRow>[]>(
    () => [
      { key: 'academicSection', label: 'Academic Section', value: (r) => r.academicSection || '-', sortable: true },
      { key: 'standard', label: 'Standard', value: (r) => r.standard || '-', sortable: true },
      { key: 'moduleName', label: 'Module', value: (r) => moduleLabel(r.moduleName), sortable: true },
      { key: 'points', label: 'Points', align: 'right', value: (r) => String(r.points), sortable: true },
      { key: 'perValue', label: 'Percentage', align: 'right', value: (r) => (PER_VALUE_MODULES.includes(r.moduleName) ? String(r.perValue) : '-') },
      { key: 'icon', label: 'Icon', value: (r) => iconLabel(r.icon) },
      { key: 'description', label: 'Description', value: (r) => r.description || '-' },
      {
        key: 'status',
        label: 'Status',
        align: 'center',
        value: (r) => (r.status === '1' ? 'Show' : 'Hide'),
        render: (r) => (
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
              r.status === '1' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            )}
          >
            {r.status === '1' ? 'Show' : 'Hide'}
          </span>
        ),
      },
    ],
    []
  );

  return (
<<<<<<< HEAD
=======
    <RequireStaff>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1500px] space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Medal className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Leader Board Master</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Configure how many points each activity earns, per class.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={showForm ? closeForm : openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca]"
          >
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? 'Close' : 'Add Master'}
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
              {editingId ? 'Edit Master' : 'Add Master'}
            </h2>

            <SearchDropdown
              key={dropdownKey}
              fields={['section', 'standard']}
              subInstituteId={session.subInstituteId}
              token={session.token}
              labels={{ section: 'Grade', standard: 'Standard' }}
              required={{ section: true, standard: true }}
              values={{ section: form.gradeId, standard: form.standardId }}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              onSectionChange={(value) => patch({ gradeId: singleValue(value), standardId: '' })}
              onStandardChange={(value) => patch({ standardId: singleValue(value) })}
            />

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Module <span className="text-rose-500">*</span>
                </label>
                <select value={form.moduleName} onChange={(e) => patch({ moduleName: e.target.value })} className={inputClass}>
                  <option value="">Select module</option>
                  {MODULE_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {showPerValue ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Percentage <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.perValue}
                    onChange={(e) => patch({ perValue: e.target.value })}
                    className={inputClass}
                  />
                </div>
              ) : null}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Points <span className="text-rose-500">*</span>
                </label>
                <input type="number" min={0} value={form.points} onChange={(e) => patch({ points: e.target.value })} className={inputClass} />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Icon <span className="text-rose-500">*</span>
                </label>
                <select value={form.icon} onChange={(e) => patch({ icon: e.target.value })} className={inputClass}>
                  <option value="">Select icon</option>
                  {ICON_OPTIONS.map((i) => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                rows={2}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400"
              />
            </div>

            <div className="mt-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.showHide}
                  onChange={(e) => patch({ showHide: e.target.checked })}
                  className="size-4 rounded border-slate-300 text-indigo-600 accent-indigo-600"
                />
                Show on leader board
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeForm} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={handleSave} disabled={!canSave} className="inline-flex items-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-16 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading master…
          </div>
        ) : (
          <RecordTable
            rows={rows}
            columns={columns}
            getRowKey={(row, i) => row.id || String(i)}
            serialColumn
            searchPlaceholder="Search master…"
            exportFilename="leader-board-master"
            exportTitle="Leader Board Master"
            emptyTitle="No leader board rules"
            emptyHint="Use “Add Master” to configure activity points."
            actions={(row) => (
              <div className="flex justify-end gap-1.5">
                <button type="button" onClick={() => openEdit(row)} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                  <Pencil className="size-3.5" /> Edit
                </button>
                <button type="button" onClick={() => handleDelete(row)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100">
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            )}
          />
        )}
      </div>
    </div>
<<<<<<< HEAD
=======
    </RequireStaff>
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
  );
}
