import React from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import {
  Skeleton,
  SkeletonPageBody,
  SkeletonTable,
  SkeletonText,
} from "../../../../components/ui/skeleton";

export default function RunDetailLoading() {
  return (
    <section className="page-section">
      <PageHeader
        crumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Run Detail" },
        ]}
        title="Run Detail"
      />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
            <Skeleton borderRadius="var(--radius-md)" height="2rem" width="6rem" />
            <SkeletonText width="10rem" />
          </div>
          <SkeletonTable columns={6} rows={5} />
        </SkeletonPageBody>
      </div>
    </section>
  );
}
