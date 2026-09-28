import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { getPublicCollection } from "@/lib/services/public-catalog";

export const GET = publicRoute<{ slug: string }>(async (_req, { slug }) => getPublicCollection(slug));
export const OPTIONS = publicOptions;
