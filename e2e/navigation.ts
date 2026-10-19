import { type Page, expect } from "@playwright/test";

export async function navigate(page: Page, label: string) {
  const link = page
    .getByRole("navigation", { name: "Planner navigation" })
    .getByRole("link", { name: label, exact: true });
  if (!(await link.isVisible()))
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  await link.click();
  await expect(
    page.getByRole("button", { name: "Close", exact: true }),
  ).toHaveCount(0);
}
