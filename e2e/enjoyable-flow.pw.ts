import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { navigate, saveWorkout } from "./navigation";
import type { Workout } from "../src/model";
test.use({ serviceWorkers: "block" });
test("vibe-first planning stays AI-free until build and autosaves inline edits for Lead", async ({
  page,
}, info) => {
  let calls = 0;
  await page.route("**/api/plan-workout", (route) => {
    calls++;
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic failure" }),
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /You’ve got the Q/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Help me find one", exact: true })
    .click();
  await page.getByRole("button", { name: /Work together/ }).click();
  await page.getByLabel("Q location", { exact: true }).fill("Gold Rush");
  await page.getByRole("button", { name: /Show me some ideas/ }).click();
  await expect(page.locator(".choice-grid button")).toHaveCount(3);
  expect(calls).toBe(0);
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-concepts.png`,
    fullPage: true,
  });
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: /The Buddy System/ }).click();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "None", exact: true }).click();
  await page
    .getByLabel("Anything we should know? (Optional)", { exact: true })
    .fill("A gold-mining theme.");
  const request = page.waitForRequest("**/api/plan-workout");
  await page
    .getByRole("button", { name: "Build my workout", exact: true })
    .click();
  expect((await request).postDataJSON()).toMatchObject({
    equipment: "Coupon",
    running: "None",
  });
  await saveWorkout(page);
  expect(calls).toBe(1);
  const original = await page.evaluate<Workout>(
    () => JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts[0],
  );
  await expect(
    page.getByRole("heading", {
      name: original.sections[0].title,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Circle of Trust", exact: true }),
  ).toBeVisible();
  const title = page.getByLabel("Workout name", { exact: true });
  await title.fill("My synthetic pilot Q");
  await expect(title).toBeFocused();
  const exercise = original.sections[0].blocks[0].exercises[0];
  await page
    .getByRole("button", { name: `Edit ${exercise.name}`, exact: true })
    .click();
  await page.getByLabel("Reps or duration", { exact: true }).fill("17");
  await page.getByRole("button", { name: "Done editing", exact: true }).click();
  await saveWorkout(page);
  const updated = await page.evaluate<Workout[]>(
    () => JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts,
  );
  expect(updated).toHaveLength(1);
  expect(updated[0].id).toBe(original.id);
  expect(updated[0].sections[0].blocks[0].exercises[0].amount).toBe("17");
  expect(updated[0].sections[1]).toEqual(original.sections[1]);
  expect(calls).toBe(1);
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
    path: `qa/screenshots/${info.project.name}-working-q-sheet.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
    "My synthetic pilot Q",
  );
  await navigate(page, "My Workouts");
  await page
    .getByRole("button", { name: "My synthetic pilot Q", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`#workout/${original.id}$`));
  await page.getByRole("button", { name: "Lead workout", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#lead/${original.id}$`));
});
