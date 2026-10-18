import React, { useEffect, useRef, useState } from "react";
import { Copy, FileUp } from "lucide-react";
import {
  MARKDOWN_LIMIT,
  MARKDOWN_PROMPT,
  parseMarkdownWorkout,
} from "./markdown-workout";
import { type Workout } from "./model";

const DRAFT_KEY = "fe-planner:markdown-import:v1";
export function MarkdownImport({ onEdit }: { onEdit: (w: Workout) => void }) {
  const [text, setText] = useState(() => {
    try {
      return sessionStorage.getItem(DRAFT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [preview, setPreview] = useState<Workout | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reading, setReading] = useState(false);
  const version = useRef(0);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  const review = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (preview) review.current?.focus();
  }, [preview]);
  function change(value: string) {
    version.current++;
    setReading(false);
    setText(value);
    setPreview(null);
    setError("");
    setMessage("");
    try {
      sessionStorage.setItem(DRAFT_KEY, value);
    } catch {
      setMessage(
        "This browser cannot keep your pasted text after navigation. Keep your original file or chat.",
      );
    }
  }
  async function read(file?: File) {
    if (!file) return;
    const request = ++version.current;
    setReading(false);
    setError("");
    setPreview(null);
    if (file.size > 80_000) {
      setError("Choose a Markdown file under 80 KB and 20,000 characters.");
      return;
    }
    setReading(true);
    try {
      const value = await file.text();
      if (request !== version.current) return;
      if (value.length > MARKDOWN_LIMIT || value.includes("\0"))
        throw Error(
          "Choose a plain-text Markdown workout under 20,000 characters.",
        );
      change(value);
      setMessage(`Loaded ${file.name}. Review the Markdown before continuing.`);
    } catch (e) {
      if (request === version.current)
        setError(
          e instanceof Error
            ? e.message
            : "That file could not be read. Paste the Markdown instead.",
        );
    } finally {
      if (request === version.current) setReading(false);
    }
  }
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(MARKDOWN_PROMPT);
      setMessage(
        "Prompt copied. Paste it into your chat, add your workout, then bring the Markdown back here.",
      );
    } catch {
      setMessage(
        "Copy was unavailable. Open “Chat prompt & format” below and select the prompt to copy it manually.",
      );
    }
  }
  return (
    <section className="markdown-import" aria-labelledby="markdown-heading">
      <p className="eyebrow">BRING YOUR OWN WORKOUT</p>
      <h1 id="markdown-heading">Import a Markdown workout.</h1>
      <p>
        Bring a workout from your chat or a Markdown file. Check it here, then
        make it yours in the editor.
      </p>
      <div className="actions">
        <button onClick={() => void copyPrompt()}>
          <Copy size={18} aria-hidden="true" />
          Copy chat prompt
        </button>
        <label className="button">
          <FileUp size={18} aria-hidden="true" />
          Choose Markdown file
          <input
            className="sr-only"
            type="file"
            accept=".md,.markdown,.txt,text/plain,text/markdown"
            aria-label="Choose Markdown file"
            onChange={(e) => {
              void read(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="muted">
        Copy the prompt into your chat to format a workout for import. This
        importer works offline and makes no AI requests.
      </p>
      <details className="markdown-format">
        <summary>Chat prompt &amp; format</summary>
        <pre>{MARKDOWN_PROMPT}</pre>
      </details>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          setPreview(null);
          try {
            setPreview(parseMarkdownWorkout(text));
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "Check the Markdown and try again.",
            );
          }
        }}
      >
        <label htmlFor="markdown-input">Workout Markdown</label>
        <textarea
          id="markdown-input"
          rows={15}
          value={text}
          maxLength={MARKDOWN_LIMIT}
          onChange={(e) => change(e.target.value)}
          placeholder={
            "# Partner ladder\nDuration: 45\nEquipment: Coupon\nRunning: None\n\n## The Thang\n### Main work\nMinutes: Unknown\nDescribe the workout here.\n- Merkins | 10 | total | Modify as needed."
          }
          aria-describedby="markdown-help"
        />
        <p id="markdown-help" className="muted">
          Up to 20,000 characters. A # title and ## The Thang section are
          required. Plain instructions stay as written; structured exercise rows
          use the format in the prompt.
        </p>
        <button
          className="create"
          disabled={reading || !text.trim()}
          type="submit"
        >
          {reading ? "Reading file…" : "Review import"}
        </button>
      </form>
      {message && <p role="status">{message}</p>}
      {error && (
        <p className="assistant-error" role="alert">
          {error} Your saved workouts have not changed.
        </p>
      )}
      {preview && (
        <section
          className="markdown-review"
          aria-labelledby="markdown-review-heading"
        >
          <p className="eyebrow">NOT SAVED YET</p>
          <h2 ref={review} tabIndex={-1} id="markdown-review-heading">
            Review: {preview.title}
          </h2>
          <p>{preview.summary}</p>
          <p>
            {preview.sections.length} sections ·{" "}
            {preview.sections.flatMap((s) => s.blocks).length} blocks ·{" "}
            {
              preview.sections.flatMap((s) =>
                s.blocks.flatMap((b) => b.exercises),
              ).length
            }{" "}
            structured exercises
          </p>
          <ul className="import-issues">
            {preview.provenance.issues?.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          {preview.sections.map((s) => (
            <article key={s.id}>
              <h3>{s.title}</h3>
              {s.blocks.map((b) => (
                <div key={b.id}>
                  <h4>
                    {b.title} ·{" "}
                    {b.minutes === null ? "Time unknown" : `${b.minutes} min`}
                  </h4>
                  {b.instructions && (
                    <p className="import-directions">{b.instructions}</p>
                  )}
                  <ul>
                    {b.exercises.map((e) => (
                      <li key={e.id}>
                        <strong>
                          {e.name}: {e.amount}
                        </strong>{" "}
                        · {e.counting}
                        {e.instructions && <p>{e.instructions}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </article>
          ))}
          {preview.adaptationNotes && (
            <p className="import-directions">{preview.adaptationNotes}</p>
          )}
          <button className="create" onClick={() => onEdit(preview)}>
            Open in editor
          </button>
          <p className="muted">
            A new personal draft. Nothing is added to My Workouts until you save
            in the editor.
          </p>
        </section>
      )}
    </section>
  );
}
