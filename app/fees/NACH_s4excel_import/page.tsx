'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';

import {
  Field,
  InlineMessage,
  NativeSelect,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  appendSessionFormData,
  appendSessionParams,
  asRecord,
  buildApiUrl,
  fetchLaravelJson,
  getApiBaseUrl,
  getFeesSession,
  joinUrl,
  readFirstString,
  readString,
  type ApiStatusPayload,
  type FeesSession,
  type SelectOption,
} from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type S4Response = ApiStatusPayload & {
  fee_month?: unknown;
};

export default function NachS4ExcelImportPage() {
  const [session, setSession] = useState<FeesSession>(() => getFeesSession());
  const [months, setMonths] = useState<SelectOption[]>([]);
  const [monthId, setMonthId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [summaryHtml, setSummaryHtml] = useState('');

  const loadMonths = useCallback(async (nextSession: FeesSession) => {
    if (!nextSession.subInstituteId || !nextSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing.' });
      return;
    }

    setLoadingMonths(true);
    try {
      const params = new URLSearchParams();
      appendSessionParams(params, nextSession);
      const payload = await fetchLaravelJson<S4Response>(nextSession, `${getApiBaseUrl(nextSession)}/fees/NACH_s4excel_import?${params.toString()}`);
      setMonths(toMonthOptions(payload.fee_month));
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load fee months.' });
    } finally {
      setLoadingMonths(false);
    }
  }, []);

  useEffect(() => {
    const nextSession = getFeesSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(nextSession);
    void loadMonths(nextSession);
  }, [loadMonths]);

  const handleUpload = async () => {
    const currentSession = getFeesSession();
    setSession(currentSession);

    if (!currentSession.subInstituteId || !currentSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing.' });
      return;
    }

    if (!monthId) {
      setMessage({ type: 'error', text: 'Please select month.' });
      return;
    }

    if (!file) {
      setMessage({ type: 'error', text: 'Please select S4 NACH file.' });
      return;
    }

    setUploading(true);
    setMessage(null);
    setSummaryHtml('');

    try {
      const form = new FormData();
      appendSessionFormData(form, currentSession);
      form.set('month_id', monthId);
      form.set('s4file', file);

      const payload = await fetchLaravelJson<S4Response>(currentSession, buildApiUrl(currentSession, '/fees/NACH_s4excel_import'), {
        method: 'POST',
        body: form,
      });

      const responseMessage = payload.message || 'S4 file imported successfully.';
      setMessage({ type: 'success', text: stripHtml(responseMessage) || 'S4 file imported successfully.' });
      setSummaryHtml(responseMessage);
      setFile(null);
      setFileInputKey((current) => current + 1);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to import S4 file.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="S4-NACH excel import"
        description="Upload the bank debit-return S4 file for a fee month. Laravel records realised payments and failed-return rows."
        action={
          <a
            href={joinUrl(getApiBaseUrl(session), 'sample_sheet/SAMPLE_NACH_S4_Import.xlsx')}
            download
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Sample S4 file
          </a>
        }
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Import file">
        <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)_auto] md:items-end">
          <Field label="Month">
            <NativeSelect value={monthId} onChange={setMonthId} disabled={loadingMonths} required>
              <option value="">{loadingMonths ? 'Loading months' : 'Select month'}</option>
              {months.map((month) => (
                <option key={month.id} value={month.id}>{month.label}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Select file">
            <Input
              key={fileInputKey}
              type="file"
              accept=".xls,.xlsx"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <Button type="button" className="h-10" onClick={handleUpload} disabled={uploading || loadingMonths}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import S4 file
          </Button>
        </div>
      </SectionPanel>

      {summaryHtml && (
        <SectionPanel title="Import summary">
          <div
            className="max-h-[420px] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800"
            dangerouslySetInnerHTML={{ __html: summaryHtml }}
          />
        </SectionPanel>
      )}
    </PageFrame>
  );
}

function toMonthOptions(value: unknown): SelectOption[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const record = asRecord(item);
      const id = readFirstString(record, ['id', 'month_id']) || String(index);
      const label = readFirstString(record, ['name', 'month_name', 'label']) || readString(item);
      return { id, label };
    }).filter((month) => month.id && month.label);
  }

  return Object.entries(asRecord(value)).map(([id, label]) => ({
    id,
    label: readString(label),
  })).filter((month) => month.id && month.label);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
