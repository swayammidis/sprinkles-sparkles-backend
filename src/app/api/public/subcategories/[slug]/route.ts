import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { getPublicSubcategory } from "@/lib/services/public-catalog";

export const GET = publicRoute<{ slug: string }>(async (_req, { slug }) => getPublicSubcategory(slug));
export const OPTIONS = publicOptions;
