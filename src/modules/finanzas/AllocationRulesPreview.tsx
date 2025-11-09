import { useEffect, useState } from "react";
import finanzasClient, { AllocationRule } from "@/api/finanzasClient";

export default function AllocationRulesPreview() {
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await finanzasClient.getAllocationRules();
        if (!cancelled) setRules(data);
      } catch (e: any) {
        console.error(e);
        if (!cancelled)
          setError(e?.message || "Failed loading allocation rules");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading allocation rules...
      </div>
    );
  if (error)
    return <div className="p-6 text-sm text-destructive">Error: {error}</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Allocation Rules Preview</h1>
      <p className="text-sm text-muted-foreground">
        MVP sample rules returned by API. Driver-based cost distribution
        strategies.
      </p>
      <div className="space-y-3">
        {rules.map((r) => (
          <div key={r.rule_id} className="border rounded-md p-4 bg-card/50">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-medium">{r.rule_id}</h2>
                <p className="text-xs text-muted-foreground">
                  Linea: {r.linea_codigo} • Driver: {r.driver}
                </p>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded ${
                  r.active
                    ? "bg-green-600 text-white"
                    : "bg-gray-400 text-white"
                }`}
              >
                {r.active ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
            {r.split && (
              <ul className="mt-2 text-xs list-disc ml-4">
                {r.split.map((s, i) => (
                  <li key={i}>
                    → {s.to.project_id || s.to.cost_center} : {s.pct}%
                  </li>
                ))}
              </ul>
            )}
            {r.fixed_amount && (
              <p className="mt-2 text-xs">
                Fixed Amount: ${r.fixed_amount.toLocaleString()}
              </p>
            )}
          </div>
        ))}
        {rules.length === 0 && (
          <div className="text-sm text-muted-foreground">No rules found.</div>
        )}
      </div>
    </div>
  );
}
