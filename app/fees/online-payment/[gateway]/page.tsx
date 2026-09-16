'use client';

import { useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';

import { Field, InlineMessage, PageFrame, PageHeader, SectionPanel } from '@/app/fees/_components/fees-shared';
import { appendSessionFormData, appendSessionParams, asRecord, fetchLaravelJson, getFeesSession, readFirstString, readString, toArray } from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const supportedGateways = new Set(['hdfc', 'axis', 'aggre_pay', 'icici', 'razorpay', 'payphi', 'hdfcrazorpay', 'icici_orange']);

type FeePreview = {
  error: string;
  feesType: string;
  currentYear: string;
  years: string[];
  totalFees: FeeMonth[];
  student: Record<string, unknown>;
  months: Record<string, string>;
  searchIds: string[];
  finalFee: Record<string, string>;
};

type FeeMonth = {
  month: string;
  bk: string;
  paid: string;
  remain: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function OnlinePaymentPage() {
  const routeParams = useParams<{ gateway: string }>();
  const gateway = routeParams?.gateway ?? '';
  const searchParams = useSearchParams();
  const studentId = searchParams?.get('student_id') || '';
  const [preview, setPreview] = useState<FeePreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  const [showPaymentDetails, setShowPaymentDetails] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [payAmount, setPayAmount] = useState('');
  const [paymentOrder, setPaymentOrder] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (!paymentOrder?.order_id || !paymentOrder.key_id) return;

    const openCheckout = () => {
      if (!window.Razorpay) {
        setMessage({ type: 'error', text: 'Razorpay Checkout could not be loaded. Please try Pay now again.' });
        return;
      }

      const checkout = new window.Razorpay({
        key: paymentOrder.key_id,
        amount: Math.round(Number(paymentOrder.amount || payAmount) * 100),
        currency: 'INR',
        name: 'Fees payment',
        description: `Fees payment for ${paymentOrder.student_name || studentId}`,
        order_id: paymentOrder.order_id,
        prefill: { name: paymentOrder.student_name || '' },
        theme: { color: '#2563eb' },
      });
      checkout.open();
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
    if (existingScript) {
      if (window.Razorpay) openCheckout();
      else existingScript.addEventListener('load', openCheckout, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.addEventListener('load', openCheckout, { once: true });
    script.addEventListener('error', () => setMessage({ type: 'error', text: 'Razorpay Checkout could not be loaded.' }), { once: true });
    document.body.appendChild(script);
  }, [paymentOrder, payAmount, studentId]);

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
    if (!preview) return;
    const initialMonths = Object.keys(preview.months).filter((monthId) => {
      const row = preview.totalFees.find((item) => item.month === preview.months[monthId]);
      return row?.remain !== '0';
    });
    setSelectedMonths(initialMonths);
    setPayAmount(String(calculateMonthAmount(preview, initialMonths)));
    setShowPaymentDetails(true);
  };

  const submitPayment = () => {
    if (!preview || !payAmount || Number(payAmount) <= 0 || selectedMonths.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one fee month and enter a valid collection amount.' });
      return;
    }

    const session = getFeesSession();
    const formData = new FormData();
    appendSessionFormData(formData, session);
    formData.set('student_id', studentId);
    formData.set('total', payAmount);
    formData.set('pay_amount', payAmount);
    formData.set('standard_id', String(preview.student.std_id || ''));
    formData.set('grade_id', String(preview.student.grade_id || ''));
    formData.set('div_id', String(preview.student.div_id || ''));
    formData.delete('syear');
    selectedMonths.forEach((monthId) => formData.append(`months[${monthId}]`, monthId));
    setMessage(null);
    fetch(`/api/fees/online-payment/${encodeURIComponent(gateway)}`, { method: 'POST', body: formData })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || String(payload.status ?? '1') !== '1') {
          throw new Error(payload.message || 'Unable to start the payment.');
        }
        setPaymentOrder(payload.data || payload);
      })
      .catch((error) => setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to start the payment.' }));
  };

  return <PageFrame>
    <PageHeader title={`Online payment · ${gatewayLabel}`} description="Review the available online fee collection before continuing to the configured payment gateway." />
    {message && <InlineMessage type={message.type} text={message.text} />}
    <SectionPanel title={showPaymentDetails ? `Fees Collect - ${gatewayLabel}` : 'Payment details'}>
      {isLoading ? <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4" />Loading fee details</div> : preview && !showPaymentDetails ? <div className="space-y-4"><div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><Detail label="Student ID" value={studentId} /><Detail label="Collection type" value={preview.feesType || '-'} /><Detail label="Academic year" value={preview.currentYear || '-'} /></div>{preview.error && <InlineMessage type="info" text={preview.error} />}<Button type="button" onClick={continueToPayment}><CreditCard className="h-4 w-4" />Continue to payment details</Button></div> : null}
      {preview && showPaymentDetails ? <PaymentDetails preview={preview} selectedMonths={selectedMonths} setSelectedMonths={(months) => { setSelectedMonths(months); setPayAmount(String(calculateMonthAmount(preview, months))); }} payAmount={payAmount} setPayAmount={setPayAmount} onSubmit={submitPayment} paymentOrder={paymentOrder} /> : null}
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
    totalFees: Object.values(asRecord(record.total_fees)).map((item) => {
      const row = asRecord(item);
      return { month: readString(row.month), bk: readString(row.bk), paid: readString(row.paid), remain: readString(row.remain) };
    }),
    student: asRecord(record.stu_data),
    months: Object.fromEntries(Object.entries(asRecord(record.month_arr)).map(([key, value]) => [key, readString(value)])),
    searchIds: toArray(record.search_ids).map((value) => readString(value)),
    finalFee: Object.fromEntries(Object.entries(asRecord(record.final_fee)).map(([key, value]) => [key, readString(value)])),
  };
}

function PaymentDetails({
  preview,
  selectedMonths,
  setSelectedMonths,
  payAmount,
  setPayAmount,
  onSubmit,
  paymentOrder,
}: {
  preview: FeePreview;
  selectedMonths: string[];
  setSelectedMonths: (value: string[]) => void;
  payAmount: string;
  setPayAmount: (value: string) => void;
  onSubmit: () => void;
  paymentOrder: Record<string, string> | null;
}) {
  const student = preview.student;
  const monthRows = Object.entries(preview.months);

  return <div className="space-y-5">
    <div className="grid gap-5 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Fees structure</h3>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Month</th><th className="px-3 py-2 text-right">Fees</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">Remaining</th></tr></thead><tbody>{preview.totalFees.map((row) => <tr key={row.month} className="border-t border-slate-100"><td className="px-3 py-2">{row.month}</td><td className="px-3 py-2 text-right">{row.bk}</td><td className="px-3 py-2 text-right">{row.paid}</td><td className="px-3 py-2 text-right">{row.remain}</td></tr>)}</tbody></table>
        </div>
      </div>
      <div className="lg:col-span-3">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Fees collection</h3>
        <div className="grid gap-2 rounded-lg border border-slate-200 p-3 text-sm sm:grid-cols-2">
          <Detail label="Unique ID" value={readString(student.student_id)} /><Detail label="Student name" value={readString(student.name)} /><Detail label="Admission year" value={readString(student.admission)} /><Detail label="Parent email" value={readString(student.email)} /><Detail label="GR No." value={readString(student.enrollment)} /><Detail label="Std/Div" value={readString(student.stddiv)} /><Detail label="Contact No" value={readString(student.mobile)} /><Detail label="Pending fees" value={readString(student.pending)} />
        </div>
      </div>
    </div>
    <div className="border-t border-slate-200 pt-4">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Select fee months</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{monthRows.map(([id, label]) => {
        const row = preview.totalFees.find((item) => item.month === label);
        const disabled = row?.remain === '0';
        const checked = selectedMonths.includes(id);
        return <label key={id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${disabled ? 'bg-slate-50 text-slate-400' : 'border-slate-200'}`}><input type="checkbox" checked={checked || disabled} disabled={disabled} onChange={() => setSelectedMonths(checked ? selectedMonths.filter((item) => item !== id) : [...selectedMonths, id])} />{label}</label>;
      })}</div>
    </div>
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="mb-3 grid gap-2 sm:grid-cols-2">{Object.entries(preview.finalFee).map(([label, value]) => <div key={label} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{label}</span><strong>{value}</strong></div>)}</div>
      {preview.feesType !== 'fix' && <Field label="Collection amount"><Input type="number" min="1" max={preview.finalFee.Total} value={payAmount} onChange={(event) => setPayAmount(event.target.value)} /></Field>}
      <div className="mt-4 flex justify-end"><Button type="button" onClick={onSubmit} disabled={preview.error !== '' || Boolean(paymentOrder)}>Pay now <CreditCard className="h-4 w-4" /></Button></div>
      {paymentOrder ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Payment order created in the Next.js flow. Order ID: {paymentOrder.order_id || '-'}</div> : null}
      {preview.error && <p className="mt-2 text-right text-sm text-red-600">Please pay previous year fees first.</p>}
    </div>
  </div>;
}

function calculateMonthAmount(preview: FeePreview, monthIds: string[]) {
  return monthIds.reduce((total, monthId) => {
    const label = preview.months[monthId];
    const row = preview.totalFees.find((item) => item.month === label);
    return total + Number(row?.remain || 0);
  }, 0);
}
