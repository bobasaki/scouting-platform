import React from "react";
import { PageHeader } from "../../../components/layout/PageHeader";
import {
  SkeletonPageBody,
  SkeletonTable,
} from "../../../components/ui/skeleton";

export default function ExportsLoading() {
  return (
    <section className="page-section">
      <PageHeader crumbs={[{ label: "Exports" }]} title="Exports" />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <SkeletonTable columns={5} rows={4} />
        </SkeletonPageBody>
      </div>
    </section>
  );
}
