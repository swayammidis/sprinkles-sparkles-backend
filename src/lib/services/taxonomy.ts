import "server-only";
import { prisma } from "@/lib/db/prisma";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import type { TaxonomyInput, TaxonomyKind } from "@/lib/validations/taxonomy";

/**
 * One service for the five catalog taxonomies. Each kind differs only in its
 * image column, whether it is ordered, and how products link to it.
 */
type Row = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  active: boolean;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
  categoryId?: string;
  image?: string | null;
  logo?: string | null;
  bannerImage?: string | null;
  _count?: Record<string, number>;
  category?: { id: string; name: string };
};

// Minimal structural view of a Prisma delegate, so the five models share code.
type Delegate = {
  findMany(args: object): Promise<Row[]>;
  findUnique(args: object): Promise<Row | null>;
  create(args: object): Promise<Row>;
  update(args: object): Promise<Row>;
  delete(args: object): Promise<Row>;
  aggregate(args: object): Promise<{ _max: { sortOrder: number | null } }>;
};

type KindConfig = {
  delegate: () => Delegate;
  imageField: "image" | "logo" | "bannerImage";
  ordered: boolean;
  label: string;
  /** Relation counted for "in use" checks and list badges. */
  countField: "products" | "subcategories";
  extraCounts?: Record<string, true>;
};

const d = (x: unknown) => x as Delegate;

export const TAXONOMY: Record<TaxonomyKind, KindConfig> = {
  categories: {
    delegate: () => d(prisma.category),
    imageField: "image",
    ordered: true,
    label: "Category",
    countField: "products",
    extraCounts: { subcategories: true },
  },
  subcategories: {
    delegate: () => d(prisma.subcategory),
    imageField: "image",
    ordered: true,
    label: "Subcategory",
    countField: "products",
  },
  brands: { delegate: () => d(prisma.brand), imageField: "logo", ordered: false, label: "Brand", countField: "products" },
  collections: {
    delegate: () => d(prisma.collection),
    imageField: "bannerImage",
    ordered: true,
    label: "Collection",
    countField: "products",
  },
  occasions: {
    delegate: () => d(prisma.occasion),
    imageField: "image",
    ordered: true,
    label: "Occasion",
    countField: "products",
  },
};

export type TaxonomyItem = {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  active: boolean;
  sortOrder: number;
  categoryId: string;
  categoryName: string;
  productCount: number;
  subcategoryCount: number;
  updatedAt: string;
};

function toItem(kind: TaxonomyKind, r: Row): TaxonomyItem {
  const cfg = TAXONOMY[kind];
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? "",
    image: (r[cfg.imageField] as string | null | undefined) ?? "",
    active: r.active,
    sortOrder: r.sortOrder ?? 0,
    categoryId: r.categoryId ?? "",
    categoryName: r.category?.name ?? "",
    productCount: r._count?.products ?? 0,
    subcategoryCount: r._count?.subcategories ?? 0,
    updatedAt: r.updatedAt.toISOString(),
  };
}

function includeFor(kind: TaxonomyKind) {
  const cfg = TAXONOMY[kind];
  return {
    _count: { select: { products: true, ...(cfg.extraCounts ?? {}) } },
    ...(kind === "subcategories" ? { category: { select: { id: true, name: true } } } : {}),
  };
}

export async function listTaxonomy(kind: TaxonomyKind, opts: { categoryId?: string } = {}) {
  const cfg = TAXONOMY[kind];
  const rows = await cfg.delegate().findMany({
    where: kind === "subcategories" && opts.categoryId ? { categoryId: opts.categoryId } : {},
    include: includeFor(kind),
    orderBy: cfg.ordered
      ? kind === "subcategories"
        ? [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
        : [{ sortOrder: "asc" }, { name: "asc" }]
      : [{ name: "asc" }],
  });
  return rows.map((r) => toItem(kind, r));
}

export async function getTaxonomy(kind: TaxonomyKind, id: string) {
  const row = await TAXONOMY[kind].delegate().findUnique({ where: { id }, include: includeFor(kind) });
  if (!row) throw notFound(TAXONOMY[kind].label);
  return toItem(kind, row);
}

async function dataFor(kind: TaxonomyKind, input: TaxonomyInput) {
  const cfg = TAXONOMY[kind];
  const data: Record<string, unknown> = {
    name: input.name,
    slug: input.slug,
    description: input.description.trim() || null,
    [cfg.imageField]: input.image.trim() || null,
    active: input.active,
  };
  if (kind === "subcategories") {
    if (!input.categoryId) throw badRequest("Validation failed", { fieldErrors: { categoryId: ["Choose a category"] } });
    const parent = await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } });
    if (!parent) throw badRequest("Validation failed", { fieldErrors: { categoryId: ["Category not found"] } });
    data.categoryId = input.categoryId;
  }
  return data;
}

export async function createTaxonomy(kind: TaxonomyKind, input: TaxonomyInput) {
  const cfg = TAXONOMY[kind];
  const data = await dataFor(kind, input);
  if (cfg.ordered) {
    const agg = await cfg.delegate().aggregate({
      _max: { sortOrder: true },
      ...(kind === "subcategories" ? { where: { categoryId: input.categoryId } } : {}),
    });
    data.sortOrder = (agg._max.sortOrder ?? -1) + 1;
  }
  const row = await cfg.delegate().create({ data, include: includeFor(kind) });
  return toItem(kind, row);
}

export async function updateTaxonomy(kind: TaxonomyKind, id: string, input: TaxonomyInput) {
  const row = await TAXONOMY[kind].delegate().update({
    where: { id },
    data: await dataFor(kind, input),
    include: includeFor(kind),
  });
  return toItem(kind, row);
}

export async function setTaxonomyActive(kind: TaxonomyKind, id: string, active: boolean) {
  const row = await TAXONOMY[kind].delegate().update({ where: { id }, data: { active }, include: includeFor(kind) });
  return toItem(kind, row);
}

export async function deleteTaxonomy(kind: TaxonomyKind, id: string) {
  const cfg = TAXONOMY[kind];
  const item = await getTaxonomy(kind, id);
  if (item.subcategoryCount > 0) {
    throw conflict(`This category has ${item.subcategoryCount} subcategor${item.subcategoryCount === 1 ? "y" : "ies"}. Move or delete them first.`);
  }
  if (item.productCount > 0 && (kind === "categories" || kind === "subcategories")) {
    throw conflict(
      `${item.productCount} product${item.productCount === 1 ? " is" : "s are"} assigned to this ${cfg.label.toLowerCase()}. Reassign ${item.productCount === 1 ? "it" : "them"} first, or deactivate instead.`,
    );
  }
  // Brands / collections / occasions: products are unlinked automatically (SET NULL / cascade on join rows).
  await cfg.delegate().delete({ where: { id } });
}

/** Persist a new order. `ids` is the complete ordered list for the (sub)set being reordered. */
export async function reorderTaxonomy(kind: TaxonomyKind, ids: string[]) {
  const cfg = TAXONOMY[kind];
  if (!cfg.ordered) throw badRequest(`${cfg.label} ordering is not supported`);
  if (new Set(ids).size !== ids.length) throw badRequest("Duplicate ids");
  await prisma.$transaction(ids.map((id, index) => cfg.delegate().update({ where: { id }, data: { sortOrder: index } }) as never));
}
