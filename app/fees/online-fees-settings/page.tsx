'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2, Plus, Save, Trash2, X } from 'lucide-react';

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
import { asRecord, fetchLaravelJson, getFeesSession, readFirstString, toArray } from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type GatewayName = 'hdfc' | 'icici' | 'axis' | 'aggre_pay' | 'razorpay' | 'payphi';
type CredentialField = 'merchant_id' | 'account_name' | 'access_code' | 'working_code' | 'enc_key' | 'encryption_key' | 'checksum_key' | 'cid' | 'api_key' | 'salt_key' | 'key';

type GatewayDefinition = {
  label: string;
  credentials: readonly CredentialField[];
  requiresMedium: boolean;
};

type GatewayRow = {
  id: string;
  syear: string;
  bankName: string;
};

const gatewayDefinitions: Record<GatewayName, GatewayDefinition> = {
  hdfc: { label: 'HDFC', credentials: ['merchant_id', 'account_name', 'access_code', 'working_code'], requiresMedium: true },
  icici: { label: 'ICICI', credentials: ['merchant_id', 'enc_key'], requiresMedium: true },
  axis: { label: 'Axis', credentials: ['encryption_key', 'checksum_key', 'cid'], requiresMedium: false },
  aggre_pay: { label: 'Aggre Pay', credentials: ['api_key', 'salt_key'], requiresMedium: false },
  razorpay: { label: 'Razorpay', credentials: ['merchant_id', 'enc_key'], requiresMedium: false },
  payphi: { label: 'PayPhi', credentials: ['merchant_id', 'key'], requiresMedium: false },
};

const credentialLabels: Record<CredentialField, string> = {
  merchant_id: 'Merchant ID', account_name: 'Account name', access_code: 'Access code', working_code: 'Working code',
  enc_key: 'Encryption key', encryption_key: 'Encryption key', checksum_key: 'Checksum key', cid: 'CID',
  api_key: 'API key', salt_key: 'Salt key', key: 'Key',
};

export default function OnlineFeesSettingsPage() {
  const [rows, setRows] = useState<GatewayRow[]>([]);
  const [gateway, setGateway] = useState<GatewayName>('hdfc');
  const [credentials, setCredentials] = useState<Partial<Record<CredentialField, string>>>({});
  const [medium, setMedium] = useState('CBSE');
  const [feesType, setFeesType] = useState('fix');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const definition = gatewayDefinitions[gateway];
  const canAddGateway = rows.length === 0;
  const selectedCredentialFields = useMemo(() => definition.credentials, [definition]);

  const loadRows = async () => {
    setIsLoading(true);
    try {
      const session = getFeesSession();
      const params = new URLSearchParams({ path: 'fees/online_fees_settings_api', type: 'API' });
      const payload = await fetchLaravelJson<unknown>(session, `/api/proxy?${params.toString()}`);
      setRows(toGatewayRows(payload));
    } catch (error) {
      setRows([]);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load payment gateway settings.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void loadRows(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const resetForm = () => {
    setGateway('hdfc');
    setCredentials({});
    setMedium('CBSE');
    setFeesType('fix');
  };

  const openForm = () => {
    resetForm();
    setMessage(null);
    setIsFormOpen(true);
  };

  const saveGateway = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const missingField = selectedCredentialFields.find((field) => !credentials[field]?.trim());
    if (missingField) {
      setMessage({ type: 'error', text: `${credentialLabels[missingField]} is required.` });
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const session = getFeesSession();
      const body = new URLSearchParams({ type: 'API', map_company: gateway, fees_type: feesType });
      if (definition.requiresMedium) body.set('medium', medium);
      selectedCredentialFields.forEach((field) => body.set(field, credentials[field]?.trim() || ''));

      const payload = await fetchLaravelJson<{ message?: string; status?: string | number; status_code?: string | number }>(
        session,
        '/api/proxy?path=fees%2Fonline_fees_settings_api',
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
      );
      const status = String(payload.status ?? payload.status_code ?? '1');
      if (status !== '1') throw new Error(payload.message || 'Unable to save payment gateway settings.');

      setIsFormOpen(false);
      setMessage({ type: 'success', text: payload.message || 'Payment gateway saved.' });
      await loadRows();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save payment gateway settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteGateway = async (id: string) => {
    if (!window.confirm('Delete this payment gateway configuration?')) return;
    setDeletingId(id);
    setMessage(null);
    try {
      const session = getFeesSession();
      const payload = await fetchLaravelJson<{ message?: string; status?: string | number; status_code?: string | number }>(
        session,
        `/api/proxy?path=fees%2Fonline_fees_settings_api%2F${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      const status = String(payload.status ?? payload.status_code ?? '1');
      if (status !== '1') throw new Error(payload.message || 'Unable to delete payment gateway settings.');
      setMessage({ type: 'success', text: payload.message || 'Payment gateway deleted.' });
      await loadRows();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to delete payment gateway settings.' });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Online fees settings"
        description="Configure the payment gateway used by the online-fee collection flow."
        action={canAddGateway ? <Button type="button" onClick={openForm}><Plus className="h-4 w-4" />Add gateway</Button> : undefined}
      />
      {message && <InlineMessage type={message.type} text={message.text} />}
      {isFormOpen && (
        <SectionPanel title="Payment mapping" description="Fields and defaults follow the existing Laravel payment-mapping forms.">
          <form className="space-y-4" onSubmit={saveGateway}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Payment gateway"><NativeSelect value={gateway} onChange={(value) => setGateway(value as GatewayName)}>{Object.entries(gatewayDefinitions).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}</NativeSelect></Field>
              {selectedCredentialFields.map((field) => <Field key={field} label={credentialLabels[field]}><Input required type="password" value={credentials[field] || ''} onChange={(event) => setCredentials((current) => ({ ...current, [field]: event.target.value }))} /></Field>)}
              {definition.requiresMedium && <Field label="Medium"><NativeSelect value={medium} onChange={setMedium}><option value="CBSE">CBSE</option><option value="GSEB">GSEB</option></NativeSelect></Field>}
              <Field label="Fees collect type"><NativeSelect value={feesType} onChange={setFeesType}><option value="fix">Fix</option><option value="dynamic">Dynamic</option></NativeSelect></Field>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSaving}><X className="h-4 w-4" />Cancel</Button><Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save gateway</Button></div>
          </form>
        </SectionPanel>
      )}
      <SectionPanel title="Configured gateways">
        <Table className="min-w-[650px]"><TableHeader><TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100"><TableHead>Sr. no.</TableHead><TableHead>Academic year</TableHead><TableHead>Bank name</TableHead><TableHead>Collection link</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>
          {isLoading ? <LoadingRows colSpan={5} label="Loading payment gateways" /> : rows.length ? rows.map((row, index) => <TableRow key={row.id} className="odd:bg-white even:bg-slate-50/70"><TableCell>{index + 1}</TableCell><TableCell>{row.syear || '-'}</TableCell><TableCell className="font-medium">{row.bankName || '-'}</TableCell><TableCell><a className="text-sm font-medium text-[var(--primary-blue)] underline underline-offset-2" href="/fees/online_fees_collect" target="_blank" rel="noreferrer">Open collection page</a></TableCell><TableCell className="text-right"><Button type="button" size="icon-sm" variant="outline" aria-label={`Delete ${row.bankName || 'payment gateway'}`} disabled={deletingId === row.id} onClick={() => void deleteGateway(row.id)}>{deletingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></TableCell></TableRow>) : <EmptyTableRow colSpan={5} label="No payment gateway is configured." />}
        </TableBody></Table>
      </SectionPanel>
    </PageFrame>
  );
}

function toGatewayRows(value: unknown): GatewayRow[] {
  const payload = asRecord(value);
  return toArray(payload.data ?? value).map((item) => {
    const record = asRecord(item);
    return { id: readFirstString(record, ['id']), syear: readFirstString(record, ['syear']), bankName: readFirstString(record, ['bank_name']) };
  }).filter((row) => row.id);
}
