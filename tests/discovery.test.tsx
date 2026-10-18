// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Discovery } from "../src/Discovery";
import { aoProfiles } from "../src/discovery";
import { matches, filtersEmpty } from "../src/model";
import { catalog } from "../src/catalog";
import { parseSchedule } from "../scripts/ao-sync.mjs";
afterEach(cleanup);
describe("source discovery", () => {
  it("renders factual snapshots and links AO to its own workouts without inventing terrain", () => {
    const onAO = vi.fn();
    render(<Discovery mode="aos" onAO={onAO} />);
    fireEvent.change(screen.getByLabelText("Search AOs"), {
      target: { value: "Clocktower" },
    });
    expect(screen.getByRole("heading", { name: "Clocktower" })).toBeVisible();
    expect(screen.getAllByText("Unknown")).toHaveLength(11);
    fireEvent.click(
      screen.getByRole("button", { name: "Workouts from this AO →" }),
    );
    expect(onAO).toHaveBeenCalledWith("Clocktower");
    expect(aoProfiles).toHaveLength(16);
    expect(new Set(aoProfiles.map((a) => a.id)).size).toBe(16);
  });
  it("searches exercise aliases and offers sources", () => {
    render(<Discovery mode="exercises" onAO={() => {}} />);
    fireEvent.change(screen.getByLabelText("Search exercises"), {
      target: { value: "Decline merkin" },
    });
    expect(screen.getByText("Derkin")).toBeVisible();
    fireEvent.click(screen.getByText("Derkin"));
    expect(screen.getByText(/One|State one complete rep/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Exicon source file ↗" }),
    ).toHaveAttribute("href", expect.stringContaining("exicon.csv"));
  });
  it("searches exercise names, AO and Q; combines source filters without calling templates regional", () => {
    expect(matches(catalog[0], { ...filtersEmpty, query: "merkins" })).toBe(
      true,
    );
    expect(
      matches(catalog[0], { ...filtersEmpty, status: "regional-reviewed" }),
    ).toBe(false);
    expect(
      matches(
        {
          ...catalog[0],
          provenance: {
            ...catalog[0].provenance,
            ao: "Clocktower",
            q: "Example Q",
          },
        },
        { ...filtersEmpty, ao: "Clocktower", query: "Example Q" },
      ),
    ).toBe(true);
  });
  it("rejects changed/sparse upstream structure rather than wiping a saved AO snapshot", () => {
    expect(() =>
      parseSchedule(
        "<main><h2>MONDAYS</h2><h3>AO Unknown</h3></main>",
        new Date().toISOString(),
      ),
    ).toThrow();
  });
});
