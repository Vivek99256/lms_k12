'use client';

<<<<<<< HEAD
import { useMemo, useState } from 'react';
=======
import { useCallback, useEffect, useMemo, useState } from 'react';
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
import { Loader2, Search, Send } from 'lucide-react';
import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type { SearchDropdownValues } from '@/components/search-dropdown/types';
import PageHeader from '@/components/result/PageHeader';
import { Checkbox, EmptyState } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
<<<<<<< HEAD
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
=======
import { buildSessionContext, readString } from '@/lib/erp-client';
import {
  ApiError,
  asRecord,
  getJson,
  postForm,
  records,
  type FieldErrors,
  type FormValue,
} from '../_lib/api';
import type { EntryConfig, JsonRecord, Recipient } from '../_lib/types';
import { ErrorBanner, Field, PageFrame, Panel, SendSummary, Select } from './shared';

const emptyAcademic: Partial<SearchDropdownValues> = { section: '', standard: '', division: '' };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] ?? '' : value ?? '';

interface Option {
  id: string;
  name: string;
}

type Summary = {
  sent?: number;
  requested?: number;
  failed?: { reason?: string }[];
  skipped?: { reason?: string }[];
} | null;

export default function EntryPage({ config }: { config: EntryConfig }) {
  const session = useMemo(() => buildSessionContext(), []);

  const [academic, setAcademic] = useState<Partial<SearchDropdownValues>>(emptyAcademic);
  const [staffGroups, setStaffGroups] = useState<Option[]>([]);
  const [staffGroup, setStaffGroup] = useState('');
  const [academicYears, setAcademicYears] = useState<string[]>([]);
  const [academicYear, setAcademicYear] = useState('');

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);

  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);

  const [busy, setBusy] = useState<'search' | 'send' | ''>('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState<Summary>(null);

  /* ---------------- filter dropdown data ---------------- */

  useEffect(() => {
    if (!config.staff) return;
    let active = true;

    getJson('send-sms-staff/groups')
      .then((response) => {
        if (!active) return;
        setStaffGroups(
          records(response.data).map((row) => ({
            id: readString(row.id),
            name: readString(row.name),
          })),
        );
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load staff groups.');
      });

    return () => {
      active = false;
    };
  }, [config.staff]);

  useEffect(() => {
    if (!config.academicYear) return;
    let active = true;

    getJson('send-notification-parents/options')
      .then((response) => {
        if (!active) return;
        const years = asRecord(response.data).academicYears;
        setAcademicYears(Array.isArray(years) ? years.map((year) => readString(year)) : []);
      })
      .catch(() => {
        /* the year filter is optional - a failure must not block the screen */
      });

    return () => {
      active = false;
    };
  }, [config.academicYear]);

  /* ---------------- recipient search ---------------- */

  const mapRecipient = useCallback(
    (row: JsonRecord): Recipient => {
      const contact = readString(config.email ? row.email : row.mobile);
      const studentId = readString(row.student_id);

      return {
        key: config.selectionKey === 'studentId' ? studentId : contact,
        studentId,
        name: readString(row.name),
        enrollment: readString(row.enrollment_no),
        standard: readString(row.standard_name),
        division: readString(row.division_name),
        contact,
        eligible: row.eligible === true,
      };
    },
    [config.email, config.selectionKey],
  );
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d

  async function searchRecipients() {
    const grade = first(academic.section);
    const standard = first(academic.standard);
    const division = first(academic.division);
<<<<<<< HEAD
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
=======

    if (config.staff ? !staffGroup : !grade || !standard || !division) {
      setError(
        config.staff
          ? 'Select a staff group.'
          : 'Select academic section, standard, and division.',
      );
      return;
    }

    setBusy('search');
    setError('');
    setSummary(null);

    try {
      const params: Record<string, string> = config.staff
        ? { staff: staffGroup }
        : {
            grade,
            standard,
            division,
            ...(config.academicYear && academicYear ? { admission_year: academicYear } : {}),
          };

      const response = await getJson(config.recipientsPath, params);
      const rows = records(asRecord(response.data).stu_data);
      const mapped = rows.map(mapRecipient).filter((item) => item.key !== '');

      setRecipients(mapped);
      // Pre-select everyone who can actually be reached.
      setSelected(new Set(mapped.filter((item) => item.eligible).map((item) => item.key)));
      setSearched(true);
    } catch (cause) {
      setRecipients([]);
      setSelected(new Set());
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      setError(cause instanceof Error ? cause.message : 'Unable to load recipients.');
    } finally {
      setBusy('');
    }
  }

<<<<<<< HEAD
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
=======
  const eligible = useMemo(() => recipients.filter((item) => item.eligible), [recipients]);
  const allSelected = eligible.length > 0 && eligible.every((item) => selected.has(item.key));

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(eligible.map((item) => item.key)) : new Set());
  }

  function toggleOne(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  /* ---------------- send ---------------- */

  async function sendMessage() {
    const errors: FieldErrors = {};
    if (!message.trim()) errors.message = `${config.messageLabel} is required.`;
    if (config.email && !subject.trim()) errors.subject = 'Subject is required.';
    if (selected.size === 0) errors.recipients = 'Select at least one recipient.';

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError('');
      return;
    }

    setBusy('send');
    setError('');
    setSummary(null);

    const chosen = recipients.filter((item) => selected.has(item.key));

    const values: Record<string, FormValue> = {
      [config.messageField]: message.trim(),
    };

    if (config.staff) {
      values.group_id = staffGroup;
    } else {
      values.grade = first(academic.section);
      values.standard = first(academic.standard);
      values.division = first(academic.division);
      if (config.academicYear && academicYear) values.admission_year = academicYear;
    }

    // Posted as sendsms[<key>]=on / sendNotification[<key>]=on, matching the
    // shape the Blade screens submit.
    chosen.forEach((item) => {
      values[`${config.selectionField}[${item.key}]`] = 'on';
    });

    if (config.email) {
      values.all_email = chosen.map((item) => item.contact).join(',');
      values.subject = subject.trim();
      if (attachment) values.fileToUpload = attachment;
    }

    try {
      const response = await postForm(config.sendPath, values);
      const data = asRecord(response.data) as Summary;

      toast.success(response.message);
      setSummary(data);
      setMessage('');
      setSubject('');
      setAttachment(null);
      setFieldErrors({});
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
        setFieldErrors(cause.fieldErrors);
        // A rejected send still reports which recipients failed and why.
        const breakdown = asRecord(cause.raw);
        if ('requested' in breakdown) setSummary(breakdown as Summary);
      } else {
        setError(cause instanceof Error ? cause.message : 'Unable to send the message.');
      }
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
    } finally {
      setBusy('');
    }
  }

<<<<<<< HEAD
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
=======
  const showClassColumns = config.showClassColumns ?? !config.staff;

  return (
    <PageFrame>
      <PageHeader
        icon={config.icon}
        title={config.title}
        subtitle={config.description}
        breadcrumbs={[{ label: 'Easy Communication' }, { label: config.title }]}
      />

      <ErrorBanner message={error} />

      <Panel title="Recipient filters">
        <div className="space-y-4">
          {config.staff ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Staff group" required error={fieldErrors.group_id}>
                <Select value={staffGroup} onChange={setStaffGroup} ariaLabel="Staff group">
                  <option value="">Select staff group</option>
                  {staffGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : (
            <>
              <SearchDropdown
                fields={['section', 'standard', 'division']}
                token={session.token}
                subInstituteId={session.subInstituteId}
                values={academic}
                required={{ section: true, standard: true, division: true }}
                onChange={(values) => setAcademic(values)}
              />
              {config.academicYear && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Admission year">
                    <Select value={academicYear} onChange={setAcademicYear} ariaLabel="Admission year">
                      <option value="">All years</option>
                      {academicYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end">
            <Button onClick={searchRecipients} disabled={Boolean(busy)}>
              {busy === 'search' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {busy === 'search' ? 'Searching…' : 'Search'}
            </Button>
          </div>
        </div>
      </Panel>

      <Panel
        title={`Recipients (${selected.size} of ${recipients.length} selected)`}
        description={
          recipients.length > eligible.length
            ? `${recipients.length - eligible.length} cannot be contacted and are not selectable.`
            : undefined
        }
      >
        {!recipients.length ? (
          <EmptyState
            title={searched ? 'No recipients found' : 'No recipients loaded'}
            message={
              searched
                ? 'No records match the selected filters.'
                : 'Choose the filters above and search to load recipients.'
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={!allSelected && selected.size > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">Name</th>
                  <th className="px-3 py-3 font-semibold">GR No.</th>
                  {showClassColumns && <th className="px-3 py-3 font-semibold">Standard</th>}
                  {showClassColumns && <th className="px-3 py-3 font-semibold">Division</th>}
                  <th className="px-3 py-3 font-semibold">{config.contactLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recipients.map((item) => (
                  <tr
                    key={item.key || item.studentId}
                    className={!item.eligible ? 'bg-slate-50 text-slate-400' : undefined}
                  >
                    <td className="px-3 py-3">
                      <Checkbox
                        checked={selected.has(item.key)}
                        disabled={!item.eligible}
                        onChange={(checked) => toggleOne(item.key, checked)}
                      />
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-800">{item.name || '—'}</td>
                    <td className="px-3 py-3">{item.enrollment || '—'}</td>
                    {showClassColumns && <td className="px-3 py-3">{item.standard || '—'}</td>}
                    {showClassColumns && <td className="px-3 py-3">{item.division || '—'}</td>}
                    <td className="px-3 py-3">
                      {item.contact || <span className="italic">Not available</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Compose message">
        <div className="space-y-4">
          {config.email && (
            <Field label="Subject" required error={fieldErrors.subject}>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={255}
              />
            </Field>
          )}

          <Field
            label={config.messageLabel}
            required
            error={fieldErrors.message ?? fieldErrors[config.messageField]}
            helpText={
              config.messageMaxLength
                ? `${message.length} / ${config.messageMaxLength} characters`
                : undefined
            }
          >
            <Textarea
              value={message}
              maxLength={config.messageMaxLength}
              onChange={(event) => setMessage(event.target.value)}
              rows={7}
            />
          </Field>

          {config.email && (
            <Field
              label="Attachment"
              helpText="Up to 10 MB. PDF, Office, image, text or zip files."
              error={fieldErrors.fileToUpload}
            >
              <Input
                type="file"
                onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
              />
            </Field>
          )}

          {fieldErrors.recipients && (
            <p className="text-xs font-medium text-rose-600">{fieldErrors.recipients}</p>
          )}

          <SendSummary summary={summary} />

          <div className="flex justify-end">
            <Button onClick={sendMessage} disabled={busy === 'send' || !recipients.length}>
              {busy === 'send' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send to {selected.size} recipient{selected.size === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      </Panel>
    </PageFrame>
  );
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
}
