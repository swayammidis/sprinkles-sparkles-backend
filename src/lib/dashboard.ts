import "server-only";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { Category } from "@/models/taxonomy";
import { AdminUser } from "@/models/AdminUser";
import { getLowStockThreshold } from "@/lib/services/settings";

/** Dashboard figures, read live from MongoDB. No placeholder numbers. */
export async function getDashboardStats() {
  await connectDB();
  const threshold = await getLowStockThreshold();
  const lowStockFilter = { stockQuantity: { $gt: 0, $lte: threshold } };
  const primary = (images: { url: string; isPrimary: boolean }[]) => (images.find((i) => i.isPrimary) ?? images[0])?.url ?? "";

  const [
    totalProducts,
    publishedProducts,
    outOfStockProducts,
    totalCategories,
    lowStockCount,
    pendingAdminRequests,
    recent,
    lowStock,
  ] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ status: "published" }),
    Product.countDocuments({ stockStatus: "out_of_stock" }),
    Category.countDocuments(),
    Product.countDocuments(lowStockFilter),
    AdminUser.countDocuments({ status: "PENDING" }),
    Product.find().select("name status images effectivePrice updatedAt").sort({ updatedAt: -1 }).limit(5).lean(),
    Product.find(lowStockFilter).select("name stockQuantity images").sort({ stockQuantity: 1 }).limit(5).lean(),
  ]);

  return {
    totalProducts,
    publishedProducts,
    draftProducts: totalProducts - publishedProducts,
    outOfStockProducts,
    totalCategories,
    lowStockCount,
    lowStockThreshold: threshold,
    pendingAdminRequests,
    recent: recent.map((p) => ({
      id: String(p._id),
      name: p.name,
      status: p.status,
      image: primary(p.images),
      price: p.effectivePrice,
      updatedAt: p.updatedAt.toISOString(),
    })),
    lowStock: lowStock.map((p) => ({ id: String(p._id), name: p.name, stockQuantity: p.stockQuantity, image: primary(p.images) })),
  };
}
