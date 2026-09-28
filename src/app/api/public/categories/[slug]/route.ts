import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { getPublicCategory } from "@/lib/services/public-catalog";

export const GET = publicRoute<{ slug: string }>(async (_req, { slug }) => getPublicCategory(slug));
export const OPTIONS = publicOptions;
