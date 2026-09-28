"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImageIcon, Loader2, Search, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch, errorMessage } from "@/lib/utils/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ACCEPTED_IMAGE_TYPES, uploadImageFile, type UploadedImage } from "@/components/admin/media/upload";

type MediaPage = { items: UploadedImage[]; page: number; totalPages: number };

/** Choose images from the media library, or upload new ones. */
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
  onSelect: (images: UploadedImage[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <PickerBody multiple={multiple} folder={folder} excludeIds={excludeIds} onSelect={onSelect} onClose={() => onOpenChange(false)} />
      )}
    </Dialog>
  );
}

function PickerBody({
  multiple,
  folder,
  excludeIds,
  onSelect,
  onClose,
}: {
  multiple: boolean;
  folder: "products" | "catalog" | "misc";
  excludeIds: string[];
  onSelect: (images: UploadedImage[]) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<MediaPage | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Map<string, UploadedImage>>(new Map());
  const fileRef = useRef<HTMLInputElement>(null);
  const loading = data === null;

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<MediaPage>(`/api/admin/media?page=${page}&pageSize=24${query ? `&q=${encodeURIComponent(query)}` : ""}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => toast.error(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [page, query, reload]);

  const toggle = (img: UploadedImage) =>
    setSelected((prev) => {
      const next = new Map(multiple ? prev : []);
      if (prev.has(img.id)) next.delete(img.id);
      else next.set(img.id, img);
      return next;
    });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const uploaded: UploadedImage[] = [];
    for (const f of Array.from(files)) {
      try {
        uploaded.push(await uploadImageFile(f, folder));
      } catch (e) {
        toast.error(`${f.name}: ${errorMessage(e)}`);
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (uploaded.length) {
      setSelected((prev) => {
        const next = new Map(multiple ? prev : []);
        for (const img of multiple ? uploaded : uploaded.slice(-1)) next.set(img.id, img);
        return next;
      });
      setPage(1);
      setReload((r) => r + 1);
    }
  };

  return (
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Choose {multiple ? "images" : "an image"}</DialogTitle>
        <DialogDescription>Pick from images you&apos;ve already uploaded, or upload new ones.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search images…" className="h-10 pl-8" aria-label="Search images" />
        </div>
        <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} multiple={multiple} className="sr-only" tabIndex={-1} onChange={(e) => onFiles(e.target.files)} />
        <Button variant="outline" className="h-10" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Upload from device
        </Button>
      </div>

      <div className="min-h-48">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : data.items.length ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6" aria-label="Images">
            {data.items.map((img) => {
              const excluded = excludeIds.includes(img.id);
              const isSel = selected.has(img.id);
              return (
                <li key={img.id}>
                  <button
                    type="button"
                    disabled={excluded}
                    onClick={() => toggle(img)}
                    aria-pressed={isSel}
                    aria-label={`${img.filename}${excluded ? " (already added)" : ""}`}
                    className={cn(
                      "relative block aspect-square w-full overflow-hidden rounded-lg border-2 border-transparent bg-muted transition focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                      isSel && "border-primary ring-2 ring-primary/30",
                      excluded && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="size-full object-cover" loading="lazy" />
                    {isSel && (
                      <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center text-center text-sm text-muted-foreground">
            <ImageIcon className="mb-2 size-6" />
            {query ? "No images match your search." : "No images yet. Upload one from your device."}
          </div>
        )}
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {page} / {data.totalPages}
          </span>
          <Button variant="ghost" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" className="h-10" onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="h-10"
          disabled={selected.size === 0}
          onClick={() => {
            onSelect([...selected.values()]);
            onClose();
          }}
        >
          {multiple && selected.size > 1 ? `Add ${selected.size} images` : "Use this image"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
