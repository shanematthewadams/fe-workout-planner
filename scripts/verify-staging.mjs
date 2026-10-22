import { chromium, webkit, devices } from "playwright-core";
import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("qa/pilot", { recursive: true });
const origin = "https://studio-ux-streamline--fe-workout-planner.netlify.app";
const expected = process.env.GITHUB_SHA;
if (!/^[a-f0-9]{40}$/.test(expected ?? ""))
  throw Error("Expected tested GitHub SHA is required");
let matched = false;
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    const r = await fetch(origin + "/build-info.json", {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const info = await r.json();
    if (info.commit === expected && info.environment === "staging") {
      matched = true;
      break;
    }
  } catch {
    /* Netlify may still be building. */
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
assert.ok(matched, "Staging did not publish the tested commit");
console.log("Hosted build-info matches tested commit " + expected);
for (const [name, engine, device] of [
  ["desktop", chromium, { viewport: { width: 1440, height: 1000 } }],
  ["mobile-webkit", webkit, devices["iPhone 13"]],
]) {
  const browser = await engine.launch();
  const context = await browser.newContext({
    ...device,
    ignoreHTTPSErrors: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Never contact cloud/auth/provider services or mutate real records during hosted smoke.
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return u.origin === origin && !u.pathname.startsWith("/api/")
      ? route.continue()
      : route.abort();
  });
  try {
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "Use offline template", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save workout", exact: true })
      .click();
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem("fe-planner:v1")).workouts[0],
    );
    await page
      .getByRole("button", { name: "Preview & print", exact: true })
      .click();
    assert.equal(new URL(page.url()).hash, "#workout/" + saved.id);
    await page.reload();
    await page
      .getByRole("heading", { name: saved.title, exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Lead workout", exact: true })
      .click();
    assert.equal(new URL(page.url()).hash, "#lead/" + saved.id);
    await page
      .getByRole("button", { name: "Session timer", exact: true })
      .click();
    await page.clock.install();
    await page
      .getByRole("button", { name: "Start timer", exact: true })
      .click();
    await page.getByRole("button", { name: "Pause", exact: true }).waitFor();
    await page.clock.runFor(75000);
    await expect(page.getByRole("timer")).toHaveText("43:45");
    await page
      .getByRole("button", { name: "← Back to plan", exact: true })
      .click();
    const menu = page.getByRole("button", { name: "Menu", exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("link", { name: "My Workouts", exact: true }).click();
    await page.getByRole("button", { name: saved.title, exact: true }).click();
    await page
      .getByRole("button", { name: "Lead workout", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Session timer", exact: true })
      .click();
    await expect(page.getByRole("timer")).toHaveText("43:45");
    await page.reload();
    await page
      .getByRole("heading", { name: saved.title, exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Session timer", exact: true })
      .click();
    await expect(page.getByRole("timer")).toHaveText("43:45");
    await page.getByRole("button", { name: "Resume", exact: true }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    await page.screenshot({
      path: `qa/pilot/hosted-${name}.png`,
      fullPage: true,
    });
    console.log(
      name +
        ": hosted saved-ID, bookmark reload, My Workouts and 43:45 timer recovery passed; no page errors or overflow.",
    );
  } finally {
    await context.close();
    await browser.close();
  }
}

const response = await fetch(origin + "/api/nation-directory", {
  signal: AbortSignal.timeout(45000),
});
const nation = await response.json().catch(() => ({ reason: "not-json" }));
const report = {
  commit: expected,
  checkedAt: new Date().toISOString(),
  nation: {
    status: response.status,
    aoCount: nation.orgs?.length,
    locationCount: nation.locations?.length,
    reason: nation.reason,
  },
};
await writeFile(
  "qa/pilot/hosted-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log("Nation live read: " + JSON.stringify(report.nation));
