import "server-only";
import { connectDB } from "@/lib/db";
import { StoreSettings, type StoreSettingsFields } from "@/models/StoreSettings";
import type { StoreSettingsInput } from "@/lib/validations/catalog";

const ID = "store";

function toInput(s: StoreSettingsFields): StoreSettingsInput {
  return {
    storeName: s.storeName,
    tagline: s.tagline,
    email: s.email,
    phone: s.phone,
    whatsapp: s.whatsapp,
    address: { line1: s.address.line1, line2: s.address.line2, city: s.address.city, state: s.address.state, postalCode: s.address.postalCode, country: s.address.country },
    social: { instagram: s.social.instagram, facebook: s.social.facebook, youtube: s.social.youtube, pinterest: s.social.pinterest },
    lowStockThreshold: s.lowStockThreshold,
  };
}

/** Returns the settings, creating the defaults on first use. */
export async function getStoreSettings(): Promise<StoreSettingsInput> {
  await connectDB();
  const doc =
    (await StoreSettings.findById(ID).lean<StoreSettingsFields>()) ??
    (await StoreSettings.findOneAndUpdate({ _id: ID }, { $setOnInsert: { _id: ID } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean<StoreSettingsFields>())!;
  return toInput(doc);
}

export async function updateStoreSettings(input: StoreSettingsInput) {
  await connectDB();
  const doc = await StoreSettings.findOneAndUpdate({ _id: ID }, { $set: input }, { upsert: true, new: true, runValidators: true }).lean<StoreSettingsFields>();
  return toInput(doc!);
}

export async function getLowStockThreshold() {
  await connectDB();
  const doc = await StoreSettings.findById(ID).select("lowStockThreshold").lean<{ lowStockThreshold?: number }>();
  return doc?.lowStockThreshold ?? 5;
}
