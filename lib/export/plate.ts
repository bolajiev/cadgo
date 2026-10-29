"use client";

import type { CadSpec } from "@/lib/cad/types";
import { formatMass, formatVolume } from "@/lib/format";

export function downloadPlate(
  dataUrl: string,
  spec: CadSpec,
  volume: number,
  mass: number,
  parts: number,
): Promise<void> {
  const image = new Image();
  return new Promise((resolve) => {
    let done = false;
    const rawFallback = () => {
      if (done) return;
      done = true;
      const link = document.createElement("a");
      link.download = `${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-plate.png`;
      link.href = dataUrl;
      link.click();
      resolve();
    };
    const timeout = window.setTimeout(rawFallback, 2500);
    image.onload = () => {
      if (done) return;
      const width = 1800;
      const height = 1200;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rawFallback();
        return;
      }
      done = true;
      window.clearTimeout(timeout);
      ctx.fillStyle = "#fffdf7";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#cfc8b9";
    ctx.lineWidth = 1;
    ctx.strokeRect(38, 38, width - 76, height - 76);

    const margin = 110;
    const plateW = width - margin * 2;
    const plateH = 770;
    const scale = Math.min(plateW / image.width, plateH / image.height);
    const drawW = image.width * scale;
    const drawH = image.height * scale;
    ctx.drawImage(image, (width - drawW) / 2, 72 + (plateH - drawH) / 2, drawW, drawH);

    ctx.strokeStyle = "#b6ad9c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(72, 880);
    ctx.lineTo(width - 72, 880);
    ctx.stroke();

    ctx.fillStyle = "#191816";
    ctx.font = "600 34px Archivo, Helvetica, Arial, sans-serif";
    ctx.fillText(spec.name, 72, 933);
    ctx.fillStyle = "#736d61";
    ctx.font = "15px 'IBM Plex Mono', Menlo, monospace";
    ctx.fillText(spec.subtitle ?? "Parametric mechanism study", 72, 960);

    const boxX = width - 560;
    const boxY = 900;
    const boxW = 488;
    const boxH = 220;
    ctx.strokeStyle = "#b6ad9c";
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    const rows: [string, string][] = [
      ["TYPE", "CADGO / ASSEMBLY PLATE"],
      ["SCALE", "1:2"],
      ["PARTS", `${parts}`],
      ["MASS", formatMass(mass)],
      ["VOLUME", formatVolume(volume)],
      ["DATE", new Date().toISOString().slice(0, 10)],
    ];
    rows.forEach(([label, value], index) => {
      const y = boxY + 34 + index * 31;
      ctx.fillStyle = "#736d61";
      ctx.font = "11px 'IBM Plex Mono', Menlo, monospace";
      ctx.fillText(label, boxX + 20, y);
      ctx.fillStyle = "#191816";
      ctx.font = "16px 'IBM Plex Mono', Menlo, monospace";
      ctx.fillText(value, boxX + 160, y);
      if (index < rows.length - 1) {
        ctx.strokeStyle = "#e1dbcd";
        ctx.beginPath();
        ctx.moveTo(boxX + 20, y + 12);
        ctx.lineTo(boxX + boxW - 20, y + 12);
        ctx.stroke();
      }
    });

    ctx.fillStyle = "#c4472a";
    ctx.font = "12px 'IBM Plex Mono', Menlo, monospace";
    ctx.fillText("FIG. 01 / MECHANISM STUDY", 72, 82);

    ctx.strokeStyle = "#d2cbbc";
    for (const [x, y] of [
      [38, 38],
      [width - 38, 38],
      [38, height - 38],
      [width - 38, height - 38],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
    }

      const link = document.createElement("a");
      link.download = `${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-plate.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      resolve();
    };
    image.onerror = rawFallback;
    image.src = dataUrl;
  });
}
