import {
  AdvancedReportRequestStatus as PrismaAdvancedReportRequestStatus,
  ChannelInsightSource as PrismaChannelInsightSource,
  PrismaClient,
  Role,
} from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ADVANCED_REPORT_FRESH_WINDOW_DAYS } from "./approvals/status";

const fetchHypeAuditorChannelInsightsMock = vi.fn();

vi.mock("@scouting-platform/integrations", async () => {
  const actual = await vi.importActual<typeof import("@scouting-platform/integrations")>(
    "@scouting-platform/integrations",
  );

  return {
    ...actual,
    fetchHypeAuditorChannelInsights: fetchHypeAuditorChannelInsightsMock,
  };
});

const databaseUrl = process.env.DATABASE_URL_TEST?.trim() ?? "";
const integration = databaseUrl ? describe.sequential : describe.skip;

type CoreModule = typeof import("./index");

const COMPLETED_INSIGHTS = {
  audienceCountries: [
    {
      countryCode: "US",
      countryName: "United States",
      percentage: 32.5,
    },
  ],
  audienceGenderAge: [
    {
      gender: "female",
      ageRange: "18-24",
      percentage: 21.5,
    },
  ],
  audienceInterests: [
    {
      label: "Gaming",
      score: 0.88,
    },
  ],
  estimatedPrice: {
    currencyCode: "USD",
    min: 500,
    max: 900,
  },
  brandMentions: [
    {
      brandName: "Nike",
    },
  ],
} as const;

integration("week 5 core integration", () => {
  let prisma: PrismaClient;
  let core: CoreModule;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.HYPEAUDITOR_API_KEY = "auth-id:auth-token";

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });

    await prisma.$connect();
    core = await import("./index");
  });

  beforeEach(async () => {
    fetchHypeAuditorChannelInsightsMock.mockReset();

    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        csv_import_rows,
        csv_import_batches,
        advanced_report_requests,
        channel_provider_payloads,
        channel_insights,
        channel_metrics,
        channel_contacts,
        channel_enrichments,
        channel_youtube_contexts,
        channel_manual_overrides,
        saved_segments,
        run_results,
        run_requests,
        audit_events,
        user_provider_credentials,
        sessions,
        accounts,
        verification_tokens,
        channels,
        users
      RESTART IDENTITY CASCADE
    `);

    await prisma.$executeRawUnsafe(`
      DELETE FROM pgboss.job WHERE name = 'channels.enrich.hypeauditor'
    `);

    await prisma.$executeRawUnsafe(`
      DELETE FROM pgboss.job WHERE name = 'imports.csv.process'
    `);
  });

  afterAll(async () => {
    await core.stopAdvancedReportsQueue();
    await core.stopCsvImportsQueue();
    await prisma.$disconnect();
  });

  async function createUser(email: string, role: Role = Role.USER): Promise<{ id: string }> {
    return prisma.user.create({
      data: {
        email,
        name: role === Role.ADMIN ? "Admin" : "Manager",
        role,
        passwordHash: "hash",
        isActive: true,
      },
      select: {
        id: true,
      },
    });
  }

  async function createChannel(
    youtubeChannelId = "UC-HYPE-1",
    title = "Hype Channel",
  ): Promise<{ id: string }> {
    return prisma.channel.create({
      data: {
        youtubeChannelId,
        title,
      },
      select: {
        id: true,
      },
    });
  }

  it("creates a pending request, audits it, and dedupes active requests", async () => {
    const user = await createUser("manager@example.com");
    const channel = await createChannel();

    const first = await core.requestAdvancedReport({
      channelId: channel.id,
      requestedByUserId: user.id,
    });
    const second = await core.requestAdvancedReport({
      channelId: channel.id,
      requestedByUserId: user.id,
    });

    expect(first.advancedReport.status).toBe("pending_approval");
    expect(second.advancedReport.status).toBe("pending_approval");
    expect(first.advancedReport.requestId).toBe(second.advancedReport.requestId);

    const requests = await prisma.advancedReportRequest.findMany();
    expect(requests).toHaveLength(1);

    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        action: "advanced_report.requested",
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    expect(auditEvents).toHaveLength(2);
    expect(auditEvents[0]?.metadata).toMatchObject({ created: true });
    expect(auditEvents[1]?.metadata).toMatchObject({
      created: false,
      reusedStatus: "pending_approval",
    });
  });

  it("allows a new request while surfacing the last completed report age and freshness", async () => {
    const user = await createUser("manager@example.com");
    const channel = await createChannel();
    const recentCompletedAt = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const completedRequest = await prisma.advancedReportRequest.create({
      data: {
        channelId: channel.id,
        requestedByUserId: user.id,
        status: PrismaAdvancedReportRequestStatus.COMPLETED,
        completedAt: recentCompletedAt,
      },
      select: {
        id: true,
      },
    });

    const requested = await core.requestAdvancedReport({
      channelId: channel.id,
      requestedByUserId: user.id,
    });

    expect(requested.advancedReport.requestId).not.toBe(completedRequest.id);
    expect(requested.advancedReport.status).toBe("pending_approval");
    expect(requested.advancedReport.lastCompletedReport).toMatchObject({
      requestId: completedRequest.id,
      completedAt: recentCompletedAt.toISOString(),
      withinFreshWindow: true,
    });
    expect(requested.advancedReport.lastCompletedReport?.ageDays).toBeTypeOf("number");

    const requestCount = await prisma.advancedReportRequest.count();
    expect(requestCount).toBe(2);
  });

  it("approves queued work, records audit, and enqueues channels.enrich.hypeauditor", async () => {
    const user = await createUser("manager@example.com");
    const admin = await createUser("admin@example.com", Role.ADMIN);
    const channel = await createChannel();

    const created = await core.requestAdvancedReport({
      channelId: channel.id,
      requestedByUserId: user.id,
    });

    if (!created.advancedReport.requestId) {
      throw new Error("Expected request id");
    }

    const approved = await core.approveAdvancedReportRequest({
      advancedReportRequestId: created.advancedReport.requestId,
      actorUserId: admin.id,
      decisionNote: "Approved for paid lookup.",
    });

    expect(approved.status).toBe("queued");
    expect(approved.decisionNote).toBe("Approved for paid lookup.");
    expect(approved.reviewedBy?.id).toBe(admin.id);
    expect(approved.lastCompletedReport).toBeNull();

    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        action: "advanced_report.approved",
        entityId: created.advancedReport.requestId,
      },
    });
    expect(auditEvent).not.toBeNull();

    const jobs = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM pgboss.job
      WHERE name = 'channels.enrich.hypeauditor'
    `;
    expect(jobs[0]?.count).toBe(1);
  });

  it("rejects pending requests and records audit metadata", async () => {
    const user = await createUser("manager@example.com");
    const admin = await createUser("admin@example.com", Role.ADMIN);
    const channel = await createChannel();

    const created = await core.requestAdvancedReport({
      channelId: channel.id,
      requestedByUserId: user.id,
    });

    if (!created.advancedReport.requestId) {
      throw new Error("Expected request id");
    }

    const rejected = await core.rejectAdvancedReportRequest({
      advancedReportRequestId: created.advancedReport.requestId,
      actorUserId: admin.id,
      decisionNote: "Out of budget this week.",
    });

    expect(rejected.status).toBe("rejected");
    expect(rejected.decisionNote).toBe("Out of budget this week.");

    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        action: "advanced_report.rejected",
        entityId: created.advancedReport.requestId,
      },
    });
    expect(auditEvent).not.toBeNull();
  });

  it("executes queued work, stores raw payload and normalized insights, and completes the request", async () => {
    const user = await createUser("manager@example.com");
    const channel = await createChannel();
    const request = await prisma.advancedReportRequest.create({
      data: {
        channelId: channel.id,
        requestedByUserId: user.id,
        status: PrismaAdvancedReportRequestStatus.QUEUED,
      },
      select: {
        id: true,
      },
    });

    fetchHypeAuditorChannelInsightsMock.mockResolvedValue({
      insights: COMPLETED_INSIGHTS,
      rawPayload: {
        report: {
          report_state: "finished",
        },
        brandMentions: {
          items: [{ title: "Nike" }],
        },
      },
    });

    await core.executeAdvancedReportRequest({
      advancedReportRequestId: request.id,
      requestedByUserId: user.id,
    });

    const completedRequest = await prisma.advancedReportRequest.findUniqueOrThrow({
      where: {
        id: request.id,
      },
    });
    expect(completedRequest.status).toBe(PrismaAdvancedReportRequestStatus.COMPLETED);
    expect(completedRequest.providerPayloadId).not.toBeNull();
    expect(completedRequest.lastError).toBeNull();

    const payloadRow = await prisma.channelProviderPayload.findUniqueOrThrow({
      where: {
        id: completedRequest.providerPayloadId!,
      },
    });
    expect(payloadRow.provider).toBe("HYPEAUDITOR");

    const insightRow = await prisma.channelInsight.findUniqueOrThrow({
      where: {
        channelId: channel.id,
      },
    });
    expect(insightRow.audienceCountries).toEqual(COMPLETED_INSIGHTS.audienceCountries);
    expect(insightRow.estimatedPriceCurrencyCode).toBe("USD");
    expect(insightRow.brandMentions).toEqual(COMPLETED_INSIGHTS.brandMentions);

    const detail = await core.getChannelById(channel.id);
    expect(detail?.advancedReport.status).toBe("completed");
    expect(detail?.advancedReport.lastCompletedReport).toMatchObject({
      requestId: request.id,
      withinFreshWindow: true,
    });
    expect(detail?.advancedReport.lastCompletedReport?.ageDays).toBeTypeOf("number");
    expect(detail?.insights.audienceCountries).toEqual(COMPLETED_INSIGHTS.audienceCountries);
    expect(detail?.insights.brandMentions).toEqual(COMPLETED_INSIGHTS.brandMentions);
  });

  it("preserves higher precedence insight fields while still updating hype-owned fields", async () => {
    const user = await createUser("manager@example.com");
    const channel = await createChannel();
    const request = await prisma.advancedReportRequest.create({
      data: {
        channelId: channel.id,
        requestedByUserId: user.id,
        status: PrismaAdvancedReportRequestStatus.QUEUED,
      },
      select: {
        id: true,
      },
    });

    await prisma.channelInsight.create({
      data: {
        channelId: channel.id,
        audienceCountries: [
          {
            countryCode: "DE",
            countryName: "Germany",
            percentage: 77,
          },
        ],
        audienceCountriesSource: PrismaChannelInsightSource.CSV_IMPORT,
        audienceCountriesSourceUpdatedAt: new Date("2026-03-01T00:00:00.000Z"),
        brandMentions: [
          {
            brandName: "Legacy Brand",
          },
        ],
        brandMentionsSource: PrismaChannelInsightSource.HYPEAUDITOR,
        brandMentionsSourceUpdatedAt: new Date("2026-03-01T00:00:00.000Z"),
      },
    });

    fetchHypeAuditorChannelInsightsMock.mockResolvedValue({
      insights: COMPLETED_INSIGHTS,
      rawPayload: {
        report: {
          report_state: "finished",
        },
        brandMentions: {
          items: [{ title: "Nike" }],
        },
      },
    });

    await core.executeAdvancedReportRequest({
      advancedReportRequestId: request.id,
      requestedByUserId: user.id,
    });

    const insightRow = await prisma.channelInsight.findUniqueOrThrow({
      where: {
        channelId: channel.id,
      },
    });
    expect(insightRow.audienceCountries).toEqual([
      {
        countryCode: "DE",
        countryName: "Germany",
        percentage: 77,
      },
    ]);
    expect(insightRow.audienceCountriesSource).toBe(PrismaChannelInsightSource.CSV_IMPORT);
    expect(insightRow.brandMentions).toEqual(COMPLETED_INSIGHTS.brandMentions);
  });

  it("persists lastError when execution fails", async () => {
    const user = await createUser("manager@example.com");
    const channel = await createChannel();
    const request = await prisma.advancedReportRequest.create({
      data: {
        channelId: channel.id,
        requestedByUserId: user.id,
        status: PrismaAdvancedReportRequestStatus.QUEUED,
      },
      select: {
        id: true,
      },
    });

    fetchHypeAuditorChannelInsightsMock.mockRejectedValue(new Error("provider boom"));

    await expect(
      core.executeAdvancedReportRequest({
        advancedReportRequestId: request.id,
        requestedByUserId: user.id,
      }),
    ).rejects.toThrow("provider boom");

    const failedRequest = await prisma.advancedReportRequest.findUniqueOrThrow({
      where: {
        id: request.id,
      },
    });
    expect(failedRequest.status).toBe(PrismaAdvancedReportRequestStatus.FAILED);
    expect(failedRequest.lastError).toBe("provider boom");
  });

  it("surfaces stale completed reports on channel detail after 120 days", async () => {
    const user = await createUser("manager@example.com");
    const channel = await createChannel();
    const staleCompletedAt = new Date(
      Date.now() - (ADVANCED_REPORT_FRESH_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000,
    );

    await prisma.advancedReportRequest.create({
      data: {
        channelId: channel.id,
        requestedByUserId: user.id,
        status: PrismaAdvancedReportRequestStatus.COMPLETED,
        completedAt: staleCompletedAt,
      },
    });

    const detail = await core.getChannelById(channel.id);
    expect(detail?.advancedReport.status).toBe("stale");
    expect(detail?.advancedReport.lastCompletedReport).toMatchObject({
      completedAt: staleCompletedAt.toISOString(),
      withinFreshWindow: false,
    });
    expect(detail?.advancedReport.lastCompletedReport?.ageDays).toBeGreaterThan(
      ADVANCED_REPORT_FRESH_WINDOW_DAYS,
    );
  });

  it("creates a queued csv import batch, audits it, and enqueues imports.csv.process", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);

    const batch = await core.createCsvImportBatch({
      requestedByUserId: admin.id,
      filename: "channels.csv",
      csvText: [
        "youtubeChannelId,title,handle,contactEmail,subscriberCount,averageViews,averageLikes,notes,sourceLabel",
        "UC-CSV-QUEUE,Queued Channel,@queued,owner@example.com,1200,340,22,Primary,Sheet A",
      ].join("\n"),
    });

    expect(batch.status).toBe("queued");
    expect(batch.filename).toBe("channels.csv");

    const auditEvent = await prisma.auditEvent.findFirst({
      where: {
        action: "csv_import.requested",
        entityId: batch.id,
      },
    });
    expect(auditEvent).not.toBeNull();

    const jobs = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM pgboss.job
      WHERE name = 'imports.csv.process'
    `;
    expect(jobs[0]?.count).toBe(1);
  });

  it("processes csv imports, creates missing channels, upserts contacts and metrics, and preserves raw extras", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);
    const existingChannel = await createChannel("UC-CSV-EXIST", "Existing CSV Channel");
    const batch = await prisma.csvImportBatch.create({
      data: {
        requestedByUserId: admin.id,
        filename: "channels.csv",
        csvText: [
          "youtubeChannelId,title,handle,contactEmail,subscriberCount,averageViews,averageLikes,notes,sourceLabel,vertical",
          "UC-CSV-EXIST,Ignored Existing,@ignored,owner@example.com,12000,3400,210,Primary contact,Sheet A,beauty",
          "UC-CSV-NEW,New CSV Channel,@newcsv,,8800,1200,95,,,gaming",
          "UC-CSV-EXIST,Ignored Existing,@ignored,not-an-email,,,,,Sheet B,travel",
        ].join("\n"),
      },
      select: {
        id: true,
      },
    });

    await core.executeCsvImportBatch({
      importBatchId: batch.id,
      requestedByUserId: admin.id,
    });

    const completedBatch = await prisma.csvImportBatch.findUniqueOrThrow({
      where: {
        id: batch.id,
      },
    });
    expect(completedBatch.status).toBe("COMPLETED");
    expect(completedBatch.totalRows).toBe(3);
    expect(completedBatch.processedRows).toBe(2);
    expect(completedBatch.failedRows).toBe(1);
    expect(completedBatch.lastError).toBeNull();

    const rows = await prisma.csvImportRow.findMany({
      where: {
        importBatchId: batch.id,
      },
      orderBy: {
        rowNumber: "asc",
      },
    });
    expect(rows).toHaveLength(3);
    expect(rows[0]?.status).toBe("PROCESSED");
    expect(rows[1]?.status).toBe("PROCESSED");
    expect(rows[1]?.rawData).toMatchObject({
      vertical: "gaming",
    });
    expect(rows[2]?.status).toBe("FAILED");
    expect(rows[2]?.errorMessage).toBe("Invalid contactEmail");

    const contacts = await prisma.channelContact.findMany({
      where: {
        channelId: existingChannel.id,
      },
    });
    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.email).toBe("owner@example.com");
    expect(contacts[0]?.notes).toBe("Primary contact");
    expect(contacts[0]?.sourceLabel).toBe("Sheet A");

    const existingMetrics = await prisma.channelMetric.findUniqueOrThrow({
      where: {
        channelId: existingChannel.id,
      },
    });
    expect(existingMetrics.subscriberCount).toBe(BigInt(12000));
    expect(existingMetrics.averageViews).toBe(BigInt(3400));
    expect(existingMetrics.averageLikes).toBe(BigInt(210));

    const newChannel = await prisma.channel.findUniqueOrThrow({
      where: {
        youtubeChannelId: "UC-CSV-NEW",
      },
    });
    expect(newChannel.title).toBe("New CSV Channel");
    expect(newChannel.handle).toBe("@newcsv");

    const newMetrics = await prisma.channelMetric.findUniqueOrThrow({
      where: {
        channelId: newChannel.id,
      },
    });
    expect(newMetrics.subscriberCount).toBe(BigInt(8800));

    const completedAudit = await prisma.auditEvent.findFirst({
      where: {
        action: "csv_import.completed",
        entityId: batch.id,
      },
    });
    expect(completedAudit).not.toBeNull();
  });

  it("marks malformed csv files as failed without throwing retryable errors", async () => {
    const admin = await createUser("admin@example.com", Role.ADMIN);
    const batch = await prisma.csvImportBatch.create({
      data: {
        requestedByUserId: admin.id,
        filename: "broken.csv",
        csvText: [
          "youtubeChannelId,title",
          "UC-BROKEN,Missing required headers",
        ].join("\n"),
      },
      select: {
        id: true,
      },
    });

    await expect(
      core.executeCsvImportBatch({
        importBatchId: batch.id,
        requestedByUserId: admin.id,
      }),
    ).resolves.toBeUndefined();

    const failedBatch = await prisma.csvImportBatch.findUniqueOrThrow({
      where: {
        id: batch.id,
      },
    });
    expect(failedBatch.status).toBe("FAILED");
    expect(failedBatch.lastError).toBe("Invalid CSV header");

    const failedAudit = await prisma.auditEvent.findFirst({
      where: {
        action: "csv_import.failed",
        entityId: batch.id,
      },
    });
    expect(failedAudit).not.toBeNull();
  });
});
