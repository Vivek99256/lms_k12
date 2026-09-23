'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, FileText, Loader2 } from 'lucide-react';

import { mapApiIconToComponent } from '@/app/data/menuMappers';
import {
  fetchFeesMenuCategories,
  type FeesCategory,
  type FeesCategoryItem,
} from '@/app/fees/_lib/fees-menu-categories-api';
import { getFeesSession, type FeesSession } from '@/app/fees/_lib/fees-api';
import { PageFrame, PageHeader } from '@/app/fees/_components/fees-shared';

type LoadState = 'loading' | 'ready' | 'error';

const CATEGORY_KEY = 'help-guide-support';

/**
 * Sample cards shown when the backend has not yet configured any
 * help-guide-support menu rows. The links below are placeholders — replace
 * them with the real PDF / video / FAQ / ticket URLs from tblmenumaster once
 * the backend is seeded.
 */
const SAMPLE_ITEMS: FeesCategoryItem[] = [
  {
    id: 1,
    label: 'PDF',
    name: 'PDF',
    link: '#',
    icon: 'mdi mdi-file-pdf',
    description: 'Downloadable PDF guides and reference documents.',
    text: null,
    youtubeLink: null,
    pdfLink: '#',
    quickMenu: null,
    dashboardMenu: null,
  },
  {
    id: 2,
    label: 'VIDEO',
    name: 'VIDEO',
    link: '#',
    icon: 'mdi mdi-play-circle',
    description: 'Video walkthroughs and tutorial recordings.',
    text: null,
    youtubeLink: '#',
    pdfLink: null,
    quickMenu: null,
    dashboardMenu: null,
  },
  {
    id: 3,
    label: 'FAQ',
    name: 'FAQ',
    link: '#',
    icon: 'mdi mdi-help-circle',
    description: 'Frequently asked questions and quick answers.',
    text: null,
    youtubeLink: null,
    pdfLink: null,
    quickMenu: null,
    dashboardMenu: null,
  },
  {
    id: 4,
    label: 'RAISE A TICKET',
    name: 'RAISE A TICKET',
    link: '#',
    icon: 'mdi mdi-ticket',
    description: 'Report an issue and open a support ticket.',
    text: null,
    youtubeLink: null,
    pdfLink: null,
    quickMenu: null,
    dashboardMenu: null,
  },
];

/**
 * One help-guide thumbnail card.
 *
 * Renders as an `<a>` so the configured PDF / video / document link opens in a
 * new tab. Icon, title and description all come from tblmenumaster fields
 * (icon, name/label, description/text) — nothing is hard-coded in the layout.
 */
function HelpGuideCard({ item }: { item: FeesCategoryItem }) {
  const title = item.label || item.name || '';
  const description = item.description || item.text || '';

  const IconComponent = useMemo(() => {
    if (!item.icon) return null;
    return mapApiIconToComponent(item.icon, 2) ?? null;
  }, [item.icon]);

  const href = useMemo(() => {
    return item.youtubeLink || item.pdfLink || item.link || '#';
  }, [item.youtubeLink, item.pdfLink, item.link]);

  const isExternal = href.startsWith('http');

  return (
    <a
      href={href}
      target={isExternal ? '_blank' : '_self'}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="group/card flex h-full flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-[#5846EA]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5846EA]/40"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#5846EA]/20 bg-[#5846EA]/10 text-[#5846EA]">
        {IconComponent ? <IconComponent size={20} /> : <FileText size={20} />}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <h3 className="text-sm font-semibold leading-tight text-slate-950">
          {title || 'Untitled'}
        </h3>
        {description ? (
          <p className="text-xs leading-relaxed text-slate-600">{description}</p>
        ) : null}
      </div>

      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#5846EA] opacity-0 transition-opacity group-hover/card:opacity-100">
        Open <FileText size={12} />
      </span>
    </a>
  );
}

/**
 * Help Guide / Support — clean Grid/Thumbnail view.
 *
 * Replaces the former tab-based static placeholder surface. Content is loaded
 * dynamically from tblmenumaster via the existing /api/fees/menu-categories
 * proxy. When the backend has no configured items yet, a set of sample cards
 * (PDF, VIDEO, FAQ, RAISE A TICKET) is shown so the layout is never empty.
 *
 * The page renders only the grid — all other tab menus are removed.
 */
export function HelpGuideGrid() {
  const [session, setSession] = useState<FeesSession | null>(null);
  const [category, setCategory] = useState<FeesCategory | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(getFeesSession());
  }, []);

  useEffect(() => {
    if (!session) return;

    if (!session.subInstituteId || !session.userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState('error');
      setError('No active session found. Sign in again to load the help guide.');
      return;
    }

    const controller = new AbortController();

    void (async () => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState('loading');
      setError('');
      try {
        const categories = await fetchFeesMenuCategories(session, controller.signal);
        if (controller.signal.aborted) return;

        const found = categories.find((entry) => entry.key === CATEGORY_KEY) ?? null;
        setCategory(found);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState('ready');
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error ? caught.message : 'Unable to load the help guide.');
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState('error');
      }
    })();

    return () => controller.abort();
  }, [session]);

  /** Use live tblmenumaster data when available; fall back to sample cards. */
  const items = useMemo(() => {
    return category?.items.length ? category.items : SAMPLE_ITEMS;
  }, [category]);

  const showSampleFallback = useMemo(() => state === 'ready' && !category?.items.length, [state, category]);

  return (
    <PageFrame>
      <PageHeader
        title="Help Guide / Support"
        description="Browse help content, guides, and support resources for the Fees module."
      />

      {state === 'loading' && items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading help content…
        </div>
      ) : null}

      {state === 'error' && items.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error || 'Unable to load the help guide.'}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <HelpGuideCard key={item.id} item={item} />
        ))}
      </div>

      {showSampleFallback ? (
        <p className="mt-4 text-center text-xs text-slate-500">
          Showing content — the links will be populated from tblmenumaster once configured.
        </p>
      ) : null}
    </PageFrame>
  );
}
