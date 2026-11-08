"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useStudioV2 } from "@/lib/studio/v2/store";
import { fileToStudioImage } from "@/lib/studio/image";
import { MarkdownText } from "./MarkdownText";
import {
  answerAgentQuestion,
  sendAgentMessage,
  stopAgent,
} from "@/lib/studio/v2/agent-runner";

function statusLabel(status: string) {
  if (status === "thinking") return "Working";
  if (status === "paused") return "Waiting";
  if (status === "error") return "Needs attention";
  return "Ready";
}

export function AgentPanel() {
  const chat = useStudioV2((state) => state.chat);
  const status = useStudioV2((state) => state.agentStatus);
  const activity = useStudioV2((state) => state.agentActivity);
  const pendingQuestion = useStudioV2((state) => state.pendingQuestion);
  const inspection = useStudioV2((state) => state.inspection);
  const steps = useStudioV2((state) => state.agentSteps);
  const budget = useStudioV2((state) => state.agentBudget);
  const error = useStudioV2((state) => state.agentError);
  const setNotice = useStudioV2((state) => state.setNotice);
  const referenceImages = useStudioV2((state) => state.referenceImages);
  const addReferenceImage = useStudioV2((state) => state.addReferenceImage);
  const removeReferenceImage = useStudioV2((state) => state.removeReferenceImage);
  const lastUser = [...chat].reverse().find((entry) => entry.role === "user");
  const [draft, setDraft] = useState("");
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status !== "thinking") {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);


  const attachImages = async (files: File[] | FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        const image = await fileToStudioImage(file);
        if (addReferenceImage(image)) {
          setNotice("Reference view attached — describe what you want from it.");
        }
      } catch (attachError) {
        setNotice(attachError instanceof Error ? attachError.message : "Could not read that image.");
      }
    }
  };

  useEffect(() => {
    const node = messagesRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chat, status, inspection]);

  const send = () => {
    const text = draft.trim();
    if (!text && !referenceImages.length) return;
    if (pendingQuestion) {
      if (!text) {
        setNotice("Type an answer to the agent's question.");
        return;
      }
      setDraft("");
      void answerAgentQuestion(text);
      return;
    }
    if (status === "thinking") {
      setNotice("Stop the current turn first, then send a new message.");
      return;
    }
    setDraft("");
    void sendAgentMessage(text, referenceImages);
  };

  return (
    <section className="v2-panel v2-agent">
      <div className="v2-panel-head">
        <span className="eyebrow">Agent</span>
        <span className="mono v2-muted">
          {statusLabel(status)}
          {status === "thinking" ? ` · ${elapsed}s` : ""} · {steps}/{budget} steps
        </span>
      </div>

      <div className="v2-agent-messages" ref={messagesRef}>
        {!chat.length ? (
          <div className="v2-agent-empty">
            <p>
              Describe a part, an assembly, or a 3D scene. The agent builds definitions and instances; you
              can edit any part while it works.
            </p>
            <div className="v2-agent-prompts">
              {[
                "Concept model: build a three-part wind turbine — fixed tower, nacelle, and a rotor on one horizontal revolute joint with a rotor_angle driver. Keep the bodies separate.",
                "Concept model: build a mechanical humanoid robot with a walk_phase driver; arms swing opposite the legs and knees bend.",
                "Inspect the current assembly: check joint axes, intersections and parameter errors. Fix what you find.",
                "Concept scene: build a low-poly lighthouse on a rocky base with a rotating beacon. Keep the parts separate, name every dimension, and add a beacon_angle driver.",
              ].map((prompt) => (
                <button key={prompt} className="v2-agent-prompt" onClick={() => setDraft(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {chat.map((entry) => (
          <div className={`v2-agent-message ${entry.role}`} key={entry.id}>
            <div className="v2-agent-message-top">
              <span className="mono">{entry.role === "user" ? "You" : entry.role === "system" ? "Agent" : "Cadgo"}</span>
            </div>
            {entry.images?.length
              ? entry.images.map((image, index) => (
                  <img className="v2-agent-image" src={image} alt={`Reference ${index + 1}`} key={index} />
                ))
              : null}
            {entry.reasoning?.trim() ? (
              <details className="v2-reasoning" open={Boolean(entry.streaming)}>
                <summary>
                  <span className="eyebrow">Thinking</span>
                </summary>
                <div className="v2-reasoning-body">{entry.reasoning}</div>
              </details>
            ) : null}
            {entry.role === "assistant" ? (
              <MarkdownText text={entry.text} />
            ) : (
              <p>{entry.text}</p>
            )}
            {entry.streaming ? <span className="v2-stream-caret" /> : null}
            {entry.note ? <span className="mono v2-agent-note">{entry.note}</span> : null}
          </div>
        ))}

        {inspection ? (
          <div className="v2-agent-inspection">
            <div className="v2-agent-inspection-head">
              <span className="eyebrow">Inspection</span>
              <a href={inspection.dataUrl} download="cadgo-inspection.jpg">
                Open sheet
              </a>
            </div>
            <a href={inspection.dataUrl} target="_blank" rel="noreferrer">
              <img src={inspection.dataUrl} alt="Assembly inspection sheet" />
            </a>
            <span className="mono">{inspection.views.join(" · ").toUpperCase()}</span>
          </div>
        ) : null}

        {pendingQuestion ? (
          <div className="v2-agent-question">
            <span className="eyebrow">{pendingQuestion.header ?? "Agent question"}</span>
            <p>{pendingQuestion.question}</p>
            {pendingQuestion.options.length ? (
              <div className="v2-agent-options">
                {pendingQuestion.options.map((option) => (
                  <button
                    key={option.label}
                    className="btn v2-small"
                    onClick={() => void answerAgentQuestion(option.label)}
                  >
                    {option.label}
                    {option.description ? <em>{option.description}</em> : null}
                  </button>
                ))}
              </div>
            ) : null}
            {pendingQuestion.allowCustom ? (
              <span className="mono v2-muted">Or type an answer below.</span>
            ) : null}
          </div>
        ) : null}

        {activity.length ? (
          <div className="v2-agent-activity">
            {activity.slice(-3).map((line, index) => (
              <span key={`${line}-${index}`} className="mono">
                {line}
              </span>
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="v2-agent-error">
            <Icon name="warning" size={11} />
            <span>{error}</span>
            <button
              className="chip"
              onClick={() => {
                if (/budget|steps/i.test(error)) {
                  useStudioV2.setState({ agentBudget: budget + 40, agentError: null, agentStatus: "idle" });
                  setNotice("Agent budget extended by 40 steps.");
                } else if (lastUser) {
                  useStudioV2.setState({ agentError: null, agentStatus: "idle" });
                  void sendAgentMessage(lastUser.text);
                } else {
                  useStudioV2.setState({ agentError: null, agentStatus: "idle" });
                }
              }}
            >
              {/budget|steps/i.test(error) ? "Extend +40" : lastUser ? "Retry" : "Dismiss"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="v2-agent-compose">
        {referenceImages.length ? (
          <div className="v2-agent-image-list">
            {referenceImages.map((image, index) => (
              <div className="v2-agent-image-preview" key={`${image.name}-${index}`}>
                <img src={image.dataUrl} alt={image.name} />
                <div>
                  <strong>{image.name}</strong>
                  <span className="mono">
                    {image.width}×{image.height} px
                  </span>
                </div>
                <button
                  className="v2-icon"
                  onClick={() => removeReferenceImage(index)}
                  aria-label="Remove reference image"
                >
                  <Icon name="close" size={11} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="v2-agent-tools">
          <button
            className="v2-agent-tool"
            onClick={() => imageRef.current?.click()}
            title="Attach a reference image"
          >
            <Icon name="image" size={11} /> Image
          </button>
          <input
            ref={imageRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="studio-file-input"
            multiple
            onChange={(event) => {
              const files = event.target.files ? Array.from(event.target.files) : [];
              event.target.value = "";
              void attachImages(files);
            }}
          />
        </div>
        <textarea
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              send();
            }
          }}
          placeholder={
            pendingQuestion
              ? "Answer the agent…"
              : status === "thinking"
                ? "Agent is working — stop to redirect…"
                : referenceImages.length
                  ? "Describe what you want from the reference views…"
                  : "Describe a part, an assembly, or a change…"
          }
        />
        <div className="v2-agent-actions">
          <span className="mono v2-muted">⌘↵ · {budget - steps} steps left</span>
          {status === "thinking" ? (
            <button className="v2-agent-stop" onClick={stopAgent}>
              Stop
            </button>
          ) : null}
          <button
            className="btn btn-primary v2-small"
            onClick={send}
            disabled={(!draft.trim() && !referenceImages.length) || status === "thinking"}
          >
            {pendingQuestion ? "Answer" : "Send"} <Icon name="arrow" size={11} />
          </button>
        </div>
      </div>
    </section>
  );
}
