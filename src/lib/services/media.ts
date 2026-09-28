import "server-only";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { ApiError, conflict, notFound } from "@/lib/api/errors";
import { getStorage } from "@/lib/uploads/storage";
import { generateKey } from "@/lib/uploads/keys";
import { detectImageType } from "@/lib/uploads/validate-image";

export const MEDIA_FOLDERS = ["products", "catalog", "misc"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

const mediaSelect = {
  id: true,
  url: true,
  filename: true,
  mimeType: true,
  size: true,
  createdAt: true,
  _count: { select: { productImages: true } },
} as const;

export async function uploadImage(file: File, folder: MediaFolder, uploadedBy: string) {
  const maxBytes = env().UPLOAD_MAX_MB * 1024 * 1024;
  if (file.size === 0) throw new ApiError(400, "File is empty");
  if (file.size > maxBytes) throw new ApiError(413, `File exceeds ${env().UPLOAD_MAX_MB} MB limit`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(bytes);
  if (!detected) throw new ApiError(415, "Unsupported file. Upload a JPG, PNG, WebP, AVIF or GIF image.");

  const storage = getStorage();
  const key = generateKey(folder, detected.ext);
  const stored = await storage.put({ key, body: bytes, contentType: detected.mime });

  try {
    return await prisma.mediaAsset.create({
      data: {
        provider: storage.name,
        key: stored.key,
        url: stored.url,
        filename: sanitizeFilename(file.name),
        mimeType: detected.mime,
        size: bytes.byteLength,
        uploadedBy,
      },
      select: mediaSelect,
    });
  } catch (err) {
    await storage.delete(stored.key).catch(() => {});
    throw err;
  }
}

export async function listMedia({ page, pageSize }: { page: number; pageSize: number }) {
  const [items, total] = await prisma.$transaction([
    prisma.mediaAsset.findMany({
      select: mediaSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.mediaAsset.count(),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Deletes a file only when nothing references it. */
export async function deleteMedia(id: string) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) throw notFound("Media");

  const url = asset.url;
  const [productImages, seo, categories, subcategories, brands, collections, occasions] = await Promise.all([
    prisma.productImage.count({ where: { mediaAssetId: id } }),
    prisma.product.count({ where: { seoImage: url } }),
    prisma.category.count({ where: { image: url } }),
    prisma.subcategory.count({ where: { image: url } }),
    prisma.brand.count({ where: { logo: url } }),
    prisma.collection.count({ where: { bannerImage: url } }),
    prisma.occasion.count({ where: { image: url } }),
  ]);
  const uses = productImages + seo + categories + subcategories + brands + collections + occasions;
  if (uses > 0) throw conflict(`This image is in use in ${uses} place${uses === 1 ? "" : "s"}. Remove it there first.`);

  await prisma.mediaAsset.delete({ where: { id } });
  await getStorage()
    .delete(asset.key)
    .catch((e) => console.error("[media] storage delete failed", asset.key, e));
}

function sanitizeFilename(name: string) {
  return (
    name
      .replace(/[^\w.\- ]+/g, "")
      .trim()
      .slice(0, 150) || "upload"
  );
}
