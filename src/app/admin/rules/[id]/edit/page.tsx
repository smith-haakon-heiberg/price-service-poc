import Link from "next/link";
import type { PriceRule } from "@/domain/types";
import RuleForm from "../../_components/RuleForm";

async function fetchRule(id: string): Promise<PriceRule | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/prices/rules/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch rule: ${res.status}`);
  return res.json() as Promise<PriceRule>;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRulePage({ params }: PageProps) {
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
        <Link href={`/admin/rules/${id}`} className="text-sm text-muted mb-4 inline-block">
          &larr; Back to Rule
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
          &larr; Back to Rules
        </Link>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          Rule not found.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href={`/admin/rules/${id}`} className="text-sm text-muted mb-4 inline-block">
        &larr; Back to Rule
      </Link>
      <h1 className="text-2xl font-bold mb-6">Edit: {rule.name}</h1>
      <RuleForm mode="edit" initialRule={rule} />
    </div>
  );
}
