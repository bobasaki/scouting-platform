import { redirect } from "next/navigation";
import React, { Suspense } from "react";

import { AlmediaWorkspace } from "../../../components/almedia/almedia-workspace";
import { PageHeader } from "../../../components/layout/PageHeader";
import {
  SkeletonPageBody,
  SkeletonTable,
} from "../../../components/ui/skeleton";
import {
  canAccessNavigationKey,
  FORBIDDEN_ROUTE,
  getRoleFromSession,
  LOGIN_ROUTE,
} from "../../../lib/access-control";
import { getSession } from "../../../lib/cached-auth";

/**
 * Admin-only Almedia tracking workspace. The data itself loads client-side so
 * the three tabs share one snapshot and one refresh; this shell only enforces
 * access.
 */

function AlmediaFallback() {
  return (
    <>
      <PageHeader crumbs={[{ label: "Almedia" }]} title="Almedia" />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <SkeletonTable columns={6} rows={6} />
        </SkeletonPageBody>
      </div>
    </>
  );
}

export default async function AlmediaPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect(LOGIN_ROUTE);
    return null;
  }

  if (!canAccessNavigationKey("almedia", getRoleFromSession(session))) {
    redirect(FORBIDDEN_ROUTE);
    return null;
  }

  return (
    <section className="page-section">
      <Suspense fallback={<AlmediaFallback />}>
        <AlmediaWorkspace />
      </Suspense>
    </section>
  );
}
