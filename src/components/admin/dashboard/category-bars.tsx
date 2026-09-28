/**
 * Products per category — a single-series horizontal bar list.
 * Sorted by magnitude; value labels in text ink; each row is a hover target
 * (native tooltip) with the exact count. Bar colour: --chart-1 (validated for
 * light and dark surfaces).
 */
export function CategoryBars({ data }: { data: { id: string; name: string; count: number; active: boolean }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-2.5" aria-label="Products per category">
      {data.map((d) => (
        <li
          key={d.id}
          title={`${d.name}: ${d.count} product${d.count === 1 ? "" : "s"}${d.active ? "" : " (category hidden)"}`}
          className="group grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 rounded-md px-1 py-0.5 hover:bg-muted/60"
        >
          <span className="truncate text-sm text-muted-foreground">
            {d.name}
            {!d.active && <span className="ml-1 text-xs">(hidden)</span>}
          </span>
          <span className="relative h-2.5 rounded-sm bg-muted" aria-hidden>
            {d.count > 0 && (
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] bg-chart-1"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            )}
          </span>
          <span className="text-right text-sm font-medium tabular-nums">{d.count}</span>
        </li>
      ))}
    </ul>
  );
}
