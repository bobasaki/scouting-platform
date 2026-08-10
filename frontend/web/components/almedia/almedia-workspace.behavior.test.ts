import type {
  AlmediaBookingsResponse,
  AlmediaCampaignsResponse,
  AlmediaDealsResponse,
  AlmediaScorecardResponse,
} from "@scouting-platform/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  useEffectMock,
  useStateMock,
  fetchAlmediaDealsMock,
  fetchAlmediaCampaignsMock,
  fetchAlmediaScorecardMock,
  fetchAlmediaBookingsMock,
  requestAlmediaSyncMock,
  isDocumentVisibleRef,
  searchParamsRef,
} = vi.hoisted(() => ({
  useEffectMock: vi.fn(),
  useStateMock: vi.fn(),
  fetchAlmediaDealsMock: vi.fn(),
  fetchAlmediaCampaignsMock: vi.fn(),
  fetchAlmediaScorecardMock: vi.fn(),
  fetchAlmediaBookingsMock: vi.fn(),
  requestAlmediaSyncMock: vi.fn(),
  isDocumentVisibleRef: { current: true },
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock("next/link", () => ({
  default: "a",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/almedia",
  useSearchParams: () => searchParamsRef.current,
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useEffect: useEffectMock,
    useState: useStateMock,
    useCallback: (callback: unknown) => callback,
  };
});

vi.mock("../../lib/almedia-api", () => ({
  fetchAlmediaDeals: fetchAlmediaDealsMock,
  fetchAlmediaCampaigns: fetchAlmediaCampaignsMock,
  fetchAlmediaScorecard: fetchAlmediaScorecardMock,
  fetchAlmediaBookings: fetchAlmediaBookingsMock,
  requestAlmediaSync: requestAlmediaSyncMock,
}));

vi.mock("../../lib/document-visibility", () => ({
  useDocumentVisibility: () => isDocumentVisibleRef.current,
}));

vi.mock("./almedia-insights-tab", () => ({
  AlmediaInsightsTab: () => null,
}));

vi.mock("./almedia-performance-tab", () => ({
  AlmediaPerformanceTab: () => null,
}));

vi.mock("./almedia-scorecard-tab", () => ({
  AlmediaScorecardTab: () => null,
}));

vi.mock("./almedia-bookings-tab", () => ({
  AlmediaBookingsTab: () => null,
}));

import { ALMEDIA_POLL_INTERVAL_MS, AlmediaWorkspace } from "./almedia-workspace";

const SYNC: AlmediaDealsResponse["sync"] = {
  status: "completed",
  agency: "arch",
  campaignCount: 2,
  syncedAt: "2026-08-10T10:00:00.000Z",
  startedAt: "2026-08-10T09:59:00.000Z",
  completedAt: "2026-08-10T10:00:00.000Z",
  lastError: null,
};

const DEALS: AlmediaDealsResponse = {
  deals: [],
  options: {
    cm: [],
    country: [],
    vertical: [],
    category: [],
    platform: [],
    sizeTier: [],
    status: [],
    month: [],
  },
  sync: SYNC,
};

const CAMPAIGNS: AlmediaCampaignsResponse = { campaigns: [], sync: SYNC };

const SCORECARD: AlmediaScorecardResponse = {
  months: [],
  rows: [],
  unscheduledCount: 0,
};

const BOOKINGS: AlmediaBookingsResponse = { bookings: [] };

type WorkspaceState = {
  requestState: Parameters<typeof useStateMock>[0];
  reloadToken: number;
  isRefreshing: boolean;
  syncError: string | null;
};

function renderWorkspace(
  options?: Partial<WorkspaceState> & { runEffects?: boolean },
) {
  const setters = {
    setRequestState: vi.fn(),
    setReloadToken: vi.fn(),
    setIsRefreshing: vi.fn(),
    setSyncError: vi.fn(),
  };
  const cleanups: Array<() => void> = [];

  useStateMock.mockReset();
  useEffectMock.mockReset();
  useStateMock
    .mockReturnValueOnce([
      options?.requestState ?? { status: "loading", data: null, error: null },
      setters.setRequestState,
    ])
    .mockReturnValueOnce([options?.reloadToken ?? 0, setters.setReloadToken])
    .mockReturnValueOnce([options?.isRefreshing ?? false, setters.setIsRefreshing])
    .mockReturnValueOnce([options?.syncError ?? null, setters.setSyncError]);
  useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
    if (options?.runEffects === false) {
      return;
    }

    const cleanup = effect();

    if (typeof cleanup === "function") {
      cleanups.push(cleanup);
    }
  });

  const element = AlmediaWorkspace();

  return { cleanups, element, setters };
}

describe("almedia workspace behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    isDocumentVisibleRef.current = true;
    searchParamsRef.current = new URLSearchParams();
    fetchAlmediaDealsMock.mockResolvedValue(DEALS);
    fetchAlmediaCampaignsMock.mockResolvedValue(CAMPAIGNS);
    fetchAlmediaScorecardMock.mockResolvedValue(SCORECARD);
    fetchAlmediaBookingsMock.mockResolvedValue(BOOKINGS);
    requestAlmediaSyncMock.mockResolvedValue({
      runId: "0f6c2e2c-1f5f-4d7a-9b1a-6b6b2d3f7c11",
    });
  });

  it("loads the four read models together on mount", async () => {
    const { setters } = renderWorkspace();

    expect(fetchAlmediaDealsMock).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(fetchAlmediaCampaignsMock).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(fetchAlmediaScorecardMock).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(fetchAlmediaBookingsMock).toHaveBeenCalledWith(expect.any(AbortSignal));

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setters.setRequestState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "ready", error: null }),
    );
  });

  it("surfaces a load failure as an error state", async () => {
    fetchAlmediaDealsMock.mockRejectedValueOnce(
      new Error("You are not authorized to view Almedia tracking."),
    );

    const { setters } = renderWorkspace();

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setters.setRequestState).toHaveBeenCalledWith({
      status: "error",
      data: null,
      error: "You are not authorized to view Almedia tracking.",
    });
  });

  it("schedules the next poll only while the document is visible", async () => {
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(() => 1 as unknown as ReturnType<typeof setTimeout>);

    renderWorkspace();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setTimeoutSpy).toHaveBeenCalledWith(
      expect.any(Function),
      ALMEDIA_POLL_INTERVAL_MS,
    );

    setTimeoutSpy.mockClear();
    isDocumentVisibleRef.current = false;

    renderWorkspace();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });

  it("aborts the in-flight request when the effect is cleaned up", () => {
    const { cleanups } = renderWorkspace();

    expect(cleanups).toHaveLength(1);
    expect(() => {
      cleanups.forEach((cleanup) => {
        cleanup();
      });
    }).not.toThrow();
  });

  it("queues a sync and reloads when Refresh is pressed", async () => {
    const { element, setters } = renderWorkspace({ runEffects: false });

    const refreshButton = findRefreshButton(element);

    expect(refreshButton?.props.onClick).toBeTypeOf("function");
    refreshButton?.props.onClick?.();

    expect(setters.setIsRefreshing).toHaveBeenCalledWith(true);
    expect(requestAlmediaSyncMock).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(setters.setIsRefreshing).toHaveBeenCalledWith(false);
    expect(setters.setReloadToken).toHaveBeenCalledWith(expect.any(Function));
  });
});

type MinimalElement = {
  props: Record<string, unknown> & { children?: unknown; onClick?: () => void };
  type?: unknown;
};

function isElement(node: unknown): node is MinimalElement {
  return typeof node === "object" && node !== null && "props" in node;
}

/** Walk the returned tree for the header's Refresh button. */
function findRefreshButton(node: unknown): MinimalElement | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRefreshButton(child);

      if (found) {
        return found;
      }
    }

    return undefined;
  }

  if (!isElement(node)) {
    return undefined;
  }

  if (node.type === "button" && typeof node.props.onClick === "function") {
    return node;
  }

  const nested = Object.values(node.props);

  for (const value of nested) {
    const found = findRefreshButton(value);

    if (found) {
      return found;
    }
  }

  return undefined;
}
