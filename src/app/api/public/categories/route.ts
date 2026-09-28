import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { listPublicCategories } from "@/lib/services/public-catalog";

/** Active categories with their active subcategories, in display order. */
export const GET = publicRoute(async () => listPublicCategories());
export const OPTIONS = publicOptions;
