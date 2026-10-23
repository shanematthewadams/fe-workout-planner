import { AppIcon } from "./AppIcon";
import {
  ArrowUpRight,
  Clock3,
  Copy,
  Dumbbell,
  Footprints,
  Heart,
  Plus,
  Search,
} from "lucide-react";
import { aoProfiles, statusLabel } from "./discovery";
import { filtersEmpty, matches, type Filters, type Workout } from "./model";
export type LibraryPreferences = { favoritesOnly: boolean; sort: string };

export function WorkoutLibrary({
  sources,
  workouts,
  favorites,
  catalogOrigin,
  personal,
  filters,
  preferences,
  onPreferences,
  onFilters,
  onFavorite,
  onOpen,
  onUse,
  onCreate,
  onLead,
  onEdit,
}: {
  sources: Workout[];
  workouts: Workout[];
  favorites: string[];
  catalogOrigin: string;
  personal: boolean;
  filters: Filters;
  preferences: LibraryPreferences;
  onPreferences: (preferences: LibraryPreferences) => void;
  onFilters: (filters: Filters) => void;
  onFavorite: (id: string) => void;
  onOpen: (workout: Workout) => void;
  onUse: (workout: Workout) => void;
  onCreate: () => void;
  onLead?: (workout: Workout) => void;
  onEdit?: (workout: Workout) => void;
}) {
  const { favoritesOnly, sort } = preferences;
  const base = personal ? workouts : sources;
  const all = [...sources, ...workouts];
  const filterCount = Object.entries(filters).filter(
    ([key, value]) => key !== "query" && value !== "All",
  ).length;
  const reset = () => {
    onFilters({ ...filtersEmpty });
    onPreferences({ ...preferences, favoritesOnly: false });
  };
  const visible = base.filter(
    (w) => matches(w, filters) && (!favoritesOnly || favorites.includes(w.id)),
  );
  visible.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "duration")
      return (
        (a.duration ?? Infinity) - (b.duration ?? Infinity) ||
        a.title.localeCompare(b.title)
      );
    if (sort === "updated")
      return (
        b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title)
      );
    // Keep source order within each group. Unknown timing is never treated as short.
    return (
      Number(b.provenance.status === "regional-reviewed") -
      Number(a.provenance.status === "regional-reviewed")
    );
  });
  const options: [keyof Filters, string, string[]][] = [
    ["duration", "Duration", ["All", "30 or less", "31–45", "46+"]],
    [
      "equipment",
      "Equipment",
      [
        "All",
        "None",
        ...new Set(
          all
            .flatMap((w) => w.equipment)
            .filter(Boolean)
            .sort(),
        ),
      ],
    ],
    ["running", "Running", ["All", "None", "Light", "Moderate"]],
    [
      "format",
      "Format",
      [
        "All",
        "Circuit",
        "11s",
        "EMOM",
        "AMRAP",
        "Ladder",
        "Partner",
        "Stations",
        "Chipper",
        "Custom",
      ],
    ],
    [
      "status",
      "Source status",
      ["All", "regional-reviewed", "illustrative", "personal"],
    ],
    [
      "ao",
      "Source AO",
      [
        "All",
        ...new Set([
          ...aoProfiles.map((a) => a.name),
          ...all.flatMap((w) => (w.provenance.ao ? [w.provenance.ao] : [])),
        ]),
      ],
    ],
  ];
  return (
    <section
      className="workout-library"
      aria-label={personal ? "My workout library" : "Regional workout library"}
    >
      <div className="library-head">
        <div>
          <p className="eyebrow">
            {personal ? "YOUR PLAYBOOK" : "THE FE PLAYBOOK"}
          </p>
          <h2>{personal ? "My workouts" : "Find your next workout"}</h2>
          <p>
            {personal
              ? "Your saved drafts. Open one to edit, print, or lead."
              : "Start with an FE original or make a starter your own."}
          </p>
        </div>
        <button className="create" onClick={onCreate}>
          <Plus size={16} /> Create a workout
        </button>
      </div>
      {!personal && (
        <details className="catalog-status">
          <summary>
            {
              sources.filter((w) => w.provenance.status === "regional-reviewed")
                .length
            }{" "}
            reviewed FE workouts ·{" "}
            {
              sources.filter((w) => w.provenance.status === "illustrative")
                .length
            }{" "}
            illustrative starters
          </summary>
          <p>
            {catalogOrigin === "published"
              ? "Latest published library loaded."
              : "Saved library snapshot."}{" "}
            Backblasts may have timing or exercise gaps; check source notes
            before leading. Starters are illustrative examples.
          </p>
        </details>
      )}
      <div className="filters" aria-label="Filter workouts">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search workouts"
            placeholder="Workout, movement, AO, or Q…"
            value={filters.query}
            onChange={(e) => onFilters({ ...filters, query: e.target.value })}
          />
        </label>
        <details className="filter-details">
          <summary>
            Filter workouts{filterCount ? ` (${filterCount})` : ""}
          </summary>
          <div className="filter-options">
            {options.map(([key, label, values]) => (
              <label className="filter" key={key}>
                <span>{label}</span>
                <select
                  aria-label={label}
                  value={filters[key]}
                  onChange={(e) =>
                    onFilters({ ...filters, [key]: e.target.value })
                  }
                >
                  {values.map((value) => (
                    <option key={value} value={value}>
                      {key === "status" && value !== "All"
                        ? statusLabel(value)
                        : value}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </details>
      </div>
      <div className="library-controls">
        <div
          className="quick-filters"
          role="group"
          aria-label="Quick workout filters"
        >
          <button
            aria-pressed={filters.running === "None"}
            onClick={() =>
              onFilters({
                ...filters,
                running: filters.running === "None" ? "All" : "None",
              })
            }
          >
            <AppIcon name="running" />
            No running
          </button>
          <button
            aria-pressed={filters.equipment === "None"}
            onClick={() =>
              onFilters({
                ...filters,
                equipment: filters.equipment === "None" ? "All" : "None",
              })
            }
          >
            <AppIcon name="exicon" />
            No gear
          </button>
          <button
            aria-pressed={filters.duration === "30 or less"}
            onClick={() =>
              onFilters({
                ...filters,
                duration:
                  filters.duration === "30 or less" ? "All" : "30 or less",
              })
            }
          >
            30 min or less
          </button>
        </div>
        <label className="checkbox favorites-filter">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(e) =>
              onPreferences({ ...preferences, favoritesOnly: e.target.checked })
            }
          />{" "}
          Favorites only
        </label>
        <label className="library-sort">
          Sort workouts
          <select
            aria-label="Sort workouts"
            value={sort}
            onChange={(e) =>
              onPreferences({ ...preferences, sort: e.target.value })
            }
          >
            <option value="recommended">
              {personal ? "Saved order" : "FE originals first"}
            </option>
            <option value="title">Title A–Z</option>
            <option value="duration">Shortest first</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
      </div>
      <div className="result-line">
        <span aria-live="polite">
          {visible.length} {visible.length === 1 ? "workout" : "workouts"}
          {filters.query.trim() ? ` matching “${filters.query.trim()}”` : ""}
        </span>
        <button className="text-button" onClick={reset}>
          Reset filters
        </button>
      </div>
      <div className="cards workout-cards">
        {visible.map((w) => (
          <article className="card workout-card" key={w.id}>
            <div className="card-top">
              <span className="chip">{w.format}</span>
              <button
                className={
                  "heart " + (favorites.includes(w.id) ? "hearted" : "")
                }
                aria-label={
                  (favorites.includes(w.id) ? "Unfavorite " : "Favorite ") +
                  w.title
                }
                aria-pressed={favorites.includes(w.id)}
                onClick={() => onFavorite(w.id)}
              >
                <Heart size={20} />
              </button>
            </div>
            <span className="card-number">
              {w.kind === "personal"
                ? w.provenance.generation
                  ? "SAVED · AI-ASSISTED"
                  : "SAVED WORKOUT"
                : statusLabel(w.provenance.status).toUpperCase()}
            </span>
            <h3>
              <button onClick={() => onOpen(w)}>{w.title}</button>
            </h3>
            <p className="card-summary">
              {w.summary || "Your plan, your way."}
            </p>
            {!personal && w.provenance.ao && (
              <p className="source-meta">
                {w.provenance.ao} · {w.provenance.q ?? "Q unknown"} ·{" "}
                {w.provenance.eventDate ?? "Date unknown"}
              </p>
            )}
            {personal && (
              <p className="source-meta">
                {w.provenance.ao || "AO not set"} · Edited{" "}
                {new Date(w.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
            <div className="card-metrics">
              <span>
                <Clock3 />
                {w.duration ? `~${w.duration} min` : "Time not set"}
              </span>
              <span>
                <Dumbbell />
                {w.equipment.join(", ") ||
                  (w.provenance.issues?.some((i) =>
                    i.startsWith("Equipment not"),
                  )
                    ? "Equipment unknown"
                    : "No gear")}
              </span>
              <span>
                <Footprints />
                {w.provenance.issues?.some((i) =>
                  i.startsWith("Running requirement"),
                )
                  ? "Running unknown"
                  : w.running === "None"
                    ? "No running"
                    : w.running + " running"}
              </span>
            </div>
            {!!w.provenance.issues?.length && (
              <p className="source-meta">
                {w.provenance.issues.length} {personal ? "workout" : "source"}{" "}
                notes · check details
              </p>
            )}
            <div className="workout-card-actions">
              <button className="card-open" onClick={() => onOpen(w)}>
                View workout <ArrowUpRight size={18} />
              </button>
              {personal && (
                <>
                  {onLead && (
                    <button className="create" onClick={() => onLead(w)}>
                      <AppIcon name="sheet" /> Lead
                    </button>
                  )}
                  {onEdit && (
                    <button onClick={() => onEdit(w)}>
                      <AppIcon name="details" /> Edit
                    </button>
                  )}
                  <button onClick={() => onUse(w)}>
                    <Copy size={16} /> Duplicate
                  </button>
                </>
              )}
              {!personal && (
                <button
                  className="use-workout"
                  aria-label={`Use this workout: ${w.title}`}
                  onClick={() => onUse(w)}
                >
                  <Copy size={16} /> Use this workout
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <section className="empty">
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
          <button onClick={reset}>Reset filters</button>
        </section>
      )}
    </section>
  );
}
