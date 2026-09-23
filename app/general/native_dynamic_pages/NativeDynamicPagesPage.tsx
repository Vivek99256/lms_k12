"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ErpAlert,
  ErpEmpty,
  ErpLoading,
  ErpPageHeader,
  ErpSection,
  erpSelectClass,
} from "@/components/erp/erp-ui";
import { RecordTable, type RecordColumn } from "@/components/erp/RecordTable";
import { errorMessage } from "@/lib/erp-legacy";
import { Modal } from "@/components/result/primitives";
import {
  addField,
  createPage,
  deleteField,
  loadPages,
  loadRegistry,
  updateField,
  updatePage,
  type DynamicFieldOption,
  type DynamicPage,
  type DynamicPageField,
} from "./api";

/**
 * Admin screen for native, server-driven mobile pages -- see api.ts's class
 * doc. A page here renders as real Flutter widgets in the K12 app, never a
 * WebView; the ERP no longer has a Blade equivalent of this screen (see
 * MobileDynamicPageAdminApiController's class doc for why).
 */
export default function NativeDynamicPagesPage() {
  const [pages, setPages] = useState<DynamicPage[]>([]);
  const [endpoints, setEndpoints] = useState<string[]>([]);
  const [fieldsByEndpoint, setFieldsByEndpoint] = useState<Record<string, DynamicFieldOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");
    try {
      const [registry, loadedPages] = await Promise.all([loadRegistry(), loadPages()]);
      setEndpoints(registry.endpoints);
      setFieldsByEndpoint(registry.fieldsByEndpoint);
      setPages(loadedPages);
    } catch (loadError: unknown) {
      setError(errorMessage(loadError, "Native dynamic pages could not be loaded."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
  }, [load]);

  return (
    <div className="space-y-6">
      <ErpPageHeader
        title="Native Dynamic Pages"
        description="Configure a page's fields once here and the K12 app renders it as real widgets -- not a WebView. A menu row opens one of these with render_type = native_dynamic and its Page Key as web_url."
        onRefresh={() => void load(true)}
        refreshing={refreshing}
      />

      <ErpAlert tone="error">{error}</ErpAlert>
      <ErpAlert tone="success">{notice}</ErpAlert>

      {loading ? (
        <ErpLoading label="Loading native dynamic pages…" />
      ) : (
        <div className="space-y-6">
          <AddPageSection
            endpoints={endpoints}
            onCreated={async (msg) => {
              setNotice(msg);
              setError("");
              await load(true);
            }}
            onError={(msg) => setError(msg)}
          />

          {pages.length === 0 ? (
            <ErpEmpty
              title="No native dynamic pages configured yet."
              hint="Add one above, then give it tiles below once it exists."
            />
          ) : (
            pages.map((page) => (
              <PageSection
                key={page.id}
                page={page}
                availableFields={fieldsByEndpoint[page.dataEndpoint] ?? []}
                onChanged={async (msg) => {
                  setNotice(msg);
                  setError("");
                  await load(true);
                }}
                onError={(msg) => setError(msg)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AddPageSection({
  endpoints,
  onCreated,
  onError,
}: {
  endpoints: string[];
  onCreated: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [pageKey, setPageKey] = useState("");
  const [title, setTitle] = useState("");
  const [dataEndpoint, setDataEndpoint] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async () => {
    if (!pageKey.trim() || !title.trim() || !dataEndpoint) {
      onError("Page Key, Title and Data Source are all required.");
      return;
    }
    setBusy(true);
    try {
      const msg = await createPage({ pageKey: pageKey.trim(), title: title.trim(), dataEndpoint });
      setPageKey("");
      setTitle("");
      setDataEndpoint("");
      onCreated(msg);
    } catch (submitError: unknown) {
      onError(errorMessage(submitError, "Could not create the page."));
    } finally {
      setBusy(false);
    }
  }, [pageKey, title, dataEndpoint, onCreated, onError]);

  return (
    <ErpSection title="Add a page" icon={<Plus className="size-4" />}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="dp-page-key">Page Key</Label>
          <Input
            id="dp-page-key"
            value={pageKey}
            onChange={(event) => setPageKey(event.target.value)}
            placeholder="fees_collect_summary"
            disabled={busy}
          />
        </div>
        <div>
          <Label htmlFor="dp-title">Title</Label>
          <Input
            id="dp-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Fees Collect"
            disabled={busy}
          />
        </div>
        <div>
          <Label htmlFor="dp-endpoint">Data Source</Label>
          <select
            id="dp-endpoint"
            className={erpSelectClass}
            value={dataEndpoint}
            onChange={(event) => setDataEndpoint(event.target.value)}
            disabled={busy}
          >
            <option value="">Select…</option>
            {endpoints.map((endpoint) => (
              <option key={endpoint} value={endpoint}>
                {endpoint}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={() => void submit()} disabled={busy}>
          Add Page
        </Button>
      </div>
    </ErpSection>
  );
}

function PageSection({
  page,
  availableFields,
  onChanged,
  onError,
}: {
  page: DynamicPage;
  availableFields: DynamicFieldOption[];
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [selectedField, setSelectedField] = useState("");
  const [addingBusy, setAddingBusy] = useState(false);
  const [editingField, setEditingField] = useState<DynamicPageField | null>(null);
  const [editingPage, setEditingPage] = useState(false);
  const [pageTitle, setPageTitle] = useState(page.title);
  const [pageStatus, setPageStatus] = useState<"Yes" | "No">(page.status === "No" ? "No" : "Yes");
  const [pageBusy, setPageBusy] = useState(false);

  const savePage = useCallback(async () => {
    setPageBusy(true);
    try {
      const msg = await updatePage(page.id, { title: pageTitle.trim() || page.title, status: pageStatus });
      setEditingPage(false);
      onChanged(msg);
    } catch (saveError: unknown) {
      onError(errorMessage(saveError, "Could not update the page."));
    } finally {
      setPageBusy(false);
    }
  }, [page.id, page.title, pageTitle, pageStatus, onChanged, onError]);

  const usedKeys = useMemo(() => new Set(page.fields.map((field) => field.fieldKey)), [page.fields]);
  const pickable = useMemo(
    () => availableFields.filter((field) => !usedKeys.has(field.fieldKey)),
    [availableFields, usedKeys]
  );

  const addTile = useCallback(async () => {
    if (!selectedField) return;
    setAddingBusy(true);
    try {
      const msg = await addField(page.id, selectedField);
      setSelectedField("");
      onChanged(msg);
    } catch (addError: unknown) {
      onError(errorMessage(addError, "Could not add the tile."));
    } finally {
      setAddingBusy(false);
    }
  }, [page.id, selectedField, onChanged, onError]);

  const removeTile = useCallback(
    async (field: DynamicPageField) => {
      if (!window.confirm(`Remove the "${field.label}" tile?`)) return;
      try {
        const msg = await deleteField(field.id);
        onChanged(msg);
      } catch (deleteError: unknown) {
        onError(errorMessage(deleteError, "Could not remove the tile."));
      }
    },
    [onChanged, onError]
  );

  const columns: Array<RecordColumn<DynamicPageField>> = [
    { key: "label", label: "Label", value: (row) => row.label },
    { key: "field_key", label: "Field", value: (row) => row.fieldKey },
    { key: "field_type", label: "Type", value: (row) => row.fieldType },
    { key: "sort_order", label: "Sort", value: (row) => String(row.sortOrder), align: "right" },
    { key: "status", label: "Status", value: (row) => row.status },
  ];

  return (
    <ErpSection
      title={page.title}
      description={`page_key: ${page.pageKey} · data source: ${page.dataEndpoint} · status: ${page.status}`}
      icon={<LayoutGrid className="size-4" />}
      footer={
        editingPage ? undefined : (
          <Button variant="outline" size="sm" onClick={() => setEditingPage(true)}>
            <Pencil className="size-3.5" />
            Edit Page
          </Button>
        )
      }
    >
      {editingPage ? (
        <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="min-w-[220px]">
            <Label htmlFor={`dp-page-title-${page.id}`}>Title</Label>
            <Input
              id={`dp-page-title-${page.id}`}
              value={pageTitle}
              onChange={(event) => setPageTitle(event.target.value)}
              disabled={pageBusy}
            />
          </div>
          <div className="min-w-[140px]">
            <Label htmlFor={`dp-page-status-${page.id}`}>Status</Label>
            <select
              id={`dp-page-status-${page.id}`}
              className={erpSelectClass}
              value={pageStatus}
              onChange={(event) => setPageStatus(event.target.value === "No" ? "No" : "Yes")}
              disabled={pageBusy}
            >
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
          <Button onClick={() => void savePage()} disabled={pageBusy}>
            Save
          </Button>
          <Button variant="outline" onClick={() => setEditingPage(false)} disabled={pageBusy}>
            Cancel
          </Button>
        </div>
      ) : null}

      <RecordTable
        rows={page.fields}
        columns={columns}
        getRowKey={(row) => row.id}
        showExport={false}
        searchPlaceholder="Search tiles…"
        emptyTitle="No tiles yet."
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingField(row)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => void removeTile(row)}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      />

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <Label htmlFor={`dp-add-field-${page.id}`}>Add a tile</Label>
          <select
            id={`dp-add-field-${page.id}`}
            className={erpSelectClass}
            value={selectedField}
            onChange={(event) => setSelectedField(event.target.value)}
            disabled={addingBusy}
          >
            <option value="">Select a field…</option>
            {pickable.map((field) => (
              <option key={field.fieldKey} value={field.fieldKey}>
                {field.label} ({field.fieldKey})
              </option>
            ))}
          </select>
        </div>
        <Button onClick={() => void addTile()} disabled={addingBusy || !selectedField}>
          Add Tile
        </Button>
      </div>

      {editingField ? (
        <EditFieldModal
          field={editingField}
          onClose={() => setEditingField(null)}
          onSaved={(msg) => {
            setEditingField(null);
            onChanged(msg);
          }}
          onError={onError}
        />
      ) : null}
    </ErpSection>
  );
}

function EditFieldModal({
  field,
  onClose,
  onSaved,
  onError,
}: {
  field: DynamicPageField;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [label, setLabel] = useState(field.label);
  const [sortOrder, setSortOrder] = useState(String(field.sortOrder));
  const [status, setStatus] = useState<"Yes" | "No">(field.status === "No" ? "No" : "Yes");
  const [busy, setBusy] = useState(false);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const msg = await updateField(field.id, {
        label: label.trim() || field.label,
        sortOrder: Number(sortOrder) || 0,
        status,
      });
      onSaved(msg);
    } catch (saveError: unknown) {
      onError(errorMessage(saveError, "Could not update the tile."));
    } finally {
      setBusy(false);
    }
  }, [field, label, sortOrder, status, onSaved, onError]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit tile"
      description={field.fieldKey}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="dp-edit-label">Label</Label>
          <Input id="dp-edit-label" value={label} onChange={(event) => setLabel(event.target.value)} disabled={busy} />
        </div>
        <div>
          <Label htmlFor="dp-edit-sort">Sort Order</Label>
          <Input
            id="dp-edit-sort"
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            disabled={busy}
          />
        </div>
        <div>
          <Label htmlFor="dp-edit-status">Status</Label>
          <select
            id="dp-edit-status"
            className={erpSelectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value === "No" ? "No" : "Yes")}
            disabled={busy}
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
