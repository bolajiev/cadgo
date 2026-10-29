import type { Expr, Parameter } from "./types";

type Token =
  | { kind: "number"; value: number }
  | { kind: "ident"; value: string }
  | { kind: "op"; value: string };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  sqrt: Math.sqrt,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  pow: Math.pow,
  atan2: (y, x) => Math.atan2(y, x),
  sin: (x) => Math.sin((x * Math.PI) / 180),
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
};

class Parser {
  private i = 0;

  constructor(
    private tokens: Token[],
    private vars: Record<string, number>,
  ) {}

  parse(): number {
    const value = this.expression();
    if (this.i < this.tokens.length) {
      throw new Error(`Unexpected token in expression`);
    }
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.i];
  }

  private take(): Token {
    const token = this.tokens[this.i++];
    if (!token) throw new Error("Unexpected end of expression");
    return token;
  }

  private expression(): number {
    let value = this.term();
    while (this.peek()?.kind === "op" && ["+", "-"].includes((this.peek() as { value: string }).value)) {
      const op = (this.take() as { value: string }).value;
      const right = this.term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  private term(): number {
    let value = this.power();
    while (this.peek()?.kind === "op" && ["*", "/", "%"].includes((this.peek() as { value: string }).value)) {
      const op = (this.take() as { value: string }).value;
      const right = this.power();
      if (op === "*") value *= right;
      else if (op === "/") value /= right;
      else value %= right;
    }
    return value;
  }

  private power(): number {
    const value = this.unary();
    if (this.peek()?.kind === "op" && (this.peek() as { value: string }).value === "^") {
      this.take();
      return Math.pow(value, this.power());
    }
    return value;
  }

  private unary(): number {
    const token = this.peek();
    if (token?.kind === "op" && ["+", "-"].includes(token.value)) {
      this.take();
      const value = this.unary();
      return token.value === "-" ? -value : value;
    }
    return this.primary();
  }

  private primary(): number {
    const token = this.take();
    if (token.kind === "number") return token.value;
    if (token.kind === "ident") {
      const next = this.peek();
      if (next?.kind === "op" && next.value === "(") {
        this.take();
        const args: number[] = [];
        if (!(this.peek()?.kind === "op" && (this.peek() as { value: string }).value === ")")) {
          args.push(this.expression());
          while (this.peek()?.kind === "op" && (this.peek() as { value: string }).value === ",") {
            this.take();
            args.push(this.expression());
          }
        }
        const close = this.take();
        if (close.kind !== "op" || close.value !== ")") throw new Error("Expected )");
        if (token.value === "pi") return Math.PI;
        const fn = FUNCTIONS[token.value];
        if (!fn) throw new Error(`Unknown function: ${token.value}`);
        return fn(...args);
      }
      if (token.value === "pi") return Math.PI;
      if (token.value in this.vars) return this.vars[token.value];
      throw new Error(`Unknown parameter: ${token.value}`);
    }
    if (token.kind === "op" && token.value === "(") {
      const value = this.expression();
      const close = this.take();
      if (close.kind !== "op" || close.value !== ")") throw new Error("Expected )");
      return value;
    }
    throw new Error("Unexpected token in expression");
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < source.length && /[0-9._]/.test(source[j])) j++;
      if (source[j] === "e" || source[j] === "E") {
        j++;
        if (source[j] === "+" || source[j] === "-") j++;
        while (j < source.length && /[0-9]/.test(source[j])) j++;
      }
      const raw = source.slice(i, j).replace(/_/g, "");
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`Bad number: ${raw}`);
      tokens.push({ kind: "number", value });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j++;
      tokens.push({ kind: "ident", value: source.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/%^(),".includes(ch)) {
      tokens.push({ kind: "op", value: ch });
      i++;
      continue;
    }
    throw new Error(`Unexpected character in expression: ${ch}`);
  }
  return tokens;
}

export function evalExpr(expr: string, vars: Record<string, number>): number {
  const parser = new Parser(tokenize(expr), vars);
  const value = parser.parse();
  if (!Number.isFinite(value)) throw new Error(`Expression is not finite: ${expr}`);
  return value;
}

export function resolveNum(expr: Expr, vars: Record<string, number>): number {
  if (typeof expr === "number") {
    if (!Number.isFinite(expr)) throw new Error("Number is not finite");
    return expr;
  }
  if (typeof expr === "string") return evalExpr(expr, vars);
  return evalExpr(expr.expr, vars);
}

export function resolveVec3(
  expr: [Expr, Expr, Expr],
  vars: Record<string, number>,
): [number, number, number] {
  return [resolveNum(expr[0], vars), resolveNum(expr[1], vars), resolveNum(expr[2], vars)];
}

export function evaluateParameters(parameters: Parameter[]): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const parameter of parameters) {
    if (!parameter.id || parameter.id in vars) {
      throw new Error(`Duplicate or empty parameter id: ${parameter.id}`);
    }
    if (!Number.isFinite(parameter.value)) {
      throw new Error(`Parameter ${parameter.id} is not finite`);
    }
    vars[parameter.id] = parameter.value;
  }
  return vars;
}

export function parameterValue(
  parameters: Parameter[],
  id: string,
  fallback: number,
): number {
  const found = parameters.find((parameter) => parameter.id === id);
  return found ? found.value : fallback;
}
