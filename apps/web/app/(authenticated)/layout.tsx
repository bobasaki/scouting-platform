import type { ReactNode } from "react";
import { AuthenticatedShell } from "../../components/layout/authenticated-shell";
import { DEFAULT_APP_ROLE } from "../../lib/shell";

type AuthenticatedLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  return <AuthenticatedShell role={DEFAULT_APP_ROLE}>{children}</AuthenticatedShell>;
}
