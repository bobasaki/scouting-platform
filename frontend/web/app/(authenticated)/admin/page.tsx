import React from "react";
import { getSession } from "../../../lib/cached-auth";
import { AdminWorkspace } from "../../../components/admin/admin-workspace";
import { PageHeader } from "../../../components/layout/PageHeader";
import {
  canAccessNavigationKey,
  FORBIDDEN_ROUTE,
  getRoleFromSession,
  LOGIN_ROUTE
} from "../../../lib/access-control";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect(LOGIN_ROUTE);
    return null;
  }

  if (!canAccessNavigationKey("admin", getRoleFromSession(session))) {
    redirect(FORBIDDEN_ROUTE);
    return null;
  }

  return (
    <section className="page-section">
      <PageHeader
        crumbs={[{ label: "Admin" }]}
        title="Admin"
      />
      <div className="page-container page-section__body">
        <AdminWorkspace />
      </div>
    </section>
  );
}
