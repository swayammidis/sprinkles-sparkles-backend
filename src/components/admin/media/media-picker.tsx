"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, ApiClientError } from "@/lib/utils/api-client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACCEPTED_IMAGE_TYPES, uploadImageFile, type UploadedAsset } from "@/components/admin/media/upload";

type MediaPage = { items: UploadedAsset[]; page: number; totalPages: number };

/** Choose one or more images from the media library, or upload new ones. */
export function MediaPicker({
  open,
  onOpenChange,
  multiple = false,
  folder = "products",
  excludeIds = [],
  onSelect,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  multiple?: boolean;
  folder?: "products" | "catalog" | "misc";
  excludeIds?: string[];
  onSelect: (assets: UploadedAsset[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Body mounts only while open, so each opening starts fresh. */}
      {open && (
        <MediaPickerBody
          multiple={multiple}
          folder={folder}
          excludeIds={excludeIds}
          onSelect={onSelect}
          onClose={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function MediaPickerBody({
  multiple,
  folder,
  excludeIds,
  onSelect,
  onClose,
}: {
  multiple: boolean;
  folder: "products" | "catalog" | "misc";
  excludeIds: string[];
  onSelect: (assets: UploadedAsset[]) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<MediaPage | null>(null);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Map<string, UploadedAsset>>(new Map());
  const fileRef = useRef<HTMLInputElement>(null);
  const loading = data === null || data.page !== page;

  useEffect(() => {
    let cancelled = false;
    apiFetch<MediaPage>(`/api/admin/media?page=${page}&pageSize=24`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => toast.error(e instanceof ApiClientError ? e.message : "Could not load media"));
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  const toggle = (a: UploadedAsset) => {
    setSelected((prev) => {
      const next = new Map(multiple ? prev : []);
      if (prev.has(a.id)) next.delete(a.id);
      else next.set(a.id, a);
      return next;
    });
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const uploaded: UploadedAsset[] = [];
    for (const f of Array.from(files)) {
      try {
        uploaded.push(await uploadImageFile(f, folder));
      } catch (e) {
        toast.error(`${f.name}: ${e instanceof ApiClientError ? e.message : "upload failed"}`);
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (uploaded.length) {
      setSelected((prev) => {
        const next = new Map(multiple ? prev : []);
        for (const a of multiple ? uploaded : uploaded.slice(-1)) next.set(a.id, a);
        return next;
      });
      setPage(1);
      setReloadKey((k) => k + 1);
    }
  };

  return (
    <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Media library</DialogTitle>
          <DialogDescription>
            {multiple ? "Select one or more images" : "Select an image"} or upload new ones (JPG, PNG, WebP, AVIF, GIF).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            multiple={multiple}
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Upload
          </Button>
          {data && data.totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <span className="text-muted-foreground tabular-nums">
                {page} / {data.totalPages}
              </span>
              <Button variant="ghost" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>

        <div className="max-h-[55vh] min-h-48 overflow-y-auto">
          {loading && !data ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : data?.items.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {data.items.map((a) => {
                const excluded = excludeIds.includes(a.id);
                const isSel = selected.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={excluded}
                    onClick={() => toggle(a)}
                    title={excluded ? "Already added" : a.filename}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-lg border-2 border-transparent bg-muted transition",
                      isSel && "border-primary ring-2 ring-primary/30",
                      excluded && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.filename} className="size-full object-cover" loading="lazy" />
                    {isSel && (
                      <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-sm text-muted-foreground">
              <ImageIcon className="mb-2 size-6" /> No images yet — upload one.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={selected.size === 0}
            onClick={() => {
              onSelect([...selected.values()]);
              onClose();
            }}
          >
            {multiple && selected.size > 1 ? `Add ${selected.size} images` : "Use image"}
          </Button>
        </DialogFooter>
      </DialogContent>
  );
}
