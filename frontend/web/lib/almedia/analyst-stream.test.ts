import { describe, expect, it } from "vitest";

import { parseAnalystFramePayload, parseAnalystSseChunk } from "./analyst-stream";

describe("parseAnalystSseChunk", () => {
  it("reads a complete frame and its event name", () => {
    const { frames, rest } = parseAnalystSseChunk(
      'event: delta\ndata: {"text":"Shift"}\n\n',
    );

    expect(frames).toEqual([{ event: "delta", data: '{"text":"Shift"}' }]);
    expect(rest).toBe("");
  });

  it("holds a partial frame back until the rest of it arrives", () => {
    const first = parseAnalystSseChunk('event: delta\ndata: {"te');

    expect(first.frames).toEqual([]);
    expect(first.rest).toBe('event: delta\ndata: {"te');

    const second = parseAnalystSseChunk(`${first.rest}xt":"Shift"}\n\n`);

    expect(second.frames).toEqual([{ event: "delta", data: '{"text":"Shift"}' }]);
    expect(second.rest).toBe("");
  });

  it("concatenates multi-line data and keeps frames in order", () => {
    const { frames } = parseAnalystSseChunk(
      'event: delta\ndata: {"text":"a"\ndata: }\n\nevent: done\ndata: {"stopReason":"completed"}\n\n',
    );

    expect(frames).toEqual([
      { event: "delta", data: '{"text":"a"}' },
      { event: "done", data: '{"stopReason":"completed"}' },
    ]);
  });

  it("strips CRLF line endings a proxy may introduce", () => {
    const { frames } = parseAnalystSseChunk(
      'event: delta\r\ndata: {"text":"Shift"}\r\n\n',
    );

    expect(frames).toEqual([{ event: "delta", data: '{"text":"Shift"}' }]);
  });

  it("defaults an unnamed frame to the message event", () => {
    const { frames } = parseAnalystSseChunk('data: {"text":"a"}\n\n');

    expect(frames[0]?.event).toBe("message");
  });

  it("ignores comment-only keep-alive frames", () => {
    const { frames } = parseAnalystSseChunk(": keep-alive\n\n");

    expect(frames).toEqual([]);
  });
});

describe("parseAnalystFramePayload", () => {
  it("reads the text, error, and stopReason fields", () => {
    expect(
      parseAnalystFramePayload({ event: "delta", data: '{"text":"Shift"}' }),
    ).toEqual({ text: "Shift" });
    expect(
      parseAnalystFramePayload({ event: "error", data: '{"error":"Rate limited"}' }),
    ).toEqual({ error: "Rate limited" });
    expect(
      parseAnalystFramePayload({ event: "done", data: '{"stopReason":"completed"}' }),
    ).toEqual({ stopReason: "completed" });
  });

  it("drops a malformed frame instead of throwing", () => {
    expect(parseAnalystFramePayload({ event: "delta", data: "{oops" })).toBeNull();
    expect(parseAnalystFramePayload({ event: "delta", data: "null" })).toBeNull();
    expect(parseAnalystFramePayload({ event: "delta", data: "42" })).toBeNull();
  });

  it("ignores fields of the wrong type rather than trusting them", () => {
    expect(
      parseAnalystFramePayload({ event: "delta", data: '{"text":{"nested":1}}' }),
    ).toEqual({});
  });
});
