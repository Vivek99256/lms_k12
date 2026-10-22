'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, Flame } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityEngagement, ActivityGamification } from '@/app/pal/data/pal-activity-report';

/**
 * Two "insufficient data" placeholders, styled exactly like
 * app/pal/reports/attainment/page.tsx's own empty state (amber border/bg,
 * AlertTriangle icon) — not a new pattern.
 *
 * `engagement` has no capture path on this estate at all (see the PAL
 * Intelligence dimensions that have no writer — pal-intelligence-data-
 * lineage), so `has_sufficient_data` is expected to always read false; this
 * still checks the flag rather than hardcoding that. `gamification` DOES have
 * a real pipeline, so when it reports enough data this renders the actual
 * streak/badges instead of another placeholder — never a fabricated number.
 */
export default function EngagementPlaceholderCard({
  engagement,
  gamification,
}: {
  engagement: ActivityEngagement;
  gamification: ActivityGamification;
}) {
  return (
    <div className="space-y-4">
      {!engagement.hasSufficientData && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base text-amber-900">Engagement</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-800">
            {engagement.message ||
              'Not enough data is captured yet to report engagement for this scope.'}
          </CardContent>
        </Card>
      )}

      {gamification.hasSufficientData ? (
        <Card className="overflow-hidden border-amber-100 bg-gradient-to-br from-amber-50/60 to-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <CardHeader className="pb-2">
            <CardDescription>Gamification</CardDescription>
            <CardTitle className="text-base">Streak &amp; badges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            {gamification.streak && (
              <p className="flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-orange-500" />
                Current streak:{' '}
                <span className="font-semibold text-slate-900">
                  {gamification.streak.currentStreak ?? '—'}
                </span>
                {gamification.streak.longestStreak != null
                  ? ` · longest ${gamification.streak.longestStreak}`
                  : ''}
              </p>
            )}
            {gamification.message && (
              <p className="text-slate-500">{gamification.message}</p>
            )}
            {gamification.badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {gamification.badges.map((badge, index) => (
                  <motion.div
                    key={`${badge.badgeId}-${badge.awardedAt ?? ''}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, delay: index * 0.04, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                      {badge.name}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">No badges earned yet.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base text-amber-900">Gamification</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-800">
            {gamification.message ||
              'Not enough activity yet to report a streak or badges honestly — none are shown rather than guessed.'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
