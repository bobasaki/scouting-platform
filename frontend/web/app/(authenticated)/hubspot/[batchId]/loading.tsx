import React from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import {
  Skeleton,
  SkeletonPageBody,
  SkeletonTable,
} from "../../../../components/ui/skeleton";

export default function HubspotBatchLoading() {
  return (
    <section className="page-section">
      <PageHeader
        crumbs={[
          { label: "HubSpot", href: "/hubspot" },
          { label: "Batch Result" },
        ]}
        title="Batch Result"
      />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <Skeleton height="1.5rem" width="12rem" />
          <SkeletonTable columns={4} rows={4} />
        </SkeletonPageBody>
      </div>
    </section>
  );
}
