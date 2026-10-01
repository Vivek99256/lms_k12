import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface ImageResult {
  url: string;
  thumbnailUrl: string;
  title: string;
  creator?: string;
  license?: string;
  attribution?: string;
  provider: string;
}

// In-memory cache for dynamic image search results
const searchCache = new Map<string, { timestamp: number; data: ImageResult }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Semantic intent keywords for each journey stage
const STAGE_KEYWORDS: Record<string, { primary: string[]; fallback: string[]; description: string }> = {
  diagnostic: {
    primary: ['diagnostic assessment test', 'examination questions evaluation'],
    fallback: ['assessment exam', 'test quiz'],
    description: 'Chapter Diagnostic Assessment',
  },
  adaptive: {
    primary: ['concept analysis diagram', 'concept drill breakdown'],
    fallback: ['concept diagram', 'learning analysis'],
    description: 'Concept Diagnostic & Skills',
  },
  plan: {
    primary: ['study plan roadmap curriculum', 'learning path strategy goals'],
    fallback: ['study roadmap strategy', 'curriculum planning'],
    description: 'Personalized Learning Plan',
  },
  learn: {
    primary: ['lesson classroom explanation education', 'textbook theory lecture understanding'],
    fallback: ['lesson learning study', 'classroom education'],
    description: 'Concept Lessons & Theory',
  },
  practice: {
    primary: ['practice problems exercise worksheet', 'problem solving calculation drill'],
    fallback: ['practice exercise worksheet', 'problem solving homework'],
    description: 'Adaptive Practice & Exercises',
  },
};

/**
 * Clean up text for web search by removing special chars and stop words.
 */
function cleanTerms(text: string): string {
  return text
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search Openverse for Creative Commons / open web images.
 */
async function searchOpenverse(query: string): Promise<ImageResult | null> {
  try {
    const encoded = encodeURIComponent(query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://api.openverse.org/v1/images/?q=${encoded}&page_size=5`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'TeachConnect-LMS/1.0 (Educational PAL Journey)',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];

    for (const item of results) {
      const url = item?.url;
      if (url && typeof url === 'string' && url.startsWith('http')) {
        return {
          url,
          thumbnailUrl: item.thumbnail || url,
          title: item.title || query,
          creator: item.creator || 'Openverse contributor',
          license: item.license ? `${item.license} ${item.license_version || ''}`.trim() : 'CC',
          attribution: item.attribution || `Image from Openverse (${item.creator || 'unknown'})`,
          provider: 'openverse',
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Search Wikimedia Commons as high-relevance educational fallback.
 */
async function searchWikimedia(query: string): Promise<ImageResult | null> {
  try {
    const encoded = encodeURIComponent(query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encoded}&gsrlimit=5&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`;
    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;

    for (const key of Object.keys(pages)) {
      const page = pages[key];
      const imageinfo = page?.imageinfo?.[0];
      const url = imageinfo?.url;
      const thumb = imageinfo?.thumburl || url;
      if (url && (url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.jpeg') || url.endsWith('.webp'))) {
        const title = (page.title || query).replace(/^File:/, '').replace(/\.[^.]+$/, '');
        return {
          url,
          thumbnailUrl: thumb,
          title,
          creator: imageinfo?.extmetadata?.Artist?.value || 'Wikimedia Commons',
          license: imageinfo?.extmetadata?.LicenseShortName?.value || 'Public Domain / CC',
          attribution: `Wikimedia Commons: ${title}`,
          provider: 'wikimedia',
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Beautiful curated educational fallback images per subject/stage when offline or rate-limited.
 */
function getEducationalFallback(subject: string, chapter: string, stage: string): ImageResult {
  const s = subject.toLowerCase();
  const c = chapter.toLowerCase();

  // Curated high quality Unsplash educational photos for math, science, history, etc.
  const photoPresets: Record<string, string[]> = {
    mathematics: [
      'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1000&q=80', // geometry abstract
      'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1000&q=80', // math blackboard
      'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?auto=format&fit=crop&w=1000&q=80', // calculations
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1000&q=80', // study notes
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1000&q=80', // analytical plan
    ],
    science: [
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1000&q=80', // laboratory
      'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=1000&q=80', // science test
      'https://images.unsplash.com/photo-1518152006812-edab29b069ac?auto=format&fit=crop&w=1000&q=80', // notes
      'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1000&q=80', // biology
      'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=1000&q=80', // research
    ],
    default: [
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1000&q=80', // books
      'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1000&q=80', // study
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=80', // technology
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1000&q=80', // students
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1000&q=80', // exam desk
    ],
  };

  const pool = s.includes('math')
    ? photoPresets.mathematics
    : s.includes('sci') || s.includes('phy') || s.includes('chem') || s.includes('bio')
    ? photoPresets.science
    : photoPresets.default;

  const stageIdx = ['diagnostic', 'adaptive', 'plan', 'learn', 'practice'].indexOf(stage);
  const selectedUrl = pool[stageIdx >= 0 ? stageIdx % pool.length : 0];

  return {
    url: selectedUrl,
    thumbnailUrl: selectedUrl,
    title: `${subject} - ${chapter} (${STAGE_KEYWORDS[stage]?.description || stage})`,
    creator: 'Unsplash Educational Library',
    license: 'Unsplash License',
    attribution: `${subject} ${chapter} - ${stage}`,
    provider: 'educational-library',
  };
}

/**
 * Dynamically search web for a specific journey stage image.
 */
async function findImageForStage(subject: string, chapter: string, stage: string): Promise<ImageResult> {
  const cacheKey = `${subject.toLowerCase()}:${chapter.toLowerCase()}:${stage.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const cleanSubject = cleanTerms(subject || 'General');
  const cleanChapter = cleanTerms(chapter || 'Topic');
  const stageConfig = STAGE_KEYWORDS[stage] || {
    primary: [cleanTerms(stage)],
    fallback: [cleanTerms(stage)],
    description: stage,
  };

  // 1. Try most specific query: Subject + Chapter + Primary stage keywords
  const queriesToTry = [
    `${cleanSubject} ${cleanChapter} ${stageConfig.primary[0]}`,
    `${cleanChapter} ${stageConfig.primary[0]}`,
    `${cleanSubject} ${cleanChapter} ${stageConfig.fallback[0]}`,
    `${cleanChapter} ${stageConfig.fallback[0]}`,
    `${cleanSubject} ${stageConfig.primary[0]}`,
  ];

  for (const query of queriesToTry) {
    // Openverse search
    const openverseHit = await searchOpenverse(query);
    if (openverseHit) {
      searchCache.set(cacheKey, { timestamp: Date.now(), data: openverseHit });
      return openverseHit;
    }

    // Wikimedia Commons search
    const wikiHit = await searchWikimedia(query);
    if (wikiHit) {
      searchCache.set(cacheKey, { timestamp: Date.now(), data: wikiHit });
      return wikiHit;
    }
  }

  // Graceful fallback to rich educational imagery
  const fallback = getEducationalFallback(subject, chapter, stage);
  searchCache.set(cacheKey, { timestamp: Date.now(), data: fallback });
  return fallback;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const subject = searchParams.get('subject') || 'Mathematics';
  const chapter = searchParams.get('chapter') || 'Chapter';
  const stage = searchParams.get('stage');

  if (stage) {
    const image = await findImageForStage(subject, chapter, stage);
    return NextResponse.json({ success: true, stage, image });
  }

  // If no stage provided, fetch all 5 primary journey stages in parallel
  const stages = ['diagnostic', 'adaptive', 'plan', 'learn', 'practice'];
  const results: Record<string, ImageResult> = {};

  await Promise.all(
    stages.map(async (stg) => {
      results[stg] = await findImageForStage(subject, chapter, stg);
    })
  );

  return NextResponse.json({
    success: true,
    subject,
    chapter,
    images: results,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const subject = body?.subject || 'Mathematics';
    const chapter = body?.chapter || 'Chapter';
    const requestedStages = Array.isArray(body?.stages) && body.stages.length > 0
      ? body.stages
      : ['diagnostic', 'adaptive', 'plan', 'learn', 'practice'];

    const results: Record<string, ImageResult> = {};

    await Promise.all(
      requestedStages.map(async (stage: string) => {
        results[stage] = await findImageForStage(subject, chapter, stage);
      })
    );

    return NextResponse.json({
      success: true,
      subject,
      chapter,
      images: results,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to search images' },
      { status: 500 }
    );
  }
}
