import { publicOptions, publicRoute, searchParamsObject } from "@/lib/api/public-route";
import { listPublicSubcategories } from "@/lib/services/public-catalog";

/** ?category=<slug> to limit to one category. */
export const GET = publicRoute(async (req) => listPublicSubcategories(searchParamsObject(req).category || undefined));
export const OPTIONS = publicOptions;
