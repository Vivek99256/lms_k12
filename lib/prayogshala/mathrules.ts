/**
 * Pure maths helpers behind the number-theory visuals (divisibility rule lab, equal-grouping model).
 *
 * They are separate from the React components so the rules can be proven against plain arithmetic
 * for every input a student can reach, without rendering anything. The components only draw what
 * these return; they never decide a mathematical fact themselves.
 */

export interface DivisibilityRule {
  /** Digits of |n|, left to right. */
  digits: number[];
  /** Indices of the digit tiles the rule looks at. */
  highlight: number[];
  /** Short title of the rule, e.g. "Rule for 3: add the digits". */
  title: string;
  /** The working, one short line per step. */
  steps: string[];
  /** The number the rule finally tests for divisibility. */
  tested: number;
  /** Whether the rule says n is divisible by d. Always equals n % d === 0 (proven in the tests). */
  ok: boolean;
}

const posMod = (a: number, b: number) => ((a % b) + b) % b;

/** The usual divisibility test for d in 2..11, worked out on the digits of n. */
export function divisibilityRule(n: number, d: number): DivisibilityRule {
  const m = Math.abs(Math.trunc(n));
  const digits = [...String(m)].map(Number);
  const last = digits.length - 1;
  const lastK = (k: number) => digits.map((_, i) => i).filter((i) => i > last - k);
  const all = digits.map((_, i) => i);
  const sum = digits.reduce((t, x) => t + x, 0);
  const lastDigit = m % 10;

  switch (d) {
    case 2:
      return { digits, highlight: lastK(1), title: 'Rule for 2: look at the last digit', steps: [`Last digit is ${lastDigit}`, `${lastDigit} is ${lastDigit % 2 === 0 ? 'even' : 'odd'}`], tested: lastDigit, ok: lastDigit % 2 === 0 };
    case 5:
      return { digits, highlight: lastK(1), title: 'Rule for 5: the last digit is 0 or 5', steps: [`Last digit is ${lastDigit}`], tested: lastDigit, ok: lastDigit === 0 || lastDigit === 5 };
    case 10:
      return { digits, highlight: lastK(1), title: 'Rule for 10: the last digit is 0', steps: [`Last digit is ${lastDigit}`], tested: lastDigit, ok: lastDigit === 0 };
    case 4: {
      const t = m % 100;
      return { digits, highlight: lastK(2), title: 'Rule for 4: look at the last two digits', steps: [`Last two digits make ${t}`, `${t} ÷ 4 leaves ${t % 4}`], tested: t, ok: t % 4 === 0 };
    }
    case 8: {
      const t = m % 1000;
      return { digits, highlight: lastK(3), title: 'Rule for 8: look at the last three digits', steps: [`Last three digits make ${t}`, `${t} ÷ 8 leaves ${t % 8}`], tested: t, ok: t % 8 === 0 };
    }
    case 3:
    case 9:
      return { digits, highlight: all, title: `Rule for ${d}: add the digits`, steps: [`${digits.join(' + ')} = ${sum}`, `${sum} ÷ ${d} leaves ${sum % d}`], tested: sum, ok: sum % d === 0 };
    case 6: {
      const even = lastDigit % 2 === 0;
      const three = sum % 3 === 0;
      return {
        digits,
        highlight: all,
        title: 'Rule for 6: divisible by 2 and by 3',
        steps: [`Last digit ${lastDigit} is ${even ? 'even' : 'odd'}`, `Digit sum ${sum} ${three ? 'is' : 'is not'} a multiple of 3`],
        tested: sum,
        ok: even && three,
      };
    }
    case 11: {
      const alt = digits.reduceRight((t, x, i) => t + ((last - i) % 2 ? -x : x), 0);
      return {
        digits,
        highlight: all,
        title: 'Rule for 11: add and subtract the digits in turn, from the right',
        steps: [`Alternating sum = ${alt}`, `${alt} ${posMod(alt, 11) === 0 ? 'is' : 'is not'} a multiple of 11`],
        tested: alt,
        ok: posMod(alt, 11) === 0,
      };
    }
    case 7: {
      const rest = Math.floor(m / 10);
      const t = rest - 2 * lastDigit;
      return {
        digits,
        highlight: all,
        title: 'Rule for 7: remove the last digit, subtract double of it',
        steps: [`${rest} − 2 × ${lastDigit} = ${t}`, `${t} ${posMod(t, 7) === 0 ? 'is' : 'is not'} a multiple of 7`],
        tested: t,
        ok: posMod(t, 7) === 0,
      };
    }
    default:
      return { digits, highlight: [], title: `Divide by ${d}`, steps: [`${m} ÷ ${d} leaves ${m % d}`], tested: m, ok: d !== 0 && m % d === 0 };
  }
}

export interface GroupLayout {
  boxes: { x: number; y: number; w: number; h: number; dots: { x: number; y: number }[] }[];
  loose: { x: number; y: number }[];
  width: number;
  height: number;
  groups: number;
  leftover: number;
}

/**
 * Lay `total` dots out as equal groups of `size`, with the remainder loose. The group count and
 * the leftover are exactly floor(total / size) and total mod size; every dot is placed once.
 */
export function layoutGroups(total: number, size: number, maxWidth = 296): GroupLayout {
  const t = Math.max(0, Math.round(total));
  const s = Math.max(1, Math.round(size));
  const groups = Math.floor(t / s);
  const leftover = t - groups * s;
  const dotGap = 11;
  const cols = Math.min(s, 6);
  const rows = Math.ceil(s / cols);
  const boxW = cols * dotGap + 6;
  const boxH = rows * dotGap + 6;
  const gap = 8;

  const boxes: GroupLayout['boxes'] = [];
  let x = 0;
  let y = 0;
  for (let g = 0; g < groups; g++) {
    if (x > 0 && x + boxW > maxWidth) {
      x = 0;
      y += boxH + gap;
    }
    const dots = Array.from({ length: s }, (_, i) => ({ x: x + 3 + dotGap / 2 + (i % cols) * dotGap, y: y + 3 + dotGap / 2 + Math.floor(i / cols) * dotGap }));
    boxes.push({ x, y, w: boxW, h: boxH, dots });
    x += boxW + gap;
  }
  const loose: GroupLayout['loose'] = [];
  if (leftover > 0) {
    if (x > 0 && x + leftover * dotGap > maxWidth) {
      x = 0;
      y += boxH + gap;
    }
    for (let i = 0; i < leftover; i++) loose.push({ x: x + 3 + dotGap / 2 + i * dotGap, y: y + 3 + dotGap / 2 });
  }
  const height = groups === 0 ? (leftover > 0 ? dotGap + 6 : 0) : y + boxH;

  return { boxes, loose, width: maxWidth, height: Math.max(height, loose.length ? y + dotGap + 6 : 0), groups, leftover };
}

/** Multiples of m that are <= limit, in order (capped so a bad input cannot draw thousands). */
export function multiplesUpTo(m: number, limit: number, cap = 60): number[] {
  const step = Math.max(1, Math.round(m));
  const out: number[] = [];
  for (let v = step; v <= limit && out.length < cap; v += step) out.push(v);
  return out;
}
