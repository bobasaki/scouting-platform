import type {
  ChannelDetail,
  ChannelEnrichmentStatus,
} from "@scouting-platform/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    height,
    src,
    width,
  }: {
    alt: string;
    className?: string;
    height: number;
    src: string;
    width: number;
  }) => createElement("img", { alt, className, height, src, width }),
}));

import { ChannelDetailShellView } from "./channel-detail-shell";

function createChannelDetail(overrides?: Partial<ChannelDetail>): ChannelDetail {
  return {
    id: "53adac17-f39d-4731-a61f-194150fbc431",
    youtubeChannelId: "UC123",
    title: "Orbital Deep Dive",
    handle: "@orbitaldeepdive",
    youtubeUrl: "https://www.youtube.com/channel/UC123",
    socialMediaLink: "https://instagram.com/orbitaldeepdive",
    platforms: ["YouTube", "Instagram"],
    countryRegion: "United States",
    email: "creator@example.com",
    influencerVertical: "Tech",
    influencerType: "Creator",
    contentLanguage: "English",
    youtubeEngagementRate: 3.2,
    youtubeFollowers: "500000",
    youtubeVideoMedianViews: "220000",
    youtubeShortsMedianViews: "180000",
    description: "Weekly coverage of launch systems and creator strategy.",
    thumbnailUrl: "https://example.com/thumb.jpg",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-08T10:00:00.000Z",
    enrichment: {
      status: "completed",
      updatedAt: "2026-03-08T10:00:00.000Z",
      completedAt: "2026-03-08T10:00:00.000Z",
      lastError: null,
      summary: "Creator focused on launches and industry analysis.",
      topics: ["space", "launches"],
      brandFitNotes: "Strong fit for launch providers.",
      confidence: 0.82,
      structuredProfile: null,
    },
    advancedReport: {
      requestId: "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b",
      status: "completed",
      updatedAt: "2026-03-08T10:00:00.000Z",
      completedAt: "2026-03-08T10:00:00.000Z",
      lastError: null,
      requestedAt: "2026-03-07T08:00:00.000Z",
      reviewedAt: "2026-03-07T09:00:00.000Z",
      decisionNote: "Approved.",
      lastCompletedReport: {
        requestId: "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b",
        completedAt: "2026-03-08T10:00:00.000Z",
        ageDays: 12,
        withinFreshWindow: true,
      },
    },
    insights: {
      audienceCountries: [],
      audienceGenderAge: [],
      audienceInterests: [],
      estimatedPrice: null,
      brandMentions: [],
    },
    ...overrides,
  };
}

function renderReadyView(options?: {
  channel?: ChannelDetail;
  enrichmentActionState?: {
    type: "idle" | "submitting" | "success" | "error";
    message: string;
  };
}): string {
  return renderToStaticMarkup(
    createElement(ChannelDetailShellView, {
      channelId: "53adac17-f39d-4731-a61f-194150fbc431",
      enrichmentActionState: options?.enrichmentActionState ?? {
        type: "idle",
        message: "",
      },
      onRequestEnrichment: vi.fn(),
      onRetry: vi.fn(),
      requestState: {
        status: "ready",
        data: options?.channel ?? createChannelDetail(),
        error: null,
      },
    }),
  );
}

function createEnrichmentScenario(status: ChannelEnrichmentStatus): ChannelDetail {
  return createChannelDetail({
    enrichment: {
      status,
      updatedAt: status === "missing" ? null : "2026-03-08T10:00:00.000Z",
      completedAt:
        status === "completed" || status === "stale" ? "2026-03-08T10:00:00.000Z" : null,
      lastError: status === "failed" ? "OpenAI enrichment request failed" : null,
      summary:
        status === "missing"
          ? null
          : "Creator focused on launches and industry analysis.",
      topics: status === "missing" ? null : ["space", "launches"],
      brandFitNotes: status === "missing" ? null : "Strong fit for launch providers.",
      confidence: status === "missing" ? null : 0.82,
      structuredProfile: null,
    },
  });
}

describe("channel detail shell view", () => {
  it("renders catalog profile fields and enrichment summary while removing Hype surfaces", () => {
    const html = renderReadyView();

    expect(html).toContain("Orbital Deep Dive");
    expect(html).toContain("Creator profile");
    expect(html).toContain("Channel name/title");
    expect(html).toContain("YouTube channel ID");
    expect(html).toContain("YouTube handle");
    expect(html).toContain("YouTube URL");
    expect(html).toContain("Social media URL");
    expect(html).toContain("Platforms");
    expect(html).toContain("Country/Region");
    expect(html).toContain("Email");
    expect(html).toContain("Influencer type");
    expect(html).toContain("Influencer vertical");
    expect(html).toContain("Content language");
    expect(html).toContain("YouTube Followers");
    expect(html).toContain("YouTube Engagement Rate");
    expect(html).toContain("YouTube Video Median Views");
    expect(html).toContain("YouTube Shorts Median Views");
    expect(html).toContain("Thumbnail");
    expect(html).toContain("Description");
    expect(html).toContain("Enrichment summary");
    expect(html).toContain("Creator focused on launches and industry analysis.");
    expect(html).toContain("href=\"https://www.youtube.com/channel/UC123\"");
    expect(html).toContain("href=\"https://instagram.com/orbitaldeepdive\"");

    expect(html).not.toContain("Advanced report");
    expect(html).not.toContain("HypeAuditor");
    expect(html).not.toContain("Audience and commercial insights");
  });

  it("renders fallback profile values when channel fields are missing", () => {
    const html = renderReadyView({
      channel: createChannelDetail({
        handle: null,
        youtubeUrl: null,
        socialMediaLink: null,
        platforms: [],
        countryRegion: null,
        email: null,
        influencerType: null,
        influencerVertical: null,
        contentLanguage: null,
        youtubeFollowers: null,
        youtubeEngagementRate: null,
        youtubeVideoMedianViews: null,
        youtubeShortsMedianViews: null,
        thumbnailUrl: null,
        description: null,
      }),
    });

    expect(html).toContain("No public handle");
    expect(html).toContain("No channel description has been captured yet.");
    expect(html).toContain("href=\"https://www.youtube.com/channel/UC123\"");
    expect(html).toContain("Not available");
  });

  it("renders enrichment status tags for requestable states", () => {
    const scenarios: Array<{
      status: ChannelEnrichmentStatus;
      statusLabel: string;
    }> = [
      {
        status: "missing",
        statusLabel: "Enrichment: Missing",
      },
      {
        status: "failed",
        statusLabel: "Enrichment: Failed",
      },
      {
        status: "stale",
        statusLabel: "Enrichment: Stale",
      },
    ];

    for (const scenario of scenarios) {
      const html = renderReadyView({
        channel: createEnrichmentScenario(scenario.status),
      });

      expect(html).toContain(scenario.statusLabel);
    }
  });

  it("renders busy enrichment status tags for queued and running states", () => {
    const queuedHtml = renderReadyView({
      channel: createEnrichmentScenario("queued"),
    });
    const runningHtml = renderReadyView({
      channel: createEnrichmentScenario("running"),
    });

    expect(queuedHtml).toContain("Enrichment: Queued");
    expect(runningHtml).toContain("Enrichment: Running");
  });

  it("keeps enrichment request feedback out of the closed default view", () => {
    const successHtml = renderReadyView({
      channel: createEnrichmentScenario("missing"),
      enrichmentActionState: {
        type: "success",
        message:
          "Enrichment request recorded. This page refreshes automatically while the worker runs, and the current result stays visible below until the refresh completes.",
      },
    });
    const busyHtml = renderReadyView({
      channel: createEnrichmentScenario("missing"),
      enrichmentActionState: {
        type: "submitting",
        message: "",
      },
    });

    expect(successHtml).not.toContain("Enrichment request recorded.");
    expect(busyHtml).not.toContain("Requesting...");
  });

  it("renders retryable error feedback when the request fails", () => {
    const html = renderToStaticMarkup(
      createElement(ChannelDetailShellView, {
        channelId: "53adac17-f39d-4731-a61f-194150fbc431",
        enrichmentActionState: {
          type: "idle",
          message: "",
        },
        onRequestEnrichment: vi.fn(),
        onRetry: vi.fn(),
        requestState: {
          status: "error",
          data: null,
          error: "Catalog temporarily unavailable.",
        },
      }),
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Catalog temporarily unavailable.");
    expect(html).toContain(">Retry<");
  });

  it("renders an explicit not-found state for missing catalog records", () => {
    const html = renderToStaticMarkup(
      createElement(ChannelDetailShellView, {
        channelId: "missing-channel-id",
        enrichmentActionState: {
          type: "idle",
          message: "",
        },
        onRequestEnrichment: vi.fn(),
        onRetry: vi.fn(),
        requestState: {
          status: "notFound",
          data: null,
          error: null,
        },
      }),
    );

    expect(html).toContain("Channel not found");
    expect(html).toContain("We could not find a catalog record for");
    expect(html).toContain("<code>missing-channel-id</code>");
  });
});
