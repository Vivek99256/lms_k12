'use client';

import { AlertTriangle, Info } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { EvidenceRecord, ExplanationRecord } from '@/lib/intelligence/types';

import { GeneratedContentBadge } from './GeneratedContentBadge';

/**
 * Shows why the system reached a conclusion, claim by claim.
 *
 * Each claim is rendered with the evidence that supports it, because a narrative
 * paragraph alone would put the reader back where they started — trusting the
 * assistant. The claims are the defensible part; the narrative is the readable part.
 *
 * When an explanation failed governance it is not shown at all. Instead the reader is
 * told plainly that the system could not evidence its reasoning. That is a better
 * answer than a confident sentence with nothing behind it.
 */
export function ExplanationCard({
  explanation,
  evidence,
  className,
}: {
  explanation: ExplanationRecord | null;
  evidence: EvidenceRecord[];
  className?: string;
}) {
  if (!explanation) {
    return (
      <div className={cn('rounded-lg border border-border bg-muted/40 p-4', className)}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info aria-hidden className="size-4" />
          No explanation has been produced for this yet.
        </p>
      </div>
    );
  }

  if (!explanation.governance_passed) {
    const reason = explanation.governance_report?.violations?.[0]?.message;

    return (
      <div className={cn('rounded-lg border border-amber-300 bg-amber-50 p-4', className)}>
        <p className="flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-medium">Explanation withheld.</strong>{' '}
            {reason ??
              'The system could not support this explanation with verified evidence, so it is not being shown.'}
          </span>
        </p>
      </div>
    );
  }

  const byId = new Map(evidence.map((item) => [item.id, item]));

  return (
    <div className={cn('space-y-4 rounded-lg border border-border bg-card p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Why this was identified</h3>
        {explanation.is_generated && (
          <GeneratedContentBadge label="Wording by AI" />
        )}
      </div>

      <p className="text-sm leading-relaxed text-foreground">{explanation.narrative}</p>

      {explanation.claims.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Based on
          </p>

          <ul className="space-y-2">
            {explanation.claims.map((claim, index) => {
              const cited = claim.evidence_ids
                .map((id) => byId.get(id))
                .filter((item): item is EvidenceRecord => Boolean(item));

              return (
                <li key={index} className="text-sm">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-foreground">{claim.claim}</span>
                    {typeof claim.confidence === 'number' && (
                      <Badge variant="outline" className="tabular-nums">
                        {Math.round(claim.confidence * 100)}% confidence
                      </Badge>
                    )}
                  </div>

                  {cited.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-4">
                      {cited.map((item) => (
                        <li
                          key={item.id}
                          className="list-disc text-xs text-muted-foreground"
                        >
                          {item.summary}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {explanation.governance_report?.warnings?.length ? (
        <p className="text-xs text-muted-foreground">
          {explanation.governance_report.warnings[0].message}
        </p>
      ) : null}
    </div>
  );
}
