import "server-only";
import { Types, type QueryFilter, type SortOrder } from "mongoose";
import { connectDB } from "@/lib/db";
import { ApiError } from "@/lib/api/admin-route";
import { Product, type ProductFields, type StockStatus } from "@/models/Product";
import { Brand, Category, Collection, Occasion, Subcategory } from "@/models/taxonomy";
import { paiseToInput, rupeesToPaise } from "@/lib/money";
import { slugify, type ProductInput, type ProductListQuery, type ProductSort } from "@/lib/validations/catalog";
import { escapeRegex, resolveMedia } from "@/lib/services/media";
import { getLowStockThreshold } from "@/lib/services/settings";

const oid = (id: string) => new Types.ObjectId(id);
const toNum = (v: string) => (v === "" ? null : Number(v));

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export type ProductListItem = {
  id: string;
  name: string;
  sku: string;
  image: string;
  categoryName: string;
  price: number;
  salePrice: number | null;
  effectivePrice: number;
  hasVariants: boolean;
  variantCount: number;
  stockQuantity: number;
  stockStatus: StockStatus;
  status: "draft" | "published";
  featured: boolean;
  newArrival: boolean;
  updatedAt: string;
};

const SORTS: Record<ProductSort, Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name_asc: { name: 1 },
  name_desc: { name: -1 },
  price_asc: { effectivePrice: 1 },
  price_desc: { effectivePrice: -1 },
  stock_asc: { stockQuantity: 1 },
};

export async function listProducts(q: ProductListQuery) {
  await connectDB();
  const threshold = await getLowStockThreshold();
  const filter: QueryFilter<ProductFields> = {};
  if (q.q) {
    const rx = { $regex: escapeRegex(q.q), $options: "i" };
    filter.$or = [{ name: rx }, { sku: rx }, { "variants.sku": rx }];
  }
  if (q.category) filter.category = oid(q.category);
  if (q.status) filter.status = q.status;
  if (q.featured) filter.featured = q.featured === "yes";
  if (q.newArrival) filter.newArrival = q.newArrival === "yes";
  if (q.stock === "in_stock") filter.stockStatus = { $in: ["in_stock", "on_backorder"] };
  if (q.stock === "out_of_stock") filter.stockStatus = "out_of_stock";
  if (q.stock === "low_stock") filter.stockQuantity = { $gt: 0, $lte: threshold };

  const [rows, total] = await Promise.all([
    Product.find(filter)
      .select("name sku images category price salePrice effectivePrice hasVariants variants._id stockQuantity stockStatus status featured newArrival updatedAt")
      .sort({ ...SORTS[q.sort], _id: 1 })
      .collation({ locale: "en", strength: 2 })
      .skip((q.page - 1) * q.pageSize)
      .limit(q.pageSize)
      .lean(),
    Product.countDocuments(filter),
  ]);

  const catIds = [...new Set(rows.map((r) => r.category).filter(Boolean).map(String))];
  const cats = await Category.find({ _id: { $in: catIds } }).select("name").lean();
  const catName = new Map(cats.map((c) => [String(c._id), c.name]));

  const items: ProductListItem[] = rows.map((r) => ({
    id: String(r._id),
    name: r.name,
    sku: r.sku ?? "",
    image: (r.images.find((i) => i.isPrimary) ?? r.images[0])?.url ?? "",
    categoryName: r.category ? (catName.get(String(r.category)) ?? "") : "",
    price: r.price,
    salePrice: r.salePrice,
    effectivePrice: r.effectivePrice,
    hasVariants: r.hasVariants,
    variantCount: r.variants?.length ?? 0,
    stockQuantity: r.stockQuantity,
    stockStatus: r.stockStatus,
    status: r.status,
    featured: r.featured,
    newArrival: r.newArrival,
    updatedAt: r.updatedAt.toISOString(),
  }));
  return { items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)), lowStockThreshold: threshold };
}

/** Small search used by the "add products to collection" picker. */
export async function searchProductsLite(q: string, limit = 20) {
  await connectDB();
  const rx = { $regex: escapeRegex(q), $options: "i" };
  const rows = await Product.find(q ? { $or: [{ name: rx }, { sku: rx }] } : {})
    .select("name sku status images collections")
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();
  return rows.map((p) => ({
    id: String(p._id),
    name: p.name,
    sku: p.sku ?? "",
    status: p.status,
    image: (p.images.find((i) => i.isPrimary) ?? p.images[0])?.url ?? "",
    collectionIds: p.collections.map(String),
  }));
}

// ---------------------------------------------------------------------------
// Read for the edit form
// ---------------------------------------------------------------------------

export async function getProductForEdit(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) return null;
  const p = await Product.findById(id).lean();
  if (!p) return null;
  const values: ProductInput = {
    status: p.status,
    name: p.name,
    sku: p.sku ?? "",
    slug: p.slug,
    shortDescription: p.shortDescription ?? "",
    description: p.description ?? "",
    price: p.hasVariants && p.price === 0 ? "" : paiseToInput(p.price),
    salePrice: paiseToInput(p.salePrice),
    stockQuantity: p.hasVariants ? 0 : p.stockQuantity,
    allowBackorder: p.allowBackorder,
    category: p.category ? String(p.category) : "",
    subcategory: p.subcategory ? String(p.subcategory) : "",
    brand: p.brand ? String(p.brand) : "",
    collections: p.collections.map(String),
    occasions: p.occasions.map(String),
    tags: p.tags ?? [],
    images: p.images.map((i) => ({ media: String(i.media), url: i.url, alt: i.alt ?? "", isPrimary: i.isPrimary })),
    hasVariants: p.hasVariants,
    variantType: p.variantType || "Size",
    variants: p.variants.map((v) => ({
      id: String(v._id),
      label: v.label,
      sku: v.sku ?? "",
      price: paiseToInput(v.price),
      salePrice: paiseToInput(v.salePrice),
      stockQuantity: v.stockQuantity,
      weight: v.weight == null ? "" : String(v.weight),
      isActive: v.isActive,
      image: v.image ? String(v.image) : "",
    })),
    shipping: {
      weight: p.shipping?.weight == null ? "" : String(p.shipping.weight),
      length: p.shipping?.length == null ? "" : String(p.shipping.length),
      width: p.shipping?.width == null ? "" : String(p.shipping.width),
      height: p.shipping?.height == null ? "" : String(p.shipping.height),
    },
    featured: p.featured,
    newArrival: p.newArrival,
    bestSeller: p.bestSeller,
    seoTitle: p.seo?.title ?? "",
    seoDescription: p.seo?.description ?? "",
  };
  return { id: String(p._id), values, updatedAt: p.updatedAt.toISOString(), stockQuantity: p.stockQuantity, stockStatus: p.stockStatus };
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------

function fieldError(field: string, message: string, status = 422): never {
  throw new ApiError(status, message, { [field]: message });
}

async function uniqueProductSlug(base: string, excludeId?: string) {
  const root = base || "product";
  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (!(await Product.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }))) return candidate;
  }
  fieldError("slug", "Please choose a different URL name.", 409);
}

/** Server-side derivation of prices, stock and relationships. Nothing here is trusted from the client. */
async function buildProductData(input: ProductInput, existingId?: string): Promise<Partial<ProductFields>> {
  // Relationships must exist (and the subcategory must belong to the category).
  const [category, subcategory, brand, collections, occasions] = await Promise.all([
    input.category ? Category.findById(input.category).select("_id").lean() : null,
    input.subcategory ? Subcategory.findById(input.subcategory).select("category").lean() : null,
    input.brand ? Brand.findById(input.brand).select("_id").lean() : null,
    input.collections.length ? Collection.find({ _id: { $in: input.collections } }).select("_id").lean() : [],
    input.occasions.length ? Occasion.find({ _id: { $in: input.occasions } }).select("_id").lean() : [],
  ]);
  if (input.category && !category) fieldError("category", "That category no longer exists. Please select another.");
  if (input.subcategory && !subcategory) fieldError("subcategory", "That subcategory no longer exists. Please select another.");
  if (subcategory && String(subcategory.category) !== input.category) {
    fieldError("subcategory", "This subcategory belongs to a different category.");
  }
  if (input.brand && !brand) fieldError("brand", "That brand no longer exists.");

  // SKU uniqueness across products (the unique indexes enforce this too; this gives a clear message).
  const notSelf = existingId ? { _id: { $ne: oid(existingId) } } : {};
  if (input.sku && (await Product.exists({ sku: input.sku, ...notSelf }))) {
    fieldError("sku", "A product with this SKU already exists.", 409);
  }
  const variantSkus = input.hasVariants ? input.variants.map((v) => v.sku).filter(Boolean) : [];
  if (variantSkus.length && (await Product.exists({ "variants.sku": { $in: variantSkus }, ...notSelf }))) {
    fieldError("variants", "One of the option SKUs is already used by another product.", 409);
  }

  // Images: URLs always come from the media library.
  const mediaUrls = await resolveMedia(input.images.map((i) => i.media));
  const images = input.images
    .filter((i) => mediaUrls.has(i.media))
    .map((i) => ({ media: oid(i.media), url: mediaUrls.get(i.media)!, alt: i.alt, isPrimary: i.isPrimary }));
  if (images.length && !images.some((i) => i.isPrimary)) images[0].isPrimary = true;
  const imageIds = new Set(images.map((i) => String(i.media)));

  // Money in paise.
  const price = input.price ? rupeesToPaise(input.price)! : 0;
  const salePrice = input.salePrice ? rupeesToPaise(input.salePrice) : null;

  const variants = input.hasVariants
    ? input.variants.map((v) => ({
        ...(v.id && Types.ObjectId.isValid(v.id) ? { _id: oid(v.id) } : {}),
        label: v.label,
        sku: v.sku || null,
        price: rupeesToPaise(v.price) ?? 0,
        salePrice: v.salePrice ? rupeesToPaise(v.salePrice) : null,
        stockQuantity: v.stockQuantity,
        weight: toNum(v.weight),
        isActive: v.isActive,
        image: v.image && imageIds.has(v.image) ? oid(v.image) : null,
      }))
    : [];

  const activeVariants = variants.filter((v) => v.isActive);
  const payable = (p: number, s: number | null) => (s !== null && s < p ? s : p);
  const effectivePrice = activeVariants.length
    ? Math.min(...activeVariants.map((v) => payable(v.price, v.salePrice)))
    : payable(price, salePrice);
  const basePrice = input.hasVariants && !input.price && activeVariants.length ? Math.min(...activeVariants.map((v) => v.price)) : price;

  const stockQuantity = input.hasVariants ? activeVariants.reduce((sum, v) => sum + v.stockQuantity, 0) : input.stockQuantity;
  const stockStatus: StockStatus = stockQuantity > 0 ? "in_stock" : input.allowBackorder ? "on_backorder" : "out_of_stock";

  const slug = input.slug
    ? (await Product.exists({ slug: input.slug, ...(existingId ? { _id: { $ne: existingId } } : {}) }))
      ? fieldError("slug", "This URL name is already used by another product.", 409)
      : input.slug
    : await uniqueProductSlug(slugify(input.name), existingId);

  return {
    name: input.name,
    slug,
    sku: input.sku || null,
    shortDescription: input.shortDescription,
    description: input.description,
    price: basePrice,
    salePrice: input.hasVariants ? null : salePrice,
    effectivePrice,
    stockQuantity,
    allowBackorder: input.allowBackorder,
    stockStatus,
    category: input.category ? oid(input.category) : null,
    subcategory: input.subcategory ? oid(input.subcategory) : null,
    brand: input.brand ? oid(input.brand) : null,
    collections: collections.map((c) => c._id),
    occasions: occasions.map((o) => o._id),
    tags: [...new Set(input.tags.map((t) => t.toLowerCase()))],
    images: images as ProductFields["images"],
    hasVariants: input.hasVariants,
    variantType: input.variantType || "Size",
    variants: variants as ProductFields["variants"],
    shipping: {
      weight: toNum(input.shipping.weight),
      length: toNum(input.shipping.length),
      width: toNum(input.shipping.width),
      height: toNum(input.shipping.height),
    },
    status: input.status,
    featured: input.featured,
    newArrival: input.newArrival,
    bestSeller: input.bestSeller,
    seo: { title: input.seoTitle, description: input.seoDescription },
  };
}

export async function createProduct(input: ProductInput) {
  await connectDB();
  const data = await buildProductData(input);
  const doc = await Product.create({ ...data, publishedAt: data.status === "published" ? new Date() : null });
  return { id: String(doc._id), status: doc.status };
}

export async function updateProduct(id: string, input: ProductInput) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found.");
  const doc = await Product.findById(id);
  if (!doc) throw new ApiError(404, "Product not found.");
  const data = await buildProductData(input, id);
  if (data.status === "published" && doc.status !== "published") doc.publishedAt = new Date();
  doc.set(data);
  await doc.save();
  return { id, status: doc.status, updatedAt: doc.updatedAt.toISOString() };
}

/** Quick toggles from the product list. Publishing still checks the requirements. */
export async function quickUpdateProduct(id: string, patch: { status?: "draft" | "published"; featured?: boolean; newArrival?: boolean; bestSeller?: boolean }) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found.");
  const doc = await Product.findById(id);
  if (!doc) throw new ApiError(404, "Product not found.");
  if (patch.status === "published" && doc.status !== "published") {
    const missing: string[] = [];
    if (!doc.sku) missing.push("a SKU");
    if (!doc.category) missing.push("a category");
    if (!doc.hasVariants && doc.price <= 0) missing.push("a price");
    if (doc.hasVariants && doc.variants.some((v) => !v.sku)) missing.push("SKUs for every option");
    if (missing.length) {
      throw new ApiError(422, `Before publishing, add ${missing.join(" and ")}. Open the product to complete it.`);
    }
    doc.publishedAt = new Date();
  }
  doc.set(patch);
  await doc.save();
  return { id, status: doc.status, featured: doc.featured, newArrival: doc.newArrival };
}

/** Copy as a new draft. SKUs and published status are NOT copied. */
export async function duplicateProduct(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found.");
  const src = await Product.findById(id).lean();
  if (!src) throw new ApiError(404, "Product not found.");
  const { _id, createdAt, updatedAt, slug, sku, status, publishedAt, ...rest } = src;
  void _id;
  void createdAt;
  void updatedAt;
  void slug;
  void sku;
  void status;
  void publishedAt;
  const name = `${src.name} (Copy)`.slice(0, 150);
  const copy = await Product.create({
    ...rest,
    name,
    slug: await uniqueProductSlug(slugify(name)),
    sku: null,
    status: "draft",
    publishedAt: null,
    images: src.images.map(({ media, url, alt, isPrimary }) => ({ media, url, alt, isPrimary })),
    variants: src.variants.map(({ _id: vid, ...v }) => {
      void vid;
      return { ...v, sku: null };
    }),
  });
  return { id: String(copy._id) };
}

export async function deleteProduct(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, "Product not found.");
  const res = await Product.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw new ApiError(404, "Product not found.");
}
