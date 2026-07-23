'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { attachmentUrl, deleteResource, listEntries, loadEntryMetadata, mutateForm } from '../_lib/api';
import type { Feedback, PhysicalFileLocation, Place, RegisterEntry, RegisterKind } from '../_lib/types';
import { Field, LoadingState, Message, NativeSelect, PageFrame, PageHeader, Panel } from './shared';

type EntryForm = { placeId: string; date: string; number: string; title: string; description: string; fileLocationId: string; attachment: File | null };
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): EntryForm => ({ placeId: '', date: today(), number: '', title: '', description: '', fileLocationId: '', attachment: null });
const formatDate = (value: string) => {
  if (!value) return '-';
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
};

export default function RegisterPage({ kind }: { kind: RegisterKind }) {
  const title = kind === 'inward' ? 'Inward' : 'Outward';
  const [rows, setRows] = useState<RegisterEntry[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [files, setFiles] = useState<PhysicalFileLocation[]>([]);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [editing, setEditing] = useState<RegisterEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Feedback | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await listEntries(kind)); }
    catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : `Unable to load ${kind} entries.` }); }
    finally { setLoading(false); }
  }, [kind]);
  useEffect(() => {
    // Loading from Laravel is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const beginCreate = async () => {
    setMessage(null);
    try {
      const metadata = await loadEntryMetadata(kind);
      setPlaces(metadata.places); setFiles(metadata.files);
      setForm({ ...emptyForm(), number: metadata.nextNumber });
      setEditing(null); setShowForm(true);
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load form options.' }); }
  };
  const beginEdit = async (row: RegisterEntry) => {
    try {
      const metadata = await loadEntryMetadata(kind);
      setPlaces(metadata.places); setFiles(metadata.files);
      const place = metadata.places.find((item) => item.title === row.placeName);
      const file = metadata.files.find((item) => item.title === row.fileName);
      setForm({ placeId: place?.id ?? row.placeId, fileLocationId: file?.id ?? row.fileLocationId, date: row.date.slice(0, 10), number: row.number, title: row.title, description: row.description, attachment: null });
      setEditing(row); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load entry.' }); }
  };
  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing && !form.attachment) { setMessage({ type: 'error', text: 'Choose an image attachment.' }); return; }
    setSaving(true); setMessage(null);
    const data = new FormData();
    data.set('place_id', form.placeId); data.set('file_location_id', form.fileLocationId);
    data.set(`${kind}_number`, form.number); data.set(`${kind}_date`, form.date);
    data.set('title', form.title.trim()); data.set('description', form.description.trim());
    if (form.attachment) data.set('attachment', form.attachment);
    try {
      await mutateForm(`inward_outward/add_${kind}${editing ? `/${editing.id}` : ''}`, editing ? 'PUT' : 'POST', data);
      setMessage({ type: 'success', text: `${title} entry ${editing ? 'updated' : 'added'} successfully.` });
      closeForm(); await load();
    } catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : `Unable to save ${kind} entry.` }); }
    finally { setSaving(false); }
  };
  const remove = async (row: RegisterEntry) => {
    if (!window.confirm(`Delete ${kind} entry ${row.number}?`)) return;
    try { await deleteResource(`inward_outward/add_${kind}/${row.id}`); setMessage({ type: 'success', text: `${title} entry deleted successfully.` }); await load(); }
    catch (error) { setMessage({ type: 'error', text: error instanceof Error ? error.message : `Unable to delete ${kind} entry.` }); }
  };
  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    return needle ? rows.filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(needle))) : rows;
  }, [query, rows]);

  return <PageFrame>
    <PageHeader title={title} description={`Create and maintain ${kind} document entries for the selected academic year.`} action={!showForm && <Button onClick={() => void beginCreate()}><Plus />Add {kind}</Button>} />
    <Message value={message} />
    {showForm && <Panel title={editing ? `Edit ${kind} entry` : `Add ${kind} entry`}>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label={kind === 'inward' ? 'From place' : 'To place'} required><NativeSelect required value={form.placeId} onChange={(value) => setForm({ ...form, placeId: value })}><option value="">Select place</option>{places.map((place) => <option key={place.id} value={place.id}>{place.title}</option>)}</NativeSelect></Field>
        <Field label={`${title} date`} required><Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label={`${title} number`} required><Input required readOnly value={form.number} /></Field>
        <Field label="Subject" required><Input required maxLength={255} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Description" required><Textarea required maxLength={255} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="File name" required><NativeSelect required value={form.fileLocationId} onChange={(value) => setForm({ ...form, fileLocationId: value })}><option value="">Select file name</option>{files.map((file) => <option key={file.id} value={file.id}>{file.title}</option>)}</NativeSelect></Field>
        <Field label={`Upload image${editing ? ' (leave blank to keep current)' : ''}`} required={!editing}><Input type="file" accept="image/*" required={!editing} onChange={(e) => setForm({ ...form, attachment: e.target.files?.[0] ?? null })} /></Field>
        <div className="flex items-end gap-2 lg:col-span-2"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : `Add ${kind}`}</Button><Button type="button" variant="outline" onClick={closeForm}><X />Cancel</Button></div>
      </form>
    </Panel>}
    <Panel title={`${title} entries`}>
      <div className="mb-3 max-w-md"><div className="relative"><Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" /><Input className="pl-8" placeholder="Search entries" aria-label={`Search ${kind} entries`} value={query} onChange={(e) => setQuery(e.target.value)} /></div></div>
      {loading ? <LoadingState /> : <Table className="min-w-[1250px]"><TableHeader><TableRow><TableHead>Sr. no.</TableHead><TableHead>{kind === 'inward' ? 'From place' : 'To place'}</TableHead><TableHead>{title} no.</TableHead><TableHead>Subject</TableHead><TableHead>Description</TableHead><TableHead>File name</TableHead><TableHead>File location</TableHead><TableHead>Academic year</TableHead><TableHead>{title} date</TableHead><TableHead>Attachment</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>{filtered.length ? filtered.map((row, index) => <TableRow key={row.id}><TableCell>{index + 1}</TableCell><TableCell>{row.placeName}</TableCell><TableCell className="font-mono">{row.number}</TableCell><TableCell>{row.title}</TableCell><TableCell className="max-w-64 whitespace-normal">{row.description}</TableCell><TableCell>{row.fileName}</TableCell><TableCell>{row.fileLocation}</TableCell><TableCell>{row.academicYear || row.syear || '-'}</TableCell><TableCell>{formatDate(row.date)}</TableCell><TableCell>{row.attachment ? <a className="inline-flex items-center gap-1 text-blue-700 hover:underline" target="_blank" rel="noreferrer" href={attachmentUrl(kind, row.attachment)}>{row.attachment}<ExternalLink className="h-3 w-3" /></a> : '-'}</TableCell><TableCell><div className="flex justify-end gap-1"><Button size="icon-sm" variant="outline" aria-label={`Edit entry ${row.number}`} onClick={() => void beginEdit(row)}><Pencil /></Button><Button size="icon-sm" variant="destructive" aria-label={`Delete entry ${row.number}`} onClick={() => void remove(row)}><Trash2 /></Button></div></TableCell></TableRow>) : <TableRow><TableCell colSpan={11} className="h-28 text-center text-slate-600">No entries found.</TableCell></TableRow>}</TableBody></Table>}
    </Panel>
  </PageFrame>;
}
