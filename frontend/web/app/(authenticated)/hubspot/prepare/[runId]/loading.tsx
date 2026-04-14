import React from "react";
import { PageSection } from "../../../../../components/layout/page-section";
import { SkeletonPageBody, SkeletonTable } from "../../../../../components/ui/skeleton";

export default function HubspotPrepareLoading() {
  return (
    <PageSection
      title="Google Sheets Export"
      description="Review the HubSpot-ready columns, fill required gaps, and export them into Google Sheets for manual HubSpot import."
    >
      <SkeletonPageBody>
        <SkeletonTable columns={8} rows={6} />
      </SkeletonPageBody>
    </PageSection>
  );
}
