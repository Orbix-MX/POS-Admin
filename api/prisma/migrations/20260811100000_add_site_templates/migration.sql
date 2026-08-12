-- CreateEnum
CREATE TYPE "SiteSectionType" AS ENUM ('HERO', 'VALUE_PROPS', 'FEATURED_CATEGORIES', 'FEATURED_PRODUCTS', 'TESTIMONIALS', 'CONTACT_FOOTER');

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_sections" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sectionType" "SiteSectionType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "defaultContent" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_sites" (
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_sites_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "tenant_site_sections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sectionType" "SiteSectionType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_site_sections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "template_sections_templateId_sortOrder_key" ON "template_sections"("templateId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_site_sections_tenantId_sortOrder_key" ON "tenant_site_sections"("tenantId", "sortOrder");

-- AddForeignKey
ALTER TABLE "template_sections" ADD CONSTRAINT "template_sections_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_sites" ADD CONSTRAINT "tenant_sites_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_sites" ADD CONSTRAINT "tenant_sites_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_site_sections" ADD CONSTRAINT "tenant_site_sections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant_sites"("tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
