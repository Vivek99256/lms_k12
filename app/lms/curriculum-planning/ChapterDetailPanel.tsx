'use client';

// One chapter, opened out: its description, topics, key concepts, concept list,
// source document, and — for chapters that have it — the full per-concept AI
// intelligence.
//
// Everything here is fetched on first expand, never with the page. The roll-up
// carries counts only; inlining the concept descriptions and key-concept blobs
// for every chapter of every standard costs around half a megabyte, almost all
// of it for chapters nobody opens.

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BookOpen, FileText, Loader2, Sparkles } from 'lucide-react';
import { createAuthHeaders, useLmsSessionContext } from '@/app/lms/_shared/useLmsSession';
import { ConceptIntelligenceTabs } from '@/components/intelligence/ConceptIntelligenceTabs';
import { fetchSemanticIntelligenceResult } from '@/app/course-master/data/chapters';
import type { ConceptIntelEntry } from '@/app/course-master/data/chapters';
import type { ApiChapterDetail, ChapterDetailApiResponse } from './types';
import { NotProvided, SectionHeading } from './shared';

type Props = {
  chapterId: number;
  chapterName: string;
  extractionId: number | null;
  hasIntelligence: boolean;
};

export function ChapterDetailPanel({ chapterId, chapterName, extractionId, hasIntelligence }: Props) {
  const session = useLmsSessionContext();

  const [detail, setDetail] = useState<ApiChapterDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      if (!session.subInstituteId) return;

      setIsLoading(true);
      setLoadError(null);

      try {
        const params = new URLSearchParams({
          sub_institute_id: session.subInstituteId,
          chapter_id: String(chapterId),
        });

        const response = await fetch(
          `${session.baseUrl}/api/intelligence/curriculum-planning/chapter?${params}`,
          { method: 'GET', signal: controller.signal, headers: createAuthHeaders(session) }
        );

        const payload = (await response.json().catch(() => ({}))) as ChapterDetailApiResponse;

        if (!response.ok) {
          throw new Error(payload.message || `Chapter detail failed with status ${response.status}`);
        }

        setDetail(payload.data ?? null);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load chapter detail.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [session.baseUrl, session.subInstituteId, session.token, chapterId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-[#77716b]">
        <Loader2 size={15} className="animate-spin" />
        Loading chapter detail...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-start gap-2 px-4 py-5 text-sm text-[#a33a2a]">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        {loadError}
      </div>
    );
  }

  if (!detail) {
    return <div className="px-4 py-5 text-sm text-[#9a958e]">No detail recorded for this chapter.</div>;
  }

  const topicsWithText = detail.topics.filter((topic) => topic.name);

  return (
    <div className="space-y-5 border-t border-[#e9e5de] bg-[#faf9f7] px-4 py-5">
      <div>
        <SectionHeading>Chapter description</SectionHeading>
        {detail.chapter_desc ? (
          <p className="text-sm leading-relaxed text-[#3c3833]">{detail.chapter_desc}</p>
        ) : (
          <NotProvided />
        )}
      </div>

      <div>
        <SectionHeading>Topics ({topicsWithText.length})</SectionHeading>
        {topicsWithText.length === 0 ? (
          <NotProvided label="No topic breakdown has been extracted for this chapter." />
        ) : (
          <ul className="space-y-2">
            {topicsWithText.map((topic) => (
              <li key={topic.topic_id} className="rounded-lg border border-[#e5e1da] bg-white px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium text-[#2d2924]">{topic.name}</span>
                  {topic.estimated_minutes ? (
                    <span className="shrink-0 rounded-full bg-[#efeeec] px-2 py-0.5 text-[11px] text-[#706b64]">
                      {topic.estimated_minutes} min
                    </span>
                  ) : null}
                </div>
                {topic.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-[#706b64]">{topic.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <SectionHeading>Key concepts ({detail.key_concepts.length})</SectionHeading>
        {detail.key_concepts.length === 0 ? (
          <NotProvided label="No key concepts have been extracted for this chapter." />
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {detail.key_concepts.map((keyConcept, index) => (
              <li
                key={`${keyConcept.name ?? 'key-concept'}-${index}`}
                className="rounded-lg border border-[#e5e1da] bg-white px-3 py-2.5"
              >
                <div className="text-sm font-medium text-[#2d2924]">{keyConcept.name || 'Untitled'}</div>
                {keyConcept.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-[#706b64]">{keyConcept.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <SectionHeading>Concepts ({detail.concepts.length})</SectionHeading>
        {detail.concepts.length === 0 ? (
          <NotProvided label="No concepts have been generated for this chapter." />
        ) : (
          <ul className="space-y-2">
            {detail.concepts.map((concept) => (
              <li key={concept.concept_id} className="rounded-lg border border-[#e5e1da] bg-white px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[#2d2924]">{concept.name}</span>
                  {concept.mastery_threshold !== null ? (
                    <span className="rounded-full bg-[#d8f0e8] px-2 py-0.5 text-[11px] text-[#0d6c55]">
                      mastery {concept.mastery_threshold}
                    </span>
                  ) : null}
                  {concept.estimated_mastery_minutes ? (
                    <span className="rounded-full bg-[#efeeec] px-2 py-0.5 text-[11px] text-[#706b64]">
                      {concept.estimated_mastery_minutes} min
                    </span>
                  ) : null}
                  {concept.learning_pattern ? (
                    <span className="rounded-full bg-[#e8e4fb] px-2 py-0.5 text-[11px] text-[#473aa5]">
                      {concept.learning_pattern}
                    </span>
                  ) : null}
                </div>
                {concept.description ? (
                  <p className="mt-1 text-xs leading-relaxed text-[#706b64]">{concept.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {detail.semantic?.learning_objective ? (
        <div>
          <SectionHeading>Learning objectives</SectionHeading>
          <ul className="space-y-1">
            {detail.semantic.learning_objective
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, index) => (
                <li key={`${index}-${line.slice(0, 24)}`} className="flex gap-2 text-sm text-[#3c3833]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2f7dd9]" />
                  {line}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <div>
        <SectionHeading>Source document</SectionHeading>
        {detail.source ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#706b64]">
            <FileText size={14} className="text-[#8a847d]" />
            <span className="font-medium text-[#3c3833]">
              {detail.source.document_tittle || 'Untitled document'}
            </span>
            {detail.source.chapter_number ? <span>· chapter {detail.source.chapter_number}</span> : null}
            {detail.source.page_count ? <span>· {detail.source.page_count} pages</span> : null}
            {detail.source.board ? <span>· {detail.source.board}</span> : null}
            {detail.source.pdf_url ? (
              <a
                href={detail.source.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[#2f7dd9] hover:underline"
              >
                Open PDF
              </a>
            ) : null}
          </div>
        ) : (
          <NotProvided label="No source document is recorded for this chapter." />
        )}
      </div>

      <ChapterIntelligence
        chapterName={chapterName}
        extractionId={extractionId}
        hasIntelligence={hasIntelligence}
      />
    </div>
  );
}

/**
 * The per-concept intelligence, loaded only when this section is opened.
 *
 * Deliberately reuses the course-master renderer rather than growing a second
 * one: ConceptIntelligenceTabs already covers all ten dimensions plus
 * objectives, outcomes, blueprint and rubrics, and already honours the
 * per-institute tab renaming. The blob it consumes reaches up to 1.1MB, which
 * is why it is behind a second click rather than loaded with the chapter.
 */
function ChapterIntelligence({
  chapterName,
  extractionId,
  hasIntelligence,
}: {
  chapterName: string;
  extractionId: number | null;
  hasIntelligence: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<ConceptIntelEntry[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (entries !== null || extractionId === null) return;

    setIsLoading(true);
    setLoadError(null);

    try {
      const result = await fetchSemanticIntelligenceResult(extractionId);
      const concepts = result?.full_intelegance_json?.concepts;
      setEntries(Array.isArray(concepts) ? (concepts as ConceptIntelEntry[]) : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load chapter intelligence.');
    } finally {
      setIsLoading(false);
    }
  }, [entries, extractionId]);

  if (!hasIntelligence || extractionId === null) {
    return (
      <div>
        <SectionHeading>Intelligence</SectionHeading>
        <NotProvided label="No intelligence has been generated for this chapter yet." />
      </div>
    );
  }

  return (
    <div>
      <SectionHeading>Intelligence</SectionHeading>

      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            void load();
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d7d3cd] bg-white px-3 text-sm font-medium text-[#332f2a] transition-colors hover:bg-[#f1f0ed]"
        >
          <Sparkles size={14} className="text-[#7468d9]" />
          Show concept intelligence
        </button>
      ) : isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#77716b]">
          <Loader2 size={15} className="animate-spin" />
          Loading intelligence...
        </div>
      ) : loadError ? (
        <div className="flex items-start gap-2 text-sm text-[#a33a2a]">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {loadError}
        </div>
      ) : !entries || entries.length === 0 ? (
        <NotProvided label="Intelligence exists for this chapter but holds no concepts." />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {entries.map((entry, index) => {
              const name =
                (entry.concept as Record<string, unknown> | undefined)?.concept_name?.toString() ??
                `Concept ${index + 1}`;
              return (
                <button
                  key={`${name}-${index}`}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    index === activeIndex
                      ? 'bg-[#2f7dd9] text-white'
                      : 'bg-white text-[#4a453f] ring-1 ring-[#ddd9d2] hover:bg-[#f1f0ed]'
                  }`}
                >
                  <BookOpen size={11} className="mr-1 inline" />
                  {name}
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-[#e5e1da] bg-white">
            <ConceptIntelligenceTabs
              entry={entries[activeIndex] ?? entries[0]}
              chapterTitle={chapterName}
            />
          </div>
        </div>
      )}
    </div>
  );
}
