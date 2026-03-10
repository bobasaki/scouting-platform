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

import { RecentRunsShellView, getRecentRunProgressMessage, hasActiveRecentRuns } from "./recent-runs-shell";

function buildRun(
  status: "queued" | "running" | "completed" | "failed",
  overrides?: Partial<{
    id: string;
    name: string;
    query: string;
    lastError: string | null;
    completedAt: string | null;
    resultCount: number;
  }>,
) {
  return {
    id: overrides?.id ?? `53adac17-f39d-4731-a61f-194150fbc43${status.length}`,
    name: overrides?.name ?? `${status} run`,
    query: overrides?.query ?? `${status} creators`,
    status,
    lastError: overrides?.lastError ?? null,
    createdAt: "2026-03-10T10:00:00.000Z",
    updatedAt: "2026-03-10T10:02:00.000Z",
    startedAt: "2026-03-10T10:01:00.000Z",
    completedAt:
      overrides?.completedAt ??
      (status === "completed" || status === "failed" ? "2026-03-10T10:03:00.000Z" : null),
    resultCount: overrides?.resultCount ?? (status === "completed" ? 2 : 0),
  } as const;
}

function renderView(requestState: Parameters<typeof RecentRunsShellView>[0]["requestState"]) {
  return renderToStaticMarkup(
    createElement(RecentRunsShellView, {
      onRetry: () => undefined,
      requestState,
    }),
  );
}

describe("recent runs shell", () => {
  it("detects when recent runs should keep polling", () => {
    expect(hasActiveRecentRuns([buildRun("queued")])).toBe(true);
    expect(hasActiveRecentRuns([buildRun("running")])).toBe(true);
    expect(hasActiveRecentRuns([buildRun("completed")])).toBe(false);
  });

  it("maps failed and completed states to actionable copy", () => {
    expect(
      getRecentRunProgressMessage(buildRun("failed", { lastError: "YouTube API quota exceeded" })),
    ).toBe(
      "YouTube API quota was exhausted before discovery completed. Retry later or ask an admin to rotate the assigned key.",
    );
    expect(getRecentRunProgressMessage(buildRun("completed", { resultCount: 0 }))).toBe(
      "Discovery completed without saving any matching channels in the snapshot.",
    );
  });

  it("renders loading and error states", () => {
    const loadingHtml = renderView({
      status: "loading",
      data: null,
      error: null,
    });
    const errorHtml = renderView({
      status: "error",
      data: null,
      error: "Unable to load recent runs. Please try again.",
    });

    expect(loadingHtml).toContain("Loading recent runs.");
    expect(errorHtml).toContain("Recent runs unavailable");
    expect(errorHtml).toContain('role="alert"');
  });

  it("renders empty and ready states with run detail links", () => {
    const emptyHtml = renderView({
      status: "ready",
      data: {
        items: [],
      },
      error: null,
    });
    const readyHtml = renderView({
      status: "ready",
      data: {
        items: [
          buildRun("running", { id: "run-running", name: "Running Run", resultCount: 1 }),
          buildRun("completed", { id: "run-completed", name: "Completed Run", resultCount: 3 }),
          buildRun("failed", {
            id: "run-failed",
            name: "Failed Run",
            lastError: "Assigned YouTube API key is required before creating a run",
          }),
        ],
      },
      error: null,
    });

    expect(emptyHtml).toContain("No runs yet. Create a scouting run above to start building snapshot history.");
    expect(readyHtml).toContain("Recent runs");
    expect(readyHtml).toContain("Running Run");
    expect(readyHtml).toContain("Completed Run");
    expect(readyHtml).toContain("Failed Run");
    expect(readyHtml).toContain("This account needs an assigned YouTube API key before the worker can run discovery.");
    expect(readyHtml).toContain('href="/runs/run-completed"');
  });
});
