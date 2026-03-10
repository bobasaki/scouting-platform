const PASSWORD_MIN_LENGTH = 8;
type Argon2Module = typeof import("argon2");
const ARGON2_MODULE_ID = Buffer.from("YXJnb24y", "base64").toString("utf8");

let argon2Module: Argon2Module | null = null;

function getNodeRequire(): NodeJS.Require {
  const moduleBuiltin = process.getBuiltinModule?.("module");

  if (!moduleBuiltin) {
    throw new Error("Node runtime module loader is unavailable");
  }

  return moduleBuiltin.createRequire(import.meta.url);
}

async function loadArgon2(): Promise<Argon2Module> {
  if (!argon2Module) {
    // Build the specifier at runtime so Next does not bundle the native addon into server chunks.
    argon2Module = getNodeRequire()(ARGON2_MODULE_ID) as Argon2Module;
  }

  return argon2Module;
}

function validatePasswordInput(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePasswordInput(password);
  const argon2 = await loadArgon2();

  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }

  const argon2 = await loadArgon2();
  return argon2.verify(hash, password);
}
