import { useState } from "react";
import { searchMovements, type Movement } from "./movements";
import { FEATURES } from "./site-contract";
import { newExercise, type Exercise } from "./model";

export function exerciseFromMovement(movement: Movement): Exercise {
  return {
    ...newExercise(),
    name: movement.name,
    amount: "Set reps or time",
    unit: "instructions",
    counting: "not applicable",
    instructions: `${movement.instructions} Counting: ${movement.counting}`,
  };
}

export function MovementPicker({
  onAdd,
  disabled = false,
}: {
  onAdd: (exercise: Exercise) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const candidates = searchMovements(query);
  return (
    <details className="movement-picker">
      <summary>Add from movement guide</summary>
      <p>
        Choose a movement, then set its reps or time in the editor. Gear and AO
        settings do not change automatically.
      </p>
      {disabled && (
        <p role="status">
          This block has 100 movements. Remove one before adding another.
        </p>
      )}
      <label>
        Find a movement
        <input
          placeholder="Merkin, WW3, coupon…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul>
        {candidates.slice(0, 8).map((movement) => (
          <li key={movement.id}>
            <div>
              <strong>{movement.name}</strong>
              <span>
                {[
                  ...movement.equipment,
                  ...movement.features.map((f) => FEATURES[f]),
                  ...(movement.running ? ["Running"] : []),
                ].join(" · ") || "Bodyweight"}
              </span>
            </div>
            <button
              disabled={disabled}
              aria-label={`Add ${movement.name}`}
              onClick={() => {
                onAdd(exerciseFromMovement(movement));
                setQuery("");
              }}
            >
              Add
            </button>
          </li>
        ))}
      </ul>
      {!candidates.length ? (
        <p>No matching movements. Try another name or add a custom exercise.</p>
      ) : candidates.length > 8 ? (
        <p>{candidates.length} movements match. Search to narrow the list.</p>
      ) : null}
    </details>
  );
}
