import { parseParameters } from "./params";

export type ParameterAuditIssue = {
  value: string;
  context: string;
};

export type ParameterAudit = {
  ok: boolean;
  params: number;
  issues: ParameterAuditIssue[];
  message: string;
};

const ALLOWED = new Set([0, 1, -1, 2, 90, -90, 180, -180, 270, -270, 360, -360, 0.001, 0.01]);
const MAX_ISSUES = 12;

export function auditParameterization(code: string): ParameterAudit {
  const params = parseParameters(code);
  const cleaned = code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ");
  const first = cleaned.search(/^\s*(module|function)\s/m);
  const body = first >= 0 ? cleaned.slice(first) : "";
  const scoped = body
    .replace(/color\s*\(\s*\[[^\]]*\]\s*\)/gi, "color()")
    .replace(/\$fn\s*=\s*[^;]+;/g, " ");
  const issues: ParameterAuditIssue[] = [];
  const seen = new Set<string>();
  const lines = scoped.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    const matches = line.matchAll(/(?<![\w.$])-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi);
    for (const match of matches) {
      const value = Number(match[0]);
      if (!Number.isFinite(value) || ALLOWED.has(value)) continue;
      const context = line.replace(/\s+/g, " ").slice(0, 130);
      const key = `${match[0]}:${context}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({ value: match[0], context });
      if (issues.length >= MAX_ISSUES) break;
    }
    if (issues.length >= MAX_ISSUES) break;
  }
  if (!params.length) {
    issues.push({ value: "no parameters", context: "The model has no top-level Customizer parameters." });
  }
  const ok = issues.length === 0;
  const detail = issues
    .slice(0, 6)
    .map((issue) => `"${issue.value}" in: ${issue.context}`)
    .join("\n");
  const message = ok
    ? `Fully parametric: ${params.length} named parameters, no hardcoded dimensions.`
    : `HARDCODED DIMENSIONS FOUND. Convert every driving number inside modules into a named top-level parameter or a derived value. Tolerances, clearances, wall thicknesses and offsets are parameters too. Allowed invariants only: 0, 1, -1, 2, 90, 180, 270, 360, color, $fn, 0.001, 0.01.\n${detail}`;
  return { ok, params: params.length, issues, message };
}
