-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "public"."users" ADD COLUMN "mfa_secret_enc" TEXT;

-- CreateTable
CREATE TABLE "public"."mfa_challenge_tickets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_challenge_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mfa_challenge_tickets_token_hash_key" ON "public"."mfa_challenge_tickets"("token_hash");

-- CreateIndex
CREATE INDEX "mfa_challenge_tickets_user_id_idx" ON "public"."mfa_challenge_tickets"("user_id");

-- AddForeignKey
ALTER TABLE "public"."mfa_challenge_tickets" ADD CONSTRAINT "mfa_challenge_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "public"."mfa_backup_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mfa_backup_codes_user_id_idx" ON "public"."mfa_backup_codes"("user_id");

-- AddForeignKey
ALTER TABLE "public"."mfa_backup_codes" ADD CONSTRAINT "mfa_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
