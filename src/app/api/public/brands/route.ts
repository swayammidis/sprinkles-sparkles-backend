import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { listPublicBrands } from "@/lib/services/public-catalog";

export const GET = publicRoute(async () => listPublicBrands());
export const OPTIONS = publicOptions;
