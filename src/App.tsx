import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  ArrowLeft,
  Heart,
  Plus,
  Clock3,
  Copy,
  Printer,
  Maximize2,
  Download,
  Upload,
  X,
  Check,
} from "lucide-react";
import { readRoute, writeRoute, routeHash } from "./navigation";
import { AccountPanel, AccountEntry } from "./AccountPanel";
import { useAccount } from "./AccountContext";
import { accountStorageKey } from "./auth";
import { AppNavigation } from "./AppNavigation";
import { importStudio } from "./studio/import";
import { CloudSync } from "./CloudSync";
import { FieldTimer } from "./FieldTimer";
import { OfflineStatus } from "./OfflineStatus";
import { StagingNotice } from "./StagingNotice";
import { MarkdownImport } from "./MarkdownImport";
import {
  SessionTimeline,
  sessionStart,
  clockLabel,
  sessionMatches,
  DISCLAIMER,
  qSheet,
} from "./session";
import { ExiconBrowser } from "./ExiconBrowser";
import { Planner } from "./Planner";
import { Discovery } from "./Discovery";
import { statusLabel } from "./discovery";
import { WorkoutLibrary, type LibraryPreferences } from "./WorkoutLibrary";
import { MovementPicker } from "./MovementPicker";
import { catalog } from "./catalog";
import { SupabaseCatalog } from "./repository";
import {
  STORAGE_KEY as GUEST_STORAGE_KEY,
  type Workout,
  type Section,
  type LocalState,
  type Exercise,
  filtersEmpty,
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
  titledCopy,
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
function EquipmentInput({
  workout,
  onChange,
}: {
  workout: Workout;
  onChange: (equipment: string[]) => void;
}) {
  const [text, setText] = useState(workout.equipment.join(", "));
  return (
    <label>
      Equipment (comma separated)
      <input
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          onChange([
            ...new Set(
              value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            ),
          ]);
        }}
      />
    </label>
  );
}
function TimingSummary({ workout }: { workout: Workout }) {
  const blocks = workout.sections.flatMap((section) => section.blocks);
  const unknown = blocks.filter((block) => block.minutes === null).length;
  const known = blocks.reduce(
    (total, block) => total + (block.minutes ?? 0),
    0,
  );
  const difference =
    workout.duration === null || unknown ? null : workout.duration - known;
  return (
    <aside className="timing-note" aria-label="Plan timing">
      <strong>
        Estimated block time: ~{known} minutes
        {unknown
          ? ` + ${unknown} untimed ${unknown === 1 ? "block" : "blocks"}`
          : ""}
        .
      </strong>
      <p>
        {difference === null
          ? "Set block times when you know them; blank times stay unknown."
          : difference > 0
            ? `About ${difference} minutes remain in your session estimate. Allow for explanation, rest, and transitions.`
            : difference < 0
              ? `Blocks run about ${-difference} minutes beyond your session estimate. Adjust the plan or session estimate.`
              : "Block times match your session estimate. Include explanation, rest, and transitions in those times."}{" "}
        All times are estimates; adjust to the PAX and conditions.
      </p>
    </aside>
  );
}
function load(key = GUEST_STORAGE_KEY) {
  try {
    return {
      data: readState(localStorage, key),
      raw: localStorage.getItem(key),
      error: "",
    };
  } catch {
    return {
      data: { workouts: [], favorites: [] } as LocalState,
      raw: null,
      error:
        "Saved browser data could not be read. It has not been changed. Export recovery data before saving new work.",
    };
  }
}
export default function App() {
  const account = useAccount();
  const STORAGE_KEY = accountStorageKey(account?.user?.id);
  const [sources, setSources] = useState(catalog);
  const [catalogOrigin, setCatalogOrigin] = useState("snapshot");
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL,
      key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url && !key) return;
    if (!url || !key) {
      setNotice(
        "Shared catalog is not fully configured. Showing the bundled catalog snapshot.",
      );
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    new SupabaseCatalog(url, key)
      .list(controller.signal)
      .then((rows) => {
        if (disposed) return;
        setSources(rows);
        setCatalogOrigin("published");
      })
      .catch(() => {
        if (!disposed)
          setNotice(
            "Shared catalog unavailable. Showing the bundled catalog snapshot.",
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);
  const [initial] = useState(() => load(STORAGE_KEY));
  const savedSnapshot = useRef(initial.raw);
  const [storageChanged, setStorageChanged] = useState(false);
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (
        event.storageArea === localStorage &&
        (event.key === STORAGE_KEY || event.key === null)
      ) {
        try {
          setStorageChanged(
            localStorage.getItem(STORAGE_KEY) !== savedSnapshot.current,
          );
        } catch {
          setStorageChanged(true);
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  const [state, setState] = useState(initial.data),
    [notice, setNotice] = useState(initial.error),
    [blocked, setBlocked] = useState(!!initial.error),
    [tab, setTab] = useState(() => readRoute().tab),
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
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const [timerOpen, setTimerOpen] = useState(false);
  const unresolvedRoute = useRef<string | null>(null);
  const navigation = useRef({
    dirty,
    state,
    sources,
    tab,
    selected,
    editing,
    timerOpen,
  });
  navigation.current = {
    dirty,
    state,
    sources,
    tab,
    selected,
    editing,
    timerOpen,
  };
  useEffect(() => {
    const restore = (initial = false) => {
      const current = navigation.current;
      if (
        !initial &&
        current.dirty &&
        !confirm("Leave without saving these changes?")
      ) {
        const hash = routeHash(
          current.editing
            ? { tab: current.tab, view: "edit", id: current.editing.id }
            : { tab: current.tab },
        );
        history.pushState({}, "", hash);
        return;
      }
      const route = readRoute();
      const workout = [...current.state.workouts, ...current.sources].find(
        (value) => value.id === route.id,
      );
      setTab(route.tab);
      setQ(false);
      setDirty(false);
      setEditing(null);
      setSelected(null);
      setTimerOpen(false);
      if (route.view && workout) {
        unresolvedRoute.current = null;
        if (route.view === "edit") {
          setEditing(structuredClone(workout));
          editingBase.current = structuredClone(workout);
        } else {
          setSelected(workout);
          setTimerOpen(route.view === "lead");
        }
      } else if (route.view) {
        unresolvedRoute.current = routeHash(route);
        setNotice(
          "That workout is not saved on this device. Your saved plans are still here.",
        );
        setTab("mine");
      }
    };
    restore(true);
    const pop = () => restore();
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (!unresolvedRoute.current || unresolvedRoute.current !== location.hash)
      return;
    const route = readRoute();
    const workout = [...state.workouts, ...sources].find(
      (value) => value.id === route.id,
    );
    if (!workout) return;
    unresolvedRoute.current = null;
    setNotice("");
    setTab(route.tab);
    if (route.view === "edit") {
      setEditing(structuredClone(workout));
      editingBase.current = structuredClone(workout);
    } else {
      setSelected(workout);
      setTimerOpen(route.view === "lead");
    }
  }, [state.workouts, sources]);
  useEffect(() => {
    account?.setBlocked(dirty || blocked || storageChanged);
    return () => account?.setBlocked(false);
  }, [dirty, blocked, storageChanged, account?.setBlocked]);
  const [libraryPreferences, setLibraryPreferences] =
    useState<LibraryPreferences>({ favoritesOnly: false, sort: "recommended" });
  const persist = (next: LocalState) => {
    if (blocked) {
      setNotice(
        "Existing data is unreadable. Download recovery data first, then explicitly unlock saving.",
      );
      return false;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) !== savedSnapshot.current) {
        setStorageChanged(true);
        setNotice(
          "Saved workouts changed in another tab. Load the latest saved workouts before saving. Your open edits are still here.",
        );
        return false;
      }
      writeState(next, localStorage, STORAGE_KEY);
      savedSnapshot.current = localStorage.getItem(STORAGE_KEY);
      setState(next);
      return true;
    } catch {
      setNotice(
        "Could not save to this browser. Your open changes are still here. Export a backup before leaving, or free storage and retry.",
      );
      return false;
    }
  };
  const loadLatest = () => {
    try {
      const latest = readState(localStorage, STORAGE_KEY);
      const raw = localStorage.getItem(STORAGE_KEY);
      setState(latest);
      savedSnapshot.current = raw;
      setStorageChanged(false);
      setSelected(null);
      setPending(null);
      if (editing) {
        editingBase.current = null;
        setEditing({
          ...structuredClone(editing),
          id: uid(),
          title: titledCopy(editing.title, " · recovered copy"),
        });
        setDirty(true);
      }
      setNotice(
        editing
          ? "Latest saved workouts loaded. Your open edits are a separate, unsaved recovered copy. Save it when ready."
          : "Latest saved workouts loaded.",
      );
    } catch {
      setNotice(
        "The latest browser data could not be read. Nothing was replaced. Export your open edits before reloading.",
      );
    }
  };
  const leave = () =>
    !dirty || window.confirm("Leave without saving these changes?");
  const go = (next: string) => {
    if (!leave()) return false;
    setTimerOpen(false);
    setEditing(null);
    setDirty(false);
    setSelected(null);
    setQ(false);
    setTab(next);
    writeRoute({ tab: next });
    return true;
  };
  const open = (w: Workout) => {
    writeRoute({ tab, view: "workout", id: w.id });
    setSelected(w);
    setTimerOpen(false);
    setQ(false);
    window.scrollTo(0, 0);
  };
  const editingBase = useRef<Workout | null>(null);
  const begin = (
    w: Workout,
    saved = state.workouts.some((item) => item.id === w.id),
  ) => {
    writeRoute({ tab: "mine", view: "edit", id: w.id });
    editingBase.current = saved ? structuredClone(w) : null;
    setEditing(structuredClone(w));
    setSelected(null);
    setDirty(!saved);
    window.scrollTo(0, 0);
  };
  const useWorkout = (workout: Workout) => {
    if (!leave()) return;
    if (state.workouts.length >= 200) {
      setNotice(
        "This browser has 200 drafts. Export a backup before adding more.",
      );
      return;
    }
    const copied = copyWorkout(workout);
    if (persist({ ...state, workouts: [...state.workouts, copied] })) {
      begin(copied, true);
      setNotice("Personal copy created. Your source is unchanged.");
    }
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
      setNotice(has ? "Removed from favorites." : "Saved to favorites.");
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
    const existing = state.workouts.find((item) => item.id === editing.id);
    const conflict =
      editingBase.current &&
      (!existing ||
        JSON.stringify(workoutSchema.parse(existing)) !==
          JSON.stringify(workoutSchema.parse(editingBase.current)));
    if (conflict && state.workouts.length >= 200) {
      setNotice(
        "A conflict copy would exceed 200 plans. Export a backup and free space; your edits are still here.",
      );
      return;
    }
    const w = {
      ...result.data,
      ...(conflict
        ? {
            id: uid(),
            title: titledCopy(result.data.title, " · conflict copy"),
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    const next = {
      ...state,
      workouts: [...state.workouts.filter((x) => x.id !== w.id), w],
    };
    if (persist(next)) {
      setDirty(false);
      setEditing(w);
      editingBase.current = structuredClone(w);
      setNotice(
        conflict
          ? "Both versions kept. Your edits are a separate conflict copy."
          : "Workout saved.",
      );
      return w;
    }
  };
  const saveAndView = () => {
    const saved = save();
    if (!saved) return;
    setEditing(null);
    setTab("mine");
    open(saved);
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
        ? (localStorage.getItem(STORAGE_KEY) ?? "")
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
  const downloadNotes = () => {
    if (!editing?.rawNotes) return;
    try {
      const url = URL.createObjectURL(
        new Blob([editing.rawNotes], { type: "text/plain;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "fe-original-notes.txt";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Original notes downloaded exactly as entered.");
    } catch {
      setNotice(
        "Could not download notes. Your text is still here; select and copy it before leaving.",
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
      const raw = await file.text();
      let converted;
      try {
        converted = parseBackup(raw);
      } catch {
        const value: unknown = JSON.parse(raw);
        if (!Array.isArray(value) || value.length > 200)
          throw Error("Invalid Studio backup");
        converted = parseBackup(
          JSON.stringify({
            format: "fe-workout-backup",
            version: 1,
            exportedAt: new Date().toISOString(),
            workouts: value.map(importStudio),
            favorites: [],
          }),
        );
      }
      setPending(converted);
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
  const update = (w: Workout) => {
    setEditing(w);
    setDirty(true);
  };
  return (
    <>
      <a
        className="skip-link no-print"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to workouts
      </a>
      <StagingNotice />

      {!timerOpen && (
        <AppNavigation
          active={tab}
          onNavigate={go}
          accountEntry={(onOpen) => <AccountEntry onOpen={onOpen} />}
        />
      )}
      {!timerOpen && tab === "data" && !selected && !editing && (
        <AccountPanel
          onImportGuest={() => {
            try {
              const incoming = readState().workouts.filter(
                (workout) =>
                  !state.workouts.some(
                    (existing) =>
                      JSON.stringify(workoutSchema.parse(existing)) ===
                      JSON.stringify(workoutSchema.parse(workout)),
                  ),
              );
              const merged = mergeBackup(
                state.workouts,
                incoming,
                sources.map((workout) => workout.id),
              );
              if (merged.workouts.length > 200)
                throw Error(
                  "Adding guest workouts would exceed 200 plans. Export a backup and free space first.",
                );
              return persist({ ...state, workouts: merged.workouts });
            } catch (error) {
              setNotice(
                error instanceof Error
                  ? error.message
                  : "Guest workouts could not be read. Their original copy is unchanged.",
              );
              return false;
            }
          }}
        />
      )}
      <CloudSync
        compact={tab !== "data" || !!selected || !!editing}
        hidden={timerOpen}
        blocked={blocked || storageChanged || dirty}
        onSettings={() => go("data")}
        workouts={state.workouts}
        onMerge={(workouts) => persist({ ...state, workouts })}
        onStudio={(workouts) => {
          const existing = new Set(state.workouts.map((w) => w.originId));
          const fresh = workouts.filter((w) => !existing.has(w.originId));
          if (state.workouts.length + fresh.length > 200) {
            setNotice(
              "Import would exceed 200 plans. Export a backup and free space first.",
            );
            return false;
          }
          return persist({
            ...state,
            workouts: [...state.workouts, ...fresh],
          });
        }}
      />

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
      {storageChanged && (
        <aside
          className="storage-warning no-print"
          aria-label="Saved workouts changed"
        >
          <p>
            Another tab changed saved workouts. Load the latest to continue
            saving. Any open edits will become a separate recovered copy.
          </p>
          <button onClick={loadLatest}>Load latest saved workouts</button>
          <button onClick={() => exportData()}>Export current work</button>
        </aside>
      )}
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
              ) {
                try {
                  savedSnapshot.current = localStorage.getItem(STORAGE_KEY);
                  setBlocked(false);
                } catch {
                  setNotice(
                    "Browser storage is unavailable. Export current work to keep it.",
                  );
                }
              }
            }}
          >
            Unlock saving
          </button>
        </aside>
      )}
      {timerOpen && selected ? (
        <FieldTimer
          key={selected.id}
          workout={selected}
          onExit={() => {
            setTimerOpen(false);
            writeRoute({ tab, view: "workout", id: selected.id }, true);
          }}
        />
      ) : !selected && !editing ? (
        <main id="main" tabIndex={-1} className="main">
          {tab === "builder" && (
            <Planner
              onImport={() => go("markdown")}
              onLead={(w) => {
                open(w);
                setNotice("");
                setTimerOpen(true);
                writeRoute({ tab: "mine", view: "lead", id: w.id });
              }}
              onEdit={(w) => begin(w)}
              onPreview={(w) => {
                setThangOnly(false);
                open(w);
              }}
              onSave={(w) => {
                if (state.workouts.length >= 200) {
                  setNotice(
                    "This browser has 200 drafts. Export a backup before adding more.",
                  );
                  return false;
                }
                const copy = {
                  ...structuredClone(w),
                  id: uid(),
                  originId: w.id,
                };
                if (
                  persist({ ...state, workouts: [...state.workouts, copy] })
                ) {
                  setNotice("Personal workout saved.");
                  return true;
                }
                return false;
              }}
              onReference={(id) => {
                const w = sources.find((w) => w.id === id);
                if (w) open(w);
                else
                  setNotice(
                    "That reference is not available in the current library snapshot.",
                  );
              }}
            />
          )}
          {tab === "markdown" && (
            <MarkdownImport onEdit={(w) => begin(w, false)} />
          )}
          {tab === "exicon" ? (
            <ExiconBrowser />
          ) : (
            tab !== "builder" && (
              <>
                {tab === "aos" || tab === "exercises" ? (
                  <Discovery
                    key={tab}
                    mode={tab}
                    onAO={(name) => {
                      setFilters({ ...filtersEmpty, ao: name });
                      go("library");
                    }}
                  />
                ) : tab === "data" || tab === "markdown" ? null : (
                  <WorkoutLibrary
                    key={tab}
                    sources={sources}
                    workouts={state.workouts}
                    favorites={state.favorites}
                    catalogOrigin={catalogOrigin}
                    personal={tab === "mine"}
                    filters={filters}
                    preferences={libraryPreferences}
                    onPreferences={setLibraryPreferences}
                    onFilters={setFilters}
                    onFavorite={favorite}
                    onOpen={open}
                    onUse={useWorkout}
                    onCreate={() => {
                      if (leave()) begin(newWorkout());
                    }}
                  />
                )}
                {tab === "data" && (
                  <section className="backup">
                    <div>
                      <h3>Backup & recovery</h3>
                      <p>
                        Export a copy of your saved workouts and favorites
                        whenever you want an extra backup.
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
                )}
              </>
            )
          )}
        </main>
      ) : editing ? (
        <main id="main" tabIndex={-1} className="editor main">
          <div className="page-top">
            <button onClick={() => go("mine")}>
              <ArrowLeft size={17} /> My workouts
            </button>
            <span className="editor-status">
              {dirty ? "Unsaved changes" : "Saved"}
            </span>
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
            <EquipmentInput
              key={editing.id}
              workout={editing}
              onChange={(equipment) => update({ ...editing, equipment })}
            />
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
            to organize them manually. The Thang-only print excludes original
            notes. Draft backups accept up to 20,000 characters of notes. Longer
            notes stay here; download the exact text before leaving.
          </p>
          <button onClick={downloadNotes} disabled={!editing.rawNotes}>
            <Download size={17} /> Download original notes
          </button>
          <TimingSummary workout={editing} />
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
                    <MovementPicker
                      disabled={b.exercises.length >= 100}
                      onAdd={(exercise) =>
                        changeBlock({
                          ...b,
                          exercises: [...b.exercises, exercise],
                        })
                      }
                    />
                    <div className="actions">
                      <button
                        disabled={b.exercises.length >= 100}
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
            <button onClick={saveAndView}>Save & view workout</button>
            <button onClick={() => exportData()}>
              <Download size={17} />
              Export including open draft
            </button>
          </div>
        </main>
      ) : selected ? (
        <main
          id="main"
          tabIndex={-1}
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
            {selected.kind === "source"
              ? statusLabel(selected.provenance.status).toUpperCase()
              : selected.provenance.generation
                ? "AI-ASSISTED DRAFT"
                : "MY WORKOUT"}
          </p>
          <h1 className="page-title">{selected.title}</h1>
          <p className="detail-summary">{selected.summary}</p>
          <div className="detail-meta">
            <span>
              {selected.duration === null
                ? "Session duration unknown"
                : `~${selected.duration} minute session`}
            </span>
            <span>
              {selected.equipment.join(", ") ||
                (selected.provenance.issues?.some((i) =>
                  i.startsWith("Equipment not"),
                )
                  ? "Equipment unknown"
                  : "No equipment")}
            </span>
            <span>
              {selected.provenance.issues?.some((i) =>
                i.startsWith("Running requirement"),
              )
                ? "Running unknown"
                : `${selected.running} running`}
            </span>
          </div>
          <div className="actions no-print detail-actions">
            <button className="create" onClick={() => useWorkout(selected)}>
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
          <button
            className="create no-print"
            onClick={() => {
              setNotice("");
              setTimerOpen(true);
              writeRoute({ tab, view: "lead", id: selected.id });
            }}
          >
            Lead workout
          </button>
          <SessionTimeline workout={selected} />
          {selected.schedule?.siteSummary && (
            <details className="site-context-note">
              <summary>Site details used for this plan</summary>
              <p className="source-text">{selected.schedule.siteSummary}</p>
            </details>
          )}
          <button
            className="no-print"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(qSheet(selected))
                .then(() => setNotice("Q sheet copied for Slack."))
                .catch(() =>
                  setNotice(
                    "Clipboard unavailable. Use Print to keep the plan.",
                  ),
                );
            }}
          >
            Copy Slack Q sheet
          </button>
          {sessionMatches(selected) && (
            <aside className="timing-note">
              <strong>
                Welcome & disclaimer · {clockLabel(0, sessionStart(selected))}–
                {clockLabel(120, sessionStart(selected))}
              </strong>
              <p>{DISCLAIMER}</p>
            </aside>
          )}
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
            <p className="optional-mary">
              {selected.provenance.issues?.includes(
                "Mary explicitly omitted in source",
              )
                ? "Mary omitted in source."
                : selected.provenance.sourceId
                  ? "Mary not supplied; see source notes."
                  : "Mary omitted in this plan."}
            </p>
          )}
          {sessionMatches(selected) && (
            <section className="workout-section section-cot">
              <h2>
                Fellowship & trust · after{" "}
                {clockLabel(2700, sessionStart(selected))}
              </h2>
              <p>
                Count-o-Rama · Name-o-Rama / FNG naming · Announcements · Ball
                of Man / closing. Allow 5–10 minutes after all physical work
                stops.
              </p>
            </section>
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
            {selected.provenance.generation && (
              <div>
                <p>
                  AO: {selected.provenance.ao ?? "To confirm"} · All timing is
                  estimated.
                </p>
                <p>
                  Workout references supplied:{" "}
                  {selected.provenance.generation.referenceSourceIds
                    .map((id) => sources.find((w) => w.id === id)?.title ?? id)
                    .join("; ")}
                </p>
              </div>
            )}
            {selected.provenance.sourceId && (
              <p>
                Q: {selected.provenance.q ?? "Unknown"} · AO:{" "}
                {selected.provenance.ao ?? "Unknown"} · Date:{" "}
                {selected.provenance.eventDate ?? "Unknown"}
                <br />
                Checked:{" "}
                {selected.provenance.checkedAt?.slice(0, 10) ?? "Unknown"} ·
                Duration: {selected.provenance.durationBasis ?? "unknown"}
              </p>
            )}
            {!!selected.provenance.issues?.length && (
              <ul>
                {selected.provenance.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
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
      {!timerOpen && (
        <footer className="footer no-print">
          <div className="footer-credits">
            <OfflineStatus />
            <span className="footer-brand">
              F3 THE FE <span>/</span> SHOW UP. STEP UP.
            </span>
            <span className="rug-burn-footer-credit">
              Created by <strong>Rug Burn</strong> · F3 The FE · Olathe, KS
            </span>
          </div>
          <div className="footer-links">
            <a href="https://f3thefe.com/" target="_blank" rel="noreferrer">
              The Region <ArrowUpRight size={14} />
            </a>
            <a
              href="https://f3thefe.com/schedule/"
              target="_blank"
              rel="noreferrer"
            >
              AO schedule <ArrowUpRight size={14} />
            </a>
            <a
              href="https://f3nation.com/exicon"
              target="_blank"
              rel="noreferrer"
            >
              F3 Exicon <ArrowUpRight size={14} />
            </a>
          </div>
        </footer>
      )}
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
