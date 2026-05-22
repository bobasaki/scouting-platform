import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "admin" | "user";
      passwordChangedAt?: string | null;
      sessionIssuedAt?: number | null;
    };
  }

  interface User {
    role: "admin" | "user";
    passwordChangedAt?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    passwordChangedAt?: string | null;
    sessionIssuedAt?: number | null;
  }
}
