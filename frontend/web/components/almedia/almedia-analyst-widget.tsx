"use client";

import type {
  AlmediaDeal,
  AlmediaScorecardResponse,
} from "@scouting-platform/contracts";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { buildAlmediaDigest } from "../../lib/almedia/digest";
import type { AlmediaFilters } from "../../lib/almedia/types";
import { useAnalystChat } from "../../lib/almedia/use-analyst-chat";

/**
 * The AI analyst. Every question is answered against a digest of the deals
 * currently in view, so the filter bar above narrows the analyst exactly as it
 * narrows the widgets — and an answer can only cite numbers the asker can see.
 */

const SUGGESTIONS: readonly string[] = [
  "Using remaining plan budget and matured performance, where should we shift budget next month?",
  "Which verticals combine strong return, engagement, and enough measured campaigns to scale?",
  "Which markets under-deliver on views?",
  "Which matured channels should we rebook or drop, and is the candidate list complete?",
];

type AlmediaAnalystWidgetProps = Readonly<{
  deals: readonly AlmediaDeal[];
  filters: AlmediaFilters;
  scorecard: AlmediaScorecardResponse | null;
}>;

export function AlmediaAnalystWidget({
  deals,
  filters,
  scorecard,
}: AlmediaAnalystWidgetProps) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  // Built at send time, not render time: rebuilding a 190kB digest on every
  // keystroke would make the composer stutter on a large deal set.
  const getContext = useCallback(
    () => buildAlmediaDigest({ deals, filters, scorecard }),
    [deals, filters, scorecard],
  );

  const { messages, streaming, configured, error, send, stop, clear } =
    useAnalystChat(getContext);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    send(draft);
    setDraft("");
  };

  if (configured === false) {
    return (
      <p className="almedia-widget__empty">
        The AI analyst needs an OpenAI API key. Set <code>OPENAI_API_KEY</code> on the
        web server and restart it. The key stays server-side and is never sent to the
        browser.
      </p>
    );
  }

  return (
    <div className="almedia-analyst">
      <div aria-live="polite" className="almedia-analyst__log" ref={logRef}>
        {messages.length === 0 ? (
          <div className="almedia-analyst__intro">
            <p>
              Ask anything about the data currently in view. The filters above apply to
              the answers too.
            </p>
            <ul className="almedia-analyst__suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    className="almedia-analyst__suggestion"
                    disabled={streaming || configured === null}
                    onClick={() => {
                      send(suggestion);
                    }}
                    type="button"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((message, index) => (
          <article
            className={`almedia-analyst__message almedia-analyst__message--${message.role}`}
            // Turns are only ever appended, so the index is a stable identity.
            key={`${message.role}-${String(index)}`}
          >
            {message.content ? (
              <p className="almedia-analyst__text">{message.content}</p>
            ) : streaming && index === messages.length - 1 ? (
              <p className="almedia-analyst__typing">Analysing the data in view…</p>
            ) : null}
          </article>
        ))}

        {error ? (
          <p className="almedia-analyst__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <form className="almedia-analyst__composer" onSubmit={submit}>
        <label className="almedia-analyst__field">
          <span className="sr-only">Ask the analyst</span>
          <input
            disabled={configured === null}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            placeholder="Ask the analyst…"
            type="text"
            value={draft}
          />
        </label>
        {streaming ? (
          <button
            className="workspace-button workspace-button--secondary"
            onClick={stop}
            type="button"
          >
            Stop
          </button>
        ) : (
          <button
            className="workspace-button"
            disabled={configured === null || draft.trim().length === 0}
            type="submit"
          >
            Ask
          </button>
        )}
        {messages.length > 0 ? (
          <button
            className="workspace-button workspace-button--secondary"
            onClick={clear}
            title="Clear the conversation"
            type="button"
          >
            Clear
          </button>
        ) : null}
      </form>
    </div>
  );
}
