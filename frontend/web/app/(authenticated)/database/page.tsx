import React, { Suspense } from "react";
import type { ListHubspotObjectSyncRunsResponse } from "@scouting-platform/contracts";
import { redirect } from "next/navigation";

import { getSession } from "../../../lib/cached-auth";
import {
  getCachedCampaigns,
  getCachedClients,
  getCachedDropdownValues,
  getCachedHubspotObjectSyncRuns,
} from "../../../lib/cached-data";
import { DatabaseAdminWorkspace } from "../../../components/database/database-admin-workspace";
import { PageSection } from "../../../components/layout/page-section";
import { Skeleton, SkeletonPageBody, SkeletonTable } from "../../../components/ui/skeleton";

const emptyHubspotSyncRuns: ListHubspotObjectSyncRunsResponse = {
  items: [],
  latest: null,
};

function isHubspotObjectSyncModelUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: unknown }).code === "HUBSPOT_OBJECT_SYNC_MODEL_UNAVAILABLE"
  );
}

async function getInitialHubspotSyncRuns(
  userId: string,
): Promise<ListHubspotObjectSyncRunsResponse> {
  try {
    return await getCachedHubspotObjectSyncRuns(userId);
  } catch (error) {
    if (isHubspotObjectSyncModelUnavailable(error)) {
      return emptyHubspotSyncRuns;
    }

    throw error;
  }
}

async function DatabaseData() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const isAdmin = session.user.role === "admin";
  const [campaigns, clients, dropdownValues, hubspotSyncRuns] = await Promise.all([
    getCachedCampaigns(session.user.id),
    getCachedClients(session.user.id),
    isAdmin ? getCachedDropdownValues().then((response) => response.items) : Promise.resolve([]),
    isAdmin ? getInitialHubspotSyncRuns(session.user.id) : Promise.resolve(emptyHubspotSyncRuns),
  ]);

  return (
    <DatabaseAdminWorkspace
      campaigns={campaigns}
      clients={clients}
      dropdownValues={dropdownValues}
      hubspotSyncRuns={hubspotSyncRuns}
      isAdmin={isAdmin}
    />
  );
}

function DatabaseFallback() {
  return (
    <SkeletonPageBody>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Skeleton borderRadius="var(--radius-md)" height="2.25rem" width="6rem" />
        <Skeleton borderRadius="var(--radius-md)" height="2.25rem" width="6rem" />
      </div>
      <SkeletonTable columns={6} rows={6} />
    </SkeletonPageBody>
  );
}

export default function DatabasePage() {
  return (
    <PageSection
      title="Database"
      description="Manage clients and campaigns from one database workspace while keeping creator catalog browsing in its own dedicated page."
    >
      <Suspense fallback={<DatabaseFallback />}>
        <DatabaseData />
      </Suspense>
    </PageSection>
  );
}
