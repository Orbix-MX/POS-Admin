-- CreateEnum
CREATE TYPE "AiUsageStatus" AS ENUM ('SUCCESS', 'SCHEMA_REPAIRED', 'OUTPUT_INVALID', 'PROVIDER_ERROR', 'TIMEOUT', 'RATE_LIMITED', 'QUOTA_EXCEEDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiUsageOutcome" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'DISCARDED');

-- CreateTable
CREATE TABLE "ai_usage_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "requestId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "providerId" TEXT NOT NULL,
    "modelKey" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "degradations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostMicros" BIGINT NOT NULL DEFAULT 0,
    "latencyMsTotal" INTEGER,
    "latencyMsProvider" INTEGER,
    "status" "AiUsageStatus" NOT NULL,
    "errorCode" TEXT,
    "errorMessage" VARCHAR(500),
    "outcome" "AiUsageOutcome" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_counters" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "invocationCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostMicros" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_events_requestId_key" ON "ai_usage_events"("requestId");

-- CreateIndex
CREATE INDEX "ai_usage_events_tenantId_createdAt_idx" ON "ai_usage_events"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_events_tenantId_featureKey_createdAt_idx" ON "ai_usage_events"("tenantId", "featureKey", "createdAt");

-- CreateIndex
CREATE INDEX "ai_usage_events_status_idx" ON "ai_usage_events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_counters_tenantId_period_featureKey_key" ON "ai_usage_counters"("tenantId", "period", "featureKey");

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_counters" ADD CONSTRAINT "ai_usage_counters_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
