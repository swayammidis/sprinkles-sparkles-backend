import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive/10 text-destructive",
  pink: "bg-brand-pink-soft text-brand-pink",
  turquoise: "bg-brand-turquoise-soft text-brand-turquoise",
  neutral: "bg-muted text-muted-foreground",
} as const;

export type BadgeTone = keyof typeof TONES;

export function StatusBadge({
  tone = "neutral",
  children,
  className,
  dot = true,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export function stockTone(status: string, qty: number, low = 5): { tone: BadgeTone; label: string } {
  if (status === "ON_BACKORDER") return { tone: "turquoise", label: "Backorder" };
  if (status === "OUT_OF_STOCK" || qty <= 0) return { tone: "danger", label: "Out of stock" };
  if (qty <= low) return { tone: "warning", label: "Low stock" };
  return { tone: "success", label: "In stock" };
}
