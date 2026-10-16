import type { Workout } from "./model";
export const DISCLAIMER =
  "I am not a professional. Participate at your own risk. Modify exercises as needed. Check footing and equipment, and look out for the six.";
export type Phase = {
  id: string;
  name: string;
  start: number;
  end: number;
  detail: string;
};
export function sessionPhases(mary = true, cot = 10): Phase[] {
  return [
    {
      id: "welcome",
      name: "Welcome & disclaimer",
      start: 0,
      end: 120,
      detail: DISCLAIMER,
    },
    {
      id: "warmup",
      name: "Warm-o-Rama / COP",
      start: 120,
      end: 600,
      detail: "Demonstrate movements and establish cadence.",
    },
    {
      id: "thang",
      name: "The Thang",
      start: 600,
      end: mary ? 2340 : 2700,
      detail: "Include explanations, recovery and transitions.",
    },
    ...(mary
      ? [
          {
            id: "mary",
            name: "Mary / 6MOM",
            start: 2340,
            end: 2700,
            detail: "Closing core; stop all physical work at 6:15 AM.",
          },
        ]
      : []),
    {
      id: "cot",
      name: "Fellowship & trust",
      start: 2700,
      end: 2700 + cot * 60,
      detail:
        "Count-o-Rama · Name-o-Rama / FNG naming · Announcements · Ball of Man / closing",
    },
  ];
}
export function clockLabel(seconds: number, startMinutes = 330) {
  const total = startMinutes + Math.floor(seconds / 60);
  return `${Math.floor(total / 60) % 12 || 12}:${String(total % 60).padStart(2, "0")} AM`;
}
export function sessionMatches(w: Workout) {
  const minutes = (kind: string) =>
    w.sections
      .find((s) => s.kind === kind)
      ?.blocks.reduce((n, b) => n + (b.minutes ?? 0), 0) ?? 0;
  return (
    w.duration === 45 &&
    minutes("warmup") === 8 &&
    minutes("thang") ===
      (w.sections.some((s) => s.kind === "mary") ? 29 : 35) &&
    (!w.sections.some((s) => s.kind === "mary") || minutes("mary") === 6)
  );
}
export function SessionTimeline({ workout }: { workout: Workout }) {
  if (!sessionMatches(workout)) return null;
  return (
    <SessionTimelineContent
      mary={workout.sections.some((s) => s.kind === "mary")}
    />
  );
}
function SessionTimelineContent({ mary }: { mary: boolean }) {
  return (
    <section className="session-timeline" aria-label="45-minute Q timeline">
      {sessionPhases(mary).map((p) => (
        <div key={p.id} className={`phase-${p.id}`}>
          <small>
            {clockLabel(p.start)} – {clockLabel(p.end)}
          </small>
          <strong>{p.name}</strong>
          <span>
            {(p.end - p.start) / 60} min
            {p.id === "cot" ? " · after the hard stop" : ""}
          </span>
        </div>
      ))}
      <p>6:15 AM whistle · All physical work stops.</p>
    </section>
  );
}

export function qSheet(w: Workout) {
  return [
    `*${w.title}*`,
    w.provenance.ao ? `AO: ${w.provenance.ao}` : "",
    w.provenance.q ? `Q: ${w.provenance.q}` : "",
    "Q PLAN · not a completed backblast",
    sessionMatches(w)
      ? "5:30 welcome · 5:32 warmup · 5:40 The Thang · " +
        (w.sections.some((s) => s.kind === "mary") ? "6:09 Mary · " : "") +
        "6:15 physical hard stop"
      : "Review session timing before leading.",
    ...w.sections.flatMap((s) => [
      `\n*${s.title}*`,
      ...s.blocks.flatMap((b) => [
        b.title,
        b.instructions,
        ...b.exercises.map(
          (e) =>
            `${e.name}: ${e.amount} ${e.unit} (${e.counting}) — ${e.instructions}`,
        ),
      ]),
    ]),
    "\nAfter physical work: Count-o-Rama · Name-o-Rama / FNG naming · Announcements · BOM / closing",
    w.adaptationNotes,
  ]
    .filter(Boolean)
    .join("\n");
}
