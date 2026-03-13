import React from "react";
import { PageSection } from "../../../components/layout/page-section";
import { CatalogTableShell } from "../../../components/catalog/catalog-table-shell";

export default function CatalogPage() {
  return (
    <PageSection
      title="Catalog"
      description="Browse the shared creator catalog, search across channel identity fields, filter by enrichment or advanced report status, and select creators for export or HubSpot push."
    >
      <CatalogTableShell />
    </PageSection>
  );
}
