import Link from "next/link";
import type { Product, PriceRule, Pricelist } from "@/domain/types";

async function fetchJson<T>(url: string): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseUrl}${url}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export default async function DashboardPage() {
  let products: Product[] = [];
  let rules: PriceRule[] = [];
  let pricelists: Pricelist[] = [];
  let error: string | null = null;

  try {
    [products, rules, pricelists] = await Promise.all([
      fetchJson<Product[]>("/api/products?limit=1000"),
      fetchJson<PriceRule[]>("/api/prices/rules"),
      fetchJson<Pricelist[]>("/api/prices/pricelists"),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load data";
  }

  const enabledRules = rules.filter((r) => r.enabled);
  const rulesByType = rules.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  const quickLinks = [
    {
      href: "/admin/products",
      label: "Browse Products",
      description: "View product catalog and base prices",
    },
    {
      href: "/admin/rules",
      label: "Manage Rules",
      description: "View and edit pricing rules",
    },
    {
      href: "/admin/explain",
      label: "Price Explainer",
      description: "Calculate and debug pricing for any product",
    },
    {
      href: "/admin/customers",
      label: "Customer Pricing",
      description: "Customer-specific pricelists and rules",
    },
    {
      href: "/admin/categories",
      label: "Category Rates",
      description: "Base markup rules by category",
    },
    {
      href: "/admin/warehouses",
      label: "Warehouses",
      description: "Warehouse-specific pricing",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card-bg border border-border rounded-lg p-5">
          <div className="text-muted text-xs uppercase tracking-wide mb-1">
            Products
          </div>
          <div className="text-3xl font-bold">{products.length}</div>
          <Link
            href="/admin/products"
            className="text-xs text-blue-600 mt-1 inline-block"
          >
            View all
          </Link>
        </div>
        <div className="bg-card-bg border border-border rounded-lg p-5">
          <div className="text-muted text-xs uppercase tracking-wide mb-1">
            Price Rules
          </div>
          <div className="text-3xl font-bold">{rules.length}</div>
          <span className="text-xs text-muted">
            {enabledRules.length} enabled
          </span>
          <br />
          <Link
            href="/admin/rules"
            className="text-xs text-blue-600 mt-1 inline-block"
          >
            View all
          </Link>
        </div>
        <div className="bg-card-bg border border-border rounded-lg p-5">
          <div className="text-muted text-xs uppercase tracking-wide mb-1">
            Pricelists
          </div>
          <div className="text-3xl font-bold">{pricelists.length}</div>
          <Link
            href="/admin/customers"
            className="text-xs text-blue-600 mt-1 inline-block"
          >
            View all
          </Link>
        </div>
      </div>

      {Object.keys(rulesByType).length > 0 && (
        <div className="bg-card-bg border border-border rounded-lg p-5 mb-8">
          <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
            Rules by Type
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(rulesByType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="text-sm">
                  <span className="font-medium">{type.replace(/_/g, " ")}</span>
                  <span className="text-muted ml-2">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold mb-3 text-muted uppercase tracking-wide">
        Quick Links
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-card-bg border border-border rounded-lg p-4 hover:border-blue-300 transition-colors no-underline group"
          >
            <div className="font-medium text-foreground group-hover:text-blue-600">
              {link.label}
            </div>
            <div className="text-xs text-muted mt-1">{link.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
