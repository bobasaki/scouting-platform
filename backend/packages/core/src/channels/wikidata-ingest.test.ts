import { ChannelCountrySource } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

type ExistingChannel = {
  id: string;
  youtubeChannelId: string;
  countryRegion: string | null;
};

const {
  listDropdownOptionsMock,
  findManyMock,
  createManyMock,
  updateManyMock,
  recordAuditEventMock,
} = vi.hoisted(() => ({
  listDropdownOptionsMock: vi.fn(),
  findManyMock: vi.fn(),
  createManyMock: vi.fn(),
  updateManyMock: vi.fn(),
  recordAuditEventMock: vi.fn(),
}));

vi.mock("@scouting-platform/db", () => ({
  withDbTransaction: (callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      channel: {
        findMany: findManyMock,
        createMany: createManyMock,
        updateMany: updateManyMock,
      },
    }),
}));

vi.mock("../dropdown-values", () => ({
  listDropdownOptions: listDropdownOptionsMock,
}));

vi.mock("../audit", () => ({
  recordAuditEvent: recordAuditEventMock,
}));

import { ingestWikidataChannels } from "./wikidata-ingest";

// A syntactically valid canonical channel id (UC + 22 url-safe chars).
function channelId(suffix: string): string {
  return `UC${suffix.padEnd(22, "0").slice(0, 22)}`;
}

function firstCreateManyData(): Array<Record<string, unknown>> {
  const call = createManyMock.mock.calls[0];
  if (!call) {
    throw new Error("createMany was not called");
  }
  return (call[0] as { data: Array<Record<string, unknown>> }).data;
}

function firstUpdateManyArg(): {
  where: { id: string; countryRegion: null };
  data: Record<string, unknown>;
} {
  const call = updateManyMock.mock.calls[0];
  if (!call) {
    throw new Error("updateMany was not called");
  }
  return call[0] as { where: { id: string; countryRegion: null }; data: Record<string, unknown> };
}

const CROATIA = channelId("croatia");
const GERMANY = channelId("germany");
const UNKNOWN = channelId("unknown");

beforeEach(() => {
  vi.clearAllMocks();
  listDropdownOptionsMock.mockResolvedValue({ countryRegion: ["Croatia", "Germany"] });
  findManyMock.mockResolvedValue([] as ExistingChannel[]);
  createManyMock.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
  updateManyMock.mockResolvedValue({ count: 1 });
  recordAuditEventMock.mockResolvedValue(undefined);
});

describe("ingestWikidataChannels", () => {
  it("creates new channels with the label as provisional title and resolved country", async () => {
    const result = await ingestWikidataChannels({
      channels: [{ youtubeChannelId: CROATIA, label: "Zagreb Creator", countries: ["HR"] }],
    });

    expect(createManyMock).toHaveBeenCalledTimes(1);
    const created = firstCreateManyData();
    expect(created).toEqual([
      {
        youtubeChannelId: CROATIA,
        title: "Zagreb Creator",
        youtubeUrl: `https://www.youtube.com/channel/${CROATIA}`,
        countryRegion: "Croatia",
        countryRegionSource: ChannelCountrySource.WIKIDATA,
      },
    ]);
    expect(result).toEqual({ received: 1, created: 1, updated: 0, skipped: 0 });
  });

  it("falls back to the channel id as title and null country when nothing resolves", async () => {
    const result = await ingestWikidataChannels({
      channels: [{ youtubeChannelId: UNKNOWN, label: "", countries: ["ZZ"] }],
    });

    const created = firstCreateManyData();
    expect(created[0]).toMatchObject({
      title: UNKNOWN,
      countryRegion: null,
      countryRegionSource: null,
    });
    expect(result.created).toBe(1);
  });

  it("backfills a missing country on an existing channel without touching other fields", async () => {
    findManyMock.mockResolvedValue([
      { id: "row-1", youtubeChannelId: GERMANY, countryRegion: null },
    ]);

    const result = await ingestWikidataChannels({
      channels: [{ youtubeChannelId: GERMANY, label: "Berlin Gaming", countries: ["DE"] }],
    });

    expect(createManyMock).not.toHaveBeenCalled();
    // Atomic guard: the WHERE clause requires countryRegion still null.
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { id: "row-1", countryRegion: null },
      data: { countryRegion: "Germany", countryRegionSource: ChannelCountrySource.WIKIDATA },
    });
    // No title/description/thumbnail in the update payload.
    expect(firstUpdateManyArg().data).not.toHaveProperty("title");
    expect(result).toEqual({ received: 1, created: 0, updated: 1, skipped: 0 });
  });

  it("skips existing channels that already have a country (idempotent re-ingest)", async () => {
    findManyMock.mockResolvedValue([
      { id: "row-1", youtubeChannelId: GERMANY, countryRegion: "Germany" },
    ]);

    const result = await ingestWikidataChannels({
      channels: [{ youtubeChannelId: GERMANY, label: "Berlin Gaming", countries: ["DE"] }],
    });

    expect(updateManyMock).not.toHaveBeenCalled();
    expect(createManyMock).not.toHaveBeenCalled();
    expect(result).toEqual({ received: 1, created: 0, updated: 0, skipped: 1 });
  });

  it("counts a lost backfill race as skipped, not updated", async () => {
    findManyMock.mockResolvedValue([
      { id: "row-1", youtubeChannelId: GERMANY, countryRegion: null },
    ]);
    updateManyMock.mockResolvedValue({ count: 0 }); // another source filled it first

    const result = await ingestWikidataChannels({
      channels: [{ youtubeChannelId: GERMANY, label: "Berlin Gaming", countries: ["DE"] }],
    });

    expect(result).toEqual({ received: 1, created: 0, updated: 0, skipped: 1 });
  });

  it("records an audit event with the batch tallies", async () => {
    await ingestWikidataChannels({
      channels: [{ youtubeChannelId: CROATIA, label: "Zagreb Creator", countries: ["HR"] }],
    });

    expect(recordAuditEventMock).toHaveBeenCalledTimes(1);
    const [auditInput] = recordAuditEventMock.mock.calls[0] ?? [];
    expect(auditInput).toMatchObject({
      actorUserId: null,
      action: "discovery.wikidata.ingest",
      metadata: { received: 1, created: 1, updated: 0, skipped: 0 },
    });
  });

  it("merges within-batch duplicates and counts the collapsed rows as skipped", async () => {
    const result = await ingestWikidataChannels({
      channels: [
        { youtubeChannelId: CROATIA, label: "Zagreb Creator", countries: ["HR"] },
        { youtubeChannelId: CROATIA, label: "", countries: ["DE"] },
      ],
    });

    // One unique channel created; the duplicate is skipped. Tallies sum to received.
    expect(firstCreateManyData()).toHaveLength(1);
    expect(result).toEqual({ received: 2, created: 1, updated: 0, skipped: 1 });
  });

  it("counts rows lost to a concurrent insert as skipped, not created", async () => {
    createManyMock.mockResolvedValue({ count: 0 }); // another writer won the race

    const result = await ingestWikidataChannels({
      channels: [{ youtubeChannelId: CROATIA, label: "Zagreb Creator", countries: ["HR"] }],
    });

    expect(result).toEqual({ received: 1, created: 0, updated: 0, skipped: 1 });
  });
});
