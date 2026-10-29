import { compileSpec } from "../lib/cad/engine";
import { normalizeSpec, validateSpec } from "../lib/cad/validate";
import { EXAMPLES } from "../lib/cad/examples";

async function main() {
  let failed = false;
  for (const example of EXAMPLES) {
    const spec = normalizeSpec(example.spec);
    const issues = validateSpec(spec).filter((issue) => issue.level === "error");
    const result = await compileSpec(spec);
    const ok = issues.length === 0 && result.parts.length > 0 && result.errors.length === 0;
    if (!ok) failed = true;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${example.id.padEnd(12)} parts=${result.parts.length} ` +
        `tris=${result.parts.reduce((sum, part) => sum + part.triangles, 0)} ms=${result.ms}`,
    );
    if (issues.length) console.log("  issues:", issues);
    if (result.errors.length) console.log("  errors:", result.errors);
  }
  if (failed) process.exit(1);
}

main();
