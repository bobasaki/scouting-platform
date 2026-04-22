"use client";

import type {
  DropdownValue,
  HubspotObjectSyncRun,
  ListCampaignsResponse,
  ListClientsResponse,
  ListHubspotObjectSyncRunsResponse,
} from "@scouting-platform/contracts";
import dynamic from "next/dynamic";
import { useSearchParams, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

import {
  createHubspotObjectSyncRunRequest,
  fetchHubspotObjectSyncRuns,
} from "../../lib/hubspot-object-sync-api";

const CampaignsWorkspace = dynamic(
  () => import("../campaigns/campaigns-workspace").then((mod) => mod.CampaignsWorkspace),
);
const ClientsWorkspace = dynamic(
  () => import("../database/clients-workspace").then((mod) => mod.ClientsWorkspace),
);
const DropdownValuesWorkspace = dynamic(
  () => import("./dropdown-values-workspace").then((mod) => mod.DropdownValuesWorkspace),
);

export function DatabaseAdminWorkspace({
  campaigns,
  clients,
  dropdownValues,
  hubspotSyncRuns,
  isAdmin,
}: Readonly<{
  campaigns: ListCampaignsResponse;
  clients: ListClientsResponse;
  dropdownValues: DropdownValue[];
  hubspotSyncRuns: ListHubspotObjectSyncRunsResponse;
  isAdmin: boolean;
}>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [syncRuns, setSyncRuns] = useState(hubspotSyncRuns);
  const [syncStatus, setSyncStatus] = useState("");
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);
  const requestedTab = searchParams.get("tab");
  const activeTab =
    requestedTab === "campaigns"
      ? "campaigns"
      : requestedTab === "dropdown-values" && isAdmin
        ? "dropdown-values"
        : "clients";

  function selectTab(tab: "clients" | "campaigns" | "dropdown-values") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/database?${params.toString()}`);
  }

  const latestSyncRun = syncRuns.latest;
  const isSyncRunning =
    latestSyncRun?.status === "queued" || latestSyncRun?.status === "running" || isTriggeringSync;

  useEffect(() => {
    if (
      !isAdmin ||
      (latestSyncRun?.status !== "queued" && latestSyncRun?.status !== "running")
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchHubspotObjectSyncRuns()
        .then((runs) => {
          setSyncRuns(runs);

          if (runs.latest?.status === "completed" || runs.latest?.status === "failed") {
            router.refresh();
          }
        })
        .catch((error) => {
          setSyncStatus(error instanceof Error ? error.message : "Unable to refresh HubSpot sync status.");
        });
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isAdmin, latestSyncRun?.status, router]);

  async function handleHubspotObjectSync() {
    setIsTriggeringSync(true);
    setSyncStatus("");

    try {
      const run = await createHubspotObjectSyncRunRequest();
      setSyncRuns((current) => ({
        items: [run, ...current.items.filter((item) => item.id !== run.id)],
        latest: run,
      }));
      setSyncStatus("HubSpot sync queued.");
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : "Unable to sync HubSpot objects.");
    } finally {
      setIsTriggeringSync(false);
    }
  }

  return (
    <div className="database-admin">
      <section className="database-admin__tabs" aria-label="Database sections">
        <button
          className={activeTab === "clients" ? "database-admin__tab database-admin__tab--active" : "database-admin__tab"}
          onClick={() => selectTab("clients")}
          type="button"
        >
          Clients
        </button>
        <button
          className={activeTab === "campaigns" ? "database-admin__tab database-admin__tab--active" : "database-admin__tab"}
          onClick={() => selectTab("campaigns")}
          type="button"
        >
          Campaigns
        </button>
        {isAdmin ? (
          <button
            className={activeTab === "dropdown-values" ? "database-admin__tab database-admin__tab--active" : "database-admin__tab"}
            onClick={() => selectTab("dropdown-values")}
            type="button"
          >
            Dropdown Values
          </button>
        ) : null}
      </section>

      <section className="database-admin__panel">
        {isAdmin && activeTab !== "dropdown-values" ? (
          <HubspotObjectSyncPanel
            isSyncRunning={isSyncRunning}
            latestRun={latestSyncRun}
            onSync={() => void handleHubspotObjectSync()}
            status={syncStatus}
          />
        ) : null}
        {activeTab === "clients" ? (
          <ClientsWorkspace initialData={clients} />
        ) : activeTab === "dropdown-values" ? (
          <DropdownValuesWorkspace initialData={dropdownValues} />
        ) : (
          <CampaignsWorkspace initialData={campaigns} />
        )}
      </section>
    </div>
  );
}

function formatSyncTimestamp(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value));
}

function HubspotObjectSyncPanel({
  isSyncRunning,
  latestRun,
  onSync,
  status,
}: Readonly<{
  isSyncRunning: boolean;
  latestRun: HubspotObjectSyncRun | null;
  onSync: () => void;
  status: string;
}>) {
  return (
    <div className="database-records__sync-panel">
      <div>
        <p className="workspace-eyebrow">HubSpot sync</p>
        <p className="workspace-copy">
          Last run: {latestRun ? latestRun.status : "none"} · {formatSyncTimestamp(latestRun?.completedAt ?? latestRun?.createdAt ?? null)}
        </p>
        {latestRun ? (
          <p className="workspace-copy">
            Clients {latestRun.clientUpsertCount} · Campaigns {latestRun.campaignUpsertCount} · Deactivated {latestRun.deactivatedCount}
          </p>
        ) : null}
        {status ? <p role="status">{status}</p> : null}
      </div>
      <button
        className="database-records__cta"
        disabled={isSyncRunning}
        onClick={onSync}
        type="button"
      >
        {isSyncRunning ? "Syncing..." : "Sync from HubSpot"}
      </button>
    </div>
  );
}
