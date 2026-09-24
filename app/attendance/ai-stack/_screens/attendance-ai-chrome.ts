'use client';

/**
 * The chrome every Attendance → AI Stack screen shares.
 *
 * WHY THIS IS A RE-EXPORT AND NOT A SECOND COPY
 *
 * `app/fees/ai-stack/_screens/fees-ai-chrome.tsx` is pure presentation — a header strip,
 * a card, a pill, a table head, an `en-IN` date. It contains no fee logic, fetches
 * nothing, and knows about no tab. Copying two hundred lines of Tailwind so that the
 * attendance screens could have their own identical header is how two modules end up
 * looking subtly different after a design tweak lands in one of them.
 *
 * So the Attendance screens import it, and this file is the seam that lets them do so
 * under names that read correctly on an attendance screen. Nothing in the Fees folder is
 * modified, nothing there imports from here, and a change to the shared chrome reaches
 * both modules at once — which is the point.
 *
 * If a third module needs this, move the component out of the Fees folder and leave a
 * re-export behind in its place. That is a refactor with two callers to check, which is
 * exactly when it is worth doing, and not before.
 */

export {
  FeesAiCard as AiStackCard,
  FeesAiCardHeading as AiStackCardHeading,
  FeesAiEmpty as AiStackEmpty,
  FeesAiError as AiStackError,
  FeesAiHeader as AiStackHeader,
  FeesAiHint as AiStackHint,
  FeesAiLoading as AiStackLoading,
  FeesAiMetrics as AiStackMetrics,
  FeesAiNotice as AiStackNotice,
  FeesAiPill as AiStackPill,
  FeesAiTableHead as AiStackTableHead,
  formatWhen,
} from '@/app/fees/ai-stack/_screens/fees-ai-chrome';
