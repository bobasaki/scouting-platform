import { z } from "zod";

const discoveryInputSchema = z.object({
  apiKey: z.string().trim().min(1),
  query: z.string().trim().min(1),
  maxResults: z.number().int().min(1).max(50).default(50),
});

const searchResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.object({
        channelId: z.string().trim().min(1),
      }),
    }),
  ),
});

const channelDetailsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().trim().min(1),
      snippet: z.object({
        title: z.string(),
        description: z.string().optional(),
        customUrl: z.string().optional(),
        thumbnails: z
          .object({
            high: z.object({ url: z.string().optional() }).optional(),
            medium: z.object({ url: z.string().optional() }).optional(),
            default: z.object({ url: z.string().optional() }).optional(),
          })
          .optional(),
      }),
    }),
  ),
});

const errorResponseSchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
      errors: z
        .array(
          z.object({
            reason: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

const YOUTUBE_SEARCH_URL = "https://youtube.googleapis.com/youtube/v3/search";
const YOUTUBE_CHANNELS_URL = "https://youtube.googleapis.com/youtube/v3/channels";

const quotaErrorReasons = new Set([
  "quotaExceeded",
  "dailyLimitExceeded",
  "rateLimitExceeded",
  "userRateLimitExceeded",
]);

const authErrorReasons = new Set([
  "keyInvalid",
  "forbidden",
  "accessNotConfigured",
  "ipRefererBlocked",
]);

export type YoutubeDiscoveryErrorCode =
  | "YOUTUBE_QUOTA_EXCEEDED"
  | "YOUTUBE_AUTH_FAILED"
  | "YOUTUBE_DISCOVERY_FAILED";

export class YoutubeDiscoveryProviderError extends Error {
  readonly code: YoutubeDiscoveryErrorCode;
  readonly status: number;

  constructor(code: YoutubeDiscoveryErrorCode, status: number, message: string) {
    super(message);
    this.name = "YoutubeDiscoveryProviderError";
    this.code = code;
    this.status = status;
  }
}

export function isYoutubeDiscoveryProviderError(
  error: unknown,
): error is YoutubeDiscoveryProviderError {
  return error instanceof YoutubeDiscoveryProviderError;
}

export type YoutubeDiscoveredChannel = {
  youtubeChannelId: string;
  title: string;
  handle: string | null;
  description: string | null;
  thumbnailUrl: string | null;
};

export type DiscoverYoutubeChannelsInput = z.input<typeof discoveryInputSchema>;

function toNullableTrimmed(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function pickThumbnailUrl(
  thumbnails:
    | {
        high?: { url?: string | undefined } | undefined;
        medium?: { url?: string | undefined } | undefined;
        default?: { url?: string | undefined } | undefined;
      }
    | undefined,
): string | null {
  return (
    toNullableTrimmed(thumbnails?.high?.url) ??
    toNullableTrimmed(thumbnails?.medium?.url) ??
    toNullableTrimmed(thumbnails?.default?.url)
  );
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function assertSuccessResponseOrThrow(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const errorBody = errorResponseSchema.safeParse(await parseJsonResponse(response));
  const reasons = new Set(
    (errorBody.success ? errorBody.data.error?.errors ?? [] : [])
      .map((item) => item.reason?.trim())
      .filter((reason): reason is string => Boolean(reason)),
  );

  for (const reason of reasons) {
    if (quotaErrorReasons.has(reason)) {
      throw new YoutubeDiscoveryProviderError(
        "YOUTUBE_QUOTA_EXCEEDED",
        429,
        "YouTube API quota exceeded",
      );
    }
  }

  for (const reason of reasons) {
    if (authErrorReasons.has(reason)) {
      throw new YoutubeDiscoveryProviderError(
        "YOUTUBE_AUTH_FAILED",
        401,
        "YouTube API key is invalid or unauthorized",
      );
    }
  }

  throw new YoutubeDiscoveryProviderError(
    "YOUTUBE_DISCOVERY_FAILED",
    502,
    "YouTube discovery request failed",
  );
}

function buildSearchUrl(input: z.output<typeof discoveryInputSchema>): string {
  const params = new URLSearchParams({
    key: input.apiKey,
    part: "snippet",
    type: "channel",
    q: input.query,
    maxResults: String(input.maxResults),
  });

  return `${YOUTUBE_SEARCH_URL}?${params.toString()}`;
}

function buildChannelsUrl(apiKey: string, channelIds: string[]): string {
  const params = new URLSearchParams({
    key: apiKey,
    part: "snippet",
    id: channelIds.join(","),
    maxResults: String(channelIds.length),
  });

  return `${YOUTUBE_CHANNELS_URL}?${params.toString()}`;
}

export async function discoverYoutubeChannels(
  rawInput: DiscoverYoutubeChannelsInput,
): Promise<YoutubeDiscoveredChannel[]> {
  const input = discoveryInputSchema.parse(rawInput);
  const searchResponse = await fetch(buildSearchUrl(input), {
    method: "GET",
  });
  await assertSuccessResponseOrThrow(searchResponse);

  const parsedSearch = searchResponseSchema.parse(await parseJsonResponse(searchResponse));
  const discoveredChannelIds = [...new Set(parsedSearch.items.map((item) => item.id.channelId))];

  if (discoveredChannelIds.length === 0) {
    return [];
  }

  const channelsResponse = await fetch(buildChannelsUrl(input.apiKey, discoveredChannelIds), {
    method: "GET",
  });
  await assertSuccessResponseOrThrow(channelsResponse);

  const parsedChannels = channelDetailsResponseSchema.parse(
    await parseJsonResponse(channelsResponse),
  );
  const byId = new Map(
    parsedChannels.items.map((item) => [
      item.id,
      {
        youtubeChannelId: item.id,
        title: item.snippet.title.trim(),
        handle: toNullableTrimmed(item.snippet.customUrl),
        description: toNullableTrimmed(item.snippet.description),
        thumbnailUrl: pickThumbnailUrl(item.snippet.thumbnails),
      } satisfies YoutubeDiscoveredChannel,
    ]),
  );

  return discoveredChannelIds
    .map((channelId) => byId.get(channelId))
    .filter((channel): channel is YoutubeDiscoveredChannel => Boolean(channel));
}
