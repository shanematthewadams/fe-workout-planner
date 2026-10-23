import { uid, workoutSchema, type Workout, type Section } from "./model";

export const MARKDOWN_LIMIT = 20_000;
export const MARKDOWN_PROMPT = `Convert the workout below into Markdown for F3 Q Builder. Return only the Markdown, using this format. Preserve the exercise order, counts, counting conventions, equipment, and instructions. Do not invent terrain, equipment, timing, or missing details. Use Unknown for missing metadata. Do not add a warmup or Mary unless supplied.

# Workout title
Summary: A brief description
Duration: Unknown
Equipment: Unknown
Running: Unknown
Format: Custom
AO: Unknown
Q: Unknown

## Warmup
### Warmup block
Minutes: Unknown
Instructions and exercise rows go here.

## The Thang
### Main work
Minutes: Unknown
Explain rounds, transitions, partner roles, rest, and any time cap here.
- Exercise name | exact amount | counting | instructions

## Mary
### Core work
Minutes: Unknown
Instructions and exercise rows go here.

## Notes
Put supplied COT, modifications, and unresolved questions here.

Rules: Include exactly one The Thang section; Warmup, Mary, and Notes are optional. Use ### headings for blocks. Minutes must be a number or Unknown. Duration is the full physical session in minutes, or Unknown. Equipment is a comma-separated list, None, or Unknown. Running is None, Light, Moderate, or Unknown. Format is Circuit, 11s, EMOM, AMRAP, Ladder, Partner, Stations, Chipper, or Custom. Counting is total, 1=1, 2=1, per side, cadence, time, distance, or not applicable. Keep unknown counting as not applicable and explain the uncertainty in instructions. Do not put pipe characters inside a field. Leave out placeholder exercise rows. Do not include personal prayer requests or other people's private information.

WORKOUT TO CONVERT:
[Paste your workout here]`;

const unknown = (s: string) =>
  /^(unknown|not supplied|not specified|\?|)$/i.test(s.trim());
function minutes(value: string, label: string): number | null {
  if (unknown(value)) return null;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(?:min(?:ute)?s?)?$/i);
  const n = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 300)
    throw Error(`${label} must be a number from 1 to 300 minutes, or Unknown.`);
  return n;
}
function cleanHeading(s: string) {
  return s
    .replace(/[*_`]/g, "")
    .replace(/[:.!]+$/, "")
    .trim();
}
function sectionKind(s: string): Section["kind"] | "notes" | undefined {
  const key = cleanHeading(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (["warmup", "warmorama", "warmarama", "cop", "warmupcop"].includes(key))
    return "warmup";
  if (["thethang", "thang", "mainwork"].includes(key)) return "thang";
  if (["mary", "6mom", "mary6mom", "core"].includes(key)) return "mary";
  if (["notes", "cot", "fellowship", "modifications"].includes(key))
    return "notes";
}

/** A deterministic, local import. Free-form directions stay literal; only explicit rows become exercises. */
export function parseMarkdownWorkout(input: string): Workout {
  if (input.includes("\0")) throw Error("Paste a plain-text Markdown workout.");
  if (input.length > MARKDOWN_LIMIT)
    throw Error("Keep the Markdown under 20,000 characters.");
  const text = input
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  const unwrapped = text.replace(
    /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i,
    "$1",
  );
  const meta: Record<string, string> = {};
  const sections: Section[] = [];
  const issues: string[] = [];
  const notes: string[] = [];
  const intro: string[] = [];
  let title = "",
    section: Section | undefined,
    block: Section["blocks"][number] | undefined;
  let inNotes = false,
    started = false;
  const seen = new Set<string>();
  const timed = new Set<string>();
  function addBlock(name: string) {
    if (!section)
      throw Error(
        "Put blocks under a ## Warmup, ## The Thang, or ## Mary heading.",
      );
    if (block && !block.instructions.trim() && !block.exercises.length)
      throw Error(
        `Add instructions or exercises to “${block.title}”, or remove that empty block.`,
      );
    block = {
      id: uid(),
      title: name,
      minutes: null,
      instructions: "",
      exercises: [],
    };
    section.blocks.push(block);
  }
  for (const line of unwrapped.split("\n")) {
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h?.[1] === "#") {
      if (title || started)
        throw Error(
          "Import one workout at a time, with one # title at the top.",
        );
      title = cleanHeading(h[2]);
      continue;
    }
    if (h?.[1] === "##") {
      const kind = sectionKind(h[2]);
      if (!kind)
        throw Error(
          `Unrecognized section “${h[2]}”. Use ## Warmup, ## The Thang, ## Mary, or ## Notes; use ### for blocks.`,
        );
      started = true;
      inNotes = kind === "notes";
      section = undefined;
      block = undefined;
      if (inNotes) {
        notes.push(h[2]);
        continue;
      }
      if (seen.has(kind))
        throw Error(
          `Use only one ${h[2]} section. Put additional rounds under ### block headings.`,
        );
      seen.add(kind);
      section = {
        id: uid(),
        kind: kind as Section["kind"],
        title: cleanHeading(h[2]),
        blocks: [],
      };
      sections.push(section);
      continue;
    }
    if (inNotes) {
      notes.push(line);
      continue;
    }
    if (h?.[1] === "###") {
      addBlock(cleanHeading(h[2]));
      continue;
    }
    if (!started) {
      const m = line
        .replace(/\*\*/g, "")
        .match(/^(Summary|Duration|Equipment|Running|Format|AO|Q):\s*(.*)$/i);
      if (m) {
        const key = m[1].toLowerCase();
        if (key in meta) throw Error(`Use only one ${m[1]} metadata line.`);
        meta[key] = m[2].trim();
      } else if (line.trim()) intro.push(line);
      continue;
    }
    if (!section) continue;
    if (!block && !line.trim()) continue;
    if (!block) addBlock(section.title);
    const b = block!;
    const m = line.match(/^\s*(?:\*\*)?Minutes:(?:\*\*)?\s*(.*)$/i);
    if (m) {
      if (b.instructions.trim() || b.exercises.length || timed.has(b.id))
        throw Error(`Put one Minutes line directly below “${b.title}”.`);
      b.minutes = minutes(m[1], `Minutes for “${b.title}”`);
      timed.add(b.id);
      continue;
    }
    const row = line.match(/^\s*[-*+]\s+(.+\|.+)$/);
    if (row) {
      const fields = row[1].split("|").map((s) => s.trim());
      if (fields.length < 3 || fields.length > 4 || !fields[0] || !fields[1])
        throw Error(
          "Exercise rows need: - Name | amount | counting | instructions. Keep extra pipes out of fields.",
        );
      const counting = fields[2].toLowerCase();
      const valid = [
        "total",
        "1=1",
        "2=1",
        "per side",
        "cadence",
        "time",
        "distance",
        "not applicable",
      ] as const;
      if (!(valid as readonly string[]).includes(counting))
        throw Error(
          `Unknown counting “${fields[2]}”. Use total, 1=1, 2=1, per side, cadence, time, distance, or not applicable.`,
        );
      b.exercises.push({
        id: uid(),
        name: fields[0],
        amount: fields[1],
        unit: "instructions",
        counting: counting as (typeof valid)[number],
        instructions: fields[3] ?? "",
      });
    } else if (b.exercises.length) {
      const last = b.exercises[b.exercises.length - 1];
      last.instructions += (last.instructions ? "\n" : "") + line;
    } else b.instructions += (b.instructions ? "\n" : "") + line;
  }
  if (!title)
    throw Error("Add a title on the first line, like # Partner ladder.");
  if (!seen.has("thang"))
    throw Error("Add a ## The Thang heading and the main workout beneath it.");
  for (const s of sections) {
    if (
      !s.blocks.length ||
      s.blocks.some((b) => !b.instructions.trim() && !b.exercises.length)
    )
      throw Error(
        `“${s.title}” has an empty block. Add the workout details or remove the optional section.`,
      );
    for (const b of s.blocks) {
      b.instructions = b.instructions.trim();
      for (const e of b.exercises) e.instructions = e.instructions.trim();
    }
  }
  const duration = minutes(meta.duration ?? "Unknown", "Duration");
  if (unknown(meta.running ?? ""))
    issues.push("Running requirement not supplied; confirm before leading.");
  else if (!["none", "light", "moderate"].includes(meta.running.toLowerCase()))
    throw Error("Running must be None, Light, Moderate, or Unknown.");
  const running =
    (["None", "Light", "Moderate"] as const).find(
      (value) => value.toLowerCase() === meta.running?.toLowerCase(),
    ) ?? "None";
  if (unknown(meta.equipment ?? ""))
    issues.push(
      "Equipment not specified; confirm the full workout before leading.",
    );
  const equipment =
    unknown(meta.equipment ?? "") || /^none$/i.test(meta.equipment)
      ? []
      : meta.equipment
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
  const formats = workoutSchema.innerType().shape.format.options;
  const format =
    formats.find((f) => f.toLowerCase() === meta.format?.toLowerCase()) ??
    "Custom";
  if (
    meta.format &&
    !unknown(meta.format) &&
    format === "Custom" &&
    !/^custom$/i.test(meta.format)
  )
    throw Error(
      "Choose a supported Format from the copyable prompt, or use Custom.",
    );
  const blocks = sections.flatMap((s) => s.blocks);
  if (duration === null || blocks.some((b) => b.minutes === null))
    issues.push(
      "Timing is incomplete. Set block times and the full session duration before using the timer.",
    );
  else {
    const sum = blocks.reduce((n, b) => n + b.minutes!, 0);
    if (
      Math.abs(duration - sum) > 0.001 &&
      Math.abs(duration - sum - 2) > 0.001
    )
      issues.push(
        `Block times total ${sum} minutes; the session says ${duration}. Reconcile timing before using the timer.`,
      );
  }
  issues.push(
    "Imported from Markdown; review instructions, counts, conditions, and modifications before leading.",
  );
  const result = workoutSchema.safeParse({
    schemaVersion: 1,
    id: uid(),
    title,
    summary: [meta.summary, ...intro].filter(Boolean).join("\n"),
    kind: "personal",
    duration,
    equipment,
    running,
    format,
    sections,
    rawNotes: input,
    adaptationNotes: notes.join("\n").trim(),
    provenance: {
      status: "personal",
      label: "Imported Markdown draft · not a reviewed regional original",
      issues,
      durationBasis: duration === null ? "unknown" : "source",
      ...(!unknown(meta.ao ?? "") ? { ao: meta.ao } : {}),
      ...(!unknown(meta.q ?? "") ? { q: meta.q } : {}),
    },
    updatedAt: new Date().toISOString(),
  });
  if (!result.success)
    throw Error(
      "This workout exceeds the supported limits. Use a title under 160 characters, up to 50 blocks per section, and up to 100 exercises per block.",
    );
  return result.data;
}
