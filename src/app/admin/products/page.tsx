import Link from "next/link";
import type { Product, EffectivePrice } from "@/domain/types";
import PriceDisplay from "@/app/admin/_components/PriceDisplay";
import ProductFilters from "./ProductFilters";
import { getPriceService } from "@/app/api/_lib/service-factory";

const PAGE_SIZE = 50;

async function fetchAllProducts(
  searchParams: Record<string, string | undefined>
): Promise<Product[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const params = new URLSearchParams();
  if (searchParams.categoryId) params.set("categoryId", searchParams.categoryId);
  if (searchParams.brand) params.set("brand", searchParams.brand);
  if (searchParams.search) params.set("search", searchParams.search);

  const res = await fetch(`${baseUrl}/api/products?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  return res.json() as Promise<Product[]>;
}

async function calculateGenericPrices(
  products: Product[]
): Promise<Map<string, EffectivePrice>> {
  const service = getPriceService();
  const today = new Date().toISOString().split("T")[0]!;
  const results = new Map<string, EffectivePrice>();

  await Promise.all(
    products.map(async (p) => {
      try {
        const price = await service.calculatePrice({
          sku: p.sku,
          customerType: "private",
          quantity: 1,
          date: today,
        });
        results.set(p.sku, price);
      } catch {
        // skip products that fail calculation
      }
    })
  );

  return results;
}

function buildPageHref(
  currentParams: Record<string, string | undefined>,
  page: number
): string {
  const p = new URLSearchParams();
  if (currentParams.categoryId) p.set("categoryId", currentParams.categoryId);
  if (currentParams.brand) p.set("brand", currentParams.brand);
  if (currentParams.search) p.set("search", currentParams.search);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return `/admin/products${qs ? `?${qs}` : ""}`;
}

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10));

  let allProducts: Product[] = [];
  let error: string | null = null;

  try {
    allProducts = await fetchAllProducts(params);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load products";
  }

  const totalProducts = allProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const pageProducts = allProducts.slice(offset, offset + PAGE_SIZE);

  const priceMap =
    pageProducts.length > 0
      ? await calculateGenericPrices(pageProducts)
      : new Map<string, EffectivePrice>();

  const categories = [...new Set(allProducts.map((p) => p.categoryId))].sort();
  const brands = [...new Set(allProducts.map((p) => p.brand))].sort();

  // Build page number list: always show first, last, current ±1, with ellipsis gaps
  const pageNumbers: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    const near = new Set([1, totalPages, safePage, safePage - 1, safePage + 1].filter(n => n >= 1 && n <= totalPages));
    let prev: number | null = null;
    for (const n of [...near].sort((a, b) => a - b)) {
      if (prev !== null && n - prev > 1) pageNumbers.push("…");
      pageNumbers.push(n);
      prev = n;
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <span className="text-sm text-muted">
          {totalProducts} products
          {totalPages > 1 && ` · page ${safePage} of ${totalPages}`}
        </span>
      </div>

      <ProductFilters
        categories={categories}
        brands={brands}
        currentCategory={params.categoryId}
        currentBrand={params.brand}
        currentSearch={params.search}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-card-bg border border-border rounded-lg overflow-auto">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Category</th>
              <th>Brand</th>
              <th className="text-right">Base Price</th>
              <th className="text-right">List Price</th>
              <th>Unit</th>
              <th>Outlet</th>
              <th>Warehouses</th>
            </tr>
          </thead>
          <tbody>
            {pageProducts.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-muted py-8">
                  No products found.
                </td>
              </tr>
            )}
            {pageProducts.map((product) => (
              <tr key={product.sku}>
                <td>
                  <a
                    href={`/admin/explain?sku=${encodeURIComponent(product.sku)}`}
                    className="font-mono text-sm font-medium"
                  >
                    {product.sku}
                  </a>
                </td>
                <td>{product.name}</td>
                <td className="text-sm text-muted">{product.categoryId}</td>
                <td className="text-sm">{product.brand}</td>
                <td className="text-right">
                  <PriceDisplay
                    ore={product.basePrice}
                    className="font-mono text-sm"
                  />
                </td>
                <td className="text-right">
                  {priceMap.has(product.sku) ? (
                    <PriceDisplay
                      ore={priceMap.get(product.sku)!.finalPrice}
                      className={`font-mono text-sm ${priceMap.get(product.sku)!.finalPrice !== product.basePrice ? "text-blue-600 font-semibold" : ""}`}
                    />
                  ) : (
                    <span className="text-muted text-xs">-</span>
                  )}
                </td>
                <td className="text-sm text-muted">{product.unit}</td>
                <td>
                  {product.outletFlag ? (
                    <span className="inline-block bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-xs font-medium">
                      Outlet
                    </span>
                  ) : (
                    <span className="text-muted text-xs">-</span>
                  )}
                </td>
                <td className="text-xs text-muted">
                  {product.warehouseIds.join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <Link
            href={buildPageHref(params, safePage - 1)}
            aria-disabled={safePage === 1}
            className={`px-3 py-1.5 rounded text-sm border border-border ${safePage === 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            ← Prev
          </Link>

          {pageNumbers.map((n, i) =>
            n === "…" ? (
              <span key={`ellipsis-${i}`} className="px-2 text-muted text-sm">…</span>
            ) : (
              <Link
                key={n}
                href={buildPageHref(params, n)}
                className={`w-9 h-9 flex items-center justify-center rounded text-sm border ${
                  n === safePage
                    ? "bg-blue-600 text-white border-blue-600 font-medium"
                    : "border-border hover:bg-gray-50"
                }`}
              >
                {n}
              </Link>
            )
          )}

          <Link
            href={buildPageHref(params, safePage + 1)}
            aria-disabled={safePage === totalPages}
            className={`px-3 py-1.5 rounded text-sm border border-border ${safePage === totalPages ? "pointer-events-none opacity-40" : "hover:bg-gray-50"}`}
          >
            Next →
          </Link>
        </div>
      )}
    </div>
  );
}
