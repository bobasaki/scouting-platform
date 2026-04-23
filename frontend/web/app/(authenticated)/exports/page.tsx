import React from "react";

import { CsvExportManager } from "../../../components/exports/csv-export-manager";
import { PageHeader } from "../../../components/layout/PageHeader";

export default function ExportsPage() {
  return (
    <section className="page-section">
      <PageHeader crumbs={[{ label: "Exports" }]} title="Exports" />
      <div className="page-container page-section__body">
        <CsvExportManager />
      </div>
    </section>
  );
}
