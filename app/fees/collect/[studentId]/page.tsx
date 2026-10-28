'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { useRegisterPageAiContext } from '@/contexts/PageAiContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FeesAiAssist } from '@/app/fees/_components/fees-ai-assist';
import { logFeesOperation } from '@/lib/fees/fees-ai-stack';
import { sanitizeHtml } from '@/lib/security/sanitize-html';

type SessionContext = {
  token: string;
  subInstituteId: string;
  userId: string;
  academicYearId: string;
  hostName: string;
};

type StudentInfo = {
  uniqueId: string;
  studentName: string;
  grNo: string;
  admissionYear: string;
  standardDivision: string;
  fatherName: string;
  contactNumber: string;
  parentEmail: string;
  studentQuota: string;
  pendingFees: number;
};

type SummaryRow = {
  label: string;
  fees: number;
  paid: number;
  discount: number;
  remaining: number;
};

type FeeParticular = {
  id: string;
  particular: string;
  amount: number;
  collectionAmount: number;
};

type FeeMonth = {
  id: string;
  label: string;
  particulars: FeeParticular[];
};

type SelectOption = {
  id: string;
  label: string;
};

type CollectionResponse = {
  [key: string]: unknown;
  student?: unknown;
  stu_data?: unknown;
  fee_summary?: unknown;
  summary?: unknown;
  total_fees?: unknown;
  final_fee?: unknown;
  final_fee_name?: unknown;
  unpaid_months?: unknown;
  months?: unknown;
  banks?: unknown;
  bank_data?: unknown;
  payment_modes?: unknown;
  cheque_return_charges?: unknown;
  data?: {

    [key: string]: unknown;
    student?: unknown;
    stu_data?: unknown;
    fee_summary?: unknown;
    summary?: unknown;
    total_fees?: unknown;
    final_fee?: unknown;
    final_fee_name?: unknown;
    unpaid_months?: unknown;
    months?: unknown;
    banks?: unknown;
    bank_data?: unknown;
    payment_modes?: unknown;
    cheque_return_charges?: unknown;
  };
  message?: string;
};

type ReceiptResponse = {
  data?: unknown;
  paper?: string;
  css?: string;
  html?: unknown;
  receipt?: unknown;
  receipt_html?: unknown;
  message?: string;
};

export default function FeesCollectionStudentPage() {
  const router = useRouter();
  const params = useParams<{ studentId: string }>();
  const studentId = params?.studentId;
  const [session] = useState(getSessionContext);
  const printCompletionHandledRef = useRef(false);

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [months, setMonths] = useState<FeeMonth[]>([]);
  const [banks, setBanks] = useState<SelectOption[]>([]);
  const [paymentModes, setPaymentModes] = useState<SelectOption[]>([]);
  const [selectedMonthIds, setSelectedMonthIds] = useState<string[]>([]);
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [discount, setDiscount] = useState(0);
  const [fine, setFine] = useState(0);
  const [paymentMode, setPaymentMode] = useState('');
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [chequeDate, setChequeDate] = useState('');
  const [transactionNo, setTransactionNo] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [sendSms, setSendSms] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectionData, setCollectionData] = useState<CollectionResponse | null>(null);
  const [receiptHtml, setReceiptHtml] = useState('');
  const [printReceiptOnLoad, setPrintReceiptOnLoad] = useState(false);
  const [printViewOpen, setPrintViewOpen] = useState(false);

  /*
   * Tell the assistant which student this is and what their fee position looks like.
   *
   * The route already maps to the student entity, so the assistant knew *who* before
   * this. What it did not know was the figures on screen, which is the difference
   * between "I can look that up" and answering "why does this balance look wrong?"
   * about the balance the user is pointing at.
   *
   * Only settled figures are registered — the summary rows and the pending total, all
   * of which came from the backend. Nothing in the unsaved payment form is included:
   * a discount the user is midway through typing is not a fact about the record.
   */
  useRegisterPageAiContext(
    useMemo(
      () =>
        student
          ? {
              pageTitle: 'Fee collection',
              pageType: 'detail' as const,
              entityType: 'student',
              entityId: studentId,
              metrics: [
                { key: 'pending_fees', label: 'Outstanding fees', value: student.pendingFees, unit: 'INR' },
                ...summaryRows.map((row) => ({
                  key: `remaining_${row.label.toLowerCase().replace(/\s+/g, '_')}`,
                  label: `${row.label} remaining`,
                  value: row.remaining,
                  unit: 'INR',
                })),
              ],
              availableActions: [
                { key: 'collect_fees', label: 'Collect a fee payment' },
                { key: 'apply_discount', label: 'Apply a discount or fine' },
                { key: 'print_receipt', label: 'Print a receipt' },
              ],
            }
          : null,
      [student, studentId, summaryRows]
    )
  );

  const clearCollectionData = useCallback((message: string) => {
    setStudent(null);
    setSummaryRows([]);
    setMonths([]);
    setBanks([]);
    setPaymentModes([]);
    setCollectionData(null);
    setReceiptHtml('');
    setPrintReceiptOnLoad(false);
    setPrintViewOpen(false);
    setSelectedMonthIds([]);
    setExpandedMonthId(null);
    setError(message);
    setLoading(false);
  }, []);

  const applyCollectionData = useCallback((payload: CollectionResponse) => {
    const source = payload.data ?? payload;
    const loadedMonths = toMonths(
      source.total_fees ?? source.unpaid_months ?? source.months,
      source.final_fee,
      source.final_fee_name
    );
    const bankOptions = toOptions(source.bank_data ?? source.banks);
    const savedBankId = resolveSelectedBankId(
      source.bank_id
        ?? source.bankId
        ?? source.bank_name
        ?? source.bankName
        ?? source.bank,
      bankOptions,
      source.bank_name ?? source.bankName
    );
    const savedPaymentMode = readString(source.payment_mode ?? source.PAYMENT_MODE ?? source.mode);
    const savedReceiptDate = toInputDateString(source.receiptdate ?? source.receipt_date ?? source.receiptDate);
    const savedChequeDate = toInputDateString(source.cheque_date ?? source.chequeDate);
    const savedTransactionNo = readString(
      source.cheque_no
        ?? source.chequeNo
        ?? source.transaction_no
        ?? source.transactionNo
        ?? source.reference_no
        ?? source.referenceNo
    );
    const savedBankBranch = readString(source.bank_branch ?? source.bankBranch ?? source.branch);
    const savedRemarks = readString(source.remarks ?? source.note ?? source.description);

    setStudent(toStudentInfo(source.stu_data ?? source.student));
    setSummaryRows(toSummaryRows(source.total_fees ?? source.fee_summary ?? source.summary));
    setMonths(loadedMonths);
    setBanks(bankOptions);
    setPaymentModes(toPaymentModes(source.payment_modes));
    setSelectedMonthIds(loadedMonths.map((month) => month.id));
    setExpandedMonthId(loadedMonths[0]?.id ?? null);
    setPaymentMode(savedPaymentMode || toPaymentModes(source.payment_modes)[0]?.id || '');
    setSelectedBankId(savedBankId);
    setBankBranch(savedBankBranch);
    setTransactionNo(savedTransactionNo);
    setRemarks(savedRemarks);
    setReceiptDate(savedReceiptDate || new Date().toISOString().slice(0, 10));
    setChequeDate(savedChequeDate);
    setCollectionData(source as CollectionResponse);
    setReceiptHtml('');
    setPrintReceiptOnLoad(false);
    setPrintViewOpen(false);
  }, []);

  const loadFees = useCallback(async () => {
    if (!studentId || !session.subInstituteId) {
      clearCollectionData('Student or session data is missing.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (typeof window !== 'undefined') {
        const cachedPayload = sessionStorage.getItem(`feesCollectData:${studentId}`);
        if (cachedPayload) {
          sessionStorage.removeItem(`feesCollectData:${studentId}`);
          applyCollectionData(JSON.parse(cachedPayload) as CollectionResponse);
          return;
        }
      }

      const apiBaseUrl = (session.hostName || API_BASE_URL || '').replace(/\/$/, '');
      if (!apiBaseUrl || !session.academicYearId) {
        throw new Error('Session API details are missing.');
      }

      const params = new URLSearchParams({
        sub_institute_id: session.subInstituteId,
        syear: session.academicYearId,
        type: 'API',
      });

      const response = await fetch(`${apiBaseUrl}/fees/fees_collect/${encodeURIComponent(studentId)}/edit?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
      });

      const payload = (await response.json()) as CollectionResponse;
      if (!response.ok) {
        throw new Error(payload.message || "Couldn't load fee collection data. Try again.");
      }

      applyCollectionData(payload);
    } catch (fetchError) {
      clearCollectionData(fetchError instanceof Error ? fetchError.message : "Couldn't load fee collection data. Try again.");
    } finally {
      setLoading(false);
    }
  }, [applyCollectionData, clearCollectionData, session, studentId]);

  useEffect(() => {
    // The detail page loads once after route params and browser session storage are available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFees();
  }, [loadFees]);

  const selectedParticulars = useMemo(() => {
    return months
      .filter((month) => selectedMonthIds.includes(month.id))
      .flatMap((month) => month.particulars.map((particular) => ({ ...particular, monthId: month.id })));
  }, [months, selectedMonthIds]);

  const groupedParticulars = useMemo(() => {
    const grouped = new Map<string, { id: string; particular: string; amount: number; collectionAmount: number }>();
    selectedParticulars.forEach((item) => {
      const current = grouped.get(item.id);
      grouped.set(item.id, {
        id: item.id,
        particular: item.particular,
        amount: (current?.amount ?? 0) + item.amount,
        collectionAmount: (current?.collectionAmount ?? 0) + item.collectionAmount,
      });
    });
    return [...grouped.values()];
  }, [selectedParticulars]);

  const totalAmount = selectedParticulars.reduce((total, item) => total + item.collectionAmount, 0);
  const grandTotal = Math.max(totalAmount - discount + fine, 0);
  const isCashPayment = paymentMode.trim().toLowerCase() === 'cash';
  const showBankFields = Boolean(paymentMode) && !isCashPayment;
  const showBranch = showBankFields;
  const totalSummaryFees = summaryRows.reduce((total, row) => total + row.fees, 0);
  const totalSummaryPaid = summaryRows.reduce((total, row) => total + row.paid, 0);
  const totalSummaryDiscount = summaryRows.reduce((total, row) => total + row.discount, 0);
  const totalSummaryRemaining = summaryRows.reduce((total, row) => total + row.remaining, 0);
  const selectedBankName = useMemo(() => {
    const selectedBank = banks.find((bank) => bank.id === selectedBankId);
    return selectedBank?.label ?? '';
  }, [banks, selectedBankId]);
  const printableReceiptHtml = useMemo(
    () => sanitizeHtml(normalizeReceiptHtml(receiptHtml, selectedBankId, selectedBankName), { document: true }),
    [receiptHtml, selectedBankId, selectedBankName]
  );

  const returnToCollectDashboard = useCallback(() => {
    if (printCompletionHandledRef.current) return;
    printCompletionHandledRef.current = true;
    setPrintReceiptOnLoad(false);
    setPrintViewOpen(false);
    setReceiptHtml('');
    router.replace(`/fees/collect?refresh=${Date.now()}`);
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined' || !printViewOpen) return undefined;

    const handleAfterPrint = () => {
      returnToCollectDashboard();
    };

    window.addEventListener('afterprint', handleAfterPrint);

    const mediaQueryList = window.matchMedia('print');
    const handleMediaQueryChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        handleAfterPrint();
      }
    };

    mediaQueryList.addEventListener?.('change', handleMediaQueryChange);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      mediaQueryList.removeEventListener?.('change', handleMediaQueryChange);
    };
  }, [printViewOpen, returnToCollectDashboard]);

  useEffect(() => {
    if (typeof window === 'undefined' || !printViewOpen || !printReceiptOnLoad || !printableReceiptHtml) return undefined;

    const printTimer = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        setPrintReceiptOnLoad(false);
        window.print();
      });
    }, 180);

    return () => window.clearTimeout(printTimer);
  }, [printReceiptOnLoad, printViewOpen, printableReceiptHtml]);

  // One amount per fee head: spread the typed total over the selected months, capped at each month's due.
  const handleHeadAmountChange = (particularId: string, amount: number) => {
    setMonths((currentMonths) => {
      let remaining = Math.max(amount, 0);
      return currentMonths.map((month) => {
        if (!selectedMonthIds.includes(month.id)) return month;
        return {
          ...month,
          particulars: month.particulars.map((particular) => {
            if (particular.id !== particularId) return particular;
            const applied = Math.min(remaining, particular.amount);
            remaining -= applied;
            return { ...particular, collectionAmount: applied };
          }),
        };
      });
    });
  };

  const toggleMonth = (monthId: string, checked: boolean) => {
    setSelectedMonthIds((current) => checked ? [...new Set([...current, monthId])] : current.filter((id) => id !== monthId));
  };

  const saveCollection = async (printReceipt: boolean) => {
    if (!session.subInstituteId) {
      router.push('/fees/collect');
      return;
    }

    setError(null);

    if (selectedMonthIds.length === 0 || selectedParticulars.length === 0 || totalAmount <= 0) {
      setError('Select at least one fee month with an amount to collect.');
      return;
    }
    if (selectedParticulars.some((particular) => particular.collectionAmount > particular.amount)) {
      setError('A collection amount cannot be greater than its original fee amount.');
      return;
    }
    if (!paymentMode) {
      setError('Select a payment mode.');
      return;
    }
    if (!receiptDate) {
      setError('Select a receipt date.');
      return;
    }
    if (!isCashPayment && (!chequeDate || !transactionNo.trim() || !selectedBankId || !bankBranch.trim())) {
      setError('Cheque/DD date, reference number, bank name, and bank branch are required for non-cash payments.');
      return;
    }

    setSaving(true);

    try {
      const apiBaseUrl = (session.hostName || API_BASE_URL || '').replace(/\/$/, '');
      if (!apiBaseUrl || !session.academicYearId) {
        throw new Error('Session API details are missing.');
      }

      const source = collectionData ?? {};
      const studentRecord = asRecord(source.stu_data ?? source.student);
      const chequeReturnCharges = toNumberArray(source.cheque_return_charges).reduce((total, item) => total + item, 0);
      const form = new FormData();
      const fullName = readString(studentRecord.name) || [
        studentRecord.first_name,
        studentRecord.middle_name,
        studentRecord.last_name,
      ].map(readString).filter(Boolean).join(' ');

      form.append('grade_id', readString(studentRecord.grade_id));
      form.append('standard_id', readString(studentRecord.standard_id ?? studentRecord.std_id));
      form.append('div_id', readString(studentRecord.div_id ?? studentRecord.division_id));
      form.append('student_id', readString(studentRecord.student_id ?? studentId));
      form.append('std_div', readString(studentRecord.stddiv ?? student?.standardDivision));
      form.append('full_name', fullName || readString(student?.studentName));
      form.append('mobile', readString(studentRecord.mobile ?? student?.contactNumber));
      form.append('uniqueid', readString(studentRecord.uniqueid ?? studentRecord.unique_id ?? student?.uniqueId));
      form.append('enrollment', readString(studentRecord.enrollment ?? student?.grNo));
      form.append('roll_no', readString(studentRecord.roll_no));
      form.append('medium', readString(studentRecord.medium));
      form.append('first_name', readString(studentRecord.first_name));
      form.append('middle_name', readString(studentRecord.middle_name));
      form.append('last_name', readString(studentRecord.last_name));
      form.append('father_name', readString(studentRecord.father_name ?? student?.fatherName));
      form.append('mother_name', readString(studentRecord.mother_name));
      form.append('student_batch', readString(studentRecord.student_batch));
      form.append('pan_card', readString(studentRecord.pan_card));

      selectedMonthIds.forEach((monthId) => {
        form.append(`months[${monthId}]`, monthId);
      });

      const particularTotals = new Map<string, { collectionAmount: number; amount: number }>();
      selectedParticulars.forEach((particular) => {
        if (particular.collectionAmount <= 0) return;

        const current = particularTotals.get(particular.id) ?? { collectionAmount: 0, amount: 0 };
        particularTotals.set(particular.id, {
          collectionAmount: current.collectionAmount + particular.collectionAmount,
          amount: current.amount + particular.amount,
        });
      });

      particularTotals.forEach((particular, particularId) => {
        form.append(`fees_data[${particularId}]`, String(particular.collectionAmount));
        form.append(`hid_fees_data[${particularId}]`, String(particular.amount));
      });

      form.append('total', String(totalAmount));
      form.append('totalFin', String(fine));
      form.append('remarks', remarks);
      form.append('totalDis', String(discount));
      form.append('hidden_cheque_return_charges', String(chequeReturnCharges));
      form.append('PAYMENT_MODE', paymentMode);
      form.append('receiptdate', receiptDate);
      form.append('cheque_date', chequeDate || receiptDate);
      form.append('cheque_no', showBankFields ? transactionNo : '');
      form.append('bank_id', showBankFields ? selectedBankId : '');
      form.append('bank_name', showBankFields ? selectedBankName : '');
      form.append('bank_branch', showBranch ? bankBranch : 'N/A');
      if (sendSms) form.append('send_sms', 'on');
      form.append('submit', 'Save');
      form.append('sub_institute_id', session.subInstituteId);
      form.append('syear', session.academicYearId);
      form.append('type', 'API');

      const response = await fetch(`${apiBaseUrl}/fees/fees_collect`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
        },
        body: form,
      });

      const responseText = await response.text();
      const payload = parseJsonResponse(responseText) as ReceiptResponse;
      if (!response.ok) {
        throw new Error(payload.message || "Couldn't save fee collection. Try again.");
      }

      // Laravel answers 200 with status "0" when it inserted nothing; that is a failure, not a receipt.
      if (String(asRecord(payload).status ?? '') === '0') {
        throw new Error(readString(asRecord(payload).message) || "Couldn't save fee collection. Try again.");
      }

      // The money is taken and the receipt exists by this point. Recording is
      // fire-and-forget on purpose: a busy audit table must never cost a parent their
      // receipt, so this returns nothing to await and swallows its own failures.
      logFeesOperation('fee_collection', {
        status: 'completed',
        message: `Collected ${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(totalAmount)} from ${student?.studentName ?? 'a student'}.`,
        studentId: Number(studentId) || null,
        studentName: student?.studentName ?? null,
        reference: readString(asRecord(payload).receipt_no ?? asRecord(payload).receiptno) || null,
        workflow: 'fees.collect',
        result: {
          total: totalAmount,
          discount,
          fine,
          payment_mode: paymentMode,
          receipt_date: receiptDate,
          months: selectedMonthIds.length,
          sms_requested: sendSms,
          remarks_present: remarks.trim() !== '',
        },
      });

      if (printReceipt) {
        const html = extractReceiptHtml(payload, responseText);
        if (!html) {
          throw new Error('Fee collection saved, but receipt HTML was not found in the API response.');
        }

        printCompletionHandledRef.current = false;
        setReceiptHtml(html);
        setPrintViewOpen(true);
        setPrintReceiptOnLoad(true);
        return;
      }

      router.replace('/fees/collect');
    } catch (saveError) {
      console.error('Fee collection save failed', saveError);
      setError(saveError instanceof Error ? saveError.message : "Couldn't save fee collection. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/70 p-6">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-[#0D6EFD]" />
          Loading fee collection data...
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/70 p-6">
        <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <Button type="button" variant="outline" size="sm" className="mb-4 rounded-lg bg-white" onClick={() => router.push('/fees/collect')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to collect
          </Button>
          <h1 className="text-lg font-bold text-slate-950">Couldn't load fee collection</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {error || "Couldn't load fee collection data for this student. Try again."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <div data-print-exclude="true" className="mx-auto max-w-[1500px] space-y-4 p-3 sm:p-4 md:p-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-md bg-white" onClick={() => router.push('/fees/collect')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-semibold text-slate-900">Fees Collect</h1>
        </div>

        {error && <div className="rounded-md border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        {printableReceiptHtml && !printViewOpen && (
          <div className="rounded-md border border-emerald-200 bg-white">
            <div className="border-b border-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-800">Receipt preview</div>
            <div className="overflow-x-auto bg-slate-50 p-4">
              <div className="mx-auto min-w-[720px] max-w-[900px] bg-white p-4" dangerouslySetInnerHTML={{ __html: printableReceiptHtml }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-900 lg:grid-cols-3">
          {/* Fees Structure */}
          <div className="min-w-0">
            <h2 className="mb-2 font-semibold">Fees Structure</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="px-2 py-2 font-semibold">Month</th>
                    <th className="px-2 py-2 font-semibold">Fees</th>
                    <th className="px-2 py-2 font-semibold">Paid</th>
                    <th className="px-2 py-2 font-semibold">Discount</th>
                    <th className="px-2 py-2 font-semibold">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row, index) => (
                    <tr key={`${row.label}-${index}`} className="border-b border-slate-100">
                      <td className="px-2 py-2">{row.label}</td>
                      <td className="px-2 py-2">{row.fees}</td>
                      <td className="px-2 py-2">{row.paid + row.discount}</td>
                      <td className="px-2 py-2">{row.discount}</td>
                      <td className="px-2 py-2">{row.remaining}</td>
                    </tr>
                  ))}
                  {summaryRows.length === 0 && (
                    <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-500">Fee summary is not available.</td></tr>
                  )}
                  {summaryRows.length > 0 && (
                    <tr className="font-semibold">
                      <td className="px-2 py-2">Total</td>
                      <td className="px-2 py-2">{totalSummaryFees}</td>
                      <td className="px-2 py-2">{totalSummaryPaid + totalSummaryDiscount}</td>
                      <td className="px-2 py-2">{totalSummaryDiscount}</td>
                      <td className="px-2 py-2">{totalSummaryRemaining}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fees Collection */}
          <div className="min-w-0 lg:col-span-2">
            <h2 className="mb-2 font-semibold">Fees Collection</h2>

            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              <table className="w-full text-left">
                <tbody>
                  <InfoRow label="Unique ID" value={student.uniqueId} />
                  <InfoRow label="Student Name" value={student.studentName} />
                  <InfoRow label="Admission Year" value={student.admissionYear} />
                  <InfoRow label="Father Name" value={student.fatherName} />
                  <InfoRow label="Student Quota" value={student.studentQuota} />
                </tbody>
              </table>
              <table className="w-full text-left">
                <tbody>
                  <InfoRow label="GR No." value={student.grNo} />
                  <InfoRow label="Standard / Division" value={student.standardDivision} />
                  <InfoRow label="Contact No" value={student.contactNumber} />
                  <InfoRow label="Parent Email" value={student.parentEmail} />
                  <InfoRow label="Pending Fees" value={String(student.pendingFees)} className="text-red-600" />
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t-2 border-slate-900 pt-3 sm:grid-cols-3 lg:grid-cols-6">
              {months.map((month) => (
                <label key={month.id} className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={selectedMonthIds.includes(month.id)} onChange={(event) => toggleMonth(month.id, event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0D6EFD]" />
                  {month.label}
                </label>
              ))}
              {months.length === 0 && <p className="col-span-full text-slate-500">No unpaid fee months available.</p>}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[460px] text-left">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="px-2 py-2 font-semibold">Particular</th>
                    <th className="px-2 py-2 font-semibold">Amount</th>
                    <th className="px-2 py-2 font-semibold">Collection Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedParticulars.map((particular) => (
                    <tr key={particular.id} className="border-b border-slate-100">
                      <td className="px-2 py-2">{particular.particular}</td>
                      <td className="px-2 py-2">{particular.amount}</td>
                      <td className="px-2 py-2">
                        <Input
                          type="number"
                          min="0"
                          max={particular.amount}
                          value={particular.collectionAmount}
                          onChange={(event) => handleHeadAmountChange(particular.id, readNumber(event.target.value))}
                          className="h-9 max-w-[200px] rounded-md border-slate-300 bg-white text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-slate-300 font-semibold">
                    <td className="px-2 py-2">Total</td>
                    <td className="px-2 py-2">{groupedParticulars.reduce((total, item) => total + item.amount, 0)}</td>
                    <td className="px-2 py-2">{totalAmount}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto_1fr] md:items-center">
              <span>Remarks</span>
              <div className="md:col-span-3">
                <Input value={remarks} onChange={(event) => setRemarks(event.target.value)} autoComplete="off" className="h-9 rounded-md border-slate-300 bg-white text-sm" />
                {/* Generative AI on the one free-text field in this form. The prompt,
                    the policy check and the usage record all come from the Fees AI
                    Stack; this screen only supplies the fee data and receives text. */}
                <FeesAiAssist
                  className="mt-2"
                  operation="remarks_drafted"
                  label="Draft remarks with AI"
                  student={{ id: Number(studentId) || null, name: student?.studentName ?? null }}
                  variables={{
                    student_name: student?.studentName ?? '',
                    standard_division: student?.standardDivision ?? '',
                    enrollment_no: student?.grNo ?? '',
                    total_amount: totalAmount,
                    discount,
                    fine,
                    payment_mode: paymentMode,
                    receipt_date: receiptDate,
                    pending_fees: student?.pendingFees ?? 0,
                  }}
                  onInsert={(text) => setRemarks(text)}
                />
              </div>

              <span>Discount</span>
              <Input type="number" min="0" value={discount} onChange={(event) => setDiscount(readNumber(event.target.value))} className="h-9 rounded-md border-slate-300 bg-white text-sm md:col-span-3 md:max-w-[240px]" />

              <span>Fine (Include Cheque return charges)</span>
              <Input type="number" min="0" value={fine} onChange={(event) => setFine(readNumber(event.target.value))} className="h-9 rounded-md border-slate-300 bg-white text-sm md:col-span-3 md:max-w-[240px]" />

              <span className="font-semibold">Grand Total</span>
              <Input value={grandTotal} readOnly className="h-9 rounded-md border-slate-300 bg-slate-50 text-sm font-semibold md:col-span-3 md:max-w-[240px]" />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 border-t-2 border-slate-900 pt-3 sm:grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto_1fr] md:items-center">
              <span>Payment Mode</span>
              <Select value={paymentMode} onValueChange={(value) => setPaymentMode(value ?? '')}>
                <SelectTrigger className="h-9 w-full rounded-md border-slate-300 bg-white text-sm">
                  <SelectValue placeholder="Select Payment Mode" />
                </SelectTrigger>
                <SelectContent>
                  {paymentModes.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id}>{mode.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>Receipt Date</span>
              <Input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} className="h-9 rounded-md border-slate-300 bg-white text-sm" />

              {showBankFields && (
                <>
                  <span>Cheque/DD Date</span>
                  <Input type="date" value={chequeDate} onChange={(event) => setChequeDate(event.target.value)} className="h-9 rounded-md border-slate-300 bg-white text-sm" />
                  <span>Cheque/DD No/Transaction No</span>
                  <Input value={transactionNo} onChange={(event) => setTransactionNo(event.target.value)} className="h-9 rounded-md border-slate-300 bg-white text-sm" />
                  <span>Bank Name</span>
                  <Select value={selectedBankId} onValueChange={(value) => setSelectedBankId(value ?? '')}>
                    <SelectTrigger className="h-9 w-full rounded-md border-slate-300 bg-white text-sm">
                      <SelectValue placeholder="Select Bank Name">
                        {selectedBankName || 'Select Bank Name'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank) => (
                        <SelectItem key={bank.id} value={bank.id}>{bank.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>Bank Branch</span>
                  <Input value={bankBranch} onChange={(event) => setBankBranch(event.target.value)} className="h-9 rounded-md border-slate-300 bg-white text-sm" />
                </>
              )}

              <span>Send SMS</span>
              <input type="checkbox" checked={sendSms} onChange={(event) => setSendSms(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0D6EFD]" />
            </div>

            <div className="mt-5 flex justify-center gap-2 border-t-2 border-slate-900 pt-4">
              <Button type="button" variant="outline" className="h-10 rounded-md bg-white" onClick={() => router.push('/fees/collect')} disabled={saving}>Cancel</Button>
              <Button type="button" className="h-10 rounded-md bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => saveCollection(true)} disabled={saving || selectedMonthIds.length === 0}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                Save &amp; Print Receipt
              </Button>
            </div>
          </div>
        </div>
      </div>

      {printViewOpen && printableReceiptHtml ? (
        <div data-print-receipt="true" className="fixed inset-0 z-[100] overflow-auto bg-white p-4 sm:p-6">
          <div data-print-receipt-container="true" className="mx-auto max-w-[900px] bg-white">
            <div dangerouslySetInnerHTML={{ __html: printableReceiptHtml }} />
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        @media print {
          html, body {
            background: #ffffff !important;
          }

          body * {
            visibility: hidden;
          }

          [data-print-receipt="true"],
          [data-print-receipt="true"] * {
            visibility: visible;
          }

          [data-print-exclude="true"] {
            display: none !important;
          }

          [data-print-receipt="true"] {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
          }

          [data-print-receipt-container="true"] {
            max-width: 100% !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

function InfoRow({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  return (
    <tr className="border-b border-slate-100">
      <td className={`px-2 py-2 ${className}`}>{label}</td>
      <td className={`px-2 py-2 ${className}`}>{value || '-'}</td>
    </tr>
  );
}

function getSessionContext(): SessionContext {
  if (typeof window === 'undefined') {
    return { token: '', subInstituteId: '', userId: '', academicYearId: '', hostName: '' };
  }

  try {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}') as Record<string, unknown>;
    const menuContext = JSON.parse(localStorage.getItem('menuContext') || '{}') as Record<string, unknown>;

    return {
      token: readString(userData.user_token ?? userData.token),
      subInstituteId: readString(userData.sub_institute_id ?? menuContext.sub_institute_id),
      userId: readString(userData.user_id ?? menuContext.user_id),
      academicYearId: readString(localStorage.getItem('selectedAcademicYear') || (userData.academic_year_id ?? userData.academicYearId)),
      hostName: readString(userData.host_name),
    };
  } catch {
    return { token: '', subInstituteId: '', userId: '', academicYearId: '', hostName: '' };
  }
}

function toStudentInfo(value: unknown): StudentInfo {
  const record = asRecord(value);

  return {
    uniqueId: readString(record.uniqueid ?? record.unique_id ?? record.uniqueId ?? record.id ?? record.student_id),
    studentName: readString(record.student_name ?? record.name ?? record.full_name),
    grNo: readString(record.gr_no ?? record.grNo ?? record.gr_number ?? record.enrollment_no ?? record.enrollment),
    admissionYear: readString(record.admission_year ?? record.admissionYear ?? record.admission),
    standardDivision: readString(record.stddiv ?? record.standard_division ?? record.standardDivision ?? [record.standard_name ?? record.standard, record.division_name ?? record.division].filter(Boolean).join(' / ')),
    fatherName: readString(record.father_name ?? record.fatherName),
    contactNumber: readString(record.contact_number ?? record.mobile ?? record.phone),
    parentEmail: readString(record.parent_email ?? record.email),
    studentQuota: readString(record.student_quota ?? record.quota),
    pendingFees: readNumber(record.pending_fees ?? record.pendingFees ?? record.pending ?? record.remaining ?? record.balance),
  };
}

function toSummaryRows(value: unknown): SummaryRow[] {
  if (Array.isArray(value)) {
    return value.map(toSummaryRow);
  }

  const record = asRecord(value);
  const objectRows = Object.values(record).filter((item) => item && typeof item === 'object');
  if (objectRows.length > 0) {
    return objectRows.map(toSummaryRow);
  }

  return ['current_month', 'previous_fees', 'total']
    .map((key) => record[key])
    .filter(Boolean)
    .map(toSummaryRow);
}

function toSummaryRow(value: unknown): SummaryRow {
  const record = asRecord(value);

  return {
    label: readString(record.month ?? record.label ?? record.title ?? record.name),
    fees: readNumber(record.fees ?? record.amount ?? record.total_fees ?? record.bk),
    paid: readNumber(record.paid ?? record.paid_amount),
    discount: readNumber(record.discount ?? record.discount_amount),
    remaining: readNumber(record.remaining ?? record.remaining_amount ?? record.remain ?? record.balance),
  };
}

function toMonths(value: unknown, finalFee?: unknown, finalFeeName?: unknown): FeeMonth[] {
  const items = Array.isArray(value) ? value : Object.values(asRecord(value));

  return items.map((item) => {
    const record = asRecord(item);
    const id = readString(record.id ?? record.month_id ?? record.month);
    const remaining = readNumber(record.remaining ?? record.remain ?? record.balance ?? record.bk);
    return {
      id,
      label: readString(record.month ?? record.label ?? record.name),
      particulars: toParticulars(record.particulars ?? record.fee_particulars ?? record.details, finalFee, finalFeeName, remaining),
    };
  }).filter((month) => month.id);
}

function toParticulars(value: unknown, finalFee?: unknown, finalFeeName?: unknown, fallbackAmount = 0): FeeParticular[] {
  if (!Array.isArray(value)) {
    const finalFeeRecord = asRecord(finalFee);
    const finalFeeNameRecord = asRecord(finalFeeName);
    const finalFeeRows = Object.entries(finalFeeRecord)
      .filter(([name]) => name.toLowerCase() !== 'total')
      .map(([name, amount]) => ({
        id: readString(finalFeeNameRecord[name] ?? name),
        particular: name,
        amount: readNumber(amount),
        collectionAmount: readNumber(amount),
      }))
      .filter((particular) => particular.id);

    if (finalFeeRows.length > 0) return finalFeeRows;
    return fallbackAmount > 0 ? [{ id: 'total', particular: 'Fees', amount: fallbackAmount, collectionAmount: fallbackAmount }] : [];
  }

  return value.map((item) => {
    const record = asRecord(item);
    const amount = readNumber(record.amount ?? record.fees ?? record.due_amount ?? record.remain);
    return {
      id: readString(record.id ?? record.particular_id ?? record.fee_head_id ?? record.particular),
      particular: readString(record.particular ?? record.name ?? record.fee_head ?? record.title),
      amount,
      collectionAmount: Math.min(
        Math.max(readNumber(record.collection_amount ?? record.collectionAmount ?? record.remaining ?? amount), 0),
        amount
      ),
    };
  }).filter((particular) => particular.id);
}

function toPaymentModes(value: unknown): SelectOption[] {
  if (Array.isArray(value)) return toOptions(value);

  const modes = Object.entries(asRecord(value)).map(([id, label]) => ({
    id,
    label: readString(label) || id,
  })).filter((mode) => mode.id && mode.label);

  return modes;
}

function toOptions(items: unknown): SelectOption[] {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const record = asRecord(item);
    const id = readString(record.id ?? record.bank_id ?? record.value);
    const label = readString(record.name ?? record.bank_name ?? record.label);
    return { id, label: label || id };
  }).filter((item) => item.id && item.label);
}

function resolveSelectedBankId(value: unknown, options: SelectOption[], fallbackLabel?: unknown): string {
  const rawValue = readString(value).trim();
  const rawLabel = readString(fallbackLabel).trim();

  if (!rawValue && !rawLabel) return '';

  const directMatch = options.find((option) => option.id === rawValue);
  if (directMatch) return directMatch.id;

  const normalizedValue = rawValue.toLowerCase();
  const normalizedLabel = rawLabel.toLowerCase();

  const labelMatch = options.find((option) => {
    const optionLabel = option.label.trim().toLowerCase();
    return optionLabel === normalizedValue || optionLabel === normalizedLabel;
  });

  return labelMatch?.id ?? '';
}

function toInputDateString(value: unknown): string {
  const rawValue = readString(value).trim();
  if (!rawValue) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue;
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return parsedDate.toISOString().slice(0, 10);
}

function normalizeReceiptHtml(html: string, bankId: string, bankName: string): string {
  if (!html || !bankId || !bankName || bankId === bankName || typeof window === 'undefined') {
    return html;
  }

  try {
    const parser = new window.DOMParser();
    const documentNode = parser.parseFromString(html, 'text/html');
    const bankLabelMatcher = /bank\s*name|bank\b/i;

    const labeledNodes = Array.from(documentNode.querySelectorAll('td, th, div, p, span, strong, b, label'));
    labeledNodes.forEach((node) => {
      const labelText = node.textContent?.trim() ?? '';
      if (!bankLabelMatcher.test(labelText)) return;

      const sibling = node.nextElementSibling;
      if (sibling && sibling.textContent?.trim() === bankId) {
        sibling.textContent = bankName;
      }
    });

    const allNodes = Array.from(documentNode.querySelectorAll('td, div, span, p'));
    allNodes.forEach((node) => {
      if (node.textContent?.trim() === bankId) {
        const previousText = node.previousElementSibling?.textContent?.trim() ?? '';
        if (bankLabelMatcher.test(previousText)) {
          node.textContent = bankName;
        }
      }
    });

    return documentNode.body.innerHTML || html;
  } catch {
    return html;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readString(value: unknown): string {
  return value == null ? '' : String(value);
}

function readNumber(value: unknown): number {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function toNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) return value.map(readNumber);
  const numericValue = readNumber(value);
  return numericValue ? [numericValue] : [];
}

function parseJsonResponse(value: string): unknown {
  if (!value.trim()) return {};

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function extractReceiptHtml(payload: unknown, rawResponse: string): string {
  const directHtml = extractHtmlString(rawResponse);
  if (directHtml) return directHtml;

  return extractHtmlFromUnknown(payload);
}

function extractHtmlFromUnknown(value: unknown): string {
  const directHtml = extractHtmlString(value);
  if (directHtml) return directHtml;

  if (Array.isArray(value)) {
    for (const item of value) {
      const html = extractHtmlFromUnknown(item);
      if (html) return html;
    }
    return '';
  }

  // Only objects can nest a receipt; recursing into undefined/primitives never ends.
  if (!value || typeof value !== 'object') return '';

  const record = asRecord(value);
  for (const key of ['data', 'html', 'receipt', 'receipt_html', 'receiptHtml']) {
    const html = extractHtmlFromUnknown(record[key]);
    if (html) return html;
  }

  return '';
}

function extractHtmlString(value: unknown): string {
  if (typeof value !== 'string') return '';

  const trimmedValue = value.trim();
  if (!trimmedValue) return '';

  if (trimmedValue.startsWith('{') || trimmedValue.startsWith('[')) {
    const parsedValue = parseJsonResponse(trimmedValue);
    const parsedHtml = extractHtmlFromUnknown(parsedValue);
    if (parsedHtml) return parsedHtml;
  }

  return /<\s*(style|table|div|html|body)\b/i.test(trimmedValue) ? trimmedValue : '';
}
