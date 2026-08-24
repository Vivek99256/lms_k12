'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Save, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, LoadingState, Message, NativeSelect, PageFrame, PageHeader, Panel } from '@/app/inward_outward/_components/shared';
import HierarchyFields from './HierarchyFields';
import { loadSqaaEntry, loadSqaaLevel1, saveSqaaEntry, sqaaFileUrl } from '../_lib/api';
import { emptySqaaSelection, type SqaaEntryDocument, type SqaaHierarchySelection, type SqaaLevel } from '../_lib/types';

export default function EntryPage() {
  const [level1, setLevel1] = useState<SqaaLevel[]>([]);
  const [selection, setSelection] = useState<SqaaHierarchySelection>(emptySqaaSelection);
  const [level4Options, setLevel4Options] = useState<SqaaLevel[]>([]);
  const [documents, setDocuments] = useState<SqaaEntryDocument[]>([]);
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [loadedMenuId, setLoadedMenuId] = useState('');
  const [loadedMark, setLoadedMark] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const reportError = useCallback((message: string) => setError(message), []);

  useEffect(() => {
    loadSqaaLevel1()
      .then(setLevel1)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load SQAA hierarchy.'))
      .finally(() => setLoading(false));
  }, []);

  const score = useMemo(() => {
    const index = level4Options.findIndex((item) => item.id === selection.level4);
    return index >= 0 && index < 4 ? String(index + 1) : '';
  }, [level4Options, selection.level4]);
  const selectedMenuId = selection.level4 || selection.level3 || selection.level2 || selection.level1;
  const effectiveMark = score || String(loadedMark ?? 0);

  async function searchDocuments() {
    if (!selectedMenuId) {
      setError('Select an SQAA level before loading documents.');
      return;
    }
    setLoadingDocuments(true);
    setError('');
    setSuccess('');
    try {
      const result = await loadSqaaEntry(selectedMenuId);
      setDocuments(result.documents);
      setLoadedMenuId(selectedMenuId);
      setLoadedMark(result.mark);
      setFiles({});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load SQAA documents.');
    } finally {
      setLoadingDocuments(false);
    }
  }

  function updateDocument(documentId: string, values: Partial<SqaaEntryDocument>) {
    setDocuments((current) => current.map((item) => item.documentId === documentId ? { ...item, ...values } : item));
  }

  function changeSelection(next: SqaaHierarchySelection) {
    setSelection(next);
    setDocuments([]);
    setFiles({});
    setLoadedMenuId('');
    setLoadedMark(null);
    setSuccess('');
  }

  async function save() {
    if (!loadedMenuId || documents.length === 0) {
      setError('Search and load the SQAA documents before saving.');
      return;
    }
    const missingAvailability = documents.some((document) => !document.availability);
    if (missingAvailability) {
      setError('Select availability for every document.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await saveSqaaEntry(loadedMenuId, effectiveMark, documents, files);
      await searchDocuments();
      setSuccess('SQAA entry saved successfully.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save the SQAA entry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageFrame>
      <PageHeader title="SQAA Entry" description="Select the SQAA standard and review its derived score." />
      <Message value={error ? { type: 'error', text: error } : null} />
      <Message value={success ? { type: 'success', text: success } : null} />
      <Panel title="SQAA standard">
        {loading ? <LoadingState label="Loading SQAA levels" /> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <HierarchyFields level1={level1} value={selection} onChange={changeSelection} onError={reportError} onLevel4Options={setLevel4Options} />
            <div className="space-y-1.5">
              <label htmlFor="sqaa-score" className="text-xs font-semibold text-slate-700">Level Score</label>
              <Input id="sqaa-score" value={selection.level4 ? score : loadedMark ?? ''} readOnly placeholder="Select level 4" className="bg-slate-50" />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={() => void searchDocuments()} disabled={loadingDocuments || !selectedMenuId}>
                <Search className="h-4 w-4" />{loadingDocuments ? 'Loading...' : 'Search'}
              </Button>
            </div>
          </div>
        )}
      </Panel>
      {loadingDocuments ? <Panel><LoadingState label="Loading SQAA documents" /></Panel> : documents.length > 0 ? (
        <Panel title="Document evidence">
          <div className="space-y-5">
            {documents.map((document) => (
              <div key={document.documentId} className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Document" required>
                  <Textarea value={document.title} onChange={(event) => updateDocument(document.documentId, { title: event.target.value })} rows={3} />
                </Field>
                <Field label="Availability" required>
                  <NativeSelect value={document.availability} onChange={(availability) => updateDocument(document.documentId, { availability: availability as SqaaEntryDocument['availability'] })} required>
                    <option value="">Select availability</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="inprocess">In-Process</option>
                  </NativeSelect>
                </Field>
                <Field label="Evidence file">
                  <Input
                    type="file"
                    accept=".pdf,.xlsx,.doc,.docx"
                    disabled={document.availability !== 'yes'}
                    onChange={(event) => setFiles((current) => ({ ...current, [document.documentId]: event.target.files?.[0] }))}
                  />
                  {document.file && <a href={sqaaFileUrl(document.file)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline">{document.file}<ExternalLink className="h-3 w-3" /></a>}
                </Field>
                <Field label="Files to be uploaded">
                  <Textarea value={document.reasons} readOnly rows={3} className="bg-slate-100" />
                </Field>
              </div>
            ))}
            <div className="flex justify-end">
              <Button type="button" onClick={() => void save()} disabled={saving}>
                <Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </Panel>
      ) : selectedMenuId && !loadingDocuments ? (
        <Panel><p className="py-8 text-center text-sm text-slate-600">Select Search to load the configured documents for this SQAA standard.</p></Panel>
      ) : null}
    </PageFrame>
  );
}
