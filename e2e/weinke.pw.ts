import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { navigate } from "./navigation";
test.use({ serviceWorkers: "block" });
test("direct Weinke preserves literal notes through refresh, save, reopen and mobile Lead without AI", async ({
  page,
}, info) => {
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
    .fill("Synthetic phone Weinke");
  const words =
    "11s: heavy squats and merkins.\nBetween rounds: wall sit.\nHammers 2=1. Down and back x4.";
  await page.getByLabel("The Thang", { exact: true }).fill(words);
  await page
    .getByLabel("COT / reminders (optional)", { exact: true })
    .fill("Look out for the six.");
  await page.reload();
  await expect(page.getByLabel("The Thang", { exact: true })).toHaveValue(
    words,
  );
  await page
    .getByRole("button", { name: "Preview my Weinke", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Weinke preview" }),
  ).toContainText("Hammers 2=1");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Save & open Weinke", exact: true })
    .click();
  await expect(page).toHaveURL(/#lead\//);
  await expect(
    page.getByLabel("Workout to lead", { exact: true }),
  ).toContainText(words);
  await expect(
    page.getByRole("button", { name: "No timer", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-weinke-lead.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByLabel("Workout to lead", { exact: true }),
  ).toContainText(words);
  await page
    .getByRole("button", { name: "← Back to plan", exact: true })
    .click();
  await navigate(page, "My Workouts");
  await page
    .getByRole("button", { name: "Synthetic phone Weinke", exact: true })
    .click();
  expect(calls).toBe(0);
});
