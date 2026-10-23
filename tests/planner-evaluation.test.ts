import { expect, it, vi } from "vitest";
import {
  assessEvaluation,
  evaluationCases,
  runEvaluation,
} from "../server/planner-evaluation";
import { fallbackPlan } from "../src/fallback";
import { plannerRequestSchema } from "../src/planner-contract";
it("never reports a template fallback as a successful live AI evaluation", () => {
  const request = plannerRequestSchema.parse(evaluationCases[0].request);
  expect(assessEvaluation(fallbackPlan(request), request).outcome).toBe(
    "template",
  );
  expect(() =>
    assessEvaluation({ provider: "Gemini", plan: {} }, request),
  ).toThrow();
});
it("stops at an authentication barrier without probing other hosts or retrying providers", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("Sign in", { status: 401 }));
  const report = await runEvaluation(
    "https://studio-ux-streamline--fe-workout-planner.netlify.app",
    fetcher,
  );
  expect(report.passed).toBe(false);
  expect(report.results[0].outcome).toBe("auth-blocked");
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(runEvaluation("https://q.f3thefe.com", fetcher)).rejects.toThrow(
    "staging",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
