import { useEffect, useRef, useState } from "react";
import { AppIcon } from "./AppIcon";
import {
  WeinkeBlocks,
  weinkeBlocksSchema,
  type WeinkeBlock,
} from "./WeinkeBlocks";
import { workoutSchema, uid, type Workout, type Section } from "./model";

type Fields = {
  title: string;
  warmup: string;
  thang: string;
  mary: string;
  cot: string;
  blocks?: WeinkeBlock[];
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
  const blocks = weinkeBlocksSchema.parse(fields.blocks ?? []);
  if (
    !fields.thang.trim() &&
    !blocks.some((b) => b.instructions.trim() || b.exercises.length)
  )
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
        if (!text && !(kind === "thang" && blocks.length)) return [];
        const previous = base?.sections.find((s) => s.kind === kind);
        return [
          {
            id: previous?.id ?? uid(),
            kind,
            title: labels[kind],
            blocks: [
              ...(text
                ? [
                    {
                      id: previous?.blocks[0]?.id ?? uid(),
                      title: labels[kind],
                      minutes: null,
                      instructions: text,
                      exercises: [],
                    },
                  ]
                : []),
              ...(kind === "thang"
                ? blocks.map(({ rounds, ...block }) => ({
                    ...block,
                    instructions: [
                      rounds.trim() ? `Rounds: ${rounds}` : "",
                      block.instructions,
                    ]
                      .filter(Boolean)
                      .join("\n"),
                  }))
                : []),
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
        "Equipment not specified; confirm the full workout before leading.",
        "Running requirement not supplied; confirm before leading.",
        "Timing is not inferred from your notes. Timer setup is optional and separate.",
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
  showNewAction = true,
}: {
  showNewAction?: boolean;
  storageKey: string;
  onBack: () => void;
  onSave: (w: Workout, base?: Workout) => Workout | false;
  onLead?: (w: Workout) => void;
}) {
  const [initial] = useState(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      const fields: Fields = { ...empty };
      for (const key of ["title", "warmup", "thang", "mary", "cot"] as const)
        if (typeof value?.fields?.[key] === "string")
          fields[key] = value.fields[key].slice(
            0,
            key === "title" ? 160 : 20000,
          );
      const blocks = weinkeBlocksSchema.safeParse(value?.fields?.blocks ?? []);
      if (blocks.success) fields.blocks = blocks.data;
      const parsed = workoutSchema.safeParse(value?.base);
      return {
        fields,
        base: parsed.success ? parsed.data : undefined,
        blocksError: !blocks.success,
      };
    } catch {
      return { fields: empty, base: undefined, blocksError: false };
    }
  });
  const [fields, setFields] = useState(initial.fields);
  const [recoveryBlocked, setRecoveryBlocked] = useState(initial.blocksError);
  const [base, setBase] = useState(initial.base);
  const [preview, setPreview] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [preview]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function remember(next: Fields, saved = base) {
    if (recoveryBlocked) return; // Preserve the original recovery record.
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
    if (recoveryBlocked) return;
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
      {base && showNewAction && (
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
            setRecoveryBlocked(false);
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
      {recoveryBlocked && (
        <p role="alert">
          Some recovered blocks could not be read. Your original recovery record
          is untouched. Copy the notes you can see before starting a new
          workout; saving is paused to protect your work.
        </p>
      )}
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
                required={
                  key === "thang" &&
                  !fields.blocks?.some(
                    (b) => b.instructions.trim() || b.exercises.length,
                  )
                }
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
          <WeinkeBlocks
            blocks={fields.blocks ?? []}
            onChange={(blocks) => {
              const next = { ...fields, blocks };
              setFields(next);
              remember(next);
            }}
          />
          <button
            className="create"
            disabled={
              recoveryBlocked ||
              (!fields.thang.trim() &&
                !fields.blocks?.some(
                  (b) => b.instructions.trim() || b.exercises.length,
                ))
            }
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
              (fields[key].trim() ||
                (key === "thang" && !!fields.blocks?.length)) && (
                <article key={key}>
                  <h3>{labels[key]}</h3>
                  <p className="import-directions">{fields[key]}</p>
                  {key === "thang" &&
                    fields.blocks?.map((block) => (
                      <div key={block.id}>
                        <h4>{block.title}</h4>
                        {block.rounds && <p>Rounds: {block.rounds}</p>}
                        <p className="import-directions">
                          {block.instructions}
                        </p>
                        {block.exercises.map((exercise) => (
                          <p key={exercise.id}>
                            {exercise.name} · {exercise.amount}{" "}
                            {exercise.unit !== "instructions"
                              ? exercise.unit
                              : ""}{" "}
                            · {exercise.counting}
                            <br />
                            {exercise.instructions}
                          </p>
                        ))}
                      </div>
                    ))}
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
