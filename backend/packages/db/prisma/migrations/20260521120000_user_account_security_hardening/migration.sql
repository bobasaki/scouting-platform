-- Account security hardening: persisted login lockout state and JWT invalidation marker.

ALTER TABLE "users"
ADD COLUMN "password_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "failed_login_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_failed_login_at" TIMESTAMP(3),
ADD COLUMN "locked_until" TIMESTAMP(3),
ADD COLUMN "last_login_at" TIMESTAMP(3);

CREATE INDEX "users_locked_until_idx" ON "users"("locked_until");
