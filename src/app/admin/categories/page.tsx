import Link from "next/link";
import type { Product, PriceRule } from "@/domain/types";
import RuleTypeBadge from "@/app/admin/_components/RuleTypeBadge";

async function fetchJson<T>(url: string): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}${url}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export default async function CategoriesPage() {
  let products: Product[] = [];
  let rules: PriceRule[] = [];
  let error: string | null = null;

  try {
    [products, rules] = await Promise.all([
      fetchJson<Product[]>("/api/products?limit=1000"),
      fetchJson<PriceRule[]>("/api/prices/rules?type=BASE_CATEGORY"),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load data";
  }

  // Extract unique categories with product counts
  const categoryProductCount = products.reduce<Record<string, number>>(
    (acc, p) => {
      acc[p.categoryId] = (acc[p.categoryId] || 0) + 1;
      return acc;
    },
    {}
  );

  const categories = Object.keys(categoryProductCount).sort();

  // Map rules to categories by inspecting conditions
  const categoryRules = new Map<string, PriceRule[]>();
  for (const rule of rules) {
    for (const cond of rule.conditions) {
      if (cond.field === "categoryId" && cond.operator === "eq") {
        const catId = String(cond.value);
        const existing = categoryRules.get(catId) ?? [];
        existing.push(rule);
        categoryRules.set(catId, existing);
      }
      if (cond.field === "categoryId" && cond.operator === "in" && Array.isArray(cond.value)) {
        for (const catId of cond.value) {
          const existing = categoryRules.get(String(catId)) ?? [];
          existing.push(rule);
          categoryRules.set(String(catId), existing);
        }
      }
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <span className="text-sm text-muted">
          {categories.length} categories, {rules.length} BASE_CATEGORY rules
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-card-bg border border-border rounded-lg overflow-auto">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th className="text-right">Products</th>
              <th>Base Markup Rule(s)</th>
              <th>Adjustment</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted py-8">
                  No categories found.
                </td>
              </tr>
            )}
            {categories.map((catId) => {
              const catRules = categoryRules.get(catId) ?? [];
              return (
                <tr key={catId}>
                  <td>
                    <Link
                      href={`/admin/products?categoryId=${encodeURIComponent(catId)}`}
                      className="font-medium text-sm"
                    >
                      {catId}
                    </Link>
                  </td>
                  <td className="text-right font-mono text-sm">
                    {categoryProductCount[catId]}
                  </td>
                  <td>
                    {catRules.length === 0 ? (
                      <span className="text-xs text-muted italic">
                        No specific rule
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {catRules.map((r) => (
                          <div key={r.id} className="flex items-center gap-2">
                            <Link
                              href={`/admin/rules/${r.id}`}
                              className="text-sm"
                            >
                              {r.name}
                            </Link>
                            <RuleTypeBadge type={r.type} />
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="text-sm">
                    {catRules.length === 0 ? (
                      <span className="text-muted">-</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {catRules.map((r) => (
                          <span key={r.id} className="font-mono text-xs">
                            {r.adjustment.type}: {r.adjustment.value}
                            {r.adjustment.type.includes("percentage") ||
                            r.adjustment.type === "margin"
                              ? "%"
                              : " ore"}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
