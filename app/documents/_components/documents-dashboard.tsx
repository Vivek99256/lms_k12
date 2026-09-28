'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  ExternalLink,
  FileText,
  GraduationCap,
  Loader2,
  Megaphone,
  ReceiptIndianRupee,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import { PageFrame, PageHeader, InlineMessage } from '@/app/fees/_components/fees-shared';
import { Button } from '@/components/ui/button';
import { useSelectedAcademicYear } from '@/lib/academic-year';
import {
  fetchOverview,
  fetchRecent,
  type DocumentDomain,
  type DocumentRow,
  type DocumentsOverview,
} from '@/app/documents/_lib/documents-api';
import { AllWidgetsHiddenNotice, CustomizeDashboard } from '@/app/dashboard/_components/CustomizeDashboard';
import { useDashboardPreferences } from '@/app/dashboard/_lib/useDashboardPreferences';
import { toWidgetId, type DashboardWidget } from '@/app/dashboard/_lib/dashboard-preferences';

/**
 * The Document module's landing page — a card grid over the document sources the
 * ERP already holds.
 *
 * SHAPE BORROWED FROM INTEGRATION, DELIBERATELY. Integration Management
 * (app/task-management/administration/integration) is the same problem: a
 * catalogue of things that each live somewhere else, presented as cards, where
 * clicking one is a real navigation rather than an inline panel. Reusing that
 * shape means an administrator who has used Integration already knows how to use
 * this, and it meant no new card, frame or header component had to be written.
 *
 * THIS SCREEN OWNS NOTHING. Counts are read from /api/documents/sources, which
 * selects from tables other modules write. There is no upload control here and
 * no delete control, because those still belong to the module that owns the
 * record — every row and every card offers a way back to that module instead.
 */

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  'graduation-cap': GraduationCap,
  briefcase: Briefcase,
  'book-open': BookOpen,
  'receipt-indian-rupee': ReceiptIndianRupee,
  megaphone: Megaphone,
  'shield-check': ShieldCheck,
};

function domainIcon(name: string): LucideIcon {
  return DOMAIN_ICONS[name] ?? FileText;
}

/** A domain card's Customize id, from the backend's stable domain key. Stored per user — don't change it. */
function domainWidgetId(domain: DocumentDomain): string {
  return toWidgetId('panel', 'domain', domain.key);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-IN').format(value);
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DomainCard({ domain, onOpen }: { domain: DocumentDomain; onOpen: (source: string) => void }) {
  const Icon = domainIcon(domain.icon);
  const empty = domain.total === 0;

  return (
    <section className="flex flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
          {/* eslint-disable-next-line react-hooks/static-components -- a lookup into the module-level DOMAIN_ICONS map */}
          <Icon className="size-4.5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-950">{domain.label}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">{domain.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700">
          {formatCount(domain.total)}
        </span>
      </div>

      <div className="flex-1 p-2">
        {domain.sources.length === 0 ? (
          <p className="px-2 py-3 text-xs text-slate-500">No sources available in this database.</p>
        ) : (
          <ul className="space-y-0.5">
            {domain.sources.map((source) => (
              <li key={source.key}>
                <button
                  type="button"
                  onClick={() => onOpen(source.key)}
                  disabled={source.count === 0}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
                >
                  <span className="truncate">{source.label}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="tabular-nums text-xs font-semibold text-slate-500">
                      {formatCount(source.count)}
                    </span>
                    {source.count > 0 && <ArrowUpRight className="size-3.5 text-slate-400" />}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {empty && (
        <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          Nothing recorded for the selected year.
        </p>
      )}
    </section>
  );
}

function RecentList({ rows }: { rows: DocumentRow[] }) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-slate-500">No documents recorded yet.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row, index) => (
        <li key={`${row.sourceKey ?? 'row'}-${row.id ?? index}`} className="flex items-center gap-3 px-4 py-2.5">
          <FileText className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{row.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {row.sourceLabel ?? '—'} · {formatDate(row.createdAt)}
            </p>
          </div>
          {row.url && (
            <a
              href={row.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label={`Open ${row.title}`}
            >
              <ExternalLink className="size-4" strokeWidth={1.75} />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DocumentsDashboard() {
  const router = useRouter();

  /**
   * The header's academic year, and the only year this screen knows about.
   *
   * `useSelectedAcademicYear` re-renders this component when the header
   * switches, which localStorage alone cannot do — `storage` fires only in
   * OTHER tabs. Without it this screen kept rendering the year it first loaded
   * with, because nothing told it anything had changed.
   */
  const syear = useSelectedAcademicYear();

  const [overview, setOverview] = useState<DocumentsOverview | null>(null);
  const [recent, setRecent] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    /*
     * Clear before fetching, not after. `load` re-runs when the year changes,
     * and leaving the previous year's counts on screen during the request shows
     * figures attributed to a year they do not belong to — briefly, but a count
     * under the wrong heading is worse than an empty one.
     */
    setOverview(null);
    setRecent([]);

    try {
      // Both in flight together: the dashboard is unusable until the counts
      // arrive, and making the recent list wait for them would double the
      // time before anything renders.
      const [overviewResult, recentResult] = await Promise.all([
        fetchOverview(syear),
        fetchRecent(8, syear).catch(() => [] as DocumentRow[]),
      ]);
      setOverview(overviewResult);
      setRecent(recentResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The document sources could not be loaded.');
      setOverview(null);
    } finally {
      setLoading(false);
    }
    // `syear` in the dependency list is what makes this a year-aware screen:
    // useCallback's deps are this component's cache key, and omitting the year
    // meant `load` was created once and never re-ran for a new one.
  }, [syear]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const openSource = useCallback(
    (source: string) => router.push(`/documents/${source}`),
    [router],
  );

  /** Domains that hold documents but cannot answer "in which year?". */
  const unscopedDomains = useMemo(
    () =>
      (overview?.domains ?? [])
        .filter((domain) => domain.sources.length > 0 && !domain.yearScoped)
        .map((domain) => domain.label),
    [overview],
  );

  /** Everything on this dashboard a user can hide for themselves. Ids are stored per user — don't rename them. */
  const widgets = useMemo<DashboardWidget[]>(
    () => [
      { id: 'panel.total_documents', label: 'Total documents', group: 'panel' },
      ...(overview?.domains ?? []).map((domain): DashboardWidget => ({
        id: domainWidgetId(domain),
        label: domain.label,
        group: 'panel',
      })),
      { id: 'panel.recently_added', label: 'Recently added', group: 'panel' },
    ],
    [overview],
  );
  const prefs = useDashboardPreferences('module.documents', widgets);
  const show = prefs.isVisible;
  const visibleDomains = (overview?.domains ?? []).filter((domain) => show(domainWidgetId(domain)));

  return (
    <PageFrame>
      <PageHeader
        title="Documents"
        description="Every document the ERP already holds, in one place. Records stay with the module that owns them — this view reads, it does not change anything."
        action={
          <div className="flex gap-2">
            {prefs.ready && <CustomizeDashboard widgets={widgets} {...prefs.customizeProps} size="sm" />}
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Refresh
            </Button>
          </div>
        }
      />

      {error && <InlineMessage type="error" text={error} />}

      {/* Wait for the user's layout too, so hidden widgets never flash in. */}
      {(loading && !overview) || (!prefs.ready && !error) ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <Loader2 className="size-5 animate-spin text-slate-400" />
        </div>
      ) : overview ? (
        <>
          {!prefs.hasVisible() && <AllWidgetsHiddenNotice />}

          {show('panel.total_documents') && (
            <section className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-sm text-slate-600">
                <span className="text-base font-bold tabular-nums text-slate-950">
                  {formatCount(overview.total)}
                </span>{' '}
                documents across {overview.domains.filter((d) => d.sources.length > 0).length} areas
                {overview.syear ? ` · academic year ${overview.syear}` : ''}
              </p>

              {/*
                Without this line the screen looks broken. Changing the year moves
                only the cards whose tables carry a syear; the rest hold the same
                number, and an unexplained unchanged count reads as a filter that
                did not work rather than as data that has no year to filter on.
              */}
              {overview.syear && unscopedDomains.length > 0 && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Not dated by academic year: {unscopedDomains.join(', ')}. These records carry no
                  year, so their counts are the same whichever year is selected.
                </p>
              )}
            </section>
          )}

          {/*
            A source whose table is not in this database is named rather than
            quietly dropped: an absent card and an empty card look identical,
            and only one of them is a reason to call someone.
          */}
          {overview.unavailableSources.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
              <p>
                Not available in this database:{' '}
                <span className="font-medium">{overview.unavailableSources.join(', ')}</span>. These
                sources are registered but their tables are not present.
              </p>
            </div>
          )}

          {visibleDomains.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleDomains.map((domain) => (
                <DomainCard key={domain.key} domain={domain} onOpen={openSource} />
              ))}
            </div>
          )}

          {show('panel.recently_added') && (
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-950">Recently added</h2>
                <p className="mt-1 text-xs text-slate-600">
                  The newest documents across every source.
                </p>
              </div>
              <RecentList rows={recent} />
            </section>
          )}
        </>
      ) : null}
    </PageFrame>
  );
}

export default DocumentsDashboard;
