import Link from "next/link";
import type { Pricelist, PriceRule } from "@/domain/types";

async function fetchJson<T>(url: string): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}${url}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export default async function CustomersPage() {
  let pricelists: Pricelist[] = [];
  let rules: PriceRule[] = [];
  let error: string | null = null;

  try {
    [pricelists, rules] = await Promise.all([
      fetchJson<Pricelist[]>("/api/prices/pricelists"),
      fetchJson<PriceRule[]>("/api/prices/rules"),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load data";
  }

  // Count rules per pricelist
  const rulesPerPricelist = rules.reduce<Record<string, number>>((acc, r) => {
    if (r.pricelistId) {
      acc[r.pricelistId] = (acc[r.pricelistId] || 0) + 1;
    }
    return acc;
  }, {});

  // Group pricelists by type
  const customerPricelists = pricelists.filter((p) => p.type === "customer");
  const projectPricelists = pricelists.filter((p) => p.type === "project");
  const memberPricelists = pricelists.filter((p) => p.type === "member");
  const otherPricelists = pricelists.filter(
    (p) => !["customer", "project", "member"].includes(p.type)
  );

  const renderTable = (items: Pricelist[], title: string) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
          {title} ({items.length})
        </h2>
        <div className="bg-card-bg border border-border rounded-lg overflow-auto">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Customer / Project ID</th>
                <th>Description</th>
                <th className="text-right">Rules</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map((pl) => (
                <tr key={pl.id}>
                  <td>
                    <Link
                      href={`/admin/rules?pricelistId=${pl.id}`}
                      className="font-medium text-sm"
                    >
                      {pl.name}
                    </Link>
                  </td>
                  <td>
                    <span className="inline-block bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs">
                      {pl.type}
                    </span>
                  </td>
                  <td className="font-mono text-sm text-muted">
                    {pl.customerId || pl.projectId || "-"}
                  </td>
                  <td className="text-sm text-muted">
                    {pl.description || "-"}
                  </td>
                  <td className="text-right font-mono text-sm">
                    {rulesPerPricelist[pl.id] ?? 0}
                  </td>
                  <td className="text-sm text-muted">
                    {new Date(pl.createdAt).toLocaleDateString("nb-NO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Customer Pricing</h1>
        <span className="text-sm text-muted">
          {pricelists.length} pricelists total
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {renderTable(customerPricelists, "Customer Pricelists")}
      {renderTable(projectPricelists, "Project Pricelists")}
      {renderTable(memberPricelists, "Member Pricelists")}
      {renderTable(otherPricelists, "Other Pricelists")}

      {pricelists.length === 0 && !error && (
        <div className="text-center text-muted py-12">
          No pricelists found.
        </div>
      )}
    </div>
  );
}
