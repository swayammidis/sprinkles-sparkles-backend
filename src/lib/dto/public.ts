import "server-only";
import type { Prisma, StockStatus } from "@/generated/prisma/client";
import type {
  PublicCategory,
  PublicImage,
  PublicProductDetail,
  PublicProductSummary,
  PublicStockStatus,
  PublicTaxonomyRef,
  PublicVariant,
} from "@/types/public-api";

/**
 * Prisma → public DTO mappers. The selects below are the single source of truth
 * for which columns the storefront API reads — nothing else is fetched.
 */

const ref = { select: { name: true, slug: true, active: true } } as const;

export const publicProductSummarySelect = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  sku: true,
  price: true,
  salePrice: true,
  effectivePrice: true,
  stockStatus: true,
  hasVariants: true,
  featured: true,
  newArrival: true,
  bestSeller: true,
  category: ref,
  subcategory: ref,
  brand: ref,
  images: {
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    take: 1,
    select: { url: true, altText: true, isPrimary: true },
  },
  variants: { where: { active: true, salePrice: { not: null } }, select: { id: true }, take: 1 },
} satisfies Prisma.ProductSelect;

export const publicProductDetailSelect = {
  ...publicProductSummarySelect,
  description: true,
  weight: true,
  length: true,
  width: true,
  height: true,
  seoTitle: true,
  seoDescription: true,
  seoImage: true,
  images: {
    orderBy: [{ sortOrder: "asc" }],
    select: { url: true, altText: true, isPrimary: true },
  },
  variants: {
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      salePrice: true,
      stockQuantity: true,
      weight: true,
      image: { select: { url: true, altText: true, isPrimary: true } },
      attributes: { select: { name: true, value: true }, orderBy: { name: "asc" } },
    },
  },
  collections: { where: { collection: { active: true } }, select: { collection: { select: { name: true, slug: true } } } },
  occasions: { where: { occasion: { active: true } }, select: { occasion: { select: { name: true, slug: true } } } },
} satisfies Prisma.ProductSelect;

type SummaryRow = Prisma.ProductGetPayload<{ select: typeof publicProductSummarySelect }>;
type DetailRow = Prisma.ProductGetPayload<{ select: typeof publicProductDetailSelect }>;

const m = (d: Prisma.Decimal) => d.toFixed(2);
const mNull = (d: Prisma.Decimal | null) => (d == null ? null : d.toFixed(2));
const dNull = (d: Prisma.Decimal | null) => (d == null ? null : d.toString());

const STOCK: Record<StockStatus, PublicStockStatus> = {
  IN_STOCK: "in_stock",
  OUT_OF_STOCK: "out_of_stock",
  ON_BACKORDER: "backorder",
};

const toRef = (r: { name: string; slug: string; active: boolean } | null): PublicTaxonomyRef | null =>
  r && r.active ? { name: r.name, slug: r.slug } : null;

const toImage = (i: { url: string; altText: string | null; isPrimary: boolean }, fallbackAlt: string): PublicImage => ({
  url: i.url,
  alt: i.altText || fallbackAlt,
  isPrimary: i.isPrimary,
});

export function toPublicProductSummary(p: SummaryRow): PublicProductSummary {
  const primary = p.images[0];
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    sku: p.sku,
    price: m(p.price),
    salePrice: mNull(p.salePrice),
    fromPrice: m(p.effectivePrice),
    currency: "INR",
    stockStatus: STOCK[p.stockStatus],
    hasVariants: p.hasVariants,
    image: primary ? toImage(primary, p.name) : null,
    category: toRef(p.category),
    subcategory: toRef(p.subcategory),
    brand: toRef(p.brand),
    badges: {
      featured: p.featured,
      newArrival: p.newArrival,
      bestSeller: p.bestSeller,
      onSale: p.salePrice != null || p.variants.length > 0,
    },
  };
}

export function toPublicProductDetail(p: DetailRow): PublicProductDetail {
  const images = p.images.map((i) => toImage(i, p.name));
  const primary = images.find((i) => i.isPrimary) ?? images[0] ?? null;
  const variants: PublicVariant[] = p.variants.map((v) => ({
    id: v.id,
    name: v.name,
    sku: v.sku,
    price: m(v.price),
    salePrice: mNull(v.salePrice),
    // Exact quantities are internal; the storefront only needs availability.
    stockStatus: v.stockQuantity > 0 ? "in_stock" : p.stockStatus === "ON_BACKORDER" ? "backorder" : "out_of_stock",
    weightGrams: dNull(v.weight),
    image: v.image ? toImage(v.image, `${p.name} – ${v.name}`) : null,
    attributes: Object.fromEntries(v.attributes.map((a) => [a.name, a.value])),
  }));
  return {
    ...toPublicProductSummary({ ...p, images: primary ? [{ url: primary.url, altText: primary.alt, isPrimary: primary.isPrimary }] : [], variants: p.variants.filter((v) => v.salePrice != null) }),
    description: p.description,
    images,
    variants,
    collections: p.collections.map((c) => c.collection),
    occasions: p.occasions.map((o) => o.occasion),
    shipping: {
      weightGrams: dNull(p.weight),
      lengthCm: dNull(p.length),
      widthCm: dNull(p.width),
      heightCm: dNull(p.height),
    },
    seo: {
      title: p.seoTitle || p.name,
      description: p.seoDescription || p.shortDescription,
      image: p.seoImage || primary?.url || null,
    },
  };
}

export function toPublicCategory(c: {
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  subcategories: { name: string; slug: string; description: string | null; image: string | null }[];
}): PublicCategory {
  return { name: c.name, slug: c.slug, description: c.description, image: c.image, subcategories: c.subcategories };
}
