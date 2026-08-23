-- Invitaciones para unirse a una empresa.
--
-- El token se guarda solo hasheado (SHA-256), igual que los refresh tokens y los
-- tickets de OAuth: si la base se filtra, los enlaces pendientes no sirven.
CREATE TABLE IF NOT EXISTS "tenant_invitations" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "token_hash"    TEXT NOT NULL,
  "role_ids"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "invited_by_id" TEXT,
  "expires_at"    TIMESTAMP(3) NOT NULL,
  "accepted_at"   TIMESTAMP(3),
  "revoked_at"    TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_invitations_pkey" PRIMARY KEY ("id")
);

-- El hash identifica la invitación: un token no puede valer para dos.
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_invitations_token_hash_key"
  ON "tenant_invitations"("token_hash");

CREATE INDEX IF NOT EXISTS "tenant_invitations_tenantId_email_idx"
  ON "tenant_invitations"("tenantId", "email");

CREATE INDEX IF NOT EXISTS "tenant_invitations_email_idx"
  ON "tenant_invitations"("email");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_invitations_tenantId_fkey') THEN
    ALTER TABLE "tenant_invitations"
      ADD CONSTRAINT "tenant_invitations_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- SetNull: si se da de baja a quien invitó, la invitación sigue siendo válida.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_invitations_invited_by_id_fkey') THEN
    ALTER TABLE "tenant_invitations"
      ADD CONSTRAINT "tenant_invitations_invited_by_id_fkey"
      FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
