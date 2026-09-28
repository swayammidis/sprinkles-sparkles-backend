import { publicOptions, publicRoute, searchParamsObject } from "@/lib/api/public-route";
import { getPublicCategory, listPublicProducts } from "@/lib/services/public-catalog";
import { publicProductQuerySchema } from "@/lib/validations/public-query";

/** Products in this category. Accepts the same filters/sorting/pagination as /api/public/products. */
export const GET = publicRoute<{ slug: string }>(async (req, { slug }) => {
  const category = await getPublicCategory(slug);
  if (!category) return null;
  const query = publicProductQuerySchema.parse({ ...searchParamsObject(req), category: slug });
  return { category, products: await listPublicProducts(query) };
});
export const OPTIONS = publicOptions;
