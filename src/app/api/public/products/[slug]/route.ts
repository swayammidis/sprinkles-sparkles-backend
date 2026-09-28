import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { getPublicProduct } from "@/lib/services/public-catalog";

export const GET = publicRoute<{ slug: string }>(async (_req, { slug }) => getPublicProduct(slug));
export const OPTIONS = publicOptions;
