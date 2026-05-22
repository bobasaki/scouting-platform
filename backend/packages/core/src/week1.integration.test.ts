import { CredentialProvider, PrismaClient, Role } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const databaseUrl = process.env.DATABASE_URL_TEST?.trim() ?? "";
const integration = databaseUrl ? describe.sequential : describe.skip;

type CoreModule = typeof import("./index");

integration("week 1 core integration", () => {
  const encryptionKey = "12345678901234567890123456789012";
  let prisma: PrismaClient;
  let core: CoreModule;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.APP_ENCRYPTION_KEY = encryptionKey;

    const db = await import("@scouting-platform/db");
    prisma = db.createPrismaClient({ databaseUrl });

    await prisma.$connect();
  });

  beforeEach(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.APP_ENCRYPTION_KEY = encryptionKey;

    vi.resetModules();

    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
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

    const db = await import("@scouting-platform/db");
    await db.resetPrismaClientForTests();
    core = await import("./index");
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

  it("creates users, rejects duplicate email, and lists users", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin",
        role: Role.ADMIN,
        passwordHash: "bootstrap-hash",
        isActive: true,
      },
    });

    const created = await core.createUser({
      actorUserId: admin.id,
      email: "user@example.com",
      name: "Campaign User",
      role: "user",
      userType: "campaign_manager",
      password: "StrongPassword123",
    });

    expect(created.email).toBe("user@example.com");
    expect(created.role).toBe("user");

    await expect(
      core.createUser({
        actorUserId: admin.id,
        email: "user@example.com",
        name: "Campaign User 2",
        role: "user",
        userType: "campaign_manager",
        password: "StrongPassword123",
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_EMAIL",
      status: 409,
    });

    const users = await core.listUsers();
    expect(users).toHaveLength(2);
  });

  it("locks repeated credential failures and clears lockout on admin password rotation", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin",
        role: Role.ADMIN,
        passwordHash: "bootstrap-hash",
        isActive: true,
      },
    });

    const user = await core.createUser({
      actorUserId: admin.id,
      email: "locked@example.com",
      name: "Locked User",
      role: "user",
      userType: "campaign_manager",
      password: "StrongPassword123",
    });

    const now = new Date("2026-05-21T10:00:00.000Z");

    for (let attempt = 0; attempt < core.LOGIN_FAILURE_LOCK_THRESHOLD; attempt += 1) {
      await expect(
        core.authenticateUserCredentials({
          email: "locked@example.com",
          password: "WrongPassword123",
          now,
        }),
      ).resolves.toBeNull();
    }

    const locked = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });
    expect(locked.failedLoginCount).toBe(core.LOGIN_FAILURE_LOCK_THRESHOLD);
    expect(locked.lockedUntil?.getTime()).toBeGreaterThan(now.getTime());

    await expect(
      core.authenticateUserCredentials({
        email: "locked@example.com",
        password: "StrongPassword123",
        now: new Date("2026-05-21T10:01:00.000Z"),
      }),
    ).resolves.toBeNull();

    const lockAudit = await prisma.auditEvent.findFirst({
      where: {
        action: "user.login.locked",
        entityId: user.id,
      },
    });
    expect(lockAudit).not.toBeNull();

    await core.updateUserPassword({
      userId: user.id,
      password: "RotatedPassword123",
      actorUserId: admin.id,
    });

    const unlocked = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });
    expect(unlocked.failedLoginCount).toBe(0);
    expect(unlocked.lockedUntil).toBeNull();
    expect(unlocked.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(locked.passwordChangedAt.getTime());

    await expect(
      core.authenticateUserCredentials({
        email: "locked@example.com",
        password: "RotatedPassword123",
        now: new Date("2026-05-21T10:02:00.000Z"),
      }),
    ).resolves.toMatchObject({
      id: user.id,
      email: "locked@example.com",
    });
  });

  it("uses current database state to validate JWT-backed sessions", async () => {
    const user = await prisma.user.create({
      data: {
        email: "session-user@example.com",
        name: "Session User",
        role: Role.USER,
        passwordHash: "bootstrap-hash",
        isActive: true,
      },
    });
    const passwordChangedAt = user.passwordChangedAt.toISOString();

    await expect(
      core.getSessionUserAccess({
        userId: user.id,
        passwordChangedAt,
      }),
    ).resolves.toEqual({
      id: user.id,
      email: "session-user@example.com",
      role: "user",
    });

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        role: Role.ADMIN,
      },
    });

    await expect(
      core.getSessionUserAccess({
        userId: user.id,
        passwordChangedAt,
      }),
    ).resolves.toEqual({
      id: user.id,
      email: "session-user@example.com",
      role: "admin",
    });

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        passwordChangedAt: new Date(user.passwordChangedAt.getTime() + 1_000),
      },
    });

    await expect(
      core.getSessionUserAccess({
        userId: user.id,
        passwordChangedAt,
      }),
    ).resolves.toBeNull();

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        isActive: false,
      },
    });

    await expect(
      core.getSessionUserAccess({
        userId: user.id,
        sessionIssuedAt: Math.floor(Date.now() / 1000),
      }),
    ).resolves.toBeNull();
  });

  it("stores encrypted youtube key and decrypts only server-side", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin",
        role: Role.ADMIN,
        passwordHash: "bootstrap-hash",
        isActive: true,
      },
    });

    const user = await core.createUser({
      actorUserId: admin.id,
      email: "campaign@example.com",
      name: "Campaign User",
      role: "user",
      userType: "campaign_manager",
      password: "StrongPassword123",
    });

    await core.setUserYoutubeApiKey({
      userId: user.id,
      rawKey: "yt-secret-key",
      actorUserId: admin.id,
    });

    const stored = await prisma.userProviderCredential.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: CredentialProvider.YOUTUBE_DATA_API,
        },
      },
    });

    expect(stored).not.toBeNull();
    expect(stored?.encryptedSecret).not.toBe("yt-secret-key");

    const decrypted = await core.getUserYoutubeApiKey(user.id);
    expect(decrypted).toBe("yt-secret-key");

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        isActive: false,
      },
    });

    await expect(core.getUserYoutubeApiKey(user.id)).resolves.toBeNull();
    await expect(
      core.setUserYoutubeApiKey({
        userId: user.id,
        rawKey: "replacement-key",
        actorUserId: admin.id,
      }),
    ).rejects.toMatchObject({
      code: "USER_INACTIVE",
      status: 409,
    });
  });

  it("returns an empty-safe channel list on clean database", async () => {
    const result = await core.listChannels({
      page: 1,
      pageSize: 20,
    });

    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });
});
