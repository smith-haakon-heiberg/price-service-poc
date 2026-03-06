import type { Product } from "@/domain/types";
import PriceDisplay from "@/app/admin/_components/PriceDisplay";
import ProductFilters from "./ProductFilters";

async function fetchProducts(
  searchParams: Record<string, string | undefined>
): Promise<Product[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const params = new URLSearchParams();
  if (searchParams.categoryId) params.set("categoryId", searchParams.categoryId);
  if (searchParams.brand) params.set("brand", searchParams.brand);
  if (searchParams.search) params.set("search", searchParams.search);
  params.set("limit", "200");

  const res = await fetch(`${baseUrl}/api/products?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
  return res.json() as Promise<Product[]>;
}

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  let products: Product[] = [];
  let error: string | null = null;

  try {
    products = await fetchProducts(params);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load products";
  }

  const categories = [...new Set(products.map((p) => p.categoryId))].sort();
  const brands = [...new Set(products.map((p) => p.brand))].sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Products</h1>
        <span className="text-sm text-muted">{products.length} products</span>
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
              <th>Unit</th>
              <th>Outlet</th>
              <th>Warehouses</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-muted py-8">
                  No products found.
                </td>
              </tr>
            )}
            {products.map((product) => (
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
    </div>
  );
}
