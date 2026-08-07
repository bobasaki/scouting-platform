import { Prisma } from "@prisma/client";
import { prisma } from "@scouting-platform/db";

export type AuditInput = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
};

// Accepts either the shared client or an active transaction client so callers
// can record the audit event atomically alongside the mutation it describes.
type AuditDbClient = Prisma.TransactionClient | typeof prisma;

export async function recordAuditEvent(
  input: AuditInput,
  client: AuditDbClient = prisma,
): Promise<void> {
  const data: Prisma.AuditEventUncheckedCreateInput = {
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
  };

  if (input.metadata !== undefined) {
    data.metadata =
      input.metadata === null ? Prisma.JsonNull : (input.metadata as Prisma.InputJsonValue);
  }

  await client.auditEvent.create({
    data,
  });
}
