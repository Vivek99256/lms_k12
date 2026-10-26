/**
 * Sections of a chapter's Videos tab.
 *
 * The section of a video is decided by the server (`video_group`, read from the row's own tag), never from its title.
 * When none of the chapter's videos carries a section the tab stays one flat list, exactly as before; once any does, the
 * videos are shown under the sections below. A video with no section goes under "Other videos", so it is never dropped,
 * and each video appears in exactly one section.
 */
export type VideoGroupKey = 'chapter' | 'concept' | 'morning-circle' | 'sustainable-cities';

interface GroupDefinition {
  key: VideoGroupKey;
  label: string;
  /** Shown when the section has no videos. Only set for a section that is always listed. */
  emptyMessage?: string;
}

export const VIDEO_GROUPS: readonly GroupDefinition[] = [
  { key: 'chapter', label: 'Chapter video' },
  { key: 'concept', label: 'Concept videos' },
  { key: 'morning-circle', label: 'Morning circle videos' },
  { key: 'sustainable-cities', label: 'Sustainable cities videos', emptyMessage: 'No sustainable cities videos have been added for this chapter yet.' },
];

export const OTHER_VIDEOS_LABEL = 'Other videos';

export interface VideoSection<T> {
  key: VideoGroupKey | 'other';
  label: string;
  items: T[];
  emptyMessage?: string;
}

function isGroupKey(value: unknown): value is VideoGroupKey {
  return VIDEO_GROUPS.some((group) => group.key === value);
}

/**
 * The sections to show for these videos, or null when none of them has a section (keep the flat list).
 * A section with no videos is listed only if it has an empty message; videos keep their incoming order.
 */
export function groupVideos<T extends { videoGroup?: string | null }>(videos: readonly T[]): VideoSection<T>[] | null {
  if (!videos.some((video) => isGroupKey(video.videoGroup))) return null;
  const sections: VideoSection<T>[] = VIDEO_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    items: videos.filter((video) => video.videoGroup === group.key),
    emptyMessage: group.emptyMessage,
  })).filter((section) => section.items.length > 0 || section.emptyMessage !== undefined);
  const others = videos.filter((video) => !isGroupKey(video.videoGroup));
  if (others.length > 0) sections.push({ key: 'other', label: OTHER_VIDEOS_LABEL, items: others });
  return sections;
}
