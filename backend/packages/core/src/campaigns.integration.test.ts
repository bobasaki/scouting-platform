import { PrismaClient, Role, RunMonth, UserType } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { COUNTRY_REGION_OPTIONS } from "@scouting-platform/contracts";

const databaseUrl = process.env.DATABASE_URL_TEST?.trim() ?? "";
const integration = databaseUrl ? describe.sequential : describe.skip;

type CampaignsModule = typeof import("./campaigns");

integration("campaigns core integration", () => {
  let prisma: PrismaClient;
  let campaigns: CampaignsModule;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;

    const { createPrismaClient } = await import("@scouting-platform/db");
    prisma = createPrismaClient({
      databaseUrl,
    });

    await prisma.$connect();
  });

  beforeEach(async () => {
    process.env.DATABASE_URL = databaseUrl;
    vi.resetModules();

    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        campaigns,
        markets,
        clients,
        audit_events,
        user_provider_credentials,
        sessions,
        accounts,
        verification_tokens,
        users
      RESTART IDENTITY CASCADE
    `);

    const db = await import("@scouting-platform/db");
    await db.resetPrismaClientForTests();
    campaigns = await import("./campaigns");
  });

  afterEach(async () => {
    vi.resetModules();
    const db = await import("@scouting-platform/db");
    await db.resetPrismaClientForTests();
  });

  afterAll(async () => {
    vi.resetModules();
    const db = await import("@scouting-platform/db");
    await db.resetPrismaClientForTests();
    await prisma.$disconnect();
  });

  it("hydrates market reference options during campaign listing when the table starts empty", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin",
        role: Role.ADMIN,
        userType: UserType.ADMIN,
        passwordHash: "bootstrap-hash",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    const result = await campaigns.listCampaigns({
      userId: admin.id,
    });

    const marketNames = result.filterOptions.markets.map((market) => market.name);

    expect(marketNames).toHaveLength(COUNTRY_REGION_OPTIONS.length);
    expect(marketNames).toEqual(expect.arrayContaining([...COUNTRY_REGION_OPTIONS]));

    const marketCount = await prisma.market.count();
    expect(marketCount).toBe(COUNTRY_REGION_OPTIONS.length);
  });

  it("updates and deletes local clients and campaigns with audit events", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin",
        role: Role.ADMIN,
        userType: UserType.ADMIN,
        passwordHash: "bootstrap-hash",
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    const client = await prisma.client.create({
      data: {
        name: "Old Client",
        domain: "old.example",
        countryRegion: "Croatia",
        city: "Zagreb",
      },
      select: {
        id: true,
      },
    });
    const market = await prisma.market.create({
      data: {
        name: "Local Market",
      },
      select: {
        id: true,
      },
    });
    const campaign = await prisma.campaign.create({
      data: {
        name: "Old Campaign",
        clientId: client.id,
        marketId: market.id,
        month: RunMonth.APRIL,
        year: 2026,
        createdByUserId: admin.id,
      },
      select: {
        id: true,
      },
    });

    const updatedClient = await campaigns.updateClient({
      userId: admin.id,
      clientId: client.id,
      name: "New Client",
      domain: "new.example",
      countryRegion: "Croatia",
      city: "Split",
      isActive: false,
    });
    expect(updatedClient.name).toBe("New Client");
    expect(updatedClient.isActive).toBe(false);

    const updatedCampaign = await campaigns.updateCampaign({
      userId: admin.id,
      campaignId: campaign.id,
      name: "New Campaign",
      clientId: client.id,
      marketId: market.id,
      month: "may",
      year: 2027,
      isActive: false,
    });
    expect(updatedCampaign.name).toBe("New Campaign");
    expect(updatedCampaign.month).toBe("may");
    expect(updatedCampaign.isActive).toBe(false);

    await campaigns.deleteCampaign({
      userId: admin.id,
      campaignId: campaign.id,
    });
    await campaigns.deleteClient({
      userId: admin.id,
      clientId: client.id,
    });

    expect(await prisma.campaign.count()).toBe(0);
    expect(await prisma.client.count()).toBe(0);

    const auditActions = await prisma.auditEvent.findMany({
      orderBy: {
        createdAt: "asc",
      },
      select: {
        action: true,
      },
    });
    expect(auditActions.map((event) => event.action)).toEqual([
      "client.updated",
      "campaign.updated",
      "campaign.deleted",
      "client.deleted",
    ]);
  });

  it("blocks local edits and deletes for HubSpot-synced records", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin",
        role: Role.ADMIN,
        userType: UserType.ADMIN,
        passwordHash: "bootstrap-hash",
        isActive: true,
      },
      select: {
        id: true,
      },
    });
    const client = await prisma.client.create({
      data: {
        name: "HubSpot Client",
        countryRegion: "Croatia",
        city: "Zagreb",
        hubspotObjectId: "101",
        hubspotObjectType: "2-CLIENT",
      },
      select: {
        id: true,
      },
    });
    const campaign = await prisma.campaign.create({
      data: {
        name: "HubSpot Campaign",
        clientId: client.id,
        month: RunMonth.APRIL,
        year: 2026,
        hubspotObjectId: "201",
        hubspotObjectType: "2-CAMPAIGN",
      },
      select: {
        id: true,
      },
    });

    await expect(
      campaigns.updateClient({
        userId: admin.id,
        clientId: client.id,
        name: "Changed",
        countryRegion: "Croatia",
        city: "Split",
        isActive: true,
      }),
    ).rejects.toMatchObject({
      code: "CLIENT_HUBSPOT_SYNCED",
      status: 409,
    });
    await expect(
      campaigns.deleteClient({
        userId: admin.id,
        clientId: client.id,
      }),
    ).rejects.toMatchObject({
      code: "CLIENT_HUBSPOT_SYNCED",
      status: 409,
    });
    await expect(
      campaigns.updateCampaign({
        userId: admin.id,
        campaignId: campaign.id,
        name: "Changed",
        clientId: client.id,
        month: "april",
        year: 2026,
        isActive: true,
      }),
    ).rejects.toMatchObject({
      code: "CAMPAIGN_HUBSPOT_SYNCED",
      status: 409,
    });
    await expect(
      campaigns.deleteCampaign({
        userId: admin.id,
        campaignId: campaign.id,
      }),
    ).rejects.toMatchObject({
      code: "CAMPAIGN_HUBSPOT_SYNCED",
      status: 409,
    });
  });
});
