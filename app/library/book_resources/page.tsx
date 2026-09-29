'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, FileDown, FilePenLine, FileText, Loader2, Plus, Printer, Trash2, Upload, X } from 'lucide-react';

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
import {
  downloadFile,
  escapeCsv,
  exportRowsToPdf,
  MessageState,
  normalizePayload,
  readMessage,
  readStatus,
} from '@/app/library/_lib/library-module-utils';

// ---------------------------------------------------------------------------
// This page is wired directly to Laravel's real Library "Books" catalogue
// (App\Http\Controllers\library\BookController, `books.*` routes) -- it
// previously called an unrelated LMS "teacher resource" endpoint. See the
// route/field mapping below; every field name matches BookController::store()
// and books.blade.php exactly, since Laravel is the source of truth.
//
// Deliberately NOT included, and reported as backend gaps rather than
// invented: the Issue/Return circulation modal and the per-book "Items"
// modal both exist in the legacy app only as server-rendered HTML fragments
// (BookController::show/returnBook/issueBook/item all return
// `{data: "<html>...</html>"}`, not structured JSON) -- there is no clean
// JSON contract to build against without either scraping that HTML or a
// backend change, and both are out of scope for a frontend-only pass.
// ---------------------------------------------------------------------------

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

type FilterOption = { id: string; label: string };

type BookRow = {
  id: string;
  imageUrl: string;
  itemCodes: string;
  title: string;
  subject: string;
  subTitle: string;
  publisherName: string;
  publishYear: string;
  authorName: string;
};

type FormValues = {
  title: string;
  sub_title: string;
  material_resource_type: string;
  edition: string;
  tags: string;
  no_of_items: string;
  item_code_value: string;
  author_name: string;
  isbn_issn: string;
  classification: string;
  publisher_name: string;
  publish_year: string;
  publish_place: string;
  pages: string;
  series_title: string;
  call_number: string;
  language: string;
  source: string;
  subject: string;
  price: string;
  price_currency: string;
  notes: string;
  review: string;
  bill_no: string;
  bill_date: string;
  custom: Record<string, string | string[]>;
};

const MATERIAL_RESOURCE_TYPES = [
  { value: 'book', label: 'Book' },
  { value: 'magazine', label: 'Magazine' },
  { value: 'reference', label: 'Reference' },
  { value: 'comic', label: 'Comic' },
  { value: 'class_book', label: 'Class book' },
  { value: 'newspaper', label: 'Newspaper' },
  { value: 'other', label: 'Other' },
];

const BOOK_STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'issued', label: 'Issued Books' },
  { value: 'due', label: 'Due Books' },
  { value: 'overdue', label: 'Over Due' },
];

// The 10 columns BookController::index()'s DataTables branch declares, in
// order -- must match exactly for Yajra's server-side processing to resolve
// each column's searchable/orderable behaviour correctly.
const LIST_COLUMNS = [
  { data: 'id', searchable: false, orderable: true },
  { data: 'image', searchable: false, orderable: false },
  { data: 'item_codes', searchable: false, orderable: true },
  { data: 'title', searchable: true, orderable: true },
  { data: 'subject', searchable: true, orderable: true },
  { data: 'sub_title', searchable: true, orderable: true },
  { data: 'publisher_name', searchable: true, orderable: true },
  { data: 'publish_year', searchable: true, orderable: true },
  { data: 'author_name', searchable: true, orderable: true },
  { data: 'action', searchable: false, orderable: false },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

type ListFilters = {
  searchItem: string;
  bookStatus: string;
  subject: string;
  publisherName: string;
  authorName: string;
  classificationNo: string;
  isbnIssn: string;
};

const initialFilters: ListFilters = {
  searchItem: '',
  bookStatus: '',
  subject: '',
  publisherName: '',
  authorName: '',
  classificationNo: '',
  isbnIssn: '',
};

const initialFormValues: FormValues = {
  title: '',
  sub_title: '',
  material_resource_type: '',
  edition: '',
  tags: '',
  no_of_items: '1',
  item_code_value: '',
  author_name: '',
  isbn_issn: '',
  classification: '',
  publisher_name: '',
  publish_year: '',
  publish_place: '',
  pages: '',
  series_title: '',
  call_number: '',
  language: '',
  source: '',
  subject: '',
  price: '',
  price_currency: '',
  notes: '',
  review: '',
  bill_no: '',
  bill_date: '',
  custom: {},
};

function extractImageSrc(html: string): string {
  const match = /src="([^"]+)"/.exec(html);
  return match ? match[1] : '';
}

function buildListParams(page: number, pageSize: number, filters: ListFilters): URLSearchParams {
  const params = new URLSearchParams();
  params.set('draw', String(page));
  params.set('start', String((page - 1) * pageSize));
  params.set('length', String(pageSize));
  params.set('search[value]', '');
  params.set('search[regex]', 'false');

  LIST_COLUMNS.forEach((column, index) => {
    params.set(`columns[${index}][data]`, column.data);
    params.set(`columns[${index}][name]`, column.data);
    params.set(`columns[${index}][searchable]`, String(column.searchable));
    params.set(`columns[${index}][orderable]`, String(column.orderable));
    params.set(`columns[${index}][search][value]`, '');
    params.set(`columns[${index}][search][regex]`, 'false');
  });

  if (filters.searchItem.trim()) params.set('search_item', filters.searchItem.trim());
  if (filters.bookStatus) params.set('book_status', filters.bookStatus);
  if (filters.subject) params.set('subject', filters.subject);
  if (filters.publisherName) params.set('publisher_name', filters.publisherName);
  if (filters.authorName) params.set('author_name', filters.authorName);
  if (filters.classificationNo.trim()) params.set('classification_no', filters.classificationNo.trim());
  if (filters.isbnIssn.trim()) params.set('isbn_issn', filters.isbnIssn.trim());

  return params;
}

function parseListPayload(payload: Record<string, unknown>): { rows: BookRow[]; recordsFiltered: number } {
  const rows = toArray(payload.data).map((item) => {
    const record = asRecord(item);
    return {
      id: readString(record.id),
      imageUrl: extractImageSrc(readString(record.image)),
      itemCodes: readString(record.item_codes),
      title: readString(record.title),
      subject: readString(record.subject),
      subTitle: readString(record.sub_title),
      publisherName: readString(record.publisher_name),
      publishYear: readString(record.publish_year),
      authorName: readString(record.author_name),
    };
  });

  return {
    rows,
    recordsFiltered: Number(readString(payload.recordsFiltered)) || rows.length,
  };
}

function parseFilterOptions(payload: Record<string, unknown>, key: string, valueField: string): FilterOption[] {
  return toArray(payload[key])
    .map((item, index) => {
      const record = asRecord(item);
      const label = readString(record[valueField]);
      return { id: label || `${index}`, label };
    })
    .filter((option) => option.label);
}

function parseStatusOptions(payload: Record<string, unknown>): FilterOption[] {
  return Object.entries(asRecord(payload.statusTypes)).map(([id, label]) => ({ id, label: readString(label) }));
}

function parseCustomFields(payload: Record<string, unknown>): CustomField[] {
  return toArray(payload.data)
    .map((item) => asRecord(item))
    .filter((record) => readString(record.table_name) === 'library_books' && readString(record.user_type) === '')
    .sort((a, b) => Number(readString(a.sort_order)) - Number(readString(b.sort_order)))
    .map((record) => ({
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
    }))
    .filter((field) => field.id && field.field_name);
}

function buildDefaultCustomValues(customFields: CustomField[]) {
  return customFields.reduce<Record<string, string | string[]>>((accumulator, field) => {
    accumulator[field.field_name] = field.field_type === 'checkbox' ? [] : '';
    return accumulator;
  }, {});
}

function parseStoredCustomValue(field: CustomField, value: unknown): string | string[] {
  const stringValue = readString(value);
  if (field.field_type === 'checkbox') {
    return stringValue ? stringValue.split(',').map((entry) => entry.trim()).filter(Boolean) : [];
  }
  return stringValue;
}

function buildExportRows(rows: BookRow[]): Record<string, string>[] {
  return rows.map((row, index) => ({
    'Sr No': String(index + 1),
    'Item Code': row.itemCodes || '-',
    Title: row.title || '-',
    Subject: row.subject || '-',
    'Sub Title': row.subTitle || '-',
    'Publisher Name': row.publisherName || '-',
    'Publish Year': row.publishYear || '-',
    'Author Name': row.authorName || '-',
  }));
}

function printRows(rows: BookRow[]) {
  const exportRows = buildExportRows(rows);
  const headers = Object.keys(exportRows[0] ?? {});
  const html = `<html><head><title>Book Resources</title><style>
  body { font-family: Arial, sans-serif; padding: 24px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; font-size: 12px; }
  th { background: #f1f5f9; }
  </style></head><body><h2>Book Resources</h2><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${exportRows.map((row) => `<tr>${headers.map((header) => `<td>${row[header] || '-'}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  const printWindow = window.open('', '_blank', 'width=1400,height=900');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function BookResourcesPage() {
  const session = useMemo(() => getFeesSession(), []);
  const isMmisInstitute = session.subInstituteId === '47';

  const [loading, setLoading] = useState(true);
  const [loadingFormConfig, setLoadingFormConfig] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<MessageState | null>(null);

  const [rows, setRows] = useState<BookRow[]>([]);
  const [recordsFiltered, setRecordsFiltered] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [filters, setFilters] = useState<ListFilters>(initialFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [subjectOptions, setSubjectOptions] = useState<FilterOption[]>([]);
  const [publisherOptions, setPublisherOptions] = useState<FilterOption[]>([]);
  const [authorOptions, setAuthorOptions] = useState<FilterOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<FilterOption[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editingItemCodes, setEditingItemCodes] = useState('');
  const [editingItemStatus, setEditingItemStatus] = useState('');
  const [formValues, setFormValues] = useState<FormValues>(initialFormValues);
  const [bookImage, setBookImage] = useState<File | null>(null);
  const [bookFileAtt, setBookFileAtt] = useState<File | null>(null);
  const [titleWarning, setTitleWarning] = useState('');

  const totalPages = Math.max(1, Math.ceil(recordsFiltered / pageSize));
  const exportRows = useMemo(() => buildExportRows(rows), [rows]);

  const loadFormConfig = async () => {
    setLoadingFormConfig(true);
    try {
      const [reportParams, remarksParams, fieldsParams] = [
        new URLSearchParams({ path: 'library_report' }),
        new URLSearchParams({ path: 'scan_books_remarks' }),
        new URLSearchParams({ path: 'fields-configuration' }),
      ];
      [reportParams, remarksParams, fieldsParams].forEach((params) => appendSessionParams(params, session));

      const [reportRes, remarksRes, fieldsRes] = await Promise.all([
        fetch(`/api/proxy?${reportParams.toString()}`, { headers: { Accept: 'application/json' } }),
        fetch(`/api/proxy?${remarksParams.toString()}`, { headers: { Accept: 'application/json' } }),
        fetch(`/api/proxy?${fieldsParams.toString()}`, { headers: { Accept: 'application/json' } }),
      ]);

      const [reportPayload, remarksPayload, fieldsPayload] = await Promise.all([
        normalizePayload(await reportRes.json()),
        normalizePayload(await remarksRes.json()),
        normalizePayload(await fieldsRes.json()),
      ]);

      setSubjectOptions(parseFilterOptions(reportPayload, 'get_subject', 'subject'));
      setPublisherOptions(parseFilterOptions(reportPayload, 'get_publisher_name', 'publisher_name'));
      setAuthorOptions(parseFilterOptions(reportPayload, 'get_author_name', 'author_name'));
      setStatusOptions(parseStatusOptions(remarksPayload));
      setCustomFields(parseCustomFields(fieldsPayload));
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load form configuration.' });
    } finally {
      setLoadingFormConfig(false);
    }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const params = buildListParams(page, pageSize, filters);
      appendSessionParams(params, session);
      const response = await fetch(`/api/library/books-list?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      const payload = normalizePayload(await response.json());
      const { rows: nextRows, recordsFiltered: nextFiltered } = parseListPayload(payload);
      setRows(nextRows);
      setRecordsFiltered(nextFiltered);
      setSelectedIds([]);
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load Book Resources.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      await loadFormConfig();
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadList();
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters]);

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

  const updateFilter = (patch: Partial<ListFilters>) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  };

  const resetForm = () => {
    setEditingId('');
    setEditingItemCodes('');
    setEditingItemStatus('');
    setFormValues({ ...initialFormValues, custom: buildDefaultCustomValues(customFields) });
    setBookImage(null);
    setBookFileAtt(null);
    setTitleWarning('');
  };

  const openCreateDrawer = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEditDrawer = async (row: BookRow) => {
    setMessage(null);
    try {
      const params = new URLSearchParams({ path: `books/${row.id}/edit` });
      appendSessionParams(params, session);
      const response = await fetch(`/api/proxy?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const payload = normalizePayload(await response.json());
      const detail = asRecord(toArray(payload.data)[0]);

      if (!detail.id) {
        throw new Error('Unable to load this book for editing.');
      }

      const nextCustom = buildDefaultCustomValues(customFields);
      customFields.forEach((field) => {
        nextCustom[field.field_name] = parseStoredCustomValue(field, detail[field.field_name]);
      });

      setEditingId(readString(detail.id));
      setEditingItemCodes(readString(detail.item_codes));
      setEditingItemStatus(readString(detail.item_status));
      setFormValues({
        title: readString(detail.title),
        sub_title: readString(detail.sub_title),
        material_resource_type: readString(detail.material_resource_type),
        edition: readString(detail.edition),
        tags: readString(detail.tags),
        no_of_items: readString(detail.no_of_items) || '0',
        item_code_value: '',
        author_name: readString(detail.author_name),
        isbn_issn: readString(detail.isbn_issn),
        classification: readString(detail.classification),
        publisher_name: readString(detail.publisher_name),
        publish_year: readString(detail.publish_year),
        publish_place: readString(detail.publish_place),
        pages: readString(detail.pages),
        series_title: readString(detail.series_title),
        call_number: readString(detail.call_number),
        language: readString(detail.language),
        source: readString(detail.source),
        subject: readString(detail.subject),
        price: readString(detail.price),
        price_currency: readString(detail.price_currency),
        notes: readString(detail.notes),
        review: readString(detail.review),
        bill_no: readString(detail.bill_no),
        bill_date: readString(detail.bill_date),
        custom: nextCustom,
      });
      setBookImage(null);
      setBookFileAtt(null);
      setTitleWarning('');
      setDrawerOpen(true);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load this book for editing.' });
    }
  };

  const closeDrawer = () => {
    if (submitting) return;
    setDrawerOpen(false);
    resetForm();
  };

  const updateField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const updateCustomValue = (fieldName: string, value: string | string[]) => {
    setFormValues((current) => ({ ...current, custom: { ...current.custom, [fieldName]: value } }));
  };

  const handleTitleBlur = async () => {
    const title = formValues.title.trim();
    if (!title) {
      setTitleWarning('');
      return;
    }
    try {
      const body = new URLSearchParams();
      appendSessionParams(body, session);
      body.set('title', title);
      const response = await fetch(`/api/proxy?${new URLSearchParams({ path: 'books/check-title' }).toString()}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
      });
      const payload = normalizePayload(await response.json());
      const exists = Boolean(payload.exists);
      // A duplicate title only matters for a new book -- when editing, the
      // book being edited legitimately matches its own title.
      setTitleWarning(exists && !editingId ? 'A book with this title already exists for this institute.' : '');
    } catch {
      // Non-blocking: this is a proactive UX check, not the source of truth
      // (BookController::store() re-checks server-side on submit).
    }
  };

  const validateForm = () => {
    if (!formValues.title.trim()) return 'Title is required.';
    if (!formValues.no_of_items || Number(formValues.no_of_items) <= 0) return 'No. of items must be greater than 0.';
    if (isMmisInstitute && !formValues.item_code_value) return 'Select Purchase or Donate.';
    if (titleWarning && !editingId) return titleWarning;

    for (const field of customFields) {
      if (field.required !== '1') continue;
      const value = formValues.custom[field.field_name];
      if (Array.isArray(value) ? value.length === 0 : !String(value ?? '').trim()) {
        return `${field.field_label} is required.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      setMessage({ type: 'info', text: validationError });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const formData = new FormData();
      appendSessionFormData(formData, session);
      if (editingId) formData.set('id', editingId);

      formData.set('title', formValues.title.trim());
      formData.set('sub_title', formValues.sub_title);
      formData.set('material_resource_type', formValues.material_resource_type);
      formData.set('edition', formValues.edition);
      formData.set('tags', formValues.tags);
      formData.set('no_of_items', formValues.no_of_items);
      if (isMmisInstitute && formValues.item_code_value) {
        formData.set('item_code_value', formValues.item_code_value);
      }
      formData.set('author_name', formValues.author_name);
      formData.set('isbn_issn', formValues.isbn_issn);
      formData.set('classification', formValues.classification);
      formData.set('publisher_name', formValues.publisher_name);
      formData.set('publish_year', formValues.publish_year);
      formData.set('publish_place', formValues.publish_place);
      formData.set('pages', formValues.pages);
      formData.set('series_title', formValues.series_title);
      formData.set('call_number', formValues.call_number);
      formData.set('language', formValues.language);
      formData.set('source', formValues.source);
      formData.set('subject', formValues.subject);
      formData.set('price', formValues.price);
      formData.set('price_currency', formValues.price_currency);
      formData.set('notes', formValues.notes);
      formData.set('review', formValues.review);
      formData.set('bill_no', formValues.bill_no);
      formData.set('bill_date', formValues.bill_date);
      if (bookImage) formData.set('image', bookImage);
      if (bookFileAtt) formData.set('file_att', bookFileAtt);

      customFields.forEach((field) => {
        const value = formValues.custom[field.field_name];
        if (Array.isArray(value)) {
          value.forEach((entry) => formData.append(`${field.field_name}[]`, entry));
        } else if (value) {
          formData.set(field.field_name, value);
        }
      });

      const response = await fetch(`/api/proxy?${new URLSearchParams({ path: 'books' }).toString()}`, {
        method: 'POST',
        body: formData,
      });
      const payload = normalizePayload(await response.json());

      if (!response.ok || readStatus(payload) !== 1) {
        throw new Error(readMessage(payload, editingId ? 'Unable to update this book.' : 'Unable to save this book.'));
      }

      setMessage({ type: 'success', text: readMessage(payload, editingId ? 'Book updated successfully.' : 'Book saved successfully.') });
      closeDrawer();
      await loadList();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save this book.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} book${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;

    setDeleting(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({ path: `books/${ids.join(',')}` });
      const body = new URLSearchParams();
      appendSessionParams(body, session);
      ids.forEach((id) => body.append('id[]', id));

      const response = await fetch(`/api/proxy?${params.toString()}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
      });
      const payload = normalizePayload(await response.json());

      if (!response.ok) {
        throw new Error(readMessage(payload, 'Unable to delete the selected book(s).'));
      }

      setMessage({ type: 'success', text: readMessage(payload, 'Book(s) deleted successfully.') });
      await loadList();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to delete the selected book(s).' });
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  };

  const isAdmin = session.userProfileName.toUpperCase() === 'ADMIN';

  return (
    <>
      <PageFrame>
        <PageHeader
          title="Book Resources"
          description="The library book catalogue — titles, physical item copies, and item-code generation, matching BookController exactly. Export reflects the current page of results."
          action={(
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => {
                if (exportRows.length === 0) return;
                const headers = Object.keys(exportRows[0]);
                const csv = [headers.join(','), ...exportRows.map((row) => headers.map((header) => escapeCsv(row[header] ?? '')).join(','))].join('\n');
                downloadFile('book-resources.csv', csv, 'text/csv;charset=utf-8;');
              }}><Download className="h-4 w-4" />CSV</Button>
              <Button type="button" variant="outline" onClick={() => {
                if (exportRows.length === 0) return;
                const headers = Object.keys(exportRows[0]);
                const lines = [headers.join('\t'), ...exportRows.map((row) => headers.map((header) => row[header] ?? '').join('\t'))];
                downloadFile('book-resources.xls', lines.join('\n'), 'application/vnd.ms-excel');
              }}><FileText className="h-4 w-4" />Excel</Button>
              <Button type="button" variant="outline" onClick={() => void exportRowsToPdf('book-resources', 'Book Resources', exportRows)}><FileDown className="h-4 w-4" />PDF</Button>
              <Button type="button" variant="outline" onClick={() => printRows(rows)}><Printer className="h-4 w-4" />Print</Button>
              {isAdmin ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleDelete(selectedIds)}
                  disabled={selectedIds.length === 0 || deleting}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete ({selectedIds.length})
                </Button>
              ) : null}
              <Button type="button" onClick={openCreateDrawer}>
                <Plus className="h-4 w-4" />
                Add Book
              </Button>
            </div>
          )}
        />

        {message ? <InlineMessage type={message.type} text={message.text} /> : null}

        <SectionPanel title="Filters" description="Matches BookController::index()'s DataTables filters exactly.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Search Item"><Input value={filters.searchItem} onChange={(event) => updateFilter({ searchItem: event.target.value })} placeholder="Enter item code" /></Field>
            <Field label="Status">
              <NativeSelect value={filters.bookStatus} onChange={(value) => updateFilter({ bookStatus: value })}>
                {BOOK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Subject">
              <NativeSelect value={filters.subject} onChange={(value) => updateFilter({ subject: value })} disabled={loadingFormConfig}>
                <option value="">All</option>
                {subjectOptions.map((option) => <option key={option.id} value={option.label}>{option.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Publisher Name">
              <NativeSelect value={filters.publisherName} onChange={(value) => updateFilter({ publisherName: value })} disabled={loadingFormConfig}>
                <option value="">All</option>
                {publisherOptions.map((option) => <option key={option.id} value={option.label}>{option.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Author Name">
              <NativeSelect value={filters.authorName} onChange={(value) => updateFilter({ authorName: value })} disabled={loadingFormConfig}>
                <option value="">All</option>
                {authorOptions.map((option) => <option key={option.id} value={option.label}>{option.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Search Classification Number"><Input value={filters.classificationNo} onChange={(event) => updateFilter({ classificationNo: event.target.value })} /></Field>
            <Field label="Search ISBN/ISSN"><Input value={filters.isbnIssn} onChange={(event) => updateFilter({ isbnIssn: event.target.value })} /></Field>
          </div>
        </SectionPanel>

        <SectionPanel title="Books">
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100">
                    <TableHead />
                    <TableHead>Sr No</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Sub Title</TableHead>
                    <TableHead>Publisher Name</TableHead>
                    <TableHead>Publish Year</TableHead>
                    <TableHead>Author Name</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <LoadingRows colSpan={11} label="Loading books" />
                  ) : rows.length > 0 ? (
                    rows.map((row, index) => (
                      <TableRow key={row.id} className="odd:bg-white even:bg-slate-50/60">
                        <TableCell>
                          {isAdmin ? (
                            <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} />
                          ) : null}
                        </TableCell>
                        <TableCell>{(page - 1) * pageSize + index + 1}</TableCell>
                        <TableCell>
                          {row.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.imageUrl} alt="" className="h-12 w-12 rounded object-cover" />
                          ) : '-'}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{row.itemCodes || '-'}</TableCell>
                        <TableCell className="font-medium text-slate-950">{row.title || '-'}</TableCell>
                        <TableCell>{row.subject || '-'}</TableCell>
                        <TableCell>{row.subTitle || '-'}</TableCell>
                        <TableCell>{row.publisherName || '-'}</TableCell>
                        <TableCell>{row.publishYear || '-'}</TableCell>
                        <TableCell>{row.authorName || '-'}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" size="icon-sm" onClick={() => void openEditDrawer(row)}>
                              <FilePenLine className="h-4 w-4" />
                            </Button>
                            {isAdmin ? (
                              <Button type="button" variant="outline" size="icon-sm" onClick={() => void handleDelete([row.id])} disabled={deleting}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <EmptyTableRow colSpan={11} label="No books match the current filters." />
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Field label="Rows per page">
                <NativeSelect value={String(pageSize)} onChange={(value) => { setPage(1); setPageSize(Number(value)); }}>
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                </NativeSelect>
              </Field>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <span>Page {page} of {totalPages} ({recordsFiltered} book{recordsFiltered === 1 ? '' : 's'})</span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading}>Previous</Button>
                  <Button type="button" variant="outline" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading}>Next</Button>
                </div>
              </div>
            </div>
          </div>
        </SectionPanel>
      </PageFrame>

      {drawerVisible ? (
        <div className="fixed inset-0 z-[70] overflow-hidden">
          <button
            type="button"
            aria-label="Close book drawer"
            className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0'}`}
            onClick={closeDrawer}
          />
          <div className="absolute inset-y-0 right-0 flex max-w-full">
            <div className={`flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-300 sm:w-[36rem] lg:w-[44rem] ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-sm font-bold text-slate-950">{editingId ? 'Edit Book' : 'Add Book'}</h2>
                <Button type="button" variant="ghost" size="icon-sm" onClick={closeDrawer}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="space-y-5">
                  <SectionPanel title="Core Fields">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Title">
                        <Input value={formValues.title} onChange={(event) => updateField('title', event.target.value)} onBlur={() => void handleTitleBlur()} />
                        {titleWarning ? <p className="mt-1 text-xs text-amber-600">{titleWarning}</p> : null}
                      </Field>
                      <Field label="Sub Title"><Input value={formValues.sub_title} onChange={(event) => updateField('sub_title', event.target.value)} /></Field>
                      <Field label="Material Resource Type">
                        <NativeSelect value={formValues.material_resource_type} onChange={(value) => updateField('material_resource_type', value)}>
                          <option value="">--Select Resource Type--</option>
                          {MATERIAL_RESOURCE_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </NativeSelect>
                      </Field>
                      <Field label="Edition"><Input value={formValues.edition} onChange={(event) => updateField('edition', event.target.value)} /></Field>
                      <Field label="Tags"><Input value={formValues.tags} onChange={(event) => updateField('tags', event.target.value)} /></Field>
                      <Field label="No. of Items">
                        <Input type="number" min={0} value={formValues.no_of_items} onChange={(event) => updateField('no_of_items', event.target.value)} />
                      </Field>
                      {isMmisInstitute ? (
                        <Field label="Item Code">
                          <div className="flex gap-4 pt-2 text-sm">
                            <label className="flex items-center gap-2">
                              <input type="radio" name="item_code_value" checked={formValues.item_code_value === 'A'} onChange={() => updateField('item_code_value', 'A')} />
                              Purchase
                            </label>
                            <label className="flex items-center gap-2">
                              <input type="radio" name="item_code_value" checked={formValues.item_code_value === 'D'} onChange={() => updateField('item_code_value', 'D')} />
                              Donate
                            </label>
                          </div>
                        </Field>
                      ) : (
                        <Field label="Item Code">
                          <Input value={editingId ? editingItemCodes : 'Generated automatically on save'} readOnly />
                        </Field>
                      )}
                      <Field label="Item Status">
                        <NativeSelect value={editingItemStatus.split('|')[0] || ''} onChange={() => undefined} disabled>
                          <option value="">Available</option>
                          {statusOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </NativeSelect>
                      </Field>
                    </div>
                  </SectionPanel>

                  <SectionPanel title="Catalogue Details">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Author/Editor Name"><Input value={formValues.author_name} onChange={(event) => updateField('author_name', event.target.value)} /></Field>
                      <Field label="ISBN/ISSN"><Input value={formValues.isbn_issn} onChange={(event) => updateField('isbn_issn', event.target.value)} /></Field>
                      <Field label="Classification"><Input value={formValues.classification} onChange={(event) => updateField('classification', event.target.value)} /></Field>
                      <Field label="Publisher Name"><Input value={formValues.publisher_name} onChange={(event) => updateField('publisher_name', event.target.value)} /></Field>
                      <Field label="Publish Year"><Input type="number" value={formValues.publish_year} onChange={(event) => updateField('publish_year', event.target.value)} placeholder="YYYY" /></Field>
                      <Field label="Publishing Place"><Input value={formValues.publish_place} onChange={(event) => updateField('publish_place', event.target.value)} /></Field>
                      <Field label="Book Size/Number of Page"><Input type="number" value={formValues.pages} onChange={(event) => updateField('pages', event.target.value)} /></Field>
                      <Field label="Series Title"><Input value={formValues.series_title} onChange={(event) => updateField('series_title', event.target.value)} /></Field>
                      <Field label="Call Number"><Input value={formValues.call_number} onChange={(event) => updateField('call_number', event.target.value)} /></Field>
                      <Field label="Language"><Input value={formValues.language} onChange={(event) => updateField('language', event.target.value)} /></Field>
                      <Field label="Source"><Input value={formValues.source} onChange={(event) => updateField('source', event.target.value)} /></Field>
                      <Field label="Subject"><Input value={formValues.subject} onChange={(event) => updateField('subject', event.target.value)} /></Field>
                      <Field label="Price"><Input type="number" step="any" value={formValues.price} onChange={(event) => updateField('price', event.target.value)} /></Field>
                      <Field label="Price Currency"><Input value={formValues.price_currency} onChange={(event) => updateField('price_currency', event.target.value)} /></Field>
                      <Field label="Bill No"><Input value={formValues.bill_no} onChange={(event) => updateField('bill_no', event.target.value)} /></Field>
                      <Field label="Bill Date"><Input type="date" value={formValues.bill_date} onChange={(event) => updateField('bill_date', event.target.value)} /></Field>
                    </div>
                  </SectionPanel>

                  <SectionPanel title="Notes">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Notes">
                        <div className="mb-1 flex justify-end">
                          <AiFieldAssistant
                            value={formValues.notes}
                            onApply={(next) => updateField('notes', next)}
                            fieldType="description"
                            label="Notes"
                            module="library"
                            page="Book resources"
                            entityType="book"
                          />
                        </div>
                        <textarea
                          value={formValues.notes}
                          onChange={(event) => updateField('notes', event.target.value)}
                          className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-blue-500/20"
                        />
                      </Field>
                      <Field label="Review">
                        <div className="mb-1 flex justify-end">
                          <AiFieldAssistant
                            value={formValues.review}
                            onApply={(next) => updateField('review', next)}
                            fieldType="description"
                            label="Review"
                            module="library"
                            page="Book resources"
                            entityType="book"
                          />
                        </div>
                        <textarea
                          value={formValues.review}
                          onChange={(event) => updateField('review', event.target.value)}
                          className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-blue-500/20"
                        />
                      </Field>
                    </div>
                  </SectionPanel>

                  <SectionPanel title="Files">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Image">
                        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                          <Upload className="h-4 w-4" />
                          <span className="truncate">{bookImage?.name || 'Choose image (optional)'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(event) => setBookImage(event.target.files?.[0] ?? null)} />
                        </label>
                      </Field>
                      <Field label="File Attachment">
                        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                          <Upload className="h-4 w-4" />
                          <span className="truncate">{bookFileAtt?.name || 'Choose file (optional)'}</span>
                          <input type="file" className="hidden" onChange={(event) => setBookFileAtt(event.target.files?.[0] ?? null)} />
                        </label>
                      </Field>
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
                  {editingId ? 'Update Book' : 'Save Book'}
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
