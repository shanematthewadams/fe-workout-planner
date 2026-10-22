import { useEffect, useRef } from "react";
import { AppIcon } from "./AppIcon";
import { VIBES, conceptsFor, type Vibe } from "./workout-concepts";
export type WelcomeStep = "welcome" | "vibe" | "location" | "concept" | "ready";
export function PlannerWelcome({
  step,
  vibe,
  onStep,
  onVibe,
  onConcept,
  location,
}: {
  step: WelcomeStep;
  vibe: Vibe;
  onStep: (step: WelcomeStep) => void;
  onVibe: (vibe: Vibe) => void;
  onConcept: (prompt: string) => void;
  location: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  if (step === "ready") return null;
  return (
    <section className="planner-discovery" aria-label="Find your next Q">
      {step === "welcome" ? (
        <>
          <p className="eyebrow">F3 Q BUILDER</p>
          <h1 ref={heading} tabIndex={-1}>
            You’ve got the Q.
            <br />
            Let’s make it a good one.
          </h1>
          <p>
            Plan a workout you’re excited to lead. Make it yours, then take it
            to the gloom.
          </p>
          <p className="planner-welcome-note">
            No account needed. Start with what you have in mind.
          </p>
          <div className="choice-grid entry-choices">
            <button
              type="button"
              aria-label="I have an idea"
              onClick={() => onStep("ready")}
            >
              <AppIcon name="mine" size={28} />
              <strong>I have an idea</strong>
              <span>Tell us what you’re thinking.</span>
            </button>
            <button
              type="button"
              aria-label="Help me find one"
              onClick={() => onStep("vibe")}
            >
              <AppIcon name="builder" size={28} />
              <strong>Help me find one</strong>
              <span>A little inspiration goes a long way.</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() =>
              onStep(
                step === "vibe"
                  ? "welcome"
                  : step === "location"
                    ? "vibe"
                    : "location",
              )
            }
          >
            ← Back
          </button>
          <h1 ref={heading} tabIndex={-1}>
            {step === "vibe"
              ? "What sounds good?"
              : step === "location"
                ? "Where’s your next Q?"
                : "Which one gets you going?"}
          </h1>
          {step === "vibe" && (
            <div className="choice-grid">
              {VIBES.map((v) => (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => {
                    onVibe(v.id);
                    onStep("location");
                  }}
                >
                  <AppIcon name={v.icon} size={28} />
                  <strong>{v.title}</strong>
                  <span>{v.detail}</span>
                </button>
              ))}
            </div>
          )}
          {step === "location" && (
            <>
              {location}
              <button
                type="button"
                className="create"
                onClick={() => onStep("concept")}
              >
                Show me some ideas <AppIcon name="builder" />
              </button>
              <p>
                Downrange or undecided? You can leave the AO blank. Ideas use no
                special site features.
              </p>
            </>
          )}
          {step === "concept" && (
            <>
              <p>Three starting points. Pick one and we’ll make it yours.</p>
              <div className="choice-grid">
                {conceptsFor(vibe).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onConcept(c.prompt)}
                  >
                    <AppIcon name="sheet" size={24} />
                    <strong>{c.title}</strong>
                    <span>{c.description}</span>
                    <span className="choice-link">Make this mine →</span>
                  </button>
                ))}
              </div>
              <p>No AI used yet. Coupons and running are up to you next.</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
