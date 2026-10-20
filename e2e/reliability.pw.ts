import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Workout } from "../src/model";
import { navigate } from "./navigation";

test("saved private copy stays selected for preview, editing and reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save a private copy", exact: true })
    .click();
  const saved = await page.evaluate<Workout>(
    () => JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts[0],
  );
  await page
    .getByRole("button", { name: "Preview & print", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#workout/${saved.id}$`));
  await page.reload();
  await expect(
    page.getByRole("heading", { name: saved.title, exact: true }),
  ).toBeVisible();
  await navigate(page, "Build");
  await page
    .getByRole("button", { name: "Edit the details", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#edit/${saved.id}$`));
  await page
    .getByLabel("Workout title", { exact: true })
    .fill("Edited saved private copy");
  await page
    .getByRole("button", { name: "Save & view workout", exact: true })
    .click();
  const workouts = await page.evaluate<Workout[]>(
    () => JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts,
  );
  expect(workouts).toHaveLength(1);
  expect(workouts[0].id).toBe(saved.id);
  expect(workouts[0].title).toBe("Edited saved private copy");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: workouts[0].title, exact: true }),
  ).toBeVisible();
});

test("Lead recovery follows the saved private copy reopened from My Workouts", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save a private copy", exact: true })
    .click();
  const saved = await page.evaluate<Workout>(
    () => JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts[0],
  );
  await page.getByRole("button", { name: "Lead workout", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#lead/${saved.id}$`));
  await page
    .getByRole("button", { name: "Session timer", exact: true })
    .click();
  await page.clock.install();
  await page.getByRole("button", { name: "Start timer", exact: true }).click();
  await page.clock.runFor(75000);
  await expect(page.getByRole("timer")).toHaveText("43:45");
  await page
    .getByRole("button", { name: "← Back to plan", exact: true })
    .click();
  await navigate(page, "My Workouts");
  await page.getByRole("button", { name: saved.title, exact: true }).click();
  await page.getByRole("button", { name: "Lead workout", exact: true }).click();
  await page
    .getByRole("button", { name: "Session timer", exact: true })
    .click();
  await expect(page.getByRole("timer")).toHaveText("43:45");
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: saved.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Session timer", exact: true })
    .click();
  await expect(page.getByRole("timer")).toHaveText("43:45");
});

test("a delayed cloud bookmark opens the exact saved workout without a missing warning", async ({
  page,
}) => {
  test.skip(
    !process.env.FE_CLOUD_TEST_DIR || process.env.FE_LIVE_CLOUD === "true",
    "Uses only the isolated fake cloud build",
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  const workout = await page.evaluate<Workout>(
    () =>
      JSON.parse(sessionStorage.getItem("fe-planner:assistant:v1")!).result
        .workout,
  );
  workout.title = "Delayed private workout";
  workout.attribution = { visibility: "private", createdAt: workout.updatedAt };
  await page.addInitScript(() => {
    localStorage.setItem(
      "fe-sync:staging:v1",
      JSON.stringify({ code: "a".repeat(64), base: [] }),
    );
  });
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  await page.route("https://staging-sync.invalid/**", async (route) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (!route.request().url().endsWith("/rpc/fe_sync_plans"))
      return route.abort();
    const body = route.request().postDataJSON();
    expect(body.operation).toBe("get");
    reads++;
    await waiting;
    await route.fulfill({ headers, json: { version: 1, workouts: [workout] } });
  });
  await page.goto(`http://127.0.0.1:4175/#workout/${workout.id}`);
  await expect(page.getByText(/Looking for this workout/)).toBeVisible();
  await expect(page.getByText(/That workout is not saved/)).toHaveCount(0);
  release();
  await expect(
    page.getByRole("heading", { name: workout.title, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Looking for this workout/)).toHaveCount(0);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts,
  );
  expect(saved).toHaveLength(1);
  expect(saved[0]).toEqual(workout);
  expect(reads).toBe(1);
});

for (const failure of ["timeout", "unavailable", "invalid"] as const) {
  test(`AI ${failure} keeps the current draft and gives a recovery step`, async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Use offline template", exact: true })
      .click();
    const before = await page.evaluate(() =>
      sessionStorage.getItem("fe-planner:assistant:v1"),
    );
    await page.route("**/api/plan-workout", (route) =>
      route.fulfill({
        status:
          failure === "timeout" ? 504 : failure === "unavailable" ? 503 : 200,
        json:
          failure === "invalid"
            ? { invalid: true }
            : { error: "PRIVATE provider diagnostic" },
      }),
    );
    await page.getByLabel("What would you change?").fill("Less running");
    await page
      .getByRole("button", { name: "Refine this draft", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "previous draft is safe",
    );
    await expect(page.getByRole("alert")).not.toContainText("PRIVATE");
    const after = await page.evaluate(() =>
      sessionStorage.getItem("fe-planner:assistant:v1"),
    );
    expect(JSON.parse(after!).result.workout).toEqual(
      JSON.parse(before!).result.workout,
    );
    await expect(
      page.getByRole("button", { name: "Save a private copy", exact: true }),
    ).toBeEnabled();
  });
}

test("session recovery, double taps and denied screen wake keep Lead usable", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(request.url()));
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save a private copy", exact: true })
    .click();
  await page.getByRole("button", { name: "Lead workout", exact: true }).click();
  await page
    .getByRole("button", { name: "Session timer", exact: true })
    .click();
  await page.clock.install();
  await page
    .getByRole("button", { name: "Start timer", exact: true })
    .dblclick();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/browser declined to keep the screen awake/),
  ).toBeVisible();
  await page.clock.runFor(75000);
  await expect(page.getByRole("timer")).toHaveText("43:45");
  const value = await page.getByRole("timer").textContent();
  await page
    .getByRole("button", { name: "← Back to plan", exact: true })
    .click();
  await page.clock.runFor(60000);
  await page.getByRole("button", { name: "Lead workout", exact: true }).click();
  await page
    .getByRole("button", { name: "Session timer", exact: true })
    .click();
  await expect(page.getByRole("timer")).toHaveText(value!);
  await expect(
    page.getByRole("button", { name: "Resume", exact: true }),
  ).toBeEnabled();
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
    path: `qa/screenshots/${info.project.name}-session-recovery.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
