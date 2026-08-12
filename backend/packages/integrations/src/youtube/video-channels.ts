import { z } from "zod";

const YOUTUBE_VIDEOS_URL = "https://youtube.googleapis.com/youtube/v3/videos";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 2;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/u;

const responseSchema = z.object({
  items: z.array(z.object({
    id: z.string().regex(VIDEO_ID_PATTERN),
    snippet: z.object({
      channelId: z.string().trim().min(1),
      channelTitle: z.string().trim().min(1),
    }),
  })).default([]),
});

const errorResponseSchema = z.object({
  error: z.object({
    errors: z.array(z.object({ reason: z.string().optional() })).optional(),
  }).optional(),
});

const quotaReasons = new Set(["quotaExceeded", "dailyLimitExceeded"]);
const authReasons = new Set(["keyInvalid", "forbidden", "accessNotConfigured", "ipRefererBlocked"]);

export type YoutubeVideoChannel = Readonly<{
  videoId: string;
  channelId: string;
  channelTitle: string;
}>;

export class YoutubeVideoChannelProviderError extends Error {
  constructor(
    readonly code:
      | "YOUTUBE_QUOTA_EXCEEDED"
      | "YOUTUBE_AUTH_FAILED"
      | "YOUTUBE_VIDEO_CHANNELS_FAILED",
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "YoutubeVideoChannelProviderError";
  }
}

/** Extract a video id only from recognized YouTube URL shapes. */
export function extractYoutubeVideoId(value: string): string | null {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./u, "");
  let candidate: string | null = null;

  if (hostname === "youtu.be") {
    candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const [kind, id] = url.pathname.split("/").filter(Boolean);
      candidate = ["shorts", "embed", "live"].includes(kind ?? "") ? id ?? null : null;
    }
  }

  return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
}

function errorReasons(payload: unknown): Set<string> {
  const parsed = errorResponseSchema.safeParse(payload);
  return new Set(
    (parsed.success ? parsed.data.error?.errors ?? [] : [])
      .flatMap((item) => item.reason ? [item.reason] : []),
  );
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function fetchBatch(apiKey: string, videoIds: string[]): Promise<YoutubeVideoChannel[]> {
  const params = new URLSearchParams({
    key: apiKey,
    part: "snippet",
    id: videoIds.join(","),
    maxResults: String(videoIds.length),
    fields: "items(id,snippet(channelId,channelTitle))",
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(`${YOUTUBE_VIDEOS_URL}?${params.toString()}`, {
        method: "GET",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt < MAX_ATTEMPTS) {
        continue;
      }

      throw new YoutubeVideoChannelProviderError(
        "YOUTUBE_VIDEO_CHANNELS_FAILED",
        502,
        error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")
          ? "YouTube video lookup timed out"
          : "YouTube video lookup failed",
      );
    }

    if (!response.ok) {
      const reasons = errorReasons(await parseJson(response));

      if ([...reasons].some((reason) => quotaReasons.has(reason))) {
        throw new YoutubeVideoChannelProviderError(
          "YOUTUBE_QUOTA_EXCEEDED",
          429,
          "YouTube API quota exceeded",
        );
      }

      if ([...reasons].some((reason) => authReasons.has(reason))) {
        throw new YoutubeVideoChannelProviderError(
          "YOUTUBE_AUTH_FAILED",
          401,
          "YouTube API key is invalid or unauthorized",
        );
      }

      if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
        continue;
      }

      throw new YoutubeVideoChannelProviderError(
        "YOUTUBE_VIDEO_CHANNELS_FAILED",
        502,
        "YouTube video lookup failed",
      );
    }

    const parsed = responseSchema.safeParse(await parseJson(response));

    if (!parsed.success) {
      throw new YoutubeVideoChannelProviderError(
        "YOUTUBE_VIDEO_CHANNELS_FAILED",
        502,
        "YouTube returned an invalid video lookup response",
      );
    }

    return parsed.data.items.map((item) => ({
      videoId: item.id,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
    }));
  }

  return [];
}

/** Resolve up to an arbitrary number of YouTube videos in quota-cheap batches of 50. */
export async function fetchYoutubeVideoChannels(input: {
  apiKey: string;
  videoIds: string[];
}): Promise<Map<string, YoutubeVideoChannel>> {
  const apiKey = input.apiKey.trim();
  const videoIds = [...new Set(input.videoIds.filter((id) => VIDEO_ID_PATTERN.test(id)))];

  if (!apiKey) {
    throw new YoutubeVideoChannelProviderError(
      "YOUTUBE_AUTH_FAILED",
      401,
      "YouTube API key is required",
    );
  }

  const resolved: YoutubeVideoChannel[] = [];

  for (let index = 0; index < videoIds.length; index += 50) {
    resolved.push(...await fetchBatch(apiKey, videoIds.slice(index, index + 50)));
  }

  return new Map(resolved.map((item) => [item.videoId, item]));
}
