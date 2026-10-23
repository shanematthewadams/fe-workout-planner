import { blockSchema, newExercise, uid, exerciseSchema } from "./model";
import { z } from "zod";
import { MovementPicker } from "./MovementPicker";
import { AppIcon } from "./AppIcon";

export const weinkeBlocksSchema = z
  .array(
    blockSchema.extend({
      rounds: z.string().max(120).default(""),
    }),
  )
  .max(49);
export type WeinkeBlock = z.infer<typeof weinkeBlocksSchema>[number];

/** Optional literal structure. Rounds stay instructions; no timing is guessed. */
export function WeinkeBlocks({
  blocks,
  onChange,
}: {
  blocks: WeinkeBlock[];
  onChange: (blocks: WeinkeBlock[]) => void;
}) {
  const update = (index: number, patch: Partial<WeinkeBlock>) =>
    onChange(
      blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    );
  return (
    <details className="weinke-blocks">
      <summary>
        <AppIcon name="details" /> Organize The Thang into blocks (optional)
      </summary>
      <p>
        Keep your notes above, or add blocks below. Set your own rounds, reps
        and counting. No AI needed.
      </p>
      {blocks.map((block, i) => (
        <fieldset key={block.id}>
          <legend>Block {i + 1}</legend>
          <label>
            Block name
            <input
              maxLength={120}
              value={block.title}
              onChange={(e) => update(i, { title: e.target.value })}
            />
          </label>
          <label>
            Rounds (optional)
            <input
              maxLength={120}
              placeholder="3 rounds, together"
              value={block.rounds}
              onChange={(e) => update(i, { rounds: e.target.value })}
            />
          </label>
          <label>
            Block instructions
            <textarea
              maxLength={20000}
              value={block.instructions}
              onChange={(e) => update(i, { instructions: e.target.value })}
            />
          </label>
          {block.exercises.map((exercise, j) => {
            const change = (patch: Partial<typeof exercise>) =>
              update(i, {
                exercises: block.exercises.map((item, k) =>
                  k === j ? { ...item, ...patch } : item,
                ),
              });
            return (
              <fieldset key={exercise.id}>
                <legend>Exercise {j + 1}</legend>
                <label>
                  Exercise name
                  <input
                    maxLength={120}
                    required
                    value={exercise.name}
                    onChange={(e) => change({ name: e.target.value })}
                  />
                </label>
                <label>
                  Reps or duration
                  <input
                    maxLength={120}
                    required
                    value={exercise.amount}
                    onChange={(e) => change({ amount: e.target.value })}
                  />
                </label>
                <label>
                  Unit
                  <select
                    value={exercise.unit}
                    onChange={(e) =>
                      change({ unit: e.target.value as typeof exercise.unit })
                    }
                  >
                    {exerciseSchema.shape.unit.options.map((unit) => (
                      <option key={unit}>{unit}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Counting
                  <select
                    value={exercise.counting}
                    onChange={(e) =>
                      change({
                        counting: e.target.value as typeof exercise.counting,
                      })
                    }
                  >
                    {exerciseSchema.shape.counting.options.map((count) => (
                      <option key={count}>{count}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Exercise instructions
                  <textarea
                    maxLength={3000}
                    value={exercise.instructions}
                    onChange={(e) => change({ instructions: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  disabled={j === 0}
                  onClick={() => {
                    const next = [...block.exercises];
                    [next[j - 1], next[j]] = [next[j], next[j - 1]];
                    update(i, { exercises: next });
                  }}
                >
                  Move exercise up
                </button>
                <button
                  type="button"
                  disabled={j === block.exercises.length - 1}
                  onClick={() => {
                    const next = [...block.exercises];
                    [next[j + 1], next[j]] = [next[j], next[j + 1]];
                    update(i, { exercises: next });
                  }}
                >
                  Move exercise down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update(i, {
                      exercises: block.exercises.filter((_, k) => j !== k),
                    })
                  }
                >
                  Remove exercise
                </button>
              </fieldset>
            );
          })}
          <button
            type="button"
            disabled={block.exercises.length >= 100}
            onClick={() =>
              update(i, { exercises: [...block.exercises, newExercise()] })
            }
          >
            <AppIcon name="exicon" /> Add exercise
          </button>
          <MovementPicker
            disabled={block.exercises.length >= 100}
            onAdd={(exercise) =>
              update(i, { exercises: [...block.exercises, exercise] })
            }
          />
          <div className="actions">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => {
                const next = [...blocks];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                onChange(next);
              }}
            >
              Move block up
            </button>
            <button
              type="button"
              disabled={i === blocks.length - 1}
              onClick={() => {
                const next = [...blocks];
                [next[i + 1], next[i]] = [next[i], next[i + 1]];
                onChange(next);
              }}
            >
              Move block down
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Remove this block and its exercises?"))
                  onChange(blocks.filter((_, k) => i !== k));
              }}
            >
              Remove block
            </button>
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={blocks.length >= 49}
        onClick={() =>
          onChange([
            ...blocks,
            {
              id: uid(),
              title: `Block ${blocks.length + 1}`,
              rounds: "",
              instructions: "",
              minutes: null,
              exercises: [],
            },
          ])
        }
      >
        <AppIcon name="details" /> Add block
      </button>
    </details>
  );
}
