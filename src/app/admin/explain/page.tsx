import { Suspense } from "react";
import ExplainClient from "./ExplainClient";

export default function ExplainPage() {
  return (
    <Suspense
      fallback={
        <div>
          <h1 className="text-2xl font-bold mb-4">Price Explainer</h1>
          <p className="text-sm text-muted">Loading...</p>
        </div>
      }
    >
      <ExplainClient />
    </Suspense>
  );
}
