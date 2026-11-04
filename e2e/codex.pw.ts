import { navigate, startPlanning } from "./navigation";
import { test, expect } from "@playwright/test";
test.use({ serviceWorkers: "block" });
test("Nation Exicon searches live-shaped reference data and survives an unavailable catalog", async ({
  page,
}) => {
  test.skip(
    process.env.FE_STAGING_TEST !== "true",
    "Nation catalog is staged only",
  );
  let calls = 0;
  await page.route("**/api/codex", (route) => {
    calls++;
    return route.fulfill({
      json: {
        version: 1,
        source: "database",
        reference: {
          version: 1,
          attribution: "F3 Nation · F3 Codex",
          entries: [
            {
              id: "official-demo",
              name: "Known demo",
              description: "First line.\nSecond line.",
              fingerprint: "a".repeat(64),
              captured_at: "2026-11-04T00:00:00Z",
              aliases: ["Source alias"],
              tags: ["Routine"],
              mentioned_ids: [],
            },
          ],
        },
      },
    });
  });
  await page.goto("/");
  await startPlanning(page);
  await navigate(page, "Exicon & Lexicon");
  await page
    .getByRole("button", { name: "Nation Exicon", exact: true })
    .click();
  await expect(page.getByText("1 of 1 Nation entries")).toBeVisible();
  await page
    .getByLabel("Search reference", { exact: true })
    .fill("Source alias");
  await page.getByText("Known demo", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: "View original in F3 Codex ↗" }),
  ).toHaveAttribute("href", /entryId=official-demo/);
  expect(calls).toBe(1);
  await page.unroute("**/api/codex");
  await page.route("**/api/codex", (route) =>
    route.fulfill({
      json: { version: 1, source: "unavailable", reference: null },
    }),
  );
  await page.reload();
  await navigate(page, "Exicon & Lexicon");
  await page
    .getByRole("button", { name: "Nation Exicon", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Nation catalog is unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Exicon \(50\)$/ }).click();
  await page.getByLabel("Search reference", { exact: true }).fill("WW3");
  await expect(
    page.locator(".movement-entry summary").filter({ hasText: "WW3" }),
  ).toBeVisible();
});
