// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Discovery } from "../src/Discovery";
import { SITE_Q_KEY } from "../src/ao-drafts";
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const open = (ao: string) => {
  render(<Discovery mode="aos" onAO={() => {}} />);
  fireEvent.change(screen.getByLabelText("Search AOs"), {
    target: { value: ao },
  });
};
it("shows the current source roster, including co-Qs, without turning unknown facilities into confirmed facts", () => {
  open("South Park");
  expect(
    screen.getByText(/Duffalo, Jazz Hands/, { selector: ".site-q-pill" }),
  ).toBeVisible();
  expect(
    screen.queryByText(/Unknown/, { selector: ".site-q-pill" }),
  ).toBeNull();
  expect(
    screen.getByRole("link", {
      name: /Site Q roster from the regional inventory/,
    }),
  ).toHaveAttribute("href", expect.stringContaining("gid=201"));
});
it("preserves labeled device overrides and restores the source roster when they are cleared", () => {
  localStorage.setItem(
    SITE_Q_KEY,
    JSON.stringify({ "fe-ao-overdraft": "Device name" }),
  );
  open("Overdraft");
  expect(
    screen.getByText(/Device name \(local, unverified\)/, {
      selector: ".site-q-pill",
    }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Edit local AO notes" }));
  fireEvent.change(screen.getByLabelText("Site Q override (this device):"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Done editing" }));
  expect(
    screen.getByText(/Rug Burn/, { selector: ".site-q-pill" }),
  ).toBeVisible();
});
