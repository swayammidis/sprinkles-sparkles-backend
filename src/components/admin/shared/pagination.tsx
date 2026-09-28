import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  hrefFor,
  noun = "items",
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
  noun?: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 px-4 py-3 text-sm sm:flex-row">
      <p className="text-muted-foreground">
        Showing <span className="font-medium text-foreground tabular-nums">{from}</span>–
        <span className="font-medium text-foreground tabular-nums">{to}</span> of{" "}
        <span className="font-medium text-foreground tabular-nums">{total}</span> {total === 1 ? noun.replace(/s$/, "") : noun}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Button variant="outline" asChild className="h-10 sm:h-8">
            <Link href={hrefFor(page - 1)} scroll={false}>
              <ChevronLeft /> Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" disabled className="h-10 sm:h-8">
            <ChevronLeft /> Previous
          </Button>
        )}
        <span className="px-1 text-muted-foreground tabular-nums">
          {page} / {totalPages}
        </span>
        {page < totalPages ? (
          <Button variant="outline" asChild className="h-10 sm:h-8">
            <Link href={hrefFor(page + 1)} scroll={false}>
              Next <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" disabled className="h-10 sm:h-8">
            Next <ChevronRight />
          </Button>
        )}
      </div>
    </nav>
  );
}
