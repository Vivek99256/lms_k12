'use client';

/**
 * Generic master-screen experience: data table (search / sort / filter /
 * export / pagination / column visibility) + create & edit in a side
 * drawer + delete confirmation — all driven by a MasterScreenDef config.
 *
 * Laravel wiring: GET {index}, POST {store}, POST {update}/{id} with
 * `_method=PUT`, POST {destroy}/{id} with `_method=DELETE` — the same
 * resource routes the Blade screens submitted to.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  asRecord, assertOk, extractRows, readString, resultGet, resultPost, type PostValue,
} from '@/lib/result/api';
import type { FieldDef, MasterScreenDef } from '@/lib/result/types';
import DataTable, { type TableRow } from './DataTable';
import DynamicForm, { type FormValues } from './DynamicForm';
import PageHeader from './PageHeader';
import { ConfirmDialog, Drawer } from './primitives';
import { toast } from './toast';

/** Convert form values into the bracketed keys Laravel expects. */
export function serializeForm(fields: FieldDef[], values: FormValues): { data: Record<string, PostValue>; hasFile: boolean } {
  const data: Record<string, PostValue> = {};
  let hasFile = false;

  for (const field of fields) {
    const key = field.apiName ?? field.name;
    const value = values[field.name];

    if (field.type === 'multiselect') {
      const list = Array.isArray(value) ? value.map(readString) : [];
      list.forEach((item, index) => { data[`${key.replace(/\[\]$/, '')}[${index}]`] = item; });
      continue;
    }
    if (field.type === 'repeater') {
      const rows = Array.isArray(value) ? (value as Record<string, string>[]) : [];
      rows.forEach((row, rowIndex) => {
        for (const rowField of field.repeater?.fields ?? []) {
          data[`${key}[${rowIndex}][${rowField.name}]`] = readString(row[rowField.name] ?? '');
        }
      });
      continue;
    }
    if (field.type === 'checkbox' || field.type === 'toggle') {
      data[key] = value ? '1' : '0';
      continue;
    }
    if (field.type === 'file' || field.type === 'image') {
      if (value instanceof File) {
        data[key] = value;
        hasFile = true;
      }
      continue;
    }
    data[key] = readString(value ?? '');
  }
  return { data, hasFile };
}

export default function MasterCrud({ screen, embedded = false }: { screen: MasterScreenDef; embedded?: boolean }) {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ mode: 'create' } | { mode: 'edit'; row: TableRow; seed?: FormValues } | null>(null);
  const [deleting, setDeleting] = useState<TableRow | string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
<<<<<<< HEAD
      const payload = await resultGet(screen.api.index);
=======
      // DataTable already paginates client-side; ask Laravel for the full
      // set (per_page=0) so rows past the backend's default page size (25)
      // aren't silently dropped from the list.
      const payload = await resultGet(screen.api.index, { per_page: '0' });
>>>>>>> 8e0f73003448bc4d974b01993286b34ecb08d45d
      setRows(extractRows(payload, screen.listKey));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load records.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [screen.api.index, screen.listKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = async (row: TableRow) => {
    if (!screen.api.show) {
      setDrawer({ mode: 'edit', row });
      return;
    }
    setPrefillLoading(true);
    try {
      const payload = await resultGet(`${screen.api.show}/${readString(row.id)}`);
      const record = asRecord(payload.data ?? payload);
      const seed = (screen.deserialize ? screen.deserialize(record) : record) as FormValues;
      setDrawer({ mode: 'edit', row, seed });
    } catch (err) {
      toast.error(`Could not load ${screen.entityName} details`, err instanceof Error ? err.message : undefined);
    } finally {
      setPrefillLoading(false);
    }
  };

  const handleSubmit = async (values: FormValues) => {
    setBusy(true);
    try {
      const isEdit = drawer?.mode === 'edit';
      let submitValues = values;
      if (!isEdit && screen.slug === 'exam-master') {
        const nextCode = String(
          Math.max(0, ...rows.map((row) => Number(readString(row.Code ?? row.code ?? 0)))) + 1,
        );
        submitValues = { ...values, Code: nextCode };
      }
      const { data, hasFile } = screen.serialize
        ? screen.serialize(screen.fields, submitValues, isEdit)
        : serializeForm(screen.fields, submitValues);
      const id = isEdit ? readString((drawer as { row: TableRow }).row.id) : '';
      const path = isEdit && screen.api.update ? `${screen.api.update}/${id}` : screen.api.store;
      const payload = await resultPost(path, data as Record<string, PostValue>, {
        method: isEdit ? 'PUT' : 'POST',
        multipart: hasFile || screen.multipart,
      });
      const message = assertOk(payload, `Failed to save ${screen.entityName}.`);
      toast.success(
        isEdit ? `${capitalize(screen.entityName)} updated` : `${capitalize(screen.entityName)} created`,
        message || undefined,
      );
      setDrawer(null);
      void load();
    } catch (err) {
      toast.error(`Could not save ${screen.entityName}`, err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting || !screen.api.destroy) return;
    setBusy(true);
    const ids = Array.isArray(deleting) ? deleting : [readString(deleting.id)];
    try {
      for (const id of ids) {
        const payload = await resultPost(`${screen.api.destroy}/${id}`, {}, { method: 'DELETE' });
        assertOk(payload, `Failed to delete ${screen.entityName}.`);
      }
      toast.success(ids.length > 1 ? `${ids.length} records deleted` : `${capitalize(screen.entityName)} deleted`);
      setDeleting(null);
      void load();
    } catch (err) {
      toast.error(`Could not delete ${screen.entityName}`, err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const drawerTitle = drawer?.mode === 'edit' ? `Edit ${screen.entityName}` : `Add ${screen.entityName}`;
  const initialValues = useMemo<FormValues | undefined>(
    () => (drawer?.mode === 'edit' ? (drawer.seed ?? (drawer.row as FormValues)) : undefined),
    [drawer],
  );

  const standardOptions = useMemo(() => {
    if (screen.slug !== 'exam-master') return [];
    const map = new Map<string, { id: string; label: string }>();
    for (const row of rows) {
      const id = readString(row.standard_id ?? '');
      const label = readString(row.std_name ?? row.standard_name ?? '');
      if (id && label) map.set(id, { id, label });
    }
    return Array.from(map.values());
  }, [screen.slug, rows]);

  const formFields = useMemo(() => {
    if (screen.slug !== 'exam-master' || standardOptions.length === 0) return screen.fields;
    return screen.fields.map((field) => {
      if (field.name === 'all_standard') {
        return {
          ...field,
          options: {
            kind: 'static',
            options: standardOptions.map((opt) => ({ value: opt.id, label: opt.label })),
          } as const,
        } as FieldDef;
      }
      return field;
    });
  }, [screen.slug, screen.fields, standardOptions]);

  return (
    <div className={embedded ? '' : 'min-h-screen p-6'}>
      <div className="mx-auto space-y-6">
        {embedded ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{screen.subtitle}</p>
            <Button onClick={() => setDrawer({ mode: 'create' })} className="h-9 rounded-lg bg-blue-600 px-4 text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Add {screen.entityName}
            </Button>
          </div>
        ) : (
          <PageHeader
            icon={screen.icon}
            title={screen.title}
            subtitle={screen.subtitle}
            breadcrumbs={[{ label: 'Result', href: '/result' }, { label: 'Masters', href: '/result' }, { label: screen.title }]}
            actions={
              <Button onClick={() => setDrawer({ mode: 'create' })} className="h-10 rounded-lg bg-blue-600 px-4 text-white hover:bg-blue-700">
                <Plus className="h-4 w-4" />
                Add {screen.entityName}
              </Button>
            }
          />
        )}

        {!embedded && screen.note && <p className="text-sm text-slate-500">{screen.note}</p>}

        <DataTable
          columns={screen.columns}
          rows={rows}
          loading={loading}
          error={error}
          onRetry={load}
          selectable={Boolean(screen.api.destroy)}
          onBulkDelete={(keys) => setDeleting(keys)}
          exportName={screen.slug}
          exportTitle={screen.title}
          emptyTitle={`No ${screen.entityName} records yet`}
          emptyMessage={`Create your first ${screen.entityName} to get started.`}
          renderActions={(row) => (
            <div className="flex items-center justify-end gap-1">
              {screen.api.update && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${screen.entityName}`}
                  onClick={() => void openEdit(row)}
                  disabled={prefillLoading}
                  className="text-slate-400 hover:text-blue-600"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {screen.api.destroy && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${screen.entityName}`}
                  onClick={() => setDeleting(row)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        />
      </div>

      <Drawer
        open={drawer !== null}
        onClose={() => !busy && setDrawer(null)}
        title={drawerTitle}
        description={drawer?.mode === 'edit' ? 'Update the details below and save your changes.' : `Fill in the details to create a new ${screen.entityName}.`}
        wide
      >
        {drawer && (
          <DynamicForm
            fields={formFields}
            sectionOrder={screen.sectionOrder}
            initialValues={initialValues}
            onSubmit={handleSubmit}
            onCancel={() => setDrawer(null)}
            submitLabel={drawer.mode === 'edit' ? 'Save changes' : 'Save'}
            busy={busy}
          />
        )}
      </Drawer>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => !busy && setDeleting(null)}
        onConfirm={handleDelete}
        busy={busy}
        title={Array.isArray(deleting) ? `Delete ${deleting.length} records?` : `Delete ${screen.entityName}?`}
        message={
          Array.isArray(deleting)
            ? `This will permanently remove ${deleting.length} selected records. This action cannot be undone.`
            : `This will permanently remove this ${screen.entityName}. This action cannot be undone.`
        }
      />
    </div>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
