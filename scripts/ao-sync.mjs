import { JSDOM } from "jsdom";
/** Parse only schedule facts. Never copy page prose, contact details, scripts or images. */
export function parseSchedule(html, checkedAt) {
  const doc = new JSDOM(html).window.document;
  const map = new Map();
  let day = null,
    current = null;
  for (const el of doc.querySelectorAll("main h2, main h3, main h4, main p")) {
    const text = el.textContent.replace(/\s+/g, " ").trim();
    if (el.tagName === "H2") {
      day = /^(MON|TUES|WEDNES|THURS|FRI|SATUR|SUN)DAYS$/.test(text)
        ? text.slice(0, -1).toLowerCase()
        : null;
      current = null;
    } else if (day && el.tagName === "H3" && text.startsWith("AO ")) {
      const name = text.slice(3).replaceAll("’", "'");
      const id = "fe-ao-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      current = map.get(id) ?? {
        id,
        name,
        sourceUrl: "https://f3thefe.com/schedule/",
        checkedAt,
        sessions: [],
      };
      current.sessions.push({
        day,
        time: "05:30",
        minutes: null,
        format: null,
        location: null,
      });
      map.set(id, current);
    } else if (current && el.tagName === "H4") {
      const s = current.sessions.at(-1);
      s.minutes = Number(text.match(/^(\d+)[- ]minute/i)?.[1]) || null;
      s.format = /running/i.test(text)
        ? "Run / ruck"
        : /ruck/i.test(text)
          ? "Ruck"
          : /bootcamp/i.test(text)
            ? "Bootcamp"
            : null;
      if (text.includes("6:45")) s.time = "06:45";
    } else if (
      current &&
      el.tagName === "P" &&
      text &&
      !current.sessions.at(-1).location
    )
      current.sessions.at(-1).location = text;
  }
  const rows = [...map.values()];
  if (
    rows.length < 10 ||
    rows.some((r) =>
      r.sessions.some((s) => !s.location || !s.minutes || !s.format),
    )
  )
    throw Error(
      "Schedule structure changed or incomplete; keep last good snapshot.",
    );
  return rows;
}
