import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  ChevronDown,
  Database,
  Layers3,
  Orbit,
  ShieldCheck,
  Sparkles,
  Tags,
  Workflow,
} from 'lucide-react';
import type { PalConceptContext, PalModuleView, PalSection } from '@/app/pal/data/pal-content-model';

type PalSurfaceVariant = 'framework' | 'ulu';

function buildHref(path: string, queryString: string) {
  return queryString ? `${path}?${queryString}` : path;
}

function getModuleItemCount(module: PalModuleView) {
  return module.sections.reduce((sum, section) => sum + section.items.length, 0);
}

function getSectionPreview(section: PalSection) {
  return section.items.slice(0, 2);
}

function humanizeMeta(meta: string) {
  return meta
    .replace(/^concept name:/i, 'Concept:')
    .replace(/^objective type:/i, '')
    .replace(/^outcome type:/i, '')
    .replace(/^source type:/i, 'Source:')
    .replace(/^relation type:/i, 'Relationship:')
    .replace(/^source concept:/i, 'From:')
    .replace(/^target concept:/i, 'To:')
    .replace(/^application type:/i, 'Application:')
    .replace(/^bloom level:/i, 'Bloom:')
    .replace(/^dok level:/i, 'DOK:')
    .replace(/^why effective:/i, 'Why effective:')
    .replace(/^root cause:/i, 'Root cause:')
    .replace(/^assessment type:/i, 'Assessment:')
    .trim();
}

function getItemEyebrow(sectionTitle: string, meta: string[] | undefined) {
  const normalizedMeta = (meta ?? []).map(humanizeMeta).filter(Boolean);
  const typed = normalizedMeta.find((item) => !item.includes(':'));
  if (typed) return typed;

  if (/objective/i.test(sectionTitle)) return 'Learning objective';
  if (/outcome/i.test(sectionTitle)) return 'Learning outcome';
  if (/competency/i.test(sectionTitle)) return 'Competency';
  if (/pedagogy/i.test(sectionTitle)) return 'Pedagogy';
  if (/context/i.test(sectionTitle)) return 'Context';
  if (/evidence/i.test(sectionTitle)) return 'Evidence';
  return sectionTitle;
}

function getModuleCounts(modules: PalModuleView[]) {
  const totalModules = modules.length;
  const populatedModules = modules.filter((module) => getModuleItemCount(module) > 0).length;
  const totalSections = modules.reduce((sum, module) => sum + module.sections.length, 0);
  const totalRecords = modules.reduce((sum, module) => sum + getModuleItemCount(module), 0);

  return { totalModules, populatedModules, totalSections, totalRecords };
}

export function PalEmptyState({
  title,
  message,
  backHref,
}: {
  title: string;
  message: string;
  backHref?: string;
}) {
  return (
    <div className="min-h-full px-4 py-5 sm:px-6">
      <div className="mx-auto w-full max-w-[1800px] space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-12 shadow-sm">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-600">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h1 className="mt-5 text-2xl font-bold text-slate-900">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
            {backHref ? (
              <div className="mt-6">
                <Link
                  href={backHref}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export function PalContextHero({
  eyebrow,
  title,
  description,
  context,
  variant = 'framework',
}: {
  eyebrow: string;
  title: string;
  description: string;
  context: PalConceptContext;
  variant?: PalSurfaceVariant;
}) {
  if (variant === 'ulu') {
    return (
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)]">
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Orbit className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  <span>New PAL</span>
                  <span>/</span>
                  <span>{eyebrow}</span>
                </div>
                <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">{description}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              {[
                { label: 'L1', title: 'Academic core' },
                { label: 'L2', title: 'Skills flow' },
                { label: 'L3', title: 'Application' },
                { label: 'L4', title: 'Assessment' },
                { label: 'L5', title: 'Optimization' },
              ].map((layer, index) => (
                <div
                  key={layer.label}
                  className="relative overflow-hidden rounded-[22px] border border-emerald-100 bg-[linear-gradient(180deg,#f7fefb_0%,#ffffff_100%)] px-4 py-4"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">{layer.label}</div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{layer.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {index === 0 && 'Concept, objectives, and knowledge anchors.'}
                    {index === 1 && 'Competencies, practice, and learner action.'}
                    {index === 2 && 'Real-world context and activity transfer.'}
                    {index === 3 && 'Checks for understanding and evidence.'}
                    {index === 4 && 'Iteration, support, and improvement loops.'}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Concept: {context.conceptTitle}
              </span>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                Subject: {context.subjectName}
              </span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                Chapter ID: {context.chapterId}
              </span>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_100%)] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
              <Database className="h-4 w-4" />
              semantic_intelligence source
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-emerald-100">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">Learning context</div>
                <p className="mt-1 text-sm font-medium text-slate-900">{context.chapterTitle}</p>
                <p className="mt-1 text-xs text-slate-500">{context.subjectName} · {context.conceptTitle}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-emerald-100">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">Concept slot</div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{context.conceptParam}</p>
                </div>
                <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-emerald-100">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">Data mode</div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">Dynamic</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Layers3 className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                <span>New PAL</span>
                <span>/</span>
                <span>{eyebrow}</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">{title}</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">{description}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.7fr)]">
            <div className="rounded-[24px] border border-indigo-100 bg-[linear-gradient(180deg,#f8faff_0%,#ffffff_100%)] p-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
                <ShieldCheck className="h-4 w-4" />
                Framework structure
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Standards and categories</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Organize semantic evidence into framework-aligned domains, practices, and tagging groups.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Evidence and competency mapping</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Surface which objectives, competencies, and contextual signals support each framework.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected concept</div>
              <p className="mt-2 text-lg font-semibold text-slate-900">{context.conceptTitle}</p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-200">
                  <span className="text-xs font-medium text-slate-500">Subject</span>
                  <span className="text-xs font-semibold text-slate-900">{context.subjectName}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-200">
                  <span className="text-xs font-medium text-slate-500">Chapter ID</span>
                  <span className="text-xs font-semibold text-slate-900">{context.chapterId}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-sky-200 bg-[linear-gradient(180deg,#f0f9ff_0%,#ffffff_100%)] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-900">
            <Database className="h-4 w-4" />
            semantic_intelligence source
          </div>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-sky-100">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">Context</div>
              <p className="mt-1 text-sm font-medium text-slate-900">{context.chapterTitle}</p>
              <p className="mt-1 text-xs text-slate-500">{context.subjectName} · {context.conceptTitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-sky-100">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">Concept Slot</div>
                <p className="mt-1 text-sm font-semibold text-slate-900">{context.conceptParam}</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3 ring-1 ring-sky-100">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">Data Mode</div>
                <p className="mt-1 text-sm font-semibold text-slate-900">Dynamic</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PalModuleGrid({
  modules,
  basePath,
  queryString,
  variant = 'framework',
}: {
  modules: PalModuleView[];
  basePath: string;
  queryString: string;
  variant?: PalSurfaceVariant;
}) {
  const counts = getModuleCounts(modules);

  if (variant === 'framework') {
    return (
      <div className="space-y-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.15fr)]">
          <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#f8faff_0%,#ffffff_100%)] px-6 py-5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
                <ShieldCheck className="h-4 w-4" />
                Framework command center
              </div>
              <h2 className="mt-3 text-xl font-bold text-slate-900">Standards, evidence, competencies, and semantic signals</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                This dashboard clusters live semantic intelligence into framework-oriented groups so each module can be reviewed through mappings, evidence quality, and learner intent.
              </p>
            </div>

            <div className="p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Frameworks" value={String(counts.totalModules)} tone="slate" icon={<Workflow className="h-4 w-4" />} />
                <MetricCard label="Mapped" value={String(counts.populatedModules)} tone="emerald" icon={<ShieldCheck className="h-4 w-4" />} />
                <MetricCard label="Signals" value={String(counts.totalRecords)} tone="amber" icon={<Database className="h-4 w-4" />} />
                <MetricCard label="Competency areas" value={String(counts.totalSections)} tone="blue" icon={<Tags className="h-4 w-4" />} />
              </div>
            </div>
          </article>

          <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="px-6 py-5">
              <div className="grid gap-3 md:grid-cols-3">
                <SignalPill title="Categories" detail="Framework domains and standards clusters from semantic_intelligence." />
                <SignalPill title="Evidence panels" detail="Mapped objective, context, and source signals." />
                <SignalPill title="Learning intent" detail="Competencies and outcomes surfaced per framework." />
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {modules.map((module) => {
            const sectionCount = module.sections.length;
            const recordCount = getModuleItemCount(module);
            const href = buildHref(`${basePath}/${module.slug}`, queryString);
            return (
              <Link key={module.slug} href={href} className="group block">
                <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_148px]">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                            {module.title}
                          </div>
                          <p className="mt-3 text-base font-semibold text-slate-900">{module.summary}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{module.subtitle}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-100 p-3 text-slate-600 transition group-hover:bg-slate-900 group-hover:text-white">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <InlineMetric label="Sections" value={String(sectionCount)} />
                        <InlineMetric label="Signals" value={String(recordCount)} />
                        <InlineMetric label="Mappings" value={String(module.badges.length)} />
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {module.sections.slice(0, 4).map((section) => (
                          <div key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                {section.items.length}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-slate-500">{section.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-5 py-5 lg:border-l lg:border-t-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Framework map</div>
                      <div className="mt-3 space-y-2">
                        {module.badges.map((badge) => (
                          <div key={badge} className="rounded-2xl bg-white px-3 py-2 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                            {badge}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_420px]">
          <div className="p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              <Orbit className="h-4 w-4" />
              Unified Learning Units dashboard
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">5-layer learning-unit flow with application and optimization</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This dashboard organizes the same semantic intelligence into learning-unit flows, showing how academic structure, applied context, evidence, and improvement loops connect.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <MetricCard label="Modules" value={String(counts.totalModules)} tone="slate" icon={<Workflow className="h-4 w-4" />} />
              <MetricCard label="Populated" value={String(counts.populatedModules)} tone="emerald" icon={<BookOpenText className="h-4 w-4" />} />
              <MetricCard label="Sections" value={String(counts.totalSections)} tone="blue" icon={<Layers3 className="h-4 w-4" />} />
              <MetricCard label="Records" value={String(counts.totalRecords)} tone="amber" icon={<Tags className="h-4 w-4" />} />
            </div>
          </div>

          <div className="border-t border-slate-100 bg-[linear-gradient(180deg,#ecfdf5_0%,#ffffff_100%)] p-6 lg:border-l lg:border-t-0">
            <div className="grid gap-3">
              <FlowStep label="L1" title="Academic core" />
              <FlowStep label="L2" title="Skills flow" />
              <FlowStep label="L3" title="Application" />
              <FlowStep label="L4" title="Assessment" />
              <FlowStep label="L5" title="Optimization" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {modules.map((module) => {
          const sectionCount = module.sections.length;
          const recordCount = getModuleItemCount(module);
          const href = buildHref(`${basePath}/${module.slug}`, queryString);

          if (variant === 'ulu') {
            return (
              <Link key={module.slug} href={href} className="group block">
                <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="grid gap-0 lg:grid-cols-[92px_minmax(0,1fr)]">
                    <div className="flex flex-col justify-between bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_100%)] px-5 py-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">ULU</div>
                      <div className="text-3xl font-bold tracking-tight text-emerald-900">{recordCount}</div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            {module.title}
                          </div>
                          <p className="mt-3 text-base font-semibold text-slate-900">{module.summary}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{module.subtitle}</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <InlineMetric label="Layers" value={String(sectionCount)} />
                        <InlineMetric label="Signals" value={String(recordCount)} />
                        <InlineMetric label="Guides" value={String(module.badges.length)} />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {module.badges.map((badge) => (
                          <span key={badge} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            {badge}
                          </span>
                        ))}
                      </div>

                      <div className="mt-5 space-y-2">
                        {module.sections.slice(0, 3).map((section, index) => (
                          <div key={section.title} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{section.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            );
          }

          return (
            <Link key={module.slug} href={href} className="group block">
              <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {module.title}
                      </div>
                      <p className="mt-3 text-base font-semibold text-slate-900">{module.summary}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{module.subtitle}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-100 p-3 text-slate-600 transition group-hover:bg-slate-900 group-hover:text-white">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <InlineMetric label="Sections" value={String(sectionCount)} />
                    <InlineMetric label="Records" value={String(recordCount)} />
                    <InlineMetric label="Badges" value={String(module.badges.length)} />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {module.badges.map((badge) => (
                      <span key={badge} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {badge}
                      </span>
                    ))}
                  </div>

                  {recordCount === 0 ? (
                    <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                      {module.emptyMessage}
                    </p>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {module.sections.slice(0, 3).map((section) => (
                        <div key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                              <p className="mt-1 text-xs text-slate-500">{section.description}</p>
                            </div>
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                              {section.items.length}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {getSectionPreview(section).map((item, index) => (
                              <div key={`${section.title}-preview-${item.title}-${index}`} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                  {getItemEyebrow(section.title, item.meta)}
                                </p>
                                <p className="text-sm font-medium text-slate-800">{item.title}</p>
                                {item.detail ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.detail}</p> : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

export function PalModuleDetail({
  module,
  backHref,
  variant = 'framework',
}: {
  module: PalModuleView;
  backHref: string;
  variant?: PalSurfaceVariant;
}) {
  const hasData = module.sections.some((section) => section.items.length > 0);
  const totalRecords = getModuleItemCount(module);

  if (variant === 'ulu') {
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_320px]">
            <div className="p-6">
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                <span>New PAL</span>
                <span>/</span>
                <span>{module.title}</span>
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">{module.title}</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">{module.subtitle}</p>

              <div className="mt-5 grid gap-3 md:grid-cols-5">
                <FlowStep label="Layer 1" title="Core" />
                <FlowStep label="Layer 2" title="Skills" />
                <FlowStep label="Layer 3" title="Application" />
                <FlowStep label="Layer 4" title="Assessment" />
                <FlowStep label="Layer 5" title="Optimize" />
              </div>
            </div>

            <div className="border-t border-slate-100 bg-[linear-gradient(180deg,#f0fdf4_0%,#ffffff_100%)] p-6 lg:border-l lg:border-t-0">
              <Link href={backHref} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <div className="mt-5 space-y-3">
                <MetricStrip label="Layers" value={String(module.sections.length)} icon={<Layers3 className="h-4 w-4" />} />
                <MetricStrip label="Signals" value={String(totalRecords)} icon={<Orbit className="h-4 w-4" />} />
                <MetricStrip label="State" value={hasData ? 'Live' : 'Empty'} icon={<Sparkles className="h-4 w-4" />} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              <Orbit className="h-4 w-4" />
              Learning flow summary
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{module.summary}</p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Guiding tags</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {module.badges.map((badge) => (
                <span key={badge} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </section>

        {!hasData ? (
          <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-slate-600">{module.emptyMessage}</p>
          </section>
        ) : (
          <section className="space-y-4">
            {module.sections.map((section, index) => (
              <PalUluSectionPanel key={section.title} section={section} index={index} />
            ))}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_340px]">
          <div className="p-6">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              <span>New PAL</span>
              <span>/</span>
              <span>{module.title}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{module.title}</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">{module.subtitle}</p>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <SignalPill title="Evidence panels" detail="Signals, source text, and semantic matches grouped per framework area." />
              <SignalPill title="Competency mapping" detail="Objectives, competencies, and learning intent aligned to the framework." />
              <SignalPill title="Standards view" detail="Categories and section clusters surfaced for detailed review." />
            </div>
          </div>

          <div className="border-t border-slate-100 bg-[linear-gradient(180deg,#f8faff_0%,#ffffff_100%)] p-6 lg:border-l lg:border-t-0">
            <Link href={backHref} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
            <div className="mt-5 space-y-3">
              <MetricStripSlate label="Sections" value={String(module.sections.length)} icon={<Layers3 className="h-4 w-4" />} />
              <MetricStripSlate label="Signals" value={String(totalRecords)} icon={<Database className="h-4 w-4" />} />
              <MetricStripSlate label="Mappings" value={String(module.badges.length)} icon={<Tags className="h-4 w-4" />} />
              <MetricStripSlate label="Availability" value={hasData ? 'Live' : 'Empty'} icon={<Workflow className="h-4 w-4" />} />
            </div>
          </div>
        </div>
      </section>

      {!hasData ? (
        <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">{module.emptyMessage}</p>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[minmax(300px,0.7fr)_minmax(0,1.3fr)]">
          <aside className="space-y-4">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Framework overview</div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{module.summary}</p>
            </section>
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Framework mappings</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {module.badges.map((badge) => (
                  <span key={badge} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {badge}
                  </span>
                ))}
              </div>
            </section>
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Section map</div>
              <div className="mt-4 space-y-2">
                {module.sections.map((section, index) => (
                  <div key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900">{index + 1}. {section.title}</span>
                      <span className="text-xs font-medium text-slate-500">{section.items.length}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <div className="space-y-4">
            {module.sections.map((section) => (
              <PalFrameworkSectionPanel key={section.title} section={section} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PalFrameworkSectionPanel({ section }: { section: PalSection }) {
  return (
    <details className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm" open>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-6 py-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {section.items.length}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{section.description}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-2 text-slate-500 transition group-open:rotate-180">
          <ChevronDown className="h-4 w-4" />
        </div>
      </summary>

      <div className="border-t border-slate-100 px-6 py-5">
        <div className="grid gap-3 xl:grid-cols-2">
          {section.items.map((item, index) => (
            <div
              key={`${section.title}-${item.title}-${index}`}
              className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {getItemEyebrow(section.title, item.meta)}
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  {index + 1}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              {item.detail ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p> : null}
              {item.meta && item.meta.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.meta.map((meta) => (
                    <span key={meta} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                      {humanizeMeta(meta)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function PalUluSectionPanel({ section, index }: { section: PalSection; index: number }) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[120px_minmax(0,1fr)]">
        <div className="border-b border-slate-100 bg-[linear-gradient(180deg,#f0fdf4_0%,#ffffff_100%)] px-5 py-5 lg:border-b-0 lg:border-r">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">Layer</div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-emerald-900">{index + 1}</div>
        </div>

        <div className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">{section.title}</h2>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              {section.items.length} signals
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{section.description}</p>

          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {section.items.map((item, itemIndex) => (
              <div
                key={`${section.title}-${item.title}-${itemIndex}`}
                className="rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {getItemEyebrow(section.title, item.meta)}
                  </p>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                    {itemIndex + 1}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.title}</p>
                {item.detail ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p> : null}
                {item.meta && item.meta.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.meta.map((meta) => (
                      <span key={meta} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        {humanizeMeta(meta)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: 'slate' | 'blue' | 'emerald' | 'amber';
  icon: ReactNode;
}) {
  const toneClasses = {
    slate: 'border-slate-200 bg-white text-slate-900',
    blue: 'border-blue-200 bg-blue-50/70 text-blue-900',
    emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50/70 text-amber-900',
  } satisfies Record<typeof tone, string>;

  return (
    <div className={`rounded-[24px] border p-5 shadow-sm ${toneClasses[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="rounded-xl bg-white/80 p-2 ring-1 ring-black/5">{icon}</span>
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-900">{value}</div>
    </div>
  );
}

function FlowStep({ label, title }: { label: string; title: string }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{title}</div>
    </div>
  );
}

function MetricStrip({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700">{icon}</span>
        {label}
      </div>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function MetricStripSlate({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <span className="rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</span>
        {label}
      </div>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function SignalPill({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}
