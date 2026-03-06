import Link from "next/link";
import type { PriceRule, Pricelist } from "@/domain/types";
import RuleTypeBadge from "@/app/admin/_components/RuleTypeBadge";
import ConditionsSummary from "@/app/admin/_components/ConditionsSummary";

async function fetchJson<T>(url: string): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}${url}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

function formatAdjustment(adj: PriceRule["adjustment"]): string {
  switch (adj.type) {
    case "fixed":
      return `Fixed: ${(adj.value / 100).toFixed(2)} kr`;
    case "percentage_markup":
      return `+${adj.value}% markup`;
    case "percentage_discount":
      return `-${adj.value}% discount`;
    case "absolute_discount":
      return `-${(adj.value / 100).toFixed(2)} kr`;
    case "margin":
      return `${adj.value}% margin`;
    default:
      return `${adj.type}: ${adj.value}`;
  }
}

export default async function RulesPage() {
  let rules: PriceRule[] = [];
  let pricelists: Pricelist[] = [];
  let error: string | null = null;

  try {
    [rules, pricelists] = await Promise.all([
      fetchJson<PriceRule[]>("/api/prices/rules"),
      fetchJson<Pricelist[]>("/api/prices/pricelists"),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load rules";
  }

  const pricelistMap = new Map(pricelists.map((p) => [p.id, p.name]));

  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Price Rules</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">{rules.length} rules</span>
          <Link
            href="/admin/rules/new"
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            + Create Rule
          </Link>
        </div>
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
              <th>Name</th>
              <th>Type</th>
              <th className="text-right">Priority</th>
              <th>Pricelist</th>
              <th>Enabled</th>
              <th>Conditions</th>
              <th>Adjustment</th>
            </tr>
          </thead>
          <tbody>
            {sortedRules.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted py-8">
                  No rules found.
                </td>
              </tr>
            )}
            {sortedRules.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <Link
                    href={`/admin/rules/${rule.id}`}
                    className="font-medium text-sm"
                  >
                    {rule.name}
                  </Link>
                </td>
                <td>
                  <RuleTypeBadge type={rule.type} />
                </td>
                <td className="text-right font-mono text-sm">
                  {rule.priority}
                </td>
                <td className="text-sm text-muted">
                  {rule.pricelistId
                    ? pricelistMap.get(rule.pricelistId) ?? rule.pricelistId
                    : "-"}
                </td>
                <td>
                  {rule.enabled ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Enabled" />
                  ) : (
                    <span className="inline-block w-2 h-2 rounded-full bg-red-400" title="Disabled" />
                  )}
                </td>
                <td>
                  <ConditionsSummary conditions={rule.conditions} />
                </td>
                <td className="text-sm whitespace-nowrap">
                  {formatAdjustment(rule.adjustment)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
