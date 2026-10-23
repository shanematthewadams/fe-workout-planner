import { beforeEach, vi } from "vitest";
const originalFetch = globalThis.fetch;
/** Only the shared API integration test may contact its own loopback server. */
export function localApiFetch(input: string, init?: RequestInit) {
  const url = new URL(input);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1")
    throw Error("Integration requests must stay on the local test server.");
  return originalFetch(input, { ...init, redirect: "error" });
}
// Each component test starts at a fresh page URL; navigation tests set their own route.
beforeEach(() => {
  // Unit/component tests must never contact real or placeholder hosts. Tests that
  // exercise HTTP explicitly replace this with their own fixture implementation.
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValue(
        new Error(
          "Network is disabled in unit tests; provide an HTTP fixture.",
        ),
      ),
  );
  if (typeof window !== "undefined") history.replaceState({}, "", "/");
});
