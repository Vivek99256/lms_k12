'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, Database, Inbox, Loader2, RefreshCw } from 'lucide-react';
import type { PedagogyEngineModule, PedagogyEngineResponse, PedagogySection } from '@/app/pal/data/pedagogy-engine';
import PedagogyEngineNavigation from './PedagogyEngineNavigation';
import PedagogyRuleTable from './PedagogyRuleTable';
import EngagementScore from './EngagementScore';
import PedagogyTriggerMap from './PedagogyTriggerMap';
import ConceptContextBar from './ConceptContextBar';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

const ENDPOINT = '/api/pal/pedagogy-engine';

function endpointFor(chapterId: string, concept: string) {
  const query = new URLSearchParams();
  if (chapterId) query.set('chapterId', chapterId);
  if (concept) query.set('concept', concept);
  const encoded = query.toString();
  return encoded ? `${ENDPOINT}?${encoded}` : ENDPOINT;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">{children}</div>
    </div>
  );
}

function StatusPanel({
  icon,
  title,
  message,
  onRetry,
  retrying,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-14 shadow-sm">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-violet-50 text-violet-600">
          {icon}
        </div>
        <h2 className="mt-5 text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Retry
          </button>
        ) : null}
      </div>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/15 backdrop-blur">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-white">{value}</p>
    </div>
  );
}

function SectionBody({ section }: { section: PedagogySection }) {
  if (section.type === 'signals') {
    return (
      <EngagementScore
        signals={section.signals ?? []}
        interpretation={section.interpretation ?? []}
        formula={section.formula ?? section.summary}
        observed={section.observed}
      />
    );
  }

  if (section.type === 'triggers') {
    return <PedagogyTriggerMap triggers={section.triggers ?? []} />;
  }

  return <PedagogyRuleTable rules={section.rules} />;
}

export default function PedagogyEngine() {
  const [state, setState] = useState<LoadState>('loading');
  const [module, setModule] = useState<PedagogyEngineModule | null>(null);
  const [error, setError] = useState('');
  const [activeId, setActiveId] = useState('');
  // Chapter is fixed to the latest extraction until a chapter picker is added;
  // concept is switchable and re-runs the rules server-side.
  const [chapterId] = useState('');
  const [concept, setConcept] = useState('');

  // No setState before the first await: the component already mounts in the
  // 'loading' state, and `retry` below re-enters that state explicitly.
  const load = useCallback(async () => {
    try {
      const res = await fetch(endpointFor(chapterId, concept), { cache: 'no-store' });
      const payload = (await res.json()) as PedagogyEngineResponse;

      if (!res.ok || payload.error) {
        setModule(null);
        setError(payload.error || `The Pedagogy Engine request failed with status ${res.status}.`);
        setState('error');
        return;
      }

      const sections = payload.module?.sections ?? [];
      setModule(payload.module);
      setError('');

      if (!payload.isReady || sections.length === 0) {
        setState('empty');
        return;
      }

      setActiveId((current) => (sections.some((section) => section.id === current) ? current : sections[0].id));
      setState('ready');
    } catch (err) {
      setModule(null);
      setError(err instanceof Error ? err.message : 'The Pedagogy Engine request failed.');
      setState('error');
    }
  }, [chapterId, concept]);

  const retry = useCallback(() => {
    setState('loading');
    setError('');
    void load();
  }, [load]);

  useEffect(() => {
    // The rule cannot see that `load` only sets state after its first await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const sections = useMemo(() => module?.sections ?? [], [module]);
  const activeSection = useMemo(
    () => sections.find((section) => section.id === activeId) ?? sections[0],
    [sections, activeId]
  );

  if (state === 'loading') {
    return (
      <PageShell>
        <StatusPanel
          icon={<Loader2 className="h-8 w-8 animate-spin" />}
          title="Loading the Pedagogy Engine"
          message="Fetching the rule set from the PAL backend."
        />
      </PageShell>
    );
  }

  if (state === 'error') {
    return (
      <PageShell>
        <StatusPanel
          icon={<AlertTriangle className="h-8 w-8" />}
          title="Pedagogy Engine is not available"
          message={error || 'The backend did not return a Pedagogy Engine payload.'}
          onRetry={retry}
        />
      </PageShell>
    );
  }

  if (state === 'empty' || !activeSection) {
    return (
      <PageShell>
        <StatusPanel
          icon={<Inbox className="h-8 w-8" />}
          title="No Pedagogy Engine rules yet"
          message="The backend responded successfully but has no active rule sections. Run `php artisan pal:install-pedagogy-engine` on the API to install the PAL V4 rule set."
          onRetry={retry}
        />
      </PageShell>
    );
  }

  const stats = module?.stats;

  return (
    <PageShell>
      <section className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#2e1065_0%,#4c1d95_45%,#1e1b4b_100%)] shadow-sm">
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
          <div className="min-w-0">
            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-300">
              <span>New PAL</span>
              <span>/</span>
              <span>Pedagogy Engine</span>
            </div>
            <div className="mt-3 flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20">
                <BrainCircuit className="h-7 w-7" />
              </span>
              {/* Header text is backend data too: printed only when the module
                  row supplies it, never replaced with wording from the client. */}
              <div className="min-w-0">
                {module?.title ? <h1 className="text-2xl font-bold text-white">{module.title}</h1> : null}
                {module?.description ? (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-violet-100/90">{module.description}</p>
                ) : null}
                {module?.version ? (
                  <span className="mt-3 inline-flex rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-violet-100 ring-1 ring-white/15">
                    {module.version}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {sections.map((section) => (
                <button
                  key={`chip-${section.id}`}
                  type="button"
                  onClick={() => setActiveId(section.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    section.id === activeSection.id
                      ? 'bg-white text-violet-900'
                      : 'bg-white/10 text-violet-100 ring-1 ring-white/15 hover:bg-white/20'
                  }`}
                >
                  {section.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 self-start">
            <HeroMetric label="Rule groups" value={String(stats?.sections ?? sections.length)} />
            <HeroMetric label="Rules" value={String(stats?.rules ?? 0)} />
            <HeroMetric label="Partial" value={String(stats?.partial_sections ?? 0)} />
            <HeroMetric label="Live" value={String(stats?.implemented_sections ?? 0)} />
            {module?.source ? (
              <div className="col-span-2 flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-xs text-violet-100 ring-1 ring-white/15">
                <Database className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate font-mono">{module.source}</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {module?.context ? (
        <ConceptContextBar
          context={module.context}
          concepts={module.concepts}
          activeConcept={concept}
          onSelectConcept={(next) => {
            setConcept(next);
            setState('loading');
          }}
        />
      ) : (
        <section className="rounded-[26px] border border-dashed border-amber-200 bg-amber-50/60 px-6 py-5">
          <p className="text-sm leading-6 text-amber-900">
            No extracted chapter was found in <span className="font-mono">semantic_intelligence</span>, so the rules
            below are shown unresolved — the engine has no concept to evaluate them against.
          </p>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <PedagogyEngineNavigation sections={sections} activeId={activeSection.id} onSelect={setActiveId} />

        <div className="min-w-0 space-y-4">
          <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{activeSection.name}</h2>
                  {activeSection.implementation_status ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      {activeSection.implementation_status}
                    </span>
                  ) : null}
                  {module?.has_semantic_data ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                      {activeSection.resolved_count}/{activeSection.rules.length} rules resolved ·{' '}
                      {activeSection.evidence_count} records
                    </span>
                  ) : null}
                </div>
                {activeSection.subtitle ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{activeSection.subtitle}</p>
                ) : null}
                {activeSection.summary && activeSection.type !== 'signals' ? (
                  <p className="mt-3 rounded-2xl bg-slate-50/80 px-4 py-3 text-sm leading-6 text-slate-600 ring-1 ring-slate-100">
                    {activeSection.summary}
                  </p>
                ) : null}
                {activeSection.badges.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activeSection.badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {activeSection.current_state || activeSection.gap ? (
                <div className="space-y-3">
                  {activeSection.current_state ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Today</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{activeSection.current_state}</p>
                    </div>
                  ) : null}
                  {activeSection.gap ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Gap</p>
                      <p className="mt-1 text-sm leading-6 text-amber-900">{activeSection.gap}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <SectionBody section={activeSection} />
        </div>
      </div>
    </PageShell>
  );
}
