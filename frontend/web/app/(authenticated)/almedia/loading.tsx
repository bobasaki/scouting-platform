import React from "react";

import { PageHeader } from "../../../components/layout/PageHeader";
import {
  SkeletonFilterBar,
  SkeletonPageBody,
  SkeletonTable,
} from "../../../components/ui/skeleton";

export default function AlmediaLoading() {
  return (
    <section className="page-section">
      <PageHeader crumbs={[{ label: "Almedia" }]} title="Almedia" />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <SkeletonFilterBar filters={8} />
          <SkeletonTable columns={6} rows={6} />
        </SkeletonPageBody>
      </div>
    </section>
  );
}
