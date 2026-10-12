'use client';

import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import {
  BookOpenCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers3,
  Link2,
  Pencil,
  Plus,
  Printer,
  Target,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DAY_FIELDS,
  isEmptyValue,
  type LessonPlanData,
  type LessonPlanDay,
  type LessonPlanField,
} from './lessonPlanApi';

const ACCENT = '#5648E8';

type SectionId = 'summary' | 'teaching' | 'learning' | 'days' | 'alignment';

const SECTION_META: { id: SectionId; label: string; blurb: string; icon: ElementType }[] = [
  { id: 'summary', label: 'Summary of lesson plan', blurb: 'Class, timing and qualifying assessment', icon: FileText },
  { id: 'teaching', label: 'Teaching', blurb: 'How the lesson is delivered', icon: GraduationCap },
  { id: 'learning', label: 'Learning', blurb: 'Objectives, outcomes and practice', icon: Target },
  { id: 'days', label: 'Day planning', blurb: 'The plan, day by day', icon: CalendarDays },
  { id: 'alignment', label: 'Map & alignment', blurb: 'Curriculum links and enrichment', icon: Layers3 },
];

// ---- Rich text (stored values may contain TinyMCE markup) -------------------

const RICH_TEXT_CLASS = cn(
  'text-[15px] leading-7 text-slate-800 break-words',
  '[&_p]:mb-2 [&_p:last-child]:mb-0',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_a]:text-[#5648E8] [&_a]:underline [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg',
  '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-2',
  '[&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_th]:text-left',
  '[&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold'
);

function RichText({ value }: { value: string }) {
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(value);
  const html = useMemo(() => (looksLikeHtml ? DOMPurify.sanitize(value) : ''), [looksLikeHtml, value]);
  if (looksLikeHtml) return <div className={RICH_TEXT_CLASS} dangerouslySetInnerHTML={{ __html: html }} />;
  return <div className={cn(RICH_TEXT_CLASS, 'whitespace-pre-wrap')}>{value}</div>;
}

function EmptyValue({ label }: { label: string }) {
  return <p className="text-sm italic text-slate-500">No data added for {label}</p>;
}

// ---- Building blocks --------------------------------------------------------

function filledCount(fields: LessonPlanField[]) {
  return fields.filter((field) => !isEmptyValue(field.value)).length;
}

function FieldRow({ field }: { field: LessonPlanField }) {
  const empty = isEmptyValue(field.value);
  return (
    <div className="grid gap-1.5 py-4 first:pt-0 last:pb-0 md:grid-cols-[200px_minmax(0,1fr)] md:gap-6">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 md:pt-1">{field.label}</dt>
      <dd className="min-w-0">{empty ? <EmptyValue label={field.label} /> : <RichText value={field.value} />}</dd>
    </div>
  );
}

function FieldList({ fields }: { fields: LessonPlanField[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {fields.map((field) => (
        <FieldRow key={field.key} field={field} />
      ))}
    </dl>
  );
}

function SectionCard({
  id,
  title,
  blurb,
  icon: Icon,
  filled,
  total,
  children,
}: {
  id: SectionId;
  title: string;
  blurb: string;
  icon: ElementType;
  filled?: number;
  total?: number;
  children: ReactNode;
}) {
  return (
    <section
      id={`lp-${id}`}
      aria-labelledby={`lp-${id}-title`}
      className="scroll-mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm print:break-inside-avoid print:shadow-none"
    >
      <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${ACCENT}14`, color: ACCENT }}
          >
            <Icon size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 id={`lp-${id}-title`} className="text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="text-sm text-slate-600">{blurb}</p>
          </div>
        </div>
        {typeof filled === 'number' && typeof total === 'number' ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-700">
            {filled} of {total} filled
          </span>
        ) : null}
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function FactTile({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-base font-semibold tabular-nums text-slate-900">{isEmptyValue(value) ? '—' : value}</div>
        <div className="text-xs text-slate-600">{label}</div>
      </div>
    </div>
  );
}

// ---- Day planning -----------------------------------------------------------

const DAY_GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Lesson flow', keys: ['duringcontent', 'pedagogicalprocess', 'resource', 'closure'] },
  { title: 'Objectives and outcomes', keys: ['assessmentqualifying', 'learningobjective', 'learningoutcome'] },
  { title: 'Practice and assessment', keys: ['selfstudyhomework', 'assessment'] },
];

function DayPanel({ day }: { day: LessonPlanDay }) {
  const labelFor = (key: string) => DAY_FIELDS.find((def) => def.key === key)?.label ?? key;
  const topic = day.values.topicname;
  const classTime = day.values.classtime;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Topic</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {isEmptyValue(topic) ? <span className="text-sm font-normal italic text-slate-500">No data added for Topic</span> : topic}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <Timer size={16} aria-hidden="true" className="text-slate-500" />
          <span className="text-slate-600">Class time</span>
          <span className="font-semibold tabular-nums text-slate-900">{isEmptyValue(classTime) ? '—' : classTime}</span>
        </div>
      </div>

      {DAY_GROUPS.map((group) => (
        <div key={group.title}>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">{group.title}</h3>
          <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 px-4 py-1">
            {group.keys.map((key) => (
              <FieldRow key={key} field={{ key, label: labelFor(key), value: day.values[key] ?? '' }} />
            ))}
            {group.title === 'Practice and assessment' ? (
              <div className="grid gap-1.5 py-4 md:grid-cols-[200px_minmax(0,1fr)] md:gap-6">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 md:pt-1">
                  Self-study activities
                </dt>
                <dd className="min-w-0">
                  {day.activities.length === 0 ? (
                    <p className="text-sm italic text-slate-500">No activities</p>
                  ) : (
                    <ul className="space-y-2">
                      {day.activities.map((activity) => (
                        <li key={activity.id}>
                          <a
                            href={activity.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5648E8]"
                          >
                            <Link2 size={14} aria-hidden="true" className="text-slate-500" />
                            {activity.title || 'Untitled activity'}
                            <ExternalLink size={12} aria-hidden="true" className="text-slate-400" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ))}
    </div>
  );
}

function DayPlanning({ days }: { days: LessonPlanDay[] }) {
  const [activeId, setActiveId] = useState<string>(days[0]?.id ?? '');
  const active = days.find((day) => day.id === activeId) ?? days[0];

  if (!active) return <p className="text-sm italic text-slate-500">No data added for Day planning</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[148px_minmax(0,1fr)]">
      <div
        role="group"
        aria-label="Choose a day"
        className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
      >
        {days.map((day) => {
          const selected = day.id === active.id;
          return (
            <button
              key={day.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveId(day.id)}
              className={cn(
                'flex min-h-11 shrink-0 flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5648E8]',
                selected
                  ? 'border-[#5648E8] bg-[#5648E8] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              )}
            >
              <span className="text-sm font-semibold">Day {day.day}</span>
              <span className={cn('line-clamp-1 max-w-[120px] text-xs', selected ? 'text-white/85' : 'text-slate-600')}>
                {isEmptyValue(day.values.topicname) ? 'No topic' : day.values.topicname}
              </span>
            </button>
          );
        })}
      </div>
      <div className="min-w-0" aria-live="polite">
        <DayPanel key={active.id} day={active} />
      </div>
    </div>
  );
}

// ---- Mapping table ----------------------------------------------------------

function MappingTable({ rows }: { rows: LessonPlanData['mapping'] }) {
  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Mapping</h3>
      {rows.length === 0 ? (
        <EmptyValue label="Mapping" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/80">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                <th scope="col" className="w-16 px-4 py-2.5">Sr no.</th>
                <th scope="col" className="px-4 py-2.5">Mapping type</th>
                <th scope="col" className="px-4 py-2.5">Mapping value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={`${row.type}-${index}`}>
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">{index + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{row.type}</td>
                  <td className="px-4 py-2.5 text-slate-800">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- The view ---------------------------------------------------------------

export type ChapterOption = { id: string; title: string };

export function LessonPlanView({
  plan,
  chapters,
  chapterTitle,
  subjectTitle,
  standardTitle,
  editHref,
  onSelectChapter,
  onBack,
}: {
  plan: LessonPlanData;
  chapters: ChapterOption[];
  chapterTitle: string;
  subjectTitle: string;
  standardTitle: string;
  editHref: string;
  onSelectChapter: (chapterId: string) => void;
  onBack: () => void;
}) {
  const [activeSection, setActiveSection] = useState<SectionId>('summary');

  // Highlight the section being read.
  useEffect(() => {
    const nodes = SECTION_META.map((meta) => document.getElementById(`lp-${meta.id}`)).filter(
      (node): node is HTMLElement => node !== null
    );
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) setActiveSection(first.target.id.replace('lp-', '') as SectionId);
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [plan.id]);

  const goToSection = (id: SectionId) => {
    setActiveSection(id);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(`lp-${id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const summaryValue = (key: string) => plan.summary.find((field) => field.key === key)?.value ?? '';
  const summaryDetails = plan.summary.filter((field) => !['standard', 'subject', 'chapter'].includes(field.key));
  const identity = plan.summary.filter((field) => ['standard', 'subject', 'chapter'].includes(field.key));

  const counts: Record<SectionId, { filled: number; total: number } | null> = {
    summary: { filled: filledCount(plan.summary), total: plan.summary.length },
    teaching: { filled: filledCount(plan.teaching), total: plan.teaching.length },
    learning: { filled: filledCount(plan.learning), total: plan.learning.length },
    days: null,
    alignment: { filled: filledCount(plan.alignment), total: plan.alignment.length },
  };

  const chapterIndex = chapters.findIndex((chapter) => chapter.id === plan.chapterId);
  const prevChapter = chapterIndex > 0 ? chapters[chapterIndex - 1] : null;
  const nextChapter = chapterIndex >= 0 && chapterIndex < chapters.length - 1 ? chapters[chapterIndex + 1] : null;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-slate-600 print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="rounded px-1 font-medium text-[#5648E8] hover:underline focus-visible:outline-2 focus-visible:outline-[#5648E8]"
        >
          Lesson plan
        </button>
        <ChevronRight size={14} aria-hidden="true" className="text-slate-400" />
        <span>{subjectTitle || 'Subject'}</span>
        <ChevronRight size={14} aria-hidden="true" className="text-slate-400" />
        <span aria-current="page" className="font-medium text-slate-900">
          {chapterTitle || 'Chapter'}
        </span>
      </nav>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Lesson plan</h1>
          <p className="mt-1 text-base text-slate-600">
            {[chapterTitle, subjectTitle, standardTitle].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {chapters.length > 1 ? (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous chapter"
                disabled={!prevChapter}
                onClick={() => prevChapter && onSelectChapter(prevChapter.id)}
                className="size-10 rounded-xl"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </Button>
              <label className="sr-only" htmlFor="lp-chapter-select">
                Chapter
              </label>
              <select
                id="lp-chapter-select"
                value={plan.chapterId}
                onChange={(event) => onSelectChapter(event.target.value)}
                className="h-10 max-w-[240px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus-visible:outline-2 focus-visible:outline-[#5648E8]"
              >
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next chapter"
                disabled={!nextChapter}
                onClick={() => nextChapter && onSelectChapter(nextChapter.id)}
                className="size-10 rounded-xl"
              >
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </div>
          ) : null}
          <Button variant="outline" onClick={() => window.print()} className="h-10 rounded-xl px-3">
            <Printer size={16} aria-hidden="true" />
            Print
          </Button>
          <a
            href={editHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5648E8]"
            style={{ backgroundColor: ACCENT }}
          >
            {plan.exists ? <Pencil size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            {plan.exists ? 'Edit lesson plan' : 'Add lesson plan'}
          </a>
        </div>
      </div>

      {/* Key facts */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FactTile icon={BookOpenCheck} label="Number of periods" value={summaryValue('numberofperiod')} />
        <FactTile icon={Timer} label="Teaching time" value={summaryValue('teachingtime')} />
        <FactTile icon={GraduationCap} label="Learning time" value={summaryValue('learningtime')} />
        <FactTile icon={Target} label="Assessment time" value={summaryValue('assessmenttime')} />
      </div>

      {!plan.exists ? (
        <div className="mb-6 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900">No lesson plan yet for this chapter</h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">
            Once a lesson plan is added, its summary, teaching, learning, day-by-day plan and alignment will appear here.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Section navigator */}
        <aside className="print:hidden">
          <nav aria-label="Lesson plan sections" className="lg:sticky lg:top-6">
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {SECTION_META.map((meta) => {
                const selected = activeSection === meta.id;
                const count = counts[meta.id];
                const Icon = meta.icon;
                return (
                  <li key={meta.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => goToSection(meta.id)}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5648E8]',
                        selected
                          ? 'border-[#5648E8]/40 bg-[#5648E8]/[0.07] text-slate-900'
                          : 'border-transparent text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      <Icon size={18} aria-hidden="true" className={selected ? 'text-[#5648E8]' : 'text-slate-500'} />
                      <span className="min-w-0 flex-1 text-sm font-medium">{meta.label}</span>
                      <span className="text-xs tabular-nums text-slate-600">
                        {meta.id === 'days' ? plan.days.length : count ? `${count.filled}/${count.total}` : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        {/* Sections */}
        <div className="min-w-0 space-y-6">
          <SectionCard
            id="summary"
            title="Summary of lesson plan"
            blurb="Class, timing and qualifying assessment"
            icon={FileText}
            filled={counts.summary?.filled}
            total={counts.summary?.total}
          >
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              {identity.map((field) => (
                <div key={field.key} className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{field.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {isEmptyValue(field.value) ? <span className="font-normal italic text-slate-500">No lesson plan</span> : field.value}
                  </p>
                </div>
              ))}
            </div>
            <FieldList fields={summaryDetails} />
            <MappingTable rows={plan.mapping} />
          </SectionCard>

          <SectionCard
            id="teaching"
            title="Teaching"
            blurb="How the lesson is delivered"
            icon={GraduationCap}
            filled={counts.teaching?.filled}
            total={counts.teaching?.total}
          >
            <FieldList fields={plan.teaching} />
          </SectionCard>

          <SectionCard
            id="learning"
            title="Learning"
            blurb="Objectives, outcomes and practice"
            icon={Target}
            filled={counts.learning?.filled}
            total={counts.learning?.total}
          >
            <FieldList fields={plan.learning} />
          </SectionCard>

          <SectionCard id="days" title="Day planning" blurb="The plan, day by day" icon={CalendarDays}>
            <DayPlanning days={plan.days} />
          </SectionCard>

          <SectionCard
            id="alignment"
            title="Map & alignment"
            blurb="Curriculum links and enrichment"
            icon={Layers3}
            filled={counts.alignment?.filled}
            total={counts.alignment?.total}
          >
            <FieldList fields={plan.alignment} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
