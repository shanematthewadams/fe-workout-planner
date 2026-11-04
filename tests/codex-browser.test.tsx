// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import {
  CodexReferenceBrowser,
  clearCodexCache,
  loadCodexReference,
} from "../src/CodexReference";
const reference = {
  version: 1,
  attribution: "F3 Nation · F3 Codex",
  entries: [
    {
      id: "official-1",
      name: "Example",
      description: "<img src=x onerror=bad()>\nStand and lower.",
      fingerprint: "a".repeat(64),
      captured_at: "2026-11-04T00:00:00Z",
      aliases: ["Alternate"],
      tags: ["Routine"],
      mentioned_ids: [],
    },
  ],
};
beforeEach(clearCodexCache);
afterEach(cleanup);
it("loads once, searches source aliases and tags, renders inert descriptions and credits the exact original", async () => {
  const f = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ version: 1, source: "database", reference }),
        ),
    );
  vi.stubGlobal("fetch", f);
  await Promise.all([loadCodexReference(), loadCodexReference()]);
  expect(f).toHaveBeenCalledTimes(1);
  const { container, rerender } = render(
    <CodexReferenceBrowser query="Alternate" />,
  );
  await screen.findByText("1 of 1 Nation entries");
  expect(screen.getByText("Alternate", { exact: false })).toBeTruthy();
  expect(container.querySelector("img")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "View original in F3 Codex ↗" })
      .getAttribute("href"),
  ).toContain("entryId=official-1");
  fireEvent.change(screen.getByLabelText("Nation tag"), {
    target: { value: "Routine" },
  });
  rerender(<CodexReferenceBrowser query="not found" />);
  expect(screen.getByText(/No Nation entries match/)).toBeTruthy();
  expect(f).toHaveBeenCalledTimes(1);
});
it("retains the app guide fallback message on network, malformed and revoked/empty reads without claiming loaded content", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("<html>SPA</html>")),
  );
  render(<CodexReferenceBrowser query="" />);
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain("unavailable"),
  );
  expect(screen.queryByText(/of .* Nation entries/)).toBeNull();
});
