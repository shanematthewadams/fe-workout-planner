import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { PlannerResponse } from "../src/planner-contract";
const pictures = "qa/screenshots";
test("Lead starts simply and runs optional Tabata intervals with sound cues", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const target = window as typeof window & { __leadToneStarts?: number };
    target.__leadToneStarts = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      const oscillator = original.call(this);
      const start = oscillator.start.bind(oscillator);
      oscillator.start = (when?: number) => {
        target.__leadToneStarts!++;
        start(when);
      };
      return oscillator;
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  await page.getByRole("button", { name: "Lead workout", exact: true }).click();
  await expect(page.getByRole("timer")).toHaveCount(0);
  await expect(
    page.getByText("Four-count cadence", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Workout to lead", { exact: true }),
  ).toBeVisible();
  await page.clock.install();
  await page.getByRole("button", { name: "Intervals", exact: true }).click();
  await expect(page.getByRole("timer")).toHaveText("00:10");
  await expect(
    page.getByRole("combobox", { name: "Interval style", exact: true }),
  ).toHaveValue("tabata");
  await page
    .getByRole("combobox", { name: "Timer sound", exact: true })
    .selectOption("beeps");
  const tones = () =>
    page.evaluate(
      () =>
        (window as typeof window & { __leadToneStarts: number })
          .__leadToneStarts,
    );
  expect(await tones()).toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Start intervals", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Exit focus", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(
    page.getByRole("combobox", { name: "Interval style" }),
  ).toBeHidden();
  await page.clock.fastForward(10000);
  await expect(
    page.getByRole("heading", { name: "Work", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText("00:20");
  expect(await tones()).toBeGreaterThan(1);
  await page.screenshot({
    path: `${pictures}/${info.project.name}-tabata-work.png`,
    fullPage: true,
  });
  await page.clock.fastForward(20000);
  await expect(
    page.getByRole("heading", { name: "Rest", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText("00:10");
  await page
    .getByRole("button", { name: "Pause intervals", exact: true })
    .click();
  const before = await tones();
  await page.clock.fastForward(60000);
  await expect(page.getByRole("timer")).toHaveText("00:10");
  expect(await tones()).toBe(before);
  await expect(
    page.getByText("Next: Work · 00:20", { exact: true }),
  ).toBeVisible();
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
    path: `${pictures}/${info.project.name}-tabata.png`,
    fullPage: true,
  });
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole("timer")).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Resume intervals", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${pictures}/${info.project.name}-tabata-landscape.png`,
    fullPage: true,
  });
  await page.setViewportSize(viewport);
  await page
    .getByRole("button", { name: "Resume intervals", exact: true })
    .click();
  await page.getByRole("button", { name: "Exit focus", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause intervals", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Focus timer", exact: true }).click();
  await page.clock.fastForward(220000);
  await expect(
    page.getByRole("heading", { name: "Complete", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText("00:00");
});
test("Markdown file review, correction and personal save", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toContainText("F3 Q BUILDER");
  await expect(page.getByRole("banner")).not.toContainText("OLATHE");
  const prompt = page.getByLabel("Describe your Q", { exact: true });
  const roll = page.getByRole("button", { name: "Surprise Me!", exact: true });
  const promptBox = await prompt.boundingBox(),
    rollBox = await roll.boundingBox();
  expect(rollBox!.x).toBeGreaterThan(promptBox!.x + promptBox!.width);
  expect(Math.abs(rollBox!.y - promptBox!.y)).toBeLessThan(3);
  await page
    .getByRole("main")
    .getByRole("button", { name: "Import a workout", exact: true })
    .click();
  await page.getByLabel("Choose Markdown file", { exact: true }).setInputFiles({
    name: "workout.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# Imported test ladder\nDuration: 45\nEquipment: Coupon\nRunning: None\n## The Thang\n### Ladder\nMinutes: 43\nAlternate partners; stop at the cap.\n- Lunges | 10 | 1=1 | Each movement counts.\n- Hammers | 20 | 2=1 | Two movements count as one.",
    ),
  });
  await expect(
    page.getByLabel("Workout Markdown", { exact: true }),
  ).toHaveValue(/Imported test ladder/);
  await page
    .getByRole("button", { name: "Review import", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Review: Imported test ladder",
      exact: true,
    }),
  ).toBeFocused();
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
    path: `${pictures}/${info.project.name}-markdown-import.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Open in editor", exact: true })
    .click();
  await expect(page.getByLabel("Workout title", { exact: true })).toHaveValue(
    "Imported test ladder",
  );
  await expect(
    page.getByRole("combobox", { name: "Counting", exact: true }).last(),
  ).toHaveValue("2=1");
  await page
    .getByRole("button", { name: "Save & view workout", exact: true })
    .click();
  await page.getByRole("button", { name: "My Workouts", exact: true }).click();
  await page
    .getByRole("button", { name: "Imported test ladder", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Imported test ladder", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Imported Markdown draft");
});
test("workout details recover and shape a weather-aware offline draft", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".header")).not.toContainText(
    "Created by Rug Burn",
  );
  await expect(
    page.getByRole("button", { name: "Try the Gold Rush idea", exact: true }),
  ).toHaveCount(0);
  await page.locator(".workout-details > summary").click();
  await page.getByLabel("PAX count", { exact: true }).fill("11");
  await page
    .getByLabel("Work together", { exact: true })
    .selectOption("Partners");
  await page.getByLabel("Fitness focus", { exact: true }).selectOption("Core");
  await page
    .getByLabel("How much running", { exact: true })
    .selectOption("None");
  await page.getByLabel("Workout date", { exact: true }).fill("2026-12-21");
  await page.getByLabel("Expected light", { exact: true }).selectOption("Dark");
  await page.getByLabel("Rain", { exact: true }).check();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.reload();
  await page.locator(".workout-details > summary").click();
  await expect(page.getByLabel("PAX count", { exact: true })).toHaveValue("11");
  await expect(page.getByLabel("Fitness focus", { exact: true })).toHaveValue(
    "Core",
  );
  await expect(page.getByLabel("Rain", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Expected light", { exact: true })).toHaveValue(
    "Dark",
  );
  await page
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  await expect(
    page.getByLabel("Generated workout draft", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText("Standing knee drives");
});
test("staging stays labeled and missing cloud configuration leaves device saves available", async ({
  page,
}) => {
  test.skip(
    process.env.FE_STAGING_TEST !== "true",
    "Only staging builds show the test-version label",
  );
  const syncCalls: string[] = [];
  await page.route("**/rest/v1/rpc/fe_sync_plans", async (route) => {
    syncCalls.push(route.request().url());
    await route.abort();
  });
  await page.goto("/");
  await expect(
    page.getByLabel("Staging version", { exact: true }),
  ).toBeVisible();
  await page.getByText("More", { exact: true }).click();
  await page
    .getByRole("button", { name: "Saving & recovery", exact: true })
    .click();
  await expect(
    page.getByLabel("Saving and recovery", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect my devices", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Export backup", exact: true }),
  ).toBeVisible();
  expect(syncCalls).toEqual([]);
});
test("before comparison", async ({ page }, info) => {
  test.skip(!process.env.FE_BEFORE_DIR, "Baseline build supplied in CI");
  await page.goto("http://127.0.0.1:4174");
  await page.getByRole("heading", { name: "Plan your next Q." }).waitFor();
  await page.screenshot({
    path: `${pictures}/${info.project.name}-before.png`,
    fullPage: true,
  });
});
test.describe("deterministic planner client", () => {
  test.use({ serviceWorkers: "block" });
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
    await fixturePage
      .getByLabel("Q location", { exact: true })
      .fill("Gold Rush");
    await fixturePage
      .getByLabel("Describe your Q", { exact: true })
      .fill("Coupons. Partner grinder.");
    await fixturePage
      .getByRole("button", { name: "Use offline template", exact: true })
      .click();
    await expect(
      fixturePage.getByLabel("Generated workout draft"),
    ).toBeVisible();
    const fixture = await fixturePage.evaluate<PlannerResponse>(
      () =>
        JSON.parse(sessionStorage.getItem("fe-planner:assistant:v1")!).result,
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
    await expect(
      page
        .getByLabel("Generated workout draft", { exact: true })
        .getByText("No running", { exact: false }),
    ).toBeVisible();
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
    if (info.project.name === "desktop") {
      const pdf = await page.pdf({
        path: "qa/q-sheet.pdf",
        format: "Letter",
        printBackground: true,
      });
      const pages = pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? [];
      expect(pages.length).toBeGreaterThan(0);
      expect(pages.length).toBeLessThanOrEqual(2);
    }
    await page.emulateMedia({ media: "screen" });
    await page.getByLabel("Print only The Thang", { exact: true }).check();
    await page.emulateMedia({ media: "print" });
    await expect(
      page.getByRole("heading", { name: "Warm-o-Rama / COP", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("heading", { name: /Fellowship & trust/ }),
    ).toBeHidden();
    if (info.project.name === "desktop") {
      const pdf = await page.pdf({
        path: "qa/q-sheet-thang.pdf",
        format: "Letter",
        printBackground: true,
      });
      expect(
        (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length,
      ).toBe(1);
    }
    await page.emulateMedia({ media: "screen" });
    await page.getByLabel("Print only The Thang", { exact: true }).uncheck();
    await page.clock.install();
    await page.getByRole("button", { name: "Lead workout" }).click();
    await page
      .getByRole("button", { name: "Session timer", exact: true })
      .click();
    await expect(page.getByRole("timer")).toHaveText("45:00");
    await page.getByRole("button", { name: "Start timer" }).click();
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
      .getByRole("button", { name: "Lead workout", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Session timer", exact: true })
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
    await page
      .getByRole("button", { name: "My Workouts", exact: true })
      .click();
    await page.reload();
    await page
      .getByRole("button", { name: "My Workouts", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Gold Rush Morning", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Gold Rush Morning", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
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
    .getByRole("heading", { level: 1 })
    .textContent();
  await page
    .getByLabel("What would you change?")
    .fill("Less running, keep everything else.");
  await page.getByRole("button", { name: "Refine this draft" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page
      .getByLabel("Generated workout draft")
      .getByRole("heading", { level: 1 }),
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
    fullPage: info.project.name !== "safari-mobile",
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

test("library quick filters, direct copy, and movement insertion", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page.getByRole("button", { name: "No running", exact: true }).click();
  await expect(page.getByLabel("Running", { exact: true })).toHaveValue("None");
  await page.getByRole("button", { name: "No gear", exact: true }).click();
  await expect(page.getByLabel("Equipment", { exact: true })).toHaveValue(
    "None",
  );
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  await page.getByLabel("Sort workouts", { exact: true }).selectOption("title");
  await page
    .getByRole("button", {
      name: "Use this workout: Circle up, get after it",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Workout title", { exact: true })).toHaveValue(
    "Circle up, get after it · my copy",
  );
  const picker = page.locator(".movement-picker").first();
  await picker.locator("summary").click();
  await picker.getByLabel("Find a movement", { exact: true }).fill("WW3");
  await picker.getByRole("button", { name: "Add WW3", exact: true }).click();
  await expect(page.locator('input[value="WW3"]')).toHaveCount(1);
  const inserted = page
    .locator("fieldset")
    .filter({ has: page.locator('input[value="WW3"]') })
    .last();
  await expect(
    inserted.getByLabel("Count / amount", { exact: true }),
  ).toHaveValue("Set reps or time");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("movement guide exposes requirements and alternatives without card sprawl", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("More", { exact: true }).click();
  await page
    .getByRole("button", { name: "Exicon & Lexicon", exact: true })
    .click();
  await page.getByLabel("Search reference", { exact: true }).fill("WW3");
  await page.locator(".movement-entry summary").click();
  await expect(
    page.locator(".movement-body p").filter({
      hasText: "One complete sit-up-and-press sequence is one rep.",
    }),
  ).toBeVisible();
  await page
    .getByLabel("Movement requirements", { exact: true })
    .selectOption("Bodyweight, no fixed support");
  await expect(page.getByText(/No movements match/)).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
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

test("real offline cache reopens saved plans and creates explicit templates", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  const title = await page
    .getByLabel("Generated workout draft")
    .getByRole("heading", { level: 1 })
    .textContent();
  await page
    .getByRole("button", { name: "Save a private copy", exact: true })
    .click();
  await page.getByRole("button", { name: "My Workouts", exact: true }).click();
  await expect(
    page.getByRole("button", { name: title!, exact: true }),
  ).toBeVisible();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await expect(page.getByText(/Ready offline/)).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "My Workouts", exact: true }).click();
  await page.getByRole("button", { name: title!, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title!, exact: true }),
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
});
