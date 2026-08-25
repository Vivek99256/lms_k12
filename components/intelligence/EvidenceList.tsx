'use client';

import { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EvidenceRecord } from '@/lib/intelligence/types';

import { GeneratedContentBadge, VerifiedEvidenceBadge } from './GeneratedContentBadge';

const KIND_LABELS: Record<string, string> = {
  assessment_score: 'Assessment result',
  assessment_trend: 'Assessment trend',
  attendance_rate: 'Attendance rate',
  attendance_streak: 'Consecutive absence',
  attendance_absence: 'Absence',
  assignment_completion: 'Assignment completion',
  assignment_missed: 'Incomplete assignment',
};

function formatDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * The evidence behind a finding.
 *
 * Deliberately shows provenance — which table or service a row came from and when it
 * was observed — because the point of this list is to let a teacher check the
 * system's reasoning rather than take it on trust.
 *
 * Unverified and generated items are visually separated rather than hidden. They
 * cannot back a claim, but concealing them would misrepresent what the system holds.
 */
export function EvidenceList({
  evidence,
  initialVisible = 5,
  className,
}: {
  evidence: EvidenceRecord[];
  initialVisible?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!evidence.length) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No evidence has been recorded for this yet.
      </p>
    );
  }

  const verified = evidence.filter((item) => item.verified && !item.is_generated);
  const other = evidence.filter((item) => !item.verified || item.is_generated);
  const visible = expanded ? verified : verified.slice(0, initialVisible);
  const hiddenCount = verified.length - visible.length;

  return (
    <div className={cn('space-y-3', className)}>
      <ul className="space-y-2">
        {visible.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-border bg-card p-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="font-medium text-foreground">
                {KIND_LABELS[item.kind] ?? item.kind.replace(/_/g, ' ')}
              </span>
              <div className="flex items-center gap-1.5">
                {item.numeric_value !== null && (
                  <Badge variant="outline" className="tabular-nums">
                    {item.numeric_value}
                    {item.unit === 'percent' ? '%' : item.unit ? ` ${item.unit}` : ''}
                  </Badge>
                )}
                <VerifiedEvidenceBadge />
              </div>
            </div>

            <p className="mt-1 text-muted-foreground">{item.summary}</p>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {formatDate(item.observed_at) && <span>{formatDate(item.observed_at)}</span>}
              {(item.source.table || item.source.service) && (
                <span className="inline-flex items-center gap-1">
                  <FileText aria-hidden className="size-3" />
                  {item.source.table
                    ? `${item.source.table}${item.source.id ? ` #${item.source.id}` : ''}`
                    : 'Derived'}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
          <ChevronDown aria-hidden className="size-4" />
          Show {hiddenCount} more
        </Button>
      )}

      {other.length > 0 && (
        <div className="rounded-lg border border-dashed border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Not used as evidence
            </p>
            <GeneratedContentBadge label="Unverified" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {other.length} item{other.length === 1 ? '' : 's'} the system holds but has not
            verified. These cannot support a conclusion.
          </p>
        </div>
      )}
    </div>
  );
}
