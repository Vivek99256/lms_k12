'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import PageHeader from '@/components/result/PageHeader';
import { ConfirmDialog, EmptyState, Modal } from '@/components/result/primitives';
import { toast } from '@/components/result/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { readString } from '@/lib/erp-client';
import {
  ApiError,
  cellValue,
  deleteJson,
  getJson,
  postForm,
  putJson,
  records,
  type FieldErrors,
  type FormValue,
} from '../_lib/api';
import type { JsonRecord, MasterConfig } from '../_lib/types';
import { ErrorBanner, Field, Loading, PageFrame, Panel } from './shared';

/** Placeholder shown in secret inputs when editing; submitting it keeps the stored value. */
const SECRET_MASK = '••••••••';

export default function MasterPage({ config }: { config: MasterConfig }) {
  const [rows, setRows] = useState<JsonRecord[]>([]);
  const [editing, setEditing] = useState<JsonRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [deleteRow, setDeleteRow] = useState<JsonRecord | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadRows = useCallback(async () => {
    setError('');
    try {
      const response = await getJson(config.path);
      setRows(records(response.data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }, [config.path]);

  useEffect(() => {
    let active = true;

    getJson(config.path)
      .then((response) => {
        if (active) setRows(records(response.data));
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load settings.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [config.path]);

  const editingId = readString(editing?.id);
  const isEdit = editingId !== '';

  /**
   * A singleton master (one gateway / mailbox / WhatsApp number per institute)
   * cannot take a second record - the API rejects it, so hide the action too.
   */
  const canAdd = !config.singleton || rows.length === 0;

  const openForm = useCallback(
    (row?: JsonRecord) => {
      const source = row ?? {};
      const next: Record<string, string> = {};

      config.fields.forEach((field) => {
        if (field.secret) {
          // Show a mask when a credential already exists; blank on create.
          const hasStored = source[field.secretFlag ?? `has_${field.key}`] === true;
          next[field.key] = row && hasStored ? SECRET_MASK : '';
          return;
        }
        next[field.key] = readString(source[field.key]);
      });

      setForm(next);
      setFieldErrors({});
      setError('');
      setEditing(row ?? {});
    },
    [config.fields],
  );

  async function save() {
    const missing = config.fields.find((field) => field.required && !form[field.key]?.trim());
    if (missing) {
      setFieldErrors({ [missing.key]: `${missing.label} is required.` });
      return;
    }

    setSaving(true);
    setError('');
    setFieldErrors({});

    const values: Record<string, FormValue> = {};
    config.fields.forEach((field) => {
      const value = form[field.key] ?? '';
      // An untouched mask means "keep the stored credential" - do not send it.
      if (field.secret && value === SECRET_MASK) return;
      values[field.key] = value;
    });

    try {
      const response = isEdit
        ? await putJson(`${config.path}/${editingId}`, values)
        : await postForm(config.path, values);

      toast.success(response.message);
      setEditing(null);
      await loadRows();
    } catch (cause) {
      if (cause instanceof ApiError) {
        setFieldErrors(cause.fieldErrors);
        setError(Object.keys(cause.fieldErrors).length ? '' : cause.message);
      } else {
        setError(cause instanceof Error ? cause.message : 'Unable to save the configuration.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteRow) return;

    setSaving(true);
    setError('');
    try {
      const response = await deleteJson(`${config.path}/${readString(deleteRow.id)}`);
      toast.success(response.message);
      setDeleteRow(null);
      await loadRows();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete the configuration.');
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    if (!config.testPath) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      setError('Enter a valid test email address.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await postForm(config.testPath, { to_email: testEmail });
      toast.success(response.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send the test email.');
    } finally {
      setSaving(false);
    }
  }

  const modalTitle = useMemo(
    () => (isEdit ? `Edit ${config.entityLabel}` : `Add ${config.entityLabel}`),
    [config.entityLabel, isEdit],
  );

  return (
    <PageFrame>
      <PageHeader
        icon={config.icon}
        title={config.title}
        subtitle={config.description}
        breadcrumbs={[{ label: 'Easy Communication' }, { label: config.title }]}
        actions={
          canAdd ? (
            <Button onClick={() => openForm()}>
              <Plus className="h-4 w-4" />
              Add new
            </Button>
          ) : undefined
        }
      />

      <ErrorBanner message={error} />

      {config.testPath && (
        <Panel
          title="Test SMTP connection"
          description="Sends a test message using the saved credentials."
        >
          <div className="flex max-w-xl flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="recipient@example.com"
            />
            <Button onClick={sendTestEmail} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send test
            </Button>
          </div>
        </Panel>
      )}

      <Panel title="Configured records">
        {loading ? (
          <Loading />
        ) : !rows.length ? (
          <EmptyState
            title="No settings configured"
            message="Add the first configuration to enable this communication channel."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {config.columns.map((column) => (
                    <th key={column.key} className="px-3 py-3 font-semibold">
                      {column.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => (
                  <tr key={readString(row.id) || index} className="align-top">
                    {config.columns.map((column) => (
                      <td
                        key={column.key}
                        className={
                          column.wide
                            ? 'max-w-md break-words px-3 py-3 text-slate-700'
                            : 'px-3 py-3 text-slate-700'
                        }
                      >
                        {cellValue(row, column.key) || '—'}
                      </td>
                    ))}
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit ${config.entityLabel}`}
                          onClick={() => openForm(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${config.entityLabel}`}
                          className="text-rose-600"
                          onClick={() => setDeleteRow(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={modalTitle}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Update' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {config.fields.map((field) => (
            <div key={field.key} className={field.wide ? 'sm:col-span-2' : undefined}>
              <Field
                label={field.label}
                required={field.required}
                error={fieldErrors[field.key]}
                helpText={
                  field.secret && isEdit
                    ? 'Leave unchanged to keep the saved value.'
                    : field.helpText
                }
              >
                <Input
                  type={field.type ?? 'text'}
                  value={form[field.key] ?? ''}
                  autoComplete={field.secret ? 'new-password' : 'off'}
                  onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                  onFocus={(event) => {
                    // Clear the mask on first focus so typing replaces it.
                    if (field.secret && event.target.value === SECRET_MASK) {
                      setForm((current) => ({ ...current, [field.key]: '' }));
                    }
                  }}
                />
              </Field>
            </div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteRow !== null}
        onClose={() => setDeleteRow(null)}
        onConfirm={remove}
        title={`Delete ${config.entityLabel}?`}
        message="This communication configuration will be permanently removed."
        busy={saving}
      />
    </PageFrame>
  );
}
