"use client";

import { apiFetch } from "@/lib/utils/api-client";

export type UploadedImage = {
  id: string;
  url: string;
  filename: string;
  size: number;
  width: number | null;
  height: number | null;
  usage?: number;
  createdAt?: string;
};

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/avif,image/gif";

/** Upload one image to the configured storage through the admin API. */
export async function uploadImageFile(file: File, folder: "products" | "catalog" | "misc" = "products") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const { asset } = await apiFetch<{ asset: UploadedImage }>("/api/admin/media", { method: "POST", formData: fd });
  return asset;
}
