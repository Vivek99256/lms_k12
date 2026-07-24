'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import PageHeader from '@/components/result/PageHeader';
import { ConfirmDialog, EmptyState, Modal } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { readString } from '@/lib/erp-client';
import { communicationRequest, dataRecords, deleteRecord, postForm, responseMessage } from '../_lib/api';
import type { JsonRecord, MasterConfig } from '../_lib/types';
import { ErrorBanner, Field, Loading, PageFrame, Panel } from './shared';

export default function MasterPage({ config }: { config: MasterConfig }) {
  const [rows, setRows] = useState<JsonRecord[]>([]);
  const [editing, setEditing] = useState<JsonRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [deleteRow, setDeleteRow] = useState<JsonRecord | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadRows() {
    setLoading(true);
    setError('');
    try {
      setRows(dataRecords(await communicationRequest(config.path)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let active = true;
    communicationRequest(config.path)
      .then((payload) => { if (active) setRows(dataRecords(payload)); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Unable to load settings.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [config.path]);

  function openForm(row?: JsonRecord) {
    const source = row ?? {};
    setEditing(row ?? {});
    setForm(Object.fromEntries(config.fields.map((field) => [field.key, readString(source[field.key === 'email' && config.kind === 'smtp' ? 'gmail' : field.key])])));
  }

  async function save() {
    const missing = config.fields.find((field) => field.required && !form[field.key]?.trim());
    if (missing) { setError(`${missing.label} is required.`); return; }
    setSaving(true); setError('');
    try {
      const id = readString(editing?.id);
      const path = config.kind === 'whatsapp-api' ? (config.createPath ?? config.path) : id ? `${config.path}/${id}` : config.path;
      const values: Record<string, string> = { ...form };
      if (id) { values.id = id; values._method = 'PUT'; }
      const payload = await postForm(path, values);
      toast.success(responseMessage(payload, 'Setting saved successfully.'));
      setEditing(null);
      await loadRows();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save the setting.');
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!deleteRow) return;
    setSaving(true);
    try {
      const id = readString(deleteRow.id);
      const path = config.kind === 'whatsapp-api' ? `${config.path}/destroy/${id}` : `${config.path}/${id}`;
      const payload = await deleteRecord(path);
      toast.success(responseMessage(payload, 'Setting deleted.'));
      setDeleteRow(null);
      await loadRows();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to delete the setting.'); }
    finally { setSaving(false); }
  }

  async function checkEmail() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) { setError('Enter a valid test email address.'); return; }
    setSaving(true); setError('');
    try {
      const payload = await postForm('check-email', { to_email: testEmail });
      toast.success(responseMessage(payload, 'Test email sent.'));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send the test email.'); }
    finally { setSaving(false); }
  }

  return <PageFrame>
    <PageHeader icon={config.icon} title={config.title} subtitle={config.description} breadcrumbs={[{ label: 'Easy Communication' }, { label: config.title }]} actions={<Button onClick={() => openForm()}><Plus className="h-4 w-4" />Add new</Button>} />
    <ErrorBanner message={error} />
    {config.testEmail && <Panel title="Test SMTP connection"><div className="flex max-w-xl flex-col gap-3 sm:flex-row"><Input type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="recipient@example.com" /><Button onClick={checkEmail} disabled={saving}><Send className="h-4 w-4" />Send test</Button></div></Panel>}
    <Panel title="Configured records">
      {loading ? <Loading /> : !rows.length ? <EmptyState title="No settings configured" message="Add the first configuration to enable this communication channel." /> :
        <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-max text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{config.columns.map((column) => <th key={column.key} className="px-3 py-3">{column.label}</th>)}<th className="px-3 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={readString(row.id) || index}>{config.columns.map((column) => <td key={column.key} className="px-3 py-3">{column.key.includes('password') || column.key.includes('token') ? '••••••••' : readString(row[column.key]) || '—'}</td>)}<td className="px-3 py-3"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => openForm(row)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label="Delete" className="text-rose-600" onClick={() => setDeleteRow(row)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}</tbody></table></div>}
    </Panel>
    <Modal open={editing !== null} onClose={() => setEditing(null)} title={readString(editing?.id) ? `Edit ${config.title}` : `Add ${config.title}`} footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">{config.fields.map((field) => <Field key={field.key} label={field.label} required={field.required}><Input type={field.type ?? 'text'} value={form[field.key] ?? ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} /></Field>)}</div>
    </Modal>
    <ConfirmDialog open={deleteRow !== null} onClose={() => setDeleteRow(null)} onConfirm={remove} title="Delete configuration?" message="This communication configuration will be permanently removed." busy={saving} />
  </PageFrame>;
}
