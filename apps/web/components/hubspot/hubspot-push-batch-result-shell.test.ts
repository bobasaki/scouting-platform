import type { HubspotPushBatchDetail } from "@scouting-platform/contracts";
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

vi.mock("../../lib/hubspot-push-batches-api", () => ({
  HubspotPushBatchesApiError: class HubspotPushBatchesApiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "HubspotPushBatchesApiError";
      this.status = status;
    }
  },
  fetchHubspotPushBatchDetail: vi.fn(),
}));

import { HubspotPushBatchesApiError } from "../../lib/hubspot-push-batches-api";
import {
  formatHubspotPushBatchResultStatusLabel,
  getHubspotPushBatchDetailRequestErrorMessage,
  HubspotPushBatchResultShellView,
  shouldPollHubspotPushBatchResult,
} from "./hubspot-push-batch-result-shell";

function buildDetail(overrides?: Partial<HubspotPushBatchDetail>): HubspotPushBatchDetail {
  return {
    id: "fdd240f2-ef31-43fe-b1d2-a584951654a8",
    status: "completed",
    totalRowCount: 2,
    pushedRowCount: 1,
    failedRowCount: 1,
    lastError: null,
    requestedBy: {
      id: "8c1136b4-1c95-4e8c-aefe-0e58df0a39d5",
      email: "manager@example.com",
      name: "Manager",
    },
    createdAt: "2026-03-13T09:00:00.000Z",
    updatedAt: "2026-03-13T09:02:00.000Z",
    startedAt: "2026-03-13T09:01:00.000Z",
    completedAt: "2026-03-13T09:02:00.000Z",
    scope: {
      channelIds: [
        "14e40450-71c2-4e0e-a160-b787d21843fd",
        "f3d0fbec-f8a0-40ad-8e19-2370c6b99083",
      ],
    },
    rows: [
      {
        id: "28ada809-e597-483e-9a7f-f568fc2f80dd",
        channelId: "14e40450-71c2-4e0e-a160-b787d21843fd",
        contactEmail: "creator@example.com",
        status: "pushed",
        hubspotObjectId: "hubspot-contact-1",
        errorMessage: null,
        createdAt: "2026-03-13T09:00:00.000Z",
        updatedAt: "2026-03-13T09:01:00.000Z",
      },
      {
        id: "7399dc95-9ab0-4526-abfa-5da78000b3ab",
        channelId: "f3d0fbec-f8a0-40ad-8e19-2370c6b99083",
        contactEmail: null,
        status: "failed",
        hubspotObjectId: null,
        errorMessage: "Channel has no contact email",
        createdAt: "2026-03-13T09:00:00.000Z",
        updatedAt: "2026-03-13T09:01:00.000Z",
      },
    ],
    ...overrides,
  };
}

function renderView(requestState: Parameters<typeof HubspotPushBatchResultShellView>[0]["requestState"]) {
  return renderToStaticMarkup(
    createElement(HubspotPushBatchResultShellView, {
      batchId: "fdd240f2-ef31-43fe-b1d2-a584951654a8",
      isRefreshing: true,
      onRetry: () => undefined,
      requestState,
    }),
  );
}

describe("hubspot push batch result shell", () => {
  it("formats status labels and polls only active batch states", () => {
    expect(formatHubspotPushBatchResultStatusLabel("queued")).toBe("Queued");
    expect(formatHubspotPushBatchResultStatusLabel("pending")).toBe("Pending");
    expect(shouldPollHubspotPushBatchResult(buildDetail({ status: "running" }))).toBe(true);
    expect(shouldPollHubspotPushBatchResult(buildDetail({ status: "failed" }))).toBe(false);
  });

  it("maps session errors to actionable detail copy", () => {
    expect(
      getHubspotPushBatchDetailRequestErrorMessage(
        new HubspotPushBatchesApiError("Forbidden", 403),
      ),
    ).toBe(
      "Your session does not allow access to this HubSpot push batch anymore. Sign in again and retry.",
    );
  });

  it("renders loading and not-found states", () => {
    const loadingHtml = renderView({
      requestState: "loading",
      data: null,
      error: null,
    });
    const notFoundHtml = renderView({
      requestState: "notFound",
      data: null,
      error: null,
    });

    expect(loadingHtml).toContain("Loading HubSpot push batch");
    expect(notFoundHtml).toContain("HubSpot push batch not found");
  });

  it("renders row outcomes, stored scope, and result actions", () => {
    const html = renderView({
      requestState: "ready",
      data: buildDetail(),
      error: "Temporary refresh error",
    });

    expect(html).toContain("The push completed and the stored per-row outcomes are ready for review.");
    expect(html).toContain("Refreshing batch result...");
    expect(html).toContain("Batch summary");
    expect(html).toContain("View selected channel IDs");
    expect(html).toContain("hubspot-contact-1");
    expect(html).toContain("Channel has no contact email");
    expect(html).toContain("Last refresh failed: Temporary refresh error");
    expect(html).toContain(
      'href="/hubspot?batchId=fdd240f2-ef31-43fe-b1d2-a584951654a8"',
    );
    expect(html).toContain('href="/catalog"');
  });
});
