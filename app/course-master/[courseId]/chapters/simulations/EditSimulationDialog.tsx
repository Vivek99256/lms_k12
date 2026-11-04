'use client';

import { AlertTriangle, Loader2, Save } from 'lucide-react';
import { useId, useState } from 'react';

import type { SimulationCard, SimulationStatus } from '@/app/course-master/data/simulations';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SimulationActions } from '@/hooks/use-simulations';
import { coverSrc } from '@/lib/simulation-format';

const SELECT = 'h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

function splitTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Edit a simulation's card: category, tags, cover, difficulty and whether it is a draft, published or archived. (A changed specification is a
 * new version: choose the package again in "Add simulation".) Authors only; the parent mounts it when the SERVER said the session may author,
 * and the server refuses the save with 403 to anyone else.
 */
export function EditSimulationDialog({
  card,
  categories,
  update,
  onClose,
  onSaved,
}: {
  card: SimulationCard;
  categories: string[];
  update: SimulationActions['update'];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const id = useId();
  const listId = useId();
  const [category, setCategory] = useState(card.category ?? '');
  const [tags, setTags] = useState(card.tags.join(', '));
  const [cover, setCover] = useState(card.cover_url ?? '');
  const [difficulty, setDifficulty] = useState(card.difficulty ?? '');
  const [status, setStatus] = useState<SimulationStatus>(card.status);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{ message: string; problems: string[] } | null>(null);

  const coverProblem = cover.trim() !== '' && coverSrc(cover) === null ? 'Use a path such as simulations/covers/pendulum-lab.webp, or an https address.' : null;

  const submit = async () => {
    if (saving || coverProblem) return;
    setSaving(true);
    setFailure(null);
    const result = await update(card.id, {
      status,
      category: category.trim() === '' ? null : category.trim(),
      tags: splitTags(tags),
      cover_url: cover.trim() === '' ? null : cover.trim(),
      difficulty: difficulty === '' ? null : difficulty,
    });
    setSaving(false);
    if (result.ok) onSaved(`Saved “${result.card.title}”.`);
    else setFailure({ message: result.message, problems: result.problems });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit “{card.title}”</DialogTitle>
          <DialogDescription>These details are shown on the card. Which concepts it supports is set with “Link to concepts”.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-status`}>Status</Label>
            <select id={`${id}-status`} className={SELECT} value={status} onChange={(event) => setStatus(event.target.value as SimulationStatus)}>
              <option value="draft">Draft (staff only)</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-category`}>Category</Label>
              <Input id={`${id}-category`} list={listId} value={category} maxLength={60} onChange={(event) => setCategory(event.target.value)} />
              <datalist id={listId}>
                {categories.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-difficulty`}>Difficulty</Label>
              <select id={`${id}-difficulty`} className={SELECT} value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                <option value="">Not stated</option>
                <option value="intro">Introductory</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-tags`}>Tags</Label>
            <Input id={`${id}-tags`} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="pendulum, time period, gravity" />
            <p className="text-xs text-slate-500">Comma separated.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-cover`}>Cover image</Label>
            <Input id={`${id}-cover`} value={cover} onChange={(event) => setCover(event.target.value)} placeholder="simulations/covers/pendulum-lab.webp" aria-invalid={coverProblem ? true : undefined} />
            {coverProblem ? <p className="text-xs text-rose-700">{coverProblem}</p> : null}
          </div>
          {failure ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700" role="alert">
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {failure.message}
              </p>
              {failure.problems.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-6 text-xs">
                  {failure.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving || coverProblem !== null} className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700">
            {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
