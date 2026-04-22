import React from "react";
import { PageSection } from "../../../components/layout/page-section";
import {
  Skeleton,
  SkeletonPageBody,
  SkeletonTable,
} from "../../../components/ui/skeleton";

export default function AdminLoading() {
  return (
    <PageSection
      section="Admin"
      title="Admin"
      description="Upload CSV imports and manage user access from the admin workspace."
    >
      <SkeletonPageBody>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Skeleton borderRadius="var(--radius-md)" height="2.25rem" width="6rem" />
          <Skeleton borderRadius="var(--radius-md)" height="2.25rem" width="6rem" />
          <Skeleton borderRadius="var(--radius-md)" height="2.25rem" width="6rem" />
        </div>
        <SkeletonTable columns={5} rows={5} />
      </SkeletonPageBody>
    </PageSection>
  );
}
