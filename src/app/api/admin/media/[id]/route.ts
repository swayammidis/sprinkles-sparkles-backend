import { adminRoute } from "@/lib/api/admin-route";
import { deleteMedia } from "@/lib/services/media";

/** Deletes an image, but only if nothing uses it. */
export const DELETE = adminRoute<{ id: string }>("media:delete", async (_req, { params }) => {
  await deleteMedia(params.id);
  return { ok: true };
});
