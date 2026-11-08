"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { SCAD_EXAMPLES } from "@/lib/scad/examples";
import { parseDocument } from "@/lib/studio/document/serialize";
import { useStudioV2 } from "@/lib/studio/v2/store";
import type { GroupNode, PartDefinition, PartInstance } from "@/lib/studio/document/types";

function InstanceRow({ instance, depth, definition }: { instance: PartInstance; depth: number; definition?: PartDefinition }) {
  const selected = useStudioV2((state) => state.selectedInstanceId === instance.id);
  const state = useStudioV2((state) => state.instanceStates[instance.id]);
  const run = useStudioV2((state) => state.run);
  const selectInstance = useStudioV2((state) => state.selectInstance);

  const toggle = (patch: Partial<Pick<PartInstance, "visible" | "locked">>) => {
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
    <div
      className={`v2-row v2-instance-row ${selected ? "selected" : ""}`}
      style={{ paddingLeft: depth * 12 }}
    >
      <button className="v2-row-main" onClick={() => selectInstance(instance.id)}>
        <span className="v2-tree-branch" />
        <span className="v2-row-name">{instance.name}</span>
        {definition && definition.name !== instance.name ? (
          <span className="v2-def-badge">{definition.name}</span>
        ) : null}
        {state && state.status !== "ready" ? (
          <span className={`v2-status ${state.status}`}>{state.status}</span>
        ) : null}
        {instance.suppressed ? <span className="v2-tag">off</span> : null}
      </button>
      <button
        className="v2-icon"
        title={instance.visible ? "Hide instance" : "Show instance"}
        aria-label={instance.visible ? "Hide instance" : "Show instance"}
        onClick={() => toggle({ visible: !instance.visible })}
      >
        <Icon name={instance.visible ? "eye" : "eye-off"} size={11} />
      </button>
      <button
        className="v2-icon"
        title={instance.locked ? "Unlock instance" : "Lock instance"}
        aria-label={instance.locked ? "Unlock instance" : "Lock instance"}
        onClick={() => toggle({ locked: !instance.locked })}
      >
        <span className={`v2-lock ${instance.locked ? "locked" : ""}`}>{instance.locked ? "L" : "U"}</span>
      </button>
    </div>
  );
}

function GroupRow({
  group,
  depth,
  groups,
  instances,
  definitions,
}: {
  group: GroupNode;
  depth: number;
  groups: GroupNode[];
  instances: PartInstance[];
  definitions: PartDefinition[];
}) {
  const [open, setOpen] = useState(group.expanded);
  const run = useStudioV2((state) => state.run);
  const selected = useStudioV2((state) => state.selectedGroupId === group.id);
  const selectGroup = useStudioV2((state) => state.selectGroup);
  const children = groups.filter((item) => item.parentId === group.id);
  const childInstances = instances.filter((item) => item.parentId === group.id);

  const patch = (patch: Partial<Pick<GroupNode, "visible" | "locked">>) => {
    const current = useStudioV2.getState().document.groups.find((item) => item.id === group.id) ?? group;
    run({
      kind: "update_group",
      payload: { groupId: group.id, patch },
      targetRevision: current.revision,
      label: "Update group",
    });
  };

  return (
    <div className="v2-group">
      <div
        className={`v2-row v2-group-row ${selected ? "selected" : ""}`}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          className="v2-row-main"
          onClick={() => {
            setOpen((value) => !value);
            selectGroup(group.id);
          }}
        >
          <span className="v2-caret">{open ? "▾" : "▸"}</span>
          <Icon name="folder" size={11} />
          <span className="v2-row-name">{group.name}</span>
          <span className="v2-count">{children.length + childInstances.length}</span>
        </button>
        <button
          className="v2-icon"
          title={group.visible ? "Hide group" : "Show group"}
          aria-label={group.visible ? "Hide group" : "Show group"}
          onClick={() => patch({ visible: !group.visible })}
        >
          <Icon name={group.visible ? "eye" : "eye-off"} size={11} />
        </button>
        <button
          className="v2-icon"
          title={group.locked ? "Unlock group" : "Lock group"}
          aria-label={group.locked ? "Unlock group" : "Lock group"}
          onClick={() => patch({ locked: !group.locked })}
        >
          <span className={`v2-lock ${group.locked ? "locked" : ""}`}>{group.locked ? "L" : "U"}</span>
        </button>
      </div>
      {open
        ? [
            ...children.map((child) => (
              <GroupRow
                key={child.id}
                group={child}
                depth={depth + 1}
                groups={groups}
                instances={instances}
                definitions={definitions}
              />
            )),
            ...childInstances.map((instance) => (
              <InstanceRow
                key={instance.id}
                instance={instance}
                depth={depth + 1}
                definition={definitions.find((item) => item.id === instance.definitionId)}
              />
            )),
          ]
        : null}
    </div>
  );
}

export function PartTree() {
  const document = useStudioV2((state) => state.document);
  const selectedDefinitionId = useStudioV2((state) => state.selectedDefinitionId);
  const selectDefinition = useStudioV2((state) => state.selectDefinition);
  const compileStates = useStudioV2((state) => state.compileStates);
  const addInstance = useStudioV2((state) => state.addInstance);
  const loadExample = useStudioV2((state) => state.loadExample);
  const loadV8Study = useStudioV2((state) => state.loadV8Study);
  const loadRotaryStudy = useStudioV2((state) => state.loadRotaryStudy);
  const loadHumanoidStudy = useStudioV2((state) => state.loadHumanoidStudy);
  const loadWindTurbineStudy = useStudioV2((state) => state.loadWindTurbineStudy);
  const loadLighthouseStudy = useStudioV2((state) => state.loadLighthouseStudy);
  const newPart = useStudioV2((state) => state.newPart);
  const importScad = useStudioV2((state) => state.importScad);
  const importDocument = useStudioV2((state) => state.importDocument);
  const setNotice = useStudioV2((state) => state.setNotice);
  const importRef = useRef<HTMLInputElement>(null);

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    if (/\.json$/i.test(file.name)) {
      try {
        importDocument(parseDocument(text));
        setNotice("Cadgo document imported.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Could not read that Cadgo document.");
      }
      return;
    }
    if (importScad(text, file.name)) {
      setNotice(`${file.name} added as a part.`);
    }
  };

  const rootGroups = document.groups.filter((group) => !group.parentId);
  const rootInstances = document.instances.filter((instance) => !instance.parentId);

  return (
    <aside className="v2-panel v2-tree">
      <div className="v2-panel-head">
        <span className="eyebrow">Model</span>
        <span className="mono v2-muted">
          {document.instances.length} instance{document.instances.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="v2-tree-tools">
        <button className="btn v2-small" onClick={newPart}>
          <Icon name="plus" size={11} /> New part
        </button>
        <button className="btn v2-small" onClick={() => importRef.current?.click()}>
          <Icon name="folder" size={11} /> Import
        </button>
        <details className="v2-benchbook">
          <summary className="btn v2-small">
            <Icon name="folder" size={11} /> Benchbook
          </summary>
          <div className="v2-menu">
            <span className="v2-menu-label mono">Load a study</span>
            {SCAD_EXAMPLES.map((example) => (
              <button
                key={example.id}
                className="v2-menu-item"
                onClick={(event) => {
                  loadExample(example.id);
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = false;
                }}
              >
                <span>{example.title}</span>
                <span className="mono">load</span>
              </button>
            ))}
            <div className="v2-menu-rule" />
            <details className="v2-labs">
              <summary className="v2-menu-item">
                <span>Concept labs</span>
                <span className="mono">5</span>
              </summary>
              <button
                className="v2-menu-item"
                onClick={(event) => {
                  loadV8Study();
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = false;
                  event.currentTarget.closest(".v2-benchbook")?.removeAttribute("open");
                }}
              >
                <span>V8 concept</span>
                <span className="mono">load</span>
              </button>
              <button
                className="v2-menu-item"
                onClick={(event) => {
                  loadRotaryStudy();
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = false;
                  event.currentTarget.closest(".v2-benchbook")?.removeAttribute("open");
                }}
              >
                <span>Rotary mechanism</span>
                <span className="mono">load</span>
              </button>
              <button
                className="v2-menu-item"
                onClick={(event) => {
                  loadHumanoidStudy();
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = false;
                  event.currentTarget.closest(".v2-benchbook")?.removeAttribute("open");
                }}
              >
                <span>Humanoid robot</span>
                <span className="mono">load</span>
              </button>
              <button
                className="v2-menu-item"
                onClick={(event) => {
                  loadWindTurbineStudy();
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = false;
                  event.currentTarget.closest(".v2-benchbook")?.removeAttribute("open");
                }}
              >
                <span>Wind turbine</span>
                <span className="mono">load</span>
              </button>
              <button
                className="v2-menu-item"
                onClick={(event) => {
                  loadLighthouseStudy();
                  const details = event.currentTarget.closest("details");
                  if (details) details.open = false;
                  event.currentTarget.closest(".v2-benchbook")?.removeAttribute("open");
                }}
              >
                <span>Lighthouse scene</span>
                <span className="mono">load</span>
              </button>
            </details>
          </div>
        </details>
        <input
          ref={importRef}
          type="file"
          accept=".scad,.json,.cadgo.json,text/plain,application/json"
          className="studio-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void importFile(file);
          }}
        />
      </div>

      <div className="v2-tree-list">
        {!document.definitions.length && !document.instances.length ? (
          <div className="v2-tree-empty">
            <p>No parts yet. Load a study or ask the agent to build one.</p>
            <div className="v2-tree-empty-actions">
              {["plate", "bracket"].map((id) => {
                const example = SCAD_EXAMPLES.find((item) => item.id === id);
                return example ? (
                  <button key={example.id} className="chip" onClick={() => loadExample(example.id)}>
                    {example.title}
                  </button>
                ) : null;
              })}
            </div>
          </div>
        ) : null}

        {document.groups.length || document.instances.some((instance) => !instance.parentId) ? (
          <div className="v2-tree-section">
            <span className="v2-section-label mono">Assembly</span>
            {rootGroups.map((group) => (
              <GroupRow
                key={group.id}
                group={group}
                depth={0}
                groups={document.groups}
                instances={document.instances}
                definitions={document.definitions}
              />
            ))}
            {rootInstances.map((instance) => (
              <InstanceRow
                key={instance.id}
                instance={instance}
                depth={0}
                definition={document.definitions.find((item) => item.id === instance.definitionId)}
              />
            ))}
          </div>
        ) : null}

        {document.definitions.length ? (
          <div className="v2-tree-section v2-parts-section">
            <span className="v2-section-label mono">Parts</span>
            {document.definitions.map((definition) => {
              const instances = document.instances.filter(
                (instance) => instance.definitionId === definition.id,
              );
              const state = compileStates[definition.id];
              const status = state?.status ?? "idle";
              return (
                <div
                  className={`v2-row v2-def-row ${selectedDefinitionId === definition.id ? "selected" : ""}`}
                  key={definition.id}
                >
                  <button className="v2-row-main" onClick={() => selectDefinition(definition.id)}>
                    <Icon name="cube" size={12} />
                    <span className="v2-row-name">{definition.name}</span>
                    <span className={`v2-status ${status}`}>{status}</span>
                    <span className="v2-count">{instances.length}</span>
                  </button>
                  <button
                    className="v2-icon"
                    title="Add instance"
                    aria-label={`Add instance of ${definition.name}`}
                    onClick={() => addInstance(definition.id)}
                  >
                    <Icon name="plus" size={11} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
