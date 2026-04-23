import React from "react";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { SkeletonPageBody, SkeletonTable } from "../../../../../components/ui/skeleton";

export default function HubspotPrepareLoading() {
  return (
    <section className="page-section">
      <PageHeader
        crumbs={[
          { label: "HubSpot", href: "/hubspot" },
          { label: "Google Sheets Export" },
        ]}
        title="Google Sheets Export"
      />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <SkeletonTable columns={8} rows={6} />
        </SkeletonPageBody>
      </div>
    </section>
  );
}
