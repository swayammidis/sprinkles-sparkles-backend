import { publicOptions, publicRoute } from "@/lib/api/public-route";
import { listPublicCollections } from "@/lib/services/public-catalog";

export const GET = publicRoute(async () => listPublicCollections());
export const OPTIONS = publicOptions;
