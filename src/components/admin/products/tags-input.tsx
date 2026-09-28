"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Type a word and press Enter (or comma) to add it as a tag. */
export function TagsInput({ id, value, onChange, max = 20 }: { id: string; value: string[]; onChange: (tags: string[]) => void; max?: number }) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const tag = raw.trim().toLowerCase().slice(0, 40);
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
  };
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {value.map((t) => (
            <li key={t} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
              {t}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== t))}
                className="rounded-full p-0.5 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                aria-label={`Remove tag ${t}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        className="h-10"
        value={draft}
        placeholder={value.length >= max ? "Tag limit reached" : "Type a tag and press Enter"}
        disabled={value.length >= max}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
            setDraft("");
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (draft) {
            add(draft);
            setDraft("");
          }
        }}
      />
    </div>
  );
}
