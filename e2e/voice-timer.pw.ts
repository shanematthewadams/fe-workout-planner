import { startPlanning } from "./navigation";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("voice cues follow the clock and cancel cleanly on phones and desktops", async ({
  page,
}, info) => {
  // Test the app's speech contract deterministically. CI does not have phone voices/speakers.
  // The existing Tabata journey separately exercises the native Web Audio engine.
  await page.addInitScript(() => {
    const state = { words: [] as string[], cancellations: 0 };
    Object.defineProperty(window, "__timerSpeech", { value: state });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [],
        cancel: () => {
          state.cancellations++;
        },
        speak: (utterance: SpeechSynthesisUtterance) => {
          state.words.push(utterance.text);
          utterance.onstart?.(new Event("start") as SpeechSynthesisEvent);
        },
      },
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      configurable: true,
      value: class {
        constructor(public text: string) {}
      },
    });
  });
  await page.goto("/");
  await startPlanning(page);
  await page
    .getByRole("button", { name: "Use offline template", exact: true })
    .click();
  await page
    .getByRole("button", { name: /^Lead (?:this )?workout$/, exact: true })
    .click();
  if (
    !(await page
      .getByRole("button", { name: "Intervals", exact: true })
      .isVisible())
  )
    await page.getByText("Timer options", { exact: true }).click();
  await page.getByRole("button", { name: "Intervals", exact: true }).click();
  await page.clock.install();
  const sound = () =>
    page.getByRole("combobox", { name: "Timer sound", exact: true });
  const speech = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            __timerSpeech: { words: string[]; cancellations: number };
          }
        ).__timerSpeech,
    );
  await expect(sound()).toHaveValue("off");
  await sound().selectOption("voice");
  await page
    .getByRole("button", { name: "Preview sound", exact: true })
    .click();
  expect((await speech()).words).toEqual(["Voice on", "Three, two, one, go"]);
  await page
    .getByRole("button", { name: "Start intervals", exact: true })
    .click();
  await page.clock.runFor(10000);
  expect((await speech()).words.slice(-5)).toEqual([
    "Get ready",
    "Three",
    "Two",
    "One",
    "Go",
  ]);
  await page.clock.runFor(20000);
  expect((await speech()).words.slice(-7)).toEqual([
    "Halfway",
    "Five",
    "Four",
    "Three",
    "Two",
    "One",
    "Stop",
  ]);
  await page
    .getByRole("button", { name: "Pause intervals", exact: true })
    .click();
  const paused = await speech();
  await page.clock.runFor(10000);
  expect((await speech()).words).toEqual(paused.words);
  await expect(page.getByRole("timer")).toHaveText("00:10");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-voice-timer.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 844, height: 390 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `qa/screenshots/${info.project.name}-voice-landscape.png`,
    fullPage: true,
  });
  await sound().selectOption("off");
  await page
    .getByRole("button", { name: "Resume intervals", exact: true })
    .click();
  await page.clock.runFor(10000);
  expect((await speech()).words).toEqual(paused.words);
  expect((await speech()).cancellations).toBeGreaterThan(paused.cancellations);
  await expect(
    page.getByRole("heading", { name: "Work", exact: true }),
  ).toBeVisible();
});
