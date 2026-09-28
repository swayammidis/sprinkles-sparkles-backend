import { Schema, model, models, type Model } from "mongoose";

/** Single document (`_id: "store"`) holding store information shown on the website. */
export interface StoreSettingsFields {
  _id: string;
  storeName: string;
  tagline: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: { line1: string; line2: string; city: string; state: string; postalCode: string; country: string };
  social: { instagram: string; facebook: string; youtube: string; pinterest: string };
  lowStockThreshold: number;
  updatedAt: Date;
}

const str = { type: String, default: "", trim: true, maxlength: 300 };

const storeSettingsSchema = new Schema<StoreSettingsFields>(
  {
    _id: { type: String, default: "store" },
    storeName: { ...str, default: "Sprinkle & Sparkle" },
    tagline: { ...str, default: "The Cake Decor Shop" },
    email: str,
    phone: str,
    whatsapp: str,
    address: { line1: str, line2: str, city: str, state: str, postalCode: str, country: { ...str, default: "India" } },
    social: { instagram: str, facebook: str, youtube: str, pinterest: str },
    lowStockThreshold: { type: Number, default: 5, min: 0, max: 1000 },
  },
  { timestamps: { createdAt: false, updatedAt: true }, collection: "store_settings" },
);

export const StoreSettings: Model<StoreSettingsFields> =
  (models.StoreSettings as Model<StoreSettingsFields> | undefined) ??
  model<StoreSettingsFields>("StoreSettings", storeSettingsSchema);
