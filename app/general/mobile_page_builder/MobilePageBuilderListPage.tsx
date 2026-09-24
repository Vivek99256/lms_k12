'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Eye, LayoutTemplate, Loader2, Pencil, Plus, PowerOff, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErpAlert, ErpEmpty, ErpLoading, ErpPageHeader, ErpSection } from '@/components/erp/erp-ui';
import { RecordTable, type RecordColumn } from '@/components/erp/RecordTable';
import { errorMessage } from '@/lib/erp-legacy';
import { Modal } from '@/components/result/primitives';
import { generateLayoutFromSourcePage } from '@/components/mobile-page-builder/shared/generateFromSourcePage';
import {
  createPage,
  deactivatePage,
  loadMenuPages,
  loadPages,
  loadSourcePage,
  saveDraft,
  type MobileMenuPage,
  type MobilePageSummary,
} from './api';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-500',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}

/**
 * List + create for Custom Mobile Pages -- sibling of Mobile App Menu Rights
 * and Native Dynamic Pages in the General section. A page created here is
 * picked from the Menu Rights edit modal's "Custom Mobile Page" source (see
 * app/general/mobile_app_rights) once published.
 */
export function MobilePageBuilderListPage() {
  const router = useRouter();
  const [pages, setPages] = useState<MobilePageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [createBusy, setCreateBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuPages, setMenuPages] = useState<MobileMenuPage[]>([]);
  const [menuPagesLoading, setMenuPagesLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creatingKey, setCreatingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPages(await loadPages());
    } catch (value: unknown) {
      setError(errorMessage(value, 'Mobile pages could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    // Loaded once up front (not on-open) so the picker never has to show a
    // separate loading state on the common path -- this is every real page
    // on the tenant's sidebar (tblmenumaster), not just the hand-traced few.
    loadMenuPages()
      .then((items) => {
        setMenuPages(items);
        setMenuPagesLoading(false);
      })
      .catch(() => setMenuPagesLoading(false));
  }, []);

  const createBlank = useCallback(async () => {
    setCreateBusy(true);
    setError('');
    try {
      // No name/slug/description prompt -- creates instantly with a
      // placeholder name and goes straight to the design canvas. The name
      // (and slug/description) can be changed any time from the editor's
      // topbar; the slug is de-duplicated server-side either way.
      const page = await createPage({ name: 'Untitled Page' });
      router.push(`/general/mobile_page_builder/${page.id}/editor`);
    } catch (value: unknown) {
      setError(errorMessage(value, 'Could not create the page.'));
      setCreateBusy(false);
    }
  }, [router]);

  const createFromSourceKey = useCallback(
    async (key: string, fallbackName: string) => {
      setCreatingKey(key);
      setError('');
      try {
        const detail = await loadSourcePage(key);
        const page = await createPage({ name: detail.label || fallbackName });
        // The generated layout goes straight into the draft -- it's a
        // starting point the admin edits from here on, same as any other
        // page; nothing about how it's saved/published differs.
        await saveDraft(page.id, generateLayoutFromSourcePage(detail));
        router.push(`/general/mobile_page_builder/${page.id}/editor`);
      } catch (value: unknown) {
        setError(errorMessage(value, `Could not create a page from "${fallbackName}".`));
        setCreatingKey(null);
      }
    },
    [router]
  );

  const createFromMenuPage = useCallback(
    async (item: MobileMenuPage) => {
      if (item.sourceKey) {
        await createFromSourceKey(item.sourceKey, item.name);
        return;
      }

      // No traced fields for this one yet (see MobileFormFieldRegistry.php's
      // class doc for why that's a per-page manual step, not automatic) --
      // starts blank, but already named after the real page so it's easy to
      // find again and pick up from.
      setCreatingKey(`menu-${item.id}`);
      setError('');
      try {
        const page = await createPage({ name: item.name });
        router.push(`/general/mobile_page_builder/${page.id}/editor`);
      } catch (value: unknown) {
        setError(errorMessage(value, `Could not create a page from "${item.name}".`));
        setCreatingKey(null);
      }
    },
    [router, createFromSourceKey]
  );

  const menuGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? menuPages.filter((item) => item.name.toLowerCase().includes(query) || item.section.toLowerCase().includes(query))
      : menuPages;

    const bySection = new Map<string, MobileMenuPage[]>();
    for (const item of filtered) {
      const list = bySection.get(item.section) ?? [];
      list.push(item);
      bySection.set(item.section, list);
    }

    return Array.from(bySection.entries())
      .map(([section, items]) => ({ section, items: items.sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.section.localeCompare(b.section));
  }, [menuPages, search]);

  const deactivate = useCallback(
    async (page: MobilePageSummary) => {
      if (!window.confirm(`Deactivate "${page.name}"? Any menu row pointing at it will fall back to native.`)) return;
      try {
        setNotice(await deactivatePage(page.id));
        setError('');
        await load();
      } catch (value: unknown) {
        setError(errorMessage(value, 'Could not deactivate the page.'));
      }
    },
    [load]
  );

  const columns: Array<RecordColumn<MobilePageSummary>> = useMemo(
    () => [
      { key: 'name', label: 'Name', value: (row) => row.name },
      { key: 'slug', label: 'Slug', value: (row) => row.slug },
      { key: 'status', label: 'Status', value: (row) => row.status, render: (row) => <StatusBadge status={row.status} /> },
      {
        key: 'draft',
        label: 'Draft',
        value: (row) => (row.draft ? `v${row.draft.versionNumber}` : ''),
        render: (row) => (row.draft ? `v${row.draft.versionNumber} · ${new Date(row.draft.updatedOn).toLocaleString()}` : '—'),
      },
      {
        key: 'published',
        label: 'Published',
        value: (row) => (row.published ? `v${row.published.versionNumber}` : ''),
        render: (row) => (row.published ? `v${row.published.versionNumber} · ${new Date(row.published.publishedAt).toLocaleString()}` : '—'),
      },
    ],
    []
  );

  return (
    <main className="mx-auto space-y-5 p-4 sm:p-6">
      <ErpPageHeader
        title="Mobile Page Builder"
        description="Design custom mobile screens visually and publish them for the K12 app's WebView to render -- no separate Flutter release needed."
        onRefresh={() => void load()}
        refreshing={loading}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      <ErpSection
        title="Pages"
        description="Create a page here, design it, then pick it from Mobile App Menu Rights' Custom Mobile Page source once published."
        icon={<LayoutTemplate className="size-5" />}
        footer={
          <Button onClick={() => setPickerOpen(true)} disabled={createBusy || creatingKey !== null}>
            <Plus className="size-4" />
            Create Mobile Page
          </Button>
        }
      >
        {loading ? (
          <ErpLoading label="Loading mobile pages…" />
        ) : pages.length === 0 ? (
          <ErpEmpty title="No mobile pages yet." hint="Create one to start designing a custom mobile screen." />
        ) : (
          <RecordTable
            rows={pages}
            columns={columns}
            getRowKey={(row) => row.id}
            searchPlaceholder="Search mobile pages…"
            exportFilename="mobile-pages"
            exportTitle="Mobile Pages"
            emptyTitle="No pages found."
            actions={(row) => (
              <div className="flex justify-end gap-2">
                {row.status === 'published' ? (
                  <Link href={`/mobile/custom/${row.slug}`} target="_blank">
                    <Button size="sm" variant="outline">
                      <Eye className="size-3.5" />
                      Preview
                    </Button>
                  </Link>
                ) : null}
                <Link href={`/general/mobile_page_builder/${row.id}/editor`}>
                  <Button size="sm" variant="outline">
                    <Pencil className="size-3.5" />
                    Edit Design
                  </Button>
                </Link>
                {row.status !== 'inactive' ? (
                  <Button size="sm" variant="outline" onClick={() => void deactivate(row)}>
                    <PowerOff className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            )}
          />
        )}
      </ErpSection>

      <Modal
        open={pickerOpen}
        onClose={() => {
          if (createBusy || creatingKey) return;
          setPickerOpen(false);
        }}
        title="Create Mobile Page"
        description="Start blank, or pick any page from your sidebar menu to import as a starting point. Pages with a green check already have their fields traced and auto-import; the rest start blank, named after the page."
        size="lg"
      >
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void createBlank()}
            disabled={createBusy || creatingKey !== null}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50 disabled:pointer-events-none disabled:opacity-60"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              {createBusy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">Blank Page</span>
              <span className="block text-xs text-slate-500">Design from scratch on an empty canvas.</span>
            </span>
          </button>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your menu…"
              className="pl-9"
            />
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200">
            {menuPagesLoading ? (
              <div className="p-6 text-center text-sm text-slate-400">Loading your menu…</div>
            ) : menuGroups.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">No pages match &quot;{search}&quot;.</div>
            ) : (
              menuGroups.map(({ section, items }) => (
                <div key={section} className="border-b border-slate-100 last:border-b-0">
                  <div className="sticky top-0 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {section}
                  </div>
                  {items.map((item) => {
                    const busy = creatingKey === item.sourceKey || creatingKey === `menu-${item.id}`;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void createFromMenuPage(item)}
                        disabled={createBusy || creatingKey !== null}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-blue-50 disabled:pointer-events-none disabled:opacity-60"
                      >
                        <span className="truncate">{item.name}</span>
                        {busy ? (
                          <Loader2 className="size-3.5 shrink-0 animate-spin text-slate-400" />
                        ) : item.sourceKey ? (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                            <CheckCircle2 className="size-3" />
                            Fields ready
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </main>
  );
}
