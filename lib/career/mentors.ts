import type { MentorSuggestionsPayload } from '@/app/career-intelligence/_lib/types';

/**
 * Honest copy for every state of the "Suggested mentors" section. Returns null
 * when there are mentors to show, so the caller renders the list instead.
 */
export function mentorEmptyMessage(payload: MentorSuggestionsPayload | null): string | null {
  if (!payload) return 'Mentor suggestions could not be loaded.';
  if (!payload.crosswalk_ready || payload.reason === 'crosswalk_not_ready') {
    return 'Mentor matching is not set up yet.';
  }
  if (payload.mentors.length > 0) return null;
  switch (payload.reason) {
    case 'no_requirements':
      return 'No skill or knowledge requirements are on record for this career.';
    case 'no_mapped_skills':
      return 'No staff skills are mapped to this career yet.';
    case 'no_matching_staff':
      return 'Skills are mapped to this career, but no active staff member holds them yet.';
    default:
      return 'No staff skills are mapped to this career yet.';
  }
}

/** "62.5" -> "63%", clamped to 0-100 so a bad payload cannot render nonsense. */
export function formatMentorScore(score: number): string {
  const safe = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
  return `${Math.round(safe)}%`;
}
