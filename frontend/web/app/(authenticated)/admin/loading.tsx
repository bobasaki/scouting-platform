import React from "react";
import { PageHeader } from "../../../components/layout/PageHeader";
import {
  Skeleton,
  SkeletonPageBody,
  SkeletonTable,
} from "../../../components/ui/skeleton";

export default function AdminLoading() {
  return (
    <section className="page-section">
      <PageHeader
        crumbs={[{ label: "Admin" }]}
        title="Admin"
      />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Skeleton borderRadius="var(--radius-md)" height="2.25rem" width="6rem" />
            <Skeleton borderRadius="var(--radius-md)" height="2.25rem" width="6rem" />
            <Skeleton borderRadius="var(--radius-md)" height="2.25rem" width="6rem" />
          </div>
          <SkeletonTable columns={5} rows={5} />
        </SkeletonPageBody>
      </div>
    </section>
  );
}
