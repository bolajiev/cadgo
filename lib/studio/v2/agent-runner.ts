import { auditParameterization } from "../../scad/audit";
import { parseParameters } from "../../scad/params";
import { defaultMaterial, newId } from "../document/defaults";
import type { CadDocument, MaterialRef, PartDefinition, PartInstance, Transform, Vec3 } from "../document/types";
import type { CompileState } from "../compile/types";
import { useStudioV2 } from "./store";
import { renderAssemblySheet } from "./inspection";
import { isMaterialMode } from "./material";
import type { AgentMessage, AgentToolCall, ChatEntry, PendingQuestion } from "./agent-types";
import type { StudioImage } from "../profile";
import type { ResearchSource } from "../../research/types";

type ToolOutcome = {
  result: unknown;
  extraMessages?: AgentMessage[];
  stop?: "ask" | "answer";
  text?: string;
};

export function isEmptyAgentResponse(payload: {
  content?: string;
  tool_calls?: unknown[];
  truncated?: boolean;
}): boolean {
  if (payload.truncated) return false;
  if ((payload.content ?? "").trim()) return false;
  return !payload.tool_calls?.length;
}

let requestSeq = 0;
let abortController: AbortController | null = null;
let streamingChatId: string | null = null;

function chatEntry(role: ChatEntry["role"], text: string, note?: string): ChatEntry {
  return { id: newId("chat"), role, text, note };
}

function startStreaming() {
  if (streamingChatId) return;
  streamingChatId = newId("chat");
  const id = streamingChatId;
  useStudioV2.setState((state) => ({
    chat: [...state.chat, { id, role: "assistant", text: "", streaming: true }],
  }));
}

function appendStreaming(text: string) {
  if (!text) return;
  if (!streamingChatId) startStreaming();
  const id = streamingChatId;
  useStudioV2.setState((state) => ({
    chat: state.chat.map((entry) =>
      entry.id === id ? { ...entry, text: entry.text + text, streaming: true } : entry,
    ),
  }));
}

function appendReasoning(text: string) {
  if (!text) return;
  if (!streamingChatId) startStreaming();
  const id = streamingChatId;
  useStudioV2.setState((state) => ({
    chat: state.chat.map((entry) =>
      entry.id === id
        ? { ...entry, reasoning: (entry.reasoning ?? "") + text, streaming: true }
        : entry,
    ),
  }));
}

function finalizeStreaming(note?: string) {
  if (!streamingChatId) return;
  const id = streamingChatId;
  streamingChatId = null;
  useStudioV2.setState((state) => ({
    chat: state.chat.map((entry) =>
      entry.id === id ? { ...entry, note, streaming: false } : entry,
    ),
  }));
}

function clearStreaming() {
  if (!streamingChatId) return;
  const id = streamingChatId;
  streamingChatId = null;
  useStudioV2.setState((state) => ({ chat: state.chat.filter((entry) => entry.id !== id) }));
}

function parseArgs(value: string | Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBool(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asVec3(value: unknown): Vec3 | undefined {
  if (!Array.isArray(value) || value.length !== 3) return undefined;
  const items = value.map((item) => (typeof item === "number" && Number.isFinite(item) ? item : NaN));
  return items.every(Number.isFinite) ? (items as Vec3) : undefined;
}

function parseMaterial(value: unknown): MaterialRef | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.color !== "string") return undefined;
  const opacity = asNumber(record.opacity);
  return {
    color: record.color,
    metalness: asNumber(record.metalness) ?? 0.15,
    roughness: asNumber(record.roughness) ?? 0.55,
    opacity: opacity === undefined ? 1 : Math.min(1, Math.max(0, opacity)),
  };
}

function parseOverrides(value: unknown): Record<string, number | boolean> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, number | boolean> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" || typeof item === "boolean") result[key] = item;
  }
  return result;
}

function transformFrom(args: Record<string, unknown>, current?: Transform): Transform {
  const position = asVec3(args.position) ?? current?.position ?? [0, 0, 0];
  const rotation = asVec3(args.rotation) ?? current?.rotation ?? [0, 0, 0];
  return { position: [...position], rotation: [...rotation], scale: current?.scale ?? [1, 1, 1] };
}

function sessionId(): string {
  if (typeof window === "undefined") return "server";
  const key = "cadgo:v2:agent-session";
  let value = window.localStorage.getItem(key);
  if (!value) {
    value = newId("session");
    window.localStorage.setItem(key, value);
  }
  return value;
}

function pruneMessages(messages: AgentMessage[]): AgentMessage[] {
  let recent = messages.slice(-36);
  while (recent.length && recent[0].role === "tool") recent = recent.slice(1);
  const imageIndexes: number[] = [];
  recent.forEach((message, index) => {
    if (
      Array.isArray(message.content) &&
      message.content.some((part) => Boolean(part && typeof part === "object" && (part as { type?: string }).type === "image_url"))
    ) {
      imageIndexes.push(index);
    }
  });
  const keepImages = new Set(imageIndexes.slice(-4));
  return recent.map((message, index) => {
    let next = message;
    if (Array.isArray(message.content) && !keepImages.has(index)) {
      const text = message.content
        .filter((part): part is { type: "text"; text: string } => Boolean(part && typeof part === "object" && (part as { type?: string }).type === "text"))
        .map((part) => part.text)
        .join("\n");
      next = { ...next, content: `${text}\n[previous inspection sheet omitted]` };
    }
    if (next.role === "assistant" && next.tool_calls?.length) {
      next = {
        ...next,
        tool_calls: next.tool_calls.map((call) => {
          const args = call.function?.arguments;
          if (typeof args !== "string" || args.length < 3000) return call;
          try {
            const parsed = JSON.parse(args) as Record<string, unknown>;
            if (typeof parsed.source === "string") parsed.source = "[source omitted; call get_definition]";
            return { ...call, function: { ...call.function, arguments: JSON.stringify(parsed) } };
          } catch {
            return call;
          }
        }),
      };
    }
    return next;
  });
}

function modelSummary(
  document: CadDocument,
  states: Record<string, CompileState>,
  selectedInstanceId: string | null,
  selectedDefinitionId: string | null,
  includeSource = false,
) {
  return {
    name: document.name,
    revision: document.revision,
    selected: { instanceId: selectedInstanceId, definitionId: selectedDefinitionId },
    libraryLength: document.library.length,
    groups: document.groups.map((group) => ({
      id: group.id,
      name: group.name,
      parentId: group.parentId,
      position: group.transform.position,
      rotation: group.transform.rotation,
      visible: group.visible,
      locked: group.locked,
      revision: group.revision,
    })),
    definitions: document.definitions.map((definition) => {
      const state = states[definition.id];
      return {
        id: definition.id,
        name: definition.name,
        revision: definition.revision,
        locked: definition.locked,
        params: definition.params.map((param) => ({
          name: param.name,
          value: param.value,
          min: param.min,
          max: param.max,
          step: param.step,
          type: param.type,
        })),
        instances: document.instances.filter((instance) => instance.definitionId === definition.id).length,
        status: state?.status ?? "idle",
        metrics: state?.metrics,
        error: state?.error,
        sourceLength: definition.source.length,
        source: includeSource ? definition.source : undefined,
      };
    }),
    instances: document.instances.map((instance) => ({
      id: instance.id,
      name: instance.name,
      definitionId: instance.definitionId,
      parentId: instance.parentId,
      position: instance.transform.position,
      rotation: instance.transform.rotation,
      visible: instance.visible,
      locked: instance.locked,
      suppressed: instance.suppressed,
      paramOverrides: instance.paramOverrides,
      revision: instance.revision,
    })),
    joints: document.joints,
    drivers: document.drivers,
  };
}

function appendChat(entry: ChatEntry) {
  useStudioV2.setState((state) => ({ chat: [...state.chat, entry] }));
}

function setActivity(line: string) {
  useStudioV2.setState((state) => ({ agentActivity: [...state.agentActivity.slice(-5), line] }));
}

function appendToolResult(call: AgentToolCall, result: unknown) {
  const id = call.id ?? `tool-${newId("result")}`;
  useStudioV2.setState((state) => ({
    agentMessages: [
      ...state.agentMessages,
      { role: "tool", tool_call_id: id, content: JSON.stringify(result) },
    ],
  }));
}

function appendExtraMessages(messages: AgentMessage[]) {
  if (!messages.length) return;
  useStudioV2.setState((state) => ({ agentMessages: [...state.agentMessages, ...messages] }));
}

function failure(): ToolOutcome {
  const notice = useStudioV2.getState().notice ?? "The command failed.";
  return {
    result: {
      ok: false,
      conflict: /changed while/i.test(notice),
      error: notice,
    },
  };
}

async function waitForCompile(definitionId: string, revision: number, timeoutMs = 30_000): Promise<CompileState | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = useStudioV2.getState().compileStates[definitionId];
    if (state && state.revision === revision && (state.status === "ready" || state.status === "error")) {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return useStudioV2.getState().compileStates[definitionId] ?? null;
}

function definitionById(id: string): PartDefinition | undefined {
  return useStudioV2.getState().document.definitions.find((definition) => definition.id === id);
}

function instanceById(id: string): PartInstance | undefined {
  return useStudioV2.getState().document.instances.find((instance) => instance.id === id);
}

async function createDefinition(args: Record<string, unknown>): Promise<ToolOutcome> {
  const name = asString(args.name)?.trim();
  const source = asString(args.source)?.trim();
  if (!name || !source) return { result: { ok: false, error: "name and source are required." } };
  const audit = auditParameterization(source);
  if (!audit.ok) {
    appendChat(chatEntry("system", `Audit rejected ${name}: hardcoded dimensions.`));
    return { result: { ok: false, error: audit.message, issues: audit.issues.slice(0, 6) } };
  }
  const id = newId("def");
  const material = parseMaterial(args.material);
  const requestedMode = args.materialMode;
  const definition: Omit<PartDefinition, "revision"> = {
    id,
    name,
    source,
    params: parseParameters(source),
    material: material ?? defaultMaterial(),
    materialMode: isMaterialMode(requestedMode)
      ? requestedMode
      : material
        ? "override"
        : "source",
    locked: false,
  };
  const ok = useStudioV2.getState().run({
    kind: "create_definition",
    payload: { definition },
    label: `Create part ${name}`,
  });
  if (!ok) return failure();
  setActivity(`Created ${name}`);
  appendChat(chatEntry("system", `Created part ${name}.`));
  const state = await waitForCompile(id, 1);
  if (!state) return { result: { ok: true, definitionId: id, revision: 1, status: "queued" } };
  if (state.status === "error") {
    appendChat(chatEntry("system", `Compile failed for ${name}.`, "model will revise"));
    return {
      result: {
        ok: false,
        definitionId: id,
        revision: 1,
        status: "error",
        error: state.error,
        logs: state.logs,
      },
    };
  }
  appendChat(chatEntry("system", `Compiled ${name} · ${state.metrics?.triangles ?? 0} triangles.`));
  return {
    result: {
      ok: true,
      definitionId: id,
      revision: 1,
      status: "ready",
      metrics: state.metrics,
    },
  };
}

async function updateDefinition(args: Record<string, unknown>): Promise<ToolOutcome> {
  const definitionId = asString(args.definitionId);
  const baseRevision = asNumber(args.baseRevision);
  if (!definitionId || baseRevision === undefined) {
    return { result: { ok: false, error: "definitionId and baseRevision are required." } };
  }
  const current = definitionById(definitionId);
  if (!current) return { result: { ok: false, error: "Definition not found." } };
  if (current.revision !== baseRevision) {
    return {
      result: {
        ok: false,
        conflict: true,
        currentRevision: current.revision,
        error: "The definition changed since you read it. Re-read it and retry.",
      },
    };
  }
  const patch: Partial<Pick<PartDefinition, "name" | "source" | "material" | "materialMode" | "locked">> = {};
  const name = asString(args.name);
  if (name?.trim()) patch.name = name.trim();
  const source = asString(args.source);
  if (source !== undefined) {
    const audit = auditParameterization(source);
    if (!audit.ok) {
      appendChat(chatEntry("system", `Audit rejected ${current.name}: hardcoded dimensions.`));
      return { result: { ok: false, error: audit.message, issues: audit.issues.slice(0, 6) } };
    }
    patch.source = source;
  }
  const material = parseMaterial(args.material);
  const requestedMode = args.materialMode;
  if (isMaterialMode(requestedMode)) patch.materialMode = requestedMode;
  else if (material) patch.materialMode = "override";
  if (material) {
    patch.material = material;
  }
  const locked = asBool(args.locked);
  if (locked !== undefined) patch.locked = locked;
  if (!Object.keys(patch).length) return { result: { ok: false, error: "No changes supplied." } };

  const ok = useStudioV2.getState().run({
    kind: "update_definition",
    payload: { definitionId, patch },
    targetRevision: baseRevision,
    label: `Update part ${current.name}`,
  });
  if (!ok) return failure();
  const updated = definitionById(definitionId);
  if (!updated) return { result: { ok: false, error: "Definition disappeared." } };
  setActivity(`Updated ${updated.name}`);
  appendChat(chatEntry("system", `Updated part ${updated.name}.`));
  if (source === undefined) {
    return { result: { ok: true, definitionId, revision: updated.revision } };
  }
  const state = await waitForCompile(definitionId, updated.revision);
  if (state?.status === "error") {
    appendChat(chatEntry("system", `Compile failed for ${updated.name}.`, "model will revise"));
    return {
      result: {
        ok: false,
        definitionId,
        revision: updated.revision,
        status: "error",
        error: state.error,
        logs: state.logs,
      },
    };
  }
  appendChat(chatEntry("system", `Recompiled ${updated.name} · ${state?.metrics?.triangles ?? 0} triangles.`));
  return {
    result: {
      ok: true,
      definitionId,
      revision: updated.revision,
      status: state?.status ?? "queued",
      metrics: state?.metrics,
    },
  };
}

const TOOL_ACTIVITY: Record<string, string> = {
  list_model: "Reading the model",
  get_definition: "Reading the part source",
  create_definition: "Creating a part",
  update_definition: "Updating a part",
  delete_definition: "Deleting a part",
  create_group: "Building the assembly tree",
  update_group: "Updating the assembly tree",
  delete_group: "Deleting a group",
  create_instance: "Placing a part",
  update_instance: "Updating a part",
  delete_instance: "Deleting a part",
  create_driver: "Adding a driver",
  update_driver: "Updating a driver",
  delete_driver: "Deleting a driver",
  create_joint: "Adding a joint",
  update_joint: "Updating a joint",
  delete_joint: "Deleting a joint",
  render_views: "Rendering inspection views",
  web_research: "Researching",
  ask_user: "Asking for input",
  answer_user: "Answering",
};

async function executeTool(call: AgentToolCall): Promise<ToolOutcome> {
  const name = call.function?.name;
  const args = parseArgs(call.function?.arguments) ?? {};
  if (!name) return { result: { ok: false, error: "Unknown tool call." } };
  if (TOOL_ACTIVITY[name]) setActivity(TOOL_ACTIVITY[name]);

  switch (name) {
    case "list_model":
      return {
        result: {
          ok: true,
          model: modelSummary(
            useStudioV2.getState().document,
            useStudioV2.getState().compileStates,
            useStudioV2.getState().selectedInstanceId,
            useStudioV2.getState().selectedDefinitionId,
            Boolean(args.includeSource),
          ),
        },
      };

    case "get_definition": {
      const definitionId = asString(args.definitionId);
      const definition = definitionId ? definitionById(definitionId) : undefined;
      if (!definition) return { result: { ok: false, error: "Definition not found." } };
      const state = useStudioV2.getState().compileStates[definition.id];
      return {
        result: {
          ok: true,
          definition: {
            ...definition,
            status: state?.status ?? "idle",
            error: state?.error,
            logs: state?.logs,
            metrics: state?.metrics,
          },
        },
      };
    }

    case "create_definition":
      return createDefinition(args);

    case "update_definition":
      return updateDefinition(args);

    case "delete_definition": {
      const definitionId = asString(args.definitionId);
      const baseRevision = asNumber(args.baseRevision);
      if (!definitionId || baseRevision === undefined) {
        return { result: { ok: false, error: "definitionId and baseRevision are required." } };
      }
      const ok = useStudioV2.getState().run({
        kind: "delete_definition",
        payload: { definitionId },
        targetRevision: baseRevision,
        label: "Delete part",
      });
      if (!ok) return failure();
      appendChat(chatEntry("system", "Deleted a part definition."));
      return { result: { ok: true, definitionId } };
    }

    case "create_group": {
      const groupName = asString(args.name)?.trim();
      if (!groupName) return { result: { ok: false, error: "name is required." } };
      const id = newId("group");
      const ok = useStudioV2.getState().run({
        kind: "create_group",
        payload: {
          group: {
            id,
            name: groupName,
            parentId: asString(args.parentId) ?? null,
            transform: transformFrom(args),
            visible: true,
            locked: false,
            expanded: true,
          },
        },
        label: `Create group ${groupName}`,
      });
      if (!ok) return failure();
      appendChat(chatEntry("system", `Created group ${groupName}.`));
      return { result: { ok: true, groupId: id, revision: 1 } };
    }

    case "update_group": {
      const groupId = asString(args.groupId);
      const baseRevision = asNumber(args.baseRevision);
      if (!groupId || baseRevision === undefined) {
        return { result: { ok: false, error: "groupId and baseRevision are required." } };
      }
      const current = useStudioV2.getState().document.groups.find((group) => group.id === groupId);
      if (!current) return { result: { ok: false, error: "Group not found." } };
      if (current.revision !== baseRevision) {
        return {
          result: { ok: false, conflict: true, currentRevision: current.revision, error: "Group changed; re-read it." },
        };
      }
      const patch: Record<string, unknown> = {};
      const name = asString(args.name);
      if (name?.trim()) patch.name = name.trim();
      if (args.parentId !== undefined) patch.parentId = asString(args.parentId) ?? null;
      if (args.position !== undefined || args.rotation !== undefined) patch.transform = transformFrom(args, current.transform);
      const visible = asBool(args.visible);
      if (visible !== undefined) patch.visible = visible;
      const locked = asBool(args.locked);
      if (locked !== undefined) patch.locked = locked;
      const ok = useStudioV2.getState().run({
        kind: "update_group",
        payload: { groupId, patch: patch as never },
        targetRevision: baseRevision,
        label: "Update group",
      });
      if (!ok) return failure();
      return { result: { ok: true, groupId, revision: current.revision + 1 } };
    }

    case "delete_group": {
      const groupId = asString(args.groupId);
      const baseRevision = asNumber(args.baseRevision);
      if (!groupId || baseRevision === undefined) {
        return { result: { ok: false, error: "groupId and baseRevision are required." } };
      }
      const ok = useStudioV2.getState().run({
        kind: "delete_group",
        payload: { groupId, cascade: Boolean(args.cascade) },
        targetRevision: baseRevision,
        label: "Delete group",
      });
      if (!ok) return failure();
      return { result: { ok: true, groupId } };
    }

    case "create_instance": {
      const definitionId = asString(args.definitionId);
      const definition = definitionId ? definitionById(definitionId) : undefined;
      if (!definition) return { result: { ok: false, error: "Definition not found." } };
      const id = newId("inst");
      const material = parseMaterial(args.material);
      const requestedMode = args.materialMode;
      const instance: Omit<PartInstance, "revision"> = {
        id,
        definitionId: definition.id,
        name: asString(args.name)?.trim() || definition.name,
        parentId: asString(args.parentId) ?? null,
        transform: transformFrom(args),
        material,
        materialMode: isMaterialMode(requestedMode)
          ? requestedMode
          : material
            ? "override"
            : undefined,
        paramOverrides: parseOverrides(args.paramOverrides),
        visible: true,
        locked: false,
        suppressed: false,
      };
      const ok = useStudioV2.getState().run({
        kind: "create_instance",
        payload: { instance },
        label: `Place ${instance.name}`,
      });
      if (!ok) return failure();
      setActivity(`Placed ${instance.name}`);
      appendChat(chatEntry("system", `Placed ${instance.name}.`));
      return { result: { ok: true, instanceId: id, revision: 1 } };
    }

    case "update_instance": {
      const instanceId = asString(args.instanceId);
      const baseRevision = asNumber(args.baseRevision);
      if (!instanceId || baseRevision === undefined) {
        return { result: { ok: false, error: "instanceId and baseRevision are required." } };
      }
      const current = instanceById(instanceId);
      if (!current) return { result: { ok: false, error: "Instance not found." } };
      if (current.revision !== baseRevision) {
        return {
          result: {
            ok: false,
            conflict: true,
            currentRevision: current.revision,
            error: "The instance changed since you read it. Re-read it and retry.",
          },
        };
      }
      const patch: Partial<PartInstance> = {};
      const name = asString(args.name);
      if (name?.trim()) patch.name = name.trim();
      const definitionId = asString(args.definitionId);
      if (definitionId) patch.definitionId = definitionId;
      if (args.parentId !== undefined) patch.parentId = asString(args.parentId) ?? null;
      if (args.position !== undefined || args.rotation !== undefined) {
        patch.transform = transformFrom(args, current.transform);
      }
      const material = parseMaterial(args.material);
      const requestedMode = args.materialMode;
      if (isMaterialMode(requestedMode)) patch.materialMode = requestedMode;
      else if (material) patch.materialMode = "override";
      if (material) {
        patch.material = material;
      }
      const overrides = parseOverrides(args.paramOverrides);
      if (overrides) patch.paramOverrides = overrides;
      const visible = asBool(args.visible);
      if (visible !== undefined) patch.visible = visible;
      const locked = asBool(args.locked);
      if (locked !== undefined) patch.locked = locked;
      const suppressed = asBool(args.suppressed);
      if (suppressed !== undefined) patch.suppressed = suppressed;
      if (!Object.keys(patch).length) return { result: { ok: false, error: "No changes supplied." } };
      const ok = useStudioV2.getState().run({
        kind: "update_instance",
        payload: { instanceId, patch },
        targetRevision: baseRevision,
        label: "Update instance",
      });
      if (!ok) return failure();
      const updated = instanceById(instanceId);
      return { result: { ok: true, instanceId, revision: updated?.revision ?? current.revision + 1 } };
    }

    case "delete_instance": {
      const instanceId = asString(args.instanceId);
      const baseRevision = asNumber(args.baseRevision);
      if (!instanceId || baseRevision === undefined) {
        return { result: { ok: false, error: "instanceId and baseRevision are required." } };
      }
      const ok = useStudioV2.getState().run({
        kind: "delete_instance",
        payload: { instanceId },
        targetRevision: baseRevision,
        label: "Delete instance",
      });
      if (!ok) return failure();
      appendChat(chatEntry("system", "Removed an instance."));
      return { result: { ok: true, instanceId } };
    }

    case "create_driver": {
      const driverName = asString(args.name)?.trim();
      const value = asNumber(args.value);
      const min = asNumber(args.min);
      const max = asNumber(args.max);
      if (!driverName || value === undefined || min === undefined || max === undefined) {
        return { result: { ok: false, error: "name, value, min and max are required." } };
      }
      const id = newId("driver");
      const ok = useStudioV2.getState().run({
        kind: "create_driver",
        payload: {
          driver: {
            id,
            name: driverName,
            value,
            min,
            max,
            step: asNumber(args.step) ?? 1,
            unit: asString(args.unit) ?? "deg",
          },
        },
        label: `Create driver ${driverName}`,
      });
      if (!ok) return failure();
      return { result: { ok: true, driverId: id, revision: 1 } };
    }

    case "update_driver": {
      const driverId = asString(args.driverId);
      const baseRevision = asNumber(args.baseRevision);
      if (!driverId || baseRevision === undefined) {
        return { result: { ok: false, error: "driverId and baseRevision are required." } };
      }
      const patch: Record<string, unknown> = {};
      for (const key of ["name", "unit"]) {
        const value = asString(args[key]);
        if (value !== undefined) patch[key] = value;
      }
      for (const key of ["value", "min", "max", "step"]) {
        const value = asNumber(args[key]);
        if (value !== undefined) patch[key] = value;
      }
      const ok = useStudioV2.getState().run({
        kind: "update_driver",
        payload: { driverId, patch: patch as never },
        targetRevision: baseRevision,
        label: "Update driver",
      });
      if (!ok) return failure();
      return { result: { ok: true, driverId } };
    }

    case "delete_driver": {
      const driverId = asString(args.driverId);
      const baseRevision = asNumber(args.baseRevision);
      if (!driverId || baseRevision === undefined) {
        return { result: { ok: false, error: "driverId and baseRevision are required." } };
      }
      const ok = useStudioV2.getState().run({
        kind: "delete_driver",
        payload: { driverId },
        targetRevision: baseRevision,
        label: "Delete driver",
      });
      if (!ok) return failure();
      return { result: { ok: true, driverId } };
    }

    case "create_joint": {
      const type = asString(args.type);
      const name = asString(args.name)?.trim();
      const parentInstanceId = asString(args.parentInstanceId);
      const childInstanceId = asString(args.childInstanceId);
      const childGroupId = asString(args.childGroupId);
      if (!type || !name || !parentInstanceId) {
        return { result: { ok: false, error: "type, name and parentInstanceId are required." } };
      }
      if (!childInstanceId && !childGroupId) {
        return { result: { ok: false, error: "A joint needs childInstanceId or childGroupId." } };
      }
      if (childInstanceId && childGroupId) {
        return { result: { ok: false, error: "Choose one child target: instance or group." } };
      }
      const id = newId("joint");
      const common = {
        id,
        name,
        enabled: asBool(args.enabled) ?? true,
        parentInstanceId,
        ...(childInstanceId ? { childInstanceId } : {}),
        ...(childGroupId ? { childGroupId } : {}),
      };
      let joint: Record<string, unknown>;
      if (type === "link") {
        const targetInstanceId = asString(args.targetInstanceId);
        if (!targetInstanceId) return { result: { ok: false, error: "Link joints need targetInstanceId." } };
        joint = {
          ...common,
          type,
          targetInstanceId,
          parentPoint: asVec3(args.parentPoint) ?? [0, 0, 0],
          childPoint: asVec3(args.childPoint) ?? [0, 0, 0],
          targetPoint: asVec3(args.targetPoint) ?? [0, 0, 0],
          stretch: asBool(args.stretch) ?? false,
        };
      } else {
        const axis = asVec3(args.axis);
        if (!axis) return { result: { ok: false, error: `${type} joints need an axis.` } };
        joint = {
          ...common,
          type,
          axis,
          origin: asVec3(args.origin) ?? [0, 0, 0],
          driverId: asString(args.driverId),
          expression: asString(args.expression) ?? "angle",
          limits: Array.isArray(args.limits) && args.limits.length === 2 ? args.limits : undefined,
        };
      }
      const ok = useStudioV2.getState().run({
        kind: "create_joint",
        payload: { joint: joint as never },
        label: `Create joint ${name}`,
      });
      if (!ok) return failure();
      return { result: { ok: true, jointId: id, revision: 1 } };
    }

    case "update_joint": {
      const jointId = asString(args.jointId);
      const baseRevision = asNumber(args.baseRevision);
      if (!jointId || baseRevision === undefined) {
        return { result: { ok: false, error: "jointId and baseRevision are required." } };
      }
      const patch: Record<string, unknown> = {};
      for (const key of ["name", "expression", "driverId", "childInstanceId", "childGroupId", "targetInstanceId"]) {
        const value = asString(args[key]);
        if (value !== undefined) patch[key] = value;
      }
      for (const key of ["axis", "origin", "parentPoint", "childPoint", "targetPoint"]) {
        const value = asVec3(args[key]);
        if (value !== undefined) patch[key] = value;
      }
      for (const key of ["enabled", "stretch"]) {
        const value = asBool(args[key]);
        if (value !== undefined) patch[key] = value;
      }
      if (Array.isArray(args.limits) && args.limits.length === 2) patch.limits = args.limits;
      const ok = useStudioV2.getState().run({
        kind: "update_joint",
        payload: { jointId, patch },
        targetRevision: baseRevision,
        label: "Update joint",
      });
      if (!ok) return failure();
      return { result: { ok: true, jointId } };
    }

    case "delete_joint": {
      const jointId = asString(args.jointId);
      const baseRevision = asNumber(args.baseRevision);
      if (!jointId || baseRevision === undefined) {
        return { result: { ok: false, error: "jointId and baseRevision are required." } };
      }
      const ok = useStudioV2.getState().run({
        kind: "delete_joint",
        payload: { jointId },
        targetRevision: baseRevision,
        label: "Delete joint",
      });
      if (!ok) return failure();
      return { result: { ok: true, jointId } };
    }

    case "web_research": {
      const query = asString(args.query)?.trim() ?? "";
      const url = asString(args.url)?.trim();
      const depth = asString(args.depth) === "deep" ? "deep" : "quick";
      if (!query && !url) return { result: { ok: false, error: "A query or URL is required." } };
      try {
        const response = await fetch("/api/studio2/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, url, depth }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          query?: string;
          provider?: string;
          warning?: string;
          error?: string;
          sources?: ResearchSource[];
        };
        if (!response.ok) {
          return { result: { ok: false, error: data.error ?? `Research failed (HTTP ${response.status}).` } };
        }
        const sources = Array.isArray(data.sources)
          ? data.sources.filter(
              (source): source is ResearchSource =>
                Boolean(
                  source &&
                    typeof source.title === "string" &&
                    typeof source.url === "string" &&
                    typeof source.host === "string" &&
                    typeof source.snippet === "string",
                ),
            )
          : [];
        if (sources.length) {
          const entry = chatEntry("system", `Researched: ${query || url}`);
          entry.sources = sources;
          appendChat(entry);
          setActivity(`Researched ${query || url}`);
        }
        return {
          result: {
            ok: Boolean(sources.length) && !data.error,
            query: data.query ?? query,
            provider: data.provider,
            sources,
            warning: data.warning,
            error: data.error,
          },
        };
      } catch (error) {
        return { result: { ok: false, error: error instanceof Error ? error.message : "Research failed." } };
      }
    }

    case "render_views": {
      const views = Array.isArray(args.views)
        ? args.views.filter((view): view is string => typeof view === "string")
        : [];
      if (!views.length) return { result: { ok: false, error: "Choose one or more views." } };
      const state = useStudioV2.getState();
      if (!Object.keys(state.variants).length) {
        return { result: { ok: false, error: "Nothing is compiled yet. Build a part first." } };
      }
      try {
        const focus = Array.isArray(args.focusInstanceIds)
          ? args.focusInstanceIds.filter((id): id is string => typeof id === "string")
          : undefined;
        const hidden = Array.isArray(args.hiddenInstanceIds)
          ? args.hiddenInstanceIds.filter((id): id is string => typeof id === "string")
          : undefined;
        const sheet = await renderAssemblySheet(state.document, state.variants, state.document.name, views, {
          focusInstanceIds: focus,
          hiddenInstanceIds: hidden,
          instanceVariants: state.instanceVariants,
        });
        useStudioV2.setState({ inspection: { dataUrl: sheet.dataUrl, views: sheet.views, title: state.document.name } });
        setActivity(`Rendered ${sheet.views.join(", ")}`);
        appendChat(chatEntry("system", `Rendered inspection · ${sheet.views.join(" · ")}`));
        return {
          result: { ok: true, views: sheet.views, width: sheet.width, height: sheet.height },
          extraMessages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Inspection sheet for ${sheet.views.join(", ")}. Use it as evidence; render more views or revise if needed.`,
                },
                { type: "image_url", image_url: { url: sheet.dataUrl } },
              ],
            },
          ],
        };
      } catch (error) {
        return { result: { ok: false, error: error instanceof Error ? error.message : "Render failed." } };
      }
    }

    case "ask_user": {
      const question = asString(args.question)?.trim();
      if (!question) return { result: { ok: false, error: "A question is required." } };
      const options = Array.isArray(args.options)
        ? args.options.flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const record = item as Record<string, unknown>;
            return typeof record.label === "string"
              ? [{ label: record.label, description: asString(record.description) }]
              : [];
          })
        : [];
      const pending: PendingQuestion = {
        toolCallId: call.id ?? `tool-${newId("ask")}`,
        question,
        header: asString(args.header),
        options,
        allowCustom: asBool(args.allowCustom) !== false,
      };
      useStudioV2.setState({ pendingQuestion: pending, agentStatus: "paused", agentActivity: ["Waiting for your answer"] });
      return { result: { ok: true, waiting: true }, stop: "ask" };
    }

    case "answer_user": {
      const text = asString(args.message)?.trim();
      return { result: { ok: true, delivered: true }, stop: "answer", text: text || "Done." };
    }

    default:
      return { result: { ok: false, error: `Unknown tool ${name}.` } };
  }
}

function finishWithAnswer(text: string) {
  const state = useStudioV2.getState();
  const note = state.agentModel ? `${state.agentModel} · agent` : "DeepSeek V4.1 Flash · agent";
  useStudioV2.setState({
    agentStatus: "idle",
    agentActivity: [],
    agentError: null,
    chat: [...state.chat, chatEntry("assistant", text, note)],
  });
}

function finishWithError(message: string) {
  if (streamingChatId) {
    const current = useStudioV2.getState().chat.find((entry) => entry.id === streamingChatId);
    if (!current?.text.trim()) clearStreaming();
    else finalizeStreaming("interrupted");
  }
  useStudioV2.setState({
    agentStatus: "error",
    agentActivity: [],
    agentError: message,
  });
}

async function runLoop(token: number) {
  if (token !== requestSeq) return;
  const state = useStudioV2.getState();
  if (state.agentBudget > 0 && state.agentSteps >= state.agentBudget) {
    finishWithError(`The agent reached its ${state.agentBudget}-step budget. Extend the budget or narrow the request.`);
    return;
  }
  useStudioV2.setState({ agentStatus: "thinking" });
  let payload: {
    content?: string;
    tool_calls?: AgentToolCall[];
    model?: string;
    truncated?: boolean;
  };
  try {
    const agentSession = sessionId();
    const response = await fetch("/api/studio2/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cadgo-session": agentSession },
      signal: abortController?.signal,
      body: JSON.stringify({
        messages: pruneMessages(state.agentMessages),
        modelState: JSON.stringify(
          modelSummary(state.document, state.compileStates, state.selectedInstanceId, state.selectedDefinitionId),
        ),
        sessionId: agentSession,
        stream: true,
      }),
    });

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream") && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: string | null = null;
      let final: typeof payload | null = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const dataLine = event.split("\n").find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          let data: {
            type?: string;
            content?: string;
            message?: string | typeof payload;
          };
          try {
            data = JSON.parse(dataLine.slice(5).trim()) as typeof data;
          } catch {
            continue;
          }
          if (data.type === "delta" && data.content) appendStreaming(data.content);
          if (data.type === "reasoning" && data.content) appendReasoning(data.content);
          if (data.type === "error") {
            streamError =
              typeof data.message === "string" ? data.message : "The CAD agent stream failed.";
          }
          if (data.type === "done" && data.message && typeof data.message === "object") {
            final = data.message;
          }
        }
        if (final || streamError) break;
      }
      if (streamError) throw new Error(streamError);
      if (!final) throw new Error("The CAD agent stream ended before a result.");
      payload = final;
    } else {
      const text = await response.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        if (!text.trim().startsWith("<")) {
          throw new Error(`The agent API returned an unreadable response (HTTP ${response.status}).`);
        }
        const oldBuildHint =
          response.status === 404
            ? " The host may also be running an older Cadgo build; redeploy or open the current /studio host."
            : "";
        throw new Error(
          `The Cadgo agent host ended the request (HTTP ${response.status}). Your work is safe. Retry.${oldBuildHint} A serverless host can cap a single function request; a long-running host does not.`,
        );
      }
      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : `The CAD agent endpoint returned HTTP ${response.status}.`,
        );
      }
      payload = data as typeof payload;
    }
  } catch (error) {
    if (token !== requestSeq || (error instanceof Error && error.name === "AbortError")) return;
    finishWithError(error instanceof Error ? error.message : "The CAD agent failed.");
    return;
  }
  if (token !== requestSeq) return;

  if (isEmptyAgentResponse(payload)) {
    const current = useStudioV2.getState();
    const step = current.agentSteps + 1;
    if (current.agentBudget > 0 && step > current.agentBudget) {
      finishWithError(
        "The model returned an empty response repeatedly. Try again or split the request into smaller steps.",
      );
      return;
    }
    if (streamingChatId) {
      const entry = current.chat.find((item) => item.id === streamingChatId);
      if (!entry?.text.trim()) clearStreaming();
      else finalizeStreaming("continuing");
    }
    useStudioV2.setState((state) => ({
      agentSteps: step,
      agentActivity: [
        ...state.agentActivity.slice(-5),
        `Empty response; continuing · step ${step}${state.agentBudget > 0 ? `/${state.agentBudget}` : ""}`,
      ],
      agentMessages: [
        ...state.agentMessages,
        {
          role: "system",
          content:
            "[EMPTY RESPONSE] Your previous response was empty. Continue the current task now, or answer the user directly. Do not repeat completed work.",
        },
      ],
    }));
    await runLoop(token);
    return;
  }

  const calls = payload.tool_calls ?? [];
  const assistant: AgentMessage = {
    role: "assistant",
    content: payload.content ?? "",
    tool_calls: calls,
  };
  if ((payload.content ?? "").trim() || calls.length) {
    useStudioV2.setState((current) => ({
      agentMessages: [...current.agentMessages, assistant],
      agentModel: payload.model ?? current.agentModel,
    }));
  } else {
    useStudioV2.setState((current) => ({
      agentModel: payload.model ?? current.agentModel,
    }));
  }

  if (payload.truncated) {
    const current = useStudioV2.getState();
    const step = current.agentSteps + 1;
    if (current.agentBudget > 0 && step > current.agentBudget) {
      finishWithError(
        "The model hit its output limit repeatedly and the step budget is exhausted. Extend the budget or split the part into smaller definitions.",
      );
      return;
    }
    if (streamingChatId) {
      const entry = current.chat.find((item) => item.id === streamingChatId);
      if (!entry?.text.trim()) clearStreaming();
      else finalizeStreaming("continued below");
    }
    useStudioV2.setState((state) => ({
      agentSteps: step,
      agentActivity: [
        ...state.agentActivity.slice(-5),
        `Continuing after output limit · step ${step}${state.agentBudget > 0 ? `/${state.agentBudget}` : ""}`,
      ],
      agentMessages: [
        ...state.agentMessages,
        {
          role: "system",
          content:
            "[CONTINUATION] The previous assistant response was cut off by the model output limit. Continue exactly from the last unfinished point. Do not repeat completed text. If a source block or tool call was cut off, restate it in smaller pieces and keep each tool call compact: create one definition at a time, then place instances. Do not ask the user to continue; continue now.",
        },
      ],
    }));
    await runLoop(token);
    return;
  }

  const streamed = Boolean(streamingChatId);
  if (!calls.length) {
    const text = payload.content?.trim() || "Done.";
    if (streamed) {
      finalizeStreaming(`${payload.model ?? "DeepSeek V4.1 Flash"} · agent`);
      useStudioV2.setState({ agentStatus: "idle", agentActivity: [], agentError: null });
    } else {
      finishWithAnswer(text);
    }
    return;
  }
  if (streamed) finalizeStreaming(`${payload.model ?? "DeepSeek V4.1 Flash"} · working`);

  for (const call of calls) {
    if (token !== requestSeq) return;
    const step = useStudioV2.getState().agentSteps + 1;
    if (useStudioV2.getState().agentBudget > 0 && step > useStudioV2.getState().agentBudget) {
      finishWithError("The agent reached its step budget. Extend the budget or narrow the request.");
      return;
    }
    useStudioV2.setState({ agentSteps: step });
    let outcome: ToolOutcome;
    try {
      outcome = await executeTool(call);
    } catch (error) {
      outcome = { result: { ok: false, error: error instanceof Error ? error.message : "Tool failed." } };
    }
    if (token !== requestSeq) return;
    if (outcome.stop === "answer") {
      appendToolResult(call, { ok: true, delivered: true });
      finishWithAnswer(outcome.text ?? "Done.");
      return;
    }
    if (outcome.stop === "ask") return;
    appendToolResult(call, outcome.result);
    appendExtraMessages(outcome.extraMessages ?? []);
  }

  await runLoop(token);
}

export async function sendAgentMessage(text: string, images?: StudioImage[]): Promise<void> {
  const trimmed = text.trim();
  const state = useStudioV2.getState();
  const attached = images ?? state.referenceImages;
  if (!trimmed && !attached.length) return;
  if (state.pendingQuestion) return answerAgentQuestion(trimmed);
  if (state.agentStatus === "thinking") return;
  clearStreaming();
  const token = ++requestSeq;
  abortController?.abort();
  abortController = new AbortController();
  const prompt = `${trimmed || "Use these images as geometric references."}${
    attached.length ? `\n\nREFERENCE VIEWS: ${attached.map((image) => image.name).join(", ")}` : ""
  }${
    state.printProfile
      ? `\n\nUSER-PROVIDED PRINT / PROCESS SETUP:\n${JSON.stringify(state.printProfile, null, 2)}`
      : ""
  }`;
  const entry = chatEntry(
    "user",
    trimmed || (attached.length > 1 ? "Reference views" : "Reference image"),
    attached.length ? `${attached.length > 1 ? "images" : "image"} · ${attached.map((image) => image.name).join(", ")}` : undefined,
  );
  if (attached.length) entry.images = attached.map((image) => image.dataUrl);
  useStudioV2.setState({
    chat: [...state.chat, entry],
    agentMessages: [
      ...state.agentMessages,
      {
        role: "user",
        content: attached.length
          ? [
              { type: "text", text: prompt },
              ...attached.map((image) => ({
                type: "image_url",
                image_url: { url: image.dataUrl },
              })),
            ]
          : prompt,
      },
    ],
    agentStatus: "thinking",
    agentActivity: ["Planning the first step"],
    agentSteps: 0,
    agentError: null,
    inspection: null,
  });
  await runLoop(token);
}

export async function answerAgentQuestion(answer: string): Promise<void> {
  const trimmed = answer.trim();
  if (!trimmed) return;
  const state = useStudioV2.getState();
  const question = state.pendingQuestion;
  if (!question) return sendAgentMessage(trimmed);
  const token = ++requestSeq;
  abortController?.abort();
  abortController = new AbortController();
  clearStreaming();
  useStudioV2.setState({
    pendingQuestion: null,
    agentStatus: "thinking",
    chat: [...state.chat, chatEntry("user", trimmed)],
    agentMessages: [
      ...state.agentMessages,
      {
        role: "tool",
        tool_call_id: question.toolCallId,
        content: JSON.stringify({ answer: trimmed }),
      },
    ],
    agentActivity: ["Continuing with your answer"],
    agentError: null,
  });
  await runLoop(token);
}

export function stopAgent() {
  requestSeq++;
  abortController?.abort();
  abortController = null;
  clearStreaming();
  useStudioV2.setState({
    agentStatus: "idle",
    agentActivity: [],
    pendingQuestion: null,
  });
}
