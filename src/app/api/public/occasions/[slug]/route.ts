import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { getPublicOccasion } from "@/lib/services/public-catalog";

export const GET = publicRoute<{ slug: string }>(async (_req, { slug }) => getPublicOccasion(slug));
export const OPTIONS = publicOptions;
