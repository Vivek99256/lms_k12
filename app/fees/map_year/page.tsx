'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildSessionContext, createAuthHeaders } from '@/lib/erp-client';
import { legacyRequest, recordArray, readString, type UnknownRecord } from '@/lib/erp-legacy';

type MapYear = { id: string; syear: string; fromMonth: string; toMonth: string; feeType: string };
type FormState = { feeType: string; startMonth: string; endMonth: string };

const months = [
  ['1', 'Jan'], ['2', 'Feb'], ['3', 'Mar'], ['4', 'Apr'], ['5', 'May'], ['6', 'Jun'],
  ['7', 'Jul'], ['8', 'Aug'], ['9', 'Sep'], ['10', 'Oct'], ['11', 'Nov'], ['12', 'Dec'],
] as const;
const feeTypes = [
  ['yearly_fees', 'Yearly Fees'], ['half_year_fees', 'Half Year Fees'],
  ['quarterly_fees', 'Quarterly Fees'], ['monthly_fees', 'Monthly Fees'],
] as const;
const emptyForm: FormState = { feeType: '', startMonth: '', endMonth: '' };

export default function MapYearPage() {
  const [rows, setRows] = useState<MapYear[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await legacyRequest('fees/map_year', { tolerateStatusZero: true });
      setRows(recordArray(payload.data).map(toMapYear));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load map year records.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { const timeoutId = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timeoutId); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.feeType || !form.startMonth || !form.endMonth) { setMessage('Select fee type, starting month, and ending month.'); return; }
    setSaving(true); setMessage('');
    try {
      const body: UnknownRecord = { fee_type: form.feeType, start_month: form.startMonth, end_month: form.endMonth };
      if (editingId) await legacyMutation(`fees/map_year/${editingId}`, 'PUT', body);
      else await legacyMutation('fees/map_year', 'POST', body);
      setForm(emptyForm); setEditingId(''); setMessage('Data Saved'); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save map year.'); }
    finally { setSaving(false); }
  };

  const edit = async (row: MapYear) => {
    setEditingId(row.id);
    setForm({ feeType: row.feeType, startMonth: monthValue(row.fromMonth), endMonth: monthValue(row.toMonth) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete this map year record?')) return;
    try { await legacyMutation(`fees/map_year/${id}`, 'DELETE'); setMessage('Data Deleted'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete map year.'); }
  };

  return <main className="mx-auto  space-y-5 p-4 sm:p-6">
    <div><h1 className="text-xl font-bold text-slate-950">Map Year</h1><p className="mt-1 text-sm text-slate-600">Map the active academic year to its fee interval, exactly as in the old ERP.</p></div>
    {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</div>}
    <form onSubmit={save} className="rounded-lg border bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{editingId ? 'Edit Map Year' : 'Add New'}</h2>{editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(''); setForm(emptyForm); }}>Cancel</Button>}</div>
      <div className="grid gap-4 md:grid-cols-3"><SelectField label="Select Fee Type" value={form.feeType} onChange={(feeType) => setForm((current) => ({ ...current, feeType }))} options={feeTypes} /><SelectField label="Starting Month" value={form.startMonth} onChange={(startMonth) => setForm((current) => ({ ...current, startMonth }))} options={months} /><SelectField label="Ending Month" value={form.endMonth} onChange={(endMonth) => setForm((current) => ({ ...current, endMonth }))} options={months} /></div>
      <Button type="submit" className="mt-5" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus />}{editingId ? 'Save changes' : 'Save'}</Button>
    </form>
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm"><Table><TableHeader><TableRow><TableHead>Sr No</TableHead><TableHead>Syear</TableHead><TableHead>From Month</TableHead><TableHead>To Month</TableHead><TableHead>Fees Type</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={6} className="h-28 text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow> : rows.length ? rows.map((row, index) => <TableRow key={row.id}><TableCell>{index + 1}</TableCell><TableCell>{row.syear}</TableCell><TableCell>{row.fromMonth}</TableCell><TableCell>{row.toMonth}</TableCell><TableCell>{feeTypeLabel(row.feeType)}</TableCell><TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => void edit(row)} aria-label="Edit"><Pencil /></Button><Button size="icon" variant="ghost" onClick={() => void remove(row.id)} aria-label="Delete"><Trash2 className="text-red-600" /></Button></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="h-28 text-center text-slate-500">No Map Year records found.</TableCell></TableRow>}</TableBody></Table></section>
  </main>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) { return <div className="space-y-1.5"><Label>{label}</Label><select required className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">--Select--</option>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></div>; }
function toMapYear(row: UnknownRecord): MapYear { return { id: readString(row.id), syear: readString(row.syear), fromMonth: readString(row.from_month), toMonth: readString(row.to_month), feeType: readString(row.type) }; }
function feeTypeLabel(value: string) { return feeTypes.find(([id]) => id === value)?.[1] || value; }
function monthValue(value: string) { return months.find(([, name]) => name === value)?.[0] || value; }
async function legacyMutation(path: string, method: 'POST' | 'PUT' | 'DELETE', values: UnknownRecord = {}) {
  const session = buildSessionContext();
  const params = new URLSearchParams({ path, type: 'API', sub_institute_id: session.subInstituteId, syear: session.syear, user_id: session.userId });
  const form = new URLSearchParams({ type: 'API', sub_institute_id: session.subInstituteId, syear: session.syear, user_id: session.userId });
  Object.entries(values).forEach(([key, value]) => form.set(key, readString(value)));
  const response = await fetch(`/api/proxy?${params}`, { method, headers: createAuthHeaders(session, method === 'DELETE' ? undefined : 'application/x-www-form-urlencoded'), ...(method === 'DELETE' ? {} : { body: form.toString() }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(readString(payload.message) || `The ERP could not complete the request (${response.status}).`);
}
