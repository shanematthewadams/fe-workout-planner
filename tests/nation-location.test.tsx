// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import { NationLocation } from "../src/NationLocation";
import directory from "../data/ao-nation.json";
import official from "../data/ao-official.json";
afterEach(cleanup);
it("links each of the 16 existing AOs to one reviewed Nation identity without adding Nation-only records", () => {
  expect(directory.aos).toHaveLength(official.length);
  expect(new Set(directory.aos.map((ao) => ao.nationOrgId)).size).toBe(
    official.length,
  );
  expect(new Set(directory.aos.map((ao) => ao.localId))).toEqual(
    new Set(official.map((ao) => ao.id)),
  );
  const normalize = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const ao of directory.aos) {
    expect(normalize(ao.nationName)).toBe(
      normalize(official.find((row) => row.id === ao.localId)!.name),
    );
    expect(ao.defaultLocation.id).toBeGreaterThan(0);
    expect(ao.defaultLocation.latitude).toBeGreaterThan(38.7);
    expect(ao.defaultLocation.latitude).toBeLessThan(39.1);
    expect(ao.defaultLocation.longitude).toBeGreaterThan(-95);
    expect(ao.defaultLocation.longitude).toBeLessThan(-94.5);
  }
});
it("identifies South Park’s default as Brougham without claiming it is the seasonal meeting point or flag", () => {
  render(<NationLocation aoId="fe-ao-south-park" seasonal />);
  const url = new URL(
    screen.getByRole("link", { name: "F3 Nation map ↗" }).getAttribute("href")!,
  );
  expect(url.origin).toBe("https://map.f3nation.com");
  expect(url.searchParams.get("locationId")).toBe("38856");
  expect(
    screen.getByText(/Listed default: Brougham Elementary School/),
  ).toHaveTextContent("Seasonal meeting points may differ");
});
it("keeps separate Nation pins for Stagecoach and The Gathering at their shared broader venue", () => {
  const stagecoach = directory.aos.find(
    (ao) => ao.localId === "fe-ao-stagecoach",
  )!.defaultLocation;
  const gathering = directory.aos.find(
    (ao) => ao.localId === "fe-ao-the-gathering",
  )!.defaultLocation;
  expect(stagecoach.id).toBe(42247);
  expect(gathering.id).toBe(51439);
  expect(stagecoach.latitude).not.toBe(gathering.latitude);
});
it("renders no invented reference for an unmatched local AO", () => {
  const { container } = render(<NationLocation aoId="unmatched" />);
  expect(container.textContent).toBe("");
});
