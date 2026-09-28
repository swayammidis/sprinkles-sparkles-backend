import { publicOptions, publicRoute, searchParamsObject } from "@/lib/api/public-route";
import { getPublicCollection, listPublicProducts } from "@/lib/services/public-catalog";
import { publicProductQuerySchema } from "@/lib/validations/public-query";

/** Products in this collection. Accepts the same filters/sorting/pagination as /api/public/products. */
export const GET = publicRoute<{ slug: string }>(async (req, { slug }) => {
  const collection = await getPublicCollection(slug);
  if (!collection) return null;
  const query = publicProductQuerySchema.parse({ ...searchParamsObject(req), collection: slug });
  return { collection, products: await listPublicProducts(query) };
});
export const OPTIONS = publicOptions;
