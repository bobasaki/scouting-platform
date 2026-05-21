import { describe, expect, it, vi } from "vitest";

const {
  captured,
  nextAuthFactoryMock,
  credentialsProviderMock,
  nextAuthExports,
  authenticateUserCredentialsMock
} = vi.hoisted(() => {
  const captured = {
    authConfig: null as unknown,
    credentialsOptions: null as unknown
  };

  const nextAuthExports = {
    handlers: {
      GET: vi.fn(),
      POST: vi.fn()
    },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn()
  };

  return {
    captured,
    nextAuthFactoryMock: vi.fn((authConfig: unknown) => {
      captured.authConfig = authConfig;
      return nextAuthExports;
    }),
    credentialsProviderMock: vi.fn((options: unknown) => {
      captured.credentialsOptions = options;
      return {
        id: "credentials",
        options
      };
    }),
    nextAuthExports,
    authenticateUserCredentialsMock: vi.fn()
  };
});

vi.mock("@scouting-platform/core", () => ({
  authenticateUserCredentials: authenticateUserCredentialsMock
}));

vi.mock("next-auth", () => ({
  default: nextAuthFactoryMock
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: credentialsProviderMock
}));

import { authConfig, auth, handlers, resolveAuthSecret, signIn, signOut } from "./auth";

type JwtCallbackParams = {
  token: { role?: unknown; sub?: string; passwordChangedAt?: unknown; sessionIssuedAt?: unknown; iat?: unknown };
  user?: { id?: string; role?: unknown; passwordChangedAt?: unknown } | undefined;
};

type SessionCallbackParams = {
  session: { user?: Record<string, unknown> };
  token: { role?: unknown; sub?: string; passwordChangedAt?: unknown; sessionIssuedAt?: unknown; iat?: unknown };
};

type AuthCallbacks = {
  jwt: (params: JwtCallbackParams) => {
    role?: unknown;
    sub?: string;
    passwordChangedAt?: unknown;
    sessionIssuedAt?: unknown;
  };
  session: (params: SessionCallbackParams) => { user?: Record<string, unknown> };
};

describe("auth configuration", () => {
  it("keeps the custom sign-in page redirect and JWT session strategy", () => {
    expect(authConfig.pages?.signIn).toBe("/login");
    expect(authConfig.session?.strategy).toBe("jwt");
  });

  it("wires NextAuth exports for route handlers and auth actions", () => {
    expect(nextAuthFactoryMock).toHaveBeenCalledOnce();
    expect(handlers).toBe(nextAuthExports.handlers);
    expect(auth).toBe(nextAuthExports.auth);
    expect(signIn).toBe(nextAuthExports.signIn);
    expect(signOut).toBe(nextAuthExports.signOut);
  });

  it("authorizes active users with persisted credentials and rejects invalid or locked accounts", async () => {
    const providerOptions = captured.credentialsOptions as {
      authorize: (credentials: { email?: unknown; password?: unknown } | undefined) => Promise<unknown>;
    };

    authenticateUserCredentialsMock.mockReset();

    expect(await providerOptions.authorize(undefined)).toBeNull();
    expect(authenticateUserCredentialsMock).not.toHaveBeenCalled();

    expect(
      await providerOptions.authorize({
        email: "   ",
        password: "   "
      })
    ).toBeNull();
    expect(authenticateUserCredentialsMock).not.toHaveBeenCalled();

    authenticateUserCredentialsMock.mockResolvedValueOnce(null);
    expect(
      await providerOptions.authorize({
        email: "missing@example.com",
        password: "StrongPassword123"
      })
    ).toBeNull();

    authenticateUserCredentialsMock.mockResolvedValueOnce({
      id: "user-1",
      email: "active@example.com",
      name: "Active User",
      role: "admin",
      passwordHash: "valid-hash",
      passwordChangedAt: new Date("2026-05-21T10:00:00.000Z"),
      isActive: true
    });

    await expect(
      providerOptions.authorize({
        email: "  ACTIVE@example.com ",
        password: "StrongPassword123"
      })
    ).resolves.toEqual({
      id: "user-1",
      name: "Active User",
      email: "active@example.com",
      role: "admin",
      passwordChangedAt: "2026-05-21T10:00:00.000Z"
    });

    expect(authenticateUserCredentialsMock).toHaveBeenCalledWith({
      email: "active@example.com",
      password: "StrongPassword123",
    });

    authenticateUserCredentialsMock.mockResolvedValueOnce({
      id: "spaced-password-user",
      email: "space@example.com",
      name: "Space User",
      role: "user",
      passwordHash: "valid-hash",
      passwordChangedAt: new Date("2026-05-21T11:00:00.000Z"),
      isActive: true
    });

    await providerOptions.authorize({
      email: "space@example.com",
      password: "  KeepPasswordSpaces123  "
    });

    expect(authenticateUserCredentialsMock).toHaveBeenLastCalledWith({
      email: "space@example.com",
      password: "  KeepPasswordSpaces123  ",
    });
  });

  it("normalizes role and id into JWT and session callbacks", () => {
    const callbacks = (captured.authConfig as { callbacks: AuthCallbacks }).callbacks;
    const jwtCallback = callbacks.jwt;
    const sessionCallback = callbacks.session;

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T12:00:00.000Z"));

    expect(
      jwtCallback({
        token: {},
        user: {
          id: "user-1",
          role: "admin",
          passwordChangedAt: "2026-05-21T10:00:00.000Z"
        }
      })
    ).toMatchObject({
      role: "admin",
      sub: "user-1",
      passwordChangedAt: "2026-05-21T10:00:00.000Z",
      sessionIssuedAt: 1779364800
    });
    vi.useRealTimers();
    expect(jwtCallback({ token: { role: "owner" } })).toMatchObject({ role: "user" });
    const sessionWithId = sessionCallback({
      session: { user: { email: "user@example.com" } },
      token: {
        role: "admin",
        sub: "user-1",
        passwordChangedAt: "2026-05-21T10:00:00.000Z",
        sessionIssuedAt: 1779364800
      }
    });

    expect(sessionWithId).toMatchObject({
      user: {
        email: "user@example.com",
        id: "user-1",
        role: "admin",
        passwordChangedAt: "2026-05-21T10:00:00.000Z",
        sessionIssuedAt: 1779364800
      }
    });
    expect(sessionWithId.user?.id).toBe("user-1");
    expect(sessionWithId.user?.role).toBe("admin");

    // Route guards require id + role on session.user.
    const sessionWithoutSub = sessionCallback({
      session: { user: { email: "user@example.com" } },
      token: { role: "owner" }
    });
    expect(sessionWithoutSub.user?.id).toBe("");
    expect(sessionWithoutSub.user?.role).toBe("user");
  });

  it("resolves auth secret from env with non-production fallback", () => {
    expect(
      resolveAuthSecret({
        AUTH_SECRET: "  top-secret  ",
        NODE_ENV: "development"
      })
    ).toBe("top-secret");
    expect(
      resolveAuthSecret({
        NEXTAUTH_SECRET: "nextauth-secret",
        NODE_ENV: "development"
      })
    ).toBe("nextauth-secret");
    expect(
      resolveAuthSecret({
        NODE_ENV: "development"
      })
    ).toBe("week0-dev-auth-secret-not-for-production");
    expect(
      resolveAuthSecret({
        NODE_ENV: "production"
      })
    ).toBeUndefined();
  });
});
