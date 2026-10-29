"use client";

export function Specimen() {
  return (
    <div className="specimen">
      <img
        className="specimen-image"
        src="/hero-lamp.png"
        alt="Springline desk lamp: a jointed mechanism in anodised aluminium and brass, shown on a drafting grid."
      />
      <div className="specimen-frame">
        <span className="plate-corner tl" />
        <span className="plate-corner tr" />
        <span className="plate-corner bl" />
        <span className="plate-corner br" />
        <div className="specimen-label">
          <span className="eyebrow">Fig. 00 · specimen</span>
          <strong>Springline lamp</strong>
          <span className="mono">three hinges · one shared rest pose</span>
        </div>
        <div className="specimen-readout">
          <div className="readout-item">
            <span className="readout-label">Joints</span>
            <span className="readout-value">3</span>
          </div>
          <div className="readout-item">
            <span className="readout-label">Parts</span>
            <span className="readout-value">9</span>
          </div>
          <div className="readout-item">
            <span className="readout-label">Mass</span>
            <span className="readout-value">
              3.49<em>kg</em>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
