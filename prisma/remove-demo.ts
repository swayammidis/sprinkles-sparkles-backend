/**
 * Remove all demo products (isDemo = true) and their unused demo images.
 * Categories, collections and occasions are kept.
 *
 *   npm run db:remove-demo           # dry run: shows what would be deleted
 *   npm run db:remove-demo -- --yes  # actually delete
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { createScriptClient } from "./script-client";

const prisma = createScriptClient();
const confirmed = process.argv.includes("--yes");

async function main() {
  const products = await prisma.product.findMany({ where: { isDemo: true }, select: { id: true, sku: true, name: true } });
  const media = await prisma.mediaAsset.findMany({ where: { isDemo: true }, select: { id: true, key: true, provider: true } });

  console.log(`Demo products: ${products.length}`);
  products.forEach((p) => console.log(`  - ${p.sku}  ${p.name}`));
  console.log(`Demo images: ${media.length}`);

  if (!confirmed) {
    console.log("\nDry run. Re-run with --yes to delete.");
    return;
  }

  await prisma.product.deleteMany({ where: { isDemo: true } });

  // Only delete demo images that are no longer referenced anywhere.
  let removed = 0;
  for (const m of media) {
    const inUse = await prisma.productImage.count({ where: { mediaAssetId: m.id } });
    if (inUse) continue;
    await prisma.mediaAsset.delete({ where: { id: m.id } });
    if (m.provider === "local") {
      await rm(path.join(process.cwd(), "storage", "uploads", m.key), { force: true });
    }
    removed++;
  }
  console.log(`✓ Deleted ${products.length} demo products and ${removed} demo images.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
