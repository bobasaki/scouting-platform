import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    almediaVerticalOverride: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    auditEvent: { create: vi.fn() },
  },
}));

vi.mock("@scouting-platform/db", () => ({
  prisma: prismaMock,
  withDbTransaction: vi.fn(
    async (operation: (tx: typeof prismaMock) => Promise<unknown>) =>
      operation(prismaMock),
  ),
}));

import {
  loadAlmediaVerticalOverrides,
  setAlmediaCreatorVerticalOverride,
} from "./vertical-overrides";

describe("Almedia creator vertical overrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ role: Role.ADMIN });
    prismaMock.almediaVerticalOverride.findUnique.mockResolvedValue(null);
    prismaMock.almediaVerticalOverride.upsert.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      channelKey: "HAPPYMOM3",
      vertical: "Family",
    });
    prismaMock.auditEvent.create.mockResolvedValue({});
  });

  it("normalizes and saves a creator override without writing a booking", async () => {
    await expect(
      setAlmediaCreatorVerticalOverride({
        requestedByUserId: "22222222-2222-4222-8222-222222222222",
        channelKey: " happy-mom3 ",
        vertical: "Family",
      }),
    ).resolves.toEqual({ channelKey: "HAPPYMOM3", vertical: "Family" });

    expect(prismaMock.almediaVerticalOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channelKey: "HAPPYMOM3" },
        create: expect.objectContaining({ vertical: "Family" }),
      }),
    );
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "almedia.creator_vertical.updated",
        entityType: "almedia_creator_vertical_override",
      }),
    });
    expect(prismaMock).not.toHaveProperty("booking");
  });

  it("ignores invalid legacy values when loading the deal lookup", async () => {
    prismaMock.almediaVerticalOverride.findMany.mockResolvedValue([
      { channelKey: "HAPPYMOM3", vertical: "family" },
      { channelKey: "BROKEN", vertical: "not-a-vertical" },
    ]);

    const overrides = await loadAlmediaVerticalOverrides();

    expect([...overrides]).toEqual([["HAPPYMOM3", "Family"]]);
  });
});
