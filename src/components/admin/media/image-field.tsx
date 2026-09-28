"use client";

import { useRef, useState } from "react";
import { ImagePlus, Library, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/utils/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MediaPicker } from "@/components/admin/media/media-picker";
import { ACCEPTED_IMAGE_TYPES, uploadImageFile, type UploadedImage } from "@/components/admin/media/upload";

/** A single image: upload from device, pick from the library, replace or remove. */
export function ImageField({
  url,
  onChange,
  label = "Image",
  folder = "catalog",
  aspect = "aspect-video",
  hint,
}: {
  url: string;
  onChange: (image: UploadedImage | null) => void;
  label?: string;
  folder?: "products" | "catalog" | "misc";
  aspect?: string;
  hint?: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadImageFile(file, folder));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="sr-only" tabIndex={-1} onChange={(e) => upload(e.target.files?.[0])} />
      {url ? (
        <div className={cn("relative w-full max-w-xs overflow-hidden rounded-lg border bg-muted", aspect)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="size-full object-cover" />
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="absolute top-2 right-2 shadow"
            onClick={() => onChange(null)}
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <X />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void upload(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex w-full max-w-xs flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-4 text-sm text-muted-foreground transition hover:border-primary/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            aspect,
          )}
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {uploading ? "Uploading…" : `Upload ${label.toLowerCase()}`}
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        {url && (
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} Replace
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
          <Library /> Choose from library
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <MediaPicker open={pickerOpen} onOpenChange={setPickerOpen} folder={folder} onSelect={(imgs) => imgs[0] && onChange(imgs[0])} />
    </div>
  );
}
