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
