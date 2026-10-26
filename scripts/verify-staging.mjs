import { chromium, webkit, devices } from "playwright-core";
import assert from "node:assert/strict";
import { expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("qa/pilot", { recursive: true });
const origin = "https://studio-ux-streamline--fe-workout-planner.netlify.app";
const expected = process.env.GITHUB_SHA;
// Keep hosted smoke isolated from real records. Use a deterministic in-memory
// cloud fixture and wait for acknowledgement before advancing virtual time:
// otherwise clock.runFor can fire fetch abort deadlines before WebKit finishes
// an intercepted network request, producing an access-control pageerror.
const cloudSnapshots = new Map();
async function isolateServices(route) {
  const url = new URL(route.request().url());
  if (url.hostname.endsWith(".supabase.co")) {
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "apikey, content-type",
      "content-type": "application/json",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (url.pathname !== "/rest/v1/rpc/fe_sync_plans")
      return route.fulfill({ status: 503, headers, body: "{}" });
    const body = route.request().postDataJSON();
    let snapshot = cloudSnapshots.get(body.sync_code) ?? {
      version: 0,
      workouts: [],
    };
    if (body.operation === "put") {
      if (body.expected_version !== snapshot.version)
        return route.fulfill({ status: 409, headers, body: "{}" });
      snapshot = { version: snapshot.version + 1, workouts: body.payload };
      cloudSnapshots.set(body.sync_code, snapshot);
    }
    return route.fulfill({
      status: 200,
      headers,
      body: JSON.stringify(snapshot),
    });
  }
  return url.origin === origin &&
    (!url.pathname.startsWith("/api/") ||
      (url.pathname === "/api/ao-intelligence" &&
        route.request().method() === "GET"))
    ? route.continue()
    : route.abort();
}

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
  // Read the public AO catalog; intercept cloud/auth/provider writes so no real records are mutated.
  await page.route("**/*", isolateServices);
  try {
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("button", { name: "Help me find one", exact: true })
      .click();
    await page.getByRole("button", { name: /Work together/ }).click();
    await page.getByLabel("Q location", { exact: true }).fill("Gold Rush");
    await page.getByRole("button", { name: /Show me some ideas/ }).click();
    await page.getByRole("button", { name: /The Buddy System/ }).click();
    await page.getByRole("button", { name: "Yes", exact: true }).click();
    await page.getByRole("button", { name: "None", exact: true }).click();
    await expect(page.locator(".ao-context .ao-source-status")).toContainText(
      "Regional AO details",
    );
    await expect(page.locator(".ao-context .ao-meeting-point")).toContainText(
      "By basketball goals",
    );
    await page
      .getByRole("button", { name: "Use offline template", exact: true })
      .click();
    await expect(page.getByText(/Saved on this device/)).toBeVisible();
    await page
      .getByLabel("Workout name", { exact: true })
      .fill("Synthetic enjoyable-flow verification");
    await expect(page.getByText(/Saved on this device/)).toBeVisible();
    await page
      .getByLabel("Your closing thought", { exact: true })
      .fill("Synthetic COT: look out for the six.");
    await expect(
      page.getByText("Saved to cloud", { exact: true }),
    ).toBeVisible();
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem("fe-planner:v1")).workouts[0],
    );
    assert.ok(
      saved.schedule.siteSummary.includes("By basketball goals"),
      "Live AO meeting point survives autosave",
    );
    const firstExercise = saved.sections[0].blocks[0].exercises[0];
    await page
      .getByRole("button", { name: `Edit ${firstExercise.name}`, exact: true })
      .click();
    await page.getByLabel("Reps or duration", { exact: true }).fill("17");
    await page
      .getByRole("button", { name: "Undo last edit", exact: true })
      .click();
    await expect(page.getByText(/Saved on this device/)).toBeVisible();
    const undone = await page.evaluate(
      () => JSON.parse(localStorage.getItem("fe-planner:v1")).workouts[0],
    );
    assert.equal(undone.id, saved.id);
    assert.deepEqual(undone.sections, saved.sections);
    await page
      .getByRole("button", { name: "Print workout", exact: true })
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
    await page.getByText("COT & Q notes", { exact: true }).click();
    await expect(
      page.getByText("Synthetic COT: look out for the six.", { exact: true }),
    ).toBeVisible();
    if (
      !(await page
        .getByRole("button", { name: "Session timer", exact: true })
        .isVisible())
    )
      await page.getByText("Timer options", { exact: true }).click();
    await page
      .getByRole("button", { name: "Session timer", exact: true })
      .click();
    // Finish the reloaded app's synthetic sync before virtual time can abort it.
    await page
      .getByRole("button", { name: "← Back to plan", exact: true })
      .click();
    await expect(
      page.getByText("Saved to cloud", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Lead workout", exact: true })
      .click();
    if (
      !(await page
        .getByRole("button", { name: "Session timer", exact: true })
        .isVisible())
    )
      await page.getByText("Timer options", { exact: true }).click();
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
    if (
      !(await page
        .getByRole("button", { name: "Session timer", exact: true })
        .isVisible())
    )
      await page.getByText("Timer options", { exact: true }).click();
    await page
      .getByRole("button", { name: "Session timer", exact: true })
      .click();
    await expect(page.getByRole("timer")).toHaveText("43:45");
    await page.reload();
    await page
      .getByRole("heading", { name: saved.title, exact: true })
      .waitFor();
    if (
      !(await page
        .getByRole("button", { name: "Session timer", exact: true })
        .isVisible())
    )
      await page.getByText("Timer options", { exact: true }).click();
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
    // A second fresh context verifies direct authoring without touching cloud records.
    const direct = await browser.newContext({
      ...device,
      ignoreHTTPSErrors: true,
      serviceWorkers: "block",
    });
    try {
      const sheet = await direct.newPage();
      const directErrors = [];
      sheet.on("pageerror", (error) => directErrors.push(error.message));
      await sheet.route("**/*", isolateServices);
      await sheet.goto(origin);
      await sheet
        .getByRole("button", { name: "Make a Weinke", exact: true })
        .click();
      const words =
        "11s: heavy squats and merkins.\nHammers 2=1. Down and back x4.";
      await sheet
        .getByLabel("Workout name (optional)", { exact: true })
        .fill("Synthetic hosted Weinke");
      await sheet.getByLabel("The Thang", { exact: true }).fill(words);
      await sheet
        .getByText("Organize The Thang into blocks (optional)", { exact: true })
        .click();
      await sheet
        .getByRole("button", { name: "Add block", exact: true })
        .click();
      await sheet
        .getByLabel("Rounds (optional)", { exact: true })
        .fill("3, together");
      await sheet
        .getByRole("button", { name: "Add exercise", exact: true })
        .click();
      await sheet.getByLabel("Exercise name", { exact: true }).fill("Hammers");
      await sheet.getByLabel("Reps or duration", { exact: true }).fill("17");
      await sheet.getByLabel("Counting", { exact: true }).selectOption("2=1");
      await sheet.reload();
      await expect(sheet.getByLabel("The Thang", { exact: true })).toHaveValue(
        words,
      );
      await sheet
        .getByRole("button", { name: "Preview my Weinke", exact: true })
        .click();
      await sheet
        .getByRole("button", { name: "Save & open Weinke", exact: true })
        .click();
      await expect(sheet).toHaveURL(/#lead\//);
      await sheet.reload();
      await expect(
        sheet.getByLabel("Workout to lead", { exact: true }),
      ).toContainText(words);
      await expect(
        sheet.getByLabel("Workout to lead", { exact: true }),
      ).toContainText("Rounds: 3, together");
      await expect(
        sheet.getByLabel("Workout to lead", { exact: true }),
      ).toContainText("Hammers · 17 reps");
      await expect(sheet.locator(".lead-workout .count-label")).toHaveText(
        "2=1",
      );
      await expect(
        sheet.getByRole("button", { name: "Session timer", exact: true }),
      ).not.toBeVisible();
      await expect(
        sheet.getByRole("button", {
          name: "No timer",
          exact: true,
          includeHidden: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
      assert.equal(
        await sheet.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await sheet.screenshot({
        path: `qa/pilot/hosted-${name}-weinke.png`,
        fullPage: true,
      });
      await sheet
        .getByRole("button", { name: "← Back to plan", exact: true })
        .click();
      const directMenu = sheet.getByRole("button", {
        name: "Menu",
        exact: true,
      });
      if (await directMenu.isVisible()) await directMenu.click();
      await sheet
        .getByRole("link", { name: "My Workouts", exact: true })
        .click();
      const card = sheet.locator(".workout-card").filter({
        has: sheet.getByRole("heading", {
          name: "Synthetic hosted Weinke",
          exact: true,
        }),
      });
      await expect(card).toContainText("AO not set · Edited");
      await card.getByRole("button", { name: "Lead", exact: true }).click();
      await expect(
        sheet.getByLabel("Workout to lead", { exact: true }),
      ).toContainText("Hammers · 17 reps");
      await sheet
        .getByRole("button", { name: "← Back to plan", exact: true })
        .click();
      if (await directMenu.isVisible()) await directMenu.click();
      await sheet.getByRole("link", { name: "Build", exact: true }).click();
      const kept = await sheet.evaluate(
        () => JSON.parse(localStorage.getItem("fe-planner:v1")).workouts,
      );
      sheet.once("dialog", (dialog) => dialog.accept());
      await sheet
        .getByRole("button", { name: "Start a new workout", exact: true })
        .click();
      await sheet.reload();
      await expect(
        sheet.getByRole("button", { name: "Make a Weinke", exact: true }),
      ).toBeVisible();
      assert.deepEqual(
        await sheet.evaluate(
          () => JSON.parse(localStorage.getItem("fe-planner:v1")).workouts,
        ),
        kept,
      );
      await sheet
        .getByRole("button", { name: "Make a Weinke", exact: true })
        .click();
      await expect(sheet.getByLabel("The Thang", { exact: true })).toHaveValue(
        "",
      );
      assert.deepEqual(directErrors, []);
      console.log(
        name +
          ": hosted structured Weinke recovery, counts, direct-card Lead, reload and start-fresh preservation passed without AI.",
      );
    } finally {
      await direct.close();
    }
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
