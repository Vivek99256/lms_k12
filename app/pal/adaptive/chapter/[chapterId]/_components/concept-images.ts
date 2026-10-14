import { useEffect, useState } from 'react';
import { appendCommonParams, buildSessionContext, createAuthHeaders } from '@/lib/erp-client';

/**
 * Curated high-resolution educational fallback images for concepts.
 * Deterministically selected by concept id/index so each concept has a stable,
 * gorgeous, high-context visual representation.
 */
export const EDUCATIONAL_FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=600&q=80', // Math graph / blackboard
  'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=80', // Notebook / exam paper
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80', // Strategy / analytical chart
  'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80', // Library / structured books
  'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?auto=format&fit=crop&w=600&q=80', // Geometric math tools & blocks
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80', // Modern digital learning
  'https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&w=600&q=80', // Learning desk with equations
  'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80', // Teacher blackboard diagram
  'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=600&q=80', // Structured planning board
  'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80', // Textbook & stationery
  'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=600&q=80', // Mathematical curves & symmetry
  'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=600&q=80', // Modern classroom learning
];

// In-memory cache across concept visits
const imageCache = new Map<string, string | null>();

export function getFallbackImage(conceptId: string | number, index: number = 0): string {
  const numericId = typeof conceptId === 'number' ? conceptId : parseInt(conceptId, 10);
  const offset = isNaN(numericId) ? index : numericId;
  return EDUCATIONAL_FALLBACK_IMAGES[Math.abs(offset) % EDUCATIONAL_FALLBACK_IMAGES.length];
}

/**
 * Fetch a concept's dynamic image via `GET /lms/pal/learn/concept/{conceptId}/image`.
 * If Openverse image exists, returns it; otherwise returns null.
 */
export async function fetchConceptImage(
  conceptId: string | number,
  signal?: AbortSignal
): Promise<string | null> {
  const key = String(conceptId);
  if (imageCache.has(key)) {
    return imageCache.get(key) ?? null;
  }

  try {
    const ctx = buildSessionContext();
    if (!ctx.baseUrl) return null;

    const search = new URLSearchParams();
    appendCommonParams(search, ctx);
    if (ctx.userId) search.set('user_id', ctx.userId);

    const res = await fetch(
      `${ctx.baseUrl}/lms/pal/learn/concept/${conceptId}/image?${search.toString()}`,
      {
        headers: {
          ...createAuthHeaders(ctx),
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal,
      }
    );

    if (!res.ok) {
      imageCache.set(key, null);
      return null;
    }

    const payload = await res.json();
    const url = payload?.image?.thumbnail_url || payload?.image?.url || null;
    imageCache.set(key, url);
    return url;
  } catch {
    imageCache.set(key, null);
    return null;
  }
}

/**
 * React hook to retrieve a concept's dynamic image with fallback.
 */
export function useConceptImage(conceptId: string | number, index: number = 0): {
  imageUrl: string;
  isDynamic: boolean;
  loading: boolean;
} {
  const fallback = getFallbackImage(conceptId, index);
  const [imageUrl, setImageUrl] = useState<string>(() => imageCache.get(String(conceptId)) || fallback);
  const [isDynamic, setIsDynamic] = useState<boolean>(() => Boolean(imageCache.get(String(conceptId))));
  const [loading, setLoading] = useState<boolean>(() => !imageCache.has(String(conceptId)));

  useEffect(() => {
    const key = String(conceptId);
    if (imageCache.has(key)) {
      const cached = imageCache.get(key);
      setImageUrl(cached || fallback);
      setIsDynamic(Boolean(cached));
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    fetchConceptImage(conceptId, controller.signal).then((dynamicUrl) => {
      if (controller.signal.aborted) return;
      if (dynamicUrl) {
        setImageUrl(dynamicUrl);
        setIsDynamic(true);
      } else {
        setImageUrl(fallback);
        setIsDynamic(false);
      }
      setLoading(false);
    });

    return () => controller.abort();
  }, [conceptId, fallback]);

  return { imageUrl, isDynamic, loading };
}
