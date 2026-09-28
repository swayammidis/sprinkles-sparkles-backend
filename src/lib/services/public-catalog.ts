import "server-only";
import type { QueryFilter, SortOrder, Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Product, type ProductFields } from "@/models/Product";
import { Brand, Category, Collection, Occasion, Subcategory, type TaxonomyFields } from "@/models/taxonomy";
import { rupeesToPaise } from "@/lib/money";
import { escapeRegex } from "@/lib/services/media";
import { getStoreSettings } from "@/lib/services/settings";
import { toProductDetail, toProductSummary, toPublicTaxonomy, type RefMaps } from "@/lib/dto/public";
import type { PublicProductQuery } from "@/lib/validations/public-query";
import type {
  Paginated,
  PublicCategory,
  PublicProductDetail,
  PublicProductSummary,
  PublicRef,
  PublicStoreInfo,
  PublicSubcategory,
  PublicTaxonomy,
} from "@/types/public-api";

type LeanTax = TaxonomyFields & { _id: Types.ObjectId };

/**
 * Only ACTIVE categories/collections/… are visible, and a product is visible only when
 * it is Published and its category/subcategory (if any) are active.
 */
async function loadVisibility() {
  const fetch = (M: typeof Category) => M.find().select("name slug isActive category sortOrder").sort({ sortOrder: 1, name: 1 }).lean<LeanTax[]>();
  const [categories, subcategories, brands, collections, occasions] = await Promise.all([
    fetch(Category),
    fetch(Subcategory),
    fetch(Brand),
    fetch(Collection),
    fetch(Occasion),
  ]);
  const activeMap = (rows: LeanTax[]) => new Map(rows.filter((r) => r.isActive).map((r) => [String(r._id), { name: r.name, slug: r.slug } as PublicRef]));
  const bySlug = (rows: LeanTax[]) => new Map(rows.filter((r) => r.isActive).map((r) => [r.slug, r._id]));
  const refs: RefMaps = {
    categories: activeMap(categories),
    subcategories: activeMap(subcategories.filter((s) => categories.some((c) => c.isActive && String(c._id) === String(s.category)))),
    brands: activeMap(brands),
    collections: activeMap(collections),
    occasions: activeMap(occasions),
  };
  return {
    refs,
    slugs: {
      category: bySlug(categories),
      subcategory: bySlug(subcategories),
      brand: bySlug(brands),
      collection: bySlug(collections),
      occasion: bySlug(occasions),
    },
    hiddenCategories: categories.filter((c) => !c.isActive).map((c) => c._id),
    hiddenSubcategories: subcategories.filter((s) => !s.isActive).map((s) => s._id),
  };
}

function visibleFilter(v: Awaited<ReturnType<typeof loadVisibility>>): QueryFilter<ProductFields> {
  return {
    status: "published",
    ...(v.hiddenCategories.length ? { category: { $nin: v.hiddenCategories } } : {}),
    ...(v.hiddenSubcategories.length ? { subcategory: { $nin: v.hiddenSubcategories } } : {}),
  };
}

const SORTS: Record<PublicProductQuery["sort"], Record<string, SortOrder>> = {
  newest: { publishedAt: -1, createdAt: -1 },
  price_asc: { effectivePrice: 1 },
  price_desc: { effectivePrice: -1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 },
  featured: { featured: -1, publishedAt: -1 },
};

const EMPTY = (q: PublicProductQuery): Paginated<PublicProductSummary> => ({
  items: [],
  pagination: { page: q.page, pageSize: q.pageSize, total: 0, totalPages: 1 },
});

export async function listPublicProducts(q: PublicProductQuery): Promise<Paginated<PublicProductSummary>> {
  await connectDB();
  const v = await loadVisibility();
  const and: QueryFilter<ProductFields>[] = [visibleFilter(v)];

  // Filters by slug: an unknown or inactive slug returns no products.
  for (const key of ["category", "subcategory", "brand", "collection", "occasion"] as const) {
    const value = q[key];
    if (!value) continue;
    const id = v.slugs[key].get(value);
    if (!id) return EMPTY(q);
    const field = key === "collection" ? "collections" : key === "occasion" ? "occasions" : key;
    and.push({ [field]: id });
  }
  if (q.search) {
    const rx = { $regex: escapeRegex(q.search), $options: "i" };
    and.push({ $or: [{ name: rx }, { shortDescription: rx }, { tags: q.search.toLowerCase() }, { sku: q.search }] });
  }
  if (q.featured !== undefined) and.push({ featured: q.featured });
  if (q.newArrival !== undefined) and.push({ newArrival: q.newArrival });
  if (q.bestSeller !== undefined) and.push({ bestSeller: q.bestSeller });
  if (q.inStock) and.push({ stockStatus: { $in: ["in_stock", "on_backorder"] } });
  if (q.onSale) and.push({ $or: [{ salePrice: { $ne: null } }, { variants: { $elemMatch: { isActive: true, salePrice: { $ne: null } } } }] });
  const min = q.minPrice ? rupeesToPaise(q.minPrice) : null;
  const max = q.maxPrice ? rupeesToPaise(q.maxPrice) : null;
  if (min !== null || max !== null) and.push({ effectivePrice: { ...(min !== null ? { $gte: min } : {}), ...(max !== null ? { $lte: max } : {}) } });

  const filter = { $and: and };
  const [rows, total] = await Promise.all([
    Product.find(filter)
      .sort({ ...SORTS[q.sort], _id: 1 })
      .collation({ locale: "en", strength: 2 })
      .skip((q.page - 1) * q.pageSize)
      .limit(q.pageSize)
      .lean(),
    Product.countDocuments(filter),
  ]);
  return {
    items: rows.map((p) => toProductSummary(p, v.refs)),
    pagination: { page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
  };
}

export async function getPublicProduct(slug: string): Promise<PublicProductDetail | null> {
  await connectDB();
  const v = await loadVisibility();
  const p = await Product.findOne({ $and: [visibleFilter(v), { slug: slug.toLowerCase() }] }).lean();
  return p ? toProductDetail(p, v.refs) : null;
}

async function activeTaxonomy(M: typeof Category, extra: Record<string, unknown> = {}) {
  await connectDB();
  return M.find({ isActive: true, ...extra }).sort({ sortOrder: 1, name: 1 }).lean<LeanTax[]>();
}

export async function listPublicCategories(): Promise<PublicCategory[]> {
  const [cats, subs] = await Promise.all([activeTaxonomy(Category), activeTaxonomy(Subcategory)]);
  return cats.map((c) => ({
    ...toPublicTaxonomy(c),
    subcategories: subs.filter((s) => String(s.category) === String(c._id)).map(toPublicTaxonomy),
  }));
}

export async function getPublicCategory(slug: string): Promise<PublicCategory | null> {
  return (await listPublicCategories()).find((c) => c.slug === slug) ?? null;
}

export async function listPublicSubcategories(categorySlug?: string): Promise<PublicSubcategory[]> {
  const [cats, subs] = await Promise.all([activeTaxonomy(Category), activeTaxonomy(Subcategory)]);
  const catById = new Map(cats.map((c) => [String(c._id), { name: c.name, slug: c.slug }]));
  return subs
    .filter((s) => catById.has(String(s.category)))
    .map((s) => ({ ...toPublicTaxonomy(s), category: catById.get(String(s.category))! }))
    .filter((s) => !categorySlug || s.category.slug === categorySlug);
}

export async function getPublicSubcategory(slug: string): Promise<PublicSubcategory | null> {
  return (await listPublicSubcategories()).find((s) => s.slug === slug) ?? null;
}

export const listPublicCollections = async (): Promise<PublicTaxonomy[]> => (await activeTaxonomy(Collection)).map(toPublicTaxonomy);
export const listPublicOccasions = async (): Promise<PublicTaxonomy[]> => (await activeTaxonomy(Occasion)).map(toPublicTaxonomy);
export const listPublicBrands = async (): Promise<PublicTaxonomy[]> => (await activeTaxonomy(Brand)).map(toPublicTaxonomy);

export async function getPublicTaxonomyBySlug(kind: "collections" | "occasions" | "brands", slug: string) {
  const M = kind === "collections" ? Collection : kind === "occasions" ? Occasion : Brand;
  const row = (await activeTaxonomy(M, { slug }))[0];
  return row ? toPublicTaxonomy(row) : null;
}

export async function getPublicStoreInfo(): Promise<PublicStoreInfo> {
  const s = await getStoreSettings();
  return {
    storeName: s.storeName,
    tagline: s.tagline,
    contact: { email: s.email, phone: s.phone, whatsapp: s.whatsapp },
    address: s.address,
    social: s.social,
  };
}
