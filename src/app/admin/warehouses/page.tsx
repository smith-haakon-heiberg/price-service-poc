import Link from "next/link";
import type { Product, PriceRule } from "@/domain/types";
import RuleTypeBadge from "@/app/admin/_components/RuleTypeBadge";
import ConditionsSummary from "@/app/admin/_components/ConditionsSummary";

async function fetchJson<T>(url: string): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}${url}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export default async function WarehousesPage() {
  let products: Product[] = [];
  let rules: PriceRule[] = [];
  let error: string | null = null;

  try {
    [products, rules] = await Promise.all([
      fetchJson<Product[]>("/api/products?limit=1000"),
      fetchJson<PriceRule[]>("/api/prices/rules"),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load data";
  }

  // Extract unique warehouses from products
  const warehouseProducts = new Map<string, number>();
  for (const p of products) {
    for (const wId of p.warehouseIds) {
      warehouseProducts.set(wId, (warehouseProducts.get(wId) ?? 0) + 1);
    }
  }
  const warehouses = [...warehouseProducts.keys()].sort();

  // Find rules that reference warehouses
  const warehouseRules = new Map<string, PriceRule[]>();
  const globalWarehouseRules: PriceRule[] = [];

  for (const rule of rules) {
    let matched = false;
    for (const cond of rule.conditions) {
      if (cond.field === "warehouseId") {
        matched = true;
        if (cond.operator === "eq") {
          const wId = String(cond.value);
          const existing = warehouseRules.get(wId) ?? [];
          existing.push(rule);
          warehouseRules.set(wId, existing);
        } else if (cond.operator === "in" && Array.isArray(cond.value)) {
          for (const wId of cond.value) {
            const existing = warehouseRules.get(String(wId)) ?? [];
            existing.push(rule);
            warehouseRules.set(String(wId), existing);
          }
        } else {
          globalWarehouseRules.push(rule);
        }
      }
    }
    if (!matched) continue;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Warehouses</h1>
        <span className="text-sm text-muted">
          {warehouses.length} warehouses
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="bg-card-bg border border-border rounded-lg overflow-auto mb-6">
        <table>
          <thead>
            <tr>
              <th>Warehouse ID</th>
              <th className="text-right">Products</th>
              <th>Specific Rules</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-muted py-8">
                  No warehouses found.
                </td>
              </tr>
            )}
            {warehouses.map((wId) => {
              const wRules = warehouseRules.get(wId) ?? [];
              return (
                <tr key={wId}>
                  <td>
                    <Link
                      href={`/admin/products?warehouseId=${encodeURIComponent(wId)}`}
                      className="font-mono font-medium text-sm"
                    >
                      {wId}
                    </Link>
                  </td>
                  <td className="text-right font-mono text-sm">
                    {warehouseProducts.get(wId) ?? 0}
                  </td>
                  <td>
                    {wRules.length === 0 ? (
                      <span className="text-xs text-muted italic">
                        No specific rules
                      </span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {wRules.map((r) => (
                          <div key={r.id} className="flex items-center gap-2">
                            <Link
                              href={`/admin/rules/${r.id}`}
                              className="text-sm"
                            >
                              {r.name}
                            </Link>
                            <RuleTypeBadge type={r.type} />
                            <span className="text-xs text-muted font-mono">
                              {r.adjustment.type}: {r.adjustment.value}
                            </span>
                          </div>
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

      {globalWarehouseRules.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
            Global Warehouse Rules
          </h2>
          <div className="bg-card-bg border border-border rounded-lg overflow-auto">
            <table>
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Type</th>
                  <th>Conditions</th>
                  <th>Adjustment</th>
                </tr>
              </thead>
              <tbody>
                {globalWarehouseRules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        href={`/admin/rules/${r.id}`}
                        className="font-medium text-sm"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td>
                      <RuleTypeBadge type={r.type} />
                    </td>
                    <td>
                      <ConditionsSummary conditions={r.conditions} />
                    </td>
                    <td className="text-sm font-mono">
                      {r.adjustment.type}: {r.adjustment.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
