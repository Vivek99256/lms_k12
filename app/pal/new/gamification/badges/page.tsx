'use client';

import { useMemo, useState } from 'react';
import { Award, Lock, X } from 'lucide-react';

import {
  EmptyState,
  GamificationTabs,
  PageShell,
  Pill,
  PrivacyNote,
  QuestHero,
  SectionCard,
  StatusPanel,
} from '../_components/GamificationChrome';
import { LearnerRequiredPanel, ScopeBar } from '../_components/GamificationScope';
import { useGamificationResource } from '../_components/useGamificationResource';
import {
  fetchBadges,
  formatDate,
  type BadgeCollection,
  type BadgeEntry,
} from '@/app/pal/new/data/gamification';

/**
 * New PAL → Gamification → Badges.
 *
 * The catalogue is served, never listed here: adding a badge to
 * config/pal_gamification.php makes it appear on this page with no frontend
 * change. Each card carries the badge's HPC / CASEL / NCDG mapping because a
 * badge in PAL V4 is portfolio evidence rather than a sticker.
 *
 * Unearned badges are shown deliberately — a visible, reachable next step is
 * the point of the catalogue. What is never shown is anybody else's collection,
 * or a "most badges" ranking of any kind.
 */
export default function BadgesPage() {
  const { state, data, error, reload, refreshing, scope } = useGamificationResource<BadgeCollection>(
    (learnerScope, signal) => fetchBadges(learnerScope, signal)
  );

  const [category, setCategory] = useState<string>('all');
  const [selected, setSelected] = useState<BadgeEntry | null>(null);

  const filtered = useMemo(() => {
    if (data === null) return { earned: [], available: [] };
    const match = (badge: BadgeEntry) => category === 'all' || badge.category === category;
    return {
      earned: data.earned.filter(match),
      available: data.available.filter(match),
    };
  }, [data, category]);

  if (state === 'needs-learner') {
    return <LearnerRequiredPanel onSelect={scope.chooseStudent} />;
  }

  if (state === 'loading') {
    return (
      <PageShell>
        <StatusPanel
          kind="loading"
          title="Loading badges"
          message="Evaluating every badge rule against this learner's real activity."
        />
      </PageShell>
    );
  }

  if (state === 'error' || data === null) {
    return (
      <PageShell>
        <StatusPanel
          kind="error"
          title="Badges are not available"
          message={error || 'The backend did not return a badge payload.'}
          onRetry={reload}
          retrying={refreshing}
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <ScopeBar student={scope.student} onExit={scope.clearStudent} />

      <QuestHero
        title="Badges"
        subtitle="Every badge is a rule evaluated against real learning, and maps to an HPC domain, a CASEL competency or an NCDG goal. None is granted as a welcome gift, and none can be earned by repeating easy content."
        metrics={[
          { label: 'Earned', value: String(data.totalEarned) },
          { label: 'In catalogue', value: String(data.totalAvailable) },
          {
            label: 'Categories',
            value: String(data.categories.length),
            hint: 'Mastery, fluency, persistence, curiosity, social, career',
          },
        ]}
        onRefresh={reload}
        refreshing={refreshing}
      />

      <GamificationTabs />

      {/* --- category filter ------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCategory('all')}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
            category === 'all'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
          }`}
        >
          All ({data.totalEarned}/{data.totalAvailable})
        </button>
        {data.categories.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setCategory(entry.key)}
            title={entry.blurb}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              category === entry.key
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300'
            }`}
          >
            {entry.label} ({entry.earned}/{entry.total})
          </button>
        ))}
      </div>

      <SectionCard
        title="Earned"
        description="Badges never expire and are never taken away, except by a teacher who judges one was gamed."
      >
        {filtered.earned.length === 0 ? (
          <EmptyState
            title="No badges earned in this category yet"
            message="Badges appear here the moment their rule is genuinely met. Until then this space stays honestly empty."
            icon={<Award className="h-5 w-5" />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.earned.map((badge) => (
              <BadgeCard key={badge.badgeId} badge={badge} onOpen={() => setSelected(badge)} />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Still to earn"
        description="Shown on purpose — a reachable next step is what makes a catalogue useful. No badge here is locked behind anything but real learning."
        tone="muted"
      >
        {filtered.available.length === 0 ? (
          <EmptyState
            title="Every badge in this category is earned"
            message="There is nothing left to unlock here."
            icon={<Award className="h-5 w-5" />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.available.map((badge) => (
              <BadgeCard key={badge.badgeId} badge={badge} onOpen={() => setSelected(badge)} />
            ))}
          </div>
        )}
      </SectionCard>

      <PrivacyNote>
        <strong className="font-semibold text-slate-800">Badges are evidence, not a scoreboard.</strong>{' '}
        They do not appear on a public class wall, they never create a &quot;most badges&quot; ranking,
        and no student can see another student&apos;s collection. Their real audience is the HPC
        portfolio, the parent digest and the Career Pathway Report.
      </PrivacyNote>

      {selected ? <BadgeDetailModal badge={selected} onClose={() => setSelected(null)} /> : null}
    </PageShell>
  );
}

function BadgeCard({ badge, onOpen }: { badge: BadgeEntry; onOpen: () => void }) {
  const rarityTone =
    badge.rarity === 'legendary'
      ? 'amber'
      : badge.rarity === 'rare'
        ? 'sky'
        : badge.rarity === 'uncommon'
          ? 'emerald'
          : 'slate';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group w-full rounded-2xl border p-4 text-left shadow-[0_6px_14px_rgba(15,23,42,0.04)] transition ${
        badge.earned
          ? 'border-slate-200 bg-white hover:border-amber-300'
          : 'border-dashed border-slate-200 bg-white/60 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            badge.earned ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'
          }`}
        >
          {badge.earned ? <Award className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={`truncate text-sm font-semibold ${badge.earned ? 'text-slate-900' : 'text-slate-500'}`}
            >
              {badge.name}
            </p>
            {badge.timesEarned > 1 ? <Pill label={`×${badge.timesEarned}`} tone="amber" /> : null}
          </div>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            {badge.earned ? badge.awards[0]?.studentMessage || badge.description : badge.description}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill label={badge.rarity} tone={rarityTone as 'amber' | 'sky' | 'emerald' | 'slate'} />
        {badge.hpcDomain ? <Pill label={`HPC · ${labelise(badge.hpcDomain)}`} tone="slate" /> : null}
        {badge.caselDomain ? <Pill label={`CASEL · ${labelise(badge.caselDomain)}`} tone="slate" /> : null}
        {badge.ncdgGoal ? <Pill label={`NCDG · ${badge.ncdgGoal}`} tone="slate" /> : null}
        {badge.challengeModeOnly ? <Pill label="Challenge mode only" tone="rose" /> : null}
      </div>

      {badge.earned && badge.awards[0]?.awardedAt ? (
        <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-400">
          Earned {formatDate(badge.awards[0].awardedAt)}
        </p>
      ) : null}
    </button>
  );
}

function BadgeDetailModal({ badge, onClose }: { badge: BadgeEntry; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[24px] border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                badge.earned ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {badge.earned ? <Award className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
            </span>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{badge.name}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{badge.categoryLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-700">{badge.description}</p>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <Detail label="HPC domain" value={badge.hpcDomain ? labelise(badge.hpcDomain) : '—'} />
          <Detail label="CASEL competency" value={badge.caselDomain ? labelise(badge.caselDomain) : '—'} />
          <Detail label="NCDG goal" value={badge.ncdgGoal || '—'} />
          <Detail label="Portfolio weight" value={badge.hpcEvidenceWeight.toFixed(1)} />
        </dl>

        {badge.earned ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              Earned {badge.timesEarned > 1 ? `${badge.timesEarned} times` : ''}
            </p>
            <ul className="mt-2 space-y-2">
              {badge.awards.map((award) => (
                <li key={`${award.scopeKey}:${award.awardedAt}`} className="text-sm leading-5 text-amber-900">
                  {award.studentMessage}
                  <span className="ml-1 text-[11px] text-amber-700/80">({formatDate(award.awardedAt)})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-5 text-slate-600">
            Not earned yet. This badge is awarded automatically the first time its rule is genuinely met —
            there is no way to claim it, and no way to earn it by repeating easy content.
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 px-3.5 py-2.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function labelise(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
