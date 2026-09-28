import { Eye, EyeOff } from "lucide-react";
import { StatusBadge } from "@/components/admin/shared/status-badge";

/** Status is always shown with an icon and a word, never colour alone. */
export function ProductStatusBadge({ status }: { status: "draft" | "published" }) {
  return status === "published" ? (
    <StatusBadge tone="success" dot={false}>
      <Eye className="size-3" /> Published
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" dot={false}>
      <EyeOff className="size-3" /> Draft
    </StatusBadge>
  );
}

export function StockBadge({ status, quantity, lowThreshold }: { status: string; quantity: number; lowThreshold: number }) {
  if (status === "out_of_stock") return <StatusBadge tone="danger">Out of stock</StatusBadge>;
  if (status === "on_backorder" && quantity <= 0) return <StatusBadge tone="turquoise">Backorder</StatusBadge>;
  if (quantity <= lowThreshold) return <StatusBadge tone="warning">{quantity} left</StatusBadge>;
  return <StatusBadge tone="success">{quantity} in stock</StatusBadge>;
}
