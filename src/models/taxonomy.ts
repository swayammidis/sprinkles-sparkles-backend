import { Schema, Types, model, models, type Model } from "mongoose";

/**
 * Categories, subcategories, brands, collections and occasions share one shape.
 * `image` is the public URL and `imageMedia` references the MediaAsset (used for
 * "in use" checks in the media library). Brand → logo, Collection → banner in the UI.
 */
export interface TaxonomyFields {
  name: string;
  slug: string;
  description: string;
  image: string | null;
  imageMedia: Types.ObjectId | null;
  sortOrder: number;
  isActive: boolean;
  /** Subcategories only. */
  category?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function taxonomySchema(collection: string, withParent = false) {
  const schema = new Schema<TaxonomyFields>(
    {
      name: { type: String, required: true, trim: true, maxlength: 120 },
      slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 140 },
      description: { type: String, default: "", maxlength: 2000 },
      image: { type: String, default: null },
      imageMedia: { type: Schema.Types.ObjectId, ref: "MediaAsset", default: null, index: true },
      sortOrder: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true },
      ...(withParent ? { category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true } } : {}),
    },
    { timestamps: true, collection },
  );
  schema.index({ isActive: 1, sortOrder: 1 });
  if (withParent) schema.index({ category: 1, sortOrder: 1 });
  return schema;
}

function getModel(name: string, collection: string, withParent = false): Model<TaxonomyFields> {
  return (models[name] as Model<TaxonomyFields> | undefined) ?? model<TaxonomyFields>(name, taxonomySchema(collection, withParent));
}

export const Category = getModel("Category", "categories");
export const Subcategory = getModel("Subcategory", "subcategories", true);
export const Brand = getModel("Brand", "brands");
export const Collection = getModel("Collection", "collections");
export const Occasion = getModel("Occasion", "occasions");
