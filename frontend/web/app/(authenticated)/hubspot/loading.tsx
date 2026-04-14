import React from "react";
import { PageSection } from "../../../components/layout/page-section";
import {
  SkeletonPageBody,
  SkeletonTable,
} from "../../../components/ui/skeleton";

export default function HubspotLoading() {
  return (
    <PageSection
      title="HubSpot"
      description="Review legacy import-ready CSV batches, inspect missing-field failures, and keep older HubSpot push history readable while Google Sheets remains the primary handoff path."
    >
      <SkeletonPageBody>
        <SkeletonTable columns={5} rows={4} />
      </SkeletonPageBody>
    </PageSection>
  );
}
