'use client';

import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';

import { Field, InlineMessage, PageFrame, PageHeader, SectionPanel } from '@/app/fees/_components/fees-shared';
import { appendSessionFormData, appendSessionParams, asRecord, fetchLaravelJson, getFeesSession, readFirstString, readString, toArray } from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';

const supportedGateways = new Set(['hdfc', 'axis', 'aggre_pay', 'icici', 'razorpay', 'payphi', 'hdfcrazorpay', 'icici_orange']);

type FeePreview = {
  error: string;
  feesType: string;
  currentYear: string;
  years: string[];
};

export default function OnlinePaymentPage() {
  const { gateway } = useParams<{ gateway: string }>();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('student_id') || '';
  const [preview, setPreview] = useState<FeePreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);

  const validGateway = supportedGateways.has(gateway);
  const gatewayLabel = useMemo(() => gateway.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), [gateway]);

  useEffect(() => {
    const loadPreview = async () => {
      if (!validGateway) {
        setMessage({ type: 'error', text: 'The selected payment gateway is not supported.' });
        setIsLoading(false);
        return;
      }
      if (!studentId) {
        setMessage({ type: 'error', text: 'Student information is missing. Start again from online fees collection.' });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setMessage(null);
      try {
        const session = getFeesSession();
        const params = new URLSearchParams({ path: `fees/online_fees_payment_api/${gateway}/preview`, student_id: studentId });
        appendSessionParams(params, session);
        // The legacy form does not submit a year here. Laravel determines the
        // student's active enrollment year; forwarding the UI year can point
        // it at a fee structure that does not belong to this student.
        params.delete('syear');
        const payload = await fetchLaravelJson<unknown>(session, `/api/proxy?${params.toString()}`);
        const record = asRecord(payload);
        const status = String(record.status ?? record.status_code ?? '1');
        if (status !== '1') throw new Error(readString(record.message) || 'Unable to load fee details.');
        setPreview(toFeePreview(record.data));
      } catch (error) {
        setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load fee details.' });
      } finally {
        setIsLoading(false);
      }
    };
    void loadPreview();
  }, [gateway, studentId, validGateway]);

  const continueToPayment = () => {
    if (!validGateway || !studentId) return;
    const session = getFeesSession();
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `/api/fees/online-payment/${encodeURIComponent(gateway)}`;
    const formData = new FormData();
    appendSessionFormData(formData, session);
    formData.set('student_id', studentId);
    formData.delete('syear');
    formData.forEach((value, name) => {
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = name; input.value = String(value); form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  };

  return <PageFrame>
    <PageHeader title={`Online payment · ${gatewayLabel}`} description="Review the available online fee collection before continuing to the configured payment gateway." />
    {message && <InlineMessage type={message.type} text={message.text} />}
    <SectionPanel title="Payment details">
      {isLoading ? <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Loading fee details</div> : preview && <div className="space-y-4"><div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><Detail label="Student ID" value={studentId} /><Detail label="Collection type" value={preview.feesType || '-'} /><Detail label="Academic year" value={preview.currentYear || '-'} /></div>{preview.error && <InlineMessage type="info" text={preview.error} />}<p className="text-sm text-slate-600">Continue to select the fee items and complete payment using {gatewayLabel}.</p><Button type="button" onClick={continueToPayment}><CreditCard className="h-4 w-4" />Continue to payment details</Button></div>}
    </SectionPanel>
  </PageFrame>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <Field label={label}><p className="min-h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900">{value}</p></Field>;
}

function toFeePreview(value: unknown): FeePreview {
  const record = asRecord(value);
  return {
    error: readFirstString(record, ['error']),
    feesType: readFirstString(record, ['fees_type']),
    currentYear: readFirstString(record, ['cur_year', 'syear']),
    years: toArray(record.dd_arr).map((year) => readString(year)).filter(Boolean),
  };
}
