import { expect, it } from "vitest";
import { importSiteQRoster } from "../scripts/site-q-roster";
import roster from "../data/ao-site-qs.json";
import official from "../data/ao-official.json";
const local = [{ id: "south-park", name: "South Park" }];
const header = ["AO", "Site Q(s)", "Report author"];
it("uses the explicit Site Q column and merges identical seasonal-venue rosters", () => {
  const result = importSiteQRoster(
    [
      header,
      ["South Park", "Duffalo; Jazz Hands", "Shane"],
      ["South Park", "Duffalo; Jazz Hands", "Other attendee"],
    ],
    local,
  );
  expect(result).toEqual({
    "south-park": { names: ["Duffalo", "Jazz Hands"], sourceRows: [5, 6] },
  });
});
it("requires review for conflicting seasonal rosters and ambiguous or unknown AO identities", () => {
  expect(() =>
    importSiteQRoster(
      [header, ["South Park", "Duffalo"], ["South Park", "Someone else"]],
      local,
    ),
  ).toThrow("Conflicting");
  expect(() =>
    importSiteQRoster([header, ["South", "Duffalo"]], local),
  ).toThrow("identity");
  expect(() =>
    importSiteQRoster(
      [header, ["South Park", "Duffalo"]],
      [...local, { id: "duplicate", name: "South Park" }],
    ),
  ).toThrow("identity");
});
it("keeps missing roster names unknown and does not infer them from the reporter", () => {
  expect(
    importSiteQRoster([header, ["South Park", "Pending", "Shane"]], local)[
      "south-park"
    ].names,
  ).toEqual([]);
  expect(() =>
    importSiteQRoster(
      [
        ["AO", "Report author"],
        ["South Park", "Shane"],
      ],
      local,
    ),
  ).toThrow("headers");
});
it("covers every current AO from the reviewed inventory and preserves co-Qs", () => {
  expect(new Set(Object.keys(roster.siteQs))).toEqual(
    new Set(official.map((ao) => ao.id)),
  );
  expect(roster.siteQs["fe-ao-south-park"].names).toEqual([
    "Duffalo",
    "Jazz Hands",
  ]);
  expect(roster.siteQs["fe-ao-overdraft"].names).toEqual(["Rug Burn"]);
  expect(roster.siteQs["fe-ao-airfield"].names).toEqual(["MaBell", "Lettuce"]);
});
