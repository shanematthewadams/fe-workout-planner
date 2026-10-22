// @vitest-environment jsdom
import { startPlanning } from "./planning-helpers";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import App from "../src/App";
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});
it("plans at a custom start with a one-workout closure while keeping the common path short", () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<App />);
  startPlanning();
  expect(
    screen.getByRole("heading", { name: /Let’s make it yours/ }),
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText("Q location"), {
    target: { value: "Clocktower" },
  });
  expect(screen.getByLabelText("Where and when")).toHaveTextContent(
    "Steps / stairs",
  );
  fireEvent.input(screen.getByLabelText("Start time"), {
    target: { value: "06:30" },
  });
  fireEvent.click(screen.getByText("Anything different today?"));
  fireEvent.change(screen.getByLabelText("Steps / stairs today"), {
    target: { value: "unavailable" },
  });
  fireEvent.change(screen.getByLabelText("Today’s conditions"), {
    target: { value: "The field is muddy today." },
  });
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: "Dora" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use offline template" }));
  expect(screen.getByLabelText("45-minute Q timeline")).toHaveTextContent(
    "7:15 AM",
  );
  fireEvent.click(screen.getByRole("button", { name: "Print workout" }));
  expect(
    screen.getByText(/Steps \/ stairs, Grass \/ turf field/),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: /^Lead (?:this )?workout$/ }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Session timer" }));
  fireEvent.click(screen.getByText("Schedule & session settings"));
  expect(
    screen.getByRole("button", { name: "Join live 6:30 AM schedule" }),
  ).toBeVisible();
});
it("allows an unfamiliar AO and handles an empty time without losing the app", () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<App />);
  startPlanning();
  fireEvent.change(screen.getByLabelText("Q location"), {
    target: { value: "Downrange on vacation" },
  });
  fireEvent.change(screen.getByLabelText("Start time"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use offline template" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a start time");
  expect(
    screen.getByRole("button", { name: "Use offline template" }),
  ).toBeVisible();
});

it("keeps amenity controls optional and carries temporary details into a plan", () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const view = render(<App />);
  startPlanning();
  fireEvent.change(screen.getByLabelText("Q location"), {
    target: { value: "Custom AO" },
  });
  expect(screen.getByLabelText("Surface today")).not.toBeVisible();
  fireEvent.click(screen.getByText("Anything different today?"));
  fireEvent.change(screen.getByLabelText("Surface today"), {
    target: { value: "turf_and_asphalt" },
  });
  fireEvent.change(screen.getByLabelText("Lighting today"), {
    target: { value: "lit" },
  });
  fireEvent.change(screen.getByLabelText("Coupons stored on site today"), {
    target: { value: "false" },
  });
  view.unmount();
  render(<App />);
  startPlanning();
  expect(screen.getByLabelText("Surface today")).toHaveValue(
    "turf_and_asphalt",
  );
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: "Dora with coupons" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use offline template" }));
  fireEvent.click(screen.getByRole("button", { name: "Print workout" }));
  expect(
    screen.getByText(/Surface: Turf and asphalt. Lighting: Lit./),
  ).toHaveTextContent("Coupons stored on site: no; bring your own if needed");
});
