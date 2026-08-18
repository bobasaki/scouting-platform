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
import { isAppRole } from "../../../lib/navigation";

/**
 * Signed-in Almedia tracking workspace. The data itself loads client-side so
 * the tabs share one snapshot; admin-only controls are enabled explicitly.
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

  if (
    !isAppRole(session.user.role) ||
    !canAccessNavigationKey("almedia", getRoleFromSession(session))
  ) {
    redirect(FORBIDDEN_ROUTE);
    return null;
  }

  return (
    <section className="page-section">
      <Suspense fallback={<AlmediaFallback />}>
        <AlmediaWorkspace isAdmin={session.user.role === "admin"} />
      </Suspense>
    </section>
  );
}
