import { Schema, type Types } from "mongoose";

/**
 * A purchasable option of a product, embedded in Product.variants.
 * The option name ("Size", "Weight", "Colour", "Pack Quantity", …) is Product.variantType,
 * and `label` is the value ("250g", "8 inch", "Pink"). Money is in paise.
 */
export interface ProductVariantFields {
  _id: Types.ObjectId;
  label: string;
  sku: string | null;
  price: number;
  salePrice: number | null;
  stockQuantity: number;
  /** grams */
  weight: number | null;
  isActive: boolean;
  /** MediaAsset id of one of the product's images. */
  image: Types.ObjectId | null;
}

export const ProductVariantSchema = new Schema<ProductVariantFields>({
  label: { type: String, required: true, trim: true, maxlength: 80 },
  sku: { type: String, default: null, trim: true, maxlength: 64 },
  price: { type: Number, required: true, min: 0, validate: Number.isInteger },
  salePrice: { type: Number, default: null, min: 0 },
  stockQuantity: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  weight: { type: Number, default: null, min: 0 },
  isActive: { type: Boolean, default: true },
  image: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null },
});
