"use client";

import type { AlmediaCampaignRow, AlmediaDeal } from "@scouting-platform/contracts";
import Link from "next/link";
import React, { useMemo, useState } from "react";

import {
  ALMEDIA_RETURN_TIERS,
  EMPTY_CAMPAIGN_FILTERS,
  filterCampaigns,
  getMaturityInfo,
  getReturnTier,
  monthlyPerformance,
  platformGroups,
  returnTierGroups,
  sumCampaigns,
  weightedAverage,
  type CampaignFilters,
} from "../../lib/almedia/campaign-analytics";
import { downloadCampaignsCsv } from "../../lib/almedia/csv-export";
import { platformLabel } from "../../lib/almedia/labels";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { AlmediaInfoTip } from "./almedia-info-tip";
import { AlmediaPerformanceChart } from "./almedia-performance-chart";

/**
 * Performance tab — the raw, per-campaign record from Almedia. Where Insights
 * aggregates, this is the drill-down.
 */

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const wholeNumber = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });
const decimalNumber = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

type SortKey =
  | "campaignName"
  | "campaignSource"
  | "channelName"
  | "platform"
  | "country"
  | "publishedAt"
  | "cost"
  | "expectedCpm"
  | "viewCount"
  | "signupsPct"
  | "roasD7pD14"
  | "roasReturn"
  | "returnPct"
  | "appuD14"
  | "d7Purchases";

type SortState = Readonly<{ key: SortKey; direction: "asc" | "desc" }>;

const COLUMNS: ReadonlyArray<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: "campaignName", label: "Campaign" },
  { key: "campaignSource", label: "Source" },
  { key: "channelName", label: "Channel" },
  { key: "platform", label: "Platform" },
  { key: "country", label: "Country" },
  { key: "publishedAt", label: "Published" },
  { key: "cost", label: "Cost", numeric: true },
  { key: "expectedCpm", label: "Expected CPM", numeric: true },
  { key: "viewCount", label: "Views", numeric: true },
  { key: "signupsPct", label: "Signups", numeric: true },
  { key: "roasD7pD14", label: "D7 → D14 ROAS", numeric: true },
  { key: "roasReturn", label: "Lifetime ROAS", numeric: true },
  { key: "returnPct", label: "Return", numeric: true },
  { key: "appuD14", label: "APPU D14", numeric: true },
  { key: "d7Purchases", label: "D7 purchases", numeric: true },
];

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : "—";
}

function formatMetric(
  value: number | null,
  kind: "number" | "decimal" | "percent" | "return" | "roas" = "number",
): string {
  if (value === null) return "—";
  if (kind === "decimal") return decimalNumber.format(value);
  if (kind === "percent") return `${decimalNumber.format(value * 100)}%`;
  if (kind === "return") return `${decimalNumber.format(value)}%`;
  if (kind === "roas") return `${decimalNumber.format(value)}×`;
  return wholeNumber.format(value);
}

function returnTierLabel(value: number | null): string {
  const tier = getReturnTier(value);

  return ALMEDIA_RETURN_TIERS.find((item) => item.id === tier)?.label ?? "Unclassified";
}

function maturityBadge(publishedAt: string | null): {
  status: string;
  label: string;
} {
  const maturity = getMaturityInfo(publishedAt);

  if (maturity.status === "matured") {
    return { status: "matured", label: "Matured" };
  }

  if (maturity.status === "maturing") {
    return {
      status: "maturing",
      label: `Maturing · ${maturity.daysRemaining ?? "—"}d`,
    };
  }

  return { status: "unknown", label: "Unknown" };
}

function compareValues(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;

  return String(a).localeCompare(String(b));
}

function sortCampaigns(
  campaigns: readonly AlmediaCampaignRow[],
  sort: SortState,
): AlmediaCampaignRow[] {
  const sorted = [...campaigns].sort((a, b) =>
    compareValues(a[sort.key], b[sort.key]),
  );

  return sort.direction === "asc" ? sorted : sorted.reverse();
}

function KpiCard({
  label,
  value,
  context,
}: Readonly<{ label: string; value: string; context: string }>) {
  return (
    <article className="stat-card almedia-kpi">
      <p className="almedia-kpi__label">{label}</p>
      <strong className="almedia-kpi__value">{value}</strong>
      <span className="almedia-kpi__context">{context}</span>
    </article>
  );
}

export function AlmediaPerformanceTab({
  campaigns,
  deals = [],
}: Readonly<{
  campaigns: readonly AlmediaCampaignRow[];
  deals?: readonly AlmediaDeal[];
}>) {
  const [filters, setFilters] = useState<CampaignFilters>(EMPTY_CAMPAIGN_FILTERS);
  const [sort, setSort] = useState<SortState>({
    key: "publishedAt",
    direction: "desc",
  });

  const platforms = useMemo(
    () => [...new Set(campaigns.map((campaign) => campaign.platform))].sort(),
    [campaigns],
  );
  const countries = useMemo(
    () => [...new Set(campaigns.map((campaign) => campaign.country))].sort(),
    [campaigns],
  );
  const filtered = useMemo(
    () => filterCampaigns(campaigns, filters),
    [campaigns, filters],
  );
  // Tier counts ignore the tier filter, so the strip stays a stable frame of
  // reference while a tier is selected.
  const tierStats = useMemo(
    () => returnTierGroups(filterCampaigns(campaigns, { ...filters, returnTier: "all" })),
    [campaigns, filters],
  );
  const months = useMemo(() => monthlyPerformance(filtered), [filtered]);
  const platformStats = useMemo(() => platformGroups(filtered), [filtered]);
  const rows = useMemo(() => sortCampaigns(filtered, sort), [filtered, sort]);
  const catalogChannelIdByCampaign = useMemo(
    () =>
      new Map(
        deals.flatMap((deal) =>
          deal.campaignName
            ? [[deal.campaignName, deal.catalogChannelId] as const]
            : [],
        ),
      ),
    [deals],
  );

  const totalCost = sumCampaigns(filtered, "cost");
  const totalViews = sumCampaigns(filtered, "viewCount");
  const totalPurchases = sumCampaigns(filtered, "d7Purchases");
  const lifetimeRoas = weightedAverage(filtered, "roasReturn", "cost");
  const maxPlatformRoas = Math.max(...platformStats.map((item) => item.roas ?? 0), 1);

  function toggleSort(key: SortKey): void {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  function sortIndicator(key: SortKey): string {
    if (sort.key !== key) {
      return "";
    }

    return sort.direction === "asc" ? " ↑" : " ↓";
  }

  return (
    <div className="almedia-performance">
      <div className="almedia-section-heading">
        <h2>Your campaigns, clearly measured</h2>
        <AlmediaInfoTip align="start" label="What the Performance tab shows">
          <p>
            <strong>The raw, per-campaign record</strong> from Almedia: every published
            campaign with its full metric set.
          </p>
          <ul>
            <li>
              <span className="almedia-info-tip__term">Return %</span> is revenue vs
              cost.
            </li>
            <li>
              <span className="almedia-info-tip__term">ROAS</span> is return on ad spend
              (×).
            </li>
            <li>
              <span className="almedia-info-tip__term">APPU D14</span> is the average
              payment per user by day 14.
            </li>
          </ul>
        </AlmediaInfoTip>
      </div>

      <section aria-label="Campaign filters" className="almedia-filters">
        <label className="almedia-field almedia-field--search">
          <span>Search campaign</span>
          <input
            onChange={(event) => {
              setFilters({ ...filters, search: event.target.value });
            }}
            placeholder="Campaign or channel"
            type="search"
            value={filters.search}
          />
        </label>
        <label className="almedia-field">
          <span>Platform</span>
          <select
            onChange={(event) => {
              setFilters({ ...filters, platform: event.target.value });
            }}
            value={filters.platform}
          >
            <option value="all">All platforms</option>
            {platforms.map((platform) => (
              <option key={platform} value={platform}>
                {platformLabel(platform)}
              </option>
            ))}
          </select>
        </label>
        <label className="almedia-field">
          <span>Country</span>
          <select
            onChange={(event) => {
              setFilters({ ...filters, country: event.target.value });
            }}
            value={filters.country}
          >
            <option value="all">All countries</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label className="almedia-field">
          <span>Return tier</span>
          <select
            onChange={(event) => {
              setFilters({ ...filters, returnTier: event.target.value });
            }}
            value={filters.returnTier}
          >
            <option value="all">All return tiers</option>
            {ALMEDIA_RETURN_TIERS.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.label} · {tier.range}
              </option>
            ))}
          </select>
        </label>
        <label className="almedia-field">
          <span>Maturity</span>
          <select
            onChange={(event) => {
              setFilters({ ...filters, maturity: event.target.value });
            }}
            value={filters.maturity}
          >
            <option value="all">All maturity</option>
            <option value="matured">Matured · 14+ days</option>
            <option value="maturing">Maturing · under 14 days</option>
            <option value="unknown">Unknown publish date</option>
          </select>
        </label>
        <label className="almedia-field">
          <span>From</span>
          <input
            onChange={(event) => {
              setFilters({ ...filters, from: event.target.value });
            }}
            type="date"
            value={filters.from}
          />
        </label>
        <label className="almedia-field">
          <span>To</span>
          <input
            onChange={(event) => {
              setFilters({ ...filters, to: event.target.value });
            }}
            type="date"
            value={filters.to}
          />
        </label>
        <button
          className="workspace-button"
          onClick={() => {
            setFilters(EMPTY_CAMPAIGN_FILTERS);
          }}
          type="button"
        >
          Clear
        </button>
      </section>

      <section aria-label="Key performance indicators" className="almedia-kpi-grid">
        <KpiCard
          context={`${filtered.length} selected campaigns`}
          label="Total cost"
          value={compactNumber.format(totalCost)}
        />
        <KpiCard
          context={`${totalViews ? decimalNumber.format((totalCost / totalViews) * 1000) : "—"} cost per 1K views`}
          label="Total views"
          value={compactNumber.format(totalViews)}
        />
        <KpiCard
          context={`${totalViews ? decimalNumber.format((totalPurchases / totalViews) * 1000) : "—"} per 1K views`}
          label="D7 purchases"
          value={compactNumber.format(totalPurchases)}
        />
        <KpiCard
          context="Cost-weighted average"
          label="Lifetime ROAS"
          value={lifetimeRoas === null ? "—" : `${decimalNumber.format(lifetimeRoas)}×`}
        />
      </section>

      <section aria-labelledby="almedia-tier-heading" className="almedia-panel">
        <div className="almedia-panel__heading">
          <div className="almedia-section-heading">
            <h3 id="almedia-tier-heading">Return action tiers</h3>
            <AlmediaInfoTip align="start" label="What the return action tiers mean">
              <p>
                Every measured campaign falls into one <strong>action group</strong>{" "}
                based on its return %, so the next step is clear:
              </p>
              <ul>
                <li>
                  <span className="almedia-info-tip__term">Longterm</span> (over 100%):
                  it more than paid back. Extend or make it a longterm deal.
                </li>
                <li>
                  <span className="almedia-info-tip__term">Rebooking</span> (80 to
                  100%): solid, rebook as is.
                </li>
                <li>
                  <span className="almedia-info-tip__term">Price adjusted</span> (50 to
                  80%): only rebook after renegotiating the price down.
                </li>
                <li>
                  <span className="almedia-info-tip__term">Drop</span> (under 50%):
                  underperformed, drop or replace.
                </li>
              </ul>
              <p>Select any tier to filter the whole tab to it.</p>
            </AlmediaInfoTip>
          </div>
          <p className="almedia-subnote">
            {filters.returnTier === "all"
              ? "Select a tier to filter this tab"
              : `${ALMEDIA_RETURN_TIERS.find((tier) => tier.id === filters.returnTier)?.label ?? "Tier"} selected`}
          </p>
        </div>

        <div
          aria-label="Share of campaigns in each return action tier"
          className="almedia-tier-strip"
          role="img"
        >
          {tierStats.map((tier) => (
            <span
              className={`almedia-tier-strip__segment almedia-tier-strip__segment--${tier.id}`}
              key={tier.id}
              style={{ width: `${tier.share * 100}%` }}
              title={`${tier.label}: ${tier.count} campaigns`}
            />
          ))}
        </div>

        <div className="almedia-tier-grid">
          {tierStats.map((tier) => (
            <button
              aria-label={`Filter by ${tier.label}, ${tier.range}, ${tier.count} campaigns`}
              aria-pressed={filters.returnTier === tier.id}
              className={`almedia-tier-card almedia-tier-card--${tier.id}`}
              key={tier.id}
              onClick={() => {
                setFilters((current) => ({
                  ...current,
                  returnTier: current.returnTier === tier.id ? "all" : tier.id,
                }));
              }}
              type="button"
            >
              <span className="almedia-tier-card__name">
                <span aria-hidden="true" className="almedia-tier-card__dot" />
                <strong>{tier.label}</strong>
              </span>
              <b className="almedia-tier-card__count">
                {wholeNumber.format(tier.count)}
              </b>
              <span className="almedia-tier-card__range">
                {tier.range} ·{" "}
                {tier.averageReturn === null
                  ? "—"
                  : `${decimalNumber.format(tier.averageReturn)}% avg.`}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="almedia-chart-grid">
        <section className="almedia-panel">
          <div className="almedia-panel__heading">
            <div>
              <p className="almedia-eyebrow">Trend</p>
              <h3>Cost and lifetime ROAS</h3>
            </div>
            <p className="almedia-legend">
              <span>
                <i className="almedia-legend__bar" /> Cost
              </span>
              <span>
                <i className="almedia-legend__line" /> ROAS
              </span>
            </p>
          </div>
          <AlmediaPerformanceChart data={months} />
        </section>

        <section className="almedia-panel">
          <div className="almedia-panel__heading">
            <div>
              <p className="almedia-eyebrow">Mix</p>
              <h3>By platform</h3>
            </div>
          </div>
          {platformStats.length === 0 ? (
            <p className="almedia-chart-empty">No platform data for this selection.</p>
          ) : (
            <ul className="almedia-platform-list">
              {platformStats.map((item) => (
                <li className="almedia-platform-row" key={item.platform}>
                  <p className="almedia-platform-row__heading">
                    <span>{platformLabel(item.platform)}</span>
                    <strong>{formatMetric(item.roas, "roas")}</strong>
                  </p>
                  <div aria-hidden="true" className="almedia-progress">
                    <span
                      className="almedia-progress__fill"
                      style={{
                        width: `${((item.roas ?? 0) / maxPlatformRoas) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="almedia-subnote">
                    {item.campaigns} campaigns · {compactNumber.format(item.views)} views
                    · {compactNumber.format(item.cost)} cost
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="almedia-panel">
        <div className="almedia-panel__heading">
          <div>
            <p className="almedia-eyebrow">Campaign detail</p>
            <h3>All performance rows</h3>
          </div>
          <button
            className="workspace-button"
            disabled={filtered.length === 0}
            onClick={() => {
              downloadCampaignsCsv(filtered);
            }}
            type="button"
          >
            Export filtered CSV
          </button>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            description="No campaigns match the current filters."
            title="Nothing to show"
          />
        ) : (
          <DataTable caption="Every Almedia campaign field for the current filters" density="compact">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th
                    aria-sort={
                      sort.key === column.key
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={column.numeric ? "almedia-numeric" : undefined}
                    key={column.key}
                    scope="col"
                  >
                    <button
                      className="almedia-sort-button"
                      onClick={() => {
                        toggleSort(column.key);
                      }}
                      type="button"
                    >
                      {column.label}
                      {sortIndicator(column.key)}
                    </button>
                  </th>
                ))}
                <th scope="col">Action</th>
                <th scope="col">Maturity</th>
                <th scope="col">Video</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((campaign, index) => {
                const maturity = maturityBadge(campaign.publishedAt);
                const catalogChannelId =
                  catalogChannelIdByCampaign.get(campaign.campaignName) ?? null;

                return (
                  <tr
                    key={`${campaign.campaignName}-${campaign.publishedAt ?? "undated"}-${index}`}
                  >
                    <td>{campaign.campaignName}</td>
                    <td>{campaign.campaignSource}</td>
                    <td>
                      {campaign.channelName ? (
                        catalogChannelId ? (
                          <Link
                            className="almedia-link"
                            href={`/catalog/${catalogChannelId}`}
                          >
                            {campaign.channelName}
                          </Link>
                        ) : (
                          campaign.channelName
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{platformLabel(campaign.platform)}</td>
                    <td>{campaign.country}</td>
                    <td>{formatDate(campaign.publishedAt)}</td>
                    <td className="almedia-numeric">{formatMetric(campaign.cost)}</td>
                    <td className="almedia-numeric">
                      {formatMetric(campaign.expectedCpm, "decimal")}
                    </td>
                    <td className="almedia-numeric">
                      {formatMetric(campaign.viewCount)}
                    </td>
                    <td className="almedia-numeric">
                      {formatMetric(campaign.signupsPct, "percent")}
                    </td>
                    <td className="almedia-numeric">
                      {formatMetric(campaign.roasD7pD14, "roas")}
                    </td>
                    <td className="almedia-numeric">
                      {formatMetric(campaign.roasReturn, "roas")}
                    </td>
                    <td className="almedia-numeric almedia-numeric--emphasis">
                      {formatMetric(campaign.returnPct, "return")}
                    </td>
                    <td className="almedia-numeric">
                      {formatMetric(campaign.appuD14, "decimal")}
                    </td>
                    <td className="almedia-numeric">
                      {formatMetric(campaign.d7Purchases)}
                    </td>
                    <td>
                      <span
                        className={`almedia-badge almedia-badge--${getReturnTier(campaign.returnPct) ?? "unclassified"}`}
                      >
                        {returnTierLabel(campaign.returnPct)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`almedia-badge almedia-badge--${maturity.status}`}
                      >
                        {maturity.label}
                      </span>
                    </td>
                    <td>
                      {campaign.videoUrl ? (
                        <a
                          className="almedia-link"
                          href={campaign.videoUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                          title="Open published video"
                        >
                          Open ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </DataTable>
        )}
      </section>
    </div>
  );
}
