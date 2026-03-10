import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", async () => {
  const react = await vi.importActual<typeof import("react")>("react");

  return {
    default: ({
      href,
      className,
      children,
    }: {
      href: string;
      className?: string;
      children: ReactNode;
    }) => react.createElement("a", { href, className }, children),
  };
});

vi.mock("next/image", async () => {
  const react = await vi.importActual<typeof import("react")>("react");

  return {
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
    }) => react.createElement("img", { alt, className, height, src, width }),
  };
});

import { RunDetailShellView, formatRunResultCount, getRunFailureMessage, shouldPollRunStatus } from "./run-detail-shell";

function buildRunStatusPayload() {
  return {
    id: "53adac17-f39d-4731-a61f-194150fbc431",
    requestedByUserId: "6fcbcf96-bca7-4bf1-b8ef-71f20f0f703b",
    name: "Gaming Run",
    query: "gaming creators",
    status: "completed" as const,
    lastError: null,
    createdAt: "2026-03-10T10:00:00.000Z",
    updatedAt: "2026-03-10T10:03:00.000Z",
    startedAt: "2026-03-10T10:01:00.000Z",
    completedAt: "2026-03-10T10:03:00.000Z",
    results: [
      {
        id: "24a57b02-3008-4af1-9b3a-340bd0db7d1c",
        channelId: "24a57b02-3008-4af1-9b3a-340bd0db7d1c",
        rank: 1,
        source: "catalog" as const,
        createdAt: "2026-03-10T10:02:00.000Z",
        channel: {
          id: "24a57b02-3008-4af1-9b3a-340bd0db7d1c",
          youtubeChannelId: "UC_RUN_RESULT",
          title: "Run Result Channel",
          handle: "@runresult",
          thumbnailUrl: "https://example.com/thumb.jpg",
        },
      },
    ],
  };
}

function renderView(requestState: Parameters<typeof RunDetailShellView>[0]["requestState"]) {
  return renderToStaticMarkup(
    createElement(RunDetailShellView, {
      onRetry: () => undefined,
      requestState,
      runId: "53adac17-f39d-4731-a61f-194150fbc431",
    }),
  );
}

describe("run detail shell", () => {
  it("polls only while queued or running", () => {
    expect(shouldPollRunStatus("queued")).toBe(true);
    expect(shouldPollRunStatus("running")).toBe(true);
    expect(shouldPollRunStatus("completed")).toBe(false);
    expect(shouldPollRunStatus("failed")).toBe(false);
  });

  it("formats result counts", () => {
    expect(formatRunResultCount({ results: [] })).toBe("0 results");
    expect(formatRunResultCount({ results: [buildRunStatusPayload().results[0]!]})).toBe("1 result");
  });

  it("maps quota failures to actionable copy", () => {
    expect(
      getRunFailureMessage({
        lastError: "YouTube API quota exceeded",
      }),
    ).toBe(
      "YouTube API quota was exhausted before discovery completed. Retry later or ask an admin to rotate the assigned key.",
    );
  });

  it("renders loading and not-found states", () => {
    const loadingHtml = renderView({
      status: "loading",
      data: null,
      error: null,
    });
    const notFoundHtml = renderView({
      status: "notFound",
      data: null,
      error: null,
    });

    expect(loadingHtml).toContain("Loading run status");
    expect(notFoundHtml).toContain("Run not found");
  });

  it("renders ready state with result cards and catalog links", () => {
    const html = renderView({
      status: "ready",
      data: buildRunStatusPayload(),
      error: null,
    });

    expect(html).toContain("Gaming Run");
    expect(html).toContain("Snapshot results");
    expect(html).toContain("Run Result Channel");
    expect(html).toContain('href="/catalog/24a57b02-3008-4af1-9b3a-340bd0db7d1c"');
  });
});
