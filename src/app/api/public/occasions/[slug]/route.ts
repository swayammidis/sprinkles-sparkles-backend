import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { getPublicTaxonomyBySlug } from "@/lib/services/public-catalog";

export const GET = publicRoute<{ slug: string }>(async (_req, { slug }) => getPublicTaxonomyBySlug("occasions", slug));
export const OPTIONS = publicOptions;
