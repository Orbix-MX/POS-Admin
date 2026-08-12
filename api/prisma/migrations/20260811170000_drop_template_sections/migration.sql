-- Las plantillas dejan de componerse por secciones editables — el HTML de
-- cada plantilla es fijo (código Astro); solo se llena contenido por tenant
-- en tenant_site_sections. template_sections ya no aplica.

-- DropForeignKey
ALTER TABLE "template_sections" DROP CONSTRAINT "template_sections_templateId_fkey";

-- DropTable
DROP TABLE "template_sections";
