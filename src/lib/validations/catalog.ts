import { z } from "zod";
import { RUPEES_REGEX, rupeesToPaise } from "@/lib/money";

// Shared by admin forms (browser) and the server. Every API validates again.
// Messages are written for a non-technical store owner.

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid selection.");
const optionalRef = z.union([z.literal(""), objectId]);

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugField = z
  .string()
  .trim()
  .max(140, "Keep the URL name under 140 characters.")
  .refine((v) => v === "" || SLUG_REGEX.test(v), "Use lowercase letters, numbers and hyphens only (e.g. rainbow-sprinkles).");

const rupees = (label: string) =>
  z.string().trim().refine((v) => v === "" || RUPEES_REGEX.test(v), `Enter a valid ${label}, e.g. 180 or 180.50.`);

const decimal = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,6}(\.\d{1,2})?$/.test(v), `Enter a valid ${label}.`);

const stock = z
  .number({ error: "Enter a whole number." })
  .int("Enter a whole number.")
  .min(0, "Stock can't be negative.")
  .max(1_000_000, "That number is too large.");

const skuField = z
  .string()
  .trim()
  .max(64, "Keep the SKU under 64 characters.")
  .refine((v) => v === "" || /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(v), "Use letters, numbers, dots, dashes or underscores only.");

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

export const VARIANT_TYPES = ["Size", "Weight", "Colour", "Pack Quantity", "Flavour"] as const;

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export const productImageInput = z.object({
  media: objectId,
  /** Preview only; the server always takes the URL from the media library. */
  url: z.string().max(1000).optional(),
  alt: z.string().trim().max(200, "Keep the image description under 200 characters."),
  isPrimary: z.boolean(),
});

export const productVariantInput = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "Enter the option, e.g. 250g.").max(80),
  sku: skuField,
  price: rupees("price").refine((v) => v !== "", "Enter a price."),
  salePrice: rupees("sale price"),
  stockQuantity: stock,
  weight: decimal("weight"),
  isActive: z.boolean(),
  image: optionalRef,
});

export const productInputSchema = z
  .object({
    status: z.enum(["draft", "published"]),
    name: z.string().trim().min(1, "Please enter a product name.").max(150, "Keep the name under 150 characters."),
    sku: skuField,
    slug: slugField,
    shortDescription: z.string().trim().max(500, "Keep the short description under 500 characters."),
    description: z.string().trim().max(20000, "The description is too long."),
    price: rupees("price"),
    salePrice: rupees("sale price"),
    stockQuantity: stock,
    allowBackorder: z.boolean(),
    category: optionalRef,
    subcategory: optionalRef,
    brand: optionalRef,
    collections: z.array(objectId).max(50),
    occasions: z.array(objectId).max(50),
    tags: z.array(z.string().trim().min(1).max(40, "Keep each tag under 40 characters.")).max(20, "Use at most 20 tags."),
    images: z.array(productImageInput).max(15, "Add at most 15 images."),
    hasVariants: z.boolean(),
    variantType: z.string().trim().max(40),
    variants: z.array(productVariantInput).max(100, "Add at most 100 variants."),
    shipping: z.object({
      weight: decimal("weight"),
      length: decimal("length"),
      width: decimal("width"),
      height: decimal("height"),
    }),
    featured: z.boolean(),
    newArrival: z.boolean(),
    bestSeller: z.boolean(),
    seoTitle: z.string().trim().max(70, "Keep the SEO title under 70 characters."),
    seoDescription: z.string().trim().max(160, "Keep the SEO description under 160 characters."),
  })
  .superRefine((p, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    const publishing = p.status === "published";

    const price = p.price ? rupeesToPaise(p.price) : null;
    const sale = p.salePrice ? rupeesToPaise(p.salePrice) : null;
    if (sale !== null && price !== null && sale >= price) issue(["salePrice"], "The sale price must be lower than the regular price.");

    if (p.subcategory && !p.category) issue(["category"], "Please select a category for this subcategory.");

    if (publishing) {
      if (!p.sku) issue(["sku"], "Add a SKU before publishing.");
      if (!p.category) issue(["category"], "Please select a category before publishing.");
      if (!p.hasVariants && (price === null || price === 0)) issue(["price"], "Enter a price before publishing.");
    }

    if (p.images.filter((i) => i.isPrimary).length > 1) issue(["images"], "Only one image can be the main image.");

    if (p.hasVariants) {
      if (!p.variantType) issue(["variantType"], "Choose what the options are, e.g. Size.");
      if (p.variants.length === 0) issue(["variants"], "Add at least one option, or switch variants off.");
      const skus = new Set<string>();
      const labels = new Set<string>();
      p.variants.forEach((v, i) => {
        const vp = rupeesToPaise(v.price);
        const vs = v.salePrice ? rupeesToPaise(v.salePrice) : null;
        if (vs !== null && vp !== null && vs >= vp) issue(["variants", i, "salePrice"], "Must be lower than the price.");
        const label = v.label.toLowerCase();
        if (labels.has(label)) issue(["variants", i, "label"], "This option is listed twice.");
        labels.add(label);
        if (v.sku) {
          const k = v.sku.toLowerCase();
          if (skus.has(k) || k === p.sku.toLowerCase()) issue(["variants", i, "sku"], "Each SKU must be unique.");
          skus.add(k);
        }
        if (publishing && !v.sku) issue(["variants", i, "sku"], "Add a SKU before publishing.");
      });
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductVariantInput = z.infer<typeof productVariantInput>;

export const productQuickUpdateSchema = z
  .object({
    status: z.enum(["draft", "published"]),
    featured: z.boolean(),
    newArrival: z.boolean(),
    bestSeller: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const PRODUCT_SORTS = {
  newest: "Newest",
  oldest: "Oldest",
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  stock_asc: "Stock: low to high",
} as const;
export type ProductSort = keyof typeof PRODUCT_SORTS;

export const productListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: objectId.optional().catch(undefined),
  stock: z.enum(["in_stock", "low_stock", "out_of_stock"]).optional().catch(undefined),
  status: z.enum(["draft", "published"]).optional().catch(undefined),
  featured: z.enum(["yes", "no"]).optional().catch(undefined),
  newArrival: z.enum(["yes", "no"]).optional().catch(undefined),
  sort: z.enum(Object.keys(PRODUCT_SORTS) as [ProductSort, ...ProductSort[]]).catch("newest").default("newest"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

// ---------------------------------------------------------------------------
// Categories, subcategories, collections, occasions, brands
// ---------------------------------------------------------------------------

export const TAXONOMY_KINDS = ["categories", "subcategories", "collections", "occasions", "brands"] as const;
export type TaxonomyKind = (typeof TAXONOMY_KINDS)[number];

export const taxonomyInputSchema = z.object({
  name: z.string().trim().min(1, "Please enter a name.").max(120, "Keep the name under 120 characters."),
  slug: slugField,
  description: z.string().trim().max(2000, "The description is too long."),
  imageMedia: optionalRef,
  sortOrder: z.number({ error: "Enter a whole number." }).int("Enter a whole number.").min(0, "Use 0 or more.").max(100_000),
  isActive: z.boolean(),
  /** Subcategories only. */
  category: optionalRef,
});
export type TaxonomyInput = z.infer<typeof taxonomyInputSchema>;

export const reorderSchema = z.object({ ids: z.array(objectId).min(1).max(500) });
export const statusToggleSchema = z.object({ isActive: z.boolean() });
export const collectionProductsSchema = z.object({ productIds: z.array(objectId).min(1).max(200) });

// ---------------------------------------------------------------------------
// Store settings
// ---------------------------------------------------------------------------

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
const url = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Enter a full link starting with https://");

export const storeSettingsSchema = z.object({
  storeName: text(100).min(1, "Please enter the store name."),
  tagline: text(150),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Please enter a valid email address."),
  phone: text(30).refine((v) => v === "" || /^[+\d][\d\s-]{6,}$/.test(v), "Please enter a valid phone number."),
  whatsapp: text(30).refine((v) => v === "" || /^[+\d][\d\s-]{6,}$/.test(v), "Please enter a valid WhatsApp number."),
  address: z.object({
    line1: text(200),
    line2: text(200),
    city: text(100),
    state: text(100),
    postalCode: text(20).refine((v) => v === "" || /^[A-Za-z0-9 -]{3,10}$/.test(v), "Please enter a valid PIN code."),
    country: text(100),
  }),
  social: z.object({ instagram: url, facebook: url, youtube: url, pinterest: url }),
  lowStockThreshold: z.number({ error: "Enter a whole number." }).int("Enter a whole number.").min(0).max(1000),
});
export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;
