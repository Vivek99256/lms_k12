'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Clock, Loader2, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { RecommendationRecord } from '@/lib/intelligence/types';

const RISK_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  medium: 'outline',
  high: 'destructive',
};

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'text-muted-foreground' },
  pending_approval: { label: 'Waiting for your decision', tone: 'text-amber-700' },
  approved: { label: 'Approved', tone: 'text-emerald-700' },
  rejected: { label: 'Rejected', tone: 'text-muted-foreground' },
  superseded: { label: 'Superseded', tone: 'text-muted-foreground' },
  expired: { label: 'Expired', tone: 'text-muted-foreground' },
  executed: { label: 'Actioned', tone: 'text-emerald-700' },
};

/**
 * A recommendation, and the decision a person has to make about it.
 *
 * The approve button is the human gate in the architecture, so the card is written
 * to make that gate obvious rather than frictionless: it states what will happen,
 * shows the objective the action is bound to, and never pre-selects a choice.
 *
 * A recommendation that failed governance cannot be approved and says so — the
 * buttons are absent rather than disabled, because there is nothing to enable.
 */
export function RecommendationCard({
  recommendation,
  onApprove,
  onReject,
  canDecide = true,
  className,
}: {
  recommendation: RecommendationRecord;
  onApprove?: (id: number, reason?: string) => Promise<void> | void;
  onReject?: (id: number, reason?: string) => Promise<void> | void;
  canDecide?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [showReason, setShowReason] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const status = STATUS_COPY[recommendation.status] ?? {
    label: recommendation.status,
    tone: 'text-muted-foreground',
  };

  const decidable =
    canDecide &&
    recommendation.governance_passed &&
    recommendation.status === 'pending_approval';

  async function decide(kind: 'approve' | 'reject') {
    const handler = kind === 'approve' ? onApprove : onReject;

    if (!handler) return;

    setBusy(kind);
    setError(null);

    try {
      await handler(recommendation.id, reason.trim() || undefined);
      setShowReason(null);
      setReason('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The decision could not be recorded.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{recommendation.title}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {recommendation.reference}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={RISK_VARIANT[recommendation.risk_level] ?? 'secondary'}>
            {recommendation.risk_level} risk
          </Badge>
          {typeof recommendation.confidence === 'number' && (
            <Badge variant="outline" className="tabular-nums">
              {Math.round(recommendation.confidence * 100)}%
            </Badge>
          )}
        </div>
      </div>

      {recommendation.body && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {recommendation.body}
        </p>
      )}

      {recommendation.eso_binding?.objective && (
        <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs">
          <p className="font-medium text-foreground">
            Objective: {recommendation.eso_binding.objective}
          </p>
          {recommendation.eso_binding.outcome?.metric_label && (
            <p className="mt-1 text-muted-foreground">
              Measured by {recommendation.eso_binding.outcome.metric_label}
              {recommendation.eso_binding.outcome.horizon_days
                ? ` after ${recommendation.eso_binding.outcome.horizon_days} days`
                : ''}
              .
            </p>
          )}
        </div>
      )}

      {!recommendation.governance_passed && (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>
            This recommendation did not pass governance checks and cannot be approved.
            {recommendation.governance_report?.violations?.[0]?.message
              ? ` ${recommendation.governance_report.violations[0].message}`
              : ''}
          </span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className={cn('flex items-center gap-1.5 text-xs', status.tone)}>
          <Clock aria-hidden className="size-3.5" />
          {status.label}
        </p>

        {decidable && (onApprove || onReject) && (
          <div className="flex items-center gap-2">
            {onReject && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() => setShowReason(showReason === 'reject' ? null : 'reject')}
              >
                <X aria-hidden className="size-4" />
                Reject
              </Button>
            )}
            {onApprove && (
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  showReason === 'approve' ? decide('approve') : setShowReason('approve')
                }
              >
                {busy === 'approve' ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : (
                  <Check aria-hidden className="size-4" />
                )}
                {showReason === 'approve' ? 'Confirm approval' : 'Approve'}
              </Button>
            )}
          </div>
        )}
      </div>

      {showReason && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {showReason === 'approve'
              ? 'Approving records your decision and starts the intervention workflow. Add a note if useful.'
              : 'Rejecting closes this recommendation. A note helps explain why.'}
          </p>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional note"
            rows={2}
          />
          {showReason === 'reject' && (
            <Button
              variant="destructive"
              size="sm"
              disabled={busy !== null}
              onClick={() => decide('reject')}
            >
              {busy === 'reject' && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Confirm rejection
            </Button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
