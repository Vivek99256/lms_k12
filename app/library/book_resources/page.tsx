'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FilePenLine, FileText, Loader2, Plus, Printer, Search, Trash2, Upload, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AiFieldAssistant } from '@/components/ai/AiFieldAssistant';
import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  NativeSelect,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  appendSessionFormData,
  appendSessionParams,
  asRecord,
  getFeesSession,
  readString,
  toArray,
} from '@/app/fees/_lib/fees-api';

type MessageState = {
  type: 'success' | 'error' | 'info';
  text: string;
};

type CustomFieldOption = {
  display_text: string;
  display_value: string;
};

type CustomField = {
  id: string;
  field_label: string;
  field_name: string;
  field_type: string;
  field_message: string;
  required: string;
  options: CustomFieldOption[];
};

type MappingType = {
  id: string;
  name: string;
};

type MappedValue = {
  type_id: string;
  type_name: string;
  value_id: string;
  value_name: string;
};

type ResourceRecord = {
  id: string;
  chapter_name: string;
  topic_name: string;
  title: string;
  file_url: string;
  mapped_values: MappedValue[];
  custom_field_values: Record<string, unknown>;
  raw: Record<string, unknown>;
};

type FormValues = {
  title: string;
  custom: Record<string, string | string[]>;
};

type MappingRow = {
  key: string;
  typeId: string;
  valueId: string;
};

const initialFormValues: FormValues = {
  title: '',
  custom: {},
};

function normalizePayload(response: unknown): Record<string, unknown> {
  const root = asRecord(response);
  const nested = asRecord(root.data);

  if (Object.keys(nested).length > 0) {
    return {
      ...root,
      ...nested,
      data: nested.data ?? root.data,
    };
  }

  return root;
}

function readStatus(payload: Record<string, unknown>): number {
  const rawStatus = payload.status ?? payload.status_code;
  return Number(readString(rawStatus)) || 0;
}

function readMessage(payload: Record<string, unknown>, fallback: string) {
  return readString(payload.message) || fallback;
}

function parseCustomFields(payload: Record<string, unknown>): CustomField[] {
  return toArray(payload.custom_fields)
    .map((item) => {
      const record = asRecord(item);
      return {
        id: readString(record.id),
        field_label: readString(record.field_label),
        field_name: readString(record.field_name),
        field_type: readString(record.field_type),
        field_message: readString(record.field_message),
        required: readString(record.required),
        options: toArray(record.options).map((option) => {
          const optionRecord = asRecord(option);
          return {
            display_text: readString(optionRecord.display_text),
            display_value: readString(optionRecord.display_value),
          };
        }),
      };
    })
    .filter((field) => field.id && field.field_name);
}

function parseMappingTypes(payload: Record<string, unknown>): MappingType[] {
  return toArray(payload.mapping_types)
    .map((item) => {
      const record = asRecord(item);
      return {
        id: readString(record.id),
        name: readString(record.name),
      };
    })
    .filter((type) => type.id && type.name);
}

function parseMappingValues(payload: Record<string, unknown>): Record<string, Array<{ id: string; name: string }>> {
  const raw = asRecord(payload.mapping_values);
  const result: Record<string, Array<{ id: string; name: string }>> = {};

  Object.entries(raw).forEach(([typeId, value]) => {
    const values = asRecord(value);
    result[typeId] = Object.entries(values).map(([id, name]) => ({
      id: readString(id),
      name: readString(name),
    }));
  });

  return result;
}

function parseRecords(payload: Record<string, unknown>): ResourceRecord[] {
  return toArray(payload.records)
    .map((item) => {
      const record = asRecord(item);
      return {
        id: readString(record.id),
        chapter_name: readString(record.chapter_name),
        topic_name: readString(record.topic_name),
        title: readString(record.title),
        file_url: readString(record.file_url),
        mapped_values: toArray(record.mapped_values).map((mapped) => {
          const mappedRecord = asRecord(mapped);
          return {
            type_id: readString(mappedRecord.type_id),
            type_name: readString(mappedRecord.type_name),
            value_id: readString(mappedRecord.value_id),
            value_name: readString(mappedRecord.value_name),
          };
        }),
        custom_field_values: asRecord(record.custom_field_values),
        raw: asRecord(record.raw),
      };
    })
    .filter((record) => record.id);
}

function buildDefaultCustomValues(customFields: CustomField[]) {
  return customFields.reduce<Record<string, string | string[]>>((accumulator, field) => {
    accumulator[field.field_name] = field.field_type === 'checkbox' ? [] : '';
    return accumulator;
  }, {});
}

function buildDefaultMappingRows() {
  return [{ key: crypto.randomUUID(), typeId: '', valueId: '' }];
}

function parseStoredCustomValue(field: CustomField, value: unknown): string | string[] {
  const stringValue = readString(value);
  if (field.field_type === 'checkbox') {
    return stringValue ? stringValue.split(',').map((entry) => entry.trim()).filter(Boolean) : [];
  }
  return stringValue;
}

function recordMatchesFilters(
  record: ResourceRecord,
  globalSearch: string,
  columnFilters: Record<string, string>,
  customFields: CustomField[],
) {
  const haystack = [
    record.chapter_name,
    record.topic_name,
    record.title,
    record.mapped_values.map((value) => `${value.type_name} ${value.value_name}`).join(' '),
    ...customFields.map((field) => readString(record.custom_field_values[field.field_name])),
  ]
    .join(' ')
    .toLowerCase();

  if (globalSearch && !haystack.includes(globalSearch.toLowerCase())) {
    return false;
  }

  const staticColumns: Record<string, string> = {
    chapter_name: record.chapter_name,
    topic_name: record.topic_name,
    title: record.title,
    mapped_values: record.mapped_values.map((value) => `${value.type_name} ${value.value_name}`).join(' '),
  };

  for (const [key, filterValue] of Object.entries(columnFilters)) {
    if (!filterValue.trim()) continue;
    const currentValue =
      key in staticColumns
        ? staticColumns[key]
        : readString(record.custom_field_values[key]);
    if (!currentValue.toLowerCase().includes(filterValue.toLowerCase())) {
      return false;
    }
  }

  return true;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value: string) {
  const normalized = value.replace(/"/g, '""');
  return `"${normalized}"`;
}

function buildExportRows(records: ResourceRecord[], customFields: CustomField[]) {
  return records.map((record, index) => ({
    'Sr No': String(index + 1),
    'Chapter Name': record.chapter_name || '-',
    'Topic Name': record.topic_name || '-',
    Title: record.title || '-',
    File: record.file_url || '-',
    'Mapped Values': record.mapped_values.map((value) => `${value.type_name} / ${value.value_name}`).join('; ') || '-',
    ...customFields.reduce<Record<string, string>>((accumulator, field) => {
      accumulator[field.field_label] = readString(record.custom_field_values[field.field_name]) || '-';
      return accumulator;
    }, {}),
  }));
}

function printResourceTable(records: ResourceRecord[], customFields: CustomField[]) {
  const rows = buildExportRows(records, customFields);
  const headers = Object.keys(rows[0] ?? {
    'Sr No': '',
    'Chapter Name': '',
    'Topic Name': '',
    Title: '',
    File: '',
    'Mapped Values': '',
  });
  const html = `
    <html>
      <head>
        <title>Book Resources</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; vertical-align: top; }
          th { background: #f1f5f9; }
        </style>
      </head>
      <body>
        <h2>Book Resources</h2>
        <table>
          <thead>
            <tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `<tr>${headers.map((header) => `<td>${row[header as keyof typeof row] ?? '-'}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=1200,height=900');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function BookResourcesPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [message, setMessage] = useState<MessageState | null>(null);
  const [records, setRecords] = useState<ResourceRecord[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [mappingTypes, setMappingTypes] = useState<MappingType[]>([]);
  const [mappingValues, setMappingValues] = useState<Record<string, Array<{ id: string; name: string }>>>({});
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState('');
  const [formValues, setFormValues] = useState<FormValues>(initialFormValues);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>(buildDefaultMappingRows);
  const [teacherFile, setTeacherFile] = useState<File | null>(null);

  const session = useMemo(() => getFeesSession(), []);
  const selectedParams = useMemo(
    () => ({
      standard_id: searchParams?.get('standard_id') ?? '',
      subject_id: searchParams?.get('subject_id') ?? '',
      chapter_id: searchParams?.get('chapter_id') ?? '',
      topic_id: searchParams?.get('topic_id') ?? '',
      mappedValues: searchParams?.get('mappedValues') ?? '',
    }),
    [searchParams],
  );

  const filteredRecords = useMemo(
    () => records.filter((record) => recordMatchesFilters(record, globalSearch, columnFilters, customFields)),
    [columnFilters, customFields, globalSearch, records],
  );

  const resetForm = (fields: CustomField[]) => {
    setEditingRecordId('');
    setFormValues({
      title: '',
      custom: buildDefaultCustomValues(fields),
    });
    setMappingRows(buildDefaultMappingRows());
    setTeacherFile(null);
  };

  const loadPageData = async () => {
    if (!session.subInstituteId || !session.academicYearId) {
      setLoading(false);
      setMessage({
        type: 'error',
        text: 'Session institute or academic year is missing. Please sign in again.',
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({
        path: 'lms/api/teacher_resource/',
        standard_id: selectedParams.standard_id,
        subject_id: selectedParams.subject_id,
        chapter_id: selectedParams.chapter_id,
        topic_id: selectedParams.topic_id,
        mappedValues: selectedParams.mappedValues,
      });
      appendSessionParams(params, session);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const payload = normalizePayload(await response.json());

      if (!response.ok || readStatus(payload) !== 1) {
        throw new Error(readMessage(payload, 'Unable to load Book Resources.'));
      }

      const nextFields = parseCustomFields(payload);
      setCustomFields(nextFields);
      setMappingTypes(parseMappingTypes(payload));
      setMappingValues(parseMappingValues(payload));
      setRecords(parseRecords(payload));
      if (!drawerOpen) {
        resetForm(nextFields);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to load Book Resources.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadPageData();
    }, 0);

    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedParams.standard_id, selectedParams.subject_id, selectedParams.chapter_id, selectedParams.topic_id, selectedParams.mappedValues]);

  useEffect(() => {
    if (drawerOpen) {
      const frame = window.requestAnimationFrame(() => setDrawerVisible(true));
      document.body.style.overflow = 'hidden';
      return () => window.cancelAnimationFrame(frame);
    }

    document.body.style.overflow = '';
    const timeout = window.setTimeout(() => setDrawerVisible(false), 250);
    return () => window.clearTimeout(timeout);
  }, [drawerOpen]);

  const openCreateDrawer = () => {
    resetForm(customFields);
    setDrawerOpen(true);
  };

  const openEditDrawer = (record: ResourceRecord) => {
    const nextCustom = buildDefaultCustomValues(customFields);
    customFields.forEach((field) => {
      nextCustom[field.field_name] = parseStoredCustomValue(field, record.raw[field.field_name]);
    });

    const mappedRows = record.mapped_values.length > 0
      ? record.mapped_values.map((value) => ({
        key: crypto.randomUUID(),
        typeId: value.type_id,
        valueId: value.value_id,
      }))
      : buildDefaultMappingRows();

    setEditingRecordId(record.id);
    setFormValues({
      title: record.title,
      custom: nextCustom,
    });
    setMappingRows(mappedRows);
    setTeacherFile(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (submitting) return;
    setDrawerOpen(false);
    resetForm(customFields);
  };

  const updateCustomValue = (fieldName: string, value: string | string[]) => {
    setFormValues((current) => ({
      ...current,
      custom: {
        ...current.custom,
        [fieldName]: value,
      },
    }));
  };

  const updateMappingRow = (key: string, patch: Partial<MappingRow>) => {
    setMappingRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const nextRow = { ...row, ...patch };
        if (patch.typeId !== undefined) {
          nextRow.valueId = '';
        }
        return nextRow;
      }),
    );
  };

  const addMappingRow = () => {
    setMappingRows((current) => [...current, { key: crypto.randomUUID(), typeId: '', valueId: '' }]);
  };

  const removeMappingRow = (key: string) => {
    setMappingRows((current) => {
      if (current.length === 1) {
        return [{ key: crypto.randomUUID(), typeId: '', valueId: '' }];
      }
      return current.filter((row) => row.key !== key);
    });
  };

  const appendContextFields = (formData: FormData) => {
    formData.set('standard_id', selectedParams.standard_id);
    formData.set('subject_id', selectedParams.subject_id);
    formData.set('chapter_id', selectedParams.chapter_id);
    formData.set('topic_id', selectedParams.topic_id);
    formData.set('hid_standard_id', selectedParams.standard_id);
    formData.set('hid_subject_id', selectedParams.subject_id);
    formData.set('hid_chapter_id', selectedParams.chapter_id);
    formData.set('hid_topic_id', selectedParams.topic_id);
  };

  const validateForm = () => {
    if (!formValues.title.trim()) {
      setMessage({ type: 'info', text: 'Title is required.' });
      return false;
    }

    if (!editingRecordId && !teacherFile) {
      setMessage({ type: 'info', text: 'Resource file is required for new records.' });
      return false;
    }

    for (const field of customFields) {
      if (field.required !== '1') continue;
      const value = formValues.custom[field.field_name];
      if (Array.isArray(value) && value.length === 0) {
        setMessage({ type: 'info', text: `${field.field_label} is required.` });
        return false;
      }
      if (!Array.isArray(value) && !String(value ?? '').trim()) {
        setMessage({ type: 'info', text: `${field.field_label} is required.` });
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const params = new URLSearchParams({
        path: editingRecordId
          ? `lms/api/teacher_resource/update/${editingRecordId}`
          : 'lms/api/teacher_resource/store',
      });

      const formData = new FormData();
      appendSessionFormData(formData, session);
      appendContextFields(formData);
      formData.set('title', formValues.title.trim());

      if (teacherFile) {
        formData.set('teacher_file', teacherFile);
      }

      mappingRows.forEach((row) => {
        if (!row.typeId || !row.valueId) return;
        formData.append('mapping_type[]', row.typeId);
        formData.append('mapping_value[]', row.valueId);
      });

      customFields.forEach((field) => {
        const value = formValues.custom[field.field_name];
        if (Array.isArray(value)) {
          value.forEach((entry) => formData.append(`${field.field_name}[]`, entry));
        } else if (value) {
          formData.set(field.field_name, value);
        }
      });

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        body: formData,
      });
      const payload = normalizePayload(await response.json());

      if (!response.ok || readStatus(payload) !== 1) {
        throw new Error(readMessage(payload, editingRecordId ? 'Unable to update Book Resource.' : 'Unable to create Book Resource.'));
      }

      setMessage({
        type: 'success',
        text: readMessage(payload, editingRecordId ? 'Book Resource updated successfully.' : 'Book Resource created successfully.'),
      });
      closeDrawer();
      await loadPageData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to save Book Resource.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: ResourceRecord) => {
    if (!window.confirm(`Delete "${record.title}"?`)) {
      return;
    }

    setDeletingId(record.id);
    setMessage(null);

    try {
      const params = new URLSearchParams({
        path: `lms/api/teacher_resource/delete/${record.id}`,
      });

      const formData = new FormData();
      appendSessionFormData(formData, session);
      appendContextFields(formData);

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'POST',
        body: formData,
      });
      const payload = normalizePayload(await response.json());

      if (!response.ok || readStatus(payload) !== 1) {
        throw new Error(readMessage(payload, 'Unable to delete Book Resource.'));
      }

      setMessage({
        type: 'success',
        text: readMessage(payload, 'Book Resource deleted successfully.'),
      });
      await loadPageData();
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to delete Book Resource.',
      });
    } finally {
      setDeletingId('');
    }
  };

  const exportRows = useMemo(() => buildExportRows(filteredRecords, customFields), [customFields, filteredRecords]);

  return (
    <>
      <PageFrame>
        <PageHeader
          title="Book Resources"
          description="Chapter-scoped teacher resource upload and management, matching the legacy LMS teacher resource workflow while preserving the existing Next.js architecture."
          action={(
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => {
                if (exportRows.length === 0) return;
                const headers = Object.keys(exportRows[0]);
                const csv = [headers.join(','), ...exportRows.map((row) => headers.map((header) => escapeCsv(row[header as keyof typeof row] ?? '')).join(','))].join('\n');
                downloadFile('book-resources.csv', csv, 'text/csv;charset=utf-8;');
              }}>
                <Download className="h-4 w-4" />
                CSV
              </Button>
              <Button type="button" variant="outline" onClick={() => {
                if (exportRows.length === 0) return;
                const headers = Object.keys(exportRows[0]);
                const lines = [headers.join('\t'), ...exportRows.map((row) => headers.map((header) => String(row[header as keyof typeof row] ?? '')).join('\t'))];
                downloadFile('book-resources.xls', lines.join('\n'), 'application/vnd.ms-excel');
              }}>
                <FileText className="h-4 w-4" />
                Excel
              </Button>
              <Button type="button" variant="outline" onClick={() => printResourceTable(filteredRecords, customFields)}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button type="button" onClick={openCreateDrawer}>
                <Plus className="h-4 w-4" />
                Add Resource
              </Button>
            </div>
          )}
        />

        {message && <InlineMessage type={message.type} text={message.text} />}

        <SectionPanel
          title="Module Context"
          description="Laravel scopes this module by the current chapter context and keeps chapter, subject, standard, and optional topic in hidden fields."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Field label="Standard">
              <Input value={selectedParams.standard_id || '-'} readOnly />
            </Field>
            <Field label="Subject">
              <Input value={selectedParams.subject_id || '-'} readOnly />
            </Field>
            <Field label="Chapter">
              <Input value={selectedParams.chapter_id || '-'} readOnly />
            </Field>
            <Field label="Topic">
              <Input value={selectedParams.topic_id || '-'} readOnly />
            </Field>
            <Field label="Mapped Values Filter">
              <Input value={selectedParams.mappedValues || '-'} readOnly />
            </Field>
          </div>
        </SectionPanel>

        <SectionPanel
          title="Resources"
          description="Search, export, edit, and delete teacher resources for the selected chapter context."
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Global Search">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={globalSearch}
                    onChange={(event) => setGlobalSearch(event.target.value)}
                    className="pl-9"
                    placeholder="Search all columns"
                  />
                </div>
              </Field>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100">
                    <TableHead>Sr No</TableHead>
                    <TableHead>Chapter Name</TableHead>
                    <TableHead>Topic Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Mapped Values</TableHead>
                    {customFields.map((field) => (
                      <TableHead key={field.field_name}>{field.field_label}</TableHead>
                    ))}
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                  <TableRow className="bg-white hover:bg-white">
                    <TableHead />
                    {['chapter_name', 'topic_name', 'title', 'file_url', 'mapped_values', ...customFields.map((field) => field.field_name)].map((key) => (
                      <TableHead key={key}>
                        <Input
                          value={columnFilters[key] ?? ''}
                          onChange={(event) => setColumnFilters((current) => ({ ...current, [key]: event.target.value }))}
                          placeholder="Filter"
                        />
                      </TableHead>
                    ))}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <LoadingRows colSpan={7 + customFields.length} label="Loading book resources" />
                  ) : filteredRecords.length > 0 ? (
                    filteredRecords.map((record, index) => (
                      <TableRow key={record.id} className="odd:bg-white even:bg-slate-50/60">
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{record.chapter_name || '-'}</TableCell>
                        <TableCell>{record.topic_name || '-'}</TableCell>
                        <TableCell className="font-medium text-slate-950">{record.title || '-'}</TableCell>
                        <TableCell>
                          {record.file_url ? (
                            <a href={record.file_url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                              View
                            </a>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {record.mapped_values.length > 0 ? (
                            <ul className="space-y-1 text-xs text-slate-700">
                              {record.mapped_values.map((value, mappedIndex) => (
                                <li key={`${record.id}-${value.type_id}-${value.value_id}`}>
                                  {mappedIndex + 1}. {value.type_name} / {value.value_name}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        {customFields.map((field) => (
                          <TableCell key={`${record.id}-${field.field_name}`}>
                            {readString(record.custom_field_values[field.field_name]) || '-'}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" size="icon-sm" onClick={() => openEditDrawer(record)}>
                              <FilePenLine className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              onClick={() => void handleDelete(record)}
                              disabled={deletingId === record.id}
                            >
                              {deletingId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <EmptyTableRow colSpan={7 + customFields.length} label="No book resources match the current filters." />
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </SectionPanel>
      </PageFrame>

      {drawerVisible ? (
        <div className="fixed inset-0 z-[70] overflow-hidden">
          <button
            type="button"
            aria-label="Close book resource drawer"
            className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeDrawer}
          />
          <div className="absolute inset-y-0 right-0 flex max-w-full">
            <div className={`flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-300 sm:w-[34rem] lg:w-[40rem] ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-950">{editingRecordId ? 'Edit Book Resource' : 'Add Book Resource'}</h2>
                <Button type="button" variant="ghost" size="icon-sm" onClick={closeDrawer}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="space-y-5">
                  <SectionPanel title="Core Fields">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Title">
                        <Input value={formValues.title} onChange={(event) => setFormValues((current) => ({ ...current, title: event.target.value }))} />
                      </Field>
                      <Field label="Resource">
                        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                          <Upload className="h-4 w-4" />
                          <span className="truncate">{teacherFile?.name || (editingRecordId ? 'Choose new file (optional)' : 'Choose file')}</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(event) => setTeacherFile(event.target.files?.[0] ?? null)}
                          />
                        </label>
                      </Field>
                    </div>
                  </SectionPanel>

                  <SectionPanel title="Mapping">
                    <div className="space-y-4">
                      {mappingRows.map((row) => (
                        <div key={row.key} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
                          <Field label="Mapping Type">
                            <NativeSelect value={row.typeId} onChange={(value) => updateMappingRow(row.key, { typeId: value })}>
                              <option value="">Select Mapping Type</option>
                              {mappingTypes.map((type) => (
                                <option key={type.id} value={type.id}>
                                  {type.name}
                                </option>
                              ))}
                            </NativeSelect>
                          </Field>
                          <Field label="Mapping Value">
                            <NativeSelect value={row.valueId} onChange={(value) => updateMappingRow(row.key, { valueId: value })}>
                              <option value="">Select Mapping Value</option>
                              {(mappingValues[row.typeId] ?? []).map((value) => (
                                <option key={value.id} value={value.id}>
                                  {value.name}
                                </option>
                              ))}
                            </NativeSelect>
                          </Field>
                          <div className="flex items-end">
                            <Button type="button" variant="outline" onClick={() => removeMappingRow(row.key)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={addMappingRow}>
                        <Plus className="h-4 w-4" />
                        Add Mapping
                      </Button>
                    </div>
                  </SectionPanel>

                  {customFields.length > 0 ? (
                    <SectionPanel title="Custom Fields">
                      <div className="grid gap-4 md:grid-cols-2">
                        {customFields.map((field) => {
                          const value = formValues.custom[field.field_name];
                          if (field.field_type === 'textarea') {
                            return (
                              <Field key={field.field_name} label={field.field_label}>
                                <div className="mb-1 flex justify-end">
                                  <AiFieldAssistant
                                    value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                                    onApply={(next) => updateCustomValue(field.field_name, next)}
                                    fieldType="description"
                                    label={field.field_label}
                                    module="library"
                                    page="Book resources"
                                    entityType="book_resource"
                                  />
                                </div>
                                <textarea
                                  value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                                  onChange={(event) => updateCustomValue(field.field_name, event.target.value)}
                                  placeholder={field.field_message}
                                  className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-blue-500/20"
                                />
                              </Field>
                            );
                          }

                          if (field.field_type === 'dropdown') {
                            return (
                              <Field key={field.field_name} label={field.field_label}>
                                <NativeSelect value={Array.isArray(value) ? '' : String(value ?? '')} onChange={(nextValue) => updateCustomValue(field.field_name, nextValue)}>
                                  <option value="">Select {field.field_label}</option>
                                  {field.options.map((option) => (
                                    <option key={`${field.field_name}-${option.display_value}`} value={option.display_value}>
                                      {option.display_text}
                                    </option>
                                  ))}
                                </NativeSelect>
                              </Field>
                            );
                          }

                          if (field.field_type === 'checkbox') {
                            const selectedValues = Array.isArray(value) ? value : [];
                            return (
                              <Field key={field.field_name} label={field.field_label}>
                                <div className="rounded-lg border border-slate-200 p-3">
                                  <div className="space-y-2">
                                    {field.options.map((option) => (
                                      <label key={`${field.field_name}-${option.display_value}`} className="flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={selectedValues.includes(option.display_value)}
                                          onChange={(event) => {
                                            const nextValues = event.target.checked
                                              ? [...selectedValues, option.display_value]
                                              : selectedValues.filter((entry) => entry !== option.display_value);
                                            updateCustomValue(field.field_name, nextValues);
                                          }}
                                        />
                                        <span>{option.display_text}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </Field>
                            );
                          }

                          if (field.field_type === 'file') {
                            return (
                              <Field key={field.field_name} label={field.field_label}>
                                <Input type="file" disabled />
                              </Field>
                            );
                          }

                          return (
                            <Field key={field.field_name} label={field.field_label}>
                              <Input
                                type={field.field_type === 'date' ? 'date' : field.field_type || 'text'}
                                value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
                                onChange={(event) => updateCustomValue(field.field_name, event.target.value)}
                                placeholder={field.field_message}
                              />
                            </Field>
                          );
                        })}
                      </div>
                    </SectionPanel>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-4">
                <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingRecordId ? 'Update Resource' : 'Save Resource'}
                </Button>
                <Button type="button" variant="outline" onClick={closeDrawer} disabled={submitting}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
