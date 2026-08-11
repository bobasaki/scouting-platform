import { Role } from "@prisma/client";
import { prisma } from "@scouting-platform/db";

import { ServiceError } from "../errors";

/**
 * The Almedia workspace is admin-only, and every service that reaches it goes
 * through this guard. The route layer already gates on the session role; this
 * is the second check that keeps the rule true for any non-HTTP caller.
 */
export async function requireAlmediaAdminUser(
  userId: string,
  forbiddenCode = "ALMEDIA_FORBIDDEN",
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    throw new ServiceError("USER_NOT_FOUND", 404, "User not found");
  }

  if (user.role !== Role.ADMIN) {
    throw new ServiceError(forbiddenCode, 403, "Forbidden");
  }
}
