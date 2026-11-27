'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { PlatformApiError, submitConcessionRequest, type WorkflowRun } from '@/lib/platform/client';
import type { ConcessionKind } from '@/lib/platform/types';

/**
 * The one place a concession or refund is actually requested, reused by:
 * Family & Sibling Groups and Largest Fee Arrears (concession, from the
 * tenant-wide widget), and Fees Collect / Cancel-refund (either kind, from a
 * student's own page). The tier line is the same ₹5,000 / ₹25,000 rule
 * `EscalationReportPanel` renders from the server — computed here client-side
 * only as a preview, never as something the server is asked to trust.
 */

export interface RefundHeadOption {
  label: string;
  /** What this head can still be refunded — the amount field never goes above it. */
  amount: number;
}

export interface RequestConcessionDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (run: WorkflowRun) => void;
  studentId: number;
  studentName?: string;
  kind: ConcessionKind;
  /** Refund only — the fee heads this student actually paid, keyed the same way the save-refund call keys `refund_amount[]`. */
  refundHeads?: Record<string, RefundHeadOption>;
  /** Refund only — pre-fill from whatever the caller's own form already has typed in. */
  initialAmounts?: Record<string, number>;
}

function tierFor(amount: number): 'Accounts' | 'Principal' | 'Trustee' {
  if (amount <= 5000) return 'Accounts';
  if (amount <= 25000) return 'Principal';
  return 'Trustee';
}

function inr(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export function RequestConcessionDialog({
  open,
  onClose,
  onSuccess,
  studentId,
  studentName,
  kind,
  refundHeads,
  initialAmounts,
}: RequestConcessionDialogProps) {
  const [amount, setAmount] = useState('');
  const [headAmounts, setHeadAmounts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Reset once per open, not on every keystroke a parent re-render might
  // cause — keyed only on `open` so typing in `initialAmounts`' source form
  // (if the caller re-renders while this is open) cannot stomp on what the
  // operator is typing in here.
  useEffect(() => {
    if (!open) return;
    setAmount('');
    setReason('');
    setError('');
    if (kind === 'refund' && refundHeads) {
      setHeadAmounts(
        Object.fromEntries(
          Object.keys(refundHeads).map((key) => [key, String(initialAmounts?.[key] ?? refundHeads[key].amount)]),
        ),
      );
    } else {
      setHeadAmounts({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const totalAmount = useMemo(() => {
    if (kind === 'concession') return Number(amount) || 0;
    return Object.values(headAmounts).reduce((sum, value) => sum + (Number(value) || 0), 0);
  }, [kind, amount, headAmounts]);

  const tier = tierFor(totalAmount);
  const canSubmit = totalAmount > 0 && reason.trim().length > 0 && !busy;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const run = await submitConcessionRequest(
        kind === 'concession'
          ? { kind, student_id: studentId, amount: totalAmount, reason: reason.trim() }
          : {
              kind,
              student_id: studentId,
              reason: reason.trim(),
              refund_heads: Object.fromEntries(
                Object.entries(headAmounts)
                  .map(([key, value]) => [key, Number(value) || 0] as const)
                  .filter(([, value]) => value > 0),
              ),
            },
      );
      onSuccess(run);
    } catch (cause) {
      setError(cause instanceof PlatformApiError ? cause.message : "Couldn't submit the request. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === 'concession' ? 'Request a fee concession' : 'Submit the refund for approval'}</DialogTitle>
          <DialogDescription>
            {studentName ? `${studentName} · ` : ''}Goes through the Fees {kind} approval chain before it is applied.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {kind === 'concession' ? (
            <div className="space-y-1.5">
              <Label htmlFor="concession-amount">Concession amount</Label>
              <Input
                id="concession-amount"
                type="number"
                min="0"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Refund amount per fee head</Label>
              {refundHeads && Object.keys(refundHeads).length > 0 ? (
                Object.entries(refundHeads).map(([key, head]) => (
                  <div key={key} className="grid grid-cols-[1fr_140px] items-center gap-2">
                    <span className="text-sm text-slate-700">
                      {head.label} <span className="text-xs text-slate-500">(paid: {inr(head.amount)})</span>
                    </span>
                    <Input
                      type="number"
                      min="0"
                      max={head.amount}
                      value={headAmounts[key] ?? ''}
                      onChange={(event) => {
                        const capped = Math.min(Math.max(Number(event.target.value) || 0, 0), head.amount);
                        setHeadAmounts((current) => ({ ...current, [key]: String(capped) }));
                      }}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No refundable fee heads were supplied for this student.</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="concession-reason">Reason</Label>
            <Textarea
              id="concession-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why this concession or refund is being requested"
            />
          </div>

          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {inr(totalAmount)} routes to <strong>{tier}</strong> sign-off under the ₹5,000 / ₹25,000 escalation rule.
          </p>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
