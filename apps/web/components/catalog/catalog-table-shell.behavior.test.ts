import type { ListChannelsResponse } from "@scouting-platform/contracts";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchChannelsMock,
  replaceMock,
  useEffectMock,
  usePathnameMock,
  useRouterMock,
  useSearchParamsMock,
  useStateMock,
} = vi.hoisted(() => ({
  fetchChannelsMock: vi.fn(),
  replaceMock: vi.fn(),
  useEffectMock: vi.fn(),
  usePathnameMock: vi.fn(),
  useRouterMock: vi.fn(),
  useSearchParamsMock: vi.fn(),
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

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
  useRouter: useRouterMock,
  useSearchParams: useSearchParamsMock,
}));

vi.mock("../../lib/channels-api", () => ({
  fetchChannels: fetchChannelsMock,
}));

import { CatalogTableShell } from "./catalog-table-shell";

type CatalogShellElement = ReactElement<{
  onApplyFilters: () => void;
  onResetFilters: () => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRetry: () => void;
  onDraftQueryChange: (value: string) => void;
  onToggleEnrichmentStatus: (value: "completed" | "failed") => void;
  draftFilters: {
    query: string;
    enrichmentStatus: string[];
    advancedReportStatus: string[];
  };
  requestState: {
    status: "loading" | "error" | "ready";
  };
  hasPendingFilterChanges: boolean;
}>;

function createReadyState(overrides: Partial<ListChannelsResponse>): {
  status: "ready";
  data: ListChannelsResponse;
  error: null;
} {
  return {
    status: "ready",
    data: {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      ...overrides,
    },
    error: null,
  };
}

function createSearchParams(
  input: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item);
      }
      continue;
    }

    if (value !== undefined) {
      searchParams.set(key, value);
    }
  }

  return searchParams;
}

function renderShell(options?: {
  requestState?: ReturnType<typeof createReadyState> | {
    status: "loading";
    data: null;
    error: null;
  } | {
    status: "error";
    data: null;
    error: string;
  };
  searchParams?: URLSearchParams;
  draftFilters?: {
    query: string;
    enrichmentStatus: string[];
    advancedReportStatus: string[];
  };
  reloadToken?: number;
}) {
  const setDraftFilters = vi.fn();
  const setRequestState = vi.fn();
  const setReloadToken = vi.fn();
  let cleanup: (() => void) | undefined;

  useStateMock.mockReset();
  useEffectMock.mockReset();
  replaceMock.mockReset();
  usePathnameMock.mockReturnValue("/catalog");
  useRouterMock.mockReturnValue({
    replace: replaceMock,
  });
  useSearchParamsMock.mockReturnValue(
    options?.searchParams ?? createSearchParams({ page: "2", query: "space", enrichmentStatus: ["failed"] }),
  );

  useStateMock
    .mockReturnValueOnce([
      options?.draftFilters ?? {
        query: "space",
        enrichmentStatus: ["failed"],
        advancedReportStatus: [],
      },
      setDraftFilters,
    ])
    .mockReturnValueOnce([
      options?.requestState ??
        createReadyState({
          total: 21,
          page: 2,
          pageSize: 20,
        }),
      setRequestState,
    ])
    .mockReturnValueOnce([options?.reloadToken ?? 0, setReloadToken]);

  useEffectMock.mockImplementation((effect: () => void | (() => void)) => {
    const maybeCleanup = effect();
    cleanup = typeof maybeCleanup === "function" ? maybeCleanup : undefined;
  });

  const element = CatalogTableShell({}) as CatalogShellElement;

  return {
    cleanup,
    element,
    setDraftFilters,
    setRequestState,
    setReloadToken,
  };
}

describe("catalog table shell behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchChannelsMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    } satisfies ListChannelsResponse);
  });

  it("loads the current URL-backed page and filters from the channels API", async () => {
    const response: ListChannelsResponse = {
      items: [],
      total: 1,
      page: 2,
      pageSize: 20,
    };

    fetchChannelsMock.mockResolvedValueOnce(response);

    const { cleanup, setDraftFilters, setRequestState } = renderShell();

    expect(setDraftFilters).toHaveBeenCalledWith({
      query: "space",
      enrichmentStatus: ["failed"],
      advancedReportStatus: [],
    });
    expect(fetchChannelsMock).toHaveBeenCalledWith(
      {
        page: 2,
        pageSize: 20,
        query: "space",
        enrichmentStatus: ["failed"],
      },
      expect.any(AbortSignal),
    );
    expect(setRequestState).toHaveBeenNthCalledWith(1, {
      status: "loading",
      data: null,
      error: null,
    });

    await Promise.resolve();

    expect(setRequestState).toHaveBeenNthCalledWith(2, {
      status: "ready",
      data: response,
      error: null,
    });

    const signal = fetchChannelsMock.mock.calls[0]?.[1] as AbortSignal | undefined;
    expect(signal?.aborted).toBe(false);

    cleanup?.();

    expect(signal?.aborted).toBe(true);
  });

  it("applies draft filters by replacing the URL and resetting to page 1", () => {
    const { element } = renderShell({
      draftFilters: {
        query: "mars",
        enrichmentStatus: ["completed"],
        advancedReportStatus: ["pending_approval"],
      },
    });

    element.props.onApplyFilters();

    expect(replaceMock).toHaveBeenCalledWith(
      "/catalog?page=1&query=mars&enrichmentStatus=completed&advancedReportStatus=pending_approval",
    );
  });

  it("resets filters by clearing draft state and replacing the URL", () => {
    const { element, setDraftFilters } = renderShell();

    element.props.onResetFilters();

    expect(setDraftFilters).toHaveBeenCalledWith({
      query: "",
      enrichmentStatus: [],
      advancedReportStatus: [],
    });
    expect(replaceMock).toHaveBeenCalledWith("/catalog?page=1");
  });

  it("preserves active filters while paging forward and backward", () => {
    const first = renderShell({
      searchParams: createSearchParams({ page: "1", query: "space", enrichmentStatus: ["failed"] }),
      requestState: createReadyState({
        total: 21,
        page: 1,
        pageSize: 20,
      }),
    });
    first.element.props.onNextPage();

    expect(replaceMock).toHaveBeenCalledWith("/catalog?page=2&query=space&enrichmentStatus=failed");

    replaceMock.mockReset();

    const second = renderShell({
      searchParams: createSearchParams({ page: "2", query: "space", enrichmentStatus: ["failed"] }),
      requestState: createReadyState({
        total: 21,
        page: 2,
        pageSize: 20,
      }),
    });
    second.element.props.onPreviousPage();

    expect(replaceMock).toHaveBeenCalledWith("/catalog?page=1&query=space&enrichmentStatus=failed");
  });

  it("retries the current page by bumping the reload token", () => {
    const { element, setReloadToken } = renderShell({
      requestState: {
        status: "error",
        data: null,
        error: "Unable to load channels. Please try again.",
      },
    });

    element.props.onRetry();

    expect(setReloadToken).toHaveBeenCalledTimes(1);

    const updateReloadToken = setReloadToken.mock.calls[0]?.[0] as ((current: number) => number) | undefined;
    expect(updateReloadToken?.(0)).toBe(1);
  });
});
