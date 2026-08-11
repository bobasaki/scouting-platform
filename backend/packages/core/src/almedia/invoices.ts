import type {
  AlmediaInvoiceTierId,
  BookingInvoice,
  BookingInvoiceInput,
} from "@scouting-platform/contracts";
import { almediaInvoiceTierIdSchema } from "@scouting-platform/contracts";
import { prisma } from "@scouting-platform/db";

import { recordAuditEvent } from "../audit";
import { ServiceError } from "../errors";
import { requireAlmediaAdminUser } from "./access";

/**
 * Invoice snapshots: what a campaign was actually billed, and when.
 *
 * The billing model itself is derived — costs and returns come from the Almedia
 * feed, so the amount owed for any month recomputes on every load. These rows
 * are the other half: a record that a bill was *sent*, frozen at the figures it
 * was sent with. A campaign invoiced before it matured keeps the tier it was
 * billed at, so once it matures and climbs a tier the difference is visible
 * rather than silently absorbed into a recomputed total.
 *
 * Keyed by the Almedia campaign name, which is unique in the feed and is the
 * only identifier a finance export can be reconciled against.
 */

type BookingInvoiceRecord = {
  id: string;
  campaignName: string;
  channelName: string;
  invoicedAt: string;
  maturedAtInvoice: boolean;
  cost: number;
  returnPct: number | null;
  tier: string;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A stored tier that is no longer on the rate card falls back to the base tier
 * rather than failing the read: the row is a historical record, and one revised
 * card should not make the whole invoice list unservable.
 */
function toTierId(stored: string): AlmediaInvoiceTierId {
  const parsed = almediaInvoiceTierIdSchema.safeParse(stored);

  return parsed.success ? parsed.data : "c20";
}

function toInvoice(record: BookingInvoiceRecord): BookingInvoice {
  return {
    id: record.id,
    campaignName: record.campaignName,
    channelName: record.channelName,
    invoicedAt: record.invoicedAt,
    maturedAtInvoice: record.maturedAtInvoice,
    cost: record.cost,
    returnPct: record.returnPct,
    tier: toTierId(record.tier),
    amount: record.amount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Every invoice snapshot, most recently invoiced first. */
export async function listBookingInvoices(): Promise<BookingInvoice[]> {
  const rows = await prisma.bookingInvoice.findMany({
    orderBy: [{ invoicedAt: "desc" }, { campaignName: "asc" }],
  });

  return rows.map(toInvoice);
}

/**
 * Record (or re-record) what a campaign was billed. Re-invoicing the same
 * campaign overwrites the snapshot, which is what a top-up after maturity
 * should do — the new figures are the current truth about the bill.
 */
export async function upsertBookingInvoice(input: {
  requestedByUserId: string;
  invoice: BookingInvoiceInput;
}): Promise<BookingInvoice> {
  await requireAlmediaAdminUser(input.requestedByUserId);

  const data = {
    channelName: input.invoice.channelName,
    invoicedAt: input.invoice.invoicedAt,
    maturedAtInvoice: input.invoice.maturedAtInvoice,
    cost: input.invoice.cost,
    returnPct: input.invoice.returnPct,
    tier: input.invoice.tier,
    amount: input.invoice.amount,
  };

  const saved = await prisma.bookingInvoice.upsert({
    where: { campaignName: input.invoice.campaignName },
    create: { campaignName: input.invoice.campaignName, ...data },
    update: data,
  });

  await recordAuditEvent({
    actorUserId: input.requestedByUserId,
    action: "almedia.invoice.recorded",
    entityType: "booking_invoice",
    entityId: saved.id,
    metadata: {
      campaignName: saved.campaignName,
      tier: saved.tier,
      amount: saved.amount,
      maturedAtInvoice: saved.maturedAtInvoice,
    },
  });

  return toInvoice(saved);
}

/**
 * Un-mark a campaign as invoiced — the bill was not sent after all. Addressed
 * by row id rather than campaign name: Almedia campaign names are free text
 * (spaces, accents, dashes) and do not survive a URL path segment intact.
 */
export async function deleteBookingInvoice(input: {
  requestedByUserId: string;
  invoiceId: string;
}): Promise<void> {
  await requireAlmediaAdminUser(input.requestedByUserId);

  const existing = await prisma.bookingInvoice.findUnique({
    where: { id: input.invoiceId },
    select: { id: true, campaignName: true, amount: true },
  });

  if (!existing) {
    throw new ServiceError(
      "ALMEDIA_INVOICE_NOT_FOUND",
      404,
      "No invoice recorded for that campaign",
    );
  }

  await prisma.bookingInvoice.delete({ where: { id: existing.id } });

  await recordAuditEvent({
    actorUserId: input.requestedByUserId,
    action: "almedia.invoice.deleted",
    entityType: "booking_invoice",
    entityId: existing.id,
    metadata: { campaignName: existing.campaignName, amount: existing.amount },
  });
}
