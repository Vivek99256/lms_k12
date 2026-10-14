'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  Printer,
  School,
  ShieldCheck,
  Smartphone,
  UserRound,
} from 'lucide-react';

import {
  formatRupees,
  formatYear,
  loadRazorpay,
  PayError,
  payApi,
  razorpayCtor,
  submitToGateway,
  type PayFees,
  type PayOutcome,
  type PaySchool,
  type PayStudent,
} from './_lib/pay-api';

type Step = 'mobile' | 'student' | 'fees' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'mobile', label: 'Find student' },
  { key: 'fees', label: 'Review fees' },
  { key: 'done', label: 'Pay' },
];

export default function ParentPayPage() {
  const params = useParams<{ code: string }>();
  const code = params?.code ?? '';

  const [school, setSchool] = useState<PaySchool | null>(null);
  const [schoolError, setSchoolError] = useState('');
  const [step, setStep] = useState<Step>('mobile');
  const [mobile, setMobile] = useState('');
  const [students, setStudents] = useState<PayStudent[]>([]);
  const [fees, setFees] = useState<PayFees | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [customAmount, setCustomAmount] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<PayOutcome | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    let cancelled = false;
    payApi
      .school(code)
      .then((data) => !cancelled && setSchool(data))
      .catch((e: Error) => !cancelled && setSchoolError(e.message));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const mobileDigits = mobile.replace(/\D/g, '');
  const mobileValid = mobileDigits.length === 10;

  const openFees = useCallback(
    async (studentId: string) => {
      const data = await payApi.fees(code, mobileDigits, studentId);
      setFees(data);
      setSelected(data.months.filter((m) => m.due > 0).map((m) => m.id));
      setCustomAmount(null);
      setStep('fees');
    },
    [code, mobileDigits],
  );

  const findStudents = async () => {
    if (!mobileValid || busy) return;
    setBusy(true);
    setError('');
    try {
      const { students: found } = await payApi.lookup(code, mobileDigits);
      if (found.length === 0) {
        setError('We could not find a student for this number. Please use the mobile number you gave the school.');
      } else if (found.length === 1) {
        setStudents(found);
        await openFees(found[0].id);
      } else {
        setStudents(found);
        setStep('student');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const chooseStudent = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await openFees(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Fees are taken in month order, so choosing a month also selects every earlier month still owing.
  const dueMonths = useMemo(() => fees?.months.filter((m) => m.due > 0) ?? [], [fees]);
  const toggleMonth = (id: string) => {
    const index = dueMonths.findIndex((m) => m.id === id);
    const isLast = selected.length === index + 1;
    const next = isLast ? dueMonths.slice(0, index).map((m) => m.id) : dueMonths.slice(0, index + 1).map((m) => m.id);
    setSelected(next);
    setCustomAmount(null);
  };

  const monthsTotal = dueMonths.filter((m) => selected.includes(m.id)).reduce((sum, m) => sum + m.due, 0);
  const typed = customAmount === null ? null : Number(customAmount);
  const amount = fees && !fees.fixed && typed !== null ? typed : monthsTotal;
  const amountValid = !!fees && amount >= 1 && amount <= fees.due + 0.001;

  const pay = async () => {
    if (!fees || !amountValid || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    const rounded = Math.round(amount * 100) / 100;
    try {
      if (!school?.inline) {
        submitToGateway(code, { mobile: mobileDigits, student_id: fees.student.id, amount: String(rounded) });
        return; // the browser leaves for the bank; keep the button locked
      }
      const order = await payApi.startRazorpay(code, mobileDigits, fees.student.id, rounded);
      await loadRazorpay();
      const Razorpay = razorpayCtor();
      if (!Razorpay) throw new PayError('Could not open the payment window. Please try again.', 0);

      await new Promise<void>((resolve) => {
        const checkout = new Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: Math.round(order.amount * 100),
          currency: 'INR',
          name: order.schoolName,
          description: `School fees - ${order.studentName}`,
          prefill: { contact: mobileDigits },
          theme: { color: '#4f46e5' },
          modal: {
            ondismiss: () => {
              setError('The payment was not completed and you have not been charged. You can try again.');
              resolve();
            },
          },
          handler: async (response: Record<string, string>) => {
            try {
              const result = await payApi.confirmRazorpay(code, mobileDigits, fees.student.id, {
                payment_ref: order.paymentRef,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              setOutcome(result);
              setStep('done');
            } catch (e) {
              // 202: paid, receipt still being prepared. Never invite a second payment.
              if (e instanceof PayError && e.status === 202) {
                setOutcome({ state: 'pending', amount: rounded, reference: response.razorpay_payment_id });
                setStep('done');
              } else {
                setError(e instanceof Error ? e.message : 'We could not confirm your payment.');
              }
            }
            resolve();
          },
        });
        checkout.on('payment.failed', () => {
          setError('The payment failed and you have not been charged. Please try again.');
        });
        checkout.open();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not start the payment. Please try again.');
    } finally {
      if (school?.inline) {
        submitting.current = false;
        setBusy(false);
      }
    }
  };

  const restart = () => {
    setStep('mobile');
    setStudents([]);
    setFees(null);
    setOutcome(null);
    setError('');
    setCustomAmount(null);
  };

  const stepIndex = step === 'done' ? 2 : step === 'fees' ? 1 : 0;

  if (schoolError) {
    return (
      <Shell>
        <Card className="text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
          <h1 className="mt-4 text-xl font-semibold text-slate-900">This link isn&apos;t working</h1>
          <p className="mt-2 text-sm text-slate-600">{schoolError}</p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell school={school?.name}>
      {step !== 'done' && <Stepper index={stepIndex} />}

      {error && (
        <div role="alert" className="mb-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {step === 'mobile' && (
        <Card>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Smartphone className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Pay school fees</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Enter the mobile number you gave the school. No account or password needed.
          </p>
          <form
            className="mt-6"
            onSubmit={(event) => {
              event.preventDefault();
              void findStudents();
            }}
          >
            <label htmlFor="mobile" className="text-sm font-medium text-slate-800">
              Registered mobile number
            </label>
            <div className="mt-2 flex h-14 items-center rounded-xl border border-slate-300 bg-white px-4 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
              <span className="pr-3 text-base font-medium text-slate-500">+91</span>
              <input
                id="mobile"
                inputMode="numeric"
                autoComplete="tel-national"
                autoFocus
                maxLength={14}
                value={mobile}
                onChange={(event) => {
                  setMobile(event.target.value.replace(/[^\d ]/g, ''));
                  setError('');
                }}
                placeholder="98765 43210"
                className="h-full w-full bg-transparent font-mono text-lg tracking-wide text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>
            <PrimaryButton type="submit" disabled={!mobileValid || busy} className="mt-5">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
              Continue
            </PrimaryButton>
          </form>
        </Card>
      )}

      {step === 'student' && (
        <Card>
          <BackLink onClick={() => setStep('mobile')} />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Whose fees are you paying?</h1>
          <p className="mt-1.5 text-sm text-slate-600">
            {students.length} students are registered with +91 {mobileDigits}.
          </p>
          <ul className="mt-5 space-y-3">
            {students.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void chooseStudent(student.id)}
                  className="flex min-h-16 w-full items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <UserRound className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-base font-medium text-slate-900">{student.name}</span>
                  <ChevronRight className="h-5 w-5 text-slate-400" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {step === 'fees' && fees && (
        <div className="pb-28 sm:pb-0">
          <Card>
            <BackLink onClick={() => setStep(students.length > 1 ? 'student' : 'mobile')} />
            <div className="mt-3 flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <UserRound className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold text-slate-900">{fees.student.name}</h1>
                <p className="text-sm text-slate-600">
                  {[fees.student.class && `Class ${fees.student.class}`, fees.student.uniqueId && `ID ${fees.student.uniqueId}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Total pending · {formatYear(fees.year)}
              </p>
              <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-slate-900">{formatRupees(fees.due)}</p>
            </div>
            {fees.clearingEarlierYear && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                These fees are from {formatYear(fees.year)}. Please clear them first; this year&apos;s fees can be paid after.
              </p>
            )}
          </Card>

          {fees.due <= 0 ? (
            <Card className="mt-4 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" aria-hidden />
              <h2 className="mt-3 text-lg font-semibold text-slate-900">Nothing to pay</h2>
              <p className="mt-1 text-sm text-slate-600">All fees for {formatYear(fees.year)} are paid. Thank you!</p>
            </Card>
          ) : (
            <>
              <Card className="mt-4">
                <h2 className="text-base font-semibold text-slate-900">Choose what to pay</h2>
                <p className="mt-1 text-sm text-slate-600">Fees are paid in order, oldest month first.</p>
                <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {fees.months.map((month) => {
                    const isPaid = month.due <= 0;
                    const checked = selected.includes(month.id);
                    return (
                      <li key={month.id}>
                        <label
                          className={`flex min-h-14 items-center gap-3 px-4 py-2 ${isPaid ? 'bg-slate-50' : 'cursor-pointer hover:bg-indigo-50/40'}`}
                        >
                          {isPaid ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                              <Check className="h-4 w-4" aria-hidden />
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMonth(month.id)}
                              className="h-6 w-6 shrink-0 rounded-md border-slate-300 accent-indigo-600"
                            />
                          )}
                          <span className="flex-1">
                            <span className={`block text-base font-medium ${isPaid ? 'text-slate-500' : 'text-slate-900'}`}>
                              {month.label}
                            </span>
                            {month.paid > 0 && !isPaid && (
                              <span className="block text-xs text-slate-500">{formatRupees(month.paid)} already paid</span>
                            )}
                          </span>
                          {isPaid ? (
                            <span className="text-sm font-medium text-emerald-700">Paid</span>
                          ) : (
                            <span className="font-mono text-base font-medium tabular-nums text-slate-900">
                              {formatRupees(month.due)}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>

                {!fees.fixed && (
                  <div className="mt-4">
                    {customAmount === null ? (
                      <button
                        type="button"
                        onClick={() => setCustomAmount(String(monthsTotal || fees.due))}
                        className="text-sm font-medium text-indigo-600 underline-offset-4 hover:underline"
                      >
                        Pay a different amount
                      </button>
                    ) : (
                      <div>
                        <label htmlFor="amount" className="text-sm font-medium text-slate-800">
                          Amount to pay
                        </label>
                        <div className="mt-2 flex h-14 items-center rounded-xl border border-slate-300 bg-white px-4 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
                          <span className="pr-2 text-lg text-slate-500">₹</span>
                          <input
                            id="amount"
                            inputMode="decimal"
                            value={customAmount}
                            onChange={(event) => setCustomAmount(event.target.value.replace(/[^\d.]/g, ''))}
                            className="h-full w-full bg-transparent font-mono text-lg text-slate-900 outline-none"
                          />
                        </div>
                        {!amountValid && (
                          <p className="mt-2 text-sm text-red-600">Enter an amount between ₹1 and {formatRupees(fees.due)}.</p>
                        )}
                        <button
                          type="button"
                          onClick={() => setCustomAmount(null)}
                          className="mt-2 text-sm font-medium text-indigo-600 underline-offset-4 hover:underline"
                        >
                          Use selected months instead
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* On phones the action stays under the thumb; from sm up it sits in the flow. */}
              <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:static sm:mt-4 sm:border-0 sm:bg-transparent sm:p-0">
                <div className="mx-auto max-w-lg">
                  <PrimaryButton onClick={() => void pay()} disabled={!amountValid || busy}>
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                    {amountValid ? `Pay ${formatRupees(amount, amount % 1 !== 0)}` : 'Select months to pay'}
                  </PrimaryButton>
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Secure payment by your school&apos;s bank
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'done' && outcome && fees && <Done outcome={outcome} studentName={fees.student.name} onAgain={restart} />}
    </Shell>
  );
}

function Done({ outcome, studentName, onAgain }: { outcome: PayOutcome; studentName: string; onAgain: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const paid = outcome.state === 'paid';
  return (
    <>
      <Card className="text-center">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${paid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}
        >
          {paid ? <CheckCircle2 className="h-8 w-8" aria-hidden /> : <Clock className="h-8 w-8" aria-hidden />}
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
          {paid ? 'Payment received' : 'Payment received, receipt on its way'}
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          {paid
            ? `Thank you. The fees for ${studentName} have been recorded.`
            : `Your payment for ${studentName} went through. The receipt is still being prepared; please do not pay again.`}
        </p>
        <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 text-left text-sm">
          <Row label="Amount paid" value={formatRupees(outcome.amount, outcome.amount % 1 !== 0)} strong />
          {outcome.receiptNo ? <Row label="Receipt no." value={outcome.receiptNo} mono /> : null}
          <Row label="Payment reference" value={outcome.reference} mono />
        </dl>
      </Card>

      {outcome.receiptHtml ? (
        <Card className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900">Receipt</h2>
            <button
              type="button"
              onClick={() => frame.current?.contentWindow?.print()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" aria-hidden /> Print or save
            </button>
          </div>
          <iframe
            ref={frame}
            title="Fee receipt"
            sandbox="allow-same-origin allow-modals"
            srcDoc={outcome.receiptHtml}
            className="mt-4 h-[28rem] w-full rounded-lg border border-slate-200 bg-white"
          />
        </Card>
      ) : null}

      <button type="button" onClick={onAgain} className="mt-5 w-full text-center text-sm font-medium text-indigo-600 hover:underline">
        Pay for another child
      </button>
    </>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="text-slate-600">{label}</dt>
      <dd className={`break-all text-right ${strong ? 'text-lg font-semibold' : 'font-medium'} ${mono ? 'font-mono' : ''} text-slate-900`}>
        {value}
      </dd>
    </div>
  );
}

function Shell({ children, school }: { children: React.ReactNode; school?: string }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <School className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{school ?? 'School fees'}</p>
            <p className="text-xs text-slate-500">Online fee payment</p>
          </div>
          <Lock className="h-4 w-4 text-slate-400" aria-label="Secure" />
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}>{children}</section>;
}

function Stepper({ index }: { index: number }) {
  return (
    <ol className="mb-5 flex items-center gap-2" aria-label="Progress">
      {STEPS.map((item, i) => (
        <li key={item.key} className="flex flex-1 items-center gap-2" aria-current={i === index ? 'step' : undefined}>
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              i < index ? 'bg-indigo-600 text-white' : i === index ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {i < index ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
          </span>
          <span className={`text-xs font-medium ${i === index ? 'text-slate-900' : 'text-slate-500'}`}>{item.label}</span>
          {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="-ml-1 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Back
    </button>
  );
}

function PrimaryButton({ className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-base font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none ${className}`}
    />
  );
}
