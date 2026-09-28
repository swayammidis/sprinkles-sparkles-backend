import { Schema, type Types } from "mongoose";

/**
 * A product image, embedded in Product.images (array order = display order).
 * Only a reference is stored here; the file itself lives in object storage (MediaAsset).
 */
export interface ProductImageFields {
  _id: Types.ObjectId;
  media: Types.ObjectId;
  url: string;
  alt: string;
  isPrimary: boolean;
}

export const ProductImageSchema = new Schema<ProductImageFields>({
  media: { type: Schema.Types.ObjectId, ref: "MediaAsset", required: true },
  url: { type: String, required: true },
  alt: { type: String, default: "", maxlength: 200 },
  isPrimary: { type: Boolean, default: false },
});
