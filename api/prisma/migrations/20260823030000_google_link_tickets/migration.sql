-- CreateTable
CREATE TABLE "public"."google_link_tickets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_link_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_link_tickets_token_hash_key" ON "public"."google_link_tickets"("token_hash");

-- CreateIndex
CREATE INDEX "google_link_tickets_user_id_idx" ON "public"."google_link_tickets"("user_id");

-- AddForeignKey
ALTER TABLE "public"."google_link_tickets" ADD CONSTRAINT "google_link_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
