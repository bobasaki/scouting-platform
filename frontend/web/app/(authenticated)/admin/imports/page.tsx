import { getSession } from "../../../../lib/cached-auth";
import { AdminCsvImportManager } from "../../../../components/admin/admin-csv-import-manager";
import { PageHeader } from "../../../../components/layout/PageHeader";
import {
  canAccessNavigationKey,
  FORBIDDEN_ROUTE,
  getRoleFromSession,
  LOGIN_ROUTE,
} from "../../../../lib/access-control";
import { redirect } from "next/navigation";

export default async function AdminImportsPage() {
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
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "CSV Imports" },
        ]}
        title="CSV Imports"
      />
      <div className="page-container page-section__body">
        <AdminCsvImportManager />
      </div>
    </section>
  );
}
