import { z } from "zod";
import { adminRoute, ApiError } from "@/lib/api/admin-route";
import { env } from "@/lib/env";
import { listMedia, uploadImage, type MediaFolder } from "@/lib/services/media";

const query = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(6).max(96).catch(30).default(30),
});

export const GET = adminRoute("media:read", async (req) => listMedia(query.parse(Object.fromEntries(req.nextUrl.searchParams))));

/** Upload one image (multipart/form-data: file, folder). */
export const POST = adminRoute("media:write", async (req, { admin }) => {
  if (Number(req.headers.get("content-length") ?? 0) > env().UPLOAD_MAX_MB * 1024 * 1024 + 100_000) {
    throw new ApiError(413, `This image is larger than ${env().UPLOAD_MAX_MB} MB. Please use a smaller image.`);
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Please choose an image to upload.");
  const folderRaw = String(form?.get("folder") ?? "products");
  const folder: MediaFolder = folderRaw === "catalog" || folderRaw === "misc" ? folderRaw : "products";
  return Response.json({ asset: await uploadImage(file, folder, admin.id) }, { status: 201 });
});
