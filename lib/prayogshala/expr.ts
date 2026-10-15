/**
 * A tiny, safe expression evaluator for lab configuration.
 *
 * Lab formulas and conditions (`field_um/cells`, `litres_day>=5000 && litres_day<50000`) come
 * from the database, so they are never passed to eval or Function. This parses numbers,
 * identifiers, `+ - * /`, parentheses, unary minus and `!`, the comparisons
 * `< > <= >= == !=`, and `&&` / `||`. Comparisons and logic yield 1 or 0. An unknown
 * identifier, a division by zero or a malformed expression yields `null`, never a throw, so
 * one bad formula cannot take the page down.
 *
 * A fixed whitelist of pure number functions is also available (see FUNCTIONS): abs, min, max,
 * floor, ceil, round, sign, mod, gcd, lcm, pow, isqrt, icbrt, sqrt, cbrt, digitsum, altsum. They take
 * numbers and return a number or null (out of range, division by zero, a negative root). Anything
 * else followed by "(" is not a function and evaluates to null. Nothing here can loop without bound:
 * gcd/lcm are Euclid on numbers capped at 1e9, and pow's exponent is capped at 12.
 */

const MAX_INT = 1e9;
const isInt = (n: number) => Number.isInteger(n);

/** Floor of the integer k-th root, exact (no floating-point surprises such as cbrt(64) = 3.9999). */
function iroot(x: number, k: 2 | 3): number | null {
  if (!isInt(x) || x < 0 || x > MAX_INT * 1000) return null;
  let r = Math.floor(k === 2 ? Math.sqrt(x) : Math.cbrt(x));
  while (r ** k > x) r--;
  while ((r + 1) ** k <= x) r++;
  return r;
}

function gcd2(a: number, b: number): number | null {
  if (!isInt(a) || !isInt(b) || Math.abs(a) > MAX_INT || Math.abs(b) > MAX_INT) return null;
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

/** The only callable names. Each returns null when its arguments are out of range. */
const FUNCTIONS: Record<string, { arity: number; fn: (...a: number[]) => number | null }> = {
  abs: { arity: 1, fn: (a) => Math.abs(a) },
  sign: { arity: 1, fn: (a) => Math.sign(a) },
  floor: { arity: 1, fn: (a) => Math.floor(a) },
  ceil: { arity: 1, fn: (a) => Math.ceil(a) },
  round: { arity: 1, fn: (a) => Math.round(a) },
  min: { arity: 2, fn: (a, b) => Math.min(a, b) },
  max: { arity: 2, fn: (a, b) => Math.max(a, b) },
  mod: { arity: 2, fn: (a, b) => (b === 0 ? null : a - b * Math.floor(a / b)) },
  gcd: { arity: 2, fn: (a, b) => gcd2(a, b) },
  lcm: {
    arity: 2,
    fn: (a, b) => {
      const g = gcd2(a, b);
      if (g === null) return null;
      if (g === 0) return 0;
      const v = (Math.abs(a) / g) * Math.abs(b);
      return v > 1e12 ? null : v;
    },
  },
  pow: { arity: 2, fn: (a, n) => (isInt(n) && n >= 0 && n <= 12 && Number.isFinite(a ** n) ? a ** n : null) },
  isqrt: { arity: 1, fn: (a) => iroot(a, 2) },
  icbrt: { arity: 1, fn: (a) => iroot(a, 3) },
  sqrt: { arity: 1, fn: (a) => (a < 0 ? null : Math.sqrt(a)) },
  cbrt: { arity: 1, fn: (a) => Math.cbrt(a) },
  // Sum of the digits of |n|, and the alternating sum from the right (the rule for 11).
  digitsum: { arity: 1, fn: (a) => (isInt(a) && Math.abs(a) <= MAX_INT ? [...String(Math.abs(a))].reduce((t, d) => t + Number(d), 0) : null) },
  altsum: {
    arity: 1,
    fn: (a) =>
      isInt(a) && Math.abs(a) <= MAX_INT
        ? [...String(Math.abs(a))].reverse().reduce((t, d, i) => t + (i % 2 ? -1 : 1) * Number(d), 0)
        : null,
  },
};

/** Names callable from an expression - exported so validators know which identifiers are not facts. */
export const FUNCTION_NAMES: readonly string[] = Object.keys(FUNCTIONS);

type Token = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Token[] | null {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+/.exec(src.slice(i));
      if (!m) return null;
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: 'id', v: m[0] });
      i += m[0].length;
    } else {
      const two = src.slice(i, i + 2);
      if (['<=', '>=', '==', '!=', '&&', '||'].includes(two)) {
        out.push({ t: 'op', v: two });
        i += 2;
      } else if ('+-*/()<>!,'.includes(c)) {
        out.push({ t: 'op', v: c });
        i++;
      } else {
        return null;
      }
    }
  }
  return out;
}

class Parser {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly scope: Record<string, number>
  ) {}

  parse(): number | null {
    const v = this.or();
    return this.pos === this.tokens.length ? v : null;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private eat(op: string): boolean {
    const tk = this.peek();
    if (tk && tk.t === 'op' && tk.v === op) {
      this.pos++;
      return true;
    }
    return false;
  }

  private or(): number | null {
    let l = this.and();
    while (this.eat('||')) {
      const r = this.and();
      l = l === null || r === null ? null : l || r ? 1 : 0;
    }
    return l;
  }
  private and(): number | null {
    let l = this.cmp();
    while (this.eat('&&')) {
      const r = this.cmp();
      l = l === null || r === null ? null : l && r ? 1 : 0;
    }
    return l;
  }
  private cmp(): number | null {
    const l = this.add();
    for (const op of ['<=', '>=', '==', '!=', '<', '>']) {
      if (this.eat(op)) {
        const r = this.add();
        if (l === null || r === null) return null;
        const hit =
          op === '<=' ? l <= r : op === '>=' ? l >= r : op === '==' ? l === r : op === '!=' ? l !== r : op === '<' ? l < r : l > r;
        return hit ? 1 : 0;
      }
    }
    return l;
  }
  private add(): number | null {
    let l = this.mul();
    for (;;) {
      if (this.eat('+')) {
        const r = this.mul();
        l = l === null || r === null ? null : l + r;
      } else if (this.eat('-')) {
        const r = this.mul();
        l = l === null || r === null ? null : l - r;
      } else return l;
    }
  }
  private mul(): number | null {
    let l = this.unary();
    for (;;) {
      if (this.eat('*')) {
        const r = this.unary();
        l = l === null || r === null ? null : l * r;
      } else if (this.eat('/')) {
        const r = this.unary();
        l = l === null || r === null || r === 0 ? null : l / r;
      } else return l;
    }
  }
  private unary(): number | null {
    if (this.eat('-')) {
      const v = this.unary();
      return v === null ? null : -v;
    }
    if (this.eat('!')) {
      const v = this.unary();
      return v === null ? null : v ? 0 : 1;
    }
    return this.primary();
  }
  /** name( arg {, arg} ) - only whitelisted functions with the right argument count. */
  private call(name: string): number | null {
    this.eat('(');
    const args: (number | null)[] = [];
    if (!this.eat(')')) {
      do {
        args.push(this.or());
      } while (this.eat(','));
      if (!this.eat(')')) return null;
    }
    const spec = Object.prototype.hasOwnProperty.call(FUNCTIONS, name) ? FUNCTIONS[name] : undefined;
    if (!spec || args.length !== spec.arity || args.some((a) => a === null || !Number.isFinite(a))) return null;
    const out = spec.fn(...(args as number[]));
    return out !== null && Number.isFinite(out) ? out : null;
  }

  private primary(): number | null {
    const tk = this.peek();
    if (!tk) return null;
    if (tk.t === 'num') {
      this.pos++;
      return tk.v;
    }
    if (tk.t === 'id') {
      this.pos++;
      const next = this.peek();
      if (next && next.t === 'op' && next.v === '(') return this.call(tk.v);
      const v = this.scope[tk.v];
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    }
    if (this.eat('(')) {
      const v = this.or();
      return this.eat(')') ? v : null;
    }
    return null;
  }
}

/** The value of `expr` over `scope`, or null when it cannot be evaluated. */
export function evaluate(expr: string, scope: Record<string, number>): number | null {
  const tokens = tokenize(expr);
  if (!tokens || tokens.length === 0) return null;
  const value = new Parser(tokens, scope).parse();
  return value !== null && Number.isFinite(value) ? value : null;
}

/** True when `expr` evaluates to a non-zero number. */
export function isTrue(expr: string | undefined, scope: Record<string, number>): boolean {
  if (!expr) return false;
  const v = evaluate(expr, scope);
  return v !== null && v !== 0;
}
