import type { HubspotPushBatchDetail } from "@scouting-platform/contracts";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchHubspotPushBatchDetailMock, useEffectMock, useStateMock } = vi.hoisted(() => ({
  fetchHubspotPushBatchDetailMock: vi.fn(),
  useEffectMock: vi.fn(),
  useStateMock: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useEffect: useEffectMock,
    useState: useStateMock,
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
  fetchHubspotPushBatchDetail: fetchHubspotPushBatchDetailMock,
}));

import { HubspotPushBatchesApiError } from "../../lib/hubspot-push-batches-api";
import {
  HUBSPOT_PUSH_BATCH_RESULT_POLL_INTERVAL_MS,
  HubspotPushBatchResultShell,
} from "./hubspot-push-batch-result-shell";

type HubspotPushBatchResultShellElement = ReactElement<{
  batchId: string;
  isRefreshing: boolean;
  onRetry: () => void;
  requestState: {
    requestState: "loading" | "error" | "notFound" | "ready";
    data: HubspotPushBatchDetail | null;
    error: string | null;
  };
}>;

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
    rows: [],
    ...overrides,
  };
}

function renderShell(options?: {
  requestState?: {
    requestState: "loading" | "error" | "notFound" | "ready";
    data: HubspotPushBatchDetail | null;
    error: string | null;
  };
  reloadToken?: number;
  isRefreshing?: boolean;
}) {
  const setRequestState = vi.fn();
  const setReloadToken = vi.fn();
  const setIsRefreshing = vi.fn();
  const cleanups: Array<() => void> = [];

  useStateMock.mockReset();
  useEffectMock.mockReset();
  useStateMock
    .mockReturnValueOnce([
      options?.requestState ?? {
        requestState: "loading" as const,
        data: null,
        error: null,
      },
      setRequestState,
    ])
    .mockReturnValueOnce([options?.reloadToken ?? 0, setReloadToken])
    .mockReturnValueOnce([options?.isRefreshing ?? false, setIsRefreshing]);
  useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
    const maybeCleanup = effect();

    if (typeof maybeCleanup === "function") {
      cleanups.push(maybeCleanup);
    }
  });

  const element = HubspotPushBatchResultShell({
    batchId: "fdd240f2-ef31-43fe-b1d2-a584951654a8",
  }) as HubspotPushBatchResultShellElement;

  return {
    cleanups,
    element,
    setIsRefreshing,
    setReloadToken,
    setRequestState,
  };
}

describe("hubspot push batch result shell behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads batch detail on mount and aborts the request on cleanup", async () => {
    fetchHubspotPushBatchDetailMock.mockResolvedValueOnce(buildDetail());

    const { cleanups, setRequestState } = renderShell();

    expect(setRequestState).toHaveBeenNthCalledWith(1, {
      requestState: "loading",
      data: null,
      error: null,
    });
    expect(fetchHubspotPushBatchDetailMock).toHaveBeenCalledWith(
      "fdd240f2-ef31-43fe-b1d2-a584951654a8",
      expect.any(AbortSignal),
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(setRequestState).toHaveBeenNthCalledWith(2, {
      requestState: "ready",
      data: buildDetail(),
      error: null,
    });

    const signal = fetchHubspotPushBatchDetailMock.mock.calls[0]?.[1] as
      | AbortSignal
      | undefined;

    cleanups.forEach((cleanup) => {
      cleanup();
    });

    expect(signal?.aborted).toBe(true);
  });

  it("marks the screen as not found when the batch no longer exists", async () => {
    fetchHubspotPushBatchDetailMock.mockRejectedValueOnce(
      new HubspotPushBatchesApiError("HubSpot push batch not found.", 404),
    );

    const { setRequestState } = renderShell();

    await Promise.resolve();
    await Promise.resolve();

    expect(setRequestState).toHaveBeenLastCalledWith({
      requestState: "notFound",
      data: null,
      error: null,
    });
  });

  it("schedules polling while queued or running work remains", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout").mockImplementation((handler) => {
      void handler();
      return 321 as unknown as ReturnType<typeof setTimeout>;
    });
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout").mockImplementation(() => undefined);

    fetchHubspotPushBatchDetailMock.mockResolvedValue(buildDetail({ status: "running" }));

    const { cleanups, setReloadToken } = renderShell({
      requestState: {
        requestState: "ready",
        data: buildDetail({ status: "running" }),
        error: null,
      },
      isRefreshing: false,
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      HUBSPOT_PUSH_BATCH_RESULT_POLL_INTERVAL_MS,
    );
    expect(setReloadToken).toHaveBeenCalledWith(expect.any(Function));

    cleanups.forEach((cleanup) => {
      cleanup();
    });

    expect(clearTimeoutSpy).toHaveBeenCalledWith(321);
  });

  it("keeps the current detail visible when a refresh fails", async () => {
    const detail = buildDetail();
    fetchHubspotPushBatchDetailMock.mockRejectedValueOnce(new Error("Detail down"));

    const { setIsRefreshing, setRequestState } = renderShell({
      requestState: {
        requestState: "ready",
        data: detail,
        error: null,
      },
      isRefreshing: false,
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(setIsRefreshing).toHaveBeenCalledWith(true);

    const updater = setRequestState.mock.calls.find((call) => typeof call[0] === "function")?.[0] as
      | ((current: {
          requestState: "loading" | "error" | "notFound" | "ready";
          data: HubspotPushBatchDetail | null;
          error: string | null;
        }) => {
          requestState: "loading" | "error" | "notFound" | "ready";
          data: HubspotPushBatchDetail | null;
          error: string | null;
        })
      | undefined;

    expect(
      updater?.({
        requestState: "ready",
        data: detail,
        error: null,
      }),
    ).toEqual({
      requestState: "ready",
      data: detail,
      error: "Detail down",
    });
  });
});
