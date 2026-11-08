import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cadgo — from a sentence to a 3D assembly",
  description:
    "Cadgo turns plain language into editable parametric 3D assemblies and concept scenes. Local OpenSCAD compilation, named dimensions, joints and drivers, print checks, and STL/GLB/SCAD exports.",
  openGraph: {
    title: "Cadgo — from a sentence to a 3D assembly",
    description:
      "Editable parametric CAD and concept 3D scenes, built from a sentence and compiled locally in the browser.",
    type: "website",
  },
};

const GITHUB = "https://github.com/bolajiev/cadgo";

export default function LandingPage() {
  return (
    <div className="ldg">
      <header className="ldg-nav">
        <Link className="ldg-brand" href="/" aria-label="Cadgo home">
          <span className="ldg-brand-word">
            cad<span>go</span>
          </span>
          <span className="ldg-brand-badge mono">3D assembly studio</span>
        </Link>
        <nav className="ldg-nav-links" aria-label="Landing sections">
          <a href="#scope">Scope</a>
          <a href="#workflow">Workflow</a>
          <a href="#features">Features</a>
          <a href="#limits">Limits</a>
        </nav>
        <div className="ldg-nav-actions">
          <a className="ldg-ghost mono" href={GITHUB} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <Link className="btn btn-primary ldg-nav-cta" href="/studio">
            Open studio
          </Link>
        </div>
      </header>

      <main>
        <section className="ldg-hero">
          <div className="ldg-hero-copy">
            <span className="ldg-eyebrow mono">
              <span className="status-dot" /> Victoria VR AI Builder Hackathon 2026 · AI-assisted 3D editing
            </span>
            <h1>
              Describe it.
              <br />
              <em>Build it.</em>
              <br />
              Move it.
              <br />
              Export it.
            </h1>
            <p className="ldg-lede">
              Cadgo turns a plain-language brief into an editable parametric 3D assembly —
              mechanical parts, robots, props and the working motion between them. Every body
              compiles locally in your browser. No account. No server geometry.
            </p>
            <div className="ldg-actions">
              <Link className="btn btn-primary ldg-cta" href="/studio">
                Open the studio <span aria-hidden>→</span>
              </Link>
              <a className="btn ldg-cta-secondary" href={GITHUB} target="_blank" rel="noreferrer">
                View source
              </a>
            </div>
            <dl className="ldg-proof">
              <div>
                <dt className="mono">Compiler</dt>
                <dd>OpenSCAD WASM</dd>
              </div>
              <div>
                <dt className="mono">Editing</dt>
                <dd>Source + named dimensions</dd>
              </div>
              <div>
                <dt className="mono">Output</dt>
                <dd>STL · GLB · SCAD</dd>
              </div>
            </dl>
          </div>

          <figure className="ldg-hero-figure">
            <div className="ldg-frame">
              <div className="ldg-frame-media">
                <Image
                  src="/landing/lighthouse.png"
                  alt="A lighthouse concept scene in Cadgo's presentation lighting, with a driven beacon"
                  fill
                  priority
                  sizes="(max-width: 1000px) 100vw, 54vw"
                  className="ldg-img-fill"
                />
              </div>
              <span className="ldg-frame-tag mono">LIGHTHOUSE / BEACON_ANGLE</span>
              <span className="ldg-frame-corner mono">01</span>
            </div>
            <figcaption>
              <span>Five separate bodies.</span> A rotating beacon. One sentence.
            </figcaption>
          </figure>
        </section>

        <section className="ldg-section" id="scope">
          <div className="ldg-section-head">
            <span className="ldg-index mono">01 / SCOPE</span>
            <div>
              <h2>Mechanical parts and concept scenes. One assembly graph.</h2>
              <p>
                Groups, definitions, instances, joints and drivers are the same graph whether you
                are building a bracket or a lighthouse. There is no second scene pipeline to learn
                and no frozen mesh at the end.
              </p>
            </div>
          </div>
          <div className="ldg-cards">
            <article className="ldg-card">
              <div className="ldg-card-media">
                <Image
                  src="/landing/cover.png"
                  alt="A parametric project box cover open in the Cadgo inspector"
                  fill
                  sizes="(max-width: 900px) 100vw, 33vw"
                  className="ldg-img-fill"
                />
              </div>
              <div className="ldg-card-body">
                <span className="mono">REAL-WORLD STARTS</span>
                <h3>A cover, an adapter, a foot, a clip.</h3>
                <p>
                  The starter library is parametric source, not screenshots: a screw-down box
                  cover, a stepped pipe adapter, a furniture foot and a desk cable clip.
                </p>
              </div>
            </article>
            <article className="ldg-card">
              <div className="ldg-card-media">
                <Image
                  src="/landing/turbine.png"
                  alt="A three-part wind turbine assembly in Cadgo"
                  fill
                  sizes="(max-width: 900px) 100vw, 33vw"
                  className="ldg-img-fill"
                />
              </div>
              <div className="ldg-card-body">
                <span className="mono">WORKING LOGIC</span>
                <h3>A rotor that actually turns.</h3>
                <p>
                  Joints and expression-driven drivers move the assembly at render time. A group
                  joint spins the whole rotor without separating its blades.
                </p>
              </div>
            </article>
            <article className="ldg-card ldg-card-text">
              <span className="mono">EDIT EVERY LAYER</span>
              <h3>Source, dimensions, material, placement.</h3>
              <p>
                Select any body and edit its named parameters, OpenSCAD source, material override or
                transform. User edits and agent edits are immutable commands with undo, redo and
                per-node conflicts.
              </p>
              <ul>
                <li>Assembly tree and 3D selection</li>
                <li>Per-instance parameter and material overrides</li>
                <li>Inspection sheets returned to the model as vision evidence</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="ldg-section ldg-workflow" id="workflow">
          <div className="ldg-section-head">
            <span className="ldg-index mono">02 / WORKFLOW</span>
            <div>
              <h2>From a sentence to an assembly you can keep editing.</h2>
              <p>
                The agent does not stop at a picture. It writes real OpenSCAD, the browser
                compiles it, and you keep the source.
              </p>
            </div>
          </div>
          <ol className="ldg-steps">
            <li>
              <span className="mono">01</span>
              <h3>Describe</h3>
              <p>Ask for a part, a robot, a scene or a change to the model already on the stage.</p>
            </li>
            <li>
              <span className="mono">02</span>
              <h3>Compile</h3>
              <p>OpenSCAD WASM runs in browser workers. Failed parts keep the last good mesh.</p>
            </li>
            <li>
              <span className="mono">03</span>
              <h3>Edit</h3>
              <p>Drag dimensions, edit source, move bodies or change materials while the agent works.</p>
            </li>
            <li>
              <span className="mono">04</span>
              <h3>Export</h3>
              <p>Assembly STL, per-part STLs, Scene GLB with driver clips, SCAD and the native document.</p>
            </li>
          </ol>
        </section>

        <section className="ldg-section" id="features">
          <div className="ldg-section-head">
            <span className="ldg-index mono">03 / FEATURES</span>
            <div>
              <h2>Built for the edit after the first generation.</h2>
              <p>
                The interesting part of a CAD tool is not the first render. It is whether the
                second, fifth and twentieth edit are still cheap.
              </p>
            </div>
          </div>
          <div className="ldg-feature-grid">
            <article>
              <span className="mono">01</span>
              <h3>Parametric audit</h3>
              <p>Generated source is checked before it is accepted; every driving number must be named.</p>
            </article>
            <article>
              <span className="mono">02</span>
              <h3>Local compile pool</h3>
              <p>Two OpenSCAD workers, a source + parameter hash cache and last-good meshes.</p>
            </article>
            <article>
              <span className="mono">03</span>
              <h3>Revision-safe agent</h3>
              <p>Every agent mutation carries the revision it read; your edit wins on conflict.</p>
            </article>
            <article>
              <span className="mono">04</span>
              <h3>Contextual motion</h3>
              <p>Play a selected part or group from the inspector, or double-click a moving part.</p>
            </article>
            <article>
              <span className="mono">05</span>
              <h3>Print check</h3>
              <p>Watertightness, overhang, bed fit, solid volume and a material-mass estimate.</p>
            </article>
            <article>
              <span className="mono">06</span>
              <h3>Scene GLB</h3>
              <p>Group hierarchy, resolved materials and one animation clip per driver.</p>
            </article>
          </div>
        </section>

        <section className="ldg-section ldg-limits" id="limits">
          <div className="ldg-section-head">
            <span className="ldg-index mono">04 / LIMITS</span>
            <div>
              <h2>Concept 3D, stated plainly.</h2>
              <p>
                A bounded claim is more useful than a universal one. Cadgo is a concept studio, not
                a certified engineering kernel or a game engine.
              </p>
            </div>
          </div>
          <ul className="ldg-limit-list">
            <li>
              <strong>No B-Rep or STEP.</strong>
              <p>OpenSCAD is a mesh/CSG kernel. Organic surfaces and tight engineering fits are approximations.</p>
            </li>
            <li>
              <strong>No physics or gameplay.</strong>
              <p>Working logic means parametric relationships, joints and drivers — not collisions, scoring or a game engine.</p>
            </li>
            <li>
              <strong>Print checks are honest.</strong>
              <p>Watertightness, overhang, bed fit and solid mass are measured. Wall thickness and slicer time are not.</p>
            </li>
            <li>
              <strong>Local-first by design.</strong>
              <p>Documents autosave in your browser. Share links are explicit; there is no account or cloud project database.</p>
            </li>
          </ul>
        </section>

        <section className="ldg-closing">
          <div>
            <span className="mono">START HERE</span>
            <h2>Describe it. See what comes back.</h2>
            <p>Open the studio, load a study, or ask for a part you actually need.</p>
          </div>
          <div className="ldg-closing-actions">
            <Link className="btn btn-primary ldg-cta" href="/studio">
              Open the studio <span aria-hidden>→</span>
            </Link>
            <a className="btn ldg-cta-secondary" href={GITHUB} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </section>
      </main>

      <footer className="ldg-footer">
        <span>Cadgo · AI 3D assembly studio</span>
        <span className="mono">GPL-3.0 · OpenSCAD WASM · local-first</span>
        <Link className="mono" href="/studio">
          Studio
        </Link>
      </footer>
    </div>
  );
}
