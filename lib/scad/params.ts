export type ParameterType = "number" | "boolean";

export type ParameterDef = {
  name: string;
  label: string;
  description?: string;
  group?: string;
  value: number | boolean;
  min: number;
  max: number;
  step: number;
  type: ParameterType;
};

type ParsedValue = {
  value: number | boolean;
  type: ParameterType;
};

function parseValue(raw: string): ParsedValue | null {
  const text = raw.trim();
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return { value: Number(text), type: "number" };
  }
  if (text === "true" || text === "false") {
    return { value: text === "true", type: "boolean" };
  }
  return null;
}

function titleCase(name: string) {
  return name
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function numericRange(value: number) {
  const min = value >= 0 ? 0 : -Math.abs(value) * 2;
  const max = value > 0 ? value * 2 : 10;
  const step = Math.abs(value) < 10 ? 0.5 : value < 50 ? 1 : 5;
  return { min, max, step };
}

function parseRange(comment: string | undefined, value: number) {
  if (!comment) return numericRange(value);
  const match = /\[([-\d.]+):([-\d.]+)(?::([-\d.]+))?\]/.exec(comment);
  if (!match) return numericRange(value);
  const first = Number(match[1]);
  const second = Number(match[2]);
  const third = match[3] ? Number(match[3]) : null;
  if (!Number.isFinite(first) || !Number.isFinite(second)) return numericRange(value);
  if (third !== null && Number.isFinite(third)) {
    return { min: first, max: third, step: second };
  }
  return {
    min: Math.min(first, second),
    max: Math.max(first, second),
    step: Math.abs(second - first) > 50 ? 1 : 0.5,
  };
}

export function parseParameters(code: string): ParameterDef[] {
  const top = code.split(/^(?=module |function )/m)[0] ?? "";
  const lines = top.split(/\r?\n/);
  const params: ParameterDef[] = [];
  let group: string | undefined;
  let previousComment: string | undefined;
  for (const line of lines) {
    const trimmed = line.trim();
    const groupMatch = /^\/\*\s*\[([^\]]+)\]\s*\*\/$/.exec(trimmed);
    if (groupMatch) {
      group = groupMatch[1].trim();
      previousComment = undefined;
      continue;
    }
    if (/^\/\//.test(trimmed)) {
      previousComment = trimmed.replace(/^\/\/+\s*/, "");
      continue;
    }
    if (!trimmed) {
      previousComment = undefined;
      continue;
    }
    const match = /^([A-Za-z_$][\w$]*)\s*=\s*([^;]+);\s*(?:\/\/\s*(.*))?$/.exec(trimmed);
    if (!match) {
      previousComment = undefined;
      continue;
    }
    const name = match[1];
    const rawValue = match[2];
    const inlineComment = match[3];
    if (name.startsWith("$")) {
      previousComment = undefined;
      continue;
    }
    const parsed = parseValue(rawValue);
    if (!parsed) {
      previousComment = undefined;
      continue;
    }
    if (parsed.type === "number") {
      const range = parseRange(inlineComment ?? previousComment, parsed.value as number);
      params.push({
        name,
        label: titleCase(name),
        description:
          inlineComment && !/^\[/.test(inlineComment)
            ? inlineComment
            : previousComment && !/^\[/.test(previousComment)
              ? previousComment
              : undefined,
        group,
        value: parsed.value,
        ...range,
        type: "number",
      });
    } else {
      params.push({
        name,
        label: titleCase(name),
        description: previousComment,
        group,
        value: parsed.value,
        min: 0,
        max: 1,
        step: 1,
        type: "boolean",
      });
    }
    previousComment = undefined;
  }
  return params;
}

export function parametersToValues(params: ParameterDef[]): Record<string, number | boolean> {
  return Object.fromEntries(params.map((param) => [param.name, param.value]));
}

export function formatParamValue(value: number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 1000) / 1000);
}

export function setParameterInCode(
  code: string,
  name: string,
  value: number | boolean,
): string {
  const parts = code.split(/^(?=module |function )/m);
  const head = parts[0] ?? "";
  const tail = parts.slice(1).join("");
  const lines = head.split(/\r?\n/);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^(\\s*${escaped}\\s*=\\s*)([^;]+)(;.*)$`);
  for (let index = 0; index < lines.length; index++) {
    const match = regex.exec(lines[index]);
    if (!match) continue;
    lines[index] = `${match[1]}${formatParamValue(value)}${match[3]}`;
    break;
  }
  return lines.join("\n") + tail;
}

export function getParameterValue(code: string, name: string): number | boolean | null {
  const param = parseParameters(code).find((item) => item.name === name);
  return param ? param.value : null;
}
