import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';

import { correctPredictionIds, variableModelEngine, type LabConfig, type VariableModelParams } from './engines';
import { evaluate } from './expr';
import { divisibilityRule, layoutGroups, multiplesUpTo } from './mathrules';
import { validateLabConfig } from './validate';
import { VariableModelWorkspace } from '../../app/course-master/[courseId]/chapters/PrayogshalaWorkspaces';

/**
 * The six Standard 7 Mathematics "Integers" experiments, proven against independent arithmetic.
 *
 * The fixture is the lab_config of each activity as stored for chapter "Integers" (topics: adding and
 * subtracting integers, multiplying and dividing integers, lowest common multiples, highest common
 * factors, tests for divisibility, square and cube roots). For every control value a student can reach,
 * the displayed result, the picture's inputs and the observation sentence are compared with plain
 * JavaScript maths written here - NOT with the lab's own formulas - so a wrong answer on screen fails.
 */

interface Activity {
  topic_id: number;
  title: string;
  lab_config: LabConfig;
}

const activities: Activity[] = JSON.parse(readFileSync(join(process.cwd(), 'lib/prayogshala/fixtures/integers.labs.json'), 'utf8'));
const byTopic = (id: number) => activities.find((a) => a.topic_id === id)!;
const params = (id: number) => byTopic(id).lab_config.simulation.params as unknown as VariableModelParams;
const run = (id: number, values: Record<string, number>) => variableModelEngine.evaluate(params(id), { values });
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

test('there is one activity for each of the six chapter topics, and each is a valid lab', () => {
  assert.deepEqual(activities.map((a) => a.topic_id), [23734, 23735, 23736, 23737, 23738, 23739]);
  for (const a of activities) {
    assert.deepEqual(validateLabConfig(a.lab_config), [], a.title);
    assert.equal(correctPredictionIds(a.lab_config).length, 1, `${a.title}: exactly one right prediction`);
    assert.equal(a.lab_config.steps.apply.options.filter((o) => o.correct).length, 1, `${a.title}: one right challenge answer`);
  }
});

test('A - adding and subtracting: the marker lands on start +/- k for every start, operation and number', () => {
  for (const start of range(-10, 10)) {
    for (const op of [0, 1]) {
      for (const k of range(-10, 10)) {
        const expected = op === 0 ? start + k : start - k;
        const r = run(23734, { start, op, k });
        assert.equal(r.facts.result, expected, `${start} ${op ? '-' : '+'} ${k}`);
        assert.equal(r.visual!.values.start, start);
        assert.equal(r.visual!.values.move, expected - start, 'the marker hops by the signed move');
        assert.equal(r.visual!.values.lo, -20);
        assert.equal(r.visual!.values.hi, 20);
        assert.ok(expected >= -20 && expected <= 20, 'the answer always fits on the line');
        assert.ok(r.observation.includes(`= ${expected}`) || k === 0 && r.observation.includes(String(expected)), r.observation);
        // The sentence's direction claim agrees with the computed move.
        if (k !== 0 && /moves the marker right/.test(r.observation)) assert.ok(expected > start, r.observation);
        if (k !== 0 && /moves the marker left/.test(r.observation)) assert.ok(expected < start, r.observation);
        if (op === 1 && k < 0) assert.ok(r.observation.includes(`inverse, ${-k}`), r.observation);
      }
    }
  }
});

test('B - multiplying and dividing: the product, its sign, the dots and the quotient are all consistent', () => {
  for (const a of range(-9, 9)) {
    for (const b of range(-9, 9)) {
      for (const mode of [0, 1]) {
        const r = run(23735, { a, b, mode });
        assert.equal(r.facts.p, a * b || 0, "the product; zero is never negative");
        assert.equal(r.visual!.values.groups, Math.abs(a));
        assert.equal(r.visual!.values.size, Math.abs(b));
        assert.equal(r.visual!.values.sign, a * b < 0 ? -1 : 1, 'red dots exactly when the product is negative');
        if (mode === 1 && b === 0) {
          assert.match(r.observation, /cannot divide by 0/);
          assert.deepEqual(r.warnings, ['Division by 0 is not allowed.']);
        } else if (mode === 1) {
          assert.equal(r.facts.q, a, 'the product divided by b gives back a');
          assert.equal(r.facts.q * b, a * b, 'multiplying the quotient by the divisor gives back the dividend');
          assert.ok(r.observation.includes(`= ${a}.`) || r.observation.includes(`= ${a} `), r.observation);
          assert.deepEqual(r.warnings, []);
        } else if (a * b > 0) {
          assert.equal(Math.sign(a), Math.sign(b), 'the text says the signs are the same');
          assert.match(r.observation, /same signs make a positive/);
        } else if (a * b < 0) {
          assert.notEqual(Math.sign(a), Math.sign(b));
          assert.match(r.observation, /different signs make a negative/);
        } else {
          assert.match(r.observation, /times 0 is 0/);
        }
        assert.ok(!r.observation.includes('-0'), `no negative zero: ${r.observation}`);
        if (b === 0) {
          // Undefined is shown as "?", never as a made-up number.
          assert.equal(r.facts.q, undefined);
          assert.equal(r.outputs.find((o) => o.id === 'q')!.text, '?');
        } else {
          assert.ok(Number.isFinite(r.facts.q), 'the quotient is a finite number whenever the divisor is not 0');
        }
      }
    }
  }
});

test('C - lowest common multiple: the markers meet exactly at lcm(m, n), and nowhere earlier', () => {
  for (const m of range(2, 12)) {
    for (const n of range(2, 12)) {
      const r = run(23736, { m, n });
      const expected = lcm(m, n);
      assert.equal(r.facts.l, expected, `lcm(${m}, ${n})`);
      assert.equal(r.visual!.values.common, expected);
      assert.equal(r.visual!.values.limit, expected * 2);
      const rowM = multiplesUpTo(m, expected * 2);
      const rowN = multiplesUpTo(n, expected * 2);
      const both = rowM.filter((v) => rowN.includes(v));
      assert.equal(both[0], expected, 'the first value in both drawn rows is the LCM');
      assert.ok(both.every((v) => v % expected === 0), 'every other common multiple is a multiple of the LCM');
      assert.equal(r.facts.tm * m, expected);
      assert.equal(r.facts.tn * n, expected);
      if (gcd(m, n) === 1 && m !== n) assert.match(r.observation, /their product/);
      assert.ok(r.observation.includes(String(expected)), r.observation);
    }
  }
});

test('D - highest common factor: the groups, leftovers and the HCF match plain arithmetic', () => {
  for (const a of range(6, 48)) {
    for (const b of range(6, 48)) {
      const h = gcd(a, b);
      for (const g of range(1, 24)) {
        const r = run(23737, { a, b, g });
        assert.equal(r.facts.h, h);
        assert.equal(r.facts.ra, a % g);
        assert.equal(r.facts.rb, b % g);
        assert.equal(r.facts.ok, a % g === 0 && b % g === 0 ? 1 : 0);
        assert.equal(r.visual!.values.best, h);
        if (r.facts.ok === 1 && g === h) {
          assert.equal(gcd(r.facts.sa, r.facts.sb), 1, 'the simplified fraction is fully simplified');
          assert.equal(r.facts.sa * h, a);
          assert.equal(r.facts.sb * h, b);
          assert.match(r.observation, /highest common factor/);
        }
        if (r.facts.ok === 1) assert.equal(h % g, 0, 'every common factor divides the HCF');
        if (r.facts.ok === 0) assert.match(r.observation, /not a common factor/);
      }
    }
  }
});

test('D - the equal-grouping drawing places every dot once and leaves exactly total mod size over', () => {
  for (const total of range(0, 72)) {
    for (const size of range(1, 24)) {
      const layout = layoutGroups(total, size);
      const dots = layout.boxes.reduce((t, b) => t + b.dots.length, 0) + layout.loose.length;
      assert.equal(dots, total, `${total} dots in groups of ${size}`);
      assert.equal(layout.groups, Math.floor(total / size));
      assert.equal(layout.leftover, total % size);
      assert.ok(layout.boxes.every((b) => b.dots.length === size), 'every group holds exactly `size` dots');
    }
  }
});

test('E - divisibility: remainder, verdict and the guess feedback are right for every number and divisor', () => {
  for (const n of range(10, 999)) {
    for (const d of range(2, 11)) {
      const rule = divisibilityRule(n, d);
      assert.equal(rule.ok, n % d === 0, `the digit rule for ${d} agrees with real division for ${n}`);
      for (const guess of [0, 1]) {
        const r = run(23738, { n, d, guess });
        const divisible = n % d === 0;
        assert.equal(r.facts.r, n % d);
        assert.equal(r.facts.ok, divisible ? 1 : 0);
        assert.equal(r.facts.right, guess === (divisible ? 1 : 0) ? 1 : 0);
        assert.equal(r.facts.ds, [...String(n)].reduce((t, c) => t + Number(c), 0));
        assert.equal(r.visual!.values.n, n);
        assert.equal(r.visual!.values.d, d);
        assert.match(r.observation, r.facts.right ? /^Correct!/ : /^Not quite:/);
        assert.ok(r.observation.includes(divisible ? 'is divisible by' : 'is not divisible by'), r.observation);
      }
    }
  }
});

test('E - the rule drawing talks about the right digits for each divisor', () => {
  assert.deepEqual(divisibilityRule(1234, 4).highlight, [2, 3], 'last two digits for 4');
  assert.deepEqual(divisibilityRule(12345, 8).highlight, [2, 3, 4], 'last three digits for 8');
  assert.deepEqual(divisibilityRule(1234, 2).highlight, [3], 'last digit for 2');
  assert.equal(divisibilityRule(121, 11).tested, 0, 'alternating sum of 1-2+1');
  assert.equal(divisibilityRule(132, 3).tested, 6, 'digit sum');
  assert.equal(divisibilityRule(91, 7).tested, 7, '9 - 2x1');
});

test('F - squares and cubes: the whole-number root, the blocks that fit and the leftovers are exact', () => {
  const isSquare = (v: number) => Math.round(Math.sqrt(v)) ** 2 === v;
  const isCube = (v: number) => Math.round(Math.cbrt(v)) ** 3 === v;
  for (const kind of [0, 1]) {
    for (const v of range(1, 150)) {
      const r = run(23739, { kind, v });
      const k = kind === 0 ? 2 : 3;
      let root = 0;
      while ((root + 1) ** k <= v) root++;
      assert.equal(r.facts.r, root, `${kind ? 'cube' : 'square'} root floor of ${v}`);
      assert.ok(root ** k <= v && v < (root + 1) ** k);
      assert.equal(r.facts.rp, root ** k);
      assert.equal(r.facts.extra, v - root ** k);
      assert.equal(r.facts.perfect, (kind === 0 ? isSquare(v) : isCube(v)) ? 1 : 0);
      assert.equal(r.visual!.values.side, root);
      assert.equal(r.visual!.values.layers, kind === 1 ? root : 1, 'a flat square for squares, a cube of layers for cubes');
      assert.equal(r.visual!.values.extra, v - root ** k);
      if (r.facts.perfect) {
        assert.ok(r.observation.includes(`root of ${v} is ${root}`), r.observation);
        assert.equal(r.facts.extra, 0);
      } else {
        // A non-perfect number never claims an integer root.
        assert.ok(!/is a perfect|root of \d+ is \d+/.test(r.observation), r.observation);
        assert.ok(r.observation.includes(`between ${root} and ${root + 1}`), r.observation);
      }
    }
  }
});

test('the expression functions the labs rely on are exact', () => {
  for (const a of range(1, 60)) {
    for (const b of range(1, 60)) {
      assert.equal(evaluate('gcd(a,b)', { a, b }), gcd(a, b));
      assert.equal(evaluate('lcm(a,b)', { a, b }), lcm(a, b));
      assert.equal(evaluate('mod(a,b)', { a, b }), a % b);
    }
  }
  for (const x of range(0, 5000)) {
    const s = evaluate('isqrt(x)', { x })!;
    assert.ok(s * s <= x && (s + 1) * (s + 1) > x, `isqrt(${x})`);
  }
  for (const x of range(0, 3000)) {
    const c = evaluate('icbrt(x)', { x })!;
    assert.ok(c ** 3 <= x && (c + 1) ** 3 > x, `icbrt(${x})`);
  }
  assert.equal(evaluate('mod(-7,3)', {}), 2);
  assert.equal(evaluate('mod(5,0)', {}), null, 'no division by zero');
  assert.equal(evaluate('isqrt(0-4)', {}), null, 'no root of a negative');
  assert.equal(evaluate('unknownfn(3)', {}), null, 'only whitelisted functions are callable');
  assert.equal(evaluate('constructor(3)', {}), null);
});

const render = (id: number, values: Record<string, number>) => {
  const state = { values };
  const result = variableModelEngine.evaluate(params(id), state);

  return renderToString(React.createElement(VariableModelWorkspace as never, { params: params(id), state, setState() {}, result } as never));
};

test('each experiment renders its own picture with an accurate description, and all controls are real inputs', () => {
  assert.match(render(23734, { start: 3, op: 0, k: -5 }), /starts at 3 and moves left 5 to -2/);
  assert.match(render(23735, { a: -3, b: 4, mode: 0 }), /3 groups of 4, negative: total -12/);
  assert.match(render(23736, { m: 4, n: 6 }), /Multiples of 4 and of 6 up to 24\. They first meet at 12/);
  assert.match(render(23737, { a: 24, b: 36, g: 6 }), /24 split into groups of 6 leaves 0; 36 split into groups of 6 leaves 0\. 6 is a common factor\. The highest common factor is 12/);
  assert.match(render(23738, { n: 132, d: 3, guess: 1 }), /Is 132 divisible by 3\?/);
  assert.match(render(23739, { kind: 1, v: 27 }), /3 by 3 by 3 blocks make 27/);
  assert.match(render(23739, { kind: 0, v: 40 }), /6 by 6 blocks make 36, and 4 loose blocks are left over/);
  for (const a of activities) {
    const html = render(a.topic_id, Object.fromEntries((a.lab_config.simulation.params as unknown as VariableModelParams).controls.map((c) => [c.id, c.default])));
    assert.ok(html.includes('type="range"'), `${a.title}: sliders`);
    assert.ok(html.includes('type="number"'), `${a.title}: typed values`);
    assert.ok(html.includes('prefers-reduced-motion: reduce'), `${a.title}: reduced motion respected`);
  }
});
