// @vitest-environment jsdom
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
  expect(
    screen.getByRole("heading", { name: "Plan your next Q." }),
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText("Q location"), {
    target: { value: "Clocktower" },
  });
  expect(screen.getByLabelText("Where and when")).toHaveTextContent(
    "Steps / stairs",
  );
  fireEvent.change(screen.getByLabelText("Start time"), {
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
  fireEvent.click(screen.getByRole("button", { name: "Plan" }));
  expect(
    screen.getByText(/Steps \/ stairs, Grass \/ turf field/),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Launch Field Q-Timer" }));
  expect(
    screen.getByRole("button", { name: "Join live 6:30 AM schedule" }),
  ).toBeVisible();
});
it("allows an unfamiliar AO and handles an empty time without losing the app", () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<App />);
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
