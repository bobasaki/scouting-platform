import { CredentialProvider, Role, UserType as PrismaUserType, type Role as PrismaRole } from "@prisma/client";

import type {
  AdminUserResponse,
  CampaignManagerOption,
  CreateAdminUserRequest,
  UpdateAdminUserProfileRequest,
} from "@scouting-platform/contracts";
import { prisma, withDbTransaction } from "@scouting-platform/db";

import { ServiceError } from "../errors";
import { hashPassword, verifyPassword } from "./password";
import {
  fromPrismaRole,
  fromPrismaUserType,
  toPrismaRole,
  toPrismaUserType,
} from "./roles";

export const LOGIN_FAILURE_LOCK_THRESHOLD = 5;
export const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$ErxqKPOrPNy2Q6MOjBTetQ$PkqfSFEB+UKOWlxkUkXqlbajphpT81w4YVUB7Fv5NvE";

type UserWithYoutubeCredential = {
  id: string;
  email: string;
  name: string | null;
  role: PrismaRole;
  userType: PrismaUserType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  credentials: Array<{ id: string }>;
};

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAdminUserResponse(user: UserWithYoutubeCredential): AdminUserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: fromPrismaRole(user.role),
    userType: fromPrismaUserType(user.userType),
    isActive: user.isActive,
    youtubeKeyAssigned: user.credentials.length > 0,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function normalizeUserType(input: {
  role: "admin" | "user";
  userType: CreateAdminUserRequest["userType"] | UpdateAdminUserProfileRequest["userType"];
}): PrismaUserType {
  if (input.role === "admin") {
    return PrismaUserType.ADMIN;
  }

  if (input.userType === "admin") {
    throw new ServiceError(
      "USER_TYPE_ROLE_MISMATCH",
      400,
      "Only admin-role accounts can use the Admin user type",
    );
  }

  return toPrismaUserType(input.userType);
}

async function getUserWithYoutubeCredential(userId: string): Promise<UserWithYoutubeCredential> {
  return prisma.user.findFirstOrThrow({
    where: { id: userId },
    include: {
      credentials: {
        where: {
          provider: CredentialProvider.YOUTUBE_DATA_API,
        },
        select: {
          id: true,
        },
      },
    },
  });
}

export type CredentialsUserRecord = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "user";
  passwordHash: string;
  passwordChangedAt: Date;
  isActive: boolean;
};

type CredentialLoginUserRecord = CredentialsUserRecord & {
  failedLoginCount: number;
  lockedUntil: Date | null;
};

function addMilliseconds(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

function isLocked(user: { lockedUntil: Date | null }, now: Date): boolean {
  return Boolean(user.lockedUntil && user.lockedUntil.getTime() > now.getTime());
}

async function verifyAgainstDummyHash(password: string): Promise<void> {
  try {
    await verifyPassword(password || "invalid-password", DUMMY_PASSWORD_HASH);
  } catch {
    // Keep rejected credential paths generic even if the local argon2 binding fails.
  }
}

async function recordFailedLogin(user: CredentialLoginUserRecord, now: Date): Promise<void> {
  await withDbTransaction(async (tx) => {
    const updated = await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        failedLoginCount: {
          increment: 1,
        },
        lastFailedLoginAt: now,
      },
      select: {
        failedLoginCount: true,
      },
    });

    if (updated.failedLoginCount < LOGIN_FAILURE_LOCK_THRESHOLD) {
      return;
    }

    const lockedUntil = addMilliseconds(now, LOGIN_LOCK_DURATION_MS);

    await tx.user.update({
      where: {
        id: user.id,
      },
      data: {
        lockedUntil,
      },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: user.id,
        action: "user.login.locked",
        entityType: "user",
        entityId: user.id,
        metadata: {
          failedLoginCount: updated.failedLoginCount,
          lockedUntil: lockedUntil.toISOString(),
        },
      },
    });
  });
}

async function recordSuccessfulLogin(userId: string, now: Date): Promise<void> {
  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      failedLoginCount: 0,
      lastFailedLoginAt: null,
      lockedUntil: null,
      lastLoginAt: now,
    },
  });
}

export async function authenticateUserCredentials(input: {
  email: string;
  password: string;
  now?: Date;
}): Promise<CredentialsUserRecord | null> {
  const normalizedEmail = normalizeEmail(input.email);
  const now = input.now ?? new Date();
  const user = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true,
      passwordChangedAt: true,
      isActive: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

  if (!user || !user.isActive || isLocked(user, now)) {
    await verifyAgainstDummyHash(input.password);
    return null;
  }

  const isPasswordValid = await verifyPassword(input.password, user.passwordHash);
  const credentialUser: CredentialLoginUserRecord = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: fromPrismaRole(user.role),
    passwordHash: user.passwordHash,
    passwordChangedAt: user.passwordChangedAt,
    isActive: user.isActive,
    failedLoginCount: user.failedLoginCount,
    lockedUntil: user.lockedUntil,
  };

  if (!isPasswordValid) {
    await recordFailedLogin(credentialUser, now);
    return null;
  }

  await recordSuccessfulLogin(user.id, now);

  return credentialUser;
}

export async function getSessionUserAccess(input: {
  userId: string;
  passwordChangedAt?: string | null;
  sessionIssuedAt?: number | null;
}): Promise<{ id: string; role: "admin" | "user" } | null> {
  const user = await prisma.user.findUnique({
    where: {
      id: input.userId,
    },
    select: {
      id: true,
      role: true,
      isActive: true,
      passwordChangedAt: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  const tokenPasswordChangedAt =
    typeof input.passwordChangedAt === "string" ? Date.parse(input.passwordChangedAt) : Number.NaN;

  if (Number.isFinite(tokenPasswordChangedAt) && user.passwordChangedAt.getTime() > tokenPasswordChangedAt) {
    return null;
  }

  if (!Number.isFinite(tokenPasswordChangedAt) && typeof input.sessionIssuedAt === "number") {
    const issuedAtMs = input.sessionIssuedAt * 1000;

    if (user.passwordChangedAt.getTime() > issuedAtMs) {
      return null;
    }
  }

  return {
    id: user.id,
    role: fromPrismaRole(user.role),
  };
}

export async function createUser(
  input: CreateAdminUserRequest & { actorUserId: string },
): Promise<AdminUserResponse> {
  const normalizedEmail = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const normalizedRole = input.role;
  const normalizedUserType = normalizeUserType({
    role: normalizedRole,
    userType: input.userType,
  });

  try {
    const userId = await withDbTransaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: input.name?.trim() || null,
          role: toPrismaRole(normalizedRole),
          userType: normalizedUserType,
          passwordHash,
          isActive: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: input.actorUserId,
          action: "user.created",
          entityType: "user",
          entityId: user.id,
          metadata: {
            role: normalizedRole,
            userType: fromPrismaUserType(normalizedUserType),
          },
        },
      });

      return user.id;
    });

    const user = await getUserWithYoutubeCredential(userId);
    return toAdminUserResponse(user);
  } catch (error: unknown) {
    if (hasPrismaErrorCode(error, "P2002")) {
      throw new ServiceError("DUPLICATE_EMAIL", 409, "A user with this email already exists");
    }

    throw error;
  }
}

export async function listUsers(): Promise<AdminUserResponse[]> {
  const users = await prisma.user.findMany({
    include: {
      credentials: {
        where: {
          provider: CredentialProvider.YOUTUBE_DATA_API,
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return users.map((user) => toAdminUserResponse(user));
}

export async function updateUserPassword(input: {
  userId: string;
  password: string;
  actorUserId: string;
}): Promise<AdminUserResponse> {
  const passwordHash = await hashPassword(input.password);

  await withDbTransaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw new ServiceError("USER_NOT_FOUND", 404, "User not found");
    }

    await tx.user.update({
      where: {
        id: input.userId,
      },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lastFailedLoginAt: null,
        lockedUntil: null,
      },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: "user.password.updated",
        entityType: "user",
        entityId: input.userId,
      },
    });
  });

  const user = await getUserWithYoutubeCredential(input.userId);
  return toAdminUserResponse(user);
}

export async function updateUserProfile(input: {
  userId: string;
  actorUserId: string;
  profile: UpdateAdminUserProfileRequest;
}): Promise<AdminUserResponse> {
  await withDbTransaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: {
        id: input.userId,
      },
      select: {
        id: true,
        role: true,
        userType: true,
        name: true,
      },
    });

    if (!existing) {
      throw new ServiceError("USER_NOT_FOUND", 404, "User not found");
    }

    const nextUserType = normalizeUserType({
      role: fromPrismaRole(existing.role),
      userType: input.profile.userType,
    });
    const nextName =
      input.profile.name === undefined ? existing.name : input.profile.name?.trim() || null;

    await tx.user.update({
      where: {
        id: input.userId,
      },
      data: {
        name: nextName,
        userType: nextUserType,
      },
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: "user.profile.updated",
        entityType: "user",
        entityId: input.userId,
        metadata: {
          userType: fromPrismaUserType(nextUserType),
        },
      },
    });
  });

  const user = await getUserWithYoutubeCredential(input.userId);
  return toAdminUserResponse(user);
}

export async function listCampaignManagers(): Promise<CampaignManagerOption[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: Role.USER,
      userType: PrismaUserType.CAMPAIGN_MANAGER,
    },
    orderBy: [
      {
        name: "asc",
      },
      {
        email: "asc",
      },
    ],
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
  }));
}
