"use client";

import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import type { PrintCheckReport } from "@/lib/studio/v2/print-check";

const PURPOSE_LABEL: Record<string, string> = {
  "3d-print": "3D printing",
  visualization: "Visualization",
  cnc: "CNC / laser",
  assembly: "Mechanical assembly",
};

export function PrintCheckDialog({
  report,
  compileIssues,
  onClose,
  onEditSetup,
}: {
  report: PrintCheckReport;
  compileIssues: string[];
  onClose: () => void;
  onEditSetup: () => void;
}) {
  const waiting = compileIssues.length > 0;
  const blocked = report.errors.length > 0;
  const needsProfile = !report.purpose || report.purpose !== "3d-print";
  const summary = waiting
    ? "Waiting for parts to compile"
    : !report.purpose
      ? "Set a 3D printing profile"
      : report.purpose !== "3d-print"
        ? `${PURPOSE_LABEL[report.purpose] ?? report.purpose} profile — not a print check`
        : blocked
          ? "Blocked"
          : report.warnings.length
            ? "Ready with warnings"
            : "Ready to print";
  const tone = blocked ? "bad" : waiting || needsProfile || report.warnings.length ? "warn" : "good";

  return (
    <Modal
      title="Print check"
      eyebrow="Manufacturing"
      className="modal-wide"
      onClose={onClose}
      actions={(
        <>
          <button className="btn" onClick={onEditSetup}>Edit print setup</button>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </>
      )}
    >
      <div className="print-check">
        <div className={`print-check-summary ${tone}`}>
          <strong>{summary}</strong>
          <span className="mono">
            {report.material ?? "no material"} · supports {report.supports} · overhang limit {report.overhangLimit}%
          </span>
        </div>

        {compileIssues.length ? (
          <div className="print-check-block">
            <strong>Compile</strong>
            <ul>{compileIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        ) : null}

        {report.bed && report.dimensions ? (
          <p className="print-check-brief mono">
            Assembly {formatNumber(report.dimensions.x)} × {formatNumber(report.dimensions.y)} ×{" "}
            {formatNumber(report.dimensions.z)} mm · bed {formatNumber(report.bed.x)} ×{" "}
            {formatNumber(report.bed.y)} × {formatNumber(report.bed.z)} mm ·{" "}
            {report.fitsBed === true ? "fits" : report.fitsBed === false ? "overflow" : "not checked"}
          </p>
        ) : null}

        <div className="print-check-table-wrap">
          <table className="print-check-table">
            <thead>
              <tr>
                <th>Part</th>
                <th>Watertight</th>
                <th>Overhang</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {report.parts.length ? report.parts.map((part) => (
                <tr key={part.instanceId}>
                  <td>
                    <strong>{part.name}</strong>
                    <span className="mono">{part.definitionName}</span>
                  </td>
                  <td className={part.watertight ? "good" : "bad"}>{part.watertight ? "Yes" : "No"}</td>
                  <td className={part.overhangPercent > report.overhangLimit && report.supports !== "allowed" ? "warn" : ""}>
                    {part.overhangPercent.toFixed(0)}%
                  </td>
                  <td className="mono">{(part.volumeMm3 / 1000).toFixed(1)} cm³</td>
                </tr>
              )) : (
                <tr><td colSpan={4}>No compiled parts.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="print-check-metrics mono">
          <span>Solid volume {formatNumber(report.solidVolumeMm3 / 1000)} cm³</span>
          <span>
            {report.estimatedMassG === undefined
              ? "Mass needs a known material"
              : `Solid mass ${report.estimatedMassG.toFixed(1)} g at 100% infill`}
          </span>
        </div>

        {report.errors.length ? (
          <div className="print-check-block">
            <strong>Blocking</strong>
            <ul>{report.errors.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        ) : null}

        {report.warnings.length ? (
          <div className="print-check-warn">
            <strong>Warnings</strong>
            <ul>{report.warnings.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        ) : null}

        <p className="print-check-note">
          Wall thickness and slicer time are not measured by the OpenSCAD mesh kernel. Overhang is the share of surface
          area steeper than 45° with no bed contact. Mass assumes solid material at 100% infill.
        </p>
      </div>
    </Modal>
  );
}
