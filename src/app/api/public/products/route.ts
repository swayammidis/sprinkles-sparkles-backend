import { publicOptions, publicRoute, searchParamsObject } from "@/lib/api/public-route";
import { listPublicProducts } from "@/lib/services/public-catalog";
import { publicProductQuerySchema } from "@/lib/validations/public-query";

/**
 * GET /api/public/products
 *   ?search= &category= &subcategory= &brand= &collection= &occasion=
 *   &featured=true &newArrival=true &bestSeller=true &onSale=true &inStock=true
 *   &minPrice= &maxPrice= &sort=newest|price_asc|price_desc|name_asc|name_desc|featured
 *   &page= &pageSize= (max 48)
 */
export const GET = publicRoute(async (req) => listPublicProducts(publicProductQuerySchema.parse(searchParamsObject(req))));
export const OPTIONS = publicOptions;
