'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  CornerDownRight,
  Eye,
  FileText,
  Flag,
  GitBranch,
  Map as MapIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  MAX_CHOICES,
  MAX_NODES,
  MIN_CHOICES,
  addChoice,
  addNode,
  emptyScenario,
  incomingLinks,
  issuesByNode,
  link,
  makeStart,
  moveChoice,
  moveNode,
  publishProblems,
  removeChoice,
  removeNode,
  scenarioFromRaw,
  scenarioToPayload,
  updateChoice,
  updateNode,
  type BranchingNodeInput,
  type BranchingScenarioSavePayload,
  type LinkTarget,
} from '@/lib/h5p/branching-editor';
import {
  analyse,
  estimateMinutes,
  normalizeScenario,
  BS_PURPOSE_LABELS,
  BS_QUALITY_LABELS,
  BS_PURPOSES,
  BS_QUALITIES,
  nodeLabel,
  type BsNodeType,
  type BsQuality,
  type RawScenario,
} from '@/lib/h5p/branching-scenario';
import { readH5pContext, type H5pContext } from '../../data/h5p';
import { branchingScenarioApi, type H5pBranchingScenario } from '../../data/h5p-branching';
import { CheckField, Field, FieldGroup, NumberField, SelectField, TextAreaField, TextField } from '../../components/fields';
import { BranchingScenarioPlayer } from './player';
import { BodyField, PictureField } from './fields';
import { StoryMap } from './story-map';

/**
 * Branching Scenario — the editor.
 *
 * The state IS the save payload (see lib/h5p/branching-editor.ts): steps are
 * addressed by a client ref, never an id, so an author can follow a link to a
 * step that does not exist yet -- "this choice leads to... a new ending" -- and
 * the server resolves the lot in one save. Every edit is an operation in that
 * file; this component only calls them, which is why it holds no rules.
 *
 * WHAT THE AUTHOR SEES, in the order they need it: the scenario's settings; a
 * one-line summary of whether it is sound; the outline (or the map) on the left;
 * the selected step on the right. The checks run on every keystroke, are the same
 * ones the server applies at publish (a golden file keeps the two in step), and
 * say which step to open.
 */

const NODE_ICON: Record<BsNodeType, typeof FileText> = {
  text: FileText,
  branching_question: GitBranch,
  ending: Flag,
};

const NODE_NOUN: Record<BsNodeType, string> = {
  text: 'Screen',
  branching_question: 'Decision',
  ending: 'Ending',
};

export function emptyScenarioState(): BranchingScenarioSavePayload {
  return emptyScenario();
}

export function scenarioStateFromRow(row: H5pBranchingScenario): BranchingScenarioSavePayload {
  return scenarioFromRaw(row as unknown as RawScenario);
}

export const scenarioToSavePayload = scenarioToPayload;
export const validateScenarioState = publishProblems;

/**
 * The editor as the create and edit routes use it: it reads the chapter context
 * from the URL itself, because the page shells hand an editor only its state,
 * and it renders inside their Suspense boundary, which `useSearchParams` needs.
 */
export function ScenarioEditorForRoute(props: Omit<Parameters<typeof ScenarioEditor>[0], 'ctx'>) {
  const searchParams = useSearchParams();
  const ctx = useMemo(() => readH5pContext(new URLSearchParams(searchParams?.toString())), [searchParams]);

  return <ScenarioEditor {...props} ctx={ctx} />;
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

export function ScenarioEditor({
  state,
  onChange,
  disabled,
  ctx,
}: {
  state: BranchingScenarioSavePayload;
  onChange: (next: BranchingScenarioSavePayload) => void;
  disabled: boolean;
  ctx: H5pContext;
}) {
  const [selectedRef, setSelectedRef] = useState<string | null>(state.nodes[0]?.ref ?? null);
  const [view, setView] = useState<'outline' | 'map'>('outline');
  const [previewing, setPreviewing] = useState(false);
  const [notice, setNotice] = useState('');

  // After a save the server gives every step a new id, hence a new ref; a
  // selection that no longer exists falls back to the first step.
  const selected = state.nodes.find((n) => n.ref === selectedRef) ?? state.nodes[0] ?? null;
  const selectedIndex = selected ? state.nodes.indexOf(selected) : -1;

  const report = useMemo(() => analyse(normalizeScenario(state), true), [state]);
  const issues = useMemo(() => issuesByNode(state), [state]);
  const problemRefs = useMemo(() => new Set([...issues.entries()].filter(([, list]) => list.some((i) => i.level === 'error')).map(([ref]) => ref)), [issues]);
  const minutes = useMemo(() => estimateMinutes(normalizeScenario(state)), [state]);
  const previewScenario = useMemo(() => normalizeScenario(scenarioToPayload(state)), [state]);

  const upload = (file: File, role: string) => branchingScenarioApi.uploadMedia(file, role);

  const add = (type: BsNodeType) => {
    const made = addNode(state, type);
    onChange(made.scenario);
    setSelectedRef(made.ref);
    setNotice('');
  };

  const remove = (ref: string) => {
    const node = state.nodes.find((n) => n.ref === ref);
    const links = incomingLinks(state, ref);
    const message =
      links > 0
        ? `Delete this ${NODE_NOUN[node?.node_type ?? 'text'].toLowerCase()}? ${links} ${links === 1 ? 'link leads' : 'links lead'} to it, and ${links === 1 ? 'it' : 'they'} will be cleared.`
        : 'Delete this step?';
    if (!window.confirm(message)) return;

    const result = removeNode(state, ref);
    onChange(result.scenario);
    setSelectedRef(result.scenario.nodes[0]?.ref ?? null);
    setNotice(result.cleared > 0 ? `Step deleted. ${result.cleared} ${result.cleared === 1 ? 'link was' : 'links were'} cleared; choose where they should go.` : 'Step deleted.');
  };

  const patchSettings = (patch: Partial<BranchingScenarioSavePayload>) => onChange({ ...state, ...patch });

  return (
    <div className="space-y-4">
      <FieldGroup title="The scenario" description="What learners see before the first step." columns={2}>
        <TextField label="Title" value={state.title} required disabled={disabled} maxLength={255} onChange={(title) => patchSettings({ title })} placeholder="Is the lake water safe to drink?" />
        <TextField
          label="Start screen heading"
          value={state.start_title}
          disabled={disabled}
          maxLength={255}
          hint="Leave empty to use the title."
          onChange={(start_title) => patchSettings({ start_title })}
        />
        <div className="sm:col-span-2">
          <TextAreaField label="Summary" rows={2} value={state.description} disabled={disabled} onChange={(description) => patchSettings({ description })} hint="One or two sentences on the situation the learner steps into." />
        </div>
        <div className="sm:col-span-2">
          <BodyField label="Start screen text" rows={3} value={state.start_subtitle} disabled={disabled} onChange={(start_subtitle) => patchSettings({ start_subtitle })} key="start-subtitle" />
        </div>
        <div className="sm:col-span-2">
          <PictureField
            label="Start screen picture"
            url={state.start_image}
            alt={state.start_image_alt}
            disabled={disabled}
            upload={(file) => upload(file, 'start_image')}
            onChange={({ url, alt }) => patchSettings({ start_image: url, start_image_alt: alt })}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Field label="What learners will do" hint="Shown on the start screen. Start each with a verb: Explain, Decide, Compare.">
            <div className="space-y-2">
              {state.learning_objectives.map((objective, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    aria-label={`Objective ${i + 1}`}
                    value={objective}
                    maxLength={300}
                    disabled={disabled}
                    onChange={(e) => patchSettings({ learning_objectives: state.learning_objectives.map((o, j) => (j === i ? e.target.value : o)) })}
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => patchSettings({ learning_objectives: state.learning_objectives.filter((_, j) => j !== i) })}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove objective ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {state.learning_objectives.length < 8 ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => patchSettings({ learning_objectives: [...state.learning_objectives, ''] })}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="h-3.5 w-3.5" /> Add an objective
                </button>
              ) : null}
            </div>
          </Field>
        </div>

        <SelectField
          label="Scoring"
          value={state.scoring_option}
          disabled={disabled}
          options={[
            { value: 'static-end-score', label: 'By the ending reached' },
            { value: 'no-score', label: 'Not marked' },
          ]}
          hint="Each ending carries its own score. A scenario that is only for learning can be left unmarked."
          onChange={(scoring_option) => patchSettings({ scoring_option })}
        />
        <NumberField label="Pass mark" value={state.pass_percentage} min={0} max={100} suffix="% of the best ending" disabled={disabled || state.scoring_option === 'no-score'} onChange={(pass_percentage) => patchSettings({ pass_percentage })} />
        <CheckField label="Let learners go back a step" checked={state.enable_backwards_navigation} disabled={disabled} onChange={(enable_backwards_navigation) => patchSettings({ enable_backwards_navigation })} />
        <CheckField label="Shuffle the order of choices" hint="Each attempt shows a decision’s choices in a different order." checked={state.randomize_alternatives} disabled={disabled} onChange={(randomize_alternatives) => patchSettings({ randomize_alternatives })} />
      </FieldGroup>

      <ChecksBar
        report={report}
        minutes={minutes}
        labels={state.nodes.map((n, i) => nodeLabel(n, i))}
        refs={state.nodes.map((n) => n.ref)}
        onOpen={(ref) => setSelectedRef(ref)}
        onPreview={() => setPreviewing(true)}
      />

      {notice ? (
        <p className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs text-indigo-800" role="status">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Steps</h2>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-[11px]" role="group" aria-label="View">
                {(['outline', 'map'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${view === v ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {v === 'map' ? <MapIcon className="h-3 w-3" aria-hidden="true" /> : null}
                    {v === 'outline' ? 'Outline' : 'Map'}
                  </button>
                ))}
              </div>
            </div>

            {view === 'map' ? (
              <StoryMap scenario={state} selected={selected?.ref ?? null} problems={problemRefs} onSelect={setSelectedRef} />
            ) : (
              <ol className="space-y-1" aria-label="Steps in this scenario">
                {state.nodes.map((n, i) => {
                  const Icon = NODE_ICON[n.node_type];
                  const list = issues.get(n.ref) ?? [];
                  const errors = list.filter((x) => x.level === 'error').length;
                  const active = selected?.ref === n.ref;
                  return (
                    <li key={n.ref}>
                      <button
                        type="button"
                        onClick={() => setSelectedRef(n.ref)}
                        aria-current={active ? 'step' : undefined}
                        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                          active ? 'border-indigo-300 bg-indigo-50 text-indigo-900' : 'border-transparent hover:bg-slate-50'
                        }`}
                      >
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-semibold tabular-nums text-slate-500 ring-1 ring-slate-200">
                          {i + 1}
                        </span>
                        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{n.title.trim() || `Untitled ${NODE_NOUN[n.node_type].toLowerCase()}`}</span>
                          <span className="block truncate text-[10px] text-slate-500">
                            {i === 0 ? 'Start · ' : ''}
                            {NODE_NOUN[n.node_type]}
                            {n.purpose ? ` · ${BS_PURPOSE_LABELS[n.purpose] ?? n.purpose}` : ''}
                          </span>
                        </span>
                        {errors > 0 ? (
                          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700" title={list.map((x) => x.message).join('\n')}>
                            {errors} to fix
                          </span>
                        ) : list.length > 0 ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700" title={list.map((x) => x.message).join('\n')}>
                            note
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {(['text', 'branching_question', 'ending'] as const).map((type) => {
                const Icon = NODE_ICON[type];
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={disabled || state.nodes.length >= MAX_NODES}
                    onClick={() => add(type)}
                    className="inline-flex flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 px-1 py-2 text-[11px] font-medium text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800 disabled:opacity-50"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />+ {NODE_NOUN[type]}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {selected ? (
            <NodeForm
              key={selected.ref}
              state={state}
              node={selected}
              index={selectedIndex}
              disabled={disabled}
              onChange={onChange}
              onSelect={setSelectedRef}
              onRemove={() => remove(selected.ref)}
              upload={upload}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Add a step to begin.</p>
          )}
        </div>
      </div>

      <Dialog open={previewing} onOpenChange={setPreviewing}>
        <DialogContent className="max-h-[92vh] w-[min(52rem,96vw)] max-w-none overflow-y-auto bg-[color:var(--h5p-surface-sunken,#f8fafc)] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>Play it as a student would, with your unsaved changes. Nothing is recorded.</DialogDescription>
          </DialogHeader>
          {previewing ? <BranchingScenarioPlayer scenario={previewScenario} contentId={null} ctx={ctx} preview embedded /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

function ChecksBar({
  report,
  minutes,
  labels,
  refs,
  onOpen,
  onPreview,
}: {
  report: ReturnType<typeof analyse>;
  minutes: number;
  labels: string[];
  refs: string[];
  onOpen: (ref: string) => void;
  onPreview: () => void;
}) {
  const ready = report.errors.length === 0;
  const s = report.stats;

  return (
    <section
      className={`rounded-2xl border p-4 ${ready ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/70'}`}
      aria-label="Checks"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={`text-sm font-semibold ${ready ? 'text-emerald-800' : 'text-amber-900'}`}>
            {ready ? 'Ready to publish' : `${report.errors.length} ${report.errors.length === 1 ? 'thing' : 'things'} to fix before publishing`}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {s.nodes} steps · {s.decisions} {s.decisions === 1 ? 'decision' : 'decisions'} · {s.endings} {s.endings === 1 ? 'ending' : 'endings'} ·{' '}
            {s.paths_capped ? 'more than 5,000' : s.paths} {s.paths === 1 ? 'path' : 'paths'} · about {minutes} min
          </p>
        </div>
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700"
        >
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Preview
        </button>
      </div>

      {report.errors.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {report.errors.slice(0, 8).map((issue, i) => {
            const at = issue.node ? refs.indexOf(issue.node) : -1;
            return (
              <li key={`${issue.code}-${i}`} className="flex items-start gap-1.5 text-xs text-amber-900">
                <span aria-hidden="true">•</span>
                <span>
                  {issue.message}{' '}
                  {issue.node && at >= 0 ? (
                    <button type="button" onClick={() => onOpen(issue.node as string)} className="font-semibold text-indigo-700 underline">
                      Open {labels[at].split(' (')[0].toLowerCase()}
                    </button>
                  ) : null}
                </span>
              </li>
            );
          })}
          {report.errors.length > 8 ? <li className="text-xs text-amber-800">…and {report.errors.length - 8} more.</li> : null}
        </ul>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// One step
// ---------------------------------------------------------------------------

function NodeForm({
  state,
  node,
  index,
  disabled,
  onChange,
  onSelect,
  onRemove,
  upload,
}: {
  state: BranchingScenarioSavePayload;
  node: BranchingNodeInput;
  index: number;
  disabled: boolean;
  onChange: (next: BranchingScenarioSavePayload) => void;
  onSelect: (ref: string) => void;
  onRemove: () => void;
  upload: (file: File, role: string) => Promise<string>;
}) {
  const [created, setCreated] = useState<string | null>(null);
  const patch = (p: Partial<BranchingNodeInput>) => onChange(updateNode(state, node.ref, p));
  const isEnding = node.node_type === 'ending';
  const Icon = NODE_ICON[node.node_type];

  const point = (from: { ref: string; choice?: number }, target: LinkTarget) => {
    const result = link(state, from, target);
    onChange(result.scenario);
    setCreated(result.created);
  };

  const bodyLabel = node.node_type === 'branching_question' ? 'The question' : isEnding ? 'Closing words' : 'Text';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label={`${NODE_NOUN[node.node_type]} ${index + 1}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {NODE_NOUN[node.node_type]} {index + 1}
              {index === 0 ? <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Start</span> : null}
            </h2>
            <p className="text-[11px] text-slate-500">
              {node.node_type === 'text' ? 'A screen of content, then on to the next step.' : node.node_type === 'branching_question' ? 'The learner chooses; each choice can lead somewhere different.' : 'Where a path stops.'}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1">
          {index > 1 ? (
            <IconButton label="Move up" onClick={() => onChange(moveNode(state, node.ref, -1))} disabled={disabled}>
              <ArrowUp className="h-4 w-4" />
            </IconButton>
          ) : null}
          {index > 0 && index < state.nodes.length - 1 ? (
            <IconButton label="Move down" onClick={() => onChange(moveNode(state, node.ref, 1))} disabled={disabled}>
              <ArrowDown className="h-4 w-4" />
            </IconButton>
          ) : null}
          {index > 0 && !isEnding ? (
            <button type="button" disabled={disabled} onClick={() => onChange(makeStart(state, node.ref))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50">
              Make this the start
            </button>
          ) : null}
          <IconButton label="Delete this step" onClick={onRemove} disabled={disabled || state.nodes.length <= 1} danger>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label="Title" value={node.title} disabled={disabled} maxLength={255} onChange={(title) => patch({ title })} placeholder={isEnding ? 'Sound reasoning' : 'Reading the thermometer'} />
        <SelectField
          label="What this step is for"
          value={node.purpose ?? ''}
          disabled={disabled}
          hint="Only a label: it helps you see how the lesson is built."
          options={[{ value: '', label: 'Not set' }, ...BS_PURPOSES.map((p) => ({ value: p as string, label: BS_PURPOSE_LABELS[p] ?? p }))]}
          onChange={(purpose) => patch({ purpose: purpose === '' ? null : purpose })}
        />

        <div className="sm:col-span-2">
          <BodyField label={bodyLabel} value={node.body} disabled={disabled} rows={node.node_type === 'branching_question' ? 3 : 7} onChange={(body) => patch({ body })} />
        </div>

        <div className="sm:col-span-2">
          <PictureField label="Picture" url={node.media_path} alt={node.media_alt} disabled={disabled} upload={(file) => upload(file, 'image')} onChange={({ url, alt }) => patch({ media_path: url, media_alt: alt })} />
        </div>

        {node.node_type === 'text' ? (
          <>
            <TextField label="Button text" value={node.proceed_button_text} disabled={disabled} maxLength={50} onChange={(proceed_button_text) => patch({ proceed_button_text })} placeholder="Continue" />
            <CheckField label="Show the title above the text" checked={node.show_title} disabled={disabled} onChange={(show_title) => patch({ show_title })} />
            <div className="sm:col-span-2">
              <LinkSelect label="Then go to" value={node.next_ref} nodes={state.nodes} self={node.ref} disabled={disabled} onPick={(target) => point({ ref: node.ref }, target)} />
              <CreatedNote ref_={created} nodes={state.nodes} onOpen={(ref) => { setCreated(null); onSelect(ref); }} />
            </div>
          </>
        ) : null}

        {isEnding ? (
          <>
            <NumberField label="Score for reaching this ending" value={node.score} min={0} max={1000} disabled={disabled || state.scoring_option === 'no-score'} hint={state.scoring_option === 'no-score' ? 'The scenario is not marked.' : 'The best ending is a full-marks attempt.'} onChange={(score) => patch({ score })} />
          </>
        ) : null}
      </div>

      {node.node_type === 'branching_question' ? (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Choices</h3>
            <span className="text-[11px] text-slate-500">{node.options.length} of {MAX_CHOICES} at most</span>
          </div>

          {node.options.map((option, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200" aria-hidden="true">
                  {String.fromCharCode(65 + i)}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <TextField label={`Choice ${String.fromCharCode(65 + i)}`} value={option.text} disabled={disabled} maxLength={500} onChange={(text) => onChange(updateChoice(state, node.ref, i, { text }))} placeholder="Measure the temperature first" />

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectField<BsQuality | ''>
                      label="How sound is it?"
                      value={option.quality ?? ''}
                      disabled={disabled}
                      hint="Shown to the learner after they choose, in a calm tone. Never a red cross."
                      options={[{ value: '', label: 'Not rated' }, ...BS_QUALITIES.map((q) => ({ value: q as BsQuality | '', label: BS_QUALITY_LABELS[q] }))]}
                      onChange={(quality) => onChange(updateChoice(state, node.ref, i, { quality: quality === '' ? null : quality }))}
                    />
                    <LinkSelect label="This choice leads to" value={option.next_ref} nodes={state.nodes} self={node.ref} allowSelf disabled={disabled} onPick={(target) => point({ ref: node.ref, choice: i }, target)} />
                  </div>

                  <TextField label="What happens (heading)" value={option.feedback_title} disabled={disabled} maxLength={255} onChange={(feedback_title) => onChange(updateChoice(state, node.ref, i, { feedback_title }))} placeholder="Good thinking" />
                  <BodyField key={`fb-${node.ref}-${i}`} label="What happens, and why" rows={4} value={option.feedback_text} disabled={disabled} hint="Say what the choice led to and the reason. A weaker choice should leave the learner knowing what to rethink." onChange={(feedback_text) => onChange(updateChoice(state, node.ref, i, { feedback_text }))} />
                  <PictureField label="Picture with the feedback (optional)" url={option.feedback_image} alt={option.feedback_image_alt} disabled={disabled} upload={(file) => upload(file, 'feedback_image')} onChange={({ url, alt }) => onChange(updateChoice(state, node.ref, i, { feedback_image: url, feedback_image_alt: alt }))} />
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <IconButton label="Move choice up" onClick={() => onChange(moveChoice(state, node.ref, i, -1))} disabled={disabled || i === 0}>
                    <ArrowUp className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Move choice down" onClick={() => onChange(moveChoice(state, node.ref, i, 1))} disabled={disabled || i === node.options.length - 1}>
                    <ArrowDown className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Remove choice" onClick={() => onChange(removeChoice(state, node.ref, i))} disabled={disabled || node.options.length <= MIN_CHOICES} danger>
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </div>
          ))}

          <CreatedNote ref_={created} nodes={state.nodes} onOpen={(ref) => { setCreated(null); onSelect(ref); }} />

          {node.options.length < MAX_CHOICES ? (
            <button type="button" disabled={disabled} onClick={() => onChange(addChoice(state, node.ref))} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              <Plus className="h-3.5 w-3.5" /> Add a choice
            </button>
          ) : null}
        </div>
      ) : null}

      {node.concept_id || node.source_question_id ? (
        <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          {node.concept_id ? <>Written from concept #{node.concept_id}. </> : null}
          {node.source_question_id ? <>Question #{node.source_question_id} was copied from the question bank. Editing it here does not change the bank.</> : null}
        </p>
      ) : null}
    </section>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition disabled:opacity-40 ${danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-50 hover:text-indigo-600'}`}
    >
      {children}
    </button>
  );
}

/**
 * Where a link goes: any other step, or a NEW one made on the spot.
 *
 * Building a scenario is mostly "and then what?", so answering it by creating
 * the step is one action, not three (add a step, find it, come back and link it).
 */
function LinkSelect({
  label,
  value,
  nodes,
  self,
  allowSelf = false,
  disabled,
  onPick,
}: {
  label: string;
  value: string | null;
  nodes: BranchingNodeInput[];
  self: string;
  allowSelf?: boolean;
  disabled?: boolean;
  onPick: (target: LinkTarget) => void;
}) {
  // One id per control: several choices of one decision share a label, and a shared id would point every label at the first select.
  const selectId = useId();
  const unknown = value != null && !nodes.some((n) => n.ref === value);

  return (
    <Field label={label} htmlFor={selectId}>
      <div className="flex items-center gap-2">
        <CornerDownRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <select
          id={selectId}
          value={unknown ? '' : (value ?? '')}
          disabled={disabled}
          onChange={(e) => onPick(e.target.value === '' ? null : (e.target.value as LinkTarget))}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
        >
          <option value="">Choose a step…</option>
          <optgroup label="Existing steps">
            {nodes.map((n, i) =>
              n.ref === self && !allowSelf ? null : (
                <option key={n.ref} value={n.ref}>
                  {i + 1}. {n.title.trim() || `Untitled ${NODE_NOUN[n.node_type].toLowerCase()}`} ({NODE_NOUN[n.node_type].toLowerCase()})
                </option>
              )
            )}
          </optgroup>
          <optgroup label="Make a new step">
            <option value="new:text">+ A new screen</option>
            <option value="new:branching_question">+ A new decision</option>
            <option value="new:ending">+ A new ending</option>
          </optgroup>
        </select>
      </div>
    </Field>
  );
}

function CreatedNote({ ref_, nodes, onOpen }: { ref_: string | null; nodes: BranchingNodeInput[]; onOpen: (ref: string) => void }) {
  if (!ref_) return null;
  const at = nodes.findIndex((n) => n.ref === ref_);
  if (at < 0) return null;

  return (
    <p className="mt-2 text-xs text-indigo-800" role="status">
      Step {at + 1} was created.{' '}
      <button type="button" className="font-semibold underline" onClick={() => onOpen(ref_)}>
        Open it to write it
      </button>
    </p>
  );
}
