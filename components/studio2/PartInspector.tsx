"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { auditParameterization } from "@/lib/scad/audit";
import type { ParameterDef } from "@/lib/scad/params";
import type { GroupNode, PartDefinition, PartInstance, Transform } from "@/lib/studio/document/types";
import { useStudioV2 } from "@/lib/studio/v2/store";

function NumberField({
  label,
  value,
  step = 1,
  onCommit,
}: {
  label: string;
  value: number;
  step?: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) onCommit(parsed);
    else setDraft(String(value));
  };
  return (
    <label className="v2-field">
      <span>{label}</span>
      <input
        className="v2-input mono"
        type="number"
        step={step}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            (event.target as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}

function TransformEditor({ instance }: { instance: PartInstance }) {
  const run = useStudioV2((state) => state.run);
  const setAxis = (key: keyof Transform, index: number, value: number) => {
    const current =
      useStudioV2.getState().document.instances.find((item) => item.id === instance.id) ?? instance;
    const next: Transform = {
      position: [...current.transform.position],
      rotation: [...current.transform.rotation],
      scale: [...current.transform.scale],
    };
    next[key][index] = value;
    run({
      kind: "update_instance",
      payload: { instanceId: instance.id, patch: { transform: next } },
      targetRevision: current.revision,
      label: "Move instance",
    });
  };
  return (
    <div className="v2-transform">
      <span className="v2-section-label mono">Transform · local mm / deg</span>
      <div className="v2-field-grid">
        {(["x", "y", "z"] as const).map((axis, index) => (
          <NumberField
            key={`p-${axis}`}
            label={`P${axis.toUpperCase()}`}
            value={instance.transform.position[index]}
            onCommit={(value) => setAxis("position", index, value)}
          />
        ))}
        {(["x", "y", "z"] as const).map((axis, index) => (
          <NumberField
            key={`r-${axis}`}
            label={`R${axis.toUpperCase()}`}
            value={instance.transform.rotation[index]}
            step={5}
            onCommit={(value) => setAxis("rotation", index, value)}
          />
        ))}
      </div>
    </div>
  );
}

function ParamRow({ definition, param }: { definition: PartDefinition; param: ParameterDef }) {
  const setParam = useStudioV2((state) => state.setParam);
  const [value, setValue] = useState<number | boolean>(param.value);
  useEffect(() => setValue(param.value), [param.value]);

  if (param.type === "boolean") {
    return (
      <label className="v2-param v2-param-bool">
        <span>{param.label}</span>
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => {
            setValue(event.target.checked);
            setParam(definition.id, param.name, event.target.checked);
          }}
        />
      </label>
    );
  }

  const number = Number(value);
  return (
    <div className="v2-param">
      <div className="v2-param-head">
        <span>{param.label}</span>
        <input
          className="v2-param-number mono"
          type="number"
          min={param.min}
          max={param.max}
          step={param.step}
          value={number}
          onChange={(event) => setValue(event.target.value === "" ? param.min : Number(event.target.value))}
          onBlur={() => setParam(definition.id, param.name, Number(value))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setParam(definition.id, param.name, Number(value));
            }
          }}
        />
      </div>
      <input
        className="v2-slider"
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={number}
        onChange={(event) => setValue(Number(event.target.value))}
        onPointerUp={() => setParam(definition.id, param.name, Number(value))}
        onKeyUp={() => setParam(definition.id, param.name, Number(value))}
      />
      <span className="mono v2-param-range">
        {param.min}–{param.max} {param.description ? `· ${param.description}` : ""}
      </span>
    </div>
  );
}

function InstanceParamRow({
  instance,
  param,
}: {
  instance: PartInstance;
  param: ParameterDef;
}) {
  const run = useStudioV2((state) => state.run);
  const override = instance.paramOverrides?.[param.name];
  const effective = override ?? param.value;
  const [value, setValue] = useState<number | boolean>(effective);
  useEffect(() => setValue(effective), [effective]);

  const commit = (next: number | boolean) => {
    const current =
      useStudioV2.getState().document.instances.find((item) => item.id === instance.id) ?? instance;
    const overrides = { ...(current.paramOverrides ?? {}) };
    if (next === param.value) delete overrides[param.name];
    else overrides[param.name] = next;
    run({
      kind: "update_instance",
      payload: { instanceId: instance.id, patch: { paramOverrides: overrides } },
      targetRevision: current.revision,
      label: `Override ${param.name}`,
    });
  };

  if (param.type === "boolean") {
    return (
      <label className="v2-param v2-param-bool">
        <span>
          {param.label}
          {override !== undefined ? <em className="v2-override-badge">override</em> : null}
        </span>
        <span className="v2-override-control">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => {
              setValue(event.target.checked);
              commit(event.target.checked);
            }}
          />
          {override !== undefined ? (
            <button className="v2-icon" onClick={() => commit(param.value)} title="Reset override">
              <Icon name="refresh" size={10} />
            </button>
          ) : null}
        </span>
      </label>
    );
  }

  return (
    <div className="v2-param">
      <div className="v2-param-head">
        <span>
          {param.label}
          {override !== undefined ? <em className="v2-override-badge">override</em> : null}
        </span>
        <input
          className="v2-param-number mono"
          type="number"
          min={param.min}
          max={param.max}
          step={param.step}
          value={Number(value)}
          onChange={(event) => setValue(event.target.value === "" ? param.min : Number(event.target.value))}
          onBlur={() => commit(Number(value))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(Number(value));
            }
          }}
        />
      </div>
      <input
        className="v2-slider"
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={Number(value)}
        onChange={(event) => setValue(Number(event.target.value))}
        onPointerUp={() => commit(Number(value))}
        onKeyUp={() => commit(Number(value))}
      />
    </div>
  );
}

function DefinitionPanel({ definition }: { definition: PartDefinition }) {
  const document = useStudioV2((state) => state.document);
  const compileStates = useStudioV2((state) => state.compileStates);
  const variants = useStudioV2((state) => state.variants);
  const sourceDraft = useStudioV2((state) => state.sourceDraft);
  const dirtyDefinitionId = useStudioV2((state) => state.dirtyDefinitionId);
  const setSourceDraft = useStudioV2((state) => state.setSourceDraft);
  const clearSourceDraft = useStudioV2((state) => state.clearSourceDraft);
  const applySource = useStudioV2((state) => state.applySource);
  const addInstance = useStudioV2((state) => state.addInstance);
  const deleteSelected = useStudioV2((state) => state.deleteSelected);
  const state = compileStates[definition.id];
  const variant = variants[definition.id];
  const instances = document.instances.filter((instance) => instance.definitionId === definition.id);
  const dirty = dirtyDefinitionId === definition.id;
  const editorSource = dirty ? sourceDraft : definition.source;
  const audit = useMemo(() => auditParameterization(editorSource), [editorSource]);

  return (
    <>
      <div className="v2-inspector-title">
        <div>
          <span className="eyebrow">Part definition</span>
          <h2>{definition.name}</h2>
        </div>
        <span className={`v2-status ${state?.status ?? "idle"}`}>{state?.status ?? "idle"}</span>
      </div>

      <div className="v2-metrics">
        <div><span>Instances</span><strong className="mono">{instances.length}</strong></div>
        <div><span>Bodies</span><strong className="mono">{variant?.metrics.components ?? "—"}</strong></div>
        <div><span>Triangles</span><strong className="mono">{variant?.metrics.triangles ?? "—"}</strong></div>
        <div>
          <span>Watertight</span>
          <strong className={`mono ${variant && (variant.metrics.boundaryEdges > 0 || variant.metrics.nonManifoldEdges > 0) ? "warn" : ""}`}>
            {!variant ? "—" : variant.metrics.boundaryEdges || variant.metrics.nonManifoldEdges ? "No" : "Yes"}
          </strong>
        </div>
      </div>

      {state?.error ? (
        <div className="v2-error">
          <Icon name="warning" size={12} />
          <div>
            <strong>Compile failed.</strong>
            <p>{state.error}</p>
            {state.logs ? <pre>{state.logs}</pre> : null}
          </div>
        </div>
      ) : null}

      <div className="v2-section">
        <span className="v2-section-label mono">Dimensions</span>
        {definition.params.length ? (
          definition.params.map((param) => (
            <ParamRow key={param.name} definition={definition} param={param} />
          ))
        ) : (
          <p className="v2-muted">No top-level parameters. Add named parameters to make it editable.</p>
        )}
      </div>

      <div className="v2-section">
        <div className="v2-section-head">
          <span className="v2-section-label mono">Source</span>
          <span className={`mono ${dirty ? "warn" : "v2-muted"}`}>{dirty ? "unsaved" : "synced"}</span>
        </div>
        <textarea
          className="v2-code"
          spellCheck={false}
          value={editorSource}
          onChange={(event) => setSourceDraft(definition.id, event.target.value)}
        />
        {!audit.ok ? (
          <p className="v2-audit-warn">
            Parametric audit: {audit.issues.length} issue{audit.issues.length === 1 ? "" : "s"}. Every driving
            dimension should be a named top-level parameter.
          </p>
        ) : null}
        <div className="v2-actions">
          <button className="btn v2-small" onClick={clearSourceDraft} disabled={!dirty}>
            Revert
          </button>
          <button className="btn btn-primary v2-small" onClick={() => applySource(definition.id)} disabled={!dirty}>
            Apply source
          </button>
        </div>
      </div>

      <div className="v2-actions">
        <button className="btn v2-small" onClick={() => addInstance(definition.id)}>
          <Icon name="plus" size={11} /> Add instance
        </button>
        <button className="btn v2-small v2-danger" onClick={deleteSelected} disabled={instances.length > 0}>
          Delete part
        </button>
      </div>
    </>
  );
}

function InstancePanel({ instance }: { instance: PartInstance }) {
  const document = useStudioV2((state) => state.document);
  const run = useStudioV2((state) => state.run);
  const deleteSelected = useStudioV2((state) => state.deleteSelected);
  const selectDefinition = useStudioV2((state) => state.selectDefinition);
  const isolateInstance = useStudioV2((state) => state.isolateInstance);
  const instanceStates = useStudioV2((state) => state.instanceStates);
  const definition = document.definitions.find((item) => item.id === instance.definitionId);
  const variantState = instanceStates[instance.id];
  const patch = (patch: Partial<Pick<PartInstance, "visible" | "locked" | "suppressed">>) => {
    const current =
      useStudioV2.getState().document.instances.find((item) => item.id === instance.id) ?? instance;
    run({
      kind: "update_instance",
      payload: { instanceId: instance.id, patch },
      targetRevision: current.revision,
      label: "Update instance",
    });
  };

  return (
    <>
      <div className="v2-inspector-title">
        <div>
          <span className="eyebrow">Instance</span>
          <h2>{instance.name}</h2>
        </div>
        <span className={`v2-status ${instance.locked ? "locked" : "ready"}`}>{instance.locked ? "locked" : "live"}</span>
      </div>

      <div className="v2-definition-link">
        <span className="mono">Definition</span>
        <button className="v2-link" onClick={() => selectDefinition(instance.definitionId)}>
          {definition?.name ?? "Missing definition"}
        </button>
      </div>

      <TransformEditor instance={instance} />

      <div className="v2-toggles">
        <label>
          <input type="checkbox" checked={instance.visible} onChange={(event) => patch({ visible: event.target.checked })} />
          Visible
        </label>
        <label>
          <input type="checkbox" checked={instance.locked} onChange={(event) => patch({ locked: event.target.checked })} />
          Locked
        </label>
        <label>
          <input
            type="checkbox"
            checked={instance.suppressed}
            onChange={(event) => patch({ suppressed: event.target.checked })}
          />
          Suppressed
        </label>
      </div>

      {definition?.params.length ? (
        <div className="v2-section">
          <span className="v2-section-label mono">Part dimensions</span>
          {definition.params.map((param) => (
            <ParamRow key={param.name} definition={definition} param={param} />
          ))}
        </div>
      ) : null}

      {definition?.params.length ? (
        <details className="v2-overrides">
          <summary>
            <span className="v2-section-label mono">Instance overrides</span>
            <span className={`mono ${variantState?.status === "error" ? "warn" : "v2-muted"}`}>
              {variantState?.status ?? "definition"}
            </span>
          </summary>
          <p className="v2-override-note">
            These values apply to this instance only and compile a separate variant.
          </p>
          {definition.params.map((param) => (
            <InstanceParamRow key={param.name} instance={instance} param={param} />
          ))}
          {instance.paramOverrides && Object.keys(instance.paramOverrides).length ? (
            <button
              className="btn v2-small"
              onClick={() => {
                const current =
                  useStudioV2.getState().document.instances.find((item) => item.id === instance.id) ??
                  instance;
                run({
                  kind: "update_instance",
                  payload: { instanceId: instance.id, patch: { paramOverrides: {} } },
                  targetRevision: current.revision,
                  label: "Reset overrides",
                });
              }}
            >
              Reset all overrides
            </button>
          ) : null}
          {variantState?.error ? <p className="v2-audit-warn">{variantState.error}</p> : null}
        </details>
      ) : null}

      <div className="v2-actions">
        <button className="btn v2-small" onClick={() => isolateInstance(instance.id)}>
          Isolate
        </button>
        <button className="btn v2-small v2-danger" onClick={deleteSelected} disabled={instance.locked}>
          Delete instance
        </button>
      </div>
    </>
  );
}

function GroupPanel({ group }: { group: GroupNode }) {
  const document = useStudioV2((state) => state.document);
  const run = useStudioV2((state) => state.run);
  const childGroups = document.groups.filter((item) => item.parentId === group.id);
  const childInstances = document.instances.filter((item) => item.parentId === group.id);

  const patch = (patch: Partial<Pick<GroupNode, "visible" | "locked">>) => {
    const current = useStudioV2.getState().document.groups.find((item) => item.id === group.id) ?? group;
    run({
      kind: "update_group",
      payload: { groupId: group.id, patch },
      targetRevision: current.revision,
      label: "Update group",
    });
  };

  const setAxis = (key: "position" | "rotation", index: number, value: number) => {
    const current = useStudioV2.getState().document.groups.find((item) => item.id === group.id) ?? group;
    const transform: Transform = {
      position: [...current.transform.position],
      rotation: [...current.transform.rotation],
      scale: [...current.transform.scale],
    };
    transform[key][index] = value;
    run({
      kind: "update_group",
      payload: { groupId: group.id, patch: { transform } },
      targetRevision: current.revision,
      label: "Move group",
    });
  };

  return (
    <>
      <div className="v2-inspector-title">
        <div>
          <span className="eyebrow">Assembly group</span>
          <h2>{group.name}</h2>
        </div>
        <span className={`v2-status ${group.visible ? "ready" : "locked"}`}>
          {group.visible ? "visible" : "hidden"}
        </span>
      </div>

      <div className="v2-metrics">
        <div><span>Groups</span><strong className="mono">{childGroups.length}</strong></div>
        <div><span>Instances</span><strong className="mono">{childInstances.length}</strong></div>
        <div><span>Locked</span><strong className="mono">{group.locked ? "Yes" : "No"}</strong></div>
        <div><span>Revision</span><strong className="mono">{group.revision}</strong></div>
      </div>

      <div className="v2-transform">
        <span className="v2-section-label mono">Group transform · local mm / deg</span>
        <div className="v2-field-grid">
          {(["x", "y", "z"] as const).map((axis, index) => (
            <NumberField
              key={`gp-${axis}`}
              label={`P${axis.toUpperCase()}`}
              value={group.transform.position[index]}
              onCommit={(value) => setAxis("position", index, value)}
            />
          ))}
          {(["x", "y", "z"] as const).map((axis, index) => (
            <NumberField
              key={`gr-${axis}`}
              label={`R${axis.toUpperCase()}`}
              value={group.transform.rotation[index]}
              step={5}
              onCommit={(value) => setAxis("rotation", index, value)}
            />
          ))}
        </div>
      </div>

      <div className="v2-toggles">
        <label>
          <input type="checkbox" checked={group.visible} onChange={(event) => patch({ visible: event.target.checked })} />
          Visible
        </label>
        <label>
          <input type="checkbox" checked={group.locked} onChange={(event) => patch({ locked: event.target.checked })} />
          Locked
        </label>
      </div>
    </>
  );
}

export function PartInspector() {
  const document = useStudioV2((state) => state.document);
  const selectedInstanceId = useStudioV2((state) => state.selectedInstanceId);
  const selectedDefinitionId = useStudioV2((state) => state.selectedDefinitionId);
  const selectedGroupId = useStudioV2((state) => state.selectedGroupId);
  const instance = selectedInstanceId
    ? document.instances.find((item) => item.id === selectedInstanceId) ?? null
    : null;
  const definition = selectedDefinitionId
    ? document.definitions.find((item) => item.id === selectedDefinitionId) ?? null
    : null;
  const group = selectedGroupId
    ? document.groups.find((item) => item.id === selectedGroupId) ?? null
    : null;

  return (
    <aside className="v2-panel v2-inspector">
      <div className="v2-panel-head">
        <span className="eyebrow">Inspector</span>
        <span className="mono v2-muted">{document.units}</span>
      </div>
      <div className="v2-inspector-body">
        {instance ? (
          <InstancePanel instance={instance} />
        ) : group ? (
          <GroupPanel group={group} />
        ) : definition ? (
          <DefinitionPanel definition={definition} />
        ) : (
          <div className="v2-inspector-empty">
            <Icon name="cursor" size={18} />
            <h2>Select a part</h2>
            <p>Pick a part in the tree or in the stage. Edit its dimensions, source, and placement while the agent works.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
