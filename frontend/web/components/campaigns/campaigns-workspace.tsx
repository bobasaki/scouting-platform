"use client";

import {
  CAMPAIGN_STATUS_OPTIONS,
  type CampaignSummary,
  type ListCampaignsResponse,
} from "@scouting-platform/contracts";
import React, { useMemo, useState } from "react";

import { MONTH_LABELS } from "../../lib/countries";
import { SearchableMultiSelect, type SearchableMultiSelectOption } from "../ui/searchable-multi-select";
import { SearchableSelect, type SearchableSelectOption } from "../ui/searchable-select";

type CampaignsWorkspaceProps = Readonly<{
  initialData: ListCampaignsResponse;
}>;

type CampaignFiltersState = {
  clientId: string;
  marketId: string;
  statuses: string[];
};

const DEFAULT_CAMPAIGN_STATUS_FILTER = CAMPAIGN_STATUS_OPTIONS[0];

function formatSyncDate(value: string | null | undefined): string {
  if (!value) {
    return "Synced";
  }

  return `Synced ${value.slice(0, 10)}`;
}

function getCampaignStatusClassName(status: string): string {
  const normalized = status.toLowerCase().trim();

  if (normalized === "in progress") {
    return "database-records__status database-records__status--in-progress";
  }

  if (normalized === "planned") {
    return "database-records__status database-records__status--planned";
  }

  if (normalized === "finished") {
    return "database-records__status database-records__status--finished";
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return "database-records__status database-records__status--canceled";
  }

  return "database-records__status";
}

export function CampaignsWorkspace({ initialData }: CampaignsWorkspaceProps) {
  const [filters, setFilters] = useState<CampaignFiltersState>({
    clientId: "",
    marketId: "",
    statuses: [DEFAULT_CAMPAIGN_STATUS_FILTER],
  });

  const clientOptions: SearchableSelectOption[] = [
    { value: "", label: "All clients" },
    ...initialData.filterOptions.clients.map((client) => ({
      value: client.id,
      label: client.name,
    })),
  ];
  const marketOptions: SearchableSelectOption[] = [
    { value: "", label: "All markets" },
    ...initialData.filterOptions.markets.map((market) => ({
      value: market.id,
      label: market.name,
    })),
  ];
  const statusOptions: SearchableMultiSelectOption[] = initialData.filterOptions.statuses.map(
    (statusOption) => ({
      value: statusOption,
      label: statusOption,
    }),
  );

  function updateFilters<Key extends keyof CampaignFiltersState>(
    field: Key,
    value: CampaignFiltersState[Key],
  ) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  const filteredItems = useMemo(() => {
    const selectedStatuses = new Set(filters.statuses);

    return initialData.items.filter(
      (item) =>
        (filters.statuses.length === 0 || (item.status ? selectedStatuses.has(item.status) : false)) &&
        (!filters.clientId || item.client?.id === filters.clientId) &&
        (!filters.marketId || item.market?.id === filters.marketId),
    );
  }, [filters.clientId, filters.marketId, filters.statuses, initialData.items]);

  return (
    <div className="campaigns-workspace">
      <section className="database-records__filters">
        <div className="new-scouting__field">
          <span>Status</span>
          <SearchableMultiSelect
            ariaLabel="Campaign status"
            onChange={(values) => updateFilters("statuses", values)}
            options={statusOptions}
            placeholder="All statuses"
            searchPlaceholder="Search statuses..."
            values={filters.statuses}
          />
        </div>

        <label className="new-scouting__field">
          <span>Client</span>
          <SearchableSelect
            ariaLabel="Client"
            onChange={(value) => updateFilters("clientId", value)}
            options={clientOptions}
            placeholder="All clients"
            searchPlaceholder="Search clients..."
            value={filters.clientId}
          />
        </label>

        <label className="new-scouting__field">
          <span>Markets</span>
          <SearchableSelect
            ariaLabel="Markets"
            onChange={(value) => updateFilters("marketId", value)}
            options={marketOptions}
            placeholder="All markets"
            searchPlaceholder="Search markets..."
            value={filters.marketId}
          />
        </label>
      </section>

      <div className="database-records__header">
        <div>
          <h2>Campaigns</h2>
          <p className="workspace-copy">Browse campaigns you can scout for.</p>
        </div>
      </div>

      <div className="database-records__table-shell">
        <table className="database-records__table">
          <thead>
            <tr>
              <th>Campaign Name</th>
              <th>Client</th>
              <th>Markets</th>
              <th>Brief Link</th>
              <th>Month</th>
              <th>Year</th>
              <th>Status</th>
              <th>HubSpot</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((campaign: CampaignSummary) => (
              <tr key={campaign.id}>
                <td className="database-records__strong-cell">{campaign.name}</td>
                <td>{campaign.client?.name ?? "-"}</td>
                <td>{campaign.market?.name ?? "-"}</td>
                <td>
                  {campaign.briefLink ? (
                    <a
                      className="database-records__link"
                      href={campaign.briefLink}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open brief
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{campaign.month ? MONTH_LABELS[campaign.month] : "-"}</td>
                <td>{campaign.year ?? "-"}</td>
                <td>
                  {campaign.status ? (
                    <span className={getCampaignStatusClassName(campaign.status)}>
                      {campaign.status}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="database-records__muted-cell">
                  {campaign.hubspotObjectId ? (
                    <span title={campaign.hubspotObjectType ?? undefined}>
                      {formatSyncDate(campaign.hubspotSyncedAt)}
                    </span>
                  ) : (
                    "Local"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
