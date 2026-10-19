import { navigate } from "./navigation";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import proposal from "../data/ao-proposals/fe-ao-heartland.json" with { type: "json" };
import type { Workout } from "../src/model";
import { createHash } from "node:crypto";
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
    page.locator('.navigation-links a[href="#build"] svg').first(),
  ).toHaveAttribute("aria-hidden", "true");
  await page.getByLabel("Q location", { exact: true }).fill("South Park");
  await expect(
    page.getByRole("combobox", { name: "Workout venue", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Workout venue", exact: true })
    .selectOption("brougham-elementary");
  const venueSummary = page
    .getByLabel("Where and when")
    .locator(".ao-quick-summary")
    .first();
  await expect(venueSummary).toContainText("Shelter / covered space");
  await expect(venueSummary).toContainText("Benches / raised support");
  await expect(venueSummary).not.toContainText("Pull-up bars");
  await page
    .getByRole("combobox", { name: "Workout venue", exact: true })
    .selectOption("heritage-marina");
  await expect(venueSummary).toContainText("Pull-up bars");
  await page
    .getByRole("combobox", { name: "Workout venue", exact: true })
    .selectOption("brougham-elementary");
  await expect(venueSummary).not.toContainText("Pull-up bars");
  await navigate(page, "Library");
  await expect(page).toHaveURL(/#library$/);
  await navigate(page, "My Workouts");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Find your next workout", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  await navigate(page, "AO Directory");
  await page.getByLabel("Search AOs", { exact: true }).fill("South Park");
  await expect(
    page.getByRole("link", { name: "F3 Nation map ↗", exact: true }),
  ).toHaveAttribute("href", /locationId=38856/);
  await expect(
    page.getByText(/Listed default: Brougham Elementary School/),
  ).toContainText("Seasonal meeting points may differ");
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-nation-map.png`,
    fullPage: true,
  });
  await page.getByLabel("Search AOs", { exact: true }).fill("Heartland");
  await expect(
    page.getByRole("link", { name: "F3 Nation map ↗", exact: true }),
  ).toHaveAttribute("href", /locationId=49796/);
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
  await navigate(page, "Build");
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-release-build.png`,
    fullPage: true,
  });
});

test("cloud saving needs no setup, supports recovery on another device and retries offline edits", async ({
  page,
  browser,
}, info) => {
  test.skip(
    !process.env.FE_CLOUD_TEST_DIR,
    "Requires the isolated CI cloud fixture build",
  );
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
  let code = "";
  let remote = { version: 0, workouts: [] as Workout[] };
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
        : "https://staging-sync.invalid/rest/v1/rpc/fe_sync_plans",
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
        if (!code) code = body.sync_code;
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
    await page.goto("http://127.0.0.1:4175/#build");
    await page
      .getByRole("button", { name: "Formal Builder", exact: true })
      .click();
    await page.getByLabel("Plan title", { exact: true }).fill("Cross-device Q");
    await page
      .getByRole("button", { name: "Use offline template", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save a private copy", exact: true })
      .click();
    await navigate(page, "My Workouts");
    await expect
      .poll(() =>
        page.evaluate(() => !!localStorage.getItem("fe-sync:staging:v1")),
      )
      .toBe(true);
    code = await page.evaluate(
      () => JSON.parse(localStorage.getItem("fe-sync:staging:v1")!).code,
    );
    await expect(
      page.getByRole("button", { name: "Connect devices", exact: true }),
    ).toHaveCount(0);
    await expect.poll(async () => (await readRemote()).workouts.length).toBe(1);
    await second.goto("http://127.0.0.1:4175/#settings");
    await second
      .getByText("Recovery & another device", { exact: true })
      .click();
    await second
      .getByText("Use an existing recovery code", { exact: true })
      .click();
    await second.getByLabel("Recovery code", { exact: true }).fill(code);
    await second
      .getByRole("button", { name: "Restore workouts", exact: true })
      .click();
    await expect(
      second.getByRole("status").filter({ hasText: "Saved to cloud" }),
    ).toBeVisible();
    await navigate(second, "My Workouts");
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
      "waiting to upload",
    );
    expect((await readRemote()).workouts[0].title).toBe("Cloud updated Q");
    offline = false;
    await second.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect
      .poll(async () => (await readRemote()).workouts[0]?.title)
      .toBe("Device pending Q");
    await navigate(second, "My Workouts");
    await second
      .getByRole("button", { name: "Saving details", exact: true })
      .click();
    await second.screenshot({
      path: `qa/screenshots/${info.project.name}-cloud-save.png`,
      fullPage: true,
    });
  } finally {
    await secondContext.close();
    if (live && /^[a-f0-9]{64}$/.test(code)) {
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

test("navigation exposes every destination and mobile menu works by keyboard", async ({
  page,
}, info) => {
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  const compact = (page.viewportSize()?.width ?? 1440) <= 1000;
  if (compact) {
    await expect(
      page.getByRole("navigation", { name: "Planner navigation" }),
    ).toBeHidden();
    await menu.click();
    await expect(
      page.getByRole("button", { name: "Close", exact: true }),
    ).toHaveAttribute("aria-expanded", "true");
  }
  const nav = page.getByRole("navigation", { name: "Planner navigation" });
  await expect(nav.getByRole("link")).toHaveCount(7);
  await expect(
    nav.getByRole("link", { name: "Build", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-navigation.png`,
    fullPage: true,
  });
  if (compact) {
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await expect(nav).toBeHidden();
  }
  await navigate(page, "AO Directory");
  await expect(page).toHaveURL(/#aos$/);
  if (compact) await menu.click();
  await expect(
    nav.getByRole("link", { name: "AO Directory", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  if (compact)
    await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  if (compact) await menu.click();
  await expect(
    nav.getByRole("link", { name: "AO Directory", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
