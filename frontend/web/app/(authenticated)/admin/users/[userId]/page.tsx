import React, { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { getSession } from "../../../../../lib/cached-auth";
import { getCachedUsers } from "../../../../../lib/cached-data";
import { UserAccountDetail } from "../../../../../components/admin/user-account-detail";
import { PageHeader } from "../../../../../components/layout/PageHeader";
import { Skeleton, SkeletonPageBody } from "../../../../../components/ui/skeleton";
import {
  canAccessNavigationKey,
  FORBIDDEN_ROUTE,
  getRoleFromSession,
  LOGIN_ROUTE,
} from "../../../../../lib/access-control";

type AdminUserDetailPageProps = Readonly<{
  params: Promise<{ userId: string }>;
}>;

async function UserDetailData({ userId }: { userId: string }) {
  const session = await getSession();

  if (!session?.user) {
    redirect(LOGIN_ROUTE);
    return null;
  }

  if (!canAccessNavigationKey("admin", getRoleFromSession(session))) {
    redirect(FORBIDDEN_ROUTE);
    return null;
  }

  const users = await getCachedUsers();
  const user = users.find((candidate) => candidate.id === userId);

  if (!user) {
    notFound();
    return null;
  }

  return (
    <section className="page-section">
      <PageHeader
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Users", href: "/admin/users" },
          { label: "User" },
        ]}
        title={user.name?.trim() || user.email}
      />
      <div className="page-container page-section__body">
        <UserAccountDetail user={user} />
      </div>
    </section>
  );
}

function UserDetailFallback() {
  return (
    <section className="page-section">
      <PageHeader
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Users", href: "/admin/users" },
          { label: "User" },
        ]}
        title="User"
      />
      <div className="page-container page-section__body">
        <SkeletonPageBody>
          <Skeleton height="2rem" width="16rem" />
          <Skeleton height="12rem" width="100%" />
        </SkeletonPageBody>
      </div>
    </section>
  );
}

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const { userId } = await params;

  return (
    <Suspense fallback={<UserDetailFallback />}>
      <UserDetailData userId={userId} />
    </Suspense>
  );
}
