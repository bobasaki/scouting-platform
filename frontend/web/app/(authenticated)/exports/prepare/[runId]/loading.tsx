import React from "react";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { SkeletonPageBody, SkeletonTable } from "../../../../../components/ui/skeleton";

export default function ExportPrepareLoading() {
  return (
    <section className="page-section">
      <PageHeader
        crumbs={[
          { label: "Exports", href: "/exports" },
          { label: "CSV Preparation" },
        ]}
        title="CSV Preparation"
      />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <SkeletonTable columns={8} rows={6} />
        </SkeletonPageBody>
      </div>
    </section>
  );
}
