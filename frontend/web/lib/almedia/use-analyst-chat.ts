"use client";

import type { AlmediaAnalystMessage } from "@scouting-platform/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchAlmediaAnalystStatus,
  streamAlmediaAnalystAnswer,
} from "../almedia-api";

/**
 * Conversation state for the AI analyst.
 *
 * The digest is pulled through a getter rather than passed in as a value: it is
 * rebuilt from the filtered deal set on every send, so a question always lands
 * against the view the user is looking at right now, not the one that happened
 * to be active when the widget rendered.
 */

export type AnalystChatMessage = AlmediaAnalystMessage;

export interface AnalystChat {
  messages: readonly AnalystChatMessage[];
  streaming: boolean;
  /** Null while the status probe is still in flight. */
  configured: boolean | null;
  error: string | null;
  send: (question: string) => void;
  stop: () => void;
  clear: () => void;
}

export function useAnalystChat(getContext: () => string): AnalystChat {
  const [messages, setMessages] = useState<readonly AnalystChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Kept in a ref so `send` does not have to change identity whenever the
  // filters move; the widget's suggestion buttons would remount on every keystroke.
  const contextRef = useRef(getContext);
  contextRef.current = getContext;

  useEffect(() => {
    const controller = new AbortController();

    fetchAlmediaAnalystStatus(controller.signal)
      .then((status) => {
        setConfigured(status.configured);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setConfigured(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  // `send` reads the conversation from a ref rather than from state so it can
  // stay referentially stable, and so the request is fired outside the state
  // updater — an updater runs twice under StrictMode and would double-send.
  const messagesRef = useRef<readonly AnalystChatMessage[]>(messages);
  messagesRef.current = messages;
  const streamingRef = useRef(false);
  streamingRef.current = streaming;

  const send = useCallback((question: string) => {
    const trimmed = question.trim();

    if (!trimmed || streamingRef.current) {
      return;
    }

    setError(null);
    setStreaming(true);
    streamingRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    const history: readonly AnalystChatMessage[] = [
      ...messagesRef.current,
      { role: "user", content: trimmed },
    ];

    // The empty assistant turn is the streaming placeholder the deltas append
    // to, so the answer grows in place instead of appearing all at once.
    setMessages([...history, { role: "assistant", content: "" }]);
    void run(history, controller);

    async function run(
      turns: readonly AnalystChatMessage[],
      abortController: AbortController,
    ): Promise<void> {
      try {
        await streamAlmediaAnalystAnswer(
          { messages: turns, context: contextRef.current() },
          {
            onDelta: (text) => {
              setMessages((current) => {
                const last = current[current.length - 1];

                if (!last || last.role !== "assistant") {
                  return current;
                }

                return [
                  ...current.slice(0, -1),
                  { ...last, content: last.content + text },
                ];
              });
            },
            onError: (message) => {
              setError(message);
            },
          },
          abortController.signal,
        );
      } catch (caught) {
        if (abortController.signal.aborted) {
          return;
        }

        setError(
          caught instanceof Error && caught.message
            ? caught.message
            : "The AI request failed.",
        );
      } finally {
        if (!abortController.signal.aborted) {
          setStreaming(false);
          // Drop an assistant turn that never received a delta, so the failed
          // question can be retried without an empty bubble in the way.
          setMessages((current) =>
            current[current.length - 1]?.content === ""
              ? current.slice(0, -1)
              : current,
          );
        }
      }
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages((current) =>
      current[current.length - 1]?.content === "" ? current.slice(0, -1) : current,
    );
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setError(null);
    setStreaming(false);
  }, []);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  return { messages, streaming, configured, error, send, stop, clear };
}
