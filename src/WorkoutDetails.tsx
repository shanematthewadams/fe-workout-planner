import { AppIcon } from "./AppIcon";
import type { PlannerRequest } from "./planner-contract";
import {
  WEATHER,
  LIGHT,
  GROUPING,
  FOCUS,
  type PlanningDetails,
} from "./planning-details";

export function WorkoutDetails({
  value,
  running,
  busy,
  onChange,
  onRunning,
}: {
  value: PlanningDetails;
  running: PlannerRequest["running"];
  busy: boolean;
  onChange: (value: PlanningDetails) => void;
  onRunning: (value: PlannerRequest["running"]) => void;
}) {
  return (
    <details className="workout-details assistant-preferences">
      <summary>
        Workout details{" "}
        <span>
          {value.pax ? `${value.pax} PAX` : "Any turnout"} · {value.focus} ·{" "}
          {running === "From prompt"
            ? "Running from your idea"
            : running === "None"
              ? "No running"
              : `${running} running`}
        </span>
      </summary>
      <fieldset disabled={busy}>
        <legend>Shape this workout</legend>
        <div className="assistant-grid">
          <label>
            Workout type
            <select
              aria-label="Workout type"
              value={value.activity}
              onChange={(e) =>
                onChange({
                  ...value,
                  activity: e.target.value as PlanningDetails["activity"],
                })
              }
            >
              {["Bootcamp", "Run", "Ruck"].map((activity) => (
                <option key={activity}>{activity}</option>
              ))}
            </select>
          </label>
          {value.activity !== "Bootcamp" && (
            <>
              <label>
                Route description
                <input
                  maxLength={600}
                  value={value.route}
                  onChange={(e) =>
                    onChange({ ...value, route: e.target.value })
                  }
                  placeholder="Q confirms a route or out-and-back"
                />
              </label>
              <label>
                Target distance (optional)
                <input
                  maxLength={80}
                  value={value.distance}
                  onChange={(e) =>
                    onChange({ ...value, distance: e.target.value })
                  }
                  placeholder="For example, 3 miles"
                />
              </label>
              <label>
                Pace and regrouping
                <input
                  maxLength={120}
                  value={value.pace}
                  onChange={(e) => onChange({ ...value, pace: e.target.value })}
                  placeholder="Conversational pace; regroup at turns"
                />
              </label>
              <p>
                Confirm access and distance. Choose a turnaround that gets
                everyone back for COT. Add any exercise stops in your idea.
              </p>
            </>
          )}
          <label>
            <span className="icon-label">
              <AppIcon name="pax" />
              PAX count
            </span>
            <input
              type="number"
              min={1}
              max={200}
              placeholder="How many guys?"
              value={value.pax ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  pax:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            <span className="icon-label">
              <AppIcon name="group" />
              Work together
            </span>
            <select
              aria-label="Work together"
              value={value.grouping}
              onChange={(e) =>
                onChange({
                  ...value,
                  grouping: e.target.value as PlanningDetails["grouping"],
                })
              }
            >
              {GROUPING.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="icon-label">
              <AppIcon name="focus" />
              Fitness focus
            </span>
            <select
              aria-label="Fitness focus"
              value={value.focus}
              onChange={(e) => onChange({ ...value, focus: e.target.value })}
            >
              {FOCUS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="icon-label">
              <AppIcon name="running" />
              How much running
            </span>
            <select
              aria-label="How much running"
              value={running}
              onChange={(e) =>
                onRunning(e.target.value as PlannerRequest["running"])
              }
            >
              {["From prompt", "None", "Light", "Moderate"].map((v) => (
                <option key={v} value={v}>
                  {v === "From prompt"
                    ? "Use my idea"
                    : v === "None"
                      ? "No running"
                      : v}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="icon-label">
              <AppIcon name="date" />
              Workout date
            </span>
            <input
              type="date"
              value={value.date}
              onChange={(e) => onChange({ ...value, date: e.target.value })}
            />
          </label>
          <label>
            <span className="icon-label">
              <AppIcon name="light" />
              Expected light
            </span>
            <select
              aria-label="Expected light"
              value={value.light}
              onChange={(e) =>
                onChange({
                  ...value,
                  light: e.target.value as PlanningDetails["light"],
                })
              }
            >
              {LIGHT.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="expected-weather">
          <legend>Expected weather</legend>
          <div className="gear-options">
            {WEATHER.map((weather) => (
              <label className="checkbox" key={weather}>
                <input
                  type="checkbox"
                  checked={value.weather.includes(weather)}
                  onChange={() =>
                    onChange({
                      ...value,
                      weather: value.weather.includes(weather)
                        ? value.weather.filter((w) => w !== weather)
                        : [...value.weather, weather],
                    })
                  }
                />
                <AppIcon name={weather} size={17} />
                {weather}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="muted">
          Choose the conditions you expect. Weather and daylight are not looked
          up automatically.
        </p>
      </fieldset>
    </details>
  );
}
