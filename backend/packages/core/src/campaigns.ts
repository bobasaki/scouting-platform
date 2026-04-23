import { Role, RunMonth, UserType, type Prisma } from "@prisma/client";
import type {
  CampaignSummary,
  ClientSummary,
  CreateCampaignRequest,
  CreateClientRequest,
  ListCampaignsQuery,
  ListCampaignsResponse,
  ListClientsQuery,
  UpdateCampaignRequest,
  UpdateClientRequest,
} from "@scouting-platform/contracts";
import {
  COUNTRY_REGION_OPTIONS as countryRegionOptions,
  createCampaignRequestSchema,
  createClientRequestSchema,
  listCampaignsQuerySchema,
  listClientsQuerySchema,
  updateCampaignRequestSchema,
  updateClientRequestSchema,
} from "@scouting-platform/contracts";
import { prisma, withDbTransaction } from "@scouting-platform/db";

import { fromPrismaRole, fromPrismaUserType } from "./auth/roles";
import { ServiceError } from "./errors";

const campaignSelect = {
  id: true,
  name: true,
  briefLink: true,
  month: true,
  year: true,
  isActive: true,
  hubspotObjectId: true,
  hubspotObjectType: true,
  hubspotArchived: true,
  hubspotSyncedAt: true,
  createdAt: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      name: true,
      domain: true,
      countryRegion: true,
      city: true,
      isActive: true,
      hubspotObjectId: true,
      hubspotObjectType: true,
      hubspotArchived: true,
      hubspotSyncedAt: true,
    },
  },
  market: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

function toRunMonthValue(value: string | null): CampaignSummary["month"] {
  return value ? (value.toLowerCase() as NonNullable<CampaignSummary["month"]>) : null;
}

function toClientSummary(
  client: {
    id: string;
    name: string;
    domain: string | null;
    countryRegion: string | null;
    city: string | null;
    isActive: boolean;
    hubspotObjectId: string | null;
    hubspotObjectType: string | null;
    hubspotArchived: boolean;
    hubspotSyncedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
): ClientSummary {
  return {
    id: client.id,
    name: client.name,
    domain: client.domain,
    countryRegion: client.countryRegion,
    city: client.city,
    isActive: client.isActive,
    hubspotObjectId: client.hubspotObjectId,
    hubspotObjectType: client.hubspotObjectType,
    hubspotArchived: client.hubspotArchived,
    hubspotSyncedAt: client.hubspotSyncedAt?.toISOString() ?? null,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

function toCampaignSummary(
  campaign: Prisma.CampaignGetPayload<{ select: typeof campaignSelect }>,
): CampaignSummary {
  return {
    id: campaign.id,
    name: campaign.name,
    client: campaign.client
      ? {
          id: campaign.client.id,
          name: campaign.client.name,
          domain: campaign.client.domain,
          countryRegion: campaign.client.countryRegion,
          city: campaign.client.city,
          isActive: campaign.client.isActive,
          hubspotObjectId: campaign.client.hubspotObjectId,
          hubspotObjectType: campaign.client.hubspotObjectType,
          hubspotArchived: campaign.client.hubspotArchived,
          hubspotSyncedAt: campaign.client.hubspotSyncedAt?.toISOString() ?? null,
        }
      : null,
    market: campaign.market,
    briefLink: campaign.briefLink,
    month: toRunMonthValue(campaign.month),
    year: campaign.year,
    isActive: campaign.isActive,
    hubspotObjectId: campaign.hubspotObjectId,
    hubspotObjectType: campaign.hubspotObjectType,
    hubspotArchived: campaign.hubspotArchived,
    hubspotSyncedAt: campaign.hubspotSyncedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

async function getRequestUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      userType: true,
    },
  });

  if (!user) {
    throw new ServiceError("USER_NOT_FOUND", 404, "User not found");
  }

  return user;
}

function canCreateCampaign(user: { role: Role; userType: UserType }): boolean {
  return (
    user.role === Role.ADMIN ||
    user.userType === UserType.CAMPAIGN_LEAD ||
    user.userType === UserType.HOC
  );
}

function canManageCampaignRecord(user: { role: Role; userType: UserType }): boolean {
  return canCreateCampaign(user);
}

function hasHubspotSyncMetadata(record: {
  hubspotObjectId: string | null;
  hubspotObjectType: string | null;
  hubspotSyncedAt: Date | null;
}): boolean {
  return Boolean(record.hubspotObjectId || record.hubspotObjectType || record.hubspotSyncedAt);
}

async function ensureMarketReferenceData() {
  await prisma.market.createMany({
    data: countryRegionOptions.map((name) => ({ name })),
    skipDuplicates: true,
  });
}

export async function listCampaigns(input: {
  userId: string;
  query?: Partial<ListCampaignsQuery>;
}): Promise<ListCampaignsResponse> {
  const parsedQuery = listCampaignsQuerySchema.partial().parse(input.query ?? {});

  await ensureMarketReferenceData();

  const where: Prisma.CampaignWhereInput = {
    ...(parsedQuery.clientId ? { clientId: parsedQuery.clientId } : {}),
    ...(parsedQuery.marketId ? { marketId: parsedQuery.marketId } : {}),
    ...(typeof parsedQuery.active === "boolean" ? { isActive: parsedQuery.active } : {}),
  };

  // Run all queries in parallel once market reference data is guaranteed to exist.
  const [requestUser, campaigns, clients, markets] = await Promise.all([
    getRequestUser(input.userId),
    prisma.campaign.findMany({
      where,
      select: campaignSelect,
      orderBy: [{ isActive: "desc" }, { year: "desc" }, { createdAt: "desc" }],
    }),
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.market.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    items: campaigns.map(toCampaignSummary),
    filterOptions: {
      clients,
      markets,
    },
    permissions: {
      canCreate: canCreateCampaign(requestUser),
      role: fromPrismaRole(requestUser.role),
      userType: fromPrismaUserType(requestUser.userType),
    },
  };
}

export async function createCampaign(input: CreateCampaignRequest & { userId: string }): Promise<CampaignSummary> {
  const requestUser = await getRequestUser(input.userId);

  if (!canManageCampaignRecord(requestUser)) {
    throw new ServiceError("CAMPAIGN_CREATE_FORBIDDEN", 403, "Forbidden");
  }

  const payload = createCampaignRequestSchema.parse(input);
  await ensureMarketReferenceData();

  const [client, market] = await Promise.all([
    prisma.client.findUnique({ where: { id: payload.clientId }, select: { id: true } }),
    payload.marketId
      ? prisma.market.findUnique({ where: { id: payload.marketId }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  if (!client || (payload.marketId && !market)) {
    throw new ServiceError("CAMPAIGN_REFERENCE_INVALID", 400, "Client or market not found");
  }

  const created = await withDbTransaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        name: payload.name.trim(),
        clientId: payload.clientId,
        marketId: payload.marketId ?? null,
        briefLink: payload.briefLink?.trim() || null,
        month: payload.month.toUpperCase() as RunMonth,
        year: payload.year,
        isActive: payload.isActive,
        createdByUserId: input.userId,
      },
      select: campaignSelect,
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: input.userId,
        action: "campaign.created",
        entityType: "campaign",
        entityId: campaign.id,
        metadata: {
          campaignName: campaign.name,
          clientId: campaign.client?.id ?? null,
          marketId: campaign.market?.id ?? null,
        },
      },
    });

    return campaign;
  });

  return toCampaignSummary(created);
}

export async function updateCampaign(
  input: UpdateCampaignRequest & { userId: string; campaignId: string },
): Promise<CampaignSummary> {
  const requestUser = await getRequestUser(input.userId);

  if (!canManageCampaignRecord(requestUser)) {
    throw new ServiceError("CAMPAIGN_UPDATE_FORBIDDEN", 403, "Forbidden");
  }

  const payload = updateCampaignRequestSchema.parse(input);
  await ensureMarketReferenceData();

  const existingCampaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: {
      id: true,
      name: true,
      hubspotObjectId: true,
      hubspotObjectType: true,
      hubspotSyncedAt: true,
    },
  });

  if (!existingCampaign) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", 404, "Campaign not found");
  }

  if (hasHubspotSyncMetadata(existingCampaign)) {
    throw new ServiceError(
      "CAMPAIGN_HUBSPOT_SYNCED",
      409,
      "HubSpot-synced campaigns cannot be edited locally",
    );
  }

  const [client, market] = await Promise.all([
    prisma.client.findUnique({ where: { id: payload.clientId }, select: { id: true } }),
    payload.marketId
      ? prisma.market.findUnique({ where: { id: payload.marketId }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  if (!client || (payload.marketId && !market)) {
    throw new ServiceError("CAMPAIGN_REFERENCE_INVALID", 400, "Client or market not found");
  }

  const updated = await withDbTransaction(async (tx) => {
    const campaign = await tx.campaign.update({
      where: { id: existingCampaign.id },
      data: {
        name: payload.name.trim(),
        clientId: payload.clientId,
        marketId: payload.marketId ?? null,
        briefLink: payload.briefLink?.trim() || null,
        month: payload.month.toUpperCase() as RunMonth,
        year: payload.year,
        isActive: payload.isActive,
      },
      select: campaignSelect,
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: input.userId,
        action: "campaign.updated",
        entityType: "campaign",
        entityId: campaign.id,
        metadata: {
          previousCampaignName: existingCampaign.name,
          campaignName: campaign.name,
          clientId: campaign.client?.id ?? null,
          marketId: campaign.market?.id ?? null,
        },
      },
    });

    return campaign;
  });

  return toCampaignSummary(updated);
}

export async function deleteCampaign(input: {
  userId: string;
  campaignId: string;
}): Promise<void> {
  const requestUser = await getRequestUser(input.userId);

  if (!canManageCampaignRecord(requestUser)) {
    throw new ServiceError("CAMPAIGN_DELETE_FORBIDDEN", 403, "Forbidden");
  }

  const existingCampaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    select: {
      id: true,
      name: true,
      hubspotObjectId: true,
      hubspotObjectType: true,
      hubspotSyncedAt: true,
    },
  });

  if (!existingCampaign) {
    throw new ServiceError("CAMPAIGN_NOT_FOUND", 404, "Campaign not found");
  }

  if (hasHubspotSyncMetadata(existingCampaign)) {
    throw new ServiceError(
      "CAMPAIGN_HUBSPOT_SYNCED",
      409,
      "HubSpot-synced campaigns cannot be deleted locally",
    );
  }

  await withDbTransaction(async (tx) => {
    await tx.campaign.delete({
      where: { id: existingCampaign.id },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: input.userId,
        action: "campaign.deleted",
        entityType: "campaign",
        entityId: existingCampaign.id,
        metadata: {
          campaignName: existingCampaign.name,
        },
      },
    });
  });
}

export async function listClients(input: {
  userId: string;
  query?: Partial<ListClientsQuery>;
}) {
  const parsedQuery = listClientsQuerySchema.partial().parse(input.query ?? {});

  const [requestUser, clients] = await Promise.all([
    getRequestUser(input.userId),
    prisma.client.findMany({
      where: {
        ...(typeof parsedQuery.active === "boolean" ? { isActive: parsedQuery.active } : {}),
      },
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  return {
    items: clients.map(toClientSummary),
    permissions: {
      canCreate: canCreateCampaign(requestUser),
      role: fromPrismaRole(requestUser.role),
      userType: fromPrismaUserType(requestUser.userType),
    },
  };
}

export async function createClient(input: CreateClientRequest & { userId: string }): Promise<ClientSummary> {
  const requestUser = await getRequestUser(input.userId);

  if (!canManageCampaignRecord(requestUser)) {
    throw new ServiceError("CLIENT_CREATE_FORBIDDEN", 403, "Forbidden");
  }

  const payload = createClientRequestSchema.parse(input);

  const created = await withDbTransaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: payload.name.trim(),
        domain: payload.domain?.trim() || null,
        countryRegion: payload.countryRegion.trim(),
        city: payload.city.trim(),
      },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: input.userId,
        action: "client.created",
        entityType: "client",
        entityId: client.id,
        metadata: {
          clientName: client.name,
        },
      },
    });

    return client;
  });

  return toClientSummary(created);
}

export async function updateClient(
  input: UpdateClientRequest & { userId: string; clientId: string },
): Promise<ClientSummary> {
  const requestUser = await getRequestUser(input.userId);

  if (!canManageCampaignRecord(requestUser)) {
    throw new ServiceError("CLIENT_UPDATE_FORBIDDEN", 403, "Forbidden");
  }

  const payload = updateClientRequestSchema.parse(input);
  const existingClient = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: {
      id: true,
      name: true,
      hubspotObjectId: true,
      hubspotObjectType: true,
      hubspotSyncedAt: true,
    },
  });

  if (!existingClient) {
    throw new ServiceError("CLIENT_NOT_FOUND", 404, "Client not found");
  }

  if (hasHubspotSyncMetadata(existingClient)) {
    throw new ServiceError(
      "CLIENT_HUBSPOT_SYNCED",
      409,
      "HubSpot-synced clients cannot be edited locally",
    );
  }

  const updated = await withDbTransaction(async (tx) => {
    const client = await tx.client.update({
      where: { id: existingClient.id },
      data: {
        name: payload.name.trim(),
        domain: payload.domain?.trim() || null,
        countryRegion: payload.countryRegion.trim(),
        city: payload.city.trim(),
        isActive: payload.isActive,
      },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: input.userId,
        action: "client.updated",
        entityType: "client",
        entityId: client.id,
        metadata: {
          previousClientName: existingClient.name,
          clientName: client.name,
        },
      },
    });

    return client;
  });

  return toClientSummary(updated);
}

export async function deleteClient(input: {
  userId: string;
  clientId: string;
}): Promise<void> {
  const requestUser = await getRequestUser(input.userId);

  if (!canManageCampaignRecord(requestUser)) {
    throw new ServiceError("CLIENT_DELETE_FORBIDDEN", 403, "Forbidden");
  }

  const existingClient = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: {
      id: true,
      name: true,
      hubspotObjectId: true,
      hubspotObjectType: true,
      hubspotSyncedAt: true,
    },
  });

  if (!existingClient) {
    throw new ServiceError("CLIENT_NOT_FOUND", 404, "Client not found");
  }

  if (hasHubspotSyncMetadata(existingClient)) {
    throw new ServiceError(
      "CLIENT_HUBSPOT_SYNCED",
      409,
      "HubSpot-synced clients cannot be deleted locally",
    );
  }

  await withDbTransaction(async (tx) => {
    await tx.client.delete({
      where: { id: existingClient.id },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: input.userId,
        action: "client.deleted",
        entityType: "client",
        entityId: existingClient.id,
        metadata: {
          clientName: existingClient.name,
        },
      },
    });
  });
}
