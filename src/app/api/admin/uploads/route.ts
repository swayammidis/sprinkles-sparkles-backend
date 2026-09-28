import { adminRoute } from "@/lib/api/admin-route";
import { ApiError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { MEDIA_FOLDERS, uploadImage, type MediaFolder } from "@/lib/services/media";

/** multipart/form-data: file=<image>, folder=products|catalog|misc */
export const POST = adminRoute("media:write", async (req, { admin }) => {
  const limit = env().UPLOAD_MAX_MB * 1024 * 1024 + 64 * 1024;
  if (Number(req.headers.get("content-length") ?? 0) > limit) {
    throw new ApiError(413, `File exceeds ${env().UPLOAD_MAX_MB} MB limit`);
  }
  const form = await req.formData().catch(() => {
    throw new ApiError(400, "Expected multipart/form-data");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Missing file");
  const folderRaw = String(form.get("folder") ?? "products");
  const folder: MediaFolder = (MEDIA_FOLDERS as readonly string[]).includes(folderRaw)
    ? (folderRaw as MediaFolder)
    : "products";

  const asset = await uploadImage(file, folder, admin.id);
  return Response.json({ asset }, { status: 201 });
});
