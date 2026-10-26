import { test, expect } from "@playwright/test";
import { startPlanning, saveWorkout } from "./navigation";
import { catalogAO } from "../tests/fixtures/ao-catalog";
import AxeBuilder from "@axe-core/playwright";
test("live AO facts, venue choice and closures survive an AI-free save/reopen/lead journey", async ({
  page,
}, info) => {
  let catalogCalls = 0,
    aiCalls = 0;
  await page.route("**/api/ao-intelligence?*", (route) => {
    catalogCalls++;
    const id = new URL(route.request().url()).searchParams.get("ao")!;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: 1,
        source: "database",
        catalog: catalogAO(id),
      }),
    });
  });
  await page.route("**/api/plan-workout", (route) => {
    aiCalls++;
    return route.abort();
  });
  await page.goto("/");
  await startPlanning(page);
  await page.getByLabel("Q location", { exact: true }).fill("Pretty Bird");
  await expect(page.locator(".ao-context .ao-source-status")).toContainText(
    "Regional AO details",
  );
  await expect(page.locator(".ao-context .ao-meeting-point")).toContainText(
    "East parking lot",
  );
  await page.getByText("Facilities & landmarks", { exact: true }).click();
  await expect(
    page.getByText("Restricted — check access", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Garmin parking garage", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-live-ao.png`,
    fullPage: true,
  });
  await page.getByLabel("Q location", { exact: true }).fill("South Park");
  await expect(page.locator(".ao-context .ao-source-status")).toContainText(
    "Regional AO details",
  );
  await page
    .getByRole("combobox", { name: "Workout venue", exact: true })
    .selectOption("brougham-elementary");
  await expect(page.locator(".ao-context .ao-meeting-point")).toContainText(
    "Brougham Elementary",
  );
  await page
    .getByRole("combobox", { name: "Workout venue", exact: true })
    .selectOption("heritage-park-marina");
  await expect(page.locator(".ao-context .ao-meeting-point")).toContainText(
    "Heritage Park Marina",
  );
  await page.getByText("Anything different today?", { exact: false }).click();
  await page
    .getByRole("combobox", { name: "Steps / stairs today", exact: true })
    .selectOption("unavailable");
  await page
    .getByLabel("Today’s conditions", { exact: true })
    .fill("The stairs are closed today.");
  await page
    .getByLabel("Describe your Q", { exact: true })
    .fill("A simple bodyweight circuit.");
  const violations = (
    await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze()
  ).violations;
  expect(violations).toEqual([]);
  await page
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  await saveWorkout(page);
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts[0],
  );
  expect(stored.schedule.siteSummary).toContain("Heritage Park Marina");
  expect(stored.schedule.siteSummary).toContain("Steps / stairs");
  await page
    .getByRole("button", { name: "Print workout", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: stored.title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lead workout", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("#lead/" + stored.id + "$"));
  expect(catalogCalls).toBe(2);
  expect(aiCalls).toBe(0);
});
