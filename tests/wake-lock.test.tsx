// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useWakeLock } from "../src/useWakeLock";

it("deduplicates pending screen locks and releases a late grant after stopping", async () => {
  let grant!: (lock: WakeLockSentinel) => void;
  const request = vi.fn(
    () =>
      new Promise<WakeLockSentinel>((resolve) => {
        grant = resolve;
      }),
  );
  const original = Object.getOwnPropertyDescriptor(navigator, "wakeLock");
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("visible");
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  const release = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(({ running }) => useWakeLock(running), {
    initialProps: { running: true },
  });
  try {
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(request).toHaveBeenCalledTimes(1);
    hook.rerender({ running: false });
    await act(async () => {
      grant({ released: false, release } as unknown as WakeLockSentinel);
    });
    expect(release).toHaveBeenCalledTimes(1);
  } finally {
    hook.unmount();
    visibility.mockRestore();
    if (original) Object.defineProperty(navigator, "wakeLock", original);
    else Reflect.deleteProperty(navigator, "wakeLock");
  }
});

it("explains a denied wake lock and leaves the timer usable", async () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "wakeLock");
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("visible");
  const request = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  const hook = renderHook(({ running }) => useWakeLock(running), {
    initialProps: { running: true },
  });
  try {
    await act(async () => {});
    expect(hook.result.current).toContain("Keep it awake manually");
    expect(request).toHaveBeenCalledTimes(1);
    hook.rerender({ running: false });
    expect(hook.result.current).toBe("");
  } finally {
    hook.unmount();
    visibility.mockRestore();
    if (original) Object.defineProperty(navigator, "wakeLock", original);
    else Reflect.deleteProperty(navigator, "wakeLock");
  }
});
