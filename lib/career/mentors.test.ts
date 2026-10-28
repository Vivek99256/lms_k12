import test from 'node:test';
import assert from 'node:assert/strict';

import type { MentorSuggestionsPayload } from '@/app/career-intelligence/_lib/types';
import { formatMentorScore, mentorEmptyMessage } from './mentors';

const base: MentorSuggestionsPayload = {
  crosswalk_ready: true,
  occupation_code: '00-0000.00',
  reason: null,
  requirement_count: 5,
  mapped_requirement_count: 2,
  mentors: [],
};

test('table not created yet reads as not set up', () => {
  assert.equal(
    mentorEmptyMessage({ ...base, crosswalk_ready: false, reason: 'crosswalk_not_ready' }),
    'Mentor matching is not set up yet.',
  );
});

test('empty crosswalk and empty staff are distinguished', () => {
  assert.equal(
    mentorEmptyMessage({ ...base, reason: 'no_mapped_skills' }),
    'No staff skills are mapped to this career yet.',
  );
  assert.match(mentorEmptyMessage({ ...base, reason: 'no_matching_staff' }) ?? '', /no active staff/);
});

test('no message when mentors exist; null payload is an error message', () => {
  const mentor = { staff_id: 1, name: 'X', job_title: null, score: 50, matched_element_count: 1, matched_skills: [] };
  assert.equal(mentorEmptyMessage({ ...base, mentors: [mentor] }), null);
  assert.ok(mentorEmptyMessage(null));
});

test('score formatting is clamped', () => {
  assert.equal(formatMentorScore(62.5), '63%');
  assert.equal(formatMentorScore(140), '100%');
  assert.equal(formatMentorScore(Number.NaN), '0%');
});
