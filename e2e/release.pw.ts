import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import proposal from "../data/ao-proposals/fe-ao-heartland.json" with { type: "json" };
import type { Workout } from "../src/model";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
// Live connection codes must not be captured in browser traces.
test.use({
  trace: process.env.FE_LIVE_CLOUD === "true" ? "off" : "retain-on-failure",
});

test("icons, seasonal venues, AO review and browser history stay clear on every screen size", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Build", exact: true }).locator("svg"),
  ).toHaveAttribute("aria-hidden", "true");
  await page.getByLabel("Q location", { exact: true }).fill("South Park");
  await expect(
    page.getByRole("combobox", { name: "Workout venue", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Workout venue", exact: true })
    .selectOption("brougham-elementary");
  await expect(page.getByLabel("Where and when")).toContainText(
    "No site features confirmed",
  );
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page).toHaveURL(/#library$/);
  await page.getByRole("button", { name: "My Workouts", exact: true }).click();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Find your next workout", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  await page.getByText("More", { exact: true }).click();
  await page.getByRole("button", { name: "AO Directory", exact: true }).click();
  await page.getByLabel("Search AOs", { exact: true }).fill("Heartland");
  await page.getByText("Landmarks", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Back concrete benches", exact: true }),
  ).toBeVisible();
  await page.getByText("Review an AO update", { exact: true }).click();
  await page.getByLabel("AO update file", { exact: true }).setInputFiles({
    name: "heartland.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(proposal)),
  });
  await page
    .getByRole("button", { name: "Review proposal", exact: true })
    .click();
  await expect(page.getByLabel("AO proposal review")).toContainText(
    "Morgan Freeman",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-ao-review.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-release-build.png`,
    fullPage: true,
  });
});

test("cloud autosave connects two devices and recovers after a network failure", async ({
  page,
  browser,
}, info) => {
  test.skip(
    !process.env.FE_CLOUD_TEST_DIR,
    "Requires the isolated CI cloud fixture build",
  );
  const w: Workout = {
    schemaVersion: 1,
    id: "synthetic-cloud-qa",
    title: "Cross-device Q",
    summary: "Synthetic browser fixture",
    kind: "personal",
    duration: 45,
    equipment: [],
    running: "None",
    format: "Circuit",
    rawNotes: "",
    adaptationNotes: "",
    provenance: { status: "personal", label: "Synthetic test workout" },
    updatedAt: new Date().toISOString(),
    sections: [
      {
        id: "synthetic-thang",
        kind: "thang",
        title: "The Thang",
        blocks: [
          {
            id: "synthetic-block",
            title: "Bodyweight circuit",
            instructions: "Work at your own pace.",
            minutes: 45,
            exercises: [
              {
                id: "synthetic-exercise",
                name: "Squat",
                amount: "10",
                unit: "reps",
                counting: "1=1",
                instructions: "Rest as needed.",
              },
            ],
          },
        ],
      },
    ],
  };
  const live = process.env.FE_LIVE_CLOUD === "true";
  const liveUrl = process.env.FE_LIVE_CLOUD_URL;
  const liveKey = process.env.FE_LIVE_CLOUD_KEY;
  if (
    live &&
    (!liveUrl?.startsWith("https://") ||
      !liveKey?.startsWith("sb_publishable_"))
  )
    throw Error(
      "Live checks require the existing HTTPS URL and a publishable client key.",
    );
  const code = live ? randomBytes(32).toString("hex") : "a".repeat(64);
  let remote = { version: 0, workouts: [] as (typeof w)[] };
  const readRemote = async () => {
    if (live) {
      const response = await fetch(
        new URL("/rest/v1/rpc/fe_sync_plans", liveUrl),
        {
          method: "POST",
          headers: { apikey: liveKey!, "Content-Type": "application/json" },
          body: JSON.stringify({ sync_code: code, operation: "get" }),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok)
        throw Error(`Live cloud read failed: ${response.status}`);
      remote = await response.json();
    }
    return remote;
  };
  let offline = false;
  const secondContext = await browser.newContext({
    viewport: page.viewportSize()!,
  });
  const second = await secondContext.newPage();
  const intercept = async (target: typeof page) =>
    target.route(
      live
        ? `${liveUrl}/rest/v1/rpc/fe_sync_plans`
        : "https://staging-sync.invalid/**",
      async (route) => {
        if (offline) {
          await route.abort();
          return;
        }
        if (live) {
          await route.continue();
          return;
        }
        if (route.request().method() === "OPTIONS") {
          await route.fulfill({
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "apikey,content-type",
            },
          });
          return;
        }
        const body = route.request().postDataJSON();
        if (body.sync_code !== code) {
          await route.fulfill({ status: 403, body: "{}" });
          return;
        }
        if (body.operation === "put") {
          if (body.expected_version !== remote.version) {
            await route.fulfill({ status: 409, body: "{}" });
            return;
          }
          remote = { version: remote.version + 1, workouts: body.payload };
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(remote),
        });
      },
    );
  try {
    await intercept(page);
    await intercept(second);
    await page.addInitScript(
      ({ w, code }) => {
        localStorage.setItem(
          "fe-planner:v1",
          JSON.stringify({
            format: "fe-workout-backup",
            version: 1,
            exportedAt: new Date().toISOString(),
            workouts: [w],
            favorites: [],
          }),
        );
        localStorage.setItem(
          "fe-sync:staging:v1",
          JSON.stringify({ code, base: [] }),
        );
      },
      { w, code },
    );
    await page.goto("http://127.0.0.1:4175/#my-workouts");
    await expect.poll(async () => (await readRemote()).workouts.length).toBe(1);
    await second.goto("http://127.0.0.1:4175/#settings");
    await second
      .getByText("Connect to my existing workouts", { exact: true })
      .click();
    await second.getByLabel("Connection code", { exact: true }).fill(code);
    await second
      .getByRole("button", { name: "Connect with code", exact: true })
      .click();
    await expect(
      second.getByRole("status").filter({ hasText: "Saved to cloud" }),
    ).toBeVisible();
    await second
      .getByRole("button", { name: "My Workouts", exact: true })
      .click();
    await second
      .getByRole("button", { name: "Cross-device Q", exact: true })
      .click();
    await second
      .getByRole("button", { name: "Edit workout", exact: true })
      .click();
    await second
      .getByLabel("Workout title", { exact: true })
      .fill("Cloud updated Q");
    await second
      .getByRole("button", { name: "Save workout", exact: true })
      .first()
      .click();
    await expect
      .poll(async () => (await readRemote()).workouts[0]?.title)
      .toBe("Cloud updated Q");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("button", { name: "Cloud updated Q", exact: true }),
    ).toBeVisible();
    offline = true;
    await second
      .getByLabel("Workout title", { exact: true })
      .fill("Device pending Q");
    await second
      .getByRole("button", { name: "Save workout", exact: true })
      .first()
      .click();
    await expect(second.getByLabel("Saving status")).toContainText(
      "cloud unavailable",
    );
    expect((await readRemote()).workouts[0].title).toBe("Cloud updated Q");
    offline = false;
    await second.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect
      .poll(async () => (await readRemote()).workouts[0]?.title)
      .toBe("Device pending Q");
    await second
      .getByRole("button", { name: "My Workouts", exact: true })
      .click();
    await second
      .getByRole("button", { name: "Devices & saving", exact: true })
      .click();
    await second.screenshot({
      path: `qa/screenshots/${info.project.name}-cloud-save.png`,
      fullPage: true,
    });
  } finally {
    await secondContext.close();
    if (live) {
      // Only this test's random collection is touched. Retain a hash for metadata cleanup.
      await mkdir("qa/live-cloud", { recursive: true });
      await writeFile(
        `qa/live-cloud/${info.project.name}.json`,
        JSON.stringify({
          keyHash: createHash("sha256").update(code).digest("hex"),
        }),
      );
      const snapshot = await readRemote();
      const cleared = await fetch(
        new URL("/rest/v1/rpc/fe_sync_plans", liveUrl),
        {
          method: "POST",
          headers: { apikey: liveKey!, "Content-Type": "application/json" },
          body: JSON.stringify({
            sync_code: code,
            operation: "put",
            expected_version: snapshot.version,
            payload: [],
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      expect(cleared.status, "Synthetic cloud cleanup status").toBe(200);
    }
  }
});
