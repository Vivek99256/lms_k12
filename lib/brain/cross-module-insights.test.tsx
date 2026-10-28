import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CrossModuleInsightsSection, type CrossModuleResource } from '@/app/enterprise-brain/_components/CrossModuleInsights';
import type { BrainCrossModuleInsight, BrainCrossModulePayload } from './api';

const insight = (over: Partial<BrainCrossModuleInsight> = {}): BrainCrossModuleInsight => ({
  key: 'attendance-vs-results',
  title: 'Attendance and results, class by class',
  kind: 'association',
  status: 'supported',
  period: 'Academic year 2025',
  explanation: 'Across 3 classes there is no clear relationship between attendance and results (rank correlation 0.13).',
  calculation: 'CALC-TEXT',
  limitations: ['LIMIT-ONE', 'LIMIT-TWO'],
  nextStep: 'NEXT-STEP-TEXT',
  sources: [
    { module: 'attendance', label: 'Attendance Intelligence', route: '/attendance/intelligence', tables: ['result_student_attendance_master'] },
    { module: 'result', label: 'Result Intelligence', route: '/result/intelligence', tables: ['result_personalize_marks'] },
  ],
  metrics: { spearman: 0.13, strength: 'none', classesCompared: 3, institutionAttendanceRate: 89.6, institutionMeanPercentage: 74.6, classesBelowOnBoth: 1 },
  rows: [
    { class: 'CBSE-1', attendanceRate: 85, attendanceStudents: 30, resultPercentage: 60, resultStudents: 30 },
    { class: 'CBSE-2', attendanceRate: 90, attendanceStudents: 30, resultPercentage: 75, resultStudents: 30 },
    { class: 'CBSE-3', attendanceRate: 95, attendanceStudents: 30, resultPercentage: 80, resultStudents: 30 },
  ],
  belowOnBoth: ['CBSE-1'],
  coverage: { classesCompared: 3, attendanceOnly: [], resultsOnly: [] },
  ...over,
});

const payload = (over: Partial<BrainCrossModulePayload> = {}): BrainCrossModulePayload => ({
  tenantId: 't', academicYear: { syear: '2025' }, generatedAt: '2026-01-01T00:00:00Z',
  insights: [insight()],
  modules: [{ module: 'attendance', label: 'Attendance', available: true, reason: null }, { module: 'result', label: 'Results', available: true, reason: null }],
  notImplemented: ['NOT-CONNECTED-ONE'],
  ...over,
});

const render = (resource: Partial<CrossModuleResource>) =>
  renderToStaticMarkup(createElement(CrossModuleInsightsSection, {
    resource: { data: null, error: '', loading: false, refreshing: false, refresh: () => {}, ...resource },
  }));

test('a supported insight shows its explanation, figures, chart, calculation, limits, sources, next step and drill-downs', () => {
  const html = render({ data: payload() });
  for (const needle of ['no clear relationship', 'Classes compared', '0.13', 'CALC-TEXT', 'LIMIT-ONE', 'LIMIT-TWO', 'NEXT-STEP-TEXT',
    'result_personalize_marks', 'href="/attendance/intelligence"', 'href="/result/intelligence"', 'NOT-CONNECTED-ONE', 'Academic year 2025']) {
    assert.ok(html.includes(needle), needle);
  }
  assert.equal((html.match(/<circle[^>]*fill-opacity/g) ?? []).length, 3, 'one dot per class');
  assert.ok(html.includes('role="img"'));
});

test('the panel never adds a causal claim of its own', () => {
  const html = render({ data: payload() }).toLowerCase();
  for (const word of ['because', 'caused by', 'leads to', 'results in']) assert.ok(!html.includes(word), word);
});

test('a declined insight shows the reason and no chart or figures', () => {
  for (const status of ['insufficient_data', 'unavailable'] as const) {
    const html = render({ data: payload({ insights: [insight({ status, explanation: 'DECLINED-REASON', metrics: {}, rows: [] })] }) });
    assert.ok(html.includes('DECLINED-REASON'), status);
    assert.ok(!/<circle[^>]*fill-opacity/.test(html) && !html.includes('Rank correlation'), `${status} has nothing invented`);
  }
});

test('a module with no data is named, and unmatched class names raise a data-quality warning', () => {
  const html = render({
    data: payload({
      modules: [{ module: 'attendance', label: 'Attendance', available: false, reason: 'NO-ATT-REASON' }, { module: 'result', label: 'Results', available: true, reason: null }],
      insights: [insight({ coverage: { classesCompared: 3, attendanceOnly: ['Std 7'], resultsOnly: ['7'] } })],
    }),
  });
  assert.ok(html.includes('NO-ATT-REASON'));
  assert.ok(html.includes('Data-quality warning') && html.includes('Std 7'));
});

test('loading shows a loading note; an error shows the message with Try again; both are quiet once data exists', () => {
  assert.ok(render({ loading: true }).includes('Reading attendance and results'));
  const err = render({ error: 'API-DOWN' });
  assert.ok(err.includes('API-DOWN') && err.includes('Try again'));
  const stale = render({ data: payload(), error: 'API-DOWN' });
  assert.ok(!stale.includes('Try again'), 'existing data is kept rather than replaced by an error');
});
