import React, { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  Heart,
  Plus,
  Search,
  SlidersHorizontal,
  Clock3,
  Footprints,
  Dumbbell,
  Copy,
  Printer,
  Maximize2,
  Download,
  Upload,
  X,
  Check,
  Layers3,
} from "lucide-react";
import { catalog } from "./catalog";
import { SupabaseCatalog } from "./repository";
import {
  type Workout,
  type Section,
  type LocalState,
  type Filters,
  type Exercise,
  filtersEmpty,
  matches,
  copyWorkout,
  newWorkout,
  newSection,
  newExercise,
  readState,
  writeState,
  parseBackup,
  mergeBackup,
  timing,
  uid,
  workoutSchema,
} from "./model";
const formatOptions = [
  "Circuit",
  "11s",
  "EMOM",
  "AMRAP",
  "Ladder",
  "Partner",
  "Stations",
  "Chipper",
  "Custom",
];
function load() {
  try {
    return { data: readState(), error: "" };
  } catch {
    return {
      data: { workouts: [], favorites: [] } as LocalState,
      error:
        "Saved browser data could not be read. It has not been changed. Export recovery data before saving new work.",
    };
  }
}
export default function App() {
  const [sources, setSources] = useState(catalog);
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL,
      key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url && !key) return;
    if (!url || !key) {
      setNotice(
        "Shared catalog is not fully configured. Showing bundled starters.",
      );
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    new SupabaseCatalog(url, key)
      .list(controller.signal)
      .then(setSources)
      .catch(() => {
        if (!disposed)
          setNotice("Shared catalog unavailable. Showing bundled starters.");
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);
  const [initial] = useState(load);
  const [state, setState] = useState(initial.data),
    [notice, setNotice] = useState(initial.error),
    [blocked, setBlocked] = useState(!!initial.error),
    [tab, setTab] = useState("library"),
    [filters, setFilters] = useState(filtersEmpty),
    [selected, setSelected] = useState<Workout | null>(null),
    [editing, setEditing] = useState<Workout | null>(null),
    [dirty, setDirty] = useState(false),
    [q, setQ] = useState(false),
    [thangOnly, setThangOnly] = useState(false),
    [pending, setPending] = useState<ReturnType<typeof parseBackup> | null>(
      null,
    );
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const persist = (next: LocalState) => {
    if (blocked) {
      setNotice(
        "Existing data is unreadable. Download recovery data first, then explicitly unlock saving.",
      );
      return false;
    }
    try {
      writeState(next);
      setState(next);
      return true;
    } catch {
      setNotice(
        "Could not save to this browser. Your open changes are still here. Export a backup before leaving, or free storage and retry.",
      );
      return false;
    }
  };
  const leave = () =>
    !dirty || window.confirm("Leave without saving these changes?");
  const go = (next: string) => {
    if (!leave()) return;
    setEditing(null);
    setDirty(false);
    setSelected(null);
    setQ(false);
    setTab(next);
  };
  const open = (w: Workout) => {
    setSelected(w);
    setQ(false);
    window.scrollTo(0, 0);
  };
  const begin = (w: Workout) => {
    setEditing(structuredClone(w));
    setSelected(null);
    setDirty(false);
    window.scrollTo(0, 0);
  };
  const favorite = (id: string) => {
    const has = state.favorites.includes(id);
    if (
      persist({
        ...state,
        favorites: has
          ? state.favorites.filter((x) => x !== id)
          : [...state.favorites, id],
      })
    )
      setNotice(
        has ? "Removed from favorites." : "Saved to favorites on this device.",
      );
  };
  const save = () => {
    if (!editing) return;
    if (
      state.workouts.length >= 200 &&
      !state.workouts.some((w) => w.id === editing.id)
    ) {
      setNotice(
        "This browser has 200 drafts. Export a backup before adding more.",
      );
      return;
    }
    const result = workoutSchema.safeParse(editing);
    if (!result.success) {
      setNotice("Please check the draft: " + result.error.issues[0].message);
      return;
    }
    const w = { ...result.data, updatedAt: new Date().toISOString() };
    const next = {
      ...state,
      workouts: [...state.workouts.filter((x) => x.id !== w.id), w],
    };
    if (persist(next)) {
      setDirty(false);
      setEditing(w);
      setNotice("Workout saved on this device.");
    }
  };
  const exportData = (recovery = false) => {
    try {
      const outgoing = editing
        ? {
            ...state,
            workouts: [
              ...state.workouts.filter((x) => x.id !== editing.id),
              editing,
            ],
          }
        : state;
      const raw = recovery
        ? (localStorage.getItem("fe-planner:v1") ?? "")
        : JSON.stringify(
            {
              format: "fe-workout-backup",
              version: 1,
              exportedAt: new Date().toISOString(),
              ...outgoing,
            },
            null,
            2,
          );
      if (!recovery) parseBackup(raw);
      const url = URL.createObjectURL(
        new Blob([raw], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = recovery ? "fe-recovery.json" : "fe-workouts-v1.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(
        recovery
          ? "Recovery data downloaded."
          : "Backup downloaded" +
              (editing ? " (includes the open draft)." : "."),
      );
    } catch {
      setNotice(
        "Could not export. Check the draft for a blank title or invalid counts, and try again.",
      );
    }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 5_000_000) {
      setNotice("Choose a backup smaller than 5 MB.");
      return;
    }
    try {
      setPending(parseBackup(await file.text()));
    } catch {
      setNotice(
        "Import rejected. Use a valid FE backup version 1 (personal drafts only, up to 200 workouts). Nothing was changed.",
      );
    }
  };
  const applyImport = () => {
    if (!pending) return;
    const merged = mergeBackup(
      state.workouts,
      pending.workouts,
      sources.map((w) => w.id),
    );
    if (merged.workouts.length > 200) {
      setNotice("Import would exceed 200 drafts. Nothing changed.");
      return;
    }
    if (
      persist({
        workouts: merged.workouts,
        favorites: [...new Set([...state.favorites, ...pending.favorites])],
      })
    ) {
      setNotice(
        `Imported ${pending.workouts.length} workouts. ${merged.conflicts} conflicts kept as new copies.`,
      );
      setPending(null);
    }
  };
  const all = [...sources, ...state.workouts];
  const base =
    tab === "mine"
      ? state.workouts
      : tab === "favorites"
        ? all.filter((w) => state.favorites.includes(w.id))
        : sources;
  const visible = base.filter((w) => matches(w, filters));
  const update = (w: Workout) => {
    setEditing(w);
    setDirty(true);
  };
  return (
    <>
      <header className="header no-print">
        <button
          className="brand"
          onClick={() => go("library")}
          aria-label="The FE home"
        >
          <span className="mark">
            FE<span>↗</span>
          </span>
          <span>
            THE FE<span className="brand-sub">WORKOUT PLANNER</span>
          </span>
        </button>
        <span className="region">
          F3 THE FE <span> / </span> KANSAS CITY
        </span>
        <button
          className="create top-create"
          onClick={() => {
            if (leave()) begin(newWorkout());
          }}
        >
          <Plus size={18} /> Create a workout
        </button>
      </header>
      <div
        role="status"
        aria-live="polite"
        className={notice ? "notice no-print" : "sr-only"}
      >
        {notice && (
          <>
            <span>{notice}</span>
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </>
        )}
      </div>
      {blocked && (
        <aside className="storage-warning no-print">
          <button onClick={() => exportData(true)}>
            Download recovery data
          </button>
          <button
            onClick={() => {
              if (
                confirm(
                  "Allow new saves to replace the unreadable browser data? Keep your recovery download first.",
                )
              )
                setBlocked(false);
            }}
          >
            Unlock saving
          </button>
        </aside>
      )}
      {!selected && !editing ? (
        <main className="main">
          <section className="hero">
            <div>
              <p className="eyebrow">
                <span className="dot" /> BUILT FOR THE GLOOM
              </p>
              <h1>
                A good beatdown.
                <br />
                <em>A great place to start.</em>
              </h1>
              <p className="intro">
                Find a plan. Make it yours. Lead with confidence.
                <br />
                Your next Q starts right here.
              </p>
              <button
                className="create mobile-create"
                onClick={() => begin(newWorkout())}
              >
                <Plus size={18} /> Create a workout
              </button>
            </div>
            <aside className="hero-note">
              <span className="note-top">LESS PLANNING. MORE LEADING.</span>
              <div className="outline-mark">FE</div>
              <p>
                For the men who
                <br />
                show up for each other.
              </p>
              <span className="note-bottom">
                FREE TO USE. NO SIGN-UP. ALL IN. <ArrowUpRight size={18} />
              </span>
            </aside>
          </section>
          <nav className="tabs" aria-label="Workout collections">
            {[
              ["library", "Workout library", sources.length],
              ["mine", "My workouts", state.workouts.length],
              [
                "favorites",
                "Favorites",
                state.favorites.filter((id) => all.some((w) => w.id === id))
                  .length,
              ],
            ].map(([key, label, count]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => go(String(key))}
              >
                {label}
                <span>{count}</span>
              </button>
            ))}
          </nav>
          <section className="library-head">
            <div>
              <p className="eyebrow">
                {tab === "library" ? "THE STARTING LINE" : "YOUR CORNER"}
              </p>
              <h2>
                {tab === "library"
                  ? "Find your next workout"
                  : tab === "mine"
                    ? "Made yours. Ready to lead."
                    : "Keep the good ones close."}
              </h2>
            </div>
            <p>
              {tab === "library"
                ? "Original templates. Endless ways to make them yours."
                : "Saved in this browser, on this device."}
            </p>
          </section>
          <section className="filters" aria-label="Filter workouts">
            <label className="search">
              <Search size={18} />
              <input
                aria-label="Search workouts"
                placeholder="Search workouts…"
                value={filters.query}
                onChange={(e) =>
                  setFilters({ ...filters, query: e.target.value })
                }
              />
            </label>
            <SlidersHorizontal size={18} className="filter-icon" />
            {(
              [
                ["duration", "Duration", ["All", "30 or less", "31–45", "46+"]],
                ["equipment", "Equipment", ["All", "None", "Coupon"]],
                ["running", "Running", ["All", "None", "Light", "Moderate"]],
                ["format", "Format", ["All", ...formatOptions]],
              ] as [keyof Filters, string, string[]][]
            ).map(([key, label, options]) => (
              <label className="filter" key={key}>
                <span>{label}</span>
                <select
                  aria-label={label}
                  value={filters[key]}
                  onChange={(e) =>
                    setFilters({ ...filters, [key]: e.target.value })
                  }
                >
                  {options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
            ))}
          </section>
          <div className="result-line">
            <span>
              {visible.length} {visible.length === 1 ? "workout" : "workouts"}{" "}
              <span className="muted">
                · a starting point, not a prescription
              </span>
            </span>
            <button
              className="text-button"
              onClick={() => setFilters({ ...filtersEmpty })}
            >
              Reset filters
            </button>
          </div>
          <div className="cards">
            {visible.map((w, i) => (
              <article className="card" key={w.id}>
                <div className="card-top">
                  <span className="chip">{w.format}</span>
                  <button
                    className={
                      "heart " +
                      (state.favorites.includes(w.id) ? "hearted" : "")
                    }
                    aria-label={
                      (state.favorites.includes(w.id)
                        ? "Unfavorite "
                        : "Favorite ") + w.title
                    }
                    aria-pressed={state.favorites.includes(w.id)}
                    onClick={() => favorite(w.id)}
                  >
                    <Heart size={20} />
                  </button>
                </div>
                <span className="card-number">
                  {String(i + 1).padStart(2, "0")} /{" "}
                  {w.kind === "source" ? "STARTER SERIES" : "PERSONAL DRAFT"}
                </span>
                <h3>
                  <button onClick={() => open(w)}>{w.title}</button>
                </h3>
                <p className="card-summary">
                  {w.summary || "Your plan, your way."}
                </p>
                <div className="card-metrics">
                  <span>
                    <Clock3 />
                    {w.duration ? `~${w.duration} min` : "Time not set"}
                  </span>
                  <span>
                    <Dumbbell />
                    {w.equipment.join(", ") || "No gear"}
                  </span>
                  <span>
                    <Footprints />
                    {w.running === "None"
                      ? "No running"
                      : w.running + " running"}
                  </span>
                </div>
                <button className="card-open" onClick={() => open(w)}>
                  View workout <ArrowUpRight size={20} />
                </button>
              </article>
            ))}
          </div>
          {!visible.length && (
            <section className="empty">
              <Layers3 size={34} />
              <h3>
                {base.length
                  ? "No workouts match those filters."
                  : "A little room for your next idea."}
              </h3>
              <p>
                {base.length
                  ? "Try a different format or clear your filters."
                  : "Copy a library workout, create a plan, or import your drafts."}
              </p>
              <button onClick={() => setFilters({ ...filtersEmpty })}>
                Reset filters
              </button>
            </section>
          )}
          <section className="backup">
            <div>
              <h3>Your plans travel with you.</h3>
              <p>
                Browser storage is device-specific and can be cleared. Export a
                backup to keep your drafts and favorites.
              </p>
            </div>
            <div className="actions">
              <button onClick={() => exportData()}>
                <Download size={17} />
                Export backup
              </button>
              <label className="button">
                <Upload size={17} />
                Import backup
                <input
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={(e) => {
                    void importFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </section>
        </main>
      ) : editing ? (
        <main className="editor main">
          <div className="page-top">
            <button onClick={() => go("mine")}>
              <ArrowLeft size={17} /> My workouts
            </button>
            <span>{dirty ? "Unsaved changes" : "Personal draft"}</span>
            <button className="create" onClick={save}>
              <Check size={17} />
              Save workout
            </button>
          </div>
          <p className="eyebrow">MAKE IT YOURS</p>
          <h1 className="page-title">Build your beatdown.</h1>
          <p className="muted">
            Save explicitly when you’re ready. Source workouts stay untouched.
          </p>
          <label>
            Workout title
            <input
              value={editing.title}
              maxLength={160}
              onChange={(e) => update({ ...editing, title: e.target.value })}
            />
          </label>
          <label>
            Short description
            <textarea
              value={editing.summary}
              onChange={(e) => update({ ...editing, summary: e.target.value })}
            />
          </label>
          <div className="editor-grid">
            <label>
              Session estimate (minutes, optional)
              <input
                type="number"
                min="1"
                max="300"
                value={editing.duration ?? ""}
                onChange={(e) =>
                  update({
                    ...editing,
                    duration:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Equipment (comma separated)
              <input
                value={editing.equipment.join(", ")}
                onChange={(e) =>
                  update({
                    ...editing,
                    equipment: e.target.value.split(",").map((x) => x.trim()),
                  })
                }
                onBlur={() =>
                  update({
                    ...editing,
                    equipment: editing.equipment.filter(Boolean),
                  })
                }
              />
            </label>
            <label>
              Running
              <select
                value={editing.running}
                onChange={(e) =>
                  update({
                    ...editing,
                    running: e.target.value as Workout["running"],
                  })
                }
              >
                {["None", "Light", "Moderate"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <label>
              Format
              <select
                value={editing.format}
                onChange={(e) =>
                  update({
                    ...editing,
                    format: e.target.value as Workout["format"],
                  })
                }
              >
                {formatOptions.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Original pasted notes · preserved as entered
            <textarea
              rows={6}
              value={editing.rawNotes}
              onChange={(e) => update({ ...editing, rawNotes: e.target.value })}
              placeholder="Paste your plan here. It stays as raw text; nothing is automatically interpreted."
            />
          </label>
          <p className="hint">
            Notes are included in Q view and full print. Use the sections below
            to organize them manually.
          </p>
          {editing.sections.map((s, si) => (
            <section className="edit-section" key={s.id}>
              <div className="section-heading">
                <h2>
                  {s.kind === "thang"
                    ? "The Thang"
                    : s.kind === "mary"
                      ? "Mary"
                      : "Warmup"}
                </h2>
                {s.kind !== "thang" && (
                  <button
                    onClick={() =>
                      update({
                        ...editing,
                        sections: editing.sections.filter((x) => x.id !== s.id),
                      })
                    }
                  >
                    Remove section
                  </button>
                )}
              </div>
              <label>
                Section title
                <input
                  value={s.title}
                  onChange={(e) =>
                    update({
                      ...editing,
                      sections: editing.sections.map((x, i) =>
                        i === si ? { ...s, title: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              {s.blocks.map((b, bi) => {
                const changeBlock = (next: typeof b) =>
                  update({
                    ...editing,
                    sections: editing.sections.map((x, i) =>
                      i === si
                        ? {
                            ...s,
                            blocks: s.blocks.map((y, j) =>
                              j === bi ? next : y,
                            ),
                          }
                        : x,
                    ),
                  });
                return (
                  <div className="edit-block" key={b.id}>
                    <div className="editor-grid">
                      <label>
                        Block title
                        <input
                          value={b.title}
                          onChange={(e) =>
                            changeBlock({ ...b, title: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Estimated minutes · blank = unknown
                        <input
                          type="number"
                          min="0"
                          max="300"
                          value={b.minutes ?? ""}
                          onChange={(e) =>
                            changeBlock({
                              ...b,
                              minutes:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Instructions, rest & transitions
                      <textarea
                        rows={4}
                        value={b.instructions}
                        onChange={(e) =>
                          changeBlock({ ...b, instructions: e.target.value })
                        }
                      />
                    </label>
                    {b.exercises.map((x, xi) => {
                      const change = (next: Exercise) =>
                        changeBlock({
                          ...b,
                          exercises: b.exercises.map((y, j) =>
                            j === xi ? next : y,
                          ),
                        });
                      return (
                        <fieldset key={x.id}>
                          <legend>Exercise {xi + 1}</legend>
                          <label>
                            Exercise name
                            <input
                              value={x.name}
                              onChange={(e) =>
                                change({ ...x, name: e.target.value })
                              }
                            />
                          </label>
                          <div className="exercise-grid">
                            <label>
                              Count / amount
                              <input
                                value={x.amount}
                                onChange={(e) =>
                                  change({ ...x, amount: e.target.value })
                                }
                              />
                            </label>
                            <label>
                              Unit
                              <select
                                value={x.unit}
                                onChange={(e) =>
                                  change({
                                    ...x,
                                    unit: e.target.value as Exercise["unit"],
                                  })
                                }
                              >
                                {[
                                  "reps",
                                  "seconds",
                                  "minutes",
                                  "meters",
                                  "rounds",
                                  "instructions",
                                ].map((v) => (
                                  <option key={v}>{v}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Counting
                              <select
                                value={x.counting}
                                onChange={(e) =>
                                  change({
                                    ...x,
                                    counting: e.target
                                      .value as Exercise["counting"],
                                  })
                                }
                              >
                                {[
                                  "total",
                                  "1=1",
                                  "2=1",
                                  "per side",
                                  "cadence",
                                  "time",
                                  "distance",
                                  "not applicable",
                                ].map((v) => (
                                  <option key={v}>{v}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Sets (optional)
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={x.sets ?? ""}
                                onChange={(e) =>
                                  change({
                                    ...x,
                                    sets:
                                      e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value),
                                  })
                                }
                              />
                            </label>
                          </div>
                          <label>
                            Plain instructions
                            <input
                              value={x.instructions}
                              onChange={(e) =>
                                change({ ...x, instructions: e.target.value })
                              }
                            />
                          </label>
                          <div className="actions">
                            <button
                              disabled={xi === 0}
                              onClick={() => {
                                const a = [...b.exercises];
                                [a[xi - 1], a[xi]] = [a[xi], a[xi - 1]];
                                changeBlock({ ...b, exercises: a });
                              }}
                            >
                              Move up
                            </button>
                            <button
                              onClick={() =>
                                changeBlock({
                                  ...b,
                                  exercises: b.exercises.filter(
                                    (y) => y.id !== x.id,
                                  ),
                                })
                              }
                            >
                              Remove exercise
                            </button>
                          </div>
                        </fieldset>
                      );
                    })}
                    <div className="actions">
                      <button
                        onClick={() =>
                          changeBlock({
                            ...b,
                            exercises: [...b.exercises, newExercise()],
                          })
                        }
                      >
                        <Plus size={16} />
                        Add exercise
                      </button>
                      <button
                        disabled={bi === 0}
                        onClick={() => {
                          const a = [...s.blocks];
                          [a[bi - 1], a[bi]] = [a[bi], a[bi - 1]];
                          update({
                            ...editing,
                            sections: editing.sections.map((x) =>
                              x.id === s.id ? { ...s, blocks: a } : x,
                            ),
                          });
                        }}
                      >
                        Move block up
                      </button>
                      {s.blocks.length > 1 && (
                        <button
                          onClick={() =>
                            update({
                              ...editing,
                              sections: editing.sections.map((x) =>
                                x.id === s.id
                                  ? {
                                      ...s,
                                      blocks: s.blocks.filter(
                                        (y) => y.id !== b.id,
                                      ),
                                    }
                                  : x,
                              ),
                            })
                          }
                        >
                          Remove block
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() =>
                  update({
                    ...editing,
                    sections: editing.sections.map((x) =>
                      x.id === s.id
                        ? {
                            ...s,
                            blocks: [
                              ...s.blocks,
                              {
                                id: uid(),
                                title: "Next block",
                                instructions: "",
                                minutes: null,
                                exercises: [],
                              },
                            ],
                          }
                        : x,
                    ),
                  })
                }
              >
                <Plus size={16} />
                Add block
              </button>
            </section>
          ))}
          <div className="actions">
            {(["warmup", "mary"] as Section["kind"][])
              .filter((k) => !editing.sections.some((s) => s.kind === k))
              .map((k) => (
                <button
                  key={k}
                  onClick={() =>
                    update({
                      ...editing,
                      sections: [...editing.sections, newSection(k)].sort(
                        (a, b) =>
                          ["warmup", "thang", "mary"].indexOf(a.kind) -
                          ["warmup", "thang", "mary"].indexOf(b.kind),
                      ),
                    })
                  }
                >
                  Add {k === "mary" ? "Mary" : "Warmup"}
                </button>
              ))}
          </div>
          <label>
            Adaptation notes
            <textarea
              value={editing.adaptationNotes}
              onChange={(e) =>
                update({ ...editing, adaptationNotes: e.target.value })
              }
            />
          </label>
          <div className="sticky-save actions">
            <button className="create" onClick={save}>
              Save workout
            </button>
            <button onClick={() => exportData()}>
              <Download size={17} />
              Export including open draft
            </button>
          </div>
        </main>
      ) : selected ? (
        <main
          className={
            "main detail " +
            (q ? "q-mode " : "") +
            (thangOnly ? "thang-only" : "")
          }
        >
          <div className="page-top no-print">
            <button onClick={() => go(tab)}>
              <ArrowLeft size={17} />
              Back to workouts
            </button>
            <button onClick={() => setQ(!q)}>
              <Maximize2 size={17} />
              {q ? "Exit Q view" : "Q view"}
            </button>
          </div>
          <p className="eyebrow">
            {selected.format} /{" "}
            {selected.kind === "source" ? "STARTER SERIES" : "MY WORKOUT"}
          </p>
          <h1 className="page-title">{selected.title}</h1>
          <p className="detail-summary">{selected.summary}</p>
          <div className="detail-meta">
            <span>~{selected.duration ?? "?"} minute session</span>
            <span>{selected.equipment.join(", ") || "No equipment"}</span>
            <span>{selected.running} running</span>
          </div>
          <div className="actions no-print detail-actions">
            <button
              className="create"
              onClick={() => {
                if (state.workouts.length >= 200) {
                  setNotice(
                    "This browser has 200 drafts. Export a backup before adding more.",
                  );
                  return;
                }
                const copied = copyWorkout(selected);
                if (
                  persist({ ...state, workouts: [...state.workouts, copied] })
                ) {
                  begin(copied);
                  setNotice("Personal copy created. Your source is unchanged.");
                }
              }}
            >
              <Copy size={17} />
              Copy to my workouts
            </button>
            {selected.kind === "personal" && (
              <button onClick={() => begin(selected)}>Edit workout</button>
            )}
            <button
              aria-pressed={state.favorites.includes(selected.id)}
              onClick={() => favorite(selected.id)}
            >
              <Heart size={17} />
              {state.favorites.includes(selected.id) ? "Favorited" : "Favorite"}
            </button>
            <button onClick={() => window.print()}>
              <Printer size={17} />
              Print
            </button>
            <label className="check">
              <input
                type="checkbox"
                checked={thangOnly}
                onChange={(e) => setThangOnly(e.target.checked)}
              />
              Print only The Thang
            </label>
          </div>
          <p className="timing-note">
            Section estimates:{" "}
            {timing(selected) === null
              ? "timing not fully set"
              : `~${timing(selected)} minutes total`}
            . Include explanation, rest, and transitions. Adjust to the PAX and
            conditions; estimates are not a safety guarantee.
          </p>
          {selected.sections.map((s, i) => (
            <section className={"workout-section section-" + s.kind} key={s.id}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">0{i + 1}</span>
                  <h2>{s.title}</h2>
                </div>
                <span className="section-time">
                  <Clock3 size={16} />
                  {s.blocks.some((b) => b.minutes === null)
                    ? "Time not set"
                    : `~${s.blocks.reduce((n, b) => n + (b.minutes ?? 0), 0)} min`}
                </span>
              </div>
              {s.blocks.map((b) => (
                <div className="workout-block" key={b.id}>
                  <h3>{b.title}</h3>
                  <p className="instructions">{b.instructions}</p>
                  {b.exercises.map((x) => (
                    <div className="exercise" key={x.id}>
                      <div className="exercise-count">
                        {x.sets && `${x.sets} × `}
                        {x.amount}
                        <small>{x.unit}</small>
                      </div>
                      <div>
                        <h4>{x.name}</h4>
                        <p>{x.instructions}</p>
                        <span className="count-label">
                          Counting: {x.counting}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))}
          {!selected.sections.some((s) => s.kind === "mary") && (
            <p className="optional-mary">Mary omitted in this plan.</p>
          )}
          {selected.rawNotes && (
            <section className="raw-notes">
              <h2>Original notes</h2>
              <p>{selected.rawNotes}</p>
            </section>
          )}
          <section className="provenance">
            <h3>Plan notes & source</h3>
            <p>{selected.adaptationNotes}</p>
            <p>{selected.provenance.label}</p>
            <p>
              Status: {selected.provenance.status}
              {selected.originId ? ` · Copied from ${selected.originId}` : ""}
            </p>
            {selected.provenance.url && (
              <a href={selected.provenance.url}>View source</a>
            )}
            <p>
              Counting guide: 1=1 means each movement counts once. 2=1 means two
              movements count as one. Per side means the listed count on each
              side. Cadence must be described in the exercise instructions.
            </p>
          </section>
        </main>
      ) : null}
      <footer className="footer no-print">
        <span className="footer-brand">
          THE FE <span>/</span> SHOW UP. STEP UP.
        </span>
        <span>A little preparation goes a long way.</span>
        <a href="https://f3nation.com/exicon" target="_blank" rel="noreferrer">
          F3 Exicon <ArrowUpRight size={14} />
        </a>
      </footer>
      {pending && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
            tabIndex={-1}
            ref={(el) => {
              el?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setPending(null);
              if (e.key === "Tab") {
                const buttons = e.currentTarget.querySelectorAll("button");
                const first = buttons[0],
                  last = buttons[buttons.length - 1];
                if (
                  e.shiftKey &&
                  (document.activeElement === first ||
                    document.activeElement === e.currentTarget)
                ) {
                  e.preventDefault();
                  last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <h2 id="import-title">Bring in your plans?</h2>
            <p>
              {pending.workouts.length} drafts and {pending.favorites.length}{" "}
              favorites in this backup.
            </p>
            <p>
              Existing plans stay. Matching IDs become new copies named
              “imported copy.” Favorites are combined. Nothing is silently
              overwritten.
            </p>
            <div className="actions">
              <button className="create" onClick={applyImport}>
                Import as copies where needed
              </button>
              <button onClick={() => setPending(null)}>Cancel</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
