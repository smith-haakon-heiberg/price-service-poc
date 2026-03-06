"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { EffectivePrice, Product } from "@/domain/types";
import PriceDisplay, {
  formatOreToNOK,
} from "@/app/admin/_components/PriceDisplay";
import RuleTypeBadge from "@/app/admin/_components/RuleTypeBadge";
import type { RuleType } from "@/domain/types";

export default function ExplainClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [sku, setSku] = useState(searchParams.get("sku") ?? "");
  const [customerType, setCustomerType] = useState(
    searchParams.get("customerType") ?? "private"
  );
  const [customerId, setCustomerId] = useState(
    searchParams.get("customerId") ?? ""
  );
  const [membershipTier, setMembershipTier] = useState(
    searchParams.get("membershipTier") ?? ""
  );
  const [projectId, setProjectId] = useState(
    searchParams.get("projectId") ?? ""
  );
  const [quantity, setQuantity] = useState(
    searchParams.get("quantity") ?? "1"
  );
  const [warehouseId, setWarehouseId] = useState(
    searchParams.get("warehouseId") ?? ""
  );
  const [date, setDate] = useState(
    searchParams.get("date") ?? new Date().toISOString().split("T")[0]!
  );

  const [result, setResult] = useState<EffectivePrice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Product autocomplete
  const [products, setProducts] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [skuSearch, setSkuSearch] = useState("");

  useEffect(() => {
    if (skuSearch.length < 2) {
      setProducts([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products?search=${encodeURIComponent(skuSearch)}&limit=10`
        );
        if (res.ok) {
          const data = (await res.json()) as Product[];
          setProducts(data);
        }
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [skuSearch]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!sku) return;

      setLoading(true);
      setError(null);
      setResult(null);

      const params = new URLSearchParams();
      params.set("customerType", customerType);
      if (customerId) params.set("customerId", customerId);
      if (membershipTier) params.set("membershipTier", membershipTier);
      if (projectId) params.set("projectId", projectId);
      if (quantity && quantity !== "1") params.set("quantity", quantity);
      if (warehouseId) params.set("warehouseId", warehouseId);
      if (date) params.set("date", date);

      try {
        const res = await fetch(
          `/api/prices/explain/${encodeURIComponent(sku)}?${params.toString()}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Request failed: ${res.status}`
          );
        }
        const data = (await res.json()) as EffectivePrice;
        setResult(data);

        // Update URL for shareability
        const urlParams = new URLSearchParams();
        urlParams.set("sku", sku);
        urlParams.set("customerType", customerType);
        if (customerId) urlParams.set("customerId", customerId);
        if (membershipTier) urlParams.set("membershipTier", membershipTier);
        if (projectId) urlParams.set("projectId", projectId);
        if (quantity && quantity !== "1") urlParams.set("quantity", quantity);
        if (warehouseId) urlParams.set("warehouseId", warehouseId);
        if (date) urlParams.set("date", date);
        router.replace(`/admin/explain?${urlParams.toString()}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to calculate");
      } finally {
        setLoading(false);
      }
    },
    [
      sku,
      customerType,
      customerId,
      membershipTier,
      projectId,
      quantity,
      warehouseId,
      date,
      router,
    ]
  );

  // Auto-submit if SKU is in URL
  useEffect(() => {
    if (searchParams.get("sku")) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Price Explainer</h1>
      <p className="text-sm text-muted mb-6">
        Calculate and inspect how the final price is determined for a product.
      </p>

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-card-bg border border-border rounded-lg p-5 mb-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <label className="block text-xs font-medium text-muted mb-1">
              SKU *
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => {
                setSku(e.target.value);
                setSkuSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="e.g. SKU-001"
              className="w-full"
              required
            />
            {showSuggestions && products.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-white border border-border rounded shadow-lg max-h-48 overflow-auto">
                {products.map((p) => (
                  <button
                    type="button"
                    key={p.sku}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-border last:border-b-0"
                    onMouseDown={() => {
                      setSku(p.sku);
                      setShowSuggestions(false);
                    }}
                  >
                    <span className="font-mono font-medium">{p.sku}</span>
                    <span className="text-muted ml-2">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Customer Type *
            </label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value)}
              className="w-full"
            >
              <option value="private">Private</option>
              <option value="professional">Professional</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Customer ID
            </label>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="Optional"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Membership Tier
            </label>
            <select
              value={membershipTier}
              onChange={(e) => setMembershipTier(e.target.value)}
              className="w-full"
            >
              <option value="">None</option>
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Project ID
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Optional"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Quantity
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Warehouse ID
            </label>
            <input
              type="text"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              placeholder="Optional"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !sku}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Calculating..." : "Calculate Price"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Price Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-card-bg border border-border rounded-lg p-5">
              <div className="text-muted text-xs uppercase tracking-wide mb-1">
                Base Price (In-Price)
              </div>
              <PriceDisplay
                ore={result.basePrice}
                className="text-2xl font-bold"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
              <div className="text-blue-600 text-xs uppercase tracking-wide mb-1">
                Final Price
              </div>
              <PriceDisplay
                ore={result.finalPrice}
                className="text-2xl font-bold text-blue-700"
              />
            </div>
            {result.quantityDiscount && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                <div className="text-green-600 text-xs uppercase tracking-wide mb-1">
                  After Quantity Discount
                </div>
                <PriceDisplay
                  ore={result.quantityDiscount.discountedPrice}
                  className="text-2xl font-bold text-green-700"
                />
                <div className="text-xs text-green-600 mt-1">
                  {result.quantityDiscount.ruleName} (min:{" "}
                  {result.quantityDiscount.quantityBreak.minQuantity})
                </div>
              </div>
            )}
          </div>

          {/* Applied Rules Chain */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 mb-6">
            <h2 className="text-sm font-semibold mb-3 text-yellow-800">
              Applied Rules ({result.appliedRules?.length ?? 0})
            </h2>
            {(result.appliedRules ?? []).length === 0 ? (
              <p className="text-sm text-muted italic">No rules applied - base price used</p>
            ) : (
              <div className="space-y-2">
                {(result.appliedRules ?? []).map((r, i) => (
                  <div
                    key={r.ruleId}
                    className="flex items-center gap-3 text-sm bg-white rounded px-3 py-2 border border-yellow-100"
                  >
                    <span className="text-xs text-muted font-mono w-5">{i + 1}.</span>
                    <a href={`/admin/rules/${r.ruleId}`} className="font-medium">
                      {r.ruleName}
                    </a>
                    <RuleTypeBadge type={r.ruleType as RuleType} />
                    <span className="text-xs text-muted">pri: {r.priority}</span>
                    <span className="text-xs font-mono text-muted">
                      <PriceDisplay ore={r.priceBeforeRule ?? 0} className="inline" />
                      {" → "}
                      <PriceDisplay ore={r.calculatedPrice} className="inline font-medium" />
                    </span>
                    <span className="text-xs text-muted">
                      ({r.adjustment.type} {r.adjustment.value})
                    </span>
                    {r.override && (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                        OVERRIDE
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Candidates */}
          <div className="bg-card-bg border border-border rounded-lg p-5 mb-6">
            <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
              All Matched Rules ({result.allCandidates.length})
            </h2>
            <div className="overflow-auto">
              <table>
                <thead>
                  <tr>
                    <th>Rule Name</th>
                    <th>Type</th>
                    <th className="text-right">Priority</th>
                    <th className="text-right">Price Before</th>
                    <th className="text-right">Price After</th>
                    <th>Override</th>
                    <th>Conditions Matched</th>
                  </tr>
                </thead>
                <tbody>
                  {result.allCandidates
                    .sort((a, b) => a.priority - b.priority)
                    .map((c) => {
                      const wasApplied = (result.appliedRules ?? []).some(
                        (r) => r.ruleId === c.ruleId
                      );
                      return (
                        <tr
                          key={c.ruleId}
                          className={wasApplied ? "!bg-yellow-50" : ""}
                        >
                          <td>
                            <a
                              href={`/admin/rules/${c.ruleId}`}
                              className="text-sm font-medium"
                            >
                              {c.ruleName}
                            </a>
                            {wasApplied && (
                              <span className="ml-2 text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">
                                APPLIED
                              </span>
                            )}
                          </td>
                          <td>
                            <RuleTypeBadge type={c.ruleType as RuleType} />
                          </td>
                          <td className="text-right font-mono text-sm">
                            {c.priority}
                          </td>
                          <td className="text-right">
                            <PriceDisplay
                              ore={c.priceBeforeRule ?? 0}
                              className="font-mono text-sm text-muted"
                            />
                          </td>
                          <td className="text-right">
                            <PriceDisplay
                              ore={c.calculatedPrice}
                              className="font-mono text-sm"
                            />
                          </td>
                          <td className="text-center">
                            {c.override && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                Yes
                              </span>
                            )}
                          </td>
                          <td className="text-xs text-muted">
                            {c.conditionsMatched
                              .map(
                                (cm) =>
                                  `${cm.field} ${cm.operator} ${
                                    Array.isArray(cm.value)
                                      ? cm.value.join(",")
                                      : cm.value
                                  }`
                              )
                              .join("; ")}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Explanation Log */}
          <div className="bg-card-bg border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
              Explanation Log
            </h2>
            <div className="bg-gray-50 rounded p-3 font-mono text-xs leading-relaxed max-h-80 overflow-auto">
              {result.explanation.map((line, i) => (
                <div key={i} className="py-0.5">
                  <span className="text-muted mr-2 select-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
