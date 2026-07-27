'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Edit3, Loader2, Plus, Trash2 } from 'lucide-react';
import { deleteSetup, listSetup, saveSetup, type SetupResource, type SetupRow } from './setup-api';

export default function StudentSetupMaster({ resource, title, label }: { resource: SetupResource; title: string; label: string }) {
  const [rows, setRows] = useState<SetupRow[]>([]); const [name, setName] = useState(''); const [sort, setSort] = useState('');
  const [editing, setEditing] = useState(''); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const load = () => listSetup(resource).then(setRows);
  useEffect(() => { listSetup(resource).then(setRows).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load data.')).finally(() => setLoading(false)); }, [resource]);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError('');
    try { setNotice(await saveSetup(resource, { name, sort_order: sort }, editing || undefined)); setName(''); setSort(''); setEditing(''); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save.'); } finally { setSaving(false); }
  };
  const remove = async (id: string) => { if (!confirm(`Delete this ${label.toLowerCase()}?`)) return; try { setNotice(await deleteSetup(resource, id)); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to delete.'); } };
  return <div className="space-y-5 p-6"><div><h1 className="text-2xl font-bold text-slate-950">{title}</h1><p className="mt-1 text-sm text-slate-500">Add and manage {label.toLowerCase()} records.</p></div>
    {(notice || error) && <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{error || notice}</div>}
    <form onSubmit={submit} className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm md:grid-cols-[1fr_180px_auto] md:items-end">
      <label className="space-y-1"><span className="text-sm font-medium">{label}</span><input required value={name} onChange={e => setName(e.target.value)} className="h-10 w-full rounded-md border px-3" /></label>
      <label className="space-y-1"><span className="text-sm font-medium">Sort Order</span><input type="number" min="0" value={sort} onChange={e => setSort(e.target.value)} className="h-10 w-full rounded-md border px-3" /></label>
      <button disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-indigo-600 px-5 text-sm font-medium text-white">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{editing ? 'Update' : 'Add'}</button>
    </form>
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm"><table className="w-full"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">{label}</th><th className="px-4 py-3">Sort Order</th><th className="px-4 py-3">Actions</th></tr></thead>
      <tbody className="divide-y">{loading ? <tr><td colSpan={3} className="p-10 text-center text-slate-500">Loading…</td></tr> : rows.map(row => <tr key={row.id}><td className="px-4 py-3 font-medium">{row.name}</td><td className="px-4 py-3">{row.sort_order || '-'}</td><td className="px-4 py-3"><button onClick={() => { setEditing(row.id); setName(row.name); setSort(row.sort_order); }} className="p-2 text-indigo-600"><Edit3 className="h-4 w-4" /></button><button onClick={() => remove(row.id)} className="p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></td></tr>)}
      {!loading && rows.length === 0 && <tr><td colSpan={3} className="p-10 text-center text-slate-500">No records found.</td></tr>}</tbody></table></div></div>;
}
