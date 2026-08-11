import { APIError } from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AlmediaAnalystError,
  buildGroundedAnalystInput,
  getAlmediaAnalystModel,
  isAlmediaAnalystConfigured,
  streamAlmediaAnalystAnswer,
  type AlmediaAnalystClientLike,
  type AlmediaAnalystStreamChunk,
  type AlmediaAnalystStreamEvent,
} from "./almedia-analyst";

const CONTEXT = '{"totals":{"cost":1000}}';

function stubClient(
  chunks: readonly AlmediaAnalystStreamChunk[],
  onCreate?: (body: Record<string, unknown>) => void,
): AlmediaAnalystClientLike {
  return {
    responses: {
      create: async (body) => {
        onCreate?.(body);

        return (async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        })();
      },
    },
  };
}

function throwingClient(error: unknown): AlmediaAnalystClientLike {
  return {
    responses: {
      create: () => Promise.reject(error),
    },
  };
}

async function collect(
  stream: AsyncGenerator<AlmediaAnalystStreamEvent>,
): Promise<AlmediaAnalystStreamEvent[]> {
  const events: AlmediaAnalystStreamEvent[] = [];

  for await (const event of stream) {
    events.push(event);
  }

  return events;
}

describe("buildGroundedAnalystInput", () => {
  it("places the snapshot immediately before the latest question", () => {
    const input = buildGroundedAnalystInput(
      [
        { role: "user", content: "Which markets under-deliver?" },
        { role: "assistant", content: "PL, at 61%." },
        { role: "user", content: "And now?" },
      ],
      CONTEXT,
    );

    expect(input.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "developer",
      "user",
    ]);
    expect(input[2]?.content).toBe(`<dashboard_data>\n${CONTEXT}\n</dashboard_data>`);
    expect(input[3]?.content).toBe("And now?");
  });

  it("omits the snapshot block entirely when there is no context", () => {
    const input = buildGroundedAnalystInput([{ role: "user", content: "Hi" }], "");

    expect(input).toEqual([{ role: "user", content: "Hi" }]);
  });

  it("rejects an empty conversation and a trailing assistant turn", () => {
    expect(() => buildGroundedAnalystInput([], CONTEXT)).toThrow(AlmediaAnalystError);
    expect(() =>
      buildGroundedAnalystInput([{ role: "assistant", content: "Done." }], CONTEXT),
    ).toThrow(AlmediaAnalystError);
  });
});

describe("getAlmediaAnalystModel", () => {
  const originalModel = process.env.ALMEDIA_ANALYST_MODEL;
  const originalEnrichmentModel = process.env.OPENAI_MODEL;

  afterEach(() => {
    process.env.ALMEDIA_ANALYST_MODEL = originalModel;
    process.env.OPENAI_MODEL = originalEnrichmentModel;
  });

  it("prefers an explicit override, then the analyst env var", () => {
    process.env.ALMEDIA_ANALYST_MODEL = "from-env";

    expect(getAlmediaAnalystModel("explicit")).toBe("explicit");
    expect(getAlmediaAnalystModel()).toBe("from-env");
  });

  it("never falls back to the enrichment model", () => {
    delete process.env.ALMEDIA_ANALYST_MODEL;
    process.env.OPENAI_MODEL = "gpt-5-nano";

    expect(getAlmediaAnalystModel()).not.toBe("gpt-5-nano");
  });
});

describe("isAlmediaAnalystConfigured", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
  });

  it("treats a blank key as unconfigured", () => {
    process.env.OPENAI_API_KEY = "   ";

    expect(isAlmediaAnalystConfigured()).toBe(false);
    expect(isAlmediaAnalystConfigured("sk-test")).toBe(true);
  });
});

describe("streamAlmediaAnalystAnswer", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test";
  });

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it("yields the text deltas and a terminal done", async () => {
    const events = await collect(
      streamAlmediaAnalystAnswer({
        messages: [{ role: "user", content: "Summarise." }],
        context: CONTEXT,
        client: stubClient([
          { type: "response.created" },
          { type: "response.output_text.delta", delta: "Shift " },
          { type: "response.output_text.delta", delta: "budget to DE." },
          { type: "response.completed", response: { status: "completed" } },
        ]),
      }),
    );

    expect(events).toEqual([
      { type: "delta", text: "Shift " },
      { type: "delta", text: "budget to DE." },
      { type: "done", stopReason: "completed" },
    ]);
  });

  it("sends the system prompt as instructions and never stores the conversation", async () => {
    let body: Record<string, unknown> | null = null;

    await collect(
      streamAlmediaAnalystAnswer({
        messages: [{ role: "user", content: "Summarise." }],
        context: CONTEXT,
        model: "test-model",
        client: stubClient(
          [{ type: "response.completed", response: { status: "completed" } }],
          (received) => {
            body = received;
          },
        ),
      }),
    );

    expect(body).not.toBeNull();
    const sent = body as unknown as Record<string, unknown>;

    expect(sent.model).toBe("test-model");
    expect(sent.store).toBe(false);
    expect(sent.stream).toBe(true);
    expect(String(sent.instructions)).toContain("untrusted business data");
  });

  it("reports a refusal once and swallows later terminal chunks", async () => {
    const events = await collect(
      streamAlmediaAnalystAnswer({
        messages: [{ role: "user", content: "Summarise." }],
        context: CONTEXT,
        client: stubClient([
          { type: "response.refusal.delta", delta: "no" },
          { type: "response.failed" },
        ]),
      }),
    );

    expect(events).toEqual([
      { type: "error", message: "The model declined to answer this request." },
    ]);
  });

  it("closes an otherwise silent stream with done", async () => {
    const events = await collect(
      streamAlmediaAnalystAnswer({
        messages: [{ role: "user", content: "Summarise." }],
        context: "",
        client: stubClient([{ type: "response.in_progress" }]),
      }),
    );

    expect(events).toEqual([{ type: "done", stopReason: "completed" }]);
  });

  it("turns provider failures into an error event, not a throw", async () => {
    const rateLimited = await collect(
      streamAlmediaAnalystAnswer({
        messages: [{ role: "user", content: "Summarise." }],
        context: CONTEXT,
        client: throwingClient(Object.assign(new Error("boom"), { status: 429 })),
      }),
    );

    expect(rateLimited).toEqual([
      { type: "error", message: "Rate limited by the OpenAI API — try again in a moment." },
    ]);
  });

  it("keeps the provider's own message out of the browser but logs it", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const events = await collect(
      streamAlmediaAnalystAnswer({
        messages: [{ role: "user", content: "Summarise." }],
        context: CONTEXT,
        client: throwingClient(new Error("upstream said: sk-live-abc123")),
      }),
    );

    expect(events).toEqual([{ type: "error", message: "The AI request failed." }]);
    expect(logged).toHaveBeenCalledWith("[almedia-analyst]", expect.any(Error));
  });

  it("names the provider when an API error carries no HTTP status", async () => {
    // A rejected or unfunded account arrives this way — status-less but not a
    // network fault, so "try again" would be the wrong thing to tell the user.
    const apiError = Object.assign(new APIError(undefined, undefined, undefined, undefined), {
      message: "Your account is not active",
    });
    const events = await collect(
      streamAlmediaAnalystAnswer({
        messages: [{ role: "user", content: "Summarise." }],
        context: CONTEXT,
        client: throwingClient(apiError),
      }),
    );

    expect(events).toEqual([
      {
        type: "error",
        message:
          "The OpenAI API rejected the request. Check the server logs and the account status.",
      },
    ]);
  });

  it("throws before streaming when no key is configured", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(
      collect(
        streamAlmediaAnalystAnswer({
          messages: [{ role: "user", content: "Summarise." }],
          context: CONTEXT,
        }),
      ),
    ).rejects.toThrow(AlmediaAnalystError);
  });

  it("rejects a conversation whose last turn is not the user's", async () => {
    await expect(
      collect(
        streamAlmediaAnalystAnswer({
          messages: [{ role: "assistant", content: "Done." }],
          context: CONTEXT,
          client: stubClient([]),
        }),
      ),
    ).rejects.toThrow(AlmediaAnalystError);
  });
});
