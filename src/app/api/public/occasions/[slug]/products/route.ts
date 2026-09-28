import { publicOptions, publicRoute, searchParamsObject } from "@/lib/api/public-route";
import { getPublicOccasion, listPublicProducts } from "@/lib/services/public-catalog";
import { publicProductQuerySchema } from "@/lib/validations/public-query";

/** Products in this occasion. Accepts the same filters/sorting/pagination as /api/public/products. */
export const GET = publicRoute<{ slug: string }>(async (req, { slug }) => {
  const occasion = await getPublicOccasion(slug);
  if (!occasion) return null;
  const query = publicProductQuerySchema.parse({ ...searchParamsObject(req), occasion: slug });
  return { occasion, products: await listPublicProducts(query) };
});
export const OPTIONS = publicOptions;
