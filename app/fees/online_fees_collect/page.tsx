'use client';

import { useMemo, useState } from 'react';
import { CreditCard, Loader2, Search } from 'lucide-react';

import {
  EmptyTableRow,
  Field,
  InlineMessage,
  LoadingRows,
  PageFrame,
  PageHeader,
  SectionPanel,
} from '@/app/fees/_components/fees-shared';
import {
  appendSessionParams,
  asRecord,
  fetchLaravelJson,
  formatCurrency,
  getApiBaseUrl,
  getFeesSession,
  readFirstString,
  readNumber,
  toArray,
} from '@/app/fees/_lib/fees-api';
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

type OnlineStudent = {
  id: string;
  name: string;
  bankName: string;
  subInstituteId: string;
  endDate: string;
  active: boolean;
};

type FeeValidation = {
  amount: number;
  medium: string;
  rawText: string;
};

const gatewayActions: Record<string, string> = { hdfc: 'hdfc', axis: 'axis', aggre_pay: 'aggre_pay', icici: 'icici', razorpay: 'razorpay', payphi: 'payphi', hdfcrazorpay: 'hdfcrazorpay', hdfc_razorpay: 'hdfcrazorpay', icici_orange: 'icici_orange' };

export default function OnlineFeesCollectPage() {
  const [mobileNumber, setMobileNumber] = useState('');
  const [students, setStudents] = useState<OnlineStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [validation, setValidation] = useState<FeeValidation | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [validating, setValidating] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, students]
  );
  const gatewayPath = selectedStudent ? gatewayActions[normalizeGatewayName(selectedStudent.bankName)] : '';

  const handleLookup = async () => {
    const currentSession = getFeesSession();

    if (!currentSession.subInstituteId || !currentSession.academicYearId) {
      setMessage({ type: 'error', text: 'Session institute or academic year is missing.' });
      return;
    }

    if (!mobileNumber.trim()) {
      setMessage({ type: 'error', text: 'Please enter mobile number.' });
      return;
    }

    setLoadingStudents(true);
    setHasSearched(true);
    setStudents([]);
    setSelectedStudentId('');
    setValidation(null);
    setMessage(null);

    try {
      const params = new URLSearchParams();
      appendSessionParams(params, currentSession);
      params.set('mobile_number', mobileNumber.trim());

      const proxyParams = new URLSearchParams(params);
      proxyParams.set('path', 'fees/get-student');
      const payload = await fetchLaravelJson<unknown>(currentSession, `/api/proxy?${proxyParams.toString()}`);
      const nextStudents = toOnlineStudents(payload);
      setStudents(nextStudents);
      setMessage({
        type: nextStudents.length ? 'success' : 'info',
        text: nextStudents.length ? `Loaded ${nextStudents.length} student${nextStudents.length === 1 ? '' : 's'}.` : 'No students found for this mobile number.',
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load students for this mobile number.' });
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setValidation(null);
    setMessage(null);
  };

  const validateSelectedStudent = async (): Promise<FeeValidation | null> => {
    const currentSession = getFeesSession();

    if (!selectedStudent) {
      setMessage({ type: 'error', text: 'Please select student.' });
      return null;
    }

    if (!selectedStudent.active) {
      setMessage({ type: 'error', text: 'Selected student is inactive for online fees collection.' });
      return null;
    }

    if (!gatewayPath) {
      setMessage({ type: 'error', text: `Payment gateway is not configured for ${selectedStudent.bankName || 'this student'}.` });
      return null;
    }

    setValidating(true);
    setMessage(null);

    try {
      const params = new URLSearchParams();
      appendSessionParams(params, currentSession);
      params.set('student_id', selectedStudent.id);

      const response = await fetch(`${getApiBaseUrl(currentSession)}/ajax_checkFeesBreakoff?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'text/plain, application/json',
          ...(currentSession.token ? { Authorization: `Bearer ${currentSession.token}` } : {}),
        },
        credentials: 'omit',
      });
      const text = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Unable to validate fees breakoff.`);
      }

      const nextValidation = parseBreakoffResponse(text);
      if (nextValidation.amount <= 0) {
        throw new Error('You are not mapped with institute amount.');
      }

      if (!nextValidation.medium) {
        throw new Error('You are not mapped with institute medium.');
      }

      setValidation(nextValidation);
      setMessage({ type: 'success', text: 'Student fees mapping validated.' });
      return nextValidation;
    } catch (error) {
      setValidation(null);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to validate fees breakoff.' });
      return null;
    } finally {
      setValidating(false);
    }
  };

  const handleContinue = async () => {
    if (!selectedStudent) {
      setMessage({ type: 'error', text: 'Please select student.' });
      return;
    }

    const currentValidation = validation ?? await validateSelectedStudent();
    if (!currentValidation) return;

    const currentSession = getFeesSession();
    const actionUrl = gatewayPath ? `/fees/online-payment/${encodeURIComponent(gatewayPath)}?student_id=${encodeURIComponent(selectedStudent.id)}&amount=${encodeURIComponent(String(currentValidation.amount))}` : '';
    if (!actionUrl) {
      setMessage({ type: 'error', text: 'Payment gateway action is not available.' });
      return;
    }

    setRedirecting(true);
    submitGatewayForm(actionUrl, {
      student_id: selectedStudent.id,
      sub_institute_id: currentSession.subInstituteId || selectedStudent.subInstituteId,
      syear: currentSession.academicYearId,
      type: 'API',
      mobile_number: mobileNumber.trim(),
      amount: String(currentValidation.amount),
      medium: currentValidation.medium,
      token: currentSession.token,
    });
  };

  return (
    <PageFrame>
      <PageHeader
        title="Online fees collect"
        description="Search by registered mobile number, validate fee mapping, and continue into the configured Laravel payment gateway."
        action={validation ? (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-right">
            <p className="text-xs font-medium text-emerald-700">Mapped amount</p>
            <p className="text-lg font-bold text-emerald-900">{formatCurrency(validation.amount)}</p>
          </div>
        ) : undefined}
      />

      {message && <InlineMessage type={message.type} text={message.text} />}

      <SectionPanel title="Search">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <Field label="Mobile number">
            <Input
              value={mobileNumber}
              onChange={(event) => setMobileNumber(event.target.value)}
              placeholder="Enter registered mobile number"
            />
          </Field>
          <Button type="button" className="h-10" onClick={handleLookup} disabled={loadingStudents}>
            {loadingStudents ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Students"
        footer={
          students.length > 0 && (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-600">
                {selectedStudent ? `${selectedStudent.name || selectedStudent.id} selected` : 'Select a student to continue.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={validateSelectedStudent} disabled={!selectedStudent || validating || redirecting}>
                  {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Validate
                </Button>
                <Button type="button" onClick={handleContinue} disabled={!selectedStudent || validating || redirecting}>
                  {redirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Continue to gateway
                </Button>
              </div>
            </div>
          )
        }
      >
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="bg-slate-100 text-xs uppercase text-slate-700 hover:bg-slate-100">
              <TableHead className="w-10">Select</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Student ID</TableHead>
              <TableHead>Gateway bank</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>End date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingStudents ? (
              <LoadingRows colSpan={6} label="Loading students" />
            ) : students.length > 0 ? (
              students.map((student, index) => (
                <TableRow key={`${student.id}-${student.bankName}-${index}`} className="odd:bg-white even:bg-slate-50/70">
                  <TableCell>
                    <input
                      type="radio"
                      name="online-fee-student"
                      className="h-4 w-4 border-slate-300 accent-[var(--primary-blue)]"
                      checked={student.id === selectedStudentId}
                      onChange={() => handleSelectStudent(student.id)}
                      aria-label={`Select ${student.name || student.id}`}
                    />
                  </TableCell>
                  <TableCell className="font-semibold text-slate-950">{student.name || '-'}</TableCell>
                  <TableCell>{student.id}</TableCell>
                  <TableCell>{student.bankName || '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${student.active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {student.active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell>{student.endDate || '-'}</TableCell>
                </TableRow>
              ))
            ) : (
              <EmptyTableRow colSpan={6} label={hasSearched ? 'No students found for this mobile number.' : 'Search to load linked students.'} />
            )}
          </TableBody>
        </Table>
      </SectionPanel>
    </PageFrame>
  );
}

function toOnlineStudents(value: unknown): OnlineStudent[] {
  const payload = asRecord(value);
  const rows = Array.isArray(value)
    ? value
    : toArray(payload.students ?? payload.student_data ?? payload.data ?? value);

  return rows.map((item) => {
    const record = asRecord(item);
    return {
      id: readFirstString(record, ['id', 'student_id']),
      name: readFirstString(record, ['name', 'student_name', 'full_name']),
      bankName: readFirstString(record, ['bank_name', 'gateway_bank_name']),
      subInstituteId: readFirstString(record, ['sub_institute_id']),
      endDate: readFirstString(record, ['end_date']),
      active: !isInactiveEndDate(readFirstString(record, ['end_date'])),
    };
  }).filter((student) => student.id);
}

function parseBreakoffResponse(value: string): FeeValidation {
  const [amountValue = '', medium = ''] = value.split('####');
  return {
    amount: readNumber(amountValue),
    medium: medium.trim(),
    rawText: value,
  };
}

function normalizeGatewayName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function isInactiveEndDate(value: string): boolean {
  if (!value || value === '0000-00-00') return false;
  const endDate = new Date(value);
  if (Number.isNaN(endDate.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return endDate < today;
}

function submitGatewayForm(actionUrl: string, values: Record<string, string>) {
  if (typeof document === 'undefined') return;

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = actionUrl;

  Object.entries(values).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
