import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapBucket, type ActivitySection } from '@/app/lms/data/activityStream';

/**
 * React keys in the Activity Stream.
 *
 * ── THE BUG THIS PINS ───────────────────────────────────────────────────────
 *
 * The console reported `Encountered two children with the same key,
 * class_schedule-16425`, and 16425 is not a timetable row — it is
 * `period.id`, "Period-1", 08:00–08:45.
 *
 * `lmsActivityStreamController` builds the section as
 *
 *     DB::table('timetable as tt')->join('period as p', …)
 *       ->selectRaw("tt.*,p.*, …")
 *
 * and both tables have an `id` column. `p.*` is selected second, so the
 * period's id overwrites the timetable row's id in every fetched record and the
 * whole section is emitted carrying `id = period.id`. Six columns collide that
 * way; the timetable columns that survive are precisely the ones identifying
 * the slot — `standard_id`, `division_id`, `subject_id`, `teacher_id`,
 * `period_id`, `week_day`.
 *
 * So every class taught in the same period on the same day arrived with the
 * same `id`, and the old key — `${section}-${id}` — collapsed them. At one
 * institute that is eleven distinct classes on a single Monday.
 *
 * ── WHAT A FIX MAY NOT DO ───────────────────────────────────────────────────
 *
 * Those eleven rows are ELEVEN REAL ACTIVITIES. Deduplicating them, dropping
 * them or merging them would have made the warning disappear by deleting a
 * teacher's timetable from their own screen. The tests below therefore assert
 * uniqueness AND survival together — every row in, every row out, in order.
 */

/** One `class_schedule` row as the API actually emits it: `id` is the PERIOD's. */
function scheduleRow(overrides: Record<string, unknown> = {}) {
  return {
    // The period's columns, which win the collision.
    id: 16425,
    title: 'Period-1',
    short_name: 'P-1',
    start_time: '08:00:00',
    end_time: '08:45:00',
    sort_order: 1,
    // The timetable columns that survive it.
    syear: 2021,
    week_day: 'M',
    period_id: 16425,
    standard_id: 36,
    division_id: 9,
    subject_id: 3976,
    teacher_id: 10038,
    batch_id: 0,
    // Resolved names the controller adds.
    standard: 'Grade 5',
    division: 'A',
    ...overrides,
  };
}

function keysOf(sections: ActivitySection[], sectionKey: string): string[] {
  const section = sections.find((s) => s.key === sectionKey);
  assert.ok(section, `No "${sectionKey}" section was produced.`);
  return section.items.map((item) => item.key);
}

test('class_schedule rows sharing one period id get unique keys and all survive', () => {
  // Eleven classes in Period-1 on the same Monday — the real shape of the
  // reported collision. Every one is a different class, division, subject or
  // teacher.
  const rows = [
    scheduleRow({ standard_id: 36, division_id: 9, subject_id: 3976, teacher_id: 10038 }),
    scheduleRow({ standard_id: 39, division_id: 11, subject_id: 4123, teacher_id: 7028 }),
    scheduleRow({ standard_id: 39, division_id: 9, subject_id: 3976, teacher_id: 7028 }),
    scheduleRow({ standard_id: 40, division_id: 9, subject_id: 3975, teacher_id: 12483 }),
    scheduleRow({ standard_id: 41, division_id: 10, subject_id: 3975, teacher_id: 12483 }),
    scheduleRow({ standard_id: 42, division_id: 10, subject_id: 4001, teacher_id: 9001 }),
    scheduleRow({ standard_id: 43, division_id: 12, subject_id: 4002, teacher_id: 9002 }),
    scheduleRow({ standard_id: 44, division_id: 12, subject_id: 4003, teacher_id: 9003 }),
    scheduleRow({ standard_id: 45, division_id: 13, subject_id: 4004, teacher_id: 9004 }),
    scheduleRow({ standard_id: 46, division_id: 13, subject_id: 4005, teacher_id: 9005 }),
    scheduleRow({ standard_id: 47, division_id: 14, subject_id: 4006, teacher_id: 9006 }),
  ];

  const keys = keysOf(mapBucket({ class_schedule: rows }), 'class_schedule');

  // NOTHING WAS DROPPED. This assertion is the reason the fix is a key change
  // and not a deduplication.
  assert.equal(keys.length, rows.length, 'An activity was lost while making keys unique.');

  assert.equal(
    new Set(keys).size,
    rows.length,
    `Duplicate sibling keys remain: ${keys.filter((k, i) => keys.indexOf(k) !== i).join(', ')}`,
  );

  // And specifically: the reported key is no longer emitted bare.
  assert.ok(
    !keys.includes('class_schedule-16425'),
    'The colliding key `class_schedule-16425` is still being produced.',
  );
});

test('the same source id under a different legitimate context stays two visible activities', () => {
  // One teacher, one subject, one class — the SAME period id — taught on two
  // different weekdays. Two legitimately different activities that the old key
  // collapsed into one.
  const rows = [
    scheduleRow({ week_day: 'M' }),
    scheduleRow({ week_day: 'W' }),
  ];

  const sections = mapBucket({ class_schedule: rows });
  const keys = keysOf(sections, 'class_schedule');

  assert.equal(keys.length, 2, 'A legitimately distinct activity was removed.');
  assert.notEqual(keys[0], keys[1], 'Two different weekdays produced the same key.');

  // Both remain renderable with their own content.
  const items = sections[0].items;
  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.title.length > 0));
});

test('keys are deterministic across repeated transformations of the same payload', () => {
  // A key that changed between renders would remount every row on every
  // refresh, which is the failure mode Math.random() keys produce.
  const payload = {
    class_schedule: [
      scheduleRow({ standard_id: 36 }),
      scheduleRow({ standard_id: 39 }),
      scheduleRow({ standard_id: 40 }),
    ],
  };

  assert.deepEqual(
    keysOf(mapBucket(payload), 'class_schedule'),
    keysOf(mapBucket(payload), 'class_schedule'),
  );
});

test('keys carry no random or positional component as their primary identity', () => {
  // Reordering the rows must NOT change any row's key: a key derived from
  // array position would shift, and a random key would differ outright.
  const a = scheduleRow({ standard_id: 36, division_id: 9 });
  const b = scheduleRow({ standard_id: 39, division_id: 11 });
  const c = scheduleRow({ standard_id: 40, division_id: 12 });

  const forwards = keysOf(mapBucket({ class_schedule: [a, b, c] }), 'class_schedule');
  const backwards = keysOf(mapBucket({ class_schedule: [c, b, a] }), 'class_schedule');

  assert.deepEqual(
    [...forwards].sort(),
    [...backwards].sort(),
    'A row’s key changed when the list was reordered, so it is positional rather than identity-derived.',
  );
});

test('two genuinely identical payload rows both survive with distinct keys', () => {
  // The backstop. If a section this transformation does not yet enumerate ever
  // emits two rows that are identical in every field it reads, both must still
  // render — a duplicate-looking record may still be a real second activity,
  // and this layer is not entitled to decide otherwise.
  const identical = scheduleRow();
  const keys = keysOf(mapBucket({ class_schedule: [identical, { ...identical }] }), 'class_schedule');

  assert.equal(keys.length, 2, 'A duplicate-looking activity was silently dropped.');
  assert.notEqual(keys[0], keys[1]);
});

test('a row carrying no usable identity at all still gets a unique key', () => {
  const keys = keysOf(mapBucket({ class_schedule: [{}, {}, {}] }), 'class_schedule');

  assert.equal(keys.length, 3);
  assert.equal(new Set(keys).size, 3);
});

test('other sections keep their own id-based keys and stay independent', () => {
  // Homework rows carry a real unique `id`, so the key stays the record's own
  // identifier — the fix must not have made every key composite.
  const sections = mapBucket({
    class_schedule: [scheduleRow({ standard_id: 36 })],
    homework: [
      { id: 501, title: 'Fractions worksheet', standard: 'Grade 5', division: 'A' },
      { id: 502, title: 'Reading log', standard: 'Grade 5', division: 'A' },
    ],
  });

  assert.deepEqual(keysOf(sections, 'homework'), ['homework-501', 'homework-502']);

  // A section is a separate <ul>, so keys only have to be unique within one.
  // Sections still carry their own prefix, which keeps them readable.
  const scheduleKeys = keysOf(sections, 'class_schedule');
  assert.ok(scheduleKeys.every((key) => key.startsWith('class_schedule-')));
});

test('ordering and content are untouched by the key fix', () => {
  const rows = [
    scheduleRow({ standard: 'Grade 5', division: 'A', standard_id: 36, start_time: '08:00:00' }),
    scheduleRow({ standard: 'Grade 6', division: 'B', standard_id: 39, start_time: '08:00:00' }),
    scheduleRow({ standard: 'Grade 7', division: 'C', standard_id: 40, start_time: '08:00:00' }),
  ];

  const items = mapBucket({ class_schedule: rows }).find((s) => s.key === 'class_schedule')!.items;

  // Same order in as out, and the rendered fields are unchanged.
  assert.deepEqual(
    items.map((item) => item.chips),
    [
      ['Grade 5', 'A'],
      ['Grade 6', 'B'],
      ['Grade 7', 'C'],
    ],
  );
  assert.ok(items.every((item) => item.title === 'Period-1'));
});
