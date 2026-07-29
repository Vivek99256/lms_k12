'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteResource, listPhysicalFiles, listPlaces, mutateForm } from '../_lib/api';
import type { Feedback, PhysicalFileLocation, Place } from '../_lib/types';
import { Field, LoadingState, Message, PageFrame, PageHeader, Panel } from './shared';

type MasterKind = 'place' | 'physical';
type MasterRow = Place | PhysicalFileLocation;
type FormValues = { title: string; description: string; fileCode: string; fileLocation: string };
const emptyForm: FormValues = { title: '', description: '', fileCode: '', fileLocation: '' };

export default function MasterPage({ kind }: { kind: MasterKind }) {
  const physical = kind === 'physical';
  const label = physical ? 'Physical file location' : 'Place master';
  const resource = physical ? 'add_physical_file_location' : 'add_place_master';
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Feedback | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(physical ? await listPhysicalFiles() : await listPlaces());
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : `Unable to load ${label.toLowerCase()} records.` });
    } finally {
      setLoading(false);
    }
  }, [physical, label]);

  useEffect(() => {
    // Loading from Laravel is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(needle)));
  }, [query, rows]);

  const reset = () => { setEditingId(''); setForm(emptyForm); };
  const startEdit = (row: MasterRow) => {
    const file = physical ? row as PhysicalFileLocation : null;
    setEditingId(row.id);
    setForm({ title: row.title, description: row.description, fileCode: file?.fileCode ?? '', fileLocation: file?.fileLocation ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const data = new FormData();
    data.set('title', form.title.trim());
    data.set('description', form.description.trim());
    if (physical) {
      data.set('file_code', form.fileCode.trim());
      data.set('file_location', form.fileLocation.trim());
    }
    try {
      await mutateForm(`inward_outward/${resource}${editingId ? `/${editingId}` : ''}`, editingId ? 'PUT' : 'POST', data);
      setMessage({ type: 'success', text: `${label} ${editingId ? 'updated' : 'added'} successfully.` });
      reset();
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : `Unable to save ${label.toLowerCase()}.` });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: MasterRow) => {
    if (!window.confirm(`Delete “${row.title}”? This may affect entries that use it.`)) return;
    try {
      await deleteResource(`inward_outward/${resource}/${row.id}`);
      setMessage({ type: 'success', text: `${label} deleted successfully.` });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : `Unable to delete ${label.toLowerCase()}.` });
    }
  };

  return (
    <PageFrame>
      <PageHeader title={label} description={physical ? 'Maintain physical file names, codes, and storage locations.' : 'Maintain the places used by inward and outward entries.'} />
      <Message value={message} />
      <Panel title={editingId ? `Edit ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Field label="Title" required><Input required maxLength={255} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Description" required><Textarea required maxLength={255} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          {physical && <>
            <Field label="File code" required><Input required maxLength={255} value={form.fileCode} onChange={(e) => setForm({ ...form, fileCode: e.target.value })} /></Field>
            <Field label="File location" required><Input required maxLength={255} value={form.fileLocation} onChange={(e) => setForm({ ...form, fileLocation: e.target.value })} /></Field>
          </>}
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={saving}><Plus />{saving ? 'Saving…' : editingId ? 'Save changes' : `Add ${physical ? 'location' : 'place'}`}</Button>
            {editingId && <Button type="button" variant="outline" onClick={reset}><X />Cancel</Button>}
          </div>
        </form>
      </Panel>
      <Panel title={`${label} records`}>
        <div className="mb-3 max-w-md"><div className="relative"><Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" /><Input className="pl-8" aria-label={`Search ${label.toLowerCase()}`} placeholder="Search records" value={query} onChange={(e) => setQuery(e.target.value)} /></div></div>
        {loading ? <LoadingState /> : <Table>
          <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Description</TableHead>{physical && <><TableHead>File code</TableHead><TableHead>File location</TableHead></>}<TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{filtered.length ? filtered.map((row) => {
            const file = physical ? row as PhysicalFileLocation : null;
            return <TableRow key={row.id}><TableCell className="font-semibold">{row.title}</TableCell><TableCell className="whitespace-normal">{row.description}</TableCell>{physical && <><TableCell>{file?.fileCode}</TableCell><TableCell>{file?.fileLocation}</TableCell></>}<TableCell><div className="flex justify-end gap-1"><Button size="icon-sm" variant="outline" aria-label={`Edit ${row.title}`} onClick={() => startEdit(row)}><Pencil /></Button><Button size="icon-sm" variant="destructive" aria-label={`Delete ${row.title}`} onClick={() => void remove(row)}><Trash2 /></Button></div></TableCell></TableRow>;
          }) : <TableRow><TableCell colSpan={physical ? 5 : 3} className="h-28 text-center text-slate-600">No records found.</TableCell></TableRow>}</TableBody>
        </Table>}
      </Panel>
    </PageFrame>
  );
}
