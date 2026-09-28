import { adminRoute } from "@/lib/api/admin-route";
import { readJson } from "@/lib/api/request";
import { getStoreSettings, updateStoreSettings } from "@/lib/services/settings";
import { storeSettingsSchema } from "@/lib/validations/catalog";

/** Store information (SUPER_ADMIN only). */
export const GET = adminRoute("settings:manage", async () => ({ settings: await getStoreSettings() }));

export const PUT = adminRoute("settings:manage", async (req) => {
  const input = storeSettingsSchema.parse((await readJson(req)) ?? {});
  return { settings: await updateStoreSettings(input) };
});
