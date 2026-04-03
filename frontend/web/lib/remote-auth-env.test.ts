import { describe, expect, it } from "vitest";

import {
  getRemoteSmokeCredentials,
  requireRemoteSmokeCredentials,
} from "./remote-auth-env";

describe("remote smoke credential environment resolution", () => {
  it("uses the primary remote smoke variables when they are configured", () => {
    expect(
      getRemoteSmokeCredentials("admin", {
        E2E_ADMIN_EMAIL: " admin@example.com ",
        E2E_ADMIN_PASSWORD: " StrongAdminPassword123 ",
        INITIAL_ADMIN_EMAIL: "fallback@example.com",
        INITIAL_ADMIN_PASSWORD: "fallback-password",
      }),
    ).toEqual({
      email: "admin@example.com",
      password: "StrongAdminPassword123",
    });
  });

  it("falls back to the initial admin seed variables for admin smoke credentials", () => {
    expect(
      getRemoteSmokeCredentials("admin", {
        INITIAL_ADMIN_EMAIL: "seeded-admin@example.com",
        INITIAL_ADMIN_PASSWORD: "SeededAdminPassword123",
      }),
    ).toEqual({
      email: "seeded-admin@example.com",
      password: "SeededAdminPassword123",
    });
  });

  it("accepts the manager aliases used across the repo and deployment scripts", () => {
    expect(
      getRemoteSmokeCredentials("manager", {
        E2E_CM_EMAIL: "cm@example.com",
        E2E_CM_PASSWORD: "CampaignManagerPassword123",
      }),
    ).toEqual({
      email: "cm@example.com",
      password: "CampaignManagerPassword123",
    });

    expect(
      getRemoteSmokeCredentials("manager", {
        E2E_MANAGER_EMAIL: "manager@example.com",
        E2E_MANAGER_PASSWORD: "ManagerPassword123",
      }),
    ).toEqual({
      email: "manager@example.com",
      password: "ManagerPassword123",
    });
  });

  it("throws a clear error when the remote smoke credentials are missing", () => {
    expect(() => requireRemoteSmokeCredentials("manager", {})).toThrow(
      /Missing remote smoke campaign manager credentials\./,
    );
    expect(() => requireRemoteSmokeCredentials("manager", {})).toThrow(
      /E2E_MANAGER_EMAIL, E2E_CM_EMAIL, E2E_CAMPAIGN_MANAGER_EMAIL/,
    );
  });
});
