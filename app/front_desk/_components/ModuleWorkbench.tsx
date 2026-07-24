'use client';

import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { CalendarDays, LoaderCircle, Printer, RefreshCw, Search } from 'lucide-react';
import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type { SearchDropdownValues } from '@/components/search-dropdown/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PageHeader from '@/components/result/PageHeader';
import { toast } from '@/components/result/toast';
import { loadModuleRows, saveModuleRecord, type JsonRecord } from '../_lib/api';
import type { FrontDeskModule, ModuleField } from '../_lib/modules';

const emptyClassValues: SearchDropdownValues = {
  section: '',
  standard: '',
  division: '',
  subject: '',
};

function scalar(value: SearchDropdownValues[keyof SearchDropdownValues]) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function displayValue(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function ModuleWorkbench({ module }: { module: FrontDeskModule }) {
  const [rows, setRows] = useState<JsonRecord[]>([]);
  const [classValues, setClassValues] = useState(emptyClassValues);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(module.report ? fieldValues : {})) {
      if (typeof value === 'string' && value) params[key] = value;
    }
    const sections = scalar(classValues.section);
    const standards = scalar(classValues.standard);
    const divisions = scalar(classValues.division);
    if (sections.length) params.academic_section_id = sections[0];
    if (standards.length) params.standard_id = standards[0];
    if (divisions.length) params.division_id = divisions[0];
    return params;
  }, [classValues, fieldValues, module.report]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadModuleRows(module.endpoint, query, module.method);
      setRows(result.rows);
      setSearched(true);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Unable to load records.';
      setError(message);
      setRows([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [module.endpoint, module.method, query]);

  function addClassValues(form: FormData) {
    const mapping = {
      section: 'grade',
      standard: 'standard',
      division: 'division',
    } as const;
    for (const key of module.classFields ?? []) {
      for (const id of scalar(classValues[key])) {
        form.append(`${mapping[key]}[]`, id);
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!module.storeEndpoint) return;
    setSaving(true);
    setError('');
    try {
      const form = new FormData(event.currentTarget);
      addClassValues(form);
      const schoolDate = form.get('school_date');
      if (typeof schoolDate === 'string' && schoolDate) {
        form.set('school_date', String(Date.parse(`${schoolDate}T00:00:00`)));
      }
      await saveModuleRecord(module.storeEndpoint, form);
      toast.success(`${module.title} saved`);
      event.currentTarget.reset();
      setFieldValues({});
      await load();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : 'Unable to save the record.';
      setError(message);
      toast.error('Save failed', message);
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: ModuleField) {
    if (
      field.visibleWhen &&
      fieldValues[field.visibleWhen.field] !== field.visibleWhen.value
    ) {
      return null;
    }
    const id = `${module.title}-${field.name}`.replaceAll(' ', '-');
    const common = {
      id,
      name: field.name,
      required: field.required,
      onChange: (
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
      ) =>
        setFieldValues((current) => ({
          ...current,
          [field.name]:
            event.target instanceof HTMLInputElement && event.target.type === 'checkbox'
              ? event.target.checked
              : event.target.value,
        })),
    };
    return (
      <div key={field.name} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
          {field.label}
          {field.required ? <span className="ml-1 text-rose-600">*</span> : null}
        </label>
        {field.type === 'textarea' ? (
          <Textarea {...common} rows={3} />
        ) : field.type === 'select' ? (
          <select {...common} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">Select {field.label.toLowerCase()}</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : field.type === 'checkbox' ? (
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3">
            <input {...common} type="checkbox" value="1" />
            <span className="text-sm text-slate-700">{field.label}</span>
          </label>
        ) : (
          <Input
            {...common}
            type={field.type}
            multiple={field.multiple}
            accept={field.accept}
          />
        )}
      </div>
    );
  }

  const filterFields = module.report ? module.filters : undefined;

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <PageHeader
          icon={CalendarDays}
          title={module.title}
          subtitle={module.description}
          breadcrumbs={[
            { label: 'Front desk', href: '/dashboard' },
            { label: module.title },
          ]}
          actions={
            <>
              {!module.report ? (
                <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
                  <RefreshCw className="h-4 w-4" /> Refresh
                </Button>
              ) : null}
              {module.supportsPrint ? (
              <Button type="button" variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              ) : null}
            </>
          }
        />

        {(module.fields?.length || module.classFields?.length || filterFields?.length) ? (
          <form onSubmit={module.report ? (event) => { event.preventDefault(); void load(); } : submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            {module.classFields?.length ? (
              <SearchDropdown
                fields={module.classFields}
                values={classValues}
                multiple={
                  module.multipleClassFields
                    ? Object.fromEntries(module.classFields.map((field) => [field, true]))
                    : {}
                }
                required={Object.fromEntries(module.classFields.map((field) => [field, true]))}
                onChange={(values) => setClassValues(values)}
              />
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {(filterFields ?? module.fields ?? []).map(renderField)}
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="submit" disabled={saving || loading}>
                {saving || loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : module.report ? <Search className="h-4 w-4" /> : null}
                {module.report ? 'Search' : module.submitLabel ?? 'Save changes'}
              </Button>
            </div>
          </form>
        ) : null}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {error ? (
            <div role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">No.</TableHead>
                  {module.columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={module.columns.length + 1} className="h-32 text-center text-slate-500"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />Loading records</TableCell></TableRow>
                ) : rows.length ? rows.map((row, index) => (
                  <TableRow key={String(row.id ?? index)}>
                    <TableCell>{index + 1}</TableCell>
                    {module.columns.map((column) => <TableCell key={column.key}>{displayValue(row[column.key])}</TableCell>)}
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={module.columns.length + 1} className="h-32 text-center text-slate-500">{searched ? 'No records match the current selection.' : 'Choose filters and search to load records.'}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </main>
  );
}
