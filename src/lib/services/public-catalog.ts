import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { PublicProductQuery } from "@/lib/validations/public-query";
import {
  toPublicCategory,
  toPublicProductDetail,
  toPublicProductSummary,
  publicProductDetailSelect,
  publicProductSummarySelect,
} from "@/lib/dto/public";
import type {
  Paginated,
  PublicBrand,
  PublicCategory,
  PublicCollection,
  PublicOccasion,
  PublicProductDetail,
  PublicProductSummary,
} from "@/types/public-api";

/** A product is publicly visible only when it and its taxonomy parents are active. */
export const PUBLIC_PRODUCT_WHERE: Prisma.ProductWhereInput = {
  active: true,
  AND: [
    { OR: [{ categoryId: null }, { category: { active: true } }] },
    { OR: [{ subcategoryId: null }, { subcategory: { active: true } }] },
  ],
};

export async function listPublicProducts(q: PublicProductQuery): Promise<Paginated<PublicProductSummary>> {
  const and: Prisma.ProductWhereInput[] = [PUBLIC_PRODUCT_WHERE];

  if (q.search) {
    and.push({
      OR: [
        { name: { contains: q.search, mode: "insensitive" } },
        { shortDescription: { contains: q.search, mode: "insensitive" } },
        { sku: { equals: q.search, mode: "insensitive" } },
      ],
    });
  }
  if (q.category) and.push({ category: { slug: q.category, active: true } });
  if (q.subcategory) and.push({ subcategory: { slug: q.subcategory, active: true } });
  if (q.brand) and.push({ brand: { slug: q.brand, active: true } });
  if (q.collection) and.push({ collections: { some: { collection: { slug: q.collection, active: true } } } });
  if (q.occasion) and.push({ occasions: { some: { occasion: { slug: q.occasion, active: true } } } });
  if (q.featured !== undefined) and.push({ featured: q.featured });
  if (q.newArrival !== undefined) and.push({ newArrival: q.newArrival });
  if (q.bestSeller !== undefined) and.push({ bestSeller: q.bestSeller });
  if (q.inStock) and.push({ stockStatus: { in: ["IN_STOCK", "ON_BACKORDER"] } });
  if (q.onSale) {
    and.push({
      OR: [{ salePrice: { not: null } }, { variants: { some: { active: true, salePrice: { not: null } } } }],
    });
  }
  if (q.minPrice || q.maxPrice) {
    and.push({
      effectivePrice: { ...(q.minPrice ? { gte: q.minPrice } : {}), ...(q.maxPrice ? { lte: q.maxPrice } : {}) },
    });
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = (() => {
    switch (q.sort) {
      case "price_asc":
        return [{ effectivePrice: "asc" }];
      case "price_desc":
        return [{ effectivePrice: "desc" }];
      case "name_asc":
        return [{ name: "asc" }];
      case "name_desc":
        return [{ name: "desc" }];
      case "featured":
        return [{ featured: "desc" }, { createdAt: "desc" }];
      case "newest":
      default:
        return [{ createdAt: "desc" }];
    }
  })();
  orderBy.push({ id: "asc" }); // stable pagination

  const where: Prisma.ProductWhereInput = { AND: and };
  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: publicProductSummarySelect,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: rows.map(toPublicProductSummary),
    pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
  };
}

export async function getPublicProductBySlug(slug: string): Promise<PublicProductDetail | null> {
  const row = await prisma.product.findFirst({
    where: { AND: [PUBLIC_PRODUCT_WHERE, { slug }] },
    select: publicProductDetailSelect,
  });
  return row ? toPublicProductDetail(row) : null;
}

const activeSubcategories = {
  where: { active: true },
  orderBy: [{ sortOrder: "asc" as const }, { name: "asc" as const }],
  select: { name: true, slug: true, description: true, image: true },
};

export async function listPublicCategories(): Promise<PublicCategory[]> {
  const rows = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true, slug: true, description: true, image: true, subcategories: activeSubcategories },
  });
  return rows.map(toPublicCategory);
}

export async function getPublicCategory(slug: string): Promise<PublicCategory | null> {
  const row = await prisma.category.findFirst({
    where: { slug, active: true },
    select: { name: true, slug: true, description: true, image: true, subcategories: activeSubcategories },
  });
  return row ? toPublicCategory(row) : null;
}

export async function getPublicSubcategory(slug: string) {
  const row = await prisma.subcategory.findFirst({
    where: { slug, active: true, category: { active: true } },
    select: { name: true, slug: true, description: true, image: true, category: { select: { name: true, slug: true } } },
  });
  return row;
}

export async function listPublicCollections(): Promise<PublicCollection[]> {
  return prisma.collection.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true, slug: true, description: true, bannerImage: true },
  });
}

export async function getPublicCollection(slug: string): Promise<PublicCollection | null> {
  return prisma.collection.findFirst({
    where: { slug, active: true },
    select: { name: true, slug: true, description: true, bannerImage: true },
  });
}

export async function listPublicOccasions(): Promise<PublicOccasion[]> {
  return prisma.occasion.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true, slug: true, description: true, image: true },
  });
}

export async function getPublicOccasion(slug: string): Promise<PublicOccasion | null> {
  return prisma.occasion.findFirst({
    where: { slug, active: true },
    select: { name: true, slug: true, description: true, image: true },
  });
}

export async function listPublicBrands(): Promise<PublicBrand[]> {
  return prisma.brand.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { name: true, slug: true, description: true, logo: true },
  });
}
