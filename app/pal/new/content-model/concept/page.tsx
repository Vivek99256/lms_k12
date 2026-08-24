'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  GitBranch,
  Loader2,
  PenLine,
  RefreshCw,
  Route,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import NewPalNav from '@/app/pal/new/_components/NewPalNav';
import MisconceptionCard from '@/app/pal/new/_components/MisconceptionCard';
import {
  fetchConceptModel,
  humanise,
  statusTone,
  type ConceptModel,
  type ContentNode,
  type LadderLevel,
} from '@/app/pal/new/data/content-model';

type TabKey = 'type1' | 'type2' | 'type3' | 'type4' | 'graph';

/**
 * Content Model — one concept, all four content types.
 *
 * Type 1 variants, the Type 2 Bloom ladder, the Type 3 misconception library
 * and the Type 4 assessment bank, each projected from a different section of
 * the extraction. Every node links into the authoring interface.
 */
export default function ConceptModelPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading concept…
        </div>
      }
    >
      <ConceptModelContent />
    </Suspense>
  );
}

function ConceptModelContent() {
  const searchParams = useSearchParams();
  const semanticId = Number(searchParams?.get('chapter') ?? 0);
  const slug = searchParams?.get('slug') ?? '';

  const [model, setModel] = useState<ConceptModel | null>(null);
  const [tab, setTab] = useState<TabKey>('type1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!semanticId || !slug) {
        setError('No concept was selected.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        setModel(await fetchConceptModel(semanticId, slug, signal));
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message || 'Could not load this concept.');
      } finally {
        setLoading(false);
      }
    },
    [semanticId, slug]
  );

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      await load(controller.signal);
    };
    void run();
    return () => controller.abort();
  }, [load]);

  const tabs: Array<{ key: TabKey; label: string; count: number | null }> = model
    ? [
        { key: 'type1', label: model.type1.label, count: model.type1.present },
        { key: 'type2', label: model.type2.label, count: model.type2.totalItems },
        { key: 'type3', label: model.type3.label, count: model.type3.total },
        { key: 'type4', label: model.type4.label, count: model.type4.totalItems },
        { key: 'graph', label: 'Concept graph', count: model.graph.requires.length },
      ]
    : [];

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link href={`/pal/new/content-model/chapter?id=${semanticId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Chapter
              </Button>
            </Link>
            <div>
              <h1 className="text-[22px] font-semibold text-[#1F2A44]">
                {model?.concept.name || 'Concept'}
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {model
                  ? `${model.chapterName} · ${model.subjectName} · Grade ${model.standard ?? '—'}`
                  : 'Loading…'}
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <NewPalNav />

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {loading && !model ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#DFE6F2] bg-white py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-sm text-slate-500">Projecting the four-type model…</span>
          </div>
        ) : null}

        {model ? (
          <>
            {/* concept header */}
            <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
              <p className="text-sm leading-relaxed text-slate-700">{model.concept.definition}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Fact label="Concept key" value={model.concept.conceptKey} mono />
                <Fact label="Importance" value={model.concept.importance} />
                <Fact
                  label="Difficulty"
                  value={
                    model.concept.difficulty
                      ? `${model.concept.difficultyLabel} (${model.concept.difficulty}/5)`
                      : model.concept.difficultyLabel
                  }
                />
                <Fact label="Bloom ceiling" value={model.concept.bloomCeiling} />
                <Fact
                  label="Practice ceiling"
                  value={model.concept.practiceCeiling ? `L${model.concept.practiceCeiling}` : '—'}
                />
                <Fact label="Dominant DOK" value={model.concept.dominantDok ?? '—'} />
                <Fact label="Knowledge type" value={humanise(model.concept.knowledgeType)} />
                <Fact label="Stage" value={model.concept.stageGate} />
                <Fact label="Mastery gate" value={model.concept.masteryGate} mono />
                <Fact label="Priority" value={model.concept.priorityScore ?? '—'} mono />
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
                {Object.entries(model.concept.counts).map(([key, count]) => (
                  <span
                    key={key}
                    className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600"
                  >
                    {humanise(key)}: <span className="font-mono font-semibold">{count}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* type tabs */}
            <div className="flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    tab === t.key
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                  {t.count !== null ? (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[11px] ${
                        tab === t.key ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {t.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {tab === 'type1' ? <Type1Panel model={model} /> : null}
            {tab === 'type2' ? <Type2Panel model={model} /> : null}
            {tab === 'type3' ? <Type3Panel model={model} /> : null}
            {tab === 'type4' ? <Type4Panel model={model} /> : null}
            {tab === 'graph' ? <GraphPanel model={model} /> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

// ── Type 1 — concept learning variants ─────────────────────────────────────

function Type1Panel({ model }: { model: ConceptModel }) {
  return (
    <div className="space-y-4">
      <Banner
        ok={model.type1.meetsMinimum}
        okText={`All ${model.type1.present} variant slots are backed by extracted material. The re-route ladder (${model.type1.rerouteOrder.map((v) => `V${v}`).join(' → ')}) has somewhere to go when a learner fails one.`}
        badText={`Only ${model.type1.present} of ${model.type1.totalSlots} variants are backed. The spec asks for at least ${model.type1.requiredMinimum}: when a learner fails one explanation the system must re-route to a different modality, not repeat the same one.`}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {model.type1.variants.map((variant) => (
          <VariantCard key={variant.nodeKey} node={variant} />
        ))}
      </div>
    </div>
  );
}

function VariantCard({ node }: { node: ContentNode }) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)] ${
        node.gap ? 'border-amber-200' : 'border-[#DFE6F2]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-indigo-50 px-2 py-0.5 font-mono text-xs font-semibold text-indigo-700">
              V{node.variantNumber}
            </span>
            <h3 className="text-[15px] font-semibold text-[#1F2A44]">{node.formatLabel}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">Served when: {node.whenServed}</p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone(node.qualityStatus)}`}>
          {humanise(node.qualityStatus)}
        </span>
      </div>

      {node.gap ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          {node.gapReason} Use <span className="font-semibold">AI draft</span> in the authoring screen
          to write it from the concept&apos;s evidence.
        </p>
      ) : (
        <pre className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 px-3.5 py-3 text-[12px] leading-relaxed text-slate-700">
          {node.body}
        </pre>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Chip label={`format ${node.format}`} />
        {node.h5pType ? <Chip label={`h5p ${node.h5pType}`} /> : null}
        {node.sourcesUsed.map((source) => (
          <Chip key={source} label={source} tone="indigo" />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[11px] text-slate-400">Metadata</p>
            <p className="font-mono text-sm font-semibold text-slate-800">{node.completeness}%</p>
          </div>
          {node.missingMandatory.length > 0 ? (
            <p className="text-[11px] text-amber-700">
              Missing: {node.missingMandatory.map(humanise).join(', ')}
            </p>
          ) : (
            <p className="text-[11px] text-emerald-700">All mandatory fields present</p>
          )}
        </div>

        <Link href={`/pal/new/content-model/authoring?node=${node.nodeKey}`}>
          <Button variant="outline" size="sm">
            <PenLine className="mr-1.5 h-3.5 w-3.5" />
            Author
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ── Type 2 — the Bloom ladder ──────────────────────────────────────────────

function Type2Panel({ model }: { model: ConceptModel }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1F2A44]">Progression gates</h2>
            <p className="mt-1 text-xs text-slate-500">
              A rung can only gate if it holds enough items to measure fluency. Ceiling for this
              concept: L{model.type2.practiceCeiling ?? '—'} ({model.type2.bloomCeiling || '—'}).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(model.type2.hpcCeilings).map(([tier, ceiling]) => (
              <span key={tier} className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                {tier} → max L{ceiling}
              </span>
            ))}
          </div>
        </div>

        {Object.keys(model.type2.regressionRules).length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
            {Object.entries(model.type2.regressionRules).map(([rule, value]) => (
              <Chip key={rule} label={`${humanise(rule)}: ${value}`} />
            ))}
          </div>
        ) : null}
      </div>

      {model.type2.unmapped.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">
            {model.type2.unmapped.length} extracted question(s) could not be placed on the ladder.
          </span>{' '}
          {model.type2.unmapped[0].reason} They are excluded rather than guessed onto a rung.
        </div>
      ) : null}

      <div className="space-y-3">
        {model.type2.levels.map((level) => (
          <LadderRung key={level.level} level={level} />
        ))}
      </div>
    </div>
  );
}

function LadderRung({ level }: { level: LadderLevel }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-2xl border bg-white shadow-[0_8px_18px_rgba(15,23,42,0.05)] ${
        level.gapKind === 'hard' ? 'border-rose-200' : 'border-[#DFE6F2]'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-3 p-4 text-left"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-semibold ${
            level.servable
              ? 'bg-emerald-50 text-emerald-700'
              : level.itemsTotal > 0
                ? 'bg-amber-50 text-amber-700'
                : 'bg-rose-50 text-rose-700'
          }`}
        >
          L{level.level}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-[#1F2A44]">
            {level.name}{' '}
            <span className="text-sm font-normal text-slate-500">({level.bloomLabel})</span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {level.tasks.join(' · ')} — scaffold: {humanise(level.scaffold)}
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-sm font-semibold text-slate-800">
            {level.itemsTotal}
            <span className="text-slate-400">/{level.minItemsRequired}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            {level.servable
              ? 'gate measurable'
              : level.itemsTotal === 0
                ? 'no items'
                : 'too few to gate'}
          </p>
        </div>
      </button>

      {level.gate ? (
        <p className="border-t border-slate-100 px-4 py-2 font-mono text-[11px] text-slate-500">
          gate: {level.gate.metric} &gt; {level.gate.threshold} over {level.gate.minItems}+ items
        </p>
      ) : null}

      {open ? (
        <div className="border-t border-slate-100 p-4">
          {level.items.length === 0 ? (
            <p className="text-sm text-slate-500">
              No extracted question sits at this Bloom level for this concept. The ladder cannot
              progress a learner through a rung with nothing on it.
            </p>
          ) : (
            <ul className="space-y-2">
              {level.items.map((item) => (
                <li
                  key={item.nodeKey}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-100 px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">{item.prompt || item.title}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.assessmentTypeRaw ? <Chip label={item.assessmentTypeRaw} /> : null}
                      {item.dokLevel ? <Chip label={`DOK ${item.dokLevel}`} /> : null}
                      {item.difficulty ? <Chip label={`difficulty ${item.difficulty}/5`} /> : null}
                      {item.marks ? <Chip label={`${item.marks} mark(s)`} /> : null}
                      {item.h5pType ? <Chip label={item.h5pType} tone="indigo" /> : null}
                      <Chip label={`${item.completeness}% metadata`} />
                    </div>
                  </div>
                  <Link href={`/pal/new/content-model/authoring?node=${item.nodeKey}`}>
                    <Button variant="outline" size="sm">
                      <PenLine className="mr-1.5 h-3.5 w-3.5" />
                      Author
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Type 3 — misconception library ─────────────────────────────────────────

function Type3Panel({ model }: { model: ConceptModel }) {
  return (
    <div className="space-y-4">
      <Banner
        ok={model.type3.c6Pass}
        okText={`Every one of the ${model.type3.total} misconceptions has corrective content behind it. Detecting an error and then showing the learner nothing is the failure this check exists to prevent.`}
        badText={`${model.type3.c6Violations.length} misconception(s) have no corrective content. They can be detected but not answered, which is worse than not detecting them.`}
      />

      {!model.type3.meetsMinimum ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This concept has {model.type3.total} misconception(s); the spec asks for at least{' '}
          {model.type3.requiredMinimum} per concept before deployment.
        </div>
      ) : null}

      <div className="space-y-3">
        {model.type3.entries.map((entry) => (
          <MisconceptionCard key={entry.nodeKey} entry={entry} />
        ))}
      </div>
    </div>
  );
}

// ── Type 4 — assessment bank ───────────────────────────────────────────────

function Type4Panel({ model }: { model: ConceptModel }) {
  return (
    <div className="space-y-4">
      {model.type4.gap ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>{model.type4.gap}</div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Total label="Items" value={model.type4.totalItems} />
          <Total label="With answer key" value={model.type4.calibratedItems} />
          <Total label="Evidence verified" value={model.type4.evidenceVerifiedItems} />
          {Object.entries(model.type4.byBloom).map(([bloom, count]) => (
            <Total key={bloom} label={humanise(bloom)} value={count} />
          ))}
        </div>
      )}

      <div className="space-y-3">
        {model.type4.items.map((item) => (
          <AssessmentCard key={item.nodeKey} node={item} />
        ))}
      </div>

      {model.type4.teachingNotes ? (
        <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-400" />
            <h3 className="text-[15px] font-semibold text-[#1F2A44]">Teaching notes</h3>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {Object.entries(model.type4.teachingNotes).map(([key, values]) => (
              <div key={key}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {humanise(key)}
                </p>
                <ul className="mt-1 space-y-1">
                  {values.map((value, index) => (
                    <li key={index} className="flex gap-2 text-xs text-slate-600">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                      {value}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssessmentCard({ node }: { node: ContentNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-[#DFE6F2] bg-white shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-start gap-3 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-800">{node.prompt || node.title}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {node.assessmentTypeRaw ? <Chip label={node.assessmentTypeRaw} /> : null}
            {node.bloomLevel ? <Chip label={node.bloomLevel} tone="indigo" /> : null}
            {node.dokLevel ? <Chip label={`DOK ${node.dokLevel}`} /> : null}
            {node.marks ? <Chip label={`${node.marks} mark(s)`} /> : null}
            {node.hasAnswerKey ? (
              <Chip label="answer key" tone="emerald" />
            ) : (
              <Chip label="no answer key" tone="amber" />
            )}
            {node.evidenceVerified ? <Chip label="evidence verified" tone="emerald" /> : null}
            {node.misconceptionTags.map((tag) => (
              <Chip key={tag} label={tag} tone="rose" />
            ))}
          </div>
        </div>
        <span className="font-mono text-xs text-slate-400">{node.completeness}%</span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 p-4">
          {node.answerKey.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Answer key &amp; distractor rationale
              </p>
              <ul className="mt-2 space-y-1.5">
                {node.answerKey.map((option) => (
                  <li
                    key={option.optionLabel}
                    className={`rounded-xl border px-3 py-2.5 ${
                      option.isCorrect ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] font-semibold ${
                          option.isCorrect
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {option.optionLabel}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800">{option.optionText}</p>
                        {option.rationale ? (
                          <p className="mt-0.5 text-xs text-slate-500">{option.rationale}</p>
                        ) : null}
                        {option.misconceptionTag ? (
                          <p className="mt-1 font-mono text-[11px] text-rose-600">
                            tests: {option.misconceptionTag}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {node.acceptablePoints.length > 0 ? (
            <ListField label="Acceptable points" items={node.acceptablePoints} />
          ) : null}
          {node.commonErrors.length > 0 ? (
            <ListField label="Common errors" items={node.commonErrors} />
          ) : null}
          {node.sourceEvidence.length > 0 ? (
            <ListField label="Source evidence" items={node.sourceEvidence} />
          ) : null}

          {node.servesAssessmentTypes.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Can serve as
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {node.servesAssessmentTypes.map((type) => (
                  <Chip key={type} label={humanise(type)} tone="indigo" />
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex justify-end border-t border-slate-100 pt-3">
            <Link href={`/pal/new/content-model/authoring?node=${node.nodeKey}`}>
              <Button variant="outline" size="sm">
                <PenLine className="mr-1.5 h-3.5 w-3.5" />
                Author
              </Button>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Concept graph ──────────────────────────────────────────────────────────

function GraphPanel({ model }: { model: ConceptModel }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-slate-400" />
          <h3 className="text-[15px] font-semibold text-[#1F2A44]">
            Prerequisites ({model.graph.requires.length})
          </h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          A mandatory prerequisite gates delivery: the learner must clear it before this concept is
          served.
        </p>

        {model.graph.requires.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No prerequisites were extracted.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {model.graph.requires.map((req) => (
              <li
                key={`${req.conceptSlug}-${req.prerequisiteType}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3.5 py-2.5"
              >
                <div>
                  <p className="text-sm text-slate-800">{req.conceptName}</p>
                  <p className="text-[11px] text-slate-500">{req.prerequisiteType}</p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                    req.gates
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {req.necessity || 'optional'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-slate-400" />
          <h3 className="text-[15px] font-semibold text-[#1F2A44]">
            Related concepts ({model.graph.related.length})
          </h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Cross-concept links the extraction found. These drive transfer suggestions once mastery is
          reached.
        </p>

        {model.graph.related.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No relationships were extracted.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {model.graph.related.map((rel) => (
              <li
                key={`${rel.targetSlug}-${rel.relationType}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3.5 py-2.5"
              >
                <p className="text-sm text-slate-800">{rel.targetConcept}</p>
                <span className="rounded-full bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                  {rel.relationType}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────

function Banner({ ok, okText, badText }: { ok: boolean; okText: string; badText: string }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-rose-200 bg-rose-50 text-rose-800'
      }`}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div>{ok ? okText : badText}</div>
    </div>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-100 px-3 py-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={`text-sm text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2 text-xs text-slate-600">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chip({ label, tone = 'slate' }: { label: string; tone?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' }) {
  const toneClass = {
    slate: 'bg-slate-50 text-slate-600',
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }[tone];

  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${toneClass}`}>{label}</span>
  );
}

function Total({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#DFE6F2] bg-white px-3.5 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="font-mono text-sm font-semibold text-slate-800">{value}</span>
    </div>
  );
}
