import { appendCommonParams, buildSessionContext, createAuthHeaders } from '@/lib/erp-client';

import type { JourneyStageKey } from '../_components/JourneyRail';

/**
 * The image-based "Your Journey" map.
 *
 *   GET /lms/pal/journey/images?chapter_id=&concept_id=   palController@journeyImages
 *
 * ---------------------------------------------------------------------------
 * WHY THIS LIVES BEHIND ITS OWN ENDPOINT RATHER THAN TEN IMAGE CALLS
 * ---------------------------------------------------------------------------
 * `palController@learnConceptImage` already answers "one picture for this
 * concept". The journey map needs the same answer asked ten times, once per
 * stage, and — critically — it needs them as ONE payload: the map is a single
 * screen that must not render as a staircase of tiles popping in one at a time
 * while eleven separate requests race each other. The server resolves
 * subject, chapter and concept from whichever single id it is given, searches
 * each stage's own terms, and caches the whole map server-side, so this is one
 * request on the second visit too and not eleven.
 *
 * ---------------------------------------------------------------------------
 * `chapterId` XOR `conceptId`, AND THE UI KNOWS WHICH IT HAS
 * ---------------------------------------------------------------------------
 * The journey rail sits on both chapter-scoped screens (diagnostic, adaptive
 * chapter, plan, mastery chapter) and concept-scoped ones (learn, feedback,
 * intervention, mastery concept, adaptive concept). A chapter screen knows its
 * `chapterId`; a concept screen knows its `conceptId` and usually also carries
 * `?chapterId=` in the URL. Both are sent when known — the server uses the
 * concept as the topic anchor and the chapter for the subject, so a concept
 * screen gets the sharper map. With neither, the request is still made and
 * comes back well-formed with null images: a journey that cannot be pictured
 * is still a journey, and the map renders as icons rather than as an error.
 *
 * ---------------------------------------------------------------------------
 * NOTHING HERE IS A FALLBACK-ONLY OPTIONAL
 * ---------------------------------------------------------------------------
 * `image` is `null` on an ordinary basis — the search is deliberately strict
 * (a confidently wrong picture is worse than none, see
 * `pal_content.image.external.min_score`). Callers must render the null case as
 * a designed state, not as a loading failure. `stageSpecific` is reported
 * separately for exactly this reason: it distinguishes a node that found a
 * picture for ITS OWN step from one showing its chapter's image as a
 * stand-in, and the UI labels the difference rather than implying both depict
 * the step equally well.
 */

/**
 * One openly-licensed image, already reduced on the server to the eight fields
 * the UI may show — the same shape `learnConceptImage` returns, so there is one
 * image type in this app for both the Learn page and the journey map.
 *
 * `license` and `attribution` are not decoration: the design system requires a
 * visible credit next to any third-party picture, and Openverse exists
 * precisely so that credit is real.
 */
export interface JourneyImage {
  url: string | null;
  thumbnailUrl: string | null;
  title: string | null;
  sourceUrl: string | null;
  creator: string | null;
  license: string | null;
  attribution: string | null;
}

/**
 * How a node's picture was actually chosen, so the UI can say so rather than
 * let the picture imply it.
 *
 *   `stage_and_topic` - the picture was found for THIS stage's words AND its
 *     own metadata names this learner's chapter, concept or subject. This is
 *     the only tier that is genuinely both of the things the feature promises.
 *   `stage`           - found for this stage's words and on-topic for this
 *     chapter. Shows the step; its topic connection is the weaker of the two.
 *   `chapter`         - no picture was found for this step, so the node is
 *     showing the chapter's own picture as a stand-in.
 *
 * `chapter` is common, and it is not a failure to hide: the strict relevance
 * floor and the two gates exist precisely so a learner is never shown a
 * confidently wrong picture, and the corpus of openly-licensed images simply
 * does not contain a chemistry worksheet, a chemistry flashcard and a chemistry
 * badge. Overstating coverage would mean showing a photo of coffee and books
 * under "Learn". The UI reports this tier in words instead.
 */
export type JourneyImageMatch = 'stage_and_topic' | 'stage' | 'chapter';

export interface JourneyStageImage {
  image: JourneyImage | null;
  /** The search query that actually found it. Shown, not hidden. */
  query: string | null;
  /** False when this node is showing the chapter's own image as a stand-in. */
  stageSpecific: boolean;
  match: JourneyImageMatch;
}

export interface JourneyImageMapPayload {
  subject: string | null;
  chapter: string | null;
  concept: string | null;
  standard: string | null;
  poster: JourneyImage | null;
  posterQuery: string | null;
  /**
   * Keyed by stage, ordered as the journey is. Every stage is always present,
   * with `image: null` when nothing usable was found — the map's shape never
   * depends on what a search engine returned today.
   */
  stages: Partial<Record<JourneyStageKey, JourneyStageImage>>;
}

/** All ten, in journey order. Mirrors `JOURNEY_STAGES` and the server's `STAGES`. */
export const JOURNEY_MAP_STAGE_ORDER: JourneyStageKey[] = [
  'diagnostic',
  'adaptive',
  'plan',
  'learn',
  'practice',
  'feedback',
  'check',
  'intervention',
  'mastery',
  'recall',
];

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function readImage(value: unknown): JourneyImage | null {
  const row = toRecord(value);
  const url = text(row.url);
  // A row with no usable URL is not an image. Treating it as one would
  // produce a broken <img> where the icon fallback belongs.
  if (!url) return null;

  return {
    url,
    thumbnailUrl: text(row.thumbnail_url) ?? url,
    title: text(row.title),
    sourceUrl: text(row.source_url) ?? url,
    creator: text(row.creator),
    license: text(row.license),
    attribution: text(row.attribution),
  };
}

function readStage(value: unknown): JourneyStageImage {
  const row = toRecord(value);
  const match = text(row.match);
  return {
    image: readImage(row.image),
    query: text(row.query),
    stageSpecific: row.stage_specific === true,
    match:
      match === 'stage_and_topic' || match === 'stage' || match === 'chapter' ? match : 'chapter',
  };
}

/**
 * Fetch the map. Returns null when the request itself failed, which is the one
 * thing the caller must distinguish from "no pictures today" — so the map can
 * show a retry rather than an empty journey.
 *
 * Never throws: a failed request resolves to null and the caller renders the
 * journey with icons.
 */
export async function fetchJourneyImages(
  input: { chapterId?: string | number | null; conceptId?: string | number | null },
  signal?: AbortSignal
): Promise<JourneyImageMapPayload | null> {
  try {
    const ctx = buildSessionContext();
    if (!ctx.baseUrl) return null;

    const search = new URLSearchParams();
    appendCommonParams(search, ctx);
    if (ctx.userId) search.set('user_id', ctx.userId);
    if (input.chapterId) search.set('chapter_id', String(input.chapterId));
    if (input.conceptId) search.set('concept_id', String(input.conceptId));

    const response = await fetch(`${ctx.baseUrl}/lms/pal/journey/images?${search.toString()}`, {
      headers: {
        ...createAuthHeaders(ctx),
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal,
    });

    if (!response.ok) return null;

    const payload = toRecord(await response.json());
    const rawStages = toRecord(payload.stages);

    const stages: Partial<Record<JourneyStageKey, JourneyStageImage>> = {};
    for (const stage of JOURNEY_MAP_STAGE_ORDER) {
      if (rawStages[stage] !== undefined) {
        stages[stage] = readStage(rawStages[stage]);
      }
    }

    return {
      subject: text(payload.subject),
      chapter: text(payload.chapter),
      concept: text(payload.concept),
      standard: text(payload.standard),
      poster: readImage(payload.poster),
      posterQuery: text(payload.poster_query),
      stages,
    };
  } catch {
    return null;
  }
}