import official from "../data/ao-official.json";
import local from "../data/ao-local.json";
export type LocalAO = {
  amenities?: Partial<import("./site-contract").Amenities>;
  features?: Partial<
    Record<
      import("./site-contract").Feature,
      { state: import("./site-contract").Availability; detail?: string }
    >
  >;
  reviewBasis?: string;
  walls?: string;
  hills?: string;
  stairs?: string;
  distances?: string;
  lighting?: string;
  coupons?: string;
  weather?: string;
  checkedAt?: string;
  sourceUrl?: string;
};
export const aoProfiles = official.map((ao) => ({
  ...ao,
  local: (local as Record<string, LocalAO>)[ao.id] ?? {},
}));
export const statusLabel = (status: string) =>
  ({
    illustrative: "Illustrative starter",
    personal: "Personal draft",
    "imported-unreviewed": "Awaiting review",
    "regional-reviewed": "Reviewed FE original",
  })[status] ?? status;
