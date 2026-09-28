import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-pink to-brand-turquoise text-white shadow-sm">
        <Sparkles className="size-4" />
      </span>
      {!compact && (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Sprinkle &amp; Sparkle</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Admin</span>
        </span>
      )}
    </div>
  );
}
