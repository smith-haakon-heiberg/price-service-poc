"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RuleType,
  DEFAULT_PRIORITY,
  AdjustmentType,
  ConditionField,
  ConditionOperator,
} from "@/domain/types";
import type { RuleCondition, PriceAdjustment, QuantityBreak } from "@/domain/types";

const RULE_TYPES = Object.values(RuleType);
const ADJUSTMENT_TYPES = Object.values(AdjustmentType);
const CONDITION_FIELDS = Object.values(ConditionField);
const CONDITION_OPERATORS = Object.values(ConditionOperator);

interface ConditionRow {
  field: string;
  operator: string;
  value: string;
}

interface QuantityBreakRow {
  minQuantity: string;
  maxQuantity: string;
  adjustmentType: string;
  adjustmentValue: string;
}

export default function CreateRuleForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [type, setType] = useState<string>(RuleType.BASE_CATEGORY);
  const [priority, setPriority] = useState<number>(DEFAULT_PRIORITY.BASE_CATEGORY);
  const [enabled, setEnabled] = useState(true);
  const [override, setOverride] = useState(false);
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [pricelistId, setPricelistId] = useState("");

  const [adjustmentType, setAdjustmentType] = useState<string>(AdjustmentType.PERCENTAGE_MARKUP);
  const [adjustmentValue, setAdjustmentValue] = useState("");

  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [quantityBreaks, setQuantityBreaks] = useState<QuantityBreakRow[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTypeChange(newType: string) {
    setType(newType);
    const defaultPri = DEFAULT_PRIORITY[newType as keyof typeof DEFAULT_PRIORITY];
    if (defaultPri !== undefined) {
      setPriority(defaultPri);
    }
  }

  // --- Conditions ---
  function addCondition() {
    setConditions([...conditions, { field: "customerType", operator: "eq", value: "" }]);
  }

  function updateCondition(idx: number, patch: Partial<ConditionRow>) {
    setConditions(conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function removeCondition(idx: number) {
    setConditions(conditions.filter((_, i) => i !== idx));
  }

  // --- Quantity Breaks ---
  function addQuantityBreak() {
    setQuantityBreaks([
      ...quantityBreaks,
      { minQuantity: "", maxQuantity: "", adjustmentType: "percentage_discount", adjustmentValue: "" },
    ]);
  }

  function updateQuantityBreak(idx: number, patch: Partial<QuantityBreakRow>) {
    setQuantityBreaks(quantityBreaks.map((qb, i) => (i === idx ? { ...qb, ...patch } : qb)));
  }

  function removeQuantityBreak(idx: number) {
    setQuantityBreaks(quantityBreaks.filter((_, i) => i !== idx));
  }

  function parseConditionValue(raw: string, field: string, operator: string): RuleCondition["value"] {
    if (operator === "in") {
      return raw.split(",").map((s) => s.trim());
    }
    if (operator === "between") {
      const parts = raw.split(",").map((s) => s.trim());
      if (parts.length === 2) {
        const nums = parts.map(Number);
        if (!isNaN(nums[0]) && !isNaN(nums[1])) return nums as [number, number];
      }
      return parts as unknown as [number, number];
    }
    if (field === "quantity") return Number(raw);
    if (field === "outletFlag") return raw === "true";
    return raw;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!adjustmentValue) {
      setError("Adjustment value is required");
      return;
    }

    const adjustment: PriceAdjustment = {
      type: adjustmentType as PriceAdjustment["type"],
      value: Number(adjustmentValue),
    };

    const parsedConditions: RuleCondition[] = conditions.map((c) => ({
      field: c.field as RuleCondition["field"],
      operator: c.operator as RuleCondition["operator"],
      value: parseConditionValue(c.value, c.field, c.operator),
    }));

    const parsedBreaks: QuantityBreak[] | undefined =
      quantityBreaks.length > 0
        ? quantityBreaks.map((qb) => ({
            minQuantity: Number(qb.minQuantity),
            maxQuantity: qb.maxQuantity ? Number(qb.maxQuantity) : undefined,
            adjustment: {
              type: qb.adjustmentType as PriceAdjustment["type"],
              value: Number(qb.adjustmentValue),
            },
          }))
        : undefined;

    const body: Record<string, unknown> = {
      name: name.trim(),
      type,
      priority,
      enabled,
      override: override || undefined,
      conditions: parsedConditions,
      adjustment,
    };
    if (validFrom) body.validFrom = validFrom;
    if (validTo) body.validTo = validTo;
    if (pricelistId.trim()) body.pricelistId = pricelistId.trim();
    if (parsedBreaks) body.quantityBreaks = parsedBreaks;

    setSubmitting(true);
    try {
      const res = await fetch("/api/prices/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? `Server error: ${res.status}`);
      }

      const created = await res.json();
      router.push(`/admin/rules/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      {/* Basic Info */}
      <fieldset className="bg-card-bg border border-border rounded-lg p-5 space-y-4">
        <legend className="text-sm font-semibold text-muted uppercase tracking-wide px-1">
          Basic Info
        </legend>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">Name *</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Premium Member Plumbing Discount"
              className="w-full"
              required
            />
          </div>

          <div>
            <label htmlFor="type" className="block text-sm font-medium mb-1">Rule Type *</label>
            <select id="type" value={type} onChange={(e) => handleTypeChange(e.target.value)} className="w-full">
              {RULE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="priority" className="block text-sm font-medium mb-1">Priority *</label>
            <input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full"
              min={0}
              max={9999}
            />
            <p className="text-xs text-muted mt-1">Higher = takes precedence. Default for {type.replace(/_/g, " ")}: {DEFAULT_PRIORITY[type as keyof typeof DEFAULT_PRIORITY] ?? "?"}</p>
          </div>

          <div>
            <label htmlFor="pricelistId" className="block text-sm font-medium mb-1">Pricelist ID</label>
            <input
              id="pricelistId"
              type="text"
              value={pricelistId}
              onChange={(e) => setPricelistId(e.target.value)}
              placeholder="e.g. pl-cust-c001"
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="validFrom" className="block text-sm font-medium mb-1">Valid From</label>
            <input
              id="validFrom"
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="validTo" className="block text-sm font-medium mb-1">Valid To</label>
            <input
              id="validTo"
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <input
              id="enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="enabled" className="text-sm font-medium">Enabled</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="override"
              type="checkbox"
              checked={override}
              onChange={(e) => setOverride(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="override" className="text-sm font-medium">Override</label>
            <span className="text-xs text-muted">(replaces running price and stops the chain)</span>
          </div>
        </div>
      </fieldset>

      {/* Adjustment */}
      <fieldset className="bg-card-bg border border-border rounded-lg p-5 space-y-4">
        <legend className="text-sm font-semibold text-muted uppercase tracking-wide px-1">
          Adjustment *
        </legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="adjType" className="block text-sm font-medium mb-1">Type</label>
            <select
              id="adjType"
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value)}
              className="w-full"
            >
              {ADJUSTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="adjValue" className="block text-sm font-medium mb-1">Value</label>
            <input
              id="adjValue"
              type="number"
              step="any"
              value={adjustmentValue}
              onChange={(e) => setAdjustmentValue(e.target.value)}
              placeholder={adjustmentType === "fixed" || adjustmentType === "absolute_discount" ? "Amount in ore" : "Percentage"}
              className="w-full"
              required
            />
            <p className="text-xs text-muted mt-1">
              {adjustmentType === "fixed" && "Fixed out-price in ore (e.g. 15900 = 159,00 kr)"}
              {adjustmentType === "percentage_markup" && "Markup percentage (e.g. 40 = +40%)"}
              {adjustmentType === "percentage_discount" && "Discount percentage (e.g. 10 = -10%)"}
              {adjustmentType === "absolute_discount" && "Discount in ore (e.g. 5000 = -50,00 kr)"}
              {adjustmentType === "margin" && "Margin percentage (e.g. 30 = 30% margin)"}
            </p>
          </div>
        </div>
      </fieldset>

      {/* Conditions */}
      <fieldset className="bg-card-bg border border-border rounded-lg p-5 space-y-4">
        <legend className="text-sm font-semibold text-muted uppercase tracking-wide px-1">
          Conditions
        </legend>
        <p className="text-xs text-muted">All conditions must match (AND logic). Leave empty for a global rule.</p>

        {conditions.map((c, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              {i === 0 && <label className="block text-xs font-medium mb-1">Field</label>}
              <select
                value={c.field}
                onChange={(e) => updateCondition(i, { field: e.target.value })}
                className="w-full"
              >
                {CONDITION_FIELDS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              {i === 0 && <label className="block text-xs font-medium mb-1">Operator</label>}
              <select
                value={c.operator}
                onChange={(e) => updateCondition(i, { operator: e.target.value })}
                className="w-full"
              >
                {CONDITION_OPERATORS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              {i === 0 && <label className="block text-xs font-medium mb-1">Value</label>}
              <input
                type="text"
                value={c.value}
                onChange={(e) => updateCondition(i, { value: e.target.value })}
                placeholder={c.operator === "in" ? "val1, val2, ..." : c.operator === "between" ? "min, max" : "value"}
                className="w-full"
              />
            </div>
            <button
              type="button"
              onClick={() => removeCondition(i)}
              className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded text-sm"
              title="Remove condition"
            >
              &times;
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addCondition}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          + Add condition
        </button>
      </fieldset>

      {/* Quantity Breaks (only shown for QUANTITY_DISCOUNT type) */}
      {type === RuleType.QUANTITY_DISCOUNT && (
        <fieldset className="bg-card-bg border border-border rounded-lg p-5 space-y-4">
          <legend className="text-sm font-semibold text-muted uppercase tracking-wide px-1">
            Quantity Breaks
          </legend>

          {quantityBreaks.map((qb, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="w-24">
                {i === 0 && <label className="block text-xs font-medium mb-1">Min Qty</label>}
                <input
                  type="number"
                  value={qb.minQuantity}
                  onChange={(e) => updateQuantityBreak(i, { minQuantity: e.target.value })}
                  placeholder="10"
                  className="w-full"
                  min={1}
                />
              </div>
              <div className="w-24">
                {i === 0 && <label className="block text-xs font-medium mb-1">Max Qty</label>}
                <input
                  type="number"
                  value={qb.maxQuantity}
                  onChange={(e) => updateQuantityBreak(i, { maxQuantity: e.target.value })}
                  placeholder="optional"
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                {i === 0 && <label className="block text-xs font-medium mb-1">Adj. Type</label>}
                <select
                  value={qb.adjustmentType}
                  onChange={(e) => updateQuantityBreak(i, { adjustmentType: e.target.value })}
                  className="w-full"
                >
                  {ADJUSTMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                {i === 0 && <label className="block text-xs font-medium mb-1">Value</label>}
                <input
                  type="number"
                  step="any"
                  value={qb.adjustmentValue}
                  onChange={(e) => updateQuantityBreak(i, { adjustmentValue: e.target.value })}
                  placeholder="e.g. 5"
                  className="w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => removeQuantityBreak(i)}
                className="px-2 py-1.5 text-red-600 hover:bg-red-50 rounded text-sm"
                title="Remove break"
              >
                &times;
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addQuantityBreak}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + Add quantity break
          </button>
        </fieldset>
      )}

      {/* Submit */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Create Rule"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/rules")}
          className="px-5 py-2 border border-border rounded font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
