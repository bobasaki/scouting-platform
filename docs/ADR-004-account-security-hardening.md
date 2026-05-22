# ADR-004: Account Security Hardening

- Status: Accepted
- Date: 2026-05-21

## Context

Employee accounts use credentials auth with JWT sessions. Admins create accounts and rotate passwords, so account security must not rely on UI visibility or stale JWT claims.

The previous model trusted the role stored in the signed JWT until the token expired. That meant a disabled account or changed role could continue calling server routes during the token lifetime. Password changes also did not invalidate already-issued JWT sessions, and repeated failed credential attempts had no persisted lockout state.

## Decision

Keep Auth.js JWT sessions, but make the database the source of truth for every server-side route authorization check.

Add account-security fields to `users`:
- `password_changed_at` for invalidating JWT sessions issued before the latest password rotation
- `failed_login_count`, `last_failed_login_at`, and `locked_until` for persisted login throttling
- `last_login_at` for account activity visibility and incident review

Credential sign-in records failed attempts for active users, locks an account after repeated failures, resets failure state on successful login, and uses a dummy Argon2 verification for rejected credential paths to reduce timing-based account enumeration. Admin password rotation clears lockout state and advances `password_changed_at`.

Route guards must validate the Auth.js session against the current database user before returning a user id or role. Inactive users, missing users, and sessions issued before `password_changed_at` are rejected.

## Consequences

Account revocation and admin role changes take effect on the next server request instead of waiting for JWT expiry. Password rotation invalidates old JWT sessions without introducing a server session store.

Every credential login now writes to the database on successful sign-in and failed attempts for existing active accounts. This is acceptable for the internal employee account model and gives operators useful account activity metadata.
