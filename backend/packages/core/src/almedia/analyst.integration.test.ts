import { PrismaClient, Role } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.DATABASE_URL_TEST?.trim() ?? "";
const integration = databaseUrl ? describe.sequential : describe.skip;

type AnalystModule = typeof import("./analyst");

integration("almedia analyst access", () => {
  let prisma: PrismaClient;
  let adminId: string;
  let memberId: string;

  async function loadAnalyst(): Promise<AnalystModule> {
    return import("./analyst");
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;

    const db = await import("@scouting-platform/db");
    prisma = db.createPrismaClient({ databaseUrl });

    await prisma.$connect();
  });

  beforeEach(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.OPENAI_API_KEY = "sk-test";
    vi.resetModules();

    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE audit_events, users RESTART IDENTITY CASCADE`,
    );

    const admin = await prisma.user.create({
      data: {
        email: "analyst-admin@example.com",
        passwordHash: "hash",
        role: Role.ADMIN,
      },
      select: { id: true },
    });
    const member = await prisma.user.create({
      data: {
        email: "analyst-member@example.com",
        passwordHash: "hash",
        role: Role.USER,
      },
      select: { id: true },
    });

    adminId = admin.id;
    memberId = member.id;

    const db = await import("@scouting-platform/db");
    await db.resetPrismaClientForTests();
  });

  afterAll(async () => {
    vi.resetModules();

    const db = await import("@scouting-platform/db");
    await db.resetPrismaClientForTests();
    await prisma.$disconnect();
  });

  it("reports configured status to an admin", async () => {
    const { getAlmediaAnalystStatus } = await loadAnalyst();

    const status = await getAlmediaAnalystStatus(adminId);

    expect(status.configured).toBe(true);
    expect(status.model.length).toBeGreaterThan(0);
  });

  it("refuses status to a non-admin", async () => {
    const { getAlmediaAnalystStatus } = await loadAnalyst();

    await expect(getAlmediaAnalystStatus(memberId)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("refuses a stream to a non-admin before any provider call", async () => {
    const { startAlmediaAnalystStream } = await loadAnalyst();

    await expect(
      startAlmediaAnalystStream({
        requestedByUserId: memberId,
        messages: [{ role: "user", content: "Where should we shift budget?" }],
        context: '{"totals":{}}',
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it("audits the question's shape without storing the question", async () => {
    const { startAlmediaAnalystStream } = await loadAnalyst();

    await startAlmediaAnalystStream({
      requestedByUserId: adminId,
      messages: [
        { role: "user", content: "Which markets under-deliver?" },
        { role: "assistant", content: "PL." },
        { role: "user", content: "By how much?" },
      ],
      context: '{"totals":{"cost":1000}}',
    });

    const events = await prisma.auditEvent.findMany();

    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("almedia.analyst.asked");
    expect(events[0]?.metadata).toMatchObject({
      turns: 3,
      questionChars: "By how much?".length,
      contextChars: '{"totals":{"cost":1000}}'.length,
    });
    expect(JSON.stringify(events[0]?.metadata)).not.toContain("under-deliver");
  });

  it("fails with 503 rather than a broken stream when no key is configured", async () => {
    delete process.env.OPENAI_API_KEY;

    const { startAlmediaAnalystStream } = await loadAnalyst();

    await expect(
      startAlmediaAnalystStream({
        requestedByUserId: adminId,
        messages: [{ role: "user", content: "Where should we shift budget?" }],
        context: "",
      }),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("rejects a conversation whose last turn is not the user's", async () => {
    const { startAlmediaAnalystStream } = await loadAnalyst();

    await expect(
      startAlmediaAnalystStream({
        requestedByUserId: adminId,
        messages: [{ role: "assistant", content: "Done." }],
        context: "",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
