import type { RuleType } from "@/domain/types";

const typeColors: Record<string, string> = {
  BASE_CATEGORY: "bg-slate-100 text-slate-700",
  BASE_PRODUCT: "bg-blue-100 text-blue-700",
  MEMBER_CAMPAIGN: "bg-purple-100 text-purple-700",
  OUTLET: "bg-orange-100 text-orange-700",
  PROFESSIONAL_GENERAL: "bg-green-100 text-green-700",
  CUSTOMER_PRICELIST: "bg-cyan-100 text-cyan-700",
  PROJECT_PRICELIST: "bg-indigo-100 text-indigo-700",
  QUANTITY_DISCOUNT: "bg-amber-100 text-amber-700",
};

interface RuleTypeBadgeProps {
  type: RuleType;
}

export default function RuleTypeBadge({ type }: RuleTypeBadgeProps) {
  const color = typeColors[type] ?? "bg-gray-100 text-gray-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${color}`}
    >
      {type.replace(/_/g, " ")}
    </span>
  );
}
