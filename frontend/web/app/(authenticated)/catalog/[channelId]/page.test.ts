import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStringAsync } from "../../../../lib/test-render";

const { getSessionMock, channelDetailShellMock, getChannelByIdMock, getDropdownValuesMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  channelDetailShellMock: vi.fn(
    ({
      channelId,
      canManageManualEdits,
      countryRegionOptions,
      initialData,
    }: {
      channelId: string;
      canManageManualEdits?: boolean;
      countryRegionOptions?: readonly string[];
      initialData?: unknown;
    }) => `channel-detail-shell:${channelId}:${String(canManageManualEdits)}:${countryRegionOptions?.join(",")}:${initialData ? "with-data" : "no-data"}`,
  ),
  getChannelByIdMock: vi.fn(async () => ({ id: "channel-123" })),
  getDropdownValuesMock: vi.fn(async () => ({
    items: [
      { fieldKey: "countryRegion", value: "Croatia" },
      { fieldKey: "language", value: "Croatian" },
    ],
  })),
}));

vi.mock("../../../../lib/cached-auth", () => ({
  getSession: getSessionMock,
}));

vi.mock("../../../../lib/cached-data", () => ({
  getCachedChannelById: getChannelByIdMock,
  getCachedDropdownValues: getDropdownValuesMock,
}));

vi.mock("../../../../components/catalog/channel-detail-shell", () => ({
  ChannelDetailShell: channelDetailShellMock,
}));

import CatalogChannelDetailPage from "./page";

describe("catalog channel detail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      user: {
        id: "e3cda197-465d-4483-bad8-4b20df7df098",
        role: "admin",
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the channel detail shell from route params without fetching detail data in the page", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const html = await renderToStringAsync(
      await CatalogChannelDetailPage({
        params: Promise.resolve({ channelId: "channel-123" }),
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(channelDetailShellMock).toHaveBeenCalledTimes(1);
    expect(channelDetailShellMock.mock.calls[0]?.[0]).toEqual({
      channelId: "channel-123",
      canManageManualEdits: true,
      countryRegionOptions: ["Croatia"],
      initialData: { id: "channel-123" },
    });
    expect(html).toContain("Channel Detail");
    expect(html).toContain('href="/catalog"');
    expect(html).toContain("channel-detail-shell:channel-123:true:Croatia:with-data");
  });

  it("only enables manual edit controls for admins", async () => {
    getSessionMock.mockResolvedValueOnce({
      user: {
        id: "e3cda197-465d-4483-bad8-4b20df7df098",
        role: "user",
      },
    });

    const html = await renderToStringAsync(
      await CatalogChannelDetailPage({
        params: Promise.resolve({ channelId: "channel-123" }),
      }),
    );

    expect(channelDetailShellMock.mock.calls[0]?.[0]).toEqual({
      channelId: "channel-123",
      canManageManualEdits: false,
      countryRegionOptions: ["Croatia"],
      initialData: { id: "channel-123" },
    });
    expect(html).toContain("channel-detail-shell:channel-123:false:Croatia:with-data");
  });
});
