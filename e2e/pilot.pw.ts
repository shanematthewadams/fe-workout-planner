import { saveWorkout, startPlanning } from "./navigation";
import { test, expect } from "@playwright/test";

test("Surprise Me keeps current restrictions through provider failure and saving", async ({
  page,
}) => {
  await page.route("**/api/plan-workout", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic provider unavailable" }),
    }),
  );
  await page.goto("/");
  await startPlanning(page);
  await page
    .getByLabel("Describe your Q", { exact: true })
    .fill("Coupons today. No running. No Mary. The track is closed.");
  const pending = page.waitForRequest("**/api/plan-workout");
  await page.getByRole("button", { name: "Surprise Me!", exact: true }).click();
  const request = (await pending).postDataJSON();
  expect(request.running).toBe("None");
  expect(request.mary).toBe(false);
  expect(request.equipment).toBe("Coupon");
  expect(request.site.overrides.track).toBe("unavailable");
  await saveWorkout(page);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("fe-planner:v1")!).workouts[0],
  );
  expect(saved.running).toBe("None");
  expect(saved.equipment).toEqual(["Coupon"]);
  expect(
    saved.sections.map((section: { kind: string }) => section.kind),
  ).toEqual(["warmup", "thang"]);
  await page
    .getByRole("button", { name: "Print workout", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: saved.title, exact: true }),
  ).toBeVisible();
});
