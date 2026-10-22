import { type Page, expect } from "@playwright/test";

export async function navigate(page: Page, label: string) {
  const link = page
    .getByRole("navigation", { name: "Planner navigation" })
    .getByRole("link", { name: label, exact: true });
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  if (!(await link.isVisible()) && (await menu.isVisible())) await menu.click();
  if (!(await link.isVisible())) {
    await page.locator(".navigation-resources > summary").click();
  }
  await link.click();
  await expect(
    page.getByRole("button", { name: "Close", exact: true }),
  ).toHaveCount(0);
}

export async function openOtherWays(page: Page) {
  const choices = page.locator(".planner-other-ways");
  if ((await choices.getAttribute("open")) === null)
    await choices.locator("summary").click();
}

/** Enter the idea path for existing detailed workflow scenarios. */
export async function startPlanning(page: Page) {
  const choice = page.getByRole("button", {
    name: "I have an idea",
    exact: true,
  });
  if (await choice.isVisible()) await choice.click();
}
export async function openCreativeHelp(page: Page) {
  const help = page.locator(".creative-help");
  if ((await help.count()) && (await help.getAttribute("open")) === null)
    await help.locator("summary").click();
}
export async function saveWorkout(page: Page) {
  const manual = page
    .getByRole("button", { name: "Save workout", exact: true })
    .first();
  if (await manual.isVisible()) await manual.click();
  else {
    await expect(
      page.getByText(/Saved on this device · Find it in My Workouts/),
    ).toBeVisible();
    const persisted = await page.evaluate(() => {
      const session = JSON.parse(
        sessionStorage.getItem("fe-planner:assistant:v1") ?? "null",
      );
      const workouts =
        JSON.parse(localStorage.getItem("fe-planner:v1") ?? "null")?.workouts ??
        [];
      return workouts.some(
        (workout: { id: string }) => workout.id === session?.result?.workout.id,
      );
    });
    expect(persisted).toBe(true);
  }
}
