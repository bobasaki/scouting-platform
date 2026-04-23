import React from "react";
import { PageHeader } from "../../../components/layout/PageHeader";
import {
  SkeletonFilterBar,
  SkeletonPageBody,
  SkeletonTable,
} from "../../../components/ui/skeleton";

export default function CatalogLoading() {
  return (
    <section className="page-section">
      <PageHeader
        crumbs={[
          { label: "Database", href: "/database" },
          { label: "Catalog" },
        ]}
        title="Catalog"
      />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <SkeletonFilterBar filters={3} />
          <SkeletonTable columns={8} rows={8} />
        </SkeletonPageBody>
      </div>
    </section>
  );
}
