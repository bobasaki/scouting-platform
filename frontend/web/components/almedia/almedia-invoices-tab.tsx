"use client";

import type { AlmediaDeal, BookingInvoice } from "@scouting-platform/contracts";
import React, { useCallback, useMemo, useState } from "react";

import { deleteAlmediaInvoice, recordAlmediaInvoice } from "../../lib/almedia-api";
import { formatPct, formatUsd } from "../../lib/almedia/format";
import {
  buildInvoiceBatches,
  buildInvoiceMonths,
  COST_INVOICED_THROUGH,
  invoiceAmount,
  invoiceTotals,
  prevMonth,
  undatedSpend,
  BASE_MARKUP,
  type BatchMember,
  type InvoiceBatch,
  type InvoiceMonth,
} from "../../lib/almedia/invoicing";
import { monthLabel } from "../../lib/almedia/labels";
import { AlmediaInfoTip } from "./almedia-info-tip";

/**
 * Invoices — the billing view. The money on any single calendar month's invoice
 * comes from two different publish batches: THIS month's cost plus LAST month's
 * performance fee. The view leads with the calendar-month lens (the July invoice
 * = July cost + June fee) and keeps a per-publish-month accordion below for the
 * campaign detail behind each fee.
 *
 * Ported from the standalone tracker's `InvoicesView`, with the invoice
 * snapshots wired up: marking a campaign invoiced writes a `booking_invoices`
 * row, so a bill sent before maturity shows what is still owed once the
 * campaign climbs a tier.
 *
 * Everything here is USD. The Almedia `cost` field is dollars, unlike the EUR
 * booking budgets the other tabs show.
 */

const INVOICED_LABEL = monthLabel(COST_INVOICED_THROUGH);

function markupLabel(markup: number): string {
  return `+${Math.round(markup * 100)}%`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

/**
 * One calendar month's invoice, split into its two components: cost from
 * campaigns published this month, and the fee carried from last month's batch.
 */
function InvoiceMonthCard({ entry }: Readonly<{ entry: InvoiceMonth }>) {
  const feeFrom = entry.feeBatch?.label ?? monthLabel(prevMonth(entry.month));
  const hasFee =
    entry.feeBatch !== null && (entry.carriedFee > 0 || entry.feePending > 0);

  return (
    <article className="almedia-invoice-card">
      <header className="almedia-invoice-card__head">
        <span className="almedia-invoice-card__month">{entry.label}</span>
        <span className="almedia-invoice-card__total">{formatUsd(entry.total)}</span>
      </header>

      <dl className="almedia-invoice-card__lines">
        <div className="almedia-invoice-card__line">
          <dt>
            <span>New cost</span>
            <small>
              {entry.costBatch
                ? `from campaigns published in ${entry.label}`
                : "no campaigns published"}
            </small>
          </dt>
          <dd>
            <span className="almedia-invoice-card__amount">
              {formatUsd(entry.newCost)}
            </span>
            {entry.costBatch ? (
              <span
                className={
                  entry.costInvoiced
                    ? "almedia-chip almedia-chip--done"
                    : "almedia-chip almedia-chip--due"
                }
              >
                {entry.costInvoiced ? "Invoiced" : "Due"}
              </span>
            ) : null}
          </dd>
        </div>

        <div className="almedia-invoice-card__line">
          <dt>
            <span>Performance fee</span>
            <small>carried from {feeFrom}</small>
          </dt>
          <dd>
            {!hasFee ? (
              <>
                <span className="almedia-invoice-card__amount almedia-invoice-card__amount--zero">
                  {formatUsd(0)}
                </span>
                <span className="almedia-chip">No fee</span>
              </>
            ) : !entry.feeSettled ? (
              <>
                <span className="almedia-invoice-card__amount">
                  ~{formatUsd(entry.feePending)}
                </span>
                <span className="almedia-chip almedia-chip--pending">Maturing</span>
              </>
            ) : entry.carriedFee > 0 ? (
              <>
                <span className="almedia-invoice-card__amount">
                  {formatUsd(entry.carriedFee)}
                </span>
                <span className="almedia-chip almedia-chip--fee">Due</span>
              </>
            ) : (
              <>
                <span className="almedia-invoice-card__amount almedia-invoice-card__amount--zero">
                  {formatUsd(0)}
                </span>
                <span className="almedia-chip">No fee</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      <footer className="almedia-invoice-card__foot">
        <span>To invoice in {entry.label}</span>
        <strong>{formatUsd(entry.total)}</strong>
      </footer>
    </article>
  );
}

type BatchMemberRowProps = Readonly<{
  member: BatchMember;
  isBusy: boolean;
  onToggleInclude: (member: BatchMember) => void;
  onRecord: (member: BatchMember) => void;
  onUnrecord: (invoice: BookingInvoice) => void;
}>;

function BatchMemberRow({
  member,
  isBusy,
  onToggleInclude,
  onRecord,
  onUnrecord,
}: BatchMemberRowProps) {
  const matured = member.status === "matured";
  const { invoice } = member;

  return (
    <li
      className={
        member.included
          ? "almedia-batch-member almedia-batch-member--included"
          : "almedia-batch-member"
      }
    >
      <label className="almedia-batch-member__check">
        <input
          checked={member.included}
          disabled={matured}
          onChange={() => {
            onToggleInclude(member);
          }}
          title={
            matured
              ? "Matured campaigns always count toward the fee"
              : "Add to the fee blend"
          }
          type="checkbox"
        />
        <span className="almedia-batch-member__name">
          {member.channelName}
          {member.round === null ? null : (
            <em className="almedia-batch-member__round">R{member.round}</em>
          )}
          {matured ? null : (
            <em className="almedia-batch-member__maturing">
              {member.daysRemaining === null
                ? "maturing"
                : `${member.daysRemaining}d left`}
            </em>
          )}
        </span>
      </label>

      <span className="almedia-batch-member__meta">
        {formatPct(member.memberReturn)} · own {markupLabel(member.ownTier.markup)}
        {member.included && member.performanceFee > 0
          ? ` · fee +${formatUsd(member.performanceFee)}`
          : ""}
        {invoice === null ? null : (
          <>
            {" · "}
            <span className="almedia-batch-member__billed">
              billed {formatUsd(invoice.amount)} at {markupLabel(
                invoice.tier === "c100" ? 1 : Number(invoice.tier.slice(1)) / 100,
              )}
            </span>
            {member.topUp !== null && member.topUp > 0 ? (
              <span className="almedia-batch-member__topup">
                {" "}
                · {formatUsd(member.topUp)} still owed
              </span>
            ) : null}
          </>
        )}
      </span>

      <strong className="almedia-batch-member__amount">
        {formatUsd(member.cost)}
      </strong>

      <button
        className={
          invoice === null
            ? "workspace-button workspace-button--small workspace-button--secondary"
            : "workspace-button workspace-button--small"
        }
        disabled={isBusy}
        onClick={() => {
          if (invoice === null) {
            onRecord(member);
          } else {
            onUnrecord(invoice);
          }
        }}
        type="button"
      >
        {invoice === null ? "Mark invoiced" : "Undo"}
      </button>
    </li>
  );
}

function CostChip({ batch }: Readonly<{ batch: InvoiceBatch }>) {
  if (batch.costInvoiced) {
    return <span className="almedia-chip almedia-chip--done">Cost invoiced</span>;
  }

  return (
    <span className="almedia-chip almedia-chip--due">
      Cost due {formatUsd(batch.baseTotal)}
    </span>
  );
}

function FeeChip({ batch }: Readonly<{ batch: InvoiceBatch }>) {
  if (!batch.feeSettled) {
    return <span className="almedia-chip almedia-chip--pending">Fee pending</span>;
  }

  if (batch.performanceFee > 0) {
    return (
      <span className="almedia-chip almedia-chip--fee">
        Fee due +{formatUsd(batch.performanceFee)}
      </span>
    );
  }

  return <span className="almedia-chip">No fee</span>;
}

type BatchRowProps = Readonly<{
  batch: InvoiceBatch;
  busyCampaign: string | null;
  onToggleInclude: (member: BatchMember) => void;
  onRecord: (member: BatchMember) => void;
  onUnrecord: (invoice: BookingInvoice) => void;
}>;

function BatchRow({
  batch,
  busyCampaign,
  onToggleInclude,
  onRecord,
  onUnrecord,
}: BatchRowProps) {
  return (
    <details className="almedia-batch">
      <summary className="almedia-batch__summary">
        <span className="almedia-batch__month">
          {batch.label}
          <em>
            {batch.memberCount} {batch.memberCount === 1 ? "campaign" : "campaigns"}
          </em>
        </span>
        <span className="almedia-batch__chips">
          <CostChip batch={batch} />
          <FeeChip batch={batch} />
        </span>
        <span className="almedia-batch__blend">
          {batch.feeSettled ? "blended" : "so far"}{" "}
          {formatPct(batch.blendedReturn)} · {batch.tier.label}
        </span>
        <span className="almedia-batch__total">{formatUsd(batch.amount)}</span>
      </summary>

      <div className="almedia-batch__body">
        <p className="almedia-batch__stages">
          <span>
            <strong>Stage 1 · Cost</strong> {formatUsd(batch.baseTotal)},{" "}
            {batch.costInvoiced ? (
              <span className="almedia-tone-good">invoiced in {batch.label}</span>
            ) : (
              <span className="almedia-tone-bad">
                due on the {batch.label} invoice
              </span>
            )}
          </span>
          <span>
            <strong>Stage 2 · Performance fee</strong>{" "}
            {!batch.feeSettled ? (
              <>pending, cohort still maturing ({batch.maturingCount} to go)</>
            ) : batch.performanceFee > 0 ? (
              <>
                <span className="almedia-tone-good">
                  +{formatUsd(batch.performanceFee)}
                </span>
                , lands on the {monthLabel(batch.feeMonth)} invoice
              </>
            ) : (
              <>none, blended return under 100%</>
            )}
          </span>
        </p>

        <p className="almedia-batch__sub">
          {batch.includedCount} of {batch.memberCount} matured · INT{" "}
          {formatUsd(batch.intTotal)}
          {batch.maturingCount > 0
            ? ` · ${batch.maturingCount} maturing, tick to add to the fee blend`
            : ""}
          {batch.invoicedCount > 0
            ? ` · ${batch.invoicedCount} invoiced`
            : ""}
          {batch.topUpTotal > 0
            ? ` · ${formatUsd(batch.topUpTotal)} owed beyond what was billed`
            : ""}
        </p>

        <ul className="almedia-batch__members">
          {batch.members.map((member) => (
            <BatchMemberRow
              isBusy={busyCampaign === member.campaignName}
              key={member.campaignName}
              member={member}
              onRecord={onRecord}
              onToggleInclude={onToggleInclude}
              onUnrecord={onUnrecord}
            />
          ))}
        </ul>
      </div>
    </details>
  );
}

type AlmediaInvoicesTabProps = Readonly<{
  deals: readonly AlmediaDeal[];
  invoices: readonly BookingInvoice[];
  onMutated: () => void;
}>;

export function AlmediaInvoicesTab({
  deals,
  invoices,
  onMutated,
}: AlmediaInvoicesTabProps) {
  const [month, setMonth] = useState("all");
  const [includedCampaigns, setIncludedCampaigns] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [busyCampaign, setBusyCampaign] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const invoicesByCampaign = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.campaignName, invoice])),
    [invoices],
  );

  // Batches are built from every deal so each fee cohort is complete; the month
  // filter narrows the display, never the fee math.
  const allBatches = useMemo(
    () =>
      buildInvoiceBatches(deals, {
        includedCampaigns,
        invoices: invoicesByCampaign,
      }),
    [deals, includedCampaigns, invoicesByCampaign],
  );
  const invoiceMonths = useMemo(() => buildInvoiceMonths(allBatches), [allBatches]);

  const selectedLabel = month === "all" ? null : monthLabel(month);

  // The filter is the calendar INVOICE month. Selecting July shows the July
  // card and the two publish batches feeding it: July (cost) and June (fee).
  const visibleMonths = useMemo(
    () =>
      month === "all"
        ? invoiceMonths
        : invoiceMonths.filter((entry) => entry.month === month),
    [invoiceMonths, month],
  );
  const visibleBatches = useMemo(() => {
    if (month === "all") {
      return allBatches;
    }

    const keep = new Set([month, prevMonth(month)]);

    return allBatches.filter((batch) => keep.has(batch.month));
  }, [allBatches, month]);

  const totals = useMemo(() => invoiceTotals(visibleMonths), [visibleMonths]);
  const campaignCount = useMemo(
    () => visibleBatches.reduce((sum, batch) => sum + batch.memberCount, 0),
    [visibleBatches],
  );
  const undated = useMemo(() => undatedSpend(deals), [deals]);

  const handleToggleInclude = useCallback((member: BatchMember) => {
    // Matured campaigns always count toward the fee; there is nothing to toggle.
    if (member.status === "matured") {
      return;
    }

    setIncludedCampaigns((current) => {
      const next = new Set(current);

      if (next.has(member.campaignName)) {
        next.delete(member.campaignName);
      } else {
        next.add(member.campaignName);
      }

      return next;
    });
  }, []);

  const handleRecord = useCallback(
    (member: BatchMember) => {
      // Snapshot the full commissioned charge this campaign has earned, at the
      // tier it earns on its own — that is the figure the bill goes out at.
      const amount = invoiceAmount(
        member.cost,
        member.memberReturn === null
          ? null
          : member.memberReturn * (1 + BASE_MARKUP),
      );

      if (amount === null) {
        return;
      }

      setBusyCampaign(member.campaignName);
      setMutationError(null);

      void recordAlmediaInvoice({
        campaignName: member.campaignName,
        channelName: member.channelName,
        invoicedAt: new Date().toISOString(),
        maturedAtInvoice: member.status === "matured",
        cost: member.cost,
        returnPct: member.memberReturn,
        tier: member.ownTier.id,
        amount,
      })
        .then(() => {
          onMutated();
        })
        .catch((error: unknown) => {
          setMutationError(
            getErrorMessage(error, "Unable to record the invoice."),
          );
        })
        .finally(() => {
          setBusyCampaign(null);
        });
    },
    [onMutated],
  );

  const handleUnrecord = useCallback(
    (invoice: BookingInvoice) => {
      setBusyCampaign(invoice.campaignName);
      setMutationError(null);

      void deleteAlmediaInvoice(invoice.id)
        .then(() => {
          onMutated();
        })
        .catch((error: unknown) => {
          setMutationError(
            getErrorMessage(error, "Unable to remove the invoice record."),
          );
        })
        .finally(() => {
          setBusyCampaign(null);
        });
    },
    [onMutated],
  );

  return (
    <div className="almedia-invoices">
      <div className="almedia-section-heading">
        <h2>What is still to invoice?</h2>
        <AlmediaInfoTip align="start" label="How invoicing works">
          <p>
            <strong>Each calendar month&apos;s invoice has two parts, both in USD.</strong>{" "}
            A campaign is billed across two months, so any single invoice mixes two
            batches.
          </p>
          <ul>
            <li>
              <span className="almedia-info-tip__term">New cost</span> — the raw
              Almedia cost of campaigns published that same month, invoiced up
              front, matured or not.
            </li>
            <li>
              <span className="almedia-info-tip__term">Carried fee</span> — last
              month&apos;s performance fee, Σ INT × (1 + commission) − Σ cost (INT =
              cost ÷ 1.2), billed once that batch&apos;s return settles. June&apos;s
              fee lands on the July invoice.
            </li>
            <li>
              <span className="almedia-info-tip__term">Blended return</span> = Σ
              media spend (return % × cost ÷ 100) ÷ Σ INT picks one commission tier
              for the month&apos;s matured cohort.
            </li>
            <li>
              <span className="almedia-info-tip__term">Already invoiced</span> — the
              client is paid up on cost through {INVOICED_LABEL}. Marking a campaign
              invoiced records what it was billed, so a bill sent before maturity
              shows what is still owed once it climbs a tier.
            </li>
          </ul>
        </AlmediaInfoTip>
      </div>

      <p className="almedia-invoices__lede">
        Each month&apos;s invoice is{" "}
        <strong>this month&apos;s cost plus last month&apos;s performance fee</strong>.
        Cost is invoiced up front through <strong>{INVOICED_LABEL}</strong>; no
        performance fees have been billed yet, so everything below marks what is
        still due.
      </p>

      {mutationError ? (
        <p className="almedia-sync-warning" role="alert">
          {mutationError}
        </p>
      ) : null}

      <section aria-label="Billing totals" className="almedia-kpi-grid">
        <article className="stat-card almedia-kpi">
          <p className="almedia-kpi__label">
            To invoice {selectedLabel ? `in ${selectedLabel}` : "now"}
          </p>
          <strong className="almedia-kpi__value">{formatUsd(totals.dueNow)}</strong>
          <span className="almedia-kpi__context">
            unbilled cost + settled performance fees
          </span>
        </article>
        <article className="stat-card almedia-kpi">
          <p className="almedia-kpi__label">Performance fees due</p>
          <strong className="almedia-kpi__value">{formatUsd(totals.feesDue)}</strong>
          <span className="almedia-kpi__context">
            on settled months
            {totals.feesPending > 0
              ? ` · ${formatUsd(totals.feesPending)} still maturing`
              : ""}
          </span>
        </article>
        <article className="stat-card almedia-kpi">
          <p className="almedia-kpi__label">Cost to invoice</p>
          <strong className="almedia-kpi__value">{formatUsd(totals.costDue)}</strong>
          <span className="almedia-kpi__context">
            publish months after {INVOICED_LABEL}
          </span>
        </article>
        <article className="stat-card almedia-kpi">
          <p className="almedia-kpi__label">Already invoiced</p>
          <strong className="almedia-kpi__value">
            {formatUsd(totals.costInvoiced)}
          </strong>
          <span className="almedia-kpi__context">
            cost up front through {INVOICED_LABEL}
          </span>
        </article>
      </section>

      <div className="almedia-invoices__toolbar">
        <label className="almedia-field">
          <span>Invoice month</span>
          <select
            onChange={(event) => {
              setMonth(event.target.value);
            }}
            value={month}
          >
            <option value="all">All months</option>
            {invoiceMonths.map((entry) => (
              <option key={entry.month} value={entry.month}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <p className="almedia-invoices__count">
          {campaignCount} {campaignCount === 1 ? "campaign" : "campaigns"} in view
        </p>
        <button
          className="workspace-button workspace-button--secondary"
          disabled={month === "all"}
          onClick={() => {
            setMonth("all");
          }}
          type="button"
        >
          Clear
        </button>
      </div>

      {visibleMonths.length === 0 ? (
        <p className="almedia-widget__empty">
          No invoice activity for this month. A campaign needs a cost and a publish
          date before it can be placed on a bill.
        </p>
      ) : (
        <>
          <section
            aria-label="Invoices by calendar month"
            className="almedia-invoices__panel"
          >
            <header className="almedia-invoices__panel-head">
              <h3>By invoice month</h3>
              <span>what lands on each calendar month&apos;s invoice</span>
            </header>
            <div className="almedia-invoices__month-grid">
              {visibleMonths.map((entry) => (
                <InvoiceMonthCard entry={entry} key={entry.month} />
              ))}
            </div>
          </section>

          <section
            aria-label="Publish batches feeding the invoices"
            className="almedia-invoices__panel"
          >
            <header className="almedia-invoices__panel-head">
              <h3>By publish month</h3>
              <span>
                {visibleBatches.length}{" "}
                {visibleBatches.length === 1 ? "batch" : "batches"} · the campaign
                detail behind each fee
              </span>
            </header>
            <div className="almedia-invoices__batches">
              {visibleBatches.map((batch) => (
                <BatchRow
                  batch={batch}
                  busyCampaign={busyCampaign}
                  key={batch.month}
                  onRecord={handleRecord}
                  onToggleInclude={handleToggleInclude}
                  onUnrecord={handleUnrecord}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <p className="almedia-invoices__footnote">
        Each calendar month&apos;s invoice = new cost (campaigns published that
        month, billed up front) + the performance fee carried from the previous
        month&apos;s batch. The fee = Σ INT × (1 + commission) − Σ cost, floored at
        zero, where commission comes from the batch&apos;s blended return (&lt;100%
        +20% · 100% +25% · 110% +30% · 130% +40% · 150% +50% · 180% +60% · 250% +80%
        · ≥330% +100%). Matured = 14+ days since publish. Months with no activity
        do not appear.
        {undated.count > 0
          ? ` ${undated.count} campaign${undated.count === 1 ? "" : "s"} (${formatUsd(undated.cost)}) ${undated.count === 1 ? "has" : "have"} a cost but no publish date, so ${undated.count === 1 ? "it is" : "they are"} not scheduled to a month.`
          : ""}
      </p>
    </div>
  );
}
