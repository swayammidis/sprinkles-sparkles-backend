import "server-only";
import { prisma } from "@/lib/db/prisma";
import { LOW_STOCK_THRESHOLD } from "@/lib/validations/product";

/** Real counts from the database. No placeholder statistics. */
export async function getDashboardData() {
  const lowStockWhere = { stockQuantity: { gt: 0, lte: LOW_STOCK_THRESHOLD }, stockStatus: { not: "ON_BACKORDER" as const } };

  const [total, active, outOfStock, lowStock, categories, byCategory, lowStockItems, recent, uncategorised, noImage] =
    await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { active: true } }),
      prisma.product.count({ where: { stockStatus: "OUT_OF_STOCK" } }),
      prisma.product.count({ where: lowStockWhere }),
      prisma.category.count(),
      prisma.category.findMany({
        select: { id: true, name: true, active: true, _count: { select: { products: true } } },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.product.findMany({
        where: lowStockWhere,
        select: { id: true, name: true, sku: true, stockQuantity: true },
        orderBy: { stockQuantity: "asc" },
        take: 6,
      }),
      prisma.product.findMany({
        select: { id: true, name: true, sku: true, active: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.product.count({ where: { categoryId: null } }),
      prisma.product.count({ where: { images: { none: {} } } }),
    ]);

  return {
    stats: { total, active, draft: total - active, outOfStock, lowStock, categories },
    byCategory: byCategory
      .map((c) => ({ id: c.id, name: c.name, active: c.active, count: c._count.products }))
      .sort((a, b) => b.count - a.count),
    lowStockItems,
    recent: recent.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })),
    attention: { uncategorised, noImage },
  };
}
