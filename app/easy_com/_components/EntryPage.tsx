'use client';

import { useMemo, useState } from 'react';
import { Loader2, Search, Send } from 'lucide-react';
import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type { SearchDropdownValues } from '@/components/search-dropdown/types';
import PageHeader from '@/components/result/PageHeader';
import { Checkbox, EmptyState } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { buildSessionContext } from '@/lib/erp-client';
import { asRecord, communicationRequest, mapRecipient, postForm, records, responseMessage } from '../_lib/api';
import type { EntryConfig, Recipient } from '../_lib/types';
import { ErrorBanner, Field, PageFrame, Panel } from './shared';

const emptyAcademic: Partial<SearchDropdownValues> = { section: '', standard: '', division: '' };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';

export default function EntryPage({ config }: { config: EntryConfig }) {
  const session = buildSessionContext();
  const [academic, setAcademic] = useState<Partial<SearchDropdownValues>>(emptyAcademic);
  const [staff, setStaff] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [busy, setBusy] = useState<'search' | 'send' | ''>('');
  const [error, setError] = useState('');

  const eligible = useMemo(() => recipients.filter((item) => item.eligible), [recipients]);
  const allSelected = eligible.length > 0 && eligible.every((item) => selected.has(item.id));

  async function searchRecipients() {
    const grade = first(academic.section);
    const standard = first(academic.standard);
    const division = first(academic.division);
    if (config.staff ? !staff : (!grade || !standard || !division)) {
      setError(config.staff ? 'Select a staff group.' : 'Select academic section, standard, and division.');
      return;
    }
    setBusy('search');
    setError('');
    try {
      const params = new URLSearchParams(config.staff ? { staff } : { grade, standard, division });
      const payload = await communicationRequest(config.searchPath, undefined, params);
      const root = asRecord(payload);
      const nested = asRecord(root.data);
      const recipientData = root.stu_data ?? nested.stu_data ?? root.data ?? payload;
      const rows = records(recipientData);
      const mapped = rows.map((row) => mapRecipient(row, config.email ? 'email' : 'mobile'));
      setRecipients(mapped);
      setSelected(new Set(mapped.filter((row) => row.eligible).map((row) => row.id)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load recipients.');
    } finally {
      setBusy('');
    }
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(eligible.map((item) => item.id)) : new Set());
  }

  async function sendMessage() {
    if (!message.trim() || selected.size === 0 || (config.email && !subject.trim())) {
      setError(config.email ? 'Select recipients and enter a subject and message.' : 'Select recipients and enter a message.');
      return;
    }
    setBusy('send');
    setError('');
    const chosen = recipients.filter((item) => selected.has(item.id));
    const grade = first(academic.section);
    const standard = first(academic.standard);
    const division = first(academic.division);
    const selectionKey = config.kind === 'notification-parents' || config.kind === 'whatsapp-parents' ? 'sendNotification' : 'sendsms';
    const values: Record<string, string | File | string[]> = {
      grade, standard, division, group_id: staff,
      [config.email ? 'content' : config.kind === 'notification-parents' ? 'notificationText' : config.kind === 'whatsapp-parents' ? 'message' : 'smsText']: message.trim(),
      ...Object.fromEntries(chosen.map((item) => [`${selectionKey}[${config.kind === 'whatsapp-parents' ? item.id : item.contact}]`, 'on'])),
    };
    if (config.email) {
      values.all_email = chosen.map((item) => item.contact).join(',');
      values['example-subject'] = subject.trim();
      if (attachment) values.fileToUpload = attachment;
    }
    try {
      const payload = await postForm(config.submitPath, values);
      toast.success(responseMessage(payload, 'Message sent successfully.'));
      setMessage('');
      setSubject('');
      setAttachment(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send the message.');
    } finally {
      setBusy('');
    }
  }

  return <PageFrame>
    <PageHeader icon={config.icon} title={config.title} subtitle={config.description} breadcrumbs={[{ label: 'Easy Communication' }, { label: config.title }]} />
    <ErrorBanner message={error} />
    <Panel title="Recipient filters">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        {config.staff ? <Field label="Staff group" required><Input value={staff} onChange={(event) => setStaff(event.target.value)} placeholder="Enter staff group ID" /></Field> :
          <SearchDropdown fields={['section', 'standard', 'division']} token={session.token} subInstituteId={session.subInstituteId} values={academic} required={{ section: true, standard: true, division: true }} onChange={(values) => setAcademic(values)} />}
        <Button onClick={searchRecipients} disabled={Boolean(busy)}><Search className="h-4 w-4" />{busy === 'search' ? 'Searching…' : 'Search'}</Button>
      </div>
    </Panel>
    <Panel title={`Recipients (${recipients.length})`}>
      {!recipients.length ? <EmptyState title="No recipients loaded" message="Choose the filters above and search to load recipients." /> :
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>
              <th className="px-3 py-3"><Checkbox checked={allSelected} indeterminate={!allSelected && selected.size > 0} onChange={toggleAll} /></th>
              <th className="px-3 py-3">Name</th><th className="px-3 py-3">GR No.</th><th className="px-3 py-3">Standard</th><th className="px-3 py-3">Division</th><th className="px-3 py-3">{config.contactLabel}</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{recipients.map((item) => <tr key={item.id} className={!item.eligible ? 'bg-slate-50 text-slate-400' : ''}>
              <td className="px-3 py-3"><Checkbox checked={selected.has(item.id)} disabled={!item.eligible} onChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(item.id); else next.delete(item.id); return next; })} /></td>
              <td className="px-3 py-3 font-medium text-slate-800">{item.name || '—'}</td><td className="px-3 py-3">{item.enrollment || '—'}</td><td className="px-3 py-3">{item.standard || '—'}</td><td className="px-3 py-3">{item.division || '—'}</td><td className="px-3 py-3">{item.contact || 'Not available'}</td>
            </tr>)}</tbody>
          </table>
        </div>}
    </Panel>
    <Panel title="Compose message">
      <div className="space-y-4">
        {config.email && <Field label="Subject" required><Input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={255} /></Field>}
        <Field label={config.messageLabel} required><Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={7} /></Field>
        {config.email && <Field label="Attachment"><Input type="file" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} /></Field>}
        <div className="flex justify-end"><Button onClick={sendMessage} disabled={busy === 'send' || !recipients.length}><Send className="h-4 w-4" />{busy === 'send' && <Loader2 className="h-4 w-4 animate-spin" />}Send to {selected.size} recipient{selected.size === 1 ? '' : 's'}</Button></div>
      </div>
    </Panel>
  </PageFrame>;
}
