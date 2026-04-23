import React from "react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import {
  Skeleton,
  SkeletonPageBody,
  SkeletonText,
} from "../../../../components/ui/skeleton";

export default function CatalogChannelLoading() {
  return (
    <section className="page-section">
      <PageHeader
        crumbs={[
          { label: "Database", href: "/database" },
          { label: "Catalog", href: "/catalog" },
          { label: "Channel Detail" },
        ]}
        title="Channel Detail"
      />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", padding: "1.5rem 0" }}>
            <Skeleton borderRadius="50%" height="4.5rem" width="4.5rem" />
            <div style={{ display: "grid", gap: "0.75rem", flex: 1 }}>
              <Skeleton height="1.5rem" width="14rem" />
              <SkeletonText lines={2} width="22rem" />
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                <Skeleton borderRadius="var(--radius-md)" height="2rem" width="6rem" />
                <Skeleton borderRadius="var(--radius-md)" height="2rem" width="6rem" />
              </div>
            </div>
          </div>
          <Skeleton height="18rem" width="100%" />
        </SkeletonPageBody>
      </div>
    </section>
  );
}
