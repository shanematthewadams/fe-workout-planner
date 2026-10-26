// @vitest-environment jsdom
import { it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { AOContextPanel } from "../src/AOContextPanel";
import { Discovery } from "../src/Discovery";
import { catalogAO } from "./fixtures/ao-catalog";
import {
  clearAOCatalogCache,
  loadAOCatalog,
  cachedSiteContext,
  withLiveAO,
} from "../src/use-ao-catalog";
import { fallbackPlan } from "../src/fallback";
import { resolveRequest } from "../src/planner-contract";
import { catalogBaseline } from "../src/ao-catalog";
import { withLocalAO, TERRAIN_KEY } from "../src/ao-drafts";
import type { SiteInput } from "../src/site-contract";
function Panel({ name = "Gold Rush" }: { name?: string }) {
  const [ao, setAO] = useState(name),
    [site, setSite] = useState<SiteInput>({ overrides: {}, notes: "" });
  return (
    <AOContextPanel
      ao={ao}
      onAO={(v) => {
        setAO(v);
        setSite({ overrides: {}, notes: "" });
      }}
      prompt="Bodyweight circuit"
      startTime="05:30"
      onTime={() => {}}
      site={site}
      onSite={setSite}
      disabled={false}
    />
  );
}
function respond() {
  return vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const id = new URL(String(input), "https://test.local").searchParams.get(
      "ao",
    )!;
    return new Response(
      JSON.stringify({
        version: 1,
        source: "database",
        catalog: catalogAO(id),
      }),
    );
  });
}
beforeEach(() => {
  clearAOCatalogCache();
  localStorage.clear();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});
afterEach(() => {
  cleanup();
  clearAOCatalogCache();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("displays live absence instead of bundled confirmation and keeps closures and offline snapshots consistent", async () => {
  const data = catalogAO("fe-ao-gold-rush");
  data.ao_venue_assignments[0].ao_venues.ao_venue_amenities.find(
    (f) => f.amenity_id === "running-track",
  )!.availability = "absent";
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ version: 1, source: "database", catalog: data }),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  render(<Panel />);
  await screen.findByText("Regional AO details · confirm current access");
  expect(screen.getByLabelText("Track today")).toHaveTextContent(
    "Profile: unavailable",
  );
  expect(screen.getByText(/By basketball goals/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Track today"), {
    target: { value: "available" },
  });
  fireEvent.change(
    screen
      .getByText("Today’s conditions")
      .closest("label")!
      .querySelector("textarea")!,
    { target: { value: "The track is closed today." } },
  );
  expect(
    screen.getByLabelText("Where and when").querySelector(".ao-quick-summary"),
  ).not.toHaveTextContent("Track,");
  const req = resolveRequest({
    ao: "Gold Rush",
    prompt: "Bodyweight circuit",
    equipment: "None",
    running: "None",
    strictSchedule: true,
    site: {
      overrides: { track: "available" },
      notes: "The track is closed today.",
    },
  });
  const context = cachedSiteContext(req.ao, req.prompt, req.site);
  expect(context.features.track).toBe("unavailable");
  expect(fallbackPlan(req, context).workout.schedule?.siteSummary).toContain(
    "By basketball goals",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("keeps restricted turf and nearby garage distinct, with no technical import text in the UI", async () => {
  vi.stubGlobal("fetch", respond());
  render(<Panel name="Pretty Bird" />);
  await screen.findByText("Regional AO details · confirm current access");
  fireEvent.click(screen.getByText("Facilities & landmarks"));
  expect(screen.getByText("Restricted — check access")).toBeInTheDocument();
  expect(
    screen.getByText("Artificial turf", { exact: true }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("Garmin parking garage", { exact: true }),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText("Shelter / covered space today"),
  ).toHaveTextContent("Profile: unknown");
  expect(screen.getByLabelText("Where and when")).not.toHaveTextContent(
    "scripts/ao-intelligence",
  );
});
it("loads one AO record for both seasonal venues and preserves legacy venue-scoped device drafts", async () => {
  const fetcher = respond();
  vi.stubGlobal("fetch", fetcher);
  localStorage.setItem(
    TERRAIN_KEY,
    JSON.stringify({
      "fe-ao-south-park:heritage-marina": {
        track: { state: "available", detail: "Unpublished marina note" },
      },
    }),
  );
  render(<Panel name="South Park" />);
  await screen.findByText("Regional AO details · confirm current access");
  expect(screen.getByLabelText("Workout venue")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Workout venue"), {
    target: { value: "heritage-park-marina" },
  });
  expect(
    screen.getByLabelText("Where and when").querySelector(".ao-meeting-point"),
  ).toHaveTextContent("Heritage Park Marina");
  expect(screen.getByLabelText("Track today")).toHaveTextContent(
    "Profile: available",
  );
  fireEvent.change(screen.getByLabelText("Workout venue"), {
    target: { value: "brougham-elementary" },
  });
  expect(screen.getByLabelText("Track today")).toHaveTextContent(
    "Profile: unknown",
  );
  expect(
    screen.getByLabelText("Shelter / covered space today"),
  ).toHaveTextContent("Profile: unknown");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(
    withLocalAO("South Park", "", {
      venueId: "heritage-park-marina",
      overrides: {},
      notes: "",
    }).localDraft?.track?.state,
  ).toBe("available");
});
it("ignores a late response when the user switches AOs", async () => {
  let finish!: (value: Response) => void;
  const fetcher = vi.fn<typeof fetch>().mockImplementation((input) =>
    new URL(String(input), "https://test.local").searchParams.get("ao") ===
    "fe-ao-baywatch"
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve(
          new Response(
            JSON.stringify({
              version: 1,
              source: "database",
              catalog: catalogAO("fe-ao-airfield"),
            }),
          ),
        ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(<Panel name="Baywatch" />);
  fireEvent.change(screen.getByLabelText("Q location"), {
    target: { value: "Airfield" },
  });
  await screen.findByText(/Northernmost parking lot; website/);
  await act(async () =>
    finish(
      new Response(
        JSON.stringify({
          version: 1,
          source: "database",
          catalog: catalogAO("fe-ao-baywatch"),
        }),
      ),
    ),
  );
  expect(
    screen.getByLabelText("Where and when").querySelector(".ao-meeting-point"),
  ).toHaveTextContent("Northernmost");
  expect(
    screen.getByLabelText("Where and when").querySelector(".ao-meeting-point"),
  ).not.toHaveTextContent("Southwest");
});
it("coalesces reads, reuses fresh results and expires them after one minute", async () => {
  vi.useFakeTimers();
  const fetcher = respond();
  vi.stubGlobal("fetch", fetcher);
  await Promise.all([
    loadAOCatalog("fe-ao-gold-rush"),
    loadAOCatalog("fe-ao-gold-rush"),
  ]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await loadAOCatalog("fe-ao-gold-rush");
  expect(fetcher).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(61000);
  await loadAOCatalog("fe-ao-gold-rush");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("falls back to saved JSON for network/malformed responses and does not fetch custom AOs", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("Offline")));
  const view = render(<Panel />);
  await screen.findByText(/Using saved AO details/);
  expect(screen.getByLabelText("Track today")).toHaveTextContent(
    "Profile: available",
  );
  view.unmount();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<Panel name="Downrange vacation" />);
  expect(fetcher).not.toHaveBeenCalled();
  const invalid = vi
    .fn()
    .mockResolvedValue(
      new Response('{"version":1,"source":"database","catalog":{}}'),
    );
  vi.stubGlobal("fetch", invalid);
  expect(await loadAOCatalog("fe-ao-gold-rush")).toBeNull();
});
it("shows shared flags and mobile location guidance in the directory, without inventing a mobile map pin", async () => {
  const fetcher = respond();
  vi.stubGlobal("fetch", fetcher);
  render(<Discovery mode="aos" onAO={() => {}} />);
  await waitFor(() =>
    expect(
      screen.getAllByText("Regional AO details · confirm current access"),
    ).toHaveLength(16),
  );
  const card = (name: string) =>
    screen.getByRole("heading", { name }).closest("article")!;
  expect(card("Baywatch")).toHaveTextContent("Southwest parking lot");
  expect(card("Airfield")).toHaveTextContent("Northernmost parking lot");
  expect(card("Vagabonds")).toHaveTextContent("Meeting points rotate");
  expect(card("Vagabonds").querySelector(".ao-map-reference a")).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(16);
});
it("does not equate restricted coupon access with confirmed absence", () => {
  const data = catalogAO("fe-ao-gold-rush");
  const coupons =
    data.ao_venue_assignments[0].ao_venues.ao_venue_amenities.find(
      (f) => f.amenity_id === "coupons-on-site",
    )!;
  coupons.availability = "restricted";
  coupons.verification = "reported";
  const baseline = catalogBaseline(data);
  expect(baseline.amenities?.couponsOnSite).toBeNull();
  expect(baseline.accessNotes).toContain(
    "Restricted facilities: coupons on site",
  );
});

it("uses live venue assignments to scope device drafts when the database adds seasonal choices", async () => {
  const data = catalogAO("fe-ao-gold-rush");
  data.location_mode = "site_q_selected";
  localStorage.setItem(
    TERRAIN_KEY,
    JSON.stringify({
      "fe-ao-gold-rush": { track: { state: "available" } },
      "fe-ao-gold-rush:california-trail-middle-school": {
        stairs: { state: "unavailable" },
      },
    }),
  );
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ version: 1, source: "database", catalog: data }),
        ),
      ),
  );
  await loadAOCatalog(data.id);
  const scoped = withLiveAO("Gold Rush", "", {
    venueId: "california-trail-middle-school",
    overrides: {},
    notes: "",
  });
  expect(scoped.localDraft?.stairs?.state).toBe("unavailable");
  expect(scoped.localDraft?.track).toBeUndefined();
  expect(
    withLiveAO("Gold Rush", "", { overrides: {}, notes: "" }).localDraft,
  ).toBeUndefined();
});
