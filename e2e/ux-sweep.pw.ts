import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { navigate, saveWorkout, startPlanning } from "./navigation";
import type { Workout } from "../src/model";
test.use({ serviceWorkers: "block" });

test("structured Weinke survives refresh and leads directly from its saved card", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let calls = 0;
  await page.route("**/api/plan-workout", (route) => {
    calls++;
    return route.abort();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Make a Weinke", exact: true })
    .click();
  await page
    .getByLabel("Workout name (optional)", { exact: true })
    .fill("Structured synthetic Q");
  await page
    .getByText("Organize The Thang into blocks (optional)", { exact: true })
    .click();
  await page.getByRole("button", { name: "Add block", exact: true }).click();
  await page.getByLabel("Block name", { exact: true }).fill("Partner rounds");
  await page
    .getByLabel("Rounds (optional)", { exact: true })
    .fill("3, together");
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await page.getByLabel("Exercise name", { exact: true }).fill("Hammers");
  await page.getByLabel("Reps or duration", { exact: true }).fill("17");
  await page.getByLabel("Counting", { exact: true }).selectOption("2=1");
  await page.reload();
  await page
    .getByText("Organize The Thang into blocks (optional)", { exact: true })
    .click();
  await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "Hammers",
  );
  await expect(
    page.getByLabel("Rounds (optional)", { exact: true }),
  ).toHaveValue("3, together");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Preview my Weinke", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save & open Weinke", exact: true })
    .click();
  await expect(
    page.getByLabel("Workout to lead", { exact: true }),
  ).toContainText("Hammers · 17 reps");
  await expect(
    page.getByRole("button", { name: "Session timer", exact: true }),
  ).not.toBeVisible();
  await expect(page.locator(".lead-workout .count-label")).toHaveText("2=1");
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-compact-lead.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "← Back to plan", exact: true })
    .click();
  await navigate(page, "My Workouts");
  const card = page
    .locator(".workout-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Structured synthetic Q",
        exact: true,
      }),
    });
  await expect(card).toContainText("AO not set · Edited");
  await card.getByRole("button", { name: "Lead", exact: true }).click();
  await expect(
    page.getByLabel("Workout to lead", { exact: true }),
  ).toContainText("Rounds: 3, together");
  await page.reload();
  await expect(
    page.getByLabel("Workout to lead", { exact: true }),
  ).toContainText("Hammers · 17 reps");
  expect(calls).toBe(0);
  expect(errors).toEqual([]);
});

test("offline recovery retains the idea and Undo preserves the saved workout identity", async ({
  page,
}) => {
  await page.route("**/api/plan-workout", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/");
  await startPlanning(page);
  const idea = "Partner gold mining, no running, coupons today";
  await page.getByLabel("Describe your Q", { exact: true }).fill(idea);
  await page
    .getByRole("button", { name: "Build my workout", exact: true })
    .click();
  await saveWorkout(page);
  await page.getByText("Your original idea", { exact: true }).click();
  await expect(
    page.getByLabel("Generation recovery", { exact: true }),
  ).toContainText(idea);
  const original = await page.evaluate<Workout>(
    () => JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts[0],
  );
  const first = original.sections[0].blocks[0].exercises[0];
  await page
    .getByRole("button", { name: `Edit ${first.name}`, exact: true })
    .click();
  await page.getByLabel("Reps or duration", { exact: true }).fill("17");
  await saveWorkout(page);
  await page
    .getByRole("button", { name: "Undo last edit", exact: true })
    .click();
  await saveWorkout(page);
  const restored = await page.evaluate<Workout[]>(
    () => JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts,
  );
  expect(restored).toHaveLength(1);
  expect(restored[0].id).toBe(original.id);
  expect(restored[0].sections).toEqual(original.sections);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Try AI again", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your previous draft is safe",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts[0].id,
    ),
  ).toBe(original.id);
});
