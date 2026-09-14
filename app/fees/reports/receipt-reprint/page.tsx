'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Loader2, Printer } from 'lucide-react';

import {
  Field,
  InlineMessage,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import { fetchReceiptReprintGet, type ReportApiPayload, type ReportMessage } from '@/app/fees/_lib/fees-report-utils';
import { getFeesSession, readString } from '@/app/fees/_lib/fees-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type ReceiptReprintPayload = ReportApiPayload & {
  data?: { pdf_url?: string; receipt_no?: string } | null;
};

export default function ReceiptReprintPage() {
  const session = useMemo(() => getFeesSession(), []);

  const [studentId, setStudentId] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [subInstituteId, setSubInstituteId] = useState(session.subInstituteId);
  const [syear, setSyear] = useState(session.academicYearId);
  const [action, setAction] = useState<'fees_re_receipt' | 'other_fees_re_receipt'>('fees_re_receipt');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<ReportMessage | null>(null);
  const [result, setResult] = useState<{ pdfUrl: string; receiptNo: string } | null>(null);

  const canSubmit = studentId.trim() && receiptId.trim() && subInstituteId.trim() && syear.trim();

  const handleReprint = async () => {
    if (!canSubmit) {
      setMessage({ type: 'error', text: 'Student ID, receipt number, sub institute, and year are all required.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    setResult(null);
    try {
      const params = new URLSearchParams();
      params.set('student_id', studentId.trim());
      params.set('receipt_id_html', receiptId.trim());
      params.set('sub_institute_id', subInstituteId.trim());
      params.set('syear', syear.trim());
      params.set('action', action);

      const { payload } = await fetchReceiptReprintGet<ReceiptReprintPayload>(params);
      const pdfUrl = readString(payload.data?.pdf_url);
      const receiptNo = readString(payload.data?.receipt_no);

      if (!pdfUrl) {
        setMessage({ type: 'error', text: payload.message || 'Receipt not found for the given details.' });
        return;
      }

      setResult({ pdfUrl, receiptNo });
      setMessage({ type: 'success', text: `Receipt ${receiptNo || receiptId} is ready to view or print.` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to reprint this receipt.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageFrame>
      <PageHeader
        title="Receipt reprint"
        description="Regenerate a PDF of a previously issued receipt from its stored data. This does not create a new receipt, change any amount, or touch the ledger — it re-renders the exact HTML captured at collection time."
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Receipt details">
        <div className="grid gap-3 lg:grid-cols-3">
          <Field label="Receipt type">
            <select
              value={action}
              onChange={(event) => setAction(event.target.value as typeof action)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[var(--primary-blue)] focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="fees_re_receipt">Regular fees receipt</option>
              <option value="other_fees_re_receipt">Other fees receipt</option>
            </select>
          </Field>
          <Field label="Student ID">
            <Input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="e.g. 195283" />
          </Field>
          <Field label="Receipt number">
            <Input value={receiptId} onChange={(event) => setReceiptId(event.target.value)} placeholder="Receipt no. shown on the original receipt" />
          </Field>
          <Field label="Sub institute ID">
            <Input value={subInstituteId} onChange={(event) => setSubInstituteId(event.target.value)} />
          </Field>
          <Field label="Academic year">
            <Input value={syear} onChange={(event) => setSyear(event.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button type="button" className="h-10 w-full" onClick={handleReprint} disabled={loading || !canSubmit}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Reprint receipt
            </Button>
          </div>
        </div>

        {result && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-sm text-slate-700">
              Receipt <span className="font-mono font-semibold">{result.receiptNo || receiptId}</span> regenerated.
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => window.open(result.pdfUrl, '_blank', 'noopener,noreferrer')}>
              <ExternalLink className="h-4 w-4" />
              Open PDF
            </Button>
          </div>
        )}
      </SectionPanel>
    </PageFrame>
  );
}
