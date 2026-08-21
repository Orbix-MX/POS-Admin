-- Identidad Google (OAuth) en users
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

ALTER TABLE "users"
  ADD COLUMN "google_id" TEXT,
  ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "avatar_url" TEXT;

CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- Tickets de un solo uso para cerrar el redirect de OAuth
CREATE TABLE "oauth_tickets" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_tickets_token_hash_key" ON "oauth_tickets"("token_hash");
CREATE INDEX "oauth_tickets_user_id_idx" ON "oauth_tickets"("user_id");

ALTER TABLE "oauth_tickets"
  ADD CONSTRAINT "oauth_tickets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
