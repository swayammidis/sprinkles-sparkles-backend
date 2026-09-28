import { Schema, model, models, type Model, type Types } from "mongoose";

/** An uploaded image. Only metadata lives in MongoDB; the file is in object storage. */
export interface MediaAssetFields {
  provider: string;
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  uploadedBy: Types.ObjectId | null;
  createdAt: Date;
}

const mediaAssetSchema = new Schema<MediaAssetFields>(
  {
    provider: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    filename: { type: String, required: true, maxlength: 200 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "media_assets" },
);
mediaAssetSchema.index({ createdAt: -1 });
mediaAssetSchema.index({ filename: 1 });

export const MediaAsset: Model<MediaAssetFields> =
  (models.MediaAsset as Model<MediaAssetFields> | undefined) ?? model<MediaAssetFields>("MediaAsset", mediaAssetSchema);
