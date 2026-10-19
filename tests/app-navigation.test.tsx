// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AppNavigation } from "../src/AppNavigation";

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("app navigation", () => {
  it("uses real destination links and shows the current section", () => {
    render(<AppNavigation active="aos" onNavigate={() => true} />);
    expect(
      screen.getByRole("link", { name: "AO Directory" }).getAttribute("href"),
    ).toBe("#aos");
    expect(
      screen
        .getByRole("link", { name: "AO Directory" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Build" }).hasAttribute("aria-current"),
    ).toBe(false);
  });
  it("closes the disclosure after navigating and returns Escape focus to the toggle", () => {
    const go = vi.fn(() => true);
    render(<AppNavigation active="builder" onNavigate={go} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(
      screen
        .getByRole("button", { name: "Close" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Menu" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("link", { name: "Library" }));
    expect(go).toHaveBeenCalledWith("library");
    expect(
      screen
        .getByRole("button", { name: "Menu" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });
  it("keeps navigation open when leaving unsaved edits is declined", () => {
    render(<AppNavigation active="mine" onNavigate={() => false} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("link", { name: "Library" }));
    expect(
      screen
        .getByRole("button", { name: "Close" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });
  it("dismisses on outside interaction without blocking the page", () => {
    render(<AppNavigation active="builder" onNavigate={() => true} />);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.pointerDown(document.body);
    expect(
      screen
        .getByRole("button", { name: "Menu" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });
});
