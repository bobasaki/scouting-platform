import React, { type ReactNode } from "react";
import type { AppRole } from "../../lib/navigation";
import { SignOutForm } from "../auth/sign-out-form";
import { AppNavigation } from "./app-navigation";

type AuthenticatedShellProps = Readonly<{
  children: ReactNode;
  role: AppRole;
}>;

export function AuthenticatedShell({ children, role }: AuthenticatedShellProps) {
  return (
    <div className="auth-shell" suppressHydrationWarning>
      <header className="auth-shell__header">
        <AppNavigation role={role} />

        <div className="auth-shell__actions">
          <span className="auth-shell__role-badge">{role === "admin" ? "Admin" : "User"}</span>
          <SignOutForm />
        </div>
      </header>
      <main className="auth-shell__content">{children}</main>
    </div>
  );
}
