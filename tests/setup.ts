import { beforeEach } from "vitest";
// Each component test starts at a fresh page URL; navigation tests set their own route.
beforeEach(() => {
  if (typeof window !== "undefined") history.replaceState({}, "", "/");
});
