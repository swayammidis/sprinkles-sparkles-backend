import { Schema, model, models, type Model, type Types } from "mongoose";
import { ProductImageSchema, type ProductImageFields } from "@/models/ProductImage";
import { ProductVariantSchema, type ProductVariantFields } from "@/models/ProductVariant";

export const PRODUCT_STATUSES = ["draft", "published"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const STOCK_STATUSES = ["in_stock", "out_of_stock", "on_backorder"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

/**
 * Catalog product. Money is integer paise; weight is grams; dimensions are cm.
 * `effectivePrice`, `stockQuantity` (for variant products) and `stockStatus` are
 * derived by the server on every save and never taken from the client.
 */
export interface ProductFields {
  name: string;
  slug: string;
  /** Optional while a draft (duplicates start without one); required to publish. */
  sku: string | null;
  shortDescription: string;
  description: string;
  price: number;
  salePrice: number | null;
  /** Lowest price a customer pays (sale price or cheapest active variant). Used for sorting/filtering. */
  effectivePrice: number;
  stockQuantity: number;
  allowBackorder: boolean;
  stockStatus: StockStatus;
  category: Types.ObjectId | null;
  subcategory: Types.ObjectId | null;
  brand: Types.ObjectId | null;
  collections: Types.ObjectId[];
  occasions: Types.ObjectId[];
  tags: string[];
  images: ProductImageFields[];
  hasVariants: boolean;
  variantType: string;
  variants: ProductVariantFields[];
  shipping: { weight: number | null; length: number | null; width: number | null; height: number | null };
  status: ProductStatus;
  publishedAt: Date | null;
  featured: boolean;
  newArrival: boolean;
  bestSeller: boolean;
  seo: { title: string; description: string };
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductFields>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    sku: { type: String, default: null, trim: true, maxlength: 64 },
    shortDescription: { type: String, default: "", maxlength: 500 },
    description: { type: String, default: "", maxlength: 20000 },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    effectivePrice: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, default: 0, min: 0 },
    allowBackorder: { type: Boolean, default: false },
    stockStatus: { type: String, enum: STOCK_STATUSES, default: "out_of_stock" },
    category: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    subcategory: { type: Schema.Types.ObjectId, ref: "Subcategory", default: null },
    brand: { type: Schema.Types.ObjectId, ref: "Brand", default: null },
    collections: [{ type: Schema.Types.ObjectId, ref: "Collection" }],
    occasions: [{ type: Schema.Types.ObjectId, ref: "Occasion" }],
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 40 }],
    images: { type: [ProductImageSchema], default: [] },
    hasVariants: { type: Boolean, default: false },
    variantType: { type: String, default: "Size", trim: true, maxlength: 40 },
    variants: { type: [ProductVariantSchema], default: [] },
    shipping: {
      weight: { type: Number, default: null, min: 0 },
      length: { type: Number, default: null, min: 0 },
      width: { type: Number, default: null, min: 0 },
      height: { type: Number, default: null, min: 0 },
    },
    status: { type: String, enum: PRODUCT_STATUSES, default: "draft" },
    publishedAt: { type: Date, default: null },
    featured: { type: Boolean, default: false },
    newArrival: { type: Boolean, default: false },
    bestSeller: { type: Boolean, default: false },
    seo: {
      title: { type: String, default: "", maxlength: 70 },
      description: { type: String, default: "", maxlength: 160 },
    },
  },
  { timestamps: true, collection: "products" },
);

// Indexes follow the actual query patterns (admin list filters/sorts, public API filters).
productSchema.index({ sku: 1 }, { unique: true, partialFilterExpression: { sku: { $type: "string" } } });
productSchema.index({ "variants.sku": 1 }, { unique: true, partialFilterExpression: { "variants.sku": { $type: "string" } } });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ status: 1, effectivePrice: 1 });
productSchema.index({ status: 1, featured: 1, createdAt: -1 });
productSchema.index({ status: 1, newArrival: 1, createdAt: -1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ subcategory: 1, status: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ collections: 1 });
productSchema.index({ occasions: 1 });
productSchema.index({ updatedAt: -1 });
productSchema.index({ stockQuantity: 1 });
productSchema.index({ "images.media": 1 });

export const Product: Model<ProductFields> =
  (models.Product as Model<ProductFields> | undefined) ?? model<ProductFields>("Product", productSchema);
