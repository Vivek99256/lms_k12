'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Copy,
  FileText,
  Files,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';

import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader, erpCardClass } from '@/components/erp/erp-ui';
import { Button } from '@/components/ui/button';
import {
  deleteTemplate,
  duplicateTemplate,
  fetchTemplates,
  type TemplateSummary,
} from '@/app/document-templates/api';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All categories',
  certificate: 'Certificates',
  id_card: 'ID cards',
  fees: 'Fee documents',
  admission: 'Admission documents',
  exam: 'Exam documents',
  circular: 'Circulars',
  general: 'General',
};

const STATUS_TONES: Record<string, string> = {
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  archived: 'border-amber-200 bg-amber-50 text-amber-800',
};

const selectClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20';

/**
 * The app's primary action styling (see Level3Subheader). The shared Button's
 * `default` variant resolves to near-black via --primary, which reads as a
 * different product next to the blue chrome around it.
 */
const primaryButtonClass =
  'bg-[#0D6EFD] text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

function DocumentTemplatesGallery() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The sidebar links deep-link into a category (…?category=certificate), so
  // the filter is seeded from the URL rather than always starting at "all".
  const initialCategory = searchParams.get('category') ?? 'all';

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  // Follow the sidebar's category deep-links (…?category=certificate) without
  // trapping the user: adjusting during render keeps the list and the URL in
  // step, while a manual change to the dropdown still wins until the URL moves
  // again.
  const urlCategory = searchParams.get('category') ?? 'all';
  const [lastUrlCategory, setLastUrlCategory] = useState(urlCategory);
  if (urlCategory !== lastUrlCategory) {
    setLastUrlCategory(urlCategory);
    setCategory(urlCategory);
  }

  const load = useCallback(
    (signal?: AbortSignal) =>
      fetchTemplates({ category, status }, signal)
        .then((result) => {
          setTemplates(result.templates);
          setErrorText('');
          setLoading(false);
          setRefreshing(false);
        })
        .catch((error: unknown) => {
          if (signal?.aborted) return;
          setTemplates([]);
          setErrorText(errorMessage(error));
          setLoading(false);
          setRefreshing(false);
        }),
    [category, status]
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Search filters the loaded set locally — the list is per-school and small,
  // so this stays instant instead of round-tripping on every keystroke.
  const visibleTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter(
      (template) =>
        template.name.toLowerCase().includes(term) ||
        template.description.toLowerCase().includes(term)
    );
  }, [templates, search]);

  const handleDelete = async (template: TemplateSummary) => {
    if (!window.confirm(`Delete “${template.name}”? This cannot be undone.`)) return;

    setBusyId(template.id);
    setSuccessText('');
    try {
      await deleteTemplate(template.id);
      setTemplates((current) => current.filter((entry) => entry.id !== template.id));
      setSuccessText(`“${template.name}” was deleted.`);
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const handleDuplicate = async (template: TemplateSummary) => {
    setBusyId(template.id);
    setSuccessText('');
    try {
      const copy = await duplicateTemplate(template.id);
      setSuccessText(`“${copy.name}” was created.`);
      await load();
    } catch (error) {
      setErrorText(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <ErpPageHeader
        title="Document templates"
        description="Design the printable documents your school issues — certificates, ID cards, receipts and letters."
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        actions={
          <Button
            className={primaryButtonClass}
            onClick={() => router.push('/document-templates/editor/new')}
          >
            <Plus className="size-4" />
            New template
          </Button>
        }
      />

      <ErpAlert tone="error">{errorText}</ErpAlert>
      <ErpAlert tone="success">{successText}</ErpAlert>

      <section className={erpCardClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search templates"
              aria-label="Search templates"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
            className={selectClass}
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
            className={selectClass}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </section>

      {loading ? (
        <ErpLoading label="Loading templates…" />
      ) : visibleTemplates.length === 0 ? (
        <ErpEmpty
          title={search ? 'No templates match your search' : 'No templates yet'}
          hint={
            search
              ? 'Try a different name, or clear the search.'
              : 'Create your first template to start issuing documents.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleTemplates.map((template) => (
            <article
              key={template.id}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-blue-50 p-2 text-[#0D6EFD]">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-slate-900" title={template.name}>
                    {template.name}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {CATEGORY_LABELS[template.category] ?? 'General'} · Version {template.version}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                    STATUS_TONES[template.status] ?? STATUS_TONES.draft
                  }`}
                >
                  {template.status}
                </span>
              </div>

              {template.description ? (
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{template.description}</p>
              ) : null}

              <p className="mt-3 font-mono text-[11px] text-slate-400">
                ID {template.id}
                {template.updatedAt ? ` · Updated ${template.updatedAt}` : ''}
              </p>

              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                <Button
                  className={`flex-1 ${primaryButtonClass}`}
                  onClick={() => router.push(`/document-templates/editor/${template.id}`)}
                >
                  <Pencil className="size-4" />
                  Open
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Duplicate template"
                  aria-label="Duplicate template"
                  disabled={busyId === template.id}
                  onClick={() => void handleDuplicate(template)}
                >
                  {busyId === template.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Delete template"
                  aria-label="Delete template"
                  className="text-red-600 hover:bg-red-50"
                  disabled={busyId === template.id}
                  onClick={() => void handleDelete(template)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentTemplatesPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense
      fallback={
        <div className="flex h-40 items-center justify-center text-slate-500">
          <Files className="mr-2 size-5" />
          Loading templates…
        </div>
      }
    >
      <DocumentTemplatesGallery />
    </Suspense>
  );
}
