import { afterEach, describe, expect, it, vi } from "vitest";

import {
  YoutubeDiscoveryProviderError,
  discoverYoutubeChannels,
} from "./discovery";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("discoverYoutubeChannels", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps search and channel details into normalized discovery rows", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            { id: { channelId: "UC-A" } },
            { id: { channelId: "UC-B" } },
            { id: { channelId: "UC-A" } },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "UC-B",
              snippet: {
                title: "  Channel B  ",
                description: "  Desc B  ",
                customUrl: "channel-b",
                thumbnails: {
                  medium: { url: "https://img.example.com/b.jpg" },
                },
              },
            },
            {
              id: "UC-A",
              snippet: {
                title: "Channel A",
                thumbnails: {
                  high: { url: "https://img.example.com/a.jpg" },
                },
              },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const channels = await discoverYoutubeChannels({
      apiKey: "yt-key",
      query: "gaming creators",
      maxResults: 50,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(channels).toEqual([
      {
        youtubeChannelId: "UC-A",
        title: "Channel A",
        handle: null,
        description: null,
        thumbnailUrl: "https://img.example.com/a.jpg",
      },
      {
        youtubeChannelId: "UC-B",
        title: "Channel B",
        handle: "channel-b",
        description: "Desc B",
        thumbnailUrl: "https://img.example.com/b.jpg",
      },
    ]);
  });

  it("throws quota-specific provider errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              errors: [{ reason: "quotaExceeded" }],
            },
          },
          403,
        ),
      ),
    );

    await expect(
      discoverYoutubeChannels({
        apiKey: "yt-key",
        query: "gaming creators",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "YOUTUBE_QUOTA_EXCEEDED",
        status: 429,
        message: "YouTube API quota exceeded",
      } satisfies Partial<YoutubeDiscoveryProviderError>),
    );
  });

  it("throws auth-specific provider errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              errors: [{ reason: "keyInvalid" }],
            },
          },
          400,
        ),
      ),
    );

    await expect(
      discoverYoutubeChannels({
        apiKey: "yt-key",
        query: "gaming creators",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "YOUTUBE_AUTH_FAILED",
        status: 401,
        message: "YouTube API key is invalid or unauthorized",
      } satisfies Partial<YoutubeDiscoveryProviderError>),
    );
  });

  it("throws a generic provider error for other non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse({ error: { message: "boom" } }, 500)),
    );

    await expect(
      discoverYoutubeChannels({
        apiKey: "yt-key",
        query: "gaming creators",
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "YOUTUBE_DISCOVERY_FAILED",
        status: 502,
        message: "YouTube discovery request failed",
      } satisfies Partial<YoutubeDiscoveryProviderError>),
    );
  });
});
