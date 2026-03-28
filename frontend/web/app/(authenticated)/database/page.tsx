import React from "react";
import { listCampaigns, listClients, listDropdownValues } from "@scouting-platform/core";
import { redirect } from "next/navigation";

import { auth } from "../../../auth";
import { DatabaseAdminWorkspace } from "../../../components/database/database-admin-workspace";
import { PageSection } from "../../../components/layout/page-section";

export default async function DatabasePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [campaigns, clients, dropdownValues] = await Promise.all([
    listCampaigns({ userId: session.user.id, query: { active: true } }),
    listClients({ userId: session.user.id }),
    listDropdownValues(),
  ]);

  return (
    <PageSection
      title="Database"
      description="Manage clients and campaigns from one database workspace while keeping creator catalog browsing in its own dedicated page."
    >
      <DatabaseAdminWorkspace
        campaigns={campaigns}
        clients={clients}
        dropdownValues={dropdownValues.items}
        isAdmin={session.user.role === "admin"}
      />
    </PageSection>
  );
}
