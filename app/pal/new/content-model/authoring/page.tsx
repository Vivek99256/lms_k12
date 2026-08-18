'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  History,
  Languages,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import NewPalNav from '@/app/pal/new/_components/NewPalNav';
import {
  enrichNode,
  fetchNode,
  fetchVocabulary,
  humanise,
  restoreRevision,
  saveNode,
  statusTone,
  transitionNode,
  translateNode,
  type ContentModelVocabulary,
  type NodeDetail,
  type NodeRevision,
} from '@/app/pal/new/data/content-model';

/**
 * Content Model — authoring interface (spec §9.1).
 *
 * One node: its body, its full metadata schema, its language variants, its
 * version history and its place in the QA pipeline.
 *
 * The form is BUILT FROM THE API: field groups, field order and every selector's
 * options come from the vocabulary endpoint, so adding a metadata field on the
 * server makes it appear here without a frontend change. A field the server
 * marks LLM-only gets an "Ask AI" affordance instead of a guess.
 */
export default function AuthoringPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading node…
        </div>
      }
    >
      <AuthoringContent />
    </Suspense>
  );
}

function AuthoringContent() {
  const searchParams = useSearchParams();
  const nodeKey = searchParams?.get('node') ?? '';

  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [vocabulary, setVocabulary] = useState<ContentModelVocabulary | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revisions, setRevisions] = useState<NodeRevision[]>([]);
  const [targetLanguage, setTargetLanguage] = useState('hi');
  const [translationPreview, setTranslationPreview] = useState<{ language: string; body: string } | null>(
    null
  );
  const [aiProposal, setAiProposal] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!nodeKey) {
        setError('No node was selected.');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [node, vocab] = await Promise.all([fetchNode(nodeKey, signal), fetchVocabulary(signal)]);
        setDetail(node);
        setVocabulary(vocab);
        setRevisions(node.revisions);
        setTitle(node.node.title);
        setBody(node.node.body || node.node.prompt);
        setDraft({});
        if (vocab.languages.length > 0) {
          setTargetLanguage(vocab.languages.find((l) => l !== 'en') ?? vocab.languages[0]);
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message || 'Could not load this node.');
      } finally {
        setLoading(false);
      }
    },
    [nodeKey]
  );

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      await load(controller.signal);
    };
    void run();
    return () => controller.abort();
  }, [load]);

  const node = detail?.node;

  /** Current value for a metadata field: unsaved edit first, then the node. */
  const valueOf = useCallback(
    (field: string): string => {
      if (field in draft) return draft[field];
      const raw = node?.metadata?.[field];
      if (raw === null || raw === undefined) return '';
      if (Array.isArray(raw)) return raw.join(', ');
      if (typeof raw === 'boolean') return raw ? 'true' : 'false';
      if (typeof raw === 'object') return JSON.stringify(raw);
      return String(raw);
    },
    [draft, node]
  );

  /** Which closed set (if any) a field must be chosen from. */
  const optionsFor = useCallback(
    (field: string): string[] | null => {
      if (!vocabulary) return null;
      if (vocabulary.frameworkVocabulary[field]) return vocabulary.frameworkVocabulary[field];

      switch (field) {
        case 'bloom_level':
          return vocabulary.bloomLevels.map((b) => b.key);
        case 'cultural_context':
          return vocabulary.culturalContexts;
        case 'language':
          return vocabulary.languages;
        case 'h5p_type':
          return vocabulary.h5pTypes;
        case 'format':
          return Object.keys(vocabulary.formats);
        case 'content_type':
          return Object.keys(vocabulary.contentTypes);
        case 'knowledge_type':
          return vocabulary.knowledgeTypes;
        case 'scaffold_type':
          return vocabulary.scaffoldTypes;
        case 'hpc_lens_primary':
          return vocabulary.hpcLenses;
        case 'dok_level':
          return Object.keys(vocabulary.dokLevels);
        case 'difficulty_1_to_5':
          return ['1', '2', '3', '4', '5'];
        case 'practice_level':
          return ['1', '2', '3', '4', '5'];
        default:
          return null;
      }
    },
    [vocabulary]
  );

  const readOnlyFields = useMemo(
    () =>
      new Set([
        'node_key',
        'content_id_ref',
        'concept_key',
        'concept_name',
        'quality_status',
        'tagged_by',
        'reviewed_by',
        'reviewed_at',
        'version',
        'reading_level_fk',
      ]),
    []
  );

  const mandatory = useMemo(() => {
    if (!vocabulary || !node) return new Set<string>();
    return new Set(vocabulary.mandatoryFields[node.contentType] ?? []);
  }, [vocabulary, node]);

  const dirty = Object.keys(draft).length > 0 || title !== (node?.title ?? '') || body !== (node?.body || node?.prompt || '');

  const handleSave = async () => {
    if (!node) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const metadata: Record<string, unknown> = {};
      Object.entries(draft).forEach(([field, value]) => {
        // Array-valued fields are typed as comma-separated text; the server
        // validates each member against the closed vocabulary.
        if (['skills', 'competencies', 'misconception_tags', 'pedagogy_secondary', 'gardner_intelligence', 'language_variants_available', 'common_errors'].includes(field)) {
          metadata[field] = value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
          return;
        }
        metadata[field] = value === '' ? null : value;
      });

      const result = await saveNode(node.nodeKey, {
        title: title || null,
        body: body || null,
        metadata,
        note: 'Edited in the Content Model authoring interface.',
      });

      setRevisions(result.revisions);
      setDraft({});
      setNotice('Saved. A new revision was recorded.');
      await load();
    } catch (err) {
      setError((err as Error).message || 'Could not save this node.');
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (toStatus: string) => {
    if (!node) return;
    setBusyAction(`transition:${toStatus}`);
    setError('');
    setNotice('');
    try {
      await transitionNode(node.nodeKey, toStatus);
      setNotice(`Moved to ${humanise(toStatus)}.`);
      await load();
    } catch (err) {
      setError((err as Error).message || 'Could not change the status.');
    } finally {
      setBusyAction('');
    }
  };

  const handleEnrich = async (kind: 'cultural_context' | 'framework_tags' | 'variant_draft', apply: boolean) => {
    if (!node) return;
    setBusyAction(`enrich:${kind}`);
    setError('');
    setNotice('');
    setAiProposal(null);
    try {
      const result = await enrichNode(node.nodeKey, kind, {
        fields: kind === 'framework_tags' ? detail?.llmCandidates : undefined,
        apply,
      });
      setAiProposal(result.proposal);
      setNotice(
        result.applied
          ? `Applied as a draft proposal (tagged ${result.taggedBy}). Approve it yourself once you agree with it.`
          : `Proposal ready${result.cached ? ' (from cache)' : ''} via ${result.method}${result.model ? ` · ${result.model}` : ''}. Nothing was saved.`
      );
      if (apply) await load();
    } catch (err) {
      setError((err as Error).message || 'Enrichment failed.');
    } finally {
      setBusyAction('');
    }
  };

  const handleTranslate = async (apply: boolean) => {
    if (!node) return;
    setBusyAction('translate');
    setError('');
    setNotice('');
    try {
      const result = await translateNode(node.nodeKey, targetLanguage, apply);
      setTranslationPreview({ language: result.language, body: result.body });
      setNotice(
        result.applied
          ? `Stored the ${result.language} variant as a draft.`
          : `Translation ready${result.cached ? ' (from cache)' : ''}. Nothing was saved.`
      );
      if (apply) await load();
    } catch (err) {
      setError((err as Error).message || 'Translation failed.');
    } finally {
      setBusyAction('');
    }
  };

  const handleRestore = async (version: number) => {
    if (!node) return;
    setBusyAction(`restore:${version}`);
    setError('');
    try {
      const result = await restoreRevision(node.nodeKey, version);
      setRevisions(result.revisions);
      setNotice(`Restored version ${version}. The restore is itself a new revision.`);
      await load();
    } catch (err) {
      setError((err as Error).message || 'Could not restore that version.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {detail ? (
              <Link
                href={`/pal/new/content-model/concept?chapter=${detail.semanticId}&slug=${detail.conceptSlug}`}
              >
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Concept
                </Button>
              </Link>
            ) : (
              <Link href="/pal/new/content-model">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Content model
                </Button>
              </Link>
            )}
            <div>
              <h1 className="text-[22px] font-semibold text-[#1F2A44]">
                {node?.title || 'Authoring'}
              </h1>
              <p className="mt-0.5 font-mono text-xs text-slate-400">{nodeKey}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Reload
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={saving || !dirty || !node}>
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </div>

        <NewPalNav />

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        {loading && !detail ? (
          <div className="flex items-center justify-center rounded-2xl border border-[#DFE6F2] bg-white py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            <span className="ml-2 text-sm text-slate-500">Loading node…</span>
          </div>
        ) : null}

        {detail && node && vocabulary ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {/* left: content + metadata */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold text-[#1F2A44]">Content</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusTone(node.qualityStatus)}`}
                    >
                      {humanise(node.qualityStatus)}
                    </span>
                    <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                      {vocabulary.contentTypes[node.contentType]?.label ?? node.contentType}
                    </span>
                    {node.hasOverride ? (
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] text-indigo-700">
                        edited
                      </span>
                    ) : null}
                  </div>
                </div>

                <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />

                <label className="mt-4 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={14}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-[12px] leading-relaxed outline-none focus:border-indigo-400"
                />

                <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                  <span>{body.trim() ? body.trim().split(/\s+/).length : 0} words</span>
                  {node.metadata.reading_level_fk ? (
                    <span>
                      Flesch-Kincaid grade{' '}
                      <span className="font-mono">{String(node.metadata.reading_level_fk)}</span>
                      {detail.standard && Number(node.metadata.reading_level_fk) > detail.standard ? (
                        <span className="ml-1 text-amber-600">
                          — above the Grade {detail.standard} reader
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  {node.metadata.estimated_duration_minutes ? (
                    <span>≈ {String(node.metadata.estimated_duration_minutes)} min</span>
                  ) : null}
                </div>

                {node.gap ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-800">
                    {node.gapReason}
                  </div>
                ) : null}
              </div>

              {/* metadata form, built entirely from the API's field groups */}
              {Object.entries(vocabulary.metadataFieldGroups).map(([group, fields]) => (
                <div
                  key={group}
                  className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]"
                >
                  <h2 className="text-[15px] font-semibold text-[#1F2A44]">{humanise(group)}</h2>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {fields.map((field) => {
                      const options = optionsFor(field);
                      const readOnly = readOnlyFields.has(field);
                      const provenance = detail.provenance[field] ?? 'missing';
                      const isMandatory = mandatory.has(field);
                      const missing = node.missingMandatory.includes(field);
                      const value = valueOf(field);

                      return (
                        <div key={field}>
                          <div className="flex items-center gap-1.5">
                            <label className="text-[11px] font-medium text-slate-500">
                              {humanise(field)}
                              {isMandatory ? <span className="text-rose-500"> *</span> : null}
                            </label>
                            <ProvenanceDot provenance={provenance} />
                          </div>

                          {readOnly ? (
                            <p className="mt-1 truncate rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-600">
                              {value || '—'}
                            </p>
                          ) : options ? (
                            <select
                              value={value}
                              onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                              className={`mt-1 w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus:border-indigo-400 ${
                                missing ? 'border-amber-300' : 'border-slate-200'
                              }`}
                            >
                              <option value="">— not set —</option>
                              {options.map((option) => (
                                <option key={option} value={option}>
                                  {humanise(option)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              value={value}
                              onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                              className={`mt-1 w-full rounded-lg border px-2.5 py-2 text-sm outline-none focus:border-indigo-400 ${
                                missing ? 'border-amber-300' : 'border-slate-200'
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* right: QA, AI, languages, history */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                <h2 className="text-[15px] font-semibold text-[#1F2A44]">Quality pipeline</h2>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-[11px] text-slate-400">Metadata completeness</p>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${node.completeness}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-lg font-semibold text-slate-800">
                    {node.completeness}%
                  </span>
                </div>

                {node.missingMandatory.length > 0 ? (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      Cannot be approved until these are filled:{' '}
                      <span className="font-medium">
                        {node.missingMandatory.map(humanise).join(', ')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    All mandatory fields are present.
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {detail.allowedTransitions.length === 0 ? (
                    <p className="text-xs text-slate-500">No further transition is available.</p>
                  ) : (
                    detail.allowedTransitions.map((status) => (
                      <Button
                        key={status}
                        variant={status === 'approved' ? 'default' : 'outline'}
                        size="sm"
                        disabled={busyAction === `transition:${status}`}
                        onClick={() => void handleTransition(status)}
                      >
                        {busyAction === `transition:${status}` ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {humanise(status)}
                      </Button>
                    ))
                  )}
                </div>

                <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                  Only {vocabulary.servableStatuses.join(', ')} content reaches a learner. An edit to
                  approved content sends it back for review — the approval was of the previous text.
                </p>
              </div>

              {/* AI assistance */}
              <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  <h2 className="text-[15px] font-semibold text-[#1F2A44]">AI assistance</h2>
                </div>

                {!vocabulary.aiAvailable ? (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                    {vocabulary.aiUnavailableReason}
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-slate-500">
                      Used only for fields the extraction cannot answer. Everything it returns is a
                      draft proposal tagged <span className="font-mono">ai</span> — a person still
                      approves it.
                    </p>

                    {detail.llmCandidates.length > 0 ? (
                      <p className="mt-2 text-[11px] text-slate-500">
                        Unanswered: {detail.llmCandidates.map(humanise).join(', ')}
                      </p>
                    ) : (
                      <p className="mt-2 text-[11px] text-emerald-700">
                        Every AI-fillable field already has a value.
                      </p>
                    )}

                    <div className="mt-3 space-y-2">
                      <AiRow
                        label="Cultural context"
                        hint="Lexicon first; the model only runs when that is inconclusive."
                        busy={busyAction === 'enrich:cultural_context'}
                        onPreview={() => void handleEnrich('cultural_context', false)}
                        onApply={() => void handleEnrich('cultural_context', true)}
                      />
                      <AiRow
                        label="Framework tags"
                        hint="RIASEC, Gardner, NGSS, CASEL, NCDG, HPC lens, career cluster."
                        busy={busyAction === 'enrich:framework_tags'}
                        onPreview={() => void handleEnrich('framework_tags', false)}
                        onApply={() => void handleEnrich('framework_tags', true)}
                      />
                      {node.contentType === 'concept' ? (
                        <AiRow
                          label="Draft this variant"
                          hint="Writes the variant from the concept's own textbook evidence."
                          busy={busyAction === 'enrich:variant_draft'}
                          onPreview={() => void handleEnrich('variant_draft', false)}
                          onApply={() => void handleEnrich('variant_draft', true)}
                        />
                      ) : null}
                    </div>

                    {aiProposal ? (
                      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-900 px-3.5 py-3 text-[11px] leading-relaxed text-slate-100">
                        {JSON.stringify(aiProposal, null, 2)}
                      </pre>
                    ) : null}
                  </>
                )}
              </div>

              {/* language variants */}
              <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2">
                  <Languages className="h-4 w-4 text-slate-400" />
                  <h2 className="text-[15px] font-semibold text-[#1F2A44]">Language variants</h2>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {vocabulary.languages.map((language) => {
                    const stored = node.languageVariants[language];
                    const isBase = language === (node.metadata.language ?? 'en');
                    return (
                      <span
                        key={language}
                        className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${
                          isBase
                            ? 'bg-indigo-50 text-indigo-700'
                            : stored
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-50 text-slate-400'
                        }`}
                        title={stored ? `Stored (${stored.source})` : isBase ? 'Base language' : 'Not translated'}
                      >
                        {language}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="h-9 rounded-lg border border-slate-200 px-2.5 text-sm outline-none focus:border-indigo-400"
                  >
                    {vocabulary.languages.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!vocabulary.aiAvailable || busyAction === 'translate'}
                    onClick={() => void handleTranslate(false)}
                  >
                    {busyAction === 'translate' ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    disabled={!vocabulary.aiAvailable || busyAction === 'translate'}
                    onClick={() => void handleTranslate(true)}
                  >
                    Store variant
                  </Button>
                </div>

                {translationPreview ? (
                  <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 px-3.5 py-3 text-[12px] leading-relaxed text-slate-700">
                    {translationPreview.body}
                  </pre>
                ) : null}
              </div>

              {/* version history */}
              <div className="rounded-2xl border border-[#DFE6F2] bg-white p-5 shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-400" />
                  <h2 className="text-[15px] font-semibold text-[#1F2A44]">
                    Version history ({revisions.length})
                  </h2>
                </div>

                {revisions.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">
                    No edits yet. This node is exactly what the projection produced.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {revisions.map((revision) => (
                      <li
                        key={revision.version}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800">
                            <span className="font-mono text-xs text-slate-400">
                              v{revision.version}
                            </span>{' '}
                            {revision.changedFields.map(humanise).join(', ') || 'no field change'}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {revision.actorType}
                            {revision.fromStatus || revision.toStatus
                              ? ` · ${revision.fromStatus ?? 'new'} → ${revision.toStatus}`
                              : ''}{' '}
                            · {revision.createdAt}
                          </p>
                          {revision.note ? (
                            <p className="mt-0.5 text-[11px] italic text-slate-400">{revision.note}</p>
                          ) : null}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyAction === `restore:${revision.version}`}
                          onClick={() => void handleRestore(revision.version)}
                        >
                          {busyAction === `restore:${revision.version}` ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Restore
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProvenanceDot({ provenance }: { provenance: string }) {
  const meta =
    provenance === 'derived'
      ? { color: 'bg-emerald-400', title: 'Derived from the extracted chapter data' }
      : provenance === 'ai'
        ? { color: 'bg-indigo-400', title: 'Proposed by AI — needs a human to confirm' }
        : { color: 'bg-slate-200', title: 'Not set' };

  return <span className={`h-1.5 w-1.5 rounded-full ${meta.color}`} title={meta.title} />;
}

function AiRow({
  label,
  hint,
  busy,
  onPreview,
  onApply,
}: {
  label: string;
  hint: string;
  busy: boolean;
  onPreview: () => void;
  onApply: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-100 px-3 py-2.5">
      <p className="text-sm font-medium text-slate-800">{label}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={onPreview}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Preview
        </Button>
        <Button size="sm" disabled={busy} onClick={onApply}>
          Apply as draft
        </Button>
      </div>
    </div>
  );
}
