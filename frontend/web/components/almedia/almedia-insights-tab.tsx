"use client";

import {
  ALMEDIA_DIMENSIONS,
  type AlmediaDeal,
  type AlmediaDimensionId,
  type AlmediaDimensionOptions,
} from "@scouting-platform/contracts";
import React, { useMemo, useState, type ReactNode } from "react";

import { filterDeals, totalsOf } from "../../lib/almedia/filters";
import {
  formatCount,
  formatEur,
  formatMoney,
  formatPct,
} from "../../lib/almedia/format";
import {
  bookingStatusLabel,
  monthLabel,
  platformLabel,
} from "../../lib/almedia/labels";
import { ALL_ALMEDIA_FILTERS, type AlmediaFilters } from "../../lib/almedia/types";
import { SearchableSelect } from "../ui/searchable-select";
import { AlmediaWidgetCard } from "./almedia-widget-card";
import { BestDealsWidget } from "./widgets/best-deals-widget";
import { BudgetWidget } from "./widgets/budget-widget";
import { ConcentrationWidget } from "./widgets/concentration-widget";
import { EfficiencyWidget } from "./widgets/efficiency-widget";
import { HeatmapWidget } from "./widgets/heatmap-widget";
import { MaturityWidget } from "./widgets/maturity-widget";
import { PainPointsWidget } from "./widgets/pain-points-widget";
import { PublishedWidget } from "./widgets/published-widget";
import { RebookingWidget } from "./widgets/rebooking-widget";
import { ReturnDistributionWidget } from "./widgets/return-distribution-widget";
import { ReturnsWidget } from "./widgets/returns-widget";
import { SuggestionsWidget } from "./widgets/suggestions-widget";
import { TrendWidget } from "./widgets/trend-widget";
import { UnitEconomicsWidget } from "./widgets/unit-economics-widget";
import { ViewsWidget } from "./widgets/views-widget";

/**
 * Insights tab — live Almedia data joined with the internal booking tracker.
 * One filter bar drives every widget below.
 *
 * Two things from the standalone tracker are deliberately absent in Phase 1:
 * the drag-and-resize grid (this is a fixed CSS grid) and the AI analyst,
 * action plan, and vertical-enrichment panel, which all depend on work that
 * ships in Phase 2.
 */

/** High-cardinality dimensions get a searchable combobox instead of a select. */
const SEARCHABLE_DIMENSIONS: ReadonlySet<AlmediaDimensionId> = new Set([
  "cm",
  "country",
  "vertical",
  "category",
]);

function optionLabel(dimension: AlmediaDimensionId, value: string): string {
  if (dimension === "platform") {
    return platformLabel(value);
  }

  if (dimension === "month") {
    return monthLabel(value);
  }

  if (dimension === "status") {
    return bookingStatusLabel(
      value as Parameters<typeof bookingStatusLabel>[0],
    );
  }

  return value;
}

type WidgetMeta = Readonly<{
  id: string;
  title: string;
  eyebrow: string;
  /** Plain-language "what this shows", surfaced through the widget's (i). */
  info: ReactNode;
  render: (deals: readonly AlmediaDeal[]) => ReactNode;
  wide?: boolean;
}>;

const WIDGETS: readonly WidgetMeta[] = [
  {
    id: "suggestions",
    title: "Booking suggestions",
    eyebrow: "What to book next",
    wide: true,
    info: (
      <>
        <p>
          <strong>Booking calls for CLs and CMs</strong>, based on the numbers in view:
          which niches to book more of, which channels to rebook, which creator profile
          to look for, and where to cut back.
        </p>
        <p>
          Every line uses only <em>matured</em> returns (14+ days since publish), so a
          suggestion is never based on a deal that is still settling.
        </p>
      </>
    ),
    render: (deals) => <SuggestionsWidget deals={deals} />,
  },
  {
    id: "returns",
    title: "Returns by parameter",
    eyebrow: "Outreach steering",
    info: (
      <>
        <p>
          <strong>Cost-weighted average return %</strong>, grouped by whatever you pick
          (CM, market, vertical, platform, size). Bigger spend counts for more, so it
          reflects where the money actually landed.
        </p>
        <p>
          Colours follow the action tiers: green over 100% (longterm), grey 80–100%
          (rebook), amber 50–80% (adjust price), red under 50% (drop).
        </p>
      </>
    ),
    render: (deals) => <ReturnsWidget deals={deals} />,
  },
  {
    id: "views",
    title: "Views vs realised views",
    eyebrow: "Where we stand",
    info: (
      <p>
        Compares the <strong>views we expected</strong> (based on the price we paid)
        against the <strong>views actually delivered</strong>. A shortfall means the CPMs
        were priced too optimistically for that segment.
      </p>
    ),
    render: (deals) => <ViewsWidget deals={deals} />,
  },
  {
    id: "published",
    title: "Published content",
    eyebrow: "Delivery pipeline",
    info: (
      <p>
        How many booked deals have actually <strong>published</strong> versus still
        pending. A low published share flags creators to chase or timelines to fix.
      </p>
    ),
    render: (deals) => <PublishedWidget deals={deals} />,
  },
  {
    id: "distribution",
    title: "Return distribution",
    eyebrow: "Portfolio spread",
    info: (
      <p>
        How the portfolio&apos;s <strong>spend spreads across return bands</strong> (under
        50% up to 150% or more). Shows whether returns are healthy overall or carried by a
        few winners, plus the median.
      </p>
    ),
    render: (deals) => <ReturnDistributionWidget deals={deals} />,
  },
  {
    id: "unit-economics",
    title: "Unit economics",
    eyebrow: "CPM · cost per user · APPU",
    info: (
      <>
        <p>
          What acquisition <strong>costs and returns per user</strong>. Expected vs
          realised eCPM shows delivery quality; cost per signup and per D7 purchase show
          efficiency.
        </p>
        <p>
          <em>APPU · D14</em> is the average payment per user by day 14, weighted by the
          number of users behind each campaign. Signups and purchases are modeled by
          Almedia and do not chain into a single funnel.
        </p>
      </>
    ),
    render: (deals) => <UnitEconomicsWidget deals={deals} />,
  },
  {
    id: "heatmap",
    title: "Segment heatmap",
    eyebrow: "Return by two dimensions",
    wide: true,
    info: (
      <p>
        Cost-weighted return across <strong>two dimensions at once</strong> (market by
        vertical by default). Green cells with real spend behind them are where to focus;
        red cells are where to cut back. Hover any cell for its deal count.
      </p>
    ),
    render: (deals) => <HeatmapWidget deals={deals} />,
  },
  {
    id: "budget",
    title: "Budget",
    eyebrow: "Per CM · country · category",
    info: (
      <p>
        <strong>Live Almedia spend and booked INT budget</strong>, broken down per CM,
        market, or category. Use it to see who is spending where.
      </p>
    ),
    render: (deals) => <BudgetWidget deals={deals} />,
  },
  {
    id: "best-deals",
    title: "Best deals per CM",
    eyebrow: "Leaderboard",
    info: (
      <p>
        Each CM&apos;s <strong>top-returning deals</strong>. Shows who is sourcing the
        strongest channels and which deals to use as examples.
      </p>
    ),
    render: (deals) => <BestDealsWidget deals={deals} />,
  },
  {
    id: "pain-points",
    title: "Pain points",
    eyebrow: "Market · vertical · size",
    info: (
      <p>
        <strong>Problem segments</strong> flagged automatically (low return,
        under-delivery, publishing lag, or high dropout) by market, vertical, and deal
        size, ranked by severity so the biggest issues show first.
      </p>
    ),
    render: (deals) => <PainPointsWidget deals={deals} />,
  },
  {
    id: "concentration",
    title: "Spend concentration",
    eyebrow: "Pareto · dependency risk",
    info: (
      <p>
        How much of the budget sits with the <strong>top few channels</strong>. High
        concentration is a risk: if a top channel drops off, a big slice of return goes
        with it.
      </p>
    ),
    render: (deals) => <ConcentrationWidget deals={deals} />,
  },
  {
    id: "efficiency",
    title: "Efficiency scatter",
    eyebrow: "Spend vs return",
    info: (
      <p>
        Every measured deal plotted by <strong>spend (x) against return % (y)</strong>,
        with bubble size for views. Top-right is big spend paying off; bottom-right is big
        spend underperforming and worth a closer look.
      </p>
    ),
    render: (deals) => <EfficiencyWidget deals={deals} />,
  },
  {
    id: "trend",
    title: "Return trend",
    eyebrow: "By publish month",
    info: (
      <p>
        Cost-weighted <strong>return by publish month</strong> as a line, with spend as
        columns behind it. The dashed line marks the 100% longterm threshold.
      </p>
    ),
    render: (deals) => <TrendWidget deals={deals} />,
  },
  {
    id: "rebooking",
    title: "Rebooking & round lift",
    eyebrow: "Do re-bookings pay off?",
    info: (
      <p>
        Return by <strong>booking round</strong> (R1, R2, R3). Does re-engaging a creator
        improve performance? Also shows the rebook rate: the share of channels booked more
        than once.
      </p>
    ),
    render: (deals) => <RebookingWidget deals={deals} />,
  },
  {
    id: "maturity",
    title: "Maturity mix",
    eyebrow: "Matured vs still accruing",
    info: (
      <p>
        Splits live campaigns into <strong>matured</strong> (14+ days, return is
        trustworthy) and <strong>still accruing</strong>. A maturing return is not final,
        so read it with caution.
      </p>
    ),
    render: (deals) => <MaturityWidget deals={deals} />,
  },
];

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

type AlmediaInsightsTabProps = Readonly<{
  deals: readonly AlmediaDeal[];
  options: AlmediaDimensionOptions;
}>;

export function AlmediaInsightsTab({ deals, options }: AlmediaInsightsTabProps) {
  const [filters, setFilters] = useState<AlmediaFilters>(ALL_ALMEDIA_FILTERS);

  const filtered = useMemo(() => filterDeals(deals, filters), [deals, filters]);
  const totals = useMemo(() => totalsOf(filtered), [filtered]);

  const setFilter = (id: AlmediaDimensionId, value: string): void => {
    setFilters((current) => ({ ...current, [id]: value }));
  };
  const hasActiveFilters = ALMEDIA_DIMENSIONS.some(({ id }) => filters[id] !== "all");

  return (
    <div className="almedia-insights">
      <div className="almedia-filter-bar">
        {ALMEDIA_DIMENSIONS.map(({ id, label }) => {
          const values = options[id] ?? [];

          if (SEARCHABLE_DIMENSIONS.has(id)) {
            return (
              <div className="almedia-filter" key={id}>
                <span className="almedia-filter__label" id={`almedia-filter-${id}`}>
                  {label}
                </span>
                <SearchableSelect
                  ariaLabel={`Filter by ${label}`}
                  onChange={(value) => {
                    setFilter(id, value === "" ? "all" : value);
                  }}
                  options={[
                    { value: "all", label: `All ${label.toLowerCase()}` },
                    ...values.map((value) => ({
                      value,
                      label: optionLabel(id, value),
                    })),
                  ]}
                  placeholder={`All ${label.toLowerCase()}`}
                  value={filters[id]}
                />
              </div>
            );
          }

          return (
            <label className="almedia-filter" key={id}>
              <span className="almedia-filter__label">{label}</span>
              <select
                onChange={(event) => {
                  setFilter(id, event.target.value);
                }}
                value={filters[id]}
              >
                <option value="all">All</option>
                {values.map((value) => (
                  <option key={value} value={value}>
                    {optionLabel(id, value)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <button
          className="workspace-button workspace-button--secondary"
          disabled={!hasActiveFilters}
          onClick={() => {
            setFilters(ALL_ALMEDIA_FILTERS);
          }}
          type="button"
        >
          Clear filters
        </button>
      </div>

      <section aria-label="Key performance indicators" className="almedia-kpi-grid">
        <KpiCard
          context={`${totals.campaigns} campaigns across ${totals.markets} ${
            totals.markets === 1 ? "market" : "markets"
          }`}
          label="Live spend"
          value={formatEur(totals.cost)}
        />
        <KpiCard
          context="from the internal tracker"
          label="Booked budget (INT)"
          value={formatEur(totals.intBudget)}
        />
        <KpiCard
          context="cost-weighted · >100% goes longterm"
          label="Avg return"
          value={formatPct(totals.avgReturnPct)}
        />
        <KpiCard
          context={`${formatCount(totals.actualViews)} of ${formatCount(totals.expectedViews)} expected`}
          label="View delivery"
          value={formatPct(totals.deliveryPct)}
        />
        <KpiCard
          context="avg. payment per user · weighted by users"
          label="APPU · D14"
          value={formatMoney(totals.avgAppuD14)}
        />
      </section>

      <div className="almedia-widget-grid">
        {WIDGETS.map((widget) => (
          <AlmediaWidgetCard
            eyebrow={widget.eyebrow}
            info={widget.info}
            key={widget.id}
            title={widget.title}
            wide={widget.wide ?? false}
          >
            {widget.render(filtered)}
          </AlmediaWidgetCard>
        ))}
      </div>
    </div>
  );
}
