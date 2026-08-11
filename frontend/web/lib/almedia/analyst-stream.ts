/**
 * A minimal Server-Sent Events reader for the analyst route.
 *
 * `EventSource` is not an option here: the request is a POST carrying the
 * conversation and the data digest, and EventSource can only issue GETs. So the
 * response body is read as a stream and framed by hand.
 *
 * The parser is deliberately separate from the hook so the framing rules — a
 * blank line ends a frame, `data:` lines concatenate, a partial frame survives
 * to the next chunk — can be tested without a network or a React tree.
 */

export interface AnalystSseFrame {
  event: string;
  data: string;
}

export interface AnalystSseParseResult {
  frames: AnalystSseFrame[];
  /** The incomplete tail, to be prefixed onto the next chunk. */
  rest: string;
}

/** Split whatever has accumulated into complete frames plus a remainder. */
export function parseAnalystSseChunk(buffer: string): AnalystSseParseResult {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const frames: AnalystSseFrame[] = [];

  for (const part of parts) {
    let event = "message";
    let data = "";

    for (const rawLine of part.split("\n")) {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        // Per the SSE grammar a single leading space after the colon is part of
        // the framing, not the payload.
        const value = line.slice("data:".length);

        data += value.startsWith(" ") ? value.slice(1) : value;
      }
    }

    if (data) {
      frames.push({ event, data });
    }
  }

  return { frames, rest };
}

export interface AnalystStreamEventPayload {
  text?: string;
  error?: string;
  stopReason?: string;
}

/**
 * Decode one frame's JSON payload. A malformed frame is dropped rather than
 * thrown on — one bad frame should not abort an answer that is otherwise fine.
 */
export function parseAnalystFramePayload(
  frame: AnalystSseFrame,
): AnalystStreamEventPayload | null {
  try {
    const parsed: unknown = JSON.parse(frame.data);

    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const payload = parsed as AnalystStreamEventPayload;

    return {
      ...(typeof payload.text === "string" ? { text: payload.text } : {}),
      ...(typeof payload.error === "string" ? { error: payload.error } : {}),
      ...(typeof payload.stopReason === "string"
        ? { stopReason: payload.stopReason }
        : {}),
    };
  } catch {
    return null;
  }
}
