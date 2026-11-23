import type {
  BenchItem,
  BuilderDesign,
  BuilderPhase,
  DesignFacts,
  ExperimentModel,
  ItemDef,
  ItemGroup,
  Settings,
  Trial,
} from './types';

/**
 * The shared part of the experiment builder: what a design means, with no model-specific knowledge.
 * Everything here is pure, so it can be tested and so a hint is always a statement about the student's
 * own work. The same facts are recomputed on the server before anything is marked.
 */

export const MAX_TRIALS = 6;

export const GROUP_WORDS: Record<ItemGroup, string> = {
  material: 'the thing you are investigating',
  container: 'something to hold it',
  location: 'the conditions it is in',
  tool: 'a tool',
  instrument: 'an instrument',
  other: 'something else',
};

export const itemOf = (model: ExperimentModel, id: string): ItemDef | undefined => model.items.find((i) => i.id === id);

/** Every setting key and its label, for the items on the bench. */
export function settingsOnBench(model: ExperimentModel, bench: BenchItem[]): { key: string; label: string; item: string }[] {
  const out: { key: string; label: string; item: string }[] = [];
  for (const b of bench) {
    const item = itemOf(model, b.item);
    for (const p of item?.props ?? []) out.push({ key: p.key, label: p.label, item: item!.name });
  }
  return out;
}

/** The value of every setting the model knows, for a trial: what the student chose, else the default, else "not on the bench". */
export function effectiveSettings(model: ExperimentModel, bench: BenchItem[], chosen: Settings): Settings {
  const onBench = new Set(bench.map((b) => b.item));
  const out: Settings = {};
  for (const item of model.items) {
    for (const p of item.props) {
      out[p.key] = onBench.has(item.id) ? chosen[p.key] ?? p.default : p.absent ?? p.default;
    }
  }
  return out;
}

/** The value a student sees on a trial for one setting, in words. */
export function settingLabel(model: ExperimentModel, key: string, value: string): string {
  for (const item of model.items) {
    const p = item.props.find((x) => x.key === key);
    if (p) return p.options.find((o) => o.value === value)?.label ?? value;
  }
  return value;
}

export function propLabel(model: ExperimentModel, key: string): string {
  for (const item of model.items) {
    const p = item.props.find((x) => x.key === key);
    if (p) return p.label;
  }
  return key;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Real measurements vary a little, so repeating a trial is worth doing: ±4 %, the same for the same trial and run. */
export function variation(trialId: string, run: number): number {
  return ((hash(`${trialId}:${run}`) % 2001) / 1000 - 1) * 0.04;
}

/** What the stopwatch shows for a trial, in seconds to one decimal place. */
export function measuredSeconds(model: ExperimentModel, settings: Settings, trialId: string, run: number): number {
  return Math.round(model.seconds(settings) * (1 + variation(trialId, run)) * 10) / 10;
}

export const missingEssentials = (model: ExperimentModel, bench: BenchItem[]): ItemGroup[] =>
  model.essentialGroups.filter((g) => !bench.some((b) => itemOf(model, b.item)?.group === g));

export const hasInstrument = (bench: BenchItem[], id: string) => bench.some((b) => b.item === id);

export function newTrial(n: number, from?: Trial): Trial {
  return { id: `t${n}`, label: `Trial ${n}`, props: from ? { ...from.props } : {}, seconds: null, ran: false, recorded: null };
}

// ---------------------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------------------

export function designFacts(model: ExperimentModel, d: BuilderDesign): DesignFacts {
  const placed = d.bench.map((b) => b.item);
  const ranTrials = d.trials.filter((t) => t.ran);
  const eff = ranTrials.map((t) => effectiveSettings(model, d.bench, t.props));
  const keys = [...new Set(eff.flatMap((e) => Object.keys(e)))];
  const changed = ranTrials.length < 2 ? [] : keys.filter((k) => new Set(eff.map((e) => e[k])).size > 1);

  const signatures = eff.map((e) => JSON.stringify(e));
  const repeats = signatures.filter((s, i) => signatures.indexOf(s) !== i).length;

  const dv = model.measures.find((m) => m.id === d.dv);
  return {
    placed,
    missingGroups: missingEssentials(model, d.bench),
    otherItems: placed.filter((id) => model.irrelevant.includes(id)).length,
    ran: ranTrials.length,
    measured: ranTrials.filter((t) => t.seconds !== null).length,
    changed,
    unfair: changed.filter((k) => k !== d.iv),
    brokenControls: d.controls.filter((c) => changed.includes(c)),
    fair: ranTrials.length >= 2 && changed.length === 1,
    repeats,
    ivClaimed: d.iv !== '',
    dvClaimed: !!dv,
    dvInstrumentPlaced: !!dv && hasInstrument(d.bench, dv.instrument),
    recorded: ranTrials.filter((t) => t.seconds !== null && t.recorded !== null).length,
    recordedRight: ranTrials.filter((t) => t.seconds !== null && t.recorded !== null && Math.abs(t.recorded - t.seconds) <= 0.05 * Math.max(Math.abs(t.seconds), 1e-9)).length,
  };
}

// ---------------------------------------------------------------------------------------
// Hints: statements about the student's own work. They say what to look at, never what to do or what the answer is.
// ---------------------------------------------------------------------------------------

export interface Hint {
  topic: string;
  level: number;
  text: string;
}

const MAX_LEVEL = 3;

/** The next hint for where the student is, or null when there is nothing to say. `used` is the hints already given. */
export function nextHint(model: ExperimentModel, d: BuilderDesign, phase: BuilderPhase, used: { topic: string; level: number }[]): Hint | null {
  const f = designFacts(model, d);
  const level = (topic: string) => Math.min(MAX_LEVEL, used.filter((u) => u.topic === topic).length + 1);
  const say = (topic: string, texts: [string, string, string]): Hint => {
    const lv = level(topic);
    return { topic, level: lv, text: texts[lv - 1] };
  };

  const measure = model.measures[0];

  if (phase === 'question') {
    if (d.question.trim().length < 10) {
      return say('question', [
        'A good scientific question can be tested. Can yours?',
        'A testable question names something you will change and something you will measure.',
        'Try starting with “How does … affect …?” and fill in the two parts yourself.',
      ]);
    }
    if (d.prediction.trim() === '') {
      return say('prediction', [
        'Scientists say what they expect before they test. What do you expect?',
        'Write what you think will happen to what you measure.',
        'Then say why, using an idea from the chapter.',
      ]);
    }
    return null;
  }

  if (phase === 'design') {
    if (f.missingGroups.length > 0) {
      const g = f.missingGroups[0];
      return say('bench', [
        'Look at your bench. Is there everything an experiment needs before it can start?',
        `Your bench is missing ${GROUP_WORDS[g]}.`,
        `Look through the shelf for ${GROUP_WORDS[g]}, and drag it onto the bench.`,
      ]);
    }
    if (measure && !hasInstrument(d.bench, measure.instrument)) {
      return say('instrument', [
        `How will you find out “${measure.label.toLowerCase()}”?`,
        'Measurements need an instrument. Is there one on your bench for what you want to measure?',
        'Check the instruments on the shelf.',
      ]);
    }
    if (f.otherItems >= 1) {
      return say('equipment', [
        'Is every item on your bench needed for your question?',
        'At least one item on your bench has nothing to do with your question.',
        'Take another look at what each item is for.',
      ]);
    }
    return null;
  }

  if (phase === 'variables') {
    if (!f.ivClaimed || !f.dvClaimed) {
      return say('variables', [
        'Which one thing will you change, and what will you measure?',
        'Put one setting in “I will change” and what you measure in “I will measure”.',
        'You can only change settings of equipment that is on your bench.',
      ]);
    }
    if (d.controls.length === 0 && f.placed.length > 0) {
      return say('controls', [
        'Which conditions must stay the same so that only your one change matters?',
        'Put the settings you will keep the same in the third box.',
        'Think about every other setting on your bench: could any of them change the result?',
      ]);
    }
    return null;
  }

  if (phase === 'run') {
    const eff = settingsOnBench(model, d.bench);
    if (f.ran < 2) {
      return say('compare', [
        'One result on its own tells you very little. What could you compare it with?',
        'A comparison needs at least two trials that differ in the thing you are testing.',
        'Plan a second trial next to the first, then look at what is different between them.',
      ]);
    }
    if (f.changed.length === 0) {
      return say('nochange', [
        'Look at your trials. Is anything different between them?',
        'Your trials have the same settings, so nothing is being compared.',
        'Change the one setting you said you are testing in one of the trials.',
      ]);
    }
    if (f.changed.length >= 2) {
      const names = f.changed.map((k) => eff.find((s) => s.key === k)?.label ?? k);
      return say('fair', [
        'Look at your trials side by side. Is only one thing different?',
        `${f.changed.length} settings differ between your trials: ${names.join(', ')}.`,
        'If more than one thing differs, can you tell which one caused the difference? Which would you keep the same?',
      ]);
    }
    if (f.ivClaimed && f.changed[0] !== d.iv) {
      return say('claimed', [
        'The thing you said you would change is not the thing that differs between your trials.',
        'Compare the setting you named with the setting that actually differs.',
        'Either change your plan or change your trials so they agree.',
      ]);
    }
    if (f.measured < f.ran) {
      return say('measure', [
        'Some trials have no measurement.',
        'A trial only gives a number if you measured it. Is the instrument you need on the bench?',
        'Add the instrument to the bench and run the trial again.',
      ]);
    }
    if (f.repeats === 0) {
      return say('repeat', [
        'Would you trust a result you only saw once?',
        'Scientists repeat a test to check that a result is not a one-off.',
        'Try running the same settings again and see whether the numbers match.',
      ]);
    }
    return null;
  }

  if (phase === 'interpret') {
    const i = d.interpretation;
    if (i.seen.trim() === '') {
      return say('seen', [
        'Start with what you saw, not why.',
        'Describe what happened in your trials: look at the numbers and at the picture.',
        'Compare your trials one against the other.',
      ]);
    }
    if (i.evidence.trim() === '') {
      return say('evidence', [
        'A conclusion needs evidence. What did you measure?',
        'Quote your own numbers from the table.',
        'Which trials are you comparing, and what were their results?',
      ]);
    }
    if (i.reasoning.trim() === '') {
      return say('reasoning', [
        'Why do you think this happened?',
        'Use an idea from the chapter to explain your result.',
        'What does the chapter say about how a scientist should explain a result?',
      ]);
    }
    return null;
  }
  return null;
}

/**
 * The equipment a lab provides: every piece that belongs to the investigation (whatever has nothing to do with the
 * problem is left out). The student does not choose it; they investigate with it.
 */
export function autoBench(model: ExperimentModel): BenchItem[] {
  return model.items
    .filter((i) => !model.irrelevant.includes(i.id))
    .map((i, n) => ({ item: i.id, x: Math.round((0.12 + (n % 6) * 0.15) * 1000) / 1000, y: Math.round((0.3 + Math.floor(n / 6) * 0.4) * 1000) / 1000 }));
}

/** A design from before the lab provided its equipment gets the provided bench, so it can go on from where it was. */
export function withProvidedBench(model: ExperimentModel, d: BuilderDesign): BuilderDesign {
  if (d.autoBench) return d.phase === 'design' ? { ...d, phase: 'variables' } : d;
  return { ...d, autoBench: true, bench: autoBench(model), phase: d.phase === 'design' ? 'variables' : d.phase };
}

export function emptyDesign(modelId: string, focus: string[] = [], specVersion = 0, bench?: BenchItem[]): BuilderDesign {
  return {
    modelId, specVersion, recording: true, autoBench: bench !== undefined, focus, question: '', iv: '', dv: '', controls: [], prediction: '', reason: '', bench: bench ?? [], trials: [newTrial(1)],
    interpretation: { seen: '', claim: '', evidence: '', reasoning: '', limits: '' }, hints: [], log: [], actions: 0, phase: 'challenge',
  };
}
