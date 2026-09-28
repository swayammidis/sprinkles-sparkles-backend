import "server-only";
import { Types, type Model } from "mongoose";
import { connectDB } from "@/lib/db";
import { ApiError } from "@/lib/api/admin-route";
import { Brand, Category, Collection, Occasion, Subcategory, type TaxonomyFields } from "@/models/taxonomy";
import { Product } from "@/models/Product";
import { slugify, type TaxonomyInput, type TaxonomyKind } from "@/lib/validations/catalog";
import { escapeRegex, resolveMedia } from "@/lib/services/media";

type Config = {
  model: () => Model<TaxonomyFields>;
  /** Field on Product that references this kind. */
  productField: "category" | "subcategory" | "brand" | "collections" | "occasions";
  singular: string;
};

export const TAXONOMY: Record<TaxonomyKind, Config> = {
  categories: { model: () => Category, productField: "category", singular: "Category" },
  subcategories: { model: () => Subcategory, productField: "subcategory", singular: "Subcategory" },
  collections: { model: () => Collection, productField: "collections", singular: "Collection" },
  occasions: { model: () => Occasion, productField: "occasions", singular: "Occasion" },
  brands: { model: () => Brand, productField: "brand", singular: "Brand" },
};

export type TaxonomyItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  imageMedia: string;
  sortOrder: number;
  isActive: boolean;
  categoryId: string;
  categoryName: string;
  productCount: number;
  subcategoryCount: number;
  updatedAt: string;
};

type Lean = TaxonomyFields & { _id: Types.ObjectId };

async function productCounts(kind: TaxonomyKind, ids: Types.ObjectId[]) {
  const field = TAXONOMY[kind].productField;
  const pipeline =
    field === "collections" || field === "occasions"
      ? [{ $match: { [field]: { $in: ids } } }, { $unwind: `$${field}` }, { $match: { [field]: { $in: ids } } }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }]
      : [{ $match: { [field]: { $in: ids } } }, { $group: { _id: `$${field}`, n: { $sum: 1 } } }];
  const rows = await Product.aggregate<{ _id: Types.ObjectId; n: number }>(pipeline);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

async function toItems(kind: TaxonomyKind, rows: Lean[]): Promise<TaxonomyItem[]> {
  const ids = rows.map((r) => r._id);
  const [counts, subCounts, parents] = await Promise.all([
    productCounts(kind, ids),
    kind === "categories"
      ? Subcategory.aggregate<{ _id: Types.ObjectId; n: number }>([{ $match: { category: { $in: ids } } }, { $group: { _id: "$category", n: { $sum: 1 } } }])
      : Promise.resolve([]),
    kind === "subcategories"
      ? Category.find({ _id: { $in: rows.map((r) => r.category) } }).select("name").lean()
      : Promise.resolve([]),
  ]);
  const subMap = new Map(subCounts.map((r) => [String(r._id), r.n]));
  const parentMap = new Map(parents.map((p) => [String(p._id), p.name]));
  return rows.map((r) => ({
    id: String(r._id),
    name: r.name,
    slug: r.slug,
    description: r.description ?? "",
    image: r.image ?? "",
    imageMedia: r.imageMedia ? String(r.imageMedia) : "",
    sortOrder: r.sortOrder ?? 0,
    isActive: r.isActive,
    categoryId: r.category ? String(r.category) : "",
    categoryName: r.category ? (parentMap.get(String(r.category)) ?? "") : "",
    productCount: counts.get(String(r._id)) ?? 0,
    subcategoryCount: subMap.get(String(r._id)) ?? 0,
    updatedAt: (r.updatedAt ?? new Date()).toISOString(),
  }));
}

export async function listTaxonomy(kind: TaxonomyKind, opts: { q?: string; categoryId?: string } = {}) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (opts.q) filter.name = { $regex: escapeRegex(opts.q), $options: "i" };
  if (kind === "subcategories" && opts.categoryId && Types.ObjectId.isValid(opts.categoryId)) filter.category = opts.categoryId;
  const rows = await TAXONOMY[kind].model().find(filter).sort({ sortOrder: 1, name: 1 }).lean<Lean[]>();
  return toItems(kind, rows);
}

/** Lightweight {id, name} lists for dropdowns. */
export async function taxonomyOptions() {
  await connectDB();
  const pick = (M: Model<TaxonomyFields>) => M.find().select("name isActive category").sort({ sortOrder: 1, name: 1 }).lean<Lean[]>();
  const [categories, subcategories, brands, collections, occasions] = await Promise.all([
    pick(Category),
    pick(Subcategory),
    pick(Brand),
    pick(Collection),
    pick(Occasion),
  ]);
  const map = (rows: Lean[]) => rows.map((r) => ({ id: String(r._id), name: r.name, isActive: r.isActive }));
  return {
    categories: map(categories),
    subcategories: subcategories.map((r) => ({ id: String(r._id), name: r.name, isActive: r.isActive, categoryId: String(r.category) })),
    brands: map(brands),
    collections: map(collections),
    occasions: map(occasions),
  };
}
export type TaxonomyOptions = Awaited<ReturnType<typeof taxonomyOptions>>;

async function uniqueSlug(kind: TaxonomyKind, base: string, excludeId?: string) {
  const M = TAXONOMY[kind].model();
  const root = base || "item";
  for (let n = 1; n < 500; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    const taken = await M.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
    if (!taken) return candidate;
  }
  throw new ApiError(409, "Please choose a different name.");
}

async function buildData(kind: TaxonomyKind, input: TaxonomyInput, excludeId?: string) {
  const singular = TAXONOMY[kind].singular.toLowerCase();
  const data: Partial<TaxonomyFields> = {
    name: input.name,
    description: input.description,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    image: null,
    imageMedia: null,
  };

  // URL name: auto-generated from the name unless the owner typed one.
  if (input.slug) {
    const clash = await TAXONOMY[kind].model().exists({ slug: input.slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
    if (clash) throw new ApiError(409, `Another ${singular} already uses this URL name.`, { slug: "This URL name is already used." });
    data.slug = input.slug;
  } else {
    data.slug = await uniqueSlug(kind, slugify(input.name), excludeId);
  }

  if (input.imageMedia) {
    const url = (await resolveMedia([input.imageMedia])).get(input.imageMedia);
    if (!url) throw new ApiError(400, "That image no longer exists. Please choose another.", { imageMedia: "Please choose another image." });
    data.image = url;
    data.imageMedia = new Types.ObjectId(input.imageMedia);
  }

  if (kind === "subcategories") {
    if (!input.category) throw new ApiError(422, "Please select a parent category.", { category: "Please select a parent category." });
    if (!(await Category.exists({ _id: input.category }))) {
      throw new ApiError(422, "That category no longer exists.", { category: "Please select a parent category." });
    }
    data.category = new Types.ObjectId(input.category);
  }
  return data;
}

async function findOrThrow(kind: TaxonomyKind, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, `${TAXONOMY[kind].singular} not found.`);
  const doc = await TAXONOMY[kind].model().findById(id).lean<Lean>();
  if (!doc) throw new ApiError(404, `${TAXONOMY[kind].singular} not found.`);
  return doc;
}

export async function getTaxonomy(kind: TaxonomyKind, id: string) {
  await connectDB();
  return (await toItems(kind, [await findOrThrow(kind, id)]))[0];
}

export async function createTaxonomy(kind: TaxonomyKind, input: TaxonomyInput) {
  await connectDB();
  const doc = await TAXONOMY[kind].model().create(await buildData(kind, input));
  return getTaxonomy(kind, String(doc._id));
}

export async function updateTaxonomy(kind: TaxonomyKind, id: string, input: TaxonomyInput) {
  await connectDB();
  await findOrThrow(kind, id);
  const data = await buildData(kind, input, id);
  await TAXONOMY[kind].model().updateOne({ _id: id }, { $set: data }, { runValidators: true });
  // Moving a subcategory to another category: keep its products consistent.
  if (kind === "subcategories" && data.category) {
    await Product.updateMany({ subcategory: id }, { $set: { category: data.category } });
  }
  return getTaxonomy(kind, id);
}

export async function setTaxonomyActive(kind: TaxonomyKind, id: string, isActive: boolean) {
  await connectDB();
  await findOrThrow(kind, id);
  await TAXONOMY[kind].model().updateOne({ _id: id }, { $set: { isActive } });
  return getTaxonomy(kind, id);
}

/**
 * Safe delete. Categories and subcategories that still have products (or
 * subcategories) are never deleted: the owner is told what to move first.
 * Collections, occasions and brands are simply removed from their products.
 */
export async function deleteTaxonomy(kind: TaxonomyKind, id: string) {
  await connectDB();
  const item = await getTaxonomy(kind, id);
  const n = item.productCount;
  const products = `${n} product${n === 1 ? "" : "s"}`;
  if (kind === "categories") {
    if (n > 0) throw new ApiError(409, `This category contains ${products}. Please move ${n === 1 ? "it" : "them"} to another category before deleting it.`);
    if (item.subcategoryCount > 0) {
      const s = item.subcategoryCount;
      throw new ApiError(409, `This category has ${s} subcategor${s === 1 ? "y" : "ies"}. Please move or delete ${s === 1 ? "it" : "them"} first.`);
    }
  }
  if (kind === "subcategories" && n > 0) {
    throw new ApiError(409, `This subcategory contains ${products}. Please move ${n === 1 ? "it" : "them"} to another subcategory before deleting it.`);
  }
  const field = TAXONOMY[kind].productField;
  if (field === "collections" || field === "occasions") await Product.updateMany({ [field]: id }, { $pull: { [field]: new Types.ObjectId(id) } });
  if (field === "brand") await Product.updateMany({ brand: id }, { $set: { brand: null } });
  await TAXONOMY[kind].model().deleteOne({ _id: id });
}

export async function reorderTaxonomy(kind: TaxonomyKind, ids: string[]) {
  await connectDB();
  if (new Set(ids).size !== ids.length) throw new ApiError(400, "Invalid order.");
  await TAXONOMY[kind].model().bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: new Types.ObjectId(id) }, update: { $set: { sortOrder: i } } } })));
}

// ---------------------------------------------------------------------------
// Collection ↔ product assignment
// ---------------------------------------------------------------------------

export async function collectionProducts(collectionId: string) {
  await connectDB();
  await findOrThrow("collections", collectionId);
  const rows = await Product.find({ collections: collectionId })
    .select("name sku status images price effectivePrice")
    .sort({ name: 1 })
    .limit(500)
    .lean();
  return rows.map((p) => ({
    id: String(p._id),
    name: p.name,
    sku: p.sku ?? "",
    status: p.status,
    image: (p.images.find((i) => i.isPrimary) ?? p.images[0])?.url ?? "",
  }));
}

export async function addProductsToCollection(collectionId: string, productIds: string[]) {
  await connectDB();
  await findOrThrow("collections", collectionId);
  const res = await Product.updateMany({ _id: { $in: productIds } }, { $addToSet: { collections: new Types.ObjectId(collectionId) } });
  return res.modifiedCount;
}

export async function removeProductFromCollection(collectionId: string, productId: string) {
  await connectDB();
  await Product.updateOne({ _id: productId }, { $pull: { collections: new Types.ObjectId(collectionId) } });
}
