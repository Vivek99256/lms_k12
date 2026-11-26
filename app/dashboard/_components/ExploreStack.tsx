'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BookOpen, Building2, CalendarCheck, ChevronDown, ClipboardList, GraduationCap, Loader2, MessageSquare, Sparkles, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { LibraryBody } from '@/app/dashboard/_components/DashboardAssistant';
import { MasonryColumns } from '@/app/dashboard/_components/MasonryColumns';
import { EmptyNote } from '@/app/dashboard/_components/PremiumKit';
import { fetchRelated, getDashboardSession, type RelatedResponse } from '@/app/dashboard/_lib/dashboard-api';

/*
 * "More like this." Click a figure and the other figures of the same subject open right underneath it, sliding open,
 * then the subjects people usually go to next, one under the other (like the similar items under a product).
 * Everything shown is what the role may already see; the server decides that, this file only draws it.
 */

/** Which subject a dashboard figure or panel belongs to, from its key. Undefined when it belongs to none. */
export function topicOfKey(key: string): string | undefined {
  const k = key.toLowerCase();
  // The named panels, spelled out; everything else (figures, lists) is matched on its words below.
  const named: Record<string, string> = {
    trends: 'attendance', 'class-att': 'attendance', 'fees-overview': 'fees', 'fees-month': 'fees', funnel: 'admissions', 'exam-results': 'academics',
    gender: 'students', 'by-class': 'students', strength: 'students', homework: 'academics', 'parent-age': 'communication', 'task-age': 'communication',
    transport: 'facilities', hostel: 'facilities', library: 'facilities', impact: 'academics', 'class-mastery': 'academics', 'my-mastery': 'academics', streak: 'academics',
  };
  if (named[k]) return named[k];
  if (/attend|absent|chronic|^trends$/.test(k)) return 'attendance';
  if (/fee|receipt/.test(k)) return 'fees';
  if (/admission|enquir|funnel|visitor|followup/.test(k)) return 'admissions';
  if (/staff|leave|substitut/.test(k)) return 'staff';
  if (/exam|homework|grade|assign|mastery|impact/.test(k)) return 'academics';
  if (/transport|hostel|library|stock|requisition|po_|item|vendor|inward|outward|petty|purchase/.test(k)) return 'facilities';
  if (/parent|complaint|task|approval|circular|event/.test(k)) return 'communication';
  if (/student|gender|by-class|strength|birthday|class/.test(k)) return 'students';
  return undefined;
}

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<RelatedResponse>; value?: RelatedResponse }>();

/** The figures of a subject if they have already arrived (and are fresh), else null. Lets a section start complete. */
export function peekRelated(topic: string): RelatedResponse | null {
  const hit = cache.get(topic);
  return hit && hit.value && Date.now() - hit.at < CACHE_MS ? hit.value : null;
}

/**
 * Fetch (or reuse, for a minute) the related figures of one subject. Called on hover and when the page settles, so by the time
 * somebody clicks, the figures are usually already here and the section opens once, fully, instead of opening empty and growing.
 */
export function prefetchRelated(topic: string): Promise<RelatedResponse> {
  const hit = cache.get(topic);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = fetchRelated(getDashboardSession(), topic);
  const entry: { at: number; promise: Promise<RelatedResponse>; value?: RelatedResponse } = { at: Date.now(), promise };
  cache.set(topic, entry);
  promise.then((v) => { entry.value = v; }, () => cache.delete(topic));
  return promise;
}

/** The icon of a subject (or the sparkle for "more like this one figure"). */
const TOPIC_ICON: Record<string, LucideIcon> = {
  students: GraduationCap, attendance: CalendarCheck, staff: Users, fees: Wallet, admissions: ClipboardList, academics: BookOpen, communication: MessageSquare, facilities: Building2,
};
function TopicIcon({ topic, ...rest }: { topic: string; size?: number; strokeWidth?: number; className?: string }) {
  const Icon: LucideIcon = TOPIC_ICON[topic] ?? Sparkles;
  return <Icon aria-hidden {...rest} />;
}

export type ExploreEntry = { topic: string; open?: () => void };

/** Springs, not timed curves: a spring keeps its speed when it is interrupted, so opening, closing and growing never snap. */
const SPRING = { type: 'spring', stiffness: 210, damping: 30, mass: 0.9 } as const;
const SPRING_QUICK = { type: 'spring', stiffness: 320, damping: 36, mass: 0.8 } as const;
const SPRING_CARD = { type: 'spring', stiffness: 260, damping: 26, mass: 0.7 } as const;

/* ---------------------------------------------------------------------------------------------------------------------
 * Where the open subjects live. Kept outside the dashboard component on purpose: clicking a card must not re-render the whole
 * dashboard (dozens of panels and charts). Only the slot under the clicked card subscribes to its own entries.
 * ------------------------------------------------------------------------------------------------------------------ */

const EMPTY: ExploreEntry[] = [];
let state: Record<string, ExploreEntry[]> = {};
const listeners = new Set<() => void>();

function commit(anchor: string, entries: ExploreEntry[]) {
  state = { ...state, [anchor]: entries };
  listeners.forEach((l) => l());
}

export const exploreStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  get: (anchor: string) => state[anchor] ?? EMPTY,
  /** Click: open the subject under its anchor, or close it if it is already open there. */
  toggle(anchor: string, topic: string, open?: () => void) {
    const cur = exploreStore.get(anchor);
    if (cur.some((x) => x.topic === topic)) exploreStore.remove(anchor, topic);
    else commit(anchor, [...cur, { topic, open }].slice(-3));
  },
  add(anchor: string, topic: string) {
    const cur = exploreStore.get(anchor);
    if (!cur.some((x) => x.topic === topic)) commit(anchor, [...cur, { topic }].slice(-3));
  },
  remove(anchor: string, topic: string) {
    // What was opened inside the section goes with it (its places are named "<anchor>:<topic>/n").
    const inside = `${anchor}:${topic}/n`;
    const kept = Object.fromEntries(Object.entries(state).filter(([k]) => k !== inside && !k.startsWith(`${inside}:`) && !k.startsWith(`${inside}/`)));
    state = { ...kept, [anchor]: exploreStore.get(anchor).filter((x) => x.topic !== topic) };
    listeners.forEach((l) => l());
  },
  clear() {
    state = {};
    listeners.forEach((l) => l());
  },
};

/** The place under one figure or panel where its open subjects appear. */
export function ExploreSlot({ anchor, depth = 0 }: { anchor: string; depth?: number }) {
  const entries = useSyncExternalStore(exploreStore.subscribe, () => exploreStore.get(anchor), () => EMPTY);
  return <ExploreStack entries={entries} anchor={anchor} depth={depth} onClose={(t) => exploreStore.remove(anchor, t)} onExplore={(t) => exploreStore.add(anchor, t)} />;
}

/** How many levels deep a click on a card may keep opening more (a section inside a section inside a section). */
const MAX_DEPTH = 3;

/* ------------------------------------------------------------------------------------------------------------------ */

/** The nearest ancestor that actually scrolls, or the page itself. */
function scrollParentOf(el: HTMLElement): HTMLElement {
  let p = el.parentElement;
  while (p) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/**
 * Springs open and shut. The height is measured from the content and the spring chases it, so it also eases down when the
 * figures arrive after the section has opened. While the newest section opens, the page glides along so its bottom stays in
 * view: one movement, not a slide followed by a jump. Closing is Framer Motion's exit, played by the AnimatePresence above.
 */
function Reveal({ follow, children }: { follow: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!follow || !el || reduce) return;
    const parent = scrollParentOf(el);
    const root = parent === document.scrollingElement || parent === document.documentElement;
    const start = performance.now();
    let raf = 0;
    const step = () => {
      const r = el.getBoundingClientRect();
      const view = root ? { top: 0, bottom: window.innerHeight } : parent.getBoundingClientRect();
      const below = r.bottom - (view.bottom - 28); // how far the bottom has gone below the fold
      const room = r.top - (view.top + 80); // never scroll the section's own top out of view
      if (below > 0 && room > 0) {
        const by = Math.min(below, room) * 0.2 + 0.6;
        if (root) window.scrollBy(0, by); else parent.scrollTop += by;
      }
      if (performance.now() - start < 1000) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [follow, reduce]);

  return (
    <motion.div
      ref={wrap}
      className="-mx-1 overflow-hidden px-1"
      style={{ contain: 'layout style' }}
      initial={reduce ? false : { height: 0, opacity: 0 }}
      animate={{ height, opacity: 1, transition: reduce ? { duration: 0 } : { height: SPRING, opacity: { duration: 0.4, ease: 'easeOut' } } }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0, transition: { height: SPRING_QUICK, opacity: { duration: 0.22, ease: 'easeIn' } } }}
    >
      <div ref={inner}><div className="pb-1 pt-3">{children}</div></div>
    </motion.div>
  );
}

const CARDS = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: SPRING_CARD },
};
/** A rough height for a card, so short and tall cards can be packed together without holes under the short ones. */
function cardWeight(view: RelatedResponse['items'][number]['view']): number {
  switch (view.kind) {
    case 'number': return 1.3;
    case 'facts': return 1.5 + (view.items.length > 3 ? 0.9 : 0);
    case 'bars': return 1.3 + Math.min(view.rows.length, 8) * 0.42;
    case 'series': return 3.4;
    case 'list': return 1.3 + Math.min(view.items.length, 10) * 0.55 + (view.items.length === 0 ? 0.8 : 0);
  }
}

const CARD_LIST = { hidden: {}, show: { transition: { staggerChildren: 0.065, delayChildren: 0.12 } } };

function Section({ entry, open, follow, path, depth, onClose, onExplore }: {
  entry: ExploreEntry; open: string[]; follow: boolean; path: string; depth: number; onClose: () => void; onExplore: (topic: string) => void;
}) {
  // Clicking a card in this section opens more like that card, in a place of its own under the cards.
  const nestedAnchor = `${path}/n`;
  const nested = useSyncExternalStore(exploreStore.subscribe, () => exploreStore.get(nestedAnchor), () => EMPTY);
  const deeper = depth < MAX_DEPTH;
  // If the figures are already here (prefetched), the section starts complete and opens once, with nothing to grow into later.
  const [data, setData] = useState<RelatedResponse | null>(() => peekRelated(entry.topic));
  const [failed, setFailed] = useState(false);
  // What is already on screen above and in this section, so the suggestions under a card are new ones and not the same cards again.
  const seenKeys = [...new Set([...(entry.topic.split('|seen=')[1]?.split(',') ?? []), ...(data?.items.map((x) => x.key) ?? [])])].filter(Boolean);

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    prefetchRelated(entry.topic)
      .then((r) => { if (!cancelled) setData(r); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [entry.topic, data]);

  const actions = (
    <div className="flex shrink-0 items-center gap-1">
      {entry.open && (
        <button type="button" onClick={entry.open} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100/70">
          Open full page <ArrowUpRight size={12} aria-hidden />
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Close this" title="Close" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 hover:shadow-sm"><X size={15} aria-hidden /></button>
    </div>
  );

  const more = data?.next.filter((n) => !open.includes(n.id)) ?? [];
  const [eyebrow, name] = data
    ? (data.title.startsWith('More like ') ? ['More like', data.title.slice('More like '.length)] : ['More on', data.label])
    : ['Related', 'Loading…'];

  return (
    <Reveal follow={follow}>
      <section
        aria-label={data?.title ?? 'Related figures'}
        className="relative rounded-2xl bg-gradient-to-b from-indigo-50/80 via-white to-white p-4 shadow-[0_10px_32px_-14px_rgba(79,70,229,0.35)] ring-1 ring-indigo-100 sm:p-5"
      >
        {/* A small pointer, so the section reads as belonging to what was clicked above it. */}
        <span aria-hidden className="absolute -top-[7px] left-9 h-3.5 w-3.5 rotate-45 rounded-tl-[3px] border-l border-t border-indigo-100 bg-indigo-50" />

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/25"><TopicIcon topic={entry.topic} size={17} strokeWidth={1.9} /></span>
            <h3 className="min-w-0 truncate text-base font-semibold leading-tight tracking-tight text-slate-900">
              <span className="block text-[11px] font-semibold uppercase leading-4 tracking-[0.14em] text-indigo-600">{eyebrow}</span>{' '}{name}
            </h3>
          </div>
          {actions}
        </div>

        {failed ? (
          <EmptyNote>Couldn’t load the related figures. Please try again.</EmptyNote>
        ) : !data ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" aria-hidden /> Finding related figures…</div>
        ) : (
          <>
            {data.items.length === 0 ? (
              <EmptyNote>{entry.topic.startsWith('entry:') ? 'That is as detailed as this gets: everything related to it is already shown above.' : 'There is nothing more to show here for your role.'}</EmptyNote>
            ) : (
              <motion.div variants={CARD_LIST} initial="hidden" animate="show">
                <MasonryColumns minColumn={264} gap={14} weights={data.items.map((x) => cardWeight(x.view))}>
                {data.items.map((i) => {
                  const topic = `entry:${i.key}|seen=${seenKeys.join(',')}`;
                  const active = nested.some((x) => x.topic === topic);
                  // Only a card with something new under it invites a click.
                  const canOpen = deeper && i.more !== false;
                  return (
                    <motion.section
                      key={i.key} variants={CARDS} aria-label={i.title} data-card={i.key}
                      onMouseEnter={canOpen ? () => { void prefetchRelated(topic).catch(() => undefined); } : undefined}
                      onClick={canOpen ? (e) => { if (!(e.target as HTMLElement).closest('button, a, input, select, textarea, summary')) exploreStore.toggle(nestedAnchor, topic); } : undefined}
                      whileHover={canOpen ? { y: -3 } : undefined}
                      title={canOpen ? `${i.about}. Click to see more like this.` : i.about}
                      className={`@container group rounded-xl bg-white p-4 transition-[box-shadow,--tw-ring-color] duration-300 ${canOpen ? 'cursor-pointer' : ''} ${
                        active
                          ? 'shadow-lg shadow-indigo-500/15 ring-2 ring-indigo-500'
                          : 'shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.07] hover:shadow-[0_8px_24px_-12px_rgba(79,70,229,0.4)] hover:ring-indigo-300'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-[13px] font-semibold text-slate-600">{i.title}</h3>
                        {canOpen && (
                          <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                            <ChevronDown size={14} className={`transition-transform duration-300 ${active ? 'rotate-180' : ''}`} />
                          </span>
                        )}
                      </div>
                      <LibraryBody view={i.view} />
                    </motion.section>
                  );
                })}
                </MasonryColumns>
              </motion.div>
            )}
            {deeper && <ExploreSlot anchor={nestedAnchor} depth={depth + 1} />}
            {more.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { ...SPRING_CARD, delay: 0.12 + data.items.length * 0.065 } }}
                className="mt-5 flex flex-wrap items-center gap-2"
              >
                <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Explore next</span>
                {more.map((n) => {
                  return (
                    <motion.button
                      key={n.id} type="button" onClick={() => onExplore(n.id)} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
                      className="group/chip inline-flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-2.5 pr-3 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-900/[0.08] transition-colors hover:bg-indigo-600 hover:text-white hover:ring-indigo-600"
                    >
                      <TopicIcon topic={n.id} size={13} className="text-indigo-500 transition-colors group-hover/chip:text-white" />
                      {n.label}
                      <ArrowRight size={12} className="-ml-0.5 w-0 opacity-0 transition-all duration-200 group-hover/chip:ml-0 group-hover/chip:w-3 group-hover/chip:opacity-100" aria-hidden />
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </>
        )}
      </section>
    </Reveal>
  );
}

/** The subjects opened under one figure or panel, one under the other. Closing one plays its exit animation. */
export function ExploreStack({ entries, anchor, depth, onClose, onExplore }: {
  entries: ExploreEntry[]; anchor: string; depth: number; onClose: (topic: string) => void; onExplore: (topic: string) => void;
}) {
  const topics = entries.map((e) => e.topic);
  return (
    <div
      aria-label={entries.length > 0 ? 'Related figures' : undefined}
      className={depth > 0 ? 'mt-5 border-l-2 border-indigo-200 pl-4 [&:not(:has(*))]:hidden' : undefined}
    >
      <AnimatePresence initial={false}>
        {entries.map((e, i) => (
          <Section key={e.topic} entry={e} open={topics} follow={i === entries.length - 1} path={`${anchor}:${e.topic}`} depth={depth} onClose={() => onClose(e.topic)} onExplore={onExplore} />
        ))}
      </AnimatePresence>
    </div>
  );
}
