'use client';

import { useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';

import {
  Field,
  InlineMessage,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  appendSessionFormData,
  buildApiUrl,
  fetchLaravelJson,
  getApiBaseUrl,
  getFeesSession,
  joinUrl,
  type ApiStatusPayload,
  type FeesSession,
} from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NachS2ExcelImportPage() {
  const [session, setSession] = useState<FeesSession>(() => getFeesSession());
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleUpload = async () => {
    const currentSession = getFeesSession();
    setSession(currentSession);

    if (!currentSession.subInstituteId || !currentSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing.' });
      return;
    }

    if (!file) {
      setMessage({ type: 'error', text: 'Please select S2 NACH file.' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const form = new FormData();
      appendSessionFormData(form, currentSession);
      form.set('s2file', file);

      const payload = await fetchLaravelJson<ApiStatusPayload>(currentSession, buildApiUrl(currentSession, '/fees/NACH_s2excel_import'), {
        method: 'POST',
        body: form,
      });

      setMessage({ type: 'success', text: payload.message || 'S2 file imported successfully.' });
      setFile(null);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to import S2 file.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="S2-NACH excel import"
        description="Upload the bank-returned S2 mandate file. Laravel imports UMRN data and marks student bank details as registered."
        action={
          <a
            href={joinUrl(getApiBaseUrl(session), 'sample_sheet/SAMPLE_NACH_S2_Import.xlsx')}
            download
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Sample S2 file
          </a>
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Import file">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <Field label="Select file">
            <Input
              type="file"
              accept=".xls,.xlsx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <Button type="button" className="h-10" onClick={handleUpload} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import S2 file
          </Button>
        </div>
      </SectionPanel>
    </PageFrame>
  );
}
