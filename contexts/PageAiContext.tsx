'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

/**
 * What the page tells the assistant it is showing.
 *
 * The route already tells the backend which module and record the user is on. It cannot
 * tell it that the list is filtered to Standard 8, that a search is active, that three
 * rows are ticked, or that the collection-rate tile reads 64% — so the page says so.
 *
 * Three properties make this safe to adopt everywhere:
 *
 *  - **Optional.** A page that registers nothing behaves exactly as it did before:
 *    route-level context, module-level suggestions.
 *  - **Descriptive only.** Nothing here grants access. The backend derives tenant scope
 *    from the JWT and re-checks every lookup, so a wrong or forged descriptor produces
 *    irrelevant suggestions, never data the user could not already read.
 *  - **Bounded.** Everything is capped and flattened before it leaves the browser. This
 *    is a summary for a prompt, not a data transfer — a grid of 500 rows sends 25 and
 *    reports the total.
 */

export type PageType = 'dashboard' | 'list' | 'detail' | 'form' | 'report' | 'settings';

export interface PageMetric {
  key: string;
  label?: string;
  value: string | number;
  unit?: string;
  trend?: string;
}

export interface PageAction {
  key: string;
  label?: string;
}

export interface PageAiDescriptor {
  /** What the user would call this screen. */
  pageTitle?: string;
  pageType?: PageType;

  /**
   * The record this page is about, when the URL does not say.
   *
   * A modal, a selected grid row, a detail panel — anywhere the page knows its subject
   * better than its path does. Resolved server-side under the caller's scope, so it
   * cannot reach a record the user may not read.
   */
  entityType?: string | null;
  entityId?: string | number | null;

  /** Active filters. Either `{ standard: '8' }` or the fuller labelled form. */
  filters?: Record<string, unknown> | Array<{ key: string; label?: string; value: unknown }>;
  searchQuery?: string | null;

  /** A window onto the rows on screen. Capped — send the shape, not the dataset. */
  records?: Array<Record<string, unknown>>;
  /** The true size of the result set, when it exceeds what is rendered. */
  recordCount?: number;

  /** Rows the user has explicitly ticked. */
  selectedRecords?: Array<{ entity?: string; id: unknown } | string | number>;

  /** KPI tiles, so the assistant can be asked about a number the user is looking at. */
  metrics?: PageMetric[] | Record<string, string | number>;

  /** What this page can do — used to answer "what can I do here?". */
  availableActions?: Array<PageAction | string>;

  /**
   * The choices the page offers, as opposed to the ones currently applied.
   *
   * On a catalogue or directory nothing is selected and nothing is filtered, so the
   * grades and categories in the sidebar are the only page-specific material there is.
   * Supply `question` to control the phrasing — `{value}` is substituted:
   *
   * ```ts
   * facets: [
   *   { key: 'grade', label: 'Grade', values: ['5', '6'],
   *     question: 'What courses are available for Grade {value}?' },
   *   { key: 'category', label: 'Category', values: ['STEM Resources'],
   *     question: 'Show me the courses available under {value}.' },
   * ]
   * ```
   */
  facets?: PageFacet[];
}

export interface PageFacet {
  key: string;
  label?: string;
  values: Array<string | number>;
  /** Prompt template; `{value}` is replaced with each value. */
  question?: string;
}

/** The descriptor as the workspace consumes it, plus the route it was registered for. */
interface StoredDescriptor extends PageAiDescriptor {
  pathname: string;
}

interface PageAiContextValue {
  descriptor: PageAiDescriptor | null;
  setPageAiContext: (pathname: string, descriptor: PageAiDescriptor | null) => void;
}

const PageAiContextObject = createContext<PageAiContextValue>({
  descriptor: null,
  setPageAiContext: () => {},
});

/** Caps, mirrored by PageSnapshot on the backend. Both ends enforce them. */
const LIMITS = {
  records: 25,
  metrics: 12,
  filters: 20,
  actions: 24,
  selected: 100,
  text: 200,
  facets: 4,
  facetValues: 8,
};

function truncate(value: unknown): string | null {
  if (value === null || value === undefined || typeof value === 'object') {
    return null;
  }

  const text = String(value).trim();
  return text ? text.slice(0, LIMITS.text) : null;
}

/**
 * Flattens the descriptor into the `page_data` shape the backend normalises.
 *
 * Done here rather than at the call site so a page can hand over whatever it already
 * has in state — a filters object, a rows array — without reshaping it first. Adoption
 * cost is the reason most context systems go unused.
 */
function toPageData(descriptor: PageAiDescriptor): Record<string, unknown> {
  const pageData: Record<string, unknown> = {};

  if (descriptor.pageTitle) pageData.page_title = truncate(descriptor.pageTitle);
  if (descriptor.pageType) pageData.page_type = descriptor.pageType;
  if (descriptor.searchQuery) pageData.search_query = truncate(descriptor.searchQuery);

  if (descriptor.filters) {
    const entries: Array<{ key: string; label?: string; value: unknown }> = Array.isArray(
      descriptor.filters
    )
      ? descriptor.filters
      : Object.entries(descriptor.filters).map(([key, value]) => ({ key, value }));

    const filters = entries
      .map((filter) => ({
        key: filter.key,
        label: filter.label,
        value: truncate(filter.value),
      }))
      // A filter set to "all" or left blank is not a filter, and describing the view by
      // it would be actively misleading.
      .filter((filter) => filter.value && !/^(all|any|-|none)$/i.test(filter.value))
      .slice(0, LIMITS.filters);

    if (filters.length) pageData.filters = filters;
  }

  if (descriptor.metrics) {
    const entries: PageMetric[] = Array.isArray(descriptor.metrics)
      ? descriptor.metrics
      : Object.entries(descriptor.metrics).map(([key, value]) => ({ key, value }));

    const metrics = entries
      .map((metric) => ({
        key: metric.key,
        label: metric.label,
        value: truncate(metric.value),
        unit: metric.unit,
        trend: metric.trend,
      }))
      .filter((metric) => metric.value !== null)
      .slice(0, LIMITS.metrics);

    if (metrics.length) pageData.metrics = metrics;
  }

  if (descriptor.records?.length) {
    pageData.records = descriptor.records.slice(0, LIMITS.records).map((record) => {
      const flattened: Record<string, unknown> = {};
      let attributes = 0;

      for (const [key, value] of Object.entries(record)) {
        if (key === 'id' || key === 'label' || key === 'name') continue;
        if (attributes >= 8) break;

        const text = truncate(value);
        if (text === null) continue;

        flattened[key] = text;
        attributes += 1;
      }

      return {
        id: record.id ?? null,
        label: truncate(record.label ?? record.name ?? null),
        ...flattened,
      };
    });
  }

  const total = descriptor.recordCount ?? descriptor.records?.length;
  if (typeof total === 'number') pageData.record_count = total;

  if (descriptor.facets?.length) {
    const facets = descriptor.facets
      .slice(0, LIMITS.facets)
      .map((facet) => ({
        key: facet.key,
        label: facet.label,
        question: facet.question,
        values: facet.values
          .map((value) => truncate(value))
          .filter((value): value is string => value !== null && !/^(all|any|none|-)$/i.test(value))
          .slice(0, LIMITS.facetValues),
      }))
      .filter((facet) => facet.values.length > 0);

    if (facets.length) pageData.facets = facets;
  }

  if (descriptor.availableActions?.length) {
    pageData.available_actions = descriptor.availableActions
      .slice(0, LIMITS.actions)
      .map((action) => (typeof action === 'string' ? { key: action } : action));
  }

  return pageData;
}

function toSelectedRecords(descriptor: PageAiDescriptor) {
  if (!descriptor.selectedRecords?.length) {
    return undefined;
  }

  return descriptor.selectedRecords.slice(0, LIMITS.selected).map((record) =>
    typeof record === 'object' && record !== null && 'id' in record
      ? { entity: record.entity, id: record.id }
      : { id: record }
  );
}

export function PageAiContextProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [stored, setStored] = useState<StoredDescriptor | null>(null);

  const setPageAiContext = useCallback(
    (registeredPath: string, descriptor: PageAiDescriptor | null) => {
      setStored(descriptor ? { ...descriptor, pathname: registeredPath } : null);
    },
    []
  );

  /*
   * A descriptor is only valid for the route that registered it.
   *
   * Navigation renders the new page before its registration effect runs, so without
   * this the assistant would briefly describe the page the user just left — and on a
   * route that registers nothing, it would keep describing it indefinitely. Comparing
   * the pathname makes stale context impossible rather than merely unlikely.
   */
  const descriptor = useMemo(() => {
    if (!stored || stored.pathname !== pathname) {
      return null;
    }

    const rest: PageAiDescriptor & { pathname?: string } = { ...stored };
    delete rest.pathname;

    return rest as PageAiDescriptor;
  }, [stored, pathname]);

  const value = useMemo(() => ({ descriptor, setPageAiContext }), [descriptor, setPageAiContext]);

  return <PageAiContextObject.Provider value={value}>{children}</PageAiContextObject.Provider>;
}

/**
 * Read the current page's descriptor, already shaped for the workspace API.
 *
 * Consumed by the assistant panel. Pages use `useRegisterPageAiContext` instead.
 */
export function usePageAiContext() {
  const { descriptor } = useContext(PageAiContextObject);

  return useMemo(() => {
    if (!descriptor) {
      return {
        descriptor: null,
        entityType: undefined as string | undefined,
        entityId: undefined as string | number | undefined,
        selectedRecords: undefined,
        pageData: undefined as Record<string, unknown> | undefined,
      };
    }

    const pageData = toPageData(descriptor);

    return {
      descriptor,
      entityType: descriptor.entityType ?? undefined,
      entityId: descriptor.entityId ?? undefined,
      selectedRecords: toSelectedRecords(descriptor),
      pageData: Object.keys(pageData).length ? pageData : undefined,
    };
  }, [descriptor]);
}

/**
 * Tell the assistant what this page is showing.
 *
 * Call it anywhere inside the dashboard shell, with whatever the page already has in
 * state. It re-registers when the value changes, so filtering a list or ticking a row
 * updates the assistant without the page doing anything further:
 *
 * ```tsx
 * useRegisterPageAiContext({
 *   pageTitle: 'Fee defaulters',
 *   pageType: 'list',
 *   filters: { standard, division },
 *   searchQuery,
 *   records: rows,
 *   recordCount: total,
 *   selectedRecords: checkedIds,
 * });
 * ```
 *
 * Pass `null` to withdraw the context — for a page that has one only in certain states.
 */
export function useRegisterPageAiContext(descriptor: PageAiDescriptor | null) {
  const { setPageAiContext } = useContext(PageAiContextObject);
  const pathname = usePathname();

  // Compared by value, not identity: pages pass an object literal, which is a new
  // reference on every render and would otherwise re-register in a loop.
  const serialized = JSON.stringify(descriptor ?? null);

  useEffect(() => {
    setPageAiContext(
      pathname,
      serialized === 'null' ? null : (JSON.parse(serialized) as PageAiDescriptor)
    );

    // Withdrawn when the page unmounts or the route changes, so a page that has been
    // navigated away from stops describing itself. The cleanup closes over the
    // pathname it registered under, so it withdraws its own entry and never a newer
    // page's. The provider's pathname guard covers the gap either way.
    return () => setPageAiContext(pathname, null);
  }, [serialized, pathname, setPageAiContext]);
}
