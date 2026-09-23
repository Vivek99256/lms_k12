 'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  Brain,
  Target,
  Zap,
  Award,
  Layers,
  BarChart3,
  Link2,
  TriangleAlert,
  Globe,
  Lightbulb,
  Flag,
  CheckCircle2,
  FileText,
  Network,
  Quote,
  Info,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import type { ConceptIntelEntry } from '@/app/course-master/data/chapters';
import {
  DEFAULT_TAB_LABELS,
  MAX_TAB_LABEL_LENGTH,
  fetchConceptIntelligenceTabLabels,
  saveConceptIntelligenceTabLabel,
} from '@/app/course-master/data/conceptIntelligenceTabLabels';
import {
  FIELD_GUIDE,
  REASONING_TITLES,
  TAB_GUIDE,
  describeConfidence,
  explainValue,
  marksLabel,
  toCoveragePercent,
} from './conceptIntelligenceGuide';
import {
  FactTile,
  FieldLabel,
  InfoHint,
  MetaChip,
  NothingHere,
  TabIntro,
} from './ConceptIntelligenceHelp';

function flattenText(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    return text ? [text] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenText(item));
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap((item) => flattenText(item));
  }
  return [];
}

function uniq(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

/** Coerce any JSON value to a trimmed display string without leaking raw objects. */
const s = (v: unknown): string => uniq(flattenText(v)).join(' · ');
/** Coerce any JSON value to an array of records. */
const toArr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
/** Coerce a list of primitives to trimmed strings. */
const toStrList = (v: unknown): string[] => uniq(flattenText(v));

const hasTruthy = (v: unknown) => s(v).length > 0;
const boolish = (v: unknown) => v === true || s(v).toLowerCase() === 'true';

function getDisplayTitle(
  record: Record<string, unknown>,
  keys: string[],
  fallback = 'Untitled'
) {
  const match = keys.map((key) => s(record[key])).find(Boolean);
  return match || fallback;
}

function getDisplayBody(
  record: Record<string, unknown>,
  keys: string[]
) {
  return keys.map((key) => s(record[key])).find(Boolean) || '';
}

type IconType = ComponentType<{ size?: number; className?: string }>;

interface TabDef {
  id: string;
  label: string;
  Icon: IconType;
  count: number;
}

const CARD = 'rounded-xl border p-4';

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return <FieldLabel hint={hint}>{children}</FieldLabel>;
}

/** "Ability refs: K1, K3" says nothing on its own — name what the ids point at. */
function RefLine({ label, hint, items }: { label: string; hint: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
      <span className="font-semibold text-slate-500">{label}</span>
      <span>{items.join(', ')}</span>
      <InfoHint text={hint} label={label} />
    </p>
  );
}

export function ConceptIntelligenceTabs({
  entry,
  chapterTitle,
}: {
  entry: ConceptIntelEntry;
  chapterTitle: string;
}) {
  const concept = (entry.concept ?? {}) as Record<string, unknown>;

  const knowledge = toArr(entry.knowledge_items);
  const abilities = toArr(entry.abilities);
  const skills = toArr(entry.skills);
  const competencies = toArr(entry.competencies);
  const blooms = toArr(entry.blooms);
  const dok = toArr(entry.dok);
  const prerequisites = toArr(entry.prerequisites);
  const misconceptions = toArr(entry.misconceptions);
  const realWorld = toArr(entry.real_world_applications);
  const pedagogy = toArr(entry.pedagogy_recommendations);
  const objectives = toArr(entry.learning_objectives);
  const outcomes = toArr(entry.learning_outcomes);
  const blueprint = toArr(entry.assessment_blueprint);
  const relationships = toArr(entry.concept_relationships);
  const evidence = toArr(entry.evidence);
  const rubrics = (entry.assessment_rubrics ?? null) as Record<string, unknown> | null;
  const rubricItems = toArr(rubrics?.items);
  // teaching_notes is a record of named lists (key vocabulary, activities,
  // evidence tips). Flattening it to one ` · `-joined line, as every other field
  // here is, turns it into unreadable soup — so it keeps its headings.
  const TEACHING_NOTE_TITLES: Record<string, string> = {
    key_vocabulary: 'Words students must be able to use',
    practical_activities: 'Activities to do in class',
    blooms_verbs_used: 'Action words used in these questions',
    written_evidence_tips: 'What to look for in written work',
    oral_evidence_tips: 'What to listen for when students speak',
    experimental_evidence_tips: 'What to look for in practical work',
  };
  const teachingNoteGroups = Object.entries(
    (rubrics?.teaching_notes ?? {}) as Record<string, unknown>
  )
    .map(([key, value]) => ({
      key,
      title: TEACHING_NOTE_TITLES[key] ?? key.replace(/_/g, ' '),
      items: toStrList(value),
    }))
    .filter((group) => group.items.length > 0);

  const reasoning = (entry.agent_reasoning ?? null) as Record<string, unknown> | null;
  const reasoningSections = reasoning
    ? Object.entries(reasoning).filter(([, val]) => s(val))
    : [];

  const tabs = useMemo<TabDef[]>(() => {
    const all: TabDef[] = [
      { id: 'overview', label: 'Overview', Icon: Info, count: 1 },
      { id: 'knowledge', label: 'Knowledge', Icon: Brain, count: knowledge.length },
      { id: 'abilities', label: 'Abilities', Icon: Target, count: abilities.length },
      { id: 'skills', label: 'Skills', Icon: Zap, count: skills.length },
      { id: 'competencies', label: 'Competencies', Icon: Award, count: competencies.length },
      { id: 'blooms', label: "Bloom's", Icon: Layers, count: blooms.length },
      { id: 'dok', label: 'DOK', Icon: BarChart3, count: dok.length },
      { id: 'prerequisites', label: 'Prerequisites', Icon: Link2, count: prerequisites.length },
      { id: 'misconceptions', label: 'Misconceptions', Icon: TriangleAlert, count: misconceptions.length },
      { id: 'realworld', label: 'Real World', Icon: Globe, count: realWorld.length },
      { id: 'pedagogy', label: 'Pedagogy', Icon: Lightbulb, count: pedagogy.length },
      { id: 'objectives', label: 'Objectives', Icon: Flag, count: objectives.length },
      { id: 'outcomes', label: 'Outcomes', Icon: CheckCircle2, count: outcomes.length },
      { id: 'blueprint', label: 'Blueprint', Icon: FileText, count: blueprint.length },
      { id: 'rubrics', label: 'Rubrics', Icon: ClipboardCheck, count: rubricItems.length },
      { id: 'relationships', label: 'Relationships', Icon: Network, count: relationships.length },
      { id: 'evidence', label: 'Evidence', Icon: Quote, count: evidence.length },
      { id: 'reasoning', label: 'AI Reasoning', Icon: Sparkles, count: reasoningSections.length },
    ];
    return all.filter((tab) => tab.id === 'overview' || tab.count > 0);
  }, [
    knowledge.length,
    abilities.length,
    skills.length,
    competencies.length,
    blooms.length,
    dok.length,
    prerequisites.length,
    misconceptions.length,
    realWorld.length,
    pedagogy.length,
    objectives.length,
    outcomes.length,
    blueprint.length,
    rubricItems.length,
    relationships.length,
    evidence.length,
    reasoningSections.length,
  ]);

  const [active, setActive] = useState('overview');
  const activeTab = tabs.some((tab) => tab.id === active) ? active : 'overview';

  // --- tenant-wise tab names ----------------------------------------------
  // Nothing in the strip is named locally: the signed-in institute's labels
  // arrive from the API and are merged over the shipped defaults. Until they
  // land (or if the request fails) the defaults keep the strip readable.
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [labelError, setLabelError] = useState('');
  // Enter unmounts the input, which can fire a trailing blur. This tracks which
  // tab is genuinely still being edited so the second call is dropped instead of
  // committing an already-cleared draft over the name that was just saved.
  const editingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchConceptIntelligenceTabLabels(controller.signal)
      .then((result) => setLabels(result.byKey))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // A failed lookup is not worth blocking the panel over — the strip
        // falls back to the shipped names.
        console.warn('Falling back to default intelligence tab names:', error);
      });

    return () => controller.abort();
  }, []);

  const labelFor = useCallback(
    (tabId: string, fallback: string) =>
      labels[tabId] ?? DEFAULT_TAB_LABELS[tabId] ?? fallback,
    [labels]
  );

  const beginEdit = useCallback((tabId: string, current: string) => {
    setLabelError('');
    editingKeyRef.current = tabId;
    setEditingKey(tabId);
    setDraft(current);
  }, []);

  const cancelEdit = useCallback(() => {
    editingKeyRef.current = null;
    setEditingKey(null);
    setDraft('');
  }, []);

  const commitEdit = useCallback(
    async (tabId: string, next: string, previous: string) => {
      if (editingKeyRef.current !== tabId) return;
      editingKeyRef.current = null;

      const trimmed = next.trim();
      setEditingKey(null);
      setDraft('');

      // Blank restores the shipped name, which is a real change; only an
      // unchanged value is a no-op.
      if (trimmed === previous) return;

      setSavingKey(tabId);
      setLabelError('');

      // Show the new name straight away and roll it back if the save fails, so
      // renaming does not feel like it lags a round trip behind.
      setLabels((current) => ({ ...current, [tabId]: trimmed || (DEFAULT_TAB_LABELS[tabId] ?? previous) }));

      try {
        const result = await saveConceptIntelligenceTabLabel(tabId, trimmed);
        setLabels(result.byKey);
      } catch (error: unknown) {
        setLabels((current) => ({ ...current, [tabId]: previous }));
        setLabelError(error instanceof Error ? error.message : 'Could not save the tab name.');
      } finally {
        setSavingKey(null);
      }
    },
    []
  );

  const renderActive = () => {
    switch (activeTab) {
      case 'overview': {
        // Everything here is spelled out rather than chipped: this is the first
        // screen a new user lands on, and "Medium / Core / 0.92" in a row of
        // pills teaches nobody what the panel is measuring.
        const confidence = describeConfidence(s(concept.confidence));
        const conceptName = s(concept.concept_name);

        return (
          <div className="space-y-4">
            {(conceptName || s(concept.definition)) && (
              <div className={`${CARD} border-indigo-100 bg-indigo-50/40`}>
                {conceptName && (
                  <>
                    <SectionLabel hint={FIELD_GUIDE['concept.name']}>Concept</SectionLabel>
                    <p className="text-lg font-semibold leading-7 text-slate-900">{conceptName}</p>
                  </>
                )}
                {s(concept.definition) && (
                  <div className={conceptName ? 'mt-3' : ''}>
                    <SectionLabel hint={FIELD_GUIDE['concept.definition']}>
                      What it means
                    </SectionLabel>
                    <p className="text-[15px] leading-6 text-slate-700">{s(concept.definition)}</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {s(concept.concept_type) && (
                <FactTile
                  label="Kind of concept"
                  value={s(concept.concept_type)}
                  hint={FIELD_GUIDE['concept.type']}
                  tone="brand"
                />
              )}
              {s(concept.difficulty) && (
                <FactTile
                  label="Difficulty"
                  value={s(concept.difficulty)}
                  hint={FIELD_GUIDE['concept.difficulty']}
                  meaning={explainValue('difficulty', s(concept.difficulty))}
                  tone="warn"
                />
              )}
              {s(concept.importance) && (
                <FactTile
                  label="Importance"
                  value={s(concept.importance)}
                  hint={FIELD_GUIDE['concept.importance']}
                  meaning={explainValue('importance', s(concept.importance))}
                />
              )}
              {confidence && (
                <FactTile
                  label="How sure the AI is"
                  value={`${confidence.percent} — ${confidence.band}`}
                  hint={FIELD_GUIDE['concept.confidence']}
                  meaning={
                    confidence.tone === 'low'
                      ? 'Please check the Evidence tab before you use this.'
                      : 'This depends on how clearly the book explains the concept.'
                  }
                  tone={confidence.tone === 'low' ? 'alert' : 'neutral'}
                />
              )}
            </div>

            <p className="text-[13px] leading-5 text-slate-500">
              The tabs above break this concept down further — what to teach, what students should be
              able to do, where they go wrong, and how to test them. Each tab tells you what it is
              for at the top.
            </p>
          </div>
        );
      }

      case 'knowledge':
        return (
          <div className="grid grid-cols-1 gap-3">
            {knowledge.map((k, i) => (
              <div key={i} className={`${CARD} border-slate-200 bg-white`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold text-slate-900">
                    {getDisplayTitle(k, ['knowledge', 'statement', 'definition', 'concept_name'])}
                  </p>
                  {hasTruthy(k.knowledge_type) && (
                    <MetaChip
                      label="Type"
                      value={s(k.knowledge_type)}
                      hint={FIELD_GUIDE['knowledge.type']}
                      className="shrink-0 bg-slate-100 text-slate-600"
                    />
                  )}
                </div>
                {getDisplayBody(k, ['statement', 'definition', 'description']) && (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {getDisplayBody(k, ['statement', 'definition', 'description'])}
                  </p>
                )}
                {describeConfidence(s(k.confidence)) && (
                  <div className="mt-3">
                    <MetaChip
                      label="How sure the AI is"
                      value={describeConfidence(s(k.confidence))!.percent}
                      hint={FIELD_GUIDE['knowledge.confidence']}
                      className="bg-slate-100 text-slate-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case 'abilities':
        return (
          <div className="grid grid-cols-1 gap-3">
            {abilities.map((a, i) => (
              <div key={i} className={`${CARD} border-blue-100 bg-blue-50/40`}>
                {s(a.verb) && (
                  <MetaChip
                    label="Action"
                    value={s(a.verb)}
                    hint={FIELD_GUIDE['ability.verb']}
                    className="mb-2 bg-blue-600 text-white"
                  />
                )}
                <p className="text-[15px] font-semibold text-blue-900">
                  A student should be able to: {s(a.ability)}
                </p>
                {s(a.description) && <p className="mt-2 text-sm leading-6 text-slate-700">{s(a.description)}</p>}
                <RefLine
                  label="Needs this knowledge first:"
                  hint={FIELD_GUIDE['ability.knowledgeRefs']}
                  items={toStrList(a.knowledge_refs)}
                />
              </div>
            ))}
          </div>
        );

      case 'skills':
        return (
          <div className="grid grid-cols-1 gap-3">
            {skills.map((sk, i) => (
              <div key={i} className={`${CARD} border-teal-100 bg-teal-50/40`}>
                <p className="text-[15px] font-semibold text-teal-800">
                  {getDisplayTitle(sk, ['skill', 'title', 'concept_name'])}
                </p>
                <RefLine
                  label="Built from these abilities:"
                  hint={FIELD_GUIDE['skill.abilityRefs']}
                  items={toStrList(sk.ability_refs)}
                />
              </div>
            ))}
          </div>
        );

      case 'competencies':
        return (
          <div className="grid grid-cols-1 gap-3">
            {competencies.map((c, i) => (
              <div key={i} className={`${CARD} border-indigo-100 bg-indigo-50/40`}>
                <p className="text-[15px] font-semibold text-indigo-800">
                  {getDisplayTitle(c, ['competency', 'statement', 'concept_name'])}
                </p>
                {getDisplayBody(c, ['statement', 'description']) && (
                  <div className="mt-2">
                    <SectionLabel hint={FIELD_GUIDE['competency.statement']}>
                      What the student can do
                    </SectionLabel>
                    <p className="text-sm italic leading-6 text-slate-700">“{getDisplayBody(c, ['statement', 'description'])}”</p>
                  </div>
                )}
                {(toStrList(c.knowledge_refs).length > 0 ||
                  toStrList(c.ability_refs).length > 0 ||
                  toStrList(c.skill_refs).length > 0) && (
                  <div className="mt-3">
                    <SectionLabel hint={FIELD_GUIDE['competency.refs']}>Made up of</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {toStrList(c.knowledge_refs).length > 0 && (
                        <MetaChip
                          label="Knowledge"
                          value={toStrList(c.knowledge_refs).join(', ')}
                          className="bg-indigo-100 text-indigo-700"
                        />
                      )}
                      {toStrList(c.ability_refs).length > 0 && (
                        <MetaChip
                          label="Abilities"
                          value={toStrList(c.ability_refs).join(', ')}
                          className="bg-indigo-100 text-indigo-700"
                        />
                      )}
                      {toStrList(c.skill_refs).length > 0 && (
                        <MetaChip
                          label="Skills"
                          value={toStrList(c.skill_refs).join(', ')}
                          className="bg-indigo-100 text-indigo-700"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case 'blooms':
        // A bare "Apply 40%" is meaningless to anyone who has not met Bloom's
        // taxonomy, so each level carries its plain-English meaning and the
        // percentage is drawn as a bar with its unit named.
        return (
          <div className="space-y-2.5">
            {blooms.map((b, i) => {
              const level = s(b.level);
              const percent = toCoveragePercent(b.coverage_score);
              const meaning = explainValue('bloom', level);

              return (
                <div key={i} className={`${CARD} border-purple-100 bg-purple-50/40`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[15px] font-semibold text-purple-800">{level}</p>
                    {percent !== null && (
                      <p className="text-sm font-semibold text-purple-700">
                        {percent}%
                        <span className="ml-1 text-xs font-normal text-slate-500">of this concept</span>
                      </p>
                    )}
                  </div>
                  {meaning && <p className="mt-1 text-sm leading-6 text-slate-600">{meaning}</p>}
                  {percent !== null && (
                    <div
                      className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-purple-100"
                      role="img"
                      aria-label={`${percent}% of this concept's thinking is at the ${level} level`}
                    >
                      <div
                        className="h-full rounded-full bg-purple-500"
                        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <p className="pt-1 text-[13px] leading-5 text-slate-500">
              {FIELD_GUIDE['bloom.coverage']} This is called Bloom&apos;s taxonomy — a standard way of
              sorting thinking from easy to hard.
            </p>
          </div>
        );

      case 'dok':
        return (
          <div className="grid grid-cols-1 gap-3">
            {dok.map((d, i) => {
              const level = s(d.level);
              const meaning = explainValue('dok', level);

              return (
                <div key={i} className={`${CARD} flex items-start gap-4 border-amber-100 bg-amber-50/40`}>
                  <div className="flex shrink-0 flex-col items-center" aria-hidden="true">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-lg font-bold text-white">
                      {level}
                    </div>
                    <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                      Level
                    </span>
                  </div>
                  <span className="sr-only">Depth of knowledge level {level} of 4.</span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-amber-900">{s(d.description)}</p>
                    {meaning && <p className="mt-1 text-sm leading-6 text-slate-600">{meaning}</p>}
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-[13px] leading-5 text-slate-500">
              Depth is not the same as difficulty. A level 1 question can still be hard to remember,
              and a level 4 project can use easy facts.
            </p>
          </div>
        );

      case 'prerequisites':
        return (
          <div className="grid grid-cols-1 gap-3">
            {prerequisites.map((p, i) => (
              <div key={i} className={`${CARD} border-slate-200 bg-white`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold text-slate-900">{s(p.concept_name)}</p>
                  {s(p.necessity) && (
                    <MetaChip
                      label="Needed"
                      value={s(p.necessity)}
                      hint={FIELD_GUIDE['prerequisite.necessity']}
                      className="shrink-0 bg-slate-100 text-slate-600"
                    />
                  )}
                </div>
                {explainValue('necessity', s(p.necessity)) && (
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">
                    {explainValue('necessity', s(p.necessity))}
                  </p>
                )}
                {s(p.prerequisite_type) && (
                  <div className="mt-2">
                    <MetaChip
                      label="Kind"
                      value={s(p.prerequisite_type)}
                      hint={FIELD_GUIDE['prerequisite.type']}
                      className="bg-slate-100 text-slate-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case 'misconceptions':
        return (
          <div className="grid grid-cols-1 gap-3">
            {misconceptions.map((m, i) => (
              <div key={i} className={`${CARD} border-red-100 bg-red-50/40`}>
                <div className="flex items-start gap-1.5">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-red-600">
                      What students get wrong
                    </div>
                    <p className="mt-0.5 text-[15px] font-semibold text-red-800">{s(m.misconception)}</p>
                  </div>
                </div>
                {s(m.statement) && <p className="mt-2 text-sm leading-6 text-red-700/90">{s(m.statement)}</p>}
                <div className="mt-3 space-y-2">
                  {s(m.root_cause) && (
                    <div className="rounded-lg bg-red-100/70 p-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700">
                        Why they think it
                        <InfoHint text={FIELD_GUIDE['misconception.rootCause']} label="why they think it" />
                      </div>
                      <p className="mt-0.5 text-sm text-red-900/90">{s(m.root_cause)}</p>
                    </div>
                  )}
                  {s(m.correction) && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700">
                        How to put it right
                        <InfoHint text={FIELD_GUIDE['misconception.correction']} label="how to put it right" />
                      </div>
                      <p className="mt-0.5 text-sm text-green-900/90">{s(m.correction)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case 'realworld':
        return (
          <div className="grid grid-cols-1 gap-3">
            {realWorld.map((r, i) => (
              <div key={i} className={`${CARD} border-emerald-100 bg-emerald-50/40`}>
                {s(r.application_type) && (
                  <MetaChip
                    label="Where"
                    value={s(r.application_type)}
                    hint={FIELD_GUIDE['realworld.type']}
                    className="mb-2 bg-emerald-100 text-emerald-700"
                  />
                )}
                <p className="text-sm leading-6 text-slate-700">{s(r.example) || s(r.application)}</p>
                {s(r.relevance) && (
                  <p className="mt-2 text-xs leading-5 text-emerald-700/90">
                    <span className="font-semibold">Link to the concept: {s(r.relevance)}</span>
                    {explainValue('relevance', s(r.relevance)) && (
                      <span className="text-slate-500"> — {explainValue('relevance', s(r.relevance))}</span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        );

      case 'pedagogy':
        return (
          <div className="grid grid-cols-1 gap-3">
            {pedagogy.map((p, i) => (
              <div key={i} className={`${CARD} border-slate-200 bg-white`}>
                <p className="text-[15px] font-semibold text-slate-900">{s(p.strategy)}</p>
                {s(p.why_effective) && (
                  <div className="mt-2">
                    <SectionLabel hint={FIELD_GUIDE['pedagogy.why']}>
                      Why it works for this concept
                    </SectionLabel>
                    <p className="text-sm leading-6 text-slate-600">{s(p.why_effective)}</p>
                  </div>
                )}
                {toStrList(p.concept_characteristics).length > 0 && (
                  <div className="mt-3">
                    <SectionLabel hint={FIELD_GUIDE['pedagogy.characteristics']}>
                      What makes it a good fit
                    </SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {toStrList(p.concept_characteristics).map((char, idx) => (
                        <Chip key={idx} className="bg-slate-100 text-slate-600">{char}</Chip>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case 'objectives':
        return (
          <div className="grid grid-cols-1 gap-3">
            {objectives.map((o, i) => (
              <div key={i} className={`${CARD} flex items-start gap-3 border-slate-200 bg-white`}>
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {getDisplayTitle(o, ['objective', 'statement', 'description'])}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hasTruthy(o.objective_type) && (
                      <MetaChip
                        label="Aims at"
                        value={s(o.objective_type)}
                        hint={FIELD_GUIDE['objective.type']}
                        className="bg-slate-100 text-slate-600"
                      />
                    )}
                    {hasTruthy(o.priority) && (
                      <MetaChip
                        label="Priority"
                        value={s(o.priority)}
                        hint={explainValue('priority', s(o.priority)) || FIELD_GUIDE['objective.priority']}
                        className="bg-blue-100 text-blue-700"
                      />
                    )}
                    {hasTruthy(o.concept_name) && (
                      <MetaChip
                        label="Concept"
                        value={s(o.concept_name)}
                        className="bg-slate-100 text-slate-500"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'outcomes':
        return (
          <div className="grid grid-cols-1 gap-3">
            {outcomes.map((o, i) => (
              <div key={i} className={`${CARD} flex items-start gap-3 border-emerald-100 bg-emerald-50/30`}>
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-600">
                  ✓
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {getDisplayTitle(o, ['outcome', 'statement', 'description'])}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {hasTruthy(o.outcome_type) && (
                      <MetaChip
                        label="Shows"
                        value={s(o.outcome_type)}
                        hint={FIELD_GUIDE['outcome.type']}
                        className="bg-slate-100 text-slate-600"
                      />
                    )}
                    {boolish(o.measurable) && (
                      <MetaChip
                        value="Can be measured"
                        hint={FIELD_GUIDE['outcome.measurable']}
                        className="bg-emerald-100 text-emerald-700"
                      />
                    )}
                    {boolish(o.assessment_ready) && (
                      <MetaChip
                        value="Ready to use as an exam question"
                        hint={FIELD_GUIDE['outcome.assessmentReady']}
                        className="bg-emerald-100 text-emerald-700"
                      />
                    )}
                    {hasTruthy(o.concept_name) && (
                      <MetaChip
                        label="Concept"
                        value={s(o.concept_name)}
                        className="bg-white text-slate-500 ring-1 ring-slate-200"
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );

      case 'blueprint':
        return (
          <div className="grid grid-cols-1 gap-3">
            {blueprint.map((ab, i) => (
              <div key={i} className={`${CARD} border-amber-100 bg-amber-50/40`}>
                <div className="flex items-start justify-between gap-3">
                  {s(ab.recommended_question) && (
                    <div className="min-w-0">
                      <SectionLabel>Suggested question</SectionLabel>
                      <p className="text-sm italic leading-6 text-slate-800">“{s(ab.recommended_question)}”</p>
                    </div>
                  )}
                  {s(ab.marks) && (
                    <span className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-sm font-bold text-amber-700">
                      {marksLabel(s(ab.marks))}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s(ab.assessment_type) && (
                    <MetaChip
                      label="Format"
                      value={s(ab.assessment_type)}
                      hint={FIELD_GUIDE['assessment.type']}
                      className="bg-white text-slate-600 ring-1 ring-slate-200"
                    />
                  )}
                  {s(ab.difficulty) && (
                    <MetaChip
                      label="Difficulty"
                      value={s(ab.difficulty)}
                      hint={FIELD_GUIDE['assessment.difficulty']}
                      className="bg-white text-slate-600 ring-1 ring-slate-200"
                    />
                  )}
                  {s(ab.bloom_level) && (
                    <MetaChip
                      label="Thinking needed"
                      value={s(ab.bloom_level)}
                      hint={explainValue('bloom', s(ab.bloom_level)) || FIELD_GUIDE['assessment.bloom']}
                      className="bg-white text-slate-600 ring-1 ring-slate-200"
                    />
                  )}
                  {s(ab.dok_level) && (
                    <MetaChip
                      label="Depth"
                      value={`Level ${s(ab.dok_level)} of 4`}
                      hint={explainValue('dok', s(ab.dok_level)) || FIELD_GUIDE['assessment.dok']}
                      className="bg-white text-slate-600 ring-1 ring-slate-200"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case 'rubrics':
        return (
          <div className="space-y-3">
            {teachingNoteGroups.length > 0 && (
              <div className={`${CARD} border-slate-200 bg-slate-50`}>
                <SectionLabel hint={FIELD_GUIDE['rubric.teachingNotes']}>
                  Notes for teaching and marking
                </SectionLabel>
                <div className="space-y-3">
                  {teachingNoteGroups.map((group) => (
                    <div key={group.key}>
                      <p className="text-[13px] font-semibold text-slate-700">{group.title}</p>
                      <ul className="mt-1 space-y-1 text-sm text-slate-600">
                        {group.items.map((item, idx) => (
                          <li key={idx} className="flex gap-2">
                            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                            <span className="leading-6">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {rubricItems.map((it, i) => (
              <div key={i} className={`${CARD} border-violet-100 bg-violet-50/30`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold text-slate-900">{s(it.question)}</p>
                  {s(it.marks) && (
                    <span className="shrink-0 rounded-md bg-violet-100 px-2 py-1 text-sm font-bold text-violet-700">
                      {marksLabel(s(it.marks))}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s(it.assessment_type) && (
                    <MetaChip
                      label="Format"
                      value={s(it.assessment_type)}
                      hint={FIELD_GUIDE['assessment.type']}
                      className="bg-violet-100 text-violet-700"
                    />
                  )}
                  {s(it.difficulty) && (
                    <MetaChip
                      label="Difficulty"
                      value={s(it.difficulty)}
                      hint={FIELD_GUIDE['assessment.difficulty']}
                      className="bg-white text-slate-600 ring-1 ring-slate-200"
                    />
                  )}
                  {s(it.bloom_level) && (
                    <MetaChip
                      label="Thinking needed"
                      value={s(it.bloom_level)}
                      hint={explainValue('bloom', s(it.bloom_level)) || FIELD_GUIDE['assessment.bloom']}
                      className="bg-white text-slate-600 ring-1 ring-slate-200"
                    />
                  )}
                  {s(it.dok_level) && (
                    <MetaChip
                      label="Depth"
                      value={`Level ${s(it.dok_level)} of 4`}
                      hint={explainValue('dok', s(it.dok_level)) || FIELD_GUIDE['assessment.dok']}
                      className="bg-white text-slate-600 ring-1 ring-slate-200"
                    />
                  )}
                  {toStrList(it.assessment_objectives).length > 0 && (
                    <MetaChip
                      label="Tests objective"
                      value={toStrList(it.assessment_objectives).join(', ')}
                      hint={FIELD_GUIDE['assessment.objectives']}
                      className="bg-white text-slate-600 ring-1 ring-slate-200"
                    />
                  )}
                </div>

                {/* MCQ answer key */}
                {toArr(it.answer_key).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <SectionLabel hint={FIELD_GUIDE['rubric.answerKey']}>
                      Answer key — the correct option is marked in green
                    </SectionLabel>
                    {toArr(it.answer_key).map((opt, oi) => {
                      const correct = opt.is_correct === true || s(opt.is_correct) === 'true';
                      return (
                        <div
                          key={oi}
                          className={`rounded-lg border p-2.5 ${correct ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'}`}
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${correct ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                            >
                              {s(opt.option_label)}
                            </span>
                            <span className="font-medium text-slate-800">{s(opt.option_text)}</span>
                            {correct && <CheckCircle2 size={14} className="text-green-500" />}
                          </div>
                          {s(opt.rationale) && (
                            <p className="mt-1 pl-7 text-xs leading-5 text-slate-500">
                              <span className="font-semibold">
                                {correct ? 'Why this is right: ' : 'Why students pick this: '}
                              </span>
                              {s(opt.rationale)}
                            </p>
                          )}
                          {s(opt.misconception_tested) && (
                            <p className="mt-1 flex flex-wrap items-center gap-1 pl-7 text-xs leading-5 text-red-500">
                              <span className="font-semibold">Picking this suggests the student believes:</span>
                              <span>{s(opt.misconception_tested)}</span>
                              <InfoHint text={FIELD_GUIDE['rubric.misconceptionTested']} label="misconception tested" />
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Point-based marking */}
                {toArr(it.acceptable_points).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <SectionLabel hint={FIELD_GUIDE['rubric.acceptablePoints']}>Points that earn marks</SectionLabel>
                    {toArr(it.acceptable_points).map((p, pi) => (
                      <div key={pi} className="flex items-start gap-2 rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                        {s(p.marks) && (
                          <span className="mt-0.5 shrink-0 whitespace-nowrap rounded bg-violet-100 px-1.5 text-xs font-semibold text-violet-700">
                            {marksLabel(s(p.marks))}
                          </span>
                        )}
                        <div>
                          <p className="text-sm text-slate-700">{s(p.point)}</p>
                          {toStrList(p.alternatives).length > 0 && (
                            <p className="mt-0.5 text-xs text-slate-500">Also accept: {toStrList(p.alternatives).join('; ')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Levels of response */}
                {toStrList(it.indicative_content).length > 0 && (
                  <div className="mt-3">
                    <SectionLabel hint={FIELD_GUIDE['rubric.indicativeContent']}>What a good answer draws on</SectionLabel>
                    <ul className="space-y-1 text-sm text-slate-600">
                      {toStrList(it.indicative_content).map((pt, ci) => (
                        <li key={ci} className="flex gap-2">
                          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {toArr(it.level_descriptors).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <SectionLabel hint={FIELD_GUIDE['rubric.levelDescriptors']}>Mark bands — what an answer looks like at each level</SectionLabel>
                    {toArr(it.level_descriptors).map((ld, li) => (
                      <div key={li} className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-700">
                            {s(ld.display_label) || s(ld.quality_band) || `Level ${s(ld.level) || li + 1}`}
                          </span>
                          {(s(ld.mark_low) || s(ld.mark_high)) && (
                            <Chip className="bg-violet-100 text-violet-700">
                              {s(ld.mark_high) && s(ld.mark_high) !== s(ld.mark_low)
                                ? `${s(ld.mark_low)}–${s(ld.mark_high)} marks`
                                : marksLabel(s(ld.mark_low))}
                            </Chip>
                          )}
                        </div>
                        {toStrList(ld.descriptors).length > 0 && (
                          <ul className="space-y-1 text-xs text-slate-600">
                            {toStrList(ld.descriptors).map((desc, di) => (
                              <li key={di} className="flex gap-2">
                                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                                <span>{desc}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {toStrList(it.threshold_conditions).length > 0 && (
                  <div className="mt-3">
                    <SectionLabel hint={FIELD_GUIDE['rubric.thresholdConditions']}>Conditions an answer must meet</SectionLabel>
                    <ul className="space-y-1 text-sm text-slate-600">
                      {toStrList(it.threshold_conditions).map((tc, ti) => (
                        <li key={ti} className="flex gap-2">
                          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                          <span>{tc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {toStrList(it.common_errors).length > 0 && (
                  <div className="mt-3">
                    <SectionLabel hint={FIELD_GUIDE['rubric.commonErrors']}>Mistakes to expect while marking</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {toStrList(it.common_errors).map((e, ei) => (
                        <Chip key={ei} className="bg-red-50 text-red-600 ring-1 ring-red-100">{e}</Chip>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case 'relationships':
        return (
          <div className="grid grid-cols-1 gap-3">
            {relationships.map((r, i) => (
              <div key={i} className={`${CARD} border-cyan-100 bg-cyan-50/40`}>
                {/* Read as a sentence: "Photosynthesis needs this first Sunlight"
                    tells a teacher nothing, so the raw `depends_on` relation code
                    is swapped for the phrase it stands for. */}
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-cyan-800">
                    {getDisplayTitle(r, ['source_concept', 'concept_name', 'title'])}
                  </span>
                  {hasTruthy(r.relation_type) && (
                    <MetaChip
                      value={explainValue('relation', s(r.relation_type)) || s(r.relation_type).replace(/_/g, ' ')}
                      hint={FIELD_GUIDE['relationship.type']}
                      className="bg-cyan-100 text-cyan-700"
                    />
                  )}
                  <span className="font-semibold text-cyan-800">
                    {getDisplayTitle(r, ['target_concept', 'related_concept', 'concept_name'])}
                  </span>
                </div>
                {getDisplayBody(r, ['description', 'statement']) && (
                  <p className="mt-2 text-sm text-cyan-900/80">{getDisplayBody(r, ['description', 'statement'])}</p>
                )}
              </div>
            ))}
          </div>
        );

      case 'evidence':
        return (
          <div className="grid grid-cols-1 gap-3">
            {evidence.map((e, i) => (
              <div key={i} className={`${CARD} border-slate-200 bg-white`}>
                {s(e.source_type) && (
                  <MetaChip
                    label="Source"
                    value={s(e.source_type)}
                    className="mb-2 bg-slate-100 text-slate-600"
                  />
                )}
                <p className="text-sm italic leading-6 text-slate-600">“{s(e.source_text)}”</p>
                {explainValue('sourceType', s(e.source_type)) && (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {explainValue('sourceType', s(e.source_type))}
                  </p>
                )}
              </div>
            ))}
          </div>
        );

      case 'reasoning':
        return (
          <div className="space-y-3">
            {/* The raw keys are agent names (cognitive, pedagogy, assessment,
                rubrics). Say which tabs each one produced instead. */}
            {reasoningSections.map(([key, val]) => (
              <div key={key} className={`${CARD} border-slate-200 bg-white`}>
                <SectionLabel hint={FIELD_GUIDE['reasoning.section']}>
                  {REASONING_TITLES[key] ?? key.replace(/_/g, ' ')}
                </SectionLabel>
                {explainValue('reasoning', key) && (
                  <p className="mb-2 text-[13px] leading-5 text-slate-500">{explainValue('reasoning', key)}</p>
                )}
                <p className="text-sm leading-6 text-slate-600">{s(val)}</p>
              </div>
            ))}
          </div>
        );

      default:
        return <NothingHere what="details for this section" />;
    }
  };

  return (
    // Fill the parent's fixed height: tab band and footer stay pinned while the
    // active tab's content scrolls. Each region carries its own padding and
    // border so the component sits flush inside an unpadded card.
    <div className="flex h-full min-h-0 flex-col">
      {/* Tab band — pinned card header. Double-click a name to rename it for
          this institute; Enter saves, Escape restores it. */}
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 sm:px-5">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const TabIcon = tab.Icon;
            const isActive = tab.id === activeTab;
            const label = labelFor(tab.id, tab.label);

            if (editingKey === tab.id) {
              return (
                <span
                  key={tab.id}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#4f46e5] bg-white px-3 py-1.5 text-xs font-medium ring-2 ring-[#4f46e5]/20"
                >
                  <TabIcon size={14} className="text-[#4f46e5]" />
                  <input
                    autoFocus
                    value={draft}
                    maxLength={MAX_TAB_LABEL_LENGTH}
                    aria-label={`Rename the ${label} tab`}
                    size={Math.max(draft.length, 8)}
                    onChange={(event) => setDraft(event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void commitEdit(tab.id, draft, label);
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelEdit();
                      }
                    }}
                    // Clicking away commits the same way Enter does, so a
                    // rename is never silently thrown out.
                    onBlur={() => void commitEdit(tab.id, draft, label)}
                    className="min-w-[6ch] bg-transparent text-xs font-medium text-slate-900 outline-none"
                  />
                </span>
              );
            }

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                onDoubleClick={() => beginEdit(tab.id, label)}
                // The purpose comes first: hovering a tab should answer "what is
                // this?" before it mentions that the name can be changed.
                title={`${label} — ${TAB_GUIDE[tab.id]?.what ?? ''}\n\nDouble-click to rename this tab.`}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-[#4f46e5] text-white shadow-[0_6px_14px_rgba(79,70,229,0.25)]'
                    : 'text-slate-600 hover:bg-slate-100'
                } ${savingKey === tab.id ? 'opacity-60' : ''}`}
              >
                <TabIcon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                {label}
                {tab.id !== 'overview' && (
                  <span
                    className={`rounded-full px-1.5 text-[10px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {labelError && (
          <p className="mt-2 text-[11px] font-medium text-red-600">{labelError}</p>
        )}
      </div>

      {/* Active tab content — the only scrolling region. Every tab opens with a
          plain-English statement of what it holds and what to do with it, so no
          part of the panel depends on the reader already knowing the vocabulary. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-6">
        <TabIntro
          label={labelFor(activeTab, DEFAULT_TAB_LABELS[activeTab] ?? activeTab)}
          guide={TAB_GUIDE[activeTab]}
        />
        {renderActive()}
      </div>

      {/* Footer — pinned card footer */}
      <p className="shrink-0 border-t border-slate-200/80 bg-slate-50/60 px-6 py-3 text-center text-[11px] leading-5 text-slate-400">
        AI wrote all of this by reading the textbook and syllabus for {chapterTitle}. Please check it
        on the Evidence tab before you use it for marks.
      </p>
    </div>
  );
}
