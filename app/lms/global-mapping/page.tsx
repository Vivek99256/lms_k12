'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  Network,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  createMapping,
  deleteMapping,
  fetchGlobalMappings,
  renameMapping,
  type MappingTypeRow,
} from '@/app/lms/global-mapping/api';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const inputClass =
  'h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400';

export default function GlobalMappingPage() {
  const [types, setTypes] = useState<MappingTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [query, setQuery] = useState('');

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [values, setValues] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadList = () => {
    setLoading(true);
    fetchGlobalMappings()
      .then((data) => {
        setTypes(data);
        setLoading(false);
      })
      .catch((error: unknown) => {
        setTypes([]);
        setErrorText(errorMessage(error));
        setLoading(false);
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchGlobalMappings(controller.signal)
      .then((data) => {
        setTypes(data);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTypes([]);
        setErrorText(errorMessage(error));
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return types;
    return types
      .map((t) => {
        if (t.name.toLowerCase().includes(q)) return t;
        const values = t.values.filter((v) => v.name.toLowerCase().includes(q));
        return values.length > 0 ? { ...t, values } : null;
      })
      .filter((t): t is MappingTypeRow => t !== null);
  }, [types, query]);

  // --- Add form ---
  const canSave = !!typeName.trim() && values.some((v) => v.trim()) && !saving;
  const handleAddValueRow = () => setValues((prev) => [...prev, '']);
  const handleRemoveValueRow = (i: number) => setValues((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  const patchValue = (i: number, val: string) => setValues((prev) => prev.map((v, idx) => (idx === i ? val : v)));

  const resetForm = () => {
    setTypeName('');
    setValues(['']);
  };

  const handleCreate = async () => {
    if (!canSave) return;
    setSaving(true);
    setErrorText('');
    setSuccessText('');
    try {
      const msg = await createMapping(typeName.trim(), values);
      setSuccessText(msg);
      resetForm();
      setShowForm(false);
      loadList();
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  // --- Inline rename ---
  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
    setSuccessText('');
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };
  const saveEdit = async (id: string) => {
    const name = editingName.trim();
    if (!name) return;
    setBusyId(id);
    setErrorText('');
    try {
      const msg = await renameMapping(id, name);
      setSuccessText(msg);
      cancelEdit();
      loadList();
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusyId(id);
    setErrorText('');
    setSuccessText('');
    try {
      const msg = await deleteMapping(id);
      setSuccessText(msg);
      loadList();
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const renderName = (id: string, name: string, strong: boolean) => {
    if (editingId === id) {
      return (
        <span className="flex items-center gap-1.5">
          <input
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            className="h-8 w-56 rounded-lg border border-indigo-300 px-2 text-sm outline-none"
            autoFocus
          />
          <button type="button" onClick={() => saveEdit(id)} disabled={busyId === id} className="rounded-md bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 disabled:opacity-60">
            {busyId === id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          </button>
          <button type="button" onClick={cancelEdit} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50">
            <X className="size-3.5" />
          </button>
        </span>
      );
    }
    return <span className={cn(strong ? 'font-semibold text-slate-900' : 'text-slate-700')}>{name || '-'}</span>;
  };

  const rowActions = (id: string, name: string, canDelete: boolean) =>
    editingId === id ? null : (
      <span className="flex items-center gap-1.5">
        <button type="button" onClick={() => startEdit(id, name)} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
          <Pencil className="size-3" /> Rename
        </button>
        {canDelete ? (
          <button type="button" onClick={() => handleDelete(id, name)} disabled={busyId === id} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60">
            <Trash2 className="size-3" /> Delete
          </button>
        ) : null}
      </span>
    );

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1100px] space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Network className="size-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">LMS Global Mapping</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Global mapping taxonomy (DOK, Bloom&apos;s, Learning Outcomes) — types and their values.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setSuccessText('');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca]"
          >
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
            {showForm ? 'Close' : 'Add Mapping'}
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

        {/* Add form */}
        {showForm ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">Add Mapping</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Mapping Type <span className="text-rose-500">*</span>
                </label>
                <input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="e.g. Learning Outcome" className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Mapping Values <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {values.map((v, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={v} onChange={(e) => patchValue(i, e.target.value)} placeholder={`Value ${i + 1}`} className={inputClass} />
                      <button type="button" onClick={() => handleRemoveValueRow(i)} disabled={values.length === 1} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={handleAddValueRow} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                    <Plus className="size-3.5" /> Add value
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={handleCreate} disabled={!canSave} className="inline-flex items-center gap-2 rounded-xl bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Save
              </button>
            </div>
          </section>
        ) : null}

        {/* Search */}
        {!loading && types.length > 0 ? (
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search types or values…"
              className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-400"
            />
          </div>
        ) : null}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-16 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> Loading mappings…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 px-3 py-16 text-center text-sm text-slate-500">
            No mappings found.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((type) => (
              <section key={type.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    {renderName(type.id, type.name, true)}
                    {type.globally ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">global</span>
                    ) : null}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      {type.values.length} value{type.values.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {/* A type with children can't be deleted (matches Laravel UI). */}
                  {rowActions(type.id, type.name, type.values.length === 0)}
                </header>
                {type.values.length > 0 ? (
                  <ul className="divide-y divide-slate-50">
                    {type.values.map((value) => (
                      <li key={value.id} className="flex items-center justify-between gap-2 px-4 py-2.5 pl-8">
                        {renderName(value.id, value.name, false)}
                        {rowActions(value.id, value.name, true)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
