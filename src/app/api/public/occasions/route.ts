import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { listPublicOccasions } from "@/lib/services/public-catalog";

export const GET = publicRoute(async () => listPublicOccasions());
export const OPTIONS = publicOptions;
