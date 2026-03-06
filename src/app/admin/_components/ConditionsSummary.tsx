import type { RuleCondition } from "@/domain/types";

interface ConditionsSummaryProps {
  conditions: RuleCondition[];
}

function formatValue(value: RuleCondition["value"]): string {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return String(value);
}

export default function ConditionsSummary({
  conditions,
}: ConditionsSummaryProps) {
  if (!conditions || conditions.length === 0) {
    return <span className="text-muted text-xs italic">No conditions</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {conditions.map((c, i) => (
        <span
          key={i}
          className="inline-block bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-xs"
          title={`${c.field} ${c.operator} ${formatValue(c.value)}`}
        >
          {c.field} {c.operator} {formatValue(c.value)}
        </span>
      ))}
    </div>
  );
}
