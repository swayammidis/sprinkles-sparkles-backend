import { z } from "zod";
import { adminRoute } from "@/lib/api/admin-route";
import { listMedia } from "@/lib/services/media";

const query = z.object({
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(6).max(96).catch(24).default(24),
});

export const GET = adminRoute("media:read", async (req) => {
  return listMedia(query.parse(Object.fromEntries(req.nextUrl.searchParams)));
});
