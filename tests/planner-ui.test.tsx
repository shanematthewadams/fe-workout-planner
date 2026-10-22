// @vitest-environment jsdom
import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  act,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Planner } from "../src/Planner";
import type { Workout } from "../src/model";
import { generatePlan } from "../server/planner-service";
import { GOLD_RUSH_EXAMPLE } from "../src/planner-contract";
import { planFixture } from "./fixtures/plan";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
async function responseFixture() {
  return generatePlan(
    { prompt: GOLD_RUSH_EXAMPLE },
    { OPENROUTER_API_KEY: "fixture" },
    vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "fixture:free",
          choices: [{ message: { content: JSON.stringify(planFixture) } }],
        }),
      ),
    ),
  );
}
it("creates, refines without losing the last good draft, saves and previews private work", async () => {
  const result = await responseFixture();
  const f = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(result)))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: "Free AI has reached its current limit." }),
        { status: 429 },
      ),
    );
  const onSave = vi.fn((workout: Workout) => workout),
    onPreview = vi.fn(),
    onEdit = vi.fn();
  render(
    <Planner
      onSave={onSave}
      onPreview={onPreview}
      onEdit={onEdit}
      onReference={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: GOLD_RUSH_EXAMPLE },
  });
  fireEvent.click(screen.getByRole("button", { name: "Build my workout" }));
  expect(
    await screen.findByRole("heading", { name: "Stake Your Claim" }),
  ).toBeVisible();
  fireEvent.change(screen.getByLabelText("What would you change?"), {
    target: { value: "Less running, keep everything else." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Refine this draft" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("current limit");
  expect(
    screen.getByRole("heading", { name: "Stake Your Claim" }),
  ).toBeVisible();
  const body = JSON.parse(String(f.mock.calls[1][1]?.body));
  expect(body.current).toEqual(result.plan);
  expect(body.prompt).toContain("Less running");
  fireEvent.click(screen.getByRole("button", { name: "Save workout" }));
  expect(onSave).toHaveBeenCalledWith(result.workout);
  fireEvent.click(screen.getByRole("button", { name: "Preview & print" }));
  expect(onPreview).toHaveBeenCalledWith(result.workout);
  fireEvent.click(screen.getByRole("button", { name: "Edit the details" }));
  expect(onEdit).toHaveBeenCalledWith(result.workout);
  cleanup();
  render(
    <Planner
      onSave={onSave}
      onPreview={onPreview}
      onEdit={onEdit}
      onReference={() => {}}
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Stake Your Claim" }),
  ).toBeVisible();
});
it("ignores a cancelled stale response and does not persist it over a later session", async () => {
  const result = await responseFixture();
  let resolve!: (r: Response) => void;
  vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  render(
    <Planner
      onSave={(workout) => workout}
      onPreview={() => {}}
      onEdit={() => {}}
      onReference={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: { value: GOLD_RUSH_EXAMPLE },
  });
  fireEvent.click(screen.getByRole("button", { name: "Build my workout" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel generation" }));
  resolve(new Response(JSON.stringify(result)));
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { name: "Stake Your Claim" }),
    ).toBeNull(),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("previous draft is safe");
});

it.each([504, 503, 400])(
  "keeps a draft intact and hides backend details after HTTP %i",
  async (status) => {
    const result = await responseFixture();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(result)))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "internal provider diagnostic: credential rejected",
          }),
          { status },
        ),
      );
    render(
      <Planner
        onSave={(workout) => workout}
        onPreview={() => {}}
        onEdit={() => {}}
        onReference={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Describe your Q"), {
      target: { value: GOLD_RUSH_EXAMPLE },
    });
    fireEvent.click(screen.getByRole("button", { name: "Build my workout" }));
    await screen.findByRole("heading", { name: "Stake Your Claim" });
    fireEvent.change(screen.getByLabelText("What would you change?"), {
      target: { value: "Less running" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refine this draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "previous draft is safe",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("credential");
    expect(
      screen.getByRole("heading", { name: "Stake Your Claim" }),
    ).toBeVisible();
  },
);

it("aborts a stalled provider once without losing the current draft or retrying", async () => {
  render(
    <Planner
      onSave={(workout) => workout}
      onPreview={() => {}}
      onEdit={() => {}}
      onReference={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Use offline template" }));
  const title = screen.getByRole("heading", { level: 1 }).textContent;
  const f = vi.spyOn(globalThis, "fetch").mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      }),
  );
  vi.useFakeTimers();
  try {
    fireEvent.change(screen.getByLabelText("What would you change?"), {
      target: { value: "Less running" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Refine this draft" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(55000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("took too long");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120000);
    });
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0][1]?.signal?.aborted).toBe(true);
  } finally {
    vi.useRealTimers();
  }
});

it("Surprise Me preserves no-running and no-Mary conditions from the current idea", async () => {
  const f = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response("{}", { status: 503 }));
  render(
    <Planner
      onSave={(w) => w}
      onPreview={() => {}}
      onEdit={() => {}}
      onReference={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText("Describe your Q"), {
    target: {
      value: "Coupons today. No running. No Mary. The track is closed.",
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Surprise Me!" }));
  await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
  const request = JSON.parse(String(f.mock.calls[0][1]?.body));
  expect(request.running).toBe("None");
  expect(request.mary).toBe(false);
  expect(request.equipment).toBe("Coupon");
  expect(request.site.overrides.track).toBe("unavailable");
});
