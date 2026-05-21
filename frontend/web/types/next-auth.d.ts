import type { DefaultSession } from "next-auth";
import type { AppRole } from "../lib/navigation";

declare module "next-auth" {
  interface User {
    role: AppRole;
    passwordChangedAt?: string;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: AppRole;
      passwordChangedAt?: string | null;
      sessionIssuedAt?: number | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    passwordChangedAt?: string | null;
    sessionIssuedAt?: number | null;
  }
}
