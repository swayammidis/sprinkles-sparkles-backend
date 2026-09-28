import "server-only";
import { prisma } from "@/lib/db/prisma";
import { Prisma, type StockStatus } from "@/generated/prisma/client";
import { badRequest, notFound } from "@/lib/api/errors";
import {
  LOW_STOCK_THRESHOLD,
  type ProductInput,
  type ProductListQuery,
  type productPatchSchema,
} from "@/lib/validations/product";
import { compareMoney } from "@/lib/validations/common";
import type { z } from "zod";

type Tx = Prisma.TransactionClient;

const orNull = (v: string | undefined | null) => (v === undefined || v === null || v.trim() === "" ? null : v.trim());
const money = (d: Prisma.Decimal | null | undefined) => (d == null ? "" : d.toFixed(2));
const decimalStr = (d: Prisma.Decimal | null | undefined) => (d == null ? "" : d.toString());

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listProducts(q: ProductListQuery) {
  const where: Prisma.ProductWhereInput = {};
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: "insensitive" } },
      { sku: { contains: q.q, mode: "insensitive" } },
      { variants: { some: { sku: { contains: q.q, mode: "insensitive" } } } },
    ];
  }
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.status) where.active = q.status === "active";
  if (q.featured) where.featured = q.featured === "true";
  switch (q.stock) {
    case "in_stock":
      where.stockStatus = "IN_STOCK";
      break;
    case "out_of_stock":
      where.stockStatus = "OUT_OF_STOCK";
      break;
    case "backorder":
      where.stockStatus = "ON_BACKORDER";
      break;
    case "low_stock":
      where.stockQuantity = { gt: 0, lte: LOW_STOCK_THRESHOLD };
      break;
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ [q.sort]: q.dir }, { id: "asc" }];

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        price: true,
        salePrice: true,
        stockQuantity: true,
        stockStatus: true,
        hasVariants: true,
        active: true,
        featured: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        images: { where: { isPrimary: true }, select: { url: true, altText: true }, take: 1 },
        _count: { select: { variants: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      price: money(p.price),
      salePrice: money(p.salePrice),
      stockQuantity: p.stockQuantity,
      stockStatus: p.stockStatus,
      hasVariants: p.hasVariants,
      variantCount: p._count.variants,
      active: p.active,
      featured: p.featured,
      updatedAt: p.updatedAt.toISOString(),
      category: p.category,
      image: p.images[0] ?? null,
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export type AdminProductListItem = Awaited<ReturnType<typeof listProducts>>["items"][number];

// ---------------------------------------------------------------------------
// Read (for edit form)
// ---------------------------------------------------------------------------

export async function getProductForEdit(id: string) {
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: {
        orderBy: { sortOrder: "asc" },
        include: { attributes: { orderBy: { name: "asc" } }, image: { select: { mediaAssetId: true } } },
      },
      collections: { select: { collectionId: true } },
      occasions: { select: { occasionId: true } },
    },
  });
  if (!p) return null;

  let seoImageMediaId = "";
  let seoImageUrl = "";
  if (p.seoImage) {
    const asset = await prisma.mediaAsset.findFirst({ where: { url: p.seoImage }, select: { id: true } });
    seoImageMediaId = asset?.id ?? "";
    seoImageUrl = p.seoImage;
  }

  const values: ProductInput = {
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    shortDescription: p.shortDescription ?? "",
    description: p.description ?? "",
    price: money(p.price),
    salePrice: money(p.salePrice),
    stockQuantity: p.stockQuantity,
    stockStatus: p.stockStatus,
    categoryId: p.categoryId ?? "",
    subcategoryId: p.subcategoryId ?? "",
    brandId: p.brandId ?? "",
    collectionIds: p.collections.map((c) => c.collectionId),
    occasionIds: p.occasions.map((o) => o.occasionId),
    images: p.images
      .filter((i) => i.mediaAssetId)
      .map((i) => ({
        id: i.id,
        mediaAssetId: i.mediaAssetId as string,
        url: i.url,
        altText: i.altText ?? "",
        isPrimary: i.isPrimary,
      })),
    hasVariants: p.hasVariants,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      sku: v.sku,
      price: money(v.price),
      salePrice: money(v.salePrice),
      stockQuantity: v.stockQuantity,
      weight: decimalStr(v.weight),
      active: v.active,
      imageMediaAssetId: v.image?.mediaAssetId ?? "",
      attributes: v.attributes.map((a) => ({ name: a.name, value: a.value })),
    })),
    weight: decimalStr(p.weight),
    length: decimalStr(p.length),
    width: decimalStr(p.width),
    height: decimalStr(p.height),
    active: p.active,
    featured: p.featured,
    newArrival: p.newArrival,
    bestSeller: p.bestSeller,
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
    seoImage: seoImageMediaId,
  };

  return { id: p.id, updatedAt: p.updatedAt.toISOString(), values, seoImageUrl };
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

/** Server-side derivation: never trust client-computed stock totals/status. */
function deriveStock(input: ProductInput): { stockQuantity: number; stockStatus: StockStatus } {
  const qty = input.hasVariants
    ? input.variants.filter((v) => v.active).reduce((sum, v) => sum + v.stockQuantity, 0)
    : input.stockQuantity;
  if (input.stockStatus === "ON_BACKORDER") return { stockQuantity: qty, stockStatus: "ON_BACKORDER" };
  return { stockQuantity: qty, stockStatus: qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK" };
}

/** Verify every referenced id exists and is consistent. Returns media asset URL map. */
async function resolveReferences(tx: Tx, input: ProductInput) {
  const categoryId = orNull(input.categoryId);
  const subcategoryId = orNull(input.subcategoryId);
  const brandId = orNull(input.brandId);

  const errors: Record<string, string[]> = {};
  const mediaIds = [...new Set([...input.images.map((i) => i.mediaAssetId), ...(input.seoImage ? [input.seoImage] : [])])];

  const [category, subcategory, brand, collections, occasions, media] = await Promise.all([
    categoryId ? tx.category.findUnique({ where: { id: categoryId }, select: { id: true } }) : null,
    subcategoryId
      ? tx.subcategory.findUnique({ where: { id: subcategoryId }, select: { id: true, categoryId: true } })
      : null,
    brandId ? tx.brand.findUnique({ where: { id: brandId }, select: { id: true } }) : null,
    input.collectionIds.length
      ? tx.collection.findMany({ where: { id: { in: input.collectionIds } }, select: { id: true } })
      : [],
    input.occasionIds.length
      ? tx.occasion.findMany({ where: { id: { in: input.occasionIds } }, select: { id: true } })
      : [],
    mediaIds.length ? tx.mediaAsset.findMany({ where: { id: { in: mediaIds } }, select: { id: true, url: true } }) : [],
  ]);

  if (categoryId && !category) errors.categoryId = ["Category not found"];
  if (subcategoryId && !subcategory) errors.subcategoryId = ["Subcategory not found"];
  if (subcategory && subcategory.categoryId !== categoryId) {
    errors.subcategoryId = ["Subcategory does not belong to the selected category"];
  }
  if (brandId && !brand) errors.brandId = ["Brand not found"];
  if (collections.length !== new Set(input.collectionIds).size) errors.collectionIds = ["Unknown collection"];
  if (occasions.length !== new Set(input.occasionIds).size) errors.occasionIds = ["Unknown occasion"];
  const mediaUrl = new Map(media.map((m) => [m.id, m.url]));
  if (mediaIds.some((id) => !mediaUrl.has(id))) errors.images = ["One or more images no longer exist"];

  if (Object.keys(errors).length) throw badRequest("Invalid references", { fieldErrors: errors });

  return { categoryId, subcategoryId, brandId, mediaUrl };
}

/** Lowest price a customer pays, as a decimal string. Compared exactly (no floats). */
function deriveEffectivePrice(input: ProductInput): string {
  const pay = (price: string, sale: string) => (sale ? sale : price);
  const candidates = input.hasVariants
    ? input.variants.filter((v) => v.active).map((v) => pay(v.price, v.salePrice))
    : [];
  if (candidates.length === 0) candidates.push(pay(input.price, input.salePrice));
  return candidates.reduce((min, p) => (compareMoney(p, min) < 0 ? p : min));
}

function scalarData(input: ProductInput, mediaUrl: Map<string, string>) {
  const stock = deriveStock(input);
  return {
    effectivePrice: deriveEffectivePrice(input),
    name: input.name,
    slug: input.slug,
    sku: input.sku,
    shortDescription: orNull(input.shortDescription),
    description: orNull(input.description),
    price: input.price,
    salePrice: orNull(input.salePrice),
    stockQuantity: stock.stockQuantity,
    stockStatus: stock.stockStatus,
    hasVariants: input.hasVariants,
    weight: orNull(input.weight),
    length: orNull(input.length),
    width: orNull(input.width),
    height: orNull(input.height),
    active: input.active,
    featured: input.featured,
    newArrival: input.newArrival,
    bestSeller: input.bestSeller,
    seoTitle: orNull(input.seoTitle),
    seoDescription: orNull(input.seoDescription),
    seoImage: input.seoImage ? (mediaUrl.get(input.seoImage) ?? null) : null,
  };
}

async function syncImages(tx: Tx, productId: string, input: ProductInput, mediaUrl: Map<string, string>) {
  const existing = await tx.productImage.findMany({ where: { productId }, select: { id: true } });
  const existingIds = new Set(existing.map((e) => e.id));
  const keepIds = new Set(input.images.map((i) => i.id).filter((id): id is string => !!id && existingIds.has(id)));

  await tx.productImage.deleteMany({ where: { productId, id: { notIn: [...keepIds] } } });
  // Clear primary first so the partial unique index is never violated mid-update.
  await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });

  const primaryIndex = Math.max(
    0,
    input.images.findIndex((i) => i.isPrimary),
  );

  const mediaToImageId = new Map<string, string>();
  for (const [index, img] of input.images.entries()) {
    const data = {
      mediaAssetId: img.mediaAssetId,
      url: mediaUrl.get(img.mediaAssetId)!,
      altText: orNull(img.altText),
      sortOrder: index,
      isPrimary: index === primaryIndex,
    };
    const row =
      img.id && keepIds.has(img.id)
        ? await tx.productImage.update({ where: { id: img.id }, data, select: { id: true } })
        : await tx.productImage.create({ data: { ...data, productId }, select: { id: true } });
    mediaToImageId.set(img.mediaAssetId, row.id);
  }
  return mediaToImageId;
}

async function syncVariants(tx: Tx, productId: string, input: ProductInput, mediaToImageId: Map<string, string>) {
  const variants = input.hasVariants ? input.variants : [];
  const existing = await tx.productVariant.findMany({ where: { productId }, select: { id: true } });
  const existingIds = new Set(existing.map((e) => e.id));
  const keepIds = variants.map((v) => v.id).filter((id): id is string => !!id && existingIds.has(id));

  await tx.productVariant.deleteMany({ where: { productId, id: { notIn: keepIds } } });

  for (const [index, v] of variants.entries()) {
    const data = {
      name: v.name,
      sku: v.sku,
      price: v.price,
      salePrice: orNull(v.salePrice),
      stockQuantity: v.stockQuantity,
      weight: orNull(v.weight),
      active: v.active,
      sortOrder: index,
      imageId: v.imageMediaAssetId ? (mediaToImageId.get(v.imageMediaAssetId) ?? null) : null,
    };
    const variantId =
      v.id && existingIds.has(v.id)
        ? (await tx.productVariant.update({ where: { id: v.id }, data, select: { id: true } })).id
        : (await tx.productVariant.create({ data: { ...data, productId }, select: { id: true } })).id;

    await tx.variantAttribute.deleteMany({ where: { variantId } });
    if (v.attributes.length) {
      await tx.variantAttribute.createMany({
        data: v.attributes.map((a) => ({ variantId, name: a.name, value: a.value })),
      });
    }
  }
}

async function syncRelations(tx: Tx, productId: string, input: ProductInput) {
  await tx.productCollection.deleteMany({ where: { productId } });
  if (input.collectionIds.length) {
    await tx.productCollection.createMany({
      data: [...new Set(input.collectionIds)].map((collectionId) => ({ productId, collectionId })),
    });
  }
  await tx.productOccasion.deleteMany({ where: { productId } });
  if (input.occasionIds.length) {
    await tx.productOccasion.createMany({
      data: [...new Set(input.occasionIds)].map((occasionId) => ({ productId, occasionId })),
    });
  }
}

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

export async function createProduct(input: ProductInput) {
  return prisma.$transaction(async (tx) => {
    const refs = await resolveReferences(tx, input);
    const product = await tx.product.create({
      data: {
        ...scalarData(input, refs.mediaUrl),
        categoryId: refs.categoryId,
        subcategoryId: refs.subcategoryId,
        brandId: refs.brandId,
      },
      select: { id: true },
    });
    const mediaToImageId = await syncImages(tx, product.id, input, refs.mediaUrl);
    await syncVariants(tx, product.id, input, mediaToImageId);
    await syncRelations(tx, product.id, input);
    return product;
  }, TX_OPTIONS);
}

export async function updateProduct(id: string, input: ProductInput) {
  return prisma.$transaction(async (tx) => {
    const exists = await tx.product.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound("Product");
    const refs = await resolveReferences(tx, input);
    await tx.product.update({
      where: { id },
      data: {
        ...scalarData(input, refs.mediaUrl),
        categoryId: refs.categoryId,
        subcategoryId: refs.subcategoryId,
        brandId: refs.brandId,
      },
    });
    const mediaToImageId = await syncImages(tx, id, input, refs.mediaUrl);
    await syncVariants(tx, id, input, mediaToImageId);
    await syncRelations(tx, id, input);
    const updated = await tx.product.findUniqueOrThrow({ where: { id }, select: { id: true, updatedAt: true } });
    return { id: updated.id, updatedAt: updated.updatedAt.toISOString() };
  }, TX_OPTIONS);
}

export async function patchProduct(id: string, patch: z.infer<typeof productPatchSchema>) {
  const product = await prisma.product.findUnique({ where: { id }, select: { hasVariants: true, stockStatus: true } });
  if (!product) throw notFound("Product");

  const data: Prisma.ProductUpdateInput = { ...patch };
  if (patch.stockQuantity !== undefined) {
    if (product.hasVariants) throw badRequest("Stock for products with variants is managed per variant");
    if (product.stockStatus !== "ON_BACKORDER") {
      data.stockStatus = patch.stockQuantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
    }
  }
  const updated = await prisma.product.update({
    where: { id },
    data,
    select: { id: true, active: true, featured: true, newArrival: true, bestSeller: true, stockQuantity: true, stockStatus: true },
  });
  return updated;
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

async function uniqueValue(base: string, exists: (v: string) => Promise<boolean>, sep: string, max: number) {
  for (let n = 1; n < 1000; n++) {
    const suffix = `${sep}copy${n > 1 ? `${sep}${n}` : ""}`;
    const candidate = base.slice(0, max - suffix.length) + suffix;
    if (!(await exists(candidate))) return candidate;
  }
  throw badRequest("Could not generate a unique value");
}

export async function duplicateProduct(id: string) {
  const src = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variants: { orderBy: { sortOrder: "asc" }, include: { attributes: true } },
      collections: true,
      occasions: true,
    },
  });
  if (!src) throw notFound("Product");

  return prisma.$transaction(async (tx) => {
    const slug = await uniqueValue(src.slug, async (v) => !!(await tx.product.findUnique({ where: { slug: v } })), "-", 140);
    const sku = await uniqueValue(src.sku, async (v) => !!(await tx.product.findUnique({ where: { sku: v } })), "-", 64);

    const {
      id: _id,
      createdAt: _c,
      updatedAt: _u,
      images,
      variants,
      collections,
      occasions,
      ...scalars
    } = src;
    void _id;
    void _c;
    void _u;

    const copy = await tx.product.create({
      data: { ...scalars, name: `${src.name} (Copy)`.slice(0, 120), slug, sku, active: false },
      select: { id: true },
    });

    const imageIdMap = new Map<string, string>();
    for (const img of images) {
      const created = await tx.productImage.create({
        data: {
          productId: copy.id,
          mediaAssetId: img.mediaAssetId,
          url: img.url,
          altText: img.altText,
          sortOrder: img.sortOrder,
          isPrimary: img.isPrimary,
        },
        select: { id: true },
      });
      imageIdMap.set(img.id, created.id);
    }

    for (const v of variants) {
      const vSku = await uniqueValue(
        v.sku,
        async (s) => !!(await tx.productVariant.findUnique({ where: { sku: s } })),
        "-",
        64,
      );
      await tx.productVariant.create({
        data: {
          productId: copy.id,
          name: v.name,
          sku: vSku,
          price: v.price,
          salePrice: v.salePrice,
          stockQuantity: v.stockQuantity,
          weight: v.weight,
          active: v.active,
          sortOrder: v.sortOrder,
          imageId: v.imageId ? (imageIdMap.get(v.imageId) ?? null) : null,
          attributes: { create: v.attributes.map((a) => ({ name: a.name, value: a.value })) },
        },
      });
    }

    if (collections.length) {
      await tx.productCollection.createMany({
        data: collections.map((c) => ({ productId: copy.id, collectionId: c.collectionId, sortOrder: c.sortOrder })),
      });
    }
    if (occasions.length) {
      await tx.productOccasion.createMany({
        data: occasions.map((o) => ({ productId: copy.id, occasionId: o.occasionId })),
      });
    }
    return copy;
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Options for form selects
// ---------------------------------------------------------------------------

export async function getProductFormOptions() {
  const [categories, subcategories, brands, collections, occasions] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.subcategory.findMany({
      select: { id: true, name: true, categoryId: true, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.brand.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
    prisma.collection.findMany({ select: { id: true, name: true, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.occasion.findMany({ select: { id: true, name: true, active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  return { categories, subcategories, brands, collections, occasions };
}

export type ProductFormOptions = Awaited<ReturnType<typeof getProductFormOptions>>;
