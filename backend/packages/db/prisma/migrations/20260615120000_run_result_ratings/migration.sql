-- AlterTable
ALTER TABLE "run_results"
ADD COLUMN "rating" INTEGER,
ADD COLUMN "rated_at" TIMESTAMP(3),
ADD COLUMN "rated_by_user_id" UUID;

-- AddConstraint
ALTER TABLE "run_results"
ADD CONSTRAINT "run_results_rating_check"
CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);

-- CreateIndex
CREATE INDEX "run_results_rated_by_user_id_idx"
ON "run_results"("rated_by_user_id");

-- AddForeignKey
ALTER TABLE "run_results"
ADD CONSTRAINT "run_results_rated_by_user_id_fkey"
FOREIGN KEY ("rated_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
