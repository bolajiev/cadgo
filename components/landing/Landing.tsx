"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Specimen } from "./Specimen";
import { useProject } from "@/lib/store/project";
import { EXAMPLES } from "@/lib/cad/examples";

const SUGGESTIONS = [
  "A bench vise with a sliding jaw and a brass handwheel",
  "A pan-tilt camera head with a locking knob",
  "A desk monitor arm with a tilting VESA plate",
];

const SHORT_CODES: Record<string, string> = {
  lamp: "LMP-01",
  vise: "VSE-02",
  gimbal: "PT-03",
  "monitor-arm": "MA-04",
};

export function Landing() {
  const [prompt, setPrompt] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const generate = useProject((state) => state.generate);
  const loadExample = useProject((state) => state.loadExample);
  const loadRecent = useProject((state) => state.loadRecent);
  const recents = useProject((state) => state.recents);
  const status = useProject((state) => state.status);

  const submit = () => {
    if (prompt.trim().length < 3) return;
    generate(prompt);
  };

  return (
    <main className="landing" id="top">
      <section className="landing-left">
        <div className="landing-kicker">
          <span className="eyebrow">Cadgo / AI mechanism workbench</span>
          <span className="rule" />
          <span className="eyebrow" style={{ color: "var(--accent)" }}>
            Build 2026
          </span>
        </div>

        <h1 className="landing-title">
          Say it.
          <br />
          Shape it.
          <br />
          Set it <em>in motion.</em>
        </h1>

        <p className="landing-sub">
          Cadgo turns a plain-language brief into a <strong>parametric, jointed 3D assembly</strong> you can
          move, edit and export. Not a static mesh — a small machine with parts, hinges, limits and a
          working motion.
        </p>

        <div className="prompt-card">
          <label className="sr-only" htmlFor="landing-prompt">
            Describe a mechanism
          </label>
          <textarea
            ref={textarea}
            id="landing-prompt"
            className="brief-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="A spring-balanced desk lamp with a heavy base, two hinged arms, a conical shade and brass joints…"
            rows={3}
          />
          <div className="brief-actions">
            <span className="hint">⌘↵ to draft · mm units · no account</span>
            <button
              className="draft-btn"
              onClick={submit}
              disabled={prompt.trim().length < 3 || status === "drafting"}
            >
              Draft it <Icon name="arrow" />
            </button>
          </div>
        </div>

        <div className="landing-examples">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              className="chip"
              onClick={() => {
                setPrompt(suggestion);
                textarea.current?.focus();
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>

        {recents.length ? (
          <div className="landing-recents">
            <span className="eyebrow">Recent</span>
            {recents.slice(0, 3).map((project) => (
              <button key={project.id} className="recent-chip" onClick={() => loadRecent(project.id)}>
                <span className="status-dot" />
                {project.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="landing-meta">
          <span>No account</span>
          <span>Runs in the browser</span>
          <span>STL / GLB / share</span>
          <span>Built for Victoria VR Hackathon 2026</span>
        </div>
      </section>

      <aside className="landing-right" aria-label="Live specimen">
        <Specimen />
      </aside>

      <section className="example-shelf" id="benchbook">
        <div className="example-shelf-head">
          <div>
            <span className="eyebrow">Benchbook / selected studies</span>
            <h2 className="example-shelf-title">Start from a proven mechanism</h2>
          </div>
          <span className="eyebrow">Loads instantly · still editable</span>
        </div>
        <div className="example-grid">
          {EXAMPLES.map((example, index) => (
            <button
              key={example.id}
              className="example-card"
              onClick={() => loadExample(example.spec, example.prompt)}
            >
              <div className="example-thumb">
                <img src={`/examples/${example.id}.png`} alt={`${example.spec.name} rendered study`} loading="lazy" />
                <span className="example-index mono">{SHORT_CODES[example.id] ?? `0${index + 1}`}</span>
                <span className="example-category mono">{example.category}</span>
                <span className="example-specimen mono">{example.specimen}</span>
                <span className="example-load">
                  Load <Icon name="arrow" />
                </span>
              </div>
              <div className="example-info">
                <div className="example-name">{example.spec.name}</div>
                <div className="example-prompt">{example.prompt}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="how-strip" id="how">
        <div className="how-step">
          <span className="how-num mono">01</span>
          <div>
            <strong>Describe the mechanism</strong>
            <p>Plain language, real dimensions, materials and the motion you want.</p>
          </div>
        </div>
        <div className="how-step">
          <span className="how-num mono">02</span>
          <div>
            <strong>The drafter writes a CadSpec</strong>
            <p>Parts, features, parameters and a joint graph — validated before it reaches the kernel.</p>
          </div>
        </div>
        <div className="how-step">
          <span className="how-num mono">03</span>
          <div>
            <strong>Move it, edit it, take it</strong>
            <p>Drag joints, change dimensions, cut a hole, export STL/GLB or share the assembly.</p>
          </div>
        </div>
        <div className="how-credit">
          <span className="eyebrow">Built with</span>
          <span className="mono">Manifold · Three.js · DeepSeek V4.1 Flash</span>
        </div>
      </section>
    </main>
  );
}
