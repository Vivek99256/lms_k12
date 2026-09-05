'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Activity, CircleCheck, Compass, LoaderCircle, RefreshCw,
  Sparkles, Target, TriangleAlert, UserRoundCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CareerIntelligence } from './_components/CareerIntelligence';
import {
  loadAlignment, loadCareerRecommendation, loadCurrentAspiration,
  loadOccupations, rankBestFitCareers, saveAspiration,
} from './_lib/api';
import type {
  AlignmentBand, AlignmentPayload, AlignmentStatus, AspirationSnapshot, CareerRecord, CareerSection,
  CertaintyLevel, KnowledgeDevelopmentArea,
} from './_lib/types';

const SECTIONS: Array<{
  id: CareerSection; label: string; description: string; icon: typeof Compass;
}> = [
  { id: 'plan', label: 'Career plan', description: 'Build clarity and direction', icon: Target },
  { id: 'match', label: 'Matching profile', description: 'Review matching occupations', icon: Sparkles },
  { id: 'intelligence', label: 'Career intelligence', description: 'Review evidence collected toward your career goal', icon: Activity },
];

const PLAN = [
  ['Career certainty', 'Name and investigate an occupation you may want at age 30. Career certainty creates a clear starting point for exploration.'],
  ['Career ambition', 'Connect your interests and strengths to an occupational goal, then define specific education and skill milestones.'],
  ['Career alignment', 'Check that your educational plans match the qualifications and preparation required by your preferred occupation.'],
  ['Career originality', 'Challenge assumptions and compare a broad range of pathways before committing to a familiar or expected choice.'],
] as const;

function text(record: CareerRecord, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return fallback;
}

function RequestMessage({ loading, error, empty, retry }: {
  loading: boolean; error: string; empty?: string; retry: () => void;
}) {
  if (loading) {
    return <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading information…</div>;
  }
  if (error) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
        <p className="max-w-lg text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={retry}><RefreshCw />Try again</Button>
      </div>
    );
  }
  if (empty) return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">{empty}</div>;
  return null;
}

const BAND_TONE: Record<AlignmentBand, string> = {
  'Strong Match': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'Partial Match': 'border-amber-200 bg-amber-50 text-amber-700',
  'Weak Match': 'border-red-200 bg-red-50 text-red-700',
};

/**
 * "Matching Occupations" — the single place on the Match Profile tab
 * where occupation recommendations live. Top-N occupations ranked by
 * knowledge-match percentage against the student's profile, sourced
 * from the same `careerRecommendation` endpoint that powers Career
 * Intelligence's recommendation panel, so the two views always agree.
 * The ranking itself comes from `rankBestFitCareers` in `_lib/api.ts`.
 */
function MatchingOccupationsCard({ studentId }: { studentId?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aspiration, setAspiration] = useState<AspirationSnapshot | null>(null);
  const [items, setItems] = useState<ReturnType<typeof rankBestFitCareers>>([]);
  const [knowledgeAreas, setKnowledgeAreas] = useState<KnowledgeDevelopmentArea[]>([]);
  const [knowledgeIntro, setKnowledgeIntro] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [payload, current] = await Promise.all([
        loadCareerRecommendation(studentId),
        loadCurrentAspiration().catch(() => null),
      ]);
      setItems(rankBestFitCareers(payload));
      setKnowledgeAreas(payload.knowledgeDevelopmentAreas ?? []);
      setKnowledgeIntro(payload.narrative.knowledgeDevelopmentIntro ?? '');
      setAspiration(current);
    } catch (err) {
      setItems([]);
      setKnowledgeAreas([]);
      setKnowledgeIntro('');
      setError(err instanceof Error ? err.message : 'Unable to load matching occupations.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    // The request owns loading/error/data state for this card, same
    // pattern as the top-level CareerIntelligence refresh().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const top = items.slice(0, 5);
  const aspirationCode = aspiration?.occupation_id || null;
  const showKnowledgeAreas = !loading && !error && top.length > 0 && knowledgeAreas.length > 0;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-4" />Matching Occupations</CardTitle>
            <CardDescription>
              Occupations that align most strongly with your demonstrated knowledge, assessment evidence, interests, and profile.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()}><RefreshCw />Refresh</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {aspiration?.occupation_name && (
          <p className="text-sm text-muted-foreground">
            Your current aspiration: <span className="font-medium text-foreground">{aspiration.occupation_name}</span>
          </p>
        )}
        <RequestMessage
          loading={loading}
          error={error}
          empty={!loading && !error && top.length === 0
            ? 'Complete your aspiration and assessment to see matching occupations.'
            : undefined}
          retry={() => void refresh()}
        />
        {!loading && !error && top.length > 0 && (
          <ol className="space-y-3">
            {top.map((item, index) => {
              const isCurrent = item.isCurrentAspiration || (aspirationCode != null && aspirationCode === item.occupation_code);
              return (
                <li
                  key={item.occupation_code}
                  className={`rounded-xl border p-4 ${isCurrent ? 'border-indigo-300 bg-indigo-50/40' : 'bg-card'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{index + 1}</span>
                        <h4 className="truncate font-medium">{item.occupation_name}</h4>
                        {isCurrent && <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-[#4F46E5]">Your current aspiration</Badge>}
                        <Badge variant="outline" className={BAND_TONE[item.alignmentBand]}>{item.alignmentBand}</Badge>
                      </div>
                      {item.topMatchedKnowledgeDomains.length > 0 && (
                        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>Knowledge match:</span>
                          {item.topMatchedKnowledgeDomains.map((domain) => (
                            <Badge key={domain} variant="outline">{domain}</Badge>
                          ))}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fit score</p>
                      <p className="text-2xl font-semibold">{item.matchPercentage.toFixed(1)}%</p>
                      {!isCurrent && item.scoreImprovement > 0 && (
                        <p className="text-xs text-emerald-600">+{item.scoreImprovement.toFixed(1)}% vs. current</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {showKnowledgeAreas && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
            <h3 className="text-sm font-semibold text-amber-700">Knowledge Development Areas</h3>
            {knowledgeIntro && <p className="mt-0.5 text-xs text-muted-foreground">{knowledgeIntro}</p>}
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {knowledgeAreas.map((area) => (
                <li key={area.knowledge}>
                  <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{area.knowledge}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Fit scores reflect knowledge-domain alignment with the student&apos;s profile and recorded evidence. Compare with your current aspiration above before deciding.
        </p>
      </CardContent>
    </Card>
  );
}

const CERTAINTY_OPTIONS: Array<{ value: CertaintyLevel; label: string }> = [
  { value: 'not_sure', label: 'Not sure' },
  { value: 'somewhat_sure', label: 'Somewhat sure' },
  { value: 'very_sure', label: 'Very sure' },
];

function certaintyLabel(score: number | null) {
  if (score == null) return '';
  const closest = CERTAINTY_OPTIONS.reduce((best, option, index) => {
    const scoreFor = [0.3, 0.6, 0.9][index];
    return Math.abs(scoreFor - score) < Math.abs([0.3, 0.6, 0.9][best] - score) ? index : best;
  }, 0);
  return CERTAINTY_OPTIONS[closest].label;
}

function OccupationField({
  id, label, occupations, occupationsLoading, value, onChange,
}: {
  id: string; label: string; occupations: CareerRecord[]; occupationsLoading: boolean;
  value: string; onChange: (value: string) => void;
}) {
  const listId = `${id}-options`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={occupationsLoading ? 'Loading occupations…' : 'Choose from the list or type your own answer'}
      />
      <datalist id={listId}>
        {occupations.map((record, index) => {
          const code = text(record, ['onetsoc_code', 'code']);
          const title = text(record, ['title', 'name']);
          return code && title ? <option key={`${code}-${index}`} value={title} /> : null;
        })}
      </datalist>
    </div>
  );
}

function CareerCertaintyCard({ open, onOpenChange }: {
  open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const [current, setCurrent] = useState<AspirationSnapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [occupations, setOccupations] = useState<CareerRecord[]>([]);
  const [occupationsLoading, setOccupationsLoading] = useState(false);
  const [occupationText, setOccupationText] = useState('');
  const [certainty, setCertainty] = useState<CertaintyLevel | ''>('');
  const [parentText, setParentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true); setLoadError('');
    try { setCurrent(await loadCurrentAspiration()); }
    catch (err) { setLoadError(err instanceof Error ? err.message : 'Unable to load your answer.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!open) return;
    setSaveError('');
    setOccupationText('');
    setCertainty('');
    setParentText('');
    if (!occupations.length) {
      setOccupationsLoading(true);
      loadOccupations()
        .then(setOccupations)
        .catch(() => setOccupations([]))
        .finally(() => setOccupationsLoading(false));
    }
    // Reset the form fresh every time the dialog opens, regardless of who opened it
    // (the "Start"/"Update answer" button here, or the alignment card's prompt).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function matchOccupation(typed: string) {
    const needle = typed.trim().toLowerCase();
    if (!needle) return null;
    return occupations.find((record) => text(record, ['title', 'name']).trim().toLowerCase() === needle) ?? null;
  }

  async function submit() {
    const expectation = occupationText.trim();
    if (!expectation) { setSaveError('Tell us what job you expect to have — choose one or type your own.'); return; }
    if (!certainty) { setSaveError('Select how sure you are.'); return; }
    setSaving(true); setSaveError('');
    try {
      const matchedOccupation = matchOccupation(occupationText);
      const matchedParent = matchOccupation(parentText);
      const saved = await saveAspiration({
        occupation_id: matchedOccupation ? text(matchedOccupation, ['onetsoc_code', 'code']) : undefined,
        occupation_name: matchedOccupation ? text(matchedOccupation, ['title', 'name']) : undefined,
        expectation_age_30: expectation,
        certainty,
        parent_occupation_id: matchedParent ? text(matchedParent, ['onetsoc_code', 'code']) : undefined,
        parent_occupation_name: matchedParent ? text(matchedParent, ['title', 'name']) : (parentText.trim() || undefined),
      });
      setCurrent(saved);
      onOpenChange(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save your answer.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Career certainty</CardTitle>
        <CardDescription>Step 1 of 4</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : current ? (
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">You said: </span><span className="font-medium">{current.occupation_name || current.expectation_age_30}</span></p>
            <p><span className="text-muted-foreground">How sure: </span>{certaintyLabel(current.certainty)}</p>
            {current.parent_occupation_name && (
              <p><span className="text-muted-foreground">Family expects: </span>{current.parent_occupation_name}</p>
            )}
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">Name and investigate an occupation you may want at age 30. Career certainty creates a clear starting point for exploration.</p>
        )}
        <Button variant={current ? 'outline' : 'default'} onClick={() => onOpenChange(true)}>{current ? 'Update answer' : 'Start'}</Button>
      </CardContent>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Career certainty</DialogTitle>
            <DialogDescription>Three quick questions. There is no right answer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {saveError && <p className="text-sm text-destructive" role="alert">{saveError}</p>}
            <OccupationField
              id="expectation-occupation"
              label="What job do you expect to have at age 30?"
              occupations={occupations}
              occupationsLoading={occupationsLoading}
              value={occupationText}
              onChange={setOccupationText}
            />
            <div className="space-y-2">
              <Label>How sure are you?</Label>
              <RadioGroup value={certainty} onValueChange={(value) => setCertainty(value as CertaintyLevel)}>
                {CERTAINTY_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm">
                    <RadioGroupItem value={option.value} id={`certainty-${option.value}`} />
                    {option.label}
                  </label>
                ))}
              </RadioGroup>
            </div>
            <OccupationField
              id="parent-occupation"
              label="What job does your family expect for you? (optional)"
              occupations={occupations}
              occupationsLoading={occupationsLoading}
              value={parentText}
              onChange={setParentText}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

const RECOGNISED_ALIGNMENT_STATUSES: AlignmentStatus[] = ['ALIGNED', 'MISALIGNED', 'INSUFFICIENT_DATA'];

function CareerAlignmentCard({ onStartCertainty }: { onStartCertainty: () => void }) {
  const [payload, setPayload] = useState<AlignmentPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setPayload(await loadAlignment()); }
    // A failed call must never read as a silent "you're fine" — it collapses
    // to the same INSUFFICIENT_DATA state as a missing/unrecognised status.
    catch { setPayload(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const status: AlignmentStatus =
    payload && RECOGNISED_ALIGNMENT_STATUSES.includes(payload.alignment_status)
      ? payload.alignment_status
      : 'INSUFFICIENT_DATA';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Career alignment</CardTitle>
        <CardDescription>Step 3 of 4</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading…</p>
        ) : status === 'ALIGNED' ? (
          <div className="flex items-start gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <p className="text-sm">Your plan can reach your goal.</p>
          </div>
        ) : status === 'MISALIGNED' ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <p className="text-sm">
                Your current subjects don&apos;t yet lead to {payload?.stated_ambition?.occupation_name || payload?.stated_ambition?.occupation_id || 'your goal'}. Talk to your counsellor.
              </p>
            </div>
            {payload?.break_point && (payload.break_point.missing_subjects.length > 0 || payload.break_point.deadline_date) && (
              <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
                {payload.break_point.missing_subjects.length > 0 && (
                  <p><span className="text-muted-foreground">Missing subject{payload.break_point.missing_subjects.length > 1 ? 's' : ''}: </span>{payload.break_point.missing_subjects.join(', ')}</p>
                )}
                {payload.break_point.deadline_date && (
                  <p><span className="text-muted-foreground">Deadline: </span>{payload.break_point.deadline_date}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">Tell us what you want to be first.</p>
            <Button variant="outline" onClick={onStartCertainty}>Go to Career certainty</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CareerIntelligenceHub() {
  const params = useSearchParams();
  const pathname = usePathname() || '';
  const router = useRouter();
  const requested = params?.get('section') as CareerSection | null;
  const [active, setActive] = useState<CareerSection>(
    requested && SECTIONS.some((item) => item.id === requested) ? requested : 'plan'
  );
  const [certaintyOpen, setCertaintyOpen] = useState(false);

  useEffect(() => {
    const nextSection =
      requested && SECTIONS.some((item) => item.id === requested) ? requested : 'plan';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActive(nextSection);
  }, [requested]);

  function selectSection(section: CareerSection) {
    setActive(section);
    const next = new URLSearchParams(params?.toString());
    if (section === 'plan') next.delete('section');
    else next.set('section', section);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-5 p-1 md:p-2">
      <header className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-medium text-primary"><Compass className="size-4" />Student development</div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Career intelligence</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Explore pathways, understand your interests, and turn career ideas into a practical education plan.</p></div><Badge variant="secondary"><UserRoundCheck />Guided planning</Badge></div>
      </header>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Career intelligence sections">
        {SECTIONS.map((section) => { const Icon = section.icon; return <Button key={section.id} variant={active === section.id ? 'default' : 'outline'} className={active === section.id ? 'bg-[#0D6EFD] border-[#0D6EFD] text-white hover:bg-[#0D6EFD]/90' : ''} onClick={() => selectSection(section.id)} aria-current={active === section.id ? 'page' : undefined} title={section.description}><Icon />{section.label}</Button>; })}
      </nav>
      {active === 'plan' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CareerCertaintyCard open={certaintyOpen} onOpenChange={setCertaintyOpen} />
          {(() => { const [title, description] = PLAN[1]; return <Card key={title}><CardHeader><CardTitle>{title}</CardTitle><CardDescription>Step 2 of 4</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{description}</p></CardContent></Card>; })()}
          <CareerAlignmentCard onStartCertainty={() => setCertaintyOpen(true)} />
          {(() => { const [title, description] = PLAN[3]; return <Card key={title}><CardHeader><CardTitle>{title}</CardTitle><CardDescription>Step 4 of 4</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{description}</p></CardContent></Card>; })()}
        </div>
      ) : active === 'intelligence' ? <CareerIntelligence />
        : <MatchingOccupationsCard />}
    </div>
  );
}
