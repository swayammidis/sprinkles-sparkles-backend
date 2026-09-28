import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { getPublicStoreInfo } from "@/lib/services/public-catalog";

/** Store name, contact details, address and social links (from Settings). */
export const GET = publicRoute(async () => getPublicStoreInfo());
export const OPTIONS = publicOptions;
