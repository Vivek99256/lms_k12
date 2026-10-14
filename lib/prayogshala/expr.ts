/**
 * A tiny, safe expression evaluator for lab configuration.
 *
 * Lab formulas and conditions (`field_um/cells`, `litres_day>=5000 && litres_day<50000`) come
 * from the database, so they are never passed to eval or Function. This parses numbers,
 * identifiers, `+ - * /`, parentheses, unary minus and `!`, the comparisons
 * `< > <= >= == !=`, and `&&` / `||`. Comparisons and logic yield 1 or 0. An unknown
 * identifier, a division by zero or a malformed expression yields `null`, never a throw, so
 * one bad formula cannot take the page down.
 */

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
      } else if ('+-*/()<>!'.includes(c)) {
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
  private primary(): number | null {
    const tk = this.peek();
    if (!tk) return null;
    if (tk.t === 'num') {
      this.pos++;
      return tk.v;
    }
    if (tk.t === 'id') {
      this.pos++;
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
