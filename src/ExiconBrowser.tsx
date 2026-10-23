import { useState } from "react";
import {
  F3_LEXICON,
  WORKOUT_STYLE_TEMPLATES,
  F3_FIVE_CORE_PRINCIPLES,
} from "./studio/reference";
import { MovementGuide } from "./MovementGuide";
import { movements } from "./movements";
export function ExiconBrowser() {
  const [query, setQuery] = useState(""),
    [tab, setTab] = useState("exercises");
  const match = (value: unknown) =>
    JSON.stringify(value).toLowerCase().includes(query.toLowerCase());
  return (
    <section className="discovery" aria-label="Exicon and Lexicon">
      <p className="eyebrow">THE FIELD GUIDE</p>
      <h1>Know the movement. Speak the language.</h1>
      <p>
        Movement and style descriptions adapted from the app guide. Confirm
        local variations and cadence before leading. IPC-inspired plans are
        adaptations, not official benchmarks.
      </p>
      <div className="tabs" role="group" aria-label="Reference category">
        {["exercises", "lexicon", "styles", "principles"].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t === "exercises"
              ? `Exicon (${movements.length})`
              : t === "lexicon"
                ? "Lexicon"
                : t === "styles"
                  ? "F3 styles"
                  : "Five principles"}
          </button>
        ))}
      </div>
      <label>
        Search reference
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Exercise, term, equipment or style…"
        />
      </label>
      {tab === "exercises" && <MovementGuide query={query} />}
      <div className="cards">
        {tab === "lexicon" &&
          F3_LEXICON.filter(match).map((t) => (
            <article className="card" key={t.term}>
              <h2>{t.term}</h2>
              <p>{t.definition}</p>
              <p className="muted">{t.usage}</p>
            </article>
          ))}
        {tab === "styles" &&
          Object.values(WORKOUT_STYLE_TEMPLATES)
            .filter(match)
            .map((t) => (
              <article className="card" key={t.title}>
                <h2>{t.title}</h2>
                <strong>{t.tagline}</strong>
                <p>{t.description}</p>
                <ol>
                  {t.howItWorks.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
              </article>
            ))}
        {tab === "principles" &&
          F3_FIVE_CORE_PRINCIPLES.filter(match).map((x) => (
            <article className="card" key={x}>
              <h2>{x}</h2>
            </article>
          ))}
      </div>
      <p>
        IC: demonstrate a complete four-count cycle; the group calls the
        completed rep on count four. OYO: individual pace and stated rep totals.
      </p>
      <div className="actions">
        <a href="https://f3nation.com/" target="_blank" rel="noreferrer">
          F3 Nation ↗
        </a>
        <a href="https://map.f3nation.com/" target="_blank" rel="noreferrer">
          Find an AO ↗
        </a>
      </div>
    </section>
  );
}
