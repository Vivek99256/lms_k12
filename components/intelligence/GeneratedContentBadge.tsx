'use client';

import { Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Marks content that came from a model rather than from the record.
 *
 * The brief requires generated content to stay visibly distinguishable from
 * verified fact, and the backend enforces the same boundary — `is_generated` is
 * always true on generation output, and GroundedClaims refuses to let generated
 * evidence back a claim. This badge is that rule made visible.
 *
 * Use it on every surface that renders model output. If a piece of text could be
 * mistaken for a recorded fact, it needs this.
 */
export function GeneratedContentBadge({
  className,
  requiresReview = false,
  label,
}: {
  className?: string;
  /** The template asked for human review before this is acted on. */
  requiresReview?: boolean;
  label?: string;
}) {
  return (
    <Badge
      variant={requiresReview ? 'outline' : 'secondary'}
      className={cn('gap-1', className)}
      title={
        requiresReview
          ? 'Written by AI. Review before using — this is not a recorded fact.'
          : 'Written by AI, based on the evidence shown. Not itself a recorded fact.'
      }
    >
      <Sparkles aria-hidden className="size-3" />
      {label ?? (requiresReview ? 'AI draft — review' : 'AI generated')}
    </Badge>
  );
}

/**
 * The counterpart badge: this came from the record, and has been verified.
 *
 * Shown on evidence so the difference between "the system read this" and "the system
 * wrote this" is legible at a glance rather than inferred from styling.
 */
export function VerifiedEvidenceBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 border-emerald-300 text-emerald-700', className)}
      title="Read directly from school records."
    >
      Verified
    </Badge>
  );
}
