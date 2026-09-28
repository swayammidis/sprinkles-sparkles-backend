"use client";

import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaPicker } from "@/components/admin/media/media-picker";
import type { UploadedAsset } from "@/components/admin/media/upload";

/** Single image selector backed by the media library. */
export function ImageField({
  url,
  onChange,
  folder = "catalog",
  label = "Image",
  aspect = "aspect-video",
}: {
  url: string;
  onChange: (asset: UploadedAsset | null) => void;
  folder?: "products" | "catalog" | "misc";
  label?: string;
  aspect?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {url ? (
        <div className={`group relative w-full max-w-xs overflow-hidden rounded-lg border bg-muted ${aspect}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="size-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 p-2">
            <Button type="button" size="xs" variant="secondary" onClick={() => setOpen(true)}>
              Replace
            </Button>
            <Button type="button" size="icon-xs" variant="secondary" onClick={() => onChange(null)} aria-label={`Remove ${label}`}>
              <X />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex w-full max-w-xs flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground ${aspect}`}
        >
          <ImagePlus className="size-5" />
          Choose {label.toLowerCase()}
        </button>
      )}
      <MediaPicker open={open} onOpenChange={setOpen} folder={folder} onSelect={(a) => onChange(a[0] ?? null)} />
    </div>
  );
}
