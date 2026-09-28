import { z } from "zod";
import {
  compareMoney,
  moneyField,
  nameField,
  optionalDecimalField,
  optionalId,
  optionalMoneyField,
  optionalText,
  slugField,
  stockField,
} from "@/lib/validations/common";

export const STOCK_STATUSES = ["IN_STOCK", "OUT_OF_STOCK", "ON_BACKORDER"] as const;
export const STOCK_STATUS_LABELS: Record<(typeof STOCK_STATUSES)[number], string> = {
  IN_STOCK: "In stock",
  OUT_OF_STOCK: "Out of stock",
  ON_BACKORDER: "On backorder",
};

/** Suggested variant attribute names. Any other name is allowed too. */
export const SUGGESTED_VARIANT_ATTRIBUTES = ["Size", "Weight", "Colour", "Pack Quantity", "Flavour", "Shape"];

const skuField = z
  .string()
  .trim()
  .min(1, "Required")
  .max(64, "Max 64 characters")
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Letters, numbers, dot, dash and underscore only");

export const productImageInputSchema = z.object({
  /** Existing ProductImage id when editing; absent for newly added images. */
  id: z.string().max(64).optional(),
  /** Every image must come from the media library. The server derives the URL from it. */
  mediaAssetId: z.string().min(1).max(64),
  /** Preview only — ignored by the server. */
  url: z.string().max(1000).optional(),
  altText: optionalText(200),
  isPrimary: z.boolean(),
});

export const variantAttributeInputSchema = z.object({
  name: z.string().trim().min(1, "Required").max(40),
  value: z.string().trim().min(1, "Required").max(80),
});

export const productVariantInputSchema = z.object({
  id: z.string().max(64).optional(),
  name: nameField,
  sku: skuField,
  price: moneyField,
  salePrice: optionalMoneyField,
  stockQuantity: stockField,
  weight: optionalDecimalField,
  active: z.boolean(),
  /** Media asset id of one of this product's images, or "" for none. */
  imageMediaAssetId: optionalId,
  attributes: z.array(variantAttributeInputSchema).max(6),
});

export const productInputSchema = z
  .object({
    // Basic information
    name: nameField,
    slug: slugField,
    sku: skuField,
    shortDescription: optionalText(500),
    description: optionalText(20_000),

    // Pricing
    price: moneyField,
    salePrice: optionalMoneyField,

    // Inventory
    stockQuantity: stockField,
    stockStatus: z.enum(STOCK_STATUSES),

    // Classification
    categoryId: optionalId,
    subcategoryId: optionalId,
    brandId: optionalId,
    collectionIds: z.array(z.string().min(1).max(64)).max(50),
    occasionIds: z.array(z.string().min(1).max(64)).max(50),

    // Images (array order = display order)
    images: z.array(productImageInputSchema).max(20, "Max 20 images"),

    // Variants
    hasVariants: z.boolean(),
    variants: z.array(productVariantInputSchema).max(100, "Max 100 variants"),

    // Shipping
    weight: optionalDecimalField,
    length: optionalDecimalField,
    width: optionalDecimalField,
    height: optionalDecimalField,

    // Visibility
    active: z.boolean(),
    featured: z.boolean(),
    newArrival: z.boolean(),
    bestSeller: z.boolean(),

    // SEO
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
    seoImage: z.string().trim().max(64), // media asset id or ""
  })
  .superRefine((p, ctx) => {
    if (p.salePrice && compareMoney(p.salePrice, p.price) >= 0) {
      ctx.addIssue({ code: "custom", path: ["salePrice"], message: "Sale price must be lower than the regular price" });
    }
    if (p.subcategoryId && !p.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Choose a category for this subcategory" });
    }
    if (p.hasVariants && p.variants.length === 0) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Add at least one variant or turn variants off" });
    }
    const primaryCount = p.images.filter((i) => i.isPrimary).length;
    if (primaryCount > 1) {
      ctx.addIssue({ code: "custom", path: ["images"], message: "Only one image can be primary" });
    }
    const seenMedia = new Set<string>();
    p.images.forEach((img, i) => {
      if (seenMedia.has(img.mediaAssetId)) {
        ctx.addIssue({ code: "custom", path: ["images", i], message: "This image is already added" });
      }
      seenMedia.add(img.mediaAssetId);
    });

    if (p.hasVariants) {
      const skus = new Map<string, number>();
      p.variants.forEach((v, i) => {
        const key = v.sku.toLowerCase();
        if (skus.has(key) || key === p.sku.toLowerCase()) {
          ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "SKU must be unique" });
        }
        skus.set(key, i);
        if (v.salePrice && compareMoney(v.salePrice, v.price) >= 0) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", i, "salePrice"],
            message: "Sale price must be lower than the price",
          });
        }
        const names = new Set<string>();
        v.attributes.forEach((a, j) => {
          const n = a.name.toLowerCase();
          if (names.has(n)) {
            ctx.addIssue({
              code: "custom",
              path: ["variants", i, "attributes", j, "name"],
              message: "Duplicate attribute",
            });
          }
          names.add(n);
        });
        if (v.imageMediaAssetId && !seenMedia.has(v.imageMediaAssetId)) {
          ctx.addIssue({
            code: "custom",
            path: ["variants", i, "imageMediaAssetId"],
            message: "Variant image must be one of the product images",
          });
        }
      });
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;
export type ProductImageInput = z.infer<typeof productImageInputSchema>;
export type ProductVariantInput = z.infer<typeof productVariantInputSchema>;

/** Quick toggles from the product list (publish/unpublish, feature). */
export const productPatchSchema = z
  .object({
    active: z.boolean(),
    featured: z.boolean(),
    newArrival: z.boolean(),
    bestSeller: z.boolean(),
    stockQuantity: stockField,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

// ---------------------------------------------------------------------------
// Admin product list query
// ---------------------------------------------------------------------------

export const PRODUCT_SORT_FIELDS = ["updatedAt", "createdAt", "name", "price", "stockQuantity", "sku"] as const;

export const productListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  categoryId: z.string().max(64).optional().catch(undefined),
  stock: z.enum(["in_stock", "low_stock", "out_of_stock", "backorder"]).optional().catch(undefined),
  status: z.enum(["active", "draft"]).optional().catch(undefined),
  featured: z.enum(["true", "false"]).optional().catch(undefined),
  sort: z.enum(PRODUCT_SORT_FIELDS).catch("updatedAt").default("updatedAt"),
  dir: z.enum(["asc", "desc"]).catch("desc").default("desc"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20).default(20),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const LOW_STOCK_THRESHOLD = 5;
