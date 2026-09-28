import "server-only";
import sharp from "sharp";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/api/admin-route";
import { MediaAsset } from "@/models/MediaAsset";
import { Product } from "@/models/Product";
import { Brand, Category, Collection, Occasion, Subcategory } from "@/models/taxonomy";
import { getStorage } from "@/lib/uploads/storage";
import { generateKey } from "@/lib/uploads/keys";
import { detectImageType } from "@/lib/uploads/validate-image";

export type MediaFolder = "products" | "catalog" | "misc";

export type MediaItem = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  usage?: number;
};

const MAX_DIMENSION = 2000;

function toItem(m: { _id: unknown; url: string; filename: string; mimeType: string; size: number; width?: number | null; height?: number | null; createdAt?: Date }): MediaItem {
  return {
    id: String(m._id),
    url: m.url,
    filename: m.filename,
    mimeType: m.mimeType,
    size: m.size,
    width: m.width ?? null,
    height: m.height ?? null,
    createdAt: (m.createdAt ?? new Date()).toISOString(),
  };
}

/**
 * Validates by magic bytes (the browser's file type and extension are ignored),
 * then optimises: corrects rotation, limits the size to 2000px and converts
 * JPEG/PNG to WebP. Animated GIFs and AVIF are stored as they are.
 */
async function optimise(bytes: Uint8Array) {
  const detected = detectImageType(bytes);
  if (!detected) throw new ApiError(415, "This file isn't a supported image. Please upload a JPG, PNG, WebP, AVIF or GIF.");

  if (detected.ext === "gif" || detected.ext === "avif") {
    const meta = await sharp(bytes, { animated: true }).metadata();
    return { body: bytes, mime: detected.mime, ext: detected.ext, width: meta.width ?? null, height: meta.pageHeight ?? meta.height ?? null };
  }
  try {
    const { data, info } = await sharp(bytes)
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer({ resolveWithObject: true });
    return { body: new Uint8Array(data), mime: "image/webp", ext: "webp" as const, width: info.width, height: info.height };
  } catch {
    throw new ApiError(415, "This image couldn't be read. It may be damaged; please try another file.");
  }
}

export async function uploadImage(file: File, folder: MediaFolder, uploadedBy: string): Promise<MediaItem> {
  const maxMb = env().UPLOAD_MAX_MB;
  if (file.size === 0) throw new ApiError(400, "This file is empty.");
  if (file.size > maxMb * 1024 * 1024) throw new ApiError(413, `This image is larger than ${maxMb} MB. Please use a smaller image.`);

  const img = await optimise(new Uint8Array(await file.arrayBuffer()));
  await connectDB();
  const storage = getStorage();
  const stored = await storage.put({ key: generateKey(folder, img.ext), body: img.body, contentType: img.mime });
  try {
    const doc = await MediaAsset.create({
      provider: storage.name,
      key: stored.key,
      url: stored.url,
      filename: cleanFilename(file.name, img.ext),
      mimeType: img.mime,
      size: img.body.byteLength,
      width: img.width,
      height: img.height,
      uploadedBy: Types.ObjectId.isValid(uploadedBy) ? new Types.ObjectId(uploadedBy) : null,
    });
    return toItem(doc.toObject());
  } catch (err) {
    await storage.delete(stored.key).catch(() => {});
    throw err;
  }
}

function cleanFilename(name: string, ext: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^\w\- ]+/g, "").trim().slice(0, 120) || "image";
  return `${base}.${ext}`;
}

/** How many places use each image (products, categories, brands, …). */
async function usageCounts(ids: Types.ObjectId[]) {
  const counts = new Map<string, number>();
  const add = (rows: { _id: unknown; n: number }[]) => rows.forEach((r) => counts.set(String(r._id), (counts.get(String(r._id)) ?? 0) + r.n));
  const taxonomy = [Category, Subcategory, Brand, Collection, Occasion].map((M) =>
    M.aggregate<{ _id: unknown; n: number }>([{ $match: { imageMedia: { $in: ids } } }, { $group: { _id: "$imageMedia", n: { $sum: 1 } } }]),
  );
  const products = Product.aggregate<{ _id: unknown; n: number }>([
    { $match: { "images.media": { $in: ids } } },
    { $unwind: "$images" },
    { $match: { "images.media": { $in: ids } } },
    { $group: { _id: "$images.media", n: { $sum: 1 } } },
  ]);
  (await Promise.all([products, ...taxonomy])).forEach(add);
  return counts;
}

export async function listMedia(opts: { q?: string; page: number; pageSize: number }) {
  await connectDB();
  const filter = opts.q ? { filename: { $regex: escapeRegex(opts.q), $options: "i" } } : {};
  const [rows, total] = await Promise.all([
    MediaAsset.find(filter)
      .sort({ createdAt: -1 })
      .skip((opts.page - 1) * opts.pageSize)
      .limit(opts.pageSize)
      .lean(),
    MediaAsset.countDocuments(filter),
  ]);
  const usage = await usageCounts(rows.map((r) => r._id));
  return {
    items: rows.map((r) => ({ ...toItem(r), usage: usage.get(String(r._id)) ?? 0 })),
    total,
    page: opts.page,
    pageSize: opts.pageSize,
    totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
  };
}

/** Deletes an image only if nothing uses it. */
export async function deleteMedia(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, "Image not found.");
  const asset = await MediaAsset.findById(id);
  if (!asset) throw new ApiError(404, "Image not found.");
  const uses = (await usageCounts([asset._id])).get(id) ?? 0;
  if (uses > 0) {
    throw new ApiError(409, `This image is used in ${uses} place${uses === 1 ? "" : "s"}. Remove it from those products or categories first.`);
  }
  await asset.deleteOne();
  await getStorage()
    .delete(asset.key)
    .catch(() => console.error("[media] storage delete failed"));
}

/** Resolve media ids to URLs, verifying they exist. */
export async function resolveMedia(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const rows = await MediaAsset.find({ _id: { $in: unique } }).select("url").lean();
  return new Map(rows.map((r) => [String(r._id), r.url]));
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
