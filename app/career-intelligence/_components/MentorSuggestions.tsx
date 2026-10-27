'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatMentorScore, mentorEmptyMessage } from '@/lib/career/mentors';
import { loadMentorSuggestions } from '../_lib/api';
import type { MentorSuggestionsPayload } from '../_lib/types';

/**
 * "Suggested mentors": active staff whose People & Competency skills HR has
 * mapped to this career's O*NET skill/knowledge requirements. The score is the
 * importance-weighted share of the career's requirements the person covers.
 * Shows names and job titles only.
 */
export function MentorSuggestions({ occupationCode }: { occupationCode: string | null }) {
  const [payload, setPayload] = useState<MentorSuggestionsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!occupationCode) return undefined;
    let cancelled = false;
    // The request owns the loading, error, and response state for this section.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');
    loadMentorSuggestions(occupationCode)
      .then((data) => { if (!cancelled) setPayload(data); })
      .catch((err) => {
        if (!cancelled) {
          setPayload(null);
          setError(err instanceof Error ? err.message : 'Mentor suggestions could not be loaded.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [occupationCode]);

  const emptyMessage = occupationCode
    ? (error || mentorEmptyMessage(payload))
    : 'Set a career aspiration to see suggested mentors.';

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Suggested mentors</h3>
          <Badge variant="outline">Staff</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Staff whose skills HR has linked to what this career requires. The score is the share of the
          career&apos;s skill and knowledge requirements (weighted by importance) they cover.
        </p>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />Finding mentors…
          </div>
        )}
        {!loading && emptyMessage && <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
        {!loading && !emptyMessage && payload && (
          <ul className="space-y-3">
            {payload.mentors.map((mentor) => (
              <li key={mentor.staff_id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{mentor.name}</p>
                    {mentor.job_title && <p className="text-xs text-muted-foreground">{mentor.job_title}</p>}
                  </div>
                  <Badge variant="secondary">{formatMentorScore(mentor.score)} match</Badge>
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {mentor.matched_skills.map((skill) => (
                    <li key={`${skill.skill_id}-${skill.element_id}`}>
                      <span className="font-medium text-foreground">{skill.skill_title}</span>
                      {' → '}
                      {skill.element_name} ({skill.element_type}, importance {skill.importance})
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
