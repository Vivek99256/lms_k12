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
import type { ConceptIntelEntry } from '../../data/chapters';
import {
  DEFAULT_TAB_LABELS,
  MAX_TAB_LABEL_LENGTH,
  fetchConceptIntelligenceTabLabels,
  saveConceptIntelligenceTabLabel,
} from '../../data/conceptIntelligenceTabLabels';

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
const EMPTY =
  'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-500';

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
      {children}
    </div>
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
      case 'overview':
        return (
          <div className="space-y-4">
            <div className={`${CARD} border-indigo-100 bg-indigo-50/40`}>
              <div className="flex flex-wrap items-center gap-1.5">
                {s(concept.concept_type) && (
                  <Chip className="bg-indigo-100 text-indigo-700">{s(concept.concept_type)}</Chip>
                )}
                {s(concept.difficulty) && (
                  <Chip className="bg-amber-100 text-amber-700">Difficulty: {s(concept.difficulty)}</Chip>
                )}
                {s(concept.importance) && (
                  <Chip className="bg-slate-100 text-slate-600">Importance: {s(concept.importance)}</Chip>
                )}
                {s(concept.confidence) && (
                  <Chip className="bg-slate-100 text-slate-600">Confidence: {s(concept.confidence)}</Chip>
                )}
              </div>
              {s(concept.definition) && (
                <div className="mt-3">
                  <SectionLabel>Definition</SectionLabel>
                  <p className="text-[15px] leading-6 text-slate-700">{s(concept.definition)}</p>
                </div>
              )}
            </div>
          </div>
        );

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
                    <Chip className="shrink-0 bg-slate-100 text-slate-600">{s(k.knowledge_type)}</Chip>
                  )}
                </div>
                {getDisplayBody(k, ['statement', 'definition', 'description']) && (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {getDisplayBody(k, ['statement', 'definition', 'description'])}
                  </p>
                )}
                {hasTruthy(k.confidence) && (
                  <div className="mt-3">
                    <Chip className="bg-slate-100 text-slate-500">Confidence: {s(k.confidence)}</Chip>
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
                  <Chip className="mb-2 bg-blue-600 text-white">{s(a.verb)}</Chip>
                )}
                <p className="text-[15px] font-semibold text-blue-900">{s(a.ability)}</p>
                {s(a.description) && <p className="mt-2 text-sm leading-6 text-slate-700">{s(a.description)}</p>}
                {toStrList(a.knowledge_refs).length > 0 && (
                  <p className="mt-2 text-xs text-blue-700/80">
                    <span className="font-semibold">Refs:</span> {toStrList(a.knowledge_refs).join(', ')}
                  </p>
                )}
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
                {toStrList(sk.ability_refs).length > 0 && (
                  <p className="mt-2 text-xs text-teal-700/80">
                    <span className="font-semibold">Ability refs:</span> {toStrList(sk.ability_refs).join(', ')}
                  </p>
                )}
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
                  <p className="mt-2 text-sm italic leading-6 text-slate-700">“{getDisplayBody(c, ['statement', 'description'])}”</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {toStrList(c.knowledge_refs).length > 0 && (
                    <Chip className="bg-indigo-100 text-indigo-700">Knowledge: {toStrList(c.knowledge_refs).join(', ')}</Chip>
                  )}
                  {toStrList(c.ability_refs).length > 0 && (
                    <Chip className="bg-indigo-100 text-indigo-700">Ability: {toStrList(c.ability_refs).join(', ')}</Chip>
                  )}
                  {toStrList(c.skill_refs).length > 0 && (
                    <Chip className="bg-indigo-100 text-indigo-700">Skill: {toStrList(c.skill_refs).join(', ')}</Chip>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case 'blooms':
        return (
          <div className="flex flex-wrap gap-2">
            {blooms.map((b, i) => {
              const score = Number(b.coverage_score);
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-xl border border-purple-100 bg-purple-50/50 px-4 py-2"
                >
                  <span className="text-sm font-semibold text-purple-700">{s(b.level)}</span>
                  {Number.isFinite(score) && (
                    <span className="text-xs text-slate-500">{Math.round(score * 100)}%</span>
                  )}
                </div>
              );
            })}
          </div>
        );

      case 'dok':
        return (
          <div className="grid grid-cols-1 gap-3">
            {dok.map((d, i) => (
              <div key={i} className={`${CARD} flex items-center gap-4 border-amber-100 bg-amber-50/40`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-lg font-bold text-white">
                  {s(d.level)}
                </div>
                <p className="text-sm font-medium text-amber-900">{s(d.description)}</p>
              </div>
            ))}
          </div>
        );

      case 'prerequisites':
        return (
          <div className="grid grid-cols-1 gap-3">
            {prerequisites.map((p, i) => (
              <div key={i} className={`${CARD} flex items-center justify-between gap-3 border-slate-200 bg-white`}>
                <div>
                  <p className="text-[15px] font-semibold text-slate-900">{s(p.concept_name)}</p>
                  {s(p.prerequisite_type) && (
                    <p className="text-xs text-slate-500">{s(p.prerequisite_type)}</p>
                  )}
                </div>
                {s(p.necessity) && <Chip className="shrink-0 bg-slate-100 text-slate-600">{s(p.necessity)}</Chip>}
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
                  <TriangleAlert size={16} className="mt-0.5 shrink-0 text-red-500" />
                  <p className="text-[15px] font-semibold text-red-800">{s(m.misconception)}</p>
                </div>
                {s(m.statement) && <p className="mt-2 text-sm leading-6 text-red-700/90">{s(m.statement)}</p>}
                <div className="mt-3 space-y-2">
                  {s(m.root_cause) && (
                    <div className="rounded-lg bg-red-100/70 p-2.5">
                      <div className="text-[11px] font-semibold text-red-700">Root cause</div>
                      <p className="text-sm text-red-900/90">{s(m.root_cause)}</p>
                    </div>
                  )}
                  {s(m.correction) && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-2.5">
                      <div className="text-[11px] font-semibold text-green-700">Correction</div>
                      <p className="text-sm text-green-900/90">{s(m.correction)}</p>
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
                  <Chip className="mb-2 bg-emerald-100 text-emerald-700">{s(r.application_type)}</Chip>
                )}
                <p className="text-sm leading-6 text-slate-700">{s(r.example) || s(r.application)}</p>
                {s(r.relevance) && <p className="mt-2 text-xs text-emerald-700/80">{s(r.relevance)}</p>}
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
                {s(p.why_effective) && <p className="mt-2 text-sm leading-6 text-slate-600">{s(p.why_effective)}</p>}
                {toStrList(p.concept_characteristics).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {toStrList(p.concept_characteristics).map((char, idx) => (
                      <Chip key={idx} className="bg-slate-100 text-slate-600">{char}</Chip>
                    ))}
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
                    {hasTruthy(o.objective_type) && <Chip className="bg-slate-100 text-slate-600">{s(o.objective_type)}</Chip>}
                    {hasTruthy(o.priority) && <Chip className="bg-blue-100 text-blue-700">{s(o.priority)} priority</Chip>}
                    {hasTruthy(o.concept_name) && <Chip className="bg-slate-100 text-slate-500">Concept: {s(o.concept_name)}</Chip>}
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
                    {hasTruthy(o.outcome_type) && <Chip className="bg-slate-100 text-slate-600">{s(o.outcome_type)}</Chip>}
                    {boolish(o.measurable) && (
                      <Chip className="bg-emerald-100 text-emerald-700">Measurable</Chip>
                    )}
                    {boolish(o.assessment_ready) && (
                      <Chip className="bg-emerald-100 text-emerald-700">Assessment ready</Chip>
                    )}
                    {hasTruthy(o.concept_name) && <Chip className="bg-white text-slate-500 ring-1 ring-slate-200">Concept: {s(o.concept_name)}</Chip>}
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
                    <p className="text-sm italic leading-6 text-slate-800">“{s(ab.recommended_question)}”</p>
                  )}
                  {s(ab.marks) && (
                    <span className="shrink-0 rounded-md bg-amber-100 px-2 py-1 text-sm font-bold text-amber-700">
                      {s(ab.marks)} Marks
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s(ab.assessment_type) && <Chip className="bg-white text-slate-600 ring-1 ring-slate-200">{s(ab.assessment_type)}</Chip>}
                  {s(ab.difficulty) && <Chip className="bg-white text-slate-600 ring-1 ring-slate-200">Difficulty: {s(ab.difficulty)}</Chip>}
                  {s(ab.bloom_level) && <Chip className="bg-white text-slate-600 ring-1 ring-slate-200">Bloom: {s(ab.bloom_level)}</Chip>}
                  {s(ab.dok_level) && <Chip className="bg-white text-slate-600 ring-1 ring-slate-200">DOK {s(ab.dok_level)}</Chip>}
                </div>
              </div>
            ))}
          </div>
        );

      case 'rubrics':
        return (
          <div className="space-y-3">
            {s(rubrics?.teaching_notes) && (
              <div className={`${CARD} border-slate-200 bg-slate-50`}>
                <SectionLabel>Teaching notes</SectionLabel>
                <p className="text-sm leading-6 text-slate-600">{s(rubrics?.teaching_notes)}</p>
              </div>
            )}
            {rubricItems.map((it, i) => (
              <div key={i} className={`${CARD} border-violet-100 bg-violet-50/30`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-semibold text-slate-900">{s(it.question)}</p>
                  {s(it.marks) && (
                    <span className="shrink-0 rounded-md bg-violet-100 px-2 py-1 text-sm font-bold text-violet-700">
                      {s(it.marks)} Marks
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s(it.assessment_type) && <Chip className="bg-violet-100 text-violet-700">{s(it.assessment_type)}</Chip>}
                  {s(it.difficulty) && <Chip className="bg-white text-slate-600 ring-1 ring-slate-200">{s(it.difficulty)}</Chip>}
                  {s(it.bloom_level) && <Chip className="bg-white text-slate-600 ring-1 ring-slate-200">Bloom: {s(it.bloom_level)}</Chip>}
                  {s(it.dok_level) && <Chip className="bg-white text-slate-600 ring-1 ring-slate-200">DOK {s(it.dok_level)}</Chip>}
                  {toStrList(it.assessment_objectives).length > 0 && (
                    <Chip className="bg-white text-slate-600 ring-1 ring-slate-200">{toStrList(it.assessment_objectives).join(', ')}</Chip>
                  )}
                </div>

                {/* MCQ answer key */}
                {toArr(it.answer_key).length > 0 && (
                  <div className="mt-3 space-y-1.5">
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
                          {s(opt.rationale) && <p className="mt-1 pl-7 text-xs text-slate-500">{s(opt.rationale)}</p>}
                          {s(opt.misconception_tested) && (
                            <p className="mt-1 pl-7 text-xs text-red-500">Tests misconception: {s(opt.misconception_tested)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Point-based marking */}
                {toArr(it.acceptable_points).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <SectionLabel>Acceptable points</SectionLabel>
                    {toArr(it.acceptable_points).map((p, pi) => (
                      <div key={pi} className="flex items-start gap-2 rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                        {s(p.marks) && (
                          <span className="mt-0.5 shrink-0 rounded bg-violet-100 px-1.5 text-xs font-semibold text-violet-700">
                            {s(p.marks)}m
                          </span>
                        )}
                        <div>
                          <p className="text-sm text-slate-700">{s(p.point)}</p>
                          {toStrList(p.alternatives).length > 0 && (
                            <p className="mt-0.5 text-xs text-slate-400">alt: {toStrList(p.alternatives).join('; ')}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Levels of response */}
                {toStrList(it.indicative_content).length > 0 && (
                  <div className="mt-3">
                    <SectionLabel>Indicative content</SectionLabel>
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
                    <SectionLabel>Level descriptors</SectionLabel>
                    {toArr(it.level_descriptors).map((ld, li) => (
                      <div key={li} className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-700">
                            {s(ld.display_label) || s(ld.quality_band) || `Level ${s(ld.level) || li + 1}`}
                          </span>
                          {(s(ld.mark_low) || s(ld.mark_high)) && (
                            <Chip className="bg-violet-100 text-violet-700">
                              {s(ld.mark_low)}
                              {s(ld.mark_high) && s(ld.mark_high) !== s(ld.mark_low) ? `–${s(ld.mark_high)}` : ''} marks
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
                    <SectionLabel>Threshold conditions</SectionLabel>
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
                    <SectionLabel>Common errors</SectionLabel>
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
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-cyan-800">
                    {getDisplayTitle(r, ['source_concept', 'concept_name', 'title'])}
                  </span>
                  {hasTruthy(r.relation_type) && (
                    <Chip className="bg-cyan-100 text-cyan-700">{s(r.relation_type)}</Chip>
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
                  <Chip className="mb-2 bg-slate-100 text-slate-600">{s(e.source_type)}</Chip>
                )}
                <p className="text-sm italic leading-6 text-slate-600">“{s(e.source_text)}”</p>
              </div>
            ))}
          </div>
        );

      case 'reasoning':
        return (
          <div className="space-y-3">
            {reasoningSections.map(([key, val]) => (
              <div key={key} className={`${CARD} border-slate-200 bg-white`}>
                <SectionLabel>{key.replace(/_/g, ' ')}</SectionLabel>
                <p className="text-sm leading-6 text-slate-600">{s(val)}</p>
              </div>
            ))}
          </div>
        );

      default:
        return <div className={EMPTY}>Nothing to show here.</div>;
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
                title={`${label} — double-click to rename`}
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

      {/* Active tab content — the only scrolling region */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-5 sm:px-6">{renderActive()}</div>

      {/* Footer — pinned card footer */}
      <p className="shrink-0 border-t border-slate-200/80 bg-slate-50/60 px-6 py-3 text-center text-[11px] text-slate-400">
        Concept intelligence for {chapterTitle}
      </p>
    </div>
  );
}
