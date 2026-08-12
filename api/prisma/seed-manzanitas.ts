// Seeds the "Manzanitas" storefront tenant (aquascaping plants) consumed by
// apps/e-commerce. Safe to re-run: tenant/category/product upserts are keyed
// by their unique fields, and images are only created if missing.
//
// Usage:
//   npx tsx prisma/seed-manzanitas.ts
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Fixed id so apps/e-commerce can hardcode PUBLIC_TENANT_ID without a lookup step.
const MANZANITAS_TENANT_ID = 'dcecadd5-b9c2-4152-98d0-9024c4bd5804';

type PlantaJson = {
  id: string;
  nombre: string;
  cientifico?: string;
  categoria: 'plantas' | 'raices' | 'hardscape';
  descripcion: string;
  dificultad?: string;
  luz?: string;
  precio: number;
  imagen: string;
  destacado?: boolean;
};

function buildDescription(p: PlantaJson): string {
  const lines = [p.cientifico, p.descripcion].filter(Boolean);
  const meta = [p.dificultad ? `Dificultad: ${p.dificultad}` : null, p.luz ? `Luz: ${p.luz}` : null]
    .filter(Boolean)
    .join(' · ');
  if (meta) lines.push(meta);
  return lines.join('\n\n');
}

function toSku(id: string): string {
  return `MZ-${id.toUpperCase()}`;
}

function toImageUrl(imagen: string): string {
  // "assets/plantas/espada.jpg" -> "/assets/plantas/espada.jpg"
  // (served statically by apps/e-commerce, not by this API)
  return `/${imagen.replace(/^\/+/, '')}`;
}

async function main() {
  console.log('🌱 Seeding tenant "manzanitas"...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'manzanitas' },
    update: {},
    create: {
      id: MANZANITAS_TENANT_ID,
      name: 'Manzanitas',
      slug: 'manzanitas',
      status: 'ACTIVE',
      plan: 'STARTER',
      businessVertical: 'RETAIL',
      businessProfile: 'RETAIL',
    },
  });
  console.log('✅ Tenant:', tenant.slug, tenant.id);

  const categoryDefs = [
    { slug: 'plantas', name: 'Plantas Acuáticas', sortOrder: 0 },
    { slug: 'raices', name: 'Raíz de Manzanita', sortOrder: 1 },
    { slug: 'hardscape', name: 'Hardscape', sortOrder: 2 },
  ];

  const categoriesBySlug = new Map<string, { id: string }>();
  for (const c of categoryDefs) {
    const category = await prisma.category.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: c.slug } },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: {
        tenantId: tenant.id,
        slug: c.slug,
        name: c.name,
        sortOrder: c.sortOrder,
        status: 'ACTIVE',
      },
    });
    categoriesBySlug.set(c.slug, category);
  }
  console.log('✅ Categories:', [...categoriesBySlug.keys()].join(', '));

  const plantasPath = path.join(__dirname, '..', '..', 'apps', 'root-garden', 'data', 'plantas.json');
  const plantas: PlantaJson[] = JSON.parse(fs.readFileSync(plantasPath, 'utf-8'));

  let created = 0;
  let updated = 0;
  let imagesCreated = 0;

  for (const p of plantas) {
    const category = categoriesBySlug.get(p.categoria);
    if (!category) {
      console.warn(`⚠️  Skipping "${p.nombre}" — unknown categoria "${p.categoria}"`);
      continue;
    }

    const sku = toSku(p.id);
    const existing = await prisma.product.findUnique({
      where: { tenantId_sku: { tenantId: tenant.id, sku } },
    });

    const product = await prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku } },
      update: {
        name: p.nombre,
        description: buildDescription(p),
        price: p.precio,
        categoryId: category.id,
        status: 'ACTIVE',
        isEcommerce: true,
      },
      create: {
        tenantId: tenant.id,
        sku,
        slug: p.id,
        name: p.nombre,
        description: buildDescription(p),
        price: p.precio,
        categoryId: category.id,
        type: 'SIMPLE',
        status: 'ACTIVE',
        stock: 25,
        trackInventory: true,
        isEcommerce: true,
      },
    });

    existing ? updated++ : created++;

    const imageUrl = toImageUrl(p.imagen);
    const existingImage = await prisma.productImage.findFirst({
      where: { productId: product.id, url: imageUrl },
    });

    if (!existingImage) {
      await prisma.productImage.create({
        data: {
          productId: product.id,
          url: imageUrl,
          altText: p.nombre,
          isPrimary: true,
          sortOrder: 0,
        },
      });
      imagesCreated++;
    }
  }

  console.log(`✅ Products: ${created} created, ${updated} updated`);
  console.log(`✅ Images: ${imagesCreated} created`);
  console.log('🌱 Done. Tenant id for apps/e-commerce PUBLIC_TENANT_ID:', tenant.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
