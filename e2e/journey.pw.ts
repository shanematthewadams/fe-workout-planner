import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { PlannerResponse } from "../src/planner-contract";
const pictures = "qa/screenshots";
test("before comparison", async ({ page }, info) => {
  test.skip(!process.env.FE_BEFORE_DIR, "Baseline build supplied in CI");
  await page.goto("http://127.0.0.1:4174");
  await page.getByRole("heading", { name: "Plan your next Q." }).waitFor();
  await page.screenshot({
    path: `${pictures}/${info.project.name}-before.png`,
    fullPage: true,
  });
});
test("create, refine, edit, save, print, lead and reopen", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Ask the running app for a valid deterministic fixture. Node does not import
  // browser modules or their bundler-only JSON imports.
  const fixturePage = await context.newPage();
  await fixturePage.goto("/");
  await fixturePage.getByLabel("Q location", { exact: true }).fill("Gold Rush");
  await fixturePage
    .getByLabel("Describe your Q", { exact: true })
    .fill("Coupons. Partner grinder.");
  await fixturePage
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  await expect(fixturePage.getByLabel("Generated workout draft")).toBeVisible();
  const fixture = await fixturePage.evaluate<PlannerResponse>(
    () => JSON.parse(sessionStorage.getItem("fe-planner:assistant:v1")!).result,
  );
  await fixturePage.close();
  let apiCalls = 0;
  // Exercise the real client request/response boundary without paid models or credentials.
  await page.route("**/api/plan-workout", async (route) => {
    const input = route.request().postDataJSON();
    const result = structuredClone(fixture);
    result.provider = "OpenRouter";
    result.model = "fixture:free";
    result.workout.provenance.label =
      "AI-assisted personal draft (browser fixture)";
    if (input.current) {
      result.plan.title = "Partner Gold";
      result.workout.title = "Partner Gold";
    }
    apiCalls++;
    await route.fulfill({ json: result });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Good mornings/ }),
  ).toBeVisible();
  await page.screenshot({
    path: `${pictures}/${info.project.name}-after.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const firstAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(firstAudit.violations).toEqual([]);
  await page.getByLabel("Q location", { exact: true }).fill("Gold Rush");
  await page
    .getByLabel("Describe your Q", { exact: true })
    .fill("Coupons. Partner grinder. Gold mining theme.");
  await page
    .getByRole("button", { name: "Build my workout", exact: true })
    .click();
  await expect(page.getByLabel("Generated workout draft")).toBeVisible();
  await expect(
    page.getByText("Offline template ·", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByLabel("What would you change?")
    .fill("Less running, keep everything else.");
  await page.getByRole("button", { name: "Refine this draft" }).click();
  await expect(
    page.getByRole("heading", { name: "Partner Gold", exact: true }),
  ).toBeVisible();
  expect(apiCalls).toBe(2);
  await page.screenshot({
    path: `${pictures}/${info.project.name}-workout.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Edit the details" }).click();
  await page
    .getByLabel("Workout title", { exact: true })
    .fill("Gold Rush Morning");
  await page.getByRole("button", { name: "Save & view workout" }).click();
  await expect(
    page.getByRole("heading", { name: "Gold Rush Morning", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("heading", { name: "Gold Rush Morning", exact: true }),
  ).toBeVisible();
  if (info.project.name === "desktop")
    await page.pdf({
      path: "qa/q-sheet.pdf",
      format: "Letter",
      printBackground: true,
    });
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("button", { name: "Launch Field Q-Timer" }).click();
  await expect(page.getByRole("timer")).toHaveText("45:00");
  await page.getByRole("button", { name: "Mute audio" }).click();
  await page.getByRole("button", { name: "Start practice timer" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeEnabled();
  await page.screenshot({
    path: `${pictures}/${info.project.name}-timer.png`,
    fullPage: true,
  });
  const timerAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(timerAudit.violations).toEqual([]);
  await page.getByRole("button", { name: "My Workouts", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "My Workouts", exact: true }).click();
  await page
    .getByRole("button", { name: "Gold Rush Morning", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Gold Rush Morning", exact: true }),
  ).toBeVisible();
  // Already installed service worker + bundled fonts/assets must support a fresh offline navigation.
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "My Workouts", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Gold Rush Morning", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  await expect(
    page.getByText(/Offline template · additional requests/),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("real preview API has a safe offline fallback and retains prior draft on refinement failure", async ({
  page,
}) => {
  // Static production preview has no function runtime: the client must handle it honestly.
  await page.goto("/");
  await page
    .getByLabel("Describe your Q", { exact: true })
    .fill("No running. Bodyweight grinder.");
  await page
    .getByRole("button", { name: "Build my workout", exact: true })
    .click();
  await expect(
    page.getByText(/Offline template · additional requests/),
  ).toBeVisible();
  const title = await page
    .getByLabel("Generated workout draft")
    .getByRole("heading", { level: 2 })
    .textContent();
  await page
    .getByLabel("What would you change?")
    .fill("Less running, keep everything else.");
  await page.getByRole("button", { name: "Refine this draft" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page
      .getByLabel("Generated workout draft")
      .getByRole("heading", { level: 2 }),
  ).toHaveText(title!);
});
