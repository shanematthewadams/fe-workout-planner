import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { navigate } from "./navigation";

// Keep provider mocks deterministic in WebKit after the offline worker takes
// control. The separate offline-cache journey exercises the real worker.
test.use({ serviceWorkers: "block" });

test("a first-time PAX can understand the path and start from an example without signing in", async ({
  page,
}, info) => {
  let calls = 0;
  await page.route("**/api/plan-workout", (route) => {
    calls++;
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic provider failure" }),
    });
  });
  await page.goto("/");
  await expect(
    page.getByText("No account needed. Start with what you have in mind.", {
      exact: true,
    }),
  ).toBeVisible();
  const steps = page.getByRole("list", { name: "Workout planning steps" });
  await expect(steps.locator('[aria-current="step"]')).toContainText(
    "Describe",
  );
  await expect(page.getByLabel("Saving status")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Formal Builder", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Build my workout", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".surprise-label")).toHaveText("Surprise me");
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-first-visit.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Try an example", exact: true })
    .click();
  await expect(
    page.getByLabel("Describe your Q", { exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Describe your Q", { exact: true })).toHaveValue(
    /Gold Rush.*No running/,
  );
  expect(calls).toBe(0);
  await page
    .getByRole("button", { name: "Build my workout", exact: true })
    .click();
  await expect(
    page.getByLabel("Generated workout draft", { exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await expect(steps.locator('[aria-current="step"]')).toContainText("Review");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Saved in My Workouts", exact: true }),
  ).toBeDisabled();
  await expect(steps.locator('[aria-current="step"]')).toContainText(
    "Save & lead",
  );
  await expect(page.getByLabel("Saving status")).toBeVisible();
  await navigate(page, "My Workouts");
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
