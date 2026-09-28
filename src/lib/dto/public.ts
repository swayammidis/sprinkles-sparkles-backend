import "server-only";
import type { ProductFields, StockStatus } from "@/models/Product";
import type { TaxonomyFields } from "@/models/taxonomy";
import { paiseToRupees } from "@/lib/money";
import type {
  PublicImage,
  PublicMoney,
  PublicProductDetail,
  PublicProductSummary,
  PublicRef,
  PublicStockStatus,
  PublicTaxonomy,
} from "@/types/public-api";

/** Mongoose documents → public DTOs. The only place that knows both shapes. */

type Lean<T> = T & { _id: unknown };
export type RefMaps = {
  categories: Map<string, PublicRef>;
  subcategories: Map<string, PublicRef>;
  brands: Map<string, PublicRef>;
  collections: Map<string, PublicRef>;
  occasions: Map<string, PublicRef>;
};

export const money = (paise: number): PublicMoney => ({ amount: paiseToRupees(paise), paise });
const maybeMoney = (paise: number | null | undefined) => (paise == null ? null : money(paise));

const STOCK: Record<StockStatus, PublicStockStatus> = { in_stock: "in_stock", out_of_stock: "out_of_stock", on_backorder: "backorder" };

const ref = (map: Map<string, PublicRef>, id: unknown) => (id ? (map.get(String(id)) ?? null) : null);

function primaryImage(p: Pick<ProductFields, "images" | "name">): PublicImage | null {
  const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
  return img ? { url: img.url, alt: img.alt || p.name } : null;
}

export function toPublicTaxonomy(t: Lean<TaxonomyFields>): PublicTaxonomy {
  return { name: t.name, slug: t.slug, description: t.description ?? "", image: t.image ?? null };
}

export function toProductSummary(p: Lean<ProductFields>, refs: RefMaps): PublicProductSummary {
  const activeVariants = p.variants.filter((v) => v.isActive);
  const onSale = p.hasVariants ? activeVariants.some((v) => v.salePrice != null) : p.salePrice != null;
  return {
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription ?? "",
    price: money(p.price),
    salePrice: p.hasVariants ? null : maybeMoney(p.salePrice),
    fromPrice: money(p.effectivePrice),
    currency: "INR",
    stockStatus: STOCK[p.stockStatus],
    hasVariants: p.hasVariants && activeVariants.length > 0,
    image: primaryImage(p),
    category: ref(refs.categories, p.category),
    subcategory: ref(refs.subcategories, p.subcategory),
    brand: ref(refs.brands, p.brand),
    badges: { featured: p.featured, newArrival: p.newArrival, bestSeller: p.bestSeller, onSale },
  };
}

export function toProductDetail(p: Lean<ProductFields>, refs: RefMaps): PublicProductDetail {
  const imageByMedia = new Map(p.images.map((i) => [String(i.media), { url: i.url, alt: i.alt || p.name }]));
  const primary = primaryImage(p);
  return {
    ...toProductSummary(p, refs),
    sku: p.hasVariants ? null : p.sku,
    description: p.description ?? "",
    images: [...p.images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((i) => ({ url: i.url, alt: i.alt || p.name })),
    variantType: p.hasVariants ? p.variantType : null,
    variants: p.variants
      .filter((v) => v.isActive)
      .map((v) => ({
        id: String(v._id),
        label: v.label,
        sku: v.sku,
        price: money(v.price),
        salePrice: maybeMoney(v.salePrice),
        // Exact quantities stay internal; the storefront only needs availability.
        stockStatus: v.stockQuantity > 0 ? "in_stock" : p.allowBackorder ? "backorder" : "out_of_stock",
        weightGrams: v.weight,
        image: v.image ? (imageByMedia.get(String(v.image)) ?? null) : null,
      })),
    collections: p.collections.map((id) => ref(refs.collections, id)).filter((r): r is PublicRef => !!r),
    occasions: p.occasions.map((id) => ref(refs.occasions, id)).filter((r): r is PublicRef => !!r),
    tags: p.tags ?? [],
    shipping: {
      weightGrams: p.shipping?.weight ?? null,
      lengthCm: p.shipping?.length ?? null,
      widthCm: p.shipping?.width ?? null,
      heightCm: p.shipping?.height ?? null,
    },
    seo: { title: p.seo?.title || p.name, description: p.seo?.description || p.shortDescription || "", image: primary?.url ?? null },
  };
}
