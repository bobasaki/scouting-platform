import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getWeek0DemoCredentialsFromEnv, isWeek0DemoCredentialsMatch } from "./lib/auth-flow";

const week0DemoCredentials = getWeek0DemoCredentialsFromEnv();

export const authConfig = {
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
      authorize(credentials) {
        if (!isWeek0DemoCredentialsMatch(credentials?.email, credentials?.password)) {
          return null;
        }

        return {
          id: "week0-demo-user",
          name: "Week 0 User",
          email: week0DemoCredentials.email
        };
      }
    })
  ],
  session: {
    strategy: "jwt"
  }
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
