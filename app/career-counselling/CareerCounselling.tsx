'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen, BriefcaseBusiness, Building2, ChevronLeft, ChevronRight,
  CircleHelp, Compass, GraduationCap, LoaderCircle, RefreshCw, Search,
  Sparkles, Target, UserRoundCheck, UsersRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { careerRequest, loadInterestResults, loadQuestions, loadRecords } from './_lib/api';
import type {
  CareerRecord, CareerSection, InterestQuestion, InterestResult, RequestState,
} from './_lib/types';

const SECTIONS: Array<{
  id: CareerSection; label: string; description: string; icon: typeof Compass;
}> = [
  { id: 'plan', label: 'Career plan', description: 'Build clarity and direction', icon: Target },
  { id: 'explore', label: 'Explore careers', description: 'Search occupations and pathways', icon: Compass },
  { id: 'assessment', label: 'Interest profile', description: 'Complete the RIASEC assessment', icon: CircleHelp },
  { id: 'colleges', label: 'Colleges', description: 'Find institutes and programmes', icon: Building2 },
  { id: 'courses', label: 'Courses', description: 'Compare learning pathways', icon: GraduationCap },
  { id: 'employers', label: 'Employers', description: 'Explore employer profiles', icon: BriefcaseBusiness },
  { id: 'experts', label: 'Expert advice', description: 'Connect with career counsellors', icon: UsersRound },
  { id: 'sectors', label: 'Career sectors', description: 'Learn about industry sectors', icon: BookOpen },
  { id: 'match', label: 'Match profile', description: 'Review matching occupations', icon: Sparkles },
];

const DIRECTORY_CONFIG: Partial<Record<CareerSection, {
  endpoint: string; title: string; empty: string; queryKey?: string;
}>> = {
  explore: { endpoint: 'careerCluster', title: 'Career explorer', empty: 'No careers match the current search.' },
  colleges: { endpoint: 'getInstituteData', title: 'College profiles', empty: 'No colleges are available.' },
  courses: { endpoint: 'getCourseData', title: 'Course profiles', empty: 'No courses are available.' },
  employers: { endpoint: 'getEmployerData', title: 'Employer profiles', empty: 'No employer profiles are available.' },
  experts: { endpoint: 'ExpertAdvice', title: 'Expert advice', empty: 'No experts match the selected pathway.', queryKey: 'title' },
  sectors: { endpoint: 'ExploreSector', title: 'Career sectors', empty: 'No sector content is available.', queryKey: 'title' },
  match: { endpoint: 'matchProfile', title: 'Matching occupations', empty: 'No matching occupations are available.' },
};

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

function Directory({ section }: { section: CareerSection }) {
  const config = DIRECTORY_CONFIG[section]!;
  const [query, setQuery] = useState('');
  const [pathway, setPathway] = useState('');
  const [selected, setSelected] = useState<CareerRecord | null>(null);
  const [filters, setFilters] = useState<CareerRecord[]>([]);
  const [state, setState] = useState<RequestState<CareerRecord[]>>({
    data: [], loading: true, error: '',
  });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const params = config.queryKey && pathway ? { [config.queryKey]: pathway } : undefined;
      const [rows, filterRows] = await Promise.all([
        loadRecords(config.endpoint, params),
        section === 'explore' ? loadRecords('careerExplore') : Promise.resolve([]),
      ]);
      setState({ data: rows, loading: false, error: '' });
      setFilters(filterRows);
    } catch (error) {
      setState({ data: [], loading: false, error: error instanceof Error ? error.message : 'Unable to load information.' });
    }
  }, [config.endpoint, config.queryKey, pathway, section]);

  useEffect(() => {
    // The request owns the loading, error, and response state for this view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needles = [query, pathway].map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (!needles.length) return state.data;
    return state.data.filter((record) => {
      const searchable = Object.values(record)
        .filter((value): value is string | number => ['string', 'number'].includes(typeof value))
        .join(' ')
        .toLowerCase();
      return needles.every((needle) => searchable.includes(needle));
    });
  }, [pathway, query, state.data]);

  async function openRecord(record: CareerRecord) {
    setSelected(record);
    if (section !== 'explore') return;
    const code = text(record, ['onetsoc_code', 'code', 'career_code']);
    if (!code) return;
    try {
      const payload = await careerRequest('OccupationDetails', { onetsoc_code: code });
      const details = Array.isArray(payload) ? payload[0] : payload;
      if (details && typeof details === 'object') setSelected({ ...record, ...(details as CareerRecord) });
    } catch {
      // The list record remains usable if optional details are unavailable.
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{config.title}</CardTitle>
        <CardDescription>Search, filter, and open a record to review complete details.</CardDescription>
        <CardAction><Badge variant="secondary">{filtered.length} records</Badge></CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_260px_auto]">
          <div className="relative"><Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" /><Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by keyword, name, category, or qualification" /></div>
          {(config.queryKey || filters.length > 0) && (
            <>
              <Input list="career-filter-options" value={pathway} onChange={(event) => setPathway(event.target.value)} placeholder="Career pathway or filter" />
              <datalist id="career-filter-options">
                {filters.slice(0, 100).map((record, index) => {
                  const value = text(record, ['element_name', 'career_pathway', 'career_cluster', 'title', 'name']);
                  return value ? <option key={`${value}-${index}`} value={value} /> : null;
                })}
              </datalist>
            </>
          )}
          <Button variant="outline" onClick={load}><RefreshCw />Refresh</Button>
        </div>
        <RequestMessage loading={state.loading} error={state.error} empty={!state.loading && !state.error && filtered.length === 0 ? config.empty : undefined} retry={load} />
        {!state.loading && !state.error && filtered.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((record, index) => {
              const title = text(record, ['career_cluster', 'career_pathway', 'occupation_title', 'title', 'name', 'institute_name', 'course_name', 'employer_name'], `Record ${index + 1}`);
              const description = text(record, ['description', 'short_description', 'about', 'address', 'qualification', 'content']);
              const category = text(record, ['career_pathway', 'category', 'sector', 'location', 'element_name']);
              return (
                <button key={text(record, ['id', 'career_id', 'code'], String(index))} onClick={() => void openRecord(record)} className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="flex items-start justify-between gap-3"><h3 className="font-medium">{title}</h3><ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" /></div>
                  {category && <Badge className="mt-2" variant="outline">{category}</Badge>}
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{description || 'Open to view the available profile information.'}</p>
                </button>
              );
            })}
          </div>
        )}
        {selected && (
          <div className="rounded-xl border bg-muted/30 p-5" role="region" aria-label="Selected profile">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-lg font-semibold">{text(selected, ['occupation_title', 'career_cluster', 'title', 'name', 'institute_name', 'course_name', 'employer_name'], 'Profile details')}</h3><p className="mt-1 text-sm text-muted-foreground">Profile details</p></div>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
            <dl className="mt-4 grid gap-3 md:grid-cols-2">
              {Object.entries(selected).filter(([, value]) => ['string', 'number'].includes(typeof value) && String(value).trim()).slice(0, 16).map(([key, value]) => (
                <div key={key} className="rounded-lg bg-background p-3"><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{key.replaceAll('_', ' ')}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{String(value)}</dd></div>
              ))}
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Assessment() {
  const [phase, setPhase] = useState<'intro' | 'questions' | 'results' | 'zone' | 'careers'>('intro');
  const [questions, setQuestions] = useState<InterestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [results, setResults] = useState<InterestResult[]>([]);
  const [jobZones, setJobZones] = useState<CareerRecord[]>([]);
  const [zone, setZone] = useState('');
  const [careers, setCareers] = useState<CareerRecord[]>([]);
  const [manual, setManual] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({
    Realistic: 0, Investigative: 0, Artistic: 0, Social: 0, Enterprising: 0, Conventional: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scale = ['Strongly dislike', 'Dislike', 'Unsure', 'Like', 'Strongly like'];

  async function begin() {
    setLoading(true); setError('');
    try {
      setQuestions(await loadQuestions());
      setPhase('questions');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load the assessment.'); }
    finally { setLoading(false); }
  }

  async function scoreAssessment() {
    if (questions.length !== Object.keys(answers).length) {
      setError(`Answer all ${questions.length} questions before continuing.`);
      return;
    }
    setLoading(true); setError('');
    try {
      const encoded = questions.map((_, index) => (answers[index] ?? 0) + 1).join('');
      setResults(await loadInterestResults(encoded));
      setPhase('results');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to calculate the result.'); }
    finally { setLoading(false); }
  }

  async function submitManual() {
    const invalid = Object.values(scores).some((value) => !Number.isFinite(value) || value < 0 || value > 40);
    if (invalid) { setError('Each RIASEC score must be between 0 and 40.'); return; }
    setLoading(true); setError('');
    try { setResults(await loadInterestResults(undefined, scores)); setManual(false); setPhase('results'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to calculate the result.'); }
    finally { setLoading(false); }
  }

  async function loadZones() {
    setLoading(true); setError('');
    try { setJobZones(await loadRecords('intrestJobzone')); setPhase('zone'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to load job zones.'); }
    finally { setLoading(false); }
  }

  async function loadCareers() {
    if (!zone) { setError('Select a job zone before continuing.'); return; }
    setLoading(true); setError('');
    try {
      const topAreas = [...results].sort((a, b) => b.score - a.score).slice(0, 3).map((item) => item.area[0]).join('');
      setCareers(await loadRecords('intrestCareers', { answers: topAreas, job_zone: zone }));
      setPhase('careers');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load career recommendations.'); }
    finally { setLoading(false); }
  }

  const progress = questions.length ? Math.round(Object.keys(answers).length / questions.length * 100) : 0;
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>RIASEC interest profile</CardTitle>
        <CardDescription>Discover the work activities and career environments that fit your interests.</CardDescription>
        <CardAction><Badge variant="outline">{phase === 'questions' ? `${progress}% complete` : phase}</Badge></CardAction>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</div>}
        {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Processing your assessment…</div>}
        {phase === 'intro' && (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4"><h3 className="text-xl font-semibold">Find careers that reflect what you enjoy</h3><p className="text-muted-foreground">Rate 60 work activities from strongly dislike to strongly like. There are no right or wrong answers. Your result covers Realistic, Investigative, Artistic, Social, Enterprising, and Conventional interests.</p><div className="flex flex-wrap gap-2"><Button onClick={() => void begin()} disabled={loading}>Start assessment</Button><Button variant="outline" onClick={() => setManual(true)}>Enter previous scores</Button></div></div>
            <div className="rounded-xl border bg-muted/30 p-4"><h4 className="font-medium">Before you begin</h4><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground"><li>Answer based on whether you would enjoy the activity.</li><li>Do not consider salary, education, or current skill level.</li><li>You can review and change any answer before submission.</li></ul></div>
          </div>
        )}
        {manual && phase === 'intro' && (
          <div className="rounded-xl border p-4"><h3 className="font-medium">Enter previous scores</h3><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(scores).map(([area, value]) => <div key={area}><Label htmlFor={`score-${area}`}>{area}</Label><Input id={`score-${area}`} type="number" min={0} max={40} value={value} onChange={(event) => setScores((current) => ({ ...current, [area]: Number(event.target.value) }))} aria-invalid={value < 0 || value > 40} /></div>)}</div><div className="mt-4 flex gap-2"><Button onClick={() => void submitManual()}>View results</Button><Button variant="ghost" onClick={() => setManual(false)}>Cancel</Button></div></div>
        )}
        {phase === 'questions' && (
          <>
            <div><div className="mb-2 flex justify-between text-sm"><span>{Object.keys(answers).length} of {questions.length} answered</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div></div>
            <div className="max-h-[55vh] overflow-auto rounded-xl border">
              {questions.map((question, index) => (
                <fieldset key={question.id} className="border-b p-4 last:border-0"><legend className="font-medium">{index + 1}. {question.text}</legend><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">{scale.map((label, choice) => <label key={label} className={`cursor-pointer rounded-lg border p-2 text-center text-xs transition-colors ${answers[index] === choice ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}><input className="sr-only" type="radio" name={`question-${index}`} checked={answers[index] === choice} onChange={() => setAnswers((current) => ({ ...current, [index]: choice }))} />{label}</label>)}</div></fieldset>
              ))}
            </div>
            <div className="flex justify-between"><Button variant="outline" onClick={() => setPhase('intro')}><ChevronLeft />Back</Button><Button onClick={() => void scoreAssessment()} disabled={loading || questions.length !== Object.keys(answers).length}>Calculate results<ChevronRight /></Button></div>
          </>
        )}
        {phase === 'results' && (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{results.sort((a, b) => b.score - a.score).map((result) => <div key={result.area} className="rounded-xl border p-4"><div className="flex items-center justify-between"><h3 className="font-medium">{result.area}</h3><Badge>{result.score}</Badge></div><div className="mt-3 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, result.score / Math.max(1, ...results.map((item) => item.score)) * 100)}%` }} /></div>{result.description && <p className="mt-3 text-sm text-muted-foreground">{result.description}</p>}</div>)}</div>
            <div className="flex justify-between"><Button variant="outline" onClick={() => setPhase(questions.length ? 'questions' : 'intro')}><ChevronLeft />Back</Button><Button onClick={() => void loadZones()}>Choose preparation level<ChevronRight /></Button></div>
          </>
        )}
        {phase === 'zone' && (
          <>
            <div><h3 className="text-lg font-semibold">Choose your job zone</h3><p className="mt-1 text-sm text-muted-foreground">Job zones group careers by the education, experience, and training they usually require.</p></div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{jobZones.map((record, index) => { const value = text(record, ['job_zone', 'zone', 'id'], String(index + 1)); return <label key={value} className={`cursor-pointer rounded-xl border p-4 ${zone === value ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}><input className="sr-only" type="radio" name="job-zone" checked={zone === value} onChange={() => setZone(value)} /><h4 className="font-medium">{text(record, ['title', 'name', 'zone_name'], `Job zone ${value}`)}</h4><p className="mt-2 text-sm text-muted-foreground">{text(record, ['description', 'experience', 'education'], 'Review the preparation level for this zone.')}</p></label>; })}</div>
            {!jobZones.length && !loading && <p className="text-sm text-muted-foreground">No job-zone information is available.</p>}
            <div className="flex justify-between"><Button variant="outline" onClick={() => setPhase('results')}><ChevronLeft />Back</Button><Button onClick={() => void loadCareers()} disabled={!zone}>View career matches<ChevronRight /></Button></div>
          </>
        )}
        {phase === 'careers' && (
          <>
            <div><h3 className="text-lg font-semibold">Recommended careers</h3><p className="text-sm text-muted-foreground">Recommendations combine your strongest interests with job zone {zone}.</p></div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{careers.map((record, index) => <div key={text(record, ['code', 'id'], String(index))} className="rounded-xl border p-4"><h4 className="font-medium">{text(record, ['occupation_title', 'title', 'name', 'career'], `Career ${index + 1}`)}</h4><p className="mt-2 text-sm text-muted-foreground">{text(record, ['description', 'career_cluster', 'career_pathway'], 'Career recommendation')}</p></div>)}</div>
            {!careers.length && !loading && <p className="text-sm text-muted-foreground">No recommendations were returned for this combination.</p>}
            <Button variant="outline" onClick={() => setPhase('zone')}><ChevronLeft />Change job zone</Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function CareerCounselling() {
  const params = useSearchParams();
  const pathname = usePathname() || '';
  const router = useRouter();
  const requested = params?.get('section') as CareerSection | null;
  const [active, setActive] = useState<CareerSection>(
    requested && SECTIONS.some((item) => item.id === requested) ? requested : 'plan'
  );

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
        <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-medium text-primary"><Compass className="size-4" />Student development</div><h1 className="mt-2 text-2xl font-semibold tracking-tight">Career counselling</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Explore pathways, understand your interests, and turn career ideas into a practical education plan.</p></div><Badge variant="secondary"><UserRoundCheck />Guided planning</Badge></div>
      </header>
      <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Career counselling sections">
        {SECTIONS.map((section) => { const Icon = section.icon; return <Button key={section.id} variant={active === section.id ? 'default' : 'outline'} onClick={() => selectSection(section.id)} aria-current={active === section.id ? 'page' : undefined} title={section.description}><Icon />{section.label}</Button>; })}
      </nav>
      {active === 'plan' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {PLAN.map(([title, description], index) => <Card key={title}><CardHeader><CardTitle>{title}</CardTitle><CardDescription>Step {index + 1} of 4</CardDescription></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{description}</p></CardContent></Card>)}
        </div>
      ) : active === 'assessment' ? <Assessment /> : <Directory section={active} />}
    </div>
  );
}
