import React from "react";
import { PageHeader } from "../../../components/layout/PageHeader";
import {
  Skeleton,
  SkeletonFilterBar,
  SkeletonPageBody,
  SkeletonTable,
} from "../../../components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <section className="page-section">
      <PageHeader crumbs={[{ label: "Dashboard" }]} title="Dashboard" />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <SkeletonFilterBar filters={3} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Skeleton borderRadius="var(--radius-md)" height="2rem" width="5rem" />
          </div>
          <SkeletonTable columns={7} rows={6} />
        </SkeletonPageBody>
      </div>
    </section>
  );
}
