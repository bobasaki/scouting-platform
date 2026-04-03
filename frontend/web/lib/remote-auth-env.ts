import process from "node:process";

type EnvVars = Readonly<Record<string, string | undefined>>;

export type RemoteSmokeActor = "admin" | "manager";

export type RemoteSmokeCredentials = Readonly<{
  email: string;
  password: string;
}>;

const REMOTE_SMOKE_ENV_KEYS = {
  admin: {
    email: ["E2E_ADMIN_EMAIL", "INITIAL_ADMIN_EMAIL"],
    password: ["E2E_ADMIN_PASSWORD", "INITIAL_ADMIN_PASSWORD"],
    label: "admin",
  },
  manager: {
    email: ["E2E_MANAGER_EMAIL", "E2E_CM_EMAIL", "E2E_CAMPAIGN_MANAGER_EMAIL"],
    password: ["E2E_MANAGER_PASSWORD", "E2E_CM_PASSWORD", "E2E_CAMPAIGN_MANAGER_PASSWORD"],
    label: "campaign manager",
  },
} satisfies Record<
  RemoteSmokeActor,
  Readonly<{
    email: readonly string[];
    password: readonly string[];
    label: string;
  }>
>;

function normalizeCredential(value: string | undefined): string {
  return value?.trim() ?? "";
}

function findFirstConfiguredValue(keys: readonly string[], env: EnvVars): string {
  for (const key of keys) {
    const value = normalizeCredential(env[key]);

    if (value.length > 0) {
      return value;
    }
  }

  return "";
}

export function getRemoteSmokeCredentials(
  actor: RemoteSmokeActor,
  env: EnvVars = process.env,
): RemoteSmokeCredentials | null {
  const config = REMOTE_SMOKE_ENV_KEYS[actor];
  const email = findFirstConfiguredValue(config.email, env);
  const password = findFirstConfiguredValue(config.password, env);

  if (!email || !password) {
    return null;
  }

  return {
    email,
    password,
  };
}

export function requireRemoteSmokeCredentials(
  actor: RemoteSmokeActor,
  env: EnvVars = process.env,
): RemoteSmokeCredentials {
  const credentials = getRemoteSmokeCredentials(actor, env);

  if (credentials) {
    return credentials;
  }

  const config = REMOTE_SMOKE_ENV_KEYS[actor];

  throw new Error(
    [
      `Missing remote smoke ${config.label} credentials.`,
      `Set one of [${config.email.join(", ")}] for the email and one of [${config.password.join(", ")}] for the password.`,
    ].join(" "),
  );
}
