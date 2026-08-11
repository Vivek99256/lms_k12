'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Banknote, CalendarDays, ChevronDown, History, Loader2, Printer, Save } from 'lucide-react';
import { API_BASE_URL } from '@/app/components/utils/api_url';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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

const defaultPaymentModes = [
  { id: 'Cash', label: 'Cash' },
  { id: 'Cheque', label: 'Cheque' },
  { id: 'Online', label: 'Online' },
];

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

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
  const [paymentModes, setPaymentModes] = useState<SelectOption[]>(defaultPaymentModes);
  const [selectedMonthIds, setSelectedMonthIds] = useState<string[]>([]);
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [discount, setDiscount] = useState(0);
  const [fine, setFine] = useState(0);
  const [paymentMode, setPaymentMode] = useState('Cash');
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

  const clearCollectionData = useCallback((message: string) => {
    setStudent(null);
    setSummaryRows([]);
    setMonths([]);
    setBanks([]);
    setPaymentModes(defaultPaymentModes);
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
    setPaymentMode(savedPaymentMode || 'Cash');
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
        throw new Error(payload.message || 'Unable to load fee collection data.');
      }

      applyCollectionData(payload);
    } catch (fetchError) {
      clearCollectionData(fetchError instanceof Error ? fetchError.message : 'Unable to load fee collection data.');
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

  const totalAmount = selectedParticulars.reduce((total, item) => total + item.collectionAmount, 0);
  const grandTotal = Math.max(totalAmount - discount + fine, 0);
  const showBankFields = paymentMode === 'Cheque' || paymentMode === 'Online';
  const showChequeDate = paymentMode === 'Cheque';
  const showBranch = paymentMode === 'Cheque';
  const totalSummaryFees = summaryRows.reduce((total, row) => total + row.fees, 0);
  const totalSummaryPaid = summaryRows.reduce((total, row) => total + row.paid, 0);
  const totalSummaryDiscount = summaryRows.reduce((total, row) => total + row.discount, 0);
  const totalSummaryRemaining = summaryRows.reduce((total, row) => total + row.remaining, 0);
  const selectedMonthCount = selectedMonthIds.length;
  const selectedParticularCount = selectedParticulars.length;
  const selectedBankName = useMemo(() => {
    const selectedBank = banks.find((bank) => bank.id === selectedBankId);
    return selectedBank?.label ?? '';
  }, [banks, selectedBankId]);
  const printableReceiptHtml = useMemo(
    () => normalizeReceiptHtml(receiptHtml, selectedBankId, selectedBankName),
    [receiptHtml, selectedBankId, selectedBankName]
  );
  const collectionProgress = totalSummaryFees > 0
    ? Math.min(100, Math.round(((totalSummaryPaid + grandTotal + totalSummaryDiscount) / totalSummaryFees) * 100))
    : 0;

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

  const handleParticularAmountChange = (monthId: string, particularId: string, amount: number) => {
    setMonths((currentMonths) =>
      currentMonths.map((month) => {
        if (month.id !== monthId) return month;

        return {
          ...month,
          particulars: month.particulars.map((particular) =>
            particular.id === particularId ? { ...particular, collectionAmount: amount } : particular
          ),
        };
      })
    );
  };

  const toggleMonth = (monthId: string, checked: boolean) => {
    setSelectedMonthIds((current) => checked ? [...new Set([...current, monthId])] : current.filter((id) => id !== monthId));
  };

  const saveCollection = async (printReceipt: boolean) => {
    if (!session.subInstituteId) {
      router.push('/fees/collect');
      return;
    }

    setSaving(true);
    setError(null);

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
        const current = particularTotals.get(particular.id) ?? { collectionAmount: 0, amount: 0 };
        particularTotals.set(particular.id, {
          collectionAmount: current.collectionAmount + particular.collectionAmount,
          amount: current.amount + particular.amount,
        });
      });

      particularTotals.forEach((particular, particularId) => {
        form.append(`fees_data[${particularId}]`, String(particular.collectionAmount));
        form.append(`fine_data[${particularId}]`, '0');
        form.append(`hid_fees_data[${particularId}]`, String(particular.amount));
        form.append(`discount_data[${particularId}]`, '0');
      });

      const previousFees = readNumber(studentRecord.previous_fees);
      form.append('fees_data[previous_fees]', '0');
      form.append('fine_data[previous_fees]', '0');
      form.append('hid_fees_data[previous_fees]', String(previousFees));
      form.append('discount_data[previous_fees]', '0');
      form.append('total', String(totalAmount));
      form.append('totalFin', String(fine));
      form.append('remarks', remarks);
      form.append('totalDis', String(discount));
      form.append('hidden_cheque_return_charges', String(chequeReturnCharges));
      form.append('PAYMENT_MODE', paymentMode);
      form.append('receiptdate', receiptDate);
      form.append('cheque_date', chequeDate || receiptDate);
      form.append('cheque_no', paymentMode !== 'Cash' ? transactionNo : '');
      form.append('bank_id', showBankFields ? selectedBankId : '');
      form.append('bank_name', showBankFields ? selectedBankName : '');
      form.append('bank_branch', showBranch ? bankBranch : 'N/A');
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
        throw new Error(payload.message || 'Unable to save fee collection.');
      }

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
      setError(saveError instanceof Error ? saveError.message : 'Unable to save fee collection.');
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
          <h1 className="text-lg font-bold text-slate-950">Unable to load fee collection</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {error || 'Laravel did not return fee collection data for this student.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_30%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_38%,#f1f5f9_100%)]">
      <div data-print-exclude="true" className="mx-auto max-w-[1500px] space-y-6 p-3 sm:p-4 md:p-6 lg:p-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-6 lg:py-6">
            <div className="space-y-4">
              <div className="flex min-w-0 items-center gap-3">
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl bg-white" onClick={() => router.push('/fees/collect')}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                    Fees Collection
                  </div>
                  <h1 className="mt-3 truncate text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{student.studentName || 'Student fee collection'}</h1>
                  <p className="mt-2 text-sm text-slate-500">
                    Review the same fee data, select due months, adjust charges if needed, and continue with the existing save and receipt flow.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryStatCard label="Pending amount" value={currencyFormatter.format(student.pendingFees)} tone="rose" />
                <SummaryStatCard label="Selected months" value={String(selectedMonthCount)} tone="sky" />
                <SummaryStatCard label="Line items" value={String(selectedParticularCount)} tone="amber" />
                <SummaryStatCard label="Current total" value={currencyFormatter.format(grandTotal)} tone="emerald" />
              </div>
            </div>

            <Card className="border-0 bg-slate-950 text-white ring-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-white">Collection progress</CardTitle>
                <p className="text-sm text-slate-300">Current academic-year position for this student.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300">
                    <span>Paid and adjusted</span>
                    <span>{collectionProgress}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/10">
                    <div className="h-2.5 rounded-full bg-emerald-400" style={{ width: `${collectionProgress}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniInfo label="Assigned" value={currencyFormatter.format(totalSummaryFees)} />
                  <MiniInfo label="Paid" value={currencyFormatter.format(totalSummaryPaid)} />
                  <MiniInfo label="Discount" value={currencyFormatter.format(totalSummaryDiscount)} />
                  <MiniInfo label="Remaining" value={currencyFormatter.format(totalSummaryRemaining)} />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {error && <div className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {printableReceiptHtml && !printViewOpen && (
          <Card className="border-emerald-200 bg-white shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-emerald-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base font-bold text-emerald-800">Receipt Preview</CardTitle>
              <div className="text-sm text-emerald-700">Saved receipt preview</div>
            </CardHeader>
            <CardContent className="overflow-x-auto bg-slate-50 p-4">
              <div className="mx-auto min-w-[720px] max-w-[900px] bg-white p-4 shadow-sm" dangerouslySetInnerHTML={{ __html: printableReceiptHtml }} />
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="border-b border-slate-100 px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
              <Banknote className="h-4 w-4 text-[#0D6EFD]" />
              Student Information
            </CardTitle>
            <p className="text-sm text-slate-500">Core profile values returned by the fee collection API.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
            <Info label="Unique ID" value={student?.uniqueId} />
            <Info label="Student Name" value={student?.studentName} />
            <Info label="GR No." value={student?.grNo} />
            <Info label="Admission Year" value={student?.admissionYear} />
            <Info label="Standard / Division" value={student?.standardDivision} />
            <Info label="Father Name" value={student?.fatherName} />
            <Info label="Contact Number" value={student?.contactNumber} />
            <Info label="Parent Email" value={student?.parentEmail} />
            <Info label="Student Quota" value={student?.studentQuota} />
            <Info label="Pending Fees" value={currencyFormatter.format(student?.pendingFees ?? 0)} valueClassName="font-bold text-rose-600" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          <div className="min-w-0 space-y-5">
            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-5 py-4">
                <CardTitle className="text-base font-bold text-slate-800">Fee Summary</CardTitle>
                <p className="text-sm text-slate-500">Month-wise totals already returned for this student record.</p>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable
                  headers={['Month', 'Fees', 'Paid', 'Discount', 'Remaining']}
                  rows={summaryRows.map((row) => [
                    row.label,
                    currencyFormatter.format(row.fees),
                    currencyFormatter.format(row.paid),
                    currencyFormatter.format(row.discount),
                    currencyFormatter.format(row.remaining),
                  ])}
                  emptyMessage="Fee summary is not available."
                />
                <div className="border-t border-slate-100 px-5 py-4">
                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg bg-white">
                    <History className="mr-2 h-4 w-4" />
                    Paid History
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-5 py-4">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-800">
                  <CalendarDays className="h-4 w-4 text-[#0D6EFD]" />
                  Month Selection
                </CardTitle>
                <p className="text-sm text-slate-500">Choose the fee months to include. Expanding a month shows the same line items and editable collection amounts.</p>
              </CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-5">
                {months.map((month) => {
                  const isExpanded = expandedMonthId === month.id;
                  const isSelected = selectedMonthIds.includes(month.id);
                  const monthCollection = month.particulars.reduce((total, item) => total + item.collectionAmount, 0);
                  const monthAmount = month.particulars.reduce((total, item) => total + item.amount, 0);

                  return (
                    <div key={month.id} className={`rounded-2xl border ${isSelected ? 'border-sky-200 bg-sky-50/40' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
                        <input type="checkbox" checked={isSelected} onChange={(event) => toggleMonth(month.id, event.target.checked)} className="h-4 w-4 shrink-0 rounded border-slate-300 accent-[#0D6EFD]" />
                        <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left" onClick={() => setExpandedMonthId(isExpanded ? null : month.id)}>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{month.label}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {month.particulars.length} line item{month.particulars.length === 1 ? '' : 's'} • {currencyFormatter.format(monthCollection)} selected of {currencyFormatter.format(monthAmount)}
                            </p>
                          </div>
                          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-slate-100 p-3 sm:p-4">
                          <FeeParticularsTable month={month} onAmountChange={handleParticularAmountChange} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {months.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No unpaid fee months available.</div>}
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0 space-y-5">
            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-5 py-4">
                <CardTitle className="text-base font-bold text-slate-800">Fee Adjustment</CardTitle>
                <p className="text-sm text-slate-500">Optional adjustments applied before the final save request.</p>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <Field label="Remarks">
                  <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Enter remarks" className="min-h-24 rounded-lg border-slate-200 bg-slate-50/70 text-sm" />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Discount">
                    <Input type="number" min="0" value={discount} onChange={(event) => setDiscount(readNumber(event.target.value))} className="h-10 rounded-lg border-slate-200 bg-slate-50/70 text-sm" />
                  </Field>
                  <Field label="Fine">
                    <Input type="number" min="0" value={fine} onChange={(event) => setFine(readNumber(event.target.value))} className="h-10 rounded-lg border-slate-200 bg-slate-50/70 text-sm" />
                  </Field>
                </div>
                <Field label="Grand Total">
                  <Input value={currencyFormatter.format(grandTotal)} readOnly className="h-10 rounded-lg border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-700" />
                </Field>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 px-5 py-4">
                <CardTitle className="text-base font-bold text-slate-800">Payment Information</CardTitle>
                <p className="text-sm text-slate-500">Receipt metadata and banking details sent with the same backend request.</p>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-5">
                <Field label="Payment Mode">
                  <Select value={paymentMode} onValueChange={(value) => setPaymentMode(value ?? 'Cash')}>
                    <SelectTrigger className="h-10 w-full rounded-lg border-slate-200 bg-slate-50/70 text-sm">
                      <SelectValue placeholder="Select payment mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentModes.map((mode) => (
                        <SelectItem key={mode.id} value={mode.id}>{mode.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Receipt Date">
                  <Input type="date" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} className="h-10 rounded-lg border-slate-200 bg-slate-50/70 text-sm" />
                </Field>
                {showChequeDate && (
                  <Field label="Cheque/DD Date">
                    <Input type="date" value={chequeDate} onChange={(event) => setChequeDate(event.target.value)} className="h-10 rounded-lg border-slate-200 bg-slate-50/70 text-sm" />
                  </Field>
                )}
                {paymentMode !== 'Cash' && (
                  <Field label="Cheque/DD/Transaction No.">
                    <Input value={transactionNo} onChange={(event) => setTransactionNo(event.target.value)} placeholder="Enter reference number" className="h-10 rounded-lg border-slate-200 bg-slate-50/70 text-sm" />
                  </Field>
                )}
                {showBankFields && (
                  <Field label="Bank Name">
                    <Select value={selectedBankId} onValueChange={(value) => setSelectedBankId(value ?? '')}>
                      <SelectTrigger className="h-10 w-full rounded-lg border-slate-200 bg-slate-50/70 text-sm">
                        <SelectValue placeholder="Select bank">
                          {selectedBankName || 'Select bank'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={bank.id} value={bank.id}>{bank.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {showBranch && (
                  <Field label="Bank Branch">
                    <Input value={bankBranch} onChange={(event) => setBankBranch(event.target.value)} placeholder="Enter bank branch" className="h-10 rounded-lg border-slate-200 bg-slate-50/70 text-sm" />
                  </Field>
                )}
                <label className="flex h-10 cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={sendSms} onChange={(event) => setSendSms(event.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-[#0D6EFD]" />
                  Send SMS
                </label>
              </CardContent>
            </Card>

           
          </div>
        </div>
      </div>

      <div data-print-exclude="true" className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:px-4">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Grand Total</p>
            <p className="text-xl font-bold text-slate-900">{currencyFormatter.format(grandTotal)}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row">
            <Button type="button" variant="outline" className="h-10 rounded-lg bg-white" onClick={() => router.push('/fees/collect')} disabled={saving}>Cancel</Button>
            <Button type="button" className="h-10 rounded-lg bg-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90" onClick={() => saveCollection(false)} disabled={saving || selectedMonthIds.length === 0}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
            <Button type="button" className="h-10 rounded-lg bg-slate-900 text-white hover:bg-slate-800" onClick={() => saveCollection(true)} disabled={saving || selectedMonthIds.length === 0}>
              <Printer className="mr-2 h-4 w-4" />
              Save & Print Receipt
            </Button>
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

function FeeParticularsTable({ month, onAmountChange }: { month: FeeMonth; onAmountChange: (monthId: string, particularId: string, amount: number) => void }) {
  const totalAmount = month.particulars.reduce((total, item) => total + item.amount, 0);
  const totalCollection = month.particulars.reduce((total, item) => total + item.collectionAmount, 0);

  return (
    <div>
      <div className="space-y-3 sm:hidden">
        {month.particulars.map((particular) => (
          <div key={particular.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-slate-800">{particular.particular}</p>
                <p className="mt-1 text-xs text-slate-500">Amount: {currencyFormatter.format(particular.amount)}</p>
              </div>
            </div>
            <Label className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Collection Amount</Label>
            <Input
              type="number"
              min="0"
              value={particular.collectionAmount}
              onChange={(event) => onAmountChange(month.id, particular.id, readNumber(event.target.value))}
              className="mt-2 h-9 rounded-lg border-slate-200 bg-white text-sm"
            />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-900 p-3 text-sm font-bold text-white">
          <div>
            <p className="text-xs font-medium text-slate-300">Amount</p>
            <p>{currencyFormatter.format(totalAmount)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">Collection</p>
            <p>{currencyFormatter.format(totalCollection)}</p>
          </div>
        </div>
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 font-semibold">Particular</th>
            <th className="px-3 py-2 font-semibold">Amount</th>
            <th className="px-3 py-2 font-semibold">Collection Amount</th>
          </tr>
        </thead>
        <tbody>
          {month.particulars.map((particular) => (
            <tr key={particular.id} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-3 font-medium text-slate-800">{particular.particular}</td>
              <td className="px-3 py-3 text-slate-600">{currencyFormatter.format(particular.amount)}</td>
              <td className="px-3 py-3">
                <Input type="number" min="0" value={particular.collectionAmount} onChange={(event) => onAmountChange(month.id, particular.id, readNumber(event.target.value))} className="h-9 max-w-[160px] rounded-lg border-slate-200 bg-white text-sm" />
              </td>
            </tr>
          ))}
          <tr className="bg-slate-50/80 font-bold text-slate-900">
            <td className="px-3 py-3">Total</td>
            <td className="px-3 py-3">{currencyFormatter.format(totalAmount)}</td>
            <td className="px-3 py-3">{currencyFormatter.format(totalCollection)}</td>
          </tr>
        </tbody>
        </table>
      </div>
    </div>
  );
}

function DataTable({ headers, rows, emptyMessage }: { headers: string[]; rows: string[][]; emptyMessage: string }) {
  return (
    <div>
      <div className="space-y-3 p-4 sm:hidden">
        {rows.map((row, index) => (
          <div key={`${row[0]}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-sm font-bold text-slate-900">{row[0]}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              {row.slice(1).map((cell, cellIndex) => (
                <div key={`${cell}-${cellIndex}`}>
                  <p className="font-medium text-slate-500">{headers[cellIndex + 1]}</p>
                  <p className="mt-1 font-semibold text-slate-800">{cell}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-500">{emptyMessage}</div>}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[620px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
            {headers.map((header) => <th key={header} className="px-5 py-3 font-semibold">{header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`} className="border-b border-slate-100 last:border-0">
              {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="px-5 py-4 text-slate-700">{cell}</td>)}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="px-5 py-10 text-center text-sm text-slate-500">{emptyMessage}</td>
            </tr>
          )}
        </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value, valueClassName = 'text-slate-900' }: { label: string; value?: string; valueClassName?: string }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1 rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-3 text-sm sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4 sm:px-4">
      <span className="font-medium text-slate-500">{label}</span>
      <span className={`min-w-0 break-words ${valueClassName}`}>{value || '-'}</span>
    </div>
  );
}

function SummaryStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'rose' | 'sky' | 'amber' | 'emerald';
}) {
  const toneClasses = {
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    sky: 'border-sky-100 bg-sky-50 text-sky-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  } satisfies Record<'rose' | 'sky' | 'amber' | 'emerald', string>;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-3 text-xl font-bold text-slate-950">{value}</p>
      <div className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
        {label}
      </div>
    </div>
  );
}

function MiniInfo({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className={`mt-2 text-sm ${strong ? 'font-bold text-white' : 'font-semibold text-slate-100'}`}>{value}</p>
    </div>
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
      collectionAmount: readNumber(record.collection_amount ?? record.collectionAmount ?? record.remaining ?? amount),
    };
  }).filter((particular) => particular.id);
}

function toPaymentModes(value: unknown): SelectOption[] {
  if (Array.isArray(value)) return toOptions(value);

  const modes = Object.entries(asRecord(value)).map(([id, label]) => ({
    id,
    label: readString(label) || id,
  })).filter((mode) => mode.id && mode.label);

  return modes.length > 0 ? modes : defaultPaymentModes;
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
