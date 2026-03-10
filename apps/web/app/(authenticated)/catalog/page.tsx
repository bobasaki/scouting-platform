import React from "react";
import { PageSection } from "../../../components/layout/page-section";
import { CatalogTableShell } from "../../../components/catalog/catalog-table-shell";

export default function CatalogPage() {
  return (
    <PageSection
      title="Catalog"
      description="Browse the shared creator catalog, search across channel identity fields, and filter by enrichment or advanced report status."
    >
      <CatalogTableShell />
    </PageSection>
  );
}
