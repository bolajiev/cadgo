import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";

test("assembly studio loads the V8 and keeps editing live", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/studio");
  await expect(page.locator(".v2-tree")).toBeVisible({ timeout: 60_000 });

  await page.locator("summary").filter({ hasText: "Benchbook" }).click();
  await page.locator(".v2-labs summary").click();
  await page.getByText("V8 concept", { exact: true }).click();
  await expect(page.locator(".v2-stage-label")).toContainText("V8 concept");

  await expect
    .poll(
      async () => {
        const statuses = await page.locator(".v2-status").allTextContents();
        return statuses.length >= 14 && statuses.every((status) => status === "ready");
      },
      { timeout: 120_000 },
    )
    .toBe(true);

  const close = page.locator(".v2-notice button");
  if (await close.count()) await close.click();
  await page.locator(".view-controls button").filter({ hasText: "SD" }).click();
  await page.waitForTimeout(900);
  await expect(page.locator(".v2-stage")).toHaveScreenshot("v8-stage.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.04,
  });

  await page.locator('[aria-label="Toggle presentation lighting"]').click();
  await expect(page.locator(".v2-stage")).toHaveClass(/v2-stage--presentation/);
  await page.locator('[aria-label="Toggle presentation lighting"]').click();
  await expect(page.locator(".v2-stage")).not.toHaveClass(/v2-stage--presentation/);

  await page.locator(".v2-instance-row .v2-row-name").filter({ hasText: "Block" }).first().click();
  const px = page.locator(".v2-inspector .v2-field input").first();
  await expect(px).toHaveValue("0");
  await px.fill("15");
  await px.blur();
  await expect(px).toHaveValue("15");
  await page.locator('[aria-label="Undo"]').click();
  await expect(px).toHaveValue("0");

  await expect(page.locator(".v2-motion-hud")).toBeVisible();
  await page.locator('.v2-motion-hud button[aria-label="Play motion"]').click();
  await expect(page.locator(".v2-motion-value")).not.toHaveText("0deg", { timeout: 10_000 });
  await page.locator('.v2-motion-hud button[aria-label="Pause motion"]').click();

  await page.locator(".v2-inspector button").filter({ hasText: "Isolate" }).click();
  await expect(page.locator(".v2-isolate-banner")).toBeVisible();
  await page.locator(".v2-isolate-banner button").click();
  await expect(page.locator(".v2-isolate-banner")).toHaveCount(0);

  await page.locator(".v2-group-row .v2-row-name").filter({ hasText: "Heads" }).first().click();
  await expect(page.locator(".v2-inspector")).toContainText("Assembly group");
  const groupPx = page.locator(".v2-inspector .v2-field input").first();
  await groupPx.fill("15");
  await groupPx.blur();
  await expect(groupPx).toHaveValue("15");
  await page.locator('[aria-label="Undo"]').click();
  await expect(groupPx).toHaveValue("0");

  expect(pageErrors).toEqual([]);
});

test("scene export produces a valid GLB and a per-part STL archive", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/studio");
  await expect(page.locator(".v2-tree")).toBeVisible({ timeout: 60_000 });
  await page.locator("summary").filter({ hasText: "Benchbook" }).click();
  await page.locator(".v2-labs summary").click();
  await page.locator(".v2-labs button").filter({ hasText: "Wind turbine" }).click();

  await expect
    .poll(
      async () => {
        const statuses = await page.locator(".v2-status").allTextContents();
        return statuses.length === 3 && statuses.every((status) => status === "ready");
      },
      { timeout: 120_000 },
    )
    .toBe(true);

  await page.locator(".v2-export summary").click();
  const [glbDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".v2-export .menu-item").filter({ hasText: "Scene GLB" }).click(),
  ]);
  expect(glbDownload.suggestedFilename()).toBe("wind-turbine.glb");
  const glbPath = await glbDownload.path();
  expect(glbPath).toBeTruthy();
  const glb = readFileSync(glbPath as string);
  expect(glb.subarray(0, 4).toString("utf8")).toBe("glTF");
  expect(glb.readUInt32LE(4)).toBe(2);
  expect(glb.byteLength).toBe(glb.readUInt32LE(8));

  const jsonLength = glb.readUInt32LE(12);
  expect(glb.readUInt32LE(16)).toBe(0x4e4f534a);
  const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8").trim()) as {
    animations?: { name?: string; channels?: unknown[] }[];
  };
  expect(gltf.animations?.length).toBeGreaterThan(0);
  expect(gltf.animations?.[0]?.channels?.length).toBeGreaterThan(0);

  await page.locator(".v2-export summary").click();
  const [partsDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".v2-export .menu-item").filter({ hasText: "Part STLs" }).click(),
  ]);
  expect(partsDownload.suggestedFilename()).toBe("wind-turbine-parts.zip");
  const partsPath = await partsDownload.path();
  expect(partsPath).toBeTruthy();
  const archive = unzipSync(new Uint8Array(readFileSync(partsPath as string)));
  expect(Object.keys(archive)).toEqual(
    expect.arrayContaining([
      "assembly.stl",
      "manifest.json",
      "README.txt",
      "parts/01-tower.stl",
      "parts/02-nacelle.stl",
      "parts/03-rotor.stl",
    ]),
  );
  expect(archive["assembly.stl"].byteLength).toBeGreaterThan(84);

  await page.locator(".v2-export summary").click();
  await page.locator(".v2-export .menu-item").filter({ hasText: "GLB animation options" }).click();
  const dialog = page.getByRole("dialog", { name: "Scene GLB options" });
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="checkbox"]').click();
  const [staticDownload] = await Promise.all([
    page.waitForEvent("download"),
    dialog.locator(".modal-actions button").filter({ hasText: "Export GLB" }).click(),
  ]);
  const staticPath = await staticDownload.path();
  expect(staticPath).toBeTruthy();
  const staticGlb = readFileSync(staticPath as string);
  const staticJsonLength = staticGlb.readUInt32LE(12);
  const staticGltf = JSON.parse(staticGlb.subarray(20, 20 + staticJsonLength).toString("utf8").trim()) as {
    animations?: unknown[];
  };
  expect(staticGltf.animations ?? []).toHaveLength(0);

  expect(pageErrors).toEqual([]);
});

test("material controls switch between source colours and an instance override", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/studio");
  await expect(page.locator(".v2-tree")).toBeVisible({ timeout: 60_000 });
  await page.locator("summary").filter({ hasText: "Benchbook" }).click();
  await page.locator("button.chip").filter({ hasText: /^Mounting plate$/ }).click();
  await expect
    .poll(
      async () => {
        const statuses = await page.locator(".v2-status").allTextContents();
        return statuses.length === 1 && statuses[0] === "ready";
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  await page.locator("summary").filter({ hasText: "Benchbook" }).click();

  await page.locator(".v2-instance-row .v2-row-name").first().click();
  await expect(page.locator(".v2-inspector")).toContainText("Material");

  const override = page.locator(".v2-material-mode button").filter({ hasText: "Override" });
  const source = page.locator(".v2-material-mode button").filter({ hasText: "Source" });
  const colour = page.locator(".v2-color");

  await override.click();
  await expect(override).toHaveClass(/active/);
  await expect(colour).toBeEnabled();

  await source.click();
  await expect(source).toHaveClass(/active/);
  await expect(colour).toBeDisabled();

  await page.locator("canvas").click({ position: { x: 24, y: 320 } });
  await expect(page.locator(".v2-inspector")).toHaveCount(0);

  expect(pageErrors).toEqual([]);
});

test("contextual motion plays the selected group's driver", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/studio");
  await expect(page.locator(".v2-tree")).toBeVisible({ timeout: 60_000 });
  await page.locator("summary").filter({ hasText: "Benchbook" }).click();
  await page.locator(".v2-labs summary").click();
  await page.locator(".v2-labs button").filter({ hasText: "Lighthouse scene" }).click();

  await expect
    .poll(
      async () => {
        const statuses = await page.locator(".v2-status").allTextContents();
        return statuses.length === 5 && statuses.every((status) => status === "ready");
      },
      { timeout: 120_000 },
    )
    .toBe(true);

  await page.locator(".v2-group-row .v2-row-name").filter({ hasText: "Beacon" }).first().click();
  await expect(page.locator(".v2-inspector")).toContainText("Motion");
  await page.locator('.v2-inspector button[aria-label="Play beacon_angle"]').click();
  await expect(page.locator(".v2-motion-value")).not.toHaveText("0deg", { timeout: 10_000 });
  await page.locator('.v2-inspector button[aria-label="Pause beacon_angle"]').click();

  expect(pageErrors).toEqual([]);
});

test("print check uses a real print profile and reports fit and watertightness", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/studio");
  await expect(page.locator(".v2-tree")).toBeVisible({ timeout: 60_000 });
  await page.locator("summary").filter({ hasText: "Benchbook" }).click();
  await page.locator("button.chip").filter({ hasText: /^Mounting plate$/ }).click();
  await expect
    .poll(
      async () => {
        const statuses = await page.locator(".v2-status").allTextContents();
        return statuses.length === 1 && statuses[0] === "ready";
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  await page.locator("summary").filter({ hasText: "Benchbook" }).click();

  await page.locator(".v2-export summary").click();
  await page.locator(".v2-export .menu-item").filter({ hasText: "Print check" }).click();
  await expect(page.getByRole("dialog", { name: "Print check" })).toContainText("Set a 3D printing profile");
  await page.getByRole("dialog", { name: "Print check" }).locator(".modal-actions button").filter({ hasText: "Edit print setup" }).click();
  await expect(page.locator(".v2-setup-overlay")).toBeVisible();
  const bed = async (axis: "X" | "Y" | "Z", value: string) => {
    const field = page.locator(".studio-setup-fields label").filter({ hasText: `Bed ${axis}` });
    await field.locator("input").fill(value);
  };
  await bed("X", "220");
  await bed("Y", "220");
  await bed("Z", "250");
  await page.locator(".studio-setup-actions button").filter({ hasText: "Use setup" }).click();
  await expect(page.locator(".v2-setup-overlay")).toHaveCount(0);

  await page.locator(".v2-export summary").click();
  await page.locator(".v2-export .menu-item").filter({ hasText: "Print check" }).click();
  const report = page.getByRole("dialog", { name: "Print check" });
  await expect(report).toContainText("Ready to print");
  await expect(report).toContainText("Mounting plate");
  await expect(report).toContainText("fits");
  await expect(report).toContainText("Solid mass");
  expect(pageErrors).toEqual([]);
});

test("starter library examples load as single watertight parts", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const examples = ["Project box cover", "Pipe adapter", "Furniture foot", "Desk cable clip"];

  await page.goto("/studio");
  await expect(page.locator(".v2-tree")).toBeVisible({ timeout: 60_000 });

  for (const title of examples) {
    await page.locator("summary").filter({ hasText: "Benchbook" }).click();
    await page.locator(".v2-benchbook .v2-menu-item").filter({ hasText: title }).click();
    await expect
      .poll(
        async () => {
          const statuses = await page.locator(".v2-status").allTextContents();
          return statuses.length === 1 && statuses[0] === "ready";
        },
        { timeout: 60_000 },
      )
      .toBe(true);
    await page.locator(".v2-def-row .v2-row-name").filter({ hasText: title }).first().click();
    await expect(page.locator(".v2-inspector .v2-metrics")).toContainText("Watertight");
    await expect(page.locator(".v2-inspector .v2-metrics")).toContainText("Yes");
  }

  expect(pageErrors).toEqual([]);
});
