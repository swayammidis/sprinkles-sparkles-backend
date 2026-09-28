import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { getPublicProductBySlug } from "@/lib/services/public-catalog";

export const GET = publicRoute<{ slug: string }>(async (_req, { slug }) => getPublicProductBySlug(slug));
export const OPTIONS = publicOptions;
