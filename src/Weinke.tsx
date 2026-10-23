import { useEffect, useRef, useState } from "react";
import { AppIcon } from "./AppIcon";
import { workoutSchema, uid, type Workout, type Section } from "./model";

type Fields = {
  title: string;
  warmup: string;
  thang: string;
  mary: string;
  cot: string;
};
const empty: Fields = { title: "", warmup: "", thang: "", mary: "", cot: "" };
const labels = {
  warmup: "Warmup",
  thang: "The Thang",
  mary: "Mary",
  cot: "COT / reminders",
} as const;

/** Literal authoring: no exercise inference, generated counts, or invented timing. */
export function makeWeinke(fields: Fields, base?: Workout): Workout {
  if (!fields.thang.trim())
    throw Error("Add The Thang so you have a workout to lead.");
  return workoutSchema.parse({
    schemaVersion: 1,
    id: base?.id ?? uid(),
    title: fields.title.trim() || "My Weinke",
    summary: "Your own workout · phone-ready crib sheet",
    kind: "personal",
    duration: null,
    equipment: [],
    running: "None",
    format: "Custom",
    sections: (["warmup", "thang", "mary"] as const).flatMap(
      (kind): Section[] => {
        const text = fields[kind].trim();
        if (!text) return [];
        const previous = base?.sections.find((s) => s.kind === kind);
        return [
          {
            id: previous?.id ?? uid(),
            kind,
            title: labels[kind],
            blocks: [
              {
                id: previous?.blocks[0]?.id ?? uid(),
                title: labels[kind],
                minutes: null,
                instructions: text,
                exercises: [],
              },
            ],
          },
        ];
      },
    ),
    rawNotes: "",
    adaptationNotes: fields.cot,
    provenance: {
      status: "personal",
      label: "Personal Weinke · written by you",
      durationBasis: "unknown",
      issues: [
        "Equipment, running requirements and timing are not inferred from your notes. Review your instructions before leading. Timer setup is optional and separate.",
      ],
    },
    ...(base?.attribution ? { attribution: base.attribution } : {}),
    ...(base?.originId ? { originId: base.originId } : {}),
    updatedAt: new Date().toISOString(),
  });
}

export function Weinke({
  storageKey,
  onBack,
  onSave,
  onLead,
}: {
  storageKey: string;
  onBack: () => void;
  onSave: (w: Workout, base?: Workout) => Workout | false;
  onLead?: (w: Workout) => void;
}) {
  const [initial] = useState(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      const fields = { ...empty };
      for (const key of Object.keys(empty) as (keyof Fields)[])
        if (typeof value?.fields?.[key] === "string")
          fields[key] = value.fields[key].slice(
            0,
            key === "title" ? 160 : 20000,
          );
      const parsed = workoutSchema.safeParse(value?.base);
      return { fields, base: parsed.success ? parsed.data : undefined };
    } catch {
      return { fields: empty, base: undefined };
    }
  });
  const [fields, setFields] = useState(initial.fields);
  const [base, setBase] = useState(initial.base);
  const [preview, setPreview] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [preview]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function remember(next: Fields, saved = base) {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ fields: next, base: saved }),
      );
    } catch {
      setNotice(
        "This browser cannot recover these notes after refresh. Keep a copy until you save.",
      );
    }
  }
  function save() {
    setError("");
    try {
      const saved = onSave(makeWeinke(fields, base), base);
      if (!saved) {
        setError(
          "Couldn’t save on this device. Your notes are still here. Try again before leaving.",
        );
        return;
      }
      setBase(saved);
      remember(fields, saved);
      setNotice("Saved on this device. Cloud status is shown separately.");
      onLead?.(saved);
    } catch {
      setError(
        "Couldn’t save this sheet. Check the title and workout details, then try again. Your notes are still here.",
      );
    }
  }
  return (
    <section className="weinke" aria-labelledby="weinke-heading">
      <button type="button" onClick={onBack}>
        ← Choose another starting point
      </button>
      {base && (
        <button
          type="button"
          onClick={() => {
            if (
              !window.confirm(
                "Start a new Weinke? Your saved workout stays in My Workouts. Any unsaved notes on this form will be replaced.",
              )
            )
              return;
            setFields({ ...empty });
            setBase(undefined);
            setPreview(false);
            setError("");
            setNotice("");
            try {
              sessionStorage.removeItem(storageKey);
            } catch {
              /* Existing saved workout is safe. */
            }
          }}
        >
          Start a new Weinke
        </button>
      )}
      <p className="eyebrow">YOUR WORKOUT. YOUR WORDS.</p>
      <h1
        ref={!preview ? heading : undefined}
        tabIndex={-1}
        id="weinke-heading"
      >
        Make a Weinke
      </h1>
      <p>
        Already know your workout? Put it on your phone. No AI, no special
        formatting.
      </p>
      <p className="muted">
        Keep reps, rounds and counting rules in your notes exactly as you want
        to call them.
      </p>
      {!preview ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPreview(true);
            setError("");
          }}
        >
          <label htmlFor="weinke-title">Workout name (optional)</label>
          <input
            id="weinke-title"
            value={fields.title}
            maxLength={160}
            onChange={(event) => {
              const next = { ...fields, title: event.target.value };
              setFields(next);
              remember(next);
            }}
          />
          {(["thang", "warmup", "mary", "cot"] as const).map((key) => (
            <div key={key}>
              <label htmlFor={`weinke-${key}`}>
                {labels[key]}
                {key !== "thang" ? " (optional)" : ""}
              </label>
              <textarea
                id={`weinke-${key}`}
                rows={key === "thang" ? 8 : 3}
                required={key === "thang"}
                maxLength={20000}
                value={fields[key]}
                placeholder={
                  key === "thang"
                    ? "11s: heavy squats and merkins.\nBetween rounds: wall sit.\nFinish with partner coupon carries."
                    : undefined
                }
                onChange={(event) => {
                  const next = { ...fields, [key]: event.target.value };
                  setFields(next);
                  remember(next);
                }}
              />
            </div>
          ))}
          <button
            className="create"
            disabled={!fields.thang.trim()}
            type="submit"
          >
            <AppIcon name="sheet" /> Preview my Weinke
          </button>
        </form>
      ) : (
        <section aria-label="Weinke preview">
          <h2 ref={heading} tabIndex={-1}>
            {fields.title.trim() || "My Weinke"}
          </h2>
          {(["warmup", "thang", "mary", "cot"] as const).map(
            (key) =>
              fields[key].trim() && (
                <article key={key}>
                  <h3>{labels[key]}</h3>
                  <p className="import-directions">{fields[key]}</p>
                </article>
              ),
          )}
          <p className="muted">
            Preview only. Save to keep it in My Workouts and open the phone
            view. No timer starts.
          </p>
          <div className="actions">
            <button type="button" onClick={() => setPreview(false)}>
              <AppIcon name="mine" /> Keep editing
            </button>
            <button type="button" className="create" onClick={save}>
              <AppIcon name="sheet" /> Save &amp; open Weinke
            </button>
          </div>
        </section>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="assistant-error">
          {error}
        </p>
      )}
    </section>
  );
}
