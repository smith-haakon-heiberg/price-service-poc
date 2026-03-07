"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

interface ProductFiltersProps {
  categories: string[];
  brands: string[];
  currentCategory?: string;
  currentBrand?: string;
  currentSearch?: string;
}

export default function ProductFilters({
  categories,
  brands,
  currentCategory,
  currentBrand,
  currentSearch,
}: ProductFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(currentSearch ?? "");

  const updateParams = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // reset to page 1 on filter change
      startTransition(() => {
        router.push(`/admin/products?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams("search", search || undefined);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <input
          type="search"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      <select
        value={currentCategory ?? ""}
        onChange={(e) => updateParams("categoryId", e.target.value || undefined)}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        value={currentBrand ?? ""}
        onChange={(e) => updateParams("brand", e.target.value || undefined)}
      >
        <option value="">All brands</option>
        {brands.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      {isPending && (
        <span className="text-xs text-muted">Loading...</span>
      )}
    </div>
  );
}
