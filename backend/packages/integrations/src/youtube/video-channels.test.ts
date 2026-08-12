import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractYoutubeVideoId,
  fetchYoutubeVideoChannels,
  YoutubeVideoChannelProviderError,
} from "./video-channels";

describe("YouTube video channel lookup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts ids only from supported YouTube video URLs", () => {
    expect(extractYoutubeVideoId("https://youtu.be/abcdefghijk")).toBe("abcdefghijk");
    expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=abcdefghijk")).toBe("abcdefghijk");
    expect(extractYoutubeVideoId("https://youtube.com/shorts/abcdefghijk")).toBe("abcdefghijk");
    expect(extractYoutubeVideoId("https://example.com/watch?v=abcdefghijk")).toBeNull();
  });

  it("resolves video ids to normalized channel identities", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{
        id: "abcdefghijk",
        snippet: { channelId: "UCaaaaaaaaaaaaaaaaaaaaaa", channelTitle: "Creator" },
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchYoutubeVideoChannels({
      apiKey: "secret-key",
      videoIds: ["abcdefghijk", "abcdefghijk"],
    });

    expect(result.get("abcdefghijk")).toEqual({
      videoId: "abcdefghijk",
      channelId: "UCaaaaaaaaaaaaaaaaaaaaaa",
      channelTitle: "Creator",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("id=abcdefghijk");
  });

  it("normalizes provider quota failures without leaking the key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { errors: [{ reason: "quotaExceeded" }] },
    }), { status: 403 })));

    const error = await fetchYoutubeVideoChannels({
      apiKey: "do-not-leak",
      videoIds: ["abcdefghijk"],
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(YoutubeVideoChannelProviderError);
    expect(error).toMatchObject({ code: "YOUTUBE_QUOTA_EXCEEDED", status: 429 });
    expect(String(error)).not.toContain("do-not-leak");
  });
});
