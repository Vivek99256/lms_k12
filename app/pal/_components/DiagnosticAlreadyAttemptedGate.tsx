import Link from 'next/link';

import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LevelBadge } from '@/app/pal/_components/BandMeter';
import { formatDate, ordinal } from '@/app/pal/_lib/format';
import type { PreviousDiagnosticAttempt } from '@/app/pal/data/pal-diagnostic';

/**
 * Shown on the diagnostic entry screen instead of a fresh paper when a
 * submitted attempt already exists and the learner has not asked to retake.
 * Replaces silently drafting a second attempt over a result the learner has
 * not seen yet - see DiagnosticService::previousAttempt() on the backend.
 */
export function DiagnosticAlreadyAttemptedGate({
  previous,
  onRetake,
}: {
  previous: PreviousDiagnosticAttempt;
  onRetake: () => void;
}) {
  return (
    <Card className="border-violet-200 bg-violet-50">
      <CardHeader>
        <CardTitle className="text-base text-violet-900">
          Diagnostic Status: Already Attempted
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-violet-700">Last Attempt</dt>
            <dd className="mt-0.5 font-semibold text-violet-900">
              {previous.attemptNumber != null ? `${ordinal(previous.attemptNumber)} Attempt` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-violet-700">Score</dt>
            <dd className="mt-0.5 font-semibold text-violet-900">
              {previous.correct}/{previous.totalQuestions}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-violet-700">Percentage</dt>
            <dd className="mt-0.5 font-semibold text-violet-900">{Math.round(previous.percentage)}%</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-violet-700">Diagnostic Level</dt>
            <dd className="mt-0.5">
              <LevelBadge level={previous.level} />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-violet-700">Attempted On</dt>
            <dd className="mt-0.5 font-semibold text-violet-900">{formatDate(previous.submittedAt)}</dd>
          </div>
        </dl>

        <p className="text-sm text-violet-800">
          You have already attempted this diagnostic once. If you want to take the diagnostic again,
          you can start a new attempt here.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button onClick={onRetake}>Retake Diagnostic</Button>
          <Link
            href={`/pal/diagnostic/result/${previous.attemptId}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            View previous result
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
