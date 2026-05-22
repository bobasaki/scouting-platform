import { authenticateUserCredentials } from "@scouting-platform/core";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { resolveAppRole, type AppRole } from "./lib/navigation";

const DEV_AUTH_SECRET = "week0-dev-auth-secret-not-for-production";
const DEFAULT_APP_ROLE: AppRole = "user";

type AuthEnv = Readonly<Record<string, string | undefined>>;

function normalizeCredential(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizePasswordCredential(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function resolveAuthSecret(env: AuthEnv = process.env): string | undefined {
  const rawSecret = env.AUTH_SECRET ?? env.NEXTAUTH_SECRET;
  const trimmedSecret = typeof rawSecret === "string" ? rawSecret.trim() : "";

  if (trimmedSecret.length > 0) {
    return trimmedSecret;
  }

  if (env.NODE_ENV !== "production") {
    return DEV_AUTH_SECRET;
  }

  return undefined;
}

const authSecret = resolveAuthSecret();

export const authConfig = {
  ...(authSecret ? { secret: authSecret } : {}),
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: {
          label: "Email",
          type: "email",
          placeholder: "name@company.com"
        },
        password: {
          label: "Password",
          type: "password"
        }
      },
      async authorize(credentials) {
        const email = normalizeCredential(credentials?.email).toLowerCase();
        const password = normalizePasswordCredential(credentials?.password);

        if (!email || !password) {
          return null;
        }

        const user = await authenticateUserCredentials({
          email,
          password,
        });

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          name: user.name ?? user.email,
          email: user.email,
          role: resolveAppRole(user.role, DEFAULT_APP_ROLE),
          passwordChangedAt: user.passwordChangedAt.toISOString()
        };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = resolveAppRole(user.role, DEFAULT_APP_ROLE);
        token.sessionIssuedAt = Math.floor(Date.now() / 1000);

        if (typeof user.id === "string" && user.id.length > 0) {
          token.sub = user.id;
        }

        if (typeof user.passwordChangedAt === "string" && user.passwordChangedAt.length > 0) {
          token.passwordChangedAt = user.passwordChangedAt;
        }
      } else {
        token.role = resolveAppRole(token.role, DEFAULT_APP_ROLE);
      }

      return token;
    },
    session({ session, token }) {
      const passwordChangedAt =
        typeof token.passwordChangedAt === "string" ? token.passwordChangedAt : undefined;
      const sessionIssuedAt =
        typeof token.sessionIssuedAt === "number"
          ? token.sessionIssuedAt
          : typeof token.iat === "number"
            ? token.iat
            : undefined;

      session.user = {
        ...session.user,
        id: typeof token.sub === "string" ? token.sub : "",
        role: resolveAppRole(token.role, DEFAULT_APP_ROLE),
        ...(passwordChangedAt ? { passwordChangedAt } : {}),
        ...(typeof sessionIssuedAt === "number" ? { sessionIssuedAt } : {})
      };

      return session;
    }
  },
  session: {
    strategy: "jwt"
  }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
