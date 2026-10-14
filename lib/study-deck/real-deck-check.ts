/**
 * Local one-off: play every activity of a real exported deck against real question-bank rows.
 *
 *   node --import tsx lib/study-deck/real-deck-check.ts <deck.json> <bank.json>
 *
 * Not part of `npm test` (it needs files from a live run). It prints, per activity, the target the
 * deck asked for, the target the runtime really used, and why anything could not be played.
 */
import { readFileSync } from 'node:fs';

import { mapQuestionToPlayerPayload } from '../h5p/question-bank-runtime';
import type { BankQuestion } from '../h5p/question-bank-h5p-map';
import { neededQuestionIds, parseDeck, resolveActivity, scopeOf } from './deck';

const [deckPath, bankPath] = process.argv.slice(2);
const deck = parseDeck(JSON.parse(readFileSync(deckPath, 'utf8')));
const rows = (JSON.parse(readFileSync(bankPath, 'utf8')).data ?? []) as BankQuestion[];
const bank = new Map(rows.map((row) => [Number(row.id), row]));

const missing = neededQuestionIds(deck).filter((id) => !bank.has(id));
console.log(`deck: ${deck.slides.length} slides; bank rows: ${rows.length}; question ids the deck needs: ${neededQuestionIds(deck).length}; missing from bank: ${missing.length}`);

const tally: Record<string, number> = {};
const problems: string[] = [];
let explained = 0;
let playable = 0;
let total = 0;

for (const slide of deck.slides) {
  slide.activities.forEach((activity, index) => {
    total += 1;
    const resolved = resolveActivity(activity, bank);
    if (!resolved.ok) {
      problems.push(`slide ${slide.n}#${index} q${activity.question_id}: ${resolved.reason}`);
      return;
    }
    playable += 1;

    const built = mapQuestionToPlayerPayload(resolved.question, scopeOf(resolved.question as BankQuestion & { chapter_id?: number }), undefined, [], resolved.as);
    const key = `${activity.as} -> ${resolved.as}${resolved.fellBack ? ' (fell back)' : ''}`;
    tally[key] = (tally[key] ?? 0) + 1;

    if (built.activity?.kind === 'single_choice_set') {
      const q = built.activity.item.questions[0];
      const correct = q.options.filter((o) => o.is_correct).length;
      if (correct !== 1) problems.push(`slide ${slide.n}#${index} q${activity.question_id}: ${correct} correct options`);
      if (q.explanation || q.feedback_correct) explained += 1;
      else problems.push(`slide ${slide.n}#${index} q${activity.question_id}: no explanation reaches the learner`);
    }
  });
}

console.log(`activities: ${total}; playable: ${playable}`);
console.log('asked -> played:', JSON.stringify(tally, null, 1));
console.log(`single-choice activities with a stored explanation reaching the learner: ${explained}`);
console.log(problems.length ? `PROBLEMS (${problems.length}):\n  ${problems.join('\n  ')}` : 'no problems');
