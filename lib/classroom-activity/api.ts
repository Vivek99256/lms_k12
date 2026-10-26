import { API_BASE_URL } from '@/app/components/utils/api_url';
import { getRequestContext } from '@/app/course-master/page';
import { readApiJson } from '@/app/h5p/data/h5p';
import { parseClassroomActivity, type ClassroomActivity } from './activity';

export interface LoadedClassroomActivity {
  activity: ClassroomActivity;
  contentId: number;
}

/** The body of `POST /api/lms-classroom-activity`: the chapter, the content item, and the school when it is known. */
export function classroomActivityRequest(chapterId: number, instituteId: number, contentId: number): Record<string, number> {
  return {
    chapter_id: chapterId,
    content_id: contentId,
    ...(Number.isFinite(instituteId) && instituteId > 0 ? { sub_institute_id: instituteId } : {}),
  };
}

export async function loadClassroomActivity(chapterId: number, contentId: number, options: { signal?: AbortSignal } = {}): Promise<LoadedClassroomActivity> {
  const instituteId = Number(getRequestContext()?.sub_institute_id ?? NaN);
  const res = await fetch(`${API_BASE_URL}/api/lms-classroom-activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal,
    body: JSON.stringify(classroomActivityRequest(chapterId, instituteId, contentId)),
  });
  const raw = await readApiJson(res, 'Couldn’t load the activity');

  if (!res.ok || raw.status_code === 0) {
    throw new Error((raw.message as string) || 'Couldn’t load the activity.');
  }

  return { activity: parseClassroomActivity(raw.data), contentId: Number(raw.content_id) || contentId };
}
