'use client';

// A chapter is deliberately a small curriculum drill-down: Topic shows the
// topic_master -> concept hierarchy; Competency shows only the chapter's
// extraction codes.  Other chapter metadata stays out of this view so the two
// requested tabs remain unambiguous.

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { createAuthHeaders, useLmsSessionContext } from '@/app/lms/_shared/useLmsSession';
import type { ApiChapterDetail, ApiLearningOutcome, ChapterDetailApiResponse } from './types';
import { NotProvided, SectionHeading } from './shared';

type Props = {
  chapterId: number;
  learningOutcomes: ApiLearningOutcome[];
};

type ChapterTab = 'topic' | 'competency';

export function ChapterDetailPanel({ chapterId, learningOutcomes }: Props) {
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
        if (!response.ok) throw new Error(payload.message || `Chapter detail failed with status ${response.status}`);
        setDetail(payload.data ?? null);
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          setLoadError(error instanceof Error ? error.message : 'Unable to load chapter detail.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [chapterId, session, session.baseUrl, session.subInstituteId, session.token]);

  if (isLoading) {
    return <div className="flex items-center gap-2 px-4 py-6 text-sm text-[#77716b]"><Loader2 size={15} className="animate-spin" />Loading chapter detail...</div>;
  }
  if (loadError) {
    return <div className="flex items-start gap-2 px-4 py-5 text-sm text-[#a33a2a]"><AlertCircle size={15} className="mt-0.5 shrink-0" />{loadError}</div>;
  }
  if (!detail) {
    return <div className="px-4 py-5 text-sm text-[#9a958e]">No detail recorded for this chapter.</div>;
  }

  return <ChapterTabs detail={detail} learningOutcomes={learningOutcomes} />;
}

function ChapterTabs({ detail, learningOutcomes }: { detail: ApiChapterDetail; learningOutcomes: ApiLearningOutcome[] }) {
  const [activeTab, setActiveTab] = useState<ChapterTab>('topic');
  const competencyCodes = useMemo(
    () => Array.from(new Set(
      learningOutcomes
        .filter((row) => row.parent_id !== null && row.parent_id !== undefined)
        .map((row) => row.code?.trim() ?? '')
        .filter(Boolean)
    )),
    [learningOutcomes]
  );

  return (
    <div className="border-t border-[#e9e5de] bg-[#faf9f7] px-4 py-5">
      <div className="flex gap-1 border-b border-[#ddd9d2]" role="tablist" aria-label="Chapter details">
        {(['topic', 'competency'] as const).map((tab) => {
          const selected = activeTab === tab;
          return (
            <button
              key={tab}
              id={`chapter-${detail.chapter_id}-${tab}-tab`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`chapter-${detail.chapter_id}-${tab}-panel`}
              onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors ${selected ? 'border-[#2f7dd9] text-[#1761a7]' : 'border-transparent text-[#77716b] hover:text-[#3c3833]'}`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {activeTab === 'topic' ? (
        <TopicTree detail={detail} />
      ) : (
        <CompetencyCodes chapterId={detail.chapter_id} codes={competencyCodes} />
      )}
    </div>
  );
}

/** topic_master owns the outer rows; every concept stays below its topic_id. */
function TopicTree({ detail }: { detail: ApiChapterDetail }) {
  const [openTopicId, setOpenTopicId] = useState<number | null>(null);
  const topics = useMemo(
    // The API orders topic_master rows by topic_sort_order. Retaining that
    // order also keeps null sort values in the database's stable payload order.
    () => detail.topics.filter((topic) => topic.name),
    [detail.topics]
  );
  const conceptsByTopic = useMemo(() => {
    const groups = new Map<number, ApiChapterDetail['concepts']>();
    detail.concepts.forEach((concept) => {
      if (concept.topic_id === null) return;
      const group = groups.get(concept.topic_id) ?? [];
      group.push(concept);
      groups.set(concept.topic_id, group);
    });
    return groups;
  }, [detail.concepts]);
  const unassignedConcepts = useMemo(
    () => detail.concepts.filter((concept) => concept.topic_id === null || !topics.some((topic) => topic.topic_id === concept.topic_id)),
    [detail.concepts, topics]
  );

  return (
    <div id={`chapter-${detail.chapter_id}-topic-panel`} role="tabpanel" aria-labelledby={`chapter-${detail.chapter_id}-topic-tab`} className="pt-4">
      <SectionHeading>Topics ({topics.length})</SectionHeading>
      {topics.length === 0 ? <NotProvided label="No topic_master rows have been recorded for this chapter." /> : null}
      <div className="space-y-2">
        {topics.map((topic, index) => {
          const concepts = conceptsByTopic.get(topic.topic_id) ?? [];
          const isOpen = openTopicId === topic.topic_id;
          return (
            <div key={topic.topic_id} className="overflow-hidden rounded-lg border border-[#e5e1da] bg-white">
              <button
                type="button"
                onClick={() => setOpenTopicId(isOpen ? null : topic.topic_id)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#faf9f7]"
              >
                {isOpen ? <ChevronDown size={15} className="mt-0.5 shrink-0 text-[#8a847d]" /> : <ChevronRight size={15} className="mt-0.5 shrink-0 text-[#8a847d]" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[#2d2924]">{index + 1}. {topic.name}</span>
                  {topic.description ? <span className="mt-1 block text-xs leading-relaxed text-[#706b64]">{topic.description}</span> : null}
                </span>
                <span className="shrink-0 rounded-full bg-[#efeeec] px-2 py-0.5 text-[11px] text-[#706b64]">{concepts.length} {concepts.length === 1 ? 'concept' : 'concepts'}</span>
              </button>
              {isOpen ? <ConceptList concepts={concepts} /> : null}
            </div>
          );
        })}
      </div>
      {unassignedConcepts.length > 0 ? (
        <div className="mt-3">
          <SectionHeading>Unassigned concepts ({unassignedConcepts.length})</SectionHeading>
          <ConceptList concepts={unassignedConcepts} />
        </div>
      ) : null}
    </div>
  );
}

function ConceptList({ concepts }: { concepts: ApiChapterDetail['concepts'] }) {
  if (concepts.length === 0) {
    return <p className="border-t border-[#e9e5de] px-3 py-3 text-xs italic text-[#9a958e]">No concepts are mapped to this topic.</p>;
  }

  return (
    <ul className="space-y-1.5 border-t border-[#e9e5de] px-3 py-3">
      {concepts.map((concept) => (
        <li key={concept.concept_id} className="flex gap-2 text-sm text-[#3c3833]">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2f7dd9]" />
          {concept.name}
        </li>
      ))}
    </ul>
  );
}

function CompetencyCodes({ chapterId, codes }: { chapterId: number; codes: string[] }) {
  return (
    <div id={`chapter-${chapterId}-competency-panel`} role="tabpanel" aria-labelledby={`chapter-${chapterId}-competency-tab`} className="pt-4">
      <SectionHeading>Chapter competencies ({codes.length})</SectionHeading>
      {codes.length === 0 ? (
        <NotProvided label="No competency codes are present in this chapter's extraction." />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {codes.map((code) => <li key={code} className="rounded-md bg-[#e8e4fb] px-2.5 py-1 font-mono text-xs font-semibold text-[#473aa5]">{code}</li>)}
        </ul>
      )}
    </div>
  );
}
