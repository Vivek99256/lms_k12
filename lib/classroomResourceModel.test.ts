import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildApiChapterContentItems,
  contentMatchesTab,
  contentSourceOptions,
  contentTabCounts,
  itemsForActiveLane,
  itemsInLane,
  tabsForLane,
  visibleContentTabs,
} from '../app/course-master/[courseId]/chapters/classroomResourceModel';
import { showsInLane } from './classroomResources';

/**
 * The student Subject section and the admin chapter page build a chapter's list with the SAME functions. These tests pin
 * the rules both rely on, using rows shaped like `lms-chapter-content` answers.
 */
const asset = (over: Record<string, unknown>) =>
  ({ id: 1, title: 'Untitled', content_category: '', file_type: 'pdf', filename: '', source: 'Claude AI', created_at: '2026-10-01 10:00:00', concept_id: null, ...over }) as never;

const CATEGORIES = {
  'Classroom Presentation': [asset({ id: 10, title: 'Water deck', content_category: 'Classroom Presentation', file_type: 'pptx', filename: 'water.pptx' })],
  'Revision Notes': [asset({ id: 11, title: 'Water notes', content_category: 'Revision Notes' })],
  'Classroom Activity': [asset({ id: 12, title: 'Water activity', content_category: 'Classroom Activity' })],
  'Remedial Class': [asset({ id: 13, title: 'Water remedial', content_category: 'Remedial Class' })],
  Worksheet: [asset({ id: 14, title: 'Water worksheet', content_category: 'Worksheet' })],
  'Lesson Plan': [asset({ id: 15, title: 'Water lesson plan', content_category: 'Lesson Plan' })],
  'Vocabulary Cards': [asset({ id: 16, title: 'Water vocabulary', content_category: 'Vocabulary Cards' })],
  'Flash Cards': [asset({ id: 17, title: 'glacier', content_category: '' })],
  'Teacher Training': [asset({ id: 18, title: 'Teacher training: water', content_category: 'Teacher Training' })],
  Videos: [asset({ id: 19, title: 'Water video', content_category: 'Videos', file_type: 'mp4', filename: 'water.mp4' })],
};

const chapter = { id: '8592', title: 'Exploration' };

test('every category row becomes one card, in the order the server sent them', () => {
  const items = buildApiChapterContentItems(chapter, CATEGORIES);
  assert.deepEqual(items.map((i) => i.id), ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19']);
  assert.deepEqual(
    items.map((i) => i.type),
    ['Classroom presentation', 'Revision notes', 'Classroom activity', 'Remedial class', 'Worksheet', 'Lesson plan', 'Vocabulary cards', 'Flash cards', 'Teacher training', 'Video']
  );
});

test('the classroom lane drops teacher training and single-word flash cards, and keeps the vocabulary deck', () => {
  const items = buildApiChapterContentItems(chapter, CATEGORIES);
  const lane = itemsForActiveLane(items, { lane: 'classroom', search: '', source: 'all', showsInLane: (i) => showsInLane(i, 'classroom') });
  const titles = lane.map((i) => i.title);
  assert.ok(!titles.includes('Teacher training: water'));
  assert.ok(!titles.includes('glacier'));
  assert.ok(titles.includes('Water vocabulary'));
  assert.equal(lane.length, 8);
});

test('the lane filter alone keeps flash cards (audience neutral); the lane rule is what hides them', () => {
  const items = buildApiChapterContentItems(chapter, CATEGORIES);
  assert.ok(itemsInLane(items, 'classroom').some((i) => i.type === 'Flash cards'));
  assert.ok(!itemsInLane(items, 'classroom').some((i) => i.type === 'Teacher training'));
  assert.ok(itemsInLane(items, 'teacher').some((i) => i.type === 'Teacher training'));
});

test('tabs show only where the chapter has something, and every type has a tab to appear under', () => {
  const items = buildApiChapterContentItems(chapter, CATEGORIES);
  const lane = itemsForActiveLane(items, { lane: 'classroom', search: '', source: 'all', showsInLane: (i) => showsInLane(i, 'classroom') });
  const tabs = tabsForLane('classroom');
  const counts = contentTabCounts(lane, tabs);
  const visible = visibleContentTabs(tabs, counts, 'All content');

  assert.equal(counts['All content'], 8);
  assert.equal(counts['Presentations'], 1);
  assert.equal(counts['Videos'], 1);
  assert.equal(counts['Revision notes'], 1);
  assert.equal(counts['Classroom activity'], 1);
  assert.equal(counts['Remedial class'], 1);
  assert.equal(counts['Worksheet'], 1);
  assert.equal(counts['Lesson plan'], 1);
  assert.equal(counts['Vocabulary cards'], 1);
  // The tabs a chapter has nothing under are not offered; 'All content' and 'Prayogshala' always stay.
  assert.ok(!visible.includes('Educational Posters'));
  assert.ok(!visible.includes('Interactive'));
  assert.ok(visible.includes('All content'));
  assert.ok(visible.includes('Prayogshala'));
  // Every lane item is reachable from at least one tab: nothing is stranded.
  for (const item of lane) {
    assert.ok(tabs.some((tab) => tab !== 'All content' && contentMatchesTab(item, tab)), `${item.title} has no tab`);
  }
});

test('the tab the student stands on is kept even when it is empty', () => {
  const tabs = tabsForLane('classroom');
  const visible = visibleContentTabs(tabs, { 'All content': 3, Worksheet: 0 }, 'Worksheet');
  assert.ok(visible.includes('Worksheet'));
});

test('search and source narrow the lane exactly as on the admin page', () => {
  const items = buildApiChapterContentItems(chapter, CATEGORIES);
  const rule = (i: { type: string }) => showsInLane(i, 'classroom');
  assert.equal(itemsForActiveLane(items, { lane: 'classroom', search: 'remedial', source: 'all', showsInLane: rule }).length, 1);
  assert.equal(itemsForActiveLane(items, { lane: 'classroom', search: '', source: 'Uploaded', showsInLane: rule }).length, 0);
  assert.deepEqual(contentSourceOptions(itemsInLane(items, 'classroom')), ['Claude AI']);
});
