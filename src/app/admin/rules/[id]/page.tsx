import Link from "next/link";
import type { PriceRule } from "@/domain/types";
import RuleTypeBadge from "@/app/admin/_components/RuleTypeBadge";
import { formatOreToNOK } from "@/app/admin/_components/PriceDisplay";
import DeleteRuleButton from "./DeleteRuleButton";

async function fetchRule(id: string): Promise<PriceRule | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/prices/rules/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch rule: ${res.status}`);
  return res.json() as Promise<PriceRule>;
}

function formatAdjustmentDetail(adj: PriceRule["adjustment"]): string {
  switch (adj.type) {
    case "fixed":
      return `Fixed price: ${formatOreToNOK(adj.value)}`;
    case "percentage_markup":
      return `Percentage markup: +${adj.value}%`;
    case "percentage_discount":
      return `Percentage discount: -${adj.value}%`;
    case "absolute_discount":
      return `Absolute discount: -${formatOreToNOK(adj.value)}`;
    case "margin":
      return `Margin: ${adj.value}%`;
    default:
      return `${adj.type}: ${adj.value}`;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RuleDetailPage({ params }: PageProps) {
  const { id } = await params;
  let rule: PriceRule | null = null;
  let error: string | null = null;

  try {
    rule = await fetchRule(id);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load rule";
  }

  if (error) {
    return (
      <div>
        <Link href="/admin/rules" className="text-sm text-muted mb-4 inline-block">
          Back to Rules
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!rule) {
    return (
      <div>
        <Link href="/admin/rules" className="text-sm text-muted mb-4 inline-block">
          Back to Rules
        </Link>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          Rule not found.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/rules" className="text-sm text-muted mb-4 inline-block">
        Back to Rules
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">{rule.name}</h1>
          <div className="flex items-center gap-3">
            <RuleTypeBadge type={rule.type} />
            {rule.enabled ? (
              <span className="text-green-600 text-sm font-medium">Enabled</span>
            ) : (
              <span className="text-red-500 text-sm font-medium">Disabled</span>
            )}
            {rule.override && (
              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-medium">
                Override
              </span>
            )}
          </div>
        </div>
        <DeleteRuleButton ruleId={rule.id} ruleName={rule.name} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Info */}
        <div className="bg-card-bg border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
            General
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">ID</dt>
            <dd className="font-mono text-xs">{rule.id}</dd>
            <dt className="text-muted">Priority</dt>
            <dd className="font-mono">{rule.priority}</dd>
            <dt className="text-muted">Valid From</dt>
            <dd>{rule.validFrom ?? "-"}</dd>
            <dt className="text-muted">Valid To</dt>
            <dd>{rule.validTo ?? "-"}</dd>
            <dt className="text-muted">Pricelist ID</dt>
            <dd className="font-mono text-xs">{rule.pricelistId ?? "-"}</dd>
            <dt className="text-muted">Created</dt>
            <dd>{new Date(rule.createdAt).toLocaleString("nb-NO")}</dd>
            <dt className="text-muted">Updated</dt>
            <dd>{new Date(rule.updatedAt).toLocaleString("nb-NO")}</dd>
          </dl>
        </div>

        {/* Adjustment */}
        <div className="bg-card-bg border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
            Adjustment
          </h2>
          <div className="text-lg font-semibold mb-2">
            {formatAdjustmentDetail(rule.adjustment)}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Type</dt>
            <dd>{rule.adjustment.type}</dd>
            <dt className="text-muted">Value</dt>
            <dd className="font-mono">{rule.adjustment.value}</dd>
          </dl>
        </div>

        {/* Conditions */}
        <div className="bg-card-bg border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
            Conditions
          </h2>
          {rule.conditions.length === 0 ? (
            <p className="text-sm text-muted italic">No conditions</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Operator</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {rule.conditions.map((c, i) => (
                  <tr key={i}>
                    <td className="font-mono text-sm">{c.field}</td>
                    <td className="font-mono text-sm">{c.operator}</td>
                    <td className="text-sm">
                      {Array.isArray(c.value)
                        ? c.value.join(", ")
                        : String(c.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quantity Breaks */}
        {rule.quantityBreaks && rule.quantityBreaks.length > 0 && (
          <div className="bg-card-bg border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
              Quantity Breaks
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Min Qty</th>
                  <th>Max Qty</th>
                  <th>Adjustment Type</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {rule.quantityBreaks.map((qb, i) => (
                  <tr key={i}>
                    <td className="font-mono text-sm">{qb.minQuantity}</td>
                    <td className="font-mono text-sm">
                      {qb.maxQuantity ?? "no limit"}
                    </td>
                    <td className="text-sm">{qb.adjustment.type}</td>
                    <td className="font-mono text-sm">{qb.adjustment.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Metadata */}
        {rule.metadata && Object.keys(rule.metadata).length > 0 && (
          <div className="bg-card-bg border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
              Metadata
            </h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {Object.entries(rule.metadata).map(([key, val]) => (
                <div key={key} className="contents">
                  <dt className="text-muted font-mono">{key}</dt>
                  <dd>{val}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
