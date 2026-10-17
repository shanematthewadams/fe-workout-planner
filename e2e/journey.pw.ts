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
    result.workout.provenance.generation = {
      provider: "OpenRouter",
      model: "fixture:free",
      referenceSourceIds: [],
    };
    result.workout.provenance.label =
      "AI-assisted personal draft (browser fixture)";
    if (input.current) {
      result.plan.title = "Partner Gold";
      result.workout.title = "Partner Gold";
      result.plan.running = "None";
      result.workout.running = "None";
      result.plan.sections[1].blocks[0].instructions =
        "Partners alternate stations in place with recovery between turns.";
      result.workout.sections[1].blocks[0].instructions =
        result.plan.sections[1].blocks[0].instructions;
    }
    apiCalls++;
    await route.fulfill({ json: result });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Build your next Q/ }),
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
  const buildAction = await page
    .getByRole("button", { name: "Build my workout", exact: true })
    .boundingBox();
  expect(buildAction!.y + buildAction!.height).toBeLessThan(
    info.project.use.viewport!.height,
  );
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
    .fill("No running, keep everything else.");
  await page.getByRole("button", { name: "Refine this draft" }).click();
  await expect(
    page.getByRole("heading", { name: "Partner Gold", exact: true }),
  ).toBeVisible();
  expect(apiCalls).toBe(2);
  await expect(page.getByText("No running", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Build my workout", exact: true }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: `${pictures}/${info.project.name}-workout.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Edit the details" }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
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
  await page.clock.install();
  await page.getByRole("button", { name: "Launch Field Q-Timer" }).click();
  await expect(page.getByRole("timer")).toHaveText("45:00");
  await page.getByRole("button", { name: "Mute audio" }).click();
  await page.getByRole("button", { name: "Start practice timer" }).click();
  await page.clock.fastForward(1000);
  await expect(page.getByRole("timer")).not.toHaveText("45:00");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Resume" })).toBeEnabled();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.clock.fastForward(10 * 60 * 1000);
  await expect(
    page.getByRole("heading", { name: "The Thang", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Next exercise", exact: true })
    .click();
  await expect(page.getByText("2 of 4", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page
    .getByRole("button", { name: "← Back to plan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Launch Field Q-Timer", exact: true })
    .click();
  await expect(page.getByText("2 of 4", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `${pictures}/${info.project.name}-timer.png`,
    fullPage: true,
  });
  const timerAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(timerAudit.violations).toEqual([]);
  await page
    .getByRole("button", { name: "← Back to plan", exact: true })
    .click();
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
  await expect(page.getByText(/Ready offline/)).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "My Workouts", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Gold Rush Morning", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page
    .getByRole("button", { name: "← Back to setup", exact: true })
    .click();
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

test("library favorites and AO edits stay consistent with the builder", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View workout", exact: true }),
  ).toHaveCount(35);
  await page.screenshot({
    path: `${pictures}/${info.project.name}-library.png`,
    fullPage: true,
  });
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page
    .getByRole("button", {
      name: "Favorite Circle up, get after it",
      exact: true,
    })
    .click();
  await page.getByLabel("Favorites only", { exact: true }).check();
  await expect(
    page.getByRole("button", { name: "View workout", exact: true }),
  ).toHaveCount(1);
  await page.getByText("More", { exact: true }).click();
  await page.getByRole("button", { name: "AO Directory", exact: true }).click();
  await page.getByLabel("Search AOs", { exact: true }).fill("Gold Rush");
  await page
    .getByRole("button", { name: "Edit local AO notes", exact: true })
    .click();
  await page
    .getByLabel("Track for Gold Rush", { exact: true })
    .selectOption("unavailable");
  await page.getByRole("button", { name: "Done editing", exact: true }).click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await page.getByLabel("Q location", { exact: true }).fill("Gold Rush");
  await page.getByText("Anything different today?", { exact: false }).click();
  await expect(page.getByLabel("Track today", { exact: true })).toHaveValue("");
  await expect(
    page.getByLabel("Track today", { exact: true }).locator("option:checked"),
  ).toHaveText("Profile: unavailable");
  await expect(
    page.getByText("Includes unpublished AO notes from this device.", {
      exact: true,
    }),
  ).toBeVisible();
});

test("formal setup survives navigation and reload", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Formal Builder", exact: true })
    .click();
  await page
    .getByLabel("Plan title", { exact: true })
    .fill("Recovered partner Q");
  await page.getByLabel("Q name", { exact: true }).fill("Rug Burn");
  await page.getByLabel("Coupon", { exact: true }).check();
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(page.getByLabel("Plan title", { exact: true })).toHaveValue(
    "Recovered partner Q",
  );
  await page.reload();
  await expect(page.getByLabel("Q name", { exact: true })).toHaveValue(
    "Rug Burn",
  );
  await expect(page.getByLabel("Coupon", { exact: true })).toBeChecked();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
