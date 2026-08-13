'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  Film,
  FolderOpen,
  Images,
  LoaderCircle,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import SearchDropdown from '@/components/search-dropdown/SearchDropdown';
import type { SearchDropdownValues } from '@/components/search-dropdown/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import PageHeader from '@/components/result/PageHeader';
import { toast } from '@/components/result/toast';
import {
  galleryFileUrl,
  loadModuleRows,
  saveModuleRecord,
  youtubeEmbedUrl,
  type JsonRecord,
} from '../_lib/api';
import { frontDeskModules, type ModuleField } from '../_lib/modules';

const galleryModule = frontDeskModules.gallery;

const emptyClassValues: SearchDropdownValues = {
  section: '',
  standard: '',
  division: '',
  subject: '',
};

function scalar(value: SearchDropdownValues[keyof SearchDropdownValues]) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

type Album = {
  title: string;
  items: JsonRecord[];
};

export default function GalleryAlbums() {
  const [rows, setRows] = useState<JsonRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classValues, setClassValues] = useState(emptyClassValues);
  const [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>({});
  const [activeAlbum, setActiveAlbum] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadModuleRows(galleryModule.endpoint, {}, galleryModule.method ?? 'GET');
      setRows(result.rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the gallery.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const autoLoaded = useRef(false);

  useEffect(() => {
    if (!autoLoaded.current) {
      autoLoaded.current = true;
      void load();
    }
  }, [load]);

  const albums = useMemo<Album[]>(() => {
    const grouped = new Map<string, JsonRecord[]>();
    for (const row of rows) {
      const title = String(row.album_title ?? '').trim() || 'Untitled album';
      const items = grouped.get(title) ?? [];
      items.push(row);
      grouped.set(title, items);
    }
    return Array.from(grouped.entries()).map(([title, items]) => ({ title, items }));
  }, [rows]);

  const activeItems = useMemo(
    () => albums.find((album) => album.title === activeAlbum)?.items ?? [],
    [albums, activeAlbum]
  );

  function addClassValues(form: FormData) {
    const mapping = { section: 'grade', standard: 'standard', division: 'division' } as const;
    for (const key of galleryModule.classFields ?? []) {
      for (const id of scalar(classValues[key])) {
        form.append(`${mapping[key]}[]`, id);
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!galleryModule.storeEndpoint) return;
    const formElement = event.currentTarget;
    setSaving(true);
    setError('');
    try {
      const form = new FormData(formElement);
      for (const [name, value] of Object.entries(galleryModule.defaultFormValues ?? {})) {
        if (!form.has(name)) form.set(name, value);
      }
      addClassValues(form);
      await saveModuleRecord(galleryModule.storeEndpoint, form);
      toast.success('Media published');
      formElement.reset();
      setFieldValues({});
      setClassValues(emptyClassValues);
      setShowForm(false);
      await load();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save the record.';
      setError(message);
      toast.error('Save failed', message);
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: ModuleField) {
    if (field.visibleWhen && fieldValues[field.visibleWhen.field] !== field.visibleWhen.value) {
      return null;
    }
    const id = `gallery-${field.name}`.replaceAll(' ', '-');
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
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        ) : (
          <Input {...common} type={field.type} multiple={field.multiple} accept={field.accept} />
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <PageHeader
          icon={Images}
          title={galleryModule.title}
          subtitle={galleryModule.description}
          breadcrumbs={[
            { label: 'Front desk', href: '/dashboard' },
            { label: galleryModule.title },
          ]}
          actions={
            <>
              <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
              <Button type="button" onClick={() => setShowForm((value) => !value)}>
                <Plus className="h-4 w-4" /> {showForm ? 'Close' : 'Add media'}
              </Button>
            </>
          }
        />

        {showForm ? (
          <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            {galleryModule.classFields?.length ? (
              <SearchDropdown
                fields={galleryModule.classFields}
                values={classValues}
                multiple={
                  galleryModule.multipleClassFields
                    ? Object.fromEntries(galleryModule.classFields.map((field) => [field, true]))
                    : {}
                }
                required={Object.fromEntries(galleryModule.classFields.map((field) => [field, true]))}
                onChange={(values) => setClassValues(values)}
              />
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {(galleryModule.fields ?? []).map(renderField)}
            </div>
            <div className="mt-5 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {galleryModule.submitLabel ?? 'Save changes'}
              </Button>
            </div>
          </form>
        ) : null}

        {error ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex h-40 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading albums
          </div>
        ) : albums.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {albums.map((album) => (
              <AlbumCard key={album.title} album={album} onView={() => setActiveAlbum(album.title)} />
            ))}
          </div>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white text-slate-500">
            <FolderOpen className="h-8 w-8 text-slate-300" />
            No albums yet. Add media to create the first one.
          </div>
        )}
      </div>

      {activeAlbum ? (
        <AlbumModal title={activeAlbum} items={activeItems} onClose={() => setActiveAlbum(null)} />
      ) : null}
    </main>
  );
}

function AlbumCard({ album, onView }: { album: Album; onView: () => void }) {
  const thumbnail = album.items.find((item) => item.type === 'Photo');
  const thumbnailUrl = thumbnail ? galleryFileUrl(thumbnail) : '';

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex h-40 items-center justify-center overflow-hidden bg-slate-100">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={album.title} className="h-full w-full object-cover" />
        ) : (
          <Film className="h-10 w-10 text-slate-300" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="truncate text-sm font-semibold text-slate-900" title={album.title}>
            {album.title}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {album.items.length} {album.items.length === 1 ? 'file' : 'files'}
          </p>
        </div>
        <Button type="button" variant="outline" className="mt-auto" onClick={onView}>
          <Images className="h-4 w-4" /> View gallery
        </Button>
      </div>
    </div>
  );
}

function AlbumModal({
  title,
  items,
  onClose,
}: {
  title: string;
  items: JsonRecord[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-950">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {items.length} {items.length === 1 ? 'file' : 'files'} in this album
            </p>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={onClose} aria-label="Close album">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <AlbumItem key={String(item.id ?? index)} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlbumItem({ item }: { item: JsonRecord }) {
  const url = galleryFileUrl(item);
  const title = typeof item.title === 'string' && item.title ? item.title : 'Untitled';

  if (item.type === 'Video') {
    const embedUrl = url ? youtubeEmbedUrl(url) : null;
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200">
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={title}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <a
            href={url || '#'}
            target="_blank"
            rel="noreferrer"
            className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <Film className="h-8 w-8" />
            <span className="text-xs">Open video</span>
          </a>
        )}
        <div className="px-3 py-2 text-xs font-medium text-slate-700">{title}</div>
      </div>
    );
  }

  return (
    <a
      href={url || '#'}
      target="_blank"
      rel="noreferrer"
      className="overflow-hidden rounded-lg border border-slate-200"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={title} className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-slate-100 text-slate-300">
          <Images className="h-8 w-8" />
        </div>
      )}
      <div className="px-3 py-2 text-xs font-medium text-slate-700">{title}</div>
    </a>
  );
}
